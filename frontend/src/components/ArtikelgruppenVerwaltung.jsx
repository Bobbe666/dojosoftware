import React, { useState, useEffect } from 'react';
import '../styles/components.css';
import '../styles/ArtikelgruppenVerwaltung.css';
import config from '../config/config.js';

const ArtikelgruppenVerwaltung = () => {
  const [gruppen, setGruppen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null); // Für Detail-Ansicht
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

        // Aktualisiere selectedGroup falls vorhanden
        if (selectedGroup) {
          const updatedGroup = data.data.find(g => g.id === selectedGroup.id);
          if (updatedGroup) {
            setSelectedGroup(updatedGroup);
          } else {
            setSelectedGroup(null); // Gruppe wurde gelöscht
          }
        }
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
    if (group && group.id) {
      // Bearbeiten einer existierenden Gruppe
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
    } else if (group && group.parent_id) {
      // Neue Unterkategorie erstellen
      setEditingGroup(null);
      setFormData({
        name: '',
        beschreibung: '',
        parent_id: group.parent_id,
        sortierung: 0,
        icon: '',
        farbe: '#4A90E2',
        aktiv: true
      });
    } else {
      // Neue Hauptkategorie erstellen
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
  // DETAIL-ANSICHT HANDLING
  // ============================================
  const openGroupDetail = (group) => {
    setSelectedGroup(group);
  };

  const closeGroupDetail = () => {
    setSelectedGroup(null);
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

          <div className="group-actions sub-tabs">
            {hasUnterkategorien && (
              <button
                className="sub-tab-btn"
                onClick={() => openGroupDetail(group)}
                title="Details anzeigen"
                style={{fontSize: '0.85rem', padding: '0.5rem 1rem'}}
              >
                📋 Details
              </button>
            )}

            <button
              className="sub-tab-btn"
              onClick={() => openModal(group)}
              title="Bearbeiten"
              aria-label={`Gruppe ${group.name} bearbeiten`}
              style={{fontSize: '0.85rem', padding: '0.5rem 1rem'}}
            >
              ✏️
            </button>

            <button
              className="sub-tab-btn"
              onClick={() => deleteGroup(group)}
              title="Löschen"
              aria-label={`Gruppe ${group.name} löschen`}
              style={{fontSize: '0.85rem', padding: '0.5rem 1rem'}}
            >
              🗑️
            </button>
          </div>
        </div>
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
        <div className="header-actions">
          {selectedGroup && (
            <button className="sub-tab-btn" onClick={closeGroupDetail}>
              ← Zurück zur Übersicht
            </button>
          )}
          {!selectedGroup && (
            <button className="sub-tab-btn" onClick={() => openModal()}>
              ➕ Neue Gruppe
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {/* Main Content */}
      {!selectedGroup ? (
        <>
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
                  <button className="sub-tab-btn" onClick={() => openModal()}>
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
        </>
      ) : (
        /* Detail-Ansicht */
        <div className="group-detail-view">
          {/* Gruppe Header */}
          <div className="detail-header">
            <div className="detail-header-content">
              <div className="detail-icon" style={{ color: selectedGroup.farbe }}>
                {selectedGroup.icon || '📁'}
              </div>
              <div>
                <h2>{selectedGroup.name}</h2>
                {selectedGroup.beschreibung && (
                  <p className="detail-description">{selectedGroup.beschreibung}</p>
                )}
                <div className="detail-stats">
                  <span className="stat">
                    👥 <strong>{selectedGroup.artikel_anzahl || 0}</strong> Artikel
                  </span>
                  <span className="stat">
                    📂 <strong>{selectedGroup.unterkategorien?.length || 0}</strong> Unterkategorien
                  </span>
                </div>
              </div>
            </div>
            <div className="detail-actions sub-tabs">
              <button
                className="sub-tab-btn"
                onClick={() => openModal(selectedGroup)}
                title="Gruppe bearbeiten"
              >
                ✏️ Bearbeiten
              </button>
              <button
                className="sub-tab-btn"
                onClick={() => openModal({ parent_id: selectedGroup.id })}
                title="Unterkategorie hinzufügen"
              >
                ➕ Unterkategorie
              </button>
            </div>
          </div>

          {/* Unterkategorien Grid */}
          <div className="unterkategorien-section">
            <h3>Unterkategorien</h3>
            {selectedGroup.unterkategorien && selectedGroup.unterkategorien.length > 0 ? (
              <div className="unterkategorien-grid">
                {selectedGroup.unterkategorien.map(untergruppe => (
                  <div key={untergruppe.id} className="unterkategorie-detail-card">
                    <div className="unterkategorie-detail-header">
                      <div className="unterkategorie-icon" style={{ color: untergruppe.farbe }}>
                        {untergruppe.icon || '📂'}
                      </div>
                      <div className="unterkategorie-detail-info">
                        <h4>{untergruppe.name}</h4>
                        {untergruppe.beschreibung && (
                          <p>{untergruppe.beschreibung}</p>
                        )}
                        <div className="unterkategorie-stat">
                          <strong>{untergruppe.artikel_anzahl || 0}</strong> Artikel
                        </div>
                      </div>
                    </div>
                    <div className="unterkategorie-detail-actions sub-tabs">
                      <button
                        className="sub-tab-btn"
                        onClick={() => openModal(untergruppe)}
                        title="Bearbeiten"
                        style={{fontSize: '0.85rem', padding: '0.5rem 1rem'}}
                      >
                        ✏️
                      </button>
                      <button
                        className="sub-tab-btn"
                        onClick={() => deleteGroup(untergruppe)}
                        title="Löschen"
                        style={{fontSize: '0.85rem', padding: '0.5rem 1rem'}}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📂</div>
                <h3>Noch keine Unterkategorien</h3>
                <p>Fügen Sie die erste Unterkategorie für diese Gruppe hinzu</p>
                <button
                  className="sub-tab-btn"
                  onClick={() => openModal({ parent_id: selectedGroup.id })}
                >
                  Erste Unterkategorie erstellen
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
              
              <div className="modal-footer sub-tabs">
                <button type="button" className="sub-tab-btn" onClick={closeModal}>
                  Abbrechen
                </button>
                <button type="submit" className="sub-tab-btn">
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
