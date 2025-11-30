import React, { createContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export const DatenContext = createContext();

// Mock-Daten außerhalb der Komponente definieren (konstante Referenz)
const MOCK_KURSE = [
  { kurs_id: 1, name: 'Anfänger Karate', wochentag: 'Montag', uhrzeit: '18:00' },
  { kurs_id: 2, name: 'Fortgeschrittene Taekwondo', wochentag: 'Mittwoch', uhrzeit: '19:00' }
];

const MOCK_TRAINER = [
  { trainer_id: 1, vorname: 'Max', nachname: 'Mustermann', email: 'max@dojo.de' },
  { trainer_id: 2, vorname: 'Anna', nachname: 'Schmidt', email: 'anna@dojo.de' }
];

const MOCK_STILE = [
  { stil_id: 1, name: 'Karate' },
  { stil_id: 2, name: 'Taekwondo' },
  { stil_id: 3, name: 'Judo' },
  { stil_id: 4, name: 'Kung Fu' },
  { stil_id: 5, name: 'Aikido' }
];

const MOCK_GRUPPEN = [
  { gruppen_id: 1, name: 'Anfänger' },
  { gruppen_id: 2, name: 'Fortgeschrittene' },
  { gruppen_id: 3, name: 'Experten' },
  { gruppen_id: 4, name: 'Kinder' },
  { gruppen_id: 5, name: 'Erwachsene' }
];

export const DatenProvider = ({ children }) => {
  // 🔧 DEVELOPMENT MODE: Mock-Daten für lokale Entwicklung
  const isDevelopment = import.meta.env.MODE === 'development';

  const [kurse, setKurse] = useState(isDevelopment ? MOCK_KURSE : []);
  const [trainer, setTrainer] = useState(isDevelopment ? MOCK_TRAINER : []);
  const [stile, setStile] = useState(isDevelopment ? MOCK_STILE : []);
  const [gruppen, setGruppen] = useState(isDevelopment ? MOCK_GRUPPEN : []);
  const [loading, setLoading] = useState(true);

  const ladeAlleDaten = useCallback(async () => {
    // 🔧 DEVELOPMENT MODE: Mock-Daten verwenden
    if (isDevelopment) {
      console.log('🔧 Development Mode: Verwende Mock-Daten (Kurse, Trainer, Stile, Gruppen)');
      setKurse(MOCK_KURSE);
      setTrainer(MOCK_TRAINER);
      setStile(MOCK_STILE);
      setGruppen(MOCK_GRUPPEN);
      setLoading(false);
      return;
    }

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
  }, [isDevelopment]);

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
