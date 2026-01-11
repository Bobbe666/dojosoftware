import React, { createContext, useState, useEffect, useCallback } from 'react';
import { apiClient } from '../services/api';

export const DatenContext = createContext();

export const DatenProvider = ({ children }) => {
  const [kurse, setKurse] = useState([]);
  const [trainer, setTrainer] = useState([]);
  const [stile, setStile] = useState([]);
  const [gruppen, setGruppen] = useState([]);
  const [loading, setLoading] = useState(true);

  const ladeAlleDaten = useCallback(async () => {
    setLoading(true);
    try {
      const [kurseRes, trainerRes, stileRes, gruppenRes] = await Promise.all([
        apiClient.get('/kurse').catch(() => ({ data: [] })),
        apiClient.get('/trainer').catch(() => ({ data: [] })),
        apiClient.get('/stile').catch(() => ({ data: [] })),
        apiClient.get('/gruppen').catch(() => ({ data: [] }))
      ]);

      setKurse(kurseRes.data);
      setTrainer(trainerRes.data);
      setStile(stileRes.data);
      setGruppen(gruppenRes.data);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    ladeAlleDaten();
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
