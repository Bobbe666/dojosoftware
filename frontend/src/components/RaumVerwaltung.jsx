// Frontend/src/components/RaumVerwaltung.jsx - Raumverwaltung für Dojo-Einstellungen
import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Save, X, MapPin, Users, Square, Palette, MoveUp, MoveDown } from 'lucide-react';
import config from '../config/config.js';
import '../styles/RaumVerwaltung.css';

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
      const response = await fetch(`${config.apiBaseUrl}/raeume`);
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
      const response = await fetch(`${config.apiBaseUrl}/raeume`, {
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
      const response = await fetch(`${config.apiBaseUrl}/raeume/${raum.raum_id}`, {
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
      const response = await fetch(`${config.apiBaseUrl}/raeume/${raumId}`, {
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

  return (
    <div className="raum-verwaltung">
      <div className="section-header">
        <div className="header-content">
          <MapPin className="header-icon" />
          <div>
            <h2>Raumverwaltung</h2>
            <p>Verwalten Sie die Trainingsräume Ihres Dojos</p>
          </div>
        </div>
        <button
          className="btn-primary"
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
      <div className="rooms-grid">
        {raeume.map((raum) => (
          <div
            key={raum.raum_id}
            className={`room-card ${!raum.aktiv ? 'inactive' : ''} ${editingId === raum.raum_id ? 'editing' : ''}`}
          >
            <div className="room-header">
              <div className="room-color" style={{ backgroundColor: raum.farbe }}></div>
              {editingId === raum.raum_id ? (
                <input
                  type="text"
                  value={raum.name}
                  onChange={(e) => updateRoomProperty(raum.raum_id, 'name', e.target.value)}
                  className="room-name-input"
                />
              ) : (
                <h3 className="room-name">{raum.name}</h3>
              )}

              <div className="room-actions">
                {editingId === raum.raum_id ? (
                  <>
                    <button
                      className="btn-icon success"
                      onClick={() => handleEditRoom(raum)}
                    >
                      <Save size={16} />
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => setEditingId(null)}
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn-icon"
                      onClick={() => setEditingId(raum.raum_id)}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      className="btn-icon danger"
                      onClick={() => handleDeleteRoom(raum.raum_id, raum.name)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {editingId === raum.raum_id ? (
              <div className="room-edit-form">
                <div className="form-group">
                  <label>Beschreibung</label>
                  <input
                    type="text"
                    value={raum.beschreibung || ''}
                    onChange={(e) => updateRoomProperty(raum.raum_id, 'beschreibung', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Größe</label>
                    <input
                      type="text"
                      value={raum.groesse || ''}
                      onChange={(e) => updateRoomProperty(raum.raum_id, 'groesse', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Kapazität</label>
                    <input
                      type="number"
                      value={raum.kapazitaet || ''}
                      onChange={(e) => updateRoomProperty(raum.raum_id, 'kapazitaet', e.target.value)}
                      className="form-input"
                      min="1"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Farbe</label>
                    <input
                      type="color"
                      value={raum.farbe || '#4F46E5'}
                      onChange={(e) => updateRoomProperty(raum.raum_id, 'farbe', e.target.value)}
                      className="color-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={raum.aktiv}
                        onChange={(e) => updateRoomProperty(raum.raum_id, 'aktiv', e.target.checked)}
                      />
                      Aktiv
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="room-details">
                {raum.beschreibung && (
                  <p className="room-description">{raum.beschreibung}</p>
                )}

                <div className="room-info">
                  {raum.groesse && (
                    <div className="room-info-item">
                      <Square size={14} />
                      <span>{raum.groesse}</span>
                    </div>
                  )}

                  {raum.kapazitaet && (
                    <div className="room-info-item">
                      <Users size={14} />
                      <span>{raum.kapazitaet} Personen</span>
                    </div>
                  )}
                </div>

                {!raum.aktiv && (
                  <div className="room-status inactive">
                    Inaktiv
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {raeume.length === 0 && (
          <div className="empty-state">
            <MapPin size={48} />
            <h3>Keine Räume vorhanden</h3>
            <p>Fügen Sie Ihren ersten Trainingsraum hinzu</p>
            <button
              className="btn-primary"
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