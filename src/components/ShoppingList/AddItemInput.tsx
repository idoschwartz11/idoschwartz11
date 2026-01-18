import { memo, useState, useRef, useCallback, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface AddItemInputProps {
  onAdd: (name: string, quantity?: number) => void;
  onRequestSizeSelection: (productName: string) => void;
  disabled?: boolean;
}

export const AddItemInput = memo(function AddItemInput({ 
  onAdd, 
  onRequestSizeSelection,
  disabled 
}: AddItemInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  }, []);

  const handleSubmit = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (value.trim() && !disabled) {
      // Instead of adding directly, request size selection
      onRequestSizeSelection(value.trim());
      setValue('');
    }
  }, [value, onRequestSizeSelection, disabled]);

  // Public method to refocus after size selection
  const refocus = useCallback(() => {
    inputRef.current?.focus();
  }, []);

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
            placeholder="מה להוסיף?"
            className="add-input"
            dir="rtl"
            autoComplete="off"
            autoCapitalize="off"
          />
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
