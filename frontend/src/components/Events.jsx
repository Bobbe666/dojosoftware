import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import config from '../config/config.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/Events.css';
import '../styles/Dashboard.css';

const Events = () => {
  const { token, isAdmin } = useAuth();
  const { activeDojo } = useDojoContext();

  const [events, setEvents] = useState([]);
  const [raeume, setRaeume] = useState([]);
  const [trainer, setTrainer] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('aktuelle'); // 'aktuelle', 'geplante', 'vergangene'

  // Modal States
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showEditEvent, setShowEditEvent] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showAddParticipantModal, setShowAddParticipantModal] = useState(false);
  const [selectedEventForParticipant, setSelectedEventForParticipant] = useState(null);

  // Teilnehmer-Verwaltung States
  const [allMembers, setAllMembers] = useState([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [participantBemerkung, setParticipantBemerkung] = useState('');
  const [participantBezahlt, setParticipantBezahlt] = useState(false);
  const [eventRegistrations, setEventRegistrations] = useState({});

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
      const dojoFilter = activeDojo?.id ? `?dojo_id=${activeDojo.id}` : '';
      const response = await axios.get(`/events${dojoFilter}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Stelle sicher, dass response.data ein Array ist
      if (Array.isArray(response.data)) {
        setEvents(response.data);
      } else {
        console.error('Events API returned non-array:', response.data);
        setEvents([]);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Events:', err);
      setError('Fehler beim Laden der Events: ' + err.message);
      setEvents([]); // Stelle sicher, dass events ein Array bleibt
    } finally {
      setLoading(false);
    }
  }, [token, activeDojo]);

  // Lade Räume
  const ladeRaeume = useCallback(async () => {
    try {
      const response = await axios.get(`/raeume`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Die API gibt { success: true, data: raeume } zurück
      const raeumeData = response.data.data || response.data || [];

      // Stelle sicher, dass raeumeData ein Array ist
      if (Array.isArray(raeumeData)) {
        setRaeume(raeumeData);
      } else {
        console.error('Raeume API returned non-array:', raeumeData);
        setRaeume([]);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Räume:', err);
      setRaeume([]);
    }
  }, [token]);

  // Lade Trainer
  const ladeTrainer = useCallback(async () => {
    try {
      const response = await axios.get(`/trainer`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Stelle sicher, dass response.data ein Array ist
      if (Array.isArray(response.data)) {
        setTrainer(response.data);
      } else {
        console.error('Trainer API returned non-array:', response.data);
        setTrainer([]);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Trainer:', err);
      setTrainer([]);
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
        `/events`,
        {
          ...newEvent,
          dojo_id: activeDojo?.id || 1,
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
        `/events/${selectedEvent.event_id}`,
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
      await axios.delete(`/events/${eventId}`, {
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
        `/events/${event.event_id}/anmeldungen`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSelectedEvent({ ...event, anmeldungen: response.data });
    } catch (err) {
      console.error('Fehler beim Laden der Anmeldungen:', err);
    }
  };

  // Lade alle Mitglieder für Teilnehmer-Auswahl (ALLE Mitglieder, nicht nur vom aktuellen Dojo)
  useEffect(() => {
    const loadMembers = async () => {
      if (!isAdmin) return;
      try {
        const response = await axios.get(`/mitglieder/all`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAllMembers(response.data || []);
      } catch (err) {
        console.error('Fehler beim Laden der Mitglieder:', err);
      }
    };
    loadMembers();
  }, [isAdmin, token]);

  // Öffne Add Participant Modal
  const handleShowAddParticipant = async (event) => {
    setSelectedEventForParticipant(event);
    setSelectedMemberId('');
    setParticipantBemerkung('');
    setParticipantBezahlt(false);

    // Lade existierende Anmeldungen für dieses Event
    try {
      const response = await axios.get(
        `/events/${event.event_id}/anmeldungen`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Speichere registrierte Mitglieder-IDs
      const registeredIds = response.data.map(a => a.mitglied_id);
      setEventRegistrations(prev => ({...prev, [event.event_id]: registeredIds}));
    } catch (err) {
      console.error('Fehler beim Laden der Anmeldungen:', err);
    }

    setShowAddParticipantModal(true);
  };

  // Füge Teilnehmer zum Event hinzu
  const handleAddParticipant = async () => {
    if (!selectedMemberId) {
      alert('Bitte wählen Sie ein Mitglied aus');
      return;
    }

    setError('');
    try {
      const response = await axios.post(
        `/events/${selectedEventForParticipant.event_id}/admin-anmelden`,
        {
          mitglied_id: parseInt(selectedMemberId),
          bemerkung: participantBemerkung || undefined,
          bezahlt: participantBezahlt
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert(response.data.message || 'Teilnehmer erfolgreich hinzugefügt');
        setShowAddParticipantModal(false);
        ladeEvents(); // Refresh event list
      }
    } catch (err) {
      console.error('Fehler beim Hinzufügen des Teilnehmers:', err);
      alert('Fehler: ' + (err.response?.data?.error || err.message));
    }
  };

  // Markiere Anmeldung als bezahlt
  const handleMarkAsPaid = async (anmeldungId) => {
    if (!confirm('Anmeldung als bezahlt markieren?')) {
      return;
    }

    try {
      const response = await axios.put(
        `/events/anmeldung/${anmeldungId}/bezahlt`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        alert(response.data.message || 'Anmeldung als bezahlt markiert');
        // Refresh event details um aktualisierte Anmeldung zu zeigen
        if (selectedEvent) {
          const eventResponse = await axios.get(
            `/events/${selectedEvent.event_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setSelectedEvent(eventResponse.data);
        }
      }
    } catch (err) {
      console.error('Fehler beim Markieren als bezahlt:', err);
      alert('Fehler: ' + (err.response?.data?.error || err.message));
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

  // Events nach Datum filtern
  const getFilteredEvents = () => {
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);

    return events.filter(event => {
      const eventDatum = new Date(event.datum);
      eventDatum.setHours(0, 0, 0, 0);

      if (activeTab === 'aktuelle') {
        // Heute
        return eventDatum.getTime() === heute.getTime();
      } else if (activeTab === 'geplante') {
        // Zukünftig
        return eventDatum.getTime() > heute.getTime();
      } else if (activeTab === 'vergangene') {
        // Vergangen
        return eventDatum.getTime() < heute.getTime();
      }
      return true;
    });
  };

  const filteredEvents = getFilteredEvents();

  // Tab-Konfiguration für Sidebar
  const tabs = [
    { key: 'aktuelle', label: 'Aktuelle', icon: '📅' },
    { key: 'geplante', label: 'Geplante', icon: '🗓️' },
    { key: 'vergangene', label: 'Vergangene', icon: '📜' }
  ];

  return (
    <div className="events-container">
      <div className="events-layout">
        {/* Sidebar */}
        <aside className="events-sidebar">
          {/* Sidebar Header */}
          <div className="events-sidebar-header">
            <div className="events-icon">📅</div>
            <h2 className="events-sidebar-title">Events</h2>
          </div>

          {/* Navigation Tabs */}
          <nav className="tabs-vertical">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`tab-vertical-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Neues Event Button */}
          {isAdmin && (
            <button
              className="btn-create-event"
              onClick={() => setShowNewEvent(true)}
            >
              <span>➕</span>
              <span>Neues Event erstellen</span>
            </button>
          )}
        </aside>

        {/* Main Content */}
        <div className="events-content">
          {error && (
            <div className="error-message" style={{ marginBottom: '1rem' }}>
              ⚠️ {error}
            </div>
          )}

          <div className="glass-card">
            <div className="card-body">
            {loading ? (
              <div className="loading-state">
                <p>Lade Events...</p>
              </div>
            ) : filteredEvents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <h3>Keine {activeTab === 'aktuelle' ? 'aktuellen' : activeTab === 'geplante' ? 'geplanten' : 'vergangenen'} Events</h3>
                <p>{activeTab === 'aktuelle' ? 'Heute finden keine Events statt.' : activeTab === 'geplante' ? 'Es sind noch keine Events geplant.' : 'Es gibt noch keine vergangenen Events.'}</p>
              </div>
            ) : (
              <div className="events-list">
                {filteredEvents.map((event) => (
                  <div
                    key={event.event_id}
                    className={`event-card ${activeTab === 'vergangene' ? 'event-card-compact' : ''}`}
                    onClick={activeTab === 'vergangene' ? () => handleShowDetails(event) : undefined}
                    style={activeTab === 'vergangene' ? { cursor: 'pointer' } : {}}
                  >
                    {activeTab === 'vergangene' ? (
                      // Kompakte Ansicht für vergangene Events
                      <>
                        <div className="event-card-header">
                          <div className="event-title-section">
                            <h3>{event.titel}</h3>
                            <div className="event-info-row" style={{ marginTop: '0.5rem' }}>
                              <span className="event-icon">📅</span>
                              <span>{formatDatum(event.datum)}</span>
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="event-actions" onClick={(e) => e.stopPropagation()}>
                              <button
                                className="btn-icon btn-success"
                                onClick={() => handleShowAddParticipant(event)}
                                title="Teilnehmer hinzufügen"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1))',
                                  border: '1px solid rgba(255, 215, 0, 0.3)',
                                  fontSize: '0.85rem'
                                }}
                              >
                                👤➕
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
                      </>
                    ) : (
                      // Vollständige Ansicht für aktuelle und geplante Events
                      <>
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
                          {isAdmin && (
                            <div className="event-actions">
                              <button
                                className="btn-icon"
                                onClick={() => handleShowDetails(event)}
                                title="Details anzeigen"
                              >
                                👁️
                              </button>
                              <button
                                className="btn-icon btn-success"
                                onClick={() => handleShowAddParticipant(event)}
                                title="Teilnehmer hinzufügen"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.1))',
                                  border: '1px solid rgba(255, 215, 0, 0.3)',
                                  fontSize: '0.85rem'
                                }}
                              >
                                👤➕
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

                        {!isAdmin && (
                          <div className="event-card-footer">
                            <button className="btn btn-primary" onClick={() => handleShowDetails(event)}>
                              Details anzeigen
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Modal: Neues Event */}
      {showNewEvent && isAdmin && (
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
                    {Array.isArray(raeume) && raeume.map((raum) => (
                      <option key={raum.raum_id || raum.id} value={raum.raum_id || raum.id}>
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
      {showEditEvent && selectedEvent && isAdmin && (
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
                    {Array.isArray(raeume) && raeume.map((raum) => (
                      <option key={raum.raum_id || raum.id} value={raum.raum_id || raum.id}>
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

                {isAdmin && selectedEvent.anmeldungen && (
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <div className="text-warning">⏳ Nicht bezahlt</div>
                                  {isAdmin && (
                                    <button
                                      className="btn btn-sm"
                                      onClick={() => handleMarkAsPaid(anmeldung.anmeldung_id)}
                                      style={{
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.75rem',
                                        background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.1))',
                                        border: '1px solid rgba(255, 215, 0, 0.4)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        color: 'rgba(255, 215, 0, 0.9)',
                                        fontWeight: '600'
                                      }}
                                    >
                                      Bezahlt
                                    </button>
                                  )}
                                </div>
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

      {/* Modal: Teilnehmer hinzufügen */}
      {showAddParticipantModal && selectedEventForParticipant && isAdmin && (
        <div className="modal-overlay" onClick={() => setShowAddParticipantModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Teilnehmer zu "{selectedEventForParticipant.titel}" hinzufügen</h2>
              <button className="btn-close" onClick={() => setShowAddParticipantModal(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Mitglied auswählen *</label>
                <select
                  className="form-control"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  required
                >
                  <option value="">-- Mitglied wählen --</option>
                  {allMembers
                    .filter(member => {
                      // Filtere bereits angemeldete Mitglieder heraus
                      const registeredIds = eventRegistrations[selectedEventForParticipant.event_id] || [];
                      return !registeredIds.includes(member.mitglied_id);
                    })
                    .map((member) => (
                      <option key={member.mitglied_id} value={member.mitglied_id}>
                        {member.vorname} {member.nachname} ({member.email})
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label>Bemerkung (optional)</label>
                <textarea
                  className="form-control"
                  rows="3"
                  value={participantBemerkung}
                  onChange={(e) => setParticipantBemerkung(e.target.value)}
                  placeholder="Optionale Notiz zur Anmeldung..."
                />
              </div>

              <div className="form-group">
                <label>Zahlungsstatus *</label>
                <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="bezahlt"
                      checked={participantBezahlt === true}
                      onChange={() => setParticipantBezahlt(true)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Bezahlt</span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="bezahlt"
                      checked={participantBezahlt === false}
                      onChange={() => setParticipantBezahlt(false)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Offen</span>
                  </label>
                </div>
              </div>

              <div className="alert alert-info" style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.3)' }}>
                ℹ️ Das Mitglied erhält eine Benachrichtigung über die Anmeldung.
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowAddParticipantModal(false)}
              >
                Abbrechen
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAddParticipant}
                disabled={!selectedMemberId}
                style={{
                  background: selectedMemberId ? 'linear-gradient(135deg, rgba(255, 215, 0, 0.3), rgba(255, 215, 0, 0.1))' : undefined,
                  border: selectedMemberId ? '1px solid rgba(255, 215, 0, 0.4)' : undefined
                }}
              >
                ✓ Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
