import { memo } from 'react';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { ShoppingItem } from '@/types/ShoppingItem';
import { getCategoryColor } from '@/constants/categoryColors';

interface CleanModeItemRowProps {
  item: ShoppingItem;
  onToggle: (id: string) => void;
}

export const CleanModeItemRow = memo(function CleanModeItemRow({
  item,
  onToggle,
}: CleanModeItemRowProps) {
  const categoryColor = getCategoryColor(item.categoryId);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="relative mb-2"
    >
      <div 
        className="flex items-center gap-4 py-4 px-3 bg-card rounded-xl border border-border/30"
        onClick={() => onToggle(item.id)}
      >
        {/* Category color indicator */}
        <div className={`w-1 h-10 rounded-full ${categoryColor.indicator}`} />
        
        {/* Checkbox */}
        <button
          className="checkbox-ios flex-shrink-0"
          aria-label="סמן כנקנה"
        >
          {/* Empty checkbox for unbought items */}
        </button>
        
        {/* Item name - larger font for easy scanning */}
        <span className="font-semibold text-xl flex-1">
          {item.name}
        </span>
        
        {/* Quantity if more than 1 */}
        {item.quantity > 1 && (
          <span className="text-lg text-muted-foreground font-medium">
            ×{item.quantity}
          </span>
        )}
      </div>
    </motion.div>
  );
});
