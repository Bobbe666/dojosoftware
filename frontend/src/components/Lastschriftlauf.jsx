import React, { useState, useEffect, useRef } from "react";
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
  Loader,
  Clock,
  Info
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
import Zahllaeufe from './Zahllaeufe';


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

  // Mitglieder ohne Tarif (Warnliste aus Preview)
  const [ohneTarif, setOhneTarif] = useState([]);
  // Mitglieder mit laufendem Stripe-Einzug (processing)
  const [inVerarbeitung, setInVerarbeitung] = useState([]);
  // Cards auf-/zugeklappt
  const [inVerarbeitungOpen, setInVerarbeitungOpen] = useState(false);
  const [ohneTarifOpen, setOhneTarifOpen] = useState(false);
  const [missingMandatesOpen, setMissingMandatesOpen] = useState(false);

  // Aus aktuellem Lauf ausgeschlossene Mitglieder (nur frontend-seitig, beiträge bleiben offen)
  const [excludedMitglieder, setExcludedMitglieder] = useState(new Set());
  const [excludedOpen, setExcludedOpen] = useState(false);

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
    let items = preview.preview.filter(i => !excludedMitglieder.has(i.mitglied_id));
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
  }, [preview, previewSearch, previewMonthFilter, previewSort, excludedMitglieder]);

  // Ausgeschlossene Mitglieder (vollständige Datensätze für die Anzeige)
  const excludedPreviewItems = React.useMemo(() => {
    if (!preview?.preview) return [];
    return preview.preview.filter(i => excludedMitglieder.has(i.mitglied_id));
  }, [preview, excludedMitglieder]);

  // Aktive Anzahl und Summe (ohne manuell ausgeschlossene)
  const activeCount = preview?.preview
    ? preview.preview.filter(i => !excludedMitglieder.has(i.mitglied_id)).length
    : 0;
  const activeTotal = preview?.preview
    ? preview.preview
        .filter(i => !excludedMitglieder.has(i.mitglied_id))
        .reduce((sum, i) => sum + parseFloat(i.betrag || 0), 0)
    : 0;

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

  // Mitglied aus aktuellem Lauf ausschließen / wieder einschließen
  const toggleExclude = (mitgliedId) => {
    setExcludedMitglieder(prev => {
      const s = new Set(prev);
      if (s.has(mitgliedId)) {
        s.delete(mitgliedId);
      } else {
        s.add(mitgliedId);
      }
      return s;
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
      setOhneTarif(data.ohne_tarif || []);
      setInVerarbeitung(data.in_verarbeitung || []);
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
      console.log('[StripeSetup] Response:', { status: response.status, data });

      if (data.success) {
        setStripeSetupProgress({
          status: 'completed',
          message: `Setup abgeschlossen: ${data.succeeded} erfolgreich, ${data.failed} fehlgeschlagen`,
          details: data.details
        });
        await loadStripeStatus();
      } else {
        // details kann Array (Einzelfehler) oder String (Server-Fehler) sein
        const detailsArray = Array.isArray(data.details) ? data.details : [];
        const errorLines = detailsArray.length > 0
          ? detailsArray.filter(d => d.status === 'failed').map(d => `${d.name}: ${d.error || 'unbekannter Fehler'}`)
          : data.details && typeof data.details === 'string'
            ? [`Serverfehler: ${data.details}`]
            : [];
        setStripeSetupProgress({
          status: 'error',
          message: detailsArray.length > 0
            ? `Setup fehlgeschlagen (${data.succeeded || 0}/${data.processed} erfolgreich)`
            : data.error || `Setup fehlgeschlagen (HTTP ${response.status})`,
          errorLines
        });
        if ((data.succeeded || 0) > 0) await loadStripeStatus();
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

    const excludedNote = excludedMitglieder.size > 0
      ? `\n⚠️ ${excludedMitglieder.size} Mitglied(er) manuell ausgeschlossen.`
      : '';
    const confirmMessage = `Stripe SEPA Lastschriftlauf ausführen?\n\n` +
      `Monat: ${selectedMonth}/${selectedYear}\n` +
      `Anzahl Mitglieder: ${activeCount}\n` +
      `Gesamtbetrag: €${activeTotal.toFixed(2)}\n\n` +
      `Die Lastschriften werden direkt über Stripe eingezogen.\n` +
      `ACHTUNG: Dies kann nicht rückgängig gemacht werden!` +
      excludedNote;

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
          mitglieder: preview.preview
            .filter(m => !excludedMitglieder.has(m.mitglied_id))
            .map(m => ({
              mitglied_id: m.mitglied_id,
              name: m.name,
              betrag: m.betrag,
              beitraege: m.beitraege,
              offene_monate: m.offene_monate,
              ratenplan_id: m.ratenplan_id || null,
              ratenplan_aufschlag: m.ratenplan_aufschlag || 0,
              raten_ausstehend: m.raten_ausstehend || 0
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

    // Alle Beitrag-IDs aus der Vorschau sammeln — ausgeschlossene Mitglieder überspringen
    const alleBeitragIds = (preview.preview || [])
      .filter(m => !excludedMitglieder.has(m.mitglied_id))
      .flatMap(m => (m.beitraege || []).map(b => b.beitrag_id))
      .filter(Boolean);
    const includedCount = (preview.preview || []).filter(m => !excludedMitglieder.has(m.mitglied_id)).length;
    const includedTotal = (preview.preview || [])
      .filter(m => !excludedMitglieder.has(m.mitglied_id))
      .reduce((sum, m) => sum + parseFloat(m.betrag || 0), 0);
    const excludedNote = excludedMitglieder.size > 0
      ? `\n⚠️ ${excludedMitglieder.size} Mitglied(er) manuell ausgeschlossen (Beiträge bleiben offen).`
      : '';

    const confirm = window.confirm(
      `Zahllauf in der Datenbank speichern?\n\n` +
      `Buchungsnummer: ${buchungsnummer}\n` +
      `Forderungen bis: ${forderungen_bis}\n` +
      `Geplanter Einzug: ${geplanter_einzug}\n` +
      `Anzahl: ${includedCount} Mandate\n` +
      `Betrag: ${includedTotal.toFixed(2)} €\n` +
      `Bank: ${bankInfo?.bank_name || 'Unbekannt'}` +
      excludedNote + `\n\n` +
      `Die ${alleBeitragIds.length} Beiträge werden direkt als bezahlt markiert.`
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
          anzahl_buchungen: includedCount,
          betrag: includedTotal.toFixed(2),
          dojo_id: dojoId || null,
          beitrag_ids: alleBeitragIds,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler beim Erstellen');
      setZahllaufCreated(data.zahllauf_id);
      alert(`✅ Zahllauf #${data.zahllauf_id} erfolgreich gespeichert!\nBuchungsnummer: ${buchungsnummer}\n${data.marked_bezahlt} Beiträge als bezahlt markiert.`);
      loadPreview(); // Vorschau aktualisieren — sollte jetzt leer sein
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ margin: 0 }}>💶 SEPA-Lastschriftlauf</h1>
            <div className="ll-help-tooltip">
              <Info size={16} className="ll-help-icon" />
              <div className="ll-help-popup">
                <strong>💡 SEPA-Lastschriftverfahren</strong>
                <p style={{ margin: '0 0 8px', lineHeight: 1.5 }}>
                  Der Lastschriftlauf generiert eine Datei mit allen aktiven SEPA-Mandaten.
                  Diese kann direkt in Ihre Online-Banking-Software oder bei Ihrer Bank importiert werden.
                </p>
                <ul>
                  <li><strong>SEPA-Mandat:</strong> Nur Mitglieder mit aktivem Mandat und Zahlungsmethode "SEPA-Lastschrift" werden berücksichtigt.</li>
                  <li><strong>Vorlaufzeit:</strong> Mind. 5 Bankarbeitstage einplanen.</li>
                  <li><strong>Format:</strong> CSV für deutsche Banken, XML für internationale Standards.</li>
                  <li><strong>Prüfung:</strong> Vorschau vor dem Export kontrollieren.</li>
                  <li><strong>Datenschutz:</strong> Exportierte Datei enthält sensible Kontodaten — sicher aufbewahren!</li>
                </ul>
              </div>
            </div>
          </div>
          <p>Monatliche Lastschriften generieren und an Bank übermitteln</p>
        </div>
        <div className="u-flex-gap-sm ll-header-right">
          {preview && (
            <>
              <div className="ll-stat-pill ll-stat-pill--header">
                <DollarSign size={14} />
                <div>
                  <span className="ll-stat-label">Gesamtbetrag</span>
                  <span className="ll-stat-val">{formatCurrency(activeTotal)}</span>
                </div>
              </div>
              <div className="ll-stat-pill ll-stat-pill--header">
                <Calendar size={14} />
                <div>
                  <span className="ll-stat-label">Abrechnungsmonat</span>
                  <span className="ll-stat-val">{getMonthName(selectedMonth)} {selectedYear}</span>
                </div>
              </div>
            </>
          )}
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
        <button
          className={`ll-tab-btn${activeTab === 'zahllaeufe' ? ' ll-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('zahllaeufe')}
        >
          <FileText size={15} /> Zahlläufe Übersicht
        </button>
      </div>

      {/* Tab: Automatischer Einzug */}
      {activeTab === 'automatik' && (
        <LastschriftAutomatik dojoId={dojoId} />
      )}

      {/* Tab: Zahlläufe Übersicht */}
      {activeTab === 'zahllaeufe' && (
        <Zahllaeufe embedded={true} />
      )}

      {/* Tab: Manueller Lauf — bestehender Inhalt */}
      {activeTab === 'manuell' && (
      <>

      {/* Warning-Boxen: nebeneinander (zugeklappt) / untereinander (aufgeklappt) */}
        {(missingMandates.length > 0 || ohneTarif.length > 0 || inVerarbeitung.length > 0) && (
          <div style={{
            display: 'flex',
            flexDirection: (inVerarbeitungOpen || ohneTarifOpen || missingMandatesOpen) ? 'column' : 'row',
            gap: '0.6rem',
            marginBottom: '0.6rem',
            alignItems: 'flex-start'
          }}>

        {/* In Verarbeitung bei Stripe */}
        {inVerarbeitung.length > 0 && (
          <div className="in-verarbeitung-info" style={{ flex: (inVerarbeitungOpen || ohneTarifOpen || missingMandatesOpen) ? 'none' : 1, minWidth: 0, width: (inVerarbeitungOpen || ohneTarifOpen || missingMandatesOpen) ? '100%' : undefined }}>
            <Clock size={22} style={{ marginTop: inVerarbeitungOpen ? '0.15rem' : '0' }} />
            <div style={{ flex: 1 }}>
              <div className="warn-card-header" onClick={() => setInVerarbeitungOpen(o => !o)}>
                <h3>Einzug läuft — warte auf Rückmeldung ({inVerarbeitung.length})</h3>
                {inVerarbeitungOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              {inVerarbeitungOpen && (
                <>
                  <p>
                    Diese Beiträge stecken in einem laufenden Stripe-Einzug (<strong>processing</strong>).
                    Sie tauchen <strong>nicht erneut</strong> im Lauf auf. Neue Monate (z.B. Mai)
                    erscheinen weiterhin normal. Bei Ablehnung kommen sie automatisch zurück.
                  </p>
                  <div className="in-verarbeitung-list">
                    {inVerarbeitung.map(m => (
                      <div
                        key={m.mitglied_id}
                        className="in-verarbeitung-item ll-cursor-pointer"
                        onClick={() => navigate(`/dashboard/mitglieder/${m.mitglied_id}`)}
                      >
                        <span className="in-verarb-name">{m.name}</span>
                        <span className="in-verarb-meta">
                          {m.transaktionen.map(t =>
                            `${String(t.monat).padStart(2,'0')}/${t.jahr} · ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(t.betrag)}`
                          ).join(', ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Ohne-Tarif Warning */}
        {ohneTarif.length > 0 && (
          <div className="ohne-tarif-warning" style={{ flex: (inVerarbeitungOpen || ohneTarifOpen || missingMandatesOpen) ? 'none' : 1, minWidth: 0, width: (inVerarbeitungOpen || ohneTarifOpen || missingMandatesOpen) ? '100%' : undefined }}>
            <AlertCircle size={22} style={{ marginTop: ohneTarifOpen ? '0.15rem' : '0' }} />
            <div style={{ flex: 1 }}>
              <div className="warn-card-header" onClick={() => setOhneTarifOpen(o => !o)}>
                <h3>Kein SEPA-Mandat — nicht im Lauf ({ohneTarif.length})</h3>
                {ohneTarifOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              {ohneTarifOpen && (
                <>
                  <p>
                    Diese Mitglieder haben Lastschrift als Zahlungsmethode und offene Beiträge,
                    aber <strong>kein aktives SEPA-Mandat</strong>.
                    Sie werden im Lastschriftlauf <strong>nicht berücksichtigt</strong>.
                  </p>
                  <div className="ohne-tarif-list">
                    {ohneTarif.map(m => (
                      <div
                        key={m.mitglied_id}
                        className="ohne-tarif-item ll-cursor-pointer"
                        onClick={() => navigate(`/dashboard/mitglieder/${m.mitglied_id}`)}
                      >
                        <span className="ohne-tarif-name">{m.name}</span>
                        <span className="ohne-tarif-meta">
                          {m.offene_monate} · {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(m.gesamt_betrag)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Fehlende Mandate */}
        {missingMandates.length > 0 && (
          <div className="warning-box" style={{ flex: (inVerarbeitungOpen || ohneTarifOpen || missingMandatesOpen) ? 'none' : 1, minWidth: 0, width: (inVerarbeitungOpen || ohneTarifOpen || missingMandatesOpen) ? '100%' : undefined }}>
            <AlertCircle size={24} style={{ marginTop: missingMandatesOpen ? '0.2rem' : '0' }} />
            <div style={{ flex: 1 }}>
              <div className="warn-card-header" onClick={() => setMissingMandatesOpen(o => !o)}>
                <h3>⚠️ Fehlende SEPA-Mandate ({missingMandates.length})</h3>
                {missingMandatesOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              {missingMandatesOpen && (
                <>
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
                </>
              )}
            </div>
          </div>
        )}
          </div>
        )}

      {/* Zeitraum-Toolbar — schlanke Zeile ohne Karten-Wrapper */}
      <div className="ll-period-toolbar">
        <Calendar size={14} className="ll-period-icon" />
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          className="form-select-compact"
        >
          {[...Array(12)].map((_, i) => (
            <option key={i + 1} value={i + 1}>{getMonthName(i + 1)}</option>
          ))}
        </select>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          className="form-select-compact"
        >
          <option value={2024}>2024</option>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
        </select>
        <button className="ll-period-btn" onClick={loadPreview} disabled={loading}>
          <Eye size={14} />
          {loading ? 'Lädt…' : 'Vorschau laden'}
        </button>
      </div>

      {/* Lauf Konfiguration */}
      <div className="export-config-card ll-config-card-new">

        {/* Zwei Aktions-Spalten */}
        <div className="ll-config-channels">

          {/* ── Kanal 1: Bankeinzug / Datei-Export ── */}
          <div className="ll-channel ll-channel-bank">
            <div className="ll-channel-header">
              <CreditCard size={16} />
              <span>Bankeinzug &amp; Datei-Export</span>
            </div>
            <div className="ll-channel-body">
              <div className="ll-channel-fields">
                <div className="form-field-inline">
                  <label><FileText size={13} />Format</label>
                  <select
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="form-select-compact"
                  >
                    <option value="csv">CSV</option>
                    <option value="xml">SEPA XML pain.008</option>
                  </select>
                </div>
                <div className="form-field-inline ll-bank-field">
                  <label><CreditCard size={13} />Einzugsbank</label>
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
              </div>
              <div className="ll-channel-actions">
                <button
                  className="logout-button ll-nowrap ll-create-btn"
                  onClick={handleCreateZahllauf}
                  disabled={zahllaufCreating || !preview || activeCount === 0}
                >
                  {zahllaufCreating ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
                  {zahllaufCreated ? `✓ Lauf #${zahllaufCreated}` : 'Zahllauf erstellen'}
                </button>
                <button
                  className="logout-button ll-nowrap"
                  onClick={handleExport}
                  disabled={loading || !preview || activeCount === 0}
                >
                  <Download size={16} />
                  Exportieren
                </button>
              </div>
              <p className="ll-channel-hint">Zahllauf speichern und/oder Datei für Hausbank generieren</p>
            </div>
          </div>

          {/* ── Kanal 2: Stripe SEPA ── */}
          {stripeStatus?.stripe_configured && (
            <div className="ll-channel ll-channel-stripe">
              <div className="ll-channel-header">
                <Zap size={16} />
                <span>Stripe SEPA — Direkteinzug</span>
              </div>
              <div className="ll-channel-body">
                {stripeStatus.needs_setup > 0 && (
                  <div className="ll-stripe-setup-hint">
                    <AlertCircle size={13} />
                    {stripeStatus.needs_setup} Mitglieder ohne Stripe-Setup
                  </div>
                )}
                <div className="ll-stripe-row">
                  <div className="ll-channel-actions">
                    {stripeStatus.needs_setup > 0 && (
                      <button
                        className="logout-button ll-stripe-setup-btn"
                        onClick={handleStripeSetupAll}
                        disabled={stripeProcessing}
                        title={`${stripeStatus.needs_setup} Mitglieder benötigen Stripe Setup`}
                      >
                        {stripeProcessing ? <Loader size={16} className="spin" /> : <Settings size={16} />}
                        Setup ({stripeStatus.needs_setup})
                      </button>
                    )}
                    <button
                      className="logout-button ll-stripe-execute-btn"
                      onClick={handleStripeExecute}
                      disabled={stripeProcessing || !preview || activeCount === 0}
                    >
                      {stripeProcessing ? <Loader size={16} className="spin" /> : <Zap size={16} />}
                      Jetzt einziehen
                    </button>
                    <button
                      className="logout-button ll-stripe-sync-btn"
                      onClick={handleStripeSyncVormonat}
                      disabled={stripeSyncing}
                      title="Stripe-Status abfragen und Beiträge aktualisieren"
                    >
                      {stripeSyncing ? <Loader size={16} className="spin" /> : <RefreshCw size={16} />}
                      Stripe Sync
                    </button>
                  </div>
                  <p className="ll-channel-hint">Direkteinzug ohne Datei-Export</p>
                </div>
              </div>
            </div>
          )}

        </div>
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
            {stripeSetupProgress.errorLines?.length > 0 && (
              <ul style={{ margin: '0.4rem 0 0 1.5rem', fontSize: '0.78rem', opacity: 0.85 }}>
                {stripeSetupProgress.errorLines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            )}
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

      {/* Vorschau Tabelle */}
      {preview && preview.preview && preview.preview.length > 0 && (
        <div className="preview-card">
          <div className="ll-not-in-run-header" onClick={() => setPreviewOpen(o => !o)}>
            <h2 style={{margin:0}}>Vorschau ({activeCount} Einträge) - Gesamtsumme: {formatCurrency(activeTotal)}</h2>
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
                  <th></th>
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
                      <td className="ll-td-action">
                        <button
                          className="ll-btn-exclude"
                          onClick={() => toggleExclude(item.mitglied_id)}
                          title="Aus diesem Lauf ausschließen (Beitrag bleibt offen)"
                        >
                          Ausschließen
                        </button>
                      </td>
                    </tr>
                    {/* Details-Zeile - nur anzeigen wenn expandiert */}
                    {expandedRows.has(item.mitglied_id) && item.beitraege && item.beitraege.length > 0 && (
                      <tr className="details-row">
                        <td></td>
                        <td colSpan={7} className="ll-details-td">
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

          {/* Ausgeschlossene Mitglieder */}
          {excludedPreviewItems.length > 0 && (
            <div className="ll-excluded-section">
              <div className="ll-excluded-header" onClick={() => setExcludedOpen(o => !o)}>
                <span className="ll-excluded-title">
                  Manuell ausgeschlossen ({excludedPreviewItems.length})
                </span>
                {excludedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              {excludedOpen && (
                <table className="preview-table ll-excluded-table">
                  <thead>
                    <tr>
                      <th>Mitglied</th>
                      <th>IBAN</th>
                      <th>Offene Monate</th>
                      <th>Gesamtbetrag</th>
                      <th>Tarif</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {excludedPreviewItems.map((item, idx) => (
                      <tr key={idx} className="ll-excluded-row">
                        <td>
                          <strong>{item.name}</strong>
                          <br />
                          <small>ID: {item.mitglied_id}</small>
                        </td>
                        <td><code>{item.iban}</code></td>
                        <td>
                          <span className="badge badge-neutral">
                            {item.anzahl_monate} {item.anzahl_monate === 1 ? 'Monat' : 'Monate'}
                          </span>
                        </td>
                        <td>{formatCurrency(item.betrag)}</td>
                        <td>{item.tarif}</td>
                        <td className="ll-td-action">
                          <button
                            className="ll-btn-include"
                            onClick={() => toggleExclude(item.mitglied_id)}
                            title="Wieder in den Lauf aufnehmen"
                          >
                            Einschließen
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
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


      </>
      )}
    </div>
  );
};

export default Lastschriftlauf;
