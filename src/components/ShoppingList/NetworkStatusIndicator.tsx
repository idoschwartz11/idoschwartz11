import { memo } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NetworkStatusIndicatorProps {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
}

export const NetworkStatusIndicator = memo(function NetworkStatusIndicator({
  isOnline,
  isSyncing,
  pendingCount,
}: NetworkStatusIndicatorProps) {
  // Don't show anything if online and no pending actions
  if (isOnline && !isSyncing && pendingCount === 0) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex items-center gap-1.5"
      >
        {!isOnline ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-warning/20 text-warning">
            <WifiOff className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">אופליין</span>
          </div>
        ) : isSyncing ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/20 text-primary">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="text-xs font-medium">מסנכרן...</span>
          </div>
        ) : pendingCount > 0 ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-accent/20 text-accent">
            <Wifi className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{pendingCount} ממתינים</span>
          </div>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
});
