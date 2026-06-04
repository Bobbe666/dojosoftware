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
          </div>

          {/* KPI-Kacheln */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem' }}>
            <div style={card}><div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>Bezahlt gesamt</div><div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#22c55e' }}>{eur(z.bezahlt_gesamt)}</div></div>
            <div style={card}><div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>Offen gesamt</div><div style={{ fontSize: '1.2rem', fontWeight: 700, color: z.offen_gesamt > 0 ? '#f59e0b' : '#e2e8f0' }}>{eur(z.offen_gesamt)}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>{z.anzahl_offene_beitraege} offene Beiträge</div></div>
            <div style={card}><div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>Gerade in Einzug</div><div style={{ fontSize: '1.2rem', fontWeight: 700, color: z.in_einzug_gesamt > 0 ? '#f59e0b' : '#e2e8f0' }}>{eur(z.in_einzug_gesamt)}</div></div>
            <div style={card}><div style={{ fontSize: '0.74rem', color: 'var(--text-muted, #94a3b8)' }}>Nächste Fälligkeit</div>{z.naechste_faelligkeit ? <><div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#e2e8f0' }}>{eur(z.naechste_faelligkeit.betrag)}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>{datum(z.naechste_faelligkeit.faellig)}</div></> : <div style={{ fontSize: '1rem', color: 'var(--text-muted, #94a3b8)' }}>—</div>}</div>
          </div>

          {/* Lastschrift-Abbuchungen */}
          <Section titel="🏦 Lastschrift-Abbuchungen (Stripe)" count={data.lastschriften.length}>
            {data.lastschriften.length === 0 ? <div style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '0.84rem', padding: '0.5rem 0' }}>Keine Stripe-Lastschriften.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Datum</th><th style={th}>Betrag</th><th style={th}>Status</th><th style={th}>Für (Lauf)</th><th style={th}>Beiträge</th><th style={th}>Payment-Intent</th></tr></thead>
                <tbody>
                  {data.lastschriften.map((l) => {
                    const s = LS_STATUS[l.status] || { label: l.status, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)' };
                    let ids = []; try { ids = JSON.parse(l.beitrag_ids || '[]'); } catch {}
                    return (
                      <tr key={l.id}>
                        <td style={td}>{datumZeit(l.created_at)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{eur(l.betrag)}</td>
                        <td style={td}><Badge color={s.color} bg={s.bg}>{s.label}</Badge></td>
                        <td style={td}>{l.monat}/{l.jahr}</td>
                        <td style={{ ...td, color: 'var(--text-muted, #94a3b8)', fontSize: '0.78rem' }}>{ids.length ? ids.join(', ') : '—'}</td>
                        <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted, #94a3b8)' }}>{l.stripe_payment_intent_id ? l.stripe_payment_intent_id.slice(0, 20) + '…' : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
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
                      <td style={td}>{ART_LABEL[b.art] || b.art}{b.beschreibung ? <span style={{ color: 'var(--text-muted,#94a3b8)', fontSize: '0.76rem' }}> · {b.beschreibung}</span> : ''}</td>
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
                    <tr key={v.verkauf_id}>
                      <td style={td}>{datum(v.verkauf_datum)}</td>
                      <td style={{ ...td, fontSize: '0.78rem' }}>{v.bon_nummer || v.verkauf_id}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{eur(v.betrag)}</td>
                      <td style={td}><Badge color={v.zahlungsstatus === 'bezahlt' ? '#22c55e' : '#f59e0b'} bg={v.zahlungsstatus === 'bezahlt' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)'}>{v.zahlungsstatus}</Badge></td>
                      <td style={{ ...td, color: 'var(--text-muted, #94a3b8)', fontSize: '0.8rem' }}>{v.zahlungsart || '—'}</td>
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
