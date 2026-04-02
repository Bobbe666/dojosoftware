// ============================================================================
// PRÜFUNG DURCHFÜHREN - Live Prüfungsansicht für den Prüfungstag
// Frontend/src/components/PruefungDurchfuehren.jsx
// Route: /dashboard/pruefung-durchfuehren
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDojoContext } from '../context/DojoContext';
import { Check, X, ChevronUp, ChevronDown, Award, Save, Calendar, AlertCircle, Clock } from 'lucide-react';
import '../styles/themes.css';
import '../styles/components.css';
import '../styles/Buttons.css';
import '../styles/Dashboard.css';
import '../styles/PruefungDurchfuehren.css';

// Prüfungsordnung-Presets für den Sparring-Timer
const TIMER_PRESETS = [
  {
    id: 'kyu',
    label: 'Kyu (Boxen/Kicken/Kombi)',
    blöcke: [
      { name: 'Boxen',          runden: 3, rundenzeit: 120, pausezeit: 60 },
      { name: 'Kicken',         runden: 3, rundenzeit: 120, pausezeit: 60 },
      { name: 'Kombitechniken', runden: 3, rundenzeit: 120, pausezeit: 60 },
    ]
  },
  {
    id: 'dan',
    label: 'Dan (Boxen/Fuß/Point/Cont.)',
    blöcke: [
      { name: 'Boxen',      runden: 3, rundenzeit: 120, pausezeit: 60 },
      { name: 'Fuß',        runden: 3, rundenzeit: 120, pausezeit: 60 },
      { name: 'Point',      runden: 3, rundenzeit: 120, pausezeit: 60 },
      { name: 'Continuous', runden: 3, rundenzeit: 120, pausezeit: 60 },
    ]
  }
];

const presetZuBlöcke = (preset) =>
  preset.blöcke.map((b, i) => ({ ...b, id: Date.now() + i, erledigt: false }));

const PruefungDurchfuehren = () => {
  const { getDojoFilterParam, activeDojo } = useDojoContext();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const API_BASE_URL = '/api';

  // State
  const [pruefungen, setPruefungen] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [datumFilter, setDatumFilter] = useState('alle'); // alle, zukuenftig, vergangen
  const [selectedDatum, setSelectedDatum] = useState(searchParams.get('datum') || '');
  const [selectedStil, setSelectedStil] = useState('all');
  const [expandedDates, setExpandedDates] = useState(new Set());
  const [stile, setStile] = useState([]);
  const [graduierungen, setGraduierungen] = useState({});

  // Inline Prüfling bearbeiten
  const [editingPruefling, setEditingPruefling] = useState(null);
  const [ergebnisse, setErgebnisse] = useState({}); // Key: pruefung_id, Value: ergebnis-Objekt

  // Bewertungs-States
  const [pruefungsinhalte, setPruefungsinhalte] = useState({}); // Key: pruefung_id, Value: Inhalte
  const [bewertungen, setBewertungen] = useState({}); // Key: pruefung_id, Value: Bewertungen-Objekt

  // Gesprungene Techniken: Toggle pro Prüfling (Key: pruefung_id)
  const [gesprungeneAktiv, setGesprungeneAktiv] = useState({});

  // Freie Techniken: {pruefung_id: {kat: [{id, titel}]}}
  const [pdFreieTechniken, setPdFreieTechniken] = useState({});
  const [pdFreiInputKey, setPdFreiInputKey] = useState(null); // `${pruefung_id}_${kat}`
  const [pdFreiInputText, setPdFreiInputText] = useState('');
  // Ausgeklappte Kategorien pro Prüfling: Key = `${pruefung_id}_${kategorie}`, Value = boolean
  const [kategorienExpanded, setKategorienExpanded] = useState({});

  // Prüfungs-Timer
  const [timerVisible, setTimerVisible] = useState(false);
  const [timerModus, setTimerModus] = useState('blöcke'); // 'einfach' | 'blöcke'
  // Einfach-Modus Einstellungen
  const [timerEinfachRunden, setTimerEinfachRunden] = useState(3);
  const [timerEinfachRundenzeit, setTimerEinfachRundenzeit] = useState(120);
  const [timerEinfachPausezeit, setTimerEinfachPausezeit] = useState(60);
  // Blöcke: [{ id, name, runden, rundenzeit, pausezeit, erledigt }]
  const [timerBlöcke, setTimerBlöcke] = useState(() => presetZuBlöcke(TIMER_PRESETS[0]));
  const [timerAktivBlockIdx, setTimerAktivBlockIdx] = useState(0);
  const [timerPhase, setTimerPhase] = useState('bereit'); // 'bereit'|'runde'|'pause'|'blockpause'|'fertig'
  const [timerSekundenLeft, setTimerSekundenLeft] = useState(0);
  const [timerAktuelleRunde, setTimerAktuelleRunde] = useState(1);
  const [timerLaeuft, setTimerLaeuft] = useState(false);
  const timerIntervalRef = useRef(null);
  const timerDataRef = useRef({});
  const timerSaveRef = useRef(null);
  const timerConfigGeladen = useRef(false);
  const ergebnisseRef = useRef({});
  const ergebnisAutoSaveTimers = useRef({});

  // Auto-Save
  const [autoSaveStatus, setAutoSaveStatus] = useState({}); // Key: pruefung_id → 'saving'|'saved'
  const autoSaveTimers = useRef({});
  const bewertungenRef = useRef({});
  const pruefungsinhalteRef = useRef({});
  const gesprungeneAktivRef = useRef({});
  useEffect(() => { bewertungenRef.current = bewertungen; }, [bewertungen]);
  useEffect(() => { pruefungsinhalteRef.current = pruefungsinhalte; }, [pruefungsinhalte]);
  useEffect(() => { ergebnisseRef.current = ergebnisse; }, [ergebnisse]);

  useEffect(() => { gesprungeneAktivRef.current = gesprungeneAktiv; }, [gesprungeneAktiv]);
  useEffect(() => { return () => { clearInterval(timerIntervalRef.current); clearTimeout(timerSaveRef.current); }; }, []);

  // Prüfungsprotokoll
  const [protokollModal, setProtokolModal] = useState(null); // pruefung_id
  const [protokollForm, setProtokolForm] = useState({ gesamtkommentar: '', staerken: '', verbesserungen: '', empfehlungen: '' });
  const [protokollStatus, setProtokolStatus] = useState({}); // Key: pruefung_id → protokoll-Objekt oder null
  const [protokollSaving, setProtokolSaving] = useState(false);
  const [protokollSending, setProtokolSending] = useState(false);

  // Prüfungsprotokoll laden (für alle sichtbaren Prüfungen)
  const loadProtokolle = async (pruefungIds) => {
    for (const pid of pruefungIds) {
      try {
        const token = localStorage.getItem('dojo_auth_token');
        const r = await fetch(`${API_BASE_URL}/pruefungen/${pid}/protokoll`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const d = await r.json();
        if (d.success) {
          setProtokolStatus(prev => ({ ...prev, [pid]: d.protokoll }));
        }
      } catch (_) {}
    }
  };

  const openProtokolModal = (pruefling) => {
    const existing = protokollStatus[pruefling.pruefung_id];
    setProtokolForm({
      gesamtkommentar: existing?.gesamtkommentar || pruefling.prueferkommentar || '',
      staerken: existing?.staerken || '',
      verbesserungen: existing?.verbesserungen || '',
      empfehlungen: existing?.empfehlungen || ''
    });
    setProtokolModal(pruefling.pruefung_id);
  };

  const handleProtokolSave = async (pruefung_id) => {
    setProtokolSaving(true);
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const r = await fetch(`${API_BASE_URL}/pruefungen/${pruefung_id}/protokoll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(protokollForm)
      });
      const d = await r.json();
      if (d.success) {
        setProtokolStatus(prev => ({ ...prev, [pruefung_id]: d.protokoll }));
        setSuccess('Protokoll gespeichert!');
        setTimeout(() => setSuccess(''), 2500);
      }
    } catch (err) {
      setError('Protokoll konnte nicht gespeichert werden');
      setTimeout(() => setError(''), 3000);
    } finally {
      setProtokolSaving(false);
    }
  };

  const handleProtokolSenden = async (pruefung_id) => {
    setProtokolSending(true);
    try {
      const token = localStorage.getItem('dojo_auth_token');
      const r = await fetch(`${API_BASE_URL}/pruefungen/${pruefung_id}/protokoll/senden`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await r.json();
      if (d.success) {
        setProtokolStatus(prev => ({ ...prev, [pruefung_id]: { ...prev[pruefung_id], gesendet_am: new Date().toISOString() } }));
        setSuccess(`Protokoll gesendet an ${d.sentTo}`);
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(d.error || 'Senden fehlgeschlagen');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      setError('Protokoll konnte nicht gesendet werden');
      setTimeout(() => setError(''), 3000);
    } finally {
      setProtokolSending(false);
    }
  };

  // Prüfungs-Einstellungen (teilt localStorage-Key mit Batch-Modal in PruefungsVerwaltung)
  const PRUEF_SETTINGS_KEY = 'pruefungs_einstellungen';
  const DEFAULT_PRUEF_SETTINGS = { bestanden_item_punkte: 5, bestanden_gesamt_prozent: 50, max_punkte_item: 10, punkte_modus: 'halb' };
  const [pruefSettings, setPruefSettings] = useState(() => {
    try { return { ...DEFAULT_PRUEF_SETTINGS, ...JSON.parse(localStorage.getItem(PRUEF_SETTINGS_KEY) || '{}') }; }
    catch { return { ...DEFAULT_PRUEF_SETTINGS }; }
  });
  const [showPruefSettings, setShowPruefSettings] = useState(false);
  const savePruefSettings = (s) => {
    setPruefSettings(s);
    localStorage.setItem(PRUEF_SETTINGS_KEY, JSON.stringify(s));
  };
  const genPunkteOptions = (max, modus) => {
    const opts = [];
    if (modus === 'ganz') { for (let i = 0; i <= max; i++) opts.push(i); }
    else if (modus === 'halb') { for (let i = 0; i <= max * 2; i++) opts.push(Math.round(i * 5) / 10); }
    else { for (let i = 0; i <= max * 10; i++) opts.push(Math.round(i) / 10); }
    return opts;
  };

  // Timer-Config: Laden aus DB
  const fetchTimerConfig = async () => {
    try {
      const dojoParam = getDojoFilterParam();
      const res = await fetch(`${API_BASE_URL}/pruefungen/timer-config?${dojoParam}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) return;
      const config = await res.json();
      if (!config) return;
      timerConfigGeladen.current = true;
      setTimerModus(config.modus === 'einfach' ? 'einfach' : 'blöcke');
      if (config.einfach_runden) setTimerEinfachRunden(config.einfach_runden);
      if (config.einfach_rundenzeit) setTimerEinfachRundenzeit(config.einfach_rundenzeit);
      if (config.einfach_pausezeit) setTimerEinfachPausezeit(config.einfach_pausezeit);
      if (config.bloecke && config.bloecke.length > 0) {
        setTimerBlöcke(config.bloecke.map((b, i) => ({ ...b, id: Date.now() + i, erledigt: false })));
      }
    } catch (err) {
      console.error('Timer-Config laden fehlgeschlagen:', err);
    }
  };

  // Timer-Config: Auto-Save bei Änderungen (debounced, nur wenn bereits geladen)
  useEffect(() => {
    if (!timerConfigGeladen.current) return;
    if (timerLaeuft) return;
    clearTimeout(timerSaveRef.current);
    timerSaveRef.current = setTimeout(() => {
      const dojoParam = getDojoFilterParam();
      fetch(`${API_BASE_URL}/pruefungen/timer-config?${dojoParam}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({
          modus: timerModus,
          einfach_runden: timerEinfachRunden,
          einfach_rundenzeit: timerEinfachRundenzeit,
          einfach_pausezeit: timerEinfachPausezeit,
          bloecke: timerBlöcke.map(b => ({ name: b.name, runden: b.runden, rundenzeit: b.rundenzeit, pausezeit: b.pausezeit }))
        })
      }).catch(() => {});
    }, 1500);
  }, [timerModus, timerBlöcke, timerEinfachRunden, timerEinfachRundenzeit, timerEinfachPausezeit]);
  const toggleKategorie = (pruefungId, kategorie) => {
    const key = `${pruefungId}_${kategorie}`;
    setKategorienExpanded(prev => ({ ...prev, [key]: !(prev[key] ?? true) }));
  };
  const isKategorieExpanded = (pruefungId, kategorie) => {
    const key = `${pruefungId}_${kategorie}`;
    return kategorienExpanded[key] ?? true; // Standard: aufgeklappt
  };

  // Artikel-Banner nach bestandener Prüfung
  const [artikelBanner, setArtikelBanner] = useState(null);
  // { datum, bestanden: [{ name, neuerGurt, stilName }] }

  // Extern-Modal
  const [showExternModal, setShowExternModal] = useState(false);
  const [externModalDatum, setExternModalDatum] = useState('');
  const [externForm, setExternForm] = useState({ vorname: '', nachname: '', verein: '', stil_id: '', graduierung_nachher_id: '' });

  useEffect(() => {
    fetchStile();
    fetchPruefungen();
    fetchTimerConfig();
  }, []);

  // Auto-Summe: Wenn Bewertungen geändert werden → Gesamtpunktzahl oben aktualisieren
  useEffect(() => {
    Object.entries(bewertungen).forEach(([pid, kategorien]) => {
      const pruefungId = parseInt(pid);
      const gesprungAktiv = gesprungeneAktiv[pruefungId] || false;

      const inhalteObj = pruefungsinhalte[pruefungId] || {};
      const allInhalte = Object.values(inhalteObj).flat();
      // Nur Inhalte MIT Punkte-Bewertung + gesprungen nur wenn Toggle aktiv
      const mitPunkte = allInhalte.filter(i => !i.ohne_punkte && (gesprungAktiv || !i.ist_gesprungen));
      const mitPunkteIds = new Set(mitPunkte.map(i => i.id));

      const allBew = Object.values(kategorien).flat().filter(b => mitPunkteIds.has(b.inhalt_id));
      if (allBew.length === 0 && mitPunkte.length === 0) return;

      const totalPunkte = allBew.reduce((s, b) => s + (parseFloat(b.punktzahl) || 0), 0);
      // Gesprungene nur in Max einrechnen wenn Punkte eingetragen wurden
      const mitEingetragenenPunktenIds = new Set(
        allBew.filter(b => b.punktzahl !== undefined && b.punktzahl !== null && b.punktzahl !== '').map(b => b.inhalt_id)
      );
      const totalMax = mitPunkte.reduce((s, i) => {
        if (i.ist_gesprungen && !mitEingetragenenPunktenIds.has(i.id)) return s;
        return s + (parseFloat(i.max_punktzahl) || 10);
      }, 0);

      setErgebnisse(prev => {
        const ergebnis = prev[pruefungId];
        if (!ergebnis) return prev;
        return {
          ...prev,
          [pruefungId]: {
            ...ergebnis,
            // bestanden und Gurt-Info explizit bewahren – nicht überschreiben
            bestanden: ergebnis.bestanden,
            neuer_gurt_id: ergebnis.neuer_gurt_id,
            neuer_gurt_name: ergebnis.neuer_gurt_name,
            neuer_gurt_farbe: ergebnis.neuer_gurt_farbe,
            neuer_gurt_index: ergebnis.neuer_gurt_index,
            punktzahl: totalPunkte,
            ...(totalMax > 0 ? { max_punktzahl: totalMax } : {})
          }
        };
      });
    });
  }, [bewertungen, pruefungsinhalte, gesprungeneAktiv]);

  const fetchStile = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/stile`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      console.log('📚 Stile geladen:', data);
      setStile(data || []);

      // Graduierungen für jeden Stil laden
      const gradMap = {};
      for (const stil of data) {
        const stilId = stil.stil_id || stil.id;
        const gradRes = await fetch(`${API_BASE_URL}/stile/${stilId}/graduierungen`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const gradData = await gradRes.json();
        console.log(`🥋 Graduierungen für ${stil.name} (ID: ${stilId}):`, gradData);
        gradMap[stilId] = gradData || [];
      }
      console.log('✅ Alle Graduierungen geladen:', gradMap);
      setGraduierungen(gradMap);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Stile:', error);
    }
  };

  const fetchPruefungen = async () => {
    setLoading(true);
    setError('');
    try {
      const dojoParam = getDojoFilterParam();
      // Lade alle Prüfungen (geplant, bestanden, nicht_bestanden) für die Durchführung
      const response = await fetch(
        `${API_BASE_URL}/pruefungen?${dojoParam}`,
        {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        }
      );

      if (!response.ok) throw new Error('Fehler beim Laden der Prüfungen');

      const data = await response.json();
      console.log('📋 Alle Prüfungen geladen:', data);
      // Backend gibt { success: true, count: X, pruefungen: [...] } zurück
      const pruefungenListe = data.pruefungen || [];
      setPruefungen(pruefungenListe);
      // Protokolle für abgeschlossene Prüfungen laden
      const abgeschlossene = pruefungenListe
        .filter(p => p.status === 'bestanden' || p.status === 'nicht_bestanden')
        .map(p => p.pruefung_id);
      if (abgeschlossene.length > 0) loadProtokolle(abgeschlossene);
      // gesprungeneAktiv aus DB-Wert mit_gesprungenen wiederherstellen
      setGesprungeneAktiv(prev => {
        const next = { ...prev };
        pruefungenListe.forEach(p => {
          if (p.mit_gesprungenen) next[p.pruefung_id] = true;
        });
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExternHinzufuegen = async () => {
    if (!externForm.vorname.trim() || !externForm.nachname.trim()) {
      setError('Vorname und Nachname sind Pflichtfelder');
      return;
    }
    if (!externForm.stil_id || !externForm.graduierung_nachher_id) {
      setError('Bitte Stil und Ziel-Graduierung auswählen');
      return;
    }
    try {
      const response = await fetch(`${API_BASE_URL}/pruefungen/kandidaten/extern`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          extern_vorname: externForm.vorname.trim(),
          extern_nachname: externForm.nachname.trim(),
          extern_verein: externForm.verein.trim() || null,
          stil_id: parseInt(externForm.stil_id),
          graduierung_nachher_id: parseInt(externForm.graduierung_nachher_id),
          pruefungsdatum: externModalDatum,
          dojo_id: activeDojo?.id
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fehler beim Hinzufügen');
      setSuccess(`${externForm.vorname} ${externForm.nachname} wurde hinzugefügt!`);
      setTimeout(() => setSuccess(''), 3000);
      setShowExternModal(false);
      setExternForm({ vorname: '', nachname: '', verein: '', stil_id: '', graduierung_nachher_id: '' });
      fetchPruefungen();
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleToggleEdit = (pruefling) => {
    if (editingPruefling?.pruefung_id === pruefling.pruefung_id) {
      // Bereits im Edit-Modus, also schließen
      setEditingPruefling(null);
    } else {
      // Graduierungen für diesen Stil laden
      const grads = graduierungen[pruefling.stil_id] || [];
      console.log('🎯 Graduierungen für Stil', pruefling.stil_id, ':', grads);
      console.log('📋 Prüfling:', pruefling);

      // Prüfe ob bereits eine Graduierung gespeichert ist
      let targetGurtIndex, targetGurt;

      if (pruefling.graduierung_nachher_id) {
        // Verwende gespeicherte Graduierung
        targetGurtIndex = grads.findIndex(g => g.id === pruefling.graduierung_nachher_id);
        targetGurt = grads[targetGurtIndex];
        console.log('📌 Verwende gespeicherte Graduierung:', targetGurt);
      } else {
        // Berechne nächste Graduierung
        const currentIndex = grads.findIndex(g => g.id === pruefling.graduierung_vorher_id);
        targetGurtIndex = Math.min(currentIndex + 1, grads.length - 1);
        targetGurt = grads[targetGurtIndex];
        console.log('🆕 Berechne nächste Graduierung:', targetGurt);
      }

      console.log('📍 Target Index:', targetGurtIndex);
      console.log('🥋 Target Gurt:', targetGurt);

      // Ergebnisse IMMER neu setzen, auch wenn schon vorhanden
      const neuesErgebnis = {
        bestanden: pruefling.bestanden || false,
        punktzahl: pruefling.punktzahl || '',
        max_punktzahl: pruefling.max_punktzahl || 100,
        prueferkommentar: pruefling.prueferkommentar || '',
        neuer_gurt_index: targetGurtIndex,
        neuer_gurt_id: targetGurt?.id || pruefling.graduierung_nachher_id,
        neuer_gurt_name: targetGurt?.name || '',
        neuer_gurt_farbe: targetGurt?.farbe_hex || ''
      };

      console.log('✅ Neues Ergebnis:', neuesErgebnis);

      // State synchron setzen
      setErgebnisse(prev => ({
        ...prev,
        [pruefling.pruefung_id]: neuesErgebnis
      }));

      // Editing-Modus öffnen
      setEditingPruefling(pruefling);
      // Lade Prüfungsinhalte
      loadPruefungsinhalte(pruefling.pruefung_id, pruefling.stil_id, targetGurt?.id || pruefling.graduierung_nachher_id);
    }
  };

  const handleGurtAendern = (pruefungId, stilId, richtung) => {
    console.log(`🔄 Gurt ändern: Prüfung ${pruefungId}, Stil ${stilId}, Richtung: ${richtung}`);

    setErgebnisse(prev => {
      const grads = graduierungen[stilId] || [];
      console.log('📋 Verfügbare Graduierungen:', grads);

      const currentErgebnis = prev[pruefungId];
      if (!currentErgebnis) {
        console.log('❌ Kein Ergebnis gefunden für Prüfung', pruefungId);
        return prev;
      }

      let newIndex = currentErgebnis.neuer_gurt_index;
      console.log('📍 Aktueller Index:', newIndex);

      if (richtung === 'up') {
        newIndex = Math.min(newIndex + 1, grads.length - 1);
      } else if (richtung === 'down') {
        newIndex = Math.max(newIndex - 1, 0);
      }

      console.log('📍 Neuer Index:', newIndex);

      const newGrad = grads[newIndex];
      if (!newGrad) {
        console.log('❌ Keine Graduierung für Index', newIndex);
        return prev;
      }

      console.log('✅ Neue Graduierung:', newGrad);

      return {
        ...prev,
        [pruefungId]: {
          ...currentErgebnis,
          neuer_gurt_index: newIndex,
          neuer_gurt_id: newGrad.id,
          neuer_gurt_name: newGrad.name,
          neuer_gurt_farbe: newGrad.farbe_hex
        }
      };
    });
  };

  const scheduleErgebnisAutoSave = (pruefungId) => {
    clearTimeout(ergebnisAutoSaveTimers.current[pruefungId]);
    ergebnisAutoSaveTimers.current[pruefungId] = setTimeout(async () => {
      const ergebnis = ergebnisseRef.current[pruefungId];
      if (!ergebnis) return;
      try {
        await fetch(`${API_BASE_URL}/pruefungen/${pruefungId}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bestanden: ergebnis.bestanden,
            status: ergebnis.bestanden ? 'bestanden' : 'nicht_bestanden'
          })
        });
      } catch (e) { console.error('Ergebnis auto-save failed:', e); }
    }, 800);
  };

  const updateErgebnis = (pruefungId, field, value) => {
    setErgebnisse(prev => ({
      ...prev,
      [pruefungId]: {
        ...prev[pruefungId],
        [field]: value
      }
    }));
    if (field === 'bestanden') scheduleErgebnisAutoSave(pruefungId);
  };

  const handleSpeichern = async (pruefling) => {
    const ergebnis = ergebnisse[pruefling.pruefung_id];
    if (!ergebnis) return;

    try {
      setLoading(true);
      // Prüfungsergebnis speichern
      const updateData = {
        bestanden: ergebnis.bestanden,
        punktzahl: ergebnis.punktzahl ? parseFloat(ergebnis.punktzahl) : null,
        max_punktzahl: ergebnis.max_punktzahl ? parseFloat(ergebnis.max_punktzahl) : null,
        prueferkommentar: ergebnis.prueferkommentar,
        status: ergebnis.bestanden ? 'bestanden' : 'nicht_bestanden'
      };

      // Bei bestandener Prüfung: graduierung_nachher_id mit neuem Gurt aktualisieren
      if (ergebnis.bestanden && ergebnis.neuer_gurt_id) {
        updateData.graduierung_nachher_id = ergebnis.neuer_gurt_id;
      }

      const response = await fetch(
        `${API_BASE_URL}/pruefungen/${pruefling.pruefung_id}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updateData)
        }
      );

      if (!response.ok) throw new Error('Fehler beim Speichern');

      // Bei bestandener Prüfung: Gurt aktualisieren
      if (ergebnis.bestanden && ergebnis.neuer_gurt_id) {
        console.log('🎖️ Aktualisiere Graduierung:', {
          mitglied_id: pruefling.mitglied_id,
          stil_id: pruefling.stil_id,
          graduierung_id: ergebnis.neuer_gurt_id,
          pruefungsdatum: pruefling.pruefungsdatum,
          pruefling: pruefling
        });

        await updateMemberGraduierung(
          pruefling.mitglied_id,
          pruefling.stil_id,
          ergebnis.neuer_gurt_id,
          pruefling.pruefungsdatum
        );
      }

      
      // Bewertungen speichern
      const pruefungBewertungen = bewertungen[pruefling.pruefung_id];
      if (pruefungBewertungen) {
        // Gesprungene inhalt_ids ermitteln
        const allInhalteFuerPruefling = Object.values(pruefungsinhalte[pruefling.pruefung_id] || {}).flat();
        const gesprungeneIds = new Set(allInhalteFuerPruefling.filter(i => i.ist_gesprungen).map(i => i.id));
        const gesprungAktiv = gesprungeneAktiv[pruefling.pruefung_id] || false;

        const bewertungenArray = [];
        Object.values(pruefungBewertungen).forEach(kategorieBewertungen => {
          if (Array.isArray(kategorieBewertungen)) {
            kategorieBewertungen.forEach(bew => {
              // Gesprungene Bewertungen nur speichern wenn Toggle aktiv
              if (!gesprungAktiv && gesprungeneIds.has(bew.inhalt_id)) return;
              bewertungenArray.push({
                inhalt_id: bew.inhalt_id,
                bestanden: bew.bestanden,
                punktzahl: bew.punktzahl,
                max_punktzahl: bew.max_punktzahl || 10,
                kommentar: bew.kommentar
              });
            });
          }
        });

        if (bewertungenArray.length > 0) {
          await fetch(`${API_BASE_URL}/pruefungen/${pruefling.pruefung_id}/bewertungen`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bewertungen: bewertungenArray })
          });
        }
      }

      setSuccess('Prüfungsergebnis erfolgreich gespeichert!');
      setEditingPruefling(null);
      fetchPruefungen();

      // Artikel-Vorschlag wenn bestanden
      if (ergebnis.bestanden) {
        const name = [pruefling.vorname, pruefling.nachname].filter(Boolean).join(' ');
        setArtikelBanner({
          datum: pruefling.pruefungsdatum,
          bestanden: [{ name, neuerGurt: ergebnis.neuer_gurt_name || '', stilName: pruefling.stil_name || '' }]
        });
      }

      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Alle Prüflinge eines Termins auf einmal speichern
  const handleAlleSpeichern = async (prueflingeList) => {
    setLoading(true);
    let ok = 0, fail = 0;
    try {
      for (const pruefling of prueflingeList) {
        const ergebnis = ergebnisse[pruefling.pruefung_id];
        if (!ergebnis) continue;
        try {
          const updateData = {
            bestanden: ergebnis.bestanden,
            punktzahl: ergebnis.punktzahl ? parseFloat(ergebnis.punktzahl) : null,
            max_punktzahl: ergebnis.max_punktzahl ? parseFloat(ergebnis.max_punktzahl) : null,
            prueferkommentar: ergebnis.prueferkommentar,
            status: ergebnis.bestanden ? 'bestanden' : 'nicht_bestanden'
          };
          if (ergebnis.bestanden && ergebnis.neuer_gurt_id) {
            updateData.graduierung_nachher_id = ergebnis.neuer_gurt_id;
          }
          const response = await fetch(`${API_BASE_URL}/pruefungen/${pruefling.pruefung_id}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
          });
          if (response.ok) {
            if (ergebnis.bestanden && ergebnis.neuer_gurt_id) {
              await updateMemberGraduierung(pruefling.mitglied_id, pruefling.stil_id, ergebnis.neuer_gurt_id, pruefling.pruefungsdatum);
            }
            // Bewertungen speichern
            const pruefungBewertungen = bewertungen[pruefling.pruefung_id];
            if (pruefungBewertungen) {
              const allInhalte = Object.values(pruefungsinhalte[pruefling.pruefung_id] || {}).flat();
              const gesprungeneIds = new Set(allInhalte.filter(i => i.ist_gesprungen).map(i => i.id));
              const gesprungAktiv = gesprungeneAktiv[pruefling.pruefung_id] || false;
              const arr = [];
              Object.values(pruefungBewertungen).forEach(katArr => {
                if (Array.isArray(katArr)) {
                  katArr.forEach(bew => {
                    if (!gesprungAktiv && gesprungeneIds.has(bew.inhalt_id)) return;
                    arr.push({ inhalt_id: bew.inhalt_id, bestanden: bew.bestanden, punktzahl: bew.punktzahl, max_punktzahl: bew.max_punktzahl || 10, kommentar: bew.kommentar });
                  });
                }
              });
              if (arr.length > 0) {
                await fetch(`${API_BASE_URL}/pruefungen/${pruefling.pruefung_id}/bewertungen`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ bewertungen: arr })
                });
              }
            }
            ok++;
          } else { fail++; }
        } catch (e) { fail++; }
      }
    } finally {
      setLoading(false);
      fetchPruefungen();
      setSuccess(`${ok} Prüfling${ok !== 1 ? 'e' : ''} gespeichert${fail > 0 ? `, ${fail} Fehler` : '!'}`);
      setTimeout(() => setSuccess(''), 4000);

      // Artikel-Vorschlag für alle bestandenen Prüflinge
      const bestandenListe = prueflingeList
        .filter(p => ergebnisseRef.current[p.pruefung_id]?.bestanden)
        .map(p => ({
          name: [p.vorname, p.nachname].filter(Boolean).join(' '),
          neuerGurt: ergebnisseRef.current[p.pruefung_id]?.neuer_gurt_name || '',
          stilName: p.stil_name || ''
        }));
      if (bestandenListe.length > 0) {
        setArtikelBanner({ datum: prueflingeList[0]?.pruefungsdatum, bestanden: bestandenListe });
      }
    }
  };

  // Alle Items einer Kategorie auf bestanden setzen
  const markKatBestanden = (pruefungId, kategorie, inhalte) => {
    setBewertungen(prev => {
      const pruefungBewertungen = prev[pruefungId] || {};
      const kategorieBewertungen = {};
      Object.keys(pruefungBewertungen).forEach(key => { kategorieBewertungen[key] = [...pruefungBewertungen[key]]; });
      if (!kategorieBewertungen[kategorie]) kategorieBewertungen[kategorie] = [];
      const updated = [...kategorieBewertungen[kategorie]];
      inhalte.forEach(inhalt => {
        const inhaltId = inhalt.id || inhalt.inhalt_id;
        const idx = updated.findIndex(b => b.inhalt_id === inhaltId);
        if (idx >= 0) { updated[idx] = { ...updated[idx], bestanden: true }; }
        else { updated.push({ inhalt_id: inhaltId, bestanden: true }); }
      });
      return { ...prev, [pruefungId]: { ...kategorieBewertungen, [kategorie]: updated } };
    });
    scheduleAutoSave(pruefungId);
  };

  const updateMemberGraduierung = async (mitgliedId, stilId, graduierungId, pruefungsdatum) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/mitglieder/${mitgliedId}/graduierung`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            stil_id: stilId,
            graduierung_id: graduierungId,
            pruefungsdatum: pruefungsdatum
          })
        }
      );

      if (!response.ok) throw new Error('Fehler beim Aktualisieren der Graduierung');
    } catch (error) {
      console.error('Fehler beim Aktualisieren der Graduierung:', error);
      throw error;
    }
  };

  // Lädt Prüfungsinhalte für eine Graduierung
  const loadPruefungsinhalte = async (pruefungId, stilId, graduierungId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/stile/${stilId}/graduierungen/${graduierungId}/pruefungsinhalte`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );

      if (!response.ok) {
        console.error('Fehler beim Laden der Prüfungsinhalte');
        return;
      }

      const data = await response.json();
      console.log('📚 Prüfungsinhalte geladen:', data);

      setPruefungsinhalte(prev => ({
        ...prev,
        [pruefungId]: data.pruefungsinhalte || {}
      }));

      // Lade bestehende Bewertungen
      await loadBewertungen(pruefungId);
    } catch (error) {
      console.error('Fehler beim Laden der Prüfungsinhalte:', error);
    }
  };

  // Lädt bestehende Bewertungen für eine Prüfung
  const loadBewertungen = async (pruefungId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/pruefungen/${pruefungId}/bewertungen`,
        { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }
      );

      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.bewertungen) {
        setBewertungen(prev => ({
          ...prev,
          [pruefungId]: data.bewertungen
        }));
      }
    } catch (error) {
      console.error('Fehler beim Laden der Bewertungen:', error);
    }
  };

  const addPdFreieTechnik = (pruefungId, kat, titel) => {
    if (!titel.trim()) return;
    const id = `free_${Date.now()}`;
    setPdFreieTechniken(prev => ({
      ...prev,
      [pruefungId]: {
        ...(prev[pruefungId] || {}),
        [kat]: [...((prev[pruefungId]?.[kat]) || []), { id, titel: titel.trim() }]
      }
    }));
    setPdFreiInputKey(null);
    setPdFreiInputText('');
  };

  const removePdFreieTechnik = (pruefungId, kat, id) => {
    setPdFreieTechniken(prev => ({
      ...prev,
      [pruefungId]: {
        ...(prev[pruefungId] || {}),
        [kat]: (prev[pruefungId]?.[kat] || []).filter(t => t.id !== id)
      }
    }));
  };

  // Aktualisiert eine einzelne Bewertung
  const updateBewertung = (pruefungId, inhaltId, kategorie, field, value) => {
    console.log('🔧 updateBewertung called:', { pruefungId, inhaltId, kategorie, field, value });

    setBewertungen(prev => {
      const pruefungBewertungen = prev[pruefungId] || {};

      // Kopiere die Kategorie-Arrays, um Mutation zu vermeiden
      const kategorieBewertungen = {};
      Object.keys(pruefungBewertungen).forEach(key => {
        kategorieBewertungen[key] = [...pruefungBewertungen[key]];
      });

      // Stelle sicher, dass Kategorie-Array existiert
      if (!kategorieBewertungen[kategorie]) {
        kategorieBewertungen[kategorie] = [];
      }

      // Finde bestehende Bewertung oder erstelle neue
      const existingIndex = kategorieBewertungen[kategorie].findIndex(b => b.inhalt_id === inhaltId);

      // Auto-Threshold: wenn Punkte >= Schwelle, automatisch bestanden setzen
      let additionalFields = {};
      if (field === 'punktzahl') {
        const newPkt = parseFloat(value);
        const existingBew = existingIndex >= 0 ? kategorieBewertungen[kategorie][existingIndex] : {};
        if (!isNaN(newPkt) && existingBew.bestanden !== false) {
          additionalFields.bestanden = newPkt >= (pruefSettings.bestanden_item_punkte ?? 5);
        }
      }

      if (existingIndex >= 0) {
        // Aktualisiere bestehende Bewertung - erstelle neues Array
        kategorieBewertungen[kategorie] = kategorieBewertungen[kategorie].map((bew, idx) =>
          idx === existingIndex
            ? { ...bew, [field]: value, ...additionalFields }
            : bew
        );
      } else {
        // Erstelle neue Bewertung
        const newBewertung = {
          inhalt_id: inhaltId,
          [field]: value,
          ...additionalFields
        };
        kategorieBewertungen[kategorie] = [...kategorieBewertungen[kategorie], newBewertung];
      }

      const result = {
        ...prev,
        [pruefungId]: kategorieBewertungen
      };
      console.log('📦 New bewertungen state:', result);
      return result;
    });

    // Auto-Save nach 1,5s
    scheduleAutoSave(pruefungId);
  };



  // Auto-Save: Bewertungen nach 1,5s Debounce speichern
  const scheduleAutoSave = (pruefungId) => {
    if (autoSaveTimers.current[pruefungId]) {
      clearTimeout(autoSaveTimers.current[pruefungId]);
    }
    setAutoSaveStatus(prev => ({ ...prev, [pruefungId]: 'saving' }));
    autoSaveTimers.current[pruefungId] = setTimeout(async () => {
      const bew = bewertungenRef.current[pruefungId];
      if (!bew) return;

      const allInhalte = Object.values(pruefungsinhalteRef.current[pruefungId] || {}).flat();
      const gesprungeneIds = new Set(allInhalte.filter(i => i.ist_gesprungen).map(i => i.id));
      const gesprungAktiv = gesprungeneAktivRef.current[pruefungId] || false;

      const arr = [];
      Object.values(bew).forEach(katArr => {
        if (Array.isArray(katArr)) {
          katArr.forEach(b => {
            if (!gesprungAktiv && gesprungeneIds.has(b.inhalt_id)) return;
            arr.push({
              inhalt_id: b.inhalt_id,
              bestanden: b.bestanden,
              punktzahl: b.punktzahl,
              max_punktzahl: b.max_punktzahl || 10,
              kommentar: b.kommentar
            });
          });
        }
      });

      if (arr.length > 0) {
        try {
          await fetch(`${API_BASE_URL}/pruefungen/${pruefungId}/bewertungen`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              bewertungen: arr,
              mit_gesprungenen: gesprungeneAktivRef.current[pruefungId] || false
            })
          });
          setAutoSaveStatus(prev => ({ ...prev, [pruefungId]: 'saved' }));
          setTimeout(() => setAutoSaveStatus(prev => {
            const n = { ...prev };
            delete n[pruefungId];
            return n;
          }), 2500);
        } catch (e) {
          console.error('Auto-save failed:', e);
          setAutoSaveStatus(prev => {
            const n = { ...prev };
            delete n[pruefungId];
            return n;
          });
        }
      }
    }, 1500);
  };

  const downloadUrkunde = async (pruefungId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/pruefungen/${pruefungId}/urkunde/download`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error || 'Fehler beim Download');
        setTimeout(() => setError(''), 3000);
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('Content-Disposition') || '';
      const m = disposition.match(/filename="?([^"]+)"?/);
      a.download = m ? m[1] : `Urkunde_${pruefungId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Fehler beim Download: ' + err.message);
      setTimeout(() => setError(''), 3000);
    }
  };

  const prepareArtikel = async (overrideData) => {
    const data = overrideData || artikelBanner;
    if (!data) return;
    const { datum, bestanden } = data;
    const anzahl = bestanden.length;
    const formattedDatum = datum
      ? new Date(datum).toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      : '';
    const stilNamen = [...new Set(bestanden.map(b => b.stilName).filter(Boolean))].join(' und ');
    const stilName = stilNamen || 'Kampfsport';

    const titel = `Bestandene Gürtelprüfung im ${stilName} – ${formattedDatum}`;

    const kurzbeschreibung = anzahl === 1
      ? `${bestanden[0].name} hat die Gürtelprüfung im ${stilName} erfolgreich bestanden${bestanden[0].neuerGurt ? ` und trägt nun stolz den ${bestanden[0].neuerGurt}` : ''}.`
      : `Am ${formattedDatum} haben ${anzahl} Sportlerinnen und Sportler ihre Gürtelprüfung im ${stilName} erfolgreich bestanden. Herzlichen Glückwunsch!`;

    const namesList = bestanden
      .map(b => `– ${b.name}${b.neuerGurt ? ` → ${b.neuerGurt}` : ''}`)
      .join('\n');

    const introSatz = anzahl === 1
      ? `Mit großer Freude dürfen wir berichten: ${bestanden[0].name} hat am ${formattedDatum} die Gürtelprüfung im ${stilName} erfolgreich bestanden!`
      : `Mit großer Freude und auch ein wenig Stolz können wir berichten: Am ${formattedDatum} haben ${anzahl} Sportlerinnen und Sportler ihre Gürtelprüfung im ${stilName} erfolgreich bestanden!`;

    const inhalt = `${introSatz}

${namesList}

Wochenlang haben sich die Prüflinge intensiv auf diesen besonderen Moment vorbereitet. Mit viel Fleiß, Disziplin und Begeisterung wurde im Training an Technik, Koordination, Kraft und Ausdauer gearbeitet – und all diese Anstrengungen haben sich nun ausgezahlt.

Während der Prüfung zeigten die Sportlerinnen und Sportler eindrucksvoll, was sie in den vergangenen Wochen und Monaten gelernt haben. Sie demonstrierten saubere Grundtechniken, präzise Kombinationen, kontrollierte Partnerübungen und ein gutes Verständnis für die Abläufe im ${stilName}. Besonders beeindruckend war der Einsatz, mit dem jede Aufgabe gemeistert wurde – man konnte deutlich sehen, wie viel Training, Mut und Konzentration in den Leistungen steckte.

Neben der technischen Ausführung wurde auch großer Wert auf Disziplin, Respekt und Teamgeist gelegt – Werte, die im Kampfsport eine zentrale Rolle spielen. Die Prüflinge unterstützten sich gegenseitig, feuerten sich an und zeigten, dass sie nicht nur sportlich, sondern auch menschlich gewachsen sind.

Der neue Gürtel ist mehr als nur eine Auszeichnung. Er ist ein sichtbares Zeichen für Fortschritt, Durchhaltevermögen und persönliche Entwicklung. ${anzahl === 1 ? `${bestanden[0].name} hat` : 'Jede Teilnehmerin und jeder Teilnehmer hat'} gezeigt, dass ${anzahl === 1 ? 'er/sie' : 'sie'} bereit ${anzahl === 1 ? 'ist' : 'sind'}, den nächsten Schritt auf dem Weg im ${stilName} zu gehen.

Ein besonderer Dank gilt den Eltern und Familien, die ihre Sportlerinnen und Sportler auf diesem Weg unterstützen, sowie den Trainern, die mit Geduld, Engagement und Leidenschaft das Training gestalten und die Talente fördern.

Wir sind sehr stolz auf alle, die diese Prüfung erfolgreich bestanden haben. Herzlichen Glückwunsch zu dieser großartigen Leistung! Wir freuen uns darauf, euch weiterhin auf eurem Weg im ${stilName} zu begleiten und gemeinsam viele weitere sportliche Erfolge zu feiern. 🥊👏`;

    try {
      const authToken = localStorage.getItem('dojo_auth_token') || localStorage.getItem('authToken') || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/news`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ titel, kurzbeschreibung, inhalt, status: 'entwurf', zielgruppe: 'alle_dojos' })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(`(${response.status}) ${resData.error || resData.message || 'Unbekannter Fehler'}`);
      setArtikelBanner(null);
      navigate(`/dashboard/news/bearbeiten/${resData.id}`);
    } catch (err) {
      setError('Artikel konnte nicht erstellt werden: ' + err.message);
      setTimeout(() => setError(''), 4000);
    }
  };

  const getStatusBadge = (pruefling) => {
    if (pruefling.status === 'bestanden') {
      return <span className="badge badge-success">✓ Bestanden</span>;
    } else if (pruefling.status === 'nicht_bestanden') {
      return <span className="badge badge-danger">✗ Nicht bestanden</span>;
    } else {
      return <span className="badge badge-warning">⏳ Offen</span>;
    }
  };

  // ============================================================
  // PRÜFUNGS-TIMER (Multi-Block)
  // ============================================================
  const formatTimerSek = (sek) => {
    const m = Math.floor(sek / 60);
    const s = sek % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const timerBlockAktualisieren = (id, feld, wert) => {
    setTimerBlöcke(prev => prev.map(b => b.id === id ? { ...b, [feld]: wert } : b));
  };

  const timerBlockHinzufügen = () => {
    setTimerBlöcke(prev => [...prev, {
      id: Date.now(), name: 'Neuer Block', runden: 3, rundenzeit: 120, pausezeit: 60, erledigt: false
    }]);
  };

  const timerBlockEntfernen = (id) => {
    setTimerBlöcke(prev => prev.filter(b => b.id !== id));
  };

  const timerPresetLaden = (preset) => {
    setTimerBlöcke(presetZuBlöcke(preset));
  };

  const timerTick = () => {
    const d = timerDataRef.current;
    d.sekundenLeft = Math.max(0, d.sekundenLeft - 1);

    if (d.sekundenLeft === 0) {
      const block = d.blöcke[d.blockIdx];
      if (d.phase === 'runde') {
        if (d.aktuelleRunde >= block.runden) {
          // Block fertig → nächster
          setTimerBlöcke(prev => prev.map((b, i) => i === d.blockIdx ? { ...b, erledigt: true } : b));
          const nextIdx = d.blockIdx + 1;
          if (nextIdx >= d.blöcke.length) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
            d.phase = 'fertig';
            setTimerLaeuft(false);
          } else {
            d.blockIdx = nextIdx;
            d.aktuelleRunde = 1;
            d.phase = 'blockpause';
            d.sekundenLeft = 60;
            setTimerAktivBlockIdx(nextIdx);
          }
        } else {
          d.phase = 'pause';
          d.sekundenLeft = block.pausezeit;
        }
      } else if (d.phase === 'pause') {
        d.aktuelleRunde++;
        d.phase = 'runde';
        d.sekundenLeft = block.rundenzeit;
      } else if (d.phase === 'blockpause') {
        d.phase = 'runde';
        d.sekundenLeft = d.blöcke[d.blockIdx].rundenzeit;
      }
    }
    setTimerPhase(d.phase);
    setTimerSekundenLeft(d.sekundenLeft);
    setTimerAktuelleRunde(d.aktuelleRunde);
  };

  const timerStarten = (startIdx = 0) => {
    let blöckeZumStarten;
    if (timerModus === 'einfach') {
      blöckeZumStarten = [{ id: 0, name: 'Timer', runden: timerEinfachRunden, rundenzeit: timerEinfachRundenzeit, pausezeit: timerEinfachPausezeit, erledigt: false }];
      startIdx = 0;
    } else {
      if (timerBlöcke.length === 0) return;
      blöckeZumStarten = timerBlöcke.map(b => ({ ...b, erledigt: false }));
      setTimerBlöcke(blöckeZumStarten);
    }
    const actualIdx = Math.min(startIdx, blöckeZumStarten.length - 1);
    const startBlock = blöckeZumStarten[actualIdx];
    timerDataRef.current = {
      phase: 'runde', sekundenLeft: startBlock.rundenzeit,
      aktuelleRunde: 1, blockIdx: actualIdx, blöcke: blöckeZumStarten,
    };
    setTimerPhase('runde');
    setTimerSekundenLeft(startBlock.rundenzeit);
    setTimerAktuelleRunde(1);
    setTimerAktivBlockIdx(actualIdx);
    setTimerLaeuft(true);
    timerIntervalRef.current = setInterval(timerTick, 1000);
  };

  const timerStoppen = () => {
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    setTimerLaeuft(false);
  };

  const timerFortsetzen = () => {
    setTimerLaeuft(true);
    timerIntervalRef.current = setInterval(timerTick, 1000);
  };

  const timerZuruecksetzen = () => {
    clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    setTimerLaeuft(false);
    setTimerPhase('bereit');
    setTimerSekundenLeft(0);
    setTimerAktuelleRunde(1);
    setTimerAktivBlockIdx(0);
    setTimerBlöcke(prev => prev.map(b => ({ ...b, erledigt: false })));
  };

  return (
    <div className="content-card">
      <div className="page-header">
        <div>
          <h1 className="pd-page-title">Prüfung durchführen</h1>
          <p>Live-Ansicht für den Prüfungstag - Ergebnisse direkt eintragen</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-error pd-alert-mb">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success pd-alert-mb">
          <Check size={20} />
          {success}
        </div>
      )}

      {/* Artikel-Banner nach bestandener Prüfung */}
      {artikelBanner && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
          padding: '14px 18px', marginBottom: '16px',
          background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(212,175,55,0.05) 100%)',
          border: '1px solid rgba(212,175,55,0.45)', borderRadius: '10px'
        }}>
          <span style={{ fontSize: '22px' }}>🎉</span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#d4af37', fontSize: '14px' }}>
              {artikelBanner.bestanden.length === 1
                ? `${artikelBanner.bestanden[0].name} hat bestanden!`
                : `${artikelBanner.bestanden.length} Prüflinge haben bestanden!`}
            </strong>
            <div style={{ fontSize: '12px', color: 'var(--text-muted,#aaa)', marginTop: '2px' }}>
              {artikelBanner.bestanden.map(b => `${b.name}${b.neuerGurt ? ` → ${b.neuerGurt}` : ''}`).join(' · ')}
            </div>
          </div>
          <button
            onClick={prepareArtikel}
            style={{
              padding: '8px 16px', background: 'rgba(212,175,55,0.25)', border: '1px solid rgba(212,175,55,0.6)',
              borderRadius: '7px', color: '#d4af37', cursor: 'pointer', fontWeight: 700, fontSize: '13px',
              display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap'
            }}
          >
            📰 Artikel vorbereiten
          </button>
          <button
            onClick={() => setArtikelBanner(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted,#aaa)', cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: '4px' }}
            title="Schließen"
          >✕</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="pd-toolbar">
        <div className="pd-toolbar-row">

          {/* Zeitraum */}
          <div className="pd-tb-group">
            <span className="pd-tb-label">Zeitraum</span>
            <div className="pd-tb-btngroup">
              {[['alle','Alle'],['zukuenftig','Zukünftig'],['vergangen','Vergangen']].map(([val,label]) => (
                <button key={val}
                  onClick={() => setDatumFilter(val)}
                  className={`pd-tb-btn${datumFilter === val ? ' pd-tb-btn--active' : ''}`}
                >{label}</button>
              ))}
            </div>
          </div>

          <div className="pd-tb-divider" />

          {/* Datum springen */}
          <div className="pd-tb-group">
            <span className="pd-tb-label">Datum</span>
            <div className="pd-tb-date-wrap">
              <input type="date" value={selectedDatum}
                onChange={(e) => setSelectedDatum(e.target.value)}
                className="pd-tb-date" />
              {selectedDatum && (
                <button onClick={() => setSelectedDatum('')} className="pd-tb-clear" title="Datum zurücksetzen">✕</button>
              )}
            </div>
          </div>

          <div className="pd-tb-divider" />

          {/* Stil */}
          <div className="pd-tb-group">
            <span className="pd-tb-label">Stil</span>
            <select value={selectedStil} onChange={(e) => setSelectedStil(e.target.value)} className="pd-tb-select">
              <option value="all">Alle Stile</option>
              {stile.map(s => <option key={s.stil_id} value={s.stil_id}>{s.name}</option>)}
            </select>
          </div>

          {/* Einstellungen-Button rechts */}
          <button
            onClick={() => setShowPruefSettings(s => !s)}
            className={`pd-tb-settings-btn${showPruefSettings ? ' active' : ''}`}
            title="Bewertungseinstellungen"
          >
            ⚙ Einstellungen
          </button>
        </div>

        {/* Einstellungen-Panel */}
        {showPruefSettings && (
          <div className="pd-settings-panel">
            <div className="pd-settings-grid">
              {[
                { key: 'bestanden_item_punkte', label: 'Bestanden ab', unit: 'Pkt/Item', type: 'number', step: '0.5', min: '0' },
                { key: 'bestanden_gesamt_prozent', label: 'Bestanden gesamt ab', unit: '%', type: 'number', step: '5', min: '0', max: '100' },
                { key: 'max_punkte_item', label: 'Max. Punkte / Item', unit: 'Pkt', type: 'number', step: '1', min: '1' },
              ].map(({ key, label, unit, ...inputProps }) => (
                <div key={key} className="pd-settings-field">
                  <span className="pd-settings-label">{label}</span>
                  <div className="pd-settings-input-wrap">
                    <input {...inputProps} value={pruefSettings[key]}
                      onChange={e => setPruefSettings(s => ({...s, [key]: parseFloat(e.target.value) || 0}))}
                      className="pd-settings-input" />
                    <span className="pd-settings-unit">{unit}</span>
                  </div>
                </div>
              ))}
              <div className="pd-settings-field">
                <span className="pd-settings-label">Punkteschritte</span>
                <select value={pruefSettings.punkte_modus}
                  onChange={e => setPruefSettings(s => ({...s, punkte_modus: e.target.value}))}
                  className="pd-settings-select">
                  <option value="ganz">Ganze (1, 2, 3…)</option>
                  <option value="halb">Halbe (0.5, 1, 1.5…)</option>
                  <option value="dezimal">Zehntel (0.1, 0.2…)</option>
                </select>
              </div>
            </div>
            <div className="pd-settings-actions">
              <button className="pd-settings-save"
                onClick={() => { savePruefSettings(pruefSettings); setSuccess('Einstellungen gespeichert'); setTimeout(() => setSuccess(''), 2000); setShowPruefSettings(false); }}>
                ✓ Als Standard speichern
              </button>
              <button className="pd-settings-reset"
                onClick={() => savePruefSettings({...DEFAULT_PRUEF_SETTINGS})}>
                Zurücksetzen
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Prüfungs-Timer */}
      <div className={`pd-timer-card${timerLaeuft ? ' pd-timer-card--active' : ''}`}>
        <div className="pd-timer-header" onClick={() => setTimerVisible(v => !v)}>
          <div className="pd-timer-header-left">
            <Clock size={15} />
            <span>Prüfungs-Timer</span>
            {timerLaeuft && <span className="pd-timer-live-badge">● LIVE</span>}
            {timerPhase === 'fertig' && <span className="pd-timer-done-badge">✓ Fertig</span>}
          </div>
          {!timerVisible && timerPhase !== 'bereit' && (
            <span className="pd-timer-mini-display">
              {timerPhase === 'fertig'
                ? '✓ Fertig'
                : timerPhase === 'runde'
                  ? timerModus === 'einfach'
                    ? `R${timerAktuelleRunde}/${timerEinfachRunden} · ${formatTimerSek(timerSekundenLeft)}`
                    : `${timerBlöcke[timerAktivBlockIdx]?.name || ''} · R${timerAktuelleRunde}/${timerBlöcke[timerAktivBlockIdx]?.runden || ''} · ${formatTimerSek(timerSekundenLeft)}`
                  : timerPhase === 'blockpause'
                  ? `Block-Pause · ${formatTimerSek(timerSekundenLeft)}`
                  : `Pause · ${formatTimerSek(timerSekundenLeft)}`}
            </span>
          )}
          <ChevronDown size={15} className={`pd-timer-chevron${timerVisible ? ' pd-timer-chevron--open' : ''}`} />
        </div>

        {timerVisible && (
          <div className="pd-timer-body">

            {/* Modus-Tabs — nur sichtbar wenn Timer bereit */}
            {timerPhase === 'bereit' && (
              <div className="pd-timer-tabs">
                <button
                  className={`pd-timer-tab${timerModus === 'einfach' ? ' pd-timer-tab--aktiv' : ''}`}
                  onClick={() => setTimerModus('einfach')}
                >⚡ Einfach</button>
                <button
                  className={`pd-timer-tab${timerModus === 'blöcke' ? ' pd-timer-tab--aktiv' : ''}`}
                  onClick={() => setTimerModus('blöcke')}
                >☰ Blöcke</button>
              </div>
            )}

            {/* ── EINFACH-MODUS ── */}
            {timerModus === 'einfach' && (
              <div className="pd-timer-einfach-layout">
                {timerPhase === 'bereit' && (
                  <div className="pd-timer-settings">
                    <div className="pd-timer-field">
                      <label className="pd-timer-label">Runden</label>
                      <input type="number" min="1" max="20" value={timerEinfachRunden}
                        onChange={e => setTimerEinfachRunden(Math.max(1, parseInt(e.target.value) || 1))}
                        className="pd-timer-input" />
                    </div>
                    <div className="pd-timer-field">
                      <label className="pd-timer-label">Rundenzeit</label>
                      <div className="pd-timer-time-row">
                        <input type="number" min="0" max="59" value={Math.floor(timerEinfachRundenzeit / 60)}
                          onChange={e => setTimerEinfachRundenzeit((parseInt(e.target.value) || 0) * 60 + timerEinfachRundenzeit % 60)}
                          className="pd-timer-input-sm" />
                        <span className="pd-timer-unit">m</span>
                        <input type="number" min="0" max="59" value={timerEinfachRundenzeit % 60}
                          onChange={e => setTimerEinfachRundenzeit(Math.floor(timerEinfachRundenzeit / 60) * 60 + (parseInt(e.target.value) || 0))}
                          className="pd-timer-input-sm" />
                        <span className="pd-timer-unit">s</span>
                      </div>
                    </div>
                    <div className="pd-timer-field">
                      <label className="pd-timer-label">Pause</label>
                      <div className="pd-timer-time-row">
                        <input type="number" min="0" max="59" value={Math.floor(timerEinfachPausezeit / 60)}
                          onChange={e => setTimerEinfachPausezeit((parseInt(e.target.value) || 0) * 60 + timerEinfachPausezeit % 60)}
                          className="pd-timer-input-sm" />
                        <span className="pd-timer-unit">m</span>
                        <input type="number" min="0" max="59" value={timerEinfachPausezeit % 60}
                          onChange={e => setTimerEinfachPausezeit(Math.floor(timerEinfachPausezeit / 60) * 60 + (parseInt(e.target.value) || 0))}
                          className="pd-timer-input-sm" />
                        <span className="pd-timer-unit">s</span>
                      </div>
                    </div>
                  </div>
                )}
                {timerPhase !== 'bereit' && (
                  <div className={`pd-timer-display pd-timer-display--${timerPhase}`}>
                    <div className="pd-timer-phase-label">
                      {timerPhase === 'runde' && `Runde ${timerAktuelleRunde} von ${timerEinfachRunden}`}
                      {timerPhase === 'pause' && `Pause · Nächste: Runde ${timerAktuelleRunde + 1}`}
                      {timerPhase === 'fertig' && '✓ Fertig'}
                    </div>
                    {timerPhase !== 'fertig' && (
                      <>
                        <div className="pd-timer-countdown">{formatTimerSek(timerSekundenLeft)}</div>
                        <div className="pd-timer-bar-wrap">
                          <div className="pd-timer-bar-fill" style={{
                            width: `${(timerSekundenLeft / (timerPhase === 'runde' ? (timerEinfachRundenzeit || 1) : (timerEinfachPausezeit || 1))) * 100}%`,
                            background: timerPhase === 'pause' ? '#f59e0b' : 'var(--primary-color, #d4af37)'
                          }} />
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div className="pd-timer-controls">
                  {timerPhase === 'bereit' && (
                    <button className="btn btn-primary pd-timer-btn" onClick={() => timerStarten()}>▶ Start</button>
                  )}
                  {(timerPhase === 'runde' || timerPhase === 'pause') && timerLaeuft && (
                    <button className="btn btn-warning pd-timer-btn" onClick={timerStoppen}>⏸ Stopp</button>
                  )}
                  {(timerPhase === 'runde' || timerPhase === 'pause') && !timerLaeuft && (
                    <button className="btn btn-primary pd-timer-btn" onClick={timerFortsetzen}>▶ Weiter</button>
                  )}
                  {timerPhase !== 'bereit' && (
                    <button className="btn btn-secondary pd-timer-btn" onClick={timerZuruecksetzen}>↺ Zurücksetzen</button>
                  )}
                </div>
              </div>
            )}

            {/* ── BLÖCKE-MODUS ── */}
            {timerModus === 'blöcke' && (
              <div className="pd-timer-main-layout">
                {/* LINKS: Anzeige + Steuerung */}
                <div className="pd-timer-left">
                  {timerPhase !== 'bereit' ? (
                    <div className={`pd-timer-display pd-timer-display--${timerPhase}`}>
                      <div className="pd-timer-phase-label">
                        {timerPhase === 'runde' && (
                          <><span className="pd-timer-block-name-label">{timerBlöcke[timerAktivBlockIdx]?.name}</span>{' · '}Runde {timerAktuelleRunde} von {timerBlöcke[timerAktivBlockIdx]?.runden}</>
                        )}
                        {timerPhase === 'pause' && `Pause · Nächste: Runde ${timerAktuelleRunde + 1}`}
                        {timerPhase === 'blockpause' && `Block-Pause · Weiter: ${timerBlöcke[timerAktivBlockIdx]?.name || 'Nächster Block'}`}
                        {timerPhase === 'fertig' && '✓ Alle Blöcke abgeschlossen'}
                      </div>
                      {timerPhase !== 'fertig' && (
                        <>
                          <div className="pd-timer-countdown">{formatTimerSek(timerSekundenLeft)}</div>
                          <div className="pd-timer-bar-wrap">
                            <div className="pd-timer-bar-fill" style={{
                              width: `${(timerSekundenLeft / (timerPhase === 'runde'
                                ? (timerBlöcke[timerAktivBlockIdx]?.rundenzeit || 1)
                                : timerPhase === 'blockpause' ? 60
                                : (timerBlöcke[timerAktivBlockIdx]?.pausezeit || 1))) * 100}%`,
                              background: (timerPhase === 'pause' || timerPhase === 'blockpause') ? '#f59e0b' : 'var(--primary-color, #d4af37)'
                            }} />
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="pd-timer-bereit-hint">
                      {timerBlöcke.length > 0
                        ? `${timerBlöcke.length} Block${timerBlöcke.length !== 1 ? 'e' : ''} — Block ▶ wählen oder alle starten`
                        : 'Keine Blöcke — rechts hinzufügen oder Prüfungsordnung laden'}
                    </div>
                  )}
                  <div className="pd-timer-controls">
                    {timerPhase === 'bereit' && (
                      <button className="btn btn-primary pd-timer-btn" onClick={() => timerStarten(0)} disabled={timerBlöcke.length === 0}>▶ Alle starten</button>
                    )}
                    {(timerPhase === 'runde' || timerPhase === 'pause' || timerPhase === 'blockpause') && timerLaeuft && (
                      <button className="btn btn-warning pd-timer-btn" onClick={timerStoppen}>⏸ Stopp</button>
                    )}
                    {(timerPhase === 'runde' || timerPhase === 'pause' || timerPhase === 'blockpause') && !timerLaeuft && (
                      <button className="btn btn-primary pd-timer-btn" onClick={timerFortsetzen}>▶ Weiter</button>
                    )}
                    {timerPhase !== 'bereit' && (
                      <button className="btn btn-secondary pd-timer-btn" onClick={timerZuruecksetzen}>↺ Zurücksetzen</button>
                    )}
                  </div>
                </div>

                {/* RECHTS: Block-Liste */}
                <div className="pd-timer-right">
                  <div className="pd-timer-block-header">
                    <span className="pd-timer-block-header-title">Blöcke</span>
                    <div className="pd-timer-block-header-actions">
                      {TIMER_PRESETS.map(p => (
                        <button key={p.id} className="btn btn-secondary pd-timer-btn-sm" onClick={() => timerPresetLaden(p)} disabled={timerLaeuft} title={`Preset laden: ${p.label}`}>⟳ {p.label}</button>
                      ))}
                      <button className="btn btn-secondary pd-timer-btn-sm" onClick={timerBlockHinzufügen} disabled={timerLaeuft}>＋ Block</button>
                    </div>
                  </div>
                  <div className="pd-timer-block-list">
                    {timerBlöcke.length === 0 && (
                      <div className="pd-timer-block-empty">Keine Blöcke — oben laden oder hinzufügen</div>
                    )}
                    {timerBlöcke.map((block, idx) => (
                      <div
                        key={block.id}
                        className={`pd-timer-block-item${block.erledigt ? ' pd-timer-block-item--erledigt' : ''}${idx === timerAktivBlockIdx && timerPhase !== 'bereit' && timerPhase !== 'fertig' ? ' pd-timer-block-item--aktiv' : ''}`}
                      >
                        {/* Per-Block-Start (nur bereit) oder Checkmark (erledigt) */}
                        {timerPhase === 'bereit' ? (
                          <button
                            className="pd-timer-block-start-btn"
                            onClick={() => timerStarten(idx)}
                            title={`Ab "${block.name}" starten`}
                          >▶</button>
                        ) : block.erledigt ? (
                          <span className="pd-timer-block-check">✓</span>
                        ) : null}
                        <div className="pd-timer-block-fields">
                          <input
                            className="pd-timer-block-name-input"
                            value={block.name}
                            onChange={e => timerBlockAktualisieren(block.id, 'name', e.target.value)}
                            disabled={timerLaeuft}
                            placeholder="Blockname"
                          />
                          <div className="pd-timer-block-numbers">
                            <div className="pd-timer-block-num-field">
                              <span className="pd-timer-label">Runden</span>
                              <input type="number" min="1" max="20" value={block.runden}
                                onChange={e => timerBlockAktualisieren(block.id, 'runden', Math.max(1, parseInt(e.target.value) || 1))}
                                disabled={timerLaeuft} className="pd-timer-input" />
                            </div>
                            <div className="pd-timer-block-num-field">
                              <span className="pd-timer-label">Rundenzeit</span>
                              <div className="pd-timer-time-row">
                                <input type="number" min="0" max="59" value={Math.floor(block.rundenzeit / 60)}
                                  onChange={e => timerBlockAktualisieren(block.id, 'rundenzeit', (parseInt(e.target.value) || 0) * 60 + block.rundenzeit % 60)}
                                  disabled={timerLaeuft} className="pd-timer-input-sm" />
                                <span className="pd-timer-unit">m</span>
                                <input type="number" min="0" max="59" value={block.rundenzeit % 60}
                                  onChange={e => timerBlockAktualisieren(block.id, 'rundenzeit', Math.floor(block.rundenzeit / 60) * 60 + (parseInt(e.target.value) || 0))}
                                  disabled={timerLaeuft} className="pd-timer-input-sm" />
                                <span className="pd-timer-unit">s</span>
                              </div>
                            </div>
                            <div className="pd-timer-block-num-field">
                              <span className="pd-timer-label">Pause</span>
                              <div className="pd-timer-time-row">
                                <input type="number" min="0" max="59" value={Math.floor(block.pausezeit / 60)}
                                  onChange={e => timerBlockAktualisieren(block.id, 'pausezeit', (parseInt(e.target.value) || 0) * 60 + block.pausezeit % 60)}
                                  disabled={timerLaeuft} className="pd-timer-input-sm" />
                                <span className="pd-timer-unit">m</span>
                                <input type="number" min="0" max="59" value={block.pausezeit % 60}
                                  onChange={e => timerBlockAktualisieren(block.id, 'pausezeit', Math.floor(block.pausezeit / 60) * 60 + (parseInt(e.target.value) || 0))}
                                  disabled={timerLaeuft} className="pd-timer-input-sm" />
                                <span className="pd-timer-unit">s</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        {timerPhase === 'bereit' && (
                          <button className="pd-timer-block-delete" onClick={() => timerBlockEntfernen(block.id)} title="Block entfernen">×</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Termin-Cards */}
      {loading ? (
        <div className="pd-loading-center">
          <div className="spinner"></div>
          <p>Lade Prüfungen...</p>
        </div>
      ) : pruefungen.length === 0 ? (
        <div className="empty-state">
          <Calendar size={48} />
          <h3>Keine Prüfungen gefunden</h3>
          <p>Es gibt keine geplanten Prüfungen.</p>
        </div>
      ) : (
        <div className="pd-grid">
          {(() => {
            const heute = new Date();
            heute.setHours(0, 0, 0, 0);

            // Filter nach Datum, Stil und Datumsauswahl
            let gefiltert = pruefungen.filter(pruefung => {
              // Stil-Filter
              if (selectedStil !== 'all' && pruefung.stil_id !== parseInt(selectedStil)) {
                return false;
              }

              // Datumsauswahl (direkter Sprung zu einem Datum)
              if (selectedDatum) {
                const selectedDate = new Date(selectedDatum);
                selectedDate.setHours(0, 0, 0, 0);
                const pruefungsDatum = new Date(pruefung.pruefungsdatum);
                pruefungsDatum.setHours(0, 0, 0, 0);
                return pruefungsDatum.getTime() === selectedDate.getTime();
              }

              // Zeitraum-Filter
              if (!pruefung.pruefungsdatum) return true;

              const pruefungsDatum = new Date(pruefung.pruefungsdatum);
              pruefungsDatum.setHours(0, 0, 0, 0);

              if (datumFilter === 'zukuenftig') {
                return pruefungsDatum >= heute;
              } else if (datumFilter === 'vergangen') {
                return pruefungsDatum < heute;
              }
              return true; // 'alle'
            });

            // Nach Datum gruppieren
            const grouped = {};
            gefiltert.forEach(pruefung => {
              const datum = pruefung.pruefungsdatum || 'Kein Datum';
              if (!grouped[datum]) {
                grouped[datum] = [];
              }
              grouped[datum].push(pruefung);
            });

            // Sortiere Daten
            const sortedDates = Object.keys(grouped).sort((a, b) => {
              if (a === 'Kein Datum') return 1;
              if (b === 'Kein Datum') return -1;

              const dateA = new Date(a);
              const dateB = new Date(b);
              dateA.setHours(0, 0, 0, 0);
              dateB.setHours(0, 0, 0, 0);

              const isAFuture = dateA >= heute;
              const isBFuture = dateB >= heute;

              // Beide zukünftig: aufsteigend
              if (isAFuture && isBFuture) return dateA - dateB;
              // Beide vergangen: absteigend
              if (!isAFuture && !isBFuture) return dateB - dateA;
              // Zukünftige vor vergangenen
              return isAFuture ? -1 : 1;
            });

            const toggleDate = (datum) => {
              const newExpanded = new Set(expandedDates);
              if (newExpanded.has(datum)) {
                newExpanded.delete(datum);
              } else {
                newExpanded.add(datum);
              }
              setExpandedDates(newExpanded);
            };

            const formatDatum = (datum) => {
              if (datum === 'Kein Datum') return datum;
              const date = new Date(datum);
              const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
              return date.toLocaleDateString('de-DE', options);
            };

            const isPast = (datum) => {
              if (datum === 'Kein Datum') return false;
              const date = new Date(datum);
              date.setHours(0, 0, 0, 0);
              return date < heute;
            };

            const isToday = (datum) => {
              if (datum === 'Kein Datum') return false;
              const date = new Date(datum);
              date.setHours(0, 0, 0, 0);
              return date.getTime() === heute.getTime();
            };

            return sortedDates.map(datum => {
              const pruefungenAmTag = grouped[datum];
              const isExpanded = expandedDates.has(datum);
              const past = isPast(datum);
              const today = isToday(datum);

              const datumState = today ? 'today' : past ? 'past' : 'future';
              return (
                <div
                  key={datum}
                  className={`pd-datum-card pd-datum-card--${datumState}`}
                >
                  {/* Termin-Header */}
                  <div
                    onClick={() => toggleDate(datum)}
                    className={`pd-datum-header pd-datum-header--${datumState}`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = today
                        ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(59, 130, 246, 0.1) 100%)'
                        : past
                          ? 'linear-gradient(135deg, rgba(156, 163, 175, 0.25) 0%, rgba(156, 163, 175, 0.1) 100%)'
                          : 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 215, 0, 0.1) 100%)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = today
                        ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.05) 100%)'
                        : past
                          ? 'linear-gradient(135deg, rgba(156, 163, 175, 0.15) 0%, rgba(156, 163, 175, 0.05) 100%)'
                          : 'linear-gradient(135deg, rgba(255, 215, 0, 0.2) 0%, rgba(255, 215, 0, 0.05) 100%)';
                    }}
                  >
                    <div className="u-flex-row-lg">
                      <Calendar size={28} className="pd-datum-icon" />
                      <div>
                        <h3 className="pd-datum-title">
                          {formatDatum(datum)}
                          {today && <span className="pd-badge-heute">• HEUTE</span>}
                          {past && <span className="pd-badge-vergangen">• vergangen</span>}
                        </h3>
                        <p className="pd-date-sub">
                          {pruefungenAmTag.length} {pruefungenAmTag.length === 1 ? 'Prüfling' : 'Prüflinge'}
                        </p>
                      </div>
                    </div>

                    <ChevronDown
                      size={24}
                      className={`pd-datum-chevron${isExpanded ? ' pd-datum-chevron--expanded' : ''}`}
                    />
                  </div>

                  {/* Teilnehmer-Liste (expandierbar) */}
                  {isExpanded && (
                    <div className="pd-expanded-body">
                      {pruefungenAmTag.map((pruefling, index) => {
                        const isEditing = editingPruefling?.pruefung_id === pruefling.pruefung_id;
                        const ergebnis = ergebnisse[pruefling.pruefung_id] || {
                          bestanden: false,
                          punktzahl: '',
                          max_punktzahl: 100,
                          prueferkommentar: '',
                          neuer_gurt_name: ''
                        };

                        return (
                          <div
                            key={index}
                            className={`pd-pruefling-card${isEditing ? ' pd-pruefling-card--editing' : ''}`}
                          >
                            {/* Prüfling Header */}
                            <div
                              onClick={() => handleToggleEdit(pruefling)}
                              className="pd-pruefling-header"
                              onMouseEnter={(e) => {
                                if (!isEditing) {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <div className="pd-pruefling-inner">
                                <div className="pd-pruefling-avatar">
                                  {index + 1}
                                </div>

                                <div className="u-flex-1">
                                  <h4 className="pd-pruefling-name">
                                    {[pruefling.vorname, pruefling.nachname].map(n => n ? n.charAt(0).toUpperCase() + n.slice(1).toLowerCase() : '').join(' ')}
                                  </h4>
                                  <p className="pd-pruefling-sub">
                                    {pruefling.stil_name} · {pruefling.graduierung_vorher} → {pruefling.graduierung_nachher}
                                  </p>
                                  <div className="pd-status-row">
                                    {getStatusBadge(pruefling)}

                                    {pruefling.punktzahl && (
                                      <div className="pd-pkt-badge">
                                        {pruefling.punktzahl} / {pruefling.max_punktzahl} Pkt.
                                      </div>
                                    )}

                                    {pruefling.status === 'bestanden' && (
                                      <button
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.72rem', padding: '0.18rem 0.5rem' }}
                                        onClick={(e) => { e.stopPropagation(); downloadUrkunde(pruefling.pruefung_id); }}
                                        title="Urkunde herunterladen"
                                      >
                                        Urkunde
                                      </button>
                                    )}
                                    {(pruefling.status === 'bestanden' || pruefling.status === 'nicht_bestanden') && (
                                      <button
                                        className="btn btn-secondary"
                                        style={{
                                          fontSize: '0.72rem', padding: '0.18rem 0.5rem',
                                          borderColor: protokollStatus[pruefling.pruefung_id]
                                            ? (protokollStatus[pruefling.pruefung_id].gesendet_am ? 'rgba(34,197,94,0.6)' : 'rgba(99,102,241,0.6)')
                                            : undefined,
                                          color: protokollStatus[pruefling.pruefung_id]
                                            ? (protokollStatus[pruefling.pruefung_id].gesendet_am ? '#4ade80' : '#818cf8')
                                            : undefined
                                        }}
                                        onClick={(e) => { e.stopPropagation(); openProtokolModal(pruefling); }}
                                        title="Prüfungsprotokoll erstellen und senden"
                                      >
                                        📋 {protokollStatus[pruefling.pruefung_id]
                                          ? (protokollStatus[pruefling.pruefung_id].gesendet_am ? 'Protokoll ✓' : 'Protokoll')
                                          : 'Protokoll'}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <ChevronDown
                                size={20}
                                className={`pd-pruefling-chevron${isEditing ? ' pd-pruefling-chevron--expanded' : ''}`}
                              />
                            </div>

                            {/* Inline Edit-Formular */}
                            {isEditing && (
                              <div className="pd-edit-form">
                                {/* Kompakte Ergebnis-Zeile: Alles in einer Reihe */}
                                <div className="pd-result-row">
                                  {/* Bestanden Buttons */}
                                  <div className="pd-col-auto">
                                    <label className="pd-mini-label">
                                      Ergebnis
                                    </label>
                                    <div className="pd-btn-row">
                                      <button
                                        type="button"
                                        onClick={() => updateErgebnis(pruefling.pruefung_id, 'bestanden', true)}
                                        className={`btn-toggle btn-toggle-success pd-btn-toggle-sm ${ergebnis.bestanden ? 'active' : ''}`}
                                      >
                                        <Check size={14} />
                                        Bestanden
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => updateErgebnis(pruefling.pruefung_id, 'bestanden', false)}
                                        className={`btn-toggle btn-toggle-danger pd-btn-toggle-sm ${!ergebnis.bestanden ? 'active' : ''}`}
                                      >
                                        <X size={14} />
                                        Nicht bestanden
                                      </button>
                                    </div>
                                  </div>

                                  {/* Gurt-Auswahl - immer sichtbar */}
                                  {(
                                    <div className="pd-gurt-nav">
                                      <label className="pd-mini-label">
                                        <Award size={12} className="pd-icon-inline" />
                                        Neuer Gurt
                                      </label>

                                      <div className="pd-gurt-row">
                                        <button
                                          type="button"
                                          onClick={() => handleGurtAendern(pruefling.pruefung_id, pruefling.stil_id, 'down')}
                                          className="pd-gurt-btn"
                                          title="Gurt herabstufen"
                                        >
                                          <ChevronDown size={14} />
                                        </button>

                                        <div
                                          className="pd-gurt-display"
                                          style={{ '--gurt-bg': ergebnis.neuer_gurt_farbe || 'rgba(255,255,255,0.1)' }}
                                        >
                                          <span className={`pd-gurt-label${ergebnis.neuer_gurt_farbe ? ' pd-gurt-label--dark' : ''}`}>
                                            {ergebnis.neuer_gurt_name || 'Kein Gurt'}
                                          </span>
                                        </div>

                                        <button
                                          type="button"
                                          onClick={() => handleGurtAendern(pruefling.pruefung_id, pruefling.stil_id, 'up')}
                                          className="pd-gurt-btn"
                                          title="Gurt hochstufen"
                                        >
                                          <ChevronUp size={14} />
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* Erreichte Punktzahl */}
                                  <div className="pd-col-100">
                                    <label className="pd-mini-label">
                                      Erreicht
                                    </label>
                                    <input
                                      type="number"
                                      value={ergebnis.punktzahl || ''}
                                      onChange={(e) => updateErgebnis(pruefling.pruefung_id, 'punktzahl', e.target.value)}
                                      placeholder="85"
                                      className="form-input pd-edit-input"
                                    />
                                  </div>

                                  {/* Maximale Punktzahl */}
                                  <div className="pd-col-100">
                                    <label className="pd-mini-label">
                                      Max.
                                    </label>
                                    <input
                                      type="number"
                                      value={ergebnis.max_punktzahl || 100}
                                      onChange={(e) => updateErgebnis(pruefling.pruefung_id, 'max_punktzahl', e.target.value)}
                                      className="form-input pd-edit-input"
                                    />
                                  </div>
                                </div>

                                {/* Prüferkommentar */}
                                <div className="pd-kommentar-section">
                                  <label className="pd-kommentar-label">
                                    Prüferkommentar / Bemerkungen
                                  </label>
                                  <textarea
                                    value={ergebnis.prueferkommentar || ''}
                                    onChange={(e) => updateErgebnis(pruefling.pruefung_id, 'prueferkommentar', e.target.value)}
                                    rows="3"
                                    placeholder="Notizen zum Prüfungsverlauf, Stärken, Schwächen, etc."
                                    className="pd-textarea"
                                  />
                                </div>

                                {/* Prüfungsinhalte & Bewertungen */}
                                {pruefungsinhalte[pruefling.pruefung_id] && (
                                  <div className="pd-inhalte-box">
                                    <h4 className="pd-inhalte-h4">
                                      📋 Prüfungsinhalte bewerten
                                    </h4>
                                    {Object.entries(pruefungsinhalte[pruefling.pruefung_id]).map(([kategorie, inhalte]) => {
                                      const hatGesprungen = inhalte.some(i => i.ist_gesprungen);
                                      const gesprungAktiv = gesprungeneAktiv[pruefling.pruefung_id] || false;
                                      const anzeigeInhalte = (kategorie === 'fusstechniken' && !gesprungAktiv)
                                        ? inhalte.filter(i => !i.ist_gesprungen)
                                        : inhalte;
                                      const expanded = isKategorieExpanded(pruefling.pruefung_id, kategorie);
                                      return (
                                      <div key={kategorie} className="pd-kommentar-section">
                                        <h5
                                          className="pd-kategorie-h5"
                                          onClick={() => toggleKategorie(pruefling.pruefung_id, kategorie)}
                                          style={{cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center',userSelect:'none'}}
                                        >
                                          <span>
                                            {kategorie === 'kondition' && '💪 Kondition / Warm Up'}
                                            {kategorie === 'grundtechniken' && '🥋 Grundtechniken'}
                                            {kategorie === 'fusstechniken' && '🦵 Fußtechniken'}
                                            {kategorie === 'kata' && '🎭 Kata / Kombinationen'}
                                            {kategorie === 'kumite' && '⚔️ Kumite / Sparring'}
                                            {kategorie === 'theorie' && '📚 Theorie'}
                                            {!['kondition','grundtechniken','fusstechniken','kata','kumite','theorie'].includes(kategorie) && kategorie}
                                            <span style={{marginLeft:'8px',fontSize:'11px',color:'var(--text-muted,#aaa)',fontWeight:400}}>
                                              ({inhalte.length})
                                            </span>
                                          </span>
                                          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
                                            {expanded && (
                                              <button type="button"
                                                onClick={(e) => { e.stopPropagation(); markKatBestanden(pruefling.pruefung_id, kategorie, anzeigeInhalte); }}
                                                style={{padding:'3px 10px',borderRadius:'5px',border:'1px solid rgba(34,197,94,0.45)',background:'rgba(34,197,94,0.1)',color:'#4ade80',fontSize:'12px',cursor:'pointer',fontWeight:600,whiteSpace:'nowrap'}}
                                              >✓ Alle bestanden</button>
                                            )}
                                            <span style={{fontSize:'12px',color:'var(--text-muted,#aaa)'}}>{expanded ? '▲' : '▼'}</span>
                                          </div>
                                        </h5>

                                        {expanded && <>
                                        {/* Gesprungen-Toggle nur für fusstechniken */}
                                        {kategorie === 'fusstechniken' && hatGesprungen && (
                                          <div style={{display:'flex',alignItems:'center',gap:'10px',margin:'0 0 10px',padding:'8px 12px',background:'rgba(212,175,55,0.08)',borderRadius:'8px',border:'1px solid rgba(212,175,55,0.25)'}}>
                                            <span style={{fontSize:'13px',color:'var(--text-muted,#aaa)',flex:1}}>⬆️ Gesprungene Techniken bewerten:</span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setGesprungeneAktiv(prev => ({...prev, [pruefling.pruefung_id]: !gesprungAktiv}));
                                                scheduleAutoSave(pruefling.pruefung_id);
                                              }}
                                              style={{padding:'5px 14px',borderRadius:'6px',border:'none',cursor:'pointer',fontWeight:700,fontSize:'13px',
                                                background: gesprungAktiv ? 'rgba(22,163,74,0.25)' : 'rgba(255,255,255,0.08)',
                                                color: gesprungAktiv ? '#4ade80' : 'var(--text-muted,#aaa)',
                                                outline: gesprungAktiv ? '1px solid #4ade80' : '1px solid rgba(255,255,255,0.15)'
                                              }}
                                            >
                                              {gesprungAktiv ? '✓ Ja — aktiv' : '✗ Nein — deaktiviert'}
                                            </button>
                                          </div>
                                        )}

                                        <div className="pd-inhalte-grid">
                                          {anzeigeInhalte.map((inhalt, idx) => {

                                            const inhaltId = inhalt.id || inhalt.inhalt_id;
                                            const bewertung = bewertungen[pruefling.pruefung_id]?.[kategorie]?.find(b => b.inhalt_id === inhaltId) || {};
                                            return (
                                              <div key={`${kategorie}-${idx}-${inhaltId}`} className={`pd-inhalt-row${inhalt.ist_gesprungen ? ' pd-inhalt-row--gesprungen' : ''}`}>
                                                <span className="pd-inhalt-text">
                                                  {inhalt.inhalt || inhalt.titel}
                                                  {inhalt.ist_gesprungen && <span style={{marginLeft:'6px',fontSize:'11px',background:'rgba(99,102,241,0.2)',color:'#818cf8',border:'1px solid rgba(99,102,241,0.4)',borderRadius:'4px',padding:'1px 5px',fontWeight:600}}>⬆️ gesprungen</span>}
                                                </span>
                                                <div className="pd-inhalt-controls">
                                                  <div className="pd-bestanden-wrap">
                                                    <button
                                                      type="button"
                                                      onClick={() => updateBewertung(pruefling.pruefung_id, inhaltId, kategorie, 'bestanden', !bewertung.bestanden)}
                                                      className={`btn-toggle pd-inhalt-btn ${bewertung.bestanden ? 'btn-toggle-success active' : 'btn-toggle-neutral'}`}
                                                    >
                                                      {bewertung.bestanden ? (
                                                        <>
                                                          <Check size={14} className="pd-icon-mr" />
                                                          Bestanden
                                                        </>
                                                      ) : (
                                                        <>
                                                          <X size={14} className="pd-icon-mr" />
                                                          offen
                                                        </>
                                                      )}
                                                    </button>
                                                  </div>
                                                  {!inhalt.ohne_punkte && (
                                                    <div className="pd-pkt-wrap">
                                                      <select
                                                        className="pd-pkt-select"
                                                        value={bewertung.punktzahl != null && bewertung.punktzahl !== '' ? bewertung.punktzahl : ''}
                                                        onChange={(e) => updateBewertung(pruefling.pruefung_id, inhaltId, kategorie, 'punktzahl', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                      >
                                                        <option value="">–</option>
                                                        {genPunkteOptions(inhalt.max_punktzahl || bewertung.max_punktzahl || pruefSettings.max_punkte_item || 10, pruefSettings.punkte_modus).map(opt =>
                                                          <option key={opt} value={opt}>{opt}</option>
                                                        )}
                                                      </select>
                                                      <span className="pd-pkt-max">
                                                        / {inhalt.max_punktzahl || bewertung.max_punktzahl || 10}
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}

                                          {/* Freie Techniken */}
                                          {(pdFreieTechniken[pruefling.pruefung_id]?.[kategorie] || []).map(item => {
                                            const bewertung = bewertungen[pruefling.pruefung_id]?.[kategorie]?.find(b => b.inhalt_id === item.id) || {};
                                            return (
                                              <div key={item.id} className="pd-inhalt-row pd-inhalt-row--frei">
                                                <span className="pd-inhalt-text" style={{fontStyle:'italic'}}>
                                                  <span style={{fontSize:'10px',color:'var(--primary)',marginRight:'4px',opacity:0.7}}>✦</span>
                                                  {item.titel}
                                                </span>
                                                <div className="pd-inhalt-controls">
                                                  <div className="pd-bestanden-wrap">
                                                    <button
                                                      type="button"
                                                      onClick={() => updateBewertung(pruefling.pruefung_id, item.id, kategorie, 'bestanden', !bewertung.bestanden)}
                                                      className={`btn-toggle pd-inhalt-btn ${bewertung.bestanden ? 'btn-toggle-success active' : 'btn-toggle-neutral'}`}
                                                    >
                                                      {bewertung.bestanden ? <><Check size={14} className="pd-icon-mr" />Bestanden</> : <><X size={14} className="pd-icon-mr" />offen</>}
                                                    </button>
                                                  </div>
                                                  <div className="pd-pkt-wrap">
                                                    <select
                                                      className="pd-pkt-select"
                                                      value={bewertung.punktzahl != null && bewertung.punktzahl !== '' ? bewertung.punktzahl : ''}
                                                      onChange={(e) => updateBewertung(pruefling.pruefung_id, item.id, kategorie, 'punktzahl', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                    >
                                                      <option value="">–</option>
                                                      {genPunkteOptions(pruefSettings.max_punkte_item || 10, pruefSettings.punkte_modus).map(opt =>
                                                        <option key={opt} value={opt}>{opt}</option>
                                                      )}
                                                    </select>
                                                    <span className="pd-pkt-max">/ {pruefSettings.max_punkte_item || 10}</span>
                                                  </div>
                                                  <button
                                                    type="button"
                                                    onClick={() => removePdFreieTechnik(pruefling.pruefung_id, kategorie, item.id)}
                                                    style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:'14px',padding:'0 4px',opacity:0.5,lineHeight:1}}
                                                    title="Entfernen"
                                                  >×</button>
                                                </div>
                                              </div>
                                            );
                                          })}

                                          {/* + Freie Technik */}
                                          {pdFreiInputKey === `${pruefling.pruefung_id}_${kategorie}` ? (
                                            <div style={{display:'flex',gap:'6px',alignItems:'center',padding:'4px 0 2px'}}>
                                              <input
                                                autoFocus
                                                type="text"
                                                value={pdFreiInputText}
                                                placeholder="Technik-Bezeichnung..."
                                                onChange={e => setPdFreiInputText(e.target.value)}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') addPdFreieTechnik(pruefling.pruefung_id, kategorie, pdFreiInputText);
                                                  if (e.key === 'Escape') { setPdFreiInputKey(null); setPdFreiInputText(''); }
                                                }}
                                                style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid var(--primary)',borderRadius:'5px',color:'var(--text-primary)',padding:'4px 8px',fontSize:'13px',outline:'none'}}
                                              />
                                              <button type="button"
                                                onClick={() => addPdFreieTechnik(pruefling.pruefung_id, kategorie, pdFreiInputText)}
                                                style={{background:'var(--primary)',border:'none',borderRadius:'5px',color:'#fff',padding:'4px 10px',fontWeight:700,cursor:'pointer',fontSize:'13px'}}>✓</button>
                                              <button type="button"
                                                onClick={() => { setPdFreiInputKey(null); setPdFreiInputText(''); }}
                                                style={{background:'none',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'5px',color:'var(--text-muted)',padding:'4px 8px',cursor:'pointer',fontSize:'12px'}}>✕</button>
                                            </div>
                                          ) : (
                                            <button type="button"
                                              onClick={() => { setPdFreiInputKey(`${pruefling.pruefung_id}_${kategorie}`); setPdFreiInputText(''); }}
                                              style={{background:'none',border:'1px dashed rgba(255,255,255,0.2)',borderRadius:'5px',color:'var(--text-muted)',padding:'3px 10px',cursor:'pointer',fontSize:'12px',marginTop:'4px',width:'100%',textAlign:'left',transition:'border-color 0.15s,color 0.15s'}}
                                              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.color='var(--primary)'; }}
                                              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.2)'; e.currentTarget.style.color='var(--text-muted)'; }}
                                            >+ Technik</button>
                                          )}
                                        </div>
                                        </>}
                                      </div>
                                      );
                                    })}

                                    {/* Gesamt-Punkte Zusammenfassung */}
                                    {(() => {
                                      const gesprungAktivGesamt = gesprungeneAktiv[pruefling.pruefung_id] || false;
                                      const allInhalte = Object.values(pruefungsinhalte[pruefling.pruefung_id]).flat();
                                      const mitPunkte = allInhalte.filter(i => !i.ohne_punkte && (gesprungAktivGesamt || !i.ist_gesprungen));
                                      const mitPunkteIds = new Set(mitPunkte.map(i => i.id));
                                      const allBew = Object.values(bewertungen[pruefling.pruefung_id] || {}).flat().filter(b => mitPunkteIds.has(b.inhalt_id));
                                      const totalP = allBew.reduce((s, b) => s + (parseFloat(b.punktzahl) || 0), 0);
                                      // Gesprungene nur in Max einrechnen wenn Punkte eingetragen wurden
                                      const mitEingetragenenPunktenIds = new Set(
                                        allBew.filter(b => b.punktzahl !== undefined && b.punktzahl !== null && b.punktzahl !== '').map(b => b.inhalt_id)
                                      );
                                      const totalM = mitPunkte.reduce((s, i) => {
                                        if (i.ist_gesprungen && !mitEingetragenenPunktenIds.has(i.id)) return s;
                                        return s + (parseFloat(i.max_punktzahl) || 10);
                                      }, 0);
                                      const pct = totalM > 0 ? Math.round((totalP / totalM) * 100) : 0;
                                      return (
                                        <div style={{display:'flex',justifyContent:'flex-end',alignItems:'center',gap:'12px',marginTop:'16px',padding:'10px 16px',background:'rgba(255,255,255,0.04)',borderRadius:'8px',borderTop:'2px solid rgba(212,175,55,0.4)'}}>
                                          <span style={{color:'var(--text-muted,#aaa)',fontSize:'13px',fontWeight:500}}>Gesamt:</span>
                                          <span style={{color:'#d4af37',fontWeight:700,fontSize:'16px'}}>{totalP}</span>
                                          <span style={{color:'var(--text-muted,#aaa)',fontSize:'13px'}}>/ {totalM} Punkte</span>
                                          <span style={{background:'rgba(212,175,55,0.15)',color:'#d4af37',borderRadius:'5px',padding:'2px 8px',fontSize:'12px',fontWeight:700}}>{pct}%</span>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}

                                {/* Aktionen */}
                                <div className="pd-action-row">
                                  {autoSaveStatus[pruefling.pruefung_id] === 'saving' && (
                                    <span style={{fontSize:'12px',color:'var(--text-secondary,#aaa)',marginRight:'auto',alignSelf:'center'}}>
                                      ⏳ Speichern…
                                    </span>
                                  )}
                                  {autoSaveStatus[pruefling.pruefung_id] === 'saved' && (
                                    <span style={{fontSize:'12px',color:'#4ade80',marginRight:'auto',alignSelf:'center'}}>
                                      ✓ Automatisch gespeichert
                                    </span>
                                  )}
                                  <button
                                    onClick={() => setEditingPruefling(null)}
                                    className="btn btn-secondary"
                                  >
                                    Abbrechen
                                  </button>
                                  <button
                                    onClick={() => handleSpeichern(pruefling)}
                                    className="btn btn-icon btn-success"
                                  >
                                    <Save size={18} />
                                    Speichern
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Aktionen für diesen Termin */}
                      <div style={{display:'flex',justifyContent:'flex-end',gap:'8px',padding:'12px 0 4px',borderTop:'1px solid rgba(255,255,255,0.06)',marginTop:'8px',flexWrap:'wrap'}}>
                        <button
                          disabled
                          title="Urkunden drucken — kommt in Kürze"
                          style={{opacity:0.45,cursor:'not-allowed',fontSize:'13px',padding:'6px 12px',background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:'6px',color:'var(--text-muted)'}}
                        >
                          🎖️ Urkunden drucken
                        </button>
                        {pruefungenAmTag.some(p => p.status === 'bestanden') && (
                          <button
                            onClick={() => prepareArtikel({
                              datum,
                              bestanden: pruefungenAmTag
                                .filter(p => p.status === 'bestanden')
                                .map(p => ({
                                  name: [p.vorname, p.nachname].filter(Boolean).join(' '),
                                  neuerGurt: p.graduierung_nachher || '',
                                  stilName: p.stil_name || ''
                                }))
                            })}
                            style={{fontSize:'13px',padding:'6px 12px',background:'rgba(212,175,55,0.15)',border:'1px solid rgba(212,175,55,0.45)',borderRadius:'6px',color:'#d4af37',cursor:'pointer',fontWeight:600}}
                          >
                            📰 Artikel erstellen
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setExternModalDatum(datum);
                            setExternForm({ vorname: '', nachname: '', verein: '', stil_id: pruefungenAmTag[0]?.stil_id?.toString() || '', graduierung_nachher_id: '' });
                            setShowExternModal(true);
                          }}
                          style={{fontSize:'13px',padding:'6px 12px',background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.4)',borderRadius:'6px',color:'#818cf8',cursor:'pointer'}}
                        >
                          + Externen Teilnehmer
                        </button>
                        <button
                          onClick={() => handleAlleSpeichern(pruefungenAmTag)}
                          disabled={loading}
                          style={{fontSize:'13px',padding:'6px 14px',background:'rgba(34,197,94,0.2)',border:'1px solid rgba(34,197,94,0.5)',borderRadius:'6px',color:'#4ade80',cursor:'pointer',fontWeight:600,display:'flex',alignItems:'center',gap:'6px'}}
                        >
                          <Check size={14} /> {loading ? 'Speichern…' : 'Alle speichern'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      )}
      {/* Protokoll-Modal */}
      {protokollModal && (() => {
        const pruefling = pruefungen.find(p => p.pruefung_id === protokollModal);
        const existing = protokollStatus[protokollModal];
        const datumStr = pruefling ? new Date(pruefling.pruefungsdatum).toLocaleDateString('de-DE') : '';
        const inputStyle = { width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#fff', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' };
        const labelStyle = { display: 'block', fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' };
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={() => setProtokolModal(null)}>
            <div style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.7)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', color: '#fff', fontSize: '1.1rem' }}>📋 Prüfungsprotokoll</h3>
                  {pruefling && (
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                      {pruefling.vorname} {pruefling.nachname} · {pruefling.stil_name} · {datumStr}
                      {' · '}<span style={{ color: pruefling.status === 'bestanden' ? '#4ade80' : '#f87171' }}>
                        {pruefling.status === 'bestanden' ? '✅ bestanden' : '❌ nicht bestanden'}
                      </span>
                    </p>
                  )}
                </div>
                <button onClick={() => setProtokolModal(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>

              {existing?.gesendet_am && (
                <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', padding: '8px 12px', marginBottom: '16px', fontSize: '12px', color: '#4ade80' }}>
                  ✓ Protokoll gesendet am {new Date(existing.gesendet_am).toLocaleString('de-DE')}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={labelStyle}>Gesamtbewertung / Kommentar</label>
                  <textarea rows={3} value={protokollForm.gesamtkommentar} onChange={e => setProtokolForm(p => ({ ...p, gesamtkommentar: e.target.value }))} placeholder="Gesamteindruck der Prüfung…" style={inputStyle} />
                </div>
                <div>
                  <label style={{ ...labelStyle, color: 'rgba(134,239,172,0.7)' }}>💪 Stärken</label>
                  <textarea rows={2} value={protokollForm.staerken} onChange={e => setProtokolForm(p => ({ ...p, staerken: e.target.value }))} placeholder="Was wurde besonders gut gezeigt…" style={{ ...inputStyle, borderColor: 'rgba(34,197,94,0.25)' }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, color: 'rgba(252,211,77,0.7)' }}>🔧 Verbesserungspotenzial</label>
                  <textarea rows={2} value={protokollForm.verbesserungen} onChange={e => setProtokolForm(p => ({ ...p, verbesserungen: e.target.value }))} placeholder="Woran sollte gearbeitet werden…" style={{ ...inputStyle, borderColor: 'rgba(234,179,8,0.25)' }} />
                </div>
                <div>
                  <label style={{ ...labelStyle, color: 'rgba(147,197,253,0.7)' }}>💡 Empfehlungen</label>
                  <textarea rows={2} value={protokollForm.empfehlungen} onChange={e => setProtokolForm(p => ({ ...p, empfehlungen: e.target.value }))} placeholder="Trainingsschwerpunkte, nächste Schritte…" style={{ ...inputStyle, borderColor: 'rgba(59,130,246,0.25)' }} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', flexWrap: 'wrap' }}>
                <button onClick={() => setProtokolModal(null)} style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}>
                  Schließen
                </button>
                <button
                  onClick={() => handleProtokolSave(protokollModal)}
                  disabled={protokollSaving}
                  style={{ padding: '8px 16px', background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.5)', borderRadius: '6px', color: '#818cf8', cursor: 'pointer', fontWeight: 600 }}
                >
                  {protokollSaving ? '⏳ Speichern…' : '💾 Speichern'}
                </button>
                {existing && (
                  <button
                    onClick={() => handleProtokolSenden(protokollModal)}
                    disabled={protokollSending}
                    style={{ padding: '8px 16px', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.5)', borderRadius: '6px', color: '#4ade80', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {protokollSending ? '⏳ Senden…' : '📤 An Mitglied senden'}
                  </button>
                )}
              </div>
              {!existing && (
                <p style={{ margin: '10px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.35)', textAlign: 'right' }}>
                  Erst speichern, dann versenden.
                </p>
              )}
            </div>
          </div>
        );
      })()}

      {/* Extern-Modal */}
      {showExternModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={() => setShowExternModal(false)}>
          <div style={{background:'#1e1e35',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'12px',padding:'24px',width:'100%',maxWidth:'460px',boxShadow:'0 20px 60px rgba(0,0,0,0.7)'}} onClick={e => e.stopPropagation()}>
            <h3 style={{margin:'0 0 4px',color:'var(--text-primary,#fff)'}}>Externen Teilnehmer hinzufügen</h3>
            <p style={{margin:'0 0 20px',color:'var(--text-muted)',fontSize:'13px'}}>
              {externModalDatum ? new Date(externModalDatum).toLocaleDateString('de-DE', {weekday:'long',day:'2-digit',month:'long',year:'numeric'}) : ''}
            </p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
              <div>
                <label style={{display:'block',fontSize:'12px',color:'var(--text-muted)',marginBottom:'4px'}}>Vorname *</label>
                <input type="text" value={externForm.vorname} onChange={e => setExternForm({...externForm,vorname:e.target.value})}
                  style={{width:'100%',padding:'8px 10px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',color:'#fff',fontSize:'14px',boxSizing:'border-box'}}
                  placeholder="Tom" autoFocus />
              </div>
              <div>
                <label style={{display:'block',fontSize:'12px',color:'var(--text-muted)',marginBottom:'4px'}}>Nachname *</label>
                <input type="text" value={externForm.nachname} onChange={e => setExternForm({...externForm,nachname:e.target.value})}
                  style={{width:'100%',padding:'8px 10px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',color:'#fff',fontSize:'14px',boxSizing:'border-box'}}
                  placeholder="Neal" />
              </div>
            </div>
            <div style={{marginBottom:'12px'}}>
              <label style={{display:'block',fontSize:'12px',color:'var(--text-muted)',marginBottom:'4px'}}>Verein / Schule (optional)</label>
              <input type="text" value={externForm.verein} onChange={e => setExternForm({...externForm,verein:e.target.value})}
                style={{width:'100%',padding:'8px 10px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',color:'#fff',fontSize:'14px',boxSizing:'border-box'}}
                placeholder="z.B. Kampfsportschule München" />
            </div>
            <div style={{marginBottom:'12px'}}>
              <label style={{display:'block',fontSize:'12px',color:'var(--text-muted)',marginBottom:'4px'}}>Kampfsport-Stil *</label>
              <select value={externForm.stil_id} onChange={e => setExternForm({...externForm,stil_id:e.target.value,graduierung_nachher_id:''})}
                style={{width:'100%',padding:'8px 10px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',color:'#fff',fontSize:'14px',boxSizing:'border-box'}}>
                <option value="">— Bitte wählen —</option>
                {stile.filter(s => s.aktiv).map(s => (
                  <option key={s.stil_id} value={s.stil_id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div style={{marginBottom:'20px'}}>
              <label style={{display:'block',fontSize:'12px',color:'var(--text-muted)',marginBottom:'4px'}}>Ziel-Graduierung *</label>
              <select value={externForm.graduierung_nachher_id} onChange={e => setExternForm({...externForm,graduierung_nachher_id:e.target.value})}
                style={{width:'100%',padding:'8px 10px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',color:'#fff',fontSize:'14px',boxSizing:'border-box'}}
                disabled={!externForm.stil_id}>
                <option value="">— erst Stil wählen —</option>
                {(graduierungen[parseInt(externForm.stil_id)] || []).filter(g => g.aktiv).map(g => (
                  <option key={g.graduierung_id || g.id} value={g.graduierung_id || g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div style={{display:'flex',gap:'10px',justifyContent:'flex-end'}}>
              <button onClick={() => setShowExternModal(false)} style={{padding:'8px 16px',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',color:'var(--text-muted)',cursor:'pointer'}}>Abbrechen</button>
              <button onClick={handleExternHinzufuegen} style={{padding:'8px 16px',background:'rgba(99,102,241,0.8)',border:'none',borderRadius:'6px',color:'#fff',cursor:'pointer',fontWeight:600}}>Hinzufügen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PruefungDurchfuehren;
