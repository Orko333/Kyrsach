import React, { createContext, useContext, useState, useMemo } from 'react';

const ProgressContext = createContext();

export const useProgress = () => {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used within ProgressProvider');
  return ctx;
};

export const ProgressProvider = ({ children }) => {
  const [progress, setProgress] = useState({ explored: 0, totalChoices: 0, percent: 0 });

  const clearProgress = () => setProgress({ explored: 0, totalChoices: 0, percent: 0 });

  const value = useMemo(() => ({ progress, setProgress, clearProgress }), [progress]);

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
};
