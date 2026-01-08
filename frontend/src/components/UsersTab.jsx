import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, UserCog, Activity, Shield, Clock, CheckCircle, XCircle } from 'lucide-react';

const UsersTab = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState(null);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.get('/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });

      setUsers(response.data.users);
      console.log('✅ Benutzerdaten geladen:', response.data.users);
    } catch (err) {
      console.error('❌ Fehler beim Laden der Benutzerdaten:', err);
      setError(err.response?.data?.message || 'Fehler beim Laden der Benutzerdaten');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="statistics-loading">
        <div className="loading-spinner"></div>
        <p>Lade Benutzerdaten...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics-error">
        <p>{error}</p>
        <button onClick={loadUsers} className="btn btn-primary">
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!users) {
    return null;
  }

  // Role translations
  const roleTranslations = {
    'super_admin': 'Super-Admin',
    'admin': 'Administrator',
    'mitarbeiter': 'Mitarbeiter',
    'eingeschraenkt': 'Eingeschränkt'
  };

  return (
    <div className="statistics-tab users-tab">
      {/* KPI Cards */}
      <div className="stats-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon primary">
            <Users size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Gesamt Benutzer</div>
            <div className="kpi-value">{users.userStats.total + users.dojoUsers.length}</div>
            <div className="kpi-sublabel">
              {users.userStats.total} Admin + {users.dojoUsers.length} Dojo
            </div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon success">
            <CheckCircle size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Aktive Benutzer</div>
            <div className="kpi-value">{users.userStats.active}</div>
            <div className="kpi-sublabel">{users.activeUsers.length} in letzten 7 Tagen</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon warning">
            <Activity size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Logins (30 Tage)</div>
            <div className="kpi-value">{users.loginStats.total_logins}</div>
            <div className="kpi-sublabel">Ø {users.loginStats.avg_per_day} pro Tag</div>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon primary">
            <Shield size={24} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Super-Admins</div>
            <div className="kpi-value">{users.userStats.byRole?.super_admin || 0}</div>
            <div className="kpi-sublabel">
              {users.userStats.byRole?.admin || 0} Admins gesamt
            </div>
          </div>
        </div>
      </div>

      {/* Admin Users Table */}
      {users.adminUsers.length > 0 && (
        <div className="finance-section">
          <h3 className="section-title">
            <UserCog size={18} />
            Admin-Benutzer ({users.adminUsers.length})
          </h3>
          <div className="finance-table-container">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Benutzername</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Rolle</th>
                  <th>Status</th>
                  <th>Letzter Login</th>
                  <th>Erstellt</th>
                </tr>
              </thead>
              <tbody>
                {users.adminUsers.map((user, idx) => (
                  <tr key={idx} className={!user.aktiv ? 'inactive-user' : ''}>
                    <td className="username">{user.username}</td>
                    <td>{user.vorname} {user.nachname}</td>
                    <td className="email-cell">{user.email}</td>
                    <td>
                      <span className={`role-badge ${user.rolle}`}>
                        {roleTranslations[user.rolle] || user.rolle}
                      </span>
                    </td>
                    <td>
                      {user.aktiv ? (
                        <span className="status-badge success">
                          <CheckCircle size={14} /> Aktiv
                        </span>
                      ) : (
                        <span className="status-badge inactive">
                          <XCircle size={14} /> Inaktiv
                        </span>
                      )}
                    </td>
                    <td>
                      {user.letzter_login ? (
                        <>
                          {new Date(user.letzter_login).toLocaleDateString('de-DE')}
                          <span className="time-cell">
                            {new Date(user.letzter_login).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </>
                      ) : (
                        <span className="no-data">Noch nie</span>
                      )}
                    </td>
                    <td>{new Date(user.erstellt_am).toLocaleDateString('de-DE')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Active Users (Last 7 Days) */}
      {users.activeUsers.length > 0 && (
        <div className="finance-section">
          <h3 className="section-title">
            <Activity size={18} />
            Kürzlich aktive Benutzer (Letzte 7 Tage)
          </h3>
          <div className="active-users-grid">
            {users.activeUsers.map((user, idx) => (
              <div key={idx} className="active-user-card">
                <div className="user-avatar">
                  {(user.vorname?.[0] || '?').toUpperCase()}{(user.nachname?.[0] || '?').toUpperCase()}
                </div>
                <div className="user-info">
                  <div className="user-name">{user.vorname} {user.nachname}</div>
                  <div className="user-username">@{user.username}</div>
                  <div className="user-activity">
                    <Clock size={12} />
                    {user.tage_seit_login === 0 ? 'Heute' : `Vor ${user.tage_seit_login} Tagen`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dojo Users by Dojo */}
      {users.dojoUsers.length > 0 && (
        <div className="finance-section">
          <h3 className="section-title">
            <Users size={18} />
            Dojo-Administratoren ({users.dojoUsers.length})
          </h3>
          <div className="dojo-users-container">
            {Object.entries(users.usersByDojo).map(([dojoName, dojoUsersList], idx) => (
              <div key={idx} className="dojo-users-group">
                <h4 className="dojo-group-title">
                  {dojoName} ({dojoUsersList.length})
                </h4>
                <div className="finance-table-container">
                  <table className="finance-table compact">
                    <thead>
                      <tr>
                        <th>Benutzername</th>
                        <th>Email</th>
                        <th>Aktivität (30 Tage)</th>
                        <th>Erstellt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dojoUsersList.map((dojoUser, userIdx) => (
                        <tr key={userIdx}>
                          <td className="username">{dojoUser.benutzername}</td>
                          <td className="email-cell">{dojoUser.email}</td>
                          <td className="activity-cell">
                            {dojoUser.activity_last_30_days > 0 ? (
                              <span className="activity-badge active">
                                {dojoUser.activity_last_30_days} Aktionen
                              </span>
                            ) : (
                              <span className="activity-badge inactive">Keine Aktivität</span>
                            )}
                          </td>
                          <td>{new Date(dojoUser.created_at).toLocaleDateString('de-DE')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity Log */}
      {users.recentActivity.length > 0 && (
        <div className="finance-section">
          <h3 className="section-title">
            <Activity size={18} />
            Letzte Aktivitäten (50)
          </h3>
          <div className="activity-log-container">
            {users.recentActivity.map((activity, idx) => (
              <div key={idx} className="activity-log-item">
                <div className="activity-icon">
                  <Activity size={16} />
                </div>
                <div className="activity-content">
                  <div className="activity-header">
                    <span className="activity-user">{activity.username}</span>
                    <span className="activity-action">{activity.aktion}</span>
                    <span className="activity-bereich">in {activity.bereich}</span>
                  </div>
                  {activity.beschreibung && (
                    <div className="activity-description">{activity.beschreibung}</div>
                  )}
                  <div className="activity-time">
                    {new Date(activity.erstellt_am).toLocaleString('de-DE')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersTab;
