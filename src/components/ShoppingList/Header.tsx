import { memo } from "react";
import { Share2 } from "lucide-react";
import { CleanModeToggle } from "./CleanModeToggle";
import { useCleanListMode } from "@/contexts/CleanListModeContext";
import { NetworkStatusIndicator } from "./NetworkStatusIndicator";

interface HeaderProps {
  onShare: () => void;
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}

export const Header = memo(function Header({ 
  onShare,
  isOnline,
  isSyncing,
  pendingCount,
}: HeaderProps) {
  const { isCleanMode } = useCleanListMode();

  return (
    <header className="ios-header">
      <div className="ios-header-content">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">{isCleanMode ? "רשימת קניות" : "הרשימה שלנו"}</h1>
          <NetworkStatusIndicator
            isOnline={isOnline}
            isSyncing={isSyncing}
            pendingCount={pendingCount}
          />
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
