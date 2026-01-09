import { memo, useState, useEffect } from 'react';
import { X, TrendingDown, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface ChainPrice {
  chain_name: string;
  price_ils: number;
}

interface ChainPricePopupProps {
  itemName: string;
  onClose: () => void;
}

export const ChainPricePopup = memo(function ChainPricePopup({
  itemName,
  onClose,
}: ChainPricePopupProps) {
  const [prices, setPrices] = useState<ChainPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchChainPrices = async () => {
      try {
        const { data, error } = await supabase
          .from('chain_prices')
          .select('chain_name, price_ils')
          .eq('canonical_key', itemName)
          .order('price_ils', { ascending: true });

        if (error) throw error;
        setPrices(data || []);
      } catch (error) {
        console.error('Error fetching chain prices:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChainPrices();
  }, [itemName]);

  const minPrice = prices.length > 0 ? Math.min(...prices.map(p => p.price_ils)) : 0;
  const maxPrice = prices.length > 0 ? Math.max(...prices.map(p => p.price_ils)) : 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="info-sheet-backdrop"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="info-sheet"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">השוואת מחירים: {itemName}</h3>
          <button onClick={onClose} className="btn-icon text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : prices.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            אין מידע על מחירים ברשתות שונות עבור מוצר זה
          </p>
        ) : (
          <div className="space-y-2">
            {prices.map((price, index) => {
              const isLowest = price.price_ils === minPrice;
              const isHighest = price.price_ils === maxPrice;
              const savings = maxPrice - price.price_ils;

              return (
                <div
                  key={price.chain_name}
                  className={`flex items-center justify-between p-3 rounded-xl ${
                    isLowest
                      ? 'bg-success-light border border-success/30'
                      : 'bg-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isLowest && <TrendingDown className="w-4 h-4 text-success" />}
                    {isHighest && prices.length > 1 && (
                      <TrendingUp className="w-4 h-4 text-destructive" />
                    )}
                    <span className={`font-medium ${isLowest ? 'text-success' : ''}`}>
                      {price.chain_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${isLowest ? 'text-success' : ''}`}>
                      ₪{price.price_ils.toFixed(2)}
                    </span>
                    {isLowest && savings > 0 && (
                      <span className="text-xs text-success bg-success/10 px-2 py-0.5 rounded-full">
                        חיסכון ₪{savings.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={onClose} className="btn-primary w-full mt-5">
          סגור
        </button>
      </motion.div>
    </>
  );
});
