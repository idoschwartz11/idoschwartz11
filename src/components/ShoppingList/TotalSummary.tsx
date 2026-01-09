import { memo, useState, useEffect, useRef } from 'react';
import { Info } from 'lucide-react';
import { ShoppingItem } from '@/types/ShoppingItem';
import { PriceComparisonCard } from './PriceComparisonCard';

interface TotalSummaryProps {
  total: number;
  hasItemsWithPrices: boolean;
  items: ShoppingItem[];
}

export const TotalSummary = memo(function TotalSummary({ 
  total, 
  hasItemsWithPrices,
  items,
}: TotalSummaryProps) {
  const [showInfo, setShowInfo] = useState(false);
  const [animateTotal, setAnimateTotal] = useState(false);
  const prevTotal = useRef(total);

  useEffect(() => {
    if (prevTotal.current !== total) {
      setAnimateTotal(true);
      const timer = setTimeout(() => setAnimateTotal(false), 250);
      prevTotal.current = total;
      return () => clearTimeout(timer);
    }
  }, [total]);

  if (!hasItemsWithPrices) return null;

  return (
    <>
      <div className="total-card mb-4 mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">סה״כ משוער:</span>
            <span 
              className={`text-lg font-bold text-primary ${animateTotal ? 'animate-total-change' : ''}`}
            >
              ₪{total.toFixed(2)}
            </span>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="btn-icon text-muted-foreground hover:text-foreground"
            aria-label="מידע"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      <PriceComparisonCard items={items} />

      {showInfo && (
        <>
          <div 
            className="info-sheet-backdrop" 
            onClick={() => setShowInfo(false)}
          />
          <div className="info-sheet">
            <h3 className="text-lg font-bold mb-3">מידע על המחירים</h3>
            <p className="text-muted-foreground leading-relaxed">
              הסכום מחושב לפי מחירים ממוצעים ארציים ממאגר נתוני הסופרמרקטים הישראליים.
              המחירים מתעדכנים מעת לעת ומבוססים על דגימות מרשתות שונות.
              ייתכנו הבדלים בין המחיר המוצג למחיר בפועל בסניף הספציפי.
            </p>
            <button
              onClick={() => setShowInfo(false)}
              className="btn-primary w-full mt-5"
            >
              הבנתי
            </button>
          </div>
        </>
      )}
    </>
  );
});
