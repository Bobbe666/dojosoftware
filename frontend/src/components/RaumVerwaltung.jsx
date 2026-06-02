// Frontend/src/components/RaumVerwaltung.jsx - Raumverwaltung für Dojo-Einstellungen
import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, Save, X, Users, BookOpen } from 'lucide-react';
import config from '../config/config.js';
import '../styles/RaumVerwaltung.css';
import { fetchWithAuth } from '../utils/fetchWithAuth';


const RaumVerwaltung = () => {
  const [raeume, setRaeume] = useState([]);
  const [kurseByRaum, setKurseByRaum] = useState({});
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

  const loadRaeume = async () => {
    try {
      setLoading(true);
      const [raumRes, kursRes] = await Promise.all([
        fetchWithAuth(`${config.apiBaseUrl}/raeume`),
        fetchWithAuth(`${config.apiBaseUrl}/kurse`)
      ]);
      const raumData = await raumRes.json();
      const kursData = await kursRes.json();

      if (raumData.success) {
        setRaeume(raumData.data);
      }

      // Build map: raum_id → [kurse]
      const kurse = Array.isArray(kursData) ? kursData : (kursData.data || []);
      const byRaum = {};
      kurse.forEach(k => {
        if (k.raum_id) {
          if (!byRaum[k.raum_id]) byRaum[k.raum_id] = [];
          byRaum[k.raum_id].push(k);
        }
      });
      setKurseByRaum(byRaum);
    } catch (error) {
      console.error('Fehler beim Laden der Räume:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRaeume();
  }, []);

  const handleAddRoom = async () => {
    if (!newRoom.name.trim()) {
      alert('Bitte geben Sie einen Raumnamen ein');
      return;
    }
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/raeume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRoom)
      });
      const result = await response.json();
      if (result.success) {
        setNewRoom({ name: '', beschreibung: '', groesse: '', kapazitaet: '', farbe: '#4F46E5', aktiv: true });
        setShowAddForm(false);
        loadRaeume();
      } else {
        alert('Fehler beim Hinzufügen des Raums: ' + result.error);
      }
    } catch (error) {
      console.error(error);
      alert('Fehler beim Hinzufügen des Raums');
    }
  };

  const handleEditRoom = async (raum) => {
    if (!raum.name.trim()) {
      alert('Bitte geben Sie einen Raumnamen ein');
      return;
    }
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/raeume/${raum.raum_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
      console.error(error);
      alert('Fehler beim Speichern des Raums');
    }
  };

  const handleDeleteRoom = async (raumId, raumName) => {
    if (!confirm(`Möchten Sie den Raum "${raumName}" wirklich löschen?`)) return;
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/raeume/${raumId}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        loadRaeume();
      } else {
        alert('Fehler beim Löschen des Raums: ' + (result.details || result.error));
      }
    } catch (error) {
      console.error(error);
      alert('Fehler beim Löschen des Raums');
    }
  };

  const updateRoomProperty = (raumId, property, value) => {
    setRaeume(raeume.map(raum => raum.raum_id === raumId ? { ...raum, [property]: value } : raum));
  };

  if (loading) {
    return (
      <div className="rv-loading">
        <div className="rv-spinner"></div>
        <p>Räume werden geladen...</p>
      </div>
    );
  }

  return (
    <div className="raum-verwaltung">

      {/* Header row — styled like other DojoEdit sections */}
      <div className="rv-header-row">
        <div>
          <h3 className="rv-title">Trainingsräume</h3>
          <p className="rv-subtitle">Verwalten Sie die Räume Ihres Dojos</p>
        </div>
        <button className="rv-btn-add" onClick={() => setShowAddForm(true)} disabled={showAddForm}>
          <Plus size={15} />
          Raum hinzufügen
        </button>
      </div>

      {/* Add-form */}
      {showAddForm && (
        <div className="rv-form-card">
          <div className="rv-form-head">
            <span>Neuen Raum hinzufügen</span>
            <button className="rv-btn-icon" onClick={() => setShowAddForm(false)}><X size={15} /></button>
          </div>
          <div className="rv-form-grid">
            <div className="rv-field">
              <label>Raumname *</label>
              <input type="text" value={newRoom.name}
                onChange={(e) => setNewRoom({...newRoom, name: e.target.value})}
                placeholder="z.B. Hauptraum, Nebenraum…" className="rv-input" />
            </div>
            <div className="rv-field">
              <label>Beschreibung</label>
              <input type="text" value={newRoom.beschreibung}
                onChange={(e) => setNewRoom({...newRoom, beschreibung: e.target.value})}
                placeholder="Kurze Beschreibung" className="rv-input" />
            </div>
            <div className="rv-field">
              <label>Größe</label>
              <input type="text" value={newRoom.groesse}
                onChange={(e) => setNewRoom({...newRoom, groesse: e.target.value})}
                placeholder="z.B. 120 m²" className="rv-input" />
            </div>
            <div className="rv-field">
              <label>Kapazität (Personen)</label>
              <input type="number" value={newRoom.kapazitaet} min="1"
                onChange={(e) => setNewRoom({...newRoom, kapazitaet: e.target.value})}
                placeholder="Max. Anzahl" className="rv-input" />
            </div>
            <div className="rv-field">
              <label>Farbe</label>
              <div className="rv-color-row">
                <input type="color" value={newRoom.farbe}
                  onChange={(e) => setNewRoom({...newRoom, farbe: e.target.value})}
                  className="rv-color-picker" />
                <span className="rv-color-hex">{newRoom.farbe}</span>
              </div>
            </div>
            <div className="rv-field rv-field-check">
              <label className="rv-checkbox-label">
                <input type="checkbox" checked={newRoom.aktiv}
                  onChange={(e) => setNewRoom({...newRoom, aktiv: e.target.checked})} />
                Raum ist aktiv
              </label>
            </div>
          </div>
          <div className="rv-form-foot">
            <button className="rv-btn-secondary" onClick={() => setShowAddForm(false)}>Abbrechen</button>
            <button className="rv-btn-primary" onClick={handleAddRoom}>
              <Save size={15} /> Raum speichern
            </button>
          </div>
        </div>
      )}

      {/* Rooms grid */}
      {raeume.length === 0 ? (
        <div className="rv-empty">
          <BookOpen size={40} />
          <p>Noch keine Räume vorhanden</p>
          <button className="rv-btn-primary" onClick={() => setShowAddForm(true)}>
            <Plus size={15} /> Ersten Raum hinzufügen
          </button>
        </div>
      ) : (
        <div className="rv-grid">
          {raeume.map((raum) => {
            const kurse = kurseByRaum[raum.raum_id] || kurseByRaum[raum.id] || [];
            const isEditing = editingId === raum.raum_id;
            return (
              <div key={raum.raum_id}
                className={`rv-card${!raum.aktiv ? ' rv-card--inactive' : ''}${isEditing ? ' rv-card--editing' : ''}`}>

                {/* Card header */}
                <div className="rv-card-head">
                  <div className="rv-color-dot" style={{ background: raum.farbe || '#4F46E5' }}></div>
                  {isEditing ? (
                    <input type="text" value={raum.name}
                      onChange={(e) => updateRoomProperty(raum.raum_id, 'name', e.target.value)}
                      className="rv-name-input" />
                  ) : (
                    <span className="rv-card-name">{raum.name}</span>
                  )}
                  {!raum.aktiv && !isEditing && <span className="rv-badge rv-badge--inactive">Inaktiv</span>}
                  <div className="rv-card-actions">
                    {isEditing ? (
                      <>
                        <button className="rv-btn-icon rv-btn-icon--save" onClick={() => handleEditRoom(raum)}><Save size={14} /></button>
                        <button className="rv-btn-icon" onClick={() => setEditingId(null)}><X size={14} /></button>
                      </>
                    ) : (
                      <>
                        <button className="rv-btn-icon" title="Bearbeiten" onClick={() => setEditingId(raum.raum_id)}><Edit3 size={14} /></button>
                        <button className="rv-btn-icon rv-btn-icon--danger" title="Löschen"
                          onClick={() => handleDeleteRoom(raum.raum_id, raum.name)}><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </div>

                {/* Edit form */}
                {isEditing ? (
                  <div className="rv-edit-body">
                    <div className="rv-field">
                      <label>Beschreibung</label>
                      <input type="text" value={raum.beschreibung || ''}
                        onChange={(e) => updateRoomProperty(raum.raum_id, 'beschreibung', e.target.value)}
                        className="rv-input" />
                    </div>
                    <div className="rv-edit-row">
                      <div className="rv-field">
                        <label>Größe</label>
                        <input type="text" value={raum.groesse || ''}
                          onChange={(e) => updateRoomProperty(raum.raum_id, 'groesse', e.target.value)}
                          className="rv-input" />
                      </div>
                      <div className="rv-field">
                        <label>Kapazität</label>
                        <input type="number" value={raum.kapazitaet || ''} min="1"
                          onChange={(e) => updateRoomProperty(raum.raum_id, 'kapazitaet', e.target.value)}
                          className="rv-input" />
                      </div>
                    </div>
                    <div className="rv-edit-row">
                      <div className="rv-field">
                        <label>Farbe</label>
                        <input type="color" value={raum.farbe || '#4F46E5'}
                          onChange={(e) => updateRoomProperty(raum.raum_id, 'farbe', e.target.value)}
                          className="rv-color-picker" />
                      </div>
                      <div className="rv-field rv-field-check">
                        <label className="rv-checkbox-label">
                          <input type="checkbox" checked={!!raum.aktiv}
                            onChange={(e) => updateRoomProperty(raum.raum_id, 'aktiv', e.target.checked)} />
                          Aktiv
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rv-card-body">
                    {raum.beschreibung && <p className="rv-desc">{raum.beschreibung}</p>}
                    <div className="rv-meta">
                      {raum.kapazitaet && (
                        <span className="rv-meta-item">
                          <Users size={12} /> {raum.kapazitaet} Personen
                        </span>
                      )}
                      {raum.groesse && (
                        <span className="rv-meta-item rv-meta-item--size">
                          {raum.groesse}
                        </span>
                      )}
                    </div>
                    {/* Kurse in diesem Raum */}
                    <div className="rv-kurse">
                      <span className="rv-kurse-label">
                        <BookOpen size={12} />
                        {kurse.length === 0
                          ? 'Keine Kurse zugewiesen'
                          : `${kurse.length} Kurs${kurse.length !== 1 ? 'e' : ''}`}
                      </span>
                      {kurse.length > 0 && (
                        <div className="rv-kurse-list">
                          {kurse.slice(0, 4).map(k => (
                            <span key={k.kurs_id} className="rv-kurs-chip">
                              {k.stil || k.gruppenname || k.name || 'Kurs'}
                              {k.gruppenname && <span style={{ display: 'block', fontSize: '0.72em', opacity: 0.65, fontWeight: 400 }}>{k.gruppenname}</span>}
                            </span>
                          ))}
                          {kurse.length > 4 && <span className="rv-kurs-chip rv-kurs-chip--more">+{kurse.length - 4}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RaumVerwaltung;
