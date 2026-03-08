import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Target, TrendingUp, Award, BookOpen, Plus, Edit2, Trash2, Check, X, Medal } from 'lucide-react';
import '../styles/MitgliedFortschritt.css';
import '../styles/SliderStyles.css';

const MitgliedFortschritt = ({ mitgliedId, readOnly = false }) => {
  const [fortschritte, setFortschritte] = useState([]);
  const [ziele, setZiele] = useState([]);
  const [meilensteine, setMeilensteine] = useState([]);
  const [badges, setBadges] = useState([]);
  const [kategorien, setKategorien] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('skills'); // skills, ziele, meilensteine, badges
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedSkillHistory, setSelectedSkillHistory] = useState([]);
  const [selectedSkillId, setSelectedSkillId] = useState(null);
  const modalRef = useRef(null);

  // Modal zentrieren nach dem Rendern
  useEffect(() => {
    if (showAddModal && modalRef.current) {
      const modal = modalRef.current;
      modal.style.position = 'fixed';
      modal.style.top = '50%';
      modal.style.left = '50%';
      modal.style.transform = 'translate(-50%, -50%)';
      modal.style.zIndex = '2147483647';
    }
  }, [showAddModal]);

  // Historie-Modal zentrieren
  useEffect(() => {
    if (showHistoryModal) {
      const historyModal = document.querySelector('[data-history-modal]');
      if (historyModal) {
        historyModal.style.position = 'fixed';
        historyModal.style.top = '50%';
        historyModal.style.left = '50%';
        historyModal.style.transform = 'translate(-50%, -50%)';
        historyModal.style.zIndex = '2147483647';
      }
    }
  }, [showHistoryModal]);

  // Form states
  const [newSkill, setNewSkill] = useState({
    kategorie_id: '',
    skill_name: '',
    beschreibung: '',
    fortschritt_prozent: 0,
    status: 'nicht_gestartet',
    prioritaet: 'mittel',
    schwierigkeit: 'anfaenger'
  });

  const [newZiel, setNewZiel] = useState({
    titel: '',
    beschreibung: '',
    start_datum: new Date().toISOString().split('T')[0],
    ziel_datum: '',
    prioritaet: 'mittel'
  });

  const [newMeilenstein, setNewMeilenstein] = useState({
    titel: '',
    beschreibung: '',
    typ: 'achievement',
    ziel_datum: ''
  });

  useEffect(() => {
    if (mitgliedId) {
      loadAllData();
    }
  }, [mitgliedId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [fortschrittRes, zieleRes, meilensteineRes, kategorienRes, badgesRes] = await Promise.all([
        axios.get(`/fortschritt/mitglied/${mitgliedId}`),
        axios.get(`/fortschritt/mitglied/${mitgliedId}/ziele`),
        axios.get(`/fortschritt/mitglied/${mitgliedId}/meilensteine`),
        axios.get(`/fortschritt/kategorien`),
        axios.get(`/badges/mitglied/${mitgliedId}`)
      ]);

      setFortschritte(fortschrittRes.data);
      setZiele(zieleRes.data);
      setMeilensteine(meilensteineRes.data);
      setKategorien(kategorienRes.data);
      setBadges(badgesRes.data || []);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Fortschritts-Daten:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSkill = async () => {
    try {
      await axios.post(`/fortschritt/mitglied/${mitgliedId}`, newSkill);
      loadAllData();
      setShowAddModal(false);
      resetNewSkill();
    } catch (error) {
      console.error('❌ Fehler beim Erstellen des Skills:', error);
    }
  };

  const handleUpdateSkill = async (skillId, updates) => {
    try {
      console.log('Updating skill:', skillId, updates);
      
      // Benutzer-Informationen hinzufügen
      const updatesWithUser = {
        ...updates,
        updated_by: localStorage.getItem('userId') || 'unknown',
        updated_by_name: localStorage.getItem('userName') || 'Unbekannt',
        update_reason: 'slider_change'
      };
      
      console.log('Sending update:', updatesWithUser);
      
      const response = await axios.put(`/fortschritt/${skillId}`, updatesWithUser);
      console.log('Update response:', response.data);
      
      // Sofortige UI-Aktualisierung ohne Server-Roundtrip
      setFortschritte(prev => prev.map(skill => 
        skill.fortschritt_id === skillId 
          ? { ...skill, ...updates }
          : skill
      ));
      
      // Kein loadAllData() mehr - verhindert Flackern
    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  const handleDeleteSkill = async (skillId) => {
    if (!confirm('Möchten Sie diesen Fortschritt wirklich löschen?')) return;
    try {
      await axios.delete(`/fortschritt/${skillId}`);
      loadAllData();
    } catch (error) {
      console.error('❌ Fehler beim Löschen:', error);
    }
  };

  const handleShowHistory = async (skillId) => {
    try {
      const response = await axios.get(`/fortschritt/${skillId}/history`);
      setSelectedSkillHistory(response.data);
      setSelectedSkillId(skillId);
      setShowHistoryModal(true);
    } catch (error) {
      console.error('❌ Fehler beim Laden der Historie:', error);
    }
  };

  const handleAddZiel = async () => {
    try {
      await axios.post(`/fortschritt/mitglied/${mitgliedId}/ziele`, newZiel);
      loadAllData();
      setShowAddModal(false);
      resetNewZiel();
    } catch (error) {
      console.error('❌ Fehler beim Erstellen des Ziels:', error);
    }
  };

  const handleAddMeilenstein = async () => {
    try {
      await axios.post(`/fortschritt/mitglied/${mitgliedId}/meilensteine`, newMeilenstein);
      loadAllData();
      setShowAddModal(false);
      resetNewMeilenstein();
    } catch (error) {
      console.error('❌ Fehler beim Erstellen des Meilensteins:', error);
    }
  };

  const handleToggleMeilenstein = async (meilensteinId, currentStatus) => {
    try {
      await axios.put(`/fortschritt/meilensteine/${meilensteinId}/erreicht`, {
        erreicht: !currentStatus
      });
      loadAllData();
    } catch (error) {
      console.error('❌ Fehler beim Aktualisieren:', error);
    }
  };

  const resetNewSkill = () => {
    setNewSkill({
      kategorie_id: '',
      skill_name: '',
      beschreibung: '',
      fortschritt_prozent: 0,
      status: 'nicht_gestartet',
      prioritaet: 'mittel',
      schwierigkeit: 'anfaenger'
    });
  };

  const resetNewZiel = () => {
    setNewZiel({
      titel: '',
      beschreibung: '',
      start_datum: new Date().toISOString().split('T')[0],
      ziel_datum: '',
      prioritaet: 'mittel'
    });
  };

  const resetNewMeilenstein = () => {
    setNewMeilenstein({
      titel: '',
      beschreibung: '',
      typ: 'achievement',
      ziel_datum: ''
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      'nicht_gestartet': '#6B7280',
      'in_arbeit': '#3B82F6',
      'gemeistert': '#10B981',
      'auf_eis': '#F59E0B'
    };
    return colors[status] || '#6B7280';
  };

  const getPrioritaetColor = (prioritaet) => {
    const colors = {
      'niedrig': '#10B981',
      'mittel': '#3B82F6',
      'hoch': '#F59E0B',
      'kritisch': '#EF4444'
    };
    return colors[prioritaet] || '#3B82F6';
  };

  if (loading) {
    return (
      <div className="fortschritt-loading">
        <div className="loading-spinner"></div>
        <p>Lade Fortschritts-Daten...</p>
      </div>
    );
  }

  return (
    <div className="mitglied-fortschritt">
      {/* Header mit Tabs */}
      <div className="fortschritt-header">
        <div className="fortschritt-tabs">
          <button
            className={`tab-btn ${activeTab === 'skills' ? 'active' : ''}`}
            onClick={() => setActiveTab('skills')}
          >
            <TrendingUp size={18} />
            <span>Skills & Techniken</span>
            <span className="tab-badge">{fortschritte.length}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'ziele' ? 'active' : ''}`}
            onClick={() => setActiveTab('ziele')}
          >
            <Target size={18} />
            <span>Ziele</span>
            <span className="tab-badge">{ziele.filter(z => z.status === 'aktiv').length}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'meilensteine' ? 'active' : ''}`}
            onClick={() => setActiveTab('meilensteine')}
          >
            <Award size={18} />
            <span>Meilensteine</span>
            <span className="tab-badge">{meilensteine.filter(m => m.erreicht).length}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'badges' ? 'active' : ''}`}
            onClick={() => setActiveTab('badges')}
          >
            <Medal size={18} />
            <span>Auszeichnungen</span>
            <span className="tab-badge">{badges.length}</span>
          </button>
        </div>
        {!readOnly && (
          <button className="add-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={18} />
            <span>Hinzufügen</span>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="fortschritt-content">
        {activeTab === 'skills' && (
          <div className="skills-grid">
            {fortschritte.length === 0 ? (
              <div className="empty-state">
                <TrendingUp size={48} />
                <p>Noch keine Skills erfasst</p>
                {!readOnly && (
                  <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                    Ersten Skill hinzufügen
                  </button>
                )}
              </div>
            ) : (
              fortschritte.map((skill) => (
                <div key={skill.fortschritt_id} className="skill-card">
                  <div className="skill-header">
                    <div className="skill-kategorie" style={{ '--kat-farbe': skill.kategorie_farbe }}>
                      {skill.kategorie_name}
                    </div>
                    {!readOnly && (
                      <div className="skill-actions">
                        <button
                          className="icon-btn"
                          onClick={() => handleDeleteSkill(skill.fortschritt_id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="skill-name">{skill.skill_name}</h3>
                  {skill.beschreibung && <p className="skill-desc">{skill.beschreibung}</p>}

                  <div className="skill-progress">
                    <div className="progress-bar">
                      <div
                        className={`progress-fill mfo-progress-fill--${skill.status}`}
                        style={{ width: `${skill.fortschritt_prozent}%` }}
                      />
                    </div>
                    <span className="progress-text">{skill.fortschritt_prozent}%</span>
                  </div>

                  <div className="skill-footer">
                    <div className="skill-badges">
                      <span className={`badge badge-status mfo-badge-status--${skill.status}`}>
                        {skill.status.replace('_', ' ')}
                      </span>
                      <span className={`badge badge-priority mfo-badge-priority--${skill.prioritaet}`}>
                        {skill.prioritaet}
                      </span>
                      <span className="badge badge-diff">{skill.schwierigkeit}</span>
                    </div>

                    {!readOnly && (
                      <div className="mfo-skill-controls">
                        <span className="mfo-skill-pct">
                          {skill.fortschritt_prozent}%
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={skill.fortschritt_prozent}
                          onChange={(e) => {
                            // Nur UI-Update, kein Server-Update
                            const newValue = parseInt(e.target.value);
                            setFortschritte(prev => prev.map(s => 
                              s.fortschritt_id === skill.fortschritt_id 
                                ? { ...s, fortschritt_prozent: newValue }
                                : s
                            ));
                          }}
                          onMouseUp={(e) => {
                            // Server-Update nur beim Loslassen
                            const newValue = parseInt(e.target.value);
                            handleUpdateSkill(skill.fortschritt_id, {
                              ...skill,
                              fortschritt_prozent: newValue,
                              status: newValue === 100 ? 'gemeistert' : 'in_arbeit'
                            });
                          }}
                          className="skill-slider"
                        />
                        <button
                          onClick={() => handleShowHistory(skill.fortschritt_id)}
                          className="mfo-btn-history"
                        >
                          📊 Historie
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'ziele' && (
          <div className="ziele-list">
            {ziele.length === 0 ? (
              <div className="empty-state">
                <Target size={48} />
                <p>Noch keine Ziele definiert</p>
                {!readOnly && (
                  <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                    Erstes Ziel erstellen
                  </button>
                )}
              </div>
            ) : (
              ziele.map((ziel) => (
                <div key={ziel.ziel_id} className={`ziel-card ziel-${ziel.status}`}>
                  <div className="ziel-header">
                    <h3>{ziel.titel}</h3>
                    <span className={`ziel-status status-${ziel.status}`}>{ziel.status}</span>
                  </div>
                  {ziel.beschreibung && <p className="ziel-desc">{ziel.beschreibung}</p>}
                  <div className="ziel-dates">
                    <span>Start: {new Date(ziel.start_datum).toLocaleDateString('de-DE')}</span>
                    <span>Ziel: {new Date(ziel.ziel_datum).toLocaleDateString('de-DE')}</span>
                  </div>
                  {ziel.fortschritt_prozent > 0 && (
                    <div className="ziel-progress">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${ziel.fortschritt_prozent}%` }} />
                      </div>
                      <span>{ziel.fortschritt_prozent}%</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'meilensteine' && (
          <div className="meilensteine-grid">
            {meilensteine.length === 0 ? (
              <div className="empty-state">
                <Award size={48} />
                <p>Noch keine Meilensteine erreicht</p>
                {!readOnly && (
                  <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                    Ersten Meilenstein erstellen
                  </button>
                )}
              </div>
            ) : (
              meilensteine.map((meilenstein) => (
                <div key={meilenstein.meilenstein_id} className={`meilenstein-card ${meilenstein.erreicht ? 'erreicht' : ''}`}>
                  <div className="meilenstein-icon">
                    {meilenstein.erreicht ? <Award size={32} color="#ffd700" /> : <Target size={32} />}
                  </div>
                  <h3>{meilenstein.titel}</h3>
                  {meilenstein.beschreibung && <p>{meilenstein.beschreibung}</p>}
                  <div className="meilenstein-footer">
                    <span className="meilenstein-typ">{meilenstein.typ}</span>
                    {meilenstein.erreicht && meilenstein.erreicht_am && (
                      <span className="meilenstein-date">
                        {new Date(meilenstein.erreicht_am).toLocaleDateString('de-DE')}
                      </span>
                    )}
                  </div>
                  {!readOnly && (
                    <button
                      className={`meilenstein-toggle ${meilenstein.erreicht ? 'btn-undo' : 'btn-complete'}`}
                      onClick={() => handleToggleMeilenstein(meilenstein.meilenstein_id, meilenstein.erreicht)}
                    >
                      {meilenstein.erreicht ? 'Zurücksetzen' : 'Als erreicht markieren'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'badges' && (
          <div className="mfo-badges-grid">
            {badges.length === 0 ? (
              <div className="empty-state">
                <Medal size={48} />
                <p>Noch keine Auszeichnungen erhalten</p>
                <p className="mfo-badge-empty-text">
                  Auszeichnungen werden für besondere Leistungen vergeben.
                </p>
              </div>
            ) : (
              badges.map((badge) => {
                // Icon-Emoji-Mapping
                const iconEmojis = {
                  award: '🏅',
                  star: '⭐',
                  trophy: '🏆',
                  medal: '🎖️',
                  crown: '👑',
                  flame: '🔥',
                  target: '🎯',
                  heart: '❤️',
                  users: '👥',
                  swords: '⚔️',
                  zap: '⚡',
                  'trending-up': '📈',
                  footprints: '👣',
                  layers: '📚',
                  brain: '🧠',
                  shield: '🛡️'
                };
                const iconEmoji = iconEmojis[badge.icon] || '🏅';

                return (
                  <div
                    key={badge.badge_id}
                    className="mfo-badge-card"
                    style={{
                      '--badge-farbe': badge.farbe || '#ffd700',
                      '--badge-farbe-40': `${badge.farbe || '#ffd700'}40`,
                      '--badge-farbe-20': `${badge.farbe || '#ffd700'}20`,
                      '--badge-farbe-30': `${badge.farbe || '#ffd700'}30`,
                    }}
                  >
                    <div className="mfo-badge-icon-circle">
                      {iconEmoji}
                    </div>

                    <h3 className="mfo-badge-name">
                      {badge.name}
                    </h3>

                    {badge.beschreibung && (
                      <p className="mfo-badge-desc">
                        {badge.beschreibung}
                      </p>
                    )}

                    <div className="mfo-badge-meta">
                      {badge.kategorie && (
                        <span className="mfo-badge-tag">
                          {badge.kategorie}
                        </span>
                      )}
                      {badge.verliehen_am && (
                        <span className="mfo-badge-tag--date">
                          {new Date(badge.verliehen_am).toLocaleDateString('de-DE')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Add Modal - KOMPLETT MIT INLINE CSS - MAXIMALER Z-INDEX */}
      {showAddModal && (
        <div 
          ref={modalRef}
          className="modal-overlay"
          onClick={() => setShowAddModal(false)}
        >
          <div 
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mfo-modal-header">
              <h2 className="mfo-modal-title">
                {activeTab === 'skills' && 'Neuer Skill'}
                {activeTab === 'ziele' && 'Neues Ziel'}
                {activeTab === 'meilensteine' && 'Neuer Meilenstein'}
              </h2>
              <button
                className="mfo-modal-close"
                onClick={() => setShowAddModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mfo-modal-body">
              {activeTab === 'skills' && (
                <div 
                  className="mfo-form-grid"
                >
                  <div className="mfo-form-col">
                    <label className="mfo-label">
                      Kategorie
                    </label>
                    <select
                      className="mfo-field"
                      value={newSkill.kategorie_id}
                      onChange={(e) => setNewSkill({ ...newSkill, kategorie_id: e.target.value })}
                    >
                      <option value="" className="mfo-option-dark">Wählen...</option>
                      {kategorien.map((kat) => (
                        <option 
                          key={kat.kategorie_id} 
                          value={kat.kategorie_id}
                          className="mfo-option-dark"
                        >
                          {kat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mfo-form-col">
                    <label className="mfo-label">
                      Skill Name *
                    </label>
                    <input
                      type="text"
                      className="mfo-field"
                      value={newSkill.skill_name}
                      onChange={(e) => setNewSkill({ ...newSkill, skill_name: e.target.value })}
                      placeholder="z.B. Frontkick"
                    />
                  </div>

                  <div className="mfo-form-col mfo-form-col--full">
                    <label className="mfo-label">
                      Beschreibung
                    </label>
                    <textarea
                      className="mfo-field--textarea"
                      value={newSkill.beschreibung}
                      onChange={(e) => setNewSkill({ ...newSkill, beschreibung: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="mfo-form-col">
                    <label className="mfo-label">
                      Priorität
                    </label>
                    <select
                      className="mfo-field"
                      value={newSkill.prioritaet}
                      onChange={(e) => setNewSkill({ ...newSkill, prioritaet: e.target.value })}
                    >
                      <option value="niedrig" className="mfo-option-dark">Niedrig</option>
                      <option value="mittel" className="mfo-option-dark">Mittel</option>
                      <option value="hoch" className="mfo-option-dark">Hoch</option>
                      <option value="kritisch" className="mfo-option-dark">Kritisch</option>
                    </select>
                  </div>

                  <div className="mfo-form-col">
                    <label className="mfo-label">
                      Schwierigkeit
                    </label>
                    <select
                      className="mfo-field"
                      value={newSkill.schwierigkeit}
                      onChange={(e) => setNewSkill({ ...newSkill, schwierigkeit: e.target.value })}
                    >
                      <option value="anfaenger" className="mfo-option-dark">Anfänger</option>
                      <option value="fortgeschritten" className="mfo-option-dark">Fortgeschritten</option>
                      <option value="experte" className="mfo-option-dark">Experte</option>
                      <option value="meister" className="mfo-option-dark">Meister</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'ziele' && (
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Titel *</label>
                    <input
                      type="text"
                      value={newZiel.titel}
                      onChange={(e) => setNewZiel({ ...newZiel, titel: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Beschreibung</label>
                    <textarea
                      value={newZiel.beschreibung}
                      onChange={(e) => setNewZiel({ ...newZiel, beschreibung: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="form-group">
                    <label>Startdatum</label>
                    <input
                      type="date"
                      value={newZiel.start_datum}
                      onChange={(e) => setNewZiel({ ...newZiel, start_datum: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Zieldatum *</label>
                    <input
                      type="date"
                      value={newZiel.ziel_datum}
                      onChange={(e) => setNewZiel({ ...newZiel, ziel_datum: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Priorität</label>
                    <select
                      value={newZiel.prioritaet}
                      onChange={(e) => setNewZiel({ ...newZiel, prioritaet: e.target.value })}
                    >
                      <option value="niedrig">Niedrig</option>
                      <option value="mittel">Mittel</option>
                      <option value="hoch">Hoch</option>
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'meilensteine' && (
                <div className="form-grid">
                  <div className="form-group full-width">
                    <label>Titel *</label>
                    <input
                      type="text"
                      value={newMeilenstein.titel}
                      onChange={(e) => setNewMeilenstein({ ...newMeilenstein, titel: e.target.value })}
                    />
                  </div>

                  <div className="form-group full-width">
                    <label>Beschreibung</label>
                    <textarea
                      value={newMeilenstein.beschreibung}
                      onChange={(e) => setNewMeilenstein({ ...newMeilenstein, beschreibung: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div className="form-group">
                    <label>Typ</label>
                    <select
                      value={newMeilenstein.typ}
                      onChange={(e) => setNewMeilenstein({ ...newMeilenstein, typ: e.target.value })}
                    >
                      <option value="achievement">Achievement</option>
                      <option value="pruefung">Prüfung</option>
                      <option value="turnier">Turnier</option>
                      <option value="persoenlich">Persönlich</option>
                      <option value="sonstiges">Sonstiges</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Zieldatum</label>
                    <input
                      type="date"
                      value={newMeilenstein.ziel_datum}
                      onChange={(e) => setNewMeilenstein({ ...newMeilenstein, ziel_datum: e.target.value })}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="mfo-modal-footer">
              <button
                className="mfo-btn-cancel"
                onClick={() => setShowAddModal(false)}
              >
                Abbrechen
              </button>
              <button
                className="mfo-btn-submit"
                onClick={() => {
                  if (activeTab === 'skills') handleAddSkill();
                  else if (activeTab === 'ziele') handleAddZiel();
                  else if (activeTab === 'meilensteine') handleAddMeilenstein();
                }}
              >
                Hinzufügen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Historie Modal */}
      {showHistoryModal && (
        <div 
          data-history-modal
          className="modal-overlay"
          onClick={() => setShowHistoryModal(false)}
        >
          <div 
            className="modal-content modal-content--history"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mfo-modal-header">
              <h2 className="mfo-modal-title">
                📊 Änderungshistorie
              </h2>
              <button className="mfo-modal-close"
                onClick={() => setShowHistoryModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mfo-modal-body--history">
              {selectedSkillHistory.length === 0 ? (
                <p className="mfo-empty-msg">
                  Keine Änderungen vorhanden
                </p>
              ) : (
                <div className="mfo-history-list">
                  {selectedSkillHistory.map((entry, index) => (
                    <div 
                      key={index}
                      className="mfo-history-card"
                    >
                      <div className="mfo-history-row">
                        <span className="mfo-history-name">
                          {entry.skill_name}
                        </span>
                        <span className="mfo-history-ts">
                          {new Date(entry.update_timestamp).toLocaleString('de-DE')}
                        </span>
                      </div>
                      
                      <div className="mfo-history-change">
                        <div>
                          <span className="u-text-secondary">Fortschritt: </span>
                          <span className="mfo-old-value">{entry.alter_fortschritt}%</span>
                          <span className="mfo-arrow">→</span>
                          <span className="u-text-success">{entry.neuer_fortschritt}%</span>
                        </div>
                      </div>
                      
                      <div className="mfo-history-change--mt">
                        <div>
                          <span className="u-text-secondary">Status: </span>
                          <span className="mfo-old-value">{entry.alter_status}</span>
                          <span className="mfo-arrow">→</span>
                          <span className="u-text-success">{entry.neuer_status}</span>
                        </div>
                      </div>
                      
                      {entry.notiz && (
                        <div className="mfo-note">
                          <span className="u-text-accent">Notiz: </span>
                          {entry.notiz}
                        </div>
                      )}
                      
                      {entry.aktualisiert_von_name && (
                        <div className="mfo-note">
                          <span className="u-text-accent">Geändert von: </span>
                          {entry.aktualisiert_von_name}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MitgliedFortschritt;
