import React from "react";
import { motion } from "framer-motion";

// Ausgelagert aus Stilverwaltung.jsx (StilPruefungseinstellungenTab-Tab).
const StilPruefungseinstellungenTab = ({ stile, currentStil, setCurrentStil, loading, setLoading, error, setError, success, setSuccess, authFetch, loadStil, updateStil }) => {
  return (
                  <motion.div
                    className="pruefungseinstellungen-tab"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <h3>Prüfungseinstellungen</h3>
                    <p className="tab-description">
                      Definieren Sie die standardmäßigen Wartezeiten zwischen Gürtelprüfungen für verschiedene Stufen.
                    </p>

                    <div className="pruefungseinstellungen-container">
                      {/* Wartezeiten für Farbgürtel */}
                      <div className="wartezeiten-section">
                        <h4>Wartezeiten für Farbgürtel</h4>

                        <div className="form-group">
                          <label className="form-label">
                            Grundstufe (Monate):
                            <span className="label-info">Weiß-, Gelb-, Orangegurt</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={currentStil.wartezeit_grundstufe || 3}
                            onChange={(e) => setCurrentStil({
                              ...currentStil,
                              wartezeit_grundstufe: parseInt(e.target.value) || 3
                            })}
                            className="form-input"
                            placeholder="z.B. 3"
                          />
                          <small>Empfohlen: 3 Monate</small>
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            Mittelstufe (Monate):
                            <span className="label-info">Grün-, Blaugurt</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={currentStil.wartezeit_mittelstufe || 4}
                            onChange={(e) => setCurrentStil({
                              ...currentStil,
                              wartezeit_mittelstufe: parseInt(e.target.value) || 4
                            })}
                            className="form-input"
                            placeholder="z.B. 4"
                          />
                          <small>Empfohlen: 4 Monate</small>
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            Oberstufe (Monate):
                            <span className="label-info">Rot-, Braungurt</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="24"
                            value={currentStil.wartezeit_oberstufe || 6}
                            onChange={(e) => setCurrentStil({
                              ...currentStil,
                              wartezeit_oberstufe: parseInt(e.target.value) || 6
                            })}
                            className="form-input"
                            placeholder="z.B. 6"
                          />
                          <small>Empfohlen: 6 Monate</small>
                        </div>
                      </div>

                      {/* Schwarzgurt-Einstellungen */}
                      <div className="schwarzgurt-section">
                        <h4>Schwarzgurt-Regelung (DAN-Grade)</h4>

                        <div className="form-group checkbox-group">
                          <label className="form-label checkbox-label">
                            <input
                              type="checkbox"
                              checked={currentStil.wartezeit_schwarzgurt_traditionell || false}
                              onChange={(e) => setCurrentStil({
                                ...currentStil,
                                wartezeit_schwarzgurt_traditionell: e.target.checked
                              })}
                            />
                            <span className="checkbox-text">
                              Traditionelle Wartezeiten verwenden
                            </span>
                          </label>
                          <div className="checkbox-info">
                            <p>Bei aktivierter Option gelten folgende Wartezeiten:</p>
                            <ul>
                              <li>1. DAN → 2. DAN: 2 Jahre</li>
                              <li>2. DAN → 3. DAN: 3 Jahre</li>
                              <li>3. DAN → 4. DAN: 4 Jahre</li>
                              <li>4. DAN → 5. DAN: 5 Jahre</li>
                              <li>usw. (DAN-Stufe = Jahre Wartezeit)</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="sub-tabs">
                      <button
                        className="sub-tab-btn"
                        onClick={() => updateStil({
                          name: currentStil.name,
                          beschreibung: currentStil.beschreibung,
                          aktiv: currentStil.aktiv,
                          wartezeit_grundstufe: currentStil.wartezeit_grundstufe,
                          wartezeit_mittelstufe: currentStil.wartezeit_mittelstufe,
                          wartezeit_oberstufe: currentStil.wartezeit_oberstufe,
                          wartezeit_schwarzgurt_traditionell: currentStil.wartezeit_schwarzgurt_traditionell
                        })}
                        disabled={loading || !currentStil.name?.trim()}
                      >
                        {loading ? 'Wird gespeichert...' : '💾 Einstellungen speichern'}
                      </button>

                      <button
                        className="sub-tab-btn sv-allgemein-apply-btn"
                        onClick={async () => {
                          if (!confirm('Möchten Sie die aktuellen Wartezeiten auf ALLE bestehenden Graduierungen anwenden?\n\nDies überschreibt die Mindestzeiten aller Graduierungen entsprechend ihrer Kategorie.\n\nHinweis: Kategorien werden automatisch basierend auf dem Gürtelnamen erkannt.')) {
                            return;
                          }

                          setLoading(true);
                          try {
                            const graduierungen = currentStil.graduierungen || [];
                            let updatedCount = 0;

                            // Funktion zum automatischen Erkennen der Kategorie basierend auf dem Namen
                            const detectKategorie = (name) => {
                              const nameLower = name.toLowerCase();

                              // DAN-Grade
                              if (nameLower.includes('dan') || nameLower.includes('schwarzgurt')) {
                                return 'dan';
                              }

                              // Meister
                              if (nameLower.includes('rot-weiß') || nameLower.includes('meister')) {
                                return 'meister';
                              }

                              // Oberstufe: Braun, Rot, kombiniert mit Schwarz
                              if (nameLower.includes('braun') || nameLower.includes('rot')) {
                                return 'oberstufe';
                              }

                              // Mittelstufe: Blau, Grün
                              if (nameLower.includes('blau') || nameLower.includes('grün')) {
                                return 'mittelstufe';
                              }

                              // Grundstufe: Weiß, Gelb, Orange
                              if (nameLower.includes('weiß') || nameLower.includes('gelb') || nameLower.includes('orange')) {
                                return 'grundstufe';
                              }

                              return null;
                            };

                            for (const grad of graduierungen) {
                              // Erkenne Kategorie automatisch - hat Vorrang vor bestehender Kategorie
                              const detectedKategorie = detectKategorie(grad.name);
                              const kategorie = detectedKategorie || grad.kategorie;
                              let newWaitTime = grad.mindestzeit_monate;

                              // Kategorie aktualisieren wenn sich die erkannte von der bestehenden unterscheidet
                              const updateKategorie = detectedKategorie && detectedKategorie !== grad.kategorie;

                              if (kategorie === 'grundstufe') {
                                newWaitTime = currentStil.wartezeit_grundstufe || 3;
                              } else if (kategorie === 'mittelstufe') {
                                newWaitTime = currentStil.wartezeit_mittelstufe || 4;
                              } else if (kategorie === 'oberstufe') {
                                newWaitTime = currentStil.wartezeit_oberstufe || 6;
                              } else if (kategorie === 'dan') {
                                if (currentStil.wartezeit_schwarzgurt_traditionell && grad.dan_grad >= 2) {
                                  // Traditionelle Wartezeiten: (n-1).DAN → n.DAN = n Jahre
                                  // 1→2.DAN: 2 Jahre, 2→3.DAN: 3 Jahre, 3→4.DAN: 4 Jahre ...
                                  newWaitTime = grad.dan_grad * 12;
                                } else {
                                  newWaitTime = currentStil.wartezeit_oberstufe || 6;
                                }
                              }

                              // Nur aktualisieren wenn sich was geändert hat oder Kategorie gesetzt werden soll
                              if (newWaitTime !== grad.mindestzeit_monate || updateKategorie) {
                                const response = await authFetch(`${API_BASE}/stile/graduierungen/${grad.graduierung_id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    name: grad.name,
                                    reihenfolge: grad.reihenfolge,
                                    trainingsstunden_min: grad.trainingsstunden_min,
                                    mindestzeit_monate: newWaitTime,
                                    farbe_hex: grad.farbe_hex,
                                    farbe_sekundaer: grad.farbe_sekundaer,
                                    kategorie: kategorie, // Verwende die erkannte oder vorhandene Kategorie
                                    dan_grad: grad.dan_grad,
                                    aktiv: grad.aktiv
                                  })
                                });

                                if (response.ok) {
                                  updatedCount++;
                                  console.log(`✅ ${grad.name} aktualisiert: ${grad.mindestzeit_monate} → ${newWaitTime} Monate`);
                                } else {
                                  console.error(`❌ Fehler beim Aktualisieren von ${grad.name}`);
                                }
                              }
                            }

                            // Reload Stil to get updated graduations
                            await loadStil(currentStil.stil_id);

                            setSuccess(`${updatedCount} Graduierung(en) erfolgreich aktualisiert!`);
                            setTimeout(() => setSuccess(''), 3000);
                          } catch (err) {
                            console.error('Fehler beim Aktualisieren der Graduierungen:', err);
                            setError('Fehler beim Anwenden der Wartezeiten');
                          } finally {
                            setLoading(false);
                          }
                        }}
                        disabled={loading || !currentStil.graduierungen?.length}
                      >
                        {loading ? 'Wird angewendet...' : '🔄 Auf alle Graduierungen anwenden'}
                      </button>
                    </div>
                  </motion.div>
  );
};

export default StilPruefungseinstellungenTab;
