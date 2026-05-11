import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Plus,
  Search,
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
  Calendar,
  Mail,
  FileDown,
  Printer,
  CreditCard,
  Save,
  X
} from "lucide-react";
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Rechnungsverwaltung.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';


const BUCHUNGSKATEGORIEN = [
  { id: 'betriebseinnahmen', name: 'Betriebseinnahmen' },
  { id: 'wareneingang', name: 'Wareneingang' },
  { id: 'personalkosten', name: 'Personalkosten' },
  { id: 'raumkosten', name: 'Raumkosten' },
  { id: 'versicherungen', name: 'Versicherungen' },
  { id: 'kfz_kosten', name: 'KFZ-Kosten' },
  { id: 'werbekosten', name: 'Werbekosten' },
  { id: 'reisekosten', name: 'Reisekosten' },
  { id: 'telefon_internet', name: 'Telefon/Internet' },
  { id: 'software', name: 'Software / IT' },
  { id: 'buerokosten', name: 'Bürokosten' },
  { id: 'fortbildung', name: 'Fortbildung' },
  { id: 'abschreibungen', name: 'Abschreibungen' },
  { id: 'bankgebuehren', name: 'Kontoführungsgebühren' },
  { id: 'ausstattung', name: 'Betriebs-/Geschäftsausstattung' },
  { id: 'sonstige_kosten', name: 'Sonstige Kosten' },
  { id: 'steuerzahlungen', name: 'Steuerzahlungen / Finanzamt' },
];

const Rechnungsverwaltung = () => {
  const { t } = useTranslation(['finance', 'common']);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('alle');
  const [searchTerm, setSearchTerm] = useState('');
  const [rechnungen, setRechnungen] = useState([]);
  const [filteredRechnungen, setFilteredRechnungen] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalRechnung, setModalRechnung] = useState(null);
  const [modalActiveTab, setModalActiveTab] = useState('details');
  const [vorschauOverlay, setVorschauOverlay] = useState(null); // blob URL für Vollbild-Overlay
  const [posKategorien, setPosKategorien] = useState({}); // position_id → buchungskategorie
  const [defaultKategorie, setDefaultKategorie] = useState('');
  const [posKatSaving, setPosKatSaving] = useState(false);
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

  // Edit-Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editRechnung, setEditRechnung] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);

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
    if (!window.confirm(archivieren ? t('invoices.confirmArchive') : t('invoices.confirmUnarchive'))) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${rechnung_id}/archivieren`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiviert: archivieren })
      });
      if (res.ok) { loadData(); }
    } catch (error) { console.error('Fehler beim Archivieren:', error); }
  };

  const handleDelete = async (rechnung_id) => {
    if (!window.confirm(t('invoices.confirmDelete'))) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${rechnung_id}`, { method: 'DELETE' });
      if (res.ok) { loadData(); }
    } catch (error) { console.error('Fehler beim Löschen:', error); }
  };

  const handleShowDetails = async (rechnung_id) => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${rechnung_id}`);
      if (res.ok) {
        const data = await res.json();
        const r = data.data;
        setModalRechnung(r);
        setModalActiveTab('details');
        // Kategorie-Zustände initialisieren
        setDefaultKategorie(r.buchungskategorie_default || '');
        const map = {};
        (r.positionen || []).forEach(p => { map[p.position_id] = p.buchungskategorie || ''; });
        setPosKategorien(map);
        setShowModal(true);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Rechnung:', error);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setModalRechnung(null);
  };

  const handleModalTab = (tab) => {
    setModalActiveTab(tab);
  };

  const openVorschauOverlay = async () => {
    if (!modalRechnung) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${modalRechnung.rechnung_id}/vorschau`);
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      setVorschauOverlay(URL.createObjectURL(blob));
    } catch (e) { /* ignore */ }
  };

  const closeVorschauOverlay = () => {
    if (vorschauOverlay) { URL.revokeObjectURL(vorschauOverlay); }
    setVorschauOverlay(null);
  };

  const [emailSending, setEmailSending] = useState(null);
  const [emailModal, setEmailModal] = useState(null); // { rechnung, inputEmail, step: 'input'|'save-prompt', sentEmail }

  const savePosKategorien = async () => {
    if (!modalRechnung) return;
    setPosKatSaving(true);
    try {
      const positionen_kategorien = (modalRechnung.positionen || []).map(p => ({
        position_id: p.position_id,
        buchungskategorie: posKategorien[p.position_id] || null
      }));
      await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${modalRechnung.rechnung_id}/positionen-kategorien`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buchungskategorie_default: defaultKategorie || null, positionen_kategorien })
      });
      // Lokalen Zustand aktualisieren
      setModalRechnung(r => ({
        ...r,
        buchungskategorie_default: defaultKategorie || null,
        positionen: (r.positionen || []).map(p => ({ ...p, buchungskategorie: posKategorien[p.position_id] || null }))
      }));
    } catch (e) { /* ignore */ }
    setPosKatSaving(false);
  };

  const handleEmailSenden = (rechnung) => {
    if (rechnung.email) {
      // E-Mail bekannt → direkt zum Bestätigungs-Schritt
      setEmailModal({ rechnung, inputEmail: rechnung.email, step: 'confirm', sentEmail: '' });
    } else {
      // Keine E-Mail → Eingabe anfordern
      setEmailModal({ rechnung, inputEmail: '', step: 'input', sentEmail: '' });
    }
  };

  const doSendEmail = async () => {
    const { rechnung, inputEmail } = emailModal;
    if (!inputEmail || !inputEmail.includes('@')) return;
    setEmailSending(rechnung.rechnung_id);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${rechnung.rechnung_id}/email-senden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ an_email: inputEmail })
      });
      const data = await res.json();
      if (res.ok) {
        // Wenn die E-Mail neu eingegeben wurde → Speichern anbieten
        if (!rechnung.email) {
          setEmailModal(m => ({ ...m, step: 'save-prompt', sentEmail: inputEmail }));
        } else {
          setEmailModal(null);
          loadData();
        }
      } else {
        alert(`Fehler: ${data.error || 'E-Mail konnte nicht gesendet werden'}`);
      }
    } catch (e) {
      alert('Fehler beim E-Mail-Versand');
    } finally {
      setEmailSending(null);
    }
  };

  const doSaveEmail = async (save) => {
    if (save) {
      try {
        await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${emailModal.rechnung.rechnung_id}/empfaenger-email`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailModal.sentEmail })
        });
      } catch (e) { /* ignorieren */ }
    }
    setEmailModal(null);
    loadData();
  };

  const openVorschau = async (rechnung_id, doPrint = false) => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${rechnung_id}/vorschau`);
      const html = await res.text();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (doPrint && w) {
        w.addEventListener('load', () => { w.focus(); w.print(); });
      }
    } catch (e) {
      alert('Fehler beim Laden der Vorschau');
    }
  };

  const handlePdfOeffnen = (rechnung_id) => openVorschau(rechnung_id, false);

  const handleDrucken = async (rechnung_id) => {
    openVorschau(rechnung_id, true);
    // Drucken protokollieren
    try {
      await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${rechnung_id}/aktion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ typ: 'gedruckt' })
      });
      loadData();
    } catch (e) { /* non-critical */ }
  };

  // Edit-Modal öffnen
  const handleBearbeiten = async (rechnung) => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${rechnung.rechnung_id}`);
      if (!res.ok) throw new Error('Fehler beim Laden');
      const data = await res.json();
      navigate('/dashboard/rechnung-erstellen', {
        state: { editMode: true, rechnung: data.data }
      });
    } catch (e) {
      alert('Rechnung konnte nicht geladen werden');
    }
  };

  const handleEditSave = async () => {
    if (!editRechnung) return;
    setEditSaving(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/rechnungen/${editRechnung.rechnung_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: editRechnung.status,
          beschreibung: editForm.beschreibung,
          notizen: editForm.notizen,
          bezahlt_am: editRechnung.bezahlt_am || null,
          zahlungsart: editForm.zahlungsart || null,
          betrag: editForm.betrag || null
        })
      });
      if (res.ok) {
        setShowEditModal(false);
        loadData();
      } else {
        const d = await res.json();
        alert(d.error || 'Fehler beim Speichern');
      }
    } catch (e) {
      alert('Fehler beim Speichern');
    } finally {
      setEditSaving(false);
    }
  };

  const getStatusBadge = (rechnung) => {
    const faellig = new Date(rechnung.faelligkeitsdatum);
    const heute = new Date();
    if (rechnung.status === 'bezahlt') return <span className="badge badge-success">{t('invoices.status.paid')}</span>;
    if (rechnung.status === 'teilweise_bezahlt') return <span className="badge badge-warning">{t('invoices.status.partiallyPaid')}</span>;
    if (faellig < heute) return <span className="badge badge-danger">{t('invoices.status.overdue')}</span>;
    return <span className="badge badge-info">{t('invoices.status.open')}</span>;
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount || 0);

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('de-DE') : '-';

  const formatDateShort = (ts) => {
    if (!ts) return null;
    const d = new Date(ts);
    return `${d.toLocaleDateString('de-DE')} ${d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const VermerkeBadges = ({ rechnung }) => (
    <div className="vermerke-badges">
      {rechnung.email_gesendet_am && (
        <span className="vermerk-chip vermerk-email" title={`E-Mail gesendet: ${formatDateShort(rechnung.email_gesendet_am)}${rechnung.email_gesendet_anzahl > 1 ? ` (${rechnung.email_gesendet_anzahl}x)` : ''}`}>
          <Mail size={11} /> {rechnung.email_gesendet_anzahl > 1 ? `${rechnung.email_gesendet_anzahl}x` : '✓'}
        </span>
      )}
      {rechnung.gedruckt_am && (
        <span className="vermerk-chip vermerk-druck" title={`Gedruckt: ${formatDateShort(rechnung.gedruckt_am)}`}>
          <Printer size={11} /> ✓
        </span>
      )}
      {rechnung.lastschrift_am && (
        <span className="vermerk-chip vermerk-lastschrift" title={`Lastschrift eingezogen: ${formatDateShort(rechnung.lastschrift_am)}`}>
          <CreditCard size={11} /> ✓
        </span>
      )}
    </div>
  );

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
      {/* Kompakter Header */}
      <div className="rechnungen-header-compact">
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/dashboard/beitraege')}>
          <ArrowLeft size={16} />
          {t('common:buttons.back')}
        </button>
        <div className="header-title-area">
          <h1>📄 {t('invoices.title')}</h1>
          <p>{t('invoices.subtitle')}</p>
        </div>
      </div>

      {/* Kompakte Statistik-Chips */}
      <div className="stats-chips-row">
        <div className="stat-chip stat-chip-info">
          <FileText size={14} />
          <span className="stat-chip-label">Gesamt</span>
          <span className="stat-chip-value">{statistiken.gesamt_rechnungen}</span>
          <span className="stat-chip-amount">{formatCurrency(statistiken.gesamt_summe)}</span>
        </div>
        <div className="stat-chip stat-chip-warning">
          <Clock size={14} />
          <span className="stat-chip-label">Offen</span>
          <span className="stat-chip-value">{statistiken.offene_rechnungen}</span>
          <span className="stat-chip-amount">{formatCurrency(statistiken.offene_summe)}</span>
        </div>
        <div className="stat-chip stat-chip-success">
          <CheckCircle size={14} />
          <span className="stat-chip-label">Bezahlt</span>
          <span className="stat-chip-value">{statistiken.bezahlte_rechnungen}</span>
          <span className="stat-chip-amount">{formatCurrency(statistiken.bezahlte_summe)}</span>
        </div>
        <div className="stat-chip stat-chip-danger">
          <AlertCircle size={14} />
          <span className="stat-chip-label">Ueberfaellig</span>
          <span className="stat-chip-value">{statistiken.ueberfaellige_rechnungen}</span>
          <span className="stat-chip-amount">{formatCurrency(statistiken.ueberfaellige_summe)}</span>
        </div>
      </div>

      {/* Kontroll-Leiste: Tabs + Suche + Neue Rechnung */}
      <div className="control-bar">
        <div className="view-tabs">
          <button className={`tab ${activeView === 'alle' ? 'active' : ''}`} onClick={() => setActiveView('alle')}>
            <FileText size={15} /> {t('invoices.filters.all')}
          </button>
          <button className={`tab ${activeView === 'offen' ? 'active' : ''}`} onClick={() => setActiveView('offen')}>
            <Clock size={15} /> {t('invoices.filters.open')}
          </button>
          <button className={`tab ${activeView === 'bezahlt' ? 'active' : ''}`} onClick={() => setActiveView('bezahlt')}>
            <CheckCircle size={15} /> {t('invoices.filters.paid')}
          </button>
          <button className={`tab ${activeView === 'ueberfaellig' ? 'active' : ''}`} onClick={() => setActiveView('ueberfaellig')}>
            <AlertCircle size={15} /> {t('invoices.filters.overdue')}
          </button>
          <button className={`tab ${activeView === 'archiv' ? 'active' : ''}`} onClick={() => setActiveView('archiv')}>
            <Archive size={15} /> {t('invoices.filters.archive')}
          </button>
        </div>
        <div className="control-bar-right">
          <div className="search-bar-inline">
            <Search size={15} />
            <input
              type="text"
              placeholder="Suche..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard/rechnung-erstellen')}>
            <Plus size={15} />
            {t('invoices.create')}
          </button>
        </div>
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
                <th>Vermerke</th>
                <th>{t('invoices.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRechnungen.map(rechnung => (
                <tr key={rechnung.rechnung_id}>
                  <td><strong>{rechnung.rechnungsnummer}</strong></td>
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
                  <td><VermerkeBadges rechnung={rechnung} /></td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon btn-info" onClick={() => handleShowDetails(rechnung.rechnung_id)} title="Details">
                        <Eye size={14} />
                      </button>
                      <button className="btn-icon" onClick={() => handleBearbeiten(rechnung)} title="Bearbeiten">
                        <Edit size={14} />
                      </button>
                      <button
                        className="btn-icon btn-primary"
                        onClick={() => handleEmailSenden(rechnung)}
                        title="Per E-Mail senden"
                        disabled={emailSending === rechnung.rechnung_id}
                      >
                        <Mail size={14} />
                      </button>
                      <button className="btn-icon btn-secondary" onClick={() => handlePdfOeffnen(rechnung.rechnung_id)} title="PDF öffnen">
                        <FileDown size={14} />
                      </button>
                      <button className="btn-icon btn-secondary" onClick={() => handleDrucken(rechnung.rechnung_id)} title="Drucken">
                        <Printer size={14} />
                      </button>
                      {rechnung.archiviert === 0 ? (
                        <button className="btn-icon btn-secondary" onClick={() => handleArchivieren(rechnung.rechnung_id, true)} title={t('invoices.tooltips.archive')}>
                          <Archive size={14} />
                        </button>
                      ) : (
                        <button className="btn-icon btn-success" onClick={() => handleArchivieren(rechnung.rechnung_id, false)} title={t('invoices.tooltips.restore')}>
                          <Archive size={14} />
                        </button>
                      )}
                      <button className="btn-icon btn-danger" onClick={() => handleDelete(rechnung.rechnung_id)} title={t('invoices.tooltips.delete')}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail-Modal */}
      {showModal && modalRechnung && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content extra-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('invoices.details')}</h2>
              <button className="close-btn" onClick={closeModal}>×</button>
            </div>

            <div className="tabs-container">
              <button className={`tab ${modalActiveTab === 'details' ? 'active' : ''}`} onClick={() => handleModalTab('details')}>
                <FileText size={16} className="tab-icon" /><span className="tab-label">{t('invoices.tabs.details')}</span>
              </button>
              <button className={`tab ${modalActiveTab === 'positionen' ? 'active' : ''}`} onClick={() => handleModalTab('positionen')}>
                <DollarSign size={16} className="tab-icon" /><span className="tab-label">{t('invoices.tabs.positions')}</span>
              </button>
              <button className={`tab ${modalActiveTab === 'zahlungen' ? 'active' : ''}`} onClick={() => handleModalTab('zahlungen')}>
                <CheckCircle size={16} className="tab-icon" /><span className="tab-label">{t('invoices.tabs.payments')}</span>
              </button>
            </div>

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

                  {/* Vermerke im Modal */}
                  <div className="vermerke-section">
                    <h4 className="vermerke-title">Vermerke</h4>
                    <div className="vermerke-list">
                      {modalRechnung.email_gesendet_am ? (
                        <div className="vermerk-item vermerk-email">
                          <Mail size={14} />
                          <span>E-Mail gesendet am {formatDateShort(modalRechnung.email_gesendet_am)}</span>
                          {modalRechnung.email_gesendet_anzahl > 1 && <span className="vermerk-count">({modalRechnung.email_gesendet_anzahl}x)</span>}
                        </div>
                      ) : (
                        <div className="vermerk-item vermerk-empty"><Mail size={14} /><span>Noch nicht per E-Mail versendet</span></div>
                      )}
                      {modalRechnung.gedruckt_am ? (
                        <div className="vermerk-item vermerk-druck">
                          <Printer size={14} />
                          <span>Gedruckt am {formatDateShort(modalRechnung.gedruckt_am)}</span>
                        </div>
                      ) : (
                        <div className="vermerk-item vermerk-empty"><Printer size={14} /><span>Noch nicht gedruckt</span></div>
                      )}
                      {modalRechnung.lastschrift_am ? (
                        <div className="vermerk-item vermerk-lastschrift">
                          <CreditCard size={14} />
                          <span>Lastschrift eingezogen am {formatDateShort(modalRechnung.lastschrift_am)}</span>
                        </div>
                      ) : (
                        <div className="vermerk-item vermerk-empty"><CreditCard size={14} /><span>Kein Lastschrift-Einzug</span></div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {modalActiveTab === 'positionen' && (
                <div className="detail-section">
                  {/* Gesamtzuordnung */}
                  <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <label style={{ fontWeight: 600, whiteSpace: 'nowrap', minWidth: 160 }}>Gesamtzuordnung (alle):</label>
                      <select
                        value={defaultKategorie}
                        onChange={e => {
                          const val = e.target.value;
                          setDefaultKategorie(val);
                          if (val) {
                            const updated = {};
                            (modalRechnung.positionen || []).forEach(p => { updated[p.position_id] = val; });
                            setPosKategorien(updated);
                          }
                        }}
                        style={{ flex: 1, minWidth: 200, background: 'var(--surface-1)', color: 'var(--text-1)', border: '1px solid var(--primary-alpha-20)', borderRadius: 6, padding: '6px 8px' }}
                      >
                        <option value="">— Kategorie wählen —</option>
                        {BUCHUNGSKATEGORIEN.map(k => (
                          <option key={k.id} value={k.id}>{k.name}</option>
                        ))}
                      </select>
                      <button className="btn btn-primary" onClick={savePosKategorien} disabled={posKatSaving} style={{ whiteSpace: 'nowrap' }}>
                        <Save size={14} /> {posKatSaving ? 'Speichert…' : 'Speichern'}
                      </button>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
                      Kategorie für alle Positionen setzen — oder unten pro Position individuell zuweisen.
                    </p>
                  </div>

                  {/* Positionen-Tabelle mit per-Position Kategorie */}
                  {modalRechnung.positionen && modalRechnung.positionen.length > 0 ? (
                    <table className="rechnungen-table">
                      <thead>
                        <tr>
                          <th style={{ width: 36 }}>#</th>
                          <th>Bezeichnung</th>
                          <th style={{ width: 60 }}>Menge</th>
                          <th style={{ width: 90 }}>Einzelpr.</th>
                          <th style={{ width: 90 }}>Gesamt</th>
                          <th style={{ minWidth: 180 }}>Buchungskategorie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {modalRechnung.positionen.map((pos) => (
                          <tr key={pos.position_id}>
                            <td>{pos.position_nr}</td>
                            <td>{pos.bezeichnung}</td>
                            <td>{pos.menge}</td>
                            <td>{formatCurrency(pos.einzelpreis)}</td>
                            <td><strong>{formatCurrency(pos.gesamtpreis || (pos.menge * pos.einzelpreis))}</strong></td>
                            <td>
                              <select
                                value={posKategorien[pos.position_id] || ''}
                                onChange={e => setPosKategorien(m => ({ ...m, [pos.position_id]: e.target.value }))}
                                style={{ width: '100%', background: 'var(--surface-1)', color: 'var(--text-1)', border: '1px solid var(--primary-alpha-20)', borderRadius: 6, padding: '4px 6px', fontSize: '0.82rem' }}
                              >
                                <option value="">— wählen —</option>
                                {BUCHUNGSKATEGORIEN.map(k => (
                                  <option key={k.id} value={k.id}>{k.name}</option>
                                ))}
                              </select>
                            </td>
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
              <button className="btn btn-secondary" onClick={() => { closeModal(); handleBearbeiten(modalRechnung); }}>
                <Edit size={15} /> Bearbeiten
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleEmailSenden(modalRechnung)}
                disabled={emailSending === modalRechnung.rechnung_id}
              >
                <Mail size={15} />
                {emailSending === modalRechnung.rechnung_id ? 'Sendet…' : 'E-Mail senden'}
              </button>
              <button className="btn btn-secondary" onClick={openVorschauOverlay}>
                <Eye size={15} /> Vorschau
              </button>
              <button className="btn btn-secondary" onClick={() => handlePdfOeffnen(modalRechnung.rechnung_id)}>
                <FileDown size={15} /> PDF
              </button>
              <button className="btn btn-secondary" onClick={() => handleDrucken(modalRechnung.rechnung_id)}>
                <Printer size={15} /> Drucken
              </button>
              <button className="btn btn-secondary" onClick={closeModal}>
                {t('common:buttons.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vollbild-Vorschau-Overlay */}
      {vorschauOverlay && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          display: 'flex', flexDirection: 'column', background: '#fff'
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
            padding: '8px 16px', background: 'var(--bg-card, #1a1a2e)',
            borderBottom: '1px solid var(--border-color, #333)', flexShrink: 0
          }}>
            <button className="btn btn-secondary" onClick={closeVorschauOverlay} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={15} /> Schließen
            </button>
          </div>
          <iframe
            src={vorschauOverlay}
            title="Rechnungsvorschau"
            style={{ flex: 1, border: 'none', width: '100%' }}
          />
        </div>
      )}

      {/* E-Mail-Versand-Modal */}
      {emailModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEmailModal(null)}>
          <div className="modal-container" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2><Mail size={18} style={{ marginRight: 8 }} />Rechnung per E-Mail senden</h2>
              <button className="modal-close" onClick={() => setEmailModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {emailModal.step === 'input' && (
                <>
                  <p style={{ marginBottom: 12, color: 'var(--text-sekundaer)' }}>
                    Für <strong>{emailModal.rechnung.mitglied_name}</strong> ist keine E-Mail-Adresse hinterlegt.
                    Bitte Adresse eingeben:
                  </p>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="name@beispiel.de"
                    value={emailModal.inputEmail}
                    onChange={e => setEmailModal(m => ({ ...m, inputEmail: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && doSendEmail()}
                    autoFocus
                    style={{ width: '100%' }}
                  />
                </>
              )}
              {emailModal.step === 'confirm' && (
                <p style={{ marginBottom: 4 }}>
                  Rechnung <strong>{emailModal.rechnung.rechnungsnummer}</strong> an{' '}
                  <strong>{emailModal.inputEmail}</strong> senden?
                </p>
              )}
              {emailModal.step === 'save-prompt' && (
                <>
                  <p style={{ color: 'var(--erfolg-gruen, #27ae60)', marginBottom: 12 }}>
                    ✓ E-Mail erfolgreich gesendet.
                  </p>
                  <p>
                    Soll <strong>{emailModal.sentEmail}</strong> bei{' '}
                    <strong>{emailModal.rechnung.mitglied_name}</strong> als E-Mail-Adresse hinterlegt werden?
                  </p>
                </>
              )}
            </div>
            <div className="modal-footer">
              {emailModal.step === 'input' && (
                <>
                  <button className="btn btn-secondary" onClick={() => setEmailModal(null)}>Abbrechen</button>
                  <button
                    className="btn btn-primary"
                    onClick={doSendEmail}
                    disabled={!emailModal.inputEmail.includes('@') || emailSending === emailModal.rechnung.rechnung_id}
                  >
                    <Mail size={15} />
                    {emailSending === emailModal.rechnung.rechnung_id ? 'Sendet…' : 'Senden'}
                  </button>
                </>
              )}
              {emailModal.step === 'confirm' && (
                <>
                  <button className="btn btn-secondary" onClick={() => setEmailModal(null)}>Abbrechen</button>
                  <button
                    className="btn btn-primary"
                    onClick={doSendEmail}
                    disabled={emailSending === emailModal.rechnung.rechnung_id}
                  >
                    <Mail size={15} />
                    {emailSending === emailModal.rechnung.rechnung_id ? 'Sendet…' : 'Senden'}
                  </button>
                </>
              )}
              {emailModal.step === 'save-prompt' && (
                <>
                  <button className="btn btn-secondary" onClick={() => doSaveEmail(false)}>Nein</button>
                  <button className="btn btn-primary" onClick={() => doSaveEmail(true)}>
                    Ja, hinterlegen
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bearbeiten-Modal */}
      {showEditModal && editRechnung && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Rechnung bearbeiten</h2>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="detail-item">
                  <label>Rechnungsnummer</label>
                  <div className="detail-value"><strong>{editRechnung.rechnungsnummer}</strong></div>
                </div>
                <div className="detail-item">
                  <label>Beschreibung</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={editForm.beschreibung}
                    onChange={(e) => setEditForm(p => ({ ...p, beschreibung: e.target.value }))}
                    style={{ width: '100%', background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--primary-alpha-20)', borderRadius: 'var(--comp-radius-md)', padding: '0.5rem', resize: 'vertical' }}
                  />
                </div>
                <div className="detail-item">
                  <label>Notizen</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={editForm.notizen}
                    onChange={(e) => setEditForm(p => ({ ...p, notizen: e.target.value }))}
                    style={{ width: '100%', background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--primary-alpha-20)', borderRadius: 'var(--comp-radius-md)', padding: '0.5rem', resize: 'vertical' }}
                  />
                </div>
                <div className="detail-item">
                  <label>Faelligkeitsdatum</label>
                  <input
                    type="date"
                    value={editForm.faelligkeitsdatum}
                    onChange={(e) => setEditForm(p => ({ ...p, faelligkeitsdatum: e.target.value }))}
                    style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--primary-alpha-20)', borderRadius: 'var(--comp-radius-md)', padding: '0.5rem', width: '100%' }}
                  />
                </div>
                <div className="detail-item">
                  <label>Zahlungsart</label>
                  <select
                    value={editForm.zahlungsart}
                    onChange={(e) => setEditForm(p => ({ ...p, zahlungsart: e.target.value }))}
                    style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--primary-alpha-20)', borderRadius: 'var(--comp-radius-md)', padding: '0.5rem', width: '100%' }}
                  >
                    <option value="">-- keine --</option>
                    <option value="bar">Bar</option>
                    <option value="ueberweisung">Ueberweisung</option>
                    <option value="lastschrift">Lastschrift</option>
                    <option value="kreditkarte">Kreditkarte</option>
                    <option value="paypal">PayPal</option>
                  </select>
                </div>
                <div className="detail-item">
                  <label>Betrag (Brutto, inkl. MwSt.) — Netto/MwSt. wird neu berechnet</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.betrag}
                    onChange={(e) => setEditForm(p => ({ ...p, betrag: e.target.value }))}
                    style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--primary-alpha-20)', borderRadius: 'var(--comp-radius-md)', padding: '0.5rem', width: '100%' }}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={handleEditSave} disabled={editSaving}>
                <Save size={15} /> {editSaving ? 'Speichert…' : 'Speichern'}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                <X size={15} /> Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rechnungsverwaltung;
