import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { MapPin, Building2, Clock, Users, Phone, Mail, Edit2, Trash2, Plus, X, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { useStandortContext } from '../context/StandortContext.jsx';
import { DatenContext } from '@shared/DatenContext.jsx';
import '../styles/StandortVerwaltung.css';

const StandortVerwaltung = () => {
  const { standorte, loadStandorte } = useStandortContext();
  const { trainer } = useContext(DatenContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingStandort, setEditingStandort] = useState(null);
  const [expandedStandort, setExpandedStandort] = useState(null);
  const [stats, setStats] = useState({});
  const [activeModalTab, setActiveModalTab] = useState('basis');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    ist_hauptstandort: false,
    farbe: '#4F46E5',
    strasse: '',
    hausnummer: '',
    plz: '',
    ort: '',
    land: 'Deutschland',
    telefon: '',
    email: '',
    notizen: '',
    ist_aktiv: true,
    sortierung: 0,
    oeffnungszeiten: {
      regular: {
        monday: { open: '09:00', close: '21:00', closed: false },
        tuesday: { open: '09:00', close: '21:00', closed: false },
        wednesday: { open: '09:00', close: '21:00', closed: false },
        thursday: { open: '09:00', close: '21:00', closed: false },
        friday: { open: '09:00', close: '21:00', closed: false },
        saturday: { open: '10:00', close: '18:00', closed: false },
        sunday: { closed: true }
      },
      exceptions: [],
      vacation: null
    }
  });

  const wochentage = {
    monday: 'Montag',
    tuesday: 'Dienstag',
    wednesday: 'Mittwoch',
    thursday: 'Donnerstag',
    friday: 'Freitag',
    saturday: 'Samstag',
    sunday: 'Sonntag'
  };

  useEffect(() => {
    loadStats();
  }, [standorte]);

  const loadStats = async () => {
    try {
      const statsData = {};
      for (const standort of standorte) {
        const res = await axios.get(`/standorte/${standort.standort_id}/stats`);
        statsData[standort.standort_id] = res.data.data;
      }
      setStats(statsData);
    } catch (err) {
      console.error('Fehler beim Laden der Statistiken:', err);
    }
  };

  const handleOpenModal = (standort = null) => {
    if (standort) {
      // Edit mode
      setEditingStandort(standort);
      setFormData({
        name: standort.name || '',
        ist_hauptstandort: standort.ist_hauptstandort || false,
        farbe: standort.farbe || '#4F46E5',
        strasse: standort.strasse || '',
        hausnummer: standort.hausnummer || '',
        plz: standort.plz || '',
        ort: standort.ort || '',
        land: standort.land || 'Deutschland',
        telefon: standort.telefon || '',
        email: standort.email || '',
        notizen: standort.notizen || '',
        ist_aktiv: standort.ist_aktiv !== false,
        sortierung: standort.sortierung || 0,
        oeffnungszeiten: standort.oeffnungszeiten ?
          (typeof standort.oeffnungszeiten === 'string' ? JSON.parse(standort.oeffnungszeiten) : standort.oeffnungszeiten) :
          formData.oeffnungszeiten
      });
    } else {
      // Add mode
      setEditingStandort(null);
      setFormData({
        name: '',
        ist_hauptstandort: false,
        farbe: '#4F46E5',
        strasse: '',
        hausnummer: '',
        plz: '',
        ort: '',
        land: 'Deutschland',
        telefon: '',
        email: '',
        notizen: '',
        ist_aktiv: true,
        sortierung: standorte.length,
        oeffnungszeiten: {
          regular: {
            monday: { open: '09:00', close: '21:00', closed: false },
            tuesday: { open: '09:00', close: '21:00', closed: false },
            wednesday: { open: '09:00', close: '21:00', closed: false },
            thursday: { open: '09:00', close: '21:00', closed: false },
            friday: { open: '09:00', close: '21:00', closed: false },
            saturday: { open: '10:00', close: '18:00', closed: false },
            sunday: { closed: true }
          },
          exceptions: [],
          vacation: null
        }
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingStandort(null);
    setError('');
    setActiveModalTab('basis');
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Bitte geben Sie einen Namen ein.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        ...formData,
        oeffnungszeiten: JSON.stringify(formData.oeffnungszeiten)
      };

      if (editingStandort) {
        // Update
        await axios.put(`/standorte/${editingStandort.standort_id}`, payload);
        alert('Standort erfolgreich aktualisiert!');
      } else {
        // Create
        await axios.post('/standorte', payload);
        alert('Standort erfolgreich erstellt!');
      }

      await loadStandorte();
      await loadStats();
      handleCloseModal();
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern des Standorts');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (standortId) => {
    if (!window.confirm('Möchten Sie diesen Standort wirklich löschen?')) return;

    setLoading(true);
    try {
      await axios.delete(`/standorte/${standortId}`);
      alert('Standort erfolgreich gelöscht!');
      await loadStandorte();
      await loadStats();
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      alert(err.response?.data?.error || 'Fehler beim Löschen des Standorts');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (standort) => {
    try {
      await axios.put(`/standorte/${standort.standort_id}`, {
        ...standort,
        ist_aktiv: !standort.ist_aktiv,
        oeffnungszeiten: typeof standort.oeffnungszeiten === 'string' ?
          standort.oeffnungszeiten :
          JSON.stringify(standort.oeffnungszeiten || formData.oeffnungszeiten)
      });
      await loadStandorte();
      await loadStats();
    } catch (err) {
      console.error('Fehler beim Aktivieren/Deaktivieren:', err);
      alert('Fehler beim Ändern des Status');
    }
  };

  const updateOeffnungszeit = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      oeffnungszeiten: {
        ...prev.oeffnungszeiten,
        regular: {
          ...prev.oeffnungszeiten.regular,
          [day]: {
            ...prev.oeffnungszeiten.regular[day],
            [field]: value
          }
        }
      }
    }));
  };

  const toggleExpanded = (standortId) => {
    setExpandedStandort(expandedStandort === standortId ? null : standortId);
  };

  const formatOeffnungszeiten = (oeffnungszeiten) => {
    if (!oeffnungszeiten) return 'Keine Öffnungszeiten';

    const data = typeof oeffnungszeiten === 'string' ? JSON.parse(oeffnungszeiten) : oeffnungszeiten;
    if (!data.regular) return 'Keine Öffnungszeiten';

    const days = Object.entries(data.regular)
      .filter(([_, info]) => !info.closed)
      .map(([day, info]) => `${wochentage[day]}: ${info.open}-${info.close}`);

    return days.length > 0 ? days.slice(0, 2).join(', ') + (days.length > 2 ? '...' : '') : 'Geschlossen';
  };

  return (
    <div className="standortverwaltung-container">
      <div className="standortverwaltung-header">
        <div className="header-left">
          <h2>📍 Standort-Verwaltung</h2>
          <p className="subtitle">Verwalten Sie alle Standorte Ihres Dojos</p>
        </div>
        <button className="btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} />
          <span>Neuer Standort</span>
        </button>
      </div>

      {/* Statistiken Overview */}
      <div className="stats-grid">
        <div className="stat-card-large">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
            <Building2 size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{standorte.length}</div>
            <div className="stat-label">Standorte gesamt</div>
          </div>
        </div>
        <div className="stat-card-large">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}>
            <MapPin size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{standorte.filter(s => s.ist_aktiv).length}</div>
            <div className="stat-label">Aktive Standorte</div>
          </div>
        </div>
        <div className="stat-card-large">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}>
            <Users size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">
              {Object.values(stats).reduce((sum, s) => sum + (s?.anzahl_kurse || 0), 0)}
            </div>
            <div className="stat-label">Kurse gesamt</div>
          </div>
        </div>
      </div>

      {/* Standort Cards */}
      <div className="standorte-grid">
        {standorte
          .sort((a, b) => {
            if (a.ist_hauptstandort && !b.ist_hauptstandort) return -1;
            if (!a.ist_hauptstandort && b.ist_hauptstandort) return 1;
            return (a.sortierung || 0) - (b.sortierung || 0);
          })
          .map((standort) => (
            <div
              key={standort.standort_id}
              className={`standort-card ${!standort.ist_aktiv ? 'inactive' : ''} ${
                expandedStandort === standort.standort_id ? 'expanded' : ''
              }`}
            >
              {/* Card Header */}
              <div className="standort-card-header">
                <div className="header-left-section">
                  <div
                    className="color-indicator"
                    style={{ background: standort.farbe || '#4F46E5' }}
                  />
                  <div className="standort-info">
                    <h3>{standort.name}</h3>
                    <div className="badges">
                      {standort.ist_hauptstandort && (
                        <span className="badge badge-haupt">Hauptstandort</span>
                      )}
                      {!standort.ist_aktiv && (
                        <span className="badge badge-inactive">Inaktiv</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="header-actions">
                  <button
                    className="btn-icon"
                    onClick={() => toggleExpanded(standort.standort_id)}
                    title={expandedStandort === standort.standort_id ? 'Weniger anzeigen' : 'Mehr anzeigen'}
                  >
                    {expandedStandort === standort.standort_id ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                  <button
                    className="btn-icon btn-edit"
                    onClick={() => handleOpenModal(standort)}
                    title="Bearbeiten"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    className="btn-icon btn-delete"
                    onClick={() => handleDelete(standort.standort_id)}
                    title="Löschen"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Card Body */}
              <div className="standort-card-body">
                {/* Adresse */}
                {(standort.strasse || standort.ort) && (
                  <div className="info-row">
                    <MapPin size={16} className="icon" />
                    <span>
                      {standort.strasse} {standort.hausnummer}, {standort.plz} {standort.ort}
                    </span>
                  </div>
                )}

                {/* Kontakt */}
                {standort.telefon && (
                  <div className="info-row">
                    <Phone size={16} className="icon" />
                    <span>{standort.telefon}</span>
                  </div>
                )}
                {standort.email && (
                  <div className="info-row">
                    <Mail size={16} className="icon" />
                    <span>{standort.email}</span>
                  </div>
                )}

                {/* Öffnungszeiten Preview */}
                <div className="info-row">
                  <Clock size={16} className="icon" />
                  <span>{formatOeffnungszeiten(standort.oeffnungszeiten)}</span>
                </div>

                {/* Statistiken */}
                {stats[standort.standort_id] && (
                  <div className="standort-stats">
                    <div className="stat-item">
                      <span className="stat-number">{stats[standort.standort_id].anzahl_kurse || 0}</span>
                      <span className="stat-text">Kurse</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-number">{stats[standort.standort_id].anzahl_raeume || 0}</span>
                      <span className="stat-text">Räume</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-number">{stats[standort.standort_id].anzahl_trainer || 0}</span>
                      <span className="stat-text">Trainer</span>
                    </div>
                  </div>
                )}

                {/* Expanded Details */}
                {expandedStandort === standort.standort_id && (
                  <div className="expanded-details">
                    {/* Vollständige Öffnungszeiten */}
                    {standort.oeffnungszeiten && (
                      <div className="detail-section">
                        <h4>Öffnungszeiten</h4>
                        <div className="oeffnungszeiten-list">
                          {Object.entries(
                            (typeof standort.oeffnungszeiten === 'string'
                              ? JSON.parse(standort.oeffnungszeiten)
                              : standort.oeffnungszeiten
                            ).regular || {}
                          ).map(([day, info]) => (
                            <div key={day} className="oeffnungszeit-row">
                              <span className="day-name">{wochentage[day]}</span>
                              <span className="time-range">
                                {info.closed ? 'Geschlossen' : `${info.open} - ${info.close}`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notizen */}
                    {standort.notizen && (
                      <div className="detail-section">
                        <h4>Notizen</h4>
                        <p>{standort.notizen}</p>
                      </div>
                    )}

                    {/* Toggle Active */}
                    <div className="detail-section">
                      <button
                        className={`btn-toggle ${standort.ist_aktiv ? 'active' : 'inactive'}`}
                        onClick={() => handleToggleActive(standort)}
                      >
                        {standort.ist_aktiv ? 'Standort deaktivieren' : 'Standort aktivieren'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

      {standorte.length === 0 && (
        <div className="empty-state">
          <Building2 size={64} className="empty-icon" />
          <h3>Keine Standorte vorhanden</h3>
          <p>Erstellen Sie Ihren ersten Standort, um zu beginnen.</p>
          <button className="btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={18} />
            <span>Ersten Standort erstellen</span>
          </button>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content-large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingStandort ? 'Standort bearbeiten' : 'Neuer Standort'}</h3>
              <button className="btn-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="modal-tabs">
              <button
                className={`modal-tab ${activeModalTab === 'basis' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('basis')}
              >
                Basis
              </button>
              <button
                className={`modal-tab ${activeModalTab === 'adresse' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('adresse')}
              >
                Adresse
              </button>
              <button
                className={`modal-tab ${activeModalTab === 'kontakt' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('kontakt')}
              >
                Kontakt
              </button>
              <button
                className={`modal-tab ${activeModalTab === 'oeffnungszeiten' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('oeffnungszeiten')}
              >
                Öffnungszeiten
              </button>
              <button
                className={`modal-tab ${activeModalTab === 'notizen' ? 'active' : ''}`}
                onClick={() => setActiveModalTab('notizen')}
              >
                Notizen
              </button>
            </div>

            <div className="modal-body">
              {error && <div className="error-message">{error}</div>}

              {/* Basis-Informationen Tab */}
              {activeModalTab === 'basis' && (
              <div className="form-section">
                <h4>Basis-Informationen</h4>
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="z.B. Hauptstandort, Filiale Nord"
                    />
                  </div>

                  <div className="form-group">
                    <label>Farbe</label>
                    <div className="color-picker-wrapper">
                      <input
                        type="color"
                        value={formData.farbe}
                        onChange={(e) => setFormData({ ...formData, farbe: e.target.value })}
                      />
                      <span className="color-value">{formData.farbe}</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Sortierung</label>
                    <input
                      type="number"
                      value={formData.sortierung}
                      onChange={(e) => setFormData({ ...formData, sortierung: parseInt(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="form-group checkbox-group full-width">
                    <label>
                      <input
                        type="checkbox"
                        checked={formData.ist_hauptstandort}
                        onChange={(e) => setFormData({ ...formData, ist_hauptstandort: e.target.checked })}
                      />
                      <span>Dies ist der Hauptstandort</span>
                    </label>
                  </div>
                </div>
              </div>
              )}

              {/* Adresse Tab */}
              {activeModalTab === 'adresse' && (
              <div className="form-section">
                <h4>Adresse</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Straße</label>
                    <input
                      type="text"
                      value={formData.strasse}
                      onChange={(e) => setFormData({ ...formData, strasse: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ maxWidth: '150px' }}>
                    <label>Hausnummer</label>
                    <input
                      type="text"
                      value={formData.hausnummer}
                      onChange={(e) => setFormData({ ...formData, hausnummer: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ maxWidth: '150px' }}>
                    <label>PLZ</label>
                    <input
                      type="text"
                      value={formData.plz}
                      onChange={(e) => setFormData({ ...formData, plz: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Ort</label>
                    <input
                      type="text"
                      value={formData.ort}
                      onChange={(e) => setFormData({ ...formData, ort: e.target.value })}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Land</label>
                    <input
                      type="text"
                      value={formData.land}
                      onChange={(e) => setFormData({ ...formData, land: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              )}

              {/* Kontakt Tab */}
              {activeModalTab === 'kontakt' && (
              <div className="form-section">
                <h4>Kontakt</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Telefon</label>
                    <input
                      type="tel"
                      value={formData.telefon}
                      onChange={(e) => setFormData({ ...formData, telefon: e.target.value })}
                      placeholder="+49 123 456789"
                    />
                  </div>
                  <div className="form-group">
                    <label>E-Mail</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="standort@dojo.de"
                    />
                  </div>
                </div>
              </div>
              )}

              {/* Öffnungszeiten Tab */}
              {activeModalTab === 'oeffnungszeiten' && (
              <div className="form-section">
                <h4>Öffnungszeiten</h4>
                <div className="oeffnungszeiten-editor">
                  {Object.entries(wochentage).map(([key, label]) => (
                    <div key={key} className="oeffnungszeit-row-editor">
                      <div className="day-label">{label}</div>
                      <div className="time-inputs">
                        <input
                          type="time"
                          value={formData.oeffnungszeiten.regular[key]?.open || '09:00'}
                          onChange={(e) => updateOeffnungszeit(key, 'open', e.target.value)}
                          disabled={formData.oeffnungszeiten.regular[key]?.closed}
                        />
                        <span>bis</span>
                        <input
                          type="time"
                          value={formData.oeffnungszeiten.regular[key]?.close || '21:00'}
                          onChange={(e) => updateOeffnungszeit(key, 'close', e.target.value)}
                          disabled={formData.oeffnungszeiten.regular[key]?.closed}
                        />
                      </div>
                      <label className="checkbox-inline">
                        <input
                          type="checkbox"
                          checked={formData.oeffnungszeiten.regular[key]?.closed || false}
                          onChange={(e) => updateOeffnungszeit(key, 'closed', e.target.checked)}
                        />
                        <span>Geschlossen</span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              )}

              {/* Notizen Tab */}
              {activeModalTab === 'notizen' && (
              <div className="form-section">
                <h4>Notizen</h4>
                <div className="form-group full-width">
                  <textarea
                    value={formData.notizen}
                    onChange={(e) => setFormData({ ...formData, notizen: e.target.value })}
                    rows={4}
                    placeholder="Zusätzliche Informationen zum Standort..."
                  />
                </div>
              </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModal}>
                Abbrechen
              </button>
              <button className="btn-primary" onClick={handleSave} disabled={loading}>
                <Save size={18} />
                <span>{loading ? 'Speichern...' : 'Speichern'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StandortVerwaltung;
