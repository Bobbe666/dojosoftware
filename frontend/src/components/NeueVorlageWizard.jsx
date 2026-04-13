/**
 * NeueVorlageWizard.jsx
 * ======================
 * Mehrstufiger Assistent zum Erstellen einer neuen Vorlage.
 * Schritt 1: Grunddaten  → Name, Kategorie, Typ
 * Schritt 2: Absender    → Absender-Profil auswählen
 * Schritt 3: Empfänger   → Zielgruppe, Betreff / Brief-Titel
 * Schritt 4: Abschluss   → Zusammenfassung + Erstellen
 */

import React, { useState } from 'react';
import axios from 'axios';
import {
  X, Check, ChevronLeft, ChevronRight,
  FileText, Mail, Layers, User, Building2,
} from 'lucide-react';
import '../styles/NeueVorlageWizard.css';

// ── Statische Daten ────────────────────────────────────────────────────────────
const SCHRITTE = [
  { nr: 1, titel: 'Grunddaten',  sub: 'Name, Kategorie & Typ' },
  { nr: 2, titel: 'Absender',    sub: 'Von wem kommt die Vorlage?' },
  { nr: 3, titel: 'Empfänger',   sub: 'An wen richtet sie sich?' },
  { nr: 4, titel: 'Abschluss',   sub: 'Zusammenfassung' },
];

const KATEGORIEN_GRUPPEN = [
  { gruppe: 'Mitgliedschaft', items: [
    { value: 'begruessung',            label: 'Begrüßungsschreiben' },
    { value: 'geburtstag',             label: 'Geburtstagsgratulation' },
    { value: 'kuendigung_bestaetigung',label: 'Kündigung Bestätigung' },
    { value: 'ruhezeit',               label: 'Ruhezeit Bestätigung' },
    { value: 'vertrag_verlaengerung',  label: 'Vertragsverlängerung' },
    { value: 'vertrag_bestaetigung',   label: 'Vertragsbestätigung' },
    { value: 'kursanmeldung',          label: 'Kursanmeldung' },
    { value: 'info_brief',             label: 'Allgemeiner Infobrief' },
    { value: 'rundschreiben',          label: 'Rundschreiben' },
  ]},
  { gruppe: 'Finanzen', items: [
    { value: 'rechnung',              label: 'Rechnung' },
    { value: 'zahlungserinnerung',    label: 'Zahlungserinnerung' },
    { value: 'mahnung',               label: 'Mahnung' },
    { value: 'mahnbescheid',          label: 'Mahnbescheid' },
    { value: 'ruecklastschrift_info', label: 'Rücklastschrift-Info' },
  ]},
  { gruppe: 'Prüfungen', items: [
    { value: 'pruefung_einladung', label: 'Prüfungs-Einladung' },
    { value: 'pruefung_ergebnis',  label: 'Prüfungsergebnis' },
    { value: 'guertelvergabe',     label: 'Gürtelvergabe' },
  ]},
  { gruppe: 'Lizenzen & Verband', items: [
    { value: 'lizenz_ausstellung',   label: 'Lizenz Ausstellung' },
    { value: 'lizenz_verlaengerung', label: 'Lizenz Verlängerung' },
    { value: 'verband_info',         label: 'Verband Info' },
  ]},
  { gruppe: 'Personal', items: [
    { value: 'trainer_vereinbarung', label: 'Trainervereinbarung' },
    { value: 'trainer_infoblatt',    label: 'Trainer-Infoblatt' },
  ]},
  { gruppe: 'Sonstiges', items: [
    { value: 'sonstiges', label: 'Sonstiges' },
  ]},
];

const ALLE_KAT = KATEGORIEN_GRUPPEN.flatMap(g => g.items);
function katLabel(v) { return ALLE_KAT.find(k => k.value === v)?.label || v; }

const EMPFAENGER_OPTIONEN = [
  { value: 'alle',      emoji: '👥', label: 'Alle Mitglieder' },
  { value: 'neue',      emoji: '🌟', label: 'Neue Mitglieder' },
  { value: 'trainer',   emoji: '🥋', label: 'Trainer' },
  { value: 'eltern',    emoji: '👨‍👧', label: 'Eltern / Erziehungsberechtigte' },
  { value: 'sonstiges', emoji: '✏️', label: 'Sonstiges / Manuell' },
];

// ── Hilfskomponente: Zusammenfassungszeile ─────────────────────────────────────
function SummaryRow({ label, value }) {
  return (
    <div className="nvw-summary-row">
      <span className="nvw-summary-label">{label}</span>
      <span className="nvw-summary-value">{value || '—'}</span>
    </div>
  );
}

// ── Haupt-Komponente ───────────────────────────────────────────────────────────
export default function NeueVorlageWizard({ profile = [], withDojo, onClose, onCreated }) {
  const [schritt, setSchritt]   = useState(1);
  const [saving,  setSaving]    = useState(false);
  const [fehler,  setFehler]    = useState('');

  // Schritt 1 — Grunddaten
  const [name,      setName]      = useState('');
  const [kategorie, setKategorie] = useState('sonstiges');
  const [typ,       setTyp]       = useState('beides'); // 'brief' | 'email' | 'beides'

  // Schritt 2 — Absender
  const [absenderProfilId, setAbsenderProfilId] = useState('');

  // Schritt 3 — Empfänger & Betreff
  const [empfaenger,   setEmpfaenger]   = useState('alle');
  const [briefTitel,   setBriefTitel]   = useState('');
  const [emailBetreff, setEmailBetreff] = useState('');

  // ── Navigation ────────────────────────────────────────────────────────────────
  function weiter() {
    setFehler('');
    if (schritt === 1 && !name.trim()) {
      setFehler('Bitte einen Vorlagennamen eingeben.');
      return;
    }
    if (schritt < 4) setSchritt(s => s + 1);
  }

  function zurueck() {
    setFehler('');
    if (schritt > 1) setSchritt(s => s - 1);
  }

  // ── Vorlage erstellen ─────────────────────────────────────────────────────────
  async function erstellen() {
    setSaving(true);
    setFehler('');
    try {
      const payload = {
        name: name.trim(),
        kategorie,
        ...(absenderProfilId && { absender_profil_id: parseInt(absenderProfilId, 10) }),
        ...(briefTitel.trim()   && { brief_titel:   briefTitel.trim()   }),
        ...(emailBetreff.trim() && { email_betreff: emailBetreff.trim() }),
      };
      const res = await axios.post(withDojo('/vorlagen'), payload);
      onCreated({
        id: res.data.id,
        name: payload.name,
        kategorie,
        absender_profil_id: payload.absender_profil_id || null,
        brief_titel:   payload.brief_titel   || '',
        email_betreff: payload.email_betreff || '',
        system_vorlage: 0,
      });
    } catch (err) {
      setFehler(err.response?.data?.error || 'Fehler beim Erstellen der Vorlage');
    } finally {
      setSaving(false);
    }
  }

  const selectedProfile = profile.find(p => p.id === parseInt(absenderProfilId, 10));

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="nvw-overlay" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="nvw-modal">

        {/* Header */}
        <div className="nvw-header">
          <div>
            <div className="nvw-header-title">Neue Vorlage erstellen</div>
            <div className="nvw-header-sub">{SCHRITTE[schritt - 1].sub}</div>
          </div>
          <button className="nvw-close-btn" onClick={onClose} title="Abbrechen">
            <X size={18} />
          </button>
        </div>

        {/* Schritt-Indikatoren */}
        <div className="nvw-steps">
          {SCHRITTE.map((s, i) => (
            <React.Fragment key={s.nr}>
              <div className={`nvw-step${schritt === s.nr ? ' nvw-step--active' : ''}${schritt > s.nr ? ' nvw-step--done' : ''}`}>
                <div className="nvw-step-circle">
                  {schritt > s.nr ? <Check size={12} /> : s.nr}
                </div>
                <div className="nvw-step-label">{s.titel}</div>
              </div>
              {i < SCHRITTE.length - 1 && (
                <div className={`nvw-step-line${schritt > s.nr ? ' nvw-step-line--done' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Schritt-Inhalt */}
        <div className="nvw-body">

          {/* ── Schritt 1: Grunddaten ── */}
          {schritt === 1 && (
            <div className="nvw-section">
              <div className="nvw-field">
                <label className="nvw-label">Vorlagenname <span className="nvw-required">*</span></label>
                <input
                  className="nvw-input"
                  placeholder="z. B. Begrüßungsbrief Neue Mitglieder"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && weiter()}
                  autoFocus
                />
              </div>

              <div className="nvw-field">
                <label className="nvw-label">Kategorie</label>
                <select className="nvw-input" value={kategorie} onChange={e => setKategorie(e.target.value)}>
                  {KATEGORIEN_GRUPPEN.map(({ gruppe, items }) => (
                    <optgroup key={gruppe} label={gruppe}>
                      {items.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="nvw-field">
                <label className="nvw-label">Vorlagentyp</label>
                <div className="nvw-typ-row">
                  {[
                    { value: 'brief',  icon: <FileText size={20} />, label: 'Brief / PDF',    sub: 'Als gedrucktes Dokument' },
                    { value: 'email',  icon: <Mail     size={20} />, label: 'E-Mail',         sub: 'Direkt versenden' },
                    { value: 'beides', icon: <Layers   size={20} />, label: 'Brief & E-Mail', sub: 'Beide Kanäle' },
                  ].map(t => (
                    <button
                      key={t.value}
                      type="button"
                      className={`nvw-typ-card${typ === t.value ? ' nvw-typ-card--active' : ''}`}
                      onClick={() => setTyp(t.value)}
                    >
                      <div className="nvw-typ-icon">{t.icon}</div>
                      <div className="nvw-typ-label">{t.label}</div>
                      <div className="nvw-typ-sub">{t.sub}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Schritt 2: Absender ── */}
          {schritt === 2 && (
            <div className="nvw-section">
              <p className="nvw-hint">
                Das Absender-Profil legt Briefkopf, Logo, Signatur und Kontaktdaten fest.
                Sie können es jetzt wählen oder später im Editor ergänzen.
              </p>
              <div className="nvw-profile-list">
                {/* Ohne Profil */}
                <label className={`nvw-profile-card${absenderProfilId === '' ? ' nvw-profile-card--active' : ''}`}>
                  <input
                    type="radio" name="profil" value=""
                    checked={absenderProfilId === ''}
                    onChange={() => setAbsenderProfilId('')}
                  />
                  <div className="nvw-profile-icon nvw-profile-icon--none">
                    <User size={20} />
                  </div>
                  <div className="nvw-profile-info">
                    <div className="nvw-profile-name">Ohne Profil</div>
                    <div className="nvw-profile-sub">Später im Editor festlegen</div>
                  </div>
                </label>

                {/* Vorhandene Profile */}
                {profile.map(p => (
                  <label
                    key={p.id}
                    className={`nvw-profile-card${absenderProfilId === String(p.id) ? ' nvw-profile-card--active' : ''}`}
                  >
                    <input
                      type="radio" name="profil" value={p.id}
                      checked={absenderProfilId === String(p.id)}
                      onChange={() => setAbsenderProfilId(String(p.id))}
                    />
                    <div className="nvw-profile-icon">
                      {p.logo_url
                        ? <img src={p.logo_url} alt={p.name} className="nvw-profile-logo" />
                        : <Building2 size={20} />
                      }
                    </div>
                    <div className="nvw-profile-info">
                      <div className="nvw-profile-name">{p.name}</div>
                      <div className="nvw-profile-sub">{p.absender_email || p.absender_name || ''}</div>
                    </div>
                  </label>
                ))}

                {profile.length === 0 && (
                  <div className="nvw-empty-hint">
                    Noch keine Absender-Profile angelegt — diese lassen sich unter
                    Dokumente → Einstellungen einrichten.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Schritt 3: Empfänger ── */}
          {schritt === 3 && (
            <div className="nvw-section">
              <div className="nvw-field">
                <label className="nvw-label">An wen richtet sich die Vorlage?</label>
                <div className="nvw-empf-grid">
                  {EMPFAENGER_OPTIONEN.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`nvw-empf-btn${empfaenger === opt.value ? ' nvw-empf-btn--active' : ''}`}
                      onClick={() => setEmpfaenger(opt.value)}
                    >
                      <span className="nvw-empf-emoji">{opt.emoji}</span>
                      <span className="nvw-empf-label">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {(typ === 'brief' || typ === 'beides') && (
                <div className="nvw-field">
                  <label className="nvw-label">Brief-Titel / Betreffzeile (optional)</label>
                  <input
                    className="nvw-input"
                    placeholder="z. B. Herzlich willkommen bei uns!"
                    value={briefTitel}
                    onChange={e => setBriefTitel(e.target.value)}
                  />
                </div>
              )}

              {(typ === 'email' || typ === 'beides') && (
                <div className="nvw-field">
                  <label className="nvw-label">E-Mail-Betreff (optional)</label>
                  <input
                    className="nvw-input"
                    placeholder="z. B. Willkommen bei {{dojo_name}}!"
                    value={emailBetreff}
                    onChange={e => setEmailBetreff(e.target.value)}
                  />
                  <div className="nvw-input-hint">
                    Platzhalter: {'{{vorname}}'}, {'{{nachname}}'}, {'{{dojo_name}}'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Schritt 4: Zusammenfassung ── */}
          {schritt === 4 && (
            <div className="nvw-section">
              <p className="nvw-hint">
                Alles sieht gut aus! Überprüfen Sie die Angaben und klicken Sie auf
                „Vorlage erstellen". Danach öffnet sich direkt der Editor, wo Sie Inhalt,
                Fußzeile und Layout vollständig gestalten können.
              </p>

              <div className="nvw-summary">
                <SummaryRow label="Name"       value={name} />
                <SummaryRow label="Kategorie"  value={katLabel(kategorie)} />
                <SummaryRow label="Typ"        value={{ brief: 'Brief / PDF', email: 'E-Mail', beides: 'Brief & E-Mail' }[typ]} />
                <SummaryRow label="Absender"   value={selectedProfile ? selectedProfile.name : 'Später festlegen'} />
                <SummaryRow
                  label="Empfänger"
                  value={EMPFAENGER_OPTIONEN.find(e => e.value === empfaenger)?.label}
                />
                {briefTitel   && <SummaryRow label="Brief-Titel"   value={briefTitel} />}
                {emailBetreff && <SummaryRow label="E-Mail-Betreff" value={emailBetreff} />}
              </div>

              <div className="nvw-summary-note">
                Im nächsten Schritt können Sie Inhalt, Fußzeile, Variablen und das
                visuelle Layout im vollständigen Editor bearbeiten.
              </div>
            </div>
          )}

          {fehler && <div className="nvw-error">{fehler}</div>}
        </div>

        {/* Footer-Navigation */}
        <div className="nvw-footer">
          <button
            className="nvw-btn nvw-btn--ghost"
            onClick={schritt === 1 ? onClose : zurueck}
          >
            {schritt === 1 ? 'Abbrechen' : <><ChevronLeft size={15} /> Zurück</>}
          </button>

          <div className="nvw-footer-progress">
            {SCHRITTE.map(s => (
              <div
                key={s.nr}
                className={`nvw-dot${schritt === s.nr ? ' nvw-dot--active' : ''}${schritt > s.nr ? ' nvw-dot--done' : ''}`}
              />
            ))}
          </div>

          {schritt < 4 ? (
            <button className="nvw-btn nvw-btn--primary" onClick={weiter}>
              Weiter <ChevronRight size={15} />
            </button>
          ) : (
            <button className="nvw-btn nvw-btn--primary" onClick={erstellen} disabled={saving}>
              <Check size={15} /> {saving ? 'Wird erstellt…' : 'Vorlage erstellen'}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
