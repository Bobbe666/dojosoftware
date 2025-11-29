import React, { useContext, useState } from "react";
import axios from "axios";
import config from '../config/config.js';
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Buttons.css";
import "../styles/GruppenStilVerwaltung.css";
import { DatenContext } from "@shared/DatenContext.jsx";

const GruppenStilVerwaltung = () => {
  const { stile, gruppen, ladeAlleDaten } = useContext(DatenContext);

  // Eingaben für neue Stile/Gruppen
  const [neuerStil, setNeuerStil] = useState("");
  const [neueGruppe, setNeueGruppe] = useState("");

  // Bearbeitungszustand für Stile
  const [editingStilId, setEditingStilId] = useState(null);
  const [editingStilName, setEditingStilName] = useState("");

  // Bearbeitungszustand für Gruppen
  const [editingGruppeId, setEditingGruppeId] = useState(null);
  const [editingGruppeName, setEditingGruppeName] = useState("");

  // -----------------------------
  //   Hinzufügen von Stil/Gruppe
  // -----------------------------
  const hinzufuegen = async (typ) => {
    const wert = typ === "stil" ? neuerStil : neueGruppe;
    if (!wert.trim()) return;

    const endpoint = typ === "stil" ? `${config.apiBaseUrl}/stile` : `${config.apiBaseUrl}/gruppen`;

    try {
      await axios.post(endpoint, { name: wert.trim() });
      typ === "stil" ? setNeuerStil("") : setNeueGruppe("");
      ladeAlleDaten();
    } catch (err) {
      console.error(`Fehler beim Hinzufügen von ${typ}:`, err);
      alert("Fehler beim Hinzufügen.");
    }
  };

  // -----------------------------
  //   Löschen von Stil/Gruppe
  // -----------------------------
  const loeschen = async (id, typ) => {
    if (!confirm(`Möchten Sie diesen ${typ === "stil" ? "Stil" : "diese Gruppe"} wirklich löschen?`)) {
      return;
    }

    const endpoint = typ === "stil" ? `${config.apiBaseUrl}/stile` : `${config.apiBaseUrl}/gruppen`;

    try {
      await axios.delete(`${endpoint}/${id}`);
      ladeAlleDaten();
    } catch (err) {
      console.error(`Fehler beim Löschen von ${typ}:`, err);
      alert("Fehler beim Löschen.");
    }
  };

  // -----------------------------
  //   Bearbeiten von Stilen
  // -----------------------------
  const bearbeitenStil = (stil) => {
    setEditingStilId(stil.stil_id);
    setEditingStilName(stil.name);
  };

  const abbrechenStil = () => {
    setEditingStilId(null);
    setEditingStilName("");
  };

  const saveStil = async (stilId) => {
    if (!editingStilName.trim()) return;
    try {
      // Update via PUT, da das Backend PUT /api/stile/:id erwartet
      await axios.put(`${config.apiBaseUrl}/stile/${stilId}`, { name: editingStilName.trim() });
      abbrechenStil();
      ladeAlleDaten();
    } catch (err) {
      console.error("Fehler beim Bearbeiten von Stil:", err);
      alert("Fehler beim Bearbeiten des Stils.");
    }
  };

  // -----------------------------
  //   Bearbeiten von Gruppen
  // -----------------------------
  const bearbeitenGruppe = (gruppe) => {
    setEditingGruppeId(gruppe.gruppen_id);
    setEditingGruppeName(gruppe.name);
  };

  const abbrechenGruppe = () => {
    setEditingGruppeId(null);
    setEditingGruppeName("");
  };

  const saveGruppe = async (gruppeId) => {
    if (!editingGruppeName.trim()) return;
    try {
      // Update via PUT, damit es mit dem Backend (PUT /api/gruppen/:id) übereinstimmt
      await axios.put(`${config.apiBaseUrl}/gruppen/${gruppeId}`, { name: editingGruppeName.trim() });
      abbrechenGruppe();
      ladeAlleDaten();
    } catch (err) {
      console.error("Fehler beim Bearbeiten von Gruppe:", err);
      alert("Fehler beim Bearbeiten der Gruppe.");
    }
  };

  return (
    <div className="app-container">
      <div className="page-header">
        <h1 className="page-title">STILE & GRUPPEN VERWALTEN</h1>
      </div>

      <div className="verwaltung-container">
        {/* Stilverwaltung */}
        <div className="glass-card">
          <h3 className="card-title">STILE</h3>
          {stile.length === 0 && <p>Keine Stile vorhanden.</p>}
          <ul className="verwaltung-liste">
            {stile.map((stil) => (
              <li key={stil.stil_id} className="verwaltung-eintrag">
                {editingStilId === stil.stil_id ? (
                  <>
                    <input
                      className="verwaltung-bearbeiten-input"
                      type="text"
                      value={editingStilName}
                      onChange={(e) => setEditingStilName(e.target.value)}
                    />
                    <button
                      className="btn btn-success"
                      onClick={() => saveStil(stil.stil_id)}
                    >
                      Speichern
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={abbrechenStil}
                    >
                      Abbrechen
                    </button>
                  </>
                ) : (
                  <>
                    <span>{stil.name}</span>
                    <button
                      className="btn btn-primary"
                      onClick={() => bearbeitenStil(stil)}
                    >
                      Bearbeiten
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => loeschen(stil.stil_id, "stil")}
                    >
                      Löschen
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="verwaltung-formular">
            <input
              type="text"
              placeholder="Neuen Stil eingeben"
              value={neuerStil}
              onChange={(e) => setNeuerStil(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={() => hinzufuegen("stil")}
            >
              Hinzufügen
            </button>
          </div>
        </div>

        {/* Gruppenverwaltung */}
        <div className="glass-card">
          <h3 className="card-title">GRUPPEN</h3>
          {gruppen.length === 0 && <p>Keine Gruppen vorhanden.</p>}
          <ul className="verwaltung-liste">
            {gruppen.map((gruppe) => (
              <li key={gruppe.gruppen_id} className="verwaltung-eintrag">
                {editingGruppeId === gruppe.gruppen_id ? (
                  <>
                    <input
                      className="verwaltung-bearbeiten-input"
                      type="text"
                      value={editingGruppeName}
                      onChange={(e) => setEditingGruppeName(e.target.value)}
                    />
                    <button
                      className="btn btn-success"
                      onClick={() => saveGruppe(gruppe.gruppen_id)}
                    >
                      Speichern
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={abbrechenGruppe}
                    >
                      Abbrechen
                    </button>
                  </>
                ) : (
                  <>
                    <span>{gruppe.name}</span>
                    <button
                      className="btn btn-primary"
                      onClick={() => bearbeitenGruppe(gruppe)}
                    >
                      Bearbeiten
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => loeschen(gruppe.gruppen_id, "gruppe")}
                    >
                      Löschen
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="verwaltung-formular">
            <input
              type="text"
              placeholder="Neue Gruppe eingeben"
              value={neueGruppe}
              onChange={(e) => setNeueGruppe(e.target.value)}
            />
            <button
              className="btn btn-primary"
              onClick={() => hinzufuegen("gruppe")}
            >
              Hinzufügen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GruppenStilVerwaltung;
