// =====================================================================================
// ARTIKEL-FORMULAR KOMPONENTE - Eigenständige Seite für Artikel erstellen/bearbeiten
// =====================================================================================
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/components.css';
import '../styles/ArtikelVerwaltung.css';
import '../styles/ArtikelVerwaltungOverrides.css';
import '../styles/ArtikelFormular.css';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';


const ArtikelFormular = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [kategorien, setKategorien] = useState([]);
  const [artikelgruppen, setArtikelgruppen] = useState([]); // Hierarchische Struktur mit unterkategorien
  const [selectedHauptkategorieId, setSelectedHauptkategorieId] = useState('');
  const [activeTab, setActiveTab] = useState('basis');
  const [preisTab, setPreisTab] = useState('einzelkalkulation'); // 'groessenabhaengig' | 'einzelkalkulation'
  const [editingGroesse, setEditingGroesse] = useState(null); // { old: 'Gros', new: 'Groß' }

  // Modal State für neue Artikelgruppe/Unterkategorie
  const [showGruppeModal, setShowGruppeModal] = useState(false);
  const [neueGruppeTyp, setNeueGruppeTyp] = useState('hauptkategorie'); // 'hauptkategorie' | 'unterkategorie'
  const [neueGruppeName, setNeueGruppeName] = useState('');
  const [neueGruppeLoading, setNeueGruppeLoading] = useState(false);

  // Rabatt State (nur für SuperAdmin/TDA)
  const [rabattData, setRabattData] = useState({
    hat_rabatt: false,
    rabatt_typ: 'prozent',
    rabatt_wert: '',
    gilt_fuer_dojo: true,           // Verbandsmitglieder über Dojo
    gilt_fuer_einzelperson: true,   // Verbandsmitglieder als Einzelperson
    gilt_fuer_mitglieder: true,     // Normale Dojo-Mitglieder
    aktiv: true
  });
  const [rabattLoading, setRabattLoading] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Verfügbare Größen
  const verfuegbareGroessen = [
    'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL',
    '100', '110', '120', '130', '140', '150', '160', '170', '180', '190', '200'
  ];

  // Verfügbare Farben
  const verfuegbareFarben = [
    { name: 'Schwarz', hex: '#000000' },
    { name: 'Weiß', hex: '#FFFFFF' },
    { name: 'Rot', hex: '#DC2626' },
    { name: 'Blau', hex: '#2563EB' },
    { name: 'Grün', hex: '#16A34A' },
    { name: 'Gelb', hex: '#EAB308' },
    { name: 'Orange', hex: '#EA580C' },
    { name: 'Lila', hex: '#9333EA' },
    { name: 'Rosa', hex: '#EC4899' },
    { name: 'Grau', hex: '#6B7280' }
  ];

  // Verfügbare Laufzeiten
  const verfuegbareLaufzeiten = [
    { name: '1 Monat', monate: 1, rabatt: 0 },
    { name: '3 Monate', monate: 3, rabatt: 0 },
    { name: '6 Monate', monate: 6, rabatt: 0 },
    { name: '12 Monate', monate: 12, rabatt: 0 },
    { name: '5 Jahre (Vorauszahlung)', monate: 60, rabatt: 20 }
  ];

  // Form State
  const [formData, setFormData] = useState({
    kategorie_id: '',
    artikelgruppe_id: '',
    name: '',
    beschreibung: '',
    ean_code: '',
    artikel_nummer: '',
    artikel_nummer_basis: '', // Basis-Artikelnummer ohne Varianten-Suffix
    artikel_nummer_auto: true, // Auto-generieren aktiviert
    // Handelskalkulation
    listeneinkaufspreis_euro: '',
    lieferrabatt_prozent: '',
    lieferskonto_prozent: '',
    bezugskosten_euro: '',
    gemeinkosten_prozent: '',
    gewinnzuschlag_prozent: '',
    kundenskonto_prozent: '',
    kundenrabatt_prozent: '',
    einkaufspreis_euro: '',
    zusatzkosten_euro: '',
    marge_prozent: '',
    verkaufspreis_euro: '',
    mwst_prozent: 19.00,
    lagerbestand: 0,
    mindestbestand: 0,
    lager_tracking: true,
    farbe_hex: '#FFFFFF',
    aktiv: true,
    sichtbar_kasse: true,
    // Varianten
    hat_varianten: false,
    varianten_groessen: [],
    varianten_farben: [],
    varianten_material: [],
    varianten_laufzeit: [],
    varianten_custom: [],
    custom_groesse: '',
    custom_farbe_name: '',
    custom_farbe_hex: '#000000',
    custom_material: '',
    // Varianten-Bestand (key: "groesse|farbe|material", value: {bestand, mindestbestand})
    varianten_bestand: {},
    // Artikel-Verkaufspreise
    preis_euro: '', // Netto-VK Einzelpreis
    bruttopreis_euro: '', // Brutto-VK Einzelpreis
    // Varianten-Preise (größenabhängige Preise)
    hat_preiskategorien: false, // Unterschiedliche Preise für Kids/Erwachsene?
    listeneinkaufspreis_kids_euro: '', // Listen-EK für Kids-Größen
    listeneinkaufspreis_erwachsene_euro: '', // Listen-EK für Erwachsene-Größen
    bezugskosten_kids_euro: '', // Bezugskosten für Kids
    bezugskosten_erwachsene_euro: '', // Bezugskosten für Erwachsene
    preis_kids_euro: '', // Netto-VK Kids
    preis_erwachsene_euro: '', // Netto-VK Erwachsene
    bruttopreis_kids_euro: '', // Brutto-VK Kids
    bruttopreis_erwachsene_euro: '', // Brutto-VK Erwachsene
    // Flexible Größen-Zuordnung (welche Größen sind Kids, welche Erwachsene)
    groessen_kids: ['100', '110', '120', '130', '140', '150'], // Standard Kids-Größen
    groessen_erwachsene: ['160', '170', '180', '190', '200', 'XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'] // Standard Erwachsene
  });

  // API Call Helper
  const apiCall = async (endpoint, options = {}) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/artikel${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      });

      if (!response.ok) {
        let errorBody = null;
        try { errorBody = await response.json(); } catch {}
        console.error('API Error Response:', response.status, errorBody);
        const msg = errorBody?.detail
          ? `Validation: ${JSON.stringify(errorBody.detail)}`
          : (errorBody?.error || `HTTP ${response.status}`);
        throw new Error(msg);
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // Load Kategorien
  const loadKategorien = async () => {
    try {
      const response = await apiCall('/kategorien');
      setKategorien(response.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Kategorien:', error);
    }
  };

  // Load Artikelgruppen (hierarchische Struktur)
  const loadArtikelgruppen = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/artikelgruppen`);
      const data = await response.json();
      if (data.success) {
        // Behalte hierarchische Struktur: Hauptkategorien mit unterkategorien Array
        setArtikelgruppen(data.data || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Artikelgruppen:', error);
    }
  };

  // Neue Artikelgruppe oder Unterkategorie erstellen
  const handleCreateGruppe = async () => {
    if (!neueGruppeName.trim()) {
      alert('Bitte geben Sie einen Namen ein');
      return;
    }

    setNeueGruppeLoading(true);
    try {
      const payload = {
        name: neueGruppeName.trim()
      };

      // Wenn Unterkategorie, dann parent_id setzen
      if (neueGruppeTyp === 'unterkategorie' && selectedHauptkategorieId) {
        payload.parent_id = selectedHauptkategorieId;
      }

      const response = await fetchWithAuth(`${config.apiBaseUrl}/artikelgruppen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (data.success) {
        // Artikelgruppen neu laden
        await loadArtikelgruppen();

        // Modal schließen und Reset
        setShowGruppeModal(false);
        setNeueGruppeName('');

        // Wenn Hauptkategorie erstellt, diese auswählen
        if (neueGruppeTyp === 'hauptkategorie' && data.id) {
          setSelectedHauptkategorieId(data.id.toString());
          setFormData(prev => ({ ...prev, kategorie_id: data.id.toString() }));
        }
        // Wenn Unterkategorie erstellt, diese auswählen
        if (neueGruppeTyp === 'unterkategorie' && data.id) {
          setFormData(prev => ({ ...prev, artikelgruppe_id: data.id.toString() }));
        }
      } else {
        alert(data.error || 'Fehler beim Erstellen der Gruppe');
      }
    } catch (error) {
      console.error('Fehler beim Erstellen der Artikelgruppe:', error);
      alert('Fehler beim Erstellen der Artikelgruppe');
    } finally {
      setNeueGruppeLoading(false);
    }
  };

  // Unterkategorien der gewählten Hauptkategorie
  const getUnterkategorien = () => {
    if (!selectedHauptkategorieId) return [];
    const hauptkategorie = artikelgruppen.find(g => g.id == selectedHauptkategorieId);
    return hauptkategorie?.unterkategorien || [];
  };

  // Load Artikel for Edit Mode
  const loadArtikel = async () => {
    if (mode !== 'edit' || !id) return;

    try {
      setLoading(true);
      const response = await apiCall(`/${id}`);
      if (response.success && response.data) {
        // DEBUG: Log loaded Handelskalkulation data
        console.log('🔍 ArtikelFormular - Geladene Kalkulation:', {
          listeneinkaufspreis_euro: response.data.listeneinkaufspreis_euro,
          lieferrabatt_prozent: response.data.lieferrabatt_prozent,
          gemeinkosten_prozent: response.data.gemeinkosten_prozent,
          gewinnzuschlag_prozent: response.data.gewinnzuschlag_prozent,
          verkaufspreis_euro: response.data.verkaufspreis_euro,
          bezugskosten_euro: response.data.bezugskosten_euro
        });

        setFormData(prev => ({
          ...prev,
          ...response.data
        }));
        // Tab setzen basierend auf gespeichertem hat_preiskategorien
        if (response.data.hat_preiskategorien) {
          setPreisTab('groessenabhaengig');
        }
      }
    } catch (error) {
      setError('Fehler beim Laden des Artikels');
    } finally {
      setLoading(false);
    }
  };

  // Load Rabatt Data for Artikel (nur für SuperAdmin)
  const loadRabattData = async () => {
    if (mode !== 'edit' || !id) return;

    try {
      setRabattLoading(true);
      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/artikel/${id}/rabatt`);
      const data = await response.json();

      if (data.success && data.data) {
        setRabattData({
          hat_rabatt: true,
          rabatt_typ: data.data.rabatt_typ || 'prozent',
          rabatt_wert: data.data.rabatt_wert || '',
          gilt_fuer_dojo: data.data.gilt_fuer_dojo ?? true,
          gilt_fuer_einzelperson: data.data.gilt_fuer_einzelperson ?? true,
          gilt_fuer_mitglieder: data.data.gilt_fuer_mitglieder ?? true,
          aktiv: data.data.aktiv ?? true
        });
      } else {
        // Kein Rabatt vorhanden
        setRabattData({
          hat_rabatt: false,
          rabatt_typ: 'prozent',
          rabatt_wert: '',
          gilt_fuer_dojo: true,
          gilt_fuer_einzelperson: true,
          gilt_fuer_mitglieder: true,
          aktiv: true
        });
      }
    } catch (error) {
      console.error('Fehler beim Laden der Rabatt-Daten:', error);
    } finally {
      setRabattLoading(false);
    }
  };

  // Save Rabatt Data
  const saveRabattData = async () => {
    if (mode !== 'edit' || !id) return;

    try {
      setRabattLoading(true);

      if (rabattData.hat_rabatt && rabattData.rabatt_wert) {
        // Rabatt speichern/aktualisieren
        const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/artikel/${id}/rabatt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rabatt_typ: rabattData.rabatt_typ,
            rabatt_wert: parseFloat(rabattData.rabatt_wert),
            gilt_fuer_dojo: rabattData.gilt_fuer_dojo,
            gilt_fuer_einzelperson: rabattData.gilt_fuer_einzelperson,
            gilt_fuer_mitglieder: rabattData.gilt_fuer_mitglieder,
            aktiv: rabattData.aktiv
          })
        });
        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || 'Fehler beim Speichern des Rabatts');
        }
      } else if (!rabattData.hat_rabatt) {
        // Rabatt löschen wenn deaktiviert
        await fetchWithAuth(`${config.apiBaseUrl}/admin/artikel/${id}/rabatt`, {
          method: 'DELETE'
        });
      }
      return true;
    } catch (error) {
      console.error('Fehler beim Speichern der Rabatt-Daten:', error);
      throw error;
    } finally {
      setRabattLoading(false);
    }
  };

  useEffect(() => {
    loadKategorien();
    loadArtikelgruppen();
    if (mode === 'edit') {
      loadArtikel();
    }

    // SuperAdmin Check (dojo_id === null bedeutet TDA-Ebene)
    const storedUser = localStorage.getItem('dojo_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        const isSuper = (user?.rolle === 'admin' || user?.role === 'admin') && user?.dojo_id === null;
        setIsSuperAdmin(isSuper);
      } catch (e) {
        console.error('Error parsing user data:', e);
      }
    }
  }, [mode, id]);

  // Rabatt-Daten laden wenn SuperAdmin im Edit-Modus
  useEffect(() => {
    if (isSuperAdmin && mode === 'edit' && id) {
      loadRabattData();
    }
  }, [isSuperAdmin, mode, id]);

  // Im Edit-Modus: Hauptkategorie setzen wenn Artikelgruppen und Artikel geladen sind
  useEffect(() => {
    if (mode === 'edit' && formData.artikelgruppe_id && artikelgruppen.length > 0) {
      // Finde die Hauptkategorie, die diese Unterkategorie enthält
      for (const hauptkat of artikelgruppen) {
        // Prüfe ob artikelgruppe_id direkt eine Hauptkategorie ist
        if (hauptkat.id == formData.artikelgruppe_id) {
          setSelectedHauptkategorieId(hauptkat.id.toString());
          // Setze auch kategorie_id für Backend
          setFormData(prev => ({ ...prev, kategorie_id: hauptkat.id.toString() }));
          return;
        }
        // Prüfe ob artikelgruppe_id eine Unterkategorie dieser Hauptkategorie ist
        if (hauptkat.unterkategorien?.some(u => u.id == formData.artikelgruppe_id)) {
          setSelectedHauptkategorieId(hauptkat.id.toString());
          // Setze auch kategorie_id für Backend
          setFormData(prev => ({ ...prev, kategorie_id: hauptkat.id.toString() }));
          return;
        }
      }
    }
  }, [mode, formData.artikelgruppe_id, artikelgruppen]);

  // Hilfsfunktion: Finde Gruppe in hierarchischer Struktur (Haupt- oder Unterkategorie)
  const findGruppeById = (gruppeId) => {
    for (const hauptkat of artikelgruppen) {
      if (hauptkat.id == gruppeId) return hauptkat;
      const unter = hauptkat.unterkategorien?.find(u => u.id == gruppeId);
      if (unter) return unter;
    }
    return null;
  };

  // Generate next Artikelnummer based on Artikelgruppe
  const generateArtikelNummer = async (gruppeId) => {
    if (!gruppeId) return '';

    try {
      // Find the selected group to get its prefix/code (kann Haupt- oder Unterkategorie sein)
      const gruppe = findGruppeById(gruppeId);
      if (!gruppe) return '';

      // Create a 3-letter prefix from gruppe name
      const prefix = (gruppe.code || gruppe.name.substring(0, 3)).toUpperCase().replace(/[^A-Z]/g, '').substring(0, 3).padEnd(3, 'X');

      // Get all existing artikel to find the next number
      const response = await apiCall('');
      const existingArtikel = response.data || [];

      // Find all artikel numbers with this prefix (without suffix)
      const prefixPattern = new RegExp(`^${prefix}(\\d+)`);
      let maxNum = 0;

      existingArtikel.forEach(art => {
        if (art.artikel_nummer) {
          const match = art.artikel_nummer.match(prefixPattern);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxNum) maxNum = num;
          }
        }
      });

      // Generate next number
      const nextNum = (maxNum + 1).toString().padStart(3, '0');
      return `${prefix}${nextNum}`;
    } catch (error) {
      console.error('Error generating Artikelnummer:', error);
      return '';
    }
  };

  // Generate variant suffix for article number
  const getVariantenSuffix = () => {
    const parts = [];

    // Add size codes
    if (formData.varianten_groessen.length > 0) {
      // Show abbreviated sizes
      const sizeAbbr = formData.varianten_groessen.map(g => {
        // For numeric sizes, keep as is
        if (/^\d+$/.test(g)) return g;
        // For letter sizes, keep first letter(s)
        return g.substring(0, 2).toUpperCase();
      }).slice(0, 3).join('/');
      if (formData.varianten_groessen.length > 3) {
        parts.push(`${sizeAbbr}+${formData.varianten_groessen.length - 3}`);
      } else {
        parts.push(sizeAbbr);
      }
    }

    // Add color codes
    if (formData.varianten_farben.length > 0) {
      const colorAbbr = formData.varianten_farben.map(f =>
        f.name.substring(0, 2).toUpperCase()
      ).slice(0, 3).join('/');
      if (formData.varianten_farben.length > 3) {
        parts.push(`${colorAbbr}+${formData.varianten_farben.length - 3}`);
      } else {
        parts.push(colorAbbr);
      }
    }

    return parts.length > 0 ? '-' + parts.join('-') : '';
  };

  // Update article number when variants change
  const updateArtikelNummerMitVarianten = () => {
    if (!formData.artikel_nummer_basis) return;

    const suffix = formData.hat_varianten ? getVariantenSuffix() : '';
    const newNummer = formData.artikel_nummer_basis + suffix;

    setFormData(prev => ({
      ...prev,
      artikel_nummer: newNummer
    }));
  };

  // Handle Input Change
  const handleInputChange = async (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;

    setFormData(prev => ({
      ...prev,
      [name]: newValue
    }));

    // Auto-generate Artikelnummer when Artikelgruppe changes
    if (name === 'artikelgruppe_id' && value && formData.artikel_nummer_auto && mode === 'create') {
      const autoNummer = await generateArtikelNummer(value);
      if (autoNummer) {
        setFormData(prev => ({
          ...prev,
          artikel_nummer: autoNummer,
          artikel_nummer_basis: autoNummer
        }));
      }
    }
  };

  // Update article number when variants change
  useEffect(() => {
    if (formData.artikel_nummer_basis && formData.hat_varianten) {
      const suffix = getVariantenSuffix();
      const newNummer = formData.artikel_nummer_basis + suffix;
      if (newNummer !== formData.artikel_nummer) {
        setFormData(prev => ({
          ...prev,
          artikel_nummer: newNummer
        }));
      }
    }
  }, [formData.varianten_groessen, formData.varianten_farben, formData.hat_varianten]);

  // Automatisch hat_varianten setzen wenn Varianten hinzugefügt werden
  useEffect(() => {
    const hasVariants = formData.varianten_groessen.length > 0 ||
                        formData.varianten_farben.length > 0 ||
                        formData.varianten_material.length > 0;
    if (hasVariants && !formData.hat_varianten) {
      setFormData(prev => ({ ...prev, hat_varianten: true }));
    }
  }, [formData.varianten_groessen, formData.varianten_farben, formData.varianten_material]);

  // Automatisch Verkaufspreis setzen wenn Erwachsene-Preis eingegeben wird
  useEffect(() => {
    if (preisTab === 'groessenabhaengig' && formData.preis_erwachsene_euro) {
      const erwPreis = parseFloat(formData.preis_erwachsene_euro);
      const currentVK = parseFloat(formData.verkaufspreis_euro) || 0;
      // Nur aktualisieren wenn unterschiedlich (verhindert Loop)
      if (erwPreis > 0 && erwPreis !== currentVK) {
        setFormData(prev => ({
          ...prev,
          verkaufspreis_euro: erwPreis.toFixed(2)
        }));
      }
    }
  }, [formData.preis_erwachsene_euro, preisTab]);

  // Sync preisTab mit hat_preiskategorien für das Speichern
  useEffect(() => {
    const shouldHavePreiskategorien = preisTab === 'groessenabhaengig';
    if (formData.hat_preiskategorien !== shouldHavePreiskategorien) {
      setFormData(prev => ({
        ...prev,
        hat_preiskategorien: shouldHavePreiskategorien
      }));
    }
  }, [preisTab]);

  // Save Artikel
  const handleSave = async () => {
    // Frontend-Validierung
    if (!formData.kategorie_id) {
      setError('Bitte wähle eine Kategorie aus.');
      return;
    }
    if (!formData.name?.trim()) {
      setError('Bitte gib einen Artikelnamen ein.');
      return;
    }

    try {
      setLoading(true);
      const url = mode === 'create' ? '' : `/${id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      // Wenn verkaufspreis_euro leer: aus Handelskalkulation berechnen
      let vk = formData.verkaufspreis_euro;
      if (vk === '' || vk === null || vk === undefined) {
        const calcVK = (ek, bezug) => {
          if (ek <= 0) return null;
          const r  = parseFloat(formData.lieferrabatt_prozent) || 0;
          const s  = parseFloat(formData.lieferskonto_prozent) || 0;
          const gk = parseFloat(formData.gemeinkosten_prozent) || 0;
          const gz = parseFloat(formData.gewinnzuschlag_prozent) || 0;
          const ks = parseFloat(formData.kundenskonto_prozent) || 0;
          const kr = parseFloat(formData.kundenrabatt_prozent) || 0;
          const bp = ek * (1 - r/100) * (1 - s/100) + bezug;
          const bvk = bp * (1 + gk/100) * (1 + gz/100);
          return (bvk * (1 + ks/100) * (1 + kr/100)).toFixed(2);
        };
        // Einzelkalkulation
        vk = calcVK(parseFloat(formData.listeneinkaufspreis_euro) || 0, parseFloat(formData.bezugskosten_euro) || 0);
        // Größen: Erwachsene als Hauptpreis
        if (!vk) vk = calcVK(parseFloat(formData.listeneinkaufspreis_erwachsene_euro) || 0, parseFloat(formData.bezugskosten_erwachsene_euro) || 0);
        // Größen: Kids als Fallback
        if (!vk) vk = calcVK(parseFloat(formData.listeneinkaufspreis_kids_euro) || 0, parseFloat(formData.bezugskosten_kids_euro) || 0);
        if (!vk) vk = '0.00';
      }

      const saveData = {
        ...formData,
        verkaufspreis_euro: vk
      };

      console.log('💾 ArtikelFormular - Speichere:', {
        kategorie_id: saveData.kategorie_id,
        name: saveData.name,
        verkaufspreis_euro: saveData.verkaufspreis_euro,
        method
      });

      const response = await apiCall(url, {
        method,
        body: JSON.stringify(saveData)
      });

      if (response.success) {
        navigate('/dashboard/artikel');
      } else {
        setError(response.error || 'Fehler beim Speichern');
      }
    } catch (error) {
      setError('Fehler beim Speichern: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Tab Navigation
  const baseTabs = [
    { id: 'basis', label: 'Basis', icon: '📋' },
    { id: 'varianten', label: 'Varianten', icon: '🎨' },
    { id: 'preise', label: 'Preiskalkulation', icon: '💶' },
    { id: 'lager', label: 'Lager', icon: '📦' },
    { id: 'einstellungen', label: 'Einstellungen', icon: '⚙️' }
  ];

  // Rabatt-Tab nur für SuperAdmin anzeigen
  const tabs = isSuperAdmin
    ? [...baseTabs, { id: 'rabatt', label: 'Mitglieder-Rabatt', icon: '🏷️' }]
    : baseTabs;

  // basisInputStyle and basisLabelStyle migrated to CSS classes af3-basis-input / af3-basis-label

  // Render Tab Content
  const renderTabBasis = () => (
    <div className="tab-content-section">
      <div className="af3-basis-grid">
        <div className="af-flex-col">
          <label className="af3-basis-label">Artikelgruppe *</label>
          <div className="af-flex-row">
            <select
              value={selectedHauptkategorieId}
              onChange={(e) => {
                setSelectedHauptkategorieId(e.target.value);
                // Reset artikelgruppe_id und setze kategorie_id wenn Hauptkategorie wechselt
                setFormData(prev => ({ ...prev, artikelgruppe_id: '', kategorie_id: e.target.value }));
              }}
              required
              className="af3-select"
            >
              <option value="">Wählen Sie eine Artikelgruppe...</option>
              {artikelgruppen.map(gruppe => (
                <option key={gruppe.id} value={gruppe.id}>
                  {gruppe.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setNeueGruppeTyp('hauptkategorie');
                setNeueGruppeName('');
                setShowGruppeModal(true);
              }}
              className="af3-add-btn"
              title="Neue Artikelgruppe erstellen"
            >
              +
            </button>
          </div>
        </div>

        <div className="af-flex-col">
          <label className="af3-basis-label">Unterkategorie</label>
          <div className="af-flex-row">
            <select
              name="artikelgruppe_id"
              value={formData.artikelgruppe_id}
              onChange={handleInputChange}
              className="af3-select"
              disabled={!selectedHauptkategorieId}
            >
              <option value="">{!selectedHauptkategorieId ? 'Erst Artikelgruppe wählen...' : getUnterkategorien().length === 0 ? 'Keine Unterkategorien' : 'Wählen Sie eine Unterkategorie...'}</option>
              {getUnterkategorien().map(unter => (
                <option key={unter.id} value={unter.id}>
                  {unter.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                if (!selectedHauptkategorieId) {
                  alert('Bitte wählen Sie zuerst eine Artikelgruppe');
                  return;
                }
                setNeueGruppeTyp('unterkategorie');
                setNeueGruppeName('');
                setShowGruppeModal(true);
              }}
              disabled={!selectedHauptkategorieId}
              className="af3-btn-neue-gruppe"
              title="Neue Unterkategorie erstellen"
            >
              +
            </button>
          </div>
        </div>

        <div className="af2-flex-col-fullspan">
          <label className="af3-basis-label">Artikelname *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className="af3-basis-input"
            placeholder="z.B. Proteinriegel Schokolade 50g"
          />
        </div>

        <div className="af2-flex-col-fullspan">
          <label className="af3-basis-label">Beschreibung</label>
          <textarea
            name="beschreibung"
            value={formData.beschreibung}
            onChange={handleInputChange}
            rows="3"
            className="af3-basis-input af3-textarea-resize"
            placeholder="Produktbeschreibung..."
          />
        </div>

        <div className="af-flex-col">
          <label className="af3-basis-label">EAN-Code</label>
          <input
            type="text"
            name="ean_code"
            value={formData.ean_code}
            onChange={handleInputChange}
            className="af3-basis-input"
            placeholder="z.B. 4250123456789"
          />
        </div>

        <div className="af-flex-col">
          <label className="af3-basis-label">Artikelnummer</label>
          <input
            type="text"
            name="artikel_nummer"
            value={formData.artikel_nummer}
            onChange={handleInputChange}
            className="af3-basis-input"
            placeholder="Wird automatisch generiert"
          />
          {mode === 'create' && formData.artikel_nummer && (
            <small className="af3-autogen-note">
              ✓ Auto-generiert basierend auf Artikelgruppe
            </small>
          )}
        </div>
      </div>
    </div>
  );

  const renderTabPreise = () => {
    // Berechnungen für Handelskalkulation
    const listeneinkaufspreis = parseFloat(formData.listeneinkaufspreis_euro) || 0;
    const lieferrabatt_prozent = parseFloat(formData.lieferrabatt_prozent) || 0;
    const lieferskonto_prozent = parseFloat(formData.lieferskonto_prozent) || 0;
    const bezugskosten = parseFloat(formData.bezugskosten_euro) || 0;
    const gemeinkosten_prozent = parseFloat(formData.gemeinkosten_prozent) || 0;
    const gewinnzuschlag_prozent = parseFloat(formData.gewinnzuschlag_prozent) || 0;
    const kundenskonto_prozent = parseFloat(formData.kundenskonto_prozent) || 0;
    const kundenrabatt_prozent = parseFloat(formData.kundenrabatt_prozent) || 0;
    const mwst_prozent = parseFloat(formData.mwst_prozent) || 19;

    // Bezugskalkulation
    const listeneinkaufspreis_wert = listeneinkaufspreis;
    const lieferrabatt_euro = listeneinkaufspreis_wert * (lieferrabatt_prozent / 100);
    const zieleinkaufspreis = listeneinkaufspreis_wert - lieferrabatt_euro;
    const lieferskonto_euro = zieleinkaufspreis * (lieferskonto_prozent / 100);
    const bareinkaufspreis = zieleinkaufspreis - lieferskonto_euro;
    const bezugskosten_wert = bezugskosten;
    const bezugspreis = bareinkaufspreis + bezugskosten_wert;

    // Selbstkostenkalkulation
    const gemeinkosten_euro = bezugspreis * (gemeinkosten_prozent / 100);
    const selbstkostenpreis = bezugspreis + gemeinkosten_euro;
    const gewinnzuschlag_euro = selbstkostenpreis * (gewinnzuschlag_prozent / 100);

    // Verkaufskalkulation
    const barverkaufspreis = selbstkostenpreis + gewinnzuschlag_euro;
    const kundenskonto_euro = barverkaufspreis * (kundenskonto_prozent / 100);
    const zielverkaufspreis = barverkaufspreis + kundenskonto_euro;
    const kundenrabatt_euro = zielverkaufspreis * (kundenrabatt_prozent / 100);
    const nettoverkaufspreis = zielverkaufspreis + kundenrabatt_euro;
    const umsatzsteuer_euro = nettoverkaufspreis * (mwst_prozent / 100);
    const bruttoverkaufspreis = nettoverkaufspreis + umsatzsteuer_euro;

    // Gewinn
    const gewinn_gesamt = nettoverkaufspreis - bezugspreis;
    const gewinnspanne_prozent = bezugspreis > 0 ? (gewinn_gesamt / bezugspreis) * 100 : 0;

    const handlePreisUebernehmen = () => {
      setFormData(prev => ({
        ...prev,
        verkaufspreis_euro: nettoverkaufspreis.toFixed(2),
        einkaufspreis_euro: bareinkaufspreis.toFixed(2)
      }));
    };

    // Hilfsfunktion: Größe einer Kategorie zuordnen
    const toggleGroesseKategorie = (groesse, kategorie) => {
      if (kategorie === 'kids') {
        setFormData(prev => ({
          ...prev,
          groessen_kids: prev.groessen_kids.includes(groesse)
            ? prev.groessen_kids.filter(g => g !== groesse)
            : [...prev.groessen_kids, groesse],
          groessen_erwachsene: prev.groessen_erwachsene.filter(g => g !== groesse)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          groessen_erwachsene: prev.groessen_erwachsene.includes(groesse)
            ? prev.groessen_erwachsene.filter(g => g !== groesse)
            : [...prev.groessen_erwachsene, groesse],
          groessen_kids: prev.groessen_kids.filter(g => g !== groesse)
        }));
      }
    };

    return (
      <div className="tab-content-section af3-preis-tab-root">
        <div className="preiskalkulation-container af3-preiskalkulation-container">

          {/* Eingabebereich */}
          <div className="preis-eingabe-section af3-preis-eingabe-section">

            {/* TAB-AUSWAHL */}
            <div className="af3-preis-tab-bar">
              <button
                type="button"
                onClick={() => setPreisTab('einzelkalkulation')}
                className={`af3-preis-tab-btn ${preisTab === 'einzelkalkulation' ? 'af3-preis-tab-btn--active' : ''}`}
              >
                💰 Einzel
              </button>
              <button
                type="button"
                onClick={() => setPreisTab('groessenabhaengig')}
                className={`af3-preis-tab-btn ${preisTab === 'groessenabhaengig' ? 'af3-preis-tab-btn--active' : ''}`}
              >
                👶🧑 Größen
              </button>
              <button
                type="button"
                onClick={() => setPreisTab('uebersicht')}
                className={`af3-preis-tab-btn ${preisTab === 'uebersicht' ? 'af3-preis-tab-btn--active' : ''}`}
              >
                ✓ Übersicht
              </button>
            </div>

            {/* GEMEINSAME HANDELSKALKULATION - NUR für Einzel Tab */}
            {preisTab === 'einzelkalkulation' && (
            <>
            <h3 className="af3-kalk-h3">
              📝 Handelskalkulation
            </h3>

            {/* BEZUGSKALKULATION */}
            <div className="af3-kalk-subsection">
              <h4 className="af3-kalk-h4">
                📦 Bezugskalkulation
              </h4>
              <div className="af3-kalk-field-grid-2">
                <div>
                  <label className="af3-kalk-field-label">Listeneinkaufspreis (€)</label>
                  <input type="number" name="listeneinkaufspreis_euro" value={formData.listeneinkaufspreis_euro} onChange={handleInputChange} step="0.01" min="0" className="form-input af3-kalk-field-input" placeholder="0.00" />
                </div>
                <div>
                  <label className="af3-kalk-field-label">Lieferrabatt (%)</label>
                  <input type="number" name="lieferrabatt_prozent" value={formData.lieferrabatt_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input af3-kalk-field-input" placeholder="0.00" />
                </div>
                <div>
                  <label className="af3-kalk-field-label">Lieferskonto (%)</label>
                  <input type="number" name="lieferskonto_prozent" value={formData.lieferskonto_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input af3-kalk-field-input" placeholder="0.00" />
                </div>
                <div>
                  <label className="af3-kalk-field-label">Bezugskosten (€)</label>
                  <input type="number" name="bezugskosten_euro" value={formData.bezugskosten_euro} onChange={handleInputChange} step="0.01" min="0" className="form-input af3-kalk-field-input" placeholder="0.00" />
                </div>
              </div>
            </div>

            {/* SELBSTKOSTENKALKULATION */}
            <div className="af3-kalk-subsection">
              <h4 className="af3-kalk-h4">
                🏭 Selbstkosten
              </h4>
              <div className="af3-kalk-field-grid-2">
                <div>
                  <label className="af3-kalk-field-label">Gemeinkosten (%)</label>
                  <input type="number" name="gemeinkosten_prozent" value={formData.gemeinkosten_prozent} onChange={handleInputChange} step="0.01" min="0" className="form-input af3-kalk-field-input" placeholder="0.00" />
                </div>
                <div>
                  <label className="af3-kalk-field-label">Gewinnzuschlag (%)</label>
                  <input type="number" name="gewinnzuschlag_prozent" value={formData.gewinnzuschlag_prozent} onChange={handleInputChange} step="0.01" min="0" className="form-input af3-kalk-field-input" placeholder="0.00" />
                </div>
              </div>
            </div>

            {/* VERKAUFSKALKULATION */}
            <div className="af3-kalk-subsection">
              <h4 className="af3-kalk-h4">
                💰 Verkauf
              </h4>
              <div className="af3-kalk-field-grid-3">
                <div>
                  <label className="af3-kalk-field-label">Kundenskonto (%)</label>
                  <input type="number" name="kundenskonto_prozent" value={formData.kundenskonto_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input af3-kalk-field-input" placeholder="0.00" />
                </div>
                <div>
                  <label className="af3-kalk-field-label">Kundenrabatt (%)</label>
                  <input type="number" name="kundenrabatt_prozent" value={formData.kundenrabatt_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input af3-kalk-field-input" placeholder="0.00" />
                </div>
                <div>
                  <label className="af3-kalk-field-label">MwSt. (%)</label>
                  <select name="mwst_prozent" value={formData.mwst_prozent} onChange={handleInputChange} className="form-select af3-kalk-mwst-select">
                    <option value="7.00">7%</option>
                    <option value="19.00">19%</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Button: Neuen Preis übernehmen - nur bei Einzelkalkulation */}
            {preisTab === 'einzelkalkulation' && listeneinkaufspreis > 0 && nettoverkaufspreis > 0 && (
              <div className="af3-preis-uebernehmen-box">
                <div className="af3-preis-uebernehmen-label">
                  Kalkulierter Nettoverkaufspreis: <strong>{nettoverkaufspreis.toFixed(2)} €</strong>
                </div>
                <button
                  type="button"
                  onClick={handlePreisUebernehmen}
                  className="af3-preis-uebernehmen-btn"
                  onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
                >
                  ✅ Neuen Preis übernehmen
                </button>
              </div>
            )}
            </>
            )}

            {/* GRÖSSENABHÄNGIGE EINKAUFSPREISE - nur wenn Tab aktiv */}
            {preisTab === 'groessenabhaengig' && (
              <div className="af3-groessen-section">
                <h4 className="af3-groessen-heading">
                  👶🧑 Größenabhängige Einkaufspreise
                </h4>
                <p className="af3-groessen-hint">
                  Unterschiedliche EK-Preise für Kids und Erwachsene eingeben. Die Kalkulationsparameter unten gelten für beide.
                </p>

                {/* EK-Eingaben */}
                <div className="af3-groessen-ek-grid">
                  <div>
                    <label className="af3-ek-kids-label">
                      👶 Listeneinkaufspreis Kids (€)
                    </label>
                    <input
                      type="number"
                      name="listeneinkaufspreis_kids_euro"
                      value={formData.listeneinkaufspreis_kids_euro}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      className="af3-ek-kids-input"
                      placeholder="z.B. 20.00"
                    />
                  </div>
                  <div>
                    <label className="af3-ek-erw-label">
                      🧑 Listeneinkaufspreis Erwachsene (€)
                    </label>
                    <input
                      type="number"
                      name="listeneinkaufspreis_erwachsene_euro"
                      value={formData.listeneinkaufspreis_erwachsene_euro}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      className="af3-ek-erw-input"
                      placeholder="z.B. 35.00"
                    />
                  </div>
                </div>

                {/* Bezugskosten-Eingaben */}
                <div className="u-grid-2col">
                  <div>
                    <label className="af3-bezug-kids-label">
                      📦 Bezugskosten Kids (€)
                    </label>
                    <input
                      type="number"
                      name="bezugskosten_kids_euro"
                      value={formData.bezugskosten_kids_euro}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      className="af3-bezug-kids-input"
                      placeholder="z.B. 5.00"
                    />
                  </div>
                  <div>
                    <label className="af3-bezug-erw-label">
                      📦 Bezugskosten Erwachsene (€)
                    </label>
                    <input
                      type="number"
                      name="bezugskosten_erwachsene_euro"
                      value={formData.bezugskosten_erwachsene_euro}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      className="af3-bezug-erw-input"
                      placeholder="z.B. 5.00"
                    />
                  </div>
                </div>

                {/* Kalkulationsparameter für Größen */}
                <div className="af3-kalk-params-box">
                  <p className="af3-kalk-params-title">
                    📊 Kalkulationsparameter (für beide Kategorien)
                  </p>

                  {/* Bezugskalkulation */}
                  <div className="af2-mb-075">
                    <p className="af2-primary-label">📦 Bezugskalkulation</p>
                    <div className="af2-grid-2col-05">
                      <div>
                        <label className="af-meta-text-block">Lieferrabatt (%)</label>
                        <input type="number" name="lieferrabatt_prozent" value={formData.lieferrabatt_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input af2-input-sm" placeholder="0" />
                      </div>
                      <div>
                        <label className="af-meta-text-block">Lieferskonto (%)</label>
                        <input type="number" name="lieferskonto_prozent" value={formData.lieferskonto_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input af2-input-sm" placeholder="0" />
                      </div>
                    </div>
                  </div>

                  {/* Selbstkosten */}
                  <div className="af2-mb-075">
                    <p className="af2-primary-label">🏭 Selbstkosten</p>
                    <div className="af2-grid-2col-05">
                      <div>
                        <label className="af-meta-text-block">Gemeinkosten (%)</label>
                        <input type="number" name="gemeinkosten_prozent" value={formData.gemeinkosten_prozent} onChange={handleInputChange} step="0.01" min="0" className="form-input af2-input-sm" placeholder="0" />
                      </div>
                      <div>
                        <label className="af-meta-text-block">Gewinnzuschlag (%)</label>
                        <input type="number" name="gewinnzuschlag_prozent" value={formData.gewinnzuschlag_prozent} onChange={handleInputChange} step="0.01" min="0" className="form-input af2-input-sm" placeholder="0" />
                      </div>
                    </div>
                  </div>

                  {/* Verkauf */}
                  <div>
                    <p className="af2-primary-label">💰 Verkauf</p>
                    <div className="af3-grid-3col-05">
                      <div>
                        <label className="af-meta-text-block">Kundenskonto (%)</label>
                        <input type="number" name="kundenskonto_prozent" value={formData.kundenskonto_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input af2-input-sm" placeholder="0" />
                      </div>
                      <div>
                        <label className="af-meta-text-block">Kundenrabatt (%)</label>
                        <input type="number" name="kundenrabatt_prozent" value={formData.kundenrabatt_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input af2-input-sm" placeholder="0" />
                      </div>
                      <div>
                        <label className="af-meta-text-block">MwSt. (%)</label>
                        <select name="mwst_prozent" value={formData.mwst_prozent} onChange={handleInputChange} className="form-select af3-mwst-select">
                          <option value="7.00">7%</option>
                          <option value="19.00">19%</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preis übernehmen Button direkt im Größen-Tab */}
                {(() => {
                  const lieferrabatt = parseFloat(formData.lieferrabatt_prozent) || 0;
                  const lieferskonto = parseFloat(formData.lieferskonto_prozent) || 0;
                  const gemeinkosten = parseFloat(formData.gemeinkosten_prozent) || 0;
                  const gewinnzuschlag = parseFloat(formData.gewinnzuschlag_prozent) || 0;
                  const kundenskonto = parseFloat(formData.kundenskonto_prozent) || 0;
                  const kundenrabatt = parseFloat(formData.kundenrabatt_prozent) || 0;
                  const mwst = parseFloat(formData.mwst_prozent) || 19;
                  const kidsEK = parseFloat(formData.listeneinkaufspreis_kids_euro) || 0;
                  const erwEK = parseFloat(formData.listeneinkaufspreis_erwachsene_euro) || 0;
                  const bezugsKids = parseFloat(formData.bezugskosten_kids_euro) || 0;
                  const bezugsErw = parseFloat(formData.bezugskosten_erwachsene_euro) || 0;
                  if (kidsEK === 0 && erwEK === 0) return null;
                  const calc = (ek, bezug) => {
                    const ziel = ek * (1 - lieferrabatt / 100);
                    const bar  = ziel * (1 - lieferskonto / 100);
                    const bp   = bar + bezug;
                    const sk   = bp * (1 + gemeinkosten / 100);
                    const bvk  = sk * (1 + gewinnzuschlag / 100);
                    const zvk  = bvk * (1 + kundenskonto / 100);
                    const netto = zvk * (1 + kundenrabatt / 100);
                    return { netto, brutto: netto * (1 + mwst / 100) };
                  };
                  const kids = kidsEK > 0 ? calc(kidsEK, bezugsKids) : null;
                  const erw  = erwEK  > 0 ? calc(erwEK,  bezugsErw)  : null;
                  return (
                    <div className="af3-groessen-result-box">
                      <div className="af3-groessen-result-row">
                        {kids && <span className="af3-result-kids-span">👶 Kids: {kids.netto.toFixed(2)} € Netto / {kids.brutto.toFixed(2)} € Brutto</span>}
                        {erw  && <span className="af3-result-erw-span">🧑 Erw.: {erw.netto.toFixed(2)} € Netto / {erw.brutto.toFixed(2)} € Brutto</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            hat_preiskategorien: true,
                            preis_kids_euro: kids ? kids.netto.toFixed(2) : prev.preis_kids_euro,
                            preis_erwachsene_euro: erw ? erw.netto.toFixed(2) : prev.preis_erwachsene_euro,
                            verkaufspreis_euro: erw ? erw.netto.toFixed(2) : (kids ? kids.netto.toFixed(2) : prev.verkaufspreis_euro)
                          }));
                        }}
                        className="af2-submit-btn"
                      >
                        ✅ Größenpreise übernehmen &amp; speichern
                      </button>
                    </div>
                  );
                })()}

                {/* Größen-Zuordnung */}
                {formData.hat_varianten && formData.varianten_groessen.length > 0 && (
                  <div className="af3-groessen-zuordnung">
                    <p className="af3-groessen-zuordnung-title">
                      📏 Größen-Zuordnung (klicken zum Ändern)
                    </p>
                    <div className="u-grid-2col">
                      {/* Kids Spalte */}
                      <div>
                        <p className="af3-groessen-kids-label">👶 Kids-Größen:</p>
                        <div className="af2-flex-wrap-tags">
                          {formData.varianten_groessen.map(g => {
                            const isKids = formData.groessen_kids.includes(g);
                            if (!isKids) return null;
                            return (
                              <button
                                key={g}
                                type="button"
                                onClick={() => toggleGroesseKategorie(g, 'erwachsene')}
                                className="af3-tag-kids"
                                title="Klicken um zu Erwachsene zu verschieben"
                              >
                                {g}
                              </button>
                            );
                          })}
                          {formData.varianten_groessen.filter(g => formData.groessen_kids.includes(g)).length === 0 && (
                            <span className="af2-muted-italic">Keine</span>
                          )}
                        </div>
                      </div>

                      {/* Erwachsene Spalte */}
                      <div>
                        <p className="af3-groessen-erw-label">🧑 Erwachsene-Größen:</p>
                        <div className="af2-flex-wrap-tags">
                          {formData.varianten_groessen.map(g => {
                            const isErwachsene = formData.groessen_erwachsene.includes(g);
                            if (!isErwachsene) return null;
                            return (
                              <button
                                key={g}
                                type="button"
                                onClick={() => toggleGroesseKategorie(g, 'kids')}
                                className="af3-tag-erw"
                                title="Klicken um zu Kids zu verschieben"
                              >
                                {g}
                              </button>
                            );
                          })}
                          {formData.varianten_groessen.filter(g => formData.groessen_erwachsene.includes(g)).length === 0 && (
                            <span className="af2-muted-italic">Keine</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hinweis wenn keine Varianten */}
                {(!formData.hat_varianten || formData.varianten_groessen.length === 0) && (
                  <div className="af3-no-variant-hint">
                    ⚠️ Bitte zuerst im Tab "Varianten" die Größen aktivieren
                  </div>
                )}
              </div>
            )}

            {/* ÜBERSICHT TAB - Preise übernehmen */}
            {preisTab === 'uebersicht' && (
              <div className="af3-uebersicht-section">
                <h4 className="af3-uebersicht-heading">
                  ✓ Preise übernehmen
                </h4>
                <p className="af3-uebersicht-hint">
                  Übernehmen Sie die berechneten Preise für diesen Artikel.
                </p>

                {/* Einzelpreis Übernahme */}
                {(() => {
                  const lieferrabatt = parseFloat(formData.lieferrabatt_prozent) || 0;
                  const lieferskonto = parseFloat(formData.lieferskonto_prozent) || 0;
                  const bezugskosten = parseFloat(formData.bezugskosten_euro) || 0;
                  const gemeinkosten = parseFloat(formData.gemeinkosten_prozent) || 0;
                  const gewinnzuschlag = parseFloat(formData.gewinnzuschlag_prozent) || 0;
                  const kundenskonto = parseFloat(formData.kundenskonto_prozent) || 0;
                  const kundenrabatt = parseFloat(formData.kundenrabatt_prozent) || 0;
                  const mwst = parseFloat(formData.mwst_prozent) || 19;

                  // Einzelkalkulation
                  const einzelEK = parseFloat(formData.listeneinkaufspreis_euro) || 0;
                  const einzelZielEK = einzelEK * (1 - lieferrabatt / 100);
                  const einzelBareEK = einzelZielEK * (1 - lieferskonto / 100);
                  const einzelBezug = einzelBareEK + bezugskosten;
                  const einzelSelbstkosten = einzelBezug * (1 + gemeinkosten / 100);
                  const einzelBarVK = einzelSelbstkosten * (1 + gewinnzuschlag / 100);
                  const einzelZielVK = einzelBarVK * (1 + kundenskonto / 100);
                  const einzelNettoVK = einzelZielVK * (1 + kundenrabatt / 100);
                  const einzelBruttoVK = einzelNettoVK * (1 + mwst / 100);

                  // Größenabhängige Kalkulation - Kids
                  const kidsEK = parseFloat(formData.listeneinkaufspreis_kids_euro) || 0;
                  const kidsZielEK = kidsEK * (1 - lieferrabatt / 100);
                  const kidsBareEK = kidsZielEK * (1 - lieferskonto / 100);
                  const kidsBezug = kidsBareEK + bezugskosten;
                  const kidsSelbstkosten = kidsBezug * (1 + gemeinkosten / 100);
                  const kidsBarVK = kidsSelbstkosten * (1 + gewinnzuschlag / 100);
                  const kidsZielVK = kidsBarVK * (1 + kundenskonto / 100);
                  const kidsNettoVK = kidsZielVK * (1 + kundenrabatt / 100);
                  const kidsBruttoVK = kidsNettoVK * (1 + mwst / 100);

                  // Größenabhängige Kalkulation - Erwachsene
                  const erwEK = parseFloat(formData.listeneinkaufspreis_erwachsene_euro) || 0;
                  const erwZielEK = erwEK * (1 - lieferrabatt / 100);
                  const erwBareEK = erwZielEK * (1 - lieferskonto / 100);
                  const erwBezug = erwBareEK + bezugskosten;
                  const erwSelbstkosten = erwBezug * (1 + gemeinkosten / 100);
                  const erwBarVK = erwSelbstkosten * (1 + gewinnzuschlag / 100);
                  const erwZielVK = erwBarVK * (1 + kundenskonto / 100);
                  const erwNettoVK = erwZielVK * (1 + kundenrabatt / 100);
                  const erwBruttoVK = erwNettoVK * (1 + mwst / 100);

                  // Prüfen ob Kalkulation Ergebnisse liefert
                  // Einzelpreis nur anzeigen wenn tatsächlich ein Einzel-EK eingegeben wurde
                  const hasEinzel = einzelEK > 0;
                  // Größenabhängige Preise anzeigen wenn Kids oder Erwachsene EK eingegeben wurde
                  const hasKids = kidsEK > 0;
                  const hasErw = erwEK > 0;
                  const hasGroessen = hasKids || hasErw;

                  return (
                    <div>
                      {/* Einzelpreis */}
                      {hasEinzel && (
                        <div className="af3-einzelpreis-box">
                          <div className="af-flex-between-mb">
                            <span className="af3-einzel-label">💰 Einzelpreis</span>
                            <span className="af3-einzel-brutto">{einzelBruttoVK.toFixed(2)} € Brutto</span>
                          </div>
                          <div className="af3-einzelpreis-detail">
                            Netto: {einzelNettoVK.toFixed(2)} € | Bezugspreis: {einzelBezug.toFixed(2)} €
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                verkaufspreis_euro: einzelNettoVK.toFixed(2),
                                hat_preiskategorien: false
                              }));
                              alert('✅ Einzelpreis wurde übernommen!');
                            }}
                            className="af3-einzelpreis-uebernehmen-btn"
                          >
                            ✅ Einzelpreis übernehmen
                          </button>
                        </div>
                      )}

                      {/* Größenabhängige Preise */}
                      {hasGroessen && (
                        <div className="af3-groessen-preise-box">
                          <div className="af3-groessen-preise-title">
                            👶🧑 Größenabhängige Preise
                          </div>

                          {hasKids && (
                            <div className="af3-price-row-kids">
                              <span className="af3-price-kids-label">👶 Kids</span>
                              <span className="af3-price-kids-value">{kidsBruttoVK.toFixed(2)} € Brutto</span>
                            </div>
                          )}

                          {hasErw && (
                            <div className="af3-price-row-erw">
                              <span className="af3-price-erw-label">🧑 Erwachsene</span>
                              <span className="af3-price-erw-value">{erwBruttoVK.toFixed(2)} € Brutto</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setFormData(prev => ({
                                ...prev,
                                hat_preiskategorien: true,
                                preis_kids_euro: kidsNettoVK.toFixed(2),
                                preis_erwachsene_euro: erwNettoVK.toFixed(2),
                                verkaufspreis_euro: erwNettoVK.toFixed(2)
                              }));
                            }}
                            className="af2-submit-btn"
                          >
                            ✅ Größenpreise übernehmen
                          </button>
                        </div>
                      )}

                      {/* Hinweis wenn keine Preise */}
                      {!hasEinzel && !hasGroessen && (
                        <div className="af3-no-prices-hint">
                          <p className="af3-no-prices-p">⚠️ Keine Preise berechnet</p>
                          <p className="af2-fs-085">
                            Bitte zum Tab "💰 Einzel" oder "👶🧑 Größen" wechseln und Einkaufspreise eingeben.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Kalkulationsübersicht */}
          <div className={`preis-kalkulation-section af3-kalk-section ${preisTab === 'uebersicht' ? 'af3-kalk-section--uebersicht' : 'af3-kalk-section--kalk'}`}>
            <h3 className={`af3-kalk-h3-base ${preisTab === 'uebersicht' ? 'af3-kalk-h3-base--uebersicht' : ''}`}>
              {preisTab === 'uebersicht' ? '✓ Aktuelle Artikelpreise' : preisTab === 'groessenabhaengig' ? '📊 Größenabhängige Kalkulation' : '📊 Handelskalkulation'}
            </h3>

            {/* ÜBERSICHT - Aktuelle gespeicherte Preise mit Varianten */}
            {preisTab === 'uebersicht' && (
              <div>
                <p className="af3-uebersicht-meta">
                  Artikelpreise nach Variante:
                </p>

                {(() => {
                  const mwst = parseFloat(formData.mwst_prozent) || 19;
                  const vkNetto = parseFloat(formData.verkaufspreis_euro) || 0;
                  const kidsNetto = parseFloat(formData.preis_kids_euro) || 0;
                  const erwNetto = parseFloat(formData.preis_erwachsene_euro) || 0;
                  const basisArtNr = formData.artikel_nummer || 'ART-XXX';
                  const groessenKids = formData.groessen_kids || [];
                  const groessenErw = formData.groessen_erwachsene || [];

                  // Alle Varianten sammeln
                  const varianten = [];

                  // Wenn Größen aktiviert sind
                  if (formData.hat_varianten && formData.varianten_groessen?.length > 0) {
                    formData.varianten_groessen.forEach(groesse => {
                      const isKids = groessenKids.includes(groesse);
                      const netto = isKids ? kidsNetto : erwNetto;
                      const mwstBetrag = netto * (mwst / 100);
                      const brutto = netto + mwstBetrag;
                      varianten.push({
                        artNr: `${basisArtNr}-${groesse}`,
                        groesse,
                        typ: isKids ? 'kids' : 'erw',
                        netto,
                        mwstBetrag,
                        brutto
                      });
                    });
                  } else if (vkNetto > 0) {
                    // Einzelartikel ohne Varianten
                    const mwstBetrag = vkNetto * (mwst / 100);
                    varianten.push({
                      artNr: basisArtNr,
                      groesse: null,
                      typ: 'einzel',
                      netto: vkNetto,
                      mwstBetrag,
                      brutto: vkNetto + mwstBetrag
                    });
                  }

                  if (varianten.length === 0) {
                    return (
                      <div className="af2-empty-state">
                        <p className="af3-empty-hint-sub">Noch keine Preise gespeichert</p>
                        <p className="af2-fs-085">Übernehmen Sie links die berechneten Preise</p>
                      </div>
                    );
                  }

                  return (
                    <div>
                      {/* Tabellen-Header */}
                      <div className="af3-varianten-table-header">
                        <span>ArtNr.</span>
                        <span className="af2-text-right">Netto</span>
                        <span className="af2-text-right">MwSt</span>
                        <span className="af2-text-right">Brutto</span>
                      </div>

                      {/* Varianten-Liste */}
                      {varianten.map((v, idx) => (
                        <div
                          key={idx}
                          className={`af3-varianten-table-row af3-varianten-table-row--${v.typ}`}
                        >
                          <span className={`af3-gewinn-span af3-gewinn-span--${v.typ}`}>
                            {v.typ === 'kids' ? '👶 ' : v.typ === 'erw' ? '🧑 ' : '💰 '}{v.artNr}
                          </span>
                          <span className="af2-text-right">{v.netto.toFixed(2)} €</span>
                          <span className="af2-text-right u-text-secondary">{v.mwstBetrag.toFixed(2)} €</span>
                          <span className="af2-text-right af2-fw700">{v.brutto.toFixed(2)} €</span>
                        </div>
                      ))}

                      {/* Zusammenfassung */}
                      <div className="af3-varianten-table-footer">
                        {varianten.length} Artikel | MwSt: {mwst}%
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* GRÖSSENABHÄNGIGE KALKULATION - Vollständig für Kids und Erwachsene */}
            {preisTab === 'groessenabhaengig' && (
              (() => {
                // Prozentsätze aus der Handelskalkulation
                const lieferrabatt = parseFloat(formData.lieferrabatt_prozent) || 0;
                const lieferskonto = parseFloat(formData.lieferskonto_prozent) || 0;
                const gemeinkosten = parseFloat(formData.gemeinkosten_prozent) || 0;
                const gewinnzuschlag = parseFloat(formData.gewinnzuschlag_prozent) || 0;
                const kundenskonto = parseFloat(formData.kundenskonto_prozent) || 0;
                const kundenrabatt = parseFloat(formData.kundenrabatt_prozent) || 0;
                const mwst = parseFloat(formData.mwst_prozent) || 19;

                // Separate Bezugskosten für Kids und Erwachsene
                const bezugskostenKids = parseFloat(formData.bezugskosten_kids_euro) || 0;
                const bezugskostenErw = parseFloat(formData.bezugskosten_erwachsene_euro) || 0;

                // Kids Kalkulation
                const kidsEK = parseFloat(formData.listeneinkaufspreis_kids_euro) || 0;
                const kidsZielEK = kidsEK * (1 - lieferrabatt / 100);
                const kidsBareEK = kidsZielEK * (1 - lieferskonto / 100);
                const kidsBezug = kidsBareEK + bezugskostenKids;
                const kidsSelbstkosten = kidsBezug * (1 + gemeinkosten / 100);
                const kidsBarVK = kidsSelbstkosten * (1 + gewinnzuschlag / 100);
                const kidsZielVK = kidsBarVK * (1 + kundenskonto / 100);
                const kidsNettoVK = kidsZielVK * (1 + kundenrabatt / 100);
                const kidsBruttoVK = kidsNettoVK * (1 + mwst / 100);
                const kidsGewinn = kidsNettoVK - kidsBezug;
                const kidsGewinnProzent = kidsBezug > 0 ? (kidsGewinn / kidsBezug) * 100 : 0;

                // Erwachsene Kalkulation
                const erwEK = parseFloat(formData.listeneinkaufspreis_erwachsene_euro) || 0;
                const erwZielEK = erwEK * (1 - lieferrabatt / 100);
                const erwBareEK = erwZielEK * (1 - lieferskonto / 100);
                const erwBezug = erwBareEK + bezugskostenErw;
                const erwSelbstkosten = erwBezug * (1 + gemeinkosten / 100);
                const erwBarVK = erwSelbstkosten * (1 + gewinnzuschlag / 100);
                const erwZielVK = erwBarVK * (1 + kundenskonto / 100);
                const erwNettoVK = erwZielVK * (1 + kundenrabatt / 100);
                const erwBruttoVK = erwNettoVK * (1 + mwst / 100);
                const erwGewinn = erwNettoVK - erwBezug;
                const erwGewinnProzent = erwBezug > 0 ? (erwGewinn / erwBezug) * 100 : 0;

                const hasKids = kidsEK > 0;
                const hasErw = erwEK > 0;

                return (
                  <div>
                    {/* Hinweis wenn keine EK eingegeben */}
                    {!hasKids && !hasErw && (
                      <div className="af2-empty-state">
                        <p className="af3-empty-hint-sub">Bitte links die Einkaufspreise eingeben</p>
                        <p className="af2-fs-08">👶 Listeneinkaufspreis Kids</p>
                        <p className="af2-fs-08">🧑 Listeneinkaufspreis Erwachsene</p>
                      </div>
                    )}

                    {/* KIDS Vollständige Kalkulation */}
                    {hasKids && (
                      <div className="af3-kids-block">
                        <div className="af3-kids-block-title">
                          👶 KIDS ({formData.varianten_groessen?.filter(g => formData.groessen_kids?.includes(g)).join(', ') || 'alle'})
                        </div>
                        <div className="af2-success-hint">📦 Bezugskalkulation</div>
                        <div className="af-row-primary">
                          <span>Listeneinkaufspreis</span><span>{kidsEK.toFixed(2)} €</span>
                        </div>
                        {lieferrabatt > 0 && <div className="af-row-secondary-error">
                          <span>− Lieferrabatt ({lieferrabatt}%)</span><span>−{(kidsEK * lieferrabatt / 100).toFixed(2)} €</span>
                        </div>}
                        {lieferskonto > 0 && <div className="af-row-secondary-error">
                          <span>− Lieferskonto ({lieferskonto}%)</span><span>−{(kidsZielEK * lieferskonto / 100).toFixed(2)} €</span>
                        </div>}
                        {bezugskostenKids > 0 && <div className="af-row-secondary">
                          <span>+ Bezugskosten</span><span>+{bezugskostenKids.toFixed(2)} €</span>
                        </div>}
                        <div className="af-row-bold">
                          <span>= Bezugspreis</span><span>{kidsBezug.toFixed(2)} €</span>
                        </div>
                        <div className="af2-success-hint">🏭 Selbstkosten</div>
                        {gemeinkosten > 0 && <div className="af-row-secondary">
                          <span>+ Gemeinkosten ({gemeinkosten}%)</span><span>+{(kidsBezug * gemeinkosten / 100).toFixed(2)} €</span>
                        </div>}
                        <div className="af-row-bold">
                          <span>= Selbstkosten</span><span>{kidsSelbstkosten.toFixed(2)} €</span>
                        </div>
                        <div className="af2-success-hint">💰 Verkaufskalkulation</div>
                        <div className="af-row-secondary">
                          <span>+ Gewinnzuschlag ({gewinnzuschlag}%)</span><span>+{(kidsSelbstkosten * gewinnzuschlag / 100).toFixed(2)} €</span>
                        </div>
                        <div className="af-row-primary">
                          <span>= Barverkaufspreis</span><span>{kidsBarVK.toFixed(2)} €</span>
                        </div>
                        {kundenskonto > 0 && <div className="af-row-secondary">
                          <span>+ Kundenskonto ({kundenskonto}%)</span><span>+{(kidsZielVK - kidsBarVK).toFixed(2)} €</span>
                        </div>}
                        {kundenskonto > 0 && <div className="af-row-primary">
                          <span>= Zielverkaufspreis</span><span>{kidsZielVK.toFixed(2)} €</span>
                        </div>}
                        {kundenrabatt > 0 && <div className="af-row-secondary">
                          <span>+ Kundenrabatt ({kundenrabatt}%)</span><span>+{(kidsNettoVK - kidsZielVK).toFixed(2)} €</span>
                        </div>}
                        <div className="af3-kids-netto-row">
                          <span>= Netto-VK</span><span>{kidsNettoVK.toFixed(2)} €</span>
                        </div>
                        <div className="af-row-secondary">
                          <span>+ MwSt ({mwst}%)</span><span>+{(kidsNettoVK * mwst / 100).toFixed(2)} €</span>
                        </div>
                        <div className="af3-kids-brutto-row">
                          <span>= BRUTTO-VK</span>
                          <span className="af3-kalk-brutto-kids-span">{kidsBruttoVK.toFixed(2)} €</span>
                        </div>
                        <div className={`af3-kids-gewinn-row ${kidsGewinn >= 0 ? 'af3-gewinn--positive' : 'af3-gewinn--negative'}`}>
                          <span>💰 Gewinn (Netto − Bezug)</span>
                          <span className="af2-fw700">{kidsGewinn.toFixed(2)} € ({kidsGewinnProzent.toFixed(0)}%)</span>
                        </div>
                      </div>
                    )}

                    {/* ERWACHSENE Vollständige Kalkulation */}
                    {hasErw && (
                      <div className="af3-erw-block">
                        <div className="af3-erw-block-title">
                          🧑 ERWACHSENE ({formData.varianten_groessen?.filter(g => formData.groessen_erwachsene?.includes(g)).join(', ') || 'alle'})
                        </div>
                        <div className="af2-info-hint">📦 Bezugskalkulation</div>
                        <div className="af-row-primary">
                          <span>Listeneinkaufspreis</span><span>{erwEK.toFixed(2)} €</span>
                        </div>
                        {lieferrabatt > 0 && <div className="af-row-secondary-error">
                          <span>− Lieferrabatt ({lieferrabatt}%)</span><span>−{(erwEK * lieferrabatt / 100).toFixed(2)} €</span>
                        </div>}
                        {lieferskonto > 0 && <div className="af-row-secondary-error">
                          <span>− Lieferskonto ({lieferskonto}%)</span><span>−{(erwZielEK * lieferskonto / 100).toFixed(2)} €</span>
                        </div>}
                        {bezugskostenErw > 0 && <div className="af-row-secondary">
                          <span>+ Bezugskosten</span><span>+{bezugskostenErw.toFixed(2)} €</span>
                        </div>}
                        <div className="af-row-bold">
                          <span>= Bezugspreis</span><span>{erwBezug.toFixed(2)} €</span>
                        </div>
                        <div className="af2-info-hint">🏭 Selbstkosten</div>
                        {gemeinkosten > 0 && <div className="af-row-secondary">
                          <span>+ Gemeinkosten ({gemeinkosten}%)</span><span>+{(erwBezug * gemeinkosten / 100).toFixed(2)} €</span>
                        </div>}
                        <div className="af-row-bold">
                          <span>= Selbstkosten</span><span>{erwSelbstkosten.toFixed(2)} €</span>
                        </div>
                        <div className="af2-info-hint">💰 Verkaufskalkulation</div>
                        <div className="af-row-secondary">
                          <span>+ Gewinnzuschlag ({gewinnzuschlag}%)</span><span>+{(erwSelbstkosten * gewinnzuschlag / 100).toFixed(2)} €</span>
                        </div>
                        <div className="af-row-primary">
                          <span>= Barverkaufspreis</span><span>{erwBarVK.toFixed(2)} €</span>
                        </div>
                        {kundenskonto > 0 && <div className="af-row-secondary">
                          <span>+ Kundenskonto ({kundenskonto}%)</span><span>+{(erwZielVK - erwBarVK).toFixed(2)} €</span>
                        </div>}
                        {kundenskonto > 0 && <div className="af-row-primary">
                          <span>= Zielverkaufspreis</span><span>{erwZielVK.toFixed(2)} €</span>
                        </div>}
                        {kundenrabatt > 0 && <div className="af-row-secondary">
                          <span>+ Kundenrabatt ({kundenrabatt}%)</span><span>+{(erwNettoVK - erwZielVK).toFixed(2)} €</span>
                        </div>}
                        <div className="af3-erw-netto-row">
                          <span>= Netto-VK</span><span>{erwNettoVK.toFixed(2)} €</span>
                        </div>
                        <div className="af-row-secondary">
                          <span>+ MwSt ({mwst}%)</span><span>+{(erwNettoVK * mwst / 100).toFixed(2)} €</span>
                        </div>
                        <div className="af3-erw-brutto-row">
                          <span>= BRUTTO-VK</span>
                          <span className="af3-kalk-brutto-erw-span">{erwBruttoVK.toFixed(2)} €</span>
                        </div>
                        <div className={`af3-erw-gewinn-row ${erwGewinn >= 0 ? 'af3-gewinn--positive-blue' : 'af3-gewinn--negative'}`}>
                          <span>💰 Gewinn</span>
                          <span className="af2-fw700">{erwGewinn.toFixed(2)} € ({erwGewinnProzent.toFixed(0)}%)</span>
                        </div>
                      </div>
                    )}

                    {/* Preisdifferenz */}
                    {hasKids && hasErw && (
                      <div className="af3-preisdiff-box">
                        <div className="af3-preisdiff-main">
                          <span>📊 Preisdifferenz (Brutto)</span>
                          <span className="af2-fw700">{(erwBruttoVK - kidsBruttoVK).toFixed(2)} €</span>
                        </div>
                        <div className="af3-preisdiff-sub">
                          <span>Kids ist günstiger um</span>
                          <span className="af3-preisdiff-pct">{erwBruttoVK > 0 ? ((erwBruttoVK - kidsBruttoVK) / erwBruttoVK * 100).toFixed(0) : 0}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}

            {/* EINZELKALKULATION (Standard Handelskalkulation) */}
            {preisTab === 'einzelkalkulation' && (
            <div className="kalkulation-table af3-kalkulation-table-wrap">
              {/* BEZUGSKALKULATION */}
              <div className="af3-kalk-section-header">
                <strong>Bezugskalkulation</strong>
              </div>

              <div className="kalkulation-row af3-kalk-row-sm">
                <span>Listeneinkaufspreis</span>
                <span>{listeneinkaufspreis_wert.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row af3-kalk-row-sm-error">
                <span>− Lieferrabatt ({lieferrabatt_prozent}%)</span>
                <span>−{lieferrabatt_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total af3-kalk-row-total-sm">
                <span><strong>= Zieleinkaufspreis</strong></span>
                <span><strong>{zieleinkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row af3-kalk-row-sm-error">
                <span>− Lieferskonto ({lieferskonto_prozent}%)</span>
                <span>−{lieferskonto_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total af3-kalk-row-total-sm">
                <span><strong>= Bareinkaufspreis</strong></span>
                <span><strong>{bareinkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row af3-kalk-row-sm-primary">
                <span>+ Bezugskosten</span>
                <span>+{bezugskosten_wert.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total af3-kalk-row-total-md">
                <span><strong>= Bezugspreis</strong></span>
                <span><strong>{bezugspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="af3-kalk-spacer"></div>

              {/* SELBSTKOSTENKALKULATION */}
              <div className="af3-kalk-section-header">
                <strong>Selbstkostenkalkulation</strong>
              </div>

              <div className="kalkulation-row af3-kalk-row-sm-primary">
                <span>+ Gemeinkosten ({gemeinkosten_prozent}%)</span>
                <span>+{gemeinkosten_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total af3-kalk-row-total-sm">
                <span><strong>= Selbstkostenpreis</strong></span>
                <span><strong>{selbstkostenpreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row af3-kalk-row-sm-primary">
                <span>+ Gewinnzuschlag ({gewinnzuschlag_prozent}%)</span>
                <span>+{gewinnzuschlag_euro.toFixed(2)} €</span>
              </div>

              <div className="af3-kalk-spacer"></div>

              {/* VERKAUFSKALKULATION */}
              <div className="af3-kalk-section-header">
                <strong>Verkaufskalkulation</strong>
              </div>

              <div className="kalkulation-row total af3-kalk-row-total-sm">
                <span><strong>= Barverkaufspreis</strong></span>
                <span><strong>{barverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row af3-kalk-row-sm-primary">
                <span>+ Kundenskonto ({kundenskonto_prozent}%)</span>
                <span>+{kundenskonto_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total af3-kalk-row-total-sm">
                <span><strong>= Zielverkaufspreis</strong></span>
                <span><strong>{zielverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row af3-kalk-row-sm-primary">
                <span>+ Kundenrabatt ({kundenrabatt_prozent}%)</span>
                <span>+{kundenrabatt_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total af3-kalk-row-total-md">
                <span><strong>= Nettoverkaufspreis</strong></span>
                <span><strong>{nettoverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row af3-kalk-row-sm-primary">
                <span>+ Umsatzsteuer ({mwst_prozent}%)</span>
                <span>+{umsatzsteuer_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row final af3-kalk-row-final">
                <span><strong>= BRUTTOVERKAUFSPREIS</strong></span>
                <span className="af3-brutto-vk-val"><strong>{bruttoverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="af3-kalk-divider"></div>

              {/* GEWINN */}
              <div className="kalkulation-row profit af3-kalk-row-sm">
                <span>💰 Gewinn gesamt</span>
                <span className={`af3-gewinn-span ${gewinn_gesamt >= 0 ? 'af3-gewinn--primary' : 'af3-gewinn--negative'}`}>
                  {gewinn_gesamt.toFixed(2)} €
                </span>
              </div>

              <div className="kalkulation-row profit af3-kalk-row-sm">
                <span>📈 Gewinnspanne</span>
                <span className={`af3-gewinn-span ${gewinnspanne_prozent >= 0 ? 'af3-gewinn--primary' : 'af3-gewinn--negative'}`}>
                  {gewinnspanne_prozent.toFixed(1)} %
                </span>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // checkboxContainerStyle, checkboxStyle, checkboxLabelTextStyle migrated to CSS classes af3-checkbox-container / af3-checkbox / af3-checkbox-label-text

  // Varianten-Kombinationen generieren
  const getVariantenKombinationen = () => {
    const groessen = formData.varianten_groessen.length > 0 ? formData.varianten_groessen : [''];
    const farben = formData.varianten_farben.length > 0 ? formData.varianten_farben : [{ name: '', hex: '' }];
    const materialien = formData.varianten_material.length > 0 ? formData.varianten_material : [''];

    const kombinationen = [];
    groessen.forEach(g => {
      farben.forEach(f => {
        materialien.forEach(m => {
          const key = `${g}|${f.name}|${m}`;
          kombinationen.push({
            key,
            groesse: g,
            farbe: f,
            material: m,
            label: [g, f.name, m].filter(Boolean).join(' / ') || 'Standard'
          });
        });
      });
    });
    return kombinationen;
  };

  // Varianten-Bestand aktualisieren
  const updateVariantenBestand = (key, field, value) => {
    setFormData(prev => ({
      ...prev,
      varianten_bestand: {
        ...prev.varianten_bestand,
        [key]: {
          ...(prev.varianten_bestand[key] || { bestand: 0, mindestbestand: 0 }),
          [field]: parseInt(value) || 0
        }
      }
    }));
  };

  const renderTabLager = () => {
    const hatVarianten = formData.hat_varianten &&
      (formData.varianten_groessen.length > 0 || formData.varianten_farben.length > 0 || formData.varianten_material.length > 0);
    const kombinationen = hatVarianten ? getVariantenKombinationen() : [];

    return (
      <div className="tab-content-section af2-overflow-auto">
        {/* Lager-Tracking Checkbox */}
        <div className="af2-mb-15">
          <label
            className={`af3-checkbox-container af3-checkbox-container--lager ${formData.lager_tracking ? 'af3-checkbox-container--active' : ''}`}
          >
            <input
              type="checkbox"
              name="lager_tracking"
              checked={formData.lager_tracking}
              onChange={handleInputChange}
              className="af3-checkbox"
            />
            <span className="af3-checkbox-label-text">
              📦 Lagerbestand aktiv verfolgen
            </span>
          </label>
        </div>

        {formData.lager_tracking && (
          <>
            {/* Ohne Varianten: Einfache Bestandseingabe */}
            {!hatVarianten && (
              <div className="af3-lager-simple-grid">
                <div className="af-flex-col">
                  <label className="af3-basis-label">Aktueller Bestand</label>
                  <input
                    type="number"
                    name="lagerbestand"
                    value={formData.lagerbestand}
                    onChange={handleInputChange}
                    min="0"
                    className="af3-basis-input"
                    placeholder="0"
                  />
                </div>

                <div className="af-flex-col">
                  <label className="af3-basis-label">Mindestbestand</label>
                  <input
                    type="number"
                    name="mindestbestand"
                    value={formData.mindestbestand}
                    onChange={handleInputChange}
                    min="0"
                    className="af3-basis-input"
                    placeholder="0"
                  />
                </div>

                <div className="af-flex-col">
                  <label className="af3-basis-label">Artikelfarbe</label>
                  <div className="u-flex-gap-sm">
                    <input
                      type="color"
                      name="farbe_hex"
                      value={formData.farbe_hex}
                      onChange={handleInputChange}
                      className="af3-color-picker"
                    />
                    <input
                      type="text"
                      value={formData.farbe_hex}
                      onChange={(e) => setFormData(prev => ({...prev, farbe_hex: e.target.value}))}
                      className="af3-basis-input"
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Mit Varianten: Bestandstabelle für alle Kombinationen */}
            {hatVarianten && (
              <div>
                <div className="af3-lager-varianten-header">
                  <div>
                    <h3 className="af3-lager-varianten-title">
                      📊 Varianten-Bestand ({kombinationen.length} Kombinationen)
                    </h3>
                    <p className="af3-lager-varianten-subtitle">
                      Erfassen Sie den Bestand für jede Variante
                    </p>
                  </div>
                  <div className="u-flex-gap-sm">
                    <span className="af-gold-tag">
                      {formData.varianten_groessen.length} Größen
                    </span>
                    <span className="af-gold-tag">
                      {formData.varianten_farben.length} Farben
                    </span>
                    <span className="af-gold-tag">
                      {formData.varianten_material.length} Material
                    </span>
                  </div>
                </div>

                {/* Mindestbestand für alle setzen */}
                <div className="af3-lager-global-mindest-row">
                  <label className="af3-lager-global-mindest-label">
                    Mindestbestand für alle:
                  </label>
                  <input
                    type="number"
                    id="global-mindestbestand"
                    min="0"
                    placeholder="z.B. 5"
                    className="af3-lager-global-mindest-input"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const globalValue = parseInt(document.getElementById('global-mindestbestand').value) || 0;
                      const newBestand = { ...formData.varianten_bestand };
                      kombinationen.forEach(k => {
                        newBestand[k.key] = {
                          ...(newBestand[k.key] || { bestand: 0, mindestbestand: 0 }),
                          mindestbestand: globalValue
                        };
                      });
                      setFormData(prev => ({ ...prev, varianten_bestand: newBestand }));
                    }}
                    className="af3-lager-global-mindest-btn"
                  >
                    ✓ Für alle übernehmen
                  </button>
                </div>

                {/* Bestandstabelle */}
                <div className="af3-lager-table-container">
                  {/* Tabellen-Header */}
                  <div className="af3-lager-table-header">
                    <span>Variante</span>
                    <span>Bestand</span>
                    <span>Mindestbestand</span>
                    <span>Status</span>
                  </div>

                  {/* Tabellen-Inhalt */}
                  <div className="af3-varianten-table-scroll">
                    {kombinationen.map((kombi, index) => {
                      const bestandData = formData.varianten_bestand[kombi.key] || { bestand: 0, mindestbestand: 0 };
                      const istKritisch = bestandData.bestand <= bestandData.mindestbestand && bestandData.mindestbestand > 0;
                      const istLeer = bestandData.bestand === 0;

                      return (
                        <div
                          key={kombi.key}
                          className={`af3-lager-input ${index < kombinationen.length - 1 ? 'af3-lager-input--bordered' : ''} ${istLeer ? 'af3-lager-input--leer' : istKritisch ? 'af3-lager-input--kritisch' : ''}`}
                        >
                          {/* Varianten-Label */}
                          <div className="u-flex-row-md">
                            {kombi.farbe.hex && (
                              <span
                                className={`af3-color-dot-sm ${kombi.farbe.hex === '#FFFFFF' ? 'af3-color-dot--white' : ''}`}
                                style={{ background: kombi.farbe.hex }}
                              />
                            )}
                            <span className="af2-text-primary-fw">
                              {kombi.label}
                            </span>
                          </div>

                          {/* Bestand Input */}
                          <input
                            type="number"
                            value={bestandData.bestand}
                            onChange={(e) => updateVariantenBestand(kombi.key, 'bestand', e.target.value)}
                            min="0"
                            className="af3-lager-bestand-input"
                          />

                          {/* Mindestbestand Input */}
                          <input
                            type="number"
                            value={bestandData.mindestbestand}
                            onChange={(e) => updateVariantenBestand(kombi.key, 'mindestbestand', e.target.value)}
                            min="0"
                            className="af3-lager-bestand-input"
                          />

                          {/* Status */}
                          <span className={`af3-lager-status ${istLeer ? 'af3-lager-status--leer' : istKritisch ? 'af3-lager-status--kritisch' : 'af3-lager-status--ok'}`}>
                            {istLeer ? '❌ Leer' : istKritisch ? '⚠️ Kritisch' : '✓ OK'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Zusammenfassung */}
                <div className="af3-lager-summary-grid">
                  <div className="af3-lager-summary-gesamt">
                    <p className="af3-lager-summary-label-gesamt">Gesamtbestand</p>
                    <p className="af2-primary-stat">
                      {Object.values(formData.varianten_bestand).reduce((sum, v) => sum + (v.bestand || 0), 0)}
                    </p>
                  </div>
                  <div className="af3-lager-summary-verfuegbar">
                    <p className="af3-lager-summary-label-verfuegbar">Verfügbar</p>
                    <p className="af2-primary-stat">
                      {kombinationen.filter(k => {
                        const b = formData.varianten_bestand[k.key];
                        return b && b.bestand > b.mindestbestand;
                      }).length}
                    </p>
                  </div>
                  <div className="af3-lager-summary-kritisch">
                    <p className="af3-lager-summary-label-kritisch">Kritisch</p>
                    <p className="af3-lager-summary-val-kritisch">
                      {kombinationen.filter(k => {
                        const b = formData.varianten_bestand[k.key];
                        return b && b.bestand <= b.mindestbestand && b.bestand > 0;
                      }).length}
                    </p>
                  </div>
                  <div className="af3-lager-summary-leer">
                    <p className="af3-lager-summary-label-leer">Leer</p>
                    <p className="af3-lager-summary-val-leer">
                      {kombinationen.filter(k => {
                        const b = formData.varianten_bestand[k.key];
                        return !b || b.bestand === 0;
                      }).length}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {!formData.lager_tracking && (
          <div className="af3-no-tracking">
            <p className="af3-no-tracking-text">
              📦 Aktivieren Sie die Lagerbestandsverfolgung, um den Bestand zu verwalten.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderTabEinstellungen = () => (
    <div className="tab-content-section">
      <div className="af3-einstellungen-col">
        <label
          className={`af3-checkbox-container ${formData.aktiv ? 'af3-checkbox-container--active' : ''}`}
        >
          <input
            type="checkbox"
            name="aktiv"
            checked={formData.aktiv}
            onChange={handleInputChange}
            className="af3-checkbox"
          />
          <span className="af3-checkbox-label-text">
            ✅ Artikel aktiv
          </span>
        </label>

        <label
          className={`af3-checkbox-container ${formData.sichtbar_kasse ? 'af3-checkbox-container--active' : ''}`}
        >
          <input
            type="checkbox"
            name="sichtbar_kasse"
            checked={formData.sichtbar_kasse}
            onChange={handleInputChange}
            className="af3-checkbox"
          />
          <span className="af3-checkbox-label-text">
            🛒 An der Kasse sichtbar
          </span>
        </label>
      </div>
    </div>
  );

  // Rabatt-Tab (nur für SuperAdmin)
  const renderTabRabatt = () => {
    // Beispielberechnung für Vorschau
    const beispielPreis = parseFloat(formData.verkaufspreis_euro) || 100;
    const rabattWert = parseFloat(rabattData.rabatt_wert) || 0;
    let rabattierterPreis = beispielPreis;
    let ersparnis = 0;

    if (rabattData.hat_rabatt && rabattWert > 0) {
      if (rabattData.rabatt_typ === 'prozent') {
        ersparnis = (beispielPreis * rabattWert) / 100;
        rabattierterPreis = beispielPreis - ersparnis;
      } else {
        ersparnis = rabattWert;
        rabattierterPreis = beispielPreis - rabattWert;
      }
    }

    return (
      <div className="tab-content-section">
        <div className="af3-rabatt-info-box">
          <h3 className="af3-rabatt-info-title">
            🏷️ Mitglieder-Rabatt für Verbandsmitglieder
          </h3>
          <p className="af3-rabatt-info-text">
            Hier kannst du einen speziellen Rabatt für aktive Verbandsmitglieder (bezahlt oder beitragsfrei) festlegen.
            Dieser Rabatt wird im TDA-Shop angezeigt.
          </p>
        </div>

        {rabattLoading ? (
          <div className="af3-rabatt-loading">
            Lädt Rabatt-Daten...
          </div>
        ) : (
          <div className="af3-rabatt-max-width">
            {/* Rabatt aktivieren */}
            <label
              className={`af3-varianten-aktivieren ${rabattData.hat_rabatt ? 'af3-varianten-aktivieren--active' : ''}`}
            >
              <input
                type="checkbox"
                checked={rabattData.hat_rabatt}
                onChange={(e) => setRabattData(prev => ({ ...prev, hat_rabatt: e.target.checked }))}
                className="af3-varianten-checkbox"
              />
              <span className="af3-varianten-aktivieren-label">
                Mitglieder-Rabatt aktivieren
              </span>
            </label>

            {rabattData.hat_rabatt && (
              <div className="u-flex-col-md">
                {/* Rabatt-Typ */}
                <div>
                  <label className="af-gold-label">
                    Rabatt-Typ
                  </label>
                  <div className="af3-rabatt-typ-row">
                    <label
                      className={`af3-rabatt-typ-label ${rabattData.rabatt_typ === 'prozent' ? 'af3-rabatt-typ-label--active' : ''}`}
                    >
                      <input
                        type="radio"
                        checked={rabattData.rabatt_typ === 'prozent'}
                        onChange={() => setRabattData(prev => ({ ...prev, rabatt_typ: 'prozent' }))}
                        className="af2-accent-green"
                      />
                      <span className="mds-info-value">Prozent (%)</span>
                    </label>
                    <label
                      className={`af3-rabatt-typ-label ${rabattData.rabatt_typ === 'festbetrag' ? 'af3-rabatt-typ-label--active' : ''}`}
                    >
                      <input
                        type="radio"
                        checked={rabattData.rabatt_typ === 'festbetrag'}
                        onChange={() => setRabattData(prev => ({ ...prev, rabatt_typ: 'festbetrag' }))}
                        className="af2-accent-green"
                      />
                      <span className="mds-info-value">Festbetrag (€)</span>
                    </label>
                  </div>
                </div>

                {/* Rabatt-Wert */}
                <div>
                  <label className="af-gold-label">
                    Rabatt-Wert {rabattData.rabatt_typ === 'prozent' ? '(%)' : '(€)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={rabattData.rabatt_typ === 'prozent' ? '100' : undefined}
                    value={rabattData.rabatt_wert}
                    onChange={(e) => setRabattData(prev => ({ ...prev, rabatt_wert: e.target.value }))}
                    placeholder={rabattData.rabatt_typ === 'prozent' ? 'z.B. 10' : 'z.B. 5.00'}
                    className="af3-rabatt-wert-input"
                  />
                </div>

                {/* Gilt für */}
                <div>
                  <label className="af-gold-label">
                    Gilt für
                  </label>
                  <div className="u-flex-col-sm">
                    <label className="af3-rabatt-gilt-fuer-item">
                      <input
                        type="checkbox"
                        checked={rabattData.gilt_fuer_dojo}
                        onChange={(e) => setRabattData(prev => ({ ...prev, gilt_fuer_dojo: e.target.checked }))}
                        className="af2-checkbox-green"
                      />
                      <span className="mds-info-value">🥋 Verbandsmitglieder (über Dojo)</span>
                    </label>
                    <label className="af3-rabatt-gilt-fuer-item">
                      <input
                        type="checkbox"
                        checked={rabattData.gilt_fuer_einzelperson}
                        onChange={(e) => setRabattData(prev => ({ ...prev, gilt_fuer_einzelperson: e.target.checked }))}
                        className="af2-checkbox-green"
                      />
                      <span className="mds-info-value">👤 Verbandsmitglieder (Einzelperson)</span>
                    </label>
                    <label className="af3-rabatt-gilt-fuer-item">
                      <input
                        type="checkbox"
                        checked={rabattData.gilt_fuer_mitglieder}
                        onChange={(e) => setRabattData(prev => ({ ...prev, gilt_fuer_mitglieder: e.target.checked }))}
                        className="af2-checkbox-green"
                      />
                      <span className="mds-info-value">🏠 Dojo-Mitglieder</span>
                    </label>
                  </div>
                </div>

                {/* Vorschau */}
                {parseFloat(rabattData.rabatt_wert) > 0 && (
                  <div className="af3-rabatt-vorschau-box">
                    <h4 className="af3-rabatt-vorschau-title">
                      📊 Vorschau (bei Artikelpreis {beispielPreis.toFixed(2)} €)
                    </h4>
                    <div className="u-flex-row-lg">
                      <span className="af3-rabatt-originalpreis">
                        {beispielPreis.toFixed(2)} €
                      </span>
                      <span className="u-text-muted">→</span>
                      <span className="af3-rabatt-neupreis">
                        {rabattierterPreis.toFixed(2)} €
                      </span>
                      <span className="af3-rabatt-ersparnis-badge">
                        -{ersparnis.toFixed(2)} € gespart
                      </span>
                    </div>
                  </div>
                )}

                {/* Speichern-Button */}
                <div className="af3-rabatt-speichern-row">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await saveRabattData();
                        alert('Rabatt erfolgreich gespeichert!');
                      } catch (error) {
                        alert('Fehler beim Speichern: ' + error.message);
                      }
                    }}
                    disabled={rabattLoading}
                    className="af3-rabatt-speichern-btn"
                  >
                    {rabattLoading ? 'Speichert...' : '💾 Rabatt speichern'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Varianten Handlers
  const toggleGroesse = (groesse) => {
    setFormData(prev => ({
      ...prev,
      varianten_groessen: prev.varianten_groessen.includes(groesse)
        ? prev.varianten_groessen.filter(g => g !== groesse)
        : [...prev.varianten_groessen, groesse]
    }));
  };

  const toggleFarbe = (farbe) => {
    setFormData(prev => ({
      ...prev,
      varianten_farben: prev.varianten_farben.some(f => f.name === farbe.name)
        ? prev.varianten_farben.filter(f => f.name !== farbe.name)
        : [...prev.varianten_farben, farbe]
    }));
  };

  const addCustomGroesse = () => {
    const val = formData.custom_groesse.trim();
    if (val && !formData.varianten_groessen.includes(val)) {
      setFormData(prev => ({
        ...prev,
        varianten_groessen: [...prev.varianten_groessen, val],
        groessen_erwachsene: [...prev.groessen_erwachsene, val], // auto als Erwachsene
        custom_groesse: ''
      }));
    }
  };

  const deleteCustomGroesse = (g) => {
    setFormData(prev => ({
      ...prev,
      varianten_groessen: prev.varianten_groessen.filter(x => x !== g),
      groessen_kids: prev.groessen_kids.filter(x => x !== g),
      groessen_erwachsene: prev.groessen_erwachsene.filter(x => x !== g)
    }));
  };

  const renameCustomGroesse = (oldVal, newVal) => {
    const v = newVal.trim();
    if (!v || v === oldVal || formData.varianten_groessen.includes(v)) { setEditingGroesse(null); return; }
    setFormData(prev => ({
      ...prev,
      varianten_groessen: prev.varianten_groessen.map(x => x === oldVal ? v : x),
      groessen_kids: prev.groessen_kids.map(x => x === oldVal ? v : x),
      groessen_erwachsene: prev.groessen_erwachsene.map(x => x === oldVal ? v : x)
    }));
    setEditingGroesse(null);
  };

  const addCustomFarbe = () => {
    if (formData.custom_farbe_name && !formData.varianten_farben.some(f => f.name === formData.custom_farbe_name)) {
      setFormData(prev => ({
        ...prev,
        varianten_farben: [...prev.varianten_farben, { name: prev.custom_farbe_name, hex: prev.custom_farbe_hex }],
        custom_farbe_name: '',
        custom_farbe_hex: '#000000'
      }));
    }
  };

  const addCustomMaterial = () => {
    if (formData.custom_material && !formData.varianten_material.includes(formData.custom_material)) {
      setFormData(prev => ({
        ...prev,
        varianten_material: [...prev.varianten_material, prev.custom_material],
        custom_material: ''
      }));
    }
  };

  const removeMaterial = (material) => {
    setFormData(prev => ({
      ...prev,
      varianten_material: prev.varianten_material.filter(m => m !== material)
    }));
  };

  // inputStyle / selectStyle migrated to CSS classes af3-basis-input / af3-select

  const renderTabVarianten = () => (
    <div className="tab-content-section af2-overflow-auto">
      {/* Varianten aktivieren */}
      <div className="af3-varianten-aktivieren">
        <label className="af3-varianten-aktivieren-label">
          <input
            type="checkbox"
            checked={formData.hat_varianten}
            onChange={(e) => setFormData(prev => ({ ...prev, hat_varianten: e.target.checked }))}
            className="af3-varianten-checkbox"
          />
          🎨 Artikel hat Varianten (Größen, Farben, Material)
        </label>
      </div>

      {formData.hat_varianten && (
        <div className="af3-varianten-grid">
          {/* GRÖSSEN */}
          <div className="af2-glass-card">
            <div className="af-flex-between">
              <h3 className="af-gold-row-heading">
                📏 Größen
              </h3>
              <button
                type="button"
                onClick={() => {
                  const alleGroessen = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '100', '110', '120', '130', '140', '150', '160', '170', '180', '190', '200'];
                  setFormData(prev => ({ ...prev, varianten_groessen: alleGroessen }));
                }}
                className="af3-btn-alle"
              >
                ✓ Alle auswählen
              </button>
            </div>

            {/* Standard Größen */}
            <div className="af2-mb-1">
              <div className="af-flex-between-mb">
                <p className="af2-text-secondary-sm">Konfektionsgrößen:</p>
                <button
                  type="button"
                  onClick={() => {
                    const konfektions = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
                    setFormData(prev => ({
                      ...prev,
                      varianten_groessen: [...new Set([...prev.varianten_groessen, ...konfektions])]
                    }));
                  }}
                  className="af3-btn-alle-sm"
                >
                  Alle
                </button>
              </div>
              <div className="af-flex-wrap">
                {['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].map(groesse => (
                  <button
                    key={groesse}
                    type="button"
                    onClick={() => toggleGroesse(groesse)}
                    className={`af3-toggle-btn ${formData.varianten_groessen.includes(groesse) ? 'af3-toggle-btn--selected' : ''}`}
                  >
                    {groesse}
                  </button>
                ))}
              </div>
            </div>

            {/* Körpergrößen */}
            <div className="af2-mb-1">
              <div className="af-flex-between-mb">
                <p className="af2-text-secondary-sm">Körpergrößen (cm):</p>
                <button
                  type="button"
                  onClick={() => {
                    const koerper = ['100', '110', '120', '130', '140', '150', '160', '170', '180', '190', '200'];
                    setFormData(prev => ({
                      ...prev,
                      varianten_groessen: [...new Set([...prev.varianten_groessen, ...koerper])]
                    }));
                  }}
                  className="af3-btn-alle-sm"
                >
                  Alle
                </button>
              </div>
              <div className="af-flex-wrap">
                {['100', '110', '120', '130', '140', '150', '160', '170', '180', '190', '200'].map(groesse => (
                  <button
                    key={groesse}
                    type="button"
                    onClick={() => toggleGroesse(groesse)}
                    className={`af3-toggle-btn af3-toggle-btn--sm ${formData.varianten_groessen.includes(groesse) ? 'af3-toggle-btn--selected' : ''}`}
                  >
                    {groesse}
                  </button>
                ))}
              </div>
            </div>

            {/* Eigene Größe hinzufügen */}
            <div className="af-flex-row">
              <input
                type="text"
                placeholder="Eigene Größe..."
                value={formData.custom_groesse}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_groesse: e.target.value }))}
                className="af3-basis-input af3-flex-1"
              />
              <button
                type="button"
                onClick={addCustomGroesse}
                className="af3-btn-add-primary"
              >
                + Hinzufügen
              </button>
            </div>

            {/* Ausgewählte Größen */}
            {formData.varianten_groessen.length > 0 && (
              <div className="af-hover-box">
                <p className="af-meta-text">Ausgewählt ({formData.varianten_groessen.length}):</p>
                <div className="af-flex-wrap">
                  {formData.varianten_groessen.map(g => {
                    const isCustom = !verfuegbareGroessen.includes(g);
                    const isEditing = editingGroesse?.old === g;
                    if (isEditing) {
                      return (
                        <span key={g} className="af3-inline-edit-wrapper">
                          <input
                            autoFocus
                            type="text"
                            value={editingGroesse.new}
                            onChange={(e) => setEditingGroesse(prev => ({ ...prev, new: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') renameCustomGroesse(g, editingGroesse.new);
                              if (e.key === 'Escape') setEditingGroesse(null);
                            }}
                            className="af3-inline-edit-input"
                          />
                          <button type="button" onClick={() => renameCustomGroesse(g, editingGroesse.new)}
                            className="af3-inline-confirm-btn">✓</button>
                          <button type="button" onClick={() => setEditingGroesse(null)}
                            className="af3-inline-cancel-btn">✕</button>
                        </span>
                      );
                    }
                    return (
                      <span key={g} className={isCustom ? 'af3-groesse-badge-custom' : 'af3-groesse-badge-standard'}>
                        {g}
                        {isCustom && (
                          <>
                            <button type="button" title="Umbenennen"
                              onClick={() => setEditingGroesse({ old: g, new: g })}
                              className="af3-groesse-edit-btn">✏️</button>
                            <button type="button" title="Löschen"
                              onClick={() => deleteCustomGroesse(g)}
                              className="af3-groesse-delete-btn">×</button>
                          </>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* FARBEN */}
          <div className="af2-glass-card">
            <div className="af-flex-between">
              <h3 className="af-gold-row-heading">
                🎨 Farben
              </h3>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, varianten_farben: [...verfuegbareFarben] }));
                }}
                className="af3-btn-alle"
              >
                ✓ Alle auswählen
              </button>
            </div>

            {/* Standard Farben */}
            <div className="af3-farben-grid">
              {verfuegbareFarben.map(farbe => (
                <button
                  key={farbe.name}
                  type="button"
                  onClick={() => toggleFarbe(farbe)}
                  className={`af3-varianten-btn-base ${formData.varianten_farben.some(f => f.name === farbe.name) ? 'af3-varianten-btn-base--selected' : ''}`}
                >
                  <span
                    className={`af3-farbe-dot-lg ${farbe.hex === '#FFFFFF' ? 'af3-color-dot--white' : ''}`}
                    style={{ background: farbe.hex }}
                  />
                  <span className="af2-text-primary-fw">{farbe.name}</span>
                </button>
              ))}
            </div>

            {/* Eigene Farbe hinzufügen */}
            <div className="af3-farbe-custom-row">
              <input
                type="text"
                placeholder="Farbname..."
                value={formData.custom_farbe_name}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_farbe_name: e.target.value }))}
                className="af3-basis-input af3-flex-1-minw"
              />
              <input
                type="color"
                value={formData.custom_farbe_hex}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_farbe_hex: e.target.value }))}
                className="af3-farbe-color-input"
              />
              <button
                type="button"
                onClick={addCustomFarbe}
                className="af3-btn-add-primary"
              >
                + Hinzufügen
              </button>
            </div>

            {/* Ausgewählte Farben */}
            {formData.varianten_farben.length > 0 && (
              <div className="af-hover-box">
                <p className="af-meta-text">Ausgewählt ({formData.varianten_farben.length}):</p>
                <div className="af-flex-wrap">
                  {formData.varianten_farben.map(f => (
                    <span key={f.name} className="af3-badge-neutral">
                      <span
                        className={`af3-color-dot-xs${f.hex === '#FFFFFF' ? ' af3-color-dot--white' : ''}`}
                        style={{ background: f.hex }}
                      />
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* MATERIAL */}
          <div className="af2-glass-card">
            <div className="af-flex-between">
              <h3 className="af-gold-row-heading">
                🧵 Material / Stoff
              </h3>
              <button
                type="button"
                onClick={() => {
                  const alleMaterialien = ['Baumwolle', 'Polyester', 'Mischgewebe', 'Seide', 'Leinen', 'Wolle', 'Leder', 'Kunstleder'];
                  setFormData(prev => ({ ...prev, varianten_material: alleMaterialien }));
                }}
                className="af3-btn-alle"
              >
                ✓ Alle auswählen
              </button>
            </div>

            {/* Schnell-Auswahl */}
            <div className="af3-material-grid">
              {['Baumwolle', 'Polyester', 'Mischgewebe', 'Seide', 'Leinen', 'Wolle', 'Leder', 'Kunstleder'].map(mat => (
                <button
                  key={mat}
                  type="button"
                  onClick={() => {
                    if (!formData.varianten_material.includes(mat)) {
                      setFormData(prev => ({ ...prev, varianten_material: [...prev.varianten_material, mat] }));
                    }
                  }}
                  className={`af3-toggle-btn ${formData.varianten_material.includes(mat) ? 'af3-toggle-btn--selected' : ''}`}
                >
                  {mat}
                </button>
              ))}
            </div>

            {/* Eigenes Material hinzufügen */}
            <div className="af-flex-row">
              <input
                type="text"
                placeholder="Eigenes Material..."
                value={formData.custom_material}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_material: e.target.value }))}
                className="af3-basis-input af3-flex-1"
              />
              <button
                type="button"
                onClick={addCustomMaterial}
                className="af3-btn-add-primary"
              >
                + Hinzufügen
              </button>
            </div>

            {/* Ausgewählte Materialien */}
            {formData.varianten_material.length > 0 && (
              <div className="af-hover-box">
                <p className="af-meta-text">Ausgewählt ({formData.varianten_material.length}):</p>
                <div className="af-flex-wrap">
                  {formData.varianten_material.map(m => (
                    <span key={m} className="af3-badge-primary">
                      {m}
                      <button
                        type="button"
                        onClick={() => removeMaterial(m)}
                        className="af3-badge-remove-btn"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* LAUFZEIT */}
          <div className="af3-laufzeit-section">
            <div className="af-flex-between">
              <h3 className="af3-laufzeit-heading">
                🕐 Laufzeit
              </h3>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, varianten_laufzeit: [...verfuegbareLaufzeiten] }));
                }}
                className="af3-laufzeit-select-btn"
              >
                Alle auswählen
              </button>
            </div>
            <div className="af3-laufzeit-grid">
              {verfuegbareLaufzeiten.map(laufzeit => (
                <button
                  key={laufzeit.name}
                  type="button"
                  onClick={() => {
                    if (!formData.varianten_laufzeit.some(l => l.name === laufzeit.name)) {
                      setFormData(prev => ({ ...prev, varianten_laufzeit: [...prev.varianten_laufzeit, laufzeit] }));
                    } else {
                      setFormData(prev => ({ ...prev, varianten_laufzeit: prev.varianten_laufzeit.filter(l => l.name !== laufzeit.name) }));
                    }
                  }}
                  className={`af3-laufzeit-select-btn af3-laufzeit-kalk-col ${formData.varianten_laufzeit.some(l => l.name === laufzeit.name) ? 'af3-laufzeit-select-btn--selected' : ''}`}
                >
                  <span>{laufzeit.name}</span>
                  {laufzeit.rabatt > 0 && (
                    <span className={`af3-laufzeit-rabatt-badge ${formData.varianten_laufzeit.some(l => l.name === laufzeit.name) ? 'af3-laufzeit-rabatt-badge--selected' : ''}`}>
                      -{laufzeit.rabatt}% Rabatt
                    </span>
                  )}
                </button>
              ))}
            </div>

            {formData.varianten_laufzeit.length > 0 && (
              <div className="af-hover-box">
                <p className="af-meta-text">Ausgewählt ({formData.varianten_laufzeit.length}):</p>
                <div className="af-flex-wrap">
                  {formData.varianten_laufzeit.map(l => (
                    <span key={l.name} className="af3-badge-primary">
                      {l.name} {l.rabatt > 0 && `(-${l.rabatt}%)`}
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, varianten_laufzeit: prev.varianten_laufzeit.filter(lz => lz.name !== l.name) }))}
                        className="af3-badge-remove-btn"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ZUSAMMENFASSUNG */}
          {(formData.varianten_groessen.length > 0 || formData.varianten_farben.length > 0 || formData.varianten_material.length > 0 || formData.varianten_laufzeit.length > 0) && (
            <div className="af3-varianten-summary">
              <h3 className="af3-varianten-summary-title">
                📊 Varianten-Zusammenfassung
              </h3>
              <div className="af3-varianten-summary-grid">
                <div className="af-glass-box">
                  <p className="af-meta-text">Größen</p>
                  <p className="af-gold-price">{formData.varianten_groessen.length}</p>
                </div>
                <div className="af-glass-box">
                  <p className="af-meta-text">Farben</p>
                  <p className="af-gold-price">{formData.varianten_farben.length}</p>
                </div>
                <div className="af-glass-box">
                  <p className="af-meta-text">Materialien</p>
                  <p className="af-gold-price">{formData.varianten_material.length}</p>
                </div>
                <div className="af-glass-box">
                  <p className="af-meta-text">Laufzeiten</p>
                  <p className="af-gold-price">{formData.varianten_laufzeit.length}</p>
                </div>
                <div className="af-glass-box">
                  <p className="af-meta-text">Mögliche Kombinationen</p>
                  <p className="af-gold-price">
                    {Math.max(1, formData.varianten_groessen.length) * Math.max(1, formData.varianten_farben.length) * Math.max(1, formData.varianten_material.length) * Math.max(1, formData.varianten_laufzeit.length)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basis': return renderTabBasis();
      case 'varianten': return renderTabVarianten();
      case 'preise': return renderTabPreise();
      case 'lager': return renderTabLager();
      case 'einstellungen': return renderTabEinstellungen();
      case 'rabatt': return renderTabRabatt();
      default: return null;
    }
  };

  if (loading && mode === 'edit') {
    return <div className="loading-spinner">Lädt...</div>;
  }

  return (
    <div className="artikel-formular-page af3-page">
      {/* Header */}
      <div className="af3-page-header">
        <div>
          <h1 className="af3-page-title">
            {mode === 'create' ? '🆕 Neuen Artikel erstellen' : '✏️ Artikel bearbeiten'}
          </h1>
          {mode === 'edit' && formData.name && (
            <p className="af3-page-subtitle">
              {formData.name}
            </p>
          )}
        </div>

        <div className="af3-header-actions">
          <button
            onClick={() => navigate('/dashboard/artikel')}
            className="af3-btn-back"
          >
            ← Zurück zur Liste
          </button>

          <button
            onClick={handleSave}
            disabled={loading || !formData.name}
            className="af3-btn-save"
          >
            {loading ? 'Speichert...' : '💾 Speichern'}
          </button>
        </div>
      </div>

      {error && (
        <div className="af3-error-banner">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="sub-tabs af3-tab-nav">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`sub-tab-btn af3-tab-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="af3-tab-content">
        {renderTabContent()}
      </div>

      {/* Modal: Neue Artikelgruppe/Unterkategorie erstellen */}
      {showGruppeModal && (
        <div className="af3-modal-overlay" onClick={() => setShowGruppeModal(false)}>
          <div className="af3-modal-panel" onClick={(e) => e.stopPropagation()}>
            <h3 className="af3-modal-title">
              {neueGruppeTyp === 'hauptkategorie' ? 'Neue Artikelgruppe' : 'Neue Unterkategorie'}
            </h3>

            {neueGruppeTyp === 'unterkategorie' && (
              <div className="af3-modal-unterkategorie-hint">
                Wird erstellt unter: <strong className="mds-info-value">
                  {artikelgruppen.find(g => g.id == selectedHauptkategorieId)?.name || ''}
                </strong>
              </div>
            )}

            <div className="af2-mb-15">
              <label className="af3-modal-label">
                Name *
              </label>
              <input
                type="text"
                value={neueGruppeName}
                onChange={(e) => setNeueGruppeName(e.target.value)}
                placeholder={neueGruppeTyp === 'hauptkategorie' ? 'z.B. Trainingsgeräte' : 'z.B. Pratzen'}
                autoFocus
                className="af3-modal-input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleCreateGruppe();
                }}
              />
            </div>

            <div className="af3-modal-actions">
              <button type="button" onClick={() => setShowGruppeModal(false)} className="af3-modal-cancel-btn">
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleCreateGruppe}
                disabled={neueGruppeLoading || !neueGruppeName.trim()}
                className="af3-modal-confirm-btn"
              >
                {neueGruppeLoading ? 'Erstelle...' : 'Erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtikelFormular;
