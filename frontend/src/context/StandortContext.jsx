import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { useDojoContext } from './DojoContext';
import config from '../config/config.js';

const StandortContext = createContext();

export const useStandortContext = () => {
  const context = useContext(StandortContext);
  if (!context) {
    throw new Error('useStandortContext must be used within a StandortProvider');
  }
  return context;
};

export const StandortProvider = ({ children }) => {
  const { activeDojo } = useDojoContext();
  const [standorte, setStandorte] = useState([]);
  const [activeStandort, setActiveStandort] = useState('all'); // 'all' oder standort_id
  const [loading, setLoading] = useState(true);

  // Lade Standorte wenn Dojo gewechselt wird
  useEffect(() => {
    if (activeDojo && activeDojo !== 'super-admin') {
      loadStandorte();
    } else {
      // Kein Dojo aktiv oder Super-Admin -> Standorte zurücksetzen
      setStandorte([]);
      setActiveStandort('all');
      setLoading(false);
    }
  }, [activeDojo]);

  // Restore activeStandort from localStorage when standorte loaded
  useEffect(() => {
    if (standorte.length > 0 && activeDojo && activeDojo !== 'super-admin') {
      const savedStandortId = localStorage.getItem(`activeStandortId_${activeDojo.id}`);

      if (savedStandortId) {
        // Check if 'all' or if standort exists
        if (savedStandortId === 'all') {
          setActiveStandort('all');
        } else {
          const standortExists = standorte.find(s => s.standort_id === parseInt(savedStandortId));
          if (standortExists) {
            setActiveStandort(parseInt(savedStandortId));
          } else {
            setActiveStandort('all'); // Fallback if saved standort doesn't exist anymore
          }
        }
      } else {
        setActiveStandort('all'); // Default to 'all' if nothing saved
      }
    }
  }, [standorte, activeDojo]);

  const loadStandorte = useCallback(async () => {
    if (!activeDojo || activeDojo === 'super-admin') {
      setStandorte([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('dojo_auth_token');

      if (!token) {
        console.log('⚠️ Kein Token vorhanden - Standorte werden nicht geladen');
        setStandorte([]);
        setLoading(false);
        return;
      }

      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      const response = await fetch(`${config.apiBaseUrl}/standorte`, {
        headers
      });

      if (!response.ok) {
        console.error('Standorte API Response:', response.status, response.statusText);
        throw new Error('Fehler beim Laden der Standorte');
      }

      const result = await response.json();
      console.log('✅ Standorte geladen:', result);

      if (result.success && Array.isArray(result.data)) {
        setStandorte(result.data);
      } else {
        console.error('❌ Standorte API returned invalid data:', result);
        setStandorte([]);
      }
    } catch (error) {
      console.error('❌ Fehler beim Laden der Standorte:', error);
      setStandorte([]);
    } finally {
      setLoading(false);
    }
  }, [activeDojo]);

  const switchStandort = useCallback((standortId) => {
    setActiveStandort(standortId);

    if (activeDojo && activeDojo !== 'super-admin') {
      localStorage.setItem(`activeStandortId_${activeDojo.id}`, standortId);

      if (standortId === 'all') {
        console.log('✅ Gewechselt zu: Alle Standorte');
      } else {
        const standort = standorte.find(s => s.standort_id === standortId);
        console.log('✅ Gewechselt zu Standort:', standort?.name);
      }
    }
  }, [activeDojo, standorte]);

  const getStandortById = useCallback((id) => {
    return standorte.find(s => s.standort_id === id);
  }, [standorte]);

  // Helper: Check if multiple locations exist
  const hasMultipleLocations = useMemo(() => {
    return standorte.length > 1;
  }, [standorte]);

  // Get current standort object (null if 'all')
  const currentStandort = useMemo(() => {
    if (activeStandort === 'all') return null;
    return standorte.find(s => s.standort_id === activeStandort);
  }, [activeStandort, standorte]);

  // Get Hauptstandort
  const hauptstandort = useMemo(() => {
    return standorte.find(s => s.ist_hauptstandort === true);
  }, [standorte]);

  // URL parameter for API calls
  const getStandortFilterParam = useCallback(() => {
    if (activeStandort === 'all') {
      return 'standort_id=all';
    }
    return `standort_id=${activeStandort}`;
  }, [activeStandort]);

  const value = useMemo(() => ({
    standorte,
    activeStandort,
    currentStandort,
    hauptstandort,
    loading,
    hasMultipleLocations,
    switchStandort,
    getStandortById,
    getStandortFilterParam,
    refreshStandorte: loadStandorte
  }), [
    standorte,
    activeStandort,
    currentStandort,
    hauptstandort,
    loading,
    hasMultipleLocations,
    switchStandort,
    getStandortById,
    getStandortFilterParam,
    loadStandorte
  ]);

  return <StandortContext.Provider value={value}>{children}</StandortContext.Provider>;
};
