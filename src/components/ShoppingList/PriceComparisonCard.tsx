import { memo, useState, useEffect, useMemo } from 'react';
import { Store, ChevronDown, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingItem } from '@/types/ShoppingItem';
import { PriceComparisonSheet } from './PriceComparisonSheet';
import { calculateChainTotals, ChainTotal } from '@/lib/priceUtils';

interface PriceComparisonCardProps {
  items: ShoppingItem[];
}

export const PriceComparisonCard = memo(function PriceComparisonCard({
  items,
}: PriceComparisonCardProps) {
  const [chainTotals, setChainTotals] = useState<ChainTotal[]>([]);
  const [showSheet, setShowSheet] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const unboughtItems = useMemo(
    () => items.filter(i => !i.isBought),
    [items]
  );

  useEffect(() => {
    const fetchChainPrices = async () => {
      if (unboughtItems.length === 0) {
        setChainTotals([]);
        setIsLoading(false);
        return;
      }

      try {
        // Use the unified price utility with canonical_key
        const totals = await calculateChainTotals(unboughtItems);
        setChainTotals(totals);
      } catch (error) {
        console.error('Error fetching chain prices:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChainPrices();
  }, [unboughtItems]);

  // Don't render if no items or still loading
  if (unboughtItems.length === 0 || isLoading || chainTotals.length === 0) {
    return null;
  }

  const cheapestChain = chainTotals[0];
  const mostExpensiveChain = chainTotals[chainTotals.length - 1];
  const potentialSavings = mostExpensiveChain.total - cheapestChain.total;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-l from-success/10 to-primary/10 rounded-xl p-3 border border-success/20 mb-4 cursor-pointer"
        onClick={() => setShowSheet(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center">
              <Store className="w-5 h-5 text-success" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-success">{cheapestChain.chainName}</span>
                <TrendingDown className="w-4 h-4 text-success" />
              </div>
              <p className="text-xs text-muted-foreground">
                הסופר הזול ביותר לרשימה שלך
              </p>
            </div>
          </div>
          <div className="text-left">
            <p className="font-bold text-lg text-success">
              ₪{cheapestChain.total.toFixed(2)}
            </p>
            {potentialSavings > 0 && (
              <p className="text-xs text-success">
                חיסכון: ₪{potentialSavings.toFixed(2)}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-center mt-2 text-xs text-muted-foreground">
          <span>לחץ להשוואה מלאה</span>
          <ChevronDown className="w-4 h-4 mr-1" />
        </div>
      </motion.div>

      <AnimatePresence>
        {showSheet && (
          <PriceComparisonSheet
            items={unboughtItems}
            chainTotals={chainTotals}
            onClose={() => setShowSheet(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
});
