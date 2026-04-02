/**
 * SerienBriefModal.jsx
 * =====================
 * Phase 3: Serienbrief / Massenversand
 * Vorlage an gefilterte Mitgliedergruppe senden — 3 Schritte.
 */

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Users, Send, CheckCircle, AlertCircle, Mail, FileText } from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';
import '../styles/SerienBriefModal.css';

const FILTER_OPTIONEN = [
  { value: 'alle_mit_email', label: 'Alle Mitglieder mit E-Mail', desc: 'Alle Mitglieder, die eine E-Mail-Adresse haben' },
  { value: 'alle_aktiv', label: 'Nur aktive Mitglieder', desc: 'Nur Mitglieder mit Status "aktiv" und E-Mail-Adresse' },
];

export default function SerienBriefModal({ vorlagenId, vorlagenName, onClose }) {
  const { activeDojo } = useDojoContext();
  const withDojo = (url) => activeDojo?.id ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}` : url;

  const [schritt, setSchritt] = useState(1);
  const [filter, setFilter] = useState('alle_mit_email');
  const [versandArt, setVersandArt] = useState('email');
  const [anzahl, setAnzahl] = useState(null);
  const [ladeAnzahl, setLadeAnzahl] = useState(false);
  const [sende, setSende] = useState(false);
  const [ergebnis, setErgebnis] = useState(null);
  const [fehler, setFehler] = useState('');

  useEffect(() => {
    ladeAnzahlEmpfaenger();
  }, [filter]);

  async function ladeAnzahlEmpfaenger() {
    setLadeAnzahl(true);
    try {
      const res = await axios.get(withDojo(`/vorlagen/${vorlagenId}/serien-count?filter=${filter}`));
      setAnzahl(res.data.count || 0);
    } catch {
      setAnzahl(null);
    } finally {
      setLadeAnzahl(false);
    }
  }

  async function handleSenden() {
    setSende(true);
    setFehler('');
    try {
      const res = await axios.post(withDojo(`/vorlagen/${vorlagenId}/serien-senden`), {
        filter,
        versand_art: versandArt,
        zusatz_daten: {},
      });
      setErgebnis(res.data);
      setSchritt(3);
    } catch (err) {
      setFehler(err.response?.data?.error || 'Fehler beim Senden');
    } finally {
      setSende(false);
    }
  }

  return (
    <div className="sbm-overlay">
      <div className="sbm-modal">
        {/* Header */}
        <div className="sbm-header">
          <div className="sbm-header-left">
            <Send size={18} />
            <div>
              <div className="sbm-header-title">Serienbrief</div>
              <div className="sbm-header-sub">{vorlagenName}</div>
            </div>
          </div>
          <button onClick={onClose} className="sbm-close-btn"><X size={20} /></button>
        </div>

        {/* Schritte-Anzeige */}
        <div className="sbm-steps">
          {[1, 2, 3].map(s => (
            <div key={s} className={`sbm-step ${schritt >= s ? 'sbm-step--active' : ''} ${schritt === s ? 'sbm-step--current' : ''}`}>
              <div className="sbm-step-circle">{s}</div>
              <span>{s === 1 ? 'Empfänger' : s === 2 ? 'Bestätigung' : 'Ergebnis'}</span>
            </div>
          ))}
        </div>

        {/* Schritt 1: Empfänger */}
        {schritt === 1 && (
          <div className="sbm-body">
            <h3 className="sbm-section-title">Empfängergruppe wählen</h3>

            <div className="sbm-filter-list">
              {FILTER_OPTIONEN.map(opt => (
                <label
                  key={opt.value}
                  className={`sbm-filter-opt ${filter === opt.value ? 'sbm-filter-opt--active' : ''}`}
                >
                  <input
                    type="radio"
                    name="filter"
                    value={opt.value}
                    checked={filter === opt.value}
                    onChange={() => setFilter(opt.value)}
                    className="sbm-radio-hidden"
                  />
                  <div className="sbm-filter-icon"><Users size={18} /></div>
                  <div>
                    <div className="sbm-filter-label">{opt.label}</div>
                    <div className="sbm-filter-desc">{opt.desc}</div>
                  </div>
                  <div className="sbm-filter-count">
                    {ladeAnzahl ? '...' : filter === opt.value ? `${anzahl ?? '?'} Mitglieder` : ''}
                  </div>
                </label>
              ))}
            </div>

            <h3 className="sbm-section-title sbm-section-title--mt">Versandart</h3>
            <div className="sbm-versandart-row">
              {[
                { value: 'email', icon: <Mail size={14} />, label: 'Nur E-Mail' },
                { value: 'email_mit_pdf', icon: <><Mail size={14} /><FileText size={14} /></>, label: 'E-Mail + PDF' },
              ].map(opt => (
                <label key={opt.value} className={`sbm-versandart-opt ${versandArt === opt.value ? 'sbm-versandart-opt--active' : ''}`}>
                  <input type="radio" name="versandArt" value={opt.value} checked={versandArt === opt.value}
                    onChange={() => setVersandArt(opt.value)} className="sbm-radio-hidden" />
                  {opt.icon} {opt.label}
                </label>
              ))}
            </div>

            <div className="sbm-footer">
              <button onClick={onClose} className="sbm-btn-cancel">Abbrechen</button>
              <button
                onClick={() => setSchritt(2)}
                disabled={!anzahl}
                className="sbm-btn-primary"
              >
                Weiter →
              </button>
            </div>
          </div>
        )}

        {/* Schritt 2: Bestätigung */}
        {schritt === 2 && (
          <div className="sbm-body">
            <div className="sbm-confirm-box">
              <Users size={40} className="sbm-confirm-icon" />
              <h3 className="sbm-confirm-title">
                {anzahl} Mitglieder werden angeschrieben
              </h3>
              <div className="sbm-confirm-details">
                <div className="sbm-confirm-row">
                  <span>Empfänger:</span>
                  <span>{FILTER_OPTIONEN.find(o => o.value === filter)?.label}</span>
                </div>
                <div className="sbm-confirm-row">
                  <span>Versandart:</span>
                  <span>{versandArt === 'email' ? 'Nur E-Mail' : 'E-Mail + PDF-Anhang'}</span>
                </div>
                <div className="sbm-confirm-row">
                  <span>Vorlage:</span>
                  <span>{vorlagenName}</span>
                </div>
              </div>
              <div className="sbm-confirm-warn">
                Dieser Vorgang kann nicht rückgängig gemacht werden.
              </div>
            </div>

            {fehler && (
              <div className="sbm-error"><AlertCircle size={16} /> {fehler}</div>
            )}

            <div className="sbm-footer">
              <button onClick={() => setSchritt(1)} className="sbm-btn-cancel">← Zurück</button>
              <button onClick={handleSenden} disabled={sende} className="sbm-btn-primary sbm-btn-danger">
                <Send size={14} /> {sende ? `Sende... (kann einige Minuten dauern)` : `Jetzt an ${anzahl} Mitglieder senden`}
              </button>
            </div>
          </div>
        )}

        {/* Schritt 3: Ergebnis */}
        {schritt === 3 && ergebnis && (
          <div className="sbm-body sbm-body--center">
            {ergebnis.fehler === 0 ? (
              <CheckCircle size={52} className="sbm-result-icon sbm-result-icon--ok" />
            ) : (
              <AlertCircle size={52} className="sbm-result-icon sbm-result-icon--warn" />
            )}
            <h3 className="sbm-result-title">Serienbrief abgeschlossen</h3>

            <div className="sbm-result-stats">
              <div className="sbm-result-stat sbm-result-stat--ok">
                <div className="sbm-result-stat-val">{ergebnis.gesendet}</div>
                <div className="sbm-result-stat-label">Gesendet</div>
              </div>
              <div className={`sbm-result-stat ${ergebnis.fehler > 0 ? 'sbm-result-stat--err' : 'sbm-result-stat--ok'}`}>
                <div className="sbm-result-stat-val">{ergebnis.fehler}</div>
                <div className="sbm-result-stat-label">Fehler</div>
              </div>
              <div className="sbm-result-stat">
                <div className="sbm-result-stat-val">{ergebnis.total}</div>
                <div className="sbm-result-stat-label">Gesamt</div>
              </div>
            </div>

            {ergebnis.fehler_details?.length > 0 && (
              <div className="sbm-fehler-list">
                <div className="sbm-fehler-title">Fehlerdetails:</div>
                {ergebnis.fehler_details.slice(0, 5).map((f, i) => (
                  <div key={i} className="sbm-fehler-item">
                    {f.name} — {f.error}
                  </div>
                ))}
                {ergebnis.fehler_details.length > 5 && (
                  <div className="sbm-fehler-more">+ {ergebnis.fehler_details.length - 5} weitere Fehler</div>
                )}
              </div>
            )}

            <button onClick={onClose} className="sbm-btn-primary sbm-btn-close-result">Schließen</button>
          </div>
        )}
      </div>
    </div>
  );
}
