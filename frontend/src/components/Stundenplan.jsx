import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import "../styles/themes.css";       // Centralized theme system
import "../styles/components.css";   // Universal component styles
import "../styles/Stundenplan.css";
import { DatenContext } from "@shared/DatenContext.jsx";
import { useStandortContext } from '../context/StandortContext.jsx';
import { useDojoContext } from '../context/DojoContext';

const Stundenplan = () => {
  const { kurse, trainer } = useContext(DatenContext);
  const { standorte, activeStandort, hasMultipleLocations } = useStandortContext();
  const { getDojoFilterParam, activeDojo } = useDojoContext();
  const [stundenplan, setStundenplan] = useState([]);
  const [raeume, setRaeume] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [neuerKurs, setNeuerKurs] = useState({
    tag: "",
    uhrzeit_start: "",
    uhrzeit_ende: "",
    kurs_id: "",
    raum_id: "",
  });
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });
  const [editingId, setEditingId] = useState(null);
  const [editingData, setEditingData] = useState({});
  const [activeDay, setActiveDay] = useState('Wochenübersicht');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalData, setEditModalData] = useState({});
  const [auslastung, setAuslastung] = useState({}); // kurs_id → {teilnehmer, max_teilnehmer}
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkKurs, setBulkKurs] = useState(null);
  const [bulkBetreff, setBulkBetreff] = useState('');
  const [bulkNachricht, setBulkNachricht] = useState('');
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [showWartModal, setShowWartModal] = useState(false);
  const [wartKurs, setWartKurs] = useState(null);
  const [warteliste, setWarteliste] = useState([]);
  const [wartLoading, setWartLoading] = useState(false);
  const [showVertModal, setShowVertModal] = useState(false);
  const [vertKurs, setVertKurs] = useState(null);
  const [vertForm, setVertForm] = useState({ original_trainer_id: '', vertretung_trainer_id: '', datum: '', grund: '' });
  const [vertList, setVertList] = useState([]);
  const [vertLoading, setVertLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Quick-Filter
  const [filterTrainerSP, setFilterTrainerSP] = useState('');
  const [filterStilSP, setFilterStilSP] = useState('');
  const [filterRaumSP, setFilterRaumSP] = useState('');

  const wochentage = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

  useEffect(() => {
    ladeDaten();
  }, [activeDojo]);

  const ladeDaten = async () => {
    const dojoParam = getDojoFilterParam();
    const isSuperAdmin = activeDojo === 'super-admin';
    // Kein Dojo-Filter → kein Laden (verhindert Daten aus fremden Dojos)
    // Ausnahme: Super-Admin darf ohne dojo_id laden (Backend liefert alle Dojos)
    if (!dojoParam && !isSuperAdmin) {
      setStundenplan([]);
      setRaeume([]);
      setLoading(false);
      return;
    }
    const queryStr = dojoParam ? `?${dojoParam}` : '';
    try {
      const [stundenRes, raeumeRes] = await Promise.all([
        axios.get(`/stundenplan${queryStr}`),
        axios.get(`/raeume${queryStr}`)
      ]);
      setStundenplan(stundenRes.data);
      setRaeume(raeumeRes.data.data || raeumeRes.data || []);
      // Auslastung für alle Kurse laden
      const uniqueKursIds = [...new Set(stundenRes.data.map(s => s.kurs_id).filter(Boolean))];
      ladeAuslastung(uniqueKursIds);
    } catch (err) {
      console.error("Fehler beim Laden:", err);
      setError("⚔️ Der Stundenplan hat gerade einen Sparring-Zweikampf mit dem Server - wir schreiten ein!");
    } finally {
      setLoading(false);
    }
  };

  const ladeAuslastung = async (kursIds) => {
    if (!kursIds.length) return;
    try {
      const results = await Promise.all(
        kursIds.map(id => axios.get(`/kurse/${id}/auslastung`).then(r => ({ id, ...r.data })).catch(() => ({ id, teilnehmer: 0, max_teilnehmer: null })))
      );
      const map = {};
      results.forEach(r => { map[r.id] = { teilnehmer: r.teilnehmer, max_teilnehmer: r.max_teilnehmer }; });
      setAuslastung(map);
    } catch {}
  };

  const openBulkModal = (eintrag) => {
    setBulkKurs(eintrag);
    setBulkBetreff(`Wichtige Info: ${eintrag.kursname}`);
    setBulkNachricht('');
    setBulkResult(null);
    setShowBulkModal(true);
  };

  const openWartModal = async (eintrag) => {
    setWartKurs(eintrag);
    setShowWartModal(true);
    setWartLoading(true);
    try {
      const res = await axios.get(`/warteliste/kurs/${eintrag.kurs_id}`);
      setWarteliste(res.data.warteliste || []);
    } catch { setWarteliste([]); }
    finally { setWartLoading(false); }
  };

  const removeFromWarteliste = async (id) => {
    await axios.delete(`/warteliste/${id}`).catch(() => {});
    setWarteliste(prev => prev.filter(w => w.id !== id));
  };

  const openVertModal = async (eintrag) => {
    setVertKurs(eintrag);
    setVertForm({ original_trainer_id: eintrag.trainer_id || '', vertretung_trainer_id: '', datum: '', grund: '' });
    setShowVertModal(true);
    setVertLoading(true);
    try {
      const res = await axios.get(`/vertretung?kurs_id=${eintrag.kurs_id}`);
      setVertList(res.data.anfragen || []);
    } catch { setVertList([]); }
    finally { setVertLoading(false); }
  };

  const sendVertretung = async () => {
    if (!vertForm.datum || !vertForm.original_trainer_id) return;
    try {
      await axios.post('/vertretung', { kurs_id: vertKurs.kurs_id, ...vertForm });
      const res = await axios.get(`/vertretung?kurs_id=${vertKurs.kurs_id}`);
      setVertList(res.data.anfragen || []);
      setVertForm({ original_trainer_id: '', vertretung_trainer_id: '', datum: '', grund: '' });
    } catch {}
  };

  const updateWartStatus = async (id, status) => {
    await axios.put(`/warteliste/${id}/status`, { status }).catch(() => {});
    setWarteliste(prev => prev.map(w => w.id === id ? { ...w, status } : w));
  };

  const sendBulkNachricht = async () => {
    if (!bulkNachricht.trim() || !bulkBetreff.trim()) return;
    setBulkSending(true);
    try {
      const res = await axios.post(`/kurse/${bulkKurs.kurs_id}/bulk-nachricht`, { betreff: bulkBetreff, nachricht: bulkNachricht });
      setBulkResult({ success: true, gesendet: res.data.gesendet });
    } catch {
      setBulkResult({ success: false });
    } finally {
      setBulkSending(false);
    }
  };

  const sortiere = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") direction = "desc";
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return "⇅";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  // Filter by active standort + quick filters
  const filteredStundenplan = stundenplan.filter(eintrag => {
    if (activeStandort !== 'all' && eintrag.standort_id && eintrag.standort_id !== activeStandort) return false;
    if (filterTrainerSP && eintrag.trainer_id?.toString() !== filterTrainerSP) return false;
    if (filterStilSP && eintrag.stil !== filterStilSP) return false;
    if (filterRaumSP && eintrag.raum_id?.toString() !== filterRaumSP) return false;
    return true;
  });

  const uniqueStile = [...new Set(stundenplan.map(s => s.stil).filter(Boolean))].sort();
  const hasActiveFilter = filterTrainerSP || filterStilSP || filterRaumSP;

  const sortedEintraege = [...filteredStundenplan].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key]?.toLowerCase?.() || "";
    const bVal = b[sortConfig.key]?.toLowerCase?.() || "";
    return sortConfig.direction === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  const handleHinzufuegen = async () => {
    const { tag, uhrzeit_start, uhrzeit_ende, kurs_id, raum_id } = neuerKurs;
    if (!tag || !uhrzeit_start || !uhrzeit_ende || !kurs_id) {
      alert("Alle Felder ausfüllen.");
      return;
    }

    try {
      const res = await axios.post('/stundenplan', {
        tag,
        uhrzeit_start,
        uhrzeit_ende,
        kurs_id: parseInt(kurs_id),
        raum_id: raum_id ? parseInt(raum_id) : null,
      });
      setStundenplan([...stundenplan, res.data]);
      setNeuerKurs({ tag: "", uhrzeit_start: "", uhrzeit_ende: "", kurs_id: "", raum_id: "" });
      alert("Stundenplan-Eintrag erfolgreich hinzugefügt!");
    } catch (err) {
      console.error("Fehler beim Hinzufügen:", err);
      alert("Fehler beim Hinzufügen des Eintrags: " + (err.response?.data?.error || err.message));
    }
  };

  const handleBearbeiten = (eintrag) => {
    setEditingId(eintrag.id);
    setEditingData({
      tag: eintrag.tag,
      uhrzeit_start: eintrag.uhrzeit_start,
      uhrzeit_ende: eintrag.uhrzeit_ende,
      kurs_id: eintrag.kurs_id
    });
  };

  const handleSpeichern = async (id) => {
    if (!editingData.tag || !editingData.uhrzeit_start || !editingData.uhrzeit_ende || !editingData.kurs_id) {
      alert("Bitte alle Felder ausfüllen.");
      return;
    }

    try {
      await axios.put(`/stundenplan/${id}`, {
        tag: editingData.tag,
        uhrzeit_start: editingData.uhrzeit_start,
        uhrzeit_ende: editingData.uhrzeit_ende,
        kurs_id: parseInt(editingData.kurs_id)
      });
      setEditingId(null);
      ladeDaten();
      alert("Stundenplan-Eintrag erfolgreich aktualisiert!");
    } catch (err) {
      console.error("Fehler beim Speichern:", err);
      alert("Fehler beim Speichern: " + (err.response?.data?.error || err.message));
    }
  };

  const handleLoeschen = async (id) => {
    if (!window.confirm("Soll dieser Stundenplan-Eintrag wirklich gelöscht werden?")) return;

    try {
      await axios.delete(`/stundenplan/${id}`);
      setStundenplan(stundenplan.filter((eintrag) => eintrag.id !== id));
      alert("Stundenplan-Eintrag erfolgreich gelöscht!");
    } catch (err) {
      console.error("Fehler beim Löschen:", err);
      alert("Fehler beim Löschen: " + (err.response?.data?.error || err.message));
    }
  };

  const handleModalSave = async () => {
    try {
      await axios.put(`/stundenplan/${editModalData.id}`, {
        tag: editModalData.tag,
        uhrzeit_start: editModalData.uhrzeit_start,
        uhrzeit_ende: editModalData.uhrzeit_ende,
        kurs_id: parseInt(editModalData.kurs_id),
        raum_id: editModalData.raum_id ? parseInt(editModalData.raum_id) : null
      });
      setShowEditModal(false);
      setEditModalData({});
      ladeDaten();
      // Wechsle zum neuen Tag falls geändert
      if (editModalData.tag !== activeDay) {
        setActiveDay(editModalData.tag);
      }
      alert("Stundenplan-Eintrag erfolgreich aktualisiert!");
    } catch (err) {
      console.error("Fehler beim Speichern:", err);
      alert("Fehler beim Speichern: " + (err.response?.data?.error || err.message));
    }
  };

  const openEditModal = (eintrag) => {
    setEditModalData({
      id: eintrag.id,
      tag: eintrag.tag,
      uhrzeit_start: eintrag.uhrzeit_start,
      uhrzeit_ende: eintrag.uhrzeit_ende,
      kurs_id: eintrag.kurs_id || '',
      raum_id: eintrag.raum_id || '',
      kursname: eintrag.kursname,
      stil: eintrag.stil,
      trainer_vorname: eintrag.trainer_vorname,
      trainer_nachname: eintrag.trainer_nachname,
      raumname: eintrag.raumname
    });
    setShowEditModal(true);
  };

  const handleCSVExport = () => {
    const csv = [
      ['Tag', 'Startzeit', 'Endzeit', 'Gruppe', 'Stil', 'Trainer'],
      ...stundenplan.map((k) => [
        k.tag,
        k.uhrzeit_start,
        k.uhrzeit_ende,
        k.kursname || 'Unbekannt',
        k.stil || '?',
        `${k.trainer_vorname || '?'} ${k.trainer_nachname || ''}`,
      ])
    ].map((e) => e.join(";")).join("\n");

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "stundenplan.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatTime = (time) => {
    if (!time) return "";
    return time.substring(0, 5); // HH:MM format
  };

  // Überschneidungsprüfung
  const checkForOverlaps = (stundenplanData = stundenplan) => {
    const overlaps = [];
    for (let i = 0; i < stundenplanData.length; i++) {
      for (let j = i + 1; j < stundenplanData.length; j++) {
        const a = stundenplanData[i];
        const b = stundenplanData[j];
        
        // Nur gleiche Wochentage prüfen
        if (a.tag === b.tag) {
          const startA = new Date(`2000-01-01 ${a.uhrzeit_start}`);
          const endA = new Date(`2000-01-01 ${a.uhrzeit_ende}`);
          const startB = new Date(`2000-01-01 ${b.uhrzeit_start}`);
          const endB = new Date(`2000-01-01 ${b.uhrzeit_ende}`);
          
          // Überschneidung prüfen
          if (startA < endB && startB < endA) {
            overlaps.push({ a, b });
          }
        }
      }
    }
    return overlaps;
  };

  // Wochenansicht generieren
  const generateWeekView = () => {
    const weekData = {};
    wochentage.forEach(tag => {
      weekData[tag] = filteredStundenplan.filter(eintrag => eintrag.tag === tag)
        .sort((a, b) => a.uhrzeit_start.localeCompare(b.uhrzeit_start));
    });
    return weekData;
  };

  const weekView = generateWeekView();
  const overlaps = checkForOverlaps(filteredStundenplan);

  if (loading) return <div className="stundenplan-container-modern">Lade Stundenplan...</div>;
  if (error) return (
    <div className="stundenplan-container-modern">
      <div className="error-message-box sp-error-box">
        <div className="u-emoji-xl">⚔️</div>
        <h3 className="sp-error-h3">{error}</h3>
        <button
          onClick={loadData}
          className="sp-retry-btn"
        >
          🔄 Nochmal versuchen
        </button>
      </div>
    </div>
  );

  return (
    <div className="stundenplan-container-modern">
      <div className="stundenplan-header">
        <h2>📋 Stundenplan-Verwaltung</h2>
        <p className="stundenplan-subtitle">Kurszeiten und Trainingsplan verwalten</p>
      </div>

      {/* Controls */}
      <div className="stundenplan-controls">
        <button className="add-button-modern sp-add-btn" onClick={() => setShowAddModal(true)}>
          <span className="btn-icon">➕</span> Stunde hinzufügen
        </button>
        <button className="export-button-modern" onClick={handleCSVExport}>
          📊 CSV Export
        </button>
      </div>

      {/* Quick Filter Bar */}
      <div className="sp-filter-bar">
        <select
          className="sp-filter-select"
          value={filterTrainerSP}
          onChange={e => setFilterTrainerSP(e.target.value)}
        >
          <option value="">👨‍🏫 Alle Trainer</option>
          {trainer.map(tr => (
            <option key={tr.trainer_id} value={tr.trainer_id}>
              {tr.vorname} {tr.nachname}
            </option>
          ))}
        </select>
        <select
          className="sp-filter-select"
          value={filterStilSP}
          onChange={e => setFilterStilSP(e.target.value)}
        >
          <option value="">🥋 Alle Stile</option>
          {uniqueStile.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className="sp-filter-select"
          value={filterRaumSP}
          onChange={e => setFilterRaumSP(e.target.value)}
        >
          <option value="">🏛️ Alle Räume</option>
          {raeume.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {hasActiveFilter && (
          <button
            className="sp-filter-clear"
            onClick={() => { setFilterTrainerSP(''); setFilterStilSP(''); setFilterRaumSP(''); }}
          >✕ Filter zurücksetzen</button>
        )}
      </div>

      {/* Statistiken */}
      <div className="stundenplan-stats">
        <div className="stat-card">
          <div className="sp-stat-row">
            <span className="sp-stat-emoji">📅</span>
            <span className="sp-stat-value">
              {filteredStundenplan.length}
            </span>
          </div>
          <div className="sp-stat-label">
            Einträge
          </div>
        </div>
        <div className="stat-card">
          <div className="sp-stat-row">
            <span className="sp-stat-emoji">🏃‍♂️</span>
            <span className="sp-stat-value">
              {new Set(filteredStundenplan.map(s => s.tag)).size}
            </span>
          </div>
          <div className="sp-stat-label">
            Trainingstage
          </div>
        </div>
        <div className="stat-card">
          <div className="sp-stat-row">
            <span className="sp-stat-emoji">🥋</span>
            <span className="sp-stat-value">
              {new Set(filteredStundenplan.map(s => s.kurs_id)).size}
            </span>
          </div>
          <div className="sp-stat-label">
            Kurse
          </div>
        </div>
        <div className="stat-card">
          <div className="sp-stat-row">
            <span className="sp-stat-emoji">⏰</span>
            <span className="sp-stat-value">
              {filteredStundenplan.length > 0 ? formatTime(filteredStundenplan.reduce((earliest, s) => s.uhrzeit_start < earliest ? s.uhrzeit_start : earliest, filteredStundenplan[0].uhrzeit_start)) : '--'}
            </span>
          </div>
          <div className="sp-stat-label">
            Frühester Start
          </div>
        </div>
        <div className="stat-card">
          <div className="sp-stat-row">
            <span className="sp-stat-emoji">🌙</span>
            <span className="sp-stat-value">
              {filteredStundenplan.length > 0 ? formatTime(filteredStundenplan.reduce((latest, s) => s.uhrzeit_ende > latest ? s.uhrzeit_ende : latest, filteredStundenplan[0].uhrzeit_ende)) : '--'}
            </span>
          </div>
          <div className="sp-stat-label">
            Spätestes Ende
          </div>
        </div>
        <div className="stat-card">
          <div className="sp-stat-row">
            <span className="sp-stat-emoji">📊</span>
            <span className="sp-stat-value">
              {filteredStundenplan.filter(s => s.tag === 'Montag').length}
            </span>
          </div>
          <div className="sp-stat-label">
            Montags
          </div>
        </div>
        <div className="stat-card">
          <div className="sp-stat-row">
            <span className="sp-stat-emoji">🎉</span>
            <span className="sp-stat-value">
              {filteredStundenplan.filter(s => s.tag === 'Samstag' || s.tag === 'Sonntag').length}
            </span>
          </div>
          <div className="sp-stat-label">
            Wochenende
          </div>
        </div>
      </div>

      {/* Überschneidungswarnung */}
      {overlaps.length > 0 && (
        <div className="overlap-warning">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <h3>Kursüberschneidungen gefunden!</h3>
            <p>{overlaps.length} Überschneidung(en) erkannt. Bitte prüfen Sie die Zeiten:</p>
            <ul>
              {overlaps.map((overlap, index) => (
                <li key={index}>
                  <strong>{overlap.a.tag}:</strong> {overlap.a.kursname || 'Kurs'} ({formatTime(overlap.a.uhrzeit_start)}-{formatTime(overlap.a.uhrzeit_ende)}) 
                  ↔ {overlap.b.kursname || 'Kurs'} ({formatTime(overlap.b.uhrzeit_start)}-{formatTime(overlap.b.uhrzeit_ende)})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Accordion Wochenansicht */}
      <div className="week-accordion-container">
        <div className="accordion-tabs">
          <button
            onClick={() => setActiveDay('Wochenübersicht')}
            className={`accordion-tab ${activeDay === 'Wochenübersicht' ? 'active' : ''}`}
          >
            <span className="tab-name">📊 Woche</span>
            <span className="tab-count">{filteredStundenplan.length}</span>
          </button>
          {wochentage.map(tag => (
            <button 
              key={tag}
              onClick={() => setActiveDay(tag)}
              className={`accordion-tab ${activeDay === tag ? 'active' : ''}`}
            >
              <span className="tab-name">{tag}</span>
              <span className="tab-count">{weekView[tag].length}</span>
            </button>
          ))}
        </div>

        <div className="accordion-content">
          {activeDay === 'Wochenübersicht' ? (
            /* Wochenübersicht */
            <div className="weekly-overview-content">
              <div className="weekly-grid">
                {wochentage.map((tag, dayIndex) => (
                  <div 
                    key={tag}
                    className="day-column"
                    style={{ animationDelay: `${dayIndex * 0.1}s` }}
                  >
                    <div className="day-header">
                      <div className="day-name">{tag}</div>
                      <div className="day-count">{weekView[tag].length} Kurse</div>
                    </div>
                    
                    <div className="day-classes">
                      {weekView[tag].length === 0 ? (
                        <div className="no-day-classes">Kein Kurs</div>
                      ) : (
                        weekView[tag].map((eintrag, index) => (
                          <div key={`${eintrag.id}-${index}`} className="mini-class-card">
                            <div className="mini-time">
                              {formatTime(eintrag.uhrzeit_start)} - {formatTime(eintrag.uhrzeit_ende)}
                            </div>
                            <div className="mini-style">{eintrag.stil}</div>
                            <div className="mini-name">{eintrag.kursname}</div>
                            {eintrag.raumname && (
                              <div className="mini-raum">🏢 {eintrag.raumname}</div>
                            )}
                            {hasMultipleLocations && eintrag.standort_name && (
                              <div
                                className="mini-standort sp-standort-badge"
                                style={{ '--standort-color': eintrag.standort_farbe || '#4F46E5' }}
                              >
                                <span className="sp-standort-pin">📍</span>
                                <span>{eintrag.standort_name}</span>
                              </div>
                            )}
                            {auslastung[eintrag.kurs_id] && (
                              <CapacityBar data={auslastung[eintrag.kurs_id]} compact />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Tagesansicht */
            <div className="day-content-expanded">
              <div className="expanded-header">
                <h3>📅 {activeDay}</h3>
                <span className="day-stats">
                  {weekView[activeDay].length} Kurse 
                  {overlaps.some(overlap => 
                    weekView[activeDay].some(eintrag => 
                      overlap.a.id === eintrag.id || overlap.b.id === eintrag.id
                    )
                  ) && <span className="has-conflicts">⚠️</span>}
                </span>
              </div>

              {weekView[activeDay].length === 0 ? (
                <div className="no-classes-expanded">
                  <div className="no-classes-icon">🏮</div>
                  <h4>Keine Kurse am {activeDay}</h4>
                  <p>An diesem Tag sind keine Trainingszeiten geplant.</p>
                </div>
              ) : (
                <div className="time-slots-expanded">
                  {weekView[activeDay].map((eintrag) => {
                  const hasOverlap = overlaps.some(overlap => 
                    overlap.a.id === eintrag.id || overlap.b.id === eintrag.id
                  );
                  return (
                    <div 
                      key={eintrag.id} 
                      className={`time-slot-expanded ${hasOverlap ? 'overlap' : ''}`}
                    >
                      <div className="slot-left">
                        <div className="time-range-big">
                          {formatTime(eintrag.uhrzeit_start)} - {formatTime(eintrag.uhrzeit_ende)}
                        </div>
                      </div>
                      
                      <div className="slot-center">
                        <div className="course-info-expanded">
                          <div className="course-name-big">{eintrag.kursname || 'Unbekannt'}</div>
                          <div className="course-details-expanded">
                            <span className="course-style-big">🥋 {eintrag.stil || '?'}</span>
                            <span className="course-trainer-big">
                              👨‍🏫 {eintrag.trainer_vorname || '?'} {eintrag.trainer_nachname || ''}
                            </span>
                            {hasMultipleLocations && eintrag.standort_name && (
                              <span
                                className="sp-standort-badge-lg"
                                style={{ '--standort-color': eintrag.standort_farbe || '#4F46E5' }}
                              >
                                <span>📍</span>
                                <span>{eintrag.standort_name}</span>
                              </span>
                            )}
                            {auslastung[eintrag.kurs_id] && (
                              <CapacityBar data={auslastung[eintrag.kurs_id]} />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="slot-right">
                        {editingId === eintrag.id ? (
                          <div className="edit-actions-expanded">
                            <button onClick={() => handleSpeichern()} className="save-btn-big">💾 Speichern</button>
                            <button onClick={() => setEditingId(null)} className="cancel-btn-big">❌ Abbrechen</button>
                          </div>
                        ) : (
                          <div className="slot-actions-expanded">
                            <button onClick={() => openEditModal(eintrag)} className="edit-btn-big">✏️ Bearbeiten</button>
                            <button onClick={() => openBulkModal(eintrag)} className="edit-btn-big" style={{ background: 'rgba(99,102,241,0.15)', borderColor: 'rgba(99,102,241,0.4)', color: '#a5b4fc' }}>📨 Nachricht</button>
                            <button onClick={() => openWartModal(eintrag)} className="edit-btn-big" style={{ background: 'rgba(234,179,8,0.12)', borderColor: 'rgba(234,179,8,0.35)', color: '#fbbf24' }}>📋 Warteliste</button>
                            <button onClick={() => openVertModal(eintrag)} className="edit-btn-big" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' }}>🔄 Vertretung</button>
                            <button onClick={() => handleLoeschen(eintrag.id)} className="delete-btn-big">🗑️ Löschen</button>
                          </div>
                        )}
                        {hasOverlap && <div className="overlap-indicator-big">⚠️ Überschneidung</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📝 Stundenplan-Eintrag bearbeiten</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowEditModal(false)}
              >
                ❌
              </button>
            </div>
            
            <div className="modal-body">
              <div className="course-preview">
                <h4>{editModalData.kursname} - {editModalData.stil}</h4>
                <p>Trainer: {editModalData.trainer_vorname} {editModalData.trainer_nachname}</p>
              </div>
              
              <div className="modal-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Wochentag:</label>
                    <select
                      value={editModalData.tag || ''}
                      onChange={(e) => setEditModalData({
                        ...editModalData,
                        tag: e.target.value
                      })}
                    >
                      {wochentage.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Startzeit:</label>
                    <input
                      type="time"
                      value={editModalData.uhrzeit_start || ''}
                      onChange={(e) => setEditModalData({
                        ...editModalData,
                        uhrzeit_start: e.target.value
                      })}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Endzeit:</label>
                    <input
                      type="time"
                      value={editModalData.uhrzeit_ende || ''}
                      onChange={(e) => setEditModalData({
                        ...editModalData,
                        uhrzeit_ende: e.target.value
                      })}
                    />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Kurs:</label>
                    <select
                      value={editModalData.kurs_id || ''}
                      onChange={(e) => setEditModalData({
                        ...editModalData,
                        kurs_id: e.target.value
                      })}
                    >
                      <option value="">Kurs wählen...</option>
                      {kurse.map(kurs => (
                        <option key={kurs.kurs_id} value={kurs.kurs_id}>
                          {kurs.gruppenname} - {kurs.stil}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Raum:</label>
                    <select
                      value={editModalData.raum_id || ''}
                      onChange={(e) => setEditModalData({
                        ...editModalData,
                        raum_id: e.target.value
                      })}
                    >
                      <option value="">Kein Raum</option>
                      {raeume.filter(raum => raum.aktiv).map((raum) => (
                        <option key={raum.id} value={raum.id}>
                          {raum.name} {raum.groesse ? `(${raum.groesse})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowEditModal(false)}
              >
                Abbrechen
              </button>
              <button 
                className="btn-primary" 
                onClick={handleModalSave}
              >
                💾 Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk-Nachricht Modal */}
      {showBulkModal && bulkKurs && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📨 Nachricht an Kursteilnehmer</h3>
              <button className="modal-close" onClick={() => setShowBulkModal(false)}>❌</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '1rem' }}>
                Sendet eine In-App-Benachrichtigung an alle Mitglieder, die in den letzten 30 Tagen im Kurs
                <strong style={{ color: 'var(--text-primary)' }}> {bulkKurs.kursname}</strong> anwesend waren.
              </p>
              {bulkResult ? (
                <div style={{ padding: '1rem', borderRadius: '8px', textAlign: 'center',
                  background: bulkResult.success ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  color: bulkResult.success ? '#4ade80' : '#f87171' }}>
                  {bulkResult.success
                    ? `✅ Nachricht an ${bulkResult.gesendet} Teilnehmer gesendet!`
                    : '❌ Fehler beim Senden. Bitte erneut versuchen.'}
                </div>
              ) : (
                <div className="modal-form">
                  <div className="form-group">
                    <label>Betreff:</label>
                    <input type="text" className="form-input" value={bulkBetreff} onChange={e => setBulkBetreff(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Nachricht:</label>
                    <textarea className="form-input" rows={4} style={{ resize: 'vertical' }}
                      value={bulkNachricht} onChange={e => setBulkNachricht(e.target.value)}
                      placeholder="Nachricht an alle Kursteilnehmer..." />
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowBulkModal(false)}>Schließen</button>
              {!bulkResult && (
                <button className="btn-primary" onClick={sendBulkNachricht} disabled={bulkSending || !bulkNachricht.trim()}>
                  {bulkSending ? 'Sende...' : '📨 Senden'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Warteliste Modal */}
      {showWartModal && wartKurs && (
        <div className="modal-overlay" onClick={() => setShowWartModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3>📋 Warteliste: {wartKurs.kursname}</h3>
              <button className="modal-close" onClick={() => setShowWartModal(false)}>❌</button>
            </div>
            <div className="modal-body">
              {wartLoading ? (
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Lade Warteliste...</p>
              ) : warteliste.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)' }}>
                  Keine Mitglieder auf der Warteliste.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {warteliste.map(w => (
                    <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.8rem',
                      background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ fontWeight: 600, color: 'rgba(255,215,0,0.7)', minWidth: '24px', fontSize: '0.9rem' }}>#{w.position}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{w.vorname} {w.nachname}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{w.email}</div>
                      </div>
                      <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '12px',
                        background: w.status === 'wartend' ? 'rgba(234,179,8,0.15)' : w.status === 'benachrichtigt' ? 'rgba(99,102,241,0.15)' : 'rgba(34,197,94,0.15)',
                        color: w.status === 'wartend' ? '#fbbf24' : w.status === 'benachrichtigt' ? '#a5b4fc' : '#4ade80' }}>
                        {w.status === 'wartend' ? '⏳ Wartend' : w.status === 'benachrichtigt' ? '📧 Benachrichtigt' : '✅ Eingeschrieben'}
                      </span>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        {w.status === 'wartend' && (
                          <button className="btn btn-sm" style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.35)', color: '#a5b4fc' }}
                            onClick={() => updateWartStatus(w.id, 'benachrichtigt')}>📧</button>
                        )}
                        {w.status === 'benachrichtigt' && (
                          <button className="btn btn-sm" style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.35)', color: '#4ade80' }}
                            onClick={() => updateWartStatus(w.id, 'eingeschrieben')}>✅</button>
                        )}
                        <button className="btn btn-sm" style={{ fontSize: '0.72rem', padding: '0.15rem 0.4rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}
                          onClick={() => removeFromWarteliste(w.id)}>🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowWartModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* Vertretungslehrer Modal */}
      {showVertModal && vertKurs && (
        <div className="modal-overlay" onClick={() => setShowVertModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="modal-header">
              <h3>🔄 Vertretung: {vertKurs.kursname}</h3>
              <button className="modal-close" onClick={() => setShowVertModal(false)}>❌</button>
            </div>
            <div className="modal-body">
              <div className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Datum der Vertretung:</label>
                    <input type="date" className="form-input" value={vertForm.datum} onChange={e => setVertForm(f => ({ ...f, datum: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Originaltrainer:</label>
                    <select className="form-input" value={vertForm.original_trainer_id} onChange={e => setVertForm(f => ({ ...f, original_trainer_id: e.target.value }))}>
                      <option value="">— Trainer wählen —</option>
                      {trainer.map(t => (
                        <option key={t.trainer_id} value={t.trainer_id}>
                          {t.vorname} {t.nachname}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Vertretungslehrer:</label>
                    <select className="form-input" value={vertForm.vertretung_trainer_id} onChange={e => setVertForm(f => ({ ...f, vertretung_trainer_id: e.target.value }))}>
                      <option value="">— Vertretung wählen (optional) —</option>
                      {trainer.map(t => (
                        <option key={t.trainer_id} value={t.trainer_id}>
                          {t.vorname} {t.nachname}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Grund:</label>
                  <input type="text" className="form-input" value={vertForm.grund} onChange={e => setVertForm(f => ({ ...f, grund: e.target.value }))} placeholder="z.B. Krankheit, Urlaub..." />
                </div>
                <button className="btn-primary" onClick={sendVertretung} disabled={!vertForm.datum}>
                  ✅ Anfrage erstellen
                </button>
              </div>

              {vertLoading ? <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Lade...</p> : vertList.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', margin: '0 0 0.5rem' }}>Offene Anfragen</h4>
                  {vertList.map(v => (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '0.5rem 0.7rem', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', marginBottom: '0.3rem', fontSize: '0.83rem' }}>
                      <span>📅 {new Date(v.datum).toLocaleDateString('de-DE')}</span>
                      <span style={{ flex: 1 }}>Original: {v.orig_vorname} {v.orig_nachname}</span>
                      <span style={{ color: v.status === 'offen' ? '#fbbf24' : v.status === 'angenommen' ? '#4ade80' : '#f87171' }}>
                        {v.status === 'offen' ? '⏳' : v.status === 'angenommen' ? '✅' : '❌'} {v.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowVertModal(false)}>Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* Altes Card-System als Backup falls gewünscht */}
      <div className="stundenplan-grid sp-hidden">
        {sortedEintraege.length > 0 ? (
          sortedEintraege.map((eintrag, index) => (
            <div key={eintrag.id} className="stundenplan-card" style={{animationDelay: `${index * 0.1}s`}}>
              <div className="stundenplan-card-header">
                <div className="tag-badge">
                  {editingId === eintrag.id ? (
                    <select
                      className="edit-select-small"
                      value={editingData.tag}
                      onChange={(e) => setEditingData({ ...editingData, tag: e.target.value })}
                    >
                      {wochentage.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                      ))}
                    </select>
                  ) : (
                    eintrag.tag
                  )}
                </div>
                <div className="stundenplan-actions">
                  {editingId === eintrag.id ? (
                    <>
                      <button 
                        className="action-btn save-btn" 
                        onClick={() => handleSpeichern(eintrag.id)}
                        title="Änderungen speichern"
                      >
                        ✅
                      </button>
                      <button 
                        className="action-btn cancel-btn" 
                        onClick={() => setEditingId(null)}
                        title="Bearbeitung abbrechen"
                      >
                        ❌
                      </button>
                    </>
                  ) : (
                    <>
                      <button 
                        className="action-btn edit-btn" 
                        onClick={() => handleBearbeiten(eintrag)}
                        title="Eintrag bearbeiten"
                      >
                        ✏️
                      </button>
                      <button 
                        className="action-btn delete-btn" 
                        onClick={() => handleLoeschen(eintrag.id)}
                        title="Eintrag löschen"
                      >
                        🗑️
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="stundenplan-card-content">
                <div className="stundenplan-field">
                  <label>🕐 Zeit:</label>
                  {editingId === eintrag.id ? (
                    <div className="sp-time-edit-row">
                      <input
                        type="time"
                        className="edit-input-small"
                        value={editingData.uhrzeit_start}
                        onChange={(e) => setEditingData({ ...editingData, uhrzeit_start: e.target.value })}
                      />
                      <span className="sp-bis-label">bis</span>
                      <input
                        type="time"
                        className="edit-input-small"
                        value={editingData.uhrzeit_ende}
                        onChange={(e) => setEditingData({ ...editingData, uhrzeit_ende: e.target.value })}
                      />
                    </div>
                  ) : (
                    <span className="stundenplan-value time-value">
                      {formatTime(eintrag.uhrzeit_start)} - {formatTime(eintrag.uhrzeit_ende)}
                    </span>
                  )}
                </div>

                <div className="stundenplan-field">
                  <label>🥋 Kurs:</label>
                  {editingId === eintrag.id ? (
                    <select
                      className="edit-select"
                      value={editingData.kurs_id}
                      onChange={(e) => setEditingData({ ...editingData, kurs_id: e.target.value })}
                    >
                      <option value="">Kurs auswählen</option>
                      {kurse.map((kurs) => (
                        <option key={kurs.kurs_id} value={kurs.kurs_id}>
                          {kurs.gruppenname} ({kurs.stil})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div>
                      <span className="stundenplan-value kurs-name">{eintrag.kursname || "Unbekannt"}</span>
                      <div className="stil-tag">{eintrag.stil || "?"}</div>
                    </div>
                  )}
                </div>

                <div className="stundenplan-field">
                  <label>👨‍🏫 Trainer:</label>
                  <span className="stundenplan-value trainer-name">
                    {`${eintrag.trainer_vorname || "?"} ${eintrag.trainer_nachname || ""}`.trim()}
                  </span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="no-stundenplan-message">
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <h3>Kein Stundenplan vorhanden</h3>
              <p>Klicken Sie auf „Stunde hinzufügen" um den ersten Eintrag zu erstellen.</p>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Neuen Stundenplan-Eintrag hinzufügen */}
      {showAddModal && (
        <div className="ku-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
          <div className="ku-modal">
            <div className="ku-modal-header">
              <span className="ku-modal-title">➕ Stunde hinzufügen</span>
              <button className="ku-modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="stundenplan-form-modern" style={{padding: '20px'}}>
              <div className="form-group">
                <label>📅 Wochentag:</label>
                <select className="form-select" value={neuerKurs.tag} onChange={(e) => setNeuerKurs({ ...neuerKurs, tag: e.target.value })}>
                  <option value="">Tag auswählen</option>
                  {wochentage.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>🕐 Startzeit:</label>
                <input type="time" className="form-input" value={neuerKurs.uhrzeit_start} onChange={(e) => setNeuerKurs({ ...neuerKurs, uhrzeit_start: e.target.value })} />
              </div>
              <div className="form-group">
                <label>🕑 Endzeit:</label>
                <input type="time" className="form-input" value={neuerKurs.uhrzeit_ende} onChange={(e) => setNeuerKurs({ ...neuerKurs, uhrzeit_ende: e.target.value })} />
              </div>
              <div className="form-group">
                <label>🥋 Kurs:</label>
                <select className="form-select" value={neuerKurs.kurs_id} onChange={(e) => setNeuerKurs({ ...neuerKurs, kurs_id: e.target.value })}>
                  <option value="">Kurs auswählen</option>
                  {kurse.map((kurs) => <option key={kurs.kurs_id} value={kurs.kurs_id}>{kurs.gruppenname} ({kurs.stil})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>🏢 Raum:</label>
                <select className="form-select" value={neuerKurs.raum_id} onChange={(e) => setNeuerKurs({ ...neuerKurs, raum_id: e.target.value })}>
                  <option value="">Kein Raum</option>
                  {raeume.filter(raum => raum.aktiv).map((raum) => <option key={raum.id} value={raum.id}>{raum.name} {raum.groesse ? `(${raum.groesse})` : ''}</option>)}
                </select>
              </div>
              <button className="add-button-modern" onClick={async () => { await handleHinzufuegen(); setShowAddModal(false); }}>
                <span className="btn-icon">➕</span> Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// CapacityBar — zeigt Kursauslastung als kleinen Fortschrittsbalken
const CapacityBar = ({ data, compact = false }) => {
  const { teilnehmer, max_teilnehmer } = data;
  const pct = max_teilnehmer ? Math.min(100, Math.round((teilnehmer / max_teilnehmer) * 100)) : null;
  const color = pct === null ? '#6366f1' : pct >= 90 ? '#ef4444' : pct >= 70 ? '#f97316' : '#22c55e';

  if (compact) {
    return (
      <div style={{ marginTop: '4px', fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>
        👥 {teilnehmer}{max_teilnehmer ? `/${max_teilnehmer}` : ''}
        {pct !== null && (
          <div style={{ height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', marginTop: '2px' }}>
            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px' }} />
          </div>
        )}
      </div>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
      👥 {teilnehmer}{max_teilnehmer ? `/${max_teilnehmer} Plätze` : ' Teilnehmer (letzte 30 Tage)'}
      {pct !== null && (
        <span style={{ display: 'inline-block', width: '50px', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', verticalAlign: 'middle' }}>
          <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: color, borderRadius: '2px' }} />
        </span>
      )}
      {pct !== null && <span style={{ color }}>{pct}%</span>}
    </span>
  );
};

export default Stundenplan;