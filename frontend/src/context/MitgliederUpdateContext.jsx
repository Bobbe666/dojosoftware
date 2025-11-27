import React, { createContext, useContext, useState, useCallback } from 'react';
import { invalidateCache } from '../utils/apiCache.js';

// Context für Mitglieder-Updates
const MitgliederUpdateContext = createContext();

export const useMitgliederUpdate = () => {
  const context = useContext(MitgliederUpdateContext);
  if (!context) {
    throw new Error('useMitgliederUpdate muss innerhalb von MitgliederUpdateProvider verwendet werden');
  }
  return context;
};

export const MitgliederUpdateProvider = ({ children }) => {
  const [updateTrigger, setUpdateTrigger] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);

  const invalidateRelatedCaches = useCallback((updateType) => {
    switch (updateType) {
      case 'member_created':
      case 'member_updated':
      case 'member_deleted':
      case 'member_reactivated':
      case 'member_deactivated':
        invalidateCache('/api/dashboard');
        invalidateCache('/api/dashboard/batch');
        invalidateCache('/api/dashboard/recent');
        break;
      case 'manual_refresh':
        invalidateCache('/api/dashboard');
        invalidateCache('/api/dashboard/batch');
        invalidateCache('/api/dashboard/recent');
        break;
      default:
        break;
    }
  }, []);

  // Funktion zum Auslösen eines Updates
  const triggerUpdate = useCallback((updateType = 'member_created', data = null) => {
    console.log(`🔄 Mitglieder-Update ausgelöst: ${updateType}`, data);
    invalidateRelatedCaches(updateType);
    setUpdateTrigger(prev => prev + 1);
    setLastUpdate({
      type: updateType,
      timestamp: new Date().toISOString(),
      data
    });
  }, [invalidateRelatedCaches]);

  // Funktion zum manuellen Refresh
  const refreshAll = useCallback(() => {
    triggerUpdate('manual_refresh');
  }, [triggerUpdate]);

  const value = {
    updateTrigger,
    lastUpdate,
    triggerUpdate,
    refreshAll
  };

  return (
    <MitgliederUpdateContext.Provider value={value}>
      {children}
    </MitgliederUpdateContext.Provider>
  );
};



