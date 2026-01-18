import { useCallback, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useShoppingList } from '@/hooks/useShoppingList';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { Header } from './Header';
import { TotalSummary } from './TotalSummary';
import { AddItemInput } from './AddItemInput';
import { CategoryGroup } from './CategoryGroup';
import { UndoToast } from './UndoToast';
import { ShareSheet } from './ShareSheet';
import { AISuggestions } from './AISuggestions';
import { ImageScanner } from './ImageScanner';
import { SizeSelectionSheet } from './SizeSelectionSheet';
import { CleanListModeProvider, useCleanListMode } from '@/contexts/CleanListModeContext';
import { getItemCategory } from '@/constants/priceTable';

function ShoppingListContent() {
  const {
    items,
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
  } = useShoppingList();

  const { isOnline, isSyncing, pendingCount } = useOfflineSync();
  const [showShareSheet, setShowShareSheet] = useState(false);
  const { isCleanMode } = useCleanListMode();

  // Size selection state
  const [sizeSelectionOpen, setSizeSelectionOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<string>('');
  const [pendingCategoryId, setPendingCategoryId] = useState<string>('other');

  const handleShare = useCallback(() => {
    setShowShareSheet(true);
  }, []);

  // Handler when user types a product and clicks "Add"
  const handleRequestSizeSelection = useCallback((productName: string) => {
    const category = getItemCategory(productName);
    setPendingProduct(productName);
    setPendingCategoryId(category.id);
    setSizeSelectionOpen(true);
  }, []);

  // Handler when user selects a size (or skips)
  const handleSizeSelected = useCallback((productWithSize: string) => {
    addItem(productWithSize);
    setSizeSelectionOpen(false);
    setPendingProduct('');
    setPendingCategoryId('other');
  }, [addItem]);

  // Handler to close size selection without adding
  const handleSizeSelectionClose = useCallback(() => {
    setSizeSelectionOpen(false);
    setPendingProduct('');
    setPendingCategoryId('other');
  }, []);

  // Memoize current item names for AI suggestions
  const currentItemNames = useMemo(() => 
    items.filter(i => !i.isBought).map(i => i.name),
    [items]
  );

  // Check if there are unbought items for clean mode display
  const hasUnboughtItems = groupedItems.some(g => g.unboughtItems.length > 0);

  return (
    <div className="min-h-screen bg-background">
      <Header 
        onShare={handleShare}
        isOnline={isOnline}
        isSyncing={isSyncing}
        pendingCount={pendingCount}
      />
      
      <main className="ios-content px-4">
        {/* Total Summary - hidden in clean mode */}
        {!isCleanMode && (
          <TotalSummary 
            total={estimatedTotal} 
            hasItemsWithPrices={hasItemsWithPrices}
            items={items}
          />
        )}

        {/* Image Scanner - hidden in clean mode */}
        {!isCleanMode && (
          <ImageScanner 
            currentItems={currentItemNames} 
            onAddItems={(names) => names.forEach(name => addItem(name))} 
          />
        )}

        {/* AI Suggestions - hidden in clean mode */}
        {!isCleanMode && (
          <AISuggestions 
            currentItems={currentItemNames} 
            onAddItem={addItem} 
          />
        )}

        {/* Add Item Input - hidden in clean mode */}
        {!isCleanMode && (
          <AddItemInput 
            onAdd={addItem}
            onRequestSizeSelection={handleRequestSizeSelection}
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

      {/* Size Selection Sheet */}
      <SizeSelectionSheet
        isOpen={sizeSelectionOpen}
        productName={pendingProduct}
        categoryId={pendingCategoryId}
        onSelect={handleSizeSelected}
        onClose={handleSizeSelectionClose}
      />
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
