import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Edit3, Trash2, Lock, Eye, EyeOff, Shield, Key, Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import '../styles/AdminVerwaltung.css';

const AdminVerwaltung = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [passwordChangeAdmin, setPasswordChangeAdmin] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    vorname: '',
    nachname: '',
    rolle: 'eingeschraenkt',
    aktiv: true,
    berechtigungen: null
  });

  // Password State
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [customPermissions, setCustomPermissions] = useState(false);

  // Berechtigungsbereiche
  const berechtigungsBereiche = [
    { key: 'mitglieder', label: 'Mitglieder', icon: '👥' },
    { key: 'vertraege', label: 'Verträge', icon: '📝' },
    { key: 'finanzen', label: 'Finanzen', icon: '💰' },
    { key: 'pruefungen', label: 'Prüfungen', icon: '🥋' },
    { key: 'stundenplan', label: 'Stundenplan', icon: '📅' },
    { key: 'einstellungen', label: 'Einstellungen', icon: '⚙️' },
    { key: 'admins', label: 'Admin-Verwaltung', icon: '🔐' },
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    { key: 'berichte', label: 'Berichte', icon: '📈' }
  ];

  // Standard-Berechtigungen für Rollen
  const rollenBerechtigungen = {
    super_admin: {
      mitglieder: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
      vertraege: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
      finanzen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
      pruefungen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
      stundenplan: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
      einstellungen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
      admins: { lesen: true, erstellen: true, bearbeiten: true, loeschen: true },
      dashboard: { lesen: true },
      berichte: { lesen: true, exportieren: true }
    },
    admin: {
      mitglieder: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
      vertraege: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
      finanzen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
      pruefungen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
      stundenplan: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
      einstellungen: { lesen: true, erstellen: false, bearbeiten: true, loeschen: false },
      admins: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
      dashboard: { lesen: true },
      berichte: { lesen: true, exportieren: true }
    },
    mitarbeiter: {
      mitglieder: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
      vertraege: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
      finanzen: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
      pruefungen: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
      stundenplan: { lesen: true, erstellen: true, bearbeiten: true, loeschen: false },
      einstellungen: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
      admins: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
      dashboard: { lesen: true },
      berichte: { lesen: true, exportieren: false }
    },
    eingeschraenkt: {
      mitglieder: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
      vertraege: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
      finanzen: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
      pruefungen: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
      stundenplan: { lesen: true, erstellen: false, bearbeiten: false, loeschen: false },
      einstellungen: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
      admins: { lesen: false, erstellen: false, bearbeiten: false, loeschen: false },
      dashboard: { lesen: true },
      berichte: { lesen: false, exportieren: false }
    }
  };

  // Admins laden
  useEffect(() => {
    loadAdmins();
  }, []);

  const loadAdmins = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admins');
      if (!response.ok) throw new Error('Fehler beim Laden');
      const data = await response.json();
      setAdmins(data);
    } catch (err) {
      showMessage('Fehler beim Laden der Admins: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Wenn Rolle geändert wird, Standard-Berechtigungen setzen
    if (name === 'rolle' && !customPermissions) {
      setFormData(prev => ({
        ...prev,
        berechtigungen: rollenBerechtigungen[value]
      }));
    }
  };

  const handlePermissionChange = (bereich, aktion, value) => {
    setCustomPermissions(true);
    setFormData(prev => {
      const newBerechtigungen = { ...prev.berechtigungen };
      if (!newBerechtigungen[bereich]) {
        newBerechtigungen[bereich] = {};
      }
      newBerechtigungen[bereich][aktion] = value;
      return { ...prev, berechtigungen: newBerechtigungen };
    });
  };

  const openModal = (admin = null) => {
    if (admin) {
      setEditingAdmin(admin);
      setFormData({
        username: admin.username,
        email: admin.email,
        password: '',
        vorname: admin.vorname || '',
        nachname: admin.nachname || '',
        rolle: admin.rolle,
        aktiv: admin.aktiv,
        berechtigungen: admin.berechtigungen
      });
      setCustomPermissions(true);
    } else {
      setEditingAdmin(null);
      setFormData({
        username: '',
        email: '',
        password: '',
        vorname: '',
        nachname: '',
        rolle: 'eingeschraenkt',
        aktiv: true,
        berechtigungen: rollenBerechtigungen.eingeschraenkt
      });
      setCustomPermissions(false);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAdmin(null);
    setShowPassword(false);
    setCustomPermissions(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingAdmin
        ? `/api/admins/${editingAdmin.id}`
        : '/api/admins';

      const method = editingAdmin ? 'PUT' : 'POST';

      // Passwort nur senden wenn ausgefüllt
      const submitData = { ...formData };
      if (!submitData.password) {
        delete submitData.password;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Speichern');
      }

      showMessage(
        editingAdmin ? 'Admin erfolgreich aktualisiert!' : 'Admin erfolgreich erstellt!',
        'success'
      );

      closeModal();
      loadAdmins();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (admin) => {
    if (!window.confirm(`Admin "${admin.username}" wirklich löschen?`)) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admins/${admin.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Löschen');
      }

      showMessage('Admin erfolgreich gelöscht!', 'success');
      loadAdmins();
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const openPasswordModal = (admin) => {
    setPasswordChangeAdmin(admin);
    setPasswordData({ newPassword: '', confirmPassword: '' });
    setShowPasswordModal(true);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showMessage('Passwörter stimmen nicht überein!', 'error');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showMessage('Passwort muss mindestens 6 Zeichen lang sein!', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/admins/${passwordChangeAdmin.id}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: passwordData.newPassword })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Ändern des Passworts');
      }

      showMessage('Passwort erfolgreich geändert!', 'success');
      setShowPasswordModal(false);
      setPasswordChangeAdmin(null);
    } catch (err) {
      showMessage(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const getRollenLabel = (rolle) => {
    const labels = {
      super_admin: 'Super Admin',
      admin: 'Administrator',
      mitarbeiter: 'Mitarbeiter',
      eingeschraenkt: 'Eingeschränkt'
    };
    return labels[rolle] || rolle;
  };

  const getRollenBadgeClass = (rolle) => {
    const classes = {
      super_admin: 'badge-super-admin',
      admin: 'badge-admin',
      mitarbeiter: 'badge-mitarbeiter',
      eingeschraenkt: 'badge-eingeschraenkt'
    };
    return classes[rolle] || 'badge-default';
  };

  return (
    <div className="admin-verwaltung">
      <div className="page-header">
        <div className="header-left">
          <Shield size={32} className="header-icon" />
          <div>
            <h1>Admin-Verwaltung</h1>
            <p>Verwalten Sie Benutzer und deren Zugriffsrechte</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>
          <UserPlus size={18} />
          Neuer Admin
        </button>
      </div>

      {message.text && (
        <div className={`message message-${message.type}`}>
          {message.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {message.text}
        </div>
      )}

      <div className="admins-grid">
        {loading && admins.length === 0 ? (
          <div className="loading">Lade Admins...</div>
        ) : admins.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <p>Noch keine Admins vorhanden</p>
            <button className="btn btn-primary" onClick={() => openModal()}>
              Ersten Admin erstellen
            </button>
          </div>
        ) : (
          admins.map(admin => (
            <div key={admin.id} className="admin-card glass-card">
              <div className="admin-card-header">
                <div className="admin-avatar">
                  {(admin.vorname?.[0] || admin.username?.[0] || 'A').toUpperCase()}
                </div>
                <div className="admin-info">
                  <h3>{admin.vorname} {admin.nachname}</h3>
                  <p className="username">@{admin.username}</p>
                  <p className="email">{admin.email}</p>
                </div>
                <div className={`status-badge ${admin.aktiv ? 'active' : 'inactive'}`}>
                  {admin.aktiv ? 'Aktiv' : 'Inaktiv'}
                </div>
              </div>

              <div className="admin-card-body">
                <div className="role-badge">
                  <span className={`badge ${getRollenBadgeClass(admin.rolle)}`}>
                    {getRollenLabel(admin.rolle)}
                  </span>
                </div>

                <div className="admin-meta">
                  <div className="meta-item">
                    <strong>Erstellt:</strong>{' '}
                    {new Date(admin.erstellt_am).toLocaleDateString('de-DE')}
                  </div>
                  {admin.letzter_login && (
                    <div className="meta-item">
                      <strong>Letzter Login:</strong>{' '}
                      {new Date(admin.letzter_login).toLocaleDateString('de-DE')}
                    </div>
                  )}
                </div>

                <div className="permissions-summary">
                  <strong>Berechtigungen:</strong>
                  <div className="permissions-chips">
                    {Object.entries(admin.berechtigungen || {})
                      .filter(([_, perms]) => perms.lesen || perms.erstellen || perms.bearbeiten)
                      .map(([bereich, _]) => {
                        const info = berechtigungsBereiche.find(b => b.key === bereich);
                        return (
                          <span key={bereich} className="permission-chip">
                            {info?.icon} {info?.label || bereich}
                          </span>
                        );
                      })}
                  </div>
                </div>
              </div>

              <div className="admin-card-actions">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => openPasswordModal(admin)}
                  title="Passwort ändern"
                >
                  <Key size={16} />
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => openModal(admin)}
                  title="Bearbeiten"
                >
                  <Edit3 size={16} />
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => handleDelete(admin)}
                  title="Löschen"
                  disabled={admin.rolle === 'super_admin'}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal für Erstellen/Bearbeiten */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                {editingAdmin ? 'Admin bearbeiten' : 'Neuen Admin erstellen'}
              </h2>
              <button className="btn-close" onClick={closeModal}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Username *</label>
                    <input
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      disabled={editingAdmin}
                      placeholder="admin123"
                    />
                  </div>

                  <div className="form-group">
                    <label>E-Mail *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      placeholder="admin@dojo.de"
                    />
                  </div>

                  <div className="form-group">
                    <label>Vorname</label>
                    <input
                      type="text"
                      name="vorname"
                      value={formData.vorname}
                      onChange={handleInputChange}
                      placeholder="Max"
                    />
                  </div>

                  <div className="form-group">
                    <label>Nachname</label>
                    <input
                      type="text"
                      name="nachname"
                      value={formData.nachname}
                      onChange={handleInputChange}
                      placeholder="Mustermann"
                    />
                  </div>

                  {!editingAdmin && (
                    <div className="form-group full-width">
                      <label>Passwort *</label>
                      <div className="password-input">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          required={!editingAdmin}
                          placeholder="Mindestens 6 Zeichen"
                        />
                        <button
                          type="button"
                          className="btn-toggle-password"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Rolle *</label>
                    <select
                      name="rolle"
                      value={formData.rolle}
                      onChange={handleInputChange}
                      required
                    >
                      <option value="eingeschraenkt">Eingeschränkt</option>
                      <option value="mitarbeiter">Mitarbeiter</option>
                      <option value="admin">Administrator</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        name="aktiv"
                        checked={formData.aktiv}
                        onChange={handleInputChange}
                      />
                      Aktiv
                    </label>
                  </div>
                </div>

                <div className="permissions-section">
                  <h3>Berechtigungen</h3>
                  <div className="permissions-grid">
                    {berechtigungsBereiche.map(bereich => (
                      <div key={bereich.key} className="permission-group">
                        <h4>
                          {bereich.icon} {bereich.label}
                        </h4>
                        <div className="permission-checkboxes">
                          {['lesen', 'erstellen', 'bearbeiten', 'loeschen', 'exportieren'].map(aktion => {
                            // Nur relevante Aktionen für bestimmte Bereiche
                            if (bereich.key === 'dashboard' && aktion !== 'lesen') return null;
                            if (bereich.key === 'berichte' && !['lesen', 'exportieren'].includes(aktion)) return null;

                            return (
                              <label key={aktion} className="checkbox-label-inline">
                                <input
                                  type="checkbox"
                                  checked={formData.berechtigungen?.[bereich.key]?.[aktion] || false}
                                  onChange={(e) => handlePermissionChange(bereich.key, aktion, e.target.checked)}
                                />
                                {aktion.charAt(0).toUpperCase() + aktion.slice(1)}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  <X size={18} />
                  Abbrechen
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  <Save size={18} />
                  {loading ? 'Speichern...' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal für Passwort ändern */}
      {showPasswordModal && (
        <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Passwort ändern</h2>
              <button className="btn-close" onClick={() => setShowPasswordModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePasswordChange}>
              <div className="modal-body">
                <p className="mb-3">
                  Passwort für <strong>{passwordChangeAdmin?.username}</strong> ändern
                </p>

                <div className="form-group">
                  <label>Neues Passwort *</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    required
                    placeholder="Mindestens 6 Zeichen"
                  />
                </div>

                <div className="form-group">
                  <label>Passwort bestätigen *</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required
                    placeholder="Passwort wiederholen"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPasswordModal(false)}>
                  Abbrechen
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  <Lock size={18} />
                  {loading ? 'Ändern...' : 'Passwort ändern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVerwaltung;
