import React, { useState, useEffect } from "react";
import {
  Percent,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Calendar,
  Users,
  Tag,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/TarifePreise.css"; // Wiederverwendung der bestehenden Styles

const Rabattsystem = () => {
  const { activeDojo } = useDojoContext();
  const [rabatte, setRabatte] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRabatt, setEditingRabatt] = useState(null);
  const [showNewRabatt, setShowNewRabatt] = useState(false);

  const [newRabatt, setNewRabatt] = useState({
    name: "",
    beschreibung: "",
    rabatt_prozent: "",
    gueltig_von: "",
    gueltig_bis: "",
    max_nutzungen: "",
    aktiv: true
  });

  // Ermittle die dojo_id aus dem aktivem Dojo
  const getDojoId = () => {
    if (!activeDojo || activeDojo === 'super-admin') {
      return null;
    }
    return activeDojo.id;
  };

  useEffect(() => {
    loadRabatte();
  }, [activeDojo]);

  const loadRabatte = async () => {
    try {
      setLoading(true);
      const dojoId = getDojoId();
      const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';

      const response = await axios.get(`/tarife/rabatte${dojoParam}`);
      const data = response.data;

      if (data.success) {
        const mappedRabatte = data.data.map(rabatt => ({
          id: rabatt.rabatt_id,
          name: rabatt.name,
          beschreibung: rabatt.beschreibung,
          rabatt_prozent: parseFloat(rabatt.rabatt_prozent),
          gueltig_von: rabatt.gueltig_von,
          gueltig_bis: rabatt.gueltig_bis,
          max_nutzungen: rabatt.max_nutzungen,
          aktiv: rabatt.aktiv === 1,
          genutzt: rabatt.genutzt || 0
        }));
        setRabatte(mappedRabatte);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Rabatte:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRabatt = async (rabattData) => {
    try {
      const dojoId = getDojoId();
      const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';

      let response;
      if (rabattData.id) {
        response = await axios.put(`/tarife/rabatte/${rabattData.id}${dojoParam}`, rabattData);
      } else {
        response = await axios.post(`/tarife/rabatte${dojoParam}`, rabattData);
      }

      if (response.data.success) {
        await loadRabatte();
        setShowNewRabatt(false);
        setEditingRabatt(null);
        setNewRabatt({
          name: "",
          beschreibung: "",
          rabatt_prozent: "",
          gueltig_von: "",
          gueltig_bis: "",
          max_nutzungen: "",
          aktiv: true
        });
      } else {
        alert('Fehler beim Speichern: ' + response.data.error);
      }
    } catch (error) {
      console.error('Fehler beim Speichern des Rabatts:', error);
      alert('Fehler beim Speichern des Rabatts');
    }
  };

  const handleDeleteRabatt = async (rabattId) => {
    if (window.confirm('Sind Sie sicher, dass Sie diesen Rabatt löschen möchten?')) {
      try {
        const dojoId = getDojoId();
        const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
        const response = await axios.delete(`/tarife/rabatte/${rabattId}${dojoParam}`);

        if (response.data.success) {
          await loadRabatte();
        } else {
          alert('Fehler beim Löschen: ' + response.data.error);
        }
      } catch (error) {
        console.error('Fehler beim Löschen des Rabatts:', error);
        alert('Fehler beim Löschen des Rabatts');
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const isRabattActive = (rabatt) => {
    if (!rabatt.aktiv) return false;
    const now = new Date();
    const von = rabatt.gueltig_von ? new Date(rabatt.gueltig_von) : null;
    const bis = rabatt.gueltig_bis ? new Date(rabatt.gueltig_bis) : null;

    if (von && now < von) return false;
    if (bis && now > bis) return false;
    if (rabatt.max_nutzungen && rabatt.genutzt >= rabatt.max_nutzungen) return false;

    return true;
  };

  if (loading) {
    return (
      <div className="tarife-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Rabatt-Daten...</p>
        </div>
      </div>
    );
  }

  const aktiveRabatte = rabatte.filter(r => isRabattActive(r));
  const inaktiveRabatte = rabatte.filter(r => !isRabattActive(r));

  return (
    <div className="tarife-container">
      <div className="tarife-header">
        <h1>🏷️ Rabattsystem</h1>
        <p>Verwalte alle Rabatte und Sonderkonditionen für Mitgliedschaften</p>
      </div>

      {/* Statistik-Übersicht */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">
            <Percent size={32} />
          </div>
          <div className="stat-info">
            <h3>Gesamt Rabatte</h3>
            <p className="stat-value">{rabatte.length}</p>
            <span className="stat-trend">definiert</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <CheckCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>Aktive Rabatte</h3>
            <p className="stat-value">{aktiveRabatte.length}</p>
            <span className="stat-trend">aktuell nutzbar</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">
            <XCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>Inaktive Rabatte</h3>
            <p className="stat-value">{inaktiveRabatte.length}</p>
            <span className="stat-trend">abgelaufen/deaktiviert</span>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">
            <Users size={32} />
          </div>
          <div className="stat-info">
            <h3>Gesamtnutzungen</h3>
            <p className="stat-value">{rabatte.reduce((sum, r) => sum + (r.genutzt || 0), 0)}</p>
            <span className="stat-trend">angewendet</span>
          </div>
        </div>
      </div>

      {/* Aktive Rabatte Sektion */}
      <div className="section">
        <div className="section-header">
          <h2>
            <CheckCircle size={24} /> Aktive Rabatte
            <span className="tarif-count">({aktiveRabatte.length})</span>
          </h2>
          <div className="header-actions">
            <button
              className="btn btn-primary"
              onClick={() => setShowNewRabatt(true)}
            >
              <Plus size={20} />
              Neuer Rabatt
            </button>
          </div>
        </div>

        {aktiveRabatte.length === 0 ? (
          <div className="info-box">
            <p>Keine aktiven Rabatte vorhanden. Erstellen Sie einen neuen Rabatt.</p>
          </div>
        ) : (
          <div className="tarife-grid">
            {aktiveRabatte.map(rabatt => (
              <div key={rabatt.id} className="tarif-card">
                <div className="tarif-header">
                  <div className="tarif-title">
                    <h3>{rabatt.name}</h3>
                    <span className="status-badge active">Aktiv</span>
                  </div>
                  <div className="tarif-actions">
                    <button
                      className="action-btn edit"
                      onClick={() => setEditingRabatt(rabatt)}
                      title="Bearbeiten"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteRabatt(rabatt.id)}
                      title="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="tarif-price">
                  <span className="currency">-</span>{rabatt.rabatt_prozent}
                  <span className="period">%</span>
                </div>

                <div className="tarif-details">
                  {rabatt.beschreibung && (
                    <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                      <span className="label">
                        <Tag size={14} /> Beschreibung
                      </span>
                      <div className="value">{rabatt.beschreibung}</div>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="label">
                      <Calendar size={14} /> Gültig von
                    </span>
                    <div className="value">{formatDate(rabatt.gueltig_von)}</div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Calendar size={14} /> Gültig bis
                    </span>
                    <div className="value">{formatDate(rabatt.gueltig_bis)}</div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Users size={14} /> Nutzungen
                    </span>
                    <div className="value">
                      {rabatt.genutzt || 0}{rabatt.max_nutzungen ? ` / ${rabatt.max_nutzungen}` : ' (unbegrenzt)'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inaktive Rabatte Sektion */}
      {inaktiveRabatte.length > 0 && (
        <div className="section">
          <div
            className="section-header"
            style={{
              background: 'rgba(107, 114, 128, 0.1)',
              borderLeft: '4px solid #6b7280'
            }}
          >
            <h2 style={{ color: '#6b7280' }}>
              <XCircle size={24} /> Inaktive Rabatte
              <span className="tarif-count">({inaktiveRabatte.length})</span>
            </h2>
          </div>

          <div className="tarife-grid">
            {inaktiveRabatte.map(rabatt => (
              <div key={rabatt.id} className="tarif-card" style={{ opacity: 0.7, border: '2px solid #6b7280' }}>
                <div className="tarif-header">
                  <div className="tarif-title">
                    <h3>{rabatt.name}</h3>
                    <span className="status-badge" style={{ background: '#6b7280' }}>
                      Inaktiv
                    </span>
                  </div>
                  <div className="tarif-actions">
                    <button
                      className="action-btn edit"
                      onClick={() => setEditingRabatt(rabatt)}
                      title="Bearbeiten"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteRabatt(rabatt.id)}
                      title="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="tarif-price">
                  <span className="currency">-</span>{rabatt.rabatt_prozent}
                  <span className="period">%</span>
                </div>

                <div className="tarif-details">
                  <div className="detail-item">
                    <span className="label">
                      <Calendar size={14} /> Gültig von
                    </span>
                    <div className="value">{formatDate(rabatt.gueltig_von)}</div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Calendar size={14} /> Gültig bis
                    </span>
                    <div className="value">{formatDate(rabatt.gueltig_bis)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Neuer Rabatt Modal */}
      {showNewRabatt && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Neuer Rabatt</h3>
              <button
                className="close-btn"
                onClick={() => setShowNewRabatt(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={newRabatt.name}
                  onChange={(e) => setNewRabatt({...newRabatt, name: e.target.value})}
                  placeholder="z.B. Familienrabatt, Studentenrabatt"
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                  Beschreibung
                </label>
                <textarea
                  value={newRabatt.beschreibung}
                  onChange={(e) => setNewRabatt({...newRabatt, beschreibung: e.target.value})}
                  placeholder="Beschreibung des Rabatts..."
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Rabatt (%) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newRabatt.rabatt_prozent}
                    onChange={(e) => setNewRabatt({...newRabatt, rabatt_prozent: e.target.value})}
                    placeholder="z.B. 10"
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Max. Nutzungen
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newRabatt.max_nutzungen}
                    onChange={(e) => setNewRabatt({...newRabatt, max_nutzungen: e.target.value})}
                    placeholder="Leer = unbegrenzt"
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Gültig von *
                  </label>
                  <input
                    type="date"
                    value={newRabatt.gueltig_von}
                    onChange={(e) => setNewRabatt({...newRabatt, gueltig_von: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Gültig bis *
                  </label>
                  <input
                    type="date"
                    value={newRabatt.gueltig_bis}
                    onChange={(e) => setNewRabatt({...newRabatt, gueltig_bis: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newRabatt.aktiv}
                    onChange={(e) => setNewRabatt({...newRabatt, aktiv: e.target.checked})}
                  />
                  Rabatt ist aktiv
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowNewRabatt(false)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSaveRabatt(newRabatt)}
                  disabled={!newRabatt.name || !newRabatt.rabatt_prozent || !newRabatt.gueltig_von || !newRabatt.gueltig_bis}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Save size={16} />
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rabatt bearbeiten Modal */}
      {editingRabatt && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3>Rabatt bearbeiten</h3>
              <button
                className="close-btn"
                onClick={() => setEditingRabatt(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                  Name *
                </label>
                <input
                  type="text"
                  value={editingRabatt.name}
                  onChange={(e) => setEditingRabatt({...editingRabatt, name: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                  Beschreibung
                </label>
                <textarea
                  value={editingRabatt.beschreibung || ''}
                  onChange={(e) => setEditingRabatt({...editingRabatt, beschreibung: e.target.value})}
                  rows={3}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Rabatt (%) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editingRabatt.rabatt_prozent}
                    onChange={(e) => setEditingRabatt({...editingRabatt, rabatt_prozent: parseFloat(e.target.value)})}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Max. Nutzungen
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingRabatt.max_nutzungen || ''}
                    onChange={(e) => setEditingRabatt({...editingRabatt, max_nutzungen: e.target.value ? parseInt(e.target.value) : null})}
                    placeholder="Leer = unbegrenzt"
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Gültig von *
                  </label>
                  <input
                    type="date"
                    value={editingRabatt.gueltig_von ? editingRabatt.gueltig_von.split('T')[0] : ''}
                    onChange={(e) => setEditingRabatt({...editingRabatt, gueltig_von: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontSize: '0.875rem', fontWeight: '500' }}>
                    Gültig bis *
                  </label>
                  <input
                    type="date"
                    value={editingRabatt.gueltig_bis ? editingRabatt.gueltig_bis.split('T')[0] : ''}
                    onChange={(e) => setEditingRabatt({...editingRabatt, gueltig_bis: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={editingRabatt.aktiv}
                    onChange={(e) => setEditingRabatt({...editingRabatt, aktiv: e.target.checked})}
                  />
                  Rabatt ist aktiv
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setEditingRabatt(null)}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleSaveRabatt(editingRabatt)}
                  disabled={!editingRabatt.name || !editingRabatt.rabatt_prozent}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <Save size={16} />
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rabattsystem;
