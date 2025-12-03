import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import config from '../config/config.js';
import { useAuth } from '../context/AuthContext.jsx';
import { jwtDecode } from 'jwt-decode';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/Events.css';

const MeineEvents = () => {
  const { token } = useAuth();

  const [alleEvents, setAlleEvents] = useState([]);
  const [meineEvents, setMeineEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mitgliedId, setMitgliedId] = useState(null);

  // Modal States
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAnmeldeModal, setShowAnmeldeModal] = useState(false);
  const [bemerkung, setBemerkung] = useState('');

  // Hole Mitglied-ID aus Token
  useEffect(() => {
    if (token) {
      try {
        const decoded = jwtDecode(token);
        if (decoded.mitglied_id) {
          setMitgliedId(decoded.mitglied_id);
        }
      } catch (err) {
        console.error('Fehler beim Dekodieren des Tokens:', err);
      }
    }
  }, [token]);

  // Lade alle verfügbaren Events
  const ladeAlleEvents = useCallback(async () => {
    if (!token) return;

    setLoading(true);
    setError('');
    try {
      const response = await axios.get(
        `${config.apiBaseUrl}/events?upcoming=true&status=anmeldung_offen`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setAlleEvents(response.data);
    } catch (err) {
      console.error('Fehler beim Laden der Events:', err);
      setError('Fehler beim Laden der Events: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Lade meine angemeldeten Events
  const ladeMeineEvents = useCallback(async () => {
    if (!token || !mitgliedId) return;

    try {
      const response = await axios.get(
        `${config.apiBaseUrl}/events/mitglied/${mitgliedId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMeineEvents(response.data);
    } catch (err) {
      console.error('Fehler beim Laden meiner Events:', err);
    }
  }, [token, mitgliedId]);

  useEffect(() => {
    if (token && mitgliedId) {
      ladeAlleEvents();
      ladeMeineEvents();
    }
  }, [token, mitgliedId, ladeAlleEvents, ladeMeineEvents]);

  // Anmelden für Event
  const handleAnmelden = async () => {
    if (!mitgliedId || !selectedEvent) return;

    setError('');
    setSuccess('');
    try {
      await axios.post(
        `${config.apiBaseUrl}/events/${selectedEvent.event_id}/anmelden`,
        { mitglied_id: mitgliedId, bemerkung },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Sie wurden erfolgreich für das Event angemeldet!');
      setShowAnmeldeModal(false);
      setBemerkung('');
      ladeAlleEvents();
      ladeMeineEvents();

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Fehler bei der Anmeldung:', err);
      setError(err.response?.data?.error || 'Fehler bei der Anmeldung');
    }
  };

  // Abmelden von Event
  const handleAbmelden = async (eventId) => {
    if (!window.confirm('Möchten Sie sich wirklich von diesem Event abmelden?')) return;

    setError('');
    setSuccess('');
    try {
      await axios.post(
        `${config.apiBaseUrl}/events/${eventId}/abmelden`,
        { mitglied_id: mitgliedId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccess('Sie wurden erfolgreich abgemeldet!');
      ladeAlleEvents();
      ladeMeineEvents();

      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Fehler bei der Abmeldung:', err);
      setError(err.response?.data?.error || 'Fehler bei der Abmeldung');
    }
  };

  // Event Details anzeigen
  const handleShowDetails = (event) => {
    setSelectedEvent(event);
    setShowEventDetails(true);
  };

  // Anmelde-Modal öffnen
  const handleOpenAnmeldeModal = (event) => {
    setSelectedEvent(event);
    setBemerkung('');
    setShowAnmeldeModal(true);
  };

  // Formatiere Datum
  const formatDatum = (datum) => {
    if (!datum) return '';
    return new Date(datum).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Formatiere Uhrzeit
  const formatUhrzeit = (zeit) => {
    if (!zeit) return '';
    return zeit.substring(0, 5);
  };

  // Event-Typ Badge-Farbe
  const getEventTypColor = (typ) => {
    const colors = {
      'Turnier': 'badge-danger',
      'Lehrgang': 'badge-info',
      'Prüfung': 'badge-warning',
      'Seminar': 'badge-success',
      'Workshop': 'badge-primary',
      'Feier': 'badge-special',
      'Sonstiges': 'badge-secondary'
    };
    return colors[typ] || 'badge-secondary';
  };

  // Status Badge-Farbe
  const getStatusColor = (status) => {
    const colors = {
      'angemeldet': 'badge-success',
      'bestaetigt': 'badge-info',
      'abgesagt': 'badge-danger',
      'teilgenommen': 'badge-success',
      'nicht_erschienen': 'badge-dark'
    };
    return colors[status] || 'badge-secondary';
  };

  // Status-Text
  const getStatusText = (status) => {
    const texts = {
      'angemeldet': 'Angemeldet',
      'bestaetigt': 'Bestätigt',
      'abgesagt': 'Abgesagt',
      'teilgenommen': 'Teilgenommen',
      'nicht_erschienen': 'Nicht erschienen'
    };
    return texts[status] || status;
  };

  // Prüfe ob bereits angemeldet
  const istAngemeldet = (eventId) => {
    return meineEvents.some(e => e.event_id === eventId &&
      ['angemeldet', 'bestaetigt'].includes(e.anmeldung_status));
  };

  // Prüfe ob Anmeldefrist abgelaufen
  const istAnmeldefristAbgelaufen = (anmeldefrist) => {
    if (!anmeldefrist) return false;
    return new Date(anmeldefrist) < new Date();
  };

  return (
    <div className="events-container">
      <div className="page-header">
        <h1 className="page-title">Meine Events</h1>
        <p className="page-subtitle">Veranstaltungen und Anmeldungen</p>
      </div>

      <div className="events-content">
        {error && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div className="success-message" style={{
            marginBottom: '1rem',
            background: 'rgba(25, 135, 84, 0.1)',
            border: '1px solid rgba(25, 135, 84, 0.3)',
            borderRadius: '8px',
            padding: '1rem',
            color: '#75d175',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            ✅ {success}
          </div>
        )}

        {/* Meine angemeldeten Events */}
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <div className="card-header">
            <h2>Meine Anmeldungen</h2>
          </div>
          <div className="card-body">
            {meineEvents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <h3>Keine Anmeldungen</h3>
                <p>Sie sind momentan für keine Events angemeldet.</p>
              </div>
            ) : (
              <div className="events-list">
                {meineEvents.map((event) => (
                  <div key={event.event_id} className="event-card">
                    <div className="event-card-header">
                      <div className="event-title-section">
                        <h3>{event.titel}</h3>
                        <div className="event-badges">
                          <span className={`badge ${getEventTypColor(event.event_typ)}`}>
                            {event.event_typ}
                          </span>
                          <span className={`badge ${getStatusColor(event.anmeldung_status)}`}>
                            {getStatusText(event.anmeldung_status)}
                          </span>
                          {event.bezahlt && (
                            <span className="badge badge-success">✅ Bezahlt</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="event-card-body">
                      <div className="event-info-row">
                        <span className="event-icon">📅</span>
                        <span>{formatDatum(event.datum)}</span>
                      </div>
                      {event.uhrzeit_beginn && (
                        <div className="event-info-row">
                          <span className="event-icon">🕐</span>
                          <span>
                            {formatUhrzeit(event.uhrzeit_beginn)}
                            {event.uhrzeit_ende && ` - ${formatUhrzeit(event.uhrzeit_ende)}`}
                          </span>
                        </div>
                      )}
                      {event.ort && (
                        <div className="event-info-row">
                          <span className="event-icon">📍</span>
                          <span>{event.ort}</span>
                        </div>
                      )}
                      {event.raum_name && (
                        <div className="event-info-row">
                          <span className="event-icon">🚪</span>
                          <span>Raum: {event.raum_name}</span>
                        </div>
                      )}
                      {event.teilnahmegebuehr > 0 && (
                        <div className="event-info-row">
                          <span className="event-icon">💰</span>
                          <span>{parseFloat(event.teilnahmegebuehr).toFixed(2)} €</span>
                        </div>
                      )}
                      <div className="event-info-row">
                        <span className="event-icon">📝</span>
                        <span>Angemeldet am: {formatDatum(event.anmeldedatum)}</span>
                      </div>
                    </div>

                    <div className="event-card-footer" style={{ justifyContent: 'space-between' }}>
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleShowDetails(event)}
                      >
                        Details anzeigen
                      </button>
                      {['angemeldet', 'bestaetigt'].includes(event.anmeldung_status) && (
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleAbmelden(event.event_id)}
                          style={{
                            background: 'rgba(220, 53, 69, 0.2)',
                            borderColor: 'rgba(220, 53, 69, 0.3)',
                            color: '#ea868f'
                          }}
                        >
                          Abmelden
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Verfügbare Events */}
        <div className="glass-card">
          <div className="card-header">
            <h2>Verfügbare Events</h2>
          </div>
          <div className="card-body">
            {loading ? (
              <div className="loading-state">
                <p>Lade Events...</p>
              </div>
            ) : alleEvents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <h3>Keine Events verfügbar</h3>
                <p>Momentan sind keine Events zur Anmeldung verfügbar.</p>
              </div>
            ) : (
              <div className="events-list">
                {alleEvents.map((event) => {
                  const angemeldet = istAngemeldet(event.event_id);
                  const fristAbgelaufen = istAnmeldefristAbgelaufen(event.anmeldefrist);
                  const ausgebucht = event.ist_ausgebucht;

                  return (
                    <div key={event.event_id} className="event-card">
                      <div className="event-card-header">
                        <div className="event-title-section">
                          <h3>{event.titel}</h3>
                          <div className="event-badges">
                            <span className={`badge ${getEventTypColor(event.event_typ)}`}>
                              {event.event_typ}
                            </span>
                            {ausgebucht && (
                              <span className="badge badge-danger">Ausgebucht</span>
                            )}
                            {angemeldet && (
                              <span className="badge badge-success">✓ Angemeldet</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="event-card-body">
                        <div className="event-info-row">
                          <span className="event-icon">📅</span>
                          <span>{formatDatum(event.datum)}</span>
                        </div>
                        {event.uhrzeit_beginn && (
                          <div className="event-info-row">
                            <span className="event-icon">🕐</span>
                            <span>
                              {formatUhrzeit(event.uhrzeit_beginn)}
                              {event.uhrzeit_ende && ` - ${formatUhrzeit(event.uhrzeit_ende)}`}
                            </span>
                          </div>
                        )}
                        {event.ort && (
                          <div className="event-info-row">
                            <span className="event-icon">📍</span>
                            <span>{event.ort}</span>
                          </div>
                        )}
                        {event.max_teilnehmer && (
                          <div className="event-info-row">
                            <span className="event-icon">👥</span>
                            <span>
                              {event.anzahl_anmeldungen || 0} / {event.max_teilnehmer} Teilnehmer
                              {event.verfuegbare_plaetze !== null && (
                                <span className={event.verfuegbare_plaetze === 0 ? 'text-danger' : 'text-success'}>
                                  {' '}({event.verfuegbare_plaetze} Plätze frei)
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                        {event.teilnahmegebuehr > 0 && (
                          <div className="event-info-row">
                            <span className="event-icon">💰</span>
                            <span>{parseFloat(event.teilnahmegebuehr).toFixed(2)} €</span>
                          </div>
                        )}
                        {event.anmeldefrist && (
                          <div className="event-info-row">
                            <span className="event-icon">⏰</span>
                            <span className={fristAbgelaufen ? 'text-danger' : ''}>
                              Anmeldefrist: {formatDatum(event.anmeldefrist)}
                              {fristAbgelaufen && ' (abgelaufen)'}
                            </span>
                          </div>
                        )}
                        {event.beschreibung && (
                          <div className="event-description">
                            <p>{event.beschreibung}</p>
                          </div>
                        )}
                      </div>

                      <div className="event-card-footer" style={{ justifyContent: 'space-between' }}>
                        <button
                          className="btn btn-secondary"
                          onClick={() => handleShowDetails(event)}
                        >
                          Details anzeigen
                        </button>
                        {!angemeldet && !ausgebucht && !fristAbgelaufen && (
                          <button
                            className="btn btn-primary"
                            onClick={() => handleOpenAnmeldeModal(event)}
                          >
                            Jetzt anmelden
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Anmeldung */}
      {showAnmeldeModal && selectedEvent && (
        <div className="modal-overlay" onClick={() => setShowAnmeldeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Event-Anmeldung</h2>
              <button className="modal-close" onClick={() => setShowAnmeldeModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ color: 'var(--farbe-hauptfarbe)', marginBottom: '1rem' }}>
                  {selectedEvent.titel}
                </h3>
                <div className="event-info-row">
                  <span className="event-icon">📅</span>
                  <span>{formatDatum(selectedEvent.datum)}</span>
                </div>
                {selectedEvent.uhrzeit_beginn && (
                  <div className="event-info-row">
                    <span className="event-icon">🕐</span>
                    <span>
                      {formatUhrzeit(selectedEvent.uhrzeit_beginn)}
                      {selectedEvent.uhrzeit_ende && ` - ${formatUhrzeit(selectedEvent.uhrzeit_ende)}`}
                    </span>
                  </div>
                )}
                {selectedEvent.teilnahmegebuehr > 0 && (
                  <div className="event-info-row">
                    <span className="event-icon">💰</span>
                    <span>{parseFloat(selectedEvent.teilnahmegebuehr).toFixed(2)} €</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Bemerkung (optional)</label>
                <textarea
                  value={bemerkung}
                  onChange={(e) => setBemerkung(e.target.value)}
                  rows="3"
                  placeholder="z.B. Besondere Anforderungen, Ernährungshinweise, etc."
                  style={{
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 215, 0, 0.2)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                    color: 'var(--farbe-text)',
                    width: '100%',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAnmeldeModal(false)}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={handleAnmelden}>
                Verbindlich anmelden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Event Details */}
      {showEventDetails && selectedEvent && (
        <div className="modal-overlay" onClick={() => setShowEventDetails(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEvent.titel}</h2>
              <button className="modal-close" onClick={() => setShowEventDetails(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="details-section">
                <h3>Event-Informationen</h3>
                <div className="details-info">
                  <div className="info-row">
                    <span className="info-label">Typ:</span>
                    <span className={`badge ${getEventTypColor(selectedEvent.event_typ)}`}>
                      {selectedEvent.event_typ}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="info-label">Datum:</span>
                    <span>{formatDatum(selectedEvent.datum)}</span>
                  </div>
                  {selectedEvent.uhrzeit_beginn && (
                    <div className="info-row">
                      <span className="info-label">Uhrzeit:</span>
                      <span>
                        {formatUhrzeit(selectedEvent.uhrzeit_beginn)}
                        {selectedEvent.uhrzeit_ende && ` - ${formatUhrzeit(selectedEvent.uhrzeit_ende)}`}
                      </span>
                    </div>
                  )}
                  {selectedEvent.ort && (
                    <div className="info-row">
                      <span className="info-label">Ort:</span>
                      <span>{selectedEvent.ort}</span>
                    </div>
                  )}
                  {selectedEvent.raum_name && (
                    <div className="info-row">
                      <span className="info-label">Raum:</span>
                      <span>{selectedEvent.raum_name}</span>
                    </div>
                  )}
                  {selectedEvent.max_teilnehmer && (
                    <div className="info-row">
                      <span className="info-label">Teilnehmer:</span>
                      <span>
                        {selectedEvent.anzahl_anmeldungen || 0} / {selectedEvent.max_teilnehmer}
                        {selectedEvent.verfuegbare_plaetze !== null && (
                          <span className={selectedEvent.verfuegbare_plaetze === 0 ? 'text-danger' : 'text-success'}>
                            {' '}({selectedEvent.verfuegbare_plaetze} Plätze frei)
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  {selectedEvent.teilnahmegebuehr > 0 && (
                    <div className="info-row">
                      <span className="info-label">Gebühr:</span>
                      <span>{parseFloat(selectedEvent.teilnahmegebuehr).toFixed(2)} €</span>
                    </div>
                  )}
                  {selectedEvent.anmeldefrist && (
                    <div className="info-row">
                      <span className="info-label">Anmeldefrist:</span>
                      <span>{formatDatum(selectedEvent.anmeldefrist)}</span>
                    </div>
                  )}
                </div>

                {selectedEvent.beschreibung && (
                  <div className="details-description">
                    <h4>Beschreibung</h4>
                    <p>{selectedEvent.beschreibung}</p>
                  </div>
                )}

                {selectedEvent.anforderungen && (
                  <div className="details-description">
                    <h4>Anforderungen / Voraussetzungen</h4>
                    <p>{selectedEvent.anforderungen}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEventDetails(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeineEvents;
