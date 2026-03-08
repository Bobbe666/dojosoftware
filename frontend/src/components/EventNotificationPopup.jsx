import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Users, X, Check, XCircle, ChevronRight, ShoppingCart } from 'lucide-react';
import './EventNotificationPopup.css';

const EventNotificationPopup = ({ events, memberData, onAnmelden, onAblehnen, onSpaeter, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [bestellMengen, setBestellMengen] = useState({});
  const [showBestellung, setShowBestellung] = useState(false);
  const [loading, setLoading] = useState(false);

  const event = events[currentIndex];
  if (!event) return null;

  const hasMore = currentIndex < events.length - 1;

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
    });
  };

  const formatTime = (t) => (t ? t.slice(0, 5) : '');

  const eventTypeIcon = {
    'Turnier': '🏆', 'Lehrgang': '👥', 'Prüfung': '🥋',
    'Seminar': '📚', 'Workshop': '🎯', 'Feier': '🎉', 'Sonstiges': '📅'
  }[event.event_typ] || '📅';

  const eventTypeColor = {
    'Turnier': '#F59E0B', 'Lehrgang': '#EF4444', 'Prüfung': '#8B5CF6',
    'Seminar': '#10B981', 'Workshop': '#06B6D4', 'Feier': '#EC4899', 'Sonstiges': '#6B7280'
  }[event.event_typ] || '#6B7280';

  const hasBestelloptionen = event.bestelloptionen?.length > 0;

  const getGesamtbetrag = () =>
    (event.bestelloptionen || []).reduce(
      (sum, opt) => sum + (bestellMengen[opt.option_id] || 0) * parseFloat(opt.preis || 0), 0
    );

  const setMenge = (optionId, delta) => {
    setBestellMengen(prev => ({
      ...prev,
      [optionId]: Math.max(0, (prev[optionId] || 0) + delta)
    }));
  };

  const handleAnmelden = async () => {
    setLoading(true);
    const bestellungen = hasBestelloptionen
      ? Object.entries(bestellMengen)
          .filter(([, m]) => m > 0)
          .map(([option_id, menge]) => ({ option_id: parseInt(option_id), menge }))
      : [];
    await onAnmelden(event, bestellungen);
    setLoading(false);
    if (hasMore) { setCurrentIndex(i => i + 1); setShowBestellung(false); setBestellMengen({}); }
  };

  const handleAblehnen = async () => {
    await onAblehnen(event);
    if (hasMore) { setCurrentIndex(i => i + 1); setShowBestellung(false); setBestellMengen({}); }
  };

  const handleSpaeter = async () => {
    await onSpaeter(event);
    if (hasMore) { setCurrentIndex(i => i + 1); setShowBestellung(false); setBestellMengen({}); }
    else onClose();
  };

  return (
    <div className="enp-overlay">
      <div className="enp-card">
        {/* Close Button */}
        <button onClick={onClose} className="enp-close-btn">
          <X size={16} />
        </button>

        {/* Header */}
        <div className="enp-header">
          <div className="enp-label">
            Neues Event
          </div>
          <div className="u-flex-row-md">
            <span className="u-fs-2rem">{eventTypeIcon}</span>
            <div>
              <h2 className="enp-title">
                {event.titel}
              </h2>
              <span className="enp-event-type-badge" style={{ '--event-type-color': eventTypeColor }}>
                {event.event_typ}
              </span>
            </div>
          </div>
          {events.length > 1 && (
            <div className="enp-counter">
              Event {currentIndex + 1} von {events.length}
            </div>
          )}
        </div>

        {/* Event Details */}
        <div className="enp-body">
          {/* Info Grid */}
          <div className="enp-info-grid">
            <div className="enp-info-box">
              <Calendar size={14} className="u-flex-shrink-accent" />
              <span className="enp-info-text">{formatDate(event.datum)}</span>
            </div>
            {(event.uhrzeit_beginn || event.uhrzeit_ende) && (
              <div className="enp-info-box">
                <Clock size={14} className="u-flex-shrink-accent" />
                <span className="enp-info-text">
                  {formatTime(event.uhrzeit_beginn)}{event.uhrzeit_ende ? ` – ${formatTime(event.uhrzeit_ende)}` : ''} Uhr
                </span>
              </div>
            )}
            {event.ort && (
              <div className="enp-info-box">
                <MapPin size={14} className="u-flex-shrink-accent" />
                <span className="enp-info-text">{event.ort}</span>
              </div>
            )}
            {event.max_teilnehmer && (
              <div className="enp-info-box">
                <Users size={14} className="u-flex-shrink-accent" />
                <span className="enp-info-text">
                  {event.anmeldungen_count || 0} / {event.max_teilnehmer} Plätze
                </span>
              </div>
            )}
          </div>

          {/* Beschreibung */}
          {event.beschreibung && (
            <p className="enp-description">
              {event.beschreibung}
            </p>
          )}

          {/* Anforderungen */}
          {event.anforderungen && (
            <p className="enp-requirements">
              ⚠️ Voraussetzungen: {event.anforderungen}
            </p>
          )}

          {/* Teilnahmegebühr */}
          {parseFloat(event.teilnahmegebuehr) > 0 && (
            <div className="enp-info-box enp-info-box--fee">
              <span className="enp-fee-text">
                💰 Teilnahmegebühr: {parseFloat(event.teilnahmegebuehr).toFixed(2)} €
              </span>
            </div>
          )}

          {/* Anmeldefrist */}
          {event.anmeldefrist && (
            <div className="enp-deadline">
              ⏰ Anmeldefrist: {formatDate(event.anmeldefrist)}
            </div>
          )}

          {/* Bestelloptionen */}
          {hasBestelloptionen && (
            <div className="enp-order-section">
              <button
                onClick={() => setShowBestellung(v => !v)}
                className="enp-order-toggle"
              >
                <span className="enp-order-toggle-inner">
                  <ShoppingCart size={14} /> Bestellung aufgeben (optional)
                </span>
                <ChevronRight size={14} className={showBestellung ? 'enp-chevron enp-chevron--open' : 'enp-chevron'} />
              </button>

              {showBestellung && (
                <div className="enp-order-panel">
                  {event.bestelloptionen.map(opt => (
                    <div key={opt.option_id} className="enp-order-row">
                      <div>
                        <span className="enp-order-name">{opt.name}</span>
                        <span className="enp-order-price">
                          {parseFloat(opt.preis).toFixed(2)} €/{opt.einheit}
                        </span>
                      </div>
                      <div className="u-flex-row-sm">
                        <button onClick={() => setMenge(opt.option_id, -1)} className="enp-qty-btn">−</button>
                        <span className="enp-qty-display">
                          {bestellMengen[opt.option_id] || 0}
                        </span>
                        <button onClick={() => setMenge(opt.option_id, 1)} className="enp-qty-btn">+</button>
                      </div>
                    </div>
                  ))}
                  {getGesamtbetrag() > 0 && (
                    <div className="enp-order-total">
                      Gesamt: {getGesamtbetrag().toFixed(2)} €
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="enp-footer">
          <button
            onClick={handleAnmelden}
            disabled={loading}
            className="enp-btn-accept"
          >
            <Check size={16} />
            {loading ? 'Wird angemeldet...' : 'Jetzt anmelden'}
          </button>

          <button
            onClick={handleAblehnen}
            disabled={loading}
            className="enp-btn-decline"
          >
            <XCircle size={16} />
            Ablehnen
          </button>

          <button
            onClick={handleSpaeter}
            disabled={loading}
            className="enp-btn-later"
          >
            Später im Dashboard ansehen →
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventNotificationPopup;
