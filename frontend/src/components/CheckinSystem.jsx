import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, CheckCircle, User, X, Calendar, ArrowRight, Plus, Check, Star, Clock, ShoppingCart, FileText, QrCode, UserPlus, AlertTriangle
} from 'lucide-react';
import axios from 'axios';
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDojoContext } from '../context/DojoContext.jsx';
import VerkaufKasse from './VerkaufKasse';
import QRScanner from './QRScanner';
import config from '../config/config.js';
import "../styles/themes.css";       // Centralized theme system
import "../styles/components.css";   // Universal component styles
import '../styles/CheckinSystem.css';

const aggregateCheckinsByMember = (checkins = []) => {
  const map = new Map();

  checkins.forEach((entry) => {
    if (!entry) return;
    // Für Gäste: Verwende checkin_id als Key (da mitglied_id NULL ist)
    const isGuest = entry.ist_gast === 1 || entry.ist_gast === true;
    const key = isGuest
      ? `guest-${entry.checkin_id}`
      : (entry.mitglied_id || `${entry.vorname || ""}-${entry.nachname || ""}-${entry.checkin_id}`);

    if (!map.has(key)) {
      map.set(key, {
        mitglied_id: entry.mitglied_id,
        vorname: entry.vorname,
        nachname: entry.nachname,
        full_name:
          entry.full_name ||
          `${entry.vorname || ""} ${entry.nachname || ""}`.trim(),
        mitgliedsnummer: entry.mitgliedsnummer,
        foto_pfad: entry.foto_pfad,
        gurtfarbe: entry.gurtfarbe,
        kurse: [],
        checkins: [],
        primaryCheckin: entry,
        ist_gast: isGuest,
        gast_grund: entry.gast_grund,
        gast_email: entry.gast_email,
        gast_telefon: entry.gast_telefon,
      });
    }

    const aggregiert = map.get(key);
    aggregiert.kurse.push({
      kurs_name: entry.kurs_name,
      stil: entry.stil,
      stundenplan_id: entry.stundenplan_id,
      checkin_id: entry.checkin_id,
      checkin_time: entry.checkin_time,
      minutes_since_checkin: entry.minutes_since_checkin,
      status: entry.status,
    });
    aggregiert.checkins.push(entry);

    if (
      entry.checkin_time &&
      (!aggregiert.primaryCheckin?.checkin_time ||
        new Date(entry.checkin_time) <
          new Date(aggregiert.primaryCheckin.checkin_time))
    ) {
      aggregiert.primaryCheckin = entry;
    }
  });

  return Array.from(map.values()).map((person) => ({
    ...person,
    minutes_since_checkin: person.primaryCheckin?.minutes_since_checkin,
  }));
};

const CheckinSystem = () => {
  // Refs für automatische Fokussierung
  const searchInputRef = useRef(null);
  const navigate = useNavigate();
  const { updateTrigger } = useMitgliederUpdate(); // 🔄 Automatische Updates nach Mitgliedsanlage
  const { token } = useAuth(); // 🔐 Authentication token for API calls
  const { activeDojo } = useDojoContext(); // 🏠 Aktives Dojo für Dojo-Filterung

  // 🔒 Dojo-ID für API-Calls (Super-Admin: activeDojo.id, normale User: Backend filtert selbst)
  const activeDojoId = activeDojo && activeDojo !== 'super-admin' && activeDojo !== 'verband'
    ? activeDojo.id
    : null;

  // 🔍 BARCODE SCANNER SUPPORT
  const lastInputTimeRef = useRef(0);
  const inputBufferRef = useRef('');
  const scannerTimeoutRef = useRef(null);
  const SCANNER_THRESHOLD_MS = 50; // Scanner tippt schneller als 50ms pro Zeichen
  const SCANNER_COMPLETE_DELAY = 100; // Warte 100ms nach letzter Eingabe um Scan als komplett zu erkennen

  // 🔍 GLOBAL SCANNER: Neutscan USB/Bluetooth - funktioniert auch ohne Fokus auf Suchfeld
  const globalScanBufferRef = useRef('');
  const globalScanLastTimeRef = useRef(0);
  const globalScanTimeoutRef = useRef(null);
  const processScannerInputRef = useRef(null); // Ref auf aktuellen processScannerInput (vermeidet stale closure)

  // State Management
  const [members, setMembers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [scannerMode, setScannerMode] = useState(false); // Zeigt an ob Scanner-Eingabe erkannt wurde
  const [coursesToday, setCoursesToday] = useState([]);
  const [todayCheckins, setTodayCheckins] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Multi-step workflow
  const [selectedMember, setSelectedMember] = useState(null);
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [step, setStep] = useState(1); // 1: Member Selection, 2: Course Selection, 3: Confirmation
  const [memberCheckedInCourses, setMemberCheckedInCourses] = useState([]); // Stundenplan IDs für die das Mitglied heute schon eingecheckt ist
  const [memberIsAlreadyCheckedIn, setMemberIsAlreadyCheckedIn] = useState(false); // Ob Mitglied heute schon mind. 1 Check-in hat

  // Modal State
  const [showCheckinModal, setShowCheckinModal] = useState(false);

  // Verkauf State
  const [showVerkauf, setShowVerkauf] = useState(false);
  const [verkaufKunde, setVerkaufKunde] = useState(null);
  const [verkaufCheckinId, setVerkaufCheckinId] = useState(null);

  // Action Choice State (Verletzung oder Verkauf)
  const [showActionChoice, setShowActionChoice] = useState(false);
  const [actionChoiceReady, setActionChoiceReady] = useState(false);
  const [actionChoiceMember, setActionChoiceMember] = useState(null);
  const [actionChoiceCheckinId, setActionChoiceCheckinId] = useState(null);

  // Verletzung Modal State
  const [showVerletzungModal, setShowVerletzungModal] = useState(false);
  const [verletzungMember, setVerletzungMember] = useState(null);
  const [verletzungForm, setVerletzungForm] = useState({
    datum: new Date().toISOString().split('T')[0],
    art: '',
    koerperregion: '',
    schwere: 'leicht',
    notizen: '',
    wieder_trainierbar_ab: '',
  });
  const [verletzungSaving, setVerletzungSaving] = useState(false);
  const [verletzungError, setVerletzungError] = useState(null);

  // QR Scanner State
  const [showQRScanner, setShowQRScanner] = useState(false);

  // Gast Check-in State
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestData, setGuestData] = useState({
    gast_vorname: '',
    gast_nachname: '',
    gast_email: '',
    gast_telefon: '',
    gast_grund: 'probetraining',
    stundenplan_id: null
  });
  const [guestLoading, setGuestLoading] = useState(false);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    member: null
  });

  // API Configuration
  const API_BASE = config.apiBaseUrl;

  // Initialize data
  useEffect(() => {
    loadInitialData();
    // 🔄 AUTOMATISCHES UPDATE: Lädt neu wenn sich Mitglieder oder aktives Dojo ändern
  }, [updateTrigger, activeDojoId]); // activeDojoId: bei Dojo-Wechsel neu laden

  // Automatische Fokussierung des Suchfeldes beim Laden der Komponente
  useEffect(() => {
    if (searchInputRef.current && !loading) {
      searchInputRef.current.focus();
    }
  }, [loading]);

  // Automatische Fokussierung nach Reset des Workflows
  useEffect(() => {
    if (step === 1 && searchInputRef.current && !showCheckinModal) {
      // Kleine Verzögerung damit das Modal vollständig geschlossen ist
      setTimeout(() => {
        searchInputRef.current.focus();
      }, 100);
    }
  }, [step, showCheckinModal]);

  // 🔍 BARCODE SCANNER: Verarbeite gescannten Code
  const processScannerInput = async (scannedValue) => {
    console.log('🔍 Scanner erkannt:', scannedValue);
    setScannerMode(false);

    // Versuche Mitglied zu finden
    // 1. Nach Mitgliedsnummer suchen
    let member = members.find(m =>
      m.mitgliedsnummer && m.mitgliedsnummer.toLowerCase() === scannedValue.toLowerCase()
    );

    // 2. Nach ID suchen (falls numerisch)
    if (!member && /^\d+$/.test(scannedValue)) {
      member = members.find(m => m.mitglied_id === parseInt(scannedValue));
    }

    // 2.5 Nach DOJO_MEMBER QR-Code Format suchen (DOJO_MEMBER:ID:Name:Email)
    if (!member && scannedValue.startsWith('DOJO_MEMBER:')) {
      const parts = scannedValue.split(':');
      if (parts.length >= 2) {
        const memberId = parseInt(parts[1]);
        if (!isNaN(memberId)) {
          member = members.find(m => m.mitglied_id === memberId);
          console.log('🔍 DOJO_MEMBER QR erkannt, ID:', memberId);
        }
      }
    }

    // 3. Nach QR-Code Format suchen (z.B. JSON oder spezielle Formate)
    if (!member && scannedValue.startsWith('{')) {
      try {
        const parsed = JSON.parse(scannedValue);
        if (parsed.mitglied_id) {
          member = members.find(m => m.mitglied_id === parsed.mitglied_id);
        }
      } catch (e) {
        console.log('Kein gültiges JSON');
      }
    }

    // 4. Nach Name suchen (Vorname Nachname oder Nachname, Vorname)
    if (!member) {
      const nameParts = scannedValue.split(/[\s,]+/);
      if (nameParts.length >= 2) {
        member = members.find(m =>
          (m.vorname.toLowerCase() === nameParts[0].toLowerCase() &&
           m.nachname.toLowerCase() === nameParts[1].toLowerCase()) ||
          (m.nachname.toLowerCase() === nameParts[0].toLowerCase() &&
           m.vorname.toLowerCase() === nameParts[1].toLowerCase())
        );
      }
    }

    if (member) {
      // Mitglied gefunden - Check-in starten
      playBeep(true); // 🔊 Erfolgs-Beep
      setSuccess(`✅ Scanner: ${member.vorname} ${member.nachname} erkannt`);
      setSearchTerm('');

      // Kurze Verzögerung für visuelles Feedback
      setTimeout(() => {
        selectMemberFromSearch(member);
      }, 300);
    } else {
      // Nicht gefunden - zeige Fehlermeldung
      playBeep(false); // 🔊 Fehler-Beep
      setError(`❌ Kein Mitglied gefunden für: "${scannedValue}"`);
      setSearchTerm('');
      setTimeout(() => setError(''), 3000);
    }

    // Fokus zurück aufs Suchfeld
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);
  };

  // Ref aktuell halten (für globalen Listener ohne stale closure)
  processScannerInputRef.current = processScannerInput;

  // 🔊 Audio-Feedback: kurzer Beep bei Scan
  const playBeep = (success = true) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = success ? 1047 : 330; // C6 = Erfolg, E4 = Fehler
      oscillator.type = 'sine';
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // Web Audio nicht verfügbar - ignorieren
    }
  };

  // 🔍 GLOBAL SCANNER LISTENER: Neutscan USB/Bluetooth
  // Fängt Scanner-Eingaben auch wenn kein Feld fokussiert ist
  useEffect(() => {
    const GLOBAL_THRESHOLD_MS = 80;   // Neutscan tippt schneller als 80ms/Zeichen
    const GLOBAL_COMPLETE_DELAY = 150; // 150ms nach letztem Zeichen = Scan komplett

    const handleGlobalKeydown = (e) => {
      const activeEl = document.activeElement;

      // Wenn Search-Input fokussiert → bestehender Handler übernimmt
      if (activeEl === searchInputRef.current) return;

      // Wenn anderes Input-Feld fokussiert (z.B. Gast-Modal) → ignorieren
      if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) return;

      const now = Date.now();
      const timeDiff = now - globalScanLastTimeRef.current;
      globalScanLastTimeRef.current = now;

      if (e.key === 'Enter') {
        const buffer = globalScanBufferRef.current.trim();
        globalScanBufferRef.current = '';
        if (globalScanTimeoutRef.current) {
          clearTimeout(globalScanTimeoutRef.current);
          globalScanTimeoutRef.current = null;
        }
        if (buffer.length >= 3) {
          e.preventDefault();
          processScannerInputRef.current?.(buffer);
        }
        return;
      }

      // Nur druckbare Zeichen verarbeiten
      if (e.key.length !== 1) return;

      // Schnelle Eingabe (Scanner) oder Buffer bereits aktiv
      if (timeDiff < GLOBAL_THRESHOLD_MS || globalScanBufferRef.current.length > 0) {
        e.preventDefault(); // Verhindert Zeichen im gerade fokussierten Element
        globalScanBufferRef.current += e.key;

        if (globalScanTimeoutRef.current) clearTimeout(globalScanTimeoutRef.current);
        globalScanTimeoutRef.current = setTimeout(() => {
          const buffer = globalScanBufferRef.current.trim();
          globalScanBufferRef.current = '';
          globalScanTimeoutRef.current = null;
          if (buffer.length >= 3) {
            processScannerInputRef.current?.(buffer);
          }
        }, GLOBAL_COMPLETE_DELAY);
      }
    };

    document.addEventListener('keydown', handleGlobalKeydown);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeydown);
      if (globalScanTimeoutRef.current) clearTimeout(globalScanTimeoutRef.current);
    };
  }, []); // Stabil - verwendet ref für processScannerInput

  // 🔍 BARCODE SCANNER: Input-Handler mit Scanner-Erkennung
  const handleSearchInput = (e) => {
    const value = e.target.value;
    const currentTime = Date.now();
    const timeDiff = currentTime - lastInputTimeRef.current;

    // Wenn Eingabe sehr schnell kommt (< 50ms), ist es wahrscheinlich ein Scanner
    if (timeDiff < SCANNER_THRESHOLD_MS && value.length > 1) {
      setScannerMode(true);
      inputBufferRef.current = value;

      // Lösche vorherigen Timeout
      if (scannerTimeoutRef.current) {
        clearTimeout(scannerTimeoutRef.current);
      }

      // Warte kurz ob noch mehr kommt
      scannerTimeoutRef.current = setTimeout(() => {
        if (inputBufferRef.current.length >= 3) {
          processScannerInput(inputBufferRef.current.trim());
          inputBufferRef.current = '';
        }
      }, SCANNER_COMPLETE_DELAY);
    } else {
      // Normale Tastatureingabe
      setScannerMode(false);
    }

    lastInputTimeRef.current = currentTime;
    setSearchTerm(value);
  };

  // 🔍 BARCODE SCANNER: Enter-Taste verarbeiten (viele Scanner senden Enter am Ende)
  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      const value = searchTerm.trim();

      // Wenn Scanner-Modus oder schnelle Eingabe
      if (scannerMode || value.length >= 3) {
        // Lösche pending Timeout
        if (scannerTimeoutRef.current) {
          clearTimeout(scannerTimeoutRef.current);
        }

        // Prüfe ob es eine Scanner-Eingabe sein könnte
        const timeSinceLastInput = Date.now() - lastInputTimeRef.current;
        if (timeSinceLastInput < 500 && value.length >= 3) {
          processScannerInput(value);
          return;
        }
      }

      // Normale Enter-Taste: Erstes Suchergebnis auswählen
      if (filteredMembers.length > 0) {
        selectMemberFromSearch(filteredMembers[0]);
      }
    }
  };

  // Cleanup für Scanner-Timeout
  useEffect(() => {
    return () => {
      if (scannerTimeoutRef.current) {
        clearTimeout(scannerTimeoutRef.current);
      }
    };
  }, []);

  const loadInitialData = async () => {
    try {
      await Promise.all([
        loadMembers(),
        loadCoursesToday(),
        loadTodayCheckins()
      ]);
    } catch (err) {
      console.error('Fehler beim Laden der Daten:', err);
    }
  };

  const loadMembers = async () => {
    try {
      const dojoParam = activeDojoId ? `?dojo_id=${activeDojoId}` : '';
      const response = await fetch(`${API_BASE}/mitglieder${dojoParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const membersList = Array.isArray(data) ? data : (data.data || []);
      console.log('📥 Mitglieder geladen:', membersList.length);
      console.log('📸 Erste 3 Mitglieder mit foto_pfad:', membersList.slice(0, 3).map(m => ({
        name: `${m.vorname} ${m.nachname}`,
        foto_pfad: m.foto_pfad
      })));
      setMembers(membersList);
    } catch (err) {
      console.error('Fehler beim Laden der Mitglieder:', err);
      setMembers([]);
    }
  };

  const loadCoursesToday = async () => {
    try {
      const dojoParam = activeDojoId ? `?dojo_id=${activeDojoId}` : '';
      const response = await fetch(`${API_BASE}/checkin/courses-today${dojoParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const coursesList = data.courses || [];
      setCoursesToday(coursesList);
    } catch (err) {
      console.error('Fehler beim Laden der Kurse:', err);
      setError(`Kurse konnten nicht geladen werden: ${err.message}`);
      setCoursesToday([]);
    }
  };

  const loadTodayCheckins = async () => {
    try {
      const dojoParam = activeDojoId ? `?dojo_id=${activeDojoId}` : '';
      const response = await fetch(`${API_BASE}/checkin/today${dojoParam}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const checkinsList = data.checkins || [];
      setTodayCheckins(checkinsList);
    } catch (err) {
      console.error('Fehler beim Laden der Check-ins:', err);
      // Bestehende Check-ins NICHT löschen bei Fehler – vermeidet den "sofort ausgecheckt"-Effekt
      // wenn ein kurzzeitiger Server/Netzwerk-Fehler auftritt
    }
  };

  const aggregatedTodayCheckins = useMemo(
    () => aggregateCheckinsByMember(todayCheckins),
    [todayCheckins]
  );

  const loadMemberCheckins = async (mitgliedId) => {
    try {
      const response = await fetch(`${API_BASE}/checkin/today-member/${mitgliedId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const stundenplanIds = data.stundenplan_ids || [];
      setMemberCheckedInCourses(stundenplanIds);
      return stundenplanIds;
    } catch (err) {
      console.error('Fehler beim Laden der Mitglieder Check-ins:', err);
      setMemberCheckedInCourses([]);
      return [];
    }
  };

  // Filter members based on search - nur für Suche, nicht für Klick
  const filteredMembers = members.filter(member => 
    member.vorname.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.nachname.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if member is already checked in
  const isCheckedIn = (memberId) => {
    return todayCheckins.some(checkin => 
      checkin.mitglied_id === memberId && 
      (checkin.status === 'active' || checkin.status === 'completed')
    );
  };

  // Member selection - immer Check-in Modal öffnen (je Kurs einchecken möglich)
  const selectMemberFromSearch = async (member) => {
    setSelectedMember(member);
    setSelectedCourses([]);
    setStep(2);
    setError('');
    setSuccess('');
    setSearchTerm(''); // Suche zurücksetzen nach Auswahl

    // Lade bereits eingecheckte Kurse für dieses Mitglied
    const checkedInCourses = await loadMemberCheckins(member.mitglied_id);

    // Merke ob Mitglied heute schon mind. 1 Kurs eingecheckt hat (für Verkauf-Button im Modal)
    setMemberIsAlreadyCheckedIn(checkedInCourses.length > 0);

    setShowCheckinModal(true); // Modal öffnen

    // Fokus zurück aufs Suchfeld - sofort nächste Person scannen/suchen möglich
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);

    // Nach oben scrollen wenn Modal öffnet
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
  };

  // Verkauf starten (mit optionaler checkin_id für Verknüpfung)
  const startVerkauf = (member, checkinId = null) => {
    setVerkaufKunde(member);
    setVerkaufCheckinId(checkinId);
    setShowVerkauf(true);
  };

  // Verkauf schließen
  const closeVerkauf = () => {
    setShowVerkauf(false);
    setVerkaufKunde(null);
    setVerkaufCheckinId(null);

    // Fokussiere das Suchfeld nach dem Schließen des Verkaufs
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 100);
  };

  // Action Choice öffnen (Verletzung oder Verkauf)
  // Verzögerung + ready-Flag verhindert "tap-through" auf Touch-Geräten
  const openActionChoice = (member, checkinId = null) => {
    setActionChoiceMember(member);
    setActionChoiceCheckinId(checkinId);
    setActionChoiceReady(false);
    setTimeout(() => {
      setShowActionChoice(true);
      setTimeout(() => setActionChoiceReady(true), 200);
    }, 150);
  };

  const closeActionChoice = () => {
    setShowActionChoice(false);
    setActionChoiceReady(false);
    setActionChoiceMember(null);
    setActionChoiceCheckinId(null);
  };

  const openVerletzungModal = (member) => {
    setVerletzungMember(member);
    setVerletzungForm({
      datum: new Date().toISOString().split('T')[0],
      art: '',
      koerperregion: '',
      schwere: 'leicht',
      notizen: '',
      wieder_trainierbar_ab: '',
    });
    setVerletzungError(null);
    setShowVerletzungModal(true);
  };

  const closeVerletzungModal = () => {
    setShowVerletzungModal(false);
    setVerletzungMember(null);
    setVerletzungError(null);
  };

  const saveVerletzung = async () => {
    if (!verletzungForm.art.trim()) {
      setVerletzungError('Bitte Art der Verletzung angeben.');
      return;
    }
    setVerletzungSaving(true);
    setVerletzungError(null);
    try {
      await axios.post('/verletzungen', { mitglied_id: verletzungMember.mitglied_id, ...verletzungForm });
      setSuccess(`Verletzung für ${verletzungMember.vorname} ${verletzungMember.nachname} gespeichert.`);
      setTimeout(() => setSuccess(''), 3000);
      closeVerletzungModal();
    } catch (err) {
      setVerletzungError('Fehler beim Speichern.');
    } finally {
      setVerletzungSaving(false);
    }
  };

  // QR-Code gescannt
  const handleQRScan = async (qrData, parsedData) => {
    console.log('QR-Code gescannt:', parsedData);

    if (!parsedData || !parsedData.mitglied_id) {
      setError('Ungueltiger QR-Code');
      return;
    }

    // Finde Mitglied in der Liste
    const member = members.find(m => m.mitglied_id === parsedData.mitglied_id);

    if (!member) {
      setError(`Mitglied mit ID ${parsedData.mitglied_id} nicht gefunden`);
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Schliesse Scanner
    setShowQRScanner(false);

    // Lade bereits eingecheckte Kurse für diesen Member
    const alreadyCheckedInIds = await loadMemberCheckins(member.mitglied_id);

    // Prüfe ob noch nicht eingecheckte Kurse heute verfügbar sind
    const availableCourseIds = coursesToday.map(c => c.stundenplan_id);
    const hasUncheckedCourses = availableCourseIds.some(id => !alreadyCheckedInIds.includes(id));

    if (!hasUncheckedCourses && alreadyCheckedInIds.length > 0) {
      // Alle Kurse eingecheckt -> Verkauf öffnen
      setSuccess(`${member.vorname} ${member.nachname} ist bereits für alle Kurse eingecheckt`);
      setTimeout(() => setSuccess(''), 2000);
      const memberCheckin = todayCheckins.find(c => c.mitglied_id === member.mitglied_id);
      const checkinId = memberCheckin?.primaryCheckin?.checkin_id || memberCheckin?.checkin_id;
      startVerkauf(member, checkinId);
    } else {
      // Noch Kurse offen -> Check-in Modal öffnen
      selectMemberFromSearch(member);
    }
  };

  // Gast Check-in ausführen
  const executeGuestCheckin = async () => {
    if (!guestData.gast_vorname.trim() || !guestData.gast_nachname.trim()) {
      setError('Vorname und Nachname sind erforderlich');
      return;
    }

    setGuestLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/checkin/guest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          gast_vorname: guestData.gast_vorname.trim(),
          gast_nachname: guestData.gast_nachname.trim(),
          gast_email: guestData.gast_email.trim() || null,
          gast_telefon: guestData.gast_telefon.trim() || null,
          gast_grund: guestData.gast_grund,
          stundenplan_id: guestData.stundenplan_id,
          checkin_method: 'manual'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const grundLabels = {
        'probetraining': 'Probetraining',
        'besucher': 'Besucher',
        'einmalig': 'Einmaliges Training',
        'sonstiges': 'Sonstiges'
      };

      setSuccess(`✅ Gast ${guestData.gast_vorname} ${guestData.gast_nachname} (${grundLabels[guestData.gast_grund]}) eingecheckt!`);

      // Modal schließen und Daten zurücksetzen
      setShowGuestModal(false);
      setGuestData({
        gast_vorname: '',
        gast_nachname: '',
        gast_email: '',
        gast_telefon: '',
        gast_grund: 'probetraining',
        stundenplan_id: null
      });

      // Check-ins neu laden
      await loadTodayCheckins();

      // Success nach 5 Sekunden ausblenden
      setTimeout(() => setSuccess(''), 5000);

    } catch (err) {
      console.error('Gast Check-in Fehler:', err);
      setError('Gast Check-in Fehler: ' + err.message);
    } finally {
      setGuestLoading(false);
    }
  };

  // Gast Modal schließen
  const closeGuestModal = () => {
    setShowGuestModal(false);
    setGuestData({
      gast_vorname: '',
      gast_nachname: '',
      gast_email: '',
      gast_telefon: '',
      gast_grund: 'probetraining',
      stundenplan_id: null
    });
    setError('');
  };

  // Course selection toggle
  const toggleCourse = (course) => {
    setSelectedCourses(prev => {
      const isSelected = prev.some(c => c.stundenplan_id === course.stundenplan_id);
      if (isSelected) {
        return prev.filter(c => c.stundenplan_id !== course.stundenplan_id);
      } else {
        return [...prev, course];
      }
    });
  };

  // Proceed to confirmation
  const proceedToConfirmation = () => {
    // Check-in ohne Kurs ist jetzt erlaubt (Freies Training)
    setStep(3);
    setError('');
  };

  // Execute check-out all
  const executeCheckoutAll = async () => {
    if (todayCheckins.length === 0) return;
    
    setLoading(true);
    
    try {
      // Alle Check-ins parallel auschecken
      const checkoutPromises = todayCheckins.map(checkin =>
        fetch(`${API_BASE}/checkin/checkout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ checkin_id: checkin.checkin_id })
        })
      );

      const responses = await Promise.all(checkoutPromises);
      
      // Prüfen ob alle erfolgreich waren
      const failedCheckouts = responses.filter(response => !response.ok);
      
      if (failedCheckouts.length > 0) {
        throw new Error(`${failedCheckouts.length} Check-outs fehlgeschlagen`);
      }
      
      const personenCount = aggregateCheckinsByMember(todayCheckins).length;
      setSuccess(`✅ Alle ${personenCount} Personen erfolgreich ausgecheckt!`);
      
      // Daten neu laden
      setTimeout(async () => {
        try {
          await loadTodayCheckins();
          setSuccess('');
        } catch (err) {
          console.error('Fehler beim Neuladen der Check-ins:', err);
        }
      }, 2000);
      
    } catch (err) {
      console.error('Checkout All Fehler:', err);
      setError('Fehler beim Auschecken aller Personen: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Execute check-out
  const executeCheckout = async (checkinId, memberName) => {
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE}/checkin/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ checkin_id: checkinId })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${errorText}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      setSuccess(`✅ ${memberName} erfolgreich ausgecheckt!`);
      
      // Daten neu laden
      setTimeout(async () => {
        try {
          await loadTodayCheckins();
          setSuccess('');
        } catch (err) {
          console.error('Fehler beim Neuladen der Check-ins:', err);
        }
      }, 2000);
      
    } catch (err) {
      console.error('Checkout Fehler:', err);
      setError('Checkout Fehler: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Execute check-in
  const executeCheckin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const requestBody = {
        mitglied_id: selectedMember.mitglied_id,
        stundenplan_ids: selectedCourses.map(c => c.stundenplan_id),
        checkin_method: 'touch'
      };

      console.log('🔄 Check-in Request:', requestBody);
      console.log('📡 API Base:', API_BASE);

      const response = await fetch(`${API_BASE}/checkin/multi-course`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      console.log('📥 Response Status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
        } catch {
          errorMessage = `HTTP ${response.status}: ${errorText}`;
        }
        throw new Error(errorMessage);
      }
      
      const result = await response.json();

      // Prüfe ob alle Check-ins fehlgeschlagen sind (stille Fehler durch Unique-Key-Verletzung etc.)
      const results = result.data?.results || [];
      const hasErfolg = results.some(r => r.status === 'erfolg');
      const allFehler = results.length > 0 && results.every(r => r.status === 'fehler');
      if (allFehler) {
        const firstError = results[0]?.error || 'Unbekannter Fehler';
        throw new Error(`Check-in fehlgeschlagen: ${firstError}`);
      }

      const successMessage = result.message || `Check-in erfolgreich für ${selectedMember.vorname} ${selectedMember.nachname}!`;
      setSuccess(`✅ ${successMessage}`);

      console.log('✅ Check-in erfolgreich!', result);

      // Modal sofort schließen und Workflow zurücksetzen
      resetWorkflow();

      // Daten SOFORT neu laden für Statistik-Update
      console.log('🔄 Lade Check-in-Daten neu...');
      try {
        await Promise.all([
          loadTodayCheckins(),
          loadCoursesToday()
        ]);
        console.log('✅ Check-in-Daten neu geladen!');
      } catch (err) {
        console.error('❌ Fehler beim Neuladen der Daten:', err);
      }

      // Success-Nachricht nach 5 Sekunden ausblenden
      setTimeout(() => {
        setSuccess('');
      }, 5000);
      
    } catch (err) {
      console.error('Check-in Fehler:', err);
      setError('Check-in Fehler: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset workflow
  const resetWorkflow = () => {
    setStep(1);
    setSelectedMember(null);
    setSelectedCourses([]);
    setMemberCheckedInCourses([]); // Eingecheckte Kurse zurücksetzen
    setMemberIsAlreadyCheckedIn(false);
    setError('');
    setSuccess('');
    setSearchTerm('');
    setShowCheckinModal(false); // Modal schließen
    
    // Fokussiere das Suchfeld nach dem Reset
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 150);
  };

  // Context Menu Handler
  const handleContextMenu = (e, checkin) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🔍 Context Menu - Checkin Daten:', checkin);
    
    // Berechne optimale Position (verhindert Scrollen)
    const menuHeight = 400; // Geschätzte Höhe des Menüs
    const windowHeight = window.innerHeight;
    const clickY = e.clientY;
    
    // Wenn das Menü unten abgeschnitten würde, zeige es oberhalb des Klicks
    let menuY = e.clientY;
    if (clickY + menuHeight > windowHeight) {
      menuY = Math.max(10, clickY - menuHeight);
    }
    
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: menuY,
      member: checkin
    });
  };

  // Context Menu schließen
  const closeContextMenu = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      member: null
    });
  };

  // Context Menu schließen bei Klick außerhalb
  useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        closeContextMenu();
      }
    };

    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => {
        document.removeEventListener('click', handleClickOutside);
      };
    }
  }, [contextMenu.visible]);

  // Modal schließen
  const closeCheckinModal = () => {
    setShowCheckinModal(false);
    resetWorkflow();
  };

  // Get belt color CSS class
  const getBeltColorClass = (gurtfarbe) => {
    const colors = {
      'Weiß': 'belt-weiss',
      'Gelb': 'belt-gelb',
      'Orange': 'belt-orange',
      'Grün': 'belt-gruen',
      'Blau': 'belt-blau',
      'Braun': 'belt-braun',
      'Schwarz': 'belt-schwarz',
      'Rot': 'belt-rot'
    };
    return colors[gurtfarbe] || 'belt-weiss';
  };

  if (loading && members.length === 0) {
    return (
      <div className="checkin-system">
        <div className="loading-container">
          <div className="loading-spinner-large"></div>
          <p>Lade Check-in System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="checkin-system">
      {/* Header mit Step-Header links und Stats rechts */}
      <div className="checkin-header">
        <div className="checkin-header-content">
          {/* Step Header links */}
          <div className="step-header">
            <div className="checkin-logo">
              <CheckCircle size={24} />
            </div>
            <div>
              <h1 className="checkin-title">Check-in Terminal</h1>
              <div className="checkin-subtitle">
                <span>{new Date().toLocaleDateString('de-DE', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}</span>
              </div>
            </div>
          </div>

          {/* Stats Grid rechts */}
          <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-card-content">
                  <span className="stat-icon">👥</span>
                  <span className="stat-value">{members.length}</span>
                </div>
                <div className="stat-label">Mitglieder</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-content">
                  <CheckCircle size={18} className="stat-icon-lucide" />
                  <span className="stat-value">{todayCheckins.length}</span>
                </div>
                <div className="stat-label">Check-ins heute</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-content">
                  <Calendar size={18} className="stat-icon-lucide" />
                  <span className="stat-value">{coursesToday.length}</span>
                </div>
                <div className="stat-label">Kurse heute</div>
              </div>
              <div className="stat-card">
                <div className="stat-card-content">
                  <Clock size={18} className="stat-icon-lucide" />
                  <span className="stat-value">
                    {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="stat-label">Uhrzeit</div>
              </div>
          </div>

          {/* Header Actions rechts */}
          <div className="header-actions">
            {/* Neutscan Status Indikator */}
            <div className="scanner-status-badge" title="Neutscan Scanner bereit - scanne jederzeit einen QR-Code">
              <div className="scanner-status-dot"></div>
              <QrCode size={14} />
              <span className="scanner-status-text">Scanner</span>
            </div>

            {/* Gast Check-in Button */}
            <button
              onClick={() => setShowGuestModal(true)}
              className="btn btn-secondary guest-checkin-btn"
              title="Gast einchecken"
            >
              <UserPlus size={20} />
              <span className="btn-text-desktop">Gast</span>
            </button>

            {/* QR Scanner Button (Kamera) */}
            <button
              onClick={() => setShowQRScanner(true)}
              className="btn btn-primary qr-scan-btn"
              title="QR-Code mit Kamera scannen"
            >
              <QrCode size={20} />
              <span className="btn-text-desktop">Kamera</span>
            </button>

            {/* Reset Button */}
            {step > 1 && (
              <button onClick={resetWorkflow} className="btn btn-secondary">
                ← Zurück zum Start
              </button>
            )}
          </div>
        </div>

        {/* Search Field im Header unter dem gelben Strich */}
        <div className="header-search-row">
          <div className="header-search-container">
            <Search className="search-icon" size={22} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder={scannerMode ? "🔍 Scanner erkannt..." : "Mitglied suchen oder scannen..."}
              value={searchTerm}
              onChange={handleSearchInput}
              onKeyDown={handleSearchKeyDown}
              className={`header-search-input ${scannerMode ? 'scanner-mode' : ''}`}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
            {searchTerm && (
              <X
                className="search-clear"
                size={18}
                onClick={() => setSearchTerm('')}
              />
            )}

            {/* Dropdown Results */}
            {searchTerm && filteredMembers.length > 0 && (
              <div className="search-dropdown">
                {filteredMembers.map(member => {
                  const checkedIn = isCheckedIn(member.mitglied_id);

                  return (
                    <div
                      key={member.mitglied_id}
                      onClick={() => selectMemberFromSearch(member)}
                      className={`search-dropdown-item ${checkedIn ? 'checked-in' : ''}`}
                    >
                      {/* Avatar: Foto oder Initialen */}
                      {member.foto_pfad ? (
                        <img
                          src={`${config.imageBaseUrl}${member.foto_pfad}`}
                          alt={`${member.vorname} ${member.nachname}`}
                          className="dropdown-avatar"
                        />
                      ) : (
                        <div className="dropdown-avatar-placeholder">
                          {member.vorname?.charAt(0)}{member.nachname?.charAt(0)}
                        </div>
                      )}

                      <div className="dropdown-member-info">
                        <div className="dropdown-member-name">
                          {member.vorname} {member.nachname}
                        </div>
                        {member.gurtfarbe && (
                          <div className="dropdown-member-belt">{member.gurtfarbe}</div>
                        )}
                      </div>

                      {checkedIn && (
                        <CheckCircle size={16} className="dropdown-check-icon" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="checkin-container compact">
        {/* Success/Error Messages */}
        {success && (
          <div className="message success">
            <CheckCircle size={24} />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="message error">
            <X size={24} />
            <span>{error}</span>
          </div>
        )}

        {/* Check-ins Liste */}
        <div className="checkin-main-layout">
          <div className="checkin-full-column">
            {/* Today's Check-ins - Smaller Cards */}
            {aggregatedTodayCheckins.length > 0 ? (
              <div className="checkins-list-container">
                <div className="checkins-header">
                  <h3>
                    <CheckCircle size={24} />
                    Heute eingecheckt ({aggregatedTodayCheckins.length})
                  </h3>
                  <button
                    onClick={executeCheckoutAll}
                    disabled={loading}
                    className="checkout-all-btn"
                    title="Alle Personen auschecken"
                  >
                    <X size={16} />
                    Alle Auschecken
                  </button>
                </div>

                {/* Kleinere Card Grid für eingecheckte Personen */}
                <div className="member-grid compact">
                  {aggregatedTodayCheckins.map((checkin) => {
                    const primaryCheckin = checkin.primaryCheckin || checkin.checkins?.[0];
                    const checkoutTargetId = primaryCheckin?.checkin_id;
                    const checkoutName = checkin.full_name || `${checkin.vorname || ""} ${checkin.nachname || ""}`.trim();
                    return (
                      <div 
                        key={checkin.mitglied_id || checkoutTargetId} 
                        className="member-card checked-in-card compact"
                        onClick={() => {
                          if (checkin.ist_gast) {
                            setSuccess(`Gast: ${checkin.vorname} ${checkin.nachname}`);
                            setTimeout(() => setSuccess(''), 2000);
                            return;
                          }
                          const memberData = {
                            mitglied_id: checkin.mitglied_id,
                            vorname: checkin.vorname,
                            nachname: checkin.nachname,
                            foto_pfad: checkin.foto_pfad,
                            gurtfarbe: checkin.gurtfarbe,
                            mitgliedsnummer: checkin.mitgliedsnummer
                          };
                          const checkinId = checkin.primaryCheckin?.checkin_id || checkin.checkin_id;
                          openActionChoice(memberData, checkinId);
                        }}
                        onContextMenu={(e) => handleContextMenu(e, checkin)}
                      >
                        <div className="member-card-content-simple">
                          {/* Avatar: Foto oder Initialen */}
                          {checkin.foto_pfad ? (
                            <img
                              src={checkin.foto_pfad.startsWith('http') ? checkin.foto_pfad : `${config.imageBaseUrl}${checkin.foto_pfad.startsWith('/') ? checkin.foto_pfad : '/' + checkin.foto_pfad}`}
                              alt={`${checkin.vorname} ${checkin.nachname}`}
                              className="member-avatar-checkin"
                              onError={(e) => {
                                console.error('❌ Check-in Bild konnte nicht geladen werden:', checkin.foto_pfad);
                                e.currentTarget.style.display = 'none';
                              }}
                              onLoad={() => {
                                console.log('✅ Check-in Bild geladen:', checkin.foto_pfad);
                              }}
                            />
                          ) : (
                            <div className="member-avatar-checkin">
                              {checkin.vorname?.charAt(0)}{checkin.nachname?.charAt(0)}
                            </div>
                          )}
                          
                          {/* Name */}
                          <div className="member-name-checkin">
                            <span>{checkin.vorname} {checkin.nachname}</span>
                            {(checkin.ist_gast === 1 || checkin.ist_gast === true) && (
                              <span className="guest-badge">
                                <UserPlus size={12} />
                                Gast
                              </span>
                            )}
                          </div>

                          {/* Auschecken Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (checkoutTargetId) {
                                executeCheckout(checkoutTargetId, checkoutName);
                              }
                            }}
                            disabled={loading || !checkoutTargetId}
                            className="checkout-button-checkin"
                            title="Auschecken"
                          >
                            <X size={18} />
                            <span>Auschecken</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <CheckCircle className="empty-state-icon" size={80} />
                <h3>Noch keine Check-ins heute</h3>
                <p>Sobald sich Mitglieder einchecken, erscheinen sie hier.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Check-in Modal (Steps 2 & 3) */}
      {showCheckinModal && selectedMember && (
        <div className="checkin-modal-overlay" onClick={closeCheckinModal}>
          <div className="checkin-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="checkin-modal-header">
              <div className="checkin-modal-title">
                <User size={24} />
                Check-in für {selectedMember.vorname} {selectedMember.nachname}
              </div>
              <button className="checkin-modal-close" onClick={closeCheckinModal}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="checkin-modal-body">
              {/* Step 2: Course Selection */}
              {step === 2 && (
                <div>
                  <h3>
                    <Calendar size={20} />
                    Verfügbare Kurse heute
                  </h3>

                  {/* Bereits eingecheckt-Hinweis mit Verkauf-Button */}
                  {memberIsAlreadyCheckedIn && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                      <CheckCircle size={16} />
                      <span>Bereits für {memberCheckedInCourses.length} Kurs{memberCheckedInCourses.length !== 1 ? 'e' : ''} eingecheckt — weiterer Kurs wählbar</span>
                      <button
                        onClick={() => {
                          closeCheckinModal();
                          const memberCheckin = todayCheckins.find(c => c.mitglied_id === selectedMember?.mitglied_id);
                          const checkinId = memberCheckin?.checkin_id || memberCheckin?.primaryCheckin?.checkin_id;
                          if (selectedMember) startVerkauf(selectedMember, checkinId);
                        }}
                        style={{ marginLeft: 'auto', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', borderRadius: '6px', padding: '0.25rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8rem' }}
                      >
                        <ShoppingCart size={14} />
                        Verkauf
                      </button>
                    </div>
                  )}

                  {coursesToday.filter(course => !memberCheckedInCourses.includes(course.stundenplan_id)).length === 0 ? (
                    <div className="empty-state">
                      <CheckCircle className="empty-state-icon" size={80} />
                      <h3>
                        {coursesToday.length === 0
                          ? 'Keine Kurse heute'
                          : 'Bereits für alle Kurse eingecheckt'
                        }
                      </h3>
                      <p>
                        {coursesToday.length === 0
                          ? 'Sie können sich für freies Training einchecken.'
                          : 'Sie sind heute bereits für alle verfügbaren Kurse eingecheckt. Sie können sich für freies Training einchecken.'
                        }
                      </p>
                    </div>
                  ) : (
                    <div className="course-grid">
                      {coursesToday
                        .filter(course => !memberCheckedInCourses.includes(course.stundenplan_id))
                        .map(course => {
                          const isSelected = selectedCourses.some(c => c.stundenplan_id === course.stundenplan_id);
                          const isFull = course.is_full;

                          return (
                            <div
                              key={course.stundenplan_id}
                              onClick={() => !isFull && toggleCourse(course)}
                              className={`course-card ${isSelected ? 'selected' : isFull ? 'full' : ''}`}
                            >
                              <div className="course-card-header">
                                <div className="course-info">
                                  <h4 className="course-name-primary">{course.stil || course.kurs_name}</h4>
                                  <div className="course-style-secondary">{course.kurs_name}</div>
                                  <div className="course-details">
                                    <span className="course-time">
                                      <Clock size={14} />
                                      {course.zeit}
                                    </span>
                                  </div>
                                </div>

                                <div className={`selection-indicator ${isFull ? 'full' : isSelected ? 'selected' : 'unselected'}`}>
                                  {isFull ? <X size={18} /> : isSelected ? <Check size={18} /> : <Plus size={18} />}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}

                  <div className="action-buttons u-mt-1">
                    <button onClick={closeCheckinModal} className="btn btn-secondary">
                      Abbrechen
                    </button>
                    <button onClick={() => setStep(3)} className="btn btn-primary">
                      {selectedCourses.length === 0 ? 'Freies Training →' : 'Weiter →'}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Confirmation */}
              {step === 3 && (
                <div className="confirmation-container">
                  <div className="confirmation-title">Check-in bestätigen</div>
                  <div className="confirmation-subtitle">
                    {selectedCourses.length === 0
                      ? 'Freies Training (ohne Kurs)'
                      : `${selectedCourses.length} Kurs${selectedCourses.length !== 1 ? 'e' : ''} ausgewählt`
                    }
                  </div>

                  {selectedCourses.length === 0 ? (
                    <div className="course-summary">
                      <div className="course-summary-item course-summary-item-empty">
                        <span>Check-in ohne Kurs - Freies Training</span>
                      </div>
                    </div>
                  ) : (
                    <div className="course-summary">
                      {selectedCourses.map((course, index) => (
                        <div key={index} className="course-summary-item">
                          <span>{course.kurs_name}</span>
                          <span>{course.zeit}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="action-buttons">
                    <button onClick={() => setStep(2)} className="btn btn-secondary">
                      ← Zurück
                    </button>
                    <button onClick={executeCheckin} disabled={loading} className="btn btn-success btn-large">
                      {loading ? 'Lädt...' : 'Jetzt anmelden!'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Verkauf Modal */}
      {showVerkauf && verkaufKunde && (
        <VerkaufKasse
          kunde={verkaufKunde}
          onClose={closeVerkauf}
          checkin_id={verkaufCheckinId}
        />
      )}

      {/* Action Choice Modal (Verletzung oder Verkauf) */}
      {showActionChoice && actionChoiceMember && (
        <div className="checkin-modal-overlay" onClick={closeActionChoice}>
          <div className="checkin-modal" style={{ maxWidth: '380px' }} onClick={(e) => e.stopPropagation()}>
            <div className="checkin-modal-header">
              <div className="checkin-modal-title">
                <User size={24} />
                {actionChoiceMember.vorname} {actionChoiceMember.nachname}
              </div>
              <button className="checkin-modal-close" onClick={closeActionChoice}>
                <X size={20} />
              </button>
            </div>
            <div className="checkin-modal-body">
              <p style={{ textAlign: 'center', marginBottom: '1.25rem', color: 'var(--text-secondary, #9ca3af)', fontSize: '0.95rem' }}>
                Was möchtest du aufnehmen?
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', pointerEvents: actionChoiceReady ? 'auto' : 'none', opacity: actionChoiceReady ? 1 : 0.5, transition: 'opacity 0.15s' }}>
                <button
                  onClick={() => {
                    closeActionChoice();
                    startVerkauf(actionChoiceMember, actionChoiceCheckinId);
                  }}
                  style={{
                    width: '100%', padding: '1.25rem', borderRadius: '12px',
                    background: 'rgba(16,185,129,0.12)', border: '2px solid rgba(16,185,129,0.4)',
                    color: '#10b981', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                    fontSize: '1.05rem', fontWeight: 600
                  }}
                >
                  <ShoppingCart size={26} />
                  Verkauf starten
                </button>
                <button
                  onClick={() => {
                    closeActionChoice();
                    openVerletzungModal(actionChoiceMember);
                  }}
                  style={{
                    width: '100%', padding: '1.25rem', borderRadius: '12px',
                    background: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.4)',
                    color: '#ef4444', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                    fontSize: '1.05rem', fontWeight: 600
                  }}
                >
                  <AlertTriangle size={26} />
                  Verletzung erfassen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Verletzung Modal */}
      {showVerletzungModal && verletzungMember && (
        <div className="checkin-modal-overlay" onClick={closeVerletzungModal}>
          <div className="checkin-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="checkin-modal-header">
              <div className="checkin-modal-title">
                <AlertTriangle size={22} />
                Verletzung — {verletzungMember.vorname} {verletzungMember.nachname}
              </div>
              <button className="checkin-modal-close" onClick={closeVerletzungModal}>
                <X size={20} />
              </button>
            </div>
            <div className="checkin-modal-body">
              {verletzungError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '0.6rem 0.75rem', color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>
                  {verletzungError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #9ca3af)', marginBottom: '0.3rem' }}>Datum</label>
                  <input
                    type="date"
                    value={verletzungForm.datum}
                    onChange={(e) => setVerletzungForm(f => ({ ...f, datum: e.target.value }))}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #9ca3af)', marginBottom: '0.3rem' }}>Art der Verletzung *</label>
                  <input
                    type="text"
                    value={verletzungForm.art}
                    onChange={(e) => setVerletzungForm(f => ({ ...f, art: e.target.value }))}
                    placeholder="z.B. Verstauchung, Prelllung, Zerrung..."
                    className="form-input"
                    style={{ width: '100%' }}
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #9ca3af)', marginBottom: '0.3rem' }}>Körperregion</label>
                  <select
                    value={verletzungForm.koerperregion}
                    onChange={(e) => setVerletzungForm(f => ({ ...f, koerperregion: e.target.value }))}
                    className="form-input"
                    style={{ width: '100%' }}
                  >
                    <option value="">— wählen —</option>
                    {['Kopf / Gesicht','Schulter / Schlüsselbein','Arm / Ellbogen','Handgelenk / Hand','Finger','Rippen / Brustkorb','Rücken / Wirbelsäule','Hüfte / Becken','Oberschenkel','Knie','Schienbein / Wade','Sprunggelenk / Fuß','Zehen','Sonstiges'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #9ca3af)', marginBottom: '0.3rem' }}>Schwere</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[{ value: 'leicht', label: '🟡 Leicht' }, { value: 'mittel', label: '🟠 Mittel' }, { value: 'schwer', label: '🔴 Schwer' }].map(s => (
                      <button
                        key={s.value}
                        onClick={() => setVerletzungForm(f => ({ ...f, schwere: s.value }))}
                        style={{
                          flex: 1, padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem',
                          background: verletzungForm.schwere === s.value ? 'rgba(99,102,241,0.2)' : 'transparent',
                          border: verletzungForm.schwere === s.value ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.1)',
                          color: 'inherit'
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #9ca3af)', marginBottom: '0.3rem' }}>Wieder trainierbar ab</label>
                  <input
                    type="date"
                    value={verletzungForm.wieder_trainierbar_ab}
                    onChange={(e) => setVerletzungForm(f => ({ ...f, wieder_trainierbar_ab: e.target.value }))}
                    className="form-input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary, #9ca3af)', marginBottom: '0.3rem' }}>Notizen</label>
                  <textarea
                    value={verletzungForm.notizen}
                    onChange={(e) => setVerletzungForm(f => ({ ...f, notizen: e.target.value }))}
                    placeholder="Weitere Details..."
                    className="form-input"
                    rows={3}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="action-buttons u-mt-1">
                <button onClick={closeVerletzungModal} className="btn btn-secondary">Abbrechen</button>
                <button onClick={saveVerletzung} className="btn btn-primary" disabled={verletzungSaving}>
                  {verletzungSaving ? 'Speichern...' : '✓ Verletzung speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={showQRScanner}
        onClose={() => setShowQRScanner(false)}
        onScan={handleQRScan}
      />

      {/* Gast Check-in Modal */}
      {showGuestModal && (
        <div className="checkin-modal-overlay" onClick={closeGuestModal}>
          <div className="checkin-modal guest-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="checkin-modal-header">
              <div className="checkin-modal-title">
                <UserPlus size={24} />
                Gast einchecken
              </div>
              <button className="checkin-modal-close" onClick={closeGuestModal}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="checkin-modal-body">
              <div className="guest-form">
                {/* Name Felder */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="gast_vorname">Vorname *</label>
                    <input
                      type="text"
                      id="gast_vorname"
                      value={guestData.gast_vorname}
                      onChange={(e) => setGuestData({...guestData, gast_vorname: e.target.value})}
                      placeholder="Vorname des Gastes"
                      className="form-input"
                      autoFocus
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="gast_nachname">Nachname *</label>
                    <input
                      type="text"
                      id="gast_nachname"
                      value={guestData.gast_nachname}
                      onChange={(e) => setGuestData({...guestData, gast_nachname: e.target.value})}
                      placeholder="Nachname des Gastes"
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Kontakt Felder */}
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="gast_email">E-Mail (optional)</label>
                    <input
                      type="email"
                      id="gast_email"
                      value={guestData.gast_email}
                      onChange={(e) => setGuestData({...guestData, gast_email: e.target.value})}
                      placeholder="email@beispiel.de"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="gast_telefon">Telefon (optional)</label>
                    <input
                      type="tel"
                      id="gast_telefon"
                      value={guestData.gast_telefon}
                      onChange={(e) => setGuestData({...guestData, gast_telefon: e.target.value})}
                      placeholder="+49 123 456789"
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Grund */}
                <div className="form-group">
                  <label htmlFor="gast_grund">Grund des Besuchs</label>
                  <select
                    id="gast_grund"
                    value={guestData.gast_grund}
                    onChange={(e) => setGuestData({...guestData, gast_grund: e.target.value})}
                    className="form-input"
                  >
                    <option value="probetraining">Probetraining</option>
                    <option value="besucher">Besucher</option>
                    <option value="einmalig">Einmaliges Training</option>
                    <option value="sonstiges">Sonstiges</option>
                  </select>
                </div>

                {/* Kurs Auswahl (optional) */}
                {coursesToday.length > 0 && (
                  <div className="form-group">
                    <label htmlFor="gast_kurs">Kurs (optional)</label>
                    <select
                      id="gast_kurs"
                      value={guestData.stundenplan_id || ''}
                      onChange={(e) => setGuestData({...guestData, stundenplan_id: e.target.value ? parseInt(e.target.value) : null})}
                      className="form-input"
                    >
                      <option value="">Freies Training (kein Kurs)</option>
                      {coursesToday.map(course => (
                        <option key={course.stundenplan_id} value={course.stundenplan_id}>
                          {course.kurs_name} ({course.zeit})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Hinweis */}
                <div className="guest-hint">
                  <p>* Pflichtfelder</p>
                  <p>Gäste werden als temporäre Besucher erfasst.</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="action-buttons">
                <button onClick={closeGuestModal} className="btn btn-secondary">
                  Abbrechen
                </button>
                <button
                  onClick={executeGuestCheckin}
                  disabled={guestLoading || !guestData.gast_vorname.trim() || !guestData.gast_nachname.trim()}
                  className="btn btn-success"
                >
                  {guestLoading ? 'Lädt...' : 'Gast einchecken'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.member && (
        <div 
          className="checkin-context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            zIndex: 10000
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-header">
            <User size={18} />
            <span>{contextMenu.member.vorname || ''} {contextMenu.member.nachname || ''}</span>
          </div>
          
          <div className="context-menu-section">
            <div className="context-menu-title">
              <Clock size={16} />
              <span>Check-in Daten</span>
            </div>
            <div className="context-menu-content">
              {(() => {
                const checkinTime = contextMenu.member.primaryCheckin?.checkin_time || 
                                   contextMenu.member.checkins?.[0]?.checkin_time ||
                                   contextMenu.member.checkin_time;
                
                if (checkinTime) {
                  return (
                    <>
                      <div className="context-menu-item">
                        <span className="context-menu-label">Eingecheckt um:</span>
                        <span className="context-menu-value">
                          {new Date(checkinTime).toLocaleString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {contextMenu.member.minutes_since_checkin != null && (
                        <div className="context-menu-item">
                          <span className="context-menu-label">Vor:</span>
                          <span className="context-menu-value">
                            {contextMenu.member.minutes_since_checkin} Minuten
                          </span>
                        </div>
                      )}
                    </>
                  );
                } else {
                  return (
                    <div className="context-menu-item">
                      <span className="context-menu-label">Keine Check-in-Zeit verfügbar</span>
                    </div>
                  );
                }
              })()}
            </div>
          </div>

          <div className="context-menu-section">
            <div className="context-menu-title">
              <Calendar size={16} />
              <span>Kurse</span>
            </div>
            <div className="context-menu-content">
              {(() => {
                const kurse = contextMenu.member.kurse || [];
                if (kurse.length > 0) {
                  return kurse.map((kurs, index) => {
                    const kursName = kurs.kurs_name || 
                                   (kurs.kurs && kurs.kurs.gruppenname) ||
                                   'Kurs';
                    return (
                      <div key={index} className="context-menu-item">
                        <span className="context-menu-label">{kursName}</span>
                      </div>
                    );
                  });
                } else {
                  return (
                    <div className="context-menu-item">
                      <span className="context-menu-label">Keine Kurse gefunden</span>
                    </div>
                  );
                }
              })()}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="context-menu-actions">
            <button
              className="context-menu-action-btn"
              onClick={() => {
                if (contextMenu.member?.mitglied_id) {
                  navigate(`/dashboard/mitglieder/${contextMenu.member.mitglied_id}`);
                  closeContextMenu();
                }
              }}
            >
              <FileText size={16} />
              <span>Mitglied-Details öffnen</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckinSystem;