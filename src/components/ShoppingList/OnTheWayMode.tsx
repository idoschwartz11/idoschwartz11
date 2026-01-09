import { memo } from 'react';
import { ShoppingCart } from 'lucide-react';

interface OnTheWayModeProps {
  isActive: boolean;
  onToggle: () => void;
}

export const OnTheWayMode = memo(function OnTheWayMode({ 
  isActive, 
  onToggle 
}: OnTheWayModeProps) {
  return (
    <button
      onClick={onToggle}
      className={`mode-toggle ${isActive ? 'mode-toggle-active' : 'mode-toggle-inactive'}`}
    >
      <ShoppingCart className="w-4 h-4" />
      <span>בדרך לסופר</span>
    </button>
  );
});
