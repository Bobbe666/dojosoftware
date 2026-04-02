import React, { useState, useEffect } from 'react';
import { Key, Search, RefreshCw, Eye, EyeOff, CheckCircle, AlertCircle, Users, Building2, Shield, UserPlus, Zap, RotateCcw, Clock } from 'lucide-react';
import config from '../config/config.js';
import { getAuthToken } from '../utils/fetchWithAuth';
import { useDojoContext } from '../context/DojoContext';
import '../styles/PasswortVerwaltung.css';

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

  // Password Reset Modal
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
    { id: 'software', label: 'Software', icon: Shield, description: 'Admin-Benutzer der DojoSoftware' },
    { id: 'verband', label: 'Verband', icon: Building2, description: 'TDA Verbandsmitglieder' },
    { id: 'dojo', label: 'Dojo', icon: Users, description: 'Dojo-Mitglieder mit Login' }
  ];

  const tabs = dojoOnly ? allTabs.filter(t => t.id === 'dojo') : allTabs;

  useEffect(() => {
    loadUsers();
    if (activeTab === 'dojo') loadMembersWithoutLogin();
    setSearchTerm('');
    setShowWithoutLogin(false);
  }, [activeTab, activeDojoId]);

  const loadUsers = async () => {
    setLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const dojoParam = activeDojoId ? `?dojo_id=${activeDojoId}` : '';
      const response = await fetch(`${config.apiBaseUrl}/admins/password-management/${activeTab}${dojoParam}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) throw new Error('Fehler beim Laden');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      setMessage({ text: 'Fehler beim Laden der Benutzer', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadMembersWithoutLogin = async () => {
    try {
      const dojoParam = activeDojoId ? `?dojo_id=${activeDojoId}` : '';
      const response = await fetch(`${config.apiBaseUrl}/admins/password-management/dojo-ohne-login${dojoParam}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) throw new Error('Fehler beim Laden');
      const data = await response.json();
      setMembersWithoutLogin(data.members || []);
    } catch (error) {
      console.error('Fehler beim Laden der Mitglieder ohne Login:', error);
    }
  };

  const handleBulkCreate = async () => {
    if (!window.confirm(`Für alle ${membersWithoutLogin.length} Mitglieder ohne Login automatisch Zugangsdaten anlegen?\n\nBenutzername: vorname.nachname\nPasswort: Geburtsdatum (dd/mm/yyyy)`)) return;
    setBulkCreating(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/admins/password-management/dojo/bulk-create`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(activeDojoId ? { dojo_id: activeDojoId } : {})
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler');
      setMessage({ text: `✓ ${data.created} Accounts automatisch angelegt`, type: 'success' });
      loadUsers();
      loadMembersWithoutLogin();
    } catch (error) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setBulkCreating(false);
    }
  };

  const handleResetClick = (user) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPassword(false);
    setShowResetModal(true);
  };

  const handleCreateClick = (member) => {
    setSelectedMember(member);
    setCreatePassword('');
    setShowCreatePassword(false);
    setCreatedUsername('');
    setShowCreateModal(true);
  };

  const generatePassword = (setter, showSetter) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let pw = '';
    for (let i = 0; i < 12; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
    setter(pw);
    showSetter(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setMessage({ text: 'Passwort muss mindestens 6 Zeichen haben', type: 'error' });
      return;
    }
    setResetting(true);
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/admins/password-management/${activeTab}/${selectedUser.id}/reset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
          body: JSON.stringify({ newPassword })
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler');
      setMessage({ text: `Passwort für "${getUserDisplayName(selectedUser)}" zurückgesetzt`, type: 'success' });
      setShowResetModal(false);
      loadUsers();
    } catch (error) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setResetting(false);
    }
  };

  const handleResetToDefault = async () => {
    setResetting(true);
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/admins/password-management/dojo/${selectedUser.id}/reset-to-default`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${getAuthToken()}` } }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler');
      setMessage({ text: `Passwort auf Standard (${data.defaultPassword}) zurückgesetzt`, type: 'success' });
      setShowResetModal(false);
    } catch (error) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setResetting(false);
    }
  };

  const handleCreateAccount = async () => {
    if (!createPassword || createPassword.length < 6) {
      setMessage({ text: 'Passwort muss mindestens 6 Zeichen haben', type: 'error' });
      return;
    }
    setCreating(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/admins/password-management/dojo/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
        body: JSON.stringify({ mitglied_id: selectedMember.mitglied_id, password: createPassword })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler');
      setCreatedUsername(data.username);
      setMessage({ text: `Account für "${selectedMember.vorname} ${selectedMember.nachname}" erstellt. Benutzername: ${data.username}`, type: 'success' });
      loadUsers();
      loadMembersWithoutLogin();
    } catch (error) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setCreating(false);
    }
  };

  // ── Hilfsfunktionen ──────────────────────────────────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatLastLogin = (dateStr) => {
    if (!dateStr) return <span className="pv-date-never">Nie</span>;
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
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

  // ── Stats ─────────────────────────────────────────────────────────
  const getStats = () => {
    if (activeTab === 'dojo') {
      const ohneLogin = membersWithoutLogin.length;
      const total = users.length;
      const nochNieEingeloggt = users.filter(u => !u.last_login_at).length;
      const loginQuote = total > 0 ? Math.round((total / (total + ohneLogin)) * 100) : 0;
      return { type: 'dojo', total, ohneLogin, nochNieEingeloggt, loginQuote };
    }
    if (activeTab === 'software') {
      const total = users.length;
      const ohnePasswort = users.filter(u => !u.has_password).length;
      const inaktiv = users.filter(u => !u.aktiv).length;
      const aktiv = total - inaktiv;
      const rollen = {};
      users.forEach(u => {
        const r = u.rolle || 'unbekannt';
        rollen[r] = (rollen[r] || 0) + 1;
      });
      return { type: 'software', total, ohnePasswort, aktiv, inaktiv, rollen };
    }
    if (activeTab === 'verband') {
      const total = users.length;
      const ohnePasswort = users.filter(u => !u.has_password).length;
      const aktiv = users.filter(u => (u.status || '').toLowerCase() === 'aktiv').length;
      const inaktiv = total - aktiv;
      return { type: 'verband', total, ohnePasswort, aktiv, inaktiv };
    }
    return {};
  };

  const stats = getStats();

  // ── Filter ────────────────────────────────────────────────────────
  const filteredUsers = users.filter(user => {
    const s = searchTerm.toLowerCase();
    if (!s) return true;
    if (activeTab === 'software') {
      return (user.username?.toLowerCase() || '').includes(s) ||
             (user.email?.toLowerCase() || '').includes(s) ||
             (user.vorname?.toLowerCase() || '').includes(s) ||
             (user.nachname?.toLowerCase() || '').includes(s) ||
             (user.rolle?.toLowerCase() || '').includes(s);
    }
    if (activeTab === 'verband') {
      return (user.benutzername?.toLowerCase() || '').includes(s) ||
             (user.email?.toLowerCase() || '').includes(s) ||
             (user.name?.toLowerCase() || '').includes(s) ||
             (user.typ?.toLowerCase() || '').includes(s);
    }
    // dojo
    return (user.username?.toLowerCase() || '').includes(s) ||
           (user.email?.toLowerCase() || '').includes(s) ||
           (user.vorname?.toLowerCase() || '').includes(s) ||
           (user.nachname?.toLowerCase() || '').includes(s) ||
           (user.dojo_name?.toLowerCase() || '').includes(s);
  });

  const filteredMembersWithoutLogin = membersWithoutLogin.filter(m => {
    const s = searchTerm.toLowerCase();
    if (!s) return true;
    return (m.vorname?.toLowerCase() || '').includes(s) ||
           (m.nachname?.toLowerCase() || '').includes(s) ||
           (m.email?.toLowerCase() || '').includes(s);
  });

  // ── Table headers ─────────────────────────────────────────────────
  const renderTableHeader = () => {
    if (activeTab === 'software') {
      return (
        <tr>
          <th>Benutzer</th>
          <th>Name</th>
          <th>E-Mail</th>
          <th>Rolle</th>
          <th>Aktiv</th>
          <th>Passwort</th>
          <th>Aktion</th>
        </tr>
      );
    }
    if (activeTab === 'verband') {
      return (
        <tr>
          <th>Benutzername</th>
          <th>Name / Organisation</th>
          <th>E-Mail</th>
          <th>Typ</th>
          <th>Status</th>
          <th>Passwort</th>
          <th>Aktion</th>
        </tr>
      );
    }
    return (
      <tr>
        <th>Benutzer</th>
        <th>E-Mail</th>
        <th>Dojo</th>
        <th><Clock size={14} className="u-va-middle" /> Letzter Login</th>
        <th>Passwort</th>
        <th>Aktion</th>
      </tr>
    );
  };

  // ── Row rendering ─────────────────────────────────────────────────
  const renderUserRow = (user) => {
    if (activeTab === 'software') {
      return (
        <tr key={user.id}>
          <td className="user-name"><strong>{user.username || '—'}</strong></td>
          <td>{user.vorname || ''} {user.nachname || ''}</td>
          <td>{user.email || '—'}</td>
          <td><span className={`badge badge-rolle badge-rolle-${(user.rolle || '').replace('_', '-')}`}>{user.rolle || '—'}</span></td>
          <td>
            <span className={`badge badge-${user.aktiv ? 'success' : 'warning'}`}>
              {user.aktiv ? 'Ja' : 'Nein'}
            </span>
          </td>
          <td>
            <span className={`badge badge-${user.has_password ? 'success' : 'warning'}`}>
              {user.has_password ? 'Ja' : 'Nein'}
            </span>
          </td>
          <td>
            <button className="btn-reset" onClick={() => handleResetClick(user)} title="Passwort zurücksetzen">
              <Key size={15} /> Zurücksetzen
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
          <td>
            <span className={`badge badge-${(user.status || '').toLowerCase() === 'aktiv' ? 'success' : 'warning'}`}>
              {user.status || '—'}
            </span>
          </td>
          <td>
            <span className={`badge badge-${user.has_password ? 'success' : 'warning'}`}>
              {user.has_password ? 'Ja' : 'Nein'}
            </span>
          </td>
          <td>
            <button className="btn-reset" onClick={() => handleResetClick(user)} title="Passwort zurücksetzen">
              <Key size={15} /> Zurücksetzen
            </button>
          </td>
        </tr>
      );
    }
    // dojo
    return (
      <tr key={user.id}>
        <td className="user-name">
          <strong>{user.username || '—'}</strong>
          {user.vorname && <span className="user-realname">{user.vorname} {user.nachname}</span>}
        </td>
        <td>{user.email || '—'}</td>
        <td>{user.dojo_name || '—'}</td>
        <td>{formatLastLogin(user.last_login_at)}</td>
        <td>
          <span className={`badge badge-${user.has_password ? 'success' : 'warning'}`}>
            {user.has_password ? 'Ja' : 'Nein'}
          </span>
        </td>
        <td>
          <button className="btn-reset" onClick={() => handleResetClick(user)} title="Passwort zurücksetzen">
            <Key size={15} /> Zurücksetzen
          </button>
        </td>
      </tr>
    );
  };

  // ── Stats-Leiste ──────────────────────────────────────────────────
  const renderStatsBar = () => {
    if (activeTab === 'dojo') {
      return (
        <div className="pw-stats-bar">
          <div className="pw-stat">
            <span className="pw-stat-value">{stats.total}</span>
            <span className="pw-stat-label">Accounts aktiv</span>
          </div>
          <div className="pw-stat pw-stat-warn">
            <span className="pw-stat-value">{stats.ohneLogin}</span>
            <span className="pw-stat-label">Ohne Login</span>
          </div>
          <div className="pw-stat pw-stat-info" title="Login-Tracking aktiv seit 03.03.2026 – ältere Logins nicht erfasst">
            <span className="pw-stat-value">{stats.nochNieEingeloggt}</span>
            <span className="pw-stat-label">Kein Login erfasst*</span>
          </div>
          <div className="pw-stat pw-stat-success">
            <span className="pw-stat-value">{stats.loginQuote}%</span>
            <span className="pw-stat-label">Login-Quote</span>
          </div>
          <span className="pv-tracking-note">
            * Login-Tracking aktiv seit 03.03.2026
          </span>
          {stats.ohneLogin > 0 && (
            <button
              className="btn-bulk-create"
              onClick={handleBulkCreate}
              disabled={bulkCreating}
              title="Für alle Mitglieder ohne Login automatisch Zugangsdaten anlegen"
            >
              {bulkCreating ? <RefreshCw size={16} className="spinning" /> : <Zap size={16} />}
              {bulkCreating ? 'Wird erstellt...' : `Alle ${stats.ohneLogin} automatisch anlegen`}
            </button>
          )}
        </div>
      );
    }

    if (activeTab === 'software') {
      return (
        <div className="pw-stats-bar">
          <div className="pw-stat">
            <span className="pw-stat-value">{stats.total}</span>
            <span className="pw-stat-label">Gesamt</span>
          </div>
          <div className="pw-stat pw-stat-success">
            <span className="pw-stat-value">{stats.aktiv}</span>
            <span className="pw-stat-label">Aktiv</span>
          </div>
          {stats.inaktiv > 0 && (
            <div className="pw-stat pw-stat-warn">
              <span className="pw-stat-value">{stats.inaktiv}</span>
              <span className="pw-stat-label">Inaktiv</span>
            </div>
          )}
          {stats.ohnePasswort > 0 && (
            <div className="pw-stat pw-stat-info">
              <span className="pw-stat-value">{stats.ohnePasswort}</span>
              <span className="pw-stat-label">Ohne Passwort</span>
            </div>
          )}
          {stats.rollen && Object.entries(stats.rollen).map(([rolle, count]) => (
            <div className="pw-stat pw-stat-role" key={rolle}>
              <span className="pw-stat-value">{count}</span>
              <span className="pw-stat-label">{rolle}</span>
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === 'verband') {
      return (
        <div className="pw-stats-bar">
          <div className="pw-stat">
            <span className="pw-stat-value">{stats.total}</span>
            <span className="pw-stat-label">Gesamt</span>
          </div>
          <div className="pw-stat pw-stat-success">
            <span className="pw-stat-value">{stats.aktiv}</span>
            <span className="pw-stat-label">Aktiv</span>
          </div>
          {stats.inaktiv > 0 && (
            <div className="pw-stat pw-stat-warn">
              <span className="pw-stat-value">{stats.inaktiv}</span>
              <span className="pw-stat-label">Inaktiv</span>
            </div>
          )}
          {stats.ohnePasswort > 0 && (
            <div className="pw-stat pw-stat-info">
              <span className="pw-stat-value">{stats.ohnePasswort}</span>
              <span className="pw-stat-label">Ohne Passwort</span>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="passwort-verwaltung">
      <div className="page-header">
        <h1><Key size={28} /> Passwort-Verwaltung</h1>
        <p>Zugangsdaten für alle Systeme verwalten</p>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        {tabs.map(tab => (
          <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={20} />
            <span className="tab-label">{tab.label}</span>
            <span className="tab-count">{activeTab === tab.id ? users.length : ''}</span>
          </button>
        ))}
      </div>

      {/* Stats-Leiste */}
      {!loading && users.length > 0 && renderStatsBar()}

      {/* Tab Description */}
      <div className="tab-description">
        {tabs.find(t => t.id === activeTab)?.description}
        {activeTab === 'dojo' && membersWithoutLogin.length > 0 && (
          <button className={`toggle-without-login ${showWithoutLogin ? 'active' : ''}`}
            onClick={() => setShowWithoutLogin(!showWithoutLogin)}>
            <UserPlus size={16} />
            {membersWithoutLogin.length} Mitglieder ohne Login
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <Search size={20} />
          <input type="text" placeholder="Suchen..."
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <button className="btn-refresh" onClick={loadUsers} disabled={loading}>
          <RefreshCw size={20} className={loading ? 'spinning' : ''} />
          Aktualisieren
        </button>
      </div>

      {/* Mitglieder ohne Login (nur Dojo-Tab) */}
      {activeTab === 'dojo' && showWithoutLogin && filteredMembersWithoutLogin.length > 0 && (
        <div className="without-login-section">
          <h3><UserPlus size={20} /> Mitglieder ohne Login-Account</h3>
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th><th>E-Mail</th><th>Dojo</th><th>Letzter Login</th><th>Passwort</th><th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembersWithoutLogin.map(member => (
                <tr key={member.mitglied_id}>
                  <td className="user-name"><strong>{member.vorname} {member.nachname}</strong></td>
                  <td>{member.email || '—'}</td>
                  <td>{member.dojo_name || '—'}</td>
                  <td><span className="pv-dash-cell">—</span></td>
                  <td><span className="badge badge-warning">Nein</span></td>
                  <td>
                    <button className="btn-create" onClick={() => handleCreateClick(member)} title="Login-Account erstellen">
                      <UserPlus size={15} /> Account erstellen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Haupt-Tabelle */}
      <div className="users-table-container">
        {loading ? (
          <div className="loading-state"><RefreshCw size={32} className="spinning" /><p>Lade Benutzer...</p></div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state"><Users size={48} /><p>{searchTerm ? 'Keine Benutzer gefunden' : 'Keine Benutzer vorhanden'}</p></div>
        ) : (
          <table className="users-table">
            <thead>{renderTableHeader()}</thead>
            <tbody>{filteredUsers.map(renderUserRow)}</tbody>
          </table>
        )}
      </div>

      {/* Reset Password Modal */}
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
                {activeTab === 'verband' && selectedUser.name && selectedUser.name !== selectedUser.benutzername && (
                  <> — {selectedUser.name}</>
                )}
              </p>
              {selectedUser.email && <p className="reset-email">E-Mail: {selectedUser.email}</p>}

              {/* Auf Standard zurücksetzen (nur Dojo-Tab, wenn Geburtsdatum vorhanden) */}
              {activeTab === 'dojo' && selectedUser.geburtsdatum && (
                <button
                  className="btn-reset-default"
                  onClick={handleResetToDefault}
                  disabled={resetting}
                  title="Passwort auf Geburtsdatum zurücksetzen"
                >
                  <RotateCcw size={16} />
                  Auf Standard zurücksetzen (Geburtsdatum)
                </button>
              )}

              <div className="password-input-group u-mt-1">
                <label>Neues Passwort manuell setzen</label>
                <div className="password-input-wrapper">
                  <input type={showPassword ? 'text' : 'password'} value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)} placeholder="Mindestens 6 Zeichen" />
                  <button type="button" className="toggle-password" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <button type="button" className="btn-generate" onClick={() => generatePassword(setNewPassword, setShowPassword)}>
                  Passwort generieren
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
              <button className="btn-confirm" onClick={handleResetPassword} disabled={resetting || !newPassword}>
                {resetting ? 'Wird gespeichert...' : 'Passwort setzen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Account Modal (Dojo) */}
      {showCreateModal && selectedMember && (
        <div className="modal-overlay" onClick={() => !createdUsername && setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><UserPlus size={24} /> Login-Account erstellen</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              {!createdUsername ? (
                <>
                  <p className="reset-info">Account für: <strong>{selectedMember.vorname} {selectedMember.nachname}</strong></p>
                  {selectedMember.email && <p className="reset-email">E-Mail: {selectedMember.email}</p>}
                  {selectedMember.geburtsdatum && (
                    <p className="reset-email u-text-muted">
                      Standard-Passwort wäre: {(() => {
                        const [y, m, d] = selectedMember.geburtsdatum.split('-');
                        return `${d}/${m}/${y}`;
                      })()}
                    </p>
                  )}
                  <div className="password-input-group">
                    <label>Passwort für den neuen Account</label>
                    <div className="password-input-wrapper">
                      <input type={showCreatePassword ? 'text' : 'password'} value={createPassword}
                        onChange={(e) => setCreatePassword(e.target.value)} placeholder="Mindestens 6 Zeichen" />
                      <button type="button" className="toggle-password" onClick={() => setShowCreatePassword(!showCreatePassword)}>
                        {showCreatePassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                    <button type="button" className="btn-generate" onClick={() => generatePassword(setCreatePassword, setShowCreatePassword)}>
                      Passwort generieren
                    </button>
                  </div>
                  {createPassword && showCreatePassword && (
                    <div className="password-preview">
                      <code>{createPassword}</code>
                      <button onClick={() => navigator.clipboard.writeText(createPassword)}>Kopieren</button>
                    </div>
                  )}
                </>
              ) : (
                <div className="account-created-success">
                  <CheckCircle size={48} className="success-icon" />
                  <h3>Account erfolgreich erstellt!</h3>
                  <div className="credentials-box">
                    <p><strong>Benutzername:</strong></p>
                    <code className="username-display">{createdUsername}</code>
                    <button className="btn-copy" onClick={() => navigator.clipboard.writeText(createdUsername)}>Kopieren</button>
                  </div>
                  <button className="btn-copy-all"
                    onClick={() => navigator.clipboard.writeText(`Benutzername: ${createdUsername}\nPasswort: ${createPassword}`)}>
                    Alle Zugangsdaten kopieren
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {!createdUsername ? (
                <>
                  <button className="btn-cancel" onClick={() => setShowCreateModal(false)}>Abbrechen</button>
                  <button className="btn-confirm btn-create-account" onClick={handleCreateAccount}
                    disabled={creating || !createPassword}>
                    {creating ? 'Wird erstellt...' : 'Account erstellen'}
                  </button>
                </>
              ) : (
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
