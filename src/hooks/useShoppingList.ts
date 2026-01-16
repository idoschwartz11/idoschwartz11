import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ShoppingItem, DeletedItem, GroupedItems } from '@/types/ShoppingItem';
import { getItemCategory, getAllCategories } from '@/constants/priceTable';
import { supabase } from '@/integrations/supabase/client';

const HISTORY_KEY = 'shopping-list-history';
const PRICE_CACHE_KEY = 'national-price-cache-v2';
const CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface PriceCacheEntry {
  avgPriceIls: number | null;
  confidence: number | null;
  cachedAt: number;
}

interface ResolveQueryResult {
  resolved: string | null;
  confidence: number;
  source: string;
}

function loadPriceCache(): Map<string, PriceCacheEntry> {
  try {
    const stored = localStorage.getItem(PRICE_CACHE_KEY);
    if (!stored) return new Map();
    const parsed = JSON.parse(stored);
    const now = Date.now();
    const entries: [string, PriceCacheEntry][] = Object.entries(parsed)
      .filter(([, entry]: [string, any]) => now - entry.cachedAt < CACHE_DURATION_MS)
      .map(([key, entry]: [string, any]) => [key, entry as PriceCacheEntry]);
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function savePriceCache(cache: Map<string, PriceCacheEntry>): void {
  try {
    const obj = Object.fromEntries(cache.entries());
    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore storage errors
  }
}

function normalizeQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[״"'`]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadHistory(): string[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function useShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [deletedItem, setDeletedItem] = useState<DeletedItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const priceCacheRef = useRef<Map<string, PriceCacheEntry>>(loadPriceCache());
  const pendingPricesRef = useRef<Set<string>>(new Set());

  // Fetch price from national average API
  const fetchPrice = useCallback(async (canonicalKey: string): Promise<number | null> => {
    const normalized = normalizeQuery(canonicalKey);
    if (!normalized) return null;

    // Check local cache
    const cached = priceCacheRef.current.get(normalized);
    if (cached) {
      return cached.avgPriceIls;
    }

    // Skip if already fetching
    if (pendingPricesRef.current.has(normalized)) {
      return null;
    }

    pendingPricesRef.current.add(normalized);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/national-average?query=${encodeURIComponent(canonicalKey)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error('Price fetch failed:', response.status);
        return null;
      }

      const result = await response.json();
      
      const entry: PriceCacheEntry = {
        avgPriceIls: result.avgPriceIls ?? null,
        confidence: result.confidence ?? null,
        cachedAt: Date.now(),
      };

      priceCacheRef.current.set(normalized, entry);
      savePriceCache(priceCacheRef.current);
      
      return entry.avgPriceIls;
    } catch (error) {
      console.error('Price fetch error:', error);
      return null;
    } finally {
      pendingPricesRef.current.delete(normalized);
    }
  }, []);

  // Update item price in state
  const updateItemPrice = useCallback((itemId: string, price: number | null) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, priceEstimateIls: price } : item
    ));
  }, []);

  // Fetch prices for items that don't have them (use canonical_key)
  const fetchMissingPrices = useCallback(async (itemsToFetch: ShoppingItem[]) => {
    for (const item of itemsToFetch) {
      const normalized = normalizeQuery(item.canonical_key);
      const cached = priceCacheRef.current.get(normalized);
      
      if (cached) {
        if (item.priceEstimateIls !== cached.avgPriceIls) {
          updateItemPrice(item.id, cached.avgPriceIls);
        }
      } else if (!pendingPricesRef.current.has(normalized)) {
        // Fetch in background using canonical_key
        fetchPrice(item.canonical_key).then(price => {
          if (price !== null) {
            updateItemPrice(item.id, price);
          }
        });
      }
    }
  }, [fetchPrice, updateItemPrice]);

  // Load items from database
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const { data, error } = await supabase
          .from('shopping_items')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mappedItems: ShoppingItem[] = (data || []).map(item => {
          const category = getItemCategory(item.name);
          const normalized = normalizeQuery(item.name);
          const cached = priceCacheRef.current.get(normalized);
          
          return {
            id: item.id,
            name: item.name,
            userText: item.name,
            resolvedCanonicalKey: null,
            canonical_key: item.name,
            resolveConfidence: 0,
            resolveSource: 'prior',
            quantity: item.quantity,
            isBought: item.bought,
            orderIndex: 0,
            priceEstimateIls: cached?.avgPriceIls ?? null,
            categoryId: category.id,
            categoryEmoji: category.emoji,
            createdAt: new Date(item.created_at).getTime(),
            updatedAt: new Date(item.updated_at).getTime(),
          };
        });

        setItems(mappedItems);
        
        // Fetch missing prices in background
        setTimeout(() => fetchMissingPrices(mappedItems), 100);
      } catch (error) {
        console.error('Error fetching items:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItems();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('shopping_items_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_items'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newItem = payload.new as any;
            const category = getItemCategory(newItem.name);
            const normalized = normalizeQuery(newItem.name);
            const cached = priceCacheRef.current.get(normalized);
            
            const mappedItem: ShoppingItem = {
              id: newItem.id,
              name: newItem.name,
              userText: newItem.name,
              resolvedCanonicalKey: null,
              canonical_key: newItem.name,
              resolveConfidence: 0,
              resolveSource: 'realtime',
              quantity: newItem.quantity,
              isBought: newItem.bought,
              orderIndex: 0,
              priceEstimateIls: cached?.avgPriceIls ?? null,
              categoryId: category.id,
              categoryEmoji: category.emoji,
              createdAt: new Date(newItem.created_at).getTime(),
              updatedAt: new Date(newItem.updated_at).getTime(),
            };
            
            setItems(prev => {
              if (prev.some(i => i.id === mappedItem.id)) return prev;
              return [mappedItem, ...prev];
            });
            
            // Fetch price for new item
            if (!cached) {
              fetchPrice(newItem.name).then(price => {
                if (price !== null) {
                  updateItemPrice(newItem.id, price);
                }
              });
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedItem = payload.new as any;
            setItems(prev => prev.map(item => {
              if (item.id === updatedItem.id) {
                return {
                  ...item,
                  quantity: updatedItem.quantity,
                  isBought: updatedItem.bought,
                  updatedAt: new Date(updatedItem.updated_at).getTime(),
                };
              }
              return item;
            }));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old?.id;
            if (deletedId) {
              setItems(prev => prev.filter(item => item.id !== deletedId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMissingPrices, fetchPrice, updateItemPrice]);

  // Persist history
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // Resolve query via RPC
  const resolveQuery = useCallback(async (userText: string): Promise<ResolveQueryResult> => {
    try {
      const { data, error } = await supabase.rpc('resolve_query', { q: userText });
      
      if (error) {
        console.error('resolve_query RPC error:', error);
        return {
          resolved: null,
          confidence: 0,
          source: 'rpc_error'
        };
      }
      
      // Parse the JSON response
      const result = typeof data === 'string' ? JSON.parse(data) : data;
      
      return {
        resolved: result?.resolved ?? null,
        confidence: result?.confidence ?? 0,
        source: result?.source ?? 'fallback'
      };
    } catch (error) {
      console.error('resolve_query exception:', error);
      return {
        resolved: null,
        confidence: 0,
        source: 'rpc_error'
      };
    }
  }, []);

  // Add new item - simplified flow with resolve_query RPC
  const addItem = useCallback(async (userText: string, quantity: number = 1) => {
    const trimmedText = userText.trim();
    if (!trimmedText) return;

    // Call resolve_query RPC
    const resolveResult = await resolveQuery(trimmedText);
    
    const category = getItemCategory(trimmedText);
    const canonicalKey = resolveResult.resolved ?? trimmedText;
    
    // Create local item immediately for optimistic UI
    const tempId = `${Date.now()}-${Math.random()}`;
    const newLocalItem: ShoppingItem = {
      id: tempId,
      name: trimmedText,
      userText: trimmedText,
      resolvedCanonicalKey: resolveResult.resolved,
      canonical_key: canonicalKey,
      resolveConfidence: resolveResult.confidence,
      resolveSource: resolveResult.source,
      quantity: Math.max(1, quantity),
      isBought: false,
      orderIndex: 0,
      priceEstimateIls: null,
      categoryId: category.id,
      categoryEmoji: category.emoji,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Add to local state immediately (optimistic update)
    setItems(prev => [newLocalItem, ...prev]);

    // Add to history if not exists
    if (!history.some(h => h.toLowerCase() === trimmedText.toLowerCase())) {
      setHistory(prev => [trimmedText, ...prev].slice(0, 100));
    }

    // Fetch price in background using canonical_key
    fetchPrice(canonicalKey).then(price => {
      if (price !== null) {
        setItems(prev => prev.map(item => 
          item.id === tempId ? { ...item, priceEstimateIls: price } : item
        ));
      }
    });

    try {
      // Insert into database (realtime will update with real ID)
      const { data: insertedData, error } = await supabase
        .from('shopping_items')
        .insert({
          name: trimmedText,
          quantity: Math.max(1, quantity),
          bought: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Replace temp item with real one
      if (insertedData) {
        setItems(prev => prev.map(item => {
          if (item.id === tempId) {
            return {
              ...item,
              id: insertedData.id,
              createdAt: new Date(insertedData.created_at).getTime(),
              updatedAt: new Date(insertedData.updated_at).getTime(),
            };
          }
          return item;
        }));
      }
    } catch (error) {
      console.error('Error adding item:', error);
      // Remove optimistic item on error
      setItems(prev => prev.filter(item => item.id !== tempId));
    }
  }, [history, resolveQuery, fetchPrice]);

  // Toggle bought status
  const toggleBought = useCallback(async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    try {
      const { error } = await supabase
        .from('shopping_items')
        .update({ bought: !item.isBought })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error toggling item:', error);
    }
  }, [items]);

  // Update quantity
  const updateQuantity = useCallback(async (id: string, delta: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const newQuantity = Math.max(1, item.quantity + delta);

    try {
      const { error } = await supabase
        .from('shopping_items')
        .update({ quantity: newQuantity })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  }, [items]);

  // Delete item
  const deleteItem = useCallback(async (id: string) => {
    const itemToDelete = items.find(i => i.id === id);
    if (!itemToDelete) return;

    setDeletedItem({ ...itemToDelete, deletedAt: Date.now() });

    try {
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting item:', error);
      setDeletedItem(null);
    }
  }, [items]);

  // Undo delete
  const undoDelete = useCallback(async () => {
    if (!deletedItem) return;

    try {
      const { error } = await supabase
        .from('shopping_items')
        .insert({
          id: deletedItem.id,
          name: deletedItem.name,
          quantity: deletedItem.quantity,
          bought: deletedItem.isBought,
        });

      if (error) throw error;
      setDeletedItem(null);
    } catch (error) {
      console.error('Error undoing delete:', error);
    }
  }, [deletedItem]);

  // Clear deleted item (dismiss undo)
  const dismissUndo = useCallback(() => {
    setDeletedItem(null);
  }, []);

  // Clear bought items
  const clearBoughtItems = useCallback(async () => {
    const boughtIds = items.filter(i => i.isBought).map(i => i.id);
    if (boughtIds.length === 0) return;

    try {
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .in('id', boughtIds);

      if (error) throw error;
    } catch (error) {
      console.error('Error clearing bought items:', error);
    }
  }, [items]);

  // Memoized: items grouped by category
  const groupedItems = useMemo((): GroupedItems[] => {
    const allCategories = getAllCategories();
    const groups: GroupedItems[] = [];
    
    allCategories.forEach(category => {
      const categoryItems = items.filter(item => item.categoryId === category.id);
      const unboughtItems = categoryItems
        .filter(i => !i.isBought)
        .sort((a, b) => b.createdAt - a.createdAt);
      const boughtItems = categoryItems
        .filter(i => i.isBought)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      
      if (unboughtItems.length > 0 || boughtItems.length > 0) {
        groups.push({
          categoryId: category.id,
          categoryTitle: category.title,
          categoryEmoji: category.emoji,
          unboughtItems,
          boughtItems,
        });
      }
    });
    
    return groups;
  }, [items]);

  // Memoized computed values
  const unboughtItems = useMemo(() => 
    items.filter(i => !i.isBought),
    [items]
  );

  const boughtItems = useMemo(() => 
    items.filter(i => i.isBought),
    [items]
  );

  const estimatedTotal = useMemo(() => 
    unboughtItems.reduce((sum, item) => {
      if (item.priceEstimateIls) {
        return sum + (item.priceEstimateIls * item.quantity);
      }
      return sum;
    }, 0),
    [unboughtItems]
  );

  const hasBoughtItems = boughtItems.length > 0;
  const hasItemsWithPrices = unboughtItems.some(i => i.priceEstimateIls !== null);
  const hasItems = items.length > 0;

  // Get shareable list text
  const getShareableText = useCallback((): string => {
    if (unboughtItems.length === 0) return '';
    
    const itemsList = unboughtItems
      .map(item => {
        if (item.quantity > 1) {
          return `- ${item.categoryEmoji} ${item.name} (${item.quantity})`;
        }
        return `- ${item.categoryEmoji} ${item.name}`;
      })
      .join('\n');
    
    return `לקנות:\n${itemsList}`;
  }, [unboughtItems]);

  return {
    items,
    unboughtItems,
    boughtItems,
    groupedItems,
    estimatedTotal,
    hasBoughtItems,
    hasItemsWithPrices,
    hasItems,
    deletedItem,
    isLoading,
    addItem,
    toggleBought,
    updateQuantity,
    deleteItem,
    undoDelete,
    dismissUndo,
    clearBoughtItems,
    getShareableText,
  };
}
