import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  
  // Try exact match first
  const { data: exactMatch } = await supabase
    .from('price_lookup')
    .select('canonical_key, avg_price_ils, sample_count')
    .ilike('canonical_key', normalized)
    .limit(1)
    .single();
  
  if (exactMatch) return exactMatch;
  
  // Try partial match - query contains key or key contains query
  const { data: partialMatches } = await supabase
    .from('price_lookup')
    .select('canonical_key, avg_price_ils, sample_count')
    .or(`canonical_key.ilike.%${normalized}%`)
    .limit(10);
  
  if (partialMatches && partialMatches.length > 0) {
    // Find best match - prefer shorter keys (more generic)
    const sorted = partialMatches.sort((a: any, b: any) => 
      a.canonical_key.length - b.canonical_key.length
    );
    return sorted[0];
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

  const systemPrompt = `אתה מערכת התאמה למוצרי מזון ישראליים. 
קיבלת שם מוצר מהמשתמש ורשימת שמות קנוניים של מוצרים.
עליך להתאים את שם המוצר לשם הקנוני המתאים ביותר מהרשימה.

חוקים:
1. התאם לפי סוג המוצר הבסיסי (לא מותג)
2. התעלם ממותגים (תנובה, טרה, אסם וכו')
3. התעלם מאחוזי שומן מדויקים - התאם לקטגוריה כללית
4. התעלם מגדלים ספציפיים - התאם למוצר הבסיסי
5. אם אין התאמה טובה, החזר confidence נמוך

החזר JSON בפורמט הבא בלבד:
{"canonicalKey": "שם_מהרשימה", "confidence": 0.0-1.0}

אם אין התאמה טובה, החזר:
{"canonicalKey": null, "confidence": 0}`;

  const userPrompt = `מוצר: "${query}"

רשימת שמות קנוניים:
${availableKeys.slice(0, 100).join('\n')}

התאם את המוצר לשם הקנוני המתאים ביותר.`;

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
    const url = new URL(req.url);
    const query = url.searchParams.get('query');

    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Missing query parameter' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
    
    if (!aiMatch || aiMatch.confidence < 0.35) {
      console.log('No confident AI match found');
      
      // Cache negative result
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
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});