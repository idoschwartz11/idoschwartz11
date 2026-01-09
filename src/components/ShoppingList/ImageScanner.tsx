import { memo, useState, useCallback, useRef } from "react";
import { Camera, X, Check, Loader2, ImageIcon, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface DetectedItem {
  name: string;
  confidence: "high" | "medium";
}

interface ImageScannerProps {
  currentItems: string[];
  onAddItems: (items: string[]) => void;
}

export const ImageScanner = memo(function ImageScanner({ 
  currentItems, 
  onAddItems 
}: ImageScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedItems, setDetectedItems] = useState<DetectedItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setDetectedItems([]);
    setSummary("");

    // Create preview
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setPreviewUrl(base64);

      try {
        const { data, error: funcError } = await supabase.functions.invoke('scan-image', {
          body: { imageBase64: base64 }
        });

        if (funcError) throw funcError;
        
        if (data?.error) {
          setError(data.error);
          return;
        }

        const items = data?.items || [];
        // Filter out items that are already in the list
        const newItems = items.filter((item: DetectedItem) => 
          !currentItems.some(ci => ci.toLowerCase() === item.name.toLowerCase())
        );
        
        setDetectedItems(newItems);
        setSummary(data?.summary || "");
        // Pre-select high confidence items
        setSelectedItems(new Set(newItems.filter((i: DetectedItem) => i.confidence === "high").map((i: DetectedItem) => i.name)));
        setIsOpen(true);
      } catch (err) {
        console.error('Error scanning image:', err);
        setError('לא הצלחנו לסרוק את התמונה');
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  }, [currentItems]);

  const toggleItem = useCallback((name: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const handleAddSelected = useCallback(() => {
    const itemsToAdd = Array.from(selectedItems);
    if (itemsToAdd.length > 0) {
      onAddItems(itemsToAdd);
    }
    handleClose();
  }, [selectedItems, onAddItems]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setDetectedItems([]);
    setSelectedItems(new Set());
    setPreviewUrl(null);
    setSummary("");
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Trigger Button */}
      <button
        onClick={openFilePicker}
        disabled={isProcessing}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 text-emerald-600 hover:from-emerald-500/20 hover:to-teal-500/20 transition-all mb-4"
      >
        {isProcessing ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Camera className="w-4 h-4" />
        )}
        <span className="font-medium">
          {isProcessing ? "מזהה מוצרים..." : "סרוק מקרר או מזווה"}
        </span>
      </button>

      {/* Error State */}
      {error && !isOpen && (
        <div className="flex items-center gap-2 text-destructive text-sm mb-4 justify-center">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="info-sheet-backdrop"
              onClick={handleClose}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="info-sheet max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-emerald-600" />
                  <h3 className="font-bold text-lg">מוצרים שזוהו</h3>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Preview thumbnail */}
              {previewUrl && (
                <div className="w-full h-24 rounded-xl overflow-hidden mb-4 bg-muted">
                  <img 
                    src={previewUrl} 
                    alt="סריקה" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Summary */}
              {summary && (
                <p className="text-sm text-muted-foreground mb-4">{summary}</p>
              )}

              {/* Items list */}
              <div className="flex-1 overflow-y-auto -mx-2 px-2">
                {detectedItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>כל המוצרים שזוהו כבר ברשימה שלך</p>
                    <p className="text-sm mt-1">או שלא זוהו מוצרים בתמונה</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detectedItems.map((item, index) => (
                      <motion.button
                        key={item.name}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => toggleItem(item.name)}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                          selectedItems.has(item.name)
                            ? "bg-emerald-500/10 border border-emerald-500/30"
                            : "bg-muted/50 border border-transparent"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                          selectedItems.has(item.name)
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-muted-foreground/30"
                        }`}>
                          {selectedItems.has(item.name) && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <span className="font-medium flex-1 text-right">{item.name}</span>
                        {item.confidence === "medium" && (
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            לא בטוח
                          </span>
                        )}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {detectedItems.length > 0 && (
                <div className="flex gap-3 mt-4 pt-4 border-t border-border">
                  <button
                    onClick={handleClose}
                    className="flex-1 btn-secondary"
                  >
                    ביטול
                  </button>
                  <button
                    onClick={handleAddSelected}
                    disabled={selectedItems.size === 0}
                    className="flex-1 btn-primary disabled:opacity-50"
                  >
                    הוסף {selectedItems.size > 0 ? `(${selectedItems.size})` : ""}
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
});
