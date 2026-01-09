import { createContext, useContext, useState, ReactNode, useMemo } from 'react';

interface CleanListModeContextValue {
  isCleanMode: boolean;
  toggleCleanMode: () => void;
}

const CleanListModeContext = createContext<CleanListModeContextValue | undefined>(undefined);

export function CleanListModeProvider({ children }: { children: ReactNode }) {
  const [isCleanMode, setIsCleanMode] = useState(false);

  const value = useMemo(() => ({
    isCleanMode,
    toggleCleanMode: () => setIsCleanMode(prev => !prev),
  }), [isCleanMode]);

  return (
    <CleanListModeContext.Provider value={value}>
      {children}
    </CleanListModeContext.Provider>
  );
}

export function useCleanListMode() {
  const context = useContext(CleanListModeContext);
  if (!context) {
    throw new Error('useCleanListMode must be used within CleanListModeProvider');
  }
  return context;
}
