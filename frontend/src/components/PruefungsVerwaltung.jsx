// ============================================================================
// PRÜFUNGSVERWALTUNG - VOLLSTÄNDIGE KOMPONENTE
// Frontend/src/components/PruefungsVerwaltung.jsx
// Route: /dashboard/termine
// ============================================================================

import React, { useState, useEffect, lazy, Suspense, Component } from 'react';
import { createPortal } from 'react-dom';

class KalenderErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ color: '#f87171', padding: '24px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, margin: '16px 0' }}>
          <strong>Kalender-Fehler:</strong> {this.state.error.message}
          <pre style={{ marginTop: 8, fontSize: '0.75rem', opacity: 0.7, whiteSpace: 'pre-wrap' }}>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
import { useNavigate } from 'react-router-dom';
import { useDojoContext } from '../context/DojoContext';
import { Check, X, Calendar, Award, Users, TrendingUp, ChevronUp, ChevronDown, Download, Edit, Trash2, Play, FileText, Scroll, Printer, CalendarDays } from 'lucide-react';

const KalenderZentrale = lazy(() => import('./KalenderZentrale'));
import PruefungsStatistikTab from './PruefungsStatistikTab';
import PruefungsTermineTab from './PruefungsTermineTab';
import PruefungsKandidatenTab from './PruefungsKandidatenTab';
import PruefungsZugelasseneTab from './PruefungsZugelasseneTab';
import PruefungsAbgeschlossenTab from './PruefungsAbgeschlossenTab';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/Buttons.css';
import '../styles/Dashboard.css';
import '../styles/PruefungsVerwaltung.css';

// ============================================================================
// Urkunden-Vorlagen — geteilt zwischen Druck (druckeUrkunden) + Live-Vorschau.
// WICHTIG: bgImage wird NICHT mitgedruckt (Papier ist vorgedruckt). Es dient
// ausschließlich der Ansicht/Vorschau, damit man sieht wie der fertige Druck
// aussieht. Gedruckt werden nur die Datenfelder (.cert-*).
// ============================================================================
const URKUNDE_ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
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
    bgImage: `${URKUNDE_ORIGIN}/assets/urkunde_kickboxen.jpg`,
    styles: `
      .cert-name { position:absolute;width:100%;top:64mm;text-align:center;font-family:'Times New Roman',Georgia,serif;font-size:22pt;font-style:italic;color:#000;letter-spacing:0.5px; }
      .cert-rank { position:absolute;width:100%;top:65mm;text-align:center;font-family:'Times New Roman',Georgia,serif;font-size:22pt;font-style:italic;color:#000;letter-spacing:0.5px; }
      .cert-nummer { position:absolute;width:100%;top:165mm;text-align:center;font-family:'Times New Roman',Georgia,serif;font-size:11pt;color:#000;letter-spacing:1px; }
      .cert-datum { position:absolute;width:100%;top:173mm;text-align:center;font-family:'Times New Roman',Georgia,serif;font-size:11pt;color:#000; }
    `,
    renderNr: true, renderDatum: true,
  },
  aikido_schuelergrad: {
    pageSize: 'A4 landscape', pageW: '297mm', pageH: '210mm',
    bgImage: `${URKUNDE_ORIGIN}/assets/urkunde_aikido.jpg`,
    extraFonts: `<style>@font-face{font-family:'Bonzai';src:url('${URKUNDE_ORIGIN}/assets/bonzai.ttf') format('truetype');}</style>`,
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
    bgImage: `${URKUNDE_ORIGIN}/assets/urkunde_bobb.jpg`,
    extraFonts: `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap" rel="stylesheet">
      <style>@font-face{font-family:'Bonzai';src:url('${URKUNDE_ORIGIN}/assets/bonzai.ttf') format('truetype');}</style>
    `,
    styles: `
      .cert-name { position:absolute;top:69mm;left:8mm;width:136mm;text-align:center;font-family:'Great Vibes',cursive;font-size:30pt;line-height:1;color:#1a0f08; }
      .cert-rank { display:none; }
      .cert-nummer { position:absolute;top:168mm;left:28mm;font-family:'Bonzai',cursive;font-size:14pt;color:#1a0f08; }
      .cert-datum { position:absolute;top:180mm;left:19mm;font-family:'Bonzai',cursive;font-size:14pt;color:#1a0f08; }
    `,
    renderNr: true, renderDatum: true,
  },
  shieldx: {
    pageSize: 'A4 landscape', pageW: '297mm', pageH: '210mm',
    bgImage: `${URKUNDE_ORIGIN}/assets/urkunde_shieldx.jpg`,
    // Positionen aus der Vorlage gemessen (A4 quer, Linien bei 109,4 / 149,2 mm
    // links und 89,9 / 107,8 / 137,6 mm rechts). Texte sitzen knapp über den Linien.
    styles: `
      .cert-name { position:absolute;top:100mm;left:18mm;width:200mm;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:23pt;font-style:italic;color:#1a1a1a; }
      .cert-rank { position:absolute;top:141mm;left:18mm;width:200mm;text-align:center;font-family:Georgia,'Times New Roman',serif;font-size:21pt;font-style:italic;color:#1a1a1a; }
      .cert-nummer { position:absolute;top:81mm;left:226mm;width:60mm;text-align:center;font-family:Georgia,serif;font-size:10.5pt;color:#1a1a1a;letter-spacing:0.5px; }
      .cert-datum { position:absolute;top:99mm;left:226mm;width:60mm;text-align:center;font-family:Georgia,serif;font-size:10.5pt;color:#1a1a1a; }
      .cert-examiner { position:absolute;top:129mm;left:226mm;width:60mm;text-align:center;font-family:Georgia,serif;font-size:10.5pt;color:#1a1a1a; }
    `,
    renderNr: true, renderDatum: true, renderExaminer: true,
  },
};

// Live-Vorschau einer Urkunde: zeigt das Design (bgImage) mit den Datenfeldern
// an der exakt gleichen Position wie im Druck — gedruckt wird später nur Text.
function CertPreview({ vorlage, sample, datumDE, prueferName, maxWidth = 520 }) {
  const cfg = VORLAGEN_CONFIG[vorlage] || VORLAGEN_CONFIG.pruefungsurkunde;
  const MM = 3.7795275591; // px pro mm @96dpi
  const pageWmm = parseFloat(cfg.pageW);
  const pageHmm = parseFloat(cfg.pageH);
  const scale = maxWidth / (pageWmm * MM);
  const useBonzai = vorlage === 'aikido_schuelergrad';
  const bz = (s) => useBonzai ? (s || '').replace(/ß/g, 'ss') : (s || '');
  const scoped = (cfg.styles || '').replace(/\.cert-/g, '.cert-preview-doc .cert-');
  const name = bz(`${sample?.vorname || ''} ${sample?.nachname || ''}`.trim()) || 'Max Mustermann';
  const rank = bz(sample?.graduierung_nachher || sample?.graduierung_zwischen || '—');
  const nummer = bz(sample?.urkundennummer || '00000000-00001');
  return (
    <div style={{ width: maxWidth, height: pageHmm * MM * scale, position: 'relative', margin: '0 auto', boxShadow: '0 6px 24px rgba(0,0,0,0.45)', background: '#fff', borderRadius: 6, overflow: 'hidden' }}>
      {cfg.extraFonts ? <div dangerouslySetInnerHTML={{ __html: cfg.extraFonts }} /> : null}
      <style dangerouslySetInnerHTML={{ __html: scoped }} />
      <div className="cert-preview-doc" style={{
        width: pageWmm * MM, height: pageHmm * MM,
        transform: `scale(${scale})`, transformOrigin: 'top left',
        position: 'absolute', top: 0, left: 0,
        background: cfg.bgImage ? `#fff url('${cfg.bgImage}') center / 100% 100% no-repeat` : '#fff',
      }}>
        <div className="cert-name">{name}</div>
        <div className="cert-rank">{rank}</div>
        <div className="cert-nummer">{nummer}</div>
        <div className="cert-datum">{datumDE}</div>
        {cfg.renderExaminer ? <div className="cert-examiner">{bz(prueferName || '')}</div> : null}
      </div>
    </div>
  );
}

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
  const [gebuehrDialog, setGebuehrDialog] = useState(null); // { pruefung } oder null
  const [abgeschlossenePruefungen, setAbgeschlossenePruefungen] = useState([]);
  const [statistiken, setStatistiken] = useState(null);
  const [technikStats, setTechnikStats] = useState(null);
  const [erwStats, setErwStats] = useState(null);
  const [gurtView, setGurtView] = useState('stil');
  const [statsJahr, setStatsJahr] = useState('');
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
    gebuehr_auto_verrechnen: false,
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

  // Terminkonflikt-Warnung (neuer Prüfungstermin)
  const [konfliktWarnung, setKonfliktWarnung] = useState({ loading: false, konflikte: [] });

  // Drucken Vorschau-Modal
  const [showDruckPreview, setShowDruckPreview] = useState(false);
  const [druckPreviewData, setDruckPreviewData] = useState(null); // { pruefung, termin }
  const [protokollSendStatus, setProtokolSendStatus] = useState({}); // Key: pruefung_id → 'sending'|'sent'|'error'
  const [trainingsKonfliktDialog, setTrainingsKonfliktDialog] = useState(null); // { konflikte: [...], sendPush: true, terminData: {...} }
  const [erinnerungStatus, setErinnerungStatus] = useState({}); // key: `${datum}___${stil_id}` → 'sending'|'sent'|'error'
  const [erinnerungDialog, setErinnerungDialog] = useState(null); // { group, ohneAntwort }

  const handleErinnerungSenden = async (group) => {
    const ohneAntwort = group.candidates.filter(c => !c.mitglied_antwort);
    setErinnerungDialog({ group, ohneAntwort });
  };

  const handleErinnerungBestaetigen = async () => {
    if (!erinnerungDialog) return;
    const { group } = erinnerungDialog;
    const key = `${group.datum}___${group.stil_id}`;
    setErinnerungDialog(null);
    setErinnerungStatus(prev => ({ ...prev, [key]: 'sending' }));
    try {
      const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
      const dojoParam = getDojoFilterParam();
      const res = await fetch(`${API_BASE_URL}/pruefungen/kandidaten/erinnerung-ohne-antwort${dojoParam ? `?${dojoParam}` : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ datum: group.datum, stil_id: group.stil_id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Fehler');
      setErinnerungStatus(prev => ({ ...prev, [key]: 'sent' }));
      setSuccess(`✓ Erinnerung an ${data.count} Mitglied${data.count !== 1 ? 'er' : ''} gesendet (E-Mail + Push)`);
      setTimeout(() => setSuccess(''), 5000);
      setTimeout(() => setErinnerungStatus(prev => ({ ...prev, [key]: null })), 8000);
    } catch (err) {
      setErinnerungStatus(prev => ({ ...prev, [key]: 'error' }));
      setError('Fehler beim Senden der Erinnerung: ' + err.message);
      setTimeout(() => setError(''), 5000);
    }
  };

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
  const [terminAuswahlModal, setTerminAuswahlModal] = useState({ open: false, kandidat: null, termine: [], isAusnahme: false, step: 1, selectedTermin: null });
  const [ausnahmeBatchQueue, setAusnahmeBatchQueue] = useState([]); // Queue für Batch-Ausnahme-Zulassung

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

  // Zugelassen: welche Gruppen sind aufgeklappt (Standard: alle zu)
  const [openZugGroups, setOpenZugGroups] = useState({});

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

  // Terminkonflikt-Check: automatisch beim Ändern von Datum/Uhrzeit im neuen Terminformular
  useEffect(() => {
    const { pruefungsdatum, pruefungszeit } = neuerTermin;
    if (!pruefungsdatum || !pruefungszeit) {
      setKonfliktWarnung({ loading: false, konflikte: [] });
      return;
    }
    let cancelled = false;
    setKonfliktWarnung(prev => ({ ...prev, loading: true }));
    const [h, min] = pruefungszeit.split(':').map(Number);
    const endH = h + 3;
    const bisZeit = `${String(endH > 23 ? 23 : endH).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
    fetch(`${API_BASE_URL}/kalender/konflikt-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ datum: pruefungsdatum, von: pruefungszeit, bis: bisZeit })
    })
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setKonfliktWarnung({ loading: false, konflikte: data.konflikte || [] });
        }
      })
      .catch(() => {
        if (!cancelled) setKonfliktWarnung({ loading: false, konflikte: [] });
      });
    return () => { cancelled = true; };
  }, [neuerTermin.pruefungsdatum, neuerTermin.pruefungszeit]);

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
      fetchPruefungstermine(); // WICHTIG: Termine-Liste laden, damit die Ausnahme-Zulassung (openTerminAuswahl) den kommenden Termin findet — sonst bricht das Modal still ab
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
  }, [activeTab, selectedStil, dojosLoading, dojos, activeDojo, statsJahr]);

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

      const jahrParam = statsJahr ? `&jahr=${statsJahr}` : '';
      const response = await fetch(
        `${API_BASE_URL}/pruefungen/stats/statistiken?${dojoParam}${jahrParam}`,
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
          zahlungsart: termin.zahlungsart || null,
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
  const openTerminAuswahl = async (kandidat, isAusnahme = false) => {
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    const istZukunft = (datumStr) => {
      const d = new Date(datumStr);
      d.setHours(0, 0, 0, 0);
      return d >= heute;
    };

    // 1) Schnellweg: bereits im Speicher geladene Termine (stil_id robust als String vergleichen)
    let verfuegbareTermine = (pruefungstermine || []).filter(t =>
      String(t.stil_id) === String(kandidat.stil_id) && istZukunft(t.datum)
    );

    // 2) Fallback wie der normale Zulassungs-Weg: Termine FRISCH vom Server holen.
    //    Bisher hing openTerminAuswahl allein an der Speicher-Liste, die im
    //    Kandidaten-Tab nicht geladen wird → das Ausnahme-Modal fand nie einen Termin.
    if (verfuegbareTermine.length === 0) {
      try {
        const dojoId = kandidat.dojo_id || activeDojo?.id;
        const res = await fetch(
          `${API_BASE_URL}/pruefungen/termine?stil_id=${kandidat.stil_id}${dojoId ? `&dojo_id=${dojoId}` : ''}`,
          { headers: { 'Authorization': `Bearer ${localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken')}` } }
        );
        const data = await res.json();
        verfuegbareTermine = (data.termine || [])
          .filter(t => istZukunft(t.pruefungsdatum))
          .map(t => ({
            datum: String(t.pruefungsdatum).split('T')[0],
            zeit: t.pruefungszeit || 'Nicht festgelegt',
            ort: t.pruefungsort || 'Nicht festgelegt',
            stil_id: t.stil_id,
            vorlageData: {
              termin_id: t.termin_id,
              pruefungsgebuehr: t.pruefungsgebuehr,
              anmeldefrist: t.anmeldefrist,
              bemerkungen: t.bemerkungen,
              teilnahmebedingungen: t.teilnahmebedingungen,
              zahlungsart: t.zahlungsart || null,
            },
          }));
      } catch (e) {
        // Netzwerkfehler → unten als „kein Termin" behandelt
      }
    }

    if (verfuegbareTermine.length === 0) {
      setError(`Kein zukünftiger Prüfungstermin für ${kandidat.stil_name} gefunden. Bitte legen Sie zuerst einen Termin an.`);
      setTimeout(() => setError(''), 5000);
      return;
    }

    setTerminAuswahlModal({ open: true, kandidat, termine: verfuegbareTermine, isAusnahme, step: 1, selectedTermin: null });
  };

  // Termin im Modal ausgewählt
  const handleTerminAuswahlSelected = (termin) => {
    // Wenn der Termin bereits eine Zahlungsart hat (bei der Termin-Erstellung gewählt),
    // den Zahlungsart-Schritt überspringen und direkt damit zulassen — nicht erneut fragen.
    const za = termin.vorlageData?.zahlungsart || termin.zahlungsart;
    if (za === 'bar' || za === 'rechnung' || za === 'lastschrift') {
      setTerminAuswahlModal(prev => ({ ...prev, selectedTermin: termin }));
      handleZahlungsartAuswahlSelected(za, termin);
      return;
    }
    // Sonst: Schritt 1 → 2: Termin merken, Zahlungsart abfragen
    setTerminAuswahlModal(prev => ({ ...prev, step: 2, selectedTermin: termin }));
  };

  const handleZahlungsartAuswahlSelected = async (zahlungsart, terminArg = null) => {
    const kandidat = terminAuswahlModal.kandidat;
    const termin = terminArg || terminAuswahlModal.selectedTermin;
    setTerminAuswahlModal({ open: false, kandidat: null, termine: [], isAusnahme: false, step: 1, selectedTermin: null });
    if (!kandidat || !termin) return;

    const customDaten = {
      pruefungsdatum: termin.datum,
      pruefungszeit: termin.zeit !== 'Nicht festgelegt' ? termin.zeit : '10:00',
      pruefungsort: termin.ort,
      pruefungsgebuehr: termin.vorlageData?.pruefungsgebuehr,
      anmeldefrist: termin.vorlageData?.anmeldefrist,
      bemerkungen: termin.vorlageData?.bemerkungen,
      teilnahmebedingungen: termin.vorlageData?.teilnahmebedingungen,
      zahlungsart
    };

    // Kein window.confirm — Warnung ist bereits im Modal sichtbar (⚠️)
    await handleKandidatZulassen(kandidat, customDaten);

    // Nächsten aus der Batch-Queue öffnen
    let nextKandidat = null;
    setAusnahmeBatchQueue(prev => {
      if (prev.length === 0) return prev;
      const [next, ...remaining] = prev;
      nextKandidat = next;
      return remaining;
    });
    if (nextKandidat) {
      setTimeout(() => openTerminAuswahl(nextKandidat, true), 150);
    }
  };

  // Funktion zum Entfernen der Zulassung
  const handleZulassungEntfernen = async (pruefung) => {
    if (!window.confirm(`${pruefung.vorname} ${pruefung.nachname} kommt nicht zur Prüfung?\n\nZulassung entfernen — Stunden und Wartezeit laufen normal weiter.`)) {
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

        // Automatisch Urkunde generieren — deaktiviert, Backend-Endpunkt noch nicht implementiert
        // await generateUrkunde(selectedPruefung.pruefung_id);
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

  // Graduierung in der Zugelassen-Ansicht ändern (vorher + nachher)
  const handleGraduierungZulassungAendern = async (pruefung, vorher_id, nachher_id) => {
    const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
    try {
      const res = await fetch(`${API_BASE_URL}/pruefungen/${pruefung.pruefung_id}/graduierung`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          graduierung_nachher_id: nachher_id,
          graduierung_vorher_id: vorher_id || null,
          graduierung_zwischen_id: pruefung.graduierung_zwischen_id || null,
        }),
      });
      if (!res.ok) throw new Error('Fehler beim Speichern der Graduierung');
      const grads = graduierungenProStil[pruefung.stil_id] || [];
      const vGrad = grads.find(g => g.graduierung_id === vorher_id);
      const nGrad = grads.find(g => g.graduierung_id === nachher_id);
      setZugelassenePruefungen(prev => prev.map(p =>
        p.pruefung_id === pruefung.pruefung_id
          ? {
              ...p,
              graduierung_vorher_id: vorher_id || null,
              graduierung_vorher: vGrad?.name || p.graduierung_vorher,
              farbe_vorher: vGrad?.farbe_hex || p.farbe_vorher,
              graduierung_nachher_id: nachher_id,
              graduierung_nachher: nGrad?.name || p.graduierung_nachher,
              farbe_nachher: nGrad?.farbe_hex || p.farbe_nachher,
            }
          : p
      ));
    } catch (err) {
      setError(err.message);
    }
  };

  // Admin setzt Anmelde-/Bestätigungsstatus manuell
  const handleAdminStatus = async (pruefung, felder) => {
    const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
    try {
      const res = await fetch(`${API_BASE_URL}/pruefungen/kandidaten/${pruefung.pruefung_id}/admin-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(felder),
      });
      if (!res.ok) throw new Error('Fehler beim Speichern');
      // Lokal aktualisieren ohne kompletten Reload
      setZugelassenePruefungen(prev =>
        prev.map(p => p.pruefung_id === pruefung.pruefung_id ? { ...p, ...felder } : p)
      );
    } catch (err) {
      setError(err.message);
    }
  };

  // Individuelle Gebühren-Einstellung für einen Prüfling togglen
  const handleGebuehrAutoToggle = async (pruefung) => {
    const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
    // Zyklus: null (Termin-Std.) → 1 (erzwingen an) → 0 (erzwingen aus) → null
    const current = pruefung.gebuehr_auto_verrechnen;
    const next = current === null || current === undefined ? 1 : current === 1 ? 0 : null;
    try {
      const res = await fetch(`${API_BASE_URL}/pruefungen/kandidaten/${pruefung.pruefung_id}/gebuehr-auto`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gebuehr_auto_verrechnen: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler');
      setZugelassenePruefungen(prev =>
        prev.map(p => p.pruefung_id === pruefung.pruefung_id
          ? { ...p, gebuehr_auto_verrechnen: next, gebuehr_rechnung_id: data.rechnung_id ?? p.gebuehr_rechnung_id }
          : p)
      );
      if (data.rechnung_erstellt) setSuccess('Rechnung automatisch erstellt');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGebuehrBar = async (pruefung) => {
    const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
    try {
      const res = await fetch(`${API_BASE_URL}/pruefungen/kandidaten/${pruefung.pruefung_id}/gebuehr-bar`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler');
      setZugelassenePruefungen(prev =>
        prev.map(p => p.pruefung_id === pruefung.pruefung_id
          ? { ...p, zahlungsart: 'bar', gebuehr_bezahlt: 1, gebuehr_auto_verrechnen: 0, gebuehr_rechnung_id: null }
          : p)
      );
      setGebuehrDialog(null);
      setSuccess('Prüfungsgebühr als Bar-Zahlung erfasst');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGebuehrRechnung = async (pruefung) => {
    setGebuehrDialog(null);
    await handleGebuehrAutoToggle({ ...pruefung, gebuehr_auto_verrechnen: null }); // force → 1
  };

  const handleGebuehrNull = async (pruefung) => {
    const token = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken');
    try {
      const res = await fetch(`${API_BASE_URL}/pruefungen/kandidaten/${pruefung.pruefung_id}/gebuehr-null`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler');
      setZugelassenePruefungen(prev =>
        prev.map(p => p.pruefung_id === pruefung.pruefung_id
          ? { ...p, pruefungsgebuehr: 0, gebuehr_bezahlt: 1, gebuehr_auto_verrechnen: 0, zahlungsart: 'kostenlos', gebuehr_rechnung_id: null }
          : p)
      );
      setGebuehrDialog(null);
      setSuccess('Prüfungsgebühr erlassen (0 €)');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleBatchRechnungErstellen = async (candidates) => {
    const ohneRechnung = candidates.filter(c => c.pruefungsgebuehr && parseFloat(c.pruefungsgebuehr) > 0 && !c.gebuehr_rechnung_id && !c.gebuehr_bezahlt);
    if (ohneRechnung.length === 0) return;
    setSuccess(`Erstelle ${ohneRechnung.length} Rechnung${ohneRechnung.length !== 1 ? 'en' : ''}…`);
    let count = 0;
    for (const p of ohneRechnung) {
      await handleGebuehrAutoToggle({ ...p, gebuehr_auto_verrechnen: null });
      count++;
    }
    setSuccess(`${count} Rechnung${count !== 1 ? 'en' : ''} erstellt`);
    setTimeout(() => setSuccess(''), 3000);
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
      oeffentlich_vib: false, gebuehr_auto_verrechnen: false, ist_historisch: false, historisch_bemerkung: ''
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
      gebuehr_auto_verrechnen: neuerTermin.gebuehr_auto_verrechnen ? 1 : 0,
      zahlungsart: neuerTermin.zahlungsart || null,
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
      originalDatum: formatDateForInput(termin.datum),
      pruefungszeit: termin.zeit || '10:00',
      pruefungsort: termin.ort || '',
      pruefer_name: termin.vorlageData?.pruefer_name || '',
      stil_id: termin.vorlageData?.stil_id || '',
      pruefungsgebuehr: termin.vorlageData?.pruefungsgebuehr || '',
      anmeldefrist: formatDateForInput(termin.vorlageData?.anmeldefrist),
      bemerkungen: termin.vorlageData?.bemerkungen || '',
      teilnahmebedingungen: termin.vorlageData?.teilnahmebedingungen || '',
      oeffentlich: termin.vorlageData?.oeffentlich ? true : false,
      oeffentlich_vib: termin.vorlageData?.oeffentlich_vib ? true : false,
      gebuehr_auto_verrechnen: termin.vorlageData?.gebuehr_auto_verrechnen ? true : false,
      zahlungsart: termin.vorlageData?.zahlungsart || '',
      verlegungsgrund: ''
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
          oeffentlich_vib: editTermin.oeffentlich_vib ? 1 : 0,
          gebuehr_auto_verrechnen: editTermin.gebuehr_auto_verrechnen ? 1 : 0,
          zahlungsart: editTermin.zahlungsart || null,
          verlegungsgrund: editTermin.verlegungsgrund || null
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

    // VORLAGEN_CONFIG ist modul-global (oben definiert) — geteilt mit CertPreview.
    const cfg = VORLAGEN_CONFIG[vorlage] || VORLAGEN_CONFIG['pruefungsurkunde'];

    const buildAndPrint = (kandidatenMitNummern) => {
      const pruefDatum = termin?.datum || new Date().toISOString().split('T')[0];
      const pruefDatumDE = new Date(pruefDatum).toLocaleDateString('de-DE');

      const useBonzai = vorlage === 'aikido_schuelergrad';
      const bz = (s) => useBonzai ? (s || '').replace(/ß/g, 'ss') : (s || '');

      // Jede Seite als Div, durch einen Seitenumbruch getrennt.
      // WICHTIG: cert-page bekommt calc(pageH - 1px) damit der Trenner (height:0)
      // auf DERSELBEN Seite wie die Cert-Page bleibt — sonst schiebt Chrome ihn auf
      // die nächste Seite und der page-break-before erzeugt eine zusätzliche Leerseite.
      const pageBlocks = kandidatenMitNummern.map((p, i) =>
        (i > 0 ? '<div class="page-break"></div>' : '') +
        `<div class="cert-page"><div class="cert-name">${bz(`${p.vorname || ''} ${p.nachname || ''}`)}</div><div class="cert-rank">${bz(p.graduierung_nachher || '—')}</div>${p.urkundennummer ? `<div class="cert-nummer">${bz(p.urkundennummer)}</div>` : ''}<div class="cert-datum">${pruefDatumDE}</div>${cfg.renderExaminer ? `<div class="cert-examiner">${bz(termin?.pruefer_name || '')}</div>` : ''}</div>`
      ).join('');

      const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <title>Urkunde Druck</title>
  ${cfg.extraFonts || ''}
  <style>
    @page { size: ${cfg.pageSize}; margin: 0; }
    html, body { margin: 0; padding: 0; background: #fff; }
    .cert-page {
      width: ${cfg.pageW};
      height: calc(${cfg.pageH} - 1px);
      position: relative;
      overflow: hidden;
    }
    .page-break {
      height: 0;
      margin: 0;
      padding: 0;
      border: none;
      page-break-before: always;
    }
    ${cfg.styles}
    @media print {
      html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { size: ${cfg.pageSize}; margin: 0; }
    }
  </style>
</head>
<body>${pageBlocks}</body>
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
          <div className="pv3-header-controls">
            <select
              value={selectedStil}
              onChange={(e) => setSelectedStil(e.target.value)}
              className="form-select pv3-select-short"
            >
              <option value="all">Alle Stile</option>
              {stile.map(stil => (
                <option key={stil.stil_id} value={stil.stil_id}>{stil.name}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (activeTab === 'termine') fetchPruefungstermine();
                else if (activeTab === 'kandidaten') { fetchKandidaten(); fetchPruefungstermine(); }
                else if (activeTab === 'zugelassen') fetchZugelassenePruefungen();
                else if (activeTab === 'abgeschlossen') fetchAbgeschlossenePruefungen();
                else if (activeTab === 'statistiken') { fetchStatistiken(); fetchTechnikStats(); fetchErwStats(); }
              }}
              className="pv3-toolbar-icon-btn"
              title="Aktualisieren"
            >🔄</button>
            <button
              className="pv3-toolbar-btn"
              onClick={() => navigate('/dashboard/auswertungen?tab=training&sub=belts')}
              title="Gürtel-Statistik öffnen"
            >🥋 Gürtel-Statistik</button>
          </div>
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
          <button
            onClick={() => setActiveTab('kalender')}
            className={`pv3-tab-btn${activeTab === 'kalender' ? ' active' : ''}`}
          >
            <CalendarDays size={16} />
            Kalender
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
        <PruefungsTermineTab
          loading={loading}
          pruefungstermine={pruefungstermine}
          graduierungenProStil={graduierungenProStil}
          selectedGraduierungen={selectedGraduierungen}
          setSelectedGraduierungen={setSelectedGraduierungen}
          externeAnmeldungen={externeAnmeldungen}
          expandedTermine={expandedTermine}
          vergangeneExpanded={vergangeneExpanded}
          setVergangeneExpanded={setVergangeneExpanded}
          openZwischenPruefId={openZwischenPruefId}
          setOpenZwischenPruefId={setOpenZwischenPruefId}
          showNeuerTerminModal={showNeuerTerminModal}
          setShowNeuerTerminModal={setShowNeuerTerminModal}
          showExternModal={showExternModal}
          setShowExternModal={setShowExternModal}
          externModalTermin={externModalTermin}
          setExternModalTermin={setExternModalTermin}
          externForm={externForm}
          setExternForm={setExternForm}
          druckAuswahlModal={druckAuswahlModal}
          setDruckAuswahlModal={setDruckAuswahlModal}
          setError={setError}
          setSuccess={setSuccess}
          fetchPruefungstermine={fetchPruefungstermine}
          handleEditAnmeldungOpen={handleEditAnmeldungOpen}
          handlePruefungslistePDF={handlePruefungslistePDF}
          handleTerminBearbeiten={handleTerminBearbeiten}
          handleTerminLoeschen={handleTerminLoeschen}
          openBatchErgebnisModal={openBatchErgebnisModal}
          saveZwischengurt={saveZwischengurt}
          toggleTerminExpanded={toggleTerminExpanded}
          druckeErgebnis={druckeErgebnis}
        />
      )}

      {/* Kandidaten Tab */}
      {activeTab === 'kandidaten' && (
        <PruefungsKandidatenTab
          kandidaten={kandidaten}
          stile={stile}
          loading={loading}
          setError={setError}
          setSuccess={setSuccess}
          selectedKandidaten={selectedKandidaten}
          setSelectedKandidaten={setSelectedKandidaten}
          graduierungenProStil={graduierungenProStil}
          selectedGraduierungen={selectedGraduierungen}
          setSelectedGraduierungen={setSelectedGraduierungen}
          ausnahmeBatchQueue={ausnahmeBatchQueue}
          setAusnahmeBatchQueue={setAusnahmeBatchQueue}
          berechtigungsFilter={berechtigungsFilter}
          setBerechtigungsFilter={setBerechtigungsFilter}
          kandidatenStilFilter={kandidatenStilFilter}
          setKandidatenStilFilter={setKandidatenStilFilter}
          kandidatenSuchbegriff={kandidatenSuchbegriff}
          setKandidatenSuchbegriff={setKandidatenSuchbegriff}
          sortConfig={sortConfig}
          openZugGroups={openZugGroups}
          setOpenZugGroups={setOpenZugGroups}
          applySorting={applySorting}
          fetchKandidaten={fetchKandidaten}
          fetchPruefungstermine={fetchPruefungstermine}
          fetchZugelassenePruefungen={fetchZugelassenePruefungen}
          handleKandidatZulassen={handleKandidatZulassen}
          handleSort={handleSort}
          handleZulassungEntfernen={handleZulassungEntfernen}
          openTerminAuswahl={openTerminAuswahl}
        />
      )}

      {/* Zugelassene Prüfungen Tab */}
      {activeTab === 'zugelassen' && (
        <PruefungsZugelasseneTab
          stile={stile}
          loading={loading}
          setError={setError}
          datumFilter={datumFilter}
          setDatumFilter={setDatumFilter}
          graduierungenProStil={graduierungenProStil}
          showErgebnisModal={showErgebnisModal}
          setShowErgebnisModal={setShowErgebnisModal}
          selectedPruefung={selectedPruefung}
          setSelectedPruefung={setSelectedPruefung}
          pruefungsErgebnis={pruefungsErgebnis}
          setPruefungsErgebnis={setPruefungsErgebnis}
          zugelassenePruefungen={zugelassenePruefungen}
          gebuehrDialog={gebuehrDialog}
          setGebuehrDialog={setGebuehrDialog}
          erinnerungStatus={erinnerungStatus}
          druckAuswahlModal={druckAuswahlModal}
          setDruckAuswahlModal={setDruckAuswahlModal}
          zugelasseneStilFilter={zugelasseneStilFilter}
          setZugelasseneStilFilter={setZugelasseneStilFilter}
          openZwischenPruefId={openZwischenPruefId}
          setOpenZwischenPruefId={setOpenZwischenPruefId}
          openZugGroups={openZugGroups}
          setOpenZugGroups={setOpenZugGroups}
          handleErinnerungSenden={handleErinnerungSenden}
          druckeErgebnis={druckeErgebnis}
          handleZulassungEntfernen={handleZulassungEntfernen}
          handleGraduierungZulassungAendern={handleGraduierungZulassungAendern}
          handleAdminStatus={handleAdminStatus}
          handleBatchRechnungErstellen={handleBatchRechnungErstellen}
          saveZwischengurt={saveZwischengurt}
          loadGraduierungenFuerModal={loadGraduierungenFuerModal}
        />
      )}

      {/* Abgeschlossene Prüfungen Tab */}
      {activeTab === 'abgeschlossen' && (
        <PruefungsAbgeschlossenTab
          stile={stile}
          loading={loading}
          graduierungenProStil={graduierungenProStil}
          abgeschlossenePruefungen={abgeschlossenePruefungen}
          druckAuswahlModal={druckAuswahlModal}
          setDruckAuswahlModal={setDruckAuswahlModal}
          abgeschlosseneStilFilter={abgeschlosseneStilFilter}
          setAbgeschlosseneStilFilter={setAbgeschlosseneStilFilter}
          openZwischenPruefId={openZwischenPruefId}
          setOpenZwischenPruefId={setOpenZwischenPruefId}
          openZugGroups={openZugGroups}
          setOpenZugGroups={setOpenZugGroups}
          druckeErgebnis={druckeErgebnis}
          handleStatusAendern={handleStatusAendern}
          saveZwischengurt={saveZwischengurt}
        />
      )}

      {/* Statistiken Tab */}
      {activeTab === 'statistiken' && statistiken && (
        <PruefungsStatistikTab
          statistiken={statistiken}
          technikStats={technikStats}
          erwStats={erwStats}
          kandidaten={kandidaten}
          stile={stile}
          zugelassenePruefungen={zugelassenePruefungen}
          abgeschlossenePruefungen={abgeschlossenePruefungen}
          statsJahr={statsJahr}
          setStatsJahr={setStatsJahr}
          gurtView={gurtView}
          setGurtView={setGurtView}
        />
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

                  {/* Terminkonflikt-Warnung */}
                  {konfliktWarnung.konflikte.length > 0 && (
                    <div className="konflikt-warnung" style={{
                      marginTop: '0.75rem',
                      padding: '0.6rem 0.85rem',
                      background: 'rgba(245,158,11,0.12)',
                      border: '1px solid rgba(245,158,11,0.4)',
                      borderRadius: '6px',
                      color: '#f59e0b',
                      fontSize: '0.82rem',
                      lineHeight: 1.4
                    }}>
                      ⚠️ <strong>Terminkonflikt:</strong>{' '}
                      {konfliktWarnung.konflikte.map(k => k.titel).join(', ')}
                    </div>
                  )}
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
                        <option value="rechnung">Rechnung / Überweisung</option>
                        <option value="lastschrift">SEPA-Lastschrift</option>
                        <option value="bar">Barzahlung</option>
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
                  {neuerTermin.pruefungsgebuehr && parseFloat(neuerTermin.pruefungsgebuehr) > 0 && neuerTermin.zahlungsart === 'rechnung' && (
                    <div className="pv3-zahlungsart-info pv3-zahlungsart-info--rechnung">
                      <span className="pv3-zahlungsart-info-icon">💶</span>
                      <span>Bei Zulassung wird automatisch eine <strong>offene Rechnung</strong> über {parseFloat(neuerTermin.pruefungsgebuehr).toFixed(2)} € erstellt — der Kunde zahlt per Überweisung.</span>
                    </div>
                  )}
                  {neuerTermin.pruefungsgebuehr && parseFloat(neuerTermin.pruefungsgebuehr) > 0 && neuerTermin.zahlungsart === 'lastschrift' && (
                    <div className="pv3-zahlungsart-info pv3-zahlungsart-info--lastschrift">
                      <span className="pv3-zahlungsart-info-icon">📄</span>
                      <span>Bei Zulassung wird ein <strong>Rechnungsbeleg</strong> über {parseFloat(neuerTermin.pruefungsgebuehr).toFixed(2)} € erstellt — Einzug erfolgt über den Lastschriftlauf.</span>
                    </div>
                  )}
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

              {/* Verlegungsgrund — nur sichtbar wenn Datum geändert */}
              {editTermin.pruefungsdatum && editTermin.originalDatum && editTermin.pruefungsdatum !== editTermin.originalDatum && (
                <div className="pv2-grid-span-full">
                  <label className="pv-field-label" style={{ color: '#fbbf24' }}>
                    ⚠️ Grund für die Termin-Verlegung
                    <span style={{ fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '6px' }}>(wird per Push an alle Teilnehmer gesendet)</span>
                  </label>
                  <textarea
                    value={editTermin.verlegungsgrund}
                    onChange={(e) => setEditTermin({ ...editTermin, verlegungsgrund: e.target.value })}
                    className="pv3-dark-input-sm"
                    rows={2}
                    style={{ resize: 'vertical', borderColor: 'rgba(251,191,36,.4)' }}
                    placeholder="z.B. Erkrankung des Prüfers, Hallenbelegung, …"
                  />
                </div>
              )}

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

              {/* Zahlungsart */}
              <div>
                <label className="pv-field-label">Zahlungsart Prüfungsgebühr</label>
                <select
                  value={editTermin.zahlungsart || ''}
                  onChange={(e) => setEditTermin({ ...editTermin, zahlungsart: e.target.value })}
                  className="pv3-dark-input-sm"
                >
                  <option value="">— Bitte wählen —</option>
                  <option value="rechnung">Rechnung / Überweisung</option>
                  <option value="lastschrift">SEPA-Lastschrift</option>
                  <option value="bar">Barzahlung</option>
                </select>
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
            {editTermin.pruefungsgebuehr && parseFloat(editTermin.pruefungsgebuehr) > 0 && editTermin.zahlungsart === 'rechnung' && (
              <div className="pv3-zahlungsart-info pv3-zahlungsart-info--rechnung" style={{ marginTop: '0.5rem' }}>
                <span className="pv3-zahlungsart-info-icon">💶</span>
                <span>Bei Zulassung wird automatisch eine <strong>offene Rechnung</strong> über {parseFloat(editTermin.pruefungsgebuehr).toFixed(2)} € erstellt — der Kunde zahlt per Überweisung.</span>
              </div>
            )}
            {editTermin.pruefungsgebuehr && parseFloat(editTermin.pruefungsgebuehr) > 0 && editTermin.zahlungsart === 'lastschrift' && (
              <div className="pv3-zahlungsart-info pv3-zahlungsart-info--lastschrift" style={{ marginTop: '0.5rem' }}>
                <span className="pv3-zahlungsart-info-icon">📄</span>
                <span>Bei Zulassung wird ein <strong>Rechnungsbeleg</strong> über {parseFloat(editTermin.pruefungsgebuehr).toFixed(2)} € erstellt — Einzug erfolgt über den Lastschriftlauf.</span>
              </div>
            )}

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
          onClick={() => { setAusnahmeBatchQueue([]); setTerminAuswahlModal({ open: false, kandidat: null, termine: [], isAusnahme: false, step: 1, selectedTermin: null }); }}
        >
          <div
            className="pv3-auswahl-modal-box"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="pv2-mb-05">
              {terminAuswahlModal.step === 1
                ? (terminAuswahlModal.isAusnahme ? 'Ausnahme-Zulassung' : 'Prüfungstermin wählen')
                : 'Zahlungsart festlegen'}
              {ausnahmeBatchQueue.length > 0 && (
                <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#f59e0b', marginLeft: '0.6rem' }}>
                  (noch {ausnahmeBatchQueue.length} weitere)
                </span>
              )}
            </h3>
            <p className="pv3-auswahl-muted-p">
              {terminAuswahlModal.kandidat?.vorname} {terminAuswahlModal.kandidat?.nachname} —{' '}
              {terminAuswahlModal.kandidat?.stil_name}
              {terminAuswahlModal.isAusnahme && (
                <span className="pv3-auswahl-warning-span">
                  ⚠️ Zeitliche Voraussetzungen nicht erfüllt
                </span>
              )}
              {terminAuswahlModal.step === 2 && terminAuswahlModal.selectedTermin && (
                <span style={{ display: 'block', marginTop: '0.25rem', color: 'var(--text-secondary, #aaa)', fontSize: '0.85rem' }}>
                  📅 {new Date(terminAuswahlModal.selectedTermin.datum).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {terminAuswahlModal.selectedTermin.vorlageData?.pruefungsgebuehr &&
                    ` · ${parseFloat(terminAuswahlModal.selectedTermin.vorlageData.pruefungsgebuehr).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}`}
                </span>
              )}
            </p>

            {terminAuswahlModal.step === 1 && (
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
            )}

            {terminAuswahlModal.step === 2 && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => handleZahlungsartAuswahlSelected('bar')}
                  className="pv3-auswahl-btn"
                  style={{ flex: 1, textAlign: 'center', padding: '1rem' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#22c55e'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color, #333)'}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>💵</div>
                  <div style={{ fontWeight: 600 }}>Bar</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #aaa)', marginTop: '0.2rem' }}>Wird direkt kassiert</div>
                </button>
                <button
                  onClick={() => handleZahlungsartAuswahlSelected('lastschrift')}
                  className="pv3-auswahl-btn"
                  style={{ flex: 1, textAlign: 'center', padding: '1rem' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#6366f1'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color, #333)'}
                >
                  <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🏦</div>
                  <div style={{ fontWeight: 600 }}>Lastschrift</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #aaa)', marginTop: '0.2rem' }}>Wird per SEPA eingezogen</div>
                </button>
              </div>
            )}

            <button
              onClick={() => {
                if (terminAuswahlModal.step === 2) {
                  setTerminAuswahlModal(prev => ({ ...prev, step: 1, selectedTermin: null }));
                } else {
                  setAusnahmeBatchQueue([]);
                  setTerminAuswahlModal({ open: false, kandidat: null, termine: [], isAusnahme: false, step: 1, selectedTermin: null });
                }
              }}
              className="pv3-auswahl-cancel"
            >
              {terminAuswahlModal.step === 2 ? '← Zurück' : (ausnahmeBatchQueue.length > 0 ? 'Alle abbrechen' : 'Abbrechen')}
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
          { key: 'shieldx',               label: 'ShieldX',             img: '/assets/urkunde_shieldx.jpg' },
        ];
        const closeModal = () => setDruckAuswahlModal({ open: false, termin: null, selected: [], vorlage: 'pruefungsurkunde' });
        return createPortal(
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}
            onClick={closeModal}>
            <div style={{background:'#1e1e35',borderRadius:'12px',width:'100%',maxWidth:'600px',maxHeight:'92vh',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.7)',border:'1px solid rgba(255,255,255,0.1)'}}
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
                  style={{background:'rgba(255,255,255,0.1)',border:'none',color: 'var(--ds-text)',borderRadius:'50%',width:'28px',height:'28px',cursor:'pointer',fontSize:'16px',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  ×
                </button>
              </div>

              {/* Vorlagen-Auswahl */}
              <div style={{padding:'14px 20px 0'}}>
                <div style={{fontSize:'11px',fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>
                  Urkunden-Vorlage
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'8px'}}>
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
                            <div style={{position:'absolute',top:'3px',right:'3px',background:'#6366f1',borderRadius:'50%',width:'14px',height:'14px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'9px',color: 'var(--ds-text)'}}>✓</div>
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

              {/* Live-Vorschau — zeigt wie der fertige Druck aussieht (Design + Daten).
                  Gedruckt wird später NUR der Text auf das vorgedruckte Papier. */}
              {(() => {
                const sample = druckAuswahlModal.termin.pruefungen.find(p => druckAuswahlModal.selected.includes(p.pruefung_id))
                  || druckAuswahlModal.termin.pruefungen[0];
                const datumDE = new Date(druckAuswahlModal.termin.datum).toLocaleDateString('de-DE');
                return (
                  <div style={{padding:'4px 20px 0'}}>
                    <div style={{fontSize:'11px',fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>
                      Vorschau (fertiger Druck)
                    </div>
                    <CertPreview
                      vorlage={druckAuswahlModal.vorlage}
                      sample={sample}
                      datumDE={datumDE}
                      prueferName={druckAuswahlModal.termin.pruefer_name || ''}
                      maxWidth={520}
                    />
                    <div style={{fontSize:'10.5px',color:'#64748b',textAlign:'center',marginTop:'8px',lineHeight:1.4}}>
                      Hintergrund nur zur Ansicht — gedruckt werden ausschließlich die Daten auf das vorgedruckte Papier.
                    </div>
                  </div>
                );
              })()}

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
                  style={{padding:'8px 20px',background: druckAuswahlModal.selected.length === 0 ? 'rgba(99,102,241,0.3)' : '#6366f1',border:'none',borderRadius:'8px',color: 'var(--ds-text)',cursor: druckAuswahlModal.selected.length === 0 ? 'default' : 'pointer',fontSize:'13px',fontWeight:600,display:'flex',alignItems:'center',gap:'6px'}}>
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
                <button onClick={triggerDruck} style={{padding:'8px 20px',background:'#1a1a1a',color: 'var(--ds-text)',border:'none',borderRadius:'6px',cursor:'pointer',fontWeight:600,fontSize:'14px',display:'flex',alignItems:'center',gap:'6px'}}>
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
                style={{padding:'9px 18px',border:'none',borderRadius:'6px',background:'#c8a84b',color: 'var(--ds-text)',cursor:'pointer',fontWeight:600}}
              >
                Ja, Termin anlegen
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Gebühren-Dialog: Bar oder Rechnung */}
      {gebuehrDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setGebuehrDialog(null)}>
          <div style={{ background: 'var(--card-bg, #1e2235)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: 14, padding: '1.75rem 2rem', minWidth: 320, maxWidth: 400 }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 0.5rem', color: '#ffd700', fontSize: '1rem' }}>💶 Prüfungsgebühr abrechnen</h3>
            <p style={{ margin: '0 0 1.25rem', color: 'var(--ds-text-secondary)', fontSize: '0.875rem' }}>
              {gebuehrDialog.vorname} {gebuehrDialog.nachname} — {parseFloat(gebuehrDialog.pruefungsgebuehr).toFixed(2)} €
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => handleGebuehrBar(gebuehrDialog)}
                style={{ flex: 1, minWidth: 90, padding: '0.75rem', borderRadius: 8, border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.12)', color: '#4ade80', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                💵 Bar
              </button>
              <button
                onClick={() => handleGebuehrRechnung(gebuehrDialog)}
                style={{ flex: 1, minWidth: 90, padding: '0.75rem', borderRadius: 8, border: '1px solid rgba(255,215,0,0.4)', background: 'rgba(255,215,0,0.1)', color: '#ffd700', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                🧾 Rechnung
              </button>
              <button
                onClick={() => handleGebuehrNull(gebuehrDialog)}
                style={{ flex: 1, minWidth: 90, padding: '0.75rem', borderRadius: 8, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.1)', color: '#c084fc', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}
              >
                🎁 Kostenlos
              </button>
            </div>
            <button
              onClick={() => setGebuehrDialog(null)}
              style={{ marginTop: '0.75rem', width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'var(--ds-text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {/* Erinnerung Bestätigungs-Dialog */}
      {erinnerungDialog && createPortal(
        <div className="pv3-auswahl-modal-overlay" style={{ zIndex: 10000 }} onClick={() => setErinnerungDialog(null)}>
          <div className="pv3-auswahl-modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 10px', fontSize: '1.1rem', color: 'var(--text-primary, #e8eaed)' }}>
              🔔 Erinnerung senden
            </h3>
            <p className="pv3-auswahl-muted-p" style={{ marginBottom: '4px' }}>
              Termin: <strong style={{ color: 'var(--text-primary, #e8eaed)' }}>{erinnerungDialog.group.datum
                ? new Date(erinnerungDialog.group.datum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
                : '–'}</strong>
            </p>
            <p className="pv3-auswahl-muted-p">
              {erinnerungDialog.ohneAntwort.length} Mitglied{erinnerungDialog.ohneAntwort.length !== 1 ? 'er haben' : ' hat'} noch nicht geantwortet:
            </p>
            <ul style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 6, padding: '10px 16px', marginBottom: '14px', listStyle: 'none' }}>
              {erinnerungDialog.ohneAntwort.slice(0, 8).map(c => (
                <li key={c.pruefung_id} style={{ color: 'var(--text-primary, #e8eaed)', fontSize: '14px', padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  {c.vorname} {c.nachname}
                </li>
              ))}
              {erinnerungDialog.ohneAntwort.length > 8 && (
                <li style={{ color: 'var(--text-secondary, #888)', fontSize: '13px', paddingTop: '6px' }}>… und {erinnerungDialog.ohneAntwort.length - 8} weitere</li>
              )}
            </ul>
            <p style={{ color: 'var(--text-secondary, #888)', fontSize: '13px', marginBottom: '20px', lineHeight: 1.5 }}>
              Jedes Mitglied erhält eine <strong style={{ color: 'var(--text-primary, #e8eaed)' }}>E-Mail</strong> und eine <strong style={{ color: 'var(--text-primary, #e8eaed)' }}>Push-Benachrichtigung</strong> mit der Bitte zur Rückmeldung.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setErinnerungDialog(null)}
                style={{ padding: '9px 18px', border: '1px solid var(--border-color, #333)', borderRadius: 6, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary, #888)', fontSize: '14px' }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleErinnerungBestaetigen}
                style={{ padding: '9px 20px', borderRadius: 6, border: 'none', background: '#c8a84b', color: 'var(--ds-text)', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}
              >
                🔔 Jetzt erinnern
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {activeTab === 'kalender' && (
        <div style={{ padding: '16px 0 24px 0', minHeight: 200 }}>
          <KalenderErrorBoundary>
            <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#d4af37', fontWeight: 600 }}>Kalender wird geladen…</div>}>
              <KalenderZentrale
                onDayClick={(date) => {
                  const dateStr = date.toISOString().split('T')[0];
                  setNeuerTermin(prev => ({ ...prev, pruefungsdatum: dateStr }));
                  setShowNeuerTerminModal(true);
                }}
              />
            </Suspense>
          </KalenderErrorBoundary>
        </div>
      )}

    </div>
  );
};

export default PruefungsVerwaltung;
