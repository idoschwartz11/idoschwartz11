import { memo } from 'react';
import { Copy, Share, X } from 'lucide-react';
import { toast } from 'sonner';

interface ShareSheetProps {
  text: string;
  onClose: () => void;
}

export const ShareSheet = memo(function ShareSheet({ text, onClose }: ShareSheetProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('הרשימה הועתקה');
      onClose();
    } catch {
      toast.error('שגיאה בהעתקה');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        onClose();
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  if (!text) {
    return (
      <>
        <div className="info-sheet-backdrop" onClick={onClose} />
        <div className="info-sheet">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">שיתוף</h3>
            <button onClick={onClose} className="btn-icon text-muted-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-muted-foreground text-center py-6">
            אין פריטים לשתף
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="info-sheet-backdrop" onClick={onClose} />
      <div className="info-sheet">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">שיתוף</h3>
          <button onClick={onClose} className="btn-icon text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="bg-muted rounded-xl p-4 mb-4 text-sm whitespace-pre-line leading-relaxed">
          {text}
        </div>
        
        <div className="flex gap-3">
          <button onClick={handleCopy} className="btn-secondary flex-1">
            <Copy className="w-4 h-4" />
            <span>העתק</span>
          </button>
          <button onClick={handleShare} className="btn-primary flex-1">
            <Share className="w-4 h-4" />
            <span>שתף</span>
          </button>
        </div>
      </div>
    </>
  );
});
