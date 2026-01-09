import { memo, useState, useCallback } from "react";
import { Sparkles, Plus, Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface Suggestion {
  name: string;
  reason: string;
}

interface AISuggestionsProps {
  currentItems: string[];
  onAddItem: (name: string) => void;
}

export const AISuggestions = memo(function AISuggestions({ 
  currentItems, 
  onAddItem 
}: AISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Get history from localStorage
      const historyRaw = localStorage.getItem('shopping-list-history');
      const history = historyRaw ? JSON.parse(historyRaw) : [];

      const { data, error: funcError } = await supabase.functions.invoke('suggest-items', {
        body: { 
          currentItems,
          history
        }
      });

      if (funcError) throw funcError;
      
      if (data?.error) {
        setError(data.error);
        return;
      }

      setSuggestions(data?.suggestions || []);
      setIsOpen(true);
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setError('לא הצלחנו להביא הצעות');
    } finally {
      setIsLoading(false);
    }
  }, [currentItems]);

  const handleAddSuggestion = useCallback((name: string) => {
    onAddItem(name);
    setSuggestions(prev => prev.filter(s => s.name !== name));
  }, [onAddItem]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSuggestions([]);
  }, []);

  return (
    <div className="mb-4">
      {/* Trigger Button */}
      {!isOpen && (
        <button
          onClick={fetchSuggestions}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 text-primary hover:from-primary/20 hover:to-accent/20 transition-all"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          <span className="font-medium">
            {isLoading ? "מחפש הצעות..." : "הצע פריטים עם AI"}
          </span>
        </button>
      )}

      {/* Error State */}
      {error && !isOpen && (
        <p className="text-destructive text-sm text-center mt-2">{error}</p>
      )}

      {/* Suggestions Panel */}
      <AnimatePresence>
        {isOpen && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-gradient-to-br from-primary/5 to-accent/5 border border-primary/20 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-semibold text-sm">הצעות AI</span>
                </div>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-full hover:bg-primary/10 transition-colors"
                  aria-label="סגור"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <motion.div
                    key={suggestion.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-center justify-between gap-3 bg-background/80 rounded-lg p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {suggestion.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {suggestion.reason}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAddSuggestion(suggestion.name)}
                      className="flex-shrink-0 p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                      aria-label={`הוסף ${suggestion.name}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>

              <button
                onClick={fetchSuggestions}
                disabled={isLoading}
                className="w-full mt-3 text-sm text-primary hover:text-primary/80 flex items-center justify-center gap-1"
              >
                {isLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                <span>הצעות נוספות</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
