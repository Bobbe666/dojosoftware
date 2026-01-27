import React, { useContext, useState, useEffect } from "react";
import axios from "axios";
import config from '../config/config.js';
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Buttons.css";
import "../styles/GruppenStilVerwaltung.css";
import { DatenContext } from "@shared/DatenContext.jsx";

const GruppenStilVerwaltung = () => {
  const { stile: stileFromContext, gruppen: gruppenFromContext, ladeAlleDaten } = useContext(DatenContext);

  // Filtere nur aktive Stile (aktiv = true oder aktiv = 1 oder aktiv = null)
  const stile = (stileFromContext || []).filter(s => s.aktiv !== 0 && s.aktiv !== false);
  const gruppen = gruppenFromContext || [];

  // Eingaben für neue Stile/Gruppen
  const [neuerStil, setNeuerStil] = useState("");
  const [neueGruppe, setNeueGruppe] = useState("");

  // Bearbeitungszustand für Stile
  const [editingStilId, setEditingStilId] = useState(null);
  const [editingStilName, setEditingStilName] = useState("");

  // Bearbeitungszustand für Gruppen
  const [editingGruppeId, setEditingGruppeId] = useState(null);
  const [editingGruppeName, setEditingGruppeName] = useState("");

  // Auswahl-Zustand für Bulk-Aktionen
  const [selectedStile, setSelectedStile] = useState([]);
  const [selectedGruppen, setSelectedGruppen] = useState([]);

  // -----------------------------
  //   Hinzufügen von Stil/Gruppe
  // -----------------------------
  const hinzufuegen = async (typ) => {
    const wert = typ === "stil" ? neuerStil : neueGruppe;
    if (!wert.trim()) return;

    const endpoint = typ === "stil" ? `/stile` : `/gruppen`;

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
    console.log('Löschen aufgerufen:', { id, typ });

    if (!confirm(`Möchten Sie diesen ${typ === "stil" ? "Stil" : "diese Gruppe"} wirklich löschen?`)) {
      console.log('Löschen abgebrochen durch Benutzer');
      return;
    }

    const endpoint = typ === "stil" ? `/stile` : `/gruppen`;

    try {
      const response = await axios.delete(`${endpoint}/${id}`);
      console.log('✅ Erfolgreich gelöscht:', response.data);
      // Daten neu laden um UI zu aktualisieren
      ladeAlleDaten();
      alert(`${typ === "stil" ? "Stil" : "Gruppe"} wurde erfolgreich gelöscht (deaktiviert)!`);
    } catch (err) {
      console.error(`❌ Fehler beim Löschen von ${typ}:`, err);

      // Spezielle Behandlung für 409 Konflikt (Stil hat noch Mitglieder)
      if (err.response?.status === 409) {
        const errorData = err.response.data;
        const memberCount = errorData.mitglieder_anzahl || 'mehrere';
        alert(
          `${typ === "stil" ? "Stil" : "Gruppe"} kann nicht gelöscht werden!\n\n` +
          `Es sind noch ${memberCount} aktive Mitglieder zugeordnet.\n\n` +
          `Bitte weisen Sie die Mitglieder einem anderen ${typ === "stil" ? "Stil" : "Gruppe"} zu oder deaktivieren Sie diese zuerst.`
        );
      } else {
        // Andere Fehler
        const errorMsg = err.response?.data?.error || err.message || 'Unbekannter Fehler';
        alert(`Fehler beim Löschen: ${errorMsg}`);
      }
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
      await axios.put(`/stile/${stilId}`, { name: editingStilName.trim() });
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
      await axios.put(`/gruppen/${gruppeId}`, { name: editingGruppeName.trim() });
      abbrechenGruppe();
      ladeAlleDaten();
    } catch (err) {
      console.error("Fehler beim Bearbeiten von Gruppe:", err);
      alert("Fehler beim Bearbeiten der Gruppe.");
    }
  };

  // -----------------------------
  //   Bulk-Aktionen
  // -----------------------------
  const toggleAllStile = () => {
    if (selectedStile.length === stile.length) {
      setSelectedStile([]);
    } else {
      setSelectedStile(stile.map(s => s.stil_id));
    }
  };

  const toggleAllGruppen = () => {
    if (selectedGruppen.length === gruppen.length) {
      setSelectedGruppen([]);
    } else {
      setSelectedGruppen(gruppen.map(g => g.gruppen_id));
    }
  };

  const loescheAusgewaehlteStile = async () => {
    if (selectedStile.length === 0) return;
    if (!confirm(`${selectedStile.length} Stile wirklich löschen?`)) return;

    try {
      await Promise.all(selectedStile.map(id => axios.delete(`/stile/${id}`)));
      setSelectedStile([]);
      ladeAlleDaten();
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      alert('Fehler beim Löschen einiger Stile.');
    }
  };

  const loescheAusgewaehlteGruppen = async () => {
    if (selectedGruppen.length === 0) return;
    if (!confirm(`${selectedGruppen.length} Gruppen wirklich löschen?`)) return;

    try {
      await Promise.all(selectedGruppen.map(id => axios.delete(`/gruppen/${id}`)));
      setSelectedGruppen([]);
      ladeAlleDaten();
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      alert('Fehler beim Löschen einiger Gruppen.');
    }
  };

  // Position verschieben
  const moveStil = async (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= stile.length) return;

    const stil1 = stile[index];
    const stil2 = stile[newIndex];

    try {
      // Tausche reihenfolge-Werte
      await Promise.all([
        axios.put(`/stile/${stil1.stil_id}`, {
          name: stil1.name,
          beschreibung: stil1.beschreibung || '',
          aktiv: stil1.aktiv,
          reihenfolge: stil2.reihenfolge || newIndex
        }),
        axios.put(`/stile/${stil2.stil_id}`, {
          name: stil2.name,
          beschreibung: stil2.beschreibung || '',
          aktiv: stil2.aktiv,
          reihenfolge: stil1.reihenfolge || index
        })
      ]);

      // Daten neu laden
      ladeAlleDaten();
    } catch (err) {
      console.error('Fehler beim Verschieben des Stils:', err);
      alert('Fehler beim Verschieben.');
    }
  };

  const moveGruppe = async (index, direction) => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= gruppen.length) return;

    const gruppe1 = gruppen[index];
    const gruppe2 = gruppen[newIndex];

    try {
      // Tausche reihenfolge-Werte
      await Promise.all([
        axios.put(`/gruppen/${gruppe1.gruppen_id}`, {
          name: gruppe1.name,
          reihenfolge: gruppe2.reihenfolge || newIndex
        }),
        axios.put(`/gruppen/${gruppe2.gruppen_id}`, {
          name: gruppe2.name,
          reihenfolge: gruppe1.reihenfolge || index
        })
      ]);

      // Daten neu laden
      ladeAlleDaten();
    } catch (err) {
      console.error('Fehler beim Verschieben der Gruppe:', err);
      alert('Fehler beim Verschieben.');
    }
  };

  return (
    <div className="app-container">
      <div className="page-header">
        <h1 className="page-title">GRUPPEN VERWALTEN</h1>
      </div>

      <div className="verwaltung-container">
        {/* Gruppenverwaltung */}
        <div className="glass-card">
          <h3 className="card-title">GRUPPEN</h3>

          {gruppen.length === 0 && <p>Keine Gruppen vorhanden.</p>}
          <ul className="verwaltung-liste">
            {gruppen.map((gruppe, index) => (
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
                      💾
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={abbrechenGruppe}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="checkbox"
                      checked={selectedGruppen.includes(gruppe.gruppen_id)}
                      onChange={() => {
                        setSelectedGruppen(prev =>
                          prev.includes(gruppe.gruppen_id)
                            ? prev.filter(id => id !== gruppe.gruppen_id)
                            : [...prev, gruppe.gruppen_id]
                        );
                      }}
                    />
                    <div className="sort-buttons">
                      <button
                        className="sort-btn"
                        onClick={() => moveGruppe(index, 'up')}
                        disabled={index === 0}
                      >
                        ▲
                      </button>
                      <button
                        className="sort-btn"
                        onClick={() => moveGruppe(index, 'down')}
                        disabled={index === gruppen.length - 1}
                      >
                        ▼
                      </button>
                    </div>
                    <span>{gruppe.name}</span>
                    <button
                      className="btn btn-primary"
                      onClick={() => bearbeitenGruppe(gruppe)}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => loeschen(gruppe.gruppen_id, "gruppe")}
                    >
                      🗑️
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

          {/* Bulk Actions - moved to bottom */}
          {gruppen.length > 0 && (
            <div className="bulk-actions">
              <button className="btn btn-secondary" onClick={toggleAllGruppen}>
                {selectedGruppen.length === gruppen.length ? 'Alle abwählen' : 'Alle auswählen'}
              </button>
              {selectedGruppen.length > 0 && (
                <button className="btn btn-danger" onClick={loescheAusgewaehlteGruppen}>
                  {selectedGruppen.length} löschen
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GruppenStilVerwaltung;
