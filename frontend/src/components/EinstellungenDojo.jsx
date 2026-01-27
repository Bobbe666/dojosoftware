import React, { useState, useEffect } from "react";
import { Save, X, Edit3, Building, CreditCard, Shield, Globe, Settings, Award, Clock, FileText, FileSignature, Palette, MapPin, BookOpen, UserCog } from "lucide-react";
import RaumVerwaltung from "./RaumVerwaltung";
import FinanzamtSelector from "./FinanzamtSelector";
import AdminVerwaltung from "./AdminVerwaltung";
import "../styles/EinstellungenDojo.css";
import "../styles/designsystem.css";
import "../styles/themes.css";
import "../styles/components.css";
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import { useTheme, THEMES } from '../context/ThemeContext';


const EinstellungenDojo = () => {
  // Theme-Context nutzen
  const { theme, setTheme, currentTheme, themes: contextThemes, isDarkMode } = useTheme();

  const [dojo, setDojo] = useState({
    // Grunddaten (bestehend)
    dojoname: "",
    inhaber: "",
    strasse: "",
    hausnummer: "",
    plz: "",
    ort: "",
    telefon: "",
    mobil: "",
    email: "",
    internet: "",
    
    // Erweiterte Grunddaten
    untertitel: "",
    vertreter: "",
    gruendungsjahr: "",
    land: "Deutschland",
    
    // Kontakt erweitert
    fax: "",
    email_info: "",
    email_anmeldung: "",
    whatsapp_nummer: "",
    
    // Steuerliches
    steuernummer: "",
    umsatzsteuer_id: "",
    finanzamt: null, // Jetzt ein Objekt statt String
    steuerberater: "",
    steuerberater_telefon: "",
    umsatzsteuerpflichtig: false,
    kleinunternehmer: false,
    gemeinnuetzig: false,
    freistellungsbescheid_datum: "",
    
    // Rechtliches
    rechtsform: "Verein",
    vereinsregister_nr: "",
    amtsgericht: "",
    handelsregister_nr: "",
    geschaeftsfuehrer: "",
    vorstand_1_vorsitzender: "",
    vorstand_2_vorsitzender: "",
    vorstand_kassenwart: "",
    vorstand_schriftfuehrer: "",
    
    // Bank
    bank_name: "",
    bank_iban: "",
    bank_bic: "",
    bank_inhaber: "",
    bank_verwendungszweck: "",
    sepa_glaeubiger_id: "",
    paypal_email: "",
    lastschrift_aktiv: false,
    
    // Versicherungen
    haftpflicht_versicherung: "",
    haftpflicht_police_nr: "",
    haftpflicht_ablauf: "",
    unfallversicherung: "",
    unfallversicherung_police_nr: "",
    gebaeudeversicherung: "",
    
    // Verträge
    kuendigungsfrist_monate: 3,
    mindestlaufzeit_monate: 12,
    probezeit_tage: 14,
    
    // Vertragslaufzeiten und Preise
    vertrag_3_monate_preis: "",
    vertrag_6_monate_preis: "",
    vertrag_12_monate_preis: "",
    vertrag_3_monate_aktiv: true,
    vertrag_6_monate_aktiv: true,
    vertrag_12_monate_aktiv: true,
    
    // Zusätzliche Vertragsoptionen
    jahresbeitrag: "",
    familienrabatt_prozent: "",
    schuelerrabatt_prozent: "",
    vereinsmitglied_rabatt_prozent: "",
    mehrfachtraining_rabatt_prozent: "",
    
    // Vertragsbedingungen (nach deutschem Recht)
    kuendigung_nur_monatsende: true,
    kuendigung_schriftlich: true,
    automatische_verlaengerung: true,
    verlaengerung_monate: 12,
    kuendigung_erstlaufzeit_monate: 3, // 3 Monate vor Ende der ersten Laufzeit
    kuendigung_verlaengerung_monate: 1, // 1 Monat vor automatischer Verlängerung

    // Vertragsmodell-Auswahl
    vertragsmodell: 'gesetzlich', // 'gesetzlich' oder 'beitragsgarantie'
    beitragsgarantie_bei_nichtverlaengerung: 'aktueller_tarif', // 'aktueller_tarif' oder 'vertrag_endet'
    verlaengerung_erinnerung_tage: 60,
    verlaengerung_erinnerung2_tage: 30,
    verlaengerung_erinnerung3_tage: 14,
    verlaengerung_email_text: '',

    // Kontakte
    notfallkontakt_name: "",
    notfallkontakt_telefon: "",
    hausmeister_kontakt: "",
    feiertage_geschlossen: true,
    ferien_geschlossen: false,
    
    // Social Media
    facebook_url: "",
    instagram_url: "",
    youtube_url: "",
    twitter_url: "",
    newsletter_aktiv: false,
    google_maps_url: "",
    
    // Sport
    kampfkunst_stil: "",
    verband: "",
    verband_mitgliedsnummer: "",
    lizenz_trainer_a: 0,
    lizenz_trainer_b: 0,
    lizenz_trainer_c: 0,
    
    // Preise
    beitrag_erwachsene: "",
    beitrag_kinder: "",
    beitrag_familien: "",
    aufnahmegebuehr: "",
    kaution: "",
    mahnung_gebuehr: 5.00,
    rueckbuchung_gebuehr: 10.00,
    
    // System
    logo_url: "",
    theme_farbe: "#8B0000",
    theme_scheme: "default",
    sprache: "de",
    zeitzone: "Europe/Berlin",
    waehrung: "EUR",
    dsgvo_beauftragte: "",
    max_mitglieder: 500,

    // Rechtliches & Regeln
    agb_text: "",
    dsgvo_text: "",
    dojo_regeln_text: "",
    hausordnung_text: "",
    haftungsausschluss_text: "",
    widerrufsbelehrung_text: "",
    impressum_text: "",
    vertragsbedingungen_text: ""
  });

  const [activeTab, setActiveTab] = useState("grunddaten");
  const [activeRechtlichesTab, setActiveRechtlichesTab] = useState("agb");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  // Theme-Konfiguration aus Context (THEMES wird von ThemeContext importiert)
  const themes = Object.values(contextThemes);

  // Tab-Konfiguration
  const tabs = [
    { id: "grunddaten", label: "Grunddaten", icon: Building, color: "#8B0000" },
    { id: "kontakt", label: "Kontakt & Adresse", icon: Globe, color: "#10B981" },
    { id: "raeume", label: "Räume", icon: MapPin, color: "#7C3AED" },
    { id: "steuer", label: "Steuern & Recht", icon: FileText, color: "#F59E0B" },
    { id: "bank", label: "Bankdaten", icon: CreditCard, color: "#8B5CF6" },
    { id: "versicherung", label: "Versicherungen", icon: Shield, color: "#EF4444" },
    { id: "vertraege", label: "Vertragsmodell", icon: FileSignature, color: "#14B8A6" },
    { id: "sport", label: "Sport & Verband", icon: Award, color: "#06B6D4" },
    { id: "rechtliches", label: "Rechtliches & Regeln", icon: BookOpen, color: "#DC2626" },
    { id: "zeiten", label: "Öffnungszeiten", icon: Clock, color: "#84CC16" },
    { id: "admins", label: "Admin-Accounts", icon: UserCog, color: "#DC2626" },
    { id: "system", label: "System", icon: Settings, color: "#6B7280" }
  ];

  // Daten laden (Theme wird jetzt vom ThemeContext verwaltet)
  useEffect(() => {
    loadDojoData();
  }, []);

  // Theme wechseln (nutzt jetzt ThemeContext)
  const handleThemeChange = (themeId) => {
    setTheme(themeId);
    setShowThemeSelector(false);
    const themeName = contextThemes[themeId]?.name || themeId;
    setMessage(`✅ Theme zu "${themeName}" geändert!`);
    setTimeout(() => setMessage(""), 3000);
  };

  const loadDojoData = async () => {
    setLoading(true);
    setMessage("");
    
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/dojo`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Finanzamt-Objekt parsen falls vorhanden
      if (data.finanzamt && typeof data.finanzamt === 'string') {
        try {
          data.finanzamt = JSON.parse(data.finanzamt);
        } catch (e) {
          console.warn('Fehler beim Parsen des Finanzamt-Objekts:', e);
          data.finanzamt = null;
        }
      }

      // State mit geladenen Daten aktualisieren (mit Fallbacks)
      setDojo(prev => ({
        ...prev,  // Standardwerte beibehalten
        ...data   // Geladene Daten überschreiben
      }));
      
    } catch (err) {
      setMessage(`⚠️ Laden fehlgeschlagen: ${err.message}`);
      
    } finally {
      setLoading(false);
    }
  };

  // Eingaben aktualisieren
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setDojo(prev => ({
      ...prev,
      [name]: newValue
    }));
  };

  // Bearbeiten-Modus starten
  const handleEdit = () => {
    setIsEditing(true);
    setMessage("");
  };

  // Bearbeiten abbrechen
  const handleCancel = () => {
    setIsEditing(false);
    setMessage("");
    loadDojoData(); // Originaldaten neu laden
  };

  // Speichern
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Finanzamt-Objekt für Backend vorbereiten
      const dojoData = {
        ...dojo,
        finanzamt: dojo.finanzamt ? JSON.stringify(dojo.finanzamt) : null
      };

      const response = await fetchWithAuth(`${config.apiBaseUrl}/dojo`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dojoData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Server Error: ${errorData.error}`);
      }

      const serverResponse = await response.json();
      
      // State komplett neu setzen, nicht nur mergen
      setDojo({
        ...dojo,  // Alle bestehenden Werte
        ...serverResponse  // Server-Daten überschreiben
      });
      
      // Erfolgs-Message sofort anzeigen
      setMessage("✅ Erfolgreich gespeichert!");
      
      // Edit-Modus sofort beenden, damit User die gespeicherten Werte sieht
      setIsEditing(false);
      
      // Message nach 5 Sekunden ausblenden
      setTimeout(() => setMessage(""), 5000);
      
    } catch (err) {
      setMessage(`❌ Fehler: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Tab-Content rendern
  const renderTabContent = () => {
    switch (activeTab) {
      case "grunddaten":
        return (
          <div className="tab-content">
            <h3>🏯 Grundlegende Dojo-Informationen</h3>
            <div className="form-grid">
              <div className="form-group">
                <label>Dojo-Name *</label>
                <input
                  name="dojoname"
                  value={dojo.dojoname || ""}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="z.B. Tiger & Dragon Dojo"
                  required
                  key={`dojoname-${isEditing}`}
                />
              </div>
              <div className="form-group">
                <label>Untertitel</label>
                <input
                  name="untertitel"
                  value={dojo.untertitel || ""}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="z.B. Traditionelles Karate seit 1985"
                />
              </div>
              <div className="form-group">
                <label>Inhaber/Dojo-Leiter *</label>
                <input
                  name="inhaber"
                  value={dojo.inhaber || ""}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="Vor- und Nachname"
                  required
                />
              </div>
              <div className="form-group">
                <label>Stellvertreter</label>
                <input
                  name="vertreter"
                  value={dojo.vertreter || ""}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="2. Vorsitzender/Stellvertreter"
                  key={`vertreter-${isEditing}`}
                />
              </div>
              <div className="form-group short">
                <label>Gründungsjahr</label>
                <input
                  name="gruendungsjahr"
                  type="number"
                  value={dojo.gruendungsjahr || ""}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="z.B. 1985"
                  min="1900"
                  max="2030"
                />
              </div>
              <div className="form-group">
                <label>Rechtsform</label>
                <select
                  name="rechtsform"
                  value={dojo.rechtsform || "Verein"}
                  onChange={handleChange}
                  disabled={!isEditing}
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
          </div>
        );

      case "kontakt":
        return (
          <div className="tab-content">
            <h3>📍 Kontakt & Adresse</h3>
            
            <div className="form-section">
              <h4>Adresse</h4>
              <div className="form-grid">
                <div className="form-group col-3">
                  <label>Straße</label>
                  <input
                    name="strasse"
                    value={dojo.strasse || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="Straßenname"
                  />
                </div>
                <div className="form-group col-1">
                  <label>Hausnummer</label>
                  <input
                    name="hausnummer"
                    value={dojo.hausnummer || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="123a"
                  />
                </div>
                <div className="form-group col-1">
                  <label>PLZ</label>
                  <input
                    name="plz"
                    value={dojo.plz || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="12345"
                  />
                </div>
                <div className="form-group col-2">
                  <label>Ort</label>
                  <input
                    name="ort"
                    value={dojo.ort || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="Musterstadt"
                  />
                </div>
                <div className="form-group">
                  <label>Land</label>
                  <input
                    name="land"
                    value={dojo.land || "Deutschland"}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4>Kommunikation</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Telefon</label>
                  <input
                    name="telefon"
                    value={dojo.telefon || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="0123 456789"
                  />
                </div>
                <div className="form-group">
                  <label>Mobil</label>
                  <input
                    name="mobil"
                    value={dojo.mobil || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="0170 1234567"
                  />
                </div>
                <div className="form-group">
                  <label>Fax</label>
                  <input
                    name="fax"
                    value={dojo.fax || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="0123 456790"
                  />
                </div>
                <div className="form-group">
                  <label>E-Mail (Haupt)</label>
                  <input
                    name="email"
                    type="email"
                    value={dojo.email || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="kontakt@dojo.de"
                  />
                </div>
                <div className="form-group">
                  <label>E-Mail Info</label>
                  <input
                    name="email_info"
                    type="email"
                    value={dojo.email_info || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="info@dojo.de"
                  />
                </div>
                <div className="form-group">
                  <label>E-Mail Anmeldung</label>
                  <input
                    name="email_anmeldung"
                    type="email"
                    value={dojo.email_anmeldung || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="anmeldung@dojo.de"
                  />
                </div>
                <div className="form-group">
                  <label>Website</label>
                  <input
                    name="internet"
                    type="url"
                    value={dojo.internet || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="https://www.dojo.de"
                  />
                </div>
                <div className="form-group">
                  <label>WhatsApp</label>
                  <input
                    name="whatsapp_nummer"
                    value={dojo.whatsapp_nummer || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="0170 1234567"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "raeume":
        return <RaumVerwaltung />;

      case "steuer":
        return (
          <div className="tab-content">
            <h3>⚖️ Steuerliche & Rechtliche Angaben</h3>
            
            <div className="form-section">
              <h4>Steuerliche Einstufung</h4>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="umsatzsteuerpflichtig"
                    checked={dojo.umsatzsteuerpflichtig || false}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                  Umsatzsteuerpflichtig
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="kleinunternehmer"
                    checked={dojo.kleinunternehmer || false}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                  Kleinunternehmer (§19 UStG)
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="gemeinnuetzig"
                    checked={dojo.gemeinnuetzig || false}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                  Gemeinnützig
                </label>
              </div>
            </div>

            <div className="form-section">
              <h4>Steuernummern & Behörden</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Steuernummer</label>
                  <input
                    name="steuernummer"
                    value={dojo.steuernummer || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="123/456/78901"
                  />
                </div>
                <div className="form-group">
                  <label>Umsatzsteuer-ID</label>
                  <input
                    name="umsatzsteuer_id"
                    value={dojo.umsatzsteuer_id || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="DE123456789"
                  />
                </div>
                <div className="form-group">
                  <label>Finanzamt</label>
                  <FinanzamtSelector
                    value={dojo.finanzamt}
                    onChange={(finanzamt) => handleChange({
                      target: {
                        name: 'finanzamt',
                        value: finanzamt
                      }
                    })}
                    placeholder="Finanzamt suchen..."
                    disabled={!isEditing}
                  />
                </div>
                <div className="form-group">
                  <label>Steuerberater</label>
                  <input
                    name="steuerberater"
                    value={dojo.steuerberater || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="Name der Steuerkanzlei"
                  />
                </div>
              </div>
            </div>

            {dojo.rechtsform === 'Verein' && (
              <div className="form-section">
                <h4>Vereinsvorstand</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>1. Vorsitzender</label>
                    <input
                      name="vorstand_1_vorsitzender"
                      value={dojo.vorstand_1_vorsitzender || ""}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Vor- und Nachname"
                    />
                  </div>
                  <div className="form-group">
                    <label>2. Vorsitzender</label>
                    <input
                      name="vorstand_2_vorsitzender"
                      value={dojo.vorstand_2_vorsitzender || ""}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Vor- und Nachname"
                    />
                  </div>
                  <div className="form-group">
                    <label>Kassenwart</label>
                    <input
                      name="vorstand_kassenwart"
                      value={dojo.vorstand_kassenwart || ""}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="Vor- und Nachname"
                    />
                  </div>
                  <div className="form-group">
                    <label>Vereinsregister Nr.</label>
                    <input
                      name="vereinsregister_nr"
                      value={dojo.vereinsregister_nr || ""}
                      onChange={handleChange}
                      disabled={!isEditing}
                      placeholder="VR 12345"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case "bank":
        return (
          <div className="tab-content">
            <h3>🏦 Bankverbindung & Zahlungen</h3>
            
            <div className="form-section">
              <h4>Hauptkonto</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Bank/Kreditinstitut</label>
                  <input
                    name="bank_name"
                    value={dojo.bank_name || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="Sparkasse Musterstadt"
                  />
                </div>
                <div className="form-group">
                  <label>IBAN</label>
                  <input
                    name="bank_iban"
                    value={dojo.bank_iban || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="DE89 3704 0044 0532 0130 00"
                  />
                </div>
                <div className="form-group">
                  <label>BIC/SWIFT</label>
                  <input
                    name="bank_bic"
                    value={dojo.bank_bic || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="COBADEFFXXX"
                  />
                </div>
                <div className="form-group">
                  <label>Kontoinhaber</label>
                  <input
                    name="bank_inhaber"
                    value={dojo.bank_inhaber || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="Tiger & Dragon Dojo e.V."
                  />
                </div>
                <div className="form-group">
                  <label>SEPA-Gläubiger-Identifikation</label>
                  <input
                    name="sepa_glaeubiger_id"
                    value={dojo.sepa_glaeubiger_id || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="DE98ZZZ09999999999"
                    maxLength="35"
                    title="Deutsche Gläubiger-Identifikationsnummer für SEPA-Lastschriften"
                  />
                  <small className="form-help">
                    📄 Benötigt für SEPA-Lastschriftmandate. Format: DE + 2 Stellen + ZZZ + 13 Stellen
                  </small>
                </div>
              </div>
            </div>

            <div className="form-section">
              <h4>Beitragssätze & Gebühren</h4>
              <div className="form-grid">
                <div className="form-group short">
                  <label>Beitrag Erwachsene (€/Monat)</label>
                  <input
                    name="beitrag_erwachsene"
                    type="number"
                    step="0.01"
                    value={dojo.beitrag_erwachsene || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="45.00"
                  />
                </div>
                <div className="form-group short">
                  <label>Beitrag Kinder (€/Monat)</label>
                  <input
                    name="beitrag_kinder"
                    type="number"
                    step="0.01"
                    value={dojo.beitrag_kinder || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="25.00"
                  />
                </div>
                <div className="form-group short">
                  <label>Kündigungsfrist (Monate)</label>
                  <input
                    name="kuendigungsfrist_monate"
                    type="number"
                    value={dojo.kuendigungsfrist_monate || 3}
                    onChange={handleChange}
                    disabled={!isEditing}
                    min="1"
                    max="12"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "versicherung":
        return (
          <div className="tab-content">
            <h3>🛡️ Versicherungen & Schutz</h3>
            
            <div className="form-section">
              <h4>Haftpflichtversicherung</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Versicherungsgesellschaft</label>
                  <input
                    name="haftpflicht_versicherung"
                    value={dojo.haftpflicht_versicherung || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="z.B. Allianz Versicherung"
                  />
                </div>
                <div className="form-group">
                  <label>Policen-Nummer</label>
                  <input
                    name="haftpflicht_police_nr"
                    value={dojo.haftpflicht_police_nr || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="POL-123456789"
                  />
                </div>
                <div className="form-group">
                  <label>Ablaufdatum</label>
                  <input
                    name="haftpflicht_ablauf"
                    type="date"
                    value={dojo.haftpflicht_ablauf || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "vertraege":
        return (
          <div className="tab-content">
            <h3>📋 Vertragsmodell & Verlängerungen</h3>
            <p className="section-description" style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' }}>
              Wählen Sie das Vertragsmodell für Ihr Dojo. Diese Einstellung gilt für alle neuen Verträge.
            </p>

            <div className="form-section">
              <h4>🔄 Vertragsmodell auswählen</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                {/* Option 1: Gesetzliche Verlängerung */}
                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1rem',
                  background: dojo.vertragsmodell === 'gesetzlich' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.05)',
                  border: dojo.vertragsmodell === 'gesetzlich' ? '2px solid #10b981' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  cursor: isEditing ? 'pointer' : 'default',
                  transition: 'all 0.2s ease'
                }}>
                  <input
                    type="radio"
                    name="vertragsmodell"
                    value="gesetzlich"
                    checked={dojo.vertragsmodell === 'gesetzlich'}
                    onChange={handleChange}
                    disabled={!isEditing}
                    style={{ marginTop: '4px' }}
                  />
                  <div>
                    <div style={{ fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>
                      📜 Gesetzliche Verlängerung (Standard)
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5' }}>
                      Vertrag verlängert sich automatisch. Nach der Verlängerung kann das Mitglied
                      jederzeit mit <strong>1 Monat Frist</strong> kündigen (gemäß Gesetz für faire Verbraucherverträge 2022).
                    </div>
                  </div>
                </label>

                {/* Option 2: Beitragsgarantie */}
                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  padding: '1rem',
                  background: dojo.vertragsmodell === 'beitragsgarantie' ? 'rgba(20, 184, 166, 0.15)' : 'rgba(255,255,255,0.05)',
                  border: dojo.vertragsmodell === 'beitragsgarantie' ? '2px solid #14b8a6' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  cursor: isEditing ? 'pointer' : 'default',
                  transition: 'all 0.2s ease'
                }}>
                  <input
                    type="radio"
                    name="vertragsmodell"
                    value="beitragsgarantie"
                    checked={dojo.vertragsmodell === 'beitragsgarantie'}
                    onChange={handleChange}
                    disabled={!isEditing}
                    style={{ marginTop: '4px' }}
                  />
                  <div>
                    <div style={{ fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>
                      💰 Beitragsgarantie-Modell
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5' }}>
                      Mitglied muss <strong>aktiv verlängern</strong>, um seinen aktuellen Beitrag zu behalten.
                      Bei Nicht-Verlängerung gilt automatisch der aktuelle Tarifpreis oder der Vertrag endet.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Einstellungen für Beitragsgarantie-Modell */}
            {dojo.vertragsmodell === 'beitragsgarantie' && (
              <div className="form-section" style={{
                background: 'rgba(20, 184, 166, 0.1)',
                border: '1px solid rgba(20, 184, 166, 0.3)',
                borderRadius: '12px',
                padding: '1.5rem',
                marginTop: '1rem'
              }}>
                <h4 style={{ color: '#14b8a6' }}>⚙️ Beitragsgarantie-Einstellungen</h4>

                <div className="form-grid" style={{ marginTop: '1rem' }}>
                  <div className="form-group">
                    <label>Bei Nicht-Verlängerung</label>
                    <select
                      name="beitragsgarantie_bei_nichtverlaengerung"
                      value={dojo.beitragsgarantie_bei_nichtverlaengerung || 'aktueller_tarif'}
                      onChange={handleChange}
                      disabled={!isEditing}
                    >
                      <option value="aktueller_tarif">Automatisch aktueller Tarifpreis</option>
                      <option value="vertrag_endet">Vertrag endet</option>
                    </select>
                    <small style={{ color: 'rgba(255,255,255,0.5)', marginTop: '0.25rem', display: 'block' }}>
                      Was passiert, wenn das Mitglied nicht aktiv verlängert?
                    </small>
                  </div>
                </div>

                <h5 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', color: '#fff' }}>📧 Erinnerungs-E-Mails</h5>
                <div className="form-grid">
                  <div className="form-group short">
                    <label>1. Erinnerung</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        name="verlaengerung_erinnerung_tage"
                        type="number"
                        min="14"
                        max="90"
                        value={dojo.verlaengerung_erinnerung_tage || 60}
                        onChange={handleChange}
                        disabled={!isEditing}
                        style={{ width: '80px' }}
                      />
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>Tage vorher</span>
                    </div>
                  </div>
                  <div className="form-group short">
                    <label>2. Erinnerung</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        name="verlaengerung_erinnerung2_tage"
                        type="number"
                        min="0"
                        max="60"
                        value={dojo.verlaengerung_erinnerung2_tage || 30}
                        onChange={handleChange}
                        disabled={!isEditing}
                        style={{ width: '80px' }}
                      />
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>Tage vorher</span>
                    </div>
                  </div>
                  <div className="form-group short">
                    <label>Letzte Erinnerung</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input
                        name="verlaengerung_erinnerung3_tage"
                        type="number"
                        min="0"
                        max="30"
                        value={dojo.verlaengerung_erinnerung3_tage || 14}
                        onChange={handleChange}
                        disabled={!isEditing}
                        style={{ width: '80px' }}
                      />
                      <span style={{ color: 'rgba(255,255,255,0.6)' }}>Tage vorher</span>
                    </div>
                  </div>
                </div>
                <small style={{ color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem', display: 'block' }}>
                  Setzen Sie einen Wert auf 0, um diese Erinnerung zu deaktivieren.
                </small>
              </div>
            )}

            {/* Allgemeine Vertragseinstellungen */}
            <div className="form-section" style={{ marginTop: '2rem' }}>
              <h4>📝 Allgemeine Vertragseinstellungen</h4>
              <div className="form-grid">
                <div className="form-group short">
                  <label>Kündigungsfrist (Erstlaufzeit)</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      name="kuendigungsfrist_monate"
                      type="number"
                      min="1"
                      max="3"
                      value={dojo.kuendigungsfrist_monate || 3}
                      onChange={handleChange}
                      disabled={!isEditing}
                      style={{ width: '80px' }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>Monate</span>
                  </div>
                </div>
                <div className="form-group short">
                  <label>Mindestlaufzeit</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      name="mindestlaufzeit_monate"
                      type="number"
                      min="1"
                      max="24"
                      value={dojo.mindestlaufzeit_monate || 12}
                      onChange={handleChange}
                      disabled={!isEditing}
                      style={{ width: '80px' }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>Monate</span>
                  </div>
                </div>
                <div className="form-group short">
                  <label>Verlängerungszeitraum</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      name="verlaengerung_monate"
                      type="number"
                      min="1"
                      max="12"
                      value={dojo.verlaengerung_monate || 12}
                      onChange={handleChange}
                      disabled={!isEditing}
                      style={{ width: '80px' }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>Monate</span>
                  </div>
                </div>
              </div>

              <div className="checkbox-group" style={{ marginTop: '1rem' }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="kuendigung_nur_monatsende"
                    checked={dojo.kuendigung_nur_monatsende || false}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                  Kündigung nur zum Monatsende möglich
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="kuendigung_schriftlich"
                    checked={dojo.kuendigung_schriftlich || false}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                  Kündigung muss schriftlich erfolgen
                </label>
              </div>
            </div>

            {/* Info-Box */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '12px',
              padding: '1rem',
              marginTop: '2rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', lineHeight: '1.6' }}>
                  <strong>Hinweis zum deutschen Verbraucherrecht:</strong><br />
                  Seit März 2022 können Verbraucher nach automatischer Vertragsverlängerung jederzeit mit 1 Monat Frist kündigen.
                  Das Beitragsgarantie-Modell bietet eine faire Alternative: Mitglieder behalten ihren Preis, wenn sie aktiv verlängern.
                </div>
              </div>
            </div>
          </div>
        );

      case "sport":
        return (
          <div className="tab-content">
            <h3>🥋 Sport & Verband</h3>

            <div className="form-section">
              <h4>Kampfkunst-Informationen</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Kampfkunst-Stil</label>
                  <input
                    name="kampfkunst_stil"
                    value={dojo.kampfkunst_stil || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="z.B. Shotokan Karate, Judo, Aikido"
                  />
                </div>
                <div className="form-group">
                  <label>Verband</label>
                  <input
                    name="verband"
                    value={dojo.verband || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="z.B. DKV - Deutscher Karate Verband"
                  />
                </div>
                <div className="form-group">
                  <label>Verband Mitgliedsnummer</label>
                  <input
                    name="verband_mitgliedsnummer"
                    value={dojo.verband_mitgliedsnummer || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="DKV-123456"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case "zeiten":
        return (
          <div className="tab-content">
            <h3>🕐 Öffnungszeiten & Betrieb</h3>

            <div className="form-section">
              <h4>Betriebszeiten</h4>
              <div className="checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="feiertage_geschlossen"
                    checked={dojo.feiertage_geschlossen || false}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                  An Feiertagen geschlossen
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="ferien_geschlossen"
                    checked={dojo.ferien_geschlossen || false}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                  In den Schulferien geschlossen
                </label>
              </div>
            </div>
          </div>
        );

      case "rechtliches":
        const rechtlichesTabs = [
          { id: "agb", label: "📋 AGB", field: "agb_text", placeholder: "Geben Sie hier Ihre Allgemeinen Geschäftsbedingungen ein...", help: "💡 Die AGB regeln die vertraglichen Beziehungen zwischen Ihrem Dojo und den Mitgliedern", rows: 12 },
          { id: "dsgvo", label: "🔒 DSGVO", field: "dsgvo_text", placeholder: "Geben Sie hier Ihre Datenschutzerklärung gemäß DSGVO ein...", help: "🔒 Wichtig: Die Datenschutzerklärung muss den Anforderungen der DSGVO entsprechen", rows: 12 },
          { id: "regeln", label: "🥋 Dojo-Regeln", field: "dojo_regeln_text", placeholder: "Geben Sie hier die Dojo-Regeln und den Verhaltenskodex ein (z.B. Respekt, Pünktlichkeit, Sauberkeit, Etikette)...", help: "🥋 Beispiele: Verbeugung beim Betreten, Sauberkeit der Trainingskleidung, Respekt gegenüber Trainern", rows: 10 },
          { id: "hausordnung", label: "🏠 Hausordnung", field: "hausordnung_text", placeholder: "Geben Sie hier die Hausordnung ein (z.B. Nutzung der Räumlichkeiten, Umkleideregeln, Parkplätze)...", help: "🏠 Regelt die praktische Nutzung der Räumlichkeiten und Einrichtungen", rows: 10 },
          { id: "haftung", label: "⚠️ Haftungsausschluss", field: "haftungsausschluss_text", placeholder: "Geben Sie hier den Haftungsausschluss ein (Haftungsbeschränkungen für Training und Veranstaltungen)...", help: "⚠️ Regelt die Haftung bei Unfällen und Verletzungen während des Trainings", rows: 10 },
          { id: "widerruf", label: "⚖️ Widerruf", field: "widerrufsbelehrung_text", placeholder: "Geben Sie hier die Widerrufsbelehrung nach deutschem Recht ein (14-Tage-Widerrufsrecht)...", help: "⚖️ Pflichtangabe bei Verbraucherverträgen - 14 Tage Widerrufsrecht gemäß BGB", rows: 8 },
          { id: "impressum", label: "📋 Impressum", field: "impressum_text", placeholder: "Geben Sie hier Ihr Impressum ein (Angaben gemäß § 5 TMG)...", help: "📋 Pflichtangabe für Website gemäß § 5 TMG (Name, Anschrift, Kontakt, Vertretungsberechtigte)", rows: 8 },
          { id: "vertrag", label: "📝 Vertragsbedingungen", field: "vertragsbedingungen_text", placeholder: "Geben Sie hier spezifische Vertragsbedingungen für Mitgliedschaftsverträge ein...", help: "📝 Spezifische Bedingungen für Mitgliedschaftsverträge (ergänzend zu den AGB)", rows: 10 }
        ];

        const activeRechtlichesContent = rechtlichesTabs.find(t => t.id === activeRechtlichesTab);

        return (
          <div className="tab-content">
            <h3>📜 Rechtliche Dokumente & Regeln</h3>
            <p className="section-description">
              Erfassen Sie hier alle wichtigen rechtlichen Texte und Dojo-Regeln. Diese können später in Verträgen,
              auf der Website oder für Aushänge verwendet werden.
            </p>

            {/* Sub-Tabs für rechtliche Dokumente */}
            <div className="rechtliches-sub-tabs">
              {rechtlichesTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={`rechtliches-tab-button ${activeRechtlichesTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveRechtlichesTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Aktiver Tab-Inhalt */}
            <div className="rechtliches-tab-content">
              <div className="form-section">
                <div className="form-group full-width">
                  <textarea
                    name={activeRechtlichesContent.field}
                    value={dojo[activeRechtlichesContent.field] || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder={activeRechtlichesContent.placeholder}
                    rows={activeRechtlichesContent.rows}
                    style={{ 
                      width: '100%', 
                      padding: '16px', 
                      fontFamily: 'inherit', 
                      fontSize: '14px',
                      lineHeight: '1.6',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 215, 0, 0.2)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#ffffff',
                      resize: 'vertical',
                      minHeight: '400px'
                    }}
                  />
                  <small className="form-help" style={{ marginTop: '12px', display: 'block' }}>
                    {activeRechtlichesContent.help}
                  </small>
                </div>
              </div>
            </div>
          </div>
        );

      case "admins":
        return <AdminVerwaltung />;

      case "system":
        return (
          <div className="tab-content">
            <h3>⚙️ System-Einstellungen</h3>

            <div className="form-section">
              <h4>🎨 Design & Theme-Auswahl</h4>
              <div className="theme-selector-section">
                <div className="current-theme-display">
                  <label>Aktuelles Theme</label>
                  <div className="current-theme-card glass-card">
                    <div
                      className="theme-preview-gradient"
                      style={{ background: currentTheme?.preview || 'linear-gradient(135deg, #0f0f23, #16213e)' }}
                    >
                      <div className="preview-overlay">
                        {isDarkMode ? '🌙' : '☀️'}
                      </div>
                    </div>
                    <div className="theme-info">
                      <h5>{currentTheme?.name || "Midnight Blue"}</h5>
                      <p>{currentTheme?.description}</p>
                      <span className={`theme-mode-badge ${isDarkMode ? 'dark' : 'light'}`}>
                        {isDarkMode ? 'Dark Mode' : 'Light Mode'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="theme-selector-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowThemeSelector(!showThemeSelector)}
                  >
                    <Palette size={18} />
                    Theme wechseln
                  </button>
                </div>

                {showThemeSelector && (
                  <div className="theme-grid">
                    {themes.map(t => (
                      <div
                        key={t.id}
                        className={`theme-option glass-card ${theme === t.id ? 'active' : ''}`}
                        onClick={() => handleThemeChange(t.id)}
                      >
                        <div
                          className="theme-preview-gradient small"
                          style={{ background: t.preview }}
                        >
                          <div className="preview-overlay">
                            {t.isDark ? '🌙' : '☀️'}
                          </div>
                        </div>
                        <div className="theme-details">
                          <h6>{t.name}</h6>
                          <p>{t.description}</p>
                          {theme === t.id && (
                            <span className="active-badge">✓ Aktiv</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="form-section">
              <h4>Weitere Einstellungen</h4>
              <div className="form-grid">
                <div className="form-group short">
                  <label>Akzentfarbe</label>
                  <input
                    name="theme_farbe"
                    type="color"
                    value={dojo.theme_farbe || "#8B0000"}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
                <div className="form-group">
                  <label>Logo URL</label>
                  <input
                    name="logo_url"
                    type="url"
                    value={dojo.logo_url || ""}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="https://dojo.de/logo.png"
                  />
                </div>
                <div className="form-group short">
                  <label>Sprache</label>
                  <select
                    name="sprache"
                    value={dojo.sprache || "de"}
                    onChange={handleChange}
                    disabled={!isEditing}
                  >
                    <option value="de">Deutsch</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                  </select>
                </div>
                <div className="form-group short">
                  <label>Zeitzone</label>
                  <select
                    name="zeitzone"
                    value={dojo.zeitzone || "Europe/Berlin"}
                    onChange={handleChange}
                    disabled={!isEditing}
                  >
                    <option value="Europe/Berlin">Europa/Berlin</option>
                    <option value="Europe/Vienna">Europa/Wien</option>
                    <option value="Europe/Zurich">Europa/Zürich</option>
                  </select>
                </div>
                <div className="form-group short">
                  <label>Währung</label>
                  <select
                    name="waehrung"
                    value={dojo.waehrung || "EUR"}
                    onChange={handleChange}
                    disabled={!isEditing}
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="CHF">CHF</option>
                  </select>
                </div>
                <div className="form-group short">
                  <label>Max. Mitglieder</label>
                  <input
                    name="max_mitglieder"
                    type="number"
                    min="1"
                    max="10000"
                    value={dojo.max_mitglieder || 500}
                    onChange={handleChange}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return <div>Tab nicht gefunden</div>;
    }
  };

  return (
    <div className="einstellungen-dojo">
      <div className="page-header">
        <h1>🏯 Dojo-Einstellungen</h1>
        <p>Verwalten Sie alle wichtigen Informationen und Einstellungen Ihres Dojos</p>
      </div>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ '--tab-color': tab.color }}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-container">
        <form onSubmit={handleSave}>
          {renderTabContent()}

          {/* Action Buttons - Nur anzeigen wenn nicht Admin oder Räume Tab */}
          {activeTab !== 'admins' && activeTab !== 'raeume' && (
            <div className="form-actions">
              {!isEditing ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleEdit}
                  disabled={loading}
                >
                  <Edit3 size={18} />
                  Bearbeiten
                </button>
              ) : (
                <div className="button-group">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCancel}
                    disabled={loading}
                  >
                    <X size={18} />
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={loading}
                  >
                    <Save size={18} />
                    {loading ? 'Speichern...' : 'Speichern'}
                  </button>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default EinstellungenDojo;