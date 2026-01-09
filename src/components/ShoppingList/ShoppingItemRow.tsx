import { memo, useState, useRef } from 'react';
import { Check, Minus, Plus, Trash2 } from 'lucide-react';
import { ShoppingItem } from '@/types/ShoppingItem';

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
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;
    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current;
    // Only allow left swipe (positive diff in RTL)
    if (diff > 0) {
      setSwipeX(Math.min(diff, 80));
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeX > 60) {
      onDelete(item.id);
    }
    setSwipeX(0);
  };

  const estimatedPrice = item.priceEstimateIls 
    ? (item.priceEstimateIls * item.quantity).toFixed(2)
    : null;

  return (
    <div 
      className={`relative overflow-hidden rounded-xl mb-2 ${item.isBought ? 'item-card-bought' : ''}`}
    >
      {/* Delete background */}
      {swipeX > 0 && (
        <div className="swipe-delete-bg" style={{ opacity: swipeX / 80 }}>
          <Trash2 className="w-5 h-5 text-destructive-foreground" />
        </div>
      )}
      
      <div 
        className="item-card p-3 relative bg-card"
        style={{ 
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex items-center gap-3">
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
              
              {item.quantity > 1 && (
                <span className="quantity-pill">
                  ×{item.quantity}
                </span>
              )}
            </div>
            
            {estimatedPrice && !item.isBought && (
              <p className="price-label mt-0.5">
                ממוצע משוער: ₪{estimatedPrice}
              </p>
            )}
          </div>
          
          {/* Quantity controls */}
          {!item.isBought && item.quantity >= 1 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => item.quantity === 1 ? onDelete(item.id) : onUpdateQuantity(item.id, -1)}
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
    </div>
  );
});
