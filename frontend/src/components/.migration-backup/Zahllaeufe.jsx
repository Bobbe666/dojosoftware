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
  Filter
} from "lucide-react";
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Zahllaeufe.css";

const Zahllaeufe = ({ embedded = false }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [zahllaeufe, setZahllaeufe] = useState([]);
  const [filteredZahllaeufe, setFilteredZahllaeufe] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
      const response = await fetch(`${config.apiBaseUrl}/zahllaeufe`);

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
            Hier sehen Sie alle durchgeführten SEPA-Lastschriftläufe mit Status, Buchungen und Beträgen.
            Jeder Zahllauf enthält die Mandate-Informationen und kann heruntergeladen werden.
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
              {filteredZahllaeufe.map(zahllauf => (
                <tr key={zahllauf.zahllauf_id}>
                  <td>
                    {formatDateTime(zahllauf.erstellt_am)}
                  </td>
                  <td>
                    {formatDate(zahllauf.forderungen_bis)}
                  </td>
                  <td>
                    {formatDate(zahllauf.geplanter_einzug)}
                  </td>
                  <td>
                    {zahllauf.zahlungsanbieter || '-'}
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
                  </td>
                  <td>
                    <strong>{formatCurrency(zahllauf.betrag)}</strong>
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon btn-info"
                        onClick={() => alert('Details anzeigen')}
                        title="Details anzeigen"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="btn-icon btn-secondary"
                        onClick={() => alert('CSV herunterladen')}
                        title="CSV herunterladen"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Zahllaeufe;
