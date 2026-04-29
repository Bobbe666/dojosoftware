import React, { useState, useEffect, useCallback } from 'react';
import { Key, Search, RefreshCw, Eye, EyeOff, CheckCircle, AlertCircle, Users, Building2,
  Shield, UserPlus, Zap, RotateCcw, Clock, LockOpen, Lock, User, Save, AlertTriangle } from 'lucide-react';
import config from '../config/config.js';
import { getAuthToken } from '../utils/fetchWithAuth';
import { useDojoContext } from '../context/DojoContext';
import '../styles/PasswortVerwaltung.css';

// ── Auth-Header ────────────────────────────────────────────────────
const authHeaders = () => ({
  'Authorization': `Bearer ${getAuthToken()}`,
  'Content-Type': 'application/json'
});

const PasswortVerwaltung = ({ dojoOnly = false }) => {
  const { activeDojo } = useDojoContext();
  const activeDojoId = activeDojo && activeDojo !== 'super-admin' && activeDojo !== 'verband' && activeDojo !== 'shop'
    ? activeDojo.id : null;

  const [activeTab, setActiveTab] = useState(dojoOnly ? 'dojo' : 'software');
  const [users, setUsers] = useState([]);
  const [membersWithoutLogin, setMembersWithoutLogin] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bulkCreating, setBulkCreating] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [showWithoutLogin, setShowWithoutLogin] = useState(false);

  // Eigenes Profil
  const [ownProfile, setOwnProfile] = useState(null);
  const [profileEdit, setProfileEdit] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: '', vorname: '', nachname: '', email: '' });
  const [profileSaving, setProfileSaving] = useState(false);

  // Reset Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Create Account Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdUsername, setCreatedUsername] = useState('');

  const allTabs = [
    { id: 'software', label: 'Software-Konten', icon: Shield, description: 'Admin-Konten der DojoSoftware' },
    { id: 'verband', label: 'Verband', icon: Building2, description: 'TDA Verbandsmitglieder' },
    { id: 'dojo', label: 'Dojo-Mitglieder', icon: Users, description: 'Mitglieder mit Login' }
  ];
  const tabs = dojoOnly ? allTabs.filter(t => t.id === 'dojo') : allTabs;

  // ── Daten laden ──────────────────────────────────────────────────
  const loadUsers = useCallback(async () => {
    setLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const dojoParam = activeDojoId ? `?dojo_id=${activeDojoId}` : '';
      const r = await fetch(`${config.apiBaseUrl}/admins/password-management/${activeTab}${dojoParam}`, {
        headers: authHeaders()
      });
      if (!r.ok) throw new Error('Fehler beim Laden');
      const data = await r.json();
      setUsers(data.users || []);
    } catch {
      setMessage({ text: 'Fehler beim Laden der Benutzer', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeDojoId]);

  const loadMembersWithoutLogin = useCallback(async () => {
    try {
      const dojoParam = activeDojoId ? `?dojo_id=${activeDojoId}` : '';
      const r = await fetch(`${config.apiBaseUrl}/admins/password-management/dojo-ohne-login${dojoParam}`, {
        headers: authHeaders()
      });
      if (!r.ok) return;
      const data = await r.json();
      setMembersWithoutLogin(data.members || []);
    } catch { /* ignore */ }
  }, [activeDojoId]);

  const loadOwnProfile = useCallback(async () => {
    try {
      const r = await fetch(`${config.apiBaseUrl}/admins/password-management/me`, { headers: authHeaders() });
      if (!r.ok) return;
      const data = await r.json();
      setOwnProfile(data.user);
      setProfileForm({
        username: data.user.username || '',
        vorname: data.user.vorname || '',
        nachname: data.user.nachname || '',
        email: data.user.email || ''
      });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadUsers();
    if (activeTab === 'dojo') loadMembersWithoutLogin();
    if (activeTab === 'software') loadOwnProfile();
    setSearchTerm('');
    setShowWithoutLogin(false);
  }, [activeTab, activeDojoId]);

  // ── Profil speichern ─────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!profileForm.username || profileForm.username.length < 3) {
      setMessage({ text: 'Benutzername muss mindestens 3 Zeichen haben', type: 'error' });
      return;
    }
    setProfileSaving(true);
    try {
      const r = await fetch(`${config.apiBaseUrl}/admins/password-management/me`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify(profileForm)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Fehler');
      setMessage({ text: 'Profil gespeichert — bitte neu laden (F5) damit der Name in der Navigation aktualisiert wird', type: 'success' });
      setProfileEdit(false);
      loadOwnProfile();
      loadUsers();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Entsperren ───────────────────────────────────────────────────
  const handleUnlock = async (user) => {
    try {
      const r = await fetch(`${config.apiBaseUrl}/admins/password-management/software/${user.id}/unlock`, {
        method: 'POST', headers: authHeaders()
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Fehler');
      setMessage({ text: `Konto "${user.username}" entsperrt`, type: 'success' });
      loadUsers();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    }
  };

  // ── Bulk Create ──────────────────────────────────────────────────
  const handleBulkCreate = async () => {
    if (!window.confirm(`Für alle ${membersWithoutLogin.length} Mitglieder ohne Login automatisch Zugangsdaten anlegen?\n\nBenutzername: vorname.nachname\nPasswort: Geburtsdatum (dd/mm/yyyy)`)) return;
    setBulkCreating(true);
    try {
      const r = await fetch(`${config.apiBaseUrl}/admins/password-management/dojo/bulk-create`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify(activeDojoId ? { dojo_id: activeDojoId } : {})
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Fehler');
      setMessage({ text: `✓ ${data.created} Accounts automatisch angelegt`, type: 'success' });
      loadUsers(); loadMembersWithoutLogin();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setBulkCreating(false);
    }
  };

  const handleResetClick = (user) => {
    setSelectedUser(user); setNewPassword(''); setShowPassword(false); setShowResetModal(true);
  };
  const handleCreateClick = (member) => {
    setSelectedMember(member); setCreatePassword(''); setShowCreatePassword(false);
    setCreatedUsername(''); setShowCreateModal(true);
  };

  const generatePassword = (setter, showSetter) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let pw = '';
    for (let i = 0; i < 14; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
    setter(pw); showSetter(true);
  };

  // ── Passwort-Stärke ──────────────────────────────────────────────
  const getPasswordStrength = (pw) => {
    if (!pw) return { level: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 1) return { level: score, label: 'Sehr schwach', color: '#ef4444' };
    if (score === 2) return { level: score, label: 'Schwach', color: '#f97316' };
    if (score === 3) return { level: score, label: 'Mittel', color: '#f59e0b' };
    if (score === 4) return { level: score, label: 'Stark', color: '#22c55e' };
    return { level: score, label: 'Sehr stark', color: '#10b981' };
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setMessage({ text: 'Passwort muss mindestens 8 Zeichen haben', type: 'error' });
      return;
    }
    setResetting(true);
    try {
      const endpoint = activeTab === 'dojo'
        ? `${config.apiBaseUrl}/admins/password-management/dojo/${selectedUser.id}/reset`
        : activeTab === 'verband'
          ? `${config.apiBaseUrl}/admins/password-management/verband/${selectedUser.id}/reset`
          : `${config.apiBaseUrl}/admins/password-management/software/${selectedUser.id}/reset`;
      const r = await fetch(endpoint, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ newPassword })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Fehler');
      setMessage({ text: `Passwort für "${getUserDisplayName(selectedUser)}" zurückgesetzt`, type: 'success' });
      setShowResetModal(false); loadUsers();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setResetting(false);
    }
  };

  const handleResetToDefault = async () => {
    setResetting(true);
    try {
      const r = await fetch(
        `${config.apiBaseUrl}/admins/password-management/dojo/${selectedUser.id}/reset-to-default`,
        { method: 'POST', headers: authHeaders() }
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Fehler');
      setMessage({ text: `Passwort auf Standard (${data.defaultPassword}) zurückgesetzt`, type: 'success' });
      setShowResetModal(false);
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setResetting(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!createPassword || createPassword.length < 8) {
      setMessage({ text: 'Passwort muss mindestens 8 Zeichen haben', type: 'error' });
      return;
    }
    setCreating(true);
    try {
      const r = await fetch(`${config.apiBaseUrl}/admins/password-management/dojo/create`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({ mitglied_id: selectedMember.mitglied_id, password: createPassword })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Fehler');
      setCreatedUsername(data.username);
      setMessage({ text: `Account für "${selectedMember.vorname} ${selectedMember.nachname}" erstellt`, type: 'success' });
      loadUsers(); loadMembersWithoutLogin();
    } catch (err) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

  const formatLastLogin = (dateStr) => {
    if (!dateStr) return <span className="pv-date-never">Nie</span>;
    const d = new Date(dateStr);
    const diffDays = Math.floor((new Date() - d) / 86400000);
    let label, color;
    if (diffDays === 0) { label = 'Heute'; color = '#22c55e'; }
    else if (diffDays <= 7) { label = `vor ${diffDays}T`; color = '#86efac'; }
    else if (diffDays <= 30) { label = `vor ${diffDays}T`; color = '#f59e0b'; }
    else { label = formatDate(dateStr); color = '#ef4444'; }
    return <span className="pv-last-login" style={{ '--date-color': color }}>{label}</span>;
  };

  const getUserDisplayName = (user) => {
    if (!user) return '—';
    if (activeTab === 'verband') return user.benutzername || user.name || '—';
    return user.username || '—';
  };

  const getAlgoBadge = (algo) => {
    if (!algo) return null;
    const isModern = algo === 'argon2id';
    return (
      <span className={`badge badge-algo badge-algo-${isModern ? 'modern' : 'legacy'}`} title={isModern ? 'Aktuell (Argon2id)' : 'Veraltet — wird bei nächstem Login automatisch migriert'}>
        {isModern ? '🔒 argon2' : '⚠️ bcrypt'}
      </span>
    );
  };

  // ── Stats ─────────────────────────────────────────────────────────
  const getStats = () => {
    if (activeTab === 'dojo') {
      const total = users.length, ohneLogin = membersWithoutLogin.length;
      const nochNie = users.filter(u => !u.last_login_at).length;
      const loginQuote = total > 0 ? Math.round((total / (total + ohneLogin)) * 100) : 0;
      return { type: 'dojo', total, ohneLogin, nochNie, loginQuote };
    }
    if (activeTab === 'software') {
      const total = users.length;
      const gesperrt = users.filter(u => u.is_locked).length;
      const bcryptCount = users.filter(u => u.password_algorithm && u.password_algorithm !== 'argon2id').length;
      const rollen = {};
      users.forEach(u => { const r = u.rolle || 'unbekannt'; rollen[r] = (rollen[r] || 0) + 1; });
      return { type: 'software', total, gesperrt, bcryptCount, rollen };
    }
    if (activeTab === 'verband') {
      const total = users.length;
      const ohnePasswort = users.filter(u => !u.has_password).length;
      const aktiv = users.filter(u => (u.status || '').toLowerCase() === 'aktiv').length;
      return { type: 'verband', total, ohnePasswort, aktiv, inaktiv: total - aktiv };
    }
    return {};
  };
  const stats = getStats();

  const filteredUsers = users.filter(user => {
    const s = searchTerm.toLowerCase();
    if (!s) return true;
    if (activeTab === 'software') {
      return ['username','email','vorname','nachname','rolle'].some(k => (user[k]||'').toLowerCase().includes(s));
    }
    if (activeTab === 'verband') {
      return ['benutzername','email','name','typ'].some(k => (user[k]||'').toLowerCase().includes(s));
    }
    return ['username','email','vorname','nachname','dojo_name'].some(k => (user[k]||'').toLowerCase().includes(s));
  });

  const filteredMembersWithoutLogin = membersWithoutLogin.filter(m => {
    const s = searchTerm.toLowerCase();
    if (!s) return true;
    return ['vorname','nachname','email'].some(k => (m[k]||'').toLowerCase().includes(s));
  });

  const pwStrength = getPasswordStrength(newPassword || createPassword);

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <div className="passwort-verwaltung">
      <div className="page-header">
        <h1><Key size={28} /> Passwort-Verwaltung</h1>
        <p>Zugangsdaten und Kontosicherheit verwalten</p>
      </div>

      {message.text && (
        <div className={`message ${message.type}`} onClick={() => setMessage({ text: '', type: '' })}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {message.text}
          <span className="message-close">×</span>
        </div>
      )}

      {/* ── Eigenes Profil (nur Software-Tab) ── */}
      {activeTab === 'software' && ownProfile && (
        <div className="pv-own-profile">
          <div className="pv-own-header">
            <div className="pv-own-avatar">
              {(ownProfile.vorname?.[0] || ownProfile.username?.[0] || '?').toUpperCase()}
            </div>
            <div className="pv-own-info">
              <div className="pv-own-name">
                {ownProfile.vorname || ownProfile.nachname
                  ? `${ownProfile.vorname || ''} ${ownProfile.nachname || ''}`.trim()
                  : ownProfile.username}
                <span className={`badge badge-rolle badge-rolle-${(ownProfile.rolle||'').replace('_','-')}`}>
                  {ownProfile.rolle}
                </span>
              </div>
              <div className="pv-own-meta">
                @{ownProfile.username}
                {ownProfile.email && <span> · {ownProfile.email}</span>}
                {ownProfile.last_login && <span> · Letzter Login: {formatLastLogin(ownProfile.last_login)}</span>}
              </div>
            </div>
            <button className="btn-edit-profile" onClick={() => setProfileEdit(!profileEdit)}>
              <User size={15} /> {profileEdit ? 'Abbrechen' : 'Profil bearbeiten'}
            </button>
          </div>

          {profileEdit && (
            <div className="pv-profile-form">
              <div className="pv-form-grid">
                <div className="pv-form-group">
                  <label>Benutzername *</label>
                  <input value={profileForm.username} onChange={e => setProfileForm(p => ({ ...p, username: e.target.value }))} />
                </div>
                <div className="pv-form-group">
                  <label>E-Mail</label>
                  <input type="email" value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="pv-form-group">
                  <label>Vorname</label>
                  <input value={profileForm.vorname} onChange={e => setProfileForm(p => ({ ...p, vorname: e.target.value }))} />
                </div>
                <div className="pv-form-group">
                  <label>Nachname</label>
                  <input value={profileForm.nachname} onChange={e => setProfileForm(p => ({ ...p, nachname: e.target.value }))} />
                </div>
              </div>
              <div className="pv-form-note">
                <AlertTriangle size={14} /> Benutzernamen-Änderung wirkt sich sofort auf alle Logins aus.
              </div>
              <button className="btn-save-profile" onClick={handleSaveProfile} disabled={profileSaving}>
                <Save size={15} /> {profileSaving ? 'Speichern...' : 'Profil speichern'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        {tabs.map(tab => (
          <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={20} />
            <span className="tab-label">{tab.label}</span>
            {activeTab === tab.id && <span className="tab-count">{users.length}</span>}
          </button>
        ))}
      </div>

      {/* Stats */}
      {!loading && users.length > 0 && (
        <div className="pw-stats-bar">
          {activeTab === 'dojo' && (<>
            <div className="pw-stat"><span className="pw-stat-value">{stats.total}</span><span className="pw-stat-label">Accounts</span></div>
            <div className="pw-stat pw-stat-warn"><span className="pw-stat-value">{stats.ohneLogin}</span><span className="pw-stat-label">Ohne Login</span></div>
            <div className="pw-stat pw-stat-info" title="Login-Tracking aktiv seit 03.03.2026"><span className="pw-stat-value">{stats.nochNie}</span><span className="pw-stat-label">Kein Login erfasst*</span></div>
            <div className="pw-stat pw-stat-success"><span className="pw-stat-value">{stats.loginQuote}%</span><span className="pw-stat-label">Login-Quote</span></div>
            <span className="pv-tracking-note">* Tracking seit 03.03.2026</span>
            {stats.ohneLogin > 0 && (
              <button className="btn-bulk-create" onClick={handleBulkCreate} disabled={bulkCreating}>
                {bulkCreating ? <RefreshCw size={16} className="spinning" /> : <Zap size={16} />}
                {bulkCreating ? 'Wird erstellt...' : `Alle ${stats.ohneLogin} anlegen`}
              </button>
            )}
          </>)}
          {activeTab === 'software' && (<>
            <div className="pw-stat"><span className="pw-stat-value">{stats.total}</span><span className="pw-stat-label">Konten</span></div>
            {stats.gesperrt > 0 && <div className="pw-stat pw-stat-error"><span className="pw-stat-value">{stats.gesperrt}</span><span className="pw-stat-label">Gesperrt</span></div>}
            {stats.bcryptCount > 0 && <div className="pw-stat pw-stat-warn" title="Werden bei nächstem Login automatisch auf Argon2id migriert"><span className="pw-stat-value">{stats.bcryptCount}</span><span className="pw-stat-label">⚠️ Altes bcrypt</span></div>}
            {stats.rollen && Object.entries(stats.rollen).map(([rolle, count]) => (
              <div className="pw-stat pw-stat-role" key={rolle}><span className="pw-stat-value">{count}</span><span className="pw-stat-label">{rolle}</span></div>
            ))}
          </>)}
          {activeTab === 'verband' && (<>
            <div className="pw-stat"><span className="pw-stat-value">{stats.total}</span><span className="pw-stat-label">Gesamt</span></div>
            <div className="pw-stat pw-stat-success"><span className="pw-stat-value">{stats.aktiv}</span><span className="pw-stat-label">Aktiv</span></div>
            {stats.inaktiv > 0 && <div className="pw-stat pw-stat-warn"><span className="pw-stat-value">{stats.inaktiv}</span><span className="pw-stat-label">Inaktiv</span></div>}
            {stats.ohnePasswort > 0 && <div className="pw-stat pw-stat-info"><span className="pw-stat-value">{stats.ohnePasswort}</span><span className="pw-stat-label">Ohne PW</span></div>}
          </>)}
        </div>
      )}

      {/* Tab Description + Toggle */}
      <div className="tab-description">
        {tabs.find(t => t.id === activeTab)?.description}
        {activeTab === 'dojo' && membersWithoutLogin.length > 0 && (
          <button className={`toggle-without-login ${showWithoutLogin ? 'active' : ''}`}
            onClick={() => setShowWithoutLogin(!showWithoutLogin)}>
            <UserPlus size={16} /> {membersWithoutLogin.length} Mitglieder ohne Login
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <Search size={20} />
          <input type="text" placeholder="Suchen..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <button className="btn-refresh" onClick={loadUsers} disabled={loading}>
          <RefreshCw size={20} className={loading ? 'spinning' : ''} /> Aktualisieren
        </button>
      </div>

      {/* Mitglieder ohne Login */}
      {activeTab === 'dojo' && showWithoutLogin && filteredMembersWithoutLogin.length > 0 && (
        <div className="without-login-section">
          <h3><UserPlus size={20} /> Mitglieder ohne Login-Account</h3>
          <table className="users-table">
            <thead><tr><th>Name</th><th>E-Mail</th><th>Dojo</th><th>Passwort</th><th>Aktion</th></tr></thead>
            <tbody>
              {filteredMembersWithoutLogin.map(m => (
                <tr key={m.mitglied_id}>
                  <td className="user-name"><strong>{m.vorname} {m.nachname}</strong></td>
                  <td>{m.email || '—'}</td>
                  <td>{m.dojo_name || '—'}</td>
                  <td><span className="badge badge-warning">Nein</span></td>
                  <td><button className="btn-create" onClick={() => handleCreateClick(m)}><UserPlus size={15} /> Erstellen</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Haupt-Tabelle */}
      <div className="users-table-container">
        {loading ? (
          <div className="loading-state"><RefreshCw size={32} className="spinning" /><p>Lade...</p></div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state"><Users size={48} /><p>{searchTerm ? 'Keine Treffer' : 'Keine Benutzer'}</p></div>
        ) : (
          <table className="users-table">
            <thead>
              {activeTab === 'software' ? (
                <tr><th>Benutzer</th><th>Name</th><th>E-Mail</th><th>Rolle</th><th><Clock size={14}/> Letzter Login</th><th>Sicherheit</th><th>Status</th><th>Aktion</th></tr>
              ) : activeTab === 'verband' ? (
                <tr><th>Benutzername</th><th>Name</th><th>E-Mail</th><th>Typ</th><th>Status</th><th>Passwort</th><th>Aktion</th></tr>
              ) : (
                <tr><th>Benutzer</th><th>E-Mail</th><th>Dojo</th><th><Clock size={14}/> Letzter Login</th><th>Passwort</th><th>Aktion</th></tr>
              )}
            </thead>
            <tbody>
              {filteredUsers.map(user => {
                if (activeTab === 'software') {
                  const isLocked = user.is_locked;
                  return (
                    <tr key={user.id} className={isLocked ? 'row-locked' : ''}>
                      <td className="user-name">
                        <strong>{user.username || '—'}</strong>
                        {isLocked && <span className="lock-badge" title={`Gesperrt bis ${formatDate(user.locked_until)} (${user.failed_login_attempts} Fehlversuche)`}><Lock size={13} /></span>}
                      </td>
                      <td>{user.vorname || ''} {user.nachname || ''}</td>
                      <td>{user.email || '—'}</td>
                      <td><span className={`badge badge-rolle badge-rolle-${(user.rolle||'').replace('_','-')}`}>{user.rolle||'—'}</span></td>
                      <td>{formatLastLogin(user.last_login)}</td>
                      <td>
                        {getAlgoBadge(user.password_algorithm)}
                        {user.failed_login_attempts > 0 && !isLocked && (
                          <span className="pv-attempts" title="Fehlgeschlagene Loginversuche">⚠️ {user.failed_login_attempts}x</span>
                        )}
                      </td>
                      <td><span className={`badge badge-${user.aktiv ? 'success' : 'warning'}`}>{user.aktiv ? 'Aktiv' : 'Inaktiv'}</span></td>
                      <td className="actions-cell">
                        {isLocked && (
                          <button className="btn-unlock" onClick={() => handleUnlock(user)} title="Konto entsperren">
                            <LockOpen size={14} /> Entsperren
                          </button>
                        )}
                        <button className="btn-reset" onClick={() => handleResetClick(user)}>
                          <Key size={14} /> PW setzen
                        </button>
                      </td>
                    </tr>
                  );
                }
                if (activeTab === 'verband') {
                  return (
                    <tr key={user.id}>
                      <td className="user-name"><strong>{user.benutzername || '—'}</strong></td>
                      <td>{user.name || '—'}</td>
                      <td>{user.email || '—'}</td>
                      <td>{user.typ || '—'}</td>
                      <td><span className={`badge badge-${(user.status||'').toLowerCase() === 'aktiv' ? 'success' : 'warning'}`}>{user.status||'—'}</span></td>
                      <td><span className={`badge badge-${user.has_password ? 'success' : 'warning'}`}>{user.has_password ? 'Ja' : 'Nein'}</span></td>
                      <td><button className="btn-reset" onClick={() => handleResetClick(user)}><Key size={14} /> PW setzen</button></td>
                    </tr>
                  );
                }
                return (
                  <tr key={user.id}>
                    <td className="user-name">
                      <strong>{user.username || '—'}</strong>
                      {user.vorname && <span className="user-realname">{user.vorname} {user.nachname}</span>}
                    </td>
                    <td>{user.email || '—'}</td>
                    <td>{user.dojo_name || '—'}</td>
                    <td>{formatLastLogin(user.last_login_at)}</td>
                    <td><span className={`badge badge-${user.has_password ? 'success' : 'warning'}`}>{user.has_password ? 'Ja' : 'Nein'}</span></td>
                    <td>
                      <button className="btn-reset" onClick={() => handleResetClick(user)}><Key size={14} /> PW setzen</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Reset Modal ── */}
      {showResetModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Key size={24} /> Passwort zurücksetzen</h2>
              <button className="modal-close" onClick={() => setShowResetModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="reset-info">
                Benutzer: <strong>{getUserDisplayName(selectedUser)}</strong>
                {selectedUser.vorname && <> ({selectedUser.vorname} {selectedUser.nachname})</>}
              </p>
              {selectedUser.email && <p className="reset-email">E-Mail: {selectedUser.email}</p>}
              {activeTab === 'dojo' && selectedUser.geburtsdatum && (
                <button className="btn-reset-default" onClick={handleResetToDefault} disabled={resetting}>
                  <RotateCcw size={16} /> Auf Standard zurücksetzen (Geburtsdatum)
                </button>
              )}
              <div className="password-input-group u-mt-1">
                <label>Neues Passwort <span className="pv-min-hint">(min. 8 Zeichen)</span></label>
                <div className="password-input-wrapper">
                  <input type={showPassword ? 'text' : 'password'} value={newPassword}
                    onChange={e => setNewPassword(e.target.value)} placeholder="Mindestens 8 Zeichen" />
                  <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                {newPassword && (
                  <div className="pw-strength-bar">
                    <div className="pw-strength-fill" style={{ width: `${(pwStrength.level/5)*100}%`, background: pwStrength.color }} />
                    <span style={{ color: pwStrength.color }}>{pwStrength.label}</span>
                  </div>
                )}
                <button type="button" className="btn-generate" onClick={() => generatePassword(setNewPassword, setShowPassword)}>
                  Sicheres Passwort generieren
                </button>
              </div>
              {newPassword && showPassword && (
                <div className="password-preview">
                  <code>{newPassword}</code>
                  <button onClick={() => navigator.clipboard.writeText(newPassword)}>Kopieren</button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowResetModal(false)}>Abbrechen</button>
              <button className="btn-confirm" onClick={handleResetPassword} disabled={resetting || !newPassword || newPassword.length < 8}>
                {resetting ? 'Wird gespeichert...' : 'Passwort setzen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Account Modal ── */}
      {showCreateModal && selectedMember && (
        <div className="modal-overlay" onClick={() => !createdUsername && setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><UserPlus size={24} /> Login-Account erstellen</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {!createdUsername ? (<>
                <p className="reset-info">Account für: <strong>{selectedMember.vorname} {selectedMember.nachname}</strong></p>
                {selectedMember.email && <p className="reset-email">E-Mail: {selectedMember.email}</p>}
                <div className="password-input-group">
                  <label>Passwort <span className="pv-min-hint">(min. 8 Zeichen)</span></label>
                  <div className="password-input-wrapper">
                    <input type={showCreatePassword ? 'text' : 'password'} value={createPassword}
                      onChange={e => setCreatePassword(e.target.value)} placeholder="Mindestens 8 Zeichen" />
                    <button type="button" className="toggle-password" onClick={() => setShowCreatePassword(!showCreatePassword)}>
                      {showCreatePassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {createPassword && (
                    <div className="pw-strength-bar">
                      <div className="pw-strength-fill" style={{ width: `${(pwStrength.level/5)*100}%`, background: pwStrength.color }} />
                      <span style={{ color: pwStrength.color }}>{pwStrength.label}</span>
                    </div>
                  )}
                  <button type="button" className="btn-generate" onClick={() => generatePassword(setCreatePassword, setShowCreatePassword)}>
                    Sicheres Passwort generieren
                  </button>
                </div>
                {createPassword && showCreatePassword && (
                  <div className="password-preview"><code>{createPassword}</code><button onClick={() => navigator.clipboard.writeText(createPassword)}>Kopieren</button></div>
                )}
              </>) : (
                <div className="account-created-success">
                  <CheckCircle size={48} className="success-icon" />
                  <h3>Account erfolgreich erstellt!</h3>
                  <div className="credentials-box">
                    <p><strong>Benutzername:</strong></p>
                    <code className="username-display">{createdUsername}</code>
                    <button className="btn-copy" onClick={() => navigator.clipboard.writeText(createdUsername)}>Kopieren</button>
                  </div>
                  <button className="btn-copy-all" onClick={() => navigator.clipboard.writeText(`Benutzername: ${createdUsername}\nPasswort: ${createPassword}`)}>
                    Alle Zugangsdaten kopieren
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {!createdUsername ? (<>
                <button className="btn-cancel" onClick={() => setShowCreateModal(false)}>Abbrechen</button>
                <button className="btn-confirm btn-create-account" onClick={handleCreateAccount} disabled={creating || !createPassword || createPassword.length < 8}>
                  {creating ? 'Wird erstellt...' : 'Account erstellen'}
                </button>
              </>) : (
                <button className="btn-confirm" onClick={() => setShowCreateModal(false)}>Schließen</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PasswortVerwaltung;
