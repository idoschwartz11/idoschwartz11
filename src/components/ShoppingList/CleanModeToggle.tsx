import { memo } from 'react';
import { ShoppingCart, CheckCircle } from 'lucide-react';
import { useCleanListMode } from '@/contexts/CleanListModeContext';

export const CleanModeToggle = memo(function CleanModeToggle() {
  const { isCleanMode, toggleCleanMode } = useCleanListMode();

  return (
    <button
      onClick={toggleCleanMode}
      className={`mode-toggle ${isCleanMode ? 'mode-toggle-active' : 'mode-toggle-inactive'}`}
      aria-pressed={isCleanMode}
    >
      {isCleanMode ? (
        <>
          <CheckCircle className="w-4 h-4" />
          <span>סיימתי</span>
        </>
      ) : (
        <>
          <ShoppingCart className="w-4 h-4" />
          <span>אני בסופר</span>
        </>
      )}
    </button>
  );
});
