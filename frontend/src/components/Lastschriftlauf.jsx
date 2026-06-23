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
  Info,
  XCircle
} from "lucide-react";
import config from "../config/config";
import { useDojoContext } from '../context/DojoContext';
import StripeStornoVerwaltung from './StripeStornoVerwaltung';
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Lastschriftlauf.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';
import openApiBlob from '../utils/openApiBlob';
import LastschriftAutomatik from './LastschriftAutomatik';
import '../styles/LastschriftAutomatik.css';
import LastschriftAutoProtokollBanner from './LastschriftAutoProtokollBanner';
import '../styles/StripeStornoVerwaltung.css';
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
  const [gruppen, setGruppen] = useState([]);
  const [gruppeFilter, setGruppeFilter] = useState('');
  useEffect(() => {
    const gid = dojoId && dojoId !== 'all' ? dojoId : null;
    const dp = gid ? `?dojo_id=${gid}` : '';
    fetchWithAuth(`${config.apiBaseUrl}/lastschrift-gruppen${dp}`)
      .then(r => r.ok ? r.json() : { gruppen: [] })
      .then(d => setGruppen(d.gruppen || []))
      .catch(() => setGruppen([]));
  }, [dojoId]);
  const [availableBanks, setAvailableBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [zusammensetzung, setZusammensetzung] = useState({}); // mitglied_id -> { posten, gesamt, verwendungszweck }
  const [zusLoading, setZusLoading] = useState({});

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

  // Nicht-im-Lauf Übersicht / Schnelldiagnose
  const [notInRun, setNotInRun] = useState(null);
  const [notInRunOpen, setNotInRunOpen] = useState(false);
  const [notInRunLoading, setNotInRunLoading] = useState(false);
  const [setupLoadingPer, setSetupLoadingPer] = useState({});
  const [setupResultPer, setSetupResultPer] = useState({});
  const [debugSearch, setDebugSearch] = useState('');
  const [debugResult, setDebugResult] = useState(null);
  const [debugLoading, setDebugLoading] = useState(false);

  // Mitglieder ohne Tarif (Warnliste aus Preview)
  const [ohneTarif, setOhneTarif] = useState([]);
  // Mitglieder mit laufendem Stripe-Einzug (processing)
  const [inVerarbeitung, setInVerarbeitung] = useState([]);
  // Cards auf-/zugeklappt
  const [inVerarbeitungOpen, setInVerarbeitungOpen] = useState(false);
  const [ohneTarifOpen, setOhneTarifOpen] = useState(false);
  const [missingMandatesOpen, setMissingMandatesOpen] = useState(false);

  // Inline Storno für "In Verarbeitung"-Einträge
  const [stornoModal, setStornoModal] = useState(null); // { mitglied, transaktion }
  const [stornoGrund, setStornoGrund] = useState('');
  const [stornoLoading, setStornoLoading] = useState(false);
  const [stornoResult, setStornoResult] = useState(null); // { success, message } | { error }

  // Gutschrift-Modal
  const [gutschriftModal, setGutschriftModal] = useState(null); // { mitglied, transaktion }
  const [gutschriftBetrag, setGutschriftBetrag] = useState('');
  const [gutschriftGrund, setGutschriftGrund] = useState('');
  const [gutschriftLoading, setGutschriftLoading] = useState(false);
  const [gutschriftResult, setGutschriftResult] = useState(null);

  // Aus aktuellem Lauf ausgeschlossene Mitglieder (nur frontend-seitig, beiträge bleiben offen)
  const [excludedMitglieder, setExcludedMitglieder] = useState(new Set());
  const [excludedOpen, setExcludedOpen] = useState(false);

  // Preview-Storno (dauerhaft stornieren)
  const [previewStorno, setPreviewStorno] = useState(null); // item | null
  const [previewStornoLoading, setPreviewStornoLoading] = useState(false);

  // Unique key pro Preview-Item (SP-Items haben eigenen Key)
  const itemKey = (item) => item?.is_starterpaket ? `sp_${item.sp_id}` : `m_${item?.mitglied_id}`;

  const handleStornoInline = async () => {
    if (!stornoModal) return;
    setStornoLoading(true);
    setStornoResult(null);
    try {
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/lastschriftlauf/stripe/storno/${stornoModal.transaktion.id}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grund: stornoGrund }) }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler beim Stornieren');
      setStornoResult({ success: true, message: data.message, beitraege: data.beitraege_zurueckgesetzt });
      setInVerarbeitung(prev => {
        const updated = prev.map(m => {
          if (m.mitglied_id !== stornoModal.mitglied.mitglied_id) return m;
          const remaining = m.transaktionen.filter(t => t.id !== stornoModal.transaktion.id);
          return remaining.length > 0 ? { ...m, transaktionen: remaining } : null;
        }).filter(Boolean);
        return updated;
      });
    } catch (err) {
      setStornoResult({ success: false, error: typeof err.message === 'string' ? err.message : 'Fehler beim Stornieren' });
    }
    setStornoLoading(false);
  };

  const closeStornoModal = () => {
    setStornoModal(null);
    setStornoGrund('');
    setStornoResult(null);
  };

  const handleGutschriftSpeichern = async () => {
    if (!gutschriftModal) return;
    const betragNum = parseFloat(gutschriftBetrag.replace(',', '.'));
    if (!betragNum || betragNum <= 0) return;
    setGutschriftLoading(true);
    setGutschriftResult(null);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/gutschrift`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mitglied_id: gutschriftModal.mitglied.mitglied_id,
          betrag: betragNum,
          grund: gutschriftGrund || null,
          stripe_transaktion_id: gutschriftModal.transaktion?.id || null
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler beim Anlegen');
      setGutschriftResult({ success: true, message: data.message });
    } catch (err) {
      setGutschriftResult({ success: false, error: typeof err.message === 'string' ? err.message : 'Fehler' });
    }
    setGutschriftLoading(false);
  };

  const closeGutschriftModal = () => {
    setGutschriftModal(null);
    setGutschriftBetrag('');
    setGutschriftGrund('');
    setGutschriftResult(null);
  };

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

  const handleStripeSetupSingle = async (mitglied_id) => {
    setSetupLoadingPer(prev => ({ ...prev, [mitglied_id]: 'loading' }));
    setSetupResultPer(prev => ({ ...prev, [mitglied_id]: null }));
    try {
      const dojoParam = numericDojoId ? `?dojo_id=${numericDojoId}` : '';
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/lastschriftlauf/stripe/setup-customer${dojoParam}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mitglied_id })
        }
      );
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Fehler beim Setup');
      setSetupLoadingPer(prev => ({ ...prev, [mitglied_id]: 'ok' }));
      setSetupResultPer(prev => ({ ...prev, [mitglied_id]: { success: true } }));
      // Diagnose neu laden damit der Eintrag verschwindet
      await loadNotInRun();
    } catch (err) {
      setSetupLoadingPer(prev => ({ ...prev, [mitglied_id]: 'error' }));
      setSetupResultPer(prev => ({ ...prev, [mitglied_id]: { error: err.message } }));
    }
  };

  const handleDebugSearch = async () => {
    if (!debugSearch.trim()) return;
    setDebugLoading(true);
    setDebugResult(null);
    try {
      const dojoParam = numericDojoId ? `&dojo_id=${numericDojoId}` : '';
      const nameParam = isNaN(parseInt(debugSearch))
        ? `name=${encodeURIComponent(debugSearch)}`
        : `mitglied_id=${parseInt(debugSearch)}`;
      const response = await fetchWithAuth(
        `${config.apiBaseUrl}/lastschriftlauf/debug-member?${nameParam}&monat=${selectedMonth}&jahr=${selectedYear}${dojoParam}`
      );
      const data = await response.json();
      setDebugResult(data);
    } catch (e) {
      setDebugResult({ error: e.message });
    } finally {
      setDebugLoading(false);
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
    let items = preview.preview.filter(i => !excludedMitglieder.has(itemKey(i)));
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
    return preview.preview.filter(i => excludedMitglieder.has(itemKey(i)));
  }, [preview, excludedMitglieder]);

  // Aktive Anzahl und Summe (ohne manuell ausgeschlossene)
  const activeCount = preview?.preview
    ? preview.preview.filter(i => !excludedMitglieder.has(itemKey(i))).length
    : 0;
  const activeTotal = preview?.preview
    ? preview.preview
        .filter(i => !excludedMitglieder.has(itemKey(i)))
        .reduce((sum, i) => sum + parseFloat(i.betrag || 0), 0)
    : 0;

  // Aufschlüsselung einer anstehenden Abbuchung nachladen (read-only)
  const ladeZusammensetzung = async (mid) => {
    if (!mid || zusammensetzung[mid] || zusLoading[mid]) return;
    setZusLoading(prev => ({ ...prev, [mid]: true }));
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/zusammensetzung?mitglied_id=${mid}${dojoId ? `&dojo_id=${dojoId}` : ''}`);
      const d = await res.json();
      if (d.success) setZusammensetzung(prev => ({ ...prev, [mid]: d }));
    } catch { /* still */ }
    finally { setZusLoading(prev => ({ ...prev, [mid]: false })); }
  };

  // Toggle für Beiträge-Details Dropdown (+ Aufschlüsselung laden)
  const toggleRowExpanded = (item) => {
    const key = itemKey(item);
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
        if (item.mitglied_id && !item.is_starterpaket) ladeZusammensetzung(item.mitglied_id);
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
      const gruppeParam = gruppeFilter ? `&gruppe=${encodeURIComponent(gruppeFilter)}` : '';
      // Monat und Jahr als Query-Parameter übergeben
      const response = await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/preview?monat=${selectedMonth}&jahr=${selectedYear}${dojoParam}${gruppeParam}`);

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
      // Diagnose automatisch mitladen
      loadNotInRun();
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
          ? detailsArray.filter(d => d.status === 'failed').map(d => {
              const ibanPart = d.iban ? ` — IBAN: ${d.iban.substring(0, 4)}****${d.iban.slice(-4)}` : '';
              return `${d.name}${ibanPart}: ${d.error || 'unbekannter Fehler'}`;
            })
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

  const [regenLoading, setRegenLoading] = useState(false);
  const handleRegenerateAll = async () => {
    if (!window.confirm(
      'Alle Beiträge gemäß Vertragslaufzeit nachgenerieren?\n\n' +
      'Fehlende Monatsbeiträge werden für alle aktiven Verträge angelegt. ' +
      'Bereits vorhandene Einträge werden nicht verändert.'
    )) return;
    setRegenLoading(true);
    try {
      const dojoParam = numericDojoId ? `?dojo_id=${numericDojoId}` : '';
      const response = await fetchWithAuth(`${config.apiBaseUrl}/beitraege/regenerate-all${dojoParam}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      alert(`Beiträge nachgeneriert: ${data.beitraege_eingefuegt ?? 0} neue Einträge, ${data.beitraege_uebersprungen ?? 0} bereits vorhanden.`);
      await loadPreview();
    } catch (err) {
      alert('Fehler: ' + err.message);
    } finally {
      setRegenLoading(false);
    }
  };

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
            .filter(m => !excludedMitglieder.has(itemKey(m)))
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
    loadNotInRun();
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
      .filter(m => !excludedMitglieder.has(itemKey(m)))
      .flatMap(m => (m.beitraege || []).map(b => b.beitrag_id))
      .filter(Boolean);
    const includedCount = (preview.preview || []).filter(m => !excludedMitglieder.has(itemKey(m))).length;
    const includedTotal = (preview.preview || [])
      .filter(m => !excludedMitglieder.has(itemKey(m)))
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
      <LastschriftAutoProtokollBanner dojoId={dojoId} />
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
          {gruppen.length > 0 && (
            <select
              className="ll-select"
              value={gruppeFilter}
              onChange={(e) => setGruppeFilter(e.target.value)}
              title="Nach Lastschrift-Gruppe filtern"
              style={{ marginRight: 8 }}
            >
              <option value="">Alle Gruppen</option>
              {gruppen.map((g) => (
                <option key={g.gruppe_key} value={g.gruppe_key}>
                  {g.name} (Tag {g.einzugstag})
                </option>
              ))}
            </select>
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
        <button
          className={`ll-tab-btn${activeTab === 'storno' ? ' ll-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('storno')}
        >
          <XCircle size={15} /> Storno-Verwaltung
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

      {/* Tab: Storno-Verwaltung */}
      {activeTab === 'storno' && (
        <StripeStornoVerwaltung />
      )}

      {/* Tab: Manueller Lauf — bestehender Inhalt */}
      {activeTab === 'manuell' && (
      <>

      {/* Schnelldiagnose: Wer fehlt im Einzug? */}
      <div className="preview-card ll-diagnose-card">
          <div className="ll-not-in-run-header" onClick={() => setNotInRunOpen(o => !o)}>
            <div className="ll-diagnose-header-left">
              <AlertCircle size={18} className="ll-diagnose-icon" />
              <h3>
                Schnelldiagnose — Wer fehlt im Einzug?
                {notInRun?.count > 0 && (
                  <span className="ll-diagnose-count-badge">{notInRun.count}</span>
                )}
              </h3>
            </div>
            {notInRunOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </div>

          {notInRunOpen && (
            <div className="ll-diagnose-body">
              {notInRunLoading && (
                <div className="ll-diagnose-loading">
                  <Loader size={16} className="ll-spin" /> Analysiere…
                </div>
              )}
              {!notInRunLoading && notInRun?.success && notInRun.members?.length === 0 && (
                <div className="ll-diagnose-all-ok">
                  <CheckCircle size={18} /> Alle SEPA-Mitglieder mit aktivem Vertrag sind im Lauf.
                </div>
              )}
              {!notInRunLoading && notInRun?.success && notInRun.members?.length > 0 && (
                <div className="ll-diagnose-cards">
                  {notInRun.members.map(m => {
                    const setupState = setupLoadingPer[m.mitglied_id];
                    const setupRes = setupResultPer[m.mitglied_id];
                    const profileUrl = `/mitglieder/${m.mitglied_id}`;

                    let iconEl, cardClass, fixEl;

                    if (m.grundTyp === 'processing_blockiert') {
                      iconEl = <Clock size={16} />;
                      cardClass = 'll-dcard--info';
                      fixEl = (
                        <div className="ll-dcard-fix">
                          <span className="ll-dfix-label">{m.grund}</span>
                          <button
                            className="ll-dfix-btn ll-dfix-btn--ghost"
                            onClick={() => setStornoModal({ mitglied: m, transaktion: { id: m.slt_id, betrag: m.tx_betrag, monat: null, jahr: null } })}
                          >
                            Stornieren
                          </button>
                        </div>
                      );
                    } else if (m.grundTyp === 'falsche_zahlungsmethode') {
                      iconEl = <Settings size={16} />;
                      cardClass = 'll-dcard--warning';
                      fixEl = (
                        <div className="ll-dcard-fix">
                          <span className="ll-dfix-label">{m.grund}</span>
                          <a className="ll-dfix-btn" href={profileUrl}>Zahlungsmethode korrigieren</a>
                        </div>
                      );
                    } else if (m.grundTyp === 'kein_mandat') {
                      iconEl = <XCircle size={16} />;
                      cardClass = 'll-dcard--danger';
                      if (m.needs_stripe_setup) {
                        fixEl = (
                          <div className="ll-dcard-fix">
                            <span className="ll-dfix-label">IBAN hinterlegt, Stripe-Setup fehlt</span>
                            <button
                              className={`ll-dfix-btn ll-dfix-btn--primary ${setupState === 'loading' ? 'll-dfix-btn--loading' : ''}`}
                              disabled={setupState === 'loading' || setupState === 'ok'}
                              onClick={() => handleStripeSetupSingle(m.mitglied_id)}
                            >
                              {setupState === 'loading' && <Loader size={13} className="ll-spin" />}
                              {setupState === 'ok' && <CheckCircle size={13} />}
                              {!setupState && 'Stripe Setup starten'}
                              {setupState === 'loading' && 'Richtet ein…'}
                              {setupState === 'ok' && 'Eingerichtet'}
                              {setupState === 'error' && 'Erneut versuchen'}
                            </button>
                            {setupRes?.error && <span className="ll-dfix-error">{setupRes.error}</span>}
                          </div>
                        );
                      } else if (!m.has_mandat_iban) {
                        fixEl = (
                          <div className="ll-dcard-fix">
                            <span className="ll-dfix-label">Kein SEPA-Mandat hinterlegt</span>
                            <a className="ll-dfix-btn" href={profileUrl}>Im Profil anlegen</a>
                          </div>
                        );
                      } else {
                        fixEl = (
                          <div className="ll-dcard-fix">
                            <span className="ll-dfix-label">Mandat unvollständig</span>
                            <a className="ll-dfix-btn" href={profileUrl}>Profil prüfen</a>
                          </div>
                        );
                      }
                    } else if (m.grundTyp === 'kein_vertrag') {
                      iconEl = <AlertCircle size={16} />;
                      cardClass = 'll-dcard--warning';
                      fixEl = (
                        <div className="ll-dcard-fix">
                          <span className="ll-dfix-label">Kein aktiver Vertrag vorhanden</span>
                          <a className="ll-dfix-btn" href={profileUrl}>Vertrag anlegen</a>
                        </div>
                      );
                    } else if (m.grundTyp === 'ruhepause') {
                      iconEl = <Clock size={16} />;
                      cardClass = 'll-dcard--info';
                      const bisDatum = m.ruhepause_bis
                        ? new Date(m.ruhepause_bis).toLocaleDateString('de-DE')
                        : '—';
                      fixEl = (
                        <div className="ll-dcard-fix">
                          <span className="ll-dfix-label">Ruhepause bis {bisDatum} — endet automatisch</span>
                          <a className="ll-dfix-btn ll-dfix-btn--ghost" href={profileUrl}>Vorzeitig beenden</a>
                        </div>
                      );
                    } else if (m.grundTyp === 'gekuendigt') {
                      iconEl = <XCircle size={16} />;
                      const endDatum = m.vertragsende
                        ? new Date(m.vertragsende).toLocaleDateString('de-DE')
                        : null;
                      const isExpired = m.vertragsende && new Date(m.vertragsende) < new Date();
                      cardClass = isExpired ? 'll-dcard--danger' : 'll-dcard--neutral';
                      fixEl = (
                        <div className="ll-dcard-fix">
                          <span className="ll-dfix-label">
                            {endDatum ? `Vertragsende: ${endDatum}` : 'Vertrag gekündigt'}
                          </span>
                          {isExpired && m.offene_beitraege > 0 && (
                            <a className="ll-dfix-btn" href={profileUrl}>Offene Beiträge prüfen</a>
                          )}
                        </div>
                      );
                    } else {
                      iconEl = <Info size={16} />;
                      cardClass = 'll-dcard--neutral';
                      fixEl = (
                        <div className="ll-dcard-fix">
                          <span className="ll-dfix-label">Grund unklar</span>
                          <a className="ll-dfix-btn ll-dfix-btn--ghost" href={profileUrl}>Profil prüfen</a>
                        </div>
                      );
                    }

                    return (
                      <div key={m.mitglied_id} className={`ll-dcard ${cardClass}`}>
                        <div className="ll-dcard-top">
                          <div className="ll-dcard-who">
                            <span className="ll-dcard-icon">{iconEl}</span>
                            <div>
                              <strong className="ll-dcard-name">{m.name}</strong>
                              <span className="ll-dcard-id">#{m.mitglied_id}</span>
                            </div>
                          </div>
                          <div className="ll-dcard-meta">
                            {m.offener_betrag > 0 && (
                              <span className="ll-dcard-debt">
                                {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(m.offener_betrag)} offen
                              </span>
                            )}
                            {m.offene_beitraege > 0 && (
                              <span className="ll-dcard-months">{m.offene_beitraege} Monat{m.offene_beitraege !== 1 ? 'e' : ''}</span>
                            )}
                          </div>
                        </div>
                        {fixEl}
                      </div>
                    );
                  })}
                </div>
              )}
              {!notInRunLoading && notInRun && !notInRun.success && (
                <p className="u-text-error">Fehler: {notInRun.error}</p>
              )}

              {/* Mitglied direkt nachschlagen */}
              <div className="ll-debug-lookup">
                <span className="ll-debug-label">Mitglied direkt prüfen:</span>
                <input
                  className="ll-debug-input"
                  placeholder="Name oder ID…"
                  value={debugSearch}
                  onChange={e => setDebugSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleDebugSearch()}
                />
                <button className="ll-dfix-btn" onClick={handleDebugSearch} disabled={debugLoading}>
                  {debugLoading ? <Loader size={13} className="ll-spin" /> : 'Prüfen'}
                </button>
              </div>

              {debugResult && !debugResult.error && !debugResult.found && (
                <div className="ll-debug-result ll-debug-result--warn">Kein Mitglied gefunden für "{debugSearch}"</div>
              )}
              {debugResult?.error && (
                <div className="ll-debug-result ll-debug-result--error">Fehler: {debugResult.error}</div>
              )}
              {debugResult?.found && debugResult.members?.map(m => (
                <div key={m.mitglied_id} className="ll-debug-result">
                  <div className="ll-debug-name">
                    <strong>{m.vorname} {m.nachname}</strong>
                    <span className="ll-dcard-id">#{m.mitglied_id}</span>
                    <span className={`ll-debug-pill ${m.aktiv ? 'll-debug-pill--ok' : 'll-debug-pill--bad'}`}>{m.aktiv ? 'aktiv' : 'INAKTIV'}</span>
                  </div>
                  <div className="ll-debug-rows">
                    <div className="ll-debug-row"><span>Zahlungsmethode</span><strong>{m.zahlungsmethode || '—'}</strong></div>
                    <div className="ll-debug-row"><span>Vertragsfrei</span><strong>{m.vertragsfrei ? 'JA' : 'nein'}</strong></div>
                    <div className="ll-debug-row"><span>Offene Beiträge</span><strong>{m.offene_beitraege} ({new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'}).format(m.offener_betrag)})</strong></div>
                    <div className="ll-debug-row"><span>SEPA-Mandate</span><strong>{m.mandate?.length || 0} gesamt, {m.mandate?.filter(mn=>mn.status==='aktiv'&&mn.mandatsreferenz).length || 0} aktiv+gültig</strong></div>
                    <div className="ll-debug-row"><span>Stripe-Tx (letzte 6)</span><strong>{m.stripe_transaktionen?.map(t=>`${t.status} ${t.monat}/${t.jahr}`).join(', ') || '—'}</strong></div>
                  </div>
                  {m.diagnose?.length > 0 && (
                    <div className="ll-debug-diagnose">
                      {m.diagnose.map((d,i) => (
                        <div key={i} className={`ll-debug-issue ${d.startsWith('Keine Probleme') ? 'll-debug-issue--ok' : 'll-debug-issue--bad'}`}>
                          {d.startsWith('Keine Probleme') ? <CheckCircle size={13}/> : <AlertCircle size={13}/>} {d}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Warning-Boxen: nebeneinander (zugeklappt) / untereinander (aufgeklappt) */}
        {(missingMandates.length > 0 || ohneTarif.length > 0 || inVerarbeitung.length > 0) && (
          <div className={`ll-warn-row${(inVerarbeitungOpen || ohneTarifOpen || missingMandatesOpen) ? ' ll-warn-row--expanded' : ''}`}>

        {/* In Verarbeitung bei Stripe */}
        {inVerarbeitung.length > 0 && (
          <div className={`in-verarbeitung-info${inVerarbeitungOpen ? ' ll-warnbox--open' : ' ll-warnbox--collapsed'}`}>
            <Clock size={18} style={{ marginTop: '0.1rem' }} />
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
                      <div key={m.mitglied_id} className="in-verarbeitung-item-group">
                        <div
                          className="in-verarb-member-row ll-cursor-pointer"
                          onClick={() => navigate(`/dashboard/mitglieder/${m.mitglied_id}`)}
                        >
                          <span className="in-verarb-name">{m.name}</span>
                        </div>
                        {m.transaktionen.map(t => (
                          <div key={t.id} className="in-verarb-trans-row">
                            <span className="in-verarb-meta">
                              {String(t.monat).padStart(2,'0')}/{t.jahr} &nbsp;·&nbsp;
                              <strong>{new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(t.betrag)}</strong>
                              {t.stripe_payment_intent_id && (
                                <code className="in-verarb-pi">{t.stripe_payment_intent_id.substring(0, 22)}…</code>
                              )}
                            </span>
                            <div className="in-verarb-action-btns">
                              <button
                                className="btn btn-danger btn-sm in-verarb-storno-btn"
                                onClick={e => { e.stopPropagation(); setStornoModal({ mitglied: m, transaktion: t }); setStornoGrund(''); setStornoResult(null); }}
                              >
                                <XCircle size={13} />
                                Stornieren
                              </button>
                              <button
                                className="btn btn-sm in-verarb-gutschrift-btn"
                                onClick={e => { e.stopPropagation(); setGutschriftModal({ mitglied: m, transaktion: t }); setGutschriftBetrag(String(t.betrag)); setGutschriftGrund(`Doppelabbuchung ${String(t.monat).padStart(2,'0')}/${t.jahr}`); setGutschriftResult(null); }}
                              >
                                💳 Gutschrift
                              </button>
                            </div>
                          </div>
                        ))}
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
          <div className={`ohne-tarif-warning${ohneTarifOpen ? ' ll-warnbox--open' : ' ll-warnbox--collapsed'}`}>
            <AlertCircle size={18} style={{ marginTop: '0.1rem' }} />
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
          <div className={`warning-box${missingMandatesOpen ? ' ll-warnbox--open' : ' ll-warnbox--collapsed'}`}>
            <AlertCircle size={18} style={{ marginTop: '0.1rem' }} />
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
        <button className="ll-period-btn" onClick={handleRegenerateAll} disabled={regenLoading} title="Fehlende Monatsbeiträge für alle aktiven Verträge nachgenerieren">
          {regenLoading ? <Loader size={14} className="spin" /> : <RefreshCw size={14} />}
          {regenLoading ? 'Generiert…' : 'Beiträge generieren'}
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
                          onClick={() => toggleRowExpanded(item)}>
                        {expandedRows.has(itemKey(item)) ? (
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
                        {item.is_starterpaket ? (
                          <span className="badge badge-info ll-badge-mr">Einmalig</span>
                        ) : (
                          <>
                            <span className="badge badge-warning ll-badge-mr">
                              {item.anzahl_monate} {item.anzahl_monate === 1 ? 'Monat' : 'Monate'}
                            </span>
                            <br />
                            <small className="u-text-secondary">{item.offene_monate}</small>
                          </>
                        )}
                      </td>
                      <td>
                        <strong className={`ll-betrag-value${!item.is_starterpaket && item.anzahl_monate > 1 ? ' ll-betrag-value--warn' : ''}`}>
                          {formatCurrency(item.betrag)}
                        </strong>
                        {item.gutschrift_betrag > 0 && (
                          <div className="ll-gutschrift-hint">
                            <span className="ll-gutschrift-original">{formatCurrency(item.brutto_betrag)}</span>
                            <span className="ll-gutschrift-label">− {formatCurrency(item.gutschrift_betrag)} Gutschrift</span>
                          </div>
                        )}
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
                          onClick={() => toggleExclude(itemKey(item))}
                          title="Aus diesem Lauf ausschließen (Beitrag bleibt offen)"
                        >
                          Ausschließen
                        </button>
                        <button
                          className="ll-btn-stornieren"
                          onClick={() => setPreviewStorno(item)}
                          title="Dauerhaft stornieren"
                        >
                          Stornieren
                        </button>
                      </td>
                    </tr>
                    {/* Details-Zeile - Aufschlüsselung der Abbuchung */}
                    {expandedRows.has(itemKey(item)) && (
                      <tr className="details-row">
                        <td colSpan={100} className="ll-details-td">
                          <div className="ll-details-inner">
                            {(() => {
                              const fmtD = (d) => { if (!d) return '—'; const dt = new Date(d); return isNaN(dt) ? String(d) : dt.toLocaleDateString('de-DE'); };
                              const z = item.mitglied_id ? zusammensetzung[item.mitglied_id] : null;
                              const loading = item.mitglied_id ? zusLoading[item.mitglied_id] : false;
                              const posten = (z && z.posten && z.posten.length)
                                ? z.posten
                                : (item.beitraege || []).map(b => ({ label: b.beschreibung || b.monat || 'Beitrag', datum: b.datum, betrag: parseFloat(b.betrag || 0), info: null }));
                              if (loading && !posten.length) return <div className="ll-details-heading"><span>Lädt Aufschlüsselung…</span></div>;
                              if (!posten.length) return <div className="ll-details-heading"><span>Keine Einzelposten vorhanden.</span></div>;
                              return (
                                <>
                                  <div className="ll-details-heading">
                                    <span>Zusammensetzung der Abbuchung</span>
                                    <span className="ll-details-count">{posten.length} Position{posten.length !== 1 ? 'en' : ''}</span>
                                  </div>
                                  <div className="ll-details-list">
                                    <div className="ll-details-list-header">
                                      <span className="ll-details-col-desc">Posten</span>
                                      <span className="ll-details-col-datum">Fällig</span>
                                      <span className="ll-details-col-betrag">Betrag</span>
                                    </div>
                                    {posten.map((p, pIdx) => (
                                      <div key={pIdx} className="ll-details-list-row">
                                        <span className="ll-details-col-desc">{p.label}{p.info ? ` · ${p.info}` : ''}</span>
                                        <span className="ll-details-col-datum">{fmtD(p.datum)}</span>
                                        <span className="ll-details-col-betrag ll-details-col-betrag--val">{formatCurrency(p.betrag)}</span>
                                      </div>
                                    ))}
                                    {z && (
                                      <div className="ll-details-list-row" style={{ fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.18)', marginTop: 2 }}>
                                        <span className="ll-details-col-desc">Gesamt</span>
                                        <span className="ll-details-col-datum"></span>
                                        <span className="ll-details-col-betrag ll-details-col-betrag--val">{formatCurrency(z.gesamt)}</span>
                                      </div>
                                    )}
                                  </div>
                                  {z && z.verwendungszweck && (
                                    <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: 'var(--text-secondary, #cbd5e1)' }}>
                                      📄 <strong>Verwendungszweck (so sieht es das Mitglied):</strong> {z.verwendungszweck}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
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
                            onClick={() => toggleExclude(itemKey(item))}
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



      </>
      )}

      {/* Gutschrift-Modal */}
      {gutschriftModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeGutschriftModal()}>
          <div className="modal-container storno-modal">
            <div className="modal-header">
              <h3>💳 Gutschrift anlegen</h3>
              <button className="modal-close" onClick={closeGutschriftModal}>✕</button>
            </div>
            <div className="modal-body">
              {!gutschriftResult ? (
                <>
                  <div className="storno-modal-info">
                    <div className="storno-modal-row">
                      <span>Mitglied:</span>
                      <strong>{gutschriftModal.mitglied.name}</strong>
                    </div>
                    {gutschriftModal.transaktion && (
                      <div className="storno-modal-row">
                        <span>Bezug:</span>
                        <span>
                          {String(gutschriftModal.transaktion.monat).padStart(2,'0')}/{gutschriftModal.transaktion.jahr}
                          &nbsp;· {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(gutschriftModal.transaktion.betrag)} abgebucht
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="ll-gutschrift-info-box">
                    <Info size={15} />
                    <span>Die Gutschrift wird im <strong>nächsten Lastschriftlauf automatisch</strong> mit den offenen Beiträgen verrechnet — der Einzugsbetrag wird entsprechend reduziert.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gutschrift-Betrag (€)</label>
                    <input
                      type="number"
                      className="form-control"
                      step="0.01"
                      min="0.01"
                      value={gutschriftBetrag}
                      onChange={e => setGutschriftBetrag(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Grund</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="z.B. Doppelabbuchung April 2026"
                      value={gutschriftGrund}
                      onChange={e => setGutschriftGrund(e.target.value)}
                    />
                  </div>
                </>
              ) : gutschriftResult.success ? (
                <div className="storno-success">
                  <div className="storno-success-icon">✅</div>
                  <p>{gutschriftResult.message}</p>
                  <p className="storno-success-detail">Wird beim nächsten Lauf automatisch verrechnet.</p>
                </div>
              ) : (
                <div className="storno-error">
                  <div className="storno-error-icon">❌</div>
                  <p>{gutschriftResult.error}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {!gutschriftResult ? (
                <>
                  <button className="btn btn-secondary" onClick={closeGutschriftModal}>Abbrechen</button>
                  <button
                    className="btn btn-primary"
                    onClick={handleGutschriftSpeichern}
                    disabled={gutschriftLoading || !parseFloat(gutschriftBetrag) > 0}
                  >
                    {gutschriftLoading ? 'Speichere…' : '💳 Gutschrift speichern'}
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={closeGutschriftModal}>Schließen</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inline Storno-Modal */}
      {stornoModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeStornoModal()}>
          <div className="modal-container storno-modal">
            <div className="modal-header">
              <h3>Transaktion stornieren</h3>
              <button className="modal-close" onClick={closeStornoModal}>✕</button>
            </div>
            <div className="modal-body">
              {!stornoResult ? (
                <>
                  <div className="storno-modal-info">
                    <div className="storno-modal-row">
                      <span>Mitglied:</span>
                      <strong>{stornoModal.mitglied.name}</strong>
                    </div>
                    <div className="storno-modal-row">
                      <span>Betrag:</span>
                      <strong className="storno-modal-amount">
                        {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(stornoModal.transaktion.betrag)}
                      </strong>
                    </div>
                    <div className="storno-modal-row">
                      <span>Zeitraum:</span>
                      <span>{String(stornoModal.transaktion.monat).padStart(2,'0')}/{stornoModal.transaktion.jahr}</span>
                    </div>
                    {stornoModal.transaktion.stripe_payment_intent_id && (
                      <div className="storno-modal-row">
                        <span>Payment Intent:</span>
                        <code style={{ fontSize: '0.8rem' }}>{stornoModal.transaktion.stripe_payment_intent_id}</code>
                      </div>
                    )}
                  </div>
                  <div className="storno-modal-warning">
                    <AlertCircle size={16} />
                    <span>Diese Aktion storniert die Abbuchung bei Stripe und setzt die Beiträge wieder auf <em>unbezahlt</em>. SEPA-Abbuchungen können nur storniert werden, solange sie noch nicht eingezogen wurden (typisch 5–7 Werktage nach Erstellung).</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Storno-Grund (optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="z.B. Doppelabbuchung, Fehler im Batch…"
                      value={stornoGrund}
                      onChange={e => setStornoGrund(e.target.value)}
                    />
                  </div>
                </>
              ) : stornoResult.success ? (
                <div className="storno-success">
                  <div className="storno-success-icon">✅</div>
                  <p>{stornoResult.message}</p>
                  {stornoResult.beitraege > 0 && (
                    <p className="storno-success-detail">{stornoResult.beitraege} Beitrag/Beiträge wieder auf "offen" gesetzt.</p>
                  )}
                </div>
              ) : (
                <div className="storno-error">
                  <div className="storno-error-icon">❌</div>
                  <p>{stornoResult.error}</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              {!stornoResult ? (
                <>
                  <button className="btn btn-secondary" onClick={closeStornoModal}>Abbrechen</button>
                  <button className="btn btn-danger" onClick={handleStornoInline} disabled={stornoLoading}>
                    {stornoLoading ? 'Storniere…' : '🚫 Jetzt stornieren'}
                  </button>
                </>
              ) : (
                <button className="btn btn-primary" onClick={closeStornoModal}>Schließen</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Preview-Storno Modal ── */}
      {previewStorno && (
        <div className="modal-overlay" onClick={() => setPreviewStorno(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Dauerhaft stornieren</h3>

            {previewStorno.is_starterpaket ? (
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                Die Starterpaket-Bestellung <strong style={{ color: 'var(--text-primary)' }}>
                  {previewStorno.tarif}
                </strong> von <strong style={{ color: 'var(--text-primary)' }}>{previewStorno.name}</strong> ({formatCurrency(previewStorno.betrag)}) wird storniert und erscheint nicht mehr im Lastschriftlauf.
              </p>
            ) : (
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{previewStorno.anzahl_monate} offene{previewStorno.anzahl_monate !== 1 ? ' Beiträge' : ' Beitrag'}</strong> von <strong style={{ color: 'var(--text-primary)' }}>{previewStorno.name}</strong> ({formatCurrency(previewStorno.betrag)}) werden gelöscht und nicht mehr eingezogen.
              </p>
            )}

            {previewStornoLoading && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Wird storniert…</p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setPreviewStorno(null)} disabled={previewStornoLoading}>
                Abbrechen
              </button>
              <button
                className="btn btn-danger"
                disabled={previewStornoLoading}
                onClick={async () => {
                  setPreviewStornoLoading(true);
                  try {
                    const dojoParam = numericDojoId ? `?dojo_id=${numericDojoId}` : '';
                    if (previewStorno.is_starterpaket) {
                      await fetchWithAuth(`${config.apiBaseUrl}/starterpakete/bestellungen/${previewStorno.sp_id}/status${dojoParam}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'storniert' })
                      });
                    } else {
                      const beitragIds = (previewStorno.beitraege || []).map(b => b.beitrag_id).filter(Boolean);
                      await fetchWithAuth(`${config.apiBaseUrl}/lastschriftlauf/preview-stornieren${dojoParam}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ beitrag_ids: beitragIds })
                      });
                    }
                    setPreviewStorno(null);
                    await loadPreview();
                  } catch (err) {
                    alert('Fehler beim Stornieren: ' + (err.message || 'Unbekannt'));
                  } finally {
                    setPreviewStornoLoading(false);
                  }
                }}
              >
                Stornieren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Lastschriftlauf;
