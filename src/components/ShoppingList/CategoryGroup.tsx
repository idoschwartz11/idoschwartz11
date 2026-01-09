import { memo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
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
  const [showBought, setShowBought] = useState(false);
  const hasUnbought = group.unboughtItems.length > 0;
  const hasBought = group.boughtItems.length > 0;

  return (
    <section className="mb-5">
      {/* Category Header */}
      <div className="category-header flex items-center gap-2 mb-2 px-1">
        <span className="text-xl">{group.categoryEmoji}</span>
        <span className="font-semibold text-foreground">{group.categoryTitle}</span>
        {hasUnbought && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
            {group.unboughtItems.length}
          </span>
        )}
      </div>

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
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
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
    </section>
  );
});
