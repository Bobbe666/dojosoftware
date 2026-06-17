import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import VertragFormular from '../../VertragFormular';
import ZehnerkartenVerwaltung from '../../ZehnerkartenVerwaltung';
import MemberFamilyTab from "./MemberFamilyTab";
import NeuesMitgliedAnlegen from '../../NeuesMitgliedAnlegen';
import RatenzahlungTab from './RatenzahlungTab';
import { diagnoseIban, IBAN_LENGTHS } from '../../../utils/ibanValidator';

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function toInputDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toISOString().split('T')[0];
}

function translateBillingCycle(cycle) {
  if (!cycle) return '';
  const cycleMap = {
    monthly: 'Monatlich', monatlich: 'Monatlich',
    quarterly: 'Vierteljährlich', vierteljaehrlich: 'Vierteljährlich',
    'semi-annually': 'Halbjährlich', halbjaehrlich: 'Halbjährlich',
    annually: 'Jährlich', jaehrlich: 'Jährlich', yearly: 'Jährlich',
  };
  return cycleMap[cycle.toLowerCase()] || cycle;
}

// ── Interne Hilfskomponenten ─────────────────────────────────────────────────

function IbanDiagnostic({ iban }) {
  const d = diagnoseIban(iban || '');
  if (!d || d.iban.length < 5) return null;
  const cc = d.countryCode;
  const expected = IBAN_LENGTHS[cc];
  const actual = d.iban.length;
  const statusColor = d.ok ? '#4caf82' : '#e05c5c';
  return (
    <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', fontFamily: 'monospace', background: 'rgba(0,0,0,0.25)', borderRadius: '6px', padding: '0.5rem 0.75rem', border: `1px solid ${statusColor}33` }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: d.errors.length ? '0.4rem' : 0 }}>
        <span style={{ color: /^[A-Z]{2}$/.test(cc) && IBAN_LENGTHS[cc] ? '#4caf82' : '#e05c5c' }} title="Ländercode">{cc}</span>
        <span style={{ color: /^\d{2}$/.test(d.checkDigits) ? '#4caf82' : '#e05c5c' }} title="Prüfziffern">{d.checkDigits}</span>
        <span style={{ color: 'var(--ds-text-muted)' }} title="BBAN">{d.bban}</span>
        <span style={{ marginLeft: 'auto', color: statusColor, fontWeight: 600 }}>
          {d.ok ? '✓' : '✗'} {actual} Zch{expected ? ` / ${expected} erw.` : ''}
        </span>
      </div>
      {d.errors.map((e, i) => (
        <div key={i} style={{ color: '#e05c5c', marginTop: '0.2rem' }}>⚠ {e}</div>
      ))}
    </div>
  );
}

function IbanRechner({ onUebernehmen }) {
  const [blz, setBlz] = React.useState('');
  const [kto, setKto] = React.useState('');
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  const berechnen = async () => {
    if (!blz || !kto) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.post('/banken/kto-blz-to-iban', { kontonummer: kto, bankleitzahl: blz });
      setResult({ ok: true, ...res.data });
    } catch (e) {
      setResult({ ok: false, error: e.response?.data?.error || 'Fehler bei der Berechnung' });
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        style={{ marginTop: '0.5rem', fontSize: '0.78rem', background: 'none', border: '1px dashed rgba(212,175,55,0.4)', borderRadius: '6px', color: 'rgba(212,175,55,0.8)', padding: '0.3rem 0.6rem', cursor: 'pointer', width: '100%' }}>
        🔢 IBAN aus BLZ + Kontonummer berechnen
      </button>
    );
  }
  return (
    <div style={{ marginTop: '0.5rem', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.25)', borderRadius: '8px', padding: '0.75rem' }}>
      <div style={{ fontSize: '0.78rem', color: 'rgba(212,175,55,0.9)', marginBottom: '0.5rem', fontWeight: 600 }}>🔢 IBAN aus BLZ + Kontonummer berechnen</div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input placeholder="BLZ (8 Stellen)" value={blz} onChange={e => setBlz(e.target.value.replace(/\D/g, '').slice(0, 8))}
          style={{ flex: '1', minWidth: '110px', fontFamily: 'monospace', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: 'var(--ds-text)' }} />
        <input placeholder="Kontonummer" value={kto} onChange={e => setKto(e.target.value.replace(/\D/g, '').slice(0, 10))}
          style={{ flex: '1', minWidth: '110px', fontFamily: 'monospace', fontSize: '0.85rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', padding: '0.4rem 0.6rem', color: 'var(--ds-text)' }} />
        <button type="button" onClick={berechnen} disabled={loading || blz.length !== 8 || !kto}
          style={{ background: 'rgba(212,175,55,0.2)', border: '1px solid rgba(212,175,55,0.5)', borderRadius: '6px', color: '#d4af37', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
          {loading ? '…' : 'Berechnen'}
        </button>
      </div>
      {result && result.ok && (
        <div style={{ marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'monospace', color: '#4caf82', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '0.05em' }}>{result.iban}</span>
            {result.bic && result.bankname !== 'Unbekannte Bank' && (
              <span style={{ fontSize: '0.78rem', color: 'var(--ds-text-muted)' }}>{result.bankname} · {result.bic}</span>
            )}
            <button type="button" onClick={() => { onUebernehmen(result); setOpen(false); }}
              style={{ marginLeft: 'auto', background: 'rgba(76,175,130,0.2)', border: '1px solid rgba(76,175,130,0.5)', borderRadius: '6px', color: '#4caf82', padding: '0.3rem 0.7rem', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
              ✓ Übernehmen
            </button>
          </div>
          {(!result.bic || result.bankname === 'Unbekannte Bank') && (
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,200,100,0.8)', marginTop: '0.3rem' }}>
              ℹ IBAN korrekt berechnet. Bank nicht in Datenbank — BIC bitte manuell eintragen.
            </div>
          )}
        </div>
      )}
      {result && !result.ok && (
        <div style={{ marginTop: '0.4rem', color: '#e05c5c', fontSize: '0.78rem' }}>⚠ {result.error}</div>
      )}
      <button type="button" onClick={() => setOpen(false)} style={{ marginTop: '0.4rem', fontSize: '0.72rem', background: 'none', border: 'none', color: 'var(--ds-text-faint)', cursor: 'pointer', padding: 0 }}>Schließen</button>
    </div>
  );
}

function CustomSelect({ value, onChange, options, className = '', style = {}, disabled = false }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState('');
  const dropdownRef = React.useRef(null);

  React.useEffect(() => {
    const selected = options.find(opt => opt.value === value);
    setSelectedLabel(selected ? selected.label : '');
  }, [value, options]);

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } });
    setIsOpen(false);
  };

  return (
    <div className={`custom-select ${className} ${disabled ? 'disabled' : ''}`} ref={dropdownRef} style={style}>
      <div className="custom-select-trigger" onClick={() => !disabled && setIsOpen(!isOpen)}>
        <span>{selectedLabel || 'Bitte wählen...'}</span>
        <span className="custom-select-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && !disabled && (
        <div className="custom-select-options mitglied-detail-dropdown">
          {options.map((option) => (
            <div key={option.value} className={`custom-select-option mitglied-detail-dropdown-option ${option.value === value ? 'selected' : ''}`} onClick={() => handleSelect(option.value)}>
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MitgliedVerkaufsCard({ mitgliedId, activeDojo }) {
  const dojoId = activeDojo?.id || null;
  const { data: list = [] } = useQuery({
    queryKey: ['verkaeufe', mitgliedId, dojoId],
    queryFn: async () => {
      const dojoParam = dojoId ? `&dojo_id=${dojoId}` : '';
      const res = await axios.get(`/verkaeufe?mitglied_id=${mitgliedId}&limit=100${dojoParam}`);
      return Array.isArray(res.data) ? res.data : (res.data.data || res.data.verkaeufe || []);
    },
    enabled: !!mitgliedId,
    staleTime: 5 * 60 * 1000,
  });
  const total = list.reduce((s, v) => s + (v.brutto_gesamt_cent || 0), 0);
  const offen = list.filter(v => v.zahlungsstatus === 'offen').reduce((s, v) => s + (v.brutto_gesamt_cent || 0), 0);
  const data = list.length > 0 ? { count: list.length, total, offen } : null;
  if (!data || data.count === 0) return null;
  const fmtEur = c => (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
  return (
    <div className="finance-kpi-card mds-kpi-card-info">
      <div className="mds-flex-row-mb"><span className="mds2-fs-2">🛒</span><h4 className="mds2-label-bold">Artikel-Einkäufe</h4></div>
      <div className="mds2-stat-value" style={{ fontSize: '1.5rem', fontWeight: 700 }}>{fmtEur(data.total)}</div>
      <div className="mds-text-secondary-sm">{data.count} Kauf{data.count !== 1 ? 'käufe' : ''}{data.offen > 0 && <span style={{ color: '#fca5a5', marginLeft: 8 }}>· {fmtEur(data.offen)} offen</span>}</div>
    </div>
  );
}

function MitgliedEinkäufeTab({ mitgliedId, activeDojo }) {
  const dojoId = activeDojo?.id || null;
  const [expandedId, setExpandedId] = useState(null);
  const [positionen, setPositionen] = useState({});
  const { data: verkaeufe = [], isLoading: loading } = useQuery({
    queryKey: ['verkaeufe', mitgliedId, dojoId],
    queryFn: async () => {
      const dojoParam = dojoId ? `&dojo_id=${dojoId}` : '';
      const res = await axios.get(`/verkaeufe?mitglied_id=${mitgliedId}&limit=100${dojoParam}`);
      return Array.isArray(res.data) ? res.data : (res.data.data || res.data.verkaeufe || []);
    },
    enabled: !!mitgliedId,
    staleTime: 5 * 60 * 1000,
  });
  const toggleExpand = async (verkaufId) => {
    if (expandedId === verkaufId) { setExpandedId(null); return; }
    setExpandedId(verkaufId);
    if (!positionen[verkaufId]) {
      try {
        const res = await axios.get(`/verkaeufe/${verkaufId}`);
        setPositionen(prev => ({ ...prev, [verkaufId]: (res.data.data?.positionen || res.data.positionen) || [] }));
      } catch {}
    }
  };
  const fmt = ts => ts ? new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const fmtEur = cent => (cent / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
  const zahlungsLabel = { bar: 'Bar', karte: 'Karte', sumup: 'SumUp', digital: 'Digital', lastschrift: 'Lastschrift' };
  const statusColor = { offen: '#fca5a5', in_einzug: '#fbbf24', eingezogen: '#86efac', bezahlt: '#86efac' };
  const s = {
    wrap: { borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', marginBottom: 10 },
    row: { display: 'grid', gridTemplateColumns: '1fr 90px 100px 28px', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', userSelect: 'none', minWidth: 0 },
    badge: { fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', color: 'var(--ds-text-secondary)', whiteSpace: 'nowrap', textAlign: 'center' },
    amount: { fontWeight: 700, color: '#ffd700', fontSize: 15, textAlign: 'right', whiteSpace: 'nowrap' },
    arrow: { color: 'var(--ds-text-muted)', fontSize: 12, textAlign: 'right' },
    expanded: { borderTop: '1px solid rgba(255,255,255,0.07)', padding: '12px 16px', background: 'rgba(0,0,0,0.2)' },
    posRow: { display: 'grid', gridTemplateColumns: '1fr 36px 80px 80px', gap: 8, padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 13, alignItems: 'center' },
    posHeader: { display: 'grid', gridTemplateColumns: '1fr 36px 80px 80px', gap: 8, padding: '4px 0 6px', fontSize: 11, color: 'var(--ds-text-muted)', fontWeight: 500 },
  };
  return (
    <div style={{ padding: '4px 0' }}>
      <h3 className="mds2-section-heading" style={{ marginBottom: '1rem' }}>🛒 Artikel-Einkäufe</h3>
      {loading ? <div className="info-box"><p>Lade...</p></div>
        : verkaeufe.length === 0 ? <div className="info-box"><p>ℹ️ Noch keine Artikel-Einkäufe vorhanden.</p></div>
        : verkaeufe.map(v => {
          const betrag = v.brutto_gesamt_euro != null ? parseFloat(v.brutto_gesamt_euro) * 100 : v.brutto_gesamt_cent;
          const isOpen = expandedId === v.verkauf_id;
          return (
            <div key={v.verkauf_id} style={s.wrap}>
              <div style={s.row} onClick={() => toggleExpand(v.verkauf_id)}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ds-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Bon #{v.bon_nummer || v.verkauf_id}</div>
                  <div style={{ fontSize: 12, color: 'var(--ds-text-muted)', marginTop: 2 }}>
                    {fmt(v.verkauf_datum || v.verkauf_timestamp)}
                    {v.zahlungsstatus && <span style={{ marginLeft: 8, color: statusColor[v.zahlungsstatus] || 'rgba(255,255,255,0.4)' }}>{v.zahlungsstatus === 'offen' ? '● Offen' : v.zahlungsstatus === 'in_einzug' ? '● In Einzug' : '✓ ' + v.zahlungsstatus}</span>}
                  </div>
                </div>
                <span style={s.badge}>{zahlungsLabel[v.zahlungsart] || v.zahlungsart || '—'}</span>
                <div style={s.amount}>{fmtEur(betrag)}</div>
                <div style={s.arrow}>{isOpen ? '▲' : '▼'}</div>
              </div>
              {isOpen && (
                <div style={s.expanded}>
                  {positionen[v.verkauf_id] === undefined ? <div style={{ fontSize: 13, color: 'var(--ds-text-muted)' }}>Lade…</div>
                    : positionen[v.verkauf_id].length === 0 ? <div style={{ fontSize: 13, color: 'var(--ds-text-muted)' }}>Keine Positionen.</div>
                    : <>
                      <div style={s.posHeader}><span>Artikel</span><span style={{ textAlign: 'center' }}>Menge</span><span style={{ textAlign: 'right' }}>Einzelpreis</span><span style={{ textAlign: 'right' }}>Gesamt</span></div>
                      {positionen[v.verkauf_id].map((pos, i) => (
                        <div key={i} style={s.posRow}>
                          <span style={{ color: 'var(--ds-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pos.artikel_name || pos.name}{pos.rabatt_prozent > 0 && <span style={{ color: '#4ade80', marginLeft: 6, fontSize: 11 }}>-{pos.rabatt_prozent}%</span>}</span>
                          <span style={{ textAlign: 'center', color: 'var(--ds-text-muted)' }}>{pos.menge}×</span>
                          <span style={{ textAlign: 'right', color: 'var(--ds-text-muted)' }}>{(pos.einzelpreis_cent / 100).toFixed(2)} €</span>
                          <span style={{ textAlign: 'right', color: '#ffd700', fontWeight: 600 }}>{(pos.brutto_cent / 100).toFixed(2)} €</span>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 6, paddingTop: 8, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--ds-text-muted)' }}>Gesamt</span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#ffd700' }}>{fmtEur(betrag)}</span>
                      </div>
                    </>}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

function MitgliedGutscheineTab({ mitgliedId, activeDojo }) {
  const dojoId = activeDojo?.id || null;
  const [gutscheine, setGutscheine] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!mitgliedId) return;
    const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
    axios.get(`/gutscheine/mitglied/${mitgliedId}${dojoParam}`)
      .then(r => setGutscheine(r.data.gutscheine || []))
      .catch(() => setGutscheine([]))
      .finally(() => setLoading(false));
  }, [mitgliedId, dojoId]);
  const fmtDate = d => d ? new Date(d).toLocaleDateString('de-DE') : '—';
  return (
    <div style={{ padding: '4px 0' }}>
      <h3 className="mds2-section-heading" style={{ marginBottom: '1rem' }}>🎁 Gutscheine</h3>
      {loading ? <div className="info-box"><p>Lade...</p></div>
        : gutscheine.length === 0 ? <div className="info-box"><p>ℹ️ Keine Gutscheine vorhanden.</p></div>
        : gutscheine.map(g => {
          const wert_cent = Math.round(parseFloat(g.wert) * 100);
          const restbetrag_cent = Math.max(0, wert_cent - (g.verbraucht_cent || 0));
          const abgelaufen = g.gueltig_bis && new Date(g.gueltig_bis) < new Date();
          const prozent = Math.round((restbetrag_cent / wert_cent) * 100);
          return (
            <div key={g.id} style={{ borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', marginBottom: 10, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: '#f97316', letterSpacing: 2 }}>{g.code}</span>
                <span style={{ fontSize: 13, color: g.eingeloest ? 'rgba(255,255,255,0.4)' : abgelaufen ? '#f87171' : '#4ade80', fontWeight: 600 }}>{g.eingeloest ? 'Eingelöst' : abgelaufen ? 'Abgelaufen' : 'Aktiv'}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--ds-text-secondary)', marginBottom: 8 }}>{g.titel}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: 'var(--ds-text-muted)' }}>Restwert</span>
                <span style={{ fontWeight: 700, color: '#4ade80' }}>{(restbetrag_cent / 100).toFixed(2)} € / {(wert_cent / 100).toFixed(2)} €</span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${prozent}%`, background: g.eingeloest ? 'rgba(255,255,255,0.2)' : '#4ade80', borderRadius: 999 }} />
              </div>
              {g.gueltig_bis && <div style={{ fontSize: 11, color: 'var(--ds-text-muted)', marginTop: 6 }}>Gültig bis {fmtDate(g.gueltig_bis)}</div>}
            </div>
          );
        })}
    </div>
  );
}

// ── VertragAnpassungSektion ───────────────────────────────────────────────────

function VertragAnpassungSektion({ vertrag, mitglied, vertragAnpassungen, setVertragAnpassungen, vertragAnpassungForm, setVertragAnpassungForm, editingAnpassungId, setEditingAnpassungId }) {
  const [open, setOpen] = React.useState(true);
  const [showNewForm, setShowNewForm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [localForm, setLocalForm] = React.useState({ typ: 'schueler', neuer_betrag: '', gueltig_von: '', gueltig_bis: '', grund: '' });
  const [localEdit, setLocalEdit] = React.useState({});
  const [mails, setMails] = React.useState([]);
  const mid = mitglied?.mitglied_id || mitglied?.id;
  const loadAnpassungen = async () => {
    try {
      const r = await axios.get(`/vertrag-anpassungen/mitglied/${mid}`);
      setVertragAnpassungen(r.data.anpassungen || []);
    } catch {}
  };
  const loadMails = async () => {
    try {
      const r = await axios.get(`/vertrag-anpassungen/mitglied/${mid}/mail-log`);
      setMails(r.data.mails || []);
    } catch {}
  };
  const viewMail = (m) => {
    const w = window.open('', '_blank');
    if (!w) { alert('Bitte Popups erlauben, um die E-Mail anzuzeigen.'); return; }
    w.document.write(m.html || `<pre style="font-family:sans-serif;white-space:pre-wrap;padding:1rem">${(m.text_inhalt || '').replace(/</g, '&lt;')}</pre>`);
    w.document.close();
  };
  React.useEffect(() => { if (mid) { loadAnpassungen(); loadMails(); } }, [mid]);
  const handleOpen = async () => { if (!open) await loadAnpassungen(); setOpen(v => !v); };
  const typLabels = { schueler: 'Schüler', student: 'Student', azubi: 'Azubi', rentner: 'Rentner', sonstiges: 'Sonstiges', ruhepause: 'Ruhepause' };
  const statusColors = { genehmigt: '#4caf50', beantragt: '#ff9800', abgelehnt: '#f44336', abgelaufen: '#888' };
  const today = new Date().toISOString().slice(0, 10);
  const aktive = vertragAnpassungen.filter(a => a.status === 'genehmigt' && a.gueltig_bis >= today);
  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
      <button onClick={handleOpen} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.82rem', padding: '0 0 0.25rem 0' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          🎓 <strong style={{ color: 'var(--text-primary)' }}>Vertragsanpassungen</strong>
          {aktive.length > 0 && <span style={{ background: '#4caf5022', color: '#4caf50', borderRadius: 10, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 600 }}>{aktive.length} aktiv</span>}
        </span>
        <span style={{ fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {vertragAnpassungen.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Keine Anpassungen vorhanden.</p>}
          {vertragAnpassungen.map(a => {
            const isEditing = editingAnpassungId === a.id;
            const edit = localEdit[a.id] || { typ: a.typ, neuer_betrag: a.neuer_betrag, gueltig_von: a.gueltig_von?.slice(0,10), gueltig_bis: a.gueltig_bis?.slice(0,10), grund: a.grund || '' };
            return (
              <div key={a.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.6rem 0.8rem', border: `1px solid ${statusColors[a.status] || '#555'}30`, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{typLabels[a.typ] || a.typ}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>{new Date(a.gueltig_von).toLocaleDateString('de-DE')} – {new Date(a.gueltig_bis).toLocaleDateString('de-DE')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{parseFloat(a.neuer_betrag).toFixed(2).replace('.', ',')} €</span>
                    <span style={{ background: `${statusColors[a.status] || '#555'}18`, color: statusColors[a.status] || '#888', padding: '1px 7px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 600 }}>{a.status}</span>
                    {a.status === 'beantragt' && (<>
                      <button onClick={async () => { if (!window.confirm(`${typLabels[a.typ] || a.typ}-Antrag bestätigen/genehmigen? Das Mitglied erhält eine Bestätigungs-E-Mail.`)) return; try { await axios.put(`/vertrag-anpassungen/${a.id}/genehmigen`, {}); await loadAnpassungen(); } catch (err) { alert('Fehler: ' + (err.response?.data?.error || err.message)); } }} style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(76,175,80,0.12)', border: '1px solid #4caf50', color: '#4caf50', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>✓ Bestätigen</button>
                      <button onClick={async () => { const grund = window.prompt('Grund für die Ablehnung (wird dem Mitglied per E-Mail mitgeteilt):', ''); if (grund === null) return; try { await axios.put(`/vertrag-anpassungen/${a.id}/ablehnen`, { anmerkung_admin: grund }); await loadAnpassungen(); } catch (err) { alert('Fehler: ' + (err.response?.data?.error || err.message)); } }} style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(244,67,54,0.12)', border: '1px solid #f44336', color: '#f44336', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}>✕ Ablehnen</button>
                    </>)}
                    {a.status === 'genehmigt' && (<>
                      <button onClick={() => { if (isEditing) { setEditingAnpassungId(null); return; } setEditingAnpassungId(a.id); setLocalEdit(prev => ({ ...prev, [a.id]: { typ: a.typ, neuer_betrag: a.neuer_betrag, gueltig_von: a.gueltig_von?.slice(0,10), gueltig_bis: a.gueltig_bis?.slice(0,10), grund: a.grund || '' } })); }} style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem' }}>{isEditing ? '✕' : '✏️'}</button>
                      <button onClick={async () => { try { const r2 = await axios.post(`/vertrag-anpassungen/${a.id}/neu-anwenden`); await loadAnpassungen(); alert(`✓ ${r2.data.angepasste_beitraege} Beitrag/Beiträge aktualisiert.`); } catch (err) { alert('Fehler: ' + (err.response?.data?.error || err.message)); } }} style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', cursor: 'pointer', fontSize: '0.75rem' }}>🔄</button>
                    </>)}
                  </div>
                </div>
                {isEditing && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.2rem' }}>
                    {[{ label: 'Typ', key: 'typ', type: 'select' }, { label: 'Betrag (€)', key: 'neuer_betrag', type: 'number' }, { label: 'Gültig von', key: 'gueltig_von', type: 'date' }, { label: 'Gültig bis', key: 'gueltig_bis', type: 'date' }].map(({ label, key, type }) => (
                      <div key={key}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
                        {type === 'select' ? (
                          <select value={edit[key]} onChange={e => setLocalEdit(prev => ({ ...prev, [a.id]: { ...edit, [key]: e.target.value } }))} style={{ width: '100%', padding: '0.35rem', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                            <option value="schueler">Schüler</option><option value="student">Student</option><option value="azubi">Azubi</option><option value="rentner">Rentner</option><option value="sonstiges">Sonstiges</option>
                          </select>
                        ) : (
                          <input type={type} step={type === 'number' ? '0.01' : undefined} value={edit[key]} onChange={e => setLocalEdit(prev => ({ ...prev, [a.id]: { ...edit, [key]: e.target.value } }))} style={{ width: '100%', padding: '0.35rem', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                        )}
                      </div>
                    ))}
                    <div style={{ gridColumn: '1/-1' }}><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Grund</div><input type="text" value={edit.grund} onChange={e => setLocalEdit(prev => ({ ...prev, [a.id]: { ...edit, grund: e.target.value } }))} style={{ width: '100%', padding: '0.35rem', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: '0.82rem' }} /></div>
                    <div style={{ gridColumn: '1/-1' }}><button onClick={async () => { try { await axios.put(`/vertrag-anpassungen/${a.id}`, { typ: edit.typ, neuer_betrag: parseFloat(edit.neuer_betrag), gueltig_von: edit.gueltig_von, gueltig_bis: edit.gueltig_bis, grund: edit.grund || null }); await loadAnpassungen(); setEditingAnpassungId(null); } catch (err) { alert('Fehler: ' + (err.response?.data?.error || err.message)); } }} style={{ width: '100%', padding: '0.4rem', borderRadius: 5, background: 'rgba(76,175,80,0.12)', border: '1px solid #4caf50', color: '#4caf50', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>✓ Speichern</button></div>
                  </div>
                )}
              </div>
            );
          })}
          {!showNewForm ? (
            <button onClick={() => { setShowNewForm(true); setLocalForm({ typ: 'schueler', neuer_betrag: '', gueltig_von: '', gueltig_bis: '', grund: '' }); setError(''); }} style={{ padding: '0.4rem 0.8rem', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', alignSelf: 'flex-start' }}>+ Neue Anpassung</button>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Neue Vertragsanpassung</span>
                <button onClick={() => setShowNewForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1rem' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                {[{ label: 'Typ', key: 'typ', type: 'select' }, { label: 'Neuer Betrag (€)', key: 'neuer_betrag', type: 'number' }, { label: 'Gültig von', key: 'gueltig_von', type: 'date' }, { label: 'Gültig bis', key: 'gueltig_bis', type: 'date' }].map(({ label, key, type }) => (
                  <div key={key}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
                    {type === 'select' ? (
                      <select value={localForm[key]} onChange={e => setLocalForm(f => ({ ...f, [key]: e.target.value }))} style={{ width: '100%', padding: '0.35rem', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                        <option value="schueler">Schüler</option><option value="student">Student</option><option value="azubi">Azubi</option><option value="rentner">Rentner</option><option value="sonstiges">Sonstiges</option>
                      </select>
                    ) : (
                      <input type={type} step={type === 'number' ? '0.01' : undefined} value={localForm[key]} onChange={e => setLocalForm(f => ({ ...f, [key]: e.target.value }))} style={{ width: '100%', padding: '0.35rem', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                    )}
                  </div>
                ))}
                <div style={{ gridColumn: '1/-1' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Grund (optional)</div>
                  <input type="text" value={localForm.grund} onChange={e => setLocalForm(f => ({ ...f, grund: e.target.value }))} style={{ width: '100%', padding: '0.35rem', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                </div>
              </div>
              {error && <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>{error}</div>}
              <button disabled={loading} onClick={async () => {
                if (!localForm.neuer_betrag || !localForm.gueltig_von || !localForm.gueltig_bis) { setError('Bitte Betrag, Beginn und Ende ausfüllen.'); return; }
                setLoading(true); setError('');
                try {
                  const dojoParam = mitglied?.dojo_id ? `?dojo_id=${mitglied.dojo_id}` : '';
                  await axios.post(`/vertrag-anpassungen${dojoParam}`, { mitglied_id: mid, typ: localForm.typ, alter_betrag: vertrag.monatsbeitrag || 0, neuer_betrag: parseFloat(localForm.neuer_betrag), gueltig_von: localForm.gueltig_von, gueltig_bis: localForm.gueltig_bis, grund: localForm.grund || null });
                  await loadAnpassungen(); setShowNewForm(false);
                } catch (err) { setError(err.response?.data?.error || err.message || 'Fehler'); }
                finally { setLoading(false); }
              }} style={{ padding: '0.45rem', borderRadius: 5, background: 'rgba(76,175,80,0.12)', border: '1px solid #4caf50', color: '#4caf50', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                {loading ? '⏳ Speichern…' : '✓ Anpassung speichern'}
              </button>
            </div>
          )}
        </div>
      )}
      {mails.length > 0 && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            ✉️ <strong style={{ color: 'var(--text-primary)' }}>Gesendete E-Mails</strong>
            <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 7px', fontSize: '0.72rem' }}>{mails.length}</span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>(rechtssicheres Archiv)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {mails.map(m => (
              <div key={m.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.55rem 0.75rem', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.betreff}</div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                    {m.gesendet_am ? new Date(m.gesendet_am).toLocaleString('de-DE') : '–'} · {m.empfaenger}
                    {m.status && m.status !== 'gesendet' && <span style={{ color: '#f44336', marginLeft: 6 }}>({m.status})</span>}
                  </div>
                </div>
                <button onClick={() => viewMail(m)} style={{ padding: '3px 10px', borderRadius: 5, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600, whiteSpace: 'nowrap' }}>Ansehen</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

const MitgliedschaftTab = ({
  mitglied, updatedData, handleChange, editMode, isAdmin, id, activeDojo,
  verträge, setVerträge, tarife, zahlungszyklen,
  beitraege, setBeitraege,
  sepaMandate, setSepaMandate, archivierteMandate, setArchivierteMandate,
  generatingMandate, setGeneratingMandate,
  lsEinverstaendnis, setLsEinverstaendnis,
  ruecklastschriftenStats, setRuecklastschriftenStats,
  aktiverRatenplan, setAktiverRatenplan,
  setLoading, setActiveTab, user,
}) => {
  // ── Interner State ──────────────────────────────────────────────────────────
  const [mitgliedschaftSubTab, setMitgliedschaftSubTab] = useState('vertrag');
  const [financeSubTab, setFinanceSubTab] = useState('beitraege');
  const [showFamilyMemberModal, setShowFamilyMemberModal] = useState(false);
  const [beitraegeViewMode, setBeitraegeViewMode] = useState('monat');
  const [collapsedPeriods, setCollapsedPeriods] = useState({});
  const [expandedBeitraege, setExpandedBeitraege] = useState({});
  const [openYears, setOpenYears] = useState(new Set([new Date().getFullYear()]));
  const [showNewVertrag, setShowNewVertrag] = useState(false);
  const [editingVertrag, setEditingVertrag] = useState(null);
  const [showVertragDetails, setShowVertragDetails] = useState(false);
  const [showStructuredDetails, setShowStructuredDetails] = useState(false);
  const [selectedVertrag, setSelectedVertrag] = useState(null);
  const [showKündigungModal, setShowKündigungModal] = useState(false);
  const [showKündigungBestätigungModal, setShowKündigungBestätigungModal] = useState(false);
  const [vertragZumKündigen, setVertragZumKündigen] = useState(null);
  const [kuendigungsgrund, setKündigungsgrund] = useState('');
  const [kuendigungsbestätigung, setKündigungsbestätigung] = useState(false);
  const [kuendigungsdatum, setKündigungsdatum] = useState('');
  const [showRuhepauseModal, setShowRuhepauseModal] = useState(false);
  const [ruhepauseDauer, setRuhepauseDauer] = useState(1);
  const [showVertragAnpassungModal, setShowVertragAnpassungModal] = useState(false);
  const [vertragAnpassungen, setVertragAnpassungen] = useState([]);
  const [vertragAnpassungForm, setVertragAnpassungForm] = useState({ typ: 'student', neuer_betrag: '', gueltig_von: '', gueltig_bis: '', grund: '' });
  const [vertragAnpassungLoading, setVertragAnpassungLoading] = useState(false);
  const [vertragAnpassungError, setVertragAnpassungError] = useState('');
  const [editingAnpassungId, setEditingAnpassungId] = useState(null);
  const [newVertrag, setNewVertrag] = useState(() => {
    const heute = new Date();
    const in12Monaten = new Date(heute);
    in12Monaten.setMonth(heute.getMonth() + 12);
    return { tarif_id: '', status: 'aktiv', billing_cycle: '', payment_method: 'direct_debit', vertragsbeginn: heute.toISOString().split('T')[0], vertragsende: in12Monaten.toISOString().split('T')[0], kuendigungsfrist_monate: 3, mindestlaufzeit_monate: 12, automatische_verlaengerung: true, verlaengerung_monate: 12, faelligkeit_tag: 1, sepa_mandat_id: null, agb_akzeptiert: false, agb_version: '1.0', datenschutz_akzeptiert: false, datenschutz_version: '1.0', hausordnung_akzeptiert: false, haftungsausschluss_akzeptiert: false, gesundheitserklaerung: false, foto_einverstaendnis: false };
  });
  const [vertragsfreiModal, setVertragsfreiModal] = useState(null);
  const [vertragsfreiForm, setVertragsfreiForm] = useState({ grund: '', ab: new Date().toISOString().split('T')[0], beitraege_aktion: 'behalten' });
  const [vertragsfreiError, setVertragsfreiError] = useState('');
  const [selectedVertragForAction, setSelectedVertragForAction] = useState(null);

  // ── Handler ─────────────────────────────────────────────────────────────────

  const fetchFinanzDaten = async (signal = null) => {
    try {
      const cfg = { params: { mitglied_id: id } };
      if (signal) cfg.signal = signal;
      const [beitraegeRes, ratenplanRes] = await Promise.all([
        axios.get('/beitraege', cfg),
        axios.get(`/rechnungen/ratenplan/${id}`, signal ? { signal } : {}).catch(() => null)
      ]);
      setBeitraege(beitraegeRes.data);
      if (ratenplanRes?.data?.success && ratenplanRes.data.plan) {
        setAktiverRatenplan(ratenplanRes.data.plan);
      } else {
        setAktiverRatenplan(null);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && err.code !== 'ERR_CANCELED') {
        console.error('Fehler Finanzdaten:', err);
      }
    }
  };

  const loadSepaMandate = async (signal = null) => {
    try {
      const response = await axios.get(`/mitglieder/${id}/sepa-mandate`, signal ? { signal } : {});
      setSepaMandate(response.data);
    } catch (error) {
      if (error.name !== 'AbortError' && error.code !== 'ERR_CANCELED') {
        if (error.response?.status !== 404) console.error('Fehler SEPA-Mandat:', error);
      }
    }
  };

  const loadArchivierteMandate = async (signal = null) => {
    try {
      const response = await axios.get(`/mitglieder/${id}/sepa-mandate/archiv`, signal ? { signal } : {});
      setArchivierteMandate(response.data);
    } catch (error) {
      if (error.name !== 'AbortError' && error.code !== 'ERR_CANCELED') {
        console.error('Fehler archivierte Mandate:', error);
      }
    }
  };

  const fetchLsEinverstaendnis = async () => {
    if (!id) return;
    try {
      const dojoParam = activeDojo?.id ? `?dojo_id=${activeDojo.id}` : '';
      const res = await axios.get(`/lastschrift-einverstaendnis${dojoParam}`);
      const found = (res.data.data || []).find(m => m.mitglied_id === parseInt(id, 10));
      setLsEinverstaendnis(found ? { status: found.einverstaendnis_status, angefragt_am: found.angefragt_am, beantwortet_am: found.beantwortet_am, kanal: found.kanal, notiz: found.notiz } : null);
    } catch { /* ignore */ }
  };

  const fetchRuecklastschriftenStats = async () => {
    if (!id) return;
    try {
      const dojoParam = activeDojo?.id ? `?dojo_id=${activeDojo.id}` : '';
      const res = await axios.get(`/mitglieder/${id}/ruecklastschriften-stats${dojoParam}`);
      if (res.data?.success) setRuecklastschriftenStats(res.data.stats);
    } catch { /* ignore */ }
  };

  const fetchVerträge = async (signal = null) => {
    if (!mitglied || !mitglied.mitglied_id) return;
    try {
      const cfg = { params: { mitglied_id: mitglied.mitglied_id } };
      if (signal) cfg.signal = signal;
      const response = await axios.get('/vertraege', cfg);
      const data = response.data;
      if (data.success && data.data) {
        const filteredData = data.data.filter(v => v.mitglied_id === mitglied.mitglied_id).sort((a, b) => a.id - b.id).map((v, i) => ({ ...v, personenVertragNr: i + 1 }));
        const verträgeData = filteredData.sort((a, b) => {
          if (a.kuendigung_eingegangen && !b.kuendigung_eingegangen) return 1;
          if (!a.kuendigung_eingegangen && b.kuendigung_eingegangen) return -1;
          return a.id - b.id;
        });
        setVerträge(verträgeData);
      } else {
        setVerträge([]);
      }
    } catch (error) {
      if (error.name !== 'AbortError' && error.code !== 'ERR_CANCELED') {
        console.error('Fehler Verträge:', error);
        setVerträge([]);
      }
    }
  };

  const generateSepaMandate = async () => {
    if (!mitglied?.iban || !mitglied?.bic) { alert('Bitte vervollständigen Sie zuerst die Bankdaten (IBAN und BIC).'); return; }
    setGeneratingMandate(true);
    try {
      const response = await axios.post(`/mitglieder/${id}/sepa-mandate`, { iban: mitglied?.iban, bic: mitglied?.bic, kontoinhaber: mitglied?.kontoinhaber || `${mitglied?.vorname} ${mitglied?.nachname}`, bankname: mitglied?.bankname });
      setSepaMandate(response.data);
    } catch (error) { console.error('Fehler SEPA-Mandat erstellen:', error); }
    setGeneratingMandate(false);
  };

  const downloadSepaMandate = async () => {
    try {
      const response = await axios.get(`/mitglieder/${id}/sepa-mandate/download`, { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SEPA-Mandat_${mitglied?.nachname}_${mitglied?.vorname}.pdf`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch (error) { console.error('Fehler SEPA-Mandat Download:', error); }
  };

  const revokeSepaMandate = async () => {
    if (confirm('Möchten Sie das SEPA-Mandat wirklich widerrufen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      try {
        await axios.delete(`/mitglieder/${id}/sepa-mandate`);
        setSepaMandate(null);
        loadArchivierteMandate();
      } catch (error) { console.error('Fehler SEPA-Mandat widerrufen:', error); }
    }
  };

  const downloadVertragPDF = async (vertragId) => {
    try {
      const response = await axios.get(`/vertraege/${vertragId}/pdf`, { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const pdfWindow = window.open('', '_blank');
      if (pdfWindow) pdfWindow.location.href = url;
      const a = document.createElement('a');
      a.href = url; a.download = `Vertrag_${mitglied?.nachname}_${mitglied?.vorname}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (error) { console.error('Fehler Vertrag PDF:', error); alert('Fehler beim Download des Vertrags.'); }
  };

  const handleVertragAction = async (vertragId, action) => {
    if (setLoading) setLoading(true);
    try {
      const vertrag = verträge.find(v => v.id === vertragId);
      setSelectedVertragForAction(vertrag);
      switch (action) {
        case 'kündigen':
          setKündigungsdatum(new Date().toISOString().split('T')[0]);
          setShowKündigungModal(true); break;
        case 'ruhepause':
          setShowRuhepauseModal(true); break;
        case 'reaktivieren':
          if (window.confirm('Möchten Sie den Vertrag reaktivieren?')) {
            await axios.put(`/vertraege/${vertragId}`, { status: 'aktiv', ruhepause_von: null, ruhepause_bis: null, ruhepause_dauer_monate: null, dojo_id: mitglied?.dojo_id });
            await fetchVerträge();
          }
          break;
        default: break;
      }
    } catch (error) { console.error('Fehler Vertragsaktion:', error); }
    finally { if (setLoading) setLoading(false); }
  };

  const handleRuhepauseConfirm = async () => {
    if (!selectedVertragForAction) return;
    if (setLoading) setLoading(true);
    try {
      const ruhepauseVon = new Date(); ruhepauseVon.setMonth(ruhepauseVon.getMonth() + 1); ruhepauseVon.setDate(1);
      const ruhepauseBis = new Date(); ruhepauseBis.setMonth(ruhepauseBis.getMonth() + 1 + ruhepauseDauer); ruhepauseBis.setDate(0);
      await axios.put(`/vertraege/${selectedVertragForAction.id}`, { status: 'ruhepause', ruhepause_von: ruhepauseVon.toISOString().split('T')[0], ruhepause_bis: ruhepauseBis.toISOString().split('T')[0], ruhepause_dauer_monate: ruhepauseDauer, dojo_id: mitglied?.dojo_id });
      setShowRuhepauseModal(false); setSelectedVertragForAction(null); setRuhepauseDauer(1);
      await fetchVerträge();
    } catch (error) { console.error('Fehler Ruhepause:', error); alert('Fehler beim Setzen der Ruhepause.'); }
    finally { if (setLoading) setLoading(false); }
  };

  const handleKündigungConfirm = async () => {
    if (!selectedVertragForAction || !kuendigungsbestätigung) return;
    if (setLoading) setLoading(true);
    try {
      const kDatum = kuendigungsdatum || new Date().toISOString().split('T')[0];
      await axios.put(`/vertraege/${selectedVertragForAction.id}`, { status: 'gekuendigt', kuendigung_eingegangen: kDatum, kuendigungsgrund: kuendigungsgrund, dojo_id: mitglied?.dojo_id });
      setShowKündigungModal(false); setSelectedVertragForAction(null); setKündigungsgrund(''); setKündigungsbestätigung(false); setKündigungsdatum('');
      await fetchVerträge();
    } catch (error) { console.error('Fehler Kündigung:', error); alert('Fehler beim Kündigen des Vertrags.'); }
    finally { if (setLoading) setLoading(false); }
  };

  const handleKündigungAufheben = async (vertrag) => {
    if (window.confirm(`Möchten Sie die Kündigung von Vertrag #${vertrag.personenVertragNr} wirklich aufheben?`)) {
      try {
        await axios.put(`/vertraege/${vertrag.id}`, { status: 'aktiv', kuendigung_eingegangen: null, kuendigungsgrund: null, kuendigungsdatum: null, dojo_id: mitglied?.dojo_id });
        await fetchVerträge();
      } catch (error) { console.error('Fehler Kündigung aufheben:', error); alert('Fehler beim Aufheben der Kündigung.'); }
    }
  };

  const handleKündigungBestätigen = async () => {
    if (!vertragZumKündigen) return;
    try {
      await axios.put(`/vertraege/${vertragZumKündigen.id}/kuendigen`, { kuendigungsdatum: new Date().toISOString().split('T')[0], kuendigung_eingegangen: new Date().toISOString().split('T')[0], status: 'gekuendigt' });
      alert('✅ Vertrag wurde erfolgreich gekündigt und archiviert.');
      setShowKündigungBestätigungModal(false); setVertragZumKündigen(null);
      await fetchVerträge();
    } catch (error) { console.error('Fehler Vertrag kündigen:', error); alert('Fehler beim Kündigen des Vertrags.'); }
  };

  const handleVertragLöschen = async (vertrag) => {
    const heute = new Date(); heute.setHours(0, 0, 0, 0);
    let istBeendet = false;
    if (vertrag.vertragsende) { const ve = new Date(vertrag.vertragsende); ve.setHours(0, 0, 0, 0); istBeendet = ve < heute; }
    istBeendet = istBeendet || vertrag.status !== 'aktiv' || vertrag.kuendigung_eingegangen || vertrag.kuendigungsdatum;
    if (!istBeendet) { setVertragZumKündigen(vertrag); setShowKündigungBestätigungModal(true); return; }
    const grund = window.prompt(`⚠️ Vertrag #${vertrag.personenVertragNr} löschen?\n\nBitte Grund eingeben (optional):`);
    if (grund !== null) {
      try {
        await axios.delete(`/vertraege/${vertrag.id}`, { data: { dojo_id: mitglied?.dojo_id, geloescht_von: user?.username || 'Admin', geloescht_grund: grund || 'Kein Grund' } });
        alert('✅ Vertrag wurde erfolgreich archiviert.');
        await fetchVerträge();
      } catch (error) { console.error('Fehler Vertrag löschen:', error); alert('Fehler beim Löschen des Vertrags.'); }
    }
  };

  const handleSaveVertrag = async () => {
    if (setLoading) setLoading(true);
    try {
      const vertragToSave = editingVertrag || newVertrag;
      if (!mitglied || !mitglied.dojo_id) { alert('Fehler: Mitgliedsdaten nicht geladen.'); return; }
      if (!vertragToSave.tarif_id) { alert('Bitte wählen Sie einen Tarif aus.'); return; }
      if (!editingVertrag && (!newVertrag.agb_akzeptiert || !newVertrag.datenschutz_akzeptiert)) { alert('Bitte akzeptieren Sie die AGB und Datenschutzerklärung.'); return; }
      if (!vertragToSave.sepa_mandat_id) { alert('Bitte wählen Sie ein SEPA-Mandat aus.'); return; }
      if (editingVertrag) {
        const response = await axios.put(`/vertraege/${editingVertrag.id}`, { ...editingVertrag, dojo_id: mitglied?.dojo_id });
        if (response.data.success) { await fetchVerträge(); setEditingVertrag(null); alert('✅ Vertrag erfolgreich aktualisiert!'); }
      } else {
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const { agb_akzeptiert, datenschutz_akzeptiert, hausordnung_akzeptiert, ...vertragDataForBackend } = newVertrag;
        const contractData = { mitglied_id: parseInt(id), dojo_id: mitglied?.dojo_id, ...vertragDataForBackend, agb_akzeptiert_am: newVertrag.agb_akzeptiert ? now : null, datenschutz_akzeptiert_am: newVertrag.datenschutz_akzeptiert ? now : null, hausordnung_akzeptiert_am: newVertrag.hausordnung_akzeptiert ? now : null, unterschrift_datum: now, unterschrift_ip: window.location.hostname };
        const response = await axios.post('/vertraege', contractData);
        if (response.data.success) {
          await fetchVerträge();
          const heute = new Date(); const in12M = new Date(heute); in12M.setMonth(heute.getMonth() + 12);
          setNewVertrag({ tarif_id: '', status: 'aktiv', billing_cycle: '', payment_method: 'direct_debit', vertragsbeginn: heute.toISOString().split('T')[0], vertragsende: in12M.toISOString().split('T')[0], kuendigungsfrist_monate: 3, mindestlaufzeit_monate: 12, automatische_verlaengerung: true, verlaengerung_monate: 12, faelligkeit_tag: 1, sepa_mandat_id: null, agb_akzeptiert: false, agb_version: '1.0', datenschutz_akzeptiert: false, datenschutz_version: '1.0', hausordnung_akzeptiert: false, haftungsausschluss_akzeptiert: false, gesundheitserklaerung: false, foto_einverstaendnis: false });
          setShowNewVertrag(false); alert('✅ Vertrag erfolgreich erstellt!');
        }
      }
    } catch (error) {
      console.error('Fehler Vertrag speichern:', error);
      const errorMsg = error.response?.data?.sqlError || error.response?.data?.details || error.response?.data?.error || error.message;
      alert('Fehler beim Speichern des Vertrags: ' + errorMsg);
    } finally { if (setLoading) setLoading(false); }
  };

  // Daten beim Mounten laden
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    fetchFinanzDaten(controller.signal);
    loadSepaMandate(controller.signal);
    loadArchivierteMandate(controller.signal);
    fetchRuecklastschriftenStats();
    fetchLsEinverstaendnis();
    if (mitglied?.mitglied_id) fetchVerträge(controller.signal);
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    if (mitglied?.mitglied_id) fetchVerträge();
  }, [mitglied?.mitglied_id]);

  // ── JSX ────────────────────────────────────────────────────────────────────
  return (
    <>
  <div className="finance-sub-tabs mds-finance-sub-tabs-row mds-tabs--l1">
    <button className={`finance-sub-tab-btn ${mitgliedschaftSubTab === "vertrag" ? "active" : ""}`} onClick={() => setMitgliedschaftSubTab("vertrag")}>📄 Vertrag</button>
    <button className={`finance-sub-tab-btn ${mitgliedschaftSubTab === "finanzen" && financeSubTab === "beitraege" ? "active" : ""}`} onClick={() => { setMitgliedschaftSubTab("finanzen"); setFinanceSubTab("beitraege"); }}>💳 Beiträge</button>
    <button className={`finance-sub-tab-btn ${mitgliedschaftSubTab === "finanzen" && financeSubTab === "bank" ? "active" : ""}`} onClick={() => { setMitgliedschaftSubTab("finanzen"); setFinanceSubTab("bank"); }}>🏦 Bank & SEPA</button>
    <button className={`finance-sub-tab-btn ${mitgliedschaftSubTab === "finanzen" && financeSubTab === "einkäufe" ? "active" : ""}`} onClick={() => { setMitgliedschaftSubTab("finanzen"); setFinanceSubTab("einkäufe"); }}>🛒 Einkäufe</button>
    <button className={`finance-sub-tab-btn ${mitgliedschaftSubTab === "finanzen" && financeSubTab === "ratenzahlung" ? "active" : ""}`} onClick={() => { setMitgliedschaftSubTab("finanzen"); setFinanceSubTab("ratenzahlung"); }}>📋 Ratenzahlung</button>
    <button className={`finance-sub-tab-btn ${mitgliedschaftSubTab === "finanzen" && financeSubTab === "gutscheine" ? "active" : ""}`} onClick={() => { setMitgliedschaftSubTab("finanzen"); setFinanceSubTab("gutscheine"); }}>🎁 Gutscheine</button>
    <button className={`finance-sub-tab-btn ${mitgliedschaftSubTab === "familie" ? "active" : ""}`} onClick={() => setMitgliedschaftSubTab("familie")}>👨‍👩‍👧‍👦 Familie</button>
  </div>

  {mitgliedschaftSubTab === "familie" && (
  <>
    {isAdmin && (
      <div className="fam-add-banner">
        <div className="fam-add-banner-text">
          <div className="fam-add-banner-title">Familienmitglied hinzufügen</div>
          <div className="fam-add-banner-sub">Neues Mitglied mit Familienrabatt anlegen</div>
        </div>
        <button className="fam-add-btn" onClick={() => setShowFamilyMemberModal(true)}>
          👨‍👩‍👧 Hinzufügen
        </button>
      </div>
    )}
    <MemberFamilyTab
      mitglied={mitglied}
      updatedData={updatedData}
      editMode={editMode}
      handleChange={handleChange}
      CustomSelect={CustomSelect}
    />
    {showFamilyMemberModal && (
      <NeuesMitgliedAnlegen
        onClose={() => setShowFamilyMemberModal(false)}
        existingMemberForFamily={mitglied}
      />
    )}
  </>
  )}

  {mitgliedschaftSubTab === "vertrag" && (
  <div className="vtr-wrapper">

    {/* ── Header ── */}
    <div className="vtr-header">
      <div className="vtr-header-title">Vertragsverwaltung</div>
      {isAdmin && (
        <div className="vtr-header-actions">
          <button
            className={`vtr-btn-freistell${mitglied?.vertragsfrei ? ' vtr-btn-freistell--active' : ''}`}
            onClick={() => {
              if (mitglied?.vertragsfrei) {
                setVertragsfreiModal('aufheben');
              } else {
                setVertragsfreiForm({ grund: '', ab: new Date().toISOString().split('T')[0], beitraege_aktion: 'behalten' });
                setVertragsfreiModal('stellen');
              }
            }}
          >
            {mitglied?.vertragsfrei ? '✓ Vertragsfrei' : 'Vertragsfrei stellen'}
          </button>
          <button className="vtr-btn-new" onClick={() => setShowNewVertrag(true)}>
            + Neuer Vertrag
          </button>
        </div>
      )}
    </div>

    {/* ── Vertragsfrei Hinweis ── */}
    {isAdmin && !!mitglied?.vertragsfrei && !!mitglied?.vertragsfrei_grund && (
      <div className="vtr-freistell-box">
        <div className="vtr-freistell-label">Beitrags- und vertragsfreies Mitglied</div>
        <div className="vtr-freistell-grund">Grund: {mitglied.vertragsfrei_grund}</div>
      </div>
    )}

    {/* ── Contract list ── */}
    {verträge.length > 0 ? (
      <div className="vtr-grid">
        {verträge.map(vertrag => {
          const statusKey = vertrag.geloescht ? 'geloescht' : vertrag.status;
          const statusLabel = vertrag.geloescht ? 'Gelöscht' :
                              vertrag.status === 'aktiv'      ? 'Aktiv' :
                              vertrag.status === 'gekuendigt' ? 'Gekündigt' :
                              vertrag.status === 'ruhepause'  ? 'Ruhepause' : 'Beendet';
          const zahlart = vertrag.payment_method === 'direct_debit'  ? 'Lastschrift' :
                          vertrag.payment_method === 'bank_transfer' ? 'Überweisung' :
                          vertrag.payment_method === 'cash'          ? 'Bar' :
                          vertrag.payment_method || '—';
          return (
            <div key={vertrag.id} className={`vtr-card vtr-card--${statusKey}`}>

              {/* Card header */}
              <div className="vtr-card-head">
                <div className="vtr-card-head-left">
                  <div className="vtr-card-nr">Vertrag #{vertrag.personenVertragNr ?? vertrag.id}</div>
                  <div className="vtr-card-date">
                    Erstellt {new Date(vertrag.created_at || vertrag.vertragsbeginn).toLocaleDateString('de-DE')}
                  </div>
                </div>
                <div className={`vtr-status-badge vtr-status-badge--${statusKey}`}>{statusLabel}</div>
              </div>

              {/* Info grid */}
              <div className="vtr-info">
                <div className="vtr-kv">
                  <div className="vtr-kv-label">Tarif</div>
                  <div className="vtr-kv-value">
                    {vertrag.tarif_name || '—'}
                    {vertrag.monatsbeitrag && (
                      <div className="vtr-kv-price">{parseFloat(vertrag.monatsbeitrag).toFixed(2)} €/Monat</div>
                    )}
                  </div>
                </div>
                {vertrag.neuer_monatsbeitrag && vertrag.neuer_beitrag_ab && (
                  <div className="vtr-kv vtr-kv--warn">
                    <div className="vtr-kv-label">Erhöhung</div>
                    <div className="vtr-kv-value">
                      {parseFloat(vertrag.neuer_monatsbeitrag).toFixed(2)} €/Monat
                      <div className="vtr-kv-sub">ab {new Date(vertrag.neuer_beitrag_ab).toLocaleDateString('de-DE')}</div>
                    </div>
                  </div>
                )}
                <div className="vtr-kv">
                  <div className="vtr-kv-label">Laufzeit</div>
                  <div className="vtr-kv-value">
                    {vertrag.vertragsbeginn && vertrag.vertragsende
                      ? `${new Date(vertrag.vertragsbeginn).toLocaleDateString('de-DE')} – ${new Date(vertrag.vertragsende).toLocaleDateString('de-DE')}`
                      : '—'}
                  </div>
                </div>
                <div className="vtr-kv">
                  <div className="vtr-kv-label">Zahlung</div>
                  <div className="vtr-kv-value">
                    {vertrag.billing_cycle ? translateBillingCycle(vertrag.billing_cycle) : '—'}
                  </div>
                </div>
                <div className="vtr-kv">
                  <div className="vtr-kv-label">Zahlart</div>
                  <div className="vtr-kv-value">{zahlart}</div>
                </div>
                {vertrag.aufnahmegebuehr_cents > 0 && (
                  <div className="vtr-kv">
                    <div className="vtr-kv-label">Aufnahme</div>
                    <div className="vtr-kv-value">{(vertrag.aufnahmegebuehr_cents / 100).toFixed(2)} €</div>
                  </div>
                )}
                {vertrag.kuendigungsfrist_monate && (
                  <div className="vtr-kv">
                    <div className="vtr-kv-label">Kündigung</div>
                    <div className="vtr-kv-value">
                      {vertrag.kuendigungsfrist_monate} {vertrag.kuendigungsfrist_monate === 1 ? 'Monat' : 'Monate'} Frist
                    </div>
                  </div>
                )}
                {vertrag.mindestlaufzeit_monate && (
                  <div className="vtr-kv">
                    <div className="vtr-kv-label">Mindestlaufzeit</div>
                    <div className="vtr-kv-value">
                      {vertrag.mindestlaufzeit_monate} {vertrag.mindestlaufzeit_monate === 1 ? 'Monat' : 'Monate'}
                    </div>
                  </div>
                )}
                {vertrag.kuendigung_eingegangen && (
                  <div className="vtr-kv vtr-kv--red">
                    <div className="vtr-kv-label">Kündigung eingeg.</div>
                    <div className="vtr-kv-value">
                      {new Date(vertrag.kuendigung_eingegangen).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                )}
                {vertrag.status === 'ruhepause' && vertrag.ruhepause_von && vertrag.ruhepause_bis && (
                  <div className="vtr-kv vtr-kv--gold">
                    <div className="vtr-kv-label">Ruhepause</div>
                    <div className="vtr-kv-value">
                      {new Date(vertrag.ruhepause_von).toLocaleDateString('de-DE')} – {new Date(vertrag.ruhepause_bis).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment mini-summary */}
              {beitraege.length > 0 && (() => {
                const heute = new Date(); heute.setHours(23, 59, 59, 999);
                const fBezahlt = beitraege.filter(f => f.bezahlt === 1 || f.bezahlt === true || f.bezahlt === '1');
                const fOffen   = beitraege.filter(f => !(f.bezahlt === 1 || f.bezahlt === true || f.bezahlt === '1') && new Date(f.zahlungsdatum || f.datum || 0) <= heute);
                const sumBez   = fBezahlt.reduce((s, f) => s + parseFloat(f.betrag || 0), 0);
                const sumOff   = fOffen.reduce((s, f) => s + parseFloat(f.betrag || 0), 0);
                const letzte   = fBezahlt.map(f => ({ ...f, _d: new Date(f.zahlungsdatum || f.datum) })).sort((a, b) => b._d - a._d)[0];
                return (
                  <div className="vtr-summary">
                    <div className="vtr-summary-title">Beitragsübersicht</div>
                    <div className="vtr-summary-grid">
                      <div className="vtr-summary-item">
                        <div className="vtr-summary-label">Bezahlt</div>
                        <div className="vtr-summary-value vtr-green">{fBezahlt.length}× · {sumBez.toFixed(2)} €</div>
                      </div>
                      <div className="vtr-summary-item">
                        <div className="vtr-summary-label">Überfällig</div>
                        <div className={`vtr-summary-value${fOffen.length > 0 ? ' vtr-red' : ''}`}>
                          {fOffen.length > 0 ? `${fOffen.length}× · ${sumOff.toFixed(2)} €` : '–'}
                        </div>
                      </div>
                      {letzte && (
                        <div className="vtr-summary-item">
                          <div className="vtr-summary-label">Letzte Zahlung</div>
                          <div className="vtr-summary-value">{letzte._d.toLocaleDateString('de-DE')}</div>
                        </div>
                      )}
                    </div>
                    <button
                      className="vtr-summary-link"
                      onClick={() => { setActiveTab('mitgliedschaft'); setMitgliedschaftSubTab('finanzen'); setFinanceSubTab('beitraege'); }}
                    >
                      Vollständige Beitragsübersicht →
                    </button>
                  </div>
                );
              })()}

              {/* Vertragsanpassungen */}
              {isAdmin && vertrag.status === 'aktiv' && (
                <VertragAnpassungSektion
                  vertrag={vertrag}
                  mitglied={mitglied}
                  vertragAnpassungen={vertragAnpassungen}
                  setVertragAnpassungen={setVertragAnpassungen}
                  vertragAnpassungForm={vertragAnpassungForm}
                  setVertragAnpassungForm={setVertragAnpassungForm}
                  editingAnpassungId={editingAnpassungId}
                  setEditingAnpassungId={setEditingAnpassungId}
                />
              )}

              {/* Actions */}
              <div className="vtr-actions">
                <button className="vtr-act vtr-act--pdf"
                  onClick={() => { setSelectedVertrag(vertrag); setShowVertragDetails(true); }}>
                  PDF
                </button>
                <button className="vtr-act vtr-act--details"
                  onClick={() => { setSelectedVertrag(vertrag); setShowStructuredDetails(true); }}>
                  Details
                </button>
                {isAdmin && (
                  <>
                    <button className="vtr-act vtr-act--edit"
                      onClick={() => setEditingVertrag(vertrag)}>
                      Bearbeiten
                    </button>
                    {vertrag.status === 'aktiv' && (
                      <>
                        <button className="vtr-act vtr-act--pause"
                          onClick={() => handleVertragAction(vertrag.id, 'ruhepause')}>
                          Ruhepause
                        </button>
                        <button className="vtr-act vtr-act--cancel"
                          onClick={() => handleVertragAction(vertrag.id, 'kündigen')}>
                          Kündigen
                        </button>
                      </>
                    )}
                    {vertrag.status === 'ruhepause' && (
                      <button className="vtr-act vtr-act--activate"
                        onClick={() => handleVertragAction(vertrag.id, 'reaktivieren')}>
                        Reaktivieren
                      </button>
                    )}
                    {vertrag.status === 'gekuendigt' && !vertrag.geloescht && (
                      <button className="vtr-act vtr-act--activate"
                        onClick={() => handleKündigungAufheben(vertrag)}>
                        Kündigung aufheben
                      </button>
                    )}
                    {!vertrag.geloescht && (
                      <button className="vtr-act vtr-act--delete"
                        onClick={() => handleVertragLöschen(vertrag)}>
                        Löschen
                      </button>
                    )}
                  </>
                )}
                {!isAdmin && vertrag.status === 'aktiv' && (
                  <button className="vtr-act vtr-act--pause"
                    onClick={() => handleVertragAction(vertrag.id, 'ruhepause')}>
                    Ruhepause beantragen
                  </button>
                )}
              </div>

            </div>
          );
        })}
      </div>
    ) : (
      <div className="vtr-empty">
        <div className="vtr-empty-icon">📋</div>
        <div className="vtr-empty-text">Keine Verträge vorhanden</div>
        {isAdmin && (
          <button className="vtr-btn-new" onClick={() => setShowNewVertrag(true)}>
            + Ersten Vertrag erstellen
          </button>
        )}
      </div>
    )}

    {/* 10er-Karten */}
    <ZehnerkartenVerwaltung
      mitgliedId={mitglied?.mitglied_id}
      mitglied={mitglied}
      isAdmin={isAdmin}
    />

  </div>
  )}


  {mitgliedschaftSubTab === "finanzen" && (
  <div className="finance-management-container">


    {financeSubTab === "beitraege" && (
      <div className="beitraege-sub-tab-content">
        {(() => {
              // Funktion zum Gruppieren der Beiträge
              const groupBeiträge = (data, mode) => {
                const groups = {};
                const sortedData = [...data].sort((a, b) => {
                  const dateA = new Date(a.datum || a.zahlungsdatum);
                  const dateB = new Date(b.datum || b.zahlungsdatum);
                  return dateB - dateA;
                });

                sortedData.forEach(beitrag => {
                  const date = new Date(beitrag.datum || beitrag.zahlungsdatum);
                  let key = '';

                  if (mode === 'monat') {
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                  } else if (mode === 'quartal') {
                    const quarter = Math.floor(date.getMonth() / 3) + 1;
                    key = `${date.getFullYear()}-Q${quarter}`;
                  } else if (mode === 'jahr') {
                    key = `${date.getFullYear()}`;
                  }

                  if (!groups[key]) {
                    groups[key] = [];
                  }
                  groups[key].push(beitrag);
                });

                return groups;
              };

              // Funktion zum Formatieren des Zeitraum-Labels
              const formatPeriodLabel = (key, mode) => {
                if (mode === 'monat') {
                  const [year, month] = key.split('-');
                  const date = new Date(year, month - 1);
                  return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' });
                } else if (mode === 'quartal') {
                  return key.replace('-Q', '. Quartal ');
                } else {
                  return key;
                }
              };

              // Berechne Summen für einen Zeitraum
              const calculatePeriodSums = (beitraege) => {
                let total = 0;
                let paid = 0;
                let unpaid = 0;
                
                beitraege.forEach(b => {
                  const betrag = parseFloat(b.betrag || 0);
                  if (isNaN(betrag)) return; // Überspringe ungültige Beträge
                  
                  total += betrag;
                  
                  // Prüfe bezahlt-Status: MySQL gibt TINYINT(1) als 0 oder 1 zurück
                  // Konvertiere zu Number für sichere Prüfung - handle auch String "0"/"1"
                  const bezahltValue = b.bezahlt === true || b.bezahlt === 1 || b.bezahlt === "1" || String(b.bezahlt) === "1";
                  
                  if (bezahltValue) {
                    paid += betrag;
                  } else {
                    unpaid += betrag;
                  }
                });
                
                return { total, paid, unpaid };
              };

              // Funktion zum Generieren zukünftiger Beiträge basierend auf Vertragsdaten
              const generateZukuenftigeBeitraege = () => {
                const generierteBeitraege = [];
                const jetzt = new Date();
                jetzt.setHours(0, 0, 0, 0);
                
                // Aktive Verträge finden (auch gekündigte, aber noch laufende)
                const aktiveVertraege = verträge.filter(v => {
                  if (v.status !== 'aktiv') return false;
                  if (!v.vertragsbeginn) return false;
                  return true;
                });

                
                aktiveVertraege.forEach(vertrag => {
                  const vertragsbeginn = new Date(vertrag.vertragsbeginn);
                  vertragsbeginn.setHours(0, 0, 0, 0);
                  
                  // Bestimme das tatsächliche Vertragsende
                  let vertragsende = null;
                  let kuendigungsdatum = null; // Speichere Kündigungsdatum für anteilige Berechnung (vor setHours)
                  let vertragsendeOriginal = null; // Speichere originales Vertragsende für Monatsvergleiche
                  
                  // Wenn gekündigt, verwende Kündigungsdatum
                  if (vertrag.kuendigung_eingegangen || vertrag.kuendigungsdatum) {
                    kuendigungsdatum = vertrag.kuendigungsdatum 
                      ? new Date(vertrag.kuendigungsdatum)
                      : vertrag.kuendigung_eingegangen 
                        ? new Date(vertrag.kuendigung_eingegangen)
                        : null;
                    if (kuendigungsdatum) {
                      vertragsendeOriginal = new Date(kuendigungsdatum);
                      vertragsende = new Date(kuendigungsdatum);
                    }
                  } else if (vertrag.vertragsende) {
                    vertragsendeOriginal = new Date(vertrag.vertragsende);
                    vertragsende = new Date(vertrag.vertragsende);
                  }
                  
                  // Prüfe ob Vertrag verlängert wurde (vertragsende überschritten, nicht gekündigt, automatische Verlängerung)
                  if (vertragsende && vertrag.automatische_verlaengerung && !vertrag.kuendigung_eingegangen) {
                    const heute = new Date();
                    heute.setHours(0, 0, 0, 0);
                    
                    if (heute > vertragsende) {
                      // Vertrag wurde verlängert - berechne neues Ende
                      const verlaengerungMonate = vertrag.verlaengerung_monate || 12;
                      vertragsende = new Date(vertragsende);
                      vertragsende.setMonth(vertragsende.getMonth() + verlaengerungMonate);
                      vertragsendeOriginal = new Date(vertragsende);
                    }
                  }
                  
                  // Wenn kein vertragsende, verwende aktuelles Datum + 12 Monate
                  if (!vertragsende) {
                    vertragsende = new Date();
                    vertragsende.setMonth(vertragsende.getMonth() + 12);
                    vertragsendeOriginal = new Date(vertragsende);
                  }
                  
                  vertragsende.setHours(23, 59, 59, 999);
                  
                  // Monatlicher Beitrag
                  const monatsbeitrag = parseFloat(vertrag.monatsbeitrag || vertrag.monatlicher_beitrag || 0);
                  if (monatsbeitrag <= 0) return;
                  
                  // Fälligkeitstag im Monat
                  const faelligkeitTag = vertrag.faelligkeit_tag || 1;
                  
                  // Starte ab dem ersten Monat nach Vertragsbeginn
                  let aktuellesDatum = new Date(vertragsbeginn);
                  aktuellesDatum.setDate(faelligkeitTag);
                  
                  // Wenn Vertragsbeginn in der Vergangenheit liegt, starte ab heute
                  if (aktuellesDatum < jetzt) {
                    aktuellesDatum = new Date(jetzt);
                    aktuellesDatum.setDate(faelligkeitTag);
                    // Wenn der Tag bereits vorbei ist, nächsten Monat
                    if (aktuellesDatum < jetzt) {
                      aktuellesDatum.setMonth(aktuellesDatum.getMonth() + 1);
                    }
                  }
                  
                  // Generiere Beiträge bis zum Vertragsende
                  while (aktuellesDatum <= vertragsende) {
                    // Prüfe ob dieser Beitrag bereits existiert (auch bezahlt)
                    // Prüfe nach Monat/Jahr und Betrag, nicht nur exaktes Datum
                    const aktuellerMonat = aktuellesDatum.getMonth();
                    const aktuellesJahr = aktuellesDatum.getFullYear();
                    
                    // Prüfe ob bereits ein Beitrag für diesen Monat existiert
                    const existiertBereits = beitraege.some(f => {
                      if (f.magicline_description) return false;
                      // Datum als String auslesen (vermeidet UTC-Timezone-Bug bei new Date('YYYY-MM-DD'))
                      const dateStr = f.zahlungsdatum ? f.zahlungsdatum.toString().substring(0, 10) : null;
                      if (!dateStr || dateStr.length < 7) return false;
                      const fJahr = parseInt(dateStr.substring(0, 4), 10);
                      const fMonat = parseInt(dateStr.substring(5, 7), 10) - 1; // 0-indexed
                      return fMonat === aktuellerMonat && fJahr === aktuellesJahr;
                    });
                    
                    if (!existiertBereits) {
                      // Prüfe ob letzter Monat und Kündigung - dann anteilig berechnen
                      let betrag = monatsbeitrag;
                      
                      // Prüfe ob es der letzte Monat ist (verwende kuendigungsdatum oder vertragsendeOriginal vor setHours)
                      const endeDatum = kuendigungsdatum || vertragsendeOriginal;
                      const istLetzterMonat = endeDatum && 
                                               aktuellesDatum.getMonth() === endeDatum.getMonth() &&
                                               aktuellesDatum.getFullYear() === endeDatum.getFullYear();
                      
                      if (istLetzterMonat && kuendigungsdatum) {
                        // Anteilsmäßige Berechnung für letzten Monat
                        const monatsAnfang = new Date(aktuellesDatum.getFullYear(), aktuellesDatum.getMonth(), 1);
                        const monatsEnde = new Date(aktuellesDatum.getFullYear(), aktuellesDatum.getMonth() + 1, 0);
                        const tageImMonat = monatsEnde.getDate();
                        
                        // Verwende das ursprüngliche Kündigungsdatum (vor setHours) für korrekte Tag-Berechnung
                        const kuendigungsTag = kuendigungsdatum.getDate();
                        const tageBisKündigung = Math.min(kuendigungsTag, tageImMonat);
                        
                        // Berechne anteiligen Betrag: Anzahl Tage bis Kündigung / Gesamttage im Monat
                        const anteil = tageBisKündigung / tageImMonat;
                        betrag = Math.round(monatsbeitrag * anteil * 100) / 100; // Runde auf 2 Dezimalstellen
                      }
                      
                      // Datum in Lokalzeit formatieren (NICHT UTC um Timezone-Verschiebung zu vermeiden)
                      const year = aktuellesDatum.getFullYear();
                      const month = String(aktuellesDatum.getMonth() + 1).padStart(2, '0');
                      const day = String(aktuellesDatum.getDate()).padStart(2, '0');
                      const localDateString = `${year}-${month}-${day}`;

                      generierteBeitraege.push({
                        beitrag_id: `generated_${vertrag.id}_${aktuellesDatum.getTime()}`,
                        betrag: betrag.toFixed(2),
                        zahlungsdatum: null,
                        faelligkeitsdatum: localDateString,
                        datum: localDateString,
                        zahlungsart: vertrag.payment_method === 'direct_debit' ? 'Lastschrift' :
                                    vertrag.payment_method === 'transfer' ? 'Überweisung' :
                                    vertrag.payment_method || 'Unbekannt',
                        bezahlt: 0,
                        generiert: true, // Flag um zu markieren dass es generiert wurde
                        vertrag_id: vertrag.id,
                        anteilig: istLetzterMonat && kuendigungsdatum !== null
                      });
                    }
                    
                    // Nächsten Monat
                    aktuellesDatum.setMonth(aktuellesDatum.getMonth() + 1);
                  }
                });
                
                return generierteBeitraege;
              };
              
              // Kombiniere vorhandene und generierte Beiträge
              // Wichtig: lokale Date-Methoden verwenden, da mysql2 DATE-Spalten als
              // JS-Date (lokale Mitternacht CET) zurückgibt, die JSON-serialisiert als
              // UTC-String erscheinen → substring(0,7) gibt falschen Monat (UTC-1h)
              const _echteMonateSet = new Set(beitraege.map(f => {
                if (!f.zahlungsdatum) return null;
                const d = new Date(f.zahlungsdatum);
                if (isNaN(d.getTime())) return null;
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              }).filter(Boolean));
              const zukuenftigeBeitraege = generateZukuenftigeBeitraege().filter(vb => {
                const s = (vb.datum || '').substring(0, 7); // "YYYY-MM"
                return !_echteMonateSet.has(s);
              });

              // Ratenplan-Aufschläge als generierte Beiträge hinzufügen
              const ratenplanBeitraege = [];
              if (aktiverRatenplan && parseFloat(aktiverRatenplan.monatlicher_aufschlag) > 0) {
                const aufschlag = parseFloat(aktiverRatenplan.monatlicher_aufschlag);
                let bereitsAbgezahlt = parseFloat(aktiverRatenplan.bereits_abgezahlt || 0);
                const ausstehend = parseFloat(aktiverRatenplan.ausstehender_betrag || 0);
                const erstelltAm = new Date(aktiverRatenplan.erstellt_am || new Date());
                const heute = new Date();
                // Generiere ab Monat der Ratenplan-Erstellung bis Vollzahlung
                let cursor = new Date(erstelltAm.getFullYear(), erstelltAm.getMonth(), 1);
                const maxMonate = Math.ceil(ausstehend / aufschlag) + 1;
                let monatIdx = 0;
                while (bereitsAbgezahlt < ausstehend && monatIdx <= maxMonate) {
                  const restBetrag = ausstehend - bereitsAbgezahlt;
                  const dieserAufschlag = Math.min(aufschlag, restBetrag);
                  const year = cursor.getFullYear();
                  const month = String(cursor.getMonth() + 1).padStart(2, '0');
                  const datumStr = `${year}-${month}-01`;
                  const istBezahlt = cursor < erstelltAm ||
                    (cursor.getFullYear() < heute.getFullYear()) ||
                    (cursor.getFullYear() === heute.getFullYear() && cursor.getMonth() < heute.getMonth() && bereitsAbgezahlt >= dieserAufschlag);
                  ratenplanBeitraege.push({
                    beitrag_id: `ratenplan_${aktiverRatenplan.id}_${monatIdx}`,
                    betrag: dieserAufschlag.toFixed(2),
                    zahlungsdatum: datumStr,
                    datum: datumStr,
                    zahlungsart: 'Ratenplan-Aufschlag',
                    bezahlt: 0,
                    generiert: true,
                    istRatenplan: true,
                  });
                  bereitsAbgezahlt += dieserAufschlag;
                  cursor.setMonth(cursor.getMonth() + 1);
                  monatIdx++;
                }
              }

              const alleBeitraege = [...beitraege, ...zukuenftigeBeitraege, ...ratenplanBeitraege];

              // Sortiere nach Datum (neueste zuerst)
              alleBeitraege.sort((a, b) => {
                // Generierte Beiträge haben 'datum', echte Beiträge haben 'zahlungsdatum'
                const dateA = new Date(a.datum || a.zahlungsdatum);
                const dateB = new Date(b.datum || b.zahlungsdatum);
                return dateB - dateA;
              });
              
              // ── Semantische Sektionen ──────────────────────────────
              const _bN = new Date(); _bN.setHours(23,59,59,999);
              const _isPz = b => b.bezahlt===true||b.bezahlt===1||String(b.bezahlt)==='1';
              const _bDate = b => new Date(b.datum||b.zahlungsdatum||'9999-12-31');
              const _curMonthEnd = new Date(_bN.getFullYear(), _bN.getMonth()+1, 0, 23,59,59,999);

              // Aktuell: unbezahlt & fällig bis Monatsende (inkl. überfällig)
              const _sAktuell = alleBeitraege
                .filter(b => !_isPz(b) && _bDate(b) <= _curMonthEnd)
                .sort((a,b) => _bDate(a)-_bDate(b));

              // Bezahlt, neueste zuerst
              const _allPaid = alleBeitraege.filter(_isPz).sort((a,b)=>_bDate(b)-_bDate(a));
              const _sLetzte = _allPaid.slice(0,3);
              const _sAelter = _allPaid.slice(3);

              // Zukunft: unbezahlt nach Monatsende
              const _sZukunft = alleBeitraege
                .filter(b => !_isPz(b) && _bDate(b) > _curMonthEnd)
                .sort((a,b) => _bDate(a)-_bDate(b));

              const _sections = [
                { key:'aktuell', label:'Aktuelle Abbuchung',    icon:'⚡', entries:_sAktuell, color:'#d4af37' },
                { key:'letzte',  label:'Letzte 3 Abbuchungen',  icon:'✓',  entries:_sLetzte,  color:'#4caf82' },
                { key:'zukunft', label:'Geplante Beiträge',     icon:'🔮', entries:_sZukunft, color: 'var(--ds-text-secondary)' },
                { key:'aelter',  label:'Ältere Beiträge',       icon:'📚', entries:_sAelter,  color: 'var(--ds-text-faint)' },
              ].filter(s => s.entries.length > 0);

              // collapsed by default: open only if collapsedPeriods[key] === true
              const _isSectionOpen = key => collapsedPeriods[key] === true;
              const _toggleSection = key => setCollapsedPeriods(prev => ({...prev, [key]: !prev[key]}));

              return (
                <div className="btr-wrap">
                  {/* ── Ratenplan-Banner ── */}
                  {aktiverRatenplan && (
                    <div style={{
                      background: 'rgba(234,179,8,0.1)',
                      border: '1px solid rgba(234,179,8,0.3)',
                      borderRadius: 8,
                      padding: '0.6rem 1rem',
                      marginBottom: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      flexWrap: 'wrap',
                      fontSize: '0.82rem'
                    }}>
                      <span style={{ fontWeight: 700, color: '#eab308' }}>📋 Aktiver Ratenplan</span>
                      <span style={{ color: 'var(--ds-text-secondary)' }}>
                        +{parseFloat(aktiverRatenplan.monatlicher_aufschlag).toFixed(2)} €/Monat
                      </span>
                      <span style={{ color: 'var(--ds-text-muted)' }}>
                        {(parseFloat(aktiverRatenplan.ausstehender_betrag) - parseFloat(aktiverRatenplan.bereits_abgezahlt)).toFixed(2)} € noch offen
                        {' / '}
                        {parseFloat(aktiverRatenplan.ausstehender_betrag).toFixed(2)} € gesamt
                      </span>
                      {parseFloat(aktiverRatenplan.bereits_abgezahlt) > 0 && (
                        <span style={{ color: '#4ade80' }}>
                          ✓ {parseFloat(aktiverRatenplan.bereits_abgezahlt).toFixed(2)} € abgezahlt
                        </span>
                      )}
                    </div>
                  )}
                  {/* ── KPI-Karten (aus ehem. Finanzübersicht) ── */}
                  {(() => {
                    const _kpiHeute = new Date(); _kpiHeute.setHours(23, 59, 59, 999);
                    const bezahlteZahlungen = beitraege.filter(f => f.bezahlt);
                    const offeneZahlungen = beitraege.filter(f => !f.bezahlt && new Date(f.zahlungsdatum || f.datum || 0) <= _kpiHeute);
                    const geplanteZahlungen = beitraege.filter(f => !f.bezahlt && new Date(f.zahlungsdatum || f.datum || '9999-12-31') > _kpiHeute);
                    const gesamtBezahlt = bezahlteZahlungen.reduce((sum, f) => sum + parseFloat(f.betrag || 0), 0);
                    const gesamtOffen = offeneZahlungen.reduce((sum, f) => sum + parseFloat(f.betrag || 0), 0);
                    const gesamtGeplant = geplanteZahlungen.reduce((sum, f) => sum + parseFloat(f.betrag || 0), 0);
                    const gesamtBetrag = gesamtBezahlt + gesamtOffen;
                    const durchschnittBeitrag = beitraege.length > 0 ? gesamtBetrag / beitraege.length : 0;
                    const letzteZahlung = bezahlteZahlungen.length > 0
                      ? [...bezahlteZahlungen].sort((a, b) => new Date(b.zahlungsdatum || b.datum) - new Date(a.zahlungsdatum || a.datum))[0]
                      : null;
                    const kommendeZahlung = offeneZahlungen.length > 0
                      ? [...offeneZahlungen].sort((a, b) => new Date(a.datum || a.zahlungsdatum) - new Date(b.datum || b.zahlungsdatum))[0]
                      : null;
                    return (
                      <div className="mds-kpi-grid">
                        <div className="finance-kpi-card mds-kpi-card-success">
                          <div className="mds-flex-row-mb">
                            <span className="mds2-fs-2">📅</span>
                            <h4 className="mds2-label-bold">Geplante Einzüge</h4>
                          </div>
                          <div className="mds-kpi-value-success">{gesamtGeplant.toFixed(2)} €</div>
                          <div className="mds-text-secondary-sm">{geplanteZahlungen.length} kommende Beiträge</div>
                        </div>

                        {(gesamtOffen > 0 || (ruecklastschriftenStats?.offen_anzahl > 0)) && (
                          <div className="finance-kpi-card mds-kpi-card-danger">
                            <div className="mds-flex-row-mb">
                              <span className="mds2-fs-2">⚠️</span>
                              <h4 className="mds2-label-bold">Offene Forderungen</h4>
                            </div>
                            <div className="mds-kpi-value-danger">
                              {(gesamtOffen + parseFloat(ruecklastschriftenStats?.offen_betrag || 0)).toFixed(2)} €
                            </div>
                            <div className="mds-text-secondary-sm">
                              {offeneZahlungen.length > 0 && <span>{offeneZahlungen.length} überfällig</span>}
                              {offeneZahlungen.length > 0 && ruecklastschriftenStats?.offen_anzahl > 0 && <span> · </span>}
                              {ruecklastschriftenStats?.offen_anzahl > 0 && <span style={{ color: '#fca5a5' }}>{ruecklastschriftenStats.offen_anzahl} Rücklastschrift{ruecklastschriftenStats.offen_anzahl !== 1 ? 'en' : ''}</span>}
                            </div>
                          </div>
                        )}

                        <div className="finance-kpi-card mds-kpi-card-primary">
                          <div className="mds-flex-row-mb">
                            <span className="mds2-fs-2">📊</span>
                            <h4 className="mds2-label-bold">Ø Beitrag</h4>
                          </div>
                          <div className="mds-kpi-value-primary">{durchschnittBeitrag.toFixed(2)} €</div>
                          <div className="mds-text-secondary-sm">Pro Zahlung</div>
                        </div>

                        {letzteZahlung && (
                          <div className="finance-kpi-card mds-kpi-card-success">
                            <div className="mds-flex-row-mb">
                              <span className="mds2-fs-2">✅</span>
                              <h4 className="mds2-label-bold">Letzte Zahlung</h4>
                            </div>
                            <div className="mds-kpi-value-success">{parseFloat(letzteZahlung.betrag || 0).toFixed(2)} €</div>
                            <div className="mds-text-secondary-sm">
                              {new Date(letzteZahlung.zahlungsdatum || letzteZahlung.datum).toLocaleDateString("de-DE")}
                            </div>
                          </div>
                        )}

                        <div className="finance-kpi-card mds-kpi-card-info">
                          <div className="mds-flex-row-mb">
                            <span className="mds2-fs-2">📅</span>
                            <h4 className="mds2-label-bold">Nächste Zahlung</h4>
                          </div>
                          {kommendeZahlung ? (
                            <>
                              <div className="mds2-stat-value">{parseFloat(kommendeZahlung.betrag || 0).toFixed(2)} €</div>
                              <div className="mds-text-secondary-sm">
                                {new Date(kommendeZahlung.datum || kommendeZahlung.zahlungsdatum).toLocaleDateString("de-DE")}
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="mds2-stat-value">-</div>
                              <div className="mds-text-secondary-sm">Keine ausstehenden Zahlungen</div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Statistik & Jahresübersicht (ehemals eigener Tab) ── */}
                  {(() => {
                    const _zhpIsOpen = collapsedPeriods['statistik'] === true;
                    const _zhpToggle = () => setCollapsedPeriods(prev => ({...prev, statistik: !prev['statistik']}));
                    const isPaid = p => p.bezahlt === true || p.bezahlt === 1 || p.bezahlt === "1" || String(p.bezahlt) === "1";
                    const _zhpHeute = new Date(); _zhpHeute.setHours(23, 59, 59, 999);
                    const paidList = beitraege.filter(isPaid);
                    const offenList = beitraege.filter(p => !isPaid(p));
                    const ueberfaelligList = offenList.filter(p => new Date(p.zahlungsdatum || p.datum || 0) <= _zhpHeute);
                    const geplanteList = offenList.filter(p => new Date(p.zahlungsdatum || p.datum || '9999-12-31') > _zhpHeute);
                    const totalBezahlt = paidList.reduce((s, p) => s + parseFloat(p.betrag || 0), 0);
                    const totalUeberfaellig = ueberfaelligList.reduce((s, p) => s + parseFloat(p.betrag || 0), 0);
                    const totalGeplant = geplanteList.reduce((s, p) => s + parseFloat(p.betrag || 0), 0);
                    const letzteZahlung = [...paidList].sort((a,b) => new Date(b.zahlungsdatum) - new Date(a.zahlungsdatum))[0];
                    const sorted = [...beitraege].sort((a,b) => new Date(b.zahlungsdatum||b.datum) - new Date(a.zahlungsdatum||a.datum));
                    const fmt = n => parseFloat(n||0).toLocaleString('de-DE', {minimumFractionDigits:2});
                    const uniqueMonths = new Set(paidList.map(p => {
                      const d = new Date(p.zahlungsdatum||p.datum); return `${d.getFullYear()}-${d.getMonth()}`;
                    })).size;
                    const avgMonth = uniqueMonths > 0 ? totalBezahlt / uniqueMonths : 0;
                    const methodStr = art => {
                      const a = (art||'').toLowerCase();
                      if (a.includes('lastschrift')||a.includes('direct')) return 'Lastschrift';
                      if (a.includes('überweisung')) return 'Überweisung';
                      if (a.includes('bar')) return 'Bar';
                      if (a.includes('paypal')) return 'PayPal';
                      return art || '—';
                    };
                    const byYear = {};
                    sorted.forEach(p => {
                      const y = String(new Date(p.zahlungsdatum||p.datum||Date.now()).getFullYear());
                      (byYear[y] = byYear[y]||[]).push(p);
                    });
                    const toggleYear = y => setOpenYears(prev => {
                      const n = new Set(prev); n.has(y) ? n.delete(y) : n.add(y); return n;
                    });
                    return (
                      <div className="btr-period" style={{ marginBottom: '0.5rem' }}>
                        <button className="btr-period-btn" onClick={_zhpToggle}>
                          <div className="btr-period-left">
                            <div className="btr-period-chevron">{_zhpIsOpen ? '⌄' : '›'}</div>
                            <div className="btr-period-name" style={{ color: '#d4af37' }}>📊 Statistik &amp; Jahresübersicht</div>
                          </div>
                          <div className="btr-period-right" />
                        </button>
                        {_zhpIsOpen && (
                          <div style={{ padding: '0.5rem 0 0.25rem' }}>
                            <div className="zhp-wrap">
                              {/* ── Linke Spalte: Statistik-Kacheln ── */}
                              <div className="zhp-left">
                                <div className="zhp-tile">
                                  <div className="zhp-tile-label">Gesamt bezahlt</div>
                                  <div className="zhp-tile-value zhp-green">{fmt(totalBezahlt)} €</div>
                                  <div className="zhp-tile-sub">{paidList.length} Zahlungen</div>
                                </div>
                                <div className="zhp-tile">
                                  <div className="zhp-tile-label">Geplante Einzüge</div>
                                  <div className={`zhp-tile-value ${totalGeplant > 0 ? 'zhp-green' : 'zhp-dim'}`}>{fmt(totalGeplant)} €</div>
                                  <div className="zhp-tile-sub">{geplanteList.length > 0 ? `${geplanteList.length} kommende` : '–'}</div>
                                </div>
                                {totalUeberfaellig > 0 && (
                                  <div className="zhp-tile">
                                    <div className="zhp-tile-label">Überfällig</div>
                                    <div className="zhp-tile-value zhp-red">{fmt(totalUeberfaellig)} €</div>
                                    <div className="zhp-tile-sub">{ueberfaelligList.length} ausstehend</div>
                                  </div>
                                )}
                                <div className="zhp-tile">
                                  <div className="zhp-tile-label">Ø pro Monat</div>
                                  <div className="zhp-tile-value zhp-gold">{fmt(avgMonth)} €</div>
                                  <div className="zhp-tile-sub">über {uniqueMonths} Monate</div>
                                </div>
                                <div className="zhp-tile">
                                  <div className="zhp-tile-label">Letzte Zahlung</div>
                                  <div className="zhp-tile-value zhp-dim-lg">
                                    {letzteZahlung ? new Date(letzteZahlung.zahlungsdatum).toLocaleDateString('de-DE', {day:'2-digit', month:'short', year:'numeric'}) : '—'}
                                  </div>
                                  <div className="zhp-tile-sub">{letzteZahlung ? `${fmt(letzteZahlung.betrag)} €` : ''}</div>
                                </div>
                              </div>
                              {/* ── Rechte Spalte: Aufklappbare Jahresliste ── */}
                              <div className="zhp-right">
                                {sorted.length === 0 ? (
                                  <div className="zhp-empty">Keine Zahlungen erfasst</div>
                                ) : Object.keys(byYear).sort((a,b) => b-a).map(year => {
                                  const isOpen = openYears.has(year);
                                  const yearSum = byYear[year].filter(isPaid).reduce((s,p) => s+parseFloat(p.betrag||0), 0);
                                  return (
                                    <div key={year} className="zhp-year">
                                      <button className="zhp-year-btn" onClick={() => toggleYear(year)}>
                                        <div className="zhp-year-left">
                                          <div className="zhp-year-chevron">{isOpen ? '▾' : '▸'}</div>
                                          <div className="zhp-year-name">{year}</div>
                                          <div className="zhp-year-count">{byYear[year].length} Einträge</div>
                                        </div>
                                        <div className="zhp-year-sum">{fmt(yearSum)} €</div>
                                      </button>
                                      {isOpen && byYear[year].map((p, i) => {
                                        const paid = isPaid(p);
                                        const refDate = p.zahlungsdatum || p.datum;
                                        const d = refDate ? new Date(refDate) : null;
                                        const isFuture = !paid && d && d > _zhpHeute;
                                        return (
                                          <div key={p.beitrag_id||i} className="zhp-entry">
                                            <div className={`zhp-dot ${paid ? 'zhp-dot-paid' : isFuture ? 'zhp-dot-future' : 'zhp-dot-open'}`} />
                                            <div className="zhp-entry-date">
                                              {d ? d.toLocaleDateString('de-DE', {day:'2-digit', month:'short'}) : '—'}
                                            </div>
                                            <div className="zhp-entry-method">{methodStr(p.zahlungsart)}</div>
                                            <div className="zhp-entry-amount">{fmt(p.betrag)} €</div>
                                            <div className={`zhp-entry-badge ${paid ? 'zhp-badge-paid' : isFuture ? 'zhp-badge-future' : 'zhp-badge-open'}`}>
                                              {paid ? 'Bezahlt' : isFuture ? 'Geplant' : 'Offen'}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Semantische Sektionen ── */}
                  <div className="btr-list">
                    {alleBeitraege.length === 0 ? (
                      <div className="btr-empty">
                        <div className="btr-empty-icon">📭</div>
                        <div>Keine Beiträge vorhanden</div>
                        <div className="btr-empty-sub">Noch keine Beiträge erfasst und kein aktiver Vertrag.</div>
                      </div>
                    ) : (
                      _sections.map(section => {
                        const beitraege = section.entries;
                        const sums = calculatePeriodSums(beitraege);
                        const isOpen = _isSectionOpen(section.key);
                        return (
                          <div key={section.key} className="btr-period">
                            <button
                              className="btr-period-btn"
                              onClick={() => _toggleSection(section.key)}
                            >
                              <div className="btr-period-left">
                                <div className="btr-period-chevron">{isOpen ? '⌄' : '›'}</div>
                                <div className="btr-period-name" style={{ color: section.color }}>{section.icon} {section.label}</div>
                                <div className="btr-period-count">{beitraege.length}</div>
                              </div>
                              <div className="btr-period-right">
                                {sums.unpaid > 0 && (
                                  <div className="btr-period-open">{sums.unpaid.toFixed(2)} € offen</div>
                                )}
                                <div className="btr-period-sum">{sums.total.toFixed(2)} €</div>
                              </div>
                            </button>
                            {isOpen && (
                              <div className="btr-period-entries">
                                {beitraege.map(beitrag => {
                                  const isExp = expandedBeitraege[beitrag.beitrag_id];
                                  const bezahlt = beitrag.bezahlt === true || beitrag.bezahlt === 1 || String(beitrag.bezahlt) === '1';
                                  const btrD = new Date(beitrag.datum || beitrag.zahlungsdatum || '9999-12-31');
                                  const _btrN = new Date(); _btrN.setHours(23, 59, 59, 999);
                                  const isFutureBtr = !bezahlt && btrD > _btrN;
                                  return (
                                    <React.Fragment key={beitrag.beitrag_id}>
                                      <div className={`btr-entry${beitrag.generiert ? ' btr-entry--forecast' : ''}${beitrag.istRatenplan ? ' btr-entry--ratenplan' : ''}`}
                                        style={beitrag.istRatenplan ? { opacity: 0.85, borderLeft: '2px solid rgba(234,179,8,0.4)' } : {}}>
                                        <div className={`btr-dot${bezahlt ? ' btr-dot--paid' : isFutureBtr ? ' btr-dot--future' : ' btr-dot--open'}`} />
                                        {!beitrag.generiert ? (
                                          <button
                                            className={`btr-expand-btn${isExp ? ' btr-expand-btn--open' : ''}`}
                                            onClick={() => setExpandedBeitraege(prev => ({ ...prev, [beitrag.beitrag_id]: !prev[beitrag.beitrag_id] }))}
                                            title="Details"
                                          >›</button>
                                        ) : (
                                          <div className="btr-forecast-icon" title={beitrag.istRatenplan ? 'Ratenplan-Aufschlag' : 'Prognostiziert'}>
                                            {beitrag.istRatenplan ? '📋' : '🔮'}
                                          </div>
                                        )}
                                        <div className="btr-entry-date">
                                          {new Date(beitrag.datum || beitrag.zahlungsdatum).toLocaleDateString('de-DE')}
                                        </div>
                                        <div className="btr-entry-method">
                                          {beitrag.istRatenplan
                                            ? <span style={{ color: '#eab308', fontSize: '0.78rem' }}>Ratenplan +{parseFloat(beitrag.betrag).toFixed(2)} €</span>
                                            : beitrag.zahlungsart || '—'}
                                          {beitrag.anteilig && <div className="btr-anteilig">anteilig</div>}
                                        </div>
                                        <div className={`btr-entry-amount${bezahlt ? '' : ' btr-amount--open'}`}>
                                          {parseFloat(beitrag.betrag).toFixed(2)} €
                                        </div>
                                        <div className={`btr-entry-badge${bezahlt ? ' btr-badge--paid' : isFutureBtr ? ' btr-badge--future' : ' btr-badge--open'}`}>
                                          {bezahlt ? 'Bezahlt' : isFutureBtr ? 'Geplant' : 'Überfällig'}
                                        </div>
                                        {beitrag.magicline_description && (
                                          <div style={{ gridColumn: '1/-1', fontSize: '0.72rem', color: '#fbbf24', background: 'rgba(251,191,36,0.08)', borderRadius: 4, padding: '2px 7px', marginTop: '2px' }}>
                                            ℹ️ {beitrag.magicline_description}
                                          </div>
                                        )}
                                        {isAdmin && !beitrag.istRatenplan && (
                                          <button
                                            className={`btr-action-btn${bezahlt ? ' btr-action--unpay' : ' btr-action--pay'}`}
                                            onClick={async () => {
                                              try {
                                                if (beitrag.generiert) {
                                                  await axios.post('/beitraege', {
                                                    mitglied_id: mitglied.mitglied_id,
                                                    betrag: parseFloat(beitrag.betrag),
                                                    zahlungsart: beitrag.zahlungsart,
                                                    zahlungsdatum: bezahlt ? null : new Date().toISOString().split('T')[0],
                                                    bezahlt: bezahlt ? 0 : 1
                                                  });
                                                } else {
                                                  await axios.put(`/beitraege/${beitrag.beitrag_id}`, {
                                                    betrag: parseFloat(beitrag.betrag),
                                                    zahlungsart: beitrag.zahlungsart,
                                                    zahlungsdatum: beitrag.zahlungsdatum
                                                      ? new Date(beitrag.zahlungsdatum).toISOString().split('T')[0]
                                                      : (bezahlt ? null : new Date().toISOString().split('T')[0]),
                                                    bezahlt: bezahlt ? 0 : 1
                                                  });
                                                }
                                                fetchFinanzDaten();
                                              } catch (err) {
                                                console.error('Fehler:', err.response?.data || err.message);
                                              }
                                            }}
                                          >
                                            {bezahlt ? 'Stornieren' : 'Bezahlt'}
                                          </button>
                                        )}
                                      </div>
                                      {isExp && !beitrag.generiert && (
                                        <div className="btr-detail">
                                          <div className="btr-detail-grid">
                                            <div className="btr-detail-item">
                                              <div className="btr-detail-label">Beitrags-ID</div>
                                              <div className="btr-detail-value">#{beitrag.beitrag_id}</div>
                                            </div>
                                            {beitrag.magicline_description && (
                                              <div className="btr-detail-item btr-detail-item--full">
                                                <div className="btr-detail-label">Beschreibung</div>
                                                <div className="btr-detail-value">{beitrag.magicline_description}</div>
                                              </div>
                                            )}
                                            {(beitrag.datum || beitrag.zahlungsdatum) && (
                                              <div className="btr-detail-item">
                                                <div className="btr-detail-label">Datum</div>
                                                <div className="btr-detail-value">{new Date(beitrag.datum || beitrag.zahlungsdatum).toLocaleDateString('de-DE')}</div>
                                              </div>
                                            )}
                                            {beitrag.zahlungsdatum && (
                                              <div className="btr-detail-item">
                                                <div className="btr-detail-label">Zahlungsdatum</div>
                                                <div className="btr-detail-value">{new Date(beitrag.zahlungsdatum).toLocaleDateString('de-DE')}</div>
                                              </div>
                                            )}
                                            <div className="btr-detail-item">
                                              <div className="btr-detail-label">Betrag</div>
                                              <div className="btr-detail-value">{parseFloat(beitrag.betrag).toFixed(2)} €</div>
                                            </div>
                                            <div className="btr-detail-item">
                                              <div className="btr-detail-label">Zahlungsart</div>
                                              <div className="btr-detail-value">{beitrag.zahlungsart || 'Nicht angegeben'}</div>
                                            </div>
                                            <div className="btr-detail-item">
                                              <div className="btr-detail-label">Status</div>
                                              <div className={`btr-detail-value${bezahlt ? ' btr-green' : ' btr-red'}`}>{bezahlt ? 'Bezahlt' : 'Ausstehend'}</div>
                                            </div>
                                            {beitrag.dojo_id && (
                                              <div className="btr-detail-item">
                                                <div className="btr-detail-label">Dojo-ID</div>
                                                <div className="btr-detail-value">#{beitrag.dojo_id}</div>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}
      </div>
    )}

    {financeSubTab === "bank" && (
      <div className="bnk-wrap">

        {/* ── Lastschrift-Einverständnis (Einkäufe) ── */}
        {(() => {
          const le = lsEinverstaendnis;
          const statusMap = {
            zugestimmt: { label: 'Zugestimmt', color: '#2ea043' },
            abgelehnt:  { label: 'Abgelehnt',  color: '#d73a49' },
            ausstehend: { label: 'Ausstehend', color: '#f0a500' },
          };
          const st = le ? (statusMap[le.status] || statusMap.ausstehend) : null;
          const fmt = (dt) => dt ? new Date(dt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–';
          return (
            <div className="bnk-card" style={{ marginBottom: '1rem' }}>
              <div className="bnk-card-title">✅ Lastschrift-Einverständnis (Einkäufe)</div>
              {!le ? (
                <div style={{ color: 'var(--ds-text-muted, #888)', fontSize: '0.85rem', padding: '0.5rem 0' }}>
                  Noch keine Anfrage gesendet.{' '}
                  <a href="/dashboard/lastschrift-einverstaendnis" style={{ color: 'var(--ds-accent, #7c6ee0)' }}>Verwalten →</a>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.88rem' }}>
                  <div className="bnk-kv">
                    <div className="bnk-kv-label">Status</div>
                    <div className="bnk-kv-value">
                      <span style={{ display: 'inline-block', padding: '0.15rem 0.6rem', borderRadius: '12px', background: st.color + '22', color: st.color, fontWeight: 600 }}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                  <div className="bnk-kv">
                    <div className="bnk-kv-label">Angefragt am</div>
                    <div className="bnk-kv-value">{fmt(le.angefragt_am)}</div>
                  </div>
                  {le.beantwortet_am && (
                    <div className="bnk-kv">
                      <div className="bnk-kv-label">Beantwortet am</div>
                      <div className="bnk-kv-value">{fmt(le.beantwortet_am)}</div>
                    </div>
                  )}
                  {le.kanal && (
                    <div className="bnk-kv">
                      <div className="bnk-kv-label">Kanal</div>
                      <div className="bnk-kv-value" style={{ textTransform: 'capitalize' }}>{le.kanal}</div>
                    </div>
                  )}
                  {le.notiz && (
                    <div className="bnk-kv">
                      <div className="bnk-kv-label">Notiz</div>
                      <div className="bnk-kv-value">{le.notiz}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Bankdaten ── */}
        <div className="bnk-card">
          <div className="bnk-card-title">🏦 Bankdaten</div>

          <div className="bnk-kv">
            <div className="bnk-kv-label">IBAN</div>
            <div style={{ flex: 1 }}>
              {editMode
                ? <>
                    <input className="bnk-input bnk-mono" type="text" value={updatedData.iban || ''} onChange={e => handleChange(e, 'iban')} placeholder="DE89 3704 0044 0532 0130 00" style={{ width: '100%' }} />
                    <IbanDiagnostic iban={updatedData.iban} />
                    <IbanRechner onUebernehmen={result => {
                      setUpdatedData(prev => ({
                        ...prev,
                        iban: result.iban,
                        ...(result.bic ? { bic: result.bic } : {}),
                        ...(result.bankname ? { bankname: result.bankname } : {}),
                      }));
                    }} />
                  </>
                : <>
                    <div className={`bnk-kv-value bnk-mono${mitglied.iban ? '' : ' bnk-empty'}`}>{mitglied.iban || '—'}</div>
                    {mitglied.iban && <IbanDiagnostic iban={mitglied.iban} />}
                  </>
              }
            </div>
          </div>

          <div className="bnk-kv">
            <div className="bnk-kv-label">BIC</div>
            {editMode
              ? <input className="bnk-input bnk-mono" type="text" value={updatedData.bic || ''} onChange={e => handleChange(e, 'bic')} placeholder="COBADEFFXXX" />
              : <div className={`bnk-kv-value bnk-mono${mitglied.bic ? '' : ' bnk-empty'}`}>{mitglied.bic || '—'}</div>
            }
          </div>

          <div className="bnk-kv">
            <div className="bnk-kv-label">Bank</div>
            {editMode
              ? <input className="bnk-input" type="text" value={updatedData.bankname || ''} onChange={e => handleChange(e, 'bankname')} placeholder="Commerzbank AG" />
              : <div className={mitglied.bankname ? 'bnk-kv-value' : 'bnk-empty'}>{mitglied.bankname || '—'}</div>
            }
          </div>

          <div className="bnk-kv">
            <div className="bnk-kv-label">Kontoinhaber</div>
            {editMode
              ? <input className="bnk-input" type="text" value={updatedData.kontoinhaber || ''} onChange={e => handleChange(e, 'kontoinhaber')} placeholder="Max Mustermann" />
              : <div className="bnk-kv-value">{mitglied.kontoinhaber || `${mitglied.vorname} ${mitglied.nachname}`}</div>
            }
          </div>

          <div className="bnk-kv">
            <div className="bnk-kv-label">Zahlungsmethode</div>
            {editMode
              ? <CustomSelect
                  value={updatedData.zahlungsmethode || ''}
                  onChange={e => handleChange(e, 'zahlungsmethode')}
                  options={[
                    { value: 'SEPA-Lastschrift', label: 'SEPA-Lastschrift' },
                    { value: 'Lastschrift',      label: 'Lastschrift'      },
                    { value: 'Bar',              label: 'Bar'              },
                    { value: 'Überweisung',      label: 'Überweisung'      }
                  ]}
                />
              : <div className={mitglied.zahlungsmethode ? 'bnk-kv-value' : 'bnk-empty'}>{mitglied.zahlungsmethode || '—'}</div>
            }
          </div>

          <div className="bnk-kv">
            <div className="bnk-kv-label">Zahllaufgruppe</div>
            {editMode
              ? <input className="bnk-input" type="text" value={updatedData.zahllaufgruppe || ''} onChange={e => handleChange(e, 'zahllaufgruppe')} placeholder="01" />
              : <div className={mitglied.zahllaufgruppe ? 'bnk-kv-value' : 'bnk-empty'}>{mitglied.zahllaufgruppe || '—'}</div>
            }
          </div>
        </div>

        {/* ── SEPA-Mandat ── */}
        <div className="bnk-card">
          <div className="bnk-card-title">📋 SEPA-Lastschriftmandat</div>

          {sepaMandate ? (
            <>
              <div className={`bnk-mandate-status${sepaMandate.widerruf_datum ? ' bnk-mandate-status--revoked' : ' bnk-mandate-status--active'}`}>
                <div className="bnk-mandate-status-dot" />
                <div className="bnk-mandate-status-text">{sepaMandate.widerruf_datum ? 'Widerrufen' : 'Aktiv'}</div>
                <div className="bnk-mandate-ref">{sepaMandate.mandatsreferenz}</div>
              </div>

              <div className="bnk-kv">
                <div className="bnk-kv-label">Erstellt am</div>
                <div className="bnk-kv-value">{new Date(sepaMandate.erstellungsdatum).toLocaleDateString('de-DE')}</div>
              </div>
              <div className="bnk-kv">
                <div className="bnk-kv-label">Gültig bis</div>
                <div className="bnk-kv-value">{sepaMandate.ablaufdatum ? new Date(sepaMandate.ablaufdatum).toLocaleDateString('de-DE') : 'Unbefristet'}</div>
              </div>
              <div className="bnk-kv">
                <div className="bnk-kv-label">Gläubiger-ID</div>
                <div className="bnk-kv-value bnk-mono">{sepaMandate.glaeubiger_id}</div>
              </div>
              <div className="bnk-kv">
                <div className="bnk-kv-label">IBAN (Mandat)</div>
                <div className="bnk-kv-value bnk-mono">
                  {sepaMandate.iban ? `${sepaMandate.iban.slice(0, 4)} **** **** ${sepaMandate.iban.slice(-4)}` : '—'}
                </div>
              </div>
              <div className="bnk-kv">
                <div className="bnk-kv-label">Kontoinhaber</div>
                <div className="bnk-kv-value">{sepaMandate.kontoinhaber}</div>
              </div>
              {sepaMandate.widerruf_datum && (
                <div className="bnk-kv">
                  <div className="bnk-kv-label">Widerrufen am</div>
                  <div className="bnk-kv-value bnk-red">{new Date(sepaMandate.widerruf_datum).toLocaleDateString('de-DE')}</div>
                </div>
              )}
              <div className="bnk-actions">
                <button className="bnk-btn" onClick={() => downloadSepaMandate()}>Mandat herunterladen</button>
                <button className="bnk-btn bnk-btn--danger" onClick={() => revokeSepaMandate()}>Mandat widerrufen</button>
              </div>
            </>
          ) : (
            <div className="bnk-no-mandate">
              <div className="bnk-no-mandate-icon">📄</div>
              <div className="bnk-no-mandate-text">Kein SEPA-Mandat vorhanden</div>
              {mitglied?.iban && mitglied?.bic ? (
                <button
                  className="bnk-btn bnk-btn--primary"
                  onClick={() => generateSepaMandate()}
                  disabled={generatingMandate}
                >
                  {generatingMandate ? 'Erstelle Mandat…' : 'SEPA-Mandat erstellen'}
                </button>
              ) : (
                <div className="bnk-info-box">
                  Bitte zuerst IBAN und BIC hinterlegen, um ein SEPA-Mandat zu erstellen.
                </div>
              )}
            </div>
          )}

          <div className="bnk-legal">
            <div className="bnk-legal-title">Rechtliche Grundlagen</div>
            <div className="bnk-legal-text">
              Das SEPA-Lastschriftmandat berechtigt den Zahlungsempfänger, Zahlungen vom Konto des Zahlungspflichtigen
              mittels Lastschrift einzuziehen. Zugleich wird die Bank des Zahlungspflichtigen zur Einlösung der Lastschrift angewiesen.
            </div>
            <div className="bnk-legal-text">
              <strong>Hinweis:</strong> Der Zahlungspflichtige kann innerhalb von acht Wochen, beginnend mit dem
              Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit der Bank vereinbarten Bedingungen.
            </div>
          </div>
        </div>

      </div>
    )}

    {financeSubTab === "einkäufe" && (
      <MitgliedEinkäufeTab mitgliedId={id} activeDojo={activeDojo} />
    )}

    {financeSubTab === "ratenzahlung" && (
      <RatenzahlungTab
        mitglied_id={id}
        monatsbeitrag={parseFloat(
          beitraege?.aktuellerVertrag?.monatsbeitrag ||
          beitraege?.monatsbeitrag ||
          0
        )}
      />
    )}

    {financeSubTab === "gutscheine" && (
      <MitgliedGutscheineTab mitgliedId={id} activeDojo={activeDojo} />
    )}
  </div>
  )}
        {/* Ruhepause Modal */}
        {showRuhepauseModal && (
          <div className="modal-overlay" onClick={() => setShowRuhepauseModal(false)}>
            <div className="modal-content large" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Ruhepause einrichten</h3>
                <button
                  className="close-btn"
                  onClick={() => setShowRuhepauseModal(false)}
                >
                  ✕
                </button>
              </div>
            
              <div className="info-section">
                <h4>ℹ️ Was bedeutet Ruhepause?</h4>
                <ul>
                  <li>Das Training wird temporär ausgesetzt</li>
                  <li>Die Mitgliedschaft bleibt bestehen</li>
                  <li>Keine Beitragszahlungen während der Ruhepause</li>
                  <li>Vertrag wird nicht im Lastschriftlauf berücksichtigt</li>
                  <li>Nach der Ruhepause automatische Reaktivierung</li>
                  <li>Maximale Ruhepause: 12 Monate pro Jahr</li>
                </ul>
              </div>

              <div className="ruhepause-config-container">
                <div className="ruhepause-duration-selection">
                  <label>Dauer der Ruhepause *</label>
                  <CustomSelect
                    value={ruhepauseDauer}
                    onChange={(e) => setRuhepauseDauer(parseInt(e.target.value))}
                    options={[
                      { value: 1, label: '1 Monat' },
                      { value: 2, label: '2 Monate' },
                      { value: 3, label: '3 Monate' },
                      { value: 4, label: '4 Monate' },
                      { value: 5, label: '5 Monate' },
                      { value: 6, label: '6 Monate' },
                      { value: 9, label: '9 Monate' },
                      { value: 12, label: '12 Monate' }
                    ]}
                  />
                  <small>Ruhepausen gelten immer für volle Monate</small>
                </div>

                <div className="date-info">
                  <h5>📅 Zeitraum</h5>
                  <p><strong>Von:</strong> {(() => {
                    const von = new Date();
                    von.setMonth(von.getMonth() + 1); // Nächster Monat
                    von.setDate(1); // Erster Tag des nächsten Monats
                    return von.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  })()}</p>
                  <p><strong>Bis:</strong> {(() => {
                    const bis = new Date();
                    bis.setMonth(bis.getMonth() + 1 + ruhepauseDauer); // Nächster Monat + Dauer
                    bis.setDate(0); // Letzter Tag des Monats
                    return bis.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  })()}</p>
                </div>

                <div className="warning-section">
                  <h5>⚠️ Wichtiger Hinweis</h5>
                  <p>Die Ruhepause beginnt am 1. des nächsten Monats (aktueller Monat ist bereits abgebucht). Das Training kann für die gewählte Dauer nicht besucht werden. Keine Lastschrifteinzüge während der Ruhepause.</p>
                </div>
              </div>
            
              <div className="form-actions">
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRuhepauseModal(false)}
                >
                  Abbrechen
                </button>
                <button 
                  type="submit"
                  className="btn btn-warning"
                  onClick={handleRuhepauseConfirm}
                >
                  ⏸️ Ruhepause für {ruhepauseDauer} Monat{ruhepauseDauer > 1 ? 'e' : ''} einrichten
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Kündigung Modal */}
        {showKündigungModal && (
          <div className="modal-overlay" onClick={() => setShowKündigungModal(false)}>
            <div className="modal-content extra-large" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Vertrag kündigen</h3>
                <button
                  className="close-btn"
                  onClick={() => setShowKündigungModal(false)}
                >
                  ✕
                </button>
              </div>
            
              <div className="cancellation-terms">
                <h4>📋 Kündigungsbestimmungen</h4>

                <div className="terms-sections-container">
                  <div className="terms-section">
                    <h5>⏰ Kündigungsfristen:</h5>
                    <ul>
                      <li><strong>Erstlaufzeit:</strong> Kündigung bis 3 Monate vor Vertragsende möglich</li>
                      <li><strong>Nach Verlängerung:</strong> Kündigung mit 1 Monat Frist zum Monatsende</li>
                      <li><strong>Sonderkündigungsrecht:</strong> Bei Umzug über 25km Entfernung (Nachweis erforderlich)</li>
                    </ul>
                  </div>

                  <div className="terms-section">
                    <h5>📋 Kündigungsregelungen:</h5>
                    <ul>
                      <li>Bei vorzeitiger Kündigung: Zahlung der Restlaufzeit</li>
                      <li>Keine Rückerstattung bereits gezahlter Beiträge</li>
                    </ul>
                  </div>

                  <div className="current-contract-info">
                    <h5>📄 Aktueller Vertrag:</h5>
                    <p><strong>Vertragslaufzeit:</strong> {selectedVertragForAction?.vertragsbeginn ? new Date(selectedVertragForAction.vertragsbeginn).toLocaleDateString('de-DE') : '-'} - {selectedVertragForAction?.vertragsende ? new Date(selectedVertragForAction.vertragsende).toLocaleDateString('de-DE') : '-'}</p>
                    <p><strong>Früheste Kündigung:</strong> {(() => {
                      if (!selectedVertragForAction) return 'Berechnung nicht möglich';
                      const vertragsende = new Date(selectedVertragForAction.vertragsende);
                      const fruehestKündigung = new Date(vertragsende);
                      fruehestKündigung.setMonth(vertragsende.getMonth() - 3);
                      return fruehestKündigung.toLocaleDateString('de-DE');
                    })()}</p>
                    <p><strong>Vertragsende:</strong> {new Date(selectedVertragForAction?.vertragsende || '').toLocaleDateString('de-DE')}</p>
                  </div>
                </div>
              </div>

              <div className="kuendigung-form-container">
                <div className="form-group">
                  <label>Kündigungsdatum *</label>
                  <input
                    type="date"
                    value={kuendigungsdatum}
                    onChange={(e) => setKündigungsdatum(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <small>Das Datum, an dem die Kündigung eingegangen ist</small>
                </div>

                <div className="form-group">
                  <label>Kündigungsgrund (Optional)</label>
                  <CustomSelect
                    value={kuendigungsgrund}
                    onChange={(e) => setKündigungsgrund(e.target.value)}
                    options={[
                      { value: '', label: 'Bitte wählen...' },
                      { value: 'umzug', label: 'Umzug' },
                      { value: 'finanzielle-gruende', label: 'Finanzielle Gründe' },
                      { value: 'zeitmangel', label: 'Zeitmangel' },
                      { value: 'krankheit', label: 'Krankheit/Verletzung' },
                      { value: 'unzufriedenheit', label: 'Unzufriedenheit mit Service' },
                      { value: 'anderer-verein', label: 'Wechsel zu anderem Verein' },
                      { value: 'sonstiges', label: 'Sonstiges' }
                    ]}
                  />
                </div>

                <div className="confirmation-section-inline">
                  <label className="checkbox-container">
                    <input
                      type="checkbox"
                      checked={kuendigungsbestätigung}
                      onChange={(e) => setKündigungsbestätigung(e.target.checked)}
                    />
                    <span className="checkmark"></span>
                    <div className="confirmation-text">
                      <strong>⚠️ Bestätigung erforderlich:</strong>
                      <p>Ich habe die Kündigungsbestimmungen gelesen und verstanden. Mir ist bewusst, dass bei vorzeitiger Kündigung die Restlaufzeit zu zahlen ist und keine Rückerstattung bereits gezahlter Beiträge erfolgt.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowKündigungModal(false)}
                >
                  Abbrechen
                </button>
                <button 
                  type="submit"
                  className="btn btn-danger"
                  onClick={handleKündigungConfirm}
                  disabled={!kuendigungsbestätigung}
                >
                  ❌ Vertrag kündigen
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Details-Modal - Dokument-ähnliche VertragsÜbersicht */}
        {showVertragDetails && selectedVertrag && (
          <div
            className="modal-overlay mds-vertrag-detail-overlay"
            onClick={() => setShowVertragDetails(false)}
          >
            <div
              className="vertrag-dokument mds-vertrag-dokument-box"
              onClick={e => e.stopPropagation()}
            >
              <style>{`
                .vertrag-dokument .detail-item {
                  color: #333;
                  margin-bottom: 0.5rem;
                }
                .vertrag-dokument .detail-item strong {
                  color: #555;
                }
                .vertrag-dokument * {
                  color: #333;
                }
              `}</style>
              {/* Close Button */}
              <button
                onClick={() => setShowVertragDetails(false)}
                className="mds-vertrag-close-btn"
              >
                ?
              </button>

              {/* Dokument-Inhalt */}
              <div className="mds-vertrag-doc-inner">
                {/* Header */}
                <div className="mds-vertrag-doc-header">
                  <h1 className="mds-vertrag-doc-title">
                    VERTRAGSDETAILS
                  </h1>
                  <div className="mds-vertrag-doc-number">
                    Vertragsnummer: {selectedVertrag.vertragsnummer || `VTR-${selectedVertrag.id}`}
                  </div>
                </div>

                {/* Status Badge */}
                <div className={`mds-vertrag-doc-status-box mds-vertrag-doc-status-box--${selectedVertrag.status || 'beendet'}`}>
                  <span className={`mds-vertrag-doc-status-span mds-vertrag-doc-status-span--${selectedVertrag.status || 'beendet'}`}>
                    {selectedVertrag.status === 'aktiv' ? '? VERTRAG AKTIV' :
                     selectedVertrag.status === 'gekuendigt' ? '? VERTRAG GEKÜNDIGT' :
                     selectedVertrag.status === 'ruhepause' ? '? VERTRAG IN RUHEPAUSE' : '? VERTRAG BEENDET'}
                  </span>
                </div>

                {/* Grunddaten */}
                <div className="mds-vertrag-doc-section">
                  <h3 className="mds-vertrag-doc-section-title">📋 Grunddaten</h3>
                  <div className="mds-vertrag-doc-grid-2">
                    <div className="mds-vertrag-doc-mb05">
                      <strong className="mds-vertrag-doc-strong">Vertrags-ID:</strong> #{selectedVertrag.id}
                    </div>
                    {selectedVertrag.vertragsnummer && (
                      <div className="detail-item">
                        <strong>Vertragsnummer:</strong> {selectedVertrag.vertragsnummer}
                      </div>
                    )}
                    <div className="detail-item">
                      <strong>Mitglied-ID:</strong> #{selectedVertrag.mitglied_id}
                    </div>
                    <div className="detail-item">
                      <strong>Dojo:</strong> {getDojoName(selectedVertrag.dojo_id)}
                    </div>
                    <div className="detail-item">
                      <strong>Status:</strong> {
                        selectedVertrag.status === 'aktiv' ? '✅ Aktiv' :
                        selectedVertrag.status === 'gekuendigt' ? '❌ Gekündigt' :
                        selectedVertrag.status === 'ruhepause' ? '⏸️ Ruhepause' : '⏹️ Beendet'
                      }
                    </div>
                    <div className="detail-item">
                      <strong>Erstellt am:</strong> {new Date(selectedVertrag.created_at || selectedVertrag.unterschrift_datum).toLocaleString('de-DE')}
                    </div>
                    {selectedVertrag.created_by && (
                      <div className="detail-item">
                        <strong>Erstellt von (User-ID):</strong> #{selectedVertrag.created_by}
                      </div>
                    )}
                    {selectedVertrag.updated_at && (
                      <div className="detail-item">
                        <strong>Zuletzt geändert:</strong> {new Date(selectedVertrag.updated_at).toLocaleString('de-DE')}
                      </div>
                    )}
                    {selectedVertrag.updated_by && (
                      <div className="detail-item">
                        <strong>Geändert von (User-ID):</strong> #{selectedVertrag.updated_by}
                      </div>
                    )}
                    {selectedVertrag.tarif_id && (
                      <div className="detail-item">
                        <strong>Tarif-ID:</strong> #{selectedVertrag.tarif_id}
                      </div>
                    )}
                    {selectedVertrag.tarif_name && (
                      <div className="detail-item">
                        <strong>📋 Tarif-Name:</strong> {selectedVertrag.tarif_name}
                      </div>
                    )}
                    {selectedVertrag.monatsbeitrag && (
                      <div className="detail-item">
                        <strong>💰 Monatsbeitrag:</strong> €{parseFloat(selectedVertrag.monatsbeitrag).toFixed(2)}
                      </div>
                    )}
                    {selectedVertrag.aufnahmegebuehr_cents && (
                      <div className="detail-item">
                        <strong>💵 Aufnahmegebühr:</strong> €{(selectedVertrag.aufnahmegebuehr_cents / 100).toFixed(2)}
                      </div>
                    )}
                    <div className="detail-item">
                      <strong>📄 Vertrags-PDF:</strong>{' '}
                      <button
                        className="btn btn-sm btn-primary mds-pdf-inline-btn"
                        onClick={() => downloadVertragPDF(selectedVertrag.id)}
                      >
                        📄 PDF
                      </button>
                    </div>
                  </div>
                </div>

                {/* Laufzeit */}
                {(selectedVertrag.vertragsbeginn || selectedVertrag.vertragsende) && (
                  <div className="mds-vertrag-doc-section">
                    <h3 className="mds-vertrag-doc-section-title">📅 Laufzeit</h3>
                    <div className="mds-vertrag-doc-grid-2">
                      {selectedVertrag.vertragsbeginn && (
                        <div className="detail-item">
                          <strong>Vertragsbeginn:</strong> {new Date(selectedVertrag.vertragsbeginn).toLocaleDateString('de-DE')}
                        </div>
                      )}
                      {selectedVertrag.vertragsende && (
                        <div className="detail-item">
                          <strong>Vertragsende:</strong> {new Date(selectedVertrag.vertragsende).toLocaleDateString('de-DE')}
                        </div>
                      )}
                      <div className="detail-item">
                        <strong>Mindestlaufzeit:</strong> {selectedVertrag.mindestlaufzeit_monate} Monate
                      </div>
                      <div className="detail-item">
                        <strong>Kündigungsfrist:</strong> {selectedVertrag.kuendigungsfrist_monate} Monate vor Vertragsende
                      </div>
                      <div className="detail-item">
                        <strong>Autom. Verlängerung:</strong> {selectedVertrag.automatische_verlaengerung ? `Ja (um ${selectedVertrag.verlaengerung_monate} Monate)` : 'Nein'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Zahlung */}
                <div className="mds-vertrag-doc-section">
                  <h3 className="mds-vertrag-doc-section-title">💳 Zahlungsinformationen</h3>
                  <div className="mds-vertrag-doc-grid-2">
                    {selectedVertrag.billing_cycle && (
                      <div className="detail-item">
                        <strong>Zahlungsintervall:</strong> {translateBillingCycle(selectedVertrag.billing_cycle)}
                      </div>
                    )}
                    {selectedVertrag.payment_method && (
                      <div className="detail-item">
                        <strong>Zahlungsmethode:</strong> {
                          selectedVertrag.payment_method === 'direct_debit' ? 'SEPA-Lastschrift' :
                          selectedVertrag.payment_method === 'transfer' ? 'Überweisung' :
                          selectedVertrag.payment_method === 'bar' ? 'Bar' : selectedVertrag.payment_method
                        }
                      </div>
                    )}
                    {selectedVertrag.sepa_mandat_id && (
                      <div className="detail-item">
                        <strong>SEPA-Mandat-ID:</strong> #{selectedVertrag.sepa_mandat_id}
                      </div>
                    )}
                    {selectedVertrag.faelligkeit_tag && (
                      <div className="detail-item">
                        <strong>Fälligkeitstag:</strong> {selectedVertrag.faelligkeit_tag}. des Monats
                      </div>
                    )}
                    {selectedVertrag.monatsbeitrag && (
                      <div className="detail-item">
                        <strong>Monatsbeitrag:</strong> €{parseFloat(selectedVertrag.monatsbeitrag).toFixed(2)}
                      </div>
                    )}
                    {selectedVertrag.aufnahmegebuehr_cents && (
                      <div className="detail-item">
                        <strong>Aufnahmegebühr:</strong> €{(selectedVertrag.aufnahmegebuehr_cents / 100).toFixed(2)}
                      </div>
                    )}
                    {selectedVertrag.rabatt_prozent > 0 && (
                      <div className="detail-item">
                        <strong>Rabatt:</strong> {selectedVertrag.rabatt_prozent}%
                        {selectedVertrag.rabatt_grund && ` (${selectedVertrag.rabatt_grund})`}
                      </div>
                    )}
                  </div>
                </div>

                {/* Rechtliche Akzeptanzen */}
                <div className="mds-vertrag-doc-section">
                  <h3 className="mds-vertrag-doc-section-title">? Rechtliche Akzeptanzen</h3>
                  <div className="mds-vertrag-doc-grid-2">
                    {selectedVertrag.agb_akzeptiert_am && (
                      <div className="detail-item">
                        <strong>AGB:</strong> ✅ Akzeptiert am {new Date(selectedVertrag.agb_akzeptiert_am).toLocaleString('de-DE')}
                        {selectedVertrag.agb_version && ` (v${selectedVertrag.agb_version})`}
                      </div>
                    )}
                    {selectedVertrag.datenschutz_akzeptiert_am && (
                      <div className="detail-item">
                        <strong>Datenschutz:</strong> ? Akzeptiert am {new Date(selectedVertrag.datenschutz_akzeptiert_am).toLocaleString('de-DE')}
                        {selectedVertrag.datenschutz_version && ` (v${selectedVertrag.datenschutz_version})`}
                      </div>
                    )}
                    {selectedVertrag.hausordnung_akzeptiert_am && (
                      <div className="detail-item">
                        <strong>Hausordnung:</strong> ? Akzeptiert am {new Date(selectedVertrag.hausordnung_akzeptiert_am).toLocaleString('de-DE')}
                      </div>
                    )}
                    <div className="detail-item">
                      <strong>Haftungsausschluss (boolean):</strong> {selectedVertrag.haftungsausschluss_akzeptiert ? '? Ja' : '? Nein'}
                    </div>
                    {selectedVertrag.haftungsausschluss_datum && (
                      <div className="detail-item">
                        <strong>Haftungsausschluss Datum:</strong> ? Akzeptiert am {new Date(selectedVertrag.haftungsausschluss_datum).toLocaleString('de-DE')}
                      </div>
                    )}
                    <div className="detail-item">
                      <strong>Gesundheitserklärung (boolean):</strong> {selectedVertrag.gesundheitserklaerung ? '? Ja' : '? Nein'}
                    </div>
                    {selectedVertrag.gesundheitserklaerung_datum && (
                      <div className="detail-item">
                        <strong>Gesundheitserklärung Datum:</strong> ? Abgegeben am {new Date(selectedVertrag.gesundheitserklaerung_datum).toLocaleString('de-DE')}
                      </div>
                    )}
                    <div className="detail-item">
                      <strong>Foto-Einverständnis (boolean):</strong> {selectedVertrag.foto_einverstaendnis ? '? Ja' : '? Nein'}
                    </div>
                    {selectedVertrag.foto_einverstaendnis_datum && (
                      <div className="detail-item">
                        <strong>Foto-Einverständnis Datum:</strong> ? Erteilt am {new Date(selectedVertrag.foto_einverstaendnis_datum).toLocaleString('de-DE')}
                      </div>
                    )}
                    {selectedVertrag.widerruf_akzeptiert_am && (
                      <div className="detail-item">
                        <strong>Widerrufsbelehrung:</strong> ? Zur Kenntnis genommen am {new Date(selectedVertrag.widerruf_akzeptiert_am).toLocaleString('de-DE')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Unterschrift */}
                {selectedVertrag.unterschrift_datum && (
                  <div className="mds-vertrag-doc-section">
                    <h3 className="mds-vertrag-doc-section-title">✍️ Unterschrift</h3>
                    <div className="mds-vertrag-doc-grid-2">
                      <div className="detail-item">
                        <strong>Unterschrieben am:</strong> {new Date(selectedVertrag.unterschrift_datum).toLocaleString('de-DE')}
                      </div>
                      {selectedVertrag.unterschrift_ip && (
                        <div className="detail-item">
                          <strong>IP-Adresse:</strong> {selectedVertrag.unterschrift_ip}
                        </div>
                      )}
                    </div>
                    {selectedVertrag.unterschrift_digital && (
                      <div className="mds2-mt-1">
                        <strong>Digitale Unterschrift:</strong>
                        <div className="mds-vertrag-unterschrift-box">
                          <img
                            src={selectedVertrag.unterschrift_digital}
                            alt="Digitale Unterschrift"
                            className="mds-vertrag-unterschrift-img"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Status-Informationen */}
                {selectedVertrag.kuendigung_eingegangen && (
                  <div className="mds-vertrag-kuendigung-section">
                    <h3 className="mds-vertrag-kuendigung-title">ℹ️ Kündigungsinformationen</h3>
                    <div className="mds-vertrag-doc-grid-2">
                      <div className="detail-item">
                        <strong>Kündigung eingegangen:</strong> {new Date(selectedVertrag.kuendigung_eingegangen).toLocaleString('de-DE')}
                      </div>
                      {selectedVertrag.kuendigungsgrund && (
                        <div className="detail-item">
                          <strong>Kündigungsgrund:</strong> {selectedVertrag.kuendigungsgrund}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Drucken/Schließen Buttons */}
                <div className="mds-vertrag-print-row">
                  <button
                    onClick={() => window.print()}
                    className="mds-vertrag-print-btn"
                  >
                    🖨️ Drucken
                  </button>
                  <button
                    onClick={() => setShowVertragDetails(false)}
                    className="mds-vertrag-close-doc-btn"
                  >
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Strukturiertes Details-Modal - Alle Vertragsdaten übersichtlich */}
        {showStructuredDetails && selectedVertrag && (
          <div
            className="modal-overlay mds-structured-detail-overlay"
            onClick={() => setShowStructuredDetails(false)}
          >
            <div
              className="mds-structured-detail-box"
              onClick={e => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowStructuredDetails(false)}
                className="mds-structured-close-btn"
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#d32f2f';
                  e.currentTarget.style.transform = 'scale(1.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(244, 67, 54, 0.9)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                ×
              </button>

              {/* Header */}
              <div className="mds-structured-header">
                <h2 className="mds-structured-title">
                  🔍 Vertragsdetails
                </h2>
                <p className="mds-structured-subtitle">
                  Vertrag #{selectedVertrag.personenVertragNr} • {mitglied?.vorname} {mitglied?.nachname}
                </p>
              </div>

              {/* Content */}
              <div className="mds2-p-2">
                {/* Status Badge */}
                <div className={`mds-vertrag-badge mds-vertrag-badge--${selectedVertrag.status || 'beendet'}`}>
                  {selectedVertrag.status === 'aktiv' ? '✅ AKTIV' :
                   selectedVertrag.status === 'gekuendigt' ? '⚠️ GEKÜNDIGT' :
                   selectedVertrag.status === 'ruhepause' ? '⏸️ RUHEPAUSE' :
                   selectedVertrag.status === 'abgelaufen' ? '❌ ABGELAUFEN' : selectedVertrag.status?.toUpperCase()}
                </div>

                {/* Grid Layout für Daten */}
                <div className="mds-structured-data-grid">
                  {/* Grunddaten */}
                  <div className="mds-structured-card">
                    <h3 className="mds-structured-card-title">
                      📋 Grunddaten
                    </h3>
                    <div className="mds-flex-col">
                      <div>
                        <div className="mds-info-label">Vertragsnummer</div>
                        <div className="mds-info-value">{selectedVertrag.vertragsnummer || `VTR-${selectedVertrag.id}`}</div>
                      </div>
                      <div>
                        <div className="mds-info-label">Mitglieds-ID</div>
                        <div className="mds-info-value">{selectedVertrag.mitglied_id}</div>
                      </div>
                      {selectedVertrag.dojo_id && (
                        <div>
                          <div className="mds-info-label">Dojo</div>
                          <div className="mds-info-value">{getDojoName(selectedVertrag.dojo_id)}</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Laufzeit */}
                  <div className="mds-structured-card">
                    <h3 className="mds-structured-card-title">
                      📅 Laufzeit
                    </h3>
                    <div className="mds-flex-col">
                      <div>
                        <div className="mds-info-label">Vertragsbeginn</div>
                        <div className="mds-info-value">
                          {selectedVertrag.vertragsbeginn ? new Date(selectedVertrag.vertragsbeginn).toLocaleDateString('de-DE') : 'Nicht angegeben'}
                        </div>
                      </div>
                      <div>
                        <div className="mds-info-label">Vertragsende</div>
                        <div className="mds-info-value">
                          {selectedVertrag.vertragsende ? new Date(selectedVertrag.vertragsende).toLocaleDateString('de-DE') : 'Unbefristet'}
                        </div>
                      </div>
                      <div>
                        <div className="mds-info-label">Mindestlaufzeit</div>
                        <div className="mds-info-value">
                          {selectedVertrag.mindestlaufzeit_monate ? `${selectedVertrag.mindestlaufzeit_monate} Monate` : 'Keine Mindestlaufzeit'}
                        </div>
                      </div>
                      <div>
                        <div className="mds-info-label">Kündigungsfrist</div>
                        <div className="mds-info-value">
                          {selectedVertrag.kuendigungsfrist_monate ? `${selectedVertrag.kuendigungsfrist_monate} Monate` : 'Keine Angabe'}
                        </div>
                      </div>
                      <div>
                        <div className="mds-info-label">Automatische Verlängerung</div>
                        <div className="mds-info-value">
                          {selectedVertrag.automatische_verlaengerung ? '✅ Ja' : '❌ Nein'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Zahlungsinformationen */}
                  <div className="mds-structured-card">
                    <h3 className="mds-structured-card-title">
                      💰 Zahlung
                    </h3>
                    <div className="mds-flex-col">
                      <div>
                        <div className="mds-info-label">Tarif</div>
                        <div className="mds-info-value">
                          {tarife.find(t => t.id === selectedVertrag.tarif_id)?.name || 'Kein Tarif'}
                        </div>
                      </div>
                      <div>
                        <div className="mds-info-label">Beitrag</div>
                        <div className="mds2-success-value">
                          {selectedVertrag.monatsbeitrag ? `${parseFloat(selectedVertrag.monatsbeitrag).toFixed(2)} €` : 'Nicht festgelegt'}
                        </div>
                      </div>
                      {selectedVertrag.aufnahmegebuehr_cents && (
                        <div>
                          <div className="mds-info-label">Aufnahmegebühr</div>
                          <div className="mds-aufnahme-value">
                            {(selectedVertrag.aufnahmegebuehr_cents / 100).toFixed(2)} €
                          </div>
                        </div>
                      )}
                      <div>
                        <div className="mds-info-label">Zahlungsrhythmus</div>
                        <div className="mds-info-value">
                          {selectedVertrag.billing_cycle ? translateBillingCycle(selectedVertrag.billing_cycle) : 'Nicht angegeben'}
                        </div>
                      </div>
                      <div>
                        <div className="mds-info-label">Zahlungsart</div>
                        <div className="mds-info-value">
                          {selectedVertrag.payment_method === 'direct_debit' ? '🏦 Lastschrift' :
                           selectedVertrag.payment_method === 'bank_transfer' ? '💳 Überweisung' :
                           selectedVertrag.payment_method === 'cash' ? '💵 Bar' :
                           selectedVertrag.payment_method || 'Nicht angegeben'}
                        </div>
                      </div>
                      <div>
                        <div className="mds-info-label">Lastschrift-Status</div>
                        <div className="mds-info-value">
                          {selectedVertrag.lastschrift_status === 'aktiv' ? '✅ Aktiv' :
                           selectedVertrag.lastschrift_status === 'ausstehend' ? '⏳ Ausstehend' :
                           selectedVertrag.lastschrift_status === 'fehlgeschlagen' ? '❌ Fehlgeschlagen' :
                           selectedVertrag.lastschrift_status || 'Keine Angabe'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ruhepause Info (falls vorhanden) */}
                {selectedVertrag.status === 'ruhepause' && selectedVertrag.ruhepause_von && (
                  <div className="mds-structured-ruhepause-card">
                    <h3 className="mds-structured-ruhepause-title">
                      ⏸️ Ruhepause
                    </h3>
                    <div className="mds2-grid-auto-200">
                      <div>
                        <div className="mds2-secondary-sublabel">Von</div>
                        <div className="mds-info-value">
                          {new Date(selectedVertrag.ruhepause_von).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                      <div>
                        <div className="mds2-secondary-sublabel">Bis</div>
                        <div className="mds-info-value">
                          {selectedVertrag.ruhepause_bis ? new Date(selectedVertrag.ruhepause_bis).toLocaleDateString('de-DE') : 'Nicht festgelegt'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Kündigungsinfo (falls vorhanden) */}
                {selectedVertrag.status === 'gekuendigt' && selectedVertrag.kuendigung_eingegangen && (
                  <div className="mds-structured-kuendigung-card">
                    <h3 className="mds-structured-kuendigung-title">
                      ⚠️ Kündigung
                    </h3>
                    <div className="mds2-grid-auto-200">
                      <div>
                        <div className="mds2-secondary-sublabel">Kündigung eingegangen</div>
                        <div className="mds-info-value">
                          {new Date(selectedVertrag.kuendigung_eingegangen).toLocaleDateString('de-DE')}
                        </div>
                      </div>
                      {selectedVertrag.kuendigungsgrund && (
                        <div>
                          <div className="mds2-secondary-sublabel">Kündigungsgrund</div>
                          <div className="mds-info-value">
                            {selectedVertrag.kuendigungsgrund}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Button für Kündigungsbestätigung PDF */}
                    <div className="mds-structured-kuendigung-btn-row">
                      <button
                        onClick={() => {
                          openApiBlob(`${config.apiBaseUrl}/vertraege/${selectedVertrag.id}/kuendigungsbestaetigung`);
                        }}
                        className="mds-kuendigung-pdf-btn"
                        onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 152, 0, 0.3)'}
                        onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 152, 0, 0.2)'}
                      >
                        📄 Kündigungsbestätigung herunterladen
                      </button>
                    </div>
                  </div>
                )}

                {/* Rechtliche Akzeptanzen */}
                <div className="mds-structured-card mds-structured-mb2">
                  <h3 className="mds-structured-card-title">
                    📝 Rechtliche Dokumente
                  </h3>
                  <div className="mds-legal-docs-grid">
                    <div className="u-flex-row-sm">
                      <span className="mds2-fs-12">{selectedVertrag.agb_akzeptiert_am ? '✅' : '❌'}</span>
                      <div>
                        <div className="mds2-text-primary-09">AGB</div>
                        {selectedVertrag.agb_akzeptiert_am && (
                          <div className="mds2-muted-xs">
                            {new Date(selectedVertrag.agb_akzeptiert_am).toLocaleDateString('de-DE')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="u-flex-row-sm">
                      <span className="mds2-fs-12">{selectedVertrag.datenschutz_akzeptiert_am ? '✅' : '❌'}</span>
                      <div>
                        <div className="mds2-text-primary-09">Datenschutz</div>
                        {selectedVertrag.datenschutz_akzeptiert_am && (
                          <div className="mds2-muted-xs">
                            {new Date(selectedVertrag.datenschutz_akzeptiert_am).toLocaleDateString('de-DE')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="u-flex-row-sm">
                      <span className="mds2-fs-12">{selectedVertrag.hausordnung_akzeptiert_am ? '✅' : '❌'}</span>
                      <div>
                        <div className="mds2-text-primary-09">Hausordnung</div>
                        {selectedVertrag.hausordnung_akzeptiert_am && (
                          <div className="mds2-muted-xs">
                            {new Date(selectedVertrag.hausordnung_akzeptiert_am).toLocaleDateString('de-DE')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Zusätzliche Vertragsdaten - Strukturiert */}
                <div className="mds-structured-mb2">
                  <h2 className="mds-structured-more-title">
                    📊 Weitere Vertragsdetails
                  </h2>

                  <div className="mds-structured-extra-grid">
                    {/* Zusätzliche Laufzeit-Details */}
                    {(selectedVertrag.vertragsdauer_monate || selectedVertrag.verlaengerung_monate || selectedVertrag.probezeit_tage) && (
                      <div className="mds-structured-card">
                        <h3 className="mds-structured-card-title">
                          ⏱️ Erweiterte Laufzeit
                        </h3>
                        <div className="mds-flex-col">
                          {selectedVertrag.vertragsdauer_monate && (
                            <div>
                              <div className="mds-info-label">Vertragsdauer</div>
                              <div className="mds-info-value">{selectedVertrag.vertragsdauer_monate} Monate</div>
                            </div>
                          )}
                          {selectedVertrag.verlaengerung_monate && (
                            <div>
                              <div className="mds-info-label">Verlängerung um</div>
                              <div className="mds-info-value">{selectedVertrag.verlaengerung_monate} Monate</div>
                            </div>
                          )}
                          {selectedVertrag.probezeit_tage && (
                            <div>
                              <div className="mds-info-label">Probezeit</div>
                              <div className="mds-info-value">{selectedVertrag.probezeit_tage} Tage</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Rabatte & Sonderkonditionen */}
                    {(selectedVertrag.rabatt_prozent || selectedVertrag.rabatt_betrag) && (
                      <div className="mds-structured-card">
                        <h3 className="mds-structured-card-title">
                          🎁 Rabatte
                        </h3>
                        <div className="mds-flex-col">
                          {selectedVertrag.rabatt_prozent && (
                            <div>
                              <div className="mds-info-label">Rabatt (%)</div>
                              <div className="mds2-success-value">{selectedVertrag.rabatt_prozent}%</div>
                            </div>
                          )}
                          {selectedVertrag.rabatt_betrag && (
                            <div>
                              <div className="mds-info-label">Rabatt (Betrag)</div>
                              <div className="mds2-success-value">{selectedVertrag.rabatt_betrag} €</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SEPA & Banking */}
                    {selectedVertrag.sepa_mandats_id && (
                      <div className="mds-structured-card">
                        <h3 className="mds-structured-card-title">
                          🏦 SEPA-Mandat
                        </h3>
                        <div className="mds-flex-col">
                          <div>
                            <div className="mds-info-label">Mandatsreferenz</div>
                            <div className="mds-mandatsreferenz-value">{selectedVertrag.sepa_mandats_id}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Kündigungsdetails */}
                    {selectedVertrag.gekuendigt_von && (
                      <div className="mds-structured-card">
                        <h3 className="mds-structured-card-title">
                          📝 Kündigungsinfo
                        </h3>
                        <div className="mds-flex-col">
                          <div>
                            <div className="mds-info-label">Gekündigt von</div>
                            <div className="mds-info-value">{selectedVertrag.gekuendigt_von}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ruhepause-Grund */}
                    {selectedVertrag.ruhepause_grund && (
                      <div className="mds-structured-card">
                        <h3 className="mds-structured-card-title">
                          ⏸️ Ruhepause-Details
                        </h3>
                        <div className="mds-flex-col">
                          <div>
                            <div className="mds-info-label">Grund</div>
                            <div className="mds-info-value">{selectedVertrag.ruhepause_grund}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Dokumente & Unterschriften */}
                    {(selectedVertrag.unterschrift_datum || selectedVertrag.dokument_pfad) && (
                      <div className="mds-structured-card">
                        <h3 className="mds-structured-card-title">
                          📄 Dokumente
                        </h3>
                        <div className="mds-flex-col">
                          {selectedVertrag.unterschrift_datum && (
                            <div>
                              <div className="mds-info-label">Unterschriftsdatum</div>
                              <div className="mds-info-value">
                                {new Date(selectedVertrag.unterschrift_datum).toLocaleDateString('de-DE')}
                              </div>
                            </div>
                          )}
                          {selectedVertrag.dokument_pfad && (
                            <div>
                              <div className="mds-info-label">Dokument-Pfad</div>
                              <div className="mds-dokument-pfad-value">{selectedVertrag.dokument_pfad}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notizen & Bemerkungen */}
                    {(selectedVertrag.notizen || selectedVertrag.bemerkung) && (
                      <div className="mds-structured-card">
                        <h3 className="mds-structured-card-title">
                          📝 Notizen
                        </h3>
                        <div className="mds-flex-col">
                          {selectedVertrag.notizen && (
                            <div>
                              <div className="mds-info-label">Notizen</div>
                              <div className="mds2-text-primary-lh">{selectedVertrag.notizen}</div>
                            </div>
                          )}
                          {selectedVertrag.bemerkung && (
                            <div>
                              <div className="mds-info-label">Bemerkung</div>
                              <div className="mds2-text-primary-lh">{selectedVertrag.bemerkung}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Technische Daten */}
                    <div className="mds-structured-card">
                      <h3 className="mds-structured-card-title">
                        🔧 Technische Daten
                      </h3>
                      <div className="mds-flex-col">
                        <div>
                          <div className="mds-info-label">Vertrags-ID</div>
                          <div className="mds-info-value">{selectedVertrag.id}</div>
                        </div>
                        <div>
                          <div className="mds-info-label">Persönliche Vertragsnummer</div>
                          <div className="mds-info-value">#{selectedVertrag.personenVertragNr}</div>
                        </div>
                        {selectedVertrag.magicline_contract_id && (
                          <div>
                            <div className="mds-info-label">Magicline Vertrags-ID</div>
                            <div className="mds-mandatsreferenz-value">{selectedVertrag.magicline_contract_id}</div>
                          </div>
                        )}
                        {selectedVertrag.geloescht !== undefined && (
                          <div>
                            <div className="mds-info-label">Status</div>
                            <div className={selectedVertrag.geloescht ? 'mds-status-geloescht' : 'mds-status-aktiv'}>
                              {selectedVertrag.geloescht ? '🗑️ Gelöscht' : '✅ Aktiv'}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="mds-structured-timestamps">
                  <div>Erstellt: {selectedVertrag.erstellt_am ? new Date(selectedVertrag.erstellt_am).toLocaleString('de-DE') : 'Unbekannt'}</div>
                  {selectedVertrag.aktualisiert_am && (
                    <div>Aktualisiert: {new Date(selectedVertrag.aktualisiert_am).toLocaleString('de-DE')}</div>
                  )}
                </div>

                {/* Close Button */}
                <div className="mds-structured-close-row">
                  <button
                    onClick={() => setShowStructuredDetails(false)}
                    className="mds-structured-close-btn-gold"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 215, 0, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
                    }}
                  >
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Kündigungsbestätigung Modal */}
        {showKündigungBestätigungModal && vertragZumKündigen && (
          <div
            className="modal-overlay mds-kuendigung-confirm-overlay"
            onClick={() => {
              setShowKündigungBestätigungModal(false);
              setVertragZumKündigen(null);
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              className="mds-kuendigung-confirm-box"
            >
              {/* Warnsymbol oben */}
              <div className="mds-kuendigung-warning-icon-row">
                ⚠️
              </div>

              {/* Zentrierte Überschrift */}
              <h2 className="mds-kuendigung-confirm-title">
                ACHTUNG: VERTRAG IST NOCH AKTIV!
              </h2>

              <div className="mds2-mb-15-primary">
                <p>
                  Vertrag <strong className="mds-primary-accent">#{vertragZumKündigen.personenVertragNr}</strong> ist noch aktiv!
                </p>
                <p className="mds-kuendigung-confirm-secondary-text">
                  Möchten Sie den Vertrag trotzdem kündigen?
                </p>
                <p className="mds2-text-primary-09-mt">
                  Bei <strong className="mds-primary-accent">"Ja"</strong> wird der Vertrag gekündigt und in die Archivierten/Ehemaligen verschoben.
                </p>
                <p className="mds2-text-primary-09-mt">
                  Bei <strong className="mds-primary-accent">"Nein"</strong> wird die Aktion abgebrochen.
                </p>
              </div>

              <div className="mds2-flex-end-row">
                <button
                  onClick={() => {
                    setShowKündigungBestätigungModal(false);
                    setVertragZumKündigen(null);
                  }}
                  className="mds-kuendigung-abort-btn"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  Nein
                </button>

                <button
                  onClick={handleKündigungBestätigen}
                  className="mds-kuendigung-confirm-btn"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ff9800 0%, #ffc107 100%)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 193, 7, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 193, 7, 0.3)';
                  }}
                >
                  Ja
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vertrag-Anpassung Modal */}
        {showVertragAnpassungModal && (
          <div
            className="mds-archive-overlay"
            onClick={() => setShowVertragAnpassungModal(false)}
          >
            <div
              className="mds-archive-modal-box"
              style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>🎓 Tarif zeitlich anpassen</h3>
                <button onClick={() => setShowVertragAnpassungModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: 'var(--text-secondary)' }}>✕</button>
              </div>

              {/* Neue Anpassung */}
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '1rem', marginBottom: '1.25rem', border: '1px solid rgba(255,255,255,0.1)' }}>
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Neue Anpassung erstellen</h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Typ</label>
                    <select
                      value={vertragAnpassungForm.typ}
                      onChange={e => setVertragAnpassungForm(f => ({ ...f, typ: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)' }}
                    >
                      <option value="schueler">Schüler</option>
                      <option value="student">Student</option>
                      <option value="azubi">Azubi</option>
                      <option value="rentner">Rentner</option>
                      <option value="sonstiges">Sonstiges</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Neuer Beitrag (€/Monat)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="z.B. 49.00"
                      value={vertragAnpassungForm.neuer_betrag}
                      onChange={e => setVertragAnpassungForm(f => ({ ...f, neuer_betrag: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Gültig von</label>
                    <input
                      type="date"
                      value={vertragAnpassungForm.gueltig_von}
                      onChange={e => setVertragAnpassungForm(f => ({ ...f, gueltig_von: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Gültig bis</label>
                    <input
                      type="date"
                      value={vertragAnpassungForm.gueltig_bis}
                      onChange={e => setVertragAnpassungForm(f => ({ ...f, gueltig_bis: e.target.value }))}
                      style={{ width: '100%', padding: '0.5rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Begründung (optional)</label>
                  <input
                    type="text"
                    placeholder="z.B. Immatrikulationsbescheinigung liegt vor"
                    value={vertragAnpassungForm.grund}
                    onChange={e => setVertragAnpassungForm(f => ({ ...f, grund: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: 6, background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                  />
                </div>

                {vertragAnpassungError && (
                  <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.3)', borderRadius: 6, color: '#ff6b6b', fontSize: '0.85rem' }}>
                    {vertragAnpassungError}
                  </div>
                )}

                <button
                  disabled={vertragAnpassungLoading}
                  onClick={async () => {
                    const { typ, neuer_betrag, gueltig_von, gueltig_bis, grund } = vertragAnpassungForm;
                    if (!neuer_betrag || !gueltig_von || !gueltig_bis) {
                      setVertragAnpassungError('Bitte Betrag, Beginn und Ende ausfüllen.');
                      return;
                    }
                    const mid = mitglied?.mitglied_id || mitglied?.id;
                    setVertragAnpassungLoading(true);
                    setVertragAnpassungError('');
                    try {
                      const dojoParam = activeDojo?.id ? `?dojo_id=${activeDojo.id}` : '';
                      await axios.post(`/vertrag-anpassungen${dojoParam}`, {
                        mitglied_id: mid,
                        typ,
                        alter_betrag: mitglied?.vertragsBetrag || mitglied?.beitrag || 0,
                        neuer_betrag: parseFloat(neuer_betrag),
                        gueltig_von,
                        gueltig_bis,
                        grund: grund || null
                      });
                      const r = await axios.get(`/vertrag-anpassungen/mitglied/${mid}`);
                      setVertragAnpassungen(r.data.anpassungen || []);
                      setVertragAnpassungForm({ typ: 'student', neuer_betrag: '', gueltig_von: '', gueltig_bis: '', grund: '' });
                    } catch (err) {
                      const e = err.response?.data?.error;
                      setVertragAnpassungError(typeof e === 'string' ? e : (e?.message || err.message || 'Fehler beim Speichern.'));
                    } finally {
                      setVertragAnpassungLoading(false);
                    }
                  }}
                  style={{
                    marginTop: '1rem', width: '100%', padding: '0.65rem', borderRadius: 8,
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.25)', color: 'var(--text-primary)', fontWeight: 600, cursor: vertragAnpassungLoading ? 'not-allowed' : 'pointer', fontSize: '0.9rem'
                  }}
                >
                  {vertragAnpassungLoading ? '⏳ Speichern...' : '✓ Tarifanpassung speichern'}
                </button>
              </div>

              {/* Bestehende Anpassungen */}
              {vertragAnpassungen.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bisherige Anpassungen</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {vertragAnpassungen.map(a => {
                      const statusColors = { genehmigt: '#4caf50', beantragt: '#ff9800', abgelehnt: '#f44336', abgelaufen: '#888' };
                      const typLabels = { schueler: 'Schüler', student: 'Student', azubi: 'Azubi', rentner: 'Rentner', sonstiges: 'Sonstiges', ruhepause: 'Ruhepause' };
                      const isEditing = editingAnpassungId === a.id;
                      const mid = mitglied?.mitglied_id || mitglied?.id;
                      return (
                        <div key={a.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.65rem 0.85rem', border: `1px solid ${statusColors[a.status] || '#555'}40`, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {/* Kopfzeile */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{typLabels[a.typ] || a.typ}</span>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginLeft: '0.5rem' }}>
                                {new Date(a.gueltig_von).toLocaleDateString('de-DE')} – {new Date(a.gueltig_bis).toLocaleDateString('de-DE')}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{parseFloat(a.neuer_betrag).toFixed(2).replace('.', ',')} €</span>
                              <span style={{ background: `${statusColors[a.status] || '#555'}20`, color: statusColors[a.status] || '#888', padding: '2px 8px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>{a.status}</span>
                              {a.status === 'genehmigt' && (
                                <>
                                  <button
                                    onClick={() => {
                                      if (isEditing) { setEditingAnpassungId(null); return; }
                                      setEditingAnpassungId(a.id);
                                      setVertragAnpassungForm({ typ: a.typ, neuer_betrag: a.neuer_betrag, gueltig_von: a.gueltig_von?.slice(0,10), gueltig_bis: a.gueltig_bis?.slice(0,10), grund: a.grund || '' });
                                    }}
                                    style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.78rem' }}
                                  >{isEditing ? '✕ Abbrechen' : '✏️ Bearbeiten'}</button>
                                  <button
                                    onClick={async () => {
                                      try {
                                        const r2 = await axios.post(`/vertrag-anpassungen/${a.id}/neu-anwenden`);
                                        const r = await axios.get(`/vertrag-anpassungen/mitglied/${mid}`);
                                        setVertragAnpassungen(r.data.anpassungen || []);
                                        alert(`✓ ${r2.data.angepasste_beitraege} Beitrag/Beiträge aktualisiert.`);
                                      } catch (err) { alert('Fehler: ' + (err.response?.data?.error || err.message)); }
                                    }}
                                    style={{ padding: '3px 10px', borderRadius: 6, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', cursor: 'pointer', fontSize: '0.78rem' }}
                                  >🔄 Neu anwenden</button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Inline-Edit-Formular */}
                          {isEditing && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Typ</label>
                                <select value={vertragAnpassungForm.typ} onChange={e => setVertragAnpassungForm(f => ({ ...f, typ: e.target.value }))}
                                  style={{ width: '100%', padding: '0.4rem', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                                  <option value="schueler">Schüler</option>
                                  <option value="student">Student</option>
                                  <option value="azubi">Azubi</option>
                                  <option value="rentner">Rentner</option>
                                  <option value="sonstiges">Sonstiges</option>
                                </select>
                              </div>
                              <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Neuer Betrag (€)</label>
                                <input type="number" step="0.01" value={vertragAnpassungForm.neuer_betrag} onChange={e => setVertragAnpassungForm(f => ({ ...f, neuer_betrag: e.target.value }))}
                                  style={{ width: '100%', padding: '0.4rem', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Gültig von</label>
                                <input type="date" value={vertragAnpassungForm.gueltig_von} onChange={e => setVertragAnpassungForm(f => ({ ...f, gueltig_von: e.target.value }))}
                                  style={{ width: '100%', padding: '0.4rem', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                              </div>
                              <div>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Gültig bis</label>
                                <input type="date" value={vertragAnpassungForm.gueltig_bis} onChange={e => setVertragAnpassungForm(f => ({ ...f, gueltig_bis: e.target.value }))}
                                  style={{ width: '100%', padding: '0.4rem', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                              </div>
                              <div style={{ gridColumn: '1/-1' }}>
                                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Grund</label>
                                <input type="text" value={vertragAnpassungForm.grund} onChange={e => setVertragAnpassungForm(f => ({ ...f, grund: e.target.value }))}
                                  style={{ width: '100%', padding: '0.4rem', borderRadius: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
                              </div>
                              <div style={{ gridColumn: '1/-1' }}>
                                <button
                                  onClick={async () => {
                                    try {
                                      await axios.put(`/vertrag-anpassungen/${a.id}`, {
                                        typ: vertragAnpassungForm.typ,
                                        neuer_betrag: parseFloat(vertragAnpassungForm.neuer_betrag),
                                        gueltig_von: vertragAnpassungForm.gueltig_von,
                                        gueltig_bis: vertragAnpassungForm.gueltig_bis,
                                        grund: vertragAnpassungForm.grund || null
                                      });
                                      const r = await axios.get(`/vertrag-anpassungen/mitglied/${mid}`);
                                      setVertragAnpassungen(r.data.anpassungen || []);
                                      setEditingAnpassungId(null);
                                    } catch (err) { alert('Fehler: ' + (err.response?.data?.error || err.message)); }
                                  }}
                                  style={{ width: '100%', padding: '0.45rem', borderRadius: 6, background: 'rgba(76,175,80,0.15)', border: '1px solid #4caf50', color: '#4caf50', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                                >✓ Änderungen speichern</button>
                              </div>
                            </div>
                          )}

                          {/* Mitglied-Antrag genehmigen/ablehnen */}
                          {a.erstellt_von === 'mitglied' && a.status === 'beantragt' && (
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <button
                                onClick={async () => {
                                  try {
                                    await axios.put(`/vertrag-anpassungen/${a.id}/genehmigen`, { neuer_betrag: a.neuer_betrag });
                                    const r = await axios.get(`/vertrag-anpassungen/mitglied/${mid}`);
                                    setVertragAnpassungen(r.data.anpassungen || []);
                                  } catch (err) { alert('Fehler: ' + (err.response?.data?.error || err.message)); }
                                }}
                                style={{ padding: '4px 12px', borderRadius: 6, background: '#4caf5020', border: '1px solid #4caf50', color: '#4caf50', cursor: 'pointer', fontSize: '0.8rem' }}
                              >✓ Genehmigen</button>
                              <button
                                onClick={async () => {
                                  try {
                                    await axios.put(`/vertrag-anpassungen/${a.id}/ablehnen`);
                                    const r = await axios.get(`/vertrag-anpassungen/mitglied/${mid}`);
                                    setVertragAnpassungen(r.data.anpassungen || []);
                                  } catch (err) { alert('Fehler: ' + (err.response?.data?.error || err.message)); }
                                }}
                                style={{ padding: '4px 12px', borderRadius: 6, background: '#f4433620', border: '1px solid #f44336', color: '#f44336', cursor: 'pointer', fontSize: '0.8rem' }}
                              >✕ Ablehnen</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Vertragsfrei Modal ── */}
        {vertragsfreiModal && (
        <div
          className="modal-overlay"
          onClick={() => setVertragsfreiModal(null)}
          style={{ zIndex: 9100 }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(26,26,46,0.99) 0%, rgba(20,20,40,0.99) 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              padding: '1.75rem',
              maxWidth: 480,
              width: '100%'
            }}
          >
            <h3 style={{ margin: '0 0 1.25rem', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
              {vertragsfreiModal === 'stellen' ? 'Vertragsfrei stellen' : 'Vertragsfreistellung aufheben'}
            </h3>

            {vertragsfreiModal === 'stellen' && (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Grund <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="z.B. Ehrenmitglied, Familie, Sponsor …"
                    value={vertragsfreiForm.grund}
                    onChange={e => setVertragsfreiForm(f => ({ ...f, grund: e.target.value }))}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 7, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    autoFocus
                  />
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.35rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Wirksam ab
                  </label>
                  <input
                    type="date"
                    value={vertragsfreiForm.ab}
                    onChange={e => setVertragsfreiForm(f => ({ ...f, ab: e.target.value }))}
                    style={{ padding: '0.55rem 0.75rem', borderRadius: 7, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'var(--text-primary)', fontSize: '0.9rem' }}
                  />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Offene Beiträge ab diesem Datum
                  </div>
                  {[
                    { val: 'behalten',   label: 'Behalten',                desc: 'Werden weiterhin per Lastschrift eingezogen' },
                    { val: 'stornieren', label: 'Stornieren',              desc: 'Werden gelöscht und nicht mehr eingezogen' },
                    { val: 'erlassen',   label: 'Als bezahlt markieren',   desc: 'Werden als erlassen / bezahlt geführt' }
                  ].map(opt => {
                    const active = vertragsfreiForm.beitraege_aktion === opt.val;
                    return (
                      <div
                        key={opt.val}
                        onClick={() => setVertragsfreiForm(f => ({ ...f, beitraege_aktion: opt.val }))}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '0.7rem',
                          marginBottom: '0.5rem', cursor: 'pointer',
                          padding: '0.55rem 0.75rem', borderRadius: 8,
                          border: `1px solid ${active ? 'rgba(234,179,8,0.5)' : 'rgba(255,255,255,0.1)'}`,
                          background: active ? 'rgba(234,179,8,0.08)' : 'rgba(255,255,255,0.03)',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
                          border: `2px solid ${active ? '#EAB308' : 'rgba(255,255,255,0.3)'}`,
                          background: active ? '#EAB308' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          {active && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1a1a2e' }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{opt.label}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>{opt.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {vertragsfreiModal === 'aufheben' && (
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Die Vertragsfreistellung von <strong style={{ color: 'var(--text-primary)' }}>{mitglied?.vorname} {mitglied?.nachname}</strong> wird aufgehoben.
                Zukünftige Beiträge werden wieder automatisch generiert und eingezogen.
              </p>
            )}

            {vertragsfreiError && (
              <div style={{ marginBottom: '0.75rem', padding: '0.55rem 0.75rem', borderRadius: 7, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.85rem' }}>
                {vertragsfreiError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setVertragsfreiModal(null); setVertragsfreiError(''); }}
                style={{ padding: '0.5rem 1rem', borderRadius: 7, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.88rem' }}
              >
                Abbrechen
              </button>
              <button
                onClick={async () => {
                  if (vertragsfreiModal === 'stellen' && !vertragsfreiForm.grund.trim()) {
                    setVertragsfreiError('Bitte einen Grund angeben.');
                    return;
                  }
                  setVertragsfreiError('');
                  try {
                    const payload = vertragsfreiModal === 'stellen'
                      ? { vertragsfrei: 1, vertragsfrei_grund: vertragsfreiForm.grund, vertragsfrei_ab: vertragsfreiForm.ab, beitraege_aktion: vertragsfreiForm.beitraege_aktion }
                      : { vertragsfrei: 0, vertragsfrei_grund: null, vertragsfrei_ab: null };
                    await axios.put(`/mitglieddetail/${mitglied.mitglied_id}`, payload);
                    setMitglied(prev => ({
                      ...prev,
                      vertragsfrei: vertragsfreiModal === 'stellen' ? 1 : 0,
                      vertragsfrei_grund: vertragsfreiModal === 'stellen' ? vertragsfreiForm.grund : null,
                      vertragsfrei_ab: vertragsfreiModal === 'stellen' ? vertragsfreiForm.ab : null
                    }));
                    setVertragsfreiModal(null);
                  } catch (err) {
                    const msg = err.response?.data?.error || err.message || 'Unbekannter Fehler';
                    setVertragsfreiError(`Fehler: ${msg}`);
                  }
                }}
                style={{
                  padding: '0.5rem 1.25rem', borderRadius: 7, border: 'none',
                  background: vertragsfreiModal === 'stellen' ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)',
                  color: vertragsfreiModal === 'stellen' ? '#EAB308' : '#22C55E',
                  cursor: 'pointer', fontSize: '0.88rem', fontWeight: 600
                }}
              >
                {vertragsfreiModal === 'stellen' ? 'Vertragsfrei stellen' : 'Aufheben'}
              </button>
            </div>
          </div>
        </div>
        )}

      {/* Neuer Vertrag Modal - CACHE BREAK v2.0 */}
      {showNewVertrag && (
        <div className="modal-overlay" onClick={() => setShowNewVertrag(false)} data-version="2.0-vertragformular">
          <div
            className="modal-content vertrag-modal-custom mds-new-vertrag-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Neuer Vertrag</h3>
              <button
                className="close-btn"
                onClick={() => setShowNewVertrag(false)}
              >
                ?
              </button>
            </div>

            {/* VertragFormular Komponente verwenden - NEU! */}
            <VertragFormular
              vertrag={{
                tarif_id: newVertrag.tarif_id,
                billing_cycle: newVertrag.billing_cycle,
                payment_method: newVertrag.payment_method,
                vertragsbeginn: newVertrag.vertragsbeginn,
                vertragsende: newVertrag.vertragsende,
                kuendigungsfrist_monate: newVertrag.kuendigungsfrist_monate,
                mindestlaufzeit_monate: newVertrag.mindestlaufzeit_monate,
                agb_akzeptiert: newVertrag.agb_akzeptiert,
                datenschutz_akzeptiert: newVertrag.datenschutz_akzeptiert,
                hausordnung_akzeptiert: newVertrag.hausordnung_akzeptiert,
                haftungsausschluss_akzeptiert: newVertrag.haftungsausschluss_akzeptiert,
                gesundheitserklaerung: newVertrag.gesundheitserklaerung,
                foto_einverstaendnis: newVertrag.foto_einverstaendnis,
                agb_version: newVertrag.agb_version,
                datenschutz_version: newVertrag.datenschutz_version,
                sepa_mandat_id: newVertrag.sepa_mandat_id,
                sonder_aktion_id: newVertrag.sonder_aktion_id
              }}
              onChange={(updatedVertrag) => {
                setNewVertrag({
                  ...newVertrag,
                  tarif_id: updatedVertrag.tarif_id,
                  billing_cycle: updatedVertrag.billing_cycle,
                  payment_method: updatedVertrag.payment_method,
                  vertragsbeginn: updatedVertrag.vertragsbeginn,
                  vertragsende: updatedVertrag.vertragsende,
                  kuendigungsfrist_monate: updatedVertrag.kuendigungsfrist_monate,
                  mindestlaufzeit_monate: updatedVertrag.mindestlaufzeit_monate,
                  monatsbeitrag: updatedVertrag.monatsbeitrag,
                  aufnahmegebuehr_cents: updatedVertrag.aufnahmegebuehr_cents,
                  agb_akzeptiert: updatedVertrag.agb_akzeptiert,
                  datenschutz_akzeptiert: updatedVertrag.datenschutz_akzeptiert,
                  hausordnung_akzeptiert: updatedVertrag.hausordnung_akzeptiert,
                  haftungsausschluss_akzeptiert: updatedVertrag.haftungsausschluss_akzeptiert,
                  gesundheitserklaerung: updatedVertrag.gesundheitserklaerung,
                  foto_einverstaendnis: updatedVertrag.foto_einverstaendnis,
                  agb_version: updatedVertrag.agb_version,
                  datenschutz_version: updatedVertrag.datenschutz_version,
                  sepa_mandat_id: updatedVertrag.sepa_mandat_id,
                  sonder_aktion_id: updatedVertrag.sonder_aktion_id || null
                });
              }}
              geburtsdatum={mitglied?.geburtsdatum}
              schuelerStudent={mitglied?.schueler_student}
              mode="create"
              mitgliedId={id}
            />

            <div className="form-actions mds2-mt-15">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowNewVertrag(false)}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                onClick={handleSaveVertrag}
                disabled={!newVertrag.agb_akzeptiert || !newVertrag.datenschutz_akzeptiert || !newVertrag.hausordnung_akzeptiert || !newVertrag.tarif_id || !mitglied?.dojo_id}
              >
                ✅ Vertrag erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vertrag Bearbeiten Modal */}
      {editingVertrag && (
        <div className="modal-overlay" onClick={() => setEditingVertrag(null)}>
          <div
            className="modal-content vertrag-modal-custom mds-edit-vertrag-modal"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Vertrag bearbeiten</h3>
              <button 
                className="close-btn"
                onClick={() => setEditingVertrag(null)}
              >
                ?
              </button>
            </div>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Status</label>
                <CustomSelect
                  value={editingVertrag.status}
                  onChange={(e) => setEditingVertrag({...editingVertrag, status: e.target.value})}
                  options={[
                    { value: 'aktiv', label: 'Aktiv' },
                    { value: 'ruhepause', label: 'Ruhepause' },
                    { value: 'gekuendigt', label: 'Gekündigt' },
                    { value: 'beendet', label: 'Beendet' }
                  ]}
                />
              </div>
              
              <div className="form-group">
                <label>Vertragsbeginn</label>
                <input
                  type="date"
                  value={editingVertrag.vertragsbeginn}
                  onChange={(e) => setEditingVertrag({...editingVertrag, vertragsbeginn: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>Vertragsende</label>
                <input
                  type="date"
                  value={editingVertrag.vertragsende}
                  onChange={(e) => setEditingVertrag({...editingVertrag, vertragsende: e.target.value})}
                />
              </div>
              
              {editingVertrag.status === 'gekuendigt' && (
                <div className="form-group">
                  <label>Kündigung eingegangen</label>
                  <input
                    type="date"
                    value={editingVertrag.kuendigung_eingegangen || ''}
                    onChange={(e) => setEditingVertrag({...editingVertrag, kuendigung_eingegangen: e.target.value})}
                  />
                </div>
              )}
            </div>
            
            <div className="form-actions">
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingVertrag(null)}
              >
                Abbrechen
              </button>
              <button 
                type="submit"
                className="btn btn-primary"
                onClick={handleSaveVertrag}
              >
                💾 Änderungen speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MitgliedschaftTab;