import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, UserCog, Activity, Shield, Clock, CheckCircle, XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const UserAvatar = ({ vorname, nachname, role }) => {
  const initials = `${(vorname?.[0] || '?').toUpperCase()}${(nachname?.[0] || '?').toUpperCase()}`;
  const colorClass = role === 'super_admin' ? 'avatar-gold' : role === 'admin' ? 'avatar-teal' : 'avatar-default';
  return <span className={`user-table-avatar ${colorClass}`}>{initials}</span>;
};

const RelativeTime = ({ dateStr }) => {
  if (!dateStr) return <span className="no-data">Noch nie</span>;
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  let relative;
  if (diffDays === 0) relative = 'Heute';
  else if (diffDays === 1) relative = 'Gestern';
  else if (diffDays < 7) relative = `Vor ${diffDays} Tagen`;
  else if (diffDays < 30) relative = `Vor ${Math.floor(diffDays / 7)} Wo.`;
  else relative = date.toLocaleDateString('de-DE');
  return (
    <div>
      <span className="relative-time-label">{relative}</span>
      <span className="time-cell">{date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  );
};

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

  const totalUsers = users.userStats.total + users.dojoUsers.length;
  const activeRate = totalUsers > 0 ? Math.round((users.userStats.active / totalUsers) * 100) : 0;

  return (
    <div className="statistics-tab users-tab">
      {/* KPI Cards */}
      <div className="stats-kpi-grid">
        <div className="kpi-card kpi-card--blue">
          <div className="kpi-icon-wrap kpi-icon-wrap--blue">
            <Users size={22} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Gesamt Benutzer</div>
            <div className="kpi-value">{totalUsers}</div>
            <div className="kpi-sublabel">
              <span className="kpi-chip kpi-chip--blue">{users.userStats.total} Admin</span>
              <span className="kpi-chip kpi-chip--muted">{users.dojoUsers.length} Dojo</span>
            </div>
          </div>
        </div>

        <div className="kpi-card kpi-card--green">
          <div className="kpi-icon-wrap kpi-icon-wrap--green">
            <CheckCircle size={22} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Aktive Benutzer</div>
            <div className="kpi-value">{users.userStats.active}</div>
            <div className="kpi-sublabel">
              <span className="kpi-chip kpi-chip--green">{activeRate}% aktiv</span>
              <span className="kpi-chip kpi-chip--muted">{users.activeUsers.length} in 7 Tagen</span>
            </div>
          </div>
        </div>

        <div className="kpi-card kpi-card--orange">
          <div className="kpi-icon-wrap kpi-icon-wrap--orange">
            <Activity size={22} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Logins (30 Tage)</div>
            <div className="kpi-value">{users.loginStats.total_logins}</div>
            <div className="kpi-sublabel">
              <span className="kpi-chip kpi-chip--orange">Ø {users.loginStats.avg_per_day}/Tag</span>
            </div>
          </div>
        </div>

        <div className="kpi-card kpi-card--gold">
          <div className="kpi-icon-wrap kpi-icon-wrap--gold">
            <Shield size={22} />
          </div>
          <div className="kpi-content">
            <div className="kpi-label">Super-Admins</div>
            <div className="kpi-value">{users.userStats.byRole?.super_admin || 0}</div>
            <div className="kpi-sublabel">
              <span className="kpi-chip kpi-chip--gold">{users.userStats.byRole?.admin || 0} Admins</span>
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
                  <th>Passwort</th>
                  <th>Rolle</th>
                  <th>Status</th>
                  <th>Letzter Login</th>
                  <th>Erstellt</th>
                </tr>
              </thead>
              <tbody>
                {users.adminUsers.map((user, idx) => (
                  <tr key={idx} className={!user.aktiv ? 'inactive-user' : ''}>
                    <td>
                      <div className="username-cell">
                        <UserAvatar vorname={user.vorname} nachname={user.nachname} role={user.rolle} />
                        <span className="username">{user.username}</span>
                      </div>
                    </td>
                    <td className="name-cell">{user.vorname} {user.nachname}</td>
                    <td className="email-cell">{user.email}</td>
                    <td>
                      {user.has_password ? (
                        <span className="status-badge success"><CheckCircle size={12} /> Ja</span>
                      ) : (
                        <span className="status-badge warning"><XCircle size={12} /> Nein</span>
                      )}
                    </td>
                    <td>
                      <span className={`role-badge ${user.rolle}`}>
                        {roleTranslations[user.rolle] || user.rolle}
                      </span>
                    </td>
                    <td>
                      {user.aktiv ? (
                        <span className="status-badge success">
                          <CheckCircle size={13} /> Aktiv
                        </span>
                      ) : (
                        <span className="status-badge inactive">
                          <XCircle size={13} /> Inaktiv
                        </span>
                      )}
                    </td>
                    <td><RelativeTime dateStr={user.letzter_login} /></td>
                    <td className="date-cell">{new Date(user.erstellt_am).toLocaleDateString('de-DE')}</td>
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
                        <th>Passwort</th>
                        <th>Aktivität (30 Tage)</th>
                        <th>Erstellt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dojoUsersList.map((dojoUser, userIdx) => (
                        <tr key={userIdx}>
                          <td className="username">{dojoUser.benutzername}</td>
                          <td className="email-cell">{dojoUser.email}</td>
                          <td>
                            {dojoUser.has_password ? (
                              <span className="status-badge success">Ja</span>
                            ) : (
                              <span className="status-badge warning">Nein</span>
                            )}
                          </td>
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
