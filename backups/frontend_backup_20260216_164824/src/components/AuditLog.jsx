import React, { useState, useEffect, useCallback } from 'react';
import { History, Search, Filter, RefreshCw, User, Calendar, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/AuditLog.css';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [kategorien, setKategorien] = useState([]);

  // Filter state
  const [filters, setFilters] = useState({
    kategorie: '',
    suchbegriff: '',
    von_datum: '',
    bis_datum: ''
  });
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 50;

  // Detail view
  const [selectedLog, setSelectedLog] = useState(null);

  // Kategorie Icons
  const kategorieIcons = {
    MITGLIED: '👤',
    FINANZEN: '💰',
    VERTRAG: '📄',
    PRUEFUNG: '🥋',
    ADMIN: '⚙️',
    SEPA: '🏦',
    DOKUMENT: '📁',
    SYSTEM: '🖥️',
    AUTH: '🔐'
  };

  // Kategorie Farben
  const kategorieColors = {
    MITGLIED: '#3b82f6',
    FINANZEN: '#10b981',
    VERTRAG: '#8b5cf6',
    PRUEFUNG: '#f59e0b',
    ADMIN: '#6366f1',
    SEPA: '#14b8a6',
    DOKUMENT: '#ec4899',
    SYSTEM: '#6b7280',
    AUTH: '#ef4444'
  };

  // Load kategorien
  useEffect(() => {
    loadKategorien();
  }, []);

  // Load logs when filters change
  useEffect(() => {
    loadLogs(true);
  }, [filters]);

  const loadKategorien = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/audit-log/kategorien`);
      if (response.ok) {
        const data = await response.json();
        setKategorien(data.data || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Kategorien:', error);
    }
  };

  const loadLogs = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const currentOffset = reset ? 0 : offset;
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: currentOffset.toString()
      });

      if (filters.kategorie) params.append('kategorie', filters.kategorie);
      if (filters.suchbegriff) params.append('suchbegriff', filters.suchbegriff);
      if (filters.von_datum) params.append('von_datum', filters.von_datum);
      if (filters.bis_datum) params.append('bis_datum', filters.bis_datum);

      const response = await fetchWithAuth(`${config.apiBaseUrl}/audit-log?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (reset) {
          setLogs(data.data || []);
          setOffset(limit);
        } else {
          setLogs(prev => [...prev, ...(data.data || [])]);
          setOffset(prev => prev + limit);
        }
        setHasMore((data.data || []).length === limit);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Logs:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, offset]);

  const loadStats = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/audit-log/stats?tage=30`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Statistiken:', error);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAktion = (aktion) => {
    return aktion
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^\w/, c => c.toUpperCase());
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setOffset(0);
  };

  const clearFilters = () => {
    setFilters({
      kategorie: '',
      suchbegriff: '',
      von_datum: '',
      bis_datum: ''
    });
    setOffset(0);
  };

  const renderJsonPreview = (json) => {
    if (!json) return '-';
    try {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json;
      const keys = Object.keys(parsed);
      if (keys.length === 0) return '-';
      return keys.slice(0, 3).map(k => `${k}: ${parsed[k]}`).join(', ') + (keys.length > 3 ? '...' : '');
    } catch {
      return String(json).substring(0, 50);
    }
  };

  return (
    <div className="audit-log-container">
      <div className="audit-log-header">
        <div className="header-title">
          <History size={24} />
          <h2>Audit-Log</h2>
        </div>
        <div className="header-actions">
          <button
            className={`filter-toggle ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            Filter
            {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button className="refresh-btn" onClick={() => loadLogs(true)} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="audit-stats">
          <div className="stat-card">
            <span className="stat-label">Letzte 30 Tage</span>
            <span className="stat-value">
              {stats.stats?.reduce((sum, s) => sum + s.anzahl, 0) || 0}
            </span>
            <span className="stat-sub">Aktionen</span>
          </div>
          {stats.stats?.slice(0, 4).map((stat, idx) => (
            <div key={idx} className="stat-card mini">
              <span className="stat-icon">{kategorieIcons[stat.kategorie] || '📋'}</span>
              <span className="stat-value">{stat.anzahl}</span>
              <span className="stat-label">{formatAktion(stat.aktion)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <div className="filter-panel">
          <div className="filter-row">
            <div className="filter-group">
              <label>Suche</label>
              <div className="search-input">
                <Search size={16} />
                <input
                  type="text"
                  placeholder="Name, Email, Beschreibung..."
                  value={filters.suchbegriff}
                  onChange={(e) => handleFilterChange('suchbegriff', e.target.value)}
                />
              </div>
            </div>

            <div className="filter-group">
              <label>Kategorie</label>
              <select
                value={filters.kategorie}
                onChange={(e) => handleFilterChange('kategorie', e.target.value)}
              >
                <option value="">Alle Kategorien</option>
                {kategorien.map(kat => (
                  <option key={kat.value} value={kat.value}>
                    {kat.icon} {kat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label>Von</label>
              <input
                type="date"
                value={filters.von_datum}
                onChange={(e) => handleFilterChange('von_datum', e.target.value)}
              />
            </div>

            <div className="filter-group">
              <label>Bis</label>
              <input
                type="date"
                value={filters.bis_datum}
                onChange={(e) => handleFilterChange('bis_datum', e.target.value)}
              />
            </div>

            <button className="clear-filters" onClick={clearFilters}>
              Filter zurücksetzen
            </button>
          </div>
        </div>
      )}

      {/* Log Table */}
      <div className="audit-table-container">
        <table className="audit-table">
          <thead>
            <tr>
              <th>Zeitpunkt</th>
              <th>Kategorie</th>
              <th>Aktion</th>
              <th>Benutzer</th>
              <th>Betroffener Datensatz</th>
              <th>Beschreibung</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} onClick={() => setSelectedLog(log)}>
                <td className="time-cell">
                  <Calendar size={14} />
                  {formatDate(log.created_at)}
                </td>
                <td>
                  <span
                    className="kategorie-badge"
                    style={{ backgroundColor: kategorieColors[log.kategorie] || '#6b7280' }}
                  >
                    {kategorieIcons[log.kategorie] || '📋'} {log.kategorie}
                  </span>
                </td>
                <td className="aktion-cell">{formatAktion(log.aktion)}</td>
                <td className="user-cell">
                  <User size={14} />
                  {log.user_name || log.user_email || 'System'}
                </td>
                <td className="entity-cell">
                  {log.entity_name || (log.entity_type && log.entity_id ? `${log.entity_type} #${log.entity_id}` : '-')}
                </td>
                <td className="beschreibung-cell" title={log.beschreibung}>
                  {log.beschreibung?.substring(0, 50) || renderJsonPreview(log.neue_werte)}
                  {log.beschreibung?.length > 50 ? '...' : ''}
                </td>
                <td>
                  <button className="view-btn" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}>
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {logs.length === 0 && !loading && (
          <div className="empty-state">
            <History size={48} />
            <p>Keine Log-Einträge gefunden</p>
          </div>
        )}

        {loading && (
          <div className="loading-state">
            <RefreshCw size={24} className="spinning" />
            <p>Lade Logs...</p>
          </div>
        )}

        {hasMore && !loading && logs.length > 0 && (
          <button className="load-more" onClick={() => loadLogs(false)}>
            Weitere laden
          </button>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {kategorieIcons[selectedLog.kategorie]} Log-Details
              </h3>
              <button className="close-btn" onClick={() => setSelectedLog(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Zeitpunkt</label>
                  <span>{formatDate(selectedLog.created_at)}</span>
                </div>
                <div className="detail-item">
                  <label>Kategorie</label>
                  <span
                    className="kategorie-badge"
                    style={{ backgroundColor: kategorieColors[selectedLog.kategorie] }}
                  >
                    {kategorieIcons[selectedLog.kategorie]} {selectedLog.kategorie}
                  </span>
                </div>
                <div className="detail-item">
                  <label>Aktion</label>
                  <span>{formatAktion(selectedLog.aktion)}</span>
                </div>
                <div className="detail-item">
                  <label>Benutzer</label>
                  <span>
                    {selectedLog.user_name || '-'}<br />
                    <small>{selectedLog.user_email || '-'}</small><br />
                    <small>Rolle: {selectedLog.user_role || '-'}</small>
                  </span>
                </div>
                <div className="detail-item">
                  <label>Dojo</label>
                  <span>{selectedLog.dojo_name || `Dojo #${selectedLog.dojo_id}` || '-'}</span>
                </div>
                <div className="detail-item">
                  <label>Betroffener Datensatz</label>
                  <span>
                    {selectedLog.entity_type || '-'} #{selectedLog.entity_id || '-'}<br />
                    <small>{selectedLog.entity_name || '-'}</small>
                  </span>
                </div>
                <div className="detail-item full-width">
                  <label>Beschreibung</label>
                  <span>{selectedLog.beschreibung || '-'}</span>
                </div>
                {selectedLog.alte_werte && (
                  <div className="detail-item full-width">
                    <label>Alte Werte</label>
                    <pre className="json-display">
                      {JSON.stringify(
                        typeof selectedLog.alte_werte === 'string'
                          ? JSON.parse(selectedLog.alte_werte)
                          : selectedLog.alte_werte,
                        null, 2
                      )}
                    </pre>
                  </div>
                )}
                {selectedLog.neue_werte && (
                  <div className="detail-item full-width">
                    <label>Neue Werte</label>
                    <pre className="json-display">
                      {JSON.stringify(
                        typeof selectedLog.neue_werte === 'string'
                          ? JSON.parse(selectedLog.neue_werte)
                          : selectedLog.neue_werte,
                        null, 2
                      )}
                    </pre>
                  </div>
                )}
                <div className="detail-item">
                  <label>IP-Adresse</label>
                  <span>{selectedLog.ip_adresse || '-'}</span>
                </div>
                <div className="detail-item">
                  <label>Request</label>
                  <span>{selectedLog.request_method} {selectedLog.request_path || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
