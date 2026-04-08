// ============================================================================
// PRÜFUNGSVERWALTUNG - VOLLSTÄNDIGE KOMPONENTE
// Frontend/src/components/PruefungsVerwaltung.jsx
// Route: /dashboard/termine
// ============================================================================

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useDojoContext } from '../context/DojoContext';
import { Check, X, Calendar, Award, Users, TrendingUp, ChevronUp, ChevronDown, Download, Edit, Trash2, Play, FileText, Scroll, Printer } from 'lucide-react';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/Buttons.css';
import '../styles/Dashboard.css';
import '../styles/PruefungsVerwaltung.css';

const PruefungsVerwaltung = () => {
  const { getDojoFilterParam, activeDojo, loading: dojosLoading, dojos } = useDojoContext();
  const navigate = useNavigate();
  const API_BASE_URL = '/api'; // Nutzt Vite-Proxy

  // State
  const [kandidaten, setKandidaten] = useState([]);
  const [stile, setStile] = useState([]);
  const [selectedStil, setSelectedStil] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('termine'); // termine, kandidaten, zugelassen, abgeschlossen, statistiken
  const [selectedKandidaten, setSelectedKandidaten] = useState([]);
  const [datumFilter, setDatumFilter] = useState('alle'); // alle, zukuenftig, vergangen

  // Graduierungen pro Stil (für manuelle Auswahl)
  const [graduierungenProStil, setGraduierungenProStil] = useState({}); // { stil_id: [graduierungen] }
  const [selectedGraduierungen, setSelectedGraduierungen] = useState({}); // { "mitglied_id-stil_id": graduierung_id }

  // Prüfungstermin Modal
  const [pruefungsDaten, setPruefungsDaten] = useState({
    pruefungsdatum: '',
    pruefungszeit: '10:00',
    pruefungsort: '',
    pruefungsgebuehr: '',
    anmeldefrist: '',
    gurtlaenge: '',
    bemerkungen: '',
    teilnahmebedingungen: '',
    ist_historisch: false,
    historisch_bemerkung: ''
  });

  // Prüfungsergebnis Modal
  const [showErgebnisModal, setShowErgebnisModal] = useState(false);
  const [selectedPruefung, setSelectedPruefung] = useState(null);
  const [pruefungsErgebnis, setPruefungsErgebnis] = useState({
    bestanden: false,
    punktzahl: '',
    max_punktzahl: '',
    prueferkommentar: '',
    graduierung_nachher_index: 0,
    graduierung_nachher_id: null,
    graduierung_nachher_name: '',
    graduierung_nachher_farbe: ''
  });
  const [graduierungenFuerModal, setGraduierungenFuerModal] = useState([]);

  // Daten für zugelassene und abgeschlossene Prüfungen
  const [zugelassenePruefungen, setZugelassenePruefungen] = useState([]);
  const [abgeschlossenePruefungen, setAbgeschlossenePruefungen] = useState([]);
  const [statistiken, setStatistiken] = useState(null);
  const [technikStats, setTechnikStats] = useState(null);
  const [erwStats, setErwStats] = useState(null);
  const [gurtView, setGurtView] = useState('stil');
  const [pruefungstermine, setPruefungstermine] = useState([]);

  // Neuer Termin Modal
  const [showNeuerTerminModal, setShowNeuerTerminModal] = useState(false);
  const [terminStep, setTerminStep] = useState(1);
  const [neuerTermin, setNeuerTermin] = useState({
    pruefungsdatum: '',
    pruefungszeit: '10:00',
    pruefungsort: '',
    pruefer_name: '',
    stil_id: '',
    pruefungsgebuehr: '',
    zahlungsart: '',
    anmeldefrist: '',
    gurtlaenge: '',
    bemerkungen: '',
    teilnahmebedingungen: '',
    oeffentlich: false,
    oeffentlich_vib: false,
    ist_historisch: false,
    historisch_bemerkung: ''
  });

  // Externe Anmeldungen pro Termin
  const [externeAnmeldungen, setExterneAnmeldungen] = useState({});

  // Externen Teilnehmer manuell hinzufügen
  const [showExternModal, setShowExternModal] = useState(false);
  const [externModalTermin, setExternModalTermin] = useState(null);
  const [externForm, setExternForm] = useState({ vorname: '', nachname: '', verein: '', graduierung_nachher_id: '' });

  // Termin bearbeiten Modal
  const [showEditTerminModal, setShowEditTerminModal] = useState(false);
  const [editTermin, setEditTermin] = useState(null);

  // Externe Anmeldung bearbeiten Modal
  const [showEditAnmeldungModal, setShowEditAnmeldungModal] = useState(false);
  const [editAnmeldung, setEditAnmeldung] = useState(null); // { ...anmeldung, termin_id }
  const [editAnmeldungForm, setEditAnmeldungForm] = useState({});
  const [editAnmeldungGrads, setEditAnmeldungGrads] = useState([]);

  // Drucken Vorschau-Modal
  const [showDruckPreview, setShowDruckPreview] = useState(false);
  const [druckPreviewData, setDruckPreviewData] = useState(null); // { pruefung, termin }
  const [protokollSendStatus, setProtokolSendStatus] = useState({}); // Key: pruefung_id → 'sending'|'sent'|'error'
  const [trainingsKonfliktDialog, setTrainingsKonfliktDialog] = useState(null); // { konflikte: [...], sendPush: true, terminData: {...} }

  const handleProtokolInsDashboard = async () => {
    if (!druckPreviewData) return;
    const { pruefung } = druckPreviewData;
    if (!pruefung.mitglied_id) { alert('Kein Mitglied zur Prüfung zugeordnet (externer Teilnehmer?)'); return; }

    const pid = pruefung.pruefung_id;
    setProtokolSendStatus(prev => ({ ...prev, [pid]: 'sending' }));
    try {
      const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
      const r = await fetch(`/api/pruefungen/${pid}/protokoll/ins-dashboard`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await r.json();
      if (d.success) {
        setProtokolSendStatus(prev => ({ ...prev, [pid]: 'sent' }));
        setSuccess(`Protokoll wurde ins Mitglieder-Dashboard gestellt`);
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setProtokolSendStatus(prev => ({ ...prev, [pid]: 'error' }));
        setError(d.error || 'Fehler beim Speichern');
        setTimeout(() => setError(''), 4000);
      }
    } catch (err) {
      setProtokolSendStatus(prev => ({ ...prev, [pid]: 'error' }));
      setError('Protokoll konnte nicht gespeichert werden');
      setTimeout(() => setError(''), 4000);
    }
  };

  // Teilnehmerliste Druck-Auswahl-Modal
  const [druckAuswahlModal, setDruckAuswahlModal] = useState({ open: false, termin: null, selected: [], vorlage: 'pruefungsurkunde' });

  // Expanded/Collapsed State für Prüfungstermine
  const [expandedTermine, setExpandedTermine] = useState({});
  const [vergangeneExpanded, setVergangeneExpanded] = useState(false);

  // Batch-Ergebnis Modal
  const [showBatchErgebnisModal, setShowBatchErgebnisModal] = useState(false);
  const [batchTermin, setBatchTermin] = useState(null);
  const [batchErgebnisse, setBatchErgebnisse] = useState({});
  const [batchPruefungsinhalte, setBatchPruefungsinhalte] = useState({}); // {grad_id: {kat: [...]}}
  const [batchInhaltBewertungen, setBatchInhaltBewertungen] = useState({}); // {pruefung_id: {inhalt_id: {bestanden, punktzahl, max_punktzahl}}}
  const [batchFreieTechniken, setBatchFreieTechniken] = useState({}); // {pruefung_id: {kat: [{id, titel}]}}
  const [batchFreiInputKey, setBatchFreiInputKey] = useState(null); // `${pruefung_id}_${kat}`
  const [batchFreiInputText, setBatchFreiInputText] = useState('');
  const [batchExpandedRows, setBatchExpandedRows] = useState({}); // {pruefung_id: bool}

  // Termin-Auswahl Modal (beim Zulassen)
  const [terminAuswahlModal, setTerminAuswahlModal] = useState({ open: false, kandidat: null, termine: [], isAusnahme: false });

  // Filter für Kandidaten
  const [berechtigungsFilter, setBerechtigungsFilter] = useState('all'); // 'all', 'berechtigt', 'nicht_berechtigt'
  const [kandidatenStilFilter, setKandidatenStilFilter] = useState('all');
  const [kandidatenSuchbegriff, setKandidatenSuchbegriff] = useState('');

  // Filter für Zugelassene und Abgeschlossene Prüfungen
  const [zugelasseneStilFilter, setZugelasseneStilFilter] = useState('all');
  const [abgeschlosseneStilFilter, setAbgeschlosseneStilFilter] = useState('all');

  // Sortierung
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' }); // key: Spaltenname, direction: 'asc' oder 'desc'

  // Doppelprüfung: Zwischengurt-Dropdown
  const [openZwischenPruefId, setOpenZwischenPruefId] = useState(null);

  // Prüfungs-Einstellungen (global, localStorage-backed)
  const PRUEF_SETTINGS_KEY = 'pruefungs_einstellungen';
  const DEFAULT_PRUEF_SETTINGS = {
    bestanden_item_punkte: 5,
    bestanden_gesamt_prozent: 50,
    max_punkte_item: 10,
    punkte_modus: 'halb', // 'ganz' | 'halb' | 'dezimal'
  };
  const [globalPruefSettings, setGlobalPruefSettings] = useState(() => {
    try { return { ...DEFAULT_PRUEF_SETTINGS, ...JSON.parse(localStorage.getItem(PRUEF_SETTINGS_KEY) || '{}') }; }
    catch { return { ...DEFAULT_PRUEF_SETTINGS }; }
  });
  const saveGlobalPruefSettings = (s) => {
    setGlobalPruefSettings(s);
    localStorage.setItem(PRUEF_SETTINGS_KEY, JSON.stringify(s));
  };
  // Per-Prüfung-Override (nur für aktuelle Batch-Session)
  const [batchSettings, setBatchSettings] = useState(null); // null = use global
  const [showBatchSettings, setShowBatchSettings] = useState(false);
  const [showGlobalSettings, setShowGlobalSettings] = useState(false);
  const activeSettings = batchSettings || globalPruefSettings;

  // Punkte-Optionen generieren
  const genPunkteOptions = (max, modus) => {
    const opts = [];
    if (modus === 'ganz') { for (let i = 0; i <= max; i++) opts.push(i); }
    else if (modus === 'halb') { for (let i = 0; i <= max * 2; i++) opts.push(Math.round(i * 5) / 10); }
    else { for (let i = 0; i <= max * 10; i++) opts.push(Math.round(i) / 10); }
    return opts;
  };

  // Stile laden
  useEffect(() => {
    fetchStile();
  }, []);

  // Daten laden basierend auf aktivem Tab
  useEffect(() => {
    // 🔒 WICHTIG: Nur laden wenn Dojos vollständig geladen sind
    if (dojosLoading || !dojos || dojos.length === 0) {
      console.log('⏳ Warte auf Dojos...', { dojosLoading, dojosCount: dojos?.length });
      return;
    }

    console.log('✅ Dojos geladen, lade Prüfungsdaten...', { activeTab, dojos: dojos.length });

    if (activeTab === 'termine') {
      fetchPruefungstermine();
    } else if (activeTab === 'kandidaten') {
      fetchKandidaten();
    } else if (activeTab === 'zugelassen') {
      fetchZugelassenePruefungen();
    } else if (activeTab === 'abgeschlossen') {
      fetchAbgeschlossenePruefungen();
    } else if (activeTab === 'statistiken') {
      fetchStatistiken();
      fetchTechnikStats();
      fetchErwStats();
      fetchKandidaten();
      fetchZugelassenePruefungen();
      fetchAbgeschlossenePruefungen();
    }
  }, [activeTab, selectedStil, dojosLoading, dojos, activeDojo]);

  const fetchStile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stile?aktiv=true`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
        }
      });
      const data = await response.json();
      setStile(data || []);

      // Lade Graduierungen für alle Stile
      if (data && data.length > 0) {
        fetchGraduierungenFuerStile(data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Stile:', error);
    }
  };

  const fetchGraduierungenFuerStile = async (stileArray) => {
    try {
      const graduierungen = {};

      // Lade Graduierungen für jeden Stil parallel
      await Promise.all(
        stileArray.map(async (stil) => {
          try {
            const response = await fetch(`${API_BASE_URL}/stile/${stil.stil_id}/graduierungen`, {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
              }
            });
            const data = await response.json();
            graduierungen[stil.stil_id] = data || [];
          } catch (error) {
            console.error(`Fehler beim Laden der Graduierungen für Stil ${stil.name}:`, error);
            graduierungen[stil.stil_id] = [];
          }
        })
      );

      setGraduierungenProStil(graduierungen);
    } catch (error) {
      console.error('Fehler beim Laden der Graduierungen:', error);
    }
  };

  const fetchKandidaten = async () => {
    setLoading(true);
    setError('');
    try {
      const dojoParam = getDojoFilterParam();

      // 🔒 WICHTIG: Nicht laden wenn dojoParam leer ist
      if (!dojoParam) {
        console.warn('⚠️ DojoParam ist leer - warte auf Dojo-Laden');
        setLoading(false);
        return;
      }

      const stilParam = selectedStil !== 'all' ? `&stil_id=${selectedStil}` : '';

      const response = await fetch(
        `${API_BASE_URL}/pruefungen/kandidaten?${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );

      if (!response.ok) throw new Error('Fehler beim Laden der Kandidaten');

      const data = await response.json();
      console.log('🎯 Kandidaten-Daten:', data.kandidaten);
      console.log('🔍 Beispiel-Kandidat:', data.kandidaten?.[0]);
      setKandidaten(data.kandidaten || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchZugelassenePruefungen = async () => {
    setLoading(true);
    try {
      const dojoParam = getDojoFilterParam();

      // 🔒 WICHTIG: Nicht laden wenn dojoParam leer UND Dojos noch nicht geladen
      // (Super-Admin darf ohne dojoParam laden — Backend filtert korrekt)
      if (!dojoParam && (dojosLoading || !dojos || dojos.length === 0)) {
        console.warn('⚠️ DojoParam ist leer - warte auf Dojo-Laden');
        setLoading(false);
        return;
      }

      const stilParam = selectedStil !== 'all' ? `&stil_id=${selectedStil}` : '';

      // Alle Statuse laden: geplant (zugelassen) + bestanden/nicht_bestanden (für Vergangen-Filter)
      const response = await fetch(
        `${API_BASE_URL}/pruefungen?status=geplant,bestanden,nicht_bestanden&${dojoParam}${stilParam}&limit=500`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );

      const data = await response.json();
      setZugelassenePruefungen(data.pruefungen || []);
    } catch (error) {
      console.error('❌ Fehler beim Laden zugelassener Prüfungen:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAbgeschlossenePruefungen = async () => {
    setLoading(true);
    try {
      const dojoParam = getDojoFilterParam();

      // 🔒 WICHTIG: Nicht laden wenn dojoParam leer UND Dojos noch nicht geladen
      if (!dojoParam && (dojosLoading || !dojos || dojos.length === 0)) {
        console.warn('⚠️ DojoParam ist leer - warte auf Dojo-Laden');
        setLoading(false);
        return;
      }

      const stilParam = selectedStil !== 'all' ? `&stil_id=${selectedStil}` : '';

      const response = await fetch(
        `${API_BASE_URL}/pruefungen?status=bestanden,nicht_bestanden&${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );

      const data = await response.json();
      setAbgeschlossenePruefungen(data.pruefungen || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistiken = async () => {
    setLoading(true);
    try {
      const dojoParam = getDojoFilterParam();

      // 🔒 WICHTIG: Nicht laden wenn dojoParam leer ist
      if (!dojoParam) {
        console.warn('⚠️ DojoParam ist leer - warte auf Dojo-Laden');
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/pruefungen/stats/statistiken?${dojoParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );

      const data = await response.json();
      setStatistiken(data.statistiken);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTechnikStats = async () => {
    try {
      const dojoParam = getDojoFilterParam();
      if (!dojoParam) return;
      const response = await fetch(
        `${API_BASE_URL}/pruefungen/stats/statistiken/techniken?${dojoParam}`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}` } }
      );
      const data = await response.json();
      if (data.success) setTechnikStats(data);
    } catch (error) {
      console.error('Technik-Stats Fehler:', error);
    }
  };

  const fetchErwStats = async () => {
    try {
      const dojoParam = getDojoFilterParam();
      if (!dojoParam) return;
      const response = await fetch(
        `${API_BASE_URL}/pruefungen/stats/statistiken/erweitert?${dojoParam}`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}` } }
      );
      const data = await response.json();
      if (data.success) setErwStats(data);
    } catch (error) {
      console.error('Erweiterte Stats Fehler:', error);
    }
  };

  const fetchPruefungstermine = async () => {
    setLoading(true);
    try {
      const dojoParam = getDojoFilterParam();

      // 🔒 WICHTIG: Nicht laden wenn dojoParam leer ist
      if (!dojoParam) {
        console.warn('⚠️ DojoParam ist leer - warte auf Dojo-Laden');
        setLoading(false);
        return;
      }

      const stilParam = selectedStil !== 'all' ? `&stil_id=${selectedStil}` : '';

      // Lade alle Prüfungen für den Termin (inkl. bereits bewertete)
      const pruefungenResponse = await fetch(
        `${API_BASE_URL}/pruefungen?status=geplant,bestanden,nicht_bestanden,durchgefuehrt&${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );
      const pruefungenData = await pruefungenResponse.json();

      // Lade Prüfungstermine (Vorlagen)
      const termineResponse = await fetch(
        `${API_BASE_URL}/pruefungen/termine?${dojoParam}${stilParam}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );
      const termineData = await termineResponse.json();

      // Gruppiere Prüfungen nach Datum UND Stil
      const grouped = {};
      (pruefungenData.pruefungen || []).forEach(pruefung => {
        const datum = pruefung.pruefungsdatum ? pruefung.pruefungsdatum.split('T')[0] : 'Kein Datum';
        const key = `${datum}_${pruefung.stil_id}`;
        if (!grouped[key]) {
          grouped[key] = {
            datum,
            stil_id: pruefung.stil_id,
            stil_name: pruefung.stil_name,
            pruefungen: []
          };
        }
        grouped[key].pruefungen.push(pruefung);
      });

      // Füge Termin-Vorlagen ohne Kandidaten hinzu
      (termineData.termine || []).forEach(termin => {
        const datum = termin.pruefungsdatum ? termin.pruefungsdatum.split('T')[0] : 'Kein Datum';
        const key = `${datum}_${termin.stil_id}`;
        if (!grouped[key]) {
          grouped[key] = {
            datum,
            stil_id: termin.stil_id,
            stil_name: termin.stil_name,
            pruefungen: [],
            isVorlage: true
          };
        }
        // Markiere als Termin-Vorlage
        grouped[key].isVorlage = true;
        grouped[key].vorlageData = {
          termin_id: termin.termin_id,
          ort: termin.pruefungsort,
          zeit: termin.pruefungszeit,
          pruefer_name: termin.pruefer_name,
          stil_id: termin.stil_id,
          stil_name: termin.stil_name,
          pruefungsgebuehr: termin.pruefungsgebuehr,
          anmeldefrist: termin.anmeldefrist ? termin.anmeldefrist.split('T')[0] : null,
          bemerkungen: termin.bemerkungen,
          teilnahmebedingungen: termin.teilnahmebedingungen,
          oeffentlich: termin.oeffentlich ? true : false
        };
      });

      // Konvertiere zu Array und sortiere nach Datum, dann nach Stil
      const termineArray = Object.keys(grouped).map(key => {
        const group = grouped[key];
        return {
          datum: group.datum,
          stil_id: group.stil_id,
          stil_name: group.stil_name,
          pruefungen: group.pruefungen,
          anzahl: group.pruefungen.length,
          ort: group.pruefungen[0]?.pruefungsort || group.vorlageData?.ort || 'Nicht festgelegt',
          zeit: group.pruefungen[0]?.pruefungszeit || group.vorlageData?.zeit || 'Nicht festgelegt',
          pruefer_name: group.pruefungen[0]?.pruefer_name || group.vorlageData?.pruefer_name || 'Nicht festgelegt',
          isVorlage: group.pruefungen.length === 0 && group.vorlageData,
          vorlageData: group.vorlageData,
          oeffentlich: group.vorlageData?.oeffentlich || false
        };
      }).sort((a, b) => {
        // Zukünftige Termine zuerst (aufsteigend), vergangene danach (absteigend)
        const today = new Date(); today.setHours(0,0,0,0);
        const da = new Date(a.datum); const db = new Date(b.datum);
        const aFuture = da >= today; const bFuture = db >= today;
        if (aFuture !== bFuture) return aFuture ? -1 : 1; // Zukunft zuerst
        const dateCompare = aFuture
          ? da - db   // Zukünftige: aufsteigend (nächster zuerst)
          : db - da;  // Vergangene: absteigend (neuester zuerst)
        if (dateCompare !== 0) return dateCompare;
        // Bei gleichem Datum: nach Uhrzeit sortieren
        const timeCompare = (a.zeit || '00:00').localeCompare(b.zeit || '00:00');
        if (timeCompare !== 0) return timeCompare;
        // Dann nach Stil-Name sortieren
        return (a.stil_name || '').localeCompare(b.stil_name || '');
      });

      setPruefungstermine(termineArray);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Prüfungsprotokoll-HTML generieren (für Druck + Vorschau)
  const buildErgebnisHtml = (pruefung, termin, bewertungen = {}, pruefungsinhalte = {}) => {
    const name = `${pruefung.vorname} ${pruefung.nachname}`;
    const geburt = pruefung.geburtsdatum
      ? new Date(pruefung.geburtsdatum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';
    const datumLang = termin.datum
      ? new Date(termin.datum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      : '—';
    const datumKurz = termin.datum
      ? new Date(termin.datum).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';

    const key = `${pruefung.mitglied_id}-${pruefung.stil_id}`;
    const gewaehlteGradId = selectedGraduierungen[key] || pruefung.graduierung_nachher_id;
    const gewaehlteGrad = (graduierungenProStil[pruefung.stil_id] || []).find(g => g.graduierung_id === gewaehlteGradId);
    const zielGurt = gewaehlteGrad?.name || pruefung.graduierung_nachher || '—';
    const zielFarbe = gewaehlteGrad?.farbe_hex || pruefung.farbe_nachher || '#EAB308';
    const aktGurt = pruefung.graduierung_vorher || 'Kein Gurt';
    const aktFarbe = pruefung.farbe_vorher || '#6b7280';

    const ergebnisText = pruefung.bestanden === true
      ? '<span style="color:#16a34a;font-weight:700;font-size:18pt;">✓ BESTANDEN</span>'
      : pruefung.bestanden === false
        ? '<span style="color:#dc2626;font-weight:700;font-size:18pt;">✗ NICHT BESTANDEN</span>'
        : '';

    const punkte = (pruefung.punktzahl != null && pruefung.max_punktzahl != null)
      ? `${pruefung.punktzahl} / ${pruefung.max_punktzahl} Punkte`
      : '';

    const kommentar = pruefung.prueferkommentar
      ? `<p style="margin:0;padding:10px;background:#f8f8f8;border-left:3px solid #d4af37;font-style:italic;color:#333;">${pruefung.prueferkommentar}</p>`
      : '<p style="margin:0;color:#999;font-style:italic;">Kein Kommentar</p>';

    const vereinText = pruefung.is_extern
      ? `<p style="margin:2px 0;font-size:10pt;color:#666;">${pruefung.extern_verein || 'Externer Teilnehmer'} <span style="background:#f59e0b;color:#fff;border-radius:3px;padding:1px 5px;font-size:8pt;margin-left:4px;">EXTERN</span></p>`
      : '';

    const pruefer = termin.pruefer_name && termin.pruefer_name !== 'Nicht festgelegt' ? termin.pruefer_name : '';

    return `
      <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:190mm;margin:0 auto;color:#1a1a1a;">

        <!-- Kopfzeile kompakt: Logo + Titel/Datum in einer Zeile -->
        <div class="pv-no-break" style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #c8a84b;padding-bottom:8px;margin-bottom:10px;">
          <div style="flex:0 0 auto;">
            <img src="/tda-systems-logo.png" alt="TDA Logo" style="height:40px;object-fit:contain;display:block;" />
            <div style="font-size:7pt;color:#aaa;margin-top:1px;">Tiger &amp; Dragon Association – International</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13pt;font-weight:800;color:#1a1a1a;line-height:1.2;">Prüfungsprotokoll — ${termin.stil_name || ''}</div>
            <div style="font-size:9.5pt;color:#555;margin-top:1px;">Kampfkunstschule Schreiner &nbsp;·&nbsp; ${datumLang}</div>
            ${(termin.ort || termin.zeit) ? `<div style="font-size:8.5pt;color:#888;">${[termin.ort, termin.zeit ? termin.zeit + ' Uhr' : ''].filter(Boolean).join(' · ')}</div>` : ''}
          </div>
        </div>

        <!-- Prüfling + Gurte + Ergebnis in einer Zeile -->
        <div class="pv-no-break" style="display:flex;gap:10px;margin-bottom:12px;align-items:stretch;">

          <!-- Prüfling -->
          <div style="flex:5;background:#f9f9f9;border-radius:6px;padding:10px 14px;">
            <div style="font-size:7pt;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;">Prüfling</div>
            <div style="font-size:17pt;font-weight:700;color:#1a1a1a;line-height:1.2;">${name}</div>
            ${vereinText}
            <div style="font-size:9pt;color:#666;margin-top:2px;">Geb.: ${geburt}</div>
          </div>

          <!-- Gurte übereinander -->
          <div style="flex:4;display:flex;flex-direction:column;gap:5px;">
            <div style="flex:1;border:1px solid #e0e0e0;border-radius:6px;padding:7px 11px;">
              <div style="font-size:7pt;color:#888;margin-bottom:3px;">Aktueller Gurt</div>
              <div style="display:flex;align-items:center;gap:6px;">
                <div style="width:13px;height:13px;border-radius:50%;background:${aktFarbe};border:2px solid rgba(0,0,0,0.15);flex-shrink:0;"></div>
                <span style="font-size:11pt;font-weight:600;">${aktGurt}</span>
              </div>
            </div>
            <div style="flex:1;border:2px solid ${zielFarbe};border-radius:6px;padding:7px 11px;">
              <div style="font-size:7pt;color:#888;margin-bottom:3px;">Angestrebter Gurt</div>
              <div style="display:flex;align-items:center;gap:6px;">
                <div style="width:13px;height:13px;border-radius:50%;background:${zielFarbe};border:2px solid rgba(0,0,0,0.15);flex-shrink:0;"></div>
                <span style="font-size:11pt;font-weight:700;color:${zielFarbe};">${zielGurt}</span>
              </div>
            </div>
          </div>

          <!-- Ergebnis -->
          <div style="flex:4;border:1px solid #e0e0e0;border-radius:6px;padding:10px 12px;text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;">
            <div style="font-size:7pt;color:#888;margin-bottom:5px;">Prüfungsergebnis</div>
            ${ergebnisText}
            ${punkte ? `<div style="margin-top:4px;font-size:10pt;color:#555;">${punkte}</div>` : ''}
          </div>

        </div>

        <!-- Kommentar -->
        <div class="pv-no-break" style="margin-bottom:16px;">
          <div style="font-size:8pt;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;">Prüferkommentar</div>
          ${kommentar}
        </div>

        ${(() => {
          const kategorieNamen = {
            kondition: 'Kondition / Warm Up',
            grundtechniken: 'Grundtechniken',
            fusstechniken: 'Fußtechniken',
            kata: 'Kata / Kombinationen',
            kumite: 'Kumite / Sparring',
            theorie: 'Theorie'
          };
          const kategorien = Object.keys(pruefungsinhalte);
          if (kategorien.length === 0 || Object.keys(bewertungen).length === 0) return '';

          const katBlöcke = [];
          kategorien.forEach(kat => {
            const inhalte = pruefungsinhalte[kat] || [];
            const bewKat = bewertungen[kat] || [];
            if (inhalte.length === 0) return;
            const bewMap = {};
            bewKat.forEach(b => { bewMap[b.inhalt_id] = b; });

            // Gesprungene Techniken nur anzeigen wenn sie auch gewertet wurden
            const inhalteGefiltert = pruefung.mit_gesprungenen
              ? inhalte
              : inhalte.filter(inhalt => !inhalt.ist_gesprungen);
            if (inhalteGefiltert.length === 0) return;
            const rows = inhalteGefiltert.map(inhalt => {
              const bew = bewMap[inhalt.id] || {};
              const bestandenHtml = bew.bestanden === true
                ? '<span style="color:#16a34a;font-weight:700;">✓</span>'
                : bew.bestanden === false
                  ? '<span style="color:#dc2626;">✗</span>'
                  : '<span style="color:#bbb;">—</span>';
              const pkt = !inhalt.ohne_punkte && bew.punktzahl !== undefined && bew.punktzahl !== null && bew.punktzahl !== ''
                ? `${bew.punktzahl}&thinsp;/&thinsp;${inhalt.max_punktzahl || 10}`
                : (inhalt.ohne_punkte ? '' : '<span style="color:#bbb;">—</span>');
              const gesprTag = inhalt.ist_gesprungen ? ' <span style="font-size:7pt;color:#6366f1;vertical-align:middle;">(↑)</span>' : '';
              return `<tr style="border-bottom:1px solid #f0f0f0;"><td style="padding:3px 6px;font-size:8pt;color:#333;">${inhalt.titel || ''}${gesprTag}</td><td style="padding:3px 6px;text-align:center;font-size:9pt;width:40px;">${bestandenHtml}</td><td style="padding:3px 6px;text-align:center;font-size:8pt;color:#555;width:60px;">${pkt}</td></tr>`;
            }).join('');

            katBlöcke.push(`<div class="pv-no-break" style="margin-bottom:8px;"><div style="font-size:7.5pt;font-weight:700;color:#777;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e0e0e0;padding-bottom:2px;margin-bottom:3px;">${kategorieNamen[kat] || kat}</div><table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f8f8f8;"><th style="padding:2px 5px;text-align:left;font-size:7pt;color:#999;font-weight:600;">Technik / Inhalt</th><th style="padding:2px 5px;text-align:center;font-size:7pt;color:#999;font-weight:600;width:40px;">OK</th><th style="padding:2px 5px;text-align:center;font-size:7pt;color:#999;font-weight:600;width:60px;">Punkte</th></tr></thead><tbody>${rows}</tbody></table></div>`);
          });

          if (katBlöcke.length === 0) return '';
          const mitte = Math.ceil(katBlöcke.length / 2);
          const linkeSpalte = katBlöcke.slice(0, mitte).join('');
          const rechteSpalte = katBlöcke.slice(mitte).join('');
          return `<div style="margin-bottom:16px;"><div style="font-size:7.5pt;color:#888;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px;border-top:1px solid #e0e0e0;padding-top:10px;">Prüfungsinhalte</div><div class="pv-no-break" style="display:flex;gap:14px;align-items:flex-start;"><div style="flex:1;">${linkeSpalte}</div><div style="flex:1;">${rechteSpalte}</div></div></div>`;
        })()}

        <!-- Unterschriften -->
        <div style="display:flex;gap:32px;margin-top:24px;">
          <div style="flex:1;border-top:1px solid #555;padding-top:8px;">
            <div style="font-size:9pt;color:#888;">Prüfer</div>
            ${pruefer ? `<div style="font-size:10pt;font-weight:600;color:#333;margin-top:3px;">${pruefer}</div>` : ''}
            <div style="margin-top:30px;border-top:1px solid #ccc;padding-top:4px;font-size:8pt;color:#aaa;">Unterschrift / Datum</div>
          </div>
          <div style="flex:1;border-top:1px solid #555;padding-top:8px;">
            <div style="font-size:9pt;color:#888;">Prüfling</div>
            <div style="font-size:10pt;font-weight:600;color:#333;margin-top:3px;">${name}</div>
            <div style="margin-top:30px;border-top:1px solid #ccc;padding-top:4px;font-size:8pt;color:#aaa;">Unterschrift / Datum</div>
          </div>
        </div>

        <!-- Fußzeile -->
        <div style="margin-top:20px;padding-top:10px;border-top:1px solid #e0e0e0;text-align:center;font-size:7pt;color:#bbb;">
          Kampfkunstschule Schreiner · Mitglied der Tiger &amp; Dragon Association – International · Ausgestellt am ${datumKurz}
        </div>
      </div>
    `;
  };

  // Vorschau öffnen — lädt Bewertungen + Inhalte async
  const druckeErgebnis = async (pruefung, termin) => {
    let bewertungen = {};
    let pruefungsinhalte = {};

    try {
      const bewRes = await fetch(
        `${API_BASE_URL}/pruefungen/${pruefung.pruefung_id}/bewertungen`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );
      if (bewRes.ok) {
        const bewData = await bewRes.json();
        bewertungen = bewData.bewertungen || {};
      }
    } catch (e) { /* ignorieren */ }

    if (pruefung.graduierung_nachher_id && pruefung.stil_id) {
      try {
        const inhRes = await fetch(
          `${API_BASE_URL}/stile/${pruefung.stil_id}/graduierungen/${pruefung.graduierung_nachher_id}/pruefungsinhalte`,
          { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
        );
        if (inhRes.ok) {
          const inhData = await inhRes.json();
          pruefungsinhalte = inhData.pruefungsinhalte || {};
        }
      } catch (e) { /* ignorieren */ }
    }

    const html = buildErgebnisHtml(pruefung, termin, bewertungen, pruefungsinhalte);
    setDruckPreviewData({ pruefung, termin, bewertungen, pruefungsinhalte, html });
    setShowDruckPreview(true);
  };

  // Tatsächlich drucken (aus Vorschau-Modal heraus)
  const triggerDruck = () => {
    if (!druckPreviewData) return;
    const { pruefung, termin, bewertungen = {}, pruefungsinhalte = {} } = druckPreviewData;
    const html = buildErgebnisHtml(pruefung, termin, bewertungen, pruefungsinhalte);

    const printStyle = document.createElement('style');
    printStyle.id = 'pv-ergebnis-print-style';
    printStyle.textContent = `
      @media print {
        @page { size: A4 portrait; margin: 12mm; }
        #root { display: none !important; }
        #pv-ergebnis-overlay { display: block !important; }
        #pv-ergebnis-overlay table { break-inside: avoid; page-break-inside: avoid; }
        #pv-ergebnis-overlay tr { break-inside: avoid; page-break-inside: avoid; }
        #pv-ergebnis-overlay .pv-no-break { break-inside: avoid; page-break-inside: avoid; }
      }
      #pv-ergebnis-overlay { display: none; }
    `;
    document.head.appendChild(printStyle);

    const overlay = document.createElement('div');
    overlay.id = 'pv-ergebnis-overlay';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    document.fonts.ready.then(() => {
      window.print();
      document.body.removeChild(overlay);
      document.head.removeChild(printStyle);
    });
  };

  // Externen Teilnehmer manuell zur Prüfung hinzufügen
  const handleExternHinzufuegen = async () => {
    if (!externForm.vorname.trim() || !externForm.nachname.trim()) {
      setError('Vorname und Nachname sind Pflichtfelder');
      return;
    }
    if (!externForm.graduierung_nachher_id) {
      setError('Bitte Ziel-Graduierung auswählen');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/pruefungen/kandidaten/extern`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          extern_vorname: externForm.vorname.trim(),
          extern_nachname: externForm.nachname.trim(),
          extern_verein: externForm.verein.trim() || null,
          stil_id: externModalTermin.stil_id,
          graduierung_nachher_id: parseInt(externForm.graduierung_nachher_id),
          pruefungsdatum: externModalTermin.datum,
          pruefungsort: externModalTermin.ort || null,
          pruefungszeit: externModalTermin.zeit || '10:00',
          dojo_id: activeDojo?.id
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler beim Hinzufügen');
      setSuccess(`${externForm.vorname} ${externForm.nachname} wurde zur Prüfung hinzugefügt!`);
      setTimeout(() => setSuccess(''), 3000);
      setShowExternModal(false);
      setExternForm({ vorname: '', nachname: '', verein: '', graduierung_nachher_id: '' });
      fetchPruefungstermine();
    } catch (error) {
      setError(error.message);
      setTimeout(() => setError(''), 4000);
    }
  };

  // Kandidat zur Prüfung zulassen
  const handleKandidatZulassen = async (kandidat, customPruefungsDaten = null) => {
    try {
      if (!activeDojo || !activeDojo.id) {
        setError('Kein Dojo ausgewählt. Bitte wählen Sie ein Dojo aus.');
        return;
      }

      const dojoId = activeDojo.id;
      let datenZuVerwenden = customPruefungsDaten || pruefungsDaten;

      // Wenn kein Prüfungsdatum angegeben wurde, suche automatisch den nächsten Termin für den Stil
      if (!datenZuVerwenden.pruefungsdatum && kandidat.stil_id) {
        try {
          // Lade die nächsten Prüfungstermine für diesen Stil
          const termineResponse = await fetch(
            `${API_BASE_URL}/pruefungen/termine?stil_id=${kandidat.stil_id}&dojo_id=${dojoId}`,
            {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
              }
            }
          );

          if (termineResponse.ok) {
            const termineResult = await termineResponse.json();
            const termineData = termineResult.termine || [];

            console.log('📅 Prüfungstermine geladen:', termineData);

            // Finde den nächsten zukünftigen Termin
            const heute = new Date();
            heute.setHours(0, 0, 0, 0);

            const naechsterTermin = termineData
              .filter(termin => {
                const terminDatum = new Date(termin.pruefungsdatum);
                terminDatum.setHours(0, 0, 0, 0);
                return terminDatum >= heute;
              })
              .sort((a, b) => new Date(a.pruefungsdatum) - new Date(b.pruefungsdatum))[0];

            if (naechsterTermin) {
              datenZuVerwenden = {
                pruefungsdatum: naechsterTermin.pruefungsdatum,
                pruefungszeit: naechsterTermin.pruefungszeit || '10:00',
                pruefungsort: naechsterTermin.pruefungsort,
                pruefungsgebuehr: naechsterTermin.pruefungsgebuehr,
                anmeldefrist: naechsterTermin.anmeldefrist,
                gurtlaenge: naechsterTermin.gurtlaenge,
                bemerkungen: naechsterTermin.bemerkungen,
                teilnahmebedingungen: naechsterTermin.teilnahmebedingungen
              };
              console.log('✅ Nächster Prüfungstermin gefunden:', naechsterTermin);
            } else {
              setError(`Kein zukünftiger Prüfungstermin für ${kandidat.stil_name} gefunden. Bitte legen Sie zuerst einen Termin an.`);
              return;
            }
          }
        } catch (termineError) {
          console.error('Fehler beim Laden der Termine:', termineError);
          setError('Fehler beim Laden der Prüfungstermine.');
          return;
        }
      }

      // Prüfe erneut ob ein Datum vorhanden ist
      if (!datenZuVerwenden.pruefungsdatum) {
        setError('Kein Prüfungsdatum verfügbar. Bitte legen Sie zuerst einen Prüfungstermin an.');
        return;
      }

      // Kombiniere Datum und Uhrzeit
      let pruefungsdatumZeit = null;
      if (datenZuVerwenden.pruefungsdatum && datenZuVerwenden.pruefungszeit) {
        const datumStr = datenZuVerwenden.pruefungsdatum.split('T')[0];
        const zeitStr = datenZuVerwenden.pruefungszeit.includes(':')
          ? (datenZuVerwenden.pruefungszeit.split(':').length === 2
              ? `${datenZuVerwenden.pruefungszeit}:00`
              : datenZuVerwenden.pruefungszeit)
          : `${datenZuVerwenden.pruefungszeit}:00:00`;
        pruefungsdatumZeit = `${datumStr} ${zeitStr}`;
      } else if (datenZuVerwenden.pruefungsdatum) {
        const datumStr = datenZuVerwenden.pruefungsdatum.split('T')[0];
        pruefungsdatumZeit = datumStr;
      }

      // Ermittle die ausgewählte Graduierung (falls manuell gewählt, sonst die empfohlene)
      const key = `${kandidat.mitglied_id}-${kandidat.stil_id}`;
      const graduierung_nachher_id = selectedGraduierungen[key] || kandidat.naechste_graduierung_id;

      const response = await fetch(
        `${API_BASE_URL}/pruefungen/kandidaten/${kandidat.mitglied_id}/zulassen`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            stil_id: kandidat.stil_id,
            graduierung_nachher_id: graduierung_nachher_id,
            pruefungsdatum: pruefungsdatumZeit,
            pruefungsort: datenZuVerwenden.pruefungsort || null,
            pruefungsgebuehr: datenZuVerwenden.pruefungsgebuehr ? parseFloat(datenZuVerwenden.pruefungsgebuehr) : null,
            anmeldefrist: datenZuVerwenden.anmeldefrist || null,
            gurtlaenge: datenZuVerwenden.gurtlaenge || null,
            bemerkungen: datenZuVerwenden.bemerkungen || null,
            teilnahmebedingungen: datenZuVerwenden.teilnahmebedingungen || null,
            dojo_id: parseInt(dojoId),
            pruefungszeit: datenZuVerwenden.pruefungszeit || '10:00',
            zahlungsart: datenZuVerwenden.zahlungsart || null
          })
        }
      );

      if (!response.ok) throw new Error('Fehler beim Zulassen');

      const formattedDate = new Date(datenZuVerwenden.pruefungsdatum).toLocaleDateString('de-DE');
      setSuccess(`${kandidat.vorname} ${kandidat.nachname} wurde zur Prüfung am ${formattedDate} zugelassen!`);
      fetchKandidaten();
      fetchZugelassenePruefungen();
      fetchPruefungstermine(); // Aktualisiere auch die Prüfungstermine-Liste

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
    }
  };

  // Ausnahme-Zulassung (für Kandidaten ohne Voraussetzungen)
  const handleAusnahmeZulassen = async (kandidat) => {
    if (!window.confirm(
      `${kandidat.vorname} ${kandidat.nachname} erfüllt die zeitlichen Voraussetzungen noch nicht.\n\n` +
      `Möchten Sie eine Ausnahme-Zulassung erteilen?`
    )) {
      return;
    }

    await handleKandidatZulassen(kandidat, null);
  };

  // Termin-Auswahl Modal öffnen (beim Zulassen)
  const openTerminAuswahl = (kandidat, isAusnahme = false) => {
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const verfuegbareTermine = pruefungstermine.filter(t => {
      if (t.stil_id !== kandidat.stil_id) return false;
      const terminDatum = new Date(t.datum);
      terminDatum.setHours(0, 0, 0, 0);
      return terminDatum >= heute;
    });

    if (verfuegbareTermine.length === 0) {
      setError(`Kein zukünftiger Prüfungstermin für ${kandidat.stil_name} gefunden. Bitte legen Sie zuerst einen Termin an.`);
      return;
    }

    setTerminAuswahlModal({ open: true, kandidat, termine: verfuegbareTermine, isAusnahme });
  };

  // Termin im Modal ausgewählt
  const handleTerminAuswahlSelected = async (termin) => {
    const { kandidat, isAusnahme } = terminAuswahlModal;
    setTerminAuswahlModal({ open: false, kandidat: null, termine: [], isAusnahme: false });

    const customDaten = {
      pruefungsdatum: termin.datum,
      pruefungszeit: termin.zeit !== 'Nicht festgelegt' ? termin.zeit : '10:00',
      pruefungsort: termin.ort,
      pruefungsgebuehr: termin.vorlageData?.pruefungsgebuehr,
      anmeldefrist: termin.vorlageData?.anmeldefrist,
      bemerkungen: termin.vorlageData?.bemerkungen,
      teilnahmebedingungen: termin.vorlageData?.teilnahmebedingungen
    };

    if (isAusnahme) {
      if (!window.confirm(
        `${kandidat.vorname} ${kandidat.nachname} erfüllt die zeitlichen Voraussetzungen noch nicht.\n\n` +
        `Möchten Sie eine Ausnahme-Zulassung erteilen?`
      )) {
        return;
      }
    }

    await handleKandidatZulassen(kandidat, customDaten);
  };

  // Funktion zum Entfernen der Zulassung
  const handleZulassungEntfernen = async (pruefung) => {
    if (!window.confirm(`Möchten Sie die Zulassung von ${pruefung.vorname} ${pruefung.nachname} wirklich entfernen?`)) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/pruefungen/kandidaten/${pruefung.mitglied_id}/zulassung/${pruefung.pruefung_id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );

      if (!response.ok) throw new Error('Fehler beim Entfernen der Zulassung');

      setSuccess(`Zulassung von ${pruefung.vorname} ${pruefung.nachname} wurde entfernt.`);
      fetchZugelassenePruefungen(); // Liste aktualisieren
      fetchKandidaten(); // Kandidaten auch aktualisieren
      fetchPruefungstermine(); // Prüfungstermine auch aktualisieren

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
    }
  };

  // Funktion zum Ändern des Status (bestanden/nicht bestanden)
  const handleStatusAendern = async (pruefung) => {
    const neuerStatus = !pruefung.bestanden;
    const statusText = neuerStatus ? 'bestanden' : 'nicht bestanden';

    let confirmText = `Möchten Sie den Status von ${pruefung.vorname} ${pruefung.nachname} wirklich auf "${statusText}" ändern?`;

    if (!neuerStatus) {
      // Von bestanden auf nicht bestanden ändern
      confirmText += '\n\nHinweis: Die Graduierung des Mitglieds wird auf den Stand vor der Prüfung zurückgesetzt.';
    }

    if (!window.confirm(confirmText)) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/pruefungen/${pruefung.pruefung_id}/status-aendern`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            bestanden: neuerStatus,
            mitglied_id: pruefung.mitglied_id,
            stil_id: pruefung.stil_id,
            graduierung_vorher_id: pruefung.graduierung_vorher_id,
            graduierung_nachher_id: pruefung.graduierung_nachher_id
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Fehler beim Ändern des Status');
      }

      setSuccess(`Status von ${pruefung.vorname} ${pruefung.nachname} wurde auf "${statusText}" geändert.`);
      fetchAbgeschlossenePruefungen(); // Liste aktualisieren
      fetchKandidaten(); // Kandidaten auch aktualisieren

      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleErgebnisEintragen = async () => {
    if (!selectedPruefung) return;

    try {
      const updateData = {
        bestanden: pruefungsErgebnis.bestanden,
        punktzahl: pruefungsErgebnis.punktzahl ? parseFloat(pruefungsErgebnis.punktzahl) : null,
        max_punktzahl: pruefungsErgebnis.max_punktzahl ? parseFloat(pruefungsErgebnis.max_punktzahl) : null,
        prueferkommentar: pruefungsErgebnis.prueferkommentar,
        status: pruefungsErgebnis.bestanden ? 'bestanden' : 'nicht_bestanden',
        graduierung_nachher_id: pruefungsErgebnis.graduierung_nachher_id
      };

      const response = await fetch(
        `${API_BASE_URL}/pruefungen/${selectedPruefung.pruefung_id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) throw new Error('Fehler beim Speichern des Ergebnisses');

      // Bei bestandener Prüfung: Graduierung aktualisieren
      if (pruefungsErgebnis.bestanden && pruefungsErgebnis.graduierung_nachher_id) {
        await updateMemberGraduierung(
          selectedPruefung.mitglied_id,
          selectedPruefung.stil_id,
          pruefungsErgebnis.graduierung_nachher_id
        );

        // Automatisch Urkunde generieren (TODO: Backend-Endpunkt implementieren)
        await generateUrkunde(selectedPruefung.pruefung_id);
      }

      setShowErgebnisModal(false);
      setSelectedPruefung(null);
      setPruefungsErgebnis({
        bestanden: false,
        punktzahl: '',
        max_punktzahl: '',
        prueferkommentar: '',
        graduierung_nachher_index: 0,
        graduierung_nachher_id: null,
        graduierung_nachher_name: '',
        graduierung_nachher_farbe: ''
      });
      setGraduierungenFuerModal([]);

      setSuccess('Prüfungsergebnis erfolgreich gespeichert!');
      setTimeout(() => setSuccess(''), 3000);
      fetchZugelassenePruefungen();
    } catch (error) {
      setError(error.message);
    }
  };

  // Batch-Ergebnis Modal oeffnen
  const openBatchErgebnisModal = async (termin) => {
    setBatchTermin(termin);
    setBatchSettings(null); // reset per-exam override
    setShowBatchSettings(false);
    const initialErgebnisse = {};
    const initialBewertungen = {};
    termin.pruefungen.forEach(pruefung => {
      initialErgebnisse[pruefung.pruefung_id] = { bestanden: null, punktzahl: '', prueferkommentar: '' };
      // null = offen (noch nicht bewertet)
      initialBewertungen[pruefung.pruefung_id] = {};
    });
    setBatchErgebnisse(initialErgebnisse);
    setBatchInhaltBewertungen(initialBewertungen);
    setBatchExpandedRows({});
    setShowBatchErgebnisModal(true);

    // Prüfungsinhalte für jede einzigartige Graduierung laden
    const loadedInhalte = {};
    const uniqueGrads = [...new Set(termin.pruefungen.map(p => p.graduierung_nachher_id).filter(Boolean))];
    for (const gradId of uniqueGrads) {
      const stilId = termin.pruefungen.find(p => p.graduierung_nachher_id === gradId)?.stil_id;
      if (!stilId) continue;
      try {
        const res = await fetch(
          `${API_BASE_URL}/stile/${stilId}/graduierungen/${gradId}/pruefungsinhalte`,
          { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
        );
        if (res.ok) {
          const data = await res.json();
          loadedInhalte[gradId] = data.pruefungsinhalte || {};
        }
      } catch (e) { /* ignore */ }
    }
    setBatchPruefungsinhalte(loadedInhalte);
  };

  // Batch-Ergebnis speichern
  const handleBatchErgebnisSpeichern = async () => {
    if (!batchTermin) return;

    setLoading(true);
    try {
      let erfolgreiche = 0;
      let fehler = 0;

      for (const pruefung of batchTermin.pruefungen) {
        const ergebnis = batchErgebnisse[pruefung.pruefung_id];
        if (!ergebnis || ergebnis.bestanden === null) continue; // offen = noch nicht bewertet

        const updateData = {
          bestanden: ergebnis.bestanden,
          punktzahl: ergebnis.punktzahl ? parseFloat(ergebnis.punktzahl) : null,
          prueferkommentar: ergebnis.prueferkommentar || null,
          status: ergebnis.bestanden ? 'bestanden' : 'nicht_bestanden',
          graduierung_nachher_id: ergebnis.bestanden ? pruefung.graduierung_nachher_id : null
        };

        try {
          const response = await fetch(
            `${API_BASE_URL}/pruefungen/${pruefung.pruefung_id}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
              },
              body: JSON.stringify(updateData)
            }
          );

          if (response.ok) {
            // Inhalt-Bewertungen speichern falls vorhanden
            const inhaltBew = batchInhaltBewertungen[pruefung.pruefung_id] || {};
            const bewertungsArray = Object.entries(inhaltBew).map(([inhaltId, bew]) => ({
              inhalt_id: parseInt(inhaltId),
              bestanden: typeof bew === 'object' ? bew.bestanden : bew,
              punktzahl: (typeof bew === 'object' && bew.punktzahl !== '' && bew.punktzahl != null)
                ? parseFloat(bew.punktzahl) : null,
              max_punktzahl: (typeof bew === 'object' && bew.max_punktzahl != null)
                ? parseFloat(bew.max_punktzahl) : 10,
              kommentar: null
            }));
            // Freie Techniken hinzufügen
            const freiKats = batchFreieTechniken[pruefung.pruefung_id] || {};
            Object.entries(freiKats).forEach(([kat, items]) => {
              items.forEach(item => {
                const bew = inhaltBew[item.id] || {};
                bewertungsArray.push({
                  inhalt_id: null,
                  kat,
                  titel: item.titel,
                  bestanden: bew.bestanden !== undefined ? bew.bestanden : (ergebnis.bestanden ?? true),
                  punktzahl: (bew.punktzahl !== '' && bew.punktzahl != null) ? parseFloat(bew.punktzahl) : null,
                  max_punktzahl: bew.max_punktzahl != null ? parseFloat(bew.max_punktzahl) : 10,
                  kommentar: null
                });
              });
            });
            if (bewertungsArray.length > 0) {
              await fetch(`${API_BASE_URL}/pruefungen/${pruefung.pruefung_id}/bewertungen`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ bewertungen: bewertungsArray })
              });
            }

            // Bei bestandener Pruefung: Graduierung aktualisieren
            if (ergebnis.bestanden && pruefung.graduierung_nachher_id) {
              await updateMemberGraduierung(
                pruefung.mitglied_id,
                pruefung.stil_id,
                pruefung.graduierung_nachher_id
              );
            }
            erfolgreiche++;
          } else {
            fehler++;
          }
        } catch (err) {
          fehler++;
          console.error('Fehler bei Pruefung', pruefung.pruefung_id, err);
        }
      }

      setShowBatchErgebnisModal(false);
      setBatchTermin(null);
      setBatchErgebnisse({});

      if (fehler === 0) {
        setSuccess(`Alle ${erfolgreiche} Pruefungsergebnisse erfolgreich gespeichert!`);
      } else {
        setSuccess(`${erfolgreiche} Ergebnisse gespeichert, ${fehler} Fehler aufgetreten.`);
      }
      setTimeout(() => setSuccess(''), 5000);

      fetchPruefungstermine();
      fetchZugelassenePruefungen();
      fetchAbgeschlossenePruefungen();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Alle als bestanden/nicht bestanden markieren
  const addFreieTechnik = (pruefungId, kat, titel) => {
    if (!titel.trim()) return;
    const id = `free_${Date.now()}`;
    setBatchFreieTechniken(prev => ({
      ...prev,
      [pruefungId]: {
        ...(prev[pruefungId] || {}),
        [kat]: [...((prev[pruefungId]?.[kat]) || []), { id, titel: titel.trim() }]
      }
    }));
    setBatchFreiInputKey(null);
    setBatchFreiInputText('');
  };

  const removeFreieTechnik = (pruefungId, kat, id) => {
    setBatchFreieTechniken(prev => ({
      ...prev,
      [pruefungId]: {
        ...(prev[pruefungId] || {}),
        [kat]: (prev[pruefungId]?.[kat] || []).filter(t => t.id !== id)
      }
    }));
  };

  const setBatchAlleBestanden = (bestanden) => {
    const updated = { ...batchErgebnisse };
    Object.keys(updated).forEach(key => {
      updated[key].bestanden = bestanden;
    });
    setBatchErgebnisse(updated);
  };

  // Auto-check ob Gesamtpunktzahl Schwelle erreicht (50% default)
  const checkGesamtSchwelle = (pruefung_id, newErgebnisse, newBewertungen) => {
    const settings = batchSettings || globalPruefSettings;
    const bewertungen = newBewertungen[pruefung_id] || {};
    const values = Object.values(bewertungen).filter(b => b.punktzahl !== '' && b.punktzahl !== undefined && b.punktzahl !== null);
    if (values.length === 0) return newErgebnisse;
    const totalPunkte = values.reduce((s, b) => s + parseFloat(b.punktzahl || 0), 0);
    const totalMax = values.reduce((s, b) => s + parseFloat(b.max_punktzahl || settings.max_punkte_item || 10), 0);
    if (totalMax > 0) {
      const prozent = (totalPunkte / totalMax) * 100;
      const schwelle = settings.bestanden_gesamt_prozent ?? 50;
      if (newErgebnisse[pruefung_id]?.bestanden === null || newErgebnisse[pruefung_id]?.bestanden === true) {
        // Nur auto-setzen wenn noch auf null (offen) oder bereits bestanden
        return {
          ...newErgebnisse,
          [pruefung_id]: { ...newErgebnisse[pruefung_id], bestanden: prozent >= schwelle }
        };
      }
    }
    return newErgebnisse;
  };

  // Alle Items einer Kategorie auf bestanden setzen
  const markKatBestanden = (pruefung_id, kat, items) => {
    setBatchInhaltBewertungen(prev => {
      const updated = { ...prev, [pruefung_id]: { ...(prev[pruefung_id] || {}) } };
      items.forEach(item => {
        const inhaltId = item.inhalt_id || item.id;
        updated[pruefung_id][inhaltId] = {
          ...(updated[pruefung_id][inhaltId] || {}),
          bestanden: true,
          max_punktzahl: updated[pruefung_id][inhaltId]?.max_punktzahl ?? (batchSettings || globalPruefSettings).max_punkte_item ?? 10
        };
      });
      return updated;
    });
  };

  const updateMemberGraduierung = async (mitglied_id, stil_id, graduierung_id) => {
    try {
      await fetch(
        `${API_BASE_URL}/mitglieder/${mitglied_id}/stil/${stil_id}/data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          },
          body: JSON.stringify({
            current_graduierung_id: graduierung_id,
            letzte_pruefung: new Date().toISOString().split('T')[0]
          })
        }
      );
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Graduierung:', error);
    }
  };

  const generateUrkunde = async (pruefung_id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/pruefungen/${pruefung_id}/urkunde/download`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Fehler beim Generieren der Urkunde');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('Content-Disposition') || '';
      const fileMatch = disposition.match(/filename="?([^"]+)"?/);
      a.download = fileMatch ? fileMatch[1] : `Urkunde_${pruefung_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSuccess('Urkunde erfolgreich generiert!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.message);
      setTimeout(() => setError(''), 4000);
    }
  };

  // Speichert den Termin (nach optionaler Konflikt-Bestätigung)
  const doSaveTermin = async (terminData) => {
    const response = await fetch(`${API_BASE_URL}/pruefungen/termine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
      },
      body: JSON.stringify(terminData)
    });

    if (!response.ok) {
      const data = await response.json();
      if (response.status === 409) throw new Error(data.message || data.error || 'Zeitüberschneidung');
      throw new Error(data.error || 'Fehler beim Erstellen des Termins');
    }

    setSuccess(`Prüfungstermin für ${new Date(terminData.datum).toLocaleDateString('de-DE')} wurde erstellt!`);
    setTimeout(() => setSuccess(''), 3000);
    setShowNeuerTerminModal(false);
    setTrainingsKonfliktDialog(null);
    setNeuerTermin({
      pruefungsdatum: '', pruefungszeit: '10:00', pruefungsort: '', pruefer_name: '',
      stil_id: '', pruefungsgebuehr: '', anmeldefrist: '', gurtlaenge: '',
      bemerkungen: '', teilnahmebedingungen: '', oeffentlich: false,
      oeffentlich_vib: false, ist_historisch: false, historisch_bemerkung: ''
    });
    fetchPruefungstermine();
  };

  const handleNeuerTerminErstellen = async () => {
    if (!neuerTermin.pruefungsdatum) { setError('Bitte geben Sie ein Prüfungsdatum an'); return; }
    if (!neuerTermin.stil_id) { setError('Bitte wählen Sie einen Stil aus'); return; }
    if (!activeDojo || !activeDojo.id) { setError('Kein Dojo ausgewählt'); return; }

    const terminData = {
      datum: neuerTermin.pruefungsdatum,
      zeit: neuerTermin.pruefungszeit,
      ort: neuerTermin.pruefungsort,
      pruefer_name: neuerTermin.pruefer_name || null,
      stil_id: neuerTermin.stil_id,
      pruefungsgebuehr: neuerTermin.pruefungsgebuehr ? parseFloat(neuerTermin.pruefungsgebuehr) : null,
      anmeldefrist: neuerTermin.anmeldefrist || null,
      bemerkungen: neuerTermin.bemerkungen || null,
      teilnahmebedingungen: neuerTermin.teilnahmebedingungen || null,
      oeffentlich: neuerTermin.oeffentlich ? 1 : 0,
      oeffentlich_vib: neuerTermin.oeffentlich_vib ? 1 : 0,
      dojo_id: activeDojo.id
    };

    try {
      // Stundenplan-Konflikt prüfen
      const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
      const konfliktRes = await fetch(
        `${API_BASE_URL}/pruefungen/termine/stundenplan-konflikt?datum=${neuerTermin.pruefungsdatum}&zeit=${neuerTermin.pruefungszeit || '10:00'}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (konfliktRes.ok) {
        const { konflikte } = await konfliktRes.json();
        if (konflikte && konflikte.length > 0) {
          // Konflikt gefunden → Dialog anzeigen
          setTrainingsKonfliktDialog({ konflikte, sendPush: true, terminData });
          return;
        }
      }
      // Kein Konflikt → direkt speichern
      await doSaveTermin(terminData);
    } catch (error) {
      setError(error.message);
    }
  };

  const handleTerminBearbeiten = (termin) => {
    // Formatiere Daten korrekt - verhindert Zeitzonen-Probleme
    const formatDateForInput = (dateString) => {
      if (!dateString) return '';

      // Bereits im richtigen Format (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }

      // ISO-Format mit Zeit - extrahiere nur Datum
      if (dateString.includes('T')) {
        return dateString.split('T')[0];
      }

      // Falls Date-Objekt oder anderes Format, parse es
      try {
        const date = new Date(dateString);
        // Verwende UTC um Zeitzonen-Probleme zu vermeiden
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      } catch (e) {
        console.error('Fehler beim Formatieren des Datums:', dateString, e);
        return '';
      }
    };

    setEditTermin({
      id: termin.vorlageData?.termin_id,
      datum: formatDateForInput(termin.datum),
      pruefungsdatum: formatDateForInput(termin.datum),
      pruefungszeit: termin.zeit || '10:00',
      pruefungsort: termin.ort || '',
      pruefer_name: termin.vorlageData?.pruefer_name || '',
      stil_id: termin.vorlageData?.stil_id || '',
      pruefungsgebuehr: termin.vorlageData?.pruefungsgebuehr || '',
      anmeldefrist: formatDateForInput(termin.vorlageData?.anmeldefrist),
      bemerkungen: termin.vorlageData?.bemerkungen || '',
      teilnahmebedingungen: termin.vorlageData?.teilnahmebedingungen || '',
      oeffentlich: termin.vorlageData?.oeffentlich ? true : false,
      oeffentlich_vib: termin.vorlageData?.oeffentlich_vib ? true : false
    });
    setShowEditTerminModal(true);
  };

  const toggleTerminExpanded = (terminKey, termin) => {
    const isCurrentlyExpanded = expandedTermine[terminKey];
    setExpandedTermine(prev => ({
      ...prev,
      [terminKey]: !prev[terminKey]
    }));
    // Externe Anmeldungen laden wenn öffentlicher Termin aufgeklappt wird
    if (!isCurrentlyExpanded && termin?.oeffentlich && termin?.vorlageData?.termin_id) {
      fetchExterneAnmeldungen(termin.vorlageData.termin_id);
    }
  };

  // Sortier-Funktion
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Sortier-Icon-Komponente
  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) {
      return (
        <span className="pv3-sort-icon-inactive">⇅</span>
      );
    }
    return (
      <span className="pv3-sort-icon-active">
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // Sortier-Logik anwenden
  const applySorting = (data, key, direction) => {
    if (!key) return data;

    return [...data].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];

      // Behandle null/undefined Werte
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      // String-Vergleich (case-insensitive)
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const handleTerminAktualisieren = async () => {
    if (!editTermin || !editTermin.pruefungsdatum) {
      setError('Bitte geben Sie ein Prüfungsdatum an');
      return;
    }

    if (!editTermin.id) {
      setError('Termin-ID fehlt');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/pruefungen/termine/${editTermin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          datum: editTermin.pruefungsdatum,
          zeit: editTermin.pruefungszeit,
          ort: editTermin.pruefungsort,
          pruefer_name: editTermin.pruefer_name || null,
          stil_id: editTermin.stil_id,
          pruefungsgebuehr: editTermin.pruefungsgebuehr ? parseFloat(editTermin.pruefungsgebuehr) : null,
          anmeldefrist: editTermin.anmeldefrist || null,
          bemerkungen: editTermin.bemerkungen || null,
          teilnahmebedingungen: editTermin.teilnahmebedingungen || null,
          oeffentlich: editTermin.oeffentlich ? 1 : 0,
          oeffentlich_vib: editTermin.oeffentlich_vib ? 1 : 0
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Aktualisieren des Termins');
      }

      setSuccess('Prüfungstermin wurde erfolgreich aktualisiert!');
      setTimeout(() => setSuccess(''), 3000);

      setShowEditTerminModal(false);
      setEditTermin(null);
      fetchPruefungstermine();
    } catch (error) {
      setError(error.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const fetchExterneAnmeldungen = async (termin_id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/pruefungen/termine/${termin_id}/anmeldungen`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}` }
      });
      const data = await response.json();
      setExterneAnmeldungen(prev => ({ ...prev, [termin_id]: data.anmeldungen || [] }));
    } catch (err) {
      console.error('Fehler beim Laden der externen Anmeldungen:', err);
    }
  };

  const handleEditAnmeldungOpen = async (anmeldung, terminId) => {
    setEditAnmeldung({ ...anmeldung, termin_id: terminId });
    setEditAnmeldungForm({
      vorname: anmeldung.vorname || '',
      nachname: anmeldung.nachname || '',
      email: anmeldung.email || '',
      telefon: anmeldung.telefon || '',
      verein: anmeldung.verein || '',
      stil_id: anmeldung.stil_id || '',
      aktueller_gurt: anmeldung.aktueller_gurt || '',
      angestrebter_gurt: anmeldung.angestrebter_gurt || '',
      status: anmeldung.status || 'angemeldet'
    });
    // Graduierungen für diesen Stil laden
    if (anmeldung.stil_id) {
      try {
        const res = await fetch(`${API_BASE_URL}/stile/${anmeldung.stil_id}/graduierungen`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) setEditAnmeldungGrads(await res.json());
      } catch (e) { setEditAnmeldungGrads([]); }
    } else {
      setEditAnmeldungGrads([]);
    }
    setShowEditAnmeldungModal(true);
  };

  const handleEditAnmeldungSave = async () => {
    if (!editAnmeldung) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/pruefungen/termine/${editAnmeldung.termin_id}/anmeldungen/${editAnmeldung.id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ...editAnmeldungForm,
            vorname_orig: editAnmeldung.vorname,
            nachname_orig: editAnmeldung.nachname
          })
        }
      );
      if (!res.ok) throw new Error('Fehler beim Speichern');
      setShowEditAnmeldungModal(false);
      fetchExterneAnmeldungen(editAnmeldung.termin_id);
    } catch (e) {
      setError(e.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleTerminLoeschen = async (termin) => {
    // Prüfe ob es eine echte Vorlage ist oder nur ein gruppierter Termin mit Kandidaten
    if (!termin.vorlageData?.termin_id) {
      // Wenn es Kandidaten gibt, müssen diese einzeln entfernt werden
      if (termin.pruefungen && termin.pruefungen.length > 0) {
        setError(`Dieser Termin hat ${termin.pruefungen.length} zugelassene Kandidaten. Bitte entfernen Sie zuerst alle Kandidaten über "Zugelassene Prüfungen".`);
        return;
      }
      // Wenn keine Vorlage und keine Kandidaten: Termin existiert nicht wirklich
      setError('Dieser Termin existiert nicht in der Datenbank. Bitte aktualisieren Sie die Seite.');
      return;
    }

    if (!window.confirm(`Möchten Sie den Prüfungstermin am ${new Date(termin.datum).toLocaleDateString('de-DE')} wirklich löschen?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/pruefungen/termine/${termin.vorlageData.termin_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fehler beim Löschen des Termins');
      }

      setSuccess('Prüfungstermin wurde erfolgreich gelöscht!');
      setTimeout(() => setSuccess(''), 3000);

      fetchPruefungstermine();
    } catch (error) {
      setError(error.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  const handlePruefungslistePDF = async (termin) => {
    try {
      // Öffne die PDF in einem neuen Tab
      const pdfUrl = `${API_BASE_URL}/pruefungen/termine/${termin.datum}/pdf?stil_id=${termin.stil_id}&dojo_id=${activeDojo.id}`;
      window.open(pdfUrl, '_blank');
    } catch (error) {
      setError('Fehler beim Generieren der PDF: ' + error.message);
      setTimeout(() => setError(''), 5000);
    }
  };

  // Urkunden-Datendruck: druckt Name + Gurt + Urkundennummer + Datum auf die vorgedruckte Urkunde
  // A4 Querformat – Fenster wird SOFORT geöffnet (User-Gesture), Inhalt dann async befüllt
  const druckeUrkunden = (kandidaten, termin, vorlage = 'pruefungsurkunde') => {
    if (!kandidaten || kandidaten.length === 0) return;

    // Fenster SOFORT im Click-Kontext öffnen (Browser-Popup-Blocker umgehen)
    const w = Math.min(1200, window.screen.availWidth - 40);
    const h = Math.min(900, window.screen.availHeight - 60);
    const left = Math.round(window.screenX + (window.outerWidth - w) / 2);
    const top  = Math.round(window.screenY + (window.outerHeight - h) / 2);
    const win = window.open('', '_blank', `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`);
    if (!win) return; // Popup wirklich blockiert

    // Lade-Platzhalter anzeigen
    win.document.write('<html><body style="background:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#333;font-size:16px;">Urkundennummer wird geladen…</body></html>');

    const origin = window.location.origin;

    // Vorlagen-Konfiguration
    const VORLAGEN_CONFIG = {
      pruefungsurkunde: {
        pageSize: 'A4 landscape', pageW: '297mm', pageH: '210mm',
        bgImage: null,
        styles: `
          .cert-name { position:absolute;width:100%;top:64mm;text-align:center;font-family:'Times New Roman',Georgia,serif;font-size:22pt;font-style:italic;color:#000;letter-spacing:0.5px; }
          .cert-rank { position:absolute;width:100%;top:102mm;text-align:center;font-family:'Times New Roman',Georgia,serif;font-size:22pt;font-style:italic;color:#000;letter-spacing:0.5px; }
          .cert-nummer { position:absolute;width:100%;top:165mm;text-align:center;font-family:'Times New Roman',Georgia,serif;font-size:11pt;color:#000;letter-spacing:1px; }
          .cert-datum { position:absolute;width:100%;top:173mm;text-align:center;font-family:'Times New Roman',Georgia,serif;font-size:11pt;color:#000; }
        `,
        renderNr: true, renderDatum: true,
      },
      kickboxen_schuelergrad: {
        pageSize: 'A4 landscape', pageW: '297mm', pageH: '210mm',
        bgImage: `${origin}/assets/urkunde_kickboxen.jpg`,
        styles: `
          .cert-name { position:absolute;width:100%;top:64mm;text-align:center;font-family:'Times New Roman',Georgia,serif;font-size:22pt;font-style:italic;color:#000;letter-spacing:0.5px; }
          .cert-rank { position:absolute;width:100%;top:102mm;text-align:center;font-family:'Times New Roman',Georgia,serif;font-size:22pt;font-style:italic;color:#000;letter-spacing:0.5px; }
          .cert-nummer { position:absolute;width:100%;top:165mm;text-align:center;font-family:'Times New Roman',Georgia,serif;font-size:11pt;color:#000;letter-spacing:1px; }
          .cert-datum { position:absolute;width:100%;top:173mm;text-align:center;font-family:'Times New Roman',Georgia,serif;font-size:11pt;color:#000; }
        `,
        renderNr: true, renderDatum: true,
      },
      aikido_schuelergrad: {
        pageSize: 'A4 landscape', pageW: '297mm', pageH: '210mm',
        bgImage: null,
        extraFonts: `<style>@font-face{font-family:'Bonzai';src:url('${origin}/assets/bonzai.ttf') format('truetype');}</style>`,
        styles: `
          .cert-name { position:absolute;top:64mm;left:135mm;width:148mm;text-align:center;font-family:'Bonzai',cursive;font-size:26pt;color:#1a1a1a; }
          .cert-rank { position:absolute;top:109mm;left:135mm;width:148mm;text-align:center;font-family:'Bonzai',cursive;font-size:22pt;color:#1a1a1a; }
          .cert-nummer { position:absolute;top:174mm;left:20mm;width:115mm;text-align:center;font-family:'Bonzai',cursive;font-size:13pt;color:#1a1a1a;letter-spacing:0.5px; }
          .cert-datum { display:none; }
        `,
        renderNr: true, renderDatum: false,
      },
      board_of_black_belts: {
        pageSize: 'A3 landscape', pageW: '420mm', pageH: '297mm',
        bgImage: `${origin}/assets/urkunde_bobb.jpg`,
        extraFonts: `
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet">
          <style>@font-face{font-family:'Bonzai';src:url('${origin}/assets/bonzai.ttf') format('truetype');}</style>
        `,
        styles: `
          .cert-name { position:absolute;top:69mm;left:8mm;width:136mm;text-align:center;font-family:'Great Vibes',cursive;font-size:30pt;line-height:1;color:#1a0f08; }
          .cert-rank { display:none; }
          .cert-nummer { position:absolute;top:168mm;left:28mm;font-family:'Bonzai',cursive;font-size:14pt;color:#1a0f08; }
          .cert-datum { position:absolute;top:180mm;left:19mm;font-family:'Bonzai',cursive;font-size:14pt;color:#1a0f08; }
        `,
        renderNr: true, renderDatum: true,
      },
    };

    const cfg = VORLAGEN_CONFIG[vorlage] || VORLAGEN_CONFIG['pruefungsurkunde'];

    const buildAndPrint = (kandidatenMitNummern) => {
      const pruefDatum = termin?.datum || new Date().toISOString().split('T')[0];
      const pruefDatumDE = new Date(pruefDatum).toLocaleDateString('de-DE');

      const useBonzai = vorlage === 'aikido_schuelergrad';
      const bz = (s) => useBonzai ? (s || '').replace(/ß/g, 'ss') : (s || '');

      const pages = kandidatenMitNummern.map((p, i) => `
        <div class="cert-page" style="${i > 0 ? 'page-break-before:always;break-before:page;' : ''}">
          <div class="cert-name">${bz(`${p.vorname || ''} ${p.nachname || ''}`)}</div>
          <div class="cert-rank">${bz(p.graduierung_nachher || '—')}</div>
          ${p.urkundennummer ? `<div class="cert-nummer">${bz(p.urkundennummer)}</div>` : ''}
          <div class="cert-datum">${pruefDatumDE}</div>
        </div>
      `).join('');

      const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Urkunde Druck</title>
  ${cfg.extraFonts || ''}
  <style>
    @page { size: ${cfg.pageSize}; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #fff; }
    .cert-page {
      width: ${cfg.pageW};
      height: ${cfg.pageH};
      position: relative;
      background: transparent;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    ${cfg.styles}
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: ${cfg.pageSize}; margin: 0; }
    }
  </style>
</head>
<body>
${pages}
</body>
</html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 600);
    };

    // Urkundennummer async holen, dann Fenster befüllen
    const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
    const pruefDatum = termin?.datum || new Date().toISOString().split('T')[0];

    // Doppelprüfungen expandieren: ein Kandidat mit Zwischengurt → 2 Seiten
    const expandedKandidaten = [];
    kandidaten.forEach(p => {
      if (p.graduierung_zwischen) {
        // Erste Urkunde: bis zum Zwischengurt
        expandedKandidaten.push({ ...p, graduierung_nachher: p.graduierung_zwischen });
        // Zweite Urkunde: vom Zwischengurt zum Zielgurt
        expandedKandidaten.push({ ...p });
      } else {
        expandedKandidaten.push(p);
      }
    });

    fetch('/api/verband-urkunden/naechste-nummer', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        let baseNr = 0;
        let datePart = '';
        if (data.success && data.nummer) {
          const parts = data.nummer.split('-');
          datePart = parts[0];
          baseNr = parseInt(parts[1], 10);
        }
        const kandidatenMitNummern = expandedKandidaten.map((p, i) => ({
          ...p,
          urkundennummer: baseNr > 0 ? `${datePart}-${String(baseNr + i).padStart(5, '0')}` : null
        }));
        buildAndPrint(kandidatenMitNummern);

        // Verbandsregister + pruefungen.urkunde_nr aktualisieren
        const saveToRegister = async (k, dojoName, retryCount = 0) => {
          // Vorname/Nachname: direkt, oder aus extern-Feldern (externe Teilnehmer)
          const vn = k.vorname || k.extern_vorname || k.mitglied_vorname || '';
          const nn = k.nachname || k.extern_nachname || k.mitglied_nachname || '';
          if (!vn || !nn) {
            console.warn('[Urkunden] Kein Name für', k.urkundennummer, '— überspringe Register-Eintrag');
            return;
          }
          try {
            const res = await fetch('/api/verband-urkunden', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                urkundennummer: k.urkundennummer,
                art: vorlage || 'pruefungsurkunde',
                vorname: vn,
                nachname: nn,
                geburtsdatum: k.geburtsdatum || null,
                grad: k.graduierung_nachher || null,
                disziplin: termin?.stil_name || '',
                ausstellungsdatum: pruefDatum,
                pruefer: termin?.pruefer_name ? [termin.pruefer_name] : [],
                dojo_schule: dojoName
              })
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              console.warn('[Urkunden] Register-Save fehlgeschlagen:', res.status, body.message || '');
              // Einmal nachversuchen nach 3s
              if (retryCount === 0) setTimeout(() => saveToRegister(k, dojoName, 1), 3000);
            }
          } catch (err) {
            console.warn('[Urkunden] Register-Save Netzwerkfehler:', err.message);
            if (retryCount === 0) setTimeout(() => saveToRegister(k, dojoName, 1), 3000);
          }
        };

        setTimeout(() => {
          const dojoName = activeDojo?.name || dojos?.find(d => d.dojo_id === activeDojo?.id)?.name || null;
          kandidatenMitNummern.forEach(k => {
            if (!k.urkundennummer) return;
            // 1) Verbandsregister (mit Retry)
            saveToRegister(k, dojoName);
            // 2) Nummer zurück in pruefungen-Tabelle schreiben
            if (k.pruefung_id) {
              fetch(`/api/pruefungen/${k.pruefung_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ urkunde_nr: k.urkundennummer, urkunde_ausgestellt: 1 })
              }).catch(err => console.warn('[Urkunden] Pruefungen-Update fehlgeschlagen:', err.message));
            }
          });
        }, 800);
      })
      .catch(() => {
        // Kein Netzwerk → ohne Nummer drucken (Doppelprüfungen trotzdem expandieren)
        buildAndPrint(expandedKandidaten.map(p => ({ ...p, urkundennummer: null })));
      });
  };

  // Zwischengurt (Doppelprüfung) setzen oder löschen
  const saveZwischengurt = async (pruefung, zwischen_id) => {
    const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
    try {
      const response = await fetch(`${API_BASE_URL}/pruefungen/${pruefung.pruefung_id}/graduierung`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          graduierung_nachher_id: pruefung.graduierung_nachher_id,
          graduierung_zwischen_id: zwischen_id || null
        })
      });
      if (response.ok) {
        setOpenZwischenPruefId(null);
        fetchPruefungstermine();
        // Auch zugelassene + abgeschlossene Listen lokal aktualisieren
        const zwGrad = zwischen_id ? (graduierungenProStil[pruefung.stil_id] || []).find(g => g.graduierung_id === zwischen_id) : null;
        const updateFn = prev => prev.map(p => p.pruefung_id === pruefung.pruefung_id
          ? { ...p, graduierung_zwischen: zwGrad?.name || null, graduierung_zwischen_id: zwischen_id || null }
          : p
        );
        setZugelassenePruefungen(updateFn);
        setAbgeschlossenePruefungen(updateFn);
        setSuccess(zwischen_id ? 'Doppelprüfung gesetzt – Urkunde drucken!' : 'Doppelprüfung entfernt');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Fehler beim Speichern des Zwischengurts');
        setTimeout(() => setError(''), 4000);
      }
    } catch (err) {
      setError('Netzwerkfehler beim Speichern der Doppelprüfung');
      setTimeout(() => setError(''), 3000);
    }
  };

  const loadGraduierungenFuerModal = async (stil_id) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/stile/${stil_id}/graduierungen`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
          }
        }
      );
      const data = await response.json();
      setGraduierungenFuerModal(data.graduierungen || []);
      return data.graduierungen || [];
    } catch (error) {
      console.error('Fehler beim Laden der Graduierungen:', error);
      return [];
    }
  };

  const handleGraduierungAendern = (direction) => {
    if (!selectedPruefung || graduierungenFuerModal.length === 0) return;

    let newIndex = pruefungsErgebnis.graduierung_nachher_index;

    if (direction === 'up') {
      newIndex = Math.min(newIndex + 1, graduierungenFuerModal.length - 1);
    } else if (direction === 'down') {
      newIndex = Math.max(newIndex - 1, 0);
    }

    const newGrad = graduierungenFuerModal[newIndex];
    if (newGrad) {
      setPruefungsErgebnis({
        ...pruefungsErgebnis,
        graduierung_nachher_index: newIndex,
        graduierung_nachher_id: newGrad.graduierung_id,
        graduierung_nachher_name: newGrad.name,
        graduierung_nachher_farbe: newGrad.farbe_hex
      });
    }
  };

  // Keyboard Event für Pfeiltasten und Strg+Enter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showErgebnisModal) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          handleGraduierungAendern('up');
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          handleGraduierungAendern('down');
        } else if (e.key === 'Enter' && e.ctrlKey) {
          e.preventDefault();
          handleErgebnisEintragen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showErgebnisModal, pruefungsErgebnis, selectedPruefung, graduierungenFuerModal]);

  // 🔒 Warte auf Dojos bevor irgendwas angezeigt wird
  if (dojosLoading || !dojos || dojos.length === 0) {
    return (
      <div className="content-card pv2-center-3rem">
        <div className="u-emoji-xl">⏳</div>
        <h2 className="pv3-loading-primary">Lade Dojos...</h2>
        <p className="pv-text-secondary">
          Bitte warten Sie, während die Dojo-Daten geladen werden.
        </p>
      </div>
    );
  }

  return (
    <div className="content-card">
      {/* Kombinierte Top-Bar: Titel | Tabs | Filter + Refresh */}
      <div className="pv3-top-bar">
        <div className="pv3-page-header-row">
          <span className="pv3-header-icon">🎓</span>
          <h1 className="pv3-header-title">Prüfungsverwaltung</h1>
        </div>

        <div className="pv3-tabs-row">
          <button
            onClick={() => setActiveTab('termine')}
            className={`pv3-tab-btn${activeTab === 'termine' ? ' active' : ''}`}
          >
            <Calendar size={16} />
            Prüfungstermine
          </button>
          <button
            onClick={() => setActiveTab('kandidaten')}
            className={`pv3-tab-btn${activeTab === 'kandidaten' ? ' active' : ''}`}
          >
            <Users size={16} />
            Kandidaten
          </button>
          <button
            onClick={() => setActiveTab('zugelassen')}
            className={`pv3-tab-btn${activeTab === 'zugelassen' ? ' active' : ''}`}
          >
            <Check size={16} />
            Zugelassen
          </button>
          <button
            onClick={() => setActiveTab('abgeschlossen')}
            className={`pv3-tab-btn${activeTab === 'abgeschlossen' ? ' active' : ''}`}
          >
            <Award size={16} />
            Abgeschlossen
          </button>
          <button
            onClick={() => setActiveTab('statistiken')}
            className={`pv3-tab-btn${activeTab === 'statistiken' ? ' active' : ''}`}
          >
            <TrendingUp size={16} />
            Statistiken
          </button>
        </div>

        <div className="pv3-header-controls">
          <select
            value={selectedStil}
            onChange={(e) => setSelectedStil(e.target.value)}
            className="form-select pv3-select-short"
          >
            <option value="all">Alle Stile</option>
            {stile.map(stil => (
              <option key={stil.stil_id} value={stil.stil_id}>
                {stil.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (activeTab === 'termine') fetchPruefungstermine();
              else if (activeTab === 'zugelassen') fetchZugelassenePruefungen();
              else if (activeTab === 'abgeschlossen') fetchAbgeschlossenePruefungen();
              else if (activeTab === 'statistiken') { fetchStatistiken(); fetchTechnikStats(); fetchErwStats(); }
            }}
            className="logout-button pv3-btn-refresh pv3-btn-icon-only"
            title="Aktualisieren"
          >
            🔄
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="alert alert-success pv2-mb-1">
          ✅ {success}
        </div>
      )}
      {error && (
        <div className="alert alert-error pv2-mb-1">
          ❌ {error}
        </div>
      )}

      {/* Prüfungstermine Tab */}
      {activeTab === 'termine' && (
        <div>
          <div className="pv3-section-header">
            <div>
              <h2 className="pv3-section-title">
                Geplante Prüfungstermine
                <span className="pv3-section-count">
                  ({(() => {
                    const heute = new Date();
                    heute.setHours(0, 0, 0, 0);
                    const geplante = pruefungstermine.filter(termin => {
                      const terminDatum = new Date(termin.datum);
                      terminDatum.setHours(0, 0, 0, 0);
                      return terminDatum >= heute;
                    });
                    return geplante.length;
                  })()} {(() => {
                    const heute = new Date();
                    heute.setHours(0, 0, 0, 0);
                    const geplante = pruefungstermine.filter(termin => {
                      const terminDatum = new Date(termin.datum);
                      terminDatum.setHours(0, 0, 0, 0);
                      return terminDatum >= heute;
                    });
                    return geplante.length === 1 ? 'Termin' : 'Termine';
                  })()})
                </span>
              </h2>
              <p className="pv3-section-subtitle">
                Übersicht aller geplanten Prüfungen gruppiert nach Datum
              </p>
            </div>
            <button
              onClick={() => setShowNeuerTerminModal(true)}
              className="pv3-btn-new-termin"
            >
              <Calendar size={18} />
              Neuer Termin
            </button>
          </div>

          {loading ? (
            <div className="pv3-loading-center">
              <div className="loading-spinner-large"></div>
              <p className="pv-text-muted">Termine werden geladen...</p>
            </div>
          ) : pruefungstermine.length === 0 ? (
            <div className="pv3-empty-state">
              <Calendar size={48} className="pv2-muted-mb" />
              <h3 className="pv2-secondary-mb">Keine Prüfungstermine geplant</h3>
              <p className="pv-muted-sm-row">
                Aktuell gibt es keine geplanten Prüfungstermine. Lassen Sie Kandidaten zur Prüfung zu, um Termine zu erstellen.
              </p>
            </div>
          ) : (
            <div className="pv3-termine-list">
              {/* Geplante Termine */}
              {(() => {
                const heute = new Date();
                heute.setHours(0, 0, 0, 0);
                const geplanteTermine = pruefungstermine.filter(termin => {
                  const terminDatum = new Date(termin.datum);
                  terminDatum.setHours(0, 0, 0, 0);
                  return terminDatum >= heute;
                });

                if (geplanteTermine.length === 0) {
                  return null;
                }

                return (
                  <div>
                    <div className="pv3-termin-group-list">
                      {geplanteTermine.map((termin, index) => {
                        const datum = new Date(termin.datum);
                        const isToday = termin.datum === new Date().toISOString().split('T')[0];
                        const isPast = false; // Geplante Termine sind nie vergangen

                return (
                  <div
                    key={index}
                    className={isToday ? 'pv3-termin-card--today' : 'pv3-termin-card'}
                  >
                    {/* Termin-Header */}
                    <div className="pv3-termin-header">
                      {/* Obere Zeile: Info + Chevron */}
                      <div
                        className="pv2-flex-cursor pv3-termin-top"
                        onClick={() => toggleTerminExpanded(`${termin.datum}_${termin.stil_id}`, termin)}
                      >
                        <div className="pv3-termin-info">
                          <div className="pv3-termin-title-row">
                            <Calendar size={15} className={isToday ? 'pv3-calendar-today' : 'pv3-calendar-upcoming'} />
                            <h3 className={isToday ? 'pv3-termin-heading-today' : 'pv3-termin-heading-warning'}>
                              {datum.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </h3>
                          </div>
                          {(isToday || (isPast && !isToday) || termin.oeffentlich) && (
                            <div className="pv3-termin-badges-row">
                              {isToday && <span className="pv3-badge-today">Heute</span>}
                              {isPast && !isToday && <span className="pv3-badge-past">Vergangen</span>}
                              {termin.oeffentlich && <span className="pv3-badge-public">Öffentlich</span>}
                            </div>
                          )}
                          <div className="pv3-termin-meta-row">
                            <div className="pv-flex-row">
                              <span>Uhrzeit:</span>
                              <span>{termin.zeit}</span>
                            </div>
                            <span className="pv3-meta-dot">·</span>
                            <div className="pv-flex-row">
                              <span>Stil:</span>
                              <span className="pv3-badge-stil">{termin.stil_name}</span>
                            </div>
                            <span className="pv3-meta-dot">·</span>
                            <div className="pv-flex-row">
                              <span>Ort:</span>
                              <span>{termin.ort}</span>
                            </div>
                            <span className="pv3-meta-dot">·</span>
                            <div className="pv-flex-row">
                              <span>Teilnehmer:</span>
                              <span className="pv3-badge-teilnehmer">{termin.anzahl}</span>
                            </div>
                          </div>
                        </div>
                        <div className="pv3-termin-chevron">
                          {expandedTermine[`${termin.datum}_${termin.stil_id}`]
                            ? <ChevronUp size={16} className="pv-warning" />
                            : <ChevronDown size={16} className="pv-text-muted" />}
                        </div>
                      </div>
                      {/* Aktionsleiste: unten, volle Breite */}
                      <div className="pv3-termin-action-bar">
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/pruefung-durchfuehren?datum=${termin.datum}`); }}
                          className="pv3-ab-btn pv3-ab-btn--primary"
                          title="Zur Live-Prüfungsansicht wechseln"
                        >
                          <Play size={12} />
                          Prüfung starten
                        </button>
                        {termin.anzahl > 0 && !termin.isVorlage && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openBatchErgebnisModal(termin); }}
                            className="pv3-ab-btn pv3-ab-btn--green"
                            title="Ergebnisse für alle Teilnehmer eintragen"
                          >
                            <Award size={12} />
                            Ergebnisse
                          </button>
                        )}
                        <div className="pv3-ab-spacer" />
                        {termin.anzahl > 0 && !termin.isVorlage && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDruckAuswahlModal({ open: true, termin, selected: termin.pruefungen.map(p => p.pruefung_id), vorlage: 'pruefungsurkunde' }); }}
                              className="pv3-ab-btn pv3-ab-btn--print"
                              title="Urkunden drucken – Vorlage wählen"
                            >
                              <Printer size={12} />
                              Alle drucken
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDruckAuswahlModal({ open: true, termin, selected: termin.pruefungen.map(p => p.pruefung_id), vorlage: 'pruefungsurkunde' }); }}
                              className="pv3-ab-icon"
                              title="Auswahl für Urkunden-Druck"
                            >
                              <Printer size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePruefungslistePDF(termin); }}
                          className="pv3-ab-icon"
                          title="Server-PDF Teilnehmerliste"
                        >
                          <FileText size={18} />
                        </button>
                        {termin.anzahl > 0 && !termin.isVorlage && (
                          <button
                            disabled
                            className="pv3-ab-icon pv3-ab-icon--disabled"
                            title="Urkunden drucken — kommt in Kürze"
                            onClick={e => e.stopPropagation()}
                          >
                            <Scroll size={18} />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTerminBearbeiten(termin); }}
                          className="pv3-ab-icon"
                          title="Termin bearbeiten"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTerminLoeschen(termin); }}
                          className="pv3-ab-icon pv3-ab-icon--red"
                          title="Termin löschen"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    {/* Prüflinge-Liste */}
                    {expandedTermine[`${termin.datum}_${termin.stil_id}`] && (
                      <>
                        {termin.isVorlage ? (
                        <div className="pv3-vorlage-empty">
                          <Calendar size={48} className="pv3-icon-warning-large" />
                          <h4 className="pv3-vorlage-empty-title">
                            Termin ohne Teilnehmer
                          </h4>
                          <p className="pv3-vorlage-empty-text">
                            Dieser Termin wurde angelegt, hat aber noch keine zugelassenen Kandidaten.
                            <br />
                            Teilnehmer koennen ueber das Mitgliederprofil zu diesem Termin angemeldet werden.
                          </p>
                        </div>
                      ) : (
                        <div className="table-container pv2-mt-1">
                          <table className="data-table pv2-fs-0875">
                            <thead>
                              <tr>
                                <th className="pv3-th-180">Name</th>
                                <th className="pv3-th-110">Geburtsdatum</th>
                                <th className="pv3-th-100">Stil</th>
                                <th className="pv3-th-150">Aktueller Gurt</th>
                                <th className="pv3-th-150">Angestrebter Gurt</th>
                                <th className="pv3-th-140">Trainingsstunden</th>
                                <th className="pv3-th-100">Wartezeit</th>
                                <th className="pv3-th-130">Status</th>
                                <th className="pv3-th-80"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {termin.pruefungen.map((pruefung, pIndex) => (
                                <tr
                                  key={pIndex}
                                  className="pv3-table-row-gold hover-row"
                                >
                                  <td>
                                    <div className="pv-flex-col-xs">
                                      <span className="pv2-fw700-primary">
                                        {pruefung.vorname} {pruefung.nachname}
                                        {pruefung.is_extern ? <span style={{marginLeft:'6px',fontSize:'11px',background:'rgba(245,158,11,0.2)',color:'#f59e0b',border:'1px solid rgba(245,158,11,0.4)',borderRadius:'4px',padding:'1px 6px',fontWeight:600,letterSpacing:'0.03em'}}>EXTERN</span> : null}
                                      </span>
                                      <span className="pv-muted-sm">
                                        {pruefung.is_extern
                                          ? (pruefung.extern_verein || 'Externer Teilnehmer')
                                          : `ID: ${pruefung.mitglied_id}`}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="pv-text-secondary">
                                      {pruefung.geburtsdatum ? new Date(pruefung.geburtsdatum).toLocaleDateString('de-DE') : '—'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className="pv3-tag-stil-purple">
                                      {pruefung.stil_name}
                                    </span>
                                  </td>
                                  <td>
                                    <div className="pv-flex-row">
                                      <div
                                        className="pv3-gurt-dot"
                                        style={{ '--dot-color': pruefung.farbe_vorher || '#6b7280' }}
                                      />
                                      <div className="pv2-flex-col">
                                        <span className="pv-bold-primary-sm">
                                          {pruefung.graduierung_vorher || 'Keine'}
                                        </span>
                                        <span className="pv-muted-xs">
                                          Ziel-Gurt
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td>
                                    {graduierungenProStil[pruefung.stil_id] && graduierungenProStil[pruefung.stil_id].length > 0 ? (
                                      <div className="pv-flex-row">
                                        {(() => {
                                          const key = `${pruefung.mitglied_id}-${pruefung.stil_id}`;
                                          const selectedGradId = selectedGraduierungen[key] || pruefung.graduierung_nachher_id;
                                          const selectedGrad = graduierungenProStil[pruefung.stil_id].find(g => g.graduierung_id === selectedGradId);

                                          return (
                                            <>
                                              <div
                                                className="pv3-gurt-dot pv3-gurt-dot--selected"
                                                style={{ '--dot-color': selectedGrad?.farbe_hex || pruefung.farbe_nachher || '#EAB308' }}
                                                title={selectedGrad?.name || pruefung.graduierung_nachher || 'Keine Auswahl'}
                                              />
                                              <select
                                                value={selectedGradId || ''}
                                                onChange={async (e) => {
                                                  const newGradId = parseInt(e.target.value);
                                                  setSelectedGraduierungen({
                                                    ...selectedGraduierungen,
                                                    [key]: newGradId
                                                  });

                                                  try {
                                                    const response = await fetch(
                                                      `${API_BASE_URL}/pruefungen/${pruefung.pruefung_id}/graduierung`,
                                                      {
                                                        method: 'PUT',
                                                        headers: {
                                                          'Content-Type': 'application/json',
                                                          'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
                                                        },
                                                        body: JSON.stringify({ graduierung_nachher_id: newGradId })
                                                      }
                                                    );

                                                    if (response.ok) {
                                                      fetchPruefungstermine();
                                                      setSuccess('Graduierung erfolgreich aktualisiert!');
                                                      setTimeout(() => setSuccess(''), 2000);
                                                    } else {
                                                      const errorData = await response.json();
                                                      setError(errorData.error || 'Fehler beim Speichern der Graduierung');
                                                      setTimeout(() => setError(''), 3000);
                                                    }
                                                  } catch (err) {
                                                    console.error('Fehler beim Speichern der Graduierung:', err);
                                                    setError('Fehler beim Speichern der Graduierung');
                                                    setTimeout(() => setError(''), 3000);
                                                  }
                                                }}
                                                className="pv3-grad-select"
                                                title="Ziel-Graduierung ändern"
                                              >
                                                {graduierungenProStil[pruefung.stil_id]
                                                  .filter(grad => grad.aktiv === 1)
                                                  .sort((a, b) => a.reihenfolge - b.reihenfolge)
                                                  .map((grad) => (
                                                    <option key={grad.graduierung_id} value={grad.graduierung_id}>
                                                      {grad.name}
                                                    </option>
                                                  ))}
                                              </select>
                                            </>
                                          );
                                        })()}
                                      </div>
                                    ) : (
                                      <div className="pv-flex-row">
                                        <div
                                          className="pv3-gurt-dot"
                                          style={{ '--dot-color': pruefung.farbe_nachher || '#EAB308' }}
                                        />
                                        <span className="pv-bold-primary-sm">
                                          {pruefung.graduierung_nachher}
                                        </span>
                                      </div>
                                    )}
                                  </td>
                                  <td>
                                    <div className="pv-flex-col-sm">
                                      <div className="pv-flex-row">
                                        <span className="pv2-fw700-success">
                                          {pruefung.anwesenheiten_aktuell || 0}
                                        </span>
                                        <span className="pv-muted-xs">
                                          / {pruefung.min_trainingseinheiten || 0}
                                        </span>
                                      </div>
                                      <div className="pv3-progress-wrap">
                                        <div
                                          className={`pv3-bar-fill${((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? ' pv3-bar-fill--good' : ' pv3-bar-fill--warn'}`}
                                          style={{ width: `${Math.min(100, ((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100)}%` }}
                                        />
                                      </div>
                                      <span className="pv-muted-xs">
                                        {((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? '100%' : Math.round(((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100) + '%'} erreicht
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <div className="pv-flex-col-sm">
                                      <span className="pv3-wartezeit-value">
                                        {pruefung.monate_seit_letzter_pruefung || 0} Mon.
                                      </span>
                                      <span className="pv-muted-xs">
                                        von {pruefung.min_wartezeit_monate || 0}
                                      </span>
                                    </div>
                                  </td>
                                  <td>
                                    <span className="pv3-badge-zugelassen">
                                      <Check size={14} />
                                      Zugelassen
                                    </span>
                                  </td>
                                  <td>
                                    <div style={{display:'flex',gap:'4px',alignItems:'center'}}>
                                      <button
                                        onClick={() => druckeErgebnis(pruefung, termin)}
                                        title="Prüfungsprotokoll drucken"
                                        style={{background:'none',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'5px',color:'var(--text-muted,#aaa)',cursor:'pointer',padding:'4px 8px',fontSize:'14px',lineHeight:1,display:'flex',alignItems:'center',gap:'4px',whiteSpace:'nowrap'}}
                                      >
                                        🖨️
                                      </button>
                                      <button
                                        onClick={() => setDruckAuswahlModal({ open: true, termin, selected: [pruefung.pruefung_id], vorlage: 'pruefungsurkunde' })}
                                        title="Urkunde drucken (Name + Gurt)"
                                        style={{background:'none',border:'1px solid rgba(99,102,241,0.4)',borderRadius:'5px',color:'#818cf8',cursor:'pointer',padding:'4px 8px',fontSize:'13px',lineHeight:1,display:'flex',alignItems:'center',gap:'3px',whiteSpace:'nowrap'}}
                                      >
                                        🎖️
                                      </button>
                                      {/* Doppelprüfung */}
                                      {pruefung.graduierung_zwischen ? (
                                        <span style={{display:'flex',alignItems:'center',gap:'3px',background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.4)',borderRadius:'5px',padding:'3px 7px',fontSize:'11px',color:'#22c55e',whiteSpace:'nowrap'}}>
                                          2× {pruefung.graduierung_zwischen}
                                          <button
                                            onClick={() => saveZwischengurt(pruefung, null)}
                                            title="Doppelprüfung entfernen"
                                            style={{background:'none',border:'none',color:'#22c55e',cursor:'pointer',fontSize:'13px',lineHeight:1,padding:'0 0 0 2px'}}
                                          >×</button>
                                        </span>
                                      ) : (
                                        <div style={{position:'relative'}}>
                                          <button
                                            onClick={() => setOpenZwischenPruefId(openZwischenPruefId === pruefung.pruefung_id ? null : pruefung.pruefung_id)}
                                            title="Doppelprüfung (Gurt überspringen): Zwischengurt wählen → 2 Urkunden werden gedruckt"
                                            style={{background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'5px',color:'var(--text-muted,#aaa)',cursor:'pointer',padding:'4px 7px',fontSize:'11px',lineHeight:1,whiteSpace:'nowrap'}}
                                          >2×</button>
                                          {openZwischenPruefId === pruefung.pruefung_id && graduierungenProStil[pruefung.stil_id] && (
                                            <div style={{position:'absolute',right:0,top:'110%',background:'var(--surface,#1e252c)',border:'1px solid var(--border,#2a3038)',borderRadius:'8px',padding:'6px',zIndex:50,minWidth:'160px',boxShadow:'0 4px 16px rgba(0,0,0,0.5)'}}>
                                              <p style={{fontSize:'10px',color:'var(--text-muted,#aaa)',marginBottom:'5px',paddingLeft:'2px'}}>Zwischengurt wählen:</p>
                                              {(() => {
                                                const grads = graduierungenProStil[pruefung.stil_id] || [];
                                                const vorherGrad = grads.find(g => g.graduierung_id === pruefung.graduierung_vorher_id);
                                                const nachherGrad = grads.find(g => g.graduierung_id === pruefung.graduierung_nachher_id);
                                                const filtered = grads.filter(g =>
                                                  g.aktiv === 1 &&
                                                  (!vorherGrad || g.reihenfolge > vorherGrad.reihenfolge) &&
                                                  (!nachherGrad || g.reihenfolge < nachherGrad.reihenfolge)
                                                );
                                                if (filtered.length === 0) return <p style={{fontSize:'11px',color:'var(--text-muted,#aaa)',padding:'2px'}}>Kein Zwischengurt möglich</p>;
                                                return filtered.map(g => (
                                                  <button key={g.graduierung_id}
                                                    onClick={() => saveZwischengurt(pruefung, g.graduierung_id)}
                                                    style={{display:'flex',alignItems:'center',gap:'7px',width:'100%',background:'none',border:'none',color:'var(--text,#e8eaed)',cursor:'pointer',padding:'5px 6px',borderRadius:'5px',fontSize:'12px',textAlign:'left'}}
                                                    onMouseEnter={e => e.currentTarget.style.background='var(--surface2,#2a3038)'}
                                                    onMouseLeave={e => e.currentTarget.style.background='none'}
                                                  >
                                                    <span style={{width:'10px',height:'10px',borderRadius:'50%',background:g.farbe_hex||'#555',flexShrink:0,display:'inline-block'}}/>
                                                    {g.name}
                                                  </button>
                                                ));
                                              })()}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                        {/* Externe Anmeldungen */}
                        {termin.oeffentlich && termin.vorlageData?.termin_id && (
                          <div className="pv2-mt-15">
                            <h4 className="pv3-extern-heading">
                              🌐 Externe Anmeldungen
                            </h4>
                            {(() => {
                              const anmeldungen = externeAnmeldungen[termin.vorlageData.termin_id];
                              if (!anmeldungen) {
                                return (
                                  <p className="pv-muted-sm-row">
                                    Lade externe Anmeldungen...
                                  </p>
                                );
                              }
                              if (anmeldungen.length === 0) {
                                return (
                                  <p className="pv-muted-sm-row">
                                    Keine externen Anmeldungen vorhanden.
                                  </p>
                                );
                              }
                              return (
                                <div className="table-container">
                                  <table className="data-table pv3-extern-table">
                                    <thead>
                                      <tr>
                                        <th className="pv-sky">Name</th>
                                        <th className="pv-sky">E-Mail</th>
                                        <th className="pv-sky">Verein</th>
                                        <th className="pv-sky">Aktueller Gurt</th>
                                        <th className="pv-sky">Angestrebter Gurt</th>
                                        <th className="pv-sky">Status</th>
                                        <th className="pv-sky">Datum</th>
                                        <th className="pv-sky"></th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {anmeldungen.map(a => (
                                        <tr key={a.id}>
                                          <td>{a.vorname} {a.nachname}</td>
                                          <td>{a.email}</td>
                                          <td>{a.verein || '—'}</td>
                                          <td>{a.aktueller_gurt || '—'}</td>
                                          <td>{a.angestrebter_gurt || '—'}</td>
                                          <td>
                                            <span className={`pv3-extern-status pv3-extern-status--${a.status}`}>
                                              {a.status}
                                            </span>
                                          </td>
                                          <td className="pv3-extern-date">
                                            {new Date(a.erstellt_am).toLocaleDateString('de-DE')}
                                          </td>
                                          <td>
                                            <div style={{display:'flex',gap:'4px',alignItems:'center'}}>
                                            <button
                                              onClick={() => handleEditAnmeldungOpen(a, termin.vorlageData?.termin_id)}
                                              title="Anmeldung bearbeiten"
                                              style={{background:'none',border:'1px solid rgba(99,102,241,0.4)',borderRadius:'5px',color:'#818cf8',cursor:'pointer',padding:'4px 8px',fontSize:'14px',lineHeight:1}}
                                            >
                                              ✏️
                                            </button>
                                            <button
                                              onClick={() => druckeErgebnis({
                                                pruefung_id: a.pruefung_id || null,
                                                vorname: a.vorname,
                                                nachname: a.nachname,
                                                geburtsdatum: a.geburtsdatum || null,
                                                graduierung_vorher: a.aktueller_gurt || '—',
                                                farbe_vorher: null,
                                                graduierung_nachher: a.angestrebter_gurt || '—',
                                                farbe_nachher: a.farbe_nachher || null,
                                                graduierung_nachher_id: a.graduierung_nachher_id || null,
                                                bestanden: a.bestanden != null ? a.bestanden : null,
                                                prueferkommentar: a.prueferkommentar || null,
                                                punktzahl: a.punktzahl || null,
                                                max_punktzahl: a.max_punktzahl || null,
                                                is_extern: true,
                                                extern_verein: a.verein || null,
                                                mitglied_id: null,
                                                stil_id: a.stil_id || null
                                              }, {
                                                datum: a.termin_datum || termin.datum,
                                                stil_name: a.stil_name || termin.stil_name,
                                                ort: termin.ort || '',
                                                zeit: termin.zeit || '',
                                                pruefer_name: termin.pruefer_name || ''
                                              })}
                                              title="Prüfungsprotokoll drucken"
                                              style={{background:'none',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'5px',color:'var(--text-muted,#aaa)',cursor:'pointer',padding:'4px 8px',fontSize:'14px',lineHeight:1}}
                                            >
                                              🖨️
                                            </button>
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Manuell externen Teilnehmer hinzufügen */}
                        {!termin.isVorlage && (
                          <div style={{padding:'8px 0 4px',display:'flex',justifyContent:'flex-end'}}>
                            <button
                              className="logout-button pv3-btn-action-sm"
                              onClick={() => {
                                setExternModalTermin(termin);
                                setExternForm({ vorname: '', nachname: '', verein: '', graduierung_nachher_id: '' });
                                setShowExternModal(true);
                              }}
                            >
                              + Externen Teilnehmer
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Vergangene Termine */}
              {(() => {
                const heute = new Date();
                heute.setHours(0, 0, 0, 0);
                const vergangeneTermine = pruefungstermine.filter(termin => {
                  const terminDatum = new Date(termin.datum);
                  terminDatum.setHours(0, 0, 0, 0);
                  return terminDatum < heute;
                });

                if (vergangeneTermine.length === 0) {
                  return null;
                }

                return (
                  <div>
                    <button
                      className="pv3-vergangene-toggle"
                      onClick={() => setVergangeneExpanded(prev => !prev)}
                    >
                      {vergangeneExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      Vergangene Prüfungstermine ({vergangeneTermine.length})
                    </button>
                    {vergangeneExpanded && (
                    <div className="pv3-termin-group-list">
                      {vergangeneTermine.map((termin, index) => {
                        const datum = new Date(termin.datum);
                        const isToday = false; // Vergangene Termine sind nie heute
                        const isPast = true; // Vergangene Termine sind immer vergangen

                        return (
                          <div
                            key={index}
                            className="pv3-termin-card--past"
                          >
                            {/* Termin-Header */}
                            <div className="pv3-termin-header">
                              <div
                                className="pv2-flex-cursor"
                                onClick={() => toggleTerminExpanded(`${termin.datum}_${termin.stil_id}`, termin)}
                              >
                                <div className="pv3-termin-title-row">
                                  <Calendar size={24} className="pv3-icon-purple" />
                                  <h3 className="pv3-termin-heading-warning">
                                    {datum.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                  </h3>
                                  {expandedTermine[`${termin.datum}_${termin.stil_id}`] ? (
                                    <ChevronUp size={24} className="pv3-icon-chevron-warning" />
                                  ) : (
                                    <ChevronDown size={24} className="pv3-icon-chevron-muted" />
                                  )}
                                  <span className="pv3-badge-past">
                                    Vergangen
                                  </span>
                                </div>
                                <div className="pv3-termin-meta-row">
                                  <div className="pv-flex-row">
                                    <span className="pv2-fw600">⏰ Uhrzeit:</span>
                                    <span>{termin.zeit}</span>
                                  </div>
                                  <div className="pv-flex-row">
                                    <span className="pv2-fw600">🥋 Stil:</span>
                                    <span className="pv3-badge-stil">
                                      {termin.stil_name}
                                    </span>
                                  </div>
                                  <div className="pv-flex-row">
                                    <span className="pv2-fw600">📍 Ort:</span>
                                    <span>{termin.ort}</span>
                                  </div>
                                  <div className="pv-flex-row">
                                    <span className="pv2-fw600">👥 Teilnehmer:</span>
                                    <span className="pv3-badge-teilnehmer">
                                      {termin.anzahl}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="u-flex-gap-sm">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/dashboard/pruefung-durchfuehren?datum=${termin.datum}`);
                                  }}
                                  className="logout-button pv3-btn-results"
                                  title="Zur Live-Prüfungsansicht wechseln"
                                >
                                  🎯 Prüfung öffnen
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePruefungslistePDF(termin);
                                  }}
                                  className="logout-button pv3-btn-action-sm"
                                  title="Teilnehmerliste als PDF drucken"
                                >
                                  PDF
                                </button>
                                {termin.anzahl > 0 && !termin.isVorlage && (
                                  <span className="pv-tooltip-wrap" data-tip="Schnelle Gesamtergebnis-Eingabe: Bestanden/Nicht bestanden + Punkte für alle Teilnehmer auf einmal – ohne Detailbewertung. Für Einzelbewertungen pro Technik → 'Prüfung öffnen' nutzen.">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openBatchErgebnisModal(termin);
                                      }}
                                      className="logout-button pv3-btn-results"
                                    >
                                      <Award size={16} />
                                      Ergebnisse eintragen
                                    </button>
                                  </span>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTerminBearbeiten(termin);
                                  }}
                                  className="logout-button pv3-btn-action-sm"
                                  title="Termin bearbeiten"
                                >
                                  <Edit size={18} />
                                  Bearbeiten
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleTerminLoeschen(termin);
                                  }}
                                  className="logout-button pv3-btn-delete"
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(220, 53, 69, 0.4) 0%, rgba(220, 53, 69, 0.2) 50%, transparent 100%)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.3)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(220, 53, 69, 0.3) 0%, rgba(220, 53, 69, 0.1) 50%, transparent 100%)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(220, 53, 69, 0.2)';
                                  }}
                                  title="Termin löschen"
                                >
                                  <Trash2 size={18} />
                                  Löschen
                                </button>
                              </div>
                            </div>

                            {/* Prüflinge-Liste */}
                            {expandedTermine[`${termin.datum}_${termin.stil_id}`] && (
                              <>
                                {termin.isVorlage ? (
                                <div className="pv3-vorlage-empty">
                                  <Calendar size={48} className="pv3-icon-warning-large" />
                                  <h4 className="pv3-vorlage-empty-title">
                                    Termin ohne Teilnehmer
                                  </h4>
                                  <p className="pv3-vorlage-empty-text">
                                    Dieser Termin wurde angelegt, hat aber noch keine zugelassenen Kandidaten.
                                    <br />
                                    Teilnehmer koennen ueber das Mitgliederprofil zu diesem Termin angemeldet werden.
                                  </p>
                                </div>
                              ) : (
                                <div className="table-container pv2-mt-1">
                                  <table className="data-table pv2-fs-0875">
                                    <thead>
                                      <tr>
                                        <th className="pv3-th-180">Name</th>
                                        <th className="pv3-th-110">Geburtsdatum</th>
                                        <th className="pv3-th-100">Stil</th>
                                        <th className="pv3-th-150">Aktueller Gurt</th>
                                        <th className="pv3-th-150">Angestrebter Gurt</th>
                                        <th className="pv3-th-140">Trainingsstunden</th>
                                        <th className="pv3-th-100">Wartezeit</th>
                                        <th className="pv3-th-130">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {termin.pruefungen.map((pruefung, pIndex) => (
                                        <tr
                                          key={pIndex}
                                          className="hover-row pv3-table-row-gold"
                                        >
                                          <td>
                                            <div className="pv-flex-col-xs">
                                              <span className="pv2-fw700-primary">
                                                {pruefung.vorname} {pruefung.nachname}
                                              </span>
                                              <span className="pv-muted-sm">
                                                ID: {pruefung.mitglied_id}
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <span className="pv-text-secondary">
                                              {pruefung.geburtsdatum ? new Date(pruefung.geburtsdatum).toLocaleDateString('de-DE') : '—'}
                                            </span>
                                          </td>
                                          <td>
                                            <span className="pv3-tag-stil-purple">
                                              {pruefung.stil_name}
                                            </span>
                                          </td>
                                          <td>
                                            <div className="pv-flex-row">
                                              <div
                                                className="pv3-gurt-dot"
                                                style={{ '--dot-color': pruefung.farbe_vorher || '#6b7280' }}
                                              />
                                              <div className="pv2-flex-col">
                                                <span className="pv-bold-primary-sm">
                                                  {pruefung.graduierung_vorher || 'Keine'}
                                                </span>
                                                <span className="pv-muted-xs">
                                                  Ziel-Gurt
                                                </span>
                                              </div>
                                            </div>
                                          </td>
                                          <td>
                                            <div className="pv-flex-row">
                                              <div
                                                className="pv3-gurt-dot"
                                                style={{ '--dot-color': pruefung.farbe_nachher || '#EAB308' }}
                                              />
                                              <div className="pv2-flex-col">
                                                <span className="pv-bold-primary-sm">
                                                  {pruefung.graduierung_nachher}
                                                </span>
                                                <span className="pv-muted-xs">
                                                  Ziel-Gurt
                                                </span>
                                              </div>
                                            </div>
                                          </td>
                                          <td>
                                            <div className="pv-flex-col-sm">
                                              <div className="pv-flex-row">
                                                <span className="pv2-fw700-success">
                                                  {pruefung.anwesenheiten_aktuell || 0}
                                                </span>
                                                <span className="pv-muted-xs">
                                                  / {pruefung.min_trainingseinheiten || 0}
                                                </span>
                                              </div>
                                              <div className="pv3-progress-wrap">
                                                <div
                                                  className={`pv3-bar-fill${((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? ' pv3-bar-fill--good' : ' pv3-bar-fill--warn'}`}
                                                  style={{ width: `${Math.min(100, ((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100)}%` }}
                                                />
                                              </div>
                                              <span className="pv-muted-xs">
                                                {((pruefung.anwesenheiten_aktuell || 0) >= (pruefung.min_trainingseinheiten || 0)) ? '100%' : Math.round(((pruefung.anwesenheiten_aktuell || 0) / (pruefung.min_trainingseinheiten || 1)) * 100) + '%'} erreicht
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <div className="pv-flex-col-sm">
                                              <span className="pv3-wartezeit-value">
                                                {pruefung.monate_seit_letzter_pruefung || 0} Mon.
                                              </span>
                                              <span className="pv-muted-xs">
                                                von {pruefung.min_wartezeit_monate || 0}
                                              </span>
                                            </div>
                                          </td>
                                          <td>
                                            <span className="pv3-badge-zugelassen">
                                              <Check size={14} />
                                              Zugelassen
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Kandidaten Tab */}
      {activeTab === 'kandidaten' && (() => {
        // Filtere Kandidaten basierend auf Berechtigungs- und Stil-Filter
        let filteredKandidaten = kandidaten;

        // Berechtigungsfilter anwenden
        if (berechtigungsFilter === 'berechtigt') {
          filteredKandidaten = filteredKandidaten.filter(k => k.berechtigt);
        } else if (berechtigungsFilter === 'nicht_berechtigt') {
          filteredKandidaten = filteredKandidaten.filter(k => !k.berechtigt);
        }

        // Stilfilter anwenden
        if (kandidatenStilFilter !== 'all') {
          filteredKandidaten = filteredKandidaten.filter(k => k.stil_id === parseInt(kandidatenStilFilter));
        }

        // Suchfilter anwenden (Name, Vorname, ID)
        if (kandidatenSuchbegriff.trim() !== '') {
          const suchbegriff = kandidatenSuchbegriff.toLowerCase().trim();
          filteredKandidaten = filteredKandidaten.filter(k =>
            (k.vorname && k.vorname.toLowerCase().includes(suchbegriff)) ||
            (k.nachname && k.nachname.toLowerCase().includes(suchbegriff)) ||
            (k.mitglied_id && k.mitglied_id.toString().includes(suchbegriff))
          );
        }

        // Sortierung anwenden
        if (sortConfig.key) {
          filteredKandidaten = applySorting(filteredKandidaten, sortConfig.key, sortConfig.direction);
        }

        return (
        <div>
          <div className="pv3-kandidaten-header">
            <div className="u-flex-1">
              <h2 className="pv3-kandidaten-title">
                Prüfungskandidaten
                <span className="pv3-kandidaten-count">
                  ({filteredKandidaten.filter(k => k.berechtigt).length} berechtigt / {filteredKandidaten.length} angezeigt
                  {(berechtigungsFilter !== 'all' || kandidatenStilFilter !== 'all') && ` von ${kandidaten.length} gesamt`})
                </span>
              </h2>
              <p className="pv3-kandidaten-subtitle">
                {selectedKandidaten.length > 0
                  ? `${selectedKandidaten.length} Kandidat${selectedKandidaten.length > 1 ? 'en' : ''} ausgewählt`
                  : 'Wählen Sie Kandidaten aus, um sie zur Prüfung zuzulassen'}
              </p>

              {/* Filter Controls */}
              <div className="pv3-filter-row">
                {/* Berechtigungsfilter */}
                <div className="pv-flex-row">
                  <span className="pv-secondary-bold">
                    Berechtigung:
                  </span>
                  <div className="pv3-btn-group">
                    <button
                      onClick={() => setBerechtigungsFilter('all')}
                      className={`pv3-filter-btn${berechtigungsFilter === 'all' ? ' active' : ''}`}
                    >
                      Alle
                    </button>
                    <button
                      onClick={() => setBerechtigungsFilter('berechtigt')}
                      className={`pv3-filter-btn${berechtigungsFilter === 'berechtigt' ? ' active' : ''}`}
                    >
                      Berechtigt
                    </button>
                    <button
                      onClick={() => setBerechtigungsFilter('nicht_berechtigt')}
                      className={`pv3-filter-btn${berechtigungsFilter === 'nicht_berechtigt' ? ' active' : ''}`}
                    >
                      Nicht berechtigt
                    </button>
                  </div>
                </div>

                {/* Stilfilter */}
                <div className="pv-flex-row">
                  <span className="pv-secondary-bold">
                    Stil:
                  </span>
                  <select
                    value={kandidatenStilFilter}
                    onChange={(e) => setKandidatenStilFilter(e.target.value)}
                    className="pv3-dark-select"
                  >
                    <option value="all" className="pv2-dark-input">
                      Alle Stile
                    </option>
                    {stile.map(stil => (
                      <option
                        key={stil.stil_id}
                        value={stil.stil_id}
                        className="pv2-dark-input"
                      >
                        {stil.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Suchfeld */}
                <div className="pv3-search-wrap">
                  <span className="pv-secondary-bold">
                    Suche:
                  </span>
                  <input
                    type="text"
                    placeholder="Name suchen..."
                    value={kandidatenSuchbegriff}
                    onChange={(e) => setKandidatenSuchbegriff(e.target.value)}
                    className="pv3-search-input"
                  />
                  {kandidatenSuchbegriff && (
                    <button
                      onClick={() => setKandidatenSuchbegriff('')}
                      className="pv3-search-clear"
                      title="Suche zurücksetzen"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
            {selectedKandidaten.length > 0 && (() => {
              const berechtigt = selectedKandidaten.filter(k => k.berechtigt);
              const nichtBerechtigt = selectedKandidaten.filter(k => !k.berechtigt);
              return (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {berechtigt.length > 0 && (
                    <button
                      onClick={async () => {
                        for (const k of berechtigt) await handleKandidatZulassen(k);
                        setSelectedKandidaten([]);
                      }}
                      className="btn btn-primary pv3-batch-btn"
                    >
                      <Check size={18} />
                      {berechtigt.length} zulassen
                    </button>
                  )}
                  {nichtBerechtigt.length > 0 && (
                    <button
                      onClick={async () => {
                        const namen = nichtBerechtigt.map(k => `${k.vorname} ${k.nachname}`).join(', ');
                        if (!window.confirm(
                          `Ausnahme-Zulassung für ${nichtBerechtigt.length} Kandidat${nichtBerechtigt.length > 1 ? 'en' : ''} erteilen?\n\n${namen}`
                        )) return;
                        for (const k of nichtBerechtigt) await handleKandidatZulassen(k, null);
                        setSelectedKandidaten([]);
                      }}
                      className="btn btn-warning pv3-batch-btn"
                      style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }}
                    >
                      ⚠ {nichtBerechtigt.length} Ausnahme zulassen
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedKandidaten([])}
                    style={{ padding: '6px 10px', background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Auswahl aufheben
                  </button>
                </div>
              );
            })()}
          </div>

          {loading ? (
            <div className="pv3-loading-center">
              <div className="loading-spinner-large"></div>
              <p className="pv-text-secondary">Kandidaten werden geladen...</p>
            </div>
          ) : kandidaten.length === 0 ? (
            <div className="pv3-empty-state-dashed-gold">
              <Users size={48} className="pv2-muted-mb" />
              <h3 className="pv2-secondary-mb">Keine Kandidaten gefunden</h3>
              <p className="pv-muted-sm-row">
                Aktuell gibt es keine Mitglieder, die die Voraussetzungen für eine Prüfung erfüllen.
              </p>
            </div>
          ) : filteredKandidaten.length === 0 ? (
            <div className="pv3-empty-state-dashed-gold">
              <Users size={48} className="pv2-muted-mb" />
              <h3 className="pv2-secondary-mb">Keine Kandidaten mit den aktuellen Filtern</h3>
              <p className="pv-muted-sm-row">
                Passen Sie die Filter an, um andere Kandidaten anzuzeigen.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table pv3-table-sm">
                <thead>
                  <tr>
                    <th className="pv3-th-plain-40-center">
                      <input
                        type="checkbox"
                        className="pv3-checkbox-gold"
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedKandidaten(filteredKandidaten.filter(k => !k.bereits_zugelassen));
                          } else {
                            setSelectedKandidaten([]);
                          }
                        }}
                        checked={
                          filteredKandidaten.filter(k => !k.bereits_zugelassen).length > 0 &&
                          selectedKandidaten.length === filteredKandidaten.filter(k => !k.bereits_zugelassen).length
                        }
                      />
                    </th>
                    <th
                      className="pv3-th-sortable"
                      onClick={() => handleSort('name')}
                    >
                      Name <SortIcon columnKey="name" />
                    </th>
                    <th
                      className="pv3-th-sortable-sm"
                      onClick={() => handleSort('geburtsdatum')}
                    >
                      Geb.datum <SortIcon columnKey="geburtsdatum" />
                    </th>
                    <th
                      className="pv3-th-sortable-xs"
                      onClick={() => handleSort('stil_name')}
                    >
                      Stil <SortIcon columnKey="stil_name" />
                    </th>
                    <th
                      className="pv3-th-sortable-md"
                      onClick={() => handleSort('graduierung_vorher_name')}
                    >
                      Aktuell <SortIcon columnKey="graduierung_vorher_name" />
                    </th>
                    <th
                      className="pv3-th-sortable-md"
                      onClick={() => handleSort('graduierung_nachher_name')}
                    >
                      Ziel <SortIcon columnKey="graduierung_nachher_name" />
                    </th>
                    <th className="pv3-th-plain-110">Stunden</th>
                    <th className="pv3-th-plain-80">Monate</th>
                    <th className="pv3-th-plain-100">Status</th>
                    <th className="pv3-th-plain-100-center">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredKandidaten.map((kandidat, index) => (
                    <tr
                      key={`${kandidat.mitglied_id}-${kandidat.stil_id}-${index}`}
                      className={`hover-row ${kandidat.bereits_zugelassen ? 'pv3-kandidat-row--zugelassen' : kandidat.berechtigt ? 'pv3-kandidat-row--berechtigt' : ''}`}
                    >
                      <td className="pv2-text-center">
                        {!kandidat.bereits_zugelassen ? (
                          <input
                            type="checkbox"
                            className={kandidat.berechtigt ? 'pv3-checkbox-gold' : 'pv3-checkbox-warning'}
                            checked={selectedKandidaten.some(k =>
                              k.mitglied_id === kandidat.mitglied_id && k.stil_id === kandidat.stil_id
                            )}
                            title={kandidat.berechtigt ? 'Zur Prüfung zulassen' : 'Ausnahme-Zulassung'}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedKandidaten([...selectedKandidaten, kandidat]);
                              } else {
                                setSelectedKandidaten(selectedKandidaten.filter(k =>
                                  !(k.mitglied_id === kandidat.mitglied_id && k.stil_id === kandidat.stil_id)
                                ));
                              }
                            }}
                          />
                        ) : (
                          <span className="pv3-dash-muted">—</span>
                        )}
                      </td>
                      <td>
                        <div className="pv-flex-col-xs">
                          <strong className="u-text-primary">
                            {kandidat.vorname} {kandidat.nachname}
                          </strong>
                          <span className="pv-muted-sm">
                            ID: {kandidat.mitglied_id}
                          </span>
                        </div>
                      </td>
                      <td className="pv-text-secondary">
                        {new Date(kandidat.geburtsdatum).toLocaleDateString('de-DE')}
                      </td>
                      <td>
                        <span className="pv3-stil-badge-sm">
                          {kandidat.stil_name}
                        </span>
                      </td>
                      <td>
                        <div className="pv3-grad-row">
                          <div
                            className="pv3-gurt-dot-sm"
                            style={{ '--dot-color': kandidat.aktuelle_farbe || 'rgba(255, 255, 255, 0.1)' }}
                            title={kandidat.aktuelle_graduierung || 'Keine'}
                          />
                          <span className="pv3-grad-name">
                            {kandidat.aktuelle_graduierung || 'Keine'}
                          </span>
                        </div>
                      </td>
                      <td>
                        {graduierungenProStil[kandidat.stil_id] && graduierungenProStil[kandidat.stil_id].length > 0 ? (
                          <div className="pv-flex-row">
                            {(() => {
                              const key = `${kandidat.mitglied_id}-${kandidat.stil_id}`;
                              const selectedGradId = selectedGraduierungen[key] || kandidat.angestrebte_graduierung_id || kandidat.naechste_graduierung_id;
                              const selectedGrad = graduierungenProStil[kandidat.stil_id].find(g => g.graduierung_id === selectedGradId);

                              return (
                                <>
                                  <div
                                    className="pv3-gurt-dot-green"
                                    style={{ '--dot-color': selectedGrad?.farbe_hex || 'rgba(255, 255, 255, 0.1)' }}
                                    title={selectedGrad?.name || 'Keine Auswahl'}
                                  />
                                  <select
                                    value={selectedGradId || ''}
                                    onChange={async (e) => {
                                      const newGradId = parseInt(e.target.value);
                                      console.log('🎯 Graduierung geändert:', {
                                        kandidat: kandidat.vorname + ' ' + kandidat.nachname,
                                        newGradId,
                                        pruefung_id: kandidat.pruefung_id,
                                        bereits_zugelassen: kandidat.bereits_zugelassen
                                      });

                                      setSelectedGraduierungen({
                                        ...selectedGraduierungen,
                                        [key]: newGradId
                                      });

                                      // Wenn der Kandidat bereits zugelassen ist, sofort speichern
                                      if (kandidat.pruefung_id) {
                                        console.log('✅ Kandidat hat pruefung_id, speichere...', kandidat.pruefung_id);
                                        try {
                                          const response = await fetch(
                                            `${API_BASE_URL}/pruefungen/${kandidat.pruefung_id}/graduierung`,
                                            {
                                              method: 'PUT',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}`
                                              },
                                              body: JSON.stringify({ graduierung_nachher_id: newGradId })
                                            }
                                          );

                                          if (response.ok) {
                                            // Alle Listen aktualisieren
                                            fetchKandidaten();
                                            fetchZugelassenePruefungen();
                                            fetchPruefungstermine();
                                            setSuccess('Graduierung erfolgreich aktualisiert!');
                                            setTimeout(() => setSuccess(''), 2000);
                                          } else {
                                            const errorData = await response.json();
                                            setError(errorData.error || 'Fehler beim Speichern der Graduierung');
                                            setTimeout(() => setError(''), 3000);
                                          }
                                        } catch (error) {
                                          console.error('Fehler beim Speichern der Graduierung:', error);
                                          setError('Fehler beim Speichern der Graduierung');
                                          setTimeout(() => setError(''), 3000);
                                        }
                                      }
                                    }}
                                    className="pv3-grad-select-green"
                                    title="Wählen Sie die Ziel-Graduierung"
                                  >
                                    {graduierungenProStil[kandidat.stil_id]
                                      .filter(grad => grad.aktiv === 1)
                                      .sort((a, b) => a.reihenfolge - b.reihenfolge)
                                      .map((grad) => (
                                        <option key={grad.graduierung_id} value={grad.graduierung_id}>
                                          {grad.name}
                                          {grad.graduierung_id === kandidat.naechste_graduierung_id ? ' (Empfohlen)' : ''}
                                        </option>
                                      ))}
                                  </select>
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <div className="pv3-grad-row">
                            <div
                              className="pv3-gurt-dot-green"
                              style={{ '--dot-color': kandidat.naechste_farbe || 'rgba(255, 255, 255, 0.1)' }}
                              title={kandidat.naechste_graduierung}
                            />
                            <span className="pv3-grad-name-primary">
                              {kandidat.naechste_graduierung}
                            </span>
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="pv3-stunden-col">
                          <div className="pv3-stunden-header">
                            <span
                              className={`pv3-stunden-count ${kandidat.absolvierte_stunden >= kandidat.benoetigte_stunden ? 'pv3-value--met' : 'pv3-value--not-met'}`}
                            >
                              {kandidat.absolvierte_stunden}
                            </span>
                            <span className="pv-muted-sm">
                              / {kandidat.benoetigte_stunden}
                            </span>
                          </div>
                          <div className="pv3-bar-wrap-gray-sm">
                            <div
                              className={`pv3-bar-fill${kandidat.fortschritt_prozent >= 100 ? ' pv3-bar-fill--good' : ' pv3-bar-fill--warn'}`}
                              style={{ width: `${Math.min(kandidat.fortschritt_prozent, 100)}%` }}
                            />
                          </div>
                          <span className="pv-muted-xs">
                            {kandidat.fortschritt_prozent}% erreicht
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className={`pv3-monate-col ${kandidat.monate_seit_letzter_pruefung >= kandidat.benoetigte_monate ? 'pv3-value--met' : 'pv3-value--not-met'}`}>
                          {kandidat.monate_seit_letzter_pruefung} Mon.
                        </div>
                        <div className="pv-muted-sm">
                          von {kandidat.benoetigte_monate}
                        </div>
                      </td>
                      <td>
                        {kandidat.bereits_zugelassen ? (
                          <span className="badge badge-warning pv3-badge-flex">
                            <Check size={14} />
                            Zugelassen
                          </span>
                        ) : kandidat.berechtigt ? (
                          <span className="badge badge-success pv3-badge-flex">
                            <Check size={14} />
                            Berechtigt
                          </span>
                        ) : (
                          <span className="badge badge-neutral pv3-badge-flex">
                            <X size={14} />
                            Noch nicht
                          </span>
                        )}
                      </td>
                      <td className="pv2-text-center">
                        {!kandidat.bereits_zugelassen ? (
                          kandidat.berechtigt ? (
                            <button
                              onClick={() => openTerminAuswahl(kandidat)}
                              className="btn btn-sm btn-success pv3-btn-flex"
                            >
                              <Check size={16} />
                              Zulassen
                            </button>
                          ) : (
                            <button
                              onClick={() => openTerminAuswahl(kandidat, true)}
                              className="btn btn-sm btn-warning pv3-btn-flex"
                              title="Ausnahme-Zulassung für Kandidaten ohne zeitliche Voraussetzungen"
                            >
                              <Check size={16} />
                              Ausnahme
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => {
                              if (kandidat.pruefung_id) {
                                handleZulassungEntfernen({
                                  pruefung_id: kandidat.pruefung_id,
                                  mitglied_id: kandidat.mitglied_id,
                                  vorname: kandidat.vorname,
                                  nachname: kandidat.nachname
                                });
                              } else {
                                setError('Keine Prüfung-ID gefunden. Bitte aktualisieren Sie die Seite.');
                              }
                            }}
                            className="btn btn-sm btn-danger pv3-btn-flex"
                            title="Zulassung widerrufen"
                          >
                            <X size={16} />
                            Entfernen
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Legende */}
          {kandidaten.length > 0 && (
            <div className="pv3-legende-bar">
              <div className="pv3-legende-row">
                <div className="pv-flex-row">
                  <div className="pv3-legende-line-green" />
                  <span className="pv-text-secondary">Berechtigt zur Prüfung</span>
                </div>
                <div className="pv-flex-row">
                  <div className="pv3-legende-line-gold" />
                  <span className="pv-text-secondary">Bereits zugelassen</span>
                </div>
                <div className="pv-flex-row">
                  <div className="pv3-legende-line-white" />
                  <span className="pv-text-secondary">Noch nicht berechtigt</span>
                </div>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* Zugelassene Prüfungen Tab */}
      {activeTab === 'zugelassen' && (
        <div className="pv3-zugelassen-section">
          <div className="pv2-mb-15">
            <div className="pv3-tab-section-header">
              <h2 className="pv3-zug-h2">Zugelassene Prüfungen ({zugelassenePruefungen.length})</h2>

              {/* Datum Filter */}
              <div className="pv3-zug-filter-group">
                <button
                  onClick={() => setDatumFilter('alle')}
                  className={`pv3-zug-filter-btn ${datumFilter === 'alle' ? 'active' : ''}`}
                >
                  Alle
                </button>
                <button
                  onClick={() => setDatumFilter('zukuenftig')}
                  className={`pv3-zug-filter-btn ${datumFilter === 'zukuenftig' ? 'active' : ''}`}
                >
                  Zukünftig
                </button>
                <button
                  onClick={() => setDatumFilter('vergangen')}
                  className={`pv3-zug-filter-btn ${datumFilter === 'vergangen' ? 'active' : ''}`}
                >
                  Vergangen
                </button>
              </div>
            </div>

            {/* Stilfilter */}
            <div className="pv-flex-row">
              <span className="pv-secondary-bold">
                Stil:
              </span>
              <select
                value={zugelasseneStilFilter}
                onChange={(e) => setZugelasseneStilFilter(e.target.value)}
                className="pv3-dark-select"
              >
                <option value="all" className="pv2-dark-input">
                  Alle Stile
                </option>
                {stile.map(stil => (
                  <option
                    key={stil.stil_id}
                    value={stil.stil_id}
                    className="pv2-dark-input"
                  >
                    {stil.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="pv2-center-3rem">Lädt...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th
                      className="pv3-zug-th-sort"
                      onClick={() => handleSort('name')}
                    >
                      Name <SortIcon columnKey="name" />
                    </th>
                    <th
                      className="pv3-zug-th-sort"
                      onClick={() => handleSort('stil_name')}
                    >
                      Stil <SortIcon columnKey="stil_name" />
                    </th>
                    <th
                      className="pv3-zug-th-sort"
                      onClick={() => handleSort('graduierung_nachher_name')}
                    >
                      Angestrebt <SortIcon columnKey="graduierung_nachher_name" />
                    </th>
                    <th
                      className="pv3-zug-th-sort"
                      onClick={() => handleSort('pruefungsdatum')}
                    >
                      Prüfungsdatum <SortIcon columnKey="pruefungsdatum" />
                    </th>
                    <th className="pv3-zug-th">Bestätigung</th>
                    <th className="pv3-zug-th">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Sortierung und Filterung
                    const heute = new Date();
                    heute.setHours(0, 0, 0, 0);

                    let gefiltert = zugelassenePruefungen.filter(pruefung => {
                      // Stilfilter anwenden
                      if (zugelasseneStilFilter !== 'all' && pruefung.stil_id !== parseInt(zugelasseneStilFilter)) {
                        return false;
                      }

                      const istAbgeschlossen = pruefung.status === 'bestanden' || pruefung.status === 'nicht_bestanden';

                      if (datumFilter === 'zukuenftig') {
                        // Nur geplante Prüfungen mit Zukunftsdatum
                        if (istAbgeschlossen) return false;
                        if (!pruefung.pruefungsdatum) return true;
                        const d = new Date(pruefung.pruefungsdatum); d.setHours(0,0,0,0);
                        return d >= heute;
                      } else if (datumFilter === 'vergangen') {
                        // Abgeschlossene ODER geplante mit vergangenem Datum
                        if (istAbgeschlossen) return true;
                        if (!pruefung.pruefungsdatum) return false;
                        const d = new Date(pruefung.pruefungsdatum); d.setHours(0,0,0,0);
                        return d < heute;
                      }
                      return true; // 'alle'
                    });

                    // Sortierung anwenden
                    if (sortConfig.key) {
                      gefiltert = applySorting(gefiltert, sortConfig.key, sortConfig.direction);
                    } else {
                      // Standard-Sortierung: Zukünftige zuerst (aufsteigend), dann vergangene (absteigend)
                      gefiltert.sort((a, b) => {
                        if (!a.pruefungsdatum && !b.pruefungsdatum) return 0;
                        if (!a.pruefungsdatum) return 1;
                        if (!b.pruefungsdatum) return -1;

                        const dateA = new Date(a.pruefungsdatum);
                        const dateB = new Date(b.pruefungsdatum);
                        dateA.setHours(0, 0, 0, 0);
                        dateB.setHours(0, 0, 0, 0);

                        const isAFuture = dateA >= heute;
                        const isBFuture = dateB >= heute;

                        // Wenn beide zukünftig: aufsteigend (nächste zuerst)
                        if (isAFuture && isBFuture) {
                          return dateA - dateB;
                        }
                        // Wenn beide vergangen: absteigend (neueste zuerst)
                        if (!isAFuture && !isBFuture) {
                          return dateB - dateA;
                        }
                        // Zukünftige vor vergangenen
                        return isAFuture ? -1 : 1;
                      });
                    }

                    if (gefiltert.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                            {zugelassenePruefungen.length === 0
                              ? '🥋 Noch keine Kandidaten zur Prüfung zugelassen. Wechsle zu „Kandidaten" und lass Mitglieder zur Prüfung zu.'
                              : datumFilter === 'vergangen'
                                ? '📅 Keine vergangenen zugelassenen Prüfungen gefunden.'
                                : '📅 Keine zukünftigen zugelassenen Prüfungen gefunden.'
                            }
                          </td>
                        </tr>
                      );
                    }

                    return gefiltert.map(pruefung => (
                    <tr key={pruefung.pruefung_id}>
                      <td><strong>{pruefung.vorname} {pruefung.nachname}</strong></td>
                      <td>
                        <span className="pv3-stil-badge-sm">
                          {pruefung.stil_name}
                        </span>
                      </td>
                      <td>
                        <div className="pv3-grad-row">
                          <div
                            className="pv3-gurt-dot-sm"
                            style={{ '--dot-color': pruefung.farbe_nachher || 'rgba(255, 255, 255, 0.1)' }}
                            title={pruefung.graduierung_nachher}
                          />
                          <span className="pv3-grad-name-primary">
                            {pruefung.graduierung_nachher}
                          </span>
                        </div>
                      </td>
                      <td>
                        {pruefung.pruefungsdatum
                          ? new Date(pruefung.pruefungsdatum).toLocaleDateString('de-DE')
                          : 'Nicht festgelegt'}
                      </td>
                      <td>
                        {pruefung.teilnahme_bestaetigt
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '3px 8px', fontSize: '12px', color: '#10B981', fontWeight: 600, whiteSpace: 'nowrap' }}>✓ Angemeldet</span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', padding: '3px 8px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>⏳ Ausstehend</span>
                        }
                      </td>
                      <td>
                        <div className="u-flex-wrap-gap">
                          {(pruefung.status === 'bestanden' || pruefung.status === 'nicht_bestanden') ? (
                            // Abgeschlossene Prüfung: Urkunde + Protokoll
                            <>
                              <button
                                onClick={() => setDruckAuswahlModal({ open: true, termin: { datum: pruefung.pruefungsdatum, stil_id: pruefung.stil_id, stil_name: pruefung.stil_name, ort: pruefung.pruefungsort || '', zeit: pruefung.pruefungszeit || '', pruefer_name: pruefung.pruefer_name || '', pruefungen: [pruefung] }, selected: [pruefung.pruefung_id], vorlage: 'pruefungsurkunde' })}
                                className="pv3-zug-btn-neutral"
                                title="Urkunde drucken"
                              >
                                <Scroll size={13} /> Urkunde
                              </button>
                              <button
                                onClick={() => druckeErgebnis(pruefung, {
                                  datum: pruefung.pruefungsdatum,
                                  stil_name: pruefung.stil_name,
                                  ort: pruefung.pruefungsort || '',
                                  zeit: pruefung.pruefungszeit || '',
                                  pruefer_name: pruefung.pruefer_name || ''
                                })}
                                className="pv3-zug-btn-neutral"
                                title="Protokoll drucken"
                              >
                                <Printer size={13} /> Protokoll
                              </button>
                              {/* Doppelprüfung / Zwischengurt */}
                              {pruefung.graduierung_zwischen ? (
                                <span style={{display:'flex',alignItems:'center',gap:'3px',background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.4)',borderRadius:'5px',padding:'3px 7px',fontSize:'11px',color:'#22c55e',whiteSpace:'nowrap'}}>
                                  2× {pruefung.graduierung_zwischen}
                                  <button onClick={() => saveZwischengurt(pruefung, null)} title="Doppelprüfung entfernen" style={{background:'none',border:'none',color:'#22c55e',cursor:'pointer',fontSize:'13px',lineHeight:1,padding:'0 0 0 2px'}}>×</button>
                                </span>
                              ) : (
                                <div style={{position:'relative'}}>
                                  <button
                                    onClick={() => setOpenZwischenPruefId(openZwischenPruefId === pruefung.pruefung_id ? null : pruefung.pruefung_id)}
                                    title="Doppelprüfung: Zwischengurt setzen (2 Urkunden)"
                                    style={{background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'5px',color:'var(--text-muted,#aaa)',cursor:'pointer',padding:'4px 7px',fontSize:'11px',lineHeight:1,whiteSpace:'nowrap'}}
                                  >2×</button>
                                  {openZwischenPruefId === pruefung.pruefung_id && graduierungenProStil[pruefung.stil_id] && (
                                    <div style={{position:'absolute',right:0,top:'110%',background:'var(--surface,#1e252c)',border:'1px solid var(--border,#2a3038)',borderRadius:'8px',padding:'6px',zIndex:50,minWidth:'160px',boxShadow:'0 4px 16px rgba(0,0,0,0.5)'}}>
                                      <p style={{fontSize:'10px',color:'var(--text-muted,#aaa)',marginBottom:'5px',paddingLeft:'2px'}}>Zwischengurt wählen:</p>
                                      {(() => {
                                        const grads = graduierungenProStil[pruefung.stil_id] || [];
                                        const vorherGrad = grads.find(g => g.graduierung_id === pruefung.graduierung_vorher_id);
                                        const nachherGrad = grads.find(g => g.graduierung_id === pruefung.graduierung_nachher_id);
                                        const filtered = grads.filter(g =>
                                          g.aktiv === 1 &&
                                          (!vorherGrad || g.reihenfolge > vorherGrad.reihenfolge) &&
                                          (!nachherGrad || g.reihenfolge < nachherGrad.reihenfolge)
                                        );
                                        if (filtered.length === 0) return <p style={{fontSize:'11px',color:'var(--text-muted,#aaa)',padding:'2px'}}>Kein Zwischengurt möglich</p>;
                                        return filtered.map(g => (
                                          <button key={g.graduierung_id}
                                            onClick={() => saveZwischengurt(pruefung, g.graduierung_id)}
                                            style={{display:'flex',alignItems:'center',gap:'7px',width:'100%',background:'none',border:'none',color:'var(--text,#e8eaed)',cursor:'pointer',padding:'5px 6px',borderRadius:'5px',fontSize:'12px',textAlign:'left'}}
                                            onMouseEnter={e => e.currentTarget.style.background='var(--surface2,#2a3038)'}
                                            onMouseLeave={e => e.currentTarget.style.background='none'}
                                          >
                                            <span style={{width:'10px',height:'10px',borderRadius:'50%',background:g.farbe_hex||'#555',flexShrink:0,display:'inline-block'}}/>
                                            {g.name}
                                          </button>
                                        ));
                                      })()}
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          ) : (
                            // Geplante Prüfung: Ergebnis eintragen + Entfernen
                            <>
                              <button
                                onClick={async () => {
                                  if (!pruefung.stil_id) {
                                    setError('Stil-ID fehlt für diese Prüfung');
                                    return;
                                  }
                                  setSelectedPruefung(pruefung);
                                  const grads = await loadGraduierungenFuerModal(pruefung.stil_id);
                                  const currentIndex = grads.findIndex(g => g.graduierung_id === pruefung.graduierung_nachher_id);
                                  const targetGrad = grads[currentIndex] || grads[0];
                                  setPruefungsErgebnis({
                                    bestanden: false,
                                    punktzahl: '',
                                    max_punktzahl: '100',
                                    prueferkommentar: '',
                                    graduierung_nachher_index: currentIndex >= 0 ? currentIndex : 0,
                                    graduierung_nachher_id: targetGrad?.graduierung_id || null,
                                    graduierung_nachher_name: targetGrad?.name || '',
                                    graduierung_nachher_farbe: targetGrad?.farbe_hex || ''
                                  });
                                  setShowErgebnisModal(true);
                                }}
                                className="pv3-zug-btn-primary"
                              >
                                <Check size={13} /> Ergebnis eintragen
                              </button>
                              <button
                                onClick={() => handleZulassungEntfernen(pruefung)}
                                className="pv3-zug-btn-danger"
                              >
                                <X size={13} /> Entfernen
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Abgeschlossene Prüfungen Tab */}
      {activeTab === 'abgeschlossen' && (
        <div className="pv3-zugelassen-section">
          <div className="pv2-mb-15">
            <h2 className="pv3-zug-h2">Abgeschlossene Prüfungen ({abgeschlossenePruefungen.length})</h2>

            {/* Stilfilter */}
            <div className="pv-flex-row">
              <span className="pv-secondary-bold">
                Stil:
              </span>
              <select
                value={abgeschlosseneStilFilter}
                onChange={(e) => setAbgeschlosseneStilFilter(e.target.value)}
                className="pv3-dark-select"
              >
                <option value="all" className="pv2-dark-input">
                  Alle Stile
                </option>
                {stile.map(stil => (
                  <option
                    key={stil.stil_id}
                    value={stil.stil_id}
                    className="pv2-dark-input"
                  >
                    {stil.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="pv2-center-3rem">Lädt...</div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="pv3-zug-th-sort" onClick={() => handleSort('name')}>
                      Name <SortIcon columnKey="name" />
                    </th>
                    <th className="pv3-zug-th-sort" onClick={() => handleSort('stil_name')}>
                      Stil <SortIcon columnKey="stil_name" />
                    </th>
                    <th className="pv3-zug-th-sort" onClick={() => handleSort('graduierung_nachher')}>
                      Graduierung <SortIcon columnKey="graduierung_nachher" />
                    </th>
                    <th className="pv3-zug-th-sort" onClick={() => handleSort('pruefungsdatum')}>
                      Datum <SortIcon columnKey="pruefungsdatum" />
                    </th>
                    <th className="pv3-zug-th-sort" onClick={() => handleSort('bestanden')}>
                      Ergebnis <SortIcon columnKey="bestanden" />
                    </th>
                    <th className="pv3-zug-th">Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Stilfilter anwenden
                    let gefiltert = abgeschlossenePruefungen;

                    if (abgeschlosseneStilFilter !== 'all') {
                      gefiltert = gefiltert.filter(p => p.stil_id === parseInt(abgeschlosseneStilFilter));
                    }

                    // Sortierung anwenden
                    if (sortConfig.key) {
                      gefiltert = applySorting(gefiltert, sortConfig.key, sortConfig.direction);
                    }

                    return gefiltert.map(pruefung => (
                    <tr key={pruefung.pruefung_id}>
                      <td><strong>{pruefung.vorname} {pruefung.nachname}</strong></td>
                      <td>
                        <span className="pv3-stil-badge-sm">
                          {pruefung.stil_name}
                        </span>
                      </td>
                      <td>
                        <div className="pv3-grad-row">
                          <div
                            className="pv3-gurt-dot-sm"
                            style={{ '--dot-color': pruefung.farbe_nachher || 'rgba(255, 255, 255, 0.1)' }}
                            title={pruefung.graduierung_nachher}
                          />
                          <span className="pv3-grad-name">
                            {pruefung.graduierung_nachher}
                          </span>
                        </div>
                      </td>
                      <td>{new Date(pruefung.pruefungsdatum).toLocaleDateString('de-DE')}</td>
                      <td>
                        <div>
                          {pruefung.bestanden ? (
                            <span className="pv3-abg-badge-success">
                              Bestanden
                            </span>
                          ) : (
                            <span className="pv3-abg-badge-danger">
                              Nicht bestanden
                            </span>
                          )}
                          {pruefung.punktzahl && (
                            <div className="pv3-punktzahl-note">
                              {pruefung.punktzahl} / {pruefung.max_punktzahl} Pkt.
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="u-flex-wrap-gap">
                          <button
                            onClick={() => setDruckAuswahlModal({ open: true, termin: { datum: pruefung.pruefungsdatum, stil_id: pruefung.stil_id, stil_name: pruefung.stil_name, ort: pruefung.pruefungsort || '', zeit: pruefung.pruefungszeit || '', pruefer_name: pruefung.pruefer_name || '', pruefungen: [pruefung] }, selected: [pruefung.pruefung_id], vorlage: 'pruefungsurkunde' })}
                            className="pv3-zug-btn-neutral"
                            title="Urkunde drucken"
                          >
                            <Download size={13} /> Urkunde
                          </button>
                          <button
                            onClick={() => druckeErgebnis(pruefung, {
                              datum: pruefung.pruefungsdatum,
                              stil_name: pruefung.stil_name,
                              ort: pruefung.pruefungsort || '',
                              zeit: pruefung.pruefungszeit || '',
                              pruefer_name: pruefung.pruefer_name || ''
                            })}
                            className="pv3-zug-btn-neutral"
                            title="Prüfungsprotokoll drucken"
                          >
                            <TrendingUp size={13} /> Protokoll
                          </button>
                          {/* Doppelprüfung / Zwischengurt */}
                          {pruefung.graduierung_zwischen ? (
                            <span style={{display:'flex',alignItems:'center',gap:'3px',background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.4)',borderRadius:'5px',padding:'3px 7px',fontSize:'11px',color:'#22c55e',whiteSpace:'nowrap'}}>
                              2× {pruefung.graduierung_zwischen}
                              <button onClick={() => saveZwischengurt(pruefung, null)} title="Doppelprüfung entfernen" style={{background:'none',border:'none',color:'#22c55e',cursor:'pointer',fontSize:'13px',lineHeight:1,padding:'0 0 0 2px'}}>×</button>
                            </span>
                          ) : (
                            <div style={{position:'relative'}}>
                              <button
                                onClick={() => setOpenZwischenPruefId(openZwischenPruefId === pruefung.pruefung_id ? null : pruefung.pruefung_id)}
                                title="Doppelprüfung: Zwischengurt setzen (2 Urkunden)"
                                style={{background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'5px',color:'var(--text-muted,#aaa)',cursor:'pointer',padding:'4px 7px',fontSize:'11px',lineHeight:1,whiteSpace:'nowrap'}}
                              >2×</button>
                              {openZwischenPruefId === pruefung.pruefung_id && graduierungenProStil[pruefung.stil_id] && (
                                <div style={{position:'absolute',right:0,top:'110%',background:'var(--surface,#1e252c)',border:'1px solid var(--border,#2a3038)',borderRadius:'8px',padding:'6px',zIndex:50,minWidth:'160px',boxShadow:'0 4px 16px rgba(0,0,0,0.5)'}}>
                                  <p style={{fontSize:'10px',color:'var(--text-muted,#aaa)',marginBottom:'5px',paddingLeft:'2px'}}>Zwischengurt wählen:</p>
                                  {(() => {
                                    const grads = graduierungenProStil[pruefung.stil_id] || [];
                                    const vorherGrad = grads.find(g => g.graduierung_id === pruefung.graduierung_vorher_id);
                                    const nachherGrad = grads.find(g => g.graduierung_id === pruefung.graduierung_nachher_id);
                                    const filtered = grads.filter(g =>
                                      g.aktiv === 1 &&
                                      (!vorherGrad || g.reihenfolge > vorherGrad.reihenfolge) &&
                                      (!nachherGrad || g.reihenfolge < nachherGrad.reihenfolge)
                                    );
                                    if (filtered.length === 0) return <p style={{fontSize:'11px',color:'var(--text-muted,#aaa)',padding:'2px'}}>Kein Zwischengurt möglich</p>;
                                    return filtered.map(g => (
                                      <button key={g.graduierung_id}
                                        onClick={() => saveZwischengurt(pruefung, g.graduierung_id)}
                                        style={{display:'flex',alignItems:'center',gap:'7px',width:'100%',background:'none',border:'none',color:'var(--text,#e8eaed)',cursor:'pointer',padding:'5px 6px',borderRadius:'5px',fontSize:'12px',textAlign:'left'}}
                                        onMouseEnter={e => e.currentTarget.style.background='var(--surface2,#2a3038)'}
                                        onMouseLeave={e => e.currentTarget.style.background='none'}
                                      >
                                        <span style={{width:'10px',height:'10px',borderRadius:'50%',background:g.farbe_hex||'#555',flexShrink:0,display:'inline-block'}}/>
                                        {g.name}
                                      </button>
                                    ));
                                  })()}
                                </div>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => handleStatusAendern(pruefung)}
                            className="pv3-zug-btn-warning"
                          >
                            <Edit size={13} />
                            Status ändern
                          </button>
                        </div>
                      </td>
                    </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Statistiken Tab */}
      {activeTab === 'statistiken' && statistiken && (
        <div className="pv3-stat-section">

          {/* ── KPI CARDS ─────────────────────────────────────────── */}
          <div className="pvs-kpi-grid">
            {/* Termine */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Termine</div>
              <div className="pvs-kpi-value pvs-kpi-purple">{statistiken.gesamt.termine ?? statistiken.gesamt.gesamt}</div>
              <div className="pvs-kpi-sub">{statistiken.gesamt.gesamt} Teilnehmer</div>
            </div>
            {/* Bestanden */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Bestanden</div>
              <div className="pvs-kpi-value pvs-kpi-green">{statistiken.gesamt.bestanden}</div>
              <div className="pvs-kpi-bar-wrap">
                <div className="pvs-kpi-bar-fill pvs-kpi-bar-green"
                  style={{ width: `${statistiken.gesamt.gesamt > 0 ? Math.round(statistiken.gesamt.bestanden / statistiken.gesamt.gesamt * 100) : 0}%` }} />
              </div>
              <div className="pvs-kpi-sub pvs-kpi-green-text" style={{ display:'flex', alignItems:'center', gap:'0.3rem' }}>
                {statistiken.gesamt.gesamt > 0 ? Math.round(statistiken.gesamt.bestanden / statistiken.gesamt.gesamt * 100) : 0}% Quote
                {(() => {
                  const months = statistiken.nach_monat || [];
                  if (months.length < 4) return null;
                  const r = months.slice(0,3).reduce((a,m) => ({ g: a.g+m.anzahl, b: a.b+m.bestanden }), {g:0,b:0});
                  const o = months.slice(3,6).reduce((a,m) => ({ g: a.g+m.anzahl, b: a.b+m.bestanden }), {g:0,b:0});
                  const diff = (r.g>0 ? r.b/r.g*100 : 0) - (o.g>0 ? o.b/o.g*100 : 0);
                  if (Math.abs(diff) < 2) return null;
                  return <span style={{ color: diff>0 ? '#4ade80' : '#f87171', fontWeight:700, fontSize:'0.7rem' }}>{diff>0 ? '↑' : '↓'} Trend</span>;
                })()}
              </div>
            </div>
            {/* Nicht bestanden */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Nicht bestanden</div>
              <div className="pvs-kpi-value pvs-kpi-red">{statistiken.gesamt.nicht_bestanden}</div>
              <div className="pvs-kpi-bar-wrap">
                <div className="pvs-kpi-bar-fill pvs-kpi-bar-red"
                  style={{ width: `${statistiken.gesamt.gesamt > 0 ? Math.round(statistiken.gesamt.nicht_bestanden / statistiken.gesamt.gesamt * 100) : 0}%` }} />
              </div>
              <div className="pvs-kpi-sub pvs-kpi-red-text">
                {statistiken.gesamt.gesamt > 0 ? Math.round(statistiken.gesamt.nicht_bestanden / statistiken.gesamt.gesamt * 100) : 0}%
              </div>
            </div>
            {/* Geplant */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Geplant</div>
              <div className="pvs-kpi-value pvs-kpi-yellow">{statistiken.gesamt.geplant}</div>
              <div className="pvs-kpi-sub">Anstehend</div>
            </div>
            {/* Kandidaten */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Kandidaten</div>
              <div className="pvs-kpi-value pvs-kpi-cyan">{kandidaten.length}</div>
              <div className="pvs-kpi-sub">{kandidaten.filter(k => k.berechtigt).length} berechtigt</div>
            </div>
            {/* Ø Punktzahl */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Ø Punktzahl</div>
              <div className="pvs-kpi-value pvs-kpi-purple">
                {(() => {
                  const bp = abgeschlossenePruefungen.filter(p => p.bestanden && p.punktzahl && p.max_punktzahl);
                  return bp.length > 0 ? Math.round(bp.reduce((s, p) => s + (p.punktzahl / p.max_punktzahl * 100), 0) / bp.length) : 0;
                })()}%
              </div>
              <div className="pvs-kpi-sub">Ø bestandene Prüfungen</div>
            </div>
            {/* Ø Training */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Ø Training</div>
              <div className="pvs-kpi-value pvs-kpi-green">
                {kandidaten.length > 0 ? Math.round(kandidaten.reduce((s, k) => s + (k.trainingsstunden || 0), 0) / kandidaten.length) : 0}h
              </div>
              <div className="pvs-kpi-sub">pro Kandidat</div>
            </div>
            {/* Ø Monate */}
            <div className="stat-card pvs-kpi-card">
              <div className="pvs-kpi-label">Ø Wartezeit</div>
              <div className="pvs-kpi-value pvs-kpi-cyan">
                {kandidaten.length > 0 ? Math.round(kandidaten.reduce((s, k) => s + (k.monate_seit_letzter || 0), 0) / kandidaten.length) : 0}
              </div>
              <div className="pvs-kpi-sub">Monate seit letzter</div>
            </div>
          </div>

          <div className="pvs-sep" />

          {/* ── STIL + GRADUIERUNG nebeneinander ─────────────────── */}
          <div className="pvs-two-col">
            <div>
              <h3 className="pv3-section-h3">Nach Stil</h3>
              <div className="pvs-stil-list">
                {statistiken.nach_stil.map((stat, i) => {
                  const quote = stat.anzahl > 0 ? Math.round(stat.bestanden / stat.anzahl * 100) : 0;
                  const barColor = quote >= 80 ? '#4ade80' : quote >= 50 ? '#fbbf24' : '#f87171';
                  return (
                    <div key={i} className="pvs-stil-row">
                      <div className="pvs-stil-row-top">
                        <span className="pvs-stil-name">{stat.stil_name}</span>
                        <span className="pvs-stil-pct" style={{ color: barColor }}>{quote}%</span>
                      </div>
                      <div className="pvs-bar-track pvs-bar-track--full">
                        <div className="pvs-bar-fill-green" style={{ width: `${quote}%`, background: barColor }} />
                      </div>
                      <div className="pvs-stil-sub">
                        <span>{stat.anzahl} Prüfungen</span>
                        <span style={{ color: barColor }}>{stat.bestanden} bestanden</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h3 className="pv3-section-h3">Nach Graduierung</h3>
              <div className="pvs-grad-list">
                {(() => {
                  const gs = {};
                  abgeschlossenePruefungen.forEach(p => {
                    const g = p.graduierung_nachher || 'Unbekannt';
                    if (!gs[g]) gs[g] = { gesamt: 0, bestanden: 0, farbe: p.farbe_nachher };
                    gs[g].gesamt++;
                    if (p.bestanden) gs[g].bestanden++;
                  });
                  return Object.entries(gs).sort((a, b) => b[1].gesamt - a[1].gesamt).slice(0, 8).map(([grad, s]) => {
                    const q = s.gesamt > 0 ? Math.round(s.bestanden / s.gesamt * 100) : 0;
                    return (
                      <div key={grad} className="pvs-grad-row">
                        <div className="pvs-grad-dot" style={{ background: s.farbe || '#6b7280' }} />
                        <div className="pvs-grad-name">{grad}</div>
                        <div className="pvs-bar-track">
                          <div className="pvs-bar-fill-green" style={{ width: `${q}%` }} />
                        </div>
                        <div className="pvs-grad-stats">
                          <span className="pvs-grad-count">{s.gesamt}</span>
                          <span className="pvs-text-muted">{q}%</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>

          <div className="pvs-sep" />

          {/* ── TECHNIK-STATISTIKEN (aus einzelbewertungen) ─────── */}
          {technikStats && (
            <div className="pvs-technik-section">
              <h3 className="pv3-section-h3">Technik-Auswertung
                {technikStats.total_pruefungen > 0 && (
                  <span className="pvs-technik-basis"> · {technikStats.total_pruefungen} Prüfungen ausgewertet</span>
                )}
              </h3>
              {technikStats.techniken.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0.75rem 0' }}>
                  Noch keine Einzelbewertungen vorhanden. Führe Prüfungen über „Prüfung starten" durch, um hier Technik-Auswertungen zu sehen.
                </p>
              )}

              {/* Punkte nach Kategorie */}
              {technikStats.kategorien.length > 0 && (
                <div className="pvs-kat-grid">
                  {technikStats.kategorien.filter(k => k.avg_prozent !== null).map((kat, i) => {
                    const colors = ['#6366f1','#22c55e','#f59e0b','#06b6d4','#ec4899','#8b5cf6'];
                    const col = colors[i % colors.length];
                    return (
                      <div key={kat.kategorie} className="pvs-kat-card stat-card">
                        <div className="pvs-kat-label">{kat.label}</div>
                        <div className="pvs-kat-bar-track">
                          <div className="pvs-kat-bar-fill" style={{ width: `${kat.avg_prozent}%`, background: col }} />
                        </div>
                        <div className="pvs-kat-footer">
                          <span className="pvs-kat-pct" style={{ color: col }}>{kat.avg_prozent}%</span>
                          <span className="pvs-text-muted">{kat.count} Bewertungen</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Top Techniken + Verbesserungspotenzial */}
              {technikStats.techniken.length > 0 && <div className="pvs-two-col pvs-mt-1">
                {/* Top 5 */}
                <div>
                  <div className="pvs-rank-header pvs-rank-header--gold">🏆 Top Techniken</div>
                  <div className="pvs-rank-list">
                    {technikStats.techniken.slice(0, 5).map((t, i) => (
                      <div key={t.inhalt_id} className="pvs-rank-row">
                        <div className="pvs-rank-pos pvs-rank-pos--gold">{i + 1}</div>
                        <div className="pvs-rank-info">
                          <div className="pvs-rank-name">{t.titel}</div>
                          <div className="pvs-rank-cat">{t.kategorie}</div>
                        </div>
                        <div className="pvs-rank-bar-wrap">
                          <div className="pvs-bar-track">
                            <div className="pvs-bar-fill-gold" style={{ width: `${t.avg_prozent}%` }} />
                          </div>
                        </div>
                        <div className="pvs-rank-score pvs-text-gold">{t.avg_punkte} / {t.max_punktzahl}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Bottom 5 */}
                <div>
                  <div className="pvs-rank-header pvs-rank-header--red">📉 Verbesserungspotenzial</div>
                  <div className="pvs-rank-list">
                    {[...technikStats.techniken].reverse().slice(0, 5).map((t, i) => (
                      <div key={t.inhalt_id} className="pvs-rank-row">
                        <div className="pvs-rank-pos pvs-rank-pos--red">{technikStats.techniken.length - i}</div>
                        <div className="pvs-rank-info">
                          <div className="pvs-rank-name">{t.titel}</div>
                          <div className="pvs-rank-cat">{t.kategorie}</div>
                        </div>
                        <div className="pvs-rank-bar-wrap">
                          <div className="pvs-bar-track">
                            <div className="pvs-bar-fill-red" style={{ width: `${t.avg_prozent}%` }} />
                          </div>
                        </div>
                        <div className="pvs-rank-score pvs-text-red">{t.avg_punkte} / {t.max_punktzahl}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>}
            </div>
          )}

          {/* ── GURTVERTEILUNG ────────────────────────────────────── */}
          {statistiken.gurtverteilung && statistiken.gurtverteilung.length > 0 && (
            <div className="pvs-mt-2">
              <div className="pvs-gurt-header-row">
                <h3 className="pv3-section-h3" style={{ margin: 0 }}>Aktuelle Gurtverteilung</h3>
                <div className="pvs-gurt-view-toggle">
                  <button className={`pvs-gurt-view-btn${gurtView === 'stil' ? ' active' : ''}`} onClick={() => setGurtView('stil')}>Nach Stil</button>
                  <button className={`pvs-gurt-view-btn${gurtView === 'farbe' ? ' active' : ''}`} onClick={() => setGurtView('farbe')}>Nach Gurtfarbe</button>
                </div>
              </div>

              {gurtView === 'stil' ? (() => {
                const byStil = {};
                statistiken.gurtverteilung.forEach(g => {
                  if (!byStil[g.stil_name]) byStil[g.stil_name] = [];
                  byStil[g.stil_name].push(g);
                });
                return (
                  <div className="pvs-gurt-stil-groups">
                    {Object.entries(byStil)
                      .sort((a, b) => b[1].reduce((s, g) => s + g.anzahl, 0) - a[1].reduce((s, g) => s + g.anzahl, 0))
                      .map(([stil, gurte]) => {
                        const total = gurte.reduce((s, g) => s + g.anzahl, 0);
                        const maxA = Math.max(...gurte.map(g => g.anzahl), 1);
                        return (
                          <div key={stil} className="pvs-gurt-stil-group">
                            <div className="pvs-gurt-stil-header-row">
                              <span className="pvs-gurt-stil-name">{stil}</span>
                              <span className="pvs-gurt-stil-total">{total} {total === 1 ? 'Mitglied' : 'Mitglieder'}</span>
                            </div>
                            <div className="pvs-gurt-belt-rows">
                              {gurte.sort((a, b) => b.anzahl - a.anzahl).map((g, i) => (
                                <div key={i} className="pvs-gurt-belt-row">
                                  <div className="pvs-gurt-belt-swatch" style={{ background: g.farbe || '#6b7280' }} />
                                  <div className="pvs-gurt-belt-name">{g.graduierung_name}</div>
                                  <div className="pvs-bar-track pvs-bar-track--full">
                                    <div className="pvs-bar-fill-green" style={{ width: `${Math.round(g.anzahl / maxA * 100)}%`, background: g.farbe || '#4ade80', opacity: 0.55 }} />
                                  </div>
                                  <div className="pvs-gurt-belt-count">{g.anzahl}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })() : (() => {
                const byFarbe = {};
                statistiken.gurtverteilung.forEach(g => {
                  const key = g.farbe || '#808080';
                  if (!byFarbe[key]) byFarbe[key] = { farbe: key, name: g.graduierung_name, anzahl: 0, stile: [] };
                  byFarbe[key].anzahl += g.anzahl;
                  if (!byFarbe[key].stile.includes(g.stil_name)) byFarbe[key].stile.push(g.stil_name);
                });
                const sorted = Object.values(byFarbe).sort((a, b) => b.anzahl - a.anzahl);
                const maxA = sorted[0]?.anzahl || 1;
                return (
                  <div className="pvs-gurt-farbe-grid">
                    {sorted.map((g, i) => (
                      <div key={i} className="pvs-gurt-farbe-card">
                        <div className="pvs-gurt-farbe-top">
                          <div className="pvs-gurt-farbe-swatch" style={{ background: g.farbe }} />
                          <div className="pvs-gurt-farbe-name">{g.name}</div>
                        </div>
                        <div className="pvs-gurt-farbe-count">{g.anzahl}</div>
                        <div className="pvs-bar-track pvs-bar-track--full">
                          <div className="pvs-bar-fill-green" style={{ width: `${Math.round(g.anzahl / maxA * 100)}%`, background: g.farbe || '#4ade80', opacity: 0.6 }} />
                        </div>
                        <div className="pvs-gurt-farbe-stile">{g.stile.join(' · ')}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          <div className="pvs-sep" />

          {/* ── VERLAUF LETZTE 12 MONATE ─────────────────────────── */}
          <div className="pvs-mt-2">
            <h3 className="pv3-section-h3">Verlauf letzte 12 Monate</h3>
            <div className="pvs-month-grid">
              {(() => {
                const now = new Date();
                return Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  const label = d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
                  let gesamt = 0, bestanden = 0;
                  abgeschlossenePruefungen.forEach(p => {
                    if (!p.pruefungsdatum) return;
                    const pk = p.pruefungsdatum.slice(0, 7);
                    if (pk === key) { gesamt++; if (p.bestanden) bestanden++; }
                  });
                  const quote = gesamt > 0 ? Math.round(bestanden / gesamt * 100) : 0;
                  return (
                    <div key={key} className={`pvs-month-col${gesamt === 0 ? ' pvs-month-col--empty' : ''}`}>
                      <div className="pvs-month-bar-wrap">
                        <div className="pvs-month-bar" style={{ height: `${gesamt > 0 ? Math.max(8, quote) : 0}%` }} />
                      </div>
                      <div className="pvs-month-count">{gesamt > 0 ? gesamt : '·'}</div>
                      <div className="pvs-month-label">{label}</div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {/* ── RADAR + SCHWACHSTELLEN ───────────────────────────── */}
          {technikStats && technikStats.kategorien.length > 0 && (() => {
            const cx = 150, cy = 150, r = 108;
            const kats = technikStats.kategorien;
            const angles = kats.map((_, i) => (i * (360 / kats.length) - 90) * Math.PI / 180);
            const toXY = (angle, pct) => ({
              x: cx + r * Math.cos(angle) * pct / 100,
              y: cy + r * Math.sin(angle) * pct / 100
            });
            const gridPoints = (pct) => angles.map(a => `${toXY(a, pct).x},${toXY(a, pct).y}`).join(' ');
            const dataPoints = kats.map((k, i) => {
              const p = toXY(angles[i], k.avg_prozent || 0);
              return `${p.x},${p.y}`;
            }).join(' ');
            const schwach = technikStats.techniken.filter(t => t.avg_prozent !== null && t.avg_prozent < 75).slice(0, 8);
            return (
              <div className="pvs-two-col pvs-mt-2">
                {/* Radar */}
                <div>
                  <h3 className="pv3-section-h3">Kategorie-Radar</h3>
                  <div className="pvs-radar-wrap">
                    <svg viewBox="0 0 300 300" className="pvs-radar-svg" style={{ overflow:'visible' }}>
                      {[25,50,75,100].map(pct => (
                        <polygon key={pct} points={gridPoints(pct)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
                      ))}
                      {angles.map((a, i) => (
                        <line key={i} x1={cx} y1={cy} x2={toXY(a,100).x} y2={toXY(a,100).y} stroke="rgba(255,255,255,0.12)" strokeWidth="1"/>
                      ))}
                      <polygon points={dataPoints} fill="rgba(99,102,241,0.18)" stroke="#6366f1" strokeWidth="2"/>
                      {kats.map((k, i) => {
                        const p = toXY(angles[i], k.avg_prozent || 0);
                        return <circle key={i} cx={p.x} cy={p.y} r="5" fill="#6366f1" stroke="rgba(0,0,0,0.4)" strokeWidth="1.5"/>;
                      })}
                      {kats.map((k, i) => {
                        const lp = toXY(angles[i], 122);
                        const shortLabel = k.label.split(' / ')[0].split(' ')[0];
                        return (
                          <text key={i} x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="rgba(255,255,255,0.45)">
                            {shortLabel}
                          </text>
                        );
                      })}
                      {kats.map((k, i) => {
                        const p = toXY(angles[i], Math.max((k.avg_prozent || 0) - 14, 8));
                        return (
                          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#a78bfa" fontWeight="700">
                            {k.avg_prozent}%
                          </text>
                        );
                      })}
                    </svg>
                  </div>
                </div>
                {/* Schwachstellen */}
                <div>
                  <h3 className="pv3-section-h3">
                    ⚠️ Schwachstellen
                    <span className="pvs-technik-basis"> · unter 75%</span>
                  </h3>
                  {schwach.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Alle Techniken über 75% — sehr gut!</p>
                  ) : (
                    <div className="pvs-schwach-list">
                      {schwach.map(t => (
                        <div key={t.inhalt_id} className="pvs-schwach-row">
                          <div className="pvs-schwach-info">
                            <div className="pvs-schwach-name">{t.titel}</div>
                            <div className="pvs-schwach-kat">{t.kategorie}</div>
                          </div>
                          <div className="pvs-schwach-bar-wrap">
                            <div className="pvs-bar-track">
                              <div className="pvs-bar-fill-red" style={{ width: `${t.avg_prozent}%` }}/>
                            </div>
                          </div>
                          <div className="pvs-schwach-score">{t.avg_prozent}%</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="pvs-sep" />

          {/* ── GRAD-SCHWIERIGKEIT + TOP-PRÜFLINGE ───────────────── */}
          {erwStats && (
            <div className="pvs-two-col pvs-mt-2">
              {/* Graduierungs-Schwierigkeit */}
              <div>
                <h3 className="pv3-section-h3">Schwierigkeit nach Prüfung</h3>
                {erwStats.grad_stats.length === 0 ? (
                  <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>Noch keine Daten</p>
                ) : (
                  <div className="pvs-grad-diff-list">
                    {erwStats.grad_stats.map((g, i) => {
                      const quote = g.gesamt > 0 ? Math.round(g.nicht_bestanden / g.gesamt * 100) : 0;
                      const col = quote === 0 ? '#4ade80' : quote < 20 ? '#fbbf24' : '#f87171';
                      return (
                        <div key={i} className="pvs-grad-diff-row">
                          <div className="pvs-grad-dot" style={{ background: g.farbe || '#ccc' }}/>
                          <div className="pvs-grad-diff-info">
                            <div className="pvs-grad-diff-name">{g.graduierung_name}</div>
                            <div className="pvs-grad-diff-stil">{g.stil_name}</div>
                          </div>
                          <div className="pvs-grad-diff-bar">
                            <div className="pvs-bar-track">
                              <div style={{ height:'100%', width:`${quote}%`, background:col, borderRadius:4, transition:'width 0.5s' }}/>
                            </div>
                          </div>
                          <div className="pvs-grad-diff-score" style={{ color: col }}>
                            {quote}%<span className="pvs-text-muted" style={{ fontSize:'0.65rem', display:'block' }}>{g.nicht_bestanden}/{g.gesamt}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Wiederholer */}
                {erwStats.zweiter_anlauf && erwStats.zweiter_anlauf.total_kombis > 0 && (
                  <div className="pvs-wiederholer-card stat-card">
                    <div className="pvs-kpi-label">Zweiter Anlauf</div>
                    <div style={{ display:'flex', gap:'1.5rem', alignItems:'center', marginTop:'0.4rem' }}>
                      <div>
                        <div className="pvs-kpi-value pvs-kpi-yellow">{erwStats.zweiter_anlauf.wiederholer_kombis}</div>
                        <div className="pvs-kpi-sub">Prüfungen wiederholt</div>
                      </div>
                      <div>
                        <div className="pvs-kpi-value pvs-kpi-cyan">{erwStats.zweiter_anlauf.extra_versuche}</div>
                        <div className="pvs-kpi-sub">Extra-Versuche</div>
                      </div>
                      <div>
                        <div className="pvs-kpi-value" style={{ color:'var(--text-muted)' }}>
                          {erwStats.zweiter_anlauf.total_kombis > 0
                            ? Math.round(erwStats.zweiter_anlauf.wiederholer_kombis / erwStats.zweiter_anlauf.total_kombis * 100)
                            : 0}%
                        </div>
                        <div className="pvs-kpi-sub">Wiederholquote</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {/* Top-Prüflinge */}
              <div>
                <h3 className="pv3-section-h3">🏅 Top-Prüflinge</h3>
                {erwStats.top_pruefling.length === 0 ? (
                  <p style={{ color:'var(--text-muted)', fontSize:'0.85rem' }}>Noch keine Punktzahlen erfasst</p>
                ) : (
                  <div className="pvs-top-list">
                    {erwStats.top_pruefling.map((p, i) => {
                      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
                      const col = i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--text-muted)';
                      return (
                        <div key={p.mitglied_id} className="pvs-top-row">
                          <div className="pvs-top-medal">{medal}</div>
                          <div className="pvs-top-info">
                            <div className="pvs-top-name">{p.vorname} {p.nachname}</div>
                            <div className="pvs-top-sub">{p.anzahl} {p.anzahl === 1 ? 'Prüfung' : 'Prüfungen'}</div>
                          </div>
                          <div className="pvs-top-bar">
                            <div className="pvs-bar-track">
                              <div style={{ height:'100%', width:`${p.avg_prozent}%`, background: col, borderRadius:4, opacity:0.85, transition:'width 0.5s' }}/>
                            </div>
                          </div>
                          <div className="pvs-top-score" style={{ color: col }}>{p.avg_prozent}%</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pvs-sep" />

          {/* ── INSIGHTS ──────────────────────────────────────────── */}
          <div className="pvs-mt-2">
            <h3 className="pv3-section-h3">Insights</h3>
            <div className="pv3-insights-grid">
              <div className="stat-card">
                <h4 className="pv2-warning-label">Beste Erfolgsquote</h4>
                {(() => {
                  const best = statistiken.nach_stil.length > 0
                    ? statistiken.nach_stil.reduce((b, c) => (c.bestanden / c.anzahl) > (b.bestanden / b.anzahl) ? c : b)
                    : null;
                  return best ? (
                    <>
                      <div className="pv2-heading-primary">{best.stil_name}</div>
                      <div className="pv3-insight-success">{Math.round(best.bestanden / best.anzahl * 100)}%</div>
                      <div className="pv2-muted-mt">{best.bestanden} von {best.anzahl} bestanden</div>
                    </>
                  ) : <div className="pv-text-muted">Keine Daten</div>;
                })()}
              </div>
              <div className="stat-card">
                <h4 className="pv2-warning-label">Aktivster Monat</h4>
                {(() => {
                  const mc = {};
                  abgeschlossenePruefungen.forEach(p => {
                    if (!p.pruefungsdatum) return;
                    const k = new Date(p.pruefungsdatum).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
                    mc[k] = (mc[k] || 0) + 1;
                  });
                  const top = Object.entries(mc).sort((a, b) => b[1] - a[1])[0];
                  return top ? (
                    <>
                      <div className="pv2-heading-primary">{top[0]}</div>
                      <div className="pv3-insight-purple">{top[1]}</div>
                      <div className="pv2-muted-mt">Prüfungen durchgeführt</div>
                    </>
                  ) : <div className="pv-text-muted">Keine Daten</div>;
                })()}
              </div>
              <div className="stat-card">
                <h4 className="pv2-warning-label">Nächste Prüfung</h4>
                {(() => {
                  const heute = new Date(); heute.setHours(0,0,0,0);
                  const zk = zugelassenePruefungen.filter(p => p.pruefungsdatum && new Date(p.pruefungsdatum) >= heute);
                  if (zk.length === 0) return <div className="pv-text-muted">Keine geplant</div>;
                  const gp = {};
                  zk.forEach(p => {
                    const k = `${p.pruefungsdatum}_${p.stil_name}`;
                    if (!gp[k]) gp[k] = { datum: p.pruefungsdatum, stil: p.stil_name || '—', anzahl: 0 };
                    gp[k].anzahl++;
                  });
                  const n = Object.values(gp).sort((a, b) => new Date(a.datum) - new Date(b.datum))[0];
                  return (
                    <>
                      <div className="pv2-heading-primary">{new Date(n.datum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                      <div className="pv3-insight-next-stil">{n.stil}</div>
                      <div className="pv2-muted-mt">{n.anzahl} Teilnehmer</div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* Ergebnis Modal */}
      {showErgebnisModal && selectedPruefung && createPortal(
        <div className="modal-overlay" onClick={() => setShowErgebnisModal(false)}>
          <div className="modal-content pv3-modal-max600" onClick={(e) => e.stopPropagation()}>
            <h2>Prüfungsergebnis eintragen</h2>
            <p className="pv3-modal-muted">
              <strong className="u-text-primary">{selectedPruefung.vorname} {selectedPruefung.nachname}</strong> - {selectedPruefung.stil_name}
            </p>

            {/* Bestanden Checkbox mit visueller Hervorhebung */}
            <div className="form-group pv2-mb-15">
              <label className={`pv3-ergebnis-label-box ${pruefungsErgebnis.bestanden ? 'pv3-ergebnis-label-box--bestanden' : 'pv3-ergebnis-label-box--failed'}`}>
                <input
                  type="checkbox"
                  checked={pruefungsErgebnis.bestanden}
                  onChange={(e) => setPruefungsErgebnis({ ...pruefungsErgebnis, bestanden: e.target.checked })}
                  className="pv3-checkbox-gold"
                />
                <div className="u-flex-1">
                  <strong className={`pv3-ergebnis-strong ${pruefungsErgebnis.bestanden ? 'pv3-ergebnis-strong--bestanden' : 'pv3-ergebnis-strong--failed'}`}>
                    {pruefungsErgebnis.bestanden ? '✓ Prüfung bestanden' : '✗ Prüfung nicht bestanden'}
                  </strong>
                </div>
              </label>
            </div>

            {/* Punktzahl */}
            <div className="u-grid-2col">
              <div className="form-group">
                <label>Erreichte Punktzahl</label>
                <input
                  type="number"
                  step="0.5"
                  value={pruefungsErgebnis.punktzahl}
                  onChange={(e) => setPruefungsErgebnis({ ...pruefungsErgebnis, punktzahl: e.target.value })}
                  className="form-input"
                  placeholder="0"
                />
              </div>
              <div className="form-group">
                <label>Max. Punktzahl</label>
                <input
                  type="number"
                  step="0.5"
                  value={pruefungsErgebnis.max_punktzahl}
                  onChange={(e) => setPruefungsErgebnis({ ...pruefungsErgebnis, max_punktzahl: e.target.value })}
                  className="form-input"
                  placeholder="100"
                />
              </div>
            </div>

            {/* Gurt-Auswahl mit Pfeil-Buttons */}
            <div className="form-group pv2-mb-15">
              <label className="pv3-ergebnis-label">
                Gurt nach Prüfung
                <span className="pv3-ergebnis-label-hint">
                  (↑↓ Pfeiltasten zum Navigieren)
                </span>
              </label>
              <div className="pv3-gurt-picker-box">
                {/* Pfeil nach unten */}
                <button
                  type="button"
                  onClick={() => handleGraduierungAendern('down')}
                  className="btn btn-sm btn-secondary pv3-gurt-arrow-btn"
                  disabled={pruefungsErgebnis.graduierung_nachher_index === 0}
                >
                  <ChevronDown size={20} />
                </button>

                {/* Gurt-Anzeige */}
                <div className="pv3-gurt-display-box">
                  <div
                    className="pv3-gurt-big-dot"
                    style={{ '--dot-color': pruefungsErgebnis.graduierung_nachher_farbe || '#e5e7eb' }}
                  >
                    <div className="pv3-gurt-shine" />
                  </div>
                  <div className="u-flex-1">
                    <div className="pv3-gurt-name">
                      {pruefungsErgebnis.graduierung_nachher_name || 'Keine Auswahl'}
                    </div>
                    <div className="pv-muted-sm">
                      {graduierungenFuerModal.length > 0
                        ? `Graduierung ${pruefungsErgebnis.graduierung_nachher_index + 1} von ${graduierungenFuerModal.length}`
                        : 'Keine Graduierungen verfügbar'}
                    </div>
                  </div>
                </div>

                {/* Pfeil nach oben */}
                <button
                  type="button"
                  onClick={() => handleGraduierungAendern('up')}
                  className="btn btn-sm btn-secondary pv3-gurt-arrow-btn"
                  disabled={pruefungsErgebnis.graduierung_nachher_index === graduierungenFuerModal.length - 1}
                >
                  <ChevronUp size={20} />
                </button>
              </div>
            </div>

            {/* Prüfer-Kommentar */}
            <div className="form-group pv2-mb-15">
              <label>Prüfer-Kommentar</label>
              <textarea
                value={pruefungsErgebnis.prueferkommentar}
                onChange={(e) => setPruefungsErgebnis({ ...pruefungsErgebnis, prueferkommentar: e.target.value })}
                className="form-input"
                rows="3"
                placeholder="Bemerkungen zur Prüfung, Stärken, Verbesserungspotenzial..."
              />
            </div>

            {/* Keyboard Shortcuts Hinweis */}
            <div className="pv3-shortcut-box">
              <div className="pv3-shortcut-title">
                <strong>⌨️ Tastenkombinationen:</strong>
              </div>
              <div className="pv3-shortcut-text">
                ↑↓ Pfeiltasten = Gurt wechseln • Strg+Enter = Speichern
              </div>
            </div>

            <div className="modal-actions">
              <button onClick={() => setShowErgebnisModal(false)} className="btn btn-secondary">
                Abbrechen
              </button>
              <button onClick={handleErgebnisEintragen} className="btn btn-primary">
                <Check size={18} className="pv2-mr-05" />
                Speichern (Strg+Enter)
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Batch-Ergebnis Modal */}
      {showBatchErgebnisModal && batchTermin && createPortal(
        <div className="modal-overlay" onClick={() => setShowBatchErgebnisModal(false)}>
          <div className="modal-content pv3-batch-modal" onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="pv3-bm-header">
              <h2 className="pv3-bm-title">Prüfungsergebnisse eintragen</h2>
              <p className="pv3-bm-subtitle">
                <strong>{new Date(batchTermin.datum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</strong>
                <span className="pv3-bm-sep">·</span>
                <span className="pv3-bm-stil">{batchTermin.stil_name}</span>
                <span className="pv3-bm-sep">·</span>
                {batchTermin.anzahl} Teilnehmer
              </p>
            </div>

            {/* Schnellauswahl + Settings */}
            <div className="pv3-bm-schnell">
              <span className="pv3-bm-schnell-label">Schnellauswahl:</span>
              <button onClick={() => setBatchAlleBestanden(true)} className="btn btn-sm pv3-bm-btn-pass">
                <Check size={13} /> Alle bestanden
              </button>
              <button onClick={() => setBatchAlleBestanden(false)} className="btn btn-sm pv3-bm-btn-fail">
                <X size={13} /> Alle nicht bestanden
              </button>
              <button onClick={() => setBatchAlleBestanden(null)} className="btn btn-sm" style={{marginLeft:'auto',opacity:0.7}}>
                ↺ Alle zurücksetzen
              </button>
              <button onClick={() => setShowBatchSettings(s => !s)} className="btn btn-sm btn-neutral" title="Prüfungs-Einstellungen für diese Prüfung">
                ⚙ Einstellungen
              </button>
            </div>

            {/* Einstellungen-Panel (per Prüfung) */}
            {showBatchSettings && (() => {
              const s = batchSettings || globalPruefSettings;
              const update = (key, val) => setBatchSettings({ ...s, [key]: val });
              const punkteOptionen = { ganz: 'Ganze Zahlen (1, 2, 3…)', halb: 'Halbe Punkte (0.5, 1, 1.5…)', dezimal: 'Zehntel (0.1, 0.2…)' };
              return (
                <div className="pv3-bm-settings-panel">
                  <div className="pv3-bm-settings-grid">
                    <label className="pv3-bm-settings-label">
                      Bestanden ab (Item-Punkte)
                      <input type="number" min="0" step="0.5" className="pv3-bm-settings-input"
                        value={s.bestanden_item_punkte}
                        onChange={e => update('bestanden_item_punkte', parseFloat(e.target.value) || 0)} />
                    </label>
                    <label className="pv3-bm-settings-label">
                      Bestanden gesamt ab (%)
                      <input type="number" min="0" max="100" step="5" className="pv3-bm-settings-input"
                        value={s.bestanden_gesamt_prozent}
                        onChange={e => update('bestanden_gesamt_prozent', parseFloat(e.target.value) || 0)} />
                    </label>
                    <label className="pv3-bm-settings-label">
                      Max. Punkte pro Item
                      <input type="number" min="1" step="1" className="pv3-bm-settings-input"
                        value={s.max_punkte_item}
                        onChange={e => update('max_punkte_item', parseFloat(e.target.value) || 10)} />
                    </label>
                    <label className="pv3-bm-settings-label">
                      Punkteschritte
                      <select className="pv3-bm-settings-select" value={s.punkte_modus}
                        onChange={e => update('punkte_modus', e.target.value)}>
                        {Object.entries(punkteOptionen).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                  </div>
                  <div style={{display:'flex',gap:'0.5rem',marginTop:'0.5rem'}}>
                    <button className="btn btn-sm btn-primary"
                      onClick={() => { saveGlobalPruefSettings(s); setSuccess('Einstellungen als Standard gespeichert'); setTimeout(() => setSuccess(''), 2000); }}>
                      Als Standard speichern
                    </button>
                    <button className="btn btn-sm btn-neutral" onClick={() => setBatchSettings(null)}>
                      Zurücksetzen
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Teilnehmer-Karten */}
            <div className="pv3-bm-list">
              {batchTermin.pruefungen.map((pruefung) => {
                const ergebnis = batchErgebnisse[pruefung.pruefung_id] || { bestanden: true, punktzahl: '', prueferkommentar: '' };
                const expanded = batchExpandedRows[pruefung.pruefung_id];
                const inhalte = batchPruefungsinhalte[pruefung.graduierung_nachher_id] || {};
                const hasInhalte = Object.keys(inhalte).length > 0;
                const katLabels = { kondition: '💪 Kondition', grundtechniken: '🥋 Grundtechniken', kata: '🎭 Kombinationen', kumite: '⚔️ Sparring', theorie: '📚 Theorie' };

                return (
                  <div key={pruefung.pruefung_id} className={`pv3-bm-card ${ergebnis.bestanden === true ? 'pv3-bm-card--pass' : ergebnis.bestanden === false ? 'pv3-bm-card--fail' : 'pv3-bm-card--offen'}`}>
                    {/* Kurzzeile */}
                    <div className="pv3-bm-row">
                      <div className="pv3-bm-name-col">
                        <span className="pv3-bm-name">{pruefung.vorname} {pruefung.nachname}</span>
                        <span className="pv3-bm-id">ID: {pruefung.mitglied_id}</span>
                      </div>
                      <div className="pv3-bm-gurt-col">
                        <div className="pv3-bm-gurt-dot" style={{ background: pruefung.farbe_vorher || '#6b7280' }} />
                        <span className="pv3-bm-gurt-label">{pruefung.graduierung_vorher || '–'}</span>
                        <span className="pv3-bm-arrow">→</span>
                        <div className="pv3-bm-gurt-dot" style={{ background: ergebnis.bestanden === true ? (pruefung.farbe_nachher || 'var(--primary)') : '#6b7280' }} />
                        <span className={`pv3-bm-gurt-label ${ergebnis.bestanden === false ? 'pv3-bm-gurt--fail' : ''}`}>{pruefung.graduierung_nachher}</span>
                      </div>
                      <div className="pv3-bm-ergebnis-col">
                        <div className="pv3-bm-3state">
                          <button
                            className={`pv3-bm-3state-btn pv3-bm-3state--offen${ergebnis.bestanden === null ? ' active' : ''}`}
                            onClick={() => setBatchErgebnisse({ ...batchErgebnisse, [pruefung.pruefung_id]: { ...ergebnis, bestanden: null } })}>
                            offen
                          </button>
                          <button
                            className={`pv3-bm-3state-btn pv3-bm-3state--pass${ergebnis.bestanden === true ? ' active' : ''}`}
                            onClick={() => setBatchErgebnisse({ ...batchErgebnisse, [pruefung.pruefung_id]: { ...ergebnis, bestanden: true } })}>
                            ✓ bestanden
                          </button>
                          <button
                            className={`pv3-bm-3state-btn pv3-bm-3state--fail${ergebnis.bestanden === false ? ' active' : ''}`}
                            onClick={() => setBatchErgebnisse({ ...batchErgebnisse, [pruefung.pruefung_id]: { ...ergebnis, bestanden: false } })}>
                            ✗ nicht bestanden
                          </button>
                        </div>
                      </div>
                      <div className="pv3-bm-inputs-col">
                        <input type="number" step="0.5" value={ergebnis.punktzahl} placeholder="Punkte"
                          className="pv3-bm-input" style={{ width: '80px' }}
                          onChange={(e) => setBatchErgebnisse({ ...batchErgebnisse, [pruefung.pruefung_id]: { ...ergebnis, punktzahl: e.target.value } })} />
                        <input type="text" value={ergebnis.prueferkommentar} placeholder="Kommentar..."
                          className="pv3-bm-input" style={{ flex: 1 }}
                          onChange={(e) => setBatchErgebnisse({ ...batchErgebnisse, [pruefung.pruefung_id]: { ...ergebnis, prueferkommentar: e.target.value } })} />
                        {hasInhalte && (
                          <button className="pv3-bm-expand-btn" onClick={() => setBatchExpandedRows({ ...batchExpandedRows, [pruefung.pruefung_id]: !expanded })}>
                            {expanded ? '▲ Inhalte' : '▼ Inhalte'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Expandierbare Prüfungsinhalte */}
                    {expanded && hasInhalte && (
                      <div className="pv3-bm-inhalte">
                        {Object.entries(inhalte).map(([kat, items]) => (
                          <div key={kat} className="pv3-bm-kat-block">
                            <div className="pv3-bm-kat-header">
                              <span className="pv3-bm-kat-title">{katLabels[kat] || kat}</span>
                              <button className="pv3-bm-kat-all-pass" onClick={() => markKatBestanden(pruefung.pruefung_id, kat, items)}>
                                ✓ Alle bestanden
                              </button>
                            </div>
                            <div className="pv3-bm-kat-items">
                              {items.map((item) => {
                                const inhaltId = item.inhalt_id || item.id;
                                const bew = batchInhaltBewertungen[pruefung.pruefung_id]?.[inhaltId];
                                const bestanden = bew === undefined ? ergebnis.bestanden : bew.bestanden;
                                const punktzahl = bew?.punktzahl ?? '';
                                const maxPunktzahl = bew?.max_punktzahl ?? 10;
                                const itmSettings = batchSettings || globalPruefSettings;
                                const updateBew = (patch) => {
                                  let finalPatch = { ...patch };
                                  // Auto-Threshold: Punkte >= Schwelle → automatisch bestanden
                                  if ('punktzahl' in patch && !('bestanden' in patch)) {
                                    const newPkt = parseFloat(patch.punktzahl);
                                    if (!isNaN(newPkt) && bestanden !== false) {
                                      finalPatch.bestanden = newPkt >= itmSettings.bestanden_item_punkte;
                                    }
                                  }
                                  const newPruefBew = {
                                    ...(batchInhaltBewertungen[pruefung.pruefung_id] || {}),
                                    [inhaltId]: { bestanden, punktzahl, max_punktzahl: maxPunktzahl, ...bew, ...finalPatch }
                                  };
                                  setBatchInhaltBewertungen(prev => ({ ...prev, [pruefung.pruefung_id]: newPruefBew }));
                                  // Auto-check Gesamtschwelle nach Punkte-Änderung
                                  if ('punktzahl' in patch) {
                                    const vals = Object.values(newPruefBew).filter(b => b.punktzahl !== '' && b.punktzahl !== undefined && b.punktzahl !== null);
                                    if (vals.length > 0) {
                                      const totalPkt = vals.reduce((s, b) => s + parseFloat(b.punktzahl || 0), 0);
                                      const totalMax = vals.reduce((s, b) => s + parseFloat(b.max_punktzahl || itmSettings.max_punkte_item || 10), 0);
                                      if (totalMax > 0) {
                                        const prozent = (totalPkt / totalMax) * 100;
                                        setBatchErgebnisse(prevErg => {
                                          const currErg = prevErg[pruefung.pruefung_id];
                                          if (currErg && (currErg.bestanden === null || currErg.bestanden === true)) {
                                            return { ...prevErg, [pruefung.pruefung_id]: { ...currErg, bestanden: prozent >= (itmSettings.bestanden_gesamt_prozent ?? 50) } };
                                          }
                                          return prevErg;
                                        });
                                      }
                                    }
                                  }
                                };
                                return (
                                  <div key={inhaltId} className={`pv3-bm-inhalt-item ${bestanden === true ? 'pv3-bm-inhalt--pass' : bestanden === false ? 'pv3-bm-inhalt--fail' : ''}`}>
                                    <div className="pv3-bm-inhalt-left">
                                      <button
                                        className={`pv3-bm-item-state ${bestanden === true ? 'pv3-bm-item-state--pass' : bestanden === false ? 'pv3-bm-item-state--fail' : 'pv3-bm-item-state--offen'}`}
                                        title="Klick: offen → bestanden → nicht bestanden"
                                        onClick={() => {
                                          const next = bestanden === null ? true : bestanden === true ? false : null;
                                          updateBew({ bestanden: next });
                                        }}
                                      >
                                        {bestanden === true ? '✓' : bestanden === false ? '✗' : '○'}
                                      </button>
                                      <span className="pv3-bm-inhalt-text">{item.titel || item.inhalt}</span>
                                    </div>
                                    <div className="pv3-bm-inhalt-punkte">
                                      <select
                                        className="pv3-bm-pkt-select"
                                        value={punktzahl === '' || punktzahl == null ? '' : punktzahl}
                                        onChange={(e) => {
                                          const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                          updateBew({ punktzahl: val });
                                        }}
                                      >
                                        <option value="">–</option>
                                        {genPunkteOptions(maxPunktzahl, itmSettings.punkte_modus).map(opt =>
                                          <option key={opt} value={opt}>{opt}</option>
                                        )}
                                      </select>
                                      <span className="pv3-bm-pkt-sep">/</span>
                                      <input
                                        type="number" min="1" step="1"
                                        value={maxPunktzahl}
                                        className="pv3-bm-pkt-max"
                                        onChange={(e) => updateBew({ max_punktzahl: parseFloat(e.target.value) || 10 })}
                                      />
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Freie Techniken */}
                              {(batchFreieTechniken[pruefung.pruefung_id]?.[kat] || []).map(item => {
                                const bew = batchInhaltBewertungen[pruefung.pruefung_id]?.[item.id];
                                const bestanden = bew?.bestanden ?? ergebnis.bestanden;
                                const punktzahl = bew?.punktzahl ?? '';
                                const maxPunktzahl = bew?.max_punktzahl ?? 10;
                                const updateFreiBew = (patch) => setBatchInhaltBewertungen(prev => ({
                                  ...prev,
                                  [pruefung.pruefung_id]: {
                                    ...(prev[pruefung.pruefung_id] || {}),
                                    [item.id]: { bestanden, punktzahl, max_punktzahl: maxPunktzahl, ...bew, ...patch }
                                  }
                                }));
                                const freiSettings = batchSettings || globalPruefSettings;
                                return (
                                  <div key={item.id} className={`pv3-bm-inhalt-item pv3-bm-inhalt-frei ${bestanden === true ? 'pv3-bm-inhalt--pass' : bestanden === false ? 'pv3-bm-inhalt--fail' : ''}`}>
                                    <div className="pv3-bm-inhalt-left">
                                      <button
                                        className={`pv3-bm-item-state ${bestanden === true ? 'pv3-bm-item-state--pass' : bestanden === false ? 'pv3-bm-item-state--fail' : 'pv3-bm-item-state--offen'}`}
                                        title="Klick: offen → bestanden → nicht bestanden"
                                        onClick={() => {
                                          const next = bestanden === null ? true : bestanden === true ? false : null;
                                          updateFreiBew({ bestanden: next });
                                        }}
                                      >
                                        {bestanden === true ? '✓' : bestanden === false ? '✗' : '○'}
                                      </button>
                                      <span className="pv3-bm-inhalt-text">{item.titel}</span>
                                    </div>
                                    <div className="pv3-bm-inhalt-punkte">
                                      <select
                                        className="pv3-bm-pkt-select"
                                        value={punktzahl === '' || punktzahl == null ? '' : punktzahl}
                                        onChange={(e) => {
                                          const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                                          updateFreiBew({ punktzahl: val });
                                        }}
                                      >
                                        <option value="">–</option>
                                        {genPunkteOptions(maxPunktzahl, freiSettings.punkte_modus).map(opt =>
                                          <option key={opt} value={opt}>{opt}</option>
                                        )}
                                      </select>
                                      <span className="pv3-bm-pkt-sep">/</span>
                                      <input type="number" min="1" step="1" value={maxPunktzahl}
                                        className="pv3-bm-pkt-max"
                                        onChange={(e) => updateFreiBew({ max_punktzahl: parseFloat(e.target.value) || 10 })} />
                                      <button className="pv3-bm-frei-remove"
                                        onClick={() => removeFreieTechnik(pruefung.pruefung_id, kat, item.id)}
                                        title="Entfernen">×</button>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* + Freie Technik hinzufügen */}
                              {batchFreiInputKey === `${pruefung.pruefung_id}_${kat}` ? (
                                <div className="pv3-bm-frei-input-row">
                                  <input
                                    autoFocus
                                    type="text"
                                    value={batchFreiInputText}
                                    className="pv3-bm-frei-input"
                                    placeholder="Technik-Bezeichnung..."
                                    onChange={e => setBatchFreiInputText(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') addFreieTechnik(pruefung.pruefung_id, kat, batchFreiInputText);
                                      if (e.key === 'Escape') { setBatchFreiInputKey(null); setBatchFreiInputText(''); }
                                    }}
                                  />
                                  <button className="pv3-bm-frei-confirm"
                                    onClick={() => addFreieTechnik(pruefung.pruefung_id, kat, batchFreiInputText)}>✓</button>
                                  <button className="pv3-bm-frei-cancel"
                                    onClick={() => { setBatchFreiInputKey(null); setBatchFreiInputText(''); }}>✕</button>
                                </div>
                              ) : (
                                <button className="pv3-bm-frei-plus"
                                  onClick={() => { setBatchFreiInputKey(`${pruefung.pruefung_id}_${kat}`); setBatchFreiInputText(''); }}>
                                  + Technik
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Zusammenfassung */}
            <div className="pv3-bm-summary">
              <div className="pv3-bm-summary-stats">
                <span className="pv3-bm-stat-pass">{Object.values(batchErgebnisse).filter(e => e.bestanden === true).length}</span>
                <span className="pv3-bm-stat-label">bestanden</span>
                <span className="pv3-bm-stat-sep">·</span>
                <span className="pv3-bm-stat-fail">{Object.values(batchErgebnisse).filter(e => e.bestanden === false).length}</span>
                <span className="pv3-bm-stat-label">nicht bestanden</span>
                {Object.values(batchErgebnisse).filter(e => e.bestanden === null).length > 0 && (<>
                  <span className="pv3-bm-stat-sep">·</span>
                  <span className="pv3-bm-stat-offen">{Object.values(batchErgebnisse).filter(e => e.bestanden === null).length}</span>
                  <span className="pv3-bm-stat-label">offen</span>
                </>)}
              </div>
              <div className="pv3-bm-stat-quote">
                {(() => {
                  const entschieden = Object.values(batchErgebnisse).filter(e => e.bestanden !== null);
                  const bestanden = entschieden.filter(e => e.bestanden === true).length;
                  return entschieden.length > 0
                    ? `Bestehensquote: ${Math.round((bestanden / entschieden.length) * 100)}% (${entschieden.length} von ${Object.values(batchErgebnisse).length} bewertet)`
                    : 'Noch keine Ergebnisse eingetragen';
                })()}
              </div>
            </div>

            <div className="pv3-bm-sticky-actions">
              <button onClick={() => setShowBatchErgebnisModal(false)} className="btn btn-secondary">Abbrechen</button>
              <button onClick={handleBatchErgebnisSpeichern} className="btn btn-primary" disabled={loading}>
                <Check size={16} /> {loading ? 'Speichern...' : (() => {
                  const offen = Object.values(batchErgebnisse).filter(e => e.bestanden === null).length;
                  return offen > 0 ? `Speichern (${offen} offen)` : 'Alle Ergebnisse speichern';
                })()}
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Neuer Termin Modal - CACHE BREAK v8.0 GOLDEN HEADER */}
      {showNeuerTerminModal && createPortal(
        <div
          className="pv3-modal-overlay-dark"
          onClick={() => { setShowNeuerTerminModal(false); setTerminStep(1); }}
        >
          <div
            className="pv3-modal-dark"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="pv3-modal-header">
              <h2>
                Neuer Prüfungstermin
              </h2>
            </div>

            {/* Progress Bar */}
            <div className="pv3-modal-progress-section">
              {[
                { num: 1, label: 'Grunddaten' },
                { num: 2, label: 'Organisation' },
                { num: 3, label: 'Zusatzinfos' }
              ].map((step, idx) => (
                <div key={step.num} className="pv3-modal-step-wrapper">
                  {/* Connecting Line */}
                  {idx > 0 && (
                    <div className={`pv3-step-connector ${terminStep > step.num - 1 ? 'pv3-step-connector--active' : ''}`} />
                  )}

                  {/* Circle */}
                  <div className={`pv3-step-circle ${terminStep >= step.num ? 'pv3-step-circle--active' : ''}`}>
                    {step.num}
                  </div>

                  {/* Label */}
                  <div className={`pv3-step-label ${terminStep === step.num ? 'pv3-step-label--active' : ''}`}>
                    {step.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Content */}
            <div className="pv3-modal-content-area">
              {/* Step 1: Grunddaten */}
              {terminStep === 1 && (
                <div>
                  <div className="pv2-mb-1">
                    <label className="pv-form-label">
                      Kampfkunst-Stil *
                    </label>
                    <select
                      value={neuerTermin.stil_id}
                      onChange={(e) => setNeuerTermin({ ...neuerTermin, stil_id: e.target.value })}
                      className="pv3-dark-input"
                    >
                      <option value="">Bitte wählen...</option>
                      {stile.map(stil => (
                        <option key={stil.stil_id} value={stil.stil_id}>{stil.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="u-grid-2col">
                    <div>
                      <label className="pv-form-label">
                        Prüfungsdatum *
                      </label>
                      <input
                        type="date"
                        value={neuerTermin.pruefungsdatum}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefungsdatum: e.target.value })}
                        className="pv3-dark-input"
                      />
                    </div>
                    <div>
                      <label className="pv-form-label">
                        Uhrzeit
                      </label>
                      <input
                        type="time"
                        value={neuerTermin.pruefungszeit}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefungszeit: e.target.value })}
                        className="pv3-dark-input"
                      />
                    </div>
                  </div>

                  <div className="pv2-grid-2col-1">
                    <div>
                      <label className="pv-form-label">
                        Prüfungsort
                      </label>
                      <input
                        type="text"
                        value={neuerTermin.pruefungsort}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefungsort: e.target.value })}
                        placeholder="z.B. Dojo Haupthalle"
                        className="pv3-dark-input"
                      />
                    </div>
                    <div>
                      <label className="pv-form-label">
                        Prüfer
                      </label>
                      <input
                        type="text"
                        value={neuerTermin.pruefer_name}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefer_name: e.target.value })}
                        placeholder="z.B. Meister Schmidt"
                        className="pv3-dark-input"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Organisation */}
              {terminStep === 2 && (
                <div>
                  <div className="pv2-grid-2col-1">
                    <div>
                      <label className="pv-form-label">
                        Prüfungsgebühr (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={neuerTermin.pruefungsgebuehr}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, pruefungsgebuehr: e.target.value })}
                        placeholder="0.00"
                        className="pv3-dark-input"
                      />
                    </div>
                    <div>
                      <label className="pv-form-label">Zahlungsart Prüfungsgebühr</label>
                      <select
                        value={neuerTermin.zahlungsart || ''}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, zahlungsart: e.target.value })}
                        className="pv3-dark-input"
                      >
                        <option value="">— Bitte wählen —</option>
                        <option value="bar">Barzahlung</option>
                        <option value="lastschrift">SEPA-Lastschrift</option>
                      </select>
                    </div>
                    <div>
                      <label className="pv-form-label">
                        Anmeldefrist
                      </label>
                      <input
                        type="date"
                        value={neuerTermin.anmeldefrist}
                        onChange={(e) => setNeuerTermin({ ...neuerTermin, anmeldefrist: e.target.value })}
                        className="pv3-dark-input"
                      />
                    </div>
                  </div>
                  {/* Validierungshinweis */}
                  {neuerTermin.anmeldefrist && neuerTermin.pruefungsdatum &&
                   new Date(neuerTermin.anmeldefrist) > new Date(neuerTermin.pruefungsdatum) && (
                    <div className="pv3-validation-error">
                      <span>⚠️</span>
                      <span>Die Anmeldefrist muss vor dem Prüfungsdatum liegen. Bitte passen Sie das Datum an.</span>
                    </div>
                  )}

                  {/* Öffentlich veröffentlichen */}
                  <div className="pv3-oeffentlich-row">
                    <input
                      type="checkbox"
                      id="neuerTermin_oeffentlich"
                      checked={neuerTermin.oeffentlich}
                      onChange={(e) => setNeuerTermin({ ...neuerTermin, oeffentlich: e.target.checked })}
                      className="pv2-checkbox"
                    />
                    <label htmlFor="neuerTermin_oeffentlich" className="pv3-oeffentlich-label">
                      🌐 Auf tda-intl.com veröffentlichen
                    </label>
                  </div>
                  <div className="pv3-oeffentlich-row">
                    <input
                      type="checkbox"
                      id="neuerTermin_oeffentlich_vib"
                      checked={neuerTermin.oeffentlich_vib}
                      onChange={(e) => setNeuerTermin({ ...neuerTermin, oeffentlich_vib: e.target.checked })}
                      className="pv2-checkbox"
                    />
                    <label htmlFor="neuerTermin_oeffentlich_vib" className="pv3-oeffentlich-label">
                      🌐 Auf tda-vib.de veröffentlichen
                    </label>
                  </div>
                </div>
              )}

              {/* Step 3: Zusatzinfos */}
              {terminStep === 3 && (
                <div className="pv3-step3-grid">
                  <div>
                    <label className="pv-form-label">
                      Bemerkungen
                    </label>
                    <textarea
                      value={neuerTermin.bemerkungen}
                      onChange={(e) => setNeuerTermin({ ...neuerTermin, bemerkungen: e.target.value })}
                      placeholder="Zusätzliche Informationen..."
                      rows="3"
                      className="pv3-dark-textarea"
                    />
                  </div>
                  <div>
                    <label className="pv-form-label">
                      Teilnahmebedingungen
                    </label>
                    <textarea
                      value={neuerTermin.teilnahmebedingungen}
                      onChange={(e) => setNeuerTermin({ ...neuerTermin, teilnahmebedingungen: e.target.value })}
                      placeholder="Bedingungen für Teilnehmer..."
                      rows="4"
                      className="pv3-dark-textarea"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="pv3-modal-footer">
              <button
                onClick={() => { setShowNeuerTerminModal(false); setTerminStep(1); }}
                className="pv3-modal-btn-cancel"
              >
                Abbrechen
              </button>

              <div className="u-flex-gap-sm">
                {terminStep > 1 && (
                  <button
                    onClick={() => setTerminStep(terminStep - 1)}
                    className="pv3-modal-btn-cancel"
                  >
                    Zurück
                  </button>
                )}

                {terminStep < 3 ? (
                  <button
                    onClick={() => setTerminStep(terminStep + 1)}
                    disabled={
                      (terminStep === 1 && (!neuerTermin.stil_id || !neuerTermin.pruefungsdatum)) ||
                      (terminStep === 2 && neuerTermin.anmeldefrist && neuerTermin.pruefungsdatum &&
                       new Date(neuerTermin.anmeldefrist) > new Date(neuerTermin.pruefungsdatum))
                    }
                    className="pv3-modal-btn-weiter"
                  >
                    Weiter
                  </button>
                ) : (
                  <button
                    onClick={() => { handleNeuerTerminErstellen(); setTerminStep(1); }}
                    className="pv3-modal-btn-submit"
                  >
                    <Calendar size={18} className="pv2-mr-05" />
                    Termin erstellen
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      , document.body)}
      {/* Termin bearbeiten Modal - CACHE BREAK v6.0 NO PADDING */}
      {showEditTerminModal && editTermin && createPortal(
        <div
          className="pv3-edit-modal-overlay"
          onClick={() => setShowEditTerminModal(false)}
        >
          <div
            className="pv3-edit-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="pv3-edit-modal-h2">Prüfungstermin bearbeiten</h2>
            <p className="pv3-edit-modal-sub">
              Bearbeiten Sie die Details des Prüfungstermins.
            </p>

            {/* Grunddaten */}
            <h3 className="pv3-edit-section-heading">Grunddaten</h3>

            <div className="pv2-grid-2col-08">
              {/* Stil-Auswahl */}
              <div className="pv2-grid-span-full">
                <label className="pv-field-label">
                  Kampfkunst-Stil *
                </label>
                <select
                  value={editTermin.stil_id}
                  onChange={(e) => setEditTermin({ ...editTermin, stil_id: e.target.value })}
                  className="pv3-dark-input-sm"
                  required
                >
                  <option value="">Bitte wählen...</option>
                  {stile.map(stil => (
                    <option key={stil.stil_id} value={stil.stil_id}>
                      {stil.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Prüfungsdatum */}
              <div>
                <label className="pv-field-label">
                  Prüfungsdatum *
                </label>
                <input
                  type="date"
                  value={editTermin.pruefungsdatum}
                  onChange={(e) => setEditTermin({ ...editTermin, pruefungsdatum: e.target.value })}
                  className="pv3-dark-input-sm"
                  required
                />
              </div>

              {/* Uhrzeit */}
              <div>
                <label className="pv-field-label">
                  Uhrzeit
                </label>
                <input
                  type="time"
                  value={editTermin.pruefungszeit}
                  onChange={(e) => setEditTermin({ ...editTermin, pruefungszeit: e.target.value })}
                  className="pv3-dark-input-sm"
                />
              </div>

              {/* Prüfungsort */}
              <div>
                <label className="pv-field-label">
                  Prüfungsort
                </label>
                <input
                  type="text"
                  value={editTermin.pruefungsort}
                  onChange={(e) => setEditTermin({ ...editTermin, pruefungsort: e.target.value })}
                  className="pv3-dark-input-sm"
                  placeholder="z.B. Dojo Haupthalle, Sporthalle XYZ"
                />
              </div>

              {/* Prüfer */}
              <div>
                <label className="pv-field-label">
                  Prüfer
                </label>
                <input
                  type="text"
                  value={editTermin.pruefer_name || ''}
                  onChange={(e) => setEditTermin({ ...editTermin, pruefer_name: e.target.value })}
                  className="pv3-dark-input-sm"
                  placeholder="z.B. Meister Schmidt"
                />
              </div>
            </div>

            {/* Organisatorisches */}
            <h3 className="pv3-edit-section-heading-mt">Organisatorisches</h3>

            <div className="pv2-grid-2col-08">
              {/* Prüfungsgebühr */}
              <div>
                <label className="pv-field-label">
                  Prüfungsgebühr (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={editTermin.pruefungsgebuehr}
                  onChange={(e) => setEditTermin({ ...editTermin, pruefungsgebuehr: e.target.value })}
                  className="pv3-dark-input-sm"
                  placeholder="0.00"
                />
              </div>

              {/* Anmeldefrist */}
              <div>
                <label className="pv-field-label">
                  Anmeldefrist
                </label>
                <input
                  type="date"
                  value={editTermin.anmeldefrist}
                  onChange={(e) => setEditTermin({ ...editTermin, anmeldefrist: e.target.value })}
                  className="pv3-dark-input-sm"
                />
              </div>
            </div>

            {/* Öffentlich veröffentlichen (Edit) */}
            <div className="pv3-edit-oeffentlich-row">
              <input
                type="checkbox"
                id="editTermin_oeffentlich"
                checked={editTermin.oeffentlich || false}
                onChange={(e) => setEditTermin({ ...editTermin, oeffentlich: e.target.checked })}
                className="pv2-checkbox"
              />
              <label htmlFor="editTermin_oeffentlich" className="pv3-edit-oeffentlich-label">
                🌐 Auf tda-intl.com veröffentlichen
              </label>
            </div>
            <div className="pv3-edit-oeffentlich-row">
              <input
                type="checkbox"
                id="editTermin_oeffentlich_vib"
                checked={editTermin.oeffentlich_vib || false}
                onChange={(e) => setEditTermin({ ...editTermin, oeffentlich_vib: e.target.checked })}
                className="pv2-checkbox"
              />
              <label htmlFor="editTermin_oeffentlich_vib" className="pv3-edit-oeffentlich-label">
                🌐 Auf tda-vib.de veröffentlichen
              </label>
            </div>

            {/* Zusätzliche Informationen */}
            <h3 className="pv3-edit-section-heading-mt">Zusätzliche Informationen</h3>

            <div className="pv3-edit-textarea-grid">
              {/* Bemerkungen */}
              <div>
                <label className="pv-field-label">
                  Bemerkungen
                </label>
                <textarea
                  value={editTermin.bemerkungen}
                  onChange={(e) => setEditTermin({ ...editTermin, bemerkungen: e.target.value })}
                  className="pv3-dark-textarea-sm"
                  rows="2"
                  placeholder="Zusätzliche Informationen zur Prüfung..."
                />
              </div>

              {/* Teilnahmebedingungen */}
              <div>
                <label className="pv-field-label">
                  Teilnahmebedingungen
                </label>
                <textarea
                  value={editTermin.teilnahmebedingungen}
                  onChange={(e) => setEditTermin({ ...editTermin, teilnahmebedingungen: e.target.value })}
                  className="pv3-dark-textarea-sm"
                  rows="3"
                  placeholder="Beispiel:&#10;- Vollständige Trainingsausrüstung mitbringen&#10;- Pünktliches Erscheinen erforderlich&#10;- Prüfungsgebühr vorab überweisen"
                />
              </div>
            </div>

            <div className="pv3-edit-footer">
              <button
                onClick={() => setShowEditTerminModal(false)}
                className="pv3-edit-btn-cancel"
              >
                Abbrechen
              </button>
              <button
                onClick={handleTerminAktualisieren}
                disabled={!editTermin.pruefungsdatum}
                className="pv3-modal-btn-submit pv3-modal-btn-save"
              >
                <Edit size={18} className="pv2-mr-05" />
                Änderungen speichern
              </button>
            </div>
          </div>
        </div>
      , document.body)}
      {/* Termin-Auswahl Modal */}
      {terminAuswahlModal.open && createPortal(
        <div
          className="pv3-auswahl-modal-overlay"
          onClick={() => setTerminAuswahlModal({ open: false, kandidat: null, termine: [], isAusnahme: false })}
        >
          <div
            className="pv3-auswahl-modal-box"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="pv2-mb-05">
              {terminAuswahlModal.isAusnahme ? 'Ausnahme-Zulassung' : 'Prüfungstermin wählen'}
            </h3>
            <p className="pv3-auswahl-muted-p">
              {terminAuswahlModal.kandidat?.vorname} {terminAuswahlModal.kandidat?.nachname} —{' '}
              {terminAuswahlModal.kandidat?.stil_name}
              {terminAuswahlModal.isAusnahme && (
                <span className="pv3-auswahl-warning-span">
                  ⚠️ Zeitliche Voraussetzungen nicht erfüllt
                </span>
              )}
            </p>
            <div className="u-flex-col-md">
              {terminAuswahlModal.termine.map((termin, idx) => (
                <button
                  key={idx}
                  onClick={() => handleTerminAuswahlSelected(termin)}
                  className="pv3-auswahl-btn"
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color, #333)'}
                >
                  <div className="pv3-auswahl-btn-date">
                    {new Date(termin.datum).toLocaleDateString('de-DE', {
                      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
                    })}
                  </div>
                  <div className="pv3-auswahl-btn-meta">
                    {termin.zeit !== 'Nicht festgelegt' && `🕐 ${termin.zeit} Uhr`}
                    {termin.zeit !== 'Nicht festgelegt' && termin.ort !== 'Nicht festgelegt' && '  '}
                    {termin.ort !== 'Nicht festgelegt' && `📍 ${termin.ort}`}
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setTerminAuswahlModal({ open: false, kandidat: null, termine: [], isAusnahme: false })}
              className="pv3-auswahl-cancel"
            >
              Abbrechen
            </button>
          </div>
        </div>
      , document.body)}

      {/* Teilnehmerliste Druck-Auswahl-Modal */}
      {druckAuswahlModal.open && druckAuswahlModal.termin && (() => {
        const VORLAGEN = [
          { key: 'pruefungsurkunde',      label: 'Standard',            img: null },
          { key: 'kickboxen_schuelergrad', label: 'Kickboxen',          img: '/assets/urkunde_kickboxen.jpg' },
          { key: 'aikido_schuelergrad',    label: 'Aikido',             img: '/assets/urkunde_aikido.jpg' },
          { key: 'board_of_black_belts',  label: 'Board of Black Belts', img: '/assets/urkunde_bobb.jpg' },
        ];
        const closeModal = () => setDruckAuswahlModal({ open: false, termin: null, selected: [], vorlage: 'pruefungsurkunde' });
        return createPortal(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}
            onClick={closeModal}>
            <div style={{background:'#1e1e35',borderRadius:'12px',width:'100%',maxWidth:'580px',boxShadow:'0 20px 60px rgba(0,0,0,0.7)',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden'}}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{background:'rgba(99,102,241,0.15)',borderBottom:'1px solid rgba(99,102,241,0.3)',padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontWeight:700,color:'#e2e8f0',fontSize:'15px'}}>
                    <Printer size={16} style={{display:'inline',marginRight:'8px',verticalAlign:'middle'}} />
                    Urkunden drucken
                  </div>
                  <div style={{fontSize:'12px',color:'#94a3b8',marginTop:'3px'}}>
                    {new Date(druckAuswahlModal.termin.datum).toLocaleDateString('de-DE', {weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
                    {' · '}{druckAuswahlModal.termin.stil_name}
                  </div>
                </div>
                <button onClick={closeModal}
                  style={{background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',borderRadius:'50%',width:'28px',height:'28px',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  ×
                </button>
              </div>

              {/* Vorlagen-Auswahl */}
              <div style={{padding:'14px 20px 0'}}>
                <div style={{fontSize:'11px',fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>
                  Urkunden-Vorlage
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'8px'}}>
                  {VORLAGEN.map(v => {
                    const selected = druckAuswahlModal.vorlage === v.key;
                    return (
                      <button key={v.key}
                        onClick={() => setDruckAuswahlModal(m => ({...m, vorlage: v.key}))}
                        style={{
                          background: selected ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                          border: `2px solid ${selected ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                          borderRadius:'8px', padding:'6px', cursor:'pointer',
                          display:'flex', flexDirection:'column', alignItems:'center', gap:'6px',
                          transition:'all 0.15s',
                        }}>
                        {/* Thumbnail */}
                        <div style={{
                          width:'100%', aspectRatio:'297/210', borderRadius:'4px', overflow:'hidden',
                          background: v.img ? 'transparent' : 'rgba(255,255,255,0.06)',
                          border:'1px solid rgba(255,255,255,0.08)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          position:'relative',
                        }}>
                          {v.img
                            ? <img src={v.img} alt={v.label} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
                            : (
                              /* Standard: stilisierte Text-Urkunde als Platzhalter */
                              <div style={{width:'100%',height:'100%',background:'#faf7f0',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'3px',padding:'4px'}}>
                                <div style={{width:'60%',height:'2px',background:'#ccc',borderRadius:'1px'}} />
                                <div style={{width:'40%',height:'2px',background:'#ccc',borderRadius:'1px'}} />
                                <div style={{width:'50%',height:'2px',background:'#ccc',borderRadius:'1px',marginTop:'4px'}} />
                              </div>
                            )
                          }
                          {selected && (
                            <div style={{position:'absolute',top:'3px',right:'3px',background:'#6366f1',borderRadius:'50%',width:'14px',height:'14px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',color:'#fff'}}>✓</div>
                          )}
                        </div>
                        <span style={{fontSize:'10px',color: selected ? '#a5b4fc' : '#94a3b8',fontWeight: selected ? 600 : 400,textAlign:'center',lineHeight:1.2}}>
                          {v.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Kandidaten-Liste */}
              <div style={{padding:'14px 20px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'10px',fontSize:'12px',color:'#94a3b8'}}>
                  <span>{druckAuswahlModal.selected.length} von {druckAuswahlModal.termin.pruefungen.length} ausgewählt</span>
                  <div style={{display:'flex',gap:'12px'}}>
                    <button onClick={() => setDruckAuswahlModal(m => ({...m, selected: m.termin.pruefungen.map(p => p.pruefung_id)}))}
                      style={{background:'none',border:'none',color:'#818cf8',cursor:'pointer',fontSize:'12px',textDecoration:'underline'}}>Alle</button>
                    <button onClick={() => setDruckAuswahlModal(m => ({...m, selected: []}))}
                      style={{background:'none',border:'none',color:'#818cf8',cursor:'pointer',fontSize:'12px',textDecoration:'underline'}}>Keine</button>
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'6px',maxHeight:'260px',overflowY:'auto'}}>
                  {druckAuswahlModal.termin.pruefungen.map(p => {
                    const checked = druckAuswahlModal.selected.includes(p.pruefung_id);
                    return (
                      <label key={p.pruefung_id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 10px',background: checked ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)',borderRadius:'8px',border: `1px solid ${checked ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,cursor:'pointer',transition:'all 0.15s'}}>
                        <input type="checkbox" checked={checked}
                          onChange={() => setDruckAuswahlModal(m => ({
                            ...m,
                            selected: checked ? m.selected.filter(id => id !== p.pruefung_id) : [...m.selected, p.pruefung_id]
                          }))}
                          style={{width:'16px',height:'16px',accentColor:'#6366f1',cursor:'pointer'}} />
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontWeight:600,color:'#e2e8f0',fontSize:'13px'}}>{p.nachname}, {p.vorname}</div>
                          <div style={{fontSize:'11px',color:'#94a3b8'}}>
                            {p.graduierung_vorher} → {p.graduierung_nachher}
                            {p.geburtsdatum && <span style={{marginLeft:'8px'}}>* {new Date(p.geburtsdatum).toLocaleDateString('de-DE')}</span>}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div style={{padding:'12px 20px 16px',borderTop:'1px solid rgba(255,255,255,0.08)',display:'flex',gap:'10px',justifyContent:'flex-end'}}>
                <button onClick={closeModal}
                  style={{padding:'8px 16px',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'8px',color:'#94a3b8',cursor:'pointer',fontSize:'13px'}}>
                  Abbrechen
                </button>
                <button
                  disabled={druckAuswahlModal.selected.length === 0}
                  onClick={() => {
                    const ausgewaehlt = druckAuswahlModal.termin.pruefungen.filter(p => druckAuswahlModal.selected.includes(p.pruefung_id));
                    druckeUrkunden(ausgewaehlt, druckAuswahlModal.termin, druckAuswahlModal.vorlage);
                    closeModal();
                  }}
                  style={{padding:'8px 20px',background: druckAuswahlModal.selected.length === 0 ? 'rgba(99,102,241,0.3)' : '#6366f1',border:'none',borderRadius:'8px',color:'#fff',cursor: druckAuswahlModal.selected.length === 0 ? 'default' : 'pointer',fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',gap:'6px'}}>
                  <Printer size={14} />
                  {druckAuswahlModal.selected.length} Person{druckAuswahlModal.selected.length !== 1 ? 'en' : ''} drucken
                </button>
              </div>

            </div>
          </div>
        , document.body);
      })()}

      {/* Drucken Vorschau-Modal */}
      {showDruckPreview && druckPreviewData && createPortal(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:9999,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start',overflowY:'auto',padding:'24px 16px'}} onClick={() => setShowDruckPreview(false)}>
          <div style={{background:'#fff',borderRadius:'8px',width:'100%',maxWidth:'210mm',boxShadow:'0 20px 60px rgba(0,0,0,0.5)'}} onClick={e => e.stopPropagation()}>
            {/* Toolbar */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px',borderBottom:'1px solid #e0e0e0',background:'#f5f5f5',borderRadius:'8px 8px 0 0'}}>
              <span style={{fontWeight:600,color:'#333',fontSize:'15px'}}>Vorschau — Prüfungsprotokoll</span>
              <div style={{display:'flex',gap:'10px',flexWrap:'wrap'}}>
                {druckPreviewData?.pruefung?.mitglied_id && (() => {
                  const sendState = protokollSendStatus[druckPreviewData.pruefung.pruefung_id];
                  return (
                    <button
                      onClick={handleProtokolInsDashboard}
                      disabled={sendState === 'sending'}
                      style={{padding:'8px 16px',background: sendState === 'sent' ? '#16a34a' : 'rgba(34,197,94,0.15)',color: sendState === 'sent' ? '#fff' : '#16a34a',border:`1px solid ${sendState === 'sent' ? '#16a34a' : 'rgba(34,197,94,0.5)'}`,borderRadius:'6px',cursor:'pointer',fontWeight:600,fontSize:'14px',display:'flex',alignItems:'center',gap:'6px'}}
                    >
                      {sendState === 'sending' ? '⏳ Speichern…' : sendState === 'sent' ? '✓ Im Dashboard' : '📋 Ins Mitglieder-Dashboard'}
                    </button>
                  );
                })()}
                <button onClick={triggerDruck} style={{padding:'8px 20px',background:'#1a1a1a',color:'#fff',border:'none',borderRadius:'6px',cursor:'pointer',fontWeight:600,fontSize:'14px',display:'flex',alignItems:'center',gap:'6px'}}>
                  🖨️ Drucken
                </button>
                <button onClick={() => setShowDruckPreview(false)} style={{padding:'8px 14px',background:'#e0e0e0',color:'#333',border:'none',borderRadius:'6px',cursor:'pointer',fontWeight:500,fontSize:'14px'}}>
                  ✕ Schließen
                </button>
              </div>
            </div>
            {/* Dokument-Preview */}
            <div style={{padding:'20mm 16mm',color:'#1a1a1a'}} dangerouslySetInnerHTML={{ __html: druckPreviewData.html || '' }} />
          </div>
        </div>
      , document.body)}

      {/* Modal: Externe Anmeldung bearbeiten */}
      {showEditAnmeldungModal && editAnmeldung && createPortal(
        <div className="pv3-modal-overlay-dark" onClick={() => setShowEditAnmeldungModal(false)}>
          <div className="pv3-modal-dark" style={{maxWidth:'520px'}} onClick={e => e.stopPropagation()}>
            <div className="pv3-modal-header">
              <h2>Anmeldung bearbeiten</h2>
              <p style={{color:'var(--text-muted)',fontSize:'13px',marginTop:'4px'}}>{editAnmeldung.vorname} {editAnmeldung.nachname}</p>
            </div>
            <div className="pv3-modal-body">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                <div>
                  <label className="form-label">Vorname</label>
                  <input className="form-input" value={editAnmeldungForm.vorname} onChange={e => setEditAnmeldungForm(f => ({...f, vorname: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">Nachname</label>
                  <input className="form-input" value={editAnmeldungForm.nachname} onChange={e => setEditAnmeldungForm(f => ({...f, nachname: e.target.value}))} />
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                <div>
                  <label className="form-label">E-Mail</label>
                  <input className="form-input" type="email" value={editAnmeldungForm.email} onChange={e => setEditAnmeldungForm(f => ({...f, email: e.target.value}))} />
                </div>
                <div>
                  <label className="form-label">Verein / Schule</label>
                  <input className="form-input" value={editAnmeldungForm.verein} onChange={e => setEditAnmeldungForm(f => ({...f, verein: e.target.value}))} />
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
                <div>
                  <label className="form-label">Kampfsport-Stil</label>
                  <select className="form-input" value={editAnmeldungForm.stil_id} onChange={async e => {
                    const sid = e.target.value;
                    setEditAnmeldungForm(f => ({...f, stil_id: sid, angestrebter_gurt: ''}));
                    if (sid) {
                      try {
                        const res = await fetch(`${API_BASE_URL}/stile/${sid}/graduierungen`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
                        if (res.ok) setEditAnmeldungGrads(await res.json());
                      } catch (e) { setEditAnmeldungGrads([]); }
                    }
                  }}>
                    <option value="">— Bitte wählen —</option>
                    {stile.map(s => <option key={s.stil_id} value={s.stil_id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select className="form-input" value={editAnmeldungForm.status} onChange={e => setEditAnmeldungForm(f => ({...f, status: e.target.value}))}>
                    <option value="angemeldet">Angemeldet</option>
                    <option value="bestaetigt">Bestätigt</option>
                    <option value="abgesagt">Abgesagt</option>
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'16px'}}>
                <div>
                  <label className="form-label">Aktueller Gurt</label>
                  <select className="form-input" value={editAnmeldungForm.aktueller_gurt} onChange={e => setEditAnmeldungForm(f => ({...f, aktueller_gurt: e.target.value}))}>
                    <option value="">— Kein Gurt —</option>
                    {editAnmeldungGrads.map(g => <option key={g.graduierung_id || g.id} value={g.name}>{g.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Angestrebter Gurt</label>
                  <select className="form-input" value={editAnmeldungForm.angestrebter_gurt} onChange={e => setEditAnmeldungForm(f => ({...f, angestrebter_gurt: e.target.value}))}>
                    <option value="">— Bitte wählen —</option>
                    {editAnmeldungGrads.map(g => <option key={g.graduierung_id || g.id} value={g.name}>{g.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="pv3-modal-footer" style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
              <button className="btn btn-secondary" onClick={() => setShowEditAnmeldungModal(false)}>Abbrechen</button>
              <button className="btn btn-primary" onClick={handleEditAnmeldungSave}>💾 Speichern</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Modal: Externen Teilnehmer manuell hinzufügen */}
      {showExternModal && externModalTermin && createPortal(
        <div className="pv3-modal-overlay-dark" onClick={() => setShowExternModal(false)}>
          <div className="pv3-modal-dark" style={{maxWidth:'480px'}} onClick={e => e.stopPropagation()}>
            <div className="pv3-modal-header">
              <h2>Externen Teilnehmer hinzufügen</h2>
              <p style={{color:'var(--text-muted)',fontSize:'13px',marginTop:'4px'}}>
                {externModalTermin.stil_name} · {new Date(externModalTermin.datum).toLocaleDateString('de-DE', {day:'2-digit',month:'long',year:'numeric'})}
              </p>
            </div>
            <div className="pv3-modal-body" style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px'}}>
                <div>
                  <label className="pv-field-label">Vorname *</label>
                  <input
                    type="text"
                    value={externForm.vorname}
                    onChange={e => setExternForm({...externForm, vorname: e.target.value})}
                    className="pv3-dark-input-sm"
                    placeholder="z.B. Tom"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="pv-field-label">Nachname *</label>
                  <input
                    type="text"
                    value={externForm.nachname}
                    onChange={e => setExternForm({...externForm, nachname: e.target.value})}
                    className="pv3-dark-input-sm"
                    placeholder="z.B. Neal"
                  />
                </div>
              </div>
              <div>
                <label className="pv-field-label">Verein / Schule (optional)</label>
                <input
                  type="text"
                  value={externForm.verein}
                  onChange={e => setExternForm({...externForm, verein: e.target.value})}
                  className="pv3-dark-input-sm"
                  placeholder="z.B. Kampfsportschule München"
                />
              </div>
              <div>
                <label className="pv-field-label">Ziel-Graduierung *</label>
                <select
                  value={externForm.graduierung_nachher_id}
                  onChange={e => setExternForm({...externForm, graduierung_nachher_id: e.target.value})}
                  className="pv3-dark-input-sm"
                >
                  <option value="">— Bitte wählen —</option>
                  {(graduierungenProStil[externModalTermin.stil_id] || [])
                    .filter(g => g.aktiv === 1)
                    .sort((a, b) => a.reihenfolge - b.reihenfolge)
                    .map(g => (
                      <option key={g.graduierung_id} value={g.graduierung_id}>{g.name}</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="modal-actions" style={{marginTop:'20px'}}>
              <button onClick={() => setShowExternModal(false)} className="btn btn-secondary">Abbrechen</button>
              <button onClick={handleExternHinzufuegen} className="btn btn-primary" disabled={loading}>
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Trainingskonflikt-Dialog */}
      {trainingsKonfliktDialog && createPortal(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:10000,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px'}}>
          <div style={{background:'#fff',borderRadius:'10px',padding:'28px',maxWidth:'480px',width:'100%',boxShadow:'0 20px 60px rgba(0,0,0,0.4)'}}>
            <div style={{fontSize:'22px',marginBottom:'8px'}}>⚠️ Trainingskonflikt</div>
            <p style={{color:'#555',marginBottom:'12px',lineHeight:'1.5'}}>
              Zu diesem Termin findet laut Stundenplan reguläres Training statt:
            </p>
            <ul style={{background:'#fff8e1',border:'1px solid #f59e0b',borderRadius:'6px',padding:'10px 16px',marginBottom:'16px',listStyle:'none'}}>
              {trainingsKonfliktDialog.konflikte.map((k, i) => (
                <li key={i} style={{color:'#92400e',fontSize:'14px',padding:'3px 0'}}>
                  <strong>{k.kurs_name || k.stil_name || 'Training'}</strong> — {k.tag}, {k.uhrzeit_start?.slice(0,5)}–{k.uhrzeit_ende?.slice(0,5)} Uhr
                </li>
              ))}
            </ul>
            <p style={{color:'#555',marginBottom:'16px',lineHeight:'1.5'}}>
              Möchtest du trotzdem die Prüfung zu diesem Termin anlegen?
            </p>
            <label style={{display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',marginBottom:'20px',background:'#f0fdf4',border:'1px solid #86efac',borderRadius:'6px',padding:'10px 14px'}}>
              <input
                type="checkbox"
                checked={trainingsKonfliktDialog.sendPush}
                onChange={e => setTrainingsKonfliktDialog(d => ({...d, sendPush: e.target.checked}))}
                style={{width:'16px',height:'16px',cursor:'pointer'}}
              />
              <span style={{fontSize:'14px',color:'#166534'}}>
                Push-Benachrichtigung senden: <em>"Training entfällt wegen Gürtelprüfung"</em>
              </span>
            </label>
            <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
              <button
                onClick={() => setTrainingsKonfliktDialog(null)}
                style={{padding:'9px 18px',border:'1px solid #d1d5db',borderRadius:'6px',background:'#fff',cursor:'pointer',color:'#374151'}}
              >
                Abbrechen
              </button>
              <button
                onClick={async () => {
                  try {
                    const kurs = trainingsKonfliktDialog.konflikte[0];
                    await doSaveTermin({
                      ...trainingsKonfliktDialog.terminData,
                      send_trainingsausfall_push: trainingsKonfliktDialog.sendPush,
                      trainingsausfall_kurs_name: kurs?.kurs_name || kurs?.stil_name || ''
                    });
                  } catch (err) {
                    setError(err.message);
                    setTrainingsKonfliktDialog(null);
                  }
                }}
                style={{padding:'9px 18px',border:'none',borderRadius:'6px',background:'#c8a84b',color:'#fff',cursor:'pointer',fontWeight:600}}
              >
                Ja, Termin anlegen
              </button>
            </div>
          </div>
        </div>
      , document.body)}

    </div>
  );
};

export default PruefungsVerwaltung;
