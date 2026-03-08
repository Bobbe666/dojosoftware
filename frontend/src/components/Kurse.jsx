import React, { useContext, useState, useMemo, useEffect } from "react";
import axios from "axios";
import { useTranslation } from 'react-i18next';
import config from '../config/config.js';
import "../styles/themes.css";       // Centralized theme system
import "../styles/components.css";   // Universal component styles
import "../styles/Kurse.css";
import { DatenContext } from "@shared/DatenContext.jsx";
import { useDojoContext } from '../context/DojoContext.jsx'; // 🔒 TAX COMPLIANCE
import { useStandortContext } from '../context/StandortContext.jsx'; // Multi-Location Support
import { fetchWithAuth } from '../utils/fetchWithAuth';


const Kurse = () => {
  const { t } = useTranslation(['courses', 'common']);
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
      <div className="kurse-header ku-header">
        <h2 className="ku-header-title">🥋 {t('management.title')}</h2>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation ku-tab-nav">
        <button
          className={`tab-button ${activeTab === "kurse" ? "active" : ""}`}
          onClick={() => setActiveTab("kurse")}
        >
          📋 {t('management.tabs.courses')}
        </button>
        <button
          className={`tab-button ${activeTab === "einstellungen" ? "active" : ""}`}
          onClick={() => setActiveTab("einstellungen")}
        >
          ⚙️ {t('management.tabs.settings')}
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
        <div className="ku-sort-row">
          <span className="ku-sort-label">
            📊 {t('management.sortBy')}
          </span>
          <button
            onClick={() => handleSort('gruppenname')}
            className={`ku-sort-btn ${sortConfig.key === 'gruppenname' ? 'active' : ''}`}
          >
            🏷️ {t('management.sortGroup')} {sortConfig.key === 'gruppenname' && getSortIcon('gruppenname')}
          </button>
          <button
            onClick={() => handleSort('raum')}
            className={`ku-sort-btn ${sortConfig.key === 'raum' ? 'active' : ''}`}
          >
            🏛️ {t('management.sortRoom')} {sortConfig.key === 'raum' && getSortIcon('raum')}
          </button>
          <button
            onClick={() => handleSort('trainer')}
            className={`ku-sort-btn ${sortConfig.key === 'trainer' ? 'active' : ''}`}
          >
            👨‍🏫 {t('management.sortTrainer')} {sortConfig.key === 'trainer' && getSortIcon('trainer')}
          </button>
        </div>

        {/* Filter + Export */}
        <div className="kurse-controls">
          <div className="kurse-filters">
            <div className="filter-group">
              <label>👨‍🏫 {t('management.filterTrainer')}</label>
              <select
                className="filter-select"
                onChange={e => setFilterTrainer(e.target.value)}
                value={filterTrainer}
              >
                <option value="">{t('management.allTrainers')}</option>
                {trainer.map(tr => (
                  <option key={tr.trainer_id} value={tr.trainer_id}>
                    {tr.vorname} {tr.nachname}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="export-button-modern" onClick={handleCSVExport}>
            📊 {t('management.csvExport')}
          </button>
        </div>

        {/* Statistiken */}
        <div className="kurse-stats ku-stats-grid">
          <div 
            className="stat-card ku-stat-card"
          >
            <div className="ku-stat-inner">
              <span className="ku-stat-emoji-lg">🥋</span>
              <span className="ku-stat-number-dark">
                {kurse.length}
              </span>
            </div>
            <div className="ku-stat-label-muted">
              {t('stats.totalCourses')}
            </div>
          </div>
          <div 
            className="stat-card ku-stat-card"
          >
            <div className="ku-stat-inner-sm">
              <span className="ku-stat-emoji">🎯</span>
              <span className="ku-stat-number">
                {sortedKurse.length}
              </span>
            </div>
            <div className="ku-stat-label">
              {t('stats.filteredResults')}
            </div>
          </div>
          <div 
            className="stat-card ku-stat-card"
          >
            <div className="ku-stat-inner-sm">
              <span className="ku-stat-emoji">👥</span>
              <span className="ku-stat-number">
                {new Set(kurse.map(k => k.trainer_id)).size}
              </span>
            </div>
            <div className="ku-stat-label">
              {t('stats.activeTrainers')}
            </div>
          </div>
          <div 
            className="stat-card ku-stat-card"
          >
            <div className="ku-stat-inner-sm">
              <span className="ku-stat-emoji">🏠</span>
              <span className="ku-stat-number">
                {new Set(kurse.map(k => k.raum_id)).size || 0}
              </span>
            </div>
            <div className="ku-stat-label">
              {t('stats.rooms')}
            </div>
          </div>
          <div 
            className="stat-card ku-stat-card"
          >
            <div className="ku-stat-inner-sm">
              <span className="ku-stat-emoji">👶</span>
              <span className="ku-stat-number">
                {kurse.filter(k => k.gruppe && k.gruppe.toLowerCase().includes('kind')).length}
              </span>
            </div>
            <div className="ku-stat-label">
              {t('stats.childrenCourses')}
            </div>
          </div>
          <div 
            className="stat-card ku-stat-card"
          >
            <div className="ku-stat-inner-sm">
              <span className="ku-stat-emoji">👨‍💼</span>
              <span className="ku-stat-number">
                {kurse.filter(k => k.gruppe && !k.gruppe.toLowerCase().includes('kind')).length}
              </span>
            </div>
            <div className="ku-stat-label">
              {t('stats.adultCourses')}
            </div>
          </div>
        </div>

        {/* Kursliste gruppiert nach Stil */}
        <div className="kurse-by-stil">
          {Object.keys(kurseByStil).length > 0 ? (
            Object.keys(kurseByStil).sort().map((stilName, stilIndex) => (
              <div key={stilName} className="stil-section ku-stil-mb">
                {/* Stil-Header mit Dropdown */}
                <h2
                  className="stil-header"
                  onClick={() => toggleStil(stilName)}
                  
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.15))';
                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1))';
                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.3)';
                  }}
                >
                  <span className="u-flex-row-lg">
                    <span className="ku-stat-emoji-lg">🥋</span>
                    <span className="ku-stil-title">
                      {stilName}
                    </span>
                    <span className="ku-stil-count">
                      {kurseByStil[stilName].length} {kurseByStil[stilName].length === 1 ? 'Kurs' : 'Kurse'}
                    </span>
                  </span>
                  <span
                    className={`ku-stil-chevron-span${collapsedStile[stilName] ? ' ku-stil-chevron-span--collapsed' : ''}`}
                  >
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
                    style={{ '--standort-color': kurs.standort_farbe || '#4F46E5' }}
                  >
                    <span className="ku-pin-icon">📍</span>
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
                <h3>{t('list.noCoursesFound')}</h3>
                <p>{t('list.noCoursesFilter')}</p>
              </div>
            </div>
          )}
        </div>

        {/* Vereinfachtes Formular für neuen Kurs */}
        <div className="neuer-kurs-card" style={{animationDelay: `${sortedKurse.length * 0.1 + 0.3}s`}}>
          <div className="card-header">
            <h3>➕ {t('form.createNewCourse')}</h3>
          </div>
          <div className="kurs-form-modern">
            <div className="kurs-form-left">
              <div className="form-group">
                <label>🥋 {t('form.style')}:</label>
                <select
                  className="form-select"
                  value={neuerKurs.stil}
                  onChange={(e) => setNeuerKurs({ ...neuerKurs, stil: e.target.value })}
                >
                  <option value="">{t('form.selectStyle')}</option>
                  {stile.filter(stil => stil.aktiv !== 0).map((stil) => (
                    <option key={stil.stil_id} value={stil.name}>{stil.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>🏷️ {t('groups.title', 'Gruppe')}:</label>
                <select
                  className="form-select"
                  value={neuerKurs.gruppenname}
                  onChange={(e) => setNeuerKurs({ ...neuerKurs, gruppenname: e.target.value })}
                >
                  <option value="">{t('form.selectGroup')}</option>
                  {gruppen.map((gruppe) => (
                    <option key={gruppe.gruppen_id} value={gruppe.name}>{gruppe.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>🏛️ {t('timetable.room')}:</label>
                <select
                  className="form-select"
                  value={neuerKurs.raum_id || ""}
                  onChange={(e) => setNeuerKurs({ ...neuerKurs, raum_id: e.target.value })}
                >
                  <option value="">{t('form.selectRoom')}</option>
                  {raeume.map((raum) => (
                    <option key={raum.id} value={raum.id}>{raum.name}</option>
                  ))}
                </select>
                
                {/* Neuen Raum hinzufügen Button */}
                {!showNewRoomForm && (
                  <button 
                    type="button"
                    className="add-new-btn ku-btn-add-room-trigger"
                    onClick={() => setShowNewRoomForm(true)}
                  >
                    ➕ Neuen Raum hinzufügen
                  </button>
                )}
                
                {/* Formular für neuen Raum */}
                {showNewRoomForm && (
                  <div className="new-room-form ku-new-room-form">
                    <h4 className="ku-new-room-h4">
                      🏠 Neuen Raum erstellen
                    </h4>
                    
                    <div className="u-flex-col-sm">
                      <input
                        type="text"
                        placeholder="Raum-Name (z.B. Hauptraum)"
                        value={newRoomData.name}
                        onChange={(e) => setNewRoomData({ ...newRoomData, name: e.target.value })}
                        className="ku-room-input"
                      />
                      
                      <input
                        type="text"
                        placeholder="Beschreibung (optional)"
                        value={newRoomData.beschreibung}
                        onChange={(e) => setNewRoomData({ ...newRoomData, beschreibung: e.target.value })}
                        className="ku-room-input"
                      />
                      
                      <input
                        type="text"
                        placeholder="Größe (optional, z.B. 50m²)"
                        value={newRoomData.groesse}
                        onChange={(e) => setNewRoomData({ ...newRoomData, groesse: e.target.value })}
                        className="ku-room-input"
                      />
                      
                      <input
                        type="number"
                        placeholder="Kapazität (optional)"
                        value={newRoomData.kapazitaet}
                        onChange={(e) => setNewRoomData({ ...newRoomData, kapazitaet: e.target.value })}
                        className="ku-room-input"
                      />
                      
                      <div className="ku-room-btn-row">
                        <button
                          type="button"
                          onClick={() => handleNewRoom(newRoomData, false)}
                          className="ku-btn-add-room"
                        >
                          ✅ Hinzufügen
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => {
                            setShowNewRoomForm(false);
                            setNewRoomData({ name: "", beschreibung: "", groesse: "", kapazitaet: "" });
                          }}
                          className="ku-btn-cancel-room"
                        >
                          ❌ Abbrechen
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>👨‍🏫 {t('form.trainer')}:</label>
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
                {t('form.createCourse')}
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
          <div className="einstellungen-card ku-card-delay-1">
            <div className="card-header">
              <h3>👨‍🏫 {t('trainers.title')}</h3>
            </div>
            <div className="card-content">
              <div className="current-list">
                <h4>{t('trainers.existing')}</h4>
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
                <h4>🆕 {t('trainers.addNew')}</h4>
                {showNewTrainerForm ? (
                  <>
                    <div className="trainer-form-grid">
                      <input
                        type="text"
                        className="form-input"
                        placeholder={`${t('trainers.firstName')} *`}
                        value={newTrainerData.vorname}
                        onChange={(e) => setNewTrainerData({...newTrainerData, vorname: e.target.value})}
                      />
                      <input
                        type="text"
                        className="form-input"
                        placeholder={`${t('trainers.lastName')} *`}
                        value={newTrainerData.nachname}
                        onChange={(e) => setNewTrainerData({...newTrainerData, nachname: e.target.value})}
                      />
                      <input
                        type="email"
                        className="form-input"
                        placeholder={t('trainers.email')}
                        value={newTrainerData.email}
                        onChange={(e) => setNewTrainerData({...newTrainerData, email: e.target.value})}
                      />
                      <input
                        type="tel"
                        className="form-input"
                        placeholder={t('trainers.phone')}
                        value={newTrainerData.telefon}
                        onChange={(e) => setNewTrainerData({...newTrainerData, telefon: e.target.value})}
                      />
                    </div>
                    <div className="trainer-form-actions">
                      <button
                        className="confirm-trainer-btn"
                        onClick={handleNewTrainer}
                      >
                        ✅ {t('trainers.addTrainer')}
                      </button>
                      <button
                        className="cancel-btn-small ku-cancel-trainer-btn"
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
          <div className="einstellungen-card ku-card-delay-2">
            <div className="card-header">
              <h3>🏷️ {t('groups.title')}</h3>
            </div>
            <div className="card-content">
              <div className="current-list">
                <h4>{t('groups.existing')}</h4>
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
                <h4>🆕 {t('groups.addNew')}</h4>
                {showNewGroupInput ? (
                  <div className="simple-form">
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t('groups.enterName')}
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
          <div className="einstellungen-card ku-card-delay-3">
            <div className="card-header">
              <h3>🥋 {t('styles.title')}</h3>
            </div>
            <div className="card-content">
              <div className="current-list">
                <h4>{t('styles.existing')}</h4>
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
                <h4>🆕 {t('styles.addNew')}</h4>
                {showNewStyleInput ? (
                  <div className="simple-form">
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t('styles.enterName')}
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
                <p>ℹ️ <strong>{t('common:labels.hint', 'Hinweis')}:</strong> {t('styles.hint')}</p>
              </div>
            </div>
          </div>

          {/* Räume verwalten */}
          <div className="einstellungen-card ku-card-delay-4">
            <div className="card-header">
              <h3>🏛️ {t('rooms.title')}</h3>
            </div>
            <div className="card-content">
              <div className="current-list">
                <h4>{t('rooms.existing')}</h4>
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
                      <div className="ku-room-info-col">
                        <span className="ku-room-name">{raum.name}</span>
                        {raum.beschreibung && (
                          <span className="ku-room-desc">
                            {raum.beschreibung}
                          </span>
                        )}
                        {(raum.groesse || raum.kapazitaet) && (
                          <span className="ku-room-size">
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
                <h4>🆕 {t('rooms.addNew')}</h4>
                {showNewRoomFormStammdaten ? (
                  <div className="room-form-stammdaten ku-room-stammdaten-form">
                    <div className="u-flex-col-sm">
                      <input
                        type="text"
                        className="form-input"
                        placeholder={t('rooms.namePlaceholder')}
                        value={newRoomDataStammdaten.name}
                        onChange={(e) => setNewRoomDataStammdaten({ ...newRoomDataStammdaten, name: e.target.value })}
                      />

                      <input
                        type="text"
                        className="form-input"
                        placeholder={t('rooms.description')}
                        value={newRoomDataStammdaten.beschreibung}
                        onChange={(e) => setNewRoomDataStammdaten({ ...newRoomDataStammdaten, beschreibung: e.target.value })}
                      />

                      <input
                        type="text"
                        className="form-input"
                        placeholder={t('rooms.size')}
                        value={newRoomDataStammdaten.groesse}
                        onChange={(e) => setNewRoomDataStammdaten({ ...newRoomDataStammdaten, groesse: e.target.value })}
                      />

                      <input
                        type="number"
                        className="form-input"
                        placeholder={t('rooms.capacity')}
                        value={newRoomDataStammdaten.kapazitaet}
                        onChange={(e) => setNewRoomDataStammdaten({ ...newRoomDataStammdaten, kapazitaet: e.target.value })}
                      />
                      
                      <div className="input-buttons ku-input-buttons-mt">
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
                <p>ℹ️ <strong>{t('common:labels.hint', 'Hinweis')}:</strong> {t('rooms.hint')}</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

};

export default Kurse;
