// =============================================
// BUCHHALTUNG TAB - EÜR (Einnahmen-Überschuss-Rechnung)
// Super Admin Dashboard
// =============================================

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Calculator, FileText, Receipt, Download, Upload, Plus, Edit, Trash2, Lock, X,
  TrendingUp, TrendingDown, PieChart, Calendar, Filter, Search, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle, RefreshCw, Building2, Euro, FileSpreadsheet
} from 'lucide-react';
import '../styles/BuchhaltungTab.css';

const BuchhaltungTab = ({ token }) => {
  // Sub-Tab Navigation
  const [activeSubTab, setActiveSubTab] = useState('euer');

  // Filters
  const [selectedOrg, setSelectedOrg] = useState('alle');
  const [selectedJahr, setSelectedJahr] = useState(new Date().getFullYear());
  const [selectedQuartal, setSelectedQuartal] = useState('');

  // Data States
  const [dashboardData, setDashboardData] = useState(null);
  const [euerData, setEuerData] = useState(null);
  const [belege, setBelege] = useState([]);
  const [belegeTotal, setBelegeTotal] = useState(0);
  const [autoEinnahmen, setAutoEinnahmen] = useState([]);
  const [abschlussData, setAbschlussData] = useState(null);
  const [kategorien, setKategorien] = useState([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal States
  const [showBelegModal, setShowBelegModal] = useState(false);
  const [editingBeleg, setEditingBeleg] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadBelegId, setUploadBelegId] = useState(null);
  const [showAbschlussModal, setShowAbschlussModal] = useState(false);

  // Beleg Form State
  const [belegForm, setBelegForm] = useState({
    organisation_name: 'TDA International',
    buchungsart: 'ausgabe',
    beleg_datum: new Date().toISOString().split('T')[0],
    buchungsdatum: new Date().toISOString().split('T')[0],
    betrag_netto: '',
    mwst_satz: '19',
    kategorie: 'sonstige_kosten',
    beschreibung: '',
    lieferant_kunde: '',
    rechnungsnummer_extern: ''
  });

  // Pagination
  const [belegePage, setBelegePage] = useState(1);
  const [belegeLimit] = useState(20);

  // Jahre für Dropdown
  const jahre = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    jahre.push(y);
  }

  // Kategorien laden
  const loadKategorien = useCallback(async () => {
    try {
      const res = await axios.get('/buchhaltung/kategorien', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setKategorien(res.data);
    } catch (err) {
      console.error('Kategorien laden fehlgeschlagen:', err);
    }
  }, [token]);

  // Dashboard Daten laden
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/buchhaltung/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg, jahr: selectedJahr }
      });
      setDashboardData(res.data);
    } catch (err) {
      console.error('Dashboard laden fehlgeschlagen:', err);
      setError('Dashboard konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, selectedJahr]);

  // EÜR Daten laden
  const loadEuer = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/buchhaltung/euer', {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg, jahr: selectedJahr, quartal: selectedQuartal || undefined }
      });
      setEuerData(res.data);
    } catch (err) {
      console.error('EÜR laden fehlgeschlagen:', err);
      setError('EÜR konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, selectedJahr, selectedQuartal]);

  // Belege laden
  const loadBelege = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/buchhaltung/belege', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          organisation: selectedOrg !== 'alle' ? selectedOrg : undefined,
          jahr: selectedJahr,
          seite: belegePage,
          limit: belegeLimit
        }
      });
      setBelege(res.data.belege);
      setBelegeTotal(res.data.pagination.total);
    } catch (err) {
      console.error('Belege laden fehlgeschlagen:', err);
      setError('Belege konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, selectedJahr, belegePage, belegeLimit]);

  // Auto-Einnahmen laden
  const loadAutoEinnahmen = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/buchhaltung/einnahmen-auto', {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg, jahr: selectedJahr }
      });
      setAutoEinnahmen(res.data.einnahmen);
    } catch (err) {
      console.error('Auto-Einnahmen laden fehlgeschlagen:', err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, selectedJahr]);

  // Abschluss laden
  const loadAbschluss = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/buchhaltung/abschluss/${selectedJahr}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg }
      });
      setAbschlussData(res.data);
    } catch (err) {
      console.error('Abschluss laden fehlgeschlagen:', err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, selectedJahr]);

  // Initial Load
  useEffect(() => {
    loadKategorien();
  }, [loadKategorien]);

  // Load data based on active sub-tab
  useEffect(() => {
    if (activeSubTab === 'euer') {
      loadDashboard();
      loadEuer();
    } else if (activeSubTab === 'belege') {
      loadBelege();
    } else if (activeSubTab === 'auto') {
      loadAutoEinnahmen();
    } else if (activeSubTab === 'abschluss') {
      loadAbschluss();
    }
  }, [activeSubTab, selectedOrg, selectedJahr, selectedQuartal, belegePage, loadDashboard, loadEuer, loadBelege, loadAutoEinnahmen, loadAbschluss]);

  // Beleg speichern
  const saveBeleg = async () => {
    try {
      setLoading(true);
      setError('');

      if (editingBeleg) {
        await axios.put(`/buchhaltung/belege/${editingBeleg.beleg_id}`, belegForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Beleg erfolgreich aktualisiert');
      } else {
        await axios.post('/buchhaltung/belege', belegForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Beleg erfolgreich erstellt');
      }

      setShowBelegModal(false);
      setEditingBeleg(null);
      resetBelegForm();
      loadBelege();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Beleg speichern fehlgeschlagen:', err);
      setError(err.response?.data?.message || 'Fehler beim Speichern des Belegs');
    } finally {
      setLoading(false);
    }
  };

  // Beleg stornieren
  const stornoBeleg = async (belegId) => {
    const grund = prompt('Bitte geben Sie einen Storno-Grund an:');
    if (!grund) return;

    try {
      setLoading(true);
      await axios.post(`/buchhaltung/belege/${belegId}/stornieren`, { grund }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Beleg erfolgreich storniert');
      loadBelege();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Stornieren');
    } finally {
      setLoading(false);
    }
  };

  // Beleg festschreiben
  const festschreibenBeleg = async (belegId) => {
    if (!confirm('Beleg wirklich festschreiben? Danach sind keine Änderungen mehr möglich.')) return;

    try {
      setLoading(true);
      await axios.post(`/buchhaltung/belege/${belegId}/festschreiben`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Beleg festgeschrieben');
      loadBelege();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Festschreiben');
    } finally {
      setLoading(false);
    }
  };

  // Datei Upload
  const uploadDatei = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadBelegId) return;

    const formData = new FormData();
    formData.append('datei', file);

    try {
      setLoading(true);
      await axios.post(`/buchhaltung/belege/${uploadBelegId}/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setSuccess('Datei erfolgreich hochgeladen');
      setShowUploadModal(false);
      setUploadBelegId(null);
      loadBelege();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Upload');
    } finally {
      setLoading(false);
    }
  };

  // Jahresabschluss festschreiben
  const festschreibenJahr = async () => {
    if (selectedOrg === 'alle') {
      setError('Bitte wählen Sie eine Organisation aus');
      return;
    }

    if (!confirm(`Jahresabschluss ${selectedJahr} für ${selectedOrg} wirklich festschreiben? Danach sind keine Änderungen mehr möglich.`)) return;

    try {
      setLoading(true);
      await axios.post(`/buchhaltung/abschluss/${selectedJahr}/festschreiben`, {
        organisation: selectedOrg
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Jahresabschluss festgeschrieben');
      setShowAbschlussModal(false);
      loadAbschluss();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Festschreiben');
    } finally {
      setLoading(false);
    }
  };

  // CSV Export
  const exportCSV = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/buchhaltung/abschluss/${selectedJahr}/export`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EUeR_${selectedJahr}_${selectedOrg || 'alle'}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccess('Export erfolgreich');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Export fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // Form Reset
  const resetBelegForm = () => {
    setBelegForm({
      organisation_name: 'TDA International',
      buchungsart: 'ausgabe',
      beleg_datum: new Date().toISOString().split('T')[0],
      buchungsdatum: new Date().toISOString().split('T')[0],
      betrag_netto: '',
      mwst_satz: '19',
      kategorie: 'sonstige_kosten',
      beschreibung: '',
      lieferant_kunde: '',
      rechnungsnummer_extern: ''
    });
  };

  // Beleg bearbeiten
  const editBeleg = (beleg) => {
    setEditingBeleg(beleg);
    setBelegForm({
      organisation_name: beleg.organisation_name,
      buchungsart: beleg.buchungsart,
      beleg_datum: beleg.beleg_datum?.split('T')[0],
      buchungsdatum: beleg.buchungsdatum?.split('T')[0],
      betrag_netto: beleg.betrag_netto,
      mwst_satz: beleg.mwst_satz,
      kategorie: beleg.kategorie,
      beschreibung: beleg.beschreibung,
      lieferant_kunde: beleg.lieferant_kunde || '',
      rechnungsnummer_extern: beleg.rechnungsnummer_extern || ''
    });
    setShowBelegModal(true);
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  // Kategorie Name
  const getKategorieName = (id) => {
    const kat = kategorien.find(k => k.id === id);
    return kat?.name || id;
  };

  // Sub-Tabs
  const subTabs = [
    { id: 'euer', label: 'EÜR Übersicht', icon: <PieChart size={16} /> },
    { id: 'belege', label: 'Belegerfassung', icon: <Receipt size={16} /> },
    { id: 'auto', label: 'Auto. Buchungen', icon: <RefreshCw size={16} /> },
    { id: 'abschluss', label: 'Jahresabschluss', icon: <FileSpreadsheet size={16} /> }
  ];

  return (
    <div className="buchhaltung-tab">
      {/* Header with Filters */}
      <div className="buchhaltung-header">
        <div className="header-title">
          <Calculator size={24} />
          <h2>Buchhaltung - EÜR</h2>
        </div>

        <div className="header-filters">
          <div className="filter-group">
            <label>Organisation:</label>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
            >
              <option value="alle">Alle Organisationen</option>
              <option value="TDA International">TDA International</option>
              <option value="Kampfkunstschule Schreiner">Kampfkunstschule Schreiner</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Jahr:</label>
            <select
              value={selectedJahr}
              onChange={(e) => setSelectedJahr(parseInt(e.target.value))}
            >
              {jahre.map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>

          {activeSubTab === 'euer' && (
            <div className="filter-group">
              <label>Quartal:</label>
              <select
                value={selectedQuartal}
                onChange={(e) => setSelectedQuartal(e.target.value)}
              >
                <option value="">Gesamtjahr</option>
                <option value="1">Q1 (Jan-Mär)</option>
                <option value="2">Q2 (Apr-Jun)</option>
                <option value="3">Q3 (Jul-Sep)</option>
                <option value="4">Q4 (Okt-Dez)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="message error">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="message success">
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {/* Sub-Tab Navigation */}
      <div className="sub-tabs">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            className={`sub-tab ${activeSubTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveSubTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Sub-Tab Content */}
      <div className="sub-tab-content">
        {/* ==================== EÜR ÜBERSICHT ==================== */}
        {activeSubTab === 'euer' && (
          <div className="euer-content">
            {/* Dashboard Cards */}
            {dashboardData && (
              <div className="dashboard-cards">
                <div className="dash-card einnahmen">
                  <div className="card-icon">
                    <TrendingUp size={24} />
                  </div>
                  <div className="card-content">
                    <span className="card-label">Einnahmen</span>
                    <span className="card-value">{formatCurrency(dashboardData.einnahmen?.gesamt)}</span>
                  </div>
                </div>

                <div className="dash-card ausgaben">
                  <div className="card-icon">
                    <TrendingDown size={24} />
                  </div>
                  <div className="card-content">
                    <span className="card-label">Ausgaben</span>
                    <span className="card-value">{formatCurrency(dashboardData.ausgaben?.gesamt)}</span>
                  </div>
                </div>

                <div className={`dash-card gewinn ${dashboardData.gewinnVerlust >= 0 ? 'positiv' : 'negativ'}`}>
                  <div className="card-icon">
                    <Euro size={24} />
                  </div>
                  <div className="card-content">
                    <span className="card-label">Gewinn/Verlust</span>
                    <span className="card-value">{formatCurrency(dashboardData.gewinnVerlust)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* EÜR Details */}
            {euerData && (
              <div className="euer-details">
                <div className="euer-section">
                  <h3>
                    <TrendingUp size={18} />
                    Einnahmen
                  </h3>
                  <table className="euer-table">
                    <thead>
                      <tr>
                        <th>Kategorie</th>
                        <th>Quelle</th>
                        <th className="right">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(euerData.einnahmen?.nachKategorie || {}).map(([kat, data]) => (
                        <React.Fragment key={kat}>
                          <tr className="kategorie-row">
                            <td colSpan="2"><strong>{getKategorieName(kat)}</strong></td>
                            <td className="right"><strong>{formatCurrency(data.summe)}</strong></td>
                          </tr>
                          {data.details?.map((detail, idx) => (
                            <tr key={`${kat}-${idx}`} className="detail-row">
                              <td></td>
                              <td>{detail.quelle} ({detail.anzahl}x)</td>
                              <td className="right">{formatCurrency(detail.summe)}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                      <tr className="total-row">
                        <td colSpan="2"><strong>Summe Einnahmen</strong></td>
                        <td className="right"><strong>{formatCurrency(euerData.einnahmen?.gesamt)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="euer-section">
                  <h3>
                    <TrendingDown size={18} />
                    Ausgaben
                  </h3>
                  <table className="euer-table">
                    <thead>
                      <tr>
                        <th>Kategorie</th>
                        <th>Quelle</th>
                        <th className="right">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(euerData.ausgaben?.nachKategorie || {}).map(([kat, data]) => (
                        <React.Fragment key={kat}>
                          <tr className="kategorie-row">
                            <td colSpan="2"><strong>{getKategorieName(kat)}</strong></td>
                            <td className="right"><strong>{formatCurrency(data.summe)}</strong></td>
                          </tr>
                          {data.details?.map((detail, idx) => (
                            <tr key={`${kat}-${idx}`} className="detail-row">
                              <td></td>
                              <td>{detail.quelle} ({detail.anzahl}x)</td>
                              <td className="right">{formatCurrency(detail.summe)}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                      <tr className="total-row">
                        <td colSpan="2"><strong>Summe Ausgaben</strong></td>
                        <td className="right"><strong>{formatCurrency(euerData.ausgaben?.gesamt)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Ergebnis */}
                <div className={`euer-ergebnis ${euerData.gewinnVerlust >= 0 ? 'positiv' : 'negativ'}`}>
                  <span>Ergebnis (Gewinn/Verlust):</span>
                  <span className="ergebnis-wert">{formatCurrency(euerData.gewinnVerlust)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== BELEGERFASSUNG ==================== */}
        {activeSubTab === 'belege' && (
          <div className="belege-content">
            <div className="belege-header">
              <h3>
                <Receipt size={18} />
                Manuelle Belege
              </h3>
              <button className="btn-primary" onClick={() => { resetBelegForm(); setEditingBeleg(null); setShowBelegModal(true); }}>
                <Plus size={16} />
                Neuer Beleg
              </button>
            </div>

            {/* Belege Tabelle */}
            <div className="belege-table-container">
              <table className="belege-table">
                <thead>
                  <tr>
                    <th>Beleg-Nr.</th>
                    <th>Datum</th>
                    <th>Organisation</th>
                    <th>Typ</th>
                    <th>Kategorie</th>
                    <th>Beschreibung</th>
                    <th className="right">Betrag</th>
                    <th>Status</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {belege.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="no-data">Keine Belege vorhanden</td>
                    </tr>
                  ) : (
                    belege.map(beleg => (
                      <tr key={beleg.beleg_id} className={beleg.storniert ? 'storniert' : ''}>
                        <td>{beleg.beleg_nummer}</td>
                        <td>{formatDate(beleg.beleg_datum)}</td>
                        <td>{beleg.organisation_name}</td>
                        <td>
                          <span className={`typ-badge ${beleg.buchungsart}`}>
                            {beleg.buchungsart === 'einnahme' ? 'Einnahme' : 'Ausgabe'}
                          </span>
                        </td>
                        <td>{getKategorieName(beleg.kategorie)}</td>
                        <td className="beschreibung-cell">{beleg.beschreibung}</td>
                        <td className="right">{formatCurrency(beleg.betrag_brutto)}</td>
                        <td>
                          {beleg.festgeschrieben && (
                            <span className="status-badge festgeschrieben">
                              <Lock size={12} /> Fest
                            </span>
                          )}
                          {beleg.datei_name && (
                            <span className="status-badge datei">
                              <FileText size={12} />
                            </span>
                          )}
                        </td>
                        <td className="actions">
                          {!beleg.festgeschrieben && (
                            <>
                              <button className="btn-icon" title="Bearbeiten" onClick={() => editBeleg(beleg)}>
                                <Edit size={14} />
                              </button>
                              <button className="btn-icon" title="Datei hochladen" onClick={() => { setUploadBelegId(beleg.beleg_id); setShowUploadModal(true); }}>
                                <Upload size={14} />
                              </button>
                              <button className="btn-icon" title="Festschreiben" onClick={() => festschreibenBeleg(beleg.beleg_id)}>
                                <Lock size={14} />
                              </button>
                              <button className="btn-icon danger" title="Stornieren" onClick={() => stornoBeleg(beleg.beleg_id)}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          {beleg.datei_name && (
                            <a
                              href={`${axios.defaults.baseURL}/buchhaltung/belege/${beleg.beleg_id}/datei`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-icon"
                              title="Datei anzeigen"
                            >
                              <FileText size={14} />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {belegeTotal > belegeLimit && (
              <div className="pagination">
                <button
                  disabled={belegePage === 1}
                  onClick={() => setBelegePage(p => Math.max(1, p - 1))}
                >
                  Zurück
                </button>
                <span>Seite {belegePage} von {Math.ceil(belegeTotal / belegeLimit)}</span>
                <button
                  disabled={belegePage >= Math.ceil(belegeTotal / belegeLimit)}
                  onClick={() => setBelegePage(p => p + 1)}
                >
                  Weiter
                </button>
              </div>
            )}
          </div>
        )}

        {/* ==================== AUTOMATISCHE BUCHUNGEN ==================== */}
        {activeSubTab === 'auto' && (
          <div className="auto-content">
            <div className="auto-header">
              <h3>
                <RefreshCw size={18} />
                Automatisch erfasste Einnahmen
              </h3>
              <p className="auto-info">
                Diese Einnahmen werden automatisch aus Rechnungen, Verkäufen, Mitgliedsbeiträgen
                und Verbandsbeiträgen übernommen.
              </p>
            </div>

            <div className="auto-table-container">
              <table className="auto-table">
                <thead>
                  <tr>
                    <th>Quelle</th>
                    <th>Datum</th>
                    <th>Organisation</th>
                    <th>Beschreibung</th>
                    <th className="right">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {autoEinnahmen.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="no-data">Keine automatischen Einnahmen gefunden</td>
                    </tr>
                  ) : (
                    autoEinnahmen.map((e, idx) => (
                      <tr key={idx}>
                        <td>
                          <span className={`quelle-badge ${e.quelle}`}>
                            {e.quelle === 'rechnung' && 'Rechnung'}
                            {e.quelle === 'verkauf' && 'Verkauf'}
                            {e.quelle === 'beitrag' && 'Mitgliedsbeitrag'}
                            {e.quelle === 'verbandsbeitrag' && 'Verbandsbeitrag'}
                            {e.quelle === 'beleg' && 'Beleg'}
                          </span>
                        </td>
                        <td>{formatDate(e.datum)}</td>
                        <td>{e.organisation_name}</td>
                        <td>{e.beschreibung}</td>
                        <td className="right">{formatCurrency(e.betrag_brutto)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== JAHRESABSCHLUSS ==================== */}
        {activeSubTab === 'abschluss' && (
          <div className="abschluss-content">
            <div className="abschluss-header">
              <h3>
                <FileSpreadsheet size={18} />
                Jahresabschluss {selectedJahr}
              </h3>
              <div className="abschluss-actions">
                <button className="btn-secondary" onClick={exportCSV}>
                  <Download size={16} />
                  CSV Export
                </button>
                {selectedOrg !== 'alle' && (!abschlussData?.abschluss || abschlussData.abschluss.status !== 'abgeschlossen') && (
                  <button className="btn-primary" onClick={() => setShowAbschlussModal(true)}>
                    <Lock size={16} />
                    Jahr festschreiben
                  </button>
                )}
              </div>
            </div>

            {abschlussData?.abschluss && (
              <div className={`abschluss-status ${abschlussData.abschluss.status}`}>
                <CheckCircle size={16} />
                Status: {abschlussData.abschluss.status}
                {abschlussData.abschluss.abgeschlossen_am && (
                  <span> - Festgeschrieben am {formatDate(abschlussData.abschluss.abgeschlossen_am)}</span>
                )}
              </div>
            )}

            {abschlussData?.berechnet && (
              <div className="abschluss-summary">
                <div className="summary-section">
                  <h4>Einnahmen nach Kategorie</h4>
                  <table className="summary-table">
                    <tbody>
                      {Object.entries(abschlussData.berechnet.einnahmen.details).map(([kat, summe]) => (
                        <tr key={kat}>
                          <td>{getKategorieName(kat)}</td>
                          <td className="right">{formatCurrency(summe)}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td><strong>Gesamt Einnahmen</strong></td>
                        <td className="right"><strong>{formatCurrency(abschlussData.berechnet.einnahmen.gesamt)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="summary-section">
                  <h4>Ausgaben nach Kategorie</h4>
                  <table className="summary-table">
                    <tbody>
                      {Object.entries(abschlussData.berechnet.ausgaben.details).map(([kat, summe]) => (
                        <tr key={kat}>
                          <td>{getKategorieName(kat)}</td>
                          <td className="right">{formatCurrency(summe)}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td><strong>Gesamt Ausgaben</strong></td>
                        <td className="right"><strong>{formatCurrency(abschlussData.berechnet.ausgaben.gesamt)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className={`abschluss-ergebnis ${abschlussData.berechnet.gewinnVerlust >= 0 ? 'positiv' : 'negativ'}`}>
                  <span>Jahresergebnis:</span>
                  <span className="ergebnis-wert">{formatCurrency(abschlussData.berechnet.gewinnVerlust)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== BELEG MODAL ==================== */}
      {showBelegModal && (
        <div className="modal-overlay" onClick={() => setShowBelegModal(false)}>
          <div className="modal beleg-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingBeleg ? 'Beleg bearbeiten' : 'Neuer Beleg'}</h3>
              <button className="close-btn" onClick={() => setShowBelegModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Organisation *</label>
                  <select
                    value={belegForm.organisation_name}
                    onChange={e => setBelegForm(f => ({ ...f, organisation_name: e.target.value }))}
                  >
                    <option value="TDA International">TDA International</option>
                    <option value="Kampfkunstschule Schreiner">Kampfkunstschule Schreiner</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Buchungsart *</label>
                  <select
                    value={belegForm.buchungsart}
                    onChange={e => setBelegForm(f => ({ ...f, buchungsart: e.target.value }))}
                  >
                    <option value="ausgabe">Ausgabe</option>
                    <option value="einnahme">Einnahme</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Belegdatum *</label>
                  <input
                    type="date"
                    value={belegForm.beleg_datum}
                    onChange={e => setBelegForm(f => ({ ...f, beleg_datum: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Buchungsdatum *</label>
                  <input
                    type="date"
                    value={belegForm.buchungsdatum}
                    onChange={e => setBelegForm(f => ({ ...f, buchungsdatum: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Betrag Netto (EUR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={belegForm.betrag_netto}
                    onChange={e => setBelegForm(f => ({ ...f, betrag_netto: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group">
                  <label>MwSt-Satz (%)</label>
                  <select
                    value={belegForm.mwst_satz}
                    onChange={e => setBelegForm(f => ({ ...f, mwst_satz: e.target.value }))}
                  >
                    <option value="19">19%</option>
                    <option value="7">7%</option>
                    <option value="0">0% (steuerfrei)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Kategorie *</label>
                <select
                  value={belegForm.kategorie}
                  onChange={e => setBelegForm(f => ({ ...f, kategorie: e.target.value }))}
                >
                  {kategorien
                    .filter(k => belegForm.buchungsart === 'einnahme' ? k.typ === 'einnahme' : k.typ === 'ausgabe')
                    .map(k => (
                      <option key={k.id} value={k.id}>{k.name} - {k.beschreibung}</option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label>Beschreibung *</label>
                <textarea
                  value={belegForm.beschreibung}
                  onChange={e => setBelegForm(f => ({ ...f, beschreibung: e.target.value }))}
                  placeholder="Beschreibung des Belegs..."
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Lieferant / Kunde</label>
                  <input
                    type="text"
                    value={belegForm.lieferant_kunde}
                    onChange={e => setBelegForm(f => ({ ...f, lieferant_kunde: e.target.value }))}
                    placeholder="Name des Lieferanten/Kunden"
                  />
                </div>

                <div className="form-group">
                  <label>Externe Rechnungsnummer</label>
                  <input
                    type="text"
                    value={belegForm.rechnungsnummer_extern}
                    onChange={e => setBelegForm(f => ({ ...f, rechnungsnummer_extern: e.target.value }))}
                    placeholder="z.B. RE-2024-001"
                  />
                </div>
              </div>

              {/* Brutto Vorschau */}
              <div className="brutto-preview">
                <span>Brutto-Betrag:</span>
                <span className="brutto-wert">
                  {formatCurrency(
                    parseFloat(belegForm.betrag_netto || 0) *
                    (1 + parseFloat(belegForm.mwst_satz || 0) / 100)
                  )}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowBelegModal(false)}>
                Abbrechen
              </button>
              <button
                className="btn-primary"
                onClick={saveBeleg}
                disabled={loading || !belegForm.betrag_netto || !belegForm.beschreibung}
              >
                {loading ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== UPLOAD MODAL ==================== */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal upload-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Beleg-Datei hochladen</h3>
              <button className="close-btn" onClick={() => setShowUploadModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="upload-info">
                <Upload size={48} />
                <p>Erlaubte Formate: PDF, JPG, PNG (max. 10MB)</p>
              </div>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={uploadDatei}
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================== ABSCHLUSS MODAL ==================== */}
      {showAbschlussModal && (
        <div className="modal-overlay" onClick={() => setShowAbschlussModal(false)}>
          <div className="modal abschluss-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Jahr {selectedJahr} festschreiben</h3>
              <button className="close-btn" onClick={() => setShowAbschlussModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="warning-box">
                <AlertCircle size={24} />
                <div>
                  <strong>Achtung!</strong>
                  <p>
                    Nach dem Festschreiben können keine Änderungen mehr an den Belegen
                    des Jahres {selectedJahr} für {selectedOrg} vorgenommen werden.
                    Diese Aktion kann nicht rückgängig gemacht werden.
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAbschlussModal(false)}>
                Abbrechen
              </button>
              <button className="btn-danger" onClick={festschreibenJahr} disabled={loading}>
                {loading ? 'Wird festgeschrieben...' : 'Endgültig festschreiben'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
};

export default BuchhaltungTab;
