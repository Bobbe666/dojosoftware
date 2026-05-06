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
  const [quickForm, setQuickForm] = useState({
    betrag_brutto: '',
    buchungsart: 'ausgabe',
    beleg_datum: new Date().toISOString().split('T')[0],
    beschreibung: '',
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

  // Quick-Capture: Foto-Auswahl + automatisch OCR
  const handleQuickFile = async (file) => {
    if (!file) return;
    setQuickFile(file);
    setQuickOcrDone(false);
    const reader = new FileReader();
    reader.onload = (e) => setQuickPreview(e.target.result);
    reader.readAsDataURL(file);

    // OCR direkt starten
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
        betrag_brutto: ocr.betrag_brutto != null ? String(ocr.betrag_brutto) : f.betrag_brutto,
        mwst_satz: ocr.mwst_satz != null ? ocr.mwst_satz : f.mwst_satz,
        beleg_datum: ocr.datum || f.beleg_datum,
        beschreibung: ocr.lieferant
          ? `${ocr.lieferant}${ocr.beschreibung ? ' – ' + ocr.beschreibung : ''}`
          : (ocr.beschreibung || f.beschreibung),
        buchungsart: ocr.buchungsart || f.buchungsart,
      }));
      setQuickOcrDone(true);
    } catch {
      // OCR fehlgeschlagen — Felder bleiben leer, User füllt manuell aus
    } finally {
      setQuickOcrLoading(false);
    }
  };

  const openQuickCapture = () => {
    setQuickFile(null);
    setQuickPreview(null);
    setQuickOcrLoading(false);
    setQuickOcrDone(false);
    setQuickForm({
      betrag_brutto: '',
      buchungsart: 'ausgabe',
      beleg_datum: new Date().toISOString().split('T')[0],
      beschreibung: '',
      kategorie: '',
      mwst_satz: 19,
    });
    setShowQuickCapture(true);
  };

  const saveQuickBeleg = async () => {
    if (!quickForm.betrag_brutto) return;
    setQuickLoading(true);
    setError('');
    try {
      const betrag = parseFloat(quickForm.betrag_brutto);
      const mwst = quickForm.mwst_satz;
      const payload = {
        ...quickForm,
        betrag_brutto: betrag,
        betrag_netto: mwst > 0 ? parseFloat((betrag / (1 + mwst / 100)).toFixed(2)) : betrag,
        mwst_betrag: mwst > 0 ? parseFloat((betrag - betrag / (1 + mwst / 100)).toFixed(2)) : 0,
        organisation_name: selectedOrg !== 'alle' ? selectedOrg : undefined,
        dojo_id: dojoId,
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
      setSuccess('Beleg mit Foto gespeichert');
      setShowQuickCapture(false);
      loadBelege();
      setTimeout(() => setSuccess(''), 3000);
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
                                <td colSpan="2">
                                  <span className="detail-row-indent">
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
                                  title={buchung.drilldown ? 'Klicken für Details' : undefined}
                                >
                                  <td colSpan="2">
                                    <span className="einzelbuchung-indent">
                                      {buchung.drilldown && <ChevronRight size={11} />}
                                      {new Date(buchung.datum).toLocaleDateString('de-DE')} – {buchung.beschreibung || 'Keine Beschreibung'}
                                    </span>
                                  </td>
                                  <td className="right">{formatCurrency(buchung.betrag)}</td>
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
                                <td colSpan="2">
                                  <span className="detail-row-indent">
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
                                  <td colSpan="2">
                                    <span className="einzelbuchung-indent">
                                      {new Date(buchung.datum).toLocaleDateString('de-DE')} – {buchung.beschreibung || 'Keine Beschreibung'}
                                    </span>
                                  </td>
                                  <td className="right">{formatCurrency(buchung.betrag)}</td>
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
              <h3>Gewinn- und Verlustrechnung {selectedJahr}</h3>
              <div className="header-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => openApiBlob(`/api/buchhaltung/guv/export?organisation=${selectedOrg}&jahr=${selectedJahr}&format=csv&quartal=${selectedQuartal}`, { download: true, filename: `guv-${selectedJahr}.csv` })}
                >
                  <Download size={16} />
                  CSV
                </button>
              </div>
            </div>

            {/* Ansichts-Toggle */}
            <div className="guv-view-toggle">
              <span className="guv-toggle-label">Ansicht:</span>
              <div className="guv-skr-toggle">
                <button
                  className={`guv-skr-btn${guvAnsicht === 'standard' ? ' active' : ''}`}
                  onClick={() => setGuvAnsicht('standard')}
                >Standard</button>
                <button
                  className={`guv-skr-btn${guvAnsicht === 'skr' && skrKontorahmen === 'SKR03' ? ' active' : ''}`}
                  onClick={() => { setGuvAnsicht('skr'); setSkrKontorahmen('SKR03'); fetchGuvSkrData('SKR03'); }}
                >SKR 03</button>
                <button
                  className={`guv-skr-btn${guvAnsicht === 'skr' && skrKontorahmen === 'SKR04' ? ' active' : ''}`}
                  onClick={() => { setGuvAnsicht('skr'); setSkrKontorahmen('SKR04'); fetchGuvSkrData('SKR04'); }}
                >SKR 04</button>
              </div>
            </div>

            {loading && <div className="loading">Lade GuV-Daten...</div>}

            {/* ---- STANDARD-ANSICHT ---- */}
            {guvAnsicht === 'standard' && guvDetails && (
              <div className="guv-details">
                <table className="guv-table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th className="right">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="section-header-row">
                      <td colSpan="2"><strong>1. Umsatzerlöse</strong></td>
                    </tr>
                    <tr
                      className="bt-cursor-pointer"
                      onClick={() => setExpandedKategorien(prev => ({ ...prev, 'guv_umsatz': !prev['guv_umsatz'] }))}
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

                    <tr className="section-header-row">
                      <td colSpan="2"><strong>2. Materialaufwand</strong></td>
                    </tr>
                    <tr
                      className={guvDetails.materialaufwand.details.length > 0 ? 'bt-cursor-pointer' : ''}
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
                        <tr className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' bt-cursor-pointer' : ''}`}
                          onClick={detail.einzelbuchungen?.length > 0 ? () => setExpandedGuvDetails(prev => ({ ...prev, [`material_${idx}`]: !prev[`material_${idx}`] })) : undefined}>
                          <td className="bt-pl-4"><span className="bt-flex-icon">{detail.einzelbuchungen?.length > 0 && (expandedGuvDetails[`material_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}{detail.quelle}</span></td>
                          <td className="right negative">-{formatCurrency(detail.betrag)}</td>
                        </tr>
                        {expandedGuvDetails[`material_${idx}`] && detail.einzelbuchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row"><td className="bt-cell-sub bt-pl-6">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td><td className="right bt-cell-sub-right">-{formatCurrency(buch.betrag)}</td></tr>
                        ))}
                      </React.Fragment>
                    ))}

                    <tr className="section-header-row">
                      <td colSpan="2"><strong>3. Personalaufwand</strong></td>
                    </tr>
                    <tr className={guvDetails.personalaufwand.details.length > 0 ? 'bt-cursor-pointer' : ''} onClick={() => setExpandedKategorien(prev => ({ ...prev, 'guv_personal': !prev['guv_personal'] }))}>
                      <td className="bt-pl-2">{guvDetails.personalaufwand.details.length > 0 && (expandedKategorien['guv_personal'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}{' '}Personalaufwand</td>
                      <td className="right negative">-{formatCurrency(guvDetails.personalaufwand.gesamt)}</td>
                    </tr>
                    {expandedKategorien['guv_personal'] && guvDetails.personalaufwand.details.map((detail, idx) => (
                      <React.Fragment key={idx}>
                        <tr className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' bt-cursor-pointer' : ''}`} onClick={detail.einzelbuchungen?.length > 0 ? () => setExpandedGuvDetails(prev => ({ ...prev, [`personal_${idx}`]: !prev[`personal_${idx}`] })) : undefined}>
                          <td className="bt-pl-4"><span className="bt-flex-icon">{detail.einzelbuchungen?.length > 0 && (expandedGuvDetails[`personal_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}{detail.quelle}</span></td>
                          <td className="right negative">-{formatCurrency(detail.betrag)}</td>
                        </tr>
                        {expandedGuvDetails[`personal_${idx}`] && detail.einzelbuchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row"><td className="bt-cell-sub bt-pl-6">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td><td className="right bt-cell-sub-right">-{formatCurrency(buch.betrag)}</td></tr>
                        ))}
                      </React.Fragment>
                    ))}

                    <tr className="section-header-row"><td colSpan="2"><strong>4. Abschreibungen</strong></td></tr>
                    <tr><td className="bt-pl-2">Abschreibungen auf Sachanlagen</td><td className="right negative">-{formatCurrency(guvDetails.abschreibungen.gesamt)}</td></tr>

                    <tr className="section-header-row"><td colSpan="2"><strong>5. Sonstige betriebliche Aufwendungen</strong></td></tr>
                    <tr className={guvDetails.sonstige_aufwendungen.details.length > 0 ? 'bt-cursor-pointer' : ''} onClick={() => setExpandedKategorien(prev => ({ ...prev, 'guv_sonstige': !prev['guv_sonstige'] }))}>
                      <td className="bt-pl-2">{guvDetails.sonstige_aufwendungen.details.length > 0 && (expandedKategorien['guv_sonstige'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}{' '}Sonstige Aufwendungen</td>
                      <td className="right negative">-{formatCurrency(guvDetails.sonstige_aufwendungen.gesamt)}</td>
                    </tr>
                    {expandedKategorien['guv_sonstige'] && guvDetails.sonstige_aufwendungen.details.map((detail, idx) => (
                      <React.Fragment key={idx}>
                        <tr className={`detail-row${detail.einzelbuchungen?.length > 0 ? ' bt-cursor-pointer' : ''}`} onClick={detail.einzelbuchungen?.length > 0 ? () => setExpandedGuvDetails(prev => ({ ...prev, [`sonstige_${idx}`]: !prev[`sonstige_${idx}`] })) : undefined}>
                          <td className="bt-pl-4"><span className="bt-flex-icon">{detail.einzelbuchungen?.length > 0 && (expandedGuvDetails[`sonstige_${idx}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}{detail.kategorie} ({detail.quelle})</span></td>
                          <td className="right negative">-{formatCurrency(detail.betrag)}</td>
                        </tr>
                        {expandedGuvDetails[`sonstige_${idx}`] && detail.einzelbuchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row"><td className="bt-cell-sub bt-pl-6">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td><td className="right bt-cell-sub-right">-{formatCurrency(buch.betrag)}</td></tr>
                        ))}
                      </React.Fragment>
                    ))}

                    {/* HGB §275 Zwischensummen */}
                    <tr className="subtotal-row">
                      <td><strong>= Betriebsergebnis (EBIT)</strong></td>
                      <td className={`right ${(guvDetails.ebit ?? guvDetails.jahresueberschuss) >= 0 ? 'positive' : 'negative'}`}>
                        <strong>{formatCurrency(guvDetails.ebit ?? guvDetails.jahresueberschuss)}</strong>
                      </td>
                    </tr>
                    {(guvDetails.ebt !== undefined && guvDetails.ebt !== guvDetails.ebit) && (
                      <tr className="subtotal-row">
                        <td><strong>= Ergebnis vor Steuern (EBT)</strong></td>
                        <td className={`right ${guvDetails.ebt >= 0 ? 'positive' : 'negative'}`}>
                          <strong>{formatCurrency(guvDetails.ebt)}</strong>
                        </td>
                      </tr>
                    )}
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

            {/* ---- SKR-ANSICHT ---- */}
            {guvAnsicht === 'skr' && guvSkrData && (
              <div className="guv-skr-container">
                {guvSkrData.kleinunternehmer && (
                  <div className="skr-hinweis">
                    Kleinunternehmer §19 UStG — Umsätze werden als steuerfreie Erlöse ausgewiesen
                  </div>
                )}
                <table className="guv-table skr-table">
                  <thead>
                    <tr>
                      <th className="skr-konto-col">Konto</th>
                      <th>Bezeichnung</th>
                      <th className="right">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* EINNAHMEN */}
                    <tr className="section-header-row">
                      <td colSpan="3"><strong>BETRIEBSEINNAHMEN</strong></td>
                    </tr>
                    {guvSkrData.einnahmen.map((konto, idx) => (
                      <React.Fragment key={konto.nr}>
                        <tr
                          className={konto.buchungen?.length > 0 ? 'bt-cursor-pointer' : ''}
                          onClick={() => konto.buchungen?.length > 0 && setExpandedSkrKonten(prev => ({ ...prev, [konto.nr]: !prev[konto.nr] }))}
                        >
                          <td className="skr-konto-nr">
                            {konto.buchungen?.length > 0 && (expandedSkrKonten[konto.nr] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                            {' '}<span className="skr-badge">{konto.nr}</span>
                          </td>
                          <td>{konto.name}</td>
                          <td className="right positive">{formatCurrency(konto.betrag)}</td>
                        </tr>
                        {expandedSkrKonten[konto.nr] && konto.buchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row">
                            <td></td>
                            <td className="bt-cell-sub">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td>
                            <td className="right bt-cell-sub-right">{formatCurrency(buch.betrag)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                    <tr className="subtotal-row">
                      <td colSpan="2"><strong>Summe Betriebseinnahmen</strong></td>
                      <td className="right positive"><strong>{formatCurrency(guvSkrData.summe_einnahmen)}</strong></td>
                    </tr>

                    {/* AUSGABEN */}
                    <tr className="section-header-row">
                      <td colSpan="3"><strong>BETRIEBSAUSGABEN</strong></td>
                    </tr>
                    {guvSkrData.ausgaben.map((konto, idx) => (
                      <React.Fragment key={konto.nr}>
                        <tr
                          className={konto.buchungen?.length > 0 ? 'bt-cursor-pointer' : ''}
                          onClick={() => konto.buchungen?.length > 0 && setExpandedSkrKonten(prev => ({ ...prev, [`a_${konto.nr}`]: !prev[`a_${konto.nr}`] }))}
                        >
                          <td className="skr-konto-nr">
                            {konto.buchungen?.length > 0 && (expandedSkrKonten[`a_${konto.nr}`] ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                            {' '}<span className="skr-badge">{konto.nr}</span>
                          </td>
                          <td>{konto.name}</td>
                          <td className="right negative">-{formatCurrency(konto.betrag)}</td>
                        </tr>
                        {expandedSkrKonten[`a_${konto.nr}`] && konto.buchungen?.map((buch, bIdx) => (
                          <tr key={bIdx} className="einzelbuchung-row">
                            <td></td>
                            <td className="bt-cell-sub">{new Date(buch.datum).toLocaleDateString('de-DE')} — {buch.beschreibung}</td>
                            <td className="right bt-cell-sub-right negative">-{formatCurrency(buch.betrag)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                    <tr className="subtotal-row">
                      <td colSpan="2"><strong>Summe Betriebsausgaben</strong></td>
                      <td className="right negative"><strong>-{formatCurrency(guvSkrData.summe_ausgaben)}</strong></td>
                    </tr>

                    {/* ERGEBNIS */}
                    <tr className="total-row">
                      <td colSpan="2"><strong>Gewinn / Verlust {guvSkrData.jahr}</strong></td>
                      <td className={`right ${guvSkrData.ergebnis >= 0 ? 'positive' : 'negative'}`}>
                        <strong>{formatCurrency(guvSkrData.ergebnis)}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {guvAnsicht === 'skr' && !guvSkrData && !loading && (
              <div className="empty-state">Keine Daten für {selectedJahr}</div>
            )}
          </div>
        )}

        {/* ==================== BWA TAB ==================== */}
        {activeSubTab === 'bwa' && (
          <div className="bwa-content">
            <div className="section-header">
              <h3><BarChart3 size={18} /> Betriebswirtschaftliche Auswertung (BWA) {bwaJahr}</h3>
              <div className="header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={bwaJahr}
                  onChange={e => setBwaJahr(parseInt(e.target.value))}
                  style={{ background: 'var(--bg-secondary, rgba(255,255,255,.07))', color: 'var(--text-primary)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 7, padding: '7px 12px', fontSize: 13 }}
                >
                  {jahre.map(j => <option key={j} value={j}>{j}</option>)}
                </select>
                <button className="btn btn-primary" onClick={loadBwa} disabled={bwaLoading}>
                  <RefreshCw size={15} /> {bwaLoading ? 'Lade...' : 'Aktualisieren'}
                </button>
              </div>
            </div>

            {bwaLoading ? (
              <div className="loading-state">Lade BWA...</div>
            ) : !bwaData ? (
              <div className="empty-hint">Keine BWA-Daten verfügbar. Bitte zuerst laden.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th>Monat</th>
                      <th className="right">Umsatz</th>
                      <th className="right">Rohertrag</th>
                      <th className="right">Personal</th>
                      <th className="right">Raum</th>
                      <th className="right">AfA</th>
                      <th className="right">Sonstige</th>
                      <th className="right">EBIT</th>
                      <th className="right">Vorjahr EBIT</th>
                      <th className="right">Abweichung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(bwaData.monate || []).map((m, i) => {
                      const monatNamen = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
                      const ebit = parseFloat(m.ebit || 0);
                      const vorjahrEbit = parseFloat(m.vorjahr_ebit || 0);
                      const abweichung = ebit - vorjahrEbit;
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)' }}>
                          <td style={{ fontWeight: 500 }}>{monatNamen[i] || m.monat}</td>
                          <td className="right" style={{ fontFamily: 'monospace' }}>{formatCurrency(m.umsatz)}</td>
                          <td className="right" style={{ fontFamily: 'monospace' }}>{formatCurrency(m.rohertrag)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(m.personal)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(m.raum)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(m.afa)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(m.sonstige)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', fontWeight: 700, color: ebit >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(ebit)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{formatCurrency(vorjahrEbit)}</td>
                          <td className="right" style={{ fontFamily: 'monospace', color: abweichung >= 0 ? '#10b981' : '#ef4444' }}>
                            {abweichung >= 0 ? '+' : ''}{formatCurrency(abweichung)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {bwaData.jahressumme && (
                    <tfoot>
                      <tr style={{ borderTop: '2px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.05)', fontWeight: 700 }}>
                        <td>Jahressumme</td>
                        <td className="right" style={{ fontFamily: 'monospace' }}>{formatCurrency(bwaData.jahressumme.umsatz)}</td>
                        <td className="right" style={{ fontFamily: 'monospace' }}>{formatCurrency(bwaData.jahressumme.rohertrag)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(bwaData.jahressumme.personal)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(bwaData.jahressumme.raum)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(bwaData.jahressumme.afa)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: '#ef4444' }}>{formatCurrency(bwaData.jahressumme.sonstige)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: parseFloat(bwaData.jahressumme.ebit || 0) >= 0 ? '#10b981' : '#ef4444' }}>{formatCurrency(bwaData.jahressumme.ebit)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{formatCurrency(bwaData.jahressumme.vorjahr_ebit)}</td>
                        <td className="right" style={{ fontFamily: 'monospace', color: (parseFloat(bwaData.jahressumme.ebit || 0) - parseFloat(bwaData.jahressumme.vorjahr_ebit || 0)) >= 0 ? '#10b981' : '#ef4444' }}>
                          {(() => { const diff = parseFloat(bwaData.jahressumme.ebit || 0) - parseFloat(bwaData.jahressumme.vorjahr_ebit || 0); return (diff >= 0 ? '+' : '') + formatCurrency(diff); })()}
                        </td>
                      </tr>
                    </tfoot>
                  )}
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
                          <td className="bt-pl-2">II. Sachanlagen{bilanzData.aktiva.anlagevermoegen.sachanlagen_quelle === 'auto' && <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>(auto)</span>}</td>
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
                        {bilanzData.passiva.verbindlichkeiten.ust_schulden > 0 && (
                          <tr>
                            <td className="bt-pl-2">Verbindlichkeiten ggü. Finanzamt (USt){bilanzData.passiva.verbindlichkeiten.ust_schulden_manuell ? '' : <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>(auto)</span>}</td>
                            <td className="right">{formatCurrency(bilanzData.passiva.verbindlichkeiten.ust_schulden)}</td>
                          </tr>
                        )}
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
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-secondary" onClick={openQuickCapture} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Camera size={16} />
                  Foto aufnehmen
                </button>
                <button className="btn-primary" onClick={() => { resetBelegForm(); setEditingBeleg(null); setShowBelegModal(true); }}>
                  <Plus size={16} />
                  Neuer Beleg
                </button>
              </div>
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
              <li><Check size={14} /> Formate: CSV, XLSX, MT940/STA, XML (camt.052/053 — Holvi, Sparkasse)</li>
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

            {/* Auto-Aktionen */}
            {bankStatistik && (bankStatistik.unzugeordnet > 0 || bankStatistik.vorgeschlagen > 0) && (
              <div className="bank-auto-actions">
                {bankStatistik.unzugeordnet > 0 && (
                  <button
                    className="btn-auto-vorschlag"
                    onClick={autoAlleVorschlagen}
                    disabled={autoVorschlagRunning}
                    title="Keyword-Regeln und gelernte Zuordnungen auf alle offenen Transaktionen anwenden"
                  >
                    {autoVorschlagRunning ? (
                      <><span className="spinner-xs" /> Analysiere...</>
                    ) : (
                      <>🤖 {bankStatistik.unzugeordnet} automatisch vorschlagen</>
                    )}
                  </button>
                )}
                {bankStatistik.vorgeschlagen > 0 && (
                  <>
                    <button
                      className="btn-vorschlaege-pruefen"
                      onClick={openReviewModal}
                      title="Vorschläge einzeln prüfen — eine Transaktion nach der anderen"
                    >
                      📋 {bankStatistik.vorgeschlagen} Vorschläge einzeln prüfen
                    </button>
                    <button
                      className="btn-alle-annehmen"
                      onClick={alleVorschlaegeAnnehmen}
                      disabled={alleAnnehmenRunning}
                      title="Alle Vorschläge bestätigen und in EÜR übertragen"
                    >
                      {alleAnnehmenRunning ? (
                        <><span className="spinner-xs" /> Übertrage...</>
                      ) : (
                        <>✅ {bankStatistik.vorgeschlagen} Vorschläge annehmen → EÜR</>
                      )}
                    </button>
                  </>
                )}
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
                    onClick={() => { setAehnlicheAnzahl(0); setKategorieModalMwst('19'); setShowKategorieModal(true); }}
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
                        <tr
                          className={`bank-row ${tx.status}${tx.status !== 'zugeordnet' ? ' bank-row--clickable' : ''}`}
                          onClick={(e) => {
                            if (e.target.closest('input,button')) return;
                            if (tx.status === 'unzugeordnet' || tx.status === 'vorgeschlagen') {
                              setSelectedBankTx(tx);
                              setKategorieModalMwst('19');
                              setShowKategorieModal(true);
                              ladeAehnliche(tx.transaktion_id);
                            }
                          }}
                        >
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
                              {tx.status === 'vorgeschlagen' && (() => {
                                let md = tx.match_details;
                                if (typeof md === 'string') { try { md = JSON.parse(md); } catch(e) { md = null; } }
                                const kat = md?.kategorie || (tx.betrag > 0 ? 'Einnahme' : 'Ausgabe');
                                const isFallback = md?.quelle === 'fallback';
                                return <span title={isFallback ? 'Fallback-Vorschlag — bitte prüfen' : 'Klicken zum Ändern'}>{isFallback ? '❓' : '💡'} {kat}</span>;
                              })()}
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
                                  onClick={() => { setSelectedBankTx(tx); setKategorieModalMwst('19'); setShowKategorieModal(true); ladeAehnliche(tx.transaktion_id); }}
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
                            {/* Beleg-Anhang */}
                            {tx.datei_name ? (
                              <a
                                href={`/api/buchhaltung/bank-import/transaktion/${tx.transaktion_id}/datei`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-icon success"
                                title={`Anhang: ${tx.datei_name}`}
                              >
                                <FileText size={14} />
                              </a>
                            ) : (
                              <button
                                className="btn-icon"
                                title="Beleg / Quittung anhängen"
                                onClick={() => { setTxUploadId(tx.transaktion_id); setShowTxUploadModal(true); }}
                              >
                                <Upload size={14} />
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
                {/* EÜR Kennzahlen */}
                {(() => {
                  const isKlein = steuerauswertung.auswertung?.kleinunternehmer ?? dojoEinstellungen.kleinunternehmer;
                  const sumEin  = isKlein ? steuerauswertung.auswertung.summe_einnahmen : steuerauswertung.auswertung.summe_brutto_einnahmen;
                  const sumAus  = isKlein ? steuerauswertung.auswertung.summe_ausgaben  : steuerauswertung.auswertung.summe_brutto_ausgaben;
                  const gewinn  = isKlein ? steuerauswertung.auswertung.gewinn          : steuerauswertung.auswertung.gewinn_brutto;
                  return (
                <div className="steuer-kpi-grid">
                  {isKlein && (
                    <div className="steuer-kpi steuer-kpi--info">
                      <div className="kpi-label">§ 19 UStG</div>
                      <div className="kpi-value" style={{fontSize:'0.9rem'}}>Kleinunternehmer</div>
                      <div className="kpi-sub">Keine Umsatzsteuer</div>
                    </div>
                  )}
                  <div className="steuer-kpi steuer-kpi--einnahmen">
                    <div className="kpi-label">Betriebseinnahmen {isKlein ? '(Netto)' : '(Brutto)'}</div>
                    <div className="kpi-value">{formatCurrency(sumEin)}</div>
                    <div className="kpi-sub">{steuerauswertung.auswertung.betriebseinnahmen?.length || 0} Kategorien</div>
                  </div>
                  <div className="steuer-kpi steuer-kpi--ausgaben">
                    <div className="kpi-label">Betriebsausgaben {isKlein ? '(Netto)' : '(Brutto)'}</div>
                    <div className="kpi-value">{formatCurrency(sumAus)}</div>
                    <div className="kpi-sub">{steuerauswertung.auswertung.betriebsausgaben?.length || 0} Kategorien</div>
                  </div>
                  <div className={`steuer-kpi ${gewinn >= 0 ? 'steuer-kpi--gewinn' : 'steuer-kpi--verlust'}`}>
                    <div className="kpi-label">{gewinn >= 0 ? 'Gewinn (EÜR)' : 'Verlust (EÜR)'}</div>
                    <div className="kpi-value">{formatCurrency(Math.abs(gewinn))}</div>
                    <div className="kpi-sub">{isKlein ? 'Vor Einkommensteuer' : 'Brutto vor Steuern'}</div>
                  </div>
                  {steuerauswertung.auswertung.nicht_kategorisiert?.anzahl > 0 && (
                    <div className="steuer-kpi steuer-kpi--warnung">
                      <div className="kpi-label">Nicht kategorisiert</div>
                      <div className="kpi-value">{steuerauswertung.auswertung.nicht_kategorisiert.anzahl}</div>
                      <div className="kpi-sub">{formatCurrency(steuerauswertung.auswertung.nicht_kategorisiert.summe)}</div>
                    </div>
                  )}
                </div>
                  );
                })()}

                {/* USt-Auswertung — nur für Regelbesteuerung */}
                {steuerauswertung.auswertung.ust && !(steuerauswertung.auswertung?.kleinunternehmer ?? dojoEinstellungen.kleinunternehmer) && (
                  <div className="steuer-section ust-section">
                    <h4><Euro size={16} /> Umsatzsteuer-Auswertung {selectedJahr}</h4>
                    <div className="ust-kpi-grid">
                      <div className="ust-kpi ust-kpi--ust">
                        <div className="ust-kpi-label">Umsatzsteuer (vereinnahmt)</div>
                        <div className="ust-kpi-value">{formatCurrency(steuerauswertung.auswertung.ust.umsatzsteuer)}</div>
                        <div className="ust-kpi-sub">USt auf Einnahmen</div>
                      </div>
                      <div className="ust-kpi ust-kpi--vorsteuer">
                        <div className="ust-kpi-label">Vorsteuer (abzugsfähig)</div>
                        <div className="ust-kpi-value">{formatCurrency(steuerauswertung.auswertung.ust.vorsteuer)}</div>
                        <div className="ust-kpi-sub">aus Eingangsrechnungen</div>
                      </div>
                      <div className={`ust-kpi ${steuerauswertung.auswertung.ust.zahllast >= 0 ? 'ust-kpi--zahllast' : 'ust-kpi--guthaben'}`}>
                        <div className="ust-kpi-label">{steuerauswertung.auswertung.ust.zahllast >= 0 ? 'USt-Zahllast' : 'Vorsteuer-Guthaben'}</div>
                        <div className="ust-kpi-value">{formatCurrency(Math.abs(steuerauswertung.auswertung.ust.zahllast))}</div>
                        <div className="ust-kpi-sub">{steuerauswertung.auswertung.ust.zahllast >= 0 ? '→ an Finanzamt abzuführen' : '→ vom Finanzamt erstattbar'}</div>
                      </div>
                      {steuerauswertung.auswertung.ust.steuerzahlungen > 0 && (
                        <div className="ust-kpi ust-kpi--gezahlt">
                          <div className="ust-kpi-label">Bereits bezahlt</div>
                          <div className="ust-kpi-value">{formatCurrency(steuerauswertung.auswertung.ust.steuerzahlungen)}</div>
                          <div className="ust-kpi-sub">Steuerzahlungen gebucht</div>
                        </div>
                      )}
                    </div>

                    {/* Quartalsweise UStVA-Vorschau */}
                    {steuerauswertung.auswertung.ust.quartale?.length > 0 && (
                      <div className="ust-quartale">
                        <h5>Quartalsweise Vorschau (UStVA)</h5>
                        <table className="steuer-table ust-quartal-table">
                          <thead>
                            <tr>
                              <th>Zeitraum</th>
                              <th className="right">Einnahmen (netto)</th>
                              <th className="right">Ausgaben (netto)</th>
                              <th className="right">USt (KZ 81)</th>
                              <th className="right">Vorsteuer (KZ 66)</th>
                              <th className="right">Zahllast</th>
                            </tr>
                          </thead>
                          <tbody>
                            {steuerauswertung.auswertung.ust.quartale.map((q, i) => (
                              <tr key={i} className={q.zahllast < 0 ? 'ust-row--guthaben' : ''}>
                                <td><strong>{q.label}</strong></td>
                                <td className="right einnahme-betrag">{formatCurrency(q.einnahmen_brutto ?? q.einnahmen_netto)}</td>
                                <td className="right ausgabe-betrag">{formatCurrency(q.ausgaben_brutto ?? q.ausgaben_netto)}</td>
                                <td className="right">{formatCurrency(q.umsatzsteuer)}</td>
                                <td className="right">{formatCurrency(q.vorsteuer)}</td>
                                <td className={`right ${q.zahllast >= 0 ? 'ust-zahllast' : 'ust-guthaben'}`}>
                                  <strong>{q.zahllast >= 0 ? '+' : ''}{formatCurrency(q.zahllast)}</strong>
                                </td>
                              </tr>
                            ))}
                            <tr className="summen-zeile">
                              <td><strong>Gesamt {selectedJahr}</strong></td>
                              <td className="right"><strong>{formatCurrency(steuerauswertung.auswertung.summe_brutto_einnahmen ?? steuerauswertung.auswertung.summe_einnahmen)}</strong></td>
                              <td className="right"><strong>{formatCurrency(steuerauswertung.auswertung.summe_brutto_ausgaben ?? steuerauswertung.auswertung.summe_ausgaben)}</strong></td>
                              <td className="right"><strong>{formatCurrency(steuerauswertung.auswertung.ust.umsatzsteuer)}</strong></td>
                              <td className="right"><strong>{formatCurrency(steuerauswertung.auswertung.ust.vorsteuer)}</strong></td>
                              <td className={`right ${steuerauswertung.auswertung.ust.zahllast >= 0 ? 'ust-zahllast' : 'ust-guthaben'}`}>
                                <strong>{formatCurrency(steuerauswertung.auswertung.ust.zahllast)}</strong>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        <p className="ust-hinweis">
                          <AlertCircle size={12} /> KZ 81 = Umsatzsteuer 19% · KZ 66 = Abziehbare Vorsteuer · Zahllast = ans Finanzamt abzuführen
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Einnahmen nach Kategorien */}
                {steuerauswertung.auswertung.betriebseinnahmen.length > 0 && (() => {
                  const isKlein = steuerauswertung.auswertung?.kleinunternehmer ?? dojoEinstellungen.kleinunternehmer;
                  const sumLabel = isKlein ? 'Summe (Netto)' : 'Summe (Brutto)';
                  return (
                  <div className="steuer-section">
                    <h4><TrendingUp size={16} /> Betriebseinnahmen nach Kategorie</h4>
                    <table className="steuer-table">
                      <thead>
                        <tr><th>Kategorie</th><th>Anzahl</th><th className="right">{sumLabel}</th></tr>
                      </thead>
                      <tbody>
                        {steuerauswertung.auswertung.betriebseinnahmen.map((e, i) => (
                          <tr key={i}>
                            <td>{e.kategorie}</td>
                            <td>{e.anzahl}</td>
                            <td className="right einnahme-betrag">{formatCurrency(isKlein ? e.summe : (e.summe_brutto ?? e.summe))}</td>
                          </tr>
                        ))}
                        <tr className="summen-zeile">
                          <td><strong>Gesamt</strong></td>
                          <td></td>
                          <td className="right"><strong>{formatCurrency(isKlein ? steuerauswertung.auswertung.summe_einnahmen : (steuerauswertung.auswertung.summe_brutto_einnahmen ?? steuerauswertung.auswertung.summe_einnahmen))}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  );
                })()}

                {/* Ausgaben nach Kategorien */}
                {steuerauswertung.auswertung.betriebsausgaben.length > 0 && (() => {
                  const isKlein = steuerauswertung.auswertung?.kleinunternehmer ?? dojoEinstellungen.kleinunternehmer;
                  const sumLabel = isKlein ? 'Summe (Netto)' : 'Summe (Brutto)';
                  return (
                  <div className="steuer-section">
                    <h4><TrendingDown size={16} /> Betriebsausgaben nach Kategorie</h4>
                    <table className="steuer-table">
                      <thead>
                        <tr><th>Kategorie</th><th>EÜR-Typ</th><th>Anzahl</th><th className="right">{sumLabel}</th></tr>
                      </thead>
                      <tbody>
                        {steuerauswertung.auswertung.betriebsausgaben.map((a, i) => (
                          <tr key={i}>
                            <td>{a.kategorie}</td>
                            <td><span className="euer-typ-badge">{a.euer_typ || '—'}</span></td>
                            <td>{a.anzahl}</td>
                            <td className="right ausgabe-betrag">{formatCurrency(isKlein ? a.summe : (a.summe_brutto ?? a.summe))}</td>
                          </tr>
                        ))}
                        <tr className="summen-zeile">
                          <td><strong>Gesamt</strong></td>
                          <td></td>
                          <td></td>
                          <td className="right"><strong>{formatCurrency(isKlein ? steuerauswertung.auswertung.summe_ausgaben : (steuerauswertung.auswertung.summe_brutto_ausgaben ?? steuerauswertung.auswertung.summe_ausgaben))}</strong></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  );
                })()}

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
                <button
                  className="btn-anlage-euer"
                  onClick={exportAnlageEuer}
                  disabled={loading}
                  title="Excel mit amtlichen EÜR-Zeilennummern für WISO Steuer / ELSTER"
                >
                  <FileSpreadsheet size={16} />
                  Anlage EÜR (WISO / ELSTER)
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

        {activeSubTab === 'anlagen' && (
          <div className="anlagen-content">
            <div className="anlagen-header">
              <h3><Building2 size={18} /> Anlagevermögen &amp; AfA-Plan</h3>
              <button className="btn-primary" onClick={() => {
                setEditingAnlage(null);
                setAnlageForm({ bezeichnung: '', beschreibung: '', anlage_kategorie: 'kfz',
                  kaufdatum: new Date().toISOString().split('T')[0],
                  anschaffungskosten: '', restwert: '0', nutzungsdauer: '6',
                  lieferant: '', rechnungsnummer: '' });
                setShowAnlageForm(true);
              }}>
                <Plus size={14} /> Anlage erfassen
              </button>
            </div>

            <div className="anlagen-info-box">
              <span>💡</span>
              <span>Anlagegüter &gt; 800 € netto werden linear über die Nutzungsdauer abgeschrieben.
              Die Kaufzahlungen als Beleg mit Kategorie <strong>„Anlagevermögen (Kauf / Rate)"</strong> erfassen —
              die AfA erscheint automatisch in der EÜR unter Abschreibungen.</span>
            </div>

            {showAnlageForm && (
              <div className="anlage-form-card">
                <h4>{editingAnlage ? '✏️ Anlage bearbeiten' : '➕ Neue Anlage erfassen'}</h4>
                <div className="anlage-form-grid">
                  <div className="form-group">
                    <label>Bezeichnung *</label>
                    <input value={anlageForm.bezeichnung}
                      onChange={e => setAnlageForm(p => ({ ...p, bezeichnung: e.target.value }))}
                      placeholder="z.B. Anhänger Turnierequipment" />
                  </div>
                  <div className="form-group">
                    <label>Kategorie *</label>
                    <select value={anlageForm.anlage_kategorie}
                      onChange={e => {
                        const preset = NUTZUNGSDAUER_PRESETS[e.target.value];
                        setAnlageForm(p => ({
                          ...p, anlage_kategorie: e.target.value,
                          nutzungsdauer: preset ? String(preset.jahre) : p.nutzungsdauer
                        }));
                      }}>
                      {Object.entries(NUTZUNGSDAUER_PRESETS).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Kaufdatum *</label>
                    <input type="date" value={anlageForm.kaufdatum}
                      onChange={e => setAnlageForm(p => ({ ...p, kaufdatum: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Anschaffungskosten (€) *</label>
                    <input type="number" step="0.01" value={anlageForm.anschaffungskosten}
                      onChange={e => setAnlageForm(p => ({ ...p, anschaffungskosten: e.target.value }))}
                      placeholder="2500.00" />
                  </div>
                  <div className="form-group">
                    <label>Nutzungsdauer (Jahre) *</label>
                    <input type="number" min="1" max="50" value={anlageForm.nutzungsdauer}
                      onChange={e => setAnlageForm(p => ({ ...p, nutzungsdauer: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Restwert (€)</label>
                    <input type="number" step="0.01" value={anlageForm.restwert}
                      onChange={e => setAnlageForm(p => ({ ...p, restwert: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Lieferant</label>
                    <input value={anlageForm.lieferant}
                      onChange={e => setAnlageForm(p => ({ ...p, lieferant: e.target.value }))}
                      placeholder="Händlername" />
                  </div>
                  <div className="form-group">
                    <label>Rechnungsnummer</label>
                    <input value={anlageForm.rechnungsnummer}
                      onChange={e => setAnlageForm(p => ({ ...p, rechnungsnummer: e.target.value }))}
                      placeholder="RE-2025-001" />
                  </div>
                </div>
                <div className="anlage-form-actions">
                  <button className="btn-primary" onClick={saveAnlage} disabled={loading || !anlageForm.bezeichnung || !anlageForm.anschaffungskosten}>
                    {loading ? 'Speichern...' : 'Speichern & AfA berechnen'}
                  </button>
                  <button className="btn-secondary" onClick={() => setShowAnlageForm(false)}>Abbrechen</button>
                </div>
              </div>
            )}

            {anlagenLoading ? (
              <div className="loading-state">Lade Anlagen...</div>
            ) : (
              <div className="anlagen-table-wrap">
                <table className="data-table anlagen-table">
                  <thead>
                    <tr>
                      <th>Bezeichnung</th>
                      <th>Kaufdatum</th>
                      <th className="right">AK (€)</th>
                      <th>ND</th>
                      <th className="right">AfA {selectedJahr} (€)</th>
                      <th className="right">Buchwert {selectedJahr} (€)</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {anlagen.length === 0 ? (
                      <tr><td colSpan="7" className="empty-cell">Noch keine Anlagen erfasst</td></tr>
                    ) : anlagen.map(a => (
                      <tr key={a.anlage_id} className={!a.aktiv ? 'row-inactive' : ''}>
                        <td>
                          <div className="anlage-name">{a.bezeichnung}</div>
                          {a.lieferant && <div className="anlage-meta">{a.lieferant}</div>}
                        </td>
                        <td>{new Date(a.kaufdatum).toLocaleDateString('de-DE')}</td>
                        <td className="right">{parseFloat(a.anschaffungskosten).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                        <td>{a.nutzungsdauer}J</td>
                        <td className="right text-danger">
                          {a.afa_aktuelles_jahr ? `−${parseFloat(a.afa_aktuelles_jahr).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : '—'}
                        </td>
                        <td className="right">
                          {a.buchwert_aktuell ? `${parseFloat(a.buchwert_aktuell).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : '—'}
                        </td>
                        <td className="anlage-actions">
                          <button title="AfA-Plan anzeigen" onClick={() => setAnlageAfa(null) || loadAfaSchedule(a)} className="btn-icon">
                            <FileText size={14} />
                          </button>
                          <button title="Bearbeiten" className="btn-icon" onClick={() => {
                            setEditingAnlage(a);
                            setAnlageForm({
                              bezeichnung: a.bezeichnung, beschreibung: a.beschreibung || '',
                              anlage_kategorie: a.anlage_kategorie,
                              kaufdatum: a.kaufdatum?.split('T')[0] || '',
                              anschaffungskosten: a.anschaffungskosten,
                              restwert: a.restwert, nutzungsdauer: a.nutzungsdauer,
                              lieferant: a.lieferant || '', rechnungsnummer: a.rechnungsnummer || ''
                            });
                            setShowAnlageForm(true);
                          }}><Edit size={14} /></button>
                          {a.aktiv === 1 && (
                            <button title="Ausscheiden" className="btn-icon btn-danger-icon" onClick={() => deleteAnlage(a.anlage_id)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {anlageAfa && (
              <div className="afa-schedule-card">
                <div className="afa-schedule-header">
                  <h4>📋 AfA-Plan: {anlageAfa.anlage.bezeichnung}</h4>
                  <button className="btn-icon" onClick={() => setAnlageAfa(null)}><X size={16} /></button>
                </div>
                <table className="data-table afa-table">
                  <thead>
                    <tr>
                      <th>Jahr</th>
                      <th className="right">Buchwert Anfang</th>
                      <th className="right">AfA</th>
                      <th className="right">Buchwert Ende</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {anlageAfa.positionen.map(p => {
                      const isAktuell = p.afa_jahr === selectedJahr;
                      const isPast    = p.afa_jahr < new Date().getFullYear();
                      return (
                        <tr key={p.afa_jahr} className={isAktuell ? 'row-highlight' : isPast ? 'row-past' : ''}>
                          <td><strong>{p.afa_jahr}</strong>{isAktuell && <span className="badge-aktuell"> ← aktuell</span>}</td>
                          <td className="right">{parseFloat(p.buchwert_beginn).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                          <td className="right text-danger">−{parseFloat(p.afa_betrag).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                          <td className="right">{parseFloat(p.buchwert_ende).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                          <td className="afa-note">
                            {p.ist_erstes_jahr ? 'Erstes Jahr (anteilig)' : ''}
                            {p.ist_letztes_jahr ? 'Letztes Jahr' : ''}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ==================== OFFENE POSTEN + MAHNWESEN ==================== */}
        {activeSubTab === 'offene-posten' && (
          <div className="offene-posten-content">
            <div className="section-header">
              <h3><AlertCircle size={18} /> Offene Posten &amp; Mahnwesen</h3>
              <div className="header-actions" style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary" onClick={() => { setShowAltersliste(true); loadAltersliste(); }}>
                  <BarChart3 size={14} /> Altersliste
                </button>
                <button className="btn-primary" onClick={() => setShowMahnungForm(true)}>
                  <Plus size={14} /> Mahnung erstellen
                </button>
              </div>
            </div>

            {offenePostenLoading ? (
              <div className="loading-state">Lade...</div>
            ) : (
              <>
                <h4 className="section-subtitle">Offene Rechnungen</h4>
                {offenePosten.offeneRechnungen.length === 0 ? (
                  <div className="empty-hint">Keine offenen Rechnungen</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Rechnungsnr.</th>
                        <th>Schuldner</th>
                        <th className="right">Betrag</th>
                        <th>Fällig</th>
                        <th className="right">Überfällig</th>
                        <th>Mahnstufe</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {offenePosten.offeneRechnungen.map(r => (
                        <tr key={r.rechnung_id} className={r.tage_ueberfaellig > 30 ? 'row-danger' : r.tage_ueberfaellig > 0 ? 'row-warning' : ''}>
                          <td>{r.rechnungsnummer}</td>
                          <td>{r.vorname} {r.nachname}</td>
                          <td className="right">{parseFloat(r.betrag).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                          <td>{r.faelligkeitsdatum ? new Date(r.faelligkeitsdatum).toLocaleDateString('de-DE') : '—'}</td>
                          <td className="right">{r.tage_ueberfaellig > 0 ? <span className="text-danger">{r.tage_ueberfaellig} Tage</span> : '—'}</td>
                          <td>
                            {r.mahnstufe === 0 ? <span className="badge badge-neutral">Keine</span>
                              : r.mahnstufe === 1 ? <span className="badge badge-warning">Erinnerung</span>
                              : r.mahnstufe === 2 ? <span className="badge badge-danger">1. Mahnung</span>
                              : <span className="badge badge-danger">2. Mahnung</span>}
                          </td>
                          <td>
                            <button className="btn-sm btn-warning" onClick={() => {
                              setMahnungForm(f => ({
                                ...f,
                                rechnung_id: String(r.rechnung_id),
                                schuldner_name: `${r.vorname} ${r.nachname}`,
                                offener_betrag: String(r.betrag),
                                faelligkeitsdatum: new Date().toISOString().split('T')[0],
                                mahnstufe: String(Math.min(r.mahnstufe + 1, 3))
                              }));
                              setShowMahnungForm(true);
                            }}>Mahnen</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                <h4 className="section-subtitle" style={{ marginTop: '1.5rem' }}>Offene Mahnungen</h4>
                {offenePosten.mahnungen.length === 0 ? (
                  <div className="empty-hint">Keine offenen Mahnungen</div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Schuldner</th>
                        <th>Stufe</th>
                        <th className="right">Betrag</th>
                        <th className="right">Mahngebühr</th>
                        <th>Erstellt</th>
                        <th>Versandt</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {offenePosten.mahnungen.map(m => (
                        <tr key={m.mahnung_id}>
                          <td>{m.schuldner_name}</td>
                          <td>
                            {m.mahnstufe === 1 ? <span className="badge badge-neutral">Erinnerung</span>
                              : m.mahnstufe === 2 ? <span className="badge badge-warning">1. Mahnung</span>
                              : <span className="badge badge-danger">2. Mahnung</span>}
                          </td>
                          <td className="right">{parseFloat(m.offener_betrag).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                          <td className="right">{parseFloat(m.mahngebuehr) > 0 ? `${parseFloat(m.mahngebuehr).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €` : '—'}</td>
                          <td>{new Date(m.erstellt_am).toLocaleDateString('de-DE')}</td>
                          <td>{m.versandt_am ? new Date(m.versandt_am).toLocaleDateString('de-DE') : <span className="text-muted">Nicht versandt</span>}</td>
                          <td className="action-cell">
                            {!m.versandt_am && (
                              <button className="btn-sm" onClick={() => mahnungVersandt(m.mahnung_id)}>Versandt</button>
                            )}
                            <button className="btn-sm btn-success" onClick={() => mahnungBezahlt(m.mahnung_id)}>Bezahlt</button>
                            <button
                              className="btn-sm"
                              onClick={() => downloadMahnungPdf(m.mahnung_id)}
                              disabled={mahnungPdfLoading[m.mahnung_id]}
                              title="Als PDF herunterladen"
                            >
                              <Download size={12} /> {mahnungPdfLoading[m.mahnung_id] ? '...' : 'PDF'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {/* Altersliste Modal */}
            {showAltersliste && (
              <div className="modal-overlay" onClick={() => setShowAltersliste(false)}>
                <div className="modal" style={{ maxWidth: 800, width: '90%' }} onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3><BarChart3 size={18} /> Debitorenaltersliste</h3>
                    <button className="close-btn" onClick={() => setShowAltersliste(false)}><X size={20} /></button>
                  </div>
                  <div className="modal-body">
                    {alterslisteLoading ? (
                      <div className="loading-state">Lade Altersliste...</div>
                    ) : !altersliste ? (
                      <div className="empty-hint">Keine Daten verfügbar.</div>
                    ) : (
                      <>
                        {/* Bucket Cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
                          {[
                            { key: 'aktuell', label: 'Aktuell', color: '#10b981', borderColor: '#10b981' },
                            { key: '1_30', label: '1–30 Tage', color: '#f59e0b', borderColor: '#f59e0b' },
                            { key: '31_60', label: '31–60 Tage', color: '#f97316', borderColor: '#f97316' },
                            { key: '61_90', label: '61–90 Tage', color: '#ef4444', borderColor: '#ef4444' },
                            { key: '90plus', label: '90+ Tage', color: '#dc2626', borderColor: '#dc2626' },
                          ].map(bucket => {
                            const b = altersliste.buckets?.[bucket.key] || {};
                            return (
                              <div key={bucket.key} style={{ background: 'var(--bg-card)', border: `2px solid ${bucket.borderColor}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{bucket.label}</div>
                                <div style={{ fontSize: 20, fontWeight: 700, color: bucket.color, fontFamily: 'monospace' }}>{formatCurrency(b.summe || 0)}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{b.anzahl || 0} Rechnungen</div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Detail Table */}
                        {(altersliste.rechnungen || []).length > 0 && (
                          <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Rechnungsnr.</th>
                                  <th>Schuldner</th>
                                  <th>Fälligkeit</th>
                                  <th className="right">Tage überfällig</th>
                                  <th>Bucket</th>
                                  <th className="right">Betrag</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(altersliste.rechnungen || []).map((r, i) => {
                                  const tage = r.tage_ueberfaellig || 0;
                                  const bucketLabel = tage <= 0 ? 'Aktuell' : tage <= 30 ? '1–30 Tage' : tage <= 60 ? '31–60 Tage' : tage <= 90 ? '61–90 Tage' : '90+ Tage';
                                  const bucketColor = tage <= 0 ? '#10b981' : tage <= 30 ? '#f59e0b' : tage <= 60 ? '#f97316' : tage <= 90 ? '#ef4444' : '#dc2626';
                                  return (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                                      <td>{r.rechnungsnummer}</td>
                                      <td>{r.schuldner || `${r.vorname || ''} ${r.nachname || ''}`.trim()}</td>
                                      <td>{r.faelligkeitsdatum ? new Date(r.faelligkeitsdatum).toLocaleDateString('de-DE') : '—'}</td>
                                      <td className="right" style={{ color: tage > 0 ? '#ef4444' : 'var(--text-muted)' }}>{tage > 0 ? `${tage} Tage` : '—'}</td>
                                      <td><span style={{ background: bucketColor + '22', color: bucketColor, borderRadius: 4, padding: '2px 8px', fontSize: 12 }}>{bucketLabel}</span></td>
                                      <td className="right" style={{ fontFamily: 'monospace', fontWeight: 600 }}>{formatCurrency(r.betrag || r.offener_betrag)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={() => setShowAltersliste(false)}>Schließen</button>
                    <button className="btn btn-secondary" onClick={loadAltersliste} disabled={alterslisteLoading}>
                      <RefreshCw size={14} /> Aktualisieren
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showMahnungForm && (
              <div className="modal-overlay" onClick={() => setShowMahnungForm(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>Mahnung erstellen</h3>
                    <button className="close-btn" onClick={() => setShowMahnungForm(false)}><X size={20} /></button>
                  </div>
                  <div className="modal-body">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Schuldner *</label>
                        <input value={mahnungForm.schuldner_name}
                          onChange={e => setMahnungForm(f => ({ ...f, schuldner_name: e.target.value }))}
                          placeholder="Name des Schuldners" />
                      </div>
                      <div className="form-group">
                        <label>Offener Betrag (€) *</label>
                        <input type="number" step="0.01" value={mahnungForm.offener_betrag}
                          onChange={e => setMahnungForm(f => ({ ...f, offener_betrag: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Mahnstufe</label>
                        <select value={mahnungForm.mahnstufe}
                          onChange={e => setMahnungForm(f => ({ ...f, mahnstufe: e.target.value }))}>
                          <option value="1">Zahlungserinnerung</option>
                          <option value="2">1. Mahnung</option>
                          <option value="3">2. Mahnung</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Fälligkeitsdatum *</label>
                        <input type="date" value={mahnungForm.faelligkeitsdatum}
                          onChange={e => setMahnungForm(f => ({ ...f, faelligkeitsdatum: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Rechnungs-ID</label>
                        <input value={mahnungForm.rechnung_id}
                          onChange={e => setMahnungForm(f => ({ ...f, rechnung_id: e.target.value }))}
                          placeholder="Optional" />
                      </div>
                      <div className="form-group">
                        <label>Mahngebühr (€)</label>
                        <input type="number" step="0.01" value={mahnungForm.mahngebuehr}
                          onChange={e => setMahnungForm(f => ({ ...f, mahngebuehr: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Mahntext</label>
                      <textarea value={mahnungForm.mahntext} rows="3"
                        onChange={e => setMahnungForm(f => ({ ...f, mahntext: e.target.value }))}
                        placeholder="Optionaler Mahntext..." />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={() => setShowMahnungForm(false)}>Abbrechen</button>
                    <button className="btn-primary" onClick={saveMahnung}
                      disabled={loading || !mahnungForm.schuldner_name || !mahnungForm.offener_betrag || !mahnungForm.faelligkeitsdatum}>
                      {loading ? 'Speichern...' : 'Mahnung erstellen'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== WIEDERKEHRENDE BUCHUNGEN ==================== */}
        {activeSubTab === 'wiederkehrend' && (
          <div className="wiederkehrend-content">
            <div className="section-header">
              <h3><RefreshCw size={18} /> Wiederkehrende Buchungen</h3>
              <div className="header-actions">
                <button className="btn-secondary" onClick={alleFaelligeAusfuehren} disabled={ausfuehrenRunning}>
                  {ausfuehrenRunning ? 'Läuft...' : '▶ Alle Fälligen ausführen'}
                </button>
                <button className="btn-primary" onClick={() => {
                  setEditingTemplate(null);
                  setTemplateForm({ organisation_name: selectedOrg !== 'alle' ? selectedOrg : 'Kampfkunstschule Schreiner',
                    bezeichnung: '', buchungsart: 'ausgabe', betrag_netto: '', mwst_satz: '19',
                    kategorie: 'sonstige_kosten', beschreibung: '', lieferant_kunde: '',
                    intervall: 'monatlich', naechste_faelligkeit: new Date().toISOString().split('T')[0],
                    auto_ausfuehren: false });
                  setShowWiederkehrendForm(true);
                }}>
                  <Plus size={14} /> Neues Template
                </button>
              </div>
            </div>

            <div className="anlagen-info-box">
              <span>💡</span>
              <span>Templates mit <strong>„Auto-Ausführen"</strong> werden bei jedem Klick auf „Alle Fälligen ausführen" automatisch als Beleg gebucht.</span>
            </div>

            {wiederkehrendLoading ? (
              <div className="loading-state">Lade...</div>
            ) : wiederkehrend.length === 0 ? (
              <div className="empty-hint">Noch keine wiederkehrenden Buchungen angelegt</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Bezeichnung</th>
                    <th>Art</th>
                    <th className="right">Betrag (Netto)</th>
                    <th>Intervall</th>
                    <th>Nächste Fälligkeit</th>
                    <th>Auto</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {wiederkehrend.map(t => {
                    const faellig = new Date(t.naechste_faelligkeit) <= new Date();
                    return (
                      <tr key={t.template_id} className={!t.aktiv ? 'row-inactive' : faellig ? 'row-warning' : ''}>
                        <td>
                          <div className="anlage-name">{t.bezeichnung}</div>
                          {t.lieferant_kunde && <div className="anlage-meta">{t.lieferant_kunde}</div>}
                        </td>
                        <td>{t.buchungsart === 'ausgabe' ? <span className="badge badge-danger">Ausgabe</span> : <span className="badge badge-success">Einnahme</span>}</td>
                        <td className="right">{parseFloat(t.betrag_netto).toLocaleString('de-DE', { minimumFractionDigits: 2 })} €</td>
                        <td>{t.intervall}</td>
                        <td className={faellig ? 'text-danger' : ''}>{new Date(t.naechste_faelligkeit).toLocaleDateString('de-DE')}</td>
                        <td>{t.auto_ausfuehren ? '✓' : '—'}</td>
                        <td className="anlage-actions">
                          <button className="btn-sm btn-success" title="Jetzt ausführen" onClick={() => templateAusfuehren(t.template_id)} disabled={ausfuehrenRunning}>▶</button>
                          <button className="btn-icon" title="Bearbeiten" onClick={() => {
                            setEditingTemplate(t);
                            setTemplateForm({
                              organisation_name: t.organisation_name,
                              bezeichnung: t.bezeichnung, buchungsart: t.buchungsart,
                              betrag_netto: t.betrag_netto, mwst_satz: t.mwst_satz,
                              kategorie: t.kategorie, beschreibung: t.beschreibung || '',
                              lieferant_kunde: t.lieferant_kunde || '',
                              intervall: t.intervall,
                              naechste_faelligkeit: t.naechste_faelligkeit?.split('T')[0] || '',
                              auto_ausfuehren: !!t.auto_ausfuehren
                            });
                            setShowWiederkehrendForm(true);
                          }}><Edit size={14} /></button>
                          <button className="btn-icon btn-danger-icon" title="Löschen" onClick={() => deleteTemplate(t.template_id)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {showWiederkehrendForm && (
              <div className="modal-overlay" onClick={() => setShowWiederkehrendForm(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>{editingTemplate ? 'Template bearbeiten' : 'Neue wiederkehrende Buchung'}</h3>
                    <button className="close-btn" onClick={() => setShowWiederkehrendForm(false)}><X size={20} /></button>
                  </div>
                  <div className="modal-body">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Bezeichnung *</label>
                        <input value={templateForm.bezeichnung}
                          onChange={e => setTemplateForm(f => ({ ...f, bezeichnung: e.target.value }))}
                          placeholder="z.B. Miete Halle, Versicherung" />
                      </div>
                      <div className="form-group">
                        <label>Buchungsart</label>
                        <select value={templateForm.buchungsart}
                          onChange={e => setTemplateForm(f => ({ ...f, buchungsart: e.target.value }))}>
                          <option value="ausgabe">Ausgabe</option>
                          <option value="einnahme">Einnahme</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Betrag Netto (€) *</label>
                        <input type="number" step="0.01" value={templateForm.betrag_netto}
                          onChange={e => setTemplateForm(f => ({ ...f, betrag_netto: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>MwSt (%)</label>
                        <select value={templateForm.mwst_satz}
                          onChange={e => setTemplateForm(f => ({ ...f, mwst_satz: e.target.value }))}>
                          <option value="19">19%</option>
                          <option value="7">7%</option>
                          <option value="0">0%</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Kategorie *</label>
                        <select value={templateForm.kategorie}
                          onChange={e => setTemplateForm(f => ({ ...f, kategorie: e.target.value }))}>
                          {kategorien.filter(k => k.typ === templateForm.buchungsart).map(k => (
                            <option key={k.id} value={k.id}>{k.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Intervall</label>
                        <select value={templateForm.intervall}
                          onChange={e => setTemplateForm(f => ({ ...f, intervall: e.target.value }))}>
                          <option value="wöchentlich">Wöchentlich</option>
                          <option value="monatlich">Monatlich</option>
                          <option value="vierteljährlich">Vierteljährlich</option>
                          <option value="halbjährlich">Halbjährlich</option>
                          <option value="jährlich">Jährlich</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>Lieferant / Kunde</label>
                        <input value={templateForm.lieferant_kunde}
                          onChange={e => setTemplateForm(f => ({ ...f, lieferant_kunde: e.target.value }))}
                          placeholder="Optional" />
                      </div>
                      <div className="form-group">
                        <label>Nächste Fälligkeit *</label>
                        <input type="date" value={templateForm.naechste_faelligkeit}
                          onChange={e => setTemplateForm(f => ({ ...f, naechste_faelligkeit: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Beschreibung (wird in Beleg übernommen)</label>
                      <textarea value={templateForm.beschreibung} rows="2"
                        onChange={e => setTemplateForm(f => ({ ...f, beschreibung: e.target.value }))} />
                    </div>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={templateForm.auto_ausfuehren}
                        onChange={e => setTemplateForm(f => ({ ...f, auto_ausfuehren: e.target.checked }))} />
                      Auto-Ausführen (wird bei „Alle Fälligen" automatisch gebucht)
                    </label>
                  </div>
                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={() => setShowWiederkehrendForm(false)}>Abbrechen</button>
                    <button className="btn-primary" onClick={saveTemplate}
                      disabled={loading || !templateForm.bezeichnung || !templateForm.betrag_netto}>
                      {loading ? 'Speichern...' : 'Speichern'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== KREDITOREN / LIEFERANTENAKTE ==================== */}
        {activeSubTab === 'kreditoren' && (
          <div className="kreditoren-content">
            <div className="section-header">
              <h3><FileText size={18} /> Kreditoren / Lieferantenakte</h3>
              <button className="btn-primary" onClick={() => {
                setEditingKreditor(null);
                setKreditorForm({ organisation_name: selectedOrg !== 'alle' ? selectedOrg : 'Kampfkunstschule Schreiner',
                  name: '', kurzname: '', adresse: '', email: '', telefon: '',
                  ust_id: '', zahlungsziel_tage: '14', iban: '', bic: '', notizen: '' });
                setShowKreditorForm(true);
              }}>
                <Plus size={14} /> Neuer Kreditor
              </button>
            </div>

            {kreditorenLoading ? (
              <div className="loading-state">Lade...</div>
            ) : kreditoren.length === 0 ? (
              <div className="empty-hint">Noch keine Kreditoren angelegt. Kreditoren erscheinen als Vorschläge im Belegerfassungs-Formular.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Kurzname</th>
                    <th>E-Mail</th>
                    <th>Telefon</th>
                    <th>Zahlungsziel</th>
                    <th>IBAN</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {kreditoren.map(k => (
                    <tr key={k.kreditor_id}>
                      <td>
                        <div className="anlage-name">{k.name}</div>
                        {k.ust_id && <div className="anlage-meta">USt-ID: {k.ust_id}</div>}
                      </td>
                      <td>{k.kurzname || '—'}</td>
                      <td>{k.email || '—'}</td>
                      <td>{k.telefon || '—'}</td>
                      <td>{k.zahlungsziel_tage} Tage</td>
                      <td>{k.iban ? `${k.iban.substring(0, 8)}...` : '—'}</td>
                      <td className="anlage-actions">
                        <button className="btn-icon" title="Bearbeiten" onClick={() => {
                          setEditingKreditor(k);
                          setKreditorForm({
                            organisation_name: k.organisation_name,
                            name: k.name, kurzname: k.kurzname || '',
                            adresse: k.adresse || '', email: k.email || '',
                            telefon: k.telefon || '', ust_id: k.ust_id || '',
                            zahlungsziel_tage: String(k.zahlungsziel_tage || 14),
                            iban: k.iban || '', bic: k.bic || '', notizen: k.notizen || ''
                          });
                          setShowKreditorForm(true);
                        }}><Edit size={14} /></button>
                        <button className="btn-icon btn-danger-icon" title="Löschen" onClick={() => deleteKreditor(k.kreditor_id)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {showKreditorForm && (
              <div className="modal-overlay" onClick={() => setShowKreditorForm(false)}>
                <div className="modal" onClick={e => e.stopPropagation()}>
                  <div className="modal-header">
                    <h3>{editingKreditor ? 'Kreditor bearbeiten' : 'Neuer Kreditor'}</h3>
                    <button className="close-btn" onClick={() => setShowKreditorForm(false)}><X size={20} /></button>
                  </div>
                  <div className="modal-body">
                    <div className="form-row">
                      <div className="form-group">
                        <label>Name *</label>
                        <input value={kreditorForm.name}
                          onChange={e => setKreditorForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Firmenname" />
                      </div>
                      <div className="form-group">
                        <label>Kurzname</label>
                        <input value={kreditorForm.kurzname}
                          onChange={e => setKreditorForm(f => ({ ...f, kurzname: e.target.value }))}
                          placeholder="z.B. Stadtwerke" />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Adresse</label>
                      <textarea value={kreditorForm.adresse} rows="2"
                        onChange={e => setKreditorForm(f => ({ ...f, adresse: e.target.value }))} />
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>E-Mail</label>
                        <input type="email" value={kreditorForm.email}
                          onChange={e => setKreditorForm(f => ({ ...f, email: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>Telefon</label>
                        <input value={kreditorForm.telefon}
                          onChange={e => setKreditorForm(f => ({ ...f, telefon: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>USt-ID</label>
                        <input value={kreditorForm.ust_id}
                          onChange={e => setKreditorForm(f => ({ ...f, ust_id: e.target.value }))}
                          placeholder="DE123456789" />
                      </div>
                      <div className="form-group">
                        <label>Zahlungsziel (Tage)</label>
                        <input type="number" min="0" value={kreditorForm.zahlungsziel_tage}
                          onChange={e => setKreditorForm(f => ({ ...f, zahlungsziel_tage: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>IBAN</label>
                        <input value={kreditorForm.iban}
                          onChange={e => setKreditorForm(f => ({ ...f, iban: e.target.value }))}
                          placeholder="DE89 3704 0044 ..." />
                      </div>
                      <div className="form-group">
                        <label>BIC</label>
                        <input value={kreditorForm.bic}
                          onChange={e => setKreditorForm(f => ({ ...f, bic: e.target.value }))} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Notizen</label>
                      <textarea value={kreditorForm.notizen} rows="2"
                        onChange={e => setKreditorForm(f => ({ ...f, notizen: e.target.value }))} />
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button className="btn-secondary" onClick={() => setShowKreditorForm(false)}>Abbrechen</button>
                    <button className="btn-primary" onClick={saveKreditor}
                      disabled={loading || !kreditorForm.name}>
                      {loading ? 'Speichern...' : 'Speichern'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
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
                    style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.7)', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                    <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', background: 'rgba(16,185,129,.9)', color: '#fff', borderRadius: 20, padding: '5px 14px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
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

              {/* Minimales Formular */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Betrag (brutto) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={quickForm.betrag_brutto}
                    onChange={e => setQuickForm(f => ({ ...f, betrag_brutto: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 16, boxSizing: 'border-box' }}
                    autoFocus
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>MwSt.</label>
                  <select
                    value={quickForm.mwst_satz}
                    onChange={e => setQuickForm(f => ({ ...f, mwst_satz: parseInt(e.target.value) }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                  >
                    <option value={19}>19 %</option>
                    <option value={7}>7 %</option>
                    <option value={0}>0 % (steuerfrei)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Datum</label>
                  <input
                    type="date"
                    value={quickForm.beleg_datum}
                    onChange={e => setQuickForm(f => ({ ...f, beleg_datum: e.target.value }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Typ</label>
                  <select
                    value={quickForm.buchungsart}
                    onChange={e => setQuickForm(f => ({ ...f, buchungsart: e.target.value, kategorie: '' }))}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                  >
                    <option value="ausgabe">Ausgabe</option>
                    <option value="einnahme">Einnahme</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Kategorie</label>
                <select
                  value={quickForm.kategorie}
                  onChange={e => setQuickForm(f => ({ ...f, kategorie: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                >
                  <option value="">— Kategorie wählen —</option>
                  {kategorien.filter(k => !k.typ || k.typ === quickForm.buchungsart).map(k => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Beschreibung / Lieferant</label>
                <input
                  type="text"
                  placeholder="z.B. Büromaterial Media Markt"
                  value={quickForm.beschreibung}
                  onChange={e => setQuickForm(f => ({ ...f, beschreibung: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,.15)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              {quickForm.betrag_brutto > 0 && quickForm.mwst_satz > 0 && (
                <div style={{ background: 'rgba(255,215,0,.06)', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Netto: <strong>{(parseFloat(quickForm.betrag_brutto) / (1 + quickForm.mwst_satz / 100)).toFixed(2)} €</strong></span>
                  <span>MwSt: <strong>{(parseFloat(quickForm.betrag_brutto) - parseFloat(quickForm.betrag_brutto) / (1 + quickForm.mwst_satz / 100)).toFixed(2)} €</strong></span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowQuickCapture(false)}>Abbrechen</button>
              <button
                className="btn-primary"
                onClick={saveQuickBeleg}
                disabled={quickLoading || !quickForm.betrag_brutto}
              >
                {quickLoading ? 'Speichern...' : (quickFile ? '📷 Beleg speichern' : '💾 Ohne Foto speichern')}
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
