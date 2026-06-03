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
  Landmark, Check, XCircle, Lightbulb, FileUp, History, BarChart3, Star, ArrowUpRight, Camera
} from 'lucide-react';
import '../styles/BuchhaltungTab.css';
import VerbandRechnungErstellen from './VerbandRechnungErstellen';
import { useSubscription } from '../context/SubscriptionContext';
import { useDojoContext } from '../context/DojoContext';
import { UStVATab } from './SteuerAssistent';
import LohnTab from './LohnTab';
import BuchhaltungBwaTab from './BuchhaltungBwaTab';
import BuchhaltungGuvTab from './BuchhaltungGuvTab';
import BuchhaltungBilanzTab from './BuchhaltungBilanzTab';
import BuchhaltungAnlagenTab from './BuchhaltungAnlagenTab';
import BuchhaltungWiederkehrendTab from './BuchhaltungWiederkehrendTab';
import BuchhaltungKreditorenTab from './BuchhaltungKreditorenTab';
import BuchhaltungOffenePostenTab from './BuchhaltungOffenePostenTab';
import BuchhaltungBelegeTab from './BuchhaltungBelegeTab';
import BuchhaltungSteuerauswertungTab from './BuchhaltungSteuerauswertungTab';
import BuchhaltungEuerTab from './BuchhaltungEuerTab';
import BuchhaltungBankImportTab from './BuchhaltungBankImportTab';
import BuchhaltungAutoTab from './BuchhaltungAutoTab';
import BuchhaltungAbschlussTab from './BuchhaltungAbschlussTab';

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
  const [guvSkrData, setGuvSkrData] = useState(null);
  const [skrKontorahmen, setSkrKontorahmen] = useState('SKR03');
  const [guvAnsicht, setGuvAnsicht] = useState('standard');
  const [expandedSkrKonten, setExpandedSkrKonten] = useState({});
  const [bilanzData, setBilanzData] = useState(null);
  const [expandedGuvDetails, setExpandedGuvDetails] = useState({});
  const [editingGewinnvortrag, setEditingGewinnvortrag] = useState(false);

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expandedKategorien, setExpandedKategorien] = useState({});
  // EÜR Kategorie inline-Edit
  const [editingBuchung, setEditingBuchung] = useState(null); // { quelle, referenz_id, currentKat }
  const [editingBuchungKat, setEditingBuchungKat] = useState('');

  // Modal States
  const [showBelegModal, setShowBelegModal] = useState(false);
  const [editingBeleg, setEditingBeleg] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadBelegId, setUploadBelegId] = useState(null);
  const [showTxUploadModal, setShowTxUploadModal] = useState(false);
  const [txUploadId, setTxUploadId] = useState(null);
  const [belegFile, setBelegFile] = useState(null); // für Beleg-Formular inline-Upload

  // Quick-Foto-Capture States
  const [showQuickCapture, setShowQuickCapture] = useState(false);
  const [quickFile, setQuickFile] = useState(null);
  const [quickPreview, setQuickPreview] = useState(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickOcrLoading, setQuickOcrLoading] = useState(false);
  const [quickOcrDone, setQuickOcrDone] = useState(false);
  const [quickPositionen, setQuickPositionen] = useState([]); // OCR-Positionen
  const [quickForm, setQuickForm] = useState({
    buchungsart: 'ausgabe',
    beleg_datum: new Date().toISOString().split('T')[0],
    lieferant: '',
    kategorie: '',
    mwst_satz: 19,
  });
  const [showAbschlussModal, setShowAbschlussModal] = useState(false);
  const [showBilanzStammdatenModal, setShowBilanzStammdatenModal] = useState(false);

  // Anlagevermögen States
  const [anlagen, setAnlagen] = useState([]);
  const [anlagenLoading, setAnlagenLoading] = useState(false);
  const [showAnlageForm, setShowAnlageForm] = useState(false);
  const [editingAnlage, setEditingAnlage] = useState(null);
  const [anlageAfa, setAnlageAfa] = useState(null);
  const [anlageForm, setAnlageForm] = useState({
    bezeichnung: '', beschreibung: '', anlage_kategorie: 'kfz',
    kaufdatum: new Date().toISOString().split('T')[0],
    anschaffungskosten: '', restwert: '0', nutzungsdauer: '6',
    lieferant: '', rechnungsnummer: ''
  });

  // Kreditoren States
  const [kreditoren, setKreditoren] = useState([]);
  const [kreditorenLoading, setKreditorenLoading] = useState(false);
  const [showKreditorForm, setShowKreditorForm] = useState(false);
  const [editingKreditor, setEditingKreditor] = useState(null);
  const [kreditorForm, setKreditorForm] = useState({
    organisation_name: 'TDA International', name: '', kurzname: '',
    adresse: '', email: '', telefon: '', ust_id: '', zahlungsziel_tage: '14',
    iban: '', bic: '', notizen: ''
  });
  const [kreditorSuggestions, setKreditorSuggestions] = useState([]);

  // Offene Posten & Mahnwesen States
  const [offenePosten, setOffenePosten] = useState({ offeneRechnungen: [], mahnungen: [] });
  const [offenePostenLoading, setOffenePostenLoading] = useState(false);
  const [showMahnungForm, setShowMahnungForm] = useState(false);
  const [mahnungForm, setMahnungForm] = useState({
    organisation_name: 'TDA International', rechnung_id: '', mitglied_id: '',
    schuldner_name: '', offener_betrag: '', faelligkeitsdatum: '',
    mahnstufe: '1', mahngebuehr: '0', mahntext: ''
  });

  // Wiederkehrende Buchungen States
  const [wiederkehrend, setWiederkehrend] = useState([]);
  const [wiederkehrendLoading, setWiederkehrendLoading] = useState(false);
  const [showWiederkehrendForm, setShowWiederkehrendForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    organisation_name: 'TDA International', bezeichnung: '', buchungsart: 'ausgabe',
    betrag_netto: '', mwst_satz: '19', kategorie: 'sonstige_kosten',
    beschreibung: '', lieferant_kunde: '', intervall: 'monatlich',
    naechste_faelligkeit: new Date().toISOString().split('T')[0], auto_ausfuehren: false
  });
  const [ausfuehrenRunning, setAusfuehrenRunning] = useState(false);

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
  const [kategorieModalMwst, setKategorieModalMwst] = useState('19');
  const [selectedBankTx, setSelectedBankTx] = useState(null);
  const [selectedBankTxIds, setSelectedBankTxIds] = useState([]);
  const [bankUploading, setBankUploading] = useState(false);
  const [autoVorschlagRunning, setAutoVorschlagRunning] = useState(false);
  const [alleAnnehmenRunning, setAlleAnnehmenRunning] = useState(false);
  const [bankSortField, setBankSortField] = useState('buchungsdatum');
  const [bankSortDirection, setBankSortDirection] = useState('desc');
  const [bankSearchTerm, setBankSearchTerm] = useState('');
  const [bankLimit, setBankLimit] = useState(30);
  const [bankBetragFilter, setBankBetragFilter] = useState(''); // '', 'einnahmen', 'ausgaben'
  const [bankKategorieFilter, setBankKategorieFilter] = useState(''); // Filter für zugeordnete Kategorie
  const [bankDatumVon, setBankDatumVon] = useState('');
  const [bankDatumBis, setBankDatumBis] = useState('');

  // Review Modal States
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewStats, setReviewStats] = useState({ angenommen: 0, geaendert: 0, uebersprungen: 0 });
  const [reviewKategorieMode, setReviewKategorieMode] = useState(false);
  const [reviewAccepting, setReviewAccepting] = useState(false);
  const [reviewMwst, setReviewMwst] = useState('19');
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
  const [dojoEinstellungen, setDojoEinstellungen] = useState({ kleinunternehmer: false, umsatzsteuerpflichtig: true });

  // BWA States
  const [bwaData, setBwaData] = useState(null);
  const [bwaLoading, setBwaLoading] = useState(false);
  const [bwaJahr, setBwaJahr] = useState(new Date().getFullYear());

  // Altersliste States
  const [altersliste, setAltersliste] = useState(null);
  const [alterslisteLoading, setAlterslisteLoading] = useState(false);
  const [showAltersliste, setShowAltersliste] = useState(false);

  // Mahnung PDF States
  const [mahnungPdfLoading, setMahnungPdfLoading] = useState({});

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
    rechnungsnummer_extern: '',
    ist_gwg: false,
    privatanteil_prozent: '0'
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

  const saveBuchungKategorie = async () => {
    if (!editingBuchung || !editingBuchungKat) return;
    try {
      await axios.patch(
        `/buchhaltung/buchung/${editingBuchung.quelle}/${editingBuchung.referenz_id}/kategorie`,
        { kategorie: editingBuchungKat },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEditingBuchung(null);
      setEditingBuchungKat('');
      loadEuer();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Speichern der Kategorie');
    }
  };

  // Dojo-Einstellungen laden (einmalig)
  const loadEinstellungen = useCallback(async () => {
    try {
      const res = await axios.get('/buchhaltung/einstellungen', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDojoEinstellungen(res.data);
    } catch { /* ignore — defaults bleiben */ }
  }, [token]);

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

  // Anlagevermögen laden
  const loadAnlagen = useCallback(async () => {
    setAnlagenLoading(true);
    try {
      const res = await axios.get('/buchhaltung/anlageverm%C3%B6gen', {
        headers: { Authorization: `Bearer ${token}` },
        params: selectedOrg !== 'alle' ? { organisation: selectedOrg } : {}
      });
      setAnlagen(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Laden der Anlagen');
    } finally {
      setAnlagenLoading(false);
    }
  }, [token, selectedOrg]);

  const saveAnlage = async () => {
    try {
      setLoading(true);
      const payload = {
        ...anlageForm,
        organisation_name: selectedOrg !== 'alle' ? selectedOrg : 'Kampfkunstschule Schreiner'
      };
      if (editingAnlage) {
        await axios.put(`/buchhaltung/anlageverm%C3%B6gen/${editingAnlage.anlage_id}`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
        setSuccess('Anlage aktualisiert');
      } else {
        await axios.post('/buchhaltung/anlageverm%C3%B6gen', payload,
          { headers: { Authorization: `Bearer ${token}` } });
        setSuccess('Anlage erfasst — AfA-Plan berechnet');
      }
      setShowAnlageForm(false);
      setEditingAnlage(null);
      loadAnlagen();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Speichern');
    } finally { setLoading(false); }
  };

  const deleteAnlage = async (id) => {
    if (!window.confirm('Anlage als ausgeschieden markieren?')) return;
    try {
      await axios.delete(`/buchhaltung/anlageverm%C3%B6gen/${id}`,
        { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Anlage ausgeschieden');
      loadAnlagen();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler');
    }
  };

  const loadAfaSchedule = async (anlage) => {
    try {
      const res = await axios.get(`/buchhaltung/anlageverm%C3%B6gen/${anlage.anlage_id}/afa`,
        { headers: { Authorization: `Bearer ${token}` } });
      setAnlageAfa(res.data);
    } catch (err) {
      setError('AfA-Plan konnte nicht geladen werden');
    }
  };

  const NUTZUNGSDAUER_PRESETS = {
    kfz:      { jahre: 6,  label: 'Kfz / Anhänger (6 Jahre)' },
    edv:      { jahre: 3,  label: 'EDV / Computer (3 Jahre)' },
    buero:    { jahre: 13, label: 'Büroausstattung (13 Jahre)' },
    betrieb:  { jahre: 10, label: 'Betriebsausstattung (10 Jahre)' },
    sonstiges:{ jahre: 5,  label: 'Sonstiges' },
  };

  // Kreditoren laden
  const loadKreditoren = useCallback(async () => {
    setKreditorenLoading(true);
    try {
      const res = await axios.get('/buchhaltung/kreditoren', {
        headers: { Authorization: `Bearer ${token}` },
        params: selectedOrg !== 'alle' ? { organisation: selectedOrg } : {}
      });
      setKreditoren(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Laden der Kreditoren');
    } finally { setKreditorenLoading(false); }
  }, [token, selectedOrg]);

  const saveKreditor = async () => {
    try {
      setLoading(true);
      const payload = { ...kreditorForm };
      if (editingKreditor) {
        await axios.put(`/buchhaltung/kreditoren/${editingKreditor.kreditor_id}`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
        setSuccess('Kreditor aktualisiert');
      } else {
        payload.organisation_name = selectedOrg !== 'alle' ? selectedOrg : 'Kampfkunstschule Schreiner';
        await axios.post('/buchhaltung/kreditoren', payload, { headers: { Authorization: `Bearer ${token}` } });
        setSuccess('Kreditor angelegt');
      }
      setShowKreditorForm(false);
      setEditingKreditor(null);
      loadKreditoren();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Speichern');
    } finally { setLoading(false); }
  };

  const deleteKreditor = async (id) => {
    if (!window.confirm('Kreditor löschen?')) return;
    try {
      await axios.delete(`/buchhaltung/kreditoren/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Kreditor gelöscht');
      loadKreditoren();
    } catch (err) { setError(err.response?.data?.message || 'Fehler'); }
  };

  const searchKreditoren = async (q) => {
    if (q.length < 2) { setKreditorSuggestions([]); return; }
    try {
      const res = await axios.get('/buchhaltung/kreditoren', {
        headers: { Authorization: `Bearer ${token}` },
        params: { q, organisation: selectedOrg !== 'alle' ? selectedOrg : undefined }
      });
      setKreditorSuggestions(res.data.slice(0, 5));
    } catch { setKreditorSuggestions([]); }
  };

  // Offene Posten laden
  const loadOffenePosten = useCallback(async () => {
    setOffenePostenLoading(true);
    try {
      const res = await axios.get('/buchhaltung/offene-posten', {
        headers: { Authorization: `Bearer ${token}` },
        params: selectedOrg !== 'alle' ? { organisation: selectedOrg } : {}
      });
      setOffenePosten(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Laden der offenen Posten');
    } finally { setOffenePostenLoading(false); }
  }, [token, selectedOrg]);

  const saveMahnung = async () => {
    try {
      setLoading(true);
      const payload = {
        ...mahnungForm,
        organisation_name: selectedOrg !== 'alle' ? selectedOrg : 'Kampfkunstschule Schreiner'
      };
      await axios.post('/buchhaltung/mahnungen', payload, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Mahnung erstellt');
      setShowMahnungForm(false);
      setMahnungForm({ organisation_name: 'TDA International', rechnung_id: '', mitglied_id: '',
        schuldner_name: '', offener_betrag: '', faelligkeitsdatum: '',
        mahnstufe: '1', mahngebuehr: '0', mahntext: '' });
      loadOffenePosten();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler');
    } finally { setLoading(false); }
  };

  const mahnungVersandt = async (id) => {
    try {
      await axios.put(`/buchhaltung/mahnungen/${id}/versandt`, { versandt_per: 'email' },
        { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Als versandt markiert');
      loadOffenePosten();
    } catch (err) { setError(err.response?.data?.message || 'Fehler'); }
  };

  const mahnungBezahlt = async (id) => {
    try {
      await axios.put(`/buchhaltung/mahnungen/${id}/bezahlt`, {},
        { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Als bezahlt markiert');
      loadOffenePosten();
    } catch (err) { setError(err.response?.data?.message || 'Fehler'); }
  };

  // Wiederkehrende Buchungen laden
  const loadWiederkehrend = useCallback(async () => {
    setWiederkehrendLoading(true);
    try {
      const res = await axios.get('/buchhaltung/wiederkehrend', {
        headers: { Authorization: `Bearer ${token}` },
        params: selectedOrg !== 'alle' ? { organisation: selectedOrg } : {}
      });
      setWiederkehrend(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Laden der Templates');
    } finally { setWiederkehrendLoading(false); }
  }, [token, selectedOrg]);

  const saveTemplate = async () => {
    try {
      setLoading(true);
      const payload = {
        ...templateForm,
        organisation_name: selectedOrg !== 'alle' ? selectedOrg : 'Kampfkunstschule Schreiner'
      };
      if (editingTemplate) {
        await axios.put(`/buchhaltung/wiederkehrend/${editingTemplate.template_id}`, payload,
          { headers: { Authorization: `Bearer ${token}` } });
        setSuccess('Template aktualisiert');
      } else {
        await axios.post('/buchhaltung/wiederkehrend', payload, { headers: { Authorization: `Bearer ${token}` } });
        setSuccess('Wiederkehrende Buchung angelegt');
      }
      setShowWiederkehrendForm(false);
      setEditingTemplate(null);
      loadWiederkehrend();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Speichern');
    } finally { setLoading(false); }
  };

  const templateAusfuehren = async (id) => {
    try {
      setAusfuehrenRunning(true);
      const res = await axios.post(`/buchhaltung/wiederkehrend/${id}/ausfuehren`, {},
        { headers: { Authorization: `Bearer ${token}` } });
      setSuccess(`Beleg ${res.data.beleg_nummer} erstellt. Nächste Fälligkeit: ${res.data.naechste_faelligkeit}`);
      loadWiederkehrend();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Ausführen');
    } finally { setAusfuehrenRunning(false); }
  };

  const alleFaelligeAusfuehren = async () => {
    if (!window.confirm('Alle fälligen auto-Buchungen jetzt ausführen?')) return;
    try {
      setAusfuehrenRunning(true);
      const res = await axios.post('/buchhaltung/wiederkehrend/ausfuehren-faellige', {},
        { headers: { Authorization: `Bearer ${token}` } });
      setSuccess(`${res.data.anzahl} Buchungen ausgeführt`);
      loadWiederkehrend();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler');
    } finally { setAusfuehrenRunning(false); }
  };

  const deleteTemplate = async (id) => {
    if (!window.confirm('Template löschen?')) return;
    try {
      await axios.delete(`/buchhaltung/wiederkehrend/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      setSuccess('Template gelöscht');
      loadWiederkehrend();
    } catch (err) { setError(err.response?.data?.message || 'Fehler'); }
  };

  // Bank-Transaktionen laden
  const loadBankTransaktionen = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get('/buchhaltung/bank-import/transaktionen', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          organisation: selectedOrg !== 'alle' ? selectedOrg : undefined,
          jahr: selectedJahr,
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

  // 🤖 Auto-Vorschlag für alle offenen Transaktionen
  const autoAlleVorschlagen = async () => {
    setAutoVorschlagRunning(true);
    try {
      const res = await axios.post('/buchhaltung/bank-import/auto-alle-vorschlagen', {}, {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg !== 'alle' ? selectedOrg : undefined }
      });
      setSuccess(res.data.message);
      await loadBankTransaktionen();
      await loadBankStatistik();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim automatischen Vorschlagen');
    } finally {
      setAutoVorschlagRunning(false);
    }
  };

  // ✅ Alle Vorschläge auf einmal annehmen
  const alleVorschlaegeAnnehmen = async () => {
    setAlleAnnehmenRunning(true);
    try {
      const res = await axios.post('/buchhaltung/bank-import/alle-vorschlaege-annehmen', {}, {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg !== 'alle' ? selectedOrg : undefined }
      });
      setSuccess(res.data.message);
      await loadBankTransaktionen();
      await loadBankStatistik();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Annehmen der Vorschläge');
    } finally {
      setAlleAnnehmenRunning(false);
    }
  };

  // Review Modal öffnen
  const openReviewModal = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/buchhaltung/bank-import/transaktionen', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          organisation: selectedOrg !== 'alle' ? selectedOrg : undefined,
          jahr: selectedJahr,
          status: 'vorgeschlagen',
          seite: 1,
          limit: 10000
        }
      });
      const queue = res.data.transaktionen || [];
      if (queue.length === 0) {
        setSuccess('Keine Vorschläge zum Prüfen vorhanden.');
        setTimeout(() => setSuccess(''), 3000);
        return;
      }
      setReviewQueue(queue);
      setReviewIndex(0);
      setReviewStats({ angenommen: 0, geaendert: 0, uebersprungen: 0 });
      setShowReviewModal(true);
    } catch (err) {
      setError('Fehler beim Laden der Vorschläge');
    } finally {
      setLoading(false);
    }
  };

  // Review: Vorschlag annehmen
  const reviewVorschlagAnnehmen = async () => {
    const tx = reviewQueue[reviewIndex];
    if (!tx || reviewAccepting) return;
    setReviewAccepting(true);
    try {
      const mwstFuerRequest = dojoEinstellungen.kleinunternehmer ? 0 : parseFloat(reviewMwst || '0');
      await axios.post(`/buchhaltung/bank-import/vorschlag-annehmen/${tx.transaktion_id}`, {
        mwst_satz: mwstFuerRequest
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReviewStats(prev => ({ ...prev, angenommen: prev.angenommen + 1 }));
      setReviewIndex(prev => prev + 1);
      setReviewMwst(dojoEinstellungen.kleinunternehmer ? '0' : '19');
      loadBankStatistik();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Annehmen');
    } finally {
      setReviewAccepting(false);
    }
  };

  // Review: Kategorie-Zuordnung (aus Review Modal heraus)
  const reviewZuordnen = async (kategorie) => {
    if (!selectedBankTx) return;
    try {
      setLoading(true);
      await axios.post(`/buchhaltung/bank-import/zuordnen/${selectedBankTx.transaktion_id}`, {
        kategorie,
        mwst_satz: parseFloat(kategorieModalMwst || '0')
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setShowKategorieModal(false);
      setSelectedBankTx(null);
      setReviewKategorieMode(false);
      setReviewStats(prev => ({ ...prev, geaendert: prev.geaendert + 1 }));
      setReviewIndex(prev => prev + 1);
      loadBankTransaktionen();
      loadBankStatistik();
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler bei der Zuordnung');
    } finally {
      setLoading(false);
    }
  };

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
        kategorie,
        mwst_satz: parseFloat(kategorieModalMwst || '0')
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

  const fetchGuvSkrData = useCallback(async (rahmen = skrKontorahmen) => {
    if (!token) return;
    try {
      const response = await axios.get('/buchhaltung/guv/skr', {
        params: { organisation: selectedOrg, jahr: selectedJahr, kontorahmen: rahmen },
        headers: { Authorization: `Bearer ${token}` }
      });
      setGuvSkrData(response.data);
    } catch (err) {
      console.error('GuV-SKR-Fehler:', err);
    }
  }, [token, selectedOrg, selectedJahr, skrKontorahmen]);

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

  useEffect(() => {
    loadEinstellungen();
  }, [loadEinstellungen]);

  // Load data based on active sub-tab
  useEffect(() => {
    if (activeSubTab === 'euer') {
      loadDashboard();
      loadEuer();
    } else if (activeSubTab === 'guv') {
      fetchGuvData();
      if (guvAnsicht === 'skr') fetchGuvSkrData();
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
    } else if (activeSubTab === 'anlagen') {
      loadAnlagen();
    } else if (activeSubTab === 'kreditoren') {
      loadKreditoren();
    } else if (activeSubTab === 'offene-posten') {
      loadOffenePosten();
    } else if (activeSubTab === 'wiederkehrend') {
      loadWiederkehrend();
    } else if (activeSubTab === 'bwa') {
      loadBwa();
    }
  }, [activeSubTab, selectedOrg, selectedJahr, selectedQuartal, belegePage, bankPage, bankStatusFilter, loadDashboard, loadEuer, loadBelege, loadAutoEinnahmen, loadBankTransaktionen, loadBankStatistik, loadSteuerauswertung, loadAbschluss, fetchGuvData, fetchGuvSkrData, guvAnsicht, fetchBilanzData, loadAnlagen, loadKreditoren, loadOffenePosten, loadWiederkehrend]);

  // Review Modal Tastatur-Navigation
  useEffect(() => {
    if (!showReviewModal || showKategorieModal) return;
    const handler = (e) => {
      if (e.key === 'Escape') { setShowReviewModal(false); return; }
      const tx = reviewQueue[reviewIndex];
      if (!tx) return;
      if (e.key === 'Enter') reviewVorschlagAnnehmen();
      if (e.key === 'ArrowRight') {
        setReviewStats(prev => ({ ...prev, uebersprungen: prev.uebersprungen + 1 }));
        setReviewIndex(prev => prev + 1);
      }
      if (e.key === 'ArrowLeft') setReviewIndex(prev => Math.max(0, prev - 1));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showReviewModal, showKategorieModal, reviewIndex, reviewQueue]);

  // Quick-Capture: Foto-Auswahl + automatisch OCR mit Positionen
  const handleQuickFile = async (file) => {
    if (!file) return;
    setQuickFile(file);
    setQuickOcrDone(false);
    setQuickPositionen([]);
    const reader = new FileReader();
    reader.onload = (e) => setQuickPreview(e.target.result);
    reader.readAsDataURL(file);

    setQuickOcrLoading(true);
    try {
      const fd = new FormData();
      fd.append('bild', file);
      const res = await axios.post('/buchhaltung/belege/ocr', fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      const ocr = res.data;
      setQuickForm(f => ({
        ...f,
        beleg_datum: ocr.datum || f.beleg_datum,
        lieferant: ocr.lieferant || '',
        buchungsart: ocr.buchungsart || f.buchungsart,
        mwst_satz: ocr.mwst_satz || f.mwst_satz,
      }));
      setQuickPositionen(ocr.positionen || []);
      setQuickOcrDone(true);
    } catch {
      // OCR fehlgeschlagen — User füllt manuell aus
    } finally {
      setQuickOcrLoading(false);
    }
  };

  // Position typ umschalten (betrieb ↔ privat)
  const togglePositionTyp = (id) => {
    setQuickPositionen(prev => prev.map(p =>
      p.id === id ? { ...p, typ: p.typ === 'betrieb' ? 'privat' : 'betrieb' } : p
    ));
  };

  // Betriebssumme aus ausgewählten Positionen berechnen
  const quickBetriebsSumme = quickPositionen
    .filter(p => p.typ === 'betrieb')
    .reduce((sum, p) => sum + p.betrag, 0);

  const openQuickCapture = () => {
    setQuickFile(null);
    setQuickPreview(null);
    setQuickOcrLoading(false);
    setQuickOcrDone(false);
    setQuickPositionen([]);
    setQuickForm({
      buchungsart: 'ausgabe',
      beleg_datum: new Date().toISOString().split('T')[0],
      lieferant: '',
      kategorie: '',
      mwst_satz: 19,
    });
    setShowQuickCapture(true);
  };

  const saveQuickBeleg = async () => {
    const betriebsPositionen = quickPositionen.filter(p => p.typ === 'betrieb');
    const privatPositionen = quickPositionen.filter(p => p.typ === 'privat');
    const hatPositionen = quickPositionen.length > 0;
    const betrag = hatPositionen ? quickBetriebsSumme : 0;

    if (hatPositionen && betriebsPositionen.length === 0) {
      setError('Keine Betriebsausgaben ausgewählt — alle Positionen sind als Privat markiert.');
      return;
    }
    if (!hatPositionen && !quickForm.lieferant) {
      setError('Bitte mindestens Lieferant / Betrag angeben.');
      return;
    }

    setQuickLoading(true);
    setError('');
    try {
      // Beschreibung aus Positionen zusammenbauen
      const beschreibung = hatPositionen
        ? (quickForm.lieferant ? quickForm.lieferant + ': ' : '') +
          betriebsPositionen.map(p => p.beschreibung).join(', ')
        : quickForm.lieferant;

      // Dominanten MwSt-Satz (größter Anteil) ermitteln
      const dominantMwst = hatPositionen
        ? betriebsPositionen.reduce((best, p) =>
            p.betrag > (best.betrag || 0) ? p : best, {}).mwst_satz || quickForm.mwst_satz
        : quickForm.mwst_satz;

      const mwst = dominantMwst;
      const payload = {
        buchungsart: quickForm.buchungsart,
        beleg_datum: quickForm.beleg_datum,
        kategorie: quickForm.kategorie || undefined,
        organisation_name: selectedOrg !== 'alle' ? selectedOrg : undefined,
        dojo_id: dojoId,
        betrag_brutto: Math.round(betrag * 100) / 100,
        betrag_netto: mwst > 0
          ? parseFloat((betrag / (1 + mwst / 100)).toFixed(2))
          : betrag,
        mwst_betrag: mwst > 0
          ? parseFloat((betrag - betrag / (1 + mwst / 100)).toFixed(2))
          : 0,
        mwst_satz: mwst,
        beschreibung: beschreibung.substring(0, 200),
        // Positionen-Notiz für Transparenz
        notizen: privatPositionen.length > 0
          ? `Privat nicht übernommen: ${privatPositionen.map(p => `${p.beschreibung} (${p.betrag.toFixed(2)} €)`).join(', ')}`
          : undefined,
      };

      const res = await axios.post('/buchhaltung/belege', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (quickFile && res.data?.beleg_id) {
        const fd = new FormData();
        fd.append('datei', quickFile);
        await axios.post(`/buchhaltung/belege/${res.data.beleg_id}/upload`, fd, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
      }
      const privatHinweis = privatPositionen.length > 0
        ? ` (${privatPositionen.length} private Position${privatPositionen.length > 1 ? 'en' : ''} ausgeschlossen)`
        : '';
      setSuccess(`Beleg gespeichert${privatHinweis}`);
      setShowQuickCapture(false);
      loadBelege();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Speichern');
    } finally {
      setQuickLoading(false);
    }
  };

  // Beleg speichern
  const saveBeleg = async () => {
    try {
      setLoading(true);
      setError('');

      if (editingBeleg) {
        await axios.put(`/buchhaltung/belege/${editingBeleg.beleg_id}`, belegForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Datei-Upload beim Bearbeiten
        if (belegFile) {
          const fd = new FormData();
          fd.append('datei', belegFile);
          await axios.post(`/buchhaltung/belege/${editingBeleg.beleg_id}/upload`, fd, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
          });
        }
        setSuccess('Beleg erfolgreich aktualisiert');
      } else {
        const res = await axios.post('/buchhaltung/belege', belegForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        // Datei-Upload direkt nach Erstellung
        if (belegFile && res.data?.beleg_id) {
          try {
            const fd = new FormData();
            fd.append('datei', belegFile);
            await axios.post(`/buchhaltung/belege/${res.data.beleg_id}/upload`, fd, {
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });
          } catch { /* Upload-Fehler ignorieren, Beleg ist gespeichert */ }
        }
        setSuccess('Beleg erfolgreich erstellt');
      }

      setShowBelegModal(false);
      setEditingBeleg(null);
      setBelegFile(null);
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

  // Bank-Transaktion: Beleg-Datei hochladen
  const uploadTxDatei = async (file, txId) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('datei', file);
    try {
      await axios.post(`/buchhaltung/bank-import/transaktion/${txId}/upload`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setSuccess('Anhang hochgeladen');
      setShowTxUploadModal(false);
      setTxUploadId(null);
      loadBankTransaktionen();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Upload');
    }
  };

  // Bank-Transaktion: Anhang löschen
  const deleteTxDatei = async (txId) => {
    try {
      await axios.delete(`/buchhaltung/bank-import/transaktion/${txId}/datei`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccess('Anhang gelöscht');
      loadBankTransaktionen();
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Fehler beim Löschen');
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

  // Anlage EÜR Excel-Export (amtliche Zeilennummern für WISO / ELSTER)
  const exportAnlageEuer = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/buchhaltung/export/anlage-euer', {
        headers: { Authorization: `Bearer ${token}` },
        params: { jahr: selectedJahr, organisation: selectedOrg },
        responseType: 'blob'
      });
      const orgName = selectedOrg !== 'alle' ? selectedOrg.replace(/\s/g, '_') : 'alle';
      const blob = new Blob([response.data],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AnlageEUeR_${selectedJahr}_${orgName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setSuccess('Anlage EÜR Excel heruntergeladen — Zeilennummern direkt in WISO übertragen');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError('Anlage EÜR Export fehlgeschlagen');
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
      rechnungsnummer_extern: '',
      ist_gwg: false,
      privatanteil_prozent: '0'
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
      rechnungsnummer_extern: beleg.rechnungsnummer_extern || '',
      ist_gwg: !!beleg.ist_gwg,
      privatanteil_prozent: String(beleg.privatanteil_prozent || '0')
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

  // BWA laden
  const loadBwa = useCallback(async () => {
    setBwaLoading(true);
    try {
      const res = await axios.get('/buchhaltung/bwa', {
        headers: { Authorization: `Bearer ${token}` },
        params: { jahr: bwaJahr, organisation: selectedOrg !== 'alle' ? selectedOrg : undefined }
      });
      setBwaData(res.data);
    } catch (err) {
      setError('BWA konnte nicht geladen werden');
    } finally {
      setBwaLoading(false);
    }
  }, [token, bwaJahr, selectedOrg]);

  // Altersliste laden
  const loadAltersliste = useCallback(async () => {
    setAlterslisteLoading(true);
    try {
      const res = await axios.get('/buchhaltung/offene-posten/altersliste', {
        headers: { Authorization: `Bearer ${token}` },
        params: { organisation: selectedOrg !== 'alle' ? selectedOrg : undefined }
      });
      setAltersliste(res.data);
    } catch (err) {
      setError('Altersliste konnte nicht geladen werden');
    } finally {
      setAlterslisteLoading(false);
    }
  }, [token, selectedOrg]);

  // Mahnung PDF Download
  const downloadMahnungPdf = async (mahnungId) => {
    setMahnungPdfLoading(prev => ({ ...prev, [mahnungId]: true }));
    try {
      const res = await fetch(`/api/buchhaltung/mahnungen/${mahnungId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Fehler ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Mahnung_${mahnungId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError('PDF-Download fehlgeschlagen: ' + err.message);
    } finally {
      setMahnungPdfLoading(prev => ({ ...prev, [mahnungId]: false }));
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
    { id: 'bwa', label: 'BWA', icon: <BarChart3 size={16} /> },
    { id: 'bilanz', label: 'Bilanz', icon: <Building2 size={16} /> },
    { id: 'belege', label: 'Belegerfassung', icon: <Receipt size={16} /> },
    { id: 'rechnungen', label: 'Rechnungen', icon: <FileText size={16} /> },
    { id: 'auto', label: 'Auto. Buchungen', icon: <RefreshCw size={16} /> },
    { id: 'bankimport', label: 'Kontoauszüge', icon: <Landmark size={16} />, enterprise: true },
    { id: 'steuerauswertung', label: 'Steuerauswertung', icon: <BarChart3 size={16} />, enterprise: true },
    { id: 'abschluss', label: 'Jahresabschluss', icon: <FileSpreadsheet size={16} /> },
    { id: 'anlagen', label: 'Anlagevermögen', icon: <Building2 size={16} /> },
    { id: 'offene-posten', label: 'Offene Posten', icon: <AlertCircle size={16} /> },
    { id: 'wiederkehrend', label: 'Wiederkehrend', icon: <RefreshCw size={16} /> },
    { id: 'kreditoren', label: 'Kreditoren', icon: <FileText size={16} /> },
    { id: 'lohnabrechnung', label: 'Lohnabrechnung', icon: <Euro size={16} /> }
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
          <BuchhaltungEuerTab
            dashboardData={dashboardData} euerData={euerData} belege={belege} kategorien={kategorien} success={success}
            expandedKategorien={expandedKategorien} setExpandedKategorien={setExpandedKategorien}
            editingBuchung={editingBuchung} setEditingBuchung={setEditingBuchung}
            editingBuchungKat={editingBuchungKat} setEditingBuchungKat={setEditingBuchungKat}
            saveBuchungKategorie={saveBuchungKategorie} ladeBeitraegeDetail={ladeBeitraegeDetail}
            ladeVerkaufDetail={ladeVerkaufDetail} formatCurrency={formatCurrency} getKategorieName={getKategorieName}
          />
        )}

        {/* ==================== UStVA TAB ==================== */}
        {activeSubTab === 'ustVA' && (
          <div style={{ marginTop: 8 }}>
            <UStVATab dojoId={dojoId} />
          </div>
        )}

        {/* ==================== GuV TAB ==================== */}
        {activeSubTab === 'guv' && (
          <BuchhaltungGuvTab
            selectedOrg={selectedOrg}
            selectedJahr={selectedJahr}
            selectedQuartal={selectedQuartal}
            loading={loading}
            guvDetails={guvDetails}
            guvSkrData={guvSkrData}
            skrKontorahmen={skrKontorahmen}
            setSkrKontorahmen={setSkrKontorahmen}
            guvAnsicht={guvAnsicht}
            setGuvAnsicht={setGuvAnsicht}
            expandedSkrKonten={expandedSkrKonten}
            setExpandedSkrKonten={setExpandedSkrKonten}
            expandedGuvDetails={expandedGuvDetails}
            setExpandedGuvDetails={setExpandedGuvDetails}
            expandedKategorien={expandedKategorien}
            setExpandedKategorien={setExpandedKategorien}
            fetchGuvSkrData={fetchGuvSkrData}
            formatCurrency={formatCurrency}
          />
        )}

        {/* ==================== BWA TAB ==================== */}
        {activeSubTab === 'bwa' && (
          <BuchhaltungBwaTab
            loading={loading}
            bwaData={bwaData}
            bwaLoading={bwaLoading}
            bwaJahr={bwaJahr}
            setBwaJahr={setBwaJahr}
            jahre={jahre}
            loadBwa={loadBwa}
            formatCurrency={formatCurrency}
          />
        )}

        {/* ==================== BILANZ TAB ==================== */}
        {activeSubTab === 'bilanz' && (
          <BuchhaltungBilanzTab
            selectedOrg={selectedOrg}
            selectedJahr={selectedJahr}
            loading={loading}
            success={success}
            bilanzData={bilanzData}
            editingGewinnvortrag={editingGewinnvortrag}
            setEditingGewinnvortrag={setEditingGewinnvortrag}
            showBilanzStammdatenModal={showBilanzStammdatenModal}
            setShowBilanzStammdatenModal={setShowBilanzStammdatenModal}
            saveGewinnvortrag={saveGewinnvortrag}
            formatCurrency={formatCurrency}
          />
        )}

        {/* ==================== BELEGERFASSUNG ==================== */}
        {activeSubTab === 'belege' && (
          <BuchhaltungBelegeTab
            belege={belege} belegeTotal={belegeTotal} belegePage={belegePage} setBelegePage={setBelegePage}
            showBelegModal={showBelegModal} setShowBelegModal={setShowBelegModal}
            editingBeleg={editingBeleg} setEditingBeleg={setEditingBeleg}
            showUploadModal={showUploadModal} setShowUploadModal={setShowUploadModal}
            uploadBelegId={uploadBelegId} setUploadBelegId={setUploadBelegId}
            openQuickCapture={openQuickCapture} stornoBeleg={stornoBeleg} festschreibenBeleg={festschreibenBeleg}
            resetBelegForm={resetBelegForm} editBeleg={editBeleg}
            formatCurrency={formatCurrency} formatDate={formatDate} getKategorieName={getKategorieName}
          />
        )}

        {/* ==================== RECHNUNGEN ERSTELLEN ==================== */}
        {activeSubTab === 'rechnungen' && (
          <div className="rechnungen-content">
            <VerbandRechnungErstellen token={token} />
          </div>
        )}

        {/* ==================== AUTOMATISCHE BUCHUNGEN ==================== */}
        {activeSubTab === 'auto' && (
          <BuchhaltungAutoTab autoEinnahmen={autoEinnahmen} formatCurrency={formatCurrency} formatDate={formatDate} />
        )}

        {/* ==================== BANK-IMPORT ==================== */}
        {activeSubTab === 'bankimport' && (
          <BuchhaltungBankImportTab
            hasKontoauszug={hasKontoauszug}
            kategorien={kategorien}
            success={success}
            bankTransaktionenTotal={bankTransaktionenTotal}
            bankStatistik={bankStatistik}
            bankImportHistorie={bankImportHistorie}
            autoVorschlagRunning={autoVorschlagRunning}
            alleAnnehmenRunning={alleAnnehmenRunning}
            bankSortField={bankSortField}
            bankSortDirection={bankSortDirection}
            showTxUploadModal={showTxUploadModal}
            setShowTxUploadModal={setShowTxUploadModal}
            txUploadId={txUploadId}
            setTxUploadId={setTxUploadId}
            bankStatusFilter={bankStatusFilter}
            setBankStatusFilter={setBankStatusFilter}
            bankPage={bankPage}
            setBankPage={setBankPage}
            showBankUploadModal={showBankUploadModal}
            setShowBankUploadModal={setShowBankUploadModal}
            showKategorieModal={showKategorieModal}
            setShowKategorieModal={setShowKategorieModal}
            kategorieModalMwst={kategorieModalMwst}
            setKategorieModalMwst={setKategorieModalMwst}
            selectedBankTx={selectedBankTx}
            setSelectedBankTx={setSelectedBankTx}
            selectedBankTxIds={selectedBankTxIds}
            setSelectedBankTxIds={setSelectedBankTxIds}
            bankSearchTerm={bankSearchTerm}
            setBankSearchTerm={setBankSearchTerm}
            bankLimit={bankLimit}
            setBankLimit={setBankLimit}
            bankBetragFilter={bankBetragFilter}
            setBankBetragFilter={setBankBetragFilter}
            bankKategorieFilter={bankKategorieFilter}
            setBankKategorieFilter={setBankKategorieFilter}
            bankDatumVon={bankDatumVon}
            setBankDatumVon={setBankDatumVon}
            bankDatumBis={bankDatumBis}
            setBankDatumBis={setBankDatumBis}
            showUmbuchungModal={showUmbuchungModal}
            setShowUmbuchungModal={setShowUmbuchungModal}
            umbuchungTx={umbuchungTx}
            setUmbuchungTx={setUmbuchungTx}
            showRechnungModal={showRechnungModal}
            setShowRechnungModal={setShowRechnungModal}
            rechnungTx={rechnungTx}
            setRechnungTx={setRechnungTx}
            aehnlicheAnzahl={aehnlicheAnzahl}
            setAehnlicheAnzahl={setAehnlicheAnzahl}
            autoAlleVorschlagen={autoAlleVorschlagen}
            alleVorschlaegeAnnehmen={alleVorschlaegeAnnehmen}
            openReviewModal={openReviewModal}
            ladeAehnliche={ladeAehnliche}
            ignorierenTransaktion={ignorierenTransaktion}
            vorschlagAnnehmen={vorschlagAnnehmen}
            toggleBankTxSelection={toggleBankTxSelection}
            toggleAllBankTx={toggleAllBankTx}
            toggleBankSort={toggleBankSort}
            getFilteredSortedTransaktionen={getFilteredSortedTransaktionen}
            deleteTransaktion={deleteTransaktion}
            loadOffeneRechnungen={loadOffeneRechnungen}
            deleteImport={deleteImport}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            getKategorieName={getKategorieName}
          />
        )}

        {/* ==================== STEUERAUSWERTUNG ==================== */}
        {activeSubTab === 'steuerauswertung' && (
          <BuchhaltungSteuerauswertungTab
            hasKontoauszug={hasKontoauszug} selectedJahr={selectedJahr} loading={loading}
            steuerauswertung={steuerauswertung} steuerLoading={steuerLoading}
            steuerUebertragenLoading={steuerUebertragenLoading} cashflow={cashflow}
            abgleichBericht={abgleichBericht} abgleichFilter={abgleichFilter} setAbgleichFilter={setAbgleichFilter}
            dojoEinstellungen={dojoEinstellungen}
            euerUebertragen={euerUebertragen} formatCurrency={formatCurrency}
          />
        )}

        {/* ==================== JAHRESABSCHLUSS ==================== */}
        {activeSubTab === 'abschluss' && (
          <BuchhaltungAbschlussTab
            selectedOrg={selectedOrg} selectedJahr={selectedJahr} abschlussData={abschlussData} loading={loading}
            showAbschlussModal={showAbschlussModal} setShowAbschlussModal={setShowAbschlussModal}
            exportCSV={exportCSV} exportAnlageEuer={exportAnlageEuer}
            formatCurrency={formatCurrency} formatDate={formatDate} getKategorieName={getKategorieName}
          />
        )}

        {activeSubTab === 'anlagen' && (
          <BuchhaltungAnlagenTab
            selectedJahr={selectedJahr} loading={loading} anlagen={anlagen} anlagenLoading={anlagenLoading}
            showAnlageForm={showAnlageForm} setShowAnlageForm={setShowAnlageForm}
            editingAnlage={editingAnlage} setEditingAnlage={setEditingAnlage}
            anlageAfa={anlageAfa} setAnlageAfa={setAnlageAfa} anlageForm={anlageForm} setAnlageForm={setAnlageForm}
            saveAnlage={saveAnlage} deleteAnlage={deleteAnlage} loadAfaSchedule={loadAfaSchedule}
          />
        )}

        {/* ==================== OFFENE POSTEN + MAHNWESEN ==================== */}
        {activeSubTab === 'offene-posten' && (
          <BuchhaltungOffenePostenTab
            loading={loading} success={success}
            offenePosten={offenePosten} offenePostenLoading={offenePostenLoading}
            showMahnungForm={showMahnungForm} setShowMahnungForm={setShowMahnungForm}
            mahnungForm={mahnungForm} setMahnungForm={setMahnungForm}
            offeneRechnungen={offeneRechnungen}
            altersliste={altersliste} alterslisteLoading={alterslisteLoading}
            showAltersliste={showAltersliste} setShowAltersliste={setShowAltersliste}
            mahnungPdfLoading={mahnungPdfLoading}
            saveMahnung={saveMahnung} mahnungVersandt={mahnungVersandt} mahnungBezahlt={mahnungBezahlt}
            loadAltersliste={loadAltersliste} downloadMahnungPdf={downloadMahnungPdf} formatCurrency={formatCurrency}
          />
        )}

        {/* ==================== WIEDERKEHRENDE BUCHUNGEN ==================== */}
        {activeSubTab === 'wiederkehrend' && (
          <BuchhaltungWiederkehrendTab
            selectedOrg={selectedOrg} kategorien={kategorien} loading={loading} success={success}
            wiederkehrend={wiederkehrend} wiederkehrendLoading={wiederkehrendLoading}
            showWiederkehrendForm={showWiederkehrendForm} setShowWiederkehrendForm={setShowWiederkehrendForm}
            editingTemplate={editingTemplate} setEditingTemplate={setEditingTemplate}
            templateForm={templateForm} setTemplateForm={setTemplateForm}
            ausfuehrenRunning={ausfuehrenRunning} saveTemplate={saveTemplate} deleteTemplate={deleteTemplate} templateAusfuehren={templateAusfuehren}
          />
        )}

        {/* ==================== KREDITOREN / LIEFERANTENAKTE ==================== */}
        {activeSubTab === 'kreditoren' && (
          <BuchhaltungKreditorenTab
            selectedOrg={selectedOrg} loading={loading} kreditoren={kreditoren} kreditorenLoading={kreditorenLoading}
            showKreditorForm={showKreditorForm} setShowKreditorForm={setShowKreditorForm}
            editingKreditor={editingKreditor} setEditingKreditor={setEditingKreditor}
            kreditorForm={kreditorForm} setKreditorForm={setKreditorForm}
            saveKreditor={saveKreditor} deleteKreditor={deleteKreditor}
          />
        )}

        {/* ==================== LOHNABRECHNUNG TAB ==================== */}
        {activeSubTab === 'lohnabrechnung' && (
          <div className="lohnabrechnung-content">
            <div className="section-header">
              <h3><Euro size={18} /> Lohnabrechnung</h3>
            </div>
            <LohnTab token={token} />
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

              {/* GWG-Hinweis */}
              {belegForm.buchungsart === 'ausgabe' && parseFloat(belegForm.betrag_netto) > 0 && parseFloat(belegForm.betrag_netto) <= 800 && (
                <div className="gwg-hinweis">
                  <span className="gwg-icon">💡</span>
                  <span>
                    <strong>GWG-Grenze:</strong> Netto ≤ 800 € → Sofortabschreibung möglich (§ 6 Abs. 2 EStG).
                    Kein Anlagenregister nötig.
                  </span>
                  <label className="gwg-checkbox-label">
                    <input type="checkbox" checked={belegForm.ist_gwg}
                      onChange={e => setBelegForm(f => ({ ...f, ist_gwg: e.target.checked }))} />
                    Als GWG buchen
                  </label>
                </div>
              )}

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

              {/* Privatanteil */}
              {belegForm.buchungsart === 'ausgabe' && (
                <div className="form-group privatanteil-group">
                  <label>Privatanteil (%)</label>
                  <div className="privatanteil-row">
                    <input
                      type="number" min="0" max="100" step="5"
                      value={belegForm.privatanteil_prozent}
                      onChange={e => setBelegForm(f => ({ ...f, privatanteil_prozent: e.target.value }))}
                      placeholder="0"
                    />
                    {parseFloat(belegForm.privatanteil_prozent) > 0 && (
                      <span className="privatanteil-info">
                        Betriebsanteil: {(100 - parseFloat(belegForm.privatanteil_prozent)).toFixed(0)} % →{' '}
                        {formatCurrency(parseFloat(belegForm.betrag_netto || 0) * (1 + parseFloat(belegForm.mwst_satz || 0) / 100) * (1 - parseFloat(belegForm.privatanteil_prozent) / 100))} in EÜR
                      </span>
                    )}
                  </div>
                </div>
              )}

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
                <div className="form-group" style={{ position: 'relative' }}>
                  <label>Lieferant / Kunde</label>
                  <input
                    type="text"
                    value={belegForm.lieferant_kunde}
                    onChange={e => {
                      setBelegForm(f => ({ ...f, lieferant_kunde: e.target.value }));
                      searchKreditoren(e.target.value);
                    }}
                    onBlur={() => setTimeout(() => setKreditorSuggestions([]), 200)}
                    placeholder="Name des Lieferanten/Kunden"
                  />
                  {kreditorSuggestions.length > 0 && (
                    <ul className="kreditor-suggestions">
                      {kreditorSuggestions.map(k => (
                        <li key={k.kreditor_id} onMouseDown={() => {
                          setBelegForm(f => ({ ...f, lieferant_kunde: k.name }));
                          setKreditorSuggestions([]);
                        }}>{k.name}{k.kurzname ? ` (${k.kurzname})` : ''}</li>
                      ))}
                    </ul>
                  )}
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

              {/* Datei-Anhang */}
              <div className="form-group beleg-datei-upload"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setBelegFile(f); }}
              >
                <label>Beleg / Rechnung (optional)</label>
                {belegFile ? (
                  <div className="beleg-datei-preview">
                    <FileText size={16} />
                    <span>{belegFile.name}</span>
                    <button type="button" className="beleg-datei-del" onClick={() => setBelegFile(null)}>×</button>
                  </div>
                ) : (
                  <label className="beleg-datei-drop">
                    <Upload size={20} />
                    <span>PDF, JPG oder PNG hier ablegen oder klicken</span>
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}}
                      onChange={e => { const f = e.target.files[0]; if (f) setBelegFile(f); }}
                    />
                  </label>
                )}
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

      {/* ==================== QUICK FOTO CAPTURE MODAL ==================== */}
      {showQuickCapture && (
        <div className="modal-overlay" onClick={() => setShowQuickCapture(false)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><Camera size={18} style={{ marginRight: 8 }} />Beleg fotografieren</h3>
              <button className="close-btn" onClick={() => setShowQuickCapture(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Foto-Bereich */}
              {quickPreview ? (
                <div style={{ position: 'relative', textAlign: 'center' }}>
                  <img
                    src={quickPreview}
                    alt="Beleg-Vorschau"
                    style={{ maxWidth: '100%', maxHeight: 240, borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', objectFit: 'contain' }}
                  />
                  <button
                    onClick={() => { setQuickFile(null); setQuickPreview(null); setQuickOcrDone(false); }}
                    style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.7)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: 'var(--ds-text)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={14} />
                  </button>
                  {/* OCR Status Badge */}
                  {quickOcrLoading && (
                    <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,.85)', color: '#ffd700', borderRadius: 20, padding: '5px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                      <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                      KI liest Beleg aus…
                    </div>
                  )}
                  {quickOcrDone && !quickOcrLoading && (
                    <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', background: 'rgba(16,185,129,.9)', color: 'var(--ds-text)', borderRadius: 20, padding: '5px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
                      <CheckCircle size={12} />
                      KI hat Daten ausgelesen — bitte prüfen
                    </div>
                  )}
                </div>
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '32px 20px', border: '2px dashed rgba(255,215,0,.4)', borderRadius: 10, cursor: 'pointer', background: 'rgba(255,215,0,.03)', minHeight: 180 }}>
                  <Camera size={48} style={{ color: '#ffd700', opacity: 0.8 }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Foto aufnehmen oder auswählen</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Auf dem Handy öffnet sich die Kamera direkt</div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={e => handleQuickFile(e.target.files[0])}
                  />
                </label>
              )}

              {/* Kopfdaten: Datum / Lieferant / Typ */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Datum</label>
                  <input type="date" value={quickForm.beleg_datum}
                    onChange={e => setQuickForm(f => ({ ...f, beleg_datum: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Typ</label>
                  <select value={quickForm.buchungsart}
                    onChange={e => setQuickForm(f => ({ ...f, buchungsart: e.target.value, kategorie: '' }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                  >
                    <option value="ausgabe">Ausgabe</option>
                    <option value="einnahme">Einnahme</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Lieferant / Geschäft</label>
                  <input type="text" placeholder="z.B. REWE, MediaMarkt…"
                    value={quickForm.lieferant}
                    onChange={e => setQuickForm(f => ({ ...f, lieferant: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Kategorie</label>
                  <select value={quickForm.kategorie}
                    onChange={e => setQuickForm(f => ({ ...f, kategorie: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                  >
                    <option value="">— Kategorie —</option>
                    {kategorien.filter(k => !k.typ || k.typ === quickForm.buchungsart).map(k => (
                      <option key={k.id} value={k.id}>{k.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Positionen-Liste */}
              {quickOcrLoading && (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite', marginRight: 6 }} />
                  KI liest Positionen aus…
                </div>
              )}

              {!quickOcrLoading && quickPositionen.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                      Positionen — Tippe auf eine Zeile um Betrieb ↔ Privat umzuschalten
                    </label>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {quickPositionen.filter(p => p.typ === 'privat').length > 0 &&
                        `${quickPositionen.filter(p => p.typ === 'privat').length} privat`}
                    </div>
                  </div>
                  <div style={{ border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, overflow: 'hidden' }}>
                    {quickPositionen.map((pos, i) => (
                      <div
                        key={pos.id}
                        onClick={() => togglePositionTyp(pos.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          cursor: 'pointer', userSelect: 'none',
                          borderBottom: i < quickPositionen.length - 1 ? '1px solid rgba(255,255,255,.06)' : 'none',
                          background: pos.typ === 'privat' ? 'rgba(239,68,68,.06)' : 'rgba(16,185,129,.04)',
                          transition: 'background .15s',
                        }}
                      >
                        {/* Toggle-Pill */}
                        <div style={{
                          flexShrink: 0, width: 72, borderRadius: 20, padding: '3px 8px',
                          fontSize: 11, fontWeight: 700, textAlign: 'center',
                          background: pos.typ === 'betrieb' ? 'rgba(16,185,129,.2)' : 'rgba(239,68,68,.2)',
                          color: pos.typ === 'betrieb' ? '#10b981' : '#ef4444',
                          border: `1px solid ${pos.typ === 'betrieb' ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.4)'}`,
                        }}>
                          {pos.typ === 'betrieb' ? 'Betrieb' : 'Privat'}
                        </div>
                        {/* Beschreibung */}
                        <span style={{
                          flex: 1, fontSize: 13, lineHeight: 1.3,
                          color: pos.typ === 'privat' ? 'var(--text-muted)' : 'var(--text-primary)',
                          textDecoration: pos.typ === 'privat' ? 'line-through' : 'none',
                        }}>
                          {pos.beschreibung}
                        </span>
                        {/* MwSt Badge */}
                        <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>
                          {pos.mwst_satz}%
                        </span>
                        {/* Betrag */}
                        <span style={{
                          fontFamily: 'monospace', fontSize: 13, fontWeight: 600, flexShrink: 0, minWidth: 60, textAlign: 'right',
                          color: pos.typ === 'privat' ? 'var(--text-muted)' : 'var(--text-primary)',
                        }}>
                          {pos.betrag.toFixed(2)} €
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Keine Positionen — manuelle Eingabe */}
              {!quickOcrLoading && quickPositionen.length === 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Betrag brutto *</label>
                    <input type="number" step="0.01" min="0" placeholder="0,00" autoFocus
                      value={quickForm.betrag_brutto || ''}
                      onChange={e => setQuickForm(f => ({ ...f, betrag_brutto: e.target.value }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 16, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>MwSt.</label>
                    <select value={quickForm.mwst_satz}
                      onChange={e => setQuickForm(f => ({ ...f, mwst_satz: parseInt(e.target.value) }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                    >
                      <option value={19}>19 %</option>
                      <option value={7}>7 %</option>
                      <option value={0}>0 %</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Summen-Box */}
              {!quickOcrLoading && quickPositionen.length > 0 && (
                <div style={{ background: 'rgba(255,215,0,.06)', border: '1px solid rgba(255,215,0,.2)', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-muted)' }}>Gesamtbetrag Beleg:</span>
                    <span style={{ fontFamily: 'monospace' }}>
                      {quickPositionen.reduce((s, p) => s + p.betrag, 0).toFixed(2)} €
                    </span>
                  </div>
                  {quickPositionen.some(p => p.typ === 'privat') && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: '#ef4444' }}>Privat (wird nicht gebucht):</span>
                      <span style={{ fontFamily: 'monospace', color: '#ef4444' }}>
                        − {quickPositionen.filter(p => p.typ === 'privat').reduce((s, p) => s + p.betrag, 0).toFixed(2)} €
                      </span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, borderTop: '1px solid rgba(255,215,0,.2)', paddingTop: 6, marginTop: 4 }}>
                    <span style={{ color: '#10b981' }}>Betriebsausgabe:</span>
                    <span style={{ fontFamily: 'monospace', color: '#10b981' }}>
                      {quickBetriebsSumme.toFixed(2)} €
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowQuickCapture(false)}>Abbrechen</button>
              <button
                className="btn-primary"
                onClick={saveQuickBeleg}
                disabled={quickLoading || (quickPositionen.length === 0 && !quickForm.betrag_brutto && !quickForm.lieferant)}
              >
                {quickLoading
                  ? 'Speichern...'
                  : quickPositionen.length > 0
                    ? `📷 ${quickBetriebsSumme.toFixed(2)} € buchen`
                    : (quickFile ? '📷 Beleg speichern' : '💾 Speichern')}
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

      {/* ==================== TX ANHANG MODAL ==================== */}
      {showTxUploadModal && (
        <div className="modal-overlay" onClick={() => { setShowTxUploadModal(false); setTxUploadId(null); }}>
          <div className="modal upload-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Quittung / Rechnung anhängen</h3>
              <button className="close-btn" onClick={() => { setShowTxUploadModal(false); setTxUploadId(null); }}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="upload-dropzone"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && txUploadId) uploadTxDatei(f, txUploadId); }}
              >
                <Upload size={40} />
                <p>PDF, JPG oder PNG hier ablegen</p>
                <p className="upload-sub">oder klicken zum Auswählen (max. 10 MB)</p>
                <label className="btn-primary upload-btn">
                  Datei auswählen
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}}
                    onChange={e => { const f = e.target.files[0]; if (f && txUploadId) uploadTxDatei(f, txUploadId); }}
                  />
                </label>
              </div>
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
                    CSV, XLS, XLSX, MT940 (STA), PDF oder XML (camt.052/053)
                  </p>
                  <p className="upload-hint" style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>
                    Holvi: Berichte → Elektronischer Kontoauszug → XML
                  </p>
                </div>
                <input
                  type="file"
                  accept=".csv,.sta,.mt940,.txt,.xls,.xlsx,.pdf,application/pdf,.xml,text/xml,application/xml"
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
        <div className="modal-overlay kategorie-overlay" onClick={() => { setShowKategorieModal(false); setReviewKategorieMode(false); }}>
          <div className="modal kategorie-modal kategorie-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {selectedBankTxIds.length > 0 && !selectedBankTx
                  ? `${selectedBankTxIds.length} Transaktionen zuordnen`
                  : 'Kategorie zuordnen'}
              </h3>
              <button className="close-btn" onClick={() => { setShowKategorieModal(false); setReviewKategorieMode(false); setSelectedBankTx(null); }}>
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

              {!dojoEinstellungen.kleinunternehmer && (
              <div className="kategorie-mwst-row">
                <label>MwSt-Satz für diesen Beleg:</label>
                <div className="kategorie-mwst-btns">
                  {[
                    { val: '0',  label: '0%', hint: 'Ausland, steuerfreie Leistung' },
                    { val: '7',  label: '7%', hint: 'Ermäßigt' },
                    { val: '19', label: '19%', hint: 'Regelsteuersatz' }
                  ].map(opt => (
                    <button
                      key={opt.val}
                      className={`mwst-opt-btn ${kategorieModalMwst === opt.val ? 'active' : ''}`}
                      onClick={() => setKategorieModalMwst(opt.val)}
                      title={opt.hint}
                      type="button"
                    >
                      {opt.label}
                      {opt.hint && <span className="mwst-hint">{opt.hint}</span>}
                    </button>
                  ))}
                </div>
              </div>
              )}

              <div className="kategorie-grid">
                {kategorien.map(kat => (
                  <button
                    key={kat.id}
                    className={`kategorie-btn ${kat.typ}`}
                    onClick={() => {
                      if (reviewKategorieMode) {
                        reviewZuordnen(kat.id);
                      } else if (selectedBankTxIds.length > 0 && !selectedBankTx) {
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
              <button className="close-btn" onClick={() => setBeitraegeDetail(null)}><X size={20} /></button>
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
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setBeitraegeDetail(null)}>
                <X size={14} /> Schließen
              </button>
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
              <button className="close-btn" onClick={() => setVerkaufDetail(null)}><X size={20} /></button>
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
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setVerkaufDetail(null)}>
                <X size={14} /> Schließen
              </button>
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

      {/* ==================== REVIEW MODAL ==================== */}
      {showReviewModal && !reviewKategorieMode && (() => {
        const tx = reviewQueue[reviewIndex];
        const isDone = reviewIndex >= reviewQueue.length;
        const total = reviewQueue.length;
        const progressPct = Math.round((reviewIndex / total) * 100);

        let matchDetails = null;
        if (tx) {
          try { matchDetails = typeof tx.match_details === 'string' ? JSON.parse(tx.match_details) : tx.match_details; } catch (_) {}
        }
        const vorschlagKat = matchDetails?.kategorie || (tx?.betrag > 0 ? 'Betriebseinnahmen' : 'Sonstige Kosten');
        const isFallback = matchDetails?.quelle === 'fallback';
        const confidence = matchDetails?.confidence ?? (isFallback ? 0.30 : 0.65);

        return (
          <div className="modal-overlay review-overlay" onClick={() => setShowReviewModal(false)}>
            <div className="modal review-modal" onClick={e => e.stopPropagation()}>
              <div className="review-modal-header">
                <div className="review-progress-bar">
                  <div className="review-progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <div className="review-header-row">
                  <span className="review-counter">
                    {isDone ? `Fertig! ${total} Vorschläge` : `${reviewIndex + 1} von ${total}`}
                  </span>
                  <div className="review-stats-mini">
                    <span title="Angenommen">✅ {reviewStats.angenommen}</span>
                    <span title="Kategorie geändert">✏️ {reviewStats.geaendert}</span>
                    <span title="Übersprungen">⏭️ {reviewStats.uebersprungen}</span>
                  </div>
                  <button className="close-btn" onClick={() => setShowReviewModal(false)}><X size={20} /></button>
                </div>
              </div>

              <div className="review-modal-body">
                {isDone ? (
                  <div className="review-summary">
                    <div className="review-summary-icon">🎉</div>
                    <h3>Alle Vorschläge geprüft!</h3>
                    <div className="review-summary-stats">
                      <div className="review-summary-stat">
                        <span className="stat-number accepted">{reviewStats.angenommen}</span>
                        <span className="stat-label">Angenommen</span>
                      </div>
                      <div className="review-summary-stat">
                        <span className="stat-number changed">{reviewStats.geaendert}</span>
                        <span className="stat-label">Kategorie geändert</span>
                      </div>
                      <div className="review-summary-stat">
                        <span className="stat-number skipped">{reviewStats.uebersprungen}</span>
                        <span className="stat-label">Übersprungen</span>
                      </div>
                    </div>
                    <button className="btn-primary review-close-btn" onClick={() => {
                      setShowReviewModal(false);
                      loadBankTransaktionen();
                      loadBankStatistik();
                    }}>
                      Schließen &amp; Aktualisieren
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="review-tx-card">
                      <div className="review-tx-betrag">
                        <span className={parseFloat(tx.betrag) >= 0 ? 'einnahme' : 'ausgabe'}>
                          {parseFloat(tx.betrag) >= 0 ? '+' : ''}{formatCurrency(tx.betrag)}
                        </span>
                        <span className="review-tx-datum">{formatDate(tx.buchungsdatum)}</span>
                      </div>
                      <div className="review-vorschlag review-vorschlag-inline">
                        <span className="review-vorschlag-icon">{isFallback ? '❓' : '💡'}</span>
                        <span className="review-vorschlag-kat">{vorschlagKat}</span>
                        <span className="review-confidence">{Math.round(confidence * 100)}% Konfidenz</span>
                      </div>
                      <div className="review-tx-name">{tx.auftraggeber_empfaenger || '—'}</div>
                      {tx.verwendungszweck && (
                        <div className="review-tx-vwz">{tx.verwendungszweck}</div>
                      )}
                      {tx.organisation_name && (
                        <div className="review-tx-org">{tx.organisation_name}</div>
                      )}
                      {/* Anhang-Bereich */}
                      <div className="review-anhang-row">
                        {tx.datei_name ? (
                          <>
                            <a
                              href={`/api/buchhaltung/bank-import/transaktion/${tx.transaktion_id}/datei`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="review-anhang-badge"
                              title={tx.datei_name}
                            >
                              <FileText size={13} /> {tx.datei_name}
                            </a>
                            <button
                              className="review-anhang-del"
                              title="Anhang entfernen"
                              onClick={async () => { await deleteTxDatei(tx.transaktion_id); setReviewQueue(q => q.map((t,i) => i === reviewIndex ? {...t, datei_name: null, datei_typ: null} : t)); }}
                            >×</button>
                          </>
                        ) : (
                          <label className="review-anhang-upload" title="Quittung / Rechnung anhängen">
                            <Upload size={13} /> Quittung anhängen
                            <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{display:'none'}}
                              onChange={async (e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                await uploadTxDatei(file, tx.transaktion_id);
                                setReviewQueue(q => q.map((t,i) => i === reviewIndex ? {...t, datei_name: file.name, datei_typ: file.type} : t));
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {!dojoEinstellungen.kleinunternehmer && (
                    <div className="review-mwst-row">
                      <span className="review-mwst-label">MwSt:</span>
                      {[
                        { val: '0',  label: '0%',  hint: 'Ausland / steuerfrei' },
                        { val: '7',  label: '7%',  hint: '' },
                        { val: '19', label: '19%', hint: 'Standard' }
                      ].map(opt => (
                        <button
                          key={opt.val}
                          className={`review-mwst-btn ${reviewMwst === opt.val ? 'active' : ''}`}
                          onClick={() => setReviewMwst(opt.val)}
                          title={opt.hint}
                          type="button"
                        >{opt.label}</button>
                      ))}
                    </div>
                    )}

                    <div className="review-actions">
                      <button
                        className="review-btn review-btn-accept"
                        onClick={reviewVorschlagAnnehmen}
                        disabled={reviewAccepting}
                        title="Vorschlag annehmen (Enter)"
                      >
                        {reviewAccepting ? <span className="spinner-xs" /> : '✅'} Annehmen
                      </button>
                      <button
                        className="review-btn review-btn-change"
                        onClick={() => {
                          setSelectedBankTx(tx);
                          setKategorieModalMwst(reviewMwst);
                          setReviewKategorieMode(true);
                          setShowKategorieModal(true);
                        }}
                        title="Andere Kategorie wählen"
                      >
                        ✏️ Ändern
                      </button>
                      <button
                        className="review-btn review-btn-skip"
                        onClick={() => {
                          setReviewStats(prev => ({ ...prev, uebersprungen: prev.uebersprungen + 1 }));
                          setReviewIndex(prev => prev + 1);
                          setReviewMwst('19');
                        }}
                        title="Überspringen (→)"
                      >
                        ⏭️ Überspringen
                      </button>
                      <button
                        className="review-btn review-btn-ignore"
                        onClick={async () => {
                          try {
                            await axios.post(`/buchhaltung/bank-import/ignorieren/${tx.transaktion_id}`, { lerne_regel: false }, { headers: { Authorization: `Bearer ${token}` } });
                            setReviewIndex(prev => prev + 1);
                            loadBankStatistik();
                          } catch (_) {}
                        }}
                        title="Ignorieren"
                      >
                        🚫 Ignorieren
                      </button>
                    </div>

                    <div className="review-keyboard-hint">
                      <kbd>Enter</kbd> Annehmen &nbsp;&middot;&nbsp;
                      <kbd>→</kbd> Überspringen &nbsp;&middot;&nbsp;
                      <kbd>←</kbd> Zurück &nbsp;&middot;&nbsp;
                      <kbd>Esc</kbd> Schließen
                    </div>

                    {reviewIndex > 0 && (
                      <button className="review-back-btn" onClick={() => setReviewIndex(prev => Math.max(0, prev - 1))}>
                        ← Zurück
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
