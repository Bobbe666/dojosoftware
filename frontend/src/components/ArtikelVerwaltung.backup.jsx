// =====================================================================================
// ARTIKEL-VERWALTUNG KOMPONENTE - DOJOSOFTWARE VERKAUFSSYSTEM
// =====================================================================================
// Vollständige CRUD-Operationen für Artikel mit Lagerbestand-Tracking
// Deutsche rechtliche Grundlagen beachtet (GoBD, KassenSichV)
// =====================================================================================

import React, { useState, useEffect } from 'react';
import '../styles/components.css';
import '../styles/ArtikelVerwaltung.css';

const ArtikelVerwaltung = () => {
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
  
  // Step Navigation States
  const [currentStep, setCurrentStep] = useState(1);
  const [totalSteps, setTotalSteps] = useState(5);
  
  // Form States
  const [formData, setFormData] = useState({
    kategorie_id: '',
    artikelgruppe_id: '',
    name: '',
    beschreibung: '',
    ean_code: '',
    artikel_nummer: '',
    einkaufspreis_euro: '',
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
      const response = await fetch(`/api/artikel${endpoint}`, {
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
      const response = await fetch('/api/artikelgruppen');
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
    setModalMode('create');
    setSelectedArtikel(null);
    setCurrentStep(1);
    setTotalSteps(5);
    resetForm();
    setShowModal(true);
  };
  
  const handleEdit = (artikel) => {
    setModalMode('edit');
    setSelectedArtikel(artikel);
    setCurrentStep(1);
    setTotalSteps(5);
    setFormData({
      kategorie_id: artikel.kategorie_id,
      name: artikel.name,
      beschreibung: artikel.beschreibung || '',
      ean_code: artikel.ean_code || '',
      artikel_nummer: artikel.artikel_nummer || '',
      einkaufspreis_euro: artikel.einkaufspreis_euro || '',
      verkaufspreis_euro: artikel.verkaufspreis_euro || '',
      mwst_prozent: artikel.mwst_prozent || 19.00,
      lagerbestand: artikel.lagerbestand || 0,
      mindestbestand: artikel.mindestbestand || 0,
      lager_tracking: artikel.lager_tracking,
      farbe_hex: artikel.farbe_hex || '#FFFFFF',
      aktiv: artikel.aktiv,
      sichtbar_kasse: artikel.sichtbar_kasse
    });
    setShowModal(true);
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
  // STEP NAVIGATION
  // =====================================================================================
  
  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(prev => prev + 1);
    }
  };
  
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };
  
  const goToStep = (step) => {
    setCurrentStep(step);
  };
  
  const getStepTitle = (step) => {
    const titles = {
      1: '📋 Grundinformationen',
      2: '🔍 Identifikation', 
      3: '💰 Preise & Steuern',
      4: '📦 Lagerbestand',
      5: '⚙️ Einstellungen'
    };
    return titles[step] || '';
  };
  
  const getStepDescription = (step) => {
    const descriptions = {
      1: 'Artikelgruppe, Kategorie und grundlegende Informationen',
      2: 'EAN-Code und Artikel-Nummer für die Identifikation',
      3: 'Einkaufs- und Verkaufspreise sowie Steuersätze',
      4: 'Lagerbestand, Mindestbestand und visuelle Darstellung',
      5: 'Aktivierungsstatus und Sichtbarkeitseinstellungen'
    };
    return descriptions[step] || '';
  };
  
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
  // STEP COMPONENTS
  // =====================================================================================
  
  const renderStep1 = () => (
    <div className="step-content">
      <div className="step-header">
        <h3 className="step-title">📋 Grundinformationen</h3>
        <p className="step-description">Artikelgruppe, Kategorie und grundlegende Informationen</p>
      </div>
      
      <div className="form-grid">
        <div className="form-group enhanced">
          <label className="form-label-enhanced">
            <span className="label-icon">📁</span>
            Artikelgruppe *
          </label>
          <select
            name="artikelgruppe_id"
            value={formData.artikelgruppe_id}
            onChange={handleInputChange}
            required
            className="form-input-enhanced"
          >
            <option value="">Wählen Sie eine Artikelgruppe...</option>
            {artikelgruppen.map(gruppe => (
              <option key={gruppe.id} value={gruppe.id}>
                {gruppe.vollstaendiger_name || gruppe.name}
              </option>
            ))}
          </select>
          <div className="input-hint">Gruppiert ähnliche Artikel zusammen</div>
        </div>
        
        <div className="form-group enhanced">
          <label className="form-label-enhanced">
            <span className="label-icon">🏷️</span>
            Kategorie
          </label>
          <select
            name="kategorie_id"
            value={formData.kategorie_id}
            onChange={handleInputChange}
            className="form-input-enhanced"
          >
            <option value="">Wählen Sie eine Kategorie...</option>
            {kategorien.map(kat => (
              <option key={kat.kategorie_id} value={kat.kategorie_id}>
                {kat.name}
              </option>
            ))}
          </select>
          <div className="input-hint">Zusätzliche Kategorisierung für bessere Übersicht</div>
        </div>
        
        <div className="form-group enhanced full-width">
          <label className="form-label-enhanced">
            <span className="label-icon">📝</span>
            Artikelname *
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleInputChange}
            required
            className="form-input-enhanced"
            placeholder="z.B. Proteinriegel Schokolade 50g"
          />
          <div className="input-hint">Eindeutiger Name des Artikels</div>
        </div>
        
        <div className="form-group enhanced full-width">
          <label className="form-label-enhanced">
            <span className="label-icon">📄</span>
            Beschreibung
          </label>
          <textarea
            name="beschreibung"
            value={formData.beschreibung}
            onChange={handleInputChange}
            rows="4"
            className="form-textarea-enhanced"
            placeholder="Detaillierte Beschreibung des Artikels, Zutaten, Eigenschaften..."
          />
          <div className="input-hint">Optionale detaillierte Beschreibung</div>
        </div>
      </div>
    </div>
  );
  
  const renderStep2 = () => (
    <div className="step-content">
      <div className="step-header">
        <h3 className="step-title">🔍 Identifikation</h3>
        <p className="step-description">EAN-Code und Artikel-Nummer für die Identifikation</p>
      </div>
      
      <div className="form-grid">
        <div className="form-group enhanced">
          <label className="form-label-enhanced">
            <span className="label-icon">🔢</span>
            EAN-Code
          </label>
          <input
            type="text"
            name="ean_code"
            value={formData.ean_code}
            onChange={handleInputChange}
            className="form-input-enhanced"
            placeholder="z.B. 1234567890123"
            maxLength="13"
          />
          <div className="input-hint">13-stelliger Barcode für Scanner</div>
        </div>
        
        <div className="form-group enhanced">
          <label className="form-label-enhanced">
            <span className="label-icon">🏷️</span>
            Artikel-Nummer
          </label>
          <input
            type="text"
            name="artikel_nummer"
            value={formData.artikel_nummer}
            onChange={handleInputChange}
            className="form-input-enhanced"
            placeholder="z.B. PRO-001"
          />
          <div className="input-hint">Interne Artikelnummer</div>
        </div>
      </div>
    </div>
  );
  
  const renderStep3 = () => (
    <div className="step-content">
      <div className="step-header">
        <h3 className="step-title">💰 Preise & Steuern</h3>
        <p className="step-description">Einkaufs- und Verkaufspreise sowie Steuersätze</p>
      </div>
      
      <div className="form-grid">
        <div className="form-group enhanced">
          <label className="form-label-enhanced">
            <span className="label-icon">💸</span>
            Einkaufspreis (€)
          </label>
          <input
            type="number"
            name="einkaufspreis_euro"
            value={formData.einkaufspreis_euro}
            onChange={handleInputChange}
            step="0.01"
            min="0"
            className="form-input-enhanced"
            placeholder="0.00"
          />
          <div className="input-hint">Preis beim Einkauf</div>
        </div>
        
        <div className="form-group enhanced">
          <label className="form-label-enhanced">
            <span className="label-icon">💰</span>
            Verkaufspreis (€) *
          </label>
          <input
            type="number"
            name="verkaufspreis_euro"
            value={formData.verkaufspreis_euro}
            onChange={handleInputChange}
            step="0.01"
            min="0"
            required
            className="form-input-enhanced"
            placeholder="0.00"
          />
          <div className="input-hint">Preis für den Kunden</div>
        </div>
        
        <div className="form-group enhanced">
          <label className="form-label-enhanced">
            <span className="label-icon">📊</span>
            MwSt. (%)
          </label>
          <select
            name="mwst_prozent"
            value={formData.mwst_prozent}
            onChange={handleInputChange}
            className="form-input-enhanced"
          >
            <option value="7.00">7% (ermäßigt)</option>
            <option value="19.00">19% (normal)</option>
          </select>
          <div className="input-hint">Deutsche Mehrwertsteuer</div>
        </div>
      </div>
    </div>
  );
  
  const renderStep4 = () => (
    <div className="step-content">
      <div className="step-header">
        <h3 className="step-title">📦 Lagerbestand</h3>
        <p className="step-description">Lagerbestand, Mindestbestand und visuelle Darstellung</p>
      </div>
      
      <div className="form-grid">
        <div className="form-group enhanced">
          <label className="form-label-enhanced">
            <span className="label-icon">📦</span>
            Aktueller Bestand
          </label>
          <input
            type="number"
            name="lagerbestand"
            value={formData.lagerbestand}
            onChange={handleInputChange}
            min="0"
            className="form-input-enhanced"
            placeholder="0"
          />
          <div className="input-hint">Menge im Lager</div>
        </div>
        
        <div className="form-group enhanced">
          <label className="form-label-enhanced">
            <span className="label-icon">⚠️</span>
            Mindestbestand
          </label>
          <input
            type="number"
            name="mindestbestand"
            value={formData.mindestbestand}
            onChange={handleInputChange}
            min="0"
            className="form-input-enhanced"
            placeholder="0"
          />
          <div className="input-hint">Warnung bei Unterschreitung</div>
        </div>
        
        <div className="form-group enhanced">
          <label className="form-label-enhanced">
            <span className="label-icon">🎨</span>
            Farbe
          </label>
          <div className="color-input-enhanced">
            <input
              type="color"
              name="farbe_hex"
              value={formData.farbe_hex}
              onChange={handleInputChange}
              className="color-picker-enhanced"
            />
            <input
              type="text"
              value={formData.farbe_hex}
              onChange={(e) => setFormData(prev => ({...prev, farbe_hex: e.target.value}))}
              className="color-text-enhanced"
              placeholder="#FFFFFF"
            />
          </div>
          <div className="input-hint">Farbe für visuelle Darstellung</div>
        </div>
      </div>
    </div>
  );
  
  const renderStep5 = () => (
    <div className="step-content">
      <div className="step-header">
        <h3 className="step-title">⚙️ Einstellungen</h3>
        <p className="step-description">Aktivierungsstatus und Sichtbarkeitseinstellungen</p>
      </div>
      
      <div className="settings-grid">
        <div className="setting-item">
          <div className="setting-header">
            <span className="setting-icon">📊</span>
            <div className="setting-info">
              <h4>Lagerbestand verfolgen</h4>
              <p>Automatische Bestandsverfolgung aktivieren</p>
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              name="lager_tracking"
              checked={formData.lager_tracking}
              onChange={handleInputChange}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        
        <div className="setting-item">
          <div className="setting-header">
            <span className="setting-icon">✅</span>
            <div className="setting-info">
              <h4>Aktiv</h4>
              <p>Artikel ist verfügbar und kann verkauft werden</p>
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              name="aktiv"
              checked={formData.aktiv}
              onChange={handleInputChange}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        
        <div className="setting-item">
          <div className="setting-header">
            <span className="setting-icon">🛒</span>
            <div className="setting-info">
              <h4>In Kasse sichtbar</h4>
              <p>Artikel wird im Kassensystem angezeigt</p>
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              name="sichtbar_kasse"
              checked={formData.sichtbar_kasse}
              onChange={handleInputChange}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>
    </div>
  );
  
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      default: return renderStep1();
    }
  };

  const renderModal = () => {
    if (!showModal) return null;

    return (
      <div className="modal-overlay fullscreen-modal" onClick={() => setShowModal(false)}>
        <div className="modal-content step-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <div className="modal-title-section">
              <h2>
                {modalMode === 'create' && '🆕 Neuen Artikel erstellen'}
                {modalMode === 'edit' && '✏️ Artikel bearbeiten'}
                {modalMode === 'lager' && '📦 Lagerbestand ändern'}
              </h2>
              {modalMode !== 'lager' && (
                <p className="modal-subtitle">
                  Schritt {currentStep} von {totalSteps}
                </p>
              )}
            </div>
            <button className="close-btn" onClick={() => setShowModal(false)}>×</button>
          </div>
          
          {modalMode === 'lager' ? (
            <div className="modal-body">
              <div className="lager-form">
                <div className="form-section">
                  <h3 className="section-title">📊 Lagerbewegung</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Bewegungsart:</label>
                      <select 
                        name="bewegungsart" 
                        value={lagerBewegung.bewegungsart}
                        onChange={handleLagerChange}
                        className="form-select"
                      >
                        <option value="eingang">📈 Eingang (+)</option>
                        <option value="ausgang">📉 Ausgang (-)</option>
                      </select>
                    </div>
                    
                    <div className="form-group">
                      <label>Menge:</label>
                      <input
                        type="number"
                        name="menge"
                        value={lagerBewegung.menge}
                        onChange={handleLagerChange}
                        min="1"
                        required
                        className="form-input"
                        placeholder="Anzahl"
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Grund:</label>
                    <input
                      type="text"
                      name="grund"
                      value={lagerBewegung.grund}
                      onChange={handleLagerChange}
                      placeholder="z.B. Lieferung, Verkauf, Inventur"
                      className="form-input"
                    />
                  </div>
                </div>
                
                <div className="artikel-info-card">
                  <h4>📦 {selectedArtikel?.name}</h4>
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="info-label">Aktueller Bestand:</span>
                      <span className="info-value">{selectedArtikel?.lagerbestand}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Mindestbestand:</span>
                      <span className="info-value">{selectedArtikel?.mindestbestand}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Progress Bar */}
              <div className="progress-container">
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(currentStep / totalSteps) * 100}%` }}
                  ></div>
                </div>
                <div className="progress-steps">
                  {Array.from({ length: totalSteps }, (_, i) => i + 1).map(step => (
                    <button
                      key={step}
                      className={`progress-step ${currentStep === step ? 'active' : currentStep > step ? 'completed' : ''}`}
                      onClick={() => goToStep(step)}
                      disabled={currentStep < step}
                    >
                      <span className="step-number">{step}</span>
                      <span className="step-label">{getStepTitle(step).replace(/[📋🔍💰📦⚙️]/g, '').trim()}</span>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="modal-body">
                {renderCurrentStep()}
              </div>
            </>
          )}
          
          <div className="modal-footer sub-tabs">
            <button
              className="sub-tab-btn"
              onClick={() => setShowModal(false)}
            >
              ❌ Abbrechen
            </button>

            {modalMode !== 'lager' && (
              <>
                {currentStep > 1 && (
                  <button
                    className="sub-tab-btn"
                    onClick={prevStep}
                  >
                    ← Zurück
                  </button>
                )}

                {currentStep < totalSteps ? (
                  <button
                    className="sub-tab-btn"
                    onClick={nextStep}
                  >
                    Weiter →
                  </button>
                ) : (
                  <button
                    className="sub-tab-btn"
                    onClick={modalMode === 'lager' ? updateLagerbestand : saveArtikel}
                  >
                    {modalMode === 'create' && '✅ Erstellen'}
                    {modalMode === 'edit' && '💾 Speichern'}
                  </button>
                )}
              </>
            )}

            {modalMode === 'lager' && (
              <button
                className="sub-tab-btn"
                onClick={updateLagerbestand}
              >
                📦 Aktualisieren
              </button>
            )}
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
