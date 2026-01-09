import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Edit3, Trash2, Lock, Shield, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import '../styles/AdminVerwaltung.css';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';


const AdminVerwaltung = () => {
  const [activeTab, setActiveTab] = useState('admin');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [expandedRoles, setExpandedRoles] = useState({
    admin: true,
    supervisor: true,
    trainer: true,
    verkauf: true
  });

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', email: '', role: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });

  // Rollen-Definitionen
  const rollen = [
    { key: 'admin', label: 'Admin', icon: '👨‍💼', color: '#3b82f6' },
    { key: 'supervisor', label: 'Supervisor', icon: '👔', color: '#8b5cf6' },
    { key: 'trainer', label: 'Trainer', icon: '🥋', color: '#10b981' },
    { key: 'verkauf', label: 'Verkauf', icon: '💰', color: '#f59e0b' }
  ];

  // Berechtigungsbereiche
  const berechtigungsBereiche = [
    { key: 'mitglieder', label: 'Mitglieder', icon: '👥' },
    { key: 'vertraege', label: 'Verträge', icon: '📝' },
    { key: 'finanzen', label: 'Finanzen', icon: '💰' },
    { key: 'pruefungen', label: 'Prüfungen', icon: '🥋' },
    { key: 'stundenplan', label: 'Stundenplan', icon: '📅' },
    { key: 'verkauf', label: 'Verkauf/Kasse', icon: '🛒' },
    { key: 'berichte', label: 'Berichte', icon: '📈' },
    { key: 'einstellungen', label: 'Einstellungen', icon: '⚙️' }
  ];

  // Standard-Berechtigungen pro Rolle
  const [rollenBerechtigungen, setRollenBerechtigungen] = useState({
    admin: {
      mitglieder: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
      vertraege: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
      finanzen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
      pruefungen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
      stundenplan: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
      verkauf: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
      berichte: { lesen: true, exportieren: true },
      einstellungen: { lesen: true, bearbeiten: true }
    },
    supervisor: {
      mitglieder: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
      vertraege: { lesen: true, erstellen: false, bearbeiten: true, loeschen: false },
      finanzen: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
      pruefungen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
      stundenplan: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
      verkauf: { lesen: true, erstellen: true, bearbeiten: false, loeschen: false },
      berichte: { lesen: true, exportieren: false },
      einstellungen: { lesen: true, bearbeiten: false }
    },
    trainer: {
      mitglieder: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
      vertraege: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
      finanzen: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
      pruefungen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
      stundenplan: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
      verkauf: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
      berichte: { lesen: false, exportieren: false },
      einstellungen: { lesen: false, bearbeiten: false }
    },
    verkauf: {
      mitglieder: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
      vertraege: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
      finanzen: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
      pruefungen: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
      stundenplan: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
      verkauf: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
      berichte: { lesen: false, exportieren: false },
      einstellungen: { lesen: false, bearbeiten: false }
    }
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/auth/users`);
      if (!response.ok) throw new Error('Fehler beim Laden');
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      showMessage('Fehler beim Laden der Benutzer: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const handlePermissionChange = (rolle, bereich, aktion, value) => {
    setRollenBerechtigungen(prev => ({
      ...prev,
      [rolle]: {
        ...prev[rolle],
        [bereich]: {
          ...prev[rolle][bereich],
          [aktion]: value
        }
      }
    }));
  };

  const savePermissions = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: rollenBerechtigungen })
      });

      if (!response.ok) throw new Error('Fehler beim Speichern');
      showMessage('Berechtigungen erfolgreich gespeichert!', 'success');
    } catch (err) {
      showMessage('Fehler beim Speichern: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Filtere Benutzer nach Rolle
  const getUsersByRole = (rolle) => {
    return users.filter(u => u.role === rolle);
  };

  // Toggle für Rolle ein-/ausklappen
  const toggleRole = (roleKey) => {
    setExpandedRoles(prev => ({
      ...prev,
      [roleKey]: !prev[roleKey]
    }));
  };

  // Benutzer bearbeiten
  const handleEdit = (user) => {
    setSelectedUser(user);
    setEditForm({
      username: user.username,
      email: user.email,
      role: user.role
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.username || !editForm.email || !editForm.role) {
      showMessage('Bitte alle Felder ausfüllen', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/auth/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Speichern');
      }

      showMessage(data.message || 'Benutzer erfolgreich aktualisiert', 'success');
      setShowEditModal(false);
      loadUsers(); // Reload users
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Passwort zurücksetzen
  const handlePasswordReset = (user) => {
    setSelectedUser(user);
    setPasswordForm({ newPassword: '', confirmPassword: '' });
    setShowPasswordModal(true);
  };

  const handleSavePassword = async () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      showMessage('Bitte beide Felder ausfüllen', 'error');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('Passwörter stimmen nicht überein', 'error');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showMessage('Passwort muss mindestens 6 Zeichen lang sein', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/auth/users/${selectedUser.id}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: passwordForm.newPassword })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Zurücksetzen');
      }

      showMessage(data.message || 'Passwort erfolgreich zurückgesetzt', 'success');
      setShowPasswordModal(false);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Benutzer löschen
  const handleDelete = async (user) => {
    if (user.id === 1) {
      showMessage('Super-Admin kann nicht gelöscht werden', 'error');
      return;
    }

    const confirmed = window.confirm(
      `Möchten Sie den Benutzer "${user.username}" (${user.email}) wirklich löschen?\n\nDieser Vorgang kann nicht rückgängig gemacht werden!`
    );

    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/auth/users/${user.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Löschen');
      }

      showMessage(data.message || 'Benutzer erfolgreich gelöscht', 'success');
      loadUsers(); // Reload users
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Render Rechtezuweisung Tab
  const renderRechteTab = () => (
    <div className="rechte-container">
      <div className="rechte-header">
        <div>
          <h2>Rechtezuweisung</h2>
          <p>Definiere hier die Berechtigungen für jede Rolle. Alle Benutzer in einer Rolle erhalten automatisch diese Rechte.</p>
        </div>
        <button className="btn btn-primary" onClick={savePermissions} disabled={loading}>
          <Shield size={18} />
          {loading ? 'Speichern...' : 'Berechtigungen speichern'}
        </button>
      </div>

      {rollen.map(rolle => (
        <div key={rolle.key} className="rolle-section">
          <div
            className="rolle-header clickable"
            style={{ borderLeftColor: rolle.color }}
            onClick={() => toggleRole(rolle.key)}
          >
            <span className="rolle-icon">{rolle.icon}</span>
            <h3>{rolle.label}</h3>
            <div className="rolle-toggle">
              {expandedRoles[rolle.key] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>

          {expandedRoles[rolle.key] && (
            <div className="berechtigungen-grid">
              {berechtigungsBereiche.map(bereich => (
                <div key={bereich.key} className="berechtigungs-card">
                  <div className="bereich-header">
                    <span className="bereich-icon">{bereich.icon}</span>
                    <h4>{bereich.label}</h4>
                  </div>
                  <div className="aktionen-checkboxes">
                    {['lesen', 'erstellen', 'bearbeiten', 'loeschen', 'exportieren'].map(aktion => {
                      // Spezielle Bereiche
                      if (bereich.key === 'berichte' && !['lesen', 'exportieren'].includes(aktion)) return null;
                      if (bereich.key === 'einstellungen' && !['lesen', 'bearbeiten'].includes(aktion)) return null;

                      const isChecked = rollenBerechtigungen[rolle.key]?.[bereich.key]?.[aktion] || false;

                      return (
                        <label key={aktion} className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handlePermissionChange(rolle.key, bereich.key, aktion, e.target.checked)}
                          />
                          <span>{aktion.charAt(0).toUpperCase() + aktion.slice(1)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // Render Benutzer-Liste für eine Rolle
  const renderUserList = (rolle) => {
    const roleUsers = getUsersByRole(rolle);
    const roleInfo = rollen.find(r => r.key === rolle);

    return (
      <div className="users-container">
        <div className="users-header">
          <div>
            <h2 style={{ color: roleInfo.color }}>
              {roleInfo.icon} {roleInfo.label}
            </h2>
            <p>{roleUsers.length} Benutzer mit dieser Rolle</p>
          </div>
          <button className="btn btn-primary">
            <UserPlus size={18} />
            Benutzer hinzufügen
          </button>
        </div>

        {roleUsers.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <p>Keine Benutzer mit der Rolle "{roleInfo.label}"</p>
          </div>
        ) : (
          <div className="users-grid">
            {roleUsers.map(user => (
              <div key={user.id} className="user-card">
                <div className="user-avatar" style={{ background: roleInfo.color }}>
                  {(user.vorname?.[0] || user.username?.[0] || 'U').toUpperCase()}
                </div>
                <div className="user-info">
                  <h3>{user.vorname} {user.nachname}</h3>
                  <p className="username">@{user.username}</p>
                  <p className="email">{user.email}</p>
                </div>
                <div className="user-actions">
                  <button className="btn-icon" title="Bearbeiten" onClick={() => handleEdit(user)}>
                    <Edit3 size={16} />
                  </button>
                  <button className="btn-icon" title="Passwort ändern" onClick={() => handlePasswordReset(user)}>
                    <Lock size={16} />
                  </button>
                  <button className="btn-icon btn-danger" title="Löschen" onClick={() => handleDelete(user)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="admin-verwaltung">
      <div className="page-header">
        <div className="header-left">
          <Shield size={32} className="header-icon" />
          <div>
            <h1>Benutzerverwaltung & Berechtigungen</h1>
            <p>Verwalten Sie Benutzer nach Rollen und definieren Sie Zugriffsrechte</p>
          </div>
        </div>
      </div>

      {message.text && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        {rollen.map(rolle => (
          <button
            key={rolle.key}
            className={`tab-button ${activeTab === rolle.key ? 'active' : ''}`}
            onClick={() => setActiveTab(rolle.key)}
            style={activeTab === rolle.key ? { borderBottomColor: rolle.color } : {}}
          >
            <span className="tab-icon">{rolle.icon}</span>
            {rolle.label}
            <span className="tab-count">{getUsersByRole(rolle.key).length}</span>
          </button>
        ))}
        <button
          className={`tab-button ${activeTab === 'rechte' ? 'active' : ''}`}
          onClick={() => setActiveTab('rechte')}
        >
          <Settings size={18} className="tab-icon" />
          Rechtezuweisung
        </button>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'rechte' ? renderRechteTab() : renderUserList(activeTab)}
      </div>

      {/* Edit User Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Benutzer bearbeiten</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Benutzername</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  placeholder="Benutzername"
                />
              </div>
              <div className="form-group">
                <label>E-Mail</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="E-Mail"
                />
              </div>
              <div className="form-group">
                <label>Rolle</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="">Rolle wählen...</option>
                  {rollen.map(r => (
                    <option key={r.key} value={r.key}>{r.icon} {r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={handleSaveEdit} disabled={loading}>
                {loading ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Passwort zurücksetzen</h2>
              <button className="modal-close" onClick={() => setShowPasswordModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="modal-info">
                Passwort für: <strong>{selectedUser?.username}</strong> ({selectedUser?.email})
              </p>
              <div className="form-group">
                <label>Neues Passwort</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="Mindestens 6 Zeichen"
                />
              </div>
              <div className="form-group">
                <label>Passwort wiederholen</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Passwort wiederholen"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={handleSavePassword} disabled={loading}>
                {loading ? 'Zurücksetzen...' : 'Passwort zurücksetzen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVerwaltung;
