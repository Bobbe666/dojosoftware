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
      <div style={styles.container}>
        <div style={styles.loading}>Prüfe Konfiguration...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <Calculator size={32} color="#006633" />
        <div>
          <h2 style={styles.title}>DATEV Export</h2>
          <p style={styles.subtitle}>Exportiere Buchungsdaten im DATEV-Format</p>
        </div>
      </div>

      {/* Config Warning */}
      {!configOk && (
        <div style={styles.warningBox}>
          <AlertCircle size={24} />
          <div>
            <strong>DATEV nicht konfiguriert</strong>
            <p style={{ margin: '4px 0 0 0' }}>
              Bitte konfiguriere zuerst die Beraternummer und Mandantennummer in den
              Integration-Einstellungen.
            </p>
          </div>
        </div>
      )}

      {/* Export Type Selection */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>1. Export-Typ wählen</h3>
        <div style={styles.exportTypeGrid}>
          {exportTypes.map(type => (
            <button
              key={type.key}
              style={{
                ...styles.exportTypeCard,
                borderColor: exportType === type.key ? '#ffd700' : 'rgba(255, 255, 255, 0.1)',
                background: exportType === type.key ? 'rgba(255, 215, 0, 0.1)' : 'rgba(255, 255, 255, 0.05)'
              }}
              onClick={() => setExportType(type.key)}
            >
              <div style={{
                ...styles.exportTypeIcon,
                color: exportType === type.key ? '#ffd700' : '#888'
              }}>
                {type.icon}
              </div>
              <div style={styles.exportTypeInfo}>
                <strong style={{ color: exportType === type.key ? '#ffd700' : '#fff' }}>
                  {type.title}
                </strong>
                <span style={{ color: '#888', fontSize: '12px' }}>
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
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>2. Zeitraum wählen</h3>
        <div style={styles.dateRangeRow}>
          <div style={styles.dateGroup}>
            <label style={styles.label}>Von</label>
            <input
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange({ ...dateRange, start: e.target.value })}
              style={styles.dateInput}
            />
          </div>
          <div style={styles.dateGroup}>
            <label style={styles.label}>Bis</label>
            <input
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange({ ...dateRange, end: e.target.value })}
              style={styles.dateInput}
            />
          </div>
          <div style={styles.presetButtons}>
            <button
              style={styles.presetButton}
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
              style={styles.presetButton}
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
              style={styles.presetButton}
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
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>3. Export starten</h3>
        <div style={styles.exportInfo}>
          <Info size={20} />
          <p>
            Der Export wird im DATEV-EXTF-Format (ASCII) erstellt und kann direkt
            in DATEV Unternehmen Online oder DATEV Kanzlei-Rechnungswesen importiert werden.
          </p>
        </div>
        <button
          style={{
            ...styles.exportButton,
            opacity: !configOk || loading ? 0.5 : 1
          }}
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
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Letzte Exporte</h3>
        {exports.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '20px' }}>
            Noch keine Exporte durchgeführt
          </p>
        ) : (
          <div style={styles.historyList}>
            {exports.slice(0, 10).map((exp, index) => (
              <div key={index} style={styles.historyItem}>
                <div style={styles.historyIcon}>
                  {exp.export_type === 'invoices' && <FileText size={18} />}
                  {exp.export_type === 'payments' && <CreditCard size={18} />}
                  {exp.export_type === 'debitoren' && <Users size={18} />}
                </div>
                <div style={styles.historyInfo}>
                  <strong style={{ color: '#fff' }}>
                    {exp.export_type === 'invoices' && 'Rechnungen'}
                    {exp.export_type === 'payments' && 'Zahlungen'}
                    {exp.export_type === 'debitoren' && 'Debitoren'}
                  </strong>
                  <span style={{ color: '#888', fontSize: '12px' }}>
                    {exp.record_count} Datensätze | {exp.start_date} - {exp.end_date}
                  </span>
                </div>
                <div style={styles.historyDate}>
                  <Clock size={14} />
                  <span>{new Date(exp.created_at).toLocaleDateString('de-DE')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help Section */}
      <div style={styles.helpSection}>
        <h4 style={{ color: '#ffd700', margin: '0 0 12px 0' }}>DATEV Import-Anleitung</h4>
        <ol style={{ margin: 0, paddingLeft: '20px', color: '#aaa', lineHeight: 1.8 }}>
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

const styles = {
  container: {
    padding: '24px',
    maxWidth: '900px',
    margin: '0 auto'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '32px'
  },
  title: {
    color: '#006633',
    margin: 0,
    fontSize: '24px'
  },
  subtitle: {
    color: '#aaa',
    margin: '4px 0 0 0',
    fontSize: '14px'
  },
  warningBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '16px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '24px',
    color: '#ef4444'
  },
  section: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 215, 0, 0.2)',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '20px'
  },
  sectionTitle: {
    color: '#ffd700',
    margin: '0 0 16px 0',
    fontSize: '16px'
  },
  exportTypeGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  exportTypeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px 20px',
    background: 'transparent',
    border: '2px solid',
    borderRadius: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s'
  },
  exportTypeIcon: {
    width: '48px',
    height: '48px',
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  exportTypeInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  dateRangeRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '16px',
    flexWrap: 'wrap'
  },
  dateGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  label: {
    color: '#888',
    fontSize: '13px'
  },
  dateInput: {
    padding: '12px 16px',
    background: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 215, 0, 0.3)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px'
  },
  presetButtons: {
    display: 'flex',
    gap: '8px',
    marginLeft: 'auto'
  },
  presetButton: {
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer'
  },
  exportInfo: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '20px',
    color: '#aaa',
    fontSize: '14px'
  },
  exportButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    width: '100%',
    padding: '16px 24px',
    background: '#006633',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontWeight: 'bold',
    fontSize: '16px',
    cursor: 'pointer'
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '8px'
  },
  historyIcon: {
    color: '#888'
  },
  historyInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  historyDate: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    color: '#888',
    fontSize: '12px'
  },
  helpSection: {
    background: 'rgba(0, 102, 51, 0.1)',
    border: '1px solid rgba(0, 102, 51, 0.3)',
    borderRadius: '12px',
    padding: '20px'
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#888'
  }
};

export default DatevExport;
