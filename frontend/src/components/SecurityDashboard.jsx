import React, { useState, useEffect } from 'react';
import {
  Shield, AlertTriangle, AlertCircle, CheckCircle, Ban, Unlock,
  RefreshCw, Filter, Clock, Globe, Activity, TrendingUp, Eye,
  Info, ChevronDown, ChevronUp
} from 'lucide-react';
import '../styles/SecurityDashboard.css';

// ── Erklärungen zu jedem Alert-Typ ───────────────────────────────────────────
const ALERT_TYPE_INFO = {
  unauthorized_access: {
    icon: '🔒',
    kurzinfo: 'HTTP 401/403 – Zugriff verweigert',
    beschreibung:
      'Der Server hat eine Anfrage mit "Nicht autorisiert" (401) oder "Verboten" (403) abgewiesen. ' +
      'Das passiert z. B. wenn ein Nutzer auf eine Funktion zugreift, die für sein Abo-Level nicht freigeschaltet ist, ' +
      'oder wenn ein Token abgelaufen ist und die App automatisch eine neue Anfrage stellt.',
    bewertung: 'In der Regel harmlos – die meisten Einträge stammen von eigenen App-Nutzern.',
    aktion:
      'Erst handeln wenn: (1) viele Einträge von einer unbekannten IP kommen, ' +
      '(2) dieselbe IP mit vielen verschiedenen Pfaden auftaucht (Scanner), ' +
      '(3) Angriffe auf Admin-Routen sichtbar sind.',
    risikofarbe: '#22c55e'
  },
  brute_force: {
    icon: '🔨',
    kurzinfo: 'Viele fehlgeschlagene Logins von einer IP',
    beschreibung:
      'Ein automatisiertes Programm versucht systematisch Passwörter durchzuprobieren. ' +
      'Typisch: dieselbe IP schickt in kurzer Zeit dutzende oder hunderte Login-Versuche mit verschiedenen Passwörtern.',
    bewertung: 'Ernstzunehmendes Angriffsmuster – sollte nicht ignoriert werden.',
    aktion:
      'IP sofort blockieren. Prüfen ob das angegriffene Konto existiert und ein sicheres Passwort hat. ' +
      'Bei Wiederholung: permanente IP-Sperre.',
    risikofarbe: '#ef4444'
  },
  sql_injection: {
    icon: '💉',
    kurzinfo: 'SQL-Code in URL oder Eingabefeld eingeschleust',
    beschreibung:
      'Ein Angreifer schickt SQL-Befehle als Teil einer URL oder eines Formularfeldes, ' +
      "z. B. `' OR 1=1 --`. Ziel ist es, die Datenbank direkt zu manipulieren oder Daten zu stehlen.",
    bewertung: 'Direkter Angriffsversuch – sehr ernst nehmen.',
    aktion:
      'IP sofort blockieren. Prüfen ob der Angriff erfolgreich war (ungewöhnliche DB-Einträge, Logs). ' +
      'Sicherheitspatch einspielen falls eine Route verwundbar ist.',
    risikofarbe: '#ef4444'
  },
  xss_attempt: {
    icon: '📜',
    kurzinfo: 'JavaScript-Code in Eingabe eingeschleust',
    beschreibung:
      'Cross-Site Scripting: Ein Angreifer versucht `<script>`-Tags oder JavaScript in Eingabefelder ' +
      'einzuschleusen, damit dieser Code im Browser anderer Nutzer ausgeführt wird – z. B. um Cookies zu stehlen.',
    bewertung: 'Gezielter Angriffsversuch – ernst nehmen, besonders in Eingabefeldern.',
    aktion:
      'IP blockieren. Prüfen welche Route betroffen ist und ob eine Eingabe ohne Escaping gespeichert wurde. ' +
      'Alle Nutzereingaben müssen HTML-escaped werden.',
    risikofarbe: '#f97316'
  },
  rate_limit_exceeded: {
    icon: '⚡',
    kurzinfo: 'Zu viele Anfragen in kurzer Zeit',
    beschreibung:
      'Eine IP hat das Anfrage-Limit überschritten. Das kann ein DDoS-Versuch, ein schlecht programmierter ' +
      'Bot oder auch ein eigener Lasttest sein. Der Server hat die Anfragen automatisch gedrosselt.',
    bewertung: 'Meistens kein gezielter Angriff, aber ressourcenintensiv.',
    aktion:
      'Prüfen ob die IP bekannt ist. Falls unbekannt und mit hoher Frequenz: blockieren. ' +
      'Falls eigene Testsysteme: Rate-Limit-Konfiguration anpassen.',
    risikofarbe: '#f59e0b'
  },
  invalid_token: {
    icon: '🔑',
    kurzinfo: 'Ungültiger oder gefälschter Auth-Token',
    beschreibung:
      'Eine Anfrage enthielt einen JWT oder Session-Token, der nicht gültig ist – ' +
      'entweder abgelaufen, mit falschem Secret signiert oder manuell manipuliert. ' +
      'Kann auch durch Logout + sofortigen Reload entstehen.',
    bewertung: 'Einzelfälle sind normal. Häufungen von einer IP deuten auf Token-Fälschungsversuche hin.',
    aktion:
      'Bei einzelnen Einträgen: ignorieren. Bei vielen Einträgen von einer IP: ' +
      'prüfen ob jemand versucht Tokens zu erraten oder zu manipulieren.',
    risikofarbe: '#f59e0b'
  },
  suspicious_request: {
    icon: '🕵️',
    kurzinfo: 'Verdächtiges Anfragemuster entdeckt',
    beschreibung:
      'Die Anfrage zeigt Merkmale automatisierter Scanner oder Exploits: ' +
      'z. B. Zugriffe auf nicht existierende Admin-Pfade, bekannte Exploit-URLs (WordPress, phpMyAdmin), ' +
      'oder ungewöhnliche HTTP-Header.',
    bewertung: 'Oft automatisierter Internet-Scan ohne gezielten Fokus auf dein System.',
    aktion:
      'IP auf Wiederholung beobachten. Wenn dieselbe IP viele verschiedene verdächtige Anfragen schickt: blockieren. ' +
      'Einmalige Scanner sind im Internet normal.',
    risikofarbe: '#f59e0b'
  },
  file_upload_attack: {
    icon: '📁',
    kurzinfo: 'Schadhafte Datei hochzuladen versucht',
    beschreibung:
      'Jemand hat versucht eine potenziell gefährliche Datei hochzuladen – z. B. eine PHP-Shell, ' +
      'ein Script mit doppelter Dateiendung (.jpg.php) oder eine Datei mit verdächtigem Inhalt. ' +
      'Ziel: Code auf dem Server ausführen.',
    bewertung: 'Sehr gezielter Angriffsversuch – sofort handeln.',
    aktion:
      'IP sofort blockieren. Upload-Route prüfen: Sind Dateiendungen serverseitig validiert? ' +
      'Werden hochgeladene Dateien in einem nicht-ausführbaren Verzeichnis gespeichert?',
    risikofarbe: '#ef4444'
  },
  path_traversal: {
    icon: '📂',
    kurzinfo: 'Versuch auf Server-Dateien außerhalb des Web-Roots zuzugreifen',
    beschreibung:
      'Der Angreifer nutzt `../`-Sequenzen in der URL, um aus dem Web-Verzeichnis heraus ' +
      'auf Systemdateien zuzugreifen, z. B. `/etc/passwd` oder Konfigurationsdateien mit Passwörtern.',
    bewertung: 'Direkter Angriffsversuch – ernst nehmen.',
    aktion:
      'IP sofort blockieren. Prüfen ob die Route die Eingabe ungeprüft weitergibt. ' +
      'Alle Dateipfade müssen vor Verwendung normalisiert und auf erlaubte Verzeichnisse beschränkt werden.',
    risikofarbe: '#ef4444'
  },
  csrf_violation: {
    icon: '🎭',
    kurzinfo: 'Anfrage kam von einer nicht erlaubten Seite',
    beschreibung:
      'Cross-Site Request Forgery: Eine Anfrage an die API kam von einer anderen Website als erwartet. ' +
      'Ein Angreifer versucht, im Namen eines angemeldeten Nutzers Aktionen auszuführen, ' +
      'indem er ihn auf eine präparierte Seite lockt.',
    bewertung: 'Selten, aber wenn es auftritt: gezielter Angriff.',
    aktion:
      'Prüfen welche Route betroffen ist. CSRF-Tokens korrekt implementiert? ' +
      'Origin/Referer-Header im Backend validieren.',
    risikofarbe: '#f97316'
  },
  other: {
    icon: '❓',
    kurzinfo: 'Sonstige Sicherheitsereignisse',
    beschreibung:
      'Ereignisse die keiner der oben genannten Kategorien zugeordnet werden konnten. ' +
      'Dazu gehören z. B. manuell eingetragene Alerts durch Admins oder ' +
      'Systemereignisse mit unbekanntem Muster.',
    bewertung: 'Einzelfall-Prüfung nötig.',
    aktion: 'Details des Eintrags lesen und individuell bewerten.',
    risikofarbe: '#6b7280'
  }
};

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
  const [showExplanations, setShowExplanations] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);

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

  const cleanup = async (mode) => {
    const labels = { auto_blocks: 'Auto-Block-Logs', resolved: 'alte gelöste Events (>30 Tage)', all: 'alle Auto-Blocks + alte gelöste Events' };
    if (!window.confirm(`${labels[mode]} wirklich löschen?`)) return;
    setCleanupLoading(true);
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const r = await fetch(`/api/security/cleanup?mode=${mode}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json();
      if (d.success) { alert(`✓ ${d.deleted} Einträge gelöscht`); loadData(); }
    } catch (e) { console.error(e); }
    finally { setCleanupLoading(false); }
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

  const getAlertTypeInfo = (type) => ALERT_TYPE_INFO[type] || ALERT_TYPE_INFO.other;

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
      <div className="sd-loading">
        <RefreshCw className="sd-spin" size={18} />
        <span>Lade Sicherheitsdaten…</span>
      </div>
    );
  }

  return (
    <div className="sd">
      {/* Header */}
      <div className="sd-header">
        <div className="sd-header-left">
          <Shield size={18} />
          <div>
            <div className="sd-header-title">Sicherheits-Dashboard</div>
            <div className="sd-header-sub">Angriffserkennung &amp; Monitoring</div>
          </div>
        </div>
        <div className="sd-header-actions">
          <button className="sd-btn sd-btn--cleanup" onClick={() => cleanup('auto_blocks')} disabled={cleanupLoading}
            title="Auto-Block-Logs löschen">
            🧹 Auto-Blocks
          </button>
          <button className="sd-btn sd-btn--refresh" onClick={loadData}>
            <RefreshCw size={13} />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="sd-tabs">
        <button className={`sd-tab${activeTab === 'overview' ? ' sd-tab--active' : ''}`} onClick={() => setActiveTab('overview')}>
          <Activity size={14} /> Übersicht
        </button>
        <button className={`sd-tab${activeTab === 'alerts' ? ' sd-tab--active' : ''}`} onClick={() => setActiveTab('alerts')}>
          <AlertTriangle size={14} /> Warnungen
          {(stats?.summary?.unresolved || 0) > 0 && (
            <span className="sd-badge">{stats.summary.unresolved}</span>
          )}
        </button>
        <button className={`sd-tab${activeTab === 'blocked' ? ' sd-tab--active' : ''}`} onClick={() => setActiveTab('blocked')}>
          <Ban size={14} /> Blockierte IPs
          {blockedIPs.length > 0 && <span className="sd-badge">{blockedIPs.length}</span>}
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && stats && (
        <>
          {/* Stats Row */}
          <div className="sd-stats">
            <div className="sd-stat">
              <div className="sd-stat-icon sd-stat-icon--total"><Activity size={16} /></div>
              <div className="sd-stat-body">
                <span className="sd-stat-val">{stats.summary?.total_alerts || 0}</span>
                <span className="sd-stat-lbl">Ereignisse (7 Tage)</span>
              </div>
            </div>
            <div className="sd-stat">
              <div className="sd-stat-icon sd-stat-icon--warn"><AlertTriangle size={16} /></div>
              <div className="sd-stat-body">
                <span className="sd-stat-val">{stats.summary?.unresolved || 0}</span>
                <span className="sd-stat-lbl">Ungelöst</span>
                {stats.summary?.auto_block_count > 0 && (
                  <span className="sd-stat-sub">+{stats.summary.auto_block_count} Auto-Blocks</span>
                )}
              </div>
            </div>
            <div className="sd-stat">
              <div className="sd-stat-icon sd-stat-icon--crit"><AlertCircle size={16} /></div>
              <div className="sd-stat-body">
                <span className="sd-stat-val">{stats.summary?.critical_count || 0}</span>
                <span className="sd-stat-lbl">Kritisch</span>
              </div>
            </div>
            <div className="sd-stat">
              <div className="sd-stat-icon sd-stat-icon--block"><Ban size={16} /></div>
              <div className="sd-stat-body">
                <span className="sd-stat-val">{stats.summary?.blocked_count || 0}</span>
                <span className="sd-stat-lbl">Blockiert</span>
              </div>
            </div>
          </div>

          {/* Kritische Warnungen */}
          {stats.unresolvedCritical?.length > 0 && (
            <div className="sd-section">
              <div className="sd-section-head sd-section-head--crit">
                <AlertCircle size={14} /> Kritische Warnungen
              </div>
              <div className="sd-section-body">
                {stats.unresolvedCritical.slice(0, 5).map(alert => (
                  <div key={alert.id} className={`sd-alert sd-alert--${alert.severity}`}>
                    <span className={`sd-sev sd-sev--${alert.severity}`}>{getSeverityLabel(alert.severity)}</span>
                    <div className="sd-alert-body">
                      <span className="sd-alert-type">{getAlertTypeLabel(alert.alert_type)}</span>
                      <span className="sd-alert-desc">{alert.description}</span>
                      <span className="sd-alert-meta">
                        <Globe size={11} />{alert.ip_address || 'Unbekannt'}
                        <Clock size={11} />{formatDate(alert.created_at)}
                      </span>
                    </div>
                    {!alert.resolved && (
                      <button className="sd-resolve-btn" onClick={() => resolveAlert(alert.id)} title="Als gelöst markieren">
                        <CheckCircle size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ereignisse nach Typ */}
          {stats.alertsByType?.length > 0 && (
            <div className="sd-section">
              <div className="sd-section-head">
                <TrendingUp size={14} /> Ereignisse nach Typ (7 Tage)
              </div>
              <div className="sd-type-grid">
                {stats.alertsByType.map((item, idx) => {
                  const info = getAlertTypeInfo(item.alert_type);
                  return (
                    <div key={idx} className="sd-type-card">
                      <div className="sd-type-top">
                        <span className="sd-type-icon">{info.icon}</span>
                        <span className="sd-type-name">{getAlertTypeLabel(item.alert_type)}</span>
                        <span className="sd-type-count">{item.count}</span>
                      </div>
                      <div className="sd-type-sub">{info.kurzinfo}</div>
                      <div className="sd-type-bewertung">{info.bewertung}</div>
                    </div>
                  );
                })}
              </div>

              <div className="sd-expl-toggle" onClick={() => setShowExplanations(v => !v)}>
                <Info size={13} />
                <span>Was bedeuten diese Ereignisse?</span>
                {showExplanations ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </div>

              {showExplanations && (
                <div className="sd-expl-list">
                  {stats.alertsByType.map((item, idx) => {
                    const info = getAlertTypeInfo(item.alert_type);
                    return (
                      <div key={idx} className="sd-expl-item">
                        <div className="sd-expl-head">
                          <span>{info.icon}</span>
                          <strong>{getAlertTypeLabel(item.alert_type)}</strong>
                          <span className="sd-expl-kurzinfo">{info.kurzinfo}</span>
                        </div>
                        <p className="sd-expl-desc">{info.beschreibung}</p>
                        <div className="sd-expl-rows">
                          <div className="sd-expl-row"><span className="sd-expl-lbl">Einschätzung:</span><span>{info.bewertung}</span></div>
                          <div className="sd-expl-row"><span className="sd-expl-lbl">Empfehlung:</span><span>{info.aktion}</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {(!stats.alertsByType || stats.alertsByType.length === 0) && (
            <div className="sd-empty">
              <CheckCircle size={36} />
              <strong>Alles in Ordnung!</strong>
              <span>Keine Sicherheitsereignisse in den letzten 7 Tagen.</span>
            </div>
          )}
        </>
      )}

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div className="sd-section">
          <div className="sd-filter">
            <Filter size={14} />
            <select value={filters.severity} onChange={e => setFilters(prev => ({ ...prev, severity: e.target.value }))}>
              <option value="">Alle Schweregrade</option>
              {severities.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <select value={filters.alert_type} onChange={e => setFilters(prev => ({ ...prev, alert_type: e.target.value }))}>
              <option value="">Alle Typen</option>
              {alertTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={filters.resolved} onChange={e => setFilters(prev => ({ ...prev, resolved: e.target.value }))}>
              <option value="">Alle</option>
              <option value="false">Ungelöst</option>
              <option value="true">Gelöst</option>
            </select>
          </div>
          <div className="sd-section-body">
            {alerts.length === 0 ? (
              <div className="sd-empty"><CheckCircle size={28} /><span>Keine Warnungen gefunden</span></div>
            ) : alerts.map(alert => {
              const info = getAlertTypeInfo(alert.alert_type);
              return (
                <div key={alert.id} className={`sd-alert sd-alert--${alert.severity}${alert.resolved ? ' sd-alert--resolved' : ''}`}>
                  <span className={`sd-sev sd-sev--${alert.severity}`}>{getSeverityLabel(alert.severity)}</span>
                  <div className="sd-alert-body">
                    <span className="sd-alert-type">{info.icon} {getAlertTypeLabel(alert.alert_type)}</span>
                    <span className="sd-alert-hint">{info.kurzinfo} — {info.bewertung}</span>
                    <span className="sd-alert-desc">{alert.description}</span>
                    <span className="sd-alert-meta">
                      <Globe size={11} />{alert.ip_address || 'Unbekannt'}
                      <Clock size={11} />{formatDate(alert.created_at)}
                      {alert.request_path && <><Eye size={11} />{alert.request_path.substring(0, 50)}</>}
                    </span>
                  </div>
                  <div>
                    {alert.resolved ? (
                      <span className="sd-resolved-tag"><CheckCircle size={12} /> Gelöst</span>
                    ) : (
                      <button className="sd-resolve-btn" onClick={() => resolveAlert(alert.id)} title="Als gelöst markieren">
                        <CheckCircle size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Blocked IPs Tab */}
      {activeTab === 'blocked' && (
        <div className="sd-section">
          <div className="sd-section-head"><Ban size={14} /> Blockierte IPs</div>
          {blockedIPs.length === 0 ? (
            <div className="sd-empty"><Unlock size={28} /><span>Keine IPs blockiert</span></div>
          ) : (
            <div className="sd-blocked-list">
              {blockedIPs.map(ip => (
                <div key={ip.id} className="sd-blocked-row">
                  <div className="sd-blocked-icon"><Ban size={14} /></div>
                  <div className="sd-blocked-info">
                    <div className="sd-blocked-ip">{ip.ip_address}</div>
                    <div className="sd-blocked-reason">{ip.reason}</div>
                    <div className="sd-blocked-meta">
                      Seit: {formatDate(ip.created_at)}
                      {ip.blocked_until && !ip.permanent && <> · Bis: {formatDate(ip.blocked_until)}</>}
                      {ip.permanent && <> · <strong>Permanent</strong></>}
                      {ip.alert_count && <> · {ip.alert_count} Ereignisse</>}
                    </div>
                  </div>
                  <button className="sd-unblock-btn" onClick={() => unblockIP(ip.ip_address)}>
                    <Unlock size={12} /> Entsperren
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
