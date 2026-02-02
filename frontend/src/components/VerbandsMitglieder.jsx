// ============================================================================
// VERBANDSMITGLIEDER - TDA International
// Dojo-Mitgliedschaften (99€/Jahr) & Einzelmitgliedschaften (49€/Jahr)
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Building2, User, Plus, Search, Filter, RefreshCw, Check, X, Clock,
  AlertTriangle, Euro, Calendar, Mail, Phone, MapPin, CreditCard,
  ChevronDown, ChevronUp, FileText, Award, Percent, Gift, Edit, Trash2,
  Download, PenTool, Shield, ScrollText, History, Banknote, Settings, Save
} from 'lucide-react';
import { createSafeHtml } from '../utils/sanitizer';

const VerbandsMitglieder = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.rolle === 'admin' || user?.role === 'admin';
  const [activeTab, setActiveTab] = useState('dojos'); // 'dojos' | 'einzelpersonen' | 'vorteile' | 'einstellungen'
  const [mitgliedschaften, setMitgliedschaften] = useState([]);
  const [vorteile, setVorteile] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Einstellungen State
  const [einstellungen, setEinstellungen] = useState([]);
  const [einstellungenLoading, setEinstellungenLoading] = useState(false);
  const [einstellungenKategorie, setEinstellungenKategorie] = useState('typen');
  const [einstellungenChanged, setEinstellungenChanged] = useState({});
  const [savingEinstellungen, setSavingEinstellungen] = useState(false);
  const [config, setConfig] = useState({});

  // Mitgliedschaftstypen State
  const [mitgliedschaftstypen, setMitgliedschaftstypen] = useState([]);
  const [typenLoading, setTypenLoading] = useState(false);
  const [editingTyp, setEditingTyp] = useState(null);
  const [showTypModal, setShowTypModal] = useState(false);
  const [typFormData, setTypFormData] = useState({
    code: '', name: '', beschreibung: '', kategorie: 'person',
    preis_netto: 0, steuersatz: 19, laufzeit_monate: 12,
    kuendigungsfrist_monate: 3, auto_verlaengerung: true,
    ist_standard: false, aktiv: true, sortierung: 0
  });

  // Vorteile State
  const [editingVorteil, setEditingVorteil] = useState(null);
  const [showVorteilModal, setShowVorteilModal] = useState(false);
  const [vorteilFormData, setVorteilFormData] = useState({
    titel: '', beschreibung: '', gilt_fuer: 'beide',
    rabatt_typ: 'prozent', rabatt_wert: 0,
    kategorie: 'sonstige', aktiv: true
  });

  // Modal States
  const [showNewModal, setShowNewModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showSepaModal, setShowSepaModal] = useState(false);
  const [showAgbModal, setShowAgbModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedMitgliedschaft, setSelectedMitgliedschaft] = useState(null);
  const [dojosOhneMitgliedschaft, setDojosOhneMitgliedschaft] = useState([]);
  const [detailTab, setDetailTab] = useState('info'); // 'info' | 'vertrag' | 'sepa' | 'historie'

  // SEPA State
  const [sepaData, setSepaData] = useState({ iban: '', bic: '', kontoinhaber: '' });
  const [sepaMandate, setSepaMandate] = useState([]);

  // AGB State
  const [dokumente, setDokumente] = useState([]);
  const [selectedDokument, setSelectedDokument] = useState(null);

  // Signature Canvas
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState(null);

  // Akzeptanz State
  const [akzeptanz, setAkzeptanz] = useState({
    agb: false,
    dsgvo: false,
    widerruf: false
  });

  // Form State
  const [formData, setFormData] = useState({
    typ: 'dojo',
    dojo_id: '',
    // Neues Dojo anlegen
    neues_dojo: false,
    neues_dojo_name: '',
    neues_dojo_inhaber: '',
    neues_dojo_email: '',
    neues_dojo_strasse: '',
    neues_dojo_plz: '',
    neues_dojo_ort: '',
    neues_dojo_land: 'Deutschland',
    // Einzelperson
    person_vorname: '',
    person_nachname: '',
    person_email: '',
    person_telefon: '',
    person_strasse: '',
    person_plz: '',
    person_ort: '',
    person_land: 'Deutschland',
    person_geburtsdatum: '',
    zahlungsart: 'rechnung',
    notizen: '',
    // Beitragsfrei (nur für Admin)
    beitragsfrei: false
  });

  // Axios Config
  const api = axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [mitgliederRes, statsRes, vorteileRes] = await Promise.all([
        api.get('/verbandsmitgliedschaften'),
        api.get('/verbandsmitgliedschaften/stats'),
        api.get('/verbandsmitgliedschaften/vorteile/liste')
      ]);

      // Handle both array and { success, mitgliedschaften } format
      const mitglieder = mitgliederRes.data.mitgliedschaften || mitgliederRes.data;
      setMitgliedschaften(Array.isArray(mitglieder) ? mitglieder : []);

      // Handle both direct stats and { success, stats } format
      const statsData = statsRes.data.stats || statsRes.data;
      setStats(statsData);

      setVorteile(vorteileRes.data);
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const loadDojosOhneMitgliedschaft = async () => {
    try {
      const res = await api.get('/verbandsmitgliedschaften/dojos-ohne-mitgliedschaft');
      setDojosOhneMitgliedschaft(res.data);
    } catch (err) {
      console.error('Fehler beim Laden der Dojos:', err);
    }
  };

  const loadEinstellungen = async () => {
    setEinstellungenLoading(true);
    try {
      const res = await api.get('/verbandsmitgliedschaften/einstellungen/alle');
      setEinstellungen(res.data);
      setEinstellungenChanged({});
    } catch (err) {
      console.error('Fehler beim Laden der Einstellungen:', err);
    } finally {
      setEinstellungenLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const res = await api.get('/verbandsmitgliedschaften/einstellungen-config');
      setConfig(res.data);
    } catch (err) {
      console.error('Fehler beim Laden der Konfiguration:', err);
    }
  };

  const handleEinstellungChange = (key, value) => {
    setEinstellungenChanged(prev => ({ ...prev, [key]: value }));
  };

  const saveEinstellungen = async () => {
    setSavingEinstellungen(true);
    try {
      const toSave = Object.entries(einstellungenChanged).map(([key, value]) => ({ key, value }));
      if (toSave.length === 0) {
        alert('Keine Änderungen vorhanden');
        return;
      }
      await api.put('/verbandsmitgliedschaften/einstellungen', { einstellungen: toSave });
      alert('Einstellungen gespeichert!');
      setEinstellungenChanged({});
      loadEinstellungen();
      loadConfig();
    } catch (err) {
      alert('Fehler beim Speichern');
    } finally {
      setSavingEinstellungen(false);
    }
  };

  const getEinstellungValue = (key) => {
    if (einstellungenChanged.hasOwnProperty(key)) {
      return einstellungenChanged[key];
    }
    const einst = einstellungen.find(e => e.einstellung_key === key);
    return einst?.einstellung_value ?? '';
  };

  // ============================================================================
  // MITGLIEDSCHAFTSTYPEN FUNKTIONEN
  // ============================================================================
  const loadMitgliedschaftstypen = async () => {
    setTypenLoading(true);
    try {
      const res = await api.get('/verbandsmitgliedschaften/mitgliedschaftstypen');
      setMitgliedschaftstypen(res.data);
    } catch (err) {
      console.error('Fehler beim Laden der Mitgliedschaftstypen:', err);
    } finally {
      setTypenLoading(false);
    }
  };

  const openTypModal = (typ = null) => {
    if (typ) {
      setEditingTyp(typ);
      setTypFormData({
        code: typ.code,
        name: typ.name,
        beschreibung: typ.beschreibung || '',
        kategorie: typ.kategorie,
        preis_netto: typ.preis_netto,
        steuersatz: typ.steuersatz,
        laufzeit_monate: typ.laufzeit_monate,
        kuendigungsfrist_monate: typ.kuendigungsfrist_monate,
        auto_verlaengerung: typ.auto_verlaengerung,
        ist_standard: typ.ist_standard,
        aktiv: typ.aktiv,
        sortierung: typ.sortierung
      });
    } else {
      setEditingTyp(null);
      setTypFormData({
        code: '', name: '', beschreibung: '', kategorie: 'person',
        preis_netto: 0, steuersatz: 19, laufzeit_monate: 12,
        kuendigungsfrist_monate: 3, auto_verlaengerung: true,
        ist_standard: false, aktiv: true, sortierung: 0
      });
    }
    setShowTypModal(true);
  };

  const saveTyp = async () => {
    try {
      if (editingTyp) {
        await api.put(`/verbandsmitgliedschaften/mitgliedschaftstypen/${editingTyp.id}`, typFormData);
        alert('Mitgliedschaftstyp aktualisiert!');
      } else {
        await api.post('/verbandsmitgliedschaften/mitgliedschaftstypen', typFormData);
        alert('Mitgliedschaftstyp erstellt!');
      }
      setShowTypModal(false);
      loadMitgliedschaftstypen();
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Speichern');
    }
  };

  const deleteTyp = async (id) => {
    if (!confirm('Mitgliedschaftstyp wirklich löschen?')) return;
    try {
      await api.delete(`/verbandsmitgliedschaften/mitgliedschaftstypen/${id}`);
      alert('Gelöscht!');
      loadMitgliedschaftstypen();
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Löschen');
    }
  };

  const toggleTypAktiv = async (id) => {
    try {
      await api.post(`/verbandsmitgliedschaften/mitgliedschaftstypen/${id}/toggle-aktiv`);
      loadMitgliedschaftstypen();
    } catch (err) {
      alert('Fehler beim Umschalten');
    }
  };

  // ============================================================================
  // VORTEILE FUNKTIONEN
  // ============================================================================
  const loadVorteile = async () => {
    try {
      const res = await api.get('/verbandsmitgliedschaften/vorteile');
      setVorteile(res.data);
    } catch (err) {
      console.error('Fehler beim Laden der Vorteile:', err);
    }
  };

  const openVorteilModal = (vorteil = null) => {
    if (vorteil) {
      setEditingVorteil(vorteil);
      setVorteilFormData({
        titel: vorteil.titel,
        beschreibung: vorteil.beschreibung || '',
        gilt_fuer: vorteil.gilt_fuer,
        rabatt_typ: vorteil.rabatt_typ,
        rabatt_wert: vorteil.rabatt_wert,
        kategorie: vorteil.kategorie,
        aktiv: vorteil.aktiv
      });
    } else {
      setEditingVorteil(null);
      setVorteilFormData({
        titel: '', beschreibung: '', gilt_fuer: 'beide',
        rabatt_typ: 'prozent', rabatt_wert: 0,
        kategorie: 'sonstige', aktiv: true
      });
    }
    setShowVorteilModal(true);
  };

  const saveVorteil = async () => {
    try {
      if (editingVorteil) {
        await api.put(`/verbandsmitgliedschaften/vorteile/${editingVorteil.id}`, vorteilFormData);
        alert('Vorteil aktualisiert!');
      } else {
        await api.post('/verbandsmitgliedschaften/vorteile', vorteilFormData);
        alert('Vorteil erstellt!');
      }
      setShowVorteilModal(false);
      loadVorteile();
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Speichern');
    }
  };

  const deleteVorteil = async (id) => {
    if (!confirm('Vorteil wirklich löschen?')) return;
    try {
      await api.delete(`/verbandsmitgliedschaften/vorteile/${id}`);
      alert('Gelöscht!');
      loadVorteile();
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Löschen');
    }
  };

  const toggleVorteilAktiv = async (id) => {
    try {
      await api.post(`/verbandsmitgliedschaften/vorteile/${id}/toggle-aktiv`);
      loadVorteile();
    } catch (err) {
      alert('Fehler beim Umschalten');
    }
  };

  useEffect(() => {
    loadData();
    loadConfig();
  }, []);

  useEffect(() => {
    if (showNewModal && formData.typ === 'dojo') {
      loadDojosOhneMitgliedschaft();
    }
  }, [showNewModal, formData.typ]);

  // Initialize signature canvas when modals open
  useEffect(() => {
    if (showSepaModal || showSignatureModal) {
      setTimeout(() => initCanvas(), 100);
    }
  }, [showSepaModal, showSignatureModal]);

  // Load einstellungen when tab changes
  useEffect(() => {
    if (activeTab === 'einstellungen') {
      if (einstellungenKategorie === 'typen') {
        loadMitgliedschaftstypen();
      } else {
        loadEinstellungen();
      }
    }
  }, [activeTab, einstellungenKategorie]);

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validierung
    if (formData.typ === 'dojo') {
      if (!formData.neues_dojo && !formData.dojo_id) {
        alert('Bitte wähle ein Dojo aus oder lege ein neues an.');
        return;
      }
      if (formData.neues_dojo && (!formData.neues_dojo_name || !formData.neues_dojo_email)) {
        alert('Bitte Dojo-Name und E-Mail ausfüllen.');
        return;
      }
    }
    if (formData.typ === 'einzelperson') {
      if (!formData.person_vorname || !formData.person_nachname || !formData.person_email) {
        alert('Bitte Vorname, Nachname und E-Mail ausfüllen.');
        return;
      }
    }

    try {
      let submitData = { ...formData };

      // Wenn neues Dojo angelegt werden soll
      if (formData.typ === 'dojo' && formData.neues_dojo) {
        // Neues Dojo anlegen
        const neuesDojo = await api.post('/admin/dojos', {
          dojoname: formData.neues_dojo_name,
          inhaber: formData.neues_dojo_inhaber,
          email: formData.neues_dojo_email,
          strasse: formData.neues_dojo_strasse,
          plz: formData.neues_dojo_plz,
          ort: formData.neues_dojo_ort,
          land: formData.neues_dojo_land
        });

        // Dojo-ID für Mitgliedschaft verwenden (Backend gibt dojo_id zurück)
        submitData.dojo_id = neuesDojo.data.dojo_id || neuesDojo.data.id || neuesDojo.data.dojo?.id;
        submitData.neues_dojo = false;
      }

      await api.post('/verbandsmitgliedschaften', submitData);
      setShowNewModal(false);
      resetForm();
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Anlegen');
    }
  };

  const handleVerlaengern = async (id) => {
    if (!confirm('Mitgliedschaft um ein Jahr verlängern?')) return;
    try {
      await api.post(`/verbandsmitgliedschaften/${id}/verlaengern`);
      loadData();
      setShowDetailModal(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler bei Verlängerung');
    }
  };

  const handleKuendigen = async (id) => {
    if (!confirm('Mitgliedschaft wirklich kündigen?')) return;
    try {
      await api.delete(`/verbandsmitgliedschaften/${id}`);
      loadData();
      setShowDetailModal(false);
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Kündigen');
    }
  };

  const handleVertragsfrei = async (id) => {
    if (!confirm('Mitgliedschaft auf "vertragsfrei" setzen?')) return;
    try {
      await api.delete(`/verbandsmitgliedschaften/${id}/vertragsfrei`);
      loadData();
      // Detail neu laden
      const res = await api.get(`/verbandsmitgliedschaften/${id}`);
      setSelectedMitgliedschaft(res.data);
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Löschen');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.put(`/verbandsmitgliedschaften/${id}/status`, { status: newStatus });
      loadData();
      // Detail neu laden
      if (selectedMitgliedschaft) {
        const res = await api.get(`/verbandsmitgliedschaften/${selectedMitgliedschaft.id}`);
        setSelectedMitgliedschaft(res.data);
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Status ändern');
    }
  };

  const handleZahlungBezahlt = async (zahlungsId) => {
    try {
      await api.post(`/verbandsmitgliedschaften/zahlungen/${zahlungsId}/bezahlt`);
      loadData();
      // Detail neu laden
      if (selectedMitgliedschaft) {
        const res = await api.get(`/verbandsmitgliedschaften/${selectedMitgliedschaft.id}`);
        setSelectedMitgliedschaft(res.data);
      }
    } catch (err) {
      alert('Fehler beim Markieren als bezahlt');
    }
  };

  const handleZahlungStornieren = async (zahlungsId) => {
    if (!window.confirm('Möchten Sie diese Zahlung wirklich stornieren?')) {
      return;
    }
    try {
      await api.post(`/verbandsmitgliedschaften/zahlungen/${zahlungsId}/stornieren`, {
        grund: 'Manuelle Stornierung'
      });
      loadData();
      // Detail neu laden
      if (selectedMitgliedschaft) {
        const res = await api.get(`/verbandsmitgliedschaften/${selectedMitgliedschaft.id}`);
        setSelectedMitgliedschaft(res.data);
      }
    } catch (err) {
      alert('Fehler beim Stornieren der Zahlung');
    }
  };

  const handleDownloadRechnungPdf = async (zahlungsId, rechnungsnummer) => {
    try {
      const response = await axios.get(`/verbandsmitgliedschaften/zahlungen/${zahlungsId}/pdf`, {
        responseType: 'blob'
      });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rechnung_${rechnungsnummer || zahlungsId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF Download Fehler:', err);
      alert('Fehler beim Download der Rechnung');
    }
  };

  const resetForm = () => {
    setFormData({
      typ: 'dojo',
      dojo_id: '',
      neues_dojo: false,
      neues_dojo_name: '',
      neues_dojo_inhaber: '',
      neues_dojo_email: '',
      neues_dojo_strasse: '',
      neues_dojo_plz: '',
      neues_dojo_ort: '',
      neues_dojo_land: 'Deutschland',
      person_vorname: '',
      person_nachname: '',
      person_email: '',
      person_telefon: '',
      person_strasse: '',
      person_plz: '',
      person_ort: '',
      person_land: 'Deutschland',
      person_geburtsdatum: '',
      zahlungsart: 'rechnung',
      notizen: '',
      beitragsfrei: false
    });
  };

  // PDF Download
  const handleDownloadPdf = async (id) => {
    try {
      window.open(`/api/verbandsmitgliedschaften/${id}/pdf`, '_blank');
    } catch (err) {
      alert('Fehler beim Download');
    }
  };

  // SEPA Mandat laden
  const loadSepaMandate = async (id) => {
    try {
      const res = await api.get(`/verbandsmitgliedschaften/${id}/sepa`);
      setSepaMandate(res.data);
    } catch (err) {
      console.error('Fehler beim Laden der SEPA-Mandate:', err);
    }
  };

  // SEPA Mandat anlegen
  const handleCreateSepa = async () => {
    if (!sepaData.iban || !sepaData.kontoinhaber) {
      alert('IBAN und Kontoinhaber sind erforderlich');
      return;
    }
    try {
      await api.post(`/verbandsmitgliedschaften/${selectedMitgliedschaft.id}/sepa`, {
        ...sepaData,
        unterschrift_digital: signatureData
      });
      setShowSepaModal(false);
      setSepaData({ iban: '', bic: '', kontoinhaber: '' });
      setSignatureData(null);
      loadSepaMandate(selectedMitgliedschaft.id);
      loadData();
      alert('SEPA-Mandat erfolgreich angelegt');
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Anlegen');
    }
  };

  // Dokumente laden
  const loadDokumente = async () => {
    try {
      const res = await api.get('/verbandsmitgliedschaften/dokumente/liste');
      setDokumente(res.data);
    } catch (err) {
      console.error('Fehler beim Laden der Dokumente:', err);
    }
  };

  // Dokument anzeigen
  const showDokument = async (typ) => {
    try {
      const res = await api.get(`/verbandsmitgliedschaften/dokumente/${typ}`);
      setSelectedDokument(res.data);
      setShowAgbModal(true);
    } catch (err) {
      alert('Dokument nicht gefunden');
    }
  };

  // Vertrag unterschreiben
  const handleUnterschreiben = async () => {
    if (!signatureData) {
      alert('Bitte unterschreiben Sie im Unterschriftsfeld');
      return;
    }
    if (!akzeptanz.agb || !akzeptanz.dsgvo || !akzeptanz.widerruf) {
      alert('Bitte akzeptieren Sie alle Bedingungen');
      return;
    }

    try {
      await api.post(`/verbandsmitgliedschaften/${selectedMitgliedschaft.id}/unterschreiben`, {
        unterschrift_digital: signatureData,
        agb_akzeptiert: akzeptanz.agb,
        dsgvo_akzeptiert: akzeptanz.dsgvo,
        widerrufsrecht_akzeptiert: akzeptanz.widerruf
      });
      setShowSignatureModal(false);
      setSignatureData(null);
      setAkzeptanz({ agb: false, dsgvo: false, widerruf: false });
      loadData();
      alert('Vertrag erfolgreich unterschrieben');
    } catch (err) {
      alert(err.response?.data?.error || 'Fehler beim Unterschreiben');
    }
  };

  // Signature Canvas Handlers
  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  };

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      const canvas = canvasRef.current;
      setSignatureData(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    initCanvas();
    setSignatureData(null);
  };

  const openDetail = async (mitgliedschaft) => {
    try {
      const [detailRes, zahlungenRes] = await Promise.all([
        api.get(`/verbandsmitgliedschaften/${mitgliedschaft.id}`),
        api.get(`/verbandsmitgliedschaften/${mitgliedschaft.id}/zahlungen`)
      ]);
      setSelectedMitgliedschaft({ ...detailRes.data, zahlungen: zahlungenRes.data });
      setDetailTab('info');
      loadSepaMandate(mitgliedschaft.id);
      loadDokumente();
      setShowDetailModal(true);
    } catch (err) {
      alert('Fehler beim Laden der Details');
    }
  };

  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredMitgliedschaften = mitgliedschaften.filter(m => {
    // Tab-Filter
    if (activeTab === 'dojos' && m.typ !== 'dojo') return false;
    if (activeTab === 'einzelpersonen' && m.typ !== 'einzelperson') return false;

    // Status-Filter
    if (statusFilter && m.status !== statusFilter) return false;

    // Suchbegriff
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const name = m.typ === 'dojo'
        ? (m.dojo_name || '')
        : `${m.person_vorname || ''} ${m.person_nachname || ''}`;
      if (!name.toLowerCase().includes(search) &&
          !m.mitgliedsnummer?.toLowerCase().includes(search)) {
        return false;
      }
    }

    return true;
  });

  // ============================================================================
  // HELPERS
  // ============================================================================

  const getStatusBadge = (status) => {
    const config = {
      aktiv: { color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: Check, label: 'Aktiv' },
      ausstehend: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', icon: Clock, label: 'Ausstehend' },
      abgelaufen: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: AlertTriangle, label: 'Abgelaufen' },
      gekuendigt: { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.15)', icon: X, label: 'Gekündigt' },
      vertragsfrei: { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', icon: Shield, label: 'Vertragsfrei' }
    };
    const c = config[status] || config.ausstehend;
    const Icon = c.icon;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        padding: '4px 10px', borderRadius: '6px',
        background: c.bg, color: c.color, fontSize: '0.8rem', fontWeight: '600'
      }}>
        <Icon size={14} />
        {c.label}
      </span>
    );
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>
          <RefreshCw size={32} className="spin" />
          <span>Lade Verbandsmitglieder...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>
            <Award size={28} color="#ffd700" />
            TDA Verbandsmitglieder
          </h1>
          <p style={styles.subtitle}>Dojo- und Einzelmitgliedschaften verwalten</p>
        </div>
        <button style={styles.primaryButton} onClick={() => setShowNewModal(true)}>
          <Plus size={18} />
          Neue Mitgliedschaft
        </button>
      </div>

      {/* Stats Cards */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <Building2 size={24} color="#3b82f6" />
          <div>
            <div style={styles.statValue}>{stats.dojos || 0}</div>
            <div style={styles.statLabel}>Dojo-Mitglieder</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <User size={24} color="#10b981" />
          <div>
            <div style={styles.statValue}>{stats.einzelpersonen || 0}</div>
            <div style={styles.statLabel}>Einzelmitglieder</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <Euro size={24} color="#ffd700" />
          <div>
            <div style={styles.statValue}>{formatCurrency(stats.jahresumsatz || 0)}</div>
            <div style={styles.statLabel}>Jahresumsatz</div>
          </div>
        </div>
        <div style={styles.statCard}>
          <AlertTriangle size={24} color="#f59e0b" />
          <div>
            <div style={styles.statValue}>{stats.auslaufend || 0}</div>
            <div style={styles.statLabel}>Laufen aus (30 Tage)</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{ ...styles.tab, ...(activeTab === 'dojos' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('dojos')}
        >
          <Building2 size={16} />
          Dojos ({mitgliedschaften.filter(m => m.typ === 'dojo').length})
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'einzelpersonen' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('einzelpersonen')}
        >
          <User size={16} />
          Einzelpersonen ({mitgliedschaften.filter(m => m.typ === 'einzelperson').length})
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'vorteile' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('vorteile')}
        >
          <Gift size={16} />
          Vorteile & Rabatte
        </button>
        <button
          style={{ ...styles.tab, ...(activeTab === 'einstellungen' ? styles.tabActive : {}) }}
          onClick={() => setActiveTab('einstellungen')}
        >
          <Settings size={16} />
          Einstellungen
        </button>
      </div>

      {/* Vorteile Tab */}
      {activeTab === 'vorteile' && (
        <div style={styles.vorteileContainer}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ ...styles.sectionTitle, margin: 0 }}>Mitgliedschaftsvorteile & Rabatte</h3>
            <button onClick={() => openVorteilModal()} style={styles.submitButton}>
              <Plus size={16} /> Neuer Vorteil
            </button>
          </div>
          <div style={styles.vorteileGrid}>
            {vorteile.map(v => (
              <div key={v.id} style={{ ...styles.vorteilCard, opacity: v.aktiv ? 1 : 0.5 }}>
                <div style={styles.vorteilHeader}>
                  <Percent size={20} color="#ffd700" />
                  <span style={styles.vorteilTitel}>{v.titel}</span>
                  {!v.aktiv && <span style={{ background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', marginLeft: '8px' }}>INAKTIV</span>}
                </div>
                <p style={styles.vorteilBeschreibung}>{v.beschreibung}</p>
                <div style={styles.vorteilMeta}>
                  <span style={styles.vorteilRabatt}>
                    {v.rabatt_typ === 'prozent' ? `${v.rabatt_wert}%` : `${v.rabatt_wert}€`} Rabatt
                  </span>
                  <span style={styles.vorteilKategorie}>{v.kategorie}</span>
                  <span style={{
                    ...styles.vorteilGilt,
                    background: v.gilt_fuer === 'dojo' ? 'rgba(59, 130, 246, 0.2)' :
                               v.gilt_fuer === 'einzelperson' ? 'rgba(16, 185, 129, 0.2)' :
                               'rgba(255, 215, 0, 0.2)'
                  }}>
                    {v.gilt_fuer === 'beide' ? 'Alle' : v.gilt_fuer === 'dojo' ? 'Dojos' : 'Einzelpersonen'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
                  <button
                    onClick={() => toggleVorteilAktiv(v.id)}
                    style={{
                      ...styles.iconButton,
                      background: v.aktiv ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                      color: v.aktiv ? '#ef4444' : '#10b981',
                      flex: 1
                    }}
                  >
                    {v.aktiv ? <><X size={14} /> Deaktivieren</> : <><Check size={14} /> Aktivieren</>}
                  </button>
                  <button onClick={() => openVorteilModal(v)} style={{ ...styles.iconButton, flex: 1 }}>
                    <Edit size={14} /> Bearbeiten
                  </button>
                  <button onClick={() => deleteVorteil(v.id)} style={{ ...styles.iconButton, color: '#ef4444' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {vorteile.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#888', gridColumn: '1 / -1' }}>
                Keine Vorteile vorhanden. Erstellen Sie einen neuen Vorteil.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Einstellungen Tab */}
      {activeTab === 'einstellungen' && (
        <div style={styles.einstellungenContainer}>
          {/* Kategorie-Tabs */}
          <div style={styles.einstellungenTabs}>
            {[
              { key: 'typen', label: 'Mitgliedschaftstypen', icon: Settings },
              { key: 'preise', label: 'Preise', icon: Euro },
              { key: 'laufzeiten', label: 'Laufzeiten', icon: Calendar },
              { key: 'zahlungen', label: 'Zahlungen', icon: CreditCard },
              { key: 'nummern', label: 'Nummern', icon: FileText },
              { key: 'verband', label: 'Verband', icon: Building2 }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                style={{
                  ...styles.einstellungenTab,
                  ...(einstellungenKategorie === key ? styles.einstellungenTabActive : {})
                }}
                onClick={() => setEinstellungenKategorie(key)}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </div>

          {/* Mitgliedschaftstypen Tab */}
          {einstellungenKategorie === 'typen' && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, color: '#fff' }}>Mitgliedschaftstypen verwalten</h3>
                <button onClick={() => openTypModal()} style={styles.submitButton}>
                  <Plus size={16} /> Neuer Typ
                </button>
              </div>

              {typenLoading ? (
                <div style={styles.loading}>
                  <RefreshCw size={24} className="spin" />
                  <span>Lade Typen...</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {mitgliedschaftstypen.map(typ => (
                    <div key={typ.id} style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      gap: '16px',
                      alignItems: 'center',
                      opacity: typ.aktiv ? 1 : 0.6
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{
                            background: typ.kategorie === 'dojo' ? 'rgba(59,130,246,0.2)' : 'rgba(16,185,129,0.2)',
                            color: typ.kategorie === 'dojo' ? '#60a5fa' : '#34d399',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            textTransform: 'uppercase'
                          }}>
                            {typ.kategorie}
                          </span>
                          <strong style={{ color: '#fff', fontSize: '16px' }}>{typ.name}</strong>
                          <code style={{ color: '#888', fontSize: '12px' }}>({typ.code})</code>
                          {typ.ist_standard && (
                            <span style={{ background: '#fbbf24', color: '#000', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>STANDARD</span>
                          )}
                          {!typ.aktiv && (
                            <span style={{ background: '#ef4444', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontSize: '10px' }}>INAKTIV</span>
                          )}
                        </div>
                        <p style={{ color: '#aaa', margin: '4px 0 8px', fontSize: '13px' }}>{typ.beschreibung || '-'}</p>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px', color: '#ccc' }}>
                          <span><Euro size={14} style={{ marginRight: '4px' }} /><strong>{typ.preis_brutto?.toFixed(2)}€</strong> brutto ({typ.preis_netto}€ netto)</span>
                          <span><Percent size={14} style={{ marginRight: '4px' }} />{typ.steuersatz}% MwSt</span>
                          <span><Calendar size={14} style={{ marginRight: '4px' }} />{typ.laufzeit_monate} Monate Laufzeit</span>
                          <span>{typ.auto_verlaengerung ? '🔄 Auto-Verlängerung' : '📅 Einmalig'}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => toggleTypAktiv(typ.id)}
                          style={{
                            ...styles.iconButton,
                            background: typ.aktiv ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                            color: typ.aktiv ? '#ef4444' : '#10b981'
                          }}
                          title={typ.aktiv ? 'Deaktivieren' : 'Aktivieren'}
                        >
                          {typ.aktiv ? <X size={16} /> : <Check size={16} />}
                        </button>
                        <button onClick={() => openTypModal(typ)} style={styles.iconButton} title="Bearbeiten">
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => deleteTyp(typ.id)}
                          style={{ ...styles.iconButton, color: '#ef4444' }}
                          title="Löschen"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {mitgliedschaftstypen.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                      Keine Mitgliedschaftstypen vorhanden. Erstellen Sie einen neuen Typ.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Andere Einstellungen */}
          {einstellungenKategorie !== 'typen' && einstellungenLoading ? (
            <div style={styles.loading}>
              <RefreshCw size={24} className="spin" />
              <span>Lade Einstellungen...</span>
            </div>
          ) : einstellungenKategorie !== 'typen' && (
            <>
              <div style={styles.einstellungenGrid}>
                {einstellungen
                  .filter(e => e.kategorie === einstellungenKategorie)
                  .map(e => (
                    <div key={e.einstellung_key} style={styles.einstellungItem}>
                      <label style={styles.einstellungLabel}>
                        {e.label}
                        {e.beschreibung && (
                          <span style={styles.einstellungHint}>{e.beschreibung}</span>
                        )}
                      </label>
                      {e.einstellung_typ === 'boolean' ? (
                        <label style={styles.toggleLabel}>
                          <input
                            type="checkbox"
                            checked={getEinstellungValue(e.einstellung_key) === true}
                            onChange={(ev) => handleEinstellungChange(e.einstellung_key, ev.target.checked)}
                            style={styles.toggleInput}
                          />
                          <span style={{
                            ...styles.toggleSwitch,
                            background: getEinstellungValue(e.einstellung_key) ? '#10b981' : '#ef4444'
                          }}>
                            <span style={{
                              position: 'absolute',
                              top: '2px',
                              left: '2px',
                              width: '20px',
                              height: '20px',
                              background: '#fff',
                              borderRadius: '50%',
                              transition: 'transform 0.2s',
                              transform: getEinstellungValue(e.einstellung_key) ? 'translateX(24px)' : 'translateX(0)'
                            }}></span>
                          </span>
                          <span style={{
                            ...styles.toggleText,
                            color: getEinstellungValue(e.einstellung_key) ? '#10b981' : '#ef4444',
                            fontWeight: '600'
                          }}>
                            {getEinstellungValue(e.einstellung_key) ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </label>
                      ) : e.einstellung_typ === 'number' ? (
                        <input
                          type="number"
                          value={getEinstellungValue(e.einstellung_key)}
                          onChange={(ev) => handleEinstellungChange(e.einstellung_key, parseFloat(ev.target.value) || 0)}
                          style={styles.einstellungInput}
                          step={e.einstellung_key.includes('preis') || e.einstellung_key.includes('mwst') ? '0.01' : '1'}
                        />
                      ) : e.einstellung_typ === 'json' ? (
                        <textarea
                          value={typeof getEinstellungValue(e.einstellung_key) === 'object'
                            ? JSON.stringify(getEinstellungValue(e.einstellung_key), null, 2)
                            : getEinstellungValue(e.einstellung_key)}
                          onChange={(ev) => {
                            try {
                              handleEinstellungChange(e.einstellung_key, JSON.parse(ev.target.value));
                            } catch {
                              // Ignorieren wenn kein gültiges JSON
                            }
                          }}
                          style={{ ...styles.einstellungInput, minHeight: '80px', fontFamily: 'monospace' }}
                        />
                      ) : (
                        <input
                          type="text"
                          value={getEinstellungValue(e.einstellung_key)}
                          onChange={(ev) => handleEinstellungChange(e.einstellung_key, ev.target.value)}
                          style={styles.einstellungInput}
                        />
                      )}
                      {einstellungenChanged.hasOwnProperty(e.einstellung_key) && (
                        <span style={styles.changedBadge}>Geändert</span>
                      )}
                    </div>
                  ))}
              </div>

              {Object.keys(einstellungenChanged).length > 0 && (
                <div style={styles.einstellungenFooter}>
                  <span style={styles.changesCount}>
                    {Object.keys(einstellungenChanged).length} Änderung(en)
                  </span>
                  <button
                    style={styles.cancelButton}
                    onClick={() => {
                      setEinstellungenChanged({});
                      loadEinstellungen();
                    }}
                  >
                    Verwerfen
                  </button>
                  <button
                    style={styles.submitButton}
                    onClick={saveEinstellungen}
                    disabled={savingEinstellungen}
                  >
                    {savingEinstellungen ? (
                      <><RefreshCw size={16} className="spin" /> Speichern...</>
                    ) : (
                      <><Save size={16} /> Speichern</>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Mitgliederliste */}
      {activeTab !== 'vorteile' && activeTab !== 'einstellungen' && (
        <>
          {/* Filter Bar */}
          <div style={styles.filterBar}>
            <div style={styles.searchBox}>
              <Search size={18} color="#888" />
              <input
                type="text"
                placeholder="Suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={styles.searchInput}
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.select}
            >
              <option value="">Alle Status</option>
              <option value="aktiv">Aktiv</option>
              <option value="ausstehend">Ausstehend</option>
              <option value="abgelaufen">Abgelaufen</option>
              <option value="gekuendigt">Gekündigt</option>
            </select>
            <button style={styles.iconButton} onClick={loadData}>
              <RefreshCw size={18} />
            </button>
          </div>

          {/* Liste */}
          <div style={styles.list}>
            {filteredMitgliedschaften.length === 0 ? (
              <div style={styles.emptyState}>
                <Building2 size={48} color="#666" />
                <p>Keine Mitgliedschaften gefunden</p>
              </div>
            ) : (
              filteredMitgliedschaften.map(m => (
                <div
                  key={m.id}
                  style={styles.listItem}
                  onClick={() => openDetail(m)}
                >
                  <div style={styles.listItemIcon}>
                    {m.typ === 'dojo' ? (
                      <Building2 size={24} color="#3b82f6" />
                    ) : (
                      <User size={24} color="#10b981" />
                    )}
                  </div>
                  <div style={styles.listItemContent}>
                    <div style={styles.listItemHeader}>
                      <span style={styles.listItemName}>
                        {m.typ === 'dojo' ? m.dojo_name : `${m.person_vorname} ${m.person_nachname}`}
                      </span>
                      {getStatusBadge(m.status)}
                    </div>
                    <div style={styles.listItemMeta}>
                      <span><FileText size={12} /> {m.mitgliedsnummer}</span>
                      <span><Calendar size={12} /> Bis: {formatDate(m.gueltig_bis)}</span>
                      <span><Euro size={12} /> {formatCurrency(m.jahresbeitrag)}/Jahr</span>
                    </div>
                  </div>
                  <ChevronDown size={20} color="#888" />
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* New Modal */}
      {showNewModal && (
        <div style={styles.modalOverlay} onClick={() => setShowNewModal(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Neue Mitgliedschaft</h2>
              <button style={styles.closeButton} onClick={() => setShowNewModal(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Typ-Auswahl */}
              <div style={styles.typSelector}>
                <button
                  type="button"
                  style={{
                    ...styles.typButton,
                    ...(formData.typ === 'dojo' ? styles.typButtonActive : {})
                  }}
                  onClick={() => setFormData({ ...formData, typ: 'dojo' })}
                >
                  <Building2 size={24} />
                  <span>Dojo</span>
                  <span style={styles.typPrice}>{formatCurrency(config.preis_dojo_mitgliedschaft || 99)}/Jahr</span>
                </button>
                <button
                  type="button"
                  style={{
                    ...styles.typButton,
                    ...(formData.typ === 'einzelperson' ? styles.typButtonActiveGreen : {})
                  }}
                  onClick={() => setFormData({ ...formData, typ: 'einzelperson' })}
                >
                  <User size={24} />
                  <span>Einzelperson</span>
                  <span style={styles.typPrice}>{formatCurrency(config.preis_einzel_mitgliedschaft || 49)}/Jahr</span>
                </button>
              </div>

              {/* Dojo-Auswahl oder Neues Dojo */}
              {formData.typ === 'dojo' && (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>
                      {formData.neues_dojo ? 'Modus: Neues Dojo anlegen' : 'Dojo *'}
                    </label>
                    {formData.neues_dojo ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          padding: '10px 15px',
                          background: 'rgba(255, 215, 0, 0.2)',
                          borderRadius: '8px',
                          color: '#ffd700',
                          fontWeight: '600',
                          flex: 1
                        }}>
                          ➕ Neues Dojo wird angelegt
                        </span>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, neues_dojo: false, dojo_id: '' })}
                          style={{
                            padding: '10px 15px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '8px',
                            color: '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          Abbrechen
                        </button>
                      </div>
                    ) : (
                      <select
                        value={formData.dojo_id}
                        onChange={(e) => {
                          if (e.target.value === 'neu') {
                            setFormData({ ...formData, neues_dojo: true, dojo_id: '' });
                          } else {
                            setFormData({ ...formData, neues_dojo: false, dojo_id: e.target.value });
                          }
                        }}
                        style={styles.input}
                      >
                        <option value="">-- Dojo wählen --</option>
                        {dojosOhneMitgliedschaft.map(d => (
                          <option key={d.id} value={d.id}>
                            {d.name} {d.ort ? `(${d.ort})` : ''}
                          </option>
                        ))}
                        <option value="neu" style={{ fontWeight: 'bold', borderTop: '1px solid #ccc' }}>
                          ➕ Neues Dojo anlegen...
                        </option>
                      </select>
                    )}
                  </div>

                  {/* Beitragsfrei Option (nur für Admin) */}
                  {isAdmin && (
                    <div style={{ ...styles.formGroup, marginTop: '0.5rem' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        cursor: 'pointer',
                        padding: '10px 15px',
                        background: formData.beitragsfrei ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        borderRadius: '8px',
                        border: formData.beitragsfrei ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)'
                      }}>
                        <input
                          type="checkbox"
                          checked={formData.beitragsfrei}
                          onChange={(e) => setFormData({ ...formData, beitragsfrei: e.target.checked })}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <span style={{ color: formData.beitragsfrei ? '#22c55e' : 'rgba(255, 255, 255, 0.8)' }}>
                          🎁 Beitragsfrei stellen (keine Gebühren)
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Neues Dojo Formular */}
                  {formData.neues_dojo && (
                    <div style={{ ...styles.card, background: 'rgba(255, 215, 0, 0.1)', marginBottom: '1rem' }}>
                      <h4 style={{ margin: '0 0 1rem 0', color: '#ffd700' }}>Neues Dojo anlegen</h4>
                      <div style={styles.formRow}>
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Dojo-Name *</label>
                          <input
                            type="text"
                            value={formData.neues_dojo_name}
                            onChange={(e) => setFormData({ ...formData, neues_dojo_name: e.target.value })}
                            style={styles.input}
                            placeholder="z.B. Kampfsportschule Muster"
                            
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Inhaber *</label>
                          <input
                            type="text"
                            value={formData.neues_dojo_inhaber}
                            onChange={(e) => setFormData({ ...formData, neues_dojo_inhaber: e.target.value })}
                            style={styles.input}
                            placeholder="Vor- und Nachname"
                            
                          />
                        </div>
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>E-Mail *</label>
                        <input
                          type="email"
                          value={formData.neues_dojo_email}
                          onChange={(e) => setFormData({ ...formData, neues_dojo_email: e.target.value })}
                          style={styles.input}
                          placeholder="info@dojo.de"
                          
                        />
                      </div>
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Straße</label>
                        <input
                          type="text"
                          value={formData.neues_dojo_strasse}
                          onChange={(e) => setFormData({ ...formData, neues_dojo_strasse: e.target.value })}
                          style={styles.input}
                          placeholder="Musterstraße 123"
                        />
                      </div>
                      <div style={styles.formRow}>
                        <div style={styles.formGroup}>
                          <label style={styles.label}>PLZ</label>
                          <input
                            type="text"
                            value={formData.neues_dojo_plz}
                            onChange={(e) => setFormData({ ...formData, neues_dojo_plz: e.target.value })}
                            style={styles.input}
                            placeholder="12345"
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Ort</label>
                          <input
                            type="text"
                            value={formData.neues_dojo_ort}
                            onChange={(e) => setFormData({ ...formData, neues_dojo_ort: e.target.value })}
                            style={styles.input}
                            placeholder="Musterstadt"
                          />
                        </div>
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Land</label>
                          <input
                            type="text"
                            value={formData.neues_dojo_land}
                            onChange={(e) => setFormData({ ...formData, neues_dojo_land: e.target.value })}
                            style={styles.input}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Personen-Daten */}
              {formData.typ === 'einzelperson' && (
                <>
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Vorname *</label>
                      <input
                        type="text"
                        value={formData.person_vorname}
                        onChange={(e) => setFormData({ ...formData, person_vorname: e.target.value })}
                        style={styles.input}
                        
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Nachname *</label>
                      <input
                        type="text"
                        value={formData.person_nachname}
                        onChange={(e) => setFormData({ ...formData, person_nachname: e.target.value })}
                        style={styles.input}
                        
                      />
                    </div>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>E-Mail *</label>
                    <input
                      type="email"
                      value={formData.person_email}
                      onChange={(e) => setFormData({ ...formData, person_email: e.target.value })}
                      style={styles.input}
                      
                    />
                  </div>
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Telefon</label>
                      <input
                        type="tel"
                        value={formData.person_telefon}
                        onChange={(e) => setFormData({ ...formData, person_telefon: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Geburtsdatum</label>
                      <input
                        type="date"
                        value={formData.person_geburtsdatum}
                        onChange={(e) => setFormData({ ...formData, person_geburtsdatum: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Straße</label>
                    <input
                      type="text"
                      value={formData.person_strasse}
                      onChange={(e) => setFormData({ ...formData, person_strasse: e.target.value })}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formRow}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>PLZ</label>
                      <input
                        type="text"
                        value={formData.person_plz}
                        onChange={(e) => setFormData({ ...formData, person_plz: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Ort</label>
                      <input
                        type="text"
                        value={formData.person_ort}
                        onChange={(e) => setFormData({ ...formData, person_ort: e.target.value })}
                        style={styles.input}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Zahlungsart */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Zahlungsart</label>
                <select
                  value={formData.zahlungsart}
                  onChange={(e) => setFormData({ ...formData, zahlungsart: e.target.value })}
                  style={styles.input}
                >
                  <option value="rechnung">Rechnung</option>
                  <option value="lastschrift">SEPA-Lastschrift</option>
                  <option value="paypal">PayPal</option>
                  <option value="ueberweisung">Überweisung</option>
                </select>
              </div>

              {/* Notizen */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Notizen</label>
                <textarea
                  value={formData.notizen}
                  onChange={(e) => setFormData({ ...formData, notizen: e.target.value })}
                  style={{ ...styles.input, minHeight: '80px' }}
                />
              </div>

              <div style={styles.modalFooter}>
                <button type="button" style={styles.cancelButton} onClick={() => setShowNewModal(false)}>
                  Abbrechen
                </button>
                <button type="submit" style={styles.submitButton}>
                  <Check size={18} />
                  Mitgliedschaft anlegen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedMitgliedschaft && (
        <div style={styles.modalOverlay} onClick={() => setShowDetailModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                {selectedMitgliedschaft.typ === 'dojo' ? (
                  <><Building2 size={24} color="#3b82f6" /> {selectedMitgliedschaft.dojo_name}</>
                ) : (
                  <><User size={24} color="#10b981" /> {selectedMitgliedschaft.person_vorname} {selectedMitgliedschaft.person_nachname}</>
                )}
              </h2>
              <button style={styles.closeButton} onClick={() => setShowDetailModal(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Detail Tabs */}
            <div style={styles.detailTabs}>
              <button
                style={{ ...styles.detailTab, ...(detailTab === 'info' ? styles.detailTabActive : {}) }}
                onClick={() => setDetailTab('info')}
              >
                <User size={16} /> Info
              </button>
              <button
                style={{ ...styles.detailTab, ...(detailTab === 'vertrag' ? styles.detailTabActive : {}) }}
                onClick={() => setDetailTab('vertrag')}
              >
                <FileText size={16} /> Vertrag
              </button>
              <button
                style={{ ...styles.detailTab, ...(detailTab === 'sepa' ? styles.detailTabActive : {}) }}
                onClick={() => setDetailTab('sepa')}
              >
                <Banknote size={16} /> SEPA
              </button>
              <button
                style={{ ...styles.detailTab, ...(detailTab === 'historie' ? styles.detailTabActive : {}) }}
                onClick={() => setDetailTab('historie')}
              >
                <History size={16} /> Historie
              </button>
            </div>

            <div style={styles.detailContent}>
              {/* INFO TAB */}
              {detailTab === 'info' && (
                <>
                  {/* Status & Mitgliedsnummer */}
                  <div style={styles.detailRow}>
                    <div style={styles.detailItem}>
                      <span style={styles.detailLabel}>Mitgliedsnummer</span>
                      <span style={styles.detailValue}>{selectedMitgliedschaft.mitgliedsnummer}</span>
                    </div>
                    <div style={styles.detailItem}>
                      <span style={styles.detailLabel}>Status</span>
                      <select
                        value={selectedMitgliedschaft.status}
                        onChange={(e) => handleStatusChange(selectedMitgliedschaft.id, e.target.value)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: '1px solid rgba(255,255,255,0.2)',
                          background: selectedMitgliedschaft.status === 'aktiv' ? 'rgba(16, 185, 129, 0.2)' :
                                     selectedMitgliedschaft.status === 'ausstehend' ? 'rgba(245, 158, 11, 0.2)' :
                                     selectedMitgliedschaft.status === 'vertragsfrei' ? 'rgba(107, 114, 128, 0.2)' :
                                     'rgba(239, 68, 68, 0.2)',
                          color: selectedMitgliedschaft.status === 'aktiv' ? '#10b981' :
                                 selectedMitgliedschaft.status === 'ausstehend' ? '#f59e0b' :
                                 selectedMitgliedschaft.status === 'vertragsfrei' ? '#6b7280' : '#ef4444',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="ausstehend">Ausstehend</option>
                        <option value="aktiv">Aktiv</option>
                        <option value="gekuendigt">Gekündigt</option>
                        <option value="abgelaufen">Abgelaufen</option>
                        <option value="vertragsfrei">Vertragsfrei</option>
                      </select>
                    </div>
                    <div style={styles.detailItem}>
                      <span style={styles.detailLabel}>Vertrag</span>
                      {selectedMitgliedschaft.unterschrift_digital ? (
                        <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={14} /> Unterschrieben
                        </span>
                      ) : (
                        <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={14} /> Ausstehend
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Laufzeit */}
                  <div style={styles.detailRow}>
                    <div style={styles.detailItem}>
                      <span style={styles.detailLabel}>Gültig von</span>
                      <span style={styles.detailValue}>{formatDate(selectedMitgliedschaft.gueltig_von)}</span>
                    </div>
                    <div style={styles.detailItem}>
                      <span style={styles.detailLabel}>Gültig bis</span>
                      <span style={styles.detailValue}>{formatDate(selectedMitgliedschaft.gueltig_bis)}</span>
                    </div>
                    <div style={styles.detailItem}>
                      <span style={styles.detailLabel}>Jahresbeitrag</span>
                      <span style={styles.detailValue}>{formatCurrency(selectedMitgliedschaft.jahresbeitrag)}</span>
                    </div>
                  </div>

                  {/* Beitragsfrei Toggle (nur für Admin) */}
                  {isAdmin && (
                    <div style={{
                      padding: '12px 16px',
                      background: selectedMitgliedschaft.beitragsfrei ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '8px',
                      border: selectedMitgliedschaft.beitragsfrei ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Gift size={18} color={selectedMitgliedschaft.beitragsfrei ? '#22c55e' : '#6b7280'} />
                          <span style={{ color: selectedMitgliedschaft.beitragsfrei ? '#22c55e' : 'rgba(255, 255, 255, 0.8)' }}>
                            {selectedMitgliedschaft.beitragsfrei ? 'Beitragsfrei' : 'Regulärer Beitrag'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const newValue = !selectedMitgliedschaft.beitragsfrei;
                            const confirmMsg = newValue
                              ? 'Mitgliedschaft auf beitragsfrei setzen? Offene Zahlungen werden storniert.'
                              : 'Beitragsfrei aufheben? Der normale Jahresbeitrag wird wieder berechnet.';
                            if (!confirm(confirmMsg)) return;
                            try {
                              const res = await api.post(`/verbandsmitgliedschaften/${selectedMitgliedschaft.id}/beitragsfrei`, { beitragsfrei: newValue });
                              alert(res.data.message);
                              // Daten neu laden
                              loadData();
                              const detail = await api.get(`/verbandsmitgliedschaften/${selectedMitgliedschaft.id}`);
                              setSelectedMitgliedschaft(detail.data);
                            } catch (err) {
                              alert(err.response?.data?.error || 'Fehler beim Umstellen');
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            background: selectedMitgliedschaft.beitragsfrei ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                            border: selectedMitgliedschaft.beitragsfrei ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(34, 197, 94, 0.3)',
                            borderRadius: '6px',
                            color: selectedMitgliedschaft.beitragsfrei ? '#ef4444' : '#22c55e',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '500'
                          }}
                        >
                          {selectedMitgliedschaft.beitragsfrei ? 'Beitragsfrei aufheben' : 'Beitragsfrei stellen'}
                        </button>
                      </div>
                      {selectedMitgliedschaft.beitragsfrei && (
                        <p style={{ margin: '8px 0 0 0', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                          Diese Mitgliedschaft ist von Beiträgen befreit. Bei Verlängerung werden keine Zahlungen erstellt.
                        </p>
                      )}
                    </div>
                  )}


                  {/* Dojo Statistiken */}
                  {selectedMitgliedschaft.typ === 'dojo' && selectedMitgliedschaft.dojo_stats && (
                    <div style={styles.detailSection}>
                      <h4 style={styles.detailSectionTitle}>
                        <Building2 size={16} style={{ marginRight: '8px' }} />
                        Dojo Statistiken
                      </h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: '12px',
                        marginTop: '12px'
                      }}>
                        {/* Mitglieder */}
                        <div style={{
                          background: 'rgba(59, 130, 246, 0.15)',
                          borderRadius: '8px',
                          padding: '12px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#3b82f6' }}>
                            {selectedMitgliedschaft.dojo_stats.mitglieder?.aktiv || 0}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Mitglieder aktiv</div>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                            ({selectedMitgliedschaft.dojo_stats.mitglieder?.gesamt || 0} gesamt)
                          </div>
                        </div>

                        {/* Kurse */}
                        <div style={{
                          background: 'rgba(16, 185, 129, 0.15)',
                          borderRadius: '8px',
                          padding: '12px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10b981' }}>
                            {selectedMitgliedschaft.dojo_stats.kurse?.aktiv || 0}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Kurse aktiv</div>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                            ({selectedMitgliedschaft.dojo_stats.kurse?.gesamt || 0} gesamt)
                          </div>
                        </div>

                        {/* Trainer */}
                        <div style={{
                          background: 'rgba(245, 158, 11, 0.15)',
                          borderRadius: '8px',
                          padding: '12px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#f59e0b' }}>
                            {selectedMitgliedschaft.dojo_stats.trainer?.anzahl || 0}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Trainer</div>
                        </div>

                        {/* Admins */}
                        <div style={{
                          background: 'rgba(139, 92, 246, 0.15)',
                          borderRadius: '8px',
                          padding: '12px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#8b5cf6' }}>
                            {selectedMitgliedschaft.dojo_stats.admins?.aktiv || 0}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Admin-Accounts</div>
                        </div>

                        {/* Stile */}
                        <div style={{
                          background: 'rgba(236, 72, 153, 0.15)',
                          borderRadius: '8px',
                          padding: '12px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ec4899' }}>
                            {selectedMitgliedschaft.dojo_stats.stile || 0}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Kampfstile</div>
                        </div>

                        {/* Standorte */}
                        <div style={{
                          background: 'rgba(6, 182, 212, 0.15)',
                          borderRadius: '8px',
                          padding: '12px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#06b6d4' }}>
                            {selectedMitgliedschaft.dojo_stats.standorte || 0}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Standorte</div>
                        </div>

                        {/* Events */}
                        <div style={{
                          background: 'rgba(251, 146, 60, 0.15)',
                          borderRadius: '8px',
                          padding: '12px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fb923c' }}>
                            {selectedMitgliedschaft.dojo_stats.events?.kommende || 0}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Events (kommend)</div>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                            ({selectedMitgliedschaft.dojo_stats.events?.gesamt || 0} gesamt)
                          </div>
                        </div>

                        {/* Speicherplatz */}
                        <div style={{
                          background: 'rgba(100, 116, 139, 0.15)',
                          borderRadius: '8px',
                          padding: '12px',
                          textAlign: 'center'
                        }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#64748b' }}>
                            {selectedMitgliedschaft.dojo_stats.speicherplatz?.mb || 0} MB
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>Speicherplatz</div>
                          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                            ({selectedMitgliedschaft.dojo_stats.speicherplatz?.dokumente || 0} Dokumente)
                          </div>
                        </div>
                      </div>

                      {/* Zusätzliche Infos */}
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '16px',
                        marginTop: '16px',
                        padding: '12px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        borderRadius: '8px'
                      }}>
                        <div style={{ flex: '1 1 200px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>Dojo erstellt am:</span>
                          <div style={{ color: '#fff', fontWeight: '500' }}>
                            {selectedMitgliedschaft.dojo_created_at
                              ? new Date(selectedMitgliedschaft.dojo_created_at).toLocaleDateString('de-DE')
                              : '-'}
                          </div>
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>Letztes Admin-Login:</span>
                          <div style={{ color: '#fff', fontWeight: '500' }}>
                            {selectedMitgliedschaft.dojo_stats.letztes_login
                              ? new Date(selectedMitgliedschaft.dojo_stats.letztes_login).toLocaleString('de-DE')
                              : 'Noch nie'}
                          </div>
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>Subscription:</span>
                          <div style={{ color: '#fff', fontWeight: '500' }}>
                            {selectedMitgliedschaft.subscription_plan || 'Keine'}
                            {selectedMitgliedschaft.subscription_status && (
                              <span style={{
                                marginLeft: '8px',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '0.7rem',
                                background: selectedMitgliedschaft.subscription_status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: selectedMitgliedschaft.subscription_status === 'active' ? '#10b981' : '#ef4444'
                              }}>
                                {selectedMitgliedschaft.subscription_status}
                              </span>
                            )}
                          </div>
                        </div>
                        <div style={{ flex: '1 1 200px' }}>
                          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>Dojo Status:</span>
                          <div style={{
                            color: selectedMitgliedschaft.dojo_ist_aktiv ? '#10b981' : '#ef4444',
                            fontWeight: '500'
                          }}>
                            {selectedMitgliedschaft.dojo_ist_aktiv ? '✓ Aktiv' : '✗ Inaktiv'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Kontakt (bei Einzelperson) */}
                  {selectedMitgliedschaft.typ === 'einzelperson' && (
                    <div style={styles.detailSection}>
                      <h4 style={styles.detailSectionTitle}>Kontaktdaten</h4>
                      <div style={styles.detailRow}>
                        <div style={styles.detailItem}>
                          <Mail size={14} />
                          <span>{selectedMitgliedschaft.person_email || '-'}</span>
                        </div>
                        <div style={styles.detailItem}>
                          <Phone size={14} />
                          <span>{selectedMitgliedschaft.person_telefon || '-'}</span>
                        </div>
                      </div>
                      {selectedMitgliedschaft.person_strasse && (
                        <div style={styles.detailItem}>
                          <MapPin size={14} />
                          <span>
                            {selectedMitgliedschaft.person_strasse}, {selectedMitgliedschaft.person_plz} {selectedMitgliedschaft.person_ort}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Zahlungen - nicht anzeigen bei vertragsfrei */}
                  {selectedMitgliedschaft.status !== 'vertragsfrei' && (
                  <div style={styles.detailSection}>
                    <h4 style={styles.detailSectionTitle}>Zahlungen</h4>
                    {selectedMitgliedschaft.zahlungen?.length === 0 ? (
                      <p style={styles.hint}>Keine Zahlungen vorhanden</p>
                    ) : (
                      <div style={styles.zahlungenList}>
                        {selectedMitgliedschaft.zahlungen?.map(z => (
                          <div key={z.id} style={styles.zahlungItem}>
                            <div style={styles.zahlungMain}>
                              <span style={styles.zahlungNummer}>{z.rechnungsnummer}</span>
                              <span style={styles.zahlungBetrag}>{formatCurrency(z.betrag_brutto)}</span>
                              <span style={{
                                ...styles.zahlungStatus,
                                color: z.status === 'bezahlt' ? '#10b981' : z.status === 'offen' ? '#f59e0b' : '#ef4444'
                              }}>
                                {z.status === 'bezahlt' ? 'Bezahlt' : z.status === 'offen' ? 'Offen' : z.status}
                              </span>
                            </div>
                            <div style={styles.zahlungMeta}>
                              <span>Fällig: {formatDate(z.faellig_am)}</span>
                              {z.bezahlt_am && <span>Bezahlt: {formatDate(z.bezahlt_am)}</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                              {z.status === 'offen' && (
                                <button
                                  style={styles.smallButton}
                                  onClick={() => handleZahlungBezahlt(z.id)}
                                >
                                  <Check size={14} /> Als bezahlt markieren
                                </button>
                              )}
                              {(z.status === 'offen' || z.status === 'bezahlt') && (
                                <button
                                  style={{ ...styles.smallButton, backgroundColor: '#ef4444', color: '#fff' }}
                                  onClick={() => handleZahlungStornieren(z.id)}
                                >
                                  <X size={14} /> Stornieren
                                </button>
                              )}
                              <button
                                style={{ ...styles.smallButton, backgroundColor: '#3b82f6', color: '#fff' }}
                                onClick={() => handleDownloadRechnungPdf(z.id, z.rechnungsnummer)}
                              >
                                <Download size={14} /> Rechnung PDF
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  )}

                  {/* Notizen */}
                  {selectedMitgliedschaft.notizen && (
                    <div style={styles.detailSection}>
                      <h4 style={styles.detailSectionTitle}>Notizen</h4>
                      <p style={styles.notizen}>{selectedMitgliedschaft.notizen}</p>
                    </div>
                  )}
                </>
              )}

              {/* VERTRAG TAB */}
              {detailTab === 'vertrag' && (
                <>
                  <div style={styles.vertragActions}>
                    <button
                      style={styles.actionButton}
                      onClick={() => handleDownloadPdf(selectedMitgliedschaft.id)}
                    >
                      <Download size={18} />
                      Vertrag als PDF
                    </button>
                    {!selectedMitgliedschaft.unterschrift_digital && (
                      <button
                        style={{ ...styles.actionButton, ...styles.actionButtonPrimary }}
                        onClick={() => setShowSignatureModal(true)}
                      >
                        <PenTool size={18} />
                        Jetzt unterschreiben
                      </button>
                    )}
                  </div>

                  <div style={styles.vertragInfo}>
                    <h4 style={styles.detailSectionTitle}>Vertragsstatus</h4>
                    <div style={styles.vertragStatusGrid}>
                      <div style={styles.vertragStatusItem}>
                        <Shield size={20} color={selectedMitgliedschaft.agb_akzeptiert ? '#10b981' : '#666'} />
                        <span>AGB akzeptiert</span>
                        {selectedMitgliedschaft.agb_akzeptiert ? (
                          <Check size={16} color="#10b981" />
                        ) : (
                          <X size={16} color="#666" />
                        )}
                      </div>
                      <div style={styles.vertragStatusItem}>
                        <ScrollText size={20} color={selectedMitgliedschaft.dsgvo_akzeptiert ? '#10b981' : '#666'} />
                        <span>DSGVO akzeptiert</span>
                        {selectedMitgliedschaft.dsgvo_akzeptiert ? (
                          <Check size={16} color="#10b981" />
                        ) : (
                          <X size={16} color="#666" />
                        )}
                      </div>
                      <div style={styles.vertragStatusItem}>
                        <FileText size={20} color={selectedMitgliedschaft.widerrufsrecht_akzeptiert ? '#10b981' : '#666'} />
                        <span>Widerrufsbelehrung</span>
                        {selectedMitgliedschaft.widerrufsrecht_akzeptiert ? (
                          <Check size={16} color="#10b981" />
                        ) : (
                          <X size={16} color="#666" />
                        )}
                      </div>
                      <div style={styles.vertragStatusItem}>
                        <PenTool size={20} color={selectedMitgliedschaft.unterschrift_digital ? '#10b981' : '#666'} />
                        <span>Unterschrieben</span>
                        {selectedMitgliedschaft.unterschrift_digital ? (
                          <Check size={16} color="#10b981" />
                        ) : (
                          <X size={16} color="#666" />
                        )}
                      </div>
                    </div>

                    {selectedMitgliedschaft.unterschrift_datum && (
                      <p style={styles.hint}>
                        Unterschrieben am: {formatDate(selectedMitgliedschaft.unterschrift_datum)}
                      </p>
                    )}
                  </div>

                  <div style={styles.detailSection}>
                    <h4 style={styles.detailSectionTitle}>Rechtliche Dokumente</h4>
                    <div style={styles.dokumenteListe}>
                      <button style={styles.dokumentButton} onClick={() => showDokument('agb')}>
                        <Shield size={16} /> AGB ansehen
                      </button>
                      <button style={styles.dokumentButton} onClick={() => showDokument('dsgvo')}>
                        <ScrollText size={16} /> DSGVO ansehen
                      </button>
                      <button style={styles.dokumentButton} onClick={() => showDokument('widerrufsbelehrung')}>
                        <FileText size={16} /> Widerrufsbelehrung
                      </button>
                      <button style={styles.dokumentButton} onClick={() => showDokument('beitragsordnung')}>
                        <Euro size={16} /> Beitragsordnung
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* SEPA TAB */}
              {detailTab === 'sepa' && (
                <>
                  <div style={styles.vertragActions}>
                    <button
                      style={{ ...styles.actionButton, ...styles.actionButtonPrimary }}
                      onClick={() => setShowSepaModal(true)}
                    >
                      <Plus size={18} />
                      Neues SEPA-Mandat
                    </button>
                  </div>

                  {sepaMandate.length === 0 ? (
                    <div style={styles.emptyState}>
                      <Banknote size={48} color="#666" />
                      <p>Kein SEPA-Mandat vorhanden</p>
                      <p style={styles.hint}>Mit einem SEPA-Mandat können Beiträge automatisch eingezogen werden.</p>
                    </div>
                  ) : (
                    <div style={styles.sepaListe}>
                      {sepaMandate.map(m => (
                        <div key={m.id} style={styles.sepaItem}>
                          <div style={styles.sepaHeader}>
                            <span style={styles.sepaMandatsref}>{m.mandatsreferenz}</span>
                            <span style={{
                              ...styles.sepaStatus,
                              background: m.status === 'aktiv' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: m.status === 'aktiv' ? '#10b981' : '#ef4444'
                            }}>
                              {m.status === 'aktiv' ? 'Aktiv' : 'Inaktiv'}
                            </span>
                          </div>
                          <div style={styles.sepaDetails}>
                            <div><strong>IBAN:</strong> {m.iban}</div>
                            {m.bic && <div><strong>BIC:</strong> {m.bic}</div>}
                            <div><strong>Kontoinhaber:</strong> {m.kontoinhaber}</div>
                            <div><strong>Erstellt:</strong> {formatDate(m.erstellt_am)}</div>
                          </div>
                          {m.unterschrift_digital && (
                            <div style={styles.sepaSignedBadge}>
                              <Check size={14} /> Digital unterschrieben
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* HISTORIE TAB */}
              {detailTab === 'historie' && (
                <>
                  <div style={styles.detailSection}>
                    <h4 style={styles.detailSectionTitle}>Vertragshistorie</h4>
                    <div style={styles.historieListe}>
                      {selectedMitgliedschaft.historie?.length > 0 ? (
                        selectedMitgliedschaft.historie.map((h, idx) => (
                          <div key={h.id || idx} style={styles.historieItem}>
                            <div style={styles.historieDatum}>
                              {new Date(h.created_at).toLocaleString('de-DE', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </div>
                            <div style={styles.historieText}>{h.beschreibung}</div>
                          </div>
                        ))
                      ) : (
                        <p style={styles.hint}>Noch keine Historie-Einträge vorhanden.</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div style={styles.modalFooter}>
              {isAdmin && selectedMitgliedschaft.status !== 'vertragsfrei' && (
                <button
                  style={{ ...styles.dangerButton, backgroundColor: '#7f1d1d' }}
                  onClick={() => handleVertragsfrei(selectedMitgliedschaft.id)}
                >
                  <Trash2 size={16} /> Vertragsfrei
                </button>
              )}
              {selectedMitgliedschaft.status !== 'gekuendigt' && selectedMitgliedschaft.status !== 'vertragsfrei' && (
                <>
                  <button style={styles.dangerButton} onClick={() => handleKuendigen(selectedMitgliedschaft.id)}>
                    <Trash2 size={16} /> Kündigen
                  </button>
                  <button style={styles.submitButton} onClick={() => handleVerlaengern(selectedMitgliedschaft.id)}>
                    <RefreshCw size={16} /> Verlängern
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mitgliedschaftstyp Modal */}
      {showTypModal && (
        <div style={styles.modalOverlay} onClick={() => setShowTypModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                <Settings size={24} color="#ffd700" />
                {editingTyp ? 'Mitgliedschaftstyp bearbeiten' : 'Neuer Mitgliedschaftstyp'}
              </h2>
              <button style={styles.closeButton} onClick={() => setShowTypModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Code (technisch) *</label>
                  <input
                    type="text"
                    value={typFormData.code}
                    onChange={(e) => setTypFormData({ ...typFormData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    style={styles.input}
                    placeholder="z.B. premium_dojo"
                    disabled={!!editingTyp}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Name *</label>
                  <input
                    type="text"
                    value={typFormData.name}
                    onChange={(e) => setTypFormData({ ...typFormData, name: e.target.value })}
                    style={styles.input}
                    placeholder="z.B. Premium Dojo-Mitgliedschaft"
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Beschreibung</label>
                <textarea
                  value={typFormData.beschreibung}
                  onChange={(e) => setTypFormData({ ...typFormData, beschreibung: e.target.value })}
                  style={{ ...styles.input, minHeight: '80px' }}
                  placeholder="Beschreibung für Kunden..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Kategorie</label>
                  <select
                    value={typFormData.kategorie}
                    onChange={(e) => setTypFormData({ ...typFormData, kategorie: e.target.value })}
                    style={styles.input}
                  >
                    <option value="dojo">Dojo</option>
                    <option value="person">Person</option>
                    <option value="sonstige">Sonstige</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Preis (Netto) €</label>
                  <input
                    type="number"
                    value={typFormData.preis_netto}
                    onChange={(e) => setTypFormData({ ...typFormData, preis_netto: parseFloat(e.target.value) || 0 })}
                    style={styles.input}
                    step="0.01"
                    min="0"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Steuersatz %</label>
                  <input
                    type="number"
                    value={typFormData.steuersatz}
                    onChange={(e) => setTypFormData({ ...typFormData, steuersatz: parseFloat(e.target.value) || 0 })}
                    style={styles.input}
                    step="0.01"
                    min="0"
                    max="100"
                  />
                </div>
              </div>

              {/* Bruttopreis-Anzeige */}
              <div style={{
                background: 'rgba(255,215,0,0.1)',
                border: '1px solid rgba(255,215,0,0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '16px',
                textAlign: 'center'
              }}>
                <span style={{ color: '#888' }}>Bruttopreis: </span>
                <strong style={{ color: '#ffd700', fontSize: '18px' }}>
                  {(typFormData.preis_netto * (1 + typFormData.steuersatz / 100)).toFixed(2)}€
                </strong>
                <span style={{ color: '#888', marginLeft: '8px' }}>
                  (inkl. {(typFormData.preis_netto * typFormData.steuersatz / 100).toFixed(2)}€ MwSt)
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Laufzeit (Monate)</label>
                  <input
                    type="number"
                    value={typFormData.laufzeit_monate}
                    onChange={(e) => setTypFormData({ ...typFormData, laufzeit_monate: parseInt(e.target.value) || 12 })}
                    style={styles.input}
                    min="1"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Kündigungsfrist (Monate)</label>
                  <input
                    type="number"
                    value={typFormData.kuendigungsfrist_monate}
                    onChange={(e) => setTypFormData({ ...typFormData, kuendigungsfrist_monate: parseInt(e.target.value) || 0 })}
                    style={styles.input}
                    min="0"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={typFormData.auto_verlaengerung}
                    onChange={(e) => setTypFormData({ ...typFormData, auto_verlaengerung: e.target.checked })}
                  />
                  <span style={{ color: '#ccc' }}>Auto-Verlängerung</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={typFormData.ist_standard}
                    onChange={(e) => setTypFormData({ ...typFormData, ist_standard: e.target.checked })}
                  />
                  <span style={{ color: '#ccc' }}>Standard-Typ</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={typFormData.aktiv}
                    onChange={(e) => setTypFormData({ ...typFormData, aktiv: e.target.checked })}
                  />
                  <span style={{ color: '#ccc' }}>Aktiv</span>
                </label>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Sortierung</label>
                <input
                  type="number"
                  value={typFormData.sortierung}
                  onChange={(e) => setTypFormData({ ...typFormData, sortierung: parseInt(e.target.value) || 0 })}
                  style={{ ...styles.input, maxWidth: '120px' }}
                  min="0"
                />
              </div>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowTypModal(false)} style={styles.cancelButton}>
                Abbrechen
              </button>
              <button onClick={saveTyp} style={styles.submitButton}>
                <Save size={16} /> {editingTyp ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vorteil Modal */}
      {showVorteilModal && (
        <div style={styles.modalOverlay} onClick={() => setShowVorteilModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                <Percent size={24} color="#ffd700" />
                {editingVorteil ? 'Vorteil bearbeiten' : 'Neuer Vorteil'}
              </h2>
              <button style={styles.closeButton} onClick={() => setShowVorteilModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Titel *</label>
                <input
                  type="text"
                  value={vorteilFormData.titel}
                  onChange={(e) => setVorteilFormData({ ...vorteilFormData, titel: e.target.value })}
                  style={styles.input}
                  placeholder="z.B. Seminar-Rabatt"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Beschreibung</label>
                <textarea
                  value={vorteilFormData.beschreibung}
                  onChange={(e) => setVorteilFormData({ ...vorteilFormData, beschreibung: e.target.value })}
                  style={{ ...styles.input, minHeight: '80px' }}
                  placeholder="Beschreibung des Vorteils..."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Gilt für</label>
                  <select
                    value={vorteilFormData.gilt_fuer}
                    onChange={(e) => setVorteilFormData({ ...vorteilFormData, gilt_fuer: e.target.value })}
                    style={styles.input}
                  >
                    <option value="beide">Alle Mitglieder</option>
                    <option value="dojo">Nur Dojos</option>
                    <option value="einzelperson">Nur Einzelpersonen</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Kategorie</label>
                  <input
                    type="text"
                    value={vorteilFormData.kategorie}
                    onChange={(e) => setVorteilFormData({ ...vorteilFormData, kategorie: e.target.value })}
                    style={styles.input}
                    placeholder="z.B. seminar, turnier, shop"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Rabatt-Typ</label>
                  <select
                    value={vorteilFormData.rabatt_typ}
                    onChange={(e) => setVorteilFormData({ ...vorteilFormData, rabatt_typ: e.target.value })}
                    style={styles.input}
                  >
                    <option value="prozent">Prozent (%)</option>
                    <option value="festbetrag">Festbetrag (€)</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Rabatt-Wert</label>
                  <input
                    type="number"
                    value={vorteilFormData.rabatt_wert}
                    onChange={(e) => setVorteilFormData({ ...vorteilFormData, rabatt_wert: parseFloat(e.target.value) || 0 })}
                    style={styles.input}
                    step="0.01"
                    min="0"
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '16px' }}>
                <input
                  type="checkbox"
                  checked={vorteilFormData.aktiv}
                  onChange={(e) => setVorteilFormData({ ...vorteilFormData, aktiv: e.target.checked })}
                />
                <span style={{ color: '#ccc' }}>Aktiv</span>
              </label>
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowVorteilModal(false)} style={styles.cancelButton}>
                Abbrechen
              </button>
              <button onClick={saveVorteil} style={styles.submitButton}>
                <Save size={16} /> {editingVorteil ? 'Speichern' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEPA Modal */}
      {showSepaModal && selectedMitgliedschaft && (
        <div style={styles.modalOverlay} onClick={() => setShowSepaModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '550px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                <Banknote size={24} color="#ffd700" /> SEPA-Mandat erstellen
              </h2>
              <button style={styles.closeButton} onClick={() => setShowSepaModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={styles.formGroup}>
                <label style={styles.label}>IBAN *</label>
                <input
                  type="text"
                  value={sepaData.iban}
                  onChange={(e) => setSepaData({ ...sepaData, iban: e.target.value.toUpperCase() })}
                  style={styles.input}
                  placeholder="DE89 3704 0044 0532 0130 00"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>BIC (optional)</label>
                <input
                  type="text"
                  value={sepaData.bic}
                  onChange={(e) => setSepaData({ ...sepaData, bic: e.target.value.toUpperCase() })}
                  style={styles.input}
                  placeholder="COBADEFFXXX"
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Kontoinhaber *</label>
                <input
                  type="text"
                  value={sepaData.kontoinhaber}
                  onChange={(e) => setSepaData({ ...sepaData, kontoinhaber: e.target.value })}
                  style={styles.input}
                  placeholder="Max Mustermann"
                />
              </div>

              <div style={styles.signatureSection}>
                <label style={styles.label}>Digitale Unterschrift</label>
                <canvas
                  ref={canvasRef}
                  width={460}
                  height={120}
                  style={styles.signatureCanvas}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                <button type="button" style={styles.clearSignatureButton} onClick={clearSignature}>
                  Unterschrift löschen
                </button>
              </div>

              <div style={styles.sepaHinweis}>
                <Shield size={16} color="#ffd700" />
                <p>Mit dem SEPA-Lastschriftmandat ermächtigen Sie uns, den Jahresbeitrag von Ihrem Konto einzuziehen.</p>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setShowSepaModal(false)}>
                Abbrechen
              </button>
              <button style={styles.submitButton} onClick={handleCreateSepa}>
                <Check size={18} /> Mandat erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AGB/Dokument Modal */}
      {showAgbModal && selectedDokument && (
        <div style={styles.modalOverlay} onClick={() => setShowAgbModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                <ScrollText size={24} color="#ffd700" /> {selectedDokument.titel}
              </h2>
              <button style={styles.closeButton} onClick={() => setShowAgbModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={styles.dokumentContent}>
              <div style={styles.dokumentMeta}>
                <span>Version: {selectedDokument.version}</span>
                <span>Gültig ab: {formatDate(selectedDokument.gueltig_ab)}</span>
              </div>
              <div
                style={styles.dokumentText}
                dangerouslySetInnerHTML={createSafeHtml(selectedDokument.inhalt?.replace(/\n/g, '<br/>') || '')}
              />
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.submitButton} onClick={() => setShowAgbModal(false)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal */}
      {showSignatureModal && selectedMitgliedschaft && (
        <div style={styles.modalOverlay} onClick={() => setShowSignatureModal(false)}>
          <div style={{ ...styles.modal, maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>
                <PenTool size={24} color="#ffd700" /> Vertrag unterschreiben
              </h2>
              <button style={styles.closeButton} onClick={() => setShowSignatureModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <p style={styles.signatureIntro}>
                Mit Ihrer Unterschrift bestätigen Sie den Mitgliedsvertrag für die TDA Verbandsmitgliedschaft
                zum Jahresbeitrag von {formatCurrency(selectedMitgliedschaft.jahresbeitrag)}.
              </p>

              {/* Akzeptanz Checkboxen */}
              <div style={styles.akzeptanzSection}>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={akzeptanz.agb}
                    onChange={(e) => setAkzeptanz({ ...akzeptanz, agb: e.target.checked })}
                  />
                  <span>Ich akzeptiere die <a href="#" onClick={(e) => { e.preventDefault(); showDokument('agb'); }}>AGB</a> *</span>
                </label>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={akzeptanz.dsgvo}
                    onChange={(e) => setAkzeptanz({ ...akzeptanz, dsgvo: e.target.checked })}
                  />
                  <span>Ich akzeptiere die <a href="#" onClick={(e) => { e.preventDefault(); showDokument('dsgvo'); }}>Datenschutzerklärung</a> *</span>
                </label>
                <label style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={akzeptanz.widerruf}
                    onChange={(e) => setAkzeptanz({ ...akzeptanz, widerruf: e.target.checked })}
                  />
                  <span>Ich habe die <a href="#" onClick={(e) => { e.preventDefault(); showDokument('widerrufsbelehrung'); }}>Widerrufsbelehrung</a> zur Kenntnis genommen *</span>
                </label>
              </div>

              {/* Unterschrift Canvas */}
              <div style={styles.signatureSection}>
                <label style={styles.label}>Ihre Unterschrift *</label>
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={150}
                  style={styles.signatureCanvas}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                <button type="button" style={styles.clearSignatureButton} onClick={clearSignature}>
                  Unterschrift löschen
                </button>
              </div>
            </div>

            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setShowSignatureModal(false)}>
                Abbrechen
              </button>
              <button style={styles.submitButton} onClick={handleUnterschreiben}>
                <PenTool size={18} /> Verbindlich unterschreiben
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    padding: '2rem',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '4rem',
    color: '#888'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
    flexWrap: 'wrap',
    gap: '1rem'
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    color: '#fff',
    margin: 0,
    fontSize: '1.8rem'
  },
  subtitle: {
    color: '#888',
    margin: '4px 0 0 40px',
    fontSize: '0.9rem'
  },
  primaryButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
    border: 'none',
    borderRadius: '10px',
    color: '#000',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '2rem'
  },
  statCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '1.5rem',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#fff'
  },
  statLabel: {
    fontSize: '0.85rem',
    color: '#888'
  },
  tabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '1.5rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    paddingBottom: '8px'
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#888',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  tabActive: {
    background: 'rgba(255, 215, 0, 0.15)',
    color: '#ffd700'
  },
  filterBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '1.5rem',
    flexWrap: 'wrap'
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 14px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    flex: '1',
    minWidth: '200px'
  },
  searchInput: {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#fff',
    width: '100%',
    fontSize: '0.9rem'
  },
  select: {
    padding: '10px 14px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.9rem',
    cursor: 'pointer'
  },
  iconButton: {
    padding: '10px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#888',
    cursor: 'pointer'
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  listItemIcon: {
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '10px'
  },
  listItemContent: {
    flex: 1
  },
  listItemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '6px'
  },
  listItemName: {
    color: '#fff',
    fontWeight: '600',
    fontSize: '1rem'
  },
  listItemMeta: {
    display: 'flex',
    gap: '16px',
    color: '#888',
    fontSize: '0.8rem'
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: '4rem',
    color: '#666'
  },
  vorteileContainer: {
    marginTop: '1rem'
  },
  sectionTitle: {
    color: '#ffd700',
    marginBottom: '1rem',
    fontSize: '1.1rem'
  },
  vorteileGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1rem'
  },
  vorteilCard: {
    padding: '1.5rem',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 215, 0, 0.2)',
    borderRadius: '12px'
  },
  vorteilHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px'
  },
  vorteilTitel: {
    color: '#fff',
    fontWeight: '600'
  },
  vorteilBeschreibung: {
    color: '#aaa',
    fontSize: '0.85rem',
    marginBottom: '12px'
  },
  vorteilMeta: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap'
  },
  vorteilRabatt: {
    padding: '4px 10px',
    background: 'rgba(255, 215, 0, 0.2)',
    color: '#ffd700',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  vorteilKategorie: {
    padding: '4px 10px',
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#888',
    borderRadius: '6px',
    fontSize: '0.8rem',
    textTransform: 'capitalize'
  },
  vorteilGilt: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '0.8rem',
    color: '#fff'
  },

  // Modal Styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px'
  },
  modal: {
    background: '#1a1a2e',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '550px',
    maxHeight: '90vh',
    overflow: 'auto',
    border: '1px solid rgba(255, 215, 0, 0.2)'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1.5rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
  },
  modalTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#fff',
    margin: 0,
    fontSize: '1.2rem'
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    padding: '8px'
  },
  typSelector: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    padding: '1.5rem'
  },
  typButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '20px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '2px solid transparent',
    borderRadius: '12px',
    color: '#888',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  typButtonActive: {
    borderColor: '#3b82f6',
    background: 'rgba(59, 130, 246, 0.15)',
    color: '#3b82f6'
  },
  typButtonActiveGreen: {
    borderColor: '#10b981',
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981'
  },
  typPrice: {
    fontSize: '0.85rem',
    opacity: 0.7
  },
  formGroup: {
    padding: '0 1.5rem',
    marginBottom: '1rem'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    padding: '0 1.5rem',
    marginBottom: '1rem'
  },
  label: {
    display: 'block',
    color: '#888',
    fontSize: '0.85rem',
    marginBottom: '6px'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.9rem',
    outline: 'none'
  },
  hint: {
    color: '#666',
    fontSize: '0.8rem',
    marginTop: '6px'
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '1.5rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
  },
  cancelButton: {
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: 'none',
    borderRadius: '8px',
    color: '#888',
    cursor: 'pointer'
  },
  submitButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
    border: 'none',
    borderRadius: '8px',
    color: '#000',
    fontWeight: '600',
    cursor: 'pointer'
  },
  dangerButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#ef4444',
    cursor: 'pointer'
  },

  // Detail Modal
  detailContent: {
    padding: '1.5rem'
  },
  detailRow: {
    display: 'flex',
    gap: '24px',
    marginBottom: '16px',
    flexWrap: 'wrap'
  },
  detailItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  detailLabel: {
    color: '#666',
    fontSize: '0.75rem',
    textTransform: 'uppercase'
  },
  detailValue: {
    color: '#fff',
    fontSize: '0.95rem'
  },
  detailSection: {
    marginTop: '20px',
    paddingTop: '16px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)'
  },
  detailSectionTitle: {
    color: '#ffd700',
    fontSize: '0.9rem',
    marginBottom: '12px'
  },
  zahlungenList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  zahlungItem: {
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px'
  },
  zahlungMain: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px'
  },
  zahlungNummer: {
    color: '#fff',
    fontWeight: '500'
  },
  zahlungBetrag: {
    color: '#ffd700',
    fontWeight: '600'
  },
  zahlungStatus: {
    fontWeight: '600',
    fontSize: '0.85rem'
  },
  zahlungMeta: {
    display: 'flex',
    gap: '16px',
    color: '#666',
    fontSize: '0.8rem'
  },
  smallButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '8px',
    padding: '6px 12px',
    background: 'rgba(16, 185, 129, 0.2)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '6px',
    color: '#10b981',
    fontSize: '0.8rem',
    cursor: 'pointer'
  },
  notizen: {
    color: '#aaa',
    fontSize: '0.9rem',
    whiteSpace: 'pre-wrap'
  },

  // Detail Tabs
  detailTabs: {
    display: 'flex',
    gap: '4px',
    padding: '0 1.5rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
  },
  detailTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: '#888',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  detailTabActive: {
    color: '#ffd700',
    borderBottomColor: '#ffd700'
  },

  // Vertrag Tab
  vertragActions: {
    display: 'flex',
    gap: '12px',
    marginBottom: '1.5rem',
    flexWrap: 'wrap'
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 20px',
    background: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '10px',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  actionButtonPrimary: {
    background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
    border: 'none',
    color: '#000',
    fontWeight: '600'
  },
  vertragInfo: {
    marginBottom: '1.5rem'
  },
  vertragStatusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '12px',
    marginTop: '12px'
  },
  vertragStatusItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.9rem'
  },
  dokumenteListe: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '12px'
  },
  dokumentButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    color: '#aaa',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },

  // SEPA Tab
  sepaListe: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  sepaItem: {
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px'
  },
  sepaHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  sepaMandatsref: {
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'monospace'
  },
  sepaStatus: {
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '0.8rem',
    fontWeight: '600'
  },
  sepaDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    color: '#aaa',
    fontSize: '0.9rem'
  },
  sepaSignedBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    marginTop: '12px',
    padding: '6px 12px',
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#10b981',
    borderRadius: '6px',
    fontSize: '0.85rem'
  },
  sepaHinweis: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    background: 'rgba(255, 215, 0, 0.1)',
    border: '1px solid rgba(255, 215, 0, 0.3)',
    borderRadius: '10px',
    marginTop: '1.5rem'
  },

  // Historie Tab
  historieListe: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginTop: '16px'
  },
  historieItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '12px',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '8px',
    borderLeft: '3px solid #ffd700'
  },
  historieDatum: {
    color: '#888',
    fontSize: '0.8rem',
    minWidth: '100px'
  },
  historieText: {
    color: '#fff',
    fontSize: '0.9rem'
  },

  // Signature
  signatureSection: {
    marginTop: '1.5rem'
  },
  signatureCanvas: {
    width: '100%',
    background: '#fff',
    borderRadius: '8px',
    cursor: 'crosshair',
    touchAction: 'none'
  },
  clearSignatureButton: {
    marginTop: '8px',
    padding: '8px 16px',
    background: 'transparent',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '6px',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.85rem'
  },
  signatureIntro: {
    color: '#aaa',
    fontSize: '0.95rem',
    lineHeight: 1.6,
    marginBottom: '1.5rem'
  },
  akzeptanzSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '1.5rem'
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: '#fff',
    cursor: 'pointer'
  },

  // Dokument Modal
  dokumentContent: {
    padding: '1.5rem',
    maxHeight: '60vh',
    overflow: 'auto'
  },
  dokumentMeta: {
    display: 'flex',
    gap: '20px',
    marginBottom: '1rem',
    color: '#888',
    fontSize: '0.85rem'
  },
  dokumentText: {
    color: '#ccc',
    fontSize: '0.9rem',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap'
  },

  // Einstellungen Tab
  einstellungenContainer: {
    marginTop: '1rem'
  },
  einstellungenTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '1.5rem',
    flexWrap: 'wrap'
  },
  einstellungenTab: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    color: '#888',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  einstellungenTabActive: {
    background: 'rgba(255, 215, 0, 0.15)',
    borderColor: 'rgba(255, 215, 0, 0.3)',
    color: '#ffd700'
  },
  einstellungenGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '1.5rem'
  },
  einstellungItem: {
    position: 'relative',
    padding: '1rem',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)'
  },
  einstellungLabel: {
    display: 'block',
    color: '#fff',
    fontWeight: '500',
    marginBottom: '8px',
    fontSize: '0.95rem'
  },
  einstellungHint: {
    display: 'block',
    color: '#666',
    fontSize: '0.8rem',
    fontWeight: '400',
    marginTop: '4px'
  },
  einstellungInput: {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '0.95rem',
    outline: 'none'
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer'
  },
  toggleInput: {
    display: 'none'
  },
  toggleSwitch: {
    position: 'relative',
    width: '48px',
    height: '24px',
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '12px',
    transition: 'background 0.2s'
  },
  toggleText: {
    color: '#888',
    fontSize: '0.9rem'
  },
  changedBadge: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '2px 8px',
    background: 'rgba(255, 215, 0, 0.2)',
    color: '#ffd700',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: '600'
  },
  einstellungenFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '2rem',
    padding: '1rem',
    background: 'rgba(255, 215, 0, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 215, 0, 0.2)'
  },
  changesCount: {
    flex: 1,
    color: '#ffd700',
    fontWeight: '500'
  }
};

export default VerbandsMitglieder;
