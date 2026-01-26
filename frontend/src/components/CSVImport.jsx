import React, { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload, FileSpreadsheet, ArrowLeft, ArrowRight, Check, AlertTriangle,
  HelpCircle, Download, Users, X, CheckCircle, Loader, Info, Settings
} from "lucide-react";
import config from "../config";
import { fetchWithAuth } from "../utils/fetchWithAuth";
import "./CSVImport.css";

/**
 * CSV Import Wizard für Mitglieder
 * Schritt-für-Schritt Anleitung zum Importieren von Mitgliederdaten
 */
const CSVImport = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [importOptions, setImportOptions] = useState({
    createSepaMandate: true,
    requireConfirmation: true,
    skipDuplicates: true,
    delimiter: ";"
  });
  const [validationErrors, setValidationErrors] = useState([]);
  const [validationWarnings, setValidationWarnings] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState("");

  // Verfügbare Zielfelder für Mapping
  const targetFields = [
    { key: "vorname", label: "Vorname", required: true },
    { key: "nachname", label: "Nachname", required: true },
    { key: "geburtsdatum", label: "Geburtsdatum", required: true, hint: "Format: DD.MM.YYYY oder YYYY-MM-DD" },
    { key: "geschlecht", label: "Geschlecht", required: true, hint: "m/w/d oder männlich/weiblich/divers" },
    { key: "email", label: "E-Mail", required: false },
    { key: "telefon", label: "Telefon", required: false },
    { key: "telefon_mobil", label: "Mobiltelefon", required: false },
    { key: "strasse", label: "Straße", required: false },
    { key: "hausnummer", label: "Hausnummer", required: false },
    { key: "plz", label: "PLZ", required: false },
    { key: "ort", label: "Ort", required: false },
    { key: "land", label: "Land", required: false, hint: "Standard: Deutschland" },
    { key: "iban", label: "IBAN", required: false },
    { key: "bic", label: "BIC", required: false },
    { key: "bankname", label: "Bankname", required: false },
    { key: "kontoinhaber", label: "Kontoinhaber", required: false },
    { key: "eintrittsdatum", label: "Eintrittsdatum", required: false },
    { key: "notfallkontakt_name", label: "Notfallkontakt Name", required: false },
    { key: "notfallkontakt_telefon", label: "Notfallkontakt Telefon", required: false }
  ];

  const steps = [
    { num: 1, title: "Willkommen", icon: Info },
    { num: 2, title: "Datei", icon: Upload },
    { num: 3, title: "Zuordnung", icon: Settings },
    { num: 4, title: "Vorschau", icon: FileSpreadsheet },
    { num: 5, title: "Import", icon: CheckCircle }
  ];

  // CSV Datei parsen
  const parseCSV = (text, delimiter = ";") => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], data: [] };

    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^["]|["]$/g, ""));
    const data = lines.slice(1).map((line, idx) => {
      const values = line.split(delimiter).map(v => v.trim().replace(/^["]|["]$/g, ""));
      const row = { _rowNum: idx + 2 };
      headers.forEach((h, i) => {
        row[h] = values[i] || "";
      });
      return row;
    });

    return { headers, data };
  };

  // Datei hochladen
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      setError("Bitte laden Sie eine CSV-Datei hoch");
      return;
    }

    setError("");
    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const { headers, data } = parseCSV(text, importOptions.delimiter);
      setCsvHeaders(headers);
      setCsvData(data);

      // Auto-Mapping versuchen
      const autoMapping = {};
      headers.forEach(header => {
        const headerLower = header.toLowerCase().replace(/[_\s-]/g, "");
        targetFields.forEach(field => {
          const fieldLower = field.key.toLowerCase();
          if (headerLower === fieldLower || 
              headerLower.includes(fieldLower) ||
              (field.key === "vorname" && headerLower.includes("first")) ||
              (field.key === "nachname" && (headerLower.includes("last") || headerLower.includes("family"))) ||
              (field.key === "geburtsdatum" && (headerLower.includes("birth") || headerLower.includes("geb"))) ||
              (field.key === "geschlecht" && (headerLower.includes("gender") || headerLower.includes("sex")))
          ) {
            if (!autoMapping[field.key]) {
              autoMapping[field.key] = header;
            }
          }
        });
      });
      setColumnMapping(autoMapping);
    };
    reader.readAsText(file, "UTF-8");
  };

  // Validierung durchführen
  const validateData = useCallback(() => {
    const errors = [];
    const warnings = [];
    const requiredFields = targetFields.filter(f => f.required).map(f => f.key);

    // Prüfe ob alle Pflichtfelder gemappt sind
    requiredFields.forEach(field => {
      if (!columnMapping[field]) {
        errors.push({ type: "mapping", message: `Pflichtfeld "${targetFields.find(f => f.key === field)?.label}" ist nicht zugeordnet` });
      }
    });

    // Prüfe Daten
    csvData.forEach((row, idx) => {
      const rowNum = row._rowNum || idx + 2;

      // Pflichtfelder prüfen
      requiredFields.forEach(field => {
        const csvColumn = columnMapping[field];
        if (csvColumn && !row[csvColumn]?.trim()) {
          errors.push({ type: "data", row: rowNum, message: `Zeile ${rowNum}: "${targetFields.find(f => f.key === field)?.label}" ist leer` });
        }
      });

      // Geburtsdatum Format prüfen
      if (columnMapping.geburtsdatum && row[columnMapping.geburtsdatum]) {
        const dateStr = row[columnMapping.geburtsdatum];
        if (!/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr) && !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          warnings.push({ type: "format", row: rowNum, message: `Zeile ${rowNum}: Datumsformat "${dateStr}" könnte falsch sein` });
        }
      }

      // IBAN Format prüfen
      if (columnMapping.iban && row[columnMapping.iban]) {
        const iban = row[columnMapping.iban].replace(/\s/g, "");
        if (!/^[A-Z]{2}\d{2}[A-Z0-9]{4,30}$/.test(iban.toUpperCase())) {
          warnings.push({ type: "format", row: rowNum, message: `Zeile ${rowNum}: IBAN "${iban}" könnte ungültig sein` });
        }
      }

      // E-Mail Format prüfen
      if (columnMapping.email && row[columnMapping.email]) {
        const email = row[columnMapping.email];
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          warnings.push({ type: "format", row: rowNum, message: `Zeile ${rowNum}: E-Mail "${email}" könnte ungültig sein` });
        }
      }
    });

    setValidationErrors(errors);
    setValidationWarnings(warnings);
    return errors.filter(e => e.type === "mapping").length === 0;
  }, [csvData, columnMapping, targetFields]);

  // Import durchführen
  const executeImport = async () => {
    setImporting(true);
    setError("");

    try {
      // Daten für Import vorbereiten
      const importData = csvData.map(row => {
        const member = {};
        Object.entries(columnMapping).forEach(([targetField, csvColumn]) => {
          if (csvColumn && row[csvColumn]) {
            let value = row[csvColumn].trim();

            // Datumsformat konvertieren
            if ((targetField === "geburtsdatum" || targetField === "eintrittsdatum") && /^\d{2}\.\d{2}\.\d{4}$/.test(value)) {
              const [day, month, year] = value.split(".");
              value = `${year}-${month}-${day}`;
            }

            // Geschlecht normalisieren
            if (targetField === "geschlecht") {
              const lower = value.toLowerCase();
              if (lower.startsWith("m") || lower === "male") value = "m";
              else if (lower.startsWith("w") || lower.startsWith("f") || lower === "female") value = "w";
              else if (lower.startsWith("d") || lower === "diverse") value = "d";
            }

            // IBAN bereinigen
            if (targetField === "iban") {
              value = value.replace(/\s/g, "").toUpperCase();
            }

            member[targetField] = value;
          }
        });
        return member;
      });

      const response = await fetchWithAuth(`${config.apiBaseUrl}/mitglieder/csv-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          members: importData,
          options: importOptions
        })
      });

      const result = await response.json();

      if (response.ok) {
        setImportResult(result);
        setCurrentStep(5);
      } else {
        setError(result.error || "Import fehlgeschlagen");
      }
    } catch (err) {
      console.error("Import error:", err);
      setError("Verbindungsfehler beim Import");
    } finally {
      setImporting(false);
    }
  };

  // Template herunterladen
  const downloadTemplate = () => {
    const headers = targetFields.map(f => f.label).join(";");
    const example = "Max;Mustermann;01.01.1990;m;max@example.com;0123456789;;Musterstraße;1;12345;Musterstadt;Deutschland;DE89370400440532013000;COBADEFFXXX;Commerzbank;Max Mustermann;;;";
    const csv = headers + "\\n" + example;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mitglieder_import_vorlage.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Step Navigation
  const canProceed = () => {
    switch (currentStep) {
      case 1: return true;
      case 2: return csvFile && csvData.length > 0;
      case 3: return Object.keys(columnMapping).filter(k => columnMapping[k]).length >= 4;
      case 4: return validationErrors.filter(e => e.type === "mapping").length === 0;
      default: return false;
    }
  };

  const nextStep = () => {
    if (currentStep === 3) {
      validateData();
    }
    if (currentStep < 5 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Render Steps
  const renderStep1 = () => (
    <div className="wizard-step">
      <div className="step-icon-large">
        <Users size={48} />
      </div>
      <h2>Willkommen beim CSV-Import</h2>
      <p className="step-description">
        Mit diesem Assistenten können Sie Mitgliederdaten aus einer CSV-Datei importieren.
      </p>

      <div className="info-cards">
        <div className="info-card">
          <HelpCircle size={24} />
          <h3>Was wird benötigt?</h3>
          <ul>
            <li>Eine CSV-Datei mit Mitgliederdaten</li>
            <li>Mindestens: Vorname, Nachname, Geburtsdatum, Geschlecht</li>
            <li>Optional: Adresse, Bankdaten, Kontaktdaten</li>
          </ul>
        </div>

        <div className="info-card">
          <FileSpreadsheet size={24} />
          <h3>CSV-Format</h3>
          <ul>
            <li>Trennzeichen: Semikolon (;) oder Komma (,)</li>
            <li>Erste Zeile: Spaltenüberschriften</li>
            <li>Encoding: UTF-8 empfohlen</li>
          </ul>
        </div>

        <div className="info-card">
          <AlertTriangle size={24} />
          <h3>Wichtige Hinweise</h3>
          <ul>
            <li>Datumsformat: TT.MM.JJJJ oder JJJJ-MM-TT</li>
            <li>Geschlecht: m, w, d (oder ausgeschrieben)</li>
            <li>IBAN ohne Leerzeichen</li>
          </ul>
        </div>
      </div>

      <button className="btn-template" onClick={downloadTemplate}>
        <Download size={18} />
        Vorlage herunterladen
      </button>
    </div>
  );

  const renderStep2 = () => (
    <div className="wizard-step">
      <h2>CSV-Datei hochladen</h2>
      <p className="step-description">
        Wählen Sie Ihre CSV-Datei aus oder ziehen Sie sie in das Feld.
      </p>

      <div className="upload-options">
        <label className="option-row">
          <span>Trennzeichen:</span>
          <select
            value={importOptions.delimiter}
            onChange={(e) => {
              setImportOptions({ ...importOptions, delimiter: e.target.value });
              if (csvFile) {
                const reader = new FileReader();
                reader.onload = (event) => {
                  const { headers, data } = parseCSV(event.target.result, e.target.value);
                  setCsvHeaders(headers);
                  setCsvData(data);
                };
                reader.readAsText(csvFile, "UTF-8");
              }
            }}
          >
            <option value=";">Semikolon (;)</option>
            <option value=",">Komma (,)</option>
            <option value="\t">Tabulator</option>
          </select>
        </label>
      </div>

      <div
        className={`upload-zone ${csvFile ? "has-file" : ""}`}
        onClick={() => document.getElementById("csv-input").click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) {
            const fakeEvent = { target: { files: [file] } };
            handleFileUpload(fakeEvent);
          }
        }}
      >
        <input
          type="file"
          id="csv-input"
          accept=".csv"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
        {csvFile ? (
          <div className="file-info">
            <CheckCircle size={32} className="success-icon" />
            <p className="file-name">{csvFile.name}</p>
            <p className="file-stats">{csvData.length} Datensätze gefunden</p>
            <p className="file-stats">{csvHeaders.length} Spalten erkannt</p>
          </div>
        ) : (
          <>
            <Upload size={48} />
            <p>Klicken oder Datei hierher ziehen</p>
            <span className="hint">CSV-Datei, max. 10MB</span>
          </>
        )}
      </div>

      {csvHeaders.length > 0 && (
        <div className="preview-headers">
          <h4>Erkannte Spalten:</h4>
          <div className="header-tags">
            {csvHeaders.map((h, i) => (
              <span key={i} className="header-tag">{h}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="wizard-step">
      <h2>Spalten zuordnen</h2>
      <p className="step-description">
        Ordnen Sie die CSV-Spalten den entsprechenden Feldern zu.
        <span className="required-hint">* = Pflichtfeld</span>
      </p>

      <div className="mapping-grid">
        {targetFields.map((field) => (
          <div key={field.key} className={`mapping-row ${field.required ? "required" : ""}`}>
            <label>
              {field.label}
              {field.required && <span className="asterisk">*</span>}
              {field.hint && <span className="field-hint">{field.hint}</span>}
            </label>
            <select
              value={columnMapping[field.key] || ""}
              onChange={(e) => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
              className={field.required && !columnMapping[field.key] ? "missing" : ""}
            >
              <option value="">-- Nicht zuordnen --</option>
              {csvHeaders.map((h, i) => (
                <option key={i} value={h}>{h}</option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="import-options">
        <h4>Import-Optionen</h4>
        <label className="checkbox-option">
          <input
            type="checkbox"
            checked={importOptions.createSepaMandate}
            onChange={(e) => setImportOptions({ ...importOptions, createSepaMandate: e.target.checked })}
          />
          <span>SEPA-Mandat automatisch erstellen (wenn IBAN vorhanden)</span>
        </label>
        <label className="checkbox-option">
          <input
            type="checkbox"
            checked={importOptions.requireConfirmation}
            onChange={(e) => setImportOptions({ ...importOptions, requireConfirmation: e.target.checked })}
          />
          <span>AGB-Bestätigung beim ersten Login erforderlich</span>
        </label>
        <label className="checkbox-option">
          <input
            type="checkbox"
            checked={importOptions.skipDuplicates}
            onChange={(e) => setImportOptions({ ...importOptions, skipDuplicates: e.target.checked })}
          />
          <span>Duplikate überspringen (gleicher Name + Geburtsdatum)</span>
        </label>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="wizard-step">
      <h2>Vorschau & Validierung</h2>
      <p className="step-description">
        Überprüfen Sie die Daten vor dem Import.
      </p>

      {validationErrors.length > 0 && (
        <div className="validation-section errors">
          <h4><AlertTriangle size={18} /> Fehler ({validationErrors.length})</h4>
          <ul>
            {validationErrors.slice(0, 10).map((err, i) => (
              <li key={i}>{err.message}</li>
            ))}
            {validationErrors.length > 10 && (
              <li className="more">...und {validationErrors.length - 10} weitere</li>
            )}
          </ul>
        </div>
      )}

      {validationWarnings.length > 0 && (
        <div className="validation-section warnings">
          <h4><Info size={18} /> Warnungen ({validationWarnings.length})</h4>
          <ul>
            {validationWarnings.slice(0, 5).map((warn, i) => (
              <li key={i}>{warn.message}</li>
            ))}
            {validationWarnings.length > 5 && (
              <li className="more">...und {validationWarnings.length - 5} weitere</li>
            )}
          </ul>
        </div>
      )}

      <div className="preview-summary">
        <div className="summary-card">
          <span className="number">{csvData.length}</span>
          <span className="label">Datensätze</span>
        </div>
        <div className="summary-card">
          <span className="number">{Object.keys(columnMapping).filter(k => columnMapping[k]).length}</span>
          <span className="label">Zugeordnete Felder</span>
        </div>
        <div className="summary-card">
          <span className="number">{csvData.filter(r => r[columnMapping.iban]).length}</span>
          <span className="label">Mit IBAN</span>
        </div>
      </div>

      <div className="preview-table-container">
        <h4>Datenvorschau (erste 5 Zeilen)</h4>
        <table className="preview-table">
          <thead>
            <tr>
              {targetFields.filter(f => columnMapping[f.key]).map(f => (
                <th key={f.key}>{f.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {csvData.slice(0, 5).map((row, i) => (
              <tr key={i}>
                {targetFields.filter(f => columnMapping[f.key]).map(f => (
                  <td key={f.key}>{row[columnMapping[f.key]] || "-"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && (
        <div className="error-message">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <button
        className="btn-import"
        onClick={executeImport}
        disabled={importing || validationErrors.filter(e => e.type === "mapping").length > 0}
      >
        {importing ? (
          <>
            <Loader className="spinner" size={18} />
            Import läuft...
          </>
        ) : (
          <>
            <Upload size={18} />
            {csvData.length} Mitglieder importieren
          </>
        )}
      </button>
    </div>
  );

  const renderStep5 = () => (
    <div className="wizard-step">
      <div className="step-icon-large success">
        <CheckCircle size={48} />
      </div>
      <h2>Import abgeschlossen!</h2>

      {importResult && (
        <div className="result-summary">
          <div className="result-card success">
            <span className="number">{importResult.imported || 0}</span>
            <span className="label">Erfolgreich importiert</span>
          </div>
          {importResult.skipped > 0 && (
            <div className="result-card warning">
              <span className="number">{importResult.skipped}</span>
              <span className="label">Übersprungen (Duplikate)</span>
            </div>
          )}
          {importResult.failed > 0 && (
            <div className="result-card error">
              <span className="number">{importResult.failed}</span>
              <span className="label">Fehlgeschlagen</span>
            </div>
          )}
          {importResult.sepaCreated > 0 && (
            <div className="result-card info">
              <span className="number">{importResult.sepaCreated}</span>
              <span className="label">SEPA-Mandate erstellt</span>
            </div>
          )}
        </div>
      )}

      <div className="result-actions">
        <button className="btn-secondary" onClick={() => navigate("/dashboard/mitglieder")}>
          <Users size={18} />
          Zur Mitgliederliste
        </button>
        <button className="btn-primary" onClick={() => {
          setCurrentStep(1);
          setCsvFile(null);
          setCsvData([]);
          setCsvHeaders([]);
          setColumnMapping({});
          setImportResult(null);
        }}>
          <Upload size={18} />
          Weiteren Import starten
        </button>
      </div>
    </div>
  );

  return (
    <div className="csv-import-container">
      <div className="csv-import-header">
        <button className="btn-back" onClick={() => navigate("/dashboard/mitglieder")}>
          <ArrowLeft size={20} />
          Zurück
        </button>
        <div className="header-title">
          <FileSpreadsheet size={28} />
          <div>
            <h1>CSV-Import</h1>
            <p>Mitglieder aus CSV-Datei importieren</p>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="wizard-progress">
        {steps.map((step) => (
          <div
            key={step.num}
            className={`progress-step ${currentStep === step.num ? "active" : ""} ${currentStep > step.num ? "completed" : ""}`}
          >
            <div className="step-circle">
              {currentStep > step.num ? <Check size={16} /> : <step.icon size={16} />}
            </div>
            <span className="step-title">{step.title}</span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="wizard-content">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
      </div>

      {/* Navigation */}
      {currentStep < 5 && (
        <div className="wizard-navigation">
          <button
            className="btn-prev"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ArrowLeft size={18} />
            Zurück
          </button>
          <button
            className="btn-next"
            onClick={nextStep}
            disabled={!canProceed()}
          >
            {currentStep === 4 ? "Import starten" : "Weiter"}
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
};

export default CSVImport;
