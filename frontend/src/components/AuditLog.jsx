import React, { useState, useEffect, useCallback } from 'react';
import { History, Search, Filter, RefreshCw, User, Calendar, ChevronDown, ChevronUp, Eye, Trash2, AlertTriangle } from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/AuditLog.css';

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [kategorien, setKategorien] = useState([]);
  const [error, setError] = useState(null);

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

  // Selection & delete
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBereinigenModal, setShowBereinigenModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [vorschauAnzahl, setVorschauAnzahl] = useState(null);
  const [vorschauLoading, setVorschauLoading] = useState(false);
  const [benutzerListe, setBenutzerListe] = useState([]);
  const [bereinigenError, setBereinigenError] = useState('');

  // Bereinigen-Filter
  const [bFilter, setBFilter] = useState({
    modus: '',        // 'auswahl' | 'filter' | 'alle'
    user_id: '',
    user_email: '',
    kategorie: '',
    aktion: '',
    ip_adresse: '',
    entity_type: '',
    entity_id: '',
    von_datum: '',
    bis_datum: '',
    alter_tage: ''
  });

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

  const [aktionen, setAktionen] = useState([]);
  const [entityTypes, setEntityTypes] = useState([]);

  // Load kategorien + benutzer + aktionen + entity-types
  useEffect(() => {
    loadKategorien();
    loadBenutzer();
    loadAktionen();
    loadEntityTypes();
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

  const loadBenutzer = async () => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/audit-log/users`);
      if (res.ok) {
        const data = await res.json();
        setBenutzerListe(data.data || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Benutzer:', err);
    }
  };

  const loadAktionen = async () => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/audit-log/aktionen`);
      if (res.ok) {
        const data = await res.json();
        // AKTION ist ein Objekt { KEY: 'VALUE' } → Array der Values
        const vals = Object.values(data.data || {});
        setAktionen(vals);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Aktionen:', err);
    }
  };

  const loadEntityTypes = async () => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/audit-log/entity-types`);
      if (res.ok) {
        const data = await res.json();
        setEntityTypes(data.data || []);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Entity-Types:', err);
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
        setError(null);
        if (reset) {
          setLogs(data.data || []);
          setOffset(limit);
        } else {
          setLogs(prev => [...prev, ...(data.data || [])]);
          setOffset(prev => prev + limit);
        }
        setHasMore((data.data || []).length === limit);
      } else {
        const errText = await response.text().catch(() => '');
        let errMsg = `Fehler ${response.status}`;
        try {
          const errJson = JSON.parse(errText);
          errMsg = errJson.error || errJson.message || errMsg;
        } catch { errMsg = errText || errMsg; }
        setError(errMsg);
        console.error('Audit-Log API Fehler:', response.status, errMsg);
      }
    } catch (err) {
      setError('Netzwerkfehler - Server nicht erreichbar');
      console.error('Fehler beim Laden der Logs:', err);
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

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.map(l => l.id)));
    }
  };

  const deleteSingle = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Diesen Eintrag wirklich löschen?')) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/audit-log/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setLogs(prev => prev.filter(l => l.id !== id));
        setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      }
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
    }
  };

  const setBF = (key, val) => {
    setBFilter(prev => ({ ...prev, [key]: val }));
    setVorschauAnzahl(null);
  };

  const buildBereinigenBody = () => {
    if (bFilter.modus === 'auswahl') return { ids: [...selectedIds] };
    if (bFilter.modus === 'alle') return { alle: true };
    // modus === 'filter': sammle gesetzte Felder
    const body = {};
    // Benutzer: per user_email filtern (deckt auch Einträge ohne user_id ab)
    if (bFilter.user_email) body.user_email = bFilter.user_email;
    if (bFilter.kategorie) body.kategorie = bFilter.kategorie;
    if (bFilter.aktion) body.aktion = bFilter.aktion;
    if (bFilter.ip_adresse) body.ip_adresse = bFilter.ip_adresse;
    if (bFilter.entity_type) body.entity_type = bFilter.entity_type;
    if (bFilter.entity_id) body.entity_id = bFilter.entity_id;
    if (bFilter.von_datum) body.von_datum = bFilter.von_datum;
    if (bFilter.bis_datum) body.bis_datum = bFilter.bis_datum;
    if (bFilter.alter_tage) body.alter_tage = bFilter.alter_tage;
    return body;
  };

  const ladeVorschau = async () => {
    setVorschauLoading(true);
    setBereinigenError('');
    try {
      const body = buildBereinigenBody();
      const res = await fetchWithAuth(`${config.apiBaseUrl}/audit-log/bereinigen/vorschau`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setVorschauAnzahl(data.anzahl);
      } else {
        setBereinigenError(data.error || 'Vorschau fehlgeschlagen');
      }
    } catch (err) {
      setBereinigenError('Netzwerkfehler bei Vorschau');
    } finally {
      setVorschauLoading(false);
    }
  };

  const doBereinigen = async () => {
    setDeleteLoading(true);
    setBereinigenError('');
    try {
      const body = buildBereinigenBody();
      const res = await fetchWithAuth(`${config.apiBaseUrl}/audit-log/bereinigen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        setShowBereinigenModal(false);
        setSelectedIds(new Set());
        setConfirmText('');
        setVorschauAnzahl(null);
        setBFilter({ modus: '', user_email: '', kategorie: '', aktion: '', ip_adresse: '', entity_type: '', entity_id: '', von_datum: '', bis_datum: '', alter_tage: '' });
        loadLogs(true);
        loadStats();
      } else {
        setBereinigenError(data.error || 'Löschen fehlgeschlagen');
      }
    } catch (err) {
      setBereinigenError('Netzwerkfehler beim Löschen');
    } finally {
      setDeleteLoading(false);
    }
  };

  const openBereinigen = (preMode = '') => {
    setBFilter({ modus: preMode, user_email: '', kategorie: '', aktion: '', ip_adresse: '', entity_type: '', entity_id: '', von_datum: '', bis_datum: '', alter_tage: '' });
    setConfirmText('');
    setVorschauAnzahl(null);
    setBereinigenError('');
    setShowBereinigenModal(true);
  };

  const filterHasValues = () => {
    if (bFilter.modus === 'auswahl') return selectedIds.size > 0;
    if (bFilter.modus === 'alle') return true;
    if (bFilter.modus !== 'filter') return false;
    return !!(bFilter.user_email || bFilter.kategorie ||
              bFilter.aktion || bFilter.ip_adresse ||
              bFilter.entity_type || bFilter.entity_id ||
              bFilter.von_datum || bFilter.bis_datum || bFilter.alter_tage);
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
          {selectedIds.size > 0 && (
            <button className="delete-selection-btn" onClick={() => openBereinigen('auswahl')}>
              <Trash2 size={16} />
              {selectedIds.size} löschen
            </button>
          )}
          <button className="bereinigen-btn" onClick={() => openBereinigen()}>
            <Trash2 size={18} />
            Bereinigen
          </button>
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
              <th className="checkbox-col">
                <input
                  type="checkbox"
                  checked={logs.length > 0 && selectedIds.size === logs.length}
                  onChange={toggleSelectAll}
                  title="Alle auswählen"
                />
              </th>
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
              <tr
                key={log.id}
                onClick={() => setSelectedLog(log)}
                className={selectedIds.has(log.id) ? 'row-selected' : ''}
              >
                <td className="checkbox-col" onClick={(e) => { e.stopPropagation(); toggleSelect(log.id); }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(log.id)}
                    onChange={() => toggleSelect(log.id)}
                  />
                </td>
                <td className="time-cell">
                  <Calendar size={14} />
                  {formatDate(log.created_at)}
                </td>
                <td>
                  <span
                    className="kategorie-badge"
                    style={{ '--badge-bg': kategorieColors[log.kategorie] || '#6b7280' }}
                  >
                    {kategorieIcons[log.kategorie] || '📋'} {log.kategorie}
                  </span>
                </td>
                <td className="aktion-cell">
                  {formatAktion(log.aktion)}{' '}
                  <span className="aktion-raw">{log.aktion}</span>
                </td>
                <td className="user-cell">
                  <User size={14} />
                  {log.user_name || log.user_email || 'System'}
                </td>
                <td className="entity-cell">
                  {log.entity_type && log.entity_id
                    ? <>{log.entity_name || log.entity_type}{' '}<span className="entity-id-suffix">#{log.entity_id}</span></>
                    : '-'}
                </td>
                <td className="beschreibung-cell" title={log.beschreibung}>
                  {log.beschreibung?.substring(0, 50) || renderJsonPreview(log.neue_werte)}
                  {log.beschreibung?.length > 50 ? '...' : ''}
                </td>
                <td className="actions-col">
                  <button className="view-btn" title="Details" onClick={(e) => { e.stopPropagation(); setSelectedLog(log); }}>
                    <Eye size={16} />
                  </button>
                  <button className="delete-row-btn" title="Löschen" onClick={(e) => deleteSingle(log.id, e)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {error && !loading && (
          <div className="empty-state empty-state--error">
            <AlertTriangle size={48} />
            <p className="error-heading">Fehler beim Laden der Audit-Logs</p>
            <p className="error-detail">{error}</p>
            <button className="refresh-btn" onClick={() => { setError(null); loadLogs(true); }}>
              <RefreshCw size={16} /> Erneut versuchen
            </button>
          </div>
        )}

        {logs.length === 0 && !loading && !error && (
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

      {/* Bereinigen Modal */}
      {showBereinigenModal && (
        <div className="modal-overlay" onClick={() => setShowBereinigenModal(false)}>
          <div className="modal-content bereinigen-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><AlertTriangle size={20} color="#ef4444" /> Audit-Log bereinigen</h3>
              <button className="close-btn" onClick={() => setShowBereinigenModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p className="bereinigen-warning">
                Gelöschte Einträge können <strong>nicht wiederhergestellt</strong> werden.
              </p>

              {/* Modus-Wahl */}
              <div className="bereinigen-section">
                <label className="bereinigen-section-label">Löschmodus</label>
                <div className="bereinigen-modus-row">
                  {selectedIds.size > 0 && (
                    <button
                      className={`modus-btn ${bFilter.modus === 'auswahl' ? 'active' : ''}`}
                      onClick={() => setBF('modus', 'auswahl')}
                    >
                      Auswahl ({selectedIds.size})
                    </button>
                  )}
                  <button
                    className={`modus-btn ${bFilter.modus === 'filter' ? 'active' : ''}`}
                    onClick={() => setBF('modus', 'filter')}
                  >
                    Nach Filter
                  </button>
                  <button
                    className={`modus-btn danger ${bFilter.modus === 'alle' ? 'active' : ''}`}
                    onClick={() => setBF('modus', 'alle')}
                  >
                    Alle löschen
                  </button>
                </div>
              </div>

              {/* Filter-Optionen (nur bei modus=filter) */}
              {bFilter.modus === 'filter' && (
                <div className="bereinigen-section">
                  <label className="bereinigen-section-label">Filter (kombinierbar — AND-Verknüpfung)</label>
                  <div className="bereinigen-filter-grid">

                    <div className="bf-group">
                      <label>Benutzer</label>
                      <select value={bFilter.user_email} onChange={(e) => setBF('user_email', e.target.value)}>
                        <option value="">— Alle Benutzer —</option>
                        {benutzerListe.map(u => (
                          <option key={u.user_email} value={u.user_email}>
                            {u.user_name || u.user_email} ({u.user_role}) — {u.anzahl_logs} Einträge
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bf-group">
                      <label>Kategorie</label>
                      <select value={bFilter.kategorie} onChange={(e) => setBF('kategorie', e.target.value)}>
                        <option value="">— Alle —</option>
                        {kategorien.map(k => (
                          <option key={k.value} value={k.value}>{k.icon} {k.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="bf-group">
                      <label>Aktion</label>
                      <select value={bFilter.aktion} onChange={(e) => setBF('aktion', e.target.value)}>
                        <option value="">— Alle Aktionen —</option>
                        {aktionen.map(a => (
                          <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>

                    <div className="bf-group">
                      <label>IP-Adresse (enthält)</label>
                      <input
                        type="text"
                        placeholder="z.B. 192.168.1"
                        value={bFilter.ip_adresse}
                        onChange={(e) => setBF('ip_adresse', e.target.value)}
                      />
                    </div>

                    <div className="bf-group">
                      <label>Betroffener Datensatz (Typ)</label>
                      <select value={bFilter.entity_type} onChange={(e) => setBF('entity_type', e.target.value)}>
                        <option value="">— Alle Typen —</option>
                        {entityTypes.map(et => (
                          <option key={et.entity_type} value={et.entity_type}>
                            {et.entity_type} ({et.anzahl})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bf-group">
                      <label>Betroffener Datensatz (ID)</label>
                      <input
                        type="number"
                        placeholder="z.B. 42"
                        min="1"
                        value={bFilter.entity_id}
                        onChange={(e) => setBF('entity_id', e.target.value)}
                      />
                    </div>

                    <div className="bf-group">
                      <label>Von Datum</label>
                      <input type="date" value={bFilter.von_datum} onChange={(e) => setBF('von_datum', e.target.value)} />
                    </div>

                    <div className="bf-group">
                      <label>Bis Datum</label>
                      <input type="date" value={bFilter.bis_datum} onChange={(e) => setBF('bis_datum', e.target.value)} />
                    </div>

                    <div className="bf-group">
                      <label>Älter als (Tage)</label>
                      <div className="alter-tage-row">
                        <input
                          type="number"
                          placeholder="z.B. 90"
                          min="1"
                          value={bFilter.alter_tage}
                          onChange={(e) => setBF('alter_tage', e.target.value)}
                        />
                        <div className="alter-shortcuts">
                          {[30, 60, 90, 180, 365].map(d => (
                            <button key={d} className="shortcut-btn" onClick={() => setBF('alter_tage', String(d))}>
                              {d}d
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Vorschau */}
              {bFilter.modus && filterHasValues() && (
                <div className="bereinigen-section">
                  <div className="vorschau-row">
                    <button className="vorschau-btn" onClick={ladeVorschau} disabled={vorschauLoading}>
                      {vorschauLoading ? <RefreshCw size={14} className="spinning" /> : '🔍'}
                      Vorschau
                    </button>
                    {vorschauAnzahl !== null && (
                      <span className={`vorschau-result ${vorschauAnzahl > 0 ? 'has-entries' : ''}`}>
                        {vorschauAnzahl === 0
                          ? 'Keine Einträge betroffen'
                          : <><strong>{vorschauAnzahl}</strong> Einträge werden gelöscht</>
                        }
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Bestätigung */}
              {bFilter.modus && filterHasValues() && (
                <div className="bereinigen-confirm">
                  <label>Zur Bestätigung <strong>LÖSCHEN</strong> eingeben:</label>
                  <input
                    type="text"
                    placeholder="LÖSCHEN"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="confirm-input"
                  />
                </div>
              )}

              {bereinigenError && (
                <div className="bereinigen-error">{bereinigenError}</div>
              )}

              <div className="modal-footer-actions">
                <button className="cancel-btn" onClick={() => setShowBereinigenModal(false)}>Abbrechen</button>
                <button
                  className="delete-confirm-btn"
                  onClick={doBereinigen}
                  disabled={deleteLoading || !bFilter.modus || !filterHasValues() || confirmText !== 'LÖSCHEN'}
                >
                  {deleteLoading ? <RefreshCw size={16} className="spinning" /> : <Trash2 size={16} />}
                  Jetzt löschen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                    style={{ '--badge-bg': kategorieColors[selectedLog.kategorie] || '#6b7280' }}
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
