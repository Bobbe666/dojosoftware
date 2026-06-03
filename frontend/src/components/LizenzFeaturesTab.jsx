import React from "react";
import { Settings, Plus, Trash2, Edit, Globe, PowerOff, FileText } from 'lucide-react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';

// Ausgelagert aus DojoLizenzverwaltung.jsx (LizenzFeaturesTab).
const LizenzFeaturesTab = ({ allFeatures, setAllFeatures, showAddFeature, setShowAddFeature, expandedFeatureId, setExpandedFeatureId, newFeature, setNewFeature, editingFeature, setEditingFeature, planFeatures, handleAddFeature, handleEditFeature, handleSaveEditFeature }) => {
  return (
          <div className="features-management-tab">
            <div className="features-header">
              <h3><Settings size={20} /> Feature-Verwaltung</h3>
              <button
                className="btn-add-feature"
                onClick={() => setShowAddFeature(true)}
              >
                <Plus size={16} /> Feature hinzufügen
              </button>
            </div>

            {/* Add Feature Form */}
            {showAddFeature && (
              <div className="add-feature-form">
                <h4>Neues Feature hinzufügen</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Emoji</label>
                    <input
                      type="text"
                      value={newFeature.emoji}
                      onChange={(e) => setNewFeature(prev => ({ ...prev, emoji: e.target.value }))}
                      placeholder="⭐"
                      maxLength={2}
                    />
                  </div>
                  <div className="form-group">
                    <label>ID (eindeutig)</label>
                    <input
                      type="text"
                      value={newFeature.id}
                      onChange={(e) => setNewFeature(prev => ({ ...prev, id: e.target.value }))}
                      placeholder="z.B. whatsapp_integration"
                    />
                  </div>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={newFeature.label}
                      onChange={(e) => setNewFeature(prev => ({ ...prev, label: e.target.value }))}
                      placeholder="z.B. WhatsApp Integration"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Beschreibung</label>
                    <input
                      type="text"
                      value={newFeature.description}
                      onChange={(e) => setNewFeature(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Kurze Beschreibung des Features..."
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>📋 In welchen Plänen soll das Feature verfügbar sein?</label>
                    <div className="plan-checkboxes">
                      {[
                        { key: 'trial', icon: '🎁' },
                        { key: 'basic', icon: '📦' },
                        { key: 'free', icon: '🆓' },
                        { key: 'starter', icon: '🚀' },
                        { key: 'professional', icon: '💼' },
                        { key: 'premium', icon: '⭐' },
                        { key: 'enterprise', icon: '🏢' },
                      ].map(({ key, icon }) => (
                        <label key={key} className={`plan-checkbox-label ${newFeature.plans.includes(key) ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={newFeature.plans.includes(key)}
                            onChange={(e) => setNewFeature(prev => ({
                              ...prev,
                              plans: e.target.checked
                                ? [...prev.plans, key]
                                : prev.plans.filter(p => p !== key)
                            }))}
                          />
                          {icon} {PLAN_NAMES[key]}
                          <span className="pcl-price">{PLAN_PRICES[key]}</span>
                        </label>
                      ))}
                    </div>
                    {newFeature.plans.length === 0 && (
                      <p className="plan-warning">⚠️ Kein Plan ausgewählt — Feature ist für niemanden sichtbar!</p>
                    )}
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn-cancel" onClick={() => setShowAddFeature(false)}>Abbrechen</button>
                  <button className="btn-save" onClick={handleAddFeature}>Feature hinzufügen</button>
                </div>
              </div>
            )}

            {/* Edit Feature Form */}
            {editingFeature && (
              <div className="add-feature-form">
                <h4>Feature bearbeiten</h4>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Emoji</label>
                    <input
                      type="text"
                      value={editingFeature.emoji}
                      onChange={(e) => setEditingFeature(prev => ({ ...prev, emoji: e.target.value }))}
                      maxLength={2}
                    />
                  </div>
                  <div className="form-group">
                    <label>ID</label>
                    <input
                      type="text"
                      value={editingFeature.id}
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label>Name</label>
                    <input
                      type="text"
                      value={editingFeature.label}
                      onChange={(e) => setEditingFeature(prev => ({ ...prev, label: e.target.value }))}
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>Beschreibung</label>
                    <input
                      type="text"
                      value={editingFeature.description}
                      onChange={(e) => setEditingFeature(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button className="btn-cancel" onClick={() => setEditingFeature(null)}>Abbrechen</button>
                  <button className="btn-save" onClick={handleSaveEditFeature}>Speichern</button>
                </div>
              </div>
            )}

            {/* Feature-Liste - 3 pro Zeile */}
            <div className="features-grid-compact">
              {allFeatures.map(feature => {
                const isPublic = feature.is_public !== false;
                // Zähle in wie vielen Plänen dieses Feature aktiv ist
                const planCount = Object.values(planFeatures).filter(pf => pf.includes(feature.id)).length;
                const isExpanded = expandedFeatureId === feature.id;
                return (
                  <div
                    key={feature.id}
                    className={`feature-card-mini ${isExpanded ? 'fcm-expanded' : ''}`}
                  >
                    <div className="fcm-header">
                      <span className="fcm-emoji">{feature.emoji}</span>
                      <span className="fcm-name">{feature.label}</span>
                      <span className="fcm-plan-count" title={`In ${planCount} Plänen aktiv`}>
                        {planCount}
                      </span>
                    </div>
                    <div className="fcm-desc">{feature.description}</div>
                    <div className="fcm-id">{feature.id}</div>
                    <div className="fcm-actions">
                      {feature.files && feature.files.length > 0 && (
                        <button
                          className={`fcm-files-btn ${isExpanded ? 'active' : ''}`}
                          onClick={() => setExpandedFeatureId(isExpanded ? null : feature.id)}
                          title="Beteiligte Dateien anzeigen"
                        >
                          <FileText size={12} />
                          Dateien
                        </button>
                      )}
                      <button
                        className={`fcm-public-btn ${isPublic ? 'visible' : 'hidden'}`}
                        onClick={async () => {
                          const newIsPublic = !isPublic;
                          setAllFeatures(prev => prev.map(f =>
                            f.id === feature.id ? { ...f, is_public: newIsPublic } : f
                          ));
                          try {
                            await fetchWithAuth(`${config.apiBaseUrl}/admin/features/${feature.id}`, {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ is_public: newIsPublic })
                            });
                          } catch (e) {
                            console.error('is_public speichern fehlgeschlagen:', e);
                          }
                        }}
                        title={isPublic ? 'Öffentlich auf Landing Page' : 'Versteckt auf Landing Page'}
                      >
                        {isPublic ? <Globe size={12} /> : <PowerOff size={12} />}
                        {isPublic ? 'Öffentlich' : 'Versteckt'}
                      </button>
                      <button
                        className="fcm-edit"
                        onClick={() => handleEditFeature(feature)}
                        title="Bearbeiten"
                      >
                        <Edit size={12} />
                      </button>
                      <button
                        className="fcm-delete"
                        onClick={() => {
                          if (window.confirm(`Feature "${feature.label}" wirklich löschen?`)) {
                            setAllFeatures(prev => prev.filter(f => f.id !== feature.id));
                            fetchWithAuth(`${config.apiBaseUrl}/admin/features/${feature.id}`, { method: 'DELETE' })
                              .catch(e => console.error('Feature löschen fehlgeschlagen:', e));
                          }
                        }}
                        title="Löschen"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    {isExpanded && feature.files && (
                      <div className="fcm-files-panel">
                        <div className="fcm-files-title">📂 Beteiligte Dateien</div>
                        <div className="fcm-files-list">
                          {feature.files.map((file, i) => {
                            const isBackend = file.startsWith('backend/');
                            return (
                              <span key={i} className={`fcm-file-tag ${isBackend ? 'fcm-file-tag--backend' : 'fcm-file-tag--frontend'}`}>
                                {isBackend ? '⚙️' : '⚛️'} {file}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
  );
};

export default LizenzFeaturesTab;
