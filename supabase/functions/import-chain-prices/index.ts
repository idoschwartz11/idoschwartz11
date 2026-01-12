import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Normalize product name to canonical key (עדין יותר)
function normalizeProductName(name: string): string {
  return name
    .replace(/[()[\]{}]/g, " ")
    .replace(/\s*[xX×]\s*\d+/g, "") // Remove multipliers like x6
    .replace(/\s+/g, " ")
    .trim();
}

// Safer XML parsing using DOMParser
function parseXmlItems(xmlString: string): Array<{ name: string; price: number; code?: string }> {
  // BOM clean (נפוץ בקבצים האלה)
  const cleaned = xmlString.replace(/^\uFEFF/, "");

  const doc = new DOMParser().parseFromString(cleaned, "application/xml");
  if (!doc) return [];

  // אם יש שגיאת XML – מחזיר parsererror
  const parserErr = doc.querySelector("parsererror");
  if (parserErr) return [];

  const items: Array<{ name: string; price: number; code?: string }> = [];

  // תופס גם Item וגם Product
  const nodes = Array.from(doc.querySelectorAll("Item, Product"));

  for (const node of nodes) {
    const name =
      node.querySelector("ItemName")?.textContent?.trim() ||
      node.querySelector("ProductName")?.textContent?.trim() ||
      node.querySelector("ItemNm")?.textContent?.trim() ||
      "";

    const priceStr =
      node.querySelector("ItemPrice")?.textContent?.trim() ||
      node.querySelector("ProductPrice")?.textContent?.trim() ||
      node.querySelector("Price")?.textContent?.trim() ||
      "";

    const code =
      node.querySelector("ItemCode")?.textContent?.trim() ||
      node.querySelector("ProductCode")?.textContent?.trim() ||
      node.querySelector("Barcode")?.textContent?.trim();

    const price = Number(priceStr);

    if (name && Number.isFinite(price) && price > 0) {
      items.push({ name, price, code: code || undefined });
    }
  }

  return items;
}

// Decompress gzip data
async function decompressGzip(compressedData: Uint8Array): Promise<string> {
  const ds = new DecompressionStream("gzip");
  const blob = new Blob([compressedData]);
  const decompressedStream = blob.stream().pipeThrough(ds);
  return await new Response(decompressedStream).text();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chainName, fileUrl } = await req.json();

    if (!chainName || !fileUrl) {
      return new Response(JSON.stringify({ error: "חסרים שם רשת או URL לקובץ" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) Download
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
    }
    const raw = new Uint8Array(await response.arrayBuffer());

    // 2) Decompress (אם לא gz – ננסה טקסט רגיל)
    let xmlString: string;
    try {
      xmlString = await decompressGzip(raw);
    } catch {
      xmlString = new TextDecoder().decode(raw);
    }

    // 3) Parse XML
    const items = parseXmlItems(xmlString);
    if (items.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "לא נמצאו מוצרים בקובץ או שה־XML לא תקין." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Group -> avg per canonical key (מומלץ לשקול להשתמש בקוד/ברקוד במקום name בלבד)
    const byKey = new Map<string, { sum: number; count: number }>();

    for (const item of items) {
      const key = normalizeProductName(item.name);
      if (key.length < 2) continue;

      const curr = byKey.get(key) ?? { sum: 0, count: 0 };
      curr.sum += item.price;
      curr.count += 1;
      byKey.set(key, curr);
    }

    const now = new Date().toISOString();
    const entries = Array.from(byKey.entries());

    // 5) Upsert chain_prices בבאצ'ים
    const batchSize = 500;
    let processed = 0;
    let errors = 0;

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);

      const rows = batch.map(([canonical_key, v]) => ({
        canonical_key,
        chain_name: chainName,
        price_ils: v.sum / v.count,
        last_updated: now,
      }));

      const { error } = await supabase.from("chain_prices").upsert(rows, { onConflict: "canonical_key,chain_name" });

      if (error) {
        errors++;
      } else {
        processed += batch.length;
      }
    }

    // 6) עדכון price_lookup ב־DB (RPC מומלץ)
    // צור פונקציה ב־SQL פעם אחת (מצורף למטה) ואז:
    const canonicalKeys = entries.map(([k]) => k);

    for (let i = 0; i < canonicalKeys.length; i += batchSize) {
      const keysBatch = canonicalKeys.slice(i, i + batchSize);
      const { error } = await supabase.rpc("refresh_price_lookup_for_keys", { keys: keysBatch });
      if (error) errors++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        chainName,
        itemsParsed: items.length,
        uniqueProducts: byKey.size,
        itemsProcessed: processed,
        batchErrors: errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
