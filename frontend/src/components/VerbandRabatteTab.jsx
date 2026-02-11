// =====================================================================================
// VERBAND RABATTE TAB - Mitglieder-Rabatte für Artikel
// =====================================================================================
// Ermöglicht Konfiguration von Rabatten für zahlende Verbandsmitglieder
// =====================================================================================

import React, { useState, useEffect, useCallback } from 'react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import '../styles/VerbandRabatteTab.css';

const VerbandRabatteTab = () => {
  // =====================================================================================
  // STATE
  // =====================================================================================
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Globale Einstellungen
  const [globalSettings, setGlobalSettings] = useState({
    standard_rabatt_prozent: 10,
    rabatte_aktiv: true,
    hinweis_nicht_mitglied: 'Als Verbandsmitglied erhältst du exklusive Rabatte auf alle Artikel!',
    hinweis_basic_mitglied: 'Aktiviere deine Mitgliedschaft um von Mitgliederrabatten zu profitieren.'
  });

  // Artikel mit Rabatt-Konfiguration
  const [artikelRabatte, setArtikelRabatte] = useState([]);

  // UI State
  const [activeSubTab, setActiveSubTab] = useState('global'); // 'global', 'artikel'
  const [searchTerm, setSearchTerm] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSettings, setBulkSettings] = useState({
    rabatt_typ: 'prozent',
    rabatt_wert: 10,
    gilt_fuer_dojo: true,
    gilt_fuer_einzelperson: true
  });
  const [selectedArtikel, setSelectedArtikel] = useState([]);

  // =====================================================================================
  // API CALLS
  // =====================================================================================

  const loadGlobalSettings = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/rabatt-einstellungen`);
      const data = await response.json();
      if (data.success && data.data) {
        setGlobalSettings(data.data);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Rabatt-Einstellungen:', error);
    }
  }, []);

  const loadArtikelRabatte = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/artikel-rabatte`);
      const data = await response.json();
      if (data.success) {
        setArtikelRabatte(data.data || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Artikel-Rabatte:', error);
    }
  }, []);

  const saveGlobalSettings = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/rabatt-einstellungen`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(globalSettings)
      });

      const data = await response.json();
      if (data.success) {
        setSuccess('Einstellungen gespeichert!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Fehler beim Speichern');
      }
    } catch (error) {
      setError('Fehler beim Speichern: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const saveArtikelRabatt = async (artikelId, rabattData) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/artikel-rabatte`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artikel_id: artikelId, ...rabattData })
      });

      const data = await response.json();
      if (data.success) {
        await loadArtikelRabatte();
        setSuccess('Rabatt gespeichert!');
        setTimeout(() => setSuccess(null), 2000);
      } else {
        setError(data.error || 'Fehler beim Speichern');
      }
    } catch (error) {
      setError('Fehler beim Speichern: ' + error.message);
    }
  };

  const deleteArtikelRabatt = async (artikelId) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/artikel-rabatte/${artikelId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        await loadArtikelRabatte();
        setSuccess('Rabatt entfernt!');
        setTimeout(() => setSuccess(null), 2000);
      }
    } catch (error) {
      setError('Fehler beim Löschen: ' + error.message);
    }
  };

  const saveBulkRabatte = async () => {
    if (selectedArtikel.length === 0) {
      setError('Bitte wählen Sie mindestens einen Artikel aus.');
      return;
    }

    try {
      setSaving(true);
      const response = await fetchWithAuth(`${config.apiBaseUrl}/admin/artikel-rabatte/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artikel_ids: selectedArtikel,
          ...bulkSettings
        })
      });

      const data = await response.json();
      if (data.success) {
        await loadArtikelRabatte();
        setShowBulkModal(false);
        setSelectedArtikel([]);
        setSuccess(`Rabatte für ${selectedArtikel.length} Artikel gespeichert!`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || 'Fehler beim Speichern');
      }
    } catch (error) {
      setError('Fehler beim Speichern: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // =====================================================================================
  // EFFECTS
  // =====================================================================================

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadGlobalSettings(), loadArtikelRabatte()]);
      setLoading(false);
    };
    loadData();
  }, [loadGlobalSettings, loadArtikelRabatte]);

  // =====================================================================================
  // HANDLERS
  // =====================================================================================

  const handleGlobalChange = (field, value) => {
    setGlobalSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleArtikelRabattChange = (artikelId, field, value) => {
    setArtikelRabatte(prev => prev.map(artikel => {
      if (artikel.artikel_id === artikelId) {
        return { ...artikel, [field]: value, hasChanges: true };
      }
      return artikel;
    }));
  };

  const toggleArtikelSelection = (artikelId) => {
    setSelectedArtikel(prev => {
      if (prev.includes(artikelId)) {
        return prev.filter(id => id !== artikelId);
      }
      return [...prev, artikelId];
    });
  };

  const toggleAllArtikel = () => {
    if (selectedArtikel.length === filteredArtikel.length) {
      setSelectedArtikel([]);
    } else {
      setSelectedArtikel(filteredArtikel.map(a => a.artikel_id));
    }
  };

  // =====================================================================================
  // FILTER
  // =====================================================================================

  const filteredArtikel = artikelRabatte.filter(artikel =>
    artikel.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    artikel.artikel_nummer?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // =====================================================================================
  // RENDER
  // =====================================================================================

  if (loading) {
    return (
      <div className="rabatte-loading">
        <div className="loading-spinner"></div>
        <p>Lade Rabatt-Einstellungen...</p>
      </div>
    );
  }

  return (
    <div className="verband-rabatte-tab">
      {/* Header */}
      <div className="rabatte-header">
        <div className="rabatte-header-info">
          <h2>Mitglieder-Rabatte</h2>
          <p>Konfigurieren Sie Rabatte für zahlende Verbandsmitglieder</p>
        </div>
        <div className="rabatte-status">
          <span className={`status-badge ${globalSettings.rabatte_aktiv ? 'active' : 'inactive'}`}>
            {globalSettings.rabatte_aktiv ? 'Rabatte aktiv' : 'Rabatte deaktiviert'}
          </span>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rabatte-message error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      {success && (
        <div className="rabatte-message success">
          <span>{success}</span>
        </div>
      )}

      {/* Sub-Tabs */}
      <div className="rabatte-subtabs">
        <button
          className={`subtab-btn ${activeSubTab === 'global' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('global')}
        >
          Globale Einstellungen
        </button>
        <button
          className={`subtab-btn ${activeSubTab === 'artikel' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('artikel')}
        >
          Artikel-Rabatte
          {artikelRabatte.filter(a => a.hat_individuellen_rabatt).length > 0 && (
            <span className="subtab-badge">
              {artikelRabatte.filter(a => a.hat_individuellen_rabatt).length}
            </span>
          )}
        </button>
      </div>

      {/* Global Settings Tab */}
      {activeSubTab === 'global' && (
        <div className="rabatte-content global-settings">
          <div className="settings-section">
            <h3>Allgemeine Rabatt-Einstellungen</h3>

            <div className="setting-row">
              <label className="setting-label">
                <span className="label-text">Rabatte aktivieren</span>
                <span className="label-hint">Schaltet das gesamte Rabattsystem ein/aus</span>
              </label>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={globalSettings.rabatte_aktiv}
                  onChange={(e) => handleGlobalChange('rabatte_aktiv', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-row">
              <label className="setting-label">
                <span className="label-text">Standard-Rabatt (%)</span>
                <span className="label-hint">Gilt für alle Artikel ohne individuelle Einstellung</span>
              </label>
              <div className="setting-input-group">
                <input
                  type="number"
                  value={globalSettings.standard_rabatt_prozent}
                  onChange={(e) => handleGlobalChange('standard_rabatt_prozent', parseFloat(e.target.value) || 0)}
                  min="0"
                  max="100"
                  step="0.5"
                  className="setting-input"
                />
                <span className="input-suffix">%</span>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Hinweistexte</h3>

            <div className="setting-row vertical">
              <label className="setting-label">
                <span className="label-text">Hinweis für Nicht-Mitglieder</span>
                <span className="label-hint">Wird angezeigt wenn jemand kein Verbandsmitglied ist</span>
              </label>
              <textarea
                value={globalSettings.hinweis_nicht_mitglied || ''}
                onChange={(e) => handleGlobalChange('hinweis_nicht_mitglied', e.target.value)}
                rows="2"
                className="setting-textarea"
                placeholder="z.B. Als Verbandsmitglied erhältst du exklusive Rabatte!"
              />
            </div>

            <div className="setting-row vertical">
              <label className="setting-label">
                <span className="label-text">Hinweis für Basic-Mitglieder</span>
                <span className="label-hint">Wird angezeigt wenn jemand Mitglied ist aber nicht bezahlt hat</span>
              </label>
              <textarea
                value={globalSettings.hinweis_basic_mitglied || ''}
                onChange={(e) => handleGlobalChange('hinweis_basic_mitglied', e.target.value)}
                rows="2"
                className="setting-textarea"
                placeholder="z.B. Aktiviere deine Mitgliedschaft um Rabatte zu erhalten!"
              />
            </div>
          </div>

          <div className="settings-actions">
            <button
              className="save-btn"
              onClick={saveGlobalSettings}
              disabled={saving}
            >
              {saving ? 'Speichern...' : 'Einstellungen speichern'}
            </button>
          </div>

          {/* Preview Section */}
          <div className="settings-section preview-section">
            <h3>Vorschau</h3>
            <div className="preview-cards">
              <div className="preview-card member">
                <div className="preview-header">Vollmitglied sieht:</div>
                <div className="preview-price">
                  <span className="original-price">99,00 €</span>
                  <span className="discounted-price">
                    {(99 * (1 - globalSettings.standard_rabatt_prozent / 100)).toFixed(2)} €
                  </span>
                  <span className="discount-badge">-{globalSettings.standard_rabatt_prozent}%</span>
                </div>
                <div className="preview-label">Mitgliederpreis</div>
              </div>

              <div className="preview-card basic">
                <div className="preview-header">Basic-Mitglied sieht:</div>
                <div className="preview-price">
                  <span className="regular-price">99,00 €</span>
                </div>
                <div className="preview-hint">{globalSettings.hinweis_basic_mitglied}</div>
                <div className="preview-potential">
                  Mit Mitgliedschaft: {(99 * (1 - globalSettings.standard_rabatt_prozent / 100)).toFixed(2)} €
                </div>
              </div>

              <div className="preview-card guest">
                <div className="preview-header">Nicht-Mitglied sieht:</div>
                <div className="preview-price">
                  <span className="regular-price">99,00 €</span>
                </div>
                <div className="preview-hint">{globalSettings.hinweis_nicht_mitglied}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Artikel Rabatte Tab */}
      {activeSubTab === 'artikel' && (
        <div className="rabatte-content artikel-rabatte">
          {/* Controls */}
          <div className="artikel-rabatte-controls">
            <div className="search-box">
              <input
                type="text"
                placeholder="Artikel suchen..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="search-icon">🔍</span>
            </div>

            {selectedArtikel.length > 0 && (
              <button
                className="bulk-btn"
                onClick={() => setShowBulkModal(true)}
              >
                Rabatt für {selectedArtikel.length} Artikel setzen
              </button>
            )}
          </div>

          {/* Info Box */}
          <div className="info-box">
            <p>
              <strong>Standard-Rabatt:</strong> {globalSettings.standard_rabatt_prozent}% für alle Artikel ohne individuelle Einstellung.
              Hier können Sie für einzelne Artikel abweichende Rabatte konfigurieren.
            </p>
          </div>

          {/* Artikel Table */}
          <div className="artikel-rabatte-table-container">
            <table className="artikel-rabatte-table">
              <thead>
                <tr>
                  <th className="checkbox-col">
                    <input
                      type="checkbox"
                      checked={selectedArtikel.length === filteredArtikel.length && filteredArtikel.length > 0}
                      onChange={toggleAllArtikel}
                    />
                  </th>
                  <th>Artikel</th>
                  <th>Normalpreis</th>
                  <th>Rabatt-Typ</th>
                  <th>Rabatt</th>
                  <th>Mitgliederpreis</th>
                  <th>Gilt für</th>
                  <th>Status</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filteredArtikel.map(artikel => {
                  const rabattTyp = artikel.rabatt_typ || 'prozent';
                  const rabattWert = artikel.rabatt_wert || globalSettings.standard_rabatt_prozent;
                  const normalpreis = artikel.verkaufspreis_euro || 0;
                  const bruttoPreis = normalpreis * (1 + (artikel.mwst_satz || 19) / 100);

                  let mitgliederpreis = bruttoPreis;
                  if (rabattTyp === 'prozent') {
                    mitgliederpreis = bruttoPreis * (1 - rabattWert / 100);
                  } else {
                    mitgliederpreis = bruttoPreis - (rabattWert / 100); // rabatt_wert in Cent
                  }

                  const hasIndividualRabatt = artikel.hat_individuellen_rabatt;

                  return (
                    <tr key={artikel.artikel_id} className={hasIndividualRabatt ? 'has-individual' : ''}>
                      <td className="checkbox-col">
                        <input
                          type="checkbox"
                          checked={selectedArtikel.includes(artikel.artikel_id)}
                          onChange={() => toggleArtikelSelection(artikel.artikel_id)}
                        />
                      </td>
                      <td className="artikel-info">
                        <div className="artikel-name">{artikel.name}</div>
                        {artikel.artikel_nummer && (
                          <div className="artikel-nummer">#{artikel.artikel_nummer}</div>
                        )}
                      </td>
                      <td className="preis-cell">{bruttoPreis.toFixed(2)} €</td>
                      <td>
                        <select
                          value={rabattTyp}
                          onChange={(e) => handleArtikelRabattChange(artikel.artikel_id, 'rabatt_typ', e.target.value)}
                          className="rabatt-select"
                        >
                          <option value="prozent">Prozent</option>
                          <option value="festbetrag">Festbetrag</option>
                        </select>
                      </td>
                      <td>
                        <div className="rabatt-input-group">
                          <input
                            type="number"
                            value={hasIndividualRabatt ? rabattWert : ''}
                            placeholder={globalSettings.standard_rabatt_prozent}
                            onChange={(e) => handleArtikelRabattChange(
                              artikel.artikel_id,
                              'rabatt_wert',
                              parseFloat(e.target.value) || 0
                            )}
                            className="rabatt-input"
                            min="0"
                            step="0.5"
                          />
                          <span className="input-suffix">
                            {rabattTyp === 'prozent' ? '%' : '€'}
                          </span>
                        </div>
                      </td>
                      <td className="preis-cell mitglieder-preis">
                        {mitgliederpreis.toFixed(2)} €
                        <span className="ersparnis">
                          (-{(bruttoPreis - mitgliederpreis).toFixed(2)} €)
                        </span>
                      </td>
                      <td>
                        <div className="gilt-fuer">
                          <label className="mini-checkbox">
                            <input
                              type="checkbox"
                              checked={artikel.gilt_fuer_dojo !== false}
                              onChange={(e) => handleArtikelRabattChange(
                                artikel.artikel_id,
                                'gilt_fuer_dojo',
                                e.target.checked
                              )}
                            />
                            <span>Dojo</span>
                          </label>
                          <label className="mini-checkbox">
                            <input
                              type="checkbox"
                              checked={artikel.gilt_fuer_einzelperson !== false}
                              onChange={(e) => handleArtikelRabattChange(
                                artikel.artikel_id,
                                'gilt_fuer_einzelperson',
                                e.target.checked
                              )}
                            />
                            <span>Einzel</span>
                          </label>
                        </div>
                      </td>
                      <td>
                        {hasIndividualRabatt ? (
                          <span className="status-individual">Individuell</span>
                        ) : (
                          <span className="status-standard">Standard</span>
                        )}
                      </td>
                      <td className="actions">
                        {artikel.hasChanges && (
                          <button
                            className="action-btn save"
                            onClick={() => saveArtikelRabatt(artikel.artikel_id, {
                              rabatt_typ: artikel.rabatt_typ || 'prozent',
                              rabatt_wert: artikel.rabatt_wert || globalSettings.standard_rabatt_prozent,
                              gilt_fuer_dojo: artikel.gilt_fuer_dojo !== false,
                              gilt_fuer_einzelperson: artikel.gilt_fuer_einzelperson !== false,
                              aktiv: true
                            })}
                            title="Speichern"
                          >
                            💾
                          </button>
                        )}
                        {hasIndividualRabatt && (
                          <button
                            className="action-btn delete"
                            onClick={() => deleteArtikelRabatt(artikel.artikel_id)}
                            title="Individuellen Rabatt entfernen"
                          >
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bulk Modal */}
      {showBulkModal && (
        <div className="modal-overlay" onClick={() => setShowBulkModal(false)}>
          <div className="bulk-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rabatt für {selectedArtikel.length} Artikel setzen</h3>
              <button className="close-btn" onClick={() => setShowBulkModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Rabatt-Typ</label>
                <select
                  value={bulkSettings.rabatt_typ}
                  onChange={(e) => setBulkSettings(prev => ({ ...prev, rabatt_typ: e.target.value }))}
                >
                  <option value="prozent">Prozent</option>
                  <option value="festbetrag">Festbetrag</option>
                </select>
              </div>

              <div className="form-group">
                <label>Rabatt-Wert</label>
                <div className="input-with-suffix">
                  <input
                    type="number"
                    value={bulkSettings.rabatt_wert}
                    onChange={(e) => setBulkSettings(prev => ({
                      ...prev,
                      rabatt_wert: parseFloat(e.target.value) || 0
                    }))}
                    min="0"
                    step="0.5"
                  />
                  <span>{bulkSettings.rabatt_typ === 'prozent' ? '%' : '€'}</span>
                </div>
              </div>

              <div className="form-group">
                <label>Gilt für Mitgliedschaftstypen</label>
                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={bulkSettings.gilt_fuer_dojo}
                      onChange={(e) => setBulkSettings(prev => ({
                        ...prev,
                        gilt_fuer_dojo: e.target.checked
                      }))}
                    />
                    Dojo-Mitglieder
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={bulkSettings.gilt_fuer_einzelperson}
                      onChange={(e) => setBulkSettings(prev => ({
                        ...prev,
                        gilt_fuer_einzelperson: e.target.checked
                      }))}
                    />
                    Einzelpersonen
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="cancel-btn" onClick={() => setShowBulkModal(false)}>
                Abbrechen
              </button>
              <button className="save-btn" onClick={saveBulkRabatte} disabled={saving}>
                {saving ? 'Speichern...' : 'Rabatte setzen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerbandRabatteTab;
