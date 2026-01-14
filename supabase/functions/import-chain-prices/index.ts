import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize product name to canonical key
function normalizeProductName(name: string): string {
  return name
    .replace(/\d+\s*(גרם|מ"ל|ליטר|ק"ג|יח'|מל|גר|ג)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Simple regex-based XML parser for Item elements
function parseXmlItems(xmlString: string): Array<{ name: string; price: number; code?: string }> {
  const items: Array<{ name: string; price: number; code?: string }> = [];
  
  // Remove BOM and clean up
  const cleaned = xmlString.replace(/^\uFEFF/, '').trim();
  
  // Match Item or Product elements
  const itemRegex = /<(?:Item|Product)[^>]*>([\s\S]*?)<\/(?:Item|Product)>/gi;
  let match;
  
  while ((match = itemRegex.exec(cleaned)) !== null) {
    const itemContent = match[1];
    
    // Extract name
    const nameMatch = itemContent.match(/<(?:ItemName|ProductName|ItemNm)>([^<]*)<\/(?:ItemName|ProductName|ItemNm)>/i);
    const name = nameMatch?.[1]?.trim();
    
    // Extract price
    const priceMatch = itemContent.match(/<(?:ItemPrice|ProductPrice|Price)>([^<]*)<\/(?:ItemPrice|ProductPrice|Price)>/i);
    const priceStr = priceMatch?.[1]?.trim();
    const price = priceStr ? parseFloat(priceStr) : NaN;
    
    // Extract code
    const codeMatch = itemContent.match(/<(?:ItemCode|ProductCode|Barcode)>([^<]*)<\/(?:ItemCode|ProductCode|Barcode)>/i);
    const code = codeMatch?.[1]?.trim();
    
    if (name && !isNaN(price) && price > 0) {
      items.push({ name, price, code });
    }
  }
  
  return items;
}

// Decompress gzip data using DecompressionStream
async function decompressGzip(compressedData: Uint8Array): Promise<string> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(compressedData);
      controller.close();
    }
  });
  
  const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
  const reader = decompressedStream.getReader();
  const chunks: Uint8Array[] = [];
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return new TextDecoder('utf-8').decode(result);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chainName, fileUrl } = await req.json();
    
    if (!chainName || !fileUrl) {
      return new Response(JSON.stringify({ 
        error: 'Missing chainName or fileUrl' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Starting import for ${chainName} from ${fileUrl}`);

    // Download the file
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const compressedData = new Uint8Array(arrayBuffer);
    
    console.log(`Downloaded ${compressedData.length} bytes`);

    // Try to decompress, fall back to plain text
    let xmlString: string;
    try {
      xmlString = await decompressGzip(compressedData);
      console.log('Successfully decompressed gzip data');
    } catch {
      console.log('Not gzip, treating as plain text');
      xmlString = new TextDecoder('utf-8').decode(compressedData);
    }

    // Parse XML items
    const items = parseXmlItems(xmlString);
    console.log(`Parsed ${items.length} items from XML`);

    if (items.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No valid items found in file',
        sample: xmlString.substring(0, 500)
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Group by canonical key and calculate average
    const priceMap = new Map<string, { prices: number[]; name: string }>();
    
    for (const item of items) {
      const key = normalizeProductName(item.name);
      if (!priceMap.has(key)) {
        priceMap.set(key, { prices: [], name: item.name });
      }
      priceMap.get(key)!.prices.push(item.price);
    }

    // Prepare chain_prices records
    const chainPrices = Array.from(priceMap.entries()).map(([key, data]) => ({
      canonical_key: key,
      chain_name: chainName,
      price_ils: data.prices.reduce((a, b) => a + b, 0) / data.prices.length,
      last_updated: new Date().toISOString()
    }));

    // Upsert in batches
    const batchSize = 100;
    let processed = 0;
    let errors: string[] = [];

    for (let i = 0; i < chainPrices.length; i += batchSize) {
      const batch = chainPrices.slice(i, i + batchSize);
      const { error } = await supabase.from('chain_prices')
        .upsert(batch, { onConflict: 'canonical_key,chain_name' });
      
      if (error) {
        errors.push(`Batch ${i}: ${error.message}`);
      } else {
        processed += batch.length;
      }
    }

    // Update price_lookup with averages
    const canonicalKeys = Array.from(priceMap.keys());
    
    // Fetch all chain prices for these keys
    const { data: allPrices } = await supabase
      .from('chain_prices')
      .select('canonical_key, price_ils')
      .in('canonical_key', canonicalKeys);

    if (allPrices) {
      const avgMap = new Map<string, number[]>();
      for (const p of allPrices) {
        if (!avgMap.has(p.canonical_key)) {
          avgMap.set(p.canonical_key, []);
        }
        avgMap.get(p.canonical_key)!.push(p.price_ils);
      }

      const lookupRecords = Array.from(avgMap.entries()).map(([key, prices]) => ({
        canonical_key: key,
        avg_price_ils: prices.reduce((a, b) => a + b, 0) / prices.length,
        sample_count: prices.length,
        updated_at: new Date().toISOString()
      }));

      for (let i = 0; i < lookupRecords.length; i += batchSize) {
        const batch = lookupRecords.slice(i, i + batchSize);
        await supabase.from('price_lookup')
          .upsert(batch, { onConflict: 'canonical_key' });
      }
    }

    console.log(`Import complete: ${processed} unique products for ${chainName}`);

    return new Response(JSON.stringify({
      success: true,
      chainName,
      itemsProcessed: items.length,
      uniqueProducts: chainPrices.length,
      batchErrors: errors.length > 0 ? errors : undefined
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('Import error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      error: message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});