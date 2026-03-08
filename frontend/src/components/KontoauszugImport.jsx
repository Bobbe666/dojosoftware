/**
 * KontoauszugImport
 * ==================
 * CSV-Kontoauszüge importieren mit automatischer Bankerkennung.
 * Unterstützte Banken: ING, DKB, Comdirect, Sparkasse, Volksbank, Deutsche Bank, N26
 */

import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload, Check, X, AlertCircle, AlertTriangle, ChevronDown, ChevronUp,
  FileText, Loader, Home, Users, Box, Megaphone, Shield,
  Receipt, Car, Phone, Laptop, GraduationCap, Wrench, Paperclip, MoreHorizontal,
  RotateCcw
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext.jsx';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/KontoauszugImport.css';

// ── Konstanten ────────────────────────────────────────────────────────────────

const KATEGORIEN = [
  { key: 'miete', label: 'Miete & Nebenkosten', icon: Home },
  { key: 'personal', label: 'Personalkosten', icon: Users },
  { key: 'material', label: 'Material & Ausstattung', icon: Box },
  { key: 'marketing', label: 'Marketing & Werbung', icon: Megaphone },
  { key: 'versicherung', label: 'Versicherungen', icon: Shield },
  { key: 'gebuehren', label: 'Gebühren & Beiträge', icon: Receipt },
  { key: 'fahrtkosten', label: 'Fahrtkosten', icon: Car },
  { key: 'telefon', label: 'Telefon & Internet', icon: Phone },
  { key: 'software', label: 'Software & Lizenzen', icon: Laptop },
  { key: 'fortbildung', label: 'Fortbildung & Seminare', icon: GraduationCap },
  { key: 'reparatur', label: 'Reparaturen & Wartung', icon: Wrench },
  { key: 'buero', label: 'Büromaterial', icon: Paperclip },
  { key: 'sonstiges', label: 'Sonstige Ausgaben', icon: MoreHorizontal }
];

const BANK_COLORS = {
  ING: '#f97316',
  DKB: '#3b82f6',
  DKB2: '#3b82f6',
  COMDIRECT: '#f59e0b',
  SPARKASSE: '#ef4444',
  SPARKASSE2: '#ef4444',
  VOLKSBANK: '#10b981',
  DEUTSCHE_BANK: '#6366f1',
  N26: '#8b5cf6'
};

function formatBetrag(betrag) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(betrag);
}

function formatDatum(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  return `${d}.${m}.${y}`;
}

// ── Hilfskomponenten ──────────────────────────────────────────────────────────

function DropZone({ onFile, disabled }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`ki-dropzone${dragging ? ' ki-dropzone--dragging' : ''}${disabled ? ' ki-dropzone--disabled' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="u-hidden"
        onChange={handleChange}
        disabled={disabled}
      />
      <Upload size={40} className="ki-upload-icon" />
      <div className="ki-dropzone-title">
        CSV-Datei hier ablegen
      </div>
      <div className="ki-dropzone-sub">
        oder klicken zum Auswählen
      </div>
      <div className="ki-dropzone-hint">
        Unterstützt: ING, DKB, Comdirect, Sparkasse, Volksbank, Deutsche Bank, N26
      </div>
    </div>
  );
}

function BankBadge({ bank, label }) {
  const color = BANK_COLORS[bank] || '#6b7280';
  return (
    <span
      className="ki-bank-badge"
      style={{ '--bank-color': color, '--bank-color-22': color + '22', '--bank-color-44': color + '44' }}
    >
      <FileText size={14} />
      {label || bank}
    </span>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export default function KontoauszugImport() {
  const { activeDojo } = useDojoContext();
  const navigate = useNavigate();

  const [step, setStep] = useState('upload'); // upload | preview | done
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Upload-Ergebnis
  const [bank, setBank] = useState(null);
  const [bankLabel, setBankLabel] = useState(null);
  const [transaktionen, setTransaktionen] = useState([]);

  // Auswahl & Kategorien
  const [selected, setSelected] = useState({});     // idx → bool
  const [kategorien, setKategorien] = useState({}); // idx → string
  const [typen, setTypen] = useState({});            // idx → 'Ausgabe'|'Einnahme'

  // Filter
  const [filter, setFilter] = useState('all');

  // Import-Ergebnis
  const [importResult, setImportResult] = useState(null);

  // ── Datei verarbeiten ─────────────────────────────────────────────────────

  const handleFile = async (file) => {
    setError(null);
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const dojoId = activeDojo?.id;
      const url = dojoId
        ? `/kontoauszug/analyse?dojo_id=${dojoId}`
        : '/kontoauszug/analyse';

      const resp = await fetchWithAuth(url, { method: 'POST', body: formData });
      const data = await resp.json();

      if (!resp.ok || !data.success) throw new Error(data.error || 'Fehler beim Analysieren');

      setBank(data.bank);
      setBankLabel(data.bankLabel);

      const txs = data.transaktionen;
      setTransaktionen(txs);

      // Standardauswahl: alles außer Rücklastschriften und Duplikaten
      const sel = {};
      const kat = {};
      const typ = {};
      txs.forEach((tx, i) => {
        sel[i] = !tx.ruecklastschrift && !tx.duplikat;
        kat[i] = tx.kategorie || 'sonstiges';
        typ[i] = tx.typ || 'Ausgabe';
      });
      setSelected(sel);
      setKategorien(kat);
      setTypen(typ);
      setStep('preview');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = transaktionen
        .map((tx, i) => ({ tx, i }))
        .filter(({ i }) => selected[i])
        .map(({ tx, i }) => ({
          datum: tx.datum,
          beschreibung: tx.beschreibung,
          betrag: tx.betrag,
          typ: typen[i] || tx.typ,
          kategorie: kategorien[i] || 'sonstiges',
          empfaenger: tx.empfaenger,
          bank,
          referenz: tx.referenz
        }));

      const dojoId = activeDojo?.id;
      const url = dojoId
        ? `/kontoauszug/import?dojo_id=${dojoId}`
        : '/kontoauszug/import';

      const resp = await fetchWithAuth(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaktionen: payload })
      });
      const data = await resp.json();

      if (!resp.ok || !data.success) throw new Error(data.error || 'Fehler beim Importieren');

      setImportResult(data);
      setStep('done');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Hilfswerte ────────────────────────────────────────────────────────────

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const visibleIndices = transaktionen
    .map((tx, i) => ({ tx, i }))
    .filter(({ tx }) => {
      if (filter === 'all') return true;
      if (filter === 'Rücklastschrift') return tx.ruecklastschrift;
      return tx.typ === filter && !tx.ruecklastschrift;
    })
    .map(({ i }) => i);

  const allVisible = visibleIndices.length > 0 && visibleIndices.every(i => selected[i]);

  const toggleAll = () => {
    setSelected(s => {
      const next = { ...s };
      visibleIndices.forEach(i => { next[i] = !allVisible; });
      return next;
    });
  };

  const ruecklastschriftCount = transaktionen.filter(tx => tx.ruecklastschrift).length;
  const zahllaufMatchCount    = transaktionen.filter(tx => tx.zahllauf_match).length;
  const duplikatCount         = transaktionen.filter(tx => tx.duplikat && !tx.ruecklastschrift).length;

  const ausgabenSumme = transaktionen
    .filter((_, i) => selected[i] && typen[i] === 'Ausgabe')
    .reduce((sum, tx) => sum + parseFloat(tx.betrag || 0), 0);

  const einnahmenSumme = transaktionen
    .filter((_, i) => selected[i] && typen[i] === 'Einnahme')
    .reduce((sum, tx) => sum + parseFloat(tx.betrag || 0), 0);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="ki-page">

      {/* Header */}
      <div className="ki-page-header">
        <h1 className="ki-page-title">
          Kontoauszug importieren
        </h1>
        <p className="ki-page-subtitle">
          Importiere Bankbewegungen als Ausgaben oder Einnahmen ins Kassenbuch
        </p>
      </div>

      {/* Fehler */}
      {error && (
        <div className="ki-error-banner">
          <AlertCircle size={16} className="ki-error-icon" />
          <span className="ki-error-text">{error}</span>
          <button onClick={() => setError(null)} className="ki-error-dismiss">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── STEP: Upload ── */}
      {step === 'upload' && (
        <div className="ki-upload-wrap">
          <DropZone onFile={handleFile} disabled={loading} />
          {loading && (
            <div className="ki-upload-loading">
              <Loader size={20} className="ki-spin" />
              <span className="ki-loading-label">Analysiere Datei…</span>
            </div>
          )}
        </div>
      )}

      {/* ── STEP: Vorschau ── */}
      {step === 'preview' && (
        <div>
          {/* Bank-Info & Zusammenfassung */}
          <div className="ki-info-bar">
            <div>
              <div className="ki-label">
                Erkannte Bank
              </div>
              <BankBadge bank={bank} label={bankLabel} />
            </div>
            <div className="ki-divider" />
            <div>
              <div className="ki-label">
                Gefunden
              </div>
              <div className="ki-bold-primary">
                {transaktionen.length} Transaktionen
              </div>
            </div>
            <div className="ki-divider" />
            <div>
              <div className="ki-label">
                Ausgewählt
              </div>
              <div className="ki-bold-primary">
                {selectedCount} ({formatBetrag(ausgabenSumme + einnahmenSumme)})
              </div>
            </div>
            {ausgabenSumme > 0 && (
              <>
                <div className="ki-divider" />
                <div>
                  <div className="ki-label">Ausgaben</div>
                  <div className="ki-value-error">−{formatBetrag(ausgabenSumme)}</div>
                </div>
              </>
            )}
            {einnahmenSumme > 0 && (
              <>
                <div className="ki-divider" />
                <div>
                  <div className="ki-label">Einnahmen</div>
                  <div className="ki-value-success">+{formatBetrag(einnahmenSumme)}</div>
                </div>
              </>
            )}

            {/* Aktionen rechts */}
            <div className="ki-actions">
              <button
                onClick={() => { setStep('upload'); setError(null); }}
                className="ki-btn-secondary"
              >
                Neue Datei
              </button>
              <button
                onClick={handleImport}
                disabled={loading || selectedCount === 0}
                className="ki-btn-primary"
              >
                {loading ? <Loader size={14} className="ki-btn-spin" /> : <Check size={14} />}
                {selectedCount} Einträge importieren
              </button>
            </div>
          </div>

          {/* Hinweise zu erkannten Sonderfällen */}
          {(ruecklastschriftCount > 0 || zahllaufMatchCount > 0 || duplikatCount > 0) && (
            <div className="ki-badges-row">
              {ruecklastschriftCount > 0 && (
                <div className="ki-badge-error">
                  <AlertTriangle size={14} />
                  <strong>{ruecklastschriftCount} Rücklastschrift{ruecklastschriftCount > 1 ? 'en' : ''} erkannt</strong>
                  <span className="ki-opacity">— abgewählt. Bitte in der Rücklastschrift-Verwaltung anlegen.</span>
                  <button
                    onClick={() => navigate('/dashboard/ruecklastschriften')}
                    className="ki-badge-btn-error"
                  >
                    Zur Verwaltung
                  </button>
                </div>
              )}
              {zahllaufMatchCount > 0 && (
                <div className="ki-badge-warning">
                  <AlertCircle size={14} />
                  <strong>{zahllaufMatchCount} mögliche{zahllaufMatchCount > 1 ? '' : 'r'} Lastschriftlauf-Treffer</strong>
                  <span className="ki-opacity">— bitte prüfen, ob bereits erfasst.</span>
                </div>
              )}
              {duplikatCount > 0 && (
                <div className="ki-badge-muted">
                  <RotateCcw size={14} />
                  <strong>{duplikatCount} mögliche{duplikatCount > 1 ? '' : 'r'} Duplikat{duplikatCount > 1 ? 'e' : ''}</strong>
                  <span className="ki-opacity">— abgewählt.</span>
                </div>
              )}
            </div>
          )}

          {/* Filter-Tabs */}
          <div className="ki-filter-row">
            {[
              { key: 'all', label: `Alle (${transaktionen.length})` },
              { key: 'Ausgabe', label: `Ausgaben (${transaktionen.filter(tx => tx.typ === 'Ausgabe' && !tx.ruecklastschrift).length})` },
              { key: 'Einnahme', label: `Einnahmen (${transaktionen.filter(tx => tx.typ === 'Einnahme' && !tx.ruecklastschrift).length})` },
              ...(ruecklastschriftCount > 0 ? [{ key: 'Rücklastschrift', label: `Rücklastschriften (${ruecklastschriftCount})`, color: 'var(--error)' }] : [])
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`ki-filter-tab${filter === f.key ? (f.color ? ' ki-filter-tab--active-error' : ' ki-filter-tab--active') : ''}`}
              >
                {f.label}
              </button>
            ))}

            <label className="ki-select-all-label">
              <input
                type="checkbox"
                checked={allVisible}
                onChange={toggleAll}
              />
              Alle {filter === 'all' ? '' : filter + 'en '}auswählen
            </label>
          </div>

          {/* Transaktions-Tabelle */}
          <div className="ki-table-wrap">
            <table className="ki-table">
              <thead>
                <tr className="ki-thead-row">
                  <th className="ki-th-check"></th>
                  <th className="ki-th">Datum</th>
                  <th className="ki-th">Beschreibung</th>
                  <th className="ki-th-kategorie">Kategorie</th>
                  <th className="ki-th">Typ</th>
                  <th className="ki-th-betrag">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {transaktionen
                  .map((tx, origIdx) => ({ tx, origIdx }))
                  .filter(({ tx }) => {
                    if (filter === 'all') return true;
                    if (filter === 'Rücklastschrift') return tx.ruecklastschrift;
                    return tx.typ === filter && !tx.ruecklastschrift;
                  })
                  .map(({ tx, origIdx }) => (
                    <tr
                      key={origIdx}
                      className={`ki-tbody-row${selected[origIdx] ? ' ki-tbody-row--selected' : ''}`}
                    >
                      <td className="ki-td-check">
                        <input
                          type="checkbox"
                          checked={!!selected[origIdx]}
                          onChange={() => setSelected(s => ({ ...s, [origIdx]: !s[origIdx] }))}
                          className="ki-cursor-pointer"
                        />
                      </td>
                      <td className="ki-td-date">
                        {formatDatum(tx.datum)}
                      </td>
                      <td className="ki-td-desc">
                        <div className="ki-desc-badge-row">
                          {tx.ruecklastschrift && (
                            <span className="ki-pill-error">
                              ⚠ RÜCKLASTSCHRIFT
                            </span>
                          )}
                          {tx.zahllauf_match && (
                            <span className="ki-pill-warning" title={`Möglicher Lastschriftlauf ${tx.zahllauf_match.buchungsnummer} (${tx.zahllauf_match.betrag} €)`}>
                              ↔ Zahllauf {tx.zahllauf_match.buchungsnummer}
                            </span>
                          )}
                          {tx.duplikat && !tx.ruecklastschrift && (
                            <span className="ki-pill-muted">
                              DUPLIKAT?
                            </span>
                          )}
                        </div>
                        <div className="ki-desc-text" title={tx.beschreibung}>
                          {tx.beschreibung}
                        </div>
                        {tx.empfaenger && tx.empfaenger !== tx.beschreibung && (
                          <div className="ki-empfaenger">
                            {tx.empfaenger}
                          </div>
                        )}
                      </td>
                      <td className="ki-td">
                        {typen[origIdx] === 'Ausgabe' ? (
                          <select
                            value={kategorien[origIdx] || 'sonstiges'}
                            onChange={(e) => setKategorien(k => ({ ...k, [origIdx]: e.target.value }))}
                            disabled={!selected[origIdx]}
                            className="ki-select-kategorie"
                          >
                            {KATEGORIEN.map(k => (
                              <option key={k.key} value={k.key}>{k.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="ki-td-placeholder">—</span>
                        )}
                      </td>
                      <td className="ki-td">
                        {tx.ruecklastschrift ? (
                          <span className="ki-typ-badge-error">
                            Rücklastschrift
                          </span>
                        ) : (
                          <select
                            value={typen[origIdx] || tx.typ}
                            onChange={(e) => setTypen(t => ({ ...t, [origIdx]: e.target.value }))}
                            disabled={!selected[origIdx]}
                            className={`ki-typ-select${typen[origIdx] === 'Ausgabe' ? ' ki-typ-select--ausgabe' : ' ki-typ-select--einnahme'}`}
                          >
                            <option value="Ausgabe">Ausgabe</option>
                            <option value="Einnahme">Einnahme</option>
                          </select>
                        )}
                      </td>
                      <td
                        className={`ki-td-betrag${(tx.ruecklastschrift || typen[origIdx] === 'Ausgabe') ? ' ki-td-betrag--negativ' : ' ki-td-betrag--positiv'}`}
                      >
                        {tx.ruecklastschrift ? '−' : (typen[origIdx] === 'Ausgabe' ? '−' : '+')}{formatBetrag(tx.betrag)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Mobiler Hinweis */}
          <p className="ki-table-tip">
            Tipp: Nur ausgewählte (Häkchen) Einträge werden importiert. Kategorien können pro Zeile angepasst werden.
          </p>
        </div>
      )}

      {/* ── STEP: Fertig ── */}
      {step === 'done' && importResult && (
        <div className="ki-done-wrap">
          <div className="ki-done-card">
            <div className="ki-done-icon">
              <Check size={32} className="u-text-success" />
            </div>
            <h2 className="ki-done-title">
              Import abgeschlossen!
            </h2>
            <p className="ki-done-success">
              {importResult.importiert} Transaktionen importiert
            </p>
            {importResult.uebersprungen > 0 && (
              <p className="ki-done-warning">
                {importResult.uebersprungen} Rücklastschrift{importResult.uebersprungen > 1 ? 'en' : ''} übersprungen → bitte in der Rücklastschrift-Verwaltung anlegen
              </p>
            )}
            {importResult.fehler > 0 && (
              <p className="ki-done-error">
                {importResult.fehler} Einträge konnten nicht importiert werden
              </p>
            )}
            <p className="ki-done-hint">
              Die Einträge sind jetzt im Kassenbuch sichtbar.
            </p>
          </div>

          <div className="ki-done-actions">
            <button
              onClick={() => { setStep('upload'); setBank(null); setTransaktionen([]); setImportResult(null); setError(null); }}
              className="ki-done-btn-secondary"
            >
              Weitere Datei importieren
            </button>
            <button
              onClick={() => window.location.href = '/dashboard/ausgaben'}
              className="ki-done-btn-primary"
            >
              Zur Ausgabenverwaltung
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
