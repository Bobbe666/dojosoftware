// Frontend/src/components/RaumVerwaltung.jsx - Raumverwaltung für Dojo-Einstellungen
import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Save, X, MapPin, Users, Square, Palette, MoveUp, MoveDown } from 'lucide-react';
import config from '../config/config.js';
import '../styles/RaumVerwaltung.css';
import { fetchWithAuth } from '../utils/fetchWithAuth';


const RaumVerwaltung = () => {
  const [raeume, setRaeume] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRoom, setNewRoom] = useState({
    name: '',
    beschreibung: '',
    groesse: '',
    kapazitaet: '',
    farbe: '#4F46E5',
    aktiv: true
  });

  // Räume laden
  const loadRaeume = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth(`${config.apiBaseUrl}/raeume`);
      const result = await response.json();

      if (result.success) {
        setRaeume(result.data);
      } else {
        console.error('Fehler beim Laden der Räume:', result);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Räume:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRaeume();
  }, []);

  // Neuen Raum hinzufügen
  const handleAddRoom = async () => {
    if (!newRoom.name.trim()) {
      alert('Bitte geben Sie einen Raumnamen ein');
      return;
    }

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/raeume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newRoom)
      });

      const result = await response.json();

      if (result.success) {
        setNewRoom({
          name: '',
          beschreibung: '',
          groesse: '',
          kapazitaet: '',
          farbe: '#4F46E5',
          aktiv: true
        });
        setShowAddForm(false);
        loadRaeume();
      } else {
        alert('Fehler beim Hinzufügen des Raums: ' + result.error);
      }
    } catch (error) {
      console.error('Fehler beim Hinzufügen des Raums:', error);
      alert('Fehler beim Hinzufügen des Raums');
    }
  };

  // Raum bearbeiten
  const handleEditRoom = async (raum) => {
    if (!raum.name.trim()) {
      alert('Bitte geben Sie einen Raumnamen ein');
      return;
    }

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/raeume/${raum.raum_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: raum.name,
          beschreibung: raum.beschreibung,
          groesse: raum.groesse,
          kapazitaet: raum.kapazitaet,
          farbe: raum.farbe,
          aktiv: raum.aktiv
        })
      });

      const result = await response.json();

      if (result.success) {
        setEditingId(null);
        loadRaeume();
      } else {
        alert('Fehler beim Speichern des Raums: ' + result.error);
      }
    } catch (error) {
      console.error('Fehler beim Speichern des Raums:', error);
      alert('Fehler beim Speichern des Raums');
    }
  };

  // Raum löschen
  const handleDeleteRoom = async (raumId, raumName) => {
    if (!confirm(`Möchten Sie den Raum "${raumName}" wirklich löschen?`)) {
      return;
    }

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/raeume/${raumId}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        loadRaeume();
      } else {
        alert('Fehler beim Löschen des Raums: ' + result.error);
      }
    } catch (error) {
      console.error('Fehler beim Löschen des Raums:', error);
      alert('Fehler beim Löschen des Raums');
    }
  };

  // Raum-Eigenschaften ändern
  const updateRoomProperty = (raumId, property, value) => {
    setRaeume(raeume.map(raum =>
      raum.raum_id === raumId
        ? { ...raum, [property]: value }
        : raum
    ));
  };

  if (loading) {
    return (
      <div className="raum-verwaltung loading">
        <div className="loading-spinner"></div>
        <p>Räume werden geladen...</p>
      </div>
    );
  }

  // Inline styles für Dark Theme
  const styles = {
    sectionHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '2rem',
      padding: '1.5rem',
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 215, 0, 0.2)',
      borderRadius: '12px',
      backdropFilter: 'blur(10px)'
    },
    headerContent: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem'
    },
    headerIcon: {
      color: '#ffd700',
      width: '24px',
      height: '24px'
    },
    headerTitle: {
      margin: 0,
      color: '#ffd700',
      fontSize: '1.5rem',
      fontWeight: 600,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      textTransform: 'none',
      fontStyle: 'normal',
      letterSpacing: 'normal'
    },
    headerSubtitle: {
      margin: 0,
      color: 'rgba(255, 255, 255, 0.7)',
      fontSize: '0.9rem'
    },
    btnPrimary: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.5rem',
      padding: '0.75rem 1.5rem',
      background: 'linear-gradient(135deg, #ffd700, #ffed4a)',
      color: '#1a1a2e',
      border: 'none',
      borderRadius: '8px',
      fontSize: '0.9rem',
      fontWeight: 600,
      cursor: 'pointer'
    },
    roomCard: {
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 215, 0, 0.2)',
      borderRadius: '12px',
      overflow: 'hidden',
      backdropFilter: 'blur(10px)'
    },
    roomHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '1.5rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      background: 'transparent'
    },
    roomName: {
      flexGrow: 1,
      margin: 0,
      fontSize: '1.1rem',
      fontWeight: 600,
      color: '#ffffff'
    },
    roomDetails: {
      padding: '1.5rem',
      background: 'transparent'
    },
    btnIcon: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '6px',
      background: 'rgba(255, 255, 255, 0.05)',
      color: 'rgba(255, 255, 255, 0.8)',
      cursor: 'pointer'
    },
    btnIconDanger: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '32px',
      height: '32px',
      border: '1px solid #EF4444',
      borderRadius: '6px',
      background: 'rgba(255, 255, 255, 0.05)',
      color: '#EF4444',
      cursor: 'pointer'
    }
  };

  return (
    <div className="raum-verwaltung">
      <div className="section-header" style={styles.sectionHeader}>
        <div className="header-content" style={styles.headerContent}>
          <MapPin style={styles.headerIcon} />
          <div>
            <h2 style={styles.headerTitle}>Raumverwaltung</h2>
            <p style={styles.headerSubtitle}>Verwalten Sie die Trainingsräume Ihres Dojos</p>
          </div>
        </div>
        <button
          className="btn-primary"
          style={styles.btnPrimary}
          onClick={() => setShowAddForm(true)}
          disabled={showAddForm}
        >
          <Plus size={16} />
          Raum hinzufügen
        </button>
      </div>

      {/* Neuen Raum hinzufügen */}
      {showAddForm && (
        <div className="room-form-card">
          <div className="form-header">
            <h3>Neuen Raum hinzufügen</h3>
            <button
              className="btn-icon"
              onClick={() => setShowAddForm(false)}
            >
              <X size={16} />
            </button>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Raumname *</label>
              <input
                type="text"
                value={newRoom.name}
                onChange={(e) => setNewRoom({...newRoom, name: e.target.value})}
                placeholder="z.B. Hauptraum, Nebenraum..."
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Beschreibung</label>
              <input
                type="text"
                value={newRoom.beschreibung}
                onChange={(e) => setNewRoom({...newRoom, beschreibung: e.target.value})}
                placeholder="Kurze Beschreibung des Raums"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Größe</label>
              <input
                type="text"
                value={newRoom.groesse}
                onChange={(e) => setNewRoom({...newRoom, groesse: e.target.value})}
                placeholder="z.B. 120 m², Groß, Klein..."
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Kapazität</label>
              <input
                type="number"
                value={newRoom.kapazitaet}
                onChange={(e) => setNewRoom({...newRoom, kapazitaet: e.target.value})}
                placeholder="Max. Anzahl Personen"
                className="form-input"
                min="1"
              />
            </div>

            <div className="form-group">
              <label>Farbe</label>
              <div className="color-input-group">
                <input
                  type="color"
                  value={newRoom.farbe}
                  onChange={(e) => setNewRoom({...newRoom, farbe: e.target.value})}
                  className="color-input"
                />
                <span className="color-value">{newRoom.farbe}</span>
              </div>
            </div>

            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={newRoom.aktiv}
                  onChange={(e) => setNewRoom({...newRoom, aktiv: e.target.checked})}
                />
                Raum ist aktiv
              </label>
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setShowAddForm(false)}>
              Abbrechen
            </button>
            <button className="btn-primary" onClick={handleAddRoom}>
              <Save size={16} />
              Raum hinzufügen
            </button>
          </div>
        </div>
      )}

      {/* Räume-Liste */}
      <div className="rooms-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {raeume.map((raum) => (
          <div
            key={raum.raum_id}
            className={`room-card ${!raum.aktiv ? 'inactive' : ''} ${editingId === raum.raum_id ? 'editing' : ''}`}
            style={{
              ...styles.roomCard,
              opacity: !raum.aktiv ? 0.6 : 1,
              border: editingId === raum.raum_id ? '2px solid #ffd700' : '1px solid rgba(255, 215, 0, 0.2)'
            }}
          >
            <div className="room-header" style={styles.roomHeader}>
              <div className="room-color" style={{ backgroundColor: raum.farbe, width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)' }}></div>
              {editingId === raum.raum_id ? (
                <input
                  type="text"
                  value={raum.name}
                  onChange={(e) => updateRoomProperty(raum.raum_id, 'name', e.target.value)}
                  className="room-name-input"
                  style={{ flexGrow: 1, padding: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: '6px', fontSize: '1.1rem', fontWeight: 600, color: '#ffffff' }}
                />
              ) : (
                <h3 className="room-name" style={styles.roomName}>{raum.name}</h3>
              )}

              <div className="room-actions" style={{ display: 'flex', gap: '0.5rem' }}>
                {editingId === raum.raum_id ? (
                  <>
                    <button
                      className="btn-icon success"
                      style={{ ...styles.btnIcon, borderColor: '#10B981', color: '#10B981' }}
                      onClick={() => handleEditRoom(raum)}
                    >
                      <Save size={16} />
                    </button>
                    <button
                      className="btn-icon"
                      style={styles.btnIcon}
                      onClick={() => setEditingId(null)}
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn-icon"
                      style={styles.btnIcon}
                      onClick={() => setEditingId(raum.raum_id)}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      className="btn-icon danger"
                      style={styles.btnIconDanger}
                      onClick={() => handleDeleteRoom(raum.raum_id, raum.name)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {editingId === raum.raum_id ? (
              <div className="room-edit-form" style={{ padding: '1.5rem', background: 'rgba(0, 0, 0, 0.2)' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'rgba(255, 255, 255, 0.8)', textTransform: 'none' }}>Beschreibung</label>
                  <input
                    type="text"
                    value={raum.beschreibung || ''}
                    onChange={(e) => updateRoomProperty(raum.raum_id, 'beschreibung', e.target.value)}
                    style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 215, 0, 0.2)', borderRadius: '8px', fontSize: '0.9rem', color: '#ffffff' }}
                  />
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'rgba(255, 255, 255, 0.8)', textTransform: 'none' }}>Größe</label>
                    <input
                      type="text"
                      value={raum.groesse || ''}
                      onChange={(e) => updateRoomProperty(raum.raum_id, 'groesse', e.target.value)}
                      style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 215, 0, 0.2)', borderRadius: '8px', fontSize: '0.9rem', color: '#ffffff' }}
                    />
                  </div>

                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'rgba(255, 255, 255, 0.8)', textTransform: 'none' }}>Kapazität</label>
                    <input
                      type="number"
                      value={raum.kapazitaet || ''}
                      onChange={(e) => updateRoomProperty(raum.raum_id, 'kapazitaet', e.target.value)}
                      style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 215, 0, 0.2)', borderRadius: '8px', fontSize: '0.9rem', color: '#ffffff' }}
                      min="1"
                    />
                  </div>
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 500, color: 'rgba(255, 255, 255, 0.8)', textTransform: 'none' }}>Farbe</label>
                    <input
                      type="color"
                      value={raum.farbe || '#4F46E5'}
                      onChange={(e) => updateRoomProperty(raum.raum_id, 'farbe', e.target.value)}
                      style={{ width: '50px', height: '40px', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                    />
                  </div>

                  <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem', textTransform: 'none' }}>
                      <input
                        type="checkbox"
                        checked={raum.aktiv}
                        onChange={(e) => updateRoomProperty(raum.raum_id, 'aktiv', e.target.checked)}
                        style={{ width: '18px', height: '18px', accentColor: '#ffd700' }}
                      />
                      Aktiv
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="room-details" style={styles.roomDetails}>
                {raum.beschreibung && (
                  <p className="room-description" style={{ margin: '0 0 1rem 0', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem', lineHeight: 1.5 }}>{raum.beschreibung}</p>
                )}

                <div className="room-info" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
                  {raum.groesse && (
                    <div className="room-info-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
                      <Square size={14} style={{ color: '#ffd700' }} />
                      <span>{raum.groesse}</span>
                    </div>
                  )}

                  {raum.kapazitaet && (
                    <div className="room-info-item" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.9rem' }}>
                      <Users size={14} style={{ color: '#ffd700' }} />
                      <span>{raum.kapazitaet} Personen</span>
                    </div>
                  )}
                </div>

                {!raum.aktiv && (
                  <div className="room-status inactive" style={{ display: 'inline-block', padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 500, background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    Inaktiv
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {raeume.length === 0 && (
          <div className="empty-state" style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', textAlign: 'center', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 215, 0, 0.2)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}>
            <MapPin size={48} style={{ color: 'rgba(255, 215, 0, 0.4)', marginBottom: '1rem' }} />
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#ffffff', fontSize: '1.2rem', fontWeight: 600 }}>Keine Räume vorhanden</h3>
            <p style={{ margin: '0 0 2rem 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem' }}>Fügen Sie Ihren ersten Trainingsraum hinzu</p>
            <button
              className="btn-primary"
              style={styles.btnPrimary}
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={16} />
              Ersten Raum hinzufügen
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RaumVerwaltung;