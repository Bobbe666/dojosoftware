import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './FinanzamtSelector.css';

const FinanzamtSelector = ({ 
  value, 
  onChange, 
  placeholder = "Finanzamt suchen...",
  className = "",
  disabled = false 
}) => {
  const [finanzaemter, setFinanzaemter] = useState([]);
  const [filteredFinanzaemter, setFilteredFinanzaemter] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bundeslaender, setBundeslaender] = useState([]);
  const [selectedBundesland, setSelectedBundesland] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFinanzamt, setNewFinanzamt] = useState({
    name: '',
    ort: '',
    bundesland: '',
    plz: '',
    strasse: '',
    telefon: '',
    email: '',
    finanzamtnummer: ''
  });

  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Lade Finanzämter beim Mount
  useEffect(() => {
    loadFinanzaemter();
    loadBundeslaender();
  }, []);

  // Lade Finanzämter basierend auf Suchterm und Bundesland
  useEffect(() => {
    filterFinanzaemter();
  }, [searchTerm, selectedBundesland, finanzaemter]);

  // Schließe Dropdown wenn außerhalb geklickt wird
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setShowCreateForm(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Setze Suchterm wenn value sich ändert
  useEffect(() => {
    if (value && typeof value === 'object') {
      setSearchTerm(`${value.name}, ${value.ort}`);
    } else if (typeof value === 'string') {
      setSearchTerm(value);
    }
  }, [value]);

  const loadFinanzaemter = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/finanzaemter');
      setFinanzaemter(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Finanzämter:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBundeslaender = async () => {
    try {
      const response = await axios.get('/api/finanzaemter/bundeslaender');
      setBundeslaender(response.data);
    } catch (error) {
      console.error('Fehler beim Laden der Bundesländer:', error);
    }
  };

  const filterFinanzaemter = () => {
    let filtered = finanzaemter;

    // Filter nach Bundesland
    if (selectedBundesland) {
      filtered = filtered.filter(fa => fa.bundesland === selectedBundesland);
    }

    // Filter nach Suchterm
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(fa => 
        fa.name.toLowerCase().includes(searchLower) ||
        fa.ort.toLowerCase().includes(searchLower) ||
        fa.bundesland.toLowerCase().includes(searchLower)
      );
    }

    setFilteredFinanzaemter(filtered.slice(0, 50)); // Limit für Performance
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setIsOpen(true);
    setShowCreateForm(false);
    
    // Wenn Input geleert wird, auch den Wert zurücksetzen
    if (!value) {
      onChange(null);
    }
  };

  const handleFinanzamtSelect = (finanzamt) => {
    setSearchTerm(`${finanzamt.name}, ${finanzamt.ort}`);
    onChange(finanzamt);
    setIsOpen(false);
    setShowCreateForm(false);
  };

  const handleCreateFinanzamt = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await axios.post('/api/finanzaemter', newFinanzamt);
      
      // Neues Finanzamt zur Liste hinzufügen
      const createdFinanzamt = response.data.finanzamt;
      setFinanzaemter(prev => [...prev, createdFinanzamt]);
      
      // Neues Finanzamt auswählen
      handleFinanzamtSelect(createdFinanzamt);
      
      // Form zurücksetzen
      setNewFinanzamt({
        name: '',
        ort: '',
        bundesland: '',
        plz: '',
        strasse: '',
        telefon: '',
        email: '',
        finanzamtnummer: ''
      });
      
      alert('Finanzamt erfolgreich angelegt!');
    } catch (error) {
      console.error('Fehler beim Anlegen des Finanzamts:', error);
      alert('Fehler beim Anlegen des Finanzamts: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setShowCreateForm(false);
    }
  };

  return (
    <div className={`finanzamt-selector ${className}`} ref={dropdownRef}>
      <div className="finanzamt-input-container">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="finanzamt-input"
        />
        <div className="finanzamt-filters">
          <select
            value={selectedBundesland}
            onChange={(e) => setSelectedBundesland(e.target.value)}
            className="bundesland-filter"
          >
            <option value="">Alle Bundesländer</option>
            {bundeslaender.map(bundesland => (
              <option key={bundesland} value={bundesland}>
                {bundesland}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isOpen && (
        <div className="finanzamt-dropdown">
          {loading ? (
            <div className="loading">Lade Finanzämter...</div>
          ) : (
            <>
              {filteredFinanzaemter.length > 0 ? (
                <div className="finanzamt-list">
                  {filteredFinanzaemter.map(finanzamt => (
                    <div
                      key={finanzamt.id}
                      className="finanzamt-item"
                      onClick={() => handleFinanzamtSelect(finanzamt)}
                    >
                      <div className="finanzamt-name">{finanzamt.name}</div>
                      <div className="finanzamt-details">
                        {finanzamt.ort}, {finanzamt.bundesland}
                        {finanzamt.finanzamtnummer && (
                          <span className="finanzamt-nummer"> (#{finanzamt.finanzamtnummer})</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-results">
                  <p>Keine Finanzämter gefunden</p>
                </div>
              )}

              <div className="finanzamt-actions">
                <button
                  type="button"
                  className="create-finanzamt-btn"
                  onClick={() => setShowCreateForm(!showCreateForm)}
                >
                  + Finanzamt nicht vorhanden? Anlegen
                </button>
              </div>

              {showCreateForm && (
                <div className="create-finanzamt-form">
                  <h4>Neues Finanzamt anlegen</h4>
                  <form onSubmit={handleCreateFinanzamt}>
                    <div className="form-row">
                      <input
                        type="text"
                        placeholder="Name des Finanzamts *"
                        value={newFinanzamt.name}
                        onChange={(e) => setNewFinanzamt(prev => ({ ...prev, name: e.target.value }))}
                        required
                      />
                      <input
                        type="text"
                        placeholder="Ort *"
                        value={newFinanzamt.ort}
                        onChange={(e) => setNewFinanzamt(prev => ({ ...prev, ort: e.target.value }))}
                        required
                      />
                    </div>
                    
                    <div className="form-row">
                      <select
                        value={newFinanzamt.bundesland}
                        onChange={(e) => setNewFinanzamt(prev => ({ ...prev, bundesland: e.target.value }))}
                        required
                      >
                        <option value="">Bundesland auswählen *</option>
                        {bundeslaender.map(bundesland => (
                          <option key={bundesland} value={bundesland}>
                            {bundesland}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="PLZ"
                        value={newFinanzamt.plz}
                        onChange={(e) => setNewFinanzamt(prev => ({ ...prev, plz: e.target.value }))}
                      />
                    </div>

                    <div className="form-row">
                      <input
                        type="text"
                        placeholder="Straße und Hausnummer"
                        value={newFinanzamt.strasse}
                        onChange={(e) => setNewFinanzamt(prev => ({ ...prev, strasse: e.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="Telefon"
                        value={newFinanzamt.telefon}
                        onChange={(e) => setNewFinanzamt(prev => ({ ...prev, telefon: e.target.value }))}
                      />
                    </div>

                    <div className="form-row">
                      <input
                        type="email"
                        placeholder="E-Mail"
                        value={newFinanzamt.email}
                        onChange={(e) => setNewFinanzamt(prev => ({ ...prev, email: e.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="Finanzamt-Nummer"
                        value={newFinanzamt.finanzamtnummer}
                        onChange={(e) => setNewFinanzamt(prev => ({ ...prev, finanzamtnummer: e.target.value }))}
                      />
                    </div>

                    <div className="form-actions">
                      <button type="submit" className="save-btn" disabled={loading}>
                        {loading ? 'Wird angelegt...' : 'Finanzamt anlegen'}
                      </button>
                      <button 
                        type="button" 
                        className="cancel-btn"
                        onClick={() => setShowCreateForm(false)}
                      >
                        Abbrechen
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FinanzamtSelector;
