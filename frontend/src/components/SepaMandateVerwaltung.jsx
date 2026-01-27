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
  AlertCircle,
  PenTool
} from "lucide-react";
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/SepaMandateVerwaltung.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';
import SignatureCanvas from './SignatureCanvas';


const SepaMandateVerwaltung = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [mandate, setMandate] = useState([]);
  const [filteredMandate, setFilteredMandate] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, aktiv, widerrufen, abgelaufen
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewMandatModal, setShowNewMandatModal] = useState(false);
  const [selectedMandat, setSelectedMandat] = useState(null);

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
    loadMandate();
  }, []);

  useEffect(() => {
    filterMandate();
  }, [searchTerm, statusFilter, mandate]);

  const loadMandate = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${config.apiBaseUrl}/sepa-mandate`);

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
      const response = await fetchWithAuth(`${config.apiBaseUrl}/sepa-mandate/${mandat_id}`, {
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
        <button
          className="btn btn-primary"
          onClick={handleOpenNewMandatModal}
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
                        onClick={() => {
                          setSelectedMandat(mandat);
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
                  <div className="detail-value">
                    <code>{selectedMandat.iban || '-'}</code>
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
                <small style={{ color: '#888', fontSize: '0.85rem' }}>
                  Leer lassen fuer automatische Generierung (MANDAT-ID-Timestamp)
                </small>
              </div>

              {/* SEPA-Mandatstext */}
              <div style={{
                marginTop: '1.5rem',
                padding: '1rem',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.8)'
              }}>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <PenTool size={16} />
                  SEPA-Lastschriftmandat
                </strong>
                <p style={{ marginTop: '0.5rem', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                  Ich ermachtige den Zahlungsempfaenger, Zahlungen von meinem Konto
                  mittels Lastschrift einzuziehen. Zugleich weise ich mein Kreditinstitut an,
                  die vom Zahlungsempfaenger auf mein Konto gezogenen Lastschriften einzuloesen.
                </p>
                <p style={{ marginTop: '0.5rem', marginBottom: 0, fontStyle: 'italic', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                  Hinweis: Ich kann innerhalb von acht Wochen, beginnend mit dem
                  Belastungsdatum, die Erstattung des belasteten Betrages verlangen.
                </p>
              </div>

              {/* Digitale Unterschrift */}
              <div style={{ marginTop: '1.5rem' }}>
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
