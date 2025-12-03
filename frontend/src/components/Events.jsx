import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import config from '../config/config.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/Events.css';

const Events = () => {
  const { token, isAdmin } = useAuth();
  const { selectedDojo } = useDojoContext();

  const [events, setEvents] = useState([]);
  const [raeume, setRaeume] = useState([]);
  const [trainer, setTrainer] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Modal States
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Form States
  const [newEvent, setNewEvent] = useState({
    titel: '',
    beschreibung: '',
    event_typ: 'Sonstiges',
    datum: '',
    uhrzeit_beginn: '',
    uhrzeit_ende: '',
    ort: '',
    raum_id: '',
    max_teilnehmer: '',
    teilnahmegebuehr: '0.00',
    anmeldefrist: '',
    status: 'geplant',
    trainer_ids: [],
    anforderungen: ''
  });

  // Lade Events
  const ladeEvents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const dojoFilter = selectedDojo?.dojo_id ? `?dojo_id=${selectedDojo.dojo_id}` : '';
      const response = await axios.get(`${config.apiBaseUrl}/events${dojoFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(response.data);
    } catch (err) {
      console.error('Fehler beim Laden der Events:', err);
      setError('Fehler beim Laden der Events: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [token, selectedDojo]);

  // Lade Räume
  const ladeRaeume = useCallback(async () => {
    try {
      const response = await axios.get(`${config.apiBaseUrl}/raeume`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRaeume(response.data);
    } catch (err) {
      console.error('Fehler beim Laden der Räume:', err);
    }
  }, [token]);

  // Lade Trainer
  const ladeTrainer = useCallback(async () => {
    try {
      const response = await axios.get(`${config.apiBaseUrl}/trainer`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTrainer(response.data);
    } catch (err) {
      console.error('Fehler beim Laden der Trainer:', err);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      ladeEvents();
      ladeRaeume();
      ladeTrainer();
    }
  }, [token, ladeEvents, ladeRaeume, ladeTrainer]);

  // Event erstellen
  const handleCreateEvent = async () => {
    setError('');
    try {
      await axios.post(
        `${config.apiBaseUrl}/events`,
        {
          ...newEvent,
          dojo_id: selectedDojo?.dojo_id || 1,
          raum_id: newEvent.raum_id || null,
          max_teilnehmer: newEvent.max_teilnehmer ? parseInt(newEvent.max_teilnehmer) : null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowNewEvent(false);
      setNewEvent({
        titel: '',
        beschreibung: '',
        event_typ: 'Sonstiges',
        datum: '',
        uhrzeit_beginn: '',
        uhrzeit_ende: '',
        ort: '',
        raum_id: '',
        max_teilnehmer: '',
        teilnahmegebuehr: '0.00',
        anmeldefrist: '',
        status: 'geplant',
        trainer_ids: [],
        anforderungen: ''
      });
      ladeEvents();
    } catch (err) {
      console.error('Fehler beim Erstellen des Events:', err);
      setError('Fehler beim Erstellen des Events: ' + (err.response?.data?.error || err.message));
    }
  };

  // Event aktualisieren
  const handleUpdateEvent = async () => {
    setError('');
    try {
      await axios.put(
        `${config.apiBaseUrl}/events/${selectedEvent.event_id}`,
        {
          ...selectedEvent,
          raum_id: selectedEvent.raum_id || null,
          max_teilnehmer: selectedEvent.max_teilnehmer ? parseInt(selectedEvent.max_teilnehmer) : null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowEditEvent(false);
      setSelectedEvent(null);
      ladeEvents();
    } catch (err) {
      console.error('Fehler beim Aktualisieren des Events:', err);
      setError('Fehler beim Aktualisieren: ' + (err.response?.data?.error || err.message));
    }
  };

  // Event löschen
  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('Möchten Sie dieses Event wirklich löschen?')) return;

    setError('');
    try {
      await axios.delete(`${config.apiBaseUrl}/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      ladeEvents();
    } catch (err) {
      console.error('Fehler beim Löschen des Events:', err);
      setError('Fehler beim Löschen: ' + (err.response?.data?.error || err.message));
    }
  };

  // Event Details anzeigen
  const handleShowDetails = async (event) => {
    setSelectedEvent(event);
    setShowEventDetails(true);

    // Lade Anmeldungen
    try {
      const response = await axios.get(
        `${config.apiBaseUrl}/events/${event.event_id}/anmeldungen`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedEvent({ ...event, anmeldungen: response.data });
    } catch (err) {
      console.error('Fehler beim Laden der Anmeldungen:', err);
    }
  };

  // Formatiere Datum
  const formatDatum = (datum) => {
    if (!datum) return '';
    return new Date(datum).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
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
      'geplant': 'badge-secondary',
      'anmeldung_offen': 'badge-success',
      'ausgebucht': 'badge-danger',
      'abgeschlossen': 'badge-info',
      'abgesagt': 'badge-dark'
    };
    return colors[status] || 'badge-secondary';
  };

  // Status-Text
  const getStatusText = (status) => {
    const texts = {
      'geplant': 'Geplant',
      'anmeldung_offen': 'Anmeldung offen',
      'ausgebucht': 'Ausgebucht',
      'abgeschlossen': 'Abgeschlossen',
      'abgesagt': 'Abgesagt'
    };
    return texts[status] || status;
  };

  // Trainer-Namen formatieren
  const getTrainerNamen = (trainer_ids) => {
    if (!trainer_ids) return 'Keine Trainer zugewiesen';
    const ids = trainer_ids.split(',').map(id => parseInt(id.trim()));
    const namen = ids
      .map(id => {
        const t = trainer.find(tr => tr.trainer_id === id);
        return t ? `${t.vorname} ${t.nachname}` : null;
      })
      .filter(Boolean);
    return namen.length > 0 ? namen.join(', ') : 'Keine Trainer zugewiesen';
  };

  return (
    <div className="events-container">
      <div className="page-header">
        <h1 className="page-title">Events verwalten</h1>
        <p className="page-subtitle">Veranstaltungen, Wettkämpfe und besondere Termine</p>
      </div>

      <div className="events-content">
        {error && (
          <div className="error-message" style={{ marginBottom: '1rem' }}>
            ⚠️ {error}
          </div>
        )}

        <div className="glass-card">
          <div className="card-header">
            <h2>Events</h2>
            {isAdmin() && (
              <button
                className="btn btn-primary"
                onClick={() => setShowNewEvent(true)}
              >
                ➕ Neues Event erstellen
              </button>
            )}
          </div>

          <div className="card-body">
            {loading ? (
              <div className="loading-state">
                <p>Lade Events...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <h3>Noch keine Events vorhanden</h3>
                <p>Erstellen Sie Ihr erstes Event, um loszulegen.</p>
              </div>
            ) : (
              <div className="events-list">
                {events.map((event) => (
                  <div key={event.event_id} className="event-card">
                    <div className="event-card-header">
                      <div className="event-title-section">
                        <h3>{event.titel}</h3>
                        <div className="event-badges">
                          <span className={`badge ${getEventTypColor(event.event_typ)}`}>
                            {event.event_typ}
                          </span>
                          <span className={`badge ${getStatusColor(event.status)}`}>
                            {getStatusText(event.status)}
                          </span>
                        </div>
                      </div>
                      {isAdmin() && (
                        <div className="event-actions">
                          <button
                            className="btn-icon"
                            onClick={() => handleShowDetails(event)}
                            title="Details anzeigen"
                          >
                            👁️
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => {
                              setSelectedEvent(event);
                              setShowEditEvent(true);
                            }}
                            title="Bearbeiten"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon btn-danger"
                            onClick={() => handleDeleteEvent(event.event_id)}
                            title="Löschen"
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="event-card-body">
                      <div className="event-info-row">
                        <span className="event-icon">📅</span>
                        <span>{formatDatum(event.datum)}</span>
                        {event.uhrzeit_beginn && (
                          <span>
                            {formatUhrzeit(event.uhrzeit_beginn)}
                            {event.uhrzeit_ende && ` - ${formatUhrzeit(event.uhrzeit_ende)}`}
                          </span>
                        )}
                      </div>

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

                      {event.beschreibung && (
                        <div className="event-description">
                          <p>{event.beschreibung}</p>
                        </div>
                      )}

                      <div className="event-info-row">
                        <span className="event-icon">👨‍🏫</span>
                        <span>{getTrainerNamen(event.trainer_ids)}</span>
                      </div>

                      {event.anmeldefrist && (
                        <div className="event-info-row">
                          <span className="event-icon">⏰</span>
                          <span>Anmeldefrist: {formatDatum(event.anmeldefrist)}</span>
                        </div>
                      )}
                    </div>

                    {!isAdmin() && (
                      <div className="event-card-footer">
                        <button className="btn btn-primary" onClick={() => handleShowDetails(event)}>
                          Details anzeigen
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Neues Event */}
      {showNewEvent && isAdmin() && (
        <div className="modal-overlay" onClick={() => setShowNewEvent(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Neues Event erstellen</h2>
              <button className="modal-close" onClick={() => setShowNewEvent(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Titel *</label>
                  <input
                    type="text"
                    value={newEvent.titel}
                    onChange={(e) => setNewEvent({ ...newEvent, titel: e.target.value })}
                    placeholder="z.B. Sommerturnier 2025"
                  />
                </div>

                <div className="form-group">
                  <label>Event-Typ</label>
                  <select
                    value={newEvent.event_typ}
                    onChange={(e) => setNewEvent({ ...newEvent, event_typ: e.target.value })}
                  >
                    <option value="Turnier">Turnier</option>
                    <option value="Lehrgang">Lehrgang</option>
                    <option value="Prüfung">Prüfung</option>
                    <option value="Seminar">Seminar</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Feier">Feier</option>
                    <option value="Sonstiges">Sonstiges</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Datum *</label>
                  <input
                    type="date"
                    value={newEvent.datum}
                    onChange={(e) => setNewEvent({ ...newEvent, datum: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Beginn</label>
                  <input
                    type="time"
                    value={newEvent.uhrzeit_beginn}
                    onChange={(e) => setNewEvent({ ...newEvent, uhrzeit_beginn: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Ende</label>
                  <input
                    type="time"
                    value={newEvent.uhrzeit_ende}
                    onChange={(e) => setNewEvent({ ...newEvent, uhrzeit_ende: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Ort</label>
                  <input
                    type="text"
                    value={newEvent.ort}
                    onChange={(e) => setNewEvent({ ...newEvent, ort: e.target.value })}
                    placeholder="z.B. Haupthalle"
                  />
                </div>

                <div className="form-group">
                  <label>Raum</label>
                  <select
                    value={newEvent.raum_id}
                    onChange={(e) => setNewEvent({ ...newEvent, raum_id: e.target.value })}
                  >
                    <option value="">Kein Raum</option>
                    {raeume.map((raum) => (
                      <option key={raum.id} value={raum.id}>
                        {raum.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Max. Teilnehmer</label>
                  <input
                    type="number"
                    value={newEvent.max_teilnehmer}
                    onChange={(e) => setNewEvent({ ...newEvent, max_teilnehmer: e.target.value })}
                    placeholder="Leer = unbegrenzt"
                    min="1"
                  />
                </div>

                <div className="form-group">
                  <label>Teilnahmegebühr (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newEvent.teilnahmegebuehr}
                    onChange={(e) => setNewEvent({ ...newEvent, teilnahmegebuehr: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Anmeldefrist</label>
                  <input
                    type="date"
                    value={newEvent.anmeldefrist}
                    onChange={(e) => setNewEvent({ ...newEvent, anmeldefrist: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={newEvent.status}
                    onChange={(e) => setNewEvent({ ...newEvent, status: e.target.value })}
                  >
                    <option value="geplant">Geplant</option>
                    <option value="anmeldung_offen">Anmeldung offen</option>
                    <option value="ausgebucht">Ausgebucht</option>
                    <option value="abgeschlossen">Abgeschlossen</option>
                    <option value="abgesagt">Abgesagt</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>Beschreibung</label>
                  <textarea
                    value={newEvent.beschreibung}
                    onChange={(e) => setNewEvent({ ...newEvent, beschreibung: e.target.value })}
                    rows="3"
                    placeholder="Beschreiben Sie das Event..."
                  />
                </div>

                <div className="form-group full-width">
                  <label>Anforderungen / Voraussetzungen</label>
                  <textarea
                    value={newEvent.anforderungen}
                    onChange={(e) => setNewEvent({ ...newEvent, anforderungen: e.target.value })}
                    rows="2"
                    placeholder="z.B. Mindestgraduierung, Ausrüstung, etc."
                  />
                </div>

                <div className="form-group full-width">
                  <label>Trainer</label>
                  <div className="trainer-multiselect">
                    {trainer.map((t) => (
                      <label key={t.trainer_id} className="trainer-checkbox">
                        <input
                          type="checkbox"
                          checked={newEvent.trainer_ids.includes(t.trainer_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewEvent({
                                ...newEvent,
                                trainer_ids: [...newEvent.trainer_ids, t.trainer_id]
                              });
                            } else {
                              setNewEvent({
                                ...newEvent,
                                trainer_ids: newEvent.trainer_ids.filter(id => id !== t.trainer_id)
                              });
                            }
                          }}
                        />
                        {t.vorname} {t.nachname}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewEvent(false)}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={handleCreateEvent}>
                Event erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Event bearbeiten */}
      {showEditEvent && selectedEvent && isAdmin() && (
        <div className="modal-overlay" onClick={() => setShowEditEvent(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Event bearbeiten</h2>
              <button className="modal-close" onClick={() => setShowEditEvent(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Titel *</label>
                  <input
                    type="text"
                    value={selectedEvent.titel}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, titel: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Event-Typ</label>
                  <select
                    value={selectedEvent.event_typ}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, event_typ: e.target.value })}
                  >
                    <option value="Turnier">Turnier</option>
                    <option value="Lehrgang">Lehrgang</option>
                    <option value="Prüfung">Prüfung</option>
                    <option value="Seminar">Seminar</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Feier">Feier</option>
                    <option value="Sonstiges">Sonstiges</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Datum *</label>
                  <input
                    type="date"
                    value={selectedEvent.datum?.substring(0, 10)}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, datum: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Beginn</label>
                  <input
                    type="time"
                    value={selectedEvent.uhrzeit_beginn || ''}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, uhrzeit_beginn: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Ende</label>
                  <input
                    type="time"
                    value={selectedEvent.uhrzeit_ende || ''}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, uhrzeit_ende: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Ort</label>
                  <input
                    type="text"
                    value={selectedEvent.ort || ''}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, ort: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Raum</label>
                  <select
                    value={selectedEvent.raum_id || ''}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, raum_id: e.target.value })}
                  >
                    <option value="">Kein Raum</option>
                    {raeume.map((raum) => (
                      <option key={raum.id} value={raum.id}>
                        {raum.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Max. Teilnehmer</label>
                  <input
                    type="number"
                    value={selectedEvent.max_teilnehmer || ''}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, max_teilnehmer: e.target.value })}
                    min="1"
                  />
                </div>

                <div className="form-group">
                  <label>Teilnahmegebühr (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedEvent.teilnahmegebuehr}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, teilnahmegebuehr: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Anmeldefrist</label>
                  <input
                    type="date"
                    value={selectedEvent.anmeldefrist?.substring(0, 10) || ''}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, anmeldefrist: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={selectedEvent.status}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, status: e.target.value })}
                  >
                    <option value="geplant">Geplant</option>
                    <option value="anmeldung_offen">Anmeldung offen</option>
                    <option value="ausgebucht">Ausgebucht</option>
                    <option value="abgeschlossen">Abgeschlossen</option>
                    <option value="abgesagt">Abgesagt</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>Beschreibung</label>
                  <textarea
                    value={selectedEvent.beschreibung || ''}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, beschreibung: e.target.value })}
                    rows="3"
                  />
                </div>

                <div className="form-group full-width">
                  <label>Anforderungen / Voraussetzungen</label>
                  <textarea
                    value={selectedEvent.anforderungen || ''}
                    onChange={(e) => setSelectedEvent({ ...selectedEvent, anforderungen: e.target.value })}
                    rows="2"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditEvent(false)}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={handleUpdateEvent}>
                Speichern
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
              <div className="event-details-grid">
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
                      <span className="info-label">Status:</span>
                      <span className={`badge ${getStatusColor(selectedEvent.status)}`}>
                        {getStatusText(selectedEvent.status)}
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
                    <div className="info-row">
                      <span className="info-label">Trainer:</span>
                      <span>{getTrainerNamen(selectedEvent.trainer_ids)}</span>
                    </div>
                  </div>

                  {selectedEvent.beschreibung && (
                    <div className="details-description">
                      <h4>Beschreibung</h4>
                      <p>{selectedEvent.beschreibung}</p>
                    </div>
                  )}

                  {selectedEvent.anforderungen && (
                    <div className="details-description">
                      <h4>Anforderungen</h4>
                      <p>{selectedEvent.anforderungen}</p>
                    </div>
                  )}
                </div>

                {isAdmin() && selectedEvent.anmeldungen && (
                  <div className="details-section">
                    <h3>Anmeldungen ({selectedEvent.anmeldungen.length})</h3>
                    {selectedEvent.anmeldungen.length === 0 ? (
                      <p className="text-muted">Noch keine Anmeldungen</p>
                    ) : (
                      <div className="anmeldungen-liste">
                        {selectedEvent.anmeldungen.map((anmeldung) => (
                          <div key={anmeldung.anmeldung_id} className="anmeldung-card">
                            <div className="anmeldung-header">
                              <strong>
                                {anmeldung.vorname} {anmeldung.nachname}
                              </strong>
                              <span className={`badge ${getStatusColor(anmeldung.status)}`}>
                                {getStatusText(anmeldung.status)}
                              </span>
                            </div>
                            <div className="anmeldung-info">
                              {anmeldung.email && <div>📧 {anmeldung.email}</div>}
                              {anmeldung.telefon && <div>📱 {anmeldung.telefon}</div>}
                              <div>
                                Angemeldet: {formatDatum(anmeldung.anmeldedatum)}
                              </div>
                              {anmeldung.bezahlt ? (
                                <div className="text-success">✅ Bezahlt</div>
                              ) : (
                                <div className="text-warning">⏳ Nicht bezahlt</div>
                              )}
                              {anmeldung.bemerkung && (
                                <div className="anmeldung-bemerkung">
                                  <em>{anmeldung.bemerkung}</em>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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

export default Events;
