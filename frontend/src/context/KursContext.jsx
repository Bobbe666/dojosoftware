import React, { createContext, useEffect, useState } from "react";
import axios from "axios";

// Kontext erstellen
export const KursContext = createContext();

// Kontext-Anbieter-Komponente
export const KursProvider = ({ children }) => {
  const [kurse, setKurse] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const ladeKurse = async () => {
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