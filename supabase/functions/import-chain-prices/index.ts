import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize product name to canonical key
function normalizeProductName(name: string): string {
  return name
    .replace(/\d+(\.\d+)?\s*(גרם|גר|ג|מ"ל|מל|ליטר|ל|ק"ג|קג|יח'|יחידה|יחידות|מ"ג|מג|ml|gr|kg|l|g)/gi, '')
    .replace(/\s*[xX×]\s*\d+/g, '') // Remove multipliers like x6
    .replace(/\d+%/g, '') // Remove percentages
    .replace(/[()[\]{}]/g, '') // Remove brackets
    .replace(/\s+/g, ' ')
    .trim();
}

// Parse XML items from Israeli supermarket price files
function parseXmlItems(xmlString: string): Array<{ name: string; price: number; code?: string }> {
  const items: Array<{ name: string; price: number; code?: string }> = [];
  
  // Match Item or Product elements
  const itemRegex = /<(?:Item|Product)[^>]*>([\s\S]*?)<\/(?:Item|Product)>/gi;
  let match;
  
  while ((match = itemRegex.exec(xmlString)) !== null) {
    const itemContent = match[1];
    
    // Extract name (ItemName, ProductName, or ItemNm)
    const nameMatch = itemContent.match(/<(?:ItemName|ProductName|ItemNm)>([^<]+)<\/(?:ItemName|ProductName|ItemNm)>/i);
    
    // Extract price (ItemPrice, ProductPrice, or Price)
    const priceMatch = itemContent.match(/<(?:ItemPrice|ProductPrice|Price)>([^<]+)<\/(?:ItemPrice|ProductPrice|Price)>/i);
    
    // Extract code (optional)
    const codeMatch = itemContent.match(/<(?:ItemCode|ProductCode|Barcode)>([^<]+)<\/(?:ItemCode|ProductCode|Barcode)>/i);
    
    if (nameMatch && priceMatch) {
      const name = nameMatch[1].trim();
      const price = parseFloat(priceMatch[1]);
      
      if (name && !isNaN(price) && price > 0) {
        items.push({
          name,
          price,
          code: codeMatch ? codeMatch[1].trim() : undefined
        });
      }
    }
  }
  
  return items;
}

// Decompress gzip data
async function decompressGzip(compressedData: Uint8Array): Promise<string> {
  const ds = new DecompressionStream('gzip');
  const blob = new Blob([new Uint8Array(compressedData)]);
  const decompressedStream = blob.stream().pipeThrough(ds);
  const decompressedBlob = await new Response(decompressedStream).blob();
  return await decompressedBlob.text();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chainName, fileUrl } = await req.json();
    
    if (!chainName || !fileUrl) {
      return new Response(
        JSON.stringify({ error: 'חסרים שם רשת או URL לקובץ' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting import for ${chainName} from ${fileUrl}`);

    // 1. Download the file
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }
    
    const compressedData = new Uint8Array(await response.arrayBuffer());
    console.log(`Downloaded ${compressedData.length} bytes`);

    // 2. Decompress gzip
    let xmlString: string;
    try {
      xmlString = await decompressGzip(compressedData);
      console.log(`Decompressed to ${xmlString.length} characters`);
    } catch (e) {
      // Maybe it's not compressed, try as plain XML
      xmlString = new TextDecoder().decode(compressedData);
      console.log(`File was not gzipped, treating as plain XML`);
    }

    // 3. Parse XML to extract items
    const items = parseXmlItems(xmlString);
    console.log(`Parsed ${items.length} items from XML`);

    if (items.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'לא נמצאו מוצרים בקובץ. ודא שהפורמט תקין.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Save to database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Group items by canonical key and calculate average
    const pricesByCanonical = new Map<string, { prices: number[]; originalName: string }>();
    
    for (const item of items) {
      const canonicalKey = normalizeProductName(item.name);
      if (canonicalKey.length < 2) continue; // Skip very short names
      
      if (!pricesByCanonical.has(canonicalKey)) {
        pricesByCanonical.set(canonicalKey, { prices: [], originalName: item.name });
      }
      pricesByCanonical.get(canonicalKey)!.prices.push(item.price);
    }

    // Process in batches
    const batchSize = 100;
    const entries = Array.from(pricesByCanonical.entries());
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      const chainPrices = batch.map(([canonicalKey, data]) => ({
        canonical_key: canonicalKey,
        chain_name: chainName,
        price_ils: data.prices.reduce((a, b) => a + b, 0) / data.prices.length,
        last_updated: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('chain_prices')
        .upsert(chainPrices, { 
          onConflict: 'canonical_key,chain_name',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`Batch error: ${error.message}`);
        errors++;
      } else {
        processed += batch.length;
      }
    }

    // 5. Update price_lookup with averages across all chains
    console.log('Updating price_lookup averages...');
    
    // Get all unique canonical keys we just added
    const canonicalKeys = Array.from(pricesByCanonical.keys());
    
    for (let i = 0; i < canonicalKeys.length; i += batchSize) {
      const keysBatch = canonicalKeys.slice(i, i + batchSize);
      
      // Get all prices for these keys across all chains
      const { data: allPrices } = await supabase
        .from('chain_prices')
        .select('canonical_key, price_ils')
        .in('canonical_key', keysBatch);

      if (allPrices) {
        // Calculate averages
        const avgByKey = new Map<string, number[]>();
        for (const row of allPrices) {
          if (!avgByKey.has(row.canonical_key)) {
            avgByKey.set(row.canonical_key, []);
          }
          avgByKey.get(row.canonical_key)!.push(Number(row.price_ils));
        }

        // Upsert to price_lookup
        const lookupRows = Array.from(avgByKey.entries()).map(([key, prices]) => ({
          canonical_key: key,
          avg_price_ils: prices.reduce((a, b) => a + b, 0) / prices.length,
          sample_count: prices.length,
          updated_at: new Date().toISOString()
        }));

        await supabase
          .from('price_lookup')
          .upsert(lookupRows, { 
            onConflict: 'canonical_key',
            ignoreDuplicates: false 
          });
      }
    }

    console.log(`Import complete: ${processed} items processed, ${errors} batch errors`);

    return new Response(
      JSON.stringify({
        success: true,
        chainName,
        itemsProcessed: processed,
        uniqueProducts: pricesByCanonical.size,
        batchErrors: errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
