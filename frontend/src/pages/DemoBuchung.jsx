/**
 * DEMO-TERMIN BUCHUNG — Öffentliche Seite
 * =========================================
 * Interessenten können hier einen Demo-Termin für die Dojosoftware buchen.
 * Kein Login erforderlich.
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './DemoBuchung.css';

const BUNDESLAENDER = [
  'Baden-Württemberg','Bayern','Berlin','Brandenburg','Bremen','Hamburg',
  'Hessen','Mecklenburg-Vorpommern','Niedersachsen','Nordrhein-Westfalen',
  'Rheinland-Pfalz','Saarland','Sachsen','Sachsen-Anhalt',
  'Schleswig-Holstein','Thüringen','Österreich','Schweiz','Andere'
];

const MITGLIEDER_OPTIONEN = [
  'bis 20', '20–50', '50–100', '100–200', 'über 200'
];

function fmtSlot(slot) {
  const d = new Date(slot.slot_start);
  const day = d.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return { day, time, dur: slot.duration_minutes };
}

export default function DemoBuchung() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1=Slot wählen, 2=Formular, 3=Bestätigung
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [form, setForm] = useState({
    vorname: '', nachname: '', email: '', telefon: '',
    vereinsname: '', bundesland: '', mitglieder_anzahl: '', nachricht: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [buchungsToken, setBuchungsToken] = useState('');

  useEffect(() => {
    axios.get('demo-termine/slots')
      .then(r => setSlots(r.data.slots || []))
      .catch(() => setLoadError('Termine konnten nicht geladen werden. Bitte versuche es später erneut.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      const r = await axios.post('demo-termine/buchung', {
        slot_id: selectedSlot.id,
        ...form
      });
      setBuchungsToken(r.data.buchungs_token);
      setStep(3);
    } catch (err) {
      setSubmitError(err.response?.data?.error || 'Ein Fehler ist aufgetreten. Bitte versuche es erneut.');
    } finally {
      setSubmitting(false);
    }
  };

  // Slots nach Wochen gruppieren
  const slotsByWeek = slots.reduce((acc, slot) => {
    const d  = new Date(slot.slot_start);
    const mo = new Date(d); mo.setDate(d.getDate() - d.getDay() + 1); // Montag der Woche
    const key = mo.toISOString().slice(0,10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(slot);
    return acc;
  }, {});

  return (
    <div className="db-page">
      {/* Header */}
      <div className="db-header">
        <div className="db-logo">
          <span className="db-logo-icon">🥋</span>
          <span className="db-logo-text">Dojosoftware</span>
        </div>
        <h1 className="db-headline">Demo-Termin buchen</h1>
        <p className="db-sub">
          Lerne die Software für deine Kampfkunstschule kennen — in einem persönlichen Demo-Gespräch.
          Komplett kostenlos, unverbindlich und auf deine Bedürfnisse zugeschnitten.
        </p>
      </div>

      {/* Progress */}
      {step < 3 && (
        <div className="db-progress">
          <div className={`db-progress-step ${step >= 1 ? 'active' : ''}`}>
            <div className="db-progress-dot">{step > 1 ? '✓' : '1'}</div>
            <span>Termin wählen</span>
          </div>
          <div className="db-progress-line" />
          <div className={`db-progress-step ${step >= 2 ? 'active' : ''}`}>
            <div className="db-progress-dot">{step > 2 ? '✓' : '2'}</div>
            <span>Deine Angaben</span>
          </div>
        </div>
      )}

      <div className="db-card">
        {/* ── SCHRITT 1: SLOT WÄHLEN ── */}
        {step === 1 && (
          <div>
            <h2 className="db-card-title">Verfügbare Termine</h2>

            {/* Auslastungs-Hinweis */}
            {!loading && slots.length > 0 && (
              <div className="db-demand-hint">
                <span className="db-demand-dot" />
                <span>Hohe Nachfrage — viele Termine bereits vergeben. Jetzt schnell einen freien Slot sichern!</span>
              </div>
            )}

            {loading && <div className="db-center db-muted">Lade verfügbare Termine...</div>}
            {loadError && <div className="db-alert db-alert-error">{loadError}</div>}
            {!loading && !loadError && slots.length === 0 && (
              <div className="db-empty">
                <p>Aktuell sind keine Termine verfügbar.</p>
                <p className="db-muted">Schreib uns gerne direkt unter <a href="mailto:info@tda-intl.org">info@tda-intl.org</a> und wir finden einen passenden Termin.</p>
              </div>
            )}
            {!loading && !loadError && Object.keys(slotsByWeek).map(weekKey => {
              const weekDate = new Date(weekKey);
              const weekLabel = weekDate.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' });
              return (
                <div key={weekKey} className="db-week-group">
                  <div className="db-week-label">Woche ab {weekLabel}</div>
                  <div className="db-slot-grid">
                    {slotsByWeek[weekKey].map(slot => {
                      const { day, time, dur } = fmtSlot(slot);
                      const isBelegt = slot.is_booked === 1 || slot.status === 'belegt';
                      const isSelected = selectedSlot?.id === slot.id;
                      if (isBelegt) {
                        return (
                          <div key={slot.id} className="db-slot-btn db-slot-belegt" aria-disabled="true">
                            <div className="db-slot-day">{day}</div>
                            <div className="db-slot-time">{time} Uhr</div>
                            <div className="db-slot-belegt-label">Belegt</div>
                          </div>
                        );
                      }
                      return (
                        <button
                          key={slot.id}
                          className={`db-slot-btn ${isSelected ? 'selected' : ''}`}
                          onClick={() => setSelectedSlot(slot)}
                        >
                          <div className="db-slot-day">{day}</div>
                          <div className="db-slot-time">{time} Uhr</div>
                          <div className="db-slot-dur">{dur} Minuten</div>
                          {isSelected && <div className="db-slot-check">✓</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {selectedSlot && (
              <div className="db-selected-bar">
                <span>Ausgewählt: <strong>{fmtSlot(selectedSlot).day}, {fmtSlot(selectedSlot).time} Uhr</strong></span>
                <button className="db-btn db-btn-primary" onClick={() => setStep(2)}>Weiter →</button>
              </div>
            )}
          </div>
        )}

        {/* ── SCHRITT 2: FORMULAR ── */}
        {step === 2 && selectedSlot && (
          <div>
            <button className="db-back" onClick={() => setStep(1)}>← Termin ändern</button>
            <div className="db-selected-info">
              Termin: <strong>{fmtSlot(selectedSlot).day}, {fmtSlot(selectedSlot).time} Uhr ({fmtSlot(selectedSlot).dur} Min)</strong>
            </div>

            <h2 className="db-card-title">Deine Angaben</h2>
            <form onSubmit={handleSubmit}>
              <div className="db-form-row">
                <div className="db-form-group">
                  <label>Vorname *</label>
                  <input type="text" value={form.vorname} onChange={e => setForm(f => ({ ...f, vorname: e.target.value }))} required placeholder="Max" />
                </div>
                <div className="db-form-group">
                  <label>Nachname *</label>
                  <input type="text" value={form.nachname} onChange={e => setForm(f => ({ ...f, nachname: e.target.value }))} required placeholder="Mustermann" />
                </div>
              </div>
              <div className="db-form-row">
                <div className="db-form-group">
                  <label>E-Mail *</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="max@beispiel.de" />
                </div>
                <div className="db-form-group">
                  <label>Telefon</label>
                  <input type="tel" value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} placeholder="+49 ..." />
                </div>
              </div>
              <div className="db-form-group">
                <label>Name deines Vereins / deiner Schule</label>
                <input type="text" value={form.vereinsname} onChange={e => setForm(f => ({ ...f, vereinsname: e.target.value }))} placeholder="z.B. Kampfkunst Schule Muster e.V." />
              </div>
              <div className="db-form-row">
                <div className="db-form-group">
                  <label>Bundesland / Region</label>
                  <select value={form.bundesland} onChange={e => setForm(f => ({ ...f, bundesland: e.target.value }))}>
                    <option value="">Bitte wählen...</option>
                    {BUNDESLAENDER.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="db-form-group">
                  <label>Mitglieder (ca.)</label>
                  <select value={form.mitglieder_anzahl} onChange={e => setForm(f => ({ ...f, mitglieder_anzahl: e.target.value }))}>
                    <option value="">Bitte wählen...</option>
                    {MITGLIEDER_OPTIONEN.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              <div className="db-form-group">
                <label>Was interessiert dich besonders?</label>
                <textarea
                  value={form.nachricht}
                  onChange={e => setForm(f => ({ ...f, nachricht: e.target.value }))}
                  rows={4}
                  placeholder="z.B. Mitgliederverwaltung, Beitragszahlungen, Kursbuchungen, App für Mitglieder..."
                />
              </div>

              {submitError && <div className="db-alert db-alert-error">{submitError}</div>}

              <div className="db-form-submit">
                <button type="submit" className="db-btn db-btn-primary db-btn-lg" disabled={submitting}>
                  {submitting ? 'Buche Termin...' : 'Termin verbindlich buchen'}
                </button>
                <p className="db-hint">Unverbindlich und kostenlos. Wir melden uns zur Bestätigung.</p>
              </div>
            </form>
          </div>
        )}

        {/* ── SCHRITT 3: BESTÄTIGUNG ── */}
        {step === 3 && (
          <div className="db-success">
            <div className="db-success-icon">🎉</div>
            <h2 className="db-success-title">Termin gebucht!</h2>
            <p className="db-success-text">
              Vielen Dank, <strong>{form.vorname}</strong>! Dein Demo-Termin wurde erfolgreich gebucht.
            </p>
            {selectedSlot && (
              <div className="db-success-detail">
                <div className="db-success-detail-row">
                  <span>Termin</span>
                  <strong>{fmtSlot(selectedSlot).day}, {fmtSlot(selectedSlot).time} Uhr</strong>
                </div>
                <div className="db-success-detail-row">
                  <span>Dauer</span>
                  <strong>ca. {fmtSlot(selectedSlot).dur} Minuten</strong>
                </div>
                <div className="db-success-detail-row">
                  <span>E-Mail</span>
                  <strong>{form.email}</strong>
                </div>
              </div>
            )}
            <p className="db-success-hint">
              Wir werden uns in Kürze bei dir melden, um den Termin zu bestätigen und dir alle weiteren Infos (Zoom-Link etc.) zukommen zu lassen.
            </p>
            <p className="db-muted" style={{ fontSize: '0.8rem' }}>Buchungs-Referenz: {buchungsToken.slice(0,12)}...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="db-footer">
        <a href="https://dojo.tda-intl.org">dojo.tda-intl.org</a>
        <span>·</span>
        <a href="/impressum">Impressum</a>
        <span>·</span>
        <a href="/datenschutz">Datenschutz</a>
      </div>
    </div>
  );
}
