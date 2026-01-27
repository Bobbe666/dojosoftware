import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from 'axios';
import config from '../config/config.js';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SkeletonProfile, LoadingSpinner, LoadingButton } from "./ui/Skeleton";
import MitgliedFortschritt from './MitgliedFortschritt';
import PruefungsStatus from './PruefungsStatus';
import Kuendigungshinweis from './Kuendigungshinweis';
import VertragFormular from './VertragFormular';
import ZehnerkartenVerwaltung from './ZehnerkartenVerwaltung';
import { useDojoContext } from '../context/DojoContext.jsx'; // 🏢 TAX COMPLIANCE
import { useAuth } from '../context/AuthContext.jsx'; // For member ID
import ReferralCodeVerwaltung from './ReferralCodeVerwaltung';
import { createSafeHtml } from '../utils/sanitizer';
import '../styles/Buttons.css';
// import "../styles/DojoEdit.css";
import "../styles/MitgliedDetail.css";

// Extrahierte Tab-Komponenten
import { MemberSecurityTab, MemberAdditionalDataTab, MemberMedicalTab, MemberFamilyTab, MemberStatisticsTab } from './mitglied-detail';

// Hilfsfunktion: Wandelt einen ISO-Datumsstring in "yyyy-MM-dd" um.
function toMySqlDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 🔧 Neue Hilfsfunktion: ISO-String zu Input-Format
function toInputDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toISOString().split('T')[0]; // "2026-03-15"
}

// Übersetze billing_cycle ins Deutsche
function translateBillingCycle(cycle) {
  if (!cycle) return '';
  const cycleMap = {
    'monthly': 'Monatlich',
    'monatlich': 'Monatlich',
    'quarterly': 'Vierteljährlich',
    'vierteljaehrlich': 'Vierteljährlich',
    'semi-annually': 'Halbjährlich',
    'halbjaehrlich': 'Halbjährlich',
    'annually': 'Jährlich',
    'jaehrlich': 'Jährlich',
    'yearly': 'Jährlich'
  };
  return cycleMap[cycle.toLowerCase()] || cycle;
}

// Mapping dojo_id zu Dojo-Namen - wird in der Komponente definiert

// Custom Dropdown Component with full dark mode styling
function CustomSelect({ value, onChange, options, className = "", style = {}, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const dropdownRef = React.useRef(null);

  useEffect(() => {
    const selected = options.find(opt => opt.value === value);
    setSelectedLabel(selected ? selected.label : '');
  }, [value, options]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue) => {
    onChange({ target: { value: optionValue } });
    setIsOpen(false);
  };

  return (
    <div
      className={`custom-select ${className} ${disabled ? 'disabled' : ''}`}
      ref={dropdownRef}
      style={style}
    >
      <div
        className="custom-select-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span>{selectedLabel || 'Bitte wählen...'}</span>
        <span className="custom-select-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && !disabled && (
        <div className="custom-select-options mitglied-detail-dropdown">
          {options.map((option) => (
            <div
              key={option.value}
              className={`custom-select-option mitglied-detail-dropdown-option ${option.value === value ? 'selected' : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * BeltPreview - Zeigt eine visuelle Darstellung eines Gürtels an
 * @param {string} primaer - Hauptfarbe des Gürtels (HEX)
 * @param {string|null} sekundaer - Optionale Sekundärfarbe für Streifen (HEX) 
 * @param {string} size - Größe: 'small', 'normal', 'large'
 * @param {string} className - Zusätzliche CSS-Klasse
 */
const BeltPreview = ({ primaer, sekundaer, size = 'normal', className = '' }) => {
  // Bestimme CSS-Klasse basierend auf Größe
  const sizeClass = {
    'small': 'belt-preview-small',
    'normal': 'belt-preview',
    'large': 'belt-preview-large'
  }[size] || 'belt-preview';
  
  return (
    <div className={`${sizeClass} ${className}`}>
      {/* Basis-Gürtel mit Primärfarbe */}
      <div 
        className="belt-base" 
        style={{ backgroundColor: primaer || '#CCCCCC' }}
      >
        {/* Sekundärer Streifen wenn vorhanden */}
        {sekundaer && (
          <div 
            className="belt-stripe" 
            style={{ backgroundColor: sekundaer }}
          />
        )}
      </div>
    </div>
  );
};

/**
 * Shared component for member details - used by both Admin and Member views
 * @param {boolean} isAdmin - true if accessed by admin, false if accessed by member
 * @param {string} memberIdProp - optional: member ID to display (used for admin view)
 */
const MitgliedDetailShared = ({ isAdmin = false, memberIdProp = null }) => {
  const { id: urlId } = useParams();
  const navigate = useNavigate();
  const { activeDojo, dojos } = useDojoContext(); // 🏢 TAX COMPLIANCE
  const { user, token } = useAuth(); // Get logged-in user for member view

  // Helper function to get dojo name by ID
  const getDojoName = (dojoId) => {
    if (!dojoId) return 'Kein Dojo';
    const dojo = dojos.find(d => d.id === parseInt(dojoId));
    return dojo ? dojo.dojoname : `Dojo ${dojoId}`;
  };

  // State for dynamically resolved member ID
  const [resolvedMemberId, setResolvedMemberId] = useState(null);

  // Determine which ID to use: URL param (admin) or dynamically loaded (member)
  const id = isAdmin ? (memberIdProp || urlId) : resolvedMemberId;

  // 🚀 React Query für gecachte Daten
  const queryClient = useQueryClient();
  
  // Mitglied-Daten mit React Query (15 Min Cache)
  const { 
    data: mitgliedQuery, 
    isLoading: mitgliedLoading, 
    error: mitgliedError,
    refetch: refetchMitglied 
  } = useQuery({
    queryKey: ['mitglied', id],
    queryFn: async () => {
      const res = await axios.get(`/mitglieddetail/${id}`);
      return res.data;
    },
    enabled: !!id,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Tarife mit React Query (30 Min Cache)
  const { data: tarifeQuery } = useQuery({
    queryKey: ['tarife'],
    queryFn: async () => {
      const res = await axios.get('/tarife');
      return res.data?.data || res.data || [];
    },
    staleTime: 30 * 60 * 1000,
  });

  // Zahlungszyklen mit React Query (60 Min Cache)
  const { data: zahlungszyklenQuery } = useQuery({
    queryKey: ['zahlungszyklen'],
    queryFn: async () => {
      const res = await axios.get('/zahlungszyklen');
      return res.data?.data || res.data || [];
    },
    staleTime: 60 * 60 * 1000,
  });

  // Stile mit React Query (60 Min Cache)
  const { data: stileQuery } = useQuery({
    queryKey: ['stile'],
    queryFn: async () => {
      const res = await axios.get('/stile');
      return res.data || [];
    },
    staleTime: 60 * 60 * 1000,
  });

  const [mitglied, setMitglied] = useState(null);
  const [updatedData, setUpdatedData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [avatarLoaded, setAvatarLoaded] = useState(false);
  const [buddyGroups, setBuddyGroups] = useState([]);
  const [buddyGroupsLoading, setBuddyGroupsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState("allgemein");
  const [styleSubTab, setStyleSubTab] = useState("stile");
  const [activeStyleTab, setActiveStyleTab] = useState(0);
  const [activeExamTab, setActiveExamTab] = useState(0);
  const [financeSubTab, setFinanceSubTab] = useState("finanzübersicht");
  const [graduationListCollapsed, setGraduationListCollapsed] = useState(true); // Graduierungen-Liste standardmäßig eingeklappt
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // Beiträge Ansichts-Filter State
  const [beitraegeViewMode, setBeiträgeViewMode] = useState("monat"); // "monat", "quartal", "jahr"
  const [collapsedPeriods, setCollapsedPeriods] = useState({});
  const [expandedBeitraege, setExpandedBeitraege] = useState({});

  // SEPA-Mandate State
  const [sepaMandate, setSepaMandate] = useState(null);
  const [generatingMandate, setGeneratingMandate] = useState(false);
  const [archivierteMandate, setArchivierteMandate] = useState([]);
  
  // Allergie-Management State
  const [allergien, setAllergien] = useState([]);
  const [allergienArchiv, setAllergienArchiv] = useState([]);
  const [newAllergie, setNewAllergie] = useState({ type: '', custom: '' });
  
  // Neue State-Variablen für stilspezifische Daten
  const [styleSpecificData, setStyleSpecificData] = useState({});
  const [trainingAnalysis, setTrainingAnalysis] = useState({});
  const [autoSaving, setAutoSaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);

  // Neue State-Variablen für erweiterte Daten
  const [anwesenheitsDaten, setAnwesenheitsDaten] = useState([]);
  const [finanzDaten, setFinanzDaten] = useState([]);
  const [statistikDaten, setStatistikDaten] = useState({});
  const [verträge, setVerträge] = useState([]);

  // Nachrichten State
  const [memberNotifications, setMemberNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  // News State (für News-Artikel vom Haupt-Admin)
  const [newsArticles, setNewsArticles] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [expandedNews, setExpandedNews] = useState(null);
  
  const [showNewVertrag, setShowNewVertrag] = useState(false);
  const [editingVertrag, setEditingVertrag] = useState(null);
  const [showVertragDetails, setShowVertragDetails] = useState(false);
  const [showStructuredDetails, setShowStructuredDetails] = useState(false);
  const [selectedVertrag, setSelectedVertrag] = useState(null);

  // Drei-Punkte-Menü State
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveReason, setArchiveReason] = useState('');
  const [newVertrag, setNewVertrag] = useState(() => {
    const heute = new Date();
    const in12Monaten = new Date(heute);
    in12Monaten.setMonth(heute.getMonth() + 12);

    return {
      tarif_id: '',
      status: 'aktiv',
      // Frontend-only Felder für Berechnung und Anzeige
      billing_cycle: '',
      payment_method: 'direct_debit',
      vertragsbeginn: heute.toISOString().split('T')[0],
      vertragsende: in12Monaten.toISOString().split('T')[0],
      // Vertragsbedingungen
      kuendigungsfrist_monate: 3,
      mindestlaufzeit_monate: 12,
      automatische_verlaengerung: true,
      verlaengerung_monate: 12,
      faelligkeit_tag: 1,
      sepa_mandat_id: null,
      // Rechtliche Akzeptanzen
      agb_akzeptiert: false,
      agb_version: '1.0',
      datenschutz_akzeptiert: false,
      datenschutz_version: '1.0',
      hausordnung_akzeptiert: false,
      haftungsausschluss_akzeptiert: false,
      gesundheitserklaerung: false,
      foto_einverstaendnis: false
    };
  });
  const [showRuhepauseModal, setShowRuhepauseModal] = useState(false);
  const [showKündigungModal, setShowKündigungModal] = useState(false);
  const [showKündigungBestätigungModal, setShowKündigungBestätigungModal] = useState(false);
  const [vertragZumKündigen, setVertragZumKündigen] = useState(null);
  
  // Foto-Upload State
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  
  // Stil & Gurt Verwaltung
  const [stile, setStile] = useState([]);
  const [memberStile, setMemberStile] = useState([]); // Alle Stile des Mitglieds
  const [selectedStilId, setSelectedStilId] = useState('');
  const [selectedStil, setSelectedStil] = useState(null);
  const [currentGraduation, setCurrentGraduation] = useState(null);
  const [lastExamDate, setLastExamDate] = useState('');
  const [selectedVertragForAction, setSelectedVertragForAction] = useState(null);
  const [ruhepauseDauer, setRuhepauseDauer] = useState(1);
  const [kuendigungsgrund, setKündigungsgrund] = useState('');
  const [kuendigungsbestätigung, setKündigungsbestätigung] = useState(false);
  const [kuendigungsdatum, setKündigungsdatum] = useState('');

  // Tarif und Zahlungszyklen für Verträge
  const [tarife, setTarife] = useState([]);
  const [zahlungszyklen, setZahlungszyklen] = useState([]);
  const [beitraege, setBeiträge] = useState([]);
  // 🔄 Sync React Query data to local state (für Kompatibilität)
  useEffect(() => {
    if (mitgliedQuery) {
      setMitglied(mitgliedQuery);
      setUpdatedData(mitgliedQuery);
      setLoading(false);
    }
    if (mitgliedError) {
      setError('Fehler beim Abrufen der Mitgliedsdaten.');
      setLoading(false);
    }
  }, [mitgliedQuery, mitgliedError]);

  useEffect(() => {
    if (tarifeQuery) {
      setTarife(Array.isArray(tarifeQuery) ? tarifeQuery : []);
    }
  }, [tarifeQuery]);

  useEffect(() => {
    if (zahlungszyklenQuery) {
      setZahlungszyklen(Array.isArray(zahlungszyklenQuery) ? zahlungszyklenQuery : []);
    }
  }, [zahlungszyklenQuery]);

  useEffect(() => {
    if (stileQuery) {
      setStile(Array.isArray(stileQuery) ? stileQuery : []);
    }
  }, [stileQuery]);

  // Sicherheit-Tab State (muss vor frühen Returns deklariert werden)
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(true);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [securityQuestion, setSecurityQuestion] = useState('Wie lautet der Mädchen- oder Jungenname Ihrer Mutter?');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [securityMessage, setSecurityMessage] = useState(null);

  // Vorlagen für Dokument-Generierung
  const [verfügbareVorlagen, setVerfügbareVorlagen] = useState([]);
  const [generatingDocument, setGeneratingDocument] = useState(false);
  const [mitgliedDokumente, setMitgliedDokumente] = useState([]);
  const [confirmedNotifications, setConfirmedNotifications] = useState([]);
  const [rechnungen, setRechnungen] = useState([]);

  // Modal für SEPA-Mandat-Details
  const [selectedMandate, setSelectedMandate] = useState(null);
  const [showMandateModal, setShowMandateModal] = useState(false);

  // Abgeleitete Zähler für Status-Badges (schmal oben in Sidebar)
  const offeneDokumente = Number(mitglied?.dokumente_offen) || 0;
  const offeneNachrichten = Number(mitglied?.nachrichten_offen) || 0;
  const offeneBeiträge = Array.isArray(finanzDaten)
    ? finanzDaten.filter((f) => {
        const status = (f.status || '').toString().toLowerCase();
        const bezahlt = f.bezahlt === 0 || f.bezahlt === false;
        return status === 'offen' || status === 'überfällig' || status === 'überfällig' || bezahlt;
      }).length
    : 0;

  const fetchMitgliedDetail = async (signal = null) => {
    setLoading(true);
    try {
      const res = await axios.get(`/mitglieddetail/${id}`, signal ? { signal } : {});
      setMitglied(res.data);
      setUpdatedData(res.data);
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return; // Request was cancelled, don't show error
      }
      console.error('🔍 Fetch-Error:', err); // DEBUG
      setError("Fehler beim Abrufen der Mitgliedsdaten.");
    } finally {
      setLoading(false);
    }
  };

  // Anwesenheitsdaten laden (STIL-SPEZIFISCH)
  const fetchAnwesenheitsDaten = async (stilName = null, signal = null) => {
    try {
      // 🔧 FIX: Verwende /anwesenheit/:mitglied_id statt Query-Parameter
      // Backend GET "/" Route ignoriert Query-Parameter und gibt ALLE Anwesenheitsdaten zurück!
      const config = {};
      if (stilName) {
        config.params = { stil_id: stilName }; // Optional: Filter nach Stil
      }
      if (signal) config.signal = signal;

      const res = await axios.get(`/anwesenheit/${id}`, config);
      setAnwesenheitsDaten(res.data);
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return; // Request was cancelled, don't show error
      }
      // 404 ist ok - bedeutet keine Anwesenheitsdaten vorhanden
      if (err.response?.status === 404) {
        setAnwesenheitsDaten([]);
        return;
      }
      console.error('Fehler beim Laden der Anwesenheitsdaten:', err);
    }
  };

  // Finanzdaten laden
  const fetchFinanzDaten = async (signal = null) => {
    try {
      const config = { params: { mitglied_id: id } };
      if (signal) config.signal = signal;
      const res = await axios.get('/beitraege', config);
      setFinanzDaten(res.data);
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return; // Request was cancelled, don't show error
      }
      console.error('❌ Fehler beim Laden der Finanzdaten:', err);
      console.error('🔍 Error Details:', err.response || err);
    }
  };

  // Tarife und Zahlungszyklen laden
  const fetchTarifeUndZahlungszyklen = async (signal = null) => {
    try {
      // Alle benötigten APIs laden
      const config = signal ? { signal } : {};
      // Beiträge-Endpoint benötigt mitglied_id, daher weglassen wenn id nicht verfügbar
      const [tarifeResponse, zahlungszyklenResponse] = await Promise.all([
        axios.get('/tarife', config).catch(() => null),
        axios.get('/zahlungszyklen', config).catch(() => null)
      ]);

      if (tarifeResponse?.data) {
        const tarifeData = tarifeResponse.data;
        if (tarifeData.success) {
          setTarife(tarifeData.data || []);
        }
      }

      if (zahlungszyklenResponse?.data) {
        const zahlungszyklenData = zahlungszyklenResponse.data;
        setZahlungszyklen(zahlungszyklenData.data || []);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return; // Request was cancelled, don't show error
      }
      console.error('Fehler beim Laden der Tarife und Zahlungszyklen:', error);
    }
  };

  // Statistiken berechnen
  const berechneStatistiken = () => {
    if (!anwesenheitsDaten.length) {
      return;
    }

    const totalAnwesenheiten = anwesenheitsDaten.filter(a => a.anwesend).length;
    const totalMöglicheAnwesenheiten = anwesenheitsDaten.length;
    const anwesenheitsquote = totalMöglicheAnwesenheiten > 0 ?
      (totalAnwesenheiten / totalMöglicheAnwesenheiten * 100).toFixed(1) : 0;

    // Berechne monatliche Statistiken für die letzten 12 Monate
    const now = new Date();
    const monthlyStats = [];
    
    for (let i = 0; i < 12; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = monthDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
      const shortMonthName = monthDate.toLocaleDateString('de-DE', { month: 'long' });
      
      const monthlyAttendances = anwesenheitsDaten.filter(a => {
        const attendanceDate = new Date(a.datum);
        return attendanceDate.getMonth() === monthDate.getMonth() && 
               attendanceDate.getFullYear() === monthDate.getFullYear() &&
               a.anwesend;
      });
      
      if (monthlyAttendances.length > 0) { // Zeige nur Monate mit tatsächlichen Anwesenheiten
        monthlyStats.push({
          month: shortMonthName,
          fullMonth: monthName,
          count: monthlyAttendances.length,
          year: monthDate.getFullYear()
        });
      }
    }

    // Berechne weitere Statistiken
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const thisMonthAttendances = anwesenheitsDaten.filter(a => {
      const attendanceDate = new Date(a.datum);
      return attendanceDate.getMonth() === currentMonth && 
             attendanceDate.getFullYear() === currentYear && 
             a.anwesend;
    }).length;

    // Durchschnittliche Trainings pro Monat (letzten 6 Monate)
    const lastSixMonths = monthlyStats.slice(0, 6);
    const avgPerMonth = lastSixMonths.length > 0 ? 
      (lastSixMonths.reduce((sum, month) => sum + month.count, 0) / lastSixMonths.length).toFixed(1) : 0;

    // Weitere Statistiken
    const lastWeekAttendances = anwesenheitsDaten.filter(a => {
      const attendanceDate = new Date(a.datum);
      const oneWeekAgo = new Date(now);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      return attendanceDate >= oneWeekAgo && a.anwesend;
    }).length;

    // Beste und schlechteste Monate
    const attendanceMonths = monthlyStats.filter(m => m.count > 0);
    const bestMonth = attendanceMonths.length > 0 ? 
      attendanceMonths.reduce((max, month) => month.count > max.count ? month : max) : null;
    
    // Konsistenz (aufeinanderfolgende Monate mit Training)
    let consecutiveMonths = 0;
    for (const month of monthlyStats) {
      if (month.count > 0) {
        consecutiveMonths++;
      } else {
        break;
      }
    }

    // Trainingsstreak (Tage)
    let currentStreak = 0;
    const sortedDates = anwesenheitsDaten
      .filter(a => a.anwesend)
      .sort((a, b) => new Date(b.datum) - new Date(a.datum));
    
    if (sortedDates.length > 0) {
      const lastTraining = new Date(sortedDates[0].datum);
      const daysSinceLastTraining = Math.floor((now - lastTraining) / (1000 * 60 * 60 * 24));
      
      if (daysSinceLastTraining <= 14) { // Maximal 2 Wochen Pause
        currentStreak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
          const currentDate = new Date(sortedDates[i].datum);
          const prevDate = new Date(sortedDates[i-1].datum);
          const daysDiff = Math.floor((prevDate - currentDate) / (1000 * 60 * 60 * 24));
          
          if (daysDiff <= 14) { // Maximal 2 Wochen zwischen Trainings
            currentStreak++;
          } else {
            break;
          }
        }
      }
    }
    
    // Wochentagsverteilung berechnen
    const weekdayStats = [
      { day: 'Montag', dayShort: 'Mo', count: 0 },
      { day: 'Dienstag', dayShort: 'Di', count: 0 },
      { day: 'Mittwoch', dayShort: 'Mi', count: 0 },
      { day: 'Donnerstag', dayShort: 'Do', count: 0 },
      { day: 'Freitag', dayShort: 'Fr', count: 0 },
      { day: 'Samstag', dayShort: 'Sa', count: 0 },
      { day: 'Sonntag', dayShort: 'So', count: 0 }
    ];

    anwesenheitsDaten.filter(a => a.anwesend).forEach(a => {
      const date = new Date(a.datum);
      const dayIndex = (date.getDay() + 6) % 7; // Montag = 0, Sonntag = 6
      weekdayStats[dayIndex].count++;
    });

    const bestWeekday = weekdayStats.reduce((max, day) => day.count > max.count ? day : max);
    const worstWeekday = weekdayStats.filter(d => d.count > 0).reduce((min, day) => day.count < min.count ? day : min, weekdayStats[0]);

    // Jahresvergleich berechnen
    const years = [...new Set(anwesenheitsDaten.map(a => new Date(a.datum).getFullYear()))];
    const yearlyStats = years.map(year => {
      const yearAttendances = anwesenheitsDaten.filter(a => {
        return new Date(a.datum).getFullYear() === year && a.anwesend;
      }).length;
      return { year, count: yearAttendances };
    }).sort((a, b) => a.year - b.year);

    // Längste Pause berechnen
    const sortedAttendances = anwesenheitsDaten
      .filter(a => a.anwesend)
      .sort((a, b) => new Date(a.datum) - new Date(b.datum));

    let longestPause = 0;
    for (let i = 1; i < sortedAttendances.length; i++) {
      const prev = new Date(sortedAttendances[i - 1].datum);
      const curr = new Date(sortedAttendances[i].datum);
      const pauseDays = Math.floor((curr - prev) / (1000 * 60 * 60 * 24));
      if (pauseDays > longestPause) longestPause = pauseDays;
    }

    // Durchschnittliche Trainings pro Woche
    const firstTraining = sortedAttendances.length > 0 ? new Date(sortedAttendances[0].datum) : null;
    const totalWeeks = firstTraining ? Math.ceil((now - firstTraining) / (1000 * 60 * 60 * 24 * 7)) : 0;
    const avgPerWeek = totalWeeks > 0 ? (totalAnwesenheiten / totalWeeks).toFixed(1) : 0;

    // Bester Streak berechnen
    let bestStreak = 0;
    let tempStreak = 0;
    const allSortedDates = anwesenheitsDaten
      .filter(a => a.anwesend)
      .sort((a, b) => new Date(b.datum) - new Date(a.datum));

    for (let i = 0; i < allSortedDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const currentDate = new Date(allSortedDates[i].datum);
        const prevDate = new Date(allSortedDates[i-1].datum);
        const daysDiff = Math.floor((prevDate - currentDate) / (1000 * 60 * 60 * 24));

        if (daysDiff <= 14) {
          tempStreak++;
        } else {
          if (tempStreak > bestStreak) bestStreak = tempStreak;
          tempStreak = 1;
        }
      }
    }
    if (tempStreak > bestStreak) bestStreak = tempStreak;

    setStatistikDaten({
      totalAnwesenheiten,
      totalMöglicheAnwesenheiten,
      anwesenheitsquote,
      letzteAnwesenheit: anwesenheitsDaten.length > 0 ?
        anwesenheitsDaten.sort((a, b) => new Date(b.datum) - new Date(a.datum))[0]?.datum : null,
      monthlyStats,
      thisMonthAttendances,
      avgPerMonth,
      lastWeekAttendances,
      bestMonth,
      consecutiveMonths,
      currentStreak,
      weekdayStats,
      bestWeekday,
      worstWeekday,
      yearlyStats,
      longestPause,
      avgPerWeek,
      bestStreak
    });
  };

  // Vertragsfunktionen
  const fetchVerträge = async (signal = null) => {
    if (!mitglied || !mitglied.mitglied_id) return;

    try {
      const config = { params: { mitglied_id: mitglied?.mitglied_id } };
      if (signal) config.signal = signal;
      const response = await axios.get('/vertraege', config);
      const data = response.data;

      if (data.success && data.data) {

        // Erst filtern und nach ID sortieren für die Nummerierung
        const filteredData = data.data
          .filter(vertrag => {
            return vertrag.mitglied_id === mitglied?.mitglied_id;
          })
          .sort((a, b) => a.id - b.id) // Chronologisch sortieren für Nummerierung
          .map((vertrag, index) => ({
            ...vertrag,
            personenVertragNr: index + 1 // Personenbezogene Nummer basierend auf Erstellungsreihenfolge
          }));

        // Dann nach Status sortieren für die Anzeige
        const verträgeData = filteredData.sort((a, b) => {
          // Gekündigte Verträge nach hinten
          if (a.kuendigung_eingegangen && !b.kuendigung_eingegangen) return 1;
          if (!a.kuendigung_eingegangen && b.kuendigung_eingegangen) return -1;
          // Innerhalb gleicher Status nach ID
          return a.id - b.id;
        });
        setVerträge(verträgeData);
      } else {
        console.log('⚠️ Backend lieferte keine Daten oder Fehler:', data);
        setVerträge([]);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return; // Request was cancelled, don't show error
      }
      console.error('Fehler beim Laden der Verträge:', error);
      setVerträge([]);
    }
  };

  const fetchStile = async (signal = null) => {
    try {
      const response = await axios.get('/stile', signal ? { signal } : {});
      const data = response.data;
      setStile(data);
      console.log('✅ Stile geladen:', data);
      console.log('🔍 Erste Stil-Graduierungen:', data[0]?.graduierungen);
      console.log('🔍 Anzahl Graduierungen im ersten Stil:', data[0]?.graduierungen?.length);
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return; // Request was cancelled, don't show error
      }
      console.error('❌ Fehler beim Laden der Stile:', error);
    }
  };

  const saveMemberStyles = async (styleIds) => {
    try {
      const response = await axios.post(`/mitglieder/${id}/stile`, { stile: styleIds });
      console.log('✅ Stile erfolgreich gespeichert:', response.data);
    } catch (error) {
      console.error('❌ Fehler beim Speichern der Stile:', error);
    }
  };

  // 🥋 Stilspezifische Daten laden
  const loadStyleSpecificData = async (stilId) => {
    try {
      const response = await axios.get(`/mitglieder/${id}/stil/${stilId}/data`);
      const result = response.data;
      setStyleSpecificData(prev => ({
        ...prev,
        [stilId]: result.data
      }));
    } catch (error) {
      console.error(`❌ Fehler beim Laden stilspezifischer Daten für Stil ${stilId}:`, error.message);
    }
  };

  // 🥋 Stilspezifische Daten speichern (Auto-Save)
  const saveStyleSpecificData = async (stilId, data) => {
    if (autoSaving) return; // Verhindere mehrfache gleichzeitige Speicherungen

    setAutoSaving(true);
    try {
      const response = await axios.post(`/mitglieder/${id}/stil/${stilId}/data`, data);
      console.log(`✅ Stilspezifische Daten für Stil ${stilId} gespeichert:`, response.data);
    } catch (error) {
      console.error(`❌ Fehler beim Speichern stilspezifischer Daten für Stil ${stilId}:`, error.message);
      setError('Fehler beim Speichern der stilspezifischen Daten');
    } finally {
      setAutoSaving(false);
    }
  };

  // 📊 Trainingsstunden-Analyse laden
  const loadTrainingAnalysis = async (stilId) => {
    try {
      const response = await axios.get(`/mitglieder/${id}/stil/${stilId}/training-analysis`);
      const result = response.data;
      setTrainingAnalysis(prev => ({
        ...prev,
        [stilId]: result.analysis
      }));
    } catch (error) {
      console.error(`❌ Fehler beim Laden der Trainingsstunden-Analyse für Stil ${stilId}:`, error.message);
    }
  };

  const loadMemberStyles = async (signal = null) => {
    try {
      const response = await axios.get(`/mitglieder/${id}/stile`, signal ? { signal } : {});
      const result = response.data;
      if (result.success && result.stile) {
        setMemberStile(result.stile);
        console.log('✅ Mitglied-Stile geladen:', result.stile);

        // Lade stilspezifische Daten und Trainingsstunden-Analyse für jeden Stil
        result.stile.forEach(async (stil) => {
          await loadStyleSpecificData(stil.stil_id);
          await loadTrainingAnalysis(stil.stil_id);
        });

        // Ersten Stil automatisch auswählen wenn keiner ausgewählt ist
        if (result.stile.length > 0 && !selectedStilId) {
          const firstStyle = result.stile[0];
          setSelectedStilId(firstStyle.stil_id.toString());

          // Finde vollständige Stil-Daten aus der stile-Liste
          const fullStyleData = stile.find(s => s.stil_id === firstStyle.stil_id);
          if (fullStyleData) {
            setSelectedStil(fullStyleData);

            // Setze aktuelle Graduierung wenn vorhanden
            if (fullStyleData.graduierungen && fullStyleData.graduierungen.length > 0) {
              setCurrentGraduation(fullStyleData.graduierungen[0]);
            }
          }
        }
      } else {
        setMemberStile([]);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return; // Request was cancelled, don't show error
      }
      console.error('❌ Fehler beim Laden der Mitglied-Stile:', error);
      setMemberStile([]);
    }
  };

  const handleStyleChange = (newStilId) => {
    setSelectedStilId(newStilId);
    const selectedStilData = stile.find(s => s.stil_id === parseInt(newStilId));
    setSelectedStil(selectedStilData);
    setCurrentGraduation(null); // Reset graduation when style changes
    
    // Set first graduation if available
    if (selectedStilData && selectedStilData.graduierungen && selectedStilData.graduierungen.length > 0) {
      setCurrentGraduation(selectedStilData.graduierungen[0]);
    }
  };

  const handleAddStyle = async () => {
    if (!selectedStilId || memberStile.find(s => s.stil_id === parseInt(selectedStilId))) {
      return; // Stil bereits vorhanden oder nicht ausgewählt
    }

    const newStyle = stile.find(s => s.stil_id === parseInt(selectedStilId));
    const updatedMemberStile = [...memberStile, newStyle];
    
    // Backend Update mit allen Stil-IDs
    await saveMemberStyles(updatedMemberStile.map(s => s.stil_id));
    
    // Nach dem Speichern die Stile neu laden
    await loadMemberStyles();
    
    // Setze den neuen Stil als aktiven Tab
    setActiveStyleTab(updatedMemberStile.length - 1);
    
    console.log('✅ Stil hinzugefügt:', newStyle.name);
  };

  // ⚙️ Handler für Graduierung-Änderungen (Auto-Save)
  const handleGraduationChange = async (stilId, graduierungId) => {
    const updatedData = {
      ...styleSpecificData[stilId],
      current_graduierung_id: graduierungId || null
    };
    
    setStyleSpecificData(prev => ({
      ...prev,
      [stilId]: updatedData
    }));

    // Auto-Save
    await saveStyleSpecificData(stilId, updatedData);
    
    // Lade Trainingsstunden-Analyse neu
    await loadTrainingAnalysis(stilId);
  };

  // ⚙️ Handler für Prüfungsdatum-Änderungen (Auto-Save)
  const handleExamDateChange = async (stilId, dateField, dateValue) => {
    const updatedData = {
      ...styleSpecificData[stilId],
      [dateField]: dateValue || null
    };
    
    setStyleSpecificData(prev => ({
      ...prev,
      [stilId]: updatedData
    }));

    // Auto-Save
    await saveStyleSpecificData(stilId, updatedData);
    
    // Wenn letzte Prüfung geändert wurde, lade Trainingsstunden-Analyse neu
    if (dateField === 'letzte_pruefung') {
      await loadTrainingAnalysis(stilId);
    }
  };

  // ⚙️ Handler für Anmerkungen-Änderungen (Auto-Save mit Delay)
  const handleExamNotesChange = (stilId, notesValue) => {
    const updatedData = {
      ...styleSpecificData[stilId],
      anmerkungen: notesValue || null
    };
    
    setStyleSpecificData(prev => ({
      ...prev,
      [stilId]: updatedData
    }));

    // Auto-Save mit 1 Sekunde Delay (Debounce)
    clearTimeout(window.notesTimeout);
    window.notesTimeout = setTimeout(async () => {
      await saveStyleSpecificData(stilId, updatedData);
    }, 1000);
  };

  // 🏦 SEPA-Mandat-Funktionen
  const loadSepaMandate = async (signal = null) => {
    try {
      const response = await axios.get(`/mitglieder/${id}/sepa-mandate`, signal ? { signal } : {});
      setSepaMandate(response.data);
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return; // Request was cancelled, don't show error
      }
      if (error.response?.status !== 404) {
        console.error('Fehler beim Laden des SEPA-Mandats:', error);
      }
    }
  };

  const generateSepaMandate = async () => {
    if (!mitglied?.iban || !mitglied?.bic) {
      alert('Bitte vervollständigen Sie zuerst die Bankdaten (IBAN und BIC).');
      return;
    }

    setGeneratingMandate(true);
    try {
      const response = await axios.post(`/mitglieder/${id}/sepa-mandate`, {
        iban: mitglied?.iban,
        bic: mitglied?.bic,
        kontoinhaber: mitglied?.kontoinhaber || `${mitglied?.vorname} ${mitglied?.nachname}`,
        bankname: mitglied?.bankname
      });
      setSepaMandate(response.data);
      console.log('✅ SEPA-Mandat erfolgreich erstellt');
    } catch (error) {
      console.error('❌ Fehler beim Erstellen des SEPA-Mandats:', error);
    }
    setGeneratingMandate(false);
  };

  const downloadSepaMandate = async () => {
    try {
      const response = await axios.get(`/mitglieder/${id}/sepa-mandate/download`, { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SEPA-Mandat_${mitglied?.nachname}_${mitglied?.vorname}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Fehler beim Download des SEPA-Mandats:', error);
    }
  };

  const downloadVertragPDF = async (vertragId) => {
    try {
      console.log('📥 Lade vollständigen Vertrag herunter...');
      const response = await axios.get(`/vertraege/${vertragId}/pdf`, { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      
      // PDF im neuen Tab öffnen (Viewer)
      const pdfWindow = window.open('', '_blank');
      if (pdfWindow) {
        pdfWindow.location.href = url;
      }
      
      // PDF auch herunterladen
      const a = document.createElement('a');
      a.href = url;
      a.download = `Vertrag_${mitglied?.nachname}_${mitglied?.vorname}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // URL nicht sofort freigeben, damit der Tab funktioniert
      // Wird automatisch freigegeben wenn der Tab geschlossen wird
      
      console.log('✅ Vertrag erfolgreich heruntergeladen und angezeigt');
    } catch (error) {
      console.error('❌ Fehler beim Download des Vertrags:', error);
      alert('Fehler beim Download des Vertrags. Bitte versuchen Sie es erneut.');
    }
  };

  const revokeSepaMandate = async () => {
    if (confirm('Möchten Sie das SEPA-Mandat wirklich widerrufen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      try {
        await axios.delete(`/mitglieder/${id}/sepa-mandate`);
        setSepaMandate(null);
        loadArchivierteMandate(); // Archivierte Mandate neu laden
        console.log('✅ SEPA-Mandat wurde archiviert');
      } catch (error) {
        console.error('❌ Fehler beim Widerrufen des SEPA-Mandats:', error);
      }
    }
  };

  const loadArchivierteMandate = async (signal = null) => {
    try {
      const response = await axios.get(`/mitglieder/${id}/sepa-mandate/archiv`, signal ? { signal } : {});
      setArchivierteMandate(response.data);
      console.log('✅ Archivierte Mandate geladen:', response.data);
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return; // Request was cancelled, don't show error
      }
      console.error('❌ Fehler beim Laden archivierter Mandate:', error);
    }
  };

  const loadMemberNotifications = async (signal = null) => {
    if (!mitglied?.email) return;

    setNotificationsLoading(true);
    try {
      const response = await axios.get(`/notifications/history`, {
        params: {
          recipient: mitglied.email,
          limit: 100
        },
        signal: signal || undefined
      });

      if (response.data.success) {
        setMemberNotifications(response.data.notifications || []);
        console.log('✅ Mitglieder-Benachrichtigungen geladen:', response.data.notifications?.length);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return; // Request was cancelled, don't show error
      }
      console.error('❌ Fehler beim Laden der Benachrichtigungen:', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  // News-Artikel laden (vom Haupt-Admin)
  const loadNewsArticles = async (signal = null) => {
    setNewsLoading(true);
    try {
      const response = await axios.get(`/news/public`, {
        signal: signal || undefined
      });

      if (response.data.news) {
        setNewsArticles(response.data.news || []);
        console.log('✅ News-Artikel geladen:', response.data.news?.length);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return;
      }
      console.error('❌ Fehler beim Laden der News:', error);
    } finally {
      setNewsLoading(false);
    }
  };

  const downloadArchiviertesMandat = async (mandatId, vorname, nachname, erstellungsdatum) => {
    try {
      const response = await axios.get(`/mitglieder/${id}/sepa-mandate/download`, {
        params: { mandate_id: mandatId },
        responseType: 'blob'
      });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const datum = new Date(erstellungsdatum).toLocaleDateString('de-DE').replace(/\./g, '-');
      a.href = url;
      a.download = `SEPA-Mandat_${nachname}_${vorname}_${datum}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Fehler beim Download des archivierten SEPA-Mandats:', error);
    }
  };

  // Vorlage als PDF herunterladen
  const downloadTemplateAsPDF = async (vorlageId, vorlageName) => {
    try {
      const response = await axios.get(`/vertragsvorlagen/${vorlageId}/download`, {
        responseType: 'blob'
      });
      
      // Blob zu Download-Link erstellen
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${vorlageName.replace(/[^a-zA-Z0-9]/g, '_')}_Vorlage.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Fehler beim Download der Vorlage:', error);
      alert('❌ Fehler beim Download der Vorlage');
    }
  };

  // Dokument aus Vorlage generieren und speichern
  const generateDocumentFromTemplate = async (vorlageId, vorlageName, vertragId = null) => {
    try {
      setGeneratingDocument(true);

      // Dokument im Backend generieren und speichern
      const response = await axios.post(`/mitglieder/${id}/dokumente/generate`, {
        vorlage_id: vorlageId,
        vertrag_id: vertragId
      });

      if (response.data.success) {
        alert('? Dokument erfolgreich erstellt und gespeichert!');

        // Dokumente-Liste neu laden
        const dokResponse = await axios.get(`/mitglieder/${id}/dokumente`);
        setMitgliedDokumente(dokResponse.data.data || []);
      }
    } catch (error) {
      console.error('Fehler beim Generieren des Dokuments:', error);
      alert('❌ Fehler beim Generieren des Dokuments');
    } finally {
      setGeneratingDocument(false);
    }
  };

  // Gespeichertes Dokument herunterladen
  const downloadMitgliedDokument = async (dokumentId, dokumentname) => {
    try {
      const response = await axios.get(`/mitglieder/${id}/dokumente/${dokumentId}/download`, {
        responseType: 'blob'
      });

      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = dokumentname;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Fehler beim Download des Dokuments:', error);
      alert('❌ Fehler beim Download');
    }
  };

  // Dokument löschen (nur Admin)
  const deleteMitgliedDokument = async (dokument) => {
    // Prüfe Aufbewahrungsfrist (10 Jahre nach § 147 AO)
    const erstelltDate = new Date(dokument.erstellt_am);
    const erstelltJahr = erstelltDate.getFullYear();
    const ablaufJahr = erstelltJahr + 10;
    const ablaufDatum = new Date(ablaufJahr, 11, 31, 23, 59, 59); // 31.12. um 23:59:59
    const heute = new Date();

    if (heute <= ablaufDatum) {
      // Noch Aufbewahrungspflicht
      const ablaufText = `31.12.${ablaufJahr}`;
      alert(`⚠️ Dieses Dokument kann noch nicht gelöscht werden.\n\n` +
            `Grund: Gesetzliche Aufbewahrungspflicht nach § 147 AO\n` +
            `Aufbewahrungsfrist: 10 Jahre\n` +
            `Erstellt am: ${new Date(dokument.erstellt_am).toLocaleDateString('de-DE')}\n` +
            `Löschung möglich ab: ${ablaufText}\n\n` +
            `Das Dokument wird automatisch nach Ablauf der Frist gelöscht.`);
      return;
    }

    // Frist ist abgelaufen - Löschung möglich
    if (!confirm('Möchten Sie dieses Dokument wirklich löschen?')) {
      return;
    }

    try {
      await axios.delete(`/mitglieder/${id}/dokumente/${dokument.id}`);
      alert('✅ Dokument gelöscht');

      // Liste neu laden
      const response = await axios.get(`/mitglieder/${id}/dokumente`);
      setMitgliedDokumente(response.data.data || []);
    } catch (error) {
      console.error('Fehler beim Löschen des Dokuments:', error);
      alert('❌ Fehler beim Löschen: ' + (error.response?.data?.error || error.message));
    }
  };

  // Rechnungen laden
  const loadRechnungen = async (signal = null) => {
    try {
      const response = await axios.get(`/rechnungen`, {
        params: { mitglied_id: id },
        signal: signal || undefined
      });
      if (response.data.success) {
        setRechnungen(response.data.data || []);
      }
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return;
      }
      console.error('Fehler beim Laden der Rechnungen:', error);
    }
  };

  // Rechnung löschen
  const deleteRechnung = async (rechnung) => {
    // Prüfe Aufbewahrungsfrist (10 Jahre nach § 147 AO)
    const rechnungsDatum = new Date(rechnung.datum);
    const rechnungsJahr = rechnungsDatum.getFullYear();
    const ablaufJahr = rechnungsJahr + 10;
    const ablaufDatum = new Date(ablaufJahr, 11, 31, 23, 59, 59); // 31.12. um 23:59:59
    const heute = new Date();

    if (heute <= ablaufDatum) {
      // Noch Aufbewahrungspflicht
      const ablaufText = `31.12.${ablaufJahr}`;
      alert(`⚠️ Diese Rechnung kann noch nicht gelöscht werden.\n\n` +
            `Grund: Gesetzliche Aufbewahrungspflicht nach § 147 AO\n` +
            `Aufbewahrungsfrist: 10 Jahre\n` +
            `Rechnungsnummer: ${rechnung.rechnungsnummer}\n` +
            `Rechnungsdatum: ${new Date(rechnung.datum).toLocaleDateString('de-DE')}\n` +
            `Löschung möglich ab: ${ablaufText}\n\n` +
            `Die Rechnung wird automatisch nach Ablauf der Frist gelöscht.`);
      return;
    }

    // Frist ist abgelaufen - Löschung möglich
    if (!window.confirm('Möchten Sie diese Rechnung wirklich löschen?')) {
      return;
    }

    try {
      await axios.delete(`/rechnungen/${rechnung.rechnung_id}`);
      alert('✅ Rechnung gelöscht');
      // Liste neu laden
      await loadRechnungen();
    } catch (error) {
      console.error('Fehler beim Löschen der Rechnung:', error);
      alert('❌ Fehler beim Löschen der Rechnung');
    }
  };

  const handleRemoveStyle = async (stilId) => {
    const updatedMemberStile = memberStile.filter(s => s.stil_id !== stilId);
    
    // Backend Update mit verbleibenden Stil-IDs
    await saveMemberStyles(updatedMemberStile.map(s => s.stil_id));
    
    // Nach dem Speichern die Stile neu laden
    await loadMemberStyles();
    
    // Anpassen des activeStyleTab wenn nötig
    if (activeStyleTab >= updatedMemberStile.length && updatedMemberStile.length > 0) {
      setActiveStyleTab(updatedMemberStile.length - 1);
    } else if (updatedMemberStile.length === 0) {
      setActiveStyleTab(0);
    }
    
    console.log('? Stil entfernt');
  };

  const handleGraduationArrowChange = async (graduationId, direction) => {
    console.log('🔘 handleGraduationArrowChange aufgerufen:', { graduationId, direction });
    console.log('🔍 selectedStil:', selectedStil);
    console.log('🔍 selectedStil.graduierungen:', selectedStil?.graduierungen);
    console.log('🔍 Anzahl Graduierungen:', selectedStil?.graduierungen?.length);

    if (!selectedStil || !selectedStil.graduierungen) {
      console.error('❌ Kein Stil oder keine Graduierungen vorhanden');
      console.error('❌ selectedStil:', selectedStil);
      console.error('❌ selectedStil.graduierungen:', selectedStil?.graduierungen);
      return;
    }

    let newGraduation;

    // Prüfe ob direction eine Zahl ist (direkte Auswahl) oder ein String (up/down)
    if (typeof direction === 'number') {
      // Direkte Auswahl einer Graduierung per ID
      newGraduation = selectedStil.graduierungen.find(g => g.graduierung_id === direction);
      if (!newGraduation) {
        console.error('❌ Graduierung mit ID', direction, 'nicht gefunden');
        return;
      }
      console.log('🎯 Direkt ausgewählte Graduierung:', newGraduation.name, 'ID:', newGraduation.graduierung_id);
    } else {
      // Navigation mit Pfeiltasten (up/down)
      const currentIndex = selectedStil.graduierungen.findIndex(g => g.graduierung_id === graduationId);
      console.log('📍 Aktueller Index:', currentIndex, 'Direction:', direction);

      let newIndex;

      if (direction === 'up' && currentIndex > 0) {
        newIndex = currentIndex - 1; // Higher graduation (lower index)
      } else if (direction === 'down' && currentIndex < selectedStil.graduierungen.length - 1) {
        newIndex = currentIndex + 1; // Lower graduation (higher index)
      } else {
        console.log('⚠️ Keine Änderung möglich');
        return; // No change possible
      }

      newGraduation = selectedStil.graduierungen[newIndex];
      console.log('🎯 Neue Graduierung:', newGraduation.name, 'ID:', newGraduation.graduierung_id);
    }

    // Setze sofort die neue Graduierung im State
    setCurrentGraduation(newGraduation);

    // Speichere die neue Graduierung
    const stilId = selectedStil.stil_id;
    const updatedData = {
      ...styleSpecificData[stilId],
      current_graduierung_id: newGraduation.graduierung_id
    };

    setStyleSpecificData(prev => ({
      ...prev,
      [stilId]: updatedData
    }));

    console.log('💾 Speichere Graduierung...');

    // Auto-Save im Backend
    try {
      await saveStyleSpecificData(stilId, updatedData);
      console.log('✅ Graduierung gespeichert in styleSpecificData');
    } catch (error) {
      console.error('❌ Fehler beim Speichern in styleSpecificData:', error);
    }

    // Auch im Mitglied-Hauptdatensatz speichern
    try {
      console.log('💾 Speichere auch in Mitglieder-Tabelle...');
      await axios.put(`/mitglieder/${id}`, {
        gurtfarbe: newGraduation.name,
        letzte_pruefung: new Date().toISOString().split('T')[0]
      });

      setMitglied(prev => ({
        ...prev,
        gurtfarbe: newGraduation.name,
        letzte_pruefung: new Date().toISOString()
      }));
      setLastExamDate(new Date().toISOString().split('T')[0]);
      console.log('✅ Gurt-Graduierung in Mitglied aktualisiert');
    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren der Graduierung im Mitglied:', error);
    }

    // UI-Update erzwingen
    console.log('🔄 UI wird aktualisiert mit:', newGraduation.name);
  };

  const handleVertragAction = async (vertragId, action) => {
    setLoading(true);
    try {
      const vertrag = verträge.find(v => v.id === vertragId);
      setSelectedVertragForAction(vertrag);

      switch (action) {
        case 'kündigen':
          // Setze automatisch das heutige Datum als Kündigungsdatum
          setKündigungsdatum(new Date().toISOString().split('T')[0]);
          setShowKündigungModal(true);
          break;
        case 'ruhepause':
          setShowRuhepauseModal(true);
          break;
        case 'reaktivieren':
          if (window.confirm('Möchten Sie den Vertrag reaktivieren?')) {
            try {
              // Sende Update ans Backend
              await axios.put(`/vertraege/${vertragId}`, {
                status: 'aktiv',
                ruhepause_von: null,
                ruhepause_bis: null,
                ruhepause_dauer_monate: null,
                dojo_id: mitglied?.dojo_id
              });
              // Verträge vom Backend neu laden für vollständige Daten
              await fetchVerträge();
            } catch (error) {
              console.error('Fehler beim Reaktivieren des Vertrags:', error);
              alert('Fehler beim Reaktivieren des Vertrags. Bitte versuchen Sie es erneut.');
            }
          }
          break;
        default:
          return;
      }
    } catch (error) {
      console.error('Fehler bei Vertragsaktion:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRuhepauseConfirm = async () => {
    if (!selectedVertragForAction) return;

    setLoading(true);
    try {
      // Ruhepause beginnt am 1. des nächsten Monats
      const ruhepauseVon = new Date();
      ruhepauseVon.setMonth(ruhepauseVon.getMonth() + 1);
      ruhepauseVon.setDate(1);

      // Ruhepause endet am letzten Tag nach der gewählten Dauer
      const ruhepauseBis = new Date();
      ruhepauseBis.setMonth(ruhepauseBis.getMonth() + 1 + ruhepauseDauer);
      ruhepauseBis.setDate(0);

      // Sende Update ans Backend
      await axios.put(`/vertraege/${selectedVertragForAction.id}`, {
        status: 'ruhepause',
        ruhepause_von: ruhepauseVon.toISOString().split('T')[0],
        ruhepause_bis: ruhepauseBis.toISOString().split('T')[0],
        ruhepause_dauer_monate: ruhepauseDauer,
        dojo_id: mitglied?.dojo_id
      });

      setShowRuhepauseModal(false);
      setSelectedVertragForAction(null);
      setRuhepauseDauer(1);

      // Verträge vom Backend neu laden für vollständige Daten
      await fetchVerträge();
    } catch (error) {
      console.error('Fehler beim Setzen der Ruhepause:', error);
      alert('Fehler beim Setzen der Ruhepause. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleKündigungConfirm = async () => {
    if (!selectedVertragForAction || !kuendigungsbestätigung) return;

    setLoading(true);
    try {
      const kuendigungsdatumFinal = kuendigungsdatum || new Date().toISOString().split('T')[0];

      // Sende Update ans Backend
      await axios.put(`/vertraege/${selectedVertragForAction.id}`, {
        status: 'gekuendigt',
        kuendigung_eingegangen: kuendigungsdatumFinal,
        kuendigungsgrund: kuendigungsgrund,
        dojo_id: mitglied?.dojo_id
      });

      setShowKündigungModal(false);
      setSelectedVertragForAction(null);
      setKündigungsgrund('');
      setKündigungsbestätigung(false);
      setKündigungsdatum('');

      // Verträge vom Backend neu laden für vollständige Daten
      await fetchVerträge();
    } catch (error) {
      console.error('Fehler beim Kündigen des Vertrags:', error);
      alert('Fehler beim Kündigen des Vertrags. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleKündigungAufheben = async (vertrag) => {
    const confirmed = window.confirm(
      `Möchten Sie die Kündigung von Vertrag #${vertrag.personenVertragNr} wirklich aufheben?\n\n` +
      `Der Vertrag wird wieder auf "aktiv" gesetzt und ist im regulären Zahlungslauf.`
    );

    if (confirmed) {
      try {
        // Sende Update ans Backend
        await axios.put(`/vertraege/${vertrag.id}`, {
          status: 'aktiv',
          kuendigung_eingegangen: null,
          kuendigungsgrund: null,
          kuendigungsdatum: null,
          dojo_id: mitglied?.dojo_id
        });

        // Verträge vom Backend neu laden für vollständige Daten
        await fetchVerträge();
      } catch (error) {
        console.error('Fehler beim Aufheben der Kündigung:', error);
        alert('Fehler beim Aufheben der Kündigung. Bitte versuchen Sie es erneut.');
      }
    }
  };

  const handleKündigungBestätigen = async () => {
    if (!vertragZumKündigen) return;

    try {
      await axios.put(`/vertraege/${vertragZumKündigen.id}/kuendigen`, {
        kuendigungsdatum: new Date().toISOString().split('T')[0],
        kuendigung_eingegangen: new Date().toISOString().split('T')[0],
        status: 'gekuendigt'
      });

      alert('✅ Vertrag wurde erfolgreich gekündigt und archiviert.');
      setShowKündigungBestätigungModal(false);
      setVertragZumKündigen(null);
      await fetchVerträge();
    } catch (error) {
      console.error('Fehler beim Kündigen des Vertrags:', error);
      alert('Fehler beim Kündigen des Vertrags. Bitte versuchen Sie es erneut.');
    }
  };

  const handleVertragLöschen = async (vertrag) => {
    // Prüfe ob Vertrag bereits beendet ist
    const heute = new Date();
    heute.setHours(0, 0, 0, 0);
    
    let istBeendet = false;
    if (vertrag.vertragsende) {
      const vertragsende = new Date(vertrag.vertragsende);
      vertragsende.setHours(0, 0, 0, 0);
      istBeendet = vertragsende < heute;
    }
    
    // Vertrag ist beendet wenn: vertragsende in der Vergangenheit, status nicht aktiv, oder bereits gekündigt
    istBeendet = istBeendet || 
                 vertrag.status !== 'aktiv' || 
                 vertrag.kuendigung_eingegangen || 
                 vertrag.kuendigungsdatum;

    if (!istBeendet) {
      // Vertrag ist noch aktiv - Modal mit Ja/Nein anzeigen
      setVertragZumKündigen(vertrag);
      setShowKündigungBestätigungModal(true);
      return;
    }

    // Vertrag ist bereits beendet - normale Löschung/Archivierung
    const grund = window.prompt(
      `⚠️ Vertrag #${vertrag.personenVertragNr} löschen?\n\n` +
      `Der Vertrag wird archiviert und kann nicht wiederhergestellt werden.\n` +
      `Er bleibt zur Ansicht sichtbar.\n\n` +
      `Bitte Grund für Löschung eingeben (optional):`
    );

    if (grund !== null) { // User clicked OK (even if grund is empty)
      try {
        await axios.delete(`/vertraege/${vertrag.id}`, {
          data: {
            dojo_id: mitglied?.dojo_id,
            geloescht_von: user?.username || 'Admin',
            geloescht_grund: grund || 'Kein Grund angegeben'
          }
        });

        alert('✅ Vertrag wurde erfolgreich archiviert.');
        // Verträge vom Backend neu laden
        await fetchVerträge();
      } catch (error) {
        console.error('Fehler beim Löschen des Vertrags:', error);
        alert('Fehler beim Löschen des Vertrags. Bitte versuchen Sie es erneut.');
      }
    }
  };

  const handleSaveVertrag = async () => {
    setLoading(true);
    try {
      const vertragToSave = editingVertrag || newVertrag;

      // ⚠️ WICHTIG: Validiere dojo_id des Mitglieds
      if (!mitglied || !mitglied.dojo_id) {
        alert('? Fehler: Mitgliedsdaten nicht geladen. Bitte laden Sie die Seite neu.');
        setLoading(false);
        return;
      }

      // Validierung
      if (!vertragToSave.tarif_id) {
        alert('Bitte wählen Sie einen Tarif aus.');
        setLoading(false);
        return;
      }

      // Validierung: Rechtliche Akzeptanzen müssen gesetzt sein
      if (!editingVertrag) {
        if (!newVertrag.agb_akzeptiert || !newVertrag.datenschutz_akzeptiert) {
          alert('Bitte akzeptieren Sie die AGB und Datenschutzerklärung.');
          setLoading(false);
          return;
        }
      }

      // Validierung: SEPA-Mandat ist Pflichtfeld für Lastschrift-Verträge
      if (!vertragToSave.sepa_mandat_id) {
        alert('Bitte wählen Sie ein SEPA-Mandat aus. Ohne gültiges SEPA-Mandat kann keine Lastschrift eingezogen werden.');
        setLoading(false);
        return;
      }

      if (editingVertrag) {
        // Update existing
        const response = await axios.put(`/vertraege/${editingVertrag.id}`, {
          ...editingVertrag,
          dojo_id: mitglied?.dojo_id // Verwende dojo_id des Mitglieds, nicht des ausgewählten Dojos!
        });

        if (response.data.success) {
          // Reload verträge - nutze die bestehende Funktion für konsistentes Laden
          await fetchVerträge();
          setEditingVertrag(null);
          alert('? Vertrag erfolgreich aktualisiert!');
        }
      } else {
        // Create new - Erfasse Zeitstempel für Akzeptanzen
        // MySQL erwartet Format: YYYY-MM-DD HH:MM:SS (nicht ISO mit T und Z)
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        // Entferne nur die Checkbox-Boolean-Felder (NICHT billing_cycle, payment_method, vertragsbeginn, vertragsende, tarif_id!)
        const {
          agb_akzeptiert,
          datenschutz_akzeptiert,
          hausordnung_akzeptiert,
          ...vertragDataForBackend
        } = newVertrag;

        const contractData = {
          mitglied_id: parseInt(id),
          dojo_id: mitglied?.dojo_id, // Verwende dojo_id des Mitglieds, nicht des ausgewählten Dojos!
          ...vertragDataForBackend,
          // Automatische Zeitstempel für akzeptierte Dokumente
          agb_akzeptiert_am: newVertrag.agb_akzeptiert ? now : null,
          datenschutz_akzeptiert_am: newVertrag.datenschutz_akzeptiert ? now : null,
          hausordnung_akzeptiert_am: newVertrag.hausordnung_akzeptiert ? now : null,
          haftungsausschluss_datum: newVertrag.haftungsausschluss_akzeptiert ? now : null,
          gesundheitserklaerung_datum: newVertrag.gesundheitserklaerung ? now : null,
          foto_einverstaendnis_datum: newVertrag.foto_einverstaendnis ? now : null,
          unterschrift_datum: now, // Zeitstempel der Vertragsunterzeichnung
          unterschrift_ip: window.location.hostname // Erfasse IP/Hostname
        };

        console.log('📤 Sende Vertragsdaten:', contractData);

        const response = await axios.post('/vertraege', contractData);

        if (response.data.success) {
          // Reload verträge - nutze die bestehende Funktion für konsistentes Laden
          await fetchVerträge();

          // Reset form
          const heute = new Date();
          const in12Monaten = new Date(heute);
          in12Monaten.setMonth(heute.getMonth() + 12);

          setNewVertrag({
            tarif_id: '',
            status: 'aktiv',
            billing_cycle: '',
            payment_method: 'direct_debit',
            vertragsbeginn: heute.toISOString().split('T')[0],
            vertragsende: in12Monaten.toISOString().split('T')[0],
            kuendigungsfrist_monate: 3,
            mindestlaufzeit_monate: 12,
            automatische_verlaengerung: true,
            verlaengerung_monate: 12,
            faelligkeit_tag: 1,
            sepa_mandat_id: null,
            agb_akzeptiert: false,
            agb_version: '1.0',
            datenschutz_akzeptiert: false,
            datenschutz_version: '1.0',
            hausordnung_akzeptiert: false,
            haftungsausschluss_akzeptiert: false,
            gesundheitserklaerung: false,
            foto_einverstaendnis: false
          });
          setShowNewVertrag(false);
          alert('? Vertrag erfolgreich erstellt!');
        }
      }
    } catch (error) {
      console.error('? Fehler beim Speichern des Vertrags:', error);
      console.error('? Fehlerdetails:', error.response?.data);
      const errorMsg = error.response?.data?.sqlError || error.response?.data?.details || error.response?.data?.error || error.message;
      alert('Fehler beim Speichern des Vertrags: ' + errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Load member ID for non-admin users based on email
  useEffect(() => {
    const controller = new AbortController();

    const loadMemberIdByEmail = async () => {
      if (!isAdmin && user) {
        // 🔐 Verwende mitglied_id direkt aus JWT-Token (nicht per E-Mail suchen!)
        if (user.mitglied_id) {
          console.log('✅ Member ID aus JWT-Token geladen:', user.mitglied_id);
          setResolvedMemberId(user.mitglied_id);
        } else {
          console.error('❌ Keine mitglied_id im JWT-Token gefunden!', user);
          setError('Kein Mitgliedsprofil mit diesem Account verknüpft. Bitte kontaktieren Sie den Administrator.');
          setLoading(false);
        }
      } else if (!isAdmin && !user) {
        try {
          // Fallback: Find mitglied_id by email using dedicated endpoint (falls mitglied_id fehlt)
          const response = await axios.get(`/mitglieder/by-email/${encodeURIComponent(user.email)}`, {
            signal: controller.signal
          });

          if (response.data && response.data.mitglied_id) {
            console.log('📧 Member ID per E-Mail geladen:', response.data.mitglied_id);
            setResolvedMemberId(response.data.mitglied_id);
          } else {
            console.error('❌ No member found with email:', user.email);
            setError('Kein Mitglied mit dieser E-Mail gefunden.');
            setLoading(false);
          }
        } catch (err) {
          if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
            return; // Request was cancelled, don't show error
          }
          console.error('❌ Error loading member ID:', err);
          setError('Fehler beim Laden der Mitgliedsdaten.');
          setLoading(false);
        }
      } else if (isAdmin) {
        // For admin, ID comes from URL, so we're ready immediately
        setLoading(false);
      }
    };

    loadMemberIdByEmail();

    return () => {
      controller.abort();
    };
  }, [isAdmin, user]);

  useEffect(() => {
    if (!id) return; // Wait until ID is resolved

    const controller = new AbortController();

    // fetchMitgliedDetail - jetzt via React Query (useQuery)
    // fetchStile - jetzt via React Query (useQuery)
    // fetchTarifeUndZahlungszyklen - jetzt via React Query (useQuery)
    fetchAnwesenheitsDaten(null, controller.signal); // Lade alle Anwesenheitsdaten initial
    fetchFinanzDaten(controller.signal);
    loadMemberStyles(controller.signal);
    loadSepaMandate(controller.signal);
    loadArchivierteMandate(controller.signal);

    return () => {
      controller.abort();
    };
  }, [id]);

  useEffect(() => {
    if (mitglied) {
      const controller = new AbortController();
      fetchVerträge(controller.signal);
      return () => {
        controller.abort();
      };
    }
  }, [mitglied]);

  useEffect(() => {
    berechneStatistiken();
  }, [anwesenheitsDaten]);

  useEffect(() => {
    if (mitglied && memberStile.length > 0 && stile.length > 0) {
      // Ersten Stil als Default setzen wenn noch keiner ausgewählt
      if (!selectedStilId && memberStile.length > 0) {
        const firstMemberStilId = memberStile[0].stil_id.toString();
        const fullStilData = stile.find(s => s.stil_id === parseInt(firstMemberStilId));

        setSelectedStilId(firstMemberStilId);
        setSelectedStil(fullStilData);

        // Set graduation based on member's current belt color
        if (mitglied?.gurtfarbe && fullStilData?.graduierungen) {
          const graduation = fullStilData.graduierungen.find(g =>
            g.name.toLowerCase().includes(mitglied.gurtfarbe.toLowerCase())
          );
          setCurrentGraduation(graduation || fullStilData.graduierungen[0]);
        } else if (fullStilData?.graduierungen?.length > 0) {
          setCurrentGraduation(fullStilData.graduierungen[0]);
        }
      }

      // Sicherstellen, dass activeStyleTab im gültigen Bereich ist
      if (activeStyleTab >= memberStile.length) {
        setActiveStyleTab(0);
      }

      // Sicherstellen, dass activeExamTab im gültigen Bereich ist
      if (activeExamTab >= memberStile.length) {
        setActiveExamTab(0);
      }

      if (mitglied?.letzte_pruefung) {
        setLastExamDate(toInputDate(mitglied.letzte_pruefung));
      }

      // Allergien initialisieren
      if (mitglied?.allergien) {
        setAllergien(initializeAllergien(mitglied.allergien));
      }

      // Archivierte Allergien initialisieren
      if (mitglied?.allergien_archiv) {
        try {
          const archiv = typeof mitglied.allergien_archiv === 'string'
            ? JSON.parse(mitglied.allergien_archiv)
            : mitglied.allergien_archiv;
          setAllergienArchiv(archiv || []);
        } catch (e) {
          console.error('Fehler beim Parsen von allergien_archiv:', e);
          setAllergienArchiv([]);
        }
      }
    }
  }, [mitglied, memberStile, stile]); // ✅ Entfernt: selectedStilId, activeStyleTab, activeExamTab (werden nur intern geprüft)

  // ✨ NEU: Anwesenheitsdaten für Anwesenheits-Tab laden (alle Stile)
  useEffect(() => {
    if (activeTab === "anwesenheit") {
      const controller = new AbortController();
      fetchAnwesenheitsDaten(null, controller.signal); // Alle Stile
      return () => {
        controller.abort();
      };
    }
  }, [activeTab]);

  // ✨ NEU: Finanzdaten laden wenn Finanzen-Tab aktiv
  useEffect(() => {
    if (activeTab === "finanzen" && id) {
      const controller = new AbortController();
      fetchFinanzDaten(controller.signal);
      fetchTarifeUndZahlungszyklen(controller.signal);
      fetchVerträge(controller.signal); // Verträge für Beitragsgenerierung laden
      return () => {
        controller.abort();
      };
    }
  }, [activeTab, id]);

  // ✨ NEU: Anwesenheitsdaten für Stil-Tab laden (stil-spezifisch)
  useEffect(() => {
    if (activeTab === "stile" && memberStile.length > 0 && activeStyleTab < memberStile.length) {
      const currentStil = memberStile[activeStyleTab];
      if (currentStil && currentStil.stil_name) {
        const controller = new AbortController();
        fetchAnwesenheitsDaten(currentStil.stil_name, controller.signal);
        return () => {
          controller.abort();
        };
      }
    }
  }, [activeTab, activeStyleTab, memberStile]);

  // ✨ NEU: selectedStil und currentGraduation basierend auf activeStyleTab setzen
  useEffect(() => {
    if (memberStile.length > 0 && activeStyleTab < memberStile.length && stile.length > 0) {
      const currentMemberStil = memberStile[activeStyleTab];
      const fullStilData = stile.find(s => s.stil_id === currentMemberStil.stil_id);

      console.log('🎨 Setze selectedStil für Tab:', activeStyleTab, 'Stil:', currentMemberStil.stil_name);

      if (fullStilData) {
        setSelectedStil(fullStilData);

        // Setze aktuelle Graduierung basierend auf styleSpecificData
        const stilSpecificData = styleSpecificData[currentMemberStil.stil_id];
        if (stilSpecificData && stilSpecificData.current_graduierung_id && fullStilData.graduierungen) {
          const currentGrad = fullStilData.graduierungen.find(
            g => g.graduierung_id === stilSpecificData.current_graduierung_id
          );
          if (currentGrad) {
            console.log('🎖️ Setze currentGraduation:', currentGrad.name);
            setCurrentGraduation(currentGrad);
          }
        } else if (fullStilData.graduierungen && fullStilData.graduierungen.length > 0) {
          // Fallback: Erste Graduierung
          console.log('🎖️ Setze Fallback-Graduierung:', fullStilData.graduierungen[0].name);
          setCurrentGraduation(fullStilData.graduierungen[0]);
        }
      }
    }
  }, [activeStyleTab, memberStile, stile, styleSpecificData]);

  // Vorlagen und Dokumente laden wenn Dokumente-Tab aktiv
  useEffect(() => {
    if (activeTab === "dokumente" && mitglied?.dojo_id) {
      const controller = new AbortController();

      // Nur Admins laden Vorlagen
      if (isAdmin) {
        const loadVorlagen = async () => {
          try {
            const response = await axios.get(`/vertragsvorlagen?dojo_id=${mitglied?.dojo_id}`, {
              signal: controller.signal
            });
            setVerfügbareVorlagen(response.data.data || []);
          } catch (error) {
            if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
              return; // Request was cancelled, don't show error
            }
            console.error('Fehler beim Laden der Vorlagen:', error);
          }
        };
        loadVorlagen();
      }

      // Gespeicherte Dokumente für dieses Mitglied laden
      const loadMitgliedDokumente = async () => {
        try {
          const response = await axios.get(`/mitglieder/${id}/dokumente`, {
            signal: controller.signal
          });
          setMitgliedDokumente(response.data.data || []);
        } catch (error) {
          if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
            return; // Request was cancelled, don't show error
          }
          console.error('Fehler beim Laden der Dokumente:', error);
        }
      };
      loadMitgliedDokumente();

      // Rechnungen laden
      loadRechnungen(controller.signal);

      // Bestätigte Dokument-Benachrichtigungen laden
      const loadConfirmedNotifications = async () => {
        try {
          const response = await axios.get(`/notifications/member/${mitglied.id}/confirmed`, {
            signal: controller.signal
          });
          setConfirmedNotifications(response.data.data || []);
        } catch (error) {
          if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
            return; // Request was cancelled, don't show error
          }
          console.error('Fehler beim Laden der bestätigten Benachrichtigungen:', error);
        }
      };
      loadConfirmedNotifications();

      return () => {
        controller.abort();
      };
    }
  }, [activeTab, mitglied?.dojo_id, mitglied?.id, isAdmin, id]);

  // Load member notifications and news when nachrichten tab is active
  useEffect(() => {
    if (activeTab === "nachrichten") {
      const controller = new AbortController();

      // Benachrichtigungen laden (nur wenn Email vorhanden)
      if (mitglied?.email) {
        loadMemberNotifications(controller.signal);
      }

      // News-Artikel laden
      loadNewsArticles(controller.signal);

      return () => {
        controller.abort();
      };
    }
  }, [activeTab, mitglied?.email]);

  // Load buddy groups when buddy_gruppen tab is active
  useEffect(() => {
    if (activeTab === "buddy_gruppen" && mitglied?.mitglied_id && token) {
      const controller = new AbortController();
      
      const loadBuddyGroups = async () => {
        try {
          setBuddyGroupsLoading(true);
          
          const response = await fetch(`${config.apiBaseUrl}/buddy/member/${mitglied.mitglied_id}/gruppen`, {
            headers: {
              'Authorization': `Bearer ${token}`
            },
            signal: controller.signal
          });

          if (response.ok) {
            const data = await response.json();
            setBuddyGroups(data || []);
          } else {
            setBuddyGroups([]);
          }
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.error('Fehler beim Laden der Buddy-Gruppen:', err);
            setBuddyGroups([]);
          }
        } finally {
          setBuddyGroupsLoading(false);
        }
      };

      loadBuddyGroups();

      return () => {
        controller.abort();
      };
    }
  }, [activeTab, mitglied?.mitglied_id, token]);

  const handleChange = (e, key) => {
    let value = e.target.value;
    
    if (key === "gewicht" || key === "kontostand" || key === "rabatt_prozent") {
      value = parseFloat(value);
      if (isNaN(value)) value = 0;
    }
    
    if (e.target.type === "checkbox") {
      value = e.target.checked;
    }
    
    // Debug: Log für Vertreter-Felder
    if (key.includes('vertreter')) {
      console.log(`🔄 handleChange: ${key} = ${value}`);
    }
    
    setUpdatedData((prev) => ({ ...prev, [key]: value }));
  };

  // Allergie-Management-Funktionen
  const commonAllergies = [
    'Nussallergie',
    'Laktoseintoleranz', 
    'Glutenunverträglichkeit',
    'Pollenallergie',
    'Hausstaub',
    'Tierhaare',
    'Medikamentenallergie',
    'Sonnenallergie',
    'Insektenstiche',
    'Sonstiges'
  ];

  const initializeAllergien = (allergienString) => {
    if (!allergienString) return [];
    return allergienString.split(';').filter(a => a.trim()).map((allergie, index) => ({
      id: index,
      value: allergie.trim()
    }));
  };

  const addAllergie = () => {
    if (!newAllergie.type) return;
    
    const allergieValue = newAllergie.type === 'Sonstiges' ? newAllergie.custom : newAllergie.type;
    if (!allergieValue.trim()) return;

    const newId = Math.max(0, ...allergien.map(a => a.id)) + 1;
    const updatedAllergien = [...allergien, { id: newId, value: allergieValue.trim() }];
    setAllergien(updatedAllergien);
    
    // Update das Datenfeld
    const allergienString = updatedAllergien.map(a => a.value).join('; ');
    setUpdatedData({ ...updatedData, allergien: allergienString });
    
    // Reset Form
    setNewAllergie({ type: '', custom: '' });
  };

  const removeAllergie = async (id) => {
    try {
      // Archiviere die Allergie über API
      const response = await fetch(`http://localhost:3000/api/mitglieddetail/${mitglied.id}/archive-allergie`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allergieId: id })
      });

      if (!response.ok) {
        throw new Error('Fehler beim Archivieren der Allergie');
      }

      const result = await response.json();

      // Update lokalen State mit den vom Server zurückgegebenen Daten
      setAllergien(result.allergien);
      setAllergienArchiv(result.allergien_archiv);

      const allergienString = result.allergien.length > 0
        ? result.allergien.map(a => a.value).join('; ')
        : '';
      setUpdatedData({ ...updatedData, allergien: allergienString });

      // Zeige Erfolgs-Nachricht
      console.log('✅ Allergie archiviert:', result.message);

    } catch (error) {
      console.error('Fehler beim Archivieren der Allergie:', error);
      alert('Fehler beim Archivieren der Allergie');
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const dataToSend = { ...updatedData };
      delete dataToSend.id;
      delete dataToSend.mitglied_id;

      // Datum-Konvertierung
      if (dataToSend.geburtsdatum) {
        dataToSend.geburtsdatum = toMySqlDate(dataToSend.geburtsdatum);
      }
      if (dataToSend.eintrittsdatum) {
        dataToSend.eintrittsdatum = toMySqlDate(dataToSend.eintrittsdatum);
      }
      if (dataToSend.gekuendigt_am) {
        dataToSend.gekuendigt_am = toMySqlDate(dataToSend.gekuendigt_am);
      }
      if (dataToSend.nächste_pruefung_datum) {
        dataToSend.nächste_pruefung_datum = toMySqlDate(dataToSend.nächste_pruefung_datum);
      }
      if (dataToSend.vereinsordnung_datum) {
        dataToSend.vereinsordnung_datum = toMySqlDate(dataToSend.vereinsordnung_datum);
      }

      // Debug: Log welche Vertreter-Felder gespeichert werden
      if (dataToSend.vertreter1_typ || dataToSend.vertreter2_typ) {
        console.log('💾 Speichere Vertreter-Daten:', {
          vertreter1_typ: dataToSend.vertreter1_typ,
          vertreter2_typ: dataToSend.vertreter2_typ,
          vertreter1_name: dataToSend.vertreter1_name,
          vertreter2_name: dataToSend.vertreter2_name
        });
      }
      
      const res = await axios.put(`/mitglieddetail/${id}`, dataToSend);
      const data = res.data;
      console.log('✅ Speichern erfolgreich:', data);
      setMitglied(data && Object.keys(data).length ? data : dataToSend);
      setUpdatedData(data && Object.keys(data).length ? data : dataToSend);
      setEditMode(false);
      // Lade die Daten neu um sicherzustellen, dass alles aktuell ist
      await fetchMitgliedDetail();
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setLoading(false);
    }
  };

  // Foto-Upload Funktionen
  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validiere Dateityp
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Nur Bilddateien (JPEG, PNG, GIF, WebP) sind erlaubt!');
      return;
    }

    // Validiere Dateigröße (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Datei ist zu groß! Maximum 5MB erlaubt.');
      return;
    }

    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('foto', file);

    try {
      const response = await axios.post(`/mitglieddetail/${id}/foto`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        
        // Aktualisiere die Mitgliedsdaten sofort
        const newFotoPfad = response.data.fotoPfad;
        setMitglied(prev => ({ ...prev, foto_pfad: newFotoPfad }));
        setUpdatedData(prev => ({ ...prev, foto_pfad: newFotoPfad }));
        
        // Erstelle Vorschau
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhotoPreview(e.target.result);
          console.log('📷 PhotoPreview gesetzt');
        };
        reader.readAsDataURL(file);
        
        // Lade die Daten neu um sicherzustellen, dass alles synchron ist
        setTimeout(() => {
          fetchMitgliedDetail();
        }, 100);
        
        alert('? Foto erfolgreich hochgeladen!');
      }
    } catch (error) {
      console.error('Fehler beim Hochladen des Fotos:', error);
      alert('? Fehler beim Hochladen des Fotos: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!window.confirm('Möchten Sie das Foto wirklich löschen?')) return;

    setLoading(true);
    try {
      const response = await axios.delete(`/mitglieddetail/${id}/foto`);

      if (response.data.success) {
        // Entferne Foto aus den Daten
        setMitglied(prev => ({ ...prev, foto_pfad: null }));
        setUpdatedData(prev => ({ ...prev, foto_pfad: null }));
        setPhotoPreview(null);

        alert('? Foto erfolgreich gelöscht!');
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Fotos:', error);
      alert('? Fehler beim Löschen des Fotos: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (tabKey, index) => {
    setActiveTab(tabKey);
    setActiveIndex(index);
  };

  // Archivierungs-Funktion
  const handleArchiveMitglied = async () => {
    try {
      const response = await axios.post(`/mitglieder/${id}/archivieren`, {
        grund: archiveReason || 'Mitglied archiviert',
        archiviert_von: user?.id || null
      });

      if (response.data.success) {
        // Modal schließen und sofort zur Mitgliederübersicht navigieren
        setShowArchiveModal(false);
        alert(`✅ ${mitglied.vorname} ${mitglied.nachname} wurde erfolgreich archiviert.`);

        // Navigiere zur Mitglieder-Übersicht
        window.location.href = '/dashboard/mitglieder';
      }
    } catch (error) {
      console.error('Fehler beim Archivieren:', error);
      alert('❌ Fehler beim Archivieren: ' + (error.response?.data?.error || error.message));
    }
  };

  // PDF-Export-Funktion
  const handlePrint = async () => {
    if (generatingPdf) return; // Verhindere Mehrfach-Klicks

    setGeneratingPdf(true);

    try {
      console.log(`📄 Starte PDF-Download für Mitglied ${mitglied.mitglied_id}...`);

      // API-Aufruf zum PDF-Generator
      const response = await axios.post(
        `/mitglieddetail/${mitglied.mitglied_id}/pdf`,
        { save_to_db: false },
        {
          responseType: 'blob',
          timeout: 30000 // 30 Sekunden Timeout
        }
      );

      // Download erstellen
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Mitglied_${mitglied.mitgliedsnummer || mitglied.mitglied_id}_Details.pdf`;
      document.body.appendChild(link);
      link.click();

      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log('✅ PDF erfolgreich heruntergeladen');
      alert('✅ PDF erfolgreich erstellt und heruntergeladen!');

    } catch (error) {
      console.error('❌ Fehler bei PDF-Generierung:', error);

      let errorMessage = 'Fehler bei PDF-Generierung';
      if (error.response?.data) {
        // Wenn der Fehler JSON ist
        try {
          const reader = new FileReader();
          reader.onload = () => {
            const errorData = JSON.parse(reader.result);
            alert(`❌ ${errorMessage}: ${errorData.details || errorData.error || 'Unbekannter Fehler'}`);
          };
          reader.readAsText(error.response.data);
        } catch {
          alert(`❌ ${errorMessage}: ${error.message}`);
        }
      } else {
        alert(`❌ ${errorMessage}: ${error.message}`);
      }
    } finally {
      setGeneratingPdf(false);
    }
  };

  if (loading) return (
    <div className="mitglied-detail-container" style={{ padding: '2rem' }}>
      <SkeletonProfile />
    </div>
  );
  if (error) return <p className="error">{error}</p>;
  if (!mitglied) return <p>Keine Daten gefunden.</p>;

  // Tab configuration - all tabs visible, but some content is admin-only
  const allTabs = [
    { key: "allgemein", label: "Allgemein", icon: "👤" },
    { key: "medizinisch", label: "Medizinisch", icon: "🏥" },
    { key: "fortschritt", label: "Fortschritt", icon: "📈" },
    { key: "anwesenheit", label: "Anwesenheit", icon: "📅" },
    { key: "finanzen", label: "Finanzen", icon: "💰" },
    { key: "vertrag", label: "Vertrag", icon: "📄" },
    { key: "dokumente", label: "Dokumente", icon: "📁" },
    { key: "familie", label: "Familie & Vertreter", icon: "👨‍👩‍👧‍👦" },
    { key: "gurt_stil", label: "Gurt & Stil / Prüfung", icon: "🥋" },
    { key: "buddy_gruppen", label: "Buddy-Gruppen", icon: "👥" },
    { key: "nachrichten", label: "Nachrichten", icon: "📬" },
    { key: "statistiken", label: "Statistiken", icon: "📊" },
    { key: "zusatzdaten", label: "Lehrgänge & Ehrungen", icon: "🏆" },
    { key: "sicherheit", label: "Sicherheit", icon: "🔒" },
  ];

  // Sicherheit-Tab State
  // (bereits weiter oben deklariert, doppelte Deklaration entfernen)

  const passwordMeetsPolicy = (pwd) => {
    const hasDigit = /\d/.test(pwd);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>_+\-=/\\\[\];'`~]/.test(pwd);
    return pwd && pwd.length >= 8 && hasDigit && hasSpecial;
  };

  const handleChangePassword = async () => {
    setSecurityMessage(null);
    if (!passwordMeetsPolicy(newPassword)) {
      setSecurityMessage({ type: 'error', text: 'Neues Passwort entspricht nicht der Richtlinie.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityMessage({ type: 'error', text: 'Die Passwörter stimmen nicht überein.' });
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post('/auth/change-password', { currentPassword, newPassword });
      setSecurityMessage({ type: 'success', text: res.data?.message || 'Passwort geändert.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      setSecurityMessage({ type: 'error', text: e.response?.data?.message || 'Änderung fehlgeschlagen.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSecurity = async () => {
    setSecurityMessage(null);
    if (!securityAnswer.trim()) {
      setSecurityMessage({ type: 'error', text: 'Bitte eine Antwort auf die Sicherheitsfrage angeben.' });
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post('/auth/security', { securityQuestion, securityAnswer });
      setSecurityMessage({ type: 'success', text: res.data?.message || 'Sicherheitsfrage gespeichert.' });
    } catch (e) {
      setSecurityMessage({ type: 'error', text: e.response?.data?.message || 'Speichern fehlgeschlagen.' });
    } finally {
      setLoading(false);
    }
  };

  // All tabs visible for both admin and member
  const tabs = allTabs;

  return (
    <div className="mitglied-detail-container">
      <div className="mitglied-layout">
        <aside className={`mitglied-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          {/* Toggle Button - Tab Style (nur Icon, immer aktiv) */}
          <button
            className="tab-vertical-btn sidebar-toggle-btn active"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Sidebar öffnen' : 'Sidebar schließen'}
          >
            <span className="tab-icon">{sidebarCollapsed ? '»' : '«'}</span>
          </button>

          {/* Foto und Name oben */}
          <div className="mitglied-header">
            <div className={`mitglied-avatar ${!avatarLoaded ? 'avatar-loading' : ''}`} style={{ position: 'relative' }}>
              <img
                key={mitglied?.mitglied_id}
                src={mitglied?.foto_pfad ? `http://localhost:3000/${mitglied.foto_pfad}` : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%232a2a4e" width="100" height="100"/%3E%3Ctext fill="%23ffd700" font-family="sans-serif" font-size="50" dy=".35em" x="50%25" y="50%25" text-anchor="middle"%3E👤%3C/text%3E%3C/svg%3E'}
                alt={`${mitglied?.vorname} ${mitglied?.nachname}`}
                className="avatar-image"
                style={{
                  opacity: avatarLoaded ? 1 : 0,
                  transition: 'opacity 0.3s ease-in-out'
                }}
                onLoad={() => {
                  console.log('🖼️ Avatar onLoad gefeuert für:', mitglied?.foto_pfad);
                  setAvatarLoaded(true);
                }}
                onError={(e) => {
                  console.log('❌ Avatar onError gefeuert für:', mitglied?.foto_pfad, 'Event:', e);
                  e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%232a2a4e" width="100" height="100"/%3E%3Ctext fill="%23ffd700" font-family="sans-serif" font-size="50" dy=".35em" x="50%25" y="50%25" text-anchor="middle"%3E👤%3C/text%3E%3C/svg%3E';
                  setAvatarLoaded(true);
                }}
              />
            </div>
            {!sidebarCollapsed && (
              <div className="mitglied-name">
                {mitglied?.vorname} {mitglied?.nachname}
                {isAdmin && mitglied?.dojo_id && (
                  <div className="mitglied-dojo-name" style={{ fontSize: '0.85rem', marginTop: '4px', fontWeight: 'normal' }}>
                    {getDojoName(mitglied.dojo_id)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tabs darunter */}
          <nav className="tabs-vertical" aria-label="Mitglied Tabs">
            {tabs.map((tab, index) => (
              <button
                key={tab.key}
                className={`tab-vertical-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => handleTabClick(tab.key, index)}
                title={sidebarCollapsed ? tab.label : ''}
              >
                <span className="tab-icon">{tab.icon}</span>
                {!sidebarCollapsed && <span className="tab-label">{tab.label}</span>}
              </button>
            ))}
          </nav>
        </aside>

        <div className={`mitglied-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          {/* Header mit Drei-Punkte-Menü */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '1rem',
            gap: '1rem',
            paddingRight: '1rem',
            paddingTop: '0.5rem'
          }}>
            {/* Linke Seite: Zurück-Button und Status-Badges */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              flex: 1,
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              {/* Zurück-Button - nur für Admin */}
              {isAdmin && (
                <button
                  className="back-button mitglied-detail-back-btn"
                  onClick={() => navigate("/dashboard/mitglieder")}
                >
                  ← Zurück
                </button>
              )}
              
              {/* Status-Badges - nebeneinander */}
              <div className="mitglied-detail-status-badges">
              <div className="mitglied-detail-badge" title="Offene Dokumente">
                <span className="badge-icon">📄</span>
                <span className="badge-label">Dokumente:</span>
                <span className="badge-value">{offeneDokumente}</span>
              </div>
              <div className="mitglied-detail-badge" title="Offene Nachrichten">
                <span className="badge-icon">✉️</span>
                <span className="badge-label">Nachrichten:</span>
                <span className="badge-value">{offeneNachrichten}</span>
              </div>
              <div className={`mitglied-detail-badge ${offeneBeiträge > 0 ? 'badge-warning' : ''}`} title="Offene Beiträge">
                <span className="badge-icon">💰</span>
                <span className="badge-label">Beiträge:</span>
                <span className={`badge-value ${offeneBeiträge > 0 ? 'warning' : ''}`}>{offeneBeiträge}</span>
              </div>
            </div>
            </div>

            {/* Drei-Punkte-Menü */}
            {isAdmin && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  className="mitglied-detail-actions-btn"
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  title="Aktionen"
                >
                  ⋮
                </button>

                {/* Dropdown-Menü */}
                {showActionsMenu && (
                  <>
                    {/* Overlay zum Schließen */}
                    <div
                      onClick={() => setShowActionsMenu(false)}
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 998
                      }}
                    />

                    <div className="mitglied-detail-actions-menu">
                      <button
                        className="mitglied-detail-menu-item"
                        onClick={() => {
                          setEditMode(!editMode);
                          setShowActionsMenu(false);
                        }}
                      >
                        <span className="menu-item-icon">✏️</span>
                        <span>{editMode ? 'Bearbeiten beenden' : 'Bearbeiten'}</span>
                      </button>

                      <button
                        className={`mitglied-detail-menu-item ${!editMode ? 'disabled' : ''}`}
                        onClick={() => {
                          handleSave();
                          setShowActionsMenu(false);
                        }}
                        disabled={!editMode}
                      >
                        <span className="menu-item-icon">💾</span>
                        <span>Speichern</span>
                      </button>

                      <button
                        className={`mitglied-detail-menu-item ${generatingPdf ? 'disabled' : ''}`}
                        onClick={() => {
                          handlePrint();
                          setShowActionsMenu(false);
                        }}
                        disabled={generatingPdf}
                      >
                        <span className="menu-item-icon">{generatingPdf ? '⏳' : '📄'}</span>
                        <span>{generatingPdf ? 'Generiere PDF...' : 'PDF exportieren'}</span>
                      </button>

                      <div className="mitglied-detail-menu-divider" />

                      <button
                        className="mitglied-detail-menu-item danger"
                        onClick={() => {
                          setShowArchiveModal(true);
                          setShowActionsMenu(false);
                        }}
                      >
                        <span className="menu-item-icon">🗑️</span>
                        <span>Ins Archiv verschieben</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              className="tab-content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
          {activeTab === "sicherheit" && (
            <MemberSecurityTab CustomSelect={CustomSelect} />
          )}
          {activeTab === "allgemein" && (
            <div className="grid-container">
              <div className="field-group card">
                <h3>Allgemeine Informationen</h3>
                
                <div>
                  <label>Mitgliedsnummer:</label>
                  <span>{mitglied.mitglied_id}</span>
                </div>
                
                {/* Foto-Upload Bereich */}
                <div className="foto-upload-section">
                  <div className="foto-container">
                    <label className="foto-label">Foto:</label>
                    {(mitglied?.foto_pfad || photoPreview) ? (
                      <div className="foto-preview">
                        <img
                          src={photoPreview || (mitglied?.foto_pfad ? `http://localhost:3000/${mitglied.foto_pfad}` : '/src/assets/default-avatar.png')}
                          alt={`${mitglied?.vorname} ${mitglied?.nachname}`}
                          className="mitglied-foto-small"
                          onClick={() => {
                            const newWindow = window.open();
                            newWindow.document.write(`
                              <html>
                                <head><title>${mitglied?.vorname} ${mitglied?.nachname}</title></head>
                                <body style="margin:0; background:#000; display:flex; justify-content:center; align-items:center; min-height:100vh;">
                                  <img src="${photoPreview || (mitglied?.foto_pfad ? `http://localhost:3000/${mitglied.foto_pfad}` : '/src/assets/default-avatar.png')}"
                                       style="max-width:90vw; max-height:90vh; object-fit:contain;" />
                                </body>
                              </html>
                            `);
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                        <div className="foto-actions">
                          <input
                            type="file"
                            id="photo-upload"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            style={{ display: 'none' }}
                            disabled={uploadingPhoto}
                          />
                          <button
                            onClick={() => document.getElementById('photo-upload').click()}
                            disabled={uploadingPhoto}
                            style={{
                              background: 'rgba(42, 42, 78, 0.6)',
                              border: '1px solid rgba(255, 215, 0, 0.3)',
                              color: '#ffd700',
                              padding: '8px 16px',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              borderRadius: '8px',
                              cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                              opacity: uploadingPhoto ? 0.5 : 1,
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!uploadingPhoto) {
                                e.target.style.background = 'rgba(255, 215, 0, 0.15)';
                                e.target.style.borderColor = 'rgba(255, 215, 0, 0.6)';
                                e.target.style.color = '#ffed4e';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'rgba(42, 42, 78, 0.6)';
                              e.target.style.borderColor = 'rgba(255, 215, 0, 0.3)';
                              e.target.style.color = '#ffd700';
                            }}
                          >
                            {uploadingPhoto ? '⏳ Hochladen...' : '📷 Foto ändern'}
                          </button>
                          <button
                            onClick={handlePhotoDelete}
                            className="btn btn-sm"
                            disabled={uploadingPhoto}
                            style={{
                              background: 'transparent',
                              border: '1px solid rgba(239, 68, 68, 0.5)',
                              color: '#ef4444',
                              padding: '8px 16px',
                              fontSize: '0.85rem',
                              borderRadius: '8px',
                              cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                              transition: 'all 0.3s ease',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontWeight: 600,
                              textTransform: 'none',
                              opacity: uploadingPhoto ? 0.5 : 1
                            }}
                            onMouseEnter={(e) => {
                              if (!uploadingPhoto) {
                                e.target.style.background = 'rgba(239, 68, 68, 0.15)';
                                e.target.style.borderColor = 'rgba(239, 68, 68, 0.7)';
                                e.target.style.color = '#ff6b6b';
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'transparent';
                              e.target.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                              e.target.style.color = '#ef4444';
                            }}
                          >
                            🗑️ Löschen
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="foto-placeholder">
                        <div className="foto-upload-area">
                          <input
                            type="file"
                            id="photo-upload"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            style={{ display: 'none' }}
                            disabled={uploadingPhoto}
                          />
                          <label htmlFor="photo-upload" className="btn" style={{
                            cursor: 'pointer',
                            background: 'transparent',
                            border: '1px solid rgba(255, 215, 0, 0.2)',
                            color: 'rgba(255, 255, 255, 0.7)',
                            padding: '12px 20px',
                            fontSize: '0.9rem',
                            borderRadius: '8px',
                            transition: 'all 0.3s ease',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            fontWeight: 600
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.target.style.borderColor = 'rgba(255, 215, 0, 0.4)';
                            e.target.style.color = 'rgba(255, 255, 255, 0.9)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'transparent';
                            e.target.style.borderColor = 'rgba(255, 215, 0, 0.2)';
                            e.target.style.color = 'rgba(255, 255, 255, 0.7)';
                          }}>
                            {uploadingPhoto ? (
                              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                                <div className="spinner"></div>
                                <span>Hochladen...</span>
                              </div>
                            ) : (
                              <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                                <span>📷</span>
                                <span>Foto hochladen</span>
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div>
                  <label>Vorname:</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={updatedData.vorname || ""}
                      onChange={(e) => handleChange(e, "vorname")}
                    />
                  ) : (
                    <span>{mitglied.vorname}</span>
                  )}
                </div>
                <div>
                  <label>Nachname:</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={updatedData.nachname || ""}
                      onChange={(e) => handleChange(e, "nachname")}
                    />
                  ) : (
                    <span>{mitglied.nachname}</span>
                  )}
                </div>
                <div>
                  <label>Geburtsdatum:</label>
                  {editMode && isAdmin ? (
                    <input
                      type="date"
                      value={toInputDate(updatedData.geburtsdatum)}
                      onChange={(e) => handleChange(e, "geburtsdatum")}
                    />
                  ) : (
                    <span>
                      {mitglied.geburtsdatum ? new Date(mitglied.geburtsdatum).toLocaleDateString(
                        "de-DE",
                        { day: "2-digit", month: "2-digit", year: "numeric" }
                      ) : "Nicht angegeben"}
                    </span>
                  )}
                </div>
                <div>
                  <label>Geschlecht:</label>
                  {editMode ? (
                    <select
                      value={updatedData.geschlecht || ""}
                      onChange={(e) => handleChange(e, "geschlecht")}
                    >
                      <option value="m">männlich</option>
                      <option value="w">weiblich</option>
                      <option value="d">divers</option>
                    </select>
                  ) : (
                    <span>{mitglied.geschlecht === 'm' ? 'männlich' : mitglied.geschlecht === 'w' ? 'weiblich' : 'divers'}</span>
                  )}
                </div>
                <div>
                  <label>Gewicht:</label>
                  {editMode ? (
                    <input
                      type="number"
                      step="0.01"
                      value={updatedData.gewicht || ""}
                      onChange={(e) => handleChange(e, "gewicht")}
                    />
                  ) : (
                    <span>{mitglied.gewicht} kg</span>
                  )}
                </div>
                <div>
                  <label>Aktuelle Graduierung(en):</label>
                  {editMode && isAdmin ? (
                    <input
                      type="text"
                      value={updatedData.gurtfarbe || ""}
                      onChange={(e) => handleChange(e, "gurtfarbe")}
                      placeholder="Legacy-Feld (wird nicht mehr verwendet)"
                      disabled
                      style={{ opacity: 0.5, cursor: 'not-allowed' }}
                    />
                  ) : (
                    <span>{mitglied.aktuelle_graduierungen || mitglied.gurtfarbe || "Keine Graduierung zugeordnet"}</span>
                  )}
                </div>
              </div>

              <div className="field-group card">
                <h3>Kontaktdaten</h3>
                <div>
                  <label>E-Mail:</label>
                  {editMode ? (
                    <input
                      type="email"
                      value={updatedData.email || ""}
                      onChange={(e) => handleChange(e, "email")}
                      className="input-transparent"
                    />
                  ) : (
                    <span>{mitglied.email || "Nicht angegeben"}</span>
                  )}
                </div>
                <div>
                  <label>Telefon:</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={updatedData.telefon || ""}
                      onChange={(e) => handleChange(e, "telefon")}
                      className="input-transparent"
                    />
                  ) : (
                    <span>{mitglied.telefon || "Nicht angegeben"}</span>
                  )}
                </div>
                <div>
                  <label>Mobil:</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={updatedData.telefon_mobil || ""}
                      onChange={(e) => handleChange(e, "telefon_mobil")}
                      className="input-transparent"
                    />
                  ) : (
                    <span>{mitglied.telefon_mobil || "Nicht angegeben"}</span>
                  )}
                </div>
                <div>
                  <label>Straße:</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={updatedData.strasse || ""}
                      onChange={(e) => handleChange(e, "strasse")}
                      className="input-transparent"
                    />
                  ) : (
                    <span>{mitglied.strasse || "Nicht angegeben"}</span>
                  )}
                </div>
                <div>
                  <label>Hausnummer:</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={updatedData.hausnummer || ""}
                      onChange={(e) => handleChange(e, "hausnummer")}
                      className="input-transparent"
                    />
                  ) : (
                    <span>{mitglied.hausnummer || "Nicht angegeben"}</span>
                  )}
                </div>
                <div>
                  <label>PLZ:</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={updatedData.plz || ""}
                      onChange={(e) => handleChange(e, "plz")}
                    />
                  ) : (
                    <span>{mitglied.plz || "Nicht angegeben"}</span>
                  )}
                </div>
                <div>
                  <label>Ort:</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={updatedData.ort || ""}
                      onChange={(e) => handleChange(e, "ort")}
                    />
                  ) : (
                    <span>{mitglied.ort || "Nicht angegeben"}</span>
                  )}
                </div>
              </div>

              <div className="field-group card">
                <h3>Erweiterte Informationen</h3>

                {/* 🔒 ADMIN-ONLY: Interne Notizen */}
                {isAdmin && (
                  <div>
                    <label>Interne Notizen:</label>
                    {editMode ? (
                      <textarea
                        value={updatedData.notizen || ""}
                        onChange={(e) => handleChange(e, "notizen")}
                        placeholder="Interne Notizen über das Mitglied..."
                        rows={3}
                      />
                    ) : (
                      <span>{mitglied.notizen || "Keine Notizen vorhanden"}</span>
                    )}
                  </div>
                )}

                <div>
                  <label>Newsletter-Abonnement:</label>
                  {editMode ? (
                    <CustomSelect
                      value={updatedData.newsletter_abo || "1"}
                      onChange={(e) => handleChange(e, "newsletter_abo")}
                      options={[
                        { value: '1', label: 'Ja, Newsletter erhalten' },
                        { value: '0', label: 'Nein, kein Newsletter' }
                      ]}
                    />
                  ) : (
                    <span>{mitglied.newsletter_abo ? "? Abonniert" : "? Nicht abonniert"}</span>
                  )}
                </div>

                {/* 🔒 ADMIN-ONLY: Marketing-Quelle */}
                {isAdmin && (
                  <div>
                    <label>Marketing-Quelle:</label>
                    {editMode ? (
                      <CustomSelect
                        value={updatedData.marketing_quelle || ""}
                        onChange={(e) => handleChange(e, "marketing_quelle")}
                        options={[
                          { value: '', label: 'Bitte auswählen...' },
                          { value: 'Google', label: 'Google-Suche' },
                          { value: 'Facebook', label: 'Facebook' },
                          { value: 'Instagram', label: 'Instagram' },
                          { value: 'Empfehlung', label: 'Empfehlung von Freunden' },
                          { value: 'Flyer', label: 'Flyer/Werbung' },
                          { value: 'Website', label: 'Eigene Website' },
                          { value: 'Vorbeikommen', label: 'Vorbeigelaufen' },
                          { value: 'Sonstiges', label: 'Sonstiges' }
                        ]}
                      />
                    ) : (
                      <span>{mitglied.marketing_quelle || "Nicht angegeben"}</span>
                    )}
                  </div>
                )}

                <div>
                  <label>Bevorzugte Trainingszeiten:</label>
                  {editMode ? (
                    <input
                      type="text"
                      value={updatedData.bevorzugte_trainingszeiten || ""}
                      onChange={(e) => handleChange(e, "bevorzugte_trainingszeiten")}
                      placeholder="z.B. Montag/Mittwoch 19:00"
                    />
                  ) : (
                    <span>{mitglied.bevorzugte_trainingszeiten || "Nicht angegeben"}</span>
                  )}
                </div>

                {/* 🔒 ADMIN-ONLY: Online-Portal Aktivierung */}
                {isAdmin && (
                  <div>
                    <label>Online-Portal:</label>
                    {editMode ? (
                      <CustomSelect
                        value={updatedData.online_portal_aktiv || "0"}
                        onChange={(e) => handleChange(e, "online_portal_aktiv")}
                        options={[
                          { value: '1', label: 'Aktiv' },
                          { value: '0', label: 'Inaktiv' }
                        ]}
                      />
                    ) : (
                      <span>{mitglied.online_portal_aktiv ? "✅ Aktiv" : "? Inaktiv"}</span>
                    )}
                  </div>
                )}

                {mitglied.letzter_login && (
                  <div>
                    <label>Letzter Login:</label>
                    <span>
                      {new Date(mitglied.letzter_login).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* 🔒 ADMIN-ONLY: Kontostand */}
              {isAdmin && (
                <div className="field-group card kontostand-card">
                  <h3>Kontostand</h3>
                  {editMode ? (
                    <div>
                      <label>Aktueller Kontostand:</label>
                      <input
                        type="number"
                        step="0.01"
                        value={updatedData.kontostand ?? 0}
                        onChange={(e) => handleChange(e, "kontostand")}
                      />
                    </div>
                  ) : (
                    <div className="kontostand-details" style={{
                      display: 'grid',
                      gap: '1rem',
                      marginTop: '1rem'
                    }}>
                      <div style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 215, 0, 0.2)'
                      }}>
                        <div style={{
                          fontSize: '0.75rem',
                          color: 'rgba(255, 255, 255, 0.6)',
                          marginBottom: '0.5rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Aktueller offener Betrag
                        </div>
                        <div style={{
                          color: (() => {
                            // Berechne Kontostand aus finanzDaten - nur unbezahlte Beiträge
                            const kontostand = finanzDaten
                              .filter(item => !item.bezahlt)
                              .reduce((sum, item) => sum + (parseFloat(item.betrag) || 0), 0);
                            return kontostand > 0 ? '#ef4444' : '#10b981';
                          })(),
                          fontSize: '1.2rem',
                          fontWeight: '600'
                        }}>
                          {(() => {
                            // Berechne offenen Betrag aus unbezahlten Beiträgen
                            const kontostand = finanzDaten
                              .filter(item => !item.bezahlt)
                              .reduce((sum, item) => sum + (parseFloat(item.betrag) || 0), 0);
                            return `${kontostand.toFixed(2)} €`;
                          })()}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: 'rgba(255, 255, 255, 0.4)',
                          marginTop: '0.5rem'
                        }}>
                          {(() => {
                            const unbezahlt = finanzDaten.filter(item => !item.bezahlt).length;
                            const bezahlt = finanzDaten.filter(item => item.bezahlt).length;
                            return `${unbezahlt} offen, ${bezahlt} bezahlt`;
                          })()}
                        </div>
                      </div>

                      <div style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 215, 0, 0.2)'
                      }}>
                        <div style={{
                          fontSize: '0.75rem',
                          color: 'rgba(255, 255, 255, 0.6)',
                          marginBottom: '0.5rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Letzter bezahlter Betrag
                        </div>
                        <div style={{
                          color: '#ffffff',
                          fontSize: '1.1rem',
                          fontWeight: '600'
                        }}>
                          {(() => {
                            const letzteZahlung = finanzDaten
                              .filter(z => z.bezahlt && z.zahlungsdatum)
                              .sort((a, b) => new Date(b.zahlungsdatum) - new Date(a.zahlungsdatum))[0];

                            if (letzteZahlung) {
                              return (
                                <>
                                  <div style={{fontSize: '1.2rem', marginBottom: '0.25rem'}}>
                                    {parseFloat(letzteZahlung.betrag).toFixed(2)} €
                                  </div>
                                  <div style={{fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)'}}>
                                    am {new Date(letzteZahlung.zahlungsdatum).toLocaleDateString('de-DE')}
                                  </div>
                                </>
                              );
                            }
                            return <div style={{color: 'rgba(255, 255, 255, 0.5)'}}>Keine Zahlungen vorhanden</div>;
                          })()}
                        </div>
                      </div>

                      <div style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(255, 215, 0, 0.2)'
                      }}>
                        <div style={{
                          fontSize: '0.75rem',
                          color: 'rgba(255, 255, 255, 0.6)',
                          marginBottom: '0.5rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          Kommender Betrag
                        </div>
                        <div style={{
                          color: '#ffffff',
                          fontSize: '1.1rem',
                          fontWeight: '600'
                        }}>
                          {(() => {
                            const aktiveVertraege = verträge.filter(v => v.status === 'aktiv');
                            if (aktiveVertraege.length > 0) {
                              const gesamtBeitrag = aktiveVertraege.reduce((sum, v) => {
                                return sum + (parseFloat(v.monatsbeitrag) || 0);
                              }, 0);
                              return (
                                <>
                                  <div style={{fontSize: '1.2rem', marginBottom: '0.25rem'}}>
                                    {gesamtBeitrag.toFixed(2)} €
                                  </div>
                                  <div style={{fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)'}}>
                                    monatlich ({aktiveVertraege.length} {aktiveVertraege.length === 1 ? 'Vertrag' : 'Verträge'})
                                  </div>
                                </>
                              );
                            }
                            return <div style={{color: 'rgba(255, 255, 255, 0.5)'}}>Kein aktiver Vertrag</div>;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "medizinisch" && (
            <MemberMedicalTab
              mitglied={mitglied}
              updatedData={updatedData}
              editMode={editMode}
              handleChange={handleChange}
              CustomSelect={CustomSelect}
              allergien={allergien}
              allergienArchiv={allergienArchiv}
              newAllergie={newAllergie}
              setNewAllergie={setNewAllergie}
              addAllergie={addAllergie}
              removeAllergie={removeAllergie}
            />
          )}

          {activeTab === "fortschritt" && (
            <div className="fortschritt-tab-container">
              <MitgliedFortschritt mitgliedId={id} />
            </div>
          )}

          {activeTab === "dokumente" && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="field-group card">
                <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>Dokumente & Einverständnisse</h3>
                {(() => {
                  // 🔍 Hole Daten aus dem aktiven Vertrag (falls vorhanden), sonst aus mitglied
                  const activeContract = verträge.find(v => v.status === 'aktiv') || verträge[0];
                  const docSource = activeContract || mitglied;

                  // Mapping: Vertrag verwendet andere Feldnamen als mitglied
                  const hausordnung_akzeptiert = docSource.hausordnung_akzeptiert_am ? true : (mitglied.hausordnung_akzeptiert || false);
                  const hausordnung_akzeptiert_am = docSource.hausordnung_akzeptiert_am || mitglied.hausordnung_akzeptiert_am;

                  const datenschutz_akzeptiert = docSource.datenschutz_akzeptiert_am ? true : (mitglied.datenschutz_akzeptiert || false);
                  const datenschutz_akzeptiert_am = docSource.datenschutz_akzeptiert_am || mitglied.datenschutz_akzeptiert_am;

                  const foto_einverstaendnis = docSource.foto_einverstaendnis_datum ? docSource.foto_einverstaendnis : mitglied.foto_einverstaendnis;
                  const foto_einverstaendnis_datum = docSource.foto_einverstaendnis_datum || mitglied.foto_einverstaendnis_datum;

                  const agb_akzeptiert = docSource.agb_akzeptiert_am ? true : (mitglied.agb_akzeptiert || false);
                  const agb_akzeptiert_am = docSource.agb_akzeptiert_am || mitglied.agb_akzeptiert_am;

                  const haftungsausschluss_akzeptiert = docSource.haftungsausschluss_datum ? docSource.haftungsausschluss_akzeptiert : mitglied.haftungsausschluss_akzeptiert;
                  const haftungsausschluss_datum = docSource.haftungsausschluss_datum || mitglied.haftungsausschluss_datum;

                  const gesundheitserklaerung = docSource.gesundheitserklaerung_datum ? docSource.gesundheitserklaerung : mitglied.gesundheitserklaerung;
                  const gesundheitserklaerung_datum = docSource.gesundheitserklaerung_datum || mitglied.gesundheitserklaerung_datum;

                  return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeContract && (
                    <div style={{
                      padding: '0.75rem',
                      background: 'rgba(33, 150, 243, 0.1)',
                      borderRadius: '6px',
                      border: '1px solid rgba(33, 150, 243, 0.3)',
                      fontSize: '0.8rem',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}>
                      ℹ️ Daten werden aus dem aktiven Vertrag #{activeContract.personenVertragNr || activeContract.id} geladen
                    </div>
                  )}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <label style={{ fontWeight: 500, fontSize: '0.75rem', margin: 0, textTransform: 'uppercase' }}>Hausordnung akzeptiert:</label>
                    {editMode && isAdmin ? (
                      <input
                        type="checkbox"
                        checked={updatedData.hausordnung_akzeptiert || false}
                        onChange={(e) => handleChange(e, "hausordnung_akzeptiert")}
                        style={{ width: '18px', height: '18px' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`status-badge ${hausordnung_akzeptiert ? 'accepted' : 'missing'}`} style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', textTransform: 'uppercase' }}>
                          {hausordnung_akzeptiert ? "✅ Akzeptiert" : "❌ Fehlt"}
                        </span>
                        {hausordnung_akzeptiert_am && (
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', whiteSpace: 'nowrap' }}>
                            am {new Date(hausordnung_akzeptiert_am).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <label style={{ fontWeight: 500, fontSize: '0.75rem', margin: 0, textTransform: 'uppercase' }}>Datenschutz akzeptiert:</label>
                    {editMode && isAdmin ? (
                      <input
                        type="checkbox"
                        checked={updatedData.datenschutz_akzeptiert || false}
                        onChange={(e) => handleChange(e, "datenschutz_akzeptiert")}
                        style={{ width: '18px', height: '18px' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`status-badge ${datenschutz_akzeptiert ? 'accepted' : 'missing'}`} style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', textTransform: 'uppercase' }}>
                          {datenschutz_akzeptiert ? "✅ Akzeptiert" : "❌ Fehlt"}
                        </span>
                        {datenschutz_akzeptiert_am && (
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', whiteSpace: 'nowrap' }}>
                            am {new Date(datenschutz_akzeptiert_am).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <label style={{ fontWeight: 500, fontSize: '0.75rem', margin: 0, textTransform: 'uppercase' }}>Foto-Einverständnis:</label>
                    {editMode && isAdmin ? (
                      <input
                        type="checkbox"
                        checked={updatedData.foto_einverstaendnis || false}
                        onChange={(e) => handleChange(e, "foto_einverstaendnis")}
                        style={{ width: '18px', height: '18px' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`status-badge ${foto_einverstaendnis ? 'accepted' : 'missing'}`} style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', textTransform: 'uppercase' }}>
                          {foto_einverstaendnis ? "✅ Erteilt" : "❌ Fehlt"}
                        </span>
                        {foto_einverstaendnis_datum && (
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', whiteSpace: 'nowrap' }}>
                            am {new Date(foto_einverstaendnis_datum).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <label style={{ fontWeight: 500, fontSize: '0.75rem', margin: 0, textTransform: 'uppercase' }}>AGB akzeptiert:</label>
                    {editMode && isAdmin ? (
                      <input
                        type="checkbox"
                        checked={updatedData.agb_akzeptiert || false}
                        onChange={(e) => handleChange(e, "agb_akzeptiert")}
                        style={{ width: '18px', height: '18px' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`status-badge ${agb_akzeptiert ? 'accepted' : 'missing'}`} style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', textTransform: 'uppercase' }}>
                          {agb_akzeptiert ? "✅ Akzeptiert" : "❌ Fehlt"}
                        </span>
                        {agb_akzeptiert_am && (
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', whiteSpace: 'nowrap' }}>
                            am {new Date(agb_akzeptiert_am).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <label style={{ fontWeight: 500, fontSize: '0.75rem', margin: 0, textTransform: 'uppercase' }}>Haftungsausschluss:</label>
                    {editMode && isAdmin ? (
                      <input
                        type="checkbox"
                        checked={updatedData.haftungsausschluss_akzeptiert || false}
                        onChange={(e) => handleChange(e, "haftungsausschluss_akzeptiert")}
                        style={{ width: '18px', height: '18px' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`status-badge ${haftungsausschluss_akzeptiert ? 'accepted' : 'missing'}`} style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', textTransform: 'uppercase' }}>
                          {haftungsausschluss_akzeptiert ? "✅ Akzeptiert" : "❌ Fehlt"}
                        </span>
                        {haftungsausschluss_datum && (
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', whiteSpace: 'nowrap' }}>
                            am {new Date(haftungsausschluss_datum).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <label style={{ fontWeight: 500, fontSize: '0.75rem', margin: 0, textTransform: 'uppercase' }}>Gesundheitserklärung:</label>
                    {editMode && isAdmin ? (
                      <input
                        type="checkbox"
                        checked={updatedData.gesundheitserklaerung || false}
                        onChange={(e) => handleChange(e, "gesundheitserklaerung")}
                        style={{ width: '18px', height: '18px' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span className={`status-badge ${gesundheitserklaerung ? 'accepted' : 'missing'}`} style={{ fontSize: '0.75rem', padding: '0.35rem 0.75rem', textTransform: 'uppercase' }}>
                          {gesundheitserklaerung ? "✅ Abgegeben" : "❌ Fehlt"}
                        </span>
                        {gesundheitserklaerung_datum && (
                          <span style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)', whiteSpace: 'nowrap' }}>
                            am {new Date(gesundheitserklaerung_datum).toLocaleDateString('de-DE')}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '6px',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <label style={{ fontWeight: 500, fontSize: '0.75rem', margin: 0, textTransform: 'uppercase' }}>Vereinsordnung Datum:</label>
                    {editMode && isAdmin ? (
                      <input
                        type="date"
                        value={toInputDate(updatedData.vereinsordnung_datum)}
                        onChange={(e) => handleChange(e, "vereinsordnung_datum")}
                        style={{ padding: '0.35rem', fontSize: '0.75rem' }}
                      />
                    ) : (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#FFD700' }}>
                        {mitglied.vereinsordnung_datum
                          ? new Date(mitglied.vereinsordnung_datum).toLocaleDateString("de-DE")
                          : "15.1.2023"
                        }
                      </span>
                    )}
                  </div>
                </div>
                  ); // Ende des return
                })()} {/* Ende der IIFE */}
              </div>

              {/* Bestätigte Dokumenten-Benachrichtigungen */}
              {confirmedNotifications.length > 0 && (
                <div className="field-group card">
                  <h3 style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>✅ Bestätigte Dokumente</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {confirmedNotifications.map((notification) => {
                      const metadata = notification.metadata || {};
                      return (
                        <div
                          key={notification.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.75rem',
                            background: 'rgba(34, 197, 94, 0.1)',
                            borderRadius: '6px',
                            border: '1px solid rgba(34, 197, 94, 0.3)'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                              {notification.subject}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                              {metadata.document_title && `${metadata.document_title} `}
                              {metadata.document_version && `(Version ${metadata.document_version})`}
                            </div>
                          </div>
                          <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: '0.25rem'
                          }}>
                            <span style={{
                              fontSize: '0.7rem',
                              color: 'rgba(34, 197, 94, 0.9)',
                              fontWeight: 600,
                              textTransform: 'uppercase'
                            }}>
                              ✓ Bestätigt
                            </span>
                            <span style={{
                              fontSize: '0.7rem',
                              color: 'rgba(255, 255, 255, 0.5)',
                              whiteSpace: 'nowrap'
                            }}>
                              {new Date(notification.confirmed_at).toLocaleString('de-DE', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="info-box" style={{ marginTop: '1rem' }}>
                    <p>ℹ️ <strong>Hinweis:</strong> Hier werden alle vom Mitglied bestätigten Dokumente mit Datum und Uhrzeit der Bestätigung angezeigt.</p>
                  </div>
                </div>
              )}

              {/* 🔒 ADMIN-ONLY: SEPA-Lastschriftmandat (Banking Information) */}
              {isAdmin && sepaMandate && (
                <div className="field-group card bank-sub-tab-content">
                  <h3 style={{ 
                    fontSize: '0.8rem', 
                    color: '#FFD700', 
                    marginBottom: '1rem',
                    textTransform: 'uppercase',
                    fontWeight: '700',
                    letterSpacing: '0.5px',
                    borderBottom: '1px solid rgba(255, 215, 0, 0.3)',
                    paddingBottom: '0.75rem'
                  }}>
                    Aktuelles SEPA-Lastschriftmandat
                  </h3>
                  
                  <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: '1.5rem',
                  padding: '1.25rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  marginBottom: '1rem'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Header mit Referenz und Status */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.75rem'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ 
                          fontSize: '0.8rem', 
                          color: '#e74c3c',
                          fontWeight: '600'
                        }}>
                          {sepaMandate.mandatsreferenz}
                        </span>
                        <span style={{ 
                          fontSize: '0.8rem', 
                          color: 'rgba(255, 255, 255, 0.7)'
                        }}>
                          STATUS: AKTIV
                        </span>
                      </div>
                    </div>

                    {/* Mandat Details */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      gap: '0.75rem 1rem',
                      fontSize: '0.8rem'
                    }}>
                      <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>Erstellt:</span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                        {new Date(sepaMandate.erstellungsdatum).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </span>

                      <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>Gläubiger-ID:</span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.9)', wordBreak: 'break-word' }}>
                        {sepaMandate.glaeubiger_id || 'N/A'}
                      </span>

                      <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>IBAN:</span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontFamily: 'monospace' }}>
                        {sepaMandate.iban ? `${sepaMandate.iban.slice(0, 4)} **** ${sepaMandate.iban.slice(-4)}` : 'N/A'}
                      </span>

                      <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>Kontoinhaber:</span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.9)' }}>
                        {sepaMandate.kontoinhaber || 'N/A'}
                      </span>

                      <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: '500' }}>BIC:</span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.9)', fontFamily: 'monospace' }}>
                        {sepaMandate.bic || 'N/A'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    gap: '0.5rem'
                  }}>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => downloadSepaMandate()}
                      title="PDF herunterladen"
                      style={{
                        padding: '0.5rem 1rem',
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                        background: 'transparent',
                        border: '1px solid rgba(255, 215, 0, 0.2)',
                        color: 'rgba(255, 255, 255, 0.7)',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.4)';
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.2)';
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                      }}
                    >
                      PDF
                    </button>
                  </div>
                </div>

                  <div className="info-box" style={{ marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.8rem', margin: 0 }}>
                      <strong>Hinweis:</strong> Dieses Mandat ist derzeit aktiv und wird für SEPA-Lastschriften verwendet.
                    </p>
                  </div>
                </div>
              )}

              {/* 🔒 ADMIN-ONLY: Archivierte SEPA-Mandate */}
              {isAdmin && archivierteMandate.length > 0 && (
                <div className="field-group card">
                  <h3>Archivierte & Widerrufene SEPA-Mandate</h3>
                  <div className="archivierte-mandate-liste">
                    {archivierteMandate.map((mandat, index) => (
                      <div key={mandat.mandat_id} className="archiviertes-mandat-item">
                        <div className="mandat-info">
                          <div className="mandat-header">
                            <span className="mandatsreferenz">
                              🔖 {mandat.mandatsreferenz}
                            </span>
                            <span className="archiviert-datum">
                              {mandat.archiviert_am
                                ? `Archiviert: ${new Date(mandat.archiviert_am).toLocaleDateString('de-DE')}`
                                : mandat.widerruf_datum
                                  ? `Widerrufen: ${new Date(mandat.widerruf_datum).toLocaleDateString('de-DE')}`
                                  : 'Nicht mehr aktiv'
                              }
                            </span>
                          </div>
                          <div className="mandat-details">
                            <span>Erstellt: {new Date(mandat.erstellungsdatum).toLocaleDateString('de-DE')}</span>
                            <span>Status: {mandat.status === 'widerrufen' ? '🚫 Widerrufen' : '📦 Archiviert'}</span>
                            {mandat.archiviert_grund && (
                              <span>Grund: {mandat.archiviert_grund}</span>
                            )}
                          </div>
                          <div className="mandat-banking">
                            <span>IBAN: {mandat.iban ? `${mandat.iban.slice(0, 4)}****${mandat.iban.slice(-4)}` : 'N/A'}</span>
                            <span>Kontoinhaber: {mandat.kontoinhaber}</span>
                          </div>
                        </div>
                        <div className="mandat-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => downloadArchiviertesMandat(
                              mandat.mandat_id,
                              mandat.vorname,
                              mandat.nachname,
                              mandat.erstellungsdatum
                            )}
                            title="PDF herunterladen"
                          >
                            📄 PDF
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="info-box">
                    <p>ℹ️ <strong>Hinweis:</strong> Archivierte und widerrufene SEPA-Mandate bleiben dauerhaft gespeichert und können jederzeit als PDF heruntergeladen werden.</p>
                  </div>
                </div>
              )}

              {/* Dokumente aus Vorlagen generieren - NUR FÜR ADMINS */}
              {isAdmin && (
                <div className="field-group card">
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Dokumente aus Vorlagen generieren</h3>
                  {verfügbareVorlagen.length === 0 ? (
                    <div className="info-box">
                      <p>ℹ️ Keine Vorlagen verfügbar. Erstellen Sie zuerst Vorlagen im Bereich "Vertragsdokumente".</p>
                    </div>
                  ) : (
                    <div>
                      <div className="info-box" style={{ marginBottom: '1rem' }}>
                        <p>ℹ️ Wählen Sie eine Vorlage aus, um ein PDF mit den aktuellen Daten dieses Mitglieds zu erstellen.</p>
                      </div>
                      <div style={{
                        display: 'grid',
                        gap: '1rem',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))'
                      }}>
                        {verfügbareVorlagen.map((vorlage) => (
                          <div
                            key={vorlage.id}
                            style={{
                              padding: '1rem',
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              borderRadius: '8px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              transition: 'all 0.3s ease'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'flex-start',
                              marginBottom: '0.75rem'
                            }}>
                              <div style={{ flex: 1 }}>
                                <h4 style={{
                                  margin: '0 0 0.5rem 0',
                                  fontSize: '1.1rem',
                                  color: '#FFD700'
                                }}>
                                  {vorlage.name}
                                </h4>
                                {vorlage.beschreibung && (
                                  <p style={{
                                    margin: 0,
                                    fontSize: '0.85rem',
                                    color: 'rgba(255, 255, 255, 0.6)'
                                  }}>
                                    {vorlage.beschreibung}
                                  </p>
                                )}
                                <div style={{
                                  marginTop: '0.5rem',
                                  fontSize: '0.8rem',
                                  color: 'rgba(255, 255, 255, 0.5)'
                                }}>
                                  <span style={{
                                    padding: '0.2rem 0.5rem',
                                    background: 'rgba(255, 215, 0, 0.1)',
                                    borderRadius: '4px',
                                    marginRight: '0.5rem'
                                  }}>
                                    {vorlage.template_type || 'vertrag'}
                                  </span>
                                  {vorlage.is_default && (
                                    <span style={{
                                      padding: '0.2rem 0.5rem',
                                      background: 'rgba(34, 197, 94, 0.1)',
                                      borderRadius: '4px',
                                      color: '#22c55e'
                                    }}>
                                      ⭐ Standard
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => generateDocumentFromTemplate(vorlage.id, vorlage.name)}
                                disabled={generatingDocument}
                                style={{ 
                                  flex: 1,
                                  background: 'transparent',
                                  border: '1px solid rgba(255, 215, 0, 0.2)',
                                  color: 'rgba(255, 255, 255, 0.7)',
                                  transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => {
                                  if (!e.currentTarget.disabled) {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.4)';
                                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!e.currentTarget.disabled) {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.2)';
                                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                                  }
                                }}
                              >
                                {generatingDocument ? 'Generiere...' : 'PDF erstellen'}
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => downloadTemplateAsPDF(vorlage.id, vorlage.name)}
                                style={{ 
                                  flex: 1,
                                  background: 'transparent',
                                  border: '1px solid rgba(255, 215, 0, 0.2)',
                                  color: 'rgba(255, 255, 255, 0.7)',
                                  transition: 'all 0.3s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                  e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.4)';
                                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.2)';
                                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                                }}
                                title="Vorlage als PDF herunterladen"
                              >
                                Vorlage
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Liste der gespeicherten Dokumente */}
              <div className="field-group card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Gespeicherte Dokumente</h3>
                {mitgliedDokumente.length === 0 ? (
                  <div className="info-box">
                    <p>ℹ️ Keine Dokumente vorhanden. {isAdmin ? 'Generieren Sie Dokumente aus den Vorlagen oben.' : 'Es wurden noch keine Dokumente für Sie erstellt.'}</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {mitgliedDokumente.filter(dok => !dok.dokumentname.startsWith('Rechnung')).map((dok) => (
                      <div
                        key={dok.id}
                        style={{
                          padding: '1rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          background: '#f9fafb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                            {dok.dokumentname}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            Erstellt: {new Date(dok.erstellt_am).toLocaleDateString('de-DE', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {dok.erstellt_von_name && ` von ${dok.erstellt_von_name}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="dashboard-button"
                            onClick={() => downloadMitgliedDokument(dok.id, dok.dokumentname)}
                            title="Dokument herunterladen"
                          >
                            Download
                          </button>
                          {isAdmin && (
                            <button
                              className="dashboard-button"
                              onClick={() => deleteMitgliedDokument(dok)}
                              title="Dokument löschen"
                            >
                              Löschen
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rechnungen */}
              <div className="field-group card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Rechnungen</h3>
                {rechnungen.length === 0 ? (
                  <div className="info-box">
                    <p>ℹ️ Keine Rechnungen vorhanden.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {rechnungen.map((rechnung) => (
                      <div
                        key={rechnung.rechnung_id}
                        style={{
                          padding: '1rem',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          background: '#f9fafb',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
                            {rechnung.rechnungsnummer}
                          </div>
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            Datum: {new Date(rechnung.datum).toLocaleDateString('de-DE')} | 
                            Betrag: {Number(rechnung.betrag).toFixed(2)} € | 
                            Status: {rechnung.status_text || rechnung.status}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="dashboard-button"
                            onClick={() => window.open(`/api/rechnungen/${rechnung.rechnung_id}/pdf`, '_blank')}
                            title="Rechnung als PDF anzeigen"
                          >
                            PDF anzeigen
                          </button>
                          {isAdmin && (
                            <button
                              className="dashboard-button"
                              onClick={() => deleteRechnung(rechnung)}
                              title="Rechnung löschen"
                            >
                              Löschen
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}


          {/* Modal für SEPA-Mandat-Details */}
          {showMandateModal && selectedMandate && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.75)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999
            }} onClick={() => setShowMandateModal(false)}>
              <div style={{
                background: '#1a1a1a',
                borderRadius: '12px',
                padding: '2rem',
                maxWidth: '600px',
                width: '90%',
                maxHeight: '80vh',
                overflow: 'auto',
                border: '1px solid rgba(255, 215, 0, 0.3)'
              }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0, fontSize: '1.3rem', color: '#FFD700' }}>
                    🏦 SEPA-Mandat Details
                  </h2>
                  <button
                    onClick={() => setShowMandateModal(false)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      color: '#fff',
                      padding: '0.25rem 0.5rem'
                    }}
                  >
                    →
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>
                      MANDATSREFERENZ
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#FFD700' }}>
                      {selectedMandate.mandatsreferenz}
                    </div>
                  </div>

                  {selectedMandate.status && (
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>
                        STATUS
                      </div>
                      <div style={{ fontSize: '0.9rem', color: selectedMandate.status === 'aktiv' ? '#28a745' : '#6c757d' }}>
                        {selectedMandate.status === 'aktiv' ? '✅ Aktiv' : selectedMandate.status === 'widerrufen' ? '🚫 Widerrufen' : '📦 Archiviert'}
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>
                      ERSTELLT AM
                    </div>
                    <div style={{ fontSize: '0.9rem' }}>
                      {new Date(selectedMandate.erstellungsdatum).toLocaleDateString('de-DE')}
                    </div>
                  </div>

                  {selectedMandate.glaeubiger_id && (
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>
                        GLÄUBIGER-ID
                      </div>
                      <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
                        {selectedMandate.glaeubiger_id}
                      </div>
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>
                      KONTOINHABER
                    </div>
                    <div style={{ fontSize: '0.9rem' }}>
                      {selectedMandate.kontoinhaber || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>
                      IBAN
                    </div>
                    <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
                      {selectedMandate.iban || 'N/A'}
                    </div>
                  </div>

                  {selectedMandate.bic && (
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>
                        BIC
                      </div>
                      <div style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
                        {selectedMandate.bic}
                      </div>
                    </div>
                  )}

                  {selectedMandate.archiviert_am && (
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>
                        ARCHIVIERT AM
                      </div>
                      <div style={{ fontSize: '0.9rem' }}>
                        {new Date(selectedMandate.archiviert_am).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                  )}

                  {selectedMandate.widerruf_datum && (
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>
                        WIDERRUFEN AM
                      </div>
                      <div style={{ fontSize: '0.9rem' }}>
                        {new Date(selectedMandate.widerruf_datum).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                  )}

                  {selectedMandate.archiviert_grund && (
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.25rem' }}>
                        GRUND
                      </div>
                      <div style={{ fontSize: '0.9rem' }}>
                        {selectedMandate.archiviert_grund}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowMandateModal(false)}
                    style={{ fontSize: '0.9rem' }}
                  >
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "familie" && (
            <MemberFamilyTab
              mitglied={mitglied}
              updatedData={updatedData}
              editMode={editMode}
              handleChange={handleChange}
              CustomSelect={CustomSelect}
            />
          )}


          {activeTab === "vertrag" && (
            <div style={{
              width: '100%',
              maxWidth: '1400px',
              margin: '0 auto',
              padding: '1rem'
            }}>
              {/* CONTRACT SECTION - COMPLETELY NEW DESIGN */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 30, 0.98) 100%)',
                borderRadius: '16px',
                padding: '2rem',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}>
                {/* HEADER WITH NEW CONTRACT BUTTON */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '2rem',
                  paddingBottom: '1rem',
                  borderBottom: '2px solid rgba(255, 215, 0, 0.2)'
                }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.8rem',
                    fontWeight: '700',
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text'
                  }}>
                    Vertragsverwaltung
                  </h3>

                  {isAdmin && (
                    <>
                      <button
                        className={`vertragsfrei-button ${mitglied?.vertragsfrei ? 'vertragsfrei-button-active' : ''}`}
                        onClick={async () => {
                          const isVertragsfrei = !mitglied?.vertragsfrei;
                          const grund = isVertragsfrei
                            ? prompt('Grund für Vertragsfreistellung:\n(z.B. Ehrenmitglied, Familie, Sponsor, etc.)')
                            : null;

                          if (isVertragsfrei && !grund) {
                            return;
                          }

                          try {
                            await axios.put(`/mitglieddetail/${mitglied.mitglied_id}`, {
                              vertragsfrei: isVertragsfrei ? 1 : 0,
                              vertragsfrei_grund: grund || null
                            });

                            setMitglied(prev => ({
                              ...prev,
                              vertragsfrei: isVertragsfrei ? 1 : 0,
                              vertragsfrei_grund: grund || null
                            }));

                            alert(isVertragsfrei
                              ? '✅ Mitglied wurde als vertragsfrei markiert'
                              : '✅ Vertragsfreistellung wurde aufgehoben'
                            );
                          } catch (error) {
                            console.error('Fehler beim Aktualisieren:', error);
                            alert('❌ Fehler beim Speichern der Vertragsfreistellung');
                          }
                        }}
                      >
                        {mitglied?.vertragsfrei
                          ? '✅ Vertragsfrei'
                          : '📝 Vertragsfrei stellen'}
                      </button>

                      <button
                        className="neuer-vertrag-button"
                        onClick={() => setShowNewVertrag(true)}
                      >
                        ➕ Neuer Vertrag
                      </button>
                    </>
                  )}
                </div>

                {/* VERTRAGSFREI GRUND */}
                {isAdmin && mitglied?.vertragsfrei && mitglied?.vertragsfrei_grund && (
                  <div style={{
                    marginBottom: '1.5rem',
                    padding: '1rem 1.5rem',
                    background: 'rgba(52, 152, 219, 0.1)',
                    borderRadius: '8px',
                    border: '1px solid rgba(52, 152, 219, 0.3)'
                  }}>
                    <div style={{
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#5dade2',
                      marginBottom: '0.5rem'
                    }}>
                      Mitglied ist aus folgendem Grund Beitrags- bzw. Vertragsfrei
                    </div>
                    <div style={{
                      fontSize: '0.9rem',
                      color: '#5dade2'
                    }}>
                      <strong>Grund:</strong> {mitglied.vertragsfrei_grund}
                    </div>
                  </div>
                )}

                {/* CONTRACTS GRID */}
                {verträge.length > 0 ? (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
                    gap: '1.5rem'
                  }}>
                    {verträge.map(vertrag => (
                      <div
                        key={vertrag.id}
                        className="vertrag-card"
                        style={{
                          background: 'linear-gradient(135deg, rgba(40, 40, 50, 0.6) 0%, rgba(30, 30, 40, 0.8) 100%)',
                          borderRadius: '12px',
                          padding: '1.5rem',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
                          transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-4px)';
                          e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3)';
                          e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        }}
                      >
                        {/* CONTRACT HEADER */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '1rem',
                          paddingBottom: '0.75rem',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          <div>
                            <h4 style={{
                              margin: '0 0 0.25rem 0',
                              fontSize: '1.2rem',
                              fontWeight: '600',
                              color: '#FFD700'
                            }}>
                              📄 Vertrag #{vertrag.personenVertragNr}
                            </h4>
                            <span style={{
                              fontSize: '0.8rem',
                              color: 'rgba(255, 255, 255, 0.5)'
                            }}>
                              Erstellt: {new Date(vertrag.created_at || vertrag.vertragsbeginn).toLocaleDateString('de-DE')}
                            </span>
                          </div>

                          <span style={{
                            padding: '0.4rem 0.8rem',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            whiteSpace: 'nowrap',
                            background: vertrag.geloescht ? 'rgba(128, 128, 128, 0.15)' :
                                       vertrag.status === 'aktiv' ? 'rgba(46, 213, 115, 0.15)' :
                                       vertrag.status === 'gekuendigt' ? 'rgba(255, 193, 7, 0.15)' :
                                       vertrag.status === 'ruhepause' ? 'rgba(52, 152, 219, 0.15)' :
                                       'rgba(231, 76, 60, 0.15)',
                            color: vertrag.geloescht ? '#808080' :
                                   vertrag.status === 'aktiv' ? '#2ed573' :
                                   vertrag.status === 'gekuendigt' ? '#ffc107' :
                                   vertrag.status === 'ruhepause' ? '#3498db' :
                                   '#e74c3c',
                            border: `1px solid ${vertrag.geloescht ? 'rgba(128, 128, 128, 0.3)' :
                                                 vertrag.status === 'aktiv' ? 'rgba(46, 213, 115, 0.3)' :
                                                 vertrag.status === 'gekuendigt' ? 'rgba(255, 193, 7, 0.3)' :
                                                 vertrag.status === 'ruhepause' ? 'rgba(52, 152, 219, 0.3)' :
                                                 'rgba(231, 76, 60, 0.3)'}`
                          }}>
                            {vertrag.geloescht ? '🗑️ GELÖSCHT' :
                             vertrag.status === 'aktiv' ? '✅ AKTIV' :
                             vertrag.status === 'gekuendigt' ? '❌ GEKÜNDIGT' :
                             vertrag.status === 'ruhepause' ? '⏸️ RUHEPAUSE' : '⏹️ BEENDET'}
                          </span>
                        </div>

                        {/* CONTRACT INFO */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.6rem',
                          marginBottom: '1.25rem'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.9rem'
                          }}>
                            <span style={{ fontSize: '1.1rem' }}>📄</span>
                            <span style={{ color: 'rgba(255, 255, 255, 0.6)', minWidth: '80px' }}>TARIF:</span>
                            <strong style={{ color: '#fff' }}>
                              {vertrag.tarif_name || 'Keine Angabe'}
                              {vertrag.monatsbeitrag && ` - €${parseFloat(vertrag.monatsbeitrag).toFixed(2)}/Monat`}
                            </strong>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.9rem'
                          }}>
                            <span style={{ fontSize: '1.1rem' }}>📄</span>
                            <span style={{ color: 'rgba(255, 255, 255, 0.6)', minWidth: '80px' }}>LAUFZEIT:</span>
                            <strong style={{ color: '#fff' }}>
                              {vertrag.vertragsbeginn && vertrag.vertragsende
                                ? `${new Date(vertrag.vertragsbeginn).toLocaleDateString('de-DE')} bis ${new Date(vertrag.vertragsende).toLocaleDateString('de-DE')}`
                                : 'Keine Angabe'}
                            </strong>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.9rem'
                          }}>
                            <span style={{ fontSize: '1.1rem' }}>📄</span>
                            <span style={{ color: 'rgba(255, 255, 255, 0.6)', minWidth: '80px' }}>ZAHLUNG:</span>
                            <strong style={{ color: '#fff' }}>
                              {vertrag.billing_cycle ? translateBillingCycle(vertrag.billing_cycle) : 'Keine Angabe'}
                            </strong>
                          </div>
                          {/* Zahlungsart */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            fontSize: '0.9rem'
                          }}>
                            <span style={{ fontSize: '1.1rem' }}>💳</span>
                            <span style={{ color: 'rgba(255, 255, 255, 0.6)', minWidth: '80px' }}>ZAHLART:</span>
                            <strong style={{ color: '#fff' }}>
                              {vertrag.payment_method === 'direct_debit' ? '🏦 Lastschrift' :
                               vertrag.payment_method === 'bank_transfer' ? '💳 Überweisung' :
                               vertrag.payment_method === 'cash' ? '💵 Bar' :
                               vertrag.payment_method || 'Keine Angabe'}
                            </strong>
                          </div>
                          {/* Aufnahmegebühr */}
                          {vertrag.aufnahmegebuehr_cents && vertrag.aufnahmegebuehr_cents > 0 && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.9rem'
                            }}>
                              <span style={{ fontSize: '1.1rem' }}>💵</span>
                              <span style={{ color: 'rgba(255, 255, 255, 0.6)', minWidth: '80px' }}>AUFNAHME:</span>
                              <strong style={{ color: '#ff9800' }}>
                                €{(vertrag.aufnahmegebuehr_cents / 100).toFixed(2)}
                              </strong>
                            </div>
                          )}
                          {/* Kündigungsfrist */}
                          {vertrag.kuendigungsfrist_monate && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.9rem'
                            }}>
                              <span style={{ fontSize: '1.1rem' }}>⏰</span>
                              <span style={{ color: 'rgba(255, 255, 255, 0.6)', minWidth: '80px' }}>KÜNDIGUNG:</span>
                              <strong style={{ color: '#fff' }}>
                                {vertrag.kuendigungsfrist_monate} {vertrag.kuendigungsfrist_monate === 1 ? 'Monat' : 'Monate'} Frist
                              </strong>
                            </div>
                          )}
                          {/* Mindestlaufzeit */}
                          {vertrag.mindestlaufzeit_monate && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.9rem'
                            }}>
                              <span style={{ fontSize: '1.1rem' }}>⏱️</span>
                              <span style={{ color: 'rgba(255, 255, 255, 0.6)', minWidth: '80px' }}>MIN.LAUFZEIT:</span>
                              <strong style={{ color: '#fff' }}>
                                {vertrag.mindestlaufzeit_monate} {vertrag.mindestlaufzeit_monate === 1 ? 'Monat' : 'Monate'}
                              </strong>
                            </div>
                          )}
                          {vertrag.kuendigung_eingegangen && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.9rem',
                              padding: '0.5rem',
                              background: 'rgba(255, 193, 7, 0.1)',
                              borderRadius: '6px',
                              border: '1px solid rgba(255, 193, 7, 0.3)'
                            }}>
                              <span style={{ fontSize: '1.1rem' }}>📄</span>
                              <span style={{ color: '#ffc107' }}>Kündigung eingegangen:</span>
                              <strong style={{ color: '#ffc107' }}>
                                {new Date(vertrag.kuendigung_eingegangen).toLocaleDateString('de-DE')}
                              </strong>
                            </div>
                          )}
                          {vertrag.status === 'ruhepause' && vertrag.ruhepause_von && vertrag.ruhepause_bis && (
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              fontSize: '0.9rem',
                              padding: '0.5rem',
                              background: 'rgba(52, 152, 219, 0.15)',
                              borderRadius: '6px',
                              border: '1px solid rgba(52, 152, 219, 0.4)'
                            }}>
                              <span style={{ fontSize: '1.1rem' }}>⏸️</span>
                              <span style={{ color: '#3498db' }}>Ruhepause:</span>
                              <strong style={{ color: '#3498db' }}>
                                {new Date(vertrag.ruhepause_von).toLocaleDateString('de-DE')} bis {new Date(vertrag.ruhepause_bis).toLocaleDateString('de-DE')}
                              </strong>
                            </div>
                          )}
                        </div>

                        {/* CONTRACT ACTIONS */}
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '0.5rem'
                        }}>
                          {/* PDF BUTTON (Dokument-ähnliche Ansicht) */}
                          <button
                            onClick={() => {
                              setSelectedVertrag(vertrag);
                              setShowVertragDetails(true);
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(244, 67, 54, 0.3)';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(244, 67, 54, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(244, 67, 54, 0.15)';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                            style={{
                              background: 'rgba(244, 67, 54, 0.15)',
                              color: '#f44336',
                              border: '1px solid rgba(244, 67, 54, 0.4)',
                              borderRadius: '8px',
                              padding: '0.6rem 1rem',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}
                          >
                            📄 PDF
                          </button>

                          {/* DETAILS BUTTON (Strukturierte Datenansicht) */}
                          <button
                            onClick={() => {
                              setSelectedVertrag(vertrag);
                              setShowStructuredDetails(true);
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(33, 150, 243, 0.3)';
                              e.currentTarget.style.transform = 'translateY(-2px)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(33, 150, 243, 0.3)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(33, 150, 243, 0.15)';
                              e.currentTarget.style.transform = 'translateY(0)';
                              e.currentTarget.style.boxShadow = 'none';
                            }}
                            style={{
                              background: 'rgba(33, 150, 243, 0.15)',
                              color: '#2196F3',
                              border: '1px solid rgba(33, 150, 243, 0.4)',
                              borderRadius: '8px',
                              padding: '0.6rem 1rem',
                              fontSize: '0.85rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}
                          >
                            🔍 Details
                          </button>

                          {/* ADMIN-ONLY BUTTONS */}
                          {isAdmin && (
                            <>
                              {/* EDIT BUTTON */}
                              <button
                                onClick={() => setEditingVertrag(vertrag)}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 215, 0, 0.3)';
                                  e.currentTarget.style.transform = 'translateY(-2px)';
                                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 215, 0, 0.15)';
                                  e.currentTarget.style.transform = 'translateY(0)';
                                  e.currentTarget.style.boxShadow = 'none';
                                }}
                                style={{
                                  background: 'rgba(255, 215, 0, 0.15)',
                                  color: '#FFD700',
                                  border: '1px solid rgba(255, 215, 0, 0.4)',
                                  borderRadius: '8px',
                                  padding: '0.6rem 1rem',
                                  fontSize: '0.85rem',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.4rem'
                                }}
                              >
                                ✏️ Bearbeiten
                              </button>

                              {/* STATUS ACTION BUTTONS */}
                              {vertrag.status === 'aktiv' && (
                                <>
                                  <button
                                    onClick={() => handleVertragAction(vertrag.id, 'ruhepause')}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'rgba(255, 193, 7, 0.3)';
                                      e.currentTarget.style.transform = 'translateY(-2px)';
                                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 193, 7, 0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'rgba(255, 193, 7, 0.15)';
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                    style={{
                                      background: 'rgba(255, 193, 7, 0.15)',
                                      color: '#ffc107',
                                      border: '1px solid rgba(255, 193, 7, 0.4)',
                                      borderRadius: '8px',
                                      padding: '0.6rem 1rem',
                                      fontSize: '0.85rem',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.4rem'
                                    }}
                                  >
                                    ⏸️ Ruhepause
                                  </button>
                                  <button
                                    onClick={() => handleVertragAction(vertrag.id, 'kündigen')}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'rgba(231, 76, 60, 0.3)';
                                      e.currentTarget.style.transform = 'translateY(-2px)';
                                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(231, 76, 60, 0.3)';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'rgba(231, 76, 60, 0.15)';
                                      e.currentTarget.style.transform = 'translateY(0)';
                                      e.currentTarget.style.boxShadow = 'none';
                                    }}
                                    style={{
                                      background: 'rgba(231, 76, 60, 0.15)',
                                      color: '#e74c3c',
                                      border: '1px solid rgba(231, 76, 60, 0.4)',
                                      borderRadius: '8px',
                                      padding: '0.6rem 1rem',
                                      fontSize: '0.85rem',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.4rem'
                                    }}
                                  >
                                    ❌ Kündigen
                                  </button>
                                </>
                              )}
                              {vertrag.status === 'ruhepause' && (
                                <button
                                  onClick={() => handleVertragAction(vertrag.id, 'reaktivieren')}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(46, 213, 115, 0.3)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(46, 213, 115, 0.3)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(46, 213, 115, 0.15)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                  }}
                                  style={{
                                    background: 'rgba(46, 213, 115, 0.15)',
                                    color: '#2ed573',
                                    border: '1px solid rgba(46, 213, 115, 0.4)',
                                    borderRadius: '8px',
                                    padding: '0.6rem 1rem',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                  }}
                                >
                                  ▶️ Reaktivieren
                                </button>
                              )}
                              {vertrag.status === 'gekuendigt' && !vertrag.geloescht && (
                                <button
                                  onClick={() => handleKündigungAufheben(vertrag)}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(46, 213, 115, 0.3)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(46, 213, 115, 0.3)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(46, 213, 115, 0.15)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                  }}
                                  style={{
                                    background: 'rgba(46, 213, 115, 0.15)',
                                    color: '#2ed573',
                                    border: '1px solid rgba(46, 213, 115, 0.4)',
                                    borderRadius: '8px',
                                    padding: '0.6rem 1rem',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                  }}
                                >
                                  🔄 Kündigung aufheben
                                </button>
                              )}
                              {isAdmin && !vertrag.geloescht && (
                                <button
                                  onClick={() => handleVertragLöschen(vertrag)}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(231, 76, 60, 0.3)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(231, 76, 60, 0.3)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(231, 76, 60, 0.15)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                  }}
                                  style={{
                                    background: 'rgba(231, 76, 60, 0.15)',
                                    color: '#e74c3c',
                                    border: '1px solid rgba(231, 76, 60, 0.4)',
                                    borderRadius: '8px',
                                    padding: '0.6rem 1rem',
                                    fontSize: '0.85rem',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.4rem'
                                  }}
                                >
                                  🗑️ Löschen
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* NO CONTRACTS MESSAGE */
                  <div style={{
                    textAlign: 'center',
                    padding: '3rem 1rem',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '12px',
                    border: '2px dashed rgba(255, 255, 255, 0.1)'
                  }}>
                    <p style={{
                      fontSize: '1.1rem',
                      color: 'rgba(255, 255, 255, 0.5)',
                      marginBottom: '1.5rem'
                    }}>
                      Keine Verträge vorhanden
                    </p>
                    {isAdmin && (
                      <button
                        className="neuer-vertrag-button"
                        onClick={() => setShowNewVertrag(true)}
                      >
                        ➕ Ersten Vertrag erstellen
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 10ER-KARTEN VERWALTUNG */}
              <ZehnerkartenVerwaltung
                mitgliedId={mitglied?.mitglied_id}
                mitglied={mitglied}
                isAdmin={isAdmin}
              />
            </div>
          )}

          {activeTab === "anwesenheit" && (
            <div className="anwesenheit-container">
              {/* Hauptstatistiken - Moderne Karten */}
              <div className="anwesenheit-stats-grid">
                <div className="stat-card primary">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-label">Gesamte Anwesenheiten</div>
                    <div className="stat-value">{statistikDaten.totalAnwesenheiten || 0}</div>
                  </div>
                </div>
                
                <div className="stat-card secondary">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-label">Mögliche Trainings</div>
                    <div className="stat-value">{statistikDaten.totalMöglicheAnwesenheiten || 0}</div>
                  </div>
                </div>
                
                <div className="stat-card accent">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-label">Anwesenheitsquote</div>
                    <div className={`stat-value ${statistikDaten.anwesenheitsquote >= 75 ? 'success' : statistikDaten.anwesenheitsquote >= 50 ? 'warning' : 'error'}`}>
                      {statistikDaten.anwesenheitsquote || 0}%
                    </div>
                  </div>
                </div>
                
                <div className="stat-card info">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-label">Letzte Anwesenheit</div>
                    <div className="stat-value">
                      {statistikDaten.letzteAnwesenheit ?
                        new Date(statistikDaten.letzteAnwesenheit).toLocaleDateString("de-DE") :
                        "-"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Detail-Metriken - Kompakte Zeilen */}
              <div className="anwesenheit-details">
                <div className="detail-row">
                  <div className="detail-item">
                    <span className="detail-label">Diesen Monat</span>
                    <span className="detail-value highlight">{statistikDaten.thisMonthAttendances || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">→ Pro Monat (6M)</span>
                    <span className="detail-value">{statistikDaten.avgPerMonth || 0}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Letzte Woche</span>
                    <span className="detail-value">{statistikDaten.lastWeekAttendances || 0}</span>
                  </div>
                </div>

                <div className="detail-row">
                  <div className="detail-item streak">
                    <span className="detail-label">🔥 Streak</span>
                    <span className={`detail-value ${statistikDaten.currentStreak >= 5 ? 'excellent' : statistikDaten.currentStreak >= 3 ? 'good' : 'normal'}`}>
                      {statistikDaten.currentStreak || 0} Trainings in Folge
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">📈 Konsistenz</span>
                    <span className="detail-value">{statistikDaten.consecutiveMonths || 0} Monate</span>
                  </div>
                  {statistikDaten.bestMonth && (
                    <div className="detail-item best">
                      <span className="detail-label">🏆 Bester Monat</span>
                      <span className="detail-value excellent">
                        {statistikDaten.bestMonth.month} ({statistikDaten.bestMonth.count})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Monatliche Übersicht */}
              {statistikDaten.monthlyStats && statistikDaten.monthlyStats.length > 0 && (
                <div className="monthly-overview">
                  <h3>Monatliche Übersicht</h3>
                  <div className="monthly-grid">
                    {statistikDaten.monthlyStats.map((monthStat, index) => (
                      <div key={index} className={`month-item ${monthStat.count === 0 ? 'no-data' : ''}`}>
                        <span className="month-name">{monthStat.month}</span>
                        <span className={`month-count ${monthStat.count >= 8 ? 'excellent' : monthStat.count >= 4 ? 'good' : monthStat.count > 0 ? 'ok' : 'poor'}`}>
                          {monthStat.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Anwesenheitsliste */}
              <div className="anwesenheit-liste">
                <h3>Letzte Anwesenheiten</h3>
                <div className="attendance-grid">
                  {anwesenheitsDaten.filter(a => a.anwesend).length > 0 ? (
                    anwesenheitsDaten
                      .filter(a => a.anwesend)
                      .sort((a, b) => new Date(b.datum) - new Date(a.datum))
                      .slice(0, 24)
                      .map((attendance, index) => (
                        <div key={index} className="attendance-item">
                          <span className="attendance-date">
                            {new Date(attendance.datum).toLocaleDateString("de-DE")}
                          </span>
                        </div>
                      ))
                  ) : (
                    <div className="no-data-message">
                      <span>Keine Anwesenheitsdaten verfügbar</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "finanzen" && (
            <div className="finance-management-container">
              {/* Sub-Tabs für Finanzen - Horizontal mit Sidebar-Design */}
              <div className="finance-sub-tabs" style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1.5rem',
                flexWrap: 'wrap'
              }}>
                <button
                  className={`finance-sub-tab-btn ${financeSubTab === "finanzübersicht" ? "active" : ""}`}
                  onClick={() => setFinanceSubTab("finanzübersicht")}
                >
                  💰 Finanzübersicht
                </button>
                <button
                  className={`finance-sub-tab-btn ${financeSubTab === "zahlungshistorie" ? "active" : ""}`}
                  onClick={() => setFinanceSubTab("zahlungshistorie")}
                >
                  📊 Zahlungshistorie
                </button>
                <button
                  className={`finance-sub-tab-btn ${financeSubTab === "beitraege" ? "active" : ""}`}
                  onClick={() => setFinanceSubTab("beitraege")}
                >
                  💳 Beiträge
                </button>
                <button
                  className={`finance-sub-tab-btn ${financeSubTab === "bank" ? "active" : ""}`}
                  onClick={() => setFinanceSubTab("bank")}
                >
                  🏦 Bank & SEPA
                </button>
              </div>

              {financeSubTab === "finanzübersicht" && (
                <div className="finanzübersicht-sub-tab-content">
                  {(() => {
                    // Berechnungen für die Finanzübersicht
                    const bezahlteZahlungen = finanzDaten.filter(f => f.bezahlt);
                    const offeneZahlungen = finanzDaten.filter(f => !f.bezahlt);
                    const gesamtBezahlt = bezahlteZahlungen.reduce((sum, f) => sum + parseFloat(f.betrag || 0), 0);
                    const gesamtOffen = offeneZahlungen.reduce((sum, f) => sum + parseFloat(f.betrag || 0), 0);
                    const gesamtBetrag = gesamtBezahlt + gesamtOffen;
                    const durchschnittBeitrag = finanzDaten.length > 0 ? gesamtBetrag / finanzDaten.length : 0;
                    const aufnahmegebuehren = verträge && verträge.length > 0 
                      ? verträge.reduce((sum, v) => sum + (v.aufnahmegebuehr_cents || 0), 0) / 100 
                      : 0;
                    
                    // Letzte Zahlung
                    const letzteZahlung = bezahlteZahlungen.length > 0
                      ? bezahlteZahlungen.sort((a, b) => new Date(b.zahlungsdatum || b.datum) - new Date(a.zahlungsdatum || a.datum))[0]
                      : null;
                    
                    // Kommende Zahlung (nächste ausstehende)
                    const kommendeZahlung = offeneZahlungen.length > 0
                      ? offeneZahlungen.sort((a, b) => {
                          const dateA = new Date(a.datum || a.zahlungsdatum);
                          const dateB = new Date(b.datum || b.zahlungsdatum);
                          return dateA - dateB;
                        })[0]
                      : null;
                    
                    // Jahresstatistiken
                    const jetzt = new Date();
                    const aktuellesJahr = jetzt.getFullYear();
                    const jahresZahlungen = bezahlteZahlungen.filter(f => {
                      const date = new Date(f.zahlungsdatum || f.datum);
                      return date.getFullYear() === aktuellesJahr;
                    });
                    const jahresEinnahmen = jahresZahlungen.reduce((sum, f) => sum + parseFloat(f.betrag || 0), 0);
                    
                    // Durchschnittliche Zahlungsdauer (Tage zwischen Fälligkeit und Zahlung)
                    // Nur für generierte Einträge relevant (haben datum/faelligkeitsdatum)
                    const zahlungenMitDauer = bezahlteZahlungen
                      .filter(f => f.datum && f.zahlungsdatum && f.generiert)
                      .map(f => {
                        const faellig = new Date(f.datum); // Bei generierten ist datum = faelligkeitsdatum
                        const bezahlt = new Date(f.zahlungsdatum);
                        return Math.max(0, Math.floor((bezahlt - faellig) / (1000 * 60 * 60 * 24)));
                      });
                    const durchschnittlicheZahlungsdauer = zahlungenMitDauer.length > 0
                      ? Math.round(zahlungenMitDauer.reduce((a, b) => a + b, 0) / zahlungenMitDauer.length)
                      : 0;
                    
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* KPI-Karten */}
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                          gap: '1.25rem' 
                        }}>
                          <div className="finance-kpi-card" style={{
                            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '2rem' }}>⚠️</span>
                              <h4 style={{ margin: 0, color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.9rem', fontWeight: '600' }}>
                                Offene Beträge
                              </h4>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444', marginBottom: '0.25rem' }}>
                              {gesamtOffen.toFixed(2)} €
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                              {offeneZahlungen.length} ausstehende Beiträge
                            </div>
                          </div>
                          
                          <div className="finance-kpi-card" style={{
                            background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 215, 0, 0.05) 100%)',
                            border: '1px solid rgba(255, 215, 0, 0.3)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '2rem' }}>📊</span>
                              <h4 style={{ margin: 0, color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.9rem', fontWeight: '600' }}>
                                Ø Beitrag
                              </h4>
                            </div>
                            <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ffd700', marginBottom: '0.25rem' }}>
                              {durchschnittBeitrag.toFixed(2)} €
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                              Pro Zahlung
                            </div>
                          </div>
                          
                          {letzteZahlung && (
                            <div className="finance-kpi-card" style={{
                              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(34, 197, 94, 0.05) 100%)',
                              border: '1px solid rgba(34, 197, 94, 0.3)',
                              borderRadius: '12px',
                              padding: '1.5rem',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '2rem' }}>✅</span>
                                <h4 style={{ margin: 0, color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.9rem', fontWeight: '600' }}>
                                  Letzte Zahlung
                                </h4>
                              </div>
                              <div style={{ fontSize: '2rem', fontWeight: '700', color: '#22c55e', marginBottom: '0.25rem' }}>
                                {parseFloat(letzteZahlung.betrag || 0).toFixed(2)} €
                              </div>
                              <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                {new Date(letzteZahlung.zahlungsdatum || letzteZahlung.datum).toLocaleDateString("de-DE")}
                              </div>
                            </div>
                          )}
                          
                          <div className="finance-kpi-card" style={{
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0.05) 100%)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            borderRadius: '12px',
                            padding: '1.5rem',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '2rem' }}>📅</span>
                              <h4 style={{ margin: 0, color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.9rem', fontWeight: '600' }}>
                                Nächste Zahlung
                              </h4>
                            </div>
                            {kommendeZahlung ? (
                              <>
                                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#3b82f6', marginBottom: '0.25rem' }}>
                                  {parseFloat(kommendeZahlung.betrag || 0).toFixed(2)} €
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                  {new Date(kommendeZahlung.datum || kommendeZahlung.zahlungsdatum).toLocaleDateString("de-DE")}
                                </div>
                              </>
                            ) : (
                              <>
                                <div style={{ fontSize: '2rem', fontWeight: '700', color: '#3b82f6', marginBottom: '0.25rem' }}>
                                  -
                                </div>
                                <div style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                                  Keine ausstehenden Zahlungen
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Detaillierte Statistiken */}
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
                          gap: '1.25rem' 
                        }}>
                          <div className="field-group card">
                            <h3 style={{ 
                              marginTop: 0, 
                              marginBottom: '1rem',
                              background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                              WebkitBackgroundClip: 'text',
                              WebkitTextFillColor: 'transparent',
                              backgroundClip: 'text'
                            }}>
                              Zahlungsinformationen
                            </h3>
                            <div className="finance-stats">
                              <div className="stat-item">
                                <label>Zahlungsmethode:</label>
                                <span className="stat-value">
                                  {mitglied?.zahlungsmethode || "Nicht angegeben"}
                                </span>
                              </div>
                              {letzteZahlung && (
                                <div className="stat-item">
                                  <label>Letzter Zahlungseingang:</label>
                                  <span className="stat-value">
                                    {new Date(letzteZahlung.zahlungsdatum || letzteZahlung.datum).toLocaleDateString("de-DE")}
                                  </span>
                                </div>
                              )}
                              {durchschnittlicheZahlungsdauer > 0 && (
                                <div className="stat-item">
                                  <label>Ø Zahlungsdauer:</label>
                                  <span className="stat-value">
                                    {durchschnittlicheZahlungsdauer} Tage
                                  </span>
                                </div>
                              )}
                              {aufnahmegebuehren > 0 && (
                                <div className="stat-item">
                                  <label>Aufnahmegebühren:</label>
                                  <span className="stat-value" style={{ color: '#ff9800' }}>
                                    {aufnahmegebuehren.toFixed(2)} €
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {financeSubTab === "zahlungshistorie" && (
                <div className="zahlungshistorie-sub-tab-content">
                  <div className="field-group card" style={{ width: '100%' }}>
                    <h3>Zahlungshistorie</h3>
                    {finanzDaten.length > 0 ? (
                      <div className="zahlungshistorie-table-wrapper">
                        <table className="zahlungshistorie-table">
                          <thead>
                            <tr>
                              <th>Zahlungsdatum</th>
                              <th>Fälligkeitsdatum</th>
                              <th>Betrag</th>
                              <th>Zahlungsart</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {finanzDaten
                              .sort((a, b) => {
                                const dateA = new Date(b.zahlungsdatum || b.datum);
                                const dateB = new Date(a.zahlungsdatum || a.datum);
                                return dateA - dateB;
                              })
                              .map((payment, index) => {
                                // Gleiche Logik wie in calculatePeriodSums für bezahlt-Status
                                const isPaid = payment.bezahlt === true || payment.bezahlt === 1 || payment.bezahlt === "1" || String(payment.bezahlt) === "1";
                                
                                return (
                                  <tr key={payment.beitrag_id || index} className={isPaid ? 'paid-row' : 'unpaid-row'}>
                                    <td>
                                      {payment.zahlungsdatum 
                                        ? new Date(payment.zahlungsdatum).toLocaleDateString("de-DE")
                                        : "-"}
                                    </td>
                                    <td>
                                      {payment.datum
                                        ? new Date(payment.datum).toLocaleDateString("de-DE")
                                        : payment.zahlungsdatum
                                          ? new Date(payment.zahlungsdatum).toLocaleDateString("de-DE")
                                          : "-"}
                                    </td>
                                    <td className="betrag">
                                      {payment.betrag ? `${parseFloat(payment.betrag).toFixed(2)} €` : "0,00 €"}
                                    </td>
                                    <td>
                                      {payment.zahlungsart?.toLowerCase() === 'überweisung' || payment.zahlungsart?.toLowerCase() === 'Überweisung' ? '💳 Überweisung' :
                                       payment.zahlungsart?.toLowerCase() === 'lastschrift' || payment.zahlungsart?.toLowerCase() === 'direct_debit' ? '🏦 Lastschrift' :
                                       payment.zahlungsart?.toLowerCase() === 'bar' ? '💵 Bar' :
                                       payment.zahlungsart || 'Unbekannt'}
                                    </td>
                                    <td>
                                      <span className={`status-badge ${isPaid ? 'status-paid' : 'status-unpaid'}`}>
                                        {isPaid ? '✅ Bezahlt' : '⏳ Ausstehend'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="no-data-message">
                        <p>ℹ️ Keine Zahlungshistorie verfügbar</p>
                        <small>Es wurden noch keine Zahlungen erfasst.</small>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {financeSubTab === "beitraege" && (
                <div className="beitraege-sub-tab-content">
                  {(() => {
                        // Funktion zum Gruppieren der Beiträge
                        const groupBeiträge = (data, mode) => {
                          const groups = {};
                          const sortedData = [...data].sort((a, b) => {
                            const dateA = new Date(a.datum || a.zahlungsdatum);
                            const dateB = new Date(b.datum || b.zahlungsdatum);
                            return dateB - dateA;
                          });

                          sortedData.forEach(beitrag => {
                            const date = new Date(beitrag.datum || beitrag.zahlungsdatum);
                            let key = '';

                            if (mode === 'monat') {
                              key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                            } else if (mode === 'quartal') {
                              const quarter = Math.floor(date.getMonth() / 3) + 1;
                              key = `${date.getFullYear()}-Q${quarter}`;
                            } else if (mode === 'jahr') {
                              key = `${date.getFullYear()}`;
                            }

                            if (!groups[key]) {
                              groups[key] = [];
                            }
                            groups[key].push(beitrag);
                          });

                          return groups;
                        };

                        // Funktion zum Formatieren des Zeitraum-Labels
                        const formatPeriodLabel = (key, mode) => {
                          if (mode === 'monat') {
                            const [year, month] = key.split('-');
                            const date = new Date(year, month - 1);
                            return date.toLocaleDateString('de-DE', { year: 'numeric', month: 'long' });
                          } else if (mode === 'quartal') {
                            return key.replace('-Q', '. Quartal ');
                          } else {
                            return key;
                          }
                        };

                        // Berechne Summen für einen Zeitraum
                        const calculatePeriodSums = (beitraege) => {
                          let total = 0;
                          let paid = 0;
                          let unpaid = 0;
                          
                          beitraege.forEach(b => {
                            const betrag = parseFloat(b.betrag || 0);
                            if (isNaN(betrag)) return; // Überspringe ungültige Beträge
                            
                            total += betrag;
                            
                            // Prüfe bezahlt-Status: MySQL gibt TINYINT(1) als 0 oder 1 zurück
                            // Konvertiere zu Number für sichere Prüfung - handle auch String "0"/"1"
                            const bezahltValue = b.bezahlt === true || b.bezahlt === 1 || b.bezahlt === "1" || String(b.bezahlt) === "1";
                            
                            if (bezahltValue) {
                              paid += betrag;
                            } else {
                              unpaid += betrag;
                            }
                          });
                          
                          return { total, paid, unpaid };
                        };

                        // Funktion zum Generieren zukünftiger Beiträge basierend auf Vertragsdaten
                        const generateZukuenftigeBeitraege = () => {
                          const generierteBeitraege = [];
                          const jetzt = new Date();
                          jetzt.setHours(0, 0, 0, 0);
                          
                          // Aktive Verträge finden (auch gekündigte, aber noch laufende)
                          const aktiveVertraege = verträge.filter(v => {
                            if (v.status !== 'aktiv') return false;
                            if (!v.vertragsbeginn) return false;
                            return true;
                          });

                          
                          aktiveVertraege.forEach(vertrag => {
                            const vertragsbeginn = new Date(vertrag.vertragsbeginn);
                            vertragsbeginn.setHours(0, 0, 0, 0);
                            
                            // Bestimme das tatsächliche Vertragsende
                            let vertragsende = null;
                            let kuendigungsdatum = null; // Speichere Kündigungsdatum für anteilige Berechnung (vor setHours)
                            let vertragsendeOriginal = null; // Speichere originales Vertragsende für Monatsvergleiche
                            
                            // Wenn gekündigt, verwende Kündigungsdatum
                            if (vertrag.kuendigung_eingegangen || vertrag.kuendigungsdatum) {
                              kuendigungsdatum = vertrag.kuendigungsdatum 
                                ? new Date(vertrag.kuendigungsdatum)
                                : vertrag.kuendigung_eingegangen 
                                  ? new Date(vertrag.kuendigung_eingegangen)
                                  : null;
                              if (kuendigungsdatum) {
                                vertragsendeOriginal = new Date(kuendigungsdatum);
                                vertragsende = new Date(kuendigungsdatum);
                              }
                            } else if (vertrag.vertragsende) {
                              vertragsendeOriginal = new Date(vertrag.vertragsende);
                              vertragsende = new Date(vertrag.vertragsende);
                            }
                            
                            // Prüfe ob Vertrag verlängert wurde (vertragsende überschritten, nicht gekündigt, automatische Verlängerung)
                            if (vertragsende && vertrag.automatische_verlaengerung && !vertrag.kuendigung_eingegangen) {
                              const heute = new Date();
                              heute.setHours(0, 0, 0, 0);
                              
                              if (heute > vertragsende) {
                                // Vertrag wurde verlängert - berechne neues Ende
                                const verlaengerungMonate = vertrag.verlaengerung_monate || 12;
                                vertragsende = new Date(vertragsende);
                                vertragsende.setMonth(vertragsende.getMonth() + verlaengerungMonate);
                                vertragsendeOriginal = new Date(vertragsende);
                              }
                            }
                            
                            // Wenn kein vertragsende, verwende aktuelles Datum + 12 Monate
                            if (!vertragsende) {
                              vertragsende = new Date();
                              vertragsende.setMonth(vertragsende.getMonth() + 12);
                              vertragsendeOriginal = new Date(vertragsende);
                            }
                            
                            vertragsende.setHours(23, 59, 59, 999);
                            
                            // Monatlicher Beitrag
                            const monatsbeitrag = parseFloat(vertrag.monatsbeitrag || vertrag.monatlicher_beitrag || 0);
                            if (monatsbeitrag <= 0) return;
                            
                            // Fälligkeitstag im Monat
                            const faelligkeitTag = vertrag.faelligkeit_tag || 1;
                            
                            // Starte ab dem ersten Monat nach Vertragsbeginn
                            let aktuellesDatum = new Date(vertragsbeginn);
                            aktuellesDatum.setDate(faelligkeitTag);
                            
                            // Wenn Vertragsbeginn in der Vergangenheit liegt, starte ab heute
                            if (aktuellesDatum < jetzt) {
                              aktuellesDatum = new Date(jetzt);
                              aktuellesDatum.setDate(faelligkeitTag);
                              // Wenn der Tag bereits vorbei ist, nächsten Monat
                              if (aktuellesDatum < jetzt) {
                                aktuellesDatum.setMonth(aktuellesDatum.getMonth() + 1);
                              }
                            }
                            
                            // Generiere Beiträge bis zum Vertragsende
                            while (aktuellesDatum <= vertragsende) {
                              // Prüfe ob dieser Beitrag bereits existiert (auch bezahlt)
                              // Prüfe nach Monat/Jahr und Betrag, nicht nur exaktes Datum
                              const aktuellerMonat = aktuellesDatum.getMonth();
                              const aktuellesJahr = aktuellesDatum.getFullYear();
                              
                              // Prüfe ob bereits ein Beitrag für diesen Monat existiert
                              const existiertBereits = finanzDaten.some(f => {
                                // Nur zahlungsdatum prüfen (einziges Datumsfeld in beitraege-Tabelle)
                                // Ignoriere Artikel-Verkäufe (haben magicline_description)
                                if (f.magicline_description) {
                                  return false; // Artikel-Verkäufe nicht als Monatsbeitrag zählen
                                }

                                const fDatumZahlung = f.zahlungsdatum ? new Date(f.zahlungsdatum) : null;

                                if (!fDatumZahlung || isNaN(fDatumZahlung.getTime())) {
                                  return false;
                                }

                                // Prüfe ob im gleichen Monat/Jahr
                                return fDatumZahlung.getMonth() === aktuellerMonat &&
                                       fDatumZahlung.getFullYear() === aktuellesJahr;
                              });
                              
                              if (!existiertBereits) {
                                // Prüfe ob letzter Monat und Kündigung - dann anteilig berechnen
                                let betrag = monatsbeitrag;
                                
                                // Prüfe ob es der letzte Monat ist (verwende kuendigungsdatum oder vertragsendeOriginal vor setHours)
                                const endeDatum = kuendigungsdatum || vertragsendeOriginal;
                                const istLetzterMonat = endeDatum && 
                                                         aktuellesDatum.getMonth() === endeDatum.getMonth() &&
                                                         aktuellesDatum.getFullYear() === endeDatum.getFullYear();
                                
                                if (istLetzterMonat && kuendigungsdatum) {
                                  // Anteilsmäßige Berechnung für letzten Monat
                                  const monatsAnfang = new Date(aktuellesDatum.getFullYear(), aktuellesDatum.getMonth(), 1);
                                  const monatsEnde = new Date(aktuellesDatum.getFullYear(), aktuellesDatum.getMonth() + 1, 0);
                                  const tageImMonat = monatsEnde.getDate();
                                  
                                  // Verwende das ursprüngliche Kündigungsdatum (vor setHours) für korrekte Tag-Berechnung
                                  const kuendigungsTag = kuendigungsdatum.getDate();
                                  const tageBisKündigung = Math.min(kuendigungsTag, tageImMonat);
                                  
                                  // Berechne anteiligen Betrag: Anzahl Tage bis Kündigung / Gesamttage im Monat
                                  const anteil = tageBisKündigung / tageImMonat;
                                  betrag = Math.round(monatsbeitrag * anteil * 100) / 100; // Runde auf 2 Dezimalstellen
                                }
                                
                                // Datum in Lokalzeit formatieren (NICHT UTC um Timezone-Verschiebung zu vermeiden)
                                const year = aktuellesDatum.getFullYear();
                                const month = String(aktuellesDatum.getMonth() + 1).padStart(2, '0');
                                const day = String(aktuellesDatum.getDate()).padStart(2, '0');
                                const localDateString = `${year}-${month}-${day}`;

                                generierteBeitraege.push({
                                  beitrag_id: `generated_${vertrag.id}_${aktuellesDatum.getTime()}`,
                                  betrag: betrag.toFixed(2),
                                  zahlungsdatum: null,
                                  faelligkeitsdatum: localDateString,
                                  datum: localDateString,
                                  zahlungsart: vertrag.payment_method === 'direct_debit' ? 'Lastschrift' :
                                              vertrag.payment_method === 'transfer' ? 'Überweisung' :
                                              vertrag.payment_method || 'Unbekannt',
                                  bezahlt: 0,
                                  generiert: true, // Flag um zu markieren dass es generiert wurde
                                  vertrag_id: vertrag.id,
                                  anteilig: istLetzterMonat && kuendigungsdatum !== null
                                });
                              }
                              
                              // Nächsten Monat
                              aktuellesDatum.setMonth(aktuellesDatum.getMonth() + 1);
                            }
                          });
                          
                          return generierteBeitraege;
                        };
                        
                        // Kombiniere vorhandene und generierte Beiträge
                        const zukuenftigeBeitraege = generateZukuenftigeBeitraege();
                        const alleBeitraege = [...finanzDaten, ...zukuenftigeBeitraege];
                        
                        // Sortiere nach Datum (neueste zuerst)
                        alleBeitraege.sort((a, b) => {
                          // Generierte Beiträge haben 'datum', echte Beiträge haben 'zahlungsdatum'
                          const dateA = new Date(a.datum || a.zahlungsdatum);
                          const dateB = new Date(b.datum || b.zahlungsdatum);
                          return dateB - dateA;
                        });
                        
                        const grouped = groupBeiträge(alleBeitraege, beitraegeViewMode);
                        const periodKeys = Object.keys(grouped).sort().reverse();
                        
                        return (
                          <>
                            {/* Ansichtsfilter für Beiträge - außerhalb der Card */}
                            <div className="beitraege-view-filter" style={{ marginBottom: '1rem' }}>
                              <button
                                className={`view-filter-btn ${beitraegeViewMode === "monat" ? "active" : ""}`}
                                onClick={() => setBeiträgeViewMode("monat")}
                              >
                                📅 Monat
                              </button>
                              <button
                                className={`view-filter-btn ${beitraegeViewMode === "quartal" ? "active" : ""}`}
                                onClick={() => setBeiträgeViewMode("quartal")}
                              >
                                📊 Quartal
                              </button>
                              <button
                                className={`view-filter-btn ${beitraegeViewMode === "jahr" ? "active" : ""}`}
                                onClick={() => setBeiträgeViewMode("jahr")}
                              >
                                📆 Jahr
                              </button>
                              <button
                                className="view-filter-btn"
                                onClick={() => {
                                  // Berechne periodKeys neu für den Button
                                  const zukuenftigeBeitraege = generateZukuenftigeBeitraege();
                                  const alleBeitraege = [...finanzDaten, ...zukuenftigeBeitraege];
                                  const grouped = groupBeiträge(alleBeitraege, beitraegeViewMode);
                                  const periodKeys = Object.keys(grouped).sort().reverse();
                                  
                                  const allCollapsed = periodKeys.length > 0 && periodKeys.every(key => collapsedPeriods[key] === true);
                                  const newState = {};
                                  periodKeys.forEach(key => {
                                    newState[key] = !allCollapsed;
                                  });
                                  setCollapsedPeriods(newState);
                                }}
                                style={{ whiteSpace: 'nowrap' }}
                              >
                                {(() => {
                                  const zukuenftigeBeitraege = generateZukuenftigeBeitraege();
                                  const alleBeitraege = [...finanzDaten, ...zukuenftigeBeitraege];
                                  const grouped = groupBeiträge(alleBeitraege, beitraegeViewMode);
                                  const periodKeys = Object.keys(grouped).sort().reverse();
                                  const allCollapsed = periodKeys.length > 0 && periodKeys.every(key => collapsedPeriods[key] === true);
                                  return allCollapsed ? '📂 Alle ausklappen' : '📁 Alle einklappen';
                                })()}
                              </button>
                            </div>

                            <div className="field-group card" style={{ width: '100%' }}>
                              <h3>Beiträge & Zahlungen</h3>

                              {/* Gruppierte Beiträge-Ansicht */}
                              {alleBeitraege.length === 0 ? (
                                <div className="no-data-message">
                                  <p>📭 Keine Beiträge vorhanden</p>
                                  <small>Es wurden noch keine Beiträge erfasst und es gibt keinen aktiven Vertrag.</small>
                                </div>
                              ) : (
                                <div className="beitraege-grouped-view">
                            {periodKeys.map(periodKey => {
                              const beitraege = grouped[periodKey];
                              const sums = calculatePeriodSums(beitraege);
                              const isCollapsed = collapsedPeriods[periodKey];

                              return (
                                <div key={periodKey} className="period-group">
                                  <div
                                    className="period-header"
                                    onClick={() => {
                                      setCollapsedPeriods(prev => ({
                                        ...prev,
                                        [periodKey]: !prev[periodKey]
                                      }));
                                    }}
                                  >
                                    <div className="period-header-left">
                                      <span className="collapse-icon">
                                        {isCollapsed ? '▶' : '▼'}
                                      </span>
                                      <span className="period-label">
                                        {formatPeriodLabel(periodKey, beitraegeViewMode)}
                                      </span>
                                      <span className="period-count">
                                        ({beitraege.length} Beiträge)
                                      </span>
                                    </div>
                                    <div className="period-summary">
                                      <span className="summary-item total">
                                        Gesamt: {sums.total.toFixed(2)} €
                                      </span>
                                      <span className="summary-item paid">
                                        Bezahlt: {sums.paid.toFixed(2)} €
                                      </span>
                                      <span className="summary-item unpaid">
                                        Offen: {sums.unpaid.toFixed(2)} €
                                      </span>
                                    </div>
                                  </div>

                                  {!isCollapsed && (
                                    <div className="period-content">
                                      <table className="beitraege-table">
                                        <thead>
                                          <tr>
                                            <th style={{width: '1px', padding: '0.5rem 0'}}></th>
                                            <th>Datum</th>
                                            <th>Betrag</th>
                                            <th>Zahlungsart</th>
                                            <th>Status</th>
                                            <th>Aktionen</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {beitraege.map((beitrag) => {
                                            const isExpanded = expandedBeitraege[beitrag.beitrag_id];
                                            return (
                                              <React.Fragment key={beitrag.beitrag_id}>
                                            <tr className={beitrag.bezahlt ? 'paid' : 'unpaid'} style={{
                                              opacity: beitrag.generiert ? 0.8 : 1
                                            }}>
                                              <td style={{textAlign: 'center', padding: '0.5rem 0.1rem', whiteSpace: 'nowrap', width: '1px'}}>
                                                {!beitrag.generiert && beitrag.beitrag_id && (
                                                  <button
                                                    onClick={() => setExpandedBeitraege(prev => ({
                                                      ...prev,
                                                      [beitrag.beitrag_id]: !prev[beitrag.beitrag_id]
                                                    }))}
                                                    style={{
                                                      background: 'none',
                                                      border: 'none',
                                                      cursor: 'pointer',
                                                      fontSize: '0.65rem',
                                                      color: 'rgba(255, 215, 0, 0.8)',
                                                      transition: 'transform 0.2s',
                                                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                                      padding: 0,
                                                      lineHeight: 1,
                                                      display: 'inline-block',
                                                      width: 'auto'
                                                    }}
                                                    title="Details anzeigen"
                                                  >
                                                    ▶
                                                  </button>
                                                )}
                                              </td>
                                              <td>
                                                {new Date(beitrag.datum || beitrag.zahlungsdatum).toLocaleDateString("de-DE")}
                                                {beitrag.generiert && (
                                                  <span style={{ 
                                                    fontSize: '0.75rem', 
                                                    color: 'rgba(255, 215, 0, 0.7)',
                                                    marginLeft: '0.5rem'
                                                  }} title="Automatisch generiert basierend auf Vertragsdaten">
                                                    🔮
                                                  </span>
                                                )}
                                              </td>
                                              <td className="betrag">
                                                {parseFloat(beitrag.betrag).toFixed(2)} €
                                                {beitrag.anteilig && (
                                                  <span style={{ 
                                                    fontSize: '0.75rem', 
                                                    color: 'rgba(255, 215, 0, 0.7)',
                                                    marginLeft: '0.5rem',
                                                    fontStyle: 'italic'
                                                  }} title="Anteiliger Beitrag für letzten Monat bei Kündigung">
                                                    (anteilig)
                                                  </span>
                                                )}
                                              </td>
                                              <td>
                                                {beitrag.zahlungsart?.toLowerCase() === 'überweisung' || beitrag.zahlungsart?.toLowerCase() === 'Überweisung' ? '💳 Überweisung' :
                                                 beitrag.zahlungsart?.toLowerCase() === 'lastschrift' ? '🏦 Lastschrift' :
                                                 beitrag.zahlungsart?.toLowerCase() === 'bar' ? '💵 Bar' :
                                                 beitrag.zahlungsart || 'Unbekannt'}
                                              </td>
                                              <td>
                                                <span className={`status-badge ${beitrag.bezahlt ? 'status-paid' : 'status-unpaid'}`}>
                                                  {beitrag.bezahlt ? '✅ Bezahlt' : '⏳ Ausstehend'}
                                                </span>
                                              </td>
                                              <td>
                                                {isAdmin && (
                                                  <button
                                                    className={`btn-toggle-payment ${beitrag.bezahlt ? 'btn-mark-unpaid' : 'btn-mark-paid'}`}
                                                    onClick={async () => {
                                                      try {
                                                        // Für generierte Beiträge: Erstelle neuen Beitrag in DB
                                                        if (beitrag.generiert) {
                                                          const zahlungsdatum = beitrag.bezahlt 
                                                            ? null 
                                                            : new Date().toISOString().split('T')[0];
                                                          
                                                          const newBeitrag = {
                                                            mitglied_id: mitglied.mitglied_id,
                                                            betrag: parseFloat(beitrag.betrag),
                                                            zahlungsart: beitrag.zahlungsart,
                                                            zahlungsdatum: zahlungsdatum,
                                                            bezahlt: beitrag.bezahlt ? 0 : 1
                                                          };
                                                          
                                                          await axios.post('/beitraege', newBeitrag);
                                                          fetchFinanzDaten();
                                                        } else {
                                                          // Für vorhandene Beiträge: Update
                                                          const zahlungsdatum = beitrag.zahlungsdatum 
                                                            ? new Date(beitrag.zahlungsdatum).toISOString().split('T')[0]
                                                            : (beitrag.bezahlt ? null : new Date().toISOString().split('T')[0]);

                                                          const updateData = {
                                                            betrag: parseFloat(beitrag.betrag),
                                                            zahlungsart: beitrag.zahlungsart,
                                                            zahlungsdatum: zahlungsdatum,
                                                            bezahlt: beitrag.bezahlt ? 0 : 1
                                                          };

                                                          await axios.put(`/beitraege/${beitrag.beitrag_id}`, updateData);
                                                          fetchFinanzDaten();
                                                        }
                                                      } catch (err) {
                                                        console.error('❌ Fehler beim Aktualisieren:', err);
                                                        console.error('❌ Error Details:', err.response?.data || err.message);
                                                      }
                                                    }}
                                                  >
                                                    {beitrag.bezahlt ? '❌ Als unbezahlt markieren' : '✅ Als bezahlt markieren'}
                                                  </button>
                                                )}
                                              </td>
                                            </tr>
                                            {isExpanded && !beitrag.generiert && (
                                              <tr className="beitrag-details-row">
                                                <td colSpan="6" style={{
                                                  padding: '1rem 1.5rem',
                                                  background: 'rgba(255, 215, 0, 0.05)',
                                                  borderLeft: '3px solid rgba(255, 215, 0, 0.5)'
                                                }}>
                                                  <div style={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                                                    gap: '0.75rem',
                                                    fontSize: '0.85rem',
                                                    color: 'rgba(255, 255, 255, 0.9)'
                                                  }}>
                                                    <div>
                                                      <strong style={{color: '#ffd700', display: 'block', marginBottom: '0.25rem'}}>Beitrags-ID:</strong>
                                                      <span>#{beitrag.beitrag_id}</span>
                                                    </div>
                                                    {beitrag.magicline_description && (
                                                      <div style={{gridColumn: '1 / -1'}}>
                                                        <strong style={{color: '#ffd700', display: 'block', marginBottom: '0.25rem'}}>Beschreibung:</strong>
                                                        <span>{beitrag.magicline_description}</span>
                                                      </div>
                                                    )}
                                                    {(beitrag.datum || beitrag.zahlungsdatum) && (
                                                      <div>
                                                        <strong style={{color: '#ffd700', display: 'block', marginBottom: '0.25rem'}}>Datum:</strong>
                                                        <span>{new Date(beitrag.datum || beitrag.zahlungsdatum).toLocaleDateString('de-DE')}</span>
                                                      </div>
                                                    )}
                                                    {beitrag.zahlungsdatum && (
                                                      <div>
                                                        <strong style={{color: '#ffd700', display: 'block', marginBottom: '0.25rem'}}>Zahlungsdatum:</strong>
                                                        <span>{new Date(beitrag.zahlungsdatum).toLocaleDateString('de-DE')}</span>
                                                      </div>
                                                    )}
                                                    <div>
                                                      <strong style={{color: '#ffd700', display: 'block', marginBottom: '0.25rem'}}>Betrag (brutto):</strong>
                                                      <span>{parseFloat(beitrag.betrag).toFixed(2)} €</span>
                                                    </div>
                                                    <div>
                                                      <strong style={{color: '#ffd700', display: 'block', marginBottom: '0.25rem'}}>Zahlungsart:</strong>
                                                      <span>{beitrag.zahlungsart || 'Nicht angegeben'}</span>
                                                    </div>
                                                    <div>
                                                      <strong style={{color: '#ffd700', display: 'block', marginBottom: '0.25rem'}}>Status:</strong>
                                                      <span style={{color: beitrag.bezahlt ? '#4caf50' : '#ff9800'}}>
                                                        {beitrag.bezahlt ? 'Bezahlt' : 'Ausstehend'}
                                                      </span>
                                                    </div>
                                                    {beitrag.dojo_id && (
                                                      <div>
                                                        <strong style={{color: '#ffd700', display: 'block', marginBottom: '0.25rem'}}>Dojo-ID:</strong>
                                                        <span>#{beitrag.dojo_id}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                </td>
                                              </tr>
                                            )}
                                              </React.Fragment>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                                </div>
                              )}
                            </div>
                          </>
                        );
                      })()}
                </div>
              )}

              {financeSubTab === "bank" && (
                <div className="bank-sub-tab-content">
                  <div className="grid-container">
                    <div className="field-group card bank-sepa-card">
                      <h3 className="bank-sepa-heading">Bankdaten</h3>
                      <div>
                        <label>IBAN:</label>
                        {editMode ? (
                          <input
                            type="text"
                            value={updatedData.iban || ""}
                            onChange={(e) => handleChange(e, "iban")}
                            placeholder="DE89 3704 0044 0532 0130 00"
                          />
                        ) : (
                          <span>{mitglied.iban || "Nicht angegeben"}</span>
                        )}
                      </div>
                      <div>
                        <label>BIC:</label>
                        {editMode ? (
                          <input
                            type="text"
                            value={updatedData.bic || ""}
                            onChange={(e) => handleChange(e, "bic")}
                            placeholder="COBADEFFXXX"
                          />
                        ) : (
                          <span>{mitglied.bic || "Nicht angegeben"}</span>
                        )}
                      </div>
                      <div>
                        <label>Bankname:</label>
                        {editMode ? (
                          <input
                            type="text"
                            value={updatedData.bankname || ""}
                            onChange={(e) => handleChange(e, "bankname")}
                            placeholder="Commerzbank AG"
                          />
                        ) : (
                          <span>{mitglied.bankname || "Nicht angegeben"}</span>
                        )}
                      </div>
                      <div>
                        <label>Kontoinhaber:</label>
                        {editMode ? (
                          <input
                            type="text"
                            value={updatedData.kontoinhaber || ""}
                            onChange={(e) => handleChange(e, "kontoinhaber")}
                            placeholder="Max Mustermann"
                          />
                        ) : (
                          <span>{mitglied.kontoinhaber || `${mitglied.vorname} ${mitglied.nachname}`}</span>
                        )}
                      </div>
                      <div>
                        <label>Zahlungsmethode:</label>
                        {editMode ? (
                          <CustomSelect
                            value={updatedData.zahlungsmethode || ""}
                            onChange={(e) => handleChange(e, "zahlungsmethode")}
                            options={[
                              { value: 'SEPA-Lastschrift', label: 'SEPA-Lastschrift' },
                              { value: 'Lastschrift', label: 'Lastschrift' },
                              { value: 'Bar', label: 'Bar' },
                              { value: 'Überweisung', label: 'Überweisung' }
                            ]}
                          />
                        ) : (
                          <span>{mitglied.zahlungsmethode || "Nicht angegeben"}</span>
                        )}
                      </div>
                      <div>
                        <label>Zahllaufgruppe:</label>
                        {editMode ? (
                          <input
                            type="text"
                            value={updatedData.zahllaufgruppe || ""}
                            onChange={(e) => handleChange(e, "zahllaufgruppe")}
                            placeholder="01"
                          />
                        ) : (
                          <span>{mitglied.zahllaufgruppe || "Nicht angegeben"}</span>
                        )}
                      </div>
                    </div>

                    <div className="field-group card bank-sepa-card">
                      <h3 className="bank-sepa-heading">SEPA-Lastschriftmandat</h3>
                      {sepaMandate ? (
                        <div className="sepa-mandate-info">
                          <div className="mandate-status">
                            <span className="status-badge active">✅ Aktiv</span>
                            <span>Mandat-Referenz: {sepaMandate.mandatsreferenz}</span>
                          </div>
                          <div className="mandate-details">
                            <p><strong>Erstellt am:</strong> {new Date(sepaMandate.erstellungsdatum).toLocaleDateString("de-DE")}</p>
                            <p><strong>Gültig bis:</strong> {sepaMandate.ablaufdatum ? new Date(sepaMandate.ablaufdatum).toLocaleDateString("de-DE") : "Unbefristet"}</p>
                            <p><strong>Gläubiger-Identifikation:</strong> {sepaMandate.glaeubiger_id}</p>
                            {sepaMandate.widerruf_datum && (
                              <p><strong>Widerrufen am:</strong> <span className="widerruf-datum">{new Date(sepaMandate.widerruf_datum).toLocaleDateString("de-DE")}</span></p>
                            )}
                            <p><strong>IBAN:</strong> {sepaMandate.iban ? `${sepaMandate.iban.slice(0, 4)}****${sepaMandate.iban.slice(-4)}` : 'N/A'}</p>
                            <p><strong>Kontoinhaber:</strong> {sepaMandate.kontoinhaber}</p>
                          </div>
                          <div className="mandate-actions">
                            <button className="bank-sepa-button" onClick={() => downloadSepaMandate()}>
                              📥 Mandat herunterladen
                            </button>
                            <button className="bank-sepa-button bank-sepa-button-warning" onClick={() => revokeSepaMandate()}>
                              ? Mandat widerrufen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="no-sepa-mandate">
                          <p>Kein SEPA-Lastschriftmandat vorhanden.</p>
                          {mitglied?.iban && mitglied?.bic ? (
                            <button 
                              className="bank-sepa-button bank-sepa-button-primary"
                              onClick={() => generateSepaMandate()}
                              disabled={generatingMandate}
                            >
                              {generatingMandate ? "⏳ Erstelle Mandat..." : "📝 SEPA-Mandat erstellen"}
                            </button>
                          ) : (
                            <div className="info-box warning">
                              <p>ℹ️ Bitte vervollständigen Sie zuerst die Bankdaten (IBAN und BIC), um ein SEPA-Mandat zu erstellen.</p>
                            </div>
                          )}
                        </div>
                      )}
                      
                      <div className="sepa-legal-info">
                        <h4>Rechtliche Grundlagen</h4>
                        <p className="legal-text">
                          Das SEPA-Lastschriftmandat berechtigt den Zahlungsempfänger, Zahlungen vom Konto des Zahlungspflichtigen mittels Lastschrift einzuziehen. 
                          Zugleich wird die Bank des Zahlungspflichtigen zur Einlösung der Lastschrift angewiesen.
                        </p>
                        <p className="legal-text">
                          <strong>Hinweis:</strong> Der Zahlungspflichtige kann innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. 
                          Es gelten dabei die mit der Bank vereinbarten Bedingungen.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "buddy_gruppen" && (
            <div className="buddy-gruppen-content" style={{padding: '1.5rem', background: 'transparent'}}>
              <div style={{marginBottom: '1.5rem'}}>
                <h3 style={{color: '#ffd700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  👥 Buddy-Gruppen
                </h3>
                <p style={{color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem'}}>
                  Gruppen, in denen {mitglied?.vorname} {mitglied?.nachname} Mitglied ist
                </p>
              </div>

              {/* Buddy-Gruppen Liste */}
              {buddyGroupsLoading ? (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  borderRadius: '12px',
                  padding: '2rem',
                  textAlign: 'center'
                }}>
                  <div style={{fontSize: '2rem', marginBottom: '1rem'}}>⏳</div>
                  <p style={{color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem'}}>
                    Buddy-Gruppen werden geladen...
                  </p>
                </div>
              ) : buddyGroups.length === 0 ? (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  borderRadius: '12px',
                  padding: '2rem',
                  textAlign: 'center'
                }}>
                  <div style={{fontSize: '2.5rem', marginBottom: '1rem'}}>👥</div>
                  <p style={{color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem', marginBottom: '0.5rem'}}>
                    Keine Buddy-Gruppen gefunden
                  </p>
                  <p style={{color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem'}}>
                    {mitglied?.vorname} ist noch in keiner Buddy-Gruppe.
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  marginBottom: '2rem'
                }}>
                  {buddyGroups.map((group) => (
                    <div
                      key={group.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 215, 0, 0.2)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                        e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.4)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                        e.currentTarget.style.borderColor = 'rgba(255, 215, 0, 0.2)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '1rem'
                      }}>
                        <div>
                          <h4 style={{
                            color: '#ffd700',
                            fontSize: '1.2rem',
                            margin: '0 0 0.5rem 0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <span>👥</span>
                            {group.gruppe_name || `Gruppe #${group.id}`}
                          </h4>
                          <div style={{
                            display: 'flex',
                            gap: '1rem',
                            flexWrap: 'wrap',
                            fontSize: '0.9rem',
                            color: 'rgba(255, 255, 255, 0.7)'
                          }}>
                            <span>📅 Erstellt: {new Date(group.erstellt_am).toLocaleDateString('de-DE')}</span>
                            <span>👥 Mitglieder: {group.aktive_mitglieder || 0}/{group.max_mitglieder || '∞'}</span>
                            {group.gesamt_einladungen > 0 && (
                              <span>📧 Einladungen: {group.gesamt_einladungen}</span>
                            )}
                          </div>
                        </div>
                        <span style={{
                          padding: '0.4rem 0.8rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          background: group.status === 'aktiv' 
                            ? 'rgba(34, 197, 94, 0.2)' 
                            : 'rgba(107, 114, 128, 0.2)',
                          color: group.status === 'aktiv' ? '#22c55e' : '#6b7280',
                          border: `1px solid ${group.status === 'aktiv' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(107, 114, 128, 0.3)'}`
                        }}>
                          {group.status === 'aktiv' ? 'Aktiv' : group.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Referral-Code Verwaltung */}
              {mitglied?.mitglied_id && (
                <div style={{
                  marginTop: '2rem',
                  paddingTop: '2rem',
                  borderTop: '1px solid rgba(255, 215, 0, 0.2)'
                }}>
                  <ReferralCodeVerwaltung
                    mitgliedId={mitglied.mitglied_id}
                    buddyGruppeId={buddyGroups[0]?.id || null}
                    marketingAktionId={null}
                  />
                </div>
              )}

              {/* Platzhalter für Marketing-Aktionen */}
              <div style={{
                marginTop: '2rem',
                paddingTop: '2rem',
                borderTop: '1px solid rgba(255, 215, 0, 0.2)'
              }}>
                <h4 style={{color: '#ffd700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  📅 Marketing-Aktionen
                </h4>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px dashed rgba(255, 215, 0, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  textAlign: 'center'
                }}>
                  <div style={{fontSize: '2rem', marginBottom: '0.75rem'}}>📅</div>
                  <p style={{color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.95rem'}}>
                    Teilnahme an Marketing-Aktionen wird hier angezeigt
                  </p>
                  <p style={{color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.85rem', marginTop: '0.5rem'}}>
                    Diese Funktion wird in Kürze verfügbar sein.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "nachrichten" && (
            <div className="nachrichten-content" style={{padding: '1.5rem', background: 'transparent'}}>

              {/* News-Artikel Sektion */}
              <div style={{marginBottom: '2.5rem'}}>
                <h3 style={{color: '#ffd700', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  📰 Aktuelle News
                </h3>

                {newsLoading ? (
                  <div style={{textAlign: 'center', padding: '1.5rem', color: 'rgba(255, 255, 255, 0.7)'}}>
                    Lade News...
                  </div>
                ) : newsArticles.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '1.5rem',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 215, 0, 0.1)'
                  }}>
                    <p style={{color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.9rem', margin: 0}}>
                      Keine aktuellen News vorhanden
                    </p>
                  </div>
                ) : (
                  <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                    {newsArticles.map((news) => (
                      <div
                        key={news.id}
                        style={{
                          background: 'rgba(30, 30, 45, 0.8)',
                          border: '1px solid rgba(255, 215, 0, 0.2)',
                          borderRadius: '10px',
                          padding: '1rem',
                          backdropFilter: 'blur(10px)',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => setExpandedNews(expandedNews === news.id ? null : news.id)}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: '1rem'
                        }}>
                          <div style={{flex: 1}}>
                            <h4 style={{
                              color: '#ffd700',
                              margin: '0 0 0.5rem 0',
                              fontSize: '1rem',
                              fontWeight: '600'
                            }}>
                              {news.titel}
                            </h4>
                            {news.kurzbeschreibung && expandedNews !== news.id && (
                              <p style={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                margin: 0,
                                fontSize: '0.9rem',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}>
                                {news.kurzbeschreibung}
                              </p>
                            )}
                          </div>
                          <div style={{
                            color: '#808090',
                            fontSize: '0.8rem',
                            whiteSpace: 'nowrap'
                          }}>
                            {new Date(news.veroeffentlicht_am || news.created_at).toLocaleDateString('de-DE')}
                          </div>
                        </div>

                        {expandedNews === news.id && (
                          <div style={{
                            marginTop: '1rem',
                            paddingTop: '1rem',
                            borderTop: '1px solid rgba(255, 215, 0, 0.1)'
                          }}>
                            <div style={{
                              color: '#e0e0e0',
                              fontSize: '0.9rem',
                              lineHeight: '1.6',
                              whiteSpace: 'pre-wrap'
                            }}>
                              {news.inhalt}
                            </div>
                          </div>
                        )}

                        <div style={{
                          marginTop: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem'
                        }}>
                          <span style={{
                            color: '#ffd700',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}>
                            {expandedNews === news.id ? '▲ Weniger anzeigen' : '▼ Mehr lesen'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Benachrichtigungen Sektion */}
              <div style={{marginBottom: '1.5rem'}}>
                <h3 style={{color: '#ffd700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  📬 Nachrichtenarchiv
                </h3>
                <p style={{color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem'}}>
                  Alle Benachrichtigungen die an {mitglied?.vorname} {mitglied?.nachname} ({mitglied?.email}) gesendet wurden
                </p>
              </div>

              {notificationsLoading ? (
                <div style={{textAlign: 'center', padding: '2rem', color: 'rgba(255, 255, 255, 0.7)'}}>
                  Lade Benachrichtigungen...
                </div>
              ) : memberNotifications.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '3rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 215, 0, 0.2)'
                }}>
                  <div style={{fontSize: '3rem', marginBottom: '1rem'}}>📭</div>
                  <p style={{color: 'rgba(255, 255, 255, 0.7)', fontSize: '1.1rem'}}>
                    Noch keine Benachrichtigungen erhalten
                  </p>
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  {memberNotifications.map((notification, index) => (
                    <div
                      key={index}
                      style={{
                        background: 'rgba(30, 30, 45, 0.8)',
                        border: '1px solid rgba(255, 215, 0, 0.2)',
                        borderRadius: '10px',
                        padding: '1rem',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      {/* Header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.8rem',
                        marginBottom: '0.8rem'
                      }}>
                        <div style={{fontSize: '1.5rem'}}>
                          {notification.type === 'email' ? '📧' : '📱'}
                        </div>
                        <div style={{flex: 1}}>
                          <h4 style={{
                            color: '#ffd700',
                            margin: 0,
                            fontSize: '1rem',
                            fontWeight: '600'
                          }}>
                            {notification.subject}
                          </h4>
                          <div style={{
                            color: '#808090',
                            fontSize: '0.85rem',
                            marginTop: '0.2rem'
                          }}>
                            {new Date(notification.created_at).toLocaleString('de-DE')}
                          </div>
                        </div>
                        <div style={{
                          background: notification.status === 'sent' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                          color: notification.status === 'sent' ? '#22c55e' : '#ef4444',
                          padding: '0.3rem 0.8rem',
                          borderRadius: '20px',
                          fontSize: '0.85rem',
                          fontWeight: '600'
                        }}>
                          {notification.status === 'sent' ? '✅ Gesendet' :
                           notification.status === 'failed' ? '❌ Fehlgeschlagen' : '⏳ Ausstehend'}
                        </div>
                      </div>

                      {/* Nachrichteninhalt */}
                      {notification.message && (
                        <div style={{
                          padding: '0.8rem',
                          background: 'rgba(20, 20, 30, 0.5)',
                          borderRadius: '8px',
                          borderLeft: '3px solid #ffd700',
                          marginTop: '0.8rem'
                        }}>
                          <div style={{
                            fontSize: '0.75rem',
                            color: '#a0a0b0',
                            marginBottom: '0.4rem',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                          }}>
                            Nachricht
                          </div>
                          <div
                            style={{
                              color: '#e0e0e0',
                              fontSize: '0.9rem',
                              lineHeight: '1.5',
                              maxHeight: '150px',
                              overflowY: 'auto'
                            }}
                            dangerouslySetInnerHTML={createSafeHtml(notification.message)}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "statistiken" && (
            <MemberStatisticsTab
              statistikDaten={statistikDaten}
              mitglied={mitglied}
              memberStile={memberStile}
              stile={stile}
              styleSpecificData={styleSpecificData}
            />
          )}

          {activeTab === "zusatzdaten" && (
            <MemberAdditionalDataTab
              mitgliedId={id}
              dojoId={mitglied?.dojo_id}
              editMode={editMode}
            />
          )}

                    {activeTab === "gurt_stil" && (
            <div className="style-management-container">
              {/* Sub-Tabs für Stile und Prüfung - Sidebar Style */}
              <div className="sub-tabs-sidebar-style">
                <button
                  className={`tab-vertical-btn ${styleSubTab === "stile" ? "active" : ""}`}
                  onClick={() => setStyleSubTab("stile")}
                >
                  <span className="tab-icon">🥋</span>
                  <span className="tab-label">Stile</span>
                </button>
                <button
                  className={`tab-vertical-btn ${styleSubTab === "pruefung" ? "active" : ""}`}
                  onClick={() => setStyleSubTab("pruefung")}
                >
                  <span className="tab-icon">📝</span>
                  <span className="tab-label">Prüfung</span>
                </button>
              </div>

              {styleSubTab === "stile" && (
                <div className="stile-sub-tab-content">
                  {/* Stil-Tabs und Stil hinzufügen Button in einer Zeile */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.5rem',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}>
                    {/* Stil-Tabs Links - Sidebar Style */}
                    {memberStile.length > 0 ? (
                      <div className="stil-tabs-row">
                        {memberStile.map((memberStil, index) => (
                          <button
                            key={memberStil.stil_id}
                            onClick={() => setActiveStyleTab(index)}
                            className={`tab-vertical-btn ${activeStyleTab === index ? 'active' : ''}`}
                          >
                            <span className="tab-icon">🥋</span>
                            <span className="tab-label">{memberStil.stil_name}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div style={{ flex: 1 }}></div>
                    )}

                    {/* Stil hinzufügen Rechts - Sichtbar für Admins */}
                    {isAdmin && (
                      <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'center',
                        visibility: 'visible !important',
                        opacity: '1 !important'
                      }}>
                        <select
                          value={selectedStilId}
                          onChange={(e) => handleStyleChange(e.target.value)}
                          disabled={!editMode}
                          style={{
                            padding: '0.6rem 1rem',
                            background: '#1a1a1a',
                            border: '1px solid rgba(255, 215, 0, 0.3)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '0.9rem',
                            minWidth: '180px',
                            opacity: editMode ? '1' : '0.5',
                            cursor: editMode ? 'pointer' : 'not-allowed'
                          }}
                        >
                          <option value="" style={{ background: '#1a1a1a', color: '#fff' }}>➕ Stil wählen...</option>
                          {stile
                            .filter(s => s.aktiv === 1 || s.aktiv === true) // Nur aktive Stile
                            .filter(s => !memberStile.find(ms => ms.stil_id === s.stil_id)) // Nicht bereits zugewiesen
                            .map(stil => (
                              <option key={stil.stil_id} value={stil.stil_id} style={{ background: '#1a1a1a', color: '#fff' }}>
                                {stil.stil_name || stil.name}
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={handleAddStyle}
                          disabled={!selectedStilId || !editMode}
                          style={{
                            padding: '0.6rem 1.2rem',
                            background: (selectedStilId && editMode) ? 'linear-gradient(135deg, #FFD700, #FFA500)' : 'rgba(255, 255, 255, 0.1)',
                            border: (selectedStilId && editMode) ? 'none' : '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '6px',
                            color: (selectedStilId && editMode) ? '#000' : '#999',
                            fontWeight: '600',
                            cursor: (selectedStilId && editMode) ? 'pointer' : 'not-allowed',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap',
                            visibility: 'visible !important',
                            opacity: editMode ? '1' : '0.5'
                          }}
                        >
                          Hinzufügen
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Grid Container für die Stil-Karten */}
                  {memberStile.length > 0 ? (
                    (() => {
                      const memberStil = memberStile[activeStyleTab];
                      if (!memberStil) return null;

                      const fullStilData = stile.find(s => s.stil_id === memberStil.stil_id);
                      const isActiveStyle = true;

                      // DEBUG LOGS
                      console.log('🔍 RENDER DEBUG:');
                      console.log('  - selectedStil:', selectedStil?.name || 'NULL');
                      console.log('  - selectedStil.graduierungen:', selectedStil?.graduierungen?.length || 0);
                      console.log('  - currentGraduation:', currentGraduation?.name || 'NULL');
                      console.log('  - editMode:', editMode);
                      console.log('  - isAdmin:', isAdmin);
                      console.log('  - fullStilData:', fullStilData?.name || 'NULL');

                      return (
                        <div key={memberStil.stil_id}>
                          {/* Stil-Überschrift mit Badge */}
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '1.5rem',
                            paddingBottom: '1rem',
                            borderBottom: '2px solid rgba(255, 215, 0, 0.2)'
                          }}>
                            <h2 style={{ margin: 0, color: '#FFD700', fontSize: '1.5rem', fontWeight: '700' }}>
                              🥋 {memberStil.stil_name}
                            </h2>
                            {editMode && (
                              <button
                                onClick={() => handleRemoveStyle(memberStil.stil_id)}
                                style={{
                                  padding: '0.5rem 1rem',
                                  background: 'rgba(239, 68, 68, 0.2)',
                                  border: '1px solid #ef4444',
                                  borderRadius: '6px',
                                  color: '#ef4444',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  fontSize: '0.9rem'
                                }}
                              >
                                🗑️ Stil entfernen
                              </button>
                            )}
                          </div>

                          {/* 2 Karten im Grid - über volle Breite */}
                          <div className="grid-container zwei-spalten">
                            {/* Karte 1: Aktuelle Graduierung */}
                            <div className="field-group card">
                              <h3>Aktuelle Graduierung</h3>
                              <div>
                                <label style={{ textTransform: 'none', fontSize: '0.9rem' }}>Gurtfarbe:</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
                                  <BeltPreview
                                    primaer={(isActiveStyle && currentGraduation?.farbe_hex) || '#666'}
                                    sekundaer={isActiveStyle && currentGraduation?.farbe_sekundaer}
                                    size="normal"
                                  />
                                  <span style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>
                                    {(isActiveStyle && currentGraduation?.name) || "Keine Graduierung"}
                                  </span>
                                </div>

                                {/* Buttons immer sichtbar, aber nur im Edit-Modus aktiv */}
                                {isActiveStyle && isAdmin && (
                                  <div className="graduierung-buttons" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <button
                                      className="grad-btn grad-btn-down"
                                      onClick={() => {
                                        console.log('🔘 Niedriger-Button geklickt! CurrentGrad:', currentGraduation?.name);
                                        handleGraduationArrowChange(currentGraduation?.graduierung_id, 'up');
                                      }}
                                      disabled={!currentGraduation || !selectedStil.graduierungen || selectedStil.graduierungen.findIndex(g => g.graduierung_id === currentGraduation.graduierung_id) === 0}
                                      style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        background: (currentGraduation && selectedStil.graduierungen && selectedStil.graduierungen.findIndex(g => g.graduierung_id === currentGraduation.graduierung_id) > 0)
                                          ? 'rgba(239, 68, 68, 0.2)'
                                          : 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid #ef4444',
                                        borderRadius: '6px',
                                        color: '#ef4444',
                                        fontWeight: '600',
                                        cursor: (currentGraduation && selectedStil.graduierungen && selectedStil.graduierungen.findIndex(g => g.graduierung_id === currentGraduation.graduierung_id) > 0)
                                          ? 'pointer'
                                          : 'not-allowed',
                                        fontSize: '0.9rem',
                                        opacity: (!currentGraduation || !selectedStil.graduierungen || selectedStil.graduierungen.findIndex(g => g.graduierung_id === currentGraduation.graduierung_id) === 0) ? 0.3 : 1
                                      }}
                                    >
                                      ⬇️ Niedriger
                                    </button>
                                    <button
                                      className="grad-btn grad-btn-up"
                                      onClick={() => {
                                        console.log('🔘 Höher-Button geklickt! CurrentGrad:', currentGraduation?.name);
                                        handleGraduationArrowChange(currentGraduation?.graduierung_id, 'down');
                                      }}
                                      disabled={!currentGraduation || !selectedStil.graduierungen || selectedStil.graduierungen.findIndex(g => g.graduierung_id === currentGraduation.graduierung_id) === selectedStil.graduierungen.length - 1}
                                      style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        background: (currentGraduation && selectedStil.graduierungen && selectedStil.graduierungen.findIndex(g => g.graduierung_id === currentGraduation.graduierung_id) < selectedStil.graduierungen.length - 1)
                                          ? 'rgba(34, 197, 94, 0.2)'
                                          : 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid #22c55e',
                                        borderRadius: '6px',
                                        color: '#22c55e',
                                        fontWeight: '600',
                                        cursor: (currentGraduation && selectedStil.graduierungen && selectedStil.graduierungen.findIndex(g => g.graduierung_id === currentGraduation.graduierung_id) < selectedStil.graduierungen.length - 1)
                                          ? 'pointer'
                                          : 'not-allowed',
                                        fontSize: '0.9rem',
                                        opacity: (!currentGraduation || !selectedStil.graduierungen || selectedStil.graduierungen.findIndex(g => g.graduierung_id === currentGraduation.graduierung_id) === selectedStil.graduierungen.length - 1) ? 0.3 : 1
                                      }}
                                    >
                                      ⬆️ Höher
                                    </button>
                                  </div>
                                )}
                              </div>

                              {isActiveStyle && currentGraduation && (
                                <>
                                  <div>
                                    <label style={{ textTransform: 'none', fontSize: '0.9rem' }}>Mindest-Trainingsstunden:</label>
                                    <span>{currentGraduation.trainingsstunden_min || 0} Stunden</span>
                                  </div>
                                  <div>
                                    <label style={{ textTransform: 'none', fontSize: '0.9rem' }}>Mindestzeit:</label>
                                    <span>{currentGraduation.mindestzeit_monate || 0} Monate</span>
                                  </div>
                                  {currentGraduation.kategorie && (
                                    <div>
                                      <label style={{ textTransform: 'none', fontSize: '0.9rem' }}>Kategorie:</label>
                                      <span style={{
                                        display: 'inline-block',
                                        padding: '0.25rem 0.75rem',
                                        background: 'rgba(255, 215, 0, 0.2)',
                                        border: '1px solid #FFD700',
                                        borderRadius: '12px',
                                        color: '#FFD700',
                                        fontSize: '0.85rem',
                                        fontWeight: '600'
                                      }}>
                                        {currentGraduation.kategorie}
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}

                              <div>
                                <label style={{ textTransform: 'none', fontSize: '0.9rem' }}>Letzte Prüfung:</label>
                                {editMode && isActiveStyle ? (
                                  <input
                                    type="date"
                                    value={lastExamDate}
                                    onChange={(e) => setLastExamDate(e.target.value)}
                                  />
                                ) : (
                                  <span>
                                    {lastExamDate
                                      ? new Date(lastExamDate).toLocaleDateString("de-DE")
                                      : "Keine Prüfung dokumentiert"}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Karte 2: Beschreibung */}
                            <div className="field-group card">
                              <h3>Beschreibung</h3>
                              <div>
                                <label style={{ textTransform: 'none', fontSize: '0.9rem' }}>Über diesen Stil:</label>
                                <p style={{ color: '#ccc', fontSize: '0.95rem', lineHeight: '1.6', marginTop: '0.5rem' }}>
                                  {memberStil.beschreibung || fullStilData?.beschreibung || "Keine Beschreibung verfügbar"}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Karte 3: Alle Graduierungen - Volle Breite - Einklappbar */}
                          <div className="grid-container" style={{ marginTop: '1.5rem' }}>
                            <div className="field-group card">
                              <div
                                onClick={() => {
                                  setGraduationListCollapsed(!graduationListCollapsed);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  padding: '0.5rem',
                                  margin: '-0.5rem -0.5rem 0.5rem -0.5rem',
                                  borderRadius: '6px',
                                  transition: 'background 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(255, 215, 0, 0.05)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <h3 style={{ margin: 0 }}>📊 Alle Graduierungen - {memberStil.stil_name}</h3>
                                <span style={{
                                  fontSize: '1.5rem',
                                  color: '#FFD700',
                                  transform: graduationListCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                                  transition: 'transform 0.3s ease',
                                  display: 'inline-block'
                                }}>
                                  ▼
                                </span>
                              </div>

                              {!graduationListCollapsed && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
                                  {fullStilData && fullStilData.graduierungen && fullStilData.graduierungen.length > 0 ? (
                                    fullStilData.graduierungen
                                      .sort((a, b) => a.reihenfolge - b.reihenfolge)
                                      .map((graduation, index) => (
                                        <div
                                          key={graduation.graduierung_id}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '1rem',
                                            padding: '0.75rem',
                                            background: (isActiveStyle && currentGraduation?.graduierung_id === graduation.graduierung_id)
                                              ? 'rgba(255, 215, 0, 0.15)'
                                              : 'rgba(255, 255, 255, 0.03)',
                                            border: (isActiveStyle && currentGraduation?.graduierung_id === graduation.graduierung_id)
                                              ? '2px solid #FFD700'
                                              : '1px solid rgba(255, 255, 255, 0.1)',
                                            borderRadius: '8px',
                                            transition: 'all 0.2s ease'
                                          }}
                                        >
                                          <BeltPreview
                                            primaer={graduation.farbe_hex}
                                            sekundaer={graduation.farbe_sekundaer}
                                            size="small"
                                          />
                                          <div style={{ flex: 1 }}>
                                            <div style={{
                                              fontWeight: (isActiveStyle && currentGraduation?.graduierung_id === graduation.graduierung_id) ? '700' : '600',
                                              color: (isActiveStyle && currentGraduation?.graduierung_id === graduation.graduierung_id) ? '#FFD700' : '#fff',
                                              fontSize: '0.95rem'
                                            }}>
                                              {graduation.name}
                                              {(isActiveStyle && currentGraduation?.graduierung_id === graduation.graduierung_id) && (
                                                <span style={{ marginLeft: '0.5rem', color: '#FFD700', fontSize: '0.85rem' }}>
                                                  ⭐ Aktuell
                                                </span>
                                              )}
                                            </div>
                                            <div style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                                              {graduation.reihenfolge || index + 1}. Kyu · {graduation.trainingsstunden_min}h · {graduation.mindestzeit_monate} Monate
                                            </div>
                                          </div>
                                        </div>
                                      ))
                                  ) : (
                                    <p style={{ textAlign: 'center', color: '#999', padding: '1rem' }}>
                                      Keine Graduierungen verfügbar
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="grid-container">
                      <div className="field-group card">
                        <h3>Stil-Verwaltung</h3>
                        <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                          Keine Stile zugeordnet
                        </p>
                        <p style={{ textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                          Verwenden Sie das Auswahlfeld oben, um einen Stil hinzuzufügen.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {styleSubTab === "pruefung" && (
                <div className="pruefung-sub-tab-content">
                  {/* Neue Prüfungsstatus-Komponente */}
                  <PruefungsStatus
                    mitgliedId={id}
                    readOnly={!isAdmin}
                  />
                </div>
              )}
            </div>
          )}


            </motion.div>
          </AnimatePresence>

        </div>
      </div>

      {/* Neuer Vertrag Modal - CACHE BREAK v2.0 */}
      {showNewVertrag && (
        <div className="modal-overlay" onClick={() => setShowNewVertrag(false)} data-version="2.0-vertragformular">
          <div
            className="modal-content vertrag-modal-custom"
            onClick={e => e.stopPropagation()}
            style={{
              width: '750px',
              maxWidth: '90vw',
              minWidth: 'auto'
            }}
          >
            <div className="modal-header">
              <h3>Neuer Vertrag</h3>
              <button
                className="close-btn"
                onClick={() => setShowNewVertrag(false)}
              >
                ?
              </button>
            </div>

            {/* VertragFormular Komponente verwenden - NEU! */}
            <VertragFormular
              vertrag={{
                tarif_id: newVertrag.tarif_id,
                billing_cycle: newVertrag.billing_cycle,
                payment_method: newVertrag.payment_method,
                vertragsbeginn: newVertrag.vertragsbeginn,
                vertragsende: newVertrag.vertragsende,
                kuendigungsfrist_monate: newVertrag.kuendigungsfrist_monate,
                mindestlaufzeit_monate: newVertrag.mindestlaufzeit_monate,
                agb_akzeptiert: newVertrag.agb_akzeptiert,
                datenschutz_akzeptiert: newVertrag.datenschutz_akzeptiert,
                hausordnung_akzeptiert: newVertrag.hausordnung_akzeptiert,
                haftungsausschluss_akzeptiert: newVertrag.haftungsausschluss_akzeptiert,
                gesundheitserklaerung: newVertrag.gesundheitserklaerung,
                foto_einverstaendnis: newVertrag.foto_einverstaendnis,
                agb_version: newVertrag.agb_version,
                datenschutz_version: newVertrag.datenschutz_version,
                sepa_mandat_id: newVertrag.sepa_mandat_id
              }}
              onChange={(updatedVertrag) => {
                setNewVertrag({
                  ...newVertrag,
                  tarif_id: updatedVertrag.tarif_id,
                  billing_cycle: updatedVertrag.billing_cycle,
                  payment_method: updatedVertrag.payment_method,
                  vertragsbeginn: updatedVertrag.vertragsbeginn,
                  vertragsende: updatedVertrag.vertragsende,
                  kuendigungsfrist_monate: updatedVertrag.kuendigungsfrist_monate,
                  mindestlaufzeit_monate: updatedVertrag.mindestlaufzeit_monate,
                  agb_akzeptiert: updatedVertrag.agb_akzeptiert,
                  datenschutz_akzeptiert: updatedVertrag.datenschutz_akzeptiert,
                  hausordnung_akzeptiert: updatedVertrag.hausordnung_akzeptiert,
                  haftungsausschluss_akzeptiert: updatedVertrag.haftungsausschluss_akzeptiert,
                  gesundheitserklaerung: updatedVertrag.gesundheitserklaerung,
                  foto_einverstaendnis: updatedVertrag.foto_einverstaendnis,
                  agb_version: updatedVertrag.agb_version,
                  datenschutz_version: updatedVertrag.datenschutz_version,
                  sepa_mandat_id: updatedVertrag.sepa_mandat_id
                });
              }}
              geburtsdatum={mitglied?.geburtsdatum}
              schuelerStudent={mitglied?.schueler_student}
              mode="create"
              mitgliedId={id}
            />

            <div className="form-actions" style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowNewVertrag(false)}
              >
                Abbrechen
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                onClick={handleSaveVertrag}
                disabled={!newVertrag.agb_akzeptiert || !newVertrag.datenschutz_akzeptiert || !newVertrag.hausordnung_akzeptiert || !newVertrag.tarif_id || !mitglied?.dojo_id}
              >
                ✅ Vertrag erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Vertrag Bearbeiten Modal */}
      {editingVertrag && (
        <div className="modal-overlay" onClick={() => setEditingVertrag(null)}>
          <div
            className="modal-content vertrag-modal-custom"
            onClick={e => e.stopPropagation()}
            style={{
              width: '800px',
              maxWidth: '90vw',
              minWidth: 'auto'
            }}
          >
            <div className="modal-header">
              <h3>Vertrag bearbeiten</h3>
              <button 
                className="close-btn"
                onClick={() => setEditingVertrag(null)}
              >
                ?
              </button>
            </div>
            
            <div className="form-grid">
              <div className="form-group">
                <label>Status</label>
                <CustomSelect
                  value={editingVertrag.status}
                  onChange={(e) => setEditingVertrag({...editingVertrag, status: e.target.value})}
                  options={[
                    { value: 'aktiv', label: 'Aktiv' },
                    { value: 'ruhepause', label: 'Ruhepause' },
                    { value: 'gekuendigt', label: 'Gekündigt' },
                    { value: 'beendet', label: 'Beendet' }
                  ]}
                />
              </div>
              
              <div className="form-group">
                <label>Vertragsbeginn</label>
                <input
                  type="date"
                  value={editingVertrag.vertragsbeginn}
                  onChange={(e) => setEditingVertrag({...editingVertrag, vertragsbeginn: e.target.value})}
                />
              </div>
              
              <div className="form-group">
                <label>Vertragsende</label>
                <input
                  type="date"
                  value={editingVertrag.vertragsende}
                  onChange={(e) => setEditingVertrag({...editingVertrag, vertragsende: e.target.value})}
                />
              </div>
              
              {editingVertrag.status === 'gekuendigt' && (
                <div className="form-group">
                  <label>Kündigung eingegangen</label>
                  <input
                    type="date"
                    value={editingVertrag.kuendigung_eingegangen || ''}
                    onChange={(e) => setEditingVertrag({...editingVertrag, kuendigung_eingegangen: e.target.value})}
                  />
                </div>
              )}
            </div>
            
            <div className="form-actions">
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingVertrag(null)}
              >
                Abbrechen
              </button>
              <button 
                type="submit"
                className="btn btn-primary"
                onClick={handleSaveVertrag}
              >
                💾 Änderungen speichern
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ruhepause Modal */}
      {showRuhepauseModal && (
        <div className="modal-overlay" onClick={() => setShowRuhepauseModal(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Ruhepause einrichten</h3>
              <button
                className="close-btn"
                onClick={() => setShowRuhepauseModal(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="info-section">
              <h4>ℹ️ Was bedeutet Ruhepause?</h4>
              <ul>
                <li>Das Training wird temporär ausgesetzt</li>
                <li>Die Mitgliedschaft bleibt bestehen</li>
                <li>Keine Beitragszahlungen während der Ruhepause</li>
                <li>Vertrag wird nicht im Lastschriftlauf berücksichtigt</li>
                <li>Nach der Ruhepause automatische Reaktivierung</li>
                <li>Maximale Ruhepause: 12 Monate pro Jahr</li>
              </ul>
            </div>

            <div className="ruhepause-config-container">
              <div className="ruhepause-duration-selection">
                <label>Dauer der Ruhepause *</label>
                <CustomSelect
                  value={ruhepauseDauer}
                  onChange={(e) => setRuhepauseDauer(parseInt(e.target.value))}
                  options={[
                    { value: 1, label: '1 Monat' },
                    { value: 2, label: '2 Monate' },
                    { value: 3, label: '3 Monate' },
                    { value: 4, label: '4 Monate' },
                    { value: 5, label: '5 Monate' },
                    { value: 6, label: '6 Monate' },
                    { value: 9, label: '9 Monate' },
                    { value: 12, label: '12 Monate' }
                  ]}
                />
                <small>Ruhepausen gelten immer für volle Monate</small>
              </div>

              <div className="date-info">
                <h5>📅 Zeitraum</h5>
                <p><strong>Von:</strong> {(() => {
                  const von = new Date();
                  von.setMonth(von.getMonth() + 1); // Nächster Monat
                  von.setDate(1); // Erster Tag des nächsten Monats
                  return von.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                })()}</p>
                <p><strong>Bis:</strong> {(() => {
                  const bis = new Date();
                  bis.setMonth(bis.getMonth() + 1 + ruhepauseDauer); // Nächster Monat + Dauer
                  bis.setDate(0); // Letzter Tag des Monats
                  return bis.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                })()}</p>
              </div>

              <div className="warning-section">
                <h5>⚠️ Wichtiger Hinweis</h5>
                <p>Die Ruhepause beginnt am 1. des nächsten Monats (aktueller Monat ist bereits abgebucht). Das Training kann für die gewählte Dauer nicht besucht werden. Keine Lastschrifteinzüge während der Ruhepause.</p>
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowRuhepauseModal(false)}
              >
                Abbrechen
              </button>
              <button 
                type="submit"
                className="btn btn-warning"
                onClick={handleRuhepauseConfirm}
              >
                ⏸️ Ruhepause für {ruhepauseDauer} Monat{ruhepauseDauer > 1 ? 'e' : ''} einrichten
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kündigung Modal */}
      {showKündigungModal && (
        <div className="modal-overlay" onClick={() => setShowKündigungModal(false)}>
          <div className="modal-content extra-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Vertrag kündigen</h3>
              <button
                className="close-btn"
                onClick={() => setShowKündigungModal(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="cancellation-terms">
              <h4>📋 Kündigungsbestimmungen</h4>

              <div className="terms-sections-container">
                <div className="terms-section">
                  <h5>⏰ Kündigungsfristen:</h5>
                  <ul>
                    <li><strong>Erstlaufzeit:</strong> Kündigung bis 3 Monate vor Vertragsende möglich</li>
                    <li><strong>Nach Verlängerung:</strong> Kündigung mit 1 Monat Frist zum Monatsende</li>
                    <li><strong>Sonderkündigungsrecht:</strong> Bei Umzug über 25km Entfernung (Nachweis erforderlich)</li>
                  </ul>
                </div>

                <div className="terms-section">
                  <h5>📋 Kündigungsregelungen:</h5>
                  <ul>
                    <li>Bei vorzeitiger Kündigung: Zahlung der Restlaufzeit</li>
                    <li>Keine Rückerstattung bereits gezahlter Beiträge</li>
                  </ul>
                </div>

                <div className="current-contract-info">
                  <h5>📄 Aktueller Vertrag:</h5>
                  <p><strong>Vertragslaufzeit:</strong> {selectedVertragForAction?.vertragsbeginn ? new Date(selectedVertragForAction.vertragsbeginn).toLocaleDateString('de-DE') : '-'} - {selectedVertragForAction?.vertragsende ? new Date(selectedVertragForAction.vertragsende).toLocaleDateString('de-DE') : '-'}</p>
                  <p><strong>Früheste Kündigung:</strong> {(() => {
                    if (!selectedVertragForAction) return 'Berechnung nicht möglich';
                    const vertragsende = new Date(selectedVertragForAction.vertragsende);
                    const fruehestKündigung = new Date(vertragsende);
                    fruehestKündigung.setMonth(vertragsende.getMonth() - 3);
                    return fruehestKündigung.toLocaleDateString('de-DE');
                  })()}</p>
                  <p><strong>Vertragsende:</strong> {new Date(selectedVertragForAction?.vertragsende || '').toLocaleDateString('de-DE')}</p>
                </div>
              </div>
            </div>

            <div className="kuendigung-form-container">
              <div className="form-group">
                <label>Kündigungsdatum *</label>
                <input
                  type="date"
                  value={kuendigungsdatum}
                  onChange={(e) => setKündigungsdatum(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
                <small>Das Datum, an dem die Kündigung eingegangen ist</small>
              </div>

              <div className="form-group">
                <label>Kündigungsgrund (Optional)</label>
                <CustomSelect
                  value={kuendigungsgrund}
                  onChange={(e) => setKündigungsgrund(e.target.value)}
                  options={[
                    { value: '', label: 'Bitte wählen...' },
                    { value: 'umzug', label: 'Umzug' },
                    { value: 'finanzielle-gruende', label: 'Finanzielle Gründe' },
                    { value: 'zeitmangel', label: 'Zeitmangel' },
                    { value: 'krankheit', label: 'Krankheit/Verletzung' },
                    { value: 'unzufriedenheit', label: 'Unzufriedenheit mit Service' },
                    { value: 'anderer-verein', label: 'Wechsel zu anderem Verein' },
                    { value: 'sonstiges', label: 'Sonstiges' }
                  ]}
                />
              </div>

              <div className="confirmation-section-inline">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={kuendigungsbestätigung}
                    onChange={(e) => setKündigungsbestätigung(e.target.checked)}
                  />
                  <span className="checkmark"></span>
                  <div className="confirmation-text">
                    <strong>⚠️ Bestätigung erforderlich:</strong>
                    <p>Ich habe die Kündigungsbestimmungen gelesen und verstanden. Mir ist bewusst, dass bei vorzeitiger Kündigung die Restlaufzeit zu zahlen ist und keine Rückerstattung bereits gezahlter Beiträge erfolgt.</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowKündigungModal(false)}
              >
                Abbrechen
              </button>
              <button 
                type="submit"
                className="btn btn-danger"
                onClick={handleKündigungConfirm}
                disabled={!kuendigungsbestätigung}
              >
                ❌ Vertrag kündigen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details-Modal - Dokument-ähnliche VertragsÜbersicht */}
      {showVertragDetails && selectedVertrag && (
        <div
          className="modal-overlay"
          onClick={() => setShowVertragDetails(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
          }}
        >
          <div
            className="vertrag-dokument"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '800px',
              width: '100%',
              maxHeight: '95vh',
              overflowY: 'auto',
              background: 'white',
              borderRadius: '8px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
              position: 'relative',
              color: '#333'
            }}
          >
            <style>{`
              .vertrag-dokument .detail-item {
                color: #333;
                margin-bottom: 0.5rem;
              }
              .vertrag-dokument .detail-item strong {
                color: #555;
              }
              .vertrag-dokument * {
                color: #333;
              }
            `}</style>
            {/* Close Button */}
            <button
              onClick={() => setShowVertragDetails(false)}
              style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: '#d32f2f',
                color: 'white',
                border: 'none',
                fontSize: '20px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                zIndex: 1000
              }}
            >
              ?
            </button>

            {/* Dokument-Inhalt */}
            <div style={{ padding: '3rem 2.5rem' }}>
              {/* Header */}
              <div style={{
                borderBottom: '3px solid #1976d2',
                paddingBottom: '1.5rem',
                marginBottom: '2rem',
                textAlign: 'center'
              }}>
                <h1 style={{
                  fontSize: '1.8rem',
                  fontWeight: '600',
                  color: '#1976d2',
                  margin: '0 0 0.5rem 0',
                  letterSpacing: '0.5px'
                }}>
                  VERTRAGSDETAILS
                </h1>
                <div style={{
                  fontSize: '1rem',
                  color: '#666',
                  fontWeight: '500'
                }}>
                  Vertragsnummer: {selectedVertrag.vertragsnummer || `VTR-${selectedVertrag.id}`}
                </div>
              </div>

              {/* Status Badge */}
              <div style={{
                marginBottom: '2rem',
                textAlign: 'center',
                padding: '1rem',
                background: selectedVertrag.status === 'aktiv' ? '#e8f5e9' :
                           selectedVertrag.status === 'gekuendigt' ? '#fff3e0' :
                           selectedVertrag.status === 'ruhepause' ? '#e3f2fd' : '#ffebee',
                borderRadius: '6px',
                border: '2px solid ' + (
                  selectedVertrag.status === 'aktiv' ? '#4caf50' :
                  selectedVertrag.status === 'gekuendigt' ? '#ff9800' :
                  selectedVertrag.status === 'ruhepause' ? '#2196f3' : '#f44336'
                )
              }}>
                <span style={{
                  fontSize: '1.2rem',
                  fontWeight: '600',
                  color: selectedVertrag.status === 'aktiv' ? '#2e7d32' :
                         selectedVertrag.status === 'gekuendigt' ? '#e65100' :
                         selectedVertrag.status === 'ruhepause' ? '#1565c0' : '#c62828'
                }}>
                  {selectedVertrag.status === 'aktiv' ? '? VERTRAG AKTIV' :
                   selectedVertrag.status === 'gekuendigt' ? '? VERTRAG GEKÜNDIGT' :
                   selectedVertrag.status === 'ruhepause' ? '? VERTRAG IN RUHEPAUSE' : '? VERTRAG BEENDET'}
                </span>
              </div>

              {/* Grunddaten */}
              <div style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                background: '#f8f9fa',
                borderRadius: '6px',
                border: '1px solid #dee2e6'
              }}>
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: '#1976d2',
                  marginTop: '0',
                  marginBottom: '1.5rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '2px solid #1976d2'
                }}>📋 Grunddaten</h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '1rem',
                  fontSize: '0.95rem',
                  color: '#333'
                }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ color: '#555' }}>Vertrags-ID:</strong> #{selectedVertrag.id}
                  </div>
                  {selectedVertrag.vertragsnummer && (
                    <div className="detail-item">
                      <strong>Vertragsnummer:</strong> {selectedVertrag.vertragsnummer}
                    </div>
                  )}
                  <div className="detail-item">
                    <strong>Mitglied-ID:</strong> #{selectedVertrag.mitglied_id}
                  </div>
                  <div className="detail-item">
                    <strong>Dojo:</strong> {getDojoName(selectedVertrag.dojo_id)}
                  </div>
                  <div className="detail-item">
                    <strong>Status:</strong> {
                      selectedVertrag.status === 'aktiv' ? '✅ Aktiv' :
                      selectedVertrag.status === 'gekuendigt' ? '❌ Gekündigt' :
                      selectedVertrag.status === 'ruhepause' ? '⏸️ Ruhepause' : '⏹️ Beendet'
                    }
                  </div>
                  <div className="detail-item">
                    <strong>Erstellt am:</strong> {new Date(selectedVertrag.created_at || selectedVertrag.unterschrift_datum).toLocaleString('de-DE')}
                  </div>
                  {selectedVertrag.created_by && (
                    <div className="detail-item">
                      <strong>Erstellt von (User-ID):</strong> #{selectedVertrag.created_by}
                    </div>
                  )}
                  {selectedVertrag.updated_at && (
                    <div className="detail-item">
                      <strong>Zuletzt geändert:</strong> {new Date(selectedVertrag.updated_at).toLocaleString('de-DE')}
                    </div>
                  )}
                  {selectedVertrag.updated_by && (
                    <div className="detail-item">
                      <strong>Geändert von (User-ID):</strong> #{selectedVertrag.updated_by}
                    </div>
                  )}
                  {selectedVertrag.tarif_id && (
                    <div className="detail-item">
                      <strong>Tarif-ID:</strong> #{selectedVertrag.tarif_id}
                    </div>
                  )}
                  {selectedVertrag.tarif_name && (
                    <div className="detail-item">
                      <strong>📋 Tarif-Name:</strong> {selectedVertrag.tarif_name}
                    </div>
                  )}
                  {selectedVertrag.monatsbeitrag && (
                    <div className="detail-item">
                      <strong>💰 Monatsbeitrag:</strong> €{parseFloat(selectedVertrag.monatsbeitrag).toFixed(2)}
                    </div>
                  )}
                  {selectedVertrag.aufnahmegebuehr_cents && (
                    <div className="detail-item">
                      <strong>💵 Aufnahmegebühr:</strong> €{(selectedVertrag.aufnahmegebuehr_cents / 100).toFixed(2)}
                    </div>
                  )}
                  <div className="detail-item">
                    <strong>📄 Vertrags-PDF:</strong>{' '}
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => downloadVertragPDF(selectedVertrag.id)}
                      style={{
                        padding: '0.25rem 0.75rem',
                        fontSize: '0.875rem',
                        marginLeft: '0.5rem'
                      }}
                    >
                      📄 PDF
                    </button>
                  </div>
                </div>
              </div>

              {/* Laufzeit */}
              {(selectedVertrag.vertragsbeginn || selectedVertrag.vertragsende) && (
                <div style={{
                  marginBottom: '2rem',
                  padding: '1.5rem',
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6'
                }}>
                  <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: '#1976d2',
                    marginTop: '0',
                    marginBottom: '1.5rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '2px solid #1976d2'
                  }}>📅 Laufzeit</h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '1rem',
                    fontSize: '0.95rem'
                  }}>
                    {selectedVertrag.vertragsbeginn && (
                      <div className="detail-item">
                        <strong>Vertragsbeginn:</strong> {new Date(selectedVertrag.vertragsbeginn).toLocaleDateString('de-DE')}
                      </div>
                    )}
                    {selectedVertrag.vertragsende && (
                      <div className="detail-item">
                        <strong>Vertragsende:</strong> {new Date(selectedVertrag.vertragsende).toLocaleDateString('de-DE')}
                      </div>
                    )}
                    <div className="detail-item">
                      <strong>Mindestlaufzeit:</strong> {selectedVertrag.mindestlaufzeit_monate} Monate
                    </div>
                    <div className="detail-item">
                      <strong>Kündigungsfrist:</strong> {selectedVertrag.kuendigungsfrist_monate} Monate vor Vertragsende
                    </div>
                    <div className="detail-item">
                      <strong>Autom. Verlängerung:</strong> {selectedVertrag.automatische_verlaengerung ? `Ja (um ${selectedVertrag.verlaengerung_monate} Monate)` : 'Nein'}
                    </div>
                  </div>
                </div>
              )}

              {/* Zahlung */}
              <div style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                background: '#f8f9fa',
                borderRadius: '6px',
                border: '1px solid #dee2e6'
              }}>
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: '#1976d2',
                  marginTop: '0',
                  marginBottom: '1.5rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '2px solid #1976d2'
                }}>💳 Zahlungsinformationen</h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '1rem',
                  fontSize: '0.95rem'
                }}>
                  {selectedVertrag.billing_cycle && (
                    <div className="detail-item">
                      <strong>Zahlungsintervall:</strong> {translateBillingCycle(selectedVertrag.billing_cycle)}
                    </div>
                  )}
                  {selectedVertrag.payment_method && (
                    <div className="detail-item">
                      <strong>Zahlungsmethode:</strong> {
                        selectedVertrag.payment_method === 'direct_debit' ? 'SEPA-Lastschrift' :
                        selectedVertrag.payment_method === 'transfer' ? 'Überweisung' :
                        selectedVertrag.payment_method === 'bar' ? 'Bar' : selectedVertrag.payment_method
                      }
                    </div>
                  )}
                  {selectedVertrag.sepa_mandat_id && (
                    <div className="detail-item">
                      <strong>SEPA-Mandat-ID:</strong> #{selectedVertrag.sepa_mandat_id}
                    </div>
                  )}
                  {selectedVertrag.faelligkeit_tag && (
                    <div className="detail-item">
                      <strong>Fälligkeitstag:</strong> {selectedVertrag.faelligkeit_tag}. des Monats
                    </div>
                  )}
                  {selectedVertrag.monatsbeitrag && (
                    <div className="detail-item">
                      <strong>Monatsbeitrag:</strong> €{parseFloat(selectedVertrag.monatsbeitrag).toFixed(2)}
                    </div>
                  )}
                  {selectedVertrag.aufnahmegebuehr_cents && (
                    <div className="detail-item">
                      <strong>Aufnahmegebühr:</strong> €{(selectedVertrag.aufnahmegebuehr_cents / 100).toFixed(2)}
                    </div>
                  )}
                  {selectedVertrag.rabatt_prozent > 0 && (
                    <div className="detail-item">
                      <strong>Rabatt:</strong> {selectedVertrag.rabatt_prozent}%
                      {selectedVertrag.rabatt_grund && ` (${selectedVertrag.rabatt_grund})`}
                    </div>
                  )}
                </div>
              </div>

              {/* Rechtliche Akzeptanzen */}
              <div style={{
                marginBottom: '2rem',
                padding: '1.5rem',
                background: '#f8f9fa',
                borderRadius: '6px',
                border: '1px solid #dee2e6'
              }}>
                <h3 style={{
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: '#1976d2',
                  marginTop: '0',
                  marginBottom: '1.5rem',
                  paddingBottom: '0.75rem',
                  borderBottom: '2px solid #1976d2'
                }}>? Rechtliche Akzeptanzen</h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '1rem',
                  fontSize: '0.95rem'
                }}>
                  {selectedVertrag.agb_akzeptiert_am && (
                    <div className="detail-item">
                      <strong>AGB:</strong> ✅ Akzeptiert am {new Date(selectedVertrag.agb_akzeptiert_am).toLocaleString('de-DE')}
                      {selectedVertrag.agb_version && ` (v${selectedVertrag.agb_version})`}
                    </div>
                  )}
                  {selectedVertrag.datenschutz_akzeptiert_am && (
                    <div className="detail-item">
                      <strong>Datenschutz:</strong> ? Akzeptiert am {new Date(selectedVertrag.datenschutz_akzeptiert_am).toLocaleString('de-DE')}
                      {selectedVertrag.datenschutz_version && ` (v${selectedVertrag.datenschutz_version})`}
                    </div>
                  )}
                  {selectedVertrag.hausordnung_akzeptiert_am && (
                    <div className="detail-item">
                      <strong>Hausordnung:</strong> ? Akzeptiert am {new Date(selectedVertrag.hausordnung_akzeptiert_am).toLocaleString('de-DE')}
                    </div>
                  )}
                  <div className="detail-item">
                    <strong>Haftungsausschluss (boolean):</strong> {selectedVertrag.haftungsausschluss_akzeptiert ? '? Ja' : '? Nein'}
                  </div>
                  {selectedVertrag.haftungsausschluss_datum && (
                    <div className="detail-item">
                      <strong>Haftungsausschluss Datum:</strong> ? Akzeptiert am {new Date(selectedVertrag.haftungsausschluss_datum).toLocaleString('de-DE')}
                    </div>
                  )}
                  <div className="detail-item">
                    <strong>Gesundheitserklärung (boolean):</strong> {selectedVertrag.gesundheitserklaerung ? '? Ja' : '? Nein'}
                  </div>
                  {selectedVertrag.gesundheitserklaerung_datum && (
                    <div className="detail-item">
                      <strong>Gesundheitserklärung Datum:</strong> ? Abgegeben am {new Date(selectedVertrag.gesundheitserklaerung_datum).toLocaleString('de-DE')}
                    </div>
                  )}
                  <div className="detail-item">
                    <strong>Foto-Einverständnis (boolean):</strong> {selectedVertrag.foto_einverstaendnis ? '? Ja' : '? Nein'}
                  </div>
                  {selectedVertrag.foto_einverstaendnis_datum && (
                    <div className="detail-item">
                      <strong>Foto-Einverständnis Datum:</strong> ? Erteilt am {new Date(selectedVertrag.foto_einverstaendnis_datum).toLocaleString('de-DE')}
                    </div>
                  )}
                  {selectedVertrag.widerruf_akzeptiert_am && (
                    <div className="detail-item">
                      <strong>Widerrufsbelehrung:</strong> ? Zur Kenntnis genommen am {new Date(selectedVertrag.widerruf_akzeptiert_am).toLocaleString('de-DE')}
                    </div>
                  )}
                </div>
              </div>

              {/* Unterschrift */}
              {selectedVertrag.unterschrift_datum && (
                <div style={{
                  marginBottom: '2rem',
                  padding: '1.5rem',
                  background: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #dee2e6'
                }}>
                  <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: '#1976d2',
                    marginTop: '0',
                    marginBottom: '1.5rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '2px solid #1976d2'
                  }}>✍️ Unterschrift</h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '1rem',
                    fontSize: '0.95rem'
                  }}>
                    <div className="detail-item">
                      <strong>Unterschrieben am:</strong> {new Date(selectedVertrag.unterschrift_datum).toLocaleString('de-DE')}
                    </div>
                    {selectedVertrag.unterschrift_ip && (
                      <div className="detail-item">
                        <strong>IP-Adresse:</strong> {selectedVertrag.unterschrift_ip}
                      </div>
                    )}
                  </div>
                  {selectedVertrag.unterschrift_digital && (
                    <div style={{ marginTop: '1rem' }}>
                      <strong>Digitale Unterschrift:</strong>
                      <div style={{
                        marginTop: '0.5rem',
                        border: '1px solid rgba(255, 215, 0, 0.3)',
                        borderRadius: '4px',
                        padding: '1rem',
                        background: 'white',
                        display: 'inline-block'
                      }}>
                        <img
                          src={selectedVertrag.unterschrift_digital}
                          alt="Digitale Unterschrift"
                          style={{ maxWidth: '400px', maxHeight: '200px', display: 'block' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Status-Informationen */}
              {selectedVertrag.kuendigung_eingegangen && (
                <div style={{
                  marginBottom: '2rem',
                  padding: '1.5rem',
                  background: '#fff3e0',
                  borderRadius: '6px',
                  border: '2px solid #ff9800'
                }}>
                  <h3 style={{
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    color: '#e65100',
                    marginTop: '0',
                    marginBottom: '1.5rem',
                    paddingBottom: '0.75rem',
                    borderBottom: '2px solid #ff9800'
                  }}>ℹ️ Kündigungsinformationen</h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '1rem',
                    fontSize: '0.95rem'
                  }}>
                    <div className="detail-item">
                      <strong>Kündigung eingegangen:</strong> {new Date(selectedVertrag.kuendigung_eingegangen).toLocaleString('de-DE')}
                    </div>
                    {selectedVertrag.kuendigungsgrund && (
                      <div className="detail-item">
                        <strong>Kündigungsgrund:</strong> {selectedVertrag.kuendigungsgrund}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {/* Drucken/Schließen Buttons */}
              <div style={{
                marginTop: '2rem',
                paddingTop: '2rem',
                borderTop: '2px solid #1976d2',
                display: 'flex',
                gap: '1rem',
                justifyContent: 'center'
              }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    padding: '0.75rem 2rem',
                    background: '#1976d2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  🖨️ Drucken
                </button>
                <button
                  onClick={() => setShowVertragDetails(false)}
                  style={{
                    padding: '0.75rem 2rem',
                    background: '#757575',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Strukturiertes Details-Modal - Alle Vertragsdaten übersichtlich */}
      {showStructuredDetails && selectedVertrag && (
        <div
          className="modal-overlay"
          onClick={() => setShowStructuredDetails(false)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1000
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: '900px',
              width: '100%',
              maxHeight: '95vh',
              overflowY: 'auto',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              borderRadius: '16px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
              position: 'relative',
              color: '#fff',
              border: '1px solid rgba(255, 215, 0, 0.3)'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowStructuredDetails(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(244, 67, 54, 0.9)',
                color: 'white',
                border: 'none',
                fontSize: '24px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(244, 67, 54, 0.4)',
                transition: 'all 0.2s ease',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#d32f2f';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(244, 67, 54, 0.9)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              ×
            </button>

            {/* Header */}
            <div style={{
              padding: '2rem',
              borderBottom: '2px solid rgba(255, 215, 0, 0.3)',
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 165, 0, 0.05) 100%)'
            }}>
              <h2 style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1.8rem',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text'
              }}>
                🔍 Vertragsdetails
              </h2>
              <p style={{
                margin: 0,
                fontSize: '1rem',
                color: 'rgba(255, 255, 255, 0.7)'
              }}>
                Vertrag #{selectedVertrag.personenVertragNr} • {mitglied?.vorname} {mitglied?.nachname}
              </p>
            </div>

            {/* Content */}
            <div style={{ padding: '2rem' }}>
              {/* Status Badge */}
              <div style={{
                display: 'inline-flex',
                padding: '0.5rem 1.5rem',
                borderRadius: '24px',
                fontSize: '0.9rem',
                fontWeight: '600',
                marginBottom: '2rem',
                background: selectedVertrag.status === 'aktiv' ? 'rgba(76, 175, 80, 0.2)' :
                           selectedVertrag.status === 'gekuendigt' ? 'rgba(255, 152, 0, 0.2)' :
                           selectedVertrag.status === 'ruhepause' ? 'rgba(33, 150, 243, 0.2)' : 'rgba(244, 67, 54, 0.2)',
                border: '2px solid ' + (
                  selectedVertrag.status === 'aktiv' ? '#4caf50' :
                  selectedVertrag.status === 'gekuendigt' ? '#ff9800' :
                  selectedVertrag.status === 'ruhepause' ? '#2196F3' : '#f44336'
                ),
                color: selectedVertrag.status === 'aktiv' ? '#4caf50' :
                       selectedVertrag.status === 'gekuendigt' ? '#ff9800' :
                       selectedVertrag.status === 'ruhepause' ? '#2196F3' : '#f44336'
              }}>
                {selectedVertrag.status === 'aktiv' ? '✅ AKTIV' :
                 selectedVertrag.status === 'gekuendigt' ? '⚠️ GEKÜNDIGT' :
                 selectedVertrag.status === 'ruhepause' ? '⏸️ RUHEPAUSE' :
                 selectedVertrag.status === 'abgelaufen' ? '❌ ABGELAUFEN' : selectedVertrag.status?.toUpperCase()}
              </div>

              {/* Grid Layout für Daten */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
              }}>
                {/* Grunddaten */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <h3 style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1.1rem',
                    color: '#FFD700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    📋 Grunddaten
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Vertragsnummer</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{selectedVertrag.vertragsnummer || `VTR-${selectedVertrag.id}`}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Mitglieds-ID</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{selectedVertrag.mitglied_id}</div>
                    </div>
                    {selectedVertrag.dojo_id && (
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Dojo</div>
                        <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{getDojoName(selectedVertrag.dojo_id)}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Laufzeit */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <h3 style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1.1rem',
                    color: '#FFD700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    📅 Laufzeit
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Vertragsbeginn</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                        {selectedVertrag.vertragsbeginn ? new Date(selectedVertrag.vertragsbeginn).toLocaleDateString('de-DE') : 'Nicht angegeben'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Vertragsende</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                        {selectedVertrag.vertragsende ? new Date(selectedVertrag.vertragsende).toLocaleDateString('de-DE') : 'Unbefristet'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Mindestlaufzeit</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                        {selectedVertrag.mindestlaufzeit_monate ? `${selectedVertrag.mindestlaufzeit_monate} Monate` : 'Keine Mindestlaufzeit'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Kündigungsfrist</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                        {selectedVertrag.kuendigungsfrist_monate ? `${selectedVertrag.kuendigungsfrist_monate} Monate` : 'Keine Angabe'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Automatische Verlängerung</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                        {selectedVertrag.automatische_verlaengerung ? '✅ Ja' : '❌ Nein'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Zahlungsinformationen */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                  <h3 style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1.1rem',
                    color: '#FFD700',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    💰 Zahlung
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Tarif</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                        {tarife.find(t => t.id === selectedVertrag.tarif_id)?.name || 'Kein Tarif'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Beitrag</div>
                      <div style={{ fontSize: '0.95rem', color: '#4caf50', fontWeight: '600' }}>
                        {selectedVertrag.monatsbeitrag ? `${parseFloat(selectedVertrag.monatsbeitrag).toFixed(2)} €` : 'Nicht festgelegt'}
                      </div>
                    </div>
                    {selectedVertrag.aufnahmegebuehr_cents && (
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Aufnahmegebühr</div>
                        <div style={{ fontSize: '0.95rem', color: '#ff9800', fontWeight: '600' }}>
                          {(selectedVertrag.aufnahmegebuehr_cents / 100).toFixed(2)} €
                        </div>
                      </div>
                    )}
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Zahlungsrhythmus</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                        {selectedVertrag.billing_cycle ? translateBillingCycle(selectedVertrag.billing_cycle) : 'Nicht angegeben'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Zahlungsart</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                        {selectedVertrag.payment_method === 'direct_debit' ? '🏦 Lastschrift' :
                         selectedVertrag.payment_method === 'bank_transfer' ? '💳 Überweisung' :
                         selectedVertrag.payment_method === 'cash' ? '💵 Bar' :
                         selectedVertrag.payment_method || 'Nicht angegeben'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Lastschrift-Status</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                        {selectedVertrag.lastschrift_status === 'aktiv' ? '✅ Aktiv' :
                         selectedVertrag.lastschrift_status === 'ausstehend' ? '⏳ Ausstehend' :
                         selectedVertrag.lastschrift_status === 'fehlgeschlagen' ? '❌ Fehlgeschlagen' :
                         selectedVertrag.lastschrift_status || 'Keine Angabe'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ruhepause Info (falls vorhanden) */}
              {selectedVertrag.status === 'ruhepause' && selectedVertrag.ruhepause_von && (
                <div style={{
                  background: 'rgba(33, 150, 243, 0.1)',
                  border: '1px solid rgba(33, 150, 243, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '2rem'
                }}>
                  <h3 style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1.1rem',
                    color: '#2196F3',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    ⏸️ Ruhepause
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.2rem' }}>Von</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                        {new Date(selectedVertrag.ruhepause_von).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.2rem' }}>Bis</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                        {selectedVertrag.ruhepause_bis ? new Date(selectedVertrag.ruhepause_bis).toLocaleDateString('de-DE') : 'Nicht festgelegt'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Kündigungsinfo (falls vorhanden) */}
              {selectedVertrag.status === 'gekuendigt' && selectedVertrag.kuendigung_eingegangen && (
                <div style={{
                  background: 'rgba(255, 152, 0, 0.1)',
                  border: '1px solid rgba(255, 152, 0, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '2rem'
                }}>
                  <h3 style={{
                    margin: '0 0 1rem 0',
                    fontSize: '1.1rem',
                    color: '#ff9800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    ⚠️ Kündigung
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.2rem' }}>Kündigung eingegangen</div>
                      <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                        {new Date(selectedVertrag.kuendigung_eingegangen).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                    {selectedVertrag.kuendigungsgrund && (
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '0.2rem' }}>Kündigungsgrund</div>
                        <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                          {selectedVertrag.kuendigungsgrund}
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Button für Kündigungsbestätigung PDF */}
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => {
                        window.open(`${config.apiBaseUrl}/vertraege/${selectedVertrag.id}/kuendigungsbestaetigung`, '_blank');
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        background: 'rgba(255, 152, 0, 0.2)',
                        border: '1px solid rgba(255, 152, 0, 0.4)',
                        borderRadius: '6px',
                        color: '#ff9800',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.85rem',
                        fontWeight: '500',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 152, 0, 0.3)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 152, 0, 0.2)'}
                    >
                      📄 Kündigungsbestätigung herunterladen
                    </button>
                  </div>
                </div>
              )}

              {/* Rechtliche Akzeptanzen */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '1.5rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                marginBottom: '2rem'
              }}>
                <h3 style={{
                  margin: '0 0 1rem 0',
                  fontSize: '1.1rem',
                  color: '#FFD700',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  📝 Rechtliche Dokumente
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>{selectedVertrag.agb_akzeptiert_am ? '✅' : '❌'}</span>
                    <div>
                      <div style={{ fontSize: '0.9rem', color: '#fff' }}>AGB</div>
                      {selectedVertrag.agb_akzeptiert_am && (
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                          {new Date(selectedVertrag.agb_akzeptiert_am).toLocaleDateString('de-DE')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>{selectedVertrag.datenschutz_akzeptiert_am ? '✅' : '❌'}</span>
                    <div>
                      <div style={{ fontSize: '0.9rem', color: '#fff' }}>Datenschutz</div>
                      {selectedVertrag.datenschutz_akzeptiert_am && (
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                          {new Date(selectedVertrag.datenschutz_akzeptiert_am).toLocaleDateString('de-DE')}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.2rem' }}>{selectedVertrag.hausordnung_akzeptiert_am ? '✅' : '❌'}</span>
                    <div>
                      <div style={{ fontSize: '0.9rem', color: '#fff' }}>Hausordnung</div>
                      {selectedVertrag.hausordnung_akzeptiert_am && (
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                          {new Date(selectedVertrag.hausordnung_akzeptiert_am).toLocaleDateString('de-DE')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Zusätzliche Vertragsdaten - Strukturiert */}
              <div style={{ marginBottom: '2rem' }}>
                <h2 style={{
                  margin: '0 0 1.5rem 0',
                  fontSize: '1.3rem',
                  fontWeight: '700',
                  color: '#FFD700',
                  textAlign: 'center',
                  borderBottom: '2px solid rgba(255, 215, 0, 0.3)',
                  paddingBottom: '1rem'
                }}>
                  📊 Weitere Vertragsdetails
                </h2>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '1.5rem'
                }}>
                  {/* Zusätzliche Laufzeit-Details */}
                  {(selectedVertrag.vertragsdauer_monate || selectedVertrag.verlaengerung_monate || selectedVertrag.probezeit_tage) && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <h3 style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1.1rem',
                        color: '#FFD700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        ⏱️ Erweiterte Laufzeit
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {selectedVertrag.vertragsdauer_monate && (
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Vertragsdauer</div>
                            <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{selectedVertrag.vertragsdauer_monate} Monate</div>
                          </div>
                        )}
                        {selectedVertrag.verlaengerung_monate && (
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Verlängerung um</div>
                            <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{selectedVertrag.verlaengerung_monate} Monate</div>
                          </div>
                        )}
                        {selectedVertrag.probezeit_tage && (
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Probezeit</div>
                            <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{selectedVertrag.probezeit_tage} Tage</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rabatte & Sonderkonditionen */}
                  {(selectedVertrag.rabatt_prozent || selectedVertrag.rabatt_betrag) && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <h3 style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1.1rem',
                        color: '#FFD700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        🎁 Rabatte
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {selectedVertrag.rabatt_prozent && (
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Rabatt (%)</div>
                            <div style={{ fontSize: '0.95rem', color: '#4caf50', fontWeight: '600' }}>{selectedVertrag.rabatt_prozent}%</div>
                          </div>
                        )}
                        {selectedVertrag.rabatt_betrag && (
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Rabatt (Betrag)</div>
                            <div style={{ fontSize: '0.95rem', color: '#4caf50', fontWeight: '600' }}>{selectedVertrag.rabatt_betrag} €</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SEPA & Banking */}
                  {selectedVertrag.sepa_mandats_id && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <h3 style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1.1rem',
                        color: '#FFD700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        🏦 SEPA-Mandat
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Mandatsreferenz</div>
                          <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500', wordBreak: 'break-all' }}>{selectedVertrag.sepa_mandats_id}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Kündigungsdetails */}
                  {selectedVertrag.gekuendigt_von && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <h3 style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1.1rem',
                        color: '#FFD700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        📝 Kündigungsinfo
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Gekündigt von</div>
                          <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{selectedVertrag.gekuendigt_von}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ruhepause-Grund */}
                  {selectedVertrag.ruhepause_grund && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <h3 style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1.1rem',
                        color: '#FFD700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        ⏸️ Ruhepause-Details
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Grund</div>
                          <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{selectedVertrag.ruhepause_grund}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dokumente & Unterschriften */}
                  {(selectedVertrag.unterschrift_datum || selectedVertrag.dokument_pfad) && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <h3 style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1.1rem',
                        color: '#FFD700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        📄 Dokumente
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {selectedVertrag.unterschrift_datum && (
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Unterschriftsdatum</div>
                            <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>
                              {new Date(selectedVertrag.unterschrift_datum).toLocaleDateString('de-DE')}
                            </div>
                          </div>
                        )}
                        {selectedVertrag.dokument_pfad && (
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Dokument-Pfad</div>
                            <div style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: '500', wordBreak: 'break-all' }}>{selectedVertrag.dokument_pfad}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notizen & Bemerkungen */}
                  {(selectedVertrag.notizen || selectedVertrag.bemerkung) && (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      padding: '1.5rem',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      <h3 style={{
                        margin: '0 0 1rem 0',
                        fontSize: '1.1rem',
                        color: '#FFD700',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        📝 Notizen
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {selectedVertrag.notizen && (
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Notizen</div>
                            <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: '400', lineHeight: '1.5' }}>{selectedVertrag.notizen}</div>
                          </div>
                        )}
                        {selectedVertrag.bemerkung && (
                          <div>
                            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Bemerkung</div>
                            <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: '400', lineHeight: '1.5' }}>{selectedVertrag.bemerkung}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Technische Daten */}
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <h3 style={{
                      margin: '0 0 1rem 0',
                      fontSize: '1.1rem',
                      color: '#FFD700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      🔧 Technische Daten
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Vertrags-ID</div>
                        <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>{selectedVertrag.id}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Persönliche Vertragsnummer</div>
                        <div style={{ fontSize: '0.95rem', color: '#fff', fontWeight: '500' }}>#{selectedVertrag.personenVertragNr}</div>
                      </div>
                      {selectedVertrag.magicline_contract_id && (
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Magicline Vertrags-ID</div>
                          <div style={{ fontSize: '0.95rem', color: '#9ca3af', fontWeight: '500' }}>{selectedVertrag.magicline_contract_id}</div>
                        </div>
                      )}
                      {selectedVertrag.geloescht !== undefined && (
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '0.2rem' }}>Status</div>
                          <div style={{ fontSize: '0.95rem', color: selectedVertrag.geloescht ? '#ef4444' : '#4caf50', fontWeight: '600' }}>
                            {selectedVertrag.geloescht ? '🗑️ Gelöscht' : '✅ Aktiv'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Timestamps */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                borderRadius: '8px',
                padding: '1rem',
                fontSize: '0.85rem',
                color: 'rgba(255, 255, 255, 0.5)',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <div>Erstellt: {selectedVertrag.erstellt_am ? new Date(selectedVertrag.erstellt_am).toLocaleString('de-DE') : 'Unbekannt'}</div>
                {selectedVertrag.aktualisiert_am && (
                  <div>Aktualisiert: {new Date(selectedVertrag.aktualisiert_am).toLocaleString('de-DE')}</div>
                )}
              </div>

              {/* Close Button */}
              <div style={{
                marginTop: '2rem',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <button
                  onClick={() => setShowStructuredDetails(false)}
                  style={{
                    padding: '0.75rem 2rem',
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                    color: '#1a1a2e',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(255, 215, 0, 0.3)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 215, 0, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 215, 0, 0.3)';
                  }}
                >
                  Schließen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Archivierungs-Modal */}
      {showArchiveModal && (
        <div
          onClick={() => setShowArchiveModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.98) 0%, rgba(20, 20, 30, 0.98) 100%)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              border: '1px solid rgba(231, 76, 60, 0.3)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
            }}
          >
            <h2 style={{ color: '#e74c3c', marginBottom: '1.5rem', fontSize: '1.5rem' }}>
              🗑️ Mitglied archivieren
            </h2>

            <div style={{ marginBottom: '1.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              <p>
                Möchten Sie <strong style={{ color: '#FFD700' }}>{mitglied.vorname} {mitglied.nachname}</strong> wirklich archivieren?
              </p>
              <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)', marginTop: '1rem' }}>
                Das Mitglied wird aus der aktiven Liste entfernt und mit allen Daten ins Archiv verschoben.
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                Grund (optional):
              </label>
              <textarea
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="z.B. Austritt, Umzug, Kündigung..."
                rows={3}
                style={{
                  width: '100%',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 215, 0, 0.2)',
                  borderRadius: '8px',
                  padding: '12px',
                  color: '#fff',
                  fontSize: '0.95rem',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowArchiveModal(false);
                  setArchiveReason('');
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                Abbrechen
              </button>

              <button
                onClick={handleArchiveMitglied}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  boxShadow: '0 4px 12px rgba(231, 76, 60, 0.3)',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(231, 76, 60, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(231, 76, 60, 0.3)';
                }}
              >
                🗑️ Jetzt archivieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kündigungsbestätigung Modal */}
      {showKündigungBestätigungModal && vertragZumKündigen && (
        <div
          className="modal-overlay"
          onClick={() => {
            setShowKündigungBestätigungModal(false);
            setVertragZumKündigen(null);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '2rem'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, rgba(30, 30, 40, 0.98) 0%, rgba(20, 20, 30, 0.98) 100%)',
              borderRadius: '16px',
              padding: '2rem',
              maxWidth: '500px',
              width: '100%',
              border: '1px solid rgba(255, 193, 7, 0.3)',
              boxShadow: 'none'
            }}
          >
            {/* Warnsymbol oben */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              marginBottom: '1.5rem',
              fontSize: '4rem'
            }}>
              ⚠️
            </div>

            {/* Zentrierte Überschrift */}
            <h2 style={{ 
              color: '#ffc107', 
              marginBottom: '1.5rem', 
              fontSize: '1.3rem',
              textAlign: 'center',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              ACHTUNG: VERTRAG IST NOCH AKTIV!
            </h2>

            <div style={{ marginBottom: '1.5rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              <p style={{ textAlign: 'left' }}>
                Vertrag <strong style={{ color: '#FFD700' }}>#{vertragZumKündigen.personenVertragNr}</strong> ist noch aktiv!
              </p>
              <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)', marginTop: '1rem', textAlign: 'left' }}>
                Möchten Sie den Vertrag trotzdem kündigen?
              </p>
              <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)', marginTop: '0.5rem', textAlign: 'left' }}>
                Bei <strong style={{ color: '#FFD700' }}>"Ja"</strong> wird der Vertrag gekündigt und in die Archivierten/Ehemaligen verschoben.
              </p>
              <p style={{ fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.9)', marginTop: '0.5rem', textAlign: 'left' }}>
                Bei <strong style={{ color: '#FFD700' }}>"Nein"</strong> wird die Aktion abgebrochen.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowKündigungBestätigungModal(false);
                  setVertragZumKündigen(null);
                }}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                Nein
              </button>

              <button
                onClick={handleKündigungBestätigen}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 12px rgba(255, 193, 7, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ff9800 0%, #ffc107 100%)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 193, 7, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, #ffc107 0%, #ff9800 100%)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 193, 7, 0.3)';
                }}
              >
                Ja
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};


export default MitgliedDetailShared;
