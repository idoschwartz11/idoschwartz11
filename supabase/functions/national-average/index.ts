import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation constants
const MAX_QUERY_LENGTH = 200;
const MIN_QUERY_LENGTH = 1;

// Validate API key to prevent unauthorized access
function validateApiKey(req: Request): boolean {
  const apiKey = req.headers.get('apikey');
  const authHeader = req.headers.get('authorization');
  const expectedAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  
  // Accept apikey header matching anon key
  if (apiKey && expectedAnonKey && apiKey === expectedAnonKey) {
    return true;
  }
  
  // Accept Bearer token - either anon key or valid JWT
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    // Accept anon key as bearer token
    if (expectedAnonKey && token === expectedAnonKey) {
      return true;
    }
    // Accept any valid-looking JWT token (has 3 parts separated by dots)
    if (token && token.split('.').length === 3) {
      return true;
    }
  }
  
  return false;
}

// Validate and sanitize query input
function validateQuery(query: string | null): { valid: boolean; error?: string; sanitized?: string } {
  if (!query || query.trim().length === 0) {
    return { valid: false, error: 'Missing query parameter' };
  }
  
  const trimmed = query.trim();
  
  if (trimmed.length < MIN_QUERY_LENGTH) {
    return { valid: false, error: 'Query too short' };
  }
  
  if (trimmed.length > MAX_QUERY_LENGTH) {
    return { valid: false, error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters` };
  }
  
  // Basic sanitization - remove control characters
  const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, '');
  
  return { valid: true, sanitized };
}

// Text normalization for Hebrew
function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[״"'`]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if a direct or partial match exists in lookup table
async function findDirectMatch(
  supabase: any, 
  query: string
): Promise<{ canonical_key: string; avg_price_ils: number; sample_count: number } | null> {
  const normalized = normalizeText(query);
  const queryWords = normalized.split(' ').filter(w => w.length > 0);
  
  // Try exact match first
  const { data: exactMatch } = await supabase
    .from('price_lookup')
    .select('canonical_key, avg_price_ils, sample_count')
    .ilike('canonical_key', normalized)
    .limit(1)
    .single();
  
  if (exactMatch) return exactMatch;
  
  // Fetch all keys for more sophisticated matching
  const { data: allItems } = await supabase
    .from('price_lookup')
    .select('canonical_key, avg_price_ils, sample_count');
  
  if (!allItems || allItems.length === 0) return null;
  
  // Score each item based on matching
  const scoredItems = allItems.map((item: any) => {
    const key = normalizeText(item.canonical_key);
    const keyWords = key.split(' ').filter((w: string) => w.length > 0);
    let score = 0;
    
    // Exact match gets highest score
    if (key === normalized) {
      score = 1000;
    }
    // Query is contained in key (e.g., "קארי" matches "קארי אדום")
    else if (key.includes(normalized)) {
      // Shorter keys are better (more specific match)
      score = 100 + (50 / key.length);
    }
    // Key is contained in query (e.g., "קארי אדום מתוק" matches "קארי אדום")
    else if (normalized.includes(key)) {
      score = 80 + (40 / key.length);
    }
    // Check word-by-word matching
    else {
      const matchingWords = queryWords.filter(qw => 
        keyWords.some((kw: string) => kw.includes(qw) || qw.includes(kw))
      );
      if (matchingWords.length > 0) {
        // Score based on percentage of query words matched
        score = (matchingWords.length / queryWords.length) * 60;
      }
    }
    
    return { ...item, score };
  });
  
  // Filter items with positive score and sort by score descending
  const matches = scoredItems
    .filter((item: any) => item.score > 0)
    .sort((a: any, b: any) => b.score - a.score);
  
  if (matches.length > 0) {
    console.log(`Partial match: "${normalized}" -> "${matches[0].canonical_key}" (score: ${matches[0].score})`);
    return matches[0];
  }
  
  return null;
}

// Use AI to normalize product name to canonical key
async function matchWithAI(
  query: string,
  availableKeys: string[]
): Promise<{ canonicalKey: string; confidence: number } | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY not configured');
    return null;
  }

  const systemPrompt = `אתה מערכת התאמה מדויקת למוצרי מזון ישראליים. 
קיבלת שם מוצר מהמשתמש ורשימת שמות קנוניים של מוצרים.
עליך להתאים את שם המוצר לשם הקנוני המתאים ביותר מהרשימה.

חוקים קריטיים להבחנה בין מוצרים:
1. מוצרים עם תחליפים צמחיים הם מוצרים שונים לחלוטין:
   - "חלב קוקוס" ≠ "חלב" (מוצר צמחי לעומת מוצר חלבי)
   - "חלב שקדים" ≠ "חלב" (מוצר צמחי לעומת מוצר חלבי)
   - "חלב סויה" ≠ "חלב" (מוצר צמחי לעומת מוצר חלבי)
   - "שמנת קוקוס" ≠ "שמנת" 
   - "גבינה טבעונית" ≠ "גבינה"
   
2. מוצרים מיוחדים לא מתאימים למוצרים רגילים:
   - "מייפל סירופ" ≠ "סירופ"
   - "שמן זית" ≠ "שמן"
   - "קמח כוסמין" ≠ "קמח"
   - "אורז בסמטי" ≠ "אורז"

3. כללים נוספים:
   - התאם לפי סוג המוצר הבסיסי (לא מותג)
   - התעלם ממותגים (תנובה, טרה, אסם וכו')
   - התעלם מאחוזי שומן מדויקים - התאם לקטגוריה כללית
   - התעלם מגדלים ספציפיים - התאם למוצר הבסיסי

4. אם המוצר מכיל מילה שמייחדת אותו (קוקוס, שקדים, סויה, טבעוני, ביו, אורגני, כשר לפסח) - חפש התאמה שכוללת את המילה הזו!

5. אם אין התאמה מדויקת ברשימה - החזר confidence נמוך מאוד (מתחת ל-0.3)

החזר JSON בפורמט הבא בלבד:
{"canonicalKey": "שם_מהרשימה", "confidence": 0.0-1.0}

אם אין התאמה טובה, החזר:
{"canonicalKey": null, "confidence": 0}`;

  const userPrompt = `מוצר: "${query}"

רשימת שמות קנוניים:
${availableKeys.slice(0, 150).join('\n')}

התאם את המוצר לשם הקנוני המתאים ביותר. אם אין התאמה מדויקת - החזר confidence נמוך!`;

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limited');
        return null;
      }
      console.error('AI gateway error:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) return null;

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    
    if (parsed.canonicalKey && parsed.confidence > 0) {
      return {
        canonicalKey: parsed.canonicalKey,
        confidence: parsed.confidence
      };
    }
    
    return null;
  } catch (error) {
    console.error('AI matching error:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate API key
    if (!validateApiKey(req)) {
      console.log('Unauthorized request - invalid API key');
      return new Response(JSON.stringify({ 
        error: 'Unauthorized - valid API key required' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const queryParam = url.searchParams.get('query');

    // Validate input
    const validation = validateQuery(queryParam);
    if (!validation.valid) {
      return new Response(JSON.stringify({ 
        error: validation.error 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const query = validation.sanitized!;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const normalizedQuery = normalizeText(query);
    console.log(`Price lookup for: "${query}" (normalized: "${normalizedQuery}")`);

    // Check cache first
    const { data: cached } = await supabase
      .from('price_cache')
      .select('*')
      .eq('query', normalizedQuery)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .single();

    if (cached) {
      // If cache has null result, maybe item was added since - recheck
      if (cached.canonical_key === null) {
        console.log('Cache has null, rechecking price_lookup...');
        const directMatch = await findDirectMatch(supabase, normalizedQuery);
        
        if (directMatch) {
          console.log('Found new match after null cache:', directMatch);
          // Update cache with new result
          await supabase.from('price_cache').update({
            canonical_key: directMatch.canonical_key,
            avg_price_ils: directMatch.avg_price_ils,
            sample_count: directMatch.sample_count,
            confidence: 1.0,
            cached_at: new Date().toISOString()
          }).eq('query', normalizedQuery);
          
          return new Response(JSON.stringify({
            query: query,
            canonicalKey: directMatch.canonical_key,
            avgPriceIls: Number(directMatch.avg_price_ils),
            confidence: 1.0,
            sampleCount: directMatch.sample_count,
            updatedAt: new Date().toISOString(),
            cached: false,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
      
      console.log('Cache hit:', cached);
      return new Response(JSON.stringify({
        query: query,
        canonicalKey: cached.canonical_key,
        avgPriceIls: cached.avg_price_ils ? parseFloat(cached.avg_price_ils) : null,
        confidence: cached.confidence ? parseFloat(cached.confidence) : null,
        sampleCount: cached.sample_count,
        updatedAt: cached.cached_at,
        cached: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try direct match first
    const directMatch = await findDirectMatch(supabase, normalizedQuery);
    
    if (directMatch) {
      console.log('Direct match found:', directMatch);
      
      // Cache the result
      await supabase.from('price_cache').upsert({
        query: normalizedQuery,
        canonical_key: directMatch.canonical_key,
        avg_price_ils: directMatch.avg_price_ils,
        confidence: 1.0,
        sample_count: directMatch.sample_count,
      }, { onConflict: 'query' });

      return new Response(JSON.stringify({
        query: query,
        canonicalKey: directMatch.canonical_key,
        avgPriceIls: Number(directMatch.avg_price_ils),
        confidence: 1.0,
        sampleCount: directMatch.sample_count,
        updatedAt: new Date().toISOString(),
        cached: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all canonical keys for AI matching
    const { data: allKeys } = await supabase
      .from('price_lookup')
      .select('canonical_key');

    if (!allKeys || allKeys.length === 0) {
      console.log('No price data in lookup table');
      return new Response(JSON.stringify({
        query: query,
        avgPriceIls: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const keysList = allKeys.map((k: any) => k.canonical_key);
    
    // Use AI to match
    const aiMatch = await matchWithAI(query, keysList);
    
    if (!aiMatch || aiMatch.confidence < 0.55) {
      console.log('No confident AI match found, trying smart price lookup...');
      
      // Try smart price lookup with web scraping
      try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const smartLookupResponse = await fetch(`${SUPABASE_URL}/functions/v1/smart-price-lookup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          },
          body: JSON.stringify({ productName: query }),
        });

        if (smartLookupResponse.ok) {
          const smartData = await smartLookupResponse.json();
          
          if (smartData.found && smartData.avgPrice) {
            console.log('Smart lookup found price:', smartData);
            return new Response(JSON.stringify({
              query: query,
              canonicalKey: smartData.canonicalName,
              avgPriceIls: Number(smartData.avgPrice),
              confidence: smartData.confidence || 0.7,
              sampleCount: 1,
              updatedAt: new Date().toISOString(),
              cached: false,
              source: 'web_scrape'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
      } catch (smartError) {
        console.error('Smart lookup failed:', smartError);
      }
      
      // Cache negative result if smart lookup also failed
      await supabase.from('price_cache').upsert({
        query: normalizedQuery,
        canonical_key: null,
        avg_price_ils: null,
        confidence: aiMatch?.confidence ?? 0,
        sample_count: null,
      }, { onConflict: 'query' });

      return new Response(JSON.stringify({
        query: query,
        avgPriceIls: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Look up the matched key
    const { data: matchedPrice } = await supabase
      .from('price_lookup')
      .select('*')
      .eq('canonical_key', aiMatch.canonicalKey)
      .limit(1)
      .single();

    if (!matchedPrice) {
      console.log('AI matched key not found in lookup:', aiMatch.canonicalKey);
      return new Response(JSON.stringify({
        query: query,
        avgPriceIls: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('AI match found:', { query, matched: aiMatch, price: matchedPrice });

    // Cache the result
    await supabase.from('price_cache').upsert({
      query: normalizedQuery,
      canonical_key: matchedPrice.canonical_key,
      avg_price_ils: matchedPrice.avg_price_ils,
      confidence: aiMatch.confidence,
      sample_count: matchedPrice.sample_count,
    }, { onConflict: 'query' });

    return new Response(JSON.stringify({
      query: query,
      canonicalKey: matchedPrice.canonical_key,
      avgPriceIls: Number(matchedPrice.avg_price_ils),
      confidence: aiMatch.confidence,
      sampleCount: matchedPrice.sample_count,
      updatedAt: matchedPrice.updated_at,
      cached: false,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in national-average function:', error);
    return new Response(JSON.stringify({ 
      error: 'An error occurred processing your request' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
