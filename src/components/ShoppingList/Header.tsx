import { memo } from "react";
import { Share2 } from "lucide-react";
import { CleanModeToggle } from "./CleanModeToggle";
import { useCleanListMode } from "@/contexts/CleanListModeContext";

interface HeaderProps {
  onShare: () => void;
}

export const Header = memo(function Header({ onShare }: HeaderProps) {
  const { isCleanMode } = useCleanListMode();

  return (
    <header className="ios-header">
      <div className="ios-header-content">
        <div className="flex items-center gap-9">
          <h1 className="text-xl font-bold">{isCleanMode ? "רשימת קניות" : "הרשימה שלי"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <CleanModeToggle />
          {!isCleanMode && (
            <button
              onClick={onShare}
              className="btn-icon text-primary-foreground/90 hover:text-primary-foreground"
              aria-label="שיתוף"
            >
              <Share2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
});
