import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  FileText,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  Archive,
  Eye,
  Edit,
  Trash2,
  Download,
  TrendingUp,
  Calendar
} from "lucide-react";
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Rechnungsverwaltung.css";

const Rechnungsverwaltung = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('alle'); // alle, offen, bezahlt, ueberfaellig, archiv
  const [searchTerm, setSearchTerm] = useState('');
  const [rechnungen, setRechnungen] = useState([]);
  const [filteredRechnungen, setFilteredRechnungen] = useState([]);
  const [statistiken, setStatistiken] = useState({
    gesamt_rechnungen: 0,
    offene_rechnungen: 0,
    bezahlte_rechnungen: 0,
    ueberfaellige_rechnungen: 0,
    offene_summe: 0,
    bezahlte_summe: 0,
    ueberfaellige_summe: 0,
    gesamt_summe: 0
  });
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterRechnungen();
  }, [activeView, searchTerm, rechnungen]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [rechnungenRes, statsRes] = await Promise.all([
        fetch(`${config.apiBaseUrl}/rechnungen`),
        fetch(`${config.apiBaseUrl}/rechnungen/statistiken`)
      ]);

      if (rechnungenRes.ok) {
        const rechnungenData = await rechnungenRes.json();
        setRechnungen(rechnungenData.data || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistiken(statsData.data || statistiken);
      }

      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      setLoading(false);
    }
  };

  const filterRechnungen = () => {
    let filtered = [...rechnungen];

    // Filter nach View
    switch (activeView) {
      case 'offen':
        filtered = filtered.filter(r => r.status === 'offen' && r.archiviert === 0);
        break;
      case 'bezahlt':
        filtered = filtered.filter(r => r.status === 'bezahlt' && r.archiviert === 0);
        break;
      case 'ueberfaellig':
        filtered = filtered.filter(r => {
          const faellig = new Date(r.faelligkeitsdatum);
          const heute = new Date();
          return (r.status === 'offen' || r.status === 'ueberfaellig') && faellig < heute && r.archiviert === 0;
        });
        break;
      case 'archiv':
        filtered = filtered.filter(r => r.archiviert === 1);
        break;
      default:
        filtered = filtered.filter(r => r.archiviert === 0);
    }

    // Suchfilter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.rechnungsnummer.toLowerCase().includes(search) ||
        r.mitglied_name.toLowerCase().includes(search) ||
        r.beschreibung?.toLowerCase().includes(search)
      );
    }

    setFilteredRechnungen(filtered);
  };

  const handleArchivieren = async (rechnung_id, archivieren) => {
    if (!window.confirm(archivieren ? 'Rechnung archivieren?' : 'Archivierung aufheben?')) {
      return;
    }

    try {
      const res = await fetch(`${config.apiBaseUrl}/rechnungen/${rechnung_id}/archivieren`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiviert: archivieren })
      });

      if (res.ok) {
        alert(archivieren ? 'Rechnung archiviert' : 'Archivierung aufgehoben');
        loadData();
      }
    } catch (error) {
      console.error('Fehler beim Archivieren:', error);
      alert('Fehler beim Archivieren');
    }
  };

  const handleDelete = async (rechnung_id) => {
    if (!window.confirm('Rechnung wirklich löschen? Dies kann nicht rückgängig gemacht werden!')) {
      return;
    }

    try {
      const res = await fetch(`${config.apiBaseUrl}/rechnungen/${rechnung_id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        alert('Rechnung gelöscht');
        loadData();
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen');
    }
  };

  const getStatusBadge = (rechnung) => {
    const faellig = new Date(rechnung.faelligkeitsdatum);
    const heute = new Date();

    if (rechnung.status === 'bezahlt') {
      return <span className="badge badge-success">Bezahlt</span>;
    } else if (rechnung.status === 'teilweise_bezahlt') {
      return <span className="badge badge-warning">Teilweise bezahlt</span>;
    } else if (faellig < heute) {
      return <span className="badge badge-danger">Überfällig</span>;
    } else {
      return <span className="badge badge-info">Offen</span>;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <div className="rechnungen-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Rechnungen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rechnungen-container">
      {/* Header */}
      <div className="rechnungen-header">
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/beitraege')}>
          <ArrowLeft size={20} />
          Zurück
        </button>
        <div>
          <h1>📄 Rechnungsverwaltung</h1>
          <p>Erstelle, verwalte und prüfe alle Rechnungen</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={20} />
          Neue Rechnung
        </button>
      </div>

      {/* Statistiken */}
      <div className="stats-grid">
        <div className="stat-card info">
          <div className="stat-icon">
            <FileText size={32} />
          </div>
          <div className="stat-info">
            <h3>Gesamt Rechnungen</h3>
            <p className="stat-value">{statistiken.gesamt_rechnungen}</p>
            <span className="stat-trend">{formatCurrency(statistiken.gesamt_summe)}</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">
            <Clock size={32} />
          </div>
          <div className="stat-info">
            <h3>Offene Rechnungen</h3>
            <p className="stat-value">{statistiken.offene_rechnungen}</p>
            <span className="stat-trend">{formatCurrency(statistiken.offene_summe)}</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <CheckCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>Bezahlte Rechnungen</h3>
            <p className="stat-value">{statistiken.bezahlte_rechnungen}</p>
            <span className="stat-trend">{formatCurrency(statistiken.bezahlte_summe)}</span>
          </div>
        </div>

        <div className="stat-card danger">
          <div className="stat-icon">
            <AlertCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>Überfällige Rechnungen</h3>
            <p className="stat-value">{statistiken.ueberfaellige_rechnungen}</p>
            <span className="stat-trend">{formatCurrency(statistiken.ueberfaellige_summe)}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="view-tabs">
        <button
          className={`tab ${activeView === 'alle' ? 'active' : ''}`}
          onClick={() => setActiveView('alle')}
        >
          <FileText size={18} />
          Alle Rechnungen
        </button>
        <button
          className={`tab ${activeView === 'offen' ? 'active' : ''}`}
          onClick={() => setActiveView('offen')}
        >
          <Clock size={18} />
          Offen
        </button>
        <button
          className={`tab ${activeView === 'bezahlt' ? 'active' : ''}`}
          onClick={() => setActiveView('bezahlt')}
        >
          <CheckCircle size={18} />
          Bezahlt
        </button>
        <button
          className={`tab ${activeView === 'ueberfaellig' ? 'active' : ''}`}
          onClick={() => setActiveView('ueberfaellig')}
        >
          <AlertCircle size={18} />
          Überfällig
        </button>
        <button
          className={`tab ${activeView === 'archiv' ? 'active' : ''}`}
          onClick={() => setActiveView('archiv')}
        >
          <Archive size={18} />
          Archiv
        </button>
      </div>

      {/* Suchfeld */}
      <div className="search-bar">
        <Search size={20} />
        <input
          type="text"
          placeholder="Suche nach Rechnungsnummer, Mitglied oder Beschreibung..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Rechnungstabelle */}
      <div className="rechnungen-table-container">
        {filteredRechnungen.length === 0 ? (
          <div className="empty-state">
            <FileText size={64} />
            <h3>Keine Rechnungen gefunden</h3>
            <p>
              {activeView === 'alle' && 'Es wurden noch keine Rechnungen erstellt.'}
              {activeView === 'offen' && 'Keine offenen Rechnungen vorhanden.'}
              {activeView === 'bezahlt' && 'Keine bezahlten Rechnungen vorhanden.'}
              {activeView === 'ueberfaellig' && 'Keine überfälligen Rechnungen vorhanden.'}
              {activeView === 'archiv' && 'Keine archivierten Rechnungen vorhanden.'}
            </p>
          </div>
        ) : (
          <table className="rechnungen-table">
            <thead>
              <tr>
                <th>Rechnungsnr.</th>
                <th>Mitglied</th>
                <th>Datum</th>
                <th>Fälligkeit</th>
                <th>Art</th>
                <th>Betrag</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredRechnungen.map(rechnung => (
                <tr key={rechnung.rechnung_id}>
                  <td>
                    <strong>{rechnung.rechnungsnummer}</strong>
                  </td>
                  <td>{rechnung.mitglied_name}</td>
                  <td>{formatDate(rechnung.datum)}</td>
                  <td>{formatDate(rechnung.faelligkeitsdatum)}</td>
                  <td>
                    <span className="badge badge-neutral">
                      {rechnung.art === 'mitgliedsbeitrag' && 'Mitgliedsbeitrag'}
                      {rechnung.art === 'pruefungsgebuehr' && 'Prüfungsgebühr'}
                      {rechnung.art === 'kursgebuehr' && 'Kursgebühr'}
                      {rechnung.art === 'ausruestung' && 'Ausrüstung'}
                      {rechnung.art === 'sonstiges' && 'Sonstiges'}
                    </span>
                  </td>
                  <td><strong>{formatCurrency(rechnung.betrag)}</strong></td>
                  <td>{getStatusBadge(rechnung)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon btn-info"
                        onClick={() => navigate(`/dashboard/rechnungen/${rechnung.rechnung_id}`)}
                        title="Details anzeigen"
                      >
                        <Eye size={16} />
                      </button>
                      {rechnung.archiviert === 0 ? (
                        <button
                          className="btn-icon btn-secondary"
                          onClick={() => handleArchivieren(rechnung.rechnung_id, true)}
                          title="Archivieren"
                        >
                          <Archive size={16} />
                        </button>
                      ) : (
                        <button
                          className="btn-icon btn-success"
                          onClick={() => handleArchivieren(rechnung.rechnung_id, false)}
                          title="Wiederherstellen"
                        >
                          <Archive size={16} />
                        </button>
                      )}
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleDelete(rechnung.rechnung_id)}
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

      {/* Create Modal Placeholder */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Neue Rechnung erstellen</h2>
            <p>Formular wird implementiert...</p>
            <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rechnungsverwaltung;
