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
import openApiBlob from '../utils/openApiBlob';
import LastschriftAutomatik from './LastschriftAutomatik';
import '../styles/LastschriftAutomatik.css';


const Lastschriftlauf = ({ embedded = false, dojoIdOverride = null }) => {
  const navigate = useNavigate();
  const { activeDojo } = useDojoContext();
  const dojoId = dojoIdOverride || activeDojo?.id || activeDojo;
  const [activeTab, setActiveTab] = useState('manuell');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [missingMandates, setMissingMandates] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState('csv');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableBanks, setAvailableBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Zahllauf erstellen State
  const [zahllaufCreating, setZahllaufCreating] = useState(false);
  const [zahllaufCreated, setZahllaufCreated] = useState(null);

  // Stripe SEPA State
  const [stripeStatus, setStripeStatus] = useState(null);
  const [stripeProcessing, setStripeProcessing] = useState(false);
  const [stripeSetupProgress, setStripeSetupProgress] = useState(null);
  const [stripeBatchResult, setStripeBatchResult] = useState(null);

  // Vorschau ein-/ausklappen
  const [previewOpen, setPreviewOpen] = useState(true);

  // Nicht-im-Lauf Übersicht
  const [notInRun, setNotInRun] = useState(null);
  const [notInRunOpen, setNotInRunOpen] = useState(false);
  const [notInRunLoading, setNotInRunLoading] = useState(false);

  const loadNotInRun = async () => {
    setNotInRunLoading(true);
    try {
      const dojoParam = numericDojoId ? `&dojo_id=${numericDojoId}` : '';
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/lastschriftlauf/not-in-run?monat=${selectedMonth}&jahr=${selectedYear}${dojoParam}`
      );
      const data = await response.json();
      setNotInRun(data);
    } catch (e) {
      setNotInRun({ success: false, error: e.message });
    } finally {
      setNotInRunLoading(false);
    }
  };

  // Suche + Sortierung
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewMonthFilter, setPreviewMonthFilter] = useState('');
  const [previewSort, setPreviewSort] = useState({ field: 'name', dir: 'asc' });

  const toggleSort = (field) => {
    setPreviewSort(prev => ({
      field,
      dir: prev.field === field && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredPreview = React.useMemo(() => {
    if (!preview?.preview) return [];
    let items = [...preview.preview];
    if (previewSearch.trim()) {
      const q = previewSearch.toLowerCase();
      items = items.filter(i =>
        i.name?.toLowerCase().includes(q) ||
        String(i.mitglied_id).includes(q) ||
        i.iban?.toLowerCase().includes(q)
      );
    }
    if (previewMonthFilter) {
      items = items.filter(i => i.offene_monate?.includes(previewMonthFilter));
    }
    items.sort((a, b) => {
      let va, vb;
      if (previewSort.field === 'name') { va = a.name || ''; vb = b.name || ''; }
      else if (previewSort.field === 'betrag') { va = parseFloat(a.betrag || 0); vb = parseFloat(b.betrag || 0); }
      else if (previewSort.field === 'monate') { va = a.anzahl_monate || 0; vb = b.anzahl_monate || 0; }
      else { va = a.name || ''; vb = b.name || ''; }
      if (typeof va === 'string') return previewSort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return previewSort.dir === 'asc' ? va - vb : vb - va;
    });
    return items;
  }, [preview, previewSearch, previewMonthFilter, previewSort]);

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

  const parsedDojoId = dojoId && parseInt(dojoId, 10) ? parseInt(dojoId, 10) : null;
  // Fallback: dojo_id der gewählten Bank verwenden wenn kein Dojo-Kontext (Super-Admin global)
  const selectedBankObj = availableBanks.find(b => b.id === selectedBank);
  const numericDojoId = parsedDojoId || selectedBankObj?.dojo_id || null;

  const loadPreview = async () => {
    try {
      setLoading(true);
      const dojoParam = numericDojoId ? `&dojo_id=${numericDojoId}` : '';
      // Monat und Jahr als Query-Parameter übergeben
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/preview?monat=${selectedMonth}&jahr=${selectedYear}${dojoParam}`);

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
      const dojoParam = numericDojoId ? `?dojo_id=${numericDojoId}` : '';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/missing-mandates${dojoParam}`);
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
      const dojoParam = numericDojoId ? `?dojo_id=${numericDojoId}` : '';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/banken${dojoParam}`);
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
    try {
      const params = numericDojoId ? `?dojo_id=${numericDojoId}` : '';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/stripe/status${params}`);
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
      const dojoParam = numericDojoId ? `?dojo_id=${numericDojoId}` : '';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/stripe/setup-all${dojoParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dojo_id: numericDojoId })
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

  // Stripe: Status letzten Monat bei Stripe abfragen und Beiträge aktualisieren
  const [stripeSyncing, setStripeSyncing] = useState(false);
  const [stripeSyncResult, setStripeSyncResult] = useState(null);

  const handleStripeSyncVormonat = async () => {
    if (!window.confirm(
      `Alle offenen Stripe-Lastschriften prüfen?\n\n` +
      `Alle noch offenen Lastschriften (alle Monate) werden bei Stripe geprüft ` +
      `und erfolgreich eingezogene Beiträge automatisch auf "bezahlt" gesetzt.`
    )) return;

    setStripeSyncing(true);
    setStripeSyncResult(null);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/payment-provider/stripe/sync-lastschriften`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dojo_id: numericDojoId })
      });
      const data = await response.json();
      setStripeSyncResult(data);
      if (data.succeeded > 0) await loadPreview();
    } catch (error) {
      setStripeSyncResult({ success: false, error: error.message });
    } finally {
      setStripeSyncing(false);
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
      const dojoParam = numericDojoId ? `?dojo_id=${numericDojoId}` : '';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/stripe/execute${dojoParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dojo_id: numericDojoId,
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
  }, [activeDojo]);

  useEffect(() => {
    loadPreview();
  }, [selectedMonth, selectedYear]);

  const handleCreateZahllauf = async () => {
    if (!preview || preview.count === 0) {
      alert('Keine Lastschriften vorhanden – Vorschau zuerst laden.');
      return;
    }
    if (!selectedBank) {
      alert('Bitte eine Einzugsbank auswählen.');
      return;
    }
    const bankInfo = availableBanks.find(b => b.id === selectedBank);
    const monatStr = String(selectedMonth).padStart(2, '0');
    // Buchungsnummer mit Zeitstempel eindeutig machen (UNIQUE constraint in DB)
    const ts = Date.now().toString().slice(-4);
    const buchungsnummer = `LS-${selectedYear}-${monatStr}-${ts}`;
    // Letzter Tag des Abrechnungsmonats als forderungen_bis
    const forderungen_bis = new Date(selectedYear, selectedMonth, 0).toISOString().substring(0, 10);
    // 5. des Folgemonats als geplanter Einzug
    const einzugDate = new Date(selectedYear, selectedMonth, 5);
    const geplanter_einzug = einzugDate.toISOString().substring(0, 10);

    const confirm = window.confirm(
      `Zahllauf in der Datenbank speichern?\n\n` +
      `Buchungsnummer: ${buchungsnummer}\n` +
      `Forderungen bis: ${forderungen_bis}\n` +
      `Geplanter Einzug: ${geplanter_einzug}\n` +
      `Anzahl: ${preview.count} Mandate\n` +
      `Betrag: ${preview.total_amount} €\n` +
      `Bank: ${bankInfo?.bank_name || 'Unbekannt'}`
    );
    if (!confirm) return;

    try {
      setZahllaufCreating(true);
      const response = await fetchWithAuth(`${config.apiBaseUrl}/zahllaeufe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buchungsnummer,
          forderungen_bis,
          geplanter_einzug,
          zahlungsanbieter: bankInfo?.bank_typ === 'stripe' ? 'Stripe SEPA' : 'SEPA (Lastschrift)',
          anzahl_buchungen: preview.count,
          betrag: preview.total_amount,
          dojo_id: dojoId || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler beim Erstellen');
      setZahllaufCreated(data.zahllauf_id);
      alert(`✅ Zahllauf #${data.zahllauf_id} erfolgreich gespeichert!\nBuchungsnummer: ${buchungsnummer}`);
    } catch (err) {
      alert('Fehler beim Erstellen des Zahllaufs: ' + err.message);
    } finally {
      setZahllaufCreating(false);
    }
  };

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
      openApiBlob(`${config.apiBaseUrl}/lastschriftlauf${exportParams}`, { download: true, filename: `lastschrift-${selectedYear}-${selectedMonth}.csv` });
    } else if (selectedFormat === 'xml') {
      openApiBlob(`${config.apiBaseUrl}/lastschriftlauf/xml${exportParams}`, { download: true, filename: `lastschrift-${selectedYear}-${selectedMonth}.xml` });
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
        <button className="btn btn-secondary ll-btn-sm" onClick={() => navigate('/dashboard/beitraege')}>
          <ArrowLeft size={16} />
          Zurück
        </button>
        <div>
          <h1>💶 SEPA-Lastschriftlauf</h1>
          <p>Monatliche Lastschriften generieren und an Bank übermitteln</p>
        </div>
        <div className="u-flex-gap-sm">
          <button
            className="btn btn-secondary ll-btn-sm"
            onClick={() => navigate('/dashboard/zahllaeufe')}
          >
            <FileText size={16} />
            Zahlläufe-Übersicht
          </button>
          <button
            className="btn btn-info ll-btn-sm"
            onClick={loadPreview}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Aktualisieren
          </button>
        </div>
      </div>
      )}

      {/* Tab-Navigation */}
      <div className="ll-tab-nav">
        <button
          className={`ll-tab-btn${activeTab === 'manuell' ? ' ll-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('manuell')}
        >
          <CreditCard size={15} /> Manueller Lauf
        </button>
        <button
          className={`ll-tab-btn${activeTab === 'automatik' ? ' ll-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('automatik')}
        >
          <Zap size={15} /> Automatischer Einzug
        </button>
      </div>

      {/* Tab: Automatischer Einzug */}
      {activeTab === 'automatik' && (
        <LastschriftAutomatik dojoId={dojoId} />
      )}

      {/* Tab: Manueller Lauf — bestehender Inhalt */}
      {activeTab === 'manuell' && (
      <>

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
                      className="missing-mandate-item ll-cursor-pointer"
                      onClick={() => navigate(`/dashboard/mitglieder/${member.mitglied_id}`)}
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
                  className="logout-button ll-mt-1"
                  onClick={() => navigate('/dashboard/sepa-mandate')}
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
              className="form-select-compact ll-select-wide"
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
            className="logout-button ll-nowrap"
            onClick={loadPreview}
            disabled={loading}
          >
            <Eye size={16} />
            {loading ? 'Lädt...' : 'Vorschau aktualisieren'}
          </button>

          <button
            className="logout-button ll-nowrap ll-create-btn"
            onClick={handleCreateZahllauf}
            disabled={zahllaufCreating || !preview || preview.count === 0}
          >
            {zahllaufCreating ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
            {zahllaufCreated ? `✓ Lauf #${zahllaufCreated}` : 'Zahllauf erstellen'}
          </button>

          <button
            className="logout-button ll-nowrap"
            onClick={handleExport}
            disabled={loading || !preview || preview.count === 0}
          >
            <Download size={16} />
            Jetzt exportieren
          </button>

          {/* Stripe Buttons - nur anzeigen wenn Stripe konfiguriert */}
          {stripeStatus?.stripe_configured && (
            <>
              <div className="ll-divider" />

              {stripeStatus.needs_setup > 0 && (
                <button
                  className="logout-button ll-stripe-setup-btn"
                  onClick={handleStripeSetupAll}
                  disabled={stripeProcessing}
                  title={`${stripeStatus.needs_setup} Mitglieder benötigen Stripe Setup`}
                >
                  {stripeProcessing ? <Loader size={16} className="spin" /> : <Settings size={16} />}
                  Stripe Setup ({stripeStatus.needs_setup})
                </button>
              )}

              <button
                className="logout-button ll-stripe-execute-btn"
                onClick={handleStripeExecute}
                disabled={stripeProcessing || !preview || preview.count === 0}
              >
                {stripeProcessing ? <Loader size={16} className="spin" /> : <Zap size={16} />}
                Mit Stripe einziehen
              </button>

              <button
                className="logout-button ll-stripe-sync-btn"
                onClick={handleStripeSyncVormonat}
                disabled={stripeSyncing}
                title="Alle offenen Lastschriften bei Stripe abfragen und Beiträge automatisch auf bezahlt setzen"
              >
                {stripeSyncing ? <Loader size={16} className="spin" /> : <RefreshCw size={16} />}
                Stripe Sync
              </button>
            </>
          )}
        </div>

        {/* Stripe Setup Fortschritt */}
        {stripeSetupProgress && (
          <div className={`ll-stripe-progress ll-stripe-progress--${stripeSetupProgress.status}`}>
            <div className="u-flex-row-sm">
              {stripeSetupProgress.status === 'running' && <Loader size={16} className="spin" />}
              {stripeSetupProgress.status === 'completed' && <CheckCircle size={16} className="u-text-success" />}
              {stripeSetupProgress.status === 'error' && <AlertCircle size={16} className="u-text-error" />}
              <span>{stripeSetupProgress.message}</span>
              {stripeSetupProgress.status !== 'running' && (
                <button
                  onClick={() => setStripeSetupProgress(null)}
                  className="ll-dismiss-btn"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}

        {/* Stripe Batch Ergebnis */}
        {stripeBatchResult && (
          <div className={`ll-stripe-result${stripeBatchResult.status === 'error' ? ' ll-stripe-result--error' : ' ll-stripe-result--ok'}`}>
            <div className="ll-flex-between">
              <div className="u-flex-row-sm">
                {stripeBatchResult.status === 'error' ? (
                  <AlertCircle size={16} className="u-text-error" />
                ) : (
                  <CheckCircle size={16} className="u-text-success" />
                )}
                <span>
                  {stripeBatchResult.status === 'error' ? stripeBatchResult.message :
                    `Lastschriftlauf abgeschlossen: ${stripeBatchResult.succeeded} erfolgreich, ${stripeBatchResult.processing || 0} in Verarbeitung, ${stripeBatchResult.failed} fehlgeschlagen`}
                </span>
              </div>
              <button
                onClick={() => setStripeBatchResult(null)}
                className="ll-dismiss-btn"
              >
                ×
              </button>
            </div>
            {stripeBatchResult.batch_id && (
              <div className="ll-batch-id">
                Batch-ID: {stripeBatchResult.batch_id}
              </div>
            )}
          </div>
        )}

        {/* Sync-Ergebnis */}
        {stripeSyncResult && (
          <div className={`ll-stripe-result${!stripeSyncResult.success ? ' ll-stripe-result--error' : ' ll-stripe-result--ok'}`}>
            <div className="ll-flex-between">
              <div className="u-flex-row-sm">
                {!stripeSyncResult.success ? (
                  <AlertCircle size={16} className="u-text-error" />
                ) : (
                  <CheckCircle size={16} className="u-text-success" />
                )}
                <span>
                  {!stripeSyncResult.success
                    ? `Sync-Fehler: ${stripeSyncResult.error || stripeSyncResult.details}`
                    : `Sync abgeschlossen (${stripeSyncResult.synced} geprüft): ` +
                      `${stripeSyncResult.succeeded} bezahlt, ` +
                      `${stripeSyncResult.failed} fehlgeschlagen, ` +
                      `${stripeSyncResult.still_processing} noch offen`
                  }
                </span>
              </div>
              <button onClick={() => setStripeSyncResult(null)} className="ll-dismiss-btn">×</button>
            </div>
          </div>
        )}
      </div>

      {/* Vorschau Tabelle */}
      {preview && preview.preview && preview.preview.length > 0 && (
        <div className="preview-card">
          <div className="ll-not-in-run-header" onClick={() => setPreviewOpen(o => !o)}>
            <h2 style={{margin:0}}>Vorschau ({preview.count} Einträge) - Gesamtsumme: {formatCurrency(preview.total_amount)}</h2>
            {previewOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>

          {previewOpen && <>
          {/* Such- und Filterleiste */}
          <div className="ll-filter-bar">
            <input
              type="text"
              className="ll-filter-input"
              placeholder="Name, ID oder IBAN suchen…"
              value={previewSearch}
              onChange={e => setPreviewSearch(e.target.value)}
            />
            <input
              type="text"
              className="ll-filter-input ll-filter-input--sm"
              placeholder="Monat (z.B. 03/2026)"
              value={previewMonthFilter}
              onChange={e => setPreviewMonthFilter(e.target.value)}
            />
            {(previewSearch || previewMonthFilter) && (
              <button className="ll-filter-clear" onClick={() => { setPreviewSearch(''); setPreviewMonthFilter(''); }}>
                ✕ Filter löschen
              </button>
            )}
            {(previewSearch || previewMonthFilter) && (
              <span className="ll-filter-count">{filteredPreview.length} von {preview.count}</span>
            )}
          </div>

          <div className="table-container">
            <table className="preview-table">
              <thead>
                <tr>
                  <th className="ll-th-expand"></th>
                  <th className="ll-th-sortable" onClick={() => toggleSort('name')}>
                    Mitglied {previewSort.field === 'name' ? (previewSort.dir === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th>IBAN</th>
                  <th className="ll-th-sortable" onClick={() => toggleSort('monate')}>
                    Offene Monate {previewSort.field === 'monate' ? (previewSort.dir === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="ll-th-sortable" onClick={() => toggleSort('betrag')}>
                    Gesamtbetrag {previewSort.field === 'betrag' ? (previewSort.dir === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th>Mandatsreferenz</th>
                  <th>Tarif</th>
                </tr>
              </thead>
              <tbody>
                {filteredPreview.map((item, index) => (
                  <React.Fragment key={index}>
                    <tr>
                      <td className="ll-td-expand"
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
                        <span className="badge badge-warning ll-badge-mr">
                          {item.anzahl_monate} {item.anzahl_monate === 1 ? 'Monat' : 'Monate'}
                        </span>
                        <br />
                        <small className="u-text-secondary">{item.offene_monate}</small>
                      </td>
                      <td>
                        <strong className={`ll-betrag-value${item.anzahl_monate > 1 ? ' ll-betrag-value--warn' : ''}`}>
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
                        <td colSpan={6} className="ll-details-td">
                          <div className="ll-details-inner">
                            <strong className="ll-details-heading">Einzelne Beiträge:</strong>
                            <table className="ll-details-table">
                              <thead>
                                <tr className="ll-details-thead-row">
                                  <th className="ll-td-left">Beschreibung</th>
                                  <th className="ll-td-left">Datum</th>
                                  <th className="ll-td-right">Betrag</th>
                                </tr>
                              </thead>
                              <tbody>
                                {item.beitraege.map((beitrag, bIdx) => (
                                  <tr key={bIdx} className="ll-details-beitrag-row">
                                    <td className="ll-td-pad">{beitrag.beschreibung || beitrag.monat}</td>
                                    <td className="ll-td-pad">{beitrag.datum}</td>
                                    <td className="ll-td-right">{formatCurrency(beitrag.betrag)}</td>
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
          </>}
        </div>
      )}

      {/* Nicht im Lauf */}
      {preview && (
        <div className="preview-card ll-not-in-run-card">
          <div className="ll-not-in-run-header" onClick={() => { setNotInRunOpen(o => !o); if (!notInRun) loadNotInRun(); }}>
            <h3>Wer fehlt im Einzug? {notInRun ? `(${notInRun.count})` : ''}</h3>
            {notInRunOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>
          {notInRunOpen && (
            <div className="ll-not-in-run-body">
              {notInRunLoading && <p className="u-text-secondary">Lade…</p>}
              {notInRun && notInRun.success && notInRun.members?.length === 0 && (
                <p className="u-text-secondary">Alle SEPA-Mitglieder sind im Lauf enthalten.</p>
              )}
              {notInRun && notInRun.success && notInRun.members?.length > 0 && (
                <table className="preview-table">
                  <thead>
                    <tr>
                      <th>Mitglied</th>
                      <th>Vertragsstatus</th>
                      <th>Offene Beiträge</th>
                      <th>Grund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notInRun.members.map(m => (
                      <tr key={m.mitglied_id}>
                        <td><strong>{m.name}</strong><br /><small>ID: {m.mitglied_id}</small></td>
                        <td><span className={`badge badge-${m.vertrag_status === 'aktiv' ? 'success' : 'warning'}`}>{m.vertrag_status || '—'}</span></td>
                        <td>{m.offene_beitraege}</td>
                        <td><span className="badge badge-danger">{m.grund}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {notInRun && !notInRun.success && (
                <p className="u-text-error">Fehler: {notInRun.error}</p>
              )}
            </div>
          )}
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

      </>
      )}
    </div>
  );
};

export default Lastschriftlauf;
