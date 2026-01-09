import { useState, useCallback } from 'react';
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { useShoppingList } from '@/hooks/useShoppingList';
import { Header } from './Header';
import { TotalSummary } from './TotalSummary';
import { AddItemInput } from './AddItemInput';
import { ShoppingItemRow } from './ShoppingItemRow';
import { OnTheWayMode } from './OnTheWayMode';
import { UndoToast } from './UndoToast';
import { ShareSheet } from './ShareSheet';

export default function ShoppingList() {
  const {
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
    getSuggestions,
    getShareableText,
  } = useShoppingList();

  const [onTheWayMode, setOnTheWayMode] = useState(false);
  const [showBought, setShowBought] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const handleShare = useCallback(() => {
    setShowShareSheet(true);
  }, []);

  const isEditDisabled = onTheWayMode;

  return (
    <div className="min-h-screen bg-background">
      <Header onShare={handleShare} />
      
      <main className="ios-content px-4">
        {/* On The Way Mode Toggle */}
        <div className="flex justify-end mb-4">
          <OnTheWayMode 
            isActive={onTheWayMode} 
            onToggle={() => setOnTheWayMode(!onTheWayMode)} 
          />
        </div>

        {/* Total Summary */}
        {!onTheWayMode && (
          <TotalSummary 
            total={estimatedTotal} 
            hasItemsWithPrices={hasItemsWithPrices} 
          />
        )}

        {/* Add Item Input */}
        {!onTheWayMode && (
          <AddItemInput 
            onAdd={addItem} 
            getSuggestions={getSuggestions}
            disabled={isEditDisabled}
          />
        )}

        {/* Unbought Items Section */}
        <section className="mb-6">
          {!onTheWayMode && unboughtItems.length > 0 && (
            <div className="section-header">
              <span>לקנות</span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {unboughtItems.length}
              </span>
            </div>
          )}
          
          {unboughtItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground text-lg">
                {onTheWayMode ? 'הכל נקנה! 🎉' : 'הרשימה ריקה'}
              </p>
              {!onTheWayMode && (
                <p className="text-muted-foreground/70 text-sm mt-1">
                  הוסיפו פריטים להתחיל
                </p>
              )}
            </div>
          ) : (
            <div>
              {unboughtItems.map(item => (
                <ShoppingItemRow
                  key={item.id}
                  item={item}
                  onToggle={toggleBought}
                  onUpdateQuantity={updateQuantity}
                  onDelete={deleteItem}
                  disabled={isEditDisabled}
                  largeText={onTheWayMode}
                />
              ))}
            </div>
          )}
        </section>

        {/* Bought Items Section */}
        {!onTheWayMode && hasBoughtItems && (
          <section>
            <button
              onClick={() => setShowBought(!showBought)}
              className="section-header w-full hover:bg-muted/50 rounded-lg transition-colors"
            >
              <span>נקנה</span>
              <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">
                {boughtItems.length}
              </span>
              <span className="flex-1" />
              {showBought ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            
            {showBought && (
              <div className="animate-fade-in">
                {boughtItems.map(item => (
                  <ShoppingItemRow
                    key={item.id}
                    item={item}
                    onToggle={toggleBought}
                    onUpdateQuantity={updateQuantity}
                    onDelete={deleteItem}
                  />
                ))}
                
                <button
                  onClick={clearBoughtItems}
                  className="btn-destructive w-full mt-3"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>נקה פריטים שנקנו</span>
                </button>
              </div>
            )}
          </section>
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
