// ============================================================================
// DATEV EXPORT
// Frontend/src/components/DatevExport.jsx
// Admin-Komponente für DATEV-Exporte (Rechnungen, Zahlungen, Debitoren)
// ============================================================================

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Calculator, Download, FileText, Users, CreditCard, Calendar,
  CheckCircle, AlertCircle, Clock, RefreshCw, Info
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';
import '../styles/DatevExport.css';

const DatevExport = () => {
  const { activeDojo } = useDojoContext();
  const [loading, setLoading] = useState(false);
  const [exports, setExports] = useState([]);
  const [configOk, setConfigOk] = useState(false);
  const [checkingConfig, setCheckingConfig] = useState(true);

  // Export-Parameter
  const [exportType, setExportType] = useState('invoices');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  const dojoId = activeDojo?.id || activeDojo;

  useEffect(() => {
    if (dojoId && dojoId !== 'super-admin') {
      checkConfig();
      loadExportHistory();
    }
  }, [dojoId]);

  const checkConfig = async () => {
    try {
      setCheckingConfig(true);
      const response = await axios.get(`/integrations/status?dojo_id=${dojoId}`);
      setConfigOk(response.data.datev?.configured || false);
    } catch (err) {
      console.error('Fehler beim Prüfen der Konfiguration:', err);
      setConfigOk(false);
    } finally {
      setCheckingConfig(false);
    }
  };

  const loadExportHistory = async () => {
    try {
      const response = await axios.get(`/integrations/datev/exports?dojo_id=${dojoId}`);
      setExports(response.data.exports || []);
    } catch (err) {
      console.error('Fehler beim Laden der Export-Historie:', err);
    }
  };

  const handleExport = async () => {
    try {
      setLoading(true);

      const response = await axios.get(
        `/integrations/datev/export/${exportType}?dojo_id=${dojoId}&start=${dateRange.start}&end=${dateRange.end}`,
        { responseType: 'blob' }
      );

      // Download File
      const filename = response.headers['content-disposition']?.split('filename=')[1]?.replace(/"/g, '')
        || `datev_${exportType}_${dateRange.start}_${dateRange.end}.csv`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Refresh history
      loadExportHistory();

    } catch (err) {
      console.error('Fehler beim Export:', err);
      alert('Export fehlgeschlagen: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const exportTypes = [
    {
      key: 'invoices',
      title: 'Rechnungen',
      description: 'Buchungsstapel mit allen Rechnungen',
      icon: <FileText size={24} />
    },
    {
      key: 'payments',
      title: 'Zahlungen',
      description: 'Zahlungseingänge für den Zeitraum',
      icon: <CreditCard size={24} />
    },
    {
      key: 'debitoren',
      title: 'Debitoren',
      description: 'Stammdaten aller Mitglieder',
      icon: <Users size={24} />
    }
  ];

  if (checkingConfig) {
    return (
      <div className="datev-export-container">
        <div className="datev-export-loading">Prüfe Konfiguration...</div>
      </div>
    );
  }

  return (
    <div className="datev-export-container">
      {/* Header */}
      <div className="datev-export-header">
        <Calculator size={32} color="#006633" />
        <div>
          <h2 className="datev-export-title">DATEV Export</h2>
          <p className="datev-export-subtitle">Exportiere Buchungsdaten im DATEV-Format</p>
        </div>
      </div>

      {/* Config Warning */}
      {!configOk && (
        <div className="datev-export-warning-box">
          <AlertCircle size={24} />
          <div>
            <strong>DATEV nicht konfiguriert</strong>
            <p>
              Bitte konfiguriere zuerst die Beraternummer und Mandantennummer in den
              Integration-Einstellungen.
            </p>
          </div>
        </div>
      )}

      {/* Export Type Selection */}
      <div className="datev-export-section">
        <h3 className="datev-export-section-title">1. Export-Typ wählen</h3>
        <div className="datev-export-type-grid">
          {exportTypes.map(type => (
            <button
              key={type.key}
              className={`datev-export-type-card${exportType === type.key ? ' datev-export-type-card--active' : ''}`}
              onClick={() => setExportType(type.key)}
            >
              <div className={`datev-export-type-icon${exportType === type.key ? ' datev-export-type-icon--active' : ''}`}>
                {type.icon}
              </div>
              <div className="datev-export-type-info">
                <strong>
                  {type.title}
                </strong>
                <span>
                  {type.description}
                </span>
              </div>
              {exportType === type.key && (
                <CheckCircle size={20} color="#ffd700" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="datev-export-section">
        <h3 className="datev-export-section-title">2. Zeitraum wählen</h3>
        <div className="datev-export-date-range-row">
          <div className="datev-export-date-group">
            <label className="datev-export-label">Von</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
              className="datev-export-date-input"
            />
          </div>
          <div className="datev-export-date-group">
            <label className="datev-export-label">Bis</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
              className="datev-export-date-input"
            />
          </div>
          <div className="datev-export-preset-buttons">
            <button
              className="datev-export-preset-button"
              onClick={() => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: now.toISOString().split('T')[0]
                });
              }}
            >
              Dieser Monat
            </button>
            <button
              className="datev-export-preset-button"
              onClick={() => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const end = new Date(now.getFullYear(), now.getMonth(), 0);
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: end.toISOString().split('T')[0]
                });
              }}
            >
              Letzter Monat
            </button>
            <button
              className="datev-export-preset-button"
              onClick={() => {
                const now = new Date();
                const start = new Date(now.getFullYear(), 0, 1);
                setDateRange({
                  start: start.toISOString().split('T')[0],
                  end: now.toISOString().split('T')[0]
                });
              }}
            >
              Dieses Jahr
            </button>
          </div>
        </div>
      </div>

      {/* Export Button */}
      <div className="datev-export-section">
        <h3 className="datev-export-section-title">3. Export starten</h3>
        <div className="datev-export-info-box">
          <Info size={20} />
          <p>
            Der Export wird im DATEV-EXTF-Format (ASCII) erstellt und kann direkt
            in DATEV Unternehmen Online oder DATEV Kanzlei-Rechnungswesen importiert werden.
          </p>
        </div>
        <button
          className="datev-export-button"
          onClick={handleExport}
          disabled={!configOk || loading}
        >
          {loading ? (
            <><RefreshCw size={20} className="spinning" /> Exportiere...</>
          ) : (
            <><Download size={20} /> {exportTypes.find(t => t.key === exportType)?.title} exportieren</>
          )}
        </button>
      </div>

      {/* Export History */}
      <div className="datev-export-section">
        <h3 className="datev-export-section-title">Letzte Exporte</h3>
        {exports.length === 0 ? (
          <p className="datev-export-history-empty">
            Noch keine Exporte durchgeführt
          </p>
        ) : (
          <div className="datev-export-history-list">
            {exports.slice(0, 10).map((exp, index) => (
              <div key={index} className="datev-export-history-item">
                <div className="datev-export-history-icon">
                  {exp.export_type === 'invoices' && <FileText size={18} />}
                  {exp.export_type === 'payments' && <CreditCard size={18} />}
                  {exp.export_type === 'debitoren' && <Users size={18} />}
                </div>
                <div className="datev-export-history-info">
                  <strong className="u-text-primary">
                    {exp.export_type === 'invoices' && 'Rechnungen'}
                    {exp.export_type === 'payments' && 'Zahlungen'}
                    {exp.export_type === 'debitoren' && 'Debitoren'}
                  </strong>
                  <span>
                    {exp.record_count} Datensätze | {exp.start_date} - {exp.end_date}
                  </span>
                </div>
                <div className="datev-export-history-date">
                  <Clock size={14} />
                  <span>{new Date(exp.created_at).toLocaleDateString('de-DE')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="datev-export-help-section">
        <h4>DATEV Import-Anleitung</h4>
        <ol>
          <li>Exportiere die gewünschten Daten als CSV-Datei</li>
          <li>Öffne DATEV Unternehmen Online oder Kanzlei-Rechnungswesen</li>
          <li>Gehe zu "Stapelverarbeitung" → "ASCII-Import"</li>
          <li>Wähle die heruntergeladene CSV-Datei</li>
          <li>Prüfe die Vorschau und bestätige den Import</li>
        </ol>
      </div>
    </div>
  );
};


export default DatevExport;
