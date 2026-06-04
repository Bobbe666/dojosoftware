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
const TYP_ICON = { doppelbuchung: '🔁', betrags_abweichung: '⚖️', phantom: '👻' };

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
                                <div key={tx.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.6rem 0', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
                                  {/* Links: von uns geschickt */}
                                  <div>
                                    <div style={lbl}>📤 Von uns geschickt</div>
                                    <div style={{ fontSize: '0.84rem', color: 'var(--text-primary,#e2e8f0)' }}>{datumZeit(tx.created_at)}</div>
                                    <div style={{ fontSize: '0.9rem', margin: '2px 0' }}><strong>{eur(tx.betrag)}</strong> <Badge color={s.color} bg={s.bg}>{s.label}</Badge></div>
                                    {tx.error_message && <div style={{ color: '#fca5a5', fontSize: '0.78rem' }}>⚠ {tx.error_code}: {tx.error_message}</div>}
                                    {ids.length > 0 && (
                                      <div style={{ marginTop: 4 }}>
                                        {ids.map(id => { const b = beitragById[id]; return (
                                          <div key={id} style={{ fontSize: '0.78rem', color: 'var(--text-secondary,#cbd5e1)' }}>
                                            • {b ? (ART_LABEL[b.art] || b.art) : `Beitrag ${id}`} {b ? eur(b.betrag) : ''}{b && b.magicline_description ? <span style={{ color: 'var(--text-muted,#94a3b8)' }}> – {b.magicline_description}</span> : (b && b.beschreibung ? <span style={{ color: 'var(--text-muted,#94a3b8)' }}> – {b.beschreibung}</span> : '')}
                                          </div>
                                        ); })}
                                      </div>
                                    )}
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted,#94a3b8)', fontFamily: 'monospace', marginTop: 4 }}>PI: {tx.stripe_payment_intent_id || '—'}{tx.stripe_charge_id ? <><br />Charge: {tx.stripe_charge_id}</> : ''}{tx.processed_at ? <><br />verarbeitet: {datumZeit(tx.processed_at)}</> : ''}</div>
                                  </div>
                                  {/* Rechts: bei Stripe tatsächlich */}
                                  <div style={{ borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: '0.9rem' }}>
                                    <div style={lbl}>🏦 Bei Stripe tatsächlich</div>
                                    {stripeLiveLoading[tx.id] ? (
                                      <div style={{ color: 'var(--text-muted,#94a3b8)', fontSize: '0.82rem' }}>Lädt von Stripe…</div>
                                    ) : lv ? (
                                      lv.error ? <div style={{ color: '#fca5a5', fontSize: '0.8rem' }}>⚠ {lv.error}</div> : (
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary,#cbd5e1)' }}>
                                          <div>PI-Status: <strong>{lv.payment_intent.status}</strong></div>
                                          {lv.charge && <div>Charge: {lv.charge.status} · {lv.charge.bezahlt ? '✓ bezahlt' : 'nicht bezahlt'}{lv.charge.erstattet ? ` · erstattet ${eur(lv.charge.betrag_erstattet)}` : ''}</div>}
                                          {lv.payment_intent.fehler && <div style={{ color: '#fca5a5' }}>Fehler: {lv.payment_intent.fehler.code} {lv.payment_intent.fehler.decline_code ? `(${lv.payment_intent.fehler.decline_code})` : ''} – {lv.payment_intent.fehler.message}</div>}
                                          {lv.refunds && lv.refunds.length > 0 && <div style={{ color: '#ef4444' }}>Rückerstattungen: {lv.refunds.map(r => `${eur(r.betrag)} (${r.status})`).join(', ')}</div>}
                                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted,#94a3b8)', marginTop: 2 }}>Betrag bei Stripe: {eur(lv.payment_intent.betrag)}</div>
                                        </div>
                                      )
                                    ) : (
                                      <button onClick={() => ladeStripeLive(tx)} style={liveBtn} disabled={!tx.stripe_payment_intent_id}>Live von Stripe laden</button>
                                    )}
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
    </div>
  );
}
