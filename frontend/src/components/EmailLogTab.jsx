import React, { useState, useEffect, useCallback } from 'react';
import { Mail, Search, RefreshCw, X, ShieldCheck, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';

// Zentrales E-Mail-Protokoll: ALLE vom System versendeten Mails (auch ohne
// Dojo-Zuordnung), vollständig, zeitgestempelt, mit Integritäts-Hash.
export default function EmailLogTab() {
  const [emails, setEmails] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const verify = async () => {
    setVerifying(true); setVerifyResult(null);
    try {
      const r = await fetchWithAuth(`${config.apiBaseUrl}/admin/emails/verify`);
      setVerifyResult(await r.json());
    } catch (e) {
      setVerifyResult({ ok: false, error: e.message });
    } finally { setVerifying(false); }
  };

  const exportJson = async () => {
    try {
      const r = await fetchWithAuth(`${config.apiBaseUrl}/admin/emails/export`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'email-archiv-export.json'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { alert('Export fehlgeschlagen: ' + e.message); }
  };

  const load = useCallback(async (query = '') => {
    setLoading(true);
    try {
      const url = `${config.apiBaseUrl}/admin/emails?limit=300${query ? `&q=${encodeURIComponent(query)}` : ''}`;
      const r = await fetchWithAuth(url);
      const d = await r.json();
      setEmails(Array.isArray(d.emails) ? d.emails : []);
      setTotal(d.total || 0);
    } catch (e) {
      setEmails([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEmail = async (id) => {
    setDetailLoading(true);
    setSelected({ id });
    try {
      const r = await fetchWithAuth(`${config.apiBaseUrl}/admin/emails/${id}`);
      const d = await r.json();
      setSelected(d.email || null);
    } catch (e) {
      alert('E-Mail konnte nicht geladen werden: ' + e.message);
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const fmt = (dt) => (dt ? new Date(dt).toLocaleString('de-DE') : '–');
  const statusColor = (s) => (s === 'fehler' ? '#ef4444' : '#22c55e');

  const Row = ({ label, value, mono }) => (
    <div style={{ display: 'flex', gap: '0.6rem', padding: '4px 0', borderBottom: '1px solid var(--border,rgba(255,255,255,0.06))' }}>
      <div style={{ minWidth: 130, color: 'var(--text-3,#9ca3af)', fontSize: 13 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, wordBreak: 'break-word', fontFamily: mono ? 'monospace' : 'inherit' }}>{value || '–'}</div>
    </div>
  );

  return (
    <div className="section-card">
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.9rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0 }}>
          <Mail size={18} /> E-Mail-Protokoll
        </h3>
        <span style={{ color: 'var(--text-3,#9ca3af)', fontSize: 13 }}>({total} gespeichert)</span>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 8, top: 9, color: '#9ca3af' }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && load(q)}
            placeholder="Empfänger, Betreff, Absender…"
            style={{ padding: '6px 10px 6px 28px', borderRadius: 8, border: '1px solid var(--border,rgba(255,255,255,0.15))', background: 'var(--bg-2,#12122a)', color: 'inherit', fontSize: 13, minWidth: 240 }}
          />
        </div>
        <button className="btn-secondary" onClick={() => load(q)} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={14} /> Aktualisieren
        </button>
        <button className="btn-secondary" onClick={verify} disabled={verifying} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={14} /> {verifying ? 'Prüfe…' : 'Integrität prüfen'}
        </button>
        <button className="btn-secondary" onClick={exportJson} style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Download size={14} /> Export
        </button>
      </div>

      {verifyResult && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 0.8rem', padding: '10px 14px', borderRadius: 8, fontSize: 13,
          background: verifyResult.ok ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${verifyResult.ok ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          color: verifyResult.ok ? '#4ade80' : '#f87171'
        }}>
          {verifyResult.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {verifyResult.error
            ? `Prüfung fehlgeschlagen: ${verifyResult.error}`
            : verifyResult.ok
              ? `Hash-Kette intakt – ${verifyResult.checked} Einträge geprüft, keine Manipulation. (${new Date(verifyResult.geprueft_am).toLocaleString('de-DE')})`
              : `⚠️ ${verifyResult.problems?.length || 0} Problem(e) gefunden bei ${verifyResult.checked} geprüften Einträgen: ` +
                (verifyResult.problems || []).slice(0, 5).map(p => `#${p.id} ${p.msg}`).join('; ')}
        </div>
      )}

      <p style={{ fontSize: 12.5, color: 'var(--text-3,#9ca3af)', margin: '0 0 0.8rem' }}>
        Jede vom System versendete E-Mail wird hier vollständig, mit Zeitstempel und Integritäts-Hash (SHA-256) gespeichert – ansehbar und abrufbar.
      </p>

      {loading ? (
        <p style={{ color: 'var(--text-3,#9ca3af)' }}>Lädt…</p>
      ) : emails.length === 0 ? (
        <p style={{ color: 'var(--text-3,#9ca3af)', fontStyle: 'italic' }}>Keine E-Mails gefunden.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-3,#9ca3af)', borderBottom: '1px solid var(--border,rgba(255,255,255,0.12))' }}>
                <th style={{ padding: '6px 8px' }}>Datum</th>
                <th style={{ padding: '6px 8px' }}>Dojo</th>
                <th style={{ padding: '6px 8px' }}>Empfänger</th>
                <th style={{ padding: '6px 8px' }}>Betreff</th>
                <th style={{ padding: '6px 8px' }}>Typ</th>
                <th style={{ padding: '6px 8px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((m) => (
                <tr key={m.id} onClick={() => openEmail(m.id)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid var(--border,rgba(255,255,255,0.06))' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>{fmt(m.gesendet_am)}</td>
                  <td style={{ padding: '6px 8px' }}>{m.dojoname || <span style={{ color: '#9ca3af' }}>System</span>}</td>
                  <td style={{ padding: '6px 8px' }}>{m.empfaenger_email || '–'}</td>
                  <td style={{ padding: '6px 8px' }}>{m.betreff || '–'}</td>
                  <td style={{ padding: '6px 8px', color: '#9ca3af', fontSize: 12 }}>{m.versand_typ || '–'}</td>
                  <td style={{ padding: '6px 8px' }}>
                    <span style={{ color: statusColor(m.status), fontWeight: 600 }}>{m.status || '–'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div onClick={() => setSelected(null)}
             style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div onClick={(e) => e.stopPropagation()}
               style={{ background: 'rgba(26,26,46,0.99)', borderRadius: 12, maxWidth: 820, width: '100%', maxHeight: '90vh', overflow: 'auto', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', position: 'sticky', top: 0, background: 'rgba(26,26,46,0.99)' }}>
              <strong style={{ fontSize: 15 }}>{detailLoading ? 'Lädt…' : (selected.betreff || 'E-Mail')}</strong>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            {!detailLoading && (
              <div style={{ padding: '1.2rem' }}>
                <Row label="Datum" value={fmt(selected.gesendet_am)} />
                <Row label="Von" value={selected.absender} />
                <Row label="An" value={selected.empfaenger_email} />
                {selected.kopie_cc && <Row label="CC" value={selected.kopie_cc} />}
                {selected.kopie_bcc && <Row label="BCC (Kopie)" value={selected.kopie_bcc} />}
                <Row label="Dojo" value={selected.dojoname || 'System (keine Zuordnung)'} />
                <Row label="Typ" value={selected.versand_typ} />
                <Row label="Status" value={selected.status} />
                <Row label="Message-ID" value={selected.message_id} mono />
                <Row label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ShieldCheck size={13} /> Integritäts-Hash</span>} value={selected.inhalt_hash} mono />

                <div style={{ marginTop: '1rem' }}>
                  <div style={{ color: 'var(--text-3,#9ca3af)', fontSize: 13, marginBottom: 6 }}>Inhalt</div>
                  {selected.html_inhalt ? (
                    <iframe
                      title="E-Mail-Inhalt"
                      sandbox=""
                      srcDoc={selected.html_inhalt}
                      style={{ width: '100%', height: 420, border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, background: '#fff' }}
                    />
                  ) : (
                    <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, background: 'rgba(0,0,0,0.25)', padding: 12, borderRadius: 8 }}>{selected.text_inhalt || '(kein Inhalt)'}</pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
