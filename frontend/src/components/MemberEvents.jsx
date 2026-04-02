import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, Users, AlertCircle, CheckCircle, X, ShoppingCart } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import MemberHeader from './MemberHeader.jsx';
import '../styles/components.css';
import '../styles/themes.css';
import '../styles/MemberEvents.css';

const MemberEvents = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memberData, setMemberData] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [activeTab, setActiveTab] = useState('events');
  const [tdaTurniere, setTdaTurniere] = useState([]);
  const [meineAnmeldungen, setMeineAnmeldungen] = useState({}); // tda_turnier_id → status
  const [turnierAnmeldeLoading, setTurnierAnmeldeLoading] = useState(null);

  // Bestelloptionen Modal State
  const [showBestellModal, setShowBestellModal] = useState(false);
  const [bestellEvent, setBestellEvent] = useState(null);
  const [bestellMengen, setBestellMengen] = useState({}); // { option_id: menge }
  const [gaesteAnzahl, setGaesteAnzahl] = useState(0);
  const [bestellFeedback, setBestellFeedback] = useState(null); // { type: 'success'|'error', text }

  useEffect(() => {
    if (user?.email) {
      loadMemberDataAndEvents();
    }
  }, [user?.email]);

  const loadMemberDataAndEvents = async () => {
    setLoading(true);
    try {
      // 1. Lade Mitgliedsdaten
      const memberRes = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/by-email/${encodeURIComponent(user.email)}`);
      const memberData = await memberRes.json();
      setMemberData(memberData);

      // 2. Lade Events + TDA Turniere parallel
      const [eventsRes, turniereRes, anmeldungenRes] = await Promise.all([
        fetchWithAuth(`${config.apiBaseUrl}/events/member/${memberData.mitglied_id}`),
        fetchWithAuth(`${config.apiBaseUrl}/tda-turniere?upcoming=true`),
        fetchWithAuth(`${config.apiBaseUrl}/tda-turniere/meine-anmeldungen`)
      ]);
      const eventsData = await eventsRes.json();
      setEvents(eventsData.events || []);

      if (turniereRes.ok) {
        const turniereData = await turniereRes.json();
        setTdaTurniere(turniereData.turniere || []);
      }
      if (anmeldungenRes.ok) {
        const anmeldungenData = await anmeldungenRes.json();
        const map = {};
        (anmeldungenData.anmeldungen || []).forEach(a => { map[a.tda_turnier_id] = a.status; });
        setMeineAnmeldungen(map);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Events:', error);
    } finally {
      setLoading(false);
    }
  };

  // Anmelden — direkt wenn keine Bestelloptionen, sonst Modal öffnen
  const handleAnmeldenClick = (event) => {
    if (!memberData) return;
    if (event.bestelloptionen && event.bestelloptionen.length > 0) {
      // Initialmengen: alle 0
      const initialMengen = {};
      event.bestelloptionen.forEach(o => { initialMengen[o.option_id] = 0; });
      setBestellMengen(initialMengen);
      setBestellEvent(event);
      setBestellFeedback(null);
      setGaesteAnzahl(0);
      setShowBestellModal(true);
    } else {
      handleAnmelden(event.event_id, []);
    }
  };

  const handleAnmelden = async (eventId, bestellungen) => {
    if (!memberData) return;
    setActionLoading(eventId);
    setBestellFeedback(null);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/events/${eventId}/anmelden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mitglied_id: memberData.mitglied_id,
          bestellungen,
          gaeste_anzahl: gaesteAnzahl
        })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Fehler bei der Anmeldung');
      if (resData.success) {
        setShowBestellModal(false);
        await loadMemberDataAndEvents();
      }
    } catch (error) {
      console.error('Fehler bei Event-Anmeldung:', error);
      setBestellFeedback({ type: 'error', text: error.message || 'Fehler bei der Anmeldung' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBestellModalSubmit = () => {
    if (!bestellEvent) return;
    const bestellungen = Object.entries(bestellMengen)
      .filter(([, menge]) => menge > 0)
      .map(([option_id, menge]) => ({ option_id: parseInt(option_id), menge }));
    handleAnmelden(bestellEvent.event_id, bestellungen);
  };

  const handleAbmelden = async (eventId) => {
    if (!memberData) return;
    if (!window.confirm('Möchten Sie sich wirklich von diesem Event abmelden?')) return;

    setActionLoading(eventId);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/events/${eventId}/anmelden`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitglied_id: memberData.mitglied_id })
      });
      const resData = await res.json();
      if (resData.success) {
        await loadMemberDataAndEvents();
      }
    } catch (error) {
      console.error('Fehler bei Event-Abmeldung:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTurnierAnmelden = async (turnier) => {
    setTurnierAnmeldeLoading(turnier.tda_turnier_id);
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/tda-turniere/${turnier.tda_turnier_id}/anmelden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      setMeineAnmeldungen(prev => ({ ...prev, [turnier.tda_turnier_id]: 'angemeldet' }));
    } catch (e) {
      console.error('Fehler bei TDA-Turnier-Anmeldung:', e);
    } finally {
      setTurnierAnmeldeLoading(null);
    }
    if (turnier.tda_registration_url) {
      window.open(turnier.tda_registration_url, '_blank', 'noopener,noreferrer');
    }
  };

  const setMenge = (optionId, delta) => {
    setBestellMengen(prev => ({
      ...prev,
      [optionId]: Math.max(0, (prev[optionId] || 0) + delta)
    }));
  };

  const getBestellGesamtbetrag = () => {
    if (!bestellEvent) return 0;
    return bestellEvent.bestelloptionen.reduce((sum, opt) => {
      return sum + (bestellMengen[opt.option_id] || 0) * parseFloat(opt.preis);
    }, 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return '';
    return timeString.slice(0, 5);
  };

  const getEventTypeIcon = (typ) => {
    const icons = { 'Seminar': '📚', 'Wettkampf': '🏆', 'Prüfung': '🥋', 'Workshop': '🎯', 'Lehrgang': '👥', 'Sonstiges': '📅' };
    return icons[typ] || '📅';
  };

  const getEventTypeColor = (typ) => {
    const colors = { 'Seminar': '#10B981', 'Wettkampf': '#F59E0B', 'Prüfung': '#8B5CF6', 'Workshop': '#06B6D4', 'Lehrgang': '#EF4444', 'Sonstiges': '#6B7280' };
    return colors[typ] || '#6B7280';
  };

  if (loading) {
    return (
      <div className="member-page">
        <div className="page-content me-page-centered">
          <p>Lade Events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="member-page">
      <MemberHeader />
      <div className="page-content me-page-content">
        <div className="page-header me-page-header">
          <h1 className="me-page-title">
            <Calendar size={32} />
            Veranstaltungen & Events
          </h1>
          <p className="me-page-subtitle">
            Melden Sie sich für kommende Events an
          </p>
        </div>

        {/* Tab-Umschalter */}
        <div className="me-tabs">
          <button
            className={`me-tab-btn${activeTab === 'events' ? ' active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            📅 Dojo Events
          </button>
          <button
            className={`me-tab-btn${activeTab === 'turniere' ? ' active' : ''}`}
            onClick={() => setActiveTab('turniere')}
          >
            🏆 TDA Turniere
            {Object.keys(meineAnmeldungen).length > 0 && (
              <span className="me-tab-badge">{Object.keys(meineAnmeldungen).length}</span>
            )}
          </button>
        </div>

        {/* TDA Turniere Tab */}
        {activeTab === 'turniere' && (
          <div>
            {tdaTurniere.length === 0 ? (
              <div className="me-empty-state">
                <span style={{ fontSize: '2.5rem' }}>🏆</span>
                <p className="me-empty-text">Aktuell sind keine TDA Turniere geplant.</p>
              </div>
            ) : (
              <div className="me-events-grid">
                {tdaTurniere.map(turnier => {
                  const anmeldStatus = meineAnmeldungen[turnier.tda_turnier_id];
                  const isLoading = turnierAnmeldeLoading === turnier.tda_turnier_id;
                  return (
                    <div key={turnier.id} className={`me-event-card ${anmeldStatus ? 'me-event-card--enrolled' : 'me-event-card--default'}`}>
                      <div className="me-event-header">
                        <div className="me-event-type-badge" style={{ background: '#F59E0B' }}>🏆 TDA Turnier</div>
                        {anmeldStatus && (
                          <span className={`me-turnier-status me-turnier-status--${anmeldStatus}`}>
                            {anmeldStatus === 'angemeldet' ? '✓ Angemeldet' : anmeldStatus === 'bestaetigt' ? '✅ Bestätigt' : '✗ Abgelehnt'}
                          </span>
                        )}
                      </div>
                      <h3 className="me-event-title">{turnier.name}</h3>
                      <div className="me-event-details">
                        <div className="me-event-detail"><Calendar size={14} /><span>{new Date(turnier.datum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
                        {turnier.ort && <div className="me-event-detail"><MapPin size={14} /><span>{turnier.ort}</span></div>}
                        {turnier.anmeldeschluss && <div className="me-event-detail"><Clock size={14} /><span>Anmeldeschluss: {new Date(turnier.anmeldeschluss).toLocaleDateString('de-DE')}</span></div>}
                        {turnier.teilnahmegebuehr > 0 && <div className="me-event-detail"><span>💶</span><span>Startgebühr: {parseFloat(turnier.teilnahmegebuehr).toFixed(2)} €</span></div>}
                      </div>
                      {turnier.beschreibung && <p className="me-event-description">{turnier.beschreibung}</p>}
                      <div className="me-event-actions">
                        {anmeldStatus === 'abgelehnt' ? (
                          <span className="me-status-text me-status-text--rejected">Anmeldung abgelehnt</span>
                        ) : anmeldStatus ? (
                          <button className="me-btn-enrolled" onClick={() => turnier.tda_registration_url && window.open(turnier.tda_registration_url, '_blank')}>
                            <CheckCircle size={16} /> Zur Anmeldung
                          </button>
                        ) : (
                          <button className="me-btn-register" onClick={() => handleTurnierAnmelden(turnier)} disabled={isLoading}>
                            {isLoading ? <span className="me-btn-spinner" /> : null}
                            {isLoading ? 'Wird angemeldet...' : 'Jetzt anmelden'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'events' && events.length === 0 ? (
          <div className="me-empty-state">
            <Calendar size={48} className="me-empty-icon" />
            <p className="me-empty-text">
              Derzeit sind keine Events geplant.
            </p>
          </div>
        ) : activeTab === 'events' ? (
          <div className="me-events-grid">
            {events.map(event => (
              <div
                key={event.event_id}
                className={`me-event-card ${event.ist_angemeldet ? 'me-event-card--enrolled' : 'me-event-card--default'}`}
              >
                {/* Event-Typ Badge */}
                <div className="me-event-badge" style={{ '--badge-bg': getEventTypeColor(event.event_typ) }}>
                  <span>{getEventTypeIcon(event.event_typ)}</span>
                  {event.event_typ}
                </div>

                {/* Event Titel */}
                <h3 className="me-event-title">
                  {event.titel}
                </h3>

                {/* Event Details Grid */}
                <div className="me-event-details-grid">
                  <div className="u-flex-row-md">
                    <Calendar size={18} className="u-text-accent" />
                    <span className="u-text-primary">{formatDate(event.datum)}</span>
                  </div>
                  {event.uhrzeit_beginn && (
                    <div className="u-flex-row-md">
                      <Clock size={18} className="u-text-accent" />
                      <span className="u-text-primary">
                        {formatTime(event.uhrzeit_beginn)} - {formatTime(event.uhrzeit_ende)}
                      </span>
                    </div>
                  )}
                  {event.ort && (
                    <div className="u-flex-row-md">
                      <MapPin size={18} className="u-text-accent" />
                      <span className="u-text-primary">
                        {event.ort} {event.raum_name ? `(${event.raum_name})` : ''}
                      </span>
                    </div>
                  )}
                  {event.max_teilnehmer && (
                    <div className="u-flex-row-md">
                      <Users size={18} className="u-text-accent" />
                      <span className="u-text-primary">
                        {event.anzahl_anmeldungen || 0} / {event.max_teilnehmer} Teilnehmer
                      </span>
                    </div>
                  )}
                </div>

                {/* Beschreibung */}
                {event.beschreibung && (
                  <p className="me-event-description">
                    {event.beschreibung}
                  </p>
                )}

                {/* Teilnahmegebühr */}
                {event.teilnahmegebuehr && parseFloat(event.teilnahmegebuehr) > 0 && (
                  <div className="me-fee-box">
                    <strong className="u-text-accent">Teilnahmegebühr:</strong>{' '}
                    <span className="u-text-primary">{parseFloat(event.teilnahmegebuehr).toFixed(2)} €</span>
                  </div>
                )}

                {/* Bestelloptionen-Hinweis */}
                {event.bestelloptionen && event.bestelloptionen.length > 0 && !event.ist_angemeldet && (
                  <div className="me-bestell-hint-box">
                    <ShoppingCart size={16} />
                    Bei der Anmeldung kannst du bestellen: {event.bestelloptionen.map(o => `${o.name} (${parseFloat(o.preis).toFixed(2)} €/${o.einheit})`).join(' · ')}
                  </div>
                )}

                {/* Meine Bestellung (wenn angemeldet) */}
                {event.ist_angemeldet && event.meine_bestellungen && event.meine_bestellungen.length > 0 && (
                  <div className="me-my-order-box">
                    🍽️ Meine Bestellung: {event.meine_bestellungen.map(b =>
                      `${b.menge}× ${b.name} (${parseFloat(b.preis * b.menge).toFixed(2)} €)`
                    ).join(' | ')}
                  </div>
                )}

                {/* Anmeldestatus & Aktionen */}
                <div className="me-event-actions">
                  {event.ist_angemeldet ? (
                    <>
                      <div className="me-enrolled-badge">
                        <CheckCircle size={18} />
                        Angemeldet
                      </div>
                      <button
                        onClick={() => handleAbmelden(event.event_id)}
                        disabled={actionLoading === event.event_id}
                        className="me-btn-abmelden"
                      >
                        <X size={18} />
                        {actionLoading === event.event_id ? 'Wird abgemeldet...' : 'Abmelden'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleAnmeldenClick(event)}
                      disabled={actionLoading === event.event_id || (event.max_teilnehmer && event.anzahl_anmeldungen >= event.max_teilnehmer)}
                      className={`me-btn-register${(event.max_teilnehmer && event.anzahl_anmeldungen >= event.max_teilnehmer) ? ' me-btn-register--full' : ''}`}
                    >
                      {actionLoading === event.event_id
                        ? 'Wird angemeldet...'
                        : (event.max_teilnehmer && event.anzahl_anmeldungen >= event.max_teilnehmer)
                          ? 'Ausgebucht'
                          : 'Jetzt anmelden'}
                    </button>
                  )}

                  {/* Anmeldefrist Warnung */}
                  {event.anmeldefrist && (
                    <div className="me-deadline-hint">
                      <AlertCircle size={16} />
                      Anmeldefrist: {formatDate(event.anmeldefrist)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Bestell-Modal */}
      {showBestellModal && bestellEvent && (
        <div className="me-modal-overlay" onClick={() => setShowBestellModal(false)}
        >
          <div className="me-modal-box" onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="me-modal-header">
              <div>
                <h2 className="me-modal-title">Anmeldung</h2>
                <p className="me-modal-subtitle">{bestellEvent.titel}</p>
              </div>
              <button onClick={() => setShowBestellModal(false)} className="me-modal-close">✕</button>
            </div>

            {/* Bestelloptionen */}
            <div className="me-bestell-section">
              <p className="me-bestell-hint">
                Bitte wähle deine Bestellung (optional):
              </p>
              {bestellEvent.bestelloptionen.map(opt => (
                <div
                  key={opt.option_id}
                  className="me-option-row"
                >
                  <div>
                    <span className="me-option-name">{opt.name}</span>
                    <span className="me-option-price">
                      {parseFloat(opt.preis).toFixed(2)} €/{opt.einheit}
                    </span>
                  </div>
                  <div className="u-flex-row-md">
                    <button
                      onClick={() => setMenge(opt.option_id, -1)}
                      className="me-qty-btn-minus"
                    >−</button>
                    <span className="me-qty-count">
                      {bestellMengen[opt.option_id] || 0}
                    </span>
                    <button
                      onClick={() => setMenge(opt.option_id, 1)}
                      className="me-qty-btn-plus"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>

            {/* Gäste */}
            <div className="me-guest-section">
              <div className="me-guest-row">
                <span className="me-guest-label">👥 Gäste mitbringen</span>
                <div className="u-flex-row-md">
                  <button onClick={() => setGaesteAnzahl(Math.max(0, gaesteAnzahl - 1))}
                    className="me-counter-btn">−</button>
                  <span className={`me-counter-value${gaesteAnzahl > 0 ? ' me-counter-value--active' : ''}`}>{gaesteAnzahl}</span>
                  <button onClick={() => setGaesteAnzahl(gaesteAnzahl + 1)}
                    className="me-counter-btn">+</button>
                </div>
              </div>
              {gaesteAnzahl > 0 && <p className="me-guest-hint">Die Bestellung oben gilt für dich + deine {gaesteAnzahl} Gast{gaesteAnzahl > 1 ? 'e' : ''}</p>}
            </div>

            {/* Gesamtbetrag */}
            {getBestellGesamtbetrag() > 0 && (
              <div className="me-total-box">
                <span className="u-text-secondary">Gesamtbetrag Bestellung:</span>
                <strong className="u-text-accent">{getBestellGesamtbetrag().toFixed(2)} €</strong>
              </div>
            )}

            {/* Fehler */}
            {bestellFeedback?.type === 'error' && (
              <div className="me-error-box">
                ❌ {bestellFeedback.text}
              </div>
            )}

            {/* Buttons */}
            <div className="me-modal-actions">
              <button
                onClick={() => setShowBestellModal(false)}
                className="me-btn-cancel"
              >
                Abbrechen
              </button>
              <button
                onClick={() => handleBestellModalSubmit()}
                disabled={actionLoading === bestellEvent.event_id}
                className="me-btn-submit"
              >
                {actionLoading === bestellEvent.event_id ? 'Wird angemeldet...' : 'Jetzt anmelden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberEvents;
