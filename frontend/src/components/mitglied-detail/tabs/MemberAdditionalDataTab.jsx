import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../../../styles/MemberAdditionalDataTab.css';

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
        return { background: 'rgba(255, 215, 0, 0.2)', color: 'var(--primary)' };
      case 'Seminar':
        return { background: 'rgba(59, 130, 246, 0.2)', color: 'var(--info)' };
      case 'Lehrgang':
        return { background: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)' };
      default:
        return { background: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6' };
    }
  };

  return (
    <div className="zusatzdaten-content mad-root">
      {/* Header */}
      <div className="mad-header">
        <h2 className="mad-heading">
          Lehrgänge & Ehrungen
        </h2>
        {editMode && (
          <button
            onClick={openAddModal}
            className="mad-btn-add"
          >
            + Neuer Eintrag
          </button>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="mad-loading">
          Lade Daten...
        </div>
      )}

      {/* Empty State */}
      {!loading && zusatzdaten.length === 0 && (
        <div className="mad-empty">
          <div className="u-emoji-xl">📋</div>
          <p>Noch keine Lehrgänge oder Ehrungen erfasst.</p>
          {editMode && <p className="mad-empty-hint">Klicken Sie auf "Neuer Eintrag" um einen hinzuzufügen.</p>}
        </div>
      )}

      {/* Table */}
      {!loading && zusatzdaten.length > 0 && (
        <div className="mad-table-scroll">
          <table className="mad-table">
            <thead>
              <tr className="mad-thead-row">
                <th className="mad-th-left">Datum</th>
                <th className="mad-th-left">Art</th>
                <th className="mad-th-left">Bezeichnung</th>
                <th className="mad-th-left">Lizenz</th>
                {editMode && <th className="mad-th-center">Aktion</th>}
              </tr>
            </thead>
            <tbody>
              {zusatzdaten.map((item) => {
                const artStyle = getArtStyle(item.art);
                return (
                  <tr key={item.id} className="mad-tr">
                    <td className="mad-td">
                      {new Date(item.datum).toLocaleDateString('de-DE')}
                    </td>
                    <td className="mad-td">
                      <span className="mad-art-badge" style={artStyle}>
                        {item.art}
                      </span>
                    </td>
                    <td className="mad-td">{item.bezeichnung}</td>
                    <td className="mad-td-secondary">
                      {item.lizenz || '-'}
                    </td>
                    {editMode && (
                      <td className="mad-td-center">
                        <button
                          onClick={() => handleDelete(item)}
                          className="mad-btn-delete"
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
        <div className="mad-modal-overlay" onClick={closeModal}>
          <div onClick={e => e.stopPropagation()} className="mad-modal">
            {/* Modal Header */}
            <div className="mad-modal-header">
              <h3 className="mad-modal-title">
                {editingItem ? 'Eintrag bearbeiten' : 'Neuer Eintrag'}
              </h3>
              <button
                onClick={closeModal}
                className="mad-modal-close-btn"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="mad-modal-body">
              <div className="mad-mb-1">
                <label className="u-form-label-secondary">
                  Datum *
                </label>
                <input
                  type="date"
                  value={formData.datum}
                  onChange={(e) => setFormData({ ...formData, datum: e.target.value })}
                  className="mad-form-input"
                />
              </div>

              <div className="mad-mb-1">
                <label className="u-form-label-secondary">
                  Art *
                </label>
                <select
                  value={formData.art}
                  onChange={(e) => setFormData({ ...formData, art: e.target.value })}
                  className="mad-form-input"
                >
                  <option value="Lehrgang">Lehrgang</option>
                  <option value="Seminar">Seminar</option>
                  <option value="Ehrung">Ehrung</option>
                </select>
              </div>

              <div className="mad-mb-1">
                <label className="u-form-label-secondary">
                  Bezeichnung *
                </label>
                <input
                  type="text"
                  value={formData.bezeichnung}
                  onChange={(e) => setFormData({ ...formData, bezeichnung: e.target.value })}
                  placeholder="z.B. Dan-Lehrgang, Trainer C-Lizenz..."
                  className="mad-form-input"
                />
              </div>

              <div className="mad-mb-1">
                <label className="u-form-label-secondary">
                  Lizenz (optional)
                </label>
                <input
                  type="text"
                  value={formData.lizenz}
                  onChange={(e) => setFormData({ ...formData, lizenz: e.target.value })}
                  placeholder="z.B. Trainer C, Übungsleiter B..."
                  className="mad-form-input"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mad-modal-footer">
              <button
                onClick={closeModal}
                className="mad-btn-cancel"
              >
                Abbrechen
              </button>
              <button
                onClick={handleSave}
                className="mad-btn-save"
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
