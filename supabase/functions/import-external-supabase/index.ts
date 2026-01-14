import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { externalUrl, externalAnonKey, tableName, priceColumn, nameColumn } = await req.json();
    
    if (!externalUrl || !externalAnonKey || !tableName) {
      return new Response(JSON.stringify({ 
        error: 'Missing required parameters: externalUrl, externalAnonKey, tableName' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Connecting to external Supabase: ${externalUrl}`);
    console.log(`Table: ${tableName}, Price column: ${priceColumn || 'price_ils'}, Name column: ${nameColumn || 'canonical_key'}`);

    // Connect to external Supabase
    const externalSupabase = createClient(externalUrl, externalAnonKey);

    // Fetch data from external table
    const { data: externalData, error: fetchError } = await externalSupabase
      .from(tableName)
      .select('*')
      .limit(10000);

    if (fetchError) {
      throw new Error(`Failed to fetch from external DB: ${fetchError.message}`);
    }

    if (!externalData || externalData.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No data found in external table',
        tableName
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Fetched ${externalData.length} records from external DB`);

    // Connect to our Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Determine structure based on table name
    let processed = 0;
    const batchSize = 100;
    const errors: string[] = [];

    if (tableName === 'chain_prices' || tableName.includes('chain')) {
      // Import to chain_prices
      for (let i = 0; i < externalData.length; i += batchSize) {
        const batch = externalData.slice(i, i + batchSize).map((row: Record<string, unknown>) => ({
          canonical_key: String(row[nameColumn || 'canonical_key'] || row.canonical_key || row.name || '').toLowerCase().trim(),
          chain_name: String(row.chain_name || 'imported'),
          price_ils: Number(row[priceColumn || 'price_ils'] || row.price_ils || row.price || 0),
          last_updated: new Date().toISOString()
        })).filter((r: { canonical_key: string; price_ils: number }) => r.canonical_key && r.price_ils > 0);

        if (batch.length > 0) {
          const { error } = await supabase.from('chain_prices')
            .upsert(batch, { onConflict: 'canonical_key,chain_name' });
          
          if (error) {
            errors.push(`Batch ${i}: ${error.message}`);
          } else {
            processed += batch.length;
          }
        }
      }
    } else if (tableName === 'price_lookup' || tableName.includes('lookup') || tableName.includes('average')) {
      // Import to price_lookup
      for (let i = 0; i < externalData.length; i += batchSize) {
        const batch = externalData.slice(i, i + batchSize).map((row: Record<string, unknown>) => ({
          canonical_key: String(row[nameColumn || 'canonical_key'] || row.canonical_key || row.name || '').toLowerCase().trim(),
          avg_price_ils: Number(row[priceColumn || 'avg_price_ils'] || row.avg_price_ils || row.price || 0),
          sample_count: Number(row.sample_count || 1),
          category: row.category ? String(row.category) : null,
          updated_at: new Date().toISOString()
        })).filter((r: { canonical_key: string; avg_price_ils: number }) => r.canonical_key && r.avg_price_ils > 0);

        if (batch.length > 0) {
          const { error } = await supabase.from('price_lookup')
            .upsert(batch, { onConflict: 'canonical_key' });
          
          if (error) {
            errors.push(`Batch ${i}: ${error.message}`);
          } else {
            processed += batch.length;
          }
        }
      }
    } else {
      // Generic import - try to map to price_lookup
      for (let i = 0; i < externalData.length; i += batchSize) {
        const batch = externalData.slice(i, i + batchSize).map((row: Record<string, unknown>) => {
          // Try to find name/key column
          const keyCol = nameColumn || Object.keys(row).find(k => 
            k.toLowerCase().includes('name') || k.toLowerCase().includes('key') || k.toLowerCase() === 'product'
          ) || Object.keys(row)[0];
          
          // Try to find price column
          const priceCol = priceColumn || Object.keys(row).find(k => 
            k.toLowerCase().includes('price') || k.toLowerCase().includes('cost')
          );

          return {
            canonical_key: String(row[keyCol] || '').toLowerCase().trim(),
            avg_price_ils: Number(row[priceCol!] || 0),
            sample_count: 1,
            updated_at: new Date().toISOString()
          };
        }).filter((r: { canonical_key: string; avg_price_ils: number }) => r.canonical_key && r.avg_price_ils > 0);

        if (batch.length > 0) {
          const { error } = await supabase.from('price_lookup')
            .upsert(batch, { onConflict: 'canonical_key' });
          
          if (error) {
            errors.push(`Batch ${i}: ${error.message}`);
          } else {
            processed += batch.length;
          }
        }
      }
    }

    console.log(`Import complete: ${processed} records imported`);

    return new Response(JSON.stringify({
      success: true,
      tableName,
      totalFetched: externalData.length,
      imported: processed,
      errors: errors.length > 0 ? errors : undefined,
      sampleRecord: externalData[0] // Help debug column mapping
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
