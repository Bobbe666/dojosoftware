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
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Zap,
  Settings,
  Loader
} from "lucide-react";
import config from "../config/config";
import { useDojoContext } from '../context/DojoContext';
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Lastschriftlauf.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';


const Lastschriftlauf = ({ embedded = false }) => {
  const navigate = useNavigate();
  const { activeDojo } = useDojoContext();
  const dojoId = activeDojo?.id || activeDojo;
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [missingMandates, setMissingMandates] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableBanks, setAvailableBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Stripe SEPA State
  const [stripeStatus, setStripeStatus] = useState(null);
  const [stripeProcessing, setStripeProcessing] = useState(false);
  const [stripeSetupProgress, setStripeSetupProgress] = useState(null);
  const [stripeBatchResult, setStripeBatchResult] = useState(null);

  // Toggle für Beiträge-Details Dropdown
  const toggleRowExpanded = (mitgliedId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(mitgliedId)) {
        newSet.delete(mitgliedId);
      } else {
        newSet.add(mitgliedId);
      }
      return newSet;
    });
  };

  const loadPreview = async () => {
    try {
      setLoading(true);
      // Monat und Jahr als Query-Parameter übergeben
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/preview?monat=${selectedMonth}&jahr=${selectedYear}`);

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

  const loadBanks = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/banken`);
      if (response.ok) {
        const data = await response.json();
        const banken = data.banken || [];
        setAvailableBanks(banken);
        // Standardbank automatisch auswählen
        const standardBank = banken.find(b => b.ist_standard) || banken[0];
        if (standardBank && !selectedBank) {
          setSelectedBank(standardBank.id);
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Bankkonten:', error);
    }
  };

  // Stripe Status laden
  const loadStripeStatus = async () => {
    if (!dojoId) return;
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/stripe/status?dojo_id=${dojoId}`);
      if (response.ok) {
        const data = await response.json();
        setStripeStatus(data);
      }
    } catch (error) {
      console.error('Fehler beim Laden des Stripe-Status:', error);
    }
  };

  // Stripe Setup für alle Mitglieder
  const handleStripeSetupAll = async () => {
    if (!window.confirm('Stripe SEPA Setup für alle Mitglieder ohne Setup durchführen?\n\nDies erstellt Stripe Customers und SEPA PaymentMethods für alle Mitglieder mit aktivem SEPA-Mandat.')) {
      return;
    }

    setStripeProcessing(true);
    setStripeSetupProgress({ status: 'running', message: 'Setup wird durchgeführt...' });

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/stripe/setup-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dojo_id: dojoId })
      });

      const data = await response.json();

      if (data.success) {
        setStripeSetupProgress({
          status: 'completed',
          message: `Setup abgeschlossen: ${data.succeeded} erfolgreich, ${data.failed} fehlgeschlagen`,
          details: data.details
        });
        // Status neu laden
        await loadStripeStatus();
      } else {
        setStripeSetupProgress({
          status: 'error',
          message: data.error || 'Setup fehlgeschlagen'
        });
      }
    } catch (error) {
      setStripeSetupProgress({
        status: 'error',
        message: 'Fehler: ' + error.message
      });
    } finally {
      setStripeProcessing(false);
    }
  };

  // Stripe Lastschrift ausführen
  const handleStripeExecute = async () => {
    if (!preview || !preview.preview || preview.preview.length === 0) {
      alert('Keine Mitglieder für den Lastschriftlauf vorhanden');
      return;
    }

    const confirmMessage = `Stripe SEPA Lastschriftlauf ausführen?\n\n` +
      `Monat: ${selectedMonth}/${selectedYear}\n` +
      `Anzahl Mitglieder: ${preview.count}\n` +
      `Gesamtbetrag: €${preview.total_amount}\n\n` +
      `Die Lastschriften werden direkt über Stripe eingezogen.\n` +
      `ACHTUNG: Dies kann nicht rückgängig gemacht werden!`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setStripeProcessing(true);
    setStripeBatchResult(null);

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/stripe/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dojo_id: dojoId,
          monat: selectedMonth,
          jahr: selectedYear,
          mitglieder: preview.preview.map(m => ({
            mitglied_id: m.mitglied_id,
            name: m.name,
            betrag: m.betrag,
            beitraege: m.beitraege,
            offene_monate: m.offene_monate
          }))
        })
      });

      const data = await response.json();

      if (data.success) {
        setStripeBatchResult({
          status: 'completed',
          batch_id: data.batch_id,
          total: data.total,
          succeeded: data.succeeded,
          processing: data.processing,
          failed: data.failed,
          transactions: data.transactions
        });
        // Vorschau neu laden um bezahlte Beiträge zu aktualisieren
        await loadPreview();
      } else {
        setStripeBatchResult({
          status: 'error',
          message: data.error || 'Lastschriftlauf fehlgeschlagen'
        });
      }
    } catch (error) {
      setStripeBatchResult({
        status: 'error',
        message: 'Fehler: ' + error.message
      });
    } finally {
      setStripeProcessing(false);
    }
  };

  useEffect(() => {
    loadBanks();
    loadMissingMandates();
    loadStripeStatus();
  }, [dojoId]);

  useEffect(() => {
    loadPreview();
  }, [selectedMonth, selectedYear]);

  const handleExport = () => {
    if (!preview || preview.count === 0) {
      alert('Keine Lastschriften zum Exportieren vorhanden');
      return;
    }

    if (!selectedBank) {
      alert('Bitte wählen Sie ein Bankkonto für den Einzug aus');
      return;
    }

    const bankInfo = availableBanks.find(b => b.id === selectedBank);
    const bankName = bankInfo ? bankInfo.bank_name : 'Unbekannt';

    const confirmMessage = `SEPA-Lastschriftlauf exportieren?\n\n` +
      `Format: ${selectedFormat.toUpperCase()}\n` +
      `Monat: ${selectedMonth}/${selectedYear}\n` +
      `Einzugsbank: ${bankName}\n` +
      `Anzahl Mandate: ${preview.count}\n` +
      `Gesamtbetrag: €${preview.total_amount}\n\n` +
      `Die Datei wird heruntergeladen und kann in Ihre Banking-Software importiert werden.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const exportParams = `?monat=${selectedMonth}&jahr=${selectedYear}&bank_id=${selectedBank}`;

    if (selectedFormat === 'csv') {
      window.open(`${config.apiBaseUrl}/lastschriftlauf${exportParams}`, '_blank');
    } else if (selectedFormat === 'xml') {
      window.open(`${config.apiBaseUrl}/lastschriftlauf/xml${exportParams}`, '_blank');
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
                  <h3>Einzugsbank</h3>
                  <p className="stat-value">
                    {(() => {
                      const bank = availableBanks.find(b => b.id === selectedBank);
                      if (bank) {
                        return bank.bank_typ === 'stripe' ? 'Stripe SEPA' : bank.bank_name;
                      }
                      return 'Keine Bank gewählt';
                    })()}
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

          <div className="form-field-inline">
            <label>
              <CreditCard size={14} />
              Einzugsbank
            </label>
            <select
              value={selectedBank || ''}
              onChange={(e) => setSelectedBank(parseInt(e.target.value))}
              className="form-select-compact"
              style={{ minWidth: '200px' }}
            >
              {availableBanks.length === 0 ? (
                <option value="">Keine Bankkonten verfügbar</option>
              ) : (
                availableBanks.map(bank => (
                  <option key={bank.id} value={bank.id}>
                    {bank.dojoname ? `[${bank.dojoname}] ` : ''}{bank.bank_name} ({bank.typ_label || bank.bank_typ}) {bank.iban_masked}
                    {bank.ist_standard ? ' ★' : ''}
                  </option>
                ))
              )}
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

          {/* Stripe Buttons - nur anzeigen wenn Stripe konfiguriert */}
          {stripeStatus?.stripe_configured && (
            <>
              <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', height: '40px', margin: '0 0.5rem' }} />

              {stripeStatus.needs_setup > 0 && (
                <button
                  className="logout-button"
                  onClick={handleStripeSetupAll}
                  disabled={stripeProcessing}
                  style={{ whiteSpace: 'nowrap', background: 'rgba(99, 102, 241, 0.2)', borderColor: 'rgba(99, 102, 241, 0.5)' }}
                  title={`${stripeStatus.needs_setup} Mitglieder benötigen Stripe Setup`}
                >
                  {stripeProcessing ? <Loader size={16} className="spin" /> : <Settings size={16} />}
                  Stripe Setup ({stripeStatus.needs_setup})
                </button>
              )}

              <button
                className="logout-button"
                onClick={handleStripeExecute}
                disabled={stripeProcessing || !preview || preview.count === 0}
                style={{ whiteSpace: 'nowrap', background: 'rgba(99, 102, 241, 0.3)', borderColor: 'rgba(99, 102, 241, 0.6)' }}
              >
                {stripeProcessing ? <Loader size={16} className="spin" /> : <Zap size={16} />}
                Mit Stripe einziehen
              </button>
            </>
          )}
        </div>

        {/* Stripe Setup Fortschritt */}
        {stripeSetupProgress && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: stripeSetupProgress.status === 'error' ? 'rgba(239, 68, 68, 0.1)' :
                        stripeSetupProgress.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' :
                        'rgba(99, 102, 241, 0.1)',
            border: `1px solid ${stripeSetupProgress.status === 'error' ? 'rgba(239, 68, 68, 0.3)' :
                                 stripeSetupProgress.status === 'completed' ? 'rgba(16, 185, 129, 0.3)' :
                                 'rgba(99, 102, 241, 0.3)'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {stripeSetupProgress.status === 'running' && <Loader size={16} className="spin" />}
              {stripeSetupProgress.status === 'completed' && <CheckCircle size={16} style={{ color: '#10b981' }} />}
              {stripeSetupProgress.status === 'error' && <AlertCircle size={16} style={{ color: '#ef4444' }} />}
              <span>{stripeSetupProgress.message}</span>
              {stripeSetupProgress.status !== 'running' && (
                <button
                  onClick={() => setStripeSetupProgress(null)}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stripe Batch Ergebnis */}
        {stripeBatchResult && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: stripeBatchResult.status === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
            border: `1px solid ${stripeBatchResult.status === 'error' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {stripeBatchResult.status === 'error' ? (
                  <AlertCircle size={16} style={{ color: '#ef4444' }} />
                ) : (
                  <CheckCircle size={16} style={{ color: '#10b981' }} />
                )}
                <span>
                  {stripeBatchResult.status === 'error' ? stripeBatchResult.message :
                    `Lastschriftlauf abgeschlossen: ${stripeBatchResult.succeeded} erfolgreich, ${stripeBatchResult.processing || 0} in Verarbeitung, ${stripeBatchResult.failed} fehlgeschlagen`}
                </span>
              </div>
              <button
                onClick={() => setStripeBatchResult(null)}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            {stripeBatchResult.batch_id && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                Batch-ID: {stripeBatchResult.batch_id}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Vorschau Tabelle */}
      {preview && preview.preview && preview.preview.length > 0 && (
        <div className="preview-card">
          <h2>Vorschau ({preview.count} Einträge) - Gesamtsumme: {formatCurrency(preview.total_amount)}</h2>

          <div className="table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  <th style={{ width: '30px' }}></th>
                  <th>Mitglied</th>
                  <th>IBAN</th>
                  <th>Offene Monate</th>
                  <th>Gesamtbetrag</th>
                  <th>Mandatsreferenz</th>
                  <th>Tarif</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((item, index) => (
                  <React.Fragment key={index}>
                    <tr>
                      <td style={{ textAlign: 'center', cursor: 'pointer', padding: '0.5rem' }}
                          onClick={() => toggleRowExpanded(item.mitglied_id)}>
                        {expandedRows.has(item.mitglied_id) ? (
                          <ChevronDown size={18} />
                        ) : (
                          <ChevronRight size={18} />
                        )}
                      </td>
                      <td>
                        <strong>{item.name}</strong>
                        <br />
                        <small>ID: {item.mitglied_id}</small>
                      </td>
                      <td>
                        <code>{item.iban}</code>
                      </td>
                      <td>
                        <span className="badge badge-warning" style={{ marginRight: '0.5rem' }}>
                          {item.anzahl_monate} {item.anzahl_monate === 1 ? 'Monat' : 'Monate'}
                        </span>
                        <br />
                        <small style={{ color: 'rgba(255,255,255,0.6)' }}>{item.offene_monate}</small>
                      </td>
                      <td>
                        <strong style={{ color: item.anzahl_monate > 1 ? '#f59e0b' : '#10b981' }}>
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
                    </tr>
                    {/* Details-Zeile - nur anzeigen wenn expandiert */}
                    {expandedRows.has(item.mitglied_id) && item.beitraege && item.beitraege.length > 0 && (
                      <tr className="details-row">
                        <td></td>
                        <td colSpan={6} style={{ padding: '0.5rem 1rem', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: '0.85rem' }}>
                            <strong style={{ marginBottom: '0.5rem', display: 'block' }}>Einzelne Beiträge:</strong>
                            <table style={{ width: '100%', marginTop: '0.5rem' }}>
                              <thead>
                                <tr style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                                  <th style={{ textAlign: 'left', padding: '0.25rem' }}>Beschreibung</th>
                                  <th style={{ textAlign: 'left', padding: '0.25rem' }}>Datum</th>
                                  <th style={{ textAlign: 'right', padding: '0.25rem' }}>Betrag</th>
                                </tr>
                              </thead>
                              <tbody>
                                {item.beitraege.map((beitrag, bIdx) => (
                                  <tr key={bIdx} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <td style={{ padding: '0.25rem' }}>{beitrag.beschreibung || beitrag.monat}</td>
                                    <td style={{ padding: '0.25rem' }}>{beitrag.datum}</td>
                                    <td style={{ padding: '0.25rem', textAlign: 'right' }}>{formatCurrency(beitrag.betrag)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
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
