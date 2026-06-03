import React from "react";
import { Check, Plus, Trash2, Edit, Target, X } from 'lucide-react';

// Ausgelagert aus DojoLizenzverwaltung.jsx (LizenzVergleichTab).
const LizenzVergleichTab = ({ loading, comparisonData, comparisonLoading, editingItemId, setEditingItemId, showAddCategory, setShowAddCategory, showAddCompetitor, setShowAddCompetitor, showAddItem, setShowAddItem, newCategory, setNewCategory, newCompetitor, setNewCompetitor, newItem, setNewItem, handleUpdateRating, handleAddComparisonItem, handleDeleteComparisonItem, handleAddCategory, handleAddCompetitor, getRatingIcon }) => {
  return (
          <div className="comparison-management-tab">
            <div className="comparison-header">
              <h3><Target size={20} /> Konkurrenz-Vergleich verwalten</h3>
              <div className="comparison-actions">
                <button className="btn-secondary" onClick={() => setShowAddCompetitor(true)}>
                  <Plus size={16} /> Konkurrent
                </button>
                <button className="btn-secondary" onClick={() => setShowAddCategory(true)}>
                  <Plus size={16} /> Kategorie
                </button>
                <button className="btn-add-feature" onClick={() => setShowAddItem(true)}>
                  <Plus size={16} /> Feature
                </button>
              </div>
            </div>

            <p className="comparison-hint">
              Diese Daten werden auf der öffentlichen Landing Page im Vergleichsbereich angezeigt.
              <br />
              <strong>Bewertungen:</strong> ✓ = Voll unterstützt | ~ = Teilweise | ✗ = Nicht unterstützt
            </p>

            {comparisonLoading ? (
              <div className="loading-state">Lade Vergleichsdaten...</div>
            ) : (
              <>
                {/* Add Competitor Form */}
                {showAddCompetitor && (
                  <div className="add-feature-form">
                    <h4>Neuen Konkurrenten hinzufügen</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Name</label>
                        <input
                          type="text"
                          value={newCompetitor.name}
                          onChange={(e) => setNewCompetitor(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="z.B. Gymdesk"
                        />
                      </div>
                      <div className="form-group">
                        <label>Kurzname</label>
                        <input
                          type="text"
                          value={newCompetitor.short_name}
                          onChange={(e) => setNewCompetitor(prev => ({ ...prev, short_name: e.target.value }))}
                          placeholder="z.B. GD"
                        />
                      </div>
                      <div className="form-group">
                        <label>Website</label>
                        <input
                          type="text"
                          value={newCompetitor.website}
                          onChange={(e) => setNewCompetitor(prev => ({ ...prev, website: e.target.value }))}
                          placeholder="https://gymdesk.com"
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="btn-cancel" onClick={() => setShowAddCompetitor(false)}>Abbrechen</button>
                      <button className="btn-save" onClick={handleAddCompetitor}>Hinzufügen</button>
                    </div>
                  </div>
                )}

                {/* Add Category Form */}
                {showAddCategory && (
                  <div className="add-feature-form">
                    <h4>Neue Kategorie hinzufügen</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Icon (Emoji)</label>
                        <input
                          type="text"
                          value={newCategory.icon}
                          onChange={(e) => setNewCategory(prev => ({ ...prev, icon: e.target.value }))}
                          maxLength={2}
                        />
                      </div>
                      <div className="form-group">
                        <label>Name</label>
                        <input
                          type="text"
                          value={newCategory.name}
                          onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="z.B. Finanzen"
                        />
                      </div>
                      <div className="form-group">
                        <label>
                          <input
                            type="checkbox"
                            checked={newCategory.is_highlight}
                            onChange={(e) => setNewCategory(prev => ({ ...prev, is_highlight: e.target.checked }))}
                          />
                          {' '}Highlight-Kategorie
                        </label>
                      </div>
                      {newCategory.is_highlight && (
                        <div className="form-group full-width">
                          <label>Highlight-Notiz</label>
                          <input
                            type="text"
                            value={newCategory.highlight_note}
                            onChange={(e) => setNewCategory(prev => ({ ...prev, highlight_note: e.target.value }))}
                            placeholder="z.B. Einzigartiges Feature!"
                          />
                        </div>
                      )}
                    </div>
                    <div className="form-actions">
                      <button className="btn-cancel" onClick={() => setShowAddCategory(false)}>Abbrechen</button>
                      <button className="btn-save" onClick={handleAddCategory}>Hinzufügen</button>
                    </div>
                  </div>
                )}

                {/* Add Item Form */}
                {showAddItem && (
                  <div className="add-feature-form">
                    <h4>Neues Feature hinzufügen</h4>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Kategorie</label>
                        <select
                          value={newItem.category_id}
                          onChange={(e) => setNewItem(prev => ({ ...prev, category_id: e.target.value }))}
                        >
                          <option value="">-- Kategorie wählen --</option>
                          {comparisonData.categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Feature-Name</label>
                        <input
                          type="text"
                          value={newItem.feature_name}
                          onChange={(e) => setNewItem(prev => ({ ...prev, feature_name: e.target.value }))}
                          placeholder="z.B. SEPA-Lastschrift"
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <button className="btn-cancel" onClick={() => setShowAddItem(false)}>Abbrechen</button>
                      <button className="btn-save" onClick={handleAddComparisonItem}>Hinzufügen</button>
                    </div>
                  </div>
                )}

                {/* Competitors Overview */}
                <div className="comparison-competitors">
                  <h4>Konkurrenten ({comparisonData.competitors.length})</h4>
                  <div className="competitors-row">
                    <div className="competitor-badge ours">
                      <strong>DojoSoftware</strong>
                      <span className="badge-us">Wir</span>
                    </div>
                    {comparisonData.competitors.map(comp => (
                      <div key={comp.id} className="competitor-badge">
                        <strong>{comp.name}</strong>
                        <small>{comp.short_name}</small>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Categories with Items */}
                {comparisonData.categories.map(category => {
                  const categoryItems = comparisonData.items.filter(item => item.category_id === category.id);
                  return (
                    <div key={category.id} className={`comparison-category ${category.is_highlight ? 'highlight' : ''}`}>
                      <div className="category-header">
                        <h4>
                          <span className="category-icon">{category.icon}</span>
                          {category.name}
                          {category.is_highlight && <span className="highlight-badge">★</span>}
                          <span className="item-count">({categoryItems.length} Features)</span>
                        </h4>
                        {category.highlight_note && (
                          <span className="highlight-note">{category.highlight_note}</span>
                        )}
                      </div>

                      <table className="comparison-table">
                        <thead>
                          <tr>
                            <th className="feature-col">Feature</th>
                            <th className="rating-col ours">DojoSoftware</th>
                            {comparisonData.competitors.map(comp => (
                              <th key={comp.id} className="rating-col">{comp.short_name}</th>
                            ))}
                            <th className="actions-col">Aktionen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryItems.map(item => (
                            <tr key={item.id}>
                              <td className="feature-col">{item.feature_name}</td>
                              <td className="rating-col ours">
                                {editingItemId === item.id ? (
                                  <select
                                    defaultValue={item.ours}
                                    id={`ours-${item.id}`}
                                    className="rating-select"
                                  >
                                    <option value="full">✓ Voll</option>
                                    <option value="partial">~ Teil</option>
                                    <option value="none">✗ Nein</option>
                                  </select>
                                ) : (
                                  getRatingIcon(item.ours)
                                )}
                              </td>
                              {comparisonData.competitors.map(comp => (
                                <td key={comp.id} className="rating-col">
                                  {editingItemId === item.id ? (
                                    <select
                                      defaultValue={item.competitors[comp.id] || 'none'}
                                      id={`comp-${item.id}-${comp.id}`}
                                      className="rating-select"
                                    >
                                      <option value="full">✓ Voll</option>
                                      <option value="partial">~ Teil</option>
                                      <option value="none">✗ Nein</option>
                                    </select>
                                  ) : (
                                    getRatingIcon(item.competitors[comp.id] || 'none')
                                  )}
                                </td>
                              ))}
                              <td className="actions-col">
                                {editingItemId === item.id ? (
                                  <>
                                    <button
                                      className="btn-icon success"
                                      onClick={() => {
                                        const ours = document.getElementById(`ours-${item.id}`).value;
                                        const competitors = {};
                                        comparisonData.competitors.forEach(comp => {
                                          competitors[comp.id] = document.getElementById(`comp-${item.id}-${comp.id}`).value;
                                        });
                                        handleUpdateRating(item.id, ours, competitors);
                                      }}
                                      title="Speichern"
                                    >
                                      <Check size={14} />
                                    </button>
                                    <button
                                      className="btn-icon"
                                      onClick={() => setEditingItemId(null)}
                                      title="Abbrechen"
                                    >
                                      <X size={14} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      className="btn-icon"
                                      onClick={() => setEditingItemId(item.id)}
                                      title="Bearbeiten"
                                    >
                                      <Edit size={14} />
                                    </button>
                                    <button
                                      className="btn-icon danger"
                                      onClick={() => handleDeleteComparisonItem(item.id)}
                                      title="Löschen"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}

                {comparisonData.categories.length === 0 && (
                  <div className="empty-state">
                    <p>Noch keine Vergleichsdaten vorhanden.</p>
                    <p>Füge zunächst Konkurrenten und Kategorien hinzu.</p>
                  </div>
                )}
              </>
            )}
          </div>
  );
};

export default LizenzVergleichTab;
