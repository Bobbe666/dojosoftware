import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Plus,
  Download,
  AlertCircle,
  PenTool,
  Users
} from "lucide-react";
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/SepaMandateVerwaltung.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { useDojoContext } from '../context/DojoContext.jsx';
import SignatureCanvas from './SignatureCanvas';


const SepaMandateVerwaltung = () => {
  const navigate = useNavigate();
  const { activeDojo } = useDojoContext();
  const withDojo = (url) => activeDojo?.id
    ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}`
    : url;
  const [loading, setLoading] = useState(true);
  const [mandate, setMandate] = useState([]);
  const [filteredMandate, setFilteredMandate] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, aktiv, widerrufen, abgelaufen
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showIban, setShowIban] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewMandatModal, setShowNewMandatModal] = useState(false);
  const [selectedMandat, setSelectedMandat] = useState(null);

  // Massenerstellung
  const [showMassenModal, setShowMassenModal] = useState(false);
  const [ohneMandat, setOhneMandat] = useState([]);
  const [massenSelected, setMassenSelected] = useState(new Set());
  const [massenLoading, setMassenLoading] = useState(false);
  const [massenResult, setMassenResult] = useState(null);

  // Für neues Mandat
  const [mitgliederListe, setMitgliederListe] = useState([]);
  const [loadingMitglieder, setLoadingMitglieder] = useState(false);
  const [neuesMandatData, setNeuesMandatData] = useState({
    mitglied_id: '',
    iban: '',
    bic: '',
    bank_name: '',
    kontoinhaber: '',
    mandatsreferenz: '',
    unterschrift_digital: null
  });

  useEffect(() => {
    if (activeDojo === null) return; // DojoContext noch nicht geladen
    loadMandate();
    loadOhneMandat(true);
  }, [activeDojo?.id, activeDojo === null ? 0 : 1]); // eslint-disable-line

  useEffect(() => {
    filterMandate();
  }, [searchTerm, statusFilter, mandate]);

  const loadMandate = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(withDojo(`${config.apiBaseUrl}/sepa-mandate`));

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
      const response = await fetchWithAuth(withDojo(`${config.apiBaseUrl}/sepa-mandate/${mandat_id}`), {
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

  const loadMitgliederListe = async () => {
    try {
      setLoadingMitglieder(true);
      const response = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Mitgliederliste');
      }

      const data = await response.json();
      setMitgliederListe(data.data || []);
      setLoadingMitglieder(false);
    } catch (error) {
      console.error('Fehler beim Laden der Mitgliederliste:', error);
      alert('Fehler beim Laden der Mitgliederliste: ' + error.message);
      setLoadingMitglieder(false);
    }
  };

  const handleOpenNewMandatModal = () => {
    loadMitgliederListe();
    setShowNewMandatModal(true);
    setNeuesMandatData({
      mitglied_id: '',
      iban: '',
      bic: '',
      bank_name: '',
      kontoinhaber: '',
      mandatsreferenz: '',
      unterschrift_digital: null
    });
  };

  const loadOhneMandat = async (silent = false) => {
    if (!silent) {
      setMassenLoading(true);
      setMassenResult(null);
    }
    try {
      const res = await fetchWithAuth(withDojo(`${config.apiBaseUrl}/sepa-mandate/ohne-mandat`));
      const data = await res.json();
      const liste = data.data || [];
      setOhneMandat(liste);
      setMassenSelected(new Set(liste.filter(m => m.iban).map(m => m.mitglied_id)));
    } catch (e) {
      console.error('Fehler beim Laden:', e);
    }
    if (!silent) setMassenLoading(false);
  };

  const sendMassenErstellung = async () => {
    const zuErstellen = ohneMandat
      .filter(m => massenSelected.has(m.mitglied_id))
      .map(m => ({
        mitglied_id: m.mitglied_id,
        iban: m.iban,
        bic: m.bic || '',
        kontoinhaber: m.kontoinhaber || `${m.vorname} ${m.nachname}`
      }));
    if (!zuErstellen.length) return;
    setMassenLoading(true);
    try {
      const res = await fetchWithAuth(withDojo(`${config.apiBaseUrl}/sepa-mandate/massen-erstellung`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandate: zuErstellen })
      });
      const result = await res.json();
      setMassenResult(result);
      if (result.erstellt > 0) {
        loadMandate();
        loadOhneMandat(true);
      }
    } catch (e) {
      setMassenResult({ success: false, fehler: zuErstellen.length, erstellt: 0, details: [] });
    }
    setMassenLoading(false);
  };

  const handleSaveNewMandat = async () => {
    // Validierung
    if (!neuesMandatData.mitglied_id) {
      alert('Bitte waehlen Sie ein Mitglied aus');
      return;
    }
    if (!neuesMandatData.iban) {
      alert('Bitte geben Sie eine IBAN ein');
      return;
    }
    if (!neuesMandatData.kontoinhaber) {
      alert('Bitte geben Sie einen Kontoinhaber ein');
      return;
    }
    // Unterschrift ist Pflicht
    if (!neuesMandatData.unterschrift_digital) {
      alert('Bitte unterschreiben Sie das SEPA-Mandat');
      return;
    }

    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/mitglieder/${neuesMandatData.mitglied_id}/sepa-mandate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            iban: neuesMandatData.iban,
            bic: neuesMandatData.bic,
            bank_name: neuesMandatData.bank_name,
            kontoinhaber: neuesMandatData.kontoinhaber,
            mandatsreferenz: neuesMandatData.mandatsreferenz || undefined,
            // Digitale Unterschrift
            unterschrift_digital: neuesMandatData.unterschrift_digital,
            unterschrift_datum: new Date().toISOString(),
            unterschrift_ip: window.location.hostname
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Erstellen des Mandats');
      }

      const result = await response.json();
      alert('SEPA-Mandat erfolgreich erstellt!' + (neuesMandatData.unterschrift_digital ? ' (mit digitaler Unterschrift)' : ''));
      setShowNewMandatModal(false);
      loadMandate();
    } catch (error) {
      console.error('Fehler beim Erstellen:', error);
      alert('Fehler beim Erstellen: ' + error.message);
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
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => { setShowMassenModal(true); loadOhneMandat(); }}
          >
            <Users size={20} />
            Massenanlage
          </button>
          <button
            className="btn btn-primary"
            onClick={handleOpenNewMandatModal}
          >
            <Plus size={20} />
            Neues Mandat
          </button>
        </div>
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

        <div className={`stat-card ${ohneMandat.length > 0 ? 'danger' : 'success'}`}>
          <div className="stat-icon">
            <AlertCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>Ohne Mandat</h3>
            <p className="stat-value">{ohneMandat.length}</p>
            <span className="stat-trend">
              {ohneMandat.length > 0 ? 'Lastschrift fehlt' : 'Alle abgedeckt'}
            </span>
          </div>
        </div>
      </div>

      {/* Vorschau: Mitglieder ohne Mandat */}
      {ohneMandat.length > 0 && (
        <div className="sepa-ohne-mandat-preview">
          <div className="sepa-ohne-mandat-header">
            <div className="sepa-ohne-mandat-header-info">
              <AlertCircle size={18} />
              <strong>{ohneMandat.length} Mitglieder ohne aktives SEPA-Mandat</strong>
              {ohneMandat.filter(m => m.iban).length > 0 && (
                <span className="sepa-preview-hint">
                  {ohneMandat.filter(m => m.iban).length} mit IBAN — sofort anlegbar
                </span>
              )}
            </div>
            <button
              className="btn btn-primary"
              style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
              onClick={() => { setShowMassenModal(true); setMassenResult(null); }}
            >
              <Users size={16} />
              Massenanlage starten
            </button>
          </div>
          <div className="sepa-ohne-mandat-list">
            {ohneMandat.map(m => (
              <div key={m.mitglied_id} className={`sepa-ohne-mandat-item${!m.iban ? ' no-iban' : ''}`}>
                <span className="sepa-item-name">{m.vorname} {m.nachname}</span>
                {m.iban
                  ? <code className="sepa-item-iban">{maskIBAN(m.iban)}</code>
                  : <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>Keine IBAN</span>
                }
                {m.bic && <span className="sepa-item-bic">{m.bic}</span>}
                <button
                  className="btn-icon btn-secondary"
                  onClick={() => navigate(`/dashboard/mitglieder/${m.mitglied_id}`)}
                  title="Mitglied öffnen"
                  style={{ marginLeft: 'auto', flexShrink: 0 }}
                >
                  <Edit size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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
                        onClick={() => {
                          setSelectedMandat(mandat);
                          setShowIban(false);
                          setShowDetailsModal(true);
                        }}
                        title="Details anzeigen"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        className="btn-icon btn-secondary"
                        onClick={() => navigate(`/dashboard/mitglieder/${mandat.mitglied_id}`)}
                        title="Mitglied bearbeiten"
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

      {/* Details Modal */}
      {showDetailsModal && selectedMandat && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>📋 SEPA-Mandat Details</h2>
              <button className="btn-close" onClick={() => setShowDetailsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Mitglied</label>
                  <div className="detail-value">
                    <strong>{selectedMandat.mitglied_name || `Mitglied #${selectedMandat.mitglied_id}`}</strong>
                    <br />
                    <small>ID: {selectedMandat.mitglied_id}</small>
                  </div>
                </div>

                <div className="detail-item">
                  <label>Status</label>
                  <div className="detail-value">
                    {getStatusBadge(selectedMandat)}
                  </div>
                </div>

                <div className="detail-item">
                  <label>Mandatsreferenz</label>
                  <div className="detail-value">
                    <code>{selectedMandat.mandatsreferenz}</code>
                  </div>
                </div>

                <div className="detail-item">
                  <label>Gläubiger-ID</label>
                  <div className="detail-value">
                    <code>{selectedMandat.glaeubiger_id || '-'}</code>
                  </div>
                </div>

                <div className="detail-item">
                  <label>IBAN</label>
                  <div className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <code>{showIban ? (selectedMandat.iban || '-') : maskIBAN(selectedMandat.iban)}</code>
                    <button
                      className="btn-icon"
                      onClick={() => setShowIban(v => !v)}
                      title={showIban ? 'IBAN verbergen' : 'IBAN anzeigen'}
                      style={{ flexShrink: 0 }}
                    >
                      {showIban ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div className="detail-item">
                  <label>BIC</label>
                  <div className="detail-value">
                    {selectedMandat.bic || '-'}
                  </div>
                </div>

                <div className="detail-item">
                  <label>Bankname</label>
                  <div className="detail-value">
                    {selectedMandat.bankname || '-'}
                  </div>
                </div>

                <div className="detail-item">
                  <label>Kontoinhaber</label>
                  <div className="detail-value">
                    {selectedMandat.kontoinhaber || '-'}
                  </div>
                </div>

                <div className="detail-item">
                  <label>Erstellt am</label>
                  <div className="detail-value">
                    {formatDate(selectedMandat.erstellungsdatum)}
                  </div>
                </div>

                <div className="detail-item">
                  <label>Letzte Änderung</label>
                  <div className="detail-value">
                    {formatDate(selectedMandat.aktualisiert_am)}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>
                Schließen
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowDetailsModal(false);
                  navigate(`/dashboard/mitglieder/${selectedMandat.mitglied_id}`);
                }}
              >
                Mitglied öffnen
              </button>
            </div>
          </div>
        </div>
      )}

      {showMassenModal && createPortal(
        <div onClick={() => setShowMassenModal(false)} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 99999, padding: '1rem', overflowY: 'auto'
        }}>
          <div className="modal-content modal-content--wide" onClick={e => e.stopPropagation()} style={{
            position: 'relative', maxHeight: '90vh', overflowY: 'auto',
            width: '90vw', maxWidth: '800px'
          }}>
            <div className="modal-header">
              <h2><Users size={20} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />Massenerstellung SEPA-Mandate</h2>
              <button className="btn-close" onClick={() => setShowMassenModal(false)}>×</button>
            </div>
            <div className="modal-body">
              {massenLoading && !massenResult ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                  <div className="loading-spinner" />
                  <p>Lade Mitglieder ohne Mandat...</p>
                </div>
              ) : massenResult ? (
                <div className="sepa-massen-result">
                  <div className={`sepa-massen-result-row ${massenResult.erstellt > 0 ? 'success' : ''}`}>
                    <CheckCircle size={20} />
                    <strong>{massenResult.erstellt} Mandate erfolgreich erstellt</strong>
                  </div>
                  {massenResult.fehler > 0 && (
                    <div className="sepa-massen-result-row error">
                      <XCircle size={20} />
                      <strong>{massenResult.fehler} Fehler</strong>
                    </div>
                  )}
                  {massenResult.details?.length > 0 && (
                    <ul className="sepa-massen-fehler-list">
                      {massenResult.details.map((d, i) => (
                        <li key={i}>Mitglied #{d.mitglied_id}: {d.fehler}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <>
                  <div className="sepa-massen-info">
                    <span><strong>{ohneMandat.length}</strong> Mitglieder ohne aktives Mandat</span>
                    <span><strong>{ohneMandat.filter(m => m.iban).length}</strong> haben IBAN hinterlegt</span>
                    {ohneMandat.filter(m => !m.iban).length > 0 && (
                      <span style={{ color: 'var(--color-warning)' }}>
                        <AlertCircle size={14} /> {ohneMandat.filter(m => !m.iban).length} ohne IBAN (nicht wählbar)
                      </span>
                    )}
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                      onClick={() => setMassenSelected(new Set(ohneMandat.filter(m => m.iban).map(m => m.mitglied_id)))}
                    >
                      Alle mit IBAN auswählen
                    </button>
                  </div>
                  <div className="sepa-massen-table-wrap">
                    <table className="mandate-table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}></th>
                          <th>Mitglied</th>
                          <th>IBAN</th>
                          <th>BIC</th>
                          <th>Kontoinhaber</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ohneMandat.map(m => {
                          const hatIban = !!m.iban;
                          const checked = massenSelected.has(m.mitglied_id);
                          return (
                            <tr key={m.mitglied_id} className={!hatIban ? 'sepa-massen-row--disabled' : ''}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!hatIban}
                                  onChange={() => {
                                    const s = new Set(massenSelected);
                                    if (checked) s.delete(m.mitglied_id); else s.add(m.mitglied_id);
                                    setMassenSelected(s);
                                  }}
                                />
                              </td>
                              <td><strong>{m.vorname} {m.nachname}</strong></td>
                              <td>
                                {hatIban
                                  ? <code>{maskIBAN(m.iban)}</code>
                                  : <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>Keine IBAN</span>
                                }
                              </td>
                              <td>{m.bic || '–'}</td>
                              <td>{m.kontoinhaber || `${m.vorname} ${m.nachname}`}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowMassenModal(false)}>
                {massenResult ? 'Schließen' : 'Abbrechen'}
              </button>
              {!massenResult && (
                <button
                  className="btn btn-primary"
                  onClick={sendMassenErstellung}
                  disabled={massenLoading || massenSelected.size === 0}
                >
                  <Plus size={18} />
                  {massenLoading ? 'Erstelle...' : `${massenSelected.size} Mandate anlegen`}
                </button>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* Neues Mandat Modal */}
      {showNewMandatModal && (
        <div className="modal-overlay" onClick={() => setShowNewMandatModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>➕ Neues SEPA-Mandat erstellen</h2>
              <button className="btn-close" onClick={() => setShowNewMandatModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Mitglied auswählen *</label>
                {loadingMitglieder ? (
                  <p>Lade Mitglieder...</p>
                ) : (
                  <select
                    value={neuesMandatData.mitglied_id}
                    onChange={(e) => {
                      const mitgliedId = e.target.value;
                      const mitglied = mitgliederListe.find(m => m.mitglied_id == mitgliedId);
                      setNeuesMandatData({
                        ...neuesMandatData,
                        mitglied_id: mitgliedId,
                        kontoinhaber: mitglied ? `${mitglied.vorname} ${mitglied.nachname}` : ''
                      });
                    }}
                    className="form-control"
                  >
                    <option value="">-- Mitglied wählen --</option>
                    {mitgliederListe.map(mitglied => (
                      <option key={mitglied.mitglied_id} value={mitglied.mitglied_id}>
                        {mitglied.vorname} {mitglied.nachname} (ID: {mitglied.mitglied_id})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="form-group">
                <label>IBAN *</label>
                <input
                  type="text"
                  placeholder="DE89 3704 0044 0532 0130 00"
                  value={neuesMandatData.iban}
                  onChange={(e) => setNeuesMandatData({ ...neuesMandatData, iban: e.target.value.replace(/\s/g, '').toUpperCase() })}
                  className="form-control"
                  maxLength="34"
                />
              </div>

              <div className="form-group">
                <label>BIC</label>
                <input
                  type="text"
                  placeholder="COBADEFFXXX"
                  value={neuesMandatData.bic}
                  onChange={(e) => setNeuesMandatData({ ...neuesMandatData, bic: e.target.value.toUpperCase() })}
                  className="form-control"
                  maxLength="11"
                />
              </div>

              <div className="form-group">
                <label>Bankname</label>
                <input
                  type="text"
                  placeholder="z.B. Commerzbank"
                  value={neuesMandatData.bank_name}
                  onChange={(e) => setNeuesMandatData({ ...neuesMandatData, bank_name: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label>Kontoinhaber *</label>
                <input
                  type="text"
                  placeholder="Max Mustermann"
                  value={neuesMandatData.kontoinhaber}
                  onChange={(e) => setNeuesMandatData({ ...neuesMandatData, kontoinhaber: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label>Mandatsreferenz (optional)</label>
                <input
                  type="text"
                  placeholder="Wird automatisch generiert"
                  value={neuesMandatData.mandatsreferenz}
                  onChange={(e) => setNeuesMandatData({ ...neuesMandatData, mandatsreferenz: e.target.value })}
                  className="form-control"
                />
                <small className="form-hint">
                  Leer lassen fuer automatische Generierung (MANDAT-ID-Timestamp)
                </small>
              </div>

              {/* SEPA-Mandatstext */}
              <div className="sepa-mandate-text">
                <strong className="sepa-mandate-text-header">
                  <PenTool size={16} />
                  SEPA-Lastschriftmandat
                </strong>
                <p className="sepa-mandate-text-body">
                  Ich ermachtige den Zahlungsempfaenger, Zahlungen von meinem Konto
                  mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an,
                  die vom Zahlungsempfaenger auf mein Konto gezogenen Lastschriften einzuloesen.
                </p>
                <p className="sepa-mandate-text-hint">
                  Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem
                  Belastungsdatum, die Erstattung des belasteten Betrages verlangen.
                </p>
              </div>

              {/* Digitale Unterschrift */}
              <div className="sepa-signature-wrapper">
                <SignatureCanvas
                  label="Digitale Unterschrift"
                  required={true}
                  width={460}
                  height={150}
                  onSignatureChange={(data) =>
                    setNeuesMandatData({ ...neuesMandatData, unterschrift_digital: data })
                  }
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewMandatModal(false)}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={handleSaveNewMandat}>
                <Plus size={18} />
                Mandat erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SepaMandateVerwaltung;
