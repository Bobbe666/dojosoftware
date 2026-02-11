// =====================================================================================
// ARTIKEL-FORMULAR KOMPONENTE - Eigenständige Seite für Artikel erstellen/bearbeiten
// =====================================================================================
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import '../styles/components.css';
import '../styles/ArtikelVerwaltung.css';
import '../styles/ArtikelVerwaltungOverrides.css';
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
    gilt_fuer_dojo: true,
    gilt_fuer_einzelperson: true,
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
        throw new Error(`HTTP error! status: ${response.status}`);
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
    try {
      setLoading(true);
      const url = mode === 'create' ? '' : `/${id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

      // DEBUG: Log Handelskalkulation beim Speichern
      console.log('🔍 ArtikelFormular - Speichern Kalkulation:', {
        listeneinkaufspreis_euro: formData.listeneinkaufspreis_euro,
        lieferrabatt_prozent: formData.lieferrabatt_prozent,
        gemeinkosten_prozent: formData.gemeinkosten_prozent,
        gewinnzuschlag_prozent: formData.gewinnzuschlag_prozent,
        verkaufspreis_euro: formData.verkaufspreis_euro,
        bezugskosten_euro: formData.bezugskosten_euro
      });

      const response = await apiCall(url, {
        method,
        body: JSON.stringify(formData)
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

  // Basis Input Style für gute Sichtbarkeit
  const basisInputStyle = {
    padding: '0.75rem 1rem',
    background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
    border: '2px solid var(--border-secondary, rgba(255, 255, 255, 0.1))',
    borderRadius: '8px',
    color: 'var(--text-primary, #ffffff)',
    fontSize: '1rem',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
  };

  const basisLabelStyle = {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: 600,
    color: 'var(--gold, #ffd700)',
    fontSize: '0.95rem'
  };

  // Render Tab Content
  const renderTabBasis = () => (
    <div className="tab-content-section">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={basisLabelStyle}>Artikelgruppe *</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={selectedHauptkategorieId}
              onChange={(e) => {
                setSelectedHauptkategorieId(e.target.value);
                // Reset artikelgruppe_id und setze kategorie_id wenn Hauptkategorie wechselt
                setFormData(prev => ({ ...prev, artikelgruppe_id: '', kategorie_id: e.target.value }));
              }}
              required
              style={{ ...basisInputStyle, cursor: 'pointer', flex: 1 }}
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
              style={{
                padding: '0.5rem 0.75rem',
                background: 'var(--gold, #ffd700)',
                color: '#000',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '1rem',
                whiteSpace: 'nowrap'
              }}
              title="Neue Artikelgruppe erstellen"
            >
              +
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={basisLabelStyle}>Unterkategorie</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              name="artikelgruppe_id"
              value={formData.artikelgruppe_id}
              onChange={handleInputChange}
              style={{ ...basisInputStyle, cursor: 'pointer', flex: 1 }}
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
              style={{
                padding: '0.5rem 0.75rem',
                background: selectedHauptkategorieId ? 'var(--gold, #ffd700)' : 'rgba(255,255,255,0.1)',
                color: selectedHauptkategorieId ? '#000' : 'rgba(255,255,255,0.3)',
                border: 'none',
                borderRadius: '6px',
                cursor: selectedHauptkategorieId ? 'pointer' : 'not-allowed',
                fontWeight: '600',
                fontSize: '1rem',
                whiteSpace: 'nowrap'
              }}
              title="Neue Unterkategorie erstellen"
            >
              +
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
          <label style={basisLabelStyle}>Artikelname *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            style={basisInputStyle}
            placeholder="z.B. Proteinriegel Schokolade 50g"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gridColumn: '1 / -1' }}>
          <label style={basisLabelStyle}>Beschreibung</label>
          <textarea
            name="beschreibung"
            value={formData.beschreibung}
            onChange={handleInputChange}
            rows="3"
            style={{ ...basisInputStyle, resize: 'vertical', minHeight: '80px' }}
            placeholder="Produktbeschreibung..."
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={basisLabelStyle}>EAN-Code</label>
          <input
            type="text"
            name="ean_code"
            value={formData.ean_code}
            onChange={handleInputChange}
            style={basisInputStyle}
            placeholder="z.B. 4250123456789"
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={basisLabelStyle}>Artikelnummer</label>
          <input
            type="text"
            name="artikel_nummer"
            value={formData.artikel_nummer}
            onChange={handleInputChange}
            style={basisInputStyle}
            placeholder="Wird automatisch generiert"
          />
          {mode === 'create' && formData.artikel_nummer && (
            <small style={{ color: '#16a34a', marginTop: '0.25rem', fontSize: '0.85rem' }}>
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
      <div className="tab-content-section" style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
        <div className="preiskalkulation-container" style={{height: '100%', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>

          {/* Eingabebereich */}
          <div className="preis-eingabe-section" style={{overflowY: 'auto', maxHeight: '100%', padding: '0.85rem', background: 'var(--glass-bg, var(--bg-hover, rgba(255, 255, 255, 0.12)))', border: '2px solid var(--border-accent, var(--border-secondary, rgba(255, 255, 255, 0.1)))', borderRadius: '8px'}}>

            {/* TAB-AUSWAHL */}
            <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '1rem', background: '#e5e7eb', padding: '0.25rem', borderRadius: '8px' }}>
              <button
                type="button"
                onClick={() => setPreisTab('einzelkalkulation')}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  background: preisTab === 'einzelkalkulation' ? 'var(--gold, #ffd700)' : 'transparent',
                  color: preisTab === 'einzelkalkulation' ? '#ffffff' : 'var(--text-secondary, rgba(255, 255, 255, 0.7))',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                💰 Einzel
              </button>
              <button
                type="button"
                onClick={() => setPreisTab('groessenabhaengig')}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  background: preisTab === 'groessenabhaengig' ? 'var(--gold, #ffd700)' : 'transparent',
                  color: preisTab === 'groessenabhaengig' ? '#ffffff' : 'var(--text-secondary, rgba(255, 255, 255, 0.7))',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                👶🧑 Größen
              </button>
              <button
                type="button"
                onClick={() => setPreisTab('uebersicht')}
                style={{
                  flex: 1,
                  padding: '0.5rem 0.75rem',
                  background: preisTab === 'uebersicht' ? 'var(--gold, #ffd700)' : 'transparent',
                  color: preisTab === 'uebersicht' ? '#ffffff' : 'var(--text-secondary, rgba(255, 255, 255, 0.7))',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                ✓ Übersicht
              </button>
            </div>

            {/* GEMEINSAME HANDELSKALKULATION - NUR für Einzel Tab */}
            {preisTab === 'einzelkalkulation' && (
            <>
            <h3 style={{marginBottom: '0.3rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary, var(--text-primary, #ffffff))'}}>
              📝 Handelskalkulation
            </h3>

            {/* BEZUGSKALKULATION */}
            <div style={{marginBottom: '0.3rem'}}>
              <h4 style={{color: 'var(--gold, #ffd700)', fontSize: '0.75rem', marginBottom: '0.15rem', fontWeight: 600}}>
                📦 Bezugskalkulation
              </h4>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem 0.4rem'}}>
                <div>
                  <label style={{fontSize: '0.65rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block'}}>Listeneinkaufspreis (€)</label>
                  <input type="number" name="listeneinkaufspreis_euro" value={formData.listeneinkaufspreis_euro} onChange={handleInputChange} step="0.01" min="0" className="form-input" placeholder="0.00" style={{height: '28px', padding: '0.2rem 0.4rem', fontSize: '0.85rem'}} />
                </div>
                <div>
                  <label style={{fontSize: '0.65rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block'}}>Lieferrabatt (%)</label>
                  <input type="number" name="lieferrabatt_prozent" value={formData.lieferrabatt_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input" placeholder="0.00" style={{height: '28px', padding: '0.2rem 0.4rem', fontSize: '0.85rem'}} />
                </div>
                <div>
                  <label style={{fontSize: '0.65rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block'}}>Lieferskonto (%)</label>
                  <input type="number" name="lieferskonto_prozent" value={formData.lieferskonto_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input" placeholder="0.00" style={{height: '28px', padding: '0.2rem 0.4rem', fontSize: '0.85rem'}} />
                </div>
                <div>
                  <label style={{fontSize: '0.65rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block'}}>Bezugskosten (€)</label>
                  <input type="number" name="bezugskosten_euro" value={formData.bezugskosten_euro} onChange={handleInputChange} step="0.01" min="0" className="form-input" placeholder="0.00" style={{height: '28px', padding: '0.2rem 0.4rem', fontSize: '0.85rem'}} />
                </div>
              </div>
            </div>

            {/* SELBSTKOSTENKALKULATION */}
            <div style={{marginBottom: '0.3rem'}}>
              <h4 style={{color: 'var(--gold, #ffd700)', fontSize: '0.75rem', marginBottom: '0.15rem', fontWeight: 600}}>
                🏭 Selbstkosten
              </h4>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.2rem 0.4rem'}}>
                <div>
                  <label style={{fontSize: '0.65rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block'}}>Gemeinkosten (%)</label>
                  <input type="number" name="gemeinkosten_prozent" value={formData.gemeinkosten_prozent} onChange={handleInputChange} step="0.01" min="0" className="form-input" placeholder="0.00" style={{height: '28px', padding: '0.2rem 0.4rem', fontSize: '0.85rem'}} />
                </div>
                <div>
                  <label style={{fontSize: '0.65rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block'}}>Gewinnzuschlag (%)</label>
                  <input type="number" name="gewinnzuschlag_prozent" value={formData.gewinnzuschlag_prozent} onChange={handleInputChange} step="0.01" min="0" className="form-input" placeholder="0.00" style={{height: '28px', padding: '0.2rem 0.4rem', fontSize: '0.85rem'}} />
                </div>
              </div>
            </div>

            {/* VERKAUFSKALKULATION */}
            <div style={{marginBottom: '0.3rem'}}>
              <h4 style={{color: 'var(--gold, #ffd700)', fontSize: '0.75rem', marginBottom: '0.15rem', fontWeight: 600}}>
                💰 Verkauf
              </h4>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.2rem 0.4rem'}}>
                <div>
                  <label style={{fontSize: '0.65rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block'}}>Kundenskonto (%)</label>
                  <input type="number" name="kundenskonto_prozent" value={formData.kundenskonto_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input" placeholder="0.00" style={{height: '28px', padding: '0.2rem 0.4rem', fontSize: '0.85rem'}} />
                </div>
                <div>
                  <label style={{fontSize: '0.65rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block'}}>Kundenrabatt (%)</label>
                  <input type="number" name="kundenrabatt_prozent" value={formData.kundenrabatt_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input" placeholder="0.00" style={{height: '28px', padding: '0.2rem 0.4rem', fontSize: '0.85rem'}} />
                </div>
                <div>
                  <label style={{fontSize: '0.65rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block'}}>MwSt. (%)</label>
                  <select name="mwst_prozent" value={formData.mwst_prozent} onChange={handleInputChange} className="form-select" style={{height: '28px', padding: '0.2rem 0.4rem', fontSize: '0.85rem'}}>
                    <option value="7.00">7%</option>
                    <option value="19.00">19%</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Button: Neuen Preis übernehmen - nur bei Einzelkalkulation */}
            {preisTab === 'einzelkalkulation' && listeneinkaufspreis > 0 && nettoverkaufspreis > 0 && (
              <div style={{marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(107, 68, 35, 0.1)', borderRadius: '6px', border: '1px solid rgba(107, 68, 35, 0.3)'}}>
                <div style={{marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--gold, #ffd700)'}}>
                  Kalkulierter Nettoverkaufspreis: <strong>{nettoverkaufspreis.toFixed(2)} €</strong>
                </div>
                <button
                  type="button"
                  onClick={handlePreisUebernehmen}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--gold, #ffd700)',
                    color: 'var(--dark-bg, #0f0f23)',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
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
              <div style={{marginTop: '0.5rem', padding: '1rem', background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', border: '2px solid var(--gold, #ffd700)', borderRadius: '12px'}}>
                <h4 style={{margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 600, color: 'var(--gold, #ffd700)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                  👶🧑 Größenabhängige Einkaufspreise
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', marginBottom: '1rem' }}>
                  Unterschiedliche EK-Preise für Kids und Erwachsene eingeben. Die Kalkulationsparameter unten gelten für beide.
                </p>

                {/* EK-Eingaben */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold, #ffd700)', marginBottom: '0.5rem' }}>
                      👶 Listeneinkaufspreis Kids (€)
                    </label>
                    <input
                      type="number"
                      name="listeneinkaufspreis_kids_euro"
                      value={formData.listeneinkaufspreis_kids_euro}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #86efac',
                        borderRadius: '8px',
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        background: '#f0fdf4'
                      }}
                      placeholder="z.B. 20.00"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#1e40af', marginBottom: '0.5rem' }}>
                      🧑 Listeneinkaufspreis Erwachsene (€)
                    </label>
                    <input
                      type="number"
                      name="listeneinkaufspreis_erwachsene_euro"
                      value={formData.listeneinkaufspreis_erwachsene_euro}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        border: '2px solid #93c5fd',
                        borderRadius: '8px',
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        background: '#eff6ff'
                      }}
                      placeholder="z.B. 35.00"
                    />
                  </div>
                </div>

                {/* Bezugskosten-Eingaben */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: 'var(--gold, #ffd700)', marginBottom: '0.3rem' }}>
                      📦 Bezugskosten Kids (€)
                    </label>
                    <input
                      type="number"
                      name="bezugskosten_kids_euro"
                      value={formData.bezugskosten_kids_euro}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #86efac',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        background: '#f0fdf4'
                      }}
                      placeholder="z.B. 5.00"
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#1e40af', marginBottom: '0.3rem' }}>
                      📦 Bezugskosten Erwachsene (€)
                    </label>
                    <input
                      type="number"
                      name="bezugskosten_erwachsene_euro"
                      value={formData.bezugskosten_erwachsene_euro}
                      onChange={handleInputChange}
                      step="0.01"
                      min="0"
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #93c5fd',
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        background: '#eff6ff'
                      }}
                      placeholder="z.B. 5.00"
                    />
                  </div>
                </div>

                {/* Kalkulationsparameter für Größen */}
                <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', border: '2px solid #f59e0b' }}>
                  <p style={{ fontSize: '0.9rem', fontWeight: 700, color: '#92400e', marginBottom: '0.75rem' }}>
                    📊 Kalkulationsparameter (für beide Kategorien)
                  </p>

                  {/* Bezugskalkulation */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gold, #ffd700)', marginBottom: '0.3rem' }}>📦 Bezugskalkulation</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block' }}>Lieferrabatt (%)</label>
                        <input type="number" name="lieferrabatt_prozent" value={formData.lieferrabatt_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input" placeholder="0" style={{ height: '30px', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block' }}>Lieferskonto (%)</label>
                        <input type="number" name="lieferskonto_prozent" value={formData.lieferskonto_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input" placeholder="0" style={{ height: '30px', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }} />
                      </div>
                    </div>
                  </div>

                  {/* Selbstkosten */}
                  <div style={{ marginBottom: '0.75rem' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gold, #ffd700)', marginBottom: '0.3rem' }}>🏭 Selbstkosten</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block' }}>Gemeinkosten (%)</label>
                        <input type="number" name="gemeinkosten_prozent" value={formData.gemeinkosten_prozent} onChange={handleInputChange} step="0.01" min="0" className="form-input" placeholder="0" style={{ height: '30px', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block' }}>Gewinnzuschlag (%)</label>
                        <input type="number" name="gewinnzuschlag_prozent" value={formData.gewinnzuschlag_prozent} onChange={handleInputChange} step="0.01" min="0" className="form-input" placeholder="0" style={{ height: '30px', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }} />
                      </div>
                    </div>
                  </div>

                  {/* Verkauf */}
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--gold, #ffd700)', marginBottom: '0.3rem' }}>💰 Verkauf</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block' }}>Kundenskonto (%)</label>
                        <input type="number" name="kundenskonto_prozent" value={formData.kundenskonto_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input" placeholder="0" style={{ height: '30px', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block' }}>Kundenrabatt (%)</label>
                        <input type="number" name="kundenrabatt_prozent" value={formData.kundenrabatt_prozent} onChange={handleInputChange} step="0.01" min="0" max="100" className="form-input" placeholder="0" style={{ height: '30px', padding: '0.3rem 0.5rem', fontSize: '0.85rem' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', display: 'block' }}>MwSt. (%)</label>
                        <select name="mwst_prozent" value={formData.mwst_prozent} onChange={handleInputChange} className="form-select" style={{ height: '30px', padding: '0.2rem 0.4rem', fontSize: '0.85rem' }}>
                          <option value="7.00">7%</option>
                          <option value="19.00">19%</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hinweis zur Berechnung */}
                {(parseFloat(formData.listeneinkaufspreis_kids_euro) > 0 || parseFloat(formData.listeneinkaufspreis_erwachsene_euro) > 0) && (
                  <div style={{ padding: '0.5rem 0.75rem', marginBottom: '1rem', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--gold, #ffd700)' }}>
                    ✓ Vollständige Kalkulation wird rechts angezeigt →
                  </div>
                )}

                {/* Größen-Zuordnung */}
                {formData.hat_varianten && formData.varianten_groessen.length > 0 && (
                  <div style={{ background: 'var(--bg-hover, rgba(255, 255, 255, 0.12))', padding: '1rem', borderRadius: '8px', marginTop: '1rem' }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--gold, #ffd700)', marginBottom: '0.75rem' }}>
                      📏 Größen-Zuordnung (klicken zum Ändern)
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      {/* Kids Spalte */}
                      <div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--gold, #ffd700)', marginBottom: '0.5rem', fontWeight: 600 }}>👶 Kids-Größen:</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {formData.varianten_groessen.map(g => {
                            const isKids = formData.groessen_kids.includes(g);
                            if (!isKids) return null;
                            return (
                              <button
                                key={g}
                                type="button"
                                onClick={() => toggleGroesseKategorie(g, 'erwachsene')}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  background: '#dcfce7',
                                  border: '1px solid #86efac',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  color: 'var(--gold, #ffd700)'
                                }}
                                title="Klicken um zu Erwachsene zu verschieben"
                              >
                                {g}
                              </button>
                            );
                          })}
                          {formData.varianten_groessen.filter(g => formData.groessen_kids.includes(g)).length === 0 && (
                            <span style={{ color: '#9ca3af', fontSize: '0.8rem', fontStyle: 'italic' }}>Keine</span>
                          )}
                        </div>
                      </div>

                      {/* Erwachsene Spalte */}
                      <div>
                        <p style={{ fontSize: '0.8rem', color: '#1e40af', marginBottom: '0.5rem', fontWeight: 600 }}>🧑 Erwachsene-Größen:</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {formData.varianten_groessen.map(g => {
                            const isErwachsene = formData.groessen_erwachsene.includes(g);
                            if (!isErwachsene) return null;
                            return (
                              <button
                                key={g}
                                type="button"
                                onClick={() => toggleGroesseKategorie(g, 'kids')}
                                style={{
                                  padding: '0.3rem 0.6rem',
                                  background: '#dbeafe',
                                  border: '1px solid #93c5fd',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                  cursor: 'pointer',
                                  color: '#1e40af'
                                }}
                                title="Klicken um zu Kids zu verschieben"
                              >
                                {g}
                              </button>
                            );
                          })}
                          {formData.varianten_groessen.filter(g => formData.groessen_erwachsene.includes(g)).length === 0 && (
                            <span style={{ color: '#9ca3af', fontSize: '0.8rem', fontStyle: 'italic' }}>Keine</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Hinweis wenn keine Varianten */}
                {(!formData.hat_varianten || formData.varianten_groessen.length === 0) && (
                  <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '0.85rem', color: '#dc2626' }}>
                    ⚠️ Bitte zuerst im Tab "Varianten" die Größen aktivieren
                  </div>
                )}
              </div>
            )}

            {/* ÜBERSICHT TAB - Preise übernehmen */}
            {preisTab === 'uebersicht' && (
              <div style={{ padding: '1rem', background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', border: '2px solid var(--gold, #ffd700)', borderRadius: '12px' }}>
                <h4 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold, #ffd700)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  ✓ Preise übernehmen
                </h4>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', marginBottom: '1.5rem' }}>
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
                        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <span style={{ fontWeight: 600, color: 'var(--gold, #ffd700)' }}>💰 Einzelpreis</span>
                            <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--gold, #ffd700)' }}>{einzelBruttoVK.toFixed(2)} € Brutto</span>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', marginBottom: '0.75rem' }}>
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
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              background: 'var(--gold, #ffd700)',
                              color: 'var(--dark-bg, #0f0f23)',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '0.95rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ✅ Einzelpreis übernehmen
                          </button>
                        </div>
                      )}

                      {/* Größenabhängige Preise */}
                      {hasGroessen && (
                        <div style={{ padding: '1rem', background: '#eff6ff', border: '2px solid #93c5fd', borderRadius: '8px' }}>
                          <div style={{ fontWeight: 600, color: '#1e40af', marginBottom: '0.75rem' }}>
                            👶🧑 Größenabhängige Preise
                          </div>

                          {hasKids && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: '#dcfce7', borderRadius: '6px', marginBottom: '0.5rem' }}>
                              <span style={{ color: 'var(--gold, #ffd700)' }}>👶 Kids</span>
                              <span style={{ fontWeight: 700, color: 'var(--gold, #ffd700)' }}>{kidsBruttoVK.toFixed(2)} € Brutto</span>
                            </div>
                          )}

                          {hasErw && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: '#dbeafe', borderRadius: '6px', marginBottom: '0.75rem' }}>
                              <span style={{ color: '#1e40af' }}>🧑 Erwachsene</span>
                              <span style={{ fontWeight: 700, color: '#1e40af' }}>{erwBruttoVK.toFixed(2)} € Brutto</span>
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
                                verkaufspreis_euro: erwNettoVK.toFixed(2) // Erwachsene als Hauptpreis
                              }));
                              alert('✅ Größenabhängige Preise wurden übernommen!');
                            }}
                            style={{
                              width: '100%',
                              padding: '0.75rem',
                              background: '#1e40af',
                              color: '#ffffff',
                              border: 'none',
                              borderRadius: '8px',
                              fontSize: '0.95rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            ✅ Größenpreise übernehmen
                          </button>
                        </div>
                      )}

                      {/* Hinweis wenn keine Preise */}
                      {!hasEinzel && !hasGroessen && (
                        <div style={{ padding: '1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', textAlign: 'center', color: '#dc2626' }}>
                          <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>⚠️ Keine Preise berechnet</p>
                          <p style={{ fontSize: '0.85rem' }}>
                            Bitte wechseln Sie zum Tab "💰 Einzel" oder "👶🧑 Größen" und geben Sie die Einkaufspreise ein.
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
          <div className="preis-kalkulation-section" style={{overflowY: 'auto', maxHeight: '100%', padding: '0.85rem', background: preisTab === 'uebersicht' ? 'rgba(4, 120, 87, 0.05)' : 'rgba(107, 68, 35, 0.05)', border: preisTab === 'uebersicht' ? '2px solid rgba(4, 120, 87, 0.3)' : '2px solid rgba(107, 68, 35, 0.3)', borderRadius: '8px'}}>
            <h3 style={{marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600, color: preisTab === 'uebersicht' ? 'var(--gold, #ffd700)' : 'var(--text-primary, var(--text-primary, #ffffff))'}}>
              {preisTab === 'uebersicht' ? '✓ Aktuelle Artikelpreise' : preisTab === 'groessenabhaengig' ? '📊 Größenabhängige Kalkulation' : '📊 Handelskalkulation'}
            </h3>

            {/* ÜBERSICHT - Aktuelle gespeicherte Preise mit Varianten */}
            {preisTab === 'uebersicht' && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', marginBottom: '1rem' }}>
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
                      <div style={{ padding: '1rem', background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', borderRadius: '8px', textAlign: 'center', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))' }}>
                        <p style={{ marginBottom: '0.5rem' }}>Noch keine Preise gespeichert</p>
                        <p style={{ fontSize: '0.85rem' }}>Übernehmen Sie links die berechneten Preise</p>
                      </div>
                    );
                  }

                  return (
                    <div>
                      {/* Tabellen-Header */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 80px 70px 80px',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        background: 'var(--gold, #ffd700)',
                        color: 'var(--dark-bg, #0f0f23)',
                        borderRadius: '6px 6px 0 0',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        <span>ArtNr.</span>
                        <span style={{ textAlign: 'right' }}>Netto</span>
                        <span style={{ textAlign: 'right' }}>MwSt</span>
                        <span style={{ textAlign: 'right' }}>Brutto</span>
                      </div>

                      {/* Varianten-Liste */}
                      {varianten.map((v, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 80px 70px 80px',
                            gap: '0.5rem',
                            padding: '0.5rem',
                            background: v.typ === 'kids' ? '#dcfce7' : v.typ === 'erw' ? '#dbeafe' : '#f0fdf4',
                            borderBottom: '1px solid rgba(0,0,0,0.1)',
                            fontSize: '0.8rem'
                          }}
                        >
                          <span style={{ fontWeight: 600, color: v.typ === 'kids' ? 'var(--gold, #ffd700)' : v.typ === 'erw' ? '#1e40af' : 'var(--gold, #ffd700)' }}>
                            {v.typ === 'kids' ? '👶 ' : v.typ === 'erw' ? '🧑 ' : '💰 '}{v.artNr}
                          </span>
                          <span style={{ textAlign: 'right' }}>{v.netto.toFixed(2)} €</span>
                          <span style={{ textAlign: 'right', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))' }}>{v.mwstBetrag.toFixed(2)} €</span>
                          <span style={{ textAlign: 'right', fontWeight: 700 }}>{v.brutto.toFixed(2)} €</span>
                        </div>
                      ))}

                      {/* Zusammenfassung */}
                      <div style={{
                        padding: '0.75rem',
                        background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
                        borderRadius: '0 0 6px 6px',
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))'
                      }}>
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
                      <div style={{ padding: '1rem', background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', borderRadius: '8px', textAlign: 'center', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))' }}>
                        <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>Bitte links die Einkaufspreise eingeben</p>
                        <p style={{ fontSize: '0.8rem' }}>👶 Listeneinkaufspreis Kids</p>
                        <p style={{ fontSize: '0.8rem' }}>🧑 Listeneinkaufspreis Erwachsene</p>
                      </div>
                    )}

                    {/* KIDS Vollständige Kalkulation */}
                    {hasKids && (
                      <div style={{ background: '#dcfce7', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #86efac' }}>
                        <div style={{ fontWeight: 700, color: 'var(--gold, #ffd700)', marginBottom: '0.5rem', fontSize: '0.95rem', borderBottom: '1px solid #86efac', paddingBottom: '0.4rem' }}>
                          👶 KIDS ({formData.varianten_groessen?.filter(g => formData.groessen_kids?.includes(g)).join(', ') || 'alle'})
                        </div>
                        {/* BEZUGSKALKULATION */}
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--gold, #ffd700)', marginTop: '0.3rem' }}>📦 Bezugskalkulation</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.1rem 0' }}>
                          <span>Listeneinkaufspreis</span>
                          <span>{kidsEK.toFixed(2)} €</span>
                        </div>
                        {lieferrabatt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: '#dc2626' }}>
                          <span>− Lieferrabatt ({lieferrabatt}%)</span>
                          <span>−{(kidsEK * lieferrabatt / 100).toFixed(2)} €</span>
                        </div>}
                        {lieferskonto > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: '#dc2626' }}>
                          <span>− Lieferskonto ({lieferskonto}%)</span>
                          <span>−{(kidsZielEK * lieferskonto / 100).toFixed(2)} €</span>
                        </div>}
                        {bezugskostenKids > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: 'var(--gold, #ffd700)' }}>
                          <span>+ Bezugskosten</span>
                          <span>+{bezugskostenKids.toFixed(2)} €</span>
                        </div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.15rem 0', fontWeight: 600, background: 'rgba(22, 101, 52, 0.1)', borderRadius: '4px', paddingLeft: '0.3rem', paddingRight: '0.3rem' }}>
                          <span>= Bezugspreis</span>
                          <span>{kidsBezug.toFixed(2)} €</span>
                        </div>
                        {/* SELBSTKOSTEN */}
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--gold, #ffd700)', marginTop: '0.3rem' }}>🏭 Selbstkosten</div>
                        {gemeinkosten > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: 'var(--gold, #ffd700)' }}>
                          <span>+ Gemeinkosten ({gemeinkosten}%)</span>
                          <span>+{(kidsBezug * gemeinkosten / 100).toFixed(2)} €</span>
                        </div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.15rem 0', fontWeight: 600, background: 'rgba(22, 101, 52, 0.1)', borderRadius: '4px', paddingLeft: '0.3rem', paddingRight: '0.3rem' }}>
                          <span>= Selbstkosten</span>
                          <span>{kidsSelbstkosten.toFixed(2)} €</span>
                        </div>
                        {/* VERKAUFSKALKULATION */}
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--gold, #ffd700)', marginTop: '0.3rem' }}>💰 Verkaufskalkulation</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: 'var(--gold, #ffd700)' }}>
                          <span>+ Gewinnzuschlag ({gewinnzuschlag}%)</span>
                          <span>+{(kidsSelbstkosten * gewinnzuschlag / 100).toFixed(2)} €</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.1rem 0' }}>
                          <span>= Barverkaufspreis</span>
                          <span>{kidsBarVK.toFixed(2)} €</span>
                        </div>
                        {kundenskonto > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: 'var(--gold, #ffd700)' }}>
                          <span>+ Kundenskonto ({kundenskonto}%)</span>
                          <span>+{(kidsZielVK - kidsBarVK).toFixed(2)} €</span>
                        </div>}
                        {kundenskonto > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.1rem 0' }}>
                          <span>= Zielverkaufspreis</span>
                          <span>{kidsZielVK.toFixed(2)} €</span>
                        </div>}
                        {kundenrabatt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: 'var(--gold, #ffd700)' }}>
                          <span>+ Kundenrabatt ({kundenrabatt}%)</span>
                          <span>+{(kidsNettoVK - kidsZielVK).toFixed(2)} €</span>
                        </div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.15rem 0', fontWeight: 600, background: 'rgba(4, 120, 87, 0.15)', borderRadius: '4px', paddingLeft: '0.3rem', paddingRight: '0.3rem' }}>
                          <span>= Netto-VK</span>
                          <span>{kidsNettoVK.toFixed(2)} €</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: 'var(--gold, #ffd700)' }}>
                          <span>+ MwSt ({mwst}%)</span>
                          <span>+{(kidsNettoVK * mwst / 100).toFixed(2)} €</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', padding: '0.4rem 0.3rem', borderTop: '2px solid #86efac', fontWeight: 700, marginTop: '0.2rem', background: 'rgba(22, 101, 52, 0.2)', borderRadius: '4px' }}>
                          <span>= BRUTTO-VK</span>
                          <span style={{ color: 'var(--gold, #ffd700)', fontSize: '1.1rem' }}>{kidsBruttoVK.toFixed(2)} €</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.3rem 0', color: kidsGewinn >= 0 ? 'var(--gold, #ffd700)' : '#dc2626', borderTop: '1px dashed #86efac', marginTop: '0.3rem' }}>
                          <span>💰 Gewinn (Netto - Bezug)</span>
                          <span style={{ fontWeight: 700 }}>{kidsGewinn.toFixed(2)} € ({kidsGewinnProzent.toFixed(0)}%)</span>
                        </div>
                      </div>
                    )}

                    {/* ERWACHSENE Vollständige Kalkulation */}
                    {hasErw && (
                      <div style={{ background: '#dbeafe', borderRadius: '8px', padding: '0.75rem', marginBottom: '1rem', border: '2px solid #93c5fd' }}>
                        <div style={{ fontWeight: 700, color: '#1e40af', marginBottom: '0.5rem', fontSize: '0.95rem', borderBottom: '1px solid #93c5fd', paddingBottom: '0.4rem' }}>
                          🧑 ERWACHSENE ({formData.varianten_groessen?.filter(g => formData.groessen_erwachsene?.includes(g)).join(', ') || 'alle'})
                        </div>
                        {/* BEZUGSKALKULATION */}
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#1e40af', marginTop: '0.3rem' }}>📦 Bezugskalkulation</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.1rem 0' }}>
                          <span>Listeneinkaufspreis</span>
                          <span>{erwEK.toFixed(2)} €</span>
                        </div>
                        {lieferrabatt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: '#dc2626' }}>
                          <span>− Lieferrabatt ({lieferrabatt}%)</span>
                          <span>−{(erwEK * lieferrabatt / 100).toFixed(2)} €</span>
                        </div>}
                        {lieferskonto > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: '#dc2626' }}>
                          <span>− Lieferskonto ({lieferskonto}%)</span>
                          <span>−{(erwZielEK * lieferskonto / 100).toFixed(2)} €</span>
                        </div>}
                        {bezugskostenErw > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: 'var(--gold, #ffd700)' }}>
                          <span>+ Bezugskosten</span>
                          <span>+{bezugskostenErw.toFixed(2)} €</span>
                        </div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.15rem 0', fontWeight: 600, background: 'rgba(30, 64, 175, 0.1)', borderRadius: '4px', paddingLeft: '0.3rem', paddingRight: '0.3rem' }}>
                          <span>= Bezugspreis</span>
                          <span>{erwBezug.toFixed(2)} €</span>
                        </div>
                        {/* SELBSTKOSTEN */}
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#1e40af', marginTop: '0.3rem' }}>🏭 Selbstkosten</div>
                        {gemeinkosten > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: 'var(--gold, #ffd700)' }}>
                          <span>+ Gemeinkosten ({gemeinkosten}%)</span>
                          <span>+{(erwBezug * gemeinkosten / 100).toFixed(2)} €</span>
                        </div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.15rem 0', fontWeight: 600, background: 'rgba(30, 64, 175, 0.1)', borderRadius: '4px', paddingLeft: '0.3rem', paddingRight: '0.3rem' }}>
                          <span>= Selbstkosten</span>
                          <span>{erwSelbstkosten.toFixed(2)} €</span>
                        </div>
                        {/* VERKAUFSKALKULATION */}
                        <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#1e40af', marginTop: '0.3rem' }}>💰 Verkaufskalkulation</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: 'var(--gold, #ffd700)' }}>
                          <span>+ Gewinnzuschlag ({gewinnzuschlag}%)</span>
                          <span>+{(erwSelbstkosten * gewinnzuschlag / 100).toFixed(2)} €</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.1rem 0' }}>
                          <span>= Barverkaufspreis</span>
                          <span>{erwBarVK.toFixed(2)} €</span>
                        </div>
                        {kundenskonto > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: 'var(--gold, #ffd700)' }}>
                          <span>+ Kundenskonto ({kundenskonto}%)</span>
                          <span>+{(erwZielVK - erwBarVK).toFixed(2)} €</span>
                        </div>}
                        {kundenskonto > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.1rem 0' }}>
                          <span>= Zielverkaufspreis</span>
                          <span>{erwZielVK.toFixed(2)} €</span>
                        </div>}
                        {kundenrabatt > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: 'var(--gold, #ffd700)' }}>
                          <span>+ Kundenrabatt ({kundenrabatt}%)</span>
                          <span>+{(erwNettoVK - erwZielVK).toFixed(2)} €</span>
                        </div>}
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '0.15rem 0', fontWeight: 600, background: 'rgba(4, 120, 87, 0.15)', borderRadius: '4px', paddingLeft: '0.3rem', paddingRight: '0.3rem' }}>
                          <span>= Netto-VK</span>
                          <span>{erwNettoVK.toFixed(2)} €</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', padding: '0.05rem 0', color: 'var(--gold, #ffd700)' }}>
                          <span>+ MwSt ({mwst}%)</span>
                          <span>+{(erwNettoVK * mwst / 100).toFixed(2)} €</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', padding: '0.4rem 0.3rem', borderTop: '2px solid #93c5fd', fontWeight: 700, marginTop: '0.2rem', background: 'rgba(30, 64, 175, 0.2)', borderRadius: '4px' }}>
                          <span>= BRUTTO-VK</span>
                          <span style={{ color: '#1e40af', fontSize: '1.1rem' }}>{erwBruttoVK.toFixed(2)} €</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.3rem 0', color: erwGewinn >= 0 ? 'var(--gold, #ffd700)' : '#dc2626', borderTop: '1px dashed #93c5fd' }}>
                          <span>💰 Gewinn</span>
                          <span style={{ fontWeight: 700 }}>{erwGewinn.toFixed(2)} € ({erwGewinnProzent.toFixed(0)}%)</span>
                        </div>
                      </div>
                    )}

                    {/* Preisdifferenz */}
                    {hasKids && hasErw && (
                      <div style={{ background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', borderRadius: '8px', padding: '0.6rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.25rem' }}>
                          <span>📊 Preisdifferenz (Brutto)</span>
                          <span style={{ fontWeight: 700 }}>{(erwBruttoVK - kidsBruttoVK).toFixed(2)} €</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))' }}>
                          <span>Kids ist günstiger um</span>
                          <span style={{ fontWeight: 600 }}>{erwBruttoVK > 0 ? ((erwBruttoVK - kidsBruttoVK) / erwBruttoVK * 100).toFixed(0) : 0}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            )}

            {/* EINZELKALKULATION (Standard Handelskalkulation) */}
            {preisTab === 'einzelkalkulation' && (
            <div className="kalkulation-table" style={{display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
              {/* BEZUGSKALKULATION */}
              <div style={{marginBottom: '0.5rem', padding: '0.3rem', background: 'rgba(107, 68, 35, 0.1)', borderRadius: '4px'}}>
                <strong style={{fontSize: '0.85rem', color: 'var(--gold, #ffd700)'}}>Bezugskalkulation</strong>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem'}}>
                <span>Listeneinkaufspreis</span>
                <span>{listeneinkaufspreis_wert.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#ef4444'}}>
                <span>− Lieferrabatt ({lieferrabatt_prozent}%)</span>
                <span>−{lieferrabatt_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(107, 68, 35, 0.05)'}}>
                <span><strong>= Zieleinkaufspreis</strong></span>
                <span><strong>{zieleinkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#ef4444'}}>
                <span>− Lieferskonto ({lieferskonto_prozent}%)</span>
                <span>−{lieferskonto_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(107, 68, 35, 0.05)'}}>
                <span><strong>= Bareinkaufspreis</strong></span>
                <span><strong>{bareinkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--gold, #ffd700)'}}>
                <span>+ Bezugskosten</span>
                <span>+{bezugskosten_wert.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.4rem 0.6rem', fontSize: '0.85rem', background: 'rgba(107, 68, 35, 0.1)', fontWeight: 600}}>
                <span><strong>= Bezugspreis</strong></span>
                <span><strong>{bezugspreis.toFixed(2)} €</strong></span>
              </div>

              <div style={{height: '8px'}}></div>

              {/* SELBSTKOSTENKALKULATION */}
              <div style={{marginBottom: '0.5rem', padding: '0.3rem', background: 'rgba(107, 68, 35, 0.1)', borderRadius: '4px'}}>
                <strong style={{fontSize: '0.85rem', color: 'var(--gold, #ffd700)'}}>Selbstkostenkalkulation</strong>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--gold, #ffd700)'}}>
                <span>+ Gemeinkosten ({gemeinkosten_prozent}%)</span>
                <span>+{gemeinkosten_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(107, 68, 35, 0.05)'}}>
                <span><strong>= Selbstkostenpreis</strong></span>
                <span><strong>{selbstkostenpreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--gold, #ffd700)'}}>
                <span>+ Gewinnzuschlag ({gewinnzuschlag_prozent}%)</span>
                <span>+{gewinnzuschlag_euro.toFixed(2)} €</span>
              </div>

              <div style={{height: '8px'}}></div>

              {/* VERKAUFSKALKULATION */}
              <div style={{marginBottom: '0.5rem', padding: '0.3rem', background: 'rgba(107, 68, 35, 0.1)', borderRadius: '4px'}}>
                <strong style={{fontSize: '0.85rem', color: 'var(--gold, #ffd700)'}}>Verkaufskalkulation</strong>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(107, 68, 35, 0.05)'}}>
                <span><strong>= Barverkaufspreis</strong></span>
                <span><strong>{barverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--gold, #ffd700)'}}>
                <span>+ Kundenskonto ({kundenskonto_prozent}%)</span>
                <span>+{kundenskonto_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(107, 68, 35, 0.05)'}}>
                <span><strong>= Zielverkaufspreis</strong></span>
                <span><strong>{zielverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--gold, #ffd700)'}}>
                <span>+ Kundenrabatt ({kundenrabatt_prozent}%)</span>
                <span>+{kundenrabatt_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.4rem 0.6rem', fontSize: '0.85rem', background: 'rgba(107, 68, 35, 0.1)', fontWeight: 600}}>
                <span><strong>= Nettoverkaufspreis</strong></span>
                <span><strong>{nettoverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: 'var(--gold, #ffd700)'}}>
                <span>+ Umsatzsteuer ({mwst_prozent}%)</span>
                <span>+{umsatzsteuer_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row final" style={{padding: '0.5rem 0.6rem', fontSize: '0.9rem', background: 'rgba(107, 68, 35, 0.15)', borderRadius: '6px', marginTop: '0.5rem'}}>
                <span><strong>= BRUTTOVERKAUFSPREIS</strong></span>
                <span style={{color: 'var(--gold, #ffd700)'}}><strong>{bruttoverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div style={{height: '8px', borderTop: '1px solid rgba(107, 68, 35, 0.3)', margin: '0.5rem 0'}}></div>

              {/* GEWINN */}
              <div className="kalkulation-row profit" style={{padding: '0.4rem 0.6rem', fontSize: '0.85rem'}}>
                <span>💰 Gewinn gesamt</span>
                <span style={{color: gewinn_gesamt >= 0 ? 'var(--gold, #ffd700)' : '#ef4444', fontWeight: 600}}>
                  {gewinn_gesamt.toFixed(2)} €
                </span>
              </div>

              <div className="kalkulation-row profit" style={{padding: '0.4rem 0.6rem', fontSize: '0.85rem'}}>
                <span>📈 Gewinnspanne</span>
                <span style={{color: gewinnspanne_prozent >= 0 ? 'var(--gold, #ffd700)' : '#ef4444', fontWeight: 600}}>
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

  // Einheitlicher Checkbox-Style für Light Mode
  const checkboxContainerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem 1.25rem',
    background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
    border: '2px solid var(--border-secondary, rgba(255, 255, 255, 0.1))',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  };

  const checkboxStyle = {
    width: '22px',
    height: '22px',
    accentColor: 'var(--gold, #ffd700)',
    cursor: 'pointer',
    appearance: 'auto',
    WebkitAppearance: 'checkbox',
    MozAppearance: 'checkbox',
    opacity: 1,
    position: 'relative'
  };

  const checkboxLabelTextStyle = {
    color: 'var(--text-primary, #ffffff)',
    fontSize: '1rem',
    fontWeight: 500
  };

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
      <div className="tab-content-section" style={{ overflow: 'auto' }}>
        {/* Lager-Tracking Checkbox */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label
            style={{
              ...checkboxContainerStyle,
              borderColor: formData.lager_tracking ? 'var(--gold, #ffd700)' : 'var(--border-secondary, rgba(255, 255, 255, 0.1))',
              background: formData.lager_tracking ? 'rgba(107, 68, 35, 0.05)' : '#ffffff',
              maxWidth: '400px'
            }}
          >
            <input
              type="checkbox"
              name="lager_tracking"
              checked={formData.lager_tracking}
              onChange={handleInputChange}
              style={checkboxStyle}
            />
            <span style={checkboxLabelTextStyle}>
              📦 Lagerbestand aktiv verfolgen
            </span>
          </label>
        </div>

        {formData.lager_tracking && (
          <>
            {/* Ohne Varianten: Einfache Bestandseingabe */}
            {!hatVarianten && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', maxWidth: '800px' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={basisLabelStyle}>Aktueller Bestand</label>
                  <input
                    type="number"
                    name="lagerbestand"
                    value={formData.lagerbestand}
                    onChange={handleInputChange}
                    min="0"
                    style={basisInputStyle}
                    placeholder="0"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={basisLabelStyle}>Mindestbestand</label>
                  <input
                    type="number"
                    name="mindestbestand"
                    value={formData.mindestbestand}
                    onChange={handleInputChange}
                    min="0"
                    style={basisInputStyle}
                    placeholder="0"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={basisLabelStyle}>Artikelfarbe</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="color"
                      name="farbe_hex"
                      value={formData.farbe_hex}
                      onChange={handleInputChange}
                      style={{ width: '60px', height: '46px', cursor: 'pointer', borderRadius: '8px', border: '2px solid var(--border-secondary, rgba(255, 255, 255, 0.1))' }}
                    />
                    <input
                      type="text"
                      value={formData.farbe_hex}
                      onChange={(e) => setFormData(prev => ({...prev, farbe_hex: e.target.value}))}
                      style={basisInputStyle}
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Mit Varianten: Bestandstabelle für alle Kombinationen */}
            {hatVarianten && (
              <div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                  padding: '1rem',
                  background: 'rgba(107, 68, 35, 0.05)',
                  borderRadius: '8px'
                }}>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--gold, #ffd700)', fontSize: '1.1rem' }}>
                      📊 Varianten-Bestand ({kombinationen.length} Kombinationen)
                    </h3>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', fontSize: '0.9rem' }}>
                      Erfassen Sie den Bestand für jede Variante
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span style={{ padding: '0.5rem 1rem', background: 'var(--gold, #ffd700)', color: 'var(--dark-bg, #0f0f23)', borderRadius: '20px', fontSize: '0.85rem' }}>
                      {formData.varianten_groessen.length} Größen
                    </span>
                    <span style={{ padding: '0.5rem 1rem', background: 'var(--gold, #ffd700)', color: 'var(--dark-bg, #0f0f23)', borderRadius: '20px', fontSize: '0.85rem' }}>
                      {formData.varianten_farben.length} Farben
                    </span>
                    <span style={{ padding: '0.5rem 1rem', background: 'var(--gold, #ffd700)', color: 'var(--dark-bg, #0f0f23)', borderRadius: '20px', fontSize: '0.85rem' }}>
                      {formData.varianten_material.length} Material
                    </span>
                  </div>
                </div>

                {/* Mindestbestand für alle setzen */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  marginBottom: '1rem',
                  padding: '1rem',
                  background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
                  border: '2px solid var(--border-secondary, rgba(255, 255, 255, 0.1))',
                  borderRadius: '8px'
                }}>
                  <label style={{ color: 'var(--gold, #ffd700)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Mindestbestand für alle:
                  </label>
                  <input
                    type="number"
                    id="global-mindestbestand"
                    min="0"
                    placeholder="z.B. 5"
                    style={{
                      ...basisInputStyle,
                      width: '120px',
                      textAlign: 'center'
                    }}
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
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: 'var(--gold, #ffd700)',
                      color: 'var(--dark-bg, #0f0f23)',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ✓ Für alle übernehmen
                  </button>
                </div>

                {/* Bestandstabelle */}
                <div style={{
                  background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
                  border: '2px solid var(--border-secondary, rgba(255, 255, 255, 0.1))',
                  borderRadius: '12px',
                  overflow: 'hidden'
                }}>
                  {/* Tabellen-Header */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 120px',
                    gap: '1rem',
                    padding: '1rem 1.5rem',
                    background: 'var(--bg-hover, rgba(255, 255, 255, 0.12))',
                    borderBottom: '2px solid var(--border-secondary, rgba(255, 255, 255, 0.1))',
                    fontWeight: 600,
                    color: 'var(--gold, #ffd700)',
                    fontSize: '0.9rem'
                  }}>
                    <span>Variante</span>
                    <span>Bestand</span>
                    <span>Mindestbestand</span>
                    <span>Status</span>
                  </div>

                  {/* Tabellen-Inhalt */}
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {kombinationen.map((kombi, index) => {
                      const bestandData = formData.varianten_bestand[kombi.key] || { bestand: 0, mindestbestand: 0 };
                      const istKritisch = bestandData.bestand <= bestandData.mindestbestand && bestandData.mindestbestand > 0;
                      const istLeer = bestandData.bestand === 0;

                      return (
                        <div
                          key={kombi.key}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr 120px',
                            gap: '1rem',
                            padding: '0.75rem 1.5rem',
                            borderBottom: index < kombinationen.length - 1 ? '1px solid #e9ecef' : 'none',
                            background: istLeer ? 'rgba(239, 68, 68, 0.05)' : istKritisch ? 'rgba(234, 179, 8, 0.1)' : '#ffffff',
                            alignItems: 'center'
                          }}
                        >
                          {/* Varianten-Label */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {kombi.farbe.hex && (
                              <span style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: kombi.farbe.hex,
                                border: kombi.farbe.hex === '#FFFFFF' ? '1px solid var(--border-secondary, rgba(255, 255, 255, 0.1))' : 'none',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                                flexShrink: 0
                              }} />
                            )}
                            <span style={{ color: 'var(--text-primary, #ffffff)', fontWeight: 500 }}>
                              {kombi.label}
                            </span>
                          </div>

                          {/* Bestand Input */}
                          <input
                            type="number"
                            value={bestandData.bestand}
                            onChange={(e) => updateVariantenBestand(kombi.key, 'bestand', e.target.value)}
                            min="0"
                            style={{
                              ...basisInputStyle,
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.95rem',
                              textAlign: 'center'
                            }}
                          />

                          {/* Mindestbestand Input */}
                          <input
                            type="number"
                            value={bestandData.mindestbestand}
                            onChange={(e) => updateVariantenBestand(kombi.key, 'mindestbestand', e.target.value)}
                            min="0"
                            style={{
                              ...basisInputStyle,
                              padding: '0.5rem 0.75rem',
                              fontSize: '0.95rem',
                              textAlign: 'center'
                            }}
                          />

                          {/* Status */}
                          <span style={{
                            padding: '0.35rem 0.75rem',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            textAlign: 'center',
                            background: istLeer ? '#fef2f2' : istKritisch ? '#fef3c7' : '#ecfdf5',
                            color: istLeer ? '#dc2626' : istKritisch ? '#d97706' : 'var(--gold, #ffd700)',
                            border: `1px solid ${istLeer ? '#fca5a5' : istKritisch ? '#fcd34d' : '#6ee7b7'}`
                          }}>
                            {istLeer ? '❌ Leer' : istKritisch ? '⚠️ Kritisch' : '✓ OK'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Zusammenfassung */}
                <div style={{
                  marginTop: '1.5rem',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '1rem'
                }}>
                  <div style={{ padding: '1rem', background: 'var(--bg-hover, rgba(255, 255, 255, 0.12))', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', fontSize: '0.85rem', margin: '0 0 0.25rem 0' }}>Gesamtbestand</p>
                    <p style={{ color: 'var(--gold, #ffd700)', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                      {Object.values(formData.varianten_bestand).reduce((sum, v) => sum + (v.bestand || 0), 0)}
                    </p>
                  </div>
                  <div style={{ padding: '1rem', background: '#ecfdf5', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ color: 'var(--gold, #ffd700)', fontSize: '0.85rem', margin: '0 0 0.25rem 0' }}>Verfügbar</p>
                    <p style={{ color: 'var(--gold, #ffd700)', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                      {kombinationen.filter(k => {
                        const b = formData.varianten_bestand[k.key];
                        return b && b.bestand > b.mindestbestand;
                      }).length}
                    </p>
                  </div>
                  <div style={{ padding: '1rem', background: '#fef3c7', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ color: '#d97706', fontSize: '0.85rem', margin: '0 0 0.25rem 0' }}>Kritisch</p>
                    <p style={{ color: '#d97706', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
                      {kombinationen.filter(k => {
                        const b = formData.varianten_bestand[k.key];
                        return b && b.bestand <= b.mindestbestand && b.bestand > 0;
                      }).length}
                    </p>
                  </div>
                  <div style={{ padding: '1rem', background: '#fef2f2', borderRadius: '8px', textAlign: 'center' }}>
                    <p style={{ color: '#dc2626', fontSize: '0.85rem', margin: '0 0 0.25rem 0' }}>Leer</p>
                    <p style={{ color: '#dc2626', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
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
          <div style={{
            padding: '2rem',
            background: 'var(--bg-hover, rgba(255, 255, 255, 0.12))',
            borderRadius: '12px',
            textAlign: 'center',
            color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))'
          }}>
            <p style={{ fontSize: '1.1rem', margin: 0 }}>
              📦 Aktivieren Sie die Lagerbestandsverfolgung, um den Bestand zu verwalten.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderTabEinstellungen = () => (
    <div className="tab-content-section">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '500px' }}>
        <label
          style={{
            ...checkboxContainerStyle,
            borderColor: formData.aktiv ? 'var(--gold, #ffd700)' : 'var(--border-secondary, rgba(255, 255, 255, 0.1))',
            background: formData.aktiv ? 'rgba(107, 68, 35, 0.05)' : '#ffffff'
          }}
        >
          <input
            type="checkbox"
            name="aktiv"
            checked={formData.aktiv}
            onChange={handleInputChange}
            style={checkboxStyle}
          />
          <span style={checkboxLabelTextStyle}>
            ✅ Artikel aktiv
          </span>
        </label>

        <label
          style={{
            ...checkboxContainerStyle,
            borderColor: formData.sichtbar_kasse ? 'var(--gold, #ffd700)' : 'var(--border-secondary, rgba(255, 255, 255, 0.1))',
            background: formData.sichtbar_kasse ? 'rgba(107, 68, 35, 0.05)' : '#ffffff'
          }}
        >
          <input
            type="checkbox"
            name="sichtbar_kasse"
            checked={formData.sichtbar_kasse}
            onChange={handleInputChange}
            style={checkboxStyle}
          />
          <span style={checkboxLabelTextStyle}>
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
        <div style={{
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
          border: '2px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h3 style={{
            margin: '0 0 1rem 0',
            color: '#22c55e',
            fontSize: '1.2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🏷️ Mitglieder-Rabatt für Verbandsmitglieder
          </h3>
          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.95rem' }}>
            Hier kannst du einen speziellen Rabatt für aktive Verbandsmitglieder (bezahlt oder beitragsfrei) festlegen.
            Dieser Rabatt wird im TDA-Shop angezeigt.
          </p>
        </div>

        {rabattLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255, 255, 255, 0.5)' }}>
            Lädt Rabatt-Daten...
          </div>
        ) : (
          <div style={{ maxWidth: '600px' }}>
            {/* Rabatt aktivieren */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem',
                background: rabattData.hat_rabatt ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
                border: `2px solid ${rabattData.hat_rabatt ? 'rgba(34, 197, 94, 0.5)' : 'var(--border-secondary, rgba(255, 255, 255, 0.1))'}`,
                borderRadius: '10px',
                cursor: 'pointer',
                marginBottom: '1.5rem',
                transition: 'all 0.3s ease'
              }}
            >
              <input
                type="checkbox"
                checked={rabattData.hat_rabatt}
                onChange={(e) => setRabattData(prev => ({ ...prev, hat_rabatt: e.target.checked }))}
                style={{ width: '22px', height: '22px', accentColor: '#22c55e' }}
              />
              <span style={{ color: 'var(--text-primary, #ffffff)', fontWeight: 600, fontSize: '1.05rem' }}>
                Mitglieder-Rabatt aktivieren
              </span>
            </label>

            {rabattData.hat_rabatt && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Rabatt-Typ */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--gold, #ffd700)' }}>
                    Rabatt-Typ
                  </label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <label style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1rem',
                      background: rabattData.rabatt_typ === 'prozent' ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
                      border: `2px solid ${rabattData.rabatt_typ === 'prozent' ? '#22c55e' : 'var(--border-secondary, rgba(255, 255, 255, 0.1))'}`,
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        checked={rabattData.rabatt_typ === 'prozent'}
                        onChange={() => setRabattData(prev => ({ ...prev, rabatt_typ: 'prozent' }))}
                        style={{ accentColor: '#22c55e' }}
                      />
                      <span style={{ color: 'var(--text-primary, #ffffff)' }}>Prozent (%)</span>
                    </label>
                    <label style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.75rem 1rem',
                      background: rabattData.rabatt_typ === 'festbetrag' ? 'rgba(34, 197, 94, 0.15)' : 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
                      border: `2px solid ${rabattData.rabatt_typ === 'festbetrag' ? '#22c55e' : 'var(--border-secondary, rgba(255, 255, 255, 0.1))'}`,
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="radio"
                        checked={rabattData.rabatt_typ === 'festbetrag'}
                        onChange={() => setRabattData(prev => ({ ...prev, rabatt_typ: 'festbetrag' }))}
                        style={{ accentColor: '#22c55e' }}
                      />
                      <span style={{ color: 'var(--text-primary, #ffffff)' }}>Festbetrag (€)</span>
                    </label>
                  </div>
                </div>

                {/* Rabatt-Wert */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--gold, #ffd700)' }}>
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
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
                      border: '2px solid var(--border-secondary, rgba(255, 255, 255, 0.1))',
                      borderRadius: '8px',
                      color: 'var(--text-primary, #ffffff)',
                      fontSize: '1.1rem',
                      width: '200px'
                    }}
                  />
                </div>

                {/* Gilt für */}
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--gold, #ffd700)' }}>
                    Gilt für
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={rabattData.gilt_fuer_dojo}
                        onChange={(e) => setRabattData(prev => ({ ...prev, gilt_fuer_dojo: e.target.checked }))}
                        style={{ width: '18px', height: '18px', accentColor: '#22c55e' }}
                      />
                      <span style={{ color: 'var(--text-primary, #ffffff)' }}>🥋 Dojo-Mitglieder</span>
                    </label>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={rabattData.gilt_fuer_einzelperson}
                        onChange={(e) => setRabattData(prev => ({ ...prev, gilt_fuer_einzelperson: e.target.checked }))}
                        style={{ width: '18px', height: '18px', accentColor: '#22c55e' }}
                      />
                      <span style={{ color: 'var(--text-primary, #ffffff)' }}>👤 Einzelpersonen</span>
                    </label>
                  </div>
                </div>

                {/* Vorschau */}
                {parseFloat(rabattData.rabatt_wert) > 0 && (
                  <div style={{
                    marginTop: '1rem',
                    padding: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(16, 185, 129, 0.08) 100%)',
                    border: '2px solid rgba(34, 197, 94, 0.3)',
                    borderRadius: '12px'
                  }}>
                    <h4 style={{ margin: '0 0 1rem 0', color: '#22c55e', fontSize: '1rem' }}>
                      📊 Vorschau (bei Artikelpreis {beispielPreis.toFixed(2)} €)
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{
                        textDecoration: 'line-through',
                        color: 'rgba(255, 255, 255, 0.4)',
                        fontSize: '1.1rem'
                      }}>
                        {beispielPreis.toFixed(2)} €
                      </span>
                      <span style={{ color: 'rgba(255, 255, 255, 0.5)' }}>→</span>
                      <span style={{
                        color: '#22c55e',
                        fontWeight: 700,
                        fontSize: '1.3rem'
                      }}>
                        {rabattierterPreis.toFixed(2)} €
                      </span>
                      <span style={{
                        background: 'rgba(34, 197, 94, 0.2)',
                        color: '#22c55e',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.9rem',
                        fontWeight: 600
                      }}>
                        -{ersparnis.toFixed(2)} € gespart
                      </span>
                    </div>
                  </div>
                )}

                {/* Speichern-Button */}
                <div style={{ marginTop: '1rem' }}>
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
                    style={{
                      padding: '0.75rem 2rem',
                      background: '#22c55e',
                      color: '#000',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: rabattLoading ? 'not-allowed' : 'pointer',
                      fontSize: '1rem',
                      fontWeight: 600,
                      opacity: rabattLoading ? 0.5 : 1
                    }}
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
    if (formData.custom_groesse && !formData.varianten_groessen.includes(formData.custom_groesse)) {
      setFormData(prev => ({
        ...prev,
        varianten_groessen: [...prev.varianten_groessen, prev.custom_groesse],
        custom_groesse: ''
      }));
    }
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

  // Input Style für bessere Sichtbarkeit
  const inputStyle = {
    padding: '0.75rem 1rem',
    background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
    border: '2px solid var(--border-secondary, rgba(255, 255, 255, 0.1))',
    borderRadius: '8px',
    color: 'var(--text-primary, #ffffff)',
    fontSize: '1rem',
    width: '100%',
    boxSizing: 'border-box'
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer'
  };

  const renderTabVarianten = () => (
    <div className="tab-content-section" style={{ overflow: 'auto' }}>
      {/* Varianten aktivieren */}
      <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(107, 68, 35, 0.05)', borderRadius: '12px', border: '2px solid rgba(107, 68, 35, 0.2)' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary, var(--text-primary, #ffffff))' }}>
          <input
            type="checkbox"
            checked={formData.hat_varianten}
            onChange={(e) => setFormData(prev => ({ ...prev, hat_varianten: e.target.checked }))}
            style={{ width: '20px', height: '20px', accentColor: 'var(--gold, #ffd700)' }}
          />
          🎨 Artikel hat Varianten (Größen, Farben, Material)
        </label>
      </div>

      {formData.hat_varianten && (
        <div style={{ display: 'grid', gap: '2rem' }}>
          {/* GRÖSSEN */}
          <div style={{ background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', border: '2px solid var(--border-secondary, rgba(255, 255, 255, 0.1))', borderRadius: '12px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--gold, #ffd700)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                📏 Größen
              </h3>
              <button
                type="button"
                onClick={() => {
                  const alleGroessen = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '100', '110', '120', '130', '140', '150', '160', '170', '180', '190', '200'];
                  setFormData(prev => ({ ...prev, varianten_groessen: alleGroessen }));
                }}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--gold, #ffd700)'
                }}
              >
                ✓ Alle auswählen
              </button>
            </div>

            {/* Standard Größen */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <p style={{ color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', fontSize: '0.9rem', margin: 0 }}>Konfektionsgrößen:</p>
                <button
                  type="button"
                  onClick={() => {
                    const konfektions = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
                    setFormData(prev => ({
                      ...prev,
                      varianten_groessen: [...new Set([...prev.varianten_groessen, ...konfektions])]
                    }));
                  }}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))'
                  }}
                >
                  Alle
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].map(groesse => (
                  <button
                    key={groesse}
                    type="button"
                    onClick={() => toggleGroesse(groesse)}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '2px solid',
                      borderColor: formData.varianten_groessen.includes(groesse) ? 'var(--gold, #ffd700)' : 'var(--border-secondary, rgba(255, 255, 255, 0.1))',
                      borderRadius: '8px',
                      background: formData.varianten_groessen.includes(groesse) ? 'var(--gold, #ffd700)' : 'rgba(255, 255, 255, 0.08)',
                      color: formData.varianten_groessen.includes(groesse) ? '#ffffff' : 'var(--text-primary, #ffffff)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {groesse}
                  </button>
                ))}
              </div>
            </div>

            {/* Körpergrößen */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <p style={{ color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', fontSize: '0.9rem', margin: 0 }}>Körpergrößen (cm):</p>
                <button
                  type="button"
                  onClick={() => {
                    const koerper = ['100', '110', '120', '130', '140', '150', '160', '170', '180', '190', '200'];
                    setFormData(prev => ({
                      ...prev,
                      varianten_groessen: [...new Set([...prev.varianten_groessen, ...koerper])]
                    }));
                  }}
                  style={{
                    padding: '0.25rem 0.5rem',
                    background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
                    border: '1px solid #d1d5db',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))'
                  }}
                >
                  Alle
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['100', '110', '120', '130', '140', '150', '160', '170', '180', '190', '200'].map(groesse => (
                  <button
                    key={groesse}
                    type="button"
                    onClick={() => toggleGroesse(groesse)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      border: '2px solid',
                      borderColor: formData.varianten_groessen.includes(groesse) ? 'var(--gold, #ffd700)' : 'var(--border-secondary, rgba(255, 255, 255, 0.1))',
                      borderRadius: '8px',
                      background: formData.varianten_groessen.includes(groesse) ? 'var(--gold, #ffd700)' : 'rgba(255, 255, 255, 0.08)',
                      color: formData.varianten_groessen.includes(groesse) ? '#ffffff' : 'var(--text-primary, #ffffff)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {groesse}
                  </button>
                ))}
              </div>
            </div>

            {/* Eigene Größe hinzufügen */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Eigene Größe..."
                value={formData.custom_groesse}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_groesse: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={addCustomGroesse}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--gold, #ffd700)',
                  color: 'var(--dark-bg, #0f0f23)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                + Hinzufügen
              </button>
            </div>

            {/* Ausgewählte Größen */}
            {formData.varianten_groessen.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-hover, rgba(255, 255, 255, 0.12))', borderRadius: '8px' }}>
                <p style={{ color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Ausgewählt ({formData.varianten_groessen.length}):</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {formData.varianten_groessen.map(g => (
                    <span key={g} style={{ padding: '0.25rem 0.75rem', background: 'var(--gold, #ffd700)', color: 'var(--dark-bg, #0f0f23)', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 500 }}>
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* FARBEN */}
          <div style={{ background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', border: '2px solid var(--border-secondary, rgba(255, 255, 255, 0.1))', borderRadius: '12px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--gold, #ffd700)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🎨 Farben
              </h3>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, varianten_farben: [...verfuegbareFarben] }));
                }}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--gold, #ffd700)'
                }}
              >
                ✓ Alle auswählen
              </button>
            </div>

            {/* Standard Farben */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
              {verfuegbareFarben.map(farbe => (
                <button
                  key={farbe.name}
                  type="button"
                  onClick={() => toggleFarbe(farbe)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 1rem',
                    border: '2px solid',
                    borderColor: formData.varianten_farben.some(f => f.name === farbe.name) ? 'var(--gold, #ffd700)' : 'var(--border-secondary, rgba(255, 255, 255, 0.1))',
                    borderRadius: '8px',
                    background: formData.varianten_farben.some(f => f.name === farbe.name) ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: farbe.hex,
                    border: farbe.hex === '#FFFFFF' ? '1px solid var(--border-secondary, rgba(255, 255, 255, 0.1))' : 'none',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                  <span style={{ color: 'var(--text-primary, #ffffff)', fontWeight: 500 }}>{farbe.name}</span>
                </button>
              ))}
            </div>

            {/* Eigene Farbe hinzufügen */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Farbname..."
                value={formData.custom_farbe_name}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_farbe_name: e.target.value }))}
                style={{ ...inputStyle, flex: 1, minWidth: '150px' }}
              />
              <input
                type="color"
                value={formData.custom_farbe_hex}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_farbe_hex: e.target.value }))}
                style={{ width: '50px', height: '42px', cursor: 'pointer', borderRadius: '8px', border: '2px solid var(--border-secondary, rgba(255, 255, 255, 0.1))' }}
              />
              <button
                type="button"
                onClick={addCustomFarbe}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--gold, #ffd700)',
                  color: 'var(--dark-bg, #0f0f23)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                + Hinzufügen
              </button>
            </div>

            {/* Ausgewählte Farben */}
            {formData.varianten_farben.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-hover, rgba(255, 255, 255, 0.12))', borderRadius: '8px' }}>
                <p style={{ color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Ausgewählt ({formData.varianten_farben.length}):</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {formData.varianten_farben.map(f => (
                    <span key={f.name} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.25rem 0.75rem',
                      background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
                      border: '1px solid var(--border-secondary, rgba(255, 255, 255, 0.1))',
                      borderRadius: '20px',
                      fontSize: '0.85rem'
                    }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: f.hex, border: f.hex === '#FFFFFF' ? '1px solid var(--border-secondary, rgba(255, 255, 255, 0.1))' : 'none' }} />
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* MATERIAL */}
          <div style={{ background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', border: '2px solid var(--border-secondary, rgba(255, 255, 255, 0.1))', borderRadius: '12px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--gold, #ffd700)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🧵 Material / Stoff
              </h3>
              <button
                type="button"
                onClick={() => {
                  const alleMaterialien = ['Baumwolle', 'Polyester', 'Mischgewebe', 'Seide', 'Leinen', 'Wolle', 'Leder', 'Kunstleder'];
                  setFormData(prev => ({ ...prev, varianten_material: alleMaterialien }));
                }}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: '#dcfce7',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  color: 'var(--gold, #ffd700)'
                }}
              >
                ✓ Alle auswählen
              </button>
            </div>

            {/* Schnell-Auswahl */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              {['Baumwolle', 'Polyester', 'Mischgewebe', 'Seide', 'Leinen', 'Wolle', 'Leder', 'Kunstleder'].map(mat => (
                <button
                  key={mat}
                  type="button"
                  onClick={() => {
                    if (!formData.varianten_material.includes(mat)) {
                      setFormData(prev => ({ ...prev, varianten_material: [...prev.varianten_material, mat] }));
                    }
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    border: '2px solid',
                    borderColor: formData.varianten_material.includes(mat) ? 'var(--gold, #ffd700)' : 'var(--border-secondary, rgba(255, 255, 255, 0.1))',
                    borderRadius: '8px',
                    background: formData.varianten_material.includes(mat) ? 'var(--gold, #ffd700)' : 'rgba(255, 255, 255, 0.08)',
                    color: formData.varianten_material.includes(mat) ? '#ffffff' : 'var(--text-primary, #ffffff)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {mat}
                </button>
              ))}
            </div>

            {/* Eigenes Material hinzufügen */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Eigenes Material..."
                value={formData.custom_material}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_material: e.target.value }))}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={addCustomMaterial}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--gold, #ffd700)',
                  color: 'var(--dark-bg, #0f0f23)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                + Hinzufügen
              </button>
            </div>

            {/* Ausgewählte Materialien */}
            {formData.varianten_material.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-hover, rgba(255, 255, 255, 0.12))', borderRadius: '8px' }}>
                <p style={{ color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Ausgewählt ({formData.varianten_material.length}):</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {formData.varianten_material.map(m => (
                    <span key={m} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.25rem 0.75rem',
                      background: 'var(--gold, #ffd700)',
                      color: 'var(--dark-bg, #0f0f23)',
                      borderRadius: '20px',
                      fontSize: '0.85rem',
                      fontWeight: 500
                    }}>
                      {m}
                      <button
                        type="button"
                        onClick={() => removeMaterial(m)}
                        style={{
                          background: 'rgba(255,255,255,0.3)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          color: '#ffffff',
                          fontSize: '0.7rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
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
          <div style={{ background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', border: '2px solid var(--border-primary, rgba(255, 215, 0, 0.2))', borderRadius: '12px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: 'var(--gold, #ffd700)', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🕐 Laufzeit
              </h3>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, varianten_laufzeit: [...verfuegbareLaufzeiten] }));
                }}
                style={{
                  padding: '0.4rem 0.75rem',
                  background: 'transparent',
                  border: '1px solid var(--gold, #ffd700)',
                  borderRadius: '6px',
                  color: 'var(--gold, #ffd700)',
                  cursor: 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                Alle auswählen
              </button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
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
                  style={{
                    padding: '0.75rem 1.25rem',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    border: '2px solid',
                    borderColor: formData.varianten_laufzeit.some(l => l.name === laufzeit.name) ? 'var(--gold, #ffd700)' : 'var(--border-secondary, rgba(255, 255, 255, 0.1))',
                    boxShadow: formData.varianten_laufzeit.some(l => l.name === laufzeit.name) ? '0 4px 12px rgba(107, 68, 35, 0.15)' : 'none',
                    background: formData.varianten_laufzeit.some(l => l.name === laufzeit.name) ? 'var(--gold, #ffd700)' : 'rgba(255, 255, 255, 0.05)',
                    color: formData.varianten_laufzeit.some(l => l.name === laufzeit.name) ? '#000' : 'var(--text-primary, #ffffff)',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <span>{laufzeit.name}</span>
                  {laufzeit.rabatt > 0 && (
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      color: formData.varianten_laufzeit.some(l => l.name === laufzeit.name) ? '#16A34A' : '#10B981',
                      background: formData.varianten_laufzeit.some(l => l.name === laufzeit.name) ? 'rgba(0,0,0,0.1)' : 'rgba(16, 185, 129, 0.15)',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '4px'
                    }}>
                      -{laufzeit.rabatt}% Rabatt
                    </span>
                  )}
                </button>
              ))}
            </div>

            {formData.varianten_laufzeit.length > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-hover, rgba(255, 255, 255, 0.12))', borderRadius: '8px' }}>
                <p style={{ color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Ausgewählt ({formData.varianten_laufzeit.length}):</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {formData.varianten_laufzeit.map(l => (
                    <span key={l.name} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.25rem 0.75rem',
                      background: 'var(--gold, #ffd700)',
                      color: 'var(--dark-bg, #0f0f23)',
                      borderRadius: '20px',
                      fontSize: '0.85rem',
                      fontWeight: 500
                    }}>
                      {l.name} {l.rabatt > 0 && `(-${l.rabatt}%)`}
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, varianten_laufzeit: prev.varianten_laufzeit.filter(lz => lz.name !== l.name) }))}
                        style={{
                          background: 'rgba(255,255,255,0.3)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '18px',
                          height: '18px',
                          cursor: 'pointer',
                          color: '#ffffff',
                          fontSize: '0.7rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
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
            <div style={{ background: 'rgba(107, 68, 35, 0.05)', border: '2px solid rgba(107, 68, 35, 0.2)', borderRadius: '12px', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--gold, #ffd700)', fontSize: '1.2rem' }}>
                📊 Varianten-Zusammenfassung
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', padding: '1rem', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Größen</p>
                  <p style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--gold, #ffd700)' }}>{formData.varianten_groessen.length}</p>
                </div>
                <div style={{ background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', padding: '1rem', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Farben</p>
                  <p style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--gold, #ffd700)' }}>{formData.varianten_farben.length}</p>
                </div>
                <div style={{ background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', padding: '1rem', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Materialien</p>
                  <p style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--gold, #ffd700)' }}>{formData.varianten_material.length}</p>
                </div>
                <div style={{ background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', padding: '1rem', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Laufzeiten</p>
                  <p style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--gold, #ffd700)' }}>{formData.varianten_laufzeit.length}</p>
                </div>
                <div style={{ background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))', padding: '1rem', borderRadius: '8px' }}>
                  <p style={{ color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Mögliche Kombinationen</p>
                  <p style={{ fontWeight: 700, fontSize: '1.5rem', color: 'var(--gold, #ffd700)' }}>
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
    <div className="artikel-formular-page" style={{
      padding: '2rem',
      maxWidth: '1600px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid var(--border-primary, rgba(255, 215, 0, 0.2))'
      }}>
        <div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--gold, #ffd700)',
            marginBottom: '0.5rem'
          }}>
            {mode === 'create' ? '🆕 Neuen Artikel erstellen' : '✏️ Artikel bearbeiten'}
          </h1>
          {mode === 'edit' && formData.name && (
            <p style={{fontSize: '1.1rem', color: 'var(--text-secondary, rgba(255, 255, 255, 0.7))'}}>
              {formData.name}
            </p>
          )}
        </div>

        <div style={{display: 'flex', gap: '1rem'}}>
          <button
            onClick={() => navigate('/dashboard/artikel')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
              color: 'var(--text-primary, #ffffff)',
              border: '1px solid var(--border-primary, rgba(255, 215, 0, 0.2))',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600
            }}
          >
            ← Zurück zur Liste
          </button>

          <button
            onClick={handleSave}
            disabled={loading || !formData.name || !formData.verkaufspreis_euro}
            style={{
              padding: '0.75rem 2rem',
              background: 'var(--gold, #ffd700)',
              color: 'var(--dark-bg, #0f0f23)',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              opacity: (loading || !formData.name || !formData.verkaufspreis_euro) ? 0.5 : 1
            }}
          >
            {loading ? 'Speichert...' : '💾 Speichern'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '1rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          color: '#ef4444',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="sub-tabs" style={{
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        padding: '0.25rem',
        background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
        borderRadius: '12px',
        border: '1px solid var(--border-primary, rgba(255, 215, 0, 0.2))',
        flexWrap: 'wrap'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`sub-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            style={{
              flex: 1,
              padding: '0.75rem 1.5rem',
              background: activeTab === tab.id ? 'var(--gold, #ffd700)' : 'transparent',
              color: activeTab === tab.id ? 'var(--dark-bg, #0f0f23)' : 'var(--text-secondary, rgba(255, 255, 255, 0.7))',
              border: activeTab === tab.id ? '1px solid var(--gold, #ffd700)' : '1px solid var(--border-secondary, rgba(255, 255, 255, 0.1))',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 600,
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{
        background: 'var(--bg-glass, rgba(255, 255, 255, 0.08))',
        border: '2px solid var(--border-primary, rgba(255, 215, 0, 0.2))',
        borderRadius: '12px',
        padding: '2rem',
        minHeight: '600px'
      }}>
        {renderTabContent()}
      </div>

      {/* Modal: Neue Artikelgruppe/Unterkategorie erstellen */}
      {showGruppeModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
          onClick={() => setShowGruppeModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-secondary, #1a1a2e)',
              border: '2px solid var(--gold, #ffd700)',
              borderRadius: '16px',
              padding: '2rem',
              minWidth: '400px',
              maxWidth: '500px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{
              color: 'var(--gold, #ffd700)',
              marginBottom: '1.5rem',
              fontSize: '1.25rem'
            }}>
              {neueGruppeTyp === 'hauptkategorie' ? 'Neue Artikelgruppe' : 'Neue Unterkategorie'}
            </h3>

            {neueGruppeTyp === 'unterkategorie' && (
              <div style={{ marginBottom: '1rem', color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                Wird erstellt unter: <strong style={{ color: '#fff' }}>
                  {artikelgruppen.find(g => g.id == selectedHauptkategorieId)?.name || ''}
                </strong>
              </div>
            )}

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{
                display: 'block',
                marginBottom: '0.5rem',
                color: 'var(--gold, #ffd700)',
                fontWeight: 600
              }}>
                Name *
              </label>
              <input
                type="text"
                value={neueGruppeName}
                onChange={(e) => setNeueGruppeName(e.target.value)}
                placeholder={neueGruppeTyp === 'hauptkategorie' ? 'z.B. Trainingsgeräte' : 'z.B. Pratzen'}
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleCreateGruppe();
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowGruppeModal(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.95rem'
                }}
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleCreateGruppe}
                disabled={neueGruppeLoading || !neueGruppeName.trim()}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--gold, #ffd700)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  cursor: neueGruppeLoading || !neueGruppeName.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  opacity: neueGruppeLoading || !neueGruppeName.trim() ? 0.5 : 1
                }}
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
