import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CompanySettings } from '../types.js';
import { api } from '../lib/api.js';

interface CompanyContextType {
  settings: CompanySettings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  updateSettings: (newSettings: Partial<CompanySettings>) => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType>({
  settings: null,
  loading: true,
  refreshSettings: async () => {},
  updateSettings: async () => {},
});

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = useCallback(async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load company settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = async (newSettings: Partial<CompanySettings>) => {
    try {
      const updated = await api.updateSettings(newSettings);
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update company settings:', err);
      throw err;
    }
  };

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  return (
    <CompanyContext.Provider
      value={{
        settings,
        loading,
        refreshSettings,
        updateSettings,
      }}
    >
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => useContext(CompanyContext);
