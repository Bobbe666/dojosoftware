import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

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
        axios.get('/kurse').catch(() => ({ data: [] })),
        axios.get('/trainer').catch(() => ({ data: [] })),
        axios.get('/stile').catch(() => ({ data: [] })),
        axios.get('/gruppen').catch(() => ({ data: [] }))
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
