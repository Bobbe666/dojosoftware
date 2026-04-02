import React, { useContext, useState } from "react";
import axios from "axios";
import "../styles/Trainer.css";
import { DatenContext } from "@shared/DatenContext.jsx";

import config from '../config/config.js';
const API_BASE_URL = config.apiBaseUrl;

const Trainer = () => {
  const { trainer, stile, ladeAlleDaten } = useContext(DatenContext);

  const [neuerTrainer, setNeuerTrainer] = useState({
    vorname: "",
    nachname: "",
    email: "",
    telefon: "",
    stile: [],
  });

  const stilOptions = stile?.map(s => s.name) || [];

  const handleStileChange = (e) => {
    const selected = Array.from(e.target.selectedOptions).map(opt => opt.value);
    setNeuerTrainer(prev => ({ ...prev, stile: selected }));
  };

  const handleHinzufuegen = async () => {
    if (!neuerTrainer.vorname.trim() || !neuerTrainer.nachname.trim()) {
      alert("Bitte Vorname und Nachname eingeben.");
      return;
    }
    if (neuerTrainer.stile.length === 0) {
      alert("Bitte mindestens einen Stil auswählen.");
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/api/trainer`, neuerTrainer);
      setNeuerTrainer({ vorname: "", nachname: "", email: "", telefon: "", stile: [] });
      ladeAlleDaten();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Hinzufügen.");
    }
  };

  const handleLoeschen = async (id) => {
    if (!window.confirm("Diesen Trainer wirklich löschen?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/trainer/${id}`);
      ladeAlleDaten();
    } catch (err) {
      console.error(err);
      alert("Fehler beim Löschen.");
    }
  };

  return (
    <div className="trainer-container">
      <section className="trainer-list">
        <h2>Trainer verwalten</h2>
        <table className="trainer-table">
          <thead>
            <tr>
              <th>Vorname</th>
              <th>Nachname</th>
              <th>E-Mail</th>
              <th>Telefon</th>
              <th>Stile</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {trainer.length > 0 ? (
              trainer.map(t => (
                <tr key={t.trainer_id}>
                  <td>{t.vorname}</td>
                  <td>{t.nachname}</td>
                  <td>{t.email || "–"}</td>
                  <td>{t.telefon || "–"}</td>
                  <td>{(t.stile || []).join(", ")}</td>
                  <td>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleLoeschen(t.trainer_id)}
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="no-data">
                  Keine Trainer vorhanden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="trainer-form">
        <h2>Neuen Trainer hinzufügen</h2>
        <div className="form-grid">
          <label>
            Vorname
            <input
              type="text"
              value={neuerTrainer.vorname}
              onChange={e =>
                setNeuerTrainer({ ...neuerTrainer, vorname: e.target.value })
              }
            />
          </label>

          <label>
            Nachname
            <input
              type="text"
              value={neuerTrainer.nachname}
              onChange={e =>
                setNeuerTrainer({ ...neuerTrainer, nachname: e.target.value })
              }
            />
          </label>

          <label>
            E-Mail (optional)
            <input
              type="email"
              value={neuerTrainer.email}
              onChange={e =>
                setNeuerTrainer({ ...neuerTrainer, email: e.target.value })
              }
            />
          </label>

          <label>
            Telefon (optional)
            <input
              type="tel"
              value={neuerTrainer.telefon}
              onChange={e =>
                setNeuerTrainer({ ...neuerTrainer, telefon: e.target.value })
              }
            />
          </label>

          <label className="full-width">
            Stile auswählen
            <select
              multiple
              value={neuerTrainer.stile}
              onChange={handleStileChange}
            >
              {stilOptions.length > 0 ? (
                stilOptions.map(stil => (
                  <option key={stil} value={stil}>
                    {stil}
                  </option>
                ))
              ) : (
                <option disabled>Keine Stile verfügbar</option>
              )}
            </select>
          </label>
        </div>

        <button className="btn btn-primary" onClick={handleHinzufuegen}>
          Hinzufügen
        </button>
      </section>
    </div>
  );
};

export default Trainer;
