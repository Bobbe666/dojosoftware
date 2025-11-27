import React, { useState, useEffect } from "react";
import { 
  DollarSign, 
  Package, 
  Percent, 
  Users, 
  Calendar, 
  Settings,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Tag,
  Clock
} from "lucide-react";
import config from '../config/config.js';
import "../styles/TarifePreise.css";

const TarifePreise = () => {
  const [tarife, setTarife] = useState([]);
  const [rabatte, setRabatte] = useState([]);
  const [zahlungszyklen, setZahlungszyklen] = useState([]);
  const [laufzeiten, setLaufzeiten] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingTarif, setEditingTarif] = useState(null);
  const [editingRabatt, setEditingRabatt] = useState(null);
  const [showNewTarif, setShowNewTarif] = useState(false);
  const [showNewRabatt, setShowNewRabatt] = useState(false);

  const [newTarif, setNewTarif] = useState({
    name: "",
    beschreibung: "",
    zahlungszyklus_id: "",
    laufzeit_id: "",
    beitrag: "",
    mwst_prozent: 19.00,
    setup_gebuehr: "",
    kategorie: "Standard",
    aktiv: true
  });

  const [newRabatt, setNewRabatt] = useState({
    name: "",
    beschreibung: "",
    rabatt_prozent: "",
    gueltig_von: "",
    gueltig_bis: "",
    max_nutzungen: "",
    aktiv: true
  });

  useEffect(() => {
    loadTarifeUndRabatte();
  }, []);

  const loadTarifeUndRabatte = async () => {
    try {
      setLoading(true);
      
      // Alle benötigten APIs laden
      const [tarifeResponse, rabatteResponse, zahlungszyklenResponse, laufzeitenResponse] = await Promise.all([
        fetch(`${config.apiBaseUrl}/tarife`),
        fetch(`${config.apiBaseUrl}/tarife/rabatte`),
        fetch(`${config.apiBaseUrl}/zahlungszyklen`).catch(() => ({ ok: false })),
        fetch(`${config.apiBaseUrl}/laufzeiten`).catch(() => ({ ok: false }))
      ]);
      
      const tarifeData = await tarifeResponse.json();
      const rabatteData = await rabatteResponse.json();
      
      // Zahlungszyklen und Laufzeiten laden (mit Fallback)
      let zahlungszyklenData = { data: [] };
      let laufzeitenData = { data: [] };
      
      if (zahlungszyklenResponse.ok) {
        zahlungszyklenData = await zahlungszyklenResponse.json();
      }
      
      if (laufzeitenResponse.ok) {
        laufzeitenData = await laufzeitenResponse.json();
      }
      
      if (tarifeData.success && rabatteData.success) {
        // Erweiterte Mapping für Frontend-Kompatibilität
        const mappedTarife = tarifeData.data.map(tarif => ({
          id: tarif.tarif_id,
          name: tarif.name,
          beschreibung: tarif.beschreibung,
          // Erweiterte Felder
          zahlungszyklus_id: tarif.zahlungszyklus_id,
          zahlungszyklus_name: tarif.zahlungszyklus_name,
          laufzeit_id: tarif.laufzeit_id,
          laufzeit_name: tarif.laufzeit_name,
          laufzeit_monate: tarif.laufzeit_monate || tarif.laufzeit_monate,
          beitrag: parseFloat(tarif.beitrag || tarif.preis_monatlich || 0),
          beitrag_brutto: parseFloat(tarif.beitrag_brutto || tarif.preis_monatlich || 0),
          mwst_prozent: parseFloat(tarif.mwst_prozent || 19),
          setup_gebuehr: parseFloat(tarif.setup_gebuehr || tarif.einmalgebuehr || 0),
          kategorie: tarif.kategorie || 'Standard',
          aktiv: tarif.aktiv === 1,
          mitglieder_anzahl: tarif.mitglieder_anzahl || 0
        }));
        
        const mappedRabatte = rabatteData.data.map(rabatt => ({
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
        
        setTarife(mappedTarife);
        setRabatte(mappedRabatte);
        setZahlungszyklen(zahlungszyklenData.data || []);
        setLaufzeiten(laufzeitenData.data || []);
      } else {
        console.error('API Error:', tarifeData.error || rabatteData.error);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Tarife und Rabatte:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTarif = async (tarifId) => {
    if (window.confirm('Sind Sie sicher, dass Sie diesen Tarif löschen möchten?')) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/tarife/${tarifId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          setTarife(tarife.filter(t => t.id !== tarifId));
        } else {
          const errorData = await response.json();
          alert(errorData.message || 'Fehler beim Löschen des Tarifs');
        }
      } catch (error) {
        console.error('Fehler beim Löschen des Tarifs:', error);
        alert('Fehler beim Löschen des Tarifs');
      }
    }
  };

  const handleDeleteRabatt = async (rabattId) => {
    if (window.confirm('Sind Sie sicher, dass Sie diesen Rabatt löschen möchten?')) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/tarife/rabatte/${rabattId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          setRabatte(rabatte.filter(r => r.id !== rabattId));
        } else {
          const errorData = await response.json();
          alert(errorData.message || 'Fehler beim Löschen des Rabatts');
        }
      } catch (error) {
        console.error('Fehler beim Löschen des Rabatts:', error);
        alert('Fehler beim Löschen des Rabatts');
      }
    }
  };

  const handleSaveTarif = async (tarif) => {
    try {
      if (tarif && tarif.id) {
        // Update existing
        const response = await fetch(`${config.apiBaseUrl}/tarife/${tarif.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: tarif.name,
            beschreibung: tarif.beschreibung,
            laufzeit_monate: tarif.laufzeit_monate,
            preis_monatlich: tarif.preis_monatlich,
            einmalgebuehr: tarif.einmalgebuehr,
            aktiv: tarif.aktiv
          })
        });
        
        if (response.ok) {
          const updatedTarife = tarife.map(t => t.id === tarif.id ? tarif : t);
          setTarife(updatedTarife);
          setEditingTarif(null);
        } else {
          alert('Fehler beim Aktualisieren des Tarifs');
        }
      } else {
        // Create new
        const response = await fetch(`${config.apiBaseUrl}/tarife`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: newTarif.name,
            beschreibung: newTarif.beschreibung,
            laufzeit_monate: newTarif.laufzeit_monate,
            preis_monatlich: newTarif.preis_monatlich,
            einmalgebuehr: newTarif.einmalgebuehr,
            aktiv: newTarif.aktiv
          })
        });
        
        if (response.ok) {
          const responseData = await response.json();
          const newTarifWithId = {
            id: responseData.data.tarif_id,
            name: responseData.data.name,
            beschreibung: responseData.data.beschreibung,
            laufzeit_monate: responseData.data.laufzeit_monate,
            preis_monatlich: responseData.data.preis_monatlich,
            einmalgebuehr: responseData.data.einmalgebuehr,
            aktiv: responseData.data.aktiv,
            mitglieder_anzahl: 0
          };
          
          setTarife([...tarife, newTarifWithId]);
          setNewTarif({
            name: "",
            beschreibung: "",
            laufzeit_monate: 12,
            preis_monatlich: "",
            einmalgebuehr: "",
            aktiv: true
          });
          setShowNewTarif(false);
        } else {
          alert('Fehler beim Erstellen des Tarifs');
        }
      }
    } catch (error) {
      console.error('Fehler beim Speichern des Tarifs:', error);
      alert('Fehler beim Speichern des Tarifs');
    }
  };

  const handleSaveRabatt = async (rabatt) => {
    try {
      if (rabatt && rabatt.id) {
        // Update existing
        const response = await fetch(`${config.apiBaseUrl}/tarife/rabatte/${rabatt.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: rabatt.name,
            beschreibung: rabatt.beschreibung,
            rabatt_prozent: rabatt.rabatt_prozent,
            gueltig_von: rabatt.gueltig_von,
            gueltig_bis: rabatt.gueltig_bis,
            max_nutzungen: rabatt.max_nutzungen,
            aktiv: rabatt.aktiv
          })
        });
        
        if (response.ok) {
          const updatedRabatte = rabatte.map(r => r.id === rabatt.id ? rabatt : r);
          setRabatte(updatedRabatte);
          setEditingRabatt(null);
        } else {
          alert('Fehler beim Aktualisieren des Rabatts');
        }
      } else {
        // Create new
        const response = await fetch(`${config.apiBaseUrl}/tarife/rabatte`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: newRabatt.name,
            beschreibung: newRabatt.beschreibung,
            rabatt_prozent: newRabatt.rabatt_prozent,
            gueltig_von: newRabatt.gueltig_von,
            gueltig_bis: newRabatt.gueltig_bis,
            max_nutzungen: newRabatt.max_nutzungen,
            aktiv: newRabatt.aktiv
          })
        });
        
        if (response.ok) {
          const responseData = await response.json();
          const newRabattWithId = {
            id: responseData.data.rabatt_id,
            name: responseData.data.name,
            beschreibung: responseData.data.beschreibung,
            rabatt_prozent: responseData.data.rabatt_prozent,
            gueltig_von: responseData.data.gueltig_von,
            gueltig_bis: responseData.data.gueltig_bis,
            max_nutzungen: responseData.data.max_nutzungen,
            aktiv: responseData.data.aktiv,
            genutzt: 0
          };
          
          setRabatte([...rabatte, newRabattWithId]);
          setNewRabatt({
            name: "",
            beschreibung: "",
            rabatt_prozent: "",
            gueltig_von: "",
            gueltig_bis: "",
            max_nutzungen: "",
            aktiv: true
          });
          setShowNewRabatt(false);
        } else {
          alert('Fehler beim Erstellen des Rabatts');
        }
      }
    } catch (error) {
      console.error('Fehler beim Speichern des Rabatts:', error);
      alert('Fehler beim Speichern des Rabatts');
    }
  };


  if (loading) {
    return (
      <div className="tarife-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Tarif-Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tarife-container">
      <div className="tarife-header">
        <h1>💰 Tarife & Preise</h1>
        <p>Verwalte Mitgliedstarife, Preise und Rabatt-System</p>
      </div>

      {/* Tarife Sektion */}
      <div className="section">
        <div className="section-header">
          <h2><Package size={24} /> Mitgliedstarife</h2>
          <button 
            className="btn btn-primary"
            onClick={() => setShowNewTarif(true)}
          >
            <Plus size={20} /> Neuer Tarif
          </button>
        </div>

        <div className="tarife-grid">
          {tarife.map(tarif => (
            <div key={tarif.id} className={`tarif-card ${!tarif.aktiv ? 'inactive' : ''}`}>
              <div className="tarif-header">
                <div className="tarif-title">
                  <h3>{tarif.name}</h3>
                  <span className={`status-badge ${tarif.aktiv ? 'active' : 'inactive'}`}>
                    {tarif.aktiv ? 'Aktiv' : 'Inaktiv'}
                  </span>
                </div>
                <div className="tarif-actions">
                  <button 
                    className="action-btn edit"
                    onClick={() => setEditingTarif(tarif)}
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDeleteTarif(tarif.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <p className="tarif-beschreibung">{tarif.beschreibung}</p>

              <div className="tarif-details">
                <div className="price-info">
                  <div className="main-price">
                    €{tarif.preis_monatlich.toFixed(2)}
                    <span className="price-unit">/Monat</span>
                  </div>
                  {tarif.einmalgebuehr > 0 && (
                    <div className="setup-fee">
                      + €{tarif.einmalgebuehr.toFixed(2)} Aufnahmegebühr
                    </div>
                  )}
                </div>

                <div className="tarif-stats">
                  <div className="stat">
                    <Clock size={16} />
                    <span>{tarif.laufzeit_monate} Monate</span>
                  </div>
                  <div className="stat">
                    <Users size={16} />
                    <span>{tarif.mitglieder_anzahl} Mitglieder</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Neuer Tarif Modal */}
        {showNewTarif && (
          <div className="modal-overlay" onClick={() => setShowNewTarif(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Neuen Tarif erstellen</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowNewTarif(false)}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={newTarif.name}
                    onChange={(e) => setNewTarif({...newTarif, name: e.target.value})}
                    placeholder="z.B. 12-Monats-Vertrag"
                  />
                </div>
                
                <div className="form-group">
                  <label>Beschreibung</label>
                  <textarea
                    value={newTarif.beschreibung}
                    onChange={(e) => setNewTarif({...newTarif, beschreibung: e.target.value})}
                    placeholder="Kurze Beschreibung des Tarifs"
                    rows="3"
                  />
                </div>
                
                <div className="form-group">
                  <label>Laufzeit (Monate) *</label>
                  <select
                    value={newTarif.laufzeit_monate}
                    onChange={(e) => setNewTarif({...newTarif, laufzeit_monate: parseInt(e.target.value)})}
                  >
                    <option value={3}>3 Monate</option>
                    <option value={6}>6 Monate</option>
                    <option value={12}>12 Monate</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Monatspreis (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newTarif.preis_monatlich}
                    onChange={(e) => setNewTarif({...newTarif, preis_monatlich: parseFloat(e.target.value)})}
                    placeholder="69.00"
                  />
                </div>
                
                <div className="form-group">
                  <label>Aufnahmegebühr (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newTarif.einmalgebuehr}
                    onChange={(e) => setNewTarif({...newTarif, einmalgebuehr: parseFloat(e.target.value) || 0})}
                    placeholder="25.00"
                  />
                </div>
                
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newTarif.aktiv}
                      onChange={(e) => setNewTarif({...newTarif, aktiv: e.target.checked})}
                    />
                    <span>Tarif ist aktiv</span>
                  </label>
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setShowNewTarif(false)}
                >
                  Abbrechen
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleSaveTarif()}
                >
                  <Save size={16} /> Tarif speichern
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tarif Bearbeiten Modal */}
        {editingTarif && (
          <div className="modal-overlay" onClick={() => setEditingTarif(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Tarif bearbeiten</h3>
                <button 
                  className="close-btn"
                  onClick={() => setEditingTarif(null)}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={editingTarif.name}
                    onChange={(e) => setEditingTarif({...editingTarif, name: e.target.value})}
                    placeholder="z.B. 12-Monats-Vertrag"
                  />
                </div>
                
                <div className="form-group">
                  <label>Beschreibung</label>
                  <textarea
                    value={editingTarif.beschreibung}
                    onChange={(e) => setEditingTarif({...editingTarif, beschreibung: e.target.value})}
                    placeholder="Kurze Beschreibung des Tarifs"
                    rows="3"
                  />
                </div>
                
                <div className="form-group">
                  <label>Laufzeit (Monate) *</label>
                  <select
                    value={editingTarif.laufzeit_monate}
                    onChange={(e) => setEditingTarif({...editingTarif, laufzeit_monate: parseInt(e.target.value)})}
                  >
                    <option value={3}>3 Monate</option>
                    <option value={6}>6 Monate</option>
                    <option value={12}>12 Monate</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Monatspreis (€) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingTarif.preis_monatlich}
                    onChange={(e) => setEditingTarif({...editingTarif, preis_monatlich: parseFloat(e.target.value)})}
                    placeholder="69.00"
                  />
                </div>
                
                <div className="form-group">
                  <label>Aufnahmegebühr (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingTarif.einmalgebuehr || 0}
                    onChange={(e) => setEditingTarif({...editingTarif, einmalgebuehr: parseFloat(e.target.value) || 0})}
                    placeholder="25.00"
                  />
                </div>
                
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={editingTarif.aktiv}
                      onChange={(e) => setEditingTarif({...editingTarif, aktiv: e.target.checked})}
                    />
                    <span>Tarif ist aktiv</span>
                  </label>
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  type="button"
                  className="cancel-btn"
                  onClick={() => setEditingTarif(null)}
                >
                  Abbrechen
                </button>
                <button 
                  type="submit"
                  className="save-btn"
                  onClick={() => {
                    handleSaveTarif(editingTarif);
                    setEditingTarif(null);
                  }}
                >
                  <Save size={16} /> Änderungen speichern
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rabatte Sektion */}
      <div className="section">
        <div className="section-header">
          <h2><Percent size={24} /> Rabatt-System</h2>
          <button 
            className="btn btn-success"
            onClick={() => setShowNewRabatt(true)}
          >
            <Plus size={20} /> Neuer Rabatt
          </button>
        </div>

        <div className="rabatte-grid">
          {rabatte.map(rabatt => (
            <div key={rabatt.id} className={`rabatt-card ${!rabatt.aktiv ? 'inactive' : ''}`}>
              <div className="rabatt-header">
                <div className="rabatt-title">
                  <h3>{rabatt.name}</h3>
                  <div className="rabatt-percentage">
                    -{rabatt.rabatt_prozent}%
                  </div>
                </div>
                <div className="rabatt-actions">
                  <button 
                    className="action-btn edit"
                    onClick={() => setEditingRabatt(rabatt)}
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDeleteRabatt(rabatt.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <p className="rabatt-beschreibung">{rabatt.beschreibung}</p>

              <div className="rabatt-details">
                <div className="validity-period">
                  <Calendar size={16} />
                  <span>
                    {new Date(rabatt.gueltig_von).toLocaleDateString('de-DE')} - 
                    {new Date(rabatt.gueltig_bis).toLocaleDateString('de-DE')}
                  </span>
                </div>
                
                <div className="usage-stats">
                  <Tag size={16} />
                  <span>{rabatt.genutzt}x genutzt</span>
                  {rabatt.max_nutzungen && (
                    <span> / {rabatt.max_nutzungen} max</span>
                  )}
                </div>
              </div>

              <div className={`rabatt-status ${rabatt.aktiv ? 'active' : 'inactive'}`}>
                {rabatt.aktiv ? 'Aktiv' : 'Inaktiv'}
              </div>
            </div>
          ))}
        </div>

        {/* Neuer Rabatt Modal */}
        {showNewRabatt && (
          <div className="modal-overlay" onClick={() => setShowNewRabatt(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Neuen Rabatt erstellen</h3>
                <button 
                  className="close-btn"
                  onClick={() => setShowNewRabatt(false)}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={newRabatt.name}
                    onChange={(e) => setNewRabatt({...newRabatt, name: e.target.value})}
                    placeholder="z.B. Familienrabatt"
                  />
                </div>
                
                <div className="form-group">
                  <label>Beschreibung</label>
                  <textarea
                    value={newRabatt.beschreibung}
                    onChange={(e) => setNewRabatt({...newRabatt, beschreibung: e.target.value})}
                    placeholder="Beschreibung des Rabatts"
                    rows="3"
                  />
                </div>
                
                <div className="form-group">
                  <label>Rabatt (%) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={newRabatt.rabatt_prozent}
                    onChange={(e) => setNewRabatt({...newRabatt, rabatt_prozent: parseFloat(e.target.value)})}
                    placeholder="15"
                  />
                </div>
                
                <div className="form-group">
                  <label>Gültig von *</label>
                  <input
                    type="date"
                    value={newRabatt.gueltig_von}
                    onChange={(e) => setNewRabatt({...newRabatt, gueltig_von: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>Gültig bis *</label>
                  <input
                    type="date"
                    value={newRabatt.gueltig_bis}
                    onChange={(e) => setNewRabatt({...newRabatt, gueltig_bis: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>Max. Nutzungen</label>
                  <input
                    type="number"
                    min="1"
                    value={newRabatt.max_nutzungen}
                    onChange={(e) => setNewRabatt({...newRabatt, max_nutzungen: parseInt(e.target.value) || null})}
                    placeholder="Leer = unbegrenzt"
                  />
                </div>
                
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newRabatt.aktiv}
                      onChange={(e) => setNewRabatt({...newRabatt, aktiv: e.target.checked})}
                    />
                    <span>Rabatt ist aktiv</span>
                  </label>
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="btn btn-secondary"
                  onClick={() => setShowNewRabatt(false)}
                >
                  Abbrechen
                </button>
                <button 
                  className="btn btn-success"
                  onClick={() => handleSaveRabatt()}
                >
                  <Save size={16} /> Rabatt speichern
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rabatt Bearbeiten Modal */}
        {editingRabatt && (
          <div className="modal-overlay" onClick={() => setEditingRabatt(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Rabatt bearbeiten</h3>
                <button 
                  className="close-btn"
                  onClick={() => setEditingRabatt(null)}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="form-grid">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={editingRabatt.name}
                    onChange={(e) => setEditingRabatt({...editingRabatt, name: e.target.value})}
                    placeholder="z.B. Familienrabatt"
                  />
                </div>
                
                <div className="form-group">
                  <label>Beschreibung</label>
                  <textarea
                    value={editingRabatt.beschreibung}
                    onChange={(e) => setEditingRabatt({...editingRabatt, beschreibung: e.target.value})}
                    placeholder="Kurze Beschreibung des Rabatts"
                    rows="3"
                  />
                </div>
                
                <div className="form-group">
                  <label>Rabatt (%) *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={editingRabatt.rabatt_prozent}
                    onChange={(e) => setEditingRabatt({...editingRabatt, rabatt_prozent: parseInt(e.target.value)})}
                    placeholder="15"
                  />
                </div>
                
                <div className="form-group">
                  <label>Gültig von *</label>
                  <input
                    type="date"
                    value={editingRabatt.gueltig_von?.split('T')[0]}
                    onChange={(e) => setEditingRabatt({...editingRabatt, gueltig_von: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>Gültig bis *</label>
                  <input
                    type="date"
                    value={editingRabatt.gueltig_bis?.split('T')[0]}
                    onChange={(e) => setEditingRabatt({...editingRabatt, gueltig_bis: e.target.value})}
                  />
                </div>
                
                <div className="form-group">
                  <label>Max. Nutzungen</label>
                  <input
                    type="number"
                    min="1"
                    value={editingRabatt.max_nutzungen || ''}
                    onChange={(e) => setEditingRabatt({...editingRabatt, max_nutzungen: parseInt(e.target.value) || null})}
                    placeholder="Leer = unbegrenzt"
                  />
                </div>
                
                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={editingRabatt.aktiv}
                      onChange={(e) => setEditingRabatt({...editingRabatt, aktiv: e.target.checked})}
                    />
                    <span>Rabatt ist aktiv</span>
                  </label>
                </div>
              </div>
              
              <div className="form-actions">
                <button 
                  type="button"
                  className="cancel-btn"
                  onClick={() => setEditingRabatt(null)}
                >
                  Abbrechen
                </button>
                <button 
                  type="submit"
                  className="save-btn"
                  onClick={() => {
                    handleSaveRabatt(editingRabatt);
                    setEditingRabatt(null);
                  }}
                >
                  <Save size={16} /> Änderungen speichern
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Übersichts-Statistiken */}
      <div className="stats-section">
        <h2>📊 Übersicht</h2>
        <div className="overview-stats">
          <div className="stat-card">
            <div className="stat-icon primary">
              <Package size={32} />
            </div>
            <div className="stat-info">
              <h3>Aktive Tarife</h3>
              <p className="stat-value">{tarife.filter(t => t.aktiv).length}</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon success">
              <Percent size={32} />
            </div>
            <div className="stat-info">
              <h3>Aktive Rabatte</h3>
              <p className="stat-value">{rabatte.filter(r => r.aktiv).length}</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon info">
              <Users size={32} />
            </div>
            <div className="stat-info">
              <h3>Gesamt Mitglieder</h3>
              <p className="stat-value">{tarife.reduce((sum, t) => sum + t.mitglieder_anzahl, 0)}</p>
            </div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon warning">
              <DollarSign size={32} />
            </div>
            <div className="stat-info">
              <h3>Ø Monatspreis</h3>
              <p className="stat-value">
                €{(tarife.reduce((sum, t) => sum + t.preis_monatlich, 0) / tarife.length).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TarifePreise;