import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Target, TrendingUp, Award, BookOpen, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import '../styles/MitgliedFortschritt.css';
import '../styles/SliderStyles.css';

const MitgliedFortschritt = ({ mitgliedId, readOnly = false }) => {
  const [fortschritte, setFortschritte] = useState([]);
  const [ziele, setZiele] = useState([]);
  const [meilensteine, setMeilensteine] = useState([]);
  const [kategorien, setKategorien] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('skills'); // skills, ziele, meilensteine
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
      const [fortschrittRes, zieleRes, meilensteineRes, kategorienRes] = await Promise.all([
        axios.get(`/fortschritt/mitglied/${mitgliedId}`),
        axios.get(`/fortschritt/mitglied/${mitgliedId}/ziele`),
        axios.get(`/fortschritt/mitglied/${mitgliedId}/meilensteine`),
        axios.get(`/fortschritt/kategorien`)
      ]);

      setFortschritte(fortschrittRes.data);
      setZiele(zieleRes.data);
      setMeilensteine(meilensteineRes.data);
      setKategorien(kategorienRes.data);
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
                    <div className="skill-kategorie" style={{ color: skill.kategorie_farbe }}>
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
                        className="progress-fill"
                        style={{
                          width: `${skill.fortschritt_prozent}%`,
                          backgroundColor: getStatusColor(skill.status)
                        }}
                      />
                    </div>
                    <span className="progress-text">{skill.fortschritt_prozent}%</span>
                  </div>

                  <div className="skill-footer">
                    <div className="skill-badges">
                      <span className="badge badge-status" style={{ backgroundColor: getStatusColor(skill.status) }}>
                        {skill.status.replace('_', ' ')}
                      </span>
                      <span className="badge badge-priority" style={{ backgroundColor: getPrioritaetColor(skill.prioritaet) }}>
                        {skill.prioritaet}
                      </span>
                      <span className="badge badge-diff">{skill.schwierigkeit}</span>
                    </div>

                    {!readOnly && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', color: '#ffd700', fontWeight: 'bold', minWidth: '35px' }}>
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
                          style={{
                            flex: 1,
                            minWidth: '200px'
                          }}
                        />
                        <button 
                          onClick={() => handleShowHistory(skill.fortschritt_id)}
                          style={{
                            padding: '6px 10px',
                            fontSize: '12px',
                            background: 'rgba(255, 215, 0, 0.2)',
                            border: '1px solid rgba(255, 215, 0, 0.5)',
                            borderRadius: '6px',
                            color: '#ffd700',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            transition: 'all 0.2s',
                            minWidth: '80px',
                            flexShrink: 0
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = 'rgba(255, 215, 0, 0.3)';
                            e.target.style.borderColor = 'rgba(255, 215, 0, 0.7)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'rgba(255, 215, 0, 0.2)';
                            e.target.style.borderColor = 'rgba(255, 215, 0, 0.5)';
                          }}
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
      </div>

      {/* Add Modal - KOMPLETT MIT INLINE CSS - MAXIMALER Z-INDEX */}
      {showAddModal && (
        <div 
          ref={modalRef}
          style={{
            position: 'fixed !important',
            top: '0 !important',
            left: '0 !important',
            right: '0 !important',
            bottom: '0 !important',
            width: '100vw !important',
            height: '100vh !important',
            background: 'rgba(0, 0, 0, 0.9) !important',
            backdropFilter: 'blur(12px) !important',
            display: 'flex !important',
            alignItems: 'center !important',
            justifyContent: 'center !important',
            zIndex: '2147483647 !important',
            padding: '20px !important',
            margin: '0 !important',
            boxSizing: 'border-box !important',
            isolation: 'isolate !important',
            transform: 'none !important',
            overflow: 'hidden !important'
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div 
            style={{
              position: 'relative',
              background: '#1a1a2e',
              border: '3px solid #ffd700',
              borderRadius: '16px',
              padding: 0,
              width: '450px',
              maxWidth: '450px',
              minWidth: '450px',
              height: 'auto',
              maxHeight: '80vh',
              overflow: 'hidden',
              zIndex: 2147483647,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              margin: 0,
              transform: 'none',
              top: 'auto',
              left: 'auto',
              right: 'auto',
              bottom: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                background: 'rgba(255, 215, 0, 0.1)',
                borderBottom: '1px solid rgba(255, 215, 0, 0.3)',
                flexShrink: 0,
                boxSizing: 'border-box'
              }}
            >
              <h2 
                style={{
                  margin: 0,
                  color: '#ffd700',
                  fontSize: '16px',
                  fontWeight: 700,
                  lineHeight: 1.2
                }}
              >
                {activeTab === 'skills' && 'Neuer Skill'}
                {activeTab === 'ziele' && 'Neues Ziel'}
                {activeTab === 'meilensteine' && 'Neuer Meilenstein'}
              </h2>
              <button 
                style={{
                  width: '24px',
                  height: '24px',
                  padding: 0,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onClick={() => setShowAddModal(false)}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(239, 68, 68, 0.3)';
                  e.target.style.borderColor = '#ef4444';
                  e.target.style.color = '#ef4444';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  e.target.style.color = '#fff';
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div 
              style={{
                padding: '24px',
                overflowY: 'auto',
                overflowX: 'hidden',
                flex: 1,
                maxHeight: 'calc(80vh - 120px)',
                boxSizing: 'border-box'
              }}
            >
              {activeTab === 'skills' && (
                <div 
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                    margin: 0
                  }}
                >
                  <div 
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      margin: 0
                    }}
                  >
                    <label 
                      style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#ffd700',
                        lineHeight: 1.3
                      }}
                    >
                      Kategorie
                    </label>
                    <select
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 215, 0, 0.3)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        height: '36px',
                        minHeight: '36px',
                        maxHeight: '36px',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s'
                      }}
                      value={newSkill.kategorie_id}
                      onChange={(e) => setNewSkill({ ...newSkill, kategorie_id: e.target.value })}
                    >
                      <option value="" style={{ background: '#1a1a2e', color: '#fff' }}>Wählen...</option>
                      {kategorien.map((kat) => (
                        <option 
                          key={kat.kategorie_id} 
                          value={kat.kategorie_id}
                          style={{ background: '#1a1a2e', color: '#fff' }}
                        >
                          {kat.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div 
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      margin: 0
                    }}
                  >
                    <label 
                      style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#ffd700',
                        lineHeight: 1.3
                      }}
                    >
                      Skill Name *
                    </label>
                    <input
                      type="text"
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 215, 0, 0.3)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        height: '36px',
                        minHeight: '36px',
                        maxHeight: '36px',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s'
                      }}
                      value={newSkill.skill_name}
                      onChange={(e) => setNewSkill({ ...newSkill, skill_name: e.target.value })}
                      placeholder="z.B. Frontkick"
                    />
                  </div>

                  <div 
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      margin: 0,
                      gridColumn: '1 / -1'
                    }}
                  >
                    <label 
                      style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#ffd700',
                        lineHeight: 1.3
                      }}
                    >
                      Beschreibung
                    </label>
                    <textarea
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 215, 0, 0.3)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        height: '70px',
                        minHeight: '70px',
                        maxHeight: '100px',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s',
                        resize: 'vertical'
                      }}
                      value={newSkill.beschreibung}
                      onChange={(e) => setNewSkill({ ...newSkill, beschreibung: e.target.value })}
                      rows={3}
                    />
                  </div>

                  <div 
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      margin: 0
                    }}
                  >
                    <label 
                      style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#ffd700',
                        lineHeight: 1.3
                      }}
                    >
                      Priorität
                    </label>
                    <select
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 215, 0, 0.3)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        height: '36px',
                        minHeight: '36px',
                        maxHeight: '36px',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s'
                      }}
                      value={newSkill.prioritaet}
                      onChange={(e) => setNewSkill({ ...newSkill, prioritaet: e.target.value })}
                    >
                      <option value="niedrig" style={{ background: '#1a1a2e', color: '#fff' }}>Niedrig</option>
                      <option value="mittel" style={{ background: '#1a1a2e', color: '#fff' }}>Mittel</option>
                      <option value="hoch" style={{ background: '#1a1a2e', color: '#fff' }}>Hoch</option>
                      <option value="kritisch" style={{ background: '#1a1a2e', color: '#fff' }}>Kritisch</option>
                    </select>
                  </div>

                  <div 
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      margin: 0
                    }}
                  >
                    <label 
                      style={{
                        margin: 0,
                        fontSize: '13px',
                        fontWeight: 600,
                        color: '#ffd700',
                        lineHeight: 1.3
                      }}
                    >
                      Schwierigkeit
                    </label>
                    <select
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 215, 0, 0.3)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        height: '36px',
                        minHeight: '36px',
                        maxHeight: '36px',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s'
                      }}
                      value={newSkill.schwierigkeit}
                      onChange={(e) => setNewSkill({ ...newSkill, schwierigkeit: e.target.value })}
                    >
                      <option value="anfaenger" style={{ background: '#1a1a2e', color: '#fff' }}>Anfänger</option>
                      <option value="fortgeschritten" style={{ background: '#1a1a2e', color: '#fff' }}>Fortgeschritten</option>
                      <option value="experte" style={{ background: '#1a1a2e', color: '#fff' }}>Experte</option>
                      <option value="meister" style={{ background: '#1a1a2e', color: '#fff' }}>Meister</option>
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

            <div 
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '8px',
                padding: '16px 20px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderTop: '1px solid rgba(255, 215, 0, 0.3)',
                flexShrink: 0,
                boxSizing: 'border-box'
              }}
            >
              <button 
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  minWidth: '60px'
                }}
                onClick={() => setShowAddModal(false)}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.2)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
              >
                Abbrechen
              </button>
              <button
                style={{
                  padding: '8px 16px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: '#ffd700',
                  color: '#1a1a2e',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  minWidth: '60px'
                }}
                onClick={() => {
                  if (activeTab === 'skills') handleAddSkill();
                  else if (activeTab === 'ziele') handleAddZiel();
                  else if (activeTab === 'meilensteine') handleAddMeilenstein();
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#ffed4e';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#ffd700';
                  e.target.style.transform = 'translateY(0)';
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.9)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2147483647,
            padding: '20px',
            margin: 0,
            boxSizing: 'border-box',
            isolation: 'isolate'
          }}
          onClick={() => setShowHistoryModal(false)}
        >
          <div 
            style={{
              position: 'relative',
              background: '#1a1a2e',
              border: '3px solid #ffd700',
              borderRadius: '16px',
              padding: 0,
              width: '600px',
              maxWidth: '90vw',
              height: 'auto',
              maxHeight: '80vh',
              overflow: 'hidden',
              zIndex: 2147483647,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(255, 215, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              margin: 0,
              transform: 'none',
              top: 'auto',
              left: 'auto',
              right: 'auto',
              bottom: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div 
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                background: 'rgba(255, 215, 0, 0.1)',
                borderBottom: '1px solid rgba(255, 215, 0, 0.3)',
                flexShrink: 0,
                boxSizing: 'border-box'
              }}
            >
              <h2 
                style={{
                  margin: 0,
                  color: '#ffd700',
                  fontSize: '18px',
                  fontWeight: 700,
                  lineHeight: 1.2
                }}
              >
                📊 Änderungshistorie
              </h2>
              <button 
                style={{
                  width: '24px',
                  height: '24px',
                  padding: 0,
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '4px',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box'
                }}
                onClick={() => setShowHistoryModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div 
              style={{
                padding: '20px',
                overflowY: 'auto',
                overflowX: 'hidden',
                flex: 1,
                maxHeight: 'calc(80vh - 120px)',
                boxSizing: 'border-box'
              }}
            >
              {selectedSkillHistory.length === 0 ? (
                <p style={{ color: '#fff', textAlign: 'center', margin: '20px 0' }}>
                  Keine Änderungen vorhanden
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedSkillHistory.map((entry, index) => (
                    <div 
                      key={index}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 215, 0, 0.2)',
                        borderRadius: '8px',
                        padding: '12px',
                        color: '#fff'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 'bold', color: '#ffd700' }}>
                          {entry.skill_name}
                        </span>
                        <span style={{ fontSize: '12px', color: '#ccc' }}>
                          {new Date(entry.update_timestamp).toLocaleString('de-DE')}
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '16px', fontSize: '14px' }}>
                        <div>
                          <span style={{ color: '#ccc' }}>Fortschritt: </span>
                          <span style={{ color: '#ff6b35' }}>{entry.alter_fortschritt}%</span>
                          <span style={{ color: '#fff', margin: '0 8px' }}>→</span>
                          <span style={{ color: '#22c55e' }}>{entry.neuer_fortschritt}%</span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '16px', fontSize: '14px', marginTop: '4px' }}>
                        <div>
                          <span style={{ color: '#ccc' }}>Status: </span>
                          <span style={{ color: '#ff6b35' }}>{entry.alter_status}</span>
                          <span style={{ color: '#fff', margin: '0 8px' }}>→</span>
                          <span style={{ color: '#22c55e' }}>{entry.neuer_status}</span>
                        </div>
                      </div>
                      
                      {entry.notiz && (
                        <div style={{ marginTop: '8px', fontSize: '13px', color: '#ccc' }}>
                          <span style={{ color: '#ffd700' }}>Notiz: </span>
                          {entry.notiz}
                        </div>
                      )}
                      
                      {entry.aktualisiert_von_name && (
                        <div style={{ marginTop: '8px', fontSize: '13px', color: '#ccc' }}>
                          <span style={{ color: '#ffd700' }}>Geändert von: </span>
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
