import { memo, useState, useMemo } from 'react';
import { Check, Minus, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingItem } from '@/types/ShoppingItem';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { ChainPricePopup } from './ChainPricePopup';
import { getCategoryColor, EXPENSIVE_THRESHOLD } from '@/constants/categoryColors';

interface ShoppingItemRowProps {
  item: ShoppingItem;
  onToggle: (id: string) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
}

export const ShoppingItemRow = memo(function ShoppingItemRow({
  item,
  onToggle,
  onUpdateQuantity,
  onDelete,
}: ShoppingItemRowProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPricePopup, setShowPricePopup] = useState(false);

  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    onDelete(item.id);
    setShowDeleteDialog(false);
  };

  // Memoize computed cost and expensive flag
  const { estimatedPrice, isExpensive } = useMemo(() => {
    const cost = item.priceEstimateIls ? item.priceEstimateIls * item.quantity : null;
    return {
      estimatedPrice: cost ? cost.toFixed(2) : null,
      isExpensive: cost !== null && cost >= EXPENSIVE_THRESHOLD,
    };
  }, [item.priceEstimateIls, item.quantity]);

  const categoryColor = getCategoryColor(item.categoryId);

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, x: 30, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: -30, scale: 0.95 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={`relative overflow-hidden rounded-xl mb-2 ${item.isBought ? 'item-card-bought' : ''}`}
      >
        <div className="item-card p-3 relative bg-card flex">
          {/* Category color indicator */}
          <div className={`w-1 self-stretch rounded-full ml-3 ${categoryColor.indicator}`} />
          
          <div className="flex items-center gap-3 flex-1">
            {/* Checkbox */}
            <button
              onClick={() => onToggle(item.id)}
              className={`checkbox-ios flex-shrink-0 ${item.isBought ? 'checkbox-ios-checked' : ''}`}
              aria-label={item.isBought ? 'סמן כלא נקנה' : 'סמן כנקנה'}
            >
              {item.isBought && <Check className="w-4 h-4 text-success-foreground" />}
            </button>
            
            {/* Item content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg">{item.categoryEmoji}</span>
                <span 
                  className={`font-medium text-base ${item.isBought ? 'text-success line-through' : ''}`}
                >
                  {item.name}
                </span>
                
                {/* Expensive indicator */}
                {isExpensive && !item.isBought && (
                  <span className="text-orange-500 dark:text-orange-400" title="פריט יקר">
                    <AlertTriangle className="w-4 h-4" />
                  </span>
                )}
                
                {item.quantity > 1 && (
                  <span className="quantity-pill">
                    ×{item.quantity}
                  </span>
                )}
              </div>
              
              {estimatedPrice && !item.isBought && (
                <button
                  onClick={() => setShowPricePopup(true)}
                  className="price-label mt-0.5 hover:text-primary cursor-pointer transition-colors"
                >
                  ממוצע ארצי משוער: ₪{estimatedPrice} • לחץ להשוואה
                </button>
              )}
            </div>
            
            {/* Quantity controls */}
            {!item.isBought && item.quantity >= 1 && (
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => item.quantity === 1 ? handleDeleteClick() : onUpdateQuantity(item.id, -1)}
                  className={`btn-quantity ${item.quantity === 1 ? 'bg-destructive-light text-destructive' : ''}`}
                  aria-label={item.quantity === 1 ? 'מחק פריט' : 'הפחת כמות'}
                >
                  {item.quantity === 1 ? <Trash2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                </button>
                <span className="w-6 text-center text-sm font-medium">
                  {item.quantity}
                </span>
                <button
                  onClick={() => onUpdateQuantity(item.id, 1)}
                  className="btn-quantity"
                  aria-label="הוסף כמות"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <DeleteConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleConfirmDelete}
        itemName={item.name}
      />

      <AnimatePresence>
        {showPricePopup && (
          <ChainPricePopup
            itemName={item.name}
            onClose={() => setShowPricePopup(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
});
