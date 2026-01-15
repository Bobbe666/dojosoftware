// =====================================================================================
// ARTIKEL-VERWALTUNG KOMPONENTE - DOJOSOFTWARE VERKAUFSSYSTEM
// =====================================================================================
// Vollständige CRUD-Operationen für Artikel mit Lagerbestand-Tracking
// Deutsche rechtliche Grundlagen beachtet (GoBD, KassenSichV)
// =====================================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/components.css';
import '../styles/ArtikelVerwaltung.css';
import '../styles/ArtikelVerwaltungOverrides.css';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';


const ArtikelVerwaltung = () => {
  const navigate = useNavigate();

  // =====================================================================================
  // STATE MANAGEMENT
  // =====================================================================================
  
  const [artikel, setArtikel] = useState([]);
  const [kategorien, setKategorien] = useState([]);
  const [artikelgruppen, setArtikelgruppen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // UI States
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create', 'edit', 'lager'
  const [selectedArtikel, setSelectedArtikel] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKategorie, setSelectedKategorie] = useState('');
  const [showOnlyActive, setShowOnlyActive] = useState(true);

  // Tab Navigation States (ersetzt Steps)
  const [activeTab, setActiveTab] = useState('basis'); // 'basis', 'preise', 'lager', 'einstellungen'
  
  // Form States
  const [formData, setFormData] = useState({
    kategorie_id: '',
    artikelgruppe_id: '',
    name: '',
    beschreibung: '',
    ean_code: '',
    artikel_nummer: '',
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
  
  // Lager States
  const [lagerBewegung, setLagerBewegung] = useState({
    bewegungsart: 'eingang',
    menge: '',
    grund: ''
  });
  
  // =====================================================================================
  // API FUNCTIONS
  // =====================================================================================
  
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
  
  // Artikel laden
  const loadArtikel = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedKategorie) params.append('kategorie_id', selectedKategorie);
      if (showOnlyActive) params.append('aktiv', 'true');
      
      const response = await apiCall(`?${params.toString()}`);
      setArtikel(response.data || []);
    } catch (error) {
      setError('Fehler beim Laden der Artikel: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Kategorien laden
  const loadKategorien = async () => {
    try {
      const response = await apiCall('/kategorien');
      setKategorien(response.data || []);
    } catch (error) {
      console.error('Fehler beim Laden der Kategorien:', error);
    }
  };

  // Artikelgruppen laden
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
  
  // Artikel erstellen/bearbeiten
  const saveArtikel = async () => {
    try {
      const url = modalMode === 'create' ? '' : `/${selectedArtikel.artikel_id}`;
      const method = modalMode === 'create' ? 'POST' : 'PUT';
      
      const response = await apiCall(url, {
        method,
        body: JSON.stringify(formData)
      });
      
      if (response.success) {
        setShowModal(false);
        resetForm();
        loadArtikel();
        setError(null);
      } else {
        setError(response.error || 'Fehler beim Speichern');
      }
    } catch (error) {
      setError('Fehler beim Speichern: ' + error.message);
    }
  };
  
  // Artikel löschen (deaktivieren)
  const deleteArtikel = async (artikelId) => {
    if (!window.confirm('Artikel wirklich deaktivieren?')) return;
    
    try {
      const response = await apiCall(`/${artikelId}`, { method: 'DELETE' });
      if (response.success) {
        loadArtikel();
        setError(null);
      } else {
        setError(response.error || 'Fehler beim Löschen');
      }
    } catch (error) {
      setError('Fehler beim Löschen: ' + error.message);
    }
  };
  
  // Lagerbestand ändern
  const updateLagerbestand = async () => {
    try {
      const response = await apiCall(`/${selectedArtikel.artikel_id}/lager`, {
        method: 'POST',
        body: JSON.stringify(lagerBewegung)
      });
      
      if (response.success) {
        setShowModal(false);
        setLagerBewegung({ bewegungsart: 'eingang', menge: '', grund: '' });
        loadArtikel();
        setError(null);
      } else {
        setError(response.error || 'Fehler beim Aktualisieren des Lagerbestands');
      }
    } catch (error) {
      setError('Fehler beim Aktualisieren: ' + error.message);
    }
  };
  
  // =====================================================================================
  // EVENT HANDLERS
  // =====================================================================================
  
  const handleCreate = () => {
    navigate('/dashboard/artikel/neu');
  };

  const handleEdit = (artikel) => {
    navigate(`/dashboard/artikel/bearbeiten/${artikel.artikel_id}`);
  };
  
  const handleLager = (artikel) => {
    setModalMode('lager');
    setSelectedArtikel(artikel);
    setLagerBewegung({ bewegungsart: 'eingang', menge: '', grund: '' });
    setShowModal(true);
  };
  
  const resetForm = () => {
    setFormData({
      kategorie_id: '',
      name: '',
      beschreibung: '',
      ean_code: '',
      artikel_nummer: '',
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
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  const handleLagerChange = (e) => {
    const { name, value } = e.target;
    setLagerBewegung(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // =====================================================================================
  // TAB NAVIGATION
  // =====================================================================================

  const tabs = [
    { id: 'basis', label: '📋 Basis', icon: '📋' },
    { id: 'preise', label: '💰 Preise', icon: '💰' },
    { id: 'lager', label: '📦 Lager', icon: '📦' },
    { id: 'einstellungen', label: '⚙️ Einstellungen', icon: '⚙️' }
  ];
  
  // =====================================================================================
  // FILTER & SEARCH
  // =====================================================================================
  
  const filteredArtikel = artikel.filter(artikel => {
    const matchesSearch = artikel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         artikel.artikel_nummer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         artikel.ean_code?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesKategorie = !selectedKategorie || artikel.kategorie_id == selectedKategorie;
    
    return matchesSearch && matchesKategorie;
  });
  
  // =====================================================================================
  // EFFECTS
  // =====================================================================================
  
  useEffect(() => {
    loadKategorien();
    loadArtikelgruppen();
    loadArtikel();
  }, [selectedKategorie, showOnlyActive]);
  
  // =====================================================================================
  // RENDER FUNCTIONS
  // =====================================================================================
  
  const renderLagerStatus = (artikel) => {
    if (!artikel.lager_tracking) {
      return <span className="lager-status unlimited">∞ Unbegrenzt</span>;
    }
    
    if (artikel.lagerbestand === 0) {
      return <span className="lager-status out-of-stock">Ausverkauft</span>;
    }
    
    if (artikel.lagerbestand <= artikel.mindestbestand) {
      return <span className="lager-status low-stock">Nachbestellen</span>;
    }
    
    return <span className="lager-status in-stock">Verfügbar</span>;
  };
  
  // =====================================================================================
  // TAB COMPONENTS
  // =====================================================================================

  const renderTabBasis = () => (
    <div className="tab-content-section">
      <div className="form-grid">
        <div className="form-group">
          <label>Artikelgruppe *</label>
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
            placeholder="Detaillierte Beschreibung..."
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
            placeholder="z.B. 1234567890123"
            maxLength="13"
          />
        </div>

        <div className="form-group">
          <label>Artikel-Nummer</label>
          <input
            type="text"
            name="artikel_nummer"
            value={formData.artikel_nummer}
            onChange={handleInputChange}
            className="form-input"
            placeholder="z.B. PRO-001"
          />
        </div>
      </div>
    </div>
  );

  const renderTabPreise = () => {
    // Berechnungen für Preiskalkulation
    const einkaufspreis = parseFloat(formData.einkaufspreis_euro) || 0;
    const zusatzkosten = parseFloat(formData.zusatzkosten_euro) || 0;
    const marge_prozent = parseFloat(formData.marge_prozent) || 0;
    const verkaufspreis_netto = parseFloat(formData.verkaufspreis_euro) || 0;
    const mwst_prozent = parseFloat(formData.mwst_prozent) || 19;

    // Zwischensumme (Einkaufspreis + Zusatzkosten)
    const zwischensumme = einkaufspreis + zusatzkosten;

    // MwSt. Betrag berechnen
    const mwst_betrag = (verkaufspreis_netto * mwst_prozent) / 100;

    // Brutto-Verkaufspreis
    const verkaufspreis_brutto = verkaufspreis_netto + mwst_betrag;

    // Marge in Euro (falls Marge% gesetzt ist)
    const marge_euro = zwischensumme > 0 && marge_prozent > 0
      ? (zwischensumme * marge_prozent) / 100
      : verkaufspreis_netto - zwischensumme;

    // Gewinnspanne berechnen
    const gewinn = verkaufspreis_netto - zwischensumme;
    const gewinnspanne_prozent = zwischensumme > 0 ? (gewinn / zwischensumme) * 100 : 0;

    // Kalkulierter VK bei Marge-Eingabe
    const kalkulierter_vk = zwischensumme + marge_euro;

    const handlePreisChange = (e) => {
      const { name, value } = e.target;
      handleInputChange(e);

      // Auto-Berechnung: Wenn Marge% gesetzt wird, VK berechnen
      if (name === 'marge_prozent') {
        const marge_p = parseFloat(value) || 0;
        const zwsum = einkaufspreis + zusatzkosten;
        if (zwsum > 0) {
          const neuer_vk = zwsum + (zwsum * marge_p / 100);
          setFormData(prev => ({
            ...prev,
            verkaufspreis_euro: neuer_vk.toFixed(2)
          }));
        }
      }
    };

    return (
      <div className="tab-content-section" style={{flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
        <div className="preiskalkulation-container" style={{height: '100%', overflow: 'hidden', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
          {/* Eingabebereich */}
          <div className="preis-eingabe-section" style={{overflowY: 'auto', maxHeight: '100%', padding: '0.85rem', background: 'rgba(0, 0, 0, 0.3)', border: '2px solid rgba(255, 215, 0, 0.2)', borderRadius: '8px'}}>
            <h3 style={{marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600}}>
              📝 Eingabe
            </h3>

            <div className="form-grid">
              <div className="form-group">
                <label>EINKAUFSPREIS (€)</label>
                <input
                  type="number"
                  name="einkaufspreis_euro"
                  value={formData.einkaufspreis_euro}
                  onChange={handlePreisChange}
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="0.00"
                />
                <small style={{color: '#888', fontSize: '0.85rem'}}>Herstellpreis/Einkaufspreis netto</small>
              </div>

              <div className="form-group">
                <label>ZUSATZKOSTEN (€)</label>
                <input
                  type="number"
                  name="zusatzkosten_euro"
                  value={formData.zusatzkosten_euro}
                  onChange={handlePreisChange}
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="0.00"
                />
                <small style={{color: '#888', fontSize: '0.85rem'}}>Versand, Verpackung, etc.</small>
              </div>

              <div className="form-group">
                <label>MARGE (%)</label>
                <input
                  type="number"
                  name="marge_prozent"
                  value={formData.marge_prozent}
                  onChange={handlePreisChange}
                  step="0.01"
                  min="0"
                  className="form-input"
                  placeholder="0.00"
                />
                <small style={{color: '#888', fontSize: '0.85rem'}}>Gewinnaufschlag in %</small>
              </div>

              <div className="form-group">
                <label>VERKAUFSPREIS (€) *</label>
                <input
                  type="number"
                  name="verkaufspreis_euro"
                  value={formData.verkaufspreis_euro}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  required
                  className="form-input"
                  placeholder="0.00"
                />
                <small style={{color: '#888', fontSize: '0.85rem'}}>Netto-Verkaufspreis</small>
              </div>

              <div className="form-group">
                <label>MWST. (%)</label>
                <select
                  name="mwst_prozent"
                  value={formData.mwst_prozent}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="7.00">7% (ermäßigt)</option>
                  <option value="19.00">19% (normal)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Kalkulationsübersicht */}
          <div className="preis-kalkulation-section" style={{overflowY: 'auto', maxHeight: '100%', padding: '0.85rem', background: 'rgba(255, 215, 0, 0.05)', border: '2px solid rgba(255, 215, 0, 0.3)', borderRadius: '8px'}}>
            <h3 style={{marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600}}>
              📊 Kalkulation
            </h3>

            <div className="kalkulation-table" style={{display: 'flex', flexDirection: 'column', gap: '0.35rem'}}>
              <div className="kalkulation-row" style={{padding: '0.4rem 0.7rem', fontSize: '0.85rem'}}>
                <span className="kalkulation-label">Einkaufspreis (Netto)</span>
                <span className="kalkulation-value">{einkaufspreis.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.4rem 0.7rem', fontSize: '0.85rem'}}>
                <span className="kalkulation-label">+ Zusatzkosten</span>
                <span className="kalkulation-value">{zusatzkosten.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row total" style={{padding: '0.5rem 0.7rem', fontSize: '0.85rem'}}>
                <span className="kalkulation-label"><strong>= Zwischensumme</strong></span>
                <span className="kalkulation-value"><strong>{zwischensumme.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row highlight" style={{padding: '0.4rem 0.7rem', fontSize: '0.85rem'}}>
                <span className="kalkulation-label">+ Marge ({marge_prozent.toFixed(1)}%)</span>
                <span className="kalkulation-value">{marge_euro.toFixed(2)} €</span>
              </div>

              {marge_prozent > 0 && (
                <div className="kalkulation-row info" style={{padding: '0.4rem 0.7rem', fontSize: '0.85rem'}}>
                  <span className="kalkulation-label">→ Kalkulierter VK (Netto)</span>
                  <span className="kalkulation-value">{kalkulierter_vk.toFixed(2)} €</span>
                </div>
              )}

              <div className="kalkulation-row total" style={{padding: '0.5rem 0.7rem', fontSize: '0.85rem'}}>
                <span className="kalkulation-label"><strong>= Verkaufspreis (Netto)</strong></span>
                <span className="kalkulation-value"><strong>{verkaufspreis_netto.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-row" style={{padding: '0.4rem 0.7rem', fontSize: '0.85rem'}}>
                <span className="kalkulation-label">+ MwSt. ({mwst_prozent}%)</span>
                <span className="kalkulation-value">{mwst_betrag.toFixed(2)} €</span>
              </div>

              <div className="kalkulation-row final" style={{padding: '0.6rem 0.7rem', fontSize: '0.9rem'}}>
                <span className="kalkulation-label"><strong>= VERKAUFSPREIS (BRUTTO)</strong></span>
                <span className="kalkulation-value final-price"><strong>{verkaufspreis_brutto.toFixed(2)} €</strong></span>
              </div>

              <div className="kalkulation-divider" style={{margin: '0.5rem 0', height: '1px'}}></div>

              <div className="kalkulation-row profit" style={{padding: '0.4rem 0.7rem', fontSize: '0.85rem'}}>
                <span className="kalkulation-label">💰 Gewinn pro Stück</span>
                <span className="kalkulation-value" style={{color: gewinn >= 0 ? '#10b981' : '#ef4444'}}>
                  {gewinn.toFixed(2)} €
                </span>
              </div>

              <div className="kalkulation-row profit" style={{padding: '0.4rem 0.7rem', fontSize: '0.85rem'}}>
                <span className="kalkulation-label">📈 Gewinnspanne</span>
                <span className="kalkulation-value" style={{color: gewinnspanne_prozent >= 0 ? '#10b981' : '#ef4444'}}>
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
          <label className="checkbox-label">
            <input
              type="checkbox"
              name="lager_tracking"
              checked={formData.lager_tracking}
              onChange={handleInputChange}
            />
            Lagerbestand verfolgen
          </label>
        </div>
      </div>
    </div>
  );

  const renderTabEinstellungen = () => (
    <div className="tab-content-section">
      <div className="settings-grid">
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="aktiv"
            checked={formData.aktiv}
            onChange={handleInputChange}
          />
          Artikel ist aktiv
        </label>

        <label className="checkbox-label">
          <input
            type="checkbox"
            name="sichtbar_kasse"
            checked={formData.sichtbar_kasse}
            onChange={handleInputChange}
          />
          In Kasse sichtbar
        </label>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basis': return renderTabBasis();
      case 'preise': return renderTabPreise();
      case 'lager': return renderTabLager();
      case 'einstellungen': return renderTabEinstellungen();
      default: return renderTabBasis();
    }
  };

  const renderModal = () => {
    if (!showModal) return null;

    // Lager modal - kompakt und hell
    if (modalMode === 'lager') {
      const modalStyle = {
        maxWidth: '320px',
        width: '320px',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
        padding: '0',
        background: '#ffffff',
        border: '1px solid #e9ecef',
        animation: 'none',
        backdropFilter: 'none'
      };
      const headerStyle = {
        padding: '12px 14px',
        background: 'linear-gradient(135deg, #f8f9fa, #ffffff)',
        borderBottom: '1px solid #e9ecef',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      };
      const headerTitleStyle = {
        fontSize: '15px',
        margin: '0',
        color: '#2c3e50',
        fontWeight: '600',
        background: 'none',
        WebkitTextFillColor: '#2c3e50'
      };
      const bodyStyle = {
        padding: '14px',
        background: '#ffffff'
      };
      const infoCardStyle = {
        background: 'linear-gradient(135deg, #f8f9fa, #ffffff)',
        border: '1px solid #e9ecef',
        borderRadius: '6px',
        padding: '10px 12px',
        marginBottom: '12px'
      };
      const infoTitleStyle = {
        margin: '0 0 8px 0',
        fontSize: '14px',
        fontWeight: '600',
        color: '#2c3e50'
      };
      const labelStyle = {
        fontSize: '11px',
        color: '#6c757d'
      };
      const valueStyle = {
        fontSize: '15px',
        fontWeight: '600',
        color: '#2c3e50'
      };
      return (
        <div className="modal-overlay lager-modal-overlay" onClick={() => setShowModal(false)} style={{background: 'rgba(0,0,0,0.3)'}}>
          <div className="modal-content lager-modal" onClick={e => e.stopPropagation()} style={modalStyle}>
            <div className="modal-header lager-modal-header" style={headerStyle}>
              <h2 style={headerTitleStyle}>Lagerbestand ändern</h2>
              <button className="close-btn" onClick={() => setShowModal(false)} style={{background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6c757d'}}>×</button>
            </div>

            <div className="modal-body lager-modal-body" style={bodyStyle}>
              <div className="artikel-info-card" style={infoCardStyle}>
                <h4 style={infoTitleStyle}>{selectedArtikel?.name}</h4>
                <div className="info-grid" style={{display: 'flex', gap: '20px'}}>
                  <div className="info-item" style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                    <span className="info-label" style={labelStyle}>Aktueller Bestand:</span>
                    <span className="info-value" style={valueStyle}>{selectedArtikel?.lagerbestand}</span>
                  </div>
                  <div className="info-item" style={{display: 'flex', flexDirection: 'column', gap: '2px'}}>
                    <span className="info-label" style={labelStyle}>Mindestbestand:</span>
                    <span className="info-value" style={valueStyle}>{selectedArtikel?.mindestbestand}</span>
                  </div>
                </div>
              </div>

              <div className="lager-form" style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                <div className="form-row" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px'}}>
                  <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                    <label style={{fontSize: '12px', fontWeight: '500', color: '#495057'}}>Bewegungsart</label>
                    <select
                      name="bewegungsart"
                      value={lagerBewegung.bewegungsart}
                      onChange={handleLagerChange}
                      className="form-select"
                      style={{padding: '8px 10px', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '13px', background: '#ffffff', color: '#2c3e50', height: '36px'}}
                    >
                      <option value="eingang">Eingang (+)</option>
                      <option value="ausgang">Ausgang (-)</option>
                    </select>
                  </div>

                  <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                    <label style={{fontSize: '12px', fontWeight: '500', color: '#495057'}}>Menge</label>
                    <input
                      type="number"
                      name="menge"
                      value={lagerBewegung.menge}
                      onChange={handleLagerChange}
                      min="1"
                      required
                      className="form-input"
                      placeholder="Anzahl"
                      style={{padding: '8px 10px', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '13px', background: '#ffffff', color: '#2c3e50', height: '36px'}}
                    />
                  </div>
                </div>

                <div className="form-group" style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                  <label style={{fontSize: '12px', fontWeight: '500', color: '#495057'}}>Grund</label>
                  <input
                    type="text"
                    name="grund"
                    value={lagerBewegung.grund}
                    onChange={handleLagerChange}
                    placeholder="z.B. Lieferung, Verkauf, Inventur"
                    className="form-input"
                    style={{padding: '8px 10px', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '13px', background: '#ffffff', color: '#2c3e50', height: '36px'}}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer lager-modal-footer" style={{padding: '12px 14px', background: 'linear-gradient(135deg, #f8f9fa, #ffffff)', borderTop: '1px solid #e9ecef', display: 'flex', justifyContent: 'flex-end', gap: '10px'}}>
              <button className="btn-secondary" onClick={() => setShowModal(false)} style={{padding: '8px 14px', borderRadius: '4px', fontSize: '13px', background: '#ffffff', border: '1px solid #dee2e6', color: '#495057', cursor: 'pointer'}}>
                Abbrechen
              </button>
              <button className="btn-primary" onClick={updateLagerbestand} style={{padding: '8px 14px', borderRadius: '4px', fontSize: '13px', background: '#007bff', border: 'none', color: '#ffffff', cursor: 'pointer', fontWeight: '500'}}>
                Aktualisieren
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Neues Tab-basiertes Modal für Create/Edit
    return (
      <div className="modal-overlay fullscreen-modal" onClick={() => setShowModal(false)} style={{position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div className="modal-content artikel-modal" onClick={e => e.stopPropagation()} style={{maxWidth: '100%', maxHeight: '100vh', height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1a1a2e'}}>
          <div className="modal-header artikel-modal-header">
            <div className="modal-header-content">
              <h2 className="modal-title">
                {modalMode === 'create' ? '🆕 ARTIKEL ERSTELLEN' : '✏️ ARTIKEL BEARBEITEN'}
              </h2>
              {modalMode === 'edit' && selectedArtikel && (
                <p className="modal-subtitle">
                  {selectedArtikel.name}
                </p>
              )}
            </div>
            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
          </div>

          {/* Tab Navigation */}
          <div className="sub-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`sub-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="modal-body" style={{flex: 1, overflowY: 'hidden', overflowX: 'hidden', padding: '1rem', display: 'flex', flexDirection: 'column'}}>
            {renderTabContent()}
          </div>

          {/* Footer */}
          <div className="modal-footer sub-tabs">
            <button className="sub-tab-btn" onClick={() => setShowModal(false)}>
              ❌ Abbrechen
            </button>
            <button className="sub-tab-btn" onClick={saveArtikel}>
              {modalMode === 'create' ? '✅ Erstellen' : '💾 Speichern'}
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // =====================================================================================
  // MAIN RENDER
  // =====================================================================================
  
  if (loading) {
    return (
      <div className="artikel-verwaltung">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Artikel werden geladen...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="artikel-verwaltung">
      <div className="page-header">
        <h1>Artikelverwaltung</h1>
        <p>Verwalten Sie Ihr Sortiment und Lagerbestände</p>
      </div>
      
      {error && (
        <div className="error-message">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      
      {/* Controls */}
      <div className="controls-section">
        <div className="search-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Artikel suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="search-icon">🔍</span>
          </div>
          
          <select
            value={selectedKategorie}
            onChange={(e) => setSelectedKategorie(e.target.value)}
          >
            <option value="">Alle Kategorien</option>
            {kategorien.map(kat => (
              <option key={kat.kategorie_id} value={kat.kategorie_id}>
                {kat.name}
              </option>
            ))}
          </select>
          
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showOnlyActive}
              onChange={(e) => setShowOnlyActive(e.target.checked)}
            />
            Nur aktive Artikel
          </label>
        </div>
        
        <button className="sub-tab-btn" onClick={handleCreate}>
          ➕ Neuer Artikel
        </button>
      </div>
      
      {/* Artikel Tabelle */}
      <div className="artikel-table-container">
        <table className="artikel-table">
          <thead>
            <tr>
              <th>Artikel</th>
              <th>Artikelgruppe</th>
              <th>Kategorie</th>
              <th>Preis</th>
              <th>Lager</th>
              <th>Status</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredArtikel.map(artikel => (
              <tr key={artikel.artikel_id}>
                <td className="artikel-info">
                  <div className="artikel-name">{artikel.name}</div>
                  <div className="artikel-details">
                    {artikel.artikel_nummer && `#${artikel.artikel_nummer}`}
                    {artikel.ean_code && ` • EAN: ${artikel.ean_code}`}
                  </div>
                </td>
                
                <td>
                  <span 
                    className="artikelgruppe-badge"
                    style={{ backgroundColor: artikel.artikelgruppe_farbe || '#4A90E2' }}
                  >
                    {artikel.artikelgruppe_name || 'Keine Gruppe'}
                  </span>
                </td>
                
                <td>
                  <span 
                    className="kategorie-badge"
                    style={{ backgroundColor: artikel.kategorie_farbe }}
                  >
                    {artikel.kategorie_name}
                  </span>
                </td>
                
                <td className="preis-info">
                  <div className="verkaufspreis">
                    {artikel.verkaufspreis_euro.toFixed(2)}€
                  </div>
                  {artikel.einkaufspreis_euro > 0 && (
                    <div className="einkaufspreis">
                      EK: {artikel.einkaufspreis_euro.toFixed(2)}€
                    </div>
                  )}
                </td>
                
                <td className="lager-info">
                  <div className="lagerbestand">
                    {artikel.lager_tracking ? artikel.lagerbestand : '∞'}
                  </div>
                  {artikel.lager_tracking && artikel.mindestbestand > 0 && (
                    <div className="mindestbestand">
                      Min: {artikel.mindestbestand}
                    </div>
                  )}
                </td>
                
                <td>
                  {renderLagerStatus(artikel)}
                </td>
                
                <td className="actions">
                  <button
                    className="sub-tab-btn"
                    onClick={() => handleEdit(artikel)}
                    title="Bearbeiten"
                    style={{fontSize: '0.85rem', padding: '0.5rem 1rem'}}
                  >
                    ✏️
                  </button>

                  {artikel.lager_tracking && (
                    <button
                      className="sub-tab-btn"
                      onClick={() => handleLager(artikel)}
                      title="Lagerbestand ändern"
                      style={{fontSize: '0.85rem', padding: '0.5rem 1rem'}}
                    >
                      📦
                    </button>
                  )}

                  <button
                    className="sub-tab-btn"
                    onClick={() => deleteArtikel(artikel.artikel_id)}
                    title="Deaktivieren"
                    style={{fontSize: '0.85rem', padding: '0.5rem 1rem'}}
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredArtikel.length === 0 && (
          <div className="empty-state">
            <p>Keine Artikel gefunden</p>
            <button className="sub-tab-btn" onClick={handleCreate}>
              Ersten Artikel erstellen
            </button>
          </div>
        )}
      </div>
      
      {/* Modal */}
      {renderModal()}
    </div>
  );
};

export default ArtikelVerwaltung;
