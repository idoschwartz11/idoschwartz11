import { memo, useCallback, useState } from 'react';
import { X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSizesForCategory, SizeOption } from '@/constants/productSizes';

interface SizeSelectionSheetProps {
  isOpen: boolean;
  productName: string;
  categoryId: string;
  onSelect: (productWithSize: string) => void;
  onClose: () => void;
}

export const SizeSelectionSheet = memo(function SizeSelectionSheet({
  isOpen,
  productName,
  categoryId,
  onSelect,
  onClose,
}: SizeSelectionSheetProps) {
  const [customSize, setCustomSize] = useState('');
  const sizes = getSizesForCategory(categoryId);

  const handleSizeSelect = useCallback((size: SizeOption) => {
    const fullName = `${productName} ${size.value}`;
    onSelect(fullName);
  }, [productName, onSelect]);

  const handleCustomSize = useCallback(() => {
    if (customSize.trim()) {
      const fullName = `${productName} ${customSize.trim()}`;
      onSelect(fullName);
    }
  }, [productName, customSize, onSelect]);

  const handleSkip = useCallback(() => {
    onSelect(productName);
  }, [productName, onSelect]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />
          
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 inset-x-0 z-50 bg-background rounded-t-2xl shadow-lg max-h-[70vh] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <button
                onClick={onClose}
                className="p-2 -m-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-lg font-semibold text-foreground">
                בחר גודל/כמות
              </h3>
              <button
                onClick={handleSkip}
                className="text-sm text-primary font-medium"
              >
                דלג
              </button>
            </div>

            {/* Product Name Display */}
            <div className="px-4 py-3 bg-muted/50 border-b border-border">
              <p className="text-center text-foreground font-medium text-lg">
                {productName}
              </p>
            </div>

            {/* Size Options */}
            <div className="p-4 overflow-y-auto max-h-[40vh]">
              <div className="grid grid-cols-2 gap-3">
                {sizes.map((size) => (
                  <button
                    key={size.value}
                    onClick={() => handleSizeSelect(size)}
                    className="flex items-center justify-center gap-2 p-3 bg-card border border-border rounded-xl text-foreground font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
                  >
                    {size.label}
                  </button>
                ))}
              </div>

              {/* Custom Size Input */}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2 text-center">
                  או הכנס גודל אחר:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSize}
                    onChange={(e) => setCustomSize(e.target.value)}
                    placeholder="לדוגמה: 750 גרם"
                    className="flex-1 px-4 py-3 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    dir="rtl"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customSize.trim()) {
                        handleCustomSize();
                      }
                    }}
                  />
                  <button
                    onClick={handleCustomSize}
                    disabled={!customSize.trim()}
                    className="p-3 bg-primary text-primary-foreground rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Safe Area Padding */}
            <div className="h-6 bg-background" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});
