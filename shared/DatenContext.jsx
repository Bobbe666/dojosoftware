import React, { createContext, useEffect, useState } from "react";
import axios from "axios";

// 🧠 Kontext erstellen
export const DatenContext = createContext();

// 🌐 Provider-Komponente
export const DatenProvider = ({ children }) => {
  const [kurse, setKurse] = useState([]);
  const [trainer, setTrainer] = useState([]);
  const [stile, setStile] = useState([]);
  const [gruppen, setGruppen] = useState([]);
  const [mitglieder, setMitglieder] = useState([]); // Neuer Zustand für Mitglieder
  const [error, setError] = useState(null); // Fehlerzustand

  // 🔄 Zentrale Nachladefunktion für alle Daten
  const ladeAlleDaten = async () => {
    try {
      // Versuche, alle Daten zu laden
      const kurseRes = await axios.get("/kurse");
      const trainerRes = await axios.get("/trainer");
      const stileRes = await axios.get("/stile");
      const gruppenRes = await axios.get("/gruppen");
      const mitgliederRes = await axios.get("/mitglieder"); // Mitglieder laden

      // Wenn die Antworten gültig sind, setze den Status
      if (kurseRes.data) setKurse(kurseRes.data);
      if (trainerRes.data) {
        setTrainer(
          trainerRes.data.sort((a, b) =>
            (a.nachname + a.vorname).localeCompare(b.nachname + b.vorname)
          )
        );
      }
      if (stileRes.data) setStile(stileRes.data);
      if (gruppenRes.data) setGruppen(gruppenRes.data);
      if (mitgliederRes.data) setMitglieder(mitgliederRes.data); // Mitglieder setzen
    } catch (err) {
      console.error("❌ Fehler beim Laden der Daten:", err);
      setError("Es gab ein Problem beim Abrufen der Daten. Bitte überprüfen Sie den Server.");
    }
  };

  // ⏳ Beim ersten Laden automatisch alle Daten abrufen
  useEffect(() => {
    ladeAlleDaten();
  }, []);

  // Falls ein Fehler auftritt, geben wir den Fehler zurück
  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <DatenContext.Provider
      value={{ kurse, trainer, stile, gruppen, mitglieder, ladeAlleDaten }}
    >
      {children}
    </DatenContext.Provider>
  );
};
