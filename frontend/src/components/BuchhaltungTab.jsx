// =============================================
// BUCHHALTUNG TAB - EÜR (Einnahmen-Überschuss-Rechnung)
// Super Admin Dashboard
// =============================================

import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import openApiBlob from '../utils/openApiBlob';
import {
  Calculator, FileText, Receipt, Download, Upload, Plus, Edit, Trash2, Lock, X,
  TrendingUp, TrendingDown, PieChart, Calendar, Filter, Search, ChevronDown, ChevronUp, ChevronRight,
  AlertCircle, CheckCircle, RefreshCw, Building2, Euro, FileSpreadsheet,
  Landmark, Check, XCircle, Lightbulb, FileUp, History, BarChart3, Star, ArrowUpRight
} from 'lucide-react';
import '../styles/BuchhaltungTab.css';
import VerbandRechnungErstellen from './VerbandRechnungErstellen';
import { useSubscription } from '../context/SubscriptionContext';
import { useDojoContext } from '../context/DojoContext';
import { UStVATab } from './SteuerAssistent';

const BuchhaltungTab = ({ token, dojoMode = false }) => {
  const { hasFeature } = useSubscription();
  const hasKontoauszug = hasFeature('kontoauszug');
  const { activeDojo, filter: dojoFilter } = useDojoContext();
  const dojoId = activeDojo?.dojo_id || activeDojo?.id;

  // Sub-Tab Navigation
  const [activeSubTab, setActiveSubTab] = useState('euer');

  // Filters — Standard: aktives Dojo, nicht "alle"
  const DOJO_ID_TO_ORG = { 2: 'TDA International', 3: 'Kampfkunstschule Schreiner' };
  const [selectedOrg, setSelectedOrg] = useState('alle');
  useEffect(() => {
    if (dojoFilter === 'all') {
      // "Alle Dojos" im globalen Switcher → Gesamtansicht
      setSelectedOrg('alle');
    } else if (activeDojo && activeDojo !== 'super-admin' && typeof activeDojo === 'object') {
      // Spezifisches Dojo aktiv → auf dessen Org filtern
      const id = activeDojo.dojo_id || activeDojo.id;
      const orgName = DOJO_ID_TO_ORG[id];
      if (orgName) setSelectedOrg(orgName);
    } else {
      setSelectedOrg('alle');
    }
  }, [activeDojo, dojoFilter]);
  const [selectedJahr, setSelectedJahr] = useState(new Date().getFullYear());
  const [selectedQuartal, setSelectedQuartal] = useState('');

  // Data States
  const [dashboardData, setDashboardData] = useState(null);
  const [euerData, setEuerData] = useState(null);
  const [belege, setBelege] = useState([]);
  const [belegeTotal, setBelegeTotal] = useState(0);
  const [autoEinnahmen, setAutoEinnahmen] = useState([]);
  const [abschlussData, setAbschlussData] = useState(null);
  const [kategorien, setKategorien] = useState([]);

  // GuV und Bilanz States
  const [guvDetails, setGuvDetails] = useState(null);
  const [bilanzData, setBilanzData] = useState(null);
  const [expandedGuvDetails, setExpandedGuvDetails] = useState({});
  const [editingGewinnvortrag, setEditingGewinnvortrag] = useState(false);

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedKategorien, setExpandedKategorien] = useState({});

  // Modal States
  const [showBelegModal, setShowBelegModal] = useState(false);
  const [editingBeleg, setEditingBeleg] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadBelegId, setUploadBelegId] = useState(null);
  const [showAbschlussModal, setShowAbschlussModal] = useState(false);
  const [showBilanzStammdatenModal, setShowBilanzStammdatenModal] = useState(false);

  // Bank-Import States
  const [bankTransaktionen, setBankTransaktionen] = useState([]);
  const [bankTransaktionenTotal, setBankTransaktionenTotal] = useState(0);
  const [bankStatistik, setBankStatistik] = useState(null);
  const [bankImportHistorie, setBankImportHistorie] = useState([]);
  const [bankStatusFilter, setBankStatusFilter] = useState('');
  const [bankPage, setBankPage] = useState(1);
  const [bankUploadFile, setBankUploadFile] = useState(null);
  const [bankUploadOrg, setBankUploadOrg] = useState('Kampfkunstschule Schreiner');
  const [showBankUploadModal, setShowBankUploadModal] = useState(false);
  const [showKategorieModal, setShowKategorieModal] = useState(false);
  const [selectedBankTx, setSelectedBankTx] = useState(null);
  const [selectedBankTxIds, setSelectedBankTxIds] = useState([]);
  const [bankUploading, setBankUploading] = useState(false);
  const [bankSortField, setBankSortField] = useState('buchungsdatum');
  const [bankSortDirection, setBankSortDirection] = useState('desc');
  const [bankSearchTerm, setBankSearchTerm] = useState('');
  const [bankLimit, setBankLimit] = useState(30);
  const [bankBetragFilter, setBankBetragFilter] = useState(''); // '', 'einnahmen', 'ausgaben'
  const [bankKategorieFilter, setBankKategorieFilter] = useState(''); // Filter für zugeordnete Kategorie
  const [bankDatumVon, setBankDatumVon] = useState('');
  const [bankDatumBis, setBankDatumBis] = useState('');
  const [beitraegeDetail, setBeitraegeDetail] = useState(null); // { monat, jahr, label, eintraege }
  const [beitraegeDetailLoading, setBeitraegeDetailLoading] = useState(false);
  const [verkaufDetail, setVerkaufDetail] = useState(null); // { bon_nummer, datum, kunde, positionen, ... }
  const [verkaufDetailLoading, setVerkaufDetailLoading] = useState(false);
  const [showUmbuchungModal, setShowUmbuchungModal] = useState(false);
  const [umbuchungTx, setUmbuchungTx] = useState(null);
  const [showRechnungModal, setShowRechnungModal] = useState(false);
  const [offeneRechnungen, setOffeneRechnungen] = useState([]);
  const [rechnungTx, setRechnungTx] = useState(null);
  const [aehnlicheAnzahl, setAehnlicheAnzahl] = useState(0);
  const [aehnlicheAuftraggeber, setAehnlicheAuftraggeber] = useState('');

  // Steuerauswertung States
  const [steuerauswertung, setSteuerauswertung] = useState(null);
  const [steuerLoading, setSteuerLoading] = useState(false);
  const [steuerUebertragenLoading, setSteuerUebertragenLoading] = useState(false);
  const [cashflow, setCashflow] = useState(null);
  const [abgleichBericht, setAbgleichBericht] = useState(null);
  const [abgleichFilter, setAbgleichFilter] = useState('alle'); // alle | neu | bereits_erfasst | offen

  // Beleg Form State
  const [belegForm, setBelegForm] = useState({
    organisation_name: 'TDA International',
    buchungsart: 'ausgabe',
    beleg_datum: new Date().toISOString().split('T')[0],
    buchungsdatum: new Date().toISOString().split('T')[0],
    betrag_netto: '',
    mwst_satz: '19',
    kategorie: 'sonstige_kosten',
    beschreibung: '',
    lieferant_kunde: '',
    rechnungsnummer_extern: ''
  });

  // Pagination
  const [belegePage, setBelegePage] = useState(1);
  const [belegeLimit] = useState(20);

  // Jahre für Dropdown
  const jahre = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear; y >= currentYear - 5; y--) {
    jahre.push(y);
  }

  // Kategorien laden
  const loadKategorien = useCallback(async () => {
    try {
      const res = await axios.get('/buchhaltung/kategorien', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setKategorien(res.data);
    } catch (err) {
      console.error('Kategorien laden fehlgeschlagen:', err);
    }
  }, [token]);

  // Dashboard Daten laden
  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/buchhaltung/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg, jahr: selectedJahr }
      });
      setDashboardData(res.data);
    } catch (err) {
      console.error('Dashboard laden fehlgeschlagen:', err);
      setError('Dashboard konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, selectedJahr]);

  // EÜR Daten laden
  const loadEuer = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/buchhaltung/euer', {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg, jahr: selectedJahr, quartal: selectedQuartal || undefined }
      });
      setEuerData(res.data);
    } catch (err) {
      console.error('EÜR laden fehlgeschlagen:', err);
      setError('EÜR konnte nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, selectedJahr, selectedQuartal]);

  // Belege laden
  const loadBelege = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/buchhaltung/belege', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          organisation: selectedOrg !== 'alle' ? selectedOrg : undefined,
          jahr: selectedJahr,
          seite: belegePage,
          limit: belegeLimit
        }
      });
      setBelege(res.data.belege);
      setBelegeTotal(res.data.pagination.total);
    } catch (err) {
      console.error('Belege laden fehlgeschlagen:', err);
      setError('Belege konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, selectedJahr, belegePage, belegeLimit]);

  // Auto-Einnahmen laden
  const loadAutoEinnahmen = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/buchhaltung/einnahmen-auto', {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg, jahr: selectedJahr }
      });
      setAutoEinnahmen(res.data.einnahmen);
    } catch (err) {
      console.error('Auto-Einnahmen laden fehlgeschlagen:', err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, selectedJahr]);

  // Abschluss laden
  const loadAbschluss = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await axios.get(`/buchhaltung/abschluss/${selectedJahr}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg }
      });
      setAbschlussData(res.data);
    } catch (err) {
      console.error('Abschluss laden fehlgeschlagen:', err);
      setError('Fehler beim Laden des Jahresabschlusses');
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, selectedJahr]);

  // Bank-Transaktionen laden
  const loadBankTransaktionen = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/buchhaltung/bank-import/transaktionen', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          organisation: selectedOrg !== 'alle' ? selectedOrg : undefined,
          status: bankStatusFilter || undefined,
          seite: bankLimit === 0 ? 1 : bankPage,
          limit: bankLimit === 0 ? 10000 : bankLimit
        }
      });
      setBankTransaktionen(res.data.transaktionen);
      setBankTransaktionenTotal(res.data.pagination.total);
    } catch (err) {
      console.error('Bank-Transaktionen laden fehlgeschlagen:', err);
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, bankStatusFilter, bankPage, bankLimit]);

  // Bank-Statistik laden
  const loadBankStatistik = useCallback(async () => {
    try {
      const res = await axios.get('/buchhaltung/bank-import/statistik', {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg !== 'alle' ? selectedOrg : undefined }
      });
      setBankStatistik(res.data.statistik);
      setBankImportHistorie(res.data.letzteImports);
    } catch (err) {
      console.error('Bank-Statistik laden fehlgeschlagen:', err);
    }
  }, [token, selectedOrg]);

  // Bank-Datei hochladen
  const uploadBankFile = async () => {
    if (!bankUploadFile) return;

    const formData = new FormData();
    formData.append('datei', bankUploadFile);
    formData.append('organisation', bankUploadOrg);

    try {
      setBankUploading(true);
      setError('');
      const res = await axios.post('/buchhaltung/bank-import/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setSuccess(`Import erfolgreich: ${res.data.count} Transaktionen importiert, ${res.data.duplikate} Duplikate übersprungen`);
      setShowBankUploadModal(false);
      setBankUploadFile(null);
      loadBankTransaktionen();
      loadBankStatistik();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      console.error('Bank-Upload fehlgeschlagen:', err);
      setError(err.response?.data?.message || 'Fehler beim Import');
    } finally {
      setBankUploading(false);
    }
  };

  // Ähnliche Transaktionen laden (für Modal-Vorschau)
  const ladeAehnliche = async (txId) => {
    try {
      const res = await axios.get(`/buchhaltung/bank-import/aehnliche/${txId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAehnlicheAnzahl(res.data?.anzahl || 0);
      setAehnlicheAuftraggeber(res.data?.auftraggeber || '');
    } catch (_) {
      setAehnlicheAnzahl(0);
    }
  };

  // Transaktion zuordnen
  const zuordnenTransaktion = async (kategorie) => {
    if (!selectedBankTx) return;

    try {
      setLoading(true);
      const res = await axios.post(`/buchhaltung/bank-import/zuordnen/${selectedBankTx.transaktion_id}`, {
        kategorie
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const autoCount = res.data?.auto_zugeordnet || 0;
      const msg = autoCount > 0
        ? `Zugeordnet + ${autoCount} weitere Transaktionen von "${aehnlicheAuftraggeber}" automatisch zugeordnet`
        : 'Transaktion zugeordnet';
      setSuccess(msg);
      setShowKategorieModal(false);
      setSelectedBankTx(null);
      setAehnlicheAnzahl(0);
      loadBankTransaktionen();
      loadBankStatistik();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler bei der Zuordnung');
    } finally {
      setLoading(false);
    }
  };

  // Batch-Zuordnung
  const batchZuordnen = async (kategorie) => {
    if (selectedBankTxIds.length === 0) return;

    try {
      setLoading(true);
      const transaktionen = selectedBankTxIds.map(id => ({ id, kategorie }));
      await axios.post('/buchhaltung/bank-import/batch-zuordnen', {
        transaktionen
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(`${selectedBankTxIds.length} Transaktionen zugeordnet`);
      setSelectedBankTxIds([]);
      loadBankTransaktionen();
      loadBankStatistik();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler bei der Batch-Zuordnung');
    } finally {
      setLoading(false);
    }
  };

  // Transaktion ignorieren
  const ignorierenTransaktion = async (txId, lerneRegel = false) => {
    try {
      setLoading(true);
      await axios.post(`/buchhaltung/bank-import/ignorieren/${txId}`, {
        lerne_regel: lerneRegel
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Transaktion ignoriert');
      loadBankTransaktionen();
      loadBankStatistik();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Ignorieren');
    } finally {
      setLoading(false);
    }
  };

  // Vorschlag annehmen
  const vorschlagAnnehmen = async (txId) => {
    try {
      setLoading(true);
      await axios.post(`/buchhaltung/bank-import/vorschlag-annehmen/${txId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Vorschlag angenommen');
      loadBankTransaktionen();
      loadBankStatistik();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Annehmen');
    } finally {
      setLoading(false);
    }
  };

  // Checkbox Toggle
  const toggleBankTxSelection = (txId) => {
    setSelectedBankTxIds(prev =>
      prev.includes(txId)
        ? prev.filter(id => id !== txId)
        : [...prev, txId]
    );
  };

  // Select all visible
  const toggleAllBankTx = () => {
    const visibleIds = getFilteredSortedTransaktionen()
      .filter(tx => tx.status !== 'zugeordnet' && tx.status !== 'ignoriert')
      .map(tx => tx.transaktion_id);

    if (selectedBankTxIds.length === visibleIds.length) {
      setSelectedBankTxIds([]);
    } else {
      setSelectedBankTxIds(visibleIds);
    }
  };

  // Sortierung umschalten
  const toggleBankSort = (field) => {
    if (bankSortField === field) {
      setBankSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setBankSortField(field);
      setBankSortDirection('asc');
    }
  };

  // Gefilterte und sortierte Transaktionen
  const getFilteredSortedTransaktionen = () => {
    let filtered = [...bankTransaktionen];

    // Suchfilter
    if (bankSearchTerm.trim()) {
      const search = bankSearchTerm.toLowerCase();
      filtered = filtered.filter(tx =>
        (tx.auftraggeber_empfaenger || '').toLowerCase().includes(search) ||
        (tx.verwendungszweck || '').toLowerCase().includes(search) ||
        (tx.organisation_name || '').toLowerCase().includes(search) ||
        String(tx.betrag).includes(search)
      );
    }

    // Einnahmen/Ausgaben Filter
    if (bankBetragFilter === 'einnahmen') {
      filtered = filtered.filter(tx => parseFloat(tx.betrag) >= 0);
    } else if (bankBetragFilter === 'ausgaben') {
      filtered = filtered.filter(tx => parseFloat(tx.betrag) < 0);
    }

    // Kategorie Filter
    if (bankKategorieFilter) {
      filtered = filtered.filter(tx => tx.kategorie === bankKategorieFilter);
    }

    // Datum Von/Bis Filter
    if (bankDatumVon) {
      filtered = filtered.filter(tx => tx.buchungsdatum >= bankDatumVon);
    }
    if (bankDatumBis) {
      filtered = filtered.filter(tx => tx.buchungsdatum <= bankDatumBis);
    }

    // Sortierung
    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (bankSortField) {
        case 'buchungsdatum':
          aVal = new Date(a.buchungsdatum);
          bVal = new Date(b.buchungsdatum);
          break;
        case 'betrag':
          aVal = parseFloat(a.betrag);
          bVal = parseFloat(b.betrag);
          break;
        case 'auftraggeber_empfaenger':
          aVal = (a.auftraggeber_empfaenger || '').toLowerCase();
          bVal = (b.auftraggeber_empfaenger || '').toLowerCase();
          break;
        case 'verwendungszweck':
          aVal = (a.verwendungszweck || '').toLowerCase();
          bVal = (b.verwendungszweck || '').toLowerCase();
          break;
        case 'organisation_name':
          aVal = (a.organisation_name || '').toLowerCase();
          bVal = (b.organisation_name || '').toLowerCase();
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        default:
          aVal = a[bankSortField];
          bVal = b[bankSortField];
      }

      if (aVal < bVal) return bankSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return bankSortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  };

  // Statistik pro Kategorie berechnen
  const getKategorieStatistik = () => {
    const stats = {};
    bankTransaktionen
      .filter(tx => tx.status === 'zugeordnet' && tx.kategorie)
      .forEach(tx => {
        if (!stats[tx.kategorie]) {
          stats[tx.kategorie] = { count: 0, summe: 0 };
        }
        stats[tx.kategorie].count++;
        stats[tx.kategorie].summe += parseFloat(tx.betrag);
      });
    return stats;
  };

  // Umbuchung - Kategorie ändern
  const umbuchenTransaktion = async (txId, neueKategorie) => {
    try {
      setLoading(true);
      await axios.post(`/buchhaltung/bank-import/umbuchen/${txId}`, {
        kategorie: neueKategorie
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Kategorie geändert');
      setShowUmbuchungModal(false);
      setUmbuchungTx(null);
      loadBankTransaktionen();
      loadBankStatistik();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler bei der Umbuchung');
    } finally {
      setLoading(false);
    }
  };

  // Transaktion löschen
  const deleteTransaktion = async (txId) => {
    if (!confirm('Transaktion wirklich löschen?')) return;

    try {
      setLoading(true);
      await axios.delete(`/buchhaltung/bank-import/transaktion/${txId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Transaktion gelöscht');
      loadBankTransaktionen();
      loadBankStatistik();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Löschen');
    } finally {
      setLoading(false);
    }
  };

  // Offene Rechnungen laden (für Verknüpfung)
  const loadOffeneRechnungen = async () => {
    try {
      const res = await axios.get('/buchhaltung/bank-import/offene-rechnungen', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOffeneRechnungen(res.data.rechnungen || []);
    } catch (err) {
      console.error('Fehler beim Laden offener Rechnungen:', err);
    }
  };

  // Bank-Transaktion mit Rechnung verknüpfen (ohne EÜR-Buchung)
  const verknuepfeMitRechnung = async (rechnungId) => {
    if (!rechnungTx) return;

    try {
      setLoading(true);
      await axios.post(`/buchhaltung/bank-import/rechnung-verknuepfen/${rechnungTx.transaktion_id}`, {
        rechnung_id: rechnungId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Transaktion mit Rechnung verknüpft');
      setShowRechnungModal(false);
      setRechnungTx(null);
      loadBankTransaktionen();
      loadBankStatistik();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler bei der Verknüpfung');
    } finally {
      setLoading(false);
    }
  };

  // Ganzen Import löschen
  const deleteImport = async (importId) => {
    if (!confirm('Alle Transaktionen dieses Imports löschen? (Bereits zugeordnete bleiben erhalten)')) return;

    try {
      setLoading(true);
      const res = await axios.delete(`/buchhaltung/bank-import/import/${importId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess(res.data.message);
      loadBankTransaktionen();
      loadBankStatistik();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Löschen');
    } finally {
      setLoading(false);
    }
  };

  // ===================================================================
  // 📊 STEUERAUSWERTUNG
  // ===================================================================
  const loadSteuerauswertung = useCallback(async () => {
    if (!hasKontoauszug) return;
    setSteuerLoading(true);
    try {
      const [auswRes, cashRes, abgRes] = await Promise.all([
        axios.get('/buchhaltung/bank-import/steuerauswertung', {
          params: { jahr: selectedJahr },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/buchhaltung/bank-import/cashflow', {
          params: { jahr: selectedJahr },
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('/buchhaltung/bank-import/abgleich-bericht', {
          params: { jahr: selectedJahr },
          headers: { Authorization: `Bearer ${token}` }
        }),
      ]);
      setSteuerauswertung(auswRes.data);
      setCashflow(cashRes.data);
      setAbgleichBericht(abgRes.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Laden der Steuerauswertung');
    } finally {
      setSteuerLoading(false);
    }
  }, [selectedJahr, token, hasKontoauszug]);

  const euerUebertragen = async (nurVorschau = false) => {
    setSteuerUebertragenLoading(true);
    setError('');
    try {
      const res = await axios.post('/buchhaltung/bank-import/euer-uebertragen', {
        jahr: selectedJahr,
        nur_vorschau: nurVorschau
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (nurVorschau) {
        alert(`Vorschau: ${res.data.anzahl} Transaktionen bereit zur Übertragung.\nEinnahmen: ${formatCurrency(res.data.summe_einnahmen)}\nAusgaben: ${formatCurrency(res.data.summe_ausgaben)}`);
      } else {
        setSuccess(res.data.message);
        loadSteuerauswertung();
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler bei der EÜR-Übertragung');
    } finally {
      setSteuerUebertragenLoading(false);
    }
  };

  // ===================================================================
  // 📊 GuV DATA FETCHING
  // ===================================================================
  const fetchGuvData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get('/buchhaltung/guv/details', {
        params: { organisation: selectedOrg, jahr: selectedJahr, quartal: selectedQuartal },
        headers: { Authorization: `Bearer ${token}` }
      });
      setGuvDetails(response.data || null);
    } catch (err) {
      console.error('GuV-Fehler:', err);
      setError('Fehler beim Laden der GuV-Daten');
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, selectedJahr, selectedQuartal]);

  // ===================================================================
  // 📊 BILANZ DATA FETCHING
  // ===================================================================
  const fetchBilanzData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.get('/buchhaltung/bilanz', {
        params: { organisation: selectedOrg, jahr: selectedJahr },
        headers: { Authorization: `Bearer ${token}` }
      });
      setBilanzData(response.data || null);
    } catch (err) {
      console.error('Bilanz-Fehler:', err);
      setError('Fehler beim Laden der Bilanz-Daten');
    } finally {
      setLoading(false);
    }
  }, [token, selectedOrg, selectedJahr]);

  const saveGewinnvortrag = useCallback(async (newValue) => {
    setEditingGewinnvortrag(false);
    const raw = bilanzData?.raw || {};
    try {
      await axios.post('/buchhaltung/bilanz/stammdaten', {
        organisation: selectedOrg,
        jahr: selectedJahr,
        ...raw,
        gewinnvortrag: parseFloat(newValue) || 0
      }, { headers: { Authorization: `Bearer ${token}` } });
      fetchBilanzData();
    } catch (err) {
      console.error('Gewinnvortrag speichern:', err);
      setError('Fehler beim Speichern des Gewinnvortrags');
    }
  }, [bilanzData, selectedOrg, selectedJahr, token, fetchBilanzData]);

  // Initial Load
  useEffect(() => {
    loadKategorien();
  }, [loadKategorien]);

  // Load data based on active sub-tab
  useEffect(() => {
    if (activeSubTab === 'euer') {
      loadDashboard();
      loadEuer();
    } else if (activeSubTab === 'guv') {
      fetchGuvData();
    } else if (activeSubTab === 'bilanz') {
      fetchBilanzData();
    } else if (activeSubTab === 'belege') {
      loadBelege();
    } else if (activeSubTab === 'auto') {
      loadAutoEinnahmen();
    } else if (activeSubTab === 'bankimport') {
      loadBankTransaktionen();
      loadBankStatistik();
    } else if (activeSubTab === 'steuerauswertung') {
      loadSteuerauswertung();
    } else if (activeSubTab === 'abschluss') {
      loadAbschluss();
    }
  }, [activeSubTab, selectedOrg, selectedJahr, selectedQuartal, belegePage, bankPage, bankStatusFilter, loadDashboard, loadEuer, loadBelege, loadAutoEinnahmen, loadBankTransaktionen, loadBankStatistik, loadSteuerauswertung, loadAbschluss, fetchGuvData, fetchBilanzData]);

  // Beleg speichern
  const saveBeleg = async () => {
    try {
      setLoading(true);
      setError('');

      if (editingBeleg) {
        await axios.put(`/buchhaltung/belege/${editingBeleg.beleg_id}`, belegForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Beleg erfolgreich aktualisiert');
      } else {
        await axios.post('/buchhaltung/belege', belegForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setSuccess('Beleg erfolgreich erstellt');
      }

      setShowBelegModal(false);
      setEditingBeleg(null);
      resetBelegForm();
      loadBelege();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Beleg speichern fehlgeschlagen:', err);
      setError(err.response?.data?.message || 'Fehler beim Speichern des Belegs');
    } finally {
      setLoading(false);
    }
  };

  // Beleg stornieren
  const stornoBeleg = async (belegId) => {
    const grund = prompt('Bitte geben Sie einen Storno-Grund an:');
    if (!grund) return;

    try {
      setLoading(true);
      await axios.post(`/buchhaltung/belege/${belegId}/stornieren`, { grund }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Beleg erfolgreich storniert');
      loadBelege();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Stornieren');
    } finally {
      setLoading(false);
    }
  };

  // Beleg festschreiben
  const festschreibenBeleg = async (belegId) => {
    if (!confirm('Beleg wirklich festschreiben? Danach sind keine Änderungen mehr möglich.')) return;

    try {
      setLoading(true);
      await axios.post(`/buchhaltung/belege/${belegId}/festschreiben`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Beleg festgeschrieben');
      loadBelege();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Festschreiben');
    } finally {
      setLoading(false);
    }
  };

  // Datei Upload
  const uploadDatei = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadBelegId) return;

    const formData = new FormData();
    formData.append('datei', file);

    try {
      setLoading(true);
      await axios.post(`/buchhaltung/belege/${uploadBelegId}/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setSuccess('Datei erfolgreich hochgeladen');
      setShowUploadModal(false);
      setUploadBelegId(null);
      loadBelege();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Upload');
    } finally {
      setLoading(false);
    }
  };

  // Jahresabschluss festschreiben
  const festschreibenJahr = async () => {
    if (!dojoMode && selectedOrg === 'alle') {
      setError('Bitte wählen Sie eine Organisation aus');
      return;
    }

    if (!confirm(`Jahresabschluss ${selectedJahr} wirklich festschreiben? Danach sind keine Änderungen mehr möglich.`)) return;

    try {
      setLoading(true);
      await axios.post(`/buchhaltung/abschluss/${selectedJahr}/festschreiben`, {
        organisation: selectedOrg
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Jahresabschluss festgeschrieben');
      setShowAbschlussModal(false);
      loadAbschluss();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Festschreiben');
    } finally {
      setLoading(false);
    }
  };

  // CSV Export
  const exportCSV = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/buchhaltung/abschluss/${selectedJahr}/export`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg },
        responseType: 'blob'
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EUeR_${selectedJahr}_${selectedOrg || 'alle'}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccess('Export erfolgreich');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Export fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  };

  // Form Reset
  const resetBelegForm = () => {
    setBelegForm({
      organisation_name: 'TDA International',
      buchungsart: 'ausgabe',
      beleg_datum: new Date().toISOString().split('T')[0],
      buchungsdatum: new Date().toISOString().split('T')[0],
      betrag_netto: '',
      mwst_satz: '19',
      kategorie: 'sonstige_kosten',
      beschreibung: '',
      lieferant_kunde: '',
      rechnungsnummer_extern: ''
    });
  };

  // Beleg bearbeiten
  const editBeleg = (beleg) => {
    setEditingBeleg(beleg);
    setBelegForm({
      organisation_name: beleg.organisation_name,
      buchungsart: beleg.buchungsart,
      beleg_datum: beleg.beleg_datum?.split('T')[0],
      buchungsdatum: beleg.buchungsdatum?.split('T')[0],
      betrag_netto: beleg.betrag_netto,
      mwst_satz: beleg.mwst_satz,
      kategorie: beleg.kategorie,
      beschreibung: beleg.beschreibung,
      lieferant_kunde: beleg.lieferant_kunde || '',
      rechnungsnummer_extern: beleg.rechnungsnummer_extern || ''
    });
    setShowBelegModal(true);
  };

  // Beiträge Drill-down laden
  const ladeBeitraegeDetail = async (monat, jahr, label, organisation) => {
    console.log('[BeitraegeDetail] params:', { monat, jahr, label, organisation });
    setBeitraegeDetailLoading(true);
    setBeitraegeDetail({ monat, jahr, label, eintraege: [] });
    if (!monat || !jahr || isNaN(Number(monat)) || isNaN(Number(jahr))) {
      setBeitraegeDetail({ monat, jahr, label, eintraege: [], fehler: `Ungültige Parameter: monat=${monat}, jahr=${jahr}` });
      setBeitraegeDetailLoading(false);
      return;
    }
    try {
      const res = await axios.get('/buchhaltung/euer/beitraege-detail', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          monat: String(monat),
          jahr: String(jahr),
          ...(organisation && organisation !== 'alle' ? { organisation } : {})
        }
      });
      setBeitraegeDetail({ monat, jahr, label, eintraege: res.data });
    } catch (err) {
      console.error('Beiträge-Detail laden fehlgeschlagen:', err, err?.response?.data);
      const errMsg = err?.response?.data?.message
        || (typeof err?.response?.data === 'string' ? err.response.data.substring(0, 200) : null)
        || JSON.stringify(err?.response?.data)
        || err.message;
      setBeitraegeDetail(prev => prev ? { ...prev, fehler: errMsg } : null);
    } finally {
      setBeitraegeDetailLoading(false);
    }
  };

  // Verkauf Drill-down laden
  const ladeVerkaufDetail = async (verkaufId, label) => {
    setVerkaufDetailLoading(true);
    setVerkaufDetail({ label, loading: true });
    try {
      const res = await axios.get(`/buchhaltung/euer/verkauf-detail/${verkaufId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVerkaufDetail({ label, ...res.data });
    } catch (err) {
      setVerkaufDetail({ label, fehler: err?.response?.data?.message || err.message });
    } finally {
      setVerkaufDetailLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value || 0);
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE');
  };

  // Kategorie Name
  const getKategorieName = (id) => {
    const kat = kategorien.find(k => k.id === id);
    return kat?.name || id;
  };

  // Sub-Tabs
  const subTabs = [
    { id: 'euer', label: 'EÜR Übersicht', icon: <PieChart size={16} /> },
    { id: 'ustVA', label: 'UStVA', icon: <Calculator size={16} /> },
    { id: 'guv', label: 'GuV', icon: <TrendingUp size={16} /> },
    { id: 'bilanz', label: 'Bilanz', icon: <Building2 size={16} /> },
    { id: 'belege', label: 'Belegerfassung', icon: <Receipt size={16} /> },
    { id: 'rechnungen', label: 'Rechnungen', icon: <FileText size={16} /> },
    { id: 'auto', label: 'Auto. Buchungen', icon: <RefreshCw size={16} /> },
    { id: 'bankimport', label: 'Kontoauszüge', icon: <Landmark size={16} />, enterprise: true },
    { id: 'steuerauswertung', label: 'Steuerauswertung', icon: <BarChart3 size={16} />, enterprise: true },
    { id: 'abschluss', label: 'Jahresabschluss', icon: <FileSpreadsheet size={16} /> }
  ];

  return (
    <div className="buchhaltung-tab">
      {/* Header with Filters */}
      <div className="buchhaltung-header">
        <div className="header-title">
          <Calculator size={24} />
          <div>
            <h2>Buchhaltung</h2>
            <span className="scope-subtitle">
              {selectedOrg === 'alle'
                ? 'Alle Organisationen — Gesamtansicht'
                : selectedOrg}
              {' · '}{selectedJahr}
              {selectedQuartal ? ` · Q${selectedQuartal}` : ''}
            </span>
          </div>
        </div>

        <div className="header-filters">
          {!dojoMode && (
          <div className="filter-group">
            <label>Organisation:</label>
            <select
              value={selectedOrg}
              onChange={(e) => setSelectedOrg(e.target.value)}
            >
              <option value="alle">Alle Organisationen</option>
              <option value="TDA International">TDA International</option>
              <option value="Kampfkunstschule Schreiner">Kampfkunstschule Schreiner</option>
            </select>
          </div>
          )}

          <div className="filter-group">
            <label>Jahr:</label>
            <select
              value={selectedJahr}
              onChange={(e) => setSelectedJahr(parseInt(e.target.value))}
            >
              {jahre.map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>

          {activeSubTab === 'euer' && (
            <div className="filter-group">
              <label>Quartal:</label>
              <select
                value={selectedQuartal}
                onChange={(e) => setSelectedQuartal(e.target.value)}
              >
                <option value="">Gesamtjahr</option>
                <option value="1">Q1 (Jan-Mär)</option>
                <option value="2">Q2 (Apr-Jun)</option>
                <option value="3">Q3 (Jul-Sep)</option>
                <option value="4">Q4 (Okt-Dez)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="message error">
          <AlertCircle size={16} />
          {error}
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="message success">
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {/* Sub-Tab Navigation */}
      <div className="sub-tabs">
        {subTabs.map(tab => {
          const locked = tab.enterprise && !hasKontoauszug;
          return (
            <button
              key={tab.id}
              className={`sub-tab ${activeSubTab === tab.id ? 'active' : ''} ${locked ? 'sub-tab--locked' : ''}`}
              onClick={() => !locked && setActiveSubTab(tab.id)}
              title={locked ? 'Nur im Enterprise-Plan verfügbar' : undefined}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.enterprise && (
                <span className={`enterprise-badge ${locked ? 'enterprise-badge--locked' : 'enterprise-badge--active'}`}>
                  {locked ? <Lock size={10} /> : <Star size={10} />}
                  Enterprise
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Scope-Kontext-Banner */}
      <div className={`scope-banner ${selectedOrg === 'alle' ? 'scope-gesamt' : 'scope-einzeln'}`}>
        <Building2 size={14} />
        <strong>
          {selectedOrg === 'alle' ? 'Gesamtansicht — Alle Organisationen' : selectedOrg}
        </strong>
        <span className="scope-divider">·</span>
        <span>Geschäftsjahr {selectedJahr}</span>
        {selectedQuartal && <><span className="scope-divider">·</span><span>Q{selectedQuartal}</span></>}
      </div>

      {/* Sub-Tab Content */}
      <div className="sub-tab-content">
        {/* ==================== EÜR ÜBERSICHT ==================== */}
        {activeSubTab === 'euer' && (
          <div className="euer-content">
            {/* Dashboard Cards */}
            {dashboardData && (
              <div className="dashboard-cards">
                <div className="dash-card einnahmen">
                  <div className="card-icon">
                    <TrendingUp size={24} />
                  </div>
                  <div className="card-content">
                    <span className="card-label">Einnahmen</span>
                    <span className="card-value">{formatCurrency(dashboardData.einnahmen?.gesamt)}</span>
                  </div>
                </div>

                <div className="dash-card ausgaben">
                  <div className="card-icon">
                    <TrendingDown size={24} />
                  </div>
                  <div className="card-content">
                    <span className="card-label">Ausgaben</span>
                    <span className="card-value">{formatCurrency(dashboardData.ausgaben?.gesamt)}</span>
                  </div>
                </div>

                <div className={`dash-card gewinn ${dashboardData.gewinnVerlust >= 0 ? 'positiv' : 'negativ'}`}>
                  <div className="card-icon">
                    <Euro size={24} />
                  </div>
                  <div className="card-content">
                    <span className="card-label">Gewinn/Verlust</span>
                    <span className="card-value">{formatCurrency(dashboardData.gewinnVerlust)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* EÜR Details */}
            {euerData && (
              <div className="euer-details">
                <div className="euer-section">
                  <h3>
                    <TrendingUp size={18} />
                    Einnahmen
                  </h3>
                  <table className="euer-table">
                    <thead>
                      <tr>
                        <th>Kategorie</th>
                        <th>Quelle</th>
                        <th className="right">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(euerData.einnahmen?.nachKategorie || {}).map(([kat, data]) => (
                        <React.Fragment key={kat}>
                          <tr
                            className="kategorie-row clickable bt-cursor-pointer"
                            onClick={() => setExpandedKategorien(prev => ({ ...prev, [`ein_${kat}`]: !prev[`ein_${kat}`] }))}
                          >
                            <td colSpan="2">
                              <span className="u-flex-row-sm">
                                {expandedKategorien[`ein_${kat}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <strong>{getKategorieName(kat)}</strong>
                              </span>
                            </td>
                            <td className="right"><strong>{formatCurrency(data.summe)}</strong></td>
                          </tr>
                          {expandedKategorien[`ein_${kat}`] && data.details?.map((detail, idx) => (
                            <React.Fragment key={`${kat}-${idx}`}>
                              <tr
                                className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' clickable' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedKategorien(prev => ({ ...prev, [`ein_${kat}_${idx}`]: !prev[`ein_${kat}_${idx}`] }));
                                }}
                              >
                                <td></td>
                                <td>
                                  <span className="bt-flex-icon">
                                    {detail.einzelbuchungen?.length > 0 && (
                                      expandedKategorien[`ein_${kat}_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                                    )}
                                    {detail.quelle} ({detail.anzahl}x)
                                  </span>
                                </td>
                                <td className="right">{formatCurrency(detail.summe)}</td>
                              </tr>
                              {expandedKategorien[`ein_${kat}_${idx}`] && detail.einzelbuchungen?.map((buchung, bIdx) => (
                                <tr
                                  key={`${kat}-${idx}-${bIdx}`}
                                  className={`einzelbuchung-row${buchung.drilldown ? ' clickable bt-cursor-pointer' : ''}`}
                                  onClick={buchung.drilldown ? () => {
                                    if (buchung.drilldown.typ === 'beitraege') ladeBeitraegeDetail(buchung.drilldown.monat, buchung.drilldown.jahr, buchung.beschreibung, buchung.drilldown.organisation);
                                    else if (buchung.drilldown.typ === 'verkauf') ladeVerkaufDetail(buchung.drilldown.verkauf_id, buchung.beschreibung);
                                  } : undefined}
                                  title={buchung.drilldown ? 'Klicken für Einzelmitglieder' : undefined}
                                >
                                  <td></td>
                                  <td className="bt-cell-sub">
                                    <span className="bt-flex-icon">
                                      {buchung.drilldown && <ChevronRight size={12} />}
                                      {new Date(buchung.datum).toLocaleDateString('de-DE')} - {buchung.beschreibung || 'Keine Beschreibung'}
                                    </span>
                                  </td>
                                  <td className="right bt-cell-sub-right">{formatCurrency(buchung.betrag)}</td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      ))}
                      <tr className="total-row">
                        <td colSpan="2"><strong>Summe Einnahmen</strong></td>
                        <td className="right"><strong>{formatCurrency(euerData.einnahmen?.gesamt)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="euer-section">
                  <h3>
                    <TrendingDown size={18} />
                    Ausgaben
                  </h3>
                  <table className="euer-table">
                    <thead>
                      <tr>
                        <th>Kategorie</th>
                        <th>Quelle</th>
                        <th className="right">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(euerData.ausgaben?.nachKategorie || {}).map(([kat, data]) => (
                        <React.Fragment key={kat}>
                          <tr
                            className="kategorie-row clickable bt-cursor-pointer"
                            onClick={() => setExpandedKategorien(prev => ({ ...prev, [`aus_${kat}`]: !prev[`aus_${kat}`] }))}
                          >
                            <td colSpan="2">
                              <span className="u-flex-row-sm">
                                {expandedKategorien[`aus_${kat}`] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                <strong>{getKategorieName(kat)}</strong>
                              </span>
                            </td>
                            <td className="right"><strong>{formatCurrency(data.summe)}</strong></td>
                          </tr>
                          {expandedKategorien[`aus_${kat}`] && data.details?.map((detail, idx) => (
                            <React.Fragment key={`${kat}-${idx}`}>
                              <tr
                                className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' clickable' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedKategorien(prev => ({ ...prev, [`aus_${kat}_${idx}`]: !prev[`aus_${kat}_${idx}`] }));
                                }}
                              >
                                <td></td>
                                <td>
                                  <span className="bt-flex-icon">
                                    {detail.einzelbuchungen?.length > 0 && (
                                      expandedKategorien[`aus_${kat}_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                                    )}
                                    {detail.quelle} ({detail.anzahl}x)
                                  </span>
                                </td>
                                <td className="right">{formatCurrency(detail.summe)}</td>
                              </tr>
                              {expandedKategorien[`aus_${kat}_${idx}`] && detail.einzelbuchungen?.map((buchung, bIdx) => (
                                <tr key={`${kat}-${idx}-${bIdx}`} className="einzelbuchung-row">
                                  <td></td>
                                  <td className="bt-cell-sub">
                                    {new Date(buchung.datum).toLocaleDateString('de-DE')} - {buchung.beschreibung || 'Keine Beschreibung'}
                                  </td>
                                  <td className="right bt-cell-sub-right">{formatCurrency(buchung.betrag)}</td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </React.Fragment>
                      ))}
                      <tr className="total-row">
                        <td colSpan="2"><strong>Summe Ausgaben</strong></td>
                        <td className="right"><strong>{formatCurrency(euerData.ausgaben?.gesamt)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Ergebnis */}
                <div className={`euer-ergebnis ${euerData.gewinnVerlust >= 0 ? 'positiv' : 'negativ'}`}>
                  <span>Ergebnis (Gewinn/Verlust):</span>
                  <span className="ergebnis-wert">{formatCurrency(euerData.gewinnVerlust)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== UStVA TAB ==================== */}
        {activeSubTab === 'ustVA' && (
          <div style={{ marginTop: 8 }}>
            <UStVATab dojoId={dojoId} />
          </div>
        )}

        {/* ==================== GuV TAB ==================== */}
        {activeSubTab === 'guv' && (
          <div className="guv-content">
            <div className="section-header">
              <h3>Gewinn- und Verlustrechnung</h3>
              <div className="header-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => openApiBlob(`/api/buchhaltung/guv/export?organisation=${selectedOrg}&jahr=${selectedJahr}&format=csv&quartal=${selectedQuartal}`, { download: true, filename: `guv-${selectedJahr}.csv` })}
                >
                  <Download size={16} />
                  CSV Export
                </button>
              </div>
            </div>

            {loading && <div className="loading">Lade GuV-Daten...</div>}

            {guvDetails && (
              <div className="guv-details">
                <table className="guv-table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th className="right">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Revenue Section */}
                    <tr className="section-header-row">
                      <td colSpan="2"><strong>1. Umsatzerlöse</strong></td>
                    </tr>
                    <tr
                      className="clickable"
                      onClick={() => setExpandedKategorien(prev => ({ ...prev, 'guv_umsatz': !prev['guv_umsatz'] }))}
                      className="bt-cursor-pointer"
                    >
                      <td className="bt-pl-2">
                        {expandedKategorien['guv_umsatz'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {' '}Umsatzerlöse
                      </td>
                      <td className="right">{formatCurrency(guvDetails.umsatzerloese.gesamt)}</td>
                    </tr>
                    {expandedKategorien['guv_umsatz'] && guvDetails.umsatzerloese.details.map((detail, idx) => (
                      <React.Fragment key={idx}>
                        <tr
                          className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' bt-cursor-pointer' : ''}`}
                          onClick={detail.einzelbuchungen?.length > 0 ? () => setExpandedGuvDetails(prev => ({ ...prev, [`umsatz_${idx}`]: !prev[`umsatz_${idx}`] })) : undefined}
                        >
                          <td className="bt-pl-4">
                            <span className="bt-flex-icon">
                              {detail.einzelbuchungen?.length > 0 && (expandedGuvDetails[`umsatz_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                              {detail.quelle}
                            </span>
                          </td>
                          <td className="right">{formatCurrency(detail.betrag)}</td>
                        </tr>
                        {expandedGuvDetails[`umsatz_${idx}`] && detail.einzelbuchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row">
                            <td className="bt-cell-sub bt-pl-6">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td>
                            <td className="right bt-cell-sub-right">{formatCurrency(buch.betrag)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}

                    {/* Material Costs */}
                    <tr className="section-header-row">
                      <td colSpan="2"><strong>2. Materialaufwand</strong></td>
                    </tr>
                    <tr
                      className={guvDetails.materialaufwand.details.length > 0 ? 'clickable' : ''}
                      onClick={() => setExpandedKategorien(prev => ({ ...prev, 'guv_material': !prev['guv_material'] }))}
                    >
                      <td className="bt-pl-2">
                        {guvDetails.materialaufwand.details.length > 0 && (expandedKategorien['guv_material'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                        {' '}Materialaufwand
                      </td>
                      <td className="right negative">-{formatCurrency(guvDetails.materialaufwand.gesamt)}</td>
                    </tr>
                    {expandedKategorien['guv_material'] && guvDetails.materialaufwand.details.map((detail, idx) => (
                      <React.Fragment key={idx}>
                        <tr
                          className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' bt-cursor-pointer' : ''}`}
                          onClick={detail.einzelbuchungen?.length > 0 ? () => setExpandedGuvDetails(prev => ({ ...prev, [`material_${idx}`]: !prev[`material_${idx}`] })) : undefined}
                        >
                          <td className="bt-pl-4">
                            <span className="bt-flex-icon">
                              {detail.einzelbuchungen?.length > 0 && (expandedGuvDetails[`material_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                              {detail.quelle}
                            </span>
                          </td>
                          <td className="right negative">-{formatCurrency(detail.betrag)}</td>
                        </tr>
                        {expandedGuvDetails[`material_${idx}`] && detail.einzelbuchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row">
                            <td className="bt-cell-sub bt-pl-6">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td>
                            <td className="right bt-cell-sub-right">-{formatCurrency(buch.betrag)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}

                    {/* Personnel Costs */}
                    <tr className="section-header-row">
                      <td colSpan="2"><strong>3. Personalaufwand</strong></td>
                    </tr>
                    <tr
                      className={guvDetails.personalaufwand.details.length > 0 ? 'clickable' : ''}
                      onClick={() => setExpandedKategorien(prev => ({ ...prev, 'guv_personal': !prev['guv_personal'] }))}
                    >
                      <td className="bt-pl-2">
                        {guvDetails.personalaufwand.details.length > 0 && (expandedKategorien['guv_personal'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                        {' '}Personalaufwand
                      </td>
                      <td className="right negative">-{formatCurrency(guvDetails.personalaufwand.gesamt)}</td>
                    </tr>
                    {expandedKategorien['guv_personal'] && guvDetails.personalaufwand.details.map((detail, idx) => (
                      <React.Fragment key={idx}>
                        <tr
                          className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' bt-cursor-pointer' : ''}`}
                          onClick={detail.einzelbuchungen?.length > 0 ? () => setExpandedGuvDetails(prev => ({ ...prev, [`personal_${idx}`]: !prev[`personal_${idx}`] })) : undefined}
                        >
                          <td className="bt-pl-4">
                            <span className="bt-flex-icon">
                              {detail.einzelbuchungen?.length > 0 && (expandedGuvDetails[`personal_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                              {detail.quelle}
                            </span>
                          </td>
                          <td className="right negative">-{formatCurrency(detail.betrag)}</td>
                        </tr>
                        {expandedGuvDetails[`personal_${idx}`] && detail.einzelbuchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row">
                            <td className="bt-cell-sub bt-pl-6">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td>
                            <td className="right bt-cell-sub-right">-{formatCurrency(buch.betrag)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}

                    {/* Depreciation */}
                    <tr className="section-header-row">
                      <td colSpan="2"><strong>4. Abschreibungen</strong></td>
                    </tr>
                    <tr>
                      <td className="bt-pl-2">Abschreibungen auf Sachanlagen</td>
                      <td className="right negative">-{formatCurrency(guvDetails.abschreibungen.gesamt)}</td>
                    </tr>

                    {/* Other Operating Expenses */}
                    <tr className="section-header-row">
                      <td colSpan="2"><strong>5. Sonstige betriebliche Aufwendungen</strong></td>
                    </tr>
                    <tr
                      className={guvDetails.sonstige_aufwendungen.details.length > 0 ? 'clickable' : ''}
                      onClick={() => setExpandedKategorien(prev => ({ ...prev, 'guv_sonstige': !prev['guv_sonstige'] }))}
                    >
                      <td className="bt-pl-2">
                        {guvDetails.sonstige_aufwendungen.details.length > 0 && (expandedKategorien['guv_sonstige'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
                        {' '}Sonstige Aufwendungen
                      </td>
                      <td className="right negative">-{formatCurrency(guvDetails.sonstige_aufwendungen.gesamt)}</td>
                    </tr>
                    {expandedKategorien['guv_sonstige'] && guvDetails.sonstige_aufwendungen.details.map((detail, idx) => (
                      <React.Fragment key={idx}>
                        <tr
                          className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' bt-cursor-pointer' : ''}`}
                          onClick={detail.einzelbuchungen?.length > 0 ? () => setExpandedGuvDetails(prev => ({ ...prev, [`sonstige_${idx}`]: !prev[`sonstige_${idx}`] })) : undefined}
                        >
                          <td className="bt-pl-4">
                            <span className="bt-flex-icon">
                              {detail.einzelbuchungen?.length > 0 && (expandedGuvDetails[`sonstige_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                              {detail.kategorie} ({detail.quelle})
                            </span>
                          </td>
                          <td className="right negative">-{formatCurrency(detail.betrag)}</td>
                        </tr>
                        {expandedGuvDetails[`sonstige_${idx}`] && detail.einzelbuchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row">
                            <td className="bt-cell-sub bt-pl-6">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td>
                            <td className="right bt-cell-sub-right">-{formatCurrency(buch.betrag)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}

                    {/* Result */}
                    <tr className="total-row">
                      <td><strong>Jahresüberschuss / Jahresfehlbetrag</strong></td>
                      <td className={`right ${guvDetails.jahresueberschuss >= 0 ? 'positive' : 'negative'}`}>
                        <strong>{formatCurrency(guvDetails.jahresueberschuss)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== BILANZ TAB ==================== */}
        {activeSubTab === 'bilanz' && (
          <div className="bilanz-content">
            <div className="section-header">
              <h3>Bilanz zum 31.12.{selectedJahr}</h3>
              <div className="header-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => setShowBilanzStammdatenModal(true)}
                >
                  <Edit size={16} />
                  Stammdaten bearbeiten
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => openApiBlob(`/api/buchhaltung/bilanz/export?organisation=${selectedOrg}&jahr=${selectedJahr}&format=csv`, { download: true, filename: `bilanz-${selectedJahr}.csv` })}
                >
                  <Download size={16} />
                  CSV Export
                </button>
              </div>
            </div>

            {loading && <div className="loading">Lade Bilanz-Daten...</div>}

            {!bilanzData && !loading && (
              <div className="message info">
                <AlertCircle size={16} />
                Keine Bilanz-Daten vorhanden. Bitte Stammdaten eingeben.
              </div>
            )}

            {bilanzData && (
              <div className="bilanz-layout">
                {!bilanzData.stammdaten_vorhanden && (
                  <div className="message warning" style={{ marginBottom: '1rem' }}>
                    <AlertCircle size={16} />
                    Stammdaten fehlen noch. Bitte über "Stammdaten bearbeiten" die Eröffnungswerte eingeben.
                  </div>
                )}
                <div className="bilanz-columns">
                  {/* AKTIVA (Left) */}
                  <div className="bilanz-column">
                    <h4>AKTIVA</h4>
                    <table className="bilanz-table">
                      <tbody>
                        {/* A. Anlagevermögen */}
                        <tr className="section-header-row">
                          <td colSpan="2"><strong>A. Anlagevermögen</strong></td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">I. Immaterielle Vermögensgegenstände</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.anlagevermoegen.immat_vermoegensgegenstaende)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">II. Sachanlagen</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.anlagevermoegen.sachanlagen)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">III. Finanzanlagen</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.anlagevermoegen.finanzanlagen)}</td>
                        </tr>
                        <tr className="subtotal-row">
                          <td className="bt-pl-1"><strong>Summe Anlagevermögen</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.aktiva.anlagevermoegen.gesamt)}</strong></td>
                        </tr>

                        {/* B. Umlaufvermögen */}
                        <tr className="section-header-row">
                          <td colSpan="2"><strong>B. Umlaufvermögen</strong></td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">I. Vorräte</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.umlaufvermoegen.vorraete)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">II. Forderungen aus Lieferungen und Leistungen</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.umlaufvermoegen.forderungen_ll)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-3">Sonstige Forderungen</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.umlaufvermoegen.sonstige_forderungen)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">III. Kassenbestand, Bankguthaben</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.umlaufvermoegen.bank_guthaben + bilanzData.aktiva.umlaufvermoegen.kassenbestand)}</td>
                        </tr>
                        <tr className="detail-row">
                          <td className="bt-pl-3">davon Bankguthaben</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.umlaufvermoegen.bank_guthaben)}</td>
                        </tr>
                        <tr className="detail-row">
                          <td className="bt-pl-3">davon Kassenbestand</td>
                          <td className="right">{formatCurrency(bilanzData.aktiva.umlaufvermoegen.kassenbestand)}</td>
                        </tr>
                        <tr className="subtotal-row">
                          <td className="bt-pl-1"><strong>Summe Umlaufvermögen</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.aktiva.umlaufvermoegen.gesamt)}</strong></td>
                        </tr>

                        {/* C. Rechnungsabgrenzungsposten */}
                        {bilanzData.aktiva.rechnungsabgrenzung > 0 && (
                          <tr>
                            <td><strong>C. Aktive Rechnungsabgrenzungsposten</strong></td>
                            <td className="right">{formatCurrency(bilanzData.aktiva.rechnungsabgrenzung)}</td>
                          </tr>
                        )}

                        <tr className="total-row">
                          <td><strong>SUMME AKTIVA</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.aktiva.gesamt)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* PASSIVA (Right) */}
                  <div className="bilanz-column">
                    <h4>PASSIVA</h4>
                    <table className="bilanz-table">
                      <tbody>
                        {/* A. Eigenkapital */}
                        <tr className="section-header-row">
                          <td colSpan="2"><strong>A. Eigenkapital</strong></td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">I. Kapital / Anfangsbestand</td>
                          <td className="right">{formatCurrency(bilanzData.passiva.eigenkapital.anfangsbestand)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">
                            II. Gewinnvortrag aus Vorjahren
                          </td>
                          <td className="right">
                            {editingGewinnvortrag ? (
                              <input
                                type="number"
                                step="0.01"
                                autoFocus
                                className="inline-number-input"
                                defaultValue={bilanzData.passiva.eigenkapital.gewinnvortrag}
                                onBlur={(e) => saveGewinnvortrag(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveGewinnvortrag(e.target.value);
                                  if (e.key === 'Escape') setEditingGewinnvortrag(false);
                                }}
                              />
                            ) : (
                              <span
                                className="inline-edit-value"
                                onClick={() => setEditingGewinnvortrag(true)}
                                title="Klicken zum Bearbeiten"
                              >
                                {formatCurrency(bilanzData.passiva.eigenkapital.gewinnvortrag)}
                                <Edit size={11} className="inline-edit-icon" />
                              </span>
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">III. Jahresüberschuss / -fehlbetrag</td>
                          <td className={`right ${bilanzData.passiva.eigenkapital.jahresueberschuss < 0 ? 'bt-negative' : ''}`}>
                            {formatCurrency(bilanzData.passiva.eigenkapital.jahresueberschuss)}
                          </td>
                        </tr>
                        <tr className="subtotal-row">
                          <td className="bt-pl-1"><strong>Summe Eigenkapital</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.passiva.eigenkapital.gesamt)}</strong></td>
                        </tr>

                        {/* B. Rückstellungen */}
                        <tr className="section-header-row">
                          <td colSpan="2"><strong>B. Rückstellungen</strong></td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">Steuerrückstellungen</td>
                          <td className="right">{formatCurrency(bilanzData.passiva.rueckstellungen.steuerrueckstellungen)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">Sonstige Rückstellungen</td>
                          <td className="right">{formatCurrency(bilanzData.passiva.rueckstellungen.sonstige_rueckstellungen)}</td>
                        </tr>
                        <tr className="subtotal-row">
                          <td className="bt-pl-1"><strong>Summe Rückstellungen</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.passiva.rueckstellungen.gesamt)}</strong></td>
                        </tr>

                        {/* C. Verbindlichkeiten */}
                        <tr className="section-header-row">
                          <td colSpan="2"><strong>C. Verbindlichkeiten</strong></td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">Verbindlichkeiten ggü. Kreditinstituten</td>
                          <td className="right">{formatCurrency(bilanzData.passiva.verbindlichkeiten.darlehen)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">Verbindlichkeiten aus Lieferungen und Leistungen</td>
                          <td className="right">{formatCurrency(bilanzData.passiva.verbindlichkeiten.verbindlichkeiten_lieferanten)}</td>
                        </tr>
                        <tr>
                          <td className="bt-pl-2">Sonstige Verbindlichkeiten</td>
                          <td className="right">{formatCurrency(bilanzData.passiva.verbindlichkeiten.sonstige_verbindlichkeiten)}</td>
                        </tr>
                        <tr className="subtotal-row">
                          <td className="bt-pl-1"><strong>Summe Verbindlichkeiten</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.passiva.verbindlichkeiten.gesamt)}</strong></td>
                        </tr>

                        {/* D. Rechnungsabgrenzungsposten */}
                        {bilanzData.passiva.rechnungsabgrenzung > 0 && (
                          <tr>
                            <td><strong>D. Passive Rechnungsabgrenzungsposten</strong></td>
                            <td className="right">{formatCurrency(bilanzData.passiva.rechnungsabgrenzung)}</td>
                          </tr>
                        )}

                        <tr className="total-row">
                          <td><strong>SUMME PASSIVA</strong></td>
                          <td className="right"><strong>{formatCurrency(bilanzData.passiva.gesamt)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Differenz-Anzeige */}
                <div className={`bilanz-check ${bilanzData.bilanz_ausgeglichen ? 'ausgeglichen' : 'nicht-ausgeglichen'}`}>
                  {bilanzData.bilanz_ausgeglichen ? (
                    <span className="message success">
                      <CheckCircle size={16} />
                      Bilanz ist ausgeglichen.
                    </span>
                  ) : (
                    <span className="message warning">
                      <AlertCircle size={16} />
                      Differenz: {formatCurrency(Math.abs(bilanzData.aktiva.gesamt - bilanzData.passiva.gesamt))} — Aktiva und Passiva stimmen nicht überein. Bitte Stammdaten prüfen.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== BELEGERFASSUNG ==================== */}
        {activeSubTab === 'belege' && (
          <div className="belege-content">
            <div className="belege-header">
              <h3>
                <Receipt size={18} />
                Manuelle Belege
              </h3>
              <button className="btn-primary" onClick={() => { resetBelegForm(); setEditingBeleg(null); setShowBelegModal(true); }}>
                <Plus size={16} />
                Neuer Beleg
              </button>
            </div>

            {/* Belege Tabelle */}
            <div className="belege-table-container">
              <table className="belege-table">
                <thead>
                  <tr>
                    <th>Beleg-Nr.</th>
                    <th>Datum</th>
                    <th>Organisation</th>
                    <th>Typ</th>
                    <th>Kategorie</th>
                    <th>Beschreibung</th>
                    <th className="right">Betrag</th>
                    <th>Status</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {belege.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="no-data">Keine Belege vorhanden</td>
                    </tr>
                  ) : (
                    belege.map(beleg => (
                      <tr key={beleg.beleg_id} className={beleg.storniert ? 'storniert' : ''}>
                        <td>{beleg.beleg_nummer}</td>
                        <td>{formatDate(beleg.beleg_datum)}</td>
                        <td>{beleg.organisation_name}</td>
                        <td>
                          <span className={`typ-badge ${beleg.buchungsart}`}>
                            {beleg.buchungsart === 'einnahme' ? 'Einnahme' : 'Ausgabe'}
                          </span>
                        </td>
                        <td>{getKategorieName(beleg.kategorie)}</td>
                        <td className="beschreibung-cell">{beleg.beschreibung}</td>
                        <td className="right">{formatCurrency(beleg.betrag_brutto)}</td>
                        <td>
                          {beleg.festgeschrieben && (
                            <span className="status-badge festgeschrieben">
                              <Lock size={12} /> Fest
                            </span>
                          )}
                          {beleg.datei_name && (
                            <span className="status-badge datei">
                              <FileText size={12} />
                            </span>
                          )}
                        </td>
                        <td className="actions">
                          {!beleg.festgeschrieben && (
                            <>
                              <button className="btn-icon" title="Bearbeiten" onClick={() => editBeleg(beleg)}>
                                <Edit size={14} />
                              </button>
                              <button className="btn-icon" title="Datei hochladen" onClick={() => { setUploadBelegId(beleg.beleg_id); setShowUploadModal(true); }}>
                                <Upload size={14} />
                              </button>
                              <button className="btn-icon" title="Festschreiben" onClick={() => festschreibenBeleg(beleg.beleg_id)}>
                                <Lock size={14} />
                              </button>
                              <button className="btn-icon danger" title="Stornieren" onClick={() => stornoBeleg(beleg.beleg_id)}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                          {beleg.datei_name && (
                            <a
                              href={`/api/buchhaltung/belege/${beleg.beleg_id}/datei`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-icon"
                              title="Datei anzeigen"
                            >
                              <FileText size={14} />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {belegeTotal > belegeLimit && (
              <div className="pagination">
                <button
                  disabled={belegePage === 1}
                  onClick={() => setBelegePage(p => Math.max(1, p - 1))}
                >
                  Zurück
                </button>
                <span>Seite {belegePage} von {Math.ceil(belegeTotal / belegeLimit)}</span>
                <button
                  disabled={belegePage >= Math.ceil(belegeTotal / belegeLimit)}
                  onClick={() => setBelegePage(p => p + 1)}
                >
                  Weiter
                </button>
              </div>
            )}
          </div>
        )}

        {/* ==================== RECHNUNGEN ERSTELLEN ==================== */}
        {activeSubTab === 'rechnungen' && (
          <div className="rechnungen-content">
            <VerbandRechnungErstellen token={token} />
          </div>
        )}

        {/* ==================== AUTOMATISCHE BUCHUNGEN ==================== */}
        {activeSubTab === 'auto' && (
          <div className="auto-content">
            <div className="auto-header">
              <h3>
                <RefreshCw size={18} />
                Automatisch erfasste Einnahmen
              </h3>
              <p className="auto-info">
                Diese Einnahmen werden automatisch aus Rechnungen, Verkäufen, Mitgliedsbeiträgen
                und Verbandsbeiträgen übernommen.
              </p>
            </div>

            <div className="auto-table-container">
              <table className="auto-table">
                <thead>
                  <tr>
                    <th>Quelle</th>
                    <th>Datum</th>
                    <th>Organisation</th>
                    <th>Beschreibung</th>
                    <th className="right">Betrag</th>
                  </tr>
                </thead>
                <tbody>
                  {autoEinnahmen.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="no-data">Keine automatischen Einnahmen gefunden</td>
                    </tr>
                  ) : (
                    autoEinnahmen.map((e, idx) => (
                      <tr key={idx}>
                        <td>
                          <span className={`quelle-badge ${e.quelle}`}>
                            {e.quelle === 'rechnung' && 'Rechnung'}
                            {e.quelle === 'verkauf' && 'Verkauf'}
                            {e.quelle === 'beitrag' && 'Mitgliedsbeitrag'}
                            {e.quelle === 'verbandsbeitrag' && 'Verbandsbeitrag'}
                            {e.quelle === 'beleg' && 'Beleg'}
                          </span>
                        </td>
                        <td>{formatDate(e.datum)}</td>
                        <td>{e.organisation_name}</td>
                        <td>{e.beschreibung}</td>
                        <td className="right">{formatCurrency(e.betrag_brutto)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ==================== BANK-IMPORT ==================== */}
        {activeSubTab === 'bankimport' && !hasKontoauszug && (
          <div className="enterprise-locked-view">
            <div className="enterprise-locked-icon"><Landmark size={48} /></div>
            <h3>Kontoauszug-Import</h3>
            <p>Importieren Sie Kontoauszüge direkt aus Ihrem Online-Banking und ordnen Sie Transaktionen automatisch zu.</p>
            <ul className="enterprise-feature-list">
              <li><Check size={14} /> Alle deutschen Banken (Sparkasse, Volksbank, DKB, ING, Comdirect, N26, Deutsche Bank, Postbank)</li>
              <li><Check size={14} /> Formate: CSV, XLSX, MT940/STA</li>
              <li><Check size={14} /> Auto-Kategorisierung per Keyword-Erkennung</li>
              <li><Check size={14} /> Duplikaterkennung & Rechnungsabgleich</li>
              <li><Check size={14} /> Direkte EÜR-Übertragung</li>
            </ul>
            <div className="enterprise-badge-large">
              <Star size={16} /> Enterprise-Feature — Upgrade erforderlich
            </div>
          </div>
        )}
        {activeSubTab === 'bankimport' && hasKontoauszug && (
          <div className="bankimport-content">
            {/* Statistik-Karten */}
            {bankStatistik && (
              <div className="bank-stats-cards">
                <div className="bank-stat-card">
                  <span className="stat-value">{bankStatistik.unzugeordnet || 0}</span>
                  <span className="stat-label">Unzugeordnet</span>
                </div>
                <div className="bank-stat-card vorschlag">
                  <span className="stat-value">{bankStatistik.vorgeschlagen || 0}</span>
                  <span className="stat-label">Mit Vorschlag</span>
                </div>
                <div className="bank-stat-card zugeordnet">
                  <span className="stat-value">{bankStatistik.zugeordnet || 0}</span>
                  <span className="stat-label">Zugeordnet</span>
                </div>
                <div className="bank-stat-card ignoriert">
                  <span className="stat-value">{bankStatistik.ignoriert || 0}</span>
                  <span className="stat-label">Ignoriert</span>
                </div>
              </div>
            )}

            {/* Header mit Upload-Button */}
            <div className="bank-header">
              <div className="bank-header-left">
                <h3>
                  <Landmark size={18} />
                  Bank-Transaktionen
                </h3>
                <div className="bank-filter">
                  <select
                    value={bankStatusFilter}
                    onChange={(e) => { setBankStatusFilter(e.target.value); setBankPage(1); }}
                  >
                    <option value="">Alle Status</option>
                    <option value="unzugeordnet">Unzugeordnet</option>
                    <option value="vorgeschlagen">Mit Vorschlag</option>
                    <option value="zugeordnet">Zugeordnet</option>
                    <option value="ignoriert">Ignoriert</option>
                  </select>
                  <select
                    value={bankBetragFilter}
                    onChange={(e) => setBankBetragFilter(e.target.value)}
                  >
                    <option value="">Alle Buchungen</option>
                    <option value="einnahmen">Nur Einnahmen</option>
                    <option value="ausgaben">Nur Ausgaben</option>
                  </select>
                  <select
                    value={bankKategorieFilter}
                    onChange={(e) => setBankKategorieFilter(e.target.value)}
                  >
                    <option value="">Alle Kategorien</option>
                    {kategorien.map(k => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                  {bankKategorieFilter && (
                    <button
                      className="btn-small"
                      onClick={() => setBankKategorieFilter('')}
                      title="Filter zurücksetzen"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="bank-datum-filter">
                  <Calendar size={14} />
                  <input
                    type="date"
                    title="Von Datum"
                    value={bankDatumVon}
                    onChange={(e) => setBankDatumVon(e.target.value)}
                  />
                  <span className="datum-separator">–</span>
                  <input
                    type="date"
                    title="Bis Datum"
                    value={bankDatumBis}
                    onChange={(e) => setBankDatumBis(e.target.value)}
                  />
                  {(bankDatumVon || bankDatumBis) && (
                    <button className="search-clear" onClick={() => { setBankDatumVon(''); setBankDatumBis(''); }} title="Datumsfilter zurücksetzen">
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className="bank-search">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Suchen..."
                    value={bankSearchTerm}
                    onChange={(e) => setBankSearchTerm(e.target.value)}
                  />
                  {bankSearchTerm && (
                    <button className="search-clear" onClick={() => setBankSearchTerm('')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
              <button className="btn-primary" onClick={() => setShowBankUploadModal(true)}>
                <FileUp size={16} />
                Kontoauszug importieren
              </button>
            </div>

            {/* Batch-Aktionen */}
            {selectedBankTxIds.length > 0 && (
              <div className="bank-batch-actions">
                <span>{selectedBankTxIds.length} ausgewählt</span>
                <div className="batch-buttons">
                  <button
                    className="btn-primary"
                    onClick={() => { setAehnlicheAnzahl(0); setShowKategorieModal(true); }}
                  >
                    Kategorie zuordnen
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setSelectedBankTxIds([])}
                  >
                    Auswahl aufheben
                  </button>
                </div>
              </div>
            )}

            {/* Transaktions-Tabelle */}
            <div className="bank-table-container">
              <table className="bank-table">
                <thead>
                  <tr>
                    <th className="checkbox-col">
                      <input
                        type="checkbox"
                        checked={selectedBankTxIds.length > 0 &&
                          selectedBankTxIds.length === getFilteredSortedTransaktionen().filter(tx =>
                            tx.status !== 'zugeordnet' && tx.status !== 'ignoriert'
                          ).length}
                        onChange={toggleAllBankTx}
                      />
                    </th>
                    <th className="sortable" onClick={() => toggleBankSort('buchungsdatum')}>
                      Datum
                      {bankSortField === 'buchungsdatum' && (
                        bankSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </th>
                    <th className="sortable" onClick={() => toggleBankSort('organisation_name')}>
                      Organisation
                      {bankSortField === 'organisation_name' && (
                        bankSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </th>
                    <th className="betrag-col sortable" onClick={() => toggleBankSort('betrag')}>
                      Betrag
                      {bankSortField === 'betrag' && (
                        bankSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </th>
                    <th className="sortable" onClick={() => toggleBankSort('auftraggeber_empfaenger')}>
                      Auftraggeber/Empfänger
                      {bankSortField === 'auftraggeber_empfaenger' && (
                        bankSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </th>
                    <th className="sortable" onClick={() => toggleBankSort('verwendungszweck')}>
                      Verwendungszweck
                      {bankSortField === 'verwendungszweck' && (
                        bankSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </th>
                    <th className="sortable" onClick={() => toggleBankSort('status')}>
                      Status
                      {bankSortField === 'status' && (
                        bankSortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      )}
                    </th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {getFilteredSortedTransaktionen().length === 0 ? (
                    <tr>
                      <td colSpan="8" className="no-data">
                        {bankSearchTerm ? 'Keine Treffer für die Suche.' : 'Keine Transaktionen gefunden. Importieren Sie einen Kontoauszug.'}
                      </td>
                    </tr>
                  ) : (
                    getFilteredSortedTransaktionen().map(tx => (
                      <React.Fragment key={tx.transaktion_id}>
                        <tr className={`bank-row ${tx.status}`}>
                          <td className="checkbox-col">
                            {tx.status !== 'zugeordnet' && tx.status !== 'ignoriert' && (
                              <input
                                type="checkbox"
                                checked={selectedBankTxIds.includes(tx.transaktion_id)}
                                onChange={() => toggleBankTxSelection(tx.transaktion_id)}
                              />
                            )}
                          </td>
                          <td>{formatDate(tx.buchungsdatum)}</td>
                          <td className="organisation-col">{tx.organisation_name || '-'}</td>
                          <td className={`betrag-col ${tx.betrag >= 0 ? 'einnahme' : 'ausgabe'}`}>
                            {formatCurrency(tx.betrag)}
                          </td>
                          <td className="auftraggeber-col">{tx.auftraggeber_empfaenger}</td>
                          <td className="verwendungszweck-col">{tx.verwendungszweck}</td>
                          <td>
                            <span className={`bank-status-badge ${tx.status}`}>
                              {tx.status === 'unzugeordnet' && 'Offen'}
                              {tx.status === 'vorgeschlagen' && 'Vorschlag'}
                              {tx.status === 'zugeordnet' && 'Zugeordnet'}
                              {tx.status === 'ignoriert' && 'Ignoriert'}
                            </span>
                          </td>
                          <td className="actions">
                            {tx.status === 'vorgeschlagen' && (
                              <>
                                <button
                                  className="btn-icon success"
                                  title="Vorschlag annehmen"
                                  onClick={() => vorschlagAnnehmen(tx.transaktion_id)}
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  className="btn-icon"
                                  title="Andere Kategorie wählen"
                                  onClick={() => { setSelectedBankTx(tx); setShowKategorieModal(true); ladeAehnliche(tx.transaktion_id); }}
                                >
                                  <Edit size={14} />
                                </button>
                              </>
                            )}
                            {tx.status === 'unzugeordnet' && (
                              <button
                                className="btn-icon"
                                title="Kategorie zuordnen"
                                onClick={() => { setSelectedBankTx(tx); setShowKategorieModal(true); ladeAehnliche(tx.transaktion_id); }}
                              >
                                <Plus size={14} />
                              </button>
                            )}
                            {tx.status === 'unzugeordnet' && tx.betrag > 0 && (
                              <button
                                className="btn-icon rechnung"
                                title="Mit Rechnung verknüpfen"
                                onClick={() => { setRechnungTx(tx); loadOffeneRechnungen(); setShowRechnungModal(true); }}
                              >
                                <FileText size={14} />
                              </button>
                            )}
                            {(tx.status === 'unzugeordnet' || tx.status === 'vorgeschlagen') && (
                              <button
                                className="btn-icon danger"
                                title="Ignorieren"
                                onClick={() => ignorierenTransaktion(tx.transaktion_id)}
                              >
                                <XCircle size={14} />
                              </button>
                            )}
                            {tx.status !== 'zugeordnet' && (
                              <button
                                className="btn-icon danger"
                                title="Transaktion löschen"
                                onClick={() => deleteTransaktion(tx.transaktion_id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                            {tx.status === 'zugeordnet' && (
                              <button
                                className="btn-icon"
                                title="Kategorie ändern (Umbuchung)"
                                onClick={() => { setUmbuchungTx(tx); setShowUmbuchungModal(true); }}
                              >
                                <Edit size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* Vorschlag-Zeile */}
                        {tx.status === 'vorgeschlagen' && tx.match_details && (
                          <tr className="vorschlag-row">
                            <td></td>
                            <td colSpan="6" className="vorschlag-info">
                              <Lightbulb size={14} />
                              <span>
                                {tx.match_typ === 'beitrag' && `Beitrag: ${tx.match_details.name} (${tx.match_details.monat}/${tx.match_details.jahr})`}
                                {tx.match_typ === 'rechnung' && `Rechnung: ${tx.match_details.rechnungsnummer} - ${tx.match_details.name}`}
                                {tx.match_typ === 'manuell' && `Kategorie: ${getKategorieName(tx.match_details.kategorie)}`}
                              </span>
                              <span className="confidence">
                                ({Math.round((tx.match_confidence || 0) * 100)}% Sicherheit)
                              </span>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {bankTransaktionenTotal > 30 && (
              <div className="pagination">
                {bankLimit !== 0 && (
                  <>
                    <button
                      disabled={bankPage === 1}
                      onClick={() => setBankPage(p => Math.max(1, p - 1))}
                    >
                      Zurück
                    </button>
                    <span>Seite {bankPage} von {Math.ceil(bankTransaktionenTotal / bankLimit)}</span>
                    <button
                      disabled={bankPage >= Math.ceil(bankTransaktionenTotal / bankLimit)}
                      onClick={() => setBankPage(p => p + 1)}
                    >
                      Weiter
                    </button>
                  </>
                )}
                <button
                  className={bankLimit === 0 ? 'btn-active' : ''}
                  onClick={() => {
                    if (bankLimit === 0) {
                      setBankLimit(30);
                      setBankPage(1);
                    } else {
                      setBankLimit(0);
                    }
                  }}
                >
                  {bankLimit === 0 ? 'Seiten anzeigen' : 'Alle anzeigen'}
                </button>
                {bankLimit === 0 && (
                  <span>{bankTransaktionenTotal} Transaktionen</span>
                )}
              </div>
            )}

            {/* Import-Historie */}
            {bankImportHistorie.length > 0 && (
              <div className="bank-historie">
                <h4>
                  <History size={16} />
                  Letzte Imports
                </h4>
                <table className="historie-table">
                  <thead>
                    <tr>
                      <th>Datei</th>
                      <th>Organisation</th>
                      <th>Bank</th>
                      <th>Transaktionen</th>
                      <th>Importiert am</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankImportHistorie.map((h, idx) => (
                      <tr key={idx}>
                        <td>{h.datei_name}</td>
                        <td>{h.organisation_name || '-'}</td>
                        <td>{h.bank_name}</td>
                        <td>{h.anzahl_transaktionen}</td>
                        <td>{formatDate(h.importiert_am)}</td>
                        <td>
                          <button
                            className="btn-icon danger"
                            title="Import löschen"
                            onClick={() => deleteImport(h.import_id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== STEUERAUSWERTUNG ==================== */}
        {activeSubTab === 'steuerauswertung' && !hasKontoauszug && (
          <div className="enterprise-locked-view">
            <div className="enterprise-locked-icon"><BarChart3 size={48} /></div>
            <h3>Steuerauswertung</h3>
            <p>Analysiert automatisch Ihre importierten Kontoauszüge und bereitet die Daten für EÜR und Bilanz auf.</p>
            <ul className="enterprise-feature-list">
              <li><Check size={14} /> Betriebseinnahmen & -ausgaben automatisch erkannt</li>
              <li><Check size={14} /> Gewinn-/Verlust-Vorschau</li>
              <li><Check size={14} /> Ein-Klick-Übertragung in EÜR</li>
              <li><Check size={14} /> Nicht kategorisierte Buchungen im Blick</li>
            </ul>
            <div className="enterprise-badge-large">
              <Star size={16} /> Enterprise-Feature — Upgrade erforderlich
            </div>
          </div>
        )}
        {activeSubTab === 'steuerauswertung' && hasKontoauszug && (
          <div className="steuerauswertung-content">
            <div className="steuer-header">
              <div>
                <h3><BarChart3 size={18} /> Steuerauswertung {selectedJahr}</h3>
                <p className="steuer-subtitle">Auswertung aller importierten Kontoauszüge</p>
              </div>
              <div className="steuer-actions">
                <button
                  className="btn-secondary"
                  onClick={() => euerUebertragen(true)}
                  disabled={steuerUebertragenLoading}
                >
                  <AlertCircle size={14} /> Vorschau
                </button>
                <button
                  className="btn-primary"
                  onClick={() => euerUebertragen(false)}
                  disabled={steuerUebertragenLoading}
                >
                  {steuerUebertragenLoading ? 'Übertrage...' : <><ArrowUpRight size={14} /> In EÜR übertragen</>}
                </button>
              </div>
            </div>

            {steuerLoading && <div className="loading-spinner">Lade Auswertung...</div>}

            {steuerauswertung && !steuerLoading && (
              <>
                {/* Kennzahlen-Karten */}
                <div className="steuer-kpi-grid">
                  <div className="steuer-kpi steuer-kpi--einnahmen">
                    <div className="kpi-label">Betriebseinnahmen</div>
                    <div className="kpi-value">{formatCurrency(steuerauswertung.auswertung.summe_einnahmen)}</div>
                    <div className="kpi-sub">{steuerauswertung.auswertung.betriebseinnahmen.length} Kategorien</div>
                  </div>
                  <div className="steuer-kpi steuer-kpi--ausgaben">
                    <div className="kpi-label">Betriebsausgaben</div>
                    <div className="kpi-value">{formatCurrency(steuerauswertung.auswertung.summe_ausgaben)}</div>
                    <div className="kpi-sub">{steuerauswertung.auswertung.betriebsausgaben.length} Kategorien</div>
                  </div>
                  <div className={`steuer-kpi ${steuerauswertung.auswertung.gewinn >= 0 ? 'steuer-kpi--gewinn' : 'steuer-kpi--verlust'}`}>
                    <div className="kpi-label">{steuerauswertung.auswertung.gewinn >= 0 ? 'Gewinn' : 'Verlust'}</div>
                    <div className="kpi-value">{formatCurrency(Math.abs(steuerauswertung.auswertung.gewinn))}</div>
                    <div className="kpi-sub">vor Steuern</div>
                  </div>
                  {steuerauswertung.auswertung.nicht_kategorisiert.anzahl > 0 && (
                    <div className="steuer-kpi steuer-kpi--warnung">
                      <div className="kpi-label">Nicht kategorisiert</div>
                      <div className="kpi-value">{steuerauswertung.auswertung.nicht_kategorisiert.anzahl}</div>
                      <div className="kpi-sub">{formatCurrency(steuerauswertung.auswertung.nicht_kategorisiert.summe)}</div>
                    </div>
                  )}
                </div>

                {/* Einnahmen nach Kategorien */}
                {steuerauswertung.auswertung.betriebseinnahmen.length > 0 && (
                  <div className="steuer-section">
                    <h4><TrendingUp size={16} /> Betriebseinnahmen nach Kategorie</h4>
                    <table className="steuer-table">
                      <thead>
                        <tr><th>Kategorie</th><th>Anzahl</th><th className="right">Summe</th></tr>
                      </thead>
                      <tbody>
                        {steuerauswertung.auswertung.betriebseinnahmen.map((e, i) => (
                          <tr key={i}>
                            <td>{e.kategorie}</td>
                            <td>{e.anzahl}</td>
                            <td className="right einnahme-betrag">{formatCurrency(e.summe)}</td>
                          </tr>
                        ))}
                        <tr className="summen-zeile">
                          <td><strong>Gesamt</strong></td>
                          <td></td>
                          <td className="right"><strong>{formatCurrency(steuerauswertung.auswertung.summe_einnahmen)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Ausgaben nach Kategorien */}
                {steuerauswertung.auswertung.betriebsausgaben.length > 0 && (
                  <div className="steuer-section">
                    <h4><TrendingDown size={16} /> Betriebsausgaben nach Kategorie</h4>
                    <table className="steuer-table">
                      <thead>
                        <tr><th>Kategorie</th><th>EÜR-Typ</th><th>Anzahl</th><th className="right">Summe</th></tr>
                      </thead>
                      <tbody>
                        {steuerauswertung.auswertung.betriebsausgaben.map((a, i) => (
                          <tr key={i}>
                            <td>{a.kategorie}</td>
                            <td><span className="euer-typ-badge">{a.euer_typ || '—'}</span></td>
                            <td>{a.anzahl}</td>
                            <td className="right ausgabe-betrag">{formatCurrency(a.summe)}</td>
                          </tr>
                        ))}
                        <tr className="summen-zeile">
                          <td><strong>Gesamt</strong></td>
                          <td></td>
                          <td></td>
                          <td className="right"><strong>{formatCurrency(steuerauswertung.auswertung.summe_ausgaben)}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Cashflow-Chart (CSS-Balkendiagramm) */}
                {cashflow && cashflow.monate.length > 0 && (
                  <div className="steuer-section">
                    <h4><TrendingUp size={16} /> Monatlicher Cashflow {selectedJahr}</h4>
                    <div className="cashflow-chart">
                      {(() => {
                        const maxVal = Math.max(...cashflow.monate.map(m => Math.max(m.einnahmen, m.ausgaben)), 1);
                        return cashflow.monate.map((m, i) => (
                          <div key={i} className="cashflow-month">
                            <div className="cashflow-bars">
                              <div className="cashflow-bar cashflow-bar--ein"
                                style={{ height: `${(m.einnahmen / maxVal) * 100}%` }}
                                title={`Einnahmen: ${formatCurrency(m.einnahmen)}`} />
                              <div className="cashflow-bar cashflow-bar--aus"
                                style={{ height: `${(m.ausgaben / maxVal) * 100}%` }}
                                title={`Ausgaben: ${formatCurrency(m.ausgaben)}`} />
                            </div>
                            <div className="cashflow-label">{m.label}</div>
                          </div>
                        ));
                      })()}
                    </div>
                    <div className="cashflow-legend">
                      <span className="legend-ein">■ Einnahmen</span>
                      <span className="legend-aus">■ Ausgaben</span>
                    </div>
                  </div>
                )}

                {/* Abgleich-Status: Was ist neu, was ist schon in EÜR */}
                {cashflow && cashflow.abgleich_status.length > 0 && (
                  <div className="steuer-section">
                    <h4><CheckCircle size={16} /> Abgleich-Status — Doppelzählung vermeiden</h4>
                    <div className="abgleich-status-grid">
                      {cashflow.abgleich_status.map((s, i) => (
                        <div key={i} className={`abgleich-kpi abgleich-kpi--${s.gruppe === 'Bereits in EÜR' ? 'ok' : s.gruppe === 'Ignoriert' ? 'grau' : s.gruppe === 'Nicht zugeordnet' ? 'warn' : 'info'}`}>
                          <div className="kpi-label">{s.gruppe}</div>
                          <div className="kpi-value">{s.anzahl}</div>
                          <div className="kpi-sub">{formatCurrency(s.summe)}</div>
                        </div>
                      ))}
                    </div>
                    <p className="abgleich-hinweis">
                      <AlertCircle size={12} /> Transaktionen die auf <strong>Rechnung, Beitrag oder Verkauf</strong> gemappt sind, werden bei der EÜR-Übertragung automatisch übersprungen — sie sind bereits via ihre Quelltabelle in der EÜR enthalten.
                    </p>
                  </div>
                )}

                {/* Abgleich-Detailtabelle */}
                {abgleichBericht && (
                  <div className="steuer-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0 }}><FileText size={16} /> Transaktionsdetails</h4>
                      <div className="abgleich-filter-row">
                        {['alle', 'neu_kategorisiert', 'bereits_erfasst', 'offen'].map(f => (
                          <button key={f}
                            className={`filter-chip ${abgleichFilter === f ? 'active' : ''}`}
                            onClick={() => setAbgleichFilter(f)}>
                            {f === 'alle' ? 'Alle' : f === 'neu_kategorisiert' ? 'Neu' : f === 'bereits_erfasst' ? 'Bereits in EÜR' : 'Offen'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="abgleich-table-wrap">
                      <table className="steuer-table">
                        <thead>
                          <tr>
                            <th>Datum</th>
                            <th>Auftraggeber / Empfänger</th>
                            <th>Verwendungszweck</th>
                            <th>Kategorie</th>
                            <th>EÜR-Status</th>
                            <th className="right">Betrag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {abgleichBericht.transaktionen
                            .filter(t => abgleichFilter === 'alle' || t.abgleich_typ === abgleichFilter)
                            .slice(0, 50)
                            .map((t, i) => (
                            <tr key={i} className={`abgleich-row abgleich-row--${t.abgleich_typ}`}>
                              <td>{t.buchungsdatum?.substring(0, 10)}</td>
                              <td className="abgleich-auftraggeber">{t.auftraggeber_empfaenger}</td>
                              <td className="abgleich-zweck">{t.verwendungszweck?.substring(0, 60)}</td>
                              <td>{t.kategorie || '—'}</td>
                              <td>
                                <span className={`abgleich-badge abgleich-badge--${t.abgleich_typ}`}>
                                  {t.abgleich_typ === 'bereits_erfasst' ? <CheckCircle size={10} /> : t.abgleich_typ === 'ignoriert' ? <XCircle size={10} /> : t.abgleich_typ === 'neu_kategorisiert' ? <Check size={10} /> : <AlertCircle size={10} />}
                                  {t.abgleich_typ === 'bereits_erfasst' ? 'In EÜR' : t.abgleich_typ === 'ignoriert' ? 'Ignoriert' : t.abgleich_typ === 'neu_kategorisiert' ? 'Neu' : 'Offen'}
                                </span>
                              </td>
                              <td className={`right ${parseFloat(t.betrag) >= 0 ? 'einnahme-betrag' : 'ausgabe-betrag'}`}>
                                {formatCurrency(Math.abs(parseFloat(t.betrag)))}
                              </td>
                            </tr>
                          ))}
                          {abgleichBericht.transaktionen.filter(t => abgleichFilter === 'alle' || t.abgleich_typ === abgleichFilter).length === 0 && (
                            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Keine Transaktionen in diesem Filter</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {steuerauswertung.transaktionen_gesamt === 0 && (
                  <div className="steuer-empty">
                    <BarChart3 size={32} />
                    <p>Noch keine kategorisierten Transaktionen für {selectedJahr}.</p>
                    <p>Importieren Sie zuerst Kontoauszüge im Tab <strong>Kontoauszüge</strong>.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ==================== JAHRESABSCHLUSS ==================== */}
        {activeSubTab === 'abschluss' && (
          <div className="abschluss-content">
            <div className="abschluss-header">
              <h3>
                <FileSpreadsheet size={18} />
                Jahresabschluss {selectedJahr}
              </h3>
              <div className="abschluss-actions">
                <button className="btn-secondary" onClick={exportCSV}>
                  <Download size={16} />
                  CSV Export
                </button>
                {selectedOrg !== 'alle' && (!abschlussData?.abschluss || abschlussData.abschluss.status !== 'abgeschlossen') && (
                  <button className="btn-primary" onClick={() => setShowAbschlussModal(true)}>
                    <Lock size={16} />
                    Jahr festschreiben
                  </button>
                )}
              </div>
            </div>

            {abschlussData?.abschluss && (
              <div className={`abschluss-status ${abschlussData.abschluss.status}`}>
                <CheckCircle size={16} />
                Status: {abschlussData.abschluss.status}
                {abschlussData.abschluss.abgeschlossen_am && (
                  <span> - Festgeschrieben am {formatDate(abschlussData.abschluss.abgeschlossen_am)}</span>
                )}
              </div>
            )}

            {abschlussData?.berechnet && (
              <div className="abschluss-summary">
                <div className="summary-section">
                  <h4>Einnahmen nach Kategorie</h4>
                  <table className="summary-table">
                    <tbody>
                      {Object.entries(abschlussData.berechnet.einnahmen.details).map(([kat, summe]) => (
                        <tr key={kat}>
                          <td>{getKategorieName(kat)}</td>
                          <td className="right">{formatCurrency(summe)}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td><strong>Gesamt Einnahmen</strong></td>
                        <td className="right"><strong>{formatCurrency(abschlussData.berechnet.einnahmen.gesamt)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="summary-section">
                  <h4>Ausgaben nach Kategorie</h4>
                  <table className="summary-table">
                    <tbody>
                      {Object.entries(abschlussData.berechnet.ausgaben.details).map(([kat, summe]) => (
                        <tr key={kat}>
                          <td>{getKategorieName(kat)}</td>
                          <td className="right">{formatCurrency(summe)}</td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td><strong>Gesamt Ausgaben</strong></td>
                        <td className="right"><strong>{formatCurrency(abschlussData.berechnet.ausgaben.gesamt)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className={`abschluss-ergebnis ${abschlussData.berechnet.gewinnVerlust >= 0 ? 'positiv' : 'negativ'}`}>
                  <span>Jahresergebnis:</span>
                  <span className="ergebnis-wert">{formatCurrency(abschlussData.berechnet.gewinnVerlust)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== BELEG MODAL ==================== */}
      {showBelegModal && (
        <div className="modal-overlay" onClick={() => setShowBelegModal(false)}>
          <div className="modal beleg-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingBeleg ? 'Beleg bearbeiten' : 'Neuer Beleg'}</h3>
              <button className="close-btn" onClick={() => setShowBelegModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Organisation *</label>
                  <select
                    value={belegForm.organisation_name}
                    onChange={e => setBelegForm(f => ({ ...f, organisation_name: e.target.value }))}
                  >
                    <option value="TDA International">TDA International</option>
                    <option value="Kampfkunstschule Schreiner">Kampfkunstschule Schreiner</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Buchungsart *</label>
                  <select
                    value={belegForm.buchungsart}
                    onChange={e => setBelegForm(f => ({ ...f, buchungsart: e.target.value }))}
                  >
                    <option value="ausgabe">Ausgabe</option>
                    <option value="einnahme">Einnahme</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Belegdatum *</label>
                  <input
                    type="date"
                    value={belegForm.beleg_datum}
                    onChange={e => setBelegForm(f => ({ ...f, beleg_datum: e.target.value }))}
                  />
                </div>

                <div className="form-group">
                  <label>Buchungsdatum *</label>
                  <input
                    type="date"
                    value={belegForm.buchungsdatum}
                    onChange={e => setBelegForm(f => ({ ...f, buchungsdatum: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Betrag Netto (EUR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={belegForm.betrag_netto}
                    onChange={e => setBelegForm(f => ({ ...f, betrag_netto: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>

                <div className="form-group">
                  <label>MwSt-Satz (%)</label>
                  <select
                    value={belegForm.mwst_satz}
                    onChange={e => setBelegForm(f => ({ ...f, mwst_satz: e.target.value }))}
                  >
                    <option value="19">19%</option>
                    <option value="7">7%</option>
                    <option value="0">0% (steuerfrei)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Kategorie *</label>
                <select
                  value={belegForm.kategorie}
                  onChange={e => setBelegForm(f => ({ ...f, kategorie: e.target.value }))}
                >
                  {kategorien
                    .filter(k => belegForm.buchungsart === 'einnahme' ? k.typ === 'einnahme' : k.typ === 'ausgabe')
                    .map(k => (
                      <option key={k.id} value={k.id}>{k.name} - {k.beschreibung}</option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label>Beschreibung *</label>
                <textarea
                  value={belegForm.beschreibung}
                  onChange={e => setBelegForm(f => ({ ...f, beschreibung: e.target.value }))}
                  placeholder="Beschreibung des Belegs..."
                  rows="3"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Lieferant / Kunde</label>
                  <input
                    type="text"
                    value={belegForm.lieferant_kunde}
                    onChange={e => setBelegForm(f => ({ ...f, lieferant_kunde: e.target.value }))}
                    placeholder="Name des Lieferanten/Kunden"
                  />
                </div>

                <div className="form-group">
                  <label>Externe Rechnungsnummer</label>
                  <input
                    type="text"
                    value={belegForm.rechnungsnummer_extern}
                    onChange={e => setBelegForm(f => ({ ...f, rechnungsnummer_extern: e.target.value }))}
                    placeholder="z.B. RE-2024-001"
                  />
                </div>
              </div>

              {/* Brutto Vorschau */}
              <div className="brutto-preview">
                <span>Brutto-Betrag:</span>
                <span className="brutto-wert">
                  {formatCurrency(
                    parseFloat(belegForm.betrag_netto || 0) *
                    (1 + parseFloat(belegForm.mwst_satz || 0) / 100)
                  )}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowBelegModal(false)}>
                Abbrechen
              </button>
              <button
                className="btn-primary"
                onClick={saveBeleg}
                disabled={loading || !belegForm.betrag_netto || !belegForm.beschreibung}
              >
                {loading ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== UPLOAD MODAL ==================== */}
      {showUploadModal && (
        <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="modal upload-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Beleg-Datei hochladen</h3>
              <button className="close-btn" onClick={() => setShowUploadModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="upload-info">
                <Upload size={48} />
                <p>Erlaubte Formate: PDF, JPG, PNG (max. 10MB)</p>
              </div>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={uploadDatei}
              />
            </div>
          </div>
        </div>
      )}

      {/* ==================== ABSCHLUSS MODAL ==================== */}
      {showAbschlussModal && (
        <div className="modal-overlay" onClick={() => setShowAbschlussModal(false)}>
          <div className="modal abschluss-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Jahr {selectedJahr} festschreiben</h3>
              <button className="close-btn" onClick={() => setShowAbschlussModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="warning-box">
                <AlertCircle size={24} />
                <div>
                  <strong>Achtung!</strong>
                  <p>
                    Nach dem Festschreiben können keine Änderungen mehr an den Belegen
                    des Jahres {selectedJahr} für {selectedOrg} vorgenommen werden.
                    Diese Aktion kann nicht rückgängig gemacht werden.
                  </p>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAbschlussModal(false)}>
                Abbrechen
              </button>
              <button className="btn-danger" onClick={festschreibenJahr} disabled={loading}>
                {loading ? 'Wird festgeschrieben...' : 'Endgültig festschreiben'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BANK UPLOAD MODAL ==================== */}
      {showBankUploadModal && (
        <div className="modal-overlay" onClick={() => setShowBankUploadModal(false)}>
          <div className="modal bank-upload-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Kontoauszug importieren</h3>
              <button className="close-btn" onClick={() => setShowBankUploadModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>Organisation *</label>
                <select
                  value={bankUploadOrg}
                  onChange={e => setBankUploadOrg(e.target.value)}
                >
                  <option value="Kampfkunstschule Schreiner">Kampfkunstschule Schreiner</option>
                  <option value="TDA International">TDA International</option>
                </select>
              </div>

              <div className="upload-area">
                <div className="upload-info">
                  <FileUp size={48} />
                  <p>Kontoauszug hochladen</p>
                  <p className="upload-hint">
                    CSV, XLS, XLSX, MT940 (STA) oder PDF
                  </p>
                </div>
                <input
                  type="file"
                  accept=".csv,.sta,.mt940,.txt,.xls,.xlsx,.pdf,application/pdf"
                  onChange={(e) => setBankUploadFile(e.target.files[0])}
                />
                {bankUploadFile && (
                  <div className="selected-file">
                    <FileText size={16} />
                    {bankUploadFile.name}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowBankUploadModal(false); setBankUploadFile(null); }}>
                Abbrechen
              </button>
              <button
                className="btn-primary"
                onClick={uploadBankFile}
                disabled={!bankUploadFile || bankUploading}
              >
                {bankUploading ? 'Wird importiert...' : 'Importieren'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== KATEGORIE MODAL ==================== */}
      {showKategorieModal && (selectedBankTx || selectedBankTxIds.length > 0) && (
        <div className="modal-overlay kategorie-overlay" onClick={() => setShowKategorieModal(false)}>
          <div className="modal kategorie-modal kategorie-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {selectedBankTxIds.length > 0 && !selectedBankTx
                  ? `${selectedBankTxIds.length} Transaktionen zuordnen`
                  : 'Kategorie zuordnen'}
              </h3>
              <button className="close-btn" onClick={() => setShowKategorieModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Auto-Zuordnung Hinweis */}
              {selectedBankTx && aehnlicheAnzahl > 0 && (
                <div className="auto-zuordnung-hint">
                  <span>⚡</span>
                  <span>
                    <span className="hint-count">{aehnlicheAnzahl} weitere</span> unzugeordnete Transaktionen von{' '}
                    <strong>"{aehnlicheAuftraggeber}"</strong> werden automatisch mit derselben Kategorie zugeordnet.
                  </span>
                </div>
              )}

              {/* Single Transaction Preview */}
              {selectedBankTx && (
                <div className="tx-preview">
                  <div className="tx-preview-row">
                    <span>Datum:</span>
                    <span>{formatDate(selectedBankTx.buchungsdatum)}</span>
                  </div>
                  <div className="tx-preview-row">
                    <span>Betrag:</span>
                    <span className={selectedBankTx.betrag >= 0 ? 'einnahme' : 'ausgabe'}>
                      {formatCurrency(selectedBankTx.betrag)}
                    </span>
                  </div>
                  <div className="tx-preview-row">
                    <span>Auftraggeber:</span>
                    <span>{selectedBankTx.auftraggeber_empfaenger}</span>
                  </div>
                  <div className="tx-preview-row">
                    <span>Verwendungszweck:</span>
                    <span>{selectedBankTx.verwendungszweck}</span>
                  </div>
                </div>
              )}

              {/* Batch Preview */}
              {selectedBankTxIds.length > 0 && !selectedBankTx && (
                <div className="tx-preview batch-preview">
                  <div className="batch-summary">
                    <strong>{selectedBankTxIds.length} Transaktionen ausgewählt</strong>
                    <span className="batch-total">
                      Gesamt: {formatCurrency(
                        bankTransaktionen
                          .filter(tx => selectedBankTxIds.includes(tx.transaktion_id))
                          .reduce((sum, tx) => sum + parseFloat(tx.betrag), 0)
                      )}
                    </span>
                  </div>
                  <div className="batch-list">
                    {bankTransaktionen
                      .filter(tx => selectedBankTxIds.includes(tx.transaktion_id))
                      .slice(0, 5)
                      .map(tx => (
                        <div key={tx.transaktion_id} className="batch-item">
                          <span>{formatDate(tx.buchungsdatum)}</span>
                          <span className={tx.betrag >= 0 ? 'einnahme' : 'ausgabe'}>
                            {formatCurrency(tx.betrag)}
                          </span>
                          <span>{tx.auftraggeber_empfaenger}</span>
                        </div>
                      ))}
                    {selectedBankTxIds.length > 5 && (
                      <div className="batch-more">
                        ... und {selectedBankTxIds.length - 5} weitere
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="kategorie-grid">
                {kategorien.map(kat => (
                  <button
                    key={kat.id}
                    className={`kategorie-btn ${kat.typ}`}
                    onClick={() => {
                      if (selectedBankTxIds.length > 0 && !selectedBankTx) {
                        batchZuordnen(kat.id);
                        setShowKategorieModal(false);
                      } else {
                        zuordnenTransaktion(kat.id);
                      }
                    }}
                  >
                    <span className="kat-name">{kat.name}</span>
                    <span className="kat-desc">{kat.beschreibung}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BEITRAEGE DETAIL MODAL ==================== */}
      {beitraegeDetail && (
        <div className="modal-overlay" onClick={() => setBeitraegeDetail(null)}>
          <div className="modal beitraege-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{beitraegeDetail.label}</h3>
              <button className="modal-close" onClick={() => setBeitraegeDetail(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {beitraegeDetailLoading ? (
                <div className="loading-spinner">Laden...</div>
              ) : beitraegeDetail?.fehler ? (
                <div className="message error" style={{margin:'1rem'}}>Fehler: {beitraegeDetail.fehler}</div>
              ) : beitraegeDetail?.eintraege?.length === 0 ? (
                <div className="message" style={{margin:'1rem'}}>Keine Einträge gefunden für {beitraegeDetail.label}</div>
              ) : (
                <>
                  <table className="beitraege-detail-table">
                    <thead>
                      <tr>
                        <th>Mitglied</th>
                        <th>Zahlungsdatum</th>
                        <th>Zahlungsart</th>
                        <th className="right">Betrag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {beitraegeDetail.eintraege.map(e => (
                        <tr key={e.beitrag_id}>
                          <td>{e.nachname}, {e.vorname}</td>
                          <td>{new Date(e.zahlungsdatum).toLocaleDateString('de-DE')}</td>
                          <td>{e.zahlungsart || '—'}</td>
                          <td className="right">{formatCurrency(e.betrag)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="total-row">
                        <td colSpan="3"><strong>Gesamt ({beitraegeDetail.eintraege.length} Einträge)</strong></td>
                        <td className="right"><strong>{formatCurrency(beitraegeDetail.eintraege.reduce((s, e) => s + parseFloat(e.betrag), 0))}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== VERKAUF DETAIL MODAL ==================== */}
      {verkaufDetail && (
        <div className="modal-overlay" onClick={() => setVerkaufDetail(null)}>
          <div className="modal beitraege-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{verkaufDetail.label}</h3>
              <button className="modal-close" onClick={() => setVerkaufDetail(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {verkaufDetailLoading || verkaufDetail.loading ? (
                <div className="loading-spinner">Laden...</div>
              ) : verkaufDetail.fehler ? (
                <div className="message error" style={{margin:'1rem'}}>Fehler: {verkaufDetail.fehler}</div>
              ) : (
                <>
                  <div style={{padding:'0.75rem 1rem', background:'var(--bg-secondary)', borderRadius:6, marginBottom:'0.75rem', fontSize:'0.85rem', display:'flex', gap:'2rem'}}>
                    <span><strong>Kunde:</strong> {verkaufDetail.kunde}</span>
                    <span><strong>Datum:</strong> {new Date(verkaufDetail.datum).toLocaleDateString('de-DE')}</span>
                    <span><strong>Zahlungsart:</strong> {verkaufDetail.zahlungsart}</span>
                  </div>
                  <table className="beitraege-detail-table">
                    <thead>
                      <tr>
                        <th>Artikel</th>
                        <th className="right">Menge</th>
                        <th className="right">Einzelpreis</th>
                        <th className="right">Brutto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {verkaufDetail.positionen?.map((p, i) => (
                        <tr key={i}>
                          <td>{p.artikel_name}</td>
                          <td className="right">{p.menge}x</td>
                          <td className="right">{formatCurrency(p.einzelpreis)}</td>
                          <td className="right">{formatCurrency(p.brutto)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="total-row">
                        <td colSpan="3"><strong>Gesamt</strong></td>
                        <td className="right"><strong>{formatCurrency(verkaufDetail.gesamt)}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== UMBUCHUNG MODAL ==================== */}
      {showUmbuchungModal && umbuchungTx && (
        <div className="modal-overlay kategorie-overlay" onClick={() => setShowUmbuchungModal(false)}>
          <div className="modal kategorie-modal kategorie-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Kategorie ändern (Umbuchung)</h3>
              <button className="close-btn" onClick={() => setShowUmbuchungModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Transaction Details */}
              <div className="tx-preview">
                <div className="tx-preview-row">
                  <span>Datum:</span>
                  <span>{formatDate(umbuchungTx.buchungsdatum)}</span>
                </div>
                <div className="tx-preview-row">
                  <span>Betrag:</span>
                  <span className={umbuchungTx.betrag >= 0 ? 'einnahme' : 'ausgabe'}>
                    {formatCurrency(umbuchungTx.betrag)}
                  </span>
                </div>
                <div className="tx-preview-row">
                  <span>Auftraggeber:</span>
                  <span>{umbuchungTx.auftraggeber_empfaenger}</span>
                </div>
                <div className="tx-preview-row">
                  <span>Verwendungszweck:</span>
                  <span>{umbuchungTx.verwendungszweck}</span>
                </div>
                <div className="tx-preview-row highlight">
                  <span>Aktuelle Kategorie:</span>
                  <span className="current-kategorie">{getKategorieName(umbuchungTx.kategorie)}</span>
                </div>
              </div>

              <h4 className="neue-kategorie-title">Neue Kategorie wählen:</h4>

              <div className="kategorie-grid">
                {kategorien.map(kat => (
                  <button
                    key={kat.id}
                    className={`kategorie-btn ${kat.typ} ${umbuchungTx.kategorie === kat.id ? 'current' : ''}`}
                    onClick={() => {
                      if (kat.id !== umbuchungTx.kategorie) {
                        umbuchenTransaktion(umbuchungTx.transaktion_id, kat.id);
                      }
                    }}
                    disabled={kat.id === umbuchungTx.kategorie}
                  >
                    <span className="kat-name">{kat.name}</span>
                    <span className="kat-desc">{kat.beschreibung}</span>
                    {umbuchungTx.kategorie === kat.id && (
                      <span className="current-marker">Aktuell</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowUmbuchungModal(false); setUmbuchungTx(null); }}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rechnung Verknüpfen Modal */}
      {showRechnungModal && rechnungTx && (
        <div className="modal-overlay kategorie-overlay" onClick={() => setShowRechnungModal(false)}>
          <div className="modal kategorie-modal kategorie-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Mit Rechnung verknüpfen</h3>
              <button className="close-btn" onClick={() => setShowRechnungModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Transaction Details */}
              <div className="tx-preview">
                <div className="tx-preview-row">
                  <span>Datum:</span>
                  <span>{formatDate(rechnungTx.buchungsdatum)}</span>
                </div>
                <div className="tx-preview-row">
                  <span>Betrag:</span>
                  <span className="einnahme">{formatCurrency(rechnungTx.betrag)}</span>
                </div>
                <div className="tx-preview-row">
                  <span>Auftraggeber:</span>
                  <span>{rechnungTx.auftraggeber_empfaenger}</span>
                </div>
                <div className="tx-preview-row">
                  <span>Verwendungszweck:</span>
                  <span>{rechnungTx.verwendungszweck}</span>
                </div>
              </div>

              <h4 className="neue-kategorie-title">Offene Rechnungen:</h4>

              {offeneRechnungen.length === 0 ? (
                <p className="bt-empty-text">
                  Keine offenen Verbandsrechnungen vorhanden
                </p>
              ) : (
                <div className="rechnungen-liste bt-rechnungen-list">
                  {offeneRechnungen.map(re => (
                    <div
                      key={re.id}
                      className={`rechnung-item${Math.abs(rechnungTx.betrag - re.summe_brutto) < 0.01 ? ' rechnung-item--match' : ''}`}
                      onClick={() => verknuepfeMitRechnung(re.id)}
                    >
                      <div>
                        <div className="bt-re-nummer">{re.rechnungsnummer}</div>
                        <div className="u-text-secondary-sm">{re.empfaenger_name}</div>
                        <div className="bt-re-date">{formatDate(re.rechnungsdatum)}</div>
                      </div>
                      <div className="bt-text-right">
                        <div className="bt-re-summe">{formatCurrency(re.summe_brutto)}</div>
                        {Math.abs(rechnungTx.betrag - re.summe_brutto) < 0.01 && (
                          <div className="bt-re-match">✓ Betrag stimmt</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="bt-note-text">
                Hinweis: Die Verknüpfung markiert die Rechnung als bezahlt. Die EÜR-Buchung erfolgt über die Bank-Transaktion.
              </p>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => { setShowRechnungModal(false); setRechnungTx(null); }}>
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== BILANZ STAMMDATEN MODAL ==================== */}
      {showBilanzStammdatenModal && (
        <div className="modal-overlay" onClick={() => setShowBilanzStammdatenModal(false)}>
          <div className="modal modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Bilanz-Stammdaten bearbeiten</h3>
              <button className="close-btn" onClick={() => setShowBilanzStammdatenModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const data = {
                organisation: selectedOrg,
                jahr: selectedJahr,
                bank_anfangsbestand: parseFloat(formData.get('bank_anfangsbestand')) || 0,
                kasse_anfangsbestand: parseFloat(formData.get('kasse_anfangsbestand')) || 0,
                sachanlagen: parseFloat(formData.get('sachanlagen')) || 0,
                sachanlagen_beschreibung: formData.get('sachanlagen_beschreibung'),
                immat_vermoegensgegenstaende: parseFloat(formData.get('immat_vermoegensgegenstaende')) || 0,
                finanzanlagen: parseFloat(formData.get('finanzanlagen')) || 0,
                vorraete: parseFloat(formData.get('vorraete')) || 0,
                sonstige_forderungen: parseFloat(formData.get('sonstige_forderungen')) || 0,
                rechnungsabgrenzung_aktiv: parseFloat(formData.get('rechnungsabgrenzung_aktiv')) || 0,
                eigenkapital_anfang: parseFloat(formData.get('eigenkapital_anfang')) || 0,
                gewinnvortrag: bilanzData?.raw?.gewinnvortrag || 0,
                darlehen: parseFloat(formData.get('darlehen')) || 0,
                darlehen_beschreibung: formData.get('darlehen_beschreibung'),
                steuerrueckstellungen: parseFloat(formData.get('steuerrueckstellungen')) || 0,
                sonstige_rueckstellungen: parseFloat(formData.get('sonstige_rueckstellungen')) || 0,
                verbindlichkeiten_lieferanten: parseFloat(formData.get('verbindlichkeiten_lieferanten')) || 0,
                sonstige_verbindlichkeiten: parseFloat(formData.get('sonstige_verbindlichkeiten')) || 0,
                rechnungsabgrenzung_passiv: parseFloat(formData.get('rechnungsabgrenzung_passiv')) || 0
              };

              axios.post('/buchhaltung/bilanz/stammdaten', data, {
                headers: { Authorization: `Bearer ${token}` }
              })
              .then(() => {
                setSuccess('Stammdaten erfolgreich gespeichert');
                setShowBilanzStammdatenModal(false);
                fetchBilanzData();
              })
              .catch(err => {
                setError('Fehler beim Speichern der Stammdaten');
                console.error(err);
              });
            }}>
              <div className="form-grid">
                <div className="form-group full-width">
                  <h4 className="form-section-title">AKTIVA — Anlagevermögen</h4>
                </div>
                <div className="form-group">
                  <label>Immaterielle Vermögensgegenstände (€)</label>
                  <input type="number" name="immat_vermoegensgegenstaende" step="0.01" defaultValue={bilanzData?.raw?.immat_vermoegensgegenstaende ?? 0} />
                  <small>Lizenzen, Software, Geschäftswert</small>
                </div>
                <div className="form-group">
                  <label>Sachanlagen (€)</label>
                  <input type="number" name="sachanlagen" step="0.01" defaultValue={bilanzData?.raw?.sachanlagen ?? 0} />
                  <small>Sportgeräte, Trainingsgeräte, Möbel</small>
                </div>
                <div className="form-group full-width">
                  <label>Sachanlagen — Beschreibung</label>
                  <textarea name="sachanlagen_beschreibung" rows="2" defaultValue={bilanzData?.raw?.sachanlagen_beschreibung || ''} />
                </div>
                <div className="form-group">
                  <label>Finanzanlagen (€)</label>
                  <input type="number" name="finanzanlagen" step="0.01" defaultValue={bilanzData?.raw?.finanzanlagen ?? 0} />
                  <small>Beteiligungen, Wertpapiere</small>
                </div>

                <div className="form-group full-width">
                  <h4 className="form-section-title">AKTIVA — Umlaufvermögen</h4>
                </div>
                <div className="form-group">
                  <label>Vorräte (€)</label>
                  <input type="number" name="vorraete" step="0.01" defaultValue={bilanzData?.raw?.vorraete ?? 0} />
                  <small>Warenvorräte, Artikel-Inventar (Buchwert)</small>
                </div>
                <div className="form-group">
                  <label>Sonstige Forderungen (€)</label>
                  <input type="number" name="sonstige_forderungen" step="0.01" defaultValue={bilanzData?.raw?.sonstige_forderungen ?? 0} />
                  <small>Sonstige Vermögensgegenstände</small>
                </div>
                <div className="form-group">
                  <label>Bankguthaben — Anfangsbestand (€)</label>
                  <input type="number" name="bank_anfangsbestand" step="0.01" defaultValue={bilanzData?.raw?.bank_anfangsbestand ?? 0} />
                  <small>Kontostand zum Jahresbeginn (wird um importierte Transaktionen ergänzt)</small>
                </div>
                <div className="form-group">
                  <label>Kassenbestand — Anfangsbestand (€)</label>
                  <input type="number" name="kasse_anfangsbestand" step="0.01" defaultValue={bilanzData?.raw?.kasse_anfangsbestand ?? 0} />
                  <small>Fallback wenn kein Kassenbuch-Eintrag vorhanden</small>
                </div>
                <div className="form-group">
                  <label>Aktive Rechnungsabgrenzungsposten (€)</label>
                  <input type="number" name="rechnungsabgrenzung_aktiv" step="0.01" defaultValue={bilanzData?.raw?.rechnungsabgrenzung_aktiv ?? 0} />
                  <small>Vorauszahlungen für folgendes Geschäftsjahr</small>
                </div>

                <div className="form-group full-width">
                  <h4 className="form-section-title">PASSIVA — Eigenkapital</h4>
                </div>
                <div className="form-group">
                  <label>Kapital / Anfangsbestand (€)</label>
                  <input type="number" name="eigenkapital_anfang" step="0.01" defaultValue={bilanzData?.raw?.eigenkapital_anfang ?? 0} />
                  <small>Eigenkapital zum Jahresbeginn (ohne Gewinnvortrag und Jahresüberschuss)</small>
                </div>

                <div className="form-group full-width">
                  <h4 className="form-section-title">PASSIVA — Rückstellungen</h4>
                </div>
                <div className="form-group">
                  <label>Steuerrückstellungen (€)</label>
                  <input type="number" name="steuerrueckstellungen" step="0.01" defaultValue={bilanzData?.raw?.steuerrueckstellungen ?? 0} />
                  <small>Rückstellungen für Einkommensteuer, USt-Nachzahlungen</small>
                </div>
                <div className="form-group">
                  <label>Sonstige Rückstellungen (€)</label>
                  <input type="number" name="sonstige_rueckstellungen" step="0.01" defaultValue={bilanzData?.raw?.sonstige_rueckstellungen ?? 0} />
                  <small>Urlaubsrückstellungen, Prozessrisiken, etc.</small>
                </div>

                <div className="form-group full-width">
                  <h4 className="form-section-title">PASSIVA — Verbindlichkeiten</h4>
                </div>
                <div className="form-group">
                  <label>Verbindlichkeiten ggü. Kreditinstituten (€)</label>
                  <input type="number" name="darlehen" step="0.01" defaultValue={bilanzData?.raw?.darlehen ?? 0} />
                </div>
                <div className="form-group full-width">
                  <label>Darlehen — Beschreibung</label>
                  <textarea name="darlehen_beschreibung" rows="2" defaultValue={bilanzData?.raw?.darlehen_beschreibung || ''} />
                </div>
                <div className="form-group">
                  <label>Verbindlichkeiten aus Lieferungen und Leistungen (€)</label>
                  <input type="number" name="verbindlichkeiten_lieferanten" step="0.01" defaultValue={bilanzData?.raw?.verbindlichkeiten_lieferanten ?? 0} />
                  <small>Offene Rechnungen von Lieferanten</small>
                </div>
                <div className="form-group">
                  <label>Sonstige Verbindlichkeiten (€)</label>
                  <input type="number" name="sonstige_verbindlichkeiten" step="0.01" defaultValue={bilanzData?.raw?.sonstige_verbindlichkeiten ?? 0} />
                </div>
                <div className="form-group">
                  <label>Passive Rechnungsabgrenzungsposten (€)</label>
                  <input type="number" name="rechnungsabgrenzung_passiv" step="0.01" defaultValue={bilanzData?.raw?.rechnungsabgrenzung_passiv ?? 0} />
                  <small>Vereinnahmte Entgelte für das Folgejahr</small>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowBilanzStammdatenModal(false)}>
                  Abbrechen
                </button>
                <button type="submit" className="btn-primary">
                  Speichern
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}
    </div>
  );
};

export default BuchhaltungTab;
