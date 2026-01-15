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
  const [artikelgruppen, setArtikelgruppen] = useState([]);
  const [activeTab, setActiveTab] = useState('basis');

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

  // Form State
  const [formData, setFormData] = useState({
    kategorie_id: '',
    artikelgruppe_id: '',
    name: '',
    beschreibung: '',
    ean_code: '',
    artikel_nummer: '',
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
    varianten_custom: [],
    custom_groesse: '',
    custom_farbe_name: '',
    custom_farbe_hex: '#000000',
    custom_material: ''
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

  // Load Artikelgruppen
  const loadArtikelgruppen = async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/artikelgruppen`);
      const data = await response.json();
      if (data.success) {
        setArtikelgruppen(data.data || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Artikelgruppen:', error);
    }
  };

  // Load Artikel for Edit Mode
  const loadArtikel = async () => {
    if (mode !== 'edit' || !id) return;

    try {
      setLoading(true);
      const response = await apiCall(`/${id}`);
      if (response.success && response.data) {
        setFormData({
          ...formData,
          ...response.data
        });
      }
    } catch (error) {
      setError('Fehler beim Laden des Artikels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKategorien();
    loadArtikelgruppen();
    if (mode === 'edit') {
      loadArtikel();
    }
  }, [mode, id]);

  // Generate next Artikelnummer based on Artikelgruppe
  const generateArtikelNummer = async (gruppeId) => {
    if (!gruppeId) return '';

    try {
      // Find the selected group to get its prefix/code
      const gruppe = artikelgruppen.find(g => g.id == gruppeId);
      if (!gruppe) return '';

      // Create a 3-letter prefix from gruppe name
      const prefix = (gruppe.code || gruppe.name.substring(0, 3)).toUpperCase().replace(/[^A-Z]/g, '').substring(0, 3).padEnd(3, 'X');

      // Get all existing artikel to find the next number
      const response = await apiCall('');
      const existingArtikel = response.data || [];

      // Find all artikel numbers with this prefix
      const prefixPattern = new RegExp(`^${prefix}(\\d+)$`);
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
          artikel_nummer: autoNummer
        }));
      }
    }
  };

  // Save Artikel
  const handleSave = async () => {
    try {
      setLoading(true);
      const url = mode === 'create' ? '' : `/${id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';

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
  const tabs = [
    { id: 'basis', label: 'Basis', icon: '📋' },
    { id: 'varianten', label: 'Varianten', icon: '🎨' },
    { id: 'preise', label: 'Preiskalkulation', icon: '💶' },
    { id: 'lager', label: 'Lager', icon: '📦' },
    { id: 'einstellungen', label: 'Einstellungen', icon: '⚙️' }
  ];

  // Basis Input Style für gute Sichtbarkeit
  const basisInputStyle = {
    padding: '0.75rem 1rem',
    background: '#ffffff',
    border: '2px solid #dee2e6',
    borderRadius: '8px',
    color: '#2c3e50',
    fontSize: '1rem',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
  };

  const basisLabelStyle = {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: 600,
    color: '#6B4423',
    fontSize: '0.95rem'
  };

  // Render Tab Content
  const renderTabBasis = () => (
    <div className="tab-content-section">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={basisLabelStyle}>Artikelgruppe *</label>
          <select
            name="artikelgruppe_id"
            value={formData.artikelgruppe_id}
            onChange={handleInputChange}
            required
            style={{ ...basisInputStyle, cursor: 'pointer' }}
          >
            <option value="">Wählen Sie eine Artikelgruppe...</option>
            {artikelgruppen.map(gruppe => (
              <option key={gruppe.id} value={gruppe.id}>
                {gruppe.vollstaendiger_name || gruppe.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <label style={basisLabelStyle}>Kategorie</label>
          <select
            name="kategorie_id"
            value={formData.kategorie_id}
            onChange={handleInputChange}
            style={{ ...basisInputStyle, cursor: 'pointer' }}
          >
            <option value="">Wählen Sie eine Kategorie...</option>
            {kategorien.map(kat => (
              <option key={kat.kategorie_id} value={kat.kategorie_id}>
                {kat.name}
              </option>
            ))}
          </select>
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

    return (
      <div className="tab-content-section" style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
        <div className="preiskalkulation-container" style={{height: '100%', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>

          {/* Eingabebereich */}
          <div className="preis-eingabe-section" style={{overflowY: 'auto', maxHeight: '100%', padding: '0.85rem', background: 'var(--glass-bg, #f8f9fa)', border: '2px solid var(--border-accent, #dee2e6)', borderRadius: '8px'}}>
            <h3 style={{marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary, #2c3e50)'}}>
              📝 Eingabe - Handelskalkulation
            </h3>

            {/* BEZUGSKALKULATION */}
            <div style={{marginBottom: '1.2rem'}}>
              <h4 style={{color: 'var(--primary, #6B4423)', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 600}}>
                📦 Bezugskalkulation (Einkauf)
              </h4>
              <div className="form-grid" style={{gap: '0.8rem'}}>
                <div className="form-group">
                  <label style={{fontSize: '0.8rem'}}>Listeneinkaufspreis (€)</label>
                  <input
                    type="number"
                    name="listeneinkaufspreis_euro"
                    value={formData.listeneinkaufspreis_euro}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    style={{height: '36px'}}
                  />
                </div>

                <div className="form-group">
                  <label style={{fontSize: '0.8rem'}}>Lieferrabatt (%)</label>
                  <input
                    type="number"
                    name="lieferrabatt_prozent"
                    value={formData.lieferrabatt_prozent}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    max="100"
                    className="form-input"
                    placeholder="0.00"
                    style={{height: '36px'}}
                  />
                </div>

                <div className="form-group">
                  <label style={{fontSize: '0.8rem'}}>Lieferskonto (%)</label>
                  <input
                    type="number"
                    name="lieferskonto_prozent"
                    value={formData.lieferskonto_prozent}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    max="100"
                    className="form-input"
                    placeholder="0.00"
                    style={{height: '36px'}}
                  />
                </div>

                <div className="form-group">
                  <label style={{fontSize: '0.8rem'}}>Bezugskosten (€)</label>
                  <input
                    type="number"
                    name="bezugskosten_euro"
                    value={formData.bezugskosten_euro}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    style={{height: '36px'}}
                  />
                  <small style={{color: 'var(--text-secondary, #6c757d)', fontSize: '0.75rem'}}>Versand, Zoll, Verpackung</small>
                </div>
              </div>
            </div>

            {/* SELBSTKOSTENKALKULATION */}
            <div style={{marginBottom: '1.2rem'}}>
              <h4 style={{color: 'var(--primary, #6B4423)', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 600}}>
                🏭 Selbstkostenkalkulation
              </h4>
              <div className="form-grid" style={{gap: '0.8rem'}}>
                <div className="form-group">
                  <label style={{fontSize: '0.8rem'}}>Gemeinkosten (%)</label>
                  <input
                    type="number"
                    name="gemeinkosten_prozent"
                    value={formData.gemeinkosten_prozent}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    style={{height: '36px'}}
                  />
                  <small style={{color: 'var(--text-secondary, #6c757d)', fontSize: '0.75rem'}}>Miete, Personal, etc.</small>
                </div>

                <div className="form-group">
                  <label style={{fontSize: '0.8rem'}}>Gewinnzuschlag (%)</label>
                  <input
                    type="number"
                    name="gewinnzuschlag_prozent"
                    value={formData.gewinnzuschlag_prozent}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="0.00"
                    style={{height: '36px'}}
                  />
                </div>
              </div>
            </div>

            {/* VERKAUFSKALKULATION */}
            <div style={{marginBottom: '1.2rem'}}>
              <h4 style={{color: 'var(--primary, #6B4423)', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 600}}>
                💰 Verkaufskalkulation
              </h4>
              <div className="form-grid" style={{gap: '0.8rem'}}>
                <div className="form-group">
                  <label style={{fontSize: '0.8rem'}}>Kundenskonto (%)</label>
                  <input
                    type="number"
                    name="kundenskonto_prozent"
                    value={formData.kundenskonto_prozent}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    max="100"
                    className="form-input"
                    placeholder="0.00"
                    style={{height: '36px'}}
                  />
                </div>

                <div className="form-group">
                  <label style={{fontSize: '0.8rem'}}>Kundenrabatt (%)</label>
                  <input
                    type="number"
                    name="kundenrabatt_prozent"
                    value={formData.kundenrabatt_prozent}
                    onChange={handleInputChange}
                    step="0.01"
                    min="0"
                    max="100"
                    className="form-input"
                    placeholder="0.00"
                    style={{height: '36px'}}
                  />
                </div>

                <div className="form-group">
                  <label style={{fontSize: '0.8rem'}}>MwSt. (%)</label>
                  <select
                    name="mwst_prozent"
                    value={formData.mwst_prozent}
                    onChange={handleInputChange}
                    className="form-select"
                    style={{height: '36px'}}
                  >
                    <option value="7.00">7% (ermäßigt)</option>
                    <option value="19.00">19% (normal)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Button: Neuen Preis übernehmen */}
            {listeneinkaufspreis > 0 && nettoverkaufspreis > 0 && (
              <div style={{marginTop: '1rem', padding: '0.8rem', background: 'rgba(107, 68, 35, 0.1)', borderRadius: '8px', border: '1px solid rgba(107, 68, 35, 0.3)'}}>
                <div style={{marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--primary, #6B4423)'}}>
                  Kalkulierter Nettoverkaufspreis: <strong>{nettoverkaufspreis.toFixed(2)} €</strong>
                </div>
                <button
                  type="button"
                  onClick={handlePreisUebernehmen}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'var(--primary, #6B4423)',
                    color: '#ffffff',
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
          </div>

          {/* Kalkulationsübersicht - Fortsetzung im nächsten Teil */}
          <div className="preis-kalkulation-section" style={{overflowY: 'auto', maxHeight: '100%', padding: '0.85rem', background: 'rgba(107, 68, 35, 0.05)', border: '2px solid rgba(107, 68, 35, 0.3)', borderRadius: '8px'}}>
            <h3 style={{marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary, #2c3e50)'}}>
              📊 Kalkulation
            </h3>

            <div className="kalkulation-table" style={{display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
              {/* BEZUGSKALKULATION */}
              <div style={{marginBottom: '0.5rem', padding: '0.3rem', background: 'rgba(107, 68, 35, 0.1)', borderRadius: '4px'}}>
                <strong style={{fontSize: '0.85rem', color: 'var(--primary, #6B4423)'}}>Bezugskalkulation</strong>
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

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#047857'}}>
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
                <strong style={{fontSize: '0.85rem', color: 'var(--primary, #6B4423)'}}>Selbstkostenkalkulation</strong>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#047857'}}>
                <span>+ Gemeinkosten ({gemeinkosten_prozent}%)</span>
                <span>+{gemeinkosten_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(107, 68, 35, 0.05)'}}>
                <span><strong>= Selbstkostenpreis</strong></span>
                <span><strong>{selbstkostenpreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#047857'}}>
                <span>+ Gewinnzuschlag ({gewinnzuschlag_prozent}%)</span>
                <span>+{gewinnzuschlag_euro.toFixed(2)} €</span>
              </div>

              <div style={{height: '8px'}}></div>

              {/* VERKAUFSKALKULATION */}
              <div style={{marginBottom: '0.5rem', padding: '0.3rem', background: 'rgba(107, 68, 35, 0.1)', borderRadius: '4px'}}>
                <strong style={{fontSize: '0.85rem', color: 'var(--primary, #6B4423)'}}>Verkaufskalkulation</strong>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(107, 68, 35, 0.05)'}}>
                <span><strong>= Barverkaufspreis</strong></span>
                <span><strong>{barverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#047857'}}>
                <span>+ Kundenskonto ({kundenskonto_prozent}%)</span>
                <span>+{kundenskonto_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(107, 68, 35, 0.05)'}}>
                <span><strong>= Zielverkaufspreis</strong></span>
                <span><strong>{zielverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#047857'}}>
                <span>+ Kundenrabatt ({kundenrabatt_prozent}%)</span>
                <span>+{kundenrabatt_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.4rem 0.6rem', fontSize: '0.85rem', background: 'rgba(107, 68, 35, 0.1)', fontWeight: 600}}>
                <span><strong>= Nettoverkaufspreis</strong></span>
                <span><strong>{nettoverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#047857'}}>
                <span>+ Umsatzsteuer ({mwst_prozent}%)</span>
                <span>+{umsatzsteuer_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row final" style={{padding: '0.5rem 0.6rem', fontSize: '0.9rem', background: 'rgba(107, 68, 35, 0.15)', borderRadius: '6px', marginTop: '0.5rem'}}>
                <span><strong>= BRUTTOVERKAUFSPREIS</strong></span>
                <span style={{color: 'var(--primary, #6B4423)'}}><strong>{bruttoverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div style={{height: '8px', borderTop: '1px solid rgba(107, 68, 35, 0.3)', margin: '0.5rem 0'}}></div>

              {/* GEWINN */}
              <div className="kalkulation-row profit" style={{padding: '0.4rem 0.6rem', fontSize: '0.85rem'}}>
                <span>💰 Gewinn gesamt</span>
                <span style={{color: gewinn_gesamt >= 0 ? '#047857' : '#ef4444', fontWeight: 600}}>
                  {gewinn_gesamt.toFixed(2)} €
                </span>
              </div>

              <div className="kalkulation-row profit" style={{padding: '0.4rem 0.6rem', fontSize: '0.85rem'}}>
                <span>📈 Gewinnspanne</span>
                <span style={{color: gewinnspanne_prozent >= 0 ? '#047857' : '#ef4444', fontWeight: 600}}>
                  {gewinnspanne_prozent.toFixed(1)} %
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTabLager = () => (
    <div className="tab-content-section">
      <div className="form-grid">
        <div className="form-group">
          <label>Aktueller Bestand</label>
          <input
            type="number"
            name="lagerbestand"
            value={formData.lagerbestand}
            onChange={handleInputChange}
            min="0"
            className="form-input"
            placeholder="0"
            disabled={!formData.lager_tracking}
          />
        </div>

        <div className="form-group">
          <label>Mindestbestand</label>
          <input
            type="number"
            name="mindestbestand"
            value={formData.mindestbestand}
            onChange={handleInputChange}
            min="0"
            className="form-input"
            placeholder="0"
            disabled={!formData.lager_tracking}
          />
        </div>

        <div className="form-group">
          <label>Farbe</label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="color"
              name="farbe_hex"
              value={formData.farbe_hex}
              onChange={handleInputChange}
              style={{ width: '60px', height: '42px', cursor: 'pointer' }}
            />
            <input
              type="text"
              value={formData.farbe_hex}
              onChange={(e) => setFormData(prev => ({...prev, farbe_hex: e.target.value}))}
              className="form-input"
              placeholder="#FFFFFF"
            />
          </div>
        </div>

        <div className="form-group full-width">
          <div className="checkbox-label">
            <input
              type="checkbox"
              name="lager_tracking"
              checked={formData.lager_tracking}
              onChange={handleInputChange}
            />
            <span>Lagerbestand aktiv verfolgen</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTabEinstellungen = () => (
    <div className="tab-content-section">
      <div className="form-grid">
        <div className="form-group full-width">
          <div className="checkbox-label">
            <input
              type="checkbox"
              name="aktiv"
              checked={formData.aktiv}
              onChange={handleInputChange}
            />
            <span>Artikel aktiv</span>
          </div>
        </div>

        <div className="form-group full-width">
          <div className="checkbox-label">
            <input
              type="checkbox"
              name="sichtbar_kasse"
              checked={formData.sichtbar_kasse}
              onChange={handleInputChange}
            />
            <span>An der Kasse sichtbar</span>
          </div>
        </div>
      </div>
    </div>
  );

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
    background: '#ffffff',
    border: '2px solid #dee2e6',
    borderRadius: '8px',
    color: '#2c3e50',
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
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary, #2c3e50)' }}>
          <input
            type="checkbox"
            checked={formData.hat_varianten}
            onChange={(e) => setFormData(prev => ({ ...prev, hat_varianten: e.target.checked }))}
            style={{ width: '20px', height: '20px', accentColor: '#6B4423' }}
          />
          🎨 Artikel hat Varianten (Größen, Farben, Material)
        </label>
      </div>

      {formData.hat_varianten && (
        <div style={{ display: 'grid', gap: '2rem' }}>
          {/* GRÖSSEN */}
          <div style={{ background: '#ffffff', border: '2px solid #dee2e6', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--primary, #6B4423)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📏 Größen
            </h3>

            {/* Standard Größen */}
            <div style={{ marginBottom: '1rem' }}>
              <p style={{ color: '#6c757d', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Konfektionsgrößen:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].map(groesse => (
                  <button
                    key={groesse}
                    type="button"
                    onClick={() => toggleGroesse(groesse)}
                    style={{
                      padding: '0.5rem 1rem',
                      border: '2px solid',
                      borderColor: formData.varianten_groessen.includes(groesse) ? '#6B4423' : '#dee2e6',
                      borderRadius: '8px',
                      background: formData.varianten_groessen.includes(groesse) ? '#6B4423' : '#ffffff',
                      color: formData.varianten_groessen.includes(groesse) ? '#ffffff' : '#2c3e50',
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
              <p style={{ color: '#6c757d', fontSize: '0.9rem', marginBottom: '0.75rem' }}>Körpergrößen (cm):</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {['100', '110', '120', '130', '140', '150', '160', '170', '180', '190', '200'].map(groesse => (
                  <button
                    key={groesse}
                    type="button"
                    onClick={() => toggleGroesse(groesse)}
                    style={{
                      padding: '0.5rem 0.75rem',
                      border: '2px solid',
                      borderColor: formData.varianten_groessen.includes(groesse) ? '#6B4423' : '#dee2e6',
                      borderRadius: '8px',
                      background: formData.varianten_groessen.includes(groesse) ? '#6B4423' : '#ffffff',
                      color: formData.varianten_groessen.includes(groesse) ? '#ffffff' : '#2c3e50',
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
                  background: '#6B4423',
                  color: '#ffffff',
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
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '8px' }}>
                <p style={{ color: '#6c757d', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Ausgewählt ({formData.varianten_groessen.length}):</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {formData.varianten_groessen.map(g => (
                    <span key={g} style={{ padding: '0.25rem 0.75rem', background: '#6B4423', color: '#ffffff', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 500 }}>
                      {g}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* FARBEN */}
          <div style={{ background: '#ffffff', border: '2px solid #dee2e6', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--primary, #6B4423)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🎨 Farben
            </h3>

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
                    borderColor: formData.varianten_farben.some(f => f.name === farbe.name) ? '#6B4423' : '#dee2e6',
                    borderRadius: '8px',
                    background: formData.varianten_farben.some(f => f.name === farbe.name) ? 'rgba(107, 68, 35, 0.1)' : '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: farbe.hex,
                    border: farbe.hex === '#FFFFFF' ? '1px solid #dee2e6' : 'none',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                  }} />
                  <span style={{ color: '#2c3e50', fontWeight: 500 }}>{farbe.name}</span>
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
                style={{ width: '50px', height: '42px', cursor: 'pointer', borderRadius: '8px', border: '2px solid #dee2e6' }}
              />
              <button
                type="button"
                onClick={addCustomFarbe}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#6B4423',
                  color: '#ffffff',
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
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '8px' }}>
                <p style={{ color: '#6c757d', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Ausgewählt ({formData.varianten_farben.length}):</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {formData.varianten_farben.map(f => (
                    <span key={f.name} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.25rem 0.75rem',
                      background: '#ffffff',
                      border: '1px solid #dee2e6',
                      borderRadius: '20px',
                      fontSize: '0.85rem'
                    }}>
                      <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: f.hex, border: f.hex === '#FFFFFF' ? '1px solid #dee2e6' : 'none' }} />
                      {f.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* MATERIAL */}
          <div style={{ background: '#ffffff', border: '2px solid #dee2e6', borderRadius: '12px', padding: '1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: 'var(--primary, #6B4423)', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🧵 Material / Stoff
            </h3>

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
                    borderColor: formData.varianten_material.includes(mat) ? '#6B4423' : '#dee2e6',
                    borderRadius: '8px',
                    background: formData.varianten_material.includes(mat) ? '#6B4423' : '#ffffff',
                    color: formData.varianten_material.includes(mat) ? '#ffffff' : '#2c3e50',
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
                  background: '#6B4423',
                  color: '#ffffff',
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
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#f8f9fa', borderRadius: '8px' }}>
                <p style={{ color: '#6c757d', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Ausgewählt ({formData.varianten_material.length}):</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {formData.varianten_material.map(m => (
                    <span key={m} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.25rem 0.75rem',
                      background: '#6B4423',
                      color: '#ffffff',
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

          {/* ZUSAMMENFASSUNG */}
          {(formData.varianten_groessen.length > 0 || formData.varianten_farben.length > 0 || formData.varianten_material.length > 0) && (
            <div style={{ background: 'rgba(107, 68, 35, 0.05)', border: '2px solid rgba(107, 68, 35, 0.2)', borderRadius: '12px', padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--primary, #6B4423)', fontSize: '1.2rem' }}>
                📊 Varianten-Zusammenfassung
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px' }}>
                  <p style={{ color: '#6c757d', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Größen</p>
                  <p style={{ fontWeight: 700, fontSize: '1.5rem', color: '#6B4423' }}>{formData.varianten_groessen.length}</p>
                </div>
                <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px' }}>
                  <p style={{ color: '#6c757d', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Farben</p>
                  <p style={{ fontWeight: 700, fontSize: '1.5rem', color: '#6B4423' }}>{formData.varianten_farben.length}</p>
                </div>
                <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px' }}>
                  <p style={{ color: '#6c757d', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Materialien</p>
                  <p style={{ fontWeight: 700, fontSize: '1.5rem', color: '#6B4423' }}>{formData.varianten_material.length}</p>
                </div>
                <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px' }}>
                  <p style={{ color: '#6c757d', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Mögliche Kombinationen</p>
                  <p style={{ fontWeight: 700, fontSize: '1.5rem', color: '#6B4423' }}>
                    {Math.max(1, formData.varianten_groessen.length) * Math.max(1, formData.varianten_farben.length) * Math.max(1, formData.varianten_material.length)}
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
        borderBottom: '2px solid var(--border-accent, #e9ecef)'
      }}>
        <div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: 'var(--primary, #6B4423)',
            marginBottom: '0.5rem'
          }}>
            {mode === 'create' ? '🆕 Neuen Artikel erstellen' : '✏️ Artikel bearbeiten'}
          </h1>
          {mode === 'edit' && formData.name && (
            <p style={{fontSize: '1.1rem', color: 'var(--text-secondary, #6c757d)'}}>
              {formData.name}
            </p>
          )}
        </div>

        <div style={{display: 'flex', gap: '1rem'}}>
          <button
            onClick={() => navigate('/dashboard/artikel')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--glass-bg, #f8f9fa)',
              color: 'var(--text-primary, #2c3e50)',
              border: '1px solid var(--border-color, #dee2e6)',
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
              background: 'var(--primary, #6B4423)',
              color: '#ffffff',
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
          background: '#fef2f2',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          color: '#dc2626',
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
        background: 'var(--glass-bg, #f8f9fa)',
        borderRadius: '12px',
        border: '1px solid var(--border-color, #dee2e6)',
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
              background: activeTab === tab.id ? 'var(--primary, #6B4423)' : 'transparent',
              color: activeTab === tab.id ? '#ffffff' : 'var(--text-secondary, #6c757d)',
              border: activeTab === tab.id ? '1px solid var(--primary, #6B4423)' : '1px solid var(--border-color, #dee2e6)',
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
        background: 'var(--glass-bg, #ffffff)',
        border: '2px solid var(--border-accent, #dee2e6)',
        borderRadius: '12px',
        padding: '2rem',
        minHeight: '600px'
      }}>
        {renderTabContent()}
      </div>
    </div>
  );
};

export default ArtikelFormular;
