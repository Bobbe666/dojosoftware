// =============================================================================
// MitgliedFinanzUebersicht — Mitgliedersuche + vollständige Finanz-Aufschlüsselung
// (Finanzcockpit). Zeigt: was, wann, wie, wo eingezogen wurde + was noch offen ist.
// Backend: /api/finanzcockpit/mitglied-suche + /mitglied-finanz/:id
// =============================================================================
import React, { useState, useRef } from 'react';
import config from '../config/config';
import { fetchWithAuth } from '../utils/fetchWithAuth';

const eur = (v) => (parseFloat(v) || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const datum = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? String(d).slice(0, 10) : dt.toLocaleDateString('de-DE');
};
const datumZeit = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleString('de-DE');
};

const ART_LABEL = { mitgliedsbeitrag: 'Mitgliedsbeitrag', pruefungsgebuehr: 'Prüfungsgebühr', artikel: 'Artikel', aufnahmegebuehr: 'Aufnahmegebühr' };
const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const TYP_ICON = { doppelbuchung: '🔁', betrags_abweichung: '⚖️', phantom: '👻', doppelter_monatsbeitrag: '📅', fehlender_beitrag: '➖' };

// Offene Beiträge in „jetzt fällig" (aktueller Lauf) + künftige Läufe (nach Monat gruppiert) aufteilen
function analysiereBeitraege(beitraege) {
  const heute = new Date();
  const monatsEnde = new Date(heute.getFullYear(), heute.getMonth() + 1, 0, 23, 59, 59);
  const offen = (beitraege || []).filter(b => !b.bezahlt && b.zahlungsdatum);
  const aktuell = offen.filter(b => new Date(b.zahlungsdatum) <= monatsEnde);
  const map = {};
  offen.filter(b => new Date(b.zahlungsdatum) > monatsEnde).forEach(b => {
    const d = new Date(b.zahlungsdatum);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!map[key]) map[key] = { key, label: `${MONATE[d.getMonth()]} ${d.getFullYear()}`, posten: [], summe: 0 };
    map[key].posten.push(b);
    map[key].summe += parseFloat(b.betrag) || 0;
  });
  const laeufe = Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  const aktuellSumme = aktuell.reduce((s, b) => s + (parseFloat(b.betrag) || 0), 0);
  return { aktuell, aktuellSumme, laeufe };
}

// Stripe-Transaktionen nach Monat/Jahr gruppieren (für den Abgleich)
function gruppiereNachMonat(lastschriften) {
  const map = {};
  (lastschriften || []).forEach(t => {
    const key = `${t.jahr}-${String(t.monat).padStart(2, '0')}`;
    if (!map[key]) map[key] = { key, monat: t.monat, jahr: t.jahr, label: `${MONATE[(t.monat || 1) - 1]} ${t.jahr}`, txs: [], geschickt: 0 };
    map[key].txs.push(t);
    map[key].geschickt += parseFloat(t.betrag) || 0;
  });
  return Object.values(map).sort((a, b) => b.key.localeCompare(a.key));
}
const LS_STATUS = {
  succeeded: { label: 'Eingezogen', color: '#22c55e', bg: 'rgba(34,197,94,0.12)' },
  processing: { label: 'In Einzug', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  failed: { label: 'Fehlgeschlagen', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
};

const card = { background: 'var(--bg-card, #1a1a2e)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '1rem' };
const th = { textAlign: 'left', padding: '0.4rem 0.6rem', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted, #94a3b8)', borderBottom: '1px solid rgba(255,255,255,0.1)', whiteSpace: 'nowrap' };
const td = { padding: '0.4rem 0.6rem', fontSize: '0.84rem', color: 'var(--text-primary, #e2e8f0)', borderBottom: '1px solid rgba(255,255,255,0.05)' };

function Badge({ children, color = '#94a3b8', bg = 'rgba(148,163,184,0.12)' }) {
  return <span style={{ background: bg, color, borderRadius: 6, padding: '2px 8px', fontSize: '0.74rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{children}</span>;
}

function Section({ titel, count, children }) {
  return (
    <div style={{ ...card, marginTop: '0.9rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text-primary, #e2e8f0)' }}>{titel}</h4>
        {count != null && <Badge>{count}</Badge>}
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </div>
  );
}

export default function MitgliedFinanzUebersicht({ dojoId }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debRef = useRef(null);
  const [expandedTx, setExpandedTx] = useState(new Set());
  const [stripeLive, setStripeLive] = useState({});
  const [stripeLiveLoading, setStripeLiveLoading] = useState({});

  const [expandedMonths, setExpandedMonths] = useState(new Set());
  const toggleMonth = (key) => setExpandedMonths(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  const toggleTx = (id) => setExpandedTx(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const ladeMonatLive = (txs) => { (txs || []).forEach(tx => { if (tx.stripe_payment_intent_id) ladeStripeLive(tx); }); };

  const [stoppingTx, setStoppingTx] = useState({});
  const stoppeTx = async (tx) => {
    if (!window.confirm(`Abbuchung über ${eur(tx.betrag)} (Lauf ${tx.monat}/${tx.jahr}) wirklich stoppen/stornieren?\n\nDie zugeordneten Beiträge werden wieder als offen gestellt. Geht nur, solange Stripe noch nicht eingezogen hat (processing).`)) return;
    setStoppingTx(prev => ({ ...prev, [tx.id]: true }));
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/stripe/storno/${tx.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grund: 'Über Finanzübersicht gestoppt' }),
      });
      const d = await res.json();
      if (d.success) {
        alert('✓ Abbuchung gestoppt/storniert. Die zugeordneten Beiträge sind wieder offen. Die Übersicht wird aktualisiert.');
        oeffne(data.mitglied.mitglied_id, data.mitglied.name);
      } else {
        alert('Stoppen nicht möglich: ' + (d.error || 'Unbekannter Fehler'));
      }
    } catch (e) {
      alert('Fehler beim Stoppen: ' + e.message);
    } finally {
      setStoppingTx(prev => ({ ...prev, [tx.id]: false }));
    }
  };

  const [refundingTx, setRefundingTx] = useState({});
  const refundTx = async (tx, betragCent, label) => {
    const betText = betragCent ? eur(betragCent / 100) : eur(tx.betrag);
    const was = betragCent ? `die Position „${label}" über ${betText}` : `die komplette Abbuchung über ${betText}`;
    if (!window.confirm(`${was} (Lauf ${tx.monat}/${tx.jahr}) wirklich an das Mitglied zurückerstatten?\n\nDie Rückerstattung erfolgt über Stripe an das Bankkonto des Mitglieds.`)) return;
    setRefundingTx(prev => ({ ...prev, [tx.id]: true }));
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/refund/${tx.id}?dojo_id=${dojoId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grund: label ? `Position: ${label}` : 'Komplett erstattet', betrag_cent: betragCent || undefined }),
      });
      const d = await res.json();
      if (d.success) {
        alert(`✓ Rückerstattung über ${eur(d.betrag_erstattet)} ausgelöst (Status: ${d.status}).`);
        // Live-Stripe-Daten für diese Transaktion neu laden → Rückerstattung erscheint in ⑤
        setStripeLive(prev => { const c = { ...prev }; delete c[tx.id]; return c; });
        setTimeout(() => ladeStripeLive(tx), 600);
      } else {
        alert('Rückerstattung nicht möglich: ' + (d.error || 'Unbekannter Fehler'));
      }
    } catch (e) {
      alert('Fehler bei Rückerstattung: ' + e.message);
    } finally {
      setRefundingTx(prev => ({ ...prev, [tx.id]: false }));
    }
  };

  // Manuelle Erstattung (außerhalb Stripe, z. B. von anderem Konto)
  const [manualForm, setManualForm] = useState(null); // tx-Objekt, dessen Modal offen ist
  const [manualFields, setManualFields] = useState({ betrag: '', datum: '', quelle: '', bemerkung: '' });
  const [savingManual, setSavingManual] = useState(false);
  const heute = () => new Date().toISOString().split('T')[0];
  const openManual = (tx) => {
    setManualFields({ betrag: (Number(tx.betrag) || 0).toFixed(2), datum: heute(), quelle: '', bemerkung: '' });
    setManualForm((manualForm && manualForm.id === tx.id) ? null : tx);
  };
  const submitManual = async (tx) => {
    const betragCent = Math.round(parseFloat(String(manualFields.betrag).replace(',', '.')) * 100);
    if (!betragCent || betragCent <= 0) { alert('Bitte einen gültigen Betrag eingeben.'); return; }
    setSavingManual(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/manuelle-erstattung/${tx.id}?dojo_id=${dojoId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betrag_cent: betragCent, erstattet_am: manualFields.datum || heute(), quelle: manualFields.quelle || null, bemerkung: manualFields.bemerkung || null }),
      });
      const d = await res.json();
      if (d.success) {
        setManualForm(null);
        oeffne(data.mitglied.mitglied_id, data.mitglied.name);
      } else {
        alert('Speichern nicht möglich: ' + (d.error || 'Unbekannter Fehler'));
      }
    } catch (e) {
      alert('Fehler beim Speichern: ' + e.message);
    } finally {
      setSavingManual(false);
    }
  };
  const deleteManual = async (meId) => {
    if (!window.confirm('Diese manuelle Erstattung wirklich löschen?')) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/manuelle-erstattung/${meId}?dojo_id=${dojoId}`, { method: 'DELETE' });
      const d = await res.json();
      if (d.success) oeffne(data.mitglied.mitglied_id, data.mitglied.name);
      else alert('Löschen nicht möglich: ' + (d.error || 'Unbekannter Fehler'));
    } catch (e) {
      alert('Fehler beim Löschen: ' + e.message);
    }
  };

  const [check, setCheck] = useState(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const ladeCheck = async (mid) => {
    if (!mid) return;
    setCheckLoading(true);
    setCheck(null);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/mitglied-check/${mid}?dojo_id=${dojoId}`);
      const d = await res.json();
      setCheck(d.success ? d : { error: d.error || 'Fehler' });
    } catch (e) {
      setCheck({ error: e.message });
    } finally {
      setCheckLoading(false);
    }
  };
  const ladeStripeLive = async (tx) => {
    const id = tx.id;
    if (!tx.stripe_payment_intent_id || stripeLive[id] || stripeLiveLoading[id]) return;
    setStripeLiveLoading(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/stripe-details/${tx.stripe_payment_intent_id}?dojo_id=${dojoId}`);
      const d = await res.json();
      setStripeLive(prev => ({ ...prev, [id]: d.success ? d : { error: d.error || 'Fehler' } }));
    } catch (e) {
      setStripeLive(prev => ({ ...prev, [id]: { error: e.message } }));
    } finally {
      setStripeLiveLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  const suche = (term) => {
    setQ(term);
    setError('');
    if (debRef.current) clearTimeout(debRef.current);
    if (term.trim().length < 2) { setResults([]); return; }
    debRef.current = setTimeout(async () => {
      try {
        const res = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/mitglied-suche?dojo_id=${dojoId}&q=${encodeURIComponent(term.trim())}`);
        const d = await res.json();
        if (d.success) setResults(d.mitglieder || []);
      } catch { /* still */ }
    }, 300);
  };

  const oeffne = async (mid, name) => {
    setResults([]);
    setQ(name);
    setLoading(true);
    setError('');
    setData(null);
    setCheck(null);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/finanzcockpit/mitglied-finanz/${mid}?dojo_id=${dojoId}`);
      const d = await res.json();
      if (d.success) setData(d);
      else setError(d.error || 'Fehler beim Laden');
    } catch (e) {
      setError(e.message || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  };

  const z = data?.zusammenfassung;
  const analyse = data ? analysiereBeitraege(data.beitraege) : null;

  return (
    <div style={{ ...card, marginTop: '1rem' }}>
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: 'var(--text-primary, #e2e8f0)' }}>
        🔎 Mitglieder-Finanzübersicht
      </h3>

      {/* Suche */}
      <div style={{ position: 'relative', maxWidth: 460 }}>
        <input
          value={q}
          onChange={(e) => suche(e.target.value)}
          placeholder="Mitglied suchen (Name eingeben)…"
          style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8, background: 'var(--bg-primary, #0f172a)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-primary, #e2e8f0)', fontSize: '0.9rem', boxSizing: 'border-box' }}
        />
        {results.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: 4, background: 'var(--bg-card, #1a1a2e)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, maxHeight: 280, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
            {results.map((r) => (
              <div key={r.mitglied_id} onClick={() => oeffne(r.mitglied_id, r.name)}
                style={{ padding: '0.55rem 0.8rem', cursor: 'pointer', fontSize: '0.86rem', color: 'var(--text-primary, #e2e8f0)', display: 'flex', justifyContent: 'space-between', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <span>{r.name}</span>
                {r.gekuendigt ? <Badge color="#ef4444" bg="rgba(239,68,68,0.12)">gekündigt</Badge> : !r.aktiv ? <Badge>inaktiv</Badge> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && <div style={{ padding: '1rem 0', color: 'var(--text-muted, #94a3b8)' }}>Lädt…</div>}
      {error && <div style={{ padding: '0.75rem', marginTop: '0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#fca5a5', fontSize: '0.85rem' }}>{error}</div>}

      {data && (
        <div style={{ marginTop: '1rem' }}>
          {/* Kopf */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary, #e2e8f0)' }}>{data.mitglied.name}</h3>
            {data.mitglied.gekuendigt && <Badge color="#ef4444" bg="rgba(239,68,68,0.12)">gekündigt {data.mitglied.gekuendigt_am ? `(${datum(data.mitglied.gekuendigt_am)})` : ''}</Badge>}
            {data.mitglied.vertragsfrei && <Badge color="#a78bfa" bg="rgba(167,139,250,0.12)">vertragsfrei</Badge>}
            {data.mitglied.zahlungsmethode && <Badge color="#60a5fa" bg="rgba(96,165,250,0.12)">{data.mitglied.zahlungsmethode}</Badge>}
            {data.sepa && <Badge color={data.sepa.status === 'aktiv' ? '#22c55e' : '#f59e0b'} bg={data.sepa.status === 'aktiv' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)'}>SEPA {data.sepa.status}{data.sepa.iban ? ` · ${data.sepa.iban}` : ''}</Badge>}
            {data.vertrag?.monatsbeitrag != null && <Badge color="#e2e8f0" bg="rgba(255,255,255,0.08)">Soll {eur(data.vertrag.monatsbeitrag)}/Monat</Badge>}
            <button onClick={() => ladeCheck(data.mitglied.mitglied_id)} disabled={checkLoading}
              style={{ marginLeft: 'auto', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.45)', color: '#f87171', borderRadius: 8, padding: '0.4rem 0.85rem', fontSize: '0.82rem', fontWeight: 700, cursor: checkLoading ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
              {checkLoading ? 'Prüft…' : '🔍 Check / Problemanalyse'}
            </button>
          </div>

          {/* Problemanalyse-Panel */}
          {check && (
            check.error ? (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '0.8rem 1rem', marginBottom: '0.9rem', color: '#fca5a5', fontSize: '0.85rem' }}>⚠ {check.error}</div>
            ) : check.alles_ok ? (
              <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '0.8rem 1rem', marginBottom: '0.9rem', color: '#86efac', fontSize: '0.88rem' }}>
                ✓ Keine Auffälligkeiten gefunden — die Abbuchungen sind plausibel (keine Doppel-/Phantom-Buchungen, Beträge passen zu den Posten).
              </div>
            ) : (
              <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 10, padding: '0.9rem 1rem', marginBottom: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <strong style={{ color: '#fca5a5', fontSize: '0.95rem' }}>⚠ {check.findings.length} Auffälligkeit{check.findings.length !== 1 ? 'en' : ''} gefunden</strong>
                  {check.summe_auffaellig > 0 && <span style={{ fontWeight: 700, color: '#ef4444' }}>ca. {eur(check.summe_auffaellig)} zu viel abgebucht</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {check.findings.map((f, i) => (
                    <div key={i} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '0.55rem 0.7rem', borderLeft: '3px solid #ef4444' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary,#e2e8f0)' }}>{TYP_ICON[f.typ] || '•'} {f.titel}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary,#cbd5e1)', marginTop: 2 }}>{f.detail}</div>
                    </div>
                  ))}
                </div>
                {check.monatsvergleich && check.monatsvergleich.length > 0 && (
                  <div style={{ marginTop: '0.85rem', overflowX: 'auto' }}>
                    <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)', marginBottom: '0.4rem' }}>Monatsvergleich: geschickt vs. erwartet</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead><tr><th style={th}>Monat</th><th style={th}>Geschickt</th><th style={th}>Erwartet</th><th style={th}>Differenz</th></tr></thead>
                      <tbody>
                        {check.monatsvergleich.map((mv, i) => (
                          <tr key={i}>
                            <td style={td}>{MONATE[(mv.monat || 1) - 1]} {mv.jahr}</td>
                            <td style={td}>{eur(mv.geschickt)}</td>
                            <td style={td}>{eur(mv.erwartet)}</td>
                            <td style={{ ...td, fontWeight: 700, color: Math.abs(mv.differenz) > 0.01 ? '#ef4444' : '#22c55e' }}>{mv.differenz > 0 ? '+' : ''}{eur(mv.differenz)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          )}

          {/* KPI-Kacheln */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
            <div style={card}><div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>Bezahlt gesamt</div><div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#22c55e' }}>{eur(z.bezahlt_gesamt)}</div></div>
            <div style={card}><div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>Offen gesamt</div><div style={{ fontSize: '1.2rem', fontWeight: 700, color: z.offen_gesamt > 0 ? '#f59e0b' : '#e2e8f0' }}>{eur(z.offen_gesamt)}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>{z.anzahl_offene_beitraege} offene Beiträge</div></div>
            <div style={card}><div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>Gerade in Einzug</div><div style={{ fontSize: '1.2rem', fontWeight: 700, color: z.in_einzug_gesamt > 0 ? '#f59e0b' : '#e2e8f0' }}>{eur(z.in_einzug_gesamt)}</div></div>
            <div style={card}><div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>Nächste Fälligkeit</div>{z.naechste_faelligkeit ? <><div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#e2e8f0' }}>{eur(z.naechste_faelligkeit.betrag)}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>{datum(z.naechste_faelligkeit.faellig)}</div></> : <div style={{ fontSize: '1rem', color: 'var(--text-muted, #94a3b8)' }}>—</div>}</div>
          </div>

          {/* Aktuell fällig (nächster/aktueller Lastschriftlauf) */}
          <Section titel="🔜 Aktuell fällig – nächster Lastschriftlauf" count={analyse?.aktuell.length || 0}>
            {!analyse || analyse.aktuell.length === 0 ? (
              <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.84rem', padding: '0.5rem 0' }}>Aktuell keine fälligen offenen Beiträge.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Fällig</th><th style={th}>Art</th><th style={th}>Betrag</th></tr></thead>
                <tbody>
                  {analyse.aktuell.map((b) => (
                    <tr key={b.beitrag_id}>
                      <td style={td}>{datum(b.zahlungsdatum)}</td>
                      <td style={td}>{ART_LABEL[b.art] || b.art}{b.beschreibung ? <span style={{ color: 'var(--text-muted,#94a3b8)', fontSize: '0.76rem' }}> · {b.beschreibung}</span> : ''}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{eur(b.betrag)}</td>
                    </tr>
                  ))}
                  <tr><td style={{ ...td, fontWeight: 700 }} colSpan={2}>Summe nächste Abbuchung</td><td style={{ ...td, fontWeight: 700, color: '#f59e0b' }}>{eur(analyse.aktuellSumme)}</td></tr>
                </tbody>
              </table>
            )}
          </Section>

          {/* Künftige Lastschrift-Läufe (nach Monat) */}
          {analyse && analyse.laeufe.length > 0 && (
            <Section titel="📅 Künftige Lastschrift-Läufe" count={analyse.laeufe.length}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {analyse.laeufe.map((lauf) => (
                  <div key={lauf.key} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '0.6rem 0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary, #e2e8f0)' }}>{lauf.label}</strong>
                      <span style={{ fontWeight: 700, color: '#60a5fa' }}>{eur(lauf.summe)}</span>
                    </div>
                    {lauf.posten.map((p) => (
                      <div key={p.beitrag_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary, #cbd5e1)', padding: '0.15rem 0' }}>
                        <span>{ART_LABEL[p.art] || p.art}{p.beschreibung ? ` · ${p.beschreibung}` : ''} <span style={{ color: 'var(--text-muted,#94a3b8)', fontSize: '0.75rem' }}>({datum(p.zahlungsdatum)})</span></span>
                        <span>{eur(p.betrag)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Stripe-Abgleich pro Monat: geschickt (wir) vs. tatsächlich (Stripe) */}
          <Section titel="🏦 Stripe-Abgleich – geschickt vs. tatsächlich (pro Monat)" count={data.lastschriften.length}>
            {data.lastschriften.length === 0 ? (
              <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.84rem', padding: '0.5rem 0' }}>Keine Stripe-Lastschriften.</div>
            ) : (() => {
              const beitragById = {};
              (data.beitraege || []).forEach(b => { beitragById[b.beitrag_id] = b; });
              const monate = gruppiereNachMonat(data.lastschriften);
              const lbl = { fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted, #94a3b8)', marginBottom: 4 };
              const liveBtn = { background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.4)', color: '#60a5fa', borderRadius: 6, padding: '0.3rem 0.6rem', fontSize: '0.76rem', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap' };
              const stoppBtn = { background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)', color: '#f87171', borderRadius: 6, padding: '0.28rem 0.6rem', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', margin: '3px 0', whiteSpace: 'nowrap' };
              const refundBtn = { background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.5)', color: '#fbbf24', borderRadius: 6, padding: '0.28rem 0.6rem', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', margin: '3px 0', whiteSpace: 'nowrap' };
              const miniRefundBtn = { background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', borderRadius: 5, padding: '0 0.4rem', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', flexShrink: 0, lineHeight: 1.5 };
              const manualBtn = { background: 'rgba(56,189,248,0.13)', border: '1px solid rgba(56,189,248,0.45)', color: '#38bdf8', borderRadius: 6, padding: '0.28rem 0.6rem', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', margin: '3px 0', whiteSpace: 'nowrap', display: 'block' };
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {monate.map(grp => {
                    const expanded = expandedMonths.has(grp.key);
                    let tatsaechlich = 0, erstattet = 0, liveGeladen = 0;
                    grp.txs.forEach(t => {
                      const lv = stripeLive[t.id];
                      if (lv && lv.payment_intent) {
                        liveGeladen++;
                        if (lv.charge && lv.charge.bezahlt) tatsaechlich += (lv.payment_intent.betrag - (lv.charge.betrag_erstattet || 0));
                        erstattet += (lv.charge ? lv.charge.betrag_erstattet : 0) || 0;
                      }
                    });
                    const diff = liveGeladen > 0 ? (grp.geschickt - tatsaechlich) : null;
                    return (
                      <div key={grp.key} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                        <div onClick={() => toggleMonth(grp.key)} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.8rem', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' }}>{expanded ? '▾' : '▸'} {grp.label}</span>
                          <span style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.82rem' }}><span style={{ color: 'var(--text-muted,#94a3b8)' }}>Geschickt:</span> <strong>{eur(grp.geschickt)}</strong> ({grp.txs.length})</span>
                            {liveGeladen > 0 && <span style={{ fontSize: '0.82rem' }}><span style={{ color: 'var(--text-muted,#94a3b8)' }}>Tatsächlich:</span> <strong style={{ color: '#22c55e' }}>{eur(tatsaechlich)}</strong></span>}
                            {erstattet > 0 && <span style={{ fontSize: '0.8rem', color: '#ef4444' }}>erstattet {eur(erstattet)}</span>}
                            {diff != null && Math.abs(diff) > 0.001 && <span style={{ fontSize: '0.8rem', color: '#f59e0b' }}>Δ {eur(diff)}</span>}
                            <button onClick={(e) => { e.stopPropagation(); setExpandedMonths(prev => { const s = new Set(prev); s.add(grp.key); return s; }); ladeMonatLive(grp.txs); }} style={liveBtn}>↻ Stripe-Abgleich</button>
                          </span>
                        </div>
                        {expanded && (
                          <div style={{ padding: '0.4rem 0.8rem 0.6rem' }}>
                            {grp.txs.map(tx => {
                              const s = LS_STATUS[tx.status] || { label: tx.status, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                              let ids = []; try { ids = JSON.parse(tx.beitrag_ids || '[]'); } catch {}
                              const lv = stripeLive[tx.id];
                              return (
                                <div key={tx.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.6rem 0', display: 'grid', gridTemplateColumns: 'repeat(5, minmax(150px, 1fr))', gap: '0.7rem' }}>
                                  {/* 1) Soll */}
                                  <div>
                                    <div style={lbl}>① Soll – sollte eingezogen werden</div>
                                    {(() => {
                                      const posten = tx.posten || ids.map(id => { const b = beitragById[id]; return b ? { beitrag_id: id, label: ART_LABEL[b.art] || b.art, betrag: parseFloat(b.betrag) || 0, beschreibung: b.magicline_description || b.beschreibung, aufgeloest: true, zugeordnet: false } : { beitrag_id: id, label: 'Beitrag (Datensatz erneuert)', betrag: null, aufgeloest: false, zugeordnet: false }; });
                                      if (!posten || posten.length === 0) return <div style={{ color: '#f59e0b', fontSize: '0.8rem' }}>⚠ Keine Zuordnung (Phantom)</div>;
                                      const alleAufgeloest = posten.every(p => p.aufgeloest);
                                      const aufgeloestSumme = posten.reduce((acc, p) => acc + (p.aufgeloest ? (p.betrag || 0) : 0), 0);
                                      const sollSumme = alleAufgeloest ? aufgeloestSumme : (parseFloat(tx.betrag) || 0);
                                      return (<>
                                        <div style={{ fontSize: '0.9rem', margin: '2px 0' }}><strong>{eur(sollSumme)}</strong>{!alleAufgeloest && <span style={{ fontSize: '0.68rem', color: 'var(--text-muted,#94a3b8)' }}> (lt. Abbuchung)</span>}</div>
                                        <div style={{ marginTop: 2 }}>
                                          {posten.map((p, pi) => { const kannErstatten = p.aufgeloest && p.betrag > 0 && (tx.status === 'succeeded' || (lv && lv.charge && lv.charge.bezahlt)); return (
                                            <div key={pi} style={{ fontSize: '0.74rem', color: 'var(--text-secondary,#cbd5e1)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                                              <span>• {p.label}{p.aufgeloest ? ` ${eur(p.betrag)}` : ''}{p.beschreibung ? <span style={{ color: 'var(--text-muted,#94a3b8)' }}> – {p.beschreibung}</span> : ''}{p.zugeordnet ? <span style={{ color: 'var(--text-muted,#94a3b8)', fontStyle: 'italic' }}> (autom. zugeordnet)</span> : ''}</span>
                                              {kannErstatten && <button onClick={() => refundTx(tx, Math.round(p.betrag * 100), p.label)} disabled={refundingTx[tx.id]} style={miniRefundBtn} title="Nur diese Position erstatten">↩</button>}
                                            </div>
                                          ); })}
                                        </div>
                                        {alleAufgeloest && Math.abs(aufgeloestSumme - (parseFloat(tx.betrag) || 0)) > 0.01 && <div style={{ color: '#f59e0b', fontSize: '0.72rem', marginTop: 3 }}>⚠ weicht von „Geschickt" ab</div>}
                                      </>);
                                    })()}
                                  </div>
                                  {/* 2) Geschickt */}
                                  <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '0.7rem' }}>
                                    <div style={lbl}>② Geschickt – an Stripe</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary,#e2e8f0)' }}>{datumZeit(tx.created_at)}</div>
                                    <div style={{ fontSize: '0.9rem', margin: '2px 0' }}><strong>{eur(tx.betrag)}</strong> <Badge color={s.color} bg={s.bg}>{s.label}</Badge></div>
                                    {tx.status === 'processing' && <button onClick={() => stoppeTx(tx)} disabled={stoppingTx[tx.id]} style={stoppBtn}>{stoppingTx[tx.id] ? 'Stoppt…' : '🚫 Stoppen'}</button>}
                                    {(tx.status === 'succeeded' || (lv && lv.charge && lv.charge.bezahlt && !lv.charge.erstattet)) && <button onClick={() => refundTx(tx)} disabled={refundingTx[tx.id]} style={refundBtn}>{refundingTx[tx.id] ? 'Erstattet…' : '↩ Rückerstatten'}</button>}
                                    <button onClick={() => openManual(tx)} style={manualBtn} title="Erstattung erfassen, die außerhalb Stripe (z. B. von einem anderen Konto) erfolgt ist">🏦 Manuell erstattet</button>
                                    {tx.error_message && <div style={{ color: '#fca5a5', fontSize: '0.72rem', marginTop: 3 }}>⚠ {tx.error_message}</div>}
                                    <div style={{ fontSize: '0.66rem', color: 'var(--text-muted,#94a3b8)', fontFamily: 'monospace', marginTop: 4, wordBreak: 'break-all' }}>PI: {tx.stripe_payment_intent_id || '—'}</div>
                                  </div>
                                  {/* 3) Bei Stripe */}
                                  <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '0.7rem' }}>
                                    <div style={lbl}>③ Bei Stripe – aktueller Stand</div>
                                    {stripeLiveLoading[tx.id] ? <div style={{ color: 'var(--text-muted,#94a3b8)', fontSize: '0.8rem' }}>Lädt…</div>
                                      : lv ? (lv.error ? <div style={{ color: '#fca5a5', fontSize: '0.78rem' }}>⚠ {lv.error}</div> : (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary,#cbd5e1)' }}>
                                          <div>PI-Status: <strong>{lv.payment_intent.status}</strong></div>
                                          <div>Betrag: {eur(lv.payment_intent.betrag)}</div>
                                          {lv.charge && <div>Charge: {lv.charge.status}</div>}
                                        </div>
                                      )) : <button onClick={() => ladeStripeLive(tx)} style={liveBtn} disabled={!tx.stripe_payment_intent_id}>Live laden</button>}
                                  </div>
                                  {/* 4) Zurück von Stripe */}
                                  <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '0.7rem' }}>
                                    <div style={lbl}>④ Zurück – nach der Abbuchung</div>
                                    {!lv || lv.error ? <div style={{ color: 'var(--text-muted,#94a3b8)', fontSize: '0.76rem' }}>{lv ? '—' : 'Erst „Live laden" (③)'}</div> : (
                                      <div style={{ fontSize: '0.8rem' }}>
                                        {lv.charge && lv.charge.bezahlt && !lv.charge.erstattet && <div style={{ color: '#22c55e' }}>✓ Eingezogen {eur(lv.payment_intent.betrag)}</div>}
                                        {lv.charge && lv.charge.erstattet && <div style={{ color: '#fbbf24' }}>↩ Erstattet {eur(lv.charge.betrag_erstattet)}</div>}
                                        {lv.payment_intent.status === 'processing' && <div style={{ color: '#f59e0b' }}>⏳ In Verarbeitung – Ergebnis steht aus</div>}
                                        {(lv.payment_intent.status === 'canceled' || lv.payment_intent.status === 'requires_payment_method') && <div style={{ color: '#ef4444' }}>✗ Nicht eingezogen / abgebrochen</div>}
                                        {lv.payment_intent.fehler && <div style={{ color: '#fca5a5' }}>Grund: {lv.payment_intent.fehler.decline_code || lv.payment_intent.fehler.code} – {lv.payment_intent.fehler.message}</div>}
                                      </div>
                                    )}
                                  </div>
                                  {/* 5) Rückerstattung */}
                                  <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '0.7rem' }}>
                                    <div style={lbl}>⑤ Rückerstattung</div>
                                    {(() => {
                                      const stripeRefunds = (lv && !lv.error && lv.refunds) ? lv.refunds : [];
                                      const manuelle = tx.manuelle_erstattungen || [];
                                      if (stripeRefunds.length === 0 && manuelle.length === 0) {
                                        return <div style={{ color: 'var(--text-muted,#94a3b8)', fontSize: '0.78rem' }}>{!lv ? 'Keine manuelle · Stripe erst „Live laden" (③)' : 'Keine Rückerstattung'}</div>;
                                      }
                                      const summe = stripeRefunds.reduce((s2, r) => s2 + (r.betrag || 0), 0) + manuelle.reduce((s2, me) => s2 + (Number(me.betrag) || 0), 0);
                                      return (
                                        <div style={{ fontSize: '0.8rem' }}>
                                          {stripeRefunds.map((r, ri) => (
                                            <div key={'s' + ri} style={{ marginBottom: 3 }}>
                                              <span style={{ color: '#fbbf24', fontWeight: 600 }}>↩ {eur(r.betrag)}</span> <Badge color={r.status === 'succeeded' ? '#22c55e' : r.status === 'failed' ? '#ef4444' : '#f59e0b'} bg={r.status === 'succeeded' ? 'rgba(34,197,94,0.12)' : r.status === 'failed' ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)'}>{r.status}</Badge> <Badge color="#a78bfa" bg="rgba(167,139,250,0.12)">Stripe</Badge>
                                              {r.erstellt ? <span style={{ color: 'var(--text-muted,#94a3b8)', fontSize: '0.72rem' }}> · {new Date(r.erstellt * 1000).toLocaleDateString('de-DE')}</span> : ''}
                                            </div>
                                          ))}
                                          {manuelle.map((me) => (
                                            <div key={'m' + me.id} style={{ marginBottom: 4 }}>
                                              <span style={{ color: '#38bdf8', fontWeight: 600 }}>🏦 {eur(me.betrag)}</span> <Badge color="#38bdf8" bg="rgba(56,189,248,0.12)">manuell</Badge>
                                              <span style={{ color: 'var(--text-muted,#94a3b8)', fontSize: '0.72rem' }}> · {datum(me.erstattet_am)}</span>
                                              <button onClick={() => deleteManual(me.id)} title="Manuelle Erstattung löschen" style={{ marginLeft: 5, background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.72rem', padding: 0 }}>✕</button>
                                              {me.quelle ? <div style={{ color: 'var(--text-muted,#94a3b8)', fontSize: '0.7rem' }}>Quelle: {me.quelle}</div> : ''}
                                              {me.bemerkung ? <div style={{ color: 'var(--text-secondary,#cbd5e1)', fontSize: '0.7rem', fontStyle: 'italic' }}>{me.bemerkung}</div> : ''}
                                            </div>
                                          ))}
                                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted,#94a3b8)', marginTop: 2 }}>Summe erstattet: {eur(summe)}</div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </Section>

          {/* Beiträge */}
          <Section titel="📋 Beiträge (Soll & bezahlt)" count={data.beitraege.length}>
            {data.beitraege.length === 0 ? <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.84rem', padding: '0.5rem 0' }}>Keine Beiträge.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Fällig</th><th style={th}>Art</th><th style={th}>Betrag</th><th style={th}>Status</th><th style={th}>Bezahlt am</th><th style={th}>Zahlungsart</th></tr></thead>
                <tbody>
                  {data.beitraege.map((b) => (
                    <tr key={b.beitrag_id}>
                      <td style={td}>{datum(b.zahlungsdatum)}</td>
                      <td style={td}>{ART_LABEL[b.art] || b.art}{(b.magicline_description || b.beschreibung) ? <span style={{ color: 'var(--text-muted,#94a3b8)', fontSize: '0.76rem' }}> · {b.magicline_description || b.beschreibung}</span> : ''}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{eur(b.betrag)}</td>
                      <td style={td}>{b.bezahlt ? <Badge color="#22c55e" bg="rgba(34,197,94,0.12)">bezahlt</Badge> : <Badge color="#f59e0b" bg="rgba(245,158,11,0.12)">offen</Badge>}</td>
                      <td style={td}>{datum(b.bezahlt_am)}</td>
                      <td style={{ ...td, color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>{b.zahlungsart || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Rechnungen */}
          {data.rechnungen.length > 0 && (
            <Section titel="🧾 Rechnungen" count={data.rechnungen.length}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Datum</th><th style={th}>Nr.</th><th style={th}>Betrag</th><th style={th}>Status</th><th style={th}>Bezahlt am</th></tr></thead>
                <tbody>
                  {data.rechnungen.map((r) => (
                    <tr key={r.rechnung_id}>
                      <td style={td}>{datum(r.datum)}</td>
                      <td style={{ ...td, fontSize: '0.78rem' }}>{r.rechnungsnummer || r.rechnung_id}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{eur(r.betrag)}</td>
                      <td style={td}><Badge color={r.status === 'bezahlt' ? '#22c55e' : '#f59e0b'} bg={r.status === 'bezahlt' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)'}>{r.status}</Badge></td>
                      <td style={td}>{datum(r.bezahlt_am)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Verkäufe */}
          {data.verkaeufe.length > 0 && (
            <Section titel="🛒 Verkäufe / Artikel" count={data.verkaeufe.length}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Datum</th><th style={th}>Bon</th><th style={th}>Betrag</th><th style={th}>Status</th><th style={th}>Zahlungsart</th></tr></thead>
                <tbody>
                  {data.verkaeufe.map((v) => (
                    <React.Fragment key={v.verkauf_id}>
                      <tr>
                        <td style={td}>{datum(v.verkauf_datum)}</td>
                        <td style={{ ...td, fontSize: '0.78rem' }}>{v.bon_nummer || v.verkauf_id}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{eur(v.betrag)}</td>
                        <td style={td}><Badge color={v.zahlungsstatus === 'bezahlt' ? '#22c55e' : '#f59e0b'} bg={v.zahlungsstatus === 'bezahlt' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)'}>{v.zahlungsstatus}</Badge></td>
                        <td style={{ ...td, color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>{v.zahlungsart || '—'}</td>
                      </tr>
                      {v.positionen && v.positionen.length > 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '0 0.6rem 0.5rem 1.4rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            {v.positionen.map((p) => (
                              <div key={p.position_id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted,#94a3b8)', padding: '0.1rem 0' }}>
                                <span>• {p.menge}× {p.artikel_name}{p.artikel_nummer ? <span style={{ opacity: 0.6 }}> ({p.artikel_nummer})</span> : ''}</span>
                                <span>{eur(p.brutto)}</span>
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Artikel-Übersicht: wie oft welcher Artikel */}
          {data.artikel_uebersicht && data.artikel_uebersicht.length > 0 && (
            <Section titel="🧮 Artikel-Übersicht (wie oft gekauft)" count={data.artikel_uebersicht.length}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Artikel</th><th style={th}>Mal gekauft</th><th style={th}>Menge gesamt</th><th style={th}>Summe</th></tr></thead>
                <tbody>
                  {data.artikel_uebersicht.map((a, i) => (
                    <tr key={i}>
                      <td style={td}>{a.artikel_name}{a.artikel_nummer ? <span style={{ color: 'var(--text-muted,#94a3b8)', fontSize: '0.74rem' }}> · {a.artikel_nummer}</span> : ''}</td>
                      <td style={{ ...td, textAlign: 'center' }}>{a.gekauft}×</td>
                      <td style={{ ...td, textAlign: 'center', fontWeight: 600 }}>{a.menge_gesamt}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{eur(a.summe)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}

          {/* Rücklastschriften */}
          {data.ruecklastschriften.length > 0 && (
            <Section titel="↩️ Rücklastschriften" count={data.ruecklastschriften.length}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Datum</th><th style={th}>Betrag</th><th style={th}>Code</th><th style={th}>Grund</th><th style={th}>Status</th></tr></thead>
                <tbody>
                  {data.ruecklastschriften.map((r) => (
                    <tr key={r.id}>
                      <td style={td}>{datum(r.rueckgabe_datum)}</td>
                      <td style={{ ...td, fontWeight: 600, color: '#ef4444' }}>{eur(r.betrag)}</td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.78rem' }}>{r.rueckgabe_code || '—'}</td>
                      <td style={{ ...td, fontSize: '0.8rem' }}>{r.rueckgabe_grund || '—'}</td>
                      <td style={td}>{r.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          )}
        </div>
      )}

      {/* Modal: Manuelle Erstattung (außerhalb Stripe) */}
      {manualForm && (
        <div
          onClick={() => !savingManual && setManualForm(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 4000, background: 'rgba(8,10,20,0.72)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 460, background: 'linear-gradient(160deg, rgba(26,26,46,0.99), rgba(18,18,34,0.99))', border: '1px solid rgba(56,189,248,0.35)', borderRadius: 14, boxShadow: '0 24px 60px rgba(0,0,0,0.55)', padding: '1.3rem', color: 'var(--text-primary,#e2e8f0)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#7dd3fc' }}>🏦 Manuelle Erstattung</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted,#94a3b8)', marginTop: 2 }}>
                  außerhalb Stripe · Lauf {manualForm.monat}/{manualForm.jahr} · geschickt {eur(manualForm.betrag)}
                </div>
              </div>
              <button onClick={() => !savingManual && setManualForm(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted,#94a3b8)', fontSize: '1.4rem', lineHeight: 1, cursor: 'pointer', padding: 0 }}>×</button>
            </div>

            <div style={{ display: 'flex', gap: '0.7rem', marginBottom: '0.8rem' }}>
              <label style={{ flex: 1, fontSize: '0.72rem', color: 'var(--text-muted,#94a3b8)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600 }}>
                Betrag €
                <input type="text" inputMode="decimal" autoFocus value={manualFields.betrag} onChange={e => setManualFields(f => ({ ...f, betrag: e.target.value }))} style={modalInp} />
              </label>
              <label style={{ flex: 1, fontSize: '0.72rem', color: 'var(--text-muted,#94a3b8)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600 }}>
                Erstattet am
                <input type="date" value={manualFields.datum} onChange={e => setManualFields(f => ({ ...f, datum: e.target.value }))} style={modalInp} />
              </label>
            </div>

            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted,#94a3b8)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600, marginBottom: '0.8rem' }}>
              Quelle / Konto
              <input type="text" placeholder="z. B. Überweisung von Geschäftskonto" value={manualFields.quelle} onChange={e => setManualFields(f => ({ ...f, quelle: e.target.value }))} style={modalInp} />
            </label>

            <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted,#94a3b8)', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600, marginBottom: '1.1rem' }}>
              Bemerkungen
              <textarea rows={3} placeholder="optionale Notiz" value={manualFields.bemerkung} onChange={e => setManualFields(f => ({ ...f, bemerkung: e.target.value }))} style={{ ...modalInp, resize: 'vertical' }} />
            </label>

            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setManualForm(null)} disabled={savingManual} style={{ background: 'rgba(148,163,184,0.12)', border: '1px solid rgba(148,163,184,0.4)', color: '#cbd5e1', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}>Abbrechen</button>
              <button onClick={() => submitManual(manualForm)} disabled={savingManual} style={{ background: 'rgba(34,197,94,0.18)', border: '1px solid rgba(34,197,94,0.55)', color: '#4ade80', borderRadius: 8, padding: '0.5rem 1.2rem', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer' }}>{savingManual ? 'Speichert…' : '✓ Erstattung speichern'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modalInp = { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 5, padding: '0.5rem 0.6rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 8, color: 'var(--text-primary,#e2e8f0)', fontSize: '0.9rem', fontWeight: 400, textTransform: 'none', letterSpacing: 'normal' };
