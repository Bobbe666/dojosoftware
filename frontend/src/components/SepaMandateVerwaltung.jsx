import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit,
  Trash2,
  Plus,
  Download,
  AlertCircle
} from "lucide-react";
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/SepaMandateVerwaltung.css";

const SepaMandateVerwaltung = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mandate, setMandate] = useState([]);
  const [filteredMandate, setFilteredMandate] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, aktiv, widerrufen, abgelaufen

  useEffect(() => {
    loadMandate();
  }, []);

  useEffect(() => {
    filterMandate();
  }, [searchTerm, statusFilter, mandate]);

  const loadMandate = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.apiBaseUrl}/sepa-mandate`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der SEPA-Mandate');
      }

      const data = await response.json();
      setMandate(data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der SEPA-Mandate:', error);
      alert('Fehler beim Laden: ' + error.message);
      setLoading(false);
    }
  };

  const filterMandate = () => {
    let filtered = [...mandate];

    // Status Filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => m.status === statusFilter);
    }

    // Search Filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.mitglied_name?.toLowerCase().includes(search) ||
        m.mandatsreferenz?.toLowerCase().includes(search) ||
        m.iban?.toLowerCase().includes(search)
      );
    }

    setFilteredMandate(filtered);
  };

  const getStatusBadge = (mandat) => {
    if (mandat.status === 'aktiv') {
      return <span className="badge badge-success"><CheckCircle size={14} /> Aktiv</span>;
    } else if (mandat.status === 'widerrufen') {
      return <span className="badge badge-danger"><XCircle size={14} /> Widerrufen</span>;
    } else if (mandat.status === 'abgelaufen') {
      return <span className="badge badge-warning"><Clock size={14} /> Abgelaufen</span>;
    }
    return <span className="badge badge-neutral">{mandat.status}</span>;
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE');
  };

  const maskIBAN = (iban) => {
    if (!iban) return '-';
    if (iban.length < 8) return iban;
    return iban.substring(0, 4) + '****' + iban.substring(iban.length - 4);
  };

  const handleDelete = async (mandat_id) => {
    if (!window.confirm('SEPA-Mandat wirklich löschen?\n\nACHTUNG: Lastschriften für dieses Mitglied sind danach nicht mehr möglich!')) {
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/sepa-mandate/${mandat_id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Fehler beim Löschen');
      }

      alert('SEPA-Mandat erfolgreich gelöscht');
      loadMandate();
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="sepa-mandate-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade SEPA-Mandate...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sepa-mandate-container">
      {/* Header */}
      <div className="sepa-mandate-header">
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/beitraege')}>
          <ArrowLeft size={20} />
          Zurück
        </button>
        <div>
          <h1>📋 SEPA-Mandate Verwaltung</h1>
          <p>Alle SEPA-Lastschriftmandate verwalten und prüfen</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => alert('Neues SEPA-Mandat wird implementiert')}
        >
          <Plus size={20} />
          Neues Mandat
        </button>
      </div>

      {/* Info Box */}
      <div className="info-box">
        <AlertCircle size={24} />
        <div>
          <h3>SEPA-Lastschriftmandat</h3>
          <p>
            Ein SEPA-Mandat ist die Einzugsermächtigung für Lastschriften.
            <strong> Ohne gültiges Mandat können keine Beiträge per Lastschrift eingezogen werden.</strong>
            Mandate müssen vom Mitglied unterschrieben und mit Mandatsreferenz hinterlegt sein.
          </p>
        </div>
      </div>

      {/* Statistiken */}
      <div className="stats-grid">
        <div className="stat-card success">
          <div className="stat-icon">
            <CheckCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>Aktive Mandate</h3>
            <p className="stat-value">{mandate.filter(m => m.status === 'aktiv').length}</p>
            <span className="stat-trend">Bereit für Lastschrift</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">
            <Clock size={32} />
          </div>
          <div className="stat-info">
            <h3>Abgelaufen</h3>
            <p className="stat-value">{mandate.filter(m => m.status === 'abgelaufen').length}</p>
            <span className="stat-trend">Nicht mehr gültig</span>
          </div>
        </div>

        <div className="stat-card danger">
          <div className="stat-icon">
            <XCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>Widerrufen</h3>
            <p className="stat-value">{mandate.filter(m => m.status === 'widerrufen').length}</p>
            <span className="stat-trend">Zurückgezogen</span>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">
            <Download size={32} />
          </div>
          <div className="stat-info">
            <h3>Gesamt</h3>
            <p className="stat-value">{mandate.length}</p>
            <span className="stat-trend">Alle Mandate</span>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="filter-bar">
        <div className="search-bar">
          <Search size={20} />
          <input
            type="text"
            placeholder="Suche nach Name, Mandatsreferenz oder IBAN..."
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
          <option value="aktiv">Aktiv</option>
          <option value="widerrufen">Widerrufen</option>
          <option value="abgelaufen">Abgelaufen</option>
        </select>
      </div>

      {/* Mandate Tabelle */}
      <div className="mandate-table-container">
        {filteredMandate.length === 0 ? (
          <div className="empty-state">
            <AlertCircle size={64} />
            <h3>Keine SEPA-Mandate gefunden</h3>
            <p>
              {statusFilter !== 'all' && `Keine Mandate mit Status "${statusFilter}" vorhanden.`}
              {searchTerm && `Keine Treffer für "${searchTerm}".`}
              {!statusFilter && !searchTerm && 'Es wurden noch keine SEPA-Mandate hinterlegt.'}
            </p>
          </div>
        ) : (
          <table className="mandate-table">
            <thead>
              <tr>
                <th>Mitglied</th>
                <th>Mandatsreferenz</th>
                <th>IBAN</th>
                <th>BIC</th>
                <th>Gläubiger-ID</th>
                <th>Erstellt am</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredMandate.map(mandat => (
                <tr key={mandat.mandat_id}>
                  <td>
                    <strong>{mandat.mitglied_name || `Mitglied #${mandat.mitglied_id}`}</strong>
                    <br />
                    <small>ID: {mandat.mitglied_id}</small>
                  </td>
                  <td>
                    <code>{mandat.mandatsreferenz}</code>
                  </td>
                  <td>
                    <code>{maskIBAN(mandat.iban)}</code>
                  </td>
                  <td>
                    {mandat.bic || '-'}
                  </td>
                  <td>
                    <code>{mandat.glaeubiger_id || '-'}</code>
                  </td>
                  <td>
                    {formatDate(mandat.erstellungsdatum)}
                  </td>
                  <td>
                    {getStatusBadge(mandat)}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon btn-info"
                        onClick={() => alert('Mandat-Details anzeigen')}
                        title="Details anzeigen"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="btn-icon btn-secondary"
                        onClick={() => alert('Mandat bearbeiten')}
                        title="Bearbeiten"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleDelete(mandat.mandat_id)}
                        title="Löschen"
                      >
                        <Trash2 size={16} />
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

export default SepaMandateVerwaltung;
