import { memo } from 'react';
import { Share2 } from 'lucide-react';

interface HeaderProps {
  onShare: () => void;
}

export const Header = memo(function Header({ onShare }: HeaderProps) {
  return (
    <header className="ios-header">
      <div className="ios-header-content">
        <h1 className="text-xl font-bold">הרשימה שלי</h1>
        <button
          onClick={onShare}
          className="btn-icon text-primary-foreground/90 hover:text-primary-foreground"
          aria-label="שיתוף"
        >
          <Share2 className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
});
