// ULTRA CACHE BREAK 2025-01-08 - 06:15 - EXTREME FORCE
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import axios from 'axios';
import VertragFormular from './VertragFormular';
import { useDojoContext } from '../context/DojoContext';
import { useMitgliederUpdate } from '../context/MitgliederUpdateContext';
import '../styles/NeuesMitgliedAnlegen.css';
import "../styles/themes.css";
import "../styles/components.css";

// Custom DateInput Component mit Auto-Advance
const DateInputAutoAdvance = ({ value, onChange, name, id, required }) => {
  // Parse existing value (YYYY-MM-DD format)
  const parseDate = (dateStr) => {
    if (!dateStr) return { day: '', month: '', year: '' };
    const parts = dateStr.split('-');
    return {
      year: parts[0] || '',
      month: parts[1] || '',
      day: parts[2] || ''
    };
  };

  const [dateParts, setDateParts] = React.useState(parseDate(value));

  // Update parent when parts change
  React.useEffect(() => {
    if (dateParts.day && dateParts.month && dateParts.year && dateParts.year.length === 4) {
      const newDate = `${dateParts.year}-${dateParts.month.padStart(2, '0')}-${dateParts.day.padStart(2, '0')}`;
      if (newDate !== value) {
        onChange({ target: { name, value: newDate } });
      }
    }
  }, [dateParts, name, onChange, value]);

  // Sync with external value changes
  React.useEffect(() => {
    const parsed = parseDate(value);
    if (parsed.day !== dateParts.day || parsed.month !== dateParts.month || parsed.year !== dateParts.year) {
      setDateParts(parsed);
    }
  }, [value]);

  const handleDayChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2);
    if (parseInt(val) > 31) val = '31';
    setDateParts(prev => ({ ...prev, day: val }));
    // Auto-advance to month
    if (val.length === 2) {
      document.getElementById(`${id}-month`)?.focus();
    }
  };

  const handleMonthChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 2);
    if (parseInt(val) > 12) val = '12';
    setDateParts(prev => ({ ...prev, month: val }));
    // Auto-advance to year
    if (val.length === 2) {
      document.getElementById(`${id}-year`)?.focus();
    }
  };

  const handleYearChange = (e) => {
    let val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setDateParts(prev => ({ ...prev, year: val }));
  };

  return (
    <div className="nma-date-row">
      <input
        type="text"
        id={`${id}-day`}
        value={dateParts.day}
        onChange={handleDayChange}
        placeholder="TT"
        maxLength={2}
        className="nma-date-input nma-date-input-day"
        required={required}
      />
      <span className="u-text-muted">.</span>
      <input
        type="text"
        id={`${id}-month`}
        value={dateParts.month}
        onChange={handleMonthChange}
        placeholder="MM"
        maxLength={2}
        className="nma-date-input nma-date-input-month"
        required={required}
      />
      <span className="u-text-muted">.</span>
      <input
        type="text"
        id={`${id}-year`}
        value={dateParts.year}
        onChange={handleYearChange}
        placeholder="JJJJ"
        maxLength={4}
        className="nma-date-input nma-date-input-year"
        required={required}
      />
    </div>
  );
};

const NeuesMitgliedAnlegen = ({ onClose, isRegistrationFlow = false, onRegistrationComplete, existingMemberForFamily = null }) => {
  // Hole das aktive Dojo aus dem Context
  const { activeDojo, getBestDojoForNewMember, dojos, filter } = useDojoContext();
  // Hole den Update-Context für automatische Updates
  const { triggerUpdate } = useMitgliederUpdate();

  // FORCE CACHE BREAK - Add unique timestamp
  const cacheBreak = Date.now();

  // ULTRA CACHE BREAK - Inject CSS animations
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      
      /* ULTRA-SPECIFIC MODAL OVERRIDE - BREAK ALL CONTAINERS */
      .modal-overlay {
        position: fixed !important;
        top: 0px !important;
        left: 0px !important;
        right: 0px !important;
        bottom: 0px !important;
        width: 100vw !important;
        height: 100vh !important;
        display: flex !important;
        align-items: flex-start !important;
        justify-content: center !important;
        padding: 0px !important;
        margin: 0px !important;
        z-index: 99999 !important;
        transform: translateY(0px) !important;
      }
      
      .modal-overlay .modal-content {
        margin: 0px !important;
        position: relative !important;
        top: 0px !important;
        left: 0px !important;
        right: 0px !important;
        transform: translateY(0px) !important;
      }
      
      /* BREAK PARENT CONTAINERS */
      * {
        overflow: visible !important;
      }
      
      body {
        overflow: hidden !important;
        margin: 0px !important;
        padding: 0px !important;
      }
      
      html {
        overflow: auto !important;
        margin: 0px !important;
        padding: 0px !important;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // FORCE MODAL POSITION - JavaScript override
  React.useEffect(() => {
    const forceModalPosition = () => {
      const modalOverlay = document.querySelector('.modal-overlay');
      if (modalOverlay) {
        // BREAK OUT OF ALL CONTAINERS
        modalOverlay.style.setProperty('position', 'fixed', 'important');
        modalOverlay.style.setProperty('top', '0px', 'important');
        modalOverlay.style.setProperty('left', '0px', 'important');
        modalOverlay.style.setProperty('right', '0px', 'important');
        modalOverlay.style.setProperty('bottom', '0px', 'important');
        modalOverlay.style.setProperty('width', '100vw', 'important');
        modalOverlay.style.setProperty('height', '100vh', 'important');
        modalOverlay.style.setProperty('display', 'flex', 'important');
        modalOverlay.style.setProperty('align-items', 'flex-start', 'important');
        modalOverlay.style.setProperty('justify-content', 'center', 'important');
        modalOverlay.style.setProperty('padding-top', '0px', 'important');
        modalOverlay.style.setProperty('padding-left', '0px', 'important');
        modalOverlay.style.setProperty('padding-right', '0px', 'important');
        modalOverlay.style.setProperty('padding-bottom', '0px', 'important');
        modalOverlay.style.setProperty('margin', '0px', 'important');
        modalOverlay.style.setProperty('z-index', '99999', 'important');
        modalOverlay.style.setProperty('transform', 'translateY(0px)', 'important');
        
        // FORCE PARENT CONTAINERS
        const parent = modalOverlay.parentElement;
        if (parent) {
          parent.style.setProperty('position', 'static', 'important');
          parent.style.setProperty('overflow', 'visible', 'important');
        }
        
        // ALLOW SCROLLING BUT PREVENT BODY SCROLL
        document.body.style.setProperty('overflow', 'hidden', 'important');
        document.documentElement.style.setProperty('overflow', 'auto', 'important');
      }
    };
    
    // Apply immediately and on any changes
    forceModalPosition();
    const interval = setInterval(forceModalPosition, 50);
    
    return () => {
      clearInterval(interval);
      // RESTORE SCROLLING WHEN COMPONENT UNMOUNTS
      document.body.style.setProperty('overflow', 'auto', 'important');
      document.documentElement.style.setProperty('overflow', 'auto', 'important');
    };
  }, []);
  // Super-Admin-Modus (activeDojo='super-admin') ODER "Alle Dojos"-Filter mit mehreren Dojos
  // Nur im internen Admin-Modul, nie im öffentlichen Registrierungsformular
  const isSuperAdminMode = !isRegistrationFlow && (activeDojo === 'super-admin' || (filter === 'all' && dojos.length > 1));
  const [superAdminDojoConfirmed, setSuperAdminDojoConfirmed] = useState(false);
  const [superAdminSelectedDojo, setSuperAdminSelectedDojo] = useState('');

  // Rückwirkende Abrechnung Modal
  const [rueckwirkendModal, setRueckwirkendModal] = useState(null); // { mitglied_id, vertrag_id, monate, gesamtbetrag, monatsbeitrag }
  const [rueckwirkendModus, setRueckwirkendModus] = useState('einmal');
  const [rueckwirkendAufschlag, setRueckwirkendAufschlag] = useState('');
  const [rueckwirkendLoading, setRueckwirkendLoading] = useState(false);

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [duplicateCheck, setDuplicateCheck] = useState(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [ibanValidation, setIbanValidation] = useState(null);
  const [showAlternativeInput, setShowAlternativeInput] = useState(false);
  const [bankSearchResults, setBankSearchResults] = useState([]);
  const [showBankSearch, setShowBankSearch] = useState(false);

  // Familien-Registrierung State
  const [familyMode, setFamilyMode] = useState(false);
  const [familySessionId, setFamilySessionId] = useState(null);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [addingFamilyMember, setAddingFamilyMember] = useState(false);
  const [newFamilyMember, setNewFamilyMember] = useState({
    vorname: '',
    nachname: '',
    geburtsdatum: '',
    geschlecht: '',
    schueler_student: false,
    email: '',           // Optional - entweder E-Mail oder Benutzername
    benutzername: '',    // Optional - Alternative zu E-Mail
    tarif_id: '',        // Vertrag wird in Schritt 4 ausgewählt
    tarif_name: '',      // Name des gewählten Tarifs
    tarif_preis: 0       // Preis des Tarifs in Cents
  });
  const [availableTarife, setAvailableTarife] = useState([]); // Tarife für Familienmitglieder

  // Bestehendes Mitglied - Nachträgliche Familien-Anmeldung
  const [existingMemberMode, setExistingMemberMode] = useState(false); // Ist bestehendes Mitglied?
  const [existingMemberLogin, setExistingMemberLogin] = useState({
    email: '',
    passwort: '',
    loading: false,
    error: '',
    loggedIn: false
  });
  const [existingMemberData, setExistingMemberData] = useState(null); // Daten des bestehenden Mitglieds

  // Modal immer von oben starten - aggressive Lösung
  useEffect(() => {
    // Scroll zur obersten Position
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    
    // Modal mit mehreren Methoden an die oberste Position bringen
    const forceModalTop = () => {
      const modalOverlay = document.querySelector('.modal-overlay');
      const modalContent = document.querySelector('.modal-content');
      
      if (modalOverlay) {
        // Overlay Positionierung
        modalOverlay.style.position = 'fixed';
        modalOverlay.style.top = '0px';
        modalOverlay.style.left = '0px';
        modalOverlay.style.right = '0px';
        modalOverlay.style.bottom = '0px';
        modalOverlay.style.transform = 'none';
        modalOverlay.style.padding = '0';
        modalOverlay.style.margin = '0';
        modalOverlay.scrollTop = 0;
        
        // Content Positionierung
        if (modalContent) {
          modalContent.style.marginTop = '20px';
          modalContent.style.marginBottom = '20px';
          modalContent.style.marginLeft = 'auto';
          modalContent.style.marginRight = 'auto';
        }
      }
    };
    
    // Mehrfach ausführen für Sicherheit
    forceModalTop();
    setTimeout(forceModalTop, 10);
    setTimeout(forceModalTop, 50);
    setTimeout(forceModalTop, 100);
  }, []);
  
  const [memberData, setMemberData] = useState({
    // Schritt 1: Grunddaten
    vorname: "",
    nachname: "",
    geburtsdatum: "",
    geschlecht: "",
    schueler_student: false,

    // Schritt 2: Kontaktdaten
    email: "",
    telefon: "",
    telefon_mobil: "",
    strasse: "",
    hausnummer: "",
    plz: "",
    ort: "",
    
    // Schritt 3: Erziehungsberechtigte (für Minderjährige)
    erziehungsberechtigt_vorname: "",
    erziehungsberechtigt_nachname: "",
    erziehungsberechtigt_telefon: "",
    erziehungsberechtigt_email: "",
    verhaeltnis: "",
    
    // Schritt 4: Medizinische Daten
    allergien: "",
    medizinische_hinweise: "",
    notfallkontakt_name: "",
    notfallkontakt_telefon: "",
    notfallkontakt_verhaeltnis: "",
    
    // Schritt 5: Bankdaten
    iban: "",
    bic: "",
    bankname: "",
    kontoinhaber: "",
    zahlungsmethode: "SEPA-Lastschrift",
    // Alternative Eingabe
    kontonummer: "",
    bankleitzahl: "",
    
    // Systemfelder
    dojo_id: activeDojo?.id || 1,  // Dynamisch aus DojoContext
    eintrittsdatum: new Date().toISOString().split('T')[0],
    aktiv: true,

    // Schritt 6: Vertragsdaten
    vertrag_tarif_id: '',
    vertrag_billing_cycle: 'monthly',
    vertrag_payment_method: 'direct_debit',
    vertrag_vertragsbeginn: new Date().toISOString().split('T')[0],
    vertrag_vertragsende: '',
    vertrag_kuendigungsfrist_monate: 3,
    vertrag_mindestlaufzeit_monate: 24,
    vertrag_aufnahmegebuehr_cents: 4999,
    vertrag_agb_akzeptiert: false,
    vertrag_datenschutz_akzeptiert: false,
    vertrag_dojo_regeln_akzeptiert: false,
    vertrag_hausordnung_akzeptiert: false,
    vertrag_haftungsausschluss_akzeptiert: false,
    vertrag_gesundheitserklaerung: false,
    vertrag_foto_einverstaendnis: false,
    vertrag_agb_version: '1.0',
    vertrag_datenschutz_version: '1.0',

    // Schritt 7: Widerrufsrecht
    vertragsbeginn_option: '', // 'sofort' oder 'nach_widerruf'
    vertrag_sofortbeginn_zustimmung: false,
    vertrag_widerrufsrecht_kenntnisnahme: false,

    // Schritt 8: Benutzerkonto (nur für öffentliche Registrierung)
    benutzername: '',
    passwort: '',
    passwort_wiederholen: ''
  });

  // Wenn ein bestehendes Mitglied übergeben wurde, Familienmodus automatisch aktivieren
  useEffect(() => {
    if (existingMemberForFamily) {
      console.log('🏠 existingMemberForFamily Mode aktiviert:', existingMemberForFamily);
      // Direkt in Familienmodus wechseln
      setExistingMemberMode(true);
      setExistingMemberLogin(prev => ({ ...prev, loggedIn: true }));
      setExistingMemberData({
        mitglied_id: existingMemberForFamily.mitglied_id,
        vorname: existingMemberForFamily.vorname,
        nachname: existingMemberForFamily.nachname,
        email: existingMemberForFamily.email,
        familien_id: existingMemberForFamily.familien_id || null,
        dojo_id: existingMemberForFamily.dojo_id,
        strasse: existingMemberForFamily.strasse,
        hausnummer: existingMemberForFamily.hausnummer,
        plz: existingMemberForFamily.plz,
        ort: existingMemberForFamily.ort,
        iban: existingMemberForFamily.iban,
        bic: existingMemberForFamily.bic,
        bank_name: existingMemberForFamily.bank_name,
        kontoinhaber: existingMemberForFamily.kontoinhaber
      });
      // dojo_id, Bankdaten + Pflichtfelder (für requireFields-Middleware) vom Hauptmitglied übernehmen
      setMemberData(prev => ({
        ...prev,
        // Pflichtfelder für Backend-Middleware (requireFields prüft diese vor dem Handler)
        vorname: existingMemberForFamily.vorname || prev.vorname,
        nachname: existingMemberForFamily.nachname || prev.nachname,
        geburtsdatum: existingMemberForFamily.geburtsdatum || prev.geburtsdatum,
        dojo_id: existingMemberForFamily.dojo_id,
        existing_member_dojo_id: existingMemberForFamily.dojo_id,
        // Bankdaten vom Hauptmitglied
        iban: existingMemberForFamily.iban || '',
        bic: existingMemberForFamily.bic || '',
        bankname: existingMemberForFamily.bank_name || existingMemberForFamily.bankname || '',
        kontoinhaber: existingMemberForFamily.kontoinhaber || ''
      }));
      // Familie-Session starten (inline, da Funktion noch nicht definiert)
      const sessionId = `family_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setFamilySessionId(sessionId);
      setFamilyMode(true);
      // Direkt zu Schritt 3 (Familie) springen
      setCurrentStep(3);
    }
  }, [existingMemberForFamily]);

  // Prüfe ob Minderjährig
  const isMinor = () => {
    if (!memberData.geburtsdatum) return false;
    const birthDate = new Date(memberData.geburtsdatum);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1 < 18;
    }
    return age < 18;
  };

  // Anzahl der tatsächlichen Schritte (für Navigation)
  const getTotalSteps = () => {
    // 8 Schritte für öffentliche Registrierung (mit Familie + Account), 7 für interne Admin-Erstellung (mit Familie)
    return isRegistrationFlow ? 8 : 7;
  };

  // Anzahl der angezeigten Schritte (für Progress Bar)
  const getDisplayStepCount = () => {
    // 8 Schritte für öffentliche Registrierung (mit Familie + Account), 7 für interne Admin-Erstellung (mit Familie)
    return isRegistrationFlow ? 8 : 7;
  };

  // Mapping für Schrittnummern (1:1 Zuordnung - keine Schritte werden übersprungen)
  const getActualStep = (displayStep) => {
    return displayStep;
  };

  const getDisplayStep = (actualStep) => {
    return actualStep;
  };

  // Hilfsfunktion: Prüfen ob ein Familienmitglied minderjährig ist
  const isFamilyMemberMinor = (geburtsdatum) => {
    if (!geburtsdatum) return false;
    const birthDate = new Date(geburtsdatum);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1 < 18;
    }
    return age < 18;
  };

  // Familienmitglied hinzufügen
  const addFamilyMember = () => {
    // Validierung: Grunddaten erforderlich
    if (!newFamilyMember.vorname || !newFamilyMember.nachname || !newFamilyMember.geburtsdatum || !newFamilyMember.geschlecht) {
      setError("Bitte füllen Sie Vorname, Nachname, Geburtsdatum und Geschlecht aus");
      return;
    }

    // Validierung: Entweder E-Mail ODER Benutzername erforderlich
    if (!newFamilyMember.email && !newFamilyMember.benutzername) {
      setError("Bitte geben Sie entweder eine E-Mail-Adresse oder einen Benutzernamen ein");
      return;
    }

    setFamilyMembers(prev => [...prev, {
      ...newFamilyMember,
      position: prev.length + 2, // Position 1 = Hauptmitglied
      isMinor: isFamilyMemberMinor(newFamilyMember.geburtsdatum)
    }]);

    // Reset form
    setNewFamilyMember({
      vorname: '',
      nachname: '',
      geburtsdatum: '',
      geschlecht: '',
      schueler_student: false,
      email: '',
      benutzername: '',
      tarif_id: '',
      tarif_name: '',
      tarif_preis: 0
    });
    setAddingFamilyMember(false);
    setError("");
  };

  // Familienmitglied entfernen
  const removeFamilyMember = (index) => {
    setFamilyMembers(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Positionen neu berechnen
      return updated.map((member, i) => ({
        ...member,
        position: i + 2
      }));
    });
  };

  // Familien-Session starten
  const startFamilySession = () => {
    const sessionId = `family_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setFamilySessionId(sessionId);
    setFamilyMode(true);
  };

  // Login für bestehendes Mitglied (nachträgliche Familien-Anmeldung)
  const handleExistingMemberLogin = async () => {
    if (!existingMemberLogin.email || !existingMemberLogin.passwort) {
      setExistingMemberLogin(prev => ({ ...prev, error: 'Bitte E-Mail und Passwort eingeben' }));
      return;
    }

    setExistingMemberLogin(prev => ({ ...prev, loading: true, error: '' }));

    try {
      // Login durchführen
      const loginResponse = await axios.post('/public/family-login', {
        email: existingMemberLogin.email,
        passwort: existingMemberLogin.passwort
      });

      if (loginResponse.data.success) {
        const memberData = loginResponse.data.member;

        // Mitgliederdaten speichern
        setExistingMemberData(memberData);

        // Adress- und Bankdaten ins Formular übernehmen
        setMemberData(prev => ({
          ...prev,
          // Adressdaten übernehmen
          strasse: memberData.strasse || '',
          hausnummer: memberData.hausnummer || '',
          plz: memberData.plz || '',
          ort: memberData.ort || '',
          // Bankdaten übernehmen
          kontoinhaber: memberData.kontoinhaber || '',
          iban: memberData.iban || '',
          bic: memberData.bic || '',
          bank_name: memberData.bank_name || ''
        }));

        // Familien-Session starten
        startFamilySession();

        setExistingMemberLogin(prev => ({
          ...prev,
          loading: false,
          loggedIn: true,
          error: ''
        }));

        // Erfolgsmeldung
        setError('');
      } else {
        setExistingMemberLogin(prev => ({
          ...prev,
          loading: false,
          error: loginResponse.data.message || 'Login fehlgeschlagen'
        }));
      }
    } catch (error) {
      console.error('Login-Fehler:', error);
      setExistingMemberLogin(prev => ({
        ...prev,
        loading: false,
        error: error.response?.data?.message || 'Login fehlgeschlagen. Bitte prüfen Sie Ihre Zugangsdaten.'
      }));
    }
  };

  // Tarife für Familienmitglieder laden
  useEffect(() => {
    const loadTarife = async () => {
      try {
        // Immer public/tarife verwenden - funktioniert ohne Auth und hat alle aktiven Tarife
        const response = await axios.get('/public/tarife');
        // API kann entweder direkt ein Array oder {success: true, data: [...]} zurückgeben
        const tarifeData = response.data?.data || response.data;
        // Normalisiere Feldnamen: public API hat 'id' und 'price_cents', interne API hat 'tarif_id' und 'monatlicher_beitrag_cents'
        const normalizedTarife = (Array.isArray(tarifeData) ? tarifeData : []).map(tarif => ({
          ...tarif,
          tarif_id: tarif.tarif_id || tarif.id,
          monatlicher_beitrag_cents: tarif.monatlicher_beitrag_cents ?? tarif.price_cents ?? 0,
          aktiv: tarif.aktiv !== undefined ? tarif.aktiv : true // Public API gibt nur aktive zurück
        }));
        setAvailableTarife(normalizedTarife);
      } catch (error) {
        console.error("Fehler beim Laden der Tarife:", error);
        setAvailableTarife([]);
      }
    };

    if (familyMembers.length > 0 || familyMode) {
      loadTarife();
    }
  }, [familyMembers.length, familyMode, isRegistrationFlow]);

  // Tarif für Familienmitglied aktualisieren
  const updateFamilyMemberTarif = (index, tarifId) => {
    const tarif = (availableTarife || []).find(t => t.tarif_id === parseInt(tarifId));
    if (tarif) {
      setFamilyMembers(prev => prev.map((member, i) => {
        if (i === index) {
          return {
            ...member,
            tarif_id: tarif.tarif_id,
            tarif_name: tarif.name,
            tarif_preis: tarif.monatlicher_beitrag_cents,
            aufnahmegebuehr_cents: tarif.aufnahmegebuehr_cents || 0
          };
        }
        return member;
      }));
    }
  };

  // Tarife nach Alter filtern (Kids = unter 18, Erwachsene = 18+)
  const getFilteredTarife = (geburtsdatum, isSchuelerStudent = false) => {
    const isKid = isFamilyMemberMinor(geburtsdatum);
    return (availableTarife || []).filter(tarif => {
      // Nur aktive Tarife anzeigen
      if (tarif.aktiv === false || tarif.aktiv === 0) return false;

      const tarifName = (tarif.name || '').toLowerCase();
      const gruppe = (tarif.altersgruppe || '').toLowerCase();

      // Spezielle Tarife ausschließen die nicht für normale Mitglieder sind
      if (tarifName.includes('beitragsfrei') || tarifName.includes('anzug') ||
          tarifName.includes('10er karte') || tarifName.includes('familientarif') ||
          tarifName.includes('3.familienmitglied')) return false;

      // Schüler/Studenten (erwachsen): Schüler- und Jugendtarife anzeigen
      if (isSchuelerStudent && !isKid) {
        if (gruppe.includes('schüler') || gruppe.includes('schueler') ||
            gruppe.includes('student') || gruppe.includes('kind') ||
            gruppe.includes('jugend')) return true;
        if (!tarif.altersgruppe) return true;
        return false;
      }

      // Kids-Tarife erkennen (Name oder altersgruppe)
      const isKidsTarif = tarifName.includes('kind') || tarifName.includes('kids') ||
                          tarifName.includes('jugend') || tarifName.includes('schüler') ||
                          tarifName.includes('studenten') ||
                          gruppe.includes('kind') || gruppe.includes('jugend') ||
                          gruppe.includes('schüler') || gruppe.includes('student');

      // Erwachsenen-Tarife erkennen
      const isAdultTarif = tarifName.includes('erwachsen') || gruppe.includes('erwachsen');

      if (isKid) {
        // Für Kinder: Kids-Tarife oder allgemeine Tarife (nicht explizit Erwachsene)
        return isKidsTarif || !isAdultTarif;
      } else {
        // Für Erwachsene: Erwachsenen-Tarife oder allgemeine Tarife (nicht explizit Kids)
        return isAdultTarif || !isKidsTarif;
      }
    });
  };

  // Familien-Rabatt berechnen (aus Rabattsystem)
  const getFamilyDiscount = (position) => {
    // Standard-Rabatte basierend auf Position
    // Diese sollten später aus dem Rabattsystem kommen
    if (position === 2) return { prozent: 10, name: 'Familien-Rabatt (2. Mitglied)' };
    if (position === 3) return { prozent: 15, name: 'Familien-Rabatt (3. Mitglied)' };
    if (position >= 4) return { prozent: 20, name: 'Familien-Rabatt (4.+ Mitglied)' };
    return { prozent: 0, name: '' };
  };

  // Duplikatsprüfung
  const checkDuplicate = async () => {
    if (!memberData.vorname || !memberData.nachname || !memberData.geburtsdatum) {
      setDuplicateCheck(null);
      return;
    }

    setLoading(true);
    setError("");
    try {
      // Bei öffentlicher Registrierung den public-Endpunkt verwenden
      const endpoint = isRegistrationFlow ? '/public/check-duplicate' : '/mitglieder/check-duplicate';
      const response = await axios.post(endpoint, {
        vorname: memberData.vorname,
        nachname: memberData.nachname,
        geburtsdatum: memberData.geburtsdatum,
        geschlecht: memberData.geschlecht
      });

      const result = response.data;
      console.log("🔍 Duplikatsprüfung Ergebnis:", result);
      setDuplicateCheck(result);

      if (result.isDuplicate && result.matches && result.matches.length > 0) {
        console.log("⚠️ Duplikat gefunden, zeige Dialog");
        setShowDuplicateDialog(true);
      }
    } catch (error) {
      console.error("❌ Fehler bei Duplikatsprüfung:", error);
      setError(`Fehler bei der Duplikatsprüfung: ${error.message}`);
      setDuplicateCheck(null);
    } finally {
      setLoading(false);
    }
  };

  // Automatische Duplikatsprüfung bei Schritt 1 Änderungen
  useEffect(() => {
    if (currentStep === 1 && memberData.vorname && memberData.nachname && memberData.geburtsdatum) {
      const timeoutId = setTimeout(() => {
        checkDuplicate();
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [memberData.vorname, memberData.nachname, memberData.geburtsdatum]);

  // Intelligente Dojo-Auswahl für neues Mitglied (nicht im Super-Admin-Modus — dort manuell)
  useEffect(() => {
    if (isSuperAdminMode) return;
    const bestDojo = getBestDojoForNewMember();
    if (bestDojo && bestDojo.id) {
      console.log('🏯 Intelligente Dojo-Auswahl:', bestDojo.id, bestDojo.dojoname);
      console.log('📊 Status:', bestDojo.steuer_status);
      if (bestDojo.steuer_status === 'kleinunternehmer') {
        const auslastung = (bestDojo.jahresumsatz_aktuell / bestDojo.kleinunternehmer_grenze) * 100;
        console.log(`💰 Auslastung: ${auslastung.toFixed(1)}% (${bestDojo.jahresumsatz_aktuell}€ / ${bestDojo.kleinunternehmer_grenze}€)`);
      }
      setMemberData(prev => ({
        ...prev,
        dojo_id: bestDojo.id
      }));
    }
  }, [getBestDojoForNewMember]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    console.log(`🔄 Input geändert: ${name} = ${type === 'checkbox' ? checked : value}`);
    setMemberData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError("");
    
    // IBAN-Validierung bei Änderung
    if (name === 'iban' && value.length > 10) {
      validateIban(value);
    }
  };

  // IBAN validieren und BIC automatisch setzen
  const validateIban = async (iban) => {
    if (!iban || iban.length < 22) return;

    try {
      // Bei öffentlicher Registrierung den public-Endpunkt verwenden
      const endpoint = isRegistrationFlow ? '/public/banken/validate-iban' : '/banken/validate-iban';
      const response = await axios.post(endpoint, { iban });
      const result = response.data;
      setIbanValidation(result);

      if (result.valid && result.bic) {
        setMemberData(prev => ({
          ...prev,
          bic: result.bic,
          bankname: result.bankname
        }));
      }
    } catch (error) {
      console.error("Fehler bei IBAN-Validierung:", error);
    }
  };

  // Konto-Nummer + BLZ zu IBAN konvertieren
  const convertKtoBlzToIban = async () => {
    const { kontonummer, bankleitzahl } = memberData;

    if (!kontonummer || !bankleitzahl) {
      setError("Bitte geben Sie Kontonummer und Bankleitzahl ein");
      return;
    }

    try {
      // Bei öffentlicher Registrierung den public-Endpunkt verwenden
      const endpoint = isRegistrationFlow ? '/public/banken/kto-blz-to-iban' : '/banken/kto-blz-to-iban';
      const response = await axios.post(endpoint, { kontonummer, bankleitzahl });
      const result = response.data;

      setMemberData(prev => ({
        ...prev,
        iban: result.iban,
        bic: result.bic,
        bankname: result.bankname
      }));

      setError("");
      setShowAlternativeInput(false);
    } catch (error) {
      console.error("Fehler bei IBAN-Konvertierung:", error);
      setError("Fehler bei der IBAN-Erstellung");
    }
  };

  // Bank-Suche
  const searchBanks = async (searchTerm) => {
    if (searchTerm.length < 2) {
      setBankSearchResults([]);
      return;
    }

    try {
      // Bei öffentlicher Registrierung den public-Endpunkt verwenden
      const endpoint = isRegistrationFlow ? '/public/banken/search' : '/banken/search';
      const response = await axios.get(endpoint, { params: { q: searchTerm } });
      setBankSearchResults(response.data);
    } catch (error) {
      console.error("Fehler bei der Bankensuche:", error);
      setBankSearchResults([]);
    }
  };

  // Bank auswählen
  const selectBank = (bank) => {
    setMemberData(prev => ({
      ...prev,
      bankname: bank.bankname,
      bic: bank.bic,
      bankleitzahl: bank.bankleitzahl
    }));
    setBankSearchResults([]);
    setShowBankSearch(false);
  };

  const handleNext = () => {
    // Validierung Schritt 1: Grunddaten (gleich für beide Flows)
    if (currentStep === 1) {
      if (!memberData.vorname || !memberData.nachname || !memberData.geburtsdatum || !memberData.geschlecht) {
        setError("Bitte füllen Sie alle Felder aus");
        return;
      }
      if (duplicateCheck?.isDuplicate && !showDuplicateDialog) {
        setShowDuplicateDialog(true);
        return;
      }
    }

    // Validierung Schritt 2: Kontaktdaten (gleich für beide Flows)
    if (currentStep === 2) {
      if (!memberData.email || !memberData.telefon_mobil || !memberData.strasse || !memberData.hausnummer || !memberData.plz || !memberData.ort) {
        setError("Bitte füllen Sie alle Pflichtfelder aus (E-Mail, Telefon Mobil, Straße, Hausnummer, PLZ, Ort)");
        return;
      }
    }

    // Für öffentliche Registrierung (8 Schritte mit Familie)
    if (isRegistrationFlow) {
      // Schritt 3: Familie - keine Pflichtfelder, wird im Step selbst gehandhabt

      // Validierung Schritt 4: Vertragsdaten
      if (currentStep === 4) {
        // Hauptmitglied-Vertrag nur validieren wenn NICHT im existing member mode
        if (!existingMemberMode) {
          if (!memberData.vertrag_tarif_id) {
            setError("Bitte wählen Sie einen Tarif aus");
            return;
          }
          if (!memberData.vertrag_agb_akzeptiert || !memberData.vertrag_datenschutz_akzeptiert ||
              !memberData.vertrag_dojo_regeln_akzeptiert || !memberData.vertrag_hausordnung_akzeptiert) {
            setError("Bitte akzeptieren Sie AGB, Datenschutz, Dojo-Regeln und Hausordnung");
            return;
          }
        }
        // Prüfen ob alle Familienmitglieder einen Tarif haben
        if (familyMembers.length > 0) {
          const missingTarif = familyMembers.find(m => !m.tarif_id);
          if (missingTarif) {
            setError(`Bitte wählen Sie einen Tarif für ${missingTarif.vorname} ${missingTarif.nachname}`);
            return;
          }
        }
        // Bei existing member mode muss mindestens ein Familienmitglied vorhanden sein
        if (existingMemberMode && familyMembers.length === 0) {
          setError("Bitte fügen Sie mindestens ein Familienmitglied hinzu");
          return;
        }
      }

      // Validierung Schritt 5: Bankdaten
      if (currentStep === 5) {
        if (!memberData.kontoinhaber || !memberData.iban) {
          setError("Bitte füllen Sie alle Pflichtfelder der Bankdaten aus (Kontoinhaber, IBAN)");
          return;
        }
      }

      // Schritt 6: Medizinisch - keine Pflichtfelder

      // Validierung Schritt 7: Widerrufsrecht
      if (currentStep === 7) {
        if (!memberData.vertragsbeginn_option) {
          setError("Bitte wählen Sie eine Option für den Vertragsbeginn");
          return;
        }
        if (memberData.vertragsbeginn_option === 'sofort' &&
            (!memberData.vertrag_sofortbeginn_zustimmung || !memberData.vertrag_widerrufsrecht_kenntnisnahme)) {
          setError("Bei Sofortbeginn müssen Sie beide Bestätigungen akzeptieren");
          return;
        }
      }
    } else {
      // Für Admin-Bereich (7 Schritte mit Familie)

      // Schritt 3: Familie - keine Pflichtfelder, wird im Step selbst gehandhabt

      // Validierung Schritt 4: Vertragsdaten
      if (currentStep === 4) {
        // Hauptmitglied-Tarif nur prüfen wenn kein bestehendes Mitglied (existingMemberMode)
        if (!existingMemberMode) {
          if (!memberData.vertrag_tarif_id) {
            setError("Bitte wählen Sie einen Tarif aus");
            return;
          }
          if (!memberData.vertrag_agb_akzeptiert || !memberData.vertrag_datenschutz_akzeptiert ||
              !memberData.vertrag_dojo_regeln_akzeptiert || !memberData.vertrag_hausordnung_akzeptiert) {
            setError("Bitte akzeptieren Sie AGB, Datenschutz, Dojo-Regeln und Hausordnung");
            return;
          }
        }
        // Vertragsbeginn für Familienmitglieder pflicht
        if (existingMemberMode && !memberData.vertrag_vertragsbeginn) {
          setError("Bitte geben Sie den Vertragsbeginn für die Familienmitglieder an");
          return;
        }
        // Prüfen ob alle Familienmitglieder einen Tarif haben
        if (familyMembers.length > 0) {
          const missingTarif = familyMembers.find(m => !m.tarif_id);
          if (missingTarif) {
            setError(`Bitte wählen Sie einen Tarif für ${missingTarif.vorname} ${missingTarif.nachname}`);
            return;
          }
        }
      }

      // Validierung Schritt 5: Bankdaten
      if (currentStep === 5) {
        if (!memberData.kontoinhaber || !memberData.iban) {
          setError("Bitte füllen Sie alle Pflichtfelder der Bankdaten aus (Kontoinhaber, IBAN)");
          return;
        }
      }

      // Schritt 6: Medizinisch - keine Pflichtfelder

      // Validierung Schritt 7: Widerrufsrecht
      if (currentStep === 7) {
        if (!memberData.vertragsbeginn_option) {
          setError("Bitte wählen Sie eine Option für den Vertragsbeginn");
          return;
        }
        if (memberData.vertragsbeginn_option === 'sofort' &&
            (!memberData.vertrag_sofortbeginn_zustimmung || !memberData.vertrag_widerrufsrecht_kenntnisnahme)) {
          setError("Bei Sofortbeginn müssen Sie beide Bestätigungen akzeptieren");
          return;
        }
      }
    }

    const totalSteps = getTotalSteps();
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDuplicateContinue = () => {
    setShowDuplicateDialog(false);
    setCurrentStep(2);
  };

  const handleDuplicateEdit = () => {
    setShowDuplicateDialog(false);
    onClose();
    // Hier könnte man das bestehende Mitglied öffnen
    // navigate(`/mitglieder/${duplicateCheck.matches[0].mitglied_id}`);
  };

  const handleSubmit = async () => {
    console.log("🚀 handleSubmit aufgerufen");
    console.log("📋 MemberData:", memberData);

    // Erweiterte Validierung für Registrierungsprozess
    if (isRegistrationFlow) {
      // Alle Pflichtfelder für vollständige Registrierung prüfen
      const requiredFields = ['vorname', 'nachname', 'geburtsdatum', 'email', 'telefon', 'strasse', 'hausnummer', 'plz', 'ort'];
      const missingFields = requiredFields.filter(field => !memberData[field]);
      
      if (missingFields.length > 0) {
        setError(`Bitte füllen Sie alle Pflichtfelder aus. Fehlend: ${missingFields.join(', ')}`);
        return;
      }

      // Vertragsdaten prüfen
      if (!memberData.vertrag_agb_akzeptiert || !memberData.vertrag_datenschutz_akzeptiert || !memberData.vertrag_dojo_regeln_akzeptiert || !memberData.vertrag_hausordnung_akzeptiert) {
        setError("Bitte akzeptieren Sie die AGB, Datenschutzerklärung, Dojo-Regeln und Hausordnung.");
        return;
      }

      // Widerrufsrecht-Prüfung (Schritt 7)
      if (!memberData.vertragsbeginn_option) {
        setError("Bitte wählen Sie eine Option für den Vertragsbeginn (Sofortbeginn oder Normaler Beginn).");
        return;
      }

      if (memberData.vertragsbeginn_option === 'sofort') {
        if (!memberData.vertrag_sofortbeginn_zustimmung || !memberData.vertrag_widerrufsrecht_kenntnisnahme) {
          setError("Bei Sofortbeginn müssen Sie beide Bestätigungen akzeptieren.");
          return;
        }
      }

      if (!memberData.vertrag_tarif_id) {
        setError("Bitte wählen Sie einen Tarif aus.");
        return;
      }

      // Bankdaten prüfen (für Zahlungen erforderlich)
      if (!memberData.iban || !memberData.kontoinhaber) {
        setError("Bitte geben Sie vollständige Bankdaten ein (IBAN und Kontoinhaber).");
        return;
      }

      // Benutzerkonto-Validierung (Schritt 8 - nur für öffentliche Registrierung)
      if (!memberData.benutzername || memberData.benutzername.length < 4) {
        setError("Der Benutzername muss mindestens 4 Zeichen lang sein.");
        return;
      }

      if (!memberData.passwort || memberData.passwort.length < 8) {
        setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
        return;
      }

      if (memberData.passwort !== memberData.passwort_wiederholen) {
        setError("Die Passwörter stimmen nicht überein.");
        return;
      }
    } else {
      // Standard-Validierung für Admin-Bereich
      // AGB nur prüfen wenn KEIN bestehendes Mitglied (in existingMemberMode gibt es kein VertragFormular)
      if (!existingMemberMode && (!memberData.vertrag_agb_akzeptiert || !memberData.vertrag_datenschutz_akzeptiert || !memberData.vertrag_dojo_regeln_akzeptiert || !memberData.vertrag_hausordnung_akzeptiert)) {
        setError("Bitte akzeptieren Sie die AGB, Datenschutzerklärung, Dojo-Regeln und Hausordnung.");
        return;
      }

      // Folgende Validierungen NUR wenn NICHT im existingMemberMode
      // (Im existingMemberMode existiert das Hauptmitglied bereits)
      if (!existingMemberMode) {
        // Widerrufsrecht-Prüfung (Schritt 7)
        if (!memberData.vertragsbeginn_option) {
          setError("Bitte wählen Sie eine Option für den Vertragsbeginn (Sofortbeginn oder Normaler Beginn).");
          return;
        }

        if (memberData.vertragsbeginn_option === 'sofort') {
          if (!memberData.vertrag_sofortbeginn_zustimmung || !memberData.vertrag_widerrufsrecht_kenntnisnahme) {
            setError("Bei Sofortbeginn müssen Sie beide Bestätigungen akzeptieren.");
            return;
          }
        }

        if (!memberData.vertrag_tarif_id) {
          setError("Bitte wählen Sie einen Tarif aus.");
          return;
        }
      }

      // Bei existingMemberMode: Prüfen ob alle Familienmitglieder einen Tarif haben
      if (existingMemberMode && familyMembers.length > 0) {
        const missingTarif = familyMembers.find(fm => !fm.tarif_id);
        if (missingTarif) {
          setError(`Bitte wählen Sie einen Tarif für ${missingTarif.vorname} ${missingTarif.nachname} aus.`);
          return;
        }
      }
    }

    setLoading(true);
    setError("");

    try {
      console.log("📤 Sende Daten an API...");
      
      // Für Registrierungsprozess: Zusätzliche Daten hinzufügen
      const submitData = {
        ...memberData,
        registration_complete: isRegistrationFlow, // Flag für vollständige Registrierung
        registration_source: isRegistrationFlow ? 'public_registration' : 'admin_panel',
        // Familien-Daten hinzufügen (wenn vorhanden)
        family_session_id: familySessionId,
        family_members: familyMembers,
        is_hauptmitglied: familyMembers.length > 0 && !existingMemberMode, // Nur Hauptmitglied wenn neue Familie
        familie_position: existingMemberMode ? null : 1, // Bei bestehendem Mitglied: Position wird vom Backend berechnet
        // Nachträgliche Familien-Anmeldung (bestehendes Mitglied)
        existing_member_mode: existingMemberMode,
        existing_member_id: existingMemberData?.mitglied_id || null,
        existing_member_familien_id: existingMemberData?.familien_id || null
      };

      const response = await axios.post('/mitglieder', submitData);

      console.log("✅ Mitglied erfolgreich erstellt:", response.data);

      // Erfolgsmeldung anzeigen
      setError("");

      // 🔄 AUTOMATISCHES UPDATE: Alle betroffenen Komponenten aktualisieren
      triggerUpdate('member_created', response.data);

      if (isRegistrationFlow) {
        if (onRegistrationComplete) onRegistrationComplete(true);
        alert("Registrierung erfolgreich abgeschlossen! Sie können sich jetzt anmelden.");
        onClose();
      } else {
        // Rückwirkende Abrechnung prüfen: Vertrag rückwirkend angelegt?
        const vertragBeginn = memberData.vertrag_vertragsbeginn;
        const vertragId = response.data.vertrag_id;
        const neueMitgliedId = response.data.mitglied_id;

        let zeigeRueckwirkend = false;
        if (vertragBeginn && vertragId) {
          const beginn = new Date(vertragBeginn);
          const heute = new Date();
          const bisMonat = new Date(heute.getFullYear(), heute.getMonth() - 1, 1);
          if (beginn <= bisMonat) {
            // Wie viele Monate rückwirkend?
            let monate = 0;
            const cursor = new Date(beginn.getFullYear(), beginn.getMonth(), 1);
            while (cursor <= bisMonat) { monate++; cursor.setMonth(cursor.getMonth() + 1); }
            if (monate > 0) {
              // Monatsbeitrag aus Formular schätzen (aus Tarifdaten falls vorhanden, sonst 0)
              setRueckwirkendModal({
                mitglied_id: neueMitgliedId,
                vertrag_id: vertragId,
                monate,
                vertragsbeginn: vertragBeginn
              });
              setRueckwirkendModus('einmal');
              setRueckwirkendAufschlag('');
              zeigeRueckwirkend = true;
            }
          }
        }

        if (!zeigeRueckwirkend) {
          alert("Mitglied wurde erfolgreich erstellt!");
          onClose();
        }
      }
      
      // ❌ ENTFERNT: window.location.reload() - wird durch Context-System ersetzt
    } catch (error) {
      console.error("❌ Fehler beim Erstellen des Mitglieds:", error);
      const errData = error.response?.data;
      const errorMsg = errData?.error?.message || errData?.message ||
        (typeof errData?.error === 'string' ? errData.error : null) ||
        error.message || 'Unbekannter Fehler';
      setError(`Fehler beim Speichern: ${errorMsg}`);
      
      if (isRegistrationFlow && onRegistrationComplete) {
        onRegistrationComplete(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => {
    return (
    <div className="step-content">
      <h3 className="nma-step-heading">Schritt 1: Grunddaten</h3>

      <div className="input-container">
        <div className="input-group">
          <label htmlFor="vorname" className="input-label">Vorname *</label>
          <input
            type="text"
            id="vorname"
            name="vorname"
            value={memberData.vorname}
            onChange={handleChange}
            className="input-field"
            data-cache-break={cacheBreak}
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="nachname" className="input-label">Nachname *</label>
          <input
            type="text"
            id="nachname"
            name="nachname"
            value={memberData.nachname}
            onChange={handleChange}
            className="input-field"
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="geburtsdatum" className="input-label">Geburtsdatum * (TT.MM.JJJJ)</label>
          <DateInputAutoAdvance
            id="geburtsdatum"
            name="geburtsdatum"
            value={memberData.geburtsdatum}
            onChange={handleChange}
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="geschlecht" className="input-label">Geschlecht *</label>
          <select
            id="geschlecht"
            name="geschlecht"
            value={memberData.geschlecht}
            onChange={handleChange}
            className="input-field"
            required
          >
            <option value="">Bitte wählen</option>
            <option value="m">Männlich</option>
            <option value="w">Weiblich</option>
            <option value="d">Divers</option>
          </select>
        </div>
      </div>

      {/* Schüler/Student Checkbox - nur für Volljährige */}
      {!isMinor() && memberData.geburtsdatum && (
        <div className="nma-schueler-box">
          <label className="nma-schueler-label">
            <input
              type="checkbox"
              name="schueler_student"
              checked={memberData.schueler_student || false}
              onChange={handleChange}
              className="nma-schueler-checkbox"
            />
            <span className="nma-schueler-text">
              🎓 Ich bin Schüler/in oder Student/in
            </span>
          </label>
          {memberData.schueler_student && (
            <div className="nma-schueler-info">
              ℹ️ <strong className="u-text-primary">Hinweis:</strong> Bitte laden Sie später einen gültigen Schülerausweis oder eine Immatrikulationsbescheinigung hoch. Der Upload kann nach der Registrierung im Mitgliederprofil erfolgen.
            </div>
          )}
        </div>
      )}

      {duplicateCheck?.isDuplicate && (
        <div className="duplicate-warning">
          ⚠️ Es wurde bereits ein Mitglied mit diesen Daten gefunden: {duplicateCheck.message}
        </div>
      )}

      {duplicateCheck && !duplicateCheck.isDuplicate && (
        <div className="no-duplicate-info">
          ✅ Keine Duplikate gefunden
        </div>
      )}

      {loading && <div className="loading">Prüfe auf Duplikate...</div>}
    </div>
    );
  };

  const renderStep2 = () => (
    <div className="step-content">
      <h3>Schritt 2: Kontaktdaten</h3>
      <div className="input-container">
        <div className="input-group">
          <label htmlFor="email" className="input-label">E-Mail *</label>
          <input
            type="email"
            id="email"
            name="email"
            value={memberData.email}
            onChange={handleChange}
            className="input-field"
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="telefon" className="input-label">Telefon (Festnetz)</label>
          <input
            type="tel"
            id="telefon"
            name="telefon"
            value={memberData.telefon}
            onChange={handleChange}
            className="input-field"
          />
        </div>

        <div className="input-group">
          <label htmlFor="telefon_mobil" className="input-label">Telefon (Mobil) *</label>
          <input
            type="tel"
            id="telefon_mobil"
            name="telefon_mobil"
            value={memberData.telefon_mobil}
            onChange={handleChange}
            className="input-field"
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="strasse" className="input-label">Straße *</label>
          <input
            type="text"
            id="strasse"
            name="strasse"
            value={memberData.strasse}
            onChange={handleChange}
            className="input-field"
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="hausnummer" className="input-label">Hausnummer *</label>
          <input
            type="text"
            id="hausnummer"
            name="hausnummer"
            value={memberData.hausnummer}
            onChange={handleChange}
            className="input-field"
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="plz" className="input-label">PLZ *</label>
          <input
            type="text"
            id="plz"
            name="plz"
            value={memberData.plz}
            onChange={handleChange}
            className="input-field"
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="ort" className="input-label">Ort *</label>
          <input
            type="text"
            id="ort"
            name="ort"
            value={memberData.ort}
            onChange={handleChange}
            className="input-field"
            required
          />
        </div>
      </div>
    </div>
  );

  // Familien-Schritt (nur für öffentliche Registrierung)
  const renderFamilyStep = () => (
    <div className="step-content">
      <h3 className="nma-family-heading">Schritt 3: Familien-Registrierung</h3>

      {/* Wenn noch nicht entschieden */}
      {!familyMode && familyMembers.length === 0 && !existingMemberMode && (
        <div className="nma-family-choice-box">
          <h4 className="nma-section-heading">
            Familien-Registrierung
          </h4>
          <p className="nma-family-desc">
            Familienmitglieder teilen Adresse und Bankverbindung, erhalten aber jeweils ein eigenes Konto
            und einen eigenen Vertrag. Ab dem 2. Familienmitglied gilt ein Familien-Rabatt.
          </p>

          <div className="u-flex-col-md">
            {/* Option 1: Weitere Mitglieder anmelden (Neukunde) */}
            <button
              type="button"
              onClick={startFamilySession}
              className="nma-btn-family-primary"
            >
              <span className="nma-option-title">Ja, weitere Familienmitglieder anmelden</span>
              <span className="nma-option-subtitle">
                Ich bin neu und möchte mich zusammen mit meiner Familie anmelden
              </span>
            </button>

            {/* Option 2: Nur mich anmelden */}
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="nma-btn-family-neutral"
            >
              <span className="nma-option-title">Nein, nur mich anmelden</span>
              <span className="nma-btn-subtitle-sm">
                Ich möchte mich einzeln ohne weitere Familienmitglieder anmelden
              </span>
            </button>

            {/* Option 3: Bestehendes Mitglied - Familienmitglied hinzufügen */}
            <button
              type="button"
              onClick={() => setExistingMemberMode(true)}
              className="nma-btn-family-green"
            >
              <span className="nma-option-title">Ich bin bereits Mitglied</span>
              <span className="nma-option-subtitle">
                Ich möchte ein Familienmitglied zu meiner bestehenden Mitgliedschaft hinzufügen
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Login-Formular für bestehendes Mitglied */}
      {existingMemberMode && !existingMemberLogin.loggedIn && (
        <div className="nma-existing-login-box">
          <h4 className="nma-existing-login-heading">
            Anmelden als bestehendes Mitglied
          </h4>
          <p className="nma-existing-login-desc">
            Bitte melden Sie sich mit Ihren Zugangsdaten an. Ihre Adresse und Bankdaten werden
            automatisch für das neue Familienmitglied übernommen.
          </p>

          <div className="nma-login-grid">
            <div>
              <label className="nma-login-label">
                E-Mail-Adresse *
              </label>
              <input
                type="email"
                value={existingMemberLogin.email}
                onChange={(e) => setExistingMemberLogin(prev => ({ ...prev, email: e.target.value, error: '' }))}
                placeholder="Ihre E-Mail-Adresse"
                className="nma-login-input"
              />
            </div>

            <div>
              <label className="nma-login-label">
                Passwort *
              </label>
              <input
                type="password"
                value={existingMemberLogin.passwort}
                onChange={(e) => setExistingMemberLogin(prev => ({ ...prev, passwort: e.target.value, error: '' }))}
                placeholder="Ihr Passwort"
                onKeyDown={(e) => e.key === 'Enter' && handleExistingMemberLogin()}
                className="nma-login-input"
              />
            </div>

            {/* Fehlermeldung */}
            {existingMemberLogin.error && (
              <div className="nma-login-error">
                {existingMemberLogin.error}
              </div>
            )}

            <div className="nma-login-btn-row">
              <button
                type="button"
                onClick={handleExistingMemberLogin}
                disabled={existingMemberLogin.loading}
                className="nma-btn-login-submit"
              >
                {existingMemberLogin.loading ? 'Wird geprüft...' : 'Anmelden'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setExistingMemberMode(false);
                  setExistingMemberLogin({ email: '', passwort: '', loading: false, error: '', loggedIn: false });
                }}
                className="nma-btn-login-cancel"
              >
                Zurück
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Erfolgreich eingeloggt - Bestätigung */}
      {existingMemberMode && existingMemberLogin.loggedIn && existingMemberData && (
        <div className="nma-logged-in-box">
          <div className="nma-member-header">
            <span className="nma-badge-green">Bestehendes Mitglied</span>
            <span className="nma-logged-in-status">✓ Angemeldet</span>
          </div>
          <h4 className="nma-member-name">
            {existingMemberData.vorname} {existingMemberData.nachname}
          </h4>
          <p className="nma-text-sm-muted">
            {existingMemberData.strasse} {existingMemberData.hausnummer}, {existingMemberData.plz} {existingMemberData.ort}
          </p>
          <p className="nma-note-italic">
            Adresse und Bankdaten werden für das neue Familienmitglied übernommen.
          </p>
        </div>
      )}

      {/* Familien-Übersicht wenn im Familien-Modus */}
      {(familyMode || familyMembers.length > 0) && (
        <div>
          {/* Hauptmitglied - unterschiedliche Anzeige je nach Modus */}
          {existingMemberMode && existingMemberData ? (
            /* Bestehendes Mitglied als Hauptmitglied */
            <div className="nma-family-main-existing">
              <div className="nma-member-header">
                <span className="nma-badge-green">Bestehendes Hauptmitglied</span>
              </div>
              <h4 className="nma-member-name">
                {existingMemberData.vorname} {existingMemberData.nachname}
              </h4>
              <p className="nma-text-sm-muted">
                Bestehender Vertrag - keine Änderung
              </p>
            </div>
          ) : (
            /* Neues Hauptmitglied (normale Registrierung) */
            <div className="nma-family-main-new">
              <div className="nma-member-header">
                <span className="nma-badge-green">Hauptmitglied</span>
              </div>
              <h4 className="nma-member-name">
                {memberData.vorname} {memberData.nachname}
              </h4>
              <p className="nma-text-sm-muted">
                Voller Beitrag
              </p>
            </div>
          )}

          {/* Weitere Familienmitglieder */}
          {familyMembers.map((member, index) => (
            <div key={index} className="nma-family-member-item">
              <div className="nma-family-member-header-row">
                <div className="u-flex-row-md">
                  <span className="nma-badge-blue">{member.position}. Familienmitglied</span>
                  {member.isMinor && (
                    <span className="nma-badge-amber">Minderjährig</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeFamilyMember(index)}
                  className="nma-btn-remove"
                >
                  Entfernen
                </button>
              </div>
              <h4 className="nma-member-name">
                {member.vorname} {member.nachname}
              </h4>
              <p className="nma-text-sm-muted">
                Mit Familien-Rabatt • {member.email}
              </p>
              {member.isMinor && (
                <p className="nma-note-italic">
                  {memberData.vorname} {memberData.nachname} wird als Erziehungsberechtigte/r hinterlegt.
                </p>
              )}
            </div>
          ))}

          {/* Neues Familienmitglied hinzufügen */}
          {!addingFamilyMember ? (
            <button
              type="button"
              onClick={() => setAddingFamilyMember(true)}
              className="nma-btn-add-family"
            >
              + Weiteres Familienmitglied hinzufügen
            </button>
          ) : (
            /* Formular für neues Familienmitglied */
            <div className="nma-family-form-box">
              <h4 className="nma-section-heading">
                Familienmitglied {familyMembers.length + 2} hinzufügen
              </h4>

              <div className="u-grid-2col">
                <div className="input-group">
                  <label className="input-label">
                    Vorname *
                  </label>
                  <input
                    type="text"
                    value={newFamilyMember.vorname}
                    onChange={(e) => setNewFamilyMember(prev => ({ ...prev, vorname: e.target.value }))}
                    className="input-field nma-family-input"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">
                    Nachname *
                  </label>
                  <input
                    type="text"
                    value={newFamilyMember.nachname}
                    onChange={(e) => setNewFamilyMember(prev => ({ ...prev, nachname: e.target.value }))}
                    className="input-field nma-family-input"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">
                    Geburtsdatum * (TT.MM.JJJJ)
                  </label>
                  <DateInputAutoAdvance
                    id="family-geburtsdatum"
                    name="geburtsdatum"
                    value={newFamilyMember.geburtsdatum}
                    onChange={(e) => setNewFamilyMember(prev => ({ ...prev, geburtsdatum: e.target.value }))}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">
                    Geschlecht *
                  </label>
                  <select
                    value={newFamilyMember.geschlecht}
                    onChange={(e) => setNewFamilyMember(prev => ({ ...prev, geschlecht: e.target.value }))}
                    className="input-field nma-family-input"
                  >
                    <option value="">Bitte wählen</option>
                    <option value="m">Männlich</option>
                    <option value="w">Weiblich</option>
                    <option value="d">Divers</option>
                  </select>
                </div>

                {/* Schüler/Student-Checkbox – nur für Erwachsene */}
              {newFamilyMember.geburtsdatum && !isFamilyMemberMinor(newFamilyMember.geburtsdatum) && (
                <div className="input-group nma-full-span">
                  <label className="nma-checkbox-label-flex">
                    <input
                      type="checkbox"
                      checked={newFamilyMember.schueler_student || false}
                      onChange={(e) => setNewFamilyMember(prev => ({ ...prev, schueler_student: e.target.checked }))}
                    />
                    Schüler/Student (ermäßigter Tarif)
                  </label>
                </div>
              )}

              {/* E-Mail ODER Benutzername */}
                <div className="input-group">
                  <label className="input-label">
                    E-Mail-Adresse {!newFamilyMember.benutzername && '*'}
                  </label>
                  <input
                    type="email"
                    value={newFamilyMember.email}
                    onChange={(e) => setNewFamilyMember(prev => ({ ...prev, email: e.target.value }))}
                    className="input-field nma-family-input"
                    placeholder="Optional wenn Benutzername"
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">
                    Benutzername {!newFamilyMember.email && '*'}
                  </label>
                  <input
                    type="text"
                    value={newFamilyMember.benutzername}
                    onChange={(e) => setNewFamilyMember(prev => ({ ...prev, benutzername: e.target.value }))}
                    className="input-field nma-family-input"
                    placeholder="Optional wenn E-Mail"
                  />
                </div>
              </div>

              {/* Info-Box */}
              <div className="nma-family-info-box">
                <p className="nma-text-sm-muted">
                  ℹ️ Adresse und Bankverbindung werden vom Hauptmitglied übernommen.<br/>
                  💡 E-Mail oder Benutzername - mindestens eines ist erforderlich.
                </p>
              </div>

              {/* Minderjährig-Hinweis */}
              {newFamilyMember.geburtsdatum && isFamilyMemberMinor(newFamilyMember.geburtsdatum) && (
                <div className="nma-family-minor-box">
                  <p className="nma-text-sm-muted">
                    👶 Dieses Mitglied ist minderjährig. {memberData.vorname} {memberData.nachname} wird als Erziehungsberechtigte/r hinterlegt.
                  </p>
                </div>
              )}

              {/* Buttons */}
              <div className="nma-family-btn-row">
                <button
                  type="button"
                  onClick={addFamilyMember}
                  className="nma-btn-family-confirm"
                >
                  Hinzufügen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingFamilyMember(false);
                    setNewFamilyMember({
                      vorname: '',
                      nachname: '',
                      geburtsdatum: '',
                      geschlecht: '',
                      schueler_student: false,
                      email: '',
                      benutzername: '',
                      tarif_id: '',
                      tarif_name: '',
                      tarif_preis: 0
                    });
                  }}
                  className="nma-btn-family-cancel"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          )}

          {/* Info zum Familien-Rabatt */}
          {familyMembers.length > 0 && (
            <div className="nma-family-discount-info">
              <p className="nma-family-discount-text">
                ✓ <strong>{familyMembers.length}</strong> weitere{familyMembers.length === 1 ? 's' : ''} Familienmitglied{familyMembers.length === 1 ? '' : 'er'} hinzugefügt<br/>
                ✓ Familien-Rabatt wird automatisch angewendet<br/>
                ✓ Jedes Mitglied erhält ein eigenes Konto und einen eigenen Vertrag
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="step-content">
      <h3>Schritt 3: Erziehungsberechtigte {isMinor() ? "(erforderlich)" : "(optional)"}</h3>
      {isMinor() && (
        <div className="minor-info">
          <p>Da das Mitglied minderjährig ist, sind die Daten der Erziehungsberechtigten erforderlich.</p>
        </div>
      )}

      <div className="input-container">
        <div className="input-group">
          <label htmlFor="erziehungsberechtigt_vorname" className="input-label">Vorname {isMinor() ? '*' : ''}</label>
          <input
            type="text"
            id="erziehungsberechtigt_vorname"
            name="erziehungsberechtigt_vorname"
            value={memberData.erziehungsberechtigt_vorname}
            onChange={handleChange}
            className="input-field"
            required={isMinor()}
          />
        </div>

        <div className="input-group">
          <label htmlFor="erziehungsberechtigt_nachname" className="input-label">Nachname {isMinor() ? '*' : ''}</label>
          <input
            type="text"
            id="erziehungsberechtigt_nachname"
            name="erziehungsberechtigt_nachname"
            value={memberData.erziehungsberechtigt_nachname}
            onChange={handleChange}
            className="input-field"
            required={isMinor()}
          />
        </div>

        <div className="input-group">
          <label htmlFor="erziehungsberechtigt_telefon" className="input-label">Telefon {isMinor() ? '*' : ''}</label>
          <input
            type="tel"
            id="erziehungsberechtigt_telefon"
            name="erziehungsberechtigt_telefon"
            value={memberData.erziehungsberechtigt_telefon}
            onChange={handleChange}
            className="input-field"
            required={isMinor()}
          />
        </div>

        <div className="input-group">
          <label htmlFor="erziehungsberechtigt_email" className="input-label">E-Mail {isMinor() ? '*' : ''}</label>
          <input
            type="email"
            id="erziehungsberechtigt_email"
            name="erziehungsberechtigt_email"
            value={memberData.erziehungsberechtigt_email}
            onChange={handleChange}
            className="input-field"
            required={isMinor()}
          />
        </div>

        <div className="input-group">
          <label htmlFor="verhaeltnis" className="input-label">Verhältnis zum Mitglied {isMinor() ? '*' : ''}</label>
          <select
            id="verhaeltnis"
            name="verhaeltnis"
            value={memberData.verhaeltnis}
            onChange={handleChange}
            className="input-field"
            required={isMinor()}
          >
            <option value="">Bitte wählen</option>
            <option value="Vater">Vater</option>
            <option value="Mutter">Mutter</option>
            <option value="Großvater">Großvater</option>
            <option value="Großmutter">Großmutter</option>
            <option value="Vormund">Vormund</option>
            <option value="Andere">Andere</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="step-content">
      <h3>Schritt 5: Medizinische Angaben</h3>
      <div className="input-container">
        <div className="input-group">
          <label htmlFor="allergien" className="input-label">Allergien</label>
          <textarea
            id="allergien"
            name="allergien"
            value={memberData.allergien}
            onChange={handleChange}
            className="input-field"
            rows="3"
            placeholder="Bitte geben Sie bekannte Allergien an..."
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="medizinische_hinweise" className="input-label">Medizinische Hinweise</label>
          <textarea
            id="medizinische_hinweise"
            name="medizinische_hinweise"
            value={memberData.medizinische_hinweise}
            onChange={handleChange}
            className="input-field"
            rows="3"
            placeholder="Bitte geben Sie wichtige medizinische Informationen an..."
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="notfallkontakt_name" className="input-label">Notfallkontakt (Name)</label>
          <input
            type="text"
            id="notfallkontakt_name"
            name="notfallkontakt_name"
            value={memberData.notfallkontakt_name}
            onChange={handleChange}
            className="input-field"
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="notfallkontakt_telefon" className="input-label">Notfallkontakt (Telefon)</label>
          <input
            type="tel"
            id="notfallkontakt_telefon"
            name="notfallkontakt_telefon"
            value={memberData.notfallkontakt_telefon}
            onChange={handleChange}
            className="input-field"
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="notfallkontakt_verhaeltnis" className="input-label">Verhältnis zum Notfallkontakt</label>
          <input
            type="text"
            id="notfallkontakt_verhaeltnis"
            name="notfallkontakt_verhaeltnis"
            value={memberData.notfallkontakt_verhaeltnis}
            onChange={handleChange}
            className="input-field"
            placeholder="z.B. Ehepartner, Vater, Mutter, Freund..."
          />
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="step-content">
      <h3>Schritt 4: Bankdaten</h3>
      <div className="input-container">
        <div className="input-group">
          <label htmlFor="kontoinhaber" className="input-label">Kontoinhaber *</label>
          <input
            type="text"
            id="kontoinhaber"
            name="kontoinhaber"
            value={memberData.kontoinhaber}
            onChange={handleChange}
            className="input-field"
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="iban" className="input-label">IBAN *</label>
          <input
            type="text"
            id="iban"
            name="iban"
            value={memberData.iban}
            onChange={handleChange}
            className="input-field"
            placeholder="DE89 3704 0044 0532 0130 00"
            required
          />
          {ibanValidation && (
            <div>
              {ibanValidation.message}
              {ibanValidation.bankname && <br />}Bank: {ibanValidation.bankname}
            </div>
          )}
        </div>

        <div className="input-group">
          <label htmlFor="bic" className="input-label">BIC *</label>
          <input
            type="text"
            id="bic"
            name="bic"
            value={memberData.bic}
            onChange={handleChange}
            className="input-field"
            placeholder="COBADEFFXXX"
            readOnly={!!ibanValidation?.bic}
            required
          />
        </div>

        <div className="input-group">
          <label htmlFor="bankname" className="input-label">Bankname *</label>
          <input
            type="text"
            id="bankname"
            name="bankname"
            value={memberData.bankname}
            onChange={(e) => {
              handleChange(e);
              if (e.target.value.length >= 2) {
                searchBanks(e.target.value);
                setShowBankSearch(true);
              } else {
                setBankSearchResults([]);
                setShowBankSearch(false);
              }
            }}
            className="input-field"
            readOnly={!!ibanValidation?.bankname}
            placeholder="Bank suchen oder eingeben..."
            required
          />

          {showBankSearch && bankSearchResults.length > 0 && (
            <div>
              {bankSearchResults.map((bank, index) => (
                <div key={index} onClick={() => selectBank(bank)}>
                  <div>{bank.bankname}</div>
                  <div>{bank.bic} • BLZ: {bank.bankleitzahl}</div>
                </div>
              ))}
            </div>
          )}

          {showBankSearch && memberData.bankname.length >= 2 && bankSearchResults.length === 0 && (
            <div>Keine Banken gefunden</div>
          )}
        </div>
      </div>
      
      {/* Alternative Eingabe */}
      <div>
        <button 
          type="button"
          onClick={() => setShowAlternativeInput(!showAlternativeInput)}
        >
          {showAlternativeInput ? 'IBAN-Eingabe verwenden' : 'Konto-Nummer + BLZ eingeben'}
        </button>
        
        {showAlternativeInput && (
          <div className="input-container">
            <div className="input-group">
              <label htmlFor="kontonummer" className="input-label">Konto-Nummer</label>
              <input
                type="text"
                id="kontonummer"
                name="kontonummer"
                value={memberData.kontonummer}
                onChange={handleChange}
                className="input-field"
                placeholder="1234567890"
              />
            </div>
            
            <div className="input-group">
              <label htmlFor="bankleitzahl" className="input-label">Bankleitzahl (BLZ)</label>
              <input
                type="text"
                id="bankleitzahl"
                name="bankleitzahl"
                value={memberData.bankleitzahl}
                onChange={handleChange}
                className="input-field"
                placeholder="12345678"
                maxLength="8"
              />
            </div>
            
            <div className="input-group">
              <button 
                type="button"
                onClick={convertKtoBlzToIban}
                disabled={!memberData.kontonummer || !memberData.bankleitzahl}
              >
                Zu IBAN konvertieren
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep6 = () => (
    <div className="step-content">
      <h3>Schritt {isRegistrationFlow ? '4' : '3'}: Vertragsauswahl</h3>

      {/* Hauptmitglied Vertrag - unterschiedlich je nach Modus */}
      {familyMembers.length > 0 && (
        existingMemberMode && existingMemberData ? (
          /* Bestehendes Mitglied - kein neuer Vertrag nötig */
          <div className="nma-s6-existing-box">
            <span className="nma-s6-badge">Bestehendes Hauptmitglied</span>
            <strong className="u-text-primary">
              {existingMemberData.vorname} {existingMemberData.nachname}
            </strong>
            <span className="nma-tag-secondary">
              (bestehender Vertrag - keine Änderung)
            </span>
          </div>
        ) : (
          /* Neues Hauptmitglied */
          <div className="nma-s6-existing-box">
            <span className="nma-s6-badge">Hauptmitglied</span>
            <strong className="u-text-primary">
              {memberData.vorname} {memberData.nachname}
            </strong>
            <span className="nma-tag-secondary">
              (voller Beitrag)
            </span>
          </div>
        )
      )}

      {/* Vertragsbeginn für Familienmitglieder (nur in existingMemberMode) */}
      {existingMemberMode && (
        <div style={{ margin: '0.75rem 0 1rem', padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>
            Vertragsbeginn für neue Familienmitglieder *
          </label>
          <input
            type="date"
            value={memberData.vertrag_vertragsbeginn || ''}
            onChange={e => setMemberData(prev => ({ ...prev, vertrag_vertragsbeginn: e.target.value }))}
            className="input-field"
            style={{ maxWidth: 220 }}
          />
        </div>
      )}

      {/* VertragFormular nur anzeigen wenn NICHT im existing member mode */}
      {!existingMemberMode && (
        <VertragFormular
          vertrag={{
            tarif_id: memberData.vertrag_tarif_id,
            billing_cycle: memberData.vertrag_billing_cycle,
            payment_method: memberData.vertrag_payment_method,
            vertragsbeginn: memberData.vertrag_vertragsbeginn,
            vertragsende: memberData.vertrag_vertragsende,
            kuendigungsfrist_monate: memberData.vertrag_kuendigungsfrist_monate,
            mindestlaufzeit_monate: memberData.vertrag_mindestlaufzeit_monate,
            aufnahmegebuehr_cents: memberData.vertrag_aufnahmegebuehr_cents,
            agb_akzeptiert: memberData.vertrag_agb_akzeptiert,
            datenschutz_akzeptiert: memberData.vertrag_datenschutz_akzeptiert,
            dojo_regeln_akzeptiert: memberData.vertrag_dojo_regeln_akzeptiert,
            hausordnung_akzeptiert: memberData.vertrag_hausordnung_akzeptiert,
            haftungsausschluss_akzeptiert: memberData.vertrag_haftungsausschluss_akzeptiert,
            gesundheitserklaerung: memberData.vertrag_gesundheitserklaerung,
            foto_einverstaendnis: memberData.vertrag_foto_einverstaendnis,
            agb_version: memberData.vertrag_agb_version,
            datenschutz_version: memberData.vertrag_datenschutz_version
          }}
          onChange={(updatedVertrag) => {
            setMemberData(prev => ({
              ...prev,
              vertrag_tarif_id: updatedVertrag.tarif_id,
              vertrag_billing_cycle: updatedVertrag.billing_cycle,
              vertrag_payment_method: updatedVertrag.payment_method,
              vertrag_vertragsbeginn: updatedVertrag.vertragsbeginn,
              vertrag_vertragsende: updatedVertrag.vertragsende,
              vertrag_kuendigungsfrist_monate: updatedVertrag.kuendigungsfrist_monate,
              vertrag_mindestlaufzeit_monate: updatedVertrag.mindestlaufzeit_monate,
              vertrag_aufnahmegebuehr_cents: updatedVertrag.aufnahmegebuehr_cents,
              vertrag_agb_akzeptiert: updatedVertrag.agb_akzeptiert,
              vertrag_datenschutz_akzeptiert: updatedVertrag.datenschutz_akzeptiert,
              vertrag_dojo_regeln_akzeptiert: updatedVertrag.dojo_regeln_akzeptiert,
              vertrag_hausordnung_akzeptiert: updatedVertrag.hausordnung_akzeptiert,
              vertrag_haftungsausschluss_akzeptiert: updatedVertrag.haftungsausschluss_akzeptiert,
              vertrag_gesundheitserklaerung: updatedVertrag.gesundheitserklaerung,
              vertrag_foto_einverstaendnis: updatedVertrag.foto_einverstaendnis,
              vertrag_agb_version: updatedVertrag.agb_version,
              vertrag_datenschutz_version: updatedVertrag.datenschutz_version
            }));
          }}
          geburtsdatum={memberData.geburtsdatum}
          schuelerStudent={memberData.schueler_student}
          mode="create"
          mitgliedId={null}
          isPublic={isRegistrationFlow}
        />
      )}

      {/* Familienmitglieder Verträge - nur wenn vorhanden */}
      {familyMembers.length > 0 && (
        <div className={existingMemberMode ? '' : 'nma-family-section-spacer'}>
          <h4 className="nma-family-contracts-heading">
            Verträge für Familienmitglieder
          </h4>

          {familyMembers.map((member, index) => {
            const filteredTarife = getFilteredTarife(member.geburtsdatum, member.schueler_student);
            const discount = getFamilyDiscount(member.position);
            const selectedTarif = (availableTarife || []).find(t => t.tarif_id === member.tarif_id);
            const originalPrice = selectedTarif ? selectedTarif.monatlicher_beitrag_cents : 0;
            const discountAmount = Math.round(originalPrice * discount.prozent / 100);
            const finalPrice = originalPrice - discountAmount;

            return (
              <div key={index} className="nma-s6-family-card">
                {/* Header */}
                <div className="nma-s6-card-header">
                  <span className="nma-badge-blue">{member.position}. Familienmitglied</span>
                  <strong className="u-text-primary">
                    {member.vorname} {member.nachname}
                  </strong>
                  {member.isMinor && (
                    <span className="nma-badge-amber">Kind (unter 18)</span>
                  )}
                </div>

                {/* Tarif-Auswahl */}
                <div className="nma-s6-tarif-row">
                  <label className="nma-s6-tarif-label">
                    Vertrag auswählen * {member.isMinor ? '(Kids-Tarife)' : '(Erwachsenen-Tarife)'}
                  </label>
                  <select
                    value={member.tarif_id || ''}
                    onChange={(e) => updateFamilyMemberTarif(index, e.target.value)}
                    className="nma-s6-tarif-select"
                  >
                    <option value="">Bitte Tarif wählen...</option>
                    {filteredTarife.map(tarif => (
                      <option key={tarif.tarif_id} value={tarif.tarif_id}>
                        {tarif.name} - {((tarif.monatlicher_beitrag_cents || 0) / 100).toFixed(2)} €/Monat
                        {tarif.mindestlaufzeit_monate ? ` (${tarif.mindestlaufzeit_monate} Mon. Laufzeit)` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Preis-Berechnung mit Rabatt */}
                {member.tarif_id && selectedTarif && (
                  <div className="nma-s6-price-box">
                    <div className="nma-s6-price-row">
                      <span className="u-text-secondary">Regulärer Preis:</span>
                      <span className="u-text-primary">
                        {(originalPrice / 100).toFixed(2)} €/Monat
                      </span>
                    </div>

                    {discount.prozent > 0 && (
                      <div className="nma-s6-discount-row">
                        <span className="u-flex-row-sm">
                          <span className="nma-s6-discount-badge">-{discount.prozent}%</span>
                          {discount.name}:
                        </span>
                        <span className="nma-s6-discount-amount">
                          -{(discountAmount / 100).toFixed(2)} €
                        </span>
                      </div>
                    )}

                    <div className="nma-s6-total-row">
                      <span className="u-text-primary">Endpreis:</span>
                      <span className="u-text-success">
                        {(finalPrice / 100).toFixed(2)} €/Monat
                      </span>
                    </div>

                    {(selectedTarif.aufnahmegebuehr_cents > 0) && (
                      <div className="nma-s6-price-row" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <span className="u-text-secondary">Aufnahmegebühr (einmalig):</span>
                        <span className="u-text-primary">
                          {(selectedTarif.aufnahmegebuehr_cents / 100).toFixed(2)} €
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Warnung wenn kein Tarif ausgewählt */}
                {!member.tarif_id && (
                  <div className="nma-s6-no-tarif-warning">
                    ⚠️ Bitte wählen Sie einen Tarif für dieses Familienmitglied
                  </div>
                )}
              </div>
            );
          })}

          {/* Gesamtübersicht */}
          <div className="nma-s6-summary-box">
            <h5 className="nma-subsection-heading">
              {existingMemberMode ? 'Neue Mitglieder - Übersicht' : 'Gesamtübersicht Familie'}
            </h5>

            {/* Hauptmitglied - unterschiedlich je nach Modus */}
            {existingMemberMode && existingMemberData ? (
              /* Bestehendes Mitglied */
              <div className="nma-s6-summary-row">
                <span className="u-text-secondary">
                  {existingMemberData.vorname} {existingMemberData.nachname}
                  <span className="nma-badge-success">
                    (Bestehendes Mitglied)
                  </span>
                </span>
                <span className="nma-s6-member-price-existing">
                  bereits Mitglied
                </span>
              </div>
            ) : (
              /* Neues Hauptmitglied */
              <div className="nma-s6-summary-row">
                <span className="u-text-secondary">
                  {memberData.vorname} {memberData.nachname} (Hauptmitglied)
                </span>
                <span className="u-text-primary">
                  {memberData.vertrag_tarif_id ?
                    `${(((availableTarife || []).find(t => t.tarif_id === parseInt(memberData.vertrag_tarif_id))?.monatlicher_beitrag_cents || 0) / 100).toFixed(2)} €` :
                    '-- €'}
                </span>
              </div>
            )}

            {/* Familienmitglieder */}
            {familyMembers.map((member, index) => {
              const discount = getFamilyDiscount(member.position);
              const originalPrice = member.tarif_preis || 0;
              const finalPrice = originalPrice - Math.round(originalPrice * discount.prozent / 100);

              return (
                <div key={index} className="nma-s6-summary-row">
                  <span className="u-text-secondary">
                    {member.vorname || 'Vorname'} {member.nachname || 'Nachname'}
                    {discount.prozent > 0 && (
                      <span className="nma-badge-success">
                        (-{discount.prozent}%)
                      </span>
                    )}
                  </span>
                  <span className={member.tarif_id ? 'nma-price-assigned' : 'nma-price-unassigned'}>
                    {member.tarif_id ? `${(finalPrice / 100).toFixed(2)} €` : '-- €'}
                  </span>
                </div>
              );
            })}

            {/* Gesamtsumme */}
            {(() => {
              const hauptTarif = existingMemberMode ? null :
                (availableTarife || []).find(t => t.tarif_id === parseInt(memberData.vertrag_tarif_id));
              const hauptmonatlich = hauptTarif?.monatlicher_beitrag_cents || 0;
              const hauptaufnahme = existingMemberMode ? 0 : (hauptTarif?.aufnahmegebuehr_cents || 0);
              const familienMonatlich = familyMembers.reduce((sum, member) => {
                const discount = getFamilyDiscount(member.position);
                const price = member.tarif_preis || 0;
                return sum + price - Math.round(price * discount.prozent / 100);
              }, 0);
              const familienAufnahme = familyMembers.reduce((sum, member) => sum + (member.aufnahmegebuehr_cents || 0), 0);
              const gesamtMonatlich = hauptmonatlich + familienMonatlich;
              const gesamtAufnahme = hauptaufnahme + familienAufnahme;
              return (
                <>
                  <div className="nma-s6-total-sum-row">
                    <span className="u-text-primary">{existingMemberMode ? 'Neue Kosten pro Monat:' : 'Gesamt pro Monat:'}</span>
                    <span className="u-text-accent">{(gesamtMonatlich / 100).toFixed(2)} €</span>
                  </div>
                  {gesamtAufnahme > 0 && (
                    <div className="nma-s6-total-sum-row" style={{ marginTop: '0.25rem', fontSize: '0.9em', opacity: 0.85 }}>
                      <span className="u-text-secondary">Aufnahmegebühren gesamt (einmalig):</span>
                      <span className="u-text-primary">{(gesamtAufnahme / 100).toFixed(2)} €</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* AGB-Checkboxen für Familienmitglieder im existingMemberMode */}
          {existingMemberMode && (
            <div className="nma-s6-agb-box">
              <h5 className="nma-subsection-heading">
                Rechtliche Bestätigungen für neue Familienmitglieder
              </h5>

              {/* AGB */}
              <label className={`nma-legal-label${memberData.vertrag_agb_akzeptiert ? ' nma-legal-label--accepted' : ''}`}>
                <input
                  type="checkbox"
                  name="vertrag_agb_akzeptiert"
                  checked={memberData.vertrag_agb_akzeptiert}
                  onChange={handleChange}
                  className="nma-checkbox-scaled"
                />
                <span className="nma-text-primary-sm">
                  Ich akzeptiere die <strong>Allgemeinen Geschäftsbedingungen (AGB)</strong> *
                </span>
              </label>

              {/* Datenschutz */}
              <label className={`nma-legal-label${memberData.vertrag_datenschutz_akzeptiert ? ' nma-legal-label--accepted' : ''}`}>
                <input
                  type="checkbox"
                  name="vertrag_datenschutz_akzeptiert"
                  checked={memberData.vertrag_datenschutz_akzeptiert}
                  onChange={handleChange}
                  className="nma-checkbox-scaled"
                />
                <span className="nma-text-primary-sm">
                  Ich akzeptiere die <strong>Datenschutzerklärung</strong> *
                </span>
              </label>

              {/* Dojo-Regeln */}
              <label className={`nma-legal-label${memberData.vertrag_dojo_regeln_akzeptiert ? ' nma-legal-label--accepted' : ''}`}>
                <input
                  type="checkbox"
                  name="vertrag_dojo_regeln_akzeptiert"
                  checked={memberData.vertrag_dojo_regeln_akzeptiert}
                  onChange={handleChange}
                  className="nma-checkbox-scaled"
                />
                <span className="nma-text-primary-sm">
                  Ich akzeptiere die <strong>Dojo-Regeln</strong> *
                </span>
              </label>

              {/* Hausordnung */}
              <label className={`nma-legal-label${memberData.vertrag_hausordnung_akzeptiert ? ' nma-legal-label--accepted' : ''}`}>
                <input
                  type="checkbox"
                  name="vertrag_hausordnung_akzeptiert"
                  checked={memberData.vertrag_hausordnung_akzeptiert}
                  onChange={handleChange}
                  className="nma-checkbox-scaled"
                />
                <span className="nma-text-primary-sm">
                  Ich akzeptiere die <strong>Hausordnung</strong> *
                </span>
              </label>

              <p className="nma-s6-agb-note">
                * Pflichtfelder - Diese Bestätigungen gelten für alle neuen Familienmitglieder
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStep7 = () => (
    <div className="step-content">
      <h3>Schritt 6: Widerrufsrecht & Vertragsbeginn</h3>

      <div className="nma-s7-box">
        <h4 className="nma-s7-heading">⚖️ Wann möchten Sie mit dem Training beginnen?</h4>

        <div className="nma-s7-choices">
          <label className={`nma-s7-choice-label${memberData.vertragsbeginn_option === 'sofort' ? ' nma-s7-choice-label--selected' : ''}`}>
            <input
              type="radio"
              name="vertragsbeginn_option"
              value="sofort"
              checked={memberData.vertragsbeginn_option === 'sofort'}
              onChange={(e) => setMemberData(prev => ({
                ...prev,
                vertragsbeginn_option: e.target.value,
                vertrag_sofortbeginn_zustimmung: false,
                vertrag_widerrufsrecht_kenntnisnahme: false
              }))}
              className="nma-radio-input"
            />
            <strong className="u-text-accent">Sofortbeginn - Ich möchte sofort trainieren ✅</strong>
            <div className="nma-indent-hint">
              Sie können sofort mit dem Training beginnen. Durch die ausdrückliche Zustimmung zum Sofortbeginn
              erlischt Ihr Widerrufsrecht anteilig bei Inanspruchnahme der Leistung.
            </div>
          </label>

          <label className={`nma-s7-choice-label${memberData.vertragsbeginn_option === 'nach_widerruf' ? ' nma-s7-choice-label--selected' : ''}`}>
            <input
              type="radio"
              name="vertragsbeginn_option"
              value="nach_widerruf"
              checked={memberData.vertragsbeginn_option === 'nach_widerruf'}
              onChange={(e) => setMemberData(prev => ({
                ...prev,
                vertragsbeginn_option: e.target.value,
                vertrag_sofortbeginn_zustimmung: false,
                vertrag_widerrufsrecht_kenntnisnahme: false
              }))}
              className="nma-radio-input"
            />
            <strong className="u-text-accent">Normaler Beginn - Nach 14 Tagen Widerrufsfrist 📅</strong>
            <div className="nma-indent-hint">
              Sie haben volles 14-tägiges Widerrufsrecht. Das Training beginnt erst nach Ablauf der Widerrufsfrist.
            </div>
          </label>
        </div>

        {/* Sofortbeginn-Checkboxen (nur wenn "sofort" gewählt) */}
        {memberData.vertragsbeginn_option === 'sofort' && (
          <div className="nma-s7-confirm-box">
            <h5 className="nma-s7-confirm-heading">Erforderliche Bestätigungen für Sofortbeginn:</h5>

            <label className="nma-s7-confirm-label">
              <input
                type="checkbox"
                checked={memberData.vertrag_sofortbeginn_zustimmung}
                onChange={(e) => setMemberData(prev => ({ ...prev, vertrag_sofortbeginn_zustimmung: e.target.checked }))}
                className="nma-radio-input-top"
              />
              <span className="nma-confirm-text">
                <strong>Ich stimme ausdrücklich zu *</strong>, dass die Dienstleistung vor Ablauf der 14-tägigen Widerrufsfrist beginnt.
              </span>
            </label>

            <label className="nma-s7-confirm-label-last">
              <input
                type="checkbox"
                checked={memberData.vertrag_widerrufsrecht_kenntnisnahme}
                onChange={(e) => setMemberData(prev => ({ ...prev, vertrag_widerrufsrecht_kenntnisnahme: e.target.checked }))}
                className="nma-radio-input-top"
              />
              <span className="nma-confirm-text">
                <strong>Mir ist bekannt *</strong>, dass mein Widerrufsrecht erlischt, wenn die Dienstleistung vollständig erbracht wurde
                und ich mit der Ausführung vor Ende der Widerrufsfrist begonnen habe.
              </span>
            </label>
          </div>
        )}

        {/* Info-Box für normalen Beginn */}
        {memberData.vertragsbeginn_option === 'nach_widerruf' && (
          <div className="nma-s7-widerruf-info">
            <p className="nma-s7-widerruf-text">
              ✓ Sie haben volles 14-tägiges Widerrufsrecht gemäß § 355 BGB.<br/>
              ✓ Das Training beginnt automatisch nach Ablauf der Widerrufsfrist.<br/>
              ✓ Sie können den Vertrag innerhalb von 14 Tagen ohne Angabe von Gründen widerrufen.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  const renderStep8 = () => (
    <div className="step-content">
      <h3>Schritt 7: Benutzerkonto erstellen</h3>

      <div className="nma-s8-box">
        <h4 className="nma-section-heading">🔐 Erstellen Sie Ihren Login-Zugang</h4>
        <p className="nma-s8-desc">
          Mit diesen Zugangsdaten können Sie sich später im Mitgliederportal anmelden und Ihre Daten verwalten.
        </p>

        <div className="input-container">
          <div className="input-group nma-full-span">
            <label htmlFor="benutzername" className="input-label">Benutzername *</label>
            <input
              type="text"
              id="benutzername"
              name="benutzername"
              value={memberData.benutzername}
              onChange={handleChange}
              className="input-field"
              placeholder="Wählen Sie einen eindeutigen Benutzernamen"
              autoComplete="username"
            />
            <div className="nma-hint-xs">
              Mindestens 4 Zeichen, nur Buchstaben, Zahlen, Unterstrich und Bindestrich
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="passwort" className="input-label">Passwort *</label>
            <input
              type="password"
              id="passwort"
              name="passwort"
              value={memberData.passwort}
              onChange={handleChange}
              className="input-field"
              placeholder="Mindestens 8 Zeichen"
              autoComplete="new-password"
            />
            <div className="nma-hint-xs">
              Mindestens 8 Zeichen mit Buchstaben und Zahlen
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="passwort_wiederholen" className="input-label">Passwort wiederholen *</label>
            <input
              type="password"
              id="passwort_wiederholen"
              name="passwort_wiederholen"
              value={memberData.passwort_wiederholen}
              onChange={handleChange}
              className="input-field"
              placeholder="Passwort erneut eingeben"
              autoComplete="new-password"
            />
          </div>
        </div>

        {memberData.passwort && memberData.passwort_wiederholen && memberData.passwort !== memberData.passwort_wiederholen && (
          <div className="nma-warning-red">
            ⚠️ Die Passwörter stimmen nicht überein
          </div>
        )}

        {memberData.passwort && memberData.passwort.length > 0 && memberData.passwort.length < 8 && (
          <div className="nma-warning-amber">
            ⚠️ Das Passwort muss mindestens 8 Zeichen lang sein
          </div>
        )}
      </div>
    </div>
  );

  const renderCurrentStep = () => {
    // Für öffentliche Registrierung: 8 Schritte mit Familie
    if (isRegistrationFlow) {
      switch (currentStep) {
        case 1: return renderStep1();      // Grunddaten
        case 2: return renderStep2();      // Kontakt
        case 3: return renderFamilyStep(); // Familie (NEU)
        case 4: return renderStep6();      // Vertrag
        case 5: return renderStep5();      // Bank
        case 6: return renderStep4();      // Medizinisch
        case 7: return renderStep7();      // Widerruf
        case 8: return renderStep8();      // Account
        default: return renderStep1();
      }
    } else {
      // Für Admin-Bereich: 7 Schritte mit Familie
      switch (currentStep) {
        case 1: return renderStep1();      // Grunddaten
        case 2: return renderStep2();      // Kontakt
        case 3: return renderFamilyStep(); // Familie
        case 4: return renderStep6();      // Vertrag
        case 5: return renderStep5();      // Bank
        case 6: return renderStep4();      // Medizinisch
        case 7: return renderStep7();      // Widerruf
        default: return renderStep1();
      }
    }
  };

  // Super-Admin: Dojo-Auswahl als erster Schritt im selben Modal
  if (isSuperAdminMode && !superAdminDojoConfirmed) {
    return createPortal(
      <div className="modal-overlay nma-modal-overlay">
        <div className="modal-content step-modal neues-mitglied-modal-v2" style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <h2 className="modal-title">Neues Mitglied anlegen</h2>
          </div>
          <div style={{ padding: '2rem 1.5rem' }}>
            <div style={{
              background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)',
              borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem',
              display: 'flex', gap: '0.75rem', alignItems: 'flex-start'
            }}>
              <span style={{ fontSize: '1.3rem' }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 700, color: '#f59e0b', marginBottom: '0.3rem' }}>Super-Admin-Modus aktiv</div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
                  Du bist in der „Alle Dojos"-Ansicht. Bitte wähle zuerst das Ziel-Dojo für das neue Mitglied.
                </div>
              </div>
            </div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', color: 'rgba(255,255,255,0.6)' }}>
              Mitglied anlegen in:
            </label>
            <select
              value={superAdminSelectedDojo}
              onChange={e => setSuperAdminSelectedDojo(e.target.value)}
              style={{
                width: '100%', padding: '0.7rem 1rem', borderRadius: 9, marginBottom: '1.5rem',
                border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)',
                color: '#fff', fontSize: '1rem', cursor: 'pointer', boxSizing: 'border-box'
              }}
            >
              <option value="">— Dojo auswählen —</option>
              {(dojos || []).filter(d => d.id).map(d => (
                <option key={d.id} value={d.id}>{d.dojoname}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{
                padding: '0.6rem 1.2rem', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit'
              }}>Abbrechen</button>
              <button
                disabled={!superAdminSelectedDojo}
                onClick={() => {
                  setMemberData(prev => ({ ...prev, dojo_id: parseInt(superAdminSelectedDojo) }));
                  setSuperAdminDojoConfirmed(true);
                }}
                style={{
                  padding: '0.6rem 1.4rem', borderRadius: 9, border: 'none', fontWeight: 700,
                  background: superAdminSelectedDojo ? '#2563eb' : 'rgba(255,255,255,0.1)',
                  color: superAdminSelectedDojo ? '#fff' : 'rgba(255,255,255,0.3)',
                  cursor: superAdminSelectedDojo ? 'pointer' : 'not-allowed', fontFamily: 'inherit'
                }}
              >Weiter →</button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  // PORTAL MODAL TO BODY - BREAK ALL CONTAINERS
  const modalElement = (
    <div className="modal-overlay nma-modal-overlay">
      <div className="modal-content step-modal neues-mitglied-modal-v2">
        <div className="modal-header">
        <h2 className="modal-title">Neues Mitglied anlegen</h2>
          <div className="step-indicator">
            Schritt {getDisplayStep(currentStep)} von {getDisplayStepCount()}
          </div>
        </div>

        <div className="progress-bar nma-progress-bar">
          {Array.from({ length: getDisplayStepCount() }, (_, i) => i + 1).map((displayStep) => {
            const actualStep = getActualStep(displayStep);
            const isActive = currentStep === actualStep;
            const isCompleted = currentStep >= actualStep;

            return (
            <div
              key={displayStep}
              className={`progress-step nma-progress-step ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
            >
              <div className={`step-number nma-progress-step-number${isActive ? ' nma-progress-step-number--active' : (!isActive && isCompleted ? ' nma-progress-step-number--completed' : '')}`}>{displayStep}</div>
              <div className={`step-label nma-step-label${isActive ? ' nma-step-label--active' : (isCompleted ? ' nma-step-label--completed' : ' nma-step-label--pending')}`}>
                {/* Labels für öffentliche Registrierung (8 Schritte) */}
                {isRegistrationFlow && (
                  <>
                    {actualStep === 1 && 'Grunddaten'}
                    {actualStep === 2 && 'Kontakt'}
                    {actualStep === 3 && 'Familie'}
                    {actualStep === 4 && 'Vertrag'}
                    {actualStep === 5 && 'Bank'}
                    {actualStep === 6 && 'Medizinisch'}
                    {actualStep === 7 && 'Widerruf'}
                    {actualStep === 8 && 'Account'}
                  </>
                )}
                {/* Labels für Admin-Bereich (7 Schritte mit Familie) */}
                {!isRegistrationFlow && (
                  <>
                    {actualStep === 1 && 'Grunddaten'}
                    {actualStep === 2 && 'Kontakt'}
                    {actualStep === 3 && 'Familie'}
                    {actualStep === 4 && 'Vertrag'}
                    {actualStep === 5 && 'Bank'}
                    {actualStep === 6 && 'Medizinisch'}
                    {actualStep === 7 && 'Widerruf'}
                  </>
                )}
              </div>
            </div>
            );
          })}
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        {renderCurrentStep()}
        
        <div className="modal-buttons">
          {currentStep > 1 && (
            <button 
              className="secondary-button" 
              type="button" 
              onClick={handlePrevious}
              disabled={loading}
            >
              Zurück
            </button>
          )}
          
          {currentStep < getTotalSteps() ? (
            <button
              className="primary-button"
              type="button"
              onClick={handleNext}
              disabled={loading}
            >
              Weiter
            </button>
          ) : (
            <button
              className="submit-button"
              type="button"
              onClick={handleSubmit}
              disabled={
                loading ||
                (!existingMemberMode && (!memberData.vertrag_agb_akzeptiert ||
                  !memberData.vertrag_datenschutz_akzeptiert ||
                  !memberData.vertrag_dojo_regeln_akzeptiert ||
                  !memberData.vertrag_hausordnung_akzeptiert ||
                  !memberData.vertrag_tarif_id)) ||
                !memberData.vertragsbeginn_option ||
                (memberData.vertragsbeginn_option === 'sofort' && (!memberData.vertrag_sofortbeginn_zustimmung || !memberData.vertrag_widerrufsrecht_kenntnisnahme)) ||
                (isRegistrationFlow && (!memberData.benutzername || memberData.benutzername.length < 4 || !memberData.passwort || memberData.passwort.length < 8 || memberData.passwort !== memberData.passwort_wiederholen))
              }
            >
              {loading ? "Speichere..." : "Mitglied erstellen"}
            </button>
          )}
          
          <button
            className="close-button"
            type="button"
            onClick={onClose}
            disabled={loading}
          >
            Abbrechen
          </button>
        </div>

        {/* Warnung bei Vertrag-Schritt (Schritt 4 für Registration UND Admin) */}
        {currentStep === 4 && !existingMemberMode &&
         (!memberData.vertrag_agb_akzeptiert || !memberData.vertrag_datenschutz_akzeptiert || !memberData.vertrag_dojo_regeln_akzeptiert || !memberData.vertrag_hausordnung_akzeptiert || !memberData.vertrag_tarif_id) && (
          <div className="nma-warning-amber">
            ⚠️ Bitte füllen Sie alle Pflichtfelder im Vertrag aus (AGB, Datenschutz, Dojo-Regeln, Hausordnung, Tarif).
          </div>
        )}

        {/* Warnung bei Widerruf-Schritt (Schritt 7 in beiden Flows) */}
        {currentStep === 7 && !memberData.vertragsbeginn_option && (
          <div className="nma-warning-amber">
            Bitte wählen Sie eine Option für den Vertragsbeginn aus.
          </div>
        )}

        {currentStep === 7 && memberData.vertragsbeginn_option === 'sofort' && (!memberData.vertrag_sofortbeginn_zustimmung || !memberData.vertrag_widerrufsrecht_kenntnisnahme) && (
          <div className="nma-warning-amber">
            Für den Sofortbeginn müssen Sie beide Bestätigungen akzeptieren.
          </div>
        )}

        {/* Warnung bei Schritt 8 (Account) */}
        {currentStep === 8 && isRegistrationFlow && (
          <>
            {(!memberData.benutzername || memberData.benutzername.length < 4) && (
              <div className="nma-warning-amber">
                Bitte geben Sie einen Benutzernamen mit mindestens 4 Zeichen ein.
              </div>
            )}
            {(!memberData.passwort || memberData.passwort.length < 8) && (
              <div className="nma-warning-amber">
                Das Passwort muss mindestens 8 Zeichen lang sein.
              </div>
            )}
            {memberData.passwort && memberData.passwort_wiederholen && memberData.passwort !== memberData.passwort_wiederholen && (
              <div className="nma-warning-amber">
                Die Passwörter stimmen nicht überein.
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Duplikat-Dialog */}
      {showDuplicateDialog && (
        <div className="modal-overlay">
          <div className="modal-content duplicate-dialog">
            <h3>Duplikat gefunden</h3>
            <p>Es wurde bereits ein Mitglied mit folgenden Daten gefunden:</p>
            <div className="duplicate-info">
              <p><strong>Name:</strong> {duplicateCheck.matches[0].vorname} {duplicateCheck.matches[0].nachname}</p>
              <p><strong>Geburtsdatum:</strong> {new Date(duplicateCheck.matches[0].geburtsdatum).toLocaleDateString('de-DE')}</p>
              <p><strong>Status:</strong> {duplicateCheck.matches[0].aktiv ? 'Aktiv' : 'Inaktiv'}</p>
            </div>
            <p>Möchten Sie trotzdem fortfahren oder das bestehende Mitglied bearbeiten?</p>
            
            <div className="modal-buttons">
              <button 
                className="secondary-button" 
                onClick={handleDuplicateEdit}
              >
                Mitglied bearbeiten
              </button>
              <button 
                className="primary-button" 
                onClick={handleDuplicateContinue}
              >
                Trotzdem fortfahren
              </button>
              <button 
                className="close-button" 
                onClick={() => setShowDuplicateDialog(false)}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
        )}
    </div>
  );

  // ── Rückwirkende Abrechnung Modal ─────────────────────────────────────────
  const handleRueckwirkendAbrechnen = async () => {
    if (!rueckwirkendModal) return;
    setRueckwirkendLoading(true);
    try {
      const body = {
        mitglied_id: rueckwirkendModal.mitglied_id,
        vertrag_id: rueckwirkendModal.vertrag_id,
        modus: rueckwirkendModus,
      };
      if (rueckwirkendModus === 'raten') {
        body.monatlicher_aufschlag = parseFloat(rueckwirkendAufschlag);
      }
      await axios.post('/rechnungen/rueckwirkend', body);
      alert(
        rueckwirkendModus === 'einmal'
          ? `Eine Sammelrechnung für ${rueckwirkendModal.monate} Monat(e) wurde erstellt.`
          : rueckwirkendModus === 'teilzahlung'
          ? `${rueckwirkendModal.monate} Einzelrechnungen wurden erstellt.`
          : `Ratenplan mit ${rueckwirkendAufschlag} €/Monat Aufschlag wurde eingerichtet.`
      );
    } catch (err) {
      alert('Fehler bei rückwirkender Abrechnung: ' + (err.response?.data?.message || err.message));
    } finally {
      setRueckwirkendLoading(false);
      setRueckwirkendModal(null);
      onClose();
    }
  };

  const rueckwirkendDialogElement = rueckwirkendModal ? (
    <div className="modal-overlay nma-modal-overlay">
      <div className="modal-content step-modal neues-mitglied-modal-v2" style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Rückwirkende Beiträge abrechnen</h2>
        </div>
        <div className="modal-body" style={{ padding: '1.5rem' }}>
          <p style={{ marginTop: 0, color: 'rgba(255,255,255,0.8)' }}>
            Der Vertrag beginnt rückwirkend am <strong>{rueckwirkendModal.vertragsbeginn}</strong>.
            Es sind <strong>{rueckwirkendModal.monate} Monat(e)</strong> offen.
            Wie sollen die ausstehenden Beiträge abgerechnet werden?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
            {[
              { value: 'einmal', label: 'Gesamtrechnung', desc: 'Eine Rechnung über alle offenen Monate' },
              { value: 'teilzahlung', label: 'Einzelne Monatsrechnungen', desc: 'Separate Rechnung pro Monat' },
              { value: 'raten', label: 'Ratenplan (monatl. Aufschlag)', desc: 'Aufschlag zum laufenden Beitrag, keine sofortige Rechnung' },
            ].map(opt => (
              <label key={opt.value} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                padding: '0.85rem 1rem', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${rueckwirkendModus === opt.value ? '#4f8ef7' : 'rgba(255,255,255,0.12)'}`,
                background: rueckwirkendModus === opt.value ? 'rgba(79,142,247,0.12)' : 'rgba(255,255,255,0.04)',
              }}>
                <input
                  type="radio"
                  name="rueckwirkendModus"
                  value={opt.value}
                  checked={rueckwirkendModus === opt.value}
                  onChange={() => setRueckwirkendModus(opt.value)}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontWeight: 600, color: '#fff' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.55)' }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>

          {rueckwirkendModus === 'raten' && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
                Monatlicher Aufschlag (€)
              </label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={rueckwirkendAufschlag}
                onChange={e => setRueckwirkendAufschlag(e.target.value)}
                placeholder="z. B. 20.00"
                style={{
                  width: '100%', padding: '0.6rem 0.8rem', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)',
                  color: '#fff', fontSize: '1rem', boxSizing: 'border-box'
                }}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button
              onClick={() => { setRueckwirkendModal(null); onClose(); }}
              style={{
                padding: '0.6rem 1.2rem', borderRadius: 9, border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit'
              }}
              disabled={rueckwirkendLoading}
            >
              Überspringen
            </button>
            <button
              onClick={handleRueckwirkendAbrechnen}
              disabled={rueckwirkendLoading || (rueckwirkendModus === 'raten' && !rueckwirkendAufschlag)}
              style={{
                padding: '0.6rem 1.4rem', borderRadius: 9, border: 'none',
                background: '#4f8ef7', color: '#fff', cursor: 'pointer',
                fontWeight: 600, fontFamily: 'inherit', opacity:
                  (rueckwirkendLoading || (rueckwirkendModus === 'raten' && !rueckwirkendAufschlag)) ? 0.5 : 1
              }}
            >
              {rueckwirkendLoading ? 'Wird erstellt…' : 'Abrechnen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  // RENDER MODAL DIRECTLY TO BODY - BYPASS ALL CONTAINERS
  if (rueckwirkendModal) return createPortal(rueckwirkendDialogElement, document.body);
  return createPortal(modalElement, document.body);
};

export default NeuesMitgliedAnlegen;
