import { memo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { GroupedItems } from '@/types/ShoppingItem';
import { ShoppingItemRow } from './ShoppingItemRow';
import { CleanModeItemRow } from './CleanModeItemRow';
import { useCleanListMode } from '@/contexts/CleanListModeContext';
import { getCategoryColor } from '@/constants/categoryColors';

interface CategoryGroupProps {
  group: GroupedItems;
  onToggle: (id: string) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onDelete: (id: string) => void;
}

export const CategoryGroup = memo(function CategoryGroup({
  group,
  onToggle,
  onUpdateQuantity,
  onDelete,
}: CategoryGroupProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showBought, setShowBought] = useState(false);
  const { isCleanMode } = useCleanListMode();
  
  const hasUnbought = group.unboughtItems.length > 0;
  const hasBought = group.boughtItems.length > 0;
  
  const categoryColor = getCategoryColor(group.categoryId);

  // In clean mode, only show if there are unbought items
  if (isCleanMode && !hasUnbought) {
    return null;
  }

  return (
    <section className="mb-4">
      {/* Category Header - Clickable */}
      <button
        onClick={() => !isCleanMode && setIsExpanded(!isExpanded)}
        className={`category-header w-full flex items-center gap-2 mb-2 px-3 py-2 rounded-xl transition-colors ${categoryColor.bg} ${!isCleanMode ? 'hover:opacity-80' : ''}`}
        disabled={isCleanMode}
      >
        <span className="text-xl">{group.categoryEmoji}</span>
        <span className="font-semibold text-foreground">{group.categoryTitle}</span>
        {hasUnbought && !isCleanMode && (
          <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
            {group.unboughtItems.length}
          </span>
        )}
        {!isCleanMode && (
          <motion.span 
            className="mr-auto text-muted-foreground"
            animate={{ rotate: isExpanded ? 0 : -90 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.span>
        )}
      </button>

      {/* Collapsible Content */}
      <AnimatePresence initial={false}>
        {(isExpanded || isCleanMode) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            {/* Unbought items */}
            <AnimatePresence mode="popLayout">
              {group.unboughtItems.map(item => (
                isCleanMode ? (
                  <CleanModeItemRow
                    key={item.id}
                    item={item}
                    onToggle={onToggle}
                  />
                ) : (
                  <ShoppingItemRow
                    key={item.id}
                    item={item}
                    onToggle={onToggle}
                    onUpdateQuantity={onUpdateQuantity}
                    onDelete={onDelete}
                  />
                )
              ))}
            </AnimatePresence>

            {/* Bought items in this category - hidden in clean mode */}
            {hasBought && !isCleanMode && (
              <div className="mt-2">
                <button
                  onClick={() => setShowBought(!showBought)}
                  className="flex items-center gap-2 text-xs text-muted-foreground py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span>נקנה ({group.boughtItems.length})</span>
                  <motion.span
                    animate={{ rotate: showBought ? 0 : -90 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </motion.span>
                </button>
                
                <AnimatePresence initial={false}>
                  {showBought && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: "hidden" }}
                      className="mt-1"
                    >
                      <AnimatePresence mode="popLayout">
                        {group.boughtItems.map(item => (
                          <ShoppingItemRow
                            key={item.id}
                            item={item}
                            onToggle={onToggle}
                            onUpdateQuantity={onUpdateQuantity}
                            onDelete={onDelete}
                          />
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
});