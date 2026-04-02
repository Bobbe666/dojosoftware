import React, { createContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';

export const DatenContext = createContext();

export const DatenProvider = ({ children }) => {
  const [kurse, setKurse] = useState([]);
  const [trainer, setTrainer] = useState([]);
  const [stile, setStile] = useState([]);
  const [gruppen, setGruppen] = useState([]);
  const [loading, setLoading] = useState(false); // WICHTIG: false statt true - kein Auto-Load beim App-Start
  const [dataLoaded, setDataLoaded] = useState(false);

  const ladeAlleDaten = useCallback(async () => {
    // Nicht nochmal laden wenn schon geladen
    if (dataLoaded) {
      console.log('📊 DatenContext: Daten bereits geladen - Skip');
      return;
    }

    console.log('📊 DatenContext: Lade Daten...');
    setLoading(true);
    try {
      const [kurseRes, trainerRes, stileRes, gruppenRes] = await Promise.all([
        apiClient.get('/kurse').catch((err) => {
          console.warn('⚠️ Fehler beim Laden der Kurse:', err.response?.status);
          return { data: [] };
        }),
        apiClient.get('/trainer').catch((err) => {
          console.warn('⚠️ Fehler beim Laden der Trainer:', err.response?.status);
          return { data: [] };
        }),
        apiClient.get('/stile').catch((err) => {
          console.warn('⚠️ Fehler beim Laden der Stile:', err.response?.status);
          return { data: [] };
        }),
        apiClient.get('/gruppen').catch((err) => {
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
  }, [dataLoaded]);

  // WICHTIG: Daten werden NICHT automatisch beim App-Start geladen
  // Sie werden nur auf Abruf geladen (z.B. wenn Dashboard mounted)
  // Das verhindert API-Calls bevor User eingeloggt ist
  useEffect(() => {
    // Event Listener für Login - Daten laden wenn User eingeloggt
    const handleUserLoggedIn = (event) => {
      console.log('📊 DatenContext: User eingeloggt - Lade Daten');
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
