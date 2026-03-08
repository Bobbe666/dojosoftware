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
import '../styles/Dashboard.css';
import '../styles/PruefungDurchfuehren.css';

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

  // Bewertungs-States
  const [pruefungsinhalte, setPruefungsinhalte] = useState({}); // Key: pruefung_id, Value: Inhalte
  const [bewertungen, setBewertungen] = useState({}); // Key: pruefung_id, Value: Bewertungen-Objekt

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
      // Lade Prüfungsinhalte
      loadPruefungsinhalte(pruefling.pruefung_id, pruefling.stil_id, targetGurt?.id || pruefling.graduierung_nachher_id);
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

      
      // Bewertungen speichern
      const pruefungBewertungen = bewertungen[pruefling.pruefung_id];
      if (pruefungBewertungen) {
        const bewertungenArray = [];
        Object.values(pruefungBewertungen).forEach(kategorieBewertungen => {
          if (Array.isArray(kategorieBewertungen)) {
            kategorieBewertungen.forEach(bew => {
              bewertungenArray.push({
                inhalt_id: bew.inhalt_id,
                bestanden: bew.bestanden,
                punktzahl: bew.punktzahl,
                max_punktzahl: bew.max_punktzahl || 10,
                kommentar: bew.kommentar
              });
            });
          }
        });

        if (bewertungenArray.length > 0) {
          await fetch(`${API_BASE_URL}/pruefungen/${pruefling.pruefung_id}/bewertungen`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bewertungen: bewertungenArray })
          });
        }
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

  // Lädt Prüfungsinhalte für eine Graduierung
  const loadPruefungsinhalte = async (pruefungId, stilId, graduierungId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/stile/${stilId}/graduierungen/${graduierungId}/pruefungsinhalte`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );

      if (!response.ok) {
        console.error('Fehler beim Laden der Prüfungsinhalte');
        return;
      }

      const data = await response.json();
      console.log('📚 Prüfungsinhalte geladen:', data);

      setPruefungsinhalte(prev => ({
        ...prev,
        [pruefungId]: data.pruefungsinhalte || {}
      }));

      // Lade bestehende Bewertungen
      await loadBewertungen(pruefungId);
    } catch (error) {
      console.error('Fehler beim Laden der Prüfungsinhalte:', error);
    }
  };

  // Lädt bestehende Bewertungen für eine Prüfung
  const loadBewertungen = async (pruefungId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/pruefungen/${pruefungId}/bewertungen`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );

      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.bewertungen) {
        setBewertungen(prev => ({
          ...prev,
          [pruefungId]: data.bewertungen
        }));
      }
    } catch (error) {
      console.error('Fehler beim Laden der Bewertungen:', error);
    }
  };

  // Aktualisiert eine einzelne Bewertung
  const updateBewertung = (pruefungId, inhaltId, kategorie, field, value) => {
    console.log('🔧 updateBewertung called:', { pruefungId, inhaltId, kategorie, field, value });

    setBewertungen(prev => {
      const pruefungBewertungen = prev[pruefungId] || {};

      // Kopiere die Kategorie-Arrays, um Mutation zu vermeiden
      const kategorieBewertungen = {};
      Object.keys(pruefungBewertungen).forEach(key => {
        kategorieBewertungen[key] = [...pruefungBewertungen[key]];
      });

      // Stelle sicher, dass Kategorie-Array existiert
      if (!kategorieBewertungen[kategorie]) {
        kategorieBewertungen[kategorie] = [];
      }

      // Finde bestehende Bewertung oder erstelle neue
      const existingIndex = kategorieBewertungen[kategorie].findIndex(b => b.inhalt_id === inhaltId);

      if (existingIndex >= 0) {
        // Aktualisiere bestehende Bewertung - erstelle neues Array
        kategorieBewertungen[kategorie] = kategorieBewertungen[kategorie].map((bew, idx) =>
          idx === existingIndex
            ? { ...bew, [field]: value }
            : bew
        );
        console.log('✏️ Updated existing:', kategorieBewertungen[kategorie][existingIndex]);
      } else {
        // Erstelle neue Bewertung
        const newBewertung = {
          inhalt_id: inhaltId,
          [field]: value
        };
        kategorieBewertungen[kategorie] = [...kategorieBewertungen[kategorie], newBewertung];
        console.log('➕ Created new:', newBewertung);
      }

      const result = {
        ...prev,
        [pruefungId]: kategorieBewertungen
      };
      console.log('📦 New bewertungen state:', result);
      return result;
    });
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
          <h1 className="pd-page-title">Prüfung durchführen</h1>
          <p>Live-Ansicht für den Prüfungstag - Ergebnisse direkt eintragen</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error pd-alert-mb">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success pd-alert-mb">
          <Check size={20} />
          {success}
        </div>
      )}

      {/* Filter-Bereich - Alles in einer Zeile */}
      <div className="pd-filter-box">
        <div className="pd-filter-row">
          {/* Zeitraum-Label und Buttons */}
          <div className="u-flex-row-md">
            <label className="pd-label-primary">
              Zeitraum
            </label>
            <div className="u-flex-gap-sm">
              <button
                onClick={() => setDatumFilter('alle')}
                className={`logout-button${datumFilter === 'alle' ? ' pd-filter-btn--active' : ''}`}
              >
                Alle
              </button>
              <button
                onClick={() => setDatumFilter('zukuenftig')}
                className={`logout-button${datumFilter === 'zukuenftig' ? ' pd-filter-btn--active' : ''}`}
              >
                Zukünftig
              </button>
              <button
                onClick={() => setDatumFilter('vergangen')}
                className={`logout-button${datumFilter === 'vergangen' ? ' pd-filter-btn--active' : ''}`}
              >
                Vergangen
              </button>
            </div>
          </div>

          {/* Datumsauswahl */}
          <div className="u-flex-row-sm">
            <label className="pd-label-secondary">
              Zu Datum springen:
            </label>
            <input
              type="date"
              value={selectedDatum}
              onChange={(e) => setSelectedDatum(e.target.value)}
              className="pd-filter-input"
            />
            {selectedDatum && (
              <button
                onClick={() => setSelectedDatum('')}
                className="logout-button pd-btn-reset">
                Zurücksetzen
              </button>
            )}
          </div>

          {/* Stil-Filter */}
          <div className="u-flex-row-sm">
            <label className="pd-label-primary">
              Kampfkunst-Stil
            </label>
            <select
              value={selectedStil}
              onChange={(e) => setSelectedStil(e.target.value)}
              className="pd-stil-select"
            >
              <option value="all" className="pd-option-dark">Alle Stile</option>
              {stile.map(stil => (
                <option key={stil.stil_id} value={stil.stil_id} className="pd-option-dark">
                  {stil.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Termin-Cards */}
      {loading ? (
        <div className="pd-loading-center">
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
        <div className="pd-grid">
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

              const datumState = today ? 'today' : past ? 'past' : 'future';
              return (
                <div
                  key={datum}
                  className={`pd-datum-card pd-datum-card--${datumState}`}
                >
                  {/* Termin-Header */}
                  <div
                    onClick={() => toggleDate(datum)}
                    className={`pd-datum-header pd-datum-header--${datumState}`}
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
                    <div className="u-flex-row-lg">
                      <Calendar size={28} className="pd-datum-icon" />
                      <div>
                        <h3 className="pd-datum-title">
                          {formatDatum(datum)}
                          {today && <span className="pd-badge-heute">• HEUTE</span>}
                          {past && <span className="pd-badge-vergangen">• vergangen</span>}
                        </h3>
                        <p className="pd-date-sub">
                          {pruefungenAmTag.length} {pruefungenAmTag.length === 1 ? 'Prüfling' : 'Prüflinge'}
                        </p>
                      </div>
                    </div>

                    <ChevronDown
                      size={24}
                      className={`pd-datum-chevron${isExpanded ? ' pd-datum-chevron--expanded' : ''}`}
                    />
                  </div>

                  {/* Teilnehmer-Liste (expandierbar) */}
                  {isExpanded && (
                    <div className="pd-expanded-body">
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
                            className={`pd-pruefling-card${isEditing ? ' pd-pruefling-card--editing' : ''}`}
                          >
                            {/* Prüfling Header */}
                            <div
                              onClick={() => handleToggleEdit(pruefling)}
                              className="pd-pruefling-header"
                              onMouseEnter={(e) => {
                                if (!isEditing) {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <div className="pd-pruefling-inner">
                                <div className="pd-pruefling-avatar">
                                  {index + 1}
                                </div>

                                <div className="u-flex-1">
                                  <h4 className="pd-pruefling-name">
                                    {pruefling.vorname} {pruefling.nachname}
                                  </h4>
                                  <p className="pd-pruefling-sub">
                                    {pruefling.stil_name} • {pruefling.graduierung_vorher} → {pruefling.graduierung_nachher}
                                  </p>
                                </div>

                                <div className="pd-status-row">
                                  {getStatusBadge(pruefling)}

                                  {pruefling.punktzahl && (
                                    <div className="pd-pkt-badge">
                                      {pruefling.punktzahl} / {pruefling.max_punktzahl} Pkt.
                                    </div>
                                  )}
                                </div>
                              </div>

                              <ChevronDown
                                size={20}
                                className={`pd-pruefling-chevron${isEditing ? ' pd-pruefling-chevron--expanded' : ''}`}
                              />
                            </div>

                            {/* Inline Edit-Formular */}
                            {isEditing && (
                              <div className="pd-edit-form">
                                {/* Kompakte Ergebnis-Zeile: Alles in einer Reihe */}
                                <div className="pd-result-row">
                                  {/* Bestanden Buttons */}
                                  <div className="pd-col-auto">
                                    <label className="pd-mini-label">
                                      Ergebnis
                                    </label>
                                    <div className="pd-btn-row">
                                      <button
                                        type="button"
                                        onClick={() => updateErgebnis(pruefling.pruefung_id, 'bestanden', true)}
                                        className={`btn-toggle btn-toggle-success pd-btn-toggle-sm ${ergebnis.bestanden ? 'active' : ''}`}
                                      >
                                        <Check size={14} />
                                        Bestanden
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => updateErgebnis(pruefling.pruefung_id, 'bestanden', false)}
                                        className={`btn-toggle btn-toggle-danger pd-btn-toggle-sm ${!ergebnis.bestanden ? 'active' : ''}`}
                                      >
                                        <X size={14} />
                                        Nicht bestanden
                                      </button>
                                    </div>
                                  </div>

                                  {/* Gurt-Auswahl - sehr kompakt */}
                                  {ergebnis.bestanden && (
                                    <div className="pd-gurt-nav">
                                      <label className="pd-mini-label">
                                        <Award size={12} className="pd-icon-inline" />
                                        Neuer Gurt
                                      </label>

                                      <div className="pd-gurt-row">
                                        <button
                                          type="button"
                                          onClick={() => handleGurtAendern(pruefling.pruefung_id, pruefling.stil_id, 'down')}
                                          className="pd-gurt-btn"
                                          title="Gurt herabstufen"
                                        >
                                          <ChevronDown size={14} />
                                        </button>

                                        <div
                                          className="pd-gurt-display"
                                          style={{ '--gurt-bg': ergebnis.neuer_gurt_farbe || 'rgba(255,255,255,0.1)' }}
                                        >
                                          <span className={`pd-gurt-label${ergebnis.neuer_gurt_farbe ? ' pd-gurt-label--dark' : ''}`}>
                                            {ergebnis.neuer_gurt_name || 'Kein Gurt'}
                                          </span>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleGurtAendern(pruefling.pruefung_id, pruefling.stil_id, 'up')}
                                          className="pd-gurt-btn"
                                          title="Gurt hochstufen"
                                        >
                                          <ChevronUp size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Erreichte Punktzahl */}
                                  <div className="pd-col-100">
                                    <label className="pd-mini-label">
                                      Erreicht
                                    </label>
                                    <input
                                      type="number"
                                      value={ergebnis.punktzahl || ''}
                                      onChange={(e) => updateErgebnis(pruefling.pruefung_id, 'punktzahl', e.target.value)}
                                      placeholder="85"
                                      className="form-input pd-edit-input"
                                    />
                                  </div>

                                  {/* Maximale Punktzahl */}
                                  <div className="pd-col-100">
                                    <label className="pd-mini-label">
                                      Max.
                                    </label>
                                    <input
                                      type="number"
                                      value={ergebnis.max_punktzahl || 100}
                                      onChange={(e) => updateErgebnis(pruefling.pruefung_id, 'max_punktzahl', e.target.value)}
                                      className="form-input pd-edit-input"
                                    />
                                  </div>
                                </div>

                                {/* Prüferkommentar */}
                                <div className="pd-kommentar-section">
                                  <label className="pd-kommentar-label">
                                    Prüferkommentar / Bemerkungen
                                  </label>
                                  <textarea
                                    value={ergebnis.prueferkommentar || ''}
                                    onChange={(e) => updateErgebnis(pruefling.pruefung_id, 'prueferkommentar', e.target.value)}
                                    rows="3"
                                    placeholder="Notizen zum Prüfungsverlauf, Stärken, Schwächen, etc."
                                    className="pd-textarea"
                                  />
                                </div>

                                {/* Prüfungsinhalte & Bewertungen */}
                                {pruefungsinhalte[pruefling.pruefung_id] && (
                                  <div className="pd-inhalte-box">
                                    <h4 className="pd-inhalte-h4">
                                      📋 Prüfungsinhalte bewerten
                                    </h4>
                                    {Object.entries(pruefungsinhalte[pruefling.pruefung_id]).map(([kategorie, inhalte]) => (
                                      <div key={kategorie} className="pd-kommentar-section">
                                        <h5 className="pd-kategorie-h5">
                                          {kategorie === 'grundtechniken' && '🥋 Grundtechniken'}
                                          {kategorie === 'kata' && '🎭 Kata / Formen'}
                                          {kategorie === 'kumite' && '⚔️ Kumite / Sparring'}
                                          {kategorie === 'theorie' && '📚 Theorie'}
                                        </h5>
                                        <div className="pd-inhalte-grid">
                                          {inhalte.map((inhalt, idx) => {
                                            const inhaltId = inhalt.id || inhalt.inhalt_id;
                                            const bewertung = bewertungen[pruefling.pruefung_id]?.[kategorie]?.find(b => b.inhalt_id === inhaltId) || {};
                                            return (
                                              <div key={`${kategorie}-${idx}-${inhaltId}`} className="pd-inhalt-row">
                                                <span className="pd-inhalt-text">{inhalt.inhalt || inhalt.titel}</span>

                                                <div className="pd-bestanden-wrap">
                                                  <button
                                                    type="button"
                                                    onClick={() => updateBewertung(pruefling.pruefung_id, inhaltId, kategorie, 'bestanden', !bewertung.bestanden)}
                                                    className={`btn-toggle pd-inhalt-btn ${bewertung.bestanden ? 'btn-toggle-success active' : 'btn-toggle-neutral'}`}
                                                  >
                                                    {bewertung.bestanden ? (
                                                      <>
                                                        <Check size={14} className="pd-icon-mr" />
                                                        Bestanden
                                                      </>
                                                    ) : (
                                                      <>
                                                        <X size={14} className="pd-icon-mr" />
                                                        Offen
                                                      </>
                                                    )}
                                                  </button>
                                                </div>

                                                <div className="pd-pkt-wrap">
                                                  <input
                                                    type="number"
                                                    placeholder="0"
                                                    min="0"
                                                    max={inhalt.max_punktzahl || bewertung.max_punktzahl || 10}
                                                    value={bewertung.punktzahl || ''}
                                                    onChange={(e) => updateBewertung(pruefling.pruefung_id, inhaltId, kategorie, 'punktzahl', parseFloat(e.target.value) || 0)}
                                                    className="pd-pkt-input"
                                                  />
                                                  <span className="pd-pkt-max">
                                                    / {inhalt.max_punktzahl || bewertung.max_punktzahl || 10}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Aktionen */}
                                <div className="pd-action-row">
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
