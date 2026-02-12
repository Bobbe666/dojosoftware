import React, { useState, useEffect } from 'react';
import { Key, Search, RefreshCw, Eye, EyeOff, CheckCircle, AlertCircle, Users, Building2, Shield } from 'lucide-react';
import config from '../config/config.js';
import { getAuthToken } from '../utils/fetchWithAuth';
import '../styles/PasswortVerwaltung.css';

const PasswortVerwaltung = ({ dojoOnly = false }) => {
  const [activeTab, setActiveTab] = useState(dojoOnly ? 'dojo' : 'software');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // Password Reset Modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetting, setResetting] = useState(false);

  const allTabs = [
    { id: 'software', label: 'Software', icon: Shield, description: 'Admin-Benutzer der DojoSoftware' },
    { id: 'verband', label: 'Verband', icon: Building2, description: 'TDA Verbandsmitglieder' },
    { id: 'dojo', label: 'Dojo', icon: Users, description: 'Dojo-Mitglieder mit Login' }
  ];

  const tabs = dojoOnly ? allTabs.filter(t => t.id === 'dojo') : allTabs;

  useEffect(() => {
    loadUsers();
  }, [activeTab]);

  const loadUsers = async () => {
    setLoading(true);
    setMessage({ text: '', type: '' });
    try {
      const response = await fetch(`${config.apiBaseUrl}/admin/password-management/${activeTab}`, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` }
      });
      if (!response.ok) throw new Error('Fehler beim Laden');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Fehler:', error);
      setMessage({ text: 'Fehler beim Laden der Benutzer', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleResetClick = (user) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPassword(false);
    setShowResetModal(true);
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(password);
    setShowPassword(true);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setMessage({ text: 'Passwort muss mindestens 6 Zeichen haben', type: 'error' });
      return;
    }

    setResetting(true);
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/admin/password-management/${activeTab}/${selectedUser.id}/reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
          },
          body: JSON.stringify({ newPassword })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler');

      setMessage({ text: `Passwort für "${selectedUser.username || selectedUser.benutzername || selectedUser.name}" erfolgreich zurückgesetzt`, type: 'success' });
      setShowResetModal(false);
      loadUsers();
    } catch (error) {
      setMessage({ text: error.message, type: 'error' });
    } finally {
      setResetting(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchTerm.toLowerCase();
    return (
      (user.username?.toLowerCase() || '').includes(searchLower) ||
      (user.benutzername?.toLowerCase() || '').includes(searchLower) ||
      (user.email?.toLowerCase() || '').includes(searchLower) ||
      (user.name?.toLowerCase() || '').includes(searchLower) ||
      (user.dojo_name?.toLowerCase() || '').includes(searchLower)
    );
  });

  const renderUserRow = (user) => {
    const displayName = user.username || user.benutzername || user.name || '-';
    const displayEmail = user.email || user.person_email || '-';
    const displayDojo = user.dojo_name || '-';

    return (
      <tr key={user.id}>
        <td className="user-name">
          <strong>{displayName}</strong>
          {user.vorname && user.nachname && (
            <span className="user-realname">{user.vorname} {user.nachname}</span>
          )}
        </td>
        <td>{displayEmail}</td>
        <td>{displayDojo}</td>
        <td>
          {activeTab === 'software' && (
            <span className={`badge badge-${user.rolle === 'super_admin' ? 'danger' : user.rolle === 'admin' ? 'warning' : 'info'}`}>
              {user.rolle || 'user'}
            </span>
          )}
          {activeTab === 'verband' && (
            <>
              <span className={`badge badge-${user.typ === 'dojo' ? 'primary' : 'secondary'}`}>
                {user.typ || '-'}
              </span>
              {user.has_password ? (
                <span className="badge badge-success" title="Hat Passwort">PW</span>
              ) : (
                <span className="badge badge-warning" title="Kein Passwort">Kein PW</span>
              )}
            </>
          )}
          {activeTab === 'dojo' && (
            <span className="badge badge-info">{user.role || 'user'}</span>
          )}
        </td>
        <td>
          <button
            className="btn-reset"
            onClick={() => handleResetClick(user)}
            title="Passwort zurücksetzen"
          >
            <Key size={16} />
            Zurücksetzen
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="passwort-verwaltung">
      <div className="page-header">
        <h1><Key size={28} /> Passwort-Verwaltung</h1>
        <p>Passwörter für Benutzer aller Systeme zurücksetzen</p>
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
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={20} />
            <span className="tab-label">{tab.label}</span>
            <span className="tab-count">{activeTab === tab.id ? users.length : ''}</span>
          </button>
        ))}
      </div>

      {/* Tab Description */}
      <div className="tab-description">
        {tabs.find(t => t.id === activeTab)?.description}
      </div>

      {/* Search & Actions */}
      <div className="toolbar">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Suchen nach Name, E-Mail, Dojo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-refresh" onClick={loadUsers} disabled={loading}>
          <RefreshCw size={20} className={loading ? 'spinning' : ''} />
          Aktualisieren
        </button>
      </div>

      {/* Users Table */}
      <div className="users-table-container">
        {loading ? (
          <div className="loading-state">
            <RefreshCw size={32} className="spinning" />
            <p>Lade Benutzer...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <p>{searchTerm ? 'Keine Benutzer gefunden' : 'Keine Benutzer vorhanden'}</p>
          </div>
        ) : (
          <table className="users-table">
            <thead>
              <tr>
                <th>Benutzer</th>
                <th>E-Mail</th>
                <th>Dojo</th>
                <th>Status</th>
                <th>Aktion</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(renderUserRow)}
            </tbody>
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
                Passwort zurücksetzen für: <strong>{selectedUser.username || selectedUser.benutzername || selectedUser.name}</strong>
              </p>
              {selectedUser.email && (
                <p className="reset-email">E-Mail: {selectedUser.email}</p>
              )}

              <div className="password-input-group">
                <label>Neues Passwort</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mindestens 6 Zeichen"
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-generate"
                  onClick={generatePassword}
                >
                  Passwort generieren
                </button>
              </div>

              {newPassword && showPassword && (
                <div className="password-preview">
                  <code>{newPassword}</code>
                  <button
                    onClick={() => navigator.clipboard.writeText(newPassword)}
                    title="In Zwischenablage kopieren"
                  >
                    Kopieren
                  </button>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowResetModal(false)}>
                Abbrechen
              </button>
              <button
                className="btn-confirm"
                onClick={handleResetPassword}
                disabled={resetting || !newPassword}
              >
                {resetting ? 'Wird gespeichert...' : 'Passwort setzen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PasswortVerwaltung;
