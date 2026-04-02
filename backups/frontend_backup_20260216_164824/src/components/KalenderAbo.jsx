// ============================================================================
// KALENDER-ABO KOMPONENTE
// Frontend/src/components/KalenderAbo.jsx
// Ermöglicht Mitgliedern ihre Kalender-Links zu abonnieren
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Copy, Check, ExternalLink, Smartphone, Monitor, Apple } from 'lucide-react';

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
      <div style={styles.container}>
        <div style={styles.loading}>
          <div style={styles.spinner}></div>
          <p>Lade Kalender-Einstellungen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <p>{error}</p>
          <button style={styles.retryButton} onClick={loadCalendarToken}>
            Erneut versuchen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Calendar size={32} color="#ffd700" />
        <div>
          <h2 style={styles.title}>Kalender-Synchronisation</h2>
          <p style={styles.subtitle}>
            Synchronisiere deine Trainings und Events mit deinem Kalender
          </p>
        </div>
      </div>

      {/* Persönlicher Kalender */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>Mein persönlicher Trainingskalender</h3>
          <span style={styles.badge}>Empfohlen</span>
        </div>
        <p style={styles.cardDescription}>
          Enthält alle Kurse, für die du angemeldet bist, sowie deine Event-Anmeldungen.
        </p>

        <div style={styles.urlBox}>
          <input
            type="text"
            value={calendarData?.urls?.personal || ''}
            readOnly
            style={styles.urlInput}
          />
          <button
            style={styles.copyButton}
            onClick={() => copyToClipboard(calendarData?.urls?.personal, 'personal')}
          >
            {copiedUrl === 'personal' ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>

        <div style={styles.buttonGroup}>
          <button
            style={styles.calendarButton}
            onClick={() => openInCalendar(calendarData?.urls?.personal, 'google')}
          >
            <img
              src="https://www.google.com/favicon.ico"
              alt="Google"
              style={{ width: 16, height: 16, marginRight: 8 }}
            />
            Google Kalender
          </button>
          <button
            style={styles.calendarButton}
            onClick={() => openInCalendar(calendarData?.urls?.personal, 'outlook')}
          >
            <Monitor size={16} style={{ marginRight: 8 }} />
            Outlook
          </button>
          <button
            style={{...styles.calendarButton, ...styles.appleButton}}
            onClick={() => copyToClipboard(calendarData?.urls?.personal, 'personal')}
          >
            <Apple size={16} style={{ marginRight: 8 }} />
            Apple (Link kopieren)
          </button>
        </div>
      </div>

      {/* Dojo Stundenplan */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>Dojo Stundenplan</h3>
        </div>
        <p style={styles.cardDescription}>
          Der komplette Stundenplan des Dojos mit allen Kursen.
        </p>

        <div style={styles.urlBox}>
          <input
            type="text"
            value={calendarData?.urls?.dojoSchedule || ''}
            readOnly
            style={styles.urlInput}
          />
          <button
            style={styles.copyButton}
            onClick={() => copyToClipboard(calendarData?.urls?.dojoSchedule, 'schedule')}
          >
            {copiedUrl === 'schedule' ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      {/* Dojo Events */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>Dojo Events</h3>
        </div>
        <p style={styles.cardDescription}>
          Alle kommenden Events und Veranstaltungen des Dojos.
        </p>

        <div style={styles.urlBox}>
          <input
            type="text"
            value={calendarData?.urls?.dojoEvents || ''}
            readOnly
            style={styles.urlInput}
          />
          <button
            style={styles.copyButton}
            onClick={() => copyToClipboard(calendarData?.urls?.dojoEvents, 'events')}
          >
            {copiedUrl === 'events' ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>
      </div>

      {/* Anleitungen */}
      <div style={styles.instructionsCard}>
        <h3 style={styles.instructionsTitle}>So richtest du die Synchronisation ein:</h3>

        <div style={styles.instruction}>
          <div style={styles.instructionIcon}>
            <img
              src="https://www.google.com/favicon.ico"
              alt="Google"
              style={{ width: 24, height: 24 }}
            />
          </div>
          <div>
            <strong>Google Kalender:</strong>
            <p style={styles.instructionText}>
              Einstellungen → Kalender hinzufügen → Per URL → Link einfügen
            </p>
          </div>
        </div>

        <div style={styles.instruction}>
          <div style={styles.instructionIcon}>
            <Monitor size={24} color="#0078d4" />
          </div>
          <div>
            <strong>Outlook:</strong>
            <p style={styles.instructionText}>
              Kalender → Kalender hinzufügen → Aus dem Internet abonnieren → URL einfügen
            </p>
          </div>
        </div>

        <div style={styles.instruction}>
          <div style={styles.instructionIcon}>
            <Apple size={24} color="#fff" />
          </div>
          <div>
            <strong>Apple Kalender (Mac/iPhone/iPad):</strong>
            <p style={styles.instructionText}>
              Ablage → Neues Kalenderabonnement → URL einfügen
            </p>
          </div>
        </div>
      </div>

      <div style={styles.infoBox}>
        <Smartphone size={20} />
        <p>
          <strong>Tipp:</strong> Die Kalender werden automatisch aktualisiert.
          Änderungen an deinen Kursen oder Events erscheinen innerhalb weniger Stunden in deinem Kalender.
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '32px'
  },
  title: {
    color: '#ffd700',
    margin: 0,
    fontSize: '24px'
  },
  subtitle: {
    color: '#aaa',
    margin: '4px 0 0 0',
    fontSize: '14px'
  },
  card: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 215, 0, 0.2)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  cardTitle: {
    color: '#fff',
    margin: 0,
    fontSize: '18px'
  },
  badge: {
    background: 'rgba(255, 215, 0, 0.2)',
    color: '#ffd700',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  cardDescription: {
    color: '#aaa',
    fontSize: '14px',
    marginBottom: '16px'
  },
  urlBox: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px'
  },
  urlInput: {
    flex: 1,
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '12px',
    color: '#fff',
    fontSize: '13px',
    fontFamily: 'monospace'
  },
  copyButton: {
    background: 'rgba(255, 215, 0, 0.2)',
    border: '1px solid rgba(255, 215, 0, 0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#ffd700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s'
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  calendarButton: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  appleButton: {
    background: 'rgba(0, 0, 0, 0.3)'
  },
  instructionsCard: {
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '12px',
    padding: '20px',
    marginTop: '24px'
  },
  instructionsTitle: {
    color: '#3b82f6',
    margin: '0 0 16px 0',
    fontSize: '16px'
  },
  instruction: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    marginBottom: '16px'
  },
  instructionIcon: {
    width: '40px',
    height: '40px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  instructionText: {
    color: '#aaa',
    margin: '4px 0 0 0',
    fontSize: '13px'
  },
  infoBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    background: 'rgba(255, 215, 0, 0.1)',
    border: '1px solid rgba(255, 215, 0, 0.2)',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '16px',
    color: '#ffd700'
  },
  loading: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#aaa'
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255, 215, 0, 0.2)',
    borderTop: '3px solid #ffd700',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    margin: '0 auto 16px'
  },
  error: {
    textAlign: 'center',
    padding: '40px',
    color: '#ef4444'
  },
  retryButton: {
    marginTop: '16px',
    padding: '10px 20px',
    background: '#ffd700',
    border: 'none',
    borderRadius: '8px',
    color: '#1a1a2e',
    fontWeight: 'bold',
    cursor: 'pointer'
  }
};

export default KalenderAbo;
