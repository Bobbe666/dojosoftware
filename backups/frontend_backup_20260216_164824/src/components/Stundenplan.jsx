import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import "../styles/themes.css";       // Centralized theme system
import "../styles/components.css";   // Universal component styles
import "../styles/Stundenplan.css";
import { DatenContext } from "@shared/DatenContext.jsx";
import { useStandortContext } from '../context/StandortContext.jsx';

const Stundenplan = () => {
  const { kurse } = useContext(DatenContext);
  const { standorte, activeStandort, hasMultipleLocations } = useStandortContext();
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

  const wochentage = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];

  useEffect(() => {
    ladeDaten();
  }, []);

  const ladeDaten = async () => {
    try {
      const [stundenRes, raeumeRes] = await Promise.all([
        axios.get('/stundenplan'),
        axios.get('/raeume')
      ]);
      setStundenplan(stundenRes.data);
      setRaeume(raeumeRes.data.data || raeumeRes.data || []);
    } catch (err) {
      console.error("Fehler beim Laden:", err);
      setError("Fehler beim Laden der Daten");
    } finally {
      setLoading(false);
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

  // Filter by active standort
  const filteredStundenplan = stundenplan.filter(eintrag => {
    if (activeStandort === 'all') return true;
    if (!eintrag.standort_id) return true; // Show entries without standort
    return eintrag.standort_id === activeStandort;
  });

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
  if (error) return <div className="stundenplan-container-modern error">{error}</div>;

  return (
    <div className="stundenplan-container-modern">
      <div className="stundenplan-header">
        <h2>📋 Stundenplan-Verwaltung</h2>
        <p className="stundenplan-subtitle">Kurszeiten und Trainingsplan verwalten</p>
      </div>

      {/* Export Controls */}
      <div className="stundenplan-controls">
        <button className="export-button-modern" onClick={handleCSVExport}>
          📊 CSV Export
        </button>
      </div>

      {/* Statistiken */}
      <div className="stundenplan-stats">
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📅</span>
            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffffff' }}>
              {filteredStundenplan.length}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Einträge
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🏃‍♂️</span>
            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffffff' }}>
              {new Set(filteredStundenplan.map(s => s.tag)).size}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Trainingstage
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🥋</span>
            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffffff' }}>
              {new Set(filteredStundenplan.map(s => s.kurs_id)).size}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Kurse
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⏰</span>
            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffffff' }}>
              {filteredStundenplan.length > 0 ? formatTime(filteredStundenplan.reduce((earliest, s) => s.uhrzeit_start < earliest ? s.uhrzeit_start : earliest, filteredStundenplan[0].uhrzeit_start)) : '--'}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Frühester Start
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🌙</span>
            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffffff' }}>
              {filteredStundenplan.length > 0 ? formatTime(filteredStundenplan.reduce((latest, s) => s.uhrzeit_ende > latest ? s.uhrzeit_ende : latest, filteredStundenplan[0].uhrzeit_ende)) : '--'}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Spätestes Ende
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📊</span>
            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffffff' }}>
              {filteredStundenplan.filter(s => s.tag === 'Montag').length}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
            Montags
          </div>
        </div>
        <div className="stat-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.1rem' }}>
            <span style={{ fontSize: '1.2rem' }}>🎉</span>
            <span style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#ffffff' }}>
              {filteredStundenplan.filter(s => s.tag === 'Samstag' || s.tag === 'Sonntag').length}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
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
                                className="mini-standort"
                                style={{
                                  background: eintrag.standort_farbe || '#4F46E5',
                                  color: 'white',
                                  padding: '3px 8px',
                                  fontSize: '0.65rem',
                                  fontWeight: '600',
                                  borderRadius: '4px',
                                  marginTop: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <span style={{ fontSize: '0.75rem' }}>📍</span>
                                <span>{eintrag.standort_name}</span>
                              </div>
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
                                style={{
                                  background: eintrag.standort_farbe || '#4F46E5',
                                  color: 'white',
                                  padding: '4px 10px',
                                  fontSize: '0.75rem',
                                  fontWeight: '600',
                                  borderRadius: '5px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <span>📍</span>
                                <span>{eintrag.standort_name}</span>
                              </span>
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

      {/* Altes Card-System als Backup falls gewünscht */}
      <div className="stundenplan-grid" style={{display: 'none'}}>
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
                    <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                      <input
                        type="time"
                        className="edit-input-small"
                        value={editingData.uhrzeit_start}
                        onChange={(e) => setEditingData({ ...editingData, uhrzeit_start: e.target.value })}
                      />
                      <span style={{color: '#ffffff'}}>bis</span>
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
              <p>Fügen Sie unten den ersten Stundenplan-Eintrag hinzu.</p>
            </div>
          </div>
        )}
      </div>

      {/* Formular für neuen Stundenplan-Eintrag */}
      <div className="neuer-stundenplan-card" style={{
        animationDelay: `${sortedEintraege.length * 0.1 + 0.3}s`,
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        background: 'rgba(30, 30, 50, 0.95)'
      }}>
        <div className="card-header">
          <h3 style={{
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            filter: 'none',
            textShadow: '0 2px 10px rgba(255, 215, 0, 0.3)'
          }}>➕ Neuen Stundenplan-Eintrag hinzufügen</h3>
        </div>
        <div className="stundenplan-form-modern">
          <div className="form-group">
            <label>📅 Wochentag:</label>
            <select
              className="form-select"
              value={neuerKurs.tag}
              onChange={(e) => setNeuerKurs({ ...neuerKurs, tag: e.target.value })}
            >
              <option value="">Tag auswählen</option>
              {wochentage.map((tag) => (
                <option key={tag} value={tag}>{tag}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>🕐 Startzeit:</label>
            <input
              type="time"
              className="form-input"
              value={neuerKurs.uhrzeit_start}
              onChange={(e) => setNeuerKurs({ ...neuerKurs, uhrzeit_start: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>🕑 Endzeit:</label>
            <input
              type="time"
              className="form-input"
              value={neuerKurs.uhrzeit_ende}
              onChange={(e) => setNeuerKurs({ ...neuerKurs, uhrzeit_ende: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>🥋 Kurs:</label>
            <select
              className="form-select"
              value={neuerKurs.kurs_id}
              onChange={(e) => setNeuerKurs({ ...neuerKurs, kurs_id: e.target.value })}
            >
              <option value="">Kurs auswählen</option>
              {kurse.map((kurs) => (
                <option key={kurs.kurs_id} value={kurs.kurs_id}>
                  {kurs.gruppenname} ({kurs.stil})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>🏢 Raum:</label>
            <select
              className="form-select"
              value={neuerKurs.raum_id}
              onChange={(e) => setNeuerKurs({ ...neuerKurs, raum_id: e.target.value })}
            >
              <option value="">Kein Raum</option>
              {raeume.filter(raum => raum.aktiv).map((raum) => (
                <option key={raum.id} value={raum.id}>
                  {raum.name} {raum.groesse ? `(${raum.groesse})` : ''}
                </option>
              ))}
            </select>
          </div>

          <button className="add-button-modern" onClick={handleHinzufuegen}>
            <span className="btn-icon">➕</span>
            Stundenplan-Eintrag hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
};

export default Stundenplan;