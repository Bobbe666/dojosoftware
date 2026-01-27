import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * MemberAdditionalDataTab - Lehrgänge & Ehrungen verwalten
 *
 * Diese Komponente zeigt und verwaltet Lehrgänge, Seminare und Ehrungen
 * für ein Mitglied.
 *
 * Props:
 * - mitgliedId: Die ID des Mitglieds
 * - dojoId: Die Dojo-ID (für neue Einträge)
 * - editMode: Ob Bearbeitung erlaubt ist (für Admin und eigenes Profil)
 * - onError: Optional - Callback für Fehlerbehandlung
 */
const MemberAdditionalDataTab = ({ mitgliedId, dojoId, editMode, onError }) => {
  // State
  const [zusatzdaten, setZusatzdaten] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    art: 'Lehrgang',
    bezeichnung: '',
    datum: '',
    lizenz: ''
  });
  const [loading, setLoading] = useState(false);

  // Daten laden beim Mounten
  useEffect(() => {
    if (mitgliedId) {
      loadData();
    }
  }, [mitgliedId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/ehrungen-lehrgaenge/mitglied/${mitgliedId}`);
      if (response.data.success) {
        setZusatzdaten(response.data.data || []);
      }
    } catch (err) {
      console.error("Fehler beim Laden der Zusatzdaten:", err);
      onError?.("Fehler beim Laden der Zusatzdaten");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingItem) {
        await axios.put(`/ehrungen-lehrgaenge/${editingItem.id}`, formData);
      } else {
        await axios.post("/ehrungen-lehrgaenge", {
          ...formData,
          mitglied_id: mitgliedId,
          dojo_id: dojoId
        });
      }
      // Daten neu laden
      await loadData();
      closeModal();
    } catch (err) {
      console.error("Fehler beim Speichern:", err);
      const errorMsg = "Fehler beim Speichern: " + (err.response?.data?.error || err.message);
      alert(errorMsg);
      onError?.(errorMsg);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`"${item.bezeichnung}" wirklich löschen?`)) return;
    try {
      await axios.delete(`/ehrungen-lehrgaenge/${item.id}`);
      setZusatzdaten(zusatzdaten.filter(z => z.id !== item.id));
    } catch (err) {
      console.error("Fehler beim Löschen:", err);
      const errorMsg = "Fehler beim Löschen: " + (err.response?.data?.error || err.message);
      alert(errorMsg);
      onError?.(errorMsg);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ art: 'Lehrgang', bezeichnung: '', datum: '', lizenz: '' });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({ art: 'Lehrgang', bezeichnung: '', datum: '', lizenz: '' });
  };

  // Art-Badge Farben
  const getArtStyle = (art) => {
    switch (art) {
      case 'Ehrung':
        return { background: 'rgba(255, 215, 0, 0.2)', color: '#FFD700' };
      case 'Seminar':
        return { background: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' };
      case 'Lehrgang':
        return { background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
      default:
        return { background: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6' };
    }
  };

  return (
    <div className="zusatzdaten-content" style={{ padding: '1rem' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        paddingBottom: '1rem',
        borderBottom: '2px solid rgba(255, 215, 0, 0.2)'
      }}>
        <h2 style={{ margin: 0, color: '#FFD700', fontSize: '1.5rem', fontWeight: '700' }}>
          Lehrgänge & Ehrungen
        </h2>
        {editMode && (
          <button
            onClick={openAddModal}
            style={{
              padding: '0.6rem 1.2rem',
              background: 'linear-gradient(135deg, #FFD700, #FFA500)',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontWeight: '600',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            + Neuer Eintrag
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255, 255, 255, 0.6)' }}>
          Lade Daten...
        </div>
      )}

      {/* Empty State */}
      {!loading && zusatzdaten.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: 'rgba(255, 255, 255, 0.6)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          <p>Noch keine Lehrgänge oder Ehrungen erfasst.</p>
          {editMode && <p style={{ fontSize: '0.9rem' }}>Klicken Sie auf "Neuer Eintrag" um einen hinzuzufügen.</p>}
        </div>
      )}

      {/* Table */}
      {!loading && zusatzdaten.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid rgba(255, 215, 0, 0.3)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: '#FFD700' }}>Datum</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: '#FFD700' }}>Art</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: '#FFD700' }}>Bezeichnung</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: '#FFD700' }}>Lizenz</th>
                {editMode && <th style={{ padding: '0.75rem', textAlign: 'center', color: '#FFD700' }}>Aktion</th>}
              </tr>
            </thead>
            <tbody>
              {zusatzdaten.map((item) => {
                const artStyle = getArtStyle(item.art);
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <td style={{ padding: '0.75rem' }}>
                      {new Date(item.datum).toLocaleDateString('de-DE')}
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        ...artStyle
                      }}>
                        {item.art}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{item.bezeichnung}</td>
                    <td style={{ padding: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                      {item.lizenz || '-'}
                    </td>
                    {editMode && (
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDelete(item)}
                          style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid #ef4444',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            color: '#ef4444',
                            cursor: 'pointer',
                            fontSize: '0.8rem'
                          }}
                        >
                          Löschen
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }} onClick={closeModal}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)',
            borderRadius: '16px',
            width: '90%',
            maxWidth: '450px',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem 1.5rem',
              borderBottom: '1px solid rgba(255, 215, 0, 0.2)'
            }}>
              <h3 style={{ color: '#FFD700', margin: 0 }}>
                {editingItem ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
              </h3>
              <button
                onClick={closeModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '1.5rem'
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.8)' }}>
                  Datum *
                </label>
                <input
                  type="date"
                  value={formData.datum}
                  onChange={(e) => setFormData({ ...formData, datum: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.8)' }}>
                  Art *
                </label>
                <select
                  value={formData.art}
                  onChange={(e) => setFormData({ ...formData, art: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                >
                  <option value="Lehrgang">Lehrgang</option>
                  <option value="Seminar">Seminar</option>
                  <option value="Ehrung">Ehrung</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.8)' }}>
                  Bezeichnung *
                </label>
                <input
                  type="text"
                  value={formData.bezeichnung}
                  onChange={(e) => setFormData({ ...formData, bezeichnung: e.target.value })}
                  placeholder="z.B. Dan-Lehrgang, Trainer C-Lizenz..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.8)' }}>
                  Lizenz (optional)
                </label>
                <input
                  type="text"
                  value={formData.lizenz}
                  onChange={(e) => setFormData({ ...formData, lizenz: e.target.value })}
                  placeholder="z.B. Trainer C, Übungsleiter B..."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#1a1a1a',
                    border: '1px solid rgba(255, 215, 0, 0.3)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'flex-end',
              padding: '1rem 1.5rem',
              borderTop: '1px solid rgba(255, 215, 0, 0.2)'
            }}>
              <button
                onClick={closeModal}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#000',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MemberAdditionalDataTab;
