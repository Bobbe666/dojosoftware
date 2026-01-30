/**
 * PROBETRAINING BUCHUNG - Öffentliche Seite
 * ==========================================
 * Ermöglicht Interessenten, ein Probetraining zu buchen
 * ohne Login erforderlich
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar, Clock, User, Mail, Phone, MessageSquare,
  CheckCircle, AlertCircle, Loader2, MapPin, ChevronRight
} from 'lucide-react';
import config from '../config/config.js';

const ProbetrainingBuchung = () => {
  const [searchParams] = useSearchParams();

  // Subdomain aus URL oder window.location ermitteln
  const getSubdomain = () => {
    // Erst aus URL-Parameter versuchen (für Testing)
    const paramSubdomain = searchParams.get('dojo');
    if (paramSubdomain) return paramSubdomain;

    // Dann aus Hostname
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    // z.B. demo1.dojo.tda-intl.org -> demo1
    if (parts.length >= 3 && parts[1] === 'dojo') {
      return parts[0];
    }
    // Fallback für Entwicklung
    return 'demo1';
  };

  const subdomain = getSubdomain();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const [dojoData, setDojoData] = useState(null);
  const [kurse, setKurse] = useState([]);
  const [stile, setStile] = useState([]);

  const [formData, setFormData] = useState({
    vorname: '',
    nachname: '',
    email: '',
    telefon: '',
    stil_id: '',
    kurs_id: '',
    wunschdatum: '',
    nachricht: '',
    datenschutz_akzeptiert: false,
    wie_gefunden: ''
  });

  // Dojo-Daten und Kurse laden
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${config.apiBaseUrl}/public/probetraining/dojo/${subdomain}`);
        const result = await response.json();

        if (!result.success) {
          setError(result.error || 'Dojo nicht gefunden');
          return;
        }

        setDojoData(result.data.dojo);
        setKurse(result.data.kurse);
        setStile(result.data.stile);

      } catch (err) {
        console.error('Fehler beim Laden:', err);
        setError('Verbindungsfehler. Bitte versuchen Sie es später erneut.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [subdomain]);

  // Formular absenden
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.datenschutz_akzeptiert) {
      setError('Bitte akzeptieren Sie die Datenschutzerklärung.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const response = await fetch(`${config.apiBaseUrl}/public/probetraining/buchen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dojo_id: dojoData.id,
          ...formData
        })
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(true);

    } catch (err) {
      console.error('Fehler beim Absenden:', err);
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  // Gefilterte Kurse nach Stil
  const filteredKurse = formData.stil_id
    ? kurse.filter(k => k.stil_name === stile.find(s => s.stil_id == formData.stil_id)?.name)
    : kurse;

  // Styles
  const styles = {
    container: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
      padding: '2rem 1rem',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    },
    card: {
      maxWidth: '600px',
      margin: '0 auto',
      background: 'rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(20px)',
      borderRadius: '16px',
      border: '1px solid rgba(255, 215, 0, 0.2)',
      overflow: 'hidden'
    },
    header: {
      background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 215, 0, 0.05))',
      padding: '2rem',
      textAlign: 'center',
      borderBottom: '1px solid rgba(255, 215, 0, 0.2)'
    },
    logo: {
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      objectFit: 'cover',
      marginBottom: '1rem',
      border: '3px solid rgba(255, 215, 0, 0.3)'
    },
    title: {
      color: '#ffd700',
      fontSize: '1.75rem',
      fontWeight: 700,
      margin: '0 0 0.5rem 0'
    },
    subtitle: {
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: '1rem',
      margin: 0
    },
    form: {
      padding: '2rem'
    },
    formGroup: {
      marginBottom: '1.5rem'
    },
    label: {
      display: 'block',
      color: 'rgba(255, 255, 255, 0.9)',
      fontSize: '0.9rem',
      fontWeight: 500,
      marginBottom: '0.5rem'
    },
    input: {
      width: '100%',
      padding: '0.875rem 1rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 215, 0, 0.2)',
      borderRadius: '8px',
      color: '#ffffff',
      fontSize: '1rem',
      outline: 'none',
      transition: 'all 0.2s',
      boxSizing: 'border-box'
    },
    inputFocus: {
      borderColor: '#ffd700',
      boxShadow: '0 0 0 3px rgba(255, 215, 0, 0.1)'
    },
    select: {
      width: '100%',
      padding: '0.875rem 1rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 215, 0, 0.2)',
      borderRadius: '8px',
      color: '#ffffff',
      fontSize: '1rem',
      outline: 'none',
      cursor: 'pointer'
    },
    textarea: {
      width: '100%',
      padding: '0.875rem 1rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 215, 0, 0.2)',
      borderRadius: '8px',
      color: '#ffffff',
      fontSize: '1rem',
      minHeight: '100px',
      resize: 'vertical',
      outline: 'none',
      boxSizing: 'border-box'
    },
    kursGrid: {
      display: 'grid',
      gap: '0.75rem'
    },
    kursCard: {
      display: 'flex',
      alignItems: 'center',
      padding: '1rem',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s'
    },
    kursCardSelected: {
      background: 'rgba(255, 215, 0, 0.1)',
      borderColor: '#ffd700'
    },
    kursRadio: {
      width: '20px',
      height: '20px',
      marginRight: '1rem',
      accentColor: '#ffd700'
    },
    kursInfo: {
      flex: 1
    },
    kursName: {
      color: '#ffffff',
      fontWeight: 600,
      fontSize: '0.95rem',
      marginBottom: '0.25rem'
    },
    kursDetails: {
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: '0.85rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem'
    },
    checkbox: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.75rem',
      marginBottom: '1.5rem'
    },
    checkboxInput: {
      width: '20px',
      height: '20px',
      marginTop: '2px',
      accentColor: '#ffd700',
      cursor: 'pointer'
    },
    checkboxLabel: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: '0.9rem',
      lineHeight: 1.5
    },
    button: {
      width: '100%',
      padding: '1rem',
      background: 'linear-gradient(135deg, #ffd700, #ffed4a)',
      color: '#1a1a2e',
      border: 'none',
      borderRadius: '8px',
      fontSize: '1.1rem',
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
      transition: 'all 0.2s'
    },
    buttonDisabled: {
      opacity: 0.6,
      cursor: 'not-allowed'
    },
    error: {
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '8px',
      padding: '1rem',
      marginBottom: '1.5rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      color: '#ef4444'
    },
    success: {
      textAlign: 'center',
      padding: '3rem 2rem'
    },
    successIcon: {
      width: '80px',
      height: '80px',
      background: 'rgba(16, 185, 129, 0.2)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 1.5rem'
    },
    successTitle: {
      color: '#10b981',
      fontSize: '1.5rem',
      fontWeight: 700,
      marginBottom: '1rem'
    },
    successText: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: '1rem',
      lineHeight: 1.6
    },
    loading: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '4rem 2rem',
      color: 'rgba(255, 255, 255, 0.7)'
    },
    row: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '1rem'
    }
  };

  // Loading State
  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.loading}>
            <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: '#ffd700' }} />
            <p style={{ marginTop: '1rem' }}>Lade Dojo-Daten...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error State (Dojo nicht gefunden)
  if (!dojoData) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ ...styles.loading, color: '#ef4444' }}>
            <AlertCircle size={48} />
            <p style={{ marginTop: '1rem' }}>{error || 'Dojo nicht gefunden'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Success State
  if (success) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.success}>
            <div style={styles.successIcon}>
              <CheckCircle size={48} color="#10b981" />
            </div>
            <h2 style={styles.successTitle}>Vielen Dank!</h2>
            <p style={styles.successText}>
              Ihre Probetraining-Anfrage wurde erfolgreich übermittelt.<br /><br />
              Wir werden uns in Kürze bei Ihnen melden, um einen Termin zu vereinbaren.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          {dojoData.logo_url && (
            <img src={dojoData.logo_url} alt={dojoData.name} style={styles.logo} />
          )}
          <h1 style={styles.title}>Probetraining buchen</h1>
          <p style={styles.subtitle}>{dojoData.name}</p>
          {dojoData.kontakt?.adresse && (
            <p style={{ ...styles.subtitle, fontSize: '0.85rem', marginTop: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
              <MapPin size={14} /> {dojoData.kontakt.adresse}
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {error && (
            <div style={styles.error}>
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Name */}
          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Vorname *</label>
              <input
                type="text"
                required
                value={formData.vorname}
                onChange={e => setFormData({...formData, vorname: e.target.value})}
                style={styles.input}
                placeholder="Max"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Nachname *</label>
              <input
                type="text"
                required
                value={formData.nachname}
                onChange={e => setFormData({...formData, nachname: e.target.value})}
                style={styles.input}
                placeholder="Mustermann"
              />
            </div>
          </div>

          {/* Kontakt */}
          <div style={styles.formGroup}>
            <label style={styles.label}>E-Mail *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              style={styles.input}
              placeholder="max@beispiel.de"
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Telefon</label>
            <input
              type="tel"
              value={formData.telefon}
              onChange={e => setFormData({...formData, telefon: e.target.value})}
              style={styles.input}
              placeholder="+49 123 456789"
            />
          </div>

          {/* Stil-Auswahl */}
          {stile.length > 0 && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Welcher Stil interessiert Sie?</label>
              <select
                value={formData.stil_id}
                onChange={e => setFormData({...formData, stil_id: e.target.value, kurs_id: ''})}
                style={styles.select}
              >
                <option value="">Alle Stile anzeigen</option>
                {stile.map(s => (
                  <option key={s.stil_id} value={s.stil_id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Kurs-Auswahl */}
          {filteredKurse.length > 0 && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Wählen Sie einen Termin</label>
              <div style={styles.kursGrid}>
                {filteredKurse.map(kurs => (
                  <label
                    key={kurs.stundenplan_id || kurs.kurs_id}
                    style={{
                      ...styles.kursCard,
                      ...(formData.kurs_id == (kurs.stundenplan_id || kurs.kurs_id) ? styles.kursCardSelected : {})
                    }}
                  >
                    <input
                      type="radio"
                      name="kurs"
                      value={kurs.stundenplan_id || kurs.kurs_id}
                      checked={formData.kurs_id == (kurs.stundenplan_id || kurs.kurs_id)}
                      onChange={e => setFormData({...formData, kurs_id: e.target.value})}
                      style={styles.kursRadio}
                    />
                    <div style={styles.kursInfo}>
                      <div style={styles.kursName}>{kurs.name}</div>
                      <div style={styles.kursDetails}>
                        <Calendar size={14} />
                        {kurs.wochentag}
                        <Clock size={14} style={{ marginLeft: '0.5rem' }} />
                        {kurs.start_zeit?.substring(0, 5)} - {kurs.end_zeit?.substring(0, 5)}
                        {kurs.stil_name && (
                          <span style={{ marginLeft: '0.5rem', color: '#ffd700' }}>
                            {kurs.stil_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Wunschdatum */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Wunschdatum (optional)</label>
            <input
              type="date"
              value={formData.wunschdatum}
              onChange={e => setFormData({...formData, wunschdatum: e.target.value})}
              style={styles.input}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

          {/* Nachricht */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Nachricht (optional)</label>
            <textarea
              value={formData.nachricht}
              onChange={e => setFormData({...formData, nachricht: e.target.value})}
              style={styles.textarea}
              placeholder="Haben Sie Fragen oder besondere Wünsche?"
            />
          </div>

          {/* Wie gefunden */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Wie sind Sie auf uns aufmerksam geworden?</label>
            <select
              value={formData.wie_gefunden}
              onChange={e => setFormData({...formData, wie_gefunden: e.target.value})}
              style={styles.select}
            >
              <option value="">Bitte auswählen</option>
              <option value="Google">Google / Suchmaschine</option>
              <option value="Social Media">Social Media</option>
              <option value="Empfehlung">Empfehlung / Freunde</option>
              <option value="Flyer">Flyer / Plakat</option>
              <option value="Vorbeigelaufen">Vorbeigelaufen</option>
              <option value="Sonstiges">Sonstiges</option>
            </select>
          </div>

          {/* Datenschutz */}
          <div style={styles.checkbox}>
            <input
              type="checkbox"
              id="datenschutz"
              checked={formData.datenschutz_akzeptiert}
              onChange={e => setFormData({...formData, datenschutz_akzeptiert: e.target.checked})}
              style={styles.checkboxInput}
            />
            <label htmlFor="datenschutz" style={styles.checkboxLabel}>
              Ich habe die <a href="/datenschutz" target="_blank" style={{ color: '#ffd700' }}>Datenschutzerklärung</a> gelesen
              und bin mit der Verarbeitung meiner Daten einverstanden. *
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            style={{
              ...styles.button,
              ...(submitting ? styles.buttonDisabled : {})
            }}
          >
            {submitting ? (
              <>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                Wird gesendet...
              </>
            ) : (
              <>
                Probetraining anfragen
                <ChevronRight size={20} />
              </>
            )}
          </button>
        </form>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input::placeholder, textarea::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        select option {
          background: #1a1a2e;
          color: #ffffff;
        }
      `}</style>
    </div>
  );
};

export default ProbetrainingBuchung;
