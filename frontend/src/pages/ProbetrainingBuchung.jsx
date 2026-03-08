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

  // Loading State
  if (loading) {
    return (
      <div className="ptb-container">
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
      <div className="ptb-container">
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
      <div className="ptb-container">
        <div className="ptb-card">
          <div className="ptb-success">
            <div className="ptb-success-icon">
              <CheckCircle size={48} color="#10b981" />
            </div>
            <h2 className="ptb-success-title">Vielen Dank!</h2>
            <p className="ptb-success-text">
              Ihre Probetraining-Anfrage wurde erfolgreich übermittelt.<br /><br />
              Wir werden uns in Kürze bei Ihnen melden, um einen Termin zu vereinbaren.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ptb-container">
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

          {/* Wunschdatum */}
          <div className="ptb-form-group">
            <label className="ptb-label">Wunschdatum (optional)</label>
            <input
              type="date"
              value={formData.wunschdatum}
              onChange={e => setFormData({...formData, wunschdatum: e.target.value})}
              className="ptb-input"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>

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
                Probetraining anfragen
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
      `}</style>
    </div>
  );
};

export default ProbetrainingBuchung;
