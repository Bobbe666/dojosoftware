// ============================================================================
// PRÜFUNG DURCHFÜHREN - Live Prüfungsansicht für den Prüfungstag
// Frontend/src/components/PruefungDurchfuehren.jsx
// Route: /dashboard/pruefung-durchfuehren
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useDojoContext } from '../context/DojoContext';
import { Check, X, ChevronUp, ChevronDown, Award, Save, Calendar, AlertCircle } from 'lucide-react';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/Buttons.css';

const PruefungDurchfuehren = () => {
  const { getDojoFilterParam, activeDojo } = useDojoContext();
  const API_BASE_URL = '/api';

  // State
  const [pruefungen, setPruefungen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [datumFilter, setDatumFilter] = useState('alle'); // alle, zukuenftig, vergangen
  const [selectedDatum, setSelectedDatum] = useState('');
  const [selectedStil, setSelectedStil] = useState('all');
  const [expandedDates, setExpandedDates] = useState(new Set());
  const [stile, setStile] = useState([]);
  const [graduierungen, setGraduierungen] = useState({});

  // Inline Prüfling bearbeiten
  const [editingPruefling, setEditingPruefling] = useState(null);
  const [ergebnisse, setErgebnisse] = useState({}); // Key: pruefung_id, Value: ergebnis-Objekt

  useEffect(() => {
    fetchStile();
    fetchPruefungen();
  }, []);

  const fetchStile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stile`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      console.log('📚 Stile geladen:', data);
      setStile(data || []);

      // Graduierungen für jeden Stil laden
      const gradMap = {};
      for (const stil of data) {
        const stilId = stil.stil_id || stil.id;
        const gradRes = await fetch(`${API_BASE_URL}/stile/${stilId}/graduierungen`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const gradData = await gradRes.json();
        console.log(`🥋 Graduierungen für ${stil.name} (ID: ${stilId}):`, gradData);
        gradMap[stilId] = gradData || [];
      }
      console.log('✅ Alle Graduierungen geladen:', gradMap);
      setGraduierungen(gradMap);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Stile:', error);
    }
  };

  const fetchPruefungen = async () => {
    setLoading(true);
    setError('');
    try {
      const dojoParam = getDojoFilterParam();
      // Lade alle Prüfungen (geplant, bestanden, nicht_bestanden) für die Durchführung
      const response = await fetch(
        `${API_BASE_URL}/pruefungen?${dojoParam}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );

      if (!response.ok) throw new Error('Fehler beim Laden der Prüfungen');

      const data = await response.json();
      console.log('📋 Alle Prüfungen geladen:', data);
      // Backend gibt { success: true, count: X, pruefungen: [...] } zurück
      setPruefungen(data.pruefungen || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEdit = (pruefling) => {
    if (editingPruefling?.pruefung_id === pruefling.pruefung_id) {
      // Bereits im Edit-Modus, also schließen
      setEditingPruefling(null);
    } else {
      // Graduierungen für diesen Stil laden
      const grads = graduierungen[pruefling.stil_id] || [];
      console.log('🎯 Graduierungen für Stil', pruefling.stil_id, ':', grads);
      console.log('📋 Prüfling:', pruefling);

      // Prüfe ob bereits eine Graduierung gespeichert ist
      let targetGurtIndex, targetGurt;

      if (pruefling.graduierung_nachher_id) {
        // Verwende gespeicherte Graduierung
        targetGurtIndex = grads.findIndex(g => g.id === pruefling.graduierung_nachher_id);
        targetGurt = grads[targetGurtIndex];
        console.log('📌 Verwende gespeicherte Graduierung:', targetGurt);
      } else {
        // Berechne nächste Graduierung
        const currentIndex = grads.findIndex(g => g.id === pruefling.graduierung_vorher_id);
        targetGurtIndex = Math.min(currentIndex + 1, grads.length - 1);
        targetGurt = grads[targetGurtIndex];
        console.log('🆕 Berechne nächste Graduierung:', targetGurt);
      }

      console.log('📍 Target Index:', targetGurtIndex);
      console.log('🥋 Target Gurt:', targetGurt);

      // Ergebnisse IMMER neu setzen, auch wenn schon vorhanden
      const neuesErgebnis = {
        bestanden: pruefling.bestanden || false,
        punktzahl: pruefling.punktzahl || '',
        max_punktzahl: pruefling.max_punktzahl || 100,
        prueferkommentar: pruefling.prueferkommentar || '',
        neuer_gurt_index: targetGurtIndex,
        neuer_gurt_id: targetGurt?.id || pruefling.graduierung_nachher_id,
        neuer_gurt_name: targetGurt?.name || '',
        neuer_gurt_farbe: targetGurt?.farbe_hex || ''
      };

      console.log('✅ Neues Ergebnis:', neuesErgebnis);

      // State synchron setzen
      setErgebnisse(prev => ({
        ...prev,
        [pruefling.pruefung_id]: neuesErgebnis
      }));

      // Editing-Modus öffnen
      setEditingPruefling(pruefling);
    }
  };

  const handleGurtAendern = (pruefungId, stilId, richtung) => {
    console.log(`🔄 Gurt ändern: Prüfung ${pruefungId}, Stil ${stilId}, Richtung: ${richtung}`);

    setErgebnisse(prev => {
      const grads = graduierungen[stilId] || [];
      console.log('📋 Verfügbare Graduierungen:', grads);

      const currentErgebnis = prev[pruefungId];
      if (!currentErgebnis) {
        console.log('❌ Kein Ergebnis gefunden für Prüfung', pruefungId);
        return prev;
      }

      let newIndex = currentErgebnis.neuer_gurt_index;
      console.log('📍 Aktueller Index:', newIndex);

      if (richtung === 'up') {
        newIndex = Math.min(newIndex + 1, grads.length - 1);
      } else if (richtung === 'down') {
        newIndex = Math.max(newIndex - 1, 0);
      }

      console.log('📍 Neuer Index:', newIndex);

      const newGrad = grads[newIndex];
      if (!newGrad) {
        console.log('❌ Keine Graduierung für Index', newIndex);
        return prev;
      }

      console.log('✅ Neue Graduierung:', newGrad);

      return {
        ...prev,
        [pruefungId]: {
          ...currentErgebnis,
          neuer_gurt_index: newIndex,
          neuer_gurt_id: newGrad.id,
          neuer_gurt_name: newGrad.name,
          neuer_gurt_farbe: newGrad.farbe_hex
        }
      };
    });
  };

  const updateErgebnis = (pruefungId, field, value) => {
    setErgebnisse(prev => ({
      ...prev,
      [pruefungId]: {
        ...prev[pruefungId],
        [field]: value
      }
    }));
  };

  const handleSpeichern = async (pruefling) => {
    const ergebnis = ergebnisse[pruefling.pruefung_id];
    if (!ergebnis) return;

    try {
      setLoading(true);
      // Prüfungsergebnis speichern
      const updateData = {
        bestanden: ergebnis.bestanden,
        punktzahl: ergebnis.punktzahl ? parseFloat(ergebnis.punktzahl) : null,
        max_punktzahl: ergebnis.max_punktzahl ? parseFloat(ergebnis.max_punktzahl) : null,
        prueferkommentar: ergebnis.prueferkommentar,
        status: ergebnis.bestanden ? 'bestanden' : 'nicht_bestanden'
      };

      // Bei bestandener Prüfung: graduierung_nachher_id mit neuem Gurt aktualisieren
      if (ergebnis.bestanden && ergebnis.neuer_gurt_id) {
        updateData.graduierung_nachher_id = ergebnis.neuer_gurt_id;
      }

      const response = await fetch(
        `${API_BASE_URL}/pruefungen/${pruefling.pruefung_id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) throw new Error('Fehler beim Speichern');

      // Bei bestandener Prüfung: Gurt aktualisieren
      if (ergebnis.bestanden && ergebnis.neuer_gurt_id) {
        console.log('🎖️ Aktualisiere Graduierung:', {
          mitglied_id: pruefling.mitglied_id,
          stil_id: pruefling.stil_id,
          graduierung_id: ergebnis.neuer_gurt_id,
          pruefungsdatum: pruefling.pruefungsdatum,
          pruefling: pruefling
        });

        await updateMemberGraduierung(
          pruefling.mitglied_id,
          pruefling.stil_id,
          ergebnis.neuer_gurt_id,
          pruefling.pruefungsdatum
        );
      }

      setSuccess('Prüfungsergebnis erfolgreich gespeichert!');
      setEditingPruefling(null);
      fetchPruefungen();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const updateMemberGraduierung = async (mitgliedId, stilId, graduierungId, pruefungsdatum) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/mitglieder/${mitgliedId}/graduierung`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            stil_id: stilId,
            graduierung_id: graduierungId,
            pruefungsdatum: pruefungsdatum
          })
        }
      );

      if (!response.ok) throw new Error('Fehler beim Aktualisieren der Graduierung');
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Graduierung:', error);
      throw error;
    }
  };


  const getStatusBadge = (pruefling) => {
    if (pruefling.status === 'bestanden') {
      return <span className="badge badge-success">✓ Bestanden</span>;
    } else if (pruefling.status === 'nicht_bestanden') {
      return <span className="badge badge-danger">✗ Nicht bestanden</span>;
    } else {
      return <span className="badge badge-warning">⏳ Offen</span>;
    }
  };

  return (
    <div className="content-card">
      <div className="page-header">
        <div>
          <h1>🏆 Prüfung durchführen</h1>
          <p>Live-Ansicht für den Prüfungstag - Ergebnisse direkt eintragen</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: '1rem' }}>
          <Check size={20} />
          {success}
        </div>
      )}

      {/* Filter-Bereich */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        padding: '1.5rem',
        borderRadius: '12px',
        marginBottom: '2rem',
        border: '1px solid rgba(255, 215, 0, 0.2)'
      }}>
        {/* Datum-Filter und Auswahl */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '600', color: '#FFD700', fontSize: '1rem' }}>
            <Calendar size={18} style={{ display: 'inline', marginRight: '0.5rem' }} />
            Zeitraum
          </label>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button
              onClick={() => setDatumFilter('alle')}
              className={`btn btn-primary ${datumFilter === 'alle' ? 'active' : ''}`}
            >
              Alle
            </button>
            <button
              onClick={() => setDatumFilter('zukuenftig')}
              className={`btn btn-info ${datumFilter === 'zukuenftig' ? 'active' : ''}`}
            >
              Zukünftig
            </button>
            <button
              onClick={() => setDatumFilter('vergangen')}
              className={`btn btn-neutral ${datumFilter === 'vergangen' ? 'active' : ''}`}
            >
              Vergangen
            </button>
          </div>

          {/* Datumsauswahl für direkte Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
              Zu Datum springen:
            </label>
            <input
              type="date"
              value={selectedDatum}
              onChange={(e) => setSelectedDatum(e.target.value)}
              style={{
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                background: 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                fontSize: '0.9rem'
              }}
            />
            {selectedDatum && (
              <button
                onClick={() => setSelectedDatum('')}
                className="btn btn-sm btn-secondary"
              >
                Zurücksetzen
              </button>
            )}
          </div>
        </div>

        {/* Stil-Filter */}
        <div>
          <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: '600', color: '#FFD700', fontSize: '1rem' }}>
            Kampfkunst-Stil
          </label>
          <select
            value={selectedStil}
            onChange={(e) => setSelectedStil(e.target.value)}
            style={{
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'white',
              fontSize: '0.95rem',
              cursor: 'pointer',
              minWidth: '200px'
            }}
          >
            <option value="all" style={{ background: '#1a1a2e' }}>Alle Stile</option>
            {stile.map(stil => (
              <option key={stil.stil_id} value={stil.stil_id} style={{ background: '#1a1a2e' }}>
                {stil.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Termin-Cards */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner"></div>
          <p>Lade Prüfungen...</p>
        </div>
      ) : pruefungen.length === 0 ? (
        <div className="empty-state">
          <Calendar size={48} />
          <h3>Keine Prüfungen gefunden</h3>
          <p>Es gibt keine geplanten Prüfungen.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {(() => {
            const heute = new Date();
            heute.setHours(0, 0, 0, 0);

            // Filter nach Datum, Stil und Datumsauswahl
            let gefiltert = pruefungen.filter(pruefung => {
              // Stil-Filter
              if (selectedStil !== 'all' && pruefung.stil_id !== parseInt(selectedStil)) {
                return false;
              }

              // Datumsauswahl (direkter Sprung zu einem Datum)
              if (selectedDatum) {
                const selectedDate = new Date(selectedDatum);
                selectedDate.setHours(0, 0, 0, 0);
                const pruefungsDatum = new Date(pruefung.pruefungsdatum);
                pruefungsDatum.setHours(0, 0, 0, 0);
                return pruefungsDatum.getTime() === selectedDate.getTime();
              }

              // Zeitraum-Filter
              if (!pruefung.pruefungsdatum) return true;

              const pruefungsDatum = new Date(pruefung.pruefungsdatum);
              pruefungsDatum.setHours(0, 0, 0, 0);

              if (datumFilter === 'zukuenftig') {
                return pruefungsDatum >= heute;
              } else if (datumFilter === 'vergangen') {
                return pruefungsDatum < heute;
              }
              return true; // 'alle'
            });

            // Nach Datum gruppieren
            const grouped = {};
            gefiltert.forEach(pruefung => {
              const datum = pruefung.pruefungsdatum || 'Kein Datum';
              if (!grouped[datum]) {
                grouped[datum] = [];
              }
              grouped[datum].push(pruefung);
            });

            // Sortiere Daten
            const sortedDates = Object.keys(grouped).sort((a, b) => {
              if (a === 'Kein Datum') return 1;
              if (b === 'Kein Datum') return -1;

              const dateA = new Date(a);
              const dateB = new Date(b);
              dateA.setHours(0, 0, 0, 0);
              dateB.setHours(0, 0, 0, 0);

              const isAFuture = dateA >= heute;
              const isBFuture = dateB >= heute;

              // Beide zukünftig: aufsteigend
              if (isAFuture && isBFuture) return dateA - dateB;
              // Beide vergangen: absteigend
              if (!isAFuture && !isBFuture) return dateB - dateA;
              // Zukünftige vor vergangenen
              return isAFuture ? -1 : 1;
            });

            const toggleDate = (datum) => {
              const newExpanded = new Set(expandedDates);
              if (newExpanded.has(datum)) {
                newExpanded.delete(datum);
              } else {
                newExpanded.add(datum);
              }
              setExpandedDates(newExpanded);
            };

            const formatDatum = (datum) => {
              if (datum === 'Kein Datum') return datum;
              const date = new Date(datum);
              const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
              return date.toLocaleDateString('de-DE', options);
            };

            const isPast = (datum) => {
              if (datum === 'Kein Datum') return false;
              const date = new Date(datum);
              date.setHours(0, 0, 0, 0);
              return date < heute;
            };

            const isToday = (datum) => {
              if (datum === 'Kein Datum') return false;
              const date = new Date(datum);
              date.setHours(0, 0, 0, 0);
              return date.getTime() === heute.getTime();
            };

            return sortedDates.map(datum => {
              const pruefungenAmTag = grouped[datum];
              const isExpanded = expandedDates.has(datum);
              const past = isPast(datum);
              const today = isToday(datum);

              return (
                <div
                  key={datum}
                  style={{
                    background: today
                      ? 'rgba(59, 130, 246, 0.1)'
                      : past
                        ? 'rgba(255, 255, 255, 0.03)'
                        : 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    border: today
                      ? '2px solid rgba(59, 130, 246, 0.5)'
                      : past
                        ? '1px solid rgba(156, 163, 175, 0.2)'
                        : '1px solid rgba(255, 215, 0, 0.3)',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {/* Termin-Header */}
                  <div
                    onClick={() => toggleDate(datum)}
                    style={{
                      padding: '1.25rem 1.5rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: today
                        ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.05) 100%)'
                        : past
                          ? 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(156, 163, 175, 0.05) 100%)'
                          : 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 100%)',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = today
                        ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(59, 130, 246, 0.1) 100%)'
                        : past
                          ? 'linear-gradient(135deg, rgba(156, 163, 175, 0.25) 0%, rgba(156, 163, 175, 0.1) 100%)'
                          : 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 100%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = today
                        ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.05) 100%)'
                        : past
                          ? 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(156, 163, 175, 0.05) 100%)'
                          : 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 100%)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <Calendar
                        size={28}
                        style={{
                          color: today ? '#3b82f6' : past ? '#9ca3af' : '#FFD700'
                        }}
                      />
                      <div>
                        <h3 style={{
                          margin: 0,
                          fontSize: '1.2rem',
                          color: today ? '#3b82f6' : past ? '#9ca3af' : '#FFD700',
                          fontWeight: '700'
                        }}>
                          {formatDatum(datum)}
                          {today && <span style={{ marginLeft: '0.75rem', fontSize: '0.9rem', fontWeight: '600' }}>• HEUTE</span>}
                          {past && <span style={{ marginLeft: '0.75rem', fontSize: '0.9rem', fontWeight: '500', opacity: 0.7 }}>• vergangen</span>}
                        </h3>
                        <p style={{
                          margin: '0.25rem 0 0 0',
                          fontSize: '0.95rem',
                          color: 'rgba(255, 255, 255, 0.7)'
                        }}>
                          {pruefungenAmTag.length} {pruefungenAmTag.length === 1 ? 'Prüfling' : 'Prüflinge'}
                        </p>
                      </div>
                    </div>

                    <ChevronDown
                      size={24}
                      style={{
                        color: today ? '#3b82f6' : past ? '#9ca3af' : '#FFD700',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                      }}
                    />
                  </div>

                  {/* Teilnehmer-Liste (expandierbar) */}
                  {isExpanded && (
                    <div style={{ padding: '0 1rem 1rem 1rem' }}>
                      {pruefungenAmTag.map((pruefling, index) => {
                        const isEditing = editingPruefling?.pruefung_id === pruefling.pruefung_id;
                        const ergebnis = ergebnisse[pruefling.pruefung_id] || {
                          bestanden: false,
                          punktzahl: '',
                          max_punktzahl: 100,
                          prueferkommentar: '',
                          neuer_gurt_name: ''
                        };

                        return (
                          <div
                            key={index}
                            style={{
                              marginTop: '0.75rem',
                              background: isEditing ? 'rgba(255, 215, 0, 0.08)' : 'rgba(255, 255, 255, 0.05)',
                              borderRadius: '8px',
                              border: isEditing ? '2px solid rgba(255, 215, 0, 0.5)' : '1px solid rgba(255, 215, 0, 0.2)',
                              overflow: 'hidden',
                              transition: 'all 0.3s ease'
                            }}
                          >
                            {/* Prüfling Header */}
                            <div
                              onClick={() => handleToggleEdit(pruefling)}
                              style={{
                                padding: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                if (!isEditing) {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                                <div style={{
                                  width: '40px',
                                  height: '40px',
                                  borderRadius: '50%',
                                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '1.1rem',
                                  fontWeight: 'bold',
                                  color: '#1a1a2e'
                                }}>
                                  {index + 1}
                                </div>

                                <div style={{ flex: 1 }}>
                                  <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#FFD700' }}>
                                    {pruefling.vorname} {pruefling.nachname}
                                  </h4>
                                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                                    {pruefling.stil_name} • {pruefling.graduierung_vorher} → {pruefling.graduierung_nachher}
                                  </p>
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                  {getStatusBadge(pruefling)}

                                  {pruefling.punktzahl && (
                                    <div style={{
                                      padding: '0.4rem 0.8rem',
                                      background: 'rgba(255, 215, 0, 0.1)',
                                      borderRadius: '6px',
                                      fontWeight: '600',
                                      fontSize: '0.9rem'
                                    }}>
                                      {pruefling.punktzahl} / {pruefling.max_punktzahl} Pkt.
                                    </div>
                                  )}
                                </div>
                              </div>

                              <ChevronDown
                                size={20}
                                style={{
                                  color: '#FFD700',
                                  transform: isEditing ? 'rotate(180deg)' : 'rotate(0deg)',
                                  marginLeft: '0.5rem',
                                  transition: 'transform 0.3s ease'
                                }}
                              />
                            </div>

                            {/* Inline Edit-Formular */}
                            {isEditing && (
                              <div style={{
                                padding: '1.5rem',
                                borderTop: '1px solid rgba(255, 215, 0, 0.3)',
                                background: 'rgba(0, 0, 0, 0.2)'
                              }}>
                                {/* Kompakte Ergebnis-Zeile: Alles in einer Reihe */}
                                <div style={{
                                  display: 'flex',
                                  gap: '0.75rem',
                                  marginBottom: '1.5rem',
                                  alignItems: 'flex-end',
                                  flexWrap: 'wrap'
                                }}>
                                  {/* Bestanden Buttons */}
                                  <div style={{ flex: '0 0 auto' }}>
                                    <label style={{
                                      display: 'block',
                                      marginBottom: '0.4rem',
                                      fontWeight: '600',
                                      color: '#FFD700',
                                      fontSize: '0.75rem'
                                    }}>
                                      Ergebnis
                                    </label>
                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => updateErgebnis(pruefling.pruefung_id, 'bestanden', true)}
                                        className={`btn-toggle btn-toggle-success ${ergebnis.bestanden ? 'active' : ''}`}
                                        style={{
                                          padding: '0.4rem 0.6rem',
                                          fontSize: '0.75rem',
                                          minWidth: 'auto'
                                        }}
                                      >
                                        <Check size={14} />
                                        Bestanden
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => updateErgebnis(pruefling.pruefung_id, 'bestanden', false)}
                                        className={`btn-toggle btn-toggle-danger ${!ergebnis.bestanden ? 'active' : ''}`}
                                        style={{
                                          padding: '0.4rem 0.6rem',
                                          fontSize: '0.75rem',
                                          minWidth: 'auto'
                                        }}
                                      >
                                        <X size={14} />
                                        Nicht bestanden
                                      </button>
                                    </div>
                                  </div>

                                  {/* Gurt-Auswahl - sehr kompakt */}
                                  {ergebnis.bestanden && (
                                    <div style={{ flex: '0 0 auto', minWidth: '180px' }}>
                                      <label style={{
                                        display: 'block',
                                        marginBottom: '0.4rem',
                                        fontWeight: '600',
                                        color: '#FFD700',
                                        fontSize: '0.75rem'
                                      }}>
                                        <Award size={12} style={{ display: 'inline', marginRight: '0.3rem' }} />
                                        Neuer Gurt
                                      </label>

                                      <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.3rem'
                                      }}>
                                        <button
                                          type="button"
                                          onClick={() => handleGurtAendern(pruefling.pruefung_id, pruefling.stil_id, 'down')}
                                          style={{
                                            padding: '0.3rem',
                                            borderRadius: '4px',
                                            border: '1px solid rgba(255, 215, 0, 0.3)',
                                            background: 'rgba(255, 215, 0, 0.1)',
                                            color: '#FFD700',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center'
                                          }}
                                          title="Gurt herabstufen"
                                        >
                                          <ChevronDown size={14} />
                                        </button>

                                        <div style={{
                                          flex: 1,
                                          textAlign: 'center',
                                          padding: '0.3rem 0.5rem',
                                          background: ergebnis.neuer_gurt_farbe || 'rgba(255, 255, 255, 0.1)',
                                          borderRadius: '4px',
                                          border: '1px solid rgba(255, 215, 0, 0.3)',
                                          minWidth: '80px'
                                        }}>
                                          <span style={{
                                            fontSize: '0.75rem',
                                            color: ergebnis.neuer_gurt_farbe ? '#1a1a2e' : '#FFD700',
                                            fontWeight: '600'
                                          }}>
                                            {ergebnis.neuer_gurt_name || 'Kein Gurt'}
                                          </span>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleGurtAendern(pruefling.pruefung_id, pruefling.stil_id, 'up')}
                                          style={{
                                            padding: '0.3rem',
                                            borderRadius: '4px',
                                            border: '1px solid rgba(255, 215, 0, 0.3)',
                                            background: 'rgba(255, 215, 0, 0.1)',
                                            color: '#FFD700',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            display: 'flex',
                                            alignItems: 'center'
                                          }}
                                          title="Gurt hochstufen"
                                        >
                                          <ChevronUp size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Erreichte Punktzahl */}
                                  <div style={{ flex: '0 0 auto', minWidth: '100px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', color: '#FFD700', fontSize: '0.75rem' }}>
                                      Erreicht
                                    </label>
                                    <input
                                      type="number"
                                      value={ergebnis.punktzahl || ''}
                                      onChange={(e) => updateErgebnis(pruefling.pruefung_id, 'punktzahl', e.target.value)}
                                      placeholder="85"
                                      className="form-input"
                                      style={{
                                        fontSize: '0.8rem',
                                        padding: '0.4rem',
                                        width: '100%',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 215, 0, 0.3)',
                                        borderRadius: '6px',
                                        color: 'white'
                                      }}
                                    />
                                  </div>

                                  {/* Maximale Punktzahl */}
                                  <div style={{ flex: '0 0 auto', minWidth: '100px' }}>
                                    <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '600', color: '#FFD700', fontSize: '0.75rem' }}>
                                      Max.
                                    </label>
                                    <input
                                      type="number"
                                      value={ergebnis.max_punktzahl || 100}
                                      onChange={(e) => updateErgebnis(pruefling.pruefung_id, 'max_punktzahl', e.target.value)}
                                      className="form-input"
                                      style={{
                                        fontSize: '0.8rem',
                                        padding: '0.4rem',
                                        width: '100%',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 215, 0, 0.3)',
                                        borderRadius: '6px',
                                        color: 'white'
                                      }}
                                    />
                                  </div>
                                </div>

                                {/* Prüferkommentar */}
                                <div style={{ marginBottom: '1.5rem' }}>
                                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#FFD700', fontSize: '0.95rem' }}>
                                    Prüferkommentar / Bemerkungen
                                  </label>
                                  <textarea
                                    value={ergebnis.prueferkommentar || ''}
                                    onChange={(e) => updateErgebnis(pruefling.pruefung_id, 'prueferkommentar', e.target.value)}
                                    rows="3"
                                    placeholder="Notizen zum Prüfungsverlauf, Stärken, Schwächen, etc."
                                    style={{
                                      width: '100%',
                                      fontSize: '0.95rem',
                                      padding: '0.7rem',
                                      background: 'rgba(255, 255, 255, 0.05)',
                                      border: '1px solid rgba(255, 215, 0, 0.3)',
                                      borderRadius: '6px',
                                      color: 'white',
                                      resize: 'vertical'
                                    }}
                                  />
                                </div>

                                {/* Aktionen */}
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                  <button
                                    onClick={() => setEditingPruefling(null)}
                                    className="btn btn-secondary"
                                  >
                                    Abbrechen
                                  </button>
                                  <button
                                    onClick={() => handleSpeichern(pruefling)}
                                    className="btn btn-icon btn-success"
                                  >
                                    <Save size={18} />
                                    Speichern
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}
    </div>
  );
};

export default PruefungDurchfuehren;
