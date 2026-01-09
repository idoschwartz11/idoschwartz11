import { useState, useCallback, useEffect, useMemo } from 'react';
import { ShoppingItem, DeletedItem } from '@/types/ShoppingItem';
import { getEstimatedPrice } from '@/data/priceEstimates';

const STORAGE_KEY = 'shopping-list-items';
const HISTORY_KEY = 'shopping-list-history';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function loadItems(): ShoppingItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveItems(items: ShoppingItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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
  const [items, setItems] = useState<ShoppingItem[]>(loadItems);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const [deletedItem, setDeletedItem] = useState<DeletedItem | null>(null);

  // Persist items
  useEffect(() => {
    saveItems(items);
  }, [items]);

  // Persist history
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  // Add new item
  const addItem = useCallback((name: string, quantity: number = 1) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const newItem: ShoppingItem = {
      id: generateId(),
      name: trimmedName,
      quantity: Math.max(1, quantity),
      isBought: false,
      orderIndex: items.filter(i => !i.isBought).length,
      priceEstimateIls: getEstimatedPrice(trimmedName),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setItems(prev => [newItem, ...prev]);

    // Add to history if not exists
    if (!history.some(h => h.toLowerCase() === trimmedName.toLowerCase())) {
      setHistory(prev => [trimmedName, ...prev].slice(0, 100));
    }
  }, [items, history]);

  // Toggle bought status
  const toggleBought = useCallback((id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          isBought: !item.isBought,
          updatedAt: Date.now(),
        };
      }
      return item;
    }));
  }, []);

  // Update quantity
  const updateQuantity = useCallback((id: string, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(1, item.quantity + delta);
        return {
          ...item,
          quantity: newQuantity,
          updatedAt: Date.now(),
        };
      }
      return item;
    }));
  }, []);

  // Delete item
  const deleteItem = useCallback((id: string) => {
    const itemToDelete = items.find(i => i.id === id);
    if (itemToDelete) {
      setDeletedItem({ ...itemToDelete, deletedAt: Date.now() });
      setItems(prev => prev.filter(item => item.id !== id));
    }
  }, [items]);

  // Undo delete
  const undoDelete = useCallback(() => {
    if (deletedItem) {
      const { deletedAt, ...item } = deletedItem;
      setItems(prev => {
        const newItems = [...prev, item];
        // Sort to restore original position
        return newItems.sort((a, b) => {
          if (a.isBought !== b.isBought) return a.isBought ? 1 : -1;
          return a.orderIndex - b.orderIndex;
        });
      });
      setDeletedItem(null);
    }
  }, [deletedItem]);

  // Clear deleted item (dismiss undo)
  const dismissUndo = useCallback(() => {
    setDeletedItem(null);
  }, []);

  // Clear bought items
  const clearBoughtItems = useCallback(() => {
    setItems(prev => prev.filter(item => !item.isBought));
  }, []);

  // Reorder items
  const reorderItems = useCallback((fromIndex: number, toIndex: number) => {
    setItems(prev => {
      const unbought = prev.filter(i => !i.isBought);
      const bought = prev.filter(i => i.isBought);
      
      const [moved] = unbought.splice(fromIndex, 1);
      unbought.splice(toIndex, 0, moved);
      
      // Update orderIndex
      const reordered = unbought.map((item, idx) => ({
        ...item,
        orderIndex: idx,
        updatedAt: Date.now(),
      }));
      
      return [...reordered, ...bought];
    });
  }, []);

  // Memoized computed values
  const unboughtItems = useMemo(() => 
    items
      .filter(i => !i.isBought)
      .sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  const boughtItems = useMemo(() => 
    items
      .filter(i => i.isBought)
      .sort((a, b) => b.updatedAt - a.updatedAt),
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
          return `- ${item.name} (${item.quantity})`;
        }
        return `- ${item.name}`;
      })
      .join('\n');
    
    return `לקנות:\n${itemsList}`;
  }, [unboughtItems]);

  return {
    items,
    unboughtItems,
    boughtItems,
    estimatedTotal,
    hasBoughtItems,
    hasItemsWithPrices,
    deletedItem,
    addItem,
    toggleBought,
    updateQuantity,
    deleteItem,
    undoDelete,
    dismissUndo,
    clearBoughtItems,
    reorderItems,
    getSuggestions,
    getShareableText,
  };
}
