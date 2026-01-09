import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface AddItemInputProps {
  onAdd: (name: string, quantity?: number) => void;
  getSuggestions: (query: string) => string[];
  disabled?: boolean;
}

export const AddItemInput = memo(function AddItemInput({ 
  onAdd, 
  getSuggestions,
  disabled 
}: AddItemInputProps) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    if (newValue.trim()) {
      const newSuggestions = getSuggestions(newValue);
      setSuggestions(newSuggestions);
      setShowSuggestions(newSuggestions.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [getSuggestions]);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim() && !disabled) {
      onAdd(value.trim());
      setValue('');
      setSuggestions([]);
      setShowSuggestions(false);
      // Keep focus on input for quick successive adds
      inputRef.current?.focus();
    }
  }, [value, onAdd, disabled]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setValue(suggestion);
    setSuggestions([]);
    setShowSuggestions(false);
    // Submit immediately
    onAdd(suggestion);
    setValue('');
    inputRef.current?.focus();
  }, [onAdd]);

  const handleBlur = useCallback(() => {
    // Delay to allow suggestion click to register
    setTimeout(() => setShowSuggestions(false), 150);
  }, []);

  const handleFocus = useCallback(() => {
    if (suggestions.length > 0 && value.trim()) {
      setShowSuggestions(true);
    }
  }, [suggestions, value]);

  // Auto-focus on mount
  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  if (disabled) return null;

  return (
    <form onSubmit={handleSubmit} className="mb-4 mt-4 relative">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={handleFocus}
            placeholder="מה להוסיף?"
            className="add-input"
            dir="rtl"
            autoComplete="off"
            autoCapitalize="off"
          />
          
          {showSuggestions && suggestions.length > 0 && (
            <div className="autocomplete-dropdown">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  className="autocomplete-item w-full text-right"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <button 
          type="submit" 
          className="btn-primary"
          disabled={!value.trim()}
        >
          <Plus className="w-5 h-5" />
          <span>הוסף</span>
        </button>
      </div>
    </form>
  );
});

