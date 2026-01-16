import { memo, useState, useEffect } from 'react';
import { X, TrendingDown, TrendingUp, RefreshCw, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';

interface ChainPrice {
  chain_name: string;
  price_ils: number;
}

interface ChainPricePopupProps {
  itemName: string;
  canonicalKey: string;
  onClose: () => void;
}

export const ChainPricePopup = memo(function ChainPricePopup({
  itemName,
  canonicalKey,
  onClose,
}: ChainPricePopupProps) {
  const [prices, setPrices] = useState<ChainPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingFromWeb, setIsFetchingFromWeb] = useState(false);
  const [matchedName, setMatchedName] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchChainPrices = async (triggerWebScrape = false) => {
    try {
      setFetchError(null);
      
      // IMPORTANT: Use canonical_key directly for price lookup
      // This ensures consistency with the shopping list and comparison views
      const lookupKey = canonicalKey.trim();
      
      console.log('[ChainPricePopup] Fetching prices for canonical_key:', lookupKey);
      
      // Show matched name if it differs from user input
      if (lookupKey !== itemName) {
        setMatchedName(lookupKey);
      }
      
      // Fetch chain prices using the canonical_key
      const { data, error } = await supabase
        .from('chain_prices')
        .select('chain_name, price_ils')
        .eq('canonical_key', lookupKey)
        .order('price_ils', { ascending: true });

      if (error) throw error;
      
      console.log('[ChainPricePopup] Found prices:', data?.length || 0);
      
      // If no prices found and we should trigger web scrape
      if ((!data || data.length === 0) && triggerWebScrape) {
        setIsFetchingFromWeb(true);
        
        // Call smart-price-lookup to fetch and populate prices
        const { data: lookupResult, error: lookupError } = await supabase.functions.invoke('smart-price-lookup', {
          body: { productName: lookupKey }
        });
        
        if (lookupError) {
          console.error('Error fetching from web:', lookupError);
          setFetchError('לא הצלחנו למצוא מחירים ברשת');
          setIsFetchingFromWeb(false);
          return;
        }
        
        // If prices were found and saved, refetch from chain_prices
        if (lookupResult?.found && lookupResult?.chainPrices?.length > 0) {
          const newCanonicalKey = lookupResult.canonicalName || lookupKey;
          if (newCanonicalKey !== itemName) {
            setMatchedName(newCanonicalKey);
          }
          
          const { data: newPrices } = await supabase
            .from('chain_prices')
            .select('chain_name, price_ils')
            .eq('canonical_key', newCanonicalKey)
            .order('price_ils', { ascending: true });
          
          setPrices(newPrices || []);
        } else {
          setFetchError('לא נמצאו מחירים עבור מוצר זה');
        }
        
        setIsFetchingFromWeb(false);
      } else {
        setPrices(data || []);
        
        // Auto-trigger web scrape if no prices on first load
        if ((!data || data.length === 0) && !triggerWebScrape) {
          // Automatically try to fetch from web
          fetchChainPrices(true);
          return;
        }
      }
    } catch (error) {
      console.error('Error fetching chain prices:', error);
      setFetchError('שגיאה בטעינת המחירים');
    } finally {
      if (!isFetchingFromWeb) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchChainPrices(false);
  }, [canonicalKey]);

  const handleRetry = () => {
    setIsLoading(true);
    setFetchError(null);
    fetchChainPrices(true);
  };

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
          <div>
            <h3 className="text-lg font-bold">השוואת מחירים: {itemName}</h3>
            {matchedName && (
              <p className="text-sm text-muted-foreground">מציג מחירים עבור: {matchedName}</p>
            )}
          </div>
          <button onClick={onClose} className="btn-icon text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading || isFetchingFromWeb ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="relative">
              {isFetchingFromWeb ? (
                <Search className="w-8 h-8 text-primary animate-pulse" />
              ) : (
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <p className="text-muted-foreground text-sm">
              {isFetchingFromWeb ? 'מחפש מחירים ברשתות...' : 'טוען מחירים...'}
            </p>
          </div>
        ) : prices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <p className="text-muted-foreground text-center">
              {fetchError || 'אין מידע על מחירים ברשתות שונות עבור מוצר זה'}
            </p>
            <button 
              onClick={handleRetry}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              נסה לחפש שוב
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {prices.map((price) => {
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
