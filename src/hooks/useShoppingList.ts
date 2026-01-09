import { useState, useCallback, useEffect, useMemo } from 'react';
import { ShoppingItem, DeletedItem, GroupedItems } from '@/types/ShoppingItem';
import { getEstimatedPrice, getItemCategory, getAllCategories } from '@/constants/priceTable';
import { supabase } from '@/integrations/supabase/client';

const HISTORY_KEY = 'shopping-list-history';

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
          return {
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            isBought: item.bought,
            orderIndex: 0,
            priceEstimateIls: getEstimatedPrice(item.name),
            categoryId: category.id,
            categoryEmoji: category.emoji,
            createdAt: new Date(item.created_at).getTime(),
            updatedAt: new Date(item.updated_at).getTime(),
          };
        });

        setItems(mappedItems);
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
            const mappedItem: ShoppingItem = {
              id: newItem.id,
              name: newItem.name,
              quantity: newItem.quantity,
              isBought: newItem.bought,
              orderIndex: 0,
              priceEstimateIls: getEstimatedPrice(newItem.name),
              categoryId: category.id,
              categoryEmoji: category.emoji,
              createdAt: new Date(newItem.created_at).getTime(),
              updatedAt: new Date(newItem.updated_at).getTime(),
            };
            setItems(prev => {
              if (prev.some(i => i.id === mappedItem.id)) return prev;
              return [mappedItem, ...prev];
            });
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
  }, []);

  // Persist history
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // Add new item
  const addItem = useCallback(async (name: string, quantity: number = 1) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      const { error } = await supabase
        .from('shopping_items')
        .insert({
          name: trimmedName,
          quantity: Math.max(1, quantity),
          bought: false,
        });

      if (error) throw error;

      // Add to history if not exists
      if (!history.some(h => h.toLowerCase() === trimmedName.toLowerCase())) {
        setHistory(prev => [trimmedName, ...prev].slice(0, 100));
      }
    } catch (error) {
      console.error('Error adding item:', error);
    }
  }, [history]);

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

  // Get suggestions for autocomplete
  const getSuggestions = useCallback((query: string): string[] => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return history
      .filter(h => h.toLowerCase().includes(lowerQuery))
      .slice(0, 5);
  }, [history]);

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
    getSuggestions,
    getShareableText,
  };
}
