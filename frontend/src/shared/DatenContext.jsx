import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../services/api';
import { useDojoContext } from '../context/DojoContext';

export const DatenContext = createContext();

export const DatenProvider = ({ children }) => {
  const { activeDojo, getDojoFilterParam } = useDojoContext();
  const [kurse, setKurse] = useState([]);
  const [trainer, setTrainer] = useState([]);
  const [stile, setStile] = useState([]);
  const [gruppen, setGruppen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const isLoggedIn = useRef(false);

  const ladeAlleDaten = useCallback(async () => {
    console.log('📊 DatenContext: Lade Daten...');
    const dojoParam = getDojoFilterParam();
    // Kein Dojo-Filter → kein Laden (Super-Admin ohne Dojo-Auswahl, oder noch nicht bereit)
    if (!dojoParam) {
      console.log('📊 DatenContext: Kein Dojo-Filter – leere Daten');
      setKurse([]);
      setTrainer([]);
      setGruppen([]);
      return;
    }
    setLoading(true);
    try {
      const suffix = `?${dojoParam}`;

      const [kurseRes, trainerRes, stileRes, gruppenRes] = await Promise.all([
        apiClient.get(`/kurse${suffix}`).catch((err) => {
          console.warn('⚠️ Fehler beim Laden der Kurse:', err.response?.status);
          return { data: [] };
        }),
        apiClient.get(`/trainer${suffix}`).catch((err) => {
          console.warn('⚠️ Fehler beim Laden der Trainer:', err.response?.status);
          return { data: [] };
        }),
        apiClient.get('/stile').catch((err) => {
          console.warn('⚠️ Fehler beim Laden der Stile:', err.response?.status);
          return { data: [] };
        }),
        apiClient.get(`/gruppen${suffix}`).catch((err) => {
          console.warn('⚠️ Fehler beim Laden der Gruppen:', err.response?.status);
          return { data: [] };
        })
      ]);

      setKurse(kurseRes.data);
      setTrainer(trainerRes.data);
      setStile(stileRes.data);
      setGruppen(gruppenRes.data);
      setDataLoaded(true);
      console.log('✅ DatenContext: Daten erfolgreich geladen');
    } catch (error) {
      console.error('❌ DatenContext: Fehler beim Laden der Daten:', error);
    } finally {
      setLoading(false);
    }
  }, [getDojoFilterParam]);

  // Bei Dojo-Wechsel: neu laden (nur wenn schon eingeloggt)
  useEffect(() => {
    if (isLoggedIn.current && activeDojo !== undefined) {
      console.log('📊 DatenContext: Dojo gewechselt - Lade Daten neu');
      ladeAlleDaten();
    }
  }, [activeDojo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Login-Event: Daten beim ersten Login laden
  useEffect(() => {
    const handleUserLoggedIn = () => {
      console.log('📊 DatenContext: User eingeloggt - Lade Daten');
      isLoggedIn.current = true;
      ladeAlleDaten();
    };

    window.addEventListener('userLoggedIn', handleUserLoggedIn);

    return () => {
      window.removeEventListener('userLoggedIn', handleUserLoggedIn);
    };
  }, [ladeAlleDaten]);

  const value = {
    kurse,
    trainer,
    stile,
    gruppen,
    loading,
    ladeAlleDaten,
    setKurse,
    setTrainer,
    setStile,
    setGruppen
  };

  return (
    <DatenContext.Provider value={value}>
      {children}
    </DatenContext.Provider>
  );
};
