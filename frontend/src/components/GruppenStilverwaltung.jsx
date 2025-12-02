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

  // 🔧 DEVELOPMENT MODE: Mock-Daten für lokale Entwicklung
  const isDevelopment = import.meta.env.MODE === 'development';

  console.log('🔧 GruppenStilVerwaltung - Development Mode:', isDevelopment);

  const [mockStile, setMockStile] = useState([
    { stil_id: 1, name: 'Karate' },
    { stil_id: 2, name: 'Taekwondo' },
    { stil_id: 3, name: 'Judo' },
    { stil_id: 4, name: 'Kung Fu' },
    { stil_id: 5, name: 'Aikido' }
  ]);
  const [mockGruppen, setMockGruppen] = useState([
    { gruppen_id: 1, name: 'Anfänger' },
    { gruppen_id: 2, name: 'Fortgeschrittene' },
    { gruppen_id: 3, name: 'Experten' },
    { gruppen_id: 4, name: 'Kinder' },
    { gruppen_id: 5, name: 'Erwachsene' }
  ]);

  // Verwende Mock-Daten im Development, echte Daten in Production
  const stile = isDevelopment ? mockStile : stileFromContext;
  const gruppen = isDevelopment ? mockGruppen : gruppenFromContext;

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

    // 🔧 DEVELOPMENT MODE: Mock-Funktionalität
    if (isDevelopment) {
      if (typ === "stil") {
        const newId = Math.max(...mockStile.map(s => s.stil_id), 0) + 1;
        setMockStile([...mockStile, { stil_id: newId, name: wert.trim() }]);
        setNeuerStil("");
      } else {
        const newId = Math.max(...mockGruppen.map(g => g.gruppen_id), 0) + 1;
        setMockGruppen([...mockGruppen, { gruppen_id: newId, name: wert.trim() }]);
        setNeueGruppe("");
      }
      return;
    }

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
    console.log('🗑️ Löschen aufgerufen:', { id, typ, isDevelopment });

    if (!confirm(`Möchten Sie diesen ${typ === "stil" ? "Stil" : "diese Gruppe"} wirklich löschen?`)) {
      console.log('❌ Löschen abgebrochen durch Benutzer');
      return;
    }

    // 🔧 DEVELOPMENT MODE: Mock-Funktionalität
    if (isDevelopment) {
      console.log('🔧 Development Mode: Verwende Mock-Daten');
      if (typ === "stil") {
        console.log('📝 Vor Löschen:', mockStile.length);
        setMockStile(mockStile.filter(s => s.stil_id !== id));
        console.log('📝 Nach Löschen sollte es sein:', mockStile.filter(s => s.stil_id !== id).length);
      } else {
        console.log('📝 Vor Löschen:', mockGruppen.length);
        setMockGruppen(mockGruppen.filter(g => g.gruppen_id !== id));
        console.log('📝 Nach Löschen sollte es sein:', mockGruppen.filter(g => g.gruppen_id !== id).length);
      }
      return;
    }

    const endpoint = typ === "stil" ? `${config.apiBaseUrl}/stile` : `${config.apiBaseUrl}/gruppen`;

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

    // 🔧 DEVELOPMENT MODE: Mock-Funktionalität
    if (isDevelopment) {
      setMockStile(mockStile.map(s =>
        s.stil_id === stilId ? { ...s, name: editingStilName.trim() } : s
      ));
      abbrechenStil();
      return;
    }

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

    // 🔧 DEVELOPMENT MODE: Mock-Funktionalität
    if (isDevelopment) {
      setMockGruppen(mockGruppen.map(g =>
        g.gruppen_id === gruppeId ? { ...g, name: editingGruppeName.trim() } : g
      ));
      abbrechenGruppe();
      return;
    }

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

  const loescheAusgewaehlteStile = () => {
    if (selectedStile.length === 0) return;
    if (!confirm(`${selectedStile.length} Stile wirklich löschen?`)) return;

    if (isDevelopment) {
      setMockStile(mockStile.filter(s => !selectedStile.includes(s.stil_id)));
      setSelectedStile([]);
    }
  };

  const loescheAusgewaehlteGruppen = () => {
    if (selectedGruppen.length === 0) return;
    if (!confirm(`${selectedGruppen.length} Gruppen wirklich löschen?`)) return;

    if (isDevelopment) {
      setMockGruppen(mockGruppen.filter(g => !selectedGruppen.includes(g.gruppen_id)));
      setSelectedGruppen([]);
    }
  };

  // Position verschieben
  const moveStil = (index, direction) => {
    if (isDevelopment) {
      const newStile = [...mockStile];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newStile.length) return;
      [newStile[index], newStile[newIndex]] = [newStile[newIndex], newStile[index]];
      setMockStile(newStile);
    }
  };

  const moveGruppe = (index, direction) => {
    if (isDevelopment) {
      const newGruppen = [...mockGruppen];
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= newGruppen.length) return;
      [newGruppen[index], newGruppen[newIndex]] = [newGruppen[newIndex], newGruppen[index]];
      setMockGruppen(newGruppen);
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
            {stile.map((stil, index) => (
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
                      💾
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={abbrechenStil}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      type="checkbox"
                      checked={selectedStile.includes(stil.stil_id)}
                      onChange={() => {
                        setSelectedStile(prev =>
                          prev.includes(stil.stil_id)
                            ? prev.filter(id => id !== stil.stil_id)
                            : [...prev, stil.stil_id]
                        );
                      }}
                    />
                    <div className="sort-buttons">
                      <button
                        className="sort-btn"
                        onClick={() => moveStil(index, 'up')}
                        disabled={index === 0}
                      >
                        ▲
                      </button>
                      <button
                        className="sort-btn"
                        onClick={() => moveStil(index, 'down')}
                        disabled={index === stile.length - 1}
                      >
                        ▼
                      </button>
                    </div>
                    <span>{stil.name}</span>
                    <button
                      className="btn btn-primary"
                      onClick={() => bearbeitenStil(stil)}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => loeschen(stil.stil_id, "stil")}
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

          {/* Bulk Actions - moved to bottom */}
          {stile.length > 0 && (
            <div className="bulk-actions">
              <button className="btn btn-secondary" onClick={toggleAllStile}>
                {selectedStile.length === stile.length ? 'Alle abwählen' : 'Alle auswählen'}
              </button>
              {selectedStile.length > 0 && (
                <button className="btn btn-danger" onClick={loescheAusgewaehlteStile}>
                  {selectedStile.length} löschen
                </button>
              )}
            </div>
          )}
        </div>

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
