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
      const response = await fetch(`${config.apiBaseUrl}/lastschriftlauf/preview`);

      if (!response.ok) {
        throw new Error('Fehler beim Laden der Vorschau');
      }

      const data = await response.json();
      setPreview(data);
      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Vorschau:', error);
      alert('Fehler beim Laden der Vorschau: ' + error.message);
      setLoading(false);
    }
  };

  const loadMissingMandates = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/lastschriftlauf/missing-mandates`);
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
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/beitraege')}>
          <ArrowLeft size={20} />
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
          >
            <FileText size={20} />
            Zahlläufe-Übersicht
          </button>
          <button
            className="btn btn-info"
            onClick={loadPreview}
            disabled={loading}
          >
            <RefreshCw size={20} />
            Aktualisieren
          </button>
        </div>
      </div>
      )}

      {/* Info Box */}
      <div className="info-box">
        <AlertCircle size={24} />
        <div>
          <h3>SEPA-Lastschriftverfahren</h3>
          <p>
            Der Lastschriftlauf generiert eine Datei mit allen aktiven SEPA-Mandaten.
            Diese Datei kann direkt in Ihre Online-Banking Software oder bei Ihrer Bank importiert werden.
            <strong> Nur Mitglieder mit aktivem SEPA-Mandat und Zahlungsmethode "SEPA-Lastschrift" werden berücksichtigt.</strong>
          </p>
        </div>
      </div>

      {/* Warning Box - Fehlende SEPA-Mandate */}
      {missingMandates.length > 0 && (
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
              className="btn btn-warning"
              onClick={() => navigate('/dashboard/sepa-mandate')}
              style={{ marginTop: '1rem' }}
            >
              SEPA-Mandate verwalten
            </button>
          </div>
        </div>
      )}

      {/* Statistiken */}
      {preview && (
        <div className="stats-grid">
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

      {/* Export Konfiguration */}
      <div className="export-config-card">
        <h2>Export Konfiguration</h2>

        <div className="config-grid">
          <div className="form-group">
            <label>
              <FileText size={16} />
              Export Format
            </label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="form-select"
            >
              <option value="csv">CSV (Deutsche Bank / Sparkasse)</option>
              <option value="xml">SEPA XML pain.008 (Standard)</option>
            </select>
            <small>
              {selectedFormat === 'csv' && 'Kompatibel mit den meisten deutschen Banken'}
              {selectedFormat === 'xml' && 'SEPA-konformes XML-Format (pain.008.001.02)'}
            </small>
          </div>

          <div className="form-group">
            <label>
              <Calendar size={16} />
              Abrechnungsmonat
            </label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="form-select"
                style={{ flex: 1 }}
              >
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {getMonthName(i + 1)}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="form-select"
                style={{ flex: 1 }}
              >
                <option value={2024}>2024</option>
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
              </select>
            </div>
            <small>Wählen Sie den Monat für den Lastschrifteinzug</small>
          </div>
        </div>

        <div className="export-actions">
          <button
            className="btn btn-info btn-large"
            onClick={loadPreview}
            disabled={loading}
          >
            <Eye size={20} />
            {loading ? 'Lädt...' : 'Vorschau aktualisieren'}
          </button>
          <button
            className="btn btn-success btn-large"
            onClick={handleExport}
            disabled={loading || !preview || preview.count === 0}
          >
            <Download size={20} />
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
