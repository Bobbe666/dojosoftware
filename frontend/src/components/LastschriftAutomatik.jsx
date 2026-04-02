/**
 * LastschriftAutomatik.jsx
 * Verwaltung automatischer SEPA-Lastschriftläufe (Zeitpläne)
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock, Plus, Trash2, Edit2, Play, CheckCircle, AlertCircle,
  AlertTriangle, Info, ChevronDown, ChevronRight, RefreshCw,
  Calendar, ToggleLeft, ToggleRight, XCircle, Loader, History
} from 'lucide-react';
import config from '../config/config';
import { fetchWithAuth } from '../utils/fetchWithAuth';

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

function formatDate(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function formatCurrency(v) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(v || 0);
}

function getNextExecutionDates(tag, zeit, count = 3) {
  const results = [];
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-based

  for (let i = 0; results.length < count; i++) {
    const candidate = new Date(year, month + i, tag);
    // Überspringe vergangene Daten
    if (candidate > now) {
      const [h, m] = (zeit || '06:00').split(':');
      candidate.setHours(parseInt(h), parseInt(m), 0, 0);
      if (candidate > now) results.push(candidate);
    }
  }
  return results;
}

function getVorlaufWarnung(tag) {
  // Empfehlung: Einzugsdatum = Ausführungstag + 5 Werktage
  // Also Ausführungstag sollte mind. 5 Werktage vor Monatsletztem oder gewünschtem Einzug liegen
  if (tag >= 24) return {
    level: 'error',
    text: `Tag ${tag} ist sehr spät. SEPA-CORE benötigt 5 Bankwerktage Vorlauf. Bei einem Einzug am Monatsende könnte die Frist knapp werden.`
  };
  if (tag >= 20) return {
    level: 'warning',
    text: `Tag ${tag}: Beachte die SEPA-Vorlaufzeit von 5 Bankwerktagen (CORE) bzw. 1 Tag (COR1). Der Einzug bei der Empfängerbank erfolgt frühestens 5 Werktage nach Ihrer Einreichung.`
  };
  return { level: 'ok', text: `Tag ${tag}: Guter Ausführungszeitpunkt. Einzug beim Mitglied ca. 5 Werktage später.` };
}

const TYP_LABELS = {
  beitraege: 'Mitgliedsbeiträge',
  rechnungen: 'Offene Rechnungen',
  verkaeufe: 'Verkäufe / Shop',
  alle: 'Alle (Beiträge + Rechnungen + Verkäufe)'
};

const STATUS_CONFIG = {
  erfolg: { label: 'Erfolgreich', cls: 'ls-badge--success', icon: <CheckCircle size={12} /> },
  teilweise: { label: 'Teilweise', cls: 'ls-badge--warning', icon: <AlertTriangle size={12} /> },
  fehler: { label: 'Fehler', cls: 'ls-badge--error', icon: <XCircle size={12} /> },
  gestartet: { label: 'Läuft…', cls: 'ls-badge--info', icon: <Loader size={12} className="ls-spin" /> },
  abgebrochen: { label: 'Abgebrochen', cls: 'ls-badge--neutral', icon: <XCircle size={12} /> },
};

// ─── Haupt-Komponente ────────────────────────────────────────────────────────

const LastschriftAutomatik = ({ dojoId }) => {
  const [zeitplaene, setZeitplaene] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editZeitplan, setEditZeitplan] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState(null);
  const [ausfuehrungen, setAusfuehrungen] = useState({});
  const [executing, setExecuting] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [execResult, setExecResult] = useState(null);
  const [showSepaInfo, setShowSepaInfo] = useState(false);

  const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/lastschrift-zeitplaene${dojoParam}`);
      const data = await res.json();
      setZeitplaene(Array.isArray(data) ? data : (data.zeitplaene || []));
    } catch (e) {
      setError('Fehler beim Laden der Zeitpläne: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [dojoId]);

  useEffect(() => { load(); }, [load]);

  const loadHistory = async (zeitplanId) => {
    if (ausfuehrungen[zeitplanId]) {
      setExpandedHistory(prev => prev === zeitplanId ? null : zeitplanId);
      return;
    }
    try {
      const res = await fetchWithAuth(
        `${config.apiBaseUrl}/lastschrift-zeitplaene/${zeitplanId}/ausfuehrungen`
      );
      const data = await res.json();
      setAusfuehrungen(prev => ({ ...prev, [zeitplanId]: data.ausfuehrungen || data || [] }));
      setExpandedHistory(zeitplanId);
    } catch (e) {
      console.error('History laden fehlgeschlagen:', e);
    }
  };

  const handleToggle = async (zp) => {
    setToggling(zp.zeitplan_id);
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/lastschrift-zeitplaene/${zp.zeitplan_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...zp, aktiv: !zp.aktiv })
      });
      await load();
    } catch (e) {
      console.error('Toggle fehlgeschlagen:', e);
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (zeitplanId) => {
    if (!window.confirm('Zeitplan wirklich löschen? Ausführungshistorie bleibt erhalten.')) return;
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/lastschrift-zeitplaene/${zeitplanId}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      console.error('Löschen fehlgeschlagen:', e);
    }
  };

  const handleExecuteNow = async (zp) => {
    if (!window.confirm(`Zeitplan "${zp.name}" jetzt sofort manuell ausführen?\n\nEs werden echte Lastschriften eingezogen!`)) return;
    setExecuting(zp.zeitplan_id);
    setExecResult(null);
    try {
      const res = await fetchWithAuth(
        `${config.apiBaseUrl}/lastschrift-zeitplaene/${zp.zeitplan_id}/execute`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dojo_id: dojoId }) }
      );
      const data = await res.json();
      setExecResult({ zeitplanId: zp.zeitplan_id, ...data });
      // History neu laden
      delete ausfuehrungen[zp.zeitplan_id];
      await load();
    } catch (e) {
      setExecResult({ zeitplanId: zp.zeitplan_id, error: e.message });
    } finally {
      setExecuting(null);
    }
  };

  return (
    <div className="ls-auto-container">
      {/* ── Kopfzeile ── */}
      <div className="ls-auto-header">
        <div className="ls-auto-header-left">
          <h2 className="ls-auto-title">
            <Clock size={20} /> Automatischer Einzug
          </h2>
          <p className="ls-auto-subtitle">
            Zeitpläne für automatische SEPA-Lastschriftläufe konfigurieren
          </p>
        </div>
        <div className="ls-auto-header-actions">
          <button className="ls-btn ls-btn--ghost" onClick={() => setShowSepaInfo(v => !v)}>
            <Info size={15} /> SEPA-Hinweise
          </button>
          <button className="ls-btn ls-btn--secondary" onClick={load} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'ls-spin' : ''} />
          </button>
          <button className="ls-btn ls-btn--primary" onClick={() => { setEditZeitplan(null); setShowForm(true); }}>
            <Plus size={15} /> Neuer Zeitplan
          </button>
        </div>
      </div>

      {/* ── SEPA-Hinweise Bereich ── */}
      {showSepaInfo && (
        <div className="ls-sepa-info-panel">
          <h3 className="ls-sepa-info-title">
            <Info size={16} /> SEPA-Vorlaufzeiten & Pflichten
          </h3>
          <div className="ls-sepa-info-grid">
            <div className="ls-sepa-info-card ls-sepa-info-card--blue">
              <h4>⏱ Vorlaufzeiten (Einreichungsfristen)</h4>
              <table className="ls-sepa-table">
                <thead><tr><th>Schema</th><th>Erst-Lastschrift</th><th>Folge-Lastschrift</th></tr></thead>
                <tbody>
                  <tr><td><strong>SEPA CORE</strong></td><td>5 Bankwerktage</td><td>2 Bankwerktage</td></tr>
                  <tr><td><strong>SEPA COR1</strong></td><td>1 Bankwerktag</td><td>1 Bankwerktag</td></tr>
                  <tr><td><strong>SEPA B2B</strong></td><td>1 Bankwerktag</td><td>1 Bankwerktag</td></tr>
                </tbody>
              </table>
              <p className="ls-sepa-info-note">
                💡 Empfehlung: Ausführungstag so wählen, dass zwischen Einreichung und Wunsch-Einzugsdatum
                mind. 5 Bankwerktage liegen. Bankwerktage = Mo–Fr ohne Feiertage.
              </p>
            </div>
            <div className="ls-sepa-info-card ls-sepa-info-card--yellow">
              <h4>📬 Vorab-Information (Pre-Notification)</h4>
              <ul className="ls-sepa-info-list">
                <li><strong>Pflicht:</strong> Schuldner muss vorab informiert werden</li>
                <li><strong>Standard-Frist:</strong> 14 Kalendertage vor Einzug</li>
                <li><strong>Verkürzung möglich:</strong> Im Mandat kann kürzere Frist vereinbart werden (z.B. 1 Tag)</li>
                <li><strong>Inhalt:</strong> Betrag, Einzugsdatum, Gläubiger-ID, Mandatsreferenz</li>
                <li><strong>Form:</strong> Per E-Mail, Brief oder Rechnung</li>
              </ul>
              <p className="ls-sepa-info-note">
                ⚠️ Beitragsrechnungen gelten bereits als Vorab-Information, sofern sie Einzugsdatum und Betrag enthalten.
              </p>
            </div>
            <div className="ls-sepa-info-card ls-sepa-info-card--green">
              <h4>🔄 FRST vs. RCUR (Mandatstypen)</h4>
              <ul className="ls-sepa-info-list">
                <li><strong>FRST:</strong> Erste Lastschrift auf einem neuen Mandat → 5 Tage Vorlauf</li>
                <li><strong>RCUR:</strong> Folge-Lastschrift → 2 Tage Vorlauf</li>
                <li><strong>OOFF:</strong> Einmalig (nicht wiederkehrend)</li>
                <li><strong>FNAL:</strong> Letzte Lastschrift (Kündigung/Ende)</li>
              </ul>
              <p className="ls-sepa-info-note">
                💡 Das System erkennt automatisch ob FRST oder RCUR basierend auf dem Mandat-Nutzungsstatus.
              </p>
            </div>
            <div className="ls-sepa-info-card ls-sepa-info-card--red">
              <h4>⚡ Wichtige Einschränkungen</h4>
              <ul className="ls-sepa-info-list">
                <li>Ausführungstag max. <strong>28</strong> (Februar-Kompatibilität)</li>
                <li>Kein Einzug an Wochenenden und Bankfeiertagen</li>
                <li>Einreichung üblicherweise bis <strong>12:00 Uhr</strong> am Einreichungstag</li>
                <li>Rücklastschriften können bis <strong>8 Wochen</strong> nach Einzug kommen (ohne Angabe von Gründen)</li>
                <li>Bei unauthorisierten Lastschriften: bis zu <strong>13 Monate</strong></li>
              </ul>
            </div>
          </div>
          <div className="ls-sepa-info-example">
            <h4>📅 Beispiel-Zeitplan (Empfehlung MagicLine-Standard)</h4>
            <div className="ls-sepa-example-row">
              <span className="ls-sepa-example-step">1. Vormonat, ca. 20.</span>
              <span className="ls-sepa-example-desc">Vorab-Information an Mitglieder senden (Betrag + Datum)</span>
            </div>
            <div className="ls-sepa-example-row">
              <span className="ls-sepa-example-step">25. des Vormonats</span>
              <span className="ls-sepa-example-desc">Automatischer Zeitplan → PAIN.008 / Stripe-Einreichung</span>
            </div>
            <div className="ls-sepa-example-row">
              <span className="ls-sepa-example-step">1. des Monats</span>
              <span className="ls-sepa-example-desc">Einzugsdatum (Wertstellung bei Mitglied)</span>
            </div>
            <div className="ls-sepa-example-row">
              <span className="ls-sepa-example-step">3.–8. des Monats</span>
              <span className="ls-sepa-example-desc">Mögliche Rücklastschriften → Überwachung</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Fehler ── */}
      {error && (
        <div className="ls-alert ls-alert--error">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ── Leer-Zustand ── */}
      {!loading && zeitplaene.length === 0 && (
        <div className="ls-empty-state">
          <Clock size={48} className="ls-empty-icon" />
          <h3>Noch keine automatischen Zeitpläne</h3>
          <p>Erstelle einen Zeitplan, um Lastschriften automatisch an einem bestimmten Tag im Monat einzuziehen.</p>
          <button className="ls-btn ls-btn--primary" onClick={() => { setEditZeitplan(null); setShowForm(true); }}>
            <Plus size={16} /> Ersten Zeitplan erstellen
          </button>
        </div>
      )}

      {/* ── Lade-Spinner ── */}
      {loading && (
        <div className="ls-loading">
          <Loader size={24} className="ls-spin" /> Zeitpläne werden geladen…
        </div>
      )}

      {/* ── Zeitplan-Liste ── */}
      {!loading && zeitplaene.map(zp => {
        const vorlauf = getVorlaufWarnung(zp.ausfuehrungstag);
        const nextDates = getNextExecutionDates(zp.ausfuehrungstag, zp.ausfuehrungszeit);
        const historyOpen = expandedHistory === zp.zeitplan_id;
        const isExecuting = executing === zp.zeitplan_id;
        const isToggling = toggling === zp.zeitplan_id;
        const myResult = execResult?.zeitplanId === zp.zeitplan_id ? execResult : null;

        return (
          <div key={zp.zeitplan_id} className={`ls-zeitplan-card${zp.aktiv ? '' : ' ls-zeitplan-card--inactive'}`}>
            {/* Karten-Header */}
            <div className="ls-zp-header">
              <div className="ls-zp-header-left">
                <div className="ls-zp-title-row">
                  <h3 className="ls-zp-name">{zp.name}</h3>
                  <span className={`ls-badge ${zp.aktiv ? 'ls-badge--success' : 'ls-badge--neutral'}`}>
                    {zp.aktiv ? <><CheckCircle size={11} /> Aktiv</> : <><XCircle size={11} /> Inaktiv</>}
                  </span>
                  <span className="ls-badge ls-badge--blue">{TYP_LABELS[zp.typ] || zp.typ}</span>
                </div>
                {zp.beschreibung && (
                  <p className="ls-zp-desc">{zp.beschreibung}</p>
                )}
                <div className="ls-zp-meta-row">
                  <span className="ls-zp-meta">
                    <Calendar size={12} />
                    Jeden Monat am <strong>{zp.ausfuehrungstag}.</strong> um <strong>{(zp.ausfuehrungszeit || '06:00').substring(0, 5)} Uhr</strong>
                  </span>
                  {zp.nur_faellige_bis_tag && (
                    <span className="ls-zp-meta">
                      <Clock size={12} />
                      Nur fällig bis: {zp.nur_faellige_bis_tag}. des Monats
                    </span>
                  )}
                  {zp.letzte_ausfuehrung && (
                    <span className="ls-zp-meta">
                      Letzte Ausführung: {formatDate(zp.letzte_ausfuehrung)}
                      {zp.letzte_ausfuehrung_status && (
                        <span className={`ls-badge ls-badge--sm ${STATUS_CONFIG[zp.letzte_ausfuehrung_status]?.cls || ''}`}>
                          {STATUS_CONFIG[zp.letzte_ausfuehrung_status]?.icon}
                          {STATUS_CONFIG[zp.letzte_ausfuehrung_status]?.label || zp.letzte_ausfuehrung_status}
                        </span>
                      )}
                    </span>
                  )}
                  {zp.letzte_ausfuehrung_anzahl > 0 && (
                    <span className="ls-zp-meta">
                      Letzter Lauf: <strong>{zp.letzte_ausfuehrung_anzahl}</strong> Mitglieder,{' '}
                      <strong>{formatCurrency(zp.letzte_ausfuehrung_betrag)}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Aktions-Buttons */}
              <div className="ls-zp-actions">
                <button
                  className={`ls-toggle-btn${zp.aktiv ? ' ls-toggle-btn--on' : ''}`}
                  onClick={() => handleToggle(zp)}
                  disabled={isToggling}
                  title={zp.aktiv ? 'Zeitplan deaktivieren' : 'Zeitplan aktivieren'}
                >
                  {isToggling ? <Loader size={18} className="ls-spin" /> :
                    zp.aktiv ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                  {zp.aktiv ? 'Aktiv' : 'Inaktiv'}
                </button>
                <button
                  className="ls-btn ls-btn--icon"
                  onClick={() => loadHistory(zp.zeitplan_id)}
                  title="Ausführungshistorie"
                >
                  <History size={15} />
                  <span className="ls-btn-label">Historie</span>
                  {historyOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
                <button
                  className="ls-btn ls-btn--icon ls-btn--run"
                  onClick={() => handleExecuteNow(zp)}
                  disabled={isExecuting}
                  title="Jetzt manuell ausführen"
                >
                  {isExecuting ? <Loader size={15} className="ls-spin" /> : <Play size={15} />}
                  <span className="ls-btn-label">Jetzt ausführen</span>
                </button>
                <button
                  className="ls-btn ls-btn--icon"
                  onClick={() => { setEditZeitplan(zp); setShowForm(true); }}
                  title="Bearbeiten"
                >
                  <Edit2 size={15} />
                </button>
                <button
                  className="ls-btn ls-btn--icon ls-btn--danger"
                  onClick={() => handleDelete(zp.zeitplan_id)}
                  title="Löschen"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* Vorlauf-Warnung */}
            {vorlauf.level !== 'ok' && (
              <div className={`ls-vorlauf-hint ls-vorlauf-hint--${vorlauf.level}`}>
                {vorlauf.level === 'error' ? <AlertCircle size={14} /> : <AlertTriangle size={14} />}
                {vorlauf.text}
              </div>
            )}

            {/* Nächste Ausführungen */}
            {zp.aktiv && nextDates.length > 0 && (
              <div className="ls-next-dates">
                <span className="ls-next-dates-label">Nächste Ausführungen:</span>
                {nextDates.map((d, i) => (
                  <span key={i} className="ls-next-date-chip">
                    <Calendar size={11} />
                    {d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' '}
                    <span className="ls-next-date-einzug">
                      (Einzug ~{new Date(d.getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })})
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Ausführungs-Ergebnis */}
            {myResult && (
              <div className={`ls-exec-result ${myResult.error || myResult.status === 'fehler' ? 'ls-exec-result--error' : 'ls-exec-result--success'}`}>
                {myResult.error ? (
                  <><AlertCircle size={14} /> Fehler: {myResult.error}</>
                ) : (
                  <>
                    <CheckCircle size={14} />
                    Ausführung abgeschlossen: {myResult.anzahl_verarbeitet || 0} Mitglieder,{' '}
                    {formatCurrency(myResult.gesamtbetrag)} — Status: {myResult.status}
                  </>
                )}
                <button className="ls-exec-result-close" onClick={() => setExecResult(null)}>✕</button>
              </div>
            )}

            {/* Ausführungshistorie */}
            {historyOpen && (
              <div className="ls-history">
                <h4 className="ls-history-title">
                  <History size={14} /> Ausführungshistorie
                </h4>
                {!ausfuehrungen[zp.zeitplan_id]?.length ? (
                  <p className="ls-history-empty">Noch keine Ausführungen</p>
                ) : (
                  <table className="ls-history-table">
                    <thead>
                      <tr>
                        <th>Datum</th>
                        <th>Status</th>
                        <th>Mitglieder</th>
                        <th>Erfolgreich</th>
                        <th>Fehlgeschlagen</th>
                        <th>Betrag</th>
                        <th>Dauer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ausfuehrungen[zp.zeitplan_id].map(a => {
                        const sc = STATUS_CONFIG[a.status] || {};
                        const dauer = a.beendet_am && a.gestartet_am
                          ? Math.round((new Date(a.beendet_am) - new Date(a.gestartet_am)) / 1000)
                          : null;
                        return (
                          <tr key={a.ausfuehrung_id}>
                            <td>{formatDate(a.gestartet_am)}</td>
                            <td>
                              <span className={`ls-badge ${sc.cls || ''}`}>
                                {sc.icon} {sc.label || a.status}
                              </span>
                            </td>
                            <td>{a.anzahl_verarbeitet ?? '–'}</td>
                            <td className="ls-history-success">{a.anzahl_erfolgreich ?? '–'}</td>
                            <td className={a.anzahl_fehlgeschlagen > 0 ? 'ls-history-error' : ''}>
                              {a.anzahl_fehlgeschlagen ?? '–'}
                            </td>
                            <td>{a.gesamtbetrag != null ? formatCurrency(a.gesamtbetrag) : '–'}</td>
                            <td>{dauer != null ? `${dauer}s` : '–'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Formular-Modal ── */}
      {showForm && (
        <ZeitplanFormular
          initial={editZeitplan}
          dojoId={dojoId}
          onSave={async () => { setShowForm(false); await load(); }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
};

// ─── Zeitplan-Formular ───────────────────────────────────────────────────────

const ZAHLUNGSZYKLEN = [
  { value: 'monatlich', label: 'Monatlich' },
  { value: 'zweimonatlich', label: 'Zweimonatlich' },
  { value: 'vierteljährlich', label: 'Vierteljährlich' },
  { value: 'halbjährlich', label: 'Halbjährlich' },
  { value: 'jährlich', label: 'Jährlich' },
];

const EMPTY_FORM = {
  name: '',
  beschreibung: '',
  ausfuehrungstag: 25,
  ausfuehrungszeit: '06:00',
  typ: 'beitraege',
  nur_faellige_bis_tag: '',
  zahlungszyklus_filter: [],
  aktiv: true,
};

const ZeitplanFormular = ({ initial, dojoId, onSave, onClose }) => {
  const isEdit = !!initial;
  const [form, setForm] = useState(isEdit ? {
    ...EMPTY_FORM,
    ...initial,
    ausfuehrungszeit: (initial.ausfuehrungszeit || '06:00:00').substring(0, 5),
    zahlungszyklus_filter: Array.isArray(initial.zahlungszyklus_filter)
      ? initial.zahlungszyklus_filter
      : (initial.zahlungszyklus_filter ? JSON.parse(initial.zahlungszyklus_filter) : []),
  } : { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const vorlauf = getVorlaufWarnung(form.ausfuehrungstag);
  const nextDates = getNextExecutionDates(form.ausfuehrungstag, form.ausfuehrungszeit);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const toggleZyklus = (val) => {
    set('zahlungszyklus_filter',
      form.zahlungszyklus_filter.includes(val)
        ? form.zahlungszyklus_filter.filter(z => z !== val)
        : [...form.zahlungszyklus_filter, val]
    );
  };

  const handleSave = async () => {
    setFormError(null);
    if (!form.name.trim()) { setFormError('Name ist erforderlich'); return; }
    if (form.ausfuehrungstag < 1 || form.ausfuehrungstag > 28) {
      setFormError('Ausführungstag muss zwischen 1 und 28 liegen'); return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        dojo_id: dojoId,
        ausfuehrungszeit: form.ausfuehrungszeit + ':00',
        nur_faellige_bis_tag: form.nur_faellige_bis_tag ? parseInt(form.nur_faellige_bis_tag) : null,
        zahlungszyklus_filter: form.zahlungszyklus_filter.length > 0 ? form.zahlungszyklus_filter : null,
      };

      const url = isEdit
        ? `${config.apiBaseUrl}/lastschrift-zeitplaene/${initial.zeitplan_id}`
        : `${config.apiBaseUrl}/lastschrift-zeitplaene`;

      const res = await fetchWithAuth(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) { setFormError(data.error || 'Fehler beim Speichern'); return; }
      await onSave();
    } catch (e) {
      setFormError('Fehler: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ls-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="ls-modal">
        <div className="ls-modal-header">
          <h2>{isEdit ? 'Zeitplan bearbeiten' : 'Neuer Zeitplan'}</h2>
          <button className="ls-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="ls-modal-body">
          {formError && (
            <div className="ls-alert ls-alert--error">
              <AlertCircle size={15} /> {formError}
            </div>
          )}

          {/* ── Abschnitt: Grundeinstellungen ── */}
          <div className="ls-form-section">
            <h3 className="ls-form-section-title">Grundeinstellungen</h3>
            <div className="ls-form-group">
              <label className="ls-form-label">
                Name <span className="ls-required">*</span>
              </label>
              <input
                className="ls-form-input"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="z.B. Monatlicher Beitragseinzug"
              />
            </div>
            <div className="ls-form-group">
              <label className="ls-form-label">Beschreibung</label>
              <textarea
                className="ls-form-input ls-form-textarea"
                value={form.beschreibung}
                onChange={e => set('beschreibung', e.target.value)}
                placeholder="Optional: Interne Notiz zu diesem Zeitplan"
                rows={2}
              />
            </div>
            <div className="ls-form-group">
              <label className="ls-form-label">
                Einzugstyp <span className="ls-required">*</span>
              </label>
              <div className="ls-radio-group">
                {Object.entries(TYP_LABELS).map(([val, label]) => (
                  <label key={val} className={`ls-radio-btn${form.typ === val ? ' ls-radio-btn--active' : ''}`}>
                    <input
                      type="radio"
                      name="typ"
                      value={val}
                      checked={form.typ === val}
                      onChange={() => set('typ', val)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Abschnitt: Zeitplanung ── */}
          <div className="ls-form-section">
            <h3 className="ls-form-section-title">Zeitplanung</h3>
            <div className="ls-form-row">
              <div className="ls-form-group ls-form-group--flex">
                <label className="ls-form-label">
                  Ausführungstag <span className="ls-required">*</span>
                  <span className="ls-label-hint">(1–28, Vorlauf beachten!)</span>
                </label>
                <div className="ls-day-input-wrap">
                  <input
                    type="number"
                    className="ls-form-input ls-form-input--sm"
                    value={form.ausfuehrungstag}
                    onChange={e => set('ausfuehrungstag', Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                    min={1}
                    max={28}
                  />
                  <span className="ls-day-suffix">. des Monats</span>
                </div>
                {/* Schnellwahl-Tage */}
                <div className="ls-day-quickselect">
                  {[1, 3, 5, 10, 15, 20, 25, 28].map(d => (
                    <button
                      key={d}
                      type="button"
                      className={`ls-day-chip${form.ausfuehrungstag === d ? ' ls-day-chip--active' : ''}`}
                      onClick={() => set('ausfuehrungstag', d)}
                    >
                      {d}.
                    </button>
                  ))}
                </div>
              </div>
              <div className="ls-form-group ls-form-group--flex">
                <label className="ls-form-label">
                  Ausführungszeit
                  <span className="ls-label-hint">(Empfehlung: vor 08:00 Uhr)</span>
                </label>
                <input
                  type="time"
                  className="ls-form-input ls-form-input--sm"
                  value={form.ausfuehrungszeit}
                  onChange={e => set('ausfuehrungszeit', e.target.value)}
                />
                <p className="ls-form-hint">
                  Banken erwarten die PAIN.008-Datei i.d.R. bis 12:00 Uhr.
                  Frühzeitig einreichen empfohlen.
                </p>
              </div>
            </div>

            {/* Vorlauf-Indikator */}
            <div className={`ls-vorlauf-block ls-vorlauf-block--${vorlauf.level}`}>
              {vorlauf.level === 'ok' && <CheckCircle size={16} />}
              {vorlauf.level === 'warning' && <AlertTriangle size={16} />}
              {vorlauf.level === 'error' && <AlertCircle size={16} />}
              <div>
                <strong>SEPA-Vorlaufzeit:</strong> {vorlauf.text}
                {nextDates.length > 0 && (
                  <div className="ls-vorlauf-next">
                    Nächste Ausführung: {nextDates[0].toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                    {' '}→ Einzug beim Mitglied ~
                    {new Date(nextDates[0].getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: 'long' })}
                  </div>
                )}
              </div>
            </div>

            {/* Nächste 3 Ausführungstermine */}
            {nextDates.length > 0 && (
              <div className="ls-preview-dates">
                <span className="ls-preview-dates-label">Vorschau nächste Ausführungen:</span>
                {nextDates.map((d, i) => (
                  <div key={i} className="ls-preview-date-row">
                    <Calendar size={13} />
                    <strong>{d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</strong>
                    <span className="ls-preview-date-sep">→</span>
                    <span className="ls-preview-date-einzug">
                      Einzug ~{new Date(d.getTime() + 5 * 24 * 60 * 60 * 1000).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                      {' '}({WOCHENTAGE[new Date(d.getTime() + 5 * 24 * 60 * 60 * 1000).getDay() === 0 ? 6 : new Date(d.getTime() + 5 * 24 * 60 * 60 * 1000).getDay() - 1]})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Abschnitt: Filter ── */}
          <div className="ls-form-section">
            <h3 className="ls-form-section-title">Filter & Einschränkungen</h3>
            <div className="ls-form-group">
              <label className="ls-form-label">
                Nur fällige bis Tag
                <span className="ls-label-hint">(leer = alle fälligen Beiträge einziehen)</span>
              </label>
              <div className="ls-day-input-wrap">
                <input
                  type="number"
                  className="ls-form-input ls-form-input--sm"
                  value={form.nur_faellige_bis_tag}
                  onChange={e => set('nur_faellige_bis_tag', e.target.value)}
                  placeholder="z.B. 31"
                  min={1}
                  max={31}
                />
                <span className="ls-day-suffix">. des Monats</span>
              </div>
              <p className="ls-form-hint">
                Werden nur Beiträge mit Fälligkeitsdatum bis zu diesem Tag berücksichtigt.
                Nützlich für mehrere Läufe pro Monat (z.B. 1. Lauf: bis 15., 2. Lauf: bis 31.).
              </p>
            </div>

            <div className="ls-form-group">
              <label className="ls-form-label">
                Zahlungszyklus-Filter
                <span className="ls-label-hint">(leer = alle Zyklen)</span>
              </label>
              <div className="ls-checkbox-group">
                {ZAHLUNGSZYKLEN.map(z => (
                  <label key={z.value} className={`ls-checkbox-btn${form.zahlungszyklus_filter.includes(z.value) ? ' ls-checkbox-btn--active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.zahlungszyklus_filter.includes(z.value)}
                      onChange={() => toggleZyklus(z.value)}
                    />
                    {z.label}
                  </label>
                ))}
              </div>
              <p className="ls-form-hint">
                Nur Beiträge mit diesen Zahlungszyklen einziehen. Leer lassen für alle.
              </p>
            </div>

            <div className="ls-form-group">
              <label className="ls-toggle-label">
                <span>Zeitplan aktiv</span>
                <button
                  type="button"
                  className={`ls-toggle-btn ls-toggle-btn--sm${form.aktiv ? ' ls-toggle-btn--on' : ''}`}
                  onClick={() => set('aktiv', !form.aktiv)}
                >
                  {form.aktiv ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                  {form.aktiv ? 'Aktiv' : 'Inaktiv'}
                </button>
              </label>
              <p className="ls-form-hint">
                Inaktive Zeitpläne werden vom System ignoriert — kein automatischer Einzug.
              </p>
            </div>
          </div>

          {/* ── Zusammenfassung ── */}
          {form.name && (
            <div className="ls-summary-box">
              <h4 className="ls-summary-title">Zusammenfassung</h4>
              <p>
                <strong>„{form.name}"</strong> zieht{' '}
                <strong>{TYP_LABELS[form.typ] || form.typ}</strong> automatisch am{' '}
                <strong>{form.ausfuehrungstag}. jeden Monats</strong> um{' '}
                <strong>{form.ausfuehrungszeit} Uhr</strong> ein.
                {form.nur_faellige_bis_tag && ` Nur Beiträge fällig bis zum ${form.nur_faellige_bis_tag}.`}
                {form.zahlungszyklus_filter.length > 0 && ` Zahlungszyklen: ${form.zahlungszyklus_filter.join(', ')}.`}
                {!form.aktiv && ' (Zeitplan ist derzeit inaktiv)'}
              </p>
            </div>
          )}
        </div>

        <div className="ls-modal-footer">
          <button className="ls-btn ls-btn--ghost" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button className="ls-btn ls-btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader size={14} className="ls-spin" /> Speichern…</> : (isEdit ? 'Änderungen speichern' : 'Zeitplan erstellen')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LastschriftAutomatik;
