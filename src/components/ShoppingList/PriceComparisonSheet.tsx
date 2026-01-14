import { memo, useState, useEffect } from 'react';
import { X, Check, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { ShoppingItem } from '@/types/ShoppingItem';

interface ChainTotal {
  chainName: string;
  total: number;
  itemsMatched: number;
}

interface ChainPriceData {
  [itemName: string]: {
    [chainName: string]: number;
  };
}

interface PriceComparisonSheetProps {
  items: ShoppingItem[];
  chainTotals: ChainTotal[];
  onClose: () => void;
}

export const PriceComparisonSheet = memo(function PriceComparisonSheet({
  items,
  chainTotals,
  onClose,
}: PriceComparisonSheetProps) {
  const [priceData, setPriceData] = useState<ChainPriceData>({});
  const [isLoading, setIsLoading] = useState(true);

  

  // Get all unique chain names from database to show all columns
  const [allChainNames, setAllChainNames] = useState<string[]>([]);

  useEffect(() => {
    const fetchAllPrices = async () => {
      try {
        const itemNames = items.map(item => item.name);
        
        const { data, error } = await supabase
          .from('chain_prices')
          .select('canonical_key, chain_name, price_ils')
          .in('canonical_key', itemNames);

        if (error) throw error;

        const priceMap: ChainPriceData = {};
        const chainSet = new Set<string>();
        
        if (data) {
          data.forEach(price => {
            if (!priceMap[price.canonical_key]) {
              priceMap[price.canonical_key] = {};
            }
            priceMap[price.canonical_key][price.chain_name] = price.price_ils;
            chainSet.add(price.chain_name);
          });
        }

        setPriceData(priceMap);
        // Use chains from actual data, sorted by total from chainTotals
        const sortedChains = chainTotals
          .map(c => c.chainName)
          .filter(name => chainSet.has(name));
        // Add any chains from data that aren't in chainTotals
        chainSet.forEach(chain => {
          if (!sortedChains.includes(chain)) {
            sortedChains.push(chain);
          }
        });
        setAllChainNames(sortedChains);
      } catch (error) {
        console.error('Error fetching prices:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllPrices();
  }, [items, chainTotals]);

  const getCheapestChainForItem = (itemName: string): string | null => {
    const prices = priceData[itemName];
    if (!prices) return null;
    
    let cheapest: string | null = null;
    let lowestPrice = Infinity;
    
    Object.entries(prices).forEach(([chain, price]) => {
      if (price < lowestPrice) {
        lowestPrice = price;
        cheapest = chain;
      }
    });
    
    return cheapest;
  };

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
        className="fixed inset-x-0 bottom-0 bg-card rounded-t-3xl shadow-2xl z-50 max-h-[85vh] flex flex-col"
        style={{ paddingBottom: 'calc(1.5rem + var(--safe-area-bottom))' }}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-lg font-bold">השוואת מחירים מלאה</h3>
          <button onClick={onClose} className="btn-icon text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-auto flex-1 p-4">
            {/* Chain totals summary */}
            <div className="mb-4 space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">סה״כ לפי רשת:</h4>
              {chainTotals.map((chain, index) => (
                <div
                  key={chain.chainName}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    index === 0 ? 'bg-success-light' : 'bg-secondary'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {index === 0 && <Check className="w-4 h-4 text-success" />}
                    <span className={index === 0 ? 'font-bold text-success' : ''}>
                      {chain.chainName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({chain.itemsMatched} פריטים)
                    </span>
                  </div>
                  <span className={`font-bold ${index === 0 ? 'text-success' : ''}`}>
                    ₪{chain.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Price table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-right py-2 px-2 font-semibold">מוצר</th>
                    {allChainNames.map(chain => (
                      <th key={chain} className="text-center py-2 px-2 font-semibold whitespace-nowrap">
                        {chain}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const cheapestChain = getCheapestChainForItem(item.name);
                    
                    return (
                      <tr key={item.id} className="border-b border-border/50">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1">
                            <span>{item.categoryEmoji}</span>
                            <span className="truncate max-w-[100px]">{item.name}</span>
                            {item.quantity > 1 && (
                              <span className="text-xs text-muted-foreground">×{item.quantity}</span>
                            )}
                          </div>
                        </td>
                        {allChainNames.map(chain => {
                          const price = priceData[item.name]?.[chain];
                          const isCheapest = chain === cheapestChain;
                          
                          return (
                            <td
                              key={chain}
                              className={`text-center py-2 px-2 ${
                                isCheapest ? 'text-success font-bold' : ''
                              }`}
                            >
                              {price ? (
                                `₪${(price * item.quantity).toFixed(2)}`
                              ) : (
                                <Minus className="w-4 h-4 mx-auto text-muted-foreground" />
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-border">
          <button onClick={onClose} className="btn-primary w-full">
            סגור
          </button>
        </div>
      </motion.div>
    </>
  );
});
