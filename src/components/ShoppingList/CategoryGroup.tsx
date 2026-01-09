import { memo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { GroupedItems } from '@/types/ShoppingItem';
import { ShoppingItemRow } from './ShoppingItemRow';

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
  const hasUnbought = group.unboughtItems.length > 0;
  const hasBought = group.boughtItems.length > 0;
  const totalItems = group.unboughtItems.length + group.boughtItems.length;

  return (
    <section className="mb-4">
      {/* Category Header - Clickable */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="category-header w-full flex items-center gap-2 mb-2 px-2 py-2 rounded-xl hover:bg-accent/50 transition-colors"
      >
        <span className="text-xl">{group.categoryEmoji}</span>
        <span className="font-semibold text-foreground">{group.categoryTitle}</span>
        {hasUnbought && (
          <span className="text-xs bg-primary/15 text-primary px-2 py-0.5 rounded-full font-medium">
            {group.unboughtItems.length}
          </span>
        )}
        <span className="mr-auto text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </span>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="animate-fade-in">
          {/* Unbought items */}
          {group.unboughtItems.map(item => (
            <ShoppingItemRow
              key={item.id}
              item={item}
              onToggle={onToggle}
              onUpdateQuantity={onUpdateQuantity}
              onDelete={onDelete}
            />
          ))}

          {/* Bought items in this category */}
          {hasBought && (
            <div className="mt-2">
              <button
                onClick={() => setShowBought(!showBought)}
                className="flex items-center gap-2 text-xs text-muted-foreground py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <span>נקנה ({group.boughtItems.length})</span>
                {showBought ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
              </button>
              
              {showBought && (
                <div className="animate-fade-in mt-1">
                  {group.boughtItems.map(item => (
                    <ShoppingItemRow
                      key={item.id}
                      item={item}
                      onToggle={onToggle}
                      onUpdateQuantity={onUpdateQuantity}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
});
