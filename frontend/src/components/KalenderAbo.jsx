// ============================================================================
// KALENDER-ABO KOMPONENTE
// Frontend/src/components/KalenderAbo.jsx
// Ermöglicht Mitgliedern ihre Kalender-Links zu abonnieren
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Copy, Check, ExternalLink, Smartphone, Monitor, Apple } from 'lucide-react';
import '../styles/KalenderAbo.css';

const KalenderAbo = () => {
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(null);

  useEffect(() => {
    loadCalendarToken();
  }, []);

  const loadCalendarToken = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/ical/my-token');
      setCalendarData(response.data);
    } catch (err) {
      console.error('Fehler beim Laden des Kalender-Tokens:', err);
      setError('Kalender-Token konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (url, type) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(type);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Kopieren fehlgeschlagen:', err);
    }
  };

  const openInCalendar = (url, type) => {
    // Verschiedene URL-Schemes für verschiedene Kalender-Apps
    let calendarUrl = url;

    if (type === 'google') {
      calendarUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(url)}`;
    } else if (type === 'outlook') {
      calendarUrl = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(url)}`;
    }

    window.open(calendarUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="ka-container">
        <div className="ka-loading">
          <div className="ka-spinner"></div>
          <p>Lade Kalender-Einstellungen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ka-container">
        <div className="ka-error">
          <p>{error}</p>
          <button className="ka-retry-btn" onClick={loadCalendarToken}>
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ka-container">
      <div className="ka-header">
        <Calendar size={32} color="#ffd700" />
        <div>
          <h2 className="ka-title">Kalender-Synchronisation</h2>
          <p className="ka-subtitle">
            Synchronisiere deine Trainings und Events mit deinem Kalender
          </p>
        </div>
      </div>

      {/* Persönlicher Kalender */}
      <div className="ka-card">
        <div className="ka-card-header">
          <h3 className="ka-card-title">Mein persönlicher Trainingskalender</h3>
          <span className="ka-badge">Empfohlen</span>
        </div>
        <p className="ka-card-description">
          Enthält alle Kurse, für die du angemeldet bist, sowie deine Event-Anmeldungen.
        </p>

        <div className="ka-url-box">
          <input
            type="text"
            value={calendarData?.urls?.personal || ''}
            readOnly
            className="ka-url-input"
          />
          <button
            className="ka-copy-btn"
            onClick={() => copyToClipboard(calendarData?.urls?.personal, 'personal')}
          >
            {copiedUrl === 'personal' ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>

        <div className="ka-button-group">
          <button
            className="ka-calendar-btn"
            onClick={() => openInCalendar(calendarData?.urls?.personal, 'google')}
          >
            <img
              src="https://www.google.com/favicon.ico"
              alt="Google"
              className="ka-favicon-sm"
            />
            Google Kalender
          </button>
          <button
            className="ka-calendar-btn"
            onClick={() => openInCalendar(calendarData?.urls?.personal, 'outlook')}
          >
            <Monitor size={16} className="ka-btn-icon" />
            Outlook
          </button>
          <button
            className="ka-calendar-btn ka-calendar-btn--apple"
            onClick={() => copyToClipboard(calendarData?.urls?.personal, 'personal')}
          >
            <Apple size={16} className="ka-btn-icon" />
            Apple (Link kopieren)
          </button>
        </div>
      </div>

      {/* Dojo Stundenplan */}
      <div className="ka-card">
        <div className="ka-card-header">
          <h3 className="ka-card-title">Dojo Stundenplan</h3>
        </div>
        <p className="ka-card-description">
          Der komplette Stundenplan des Dojos mit allen Kursen.
        </p>

        <div className="ka-url-box">
          <input
            type="text"
            value={calendarData?.urls?.dojoSchedule || ''}
            readOnly
            className="ka-url-input"
          />
          <button
            className="ka-copy-btn"
            onClick={() => copyToClipboard(calendarData?.urls?.dojoSchedule, 'schedule')}
          >
            {copiedUrl === 'schedule' ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      {/* Dojo Events */}
      <div className="ka-card">
        <div className="ka-card-header">
          <h3 className="ka-card-title">Dojo Events</h3>
        </div>
        <p className="ka-card-description">
          Alle kommenden Events und Veranstaltungen des Dojos.
        </p>

        <div className="ka-url-box">
          <input
            type="text"
            value={calendarData?.urls?.dojoEvents || ''}
            readOnly
            className="ka-url-input"
          />
          <button
            className="ka-copy-btn"
            onClick={() => copyToClipboard(calendarData?.urls?.dojoEvents, 'events')}
          >
            {copiedUrl === 'events' ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      {/* Anleitungen */}
      <div className="ka-instructions-card">
        <h3 className="ka-instructions-title">So richtest du die Synchronisation ein:</h3>

        <div className="ka-instruction">
          <div className="ka-instruction-icon">
            <img
              src="https://www.google.com/favicon.ico"
              alt="Google"
              className="ka-favicon-lg"
            />
          </div>
          <div>
            <strong>Google Kalender:</strong>
            <p className="ka-instruction-text">
              Einstellungen → Kalender hinzufügen → Per URL → Link einfügen
            </p>
          </div>
        </div>

        <div className="ka-instruction">
          <div className="ka-instruction-icon">
            <Monitor size={24} color="#0078d4" />
          </div>
          <div>
            <strong>Outlook:</strong>
            <p className="ka-instruction-text">
              Kalender → Kalender hinzufügen → Aus dem Internet abonnieren → URL einfügen
            </p>
          </div>
        </div>

        <div className="ka-instruction">
          <div className="ka-instruction-icon">
            <Apple size={24} color="#fff" />
          </div>
          <div>
            <strong>Apple Kalender (Mac/iPhone/iPad):</strong>
            <p className="ka-instruction-text">
              Ablage → Neues Kalenderabonnement → URL einfügen
            </p>
          </div>
        </div>
      </div>

      <div className="ka-info-box">
        <Smartphone size={20} />
        <p>
          <strong>Tipp:</strong> Die Kalender werden automatisch aktualisiert.
          Änderungen an deinen Kursen oder Events erscheinen innerhalb weniger Stunden in deinem Kalender.
        </p>
      </div>
    </div>
  );
};

export default KalenderAbo;
