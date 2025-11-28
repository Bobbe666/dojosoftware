import React, { useState, useEffect } from 'react';
import '../styles/ArtikelgruppenVerwaltung.css';
import config from '../config/config.js';

const ArtikelgruppenVerwaltung = () => {
  const [gruppen, setGruppen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // all, hauptkategorien, unterkategorien

  // Formular-Daten
  const [formData, setFormData] = useState({
    name: '',
    beschreibung: '',
    parent_id: null,
    sortierung: 0,
    icon: '',
    farbe: '#4A90E2',
    aktiv: true
  });

  // ============================================
  // DATEN LADEN
  // ============================================
  useEffect(() => {
    loadGruppen();
  }, []);

  const loadGruppen = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.apiBaseUrl}/artikelgruppen`);
      const data = await response.json();
      
      if (data.success) {
        setGruppen(data.data);
        setError(null);
      } else {
        setError(data.message || 'Fehler beim Laden der Artikelgruppen');
      }
    } catch (err) {
      setError('Verbindungsfehler beim Laden der Artikelgruppen');
      console.error('Fehler beim Laden der Artikelgruppen:', err);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // MODAL HANDLING
  // ============================================
  const openModal = (group = null) => {
    if (group) {
      setEditingGroup(group);
      setFormData({
        name: group.name,
        beschreibung: group.beschreibung || '',
        parent_id: group.parent_id,
        sortierung: group.sortierung,
        icon: group.icon || '',
        farbe: group.farbe || '#4A90E2',
        aktiv: group.aktiv
      });
    } else {
      setEditingGroup(null);
      setFormData({
        name: '',
        beschreibung: '',
        parent_id: null,
        sortierung: 0,
        icon: '',
        farbe: '#4A90E2',
        aktiv: true
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingGroup(null);
    setFormData({
      name: '',
      beschreibung: '',
      parent_id: null,
      sortierung: 0,
      icon: '',
      farbe: '#4A90E2',
      aktiv: true
    });
  };

  // ============================================
  // FORMULAR HANDLING
  // ============================================
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const url = editingGroup 
        ? `/artikelgruppen/${editingGroup.id}`
        : '/artikelgruppen';
      
      const method = editingGroup ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadGruppen();
        closeModal();
      } else {
        setError(data.message || 'Fehler beim Speichern');
      }
    } catch (err) {
      setError('Verbindungsfehler beim Speichern');
      console.error('Fehler beim Speichern:', err);
    }
  };

  // ============================================
  // GRUPPE LÖSCHEN
  // ============================================
  const deleteGroup = async (group) => {
    if (!window.confirm(`Möchten Sie die Gruppe "${group.name}" wirklich löschen?`)) {
      return;
    }
    
    try {
      const response = await fetch(`/artikelgruppen/${group.id}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        await loadGruppen();
      } else {
        setError(data.message || 'Fehler beim Löschen');
      }
    } catch (err) {
      setError('Verbindungsfehler beim Löschen');
      console.error('Fehler beim Löschen:', err);
    }
  };

  // ============================================
  // EXPAND/COLLAPSE HANDLING
  // ============================================
  const toggleExpanded = (groupId) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // ============================================
  // FILTERING
  // ============================================
  const filteredGruppen = gruppen.filter(group => {
    const matchesSearch = group.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         group.beschreibung?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterType === 'hauptkategorien') {
      return matchesSearch && group.parent_id === null;
    } else if (filterType === 'unterkategorien') {
      return matchesSearch && group.parent_id !== null;
    }
    
    return matchesSearch;
  });

  // ============================================
  // RENDER FUNCTIONS
  // ============================================
  const renderGroupCard = (group) => {
    const isExpanded = expandedGroups.has(group.id);
    const hasUnterkategorien = group.unterkategorien && group.unterkategorien.length > 0;
    
    return (
      <div key={group.id} className="group-card">
        <div className="group-header">
          <div className="group-info">
            <div className="group-icon" style={{ color: group.farbe }}>
              {group.icon || '📁'}
            </div>
            <div className="group-details">
              <h3 className="group-name">{group.name}</h3>
              {group.beschreibung && (
                <p className="group-description">{group.beschreibung}</p>
              )}
              <div className="group-stats">
                <span className="stat">
                  <strong>{group.artikel_anzahl || 0}</strong> Artikel
                </span>
                {hasUnterkategorien && (
                  <span className="stat">
                    <strong>{group.unterkategorien.length}</strong> Unterkategorien
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="group-actions">
            {hasUnterkategorien && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => toggleExpanded(group.id)}
                title={isExpanded ? 'Einklappen' : 'Aufklappen'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            
            <button
              className="btn btn-primary btn-sm"
              onClick={() => openModal(group)}
              title="Bearbeiten"
            >
              ✏️
            </button>
            
            <button
              className="btn btn-danger btn-sm"
              onClick={() => deleteGroup(group)}
              title="Löschen"
            >
              🗑️
            </button>
          </div>
        </div>
        
        {isExpanded && hasUnterkategorien && (
          <div className="unterkategorien">
            {group.unterkategorien.map(untergruppe => (
              <div key={untergruppe.id} className="unterkategorie-card">
                <div className="unterkategorie-info">
                  <div className="unterkategorie-icon" style={{ color: untergruppe.farbe }}>
                    {untergruppe.icon || '📂'}
                  </div>
                  <div className="unterkategorie-details">
                    <h4 className="unterkategorie-name">{untergruppe.name}</h4>
                    {untergruppe.beschreibung && (
                      <p className="unterkategorie-description">{untergruppe.beschreibung}</p>
                    )}
                    <div className="unterkategorie-stats">
                      <span className="stat">
                        <strong>{untergruppe.artikel_anzahl || 0}</strong> Artikel
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="unterkategorie-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => openModal(untergruppe)}
                    title="Bearbeiten"
                  >
                    ✏️
                  </button>
                  
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => deleteGroup(untergruppe)}
                    title="Löschen"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // MAIN RENDER
  // ============================================
  if (loading) {
    return (
      <div className="artikelgruppen-verwaltung">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Lade Artikelgruppen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="artikelgruppen-verwaltung">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>Artikelgruppen-Verwaltung</h1>
          <p>Kampfsport-spezifische Kategorien und Unterkategorien verwalten</p>
        </div>
        <button className="btn btn-primary btn-large" onClick={() => openModal()}>
          ➕ Neue Gruppe
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Controls */}
      <div className="controls-section">
        <div className="search-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Gruppen suchen..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="search-icon">🔍</span>
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">Alle Gruppen</option>
            <option value="hauptkategorien">Nur Hauptkategorien</option>
            <option value="unterkategorien">Nur Unterkategorien</option>
          </select>
        </div>
      </div>

      {/* Groups Grid */}
      <div className="groups-container">
        {filteredGruppen.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📁</div>
            <h3>Keine Gruppen gefunden</h3>
            <p>
              {searchTerm 
                ? `Keine Gruppen gefunden für "${searchTerm}"`
                : 'Noch keine Artikelgruppen vorhanden'
              }
            </p>
            {!searchTerm && (
              <button className="btn btn-primary" onClick={() => openModal()}>
                Erste Gruppe erstellen
              </button>
            )}
          </div>
        ) : (
          <div className="groups-grid">
            {filteredGruppen.map(renderGroupCard)}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingGroup ? 'Gruppe bearbeiten' : 'Neue Gruppe erstellen'}</h2>
              <button className="close-btn" onClick={closeModal}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="group-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="z.B. Bekleidung"
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="sortierung">Sortierung</label>
                  <input
                    type="number"
                    id="sortierung"
                    name="sortierung"
                    value={formData.sortierung}
                    onChange={handleInputChange}
                    min="0"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="beschreibung">Beschreibung</label>
                <textarea
                  id="beschreibung"
                  name="beschreibung"
                  value={formData.beschreibung}
                  onChange={handleInputChange}
                  rows="3"
                  placeholder="Beschreibung der Gruppe..."
                />
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="parent_id">Hauptkategorie</label>
                  <select
                    id="parent_id"
                    name="parent_id"
                    value={formData.parent_id || ''}
                    onChange={handleInputChange}
                  >
                    <option value="">Hauptkategorie (keine)</option>
                    {gruppen
                      .filter(g => g.parent_id === null)
                      .map(hauptgruppe => (
                        <option key={hauptgruppe.id} value={hauptgruppe.id}>
                          {hauptgruppe.name}
                        </option>
                      ))
                    }
                  </select>
                </div>
                
                <div className="form-group">
                  <label htmlFor="icon">Icon (Emoji)</label>
                  <input
                    type="text"
                    id="icon"
                    name="icon"
                    value={formData.icon}
                    onChange={handleInputChange}
                    placeholder="👕"
                    maxLength="2"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="farbe">Farbe</label>
                <div className="color-input-group">
                  <input
                    type="color"
                    id="farbe"
                    name="farbe"
                    value={formData.farbe}
                    onChange={handleInputChange}
                  />
                  <input
                    type="text"
                    value={formData.farbe}
                    onChange={handleInputChange}
                    placeholder="#4A90E2"
                    className="color-text-input"
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="aktiv"
                    checked={formData.aktiv}
                    onChange={handleInputChange}
                  />
                  Gruppe ist aktiv
                </label>
              </div>
              
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                  Abbrechen
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingGroup ? 'Aktualisieren' : 'Erstellen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtikelgruppenVerwaltung;
