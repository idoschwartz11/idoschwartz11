import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Israeli supermarket chain URLs for price scraping
const CHAIN_SEARCH_URLS: Record<string, string> = {
  'שופרסל': 'shufersal.co.il',
  'רמי לוי': 'rframilevi.co.il',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { productName } = await req.json();

    if (!productName || productName.trim().length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Missing productName parameter' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!FIRECRAWL_API_KEY) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(JSON.stringify({ 
        error: 'Firecrawl not configured',
        found: false 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Smart price lookup for: "${productName}"`);

    // Search the web for the product price in Israeli supermarkets
    const searchQuery = `מחיר ${productName} סופרמרקט ישראל שופרסל רמי לוי`;
    
    console.log(`Searching web for: "${searchQuery}"`);

    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 5,
        lang: 'he',
        country: 'IL',
        scrapeOptions: {
          formats: ['markdown']
        }
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Firecrawl search error:', searchResponse.status, errorText);
      return new Response(JSON.stringify({ 
        error: 'Search failed',
        found: false 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const searchData = await searchResponse.json();
    console.log('Search results:', searchData.data?.length || 0, 'results found');

    if (!searchData.data || searchData.data.length === 0) {
      console.log('No search results found');
      return new Response(JSON.stringify({
        productName,
        found: false,
        message: 'No results found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Combine all markdown content for AI analysis
    const combinedContent = searchData.data
      .slice(0, 3)
      .map((result: any) => `מקור: ${result.url}\n${result.markdown || result.description || ''}`)
      .join('\n\n---\n\n');

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ 
        error: 'AI not configured',
        found: false 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use AI to extract price information
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `אתה מנתח מחירי מוצרים בסופרמרקטים ישראליים.
קיבלת תוצאות חיפוש ואתה צריך לחלץ מחיר למוצר הספציפי.

החזר JSON בפורמט הבא בלבד:
{
  "found": true/false,
  "canonicalName": "שם המוצר הסטנדרטי בעברית",
  "avgPrice": מספר (מחיר ממוצע בש"ח),
  "chainPrices": {
    "שופרסל": מספר או null,
    "רמי לוי": מספר או null,
    "ויקטורי": מספר או null,
    "יוחננוף": מספר או null,
    "מגה": מספר או null,
    "חצי חינם": מספר או null,
    "סופר יודה": מספר או null,
    "סטופ מרקט": מספר או null
  },
  "category": "קטגוריה (מוצרי חלב/ירקות/פירות/בשר/דגים/מוצרים יבשים/משקאות/ניקיון/אחר)",
  "confidence": 0.0-1.0
}

אם לא מצאת מחיר אמין, החזר found: false.
המחיר צריך להיות הגיוני עבור המוצר (לא מחיר לחבילה גדולה אם המוצר הוא יחידה בודדת).`
          },
          {
            role: 'user',
            content: `חפש מחיר עבור: "${productName}"

תוצאות חיפוש:
${combinedContent.slice(0, 8000)}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI gateway error:', aiResponse.status, errorText);
      return new Response(JSON.stringify({
        productName,
        found: false,
        error: 'AI analysis failed'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      console.log('No AI response content');
      return new Response(JSON.stringify({
        productName,
        found: false,
        message: 'Could not analyze results'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract JSON from AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.log('No JSON in AI response');
      return new Response(JSON.stringify({
        productName,
        found: false,
        message: 'Could not parse AI response'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const priceData = JSON.parse(jsonMatch[0]);
    console.log('AI extracted price data:', priceData);

    if (!priceData.found || priceData.confidence < 0.5) {
      console.log('Low confidence or not found');
      return new Response(JSON.stringify({
        productName,
        found: false,
        message: 'Could not find reliable price'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save to price_lookup table
    const canonicalName = priceData.canonicalName || productName;
    
    const { error: lookupError } = await supabase
      .from('price_lookup')
      .upsert({
        canonical_key: canonicalName,
        avg_price_ils: priceData.avgPrice,
        sample_count: 1,
        updated_at: new Date().toISOString()
      }, { onConflict: 'canonical_key' });

    if (lookupError) {
      console.error('Error saving to price_lookup:', lookupError);
    } else {
      console.log('Saved to price_lookup:', canonicalName);
    }

    // Save chain prices if available
    if (priceData.chainPrices) {
      const chainEntries = Object.entries(priceData.chainPrices)
        .filter(([_, price]) => price !== null && price !== undefined)
        .map(([chain, price]) => ({
          canonical_key: canonicalName,
          chain_name: chain,
          price_ils: price as number,
          last_updated: new Date().toISOString()
        }));

      if (chainEntries.length > 0) {
        const { error: chainError } = await supabase
          .from('chain_prices')
          .upsert(chainEntries, { onConflict: 'canonical_key,chain_name' });

        if (chainError) {
          console.error('Error saving chain prices:', chainError);
        } else {
          console.log('Saved chain prices for:', chainEntries.map(e => e.chain_name).join(', '));
        }
      }
    }

    // Update price_cache for this query
    const normalizedQuery = productName.trim().toLowerCase();
    await supabase.from('price_cache').upsert({
      query: normalizedQuery,
      canonical_key: canonicalName,
      avg_price_ils: priceData.avgPrice,
      confidence: priceData.confidence,
      sample_count: 1,
    }, { onConflict: 'query' });

    return new Response(JSON.stringify({
      productName,
      found: true,
      canonicalName,
      avgPrice: priceData.avgPrice,
      chainPrices: priceData.chainPrices,
      category: priceData.category,
      confidence: priceData.confidence,
      source: 'web_scrape'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in smart-price-lookup:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      found: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
