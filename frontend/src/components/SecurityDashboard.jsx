import React, { useState, useEffect } from 'react';
import {
  Shield, AlertTriangle, AlertCircle, CheckCircle, Ban, Unlock,
  RefreshCw, Filter, Clock, Globe, Activity, TrendingUp, Eye
} from 'lucide-react';
import '../styles/SecurityDashboard.css';

const SecurityDashboard = () => {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [blockedIPs, setBlockedIPs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [filters, setFilters] = useState({
    severity: '',
    alert_type: '',
    resolved: ''
  });
  const [alertTypes, setAlertTypes] = useState([]);
  const [severities, setSeverities] = useState([]);

  useEffect(() => {
    loadData();
    loadAlertTypes();
  }, []);

  useEffect(() => {
    if (activeTab === 'alerts') {
      loadAlerts();
    }
  }, [activeTab, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const headers = { 'Authorization': `Bearer ${token}` };

      const [statsRes, alertsRes, ipsRes] = await Promise.all([
        fetch('/api/security/stats?days=7', { headers }),
        fetch('/api/security/alerts?limit=10', { headers }),
        fetch('/api/security/blocked-ips', { headers })
      ]);

      const statsData = await statsRes.json();
      const alertsData = await alertsRes.json();
      const ipsData = await ipsRes.json();

      if (statsData.success) setStats(statsData.stats);
      if (alertsData.success) setAlerts(alertsData.alerts);
      if (ipsData.success) setBlockedIPs(ipsData.blockedIPs);
    } catch (error) {
      console.error('Fehler beim Laden der Security-Daten:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAlerts = async () => {
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const params = new URLSearchParams();
      params.append('limit', '50');
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.alert_type) params.append('alert_type', filters.alert_type);
      if (filters.resolved !== '') params.append('resolved', filters.resolved);

      const response = await fetch(`/api/security/alerts?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setAlerts(data.alerts);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Alerts:', error);
    }
  };

  const loadAlertTypes = async () => {
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const response = await fetch('/api/security/alert-types', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setAlertTypes(data.alertTypes);
        setSeverities(data.severities);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Alert-Typen:', error);
    }
  };

  const resolveAlert = async (alertId) => {
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const response = await fetch(`/api/security/alerts/${alertId}/resolve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setAlerts(prev => prev.map(a =>
          a.id === alertId ? { ...a, resolved: true } : a
        ));
      }
    } catch (error) {
      console.error('Fehler beim Lösen des Alerts:', error);
    }
  };

  const unblockIP = async (ip) => {
    if (!window.confirm(`IP ${ip} wirklich entsperren?`)) return;

    try {
      const token = localStorage.getItem('dojo_auth_token');
      const response = await fetch(`/api/security/unblock-ip/${encodeURIComponent(ip)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setBlockedIPs(prev => prev.filter(b => b.ip_address !== ip));
      }
    } catch (error) {
      console.error('Fehler beim Entsperren der IP:', error);
    }
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: '#ef4444',
      high: '#f97316',
      medium: '#f59e0b',
      low: '#22c55e'
    };
    return colors[severity] || '#6b7280';
  };

  const getSeverityLabel = (severity) => {
    const labels = {
      critical: 'Kritisch',
      high: 'Hoch',
      medium: 'Mittel',
      low: 'Niedrig'
    };
    return labels[severity] || severity;
  };

  const getAlertTypeLabel = (type) => {
    const found = alertTypes.find(t => t.value === type);
    return found ? found.label : type;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="security-dashboard loading">
        <RefreshCw className="spin" size={32} />
        <p>Lade Sicherheitsdaten...</p>
      </div>
    );
  }

  return (
    <div className="security-dashboard">
      <div className="security-header">
        <div className="header-title">
          <Shield size={32} />
          <div>
            <h1>Sicherheits-Dashboard</h1>
            <p>Angriffserkennung und Monitoring</p>
          </div>
        </div>
        <button className="btn-refresh" onClick={loadData}>
          <RefreshCw size={18} />
          Aktualisieren
        </button>
      </div>

      {/* Tabs */}
      <div className="security-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Activity size={18} />
          Übersicht
        </button>
        <button
          className={`tab ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          <AlertTriangle size={18} />
          Alle Warnungen
          {stats?.summary?.unresolved > 0 && (
            <span className="badge">{stats.summary.unresolved}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'blocked' ? 'active' : ''}`}
          onClick={() => setActiveTab('blocked')}
        >
          <Ban size={18} />
          Blockierte IPs
          {blockedIPs.length > 0 && (
            <span className="badge">{blockedIPs.length}</span>
          )}
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <div className="overview-content">
          {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon total">
                <Activity size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{stats.summary?.total_alerts || 0}</span>
                <span className="stat-label">Ereignisse (7 Tage)</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon warning">
                <AlertTriangle size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{stats.summary?.unresolved || 0}</span>
                <span className="stat-label">Ungelöst</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon critical">
                <AlertCircle size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{stats.summary?.critical_count || 0}</span>
                <span className="stat-label">Kritisch</span>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blocked">
                <Ban size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{stats.summary?.blocked_count || 0}</span>
                <span className="stat-label">Blockiert</span>
              </div>
            </div>
          </div>

          {/* Ungelöste kritische Alerts */}
          {stats.unresolvedCritical?.length > 0 && (
            <div className="critical-alerts-section">
              <h3>
                <AlertCircle size={20} />
                Kritische Warnungen
              </h3>
              <div className="alert-list">
                {stats.unresolvedCritical.slice(0, 5).map(alert => (
                  <div key={alert.id} className={`alert-item severity-${alert.severity}`}>
                    <div className="alert-badge" style={{ background: getSeverityColor(alert.severity) }}>
                      {getSeverityLabel(alert.severity)}
                    </div>
                    <div className="alert-content">
                      <span className="alert-type">{getAlertTypeLabel(alert.alert_type)}</span>
                      <span className="alert-desc">{alert.description}</span>
                      <span className="alert-meta">
                        <Globe size={12} /> {alert.ip_address || 'Unbekannt'}
                        <Clock size={12} /> {formatDate(alert.created_at)}
                      </span>
                    </div>
                    {!alert.resolved && (
                      <button
                        className="btn-resolve"
                        onClick={() => resolveAlert(alert.id)}
                        title="Als gelöst markieren"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Alerts nach Typ */}
          {stats.alertsByType?.length > 0 && (
            <div className="alerts-by-type">
              <h3>
                <TrendingUp size={20} />
                Ereignisse nach Typ (7 Tage)
              </h3>
              <div className="type-grid">
                {stats.alertsByType.map((item, idx) => (
                  <div key={idx} className="type-item">
                    <span className="type-name">{getAlertTypeLabel(item.alert_type)}</span>
                    <span className="type-count">{item.count}</span>
                    <span
                      className="type-severity"
                      style={{ color: getSeverityColor(item.severity) }}
                    >
                      {getSeverityLabel(item.severity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keine Alerts */}
          {(!stats.alertsByType || stats.alertsByType.length === 0) && (
            <div className="no-alerts">
              <CheckCircle size={48} />
              <h3>Alles in Ordnung!</h3>
              <p>Keine Sicherheitsereignisse in den letzten 7 Tagen.</p>
            </div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="alerts-content">
          {/* Filter */}
          <div className="alerts-filter">
            <Filter size={18} />
            <select
              value={filters.severity}
              onChange={e => setFilters(prev => ({ ...prev, severity: e.target.value }))}
            >
              <option value="">Alle Schweregrade</option>
              {severities.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={filters.alert_type}
              onChange={e => setFilters(prev => ({ ...prev, alert_type: e.target.value }))}
            >
              <option value="">Alle Typen</option>
              {alertTypes.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={filters.resolved}
              onChange={e => setFilters(prev => ({ ...prev, resolved: e.target.value }))}
            >
              <option value="">Alle</option>
              <option value="false">Ungelöst</option>
              <option value="true">Gelöst</option>
            </select>
          </div>

          {/* Alert List */}
          <div className="full-alert-list">
            {alerts.length === 0 ? (
              <div className="no-alerts">
                <CheckCircle size={32} />
                <p>Keine Warnungen gefunden</p>
              </div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className={`alert-item severity-${alert.severity} ${alert.resolved ? 'resolved' : ''}`}>
                  <div className="alert-badge" style={{ background: getSeverityColor(alert.severity) }}>
                    {getSeverityLabel(alert.severity)}
                  </div>
                  <div className="alert-content">
                    <span className="alert-type">{getAlertTypeLabel(alert.alert_type)}</span>
                    <span className="alert-desc">{alert.description}</span>
                    <span className="alert-meta">
                      <Globe size={12} /> {alert.ip_address || 'Unbekannt'}
                      <Clock size={12} /> {formatDate(alert.created_at)}
                      {alert.request_path && (
                        <>
                          <Eye size={12} /> {alert.request_path.substring(0, 50)}
                        </>
                      )}
                    </span>
                  </div>
                  <div className="alert-actions">
                    {alert.resolved ? (
                      <span className="resolved-badge">
                        <CheckCircle size={14} /> Gelöst
                      </span>
                    ) : (
                      <button
                        className="btn-resolve"
                        onClick={() => resolveAlert(alert.id)}
                        title="Als gelöst markieren"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Blocked IPs Tab */}
      {activeTab === 'blocked' && (
        <div className="blocked-content">
          {blockedIPs.length === 0 ? (
            <div className="no-alerts">
              <Unlock size={32} />
              <p>Keine IPs blockiert</p>
            </div>
          ) : (
            <div className="blocked-list">
              {blockedIPs.map(ip => (
                <div key={ip.id} className="blocked-item">
                  <div className="blocked-icon">
                    <Ban size={20} />
                  </div>
                  <div className="blocked-info">
                    <span className="blocked-ip">{ip.ip_address}</span>
                    <span className="blocked-reason">{ip.reason}</span>
                    <span className="blocked-meta">
                      Blockiert seit: {formatDate(ip.created_at)}
                      {ip.blocked_until && !ip.permanent && (
                        <> | Bis: {formatDate(ip.blocked_until)}</>
                      )}
                      {ip.permanent && <> | <strong>Permanent</strong></>}
                      {ip.alert_count && <> | {ip.alert_count} Ereignisse</>}
                    </span>
                  </div>
                  <button
                    className="btn-unblock"
                    onClick={() => unblockIP(ip.ip_address)}
                    title="IP entsperren"
                  >
                    <Unlock size={16} />
                    Entsperren
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SecurityDashboard;
