import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Calendar, 
  Plus, 
  Edit, 
  Trash2, 
  Check, 
  X, 
  Clock,
  RefreshCw,
  Save,
  ArrowLeft,
  Settings
} from "lucide-react";
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/ZahlungszyklenSeite.css";

const ZahlungszyklenSeite = () => {
  const navigate = useNavigate();
  const [zahlungszyklen, setZahlungszyklen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [newZyklus, setNewZyklus] = useState({
    name: '',
    intervall_tage: '',
    beschreibung: '',
    aktiv: true
  });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadZahlungszyklen();
  }, []);

  const loadZahlungszyklen = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.apiBaseUrl}/zahlungszyklen`);
      
      if (!response.ok) {
        throw new Error('Fehler beim Laden der Zahlungszyklen');
      }
      
      const data = await response.json();
      setZahlungszyklen(data.data || data || []);
      setError('');
    } catch (err) {
      console.error('Fehler beim Laden der Zahlungszyklen:', err);
      setError('Fehler beim Laden der Zahlungszyklen: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveZyklus = async (zyklus) => {
    try {
      const method = zyklus.zyklus_id ? 'PUT' : 'POST';
      const url = zyklus.zyklus_id
        ? `${config.apiBaseUrl}/zahlungszyklen/${zyklus.zyklus_id}`
        : `${config.apiBaseUrl}/zahlungszyklen`;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(zyklus),
      });

      if (!response.ok) {
        throw new Error('Fehler beim Speichern des Zahlungszyklus');
      }

      setSuccess(zyklus.zyklus_id ? 'Zahlungszyklus aktualisiert!' : 'Zahlungszyklus erstellt!');
      setError('');
      loadZahlungszyklen();
      setEditingId(null);
      setShowAddForm(false);
      setNewZyklus({ name: '', intervall_tage: '', beschreibung: '', aktiv: true });

      // Success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError('Fehler beim Speichern: ' + err.message);
    }
  };

  const handleDeleteZyklus = async (id) => {
    if (!confirm('Möchten Sie diesen Zahlungszyklus wirklich löschen?')) {
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/zahlungszyklen/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Fehler beim Löschen des Zahlungszyklus');
      }

      setSuccess('Zahlungszyklus gelöscht!');
      setError('');
      loadZahlungszyklen();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      setError('Fehler beim Löschen: ' + err.message);
    }
  };

  const handleEdit = (zyklus) => {
    setEditingId(zyklus.zyklus_id);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = (id, updatedData) => {
    const zyklus = zahlungszyklen.find(z => z.zyklus_id === id);
    handleSaveZyklus({ ...zyklus, ...updatedData });
  };

  const formatIntervall = (tage) => {
    if (tage === 1) return "Täglich";
    if (tage === 7) return "Wöchentlich";
    if (tage === 14) return "14-tägig";
    if (tage === 30) return "Monatlich";
    if (tage === 60) return "Alle 2 Monate";
    if (tage === 90 || tage === 91) return "Vierteljährlich";
    if (tage === 180) return "Halbjährlich";
    if (tage === 365) return "Jährlich";
    return `Alle ${tage} Tage`;
  };

  return (
    <div className="zahlungszyklen-seite">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <button 
            className="btn btn-secondary"
            onClick={() => navigate('/dashboard/beitraege')}
          >
            <ArrowLeft size={16} />
            Zurück zur Beitragsverwaltung
          </button>
          <div className="header-title">
            <Calendar size={32} />
            <div>
              <h1>Zahlungszyklen Verwaltung</h1>
              <p>Verwalten Sie Zahlungsintervalle für Mitgliedsbeiträge</p>
            </div>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            className="btn btn-primary"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            <Plus size={16} />
            Neuer Zahlungszyklus
          </button>
          <button 
            className="btn btn-secondary"
            onClick={loadZahlungszyklen}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="error-message">
          <X size={20} />
          {error}
        </div>
      )}

      {success && (
        <div className="message success">
          <Check size={20} />
          {success}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="standard-card add-form-card">
          <div className="card-header">
            <h3>Neuen Zahlungszyklus hinzufügen</h3>
            <button 
              className="btn btn-ghost btn-small"
              onClick={() => {
                setShowAddForm(false);
                setNewZyklus({ name: '', intervall_tage: '', beschreibung: '', aktiv: true });
              }}
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="input-container">
            <div className="form-row">
              <div className="input-group">
                <label className="input-label">Name</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="z.B. Monatlich"
                  value={newZyklus.name}
                  onChange={(e) => setNewZyklus({...newZyklus, name: e.target.value})}
                />
              </div>
              <div className="input-group">
                <label className="input-label">Intervall (Tage)</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="z.B. 30"
                  value={newZyklus.intervall_tage}
                  onChange={(e) => setNewZyklus({...newZyklus, intervall_tage: parseInt(e.target.value) || ''})}
                />
              </div>
            </div>
            
            <div className="input-group">
              <label className="input-label">Beschreibung</label>
              <input
                type="text"
                className="input-field"
                placeholder="Beschreibung des Zahlungszyklus"
                value={newZyklus.beschreibung}
                onChange={(e) => setNewZyklus({...newZyklus, beschreibung: e.target.value})}
              />
            </div>
            
            <div className="input-group checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={newZyklus.aktiv}
                  onChange={(e) => setNewZyklus({...newZyklus, aktiv: e.target.checked})}
                />
                <span className="checkmark"></span>
                Aktiv
              </label>
            </div>
            
            <div className="form-actions">
              <button
                className="btn btn-primary"
                onClick={() => handleSaveZyklus(newZyklus)}
                disabled={!newZyklus.name || !newZyklus.intervall_tage}
              >
                <Save size={16} />
                Speichern
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowAddForm(false);
                  setNewZyklus({ name: '', intervall_tage: '', beschreibung: '', aktiv: true });
                }}
              >
                <X size={16} />
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="zahlungszyklen-content">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner-large"></div>
            <p>Lade Zahlungszyklen...</p>
          </div>
        ) : (
          <>
            {/* Statistics */}
            <div className="zzs-stats-grid">
              <div className="zzs-stat-card">
                <div className="zzs-stat-icon">
                  <Calendar size={18} />
                </div>
                <div className="u-flex-1-min0">
                  <h3 className="zzs-stat-label">Gesamt Zyklen</h3>
                  <p className="zzs-stat-value">{zahlungszyklen.length}</p>
                </div>
              </div>
              <div className="zzs-stat-card">
                <div className="zzs-stat-icon">
                  <Check size={18} />
                </div>
                <div className="u-flex-1-min0">
                  <h3 className="zzs-stat-label">Aktive Zyklen</h3>
                  <p className="zzs-stat-value">{zahlungszyklen.filter(z => z.aktiv).length}</p>
                </div>
              </div>
              <div className="zzs-stat-card">
                <div className="zzs-stat-icon">
                  <Clock size={18} />
                </div>
                <div className="u-flex-1-min0">
                  <h3 className="zzs-stat-label">Kürzester Zyklus</h3>
                  <p className="zzs-stat-value">
                    {zahlungszyklen.length > 0
                      ? `${Math.min(...zahlungszyklen.map(z => z.intervall_tage))} Tage`
                      : '0 Tage'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Zahlungszyklen Grid */}
            <div className="zahlungszyklen-grid">
              {zahlungszyklen.map((zyklus) => (
                <div 
                  key={zyklus.zyklus_id} 
                  className={`zyklus-card ${!zyklus.aktiv ? 'inactive' : ''}`}
                >
                  {editingId === zyklus.zyklus_id ? (
                    <ZyklusEditForm
                      zyklus={zyklus}
                      onSave={handleSaveEdit}
                      onCancel={handleCancelEdit}
                    />
                  ) : (
                    <ZyklusDisplayCard
                      zyklus={zyklus}
                      formatIntervall={formatIntervall}
                      onEdit={handleEdit}
                      onDelete={handleDeleteZyklus}
                    />
                  )}
                </div>
              ))}
            </div>

            {zahlungszyklen.length === 0 && (
              <div className="empty-state">
                <Clock size={48} />
                <h3>Keine Zahlungszyklen vorhanden</h3>
                <p>Erstellen Sie Ihren ersten Zahlungszyklus mit dem Button oben.</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus size={16} />
                  Ersten Zyklus erstellen
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// Separate component for editing
const ZyklusEditForm = ({ zyklus, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    name: zyklus.name,
    intervall_tage: zyklus.intervall_tage,
    beschreibung: zyklus.beschreibung,
    aktiv: zyklus.aktiv
  });

  const handleSubmit = () => {
    onSave(zyklus.zyklus_id, formData);
  };

  return (
    <>
      <div className="card-header">
        <h3>Bearbeiten</h3>
      </div>
      
      <div className="edit-form">
        <div className="input-container">
          <div className="form-row">
            <div className="input-group">
              <label className="input-label">Name</label>
              <input
                type="text"
                className="input-field"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="input-group">
              <label className="input-label">Intervall (Tage)</label>
              <input
                type="number"
                className="input-field"
                value={formData.intervall_tage}
                onChange={(e) => setFormData({...formData, intervall_tage: parseInt(e.target.value) || ''})}
              />
            </div>
          </div>
          
          <div className="input-group">
            <label className="input-label">Beschreibung</label>
            <input
              type="text"
              className="input-field"
              value={formData.beschreibung}
              onChange={(e) => setFormData({...formData, beschreibung: e.target.value})}
            />
          </div>
          
          <div className="input-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.aktiv}
                onChange={(e) => setFormData({...formData, aktiv: e.target.checked})}
              />
              <span className="checkmark"></span>
              Aktiv
            </label>
          </div>
          
          <div className="card-actions">
            <button
              className="btn btn-primary btn-small"
              onClick={handleSubmit}
              disabled={!formData.name || !formData.intervall_tage}
            >
              <Check size={16} />
              Speichern
            </button>
            <button
              className="btn btn-secondary btn-small"
              onClick={onCancel}
            >
              <X size={16} />
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// Separate component for display
const ZyklusDisplayCard = ({ zyklus, formatIntervall, onEdit, onDelete }) => {
  return (
    <>
      <div className="card-header">
        <h3>{zyklus.name}</h3>
        <div className={`status-badge ${zyklus.aktiv ? 'active' : 'inactive'}`}>
          {zyklus.aktiv ? 'Aktiv' : 'Inaktiv'}
        </div>
      </div>
      
      <div className="card-content">
        <div className="zyklus-info">
          <div className="zzs-info-row">
            <Clock size={16} className="zzs-icon-primary" />
            <span className="zzs-value-primary">{formatIntervall(zyklus.intervall_tage)}</span>
          </div>
          <div className="zzs-info-row">
            <Calendar size={16} className="zzs-icon-primary" />
            <span>Alle {zyklus.intervall_tage} Tage</span>
          </div>
          {zyklus.beschreibung && (
            <div className="zzs-info-row--desc">
              <span>{zyklus.beschreibung}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card-actions">
        <button
          className="btn btn-secondary btn-small"
          onClick={() => onEdit(zyklus)}
        >
          <Edit size={16} />
          Bearbeiten
        </button>
        <button
          className="btn btn-danger btn-small"
          onClick={() => onDelete(zyklus.zyklus_id)}
        >
          <Trash2 size={16} />
          Löschen
        </button>
      </div>
    </>
  );
};

export default ZahlungszyklenSeite;