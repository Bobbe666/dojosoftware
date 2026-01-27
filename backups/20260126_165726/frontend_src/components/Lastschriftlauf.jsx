import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Download,
  Eye,
  FileText,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Calendar,
  DollarSign,
  Users,
  RefreshCw
} from "lucide-react";
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Lastschriftlauf.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';


const Lastschriftlauf = ({ embedded = false }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [missingMandates, setMissingMandates] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const loadPreview = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/preview`);

      if (!response.ok) {
        let errorMessage = 'Fehler beim Laden der Vorschau';
        try {
          const errorData = await response.json();
          errorMessage = errorData.details || errorData.error || errorMessage;
          console.error('❌ API Error Response:', errorData);
        } catch (e) {
          console.error('❌ Response Status:', response.status, response.statusText);
        }
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Ungültige Antwort vom Server');
      }

      const data = await response.json();
      if (!data.success && data.error) {
        throw new Error(data.error + (data.details ? ': ' + data.details : ''));
      }
      
      setPreview(data);
      setLoading(false);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Vorschau:', error);
      console.error('❌ Error Stack:', error.stack);
      alert('Fehler beim Laden der Vorschau: ' + error.message);
      setLoading(false);
    }
  };

  const loadMissingMandates = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/missing-mandates`);
      if (response.ok) {
        const data = await response.json();
        setMissingMandates(data.members || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden fehlender Mandate:', error);
    }
  };

  useEffect(() => {
    loadPreview();
    loadMissingMandates();
  }, []);

  const handleExport = () => {
    if (!preview || preview.count === 0) {
      alert('Keine Lastschriften zum Exportieren vorhanden');
      return;
    }

    const confirmMessage = `SEPA-Lastschriftlauf exportieren?\n\n` +
      `Format: ${selectedFormat.toUpperCase()}\n` +
      `Monat: ${selectedMonth}/${selectedYear}\n` +
      `Anzahl Mandate: ${preview.count}\n` +
      `Gesamtbetrag: €${preview.total_amount}\n\n` +
      `Die Datei wird heruntergeladen und kann in Ihre Banking-Software importiert werden.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    if (selectedFormat === 'csv') {
      window.open(`${config.apiBaseUrl}/lastschriftlauf`, '_blank');
    } else if (selectedFormat === 'xml') {
      alert('SEPA XML (pain.008) Export wird in Kürze verfügbar sein');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const getMonthName = (month) => {
    const months = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    return months[month - 1];
  };

  return (
    <div className="lastschriftlauf-container">
      {/* Header - nur anzeigen wenn nicht embedded */}
      {!embedded && (
      <div className="lastschriftlauf-header">
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/beitraege')} style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
          <ArrowLeft size={16} />
          Zurück
        </button>
        <div>
          <h1>💶 SEPA-Lastschriftlauf</h1>
          <p>Monatliche Lastschriften generieren und an Bank übermitteln</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/dashboard/zahllaeufe')}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
          >
            <FileText size={16} />
            Zahlläufe-Übersicht
          </button>
          <button
            className="btn btn-info"
            onClick={loadPreview}
            disabled={loading}
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
          >
            <RefreshCw size={16} />
            Aktualisieren
          </button>
        </div>
      </div>
      )}

      {/* Hauptcontainer: Links Info + Stats, Rechts Warning */}
      <div className="main-layout-container">
        {/* Linke Seite: Info-Box oben, Statistik-Karten darunter */}
        <div className="left-section">
          {/* Info Box */}
          <div className="info-box compact">
            <AlertCircle size={20} />
            <div>
              <h3>SEPA-Lastschriftverfahren</h3>
              <p>
                Der Lastschriftlauf generiert eine Datei mit allen aktiven SEPA-Mandaten.
                Diese Datei kann direkt in Ihre Online-Banking Software oder bei Ihrer Bank importiert werden.
                <strong> Nur Mitglieder mit aktivem SEPA-Mandat und Zahlungsmethode "SEPA-Lastschrift" werden berücksichtigt.</strong>
              </p>
            </div>
          </div>

          {/* Statistiken - 2x2 Grid */}
          {preview && (
            <div className="stats-grid-compact">
              <div className="stat-card success">
                <div className="stat-icon">
                  <Users size={16} />
                </div>
                <div className="stat-info">
                  <h3>Aktive Mandate</h3>
                  <p className="stat-value">{preview.count}</p>
                  <span className="stat-trend">SEPA-Lastschriften</span>
                </div>
              </div>

              <div className="stat-card info">
                <div className="stat-icon">
                  <DollarSign size={16} />
                </div>
                <div className="stat-info">
                  <h3>Gesamtbetrag</h3>
                  <p className="stat-value">{formatCurrency(preview.total_amount)}</p>
                  <span className="stat-trend">Monatlich</span>
                </div>
              </div>

              <div className="stat-card warning">
                <div className="stat-icon">
                  <Calendar size={16} />
                </div>
                <div className="stat-info">
                  <h3>Abrechnungsmonat</h3>
                  <p className="stat-value">{getMonthName(selectedMonth)}</p>
                  <span className="stat-trend">{selectedYear}</span>
                </div>
              </div>

              <div className="stat-card positive">
                <div className="stat-icon">
                  <CreditCard size={16} />
                </div>
                <div className="stat-info">
                  <h3>Bank / Anbieter</h3>
                  <p className="stat-value">
                    {preview.primary_bank || 'Gemischte Banken'}
                  </p>
                  <span className="stat-trend">
                    {preview.count > 0 ? 'Export bereit' : 'Keine Mandate'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Rechte Seite: Warning Box oben */}
        {missingMandates.length > 0 && (
          <div className="right-section">
            <div className="warning-box">
              <AlertCircle size={24} />
              <div>
                <h3>⚠️ Fehlende SEPA-Mandate ({missingMandates.length})</h3>
                <p>
                  Die folgenden Mitglieder haben Verträge mit Zahlungsmethode "Lastschrift",
                  aber <strong>kein aktives SEPA-Mandat</strong>.
                  Lastschriften können für diese Mitglieder nicht durchgeführt werden:
                </p>
                <div className="missing-mandates-list">
                  {missingMandates.slice(0, 5).map(member => (
                    <div
                      key={member.mitglied_id}
                      className="missing-mandate-item"
                      onClick={() => navigate(`/dashboard/mitglieder/${member.mitglied_id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="member-name">
                        {member.vorname} {member.nachname} (ID: {member.mitglied_id})
                      </span>
                      <span className="contract-count">
                        {member.anzahl_vertraege} Vertrag{member.anzahl_vertraege > 1 ? 'e' : ''}
                      </span>
                    </div>
                  ))}
                  {missingMandates.length > 5 && (
                    <div className="more-info">
                      ... und {missingMandates.length - 5} weitere
                    </div>
                  )}
                </div>
                <button
                  className="logout-button"
                  onClick={() => navigate('/dashboard/sepa-mandate')}
                  style={{ marginTop: '1rem' }}
                >
                  SEPA-Mandate verwalten
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Konfiguration */}
      <div className="export-config-card">
        <h2>Export Konfiguration</h2>

        <div className="config-single-row">
          <div className="form-field-inline">
            <label>
              <FileText size={14} />
              Export Format
            </label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="form-select-compact"
            >
              <option value="csv">CSV</option>
              <option value="xml">SEPA XML pain.008 (Standard)</option>
            </select>
          </div>

          <div className="form-field-inline">
            <label>
              <Calendar size={14} />
              Abrechnungsmonat
            </label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="form-select-compact"
            >
              {[...Array(12)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {getMonthName(i + 1)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field-inline">
            <label>Jahr</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="form-select-compact"
            >
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </div>

          <button
            className="logout-button"
            onClick={loadPreview}
            disabled={loading}
            style={{ whiteSpace: 'nowrap' }}
          >
            <Eye size={16} />
            {loading ? 'Lädt...' : 'Vorschau aktualisieren'}
          </button>

          <button
            className="logout-button"
            onClick={handleExport}
            disabled={loading || !preview || preview.count === 0}
            style={{ whiteSpace: 'nowrap' }}
          >
            <Download size={16} />
            Jetzt exportieren
          </button>
        </div>
      </div>

      {/* Vorschau Tabelle */}
      {preview && preview.preview && preview.preview.length > 0 && (
        <div className="preview-card">
          <h2>Vorschau ({preview.count} Einträge)</h2>

          <div className="table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Mitglied</th>
                  <th>IBAN</th>
                  <th>Betrag</th>
                  <th>Mandatsreferenz</th>
                  <th>Tarif</th>
                  <th>Zyklus</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <strong>{item.name}</strong>
                      <br />
                      <small>ID: {item.mitglied_id}</small>
                    </td>
                    <td>
                      <code>{item.iban}</code>
                    </td>
                    <td>
                      <strong style={{ color: '#10b981' }}>
                        {formatCurrency(item.betrag)}
                      </strong>
                    </td>
                    <td>
                      {item.mandatsreferenz === 'KEIN MANDAT' ? (
                        <span className="badge badge-danger">{item.mandatsreferenz}</span>
                      ) : (
                        <span className="badge badge-success">{item.mandatsreferenz}</span>
                      )}
                    </td>
                    <td>{item.tarif}</td>
                    <td>
                      <span className="badge badge-info">{item.zahlungszyklus || 'monatlich'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hinweise */}
      <div className="hints-card">
        <h3>💡 Wichtige Hinweise</h3>
        <ul>
          <li>
            <strong>SEPA-Mandat erforderlich:</strong> Es werden nur Mitglieder mit aktivem SEPA-Mandat exportiert.
          </li>
          <li>
            <strong>Vorlaufzeit beachten:</strong> SEPA-Lastschriften benötigen mind. 5 Bankarbeitstage Vorlaufzeit.
          </li>
          <li>
            <strong>Format wählen:</strong> CSV für deutsche Banken, XML für internationale Standards.
          </li>
          <li>
            <strong>Prüfung durchführen:</strong> Kontrollieren Sie die Vorschau vor dem Export.
          </li>
          <li>
            <strong>Datenschutz:</strong> Die exportierte Datei enthält sensible Kontodaten - sicher aufbewahren!
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Lastschriftlauf;
