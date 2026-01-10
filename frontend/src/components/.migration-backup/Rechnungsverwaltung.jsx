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
  const [showModal, setShowModal] = useState(false);
  const [modalRechnung, setModalRechnung] = useState(null);
  const [modalActiveTab, setModalActiveTab] = useState('details');
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

  const handleShowDetails = async (rechnung_id) => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/rechnungen/${rechnung_id}`);
      if (res.ok) {
        const data = await res.json();
        setModalRechnung(data.data);
        setModalActiveTab('details');
        setShowModal(true);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Rechnung:', error);
      alert('Fehler beim Laden der Rechnung');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setModalRechnung(null);
    setModalActiveTab('details');
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
          onClick={() => navigate('/dashboard/rechnung-erstellen')}
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
                        onClick={() => handleShowDetails(rechnung.rechnung_id)}
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

      {/* Modal für Rechnungsdetails */}
      {showModal && modalRechnung && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content extra-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Rechnungsdetails</h2>
              <button className="close-btn" onClick={closeModal} title="Schließen">
                ×
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="tabs-container">
              <button
                className={`tab ${modalActiveTab === 'details' ? 'active' : ''}`}
                onClick={() => setModalActiveTab('details')}
              >
                <FileText size={18} className="tab-icon" />
                <span className="tab-label">Details</span>
              </button>
              <button
                className={`tab ${modalActiveTab === 'positionen' ? 'active' : ''}`}
                onClick={() => setModalActiveTab('positionen')}
              >
                <DollarSign size={18} className="tab-icon" />
                <span className="tab-label">Positionen</span>
              </button>
              <button
                className={`tab ${modalActiveTab === 'zahlungen' ? 'active' : ''}`}
                onClick={() => setModalActiveTab('zahlungen')}
              >
                <CheckCircle size={18} className="tab-icon" />
                <span className="tab-label">Zahlungen</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="modal-body">
              {modalActiveTab === 'details' && (
                <div className="detail-section">
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Rechnungsnummer</label>
                      <div className="detail-value"><strong>{modalRechnung.rechnungsnummer}</strong></div>
                    </div>
                    <div className="detail-item">
                      <label>Mitglied</label>
                      <div className="detail-value">{modalRechnung.mitglied_name}</div>
                    </div>
                    <div className="detail-item">
                      <label>Datum</label>
                      <div className="detail-value">{formatDate(modalRechnung.datum)}</div>
                    </div>
                    <div className="detail-item">
                      <label>Fälligkeitsdatum</label>
                      <div className="detail-value">{formatDate(modalRechnung.faelligkeitsdatum)}</div>
                    </div>
                    <div className="detail-item">
                      <label>Art</label>
                      <div className="detail-value">
                        {modalRechnung.art === 'mitgliedsbeitrag' && 'Mitgliedsbeitrag'}
                        {modalRechnung.art === 'pruefungsgebuehr' && 'Prüfungsgebühr'}
                        {modalRechnung.art === 'kursgebuehr' && 'Kursgebühr'}
                        {modalRechnung.art === 'ausruestung' && 'Ausrüstung'}
                        {modalRechnung.art === 'sonstiges' && 'Sonstiges'}
                      </div>
                    </div>
                    <div className="detail-item">
                      <label>Status</label>
                      <div className="detail-value">{getStatusBadge(modalRechnung)}</div>
                    </div>
                    <div className="detail-item">
                      <label>Betrag</label>
                      <div className="detail-value"><strong>{formatCurrency(modalRechnung.betrag)}</strong></div>
                    </div>
                    <div className="detail-item">
                      <label>Beschreibung</label>
                      <div className="detail-value">{modalRechnung.beschreibung || '-'}</div>
                    </div>
                  </div>
                </div>
              )}

              {modalActiveTab === 'positionen' && (
                <div className="detail-section">
                  <h3>Rechnungspositionen</h3>
                  {modalRechnung.positionen && modalRechnung.positionen.length > 0 ? (
                    <table className="rechnungen-table">
                      <thead>
                        <tr>
                          <th>Pos.</th>
                          <th>Beschreibung</th>
                          <th>Menge</th>
                          <th>Einzelpreis</th>
                          <th>Gesamt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalRechnung.positionen.map((pos, idx) => (
                          <tr key={idx}>
                            <td>{pos.position_nr}</td>
                            <td>{pos.bezeichnung}</td>
                            <td>{pos.menge}</td>
                            <td>{formatCurrency(pos.einzelpreis)}</td>
                            <td><strong>{formatCurrency(pos.gesamtpreis || (pos.menge * pos.einzelpreis))}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="info-text">Keine Positionen vorhanden</p>
                  )}
                </div>
              )}

              {modalActiveTab === 'zahlungen' && (
                <div className="detail-section">
                  <h3>Zahlungshistorie</h3>
                  {modalRechnung.zahlungen && modalRechnung.zahlungen.length > 0 ? (
                    <table className="rechnungen-table">
                      <thead>
                        <tr>
                          <th>Datum</th>
                          <th>Betrag</th>
                          <th>Methode</th>
                          <th>Notiz</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalRechnung.zahlungen.map((zahlung, idx) => (
                          <tr key={idx}>
                            <td>{formatDate(zahlung.zahlungsdatum)}</td>
                            <td><strong>{formatCurrency(zahlung.betrag)}</strong></td>
                            <td>{zahlung.zahlungsmethode}</td>
                            <td>{zahlung.notiz || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="info-text">Keine Zahlungen vorhanden</p>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rechnungsverwaltung;
