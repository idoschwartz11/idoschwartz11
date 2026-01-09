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
import { CleanListModeProvider, useCleanListMode } from '@/contexts/CleanListModeContext';

function ShoppingListContent() {
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
  const { isCleanMode } = useCleanListMode();

  const handleShare = useCallback(() => {
    setShowShareSheet(true);
  }, []);

  // Check if there are unbought items for clean mode display
  const hasUnboughtItems = groupedItems.some(g => g.unboughtItems.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <Header onShare={handleShare} />
      
      <main className="ios-content px-4">
        {/* Total Summary - hidden in clean mode */}
        {!isCleanMode && (
          <TotalSummary 
            total={estimatedTotal} 
            hasItemsWithPrices={hasItemsWithPrices} 
          />
        )}

        {/* Add Item Input - hidden in clean mode */}
        {!isCleanMode && (
          <AddItemInput 
            onAdd={addItem} 
            getSuggestions={getSuggestions}
          />
        )}

        {/* Empty State */}
        {!hasItems && !isCleanMode && (
          <div className="text-center py-16 mt-6">
            <div className="text-5xl mb-4">🛒</div>
            <p className="text-muted-foreground text-lg">הרשימה ריקה</p>
            <p className="text-muted-foreground/70 text-sm mt-1">
              הוסיפו פריטים להתחיל
            </p>
          </div>
        )}

        {/* Clean mode empty state */}
        {isCleanMode && !hasUnboughtItems && (
          <div className="text-center py-16 mt-6">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-muted-foreground text-lg">כל הפריטים נקנו!</p>
            <p className="text-muted-foreground/70 text-sm mt-1">
              סיימתם את הקניות
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

        {/* Clear Bought Items Button - hidden in clean mode */}
        {hasBoughtItems && !isCleanMode && (
          <button
            onClick={clearBoughtItems}
            className="btn-destructive w-full mt-4 mb-8"
          >
            <Trash2 className="w-4 h-4" />
            <span>נקה פריטים שנקנו</span>
          </button>
        )}
      </main>

      {/* Undo Toast - hidden in clean mode */}
      {deletedItem && !isCleanMode && (
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

export default function ShoppingList() {
  return (
    <CleanListModeProvider>
      <ShoppingListContent />
    </CleanListModeProvider>
  );
}
