import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, UserCog, Activity, Shield, CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

const ROLE_CONFIG = {
  super_admin:    { label: 'Super Admin', cls: 'ut-role--super' },
  admin:          { label: 'Admin',       cls: 'ut-role--admin' },
  trainer:        { label: 'Trainer',     cls: 'ut-role--trainer' },
  mitarbeiter:    { label: 'Mitarbeiter', cls: 'ut-role--mitarbeiter' },
  eingeschraenkt: { label: 'Eingeschr.', cls: 'ut-role--eingeschr' },
};

const Avatar = ({ vorname, nachname, role }) => {
  const initials = `${(vorname?.[0] || '?').toUpperCase()}${(nachname?.[0] || '?').toUpperCase()}`;
  const cls = role === 'super_admin' ? 'ut-av--gold' : role === 'admin' ? 'ut-av--teal' : role === 'trainer' ? 'ut-av--violet' : 'ut-av--blue';
  return <span className={`ut-avatar ${cls}`}>{initials}</span>;
};

const TimeAgo = ({ dateStr }) => {
  if (!dateStr) return <span className="ut-muted">Noch nie</span>;
  const d = new Date(dateStr);
  const days = Math.floor((Date.now() - d) / 86400000);
  const rel = days === 0 ? 'Heute' : days === 1 ? 'Gestern' : days < 7 ? `${days}d` : days < 30 ? `${Math.floor(days/7)}w` : d.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit' });
  return (
    <div className="ut-time">
      <span className="ut-time-rel">{rel}</span>
      <span className="ut-time-abs">{d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  );
};

const UsersTab = ({ token }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [users, setUsers]     = useState(null);
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState('all');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const r = await axios.get('/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      setUsers(r.data.users);
    } catch (e) {
      setError(e.response?.data?.message || 'Fehler beim Laden');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="ut-center">
      <div className="ut-spinner" />
      <span>Lade Benutzerdaten…</span>
    </div>
  );

  if (error) return (
    <div className="ut-error">
      <p>{error}</p>
      <button onClick={load} className="ut-retry-btn"><RefreshCw size={14} /> Erneut</button>
    </div>
  );

  if (!users) return null;

  const total    = users.userStats.total + users.dojoUsers.length;
  const actRate  = total > 0 ? Math.round((users.userStats.active / total) * 100) : 0;

  const adminFiltered = users.adminUsers.filter(u => {
    if (filter !== 'all' && u.rolle !== filter) return false;
    if (!search) return true;
    return `${u.vorname} ${u.nachname} ${u.username || ''} ${u.email || ''}`.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="ut-root">
      {/* ── KPI Row ── */}
      <div className="ut-kpi-row">
        <div className="ut-kpi ut-kpi--blue">
          <div className="ut-kpi-icon ut-kpi-icon--blue"><Users size={20} /></div>
          <div className="ut-kpi-body">
            <div className="ut-kpi-label">Gesamt</div>
            <div className="ut-kpi-val">{total}</div>
            <div className="ut-kpi-sub">
              <span className="ut-chip ut-chip--blue">{users.userStats.total} Admin</span>
              <span className="ut-chip ut-chip--dim">{users.dojoUsers.length} Dojo</span>
            </div>
          </div>
        </div>

        <div className="ut-kpi ut-kpi--green">
          <div className="ut-kpi-icon ut-kpi-icon--green"><CheckCircle size={20} /></div>
          <div className="ut-kpi-body">
            <div className="ut-kpi-label">Aktiv</div>
            <div className="ut-kpi-val">{users.userStats.active}</div>
            <div className="ut-kpi-sub">
              <span className="ut-chip ut-chip--green">{actRate}% aktiv</span>
              <span className="ut-chip ut-chip--dim">{users.activeUsers.length} in 7d</span>
            </div>
          </div>
        </div>

        <div className="ut-kpi ut-kpi--orange">
          <div className="ut-kpi-icon ut-kpi-icon--orange"><Activity size={20} /></div>
          <div className="ut-kpi-body">
            <div className="ut-kpi-label">Logins (30d)</div>
            <div className="ut-kpi-val">{users.loginStats.total_logins}</div>
            <div className="ut-kpi-sub">
              <span className="ut-chip ut-chip--orange">Ø {users.loginStats.avg_per_day}/Tag</span>
            </div>
          </div>
        </div>

        <div className="ut-kpi ut-kpi--gold">
          <div className="ut-kpi-icon ut-kpi-icon--gold"><Shield size={20} /></div>
          <div className="ut-kpi-body">
            <div className="ut-kpi-label">Super-Admins</div>
            <div className="ut-kpi-val">{users.userStats.byRole?.super_admin || 0}</div>
            <div className="ut-kpi-sub">
              <span className="ut-chip ut-chip--gold">{users.userStats.byRole?.admin || 0} Admins</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Admin Users Table ── */}
      {users.adminUsers.length > 0 && (
        <div className="ut-section">
          <div className="ut-section-head">
            <div className="ut-section-title">
              <UserCog size={17} />
              Admin-Benutzer
              <span className="ut-count">{users.adminUsers.length}</span>
            </div>
            <div className="ut-controls">
              <input
                className="ut-search"
                placeholder="Suchen…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select className="ut-filter-select" value={filter} onChange={e => setFilter(e.target.value)}>
                <option value="all">Alle Rollen</option>
                {Object.entries(ROLE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button className="ut-reload-btn" onClick={load} title="Aktualisieren"><RefreshCw size={14} /></button>
            </div>
          </div>

          <div className="ut-table-wrap">
            <table className="ut-table">
              <thead>
                <tr>
                  <th className="ut-th">Benutzer</th>
                  <th className="ut-th">E-Mail</th>
                  <th className="ut-th ut-th--center">Passwort</th>
                  <th className="ut-th">Rolle</th>
                  <th className="ut-th ut-th--center">Status</th>
                  <th className="ut-th">Letzter Login</th>
                  <th className="ut-th">Erstellt</th>
                </tr>
              </thead>
              <tbody>
                {adminFiltered.map((u, i) => {
                  const role = ROLE_CONFIG[u.rolle] || { label: u.rolle, cls: '' };
                  return (
                    <tr key={i} className={`ut-tr${!u.aktiv ? ' ut-tr--inactive' : ''}`}>
                      <td className="ut-td">
                        <div className="ut-user-cell">
                          <Avatar vorname={u.vorname} nachname={u.nachname} role={u.rolle} />
                          <div className="ut-user-info">
                            <span className="ut-user-name">{u.vorname} {u.nachname}</span>
                            {u.username && <span className="ut-user-handle">@{u.username}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="ut-td ut-td--email">{u.email || <span className="ut-muted">—</span>}</td>
                      <td className="ut-td ut-td--center">
                        {u.has_password
                          ? <span className="ut-badge ut-badge--ok"><CheckCircle size={11} /> Ja</span>
                          : <span className="ut-badge ut-badge--warn"><XCircle size={11} /> Nein</span>}
                      </td>
                      <td className="ut-td">
                        <span className={`ut-role ${role.cls}`}>{role.label}</span>
                      </td>
                      <td className="ut-td ut-td--center">
                        {u.aktiv
                          ? <span className="ut-badge ut-badge--ok"><CheckCircle size={11} /> Aktiv</span>
                          : <span className="ut-badge ut-badge--off"><XCircle size={11} /> Inaktiv</span>}
                      </td>
                      <td className="ut-td"><TimeAgo dateStr={u.letzter_login} /></td>
                      <td className="ut-td ut-td--date">{new Date(u.erstellt_am).toLocaleDateString('de-DE')}</td>
                    </tr>
                  );
                })}
                {adminFiltered.length === 0 && (
                  <tr><td colSpan={7} className="ut-empty">Keine Treffer</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Active Users (7 days) ── */}
      {users.activeUsers.length > 0 && (
        <div className="ut-section">
          <div className="ut-section-head">
            <div className="ut-section-title">
              <Activity size={17} />
              Zuletzt aktiv
              <span className="ut-count">{users.activeUsers.length}</span>
              <span className="ut-section-sub">Letzte 7 Tage</span>
            </div>
          </div>
          <div className="ut-active-grid">
            {users.activeUsers.map((u, i) => (
              <div key={i} className="ut-active-card">
                <div className="ut-ac-avatar">
                  {(u.vorname?.[0] || '?').toUpperCase()}{(u.nachname?.[0] || '?').toUpperCase()}
                </div>
                <div className="ut-ac-info">
                  <span className="ut-ac-name">{u.vorname} {u.nachname}</span>
                  <span className="ut-ac-user">@{u.username}</span>
                  <span className="ut-ac-time">
                    <Clock size={11} />
                    {u.tage_seit_login === 0 ? 'Heute' : `Vor ${u.tage_seit_login}d`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Dojo Users ── */}
      {users.dojoUsers.length > 0 && (
        <div className="ut-section">
          <div className="ut-section-head">
            <div className="ut-section-title">
              <Users size={17} />
              Dojo-Administratoren
              <span className="ut-count">{users.dojoUsers.length}</span>
            </div>
          </div>
          <div className="ut-dojo-groups">
            {Object.entries(users.usersByDojo).map(([name, list], i) => (
              <div key={i} className="ut-dojo-group">
                <div className="ut-dojo-group-title">{name} <span className="ut-count">{list.length}</span></div>
                <div className="ut-table-wrap">
                  <table className="ut-table ut-table--compact">
                    <thead>
                      <tr>
                        <th className="ut-th">Benutzername</th>
                        <th className="ut-th">E-Mail</th>
                        <th className="ut-th ut-th--center">Passwort</th>
                        <th className="ut-th">Aktivität (30d)</th>
                        <th className="ut-th">Erstellt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((u, j) => (
                        <tr key={j} className="ut-tr">
                          <td className="ut-td ut-td--mono">{u.benutzername}</td>
                          <td className="ut-td ut-td--email">{u.email || <span className="ut-muted">—</span>}</td>
                          <td className="ut-td ut-td--center">
                            {u.has_password
                              ? <span className="ut-badge ut-badge--ok">Ja</span>
                              : <span className="ut-badge ut-badge--warn">Nein</span>}
                          </td>
                          <td className="ut-td">
                            {u.activity_last_30_days > 0
                              ? <span className="ut-badge ut-badge--ok">{u.activity_last_30_days} Aktionen</span>
                              : <span className="ut-muted">Keine</span>}
                          </td>
                          <td className="ut-td ut-td--date">{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
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

      {/* ── Activity Log ── */}
      {users.recentActivity.length > 0 && (
        <div className="ut-section">
          <div className="ut-section-head">
            <div className="ut-section-title">
              <Activity size={17} />
              Letzte Aktivitäten
              <span className="ut-count">50</span>
            </div>
          </div>
          <div className="ut-log">
            {users.recentActivity.map((a, i) => (
              <div key={i} className="ut-log-row">
                <div className="ut-log-dot" />
                <div className="ut-log-body">
                  <span className="ut-log-user">{a.username}</span>
                  <span className="ut-log-action">{a.aktion}</span>
                  {a.bereich && <span className="ut-log-scope">in {a.bereich}</span>}
                  {a.beschreibung && <span className="ut-log-desc">{a.beschreibung}</span>}
                </div>
                <span className="ut-log-time">{new Date(a.erstellt_am).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersTab;
