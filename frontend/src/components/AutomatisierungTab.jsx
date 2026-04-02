/**
 * AutomatisierungTab.jsx
 * =======================
 * Phase 4: Automatische Trigger
 * Verwaltet vorlage_trigger — tägliche E-Mail-Automationen.
 */

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import { Plus, Trash2, ToggleLeft, ToggleRight, Zap, AlertCircle, RefreshCw } from 'lucide-react';
import '../styles/AutomatisierungTab.css';

const TRIGGER_LABELS = {
  geburtstag:               'Geburtstag (täglich)',
  mitglied_neu:             'Neues Mitglied (Eintrittsdatum)',
  zahlungsverzug_7:         'Zahlungsverzug 7 Tage',
  zahlungsverzug_14:        'Zahlungsverzug 14 Tage',
  zahlungsverzug_30:        'Zahlungsverzug 30 Tage',
  mitgliedschaft_ablauf_30: 'Mitgliedschaft läuft ab (30 Tage vorher)',
  lizenz_ablauf_30:         'Lizenz läuft ab (30 Tage vorher)',
};

const TRIGGER_ICONS = {
  geburtstag: '🎂',
  mitglied_neu: '👋',
  zahlungsverzug_7: '⚠️',
  zahlungsverzug_14: '⚠️',
  zahlungsverzug_30: '🚨',
  mitgliedschaft_ablauf_30: '📅',
  lizenz_ablauf_30: '📜',
};

export default function AutomatisierungTab() {
  const { activeDojo } = useDojoContext();
  const withDojo = (url) => activeDojo?.id ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}` : url;

  const [trigger, setTrigger] = useState([]);
  const [vorlagen, setVorlagen] = useState([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState('');
  const [zeigNeu, setZeigNeu] = useState(false);

  // Neuer Trigger Form
  const [neuTriggerTyp, setNeuTriggerTyp] = useState('');
  const [neuVorlagenId, setNeuVorlagenId] = useState('');
  const [neuVersandArt, setNeuVersandArt] = useState('email');
  const [speichert, setSpeichert] = useState(false);

  const ladeAlles = useCallback(async () => {
    setLaedt(true);
    setFehler('');
    try {
      const [tRes, vRes] = await Promise.all([
        axios.get(withDojo('/vorlage-trigger')),
        axios.get(withDojo('/vorlagen')),
      ]);
      setTrigger(tRes.data.trigger || []);
      setVorlagen((vRes.data.vorlagen || []).filter(v => v.email_html));
    } catch (err) {
      setFehler('Fehler beim Laden der Automatisierungen');
    } finally {
      setLaedt(false);
    }
  }, [activeDojo]);

  useEffect(() => { ladeAlles(); }, [ladeAlles]);

  async function handleToggle(t) {
    try {
      await axios.put(withDojo(`/vorlage-trigger/${t.id}`), { aktiv: t.aktiv ? 0 : 1 });
      setTrigger(prev => prev.map(x => x.id === t.id ? { ...x, aktiv: x.aktiv ? 0 : 1 } : x));
    } catch { setFehler('Fehler beim Umschalten'); }
  }

  async function handleLoeschen(t) {
    if (!window.confirm(`Trigger "${TRIGGER_LABELS[t.trigger_typ]}" wirklich löschen?`)) return;
    try {
      await axios.delete(withDojo(`/vorlage-trigger/${t.id}`));
      setTrigger(prev => prev.filter(x => x.id !== t.id));
    } catch { setFehler('Fehler beim Löschen'); }
  }

  async function handleNeuSpeichern() {
    if (!neuTriggerTyp || !neuVorlagenId) {
      setFehler('Bitte Trigger-Typ und Vorlage auswählen');
      return;
    }
    setSpeichert(true);
    setFehler('');
    try {
      const res = await axios.post(withDojo('/vorlage-trigger'), {
        trigger_typ: neuTriggerTyp,
        vorlage_id: Number(neuVorlagenId),
        versand_art: neuVersandArt,
      });
      setTrigger(prev => [...prev, res.data.trigger]);
      setZeigNeu(false);
      setNeuTriggerTyp('');
      setNeuVorlagenId('');
      setNeuVersandArt('email');
    } catch (err) {
      setFehler(err.response?.data?.error || 'Fehler beim Speichern');
    } finally {
      setSpeichert(false);
    }
  }

  // Verwendete Trigger-Typen (um Duplikate zu vermeiden)
  const verwendeteTypen = trigger.map(t => t.trigger_typ);
  const verfuegbareTypen = Object.keys(TRIGGER_LABELS).filter(typ => !verwendeteTypen.includes(typ));

  return (
    <div className="at-container">
      <div className="at-header">
        <div>
          <h2 className="at-title">Automatisierungen</h2>
          <p className="at-subtitle">
            E-Mails werden täglich um 08:15 Uhr automatisch an die passenden Mitglieder gesendet.
          </p>
        </div>
        <button onClick={() => { setZeigNeu(true); setFehler(''); }} className="at-btn-add">
          <Plus size={14} /> Neuer Trigger
        </button>
      </div>

      {fehler && (
        <div className="at-error">
          <AlertCircle size={15} /> {fehler}
          <button onClick={ladeAlles} className="at-error-retry"><RefreshCw size={12} /></button>
        </div>
      )}

      {/* Neuer Trigger Form */}
      {zeigNeu && (
        <div className="at-new-form">
          <div className="at-new-form-title"><Zap size={15} /> Neuen Trigger anlegen</div>
          <div className="at-new-form-grid">
            <div className="at-field">
              <label className="at-label">Ereignis</label>
              <select
                value={neuTriggerTyp}
                onChange={e => setNeuTriggerTyp(e.target.value)}
                className="at-select"
              >
                <option value="">— Trigger wählen —</option>
                {verfuegbareTypen.map(typ => (
                  <option key={typ} value={typ}>{TRIGGER_ICONS[typ]} {TRIGGER_LABELS[typ]}</option>
                ))}
              </select>
            </div>
            <div className="at-field">
              <label className="at-label">Vorlage</label>
              <select
                value={neuVorlagenId}
                onChange={e => setNeuVorlagenId(e.target.value)}
                className="at-select"
              >
                <option value="">— Vorlage wählen —</option>
                {vorlagen.map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
            <div className="at-field">
              <label className="at-label">Versandart</label>
              <select value={neuVersandArt} onChange={e => setNeuVersandArt(e.target.value)} className="at-select">
                <option value="email">Nur E-Mail</option>
                <option value="email_mit_pdf">E-Mail + PDF</option>
              </select>
            </div>
          </div>
          <div className="at-new-form-actions">
            <button onClick={() => { setZeigNeu(false); setFehler(''); }} className="at-btn-cancel">Abbrechen</button>
            <button onClick={handleNeuSpeichern} disabled={speichert} className="at-btn-save">
              <Plus size={13} /> {speichert ? 'Speichere...' : 'Trigger anlegen'}
            </button>
          </div>
        </div>
      )}

      {/* Trigger-Liste */}
      {laedt ? (
        <div className="at-loading">Automatisierungen werden geladen...</div>
      ) : trigger.length === 0 ? (
        <div className="at-empty">
          <Zap size={40} className="at-empty-icon" />
          <h3>Noch keine Automatisierungen</h3>
          <p>Richte automatische E-Mail-Trigger ein, die täglich geprüft und versendet werden.</p>
          <button onClick={() => setZeigNeu(true)} className="at-btn-add">
            <Plus size={14} /> Ersten Trigger anlegen
          </button>
        </div>
      ) : (
        <div className="at-trigger-list">
          {trigger.map(t => (
            <div key={t.id} className={`at-trigger-card ${t.aktiv ? '' : 'at-trigger-card--inaktiv'}`}>
              <div className="at-trigger-icon">{TRIGGER_ICONS[t.trigger_typ] || '⚙️'}</div>
              <div className="at-trigger-info">
                <div className="at-trigger-typ">{TRIGGER_LABELS[t.trigger_typ] || t.trigger_typ}</div>
                <div className="at-trigger-meta">
                  <span className="at-trigger-vorlage">{t.vorlage_name || 'Vorlage nicht gefunden'}</span>
                  <span className="at-trigger-sep">·</span>
                  <span>{t.versand_art === 'email_mit_pdf' ? 'E-Mail + PDF' : 'Nur E-Mail'}</span>
                </div>
              </div>
              <div className="at-trigger-actions">
                <span className={`at-status-badge ${t.aktiv ? 'at-status-badge--aktiv' : 'at-status-badge--inaktiv'}`}>
                  {t.aktiv ? 'Aktiv' : 'Inaktiv'}
                </span>
                <button
                  onClick={() => handleToggle(t)}
                  className="at-btn-toggle"
                  title={t.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                >
                  {t.aktiv ? <ToggleRight size={22} className="at-toggle-on" /> : <ToggleLeft size={22} className="at-toggle-off" />}
                </button>
                <button onClick={() => handleLoeschen(t)} className="at-btn-delete" title="Löschen">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
