import React from "react";
import { motion } from "framer-motion";

// Ausgelagert aus Stilverwaltung.jsx (StilAllgemeinTab-Tab).
const StilAllgemeinTab = ({ currentStil, setCurrentStil, loading, updateStil, deleteStil }) => {
  return (
                  <motion.div 
                    className="allgemein-tab"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3>Grundeinstellungen</h3>
                    
                    <div className="form-group">
                      <label className="form-label">Stil-Name:</label>
                      <input 
                        type="text" 
                        value={currentStil.name || ''} 
                        onChange={(e) => setCurrentStil({...currentStil, name: e.target.value})}
                        className="form-input"
                        placeholder="Name des Kampfkunst-Stils"
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Beschreibung:</label>
                      <textarea 
                        value={currentStil.beschreibung || ''} 
                        onChange={(e) => setCurrentStil({...currentStil, beschreibung: e.target.value})}
                        rows="4"
                        className="form-textarea"
                        placeholder="Beschreibung des Kampfkunst-Stils..."
                      />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">
                        <input 
                          type="checkbox" 
                          checked={currentStil.aktiv || false}
                          onChange={(e) => setCurrentStil({...currentStil, aktiv: e.target.checked})}
                        />
                        Stil ist aktiv
                      </label>
                      <small>Inaktive Stile werden nicht in der Schülerverwaltung angezeigt</small>
                    </div>
                    
                    <div className="sub-tabs">
                      <button
                        className="sub-tab-btn"
                        onClick={() => updateStil({
                          name: currentStil.name,
                          beschreibung: currentStil.beschreibung,
                          aktiv: currentStil.aktiv
                        })}
                        disabled={loading || !currentStil.name?.trim()}
                      >
                        {loading ? 'Wird gespeichert...' : '💾 Änderungen speichern'}
                      </button>

                      <button
                        className="sub-tab-btn"
                        onClick={() => deleteStil(currentStil.stil_id)}
                        disabled={loading}
                        title="Stil löschen oder deaktivieren"
                      >
                        🗑️ Stil löschen
                      </button>
                    </div>
                  </motion.div>
  );
};

export default StilAllgemeinTab;
