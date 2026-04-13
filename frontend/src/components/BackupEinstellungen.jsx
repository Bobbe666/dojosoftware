import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const token = () => localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
const api = (url, opts = {}) => axios({ url, headers: { Authorization: `Bearer ${token()}` }, ...opts });

const PROTO_OPTIONS = [
  { value: 'ftps', label: 'FTPS (empfohlen, Port 21)' },
  { value: 'ftp',  label: 'FTP (unverschlüsselt)' },
  { value: 'sftp', label: 'SFTP (Port 22)' },
];

const STATUS_COLORS = {
  erfolg: { bg: 'rgba(34,197,94,.15)', border: 'rgba(34,197,94,.35)', text: '#22c55e' },
  fehler: { bg: 'rgba(239,68,68,.15)', border: 'rgba(239,68,68,.35)', text: '#f87171' },
  laeuft: { bg: 'rgba(99,102,241,.15)', border: 'rgba(99,102,241,.35)', text: '#818cf8' },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.laeuft;
  const labels = { erfolg: '✓ Erfolg', fehler: '✗ Fehler', laeuft: '⟳ Läuft...' };
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: `1px solid ${c.border}`, background: c.bg, color: c.text }}>
      {labels[status] || status}
    </span>
  );
}

function SectionCard({ title, children, style }) {
  return (
    <div style={{ background: 'var(--bg-2,#1e2130)', borderRadius: 10, padding: '20px 24px', border: '1px solid var(--border,rgba(255,255,255,.08))', marginBottom: 16, ...style }}>
      {title && <h4 style={{ margin: '0 0 16px', color: 'var(--text-1,#e2e8f0)', fontSize: 14, fontWeight: 600 }}>{title}</h4>}
      {children}
    </div>
  );
}

function FormField({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-3,#94a3b8)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</label>
      {children}
      {hint && <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-3,#6b7280)' }}>{hint}</p>}
    </div>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box', background: 'var(--bg-3,#2a2f45)', border: '1px solid var(--border,rgba(255,255,255,.12))',
  borderRadius: 6, padding: '8px 10px', color: 'var(--text-1,#e2e8f0)', fontSize: 13, outline: 'none'
};

const btnPrimary = {
  background: 'linear-gradient(135deg,#3b6ff0,#6366f1)', color: '#fff', border: 'none',
  borderRadius: 7, padding: '9px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 13
};

const btnSecondary = {
  background: 'var(--bg-3,#2a2f45)', color: 'var(--text-2,#cbd5e1)', border: '1px solid var(--border,rgba(255,255,255,.12))',
  borderRadius: 7, padding: '9px 16px', cursor: 'pointer', fontSize: 13
};

export default function BackupEinstellungen() {
  const [activeSection, setActiveSection] = useState('verbindung');
  const [settings, setSettings] = useState({ protokoll: 'ftps', port: 21, remote_pfad: '/backup/', aufbewahrung_tage: 30, aktiv: 1 });
  const [passwort, setPasswort] = useState('');
  const [datenbanken, setDatenbanken] = useState([]);
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [pollTimer, setPollTimer] = useState(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [sRes, stRes] = await Promise.all([
        api('/api/backup-admin/settings'),
        api('/api/backup-admin/status'),
      ]);
      if (sRes.data.settings) {
        setSettings(sRes.data.settings);
      }
      setDatenbanken(sRes.data.datenbanken || []);
      setStatus(stRes.data);
      if (stRes.data.aktuellLaufend) setRunningId(stRes.data.aktuellLaufend);
    } catch (e) { /* silent */ }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const r = await api('/api/backup-admin/history');
      setHistory(r.data.runs || []);
    } catch (_) {}
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (activeSection === 'verlauf') loadHistory(); }, [activeSection, loadHistory]);

  // Polling wenn Backup läuft
  useEffect(() => {
    if (runningId) {
      const t = setInterval(async () => {
        try {
          const r = await api('/api/backup-admin/status');
          setStatus(r.data);
          if (!r.data.aktuellLaufend) {
            setRunningId(null);
            clearInterval(t);
            loadHistory();
            setMsg('✓ Backup abgeschlossen!');
          }
        } catch (_) {}
      }, 3000);
      setPollTimer(t);
      return () => clearInterval(t);
    }
  }, [runningId, loadHistory]);

  const saveSettings = async () => {
    setSaving(true); setMsg('');
    try {
      const payload = { ...settings };
      if (passwort && passwort !== '••••••••') payload.passwort = passwort;
      await api('/api/backup-admin/settings', { method: 'PUT', data: payload });
      setMsg('✓ Einstellungen gespeichert');
      setPasswort('');
      load();
    } catch (e) { setMsg('✗ Fehler: ' + (e.response?.data?.error || e.message)); }
    setSaving(false);
  };

  const testConnection = async () => {
    setTestResult(null); setLoading(true);
    try {
      const r = await api('/api/backup-admin/test-connection', { method: 'POST' });
      setTestResult(r.data);
    } catch (e) { setTestResult({ success: false, output: e.response?.data?.error || e.message }); }
    setLoading(false);
  };

  const startBackup = async () => {
    setMsg('');
    try {
      const r = await api('/api/backup-admin/run', { method: 'POST' });
      setRunningId(r.data.runId);
      setMsg('⟳ Backup gestartet (ID #' + r.data.runId + ')');
    } catch (e) { setMsg('✗ ' + (e.response?.data?.error || e.message)); }
  };

  const saveDb = async (db, idx) => {
    try {
      await api(`/api/backup-admin/datenbank/${db.id}`, { method: 'PUT', data: { db_user: db.db_user, db_passwort: db._newPass || db.db_passwort, aktiv: db.aktiv } });
      setMsg('✓ Datenbank gespeichert');
      load();
    } catch (e) { setMsg('✗ ' + e.message); }
  };

  const updateDb = (idx, field, value) => {
    setDatenbanken(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const sectionTabs = [
    { id: 'verbindung', label: '🔌 Verbindung', icon: '🔌' },
    { id: 'datenbanken', label: '🗄️ Datenbanken', icon: '🗄️' },
    { id: 'status', label: '📊 Status', icon: '📊' },
    { id: 'verlauf', label: '📋 Verlauf', icon: '📋' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 28 }}>💾</div>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-1,#e2e8f0)', fontSize: 16 }}>Backup-Verwaltung</h3>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-3,#94a3b8)' }}>Automatische Sicherung auf Alfahosting · Datenbanken, Events, Hall of Fame</p>
        </div>
        {runningId && (
          <span style={{ marginLeft: 'auto', fontSize: 12, background: 'rgba(99,102,241,.2)', color: '#818cf8', border: '1px solid rgba(99,102,241,.4)', borderRadius: 6, padding: '4px 10px', animation: 'pulse 1.5s infinite' }}>
            ⟳ Backup #{ runningId} läuft...
          </span>
        )}
      </div>

      {/* Sub-Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border,rgba(255,255,255,.08))', paddingBottom: 0 }}>
        {sectionTabs.map(t => (
          <button key={t.id} onClick={() => setActiveSection(t.id)} style={{
            background: activeSection === t.id ? 'var(--bg-2,#1e2130)' : 'transparent',
            color: activeSection === t.id ? '#818cf8' : 'var(--text-3,#94a3b8)',
            border: activeSection === t.id ? '1px solid rgba(99,102,241,.35)' : '1px solid transparent',
            borderBottom: activeSection === t.id ? '1px solid var(--bg-2,#1e2130)' : 'none',
            borderRadius: '6px 6px 0 0', padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: activeSection === t.id ? 600 : 400
          }}>
            {t.label}
          </button>
        ))}

        <button onClick={startBackup} disabled={!!runningId} style={{
          ...btnPrimary, marginLeft: 'auto', marginBottom: 4, opacity: runningId ? 0.5 : 1,
          background: 'linear-gradient(135deg,#059669,#10b981)'
        }}>
          {runningId ? '⟳ Läuft...' : '▶ Jetzt sichern'}
        </button>
      </div>

      {msg && (
        <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 7, fontSize: 13,
          background: msg.startsWith('✓') ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)',
          border: `1px solid ${msg.startsWith('✓') ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`,
          color: msg.startsWith('✓') ? '#22c55e' : '#f87171' }}>
          {msg}
        </div>
      )}

      {/* ── Verbindung ── */}
      {activeSection === 'verbindung' && (
        <div>
          <SectionCard title="🔌 FTP/SFTP Verbindung (Alfahosting)">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <FormField label="Protokoll">
                <select value={settings.protokoll || 'ftps'} onChange={e => setSettings(s => ({ ...s, protokoll: e.target.value }))} style={{ ...inputStyle }}>
                  {PROTO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </FormField>
              <FormField label="Port">
                <input type="number" value={settings.port || 21} onChange={e => setSettings(s => ({ ...s, port: parseInt(e.target.value) }))} style={inputStyle} />
              </FormField>
              <FormField label="FTP-Host" hint="z.B. s123456.alfahosting-server.de">
                <input type="text" value={settings.host || ''} onChange={e => setSettings(s => ({ ...s, host: e.target.value }))} style={inputStyle} placeholder="ftp.alfahosting.de" />
              </FormField>
              <FormField label="Remote Pfad" hint="Verzeichnis auf dem FTP-Server">
                <input type="text" value={settings.remote_pfad || '/backup/'} onChange={e => setSettings(s => ({ ...s, remote_pfad: e.target.value }))} style={inputStyle} placeholder="/backup/" />
              </FormField>
              <FormField label="FTP-Benutzername">
                <input type="text" value={settings.benutzername || ''} onChange={e => setSettings(s => ({ ...s, benutzername: e.target.value }))} style={inputStyle} />
              </FormField>
              <FormField label="FTP-Passwort">
                <input type="password" value={passwort || (settings._hasPassword ? '••••••••' : '')} onChange={e => setPasswort(e.target.value)} style={inputStyle} placeholder={settings._hasPassword ? '••••••••' : 'Passwort eingeben'} />
              </FormField>
              <FormField label="Aufbewahrung (Tage)" hint="Ältere lokale Backups werden gelöscht">
                <input type="number" value={settings.aufbewahrung_tage || 30} onChange={e => setSettings(s => ({ ...s, aufbewahrung_tage: parseInt(e.target.value) }))} style={inputStyle} />
              </FormField>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={saveSettings} disabled={saving} style={btnPrimary}>{saving ? '...' : '💾 Speichern'}</button>
              <button onClick={testConnection} disabled={loading} style={btnSecondary}>{loading ? '⟳ Teste...' : '🔌 Verbindung testen'}</button>
            </div>
          </SectionCard>

          {testResult && (
            <SectionCard>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{testResult.success ? '✅' : '❌'}</span>
                <strong style={{ color: testResult.success ? '#22c55e' : '#f87171', fontSize: 14 }}>
                  {testResult.success ? 'Verbindung erfolgreich!' : 'Verbindung fehlgeschlagen'}
                </strong>
              </div>
              {testResult.output && (
                <pre style={{ margin: 0, fontSize: 11, color: 'var(--text-3,#94a3b8)', background: 'var(--bg-1,#13161e)', padding: 10, borderRadius: 6, overflow: 'auto', maxHeight: 200 }}>
                  {testResult.output}
                </pre>
              )}
            </SectionCard>
          )}
        </div>
      )}

      {/* ── Datenbanken ── */}
      {activeSection === 'datenbanken' && (
        <div>
          <p style={{ fontSize: 13, color: 'var(--text-3,#94a3b8)', marginBottom: 16 }}>
            Konfiguriere welche Datenbanken gesichert werden sollen. Die Zugangsdaten werden nur für den mysqldump-Prozess verwendet.
          </p>
          {datenbanken.map((db, idx) => (
            <SectionCard key={db.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!db.aktiv} onChange={e => updateDb(idx, 'aktiv', e.target.checked ? 1 : 0)} style={{ accentColor: '#818cf8', width: 16, height: 16 }} />
                </label>
                <div>
                  <strong style={{ color: 'var(--text-1,#e2e8f0)', fontSize: 14 }}>{db.anzeigename}</strong>
                  <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--text-3,#94a3b8)', background: 'var(--bg-3,#2a2f45)', padding: '2px 7px', borderRadius: 4 }}>
                    {db.db_name} @ {db.db_host}
                  </span>
                </div>
                {!db.aktiv && <span style={{ fontSize: 11, color: '#f87171', marginLeft: 'auto' }}>Deaktiviert</span>}
              </div>
              {db.aktiv ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                  <FormField label="MySQL Benutzer">
                    <input type="text" value={db.db_user || ''} onChange={e => updateDb(idx, 'db_user', e.target.value)} style={inputStyle} />
                  </FormField>
                  <FormField label="MySQL Passwort">
                    <input type="password" value={db._newPass !== undefined ? db._newPass : (db._hasPassword ? '••••••••' : '')}
                      onChange={e => updateDb(idx, '_newPass', e.target.value)}
                      style={inputStyle} placeholder={db._hasPassword ? 'Passwort hinterlegt ✓' : 'Passwort eingeben'} />
                  </FormField>
                  <div style={{ gridColumn: '1/-1', marginTop: 4 }}>
                    <button onClick={() => saveDb(db, idx)} style={{ ...btnPrimary, fontSize: 12, padding: '7px 14px' }}>💾 Speichern</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => saveDb(db, idx)} style={{ ...btnSecondary, fontSize: 12, padding: '7px 14px', marginTop: 4 }}>Änderung speichern</button>
              )}
            </SectionCard>
          ))}
        </div>
      )}

      {/* ── Status ── */}
      {activeSection === 'status' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Letzter Backup', value: status?.letzterErfolg ? new Date(status.letzterErfolg.gestartet_am).toLocaleString('de-DE') : '–', icon: '📅' },
              { label: 'Letzter Status', value: status?.letzterRun ? <StatusBadge status={status.letzterRun.status} /> : '–', icon: '📊' },
              { label: 'Lokale Größe', value: status?.lokaleGroesse || '–', icon: '📦' },
              { label: 'Datenbanken', value: datenbanken.filter(d => d.aktiv).length + ' aktiv', icon: '🗄️' },
            ].map((card, i) => (
              <div key={i} style={{ background: 'var(--bg-2,#1e2130)', borderRadius: 10, padding: '16px 20px', border: '1px solid var(--border,rgba(255,255,255,.08))' }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{card.icon}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3,#94a3b8)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1,#e2e8f0)' }}>{card.value}</div>
              </div>
            ))}
          </div>

          {status?.letzterRun?.details && (
            <SectionCard title="Letzter Backup-Lauf">
              {(() => {
                let details;
                try { details = typeof status.letzterRun.details === 'string' ? JSON.parse(status.letzterRun.details) : status.letzterRun.details; } catch { details = {}; }
                return (
                  <div>
                    {details.datenbanken && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 12, color: 'var(--text-3,#94a3b8)', marginBottom: 8 }}>Datenbanken:</div>
                        {details.datenbanken.map((d, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,.05)', fontSize: 13 }}>
                            <span>{d.status === 'ok' ? '✓' : '✗'}</span>
                            <span style={{ color: 'var(--text-2,#cbd5e1)' }}>{d.name}</span>
                            {d.groesse && <span style={{ color: 'var(--text-3,#94a3b8)', marginLeft: 'auto' }}>{(d.groesse / 1024 / 1024).toFixed(1)} MB</span>}
                            {d.hochgeladen !== undefined && <span style={{ color: d.hochgeladen ? '#22c55e' : '#f87171' }}>{d.hochgeladen ? '↑ hochgeladen' : '↑ Fehler'}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {details.log && (
                      <pre style={{ margin: 0, fontSize: 11, color: 'var(--text-3,#94a3b8)', background: 'var(--bg-1,#13161e)', padding: 10, borderRadius: 6, overflow: 'auto', maxHeight: 200, whiteSpace: 'pre-wrap' }}>
                        {details.log}
                      </pre>
                    )}
                  </div>
                );
              })()}
            </SectionCard>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={load} style={btnSecondary}>🔄 Aktualisieren</button>
            <button onClick={startBackup} disabled={!!runningId} style={{ ...btnPrimary, background: 'linear-gradient(135deg,#059669,#10b981)', opacity: runningId ? 0.5 : 1 }}>
              {runningId ? '⟳ Läuft...' : '▶ Backup starten'}
            </button>
          </div>
        </div>
      )}

      {/* ── Verlauf ── */}
      {activeSection === 'verlauf' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={loadHistory} style={btnSecondary}>🔄 Aktualisieren</button>
          </div>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3,#94a3b8)', fontSize: 14 }}>Noch keine Backups durchgeführt</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border,rgba(255,255,255,.08))' }}>
                    {['#', 'Gestartet', 'Beendet', 'Typ', 'Status', 'Größe', 'Fehler'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-3,#94a3b8)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 500 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(run => (
                    <tr key={run.id} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                      <td style={{ padding: '9px 12px', color: 'var(--text-3,#6b7280)' }}>#{run.id}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-2,#cbd5e1)' }}>{new Date(run.gestartet_am).toLocaleString('de-DE')}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-3,#94a3b8)' }}>{run.beendet_am ? new Date(run.beendet_am).toLocaleString('de-DE') : '–'}</td>
                      <td style={{ padding: '9px 12px' }}>
                        <span style={{ fontSize: 11, background: 'var(--bg-3,#2a2f45)', padding: '2px 7px', borderRadius: 4, color: 'var(--text-3,#94a3b8)' }}>{run.typ}</span>
                      </td>
                      <td style={{ padding: '9px 12px' }}><StatusBadge status={run.status} /></td>
                      <td style={{ padding: '9px 12px', color: 'var(--text-3,#94a3b8)' }}>
                        {run.groesse_bytes > 0 ? (run.groesse_bytes / 1024 / 1024).toFixed(1) + ' MB' : '–'}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#f87171', fontSize: 11, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {run.fehler_text || '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
