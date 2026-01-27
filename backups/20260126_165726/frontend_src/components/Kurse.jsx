import React, { useContext, useState, useMemo, useEffect } from "react";
import axios from "axios";
import config from '../config/config.js';
import "../styles/themes.css";       // Centralized theme system
import "../styles/components.css";   // Universal component styles
import "../styles/Kurse.css";
import { DatenContext } from "@shared/DatenContext.jsx";
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE
import { useStandortContext } from '../context/StandortContext.jsx'; // Multi-Location Support
import { fetchWithAuth } from '../utils/fetchWithAuth';


const Kurse = () => {
  const { kurse, trainer, stile, gruppen, ladeAlleDaten } = useContext(DatenContext); // <-- Fix hier
  const { getDojoFilterParam, activeDojo } = useDojoContext(); // 🔒 TAX COMPLIANCE: Dojo-Filter
  const { standorte, activeStandort, switchStandort, hasMultipleLocations } = useStandortContext(); // Multi-Location

  const [neuerKurs, setNeuerKurs] = useState({
    gruppenname: "",
    stil: "",
    trainer_ids: [],
    raum_id: ""
  });

  const [raeume, setRaeume] = useState([]);

  const [showNewTrainerForm, setShowNewTrainerForm] = useState(false);
  const [newTrainerData, setNewTrainerData] = useState({
    vorname: "",
    nachname: "",
    email: "",
    telefon: ""
  });
  
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  
  const [newStyleName, setNewStyleName] = useState("");
  const [showNewStyleInput, setShowNewStyleInput] = useState(false);
  
  const [newRoomData, setNewRoomData] = useState({
    name: "",
    beschreibung: "",
    groesse: "",
    kapazitaet: ""
  });
  const [showNewRoomForm, setShowNewRoomForm] = useState(false);
  
  // States für Stammdaten-Raumverwaltung
  const [showNewRoomFormStammdaten, setShowNewRoomFormStammdaten] = useState(false);
  const [newRoomDataStammdaten, setNewRoomDataStammdaten] = useState({
    name: "",
    beschreibung: "",
    groesse: "",
    kapazitaet: ""
  });

  // Räume laden
  useEffect(() => {
    loadRaeume();
  }, []);

  const loadRaeume = async () => {
    try {
      const response = await fetchWithAuth(`/raeume`);
      const result = await response.json();
      if (result.success) {
        setRaeume(result.data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Räume:', error);
    }
  };

  // Move functions for reordering
  const moveItem = (array, fromIndex, toIndex) => {
    const newArray = [...array];
    const item = newArray.splice(fromIndex, 1)[0];
    newArray.splice(toIndex, 0, item);
    return newArray;
  };
  
  const moveTrainerUp = (index) => {
    if (index > 0) {
      // In der echten Anwendung würde hier eine API-Anfrage gemacht
      alert(`Trainer "${trainer[index].vorname} ${trainer[index].nachname}" nach oben verschoben!`);
    } else {
    }
  };
  
  const moveTrainerDown = (index) => {
    if (index < trainer.length - 1) {
      alert(`Trainer "${trainer[index].vorname} ${trainer[index].nachname}" nach unten verschoben!`);
    }
  };
  
  const moveGroupUp = (index) => {
    if (index > 0) {
      alert(`Gruppe "${gruppen[index].name}" nach oben verschoben!`);
    }
  };
  
  const moveGroupDown = (index) => {
    if (index < gruppen.length - 1) {
      alert(`Gruppe "${gruppen[index].name}" nach unten verschoben!`);
    }
  };
  
  const moveStyleUp = (index) => {
    if (index > 0) {
      alert(`Stil "${stile[index].name}" nach oben verschoben!`);
    }
  };
  
  const moveStyleDown = (index) => {
    if (index < stile.length - 1) {
      alert(`Stil "${stile[index].name}" nach unten verschoben!`);
    }
  };
  
  // Tab System
  const [activeTab, setActiveTab] = useState("kurse"); // "kurse" oder "einstellungen"

  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({
    gruppenname: "",
    stil: "",
    trainer_ids: [],
    raum_id: ""
  });

  const [sortConfig, setSortConfig] = useState({ key: 'gruppenname', direction: 'asc' });
  const [filterStil, setFilterStil] = useState("");
  const [filterTrainer, setFilterTrainer] = useState("");

  // Kollaps-State für Stil-Gruppen (alle standardmäßig geöffnet)
  const [collapsedStile, setCollapsedStile] = useState({});

  const getTrainerName = (trainer_id) => {
    const t = trainer.find(t => t.trainer_id === Number(trainer_id));
    return t ? `${t.vorname} ${t.nachname}` : "Unbekannter Trainer";
  };

  const getTrainerNames = (trainer_ids) => {
    if (!trainer_ids || trainer_ids.length === 0) return "Keine Trainer";
    const names = trainer_ids.map(id => {
      const t = trainer.find(t => t.trainer_id === Number(id));
      return t ? `${t.vorname} ${t.nachname}` : "Unbekannt";
    });
    return names.join(", ");
  };

  const getRaumName = (raum_id) => {
    if (!raum_id) return "Kein Raum zugewiesen";
    const raum = raeume.find(r => r.id === Number(raum_id));
    return raum ? raum.name : "Unbekannter Raum";
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return "⇅";
    return sortConfig.direction === 'asc' ? "↑" : "↓";
  };

  // Toggle Stil-Gruppe
  const toggleStil = (stilName) => {
    setCollapsedStile(prev => ({
      ...prev,
      [stilName]: !prev[stilName]
    }));
  };

  // Gruppiere Kurse nach Stil
  const kurseByStil = useMemo(() => {
    const grouped = {};

    kurse
      .filter(k => !filterTrainer || k.trainer_id.toString() === filterTrainer)
      .filter(k => activeStandort === 'all' || !k.standort_id || k.standort_id === activeStandort)
      .forEach(kurs => {
        const stil = kurs.stil || 'Unbekannter Stil';
        if (!grouped[stil]) {
          grouped[stil] = [];
        }
        grouped[stil].push(kurs);
      });

    // Sortiere Kurse innerhalb jeder Gruppe basierend auf sortConfig
    Object.keys(grouped).forEach(stil => {
      grouped[stil].sort((a, b) => {
        if (!sortConfig.key) {
          // Standard: nach Gruppenname
          const aVal = a.gruppenname || '';
          const bVal = b.gruppenname || '';
          return aVal.localeCompare(bVal);
        }

        let aVal, bVal;

        // Spezielle Behandlung für Trainer (kann Array sein)
        if (sortConfig.key === 'trainer') {
          aVal = Array.isArray(a.trainer_ids) ? getTrainerNames(a.trainer_ids) : getTrainerName(a.trainer_id);
          bVal = Array.isArray(b.trainer_ids) ? getTrainerNames(b.trainer_ids) : getTrainerName(b.trainer_id);
        } else if (sortConfig.key === 'raum') {
          aVal = getRaumName(a.raum_id);
          bVal = getRaumName(b.raum_id);
        } else if (sortConfig.key === 'gruppenname') {
          aVal = a.gruppenname || '';
          bVal = b.gruppenname || '';
        } else {
          aVal = a[sortConfig.key]?.toString() || '';
          bVal = b[sortConfig.key]?.toString() || '';
        }

        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    });

    return grouped;
  }, [kurse, filterTrainer, sortConfig, activeStandort]);

  // Alte sortedKurse für Kompatibilität (wird nicht mehr verwendet)
  const sortedKurse = useMemo(() => {
    return [...kurse]
      .filter(k =>
        (!filterStil || k.stil === filterStil) &&
        (!filterTrainer || k.trainer_id.toString() === filterTrainer) &&
        (activeStandort === 'all' || !k.standort_id || k.standort_id === activeStandort)
      )
      .sort((a, b) => {
        if (!sortConfig.key) return 0;

        let aVal, bVal;

        // Spezielle Behandlung für Trainer (kann Array sein)
        if (sortConfig.key === 'trainer') {
          aVal = Array.isArray(a.trainer_ids) ? getTrainerNames(a.trainer_ids) : getTrainerName(a.trainer_id);
          bVal = Array.isArray(b.trainer_ids) ? getTrainerNames(b.trainer_ids) : getTrainerName(b.trainer_id);
        } else if (sortConfig.key === 'raum') {
          aVal = getRaumName(a.raum_id);
          bVal = getRaumName(b.raum_id);
        } else if (sortConfig.key === 'gruppenname') {
          aVal = a.gruppenname || '';
          bVal = b.gruppenname || '';
        } else {
          aVal = a[sortConfig.key]?.toString() || '';
          bVal = b[sortConfig.key]?.toString() || '';
        }

        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
  }, [kurse, filterStil, filterTrainer, sortConfig, activeStandort]);

  const handleCSVExport = () => {
    const csv = [
      ['Stil', 'Gruppe', 'Trainer'],
      ...kurse.map(k => [
        k.stil,
        k.gruppenname,
        getTrainerName(k.trainer_id)
      ])
    ].map(e => e.join(";")).join("\n");

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "kurse.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleHinzufuegen = async () => {
    if (!neuerKurs.gruppenname || !neuerKurs.stil || neuerKurs.trainer_ids.length === 0) {
      alert("Bitte Gruppenname, Stil und mindestens einen Trainer angeben.");
      return;
    }

    // 🔒 TAX COMPLIANCE: dojo_id ist PFLICHTFELD!
    if (!activeDojo) {
      alert("Fehler: Kein Dojo ausgewählt. Bitte wählen Sie ein Dojo aus.");
      return;
    }

    try {
      await axios.post(`/kurse`, {
        gruppenname: neuerKurs.gruppenname,
        stil: neuerKurs.stil,
        trainer_ids: neuerKurs.trainer_ids,
        raum_id: neuerKurs.raum_id || null,
        dojo_id: activeDojo.id // 🔒 TAX COMPLIANCE: Kurs muss Dojo zugeordnet sein
      });
      setNeuerKurs({ gruppenname: "", stil: "", trainer_ids: [], raum_id: "" });
      ladeAlleDaten(); // Aktualisiere zentral nach dem Hinzufügen
      alert("Kurs erfolgreich hinzugefügt!");
    } catch (err) {
      console.error("Fehler beim Hinzufügen:", err);
      console.error("Fehlerdetails:", err.response?.data);
      alert("Fehler beim Hinzufügen des Kurses: " + (err.response?.data?.error || err.message));
    }
  };

  const handleLoeschen = async (id) => {
    if (!window.confirm("Soll dieser Kurs wirklich gelöscht werden?")) return;

    try {
      // 🔒 TAX COMPLIANCE: Include dojo_id filter for permission check
      const dojoFilterParam = getDojoFilterParam();
      const url = dojoFilterParam
        ? `/kurse/${id}?${dojoFilterParam}`
        : `/kurse/${id}`;
      await axios.delete(url);
      ladeAlleDaten();
    } catch (err) {
      console.error("Fehler beim Löschen:", err);
      console.error("Fehlerdetails:", err.response?.data);
      alert("Fehler beim Löschen des Kurses: " + (err.response?.data?.error || err.message));
    }
  };

  const handleBearbeiten = (kurs) => {
    console.log('=== BEARBEITEN START ===');
    console.log('Kurs Daten:', kurs);
    setEditingId(kurs.kurs_id);
    const editData = {
      gruppenname: kurs.gruppenname,
      stil: kurs.stil,
      trainer_ids: Array.isArray(kurs.trainer_ids) ? kurs.trainer_ids : [kurs.trainer_id],
      raum_id: kurs.raum_id || ""
    };
    console.log('EditingData gesetzt auf:', editData);
    setEditingData(editData);
  };

  const handleSpeichern = async (id) => {
    console.log('=== SPEICHERN START ===');
    console.log('EditingData beim Speichern:', editingData);
    console.log('Gruppenname:', editingData.gruppenname);
    console.log('Stil:', editingData.stil);
    console.log('Trainer IDs:', editingData.trainer_ids);

    if (!editingData.gruppenname || !editingData.stil || editingData.trainer_ids.length === 0) {
      console.log('VALIDIERUNG FEHLGESCHLAGEN!');
      alert("Bitte Gruppenname, Stil und mindestens einen Trainer angeben.");
      return;
    }

    // 🔒 TAX COMPLIANCE: Include dojo_id filter for permission check
    const dojoFilterParam = getDojoFilterParam();
    const url = dojoFilterParam
      ? `/kurse/${id}?${dojoFilterParam}`
      : `/kurse/${id}`;

    try {
      await axios.put(url, {
        gruppenname: editingData.gruppenname,
        stil: editingData.stil,
        trainer_ids: editingData.trainer_ids,
        raum_id: editingData.raum_id || null
      });
      setEditingId(null);
      ladeAlleDaten();
    } catch (err) {
      console.error("Fehler beim Speichern:", err);
      console.error("Fehlerdetails:", err.response?.data);
      alert("Fehler beim Speichern des Kurses: " + (err.response?.data?.error || err.message));
    }
  };

  const handleAbbrechen = () => setEditingId(null);

  const handleNewTrainer = async () => {
    if (!newTrainerData.vorname || !newTrainerData.nachname) {
      alert("Bitte Vor- und Nachname eingeben.");
      return;
    }

    try {
      // Trainer ohne Stile erstellen - Stile werden später beim Kurs zugeordnet
      const response = await axios.post(`/trainer`, {
        vorname: newTrainerData.vorname,
        nachname: newTrainerData.nachname,
        email: newTrainerData.email || "",
        telefon: newTrainerData.telefon || ""
        // Keine Stile - werden beim Kurs-Erstellen zugeordnet
      });

      // Form zurücksetzen OHNE automatische Auswahl
      setNewTrainerData({ vorname: "", nachname: "", email: "", telefon: "" });
      setShowNewTrainerForm(false);

      // Daten neu laden
      ladeAlleDaten();
      alert("Trainer erfolgreich hinzugefügt!");
    } catch (err) {
      console.error("Fehler beim Hinzufügen des Trainers:", err);
      alert("Fehler beim Hinzufügen des Trainers: " + (err.response?.data?.error || err.message));
    }
  };

  const handleNewGroup = async () => {
    if (!newGroupName.trim()) {
      alert("Bitte Gruppennamen eingeben.");
      return;
    }

    try {
      await axios.post(`/gruppen`, {
        name: newGroupName.trim()
      });

      // Form zurücksetzen OHNE automatisches Auswählen
      setNewGroupName("");
      setShowNewGroupInput(false);

      // Daten neu laden
      ladeAlleDaten();
      alert("Gruppe erfolgreich hinzugefügt!");
    } catch (err) {
      console.error("Fehler beim Hinzufügen der Gruppe:", err);
      alert("Fehler beim Hinzufügen der Gruppe: " + (err.response?.data?.error || err.message));
    }
  };

  const handleNewStyle = async () => {
    if (!newStyleName.trim()) {
      alert("Bitte Stil-Namen eingeben.");
      return;
    }

    try {
      await axios.post(`/stile`, {
        name: newStyleName.trim()
      });

      // Form zurücksetzen
      setNewStyleName("");
      setShowNewStyleInput(false);

      // Daten neu laden
      ladeAlleDaten();
      alert("Stil erfolgreich hinzugefügt!");
    } catch (err) {
      console.error("Fehler beim Hinzufügen des Stils:", err);
      alert("Fehler beim Hinzufügen des Stils: " + (err.response?.data?.error || err.message));
    }
  };

  // Gemeinsame Funktion zum Hinzufügen von Räumen (für beide Bereiche)
  const handleNewRoom = async (roomData, isStammdaten = false) => {
    if (!roomData.name.trim()) {
      alert("Bitte Raum-Name eingeben.");
      return;
    }

    try {
      await axios.post(`/raeume`, {
        name: roomData.name.trim(),
        beschreibung: roomData.beschreibung.trim(),
        groesse: roomData.groesse.trim() || null,
        kapazitaet: roomData.kapazitaet.trim() || null
      });

      // Form zurücksetzen (je nach Bereich)
      if (isStammdaten) {
        setNewRoomDataStammdaten({
          name: "",
          beschreibung: "",
          groesse: "",
          kapazitaet: ""
        });
        setShowNewRoomFormStammdaten(false);
      } else {
        setNewRoomData({
          name: "",
          beschreibung: "",
          groesse: "",
          kapazitaet: ""
        });
        setShowNewRoomForm(false);
      }

      // Räume neu laden
      loadRaeume();
      alert("Raum erfolgreich hinzugefügt!");
    } catch (err) {
      console.error("Fehler beim Hinzufügen des Raums:", err);
      alert("Fehler beim Hinzufügen des Raums: " + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="kurse-container-modern">
      <div className="kurse-header" style={{ marginBottom: '0.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>🥋 Kurs-Management</h2>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation" style={{ marginBottom: '0.5rem' }}>
        <button 
          className={`tab-button ${activeTab === "kurse" ? "active" : ""}`}
          onClick={() => setActiveTab("kurse")}
        >
          📋 Kurse verwalten
        </button>
        <button 
          className={`tab-button ${activeTab === "einstellungen" ? "active" : ""}`}
          onClick={() => setActiveTab("einstellungen")}
        >
          ⚙️ Stammdaten-Einstellungen
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "kurse" && renderKurseTab()}
      {activeTab === "einstellungen" && renderEinstellungenTab()}
    </div>
  );

  function renderKurseTab() {
    return (
      <>
        {/* Sortierung innerhalb der Stil-Gruppen */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}>
          <span style={{ color: '#ffffff', fontWeight: 600, marginRight: '0.5rem' }}>
            📊 Kurse sortieren nach:
          </span>
          <button
            onClick={() => handleSort('gruppenname')}
            style={{
              padding: '0.5rem 1rem',
              background: sortConfig.key === 'gruppenname' ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              border: sortConfig.key === 'gruppenname' ? '2px solid rgba(255, 215, 0, 0.6)' : '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            🏷️ Gruppe {sortConfig.key === 'gruppenname' && getSortIcon('gruppenname')}
          </button>
          <button
            onClick={() => handleSort('raum')}
            style={{
              padding: '0.5rem 1rem',
              background: sortConfig.key === 'raum' ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              border: sortConfig.key === 'raum' ? '2px solid rgba(255, 215, 0, 0.6)' : '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            🏛️ Raum {sortConfig.key === 'raum' && getSortIcon('raum')}
          </button>
          <button
            onClick={() => handleSort('trainer')}
            style={{
              padding: '0.5rem 1rem',
              background: sortConfig.key === 'trainer' ? 'rgba(255, 215, 0, 0.3)' : 'rgba(255, 255, 255, 0.1)',
              border: sortConfig.key === 'trainer' ? '2px solid rgba(255, 215, 0, 0.6)' : '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: '8px',
              color: '#ffffff',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
          >
            👨‍🏫 Trainer {sortConfig.key === 'trainer' && getSortIcon('trainer')}
          </button>
        </div>

        {/* Filter + Export */}
        <div className="kurse-controls">
          <div className="kurse-filters">
            <div className="filter-group">
              <label>👨‍🏫 Trainer filtern:</label>
              <select
                className="filter-select"
                onChange={e => setFilterTrainer(e.target.value)}
                value={filterTrainer}
              >
                <option value="">Alle Trainer anzeigen</option>
                {trainer.map(t => (
                  <option key={t.trainer_id} value={t.trainer_id}>
                    {t.vorname} {t.nachname}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="export-button-modern" onClick={handleCSVExport}>
            📊 CSV Export
          </button>
        </div>

        {/* Statistiken */}
        <div className="kurse-stats" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: '0.5rem',
          marginBottom: '0.5rem',
          marginTop: '0.2rem'
        }}>
          <div 
            className="stat-card"
            style={{
              padding: '0.5rem',
              borderRadius: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              textAlign: 'center',
              minHeight: '78px', // 30% höher (60px * 1.3 = 78px)
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 215, 0, 0.2)'
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.5rem',
              marginBottom: '0.1rem'
            }}>
              <span style={{ fontSize: '1.2rem' }}>🥋</span>
              <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#1f2937' }}>
                {kurse.length}
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Kurse insgesamt
            </div>
          </div>
          <div 
            className="stat-card"
            style={{
              padding: '0.5rem',
              borderRadius: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              textAlign: 'center',
              minHeight: '78px', // 30% höher
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 215, 0, 0.2)'
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.3rem',
              marginBottom: '0.05rem'
            }}>
              <span style={{ fontSize: '1rem' }}>🎯</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffffff' }}>
                {sortedKurse.length}
              </span>
            </div>
            <div style={{ fontSize: '0.6rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Gefilterte Ergebnisse
            </div>
          </div>
          <div 
            className="stat-card"
            style={{
              padding: '0.5rem',
              borderRadius: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              textAlign: 'center',
              minHeight: '78px', // 30% höher
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 215, 0, 0.2)'
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.3rem',
              marginBottom: '0.05rem'
            }}>
              <span style={{ fontSize: '1rem' }}>👥</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffffff' }}>
                {new Set(kurse.map(k => k.trainer_id)).size}
              </span>
            </div>
            <div style={{ fontSize: '0.6rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Aktive Trainer
            </div>
          </div>
          <div 
            className="stat-card"
            style={{
              padding: '0.5rem',
              borderRadius: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              textAlign: 'center',
              minHeight: '78px', // 30% höher
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 215, 0, 0.2)'
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.3rem',
              marginBottom: '0.05rem'
            }}>
              <span style={{ fontSize: '1rem' }}>🏠</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffffff' }}>
                {new Set(kurse.map(k => k.raum_id)).size || 0}
              </span>
            </div>
            <div style={{ fontSize: '0.6rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Räume
            </div>
          </div>
          <div 
            className="stat-card"
            style={{
              padding: '0.5rem',
              borderRadius: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              textAlign: 'center',
              minHeight: '78px', // 30% höher
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 215, 0, 0.2)'
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.3rem',
              marginBottom: '0.05rem'
            }}>
              <span style={{ fontSize: '1rem' }}>👶</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffffff' }}>
                {kurse.filter(k => k.gruppe && k.gruppe.toLowerCase().includes('kind')).length}
              </span>
            </div>
            <div style={{ fontSize: '0.6rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Kinder Kurse
            </div>
          </div>
          <div 
            className="stat-card"
            style={{
              padding: '0.5rem',
              borderRadius: '6px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
              textAlign: 'center',
              minHeight: '78px', // 30% höher
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 215, 0, 0.2)'
            }}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.3rem',
              marginBottom: '0.05rem'
            }}>
              <span style={{ fontSize: '1rem' }}>👨‍💼</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ffffff' }}>
                {kurse.filter(k => k.gruppe && !k.gruppe.toLowerCase().includes('kind')).length}
              </span>
            </div>
            <div style={{ fontSize: '0.6rem', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Erwachsene Kurse
            </div>
          </div>
        </div>

        {/* Kursliste gruppiert nach Stil */}
        <div className="kurse-by-stil">
          {Object.keys(kurseByStil).length > 0 ? (
            Object.keys(kurseByStil).sort().map((stilName, stilIndex) => (
              <div key={stilName} className="stil-section" style={{ marginBottom: '2rem' }}>
                {/* Stil-Header mit Dropdown */}
                <h2
                  className="stil-header"
                  onClick={() => toggleStil(stilName)}
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem 1.5rem',
                    background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1))',
                    border: '2px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '12px',
                    marginBottom: '1rem',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.15))';
                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1))';
                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.3)';
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>🥋</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#ffffff', textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)' }}>
                      {stilName}
                    </span>
                    <span style={{
                      fontSize: '0.9rem',
                      color: 'rgba(255, 255, 255, 0.7)',
                      background: 'rgba(255, 255, 255, 0.1)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontWeight: 600
                    }}>
                      {kurseByStil[stilName].length} {kurseByStil[stilName].length === 1 ? 'Kurs' : 'Kurse'}
                    </span>
                  </span>
                  <span style={{
                    transform: collapsedStile[stilName] ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s ease',
                    fontSize: '1.2rem',
                    color: '#ffffff'
                  }}>
                    ▼
                  </span>
                </h2>

                {/* Kurse dieser Stil-Gruppe */}
                {!collapsedStile[stilName] && (
                  <div className="kurse-grid" style={{ animationDelay: `${stilIndex * 0.1}s` }}>
                    {kurseByStil[stilName].map((kurs, index) => (
              <div key={kurs.kurs_id} className="kurs-card" style={{animationDelay: `${index * 0.1}s`}}>
                <div className="kurs-card-header">
                  <div className="kurs-stil-badge">
                    {editingId === kurs.kurs_id ? (
                      <input
                        type="text"
                        className="edit-header-input"
                        value={editingData.stil}
                        onChange={(e) => setEditingData({ ...editingData, stil: e.target.value })}
                        placeholder="Stil eingeben"
                      />
                    ) : (
                      kurs.stil
                    )}
                  </div>
                  <div className="kurs-actions">
                    {editingId === kurs.kurs_id ? (
                      <>
                        <button 
                          className="action-btn save-btn" 
                          onClick={() => handleSpeichern(kurs.kurs_id)}
                          title="Änderungen speichern"
                        >
                          ✅
                        </button>
                        <button 
                          className="action-btn cancel-btn" 
                          onClick={handleAbbrechen}
                          title="Bearbeitung abbrechen"
                        >
                          ❌
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          className="action-btn edit-btn" 
                          onClick={() => handleBearbeiten(kurs)}
                          title="Kurs bearbeiten"
                        >
                          ✏️
                        </button>
                        <button 
                          className="action-btn delete-btn" 
                          onClick={() => handleLoeschen(kurs.kurs_id)}
                          title="Kurs löschen"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Standort Badge */}
                {hasMultipleLocations && kurs.standort_name && (
                  <div
                    className="kurs-standort-badge"
                    style={{
                      background: kurs.standort_farbe || '#4F46E5',
                      color: 'white',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '6px',
                      marginTop: '8px',
                      marginBottom: '4px'
                    }}
                  >
                    <span style={{ fontSize: '0.9rem' }}>📍</span>
                    <span>{kurs.standort_name}</span>
                  </div>
                )}

                <div className="kurs-card-content">
                  <div className="kurs-info-left">
                    <div className="kurs-field">
                      <label>🥋 Stil:</label>
                      {editingId === kurs.kurs_id ? (
                        <input
                          type="text"
                          className="edit-input"
                          value={editingData.stil}
                          onChange={(e) => setEditingData({ ...editingData, stil: e.target.value })}
                          placeholder="Stil eingeben"
                        />
                      ) : (
                        <span className="kurs-value">{kurs.stil}</span>
                      )}
                    </div>

                    <div className="kurs-field">
                      <label>🏷️ Gruppe:</label>
                      {editingId === kurs.kurs_id ? (
                        <select
                          className="edit-select"
                          value={editingData.gruppenname}
                          onChange={(e) => setEditingData({ ...editingData, gruppenname: e.target.value })}
                        >
                          <option value="">Gruppe auswählen...</option>
                          {gruppen.map((gruppe) => (
                            <option key={gruppe.gruppen_id} value={gruppe.name}>{gruppe.name}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="kurs-value gruppe">{kurs.gruppenname || "Keine Gruppe"}</span>
                      )}
                    </div>

                    <div className="kurs-field">
                      <label>🏛️ Raum:</label>
                      {editingId === kurs.kurs_id ? (
                        <select
                          className="edit-select"
                          value={editingData.raum_id || ""}
                          onChange={(e) => setEditingData({ ...editingData, raum_id: e.target.value })}
                        >
                          <option value="">Kein Raum zugewiesen</option>
                          {raeume.map(raum => (
                            <option key={raum.id} value={raum.id}>
                              {raum.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="kurs-value">
                          {getRaumName(kurs.raum_id)}
                        </span>
                      )}
                    </div>

                    <div className="kurs-field">
                      <label>👨‍🏫 Trainer:</label>
                      {editingId === kurs.kurs_id ? (
                        <div className="trainer-multiselect">
                          {trainer.map(tr => (
                            <label key={tr.trainer_id} className="trainer-checkbox-label">
                              <input
                                type="checkbox"
                                checked={editingData.trainer_ids.includes(tr.trainer_id)}
                                onChange={(e) => {
                                  const newIds = e.target.checked
                                    ? [...editingData.trainer_ids, tr.trainer_id]
                                    : editingData.trainer_ids.filter(id => id !== tr.trainer_id);
                                  setEditingData({ ...editingData, trainer_ids: newIds });
                                }}
                              />
                              <span className="trainer-checkbox-name">{tr.vorname} {tr.nachname}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="kurs-value trainer-names">
                          {Array.isArray(kurs.trainer_ids) ? getTrainerNames(kurs.trainer_ids) : getTrainerName(kurs.trainer_id)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="no-kurse-message">
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>Keine Kurse gefunden</h3>
                <p>Mit den aktuellen Filtern wurden keine Kurse gefunden.</p>
              </div>
            </div>
          )}
        </div>

        {/* Vereinfachtes Formular für neuen Kurs */}
        <div className="neuer-kurs-card" style={{animationDelay: `${sortedKurse.length * 0.1 + 0.3}s`}}>
          <div className="card-header">
            <h3>➕ Neuen Kurs erstellen</h3>
          </div>
          <div className="kurs-form-modern">
            <div className="kurs-form-left">
              <div className="form-group">
                <label>🥋 Kampfkunst-Stil:</label>
                <select
                  className="form-select"
                  value={neuerKurs.stil}
                  onChange={(e) => setNeuerKurs({ ...neuerKurs, stil: e.target.value })}
                >
                  <option value="">Stil auswählen...</option>
                  {stile.filter(stil => stil.aktiv !== 0).map((stil) => (
                    <option key={stil.stil_id} value={stil.name}>{stil.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>🏷️ Gruppe:</label>
                <select 
                  className="form-select"
                  value={neuerKurs.gruppenname} 
                  onChange={(e) => setNeuerKurs({ ...neuerKurs, gruppenname: e.target.value })}
                >
                  <option value="">Gruppe auswählen...</option>
                  {gruppen.map((gruppe) => (
                    <option key={gruppe.gruppen_id} value={gruppe.name}>{gruppe.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>🏛️ Raum:</label>
                <select
                  className="form-select"
                  value={neuerKurs.raum_id || ""}
                  onChange={(e) => setNeuerKurs({ ...neuerKurs, raum_id: e.target.value })}
                >
                  <option value="">Kein Raum zuweisen</option>
                  {raeume.map((raum) => (
                    <option key={raum.id} value={raum.id}>{raum.name}</option>
                  ))}
                </select>
                
                {/* Neuen Raum hinzufügen Button */}
                {!showNewRoomForm && (
                  <button 
                    type="button"
                    className="add-new-btn"
                    onClick={() => setShowNewRoomForm(true)}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.8rem',
                      background: 'rgba(255, 215, 0, 0.2)',
                      border: '1px solid rgba(255, 215, 0, 0.5)',
                      borderRadius: '6px',
                      color: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    ➕ Neuen Raum hinzufügen
                  </button>
                )}
                
                {/* Formular für neuen Raum */}
                {showNewRoomForm && (
                  <div className="new-room-form" style={{
                    marginTop: '0.5rem',
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px'
                  }}>
                    <h4 style={{ color: '#ffffff', marginBottom: '0.8rem', fontSize: '0.9rem' }}>
                      🏠 Neuen Raum erstellen
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input
                        type="text"
                        placeholder="Raum-Name (z.B. Hauptraum)"
                        value={newRoomData.name}
                        onChange={(e) => setNewRoomData({ ...newRoomData, name: e.target.value })}
                        style={{
                          padding: '0.4rem',
                          background: 'rgba(255, 255, 255, 0.15)',
                          border: '1px solid rgba(255, 215, 0, 0.4)',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '0.9rem'
                        }}
                      />
                      
                      <input
                        type="text"
                        placeholder="Beschreibung (optional)"
                        value={newRoomData.beschreibung}
                        onChange={(e) => setNewRoomData({ ...newRoomData, beschreibung: e.target.value })}
                        style={{
                          padding: '0.4rem',
                          background: 'rgba(255, 255, 255, 0.15)',
                          border: '1px solid rgba(255, 215, 0, 0.4)',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '0.9rem'
                        }}
                      />
                      
                      <input
                        type="text"
                        placeholder="Größe (optional, z.B. 50m²)"
                        value={newRoomData.groesse}
                        onChange={(e) => setNewRoomData({ ...newRoomData, groesse: e.target.value })}
                        style={{
                          padding: '0.4rem',
                          background: 'rgba(255, 255, 255, 0.15)',
                          border: '1px solid rgba(255, 215, 0, 0.4)',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '0.9rem'
                        }}
                      />
                      
                      <input
                        type="number"
                        placeholder="Kapazität (optional)"
                        value={newRoomData.kapazitaet}
                        onChange={(e) => setNewRoomData({ ...newRoomData, kapazitaet: e.target.value })}
                        style={{
                          padding: '0.4rem',
                          background: 'rgba(255, 255, 255, 0.15)',
                          border: '1px solid rgba(255, 215, 0, 0.4)',
                          borderRadius: '4px',
                          color: '#ffffff',
                          fontSize: '0.9rem'
                        }}
                      />
                      
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button
                          type="button"
                          onClick={() => handleNewRoom(newRoomData, false)}
                          style={{
                            padding: '0.4rem 0.8rem',
                            background: 'rgba(0, 255, 0, 0.3)',
                            border: '1px solid rgba(0, 255, 0, 0.5)',
                            borderRadius: '4px',
                            color: '#ffffff',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          ✅ Hinzufügen
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewRoomForm(false);
                            setNewRoomData({ name: "", beschreibung: "", groesse: "", kapazitaet: "" });
                          }}
                          style={{
                            padding: '0.4rem 0.8rem',
                            background: 'rgba(255, 0, 0, 0.3)',
                            border: '1px solid rgba(255, 0, 0, 0.5)',
                            borderRadius: '4px',
                            color: '#ffffff',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          ❌ Abbrechen
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>👨‍🏫 Trainer:</label>
                <div className="trainer-multiselect">
                  {trainer.map(tr => (
                    <label key={tr.trainer_id} className="trainer-checkbox-label">
                      <input
                        type="checkbox"
                        checked={neuerKurs.trainer_ids.includes(tr.trainer_id)}
                        onChange={(e) => {
                          const newIds = e.target.checked
                            ? [...neuerKurs.trainer_ids, tr.trainer_id]
                            : neuerKurs.trainer_ids.filter(id => id !== tr.trainer_id);
                          setNeuerKurs({ ...neuerKurs, trainer_ids: newIds });
                        }}
                      />
                      <span className="trainer-checkbox-name">{tr.vorname} {tr.nachname}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button className="add-button-modern" onClick={handleHinzufuegen}>
                <span className="btn-icon">➕</span>
                Kurs erstellen
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  function renderEinstellungenTab() {
    return (
      <div className="einstellungen-content">
        <div className="einstellungen-grid">
          
          {/* Trainer verwalten */}
          <div className="einstellungen-card" style={{animationDelay: "0.1s"}}>
            <div className="card-header">
              <h3>👨‍🏫 Trainer verwalten</h3>
            </div>
            <div className="card-content">
              <div className="current-list">
                <h4>Vorhandene Trainer:</h4>
                <div className="items-list">
                  {trainer.map((tr, index) => (
                    <div key={tr.trainer_id} className="list-item">
                      <div className="item-move-controls">
                        <button 
                          className="move-up-btn" 
                          title="Nach oben"
                          disabled={index === 0}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            moveTrainerUp(index);
                          }}
                        >↑</button>
                        <button 
                          className="move-down-btn" 
                          title="Nach unten"
                          disabled={index === trainer.length - 1}
                          onClick={() => moveTrainerDown(index)}
                        >↓</button>
                      </div>
                      <span>{tr.vorname} {tr.nachname}</span>
                      <div className="item-actions">
                        <button className="edit-item-btn" title="Bearbeiten">✏️</button>
                        <button className="delete-item-btn" title="Löschen">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="new-item-form">
                <h4>🆕 Neuen Trainer hinzufügen:</h4>
                {showNewTrainerForm ? (
                  <>
                    <div className="trainer-form-grid">
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Vorname *"
                        value={newTrainerData.vorname}
                        onChange={(e) => setNewTrainerData({...newTrainerData, vorname: e.target.value})}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Nachname *"
                        value={newTrainerData.nachname}
                        onChange={(e) => setNewTrainerData({...newTrainerData, nachname: e.target.value})}
                      />
                      <input
                        type="email"
                        className="form-input"
                        placeholder="E-Mail (optional)"
                        value={newTrainerData.email}
                        onChange={(e) => setNewTrainerData({...newTrainerData, email: e.target.value})}
                      />
                      <input
                        type="tel"
                        className="form-input"
                        placeholder="Telefon (optional)"
                        value={newTrainerData.telefon}
                        onChange={(e) => setNewTrainerData({...newTrainerData, telefon: e.target.value})}
                      />
                    </div>
                    <div className="trainer-form-actions">
                      <button
                        className="confirm-trainer-btn"
                        onClick={handleNewTrainer}
                      >
                        ✅ Trainer hinzufügen
                      </button>
                      <button
                        className="cancel-btn-small"
                        style={{marginLeft: '1rem', padding: '14px 28px', fontSize: '1.1rem'}}
                        onClick={() => {
                          setShowNewTrainerForm(false);
                          setNewTrainerData({ vorname: "", nachname: "", email: "", telefon: "" });
                        }}
                      >
                        ❌ Abbrechen
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className="add-new-btn"
                    onClick={() => setShowNewTrainerForm(true)}
                  >
                    ➕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Gruppen verwalten */}
          <div className="einstellungen-card" style={{animationDelay: "0.2s"}}>
            <div className="card-header">
              <h3>🏷️ Gruppen verwalten</h3>
            </div>
            <div className="card-content">
              <div className="current-list">
                <h4>Vorhandene Gruppen:</h4>
                <div className="items-list">
                  {gruppen.map((gr, index) => (
                    <div key={gr.gruppen_id} className="list-item">
                      <div className="item-move-controls">
                        <button 
                          className="move-up-btn" 
                          title="Nach oben"
                          disabled={index === 0}
                          onClick={() => moveGroupUp(index)}
                        >↑</button>
                        <button 
                          className="move-down-btn" 
                          title="Nach unten"
                          disabled={index === gruppen.length - 1}
                          onClick={() => moveGroupDown(index)}
                        >↓</button>
                      </div>
                      <span>{gr.name}</span>
                      <div className="item-actions">
                        <button className="edit-item-btn" title="Bearbeiten">✏️</button>
                        <button className="delete-item-btn" title="Löschen">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="new-item-form">
                <h4>🆕 Neue Gruppe hinzufügen:</h4>
                {showNewGroupInput ? (
                  <div className="simple-form">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Gruppenname eingeben"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleNewGroup()}
                    />
                    <div className="input-buttons">
                      <button className="add-btn-small" onClick={handleNewGroup}>✅</button>
                      <button className="cancel-btn-small" onClick={() => {setShowNewGroupInput(false); setNewGroupName("");}}>❌</button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="add-new-btn"
                    onClick={() => setShowNewGroupInput(true)}
                  >
                    ➕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stile verwalten */}
          <div className="einstellungen-card" style={{animationDelay: "0.3s"}}>
            <div className="card-header">
              <h3>🥋 Stile verwalten</h3>
            </div>
            <div className="card-content">
              <div className="current-list">
                <h4>Vorhandene Stile:</h4>
                <div className="items-list">
                  {stile.map((s, index) => (
                    <div key={s.stil_id} className="list-item">
                      <div className="item-move-controls">
                        <button 
                          className="move-up-btn" 
                          title="Nach oben"
                          disabled={index === 0}
                          onClick={() => moveStyleUp(index)}
                        >↑</button>
                        <button 
                          className="move-down-btn" 
                          title="Nach unten"
                          disabled={index === stile.length - 1}
                          onClick={() => moveStyleDown(index)}
                        >↓</button>
                      </div>
                      <span>{s.name}</span>
                      <div className="item-actions">
                        <button className="edit-item-btn" title="Bearbeiten">✏️</button>
                        <button className="delete-item-btn" title="Löschen">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="new-item-form">
                <h4>🆕 Neuen Stil hinzufügen:</h4>
                {showNewStyleInput ? (
                  <div className="simple-form">
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Stil-Name eingeben (z.B. BJJ, Karate)"
                      value={newStyleName}
                      onChange={(e) => setNewStyleName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleNewStyle()}
                    />
                    <div className="input-buttons">
                      <button className="add-btn-small" onClick={handleNewStyle}>✅</button>
                      <button className="cancel-btn-small" onClick={() => {setShowNewStyleInput(false); setNewStyleName("");}}>❌</button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="add-new-btn"
                    onClick={() => setShowNewStyleInput(true)}
                  >
                    ➕
                  </button>
                )}
              </div>
              
              <div className="info-box">
                <p>ℹ️ <strong>Hinweis:</strong> Hier können Sie Stile verwalten und beim Kurs-Erstellen aus den vorhandenen auswählen oder neue eingeben.</p>
              </div>
            </div>
          </div>

          {/* Räume verwalten */}
          <div className="einstellungen-card" style={{animationDelay: "0.4s"}}>
            <div className="card-header">
              <h3>🏛️ Räume verwalten</h3>
            </div>
            <div className="card-content">
              <div className="current-list">
                <h4>Vorhandene Räume:</h4>
                <div className="items-list">
                  {raeume.map((raum, index) => (
                    <div key={raum.raum_id} className="list-item">
                      <div className="item-move-controls">
                        <button 
                          className="move-up-btn" 
                          title="Nach oben"
                          disabled={index === 0}
                          onClick={() => {/* TODO: Implementieren */}}
                        >↑</button>
                        <button 
                          className="move-down-btn" 
                          title="Nach unten"
                          disabled={index === raeume.length - 1}
                          onClick={() => {/* TODO: Implementieren */}}
                        >↓</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 'bold' }}>{raum.name}</span>
                        {raum.beschreibung && (
                          <span style={{ fontSize: '0.8rem', color: '#ccc', marginTop: '0.2rem' }}>
                            {raum.beschreibung}
                          </span>
                        )}
                        {(raum.groesse || raum.kapazitaet) && (
                          <span style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.1rem' }}>
                            {raum.groesse && `${raum.groesse}`}
                            {raum.groesse && raum.kapazitaet && ' • '}
                            {raum.kapazitaet && `${raum.kapazitaet} Personen`}
                          </span>
                        )}
                      </div>
                      <div className="item-actions">
                        <button className="edit-item-btn" title="Bearbeiten">✏️</button>
                        <button className="delete-item-btn" title="Löschen">🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="new-item-form">
                <h4>🆕 Neuen Raum hinzufügen:</h4>
                {showNewRoomFormStammdaten ? (
                  <div className="room-form-stammdaten" style={{
                    padding: '1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    marginTop: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Raum-Name (z.B. Hauptraum)"
                        value={newRoomDataStammdaten.name}
                        onChange={(e) => setNewRoomDataStammdaten({ ...newRoomDataStammdaten, name: e.target.value })}
                      />
                      
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Beschreibung (optional)"
                        value={newRoomDataStammdaten.beschreibung}
                        onChange={(e) => setNewRoomDataStammdaten({ ...newRoomDataStammdaten, beschreibung: e.target.value })}
                      />
                      
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Größe (optional, z.B. 50m²)"
                        value={newRoomDataStammdaten.groesse}
                        onChange={(e) => setNewRoomDataStammdaten({ ...newRoomDataStammdaten, groesse: e.target.value })}
                      />
                      
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Kapazität (optional)"
                        value={newRoomDataStammdaten.kapazitaet}
                        onChange={(e) => setNewRoomDataStammdaten({ ...newRoomDataStammdaten, kapazitaet: e.target.value })}
                      />
                      
                      <div className="input-buttons" style={{ marginTop: '0.5rem' }}>
                        <button 
                          className="add-btn-small" 
                          onClick={() => handleNewRoom(newRoomDataStammdaten, true)}
                        >
                          ✅
                        </button>
                        <button 
                          className="cancel-btn-small" 
                          onClick={() => {
                            setShowNewRoomFormStammdaten(false);
                            setNewRoomDataStammdaten({ name: "", beschreibung: "", groesse: "", kapazitaet: "" });
                          }}
                        >
                          ❌
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    className="add-new-btn"
                    onClick={() => setShowNewRoomFormStammdaten(true)}
                  >
                    ➕
                  </button>
                )}
              </div>
              
              <div className="info-box">
                <p>ℹ️ <strong>Hinweis:</strong> Hier können Sie Räume verwalten und beim Kurs-Erstellen aus den vorhandenen auswählen oder neue eingeben.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

};

export default Kurse;
