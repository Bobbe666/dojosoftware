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

  useEffect(() => {
    if (mitgliedId) {
      loadPruefungsdaten();
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
            <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
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
              <h2 style={{ color: '#FFD700', fontSize: '1.5rem', marginBottom: '1.5rem' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
                    <div
                      style={{
                        width: '80px',
                        height: '24px',
                        backgroundColor: stilDaten.graduierungFarbe,
                        borderRadius: '4px',
                        border: '2px solid rgba(255, 255, 255, 0.2)',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
                      }}
                    />
                    <span style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>
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
                      style={{
                        background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '6px',
                        color: '#000',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        marginTop: '0.5rem'
                      }}
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
                  <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#22c55e' }}>
                    {stilDaten.trainingsstunden?.anwesend_stunden ||
                     stilDaten.trainingsstunden?.total_stunden || 0} Stunden
                  </span>
                </div>
                <div>
                  <label>Benötigt für nächste Prüfung:</label>
                  <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#3b82f6' }}>
                    {stilDaten.trainingsstunden?.requirements?.min_stunden || 20} Stunden
                  </span>
                </div>
                <div>
                  <label>Noch benötigt:</label>
                  <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#ef4444' }}>
                    {Math.max(0,
                      (stilDaten.trainingsstunden?.requirements?.min_stunden || 20) -
                      (parseInt(stilDaten.trainingsstunden?.anwesend_stunden ||
                                stilDaten.trainingsstunden?.total_stunden || 0))
                    )} Stunden
                  </span>
                </div>

                {/* Fortschrittsbalken */}
                <div style={{ marginTop: '1rem' }}>
                  <label>Fortschritt:</label>
                  <div style={{
                    width: '100%',
                    height: '24px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    position: 'relative',
                    marginTop: '0.5rem'
                  }}>
                    <div style={{
                      height: '100%',
                      width: `${getFortschrittsProzent(stilDaten)}%`,
                      background: getFortschrittsProzent(stilDaten) >= 80
                        ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                        : getFortschrittsProzent(stilDaten) >= 60
                        ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                        : 'linear-gradient(90deg, #ef4444, #dc2626)',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'width 0.3s ease',
                      minWidth: '40px'
                    }}>
                      <span style={{
                        color: '#fff',
                        fontWeight: '700',
                        fontSize: '0.85rem',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)'
                      }}>
                        {getFortschrittsProzent(stilDaten)}%
                      </span>
                    </div>
                  </div>
                  <div style={{
                    textAlign: 'center',
                    marginTop: '0.5rem',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: '#FFD700'
                  }}>
                    {getFortschrittsStatus(getFortschrittsProzent(stilDaten))}
                  </div>
                </div>
              </div>

              {/* Karte 3: Nächste Prüfung */}
              <div className="field-group card">
                <h3>📅 Nächste Prüfung</h3>
                <div>
                  <label>Geplantes Datum:</label>
                  <span style={{ fontSize: '1rem', fontWeight: '600' }}>
                    {formatDatum(stilDaten.naechstePruefung?.pruefungsdatum) || 'Keine Prüfung geplant'}
                  </span>
                </div>
                {stilDaten.naechstePruefung && (
                  <>
                    <div>
                      <label>Ziel-Graduierung:</label>
                      <span>{stilDaten.naechstePruefung?.graduierung || '-'}</span>
                    </div>
                    <div>
                      <button
                        className="edit-pruefung-btn"
                        onClick={() => setShowPruefungModal(true)}
                        style={{
                          background: 'rgba(255, 215, 0, 0.2)',
                          border: '1px solid #FFD700',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          color: '#FFD700',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginTop: '0.5rem'
                        }}
                      >
                        <Edit3 size={16} />
                        Prüfung bearbeiten
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Karte 4: Prüfungshistorie */}
              {stilDaten.historie.length > 0 && (
                <div className="field-group card" style={{ gridColumn: '1 / -1' }}>
                  <h3>📋 Prüfungshistorie</h3>
                  <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                    <table style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.9rem'
                    }}>
                      <thead>
                        <tr style={{
                          borderBottom: '2px solid rgba(255, 215, 0, 0.3)',
                          backgroundColor: 'rgba(255, 255, 255, 0.02)'
                        }}>
                          <th style={{ padding: '0.75rem', textAlign: 'left', color: '#FFD700' }}>Datum</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', color: '#FFD700' }}>Graduierung</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', color: '#FFD700' }}>Status</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left', color: '#FFD700' }}>Punkte</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center', color: '#FFD700' }}>Aktion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stilDaten.historie.map((pruefung, index) => (
                          <tr key={pruefung.pruefung_id} style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                            backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)'
                          }}>
                            <td style={{ padding: '0.75rem' }}>{formatDatum(pruefung.pruefungsdatum)}</td>
                            <td style={{ padding: '0.75rem' }}>{pruefung.graduierung_nachher}</td>
                            <td style={{ padding: '0.75rem' }}>
                              <span style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '12px',
                                fontSize: '0.8rem',
                                fontWeight: '600',
                                background: pruefung.status === 'bestanden'
                                  ? 'rgba(34, 197, 94, 0.2)'
                                  : pruefung.status === 'geplant'
                                  ? 'rgba(59, 130, 246, 0.2)'
                                  : 'rgba(239, 68, 68, 0.2)',
                                color: pruefung.status === 'bestanden'
                                  ? '#22c55e'
                                  : pruefung.status === 'geplant'
                                  ? '#3b82f6'
                                  : '#ef4444'
                              }}>
                                {pruefung.status}
                              </span>
                            </td>
                            <td style={{ padding: '0.75rem' }}>{pruefung.punktzahl || '-'}</td>
                            <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                              {pruefung.status === 'bestanden' && (
                                <button
                                  onClick={() => handleUrkundeDownload(pruefung.pruefung_id)}
                                  style={{
                                    background: 'rgba(255, 215, 0, 0.2)',
                                    border: '1px solid #FFD700',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    color: '#FFD700',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem'
                                  }}
                                >
                                  <Download size={14} />
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
          </div>
        ))
      )}

      {/* Anmerkungen Modal */}
      {showAnmerkungenModal && (
        <div className="modal-overlay" onClick={() => setShowAnmerkungenModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
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

    </div>
  );
};

export default PruefungsStatus;