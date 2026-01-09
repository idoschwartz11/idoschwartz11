import { memo, useEffect } from 'react';
import { Undo2 } from 'lucide-react';

interface UndoToastProps {
  onUndo: () => void;
  onDismiss: () => void;
}

export const UndoToast = memo(function UndoToast({ onUndo, onDismiss }: UndoToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div className="toast-container">
      <div className="toast">
        <span className="text-sm">הפריט נמחק</span>
        <button
          onClick={onUndo}
          className="flex items-center gap-1 text-primary-foreground bg-primary/20 px-3 py-1.5 rounded-lg text-sm font-medium"
        >
          <Undo2 className="w-4 h-4" />
          <span>בטל</span>
        </button>
      </div>
    </div>
  );
});
