import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Edit3, Save, X, Award, Clock, CheckCircle, AlertCircle, FileText, Download } from 'lucide-react';
import '../styles/PruefungsStatus.css';

const PruefungsStatus = ({ mitgliedId, readOnly = false }) => {
  const [stileDaten, setStileDaten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAnmerkungenModal, setShowAnmerkungenModal] = useState(false);
  const [anmerkungen, setAnmerkungen] = useState('');
  const [tempAnmerkungen, setTempAnmerkungen] = useState('');

  // Teilnahme-Bestätigung Modal State
  const [showTeilnahmeModal, setShowTeilnahmeModal] = useState(false);
  const [selectedPruefung, setSelectedPruefung] = useState(null);
  const [teilnahmeBedingungAkzeptiert, setTeilnahmeBedingungAkzeptiert] = useState(false);
  const [teilnahmeLoading, setTeilnahmeLoading] = useState(false);

  // Historische Prüfung Modal State (einfache Freitextfelder)
  const [showHistorischModal, setShowHistorischModal] = useState(false);
  const [historischForm, setHistorischForm] = useState({
    stil_name: '',
    graduierung_name: '',
    pruefungsdatum: '',
    bemerkung: ''
  });
  const [historischePruefungen, setHistorischePruefungen] = useState([]);


  useEffect(() => {
    if (mitgliedId) {
      loadPruefungsdaten();
      loadHistorischePruefungen();
    }
  }, [mitgliedId]);

  const loadPruefungsdaten = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Lade Prüfungsdaten für Mitglied:', mitgliedId);

      // ✅ GEÄNDERT: Lade nur die dem Mitglied zugewiesenen Stile
      const mitgliedStileResponse = await axios.get(`/mitglieder/${mitgliedId}/stile`);
      const zugewieseneStile = mitgliedStileResponse.data?.stile || [];

      console.log('📌 Dem Mitglied zugewiesene Stile:', zugewieseneStile);

      // Wenn keine Stile zugewiesen sind, zeige leere Liste
      if (zugewieseneStile.length === 0) {
        console.log('⚠️ Keine Stile zugewiesen');
        setStileDaten([]);
        setLoading(false);
        return;
      }

      // Lade Prüfungshistorie für alle Stile
      const historieResponse = await axios.get(`/pruefungen/mitglied/${mitgliedId}/historie`);
      const historie = historieResponse.data?.historie || historieResponse.data || [];

      // Lade Trainingsstunden für alle Stile
      const trainingsResponse = await axios.get(`/anwesenheitProtokoll/pruefung/${mitgliedId}`);
      const trainings = trainingsResponse.data || {};

      console.log('📊 Geladene Daten:', {
        zugewieseneStile: zugewieseneStile?.length,
        zugewieseneStileNamen: zugewieseneStile?.map(s => s.stil_name),
        historie: historie?.length,
        trainings: trainings,
        trainingsKeys: Object.keys(trainings || {}),
        trainingsType: typeof trainings,
        trainingsStile: trainings.stile,
        trainingsStatistiken: trainings.statistiken
      });

      // Gruppiere Daten nach Stilen - ZEIGE NUR ZUGEWIESENE STILE
      const stileMitDaten = zugewieseneStile.map(stil => {
        const stilHistorie = historie.filter(p => p.stil_id === stil.stil_id);

        // 🆕 NEU: Lade stil-spezifische Trainingsstunden
        const stilTrainings = trainings.stile?.[stil.stil_name] || trainings.statistiken || trainings || {};

        console.log(`🔍 Stil ${stil.stil_name} (ID: ${stil.stil_id}):`, {
          historie: stilHistorie.length,
          trainings: stilTrainings,
          trainingsKeys: Object.keys(stilTrainings || {}),
          stileDaten: trainings.stile
        });

        // Finde die letzte bestandene Prüfung
        const letztePruefung = stilHistorie
          .filter(p => p.bestanden === true || p.status === 'bestanden')
          .sort((a, b) => new Date(b.pruefungsdatum) - new Date(a.pruefungsdatum))[0];

        const naechstePruefung = stilHistorie.find(p => p.status === 'geplant');

        return {
          stil_id: stil.stil_id,
          stil_name: stil.stil_name,
          stil_farbe: '#FFD700', // Standardfarbe für Stile
          historie: stilHistorie,
          trainingsstunden: stilTrainings,
          letztePruefung: letztePruefung,
          naechstePruefung: naechstePruefung,
          aktuelleGraduierung: letztePruefung?.graduierung_nachher || stil.graduierung_name || 'Anfänger',
          graduierungFarbe: letztePruefung?.farbe_nachher || stil.farbe || '#FFFFFF'
        };
      });

      console.log('🎯 Verarbeitete Stildaten:', stileMitDaten.map(s => ({
        stil_id: s.stil_id,
        stil_name: s.stil_name,
        historie_anzahl: s.historie.length,
        aktuelle_graduierung: s.aktuelleGraduierung,
        trainingsstunden_vorhanden: !!s.trainingsstunden
      })));

      setStileDaten(stileMitDaten);

    } catch (error) {
      console.error('Fehler beim Laden der Prüfungsdaten:', error);
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const formatDatum = (datum) => {
    if (!datum) return '-';
    return new Date(datum).toLocaleDateString('de-DE');
  };

  const getFortschrittsProzent = (stilDaten) => {
    if (!stilDaten.trainingsstunden) return 0;
    
    // Verwende die korrekte Datenstruktur der API
    const anwesend = parseInt(
      stilDaten.trainingsstunden.anwesend_stunden || 
      stilDaten.trainingsstunden.total_stunden || 
      0
    );
    
    const benoetigt = parseInt(
      stilDaten.trainingsstunden.requirements?.min_stunden || 
      20
    );
    
    return Math.round((anwesend / benoetigt) * 100);
  };

  const getFortschrittsStatus = (prozent) => {
    if (prozent >= 80) return 'Bereit für Prüfung';
    if (prozent >= 60) return 'Gut auf dem Weg';
    if (prozent >= 40) return 'Fortschritt sichtbar';
    return 'Mehr Training nötig';
  };

  const handleAnmerkungenSpeichern = async () => {
    try {
      const letztePruefung = stileDaten.find(s => s.letztePruefung)?.letztePruefung;
      if (letztePruefung) {
        await axios.put(`/pruefungen/${letztePruefung.pruefung_id}`, {
          anmerkungen: tempAnmerkungen
        });
        setAnmerkungen(tempAnmerkungen);
        setShowAnmerkungenModal(false);
        loadPruefungsdaten(); // Daten neu laden
      }
    } catch (error) {
      console.error('Fehler beim Speichern der Anmerkungen:', error);
    }
  };

  const handleUrkundeDownload = async (pruefungId) => {
    try {
      const response = await axios.get(`/pruefungen/${pruefungId}/urkunde/download`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `urkunde_${pruefungId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Fehler beim Download der Urkunde:', error);
    }
  };

  // Lade historische Prüfungen
  const loadHistorischePruefungen = async () => {
    try {
      const response = await axios.get('/pruefungen-historisch/mitglied/' + mitgliedId);
      setHistorischePruefungen(response.data?.data || []);
    } catch (error) {
      console.error('Fehler beim Laden historischer Prüfungen:', error);
    }
  };

  // Teilnahme bestätigen
  const openTeilnahmeModal = (pruefung) => {
    setSelectedPruefung(pruefung);
    setTeilnahmeBedingungAkzeptiert(false);
    setShowTeilnahmeModal(true);
  };

  const handleTeilnahmeBestaetigen = async () => {
    if (!selectedPruefung || !teilnahmeBedingungAkzeptiert) return;
    setTeilnahmeLoading(true);
    try {
      await axios.post(`/pruefungen/${selectedPruefung.pruefung_id}/teilnahme-bestaetigen`, {
        mitglied_id: mitgliedId
      });
      setShowTeilnahmeModal(false);
      setSelectedPruefung(null);
      loadPruefungsdaten();
    } catch (err) {
      const msg = err.response?.data?.error || 'Fehler beim Bestätigen';
      alert('❌ ' + msg);
    } finally {
      setTeilnahmeLoading(false);
    }
  };

  // Öffne Modal für historische Prüfung
  const openHistorischModal = () => {
    setHistorischForm({
      stil_name: '',
      graduierung_name: '',
      pruefungsdatum: '',
      bemerkung: ''
    });
    setShowHistorischModal(true);
  };

  // Speichere historische Prüfung
  const handleSaveHistorisch = async () => {
    if (!historischForm.stil_name || !historischForm.graduierung_name || !historischForm.pruefungsdatum) {
      alert('Bitte Stil, Graduierung und Datum eingeben');
      return;
    }

    try {
      await axios.post('/pruefungen-historisch', {
        mitglied_id: mitgliedId,
        ...historischForm
      });

      setShowHistorischModal(false);
      loadHistorischePruefungen();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('Fehler beim Speichern');
    }
  };

  // Lösche historische Prüfung
  const handleDeleteHistorisch = async (id) => {
    if (!window.confirm('Wirklich löschen?')) return;

    try {
      await axios.delete('/pruefungen-historisch/' + id);
      loadHistorischePruefungen();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
    }
  };

  if (loading) {
    return (
      <div className="pruefungsstatus-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Lade Prüfungsdaten...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pruefungsstatus-container">
        <div className="error-message">
          <AlertCircle size={24} />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pruefungsstatus-wrapper">
      {stileDaten.length === 0 ? (
        <div className="grid-container">
          <div className="field-group card">
            <h3>🎓 Prüfungsstatus</h3>
            <p className="ps-no-data">
              {readOnly
                ? 'Ihnen wurden noch keine Stile zugewiesen.'
                : 'Diesem Mitglied wurden noch keine Stile zugewiesen. Weisen Sie im Tab "Stile" einen Stil zu.'}
            </p>
          </div>
        </div>
      ) : (
        stileDaten.map((stilDaten) => (
          <div key={stilDaten.stil_id} className="stil-pruefung-section">
            {/* Stil Überschrift */}
            <div className="stil-titel-header">
              <h2 className="ps-stil-title">
                🥋 {stilDaten.stil_name}
              </h2>
            </div>

            {/* Grid Layout - 2 Spalten */}
            <div className="grid-container zwei-spalten">

              {/* Karte 1: Aktuelle Graduierung */}
              <div className="field-group card">
                <h3>🎖️ Aktuelle Graduierung</h3>
                <div>
                  <label>Gurtfarbe:</label>
                  <div className="ps-gurt-row">
                    <div
                      className="ps-gurt-swatch"
                      style={{ '--gurt-farbe': stilDaten.graduierungFarbe }}
                    />
                    <span className="ps-gurt-label">
                      {stilDaten.aktuelleGraduierung}
                    </span>
                  </div>
                </div>
                <div>
                  <label>Letzte Prüfung:</label>
                  <span>{formatDatum(stilDaten.letztePruefung?.pruefungsdatum)}</span>
                </div>
                {stilDaten.letztePruefung?.status === 'bestanden' && (
                  <div>
                    <button
                      className="download-urkunde-btn"
                      onClick={() => handleUrkundeDownload(stilDaten.letztePruefung.pruefung_id)}
                      className="ps-btn-urkunde-main"
                    >
                      <Download size={16} />
                      Urkunde herunterladen
                    </button>
                  </div>
                )}
              </div>

              {/* Karte 2: Trainingsstunden */}
              <div className="field-group card">
                <h3>📊 Trainingsstunden</h3>
                <div>
                  <label>Absolviert:</label>
                  <span className="ps-stat-success">
                    {stilDaten.trainingsstunden?.anwesend_stunden ||
                     stilDaten.trainingsstunden?.total_stunden || 0} Stunden
                  </span>
                </div>
                <div>
                  <label>Benötigt für nächste Prüfung:</label>
                  <span className="ps-stat-info">
                    {stilDaten.trainingsstunden?.requirements?.min_stunden || 20} Stunden
                  </span>
                </div>
                <div>
                  <label>Noch benötigt:</label>
                  <span className="ps-stat-error">
                    {Math.max(0,
                      (stilDaten.trainingsstunden?.requirements?.min_stunden || 20) -
                      (parseInt(stilDaten.trainingsstunden?.anwesend_stunden ||
                                stilDaten.trainingsstunden?.total_stunden || 0))
                    )} Stunden
                  </span>
                </div>

                {/* Fortschrittsbalken */}
                <div className="ps-mt-1">
                  <label>Fortschritt:</label>
                  <div className="ps-progress-track">
                    <div
                      className={`ps-progress-fill${getFortschrittsProzent(stilDaten) >= 80 ? ' ps-progress-fill--high' : getFortschrittsProzent(stilDaten) >= 60 ? ' ps-progress-fill--mid' : ' ps-progress-fill--low'}`}
                      style={{ width: `${getFortschrittsProzent(stilDaten)}%` }}
                    >
                      <span className="ps-progress-text">
                        {getFortschrittsProzent(stilDaten)}%
                      </span>
                    </div>
                  </div>
                  <div className="ps-progress-label">
                    {getFortschrittsStatus(getFortschrittsProzent(stilDaten))}
                  </div>
                </div>
              </div>

              {/* Karte 3: Nächste Prüfung */}
              <div className="field-group card">
                <h3>📅 Nächste Prüfung</h3>
                <div>
                  <label>Geplantes Datum:</label>
                  <span className="ps-stat-label">
                    {formatDatum(stilDaten.naechstePruefung?.pruefungsdatum) || 'Keine Prüfung geplant'}
                  </span>
                </div>
                {stilDaten.naechstePruefung && (
                  <>
                    <div>
                      <label>Ziel-Graduierung:</label>
                      <span>{stilDaten.naechstePruefung?.graduierung_nachher || stilDaten.naechstePruefung?.graduierung || '-'}</span>
                    </div>
                    {stilDaten.naechstePruefung.pruefungsort && (
                      <div>
                        <label>Ort:</label>
                        <span>{stilDaten.naechstePruefung.pruefungsort}</span>
                      </div>
                    )}
                    <div className="ps-mt-075">
                      {stilDaten.naechstePruefung.teilnahme_bestaetigt ? (
                        <div className="ps-teilnahme-confirmed">
                          <CheckCircle size={16} />
                          Teilnahme bestätigt
                        </div>
                      ) : (
                        <button
                          onClick={() => openTeilnahmeModal(stilDaten.naechstePruefung)}
                          className="ps-btn-teilnahme"
                        >
                          <CheckCircle size={16} />
                          Teilnahme bestätigen
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Karte 4: Prüfungshistorie */}
              <div className="field-group card ps-full-col">
                <div className="ps-section-header">
                  <h3>📋 Prüfungshistorie</h3>
                  {!readOnly && (
                    <button
                      onClick={() => openHistorischModal()}
                      className="ps-btn-add-historic"
                    >
                      + Historische Prüfung
                    </button>
                  )}
                </div>
                {stilDaten.historie.length > 0 ? (
                  <div className="ps-table-scroll">
                    <table className="ps-table">
                      <thead>
                        <tr className="ps-thead-row">
                          <th className="ps-th-left">Datum</th>
                          <th className="ps-th-left">Graduierung</th>
                          <th className="ps-th-left">Status</th>
                          <th className="ps-th-left">Punkte</th>
                          <th className="ps-th-center">Aktion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stilDaten.historie.map((pruefung, index) => (
                          <tr key={pruefung.pruefung_id} className="ps-histoire-row">
                            <td className="ps-td">{formatDatum(pruefung.pruefungsdatum)}</td>
                            <td className="ps-td">{pruefung.graduierung_nachher}</td>
                            <td className="ps-td">
                              <span
                                className={`ps-pruefung-badge${pruefung.status === 'bestanden' ? ' ps-pruefung-badge--bestanden' : pruefung.status === 'geplant' ? ' ps-pruefung-badge--geplant' : ' ps-pruefung-badge--nicht-bestanden'}`}
                              >
                                {pruefung.status}
                                {pruefung.ist_historisch && ' (hist.)'}
                              </span>
                            </td>
                            <td className="ps-td">{pruefung.punktzahl || '-'}</td>
                            <td className="ps-td-center">
                              <div className="ps-td-actions">
                                {pruefung.status === 'bestanden' && !pruefung.ist_historisch && (
                                  <button
                                    onClick={() => handleUrkundeDownload(pruefung.pruefung_id)}
                                    className="ps-btn-urkunde"
                                    title="Urkunde herunterladen"
                                  >
                                    <Download size={14} />
                                  </button>
                                )}
                                {pruefung.ist_historisch && !readOnly && (
                                  <button
                                    onClick={() => handleDeleteHistorisch(pruefung.pruefung_id)}
                                    className="ps-btn-delete-sm"
                                    title="Historische Prüfung löschen"
                                  >
                                    <X size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="ps-empty">
                    Noch keine Prüfungen dokumentiert. Klicken Sie auf "+ Historische Prüfung" um vergangene Prüfungen zu erfassen.
                  </p>
                )}
                </div>

            </div>
          </div>
        ))
      )}

      {/* Anmerkungen Modal */}
      {showAnmerkungenModal && (
        <div className="modal-overlay" onClick={() => setShowAnmerkungenModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="ps-modal-header">
              <h3>Prüfungsanmerkungen bearbeiten</h3>
              <button className="close-btn" onClick={() => setShowAnmerkungenModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <textarea
                value={tempAnmerkungen}
                onChange={(e) => setTempAnmerkungen(e.target.value)}
                placeholder="Anmerkungen zur Prüfung..."
                rows={4}
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAnmerkungenModal(false)}>
                Abbrechen
              </button>
              <button className="btn-primary" onClick={handleAnmerkungenSpeichern}>
                <Save size={16} />
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

{/* Historische Prüfung Modal - Einfache Freitextfelder */}
      {showHistorischModal && (
        <div className="ps-modal-overlay" onClick={() => setShowHistorischModal(false)}>
          <div onClick={e => e.stopPropagation()} className="ps-modal-dialog">
            <div className="ps-modal-header">
              <h3 className="u-text-accent">📜 Historische Prüfung</h3>
              <button onClick={() => setShowHistorischModal(false)} className="ps-btn-close">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body ps-modal-body">

              <div className="ps-form-field">
                <label className="u-form-label-secondary">
                  Stil *
                </label>
                <input
                  type="text"
                  value={historischForm.stil_name}
                  onChange={(e) => setHistorischForm({...historischForm, stil_name: e.target.value})}
                  placeholder="z.B. Karate, Judo, Taekwondo..."
                  className="ps-input"
                />
              </div>

              <div className="ps-form-field">
                <label className="u-form-label-secondary">
                  Graduierung *
                </label>
                <input
                  type="text"
                  value={historischForm.graduierung_name}
                  onChange={(e) => setHistorischForm({...historischForm, graduierung_name: e.target.value})}
                  placeholder="z.B. Gelbgurt, 5. Kyu, 1. Dan..."
                  className="ps-input"
                />
              </div>

              <div className="ps-form-field">
                <label className="u-form-label-secondary">
                  Datum *
                </label>
                <input
                  type="date"
                  value={historischForm.pruefungsdatum}
                  onChange={(e) => setHistorischForm({...historischForm, pruefungsdatum: e.target.value})}
                  className="ps-input"
                />
              </div>

              <div className="ps-form-field">
                <label className="u-form-label-secondary">
                  Bemerkung (optional)
                </label>
                <input
                  type="text"
                  value={historischForm.bemerkung}
                  onChange={(e) => setHistorischForm({...historischForm, bemerkung: e.target.value})}
                  placeholder="Optional..."
                  className="ps-input"
                />
              </div>

            </div>
            <div className="modal-footer ps-modal-footer">
              <button
                onClick={() => setShowHistorischModal(false)}
                className="ps-btn-cancel"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSaveHistorisch}
                className="ps-btn-save"
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historische Prüfungen Liste */}
      {/* Teilnahme-Bestätigung Modal */}
      {showTeilnahmeModal && selectedPruefung && (
        <div className="ps-modal-overlay" onClick={() => setShowTeilnahmeModal(false)}>
          <div onClick={e => e.stopPropagation()} className="ps-modal-dialog-purple">
            <div className="ps-modal-header-purple">
              <h3 className="ps-modal-title-purple">🎓 Prüfungsanmeldung bestätigen</h3>
              <button onClick={() => setShowTeilnahmeModal(false)} className="ps-btn-close-light">
                <X size={20} />
              </button>
            </div>
            <div className="ps-modal-body">
              {/* Prüfungsdetails */}
              <div className="ps-detail-card">
                <div className="ps-detail-label">Stil</div>
                <div className="ps-detail-value-lg">{selectedPruefung.stil_name}</div>
                <div className="ps-detail-label">Ziel-Graduierung</div>
                <div className="ps-detail-value-accent">{selectedPruefung.graduierung_nachher || selectedPruefung.graduierung || '-'}</div>
                {selectedPruefung.pruefungsdatum && (
                  <>
                    <div className="ps-detail-label">Datum</div>
                    <div className="ps-detail-value">
                      📅 {new Date(selectedPruefung.pruefungsdatum).toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      {selectedPruefung.pruefungszeit && ` um ${selectedPruefung.pruefungszeit} Uhr`}
                    </div>
                  </>
                )}
                {selectedPruefung.pruefungsort && (
                  <>
                    <div className="ps-detail-label">Ort</div>
                    <div className="ps-detail-value">📍 {selectedPruefung.pruefungsort}</div>
                  </>
                )}
                {selectedPruefung.pruefungsgebuehr && (
                  <>
                    <div className="ps-detail-label">Prüfungsgebühr</div>
                    <div className="ps-detail-value-price">💰 {parseFloat(selectedPruefung.pruefungsgebuehr).toFixed(2)} €</div>
                  </>
                )}
              </div>
              {/* Teilnahmebedingungen */}
              {selectedPruefung.teilnahmebedingungen && (
                <div className="ps-bedingungen-box">
                  <div className="ps-bedingungen-title">📋 Teilnahmebedingungen</div>
                  {selectedPruefung.teilnahmebedingungen}
                </div>
              )}
              {/* Checkbox */}
              <label className="ps-checkbox-label">
                <input
                  type="checkbox"
                  checked={teilnahmeBedingungAkzeptiert}
                  onChange={e => setTeilnahmeBedingungAkzeptiert(e.target.checked)}
                  className="ps-checkbox"
                />
                <span>Ich bestätige meine Teilnahme an der Prüfung und akzeptiere die Teilnahmebedingungen. Mir ist bewusst, dass die Prüfungsgebühr fällig wird.</span>
              </label>
              {/* Buttons */}
              <div className="ps-btn-row">
                <button
                  onClick={() => setShowTeilnahmeModal(false)}
                  className="ps-btn-cancel-flex"
                >
                  Abbrechen
                </button>
                <button
                  onClick={handleTeilnahmeBestaetigen}
                  disabled={!teilnahmeBedingungAkzeptiert || teilnahmeLoading}
                  className={`ps-btn-confirm${teilnahmeBedingungAkzeptiert ? ' ps-btn-confirm--active' : ''}`}
                >
                  {teilnahmeLoading ? '...' : '✅ Jetzt anmelden'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {historischePruefungen.length > 0 && (
        <div className="field-group card ps-mt-1">
          <h3>📜 Vergangene Prüfungen (vor Systemeinführung)</h3>
          <div className="ps-table-scroll">
            <table className="ps-table">
              <thead>
                <tr className="ps-thead-row">
                  <th className="ps-th-left">Datum</th>
                  <th className="ps-th-left">Stil</th>
                  <th className="ps-th-left">Graduierung</th>
                  <th className="ps-th-left">Bemerkung</th>
                  <th className="ps-th-center">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {historischePruefungen.map((p) => (
                  <tr key={p.id} className="ps-tbody-row">
                    <td className="ps-td">{new Date(p.pruefungsdatum).toLocaleDateString('de-DE')}</td>
                    <td className="ps-td">{p.stil_name}</td>
                    <td className="ps-td">{p.graduierung_name}</td>
                    <td className="ps-td-muted">{p.bemerkung || '-'}</td>
                    <td className="ps-td-center">
                      {!readOnly && (
                        <button
                          onClick={() => handleDeleteHistorisch(p.id)}
                          className="ps-btn-delete-sm"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}


    </div>
  );
};

export default PruefungsStatus;