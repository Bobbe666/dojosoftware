import React, { createContext, useEffect, useState } from "react";
import { apiClient } from "../services/api";

// Kontext erstellen
export const KursContext = createContext();

// Kontext-Anbieter-Komponente
export const KursProvider = ({ children }) => {
  const [kurse, setKurse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const ladeKurse = async () => {
    // Prüfe ob Token vorhanden ist (verwende beide möglichen Keys für Kompatibilität)
    const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
    if (!token) {
      console.log('Kein Token vorhanden, überspringe Kurse-Laden');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await apiClient.get("/kurse");
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
    // Lade Kurse initial
    ladeKurse();

    // Event Listener für Login-Ereignisse
    const handleStorageChange = (e) => {
      if ((e.key === 'dojo_auth_token' || e.key === 'authToken') && e.newValue) {
        console.log('Token wurde gesetzt, lade Kurse neu');
        ladeKurse();
      }
    };

    // Custom Event Listener für lokale Login-Ereignisse (same tab)
    const handleLogin = () => {
      console.log('Login-Event empfangen, lade Kurse neu');
      ladeKurse();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('userLoggedIn', handleLogin);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('userLoggedIn', handleLogin);
    };
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