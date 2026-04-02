import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle, Palette } from 'lucide-react';
import FinanzamtSelector from './FinanzamtSelector';
import BankTabs from './BankTabs';
import AdminVerwaltung from './AdminVerwaltung';
import MessengerKonfiguration from './MessengerKonfiguration';
import DojoLogos from './DojoLogos';
import RaumVerwaltung from './RaumVerwaltung';
import { useDojoContext } from '../context/DojoContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import config from '../config/config.js';
import '../styles/MitgliedDetail.css';
import '../styles/DojoEdit.css';
import { fetchWithAuth } from '../utils/fetchWithAuth';

const SECTIONS = [
  { key: 'info', label: 'Dojo-Info', icon: '🏯', sub: [
    { key: 'fs-grunddaten',  label: 'Grunddaten' },
    { key: 'fs-kontakt',     label: 'Kontaktdaten' },
    { key: 'fs-rechtliches', label: 'Rechtliches' },
    { key: 'fs-sport',       label: 'Sport & Verband' },
    { key: 'fs-social',      label: 'Social Media' },
    { key: 'fs-betrieb',     label: 'Betrieb' },
  ]},
  { key: 'raeume',    label: 'Räume & Kurse',      icon: '🏋️' },
  { key: 'steuern',   label: 'Steuern & Finanzen', icon: '🧾', sub: [
    { key: 'fs-steuer',        label: 'Steuereinstellungen' },
    { key: 'fs-versicherungen', label: 'Versicherungen' },
  ]},
  { key: 'bank',      label: 'Bankverbindung',      icon: '🏦' },
  { key: 'vertraege', label: 'Verträge',             icon: '📄' },
  { key: 'digital',   label: 'Digital & Komm.',      icon: '💻', sub: [
    { key: 'fs-email',        label: 'E-Mail' },
    { key: 'fs-probetraining', label: 'Probetraining' },
    { key: 'fs-messenger',    label: 'Messenger' },
    { key: 'fs-logos',        label: 'Logos & Design' },
  ]},
  { key: 'dokumente', label: 'Dokumente',            icon: '📎' },
  { key: 'system',    label: 'System & Benutzer',   icon: '⚙️', sub: [
    { key: 'fs-system-settings', label: 'System' },
    { key: 'fs-benutzer',        label: 'Benutzer' },
    { key: 'fs-api',             label: 'API-Token' },
  ]},
];

const DojoEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateDojo } = useDojoContext();
  const { isAdmin } = useAuth();
  const { theme, setTheme, currentTheme, themes: contextThemes, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [openSection, setOpenSection] = useState('info');
  const [openSub, setOpenSub] = useState('fs-grunddaten');
  const [apiToken, setApiToken] = useState(null);
  const [apiTokenCreatedAt, setApiTokenCreatedAt] = useState(null);
  const [apiTokenLastUsed, setApiTokenLastUsed] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [agbSaveLoading, setAgbSaveLoading] = useState(false);
  const [agbSendNotification, setAgbSendNotification] = useState(false);
  const [agbMessage, setAgbMessage] = useState('');
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [tabStyle, setTabStyle] = useState(localStorage.getItem('dojo-tab-style') || 'glass');
  const [tabAccent, setTabAccent] = useState(localStorage.getItem('dojo-tab-accent') || '#ffd700');
  const [tabStyleSaved, setTabStyleSaved] = useState(false);
  const [probetrainingCopied, setProbetrainingCopied] = useState(false);

  const [emailSettings, setEmailSettings] = useState({
    email_mode: 'zentral',
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: true,
    smtp_user: '',
    smtp_password: '',
    tda_email: '',
    tda_email_password: ''
  });
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [testEmail, setTestEmail] = useState('');

  const isNewDojo = id === 'new';
  const themes = Object.values(contextThemes);

  const showSection = (key) => {
    setOpenSection(key);
    const sec = SECTIONS.find(s => s.key === key);
    setOpenSub(sec?.sub?.[0]?.key ?? null);
  };

  const showSub = (subKey) => setOpenSub(subKey);

  // Hilfsfunktion: Soll ein form-section mit dieser ID angezeigt werden?
  const subVisible = (id) => !openSub || openSub === id;

  const [formData, setFormData] = useState({
    dojoname: '',
    inhaber: '',
    untertitel: '',
    vertreter: '',
    gruendungsjahr: '',
    rechtsform: 'Verein',
    strasse: '',
    hausnummer: '',
    plz: '',
    ort: '',
    land: 'Deutschland',
    telefon: '',
    mobil: '',
    fax: '',
    email: '',
    email_info: '',
    email_anmeldung: '',
    internet: '',
    whatsapp_nummer: '',
    steuer_status: 'kleinunternehmer',
    ust_satz: 0,
    kleinunternehmer_grenze: 22000,
    steuernummer: '',
    ust_id: '',
    umsatzsteuer_id: '',
    finanzamt_name: '',
    finanzamt: null,
    steuerberater: '',
    steuerberater_telefon: '',
    umsatzsteuerpflichtig: false,
    kleinunternehmer: false,
    gemeinnuetzig: false,
    freistellungsbescheid_datum: '',
    vereinsregister_nr: '',
    amtsgericht: '',
    handelsregister_nr: '',
    geschaeftsfuehrer: '',
    vorstand_1_vorsitzender: '',
    vorstand_2_vorsitzender: '',
    vorstand_kassenwart: '',
    vorstand_schriftfuehrer: '',
    sepa_glaeubiger_id: '',
    iban: '',
    bic: '',
    bank: '',
    bank_inhaber: '',
    bank_verwendungszweck: '',
    paypal_email: '',
    lastschrift_aktiv: false,
    haftpflicht_versicherung: '',
    haftpflicht_police_nr: '',
    haftpflicht_ablauf: '',
    unfallversicherung: '',
    unfallversicherung_police_nr: '',
    gebaeudeversicherung: '',
    kuendigungsfrist_monate: 3,
    mindestlaufzeit_monate: 12,
    probezeit_tage: 14,
    kuendigung_nur_monatsende: true,
    kuendigung_schriftlich: true,
    automatische_verlaengerung: true,
    verlaengerung_monate: 12,
    kuendigung_erstlaufzeit_monate: 3,
    kuendigung_verlaengerung_monate: 1,
    vertragsmodell: 'gesetzlich',
    beitragsgarantie_bei_nichtverlaengerung: 'aktueller_tarif',
    verlaengerung_erinnerung_tage: 60,
    verlaengerung_erinnerung2_tage: 30,
    verlaengerung_erinnerung3_tage: 14,
    verlaengerung_email_text: '',
    vertrag_3_monate_preis: '',
    vertrag_6_monate_preis: '',
    vertrag_12_monate_preis: '',
    vertrag_3_monate_aktiv: true,
    vertrag_6_monate_aktiv: true,
    vertrag_12_monate_aktiv: true,
    jahresbeitrag: '',
    familienrabatt_prozent: '',
    schuelerrabatt_prozent: '',
    vereinsmitglied_rabatt_prozent: '',
    mehrfachtraining_rabatt_prozent: '',
    beitrag_erwachsene: '',
    beitrag_kinder: '',
    beitrag_familien: '',
    aufnahmegebuehr: '',
    mahnung_gebuehr: 5.00,
    kampfkunst_stil: '',
    verband: '',
    verband_mitgliedsnummer: '',
    lizenz_trainer_a: 0,
    lizenz_trainer_b: 0,
    lizenz_trainer_c: 0,
    notfallkontakt_name: '',
    notfallkontakt_telefon: '',
    hausmeister_kontakt: '',
    feiertage_geschlossen: true,
    ferien_geschlossen: false,
    facebook_url: '',
    instagram_url: '',
    youtube_url: '',
    twitter_url: '',
    google_maps_url: '',
    newsletter_aktiv: false,
    agb_text: '',
    agb_version: '1.0',
    agb_letzte_aenderung: null,
    dsgvo_text: '',
    dsgvo_version: '1.0',
    dsgvo_letzte_aenderung: null,
    dojo_regeln_text: '',
    hausordnung_text: '',
    haftungsausschluss_text: '',
    widerrufsbelehrung_text: '',
    impressum_text: '',
    vertragsbedingungen_text: '',
    farbe: '#FFD700',
    logo_url: '',
    theme_scheme: 'default',
    sprache: 'de',
    zeitzone: 'Europe/Berlin',
    waehrung: 'EUR',
    dsgvo_beauftragte: '',
    max_mitglieder: 500
  });

  useEffect(() => {
    if (!isNewDojo) {
      loadDojo();
    }
  }, [id, isNewDojo]);

  useEffect(() => {
    if (!isNewDojo) {
      loadApiToken();
      loadEmailSettings();
    }
  }, [id, isNewDojo]);

  const loadDojo = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/dojos/${id}`);
      if (!response.ok) throw new Error('Fehler beim Laden des Dojos');
      const dojo = await response.json();

      setSubdomain(dojo.subdomain || '');

      setFormData({
        dojoname: dojo.dojoname || '',
        inhaber: dojo.inhaber || '',
        untertitel: dojo.untertitel || '',
        vertreter: dojo.vertreter || '',
        gruendungsjahr: dojo.gruendungsjahr || '',
        rechtsform: dojo.rechtsform || 'Verein',
        strasse: dojo.strasse || '',
        hausnummer: dojo.hausnummer || '',
        plz: dojo.plz || '',
        ort: dojo.ort || '',
        land: dojo.land || 'Deutschland',
        telefon: dojo.telefon || '',
        mobil: dojo.mobil || '',
        fax: dojo.fax || '',
        email: dojo.email || '',
        email_info: dojo.email_info || '',
        email_anmeldung: dojo.email_anmeldung || '',
        internet: dojo.internet || '',
        whatsapp_nummer: dojo.whatsapp_nummer || '',
        steuer_status: dojo.steuer_status || 'kleinunternehmer',
        ust_satz: dojo.ust_satz || 0,
        kleinunternehmer_grenze: dojo.kleinunternehmer_grenze || 22000,
        steuernummer: dojo.steuernummer || '',
        ust_id: dojo.ust_id || '',
        finanzamt_name: dojo.finanzamt_name || '',
        finanzamt: (() => { const fa = dojo.finanzamt; if (!fa) return null; if (typeof fa === 'object') return fa; try { return JSON.parse(fa); } catch { return null; } })(),
        steuerberater: dojo.steuerberater || '',
        umsatzsteuerpflichtig: dojo.umsatzsteuerpflichtig || false,
        kleinunternehmer: dojo.kleinunternehmer || false,
        gemeinnuetzig: dojo.gemeinnuetzig || false,
        vereinsregister_nr: dojo.vereinsregister_nr || '',
        amtsgericht: dojo.amtsgericht || '',
        handelsregister_nr: dojo.handelsregister_nr || '',
        geschaeftsfuehrer: dojo.geschaeftsfuehrer || '',
        vorstand_1_vorsitzender: dojo.vorstand_1_vorsitzender || '',
        vorstand_2_vorsitzender: dojo.vorstand_2_vorsitzender || '',
        vorstand_kassenwart: dojo.vorstand_kassenwart || '',
        vorstand_schriftfuehrer: dojo.vorstand_schriftfuehrer || '',
        sepa_glaeubiger_id: dojo.sepa_glaeubiger_id || '',
        iban: dojo.iban || '',
        bic: dojo.bic || '',
        bank: dojo.bank || '',
        bank_inhaber: dojo.bank_inhaber || '',
        bank_verwendungszweck: dojo.bank_verwendungszweck || '',
        paypal_email: dojo.paypal_email || '',
        lastschrift_aktiv: dojo.lastschrift_aktiv ?? false,
        haftpflicht_versicherung: dojo.haftpflicht_versicherung || '',
        haftpflicht_police_nr: dojo.haftpflicht_police_nr || '',
        haftpflicht_ablauf: dojo.haftpflicht_ablauf || '',
        unfallversicherung: dojo.unfallversicherung || '',
        unfallversicherung_police_nr: dojo.unfallversicherung_police_nr || '',
        gebaeudeversicherung: dojo.gebaeudeversicherung || '',
        kuendigungsfrist_monate: dojo.kuendigungsfrist_monate || 3,
        mindestlaufzeit_monate: dojo.mindestlaufzeit_monate || 12,
        probezeit_tage: dojo.probezeit_tage || 14,
        kuendigung_nur_monatsende: dojo.kuendigung_nur_monatsende ?? true,
        kuendigung_schriftlich: dojo.kuendigung_schriftlich ?? true,
        automatische_verlaengerung: dojo.automatische_verlaengerung ?? true,
        verlaengerung_monate: dojo.verlaengerung_monate || 12,
        kuendigung_erstlaufzeit_monate: dojo.kuendigung_erstlaufzeit_monate || 3,
        kuendigung_verlaengerung_monate: dojo.kuendigung_verlaengerung_monate || 1,
        vertragsmodell: dojo.vertragsmodell || 'gesetzlich',
        beitragsgarantie_bei_nichtverlaengerung: dojo.beitragsgarantie_bei_nichtverlaengerung || 'aktueller_tarif',
        verlaengerung_erinnerung_tage: dojo.verlaengerung_erinnerung_tage || 60,
        verlaengerung_erinnerung2_tage: dojo.verlaengerung_erinnerung2_tage || 30,
        verlaengerung_erinnerung3_tage: dojo.verlaengerung_erinnerung3_tage || 14,
        verlaengerung_email_text: dojo.verlaengerung_email_text || '',
        vertrag_3_monate_preis: dojo.vertrag_3_monate_preis || '',
        vertrag_6_monate_preis: dojo.vertrag_6_monate_preis || '',
        vertrag_12_monate_preis: dojo.vertrag_12_monate_preis || '',
        vertrag_3_monate_aktiv: dojo.vertrag_3_monate_aktiv ?? true,
        vertrag_6_monate_aktiv: dojo.vertrag_6_monate_aktiv ?? true,
        vertrag_12_monate_aktiv: dojo.vertrag_12_monate_aktiv ?? true,
        jahresbeitrag: dojo.jahresbeitrag || '',
        familienrabatt_prozent: dojo.familienrabatt_prozent || '',
        schuelerrabatt_prozent: dojo.schuelerrabatt_prozent || '',
        vereinsmitglied_rabatt_prozent: dojo.vereinsmitglied_rabatt_prozent || '',
        mehrfachtraining_rabatt_prozent: dojo.mehrfachtraining_rabatt_prozent || '',
        beitrag_erwachsene: dojo.beitrag_erwachsene || '',
        beitrag_kinder: dojo.beitrag_kinder || '',
        beitrag_familien: dojo.beitrag_familien || '',
        aufnahmegebuehr: dojo.aufnahmegebuehr || '',
        mahnung_gebuehr: dojo.mahnung_gebuehr || 5.00,
        kampfkunst_stil: dojo.kampfkunst_stil || '',
        verband: dojo.verband || '',
        verband_mitgliedsnummer: dojo.verband_mitgliedsnummer || '',
        lizenz_trainer_a: dojo.lizenz_trainer_a || 0,
        lizenz_trainer_b: dojo.lizenz_trainer_b || 0,
        lizenz_trainer_c: dojo.lizenz_trainer_c || 0,
        notfallkontakt_name: dojo.notfallkontakt_name || '',
        notfallkontakt_telefon: dojo.notfallkontakt_telefon || '',
        hausmeister_kontakt: dojo.hausmeister_kontakt || '',
        feiertage_geschlossen: dojo.feiertage_geschlossen ?? true,
        ferien_geschlossen: dojo.ferien_geschlossen ?? false,
        facebook_url: dojo.facebook_url || '',
        instagram_url: dojo.instagram_url || '',
        youtube_url: dojo.youtube_url || '',
        twitter_url: dojo.twitter_url || '',
        google_maps_url: dojo.google_maps_url || '',
        newsletter_aktiv: dojo.newsletter_aktiv ?? false,
        agb_text: dojo.agb_text || '',
        agb_version: dojo.agb_version || '1.0',
        agb_letzte_aenderung: dojo.agb_letzte_aenderung || null,
        dsgvo_text: dojo.dsgvo_text || '',
        dsgvo_version: dojo.dsgvo_version || '1.0',
        dsgvo_letzte_aenderung: dojo.dsgvo_letzte_aenderung || null,
        dojo_regeln_text: dojo.dojo_regeln_text || '',
        hausordnung_text: dojo.hausordnung_text || '',
        haftungsausschluss_text: dojo.haftungsausschluss_text || '',
        widerrufsbelehrung_text: dojo.widerrufsbelehrung_text || '',
        impressum_text: dojo.impressum_text || '',
        vertragsbedingungen_text: dojo.vertragsbedingungen_text || '',
        farbe: dojo.farbe || '#FFD700',
        logo_url: dojo.logo_url || '',
        theme_scheme: dojo.theme_scheme || 'default',
        sprache: dojo.sprache || 'de',
        zeitzone: dojo.zeitzone || 'Europe/Berlin',
        waehrung: dojo.waehrung || 'EUR',
        dsgvo_beauftragte: dojo.dsgvo_beauftragte || '',
        max_mitglieder: dojo.max_mitglieder || 500
      });
    } catch (error) {
      setMessage('Fehler beim Laden des Dojos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadApiToken = async () => {
    if (isNewDojo) return;
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/dojos/${id}/api-token`);
      const data = await response.json();
      if (data.success && data.token) {
        setApiToken(data.token);
        setApiTokenCreatedAt(data.created_at);
        setApiTokenLastUsed(data.last_used);
      }
    } catch (error) {
      console.error('Error loading API token:', error);
    }
  };

  const generateApiToken = async () => {
    if (isNewDojo) {
      setMessage('Bitte speichern Sie das Dojo zuerst, bevor Sie einen API-Token generieren.');
      return;
    }
    const confirmMsg = apiToken
      ? 'WARNUNG: Dies wird Ihren bestehenden API-Token ungültig machen!\n\nAlle TDA-Turniere, die den alten Token verwenden, müssen aktualisiert werden.\n\nMöchten Sie wirklich einen neuen Token generieren?'
      : 'Möchten Sie einen neuen API-Token generieren?';
    if (!window.confirm(confirmMsg)) return;
    setTokenLoading(true);
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/dojos/${id}/generate-api-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        setApiToken(data.token);
        setApiTokenCreatedAt(data.created_at);
        setApiTokenLastUsed(null);
        setMessage('✅ API-Token erfolgreich generiert!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        throw new Error(data.error || 'Token-Generierung fehlgeschlagen');
      }
    } catch (error) {
      setMessage('Fehler beim Generieren des Tokens: ' + error.message);
    } finally {
      setTokenLoading(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setMessage(`✅ ${label} kopiert!`);
    setTimeout(() => setMessage(''), 2000);
  };

  const incrementVersion = (currentVersion) => {
    if (!currentVersion) return '1.1';
    const parts = currentVersion.split('.');
    const minor = parseInt(parts[1] || '0') + 1;
    return `${parts[0]}.${minor}`;
  };

  const saveAgbDsgvo = async (incrementVersions = false) => {
    if (isNewDojo) { setAgbMessage('Bitte speichern Sie das Dojo zuerst.'); return; }
    setAgbSaveLoading(true);
    setAgbMessage('');
    try {
      const newAgbVersion = incrementVersions ? incrementVersion(formData.agb_version) : formData.agb_version;
      const newDsgvoVersion = incrementVersions ? incrementVersion(formData.dsgvo_version) : formData.dsgvo_version;
      const response = await fetchWithAuth(`${config.apiBaseUrl}/agb/${id}/update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agb_text: formData.agb_text,
          agb_version: newAgbVersion,
          dsgvo_text: formData.dsgvo_text,
          dsgvo_version: newDsgvoVersion,
          sendNotification: agbSendNotification
        })
      });
      const data = await response.json();
      if (data.success) {
        setFormData(prev => ({
          ...prev,
          agb_version: newAgbVersion,
          dsgvo_version: newDsgvoVersion,
          agb_letzte_aenderung: new Date().toISOString(),
          dsgvo_letzte_aenderung: new Date().toISOString()
        }));
        let successMsg = 'AGB & Datenschutz erfolgreich gespeichert!';
        if (data.notifications) successMsg += ` (${data.notifications.sent}/${data.notifications.total} E-Mails gesendet)`;
        setAgbMessage(successMsg);
        setAgbSendNotification(false);
        setTimeout(() => setAgbMessage(''), 5000);
      } else {
        throw new Error(data.error || 'Speichern fehlgeschlagen');
      }
    } catch (error) {
      setAgbMessage('Fehler: ' + error.message);
    } finally {
      setAgbSaveLoading(false);
    }
  };

  const handleThemeChange = (themeId) => {
    setTheme(themeId);
    setShowThemeSelector(false);
    const themeName = contextThemes[themeId]?.name || themeId;
    setMessage(`✅ Theme zu "${themeName}" geändert!`);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleTabStyleSelect = (styleId) => {
    setTabStyle(styleId);
    if (styleId === 'glass') delete document.documentElement.dataset.tabStyle;
    else document.documentElement.dataset.tabStyle = styleId;
  };
  const handleTabAccentChange = (e) => {
    setTabAccent(e.target.value);
    document.documentElement.style.setProperty('--tab-accent', e.target.value);
  };
  const handleTabStyleSave = () => {
    if (tabStyle === 'glass') localStorage.removeItem('dojo-tab-style');
    else localStorage.setItem('dojo-tab-style', tabStyle);
    localStorage.setItem('dojo-tab-accent', tabAccent);
    setTabStyleSaved(true);
    setTimeout(() => setTabStyleSaved(false), 2500);
  };

  const loadEmailSettings = async () => {
    try {
      setEmailLoading(true);
      const response = await fetchWithAuth(`${config.apiBaseUrl}/email-settings/dojo/${id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setEmailSettings({
            email_mode: data.data.email_mode || 'zentral',
            smtp_host: data.data.smtp_host || '',
            smtp_port: data.data.smtp_port || 587,
            smtp_secure: data.data.smtp_secure ?? true,
            smtp_user: data.data.smtp_user || '',
            smtp_password: '',
            tda_email: data.data.tda_email || '',
            tda_email_password: '',
            has_smtp_password: data.data.has_smtp_password,
            has_tda_password: data.data.has_tda_password
          });
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der E-Mail-Einstellungen:', error);
    } finally {
      setEmailLoading(false);
    }
  };

  const saveEmailSettings = async () => {
    try {
      setEmailLoading(true);
      setEmailMessage('');
      const response = await fetchWithAuth(`${config.apiBaseUrl}/email-settings/dojo/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_mode: emailSettings.email_mode,
          smtp_host: emailSettings.smtp_host,
          smtp_port: emailSettings.smtp_port,
          smtp_secure: emailSettings.smtp_secure,
          smtp_user: emailSettings.smtp_user,
          smtp_password: emailSettings.smtp_password || (emailSettings.has_smtp_password ? '********' : ''),
          tda_email: emailSettings.tda_email,
          tda_email_password: emailSettings.tda_email_password || (emailSettings.has_tda_password ? '********' : '')
        })
      });
      const data = await response.json();
      if (data.success) {
        setEmailMessage('✅ E-Mail-Einstellungen erfolgreich gespeichert');
        setTimeout(() => setEmailMessage(''), 5000);
      } else {
        throw new Error(data.error || 'Speichern fehlgeschlagen');
      }
    } catch (error) {
      setEmailMessage('❌ Fehler: ' + error.message);
    } finally {
      setEmailLoading(false);
    }
  };

  const sendTestEmailForDojo = async () => {
    if (!testEmail) { setEmailMessage('Bitte geben Sie eine Test-E-Mail-Adresse ein'); return; }
    try {
      setEmailLoading(true);
      setEmailMessage('');
      const response = await fetchWithAuth(`${config.apiBaseUrl}/email-settings/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test_email: testEmail, dojo_id: id, use_global: false })
      });
      const data = await response.json();
      if (data.success) {
        setEmailMessage(`✅ ${data.message}`);
      } else {
        throw new Error(data.error || 'Test fehlgeschlagen');
      }
    } catch (error) {
      setEmailMessage('❌ ' + error.message);
    } finally {
      setEmailLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    try {
      const url = isNewDojo ? `${config.apiBaseUrl}/dojos` : `${config.apiBaseUrl}/dojos/${id}`;
      const method = isNewDojo ? 'POST' : 'PUT';
      const dataToSend = {
        ...formData,
        ust_satz: formData.steuer_status === 'regelbesteuerung' ? 19 : 0,
        finanzamt: formData.finanzamt ? JSON.stringify(formData.finanzamt) : null
      };
      const response = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Speichern');
      }
      setMessage(`Dojo erfolgreich ${isNewDojo ? 'erstellt' : 'gespeichert'}!`);
      if (isNewDojo) {
        const result = await response.json();
        if (result.id) setTimeout(() => navigate(`/dashboard/dojos/edit/${result.id}`), 1000);
      } else {
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage(`Fehler: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dojo-edit-page de-settings-page">

      {/* ── Sticky Header ── */}
      <div className="de-settings-header">
        <button className="de-back-btn" type="button" onClick={() => navigate('/dashboard/dojos')}>
          <ArrowLeft size={18} />
          <span>Zurück</span>
        </button>
        <div className="de-header-title">
          <span className="de-header-label">{isNewDojo ? 'Neues Dojo' : 'Dojo-Einstellungen'}</span>
          {formData.dojoname && <span className="de-header-name">{formData.dojoname}</span>}
        </div>
        <div className="de-header-right">
          {message && (
            <span className={`de-header-msg ${message.includes('Fehler') ? 'de-header-msg--error' : 'de-header-msg--success'}`}>
              {message}
            </span>
          )}
          <button
            form="dojo-settings-form"
            type="submit"
            className="de-save-btn"
            disabled={loading}
          >
            <Save size={15} />
            {loading ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>

      {/* ── Split Layout: Nav links + Content rechts ── */}
      <div className="de-split">

        <nav className="de-split-nav">
          {SECTIONS.map(s => (
            <div key={s.key} className="de-split-nav-group">
              <button
                type="button"
                className={`de-split-nav-item${openSection === s.key ? ' active' : ''}`}
                onClick={() => showSection(s.key)}
              >
                <span className="de-split-nav-icon">{s.icon}</span>
                <span>{s.label}</span>
              </button>
              {openSection === s.key && s.sub && (
                <div className="de-split-nav-sub-list">
                  {s.sub.map(sub => (
                    <button
                      key={sub.key}
                      type="button"
                      className={`de-split-nav-sub${openSub === sub.key ? ' active' : ''}`}
                      onClick={() => showSub(sub.key)}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="de-split-content">
          <form id="dojo-settings-form" onSubmit={handleSubmit} className="dojo-form">

          {/* ══════════════════════════════════════════
              SECTION 1: DOJO-INFO
          ══════════════════════════════════════════ */}
          <div style={{display: openSection === 'info' ? 'block' : 'none'}}>

              {/* Grunddaten */}
              <div className="form-section" id="fs-grunddaten" style={{display: subVisible('fs-grunddaten') ? 'block' : 'none'}}>
                <h3>Grunddaten</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Dojo-Name *</label>
                    <input type="text" value={formData.dojoname} onChange={(e) => setFormData({ ...formData, dojoname: e.target.value })} required placeholder="z.B. Tiger & Dragon Dojo" />
                  </div>
                  <div className="form-group">
                    <label>Untertitel</label>
                    <input type="text" value={formData.untertitel} onChange={(e) => setFormData({ ...formData, untertitel: e.target.value })} placeholder="z.B. Traditionelles Karate seit 1985" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Inhaber/Dojo-Leiter *</label>
                    <input type="text" value={formData.inhaber} onChange={(e) => setFormData({ ...formData, inhaber: e.target.value })} required placeholder="Vor- und Nachname" />
                  </div>
                  <div className="form-group">
                    <label>Stellvertreter</label>
                    <input type="text" value={formData.vertreter} onChange={(e) => setFormData({ ...formData, vertreter: e.target.value })} placeholder="2. Vorsitzender/Stellvertreter" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Gründungsjahr</label>
                    <input type="number" value={formData.gruendungsjahr} onChange={(e) => setFormData({ ...formData, gruendungsjahr: e.target.value })} placeholder="z.B. 1985" min="1900" max="2030" />
                  </div>
                  <div className="form-group">
                    <label>Rechtsform</label>
                    <select value={formData.rechtsform} onChange={(e) => setFormData({ ...formData, rechtsform: e.target.value })}>
                      <option value="Verein">Eingetragener Verein (e.V.)</option>
                      <option value="GmbH">GmbH</option>
                      <option value="Einzelunternehmen">Einzelunternehmen</option>
                      <option value="GbR">GbR</option>
                      <option value="UG">UG (haftungsbeschränkt)</option>
                      <option value="AG">AG</option>
                    </select>
                  </div>
                </div>

                <h4 className="de-section-heading">Adresse</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Straße</label>
                    <input type="text" value={formData.strasse} onChange={(e) => setFormData({ ...formData, strasse: e.target.value })} placeholder="Straßenname" />
                  </div>
                  <div className="form-group de-form-group-120">
                    <label>Hausnummer</label>
                    <input type="text" value={formData.hausnummer} onChange={(e) => setFormData({ ...formData, hausnummer: e.target.value })} placeholder="123a" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group de-form-group-150">
                    <label>PLZ</label>
                    <input type="text" value={formData.plz} onChange={(e) => setFormData({ ...formData, plz: e.target.value })} placeholder="12345" />
                  </div>
                  <div className="form-group">
                    <label>Ort</label>
                    <input type="text" value={formData.ort} onChange={(e) => setFormData({ ...formData, ort: e.target.value })} placeholder="Musterstadt" />
                  </div>
                  <div className="form-group">
                    <label>Land</label>
                    <input type="text" value={formData.land} onChange={(e) => setFormData({ ...formData, land: e.target.value })} placeholder="Deutschland" />
                  </div>
                </div>
              </div>

              {/* Kontaktdaten */}
              <div className="form-section" id="fs-kontakt" style={{display: subVisible('fs-kontakt') ? 'block' : 'none'}}>
                <h3>Kontaktdaten</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Telefon (Festnetz)</label>
                    <input type="tel" value={formData.telefon} onChange={(e) => setFormData({ ...formData, telefon: e.target.value })} placeholder="+49 123 456789" />
                  </div>
                  <div className="form-group">
                    <label>Mobil</label>
                    <input type="tel" value={formData.mobil} onChange={(e) => setFormData({ ...formData, mobil: e.target.value })} placeholder="+49 170 1234567" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Fax</label>
                    <input type="tel" value={formData.fax} onChange={(e) => setFormData({ ...formData, fax: e.target.value })} placeholder="+49 123 456788" />
                  </div>
                  <div className="form-group">
                    <label>WhatsApp Nummer</label>
                    <input type="tel" value={formData.whatsapp_nummer} onChange={(e) => setFormData({ ...formData, whatsapp_nummer: e.target.value })} placeholder="+49 170 1234567" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>E-Mail (Haupt)</label>
                    <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="kontakt@dojo.de" />
                  </div>
                  <div className="form-group">
                    <label>E-Mail (Info)</label>
                    <input type="email" value={formData.email_info} onChange={(e) => setFormData({ ...formData, email_info: e.target.value })} placeholder="info@dojo.de" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>E-Mail (Anmeldungen)</label>
                    <input type="email" value={formData.email_anmeldung} onChange={(e) => setFormData({ ...formData, email_anmeldung: e.target.value })} placeholder="anmeldung@dojo.de" />
                  </div>
                  <div className="form-group">
                    <label>Webseite</label>
                    <input type="url" value={formData.internet} onChange={(e) => setFormData({ ...formData, internet: e.target.value })} placeholder="https://www.dojo.de" />
                  </div>
                </div>
              </div>

              {/* Rechtliches */}
              <div className="form-section" id="fs-rechtliches" style={{display: subVisible('fs-rechtliches') ? 'block' : 'none'}}>
                <h3>Rechtliches</h3>
                <h4 className="de-section-heading">Register & Behörden</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Vereinsregister-Nr.</label>
                    <input type="text" value={formData.vereinsregister_nr} onChange={(e) => setFormData({ ...formData, vereinsregister_nr: e.target.value })} placeholder="VR 12345" />
                  </div>
                  <div className="form-group">
                    <label>Amtsgericht</label>
                    <input type="text" value={formData.amtsgericht} onChange={(e) => setFormData({ ...formData, amtsgericht: e.target.value })} placeholder="z.B. Amtsgericht München" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Handelsregister-Nr.</label>
                  <input type="text" value={formData.handelsregister_nr} onChange={(e) => setFormData({ ...formData, handelsregister_nr: e.target.value })} placeholder="HRB 12345" />
                </div>
                <h4 className="de-section-heading">Vorstand (für Vereine)</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>1. Vorsitzender</label>
                    <input type="text" value={formData.vorstand_1_vorsitzender} onChange={(e) => setFormData({ ...formData, vorstand_1_vorsitzender: e.target.value })} placeholder="Vor- und Nachname" />
                  </div>
                  <div className="form-group">
                    <label>2. Vorsitzender</label>
                    <input type="text" value={formData.vorstand_2_vorsitzender} onChange={(e) => setFormData({ ...formData, vorstand_2_vorsitzender: e.target.value })} placeholder="Vor- und Nachname" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Kassenwart</label>
                    <input type="text" value={formData.vorstand_kassenwart} onChange={(e) => setFormData({ ...formData, vorstand_kassenwart: e.target.value })} placeholder="Vor- und Nachname" />
                  </div>
                  <div className="form-group">
                    <label>Schriftführer</label>
                    <input type="text" value={formData.vorstand_schriftfuehrer} onChange={(e) => setFormData({ ...formData, vorstand_schriftfuehrer: e.target.value })} placeholder="Vor- und Nachname" />
                  </div>
                </div>
                {formData.rechtsform !== 'Verein' && (
                  <div className="form-group">
                    <label>Geschäftsführer</label>
                    <input type="text" value={formData.geschaeftsfuehrer} onChange={(e) => setFormData({ ...formData, geschaeftsfuehrer: e.target.value })} placeholder="Vor- und Nachname" />
                  </div>
                )}
              </div>

              {/* Sport & Verband */}
              <div className="form-section" id="fs-sport" style={{display: subVisible('fs-sport') ? 'block' : 'none'}}>
                <h3>Sport & Verband</h3>
                <div className="form-group">
                  <label>Kampfkunst-Stil</label>
                  <input type="text" value={formData.kampfkunst_stil} onChange={(e) => setFormData({ ...formData, kampfkunst_stil: e.target.value })} placeholder="z.B. Shotokan Karate, Taekwondo, Jiu-Jitsu" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Verband</label>
                    <input type="text" value={formData.verband} onChange={(e) => setFormData({ ...formData, verband: e.target.value })} placeholder="z.B. DKV, DOSB, DTB" />
                  </div>
                  <div className="form-group">
                    <label>Verbands-Mitgliedsnummer</label>
                    <input type="text" value={formData.verband_mitgliedsnummer} onChange={(e) => setFormData({ ...formData, verband_mitgliedsnummer: e.target.value })} placeholder="123456" />
                  </div>
                </div>
                <h4 className="de-section-heading">Trainer-Lizenzen</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>A-Lizenz Trainer</label>
                    <input type="number" value={formData.lizenz_trainer_a} onChange={(e) => setFormData({ ...formData, lizenz_trainer_a: parseInt(e.target.value) || 0 })} min="0" placeholder="Anzahl" />
                  </div>
                  <div className="form-group">
                    <label>B-Lizenz Trainer</label>
                    <input type="number" value={formData.lizenz_trainer_b} onChange={(e) => setFormData({ ...formData, lizenz_trainer_b: parseInt(e.target.value) || 0 })} min="0" placeholder="Anzahl" />
                  </div>
                  <div className="form-group">
                    <label>C-Lizenz Trainer</label>
                    <input type="number" value={formData.lizenz_trainer_c} onChange={(e) => setFormData({ ...formData, lizenz_trainer_c: parseInt(e.target.value) || 0 })} min="0" placeholder="Anzahl" />
                  </div>
                </div>
              </div>

              {/* Social Media */}
              <div className="form-section" id="fs-social" style={{display: subVisible('fs-social') ? 'block' : 'none'}}>
                <h3>Social Media & Online-Präsenz</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Facebook URL</label>
                    <input type="url" value={formData.facebook_url} onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })} placeholder="https://facebook.com/ihr-dojo" />
                  </div>
                  <div className="form-group">
                    <label>Instagram URL</label>
                    <input type="url" value={formData.instagram_url} onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })} placeholder="https://instagram.com/ihr-dojo" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>YouTube URL</label>
                    <input type="url" value={formData.youtube_url} onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })} placeholder="https://youtube.com/@ihr-dojo" />
                  </div>
                  <div className="form-group">
                    <label>Twitter/X URL</label>
                    <input type="url" value={formData.twitter_url} onChange={(e) => setFormData({ ...formData, twitter_url: e.target.value })} placeholder="https://twitter.com/ihr-dojo" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Google Maps URL</label>
                  <input type="url" value={formData.google_maps_url} onChange={(e) => setFormData({ ...formData, google_maps_url: e.target.value })} placeholder="https://maps.google.com/?cid=..." />
                  <p className="de-map-hint">Link zu Ihrem Google Maps Eintrag für Standort-Anzeige</p>
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={formData.newsletter_aktiv} onChange={(e) => setFormData({ ...formData, newsletter_aktiv: e.target.checked })} />
                    <span>Newsletter-Funktion aktiv</span>
                  </label>
                </div>
              </div>

              {/* Betrieb & Kontakte */}
              <div className="form-section" id="fs-betrieb" style={{display: subVisible('fs-betrieb') ? 'block' : 'none'}}>
                <h3>Betrieb & Kontakte</h3>
                <h4 className="de-section-heading">Notfallkontakte</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Notfallkontakt Name</label>
                    <input type="text" value={formData.notfallkontakt_name} onChange={(e) => setFormData({ ...formData, notfallkontakt_name: e.target.value })} placeholder="Vor- und Nachname" />
                  </div>
                  <div className="form-group">
                    <label>Notfallkontakt Telefon</label>
                    <input type="tel" value={formData.notfallkontakt_telefon} onChange={(e) => setFormData({ ...formData, notfallkontakt_telefon: e.target.value })} placeholder="+49 170 1234567" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Hausmeister Kontakt</label>
                  <input type="text" value={formData.hausmeister_kontakt} onChange={(e) => setFormData({ ...formData, hausmeister_kontakt: e.target.value })} placeholder="Name und Telefon des Hausmeisters" />
                </div>
                <h4 className="de-section-heading">Betriebszeiten</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={formData.feiertage_geschlossen} onChange={(e) => setFormData({ ...formData, feiertage_geschlossen: e.target.checked })} />
                      <span>An Feiertagen geschlossen</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={formData.ferien_geschlossen} onChange={(e) => setFormData({ ...formData, ferien_geschlossen: e.target.checked })} />
                      <span>In den Schulferien geschlossen</span>
                    </label>
                  </div>
                </div>
              </div>
          </div>{/* section info */}

          {/* ══════════════════════════════════════════
              SECTION 2: RÄUME & KURSE
          ══════════════════════════════════════════ */}
          <div style={{display: openSection === 'raeume' ? 'block' : 'none'}}>
              <div className="form-section de-btn-reset">
                <RaumVerwaltung />
              </div>
          </div>{/* section raeume */}

          {/* ══════════════════════════════════════════
              SECTION 3: STEUERN & FINANZEN
          ══════════════════════════════════════════ */}
          <div style={{display: openSection === 'steuern' ? 'block' : 'none'}}>

              <div className="form-section" id="fs-steuer" style={{display: subVisible('fs-steuer') ? 'block' : 'none'}}>
                <h3>Steuereinstellungen</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Steuerstatus</label>
                    <select value={formData.steuer_status} onChange={(e) => setFormData({ ...formData, steuer_status: e.target.value, ust_satz: e.target.value === 'regelbesteuerung' ? 19 : 0 })}>
                      <option value="kleinunternehmer">Kleinunternehmer (§ 19 UStG)</option>
                      <option value="regelbesteuerung">Regelbesteuerung (19% USt)</option>
                    </select>
                  </div>
                  {formData.steuer_status === 'kleinunternehmer' && (
                    <div className="form-group">
                      <label>Kleinunternehmer-Grenze (EUR)</label>
                      <input type="number" value={formData.kleinunternehmer_grenze} onChange={(e) => setFormData({ ...formData, kleinunternehmer_grenze: parseFloat(e.target.value) })} />
                    </div>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Finanzamt</label>
                    <FinanzamtSelector
                      value={formData.finanzamt}
                      onChange={(finanzamt) => setFormData({ ...formData, finanzamt, finanzamt_name: finanzamt ? `${finanzamt.name}, ${finanzamt.ort}` : '' })}
                      placeholder="Finanzamt suchen..."
                    />
                  </div>
                  <div className="form-group">
                    <label>Steuernummer</label>
                    <input type="text" value={formData.steuernummer} onChange={(e) => setFormData({ ...formData, steuernummer: e.target.value })} />
                  </div>
                </div>
                {formData.steuer_status === 'regelbesteuerung' && (
                  <div className="form-group">
                    <label>USt-IdNr.</label>
                    <input type="text" value={formData.ust_id} onChange={(e) => setFormData({ ...formData, ust_id: e.target.value })} placeholder="DE123456789" />
                  </div>
                )}
              </div>

              <div className="form-section" id="fs-versicherungen" style={{display: subVisible('fs-versicherungen') ? 'block' : 'none'}}>
                <h3>Versicherungen</h3>
                <h4 className="de-section-heading">Haftpflichtversicherung</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Versicherungsgesellschaft</label>
                    <input type="text" value={formData.haftpflicht_versicherung} onChange={(e) => setFormData({ ...formData, haftpflicht_versicherung: e.target.value })} placeholder="z.B. ARAG Sportversicherung" />
                  </div>
                  <div className="form-group">
                    <label>Policen-Nr.</label>
                    <input type="text" value={formData.haftpflicht_police_nr} onChange={(e) => setFormData({ ...formData, haftpflicht_police_nr: e.target.value })} placeholder="123456789" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Ablaufdatum</label>
                  <input type="date" value={formData.haftpflicht_ablauf} onChange={(e) => setFormData({ ...formData, haftpflicht_ablauf: e.target.value })} />
                </div>
                <h4 className="de-section-heading">Weitere Versicherungen</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Unfallversicherung</label>
                    <input type="text" value={formData.unfallversicherung} onChange={(e) => setFormData({ ...formData, unfallversicherung: e.target.value })} placeholder="Versicherungsgesellschaft" />
                  </div>
                  <div className="form-group">
                    <label>Policen-Nr.</label>
                    <input type="text" value={formData.unfallversicherung_police_nr} onChange={(e) => setFormData({ ...formData, unfallversicherung_police_nr: e.target.value })} placeholder="123456789" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Gebäudeversicherung</label>
                  <input type="text" value={formData.gebaeudeversicherung} onChange={(e) => setFormData({ ...formData, gebaeudeversicherung: e.target.value })} placeholder="Versicherung und Policen-Nr." />
                </div>
              </div>
          </div>{/* section steuern */}

          {/* ══════════════════════════════════════════
              SECTION 4: BANKVERBINDUNG
          ══════════════════════════════════════════ */}
          <div style={{display: openSection === 'bank' ? 'block' : 'none'}}>
              {!isNewDojo ? (
                <BankTabs dojoId={id} />
              ) : (
                <div className="form-section">
                  <div className="de-bank-empty">
                    <AlertCircle size={48} className="de-bank-empty-icon" />
                    <h3 className="de-bank-empty-title">Dojo zuerst speichern</h3>
                    <p>Bankverbindungen können nach dem Erstellen des Dojos hinzugefügt werden.</p>
                  </div>
                </div>
              )}
          </div>{/* section bank */}

          {/* ══════════════════════════════════════════
              SECTION 5: VERTRÄGE
          ══════════════════════════════════════════ */}
          <div style={{display: openSection === 'vertraege' ? 'block' : 'none'}}>

              <div className="form-section">
                <h3>Vertragsmodell & Einstellungen</h3>
                <p className="de-intro-text">Wählen Sie das Vertragsmodell und konfigurieren Sie die Standardeinstellungen für neue Verträge</p>

                <h4 className="de-section-heading-md">🔄 Vertragsmodell auswählen</h4>
                <div className="de-option-list">
                  <label className={`de-option-label${formData.vertragsmodell === 'gesetzlich' ? ' de-option-label--gesetzlich-active' : ' de-option-label--inactive'}`}>
                    <input type="radio" name="vertragsmodell" value="gesetzlich" checked={formData.vertragsmodell === 'gesetzlich'} onChange={(e) => setFormData({ ...formData, vertragsmodell: e.target.value })} className="de-radio-mt" />
                    <div>
                      <div className="de-label-bold">📜 Gesetzliche Verlängerung (Standard)</div>
                      <div className="de-text-secondary-sm">Vertrag verlängert sich automatisch. Nach der Verlängerung kann das Mitglied jederzeit mit <strong>1 Monat Frist</strong> kündigen.</div>
                    </div>
                  </label>
                  <label className={`de-option-label${formData.vertragsmodell === 'beitragsgarantie' ? ' de-option-label--beitragsgarantie-active' : ' de-option-label--inactive'}`}>
                    <input type="radio" name="vertragsmodell" value="beitragsgarantie" checked={formData.vertragsmodell === 'beitragsgarantie'} onChange={(e) => setFormData({ ...formData, vertragsmodell: e.target.value })} className="de-radio-mt" />
                    <div>
                      <div className="de-label-bold">💰 Beitragsgarantie-Modell</div>
                      <div className="de-text-secondary-sm">Mitglied muss <strong>aktiv verlängern</strong>, um seinen aktuellen Beitrag zu behalten.</div>
                    </div>
                  </label>
                </div>

                {formData.vertragsmodell === 'beitragsgarantie' && (
                  <div className="de-bg-section-teal">
                    <h4 className="de-heading-teal">⚙️ Beitragsgarantie-Einstellungen</h4>
                    <div className="form-group de-mb-md">
                      <label>Bei Nicht-Verlängerung</label>
                      <select value={formData.beitragsgarantie_bei_nichtverlaengerung} onChange={(e) => setFormData({ ...formData, beitragsgarantie_bei_nichtverlaengerung: e.target.value })}>
                        <option value="aktueller_tarif">Automatisch aktueller Tarifpreis</option>
                        <option value="vertrag_endet">Vertrag endet</option>
                      </select>
                    </div>
                    <h5 className="de-subheading-text-primary">📧 Erinnerungs-E-Mails</h5>
                    <div className="form-row">
                      <div className="form-group">
                        <label>1. Erinnerung (Tage vorher)</label>
                        <input type="number" value={formData.verlaengerung_erinnerung_tage} onChange={(e) => setFormData({ ...formData, verlaengerung_erinnerung_tage: parseInt(e.target.value) })} min="14" max="90" />
                      </div>
                      <div className="form-group">
                        <label>2. Erinnerung (Tage vorher)</label>
                        <input type="number" value={formData.verlaengerung_erinnerung2_tage} onChange={(e) => setFormData({ ...formData, verlaengerung_erinnerung2_tage: parseInt(e.target.value) })} min="0" max="60" />
                      </div>
                      <div className="form-group">
                        <label>Letzte Erinnerung (Tage vorher)</label>
                        <input type="number" value={formData.verlaengerung_erinnerung3_tage} onChange={(e) => setFormData({ ...formData, verlaengerung_erinnerung3_tage: parseInt(e.target.value) })} min="0" max="30" />
                      </div>
                    </div>
                  </div>
                )}

                <h4 className="de-section-heading">📝 Allgemeine Einstellungen</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Kündigungsfrist (Monate)</label>
                    <input type="number" value={formData.kuendigungsfrist_monate} onChange={(e) => setFormData({ ...formData, kuendigungsfrist_monate: parseInt(e.target.value) })} min="0" max="12" />
                  </div>
                  <div className="form-group">
                    <label>Mindestlaufzeit (Monate)</label>
                    <input type="number" value={formData.mindestlaufzeit_monate} onChange={(e) => setFormData({ ...formData, mindestlaufzeit_monate: parseInt(e.target.value) })} min="0" max="24" />
                  </div>
                  <div className="form-group">
                    <label>Verlängerung (Monate)</label>
                    <input type="number" value={formData.verlaengerung_monate} onChange={(e) => setFormData({ ...formData, verlaengerung_monate: parseInt(e.target.value) })} min="1" max="24" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Probezeit (Tage)</label>
                  <input type="number" value={formData.probezeit_tage} onChange={(e) => setFormData({ ...formData, probezeit_tage: parseInt(e.target.value) })} min="0" max="90" />
                </div>
                <div className="form-row de-form-row-mt">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={formData.kuendigung_nur_monatsende} onChange={(e) => setFormData({ ...formData, kuendigung_nur_monatsende: e.target.checked })} />
                      <span>Kündigung nur zum Monatsende</span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={formData.kuendigung_schriftlich} onChange={(e) => setFormData({ ...formData, kuendigung_schriftlich: e.target.checked })} />
                      <span>Kündigung muss schriftlich erfolgen</span>
                    </label>
                  </div>
                </div>

                <h4 className="de-section-heading-xl">💶 Vertragslaufzeiten & Preise</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={formData.vertrag_3_monate_aktiv} onChange={(e) => setFormData({ ...formData, vertrag_3_monate_aktiv: e.target.checked })} />
                      <span>3-Monats-Vertrag aktiv</span>
                    </label>
                    {formData.vertrag_3_monate_aktiv && (
                      <input type="number" step="0.01" value={formData.vertrag_3_monate_preis} onChange={(e) => setFormData({ ...formData, vertrag_3_monate_preis: e.target.value })} placeholder="Preis in EUR" className="de-mt-sm" />
                    )}
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={formData.vertrag_6_monate_aktiv} onChange={(e) => setFormData({ ...formData, vertrag_6_monate_aktiv: e.target.checked })} />
                      <span>6-Monats-Vertrag aktiv</span>
                    </label>
                    {formData.vertrag_6_monate_aktiv && (
                      <input type="number" step="0.01" value={formData.vertrag_6_monate_preis} onChange={(e) => setFormData({ ...formData, vertrag_6_monate_preis: e.target.value })} placeholder="Preis in EUR" className="de-mt-sm" />
                    )}
                  </div>
                  <div className="form-group">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={formData.vertrag_12_monate_aktiv} onChange={(e) => setFormData({ ...formData, vertrag_12_monate_aktiv: e.target.checked })} />
                      <span>12-Monats-Vertrag aktiv</span>
                    </label>
                    {formData.vertrag_12_monate_aktiv && (
                      <input type="number" step="0.01" value={formData.vertrag_12_monate_preis} onChange={(e) => setFormData({ ...formData, vertrag_12_monate_preis: e.target.value })} placeholder="Preis in EUR" className="de-mt-sm" />
                    )}
                  </div>
                </div>

                <h4 className="de-section-heading-xl">🏷️ Rabatte</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Familienrabatt (%)</label>
                    <input type="number" step="0.01" value={formData.familienrabatt_prozent} onChange={(e) => setFormData({ ...formData, familienrabatt_prozent: e.target.value })} placeholder="z.B. 10" min="0" max="100" />
                  </div>
                  <div className="form-group">
                    <label>Schülerrabatt (%)</label>
                    <input type="number" step="0.01" value={formData.schuelerrabatt_prozent} onChange={(e) => setFormData({ ...formData, schuelerrabatt_prozent: e.target.value })} placeholder="z.B. 15" min="0" max="100" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Vereinsmitglied-Rabatt (%)</label>
                    <input type="number" step="0.01" value={formData.vereinsmitglied_rabatt_prozent} onChange={(e) => setFormData({ ...formData, vereinsmitglied_rabatt_prozent: e.target.value })} placeholder="z.B. 5" min="0" max="100" />
                  </div>
                  <div className="form-group">
                    <label>Mehrfachtraining-Rabatt (%)</label>
                    <input type="number" step="0.01" value={formData.mehrfachtraining_rabatt_prozent} onChange={(e) => setFormData({ ...formData, mehrfachtraining_rabatt_prozent: e.target.value })} placeholder="z.B. 10" min="0" max="100" />
                  </div>
                </div>

                <div className="de-info-box-blue">
                  <div className="de-flex-start-gap">
                    <span className="de-icon-lg">ℹ️</span>
                    <div className="de-info-text">
                      <strong>Hinweis zum deutschen Verbraucherrecht:</strong><br />
                      Seit März 2022 können Verbraucher nach automatischer Vertragsverlängerung jederzeit mit 1 Monat Frist kündigen.
                    </div>
                  </div>
                </div>
              </div>
          </div>{/* section vertraege */}

          {/* ══════════════════════════════════════════
              SECTION 6: DIGITAL & KOMMUNIKATION
          ══════════════════════════════════════════ */}
          <div style={{display: openSection === 'digital' ? 'block' : 'none'}}>

              {/* E-Mail-Konfiguration */}
              <div className="form-section" id="fs-email" style={{display: subVisible('fs-email') ? 'block' : 'none'}}>
                <h3>E-Mail-Konfiguration</h3>
                <p className="de-subtext-mb">Wählen Sie, wie E-Mails von Ihrem Dojo versendet werden sollen.</p>

                {emailMessage && (
                  <div className={`de-email-message ${emailMessage.includes('❌') ? 'de-email-message--error' : emailMessage.includes('⚠️') ? 'de-email-message--warning' : 'de-email-message--success'}`}>
                    {emailMessage}
                  </div>
                )}

                <div className="de-email-mode-grid">
                  <label className={`de-email-mode-label${emailSettings.email_mode === 'zentral' ? ' de-email-mode-label--zentral-active' : ' de-email-mode-label--inactive'}`}>
                    <div className="de-flex-start-gap">
                      <input type="radio" name="email_mode" value="zentral" checked={emailSettings.email_mode === 'zentral'} onChange={(e) => setEmailSettings({ ...emailSettings, email_mode: e.target.value })} className="de-mt-xs" />
                      <div>
                        <div className="de-label-bold">Zentraler Versand (Standard)</div>
                        <div className="u-text-secondary-sm">E-Mails werden über den zentralen DojoSoftware-Server versendet. Keine Konfiguration nötig.</div>
                      </div>
                    </div>
                  </label>
                  <label className={`de-email-mode-label${emailSettings.email_mode === 'eigener_smtp' ? ' de-email-mode-label--smtp-active' : ' de-email-mode-label--inactive'}`}>
                    <div className="de-flex-start-gap">
                      <input type="radio" name="email_mode" value="eigener_smtp" checked={emailSettings.email_mode === 'eigener_smtp'} onChange={(e) => setEmailSettings({ ...emailSettings, email_mode: e.target.value })} className="de-mt-xs" />
                      <div>
                        <div className="de-label-bold">Eigener SMTP-Server</div>
                        <div className="u-text-secondary-sm">Verwenden Sie Ihren eigenen Mailserver (z.B. Gmail, Outlook).</div>
                      </div>
                    </div>
                  </label>
                  <label className={`de-email-mode-label${emailSettings.email_mode === 'tda_email' ? ' de-email-mode-label--tda-active' : ' de-email-mode-label--inactive'}`}>
                    <div className="de-flex-start-gap">
                      <input type="radio" name="email_mode" value="tda_email" checked={emailSettings.email_mode === 'tda_email'} onChange={(e) => setEmailSettings({ ...emailSettings, email_mode: e.target.value })} className="de-mt-xs" />
                      <div>
                        <div className="de-label-bold">@tda-intl.com E-Mail</div>
                        <div className="u-text-secondary-sm">Nutzen Sie eine professionelle E-Mail-Adresse wie dojo@tda-intl.com</div>
                      </div>
                    </div>
                  </label>
                </div>

                {emailSettings.email_mode === 'eigener_smtp' && (
                  <div className="de-smtp-box">
                    <h4 className="de-heading-info">SMTP-Server Einstellungen</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label>SMTP Host *</label>
                        <input type="text" value={emailSettings.smtp_host} onChange={(e) => setEmailSettings({ ...emailSettings, smtp_host: e.target.value })} placeholder="z.B. smtp.gmail.com" />
                      </div>
                      <div className="form-group de-form-group-150">
                        <label>Port *</label>
                        <input type="number" value={emailSettings.smtp_port} onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: parseInt(e.target.value) || 587 })} placeholder="587" />
                      </div>
                      <div className="form-group de-form-group-100">
                        <label>SSL/TLS</label>
                        <select value={emailSettings.smtp_secure ? '1' : '0'} onChange={(e) => setEmailSettings({ ...emailSettings, smtp_secure: e.target.value === '1' })}>
                          <option value="1">Ja</option>
                          <option value="0">Nein</option>
                        </select>
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="form-group">
                        <label>SMTP Benutzername *</label>
                        <input type="text" value={emailSettings.smtp_user} onChange={(e) => setEmailSettings({ ...emailSettings, smtp_user: e.target.value })} placeholder="user@example.com" />
                      </div>
                      <div className="form-group">
                        <label>SMTP Passwort *</label>
                        <input type="password" value={emailSettings.smtp_password} onChange={(e) => setEmailSettings({ ...emailSettings, smtp_password: e.target.value })} placeholder={emailSettings.has_smtp_password ? '••••••••' : 'Passwort eingeben'} />
                        {emailSettings.has_smtp_password && <small className="de-hint-block">Passwort ist hinterlegt. Leer lassen, um es beizubehalten.</small>}
                      </div>
                    </div>
                  </div>
                )}

                {emailSettings.email_mode === 'tda_email' && (
                  <div className="de-tda-email-box">
                    <h4 className="de-heading-purple">TDA E-Mail Zugangsdaten</h4>
                    <div className="form-row">
                      <div className="form-group">
                        <label>TDA E-Mail-Adresse *</label>
                        <input type="email" value={emailSettings.tda_email} onChange={(e) => setEmailSettings({ ...emailSettings, tda_email: e.target.value })} placeholder="ihrdojo@tda-intl.com" />
                      </div>
                      <div className="form-group">
                        <label>TDA E-Mail Passwort *</label>
                        <input type="password" value={emailSettings.tda_email_password} onChange={(e) => setEmailSettings({ ...emailSettings, tda_email_password: e.target.value })} placeholder={emailSettings.has_tda_password ? '••••••••' : 'Passwort eingeben'} />
                        {emailSettings.has_tda_password && <small className="de-hint-block">Passwort ist hinterlegt. Leer lassen, um es beizubehalten.</small>}
                      </div>
                    </div>
                    <div className="de-tda-hint-box">
                      <p className="de-text-secondary-no-margin">💡 Eine @tda-intl.com E-Mail-Adresse muss zunächst vom TDA Intl Support eingerichtet werden.</p>
                    </div>
                  </div>
                )}

                <div className="de-email-save-wrapper">
                  <button type="button" onClick={saveEmailSettings} disabled={emailLoading} className="de-btn-email-save">
                    {emailLoading ? 'Wird gespeichert...' : 'E-Mail-Einstellungen speichern'}
                  </button>
                </div>

                <div className="de-test-email-box">
                  <h4 className="de-primary-mb">Test-E-Mail senden</h4>
                  <div className="de-test-email-row">
                    <div className="u-flex-1">
                      <label className="u-form-label-secondary">Test-E-Mail-Adresse</label>
                      <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="ihre@email.de" className="de-test-email-input" />
                    </div>
                    <button type="button" onClick={sendTestEmailForDojo} disabled={emailLoading || !testEmail} className="de-test-email-btn">
                      {emailLoading ? 'Wird gesendet...' : '📤 Test senden'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Probetraining */}
              <div className="form-section" id="fs-probetraining" style={{display: subVisible('fs-probetraining') ? 'block' : 'none'}}>
                <h3>Probetraining-Buchung</h3>
                <p className="de-subtext-mb">Teilen Sie diesen Link auf Ihrer Website oder Social Media, damit Interessenten direkt ein Probetraining buchen können.</p>
                {subdomain ? (
                  <div className="de-probetraining-box">
                    <label className="de-probetraining-label">Ihr Probetraining-Link:</label>
                    <div className="de-probetraining-url-row">
                      <input type="text" readOnly value={`https://${subdomain}.dojo.tda-intl.org/probetraining`} className="de-probetraining-input" />
                      <button type="button" onClick={() => { navigator.clipboard.writeText(`https://${subdomain}.dojo.tda-intl.org/probetraining`); setProbetrainingCopied(true); setTimeout(() => setProbetrainingCopied(false), 2000); }} className={probetrainingCopied ? 'de-copy-btn--copied' : 'de-copy-btn'}>
                        {probetrainingCopied ? '✓ Kopiert!' : '📋 Kopieren'}
                      </button>
                    </div>
                    <div className="de-probetraining-links-grid">
                      <a href={`https://${subdomain}.dojo.tda-intl.org/probetraining`} target="_blank" rel="noopener noreferrer" className="de-probetraining-link">🔗 Link öffnen</a>
                    </div>
                    <div className="de-tip-box">
                      <h4 className="de-heading-success">💡 Tipp</h4>
                      <p className="de-text-secondary-no-margin">Alle Probetraining-Anfragen werden automatisch in Ihrer Interessenten-Liste gespeichert unter <strong>Mitglieder → Interessenten</strong>.</p>
                    </div>
                  </div>
                ) : (
                  <div className="de-probetraining-empty">
                    <p>Keine Subdomain konfiguriert.</p>
                    <p className="de-probetraining-empty-hint">Bitte kontaktieren Sie den Support, um eine Subdomain für Ihr Dojo einzurichten.</p>
                  </div>
                )}
              </div>

              {/* Messenger */}
              {!isNewDojo && (
                <div className="form-section" id="fs-messenger" style={{display: subVisible('fs-messenger') ? 'block' : 'none'}}>
                  <h3>📘 Facebook Messenger Integration</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Verfügbar für Dojos mit konfigurierter Subdomain. Eingehende Messenger-Nachrichten erscheinen im Chat-Dashboard.
                  </p>
                  <MessengerKonfiguration dojoId={id} />
                </div>
              )}

              {/* Logos */}
              <div className="form-section de-btn-reset" id="fs-logos" style={{display: subVisible('fs-logos') ? 'block' : 'none'}}>
                <DojoLogos dojoId={id} />
              </div>

              {/* Design & Theme */}
              <div className="form-section" id="fs-design" style={{display: (!openSub || openSub === 'fs-logos') ? 'block' : 'none'}}>
                <h3>Design & Theme</h3>

                <h4 className="de-section-heading-md">🎨 Theme-Auswahl</h4>
                <div className="de-mb-lg">
                  <div className="de-theme-current-box">
                    <div className="de-theme-preview-square" style={{ '--theme-preview': currentTheme?.preview || 'linear-gradient(135deg, #0f0f23, #16213e)' }}>
                      {isDarkMode ? '🌙' : '☀️'}
                    </div>
                    <div>
                      <div className="de-theme-name">{currentTheme?.name || 'Midnight Blue'}</div>
                      <div className="u-text-secondary-sm">{currentTheme?.description}</div>
                      <span className={isDarkMode ? 'de-mode-badge--dark' : 'de-mode-badge--light'}>
                        {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                      </span>
                    </div>
                    <button type="button" onClick={() => setShowThemeSelector(!showThemeSelector)} className="de-btn-theme-change">
                      <Palette size={18} />
                      Theme wechseln
                    </button>
                  </div>
                  {showThemeSelector && (
                    <div className="de-theme-selector-grid">
                      {themes.map(t => (
                        <div key={t.id} onClick={() => handleThemeChange(t.id)} className={theme === t.id ? 'de-theme-card--selected' : 'de-theme-card--unselected'}>
                          <div className="de-theme-preview-bar" style={{ '--theme-preview': t.preview }}>{t.isDark ? '🌙' : '☀️'}</div>
                          <div className="de-theme-card-name">{t.name}</div>
                          <div className="de-theme-card-desc">{t.description}</div>
                          {theme === t.id && <div className="de-theme-card-active">✓ Aktiv</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <h4 className="de-section-heading">🎯 Dojo-Farbe</h4>
                <div className="form-group">
                  <p className="de-color-hint">Diese Farbe wird zur visuellen Kennzeichnung des Dojos verwendet.</p>
                  <div className="color-picker-wrapper">
                    <input type="color" value={formData.farbe} onChange={(e) => setFormData({ ...formData, farbe: e.target.value })} />
                    <div className="color-preview" style={{ '--preview-color': formData.farbe }}>
                      <span>{formData.farbe}</span>
                    </div>
                  </div>
                </div>
                <div className="color-suggestions">
                  <p className="de-color-suggestions-label">Vorschläge:</p>
                  <div className="color-buttons">
                    {['#FFD700', '#FF6B35', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map(color => (
                      <button key={color} type="button" className="color-button" style={{ '--swatch-color': color }} onClick={() => setFormData({ ...formData, farbe: color })} title={color} />
                    ))}
                  </div>
                </div>

                <h4 className="de-section-heading" style={{ marginTop: '2rem' }}>🗂 Tab-Design</h4>
                <p className="dtab-live-hint"><span>👁</span> Änderungen wirken sofort — "Übernehmen" speichert dauerhaft.</p>
                <div className="dtab-style-grid">
                  {[
                    { id: 'glass', label: 'Glass', desc: 'Gradient & Glassmorphism (Standard)', normal: { background: 'linear-gradient(135deg, rgba(255,215,0,0.12), transparent)', borderRadius: '16px', color: 'rgba(255,255,255,0.85)', border: 'none' }, active: (c) => ({ background: `linear-gradient(135deg, ${c}33, ${c}18, rgba(255,107,53,0.1))`, borderRadius: '16px', color: c, border: 'none' }) },
                    { id: 'underline', label: 'Underline', desc: 'Minimal mit Unterstrich', normal: { background: 'transparent', borderRadius: '0', color: 'rgba(255,255,255,0.5)', borderBottom: '2px solid transparent', paddingBottom: '5px' }, active: (c) => ({ background: 'transparent', borderRadius: '0', color: c, borderBottom: `2px solid ${c}`, paddingBottom: '5px' }) },
                    { id: 'pill-solid', label: 'Pill', desc: 'Solide Pill mit Akzentfarbe', trackStyle: { background: 'rgba(255,255,255,0.04)', borderRadius: '100px', padding: '3px', border: '1px solid rgba(255,255,255,0.07)' }, normal: { background: 'transparent', borderRadius: '100px', color: 'rgba(255,255,255,0.5)', border: 'none' }, active: (c) => ({ background: c, borderRadius: '100px', color: '#1a1a0a', border: 'none' }) },
                    { id: 'frosted', label: 'Frosted', desc: 'Tabs auf Glasfläche', trackStyle: { background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '3px', border: '1px solid rgba(255,255,255,0.06)' }, normal: { background: 'transparent', borderRadius: '7px', color: 'rgba(255,255,255,0.5)', border: '1px solid transparent' }, active: (c) => ({ background: `${c}1a`, borderRadius: '7px', color: c, border: `1px solid ${c}40` }) },
                    { id: 'bordered', label: 'Bordered', desc: 'Klare Rahmen-Ansicht', normal: { background: 'transparent', borderRadius: '7px', color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }, active: (c) => ({ background: `${c}14`, borderRadius: '7px', color: c, border: `1px solid ${c}` }) },
                  ].map((style) => (
                    <div key={style.id} className={`dtab-style-card${tabStyle === style.id ? ' active' : ''}`} onClick={() => handleTabStyleSelect(style.id)}>
                      {tabStyle === style.id && <span className="dtab-active-check">✓ Aktiv</span>}
                      <div className="dtab-preview-strip" style={style.trackStyle || {}}>
                        {['Tab 1', 'Tab 2', 'Tab 3'].map((t, i) => (
                          <span key={t} className="dtab-preview-tab" style={i === 1 ? style.active(tabAccent) : style.normal}>{t}</span>
                        ))}
                      </div>
                      <div className="dtab-style-label">{style.label}</div>
                      <div className="dtab-style-desc">{style.desc}</div>
                    </div>
                  ))}
                </div>
                <div className="dtab-color-section">
                  <div className="dtab-color-label">Akzentfarbe der Tabs<small>Wirkt auf alle Tab-Stile</small></div>
                  <input type="color" className="dtab-color-input" value={tabAccent} onChange={handleTabAccentChange} />
                  <span className="dtab-color-hex">{tabAccent.toUpperCase()}</span>
                  <button type="button" className="dtab-color-reset" onClick={() => { setTabAccent('#ffd700'); document.documentElement.style.setProperty('--tab-accent', '#ffd700'); }}>Zurücksetzen</button>
                </div>
                <div className="dtab-save-row">
                  <button type="button" className="dtab-save-btn" onClick={handleTabStyleSave}><span>💾</span> Übernehmen</button>
                  {tabStyleSaved && <span className="dtab-saved-msg">✓ Tab-Design gespeichert!</span>}
                </div>
              </div>
          </div>{/* section digital */}

          {/* ══════════════════════════════════════════
              SECTION 7: DOKUMENTE
          ══════════════════════════════════════════ */}
          <div style={{display: openSection === 'dokumente' ? 'block' : 'none'}}>

              <div className="form-section">
                <h3>Rechtliche Dokumente</h3>

                <div className="de-docs-info-box">
                  <div className="de-docs-info-inner">
                    <div className="de-docs-icon">ℹ️</div>
                    <div>
                      <h4 className="de-docs-heading">Versionierte Dokumentenverwaltung</h4>
                      <p className="de-docs-body">Ihre rechtlichen Dokumente (AGB, Datenschutzerklärung) werden <strong>versioniert</strong> gespeichert.</p>
                      <ul className="de-docs-list">
                        <li>Automatische Versionsverwaltung (z.B. Version 1.0, 1.1, 2.0)</li>
                        <li>Zeitstempel für jede Dokumentenänderung</li>
                        <li>Nachvollziehbarkeit: Welche AGB-Version wurde bei Vertragsabschluss akzeptiert?</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="de-agb-box">
                  <h4 className="de-primary-mb">AGB & Datenschutz (mit Versionierung)</h4>
                  <div className="de-versions-grid">
                    <div>
                      <span className="de-text-secondary-xs">AGB Version:</span>
                      <strong className="de-ml-primary">v{formData.agb_version}</strong>
                      {formData.agb_letzte_aenderung && <span className="de-hint-muted">(geändert: {new Date(formData.agb_letzte_aenderung).toLocaleDateString('de-DE')})</span>}
                    </div>
                    <div>
                      <span className="de-text-secondary-xs">Datenschutz Version:</span>
                      <strong className="de-ml-primary">v{formData.dsgvo_version}</strong>
                      {formData.dsgvo_letzte_aenderung && <span className="de-hint-muted">(geändert: {new Date(formData.dsgvo_letzte_aenderung).toLocaleDateString('de-DE')})</span>}
                    </div>
                  </div>
                  <div className="form-group">
                    <label>AGB (Allgemeine Geschäftsbedingungen)</label>
                    <textarea value={formData.agb_text} onChange={(e) => setFormData({ ...formData, agb_text: e.target.value })} rows="8" placeholder="Ihre AGB..." className="de-mono" />
                  </div>
                  <div className="form-group">
                    <label>DSGVO / Datenschutzerklärung</label>
                    <textarea value={formData.dsgvo_text} onChange={(e) => setFormData({ ...formData, dsgvo_text: e.target.value })} rows="8" placeholder="Ihre Datenschutzerklärung..." className="de-mono" />
                  </div>
                  <div className="de-agb-actions">
                    <label className="checkbox-label de-checkbox-no-margin">
                      <input type="checkbox" checked={agbSendNotification} onChange={(e) => setAgbSendNotification(e.target.checked)} />
                      <span>Mitglieder per E-Mail benachrichtigen</span>
                    </label>
                    <div className="u-flex-gap-sm">
                      <button type="button" onClick={() => saveAgbDsgvo(false)} disabled={agbSaveLoading || isNewDojo} className="de-btn-agb-ghost">
                        {agbSaveLoading ? 'Speichere...' : 'Speichern'}
                      </button>
                      <button type="button" onClick={() => saveAgbDsgvo(true)} disabled={agbSaveLoading || isNewDojo} className="de-btn-agb-gold">
                        {agbSaveLoading ? 'Speichere...' : 'Speichern + Version erhöhen'}
                      </button>
                    </div>
                  </div>
                  {agbMessage && (
                    <div className={`de-agb-message ${agbMessage.includes('Fehler') ? 'de-agb-message--error' : 'de-agb-message--success'}`}>{agbMessage}</div>
                  )}
                </div>

                <h4 className="de-heading-secondary">Weitere Dokumente</h4>
                <div className="form-group">
                  <label>Dojo-Regeln</label>
                  <textarea value={formData.dojo_regeln_text} onChange={(e) => setFormData({ ...formData, dojo_regeln_text: e.target.value })} rows="6" placeholder="Ihre Dojo-Regeln (Etikette, Verhaltensregeln, etc.)..." />
                </div>
                <div className="form-group">
                  <label>Hausordnung</label>
                  <textarea value={formData.hausordnung_text} onChange={(e) => setFormData({ ...formData, hausordnung_text: e.target.value })} rows="6" placeholder="Ihre Hausordnung..." />
                </div>
                <div className="form-group">
                  <label>Haftungsausschluss</label>
                  <textarea value={formData.haftungsausschluss_text} onChange={(e) => setFormData({ ...formData, haftungsausschluss_text: e.target.value })} rows="6" placeholder="Ihr Haftungsausschluss..." />
                </div>
                <div className="form-group">
                  <label>Widerrufsbelehrung</label>
                  <textarea value={formData.widerrufsbelehrung_text} onChange={(e) => setFormData({ ...formData, widerrufsbelehrung_text: e.target.value })} rows="6" placeholder="Ihre Widerrufsbelehrung..." />
                </div>
                <div className="form-group">
                  <label>Impressum</label>
                  <textarea value={formData.impressum_text} onChange={(e) => setFormData({ ...formData, impressum_text: e.target.value })} rows="6" placeholder="Ihr Impressum..." />
                </div>
                <div className="form-group">
                  <label>Vertragsbedingungen</label>
                  <textarea value={formData.vertragsbedingungen_text} onChange={(e) => setFormData({ ...formData, vertragsbedingungen_text: e.target.value })} rows="6" placeholder="Ihre Vertragsbedingungen..." />
                </div>
              </div>
          </div>{/* section dokumente */}

          {/* ══════════════════════════════════════════
              SECTION 8: SYSTEM & BENUTZER
          ══════════════════════════════════════════ */}
          <div style={{display: openSection === 'system' ? 'block' : 'none'}}>

              {/* System-Einstellungen */}
              <div className="form-section" id="fs-system-settings" style={{display: subVisible('fs-system-settings') ? 'block' : 'none'}}>
                <h3>System-Einstellungen</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Sprache</label>
                    <select value={formData.sprache} onChange={(e) => setFormData({ ...formData, sprache: e.target.value })}>
                      <option value="de">Deutsch</option>
                      <option value="en">English</option>
                      <option value="fr">Français</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Zeitzone</label>
                    <select value={formData.zeitzone} onChange={(e) => setFormData({ ...formData, zeitzone: e.target.value })}>
                      <option value="Europe/Berlin">Europa/Berlin</option>
                      <option value="Europe/Vienna">Europa/Wien</option>
                      <option value="Europe/Zurich">Europa/Zürich</option>
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Währung</label>
                    <select value={formData.waehrung} onChange={(e) => setFormData({ ...formData, waehrung: e.target.value })}>
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                      <option value="CHF">CHF</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Max. Mitglieder</label>
                    <input type="number" min="1" max="10000" value={formData.max_mitglieder} onChange={(e) => setFormData({ ...formData, max_mitglieder: parseInt(e.target.value) })} placeholder="500" />
                  </div>
                </div>
                <div className="form-group">
                  <label>DSGVO-Beauftragter</label>
                  <input type="text" value={formData.dsgvo_beauftragte} onChange={(e) => setFormData({ ...formData, dsgvo_beauftragte: e.target.value })} placeholder="Name des Datenschutzbeauftragten" />
                </div>
              </div>

              {/* Admin-Accounts */}
              <div className="form-section de-btn-reset" id="fs-benutzer" style={{display: subVisible('fs-benutzer') ? 'block' : 'none'}}>
                <AdminVerwaltung />
              </div>

              {/* API-Token (nur für Admins) */}
              {isAdmin && (
                <div className="form-section" id="fs-api" style={{display: subVisible('fs-api') ? 'block' : 'none'}}>
                  <h3>🔗 API-Token für TDA-Turnierverwaltung</h3>
                  <div className="api-info-box">
                    <p><strong>ℹ️ Sicherer API-Zugang</strong><br />Jedes Dojo hat einen eindeutigen API-Token für die sichere Verbindung zur TDA-Turnierverwaltung.</p>
                  </div>
                  <div className="form-group de-mb-lg">
                    <label className="u-flex-row-sm"><span>🌐 API Base URL</span></label>
                    <div className="api-input-group">
                      <input type="text" value={window.location.origin + '/api'} readOnly className="api-input-readonly" />
                      <button type="button" onClick={() => copyToClipboard(window.location.origin + '/api', 'API URL')} className="api-copy-btn">📋 Kopieren</button>
                    </div>
                    <small className="api-hint">Diese URL verwenden Sie im Schritt 2 der TDA-Registrierung</small>
                  </div>
                  <div className="form-group de-mb-lg">
                    <label className="de-api-token-label">
                      <span>🔑 API-Token</span>
                      {apiToken && <span className="api-status-badge">✓ Aktiv</span>}
                    </label>
                    {apiToken ? (
                      <>
                        <div className="api-input-group de-mb-md">
                          <input type="text" value={apiToken} readOnly className="api-input-token" />
                          <button type="button" onClick={() => copyToClipboard(apiToken, 'API-Token')} className="api-copy-btn api-copy-btn-green">📋 Kopieren</button>
                        </div>
                        <div className="api-metadata-box">
                          <div className="api-metadata-grid">
                            <div>
                              <span className="api-metadata-label">Erstellt am:</span>
                              <div className="api-metadata-value">{apiTokenCreatedAt ? new Date(apiTokenCreatedAt).toLocaleString('de-DE') : 'N/A'}</div>
                            </div>
                            <div>
                              <span className="api-metadata-label">Zuletzt verwendet:</span>
                              <div className="api-metadata-value">{apiTokenLastUsed ? new Date(apiTokenLastUsed).toLocaleString('de-DE') : 'Noch nie'}</div>
                            </div>
                          </div>
                        </div>
                        <button type="button" onClick={generateApiToken} disabled={tokenLoading} className="api-regenerate-btn">
                          {tokenLoading ? '⏳ Generiere...' : '🔄 Token regenerieren'}
                        </button>
                        <small className="api-warning-text">⚠️ Warnung: Das Regenerieren macht den alten Token ungültig!</small>
                      </>
                    ) : (
                      <div className="api-empty-state">
                        <p><strong>Kein API-Token vorhanden</strong><br />Generieren Sie einen Token, um die TDA-Integration zu nutzen.</p>
                        <button type="button" onClick={generateApiToken} disabled={tokenLoading || isNewDojo} className="api-generate-btn">
                          {tokenLoading ? '⏳ Generiere...' : '🔑 API-Token generieren'}
                        </button>
                        {isNewDojo && <small className="api-save-hint">Bitte speichern Sie das Dojo zuerst</small>}
                      </div>
                    )}
                  </div>
                  <div className="api-instructions">
                    <h4>📝 So verwenden Sie den API-Token:</h4>
                    <ol>
                      <li>Generieren Sie einen API-Token (falls noch nicht vorhanden)</li>
                      <li>Öffnen Sie die TDA-Turnierverwaltung Registrierung</li>
                      <li>Geben Sie im <strong>Schritt 2</strong> die API-URL und den Token ein</li>
                      <li>Klicken Sie auf "Verbindung testen"</li>
                    </ol>
                  </div>
                  <div className="api-security-note">
                    <p><strong>🔒 Sicherheitshinweise:</strong><br />
                    • Jedes Dojo hat einen eindeutigen, sicheren Token<br />
                    • Geben Sie Ihren Token niemals an Dritte weiter<br />
                    • Bei Verdacht auf Kompromittierung: Token sofort regenerieren</p>
                  </div>
                </div>
              )}
          </div>{/* section system */}

          </form>
        </div>{/* de-split-content */}
      </div>{/* de-split */}
    </div>
  );
};

export default DojoEdit;
