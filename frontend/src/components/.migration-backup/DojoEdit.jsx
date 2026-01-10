import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle } from 'lucide-react';
import FinanzamtSelector from './FinanzamtSelector';
import BankTabs from './BankTabs';
import AdminVerwaltung from './AdminVerwaltung';
import DojoLogos from './DojoLogos';
import { useDojoContext } from '../context/DojoContext';
import config from '../config/config.js';
import '../styles/MitgliedDetail.css';
import '../styles/DojoEdit.css';

const DojoEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateDojo } = useDojoContext();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('grunddaten');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [apiToken, setApiToken] = useState(null);
  const [apiTokenCreatedAt, setApiTokenCreatedAt] = useState(null);
  const [apiTokenLastUsed, setApiTokenLastUsed] = useState(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const isNewDojo = id === 'new';

  // Tab-Konfiguration mit Icons
  const tabs = [
    { key: 'grunddaten', label: 'Grunddaten', icon: '🏯' },
    { key: 'kontakt', label: 'Kontakt', icon: '📍' },
    { key: 'steuer', label: 'Steuern', icon: '⚖️' },
    { key: 'rechtliches', label: 'Rechtliches', icon: '📜' },
    { key: 'bank', label: 'Bank', icon: '🏦' },
    { key: 'versicherungen', label: 'Versicherungen', icon: '🛡️' },
    { key: 'vertraege', label: 'Verträge', icon: '📝' },
    { key: 'sport', label: 'Sport', icon: '🥋' },
    { key: 'social', label: 'Social Media', icon: '📱' },
    { key: 'betrieb', label: 'Betrieb & Kontakte', icon: '☎️' },
    { key: 'dokumente', label: 'Dokumente', icon: '📄' },
    { key: 'logos', label: 'Logos', icon: '🖼️' },
    { key: 'admins', label: 'Admin-Accounts', icon: '🔐' },
    { key: 'api', label: 'API-Zugang', icon: '🔗' },
    { key: 'system', label: 'System', icon: '⚙️' },
    { key: 'design', label: 'Design', icon: '🎨' }
  ];

  // Form State
  const [formData, setFormData] = useState({
    // Grunddaten
    dojoname: '',
    inhaber: '',
    untertitel: '',
    vertreter: '',
    gruendungsjahr: '',
    rechtsform: 'Verein',

    // Adresse
    strasse: '',
    hausnummer: '',
    plz: '',
    ort: '',
    land: 'Deutschland',

    // Kontakt
    telefon: '',
    mobil: '',
    fax: '',
    email: '',
    email_info: '',
    email_anmeldung: '',
    internet: '',
    whatsapp_nummer: '',

    // Steuer
    steuer_status: 'kleinunternehmer',
    ust_satz: 0,
    kleinunternehmer_grenze: 22000,
    steuernummer: '',
    ust_id: '',
    umsatzsteuer_id: '',
    finanzamt_name: '',
    finanzamt: null, // Jetzt ein Objekt statt String
    steuerberater: '',
    steuerberater_telefon: '',
    umsatzsteuerpflichtig: false,
    kleinunternehmer: false,
    gemeinnuetzig: false,
    freistellungsbescheid_datum: '',

    // Rechtliches
    vereinsregister_nr: '',
    amtsgericht: '',
    handelsregister_nr: '',
    geschaeftsfuehrer: '',
    vorstand_1_vorsitzender: '',
    vorstand_2_vorsitzender: '',
    vorstand_kassenwart: '',
    vorstand_schriftfuehrer: '',

    // Bank
    sepa_glaeubiger_id: '',
    iban: '',
    bic: '',
    bank: '',
    bank_inhaber: '',
    bank_verwendungszweck: '',
    paypal_email: '',
    lastschrift_aktiv: false,

    // Versicherungen
    haftpflicht_versicherung: '',
    haftpflicht_police_nr: '',
    haftpflicht_ablauf: '',
    unfallversicherung: '',
    unfallversicherung_police_nr: '',
    gebaeudeversicherung: '',

    // Verträge
    kuendigungsfrist_monate: 3,
    mindestlaufzeit_monate: 12,
    probezeit_tage: 14,

    // Vertragsbedingungen
    kuendigung_nur_monatsende: true,
    kuendigung_schriftlich: true,
    automatische_verlaengerung: true,
    verlaengerung_monate: 12,
    kuendigung_erstlaufzeit_monate: 3,
    kuendigung_verlaengerung_monate: 1,

    // Preise
    beitrag_erwachsene: '',
    beitrag_kinder: '',
    beitrag_familien: '',
    aufnahmegebuehr: '',
    mahnung_gebuehr: 5.00,

    // Sport
    kampfkunst_stil: '',
    verband: '',
    verband_mitgliedsnummer: '',

    // Kontakte & Betrieb
    notfallkontakt_name: '',
    notfallkontakt_telefon: '',
    hausmeister_kontakt: '',
    feiertage_geschlossen: true,
    ferien_geschlossen: false,

    // Social Media
    facebook_url: '',
    instagram_url: '',
    youtube_url: '',
    twitter_url: '',
    google_maps_url: '',
    newsletter_aktiv: false,

    // Rechtliche Dokumente
    agb_text: '',
    dsgvo_text: '',
    dojo_regeln_text: '',
    hausordnung_text: '',
    haftungsausschluss_text: '',
    widerrufsbelehrung_text: '',
    impressum_text: '',
    vertragsbedingungen_text: '',

    // System
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

  const loadDojo = async () => {
    setLoading(true);

    // 🔧 DEVELOPMENT MODE: Mock-Daten verwenden
    const isDevelopment = import.meta.env.MODE === 'development';
    if (isDevelopment) {
      console.log('🔧 Development Mode: Verwende Mock-Dojo für DojoEdit', id);

      // Mock-Dojo basierend auf ID
      const mockDojos = {
        '1': {
          id: 1,
          dojoname: 'Dojo Hamburg',
          inhaber: 'Max Mustermann',
          farbe: '#FFD700',
          ist_hauptdojo: true,
          steuer_status: 'kleinunternehmer',
          kleinunternehmer_grenze: 22000,
          jahresumsatz_aktuell: 15000,
          ust_satz: 0,
          strasse: 'Beispielstraße',
          hausnummer: '123',
          plz: '20095',
          ort: 'Hamburg',
          land: 'Deutschland',
          telefon: '+49 40 12345678',
          email: 'info@dojo-hamburg.de',
          website: 'www.dojo-hamburg.de',
          rechtsform: 'Verein',
          gruendungsjahr: '1985'
        },
        '2': {
          id: 2,
          dojoname: 'Dojo Berlin',
          inhaber: 'Anna Schmidt',
          farbe: '#3B82F6',
          ist_hauptdojo: false,
          steuer_status: 'regelbesteuert',
          kleinunternehmer_grenze: 22000,
          jahresumsatz_aktuell: 35000,
          ust_satz: 19,
          strasse: 'Alexanderplatz',
          hausnummer: '1',
          plz: '10178',
          ort: 'Berlin',
          land: 'Deutschland',
          telefon: '+49 30 98765432',
          email: 'kontakt@dojo-berlin.de',
          website: 'www.dojo-berlin.de',
          rechtsform: 'GmbH',
          gruendungsjahr: '2010'
        }
      };

      const dojo = mockDojos[id] || mockDojos['1'];

      setTimeout(() => {
        setFormData(prev => ({
          ...prev,
          dojoname: dojo.dojoname || '',
          inhaber: dojo.inhaber || '',
          strasse: dojo.strasse || '',
          hausnummer: dojo.hausnummer || '',
          plz: dojo.plz || '',
          ort: dojo.ort || '',
          land: dojo.land || 'Deutschland',
          telefon: dojo.telefon || '',
          email: dojo.email || '',
          internet: dojo.website || '',
          steuer_status: dojo.steuer_status || 'kleinunternehmer',
          ust_satz: dojo.ust_satz || 0,
          kleinunternehmer_grenze: dojo.kleinunternehmer_grenze || 22000,
          rechtsform: dojo.rechtsform || 'Verein',
          gruendungsjahr: dojo.gruendungsjahr || '',
          farbe: dojo.farbe || '#FFD700'
        }));
        setLoading(false);
      }, 100);

      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/dojos/${id}`);
      if (!response.ok) throw new Error('Fehler beim Laden des Dojos');
      const dojo = await response.json();

      // Setze alle Felder vom Dojo-Objekt
      setFormData({
        // Grunddaten
        dojoname: dojo.dojoname || '',
        inhaber: dojo.inhaber || '',
        untertitel: dojo.untertitel || '',
        vertreter: dojo.vertreter || '',
        gruendungsjahr: dojo.gruendungsjahr || '',
        rechtsform: dojo.rechtsform || 'Verein',

        // Adresse
        strasse: dojo.strasse || '',
        hausnummer: dojo.hausnummer || '',
        plz: dojo.plz || '',
        ort: dojo.ort || '',
        land: dojo.land || 'Deutschland',

        // Kontakt
        telefon: dojo.telefon || '',
        mobil: dojo.mobil || '',
        fax: dojo.fax || '',
        email: dojo.email || '',
        email_info: dojo.email_info || '',
        email_anmeldung: dojo.email_anmeldung || '',
        internet: dojo.internet || '',
        whatsapp_nummer: dojo.whatsapp_nummer || '',

        // Steuer
        steuer_status: dojo.steuer_status || 'kleinunternehmer',
        ust_satz: dojo.ust_satz || 0,
        kleinunternehmer_grenze: dojo.kleinunternehmer_grenze || 22000,
        steuernummer: dojo.steuernummer || '',
        ust_id: dojo.ust_id || '',
        finanzamt_name: dojo.finanzamt_name || '',
        finanzamt: dojo.finanzamt || null, // Finanzamt-Objekt laden
        steuerberater: dojo.steuerberater || '',
        umsatzsteuerpflichtig: dojo.umsatzsteuerpflichtig || false,
        kleinunternehmer: dojo.kleinunternehmer || false,
        gemeinnuetzig: dojo.gemeinnuetzig || false,

        // Rechtliches
        vereinsregister_nr: dojo.vereinsregister_nr || '',
        amtsgericht: dojo.amtsgericht || '',
        handelsregister_nr: dojo.handelsregister_nr || '',
        geschaeftsfuehrer: dojo.geschaeftsfuehrer || '',
        vorstand_1_vorsitzender: dojo.vorstand_1_vorsitzender || '',
        vorstand_2_vorsitzender: dojo.vorstand_2_vorsitzender || '',
        vorstand_kassenwart: dojo.vorstand_kassenwart || '',
        vorstand_schriftfuehrer: dojo.vorstand_schriftfuehrer || '',

        // Bank
        sepa_glaeubiger_id: dojo.sepa_glaeubiger_id || '',
        iban: dojo.iban || '',
        bic: dojo.bic || '',
        bank: dojo.bank || '',
        bank_inhaber: dojo.bank_inhaber || '',
        bank_verwendungszweck: dojo.bank_verwendungszweck || '',
        paypal_email: dojo.paypal_email || '',
        lastschrift_aktiv: dojo.lastschrift_aktiv ?? false,

        // Versicherungen
        haftpflicht_versicherung: dojo.haftpflicht_versicherung || '',
        haftpflicht_police_nr: dojo.haftpflicht_police_nr || '',
        haftpflicht_ablauf: dojo.haftpflicht_ablauf || '',
        unfallversicherung: dojo.unfallversicherung || '',
        unfallversicherung_police_nr: dojo.unfallversicherung_police_nr || '',
        gebaeudeversicherung: dojo.gebaeudeversicherung || '',

        // Verträge
        kuendigungsfrist_monate: dojo.kuendigungsfrist_monate || 3,
        mindestlaufzeit_monate: dojo.mindestlaufzeit_monate || 12,
        probezeit_tage: dojo.probezeit_tage || 14,

        // Vertragsbedingungen
        kuendigung_nur_monatsende: dojo.kuendigung_nur_monatsende ?? true,
        kuendigung_schriftlich: dojo.kuendigung_schriftlich ?? true,
        automatische_verlaengerung: dojo.automatische_verlaengerung ?? true,
        verlaengerung_monate: dojo.verlaengerung_monate || 12,
        kuendigung_erstlaufzeit_monate: dojo.kuendigung_erstlaufzeit_monate || 3,
        kuendigung_verlaengerung_monate: dojo.kuendigung_verlaengerung_monate || 1,

        // Preise
        beitrag_erwachsene: dojo.beitrag_erwachsene || '',
        beitrag_kinder: dojo.beitrag_kinder || '',
        beitrag_familien: dojo.beitrag_familien || '',
        aufnahmegebuehr: dojo.aufnahmegebuehr || '',
        mahnung_gebuehr: dojo.mahnung_gebuehr || 5.00,

        // Sport
        kampfkunst_stil: dojo.kampfkunst_stil || '',
        verband: dojo.verband || '',
        verband_mitgliedsnummer: dojo.verband_mitgliedsnummer || '',

        // Kontakte & Betrieb
        notfallkontakt_name: dojo.notfallkontakt_name || '',
        notfallkontakt_telefon: dojo.notfallkontakt_telefon || '',
        hausmeister_kontakt: dojo.hausmeister_kontakt || '',
        feiertage_geschlossen: dojo.feiertage_geschlossen ?? true,
        ferien_geschlossen: dojo.ferien_geschlossen ?? false,

        // Social Media
        facebook_url: dojo.facebook_url || '',
        instagram_url: dojo.instagram_url || '',
        youtube_url: dojo.youtube_url || '',
        twitter_url: dojo.twitter_url || '',
        google_maps_url: dojo.google_maps_url || '',
        newsletter_aktiv: dojo.newsletter_aktiv ?? false,

        // Rechtliche Dokumente
        agb_text: dojo.agb_text || '',
        dsgvo_text: dojo.dsgvo_text || '',
        dojo_regeln_text: dojo.dojo_regeln_text || '',
        hausordnung_text: dojo.hausordnung_text || '',
        haftungsausschluss_text: dojo.haftungsausschluss_text || '',
        widerrufsbelehrung_text: dojo.widerrufsbelehrung_text || '',
        impressum_text: dojo.impressum_text || '',
        vertragsbedingungen_text: dojo.vertragsbedingungen_text || '',

        // System
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

  // ===================================================================
  // API TOKEN HANDLERS
  // ===================================================================

  const loadApiToken = async () => {
    if (isNewDojo) return;

    try {
      const response = await fetch(`${config.apiBaseUrl}/dojos/${id}/api-token`);
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
      setMessage('⚠️ Bitte speichern Sie das Dojo zuerst, bevor Sie einen API-Token generieren.');
      return;
    }

    const confirmMsg = apiToken
      ? '⚠️ WARNUNG: Dies wird Ihren bestehenden API-Token ungültig machen!\n\nAlle TDA-Turniere, die den alten Token verwenden, müssen aktualisiert werden.\n\nMöchten Sie wirklich einen neuen Token generieren?'
      : 'Möchten Sie einen neuen API-Token generieren?';

    if (!window.confirm(confirmMsg)) return;

    setTokenLoading(true);

    try {
      const response = await fetch(`${config.apiBaseUrl}/dojos/${id}/generate-api-token`, {
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
      console.error('Error generating API token:', error);
      setMessage('❌ Fehler beim Generieren des Tokens: ' + error.message);
    } finally {
      setTokenLoading(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setMessage(`✅ ${label} kopiert!`);
    setTimeout(() => setMessage(''), 2000);
  };

  // Load API token when component mounts or id changes
  useEffect(() => {
    if (!isNewDojo && activeTab === 'api') {
      loadApiToken();
    }
  }, [id, isNewDojo, activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // 🔧 DEVELOPMENT MODE: Mock-Speichern
    const isDevelopment = import.meta.env.MODE === 'development';
    if (isDevelopment) {
      console.log('🔧 Development Mode: Speichere Dojo-Änderungen', formData);

      // Aktualisiere Mock-Daten im DojoContext
      if (!isNewDojo) {
        updateDojo(id, formData);
        console.log('✅ Dojo im Context aktualisiert');
      }

      setMessage(`✅ Dojo erfolgreich ${isNewDojo ? 'erstellt' : 'aktualisiert'}! (Mock-Modus)`);
      setLoading(false);

      return;
    }

    try {
      const url = isNewDojo ? `${config.apiBaseUrl}/dojos` : `${config.apiBaseUrl}/dojos/${id}`;
      const method = isNewDojo ? 'POST' : 'PUT';

      // Setze USt-Satz basierend auf Steuer-Status
      const dataToSend = {
        ...formData,
        ust_satz: formData.steuer_status === 'regelbesteuerung' ? 19 : 0,
        finanzamt: formData.finanzamt ? JSON.stringify(formData.finanzamt) : null
      };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Fehler beim Speichern');
      }

      setMessage(`Dojo erfolgreich ${isNewDojo ? 'erstellt' : 'aktualisiert'}!`);
      setTimeout(() => {
        navigate('/dashboard/dojos');
      }, 1500);
    } catch (error) {
      setMessage(`Fehler: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dojo-edit-page">
      {/* Header mit Zurück-Button - außerhalb des Layouts */}
      <div className="dojo-edit-header">
        <button className="back-button" onClick={() => navigate('/dashboard/dojos')}>
          <ArrowLeft size={20} />
          Zurück
        </button>
        <h1>{isNewDojo ? 'Neues Dojo hinzufügen' : 'Dojo bearbeiten'}</h1>
        {formData.dojoname && <span className="dojo-name-header">{formData.dojoname}</span>}
      </div>

      {message && (
        <div className={`message ${message.includes('Fehler') ? 'error' : 'success'}`}>
          {message.includes('Fehler') ? <AlertCircle size={20} /> : null}
          {message}
        </div>
      )}

      {/* Sidebar + Content Layout */}
      <div className="dojo-edit-layout">
        {/* Sidebar mit vertikalen Tabs */}
        <aside className={`dojo-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          {/* Toggle Button */}
          <button
            className="tab-vertical-btn sidebar-toggle-btn active"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? 'Sidebar öffnen' : 'Sidebar schließen'}
          >
            <span className="tab-icon">{sidebarCollapsed ? '»' : '«'}</span>
          </button>

          {/* Dojo Header */}
          <div className="mitglied-header">
            <div className="mitglied-avatar" style={{ fontSize: '2.5rem' }}>
              🏯
            </div>
            {!sidebarCollapsed && (
              <div className="mitglied-name">
                {formData.dojoname || 'Dojo-Einstellungen'}
              </div>
            )}
          </div>

          {/* Vertikale Tabs */}
          <nav className="tabs-vertical" aria-label="Dojo Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                className={`tab-vertical-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
                title={sidebarCollapsed ? tab.label : ''}
                type="button"
              >
                <span className="tab-icon">{tab.icon}</span>
                {!sidebarCollapsed && <span className="tab-label">{tab.label}</span>}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content Bereich */}
        <div className={`dojo-content ${sidebarCollapsed ? 'collapsed' : ''}`}>
          <form onSubmit={handleSubmit} className="dojo-form">
        <div className="form-content">
          {/* Grunddaten Tab */}
          {activeTab === 'grunddaten' && (
            <div className="form-section">
              <h3>Grunddaten</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Dojo-Name *</label>
                  <input
                    type="text"
                    value={formData.dojoname}
                    onChange={(e) => setFormData({ ...formData, dojoname: e.target.value })}
                    required
                    placeholder="z.B. Tiger & Dragon Dojo"
                  />
                </div>
                <div className="form-group">
                  <label>Untertitel</label>
                  <input
                    type="text"
                    value={formData.untertitel}
                    onChange={(e) => setFormData({ ...formData, untertitel: e.target.value })}
                    placeholder="z.B. Traditionelles Karate seit 1985"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Inhaber/Dojo-Leiter *</label>
                  <input
                    type="text"
                    value={formData.inhaber}
                    onChange={(e) => setFormData({ ...formData, inhaber: e.target.value })}
                    required
                    placeholder="Vor- und Nachname"
                  />
                </div>
                <div className="form-group">
                  <label>Stellvertreter</label>
                  <input
                    type="text"
                    value={formData.vertreter}
                    onChange={(e) => setFormData({ ...formData, vertreter: e.target.value })}
                    placeholder="2. Vorsitzender/Stellvertreter"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Gründungsjahr</label>
                  <input
                    type="number"
                    value={formData.gruendungsjahr}
                    onChange={(e) => setFormData({ ...formData, gruendungsjahr: e.target.value })}
                    placeholder="z.B. 1985"
                    min="1900"
                    max="2030"
                  />
                </div>
                <div className="form-group">
                  <label>Rechtsform</label>
                  <select
                    value={formData.rechtsform}
                    onChange={(e) => setFormData({ ...formData, rechtsform: e.target.value })}
                  >
                    <option value="Verein">Eingetragener Verein (e.V.)</option>
                    <option value="GmbH">GmbH</option>
                    <option value="Einzelunternehmen">Einzelunternehmen</option>
                    <option value="GbR">GbR</option>
                    <option value="UG">UG (haftungsbeschränkt)</option>
                    <option value="AG">AG</option>
                  </select>
                </div>
              </div>

              <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: '#ffd700' }}>Adresse</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Straße</label>
                  <input
                    type="text"
                    value={formData.strasse}
                    onChange={(e) => setFormData({ ...formData, strasse: e.target.value })}
                    placeholder="Straßenname"
                  />
                </div>
                <div className="form-group" style={{ maxWidth: '120px' }}>
                  <label>Hausnummer</label>
                  <input
                    type="text"
                    value={formData.hausnummer}
                    onChange={(e) => setFormData({ ...formData, hausnummer: e.target.value })}
                    placeholder="123a"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ maxWidth: '150px' }}>
                  <label>PLZ</label>
                  <input
                    type="text"
                    value={formData.plz}
                    onChange={(e) => setFormData({ ...formData, plz: e.target.value })}
                    placeholder="12345"
                  />
                </div>
                <div className="form-group">
                  <label>Ort</label>
                  <input
                    type="text"
                    value={formData.ort}
                    onChange={(e) => setFormData({ ...formData, ort: e.target.value })}
                    placeholder="Musterstadt"
                  />
                </div>
                <div className="form-group">
                  <label>Land</label>
                  <input
                    type="text"
                    value={formData.land}
                    onChange={(e) => setFormData({ ...formData, land: e.target.value })}
                    placeholder="Deutschland"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Kontakt Tab */}
          {activeTab === 'kontakt' && (
            <div className="form-section">
              <h3>Kontaktdaten</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Telefon (Festnetz)</label>
                  <input
                    type="tel"
                    value={formData.telefon}
                    onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                    placeholder="+49 123 456789"
                  />
                </div>
                <div className="form-group">
                  <label>Mobil</label>
                  <input
                    type="tel"
                    value={formData.mobil}
                    onChange={(e) => setFormData({ ...formData, mobil: e.target.value })}
                    placeholder="+49 170 1234567"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Fax</label>
                  <input
                    type="tel"
                    value={formData.fax}
                    onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                    placeholder="+49 123 456788"
                  />
                </div>
                <div className="form-group">
                  <label>WhatsApp Nummer</label>
                  <input
                    type="tel"
                    value={formData.whatsapp_nummer}
                    onChange={(e) => setFormData({ ...formData, whatsapp_nummer: e.target.value })}
                    placeholder="+49 170 1234567"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>E-Mail (Haupt)</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="kontakt@dojo.de"
                  />
                </div>
                <div className="form-group">
                  <label>E-Mail (Info)</label>
                  <input
                    type="email"
                    value={formData.email_info}
                    onChange={(e) => setFormData({ ...formData, email_info: e.target.value })}
                    placeholder="info@dojo.de"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>E-Mail (Anmeldungen)</label>
                  <input
                    type="email"
                    value={formData.email_anmeldung}
                    onChange={(e) => setFormData({ ...formData, email_anmeldung: e.target.value })}
                    placeholder="anmeldung@dojo.de"
                  />
                </div>
                <div className="form-group">
                  <label>Webseite</label>
                  <input
                    type="url"
                    value={formData.internet}
                    onChange={(e) => setFormData({ ...formData, internet: e.target.value })}
                    placeholder="https://www.dojo.de"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rechtliches Tab */}
          {activeTab === 'rechtliches' && (
            <div className="form-section">
              <h3>Rechtliche Informationen</h3>

              <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: '#ffd700' }}>Register & Behörden</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Vereinsregister-Nr.</label>
                  <input
                    type="text"
                    value={formData.vereinsregister_nr}
                    onChange={(e) => setFormData({ ...formData, vereinsregister_nr: e.target.value })}
                    placeholder="VR 12345"
                  />
                </div>
                <div className="form-group">
                  <label>Amtsgericht</label>
                  <input
                    type="text"
                    value={formData.amtsgericht}
                    onChange={(e) => setFormData({ ...formData, amtsgericht: e.target.value })}
                    placeholder="z.B. Amtsgericht München"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Handelsregister-Nr.</label>
                <input
                  type="text"
                  value={formData.handelsregister_nr}
                  onChange={(e) => setFormData({ ...formData, handelsregister_nr: e.target.value })}
                  placeholder="HRB 12345"
                />
              </div>

              <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: '#ffd700' }}>Vorstand (für Vereine)</h4>
              <div className="form-group">
                <label>1. Vorsitzender</label>
                <input
                  type="text"
                  value={formData.vorstand_1_vorsitzender}
                  onChange={(e) => setFormData({ ...formData, vorstand_1_vorsitzender: e.target.value })}
                  placeholder="Vor- und Nachname"
                />
              </div>

              <div className="form-group">
                <label>2. Vorsitzender</label>
                <input
                  type="text"
                  value={formData.vorstand_2_vorsitzender}
                  onChange={(e) => setFormData({ ...formData, vorstand_2_vorsitzender: e.target.value })}
                  placeholder="Vor- und Nachname"
                />
              </div>

              <div className="form-group">
                <label>Kassenwart</label>
                <input
                  type="text"
                  value={formData.vorstand_kassenwart}
                  onChange={(e) => setFormData({ ...formData, vorstand_kassenwart: e.target.value })}
                  placeholder="Vor- und Nachname"
                />
              </div>

              <div className="form-group">
                <label>Schriftführer</label>
                <input
                  type="text"
                  value={formData.vorstand_schriftfuehrer}
                  onChange={(e) => setFormData({ ...formData, vorstand_schriftfuehrer: e.target.value })}
                  placeholder="Vor- und Nachname"
                />
              </div>

              {formData.rechtsform !== 'Verein' && (
                <div className="form-group">
                  <label>Geschäftsführer</label>
                  <input
                    type="text"
                    value={formData.geschaeftsfuehrer}
                    onChange={(e) => setFormData({ ...formData, geschaeftsfuehrer: e.target.value })}
                    placeholder="Vor- und Nachname"
                  />
                </div>
              )}
            </div>
          )}

          {/* Versicherungen Tab */}
          {activeTab === 'versicherungen' && (
            <div className="form-section">
              <h3>Versicherungen</h3>

              <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: '#ffd700' }}>Haftpflichtversicherung</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Versicherungsgesellschaft</label>
                  <input
                    type="text"
                    value={formData.haftpflicht_versicherung}
                    onChange={(e) => setFormData({ ...formData, haftpflicht_versicherung: e.target.value })}
                    placeholder="z.B. ARAG Sportversicherung"
                  />
                </div>
                <div className="form-group">
                  <label>Policen-Nr.</label>
                  <input
                    type="text"
                    value={formData.haftpflicht_police_nr}
                    onChange={(e) => setFormData({ ...formData, haftpflicht_police_nr: e.target.value })}
                    placeholder="123456789"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Ablaufdatum</label>
                <input
                  type="date"
                  value={formData.haftpflicht_ablauf}
                  onChange={(e) => setFormData({ ...formData, haftpflicht_ablauf: e.target.value })}
                />
              </div>

              <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: '#ffd700' }}>Weitere Versicherungen</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Unfallversicherung</label>
                  <input
                    type="text"
                    value={formData.unfallversicherung}
                    onChange={(e) => setFormData({ ...formData, unfallversicherung: e.target.value })}
                    placeholder="Versicherungsgesellschaft"
                  />
                </div>
                <div className="form-group">
                  <label>Policen-Nr.</label>
                  <input
                    type="text"
                    value={formData.unfallversicherung_police_nr}
                    onChange={(e) => setFormData({ ...formData, unfallversicherung_police_nr: e.target.value })}
                    placeholder="123456789"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Gebäudeversicherung</label>
                <input
                  type="text"
                  value={formData.gebaeudeversicherung}
                  onChange={(e) => setFormData({ ...formData, gebaeudeversicherung: e.target.value })}
                  placeholder="Versicherung und Policen-Nr."
                />
              </div>
            </div>
          )}

          {/* Verträge Tab */}
          {activeTab === 'vertraege' && (
            <div className="form-section">
              <h3>Vertragseinstellungen</h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>
                Diese Einstellungen gelten als Standard für neue Mitgliedsverträge
              </p>

              <div className="form-row">
                <div className="form-group">
                  <label>Kündigungsfrist (Monate)</label>
                  <input
                    type="number"
                    value={formData.kuendigungsfrist_monate}
                    onChange={(e) => setFormData({ ...formData, kuendigungsfrist_monate: parseInt(e.target.value) })}
                    min="0"
                    max="12"
                    placeholder="z.B. 3"
                  />
                </div>
                <div className="form-group">
                  <label>Mindestlaufzeit (Monate)</label>
                  <input
                    type="number"
                    value={formData.mindestlaufzeit_monate}
                    onChange={(e) => setFormData({ ...formData, mindestlaufzeit_monate: parseInt(e.target.value) })}
                    min="0"
                    max="24"
                    placeholder="z.B. 12"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Probezeit (Tage)</label>
                <input
                  type="number"
                  value={formData.probezeit_tage}
                  onChange={(e) => setFormData({ ...formData, probezeit_tage: parseInt(e.target.value) })}
                  min="0"
                  max="90"
                  placeholder="z.B. 14"
                />
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
                  Während der Probezeit kann der Vertrag jederzeit gekündigt werden
                </p>
              </div>

              <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: '#ffd700' }}>Kündigungsbedingungen</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Kündigung Erstlaufzeit (Monate vorher)</label>
                  <input
                    type="number"
                    value={formData.kuendigung_erstlaufzeit_monate}
                    onChange={(e) => setFormData({ ...formData, kuendigung_erstlaufzeit_monate: parseInt(e.target.value) })}
                    min="0"
                    max="12"
                    placeholder="z.B. 3"
                  />
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
                    Kündigungsfrist vor Ende der ersten Vertragslaufzeit
                  </p>
                </div>
                <div className="form-group">
                  <label>Kündigung Verlängerung (Monate vorher)</label>
                  <input
                    type="number"
                    value={formData.kuendigung_verlaengerung_monate}
                    onChange={(e) => setFormData({ ...formData, kuendigung_verlaengerung_monate: parseInt(e.target.value) })}
                    min="0"
                    max="12"
                    placeholder="z.B. 1"
                  />
                  <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
                    Kündigungsfrist vor automatischer Verlängerung
                  </p>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.kuendigung_nur_monatsende}
                      onChange={(e) => setFormData({ ...formData, kuendigung_nur_monatsende: e.target.checked })}
                    />
                    <span>Kündigung nur zum Monatsende</span>
                  </label>
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.kuendigung_schriftlich}
                      onChange={(e) => setFormData({ ...formData, kuendigung_schriftlich: e.target.checked })}
                    />
                    <span>Kündigung muss schriftlich erfolgen</span>
                  </label>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.automatische_verlaengerung}
                      onChange={(e) => setFormData({ ...formData, automatische_verlaengerung: e.target.checked })}
                    />
                    <span>Automatische Verlängerung nach Erstlaufzeit</span>
                  </label>
                </div>
                {formData.automatische_verlaengerung && (
                  <div className="form-group">
                    <label>Verlängerung um (Monate)</label>
                    <input
                      type="number"
                      value={formData.verlaengerung_monate}
                      onChange={(e) => setFormData({ ...formData, verlaengerung_monate: parseInt(e.target.value) })}
                      min="1"
                      max="24"
                      placeholder="z.B. 12"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sport Tab */}
          {activeTab === 'sport' && (
            <div className="form-section">
              <h3>Sport & Verband</h3>

              <div className="form-group">
                <label>Kampfkunst-Stil</label>
                <input
                  type="text"
                  value={formData.kampfkunst_stil}
                  onChange={(e) => setFormData({ ...formData, kampfkunst_stil: e.target.value })}
                  placeholder="z.B. Shotokan Karate, Taekwondo, Jiu-Jitsu"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Verband</label>
                  <input
                    type="text"
                    value={formData.verband}
                    onChange={(e) => setFormData({ ...formData, verband: e.target.value })}
                    placeholder="z.B. DKV, DOSB, DTB"
                  />
                </div>
                <div className="form-group">
                  <label>Verbands-Mitgliedsnummer</label>
                  <input
                    type="text"
                    value={formData.verband_mitgliedsnummer}
                    onChange={(e) => setFormData({ ...formData, verband_mitgliedsnummer: e.target.value })}
                    placeholder="123456"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Social Media Tab */}
          {activeTab === 'social' && (
            <div className="form-section">
              <h3>Social Media & Online-Präsenz</h3>

              <div className="form-group">
                <label>Facebook URL</label>
                <input
                  type="url"
                  value={formData.facebook_url}
                  onChange={(e) => setFormData({ ...formData, facebook_url: e.target.value })}
                  placeholder="https://facebook.com/ihr-dojo"
                />
              </div>

              <div className="form-group">
                <label>Instagram URL</label>
                <input
                  type="url"
                  value={formData.instagram_url}
                  onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
                  placeholder="https://instagram.com/ihr-dojo"
                />
              </div>

              <div className="form-group">
                <label>YouTube URL</label>
                <input
                  type="url"
                  value={formData.youtube_url}
                  onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                  placeholder="https://youtube.com/@ihr-dojo"
                />
              </div>

              <div className="form-group">
                <label>Twitter/X URL</label>
                <input
                  type="url"
                  value={formData.twitter_url}
                  onChange={(e) => setFormData({ ...formData, twitter_url: e.target.value })}
                  placeholder="https://twitter.com/ihr-dojo"
                />
              </div>

              <div className="form-group">
                <label>Google Maps URL</label>
                <input
                  type="url"
                  value={formData.google_maps_url}
                  onChange={(e) => setFormData({ ...formData, google_maps_url: e.target.value })}
                  placeholder="https://maps.google.com/?cid=..."
                />
                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem' }}>
                  Link zu Ihrem Google Maps Eintrag für Standort-Anzeige
                </p>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.newsletter_aktiv}
                    onChange={(e) => setFormData({ ...formData, newsletter_aktiv: e.target.checked })}
                  />
                  <span>Newsletter-Funktion aktiv</span>
                </label>
              </div>
            </div>
          )}

          {/* Betrieb & Kontakte Tab */}
          {activeTab === 'betrieb' && (
            <div className="form-section">
              <h3>Betrieb & Kontakte</h3>

              <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: '#ffd700' }}>Notfallkontakte</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Notfallkontakt Name</label>
                  <input
                    type="text"
                    value={formData.notfallkontakt_name}
                    onChange={(e) => setFormData({ ...formData, notfallkontakt_name: e.target.value })}
                    placeholder="Vor- und Nachname"
                  />
                </div>
                <div className="form-group">
                  <label>Notfallkontakt Telefon</label>
                  <input
                    type="tel"
                    value={formData.notfallkontakt_telefon}
                    onChange={(e) => setFormData({ ...formData, notfallkontakt_telefon: e.target.value })}
                    placeholder="+49 170 1234567"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Hausmeister Kontakt</label>
                <input
                  type="text"
                  value={formData.hausmeister_kontakt}
                  onChange={(e) => setFormData({ ...formData, hausmeister_kontakt: e.target.value })}
                  placeholder="Name und Telefon des Hausmeisters"
                />
              </div>

              <h4 style={{ marginTop: '1.5rem', marginBottom: '1rem', color: '#ffd700' }}>Betriebszeiten</h4>
              <div className="form-row">
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.feiertage_geschlossen}
                      onChange={(e) => setFormData({ ...formData, feiertage_geschlossen: e.target.checked })}
                    />
                    <span>An Feiertagen geschlossen</span>
                  </label>
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.ferien_geschlossen}
                      onChange={(e) => setFormData({ ...formData, ferien_geschlossen: e.target.checked })}
                    />
                    <span>In den Schulferien geschlossen</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Dokumente Tab */}
          {activeTab === 'dokumente' && (
            <div className="form-section">
              <h3>Rechtliche Dokumente</h3>

              {/* Info-Box über neue Dokumentenverwaltung */}
              <div style={{
                background: 'linear-gradient(135deg, #DBEAFE 0%, #BFDBFE 100%)',
                border: '2px solid #3B82F6',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '2rem',
                boxShadow: '0 4px 6px rgba(59, 130, 246, 0.1)'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ fontSize: '2rem' }}>ℹ️</div>
                  <div>
                    <h4 style={{
                      margin: '0 0 0.5rem 0',
                      color: '#1E3A8A',
                      fontSize: '1.1rem',
                      fontWeight: '700'
                    }}>
                      Versionierte Dokumentenverwaltung
                    </h4>
                    <p style={{
                      margin: '0 0 0.75rem 0',
                      color: '#1E40AF',
                      fontSize: '0.95rem',
                      lineHeight: '1.6'
                    }}>
                      Ihre rechtlichen Dokumente (AGB, Datenschutzerklärung) werden jetzt <strong>versioniert</strong> in der Datenbank gespeichert.
                      Dies ermöglicht:
                    </p>
                    <ul style={{
                      margin: '0',
                      paddingLeft: '1.5rem',
                      color: '#1E40AF',
                      fontSize: '0.9rem',
                      lineHeight: '1.6'
                    }}>
                      <li>Automatische Versionsverwaltung (z.B. Version 1.0, 1.1, 2.0)</li>
                      <li>Zeitstempel für jede Dokumentenänderung</li>
                      <li>Nachvollziehbarkeit: Welche AGB-Version wurde bei Vertragsabschluss akzeptiert?</li>
                      <li>Gültigkeit von/bis Datum für jede Version</li>
                    </ul>
                    <p style={{
                      margin: '1rem 0 0 0',
                      color: '#1E40AF',
                      fontSize: '0.85rem',
                      fontStyle: 'italic'
                    }}>
                      💡 <strong>Hinweis:</strong> Standard-Dokumente (AGB v1.0, Datenschutz v1.0) wurden bereits automatisch für Ihr Dojo erstellt.
                      Die Dokumente werden beim Vertragsabschluss automatisch mit Zeitstempel erfasst.
                    </p>
                  </div>
                </div>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>
                Hinterlegen Sie hier die rechtlichen Texte für Ihr Dojo (einfache Textverwaltung)
              </p>

              <div className="form-group">
                <label>AGB (Allgemeine Geschäftsbedingungen)</label>
                <textarea
                  value={formData.agb_text}
                  onChange={(e) => setFormData({ ...formData, agb_text: e.target.value })}
                  rows="6"
                  placeholder="Ihre AGB..."
                />
              </div>

              <div className="form-group">
                <label>DSGVO / Datenschutzerklärung</label>
                <textarea
                  value={formData.dsgvo_text}
                  onChange={(e) => setFormData({ ...formData, dsgvo_text: e.target.value })}
                  rows="6"
                  placeholder="Ihre Datenschutzerklärung..."
                />
              </div>

              <div className="form-group">
                <label>Dojo-Regeln</label>
                <textarea
                  value={formData.dojo_regeln_text}
                  onChange={(e) => setFormData({ ...formData, dojo_regeln_text: e.target.value })}
                  rows="6"
                  placeholder="Ihre Dojo-Regeln (Etikette, Verhaltensregeln, etc.)..."
                />
              </div>

              <div className="form-group">
                <label>Hausordnung</label>
                <textarea
                  value={formData.hausordnung_text}
                  onChange={(e) => setFormData({ ...formData, hausordnung_text: e.target.value })}
                  rows="6"
                  placeholder="Ihre Hausordnung..."
                />
              </div>

              <div className="form-group">
                <label>Haftungsausschluss</label>
                <textarea
                  value={formData.haftungsausschluss_text}
                  onChange={(e) => setFormData({ ...formData, haftungsausschluss_text: e.target.value })}
                  rows="6"
                  placeholder="Ihr Haftungsausschluss..."
                />
              </div>

              <div className="form-group">
                <label>Widerrufsbelehrung</label>
                <textarea
                  value={formData.widerrufsbelehrung_text}
                  onChange={(e) => setFormData({ ...formData, widerrufsbelehrung_text: e.target.value })}
                  rows="6"
                  placeholder="Ihre Widerrufsbelehrung..."
                />
              </div>

              <div className="form-group">
                <label>Impressum</label>
                <textarea
                  value={formData.impressum_text}
                  onChange={(e) => setFormData({ ...formData, impressum_text: e.target.value })}
                  rows="6"
                  placeholder="Ihr Impressum..."
                />
              </div>

              <div className="form-group">
                <label>Vertragsbedingungen</label>
                <textarea
                  value={formData.vertragsbedingungen_text}
                  onChange={(e) => setFormData({ ...formData, vertragsbedingungen_text: e.target.value })}
                  rows="6"
                  placeholder="Ihre Vertragsbedingungen..."
                />
              </div>
            </div>
          )}

          {/* Steuer-Einstellungen Tab */}
          {activeTab === 'steuer' && (
            <div className="form-section">
              <h3>Steuereinstellungen</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Steuerstatus</label>
                  <select
                    value={formData.steuer_status}
                    onChange={(e) => setFormData({
                      ...formData,
                      steuer_status: e.target.value,
                      ust_satz: e.target.value === 'regelbesteuerung' ? 19 : 0
                    })}
                  >
                    <option value="kleinunternehmer">Kleinunternehmer (Paragraph 19 UStG)</option>
                    <option value="regelbesteuerung">Regelbesteuerung (19% USt)</option>
                  </select>
                </div>
                {formData.steuer_status === 'kleinunternehmer' && (
                  <div className="form-group">
                    <label>Kleinunternehmer-Grenze (EUR)</label>
                    <input
                      type="number"
                      value={formData.kleinunternehmer_grenze}
                      onChange={(e) => setFormData({ ...formData, kleinunternehmer_grenze: parseFloat(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Finanzamt</label>
                  <FinanzamtSelector
                    value={formData.finanzamt}
                    onChange={(finanzamt) => setFormData({
                      ...formData,
                      finanzamt: finanzamt,
                      finanzamt_name: finanzamt ? `${finanzamt.name}, ${finanzamt.ort}` : ''
                    })}
                    placeholder="Finanzamt suchen..."
                  />
                </div>
                <div className="form-group">
                  <label>Steuernummer</label>
                  <input
                    type="text"
                    value={formData.steuernummer}
                    onChange={(e) => setFormData({ ...formData, steuernummer: e.target.value })}
                  />
                </div>
              </div>

              {formData.steuer_status === 'regelbesteuerung' && (
                <div className="form-group">
                  <label>USt-IdNr.</label>
                  <input
                    type="text"
                    value={formData.ust_id}
                    onChange={(e) => setFormData({ ...formData, ust_id: e.target.value })}
                    placeholder="DE123456789"
                  />
                </div>
              )}
            </div>
          )}

          {/* Bankverbindung Tab */}
          {activeTab === 'bank' && !isNewDojo && (
            <BankTabs dojoId={id} />
          )}
          
          {activeTab === 'bank' && isNewDojo && (
            <div className="form-section">
              <div style={{ 
                padding: '40px', 
                textAlign: 'center', 
                color: 'rgba(255, 255, 255, 0.6)',
                background: 'rgba(255, 215, 0, 0.05)',
                borderRadius: '12px',
                border: '1px dashed rgba(255, 215, 0, 0.3)'
              }}>
                <AlertCircle size={48} style={{ marginBottom: '16px', color: '#ffd700' }} />
                <h3 style={{ color: '#ffd700', marginBottom: '8px' }}>Dojo zuerst speichern</h3>
                <p>Bankverbindungen können nach dem Erstellen des Dojos hinzugefügt werden.</p>
              </div>
            </div>
          )}

          {/* Logos Tab */}
          {activeTab === 'logos' && (
            <div className="form-section" style={{ padding: 0, background: 'transparent' }}>
              <DojoLogos dojoId={id} />
            </div>
          )}

          {/* Admin-Accounts Tab */}
          {activeTab === 'admins' && (
            <div className="form-section" style={{ padding: 0, background: 'transparent' }}>
              <AdminVerwaltung />
            </div>
          )}

          {/* API-Zugang Tab */}
          {activeTab === 'api' && (
            <div className="form-section">
              <h3>🔗 API-Token für TDA-Turnierverwaltung</h3>

              <div className="api-info-box" style={{
                background: 'rgba(255, 215, 0, 0.1)',
                border: '2px solid #ffd700',
                borderRadius: '8px',
                padding: '1.5rem',
                marginBottom: '2rem'
              }}>
                <p style={{ margin: 0, lineHeight: '1.6', color: '#e0e0e0' }}>
                  <strong style={{ color: '#ffd700' }}>ℹ️ Sicherer API-Zugang</strong><br />
                  Jedes Dojo hat einen eindeutigen API-Token für die sichere Verbindung zur TDA-Turnierverwaltung.
                  Dieser Token ermöglicht den automatischen Import Ihrer Mitglieder.
                </p>
              </div>

              {/* API Base URL */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🌐 API Base URL</span>
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    value={window.location.origin + '/api'}
                    readOnly
                    style={{
                      flex: 1,
                      background: 'rgba(255, 255, 255, 0.05)',
                      cursor: 'text'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(window.location.origin + '/api', 'API URL')}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#ffd700',
                      color: '#000',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    📋 Kopieren
                  </button>
                </div>
                <small style={{ color: '#999', display: 'block', marginTop: '0.5rem' }}>
                  Diese URL verwenden Sie im Schritt 2 der TDA-Registrierung
                </small>
              </div>

              {/* API Token Section */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span>🔑 API-Token</span>
                  {apiToken && (
                    <span style={{
                      background: '#2ed573',
                      color: '#fff',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}>
                      ✓ Aktiv
                    </span>
                  )}
                </label>

                {apiToken ? (
                  <>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                      <input
                        type="text"
                        value={apiToken}
                        readOnly
                        style={{
                          flex: 1,
                          background: 'rgba(46, 213, 115, 0.1)',
                          border: '2px solid #2ed573',
                          cursor: 'text',
                          fontFamily: 'monospace',
                          fontSize: '0.9rem'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => copyToClipboard(apiToken, 'API-Token')}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#2ed573',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                      >
                        📋 Kopieren
                      </button>
                    </div>

                    {/* Token Metadata */}
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      padding: '1rem',
                      borderRadius: '8px',
                      marginBottom: '1rem'
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.9rem' }}>
                        <div>
                          <strong style={{ color: '#ffd700' }}>Erstellt am:</strong>
                          <div style={{ color: '#e0e0e0', marginTop: '0.25rem' }}>
                            {apiTokenCreatedAt ? new Date(apiTokenCreatedAt).toLocaleString('de-DE') : 'N/A'}
                          </div>
                        </div>
                        <div>
                          <strong style={{ color: '#ffd700' }}>Zuletzt verwendet:</strong>
                          <div style={{ color: '#e0e0e0', marginTop: '0.25rem' }}>
                            {apiTokenLastUsed ? new Date(apiTokenLastUsed).toLocaleString('de-DE') : 'Noch nie'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Regenerate Button */}
                    <button
                      type="button"
                      onClick={generateApiToken}
                      disabled={tokenLoading}
                      style={{
                        padding: '0.75rem 1.5rem',
                        background: 'rgba(239, 68, 68, 0.8)',
                        color: '#fff',
                        border: '2px solid #ef4444',
                        borderRadius: '8px',
                        cursor: tokenLoading ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        opacity: tokenLoading ? 0.6 : 1
                      }}
                    >
                      {tokenLoading ? '⏳ Generiere...' : '🔄 Token regenerieren'}
                    </button>
                    <small style={{ color: '#ff6b6b', display: 'block', marginTop: '0.5rem' }}>
                      ⚠️ Warnung: Das Regenerieren macht den alten Token ungültig!
                    </small>
                  </>
                ) : (
                  <>
                    <div style={{
                      background: 'rgba(255, 107, 53, 0.1)',
                      border: '2px dashed #ff6b35',
                      borderRadius: '8px',
                      padding: '2rem',
                      textAlign: 'center',
                      marginBottom: '1rem'
                    }}>
                      <p style={{ color: '#e0e0e0', marginBottom: '1rem' }}>
                        <strong>Kein API-Token vorhanden</strong><br />
                        Generieren Sie einen Token, um die TDA-Integration zu nutzen.
                      </p>
                      <button
                        type="button"
                        onClick={generateApiToken}
                        disabled={tokenLoading || isNewDojo}
                        style={{
                          padding: '0.75rem 2rem',
                          background: 'linear-gradient(135deg, #ff6b35 0%, #f7931e 100%)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '8px',
                          cursor: (tokenLoading || isNewDojo) ? 'not-allowed' : 'pointer',
                          fontWeight: 'bold',
                          fontSize: '1rem',
                          opacity: (tokenLoading || isNewDojo) ? 0.6 : 1
                        }}
                      >
                        {tokenLoading ? '⏳ Generiere...' : '🔑 API-Token generieren'}
                      </button>
                      {isNewDojo && (
                        <small style={{ color: '#ff6b35', display: 'block', marginTop: '0.75rem' }}>
                          Bitte speichern Sie das Dojo zuerst
                        </small>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Instructions */}
              <div className="api-instructions" style={{
                background: 'rgba(59, 130, 246, 0.1)',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                padding: '1.5rem',
                marginTop: '2rem'
              }}>
                <h4 style={{ color: '#3b82f6', marginBottom: '1rem' }}>📝 So verwenden Sie den API-Token:</h4>
                <ol style={{ marginLeft: '1.5rem', lineHeight: '1.8', color: '#e0e0e0' }}>
                  <li>Generieren Sie einen API-Token (falls noch nicht vorhanden)</li>
                  <li>Öffnen Sie die TDA-Turnierverwaltung Registrierung</li>
                  <li>Geben Sie im <strong>Schritt 2</strong> folgende Daten ein:
                    <ul style={{ marginTop: '0.5rem', marginLeft: '1rem' }}>
                      <li><strong>API-URL:</strong> {window.location.origin}/api</li>
                      <li><strong>API-Token:</strong> Ihr generierter Token (kopieren Sie ihn mit dem Button)</li>
                    </ul>
                  </li>
                  <li>Klicken Sie auf "Verbindung testen"</li>
                  <li>Wählen Sie Ihre Dojos aus, die Sie synchronisieren möchten</li>
                  <li>Schließen Sie die Registrierung ab</li>
                </ol>
              </div>

              {/* Security Note */}
              <div className="api-security-note" style={{
                background: 'rgba(239, 68, 68, 0.1)',
                border: '2px solid #ef4444',
                borderRadius: '8px',
                padding: '1rem',
                marginTop: '1.5rem'
              }}>
                <p style={{ margin: 0, lineHeight: '1.6', color: '#e0e0e0' }}>
                  <strong style={{ color: '#ef4444' }}>🔒 Sicherheitshinweise:</strong><br />
                  • Jedes Dojo hat einen eindeutigen, sicheren Token<br />
                  • Geben Sie Ihren Token niemals an Dritte weiter<br />
                  • Bei Verdacht auf Kompromittierung: Token sofort regenerieren<br />
                  • Der alte Token wird ungültig, sobald Sie einen neuen generieren
                </p>
              </div>
            </div>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div className="form-section">
              <h3>System-Einstellungen</h3>

              <div className="form-row">
                <div className="form-group">
                  <label>Sprache</label>
                  <select
                    value={formData.sprache}
                    onChange={(e) => setFormData({ ...formData, sprache: e.target.value })}
                  >
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Zeitzone</label>
                  <select
                    value={formData.zeitzone}
                    onChange={(e) => setFormData({ ...formData, zeitzone: e.target.value })}
                  >
                    <option value="Europe/Berlin">Europa/Berlin</option>
                    <option value="Europe/Vienna">Europa/Wien</option>
                    <option value="Europe/Zurich">Europa/Zürich</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Währung</label>
                  <select
                    value={formData.waehrung}
                    onChange={(e) => setFormData({ ...formData, waehrung: e.target.value })}
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Max. Mitglieder</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={formData.max_mitglieder}
                    onChange={(e) => setFormData({ ...formData, max_mitglieder: parseInt(e.target.value) })}
                    placeholder="500"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>DSGVO-Beauftragter</label>
                <input
                  type="text"
                  value={formData.dsgvo_beauftragte}
                  onChange={(e) => setFormData({ ...formData, dsgvo_beauftragte: e.target.value })}
                  placeholder="Name des Datenschutzbeauftragten"
                />
              </div>
            </div>
          )}

          {/* Design Tab */}
          {activeTab === 'design' && (
            <div className="form-section">
              <h3>Design & Kennzeichnung</h3>
              <div className="form-group">
                <label>Dojo-Farbe</label>
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem' }}>
                  Diese Farbe wird zur visuellen Kennzeichnung des Dojos verwendet (z.B. im Switcher, Dashboards, etc.)
                </p>
                <div className="color-picker-wrapper">
                  <input
                    type="color"
                    value={formData.farbe}
                    onChange={(e) => setFormData({ ...formData, farbe: e.target.value })}
                  />
                  <div className="color-preview" style={{ backgroundColor: formData.farbe }}>
                    <span>{formData.farbe}</span>
                  </div>
                </div>
              </div>
              <div className="color-suggestions">
                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.5rem' }}>Vorschläge:</p>
                <div className="color-buttons">
                  {['#FFD700', '#FF6B35', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map(color => (
                    <button
                      key={color}
                      type="button"
                      className="color-button"
                      style={{ backgroundColor: color }}
                      onClick={() => setFormData({ ...formData, farbe: color })}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

            <div className="form-actions-sticky">
              <button type="button" className="btn-secondary" onClick={() => navigate('/dashboard/dojos')}>
                Abbrechen
              </button>
              <button type="submit" className="btn-primary" disabled={loading}>
                <Save size={20} />
                {loading ? 'Speichern...' : 'Speichern'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default DojoEdit;
