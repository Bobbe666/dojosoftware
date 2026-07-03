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
import '../styles/ProbetrainingBuchung.css';

const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const naechsteTermine = (tagName, anzahl = 4) => {
  const idx = WOCHENTAGE.indexOf(tagName);
  if (idx < 0) return [];
  const res = [];
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1);
  for (let i = 0; i < 70 && res.length < anzahl; i++) {
    if (d.getDay() === idx) res.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return res;
};
const fmtChip = (d) => new Date(d + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });

const ProbetrainingBuchung = () => {
  const [searchParams] = useSearchParams();

  // Subdomain aus URL oder window.location ermitteln
  const getSubdomain = () => {
    // Erst aus URL-Parameter versuchen (z.B. ?dojo=kampfkunst-schreiner)
    const paramSubdomain = searchParams.get('dojo');
    if (paramSubdomain) return paramSubdomain;

    // Dann aus Hostname: z.B. kampfkunst.dojo.tda-intl.org -> kampfkunst
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length >= 4 && parts[1] === 'dojo') {
      return parts[0];
    }
    return null;
  };

  const subdomain = getSubdomain();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [bookedInfo, setBookedInfo] = useState(null);
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
    if (!subdomain) {
      setLoading(false);
      setError('Kein Dojo gefunden. Bitte rufen Sie diese Seite über die Adresse Ihres Dojos auf (z.B. mein-dojo.dojo.tda-intl.org/probetraining).');
      return;
    }

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

      setBookedInfo({ gebucht: result.gebucht, ...(result.data || {}) });
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

  // Aktuell gewählter Slot + dessen nächste konkrete Termine
  const selectedKurs = filteredKurse.find(k => String(k.stundenplan_id || k.kurs_id) === String(formData.kurs_id));
  const slotTermine = selectedKurs ? naechsteTermine(selectedKurs.wochentag) : [];

  // Dojo-Theme: Akzentfarbe des Dojos auf die Seite ziehen
  const themeStyle = dojoData?.farbe
    ? { '--primary': dojoData.farbe, '--ds-accent': dojoData.farbe, '--ds-accent-strong': dojoData.farbe }
    : undefined;

  // Loading State
  if (loading) {
    return (
      <div className="ptb-container" style={themeStyle}>
        <div className="ptb-card">
          <div className="ptb-loading">
            <Loader2 size={48} className="ptb-loading-icon" />
            <p className="ptb-loading-text">Lade Dojo-Daten...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error State (Dojo nicht gefunden)
  if (!dojoData) {
    return (
      <div className="ptb-container" style={themeStyle}>
        <div className="ptb-card">
          <div className="ptb-loading ptb-loading-error">
            <AlertCircle size={48} />
            <p className="ptb-loading-text">{error || 'Dojo nicht gefunden'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Success State
  if (success) {
    return (
      <div className="ptb-container" style={themeStyle}>
        <div className="ptb-card">
          <div className="ptb-success">
            <div className="ptb-success-icon">
              <CheckCircle size={48} color="#10b981" />
            </div>
            {bookedInfo?.gebucht ? (
              <>
                <h2 className="ptb-success-title">Dein Termin ist gebucht! 🥋</h2>
                <div style={{ background: 'color-mix(in srgb, var(--primary, #e11d2a) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--primary, #e11d2a) 35%, transparent)', borderRadius: '12px', padding: '16px', margin: '8px 0 16px' }}>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary, #ff5a5a)' }}>
                    {new Date(bookedInfo.datum + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  <div style={{ opacity: 0.9, marginTop: '4px' }}>{bookedInfo.uhrzeit} Uhr · {bookedInfo.kurs}</div>
                  {bookedInfo.trainer && <div style={{ opacity: 0.7, fontSize: '0.9rem', marginTop: '4px' }}>Trainer: {bookedInfo.trainer}</div>}
                </div>
                <p className="ptb-success-text">Du bekommst gleich eine Bestätigung per E-Mail. Wir freuen uns auf dich!</p>
              </>
            ) : (
              <>
                <h2 className="ptb-success-title">Vielen Dank!</h2>
                <p className="ptb-success-text">
                  Ihre Probetraining-Anfrage wurde erfolgreich übermittelt.<br /><br />
                  Wir werden uns in Kürze bei Ihnen melden, um einen Termin zu vereinbaren.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ptb-container" style={themeStyle}>
      <div className="ptb-card">
        {/* Header */}
        <div className="ptb-header">
          {dojoData.logo_url && (
            <img src={dojoData.logo_url} alt={dojoData.name} className="ptb-logo" />
          )}
          <h1 className="ptb-title">Probetraining buchen</h1>
          <p className="ptb-subtitle">{dojoData.name}</p>
          {dojoData.kontakt?.adresse && (
            <p className="ptb-subtitle ptb-address">
              <MapPin size={14} /> {dojoData.kontakt.adresse}
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="ptb-form">
          {error && (
            <div className="ptb-error">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          {/* Name */}
          <div className="ptb-row">
            <div className="ptb-form-group">
              <label className="ptb-label">Vorname *</label>
              <input
                type="text"
                required
                value={formData.vorname}
                onChange={e => setFormData({...formData, vorname: e.target.value})}
                className="ptb-input"
                placeholder="Max"
              />
            </div>
            <div className="ptb-form-group">
              <label className="ptb-label">Nachname *</label>
              <input
                type="text"
                required
                value={formData.nachname}
                onChange={e => setFormData({...formData, nachname: e.target.value})}
                className="ptb-input"
                placeholder="Mustermann"
              />
            </div>
          </div>

          {/* Kontakt */}
          <div className="ptb-form-group">
            <label className="ptb-label">E-Mail *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              className="ptb-input"
              placeholder="max@beispiel.de"
            />
          </div>

          <div className="ptb-form-group">
            <label className="ptb-label">Telefon</label>
            <input
              type="tel"
              value={formData.telefon}
              onChange={e => setFormData({...formData, telefon: e.target.value})}
              className="ptb-input"
              placeholder="+49 123 456789"
            />
          </div>

          {/* Stil-Auswahl */}
          {stile.length > 0 && (
            <div className="ptb-form-group">
              <label className="ptb-label">Welcher Stil interessiert Sie?</label>
              <select
                value={formData.stil_id}
                onChange={e => setFormData({...formData, stil_id: e.target.value, kurs_id: ''})}
                className="ptb-select"
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
            <div className="ptb-form-group">
              <label className="ptb-label">Wählen Sie einen Termin</label>
              <div className="ptb-kurs-grid">
                {filteredKurse.map(kurs => (
                  <label
                    key={kurs.stundenplan_id || kurs.kurs_id}
                    className={`ptb-kurs-card${formData.kurs_id == (kurs.stundenplan_id || kurs.kurs_id) ? ' ptb-kurs-card--selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="kurs"
                      value={kurs.stundenplan_id || kurs.kurs_id}
                      checked={formData.kurs_id == (kurs.stundenplan_id || kurs.kurs_id)}
                      onChange={e => setFormData({...formData, kurs_id: e.target.value})}
                      className="ptb-kurs-radio"
                    />
                    <div className="ptb-kurs-info">
                      <div className="ptb-kurs-name">{kurs.name}</div>
                      <div className="ptb-kurs-details">
                        <Calendar size={14} />
                        {kurs.wochentag}
                        <Clock size={14} className="ptb-kurs-clock" />
                        {kurs.start_zeit?.substring(0, 5)} - {kurs.end_zeit?.substring(0, 5)}
                        {kurs.stil_name && (
                          <span className="ptb-kurs-stil">
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

          {/* Konkrete Termin-Auswahl für den gewählten Slot → direkte Buchung */}
          {selectedKurs && slotTermine.length > 0 && (
            <div className="ptb-form-group">
              <label className="ptb-label">Wähle deinen Termin</label>
              <div className="ptb-date-chips">
                {slotTermine.map(d => (
                  <button
                    type="button"
                    key={d}
                    className={`ptb-date-chip${formData.wunschdatum === d ? ' selected' : ''}`}
                    onClick={() => setFormData({ ...formData, wunschdatum: formData.wunschdatum === d ? '' : d })}
                  >
                    {fmtChip(d)}
                  </button>
                ))}
              </div>
              <p className="ptb-date-hint">
                {formData.wunschdatum
                  ? '✅ Mit „Verbindlich buchen" ist dein Termin sofort fix.'
                  : 'Termin wählen = sofort verbindlich buchen. Ohne Auswahl melden wir uns bei dir.'}
              </p>
            </div>
          )}

          {/* Nachricht */}
          <div className="ptb-form-group">
            <label className="ptb-label">Nachricht (optional)</label>
            <textarea
              value={formData.nachricht}
              onChange={e => setFormData({...formData, nachricht: e.target.value})}
              className="ptb-textarea"
              placeholder="Haben Sie Fragen oder besondere Wünsche?"
            />
          </div>

          {/* Wie gefunden */}
          <div className="ptb-form-group">
            <label className="ptb-label">Wie sind Sie auf uns aufmerksam geworden?</label>
            <select
              value={formData.wie_gefunden}
              onChange={e => setFormData({...formData, wie_gefunden: e.target.value})}
              className="ptb-select"
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
          <div className="ptb-checkbox">
            <input
              type="checkbox"
              id="datenschutz"
              checked={formData.datenschutz_akzeptiert}
              onChange={e => setFormData({...formData, datenschutz_akzeptiert: e.target.checked})}
              className="ptb-checkbox-input"
            />
            <label htmlFor="datenschutz" className="ptb-checkbox-label">
              Ich habe die <a href="/datenschutz" target="_blank" className="u-text-accent">Datenschutzerklärung</a> gelesen
              und bin mit der Verarbeitung meiner Daten einverstanden. *
            </label>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="ptb-button"
          >
            {submitting ? (
              <>
                <Loader2 size={20} className="ptb-spinner-inline" />
                Wird gesendet...
              </>
            ) : (
              <>
                {formData.wunschdatum && selectedKurs ? 'Termin verbindlich buchen' : 'Probetraining anfragen'}
                <ChevronRight size={20} />
              </>
            )}
          </button>
        </form>
      </div>

      {/* CSS Animation for select options */}
      <style>{`
        input::placeholder, textarea::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }
        select option {
          background: #1a1a2e;
          color: #ffffff;
        }
        .ptb-date-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .ptb-date-chip {
          background: rgba(255,255,255,0.08); border: 1.5px solid transparent; color: #fff;
          padding: 9px 14px; border-radius: 10px; font-size: 0.9rem; font-weight: 600; cursor: pointer;
        }
        .ptb-date-chip:hover { background: rgba(255,255,255,0.14); }
        .ptb-date-chip.selected { background: #e11d2a; border-color: #ff5a5a; }
        .ptb-date-hint { font-size: 0.8rem; opacity: 0.7; margin: 8px 0 0; }
      `}</style>
    </div>
  );
};

export default ProbetrainingBuchung;
