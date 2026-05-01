import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import '../styles/AppsMonitor.css';

const ROLES = [
  { value: 'eingeschraenkt', label: 'Eingeschränkt' },
  { value: 'trainer',        label: 'Trainer' },
  { value: 'mitarbeiter',    label: 'Mitarbeiter' },
  { value: 'admin',          label: 'Admin' },
];

// ── Vollbild-Modal für App-Zugriff & Passwörter ──────────────────────────────
function TodoAccessModal({ onClose }) {
  const [users, setUsers]         = useState([]);
  const [dojos, setDojos]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [search, setSearch]       = useState('');
  const [pwUser, setPwUser]       = useState(null);
  const [pw, setPw]               = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [pwSaving, setPwSaving]   = useState(false);
  const [pwMsg, setPwMsg]         = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add-user form state
  const [newUser, setNewUser] = useState({ vorname: '', nachname: '', username: '', email: '', password: '', rolle: 'trainer', dojo_id: '' });
  const [addMsg, setAddMsg]   = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      axios.get('/admin/todo-access'),
      axios.get('/admin/todo-dojos'),
    ]).then(([uRes, dRes]) => {
      setUsers(uRes.data.users || []);
      setDojos(dRes.data.dojos || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (user) => {
    const newVal = !user.todo_app_access;
    setSaving(user.id);
    try {
      await axios.patch(`/admin/todo-access/${user.id}`, { access: newVal });
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, todo_app_access: newVal ? 1 : 0 } : u));
    } catch {}
    finally { setSaving(null); }
  };

  const deleteUser = async (user) => {
    setDeleting(user.id);
    try {
      await axios.delete(`/admin/todo-access/${user.id}`);
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch {}
    finally { setDeleting(null); setConfirmDel(null); }
  };

  const openPw = (user) => { setPwUser(user); setPw(''); setPwMsg(''); setShowPw(false); };
  const closePw = () => { setPwUser(null); setPw(''); setPwMsg(''); };

  const savePw = async () => {
    if (!pw || pw.length < 6) { setPwMsg('Mindestens 6 Zeichen.'); return; }
    setPwSaving(true); setPwMsg('');
    try {
      await axios.post(`/admins/password-management/software/${pwUser.id}/reset`, { newPassword: pw });
      setPwMsg('✓ Passwort gesetzt!');
      setTimeout(closePw, 1500);
    } catch (e) {
      setPwMsg(e.response?.data?.message || 'Fehler beim Speichern.');
    } finally { setPwSaving(false); }
  };

  const addUser = async () => {
    if (!newUser.vorname || !newUser.nachname || !newUser.username || !newUser.password) {
      setAddMsg('Vorname, Nachname, Benutzername und Passwort sind Pflicht.'); return;
    }
    setAddSaving(true); setAddMsg('');
    try {
      await axios.post('/admin/todo-access', newUser);
      setAddMsg('✓ Nutzer angelegt!');
      setNewUser({ vorname: '', nachname: '', username: '', email: '', password: '', rolle: 'trainer', dojo_id: '' });
      setTimeout(() => { setShowAddForm(false); setAddMsg(''); load(); }, 1200);
    } catch (e) {
      setAddMsg(e.response?.data?.error || 'Fehler beim Anlegen.');
    } finally { setAddSaving(false); }
  };

  const filtered = users.filter(u =>
    !search || `${u.vorname} ${u.nachname} ${u.email || ''} ${u.dojoname || ''} ${u.username || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const byDojo = filtered.reduce((acc, u) => {
    const key = u.dojoname || 'Ohne Dojo';
    if (!acc[key]) acc[key] = [];
    acc[key].push(u);
    return acc;
  }, {});

  const enabledCount  = users.filter(u => u.todo_app_access).length;
  const disabledCount = users.length - enabledCount;

  return createPortal(
    <div className="am-fullmodal-overlay" onClick={onClose}>
      <div className="am-fullmodal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="am-fullmodal-header">
          <div className="am-fullmodal-title">
            <span>🔐 Zugriff & Passwörter — TDA To Do</span>
            <div className="am-fullmodal-stats">
              <span className="am-access-pill am-access-pill--on">✓ {enabledCount} aktiv</span>
              {disabledCount > 0 && <span className="am-access-pill am-access-pill--off">✗ {disabledCount} gesperrt</span>}
              <span className="am-access-pill">{users.length} gesamt</span>
            </div>
          </div>
          <button className="am-fullmodal-close" onClick={onClose}>✕</button>
        </div>

        {/* Search + Actions */}
        <div className="am-fullmodal-search-wrap">
          <input
            className="am-access-search"
            type="text"
            placeholder="Name, E-Mail, Benutzername oder Dojo suchen…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <button className="am-add-user-btn" onClick={() => { setShowAddForm(s => !s); setAddMsg(''); }}>
            {showAddForm ? '✕ Schließen' : '➕ Benutzer hinzufügen'}
          </button>
          <button className="am-refresh-btn" onClick={load} style={{ flexShrink: 0 }}>↻</button>
        </div>

        {/* Add User Form */}
        {showAddForm && (
          <div className="am-add-form">
            <div className="am-add-form-title">Neuen Nutzer anlegen</div>
            <div className="am-add-form-grid">
              <input className="am-add-input" placeholder="Vorname *" value={newUser.vorname} onChange={e => setNewUser(p => ({...p, vorname: e.target.value}))} />
              <input className="am-add-input" placeholder="Nachname *" value={newUser.nachname} onChange={e => setNewUser(p => ({...p, nachname: e.target.value}))} />
              <input className="am-add-input" placeholder="Benutzername *" value={newUser.username} onChange={e => setNewUser(p => ({...p, username: e.target.value}))} autoCapitalize="none" />
              <input className="am-add-input" placeholder="E-Mail (optional)" type="email" value={newUser.email} onChange={e => setNewUser(p => ({...p, email: e.target.value}))} />
              <div className="am-add-pw-wrap">
                <input
                  className="am-add-input"
                  placeholder="Passwort * (min. 6 Zeichen)"
                  type={showNewPw ? 'text' : 'password'}
                  value={newUser.password}
                  onChange={e => setNewUser(p => ({...p, password: e.target.value}))}
                />
                <button className="am-pw-eye am-pw-eye--add" onClick={() => setShowNewPw(s => !s)}>{showNewPw ? '🙈' : '👁'}</button>
              </div>
              <select className="am-add-input am-add-select" value={newUser.rolle} onChange={e => setNewUser(p => ({...p, rolle: e.target.value}))}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <select className="am-add-input am-add-select am-add-dojo" value={newUser.dojo_id} onChange={e => setNewUser(p => ({...p, dojo_id: e.target.value}))}>
                <option value="">Kein Dojo (Super Admin)</option>
                {dojos.map(d => <option key={d.id} value={d.id}>{d.dojoname}</option>)}
              </select>
            </div>
            {addMsg && (
              <div className={`am-pw-msg ${addMsg.startsWith('✓') ? 'am-pw-msg--ok' : 'am-pw-msg--err'}`}>{addMsg}</div>
            )}
            <div className="am-add-form-actions">
              <button className="am-pw-cancel" onClick={() => { setShowAddForm(false); setAddMsg(''); }}>Abbrechen</button>
              <button
                className="am-pw-save"
                onClick={addUser}
                disabled={addSaving || !newUser.vorname || !newUser.nachname || !newUser.username || newUser.password.length < 6}
              >
                {addSaving ? '…' : '✓ Anlegen'}
              </button>
            </div>
          </div>
        )}

        {/* User list */}
        <div className="am-fullmodal-body">
          {loading ? (
            <div className="am-access-loading">Lade Nutzer…</div>
          ) : filtered.length === 0 ? (
            <div className="am-access-loading">Keine Nutzer gefunden.</div>
          ) : (
            Object.entries(byDojo).map(([dojoName, dojoUsers]) => (
              <div key={dojoName} className="am-access-group">
                <div className="am-access-group-name">
                  {dojoName} <span className="am-access-group-count">{dojoUsers.length}</span>
                </div>
                {dojoUsers.map(u => (
                  <div key={u.id} className="am-access-row am-access-row--wide">
                    <div className="am-access-info">
                      <div className="am-access-name-row">
                        <span className="am-access-name">{u.vorname} {u.nachname}</span>
                        {u.username && <span className="am-access-username">@{u.username}</span>}
                        <span className="am-access-role">{u.rolle}</span>
                      </div>
                      {u.email && <div className="am-access-email">{u.email}</div>}
                    </div>
                    <div className="am-access-actions">
                      <button className="am-pw-btn" onClick={() => openPw(u)} title="Passwort setzen">🔑 Passwort</button>
                      <button
                        className={`am-access-toggle ${u.todo_app_access ? 'am-access-toggle--on' : 'am-access-toggle--off'}`}
                        onClick={() => toggle(u)}
                        disabled={saving === u.id}
                        title={u.todo_app_access ? 'Zugriff entziehen' : 'Zugriff gewähren'}
                      >
                        {saving === u.id ? '…' : u.todo_app_access ? '✓ Zugriff' : '✗ Gesperrt'}
                      </button>
                      <button className="am-delete-btn" onClick={() => setConfirmDel(u)} title="Nutzer deaktivieren" disabled={deleting === u.id}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Passwort-Modal */}
        {pwUser && (
          <div className="am-pw-overlay" onClick={closePw}>
            <div className="am-pw-modal" onClick={e => e.stopPropagation()}>
              <div className="am-pw-modal-title">
                🔑 Passwort setzen
                <span className="am-pw-modal-user">{pwUser.vorname} {pwUser.nachname}</span>
              </div>
              {pwUser.username && (
                <div className="am-pw-info">
                  Benutzername: <strong>@{pwUser.username}</strong>
                  {pwUser.email && <> · {pwUser.email}</>}
                </div>
              )}
              <div className="am-pw-input-wrap">
                <input
                  className="am-pw-input"
                  type={showPw ? 'text' : 'password'}
                  placeholder="Neues Passwort (min. 6 Zeichen)"
                  value={pw}
                  onChange={e => setPw(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && savePw()}
                  autoFocus
                />
                <button className="am-pw-eye" onClick={() => setShowPw(s => !s)}>{showPw ? '🙈' : '👁'}</button>
              </div>
              {pwMsg && (
                <div className={`am-pw-msg ${pwMsg.startsWith('✓') ? 'am-pw-msg--ok' : 'am-pw-msg--err'}`}>{pwMsg}</div>
              )}
              <div className="am-pw-modal-actions">
                <button className="am-pw-cancel" onClick={closePw}>Abbrechen</button>
                <button className="am-pw-save" onClick={savePw} disabled={pwSaving || pw.length < 6}>
                  {pwSaving ? '…' : 'Speichern'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Löschen-Bestätigung */}
        {confirmDel && (
          <div className="am-pw-overlay" onClick={() => setConfirmDel(null)}>
            <div className="am-pw-modal" onClick={e => e.stopPropagation()}>
              <div className="am-pw-modal-title">🗑 Nutzer deaktivieren?</div>
              <div className="am-pw-info">
                <strong>{confirmDel.vorname} {confirmDel.nachname}</strong> wird deaktiviert und kann sich nicht mehr einloggen.
              </div>
              <div className="am-pw-modal-actions">
                <button className="am-pw-cancel" onClick={() => setConfirmDel(null)}>Abbrechen</button>
                <button className="am-delete-confirm-btn" onClick={() => deleteUser(confirmDel)} disabled={deleting === confirmDel.id}>
                  {deleting === confirmDel.id ? '…' : 'Ja, deaktivieren'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── App Card ─────────────────────────────────────────────────────────────────

const CATEGORY_LABELS = {
  all: 'Alle', saas: 'SaaS', platform: 'Plattform', pwa: 'PWA', website: 'Website',
};

const SORT_OPTIONS = [
  { value: 'default',  label: 'Standard' },
  { value: 'name',     label: 'Name A–Z' },
  { value: 'online',   label: 'Online zuerst' },
  { value: 'offline',  label: 'Offline zuerst' },
  { value: 'response', label: 'Schnellste zuerst' },
];

function formatUptime(ms) {
  if (!ms) return '—';
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}
function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function AppCard({ app, onCopy }) {
  const [expanded, setExpanded]           = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const loading   = app.httpStatus === undefined;
  const statusCls = loading ? 'loading' : app.online ? 'online' : 'offline';
  const respMs    = app.responseMs;
  const respCls   = !respMs ? '' : respMs < 500 ? 'fast' : respMs < 1500 ? 'medium' : 'slow';

  return (
    <div className={`am-card am-card--${statusCls}`}>
      <div className={`am-stripe am-stripe--${statusCls}`} />

      <div className="am-card-body">
        <div className="am-card-head">
          <span className="am-icon">{app.icon}</span>
          <div className="am-card-title-group">
            <div className="am-name">{app.name}</div>
            <span className={`am-cat am-cat--${app.category}`}>{CATEGORY_LABELS[app.category] || app.category}</span>
          </div>
        </div>

        <div className="am-short">{app.short}</div>

        <div className="am-status-row">
          <span className={`am-badge am-badge--${statusCls}`}>
            <span className={`am-dot am-dot--${statusCls}`} />
            {loading ? '…' : app.online ? `${app.httpStatus}` : `Offline${app.httpStatus ? ` · ${app.httpStatus}` : ''}`}
          </span>
          {!loading && respMs && (
            <span className={`am-resp am-resp--${respCls}`}>{respMs}ms</span>
          )}
          {app.pm2 && (
            <span className={`am-pm2-pill am-pm2-pill--${app.pm2.status === 'online' ? 'on' : 'off'}`}>
              PM2 {app.pm2.status === 'online' ? `↑ ${formatUptime(app.pm2.uptime)}` : app.pm2.status}
            </span>
          )}
        </div>

        <button className="am-expand-btn" onClick={() => setExpanded(e => !e)}>
          {expanded ? '▲ Weniger' : '▼ Details'}
        </button>

        {expanded && (
          <div className="am-details">
            <a href={app.url} target="_blank" rel="noopener noreferrer" className="am-url">{app.url}</a>

            <div className="am-info-grid">
              {app.tech && (
                <div className="am-info-row">
                  <span className="am-lbl">Tech</span>
                  <span>{app.tech.frontend}{app.tech.backend && app.tech.backend !== '—' ? ` · ${app.tech.backend}` : ''}{app.tech.db ? ` · ${app.tech.db}` : ''}</span>
                </div>
              )}
              {app.port    && <div className="am-info-row"><span className="am-lbl">Port</span><code>{app.port}</code></div>}
              {app.pm2Name && <div className="am-info-row"><span className="am-lbl">PM2</span><code>{app.pm2Name}</code></div>}
              {app.deploy  && <div className="am-info-row"><span className="am-lbl">Deploy</span><code>{app.deploy}</code></div>}
              {app.pm2 && (
                <div className="am-info-row">
                  <span className="am-lbl">Stats</span>
                  <span>↻ {app.pm2.restarts ?? '—'} · RAM {formatBytes(app.pm2.memory)}</span>
                </div>
              )}
            </div>

            {app.notes && <div className="am-notes">{app.notes}</div>}

            <div className="am-actions">
              <a href={app.url} target="_blank" rel="noopener noreferrer" className="am-btn am-btn--primary">↗ Öffnen</a>
              {app.adminUrl && app.adminUrl !== app.url && (
                <a href={app.adminUrl} target="_blank" rel="noopener noreferrer" className="am-btn">⚙ Admin</a>
              )}
              <button className="am-btn" onClick={() => onCopy(app.url)}>📋 URL</button>
              {app.localPath && (
                <button className="am-btn" onClick={() => onCopy(`cd ${app.localPath}`)}>📁 Pfad</button>
              )}
              {app.hasAccessManagement && (
                <button className="am-btn am-btn--access" onClick={() => setShowAccessModal(true)}>
                  🔐 Zugriff verwalten
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {showAccessModal && <TodoAccessModal onClose={() => setShowAccessModal(false)} />}
    </div>
  );
}

// ── Main AppsMonitor ──────────────────────────────────────────────────────────

export default function AppsMonitor() {
  const [apps, setApps]                   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [lastUpdate, setLastUpdate]       = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy]               = useState('default');
  const [copyFlash, setCopyFlash]         = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/admin/apps');
      if (res.data?.success) {
        setApps(res.data.apps);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error('AppsMonitor:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text);
    setCopyFlash(text.length > 40 ? text.slice(0, 37) + '…' : text);
    setTimeout(() => setCopyFlash(null), 2000);
  };

  const onlineCount  = apps.filter(a => a.online).length;
  const offlineCount = apps.filter(a => a.httpStatus !== undefined && !a.online).length;
  const pm2Count     = apps.filter(a => a.pm2?.status === 'online').length;
  const categories   = ['all', ...new Set(apps.map(a => a.category))];

  const sortApps = (list) => {
    if (sortBy === 'name')     return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'online')   return [...list].sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));
    if (sortBy === 'offline')  return [...list].sort((a, b) => (a.online ? 1 : 0) - (b.online ? 1 : 0));
    if (sortBy === 'response') return [...list].sort((a, b) => (a.responseMs || 9999) - (b.responseMs || 9999));
    return list;
  };

  const filtered = sortApps(activeCategory === 'all' ? apps : apps.filter(a => a.category === activeCategory));

  return (
    <div className="am-root">
      {/* Toolbar */}
      <div className="am-toolbar">
        <div className="am-cats">
          {!loading && categories.map(cat => (
            <button
              key={cat}
              className={`am-cat-btn${activeCategory === cat ? ' active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_LABELS[cat] || cat}
              {cat !== 'all' && <span className="am-cat-count">{apps.filter(a => a.category === cat).length}</span>}
            </button>
          ))}
        </div>
        <div className="am-toolbar-right">
          <select
            className="am-sort-select"
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
          >
            {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {lastUpdate && (
            <span className="am-updated">{lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          )}
          <button className="am-refresh-btn" onClick={load} disabled={loading}>
            {loading ? '…' : '↻'} Aktualisieren
          </button>
        </div>
      </div>

      {/* Summary pills */}
      {!loading && apps.length > 0 && (
        <div className="am-summary">
          <span className="am-pill">{apps.length} Gesamt</span>
          <span className="am-pill am-pill--green">{onlineCount} Online</span>
          {offlineCount > 0 && <span className="am-pill am-pill--red">{offlineCount} Offline</span>}
          <span className="am-pill am-pill--gold">{pm2Count} PM2 aktiv</span>
        </div>
      )}

      {loading && (
        <div className="am-loading">
          <div className="am-spinner" />
          Pinge alle Dienste…
        </div>
      )}

      {!loading && (
        <div className="am-grid">
          {filtered.map(app => (
            <AppCard key={app.id} app={app} onCopy={handleCopy} />
          ))}
        </div>
      )}

      {copyFlash && <div className="am-copy-flash">✓ {copyFlash}</div>}
    </div>
  );
}
