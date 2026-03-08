import React, { createContext, useContext, useEffect, useState } from 'react';

import { getLastInsights, loadLastInsights, setLastInsights, setLastInsightsAndPersist, type LastInsights } from '@/stores/insightsStore';

type InsightsContextValue = {
  insights: LastInsights;
  setInsights: (u: Partial<LastInsights>) => void;
  setInsightsAndPersist: (u: Partial<LastInsights>) => Promise<void>;
  refresh: () => Promise<void>;
};

const InsightsContext = createContext<InsightsContextValue | null>(null);

export function InsightsProvider({ children }: { children: React.ReactNode }) {
  const [insights, setInsightsState] = useState<LastInsights>(getLastInsights);

  const refresh = React.useCallback(async () => {
    const loaded = await loadLastInsights();
    setInsightsState(loaded);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setInsights = React.useCallback((update: Partial<LastInsights>) => {
    setLastInsights(update);
    setInsightsState(getLastInsights());
  }, []);

  const setInsightsAndPersist = React.useCallback(async (update: Partial<LastInsights>) => {
    await setLastInsightsAndPersist(update);
    setInsightsState(getLastInsights());
  }, []);

  return (
    <InsightsContext.Provider value={{ insights, setInsights, setInsightsAndPersist, refresh }}>
      {children}
    </InsightsContext.Provider>
  );
}

export function useInsights() {
  const ctx = useContext(InsightsContext);
  if (!ctx) throw new Error('useInsights must be used within InsightsProvider');
  return ctx;
}
