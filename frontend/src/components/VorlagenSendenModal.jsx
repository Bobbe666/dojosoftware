/**
 * VorlagenSendenModal.jsx
 * ========================
 * Dialog zum Senden einer Vorlage an ein Mitglied.
 * Features: Mitglied-Suche, Kontext-Felder, Versandart (Email/PDF/Beides), Live-Vorschau.
 */

import '../styles/VorlagenSendenModal.css';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { X, Search, Send, Download, Mail, FileText, Eye, CheckCircle, Calendar } from 'lucide-react';

// ── Kontext-Felder je Kategorie ────────────────────────────────────────────────
const KONTEXT_FELDER = {
  kuendigung_bestaetigung: [
    { key: 'kuendigungsdatum', label: 'Kündigungsdatum', type: 'date' },
  ],
  ruhezeit: [
    { key: 'ruhezeitbeginn', label: 'Ruhezeit Beginn', type: 'date' },
    { key: 'ruhezeitende', label: 'Ruhezeit Ende', type: 'date' },
  ],
  zahlungserinnerung: [
    { key: 'betrag', label: 'Betrag (€)', type: 'text', placeholder: 'z.B. 45,00 €' },
    { key: 'faelligkeitsdatum', label: 'Fälligkeitsdatum', type: 'date' },
  ],
  mahnung: [
    { key: 'betrag', label: 'Betrag (€)', type: 'text', placeholder: 'z.B. 45,00 €' },
    { key: 'faelligkeitsdatum', label: 'Fälligkeitsdatum', type: 'date' },
  ],
  mahnbescheid: [
    { key: 'betrag', label: 'Betrag (€)', type: 'text', placeholder: 'z.B. 45,00 €' },
  ],
  ruecklastschrift_info: [
    { key: 'betrag', label: 'Betrag (€)', type: 'text', placeholder: 'z.B. 45,00 €' },
  ],
  pruefung_einladung: [
    { key: 'kurs_name', label: 'Prüfungs-/Kursname', type: 'text', placeholder: 'z.B. Gürtelprüfung 2. Kyu' },
  ],
  pruefung_ergebnis: [
    { key: 'kurs_name', label: 'Prüfungsname', type: 'text' },
    { key: 'guertelstufe', label: 'Gürtelstufe', type: 'text', placeholder: 'z.B. 2. Kyu / Blaugurt' },
  ],
  guertelvergabe: [
    { key: 'guertelstufe', label: 'Gürtelstufe', type: 'text', placeholder: 'z.B. 3. Kyu / Blaugurt' },
  ],
  lizenz_ausstellung: [
    { key: 'lizenz_nummer', label: 'Lizenz-Nummer', type: 'text' },
    { key: 'lizenz_ablauf', label: 'Gültig bis', type: 'date' },
  ],
  lizenz_verlaengerung: [
    { key: 'lizenz_nummer', label: 'Lizenz-Nummer', type: 'text' },
    { key: 'lizenz_ablauf', label: 'Neues Ablaufdatum', type: 'date' },
  ],
  kursanmeldung: [
    { key: 'kurs_name', label: 'Kursname', type: 'text' },
  ],
};

const KATEGORIE_LABEL = {
  begruessung: 'Begrüßung', geburtstag: 'Geburtstag',
  kuendigung_bestaetigung: 'Kündigung', ruhezeit: 'Ruhezeit',
  zahlungserinnerung: 'Zahlungserinnerung', mahnung: 'Mahnung',
  mahnbescheid: 'Mahnbescheid', ruecklastschrift_info: 'Rücklastschrift',
  kursanmeldung: 'Kursanmeldung', pruefung_einladung: 'Prüfungs-Einladung',
  pruefung_ergebnis: 'Prüfungsergebnis', guertelvergabe: 'Gürtelvergabe',
  lizenz_ausstellung: 'Lizenz Ausstellung', lizenz_verlaengerung: 'Lizenz Verlängerung',
  verband_info: 'Verband Info', info_brief: 'Infobrief',
  rundschreiben: 'Rundschreiben', sonstiges: 'Sonstiges',
};

export default function VorlagenSendenModal({ vorlagenId: initialVorlagenId = null, mitgliedId = null, onClose }) {
  const [alleVorlagen, setAlleVorlagen] = useState([]);
  const [gewaehltesVorlagenId, setGewaehltesVorlagenId] = useState(initialVorlagenId);
  const [vorlage, setVorlage] = useState(null);
  const [mitglied, setMitglied] = useState(null);
  const [suche, setSuche] = useState('');
  const [suchergebnisse, setSuchergebnisse] = useState([]);
  const [sucheOffen, setSucheOffen] = useState(false);
  const [zusatzDaten, setZusatzDaten] = useState({});
  const [versandArt, setVersandArt] = useState('email');
  const [vorschauHtml, setVorschauHtml] = useState('');
  const [vorschauLaed, setVorschauLaed] = useState(false);
  const [sending, setSending] = useState(false);
  const [erfolg, setErfolg] = useState(false);
  const [erfolgMsg, setErfolgMsg] = useState('');
  const [error, setError] = useState('');
  const [zeitgesteuert, setZeitgesteuert] = useState(false);
  const [geplantFuer, setGeplantFuer] = useState('');
  const sucheRef = useRef(null);
  const vorschauTimer = useRef(null);

  // Alle Vorlagen laden (für Auswahl)
  useEffect(() => {
    axios.get('/vorlagen').then(res => {
      const list = res.data.vorlagen || [];
      setAlleVorlagen(list);
      if (gewaehltesVorlagenId) {
        setVorlage(list.find(x => x.id === gewaehltesVorlagenId) || null);
      }
    }).catch(() => {});
  }, []);

  // Wenn Vorlage gewählt wird
  useEffect(() => {
    if (gewaehltesVorlagenId && alleVorlagen.length > 0) {
      setVorlage(alleVorlagen.find(x => x.id === gewaehltesVorlagenId) || null);
      setVorschauHtml('');
      setZusatzDaten({});
    }
  }, [gewaehltesVorlagenId, alleVorlagen]);

  // Mitglied vorausfüllen wenn übergeben
  useEffect(() => {
    if (mitgliedId) {
      axios.get(`/mitglieder/${mitgliedId}`).then(res => {
        setMitglied(res.data.mitglied || res.data);
      }).catch(() => {});
    }
  }, [mitgliedId]);

  // Mitglieder-Suche
  useEffect(() => {
    if (suche.length < 2) { setSuchergebnisse([]); return; }
    const t = setTimeout(() => {
      axios.get(`/mitglieder?search=${encodeURIComponent(suche)}&limit=8`).then(res => {
        setSuchergebnisse(res.data.mitglieder || res.data || []);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [suche]);

  // Vorschau aktualisieren (debounced)
  const ladeVorschau = useCallback(() => {
    if (!gewaehltesVorlagenId || !mitglied) return;
    setVorschauLaed(true);
    const params = new URLSearchParams({ mitglied_id: mitglied.id, ...zusatzDaten });
    axios.get(`/vorlagen/${gewaehltesVorlagenId}/preview-html?${params.toString()}`)
      .then(res => setVorschauHtml(res.data))
      .catch(() => setVorschauHtml('<p style="color:#e74c3c">Vorschau nicht verfügbar</p>'))
      .finally(() => setVorschauLaed(false));
  }, [gewaehltesVorlagenId, mitglied, zusatzDaten]);

  useEffect(() => {
    clearTimeout(vorschauTimer.current);
    if (mitglied) {
      vorschauTimer.current = setTimeout(ladeVorschau, 600);
    }
    return () => clearTimeout(vorschauTimer.current);
  }, [ladeVorschau, mitglied]);

  async function handleSenden() {
    if (!mitglied) { setError('Bitte ein Mitglied auswählen'); return; }
    if (zeitgesteuert && !geplantFuer) { setError('Bitte Datum und Uhrzeit wählen'); return; }
    setSending(true);
    setError('');
    try {
      const res = await axios.post(`/vorlagen/${gewaehltesVorlagenId}/senden`, {
        mitglied_id: mitglied.id,
        zusatz_daten: zusatzDaten,
        versand_art: versandArt,
        geplant_fuer: zeitgesteuert ? geplantFuer : null,
      });
      setErfolgMsg(res.data?.message || null);
      setErfolg(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Senden');
    } finally {
      setSending(false);
    }
  }

  async function handlePdfHerunterladen() {
    if (!mitglied) { setError('Bitte ein Mitglied auswählen'); return; }
    try {
      const params = new URLSearchParams({ mitglied_id: mitglied.id, ...zusatzDaten });
      const res = await axios.get(`/vorlagen/${gewaehltesVorlagenId}/preview-pdf?${params.toString()}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${vorlage?.name || 'Vorlage'}_${mitglied.nachname}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('PDF konnte nicht erstellt werden');
    }
  }

  const primaryColor = '#8B0000';
  const kontextFelder = KONTEXT_FELDER[vorlage?.kategorie] || [];

  if (erfolg) {
    return (
      <div className="vsm-overlay">
        <div className="vsm-success-box">
          <CheckCircle size={48} color="#27ae60" className="vsm-success-icon" />
          <h3 className="vsm-success-title">{erfolgMsg ? 'Versand geplant!' : 'Erfolgreich gesendet!'}</h3>
          <p className="vsm-success-text">
            {erfolgMsg ? erfolgMsg :
             versandArt === 'pdf' ? 'Das PDF wurde erstellt.' :
             versandArt === 'email' ? `E-Mail wurde an ${mitglied?.email} gesendet.` :
             `E-Mail mit PDF-Anhang wurde an ${mitglied?.email} gesendet.`}
          </p>
          <button onClick={onClose} className="vsm-success-close-btn">Schließen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="vsm-main-overlay">
      <div className="vsm-modal-card">
        {/* Header */}
        <div className="vsm-header-bar">
          <div className="vsm-header-title">
            <Send size={18} /> Dokument senden — {vorlage?.name || '...'}
          </div>
          <button onClick={onClose} className="vsm-close-btn">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="vsm-error-bar">
            {error}
          </div>
        )}

        {/* Vorlage-Auswahl (wenn kein vorlagenId initial übergeben) */}
        {!initialVorlagenId && (
          <div className="vsm-versand-bar">
            <label className="vsm-versand-label">
              Vorlage:
            </label>
            <select
              value={gewaehltesVorlagenId || ''}
              onChange={e => setGewaehltesVorlagenId(e.target.value ? Number(e.target.value) : null)}
              className="vsm-versand-select"
            >
              <option value="">— Vorlage auswählen —</option>
              {alleVorlagen.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({KATEGORIE_LABEL[v.kategorie] || v.kategorie})</option>
              ))}
            </select>
          </div>
        )}

        <div className="vsm-body-grid">
          {/* Linke Spalte: Einstellungen */}
          <div className="vsm-sidebar">

            {/* Mitglied-Suche */}
            <div>
              <label className="vsm-label">Empfänger</label>
              {mitglied ? (
                <div className="vsm-empfaenger-box">
                  <div>
                    <div className="vsm-empfaenger-name">
                      {mitglied.vorname} {mitglied.nachname}
                    </div>
                    <div className="vsm-empfaenger-sub">
                      {mitglied.email} · Nr. {mitglied.mitgliedsnummer}
                    </div>
                  </div>
                  {!mitgliedId && (
                    <button onClick={() => { setMitglied(null); setVorschauHtml(''); }}
                      className="vsm-remove-btn">×</button>
                  )}
                </div>
              ) : (
                <div className="vsm-search-wrap" ref={sucheRef}>
                  <div className="vsm-search-wrap">
                    <Search size={14} className="vsm-search-icon" />
                    <input
                      value={suche} onChange={e => { setSuche(e.target.value); setSucheOffen(true); }}
                      onFocus={() => setSucheOffen(true)}
                      placeholder="Name oder Mitgliedsnummer..."
                      className="vsm-input vsm-input--pl-search"
                    />
                  </div>
                  {sucheOffen && suchergebnisse.length > 0 && (
                    <div className="vsm-search-dropdown">
                      {suchergebnisse.map(m => (
                        <button key={m.id} onClick={() => { setMitglied(m); setSuche(''); setSucheOffen(false); }}
                          className="vsm-search-result-btn">
                          {m.vorname} {m.nachname} <span className="vsm-member-nr">Nr. {m.mitgliedsnummer}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Kontext-Felder */}
            {kontextFelder.length > 0 && (
              <div>
                <label className="vsm-label">Weitere Informationen</label>
                <div className="vsm-options-col">
                  {kontextFelder.map(({ key, label, type, placeholder }) => (
                    <div key={key}>
                      <label className="vsm-field-label">{label}</label>
                      <input
                        type={type} value={zusatzDaten[key] || ''}
                        onChange={e => setZusatzDaten(d => ({ ...d, [key]: e.target.value }))}
                        placeholder={placeholder || ''}
                        className="vsm-input"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Versandart */}
            <div>
              <label className="vsm-label">Versandart</label>
              <div className="u-flex-col-sm">
                {[
                  { value: 'email', icon: <Mail size={14} />, label: 'Nur E-Mail senden' },
                  { value: 'email_mit_pdf', icon: <><Mail size={14} /><FileText size={14} /></>, label: 'E-Mail + PDF-Anhang' },
                  { value: 'pdf', icon: <Download size={14} />, label: 'Nur PDF herunterladen' },
                ].map(({ value, icon, label }) => (
                  <label key={value} className={`vsm-versand-opt-label${versandArt === value ? ' vsm-versand-opt-label--active' : ''}`}>
                    <input type="radio" value={value} checked={versandArt === value}
                      onChange={() => setVersandArt(value)} className="vsm-radio-hidden" />
                    <span className={`vsm-versand-opt-icon${versandArt === value ? ' vsm-versand-opt-icon--active' : ''}`}>{icon}</span>
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* Zeitgesteuert (Phase 6) */}
            {versandArt !== 'pdf' && (
              <div>
                <label className="vsm-zeitgesteuert-row">
                  <input
                    type="checkbox"
                    checked={zeitgesteuert}
                    onChange={e => setZeitgesteuert(e.target.checked)}
                    style={{ marginRight: '0.4rem' }}
                  />
                  <Calendar size={13} style={{ marginRight: '0.3rem', opacity: 0.7 }} />
                  Zeitgesteuert senden
                </label>
                {zeitgesteuert && (
                  <input
                    type="datetime-local"
                    value={geplantFuer}
                    onChange={e => setGeplantFuer(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="vsm-input vsm-input--mt"
                  />
                )}
              </div>
            )}

            {/* Senden-Button */}
            <div className="vsm-actions">
              {versandArt === 'pdf' ? (
                <button onClick={handlePdfHerunterladen} disabled={!mitglied || !gewaehltesVorlagenId}
                  className="vsm-action-btn">
                  <Download size={16} /> PDF herunterladen
                </button>
              ) : (
                <button onClick={handleSenden} disabled={sending || !mitglied || !gewaehltesVorlagenId}
                  className="vsm-action-btn">
                  {zeitgesteuert ? <Calendar size={16} /> : <Send size={16} />}
                  {sending ? 'Wird verarbeitet...' : zeitgesteuert ? 'Versand planen' : 'Jetzt senden'}
                </button>
              )}
              <button onClick={onClose} className="vsm-cancel-btn">Abbrechen</button>
            </div>
          </div>

          {/* Rechte Spalte: Vorschau */}
          <div className="vsm-preview-panel">
            <div className="vsm-preview-header">
              <Eye size={14} className="u-text-muted" />
              <span className="vsm-preview-label">
                Live-Vorschau
              </span>
              {vorschauLaed && <span className="vsm-preview-loading">Lädt...</span>}
            </div>
            <div className="vsm-preview-container">
              {!mitglied ? (
                <div className="vsm-preview-placeholder">
                  <div>
                    <Eye size={32} className="vsm-preview-eye-icon" />
                    <p>Mitglied auswählen,<br />um die Vorschau zu sehen.</p>
                  </div>
                </div>
              ) : (
                <iframe
                  srcDoc={vorschauHtml}
                  className="vsm-preview-iframe"
                  title="Vorschau"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: '0.8rem', fontWeight: 600,
  color: 'var(--text-secondary, #aaa)', marginBottom: '0.4rem',
  textTransform: 'uppercase', letterSpacing: '0.04em',
};

const inputStyle = {
  width: '100%', padding: '0.55rem 0.75rem', borderRadius: '6px',
  border: '1px solid var(--border, #333)', background: 'var(--bg-secondary, #141420)',
  color: 'var(--text-primary, #eee)', fontSize: '0.88rem', outline: 'none',
};

const cancelBtnStyle = {
  padding: '0.55rem 1.2rem', background: 'none',
  border: '1px solid var(--border, #444)', color: 'var(--text-secondary, #aaa)',
  borderRadius: '7px', cursor: 'pointer', fontSize: '0.9rem',
};
