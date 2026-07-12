import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from 'axios';
import openApiBlob from '../utils/openApiBlob';
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
import MitgliedsAusweis from './MitgliedsAusweis';
import { QRCodeSVG } from 'qrcode.react';
// html2canvas wird dynamisch importiert bei Bedarf (ca. 200KB)
import { createSafeHtml } from '../utils/sanitizer';
import '../styles/Buttons.css';
// import "../styles/DojoEdit.css";
import "../styles/MitgliedDetail.css";
import "../styles/MitgliedDetailShared.css";
import dojoLogo from '../assets/logo-kampfkunstschule-schreiner.png';

// Extrahierte Tab-Komponenten
import {
  MemberMedicalTab, MemberInjuryTab,
  NachrichtenTab, EntwicklungTab, GurtStilTab, DokumenteTab, MitgliedschaftTab,
} from './mitglied-detail';
import RatenzahlungTab from './mitglied-detail/tabs/RatenzahlungTab';
import NeuesMitgliedAnlegen from './NeuesMitgliedAnlegen';
import VorlagenSendenModal from './VorlagenSendenModal';
import HofNominierungModal from './HofNominierungModal';
import GuertelRechner from './GuertelRechner';

// ISO-/Datums-String → yyyy-MM-dd für <input type="date"> (war beim Tab-Refactor
// verloren gegangen, wird hier aber noch von letzte_pruefung/geburtsdatum genutzt).
function toInputDate(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toISOString().split('T')[0];
}

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
        style={{ '--belt-primaer': primaer || '#CCCCCC' }}
      >
        {/* Sekundärer Streifen wenn vorhanden */}
        {sekundaer && (
          <div
            className="belt-stripe"
            style={{ '--belt-sekundaer': sekundaer }}
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

  // Ref für Mitgliedsausweis Download
  const ausweisRef = React.useRef(null);

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

  // Stile mit React Query (60 Min Cache) — 🔒 Cache pro Dojo isoliert (sonst leakt Dojo A → B)
  const { data: stileQuery } = useQuery({
    queryKey: ['stile', activeDojo?.id || 'own'],
    queryFn: async () => {
      const res = await axios.get(`/stile${activeDojo?.id ? `?dojo_id=${activeDojo.id}` : ''}`);
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
  const [referralInfo, setReferralInfo] = useState(null);
  const [referralCopied, setReferralCopied] = useState(false);

  const [activeTab, setActiveTab] = useState("allgemein");
  const [styleSubTab, setStyleSubTab] = useState("stile");
  const [activeStyleTab, setActiveStyleTab] = useState(0);
  const [stilDropdownOpen, setStilDropdownOpen] = useState(false);
  const [activeExamTab, setActiveExamTab] = useState(0);
  const [financeSubTab, setFinanceSubTab] = useState("beitraege");
  // Redirect: merged tabs auto-switch if still in session state
  useEffect(() => {
    if (financeSubTab === "zahlungshistorie" || financeSubTab === "finanzübersicht") setFinanceSubTab("beitraege");
  }, [financeSubTab]);
  const [mitgliedschaftSubTab, setMitgliedschaftSubTab] = useState("vertrag");
  const [gesundheitSubTab, setGesundheitSubTab] = useState("medizinisch");
  const [entwicklungSubTab, setEntwicklungSubTab] = useState("anwesenheit");
  const [graduationListCollapsed, setGraduationListCollapsed] = useState(true);
  const [gurtStilHauptTab, setGurtStilHauptTab] = useState("stile");
  const [gradListCollapsedPerStil, setGradListCollapsedPerStil] = useState({});
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Familienmitglied hinzufügen Modal State
  const [showFamilyMemberModal, setShowFamilyMemberModal] = useState(false);

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
  const [stilStatistiken, setStilStatistiken] = useState([]);
  const [openYears, setOpenYears] = useState(() => new Set([String(new Date().getFullYear())]));
  const [verträge, setVerträge] = useState([]);
  const [ruecklastschriftenStats, setRuecklastschriftenStats] = useState(null);
  const [aktiverRatenplan, setAktiverRatenplan] = useState(null);

  // Lastschrift-Einverständnis State
  const [lsEinverstaendnis, setLsEinverstaendnis] = useState(null);

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
  const [showMitgliedsausweis, setShowMitgliedsausweis] = useState(false);
  const [showVorlagenSenden, setShowVorlagenSenden] = useState(false);
  const [showHofNominierung, setShowHofNominierung] = useState(false);
  const [showVertragAnpassungModal, setShowVertragAnpassungModal] = useState(false);
  const [vertragAnpassungen, setVertragAnpassungen] = useState([]);
  const [vertragAnpassungForm, setVertragAnpassungForm] = useState({
    typ: 'student', neuer_betrag: '', gueltig_von: '', gueltig_bis: '', grund: ''
  });
  const [vertragAnpassungLoading, setVertragAnpassungLoading] = useState(false);
  const [vertragAnpassungError, setVertragAnpassungError] = useState('');
  const [editingAnpassungId, setEditingAnpassungId] = useState(null);
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

  // Modal für Vertragsfrei stellen / aufheben
  const [vertragsfreiModal, setVertragsfreiModal] = useState(null); // null | 'stellen' | 'aufheben'
  const [vertragsfreiForm, setVertragsfreiForm] = useState({
    grund: '',
    ab: new Date().toISOString().split('T')[0],
    beitraege_aktion: 'behalten'
  });
  const [vertragsfreiError, setVertragsfreiError] = useState('');

  // Abgeleitete Zähler für Status-Badges (schmal oben in Sidebar)
  const offeneDokumente = Number(mitglied?.dokumente_offen) || 0;
  const offeneNachrichten = Number(mitglied?.nachrichten_offen) || 0;
  const offeneBeiträge = Array.isArray(finanzDaten)
    ? finanzDaten.filter((f) => {
        const status = (f.status || '').toString().toLowerCase();
        const nichtBezahlt = f.bezahlt === 0 || f.bezahlt === false || f.bezahlt === null || f.bezahlt === undefined;
        if (!nichtBezahlt && status !== 'offen' && status !== 'überfällig') return false;
        // Nur tatsächlich fällige Beiträge zählen (nicht zukünftige geplante)
        const heute = new Date(); heute.setHours(23, 59, 59, 999);
        const faelligkeit = new Date(f.zahlungsdatum || f.datum || 0);
        return faelligkeit <= heute;
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
      setAnwesenheitsDaten(Array.isArray(res.data) ? res.data : []);
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
      const [beitraegeRes, ratenplanRes] = await Promise.all([
        axios.get('/beitraege', config),
        axios.get(`/rechnungen/ratenplan/${id}`, signal ? { signal } : {}).catch(() => null)
      ]);
      setFinanzDaten(beitraegeRes.data);
      if (ratenplanRes?.data?.success && ratenplanRes.data.plan) {
        setAktiverRatenplan(ratenplanRes.data.plan);
      } else {
        setAktiverRatenplan(null);
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') {
        return; // Request was cancelled, don't show error
      }
      console.error('❌ Fehler beim Laden der Finanzdaten:', err);
      console.error('🔍 Error Details:', err.response || err);
    }
  };

  // Lastschrift-Einverständnis laden (für Bank/SEPA-Tab)
  const fetchLsEinverstaendnis = async () => {
    if (!id) return;
    try {
      const dojoParam = activeDojo?.id ? `?dojo_id=${activeDojo.id}` : '';
      const res = await axios.get(`/lastschrift-einverstaendnis${dojoParam}`);
      const found = (res.data.data || []).find(m => m.mitglied_id === parseInt(id, 10));
      setLsEinverstaendnis(found
        ? {
            status:         found.einverstaendnis_status,
            angefragt_am:   found.angefragt_am,
            beantwortet_am: found.beantwortet_am,
            kanal:          found.kanal,
            notiz:          found.notiz,
          }
        : null
      );
    } catch {
      // Silently ignore
    }
  };

  // Rücklastschriften-Stats laden
  const fetchRuecklastschriftenStats = async () => {
    if (!id) return;
    try {
      const dojoParam = activeDojo?.id ? `?dojo_id=${activeDojo.id}` : '';
      const res = await axios.get(`/mitglieder/${id}/ruecklastschriften-stats${dojoParam}`);
      if (res.data?.success) setRuecklastschriftenStats(res.data.stats);
    } catch (err) {
      // Silently ignore — no Rücklastschriften data available
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
      const response = await axios.get(`/stile${activeDojo?.id ? `?dojo_id=${activeDojo.id}` : ''}`, signal ? { signal } : {});
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
    if (!id) return;
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
    const parsedId = parseInt(id, 10);
    const parsedStilId = parseInt(stilId, 10);
    if (!id || isNaN(parsedId) || isNaN(parsedStilId) || autoSaving) {
      console.warn(`⚠️ saveStyleSpecificData: Ungültige ID(s) - id="${id}", stilId="${stilId}"`);
      return;
    }

    // Debug: Zeige was genau gesendet wird
    const payload = {
      current_graduierung_id: data.current_graduierung_id || null,
      letzte_pruefung: data.letzte_pruefung || null,
      naechste_pruefung: data.naechste_pruefung || null,
      anmerkungen: data.anmerkungen || null
    };
    console.log(`📤 POST /mitglieder/${parsedId}/stil/${parsedStilId}/data`, payload);

    setAutoSaving(true);
    try {
      const response = await axios.post(`/mitglieder/${parsedId}/stil/${parsedStilId}/data`, payload);
      console.log(`✅ Stilspezifische Daten für Stil ${parsedStilId} gespeichert:`, response.data);
    } catch (error) {
      console.error(`❌ Fehler beim Speichern stilspezifischer Daten (id=${parsedId}, stil=${parsedStilId}):`, error.message);
      console.error(`❌ Response Body:`, error.response?.data);
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

  const handleGraduationArrowChange = async (graduationId, direction, overrideStilData = null) => {
    const stilToUse = overrideStilData || selectedStil;
    if (!stilToUse || !stilToUse.graduierungen) {
      console.error('❌ Kein Stil oder keine Graduierungen vorhanden');
      return;
    }

    let newGraduation;

    // Prüfe ob direction eine Zahl ist (direkte Auswahl) oder ein String (up/down)
    if (typeof direction === 'number') {
      newGraduation = stilToUse.graduierungen.find(g => g.graduierung_id === direction);
      if (!newGraduation) return;
    } else {
      const currentIndex = stilToUse.graduierungen.findIndex(g => g.graduierung_id === graduationId);
      let newIndex;
      if (direction === 'up' && currentIndex > 0) {
        newIndex = currentIndex - 1;
      } else if (direction === 'down' && currentIndex < stilToUse.graduierungen.length - 1) {
        newIndex = currentIndex + 1;
      } else {
        return;
      }
      newGraduation = stilToUse.graduierungen[newIndex];
    }

    setCurrentGraduation(newGraduation);

    const stilId = stilToUse.stil_id;
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
        graduierung_datum: new Date().toISOString().split('T')[0]
      });

      setMitglied(prev => ({
        ...prev,
        gurtfarbe: newGraduation.name,
        graduierung_datum: new Date().toISOString().split('T')[0]
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
          widerruf_akzeptiert_am: newVertrag.widerruf_akzeptiert ? now : null,
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
    fetchRuecklastschriftenStats();
    fetchLsEinverstaendnis();

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

  // Stil-Statistiken laden (Anwesenheitsquote pro Stil)
  const fetchStilStatistiken = async (signal = null) => {
    try {
      const config = signal ? { signal } : {};
      const res = await axios.get(`/anwesenheit/stil-statistiken/${id}`, config);
      setStilStatistiken(res.data);
    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
      console.error('Fehler beim Laden der Stil-Statistiken:', err);
    }
  };

  // ✨ NEU: Anwesenheitsdaten für Anwesenheits-Tab laden (alle Stile)
  useEffect(() => {
    if (activeTab === "entwicklung") {
      const controller = new AbortController();
      fetchAnwesenheitsDaten(null, controller.signal); // Alle Stile
      fetchStilStatistiken(controller.signal);
      return () => {
        controller.abort();
      };
    }
  }, [activeTab]);

  // ✨ NEU: Finanzdaten laden wenn Finanzen-Tab aktiv
  useEffect(() => {
    if (activeTab === "mitgliedschaft" && id) {
      const controller = new AbortController();
      fetchFinanzDaten(controller.signal);
      fetchTarifeUndZahlungszyklen(controller.signal);
      fetchVerträge(controller.signal); // Verträge für Beitragsgenerierung laden
      return () => {
        controller.abort();
      };
    }
  }, [activeTab, id]);

  // (Entfernt: toter useEffect für deprecated Tab "stile" — "stile" ist kein Tab-Key mehr,
  //  Bedingung activeTab === "stile" war nie wahr. Aktiv ist "gurt_stil".)

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

        // Letzte Prüfung aus styleSpecificData übernehmen wenn vorhanden
        if (stilSpecificData?.letzte_pruefung) {
          setLastExamDate(toInputDate(stilSpecificData.letzte_pruefung));
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
    if (activeTab === "allgemein" && mitglied?.mitglied_id && token) {
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

      // Referral-Daten laden
      const loadReferral = async () => {
        try {
          const [sRes, cRes] = await Promise.all([
            fetch(`${config.apiBaseUrl}/referral/settings`, { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${config.apiBaseUrl}/referral/codes?mitglied_id=${mitglied.mitglied_id}`, { headers: { 'Authorization': `Bearer ${token}` } })
          ]);
          let settings = {};
          if (sRes.ok) settings = await sRes.json();
          if (!cRes.ok) return;
          const codes = await cRes.json();
          const activeCode = Array.isArray(codes) ? codes.find(c => c.aktiv) : null;
          if (activeCode) setReferralInfo({ ...settings, code: activeCode.code });
        } catch (e) { /* optional */ }
      };
      loadReferral();

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
      const response = await fetch(`${config.apiBaseUrl}/mitglieddetail/${mitglied.id}/archive-allergie`, {
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
            try {
              const errorData = JSON.parse(reader.result);
              alert(`❌ ${errorMessage}: ${errorData.details || errorData.error || 'Unbekannter Fehler'}`);
            } catch {
              alert(`❌ ${errorMessage}: ${error.message}`);
            }
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
    <div className="mitglied-detail-container mds2-p-2">
      <SkeletonProfile />
    </div>
  );
  if (error) return <p className="error">{error}</p>;
  if (!mitglied) return <p>Keine Daten gefunden.</p>;

  // Tab configuration - all tabs visible, but some content is admin-only
  const allTabs = [
    { key: "allgemein",      label: "Allgemein",            icon: "👤" },
    { key: "gesundheit",     label: "Gesundheit",           icon: "🏥" },
    { key: "entwicklung",    label: "Entwicklung",          icon: "📈" },
    { key: "mitgliedschaft", label: "Mitgliedschaft",       icon: "💼" },
    { key: "dokumente",      label: "Dokumente",            icon: "📁" },
    { key: "gurt_stil",      label: "Gurt & Stil / Prüfung",icon: "🥋" },
    { key: "nachrichten",    label: "Nachrichten",          icon: "📬" },
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

        {/* Horizontale Tab-Leiste: 2 Zeilen */}
        <div className="mitglied-tabs-header">

          {/* Zeile 1: Avatar + Name + Zurück + Aktionen */}
          <div className="mdt-top-row">
            <div className="mdt-member-info">
              <div className={`mdt-avatar-wrap ${!avatarLoaded ? 'avatar-loading' : ''}`}>
                <img
                  key={mitglied?.mitglied_id}
                  src={mitglied?.foto_pfad ? `${config.imageBaseUrl}/${mitglied.foto_pfad}` : 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%232a2a4e" width="100" height="100"/%3E%3Ctext fill="%23ffd700" font-family="sans-serif" font-size="50" dy=".35em" x="50%25" y="50%25" text-anchor="middle"%3E👤%3C/text%3E%3C/svg%3E'}
                  alt={`${mitglied?.vorname} ${mitglied?.nachname}`}
                  className={`mdt-avatar-img ${avatarLoaded ? 'loaded' : ''}`}
                  onLoad={() => setAvatarLoaded(true)}
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%232a2a4e" width="100" height="100"/%3E%3Ctext fill="%23ffd700" font-family="sans-serif" font-size="50" dy=".35em" x="50%25" y="50%25" text-anchor="middle"%3E👤%3C/text%3E%3C/svg%3E';
                    setAvatarLoaded(true);
                  }}
                />
              </div>
              <div className="mdt-name-block">
                <span className="mdt-name">{mitglied?.vorname} {mitglied?.nachname}</span>
                {isAdmin && mitglied?.dojo_id && (
                  <span className="mdt-dojo">{getDojoName(mitglied.dojo_id)}</span>
                )}
              </div>
            </div>

            <div className="mdt-header-actions">
              {isAdmin && (
                <button
                  className="back-button mitglied-detail-back-btn"
                  onClick={() => navigate("/dashboard/mitglieder")}
                >
                  ← Zurück
                </button>
              )}
              {isAdmin && (
              <div className="mds-actions-menu-wrapper">
                <button
                  className="mitglied-detail-actions-btn mds-aktionen-btn"
                  onClick={() => setShowActionsMenu(!showActionsMenu)}
                  title="Aktionen"
                >
                  <span className="mds-aktionen-icon">⚙️</span>
                  <span className="mds-aktionen-label">Aktionen</span>
                  <span className="mds-aktionen-chevron">{showActionsMenu ? '▲' : '▼'}</span>
                </button>

                {/* Dropdown-Menü */}
                {showActionsMenu && (
                  <>
                    {/* Overlay zum Schließen */}
                    <div
                      onClick={() => setShowActionsMenu(false)}
                      className="mds-click-overlay"
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

                      <button
                        className="mitglied-detail-menu-item"
                        onClick={() => {
                          setShowMitgliedsausweis(true);
                          setShowActionsMenu(false);
                        }}
                      >
                        <span className="menu-item-icon">🪪</span>
                        <span>Mitgliedsausweis</span>
                      </button>

                      <button
                        className="mitglied-detail-menu-item"
                        onClick={() => {
                          setShowVorlagenSenden(true);
                          setShowActionsMenu(false);
                        }}
                      >
                        <span className="menu-item-icon">📧</span>
                        <span>Dokument senden</span>
                      </button>

                      <button
                        className="mitglied-detail-menu-item"
                        onClick={() => {
                          setShowHofNominierung(true);
                          setShowActionsMenu(false);
                        }}
                      >
                        <span className="menu-item-icon">🏛️</span>
                        <span>Für Hall of Fame nominieren</span>
                      </button>

                      <button
                        className="mitglied-detail-menu-item"
                        onClick={() => {
                          const mid = mitglied?.mitglied_id || mitglied?.id;
                          if (mid) {
                            axios.get(`/vertrag-anpassungen/mitglied/${mid}`)
                              .then(r => setVertragAnpassungen(r.data.anpassungen || []))
                              .catch(() => setVertragAnpassungen([]));
                          }
                          setVertragAnpassungForm({ typ: 'student', neuer_betrag: '', gueltig_von: '', gueltig_bis: '', grund: '' });
                          setVertragAnpassungError('');
                          setShowVertragAnpassungModal(true);
                          setShowActionsMenu(false);
                        }}
                      >
                        <span className="menu-item-icon">🎓</span>
                        <span>Tarif zeitlich anpassen</span>
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
            </div>{/* /mdt-header-actions */}
          </div>{/* /mdt-top-row */}

          {/* Zeile 2: Tabs */}
          <nav className="mdt-tabs" aria-label="Mitglied Tabs">
            {tabs.map((tab, index) => (
              <button
                key={tab.key}
                className={`mdt-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => handleTabClick(tab.key, index)}
              >
                <span className="mdt-tab-icon">{tab.icon}</span>
                <span className="mdt-tab-label">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>{/* /mitglied-tabs-header */}

        <div className="mitglied-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              className="tab-content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
          {activeTab === "allgemein" && (
            <div className="grid-container">
              {/* Mitgliedsausweis - ganz oben (identisch zur Member-App) */}
              <div className="mitgliedsausweis-container mds-ausweis-wrap">
                <div className="mitgliedsausweis" ref={ausweisRef}>
                  {/* Header mit Titel */}
                  <div className="ausweis-title">
                    <span className="title-jp">格闘技学校</span>
                    <span className="title-de">Kampfkunstschule Schreiner</span>
                  </div>

                  {/* Hauptbereich: Logo links, Daten mitte, Foto+QR rechts */}
                  <div className="ausweis-body">
                    {/* Linke Seite: Großes Logo */}
                    <div className="ausweis-left">
                      <img
                        src={dojoLogo}
                        alt="Kampfkunstschule Schreiner"
                        className="ausweis-logo"
                      />
                    </div>

                    {/* Mitte: Name und Infos */}
                    <div className="ausweis-center">
                      <div className="ausweis-kanji">武道</div>
                      <div className="ausweis-name">
                        {mitglied?.vorname} · {mitglied?.nachname}
                      </div>
                      <div className="ausweis-info-list">
                        <div className="ausweis-info-row">
                          <span className="info-label">Mitglieds-Nr.</span>
                          <span className="info-value">{String(mitglied?.mitglied_id).padStart(5, '0')}</span>
                        </div>
                        <div className="ausweis-info-row">
                          <span className="info-label">Mitglied seit</span>
                          <span className="info-value">
                            {mitglied?.eintrittsdatum
                              ? new Date(mitglied.eintrittsdatum).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' })
                              : '—'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Rechte Seite: Foto oben, QR unten */}
                    <div className="ausweis-right">
                      <div className="ausweis-foto">
                        {(mitglied?.foto_pfad || photoPreview) ? (
                          <img
                            src={photoPreview || `${config.imageBaseUrl}/${mitglied.foto_pfad}`}
                            alt={`${mitglied?.vorname} ${mitglied?.nachname}`}
                          />
                        ) : (
                          <div className="ausweis-foto-placeholder">
                            <span>写真</span>
                          </div>
                        )}
                      </div>
                      <div className="ausweis-qr">
                        <QRCodeSVG
                          value={`DOJO-CHECKIN:${mitglied?.dojo_id || '0'}:${mitglied?.mitglied_id || '0'}`}
                          size={70}
                          level="M"
                          bgColor="#ffffff"
                          fgColor="#8b1a1a"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="ausweis-footer">
                    <div className="ausweis-motto">心技体 — Shin Gi Tai</div>
                    <div className="ausweis-website">www.kampfkunstschule-schreiner.de</div>
                  </div>
                </div>

                <div className="ausweis-actions">
                  <button
                    className="btn btn-secondary ausweis-download-btn"
                    onClick={async () => {
                      if (!ausweisRef.current) return;
                      try {
                        // Wrapper mit Padding erstellen für Download
                        const wrapper = document.createElement('div');
                        wrapper.style.padding = '20px';
                        wrapper.style.background = '#000000';
                        wrapper.style.display = 'inline-block';

                        const clone = ausweisRef.current.cloneNode(true);
                        wrapper.appendChild(clone);
                        document.body.appendChild(wrapper);

                        // Dynamisch laden - html2canvas ist ca. 200KB
                        const html2canvas = (await import('html2canvas')).default;
                        const canvas = await html2canvas(wrapper, {
                          backgroundColor: '#000000',
                          scale: 3,
                          useCORS: true,
                          allowTaint: true,
                          logging: false,
                          imageTimeout: 15000
                        });

                        document.body.removeChild(wrapper);
                        const link = document.createElement('a');
                        link.download = `mitgliedsausweis-${mitglied?.nachname?.toLowerCase() || 'member'}.png`;
                        link.href = canvas.toDataURL('image/png', 1.0);
                        link.click();
                      } catch (err) {
                        console.error('Download failed:', err);
                        alert('Download fehlgeschlagen: ' + err.message);
                      }
                    }}
                  >
                    Als Bild speichern
                  </button>
                </div>
              </div>

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
                          src={photoPreview || (mitglied?.foto_pfad ? `${config.imageBaseUrl}/${mitglied.foto_pfad}` : '/src/assets/default-avatar.png')}
                          alt={`${mitglied?.vorname} ${mitglied?.nachname}`}
                          className="mitglied-foto-small mds-cursor-pointer"
                          onClick={() => {
                            const newWindow = window.open();
                            newWindow.document.write(`
                              <html>
                                <head><title>${mitglied?.vorname} ${mitglied?.nachname}</title></head>
                                <body style="margin:0; background:#000; display:flex; justify-content:center; align-items:center; min-height:100vh;">
                                  <img src="${photoPreview || (mitglied?.foto_pfad ? `${config.imageBaseUrl}/${mitglied.foto_pfad}` : '/src/assets/default-avatar.png')}"
                                       style="max-width:90vw; max-height:90vh; object-fit:contain;" />
                                </body>
                              </html>
                            `);
                          }}
                        />
                        <div className="foto-actions">
                          <input
                            type="file"
                            id="photo-upload"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="mds2-hidden"
                            disabled={uploadingPhoto}
                          />
                          <button
                            onClick={() => document.getElementById('photo-upload').click()}
                            disabled={uploadingPhoto}
                            className="mds-foto-change-btn"
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
                            className="mds-foto-delete-btn"
                            disabled={uploadingPhoto}
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
                            className="mds2-hidden"
                            disabled={uploadingPhoto}
                          />
                          <label htmlFor="photo-upload" className="mds-foto-upload-label"
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
                              <div className="mds-foto-spinner-row">
                                <div className="spinner"></div>
                                <span>Hochladen...</span>
                              </div>
                            ) : (
                              <div className="mds-foto-spinner-row">
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
                      className="mds-disabled-input"
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
                    <span>{mitglied.newsletter_abo ? "✓ Abonniert" : "✗ Nicht abonniert"}</span>
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
                        value={updatedData.online_portal_aktiv ? "1" : "0"}
                        onChange={(e) => handleChange(e, "online_portal_aktiv")}
                        options={[
                          { value: '1', label: 'Aktiv' },
                          { value: '0', label: 'Inaktiv' }
                        ]}
                      />
                    ) : (
                      <span>{mitglied.online_portal_aktiv ? "✅ Aktiv" : "✗ Inaktiv"}</span>
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
                    <div className="kontostand-details mds-kontostand-grid">
                      <div className="mds-kontostand-box">
                        <div className="mds-kontostand-label">
                          Aktueller offener Betrag
                        </div>
                        <div className="mds-kontostand-value-primary" style={{
                          '--val-color': (() => {
                            const heute = new Date(); heute.setHours(23, 59, 59, 999);
                            const kontostand = finanzDaten
                              .filter(item => !item.bezahlt && new Date(item.zahlungsdatum || item.datum || 0) <= heute)
                              .reduce((sum, item) => sum + (parseFloat(item.betrag) || 0), 0);
                            return kontostand > 0 ? '#ef4444' : '#10b981';
                          })()
                        }}>
                          {(() => {
                            const heute = new Date(); heute.setHours(23, 59, 59, 999);
                            const kontostand = finanzDaten
                              .filter(item => !item.bezahlt && new Date(item.zahlungsdatum || item.datum || 0) <= heute)
                              .reduce((sum, item) => sum + (parseFloat(item.betrag) || 0), 0);
                            return `${kontostand.toFixed(2)} €`;
                          })()}
                        </div>
                        <div className="mds-kontostand-sublabel">
                          {(() => {
                            const heute = new Date(); heute.setHours(23, 59, 59, 999);
                            const unbezahlt = finanzDaten.filter(item => !item.bezahlt && new Date(item.zahlungsdatum || item.datum || 0) <= heute).length;
                            const geplant = finanzDaten.filter(item => !item.bezahlt && new Date(item.zahlungsdatum || item.datum || 0) > heute).length;
                            const bezahlt = finanzDaten.filter(item => item.bezahlt).length;
                            return `${unbezahlt} überfällig, ${bezahlt} bezahlt${geplant > 0 ? `, ${geplant} geplant` : ''}`;
                          })()}
                        </div>
                      </div>

                      <div className="mds-kontostand-box">
                        <div className="mds-kontostand-label">
                          Letzter bezahlter Betrag
                        </div>
                        <div className="mds-kontostand-value-secondary">
                          {(() => {
                            const letzteZahlung = finanzDaten
                              .filter(z => z.bezahlt && z.zahlungsdatum)
                              .sort((a, b) => new Date(b.zahlungsdatum) - new Date(a.zahlungsdatum))[0];

                            if (letzteZahlung) {
                              return (
                                <>
                                  <div className="mds-last-payment-amount">
                                    {parseFloat(letzteZahlung.betrag).toFixed(2)} €
                                  </div>
                                  <div className="mds-last-payment-date">
                                    am {new Date(letzteZahlung.zahlungsdatum).toLocaleDateString('de-DE')}
                                  </div>
                                </>
                              );
                            }
                            return <div className="mds-no-data-muted">Keine Zahlungen vorhanden</div>;
                          })()}
                        </div>
                      </div>

                      <div className="mds-kontostand-box">
                        <div className="mds-kontostand-label">
                          Kommender Betrag
                        </div>
                        <div className="mds-kontostand-value-secondary">
                          {(() => {
                            const aktiveVertraege = verträge.filter(v => v.status === 'aktiv');
                            if (aktiveVertraege.length > 0) {
                              const gesamtBeitrag = aktiveVertraege.reduce((sum, v) => {
                                return sum + (parseFloat(v.monatsbeitrag) || 0);
                              }, 0);
                              return (
                                <>
                                  <div className="mds-last-payment-amount">
                                    {gesamtBeitrag.toFixed(2)} €
                                  </div>
                                  <div className="mds-last-payment-date">
                                    monatlich ({aktiveVertraege.length} {aktiveVertraege.length === 1 ? 'Vertrag' : 'Verträge'})
                                  </div>
                                </>
                              );
                            }
                            return <div className="mds-no-data-muted">Kein aktiver Vertrag</div>;
                          })()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "gesundheit" && (
            <div>
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
              <MemberInjuryTab mitgliedId={id} isAdmin={isAdmin} />
            </div>
          )}

          {activeTab === "entwicklung" && (
            <EntwicklungTab
              mitgliedId={id}
              mitglied={mitglied}
              anwesenheitsDaten={anwesenheitsDaten}
              statistikDaten={statistikDaten}
              stilStatistiken={stilStatistiken}
              memberStile={memberStile}
              stile={stile}
              styleSpecificData={styleSpecificData}
            />
          )}

          {activeTab === "dokumente" && (
            <DokumenteTab
              mitglied={mitglied}
              verträge={verträge}
              updatedData={updatedData}
              handleChange={handleChange}
              editMode={editMode}
              isAdmin={isAdmin}
              sepaMandate={sepaMandate}
              archivierteMandate={archivierteMandate}
              confirmedNotifications={confirmedNotifications}
              verfügbareVorlagen={verfügbareVorlagen}
              generatingDocument={generatingDocument}
              mitgliedDokumente={mitgliedDokumente}
              rechnungen={rechnungen}
              mitgliedId={id}
              activeDojo={activeDojo}
              downloadSepaMandate={downloadSepaMandate}
              downloadArchiviertesMandat={downloadArchiviertesMandat}
              generateDocumentFromTemplate={generateDocumentFromTemplate}
              downloadTemplateAsPDF={downloadTemplateAsPDF}
              downloadMitgliedDokument={downloadMitgliedDokument}
              deleteMitgliedDokument={deleteMitgliedDokument}
              deleteRechnung={deleteRechnung}
            />
          )}


          {/* Modal für SEPA-Mandat-Details */}
          {showMandateModal && selectedMandate && (
            <div className="mds-modal-fullscreen-overlay" onClick={() => setShowMandateModal(false)}>
              <div className="mds-sepa-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="mds-modal-header-row">
                  <h2 className="mds-modal-title">
                    🏦 SEPA-Mandat Details
                  </h2>
                  <button
                    onClick={() => setShowMandateModal(false)}
                    className="mds-modal-close-btn"
                  >
                    →
                  </button>
                </div>

                <div className="mds2-flex-col-1">
                  <div>
                    <div className="mds-info-label-secondary">
                      MANDATSREFERENZ
                    </div>
                    <div className="mds-sepa-mandate-ref">
                      {selectedMandate.mandatsreferenz}
                    </div>
                  </div>

                  {selectedMandate.status && (
                    <div>
                      <div className="mds-info-label-secondary">
                        STATUS
                      </div>
                      <div className={selectedMandate.status === 'aktiv' ? 'mds-mandate-status--aktiv' : 'mds-mandate-status--inaktiv'}>
                        {selectedMandate.status === 'aktiv' ? '✅ Aktiv' : selectedMandate.status === 'widerrufen' ? '🚫 Widerrufen' : '📦 Archiviert'}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mds-info-label-secondary">
                      ERSTELLT AM
                    </div>
                    <div className="mds2-fs-09">
                      {new Date(selectedMandate.erstellungsdatum).toLocaleDateString('de-DE')}
                    </div>
                  </div>

                  {selectedMandate.glaeubiger_id && (
                    <div>
                      <div className="mds-info-label-secondary">
                        GLÄUBIGER-ID
                      </div>
                      <div className="mds2-mono-09">
                        {selectedMandate.glaeubiger_id}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="mds-info-label-secondary">
                      KONTOINHABER
                    </div>
                    <div className="mds2-fs-09">
                      {selectedMandate.kontoinhaber || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <div className="mds-info-label-secondary">
                      IBAN
                    </div>
                    <div className="mds2-mono-09">
                      {selectedMandate.iban || 'N/A'}
                    </div>
                  </div>

                  {selectedMandate.bic && (
                    <div>
                      <div className="mds-info-label-secondary">
                        BIC
                      </div>
                      <div className="mds2-mono-09">
                        {selectedMandate.bic}
                      </div>
                    </div>
                  )}

                  {selectedMandate.archiviert_am && (
                    <div>
                      <div className="mds-info-label-secondary">
                        ARCHIVIERT AM
                      </div>
                      <div className="mds2-fs-09">
                        {new Date(selectedMandate.archiviert_am).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                  )}

                  {selectedMandate.widerruf_datum && (
                    <div>
                      <div className="mds-info-label-secondary">
                        WIDERRUFEN AM
                      </div>
                      <div className="mds2-fs-09">
                        {new Date(selectedMandate.widerruf_datum).toLocaleDateString('de-DE')}
                      </div>
                    </div>
                  )}

                  {selectedMandate.archiviert_grund && (
                    <div>
                      <div className="mds-info-label-secondary">
                        GRUND
                      </div>
                      <div className="mds2-fs-09">
                        {selectedMandate.archiviert_grund}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mds-modal-footer-end">
                  <button
                    className="btn btn-secondary mds2-fs-09"
                    onClick={() => setShowMandateModal(false)}
                  >
                    Schließen
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "mitgliedschaft" && (
            <MitgliedschaftTab
              mitglied={mitglied}
              updatedData={updatedData}
              handleChange={handleChange}
              editMode={editMode}
              isAdmin={isAdmin}
              id={id}
              activeDojo={activeDojo}
              verträge={verträge}
              setVerträge={setVerträge}
              tarife={tarife}
              zahlungszyklen={zahlungszyklen}
              beitraege={beitraege}
              setBeitraege={setBeiträge}
              sepaMandate={sepaMandate}
              setSepaMandate={setSepaMandate}
              archivierteMandate={archivierteMandate}
              setArchivierteMandate={setArchivierteMandate}
              generatingMandate={generatingMandate}
              setGeneratingMandate={setGeneratingMandate}
              lsEinverstaendnis={lsEinverstaendnis}
              setLsEinverstaendnis={setLsEinverstaendnis}
              ruecklastschriftenStats={ruecklastschriftenStats}
              setRuecklastschriftenStats={setRuecklastschriftenStats}
              aktiverRatenplan={aktiverRatenplan}
              setAktiverRatenplan={setAktiverRatenplan}
              setLoading={setLoading}
              setActiveTab={setActiveTab}
              user={user}
            />
          )}

                    {activeTab === "nachrichten" && (
            <NachrichtenTab mitglied={mitglied} />
          )}


          {activeTab === "gurt_stil" && (
            <GurtStilTab
              mitgliedId={id}
              mitglied={mitglied}
              stile={stile}
              memberStile={memberStile}
              setMemberStile={setMemberStile}
              styleSpecificData={styleSpecificData}
              setStyleSpecificData={setStyleSpecificData}
              trainingAnalysis={trainingAnalysis}
              isAdmin={isAdmin}
              editMode={editMode}
              selectedStilId={selectedStilId}
              setSelectedStilId={setSelectedStilId}
              handleAddStyle={handleAddStyle}
              handleRemoveStyle={handleRemoveStyle}
              handleGraduationArrowChange={handleGraduationArrowChange}
              handleExamDateChange={handleExamDateChange}
            />
          )}

            </motion.div>
          </AnimatePresence>

        </div>
      </div>


      {/* Mitgliedsausweis Modal */}
      {showMitgliedsausweis && member && (
        <MitgliedsAusweis
          mitglied={member}
          dojo={currentDojo}
          onClose={() => setShowMitgliedsausweis(false)}
          isModal={true}
        />
      )}

      {/* Vorlagen Senden Modal */}
      {showVorlagenSenden && member && (
        <VorlagenSendenModal
          vorlagenId={null}
          mitgliedId={member.id}
          onClose={() => setShowVorlagenSenden(false)}
        />
      )}

      {/* Hall of Fame Nominierung */}
      {showHofNominierung && (
        <HofNominierungModal
          mitglied={mitglied}
          onClose={() => setShowHofNominierung(false)}
          onSuccess={() => setTimeout(() => setShowHofNominierung(false), 2500)}
        />
      )}

      {/* Archivierungs-Modal */}
      {showArchiveModal && (
        <div
          onClick={() => setShowArchiveModal(false)}
          className="mds-archive-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="mds-archive-modal-box"
          >
            <h2 className="mds-archive-title">
              🗑️ Mitglied archivieren
            </h2>

            <div className="mds2-mb-15-primary">
              <p>
                Möchten Sie <strong className="mds-primary-accent">{mitglied.vorname} {mitglied.nachname}</strong> wirklich archivieren?
              </p>
              <p className="mds-archive-secondary-text">
                Das Mitglied wird aus der aktiven Liste entfernt und mit allen Daten ins Archiv verschoben.
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>

            <div className="mds-archive-reason-row">
              <label className="mds-archive-reason-label">
                Grund (optional):
              </label>
              <textarea
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="z.B. Austritt, Umzug, Kündigung..."
                rows={3}
                className="mds-archive-textarea"
              />
            </div>

            <div className="mds2-flex-end-row">
              <button
                onClick={() => {
                  setShowArchiveModal(false);
                  setArchiveReason('');
                }}
                className="mds-archive-cancel-btn"
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
                className="mds-archive-confirm-btn"
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
    </div>
  );
};


// ── Vertragsanpassung-Sektion (inline in Vertragskarte) ───────────────────
function VertragAnpassungSektion({ vertrag, mitglied, vertragAnpassungen, setVertragAnpassungen, vertragAnpassungForm, setVertragAnpassungForm, editingAnpassungId, setEditingAnpassungId }) {
  const [open, setOpen] = React.useState(true);
  const [showNewForm, setShowNewForm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [localForm, setLocalForm] = React.useState({ typ: 'schueler', neuer_betrag: '', gueltig_von: '', gueltig_bis: '', grund: '' });
  const [localEdit, setLocalEdit] = React.useState({});

  const mid = mitglied?.mitglied_id || mitglied?.id;

  const loadAnpassungen = async () => {
    try {
      const r = await axios.get(`/vertrag-anpassungen/mitglied/${mid}`);
      setVertragAnpassungen(r.data.anpassungen || []);
    } catch {}
  };

  React.useEffect(() => { if (mid) loadAnpassungen(); }, [mid]);

  const handleOpen = async () => {
    if (!open) await loadAnpassungen();
    setOpen(v => !v);
  };

  const typLabels = { schueler: 'Schüler', student: 'Student', azubi: 'Azubi', rentner: 'Rentner', sonstiges: 'Sonstiges', ruhepause: 'Ruhepause' };
  const statusColors = { genehmigt: '#4caf50', beantragt: '#ff9800', abgelehnt: '#f44336', abgelaufen: '#888' };

  const today = new Date().toISOString().slice(0, 10);
  const aktive = vertragAnpassungen.filter(a => a.status === 'genehmigt' && a.gueltig_bis >= today);

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
      <button
        onClick={handleOpen}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.82rem', padding: '0 0 0.25rem 0' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          🎓 <strong style={{ color: 'var(--text-primary)' }}>Vertragsanpassungen</strong>
          {aktive.length > 0 && (
            <span style={{ background: '#4caf5022', color: '#4caf50', borderRadius: 10, padding: '1px 7px', fontSize: '0.72rem', fontWeight: 600 }}>
              {aktive.length} aktiv
            </span>
          )}
        </span>
        <span style={{ fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>

          {/* Bestehende Anpassungen */}
          {vertragAnpassungen.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Keine Anpassungen vorhanden.</p>
          )}
          {vertragAnpassungen.map(a => {
            const isEditing = editingAnpassungId === a.id;
            const edit = localEdit[a.id] || { typ: a.typ, neuer_betrag: a.neuer_betrag, gueltig_von: a.gueltig_von?.slice(0,10), gueltig_bis: a.gueltig_bis?.slice(0,10), grund: a.grund || '' };
            return (
              <div key={a.id} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '0.6rem 0.8rem', border: `1px solid ${statusColors[a.status] || '#555'}30`, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{typLabels[a.typ] || a.typ}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                      {new Date(a.gueltig_von).toLocaleDateString('de-DE')} – {new Date(a.gueltig_bis).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{parseFloat(a.neuer_betrag).toFixed(2).replace('.', ',')} €</span>
                    <span style={{ background: `${statusColors[a.status] || '#555'}18`, color: statusColors[a.status] || '#888', padding: '1px 7px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 600 }}>{a.status}</span>
                    {a.status === 'genehmigt' && (
                      <>
                        <button onClick={() => {
                          if (isEditing) { setEditingAnpassungId(null); return; }
                          setEditingAnpassungId(a.id);
                          setLocalEdit(prev => ({ ...prev, [a.id]: { typ: a.typ, neuer_betrag: a.neuer_betrag, gueltig_von: a.gueltig_von?.slice(0,10), gueltig_bis: a.gueltig_bis?.slice(0,10), grund: a.grund || '' } }));
                        }} style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem' }}>
                          {isEditing ? '✕' : '✏️'}
                        </button>
                        <button onClick={async () => {
                          try {
                            const r2 = await axios.post(`/vertrag-anpassungen/${a.id}/neu-anwenden`);
                            await loadAnpassungen();
                            alert(`✓ ${r2.data.angepasste_beitraege} Beitrag/Beiträge aktualisiert.`);
                          } catch (err) { alert('Fehler: ' + (err.response?.data?.error || err.message)); }
                        }} style={{ padding: '2px 8px', borderRadius: 5, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: '#818cf8', cursor: 'pointer', fontSize: '0.75rem' }}>
                          🔄
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Inline-Edit */}
                {isEditing && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginTop: '0.2rem' }}>
                    {[
                      { label: 'Typ', key: 'typ', type: 'select' },
                      { label: 'Betrag (€)', key: 'neuer_betrag', type: 'number' },
                      { label: 'Gültig von', key: 'gueltig_von', type: 'date' },
                      { label: 'Gültig bis', key: 'gueltig_bis', type: 'date' },
                    ].map(({ label, key, type }) => (
                      <div key={key}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
                        {type === 'select' ? (
                          <select value={edit[key]} onChange={e => setLocalEdit(prev => ({ ...prev, [a.id]: { ...edit, [key]: e.target.value } }))}
                            style={{ width: '100%', padding: '0.35rem', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                            <option value="schueler">Schüler</option>
                            <option value="student">Student</option>
                            <option value="azubi">Azubi</option>
                            <option value="rentner">Rentner</option>
                            <option value="sonstiges">Sonstiges</option>
                          </select>
                        ) : (
                          <input type={type} step={type === 'number' ? '0.01' : undefined} value={edit[key]}
                            onChange={e => setLocalEdit(prev => ({ ...prev, [a.id]: { ...edit, [key]: e.target.value } }))}
                            style={{ width: '100%', padding: '0.35rem', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                        )}
                      </div>
                    ))}
                    <div style={{ gridColumn: '1/-1' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Grund</div>
                      <input type="text" value={edit.grund}
                        onChange={e => setLocalEdit(prev => ({ ...prev, [a.id]: { ...edit, grund: e.target.value } }))}
                        style={{ width: '100%', padding: '0.35rem', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                    </div>
                    <div style={{ gridColumn: '1/-1' }}>
                      <button onClick={async () => {
                        try {
                          await axios.put(`/vertrag-anpassungen/${a.id}`, { typ: edit.typ, neuer_betrag: parseFloat(edit.neuer_betrag), gueltig_von: edit.gueltig_von, gueltig_bis: edit.gueltig_bis, grund: edit.grund || null });
                          await loadAnpassungen();
                          setEditingAnpassungId(null);
                        } catch (err) { alert('Fehler: ' + (err.response?.data?.error || err.message)); }
                      }} style={{ width: '100%', padding: '0.4rem', borderRadius: 5, background: 'rgba(76,175,80,0.12)', border: '1px solid #4caf50', color: '#4caf50', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                        ✓ Speichern
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Neue Anpassung */}
          {!showNewForm ? (
            <button onClick={() => { setShowNewForm(true); setLocalForm({ typ: 'schueler', neuer_betrag: '', gueltig_von: '', gueltig_bis: '', grund: '' }); setError(''); }}
              style={{ padding: '0.4rem 0.8rem', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', alignSelf: 'flex-start' }}>
              + Neue Anpassung
            </button>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '0.75rem', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>Neue Vertragsanpassung</span>
                <button onClick={() => setShowNewForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1rem' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                {[
                  { label: 'Typ', key: 'typ', type: 'select' },
                  { label: 'Neuer Betrag (€)', key: 'neuer_betrag', type: 'number' },
                  { label: 'Gültig von', key: 'gueltig_von', type: 'date' },
                  { label: 'Gültig bis', key: 'gueltig_bis', type: 'date' },
                ].map(({ label, key, type }) => (
                  <div key={key}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
                    {type === 'select' ? (
                      <select value={localForm[key]} onChange={e => setLocalForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ width: '100%', padding: '0.35rem', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: '0.82rem' }}>
                        <option value="schueler">Schüler</option>
                        <option value="student">Student</option>
                        <option value="azubi">Azubi</option>
                        <option value="rentner">Rentner</option>
                        <option value="sonstiges">Sonstiges</option>
                      </select>
                    ) : (
                      <input type={type} step={type === 'number' ? '0.01' : undefined} value={localForm[key]}
                        onChange={e => setLocalForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ width: '100%', padding: '0.35rem', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                    )}
                  </div>
                ))}
                <div style={{ gridColumn: '1/-1' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Grund (optional)</div>
                  <input type="text" value={localForm.grund} onChange={e => setLocalForm(f => ({ ...f, grund: e.target.value }))}
                    style={{ width: '100%', padding: '0.35rem', borderRadius: 5, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)', fontSize: '0.82rem' }} />
                </div>
              </div>
              {error && <div style={{ fontSize: '0.8rem', color: '#ef4444' }}>{error}</div>}
              <button
                disabled={loading}
                onClick={async () => {
                  if (!localForm.neuer_betrag || !localForm.gueltig_von || !localForm.gueltig_bis) { setError('Bitte Betrag, Beginn und Ende ausfüllen.'); return; }
                  setLoading(true); setError('');
                  try {
                    const dojoParam = mitglied?.dojo_id ? `?dojo_id=${mitglied.dojo_id}` : '';
                    await axios.post(`/vertrag-anpassungen${dojoParam}`, {
                      mitglied_id: mid, typ: localForm.typ,
                      alter_betrag: vertrag.monatsbeitrag || 0,
                      neuer_betrag: parseFloat(localForm.neuer_betrag),
                      gueltig_von: localForm.gueltig_von, gueltig_bis: localForm.gueltig_bis,
                      grund: localForm.grund || null
                    });
                    await loadAnpassungen();
                    setShowNewForm(false);
                  } catch (err) { setError(err.response?.data?.error || err.message || 'Fehler'); }
                  finally { setLoading(false); }
                }}
                style={{ padding: '0.45rem', borderRadius: 5, background: 'rgba(76,175,80,0.12)', border: '1px solid #4caf50', color: '#4caf50', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.82rem' }}>
                {loading ? '⏳ Speichern…' : '✓ Anpassung speichern'}
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default MitgliedDetailShared;