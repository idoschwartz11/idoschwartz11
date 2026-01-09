import { useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { useShoppingList } from '@/hooks/useShoppingList';
import { Header } from './Header';
import { TotalSummary } from './TotalSummary';
import { AddItemInput } from './AddItemInput';
import { CategoryGroup } from './CategoryGroup';
import { UndoToast } from './UndoToast';
import { ShareSheet } from './ShareSheet';
import { useState } from 'react';

export default function ShoppingList() {
  const {
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
  } = useShoppingList();

  const [showShareSheet, setShowShareSheet] = useState(false);

  const handleShare = useCallback(() => {
    setShowShareSheet(true);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header onShare={handleShare} />
      
      <main className="ios-content px-4">
        {/* Total Summary */}
        <TotalSummary 
          total={estimatedTotal} 
          hasItemsWithPrices={hasItemsWithPrices} 
        />

        {/* Add Item Input */}
        <AddItemInput 
          onAdd={addItem} 
          getSuggestions={getSuggestions}
        />

        {/* Empty State */}
        {!hasItems && (
          <div className="text-center py-16 mt-6">
            <div className="text-5xl mb-4">🛒</div>
            <p className="text-muted-foreground text-lg">הרשימה ריקה</p>
            <p className="text-muted-foreground/70 text-sm mt-1">
              הוסיפו פריטים להתחיל
            </p>
          </div>
        )}

        {/* Grouped Items by Category */}
        {groupedItems.map(group => (
          <CategoryGroup
            key={group.categoryId}
            group={group}
            onToggle={toggleBought}
            onUpdateQuantity={updateQuantity}
            onDelete={deleteItem}
          />
        ))}

        {/* Clear Bought Items Button */}
        {hasBoughtItems && (
          <button
            onClick={clearBoughtItems}
            className="btn-destructive w-full mt-4 mb-8"
          >
            <Trash2 className="w-4 h-4" />
            <span>נקה פריטים שנקנו</span>
          </button>
        )}
      </main>

      {/* Undo Toast */}
      {deletedItem && (
        <UndoToast onUndo={undoDelete} onDismiss={dismissUndo} />
      )}

      {/* Share Sheet */}
      {showShareSheet && (
        <ShareSheet 
          text={getShareableText()} 
          onClose={() => setShowShareSheet(false)} 
        />
      )}
    </div>
  );
}
