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

  // Form State
  const [formData, setFormData] = useState({
    kategorie_id: '',
    artikelgruppe_id: '',
    name: '',
    beschreibung: '',
    ean_code: '',
    artikel_nummer: '',
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
    sichtbar_kasse: true
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

  // Handle Input Change
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
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
    { id: 'preise', label: 'Preiskalkulation', icon: '💶' },
    { id: 'lager', label: 'Lager', icon: '📦' },
    { id: 'einstellungen', label: 'Einstellungen', icon: '⚙️' }
  ];

  // Render Tab Content
  const renderTabBasis = () => (
    <div className="tab-content-section">
      <div className="form-grid">
        <div className="form-group">
          <label>Artikelgruppe</label>
          <select
            name="artikelgruppe_id"
            value={formData.artikelgruppe_id}
            onChange={handleInputChange}
            required
            className="form-select"
          >
            <option value="">Wählen Sie eine Artikelgruppe...</option>
            {artikelgruppen.map(gruppe => (
              <option key={gruppe.id} value={gruppe.id}>
                {gruppe.vollstaendiger_name || gruppe.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Kategorie</label>
          <select
            name="kategorie_id"
            value={formData.kategorie_id}
            onChange={handleInputChange}
            className="form-select"
          >
            <option value="">Wählen Sie eine Kategorie...</option>
            {kategorien.map(kat => (
              <option key={kat.kategorie_id} value={kat.kategorie_id}>
                {kat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group full-width">
          <label>Artikelname *</label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className="form-input"
            placeholder="z.B. Proteinriegel Schokolade 50g"
          />
        </div>

        <div className="form-group full-width">
          <label>Beschreibung</label>
          <textarea
            name="beschreibung"
            value={formData.beschreibung}
            onChange={handleInputChange}
            rows="3"
            className="form-textarea"
            placeholder="Produktbeschreibung..."
          />
        </div>

        <div className="form-group">
          <label>EAN-Code</label>
          <input
            type="text"
            name="ean_code"
            value={formData.ean_code}
            onChange={handleInputChange}
            className="form-input"
            placeholder="z.B. 4250123456789"
          />
        </div>

        <div className="form-group">
          <label>Artikelnummer</label>
          <input
            type="text"
            name="artikel_nummer"
            value={formData.artikel_nummer}
            onChange={handleInputChange}
            className="form-input"
            placeholder="z.B. ART-001"
          />
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
          <div className="preis-eingabe-section" style={{overflowY: 'auto', maxHeight: '100%', padding: '0.85rem', background: 'rgba(0, 0, 0, 0.3)', border: '2px solid rgba(255, 215, 0, 0.2)', borderRadius: '8px'}}>
            <h3 style={{marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600}}>
              📝 Eingabe - Handelskalkulation
            </h3>

            {/* BEZUGSKALKULATION */}
            <div style={{marginBottom: '1.2rem'}}>
              <h4 style={{color: '#ffd700', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 600}}>
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
                  <small style={{color: '#888', fontSize: '0.75rem'}}>Versand, Zoll, Verpackung</small>
                </div>
              </div>
            </div>

            {/* SELBSTKOSTENKALKULATION */}
            <div style={{marginBottom: '1.2rem'}}>
              <h4 style={{color: '#ffd700', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 600}}>
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
                  <small style={{color: '#888', fontSize: '0.75rem'}}>Miete, Personal, etc.</small>
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
              <h4 style={{color: '#ffd700', fontSize: '0.95rem', marginBottom: '0.5rem', fontWeight: 600}}>
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
              <div style={{marginTop: '1rem', padding: '0.8rem', background: 'rgba(255, 215, 0, 0.1)', borderRadius: '8px', border: '1px solid rgba(255, 215, 0, 0.3)'}}>
                <div style={{marginBottom: '0.5rem', fontSize: '0.85rem', color: '#ffd700'}}>
                  Kalkulierter Nettoverkaufspreis: <strong>{nettoverkaufspreis.toFixed(2)} €</strong>
                </div>
                <button
                  type="button"
                  onClick={handlePreisUebernehmen}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'linear-gradient(135deg, #ffd700, #ff6b35)',
                    color: '#1a1a2e',
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
          <div className="preis-kalkulation-section" style={{overflowY: 'auto', maxHeight: '100%', padding: '0.85rem', background: 'rgba(255, 215, 0, 0.05)', border: '2px solid rgba(255, 215, 0, 0.3)', borderRadius: '8px'}}>
            <h3 style={{marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600}}>
              📊 Kalkulation
            </h3>

            <div className="kalkulation-table" style={{display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
              {/* BEZUGSKALKULATION */}
              <div style={{marginBottom: '0.5rem', padding: '0.3rem', background: 'rgba(255, 215, 0, 0.1)', borderRadius: '4px'}}>
                <strong style={{fontSize: '0.85rem', color: '#ffd700'}}>Bezugskalkulation</strong>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem'}}>
                <span>Listeneinkaufspreis</span>
                <span>{listeneinkaufspreis_wert.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#ef4444'}}>
                <span>− Lieferrabatt ({lieferrabatt_prozent}%)</span>
                <span>−{lieferrabatt_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(255, 215, 0, 0.05)'}}>
                <span><strong>= Zieleinkaufspreis</strong></span>
                <span><strong>{zieleinkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#ef4444'}}>
                <span>− Lieferskonto ({lieferskonto_prozent}%)</span>
                <span>−{lieferskonto_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(255, 215, 0, 0.05)'}}>
                <span><strong>= Bareinkaufspreis</strong></span>
                <span><strong>{bareinkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#10b981'}}>
                <span>+ Bezugskosten</span>
                <span>+{bezugskosten_wert.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.4rem 0.6rem', fontSize: '0.85rem', background: 'rgba(255, 215, 0, 0.1)', fontWeight: 600}}>
                <span><strong>= Bezugspreis</strong></span>
                <span><strong>{bezugspreis.toFixed(2)} €</strong></span>
              </div>

              <div style={{height: '8px'}}></div>

              {/* SELBSTKOSTENKALKULATION */}
              <div style={{marginBottom: '0.5rem', padding: '0.3rem', background: 'rgba(255, 215, 0, 0.1)', borderRadius: '4px'}}>
                <strong style={{fontSize: '0.85rem', color: '#ffd700'}}>Selbstkostenkalkulation</strong>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#10b981'}}>
                <span>+ Gemeinkosten ({gemeinkosten_prozent}%)</span>
                <span>+{gemeinkosten_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(255, 215, 0, 0.05)'}}>
                <span><strong>= Selbstkostenpreis</strong></span>
                <span><strong>{selbstkostenpreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#10b981'}}>
                <span>+ Gewinnzuschlag ({gewinnzuschlag_prozent}%)</span>
                <span>+{gewinnzuschlag_euro.toFixed(2)} €</span>
              </div>

              <div style={{height: '8px'}}></div>

              {/* VERKAUFSKALKULATION */}
              <div style={{marginBottom: '0.5rem', padding: '0.3rem', background: 'rgba(255, 215, 0, 0.1)', borderRadius: '4px'}}>
                <strong style={{fontSize: '0.85rem', color: '#ffd700'}}>Verkaufskalkulation</strong>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(255, 215, 0, 0.05)'}}>
                <span><strong>= Barverkaufspreis</strong></span>
                <span><strong>{barverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#10b981'}}>
                <span>+ Kundenskonto ({kundenskonto_prozent}%)</span>
                <span>+{kundenskonto_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.35rem 0.6rem', fontSize: '0.8rem', background: 'rgba(255, 215, 0, 0.05)'}}>
                <span><strong>= Zielverkaufspreis</strong></span>
                <span><strong>{zielverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#10b981'}}>
                <span>+ Kundenrabatt ({kundenrabatt_prozent}%)</span>
                <span>+{kundenrabatt_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.4rem 0.6rem', fontSize: '0.85rem', background: 'rgba(255, 215, 0, 0.1)', fontWeight: 600}}>
                <span><strong>= Nettoverkaufspreis</strong></span>
                <span><strong>{nettoverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.3rem 0.6rem', fontSize: '0.8rem', color: '#10b981'}}>
                <span>+ Umsatzsteuer ({mwst_prozent}%)</span>
                <span>+{umsatzsteuer_euro.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row final" style={{padding: '0.5rem 0.6rem', fontSize: '0.9rem', background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(255, 107, 53, 0.2))', borderRadius: '6px', marginTop: '0.5rem'}}>
                <span><strong>= BRUTTOVERKAUFSPREIS</strong></span>
                <span style={{color: '#ffd700'}}><strong>{bruttoverkaufspreis.toFixed(2)} €</strong></span>
              </div>

              <div style={{height: '8px', borderTop: '1px solid rgba(255, 215, 0, 0.3)', margin: '0.5rem 0'}}></div>

              {/* GEWINN */}
              <div className="kalkulation-row profit" style={{padding: '0.4rem 0.6rem', fontSize: '0.85rem'}}>
                <span>💰 Gewinn gesamt</span>
                <span style={{color: gewinn_gesamt >= 0 ? '#10b981' : '#ef4444', fontWeight: 600}}>
                  {gewinn_gesamt.toFixed(2)} €
                </span>
              </div>

              <div className="kalkulation-row profit" style={{padding: '0.4rem 0.6rem', fontSize: '0.85rem'}}>
                <span>📈 Gewinnspanne</span>
                <span style={{color: gewinnspanne_prozent >= 0 ? '#10b981' : '#ef4444', fontWeight: 600}}>
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basis': return renderTabBasis();
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
        borderBottom: '2px solid rgba(255, 215, 0, 0.2)'
      }}>
        <div>
          <h1 style={{
            fontSize: '2rem',
            fontWeight: 700,
            color: '#ffd700',
            marginBottom: '0.5rem'
          }}>
            {mode === 'create' ? '🆕 Neuen Artikel erstellen' : '✏️ Artikel bearbeiten'}
          </h1>
          {mode === 'edit' && formData.name && (
            <p style={{fontSize: '1.1rem', color: 'rgba(255, 255, 255, 0.7)'}}>
              {formData.name}
            </p>
          )}
        </div>

        <div style={{display: 'flex', gap: '1rem'}}>
          <button
            onClick={() => navigate('/dashboard/artikel')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
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
              background: 'linear-gradient(135deg, #ffd700, #ff6b35)',
              color: '#1a1a2e',
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
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
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
              background: activeTab === tab.id ? 'linear-gradient(135deg, #ffd700, #ff6b35)' : 'transparent',
              color: activeTab === tab.id ? '#1a1a2e' : 'rgba(255, 255, 255, 0.7)',
              border: activeTab === tab.id ? '1px solid #ffd700' : '1px solid rgba(255, 255, 255, 0.1)',
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
        background: 'rgba(0, 0, 0, 0.3)',
        border: '2px solid rgba(255, 215, 0, 0.2)',
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
