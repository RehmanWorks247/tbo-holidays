'use client';

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from 'react';

interface HolidayInspirationState {
  savedIds: readonly string[];
  toggleSaved: (id: string) => void;
}

const HolidayInspirationContext = createContext<HolidayInspirationState | null>(null);

export function HolidayInspirationProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const toggleSaved = useCallback((id: string) => {
    setSavedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }, []);
  const value = useMemo(() => ({ savedIds, toggleSaved }), [savedIds, toggleSaved]);

  return (
    <HolidayInspirationContext.Provider value={value}>
      {children}
    </HolidayInspirationContext.Provider>
  );
}

export function useHolidayInspiration(): HolidayInspirationState {
  const context = useContext(HolidayInspirationContext);
  if (!context) {
    throw new Error('useHolidayInspiration must be used within HolidayInspirationProvider.');
  }
  return context;
}
