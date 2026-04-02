import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
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
import { fetchWithAuth } from '../utils/fetchWithAuth';


const Rechnungsverwaltung = () => {
  const { t } = useTranslation(['finance', 'common']);
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
        fetchWithAuth(`${config.apiBaseUrl}/rechnungen`),
        fetchWithAuth(`${config.apiBaseUrl}/rechnungen/statistiken`)
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
    if (!window.confirm(archivieren ? t('invoices.confirmArchive') : t('invoices.confirmUnarchive'))) {
      return;
    }

    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${rechnung_id}/archivieren`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiviert: archivieren })
      });

      if (res.ok) {
        alert(archivieren ? t('invoices.archived') : t('invoices.unarchived'));
        loadData();
      }
    } catch (error) {
      console.error('Fehler beim Archivieren:', error);
      alert(t('errors.savingError'));
    }
  };

  const handleDelete = async (rechnung_id) => {
    if (!window.confirm(t('invoices.confirmDelete'))) {
      return;
    }

    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${rechnung_id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        alert(t('invoices.deleted'));
        loadData();
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert(t('errors.savingError'));
    }
  };

  const handleShowDetails = async (rechnung_id) => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${rechnung_id}`);
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
      return <span className="badge badge-success">{t('invoices.status.paid')}</span>;
    } else if (rechnung.status === 'teilweise_bezahlt') {
      return <span className="badge badge-warning">{t('invoices.status.partiallyPaid')}</span>;
    } else if (faellig < heute) {
      return <span className="badge badge-danger">{t('invoices.status.overdue')}</span>;
    } else {
      return <span className="badge badge-info">{t('invoices.status.open')}</span>;
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
          <p>{t('common:messages.loading')}</p>
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
          {t('common:buttons.back')}
        </button>
        <div>
          <h1>📄 {t('invoices.title')}</h1>
          <p>{t('invoices.subtitle')}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/dashboard/rechnung-erstellen')}
        >
          <Plus size={20} />
          {t('invoices.create')}
        </button>
      </div>

      {/* Statistiken */}
      <div className="stats-grid">
        <div className="stat-card info">
          <div className="stat-icon">
            <FileText size={32} />
          </div>
          <div className="stat-info">
            <h3>{t('cockpit.totalInvoices', 'Gesamt Rechnungen')}</h3>
            <p className="stat-value">{statistiken.gesamt_rechnungen}</p>
            <span className="stat-trend">{formatCurrency(statistiken.gesamt_summe)}</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">
            <Clock size={32} />
          </div>
          <div className="stat-info">
            <h3>{t('cockpit.openInvoices')}</h3>
            <p className="stat-value">{statistiken.offene_rechnungen}</p>
            <span className="stat-trend">{formatCurrency(statistiken.offene_summe)}</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <CheckCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>{t('cockpit.paidInvoices')}</h3>
            <p className="stat-value">{statistiken.bezahlte_rechnungen}</p>
            <span className="stat-trend">{formatCurrency(statistiken.bezahlte_summe)}</span>
          </div>
        </div>

        <div className="stat-card danger">
          <div className="stat-icon">
            <AlertCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>{t('cockpit.overdueInvoices')}</h3>
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
          {t('invoices.filters.all')}
        </button>
        <button
          className={`tab ${activeView === 'offen' ? 'active' : ''}`}
          onClick={() => setActiveView('offen')}
        >
          <Clock size={18} />
          {t('invoices.filters.open')}
        </button>
        <button
          className={`tab ${activeView === 'bezahlt' ? 'active' : ''}`}
          onClick={() => setActiveView('bezahlt')}
        >
          <CheckCircle size={18} />
          {t('invoices.filters.paid')}
        </button>
        <button
          className={`tab ${activeView === 'ueberfaellig' ? 'active' : ''}`}
          onClick={() => setActiveView('ueberfaellig')}
        >
          <AlertCircle size={18} />
          {t('invoices.filters.overdue')}
        </button>
        <button
          className={`tab ${activeView === 'archiv' ? 'active' : ''}`}
          onClick={() => setActiveView('archiv')}
        >
          <Archive size={18} />
          {t('invoices.filters.archive')}
        </button>
      </div>

      {/* Suchfeld */}
      <div className="search-bar">
        <Search size={20} />
        <input
          type="text"
          placeholder={t('invoices.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Rechnungstabelle */}
      <div className="rechnungen-table-container">
        {filteredRechnungen.length === 0 ? (
          <div className="empty-state">
            <FileText size={64} />
            <h3>{t('invoices.noInvoices')}</h3>
            <p>
              {activeView === 'alle' && t('invoices.emptyStates.all')}
              {activeView === 'offen' && t('invoices.emptyStates.open')}
              {activeView === 'bezahlt' && t('invoices.emptyStates.paid')}
              {activeView === 'ueberfaellig' && t('invoices.emptyStates.overdue')}
              {activeView === 'archiv' && t('invoices.emptyStates.archive')}
            </p>
          </div>
        ) : (
          <table className="rechnungen-table">
            <thead>
              <tr>
                <th>{t('invoices.columns.invoiceNumber')}</th>
                <th>{t('invoices.columns.member')}</th>
                <th>{t('invoices.columns.date')}</th>
                <th>{t('invoices.columns.dueDate')}</th>
                <th>{t('common:labels.type', 'Art')}</th>
                <th>{t('invoices.columns.amount')}</th>
                <th>{t('invoices.columns.status')}</th>
                <th>{t('invoices.columns.actions')}</th>
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
                      {rechnung.art === 'mitgliedsbeitrag' && t('invoices.types.membershipFee')}
                      {rechnung.art === 'pruefungsgebuehr' && t('invoices.types.examFee')}
                      {rechnung.art === 'kursgebuehr' && t('invoices.types.courseFee')}
                      {rechnung.art === 'ausruestung' && t('invoices.types.equipment')}
                      {rechnung.art === 'sonstiges' && t('invoices.types.other')}
                    </span>
                  </td>
                  <td><strong>{formatCurrency(rechnung.betrag)}</strong></td>
                  <td>{getStatusBadge(rechnung)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon btn-info"
                        onClick={() => handleShowDetails(rechnung.rechnung_id)}
                        title={t('invoices.tooltips.viewDetails')}
                      >
                        <Eye size={16} />
                      </button>
                      {rechnung.archiviert === 0 ? (
                        <button
                          className="btn-icon btn-secondary"
                          onClick={() => handleArchivieren(rechnung.rechnung_id, true)}
                          title={t('invoices.tooltips.archive')}
                        >
                          <Archive size={16} />
                        </button>
                      ) : (
                        <button
                          className="btn-icon btn-success"
                          onClick={() => handleArchivieren(rechnung.rechnung_id, false)}
                          title={t('invoices.tooltips.restore')}
                        >
                          <Archive size={16} />
                        </button>
                      )}
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleDelete(rechnung.rechnung_id)}
                        title={t('invoices.tooltips.delete')}
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
              <h2 className="modal-title">{t('invoices.details')}</h2>
              <button className="close-btn" onClick={closeModal} title={t('common:buttons.close')}>
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
                <span className="tab-label">{t('invoices.tabs.details')}</span>
              </button>
              <button
                className={`tab ${modalActiveTab === 'positionen' ? 'active' : ''}`}
                onClick={() => setModalActiveTab('positionen')}
              >
                <DollarSign size={18} className="tab-icon" />
                <span className="tab-label">{t('invoices.tabs.positions')}</span>
              </button>
              <button
                className={`tab ${modalActiveTab === 'zahlungen' ? 'active' : ''}`}
                onClick={() => setModalActiveTab('zahlungen')}
              >
                <CheckCircle size={18} className="tab-icon" />
                <span className="tab-label">{t('invoices.tabs.payments')}</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="modal-body">
              {modalActiveTab === 'details' && (
                <div className="detail-section">
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>{t('invoices.columns.invoiceNumber')}</label>
                      <div className="detail-value"><strong>{modalRechnung.rechnungsnummer}</strong></div>
                    </div>
                    <div className="detail-item">
                      <label>{t('invoices.columns.member')}</label>
                      <div className="detail-value">{modalRechnung.mitglied_name}</div>
                    </div>
                    <div className="detail-item">
                      <label>{t('invoices.columns.date')}</label>
                      <div className="detail-value">{formatDate(modalRechnung.datum)}</div>
                    </div>
                    <div className="detail-item">
                      <label>{t('invoices.columns.dueDate')}</label>
                      <div className="detail-value">{formatDate(modalRechnung.faelligkeitsdatum)}</div>
                    </div>
                    <div className="detail-item">
                      <label>{t('common:labels.type', 'Art')}</label>
                      <div className="detail-value">
                        {modalRechnung.art === 'mitgliedsbeitrag' && t('invoices.types.membershipFee')}
                        {modalRechnung.art === 'pruefungsgebuehr' && t('invoices.types.examFee')}
                        {modalRechnung.art === 'kursgebuehr' && t('invoices.types.courseFee')}
                        {modalRechnung.art === 'ausruestung' && t('invoices.types.equipment')}
                        {modalRechnung.art === 'sonstiges' && t('invoices.types.other')}
                      </div>
                    </div>
                    <div className="detail-item">
                      <label>{t('invoices.columns.status')}</label>
                      <div className="detail-value">{getStatusBadge(modalRechnung)}</div>
                    </div>
                    <div className="detail-item">
                      <label>{t('invoices.columns.amount')}</label>
                      <div className="detail-value"><strong>{formatCurrency(modalRechnung.betrag)}</strong></div>
                    </div>
                    <div className="detail-item">
                      <label>{t('invoices.form.description')}</label>
                      <div className="detail-value">{modalRechnung.beschreibung || '-'}</div>
                    </div>
                  </div>
                </div>
              )}

              {modalActiveTab === 'positionen' && (
                <div className="detail-section">
                  <h3>{t('invoices.tabs.positions')}</h3>
                  {modalRechnung.positionen && modalRechnung.positionen.length > 0 ? (
                    <table className="rechnungen-table">
                      <thead>
                        <tr>
                          <th>{t('invoices.positionsTable.position')}</th>
                          <th>{t('invoices.positionsTable.description')}</th>
                          <th>{t('invoices.positionsTable.quantity')}</th>
                          <th>{t('invoices.positionsTable.unitPrice')}</th>
                          <th>{t('invoices.positionsTable.total')}</th>
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
                    <p className="info-text">{t('invoices.positionsTable.noPositions')}</p>
                  )}
                </div>
              )}

              {modalActiveTab === 'zahlungen' && (
                <div className="detail-section">
                  <h3>{t('invoices.paymentsTable.title')}</h3>
                  {modalRechnung.zahlungen && modalRechnung.zahlungen.length > 0 ? (
                    <table className="rechnungen-table">
                      <thead>
                        <tr>
                          <th>{t('invoices.paymentsTable.date')}</th>
                          <th>{t('invoices.paymentsTable.amount')}</th>
                          <th>{t('invoices.paymentsTable.method')}</th>
                          <th>{t('invoices.paymentsTable.note')}</th>
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
                    <p className="info-text">{t('invoices.paymentsTable.noPayments')}</p>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>
                {t('common:buttons.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rechnungsverwaltung;
