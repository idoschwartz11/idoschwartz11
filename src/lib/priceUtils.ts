/**
 * Unified price utilities
 * 
 * IMPORTANT: All price calculations must use ShoppingItem.canonical_key as the lookup key.
 * The canonical_key is the resolved product identifier from the database.
 * 
 * - item.name / item.userText = what the user typed (display only)
 * - item.canonical_key = the database key for price lookups
 */

import { supabase } from '@/integrations/supabase/client';
import { ShoppingItem } from '@/types/ShoppingItem';

export interface ChainPriceEntry {
  chain_name: string;
  price_ils: number;
  canonical_key: string;
}

export interface ChainTotal {
  chainName: string;
  total: number;
  itemsMatched: number;
}

/**
 * Fetch chain prices for multiple canonical keys
 * Always use item.canonical_key, NOT item.name
 */
export async function fetchChainPricesForKeys(
  canonicalKeys: string[]
): Promise<ChainPriceEntry[]> {
  if (canonicalKeys.length === 0) return [];

  const trimmedKeys = canonicalKeys.map(k => k.trim());
  
  console.log('[priceUtils] Fetching chain prices for keys:', trimmedKeys);

  const { data, error } = await supabase
    .from('chain_prices')
    .select('canonical_key, chain_name, price_ils')
    .in('canonical_key', trimmedKeys);

  if (error) {
    console.error('[priceUtils] Error fetching chain prices:', error);
    return [];
  }

  console.log('[priceUtils] Received chain prices:', data?.length || 0, 'entries');
  
  return data || [];
}

/**
 * Calculate chain totals from shopping items
 * Uses canonical_key for price lookups
 */
export async function calculateChainTotals(
  items: ShoppingItem[]
): Promise<ChainTotal[]> {
  const unboughtItems = items.filter(i => !i.isBought);
  
  if (unboughtItems.length === 0) {
    return [];
  }

  // Debug: Log items being processed
  console.log('[priceUtils] calculateChainTotals - items:', 
    unboughtItems.map(i => ({ name: i.name, canonical_key: i.canonical_key, qty: i.quantity }))
  );

  // Use canonical_key for all price lookups
  const canonicalKeys = unboughtItems.map(i => i.canonical_key.trim());
  
  const chainPrices = await fetchChainPricesForKeys(canonicalKeys);

  // Build a lookup map: canonical_key -> { chain_name -> price }
  const priceMap = new Map<string, Map<string, number>>();
  
  chainPrices.forEach(price => {
    if (!priceMap.has(price.canonical_key)) {
      priceMap.set(price.canonical_key, new Map());
    }
    priceMap.get(price.canonical_key)!.set(price.chain_name, price.price_ils);
  });

  // Calculate totals per chain
  const chainTotalMap = new Map<string, { total: number; itemsMatched: number }>();

  unboughtItems.forEach(item => {
    const itemPrices = priceMap.get(item.canonical_key.trim());
    
    if (itemPrices) {
      itemPrices.forEach((price, chainName) => {
        const existing = chainTotalMap.get(chainName) || { total: 0, itemsMatched: 0 };
        chainTotalMap.set(chainName, {
          total: existing.total + (price * item.quantity),
          itemsMatched: existing.itemsMatched + 1,
        });
      });
    }
  });

  const totals: ChainTotal[] = Array.from(chainTotalMap.entries())
    .map(([chainName, data]) => ({
      chainName,
      ...data,
    }))
    .sort((a, b) => a.total - b.total);

  // Debug: Log final totals
  console.log('[priceUtils] Chain totals calculated:', totals);

  return totals;
}

/**
 * Build price data matrix for comparison sheet
 * Uses canonical_key for price lookups, maps back to item.name for display
 */
export async function buildPriceMatrix(
  items: ShoppingItem[]
): Promise<{
  priceData: { [itemName: string]: { [chainName: string]: number } };
  allChainNames: string[];
  chainTotals: ChainTotal[];
}> {
  const unboughtItems = items.filter(i => !i.isBought);
  
  if (unboughtItems.length === 0) {
    return { priceData: {}, allChainNames: [], chainTotals: [] };
  }

  // Use canonical_key for lookups
  const canonicalKeys = unboughtItems.map(i => i.canonical_key.trim());
  
  const chainPrices = await fetchChainPricesForKeys(canonicalKeys);

  // Build price data keyed by canonical_key (not name) for internal use
  // But we'll also create a mapping from canonical_key to item for display
  const priceByCanonicalKey: { [key: string]: { [chain: string]: number } } = {};
  const chainSet = new Set<string>();

  chainPrices.forEach(price => {
    if (!priceByCanonicalKey[price.canonical_key]) {
      priceByCanonicalKey[price.canonical_key] = {};
    }
    priceByCanonicalKey[price.canonical_key][price.chain_name] = price.price_ils;
    chainSet.add(price.chain_name);
  });

  // Calculate chain totals
  const chainTotals = await calculateChainTotals(unboughtItems);
  
  // Sort chains by total (cheapest first)
  const sortedChains = chainTotals
    .map(c => c.chainName)
    .filter(name => chainSet.has(name));
  
  // Add any chains from data that aren't in chainTotals
  chainSet.forEach(chain => {
    if (!sortedChains.includes(chain)) {
      sortedChains.push(chain);
    }
  });

  return {
    priceData: priceByCanonicalKey,
    allChainNames: sortedChains,
    chainTotals,
  };
}
