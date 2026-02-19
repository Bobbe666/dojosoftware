import React, { useState, useEffect } from 'react';
import {
  Upload, FileText, CheckCircle, AlertCircle, Users, FileCheck,
  Download, Info, Table, RefreshCw, AlertTriangle
} from 'lucide-react';
import { useDojoContext } from '../context/DojoContext';
import '../styles/CSVImport.css';

const CSVImport = () => {
  const { activeDojo } = useDojoContext();
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [error, setError] = useState(null);
  const [columnInfo, setColumnInfo] = useState(null);

  useEffect(() => {
    loadColumnInfo();
  }, []);

  const loadColumnInfo = async () => {
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const response = await fetch('/api/csv-import/info', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setColumnInfo(data);
      }
    } catch (err) {
      console.error('Fehler beim Laden der Spalten-Info:', err);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && (selectedFile.name.endsWith('.csv') || selectedFile.type === 'text/csv')) {
      setFile(selectedFile);
      setError(null);
      setImportResults(null);
    } else {
      setError('Bitte wähle eine CSV-Datei aus');
      setFile(null);
    }
  };

  const downloadTemplate = async () => {
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const response = await fetch('/api/csv-import/template', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mitglieder-import-vorlage.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Fehler beim Herunterladen der Vorlage');
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError('Bitte wähle zuerst eine Datei aus');
      return;
    }

    if (!activeDojo?.id) {
      setError('Kein Dojo ausgewählt');
      return;
    }

    setImporting(true);
    setError(null);

    const formData = new FormData();
    formData.append('csvFile', file);
    formData.append('dojo_id', activeDojo.id);

    try {
      const token = localStorage.getItem('dojo_auth_token');
      const response = await fetch('/api/csv-import/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import fehlgeschlagen');
      }

      setImportResults(data.results);
      setFile(null);
      // File input zurücksetzen
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';

    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="csv-import-container">
      <div className="csv-import-card">
        {/* Header */}
        <div className="csv-import-header">
          <div className="header-icon">
            <Table size={32} />
          </div>
          <div>
            <h1>CSV Import</h1>
            <p>Importiere Mitglieder aus einer CSV-Datei</p>
          </div>
        </div>

        {/* Anleitung */}
        <div className="info-box">
          <div className="info-header">
            <Info size={20} />
            <span>So funktioniert der Import</span>
          </div>
          <div className="info-content">
            <ol>
              <li>
                <strong>Vorlage herunterladen:</strong> Lade die CSV-Vorlage herunter und fülle sie mit deinen Mitgliederdaten.
              </li>
              <li>
                <strong>Pflichtfelder beachten:</strong> <code>vorname</code> und <code>nachname</code> müssen ausgefüllt sein.
              </li>
              <li>
                <strong>Datumsformat:</strong> Verwende <code>TT.MM.JJJJ</code> (z.B. 15.03.1990) oder <code>JJJJ-MM-TT</code>
              </li>
              <li>
                <strong>Trennzeichen:</strong> Semikolon (;) wird empfohlen, Komma (,) funktioniert auch.
              </li>
              <li>
                <strong>Duplikate:</strong> Bereits existierende Mitglieder (gleiche E-Mail oder Name+Geburtsdatum) werden übersprungen.
              </li>
            </ol>
          </div>
        </div>

        {/* Vorlage Download */}
        <div className="template-section">
          <button onClick={downloadTemplate} className="btn-template">
            <Download size={18} />
            CSV-Vorlage herunterladen
          </button>
          <span className="template-hint">
            Empfohlen: Öffne die Vorlage in Excel oder Google Sheets
          </span>
        </div>

        {/* Spalten-Übersicht */}
        {columnInfo && (
          <div className="columns-section">
            <h3>
              <FileText size={18} />
              Verfügbare Spalten
            </h3>
            <div className="columns-grid">
              <div className="column-group">
                <h4>Pflichtfelder</h4>
                <ul>
                  {columnInfo.required_columns.map(col => (
                    <li key={col} className="required">
                      <code>{col}</code>
                      <span>{columnInfo.column_descriptions[col]}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="column-group">
                <h4>Optionale Felder</h4>
                <ul>
                  {columnInfo.optional_columns.slice(0, 8).map(col => (
                    <li key={col}>
                      <code>{col}</code>
                      <span>{columnInfo.column_descriptions[col]}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="column-group">
                <h4>Weitere Felder</h4>
                <ul>
                  {columnInfo.optional_columns.slice(8).map(col => (
                    <li key={col}>
                      <code>{col}</code>
                      <span>{columnInfo.column_descriptions[col]}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Upload Section */}
        <div className="upload-section">
          <h3>
            <Upload size={18} />
            Datei hochladen
          </h3>

          <div className="upload-area">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={importing}
              id="csv-file-input"
            />
            <label htmlFor="csv-file-input" className={`upload-label ${file ? 'has-file' : ''}`}>
              {file ? (
                <>
                  <FileCheck size={24} />
                  <span>{file.name}</span>
                  <small>{(file.size / 1024).toFixed(1)} KB</small>
                </>
              ) : (
                <>
                  <Upload size={24} />
                  <span>CSV-Datei auswählen</span>
                  <small>oder hierher ziehen</small>
                </>
              )}
            </label>

            <button
              onClick={handleImport}
              disabled={!file || importing}
              className="btn-import"
            >
              {importing ? (
                <>
                  <RefreshCw size={18} className="spin" />
                  Importiere...
                </>
              ) : (
                <>
                  <Upload size={18} />
                  Import starten
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="error-box">
            <AlertCircle size={20} />
            <p>{error}</p>
          </div>
        )}

        {/* Import Results */}
        {importResults && (
          <div className="results-section">
            <div className={`results-summary ${importResults.failed > 0 ? 'has-errors' : 'success'}`}>
              <div className="results-header">
                {importResults.failed === 0 ? (
                  <CheckCircle size={24} />
                ) : (
                  <AlertTriangle size={24} />
                )}
                <h3>
                  {importResults.failed === 0
                    ? 'Import erfolgreich abgeschlossen!'
                    : 'Import abgeschlossen mit Warnungen'}
                </h3>
              </div>

              <div className="results-stats">
                <div className="stat success">
                  <span className="stat-value">{importResults.successful}</span>
                  <span className="stat-label">Importiert</span>
                </div>
                <div className="stat warning">
                  <span className="stat-value">{importResults.skipped}</span>
                  <span className="stat-label">Übersprungen</span>
                </div>
                <div className="stat error">
                  <span className="stat-value">{importResults.failed}</span>
                  <span className="stat-label">Fehler</span>
                </div>
                <div className="stat total">
                  <span className="stat-value">{importResults.total}</span>
                  <span className="stat-label">Gesamt</span>
                </div>
              </div>

              {importResults.duration && (
                <p className="results-duration">
                  Dauer: {importResults.duration.toFixed(1)} Sekunden
                </p>
              )}
            </div>

            {/* Erfolgreiche Imports */}
            {importResults.imported.length > 0 && (
              <div className="results-list success-list">
                <h4>
                  <CheckCircle size={16} />
                  Erfolgreich importiert ({importResults.imported.length})
                </h4>
                <ul>
                  {importResults.imported.slice(0, 10).map((item, idx) => (
                    <li key={idx}>
                      <span className="line-number">Zeile {item.line}</span>
                      <span className="member-name">{item.name}</span>
                    </li>
                  ))}
                  {importResults.imported.length > 10 && (
                    <li className="more">
                      ... und {importResults.imported.length - 10} weitere
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Fehler und Warnungen */}
            {importResults.errors.length > 0 && (
              <div className="results-list error-list">
                <h4>
                  <AlertTriangle size={16} />
                  Fehler und Warnungen ({importResults.errors.length})
                </h4>
                <ul>
                  {importResults.errors.map((item, idx) => (
                    <li key={idx} className={item.type === 'warning' ? 'warning' : 'error'}>
                      <span className="line-number">Zeile {item.line}</span>
                      <span className="error-message">{item.error}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setImportResults(null)}
              className="btn-new-import"
            >
              <RefreshCw size={16} />
              Neuen Import starten
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVImport;
