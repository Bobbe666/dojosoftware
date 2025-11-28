import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import config from '../config/config.js';

const DojoContext = createContext();

export const useDojoContext = () => {
  const context = useContext(DojoContext);
  if (!context) {
    throw new Error('useDojoContext must be used within a DojoProvider');
  }
  return context;
};

export const DojoProvider = ({ children }) => {
  const [dojos, setDojos] = useState([]);
  const [activeDojo, setActiveDojo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'current', 'all', 'compare' - Standard: alle Dojos anzeigen

  // Lade alle Dojos beim Start
  useEffect(() => {
    loadDojos();
  }, []);

  // Setze das aktive Dojo aus LocalStorage oder wähle das erste/Haupt-Dojo
  useEffect(() => {
    if (dojos.length > 0 && !activeDojo) {
      console.log('🔄 DojoContext: Setze aktives Dojo...', { dojos: dojos.length, activeDojo });

      const savedDojoId = localStorage.getItem('activeDojoId');
      if (savedDojoId) {
        const saved = dojos.find(d => d.id === parseInt(savedDojoId));
        if (saved) {
          console.log('✅ DojoContext: Gespeichertes Dojo gefunden:', saved.dojoname);
          setActiveDojo(saved);
          return;
        }
      }

      // Fallback: Haupt-Dojo oder erstes Dojo
      const hauptDojo = dojos.find(d => d.ist_hauptdojo);
      const dojoToSet = hauptDojo || dojos[0];
      console.log('✅ DojoContext: Setze Fallback-Dojo:', dojoToSet?.dojoname);
      setActiveDojo(dojoToSet);
    }
  }, [dojos, activeDojo]);

  const loadDojos = useCallback(async () => {
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const headers = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${config.apiBaseUrl}/dojos`, {
        headers
      });

      if (!response.ok) {
        console.error('Dojos API Response:', response.status, response.statusText);
        throw new Error('Fehler beim Laden der Dojos');
      }

      const data = await response.json();
      console.log('✅ Dojos geladen:', data);
      setDojos(data);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Dojos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const switchDojo = useCallback((dojo) => {
    setActiveDojo(dojo);
    localStorage.setItem('activeDojoId', dojo.id);
  }, []);

  const getDojoById = useCallback((id) => {
    return dojos.find(d => d.id === id);
  }, [dojos]);

  // Filter-Logik für Statistiken
  const getFilteredDojoIds = useCallback(() => {
    switch (filter) {
      case 'current':
        return activeDojo ? [activeDojo.id] : [];
      case 'all':
        return dojos.map(d => d.id);
      case 'compare':
        return dojos.map(d => d.id);
      default:
        return activeDojo ? [activeDojo.id] : [];
    }
  }, [filter, activeDojo, dojos]);

  // URL-Parameter für API-Calls
  const getDojoFilterParam = useCallback(() => {
    switch (filter) {
      case 'current':
        return activeDojo ? `dojo_id=${activeDojo.id}` : '';
      case 'all':
        return 'dojo_id=all';
      case 'compare':
        return 'dojo_id=compare';
      default:
        return activeDojo ? `dojo_id=${activeDojo.id}` : '';
    }
  }, [filter, activeDojo]);

  const value = useMemo(() => ({
    dojos,
    activeDojo,
    loading,
    filter,
    setFilter,
    switchDojo,
    getDojoById,
    getFilteredDojoIds,
    getDojoFilterParam,
    refreshDojos: loadDojos
  }), [dojos, activeDojo, loading, filter, switchDojo, getDojoById, getFilteredDojoIds, getDojoFilterParam, loadDojos]);

  return <DojoContext.Provider value={value}>{children}</DojoContext.Provider>;
};
