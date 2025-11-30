import React, { createContext, useEffect, useState } from "react";
import axios from "axios";

// Kontext erstellen
export const KursContext = createContext();

// Kontext-Anbieter-Komponente
export const KursProvider = ({ children }) => {
  // 🔧 DEVELOPMENT MODE: Mock-Daten für lokale Entwicklung
  const isDevelopment = import.meta.env.MODE === 'development';

  const mockKurse = [
    {
      kurs_id: 1,
      name: 'Anfänger Karate',
      beschreibung: 'Grundlagen des Karate für Anfänger',
      wochentag: 'Montag',
      uhrzeit: '18:00',
      dauer_minuten: 90,
      max_teilnehmer: 20,
      trainer_id: 1,
      stil_id: 1,
      gruppen_id: 1
    },
    {
      kurs_id: 2,
      name: 'Fortgeschrittene Taekwondo',
      beschreibung: 'Fortgeschrittene Techniken',
      wochentag: 'Mittwoch',
      uhrzeit: '19:00',
      dauer_minuten: 90,
      max_teilnehmer: 15,
      trainer_id: 2,
      stil_id: 2,
      gruppen_id: 2
    }
  ];

  const [kurse, setKurse] = useState(isDevelopment ? mockKurse : []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const ladeKurse = async () => {
    // 🔧 DEVELOPMENT MODE: Mock-Daten verwenden
    if (isDevelopment) {
      console.log('🔧 Development Mode: Verwende Mock-Kurse');
      setKurse(mockKurse);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await axios.get("/kurse");
      setKurse(response.data);
    } catch (err) {
      console.error("Fehler beim Laden der Kurse im Kontext:", err);
      setError("Fehler beim Laden der Kurse");
      setKurse([]); // Fallback auf leeres Array
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    ladeKurse();
  }, []);

  const contextValue = {
    kurse,
    loading,
    error,
    ladeKurse // Funktion zum manuellen Neuladen
  };

  return (
    <KursContext.Provider value={contextValue}>
      {children}
    </KursContext.Provider>
  );
};