import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  FileText,
  Download,
  Eye,
  TrendingUp,
  Users,
  DollarSign,
  Clock,
  AlertCircle,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  User,
  CreditCard,
  XCircle
} from "lucide-react";
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Zahllaeufe.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';


const Zahllaeufe = ({ embedded = false }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [zahllaeufe, setZahllaeufe] = useState([]);
  const [filteredZahllaeufe, setFilteredZahllaeufe] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState({});
  const [transaktionenCache, setTransaktionenCache] = useState({});
  const [loadingTransaktionen, setLoadingTransaktionen] = useState({});
  const [stats, setStats] = useState({
    gesamt: 0,
    abgeschlossen: 0,
    offen: 0,
    gesamtbetrag: 0
  });

  useEffect(() => {
    loadZahllaeufe();
  }, []);

  useEffect(() => {
    filterZahllaeufe();
  }, [searchTerm, statusFilter, zahllaeufe]);

  const loadZahllaeufe = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${config.apiBaseUrl}/zahllaeufe`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Zahlläufe');
      }

      const data = await response.json();
      setZahllaeufe(data.data || []);
      calculateStats(data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Zahlläufe:', error);
      alert('Fehler beim Laden: ' + error.message);
      setLoading(false);
    }
  };

  const calculateStats = (data) => {
    const stats = {
      gesamt: data.length,
      abgeschlossen: data.filter(z => z.status === 'abgeschlossen').length,
      offen: data.filter(z => z.status === 'offen' || z.status === 'geplant').length,
      gesamtbetrag: data.reduce((sum, z) => sum + parseFloat(z.betrag || 0), 0)
    };
    setStats(stats);
  };

  const filterZahllaeufe = () => {
    let filtered = [...zahllaeufe];

    // Status Filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(z => z.status === statusFilter);
    }

    // Search Filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(z =>
        z.buchungsnummer?.toLowerCase().includes(search) ||
        z.zahlungsanbieter?.toLowerCase().includes(search)
      );
    }

    setFilteredZahllaeufe(filtered);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'abgeschlossen':
        return <span className="badge badge-success"><CheckCircle size={14} /> Abgeschlossen</span>;
      case 'offen':
        return <span className="badge badge-warning"><Clock size={14} /> Offen</span>;
      case 'geplant':
        return <span className="badge badge-info"><Calendar size={14} /> Geplant</span>;
      case 'fehler':
        return <span className="badge badge-danger"><AlertCircle size={14} /> Fehler</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const getTransaktionStatusBadge = (status) => {
    switch (status) {
      case 'succeeded':
        return <span className="badge badge-success"><CheckCircle size={12} /> Erfolgreich</span>;
      case 'processing':
        return <span className="badge badge-warning"><Clock size={12} /> In Bearbeitung</span>;
      case 'failed':
        return <span className="badge badge-danger"><XCircle size={12} /> Fehlgeschlagen</span>;
      case 'canceled':
        return <span className="badge badge-neutral"><XCircle size={12} /> Abgebrochen</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const toggleRow = async (zahllauf) => {
    const rowKey = `${zahllauf.quelle || 'sepa'}-${zahllauf.zahllauf_id}`;
    const isExpanded = expandedRows[rowKey];

    if (isExpanded) {
      // Einklappen
      setExpandedRows(prev => ({ ...prev, [rowKey]: false }));
    } else {
      // Ausklappen - Daten laden falls nicht im Cache
      setExpandedRows(prev => ({ ...prev, [rowKey]: true }));

      if (!transaktionenCache[rowKey]) {
        await loadTransaktionen(zahllauf, rowKey);
      }
    }
  };

  const loadTransaktionen = async (zahllauf, rowKey) => {
    setLoadingTransaktionen(prev => ({ ...prev, [rowKey]: true }));

    try {
      const quelle = zahllauf.quelle || 'sepa';
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/zahllaeufe/${quelle}/${zahllauf.zahllauf_id}/transaktionen`
      );

      if (response.ok) {
        const data = await response.json();
        setTransaktionenCache(prev => ({
          ...prev,
          [rowKey]: data
        }));
      } else {
        console.error('Fehler beim Laden der Transaktionen');
        setTransaktionenCache(prev => ({
          ...prev,
          [rowKey]: { transaktionen: [], error: 'Fehler beim Laden' }
        }));
      }
    } catch (error) {
      console.error('Fehler:', error);
      setTransaktionenCache(prev => ({
        ...prev,
        [rowKey]: { transaktionen: [], error: error.message }
      }));
    } finally {
      setLoadingTransaktionen(prev => ({ ...prev, [rowKey]: false }));
    }
  };

  if (loading) {
    return (
      <div className="zahllaeufe-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Zahlläufe...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="zahllaeufe-container">
      {/* Header - nur anzeigen wenn nicht embedded */}
      {!embedded && (
      <div className="zahllaeufe-header">
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/beitraege')}>
          <ArrowLeft size={20} />
          Zurück
        </button>
        <div>
          <h1>📊 Zahlläufe Übersicht</h1>
          <p>Alle durchgeführten SEPA-Lastschriftläufe im Überblick</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/dashboard/lastschriftlauf')}
        >
          <Calendar size={20} />
          Neuer Zahllauf
        </button>
      </div>
      )}

      {/* Info Box */}
      <div className="info-box">
        <FileText size={24} />
        <div>
          <h3>Zahlläufe Verwaltung</h3>
          <p>
            Hier sehen Sie alle durchgeführten Lastschriftläufe - sowohl klassische SEPA-Läufe als auch Stripe SEPA-Einzüge.
            Jeder Zahllauf enthält Status, Buchungen und Beträge.
          </p>
        </div>
      </div>

      {/* Statistiken */}
      <div className="stats-grid">
        <div className="stat-card info">
          <div className="stat-icon">
            <FileText size={16} />
          </div>
          <div className="stat-info">
            <h3>Gesamt Zahlläufe</h3>
            <p className="stat-value">{stats.gesamt}</p>
            <span className="stat-trend">Alle Läufe</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <CheckCircle size={16} />
          </div>
          <div className="stat-info">
            <h3>Abgeschlossen</h3>
            <p className="stat-value">{stats.abgeschlossen}</p>
            <span className="stat-trend">Erfolgreich durchgeführt</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">
            <Clock size={16} />
          </div>
          <div className="stat-info">
            <h3>Offen / Geplant</h3>
            <p className="stat-value">{stats.offen}</p>
            <span className="stat-trend">Noch nicht abgeschlossen</span>
          </div>
        </div>

        <div className="stat-card primary">
          <div className="stat-icon">
            <DollarSign size={16} />
          </div>
          <div className="stat-info">
            <h3>Gesamtbetrag</h3>
            <p className="stat-value">{formatCurrency(stats.gesamtbetrag)}</p>
            <span className="stat-trend">Alle Zahlläufe</span>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <div className="search-bar">
          <Search size={20} />
          <input
            type="text"
            placeholder="Suche nach Buchungsnummer oder Anbieter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="status-filter"
        >
          <option value="all">Alle Status</option>
          <option value="abgeschlossen">Abgeschlossen</option>
          <option value="offen">Offen</option>
          <option value="geplant">Geplant</option>
          <option value="fehler">Fehler</option>
        </select>
      </div>

      {/* Zahlläufe Tabelle */}
      <div className="zahllaeufe-table-container">
        {filteredZahllaeufe.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={64} />
            <h3>Keine Zahlläufe gefunden</h3>
            <p>
              {statusFilter !== 'all' && `Keine Zahlläufe mit Status "${statusFilter}" vorhanden.`}
              {searchTerm && `Keine Treffer für "${searchTerm}".`}
              {!statusFilter && !searchTerm && 'Es wurden noch keine Zahlläufe erstellt.'}
            </p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/dashboard/lastschriftlauf')}
              style={{ marginTop: '1rem' }}
            >
              Ersten Zahllauf erstellen
            </button>
          </div>
        ) : (
          <table className="zahllaeufe-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Erstellt am</th>
                <th>Forderungen bis einschl.</th>
                <th>Geplanter Einzug</th>
                <th>Zahlungsanbieter</th>
                <th>Status</th>
                <th>Buchungsnummer</th>
                <th>Buchungen</th>
                <th>RLS-% (Anzahl)</th>
                <th>Betrag</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredZahllaeufe.map(zahllauf => {
                const rowKey = `${zahllauf.quelle || 'sepa'}-${zahllauf.zahllauf_id}`;
                const isExpanded = expandedRows[rowKey];
                const transaktionenData = transaktionenCache[rowKey];
                const isLoadingTransaktionen = loadingTransaktionen[rowKey];

                return (
                  <React.Fragment key={rowKey}>
                    <tr className={isExpanded ? 'row-expanded' : ''}>
                      <td>
                        <button
                          className="btn-expand"
                          onClick={() => toggleRow(zahllauf)}
                          title={isExpanded ? 'Einklappen' : 'Details anzeigen'}
                        >
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                      </td>
                      <td>
                        {formatDateTime(zahllauf.erstellt_am)}
                      </td>
                      <td>
                        {formatDate(zahllauf.forderungen_bis)}
                      </td>
                      <td>
                        {zahllauf.quelle === 'stripe' ? '-' : formatDate(zahllauf.geplanter_einzug)}
                      </td>
                      <td>
                        <span className={`provider-badge ${zahllauf.quelle === 'stripe' ? 'provider-stripe' : 'provider-sepa'}`}>
                          {zahllauf.quelle === 'stripe' ? '💳 Stripe SEPA' : (zahllauf.zahlungsanbieter || 'SEPA')}
                        </span>
                      </td>
                      <td>
                        {getStatusBadge(zahllauf.status)}
                      </td>
                      <td>
                        <code>{zahllauf.buchungsnummer}</code>
                      </td>
                      <td>
                        <strong>{zahllauf.anzahl_buchungen || 0}</strong>
                      </td>
                      <td>
                        {zahllauf.ruecklastschrift_prozent
                          ? `${zahllauf.ruecklastschrift_prozent}%`
                          : '0%'}
                        {zahllauf.ruecklastschrift_anzahl > 0 && (
                          <span className="rls-count"> ({zahllauf.ruecklastschrift_anzahl})</span>
                        )}
                      </td>
                      <td>
                        <strong>{formatCurrency(zahllauf.betrag)}</strong>
                      </td>
                      <td>
                        <div className="action-buttons">
                          {zahllauf.quelle !== 'stripe' && (
                            <button
                              className="btn-icon btn-secondary"
                              onClick={() => alert('CSV herunterladen')}
                              title="CSV herunterladen"
                            >
                              <Download size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Ausgeklappte Details */}
                    {isExpanded && (
                      <tr className="expanded-row">
                        <td colSpan="11">
                          <div className="transaktionen-container">
                            {isLoadingTransaktionen ? (
                              <div className="transaktionen-loading">
                                <div className="loading-spinner-small"></div>
                                <span>Lade Transaktionen...</span>
                              </div>
                            ) : transaktionenData?.hinweis ? (
                              <div className="transaktionen-hinweis">
                                <AlertCircle size={16} />
                                <span>{transaktionenData.hinweis}</span>
                              </div>
                            ) : transaktionenData?.transaktionen?.length > 0 ? (
                              <div className="transaktionen-liste">
                                <div className="transaktionen-header">
                                  <User size={16} />
                                  <span>{transaktionenData.count} Mitglieder in diesem Zahllauf</span>
                                </div>
                                <table className="transaktionen-table">
                                  <thead>
                                    <tr>
                                      <th>Mitglied</th>
                                      <th>Status</th>
                                      <th>Betrag</th>
                                      <th>Beiträge</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {transaktionenData.transaktionen.map((t, idx) => (
                                      <tr key={t.transaktion_id || idx}>
                                        <td>
                                          <div className="mitglied-info">
                                            <strong>{t.vorname} {t.nachname}</strong>
                                            {t.mitgliedsnummer && (
                                              <span className="mitgliedsnummer">#{t.mitgliedsnummer}</span>
                                            )}
                                          </div>
                                        </td>
                                        <td>
                                          {getTransaktionStatusBadge(t.status)}
                                          {t.error_message && (
                                            <div className="error-message" title={t.error_message}>
                                              {t.error_message.substring(0, 50)}...
                                            </div>
                                          )}
                                        </td>
                                        <td>
                                          <strong>{formatCurrency(t.betrag)}</strong>
                                        </td>
                                        <td>
                                          {t.beitraege && t.beitraege.length > 0 ? (
                                            <div className="beitraege-liste">
                                              {t.beitraege.map((b, bidx) => (
                                                <div key={b.beitrag_id || bidx} className="beitrag-item">
                                                  <span className="beitrag-datum">
                                                    {formatDate(b.zahlungsdatum)}
                                                  </span>
                                                  <span className="beitrag-betrag">
                                                    {formatCurrency(b.betrag)}
                                                  </span>
                                                  {b.magicline_description && (
                                                    <span className="beitrag-beschreibung">
                                                      {b.magicline_description}
                                                    </span>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <span className="keine-details">-</span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="transaktionen-leer">
                                <span>Keine Transaktionsdetails verfügbar</span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Zahllaeufe;
