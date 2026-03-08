import React, { useState, useEffect } from "react";
import {
  Percent,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Calendar,
  Users,
  Tag,
  CheckCircle,
  XCircle,
  DollarSign,
  Infinity
} from "lucide-react";
import axios from 'axios';
import { useDojoContext } from '../context/DojoContext';
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/TarifePreise.css";
import "../styles/Rabattsystem.css";

const Rabattsystem = () => {
  const { activeDojo } = useDojoContext();
  const [rabatte, setRabatte] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRabatt, setEditingRabatt] = useState(null);
  const [showNewRabatt, setShowNewRabatt] = useState(false);

  const [newRabatt, setNewRabatt] = useState({
    name: "",
    beschreibung: "",
    rabatt_typ: "prozent",
    rabatt_prozent: "",
    rabatt_betrag_euro: "",  // String für Euro-Eingabe
    gueltig_von: "",
    gueltig_bis: "",
    max_nutzungen: "",
    aktiv: true,
    ist_familien_rabatt: false,
    familie_position_min: "",
    familie_position_max: ""
  });

  const getDojoId = () => {
    if (!activeDojo || activeDojo === 'super-admin') {
      return null;
    }
    return activeDojo.id;
  };

  useEffect(() => {
    loadRabatte();
  }, [activeDojo]);

  const loadRabatte = async () => {
    try {
      setLoading(true);
      const dojoId = getDojoId();
      const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';

      const response = await axios.get(`/tarife/rabatte${dojoParam}`);
      const data = response.data;

      if (data.success) {
        const mappedRabatte = data.data.map(rabatt => ({
          id: rabatt.rabatt_id,
          name: rabatt.name,
          beschreibung: rabatt.beschreibung,
          rabatt_typ: rabatt.rabatt_typ || 'prozent',
          rabatt_prozent: rabatt.rabatt_prozent ? parseFloat(rabatt.rabatt_prozent) : null,
          rabatt_betrag_cents: rabatt.rabatt_betrag_cents,
          gueltig_von: rabatt.gueltig_von,
          gueltig_bis: rabatt.gueltig_bis,
          max_nutzungen: rabatt.max_nutzungen,
          aktiv: rabatt.aktiv === 1,
          genutzt: rabatt.genutzt || 0,
          ist_familien_rabatt: rabatt.ist_familien_rabatt === 1,
          familie_position_min: rabatt.familie_position_min,
          familie_position_max: rabatt.familie_position_max
        }));
        setRabatte(mappedRabatte);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Rabatte:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRabatt = async (rabattData) => {
    try {
      const dojoId = getDojoId();
      const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';

      // Konvertiere Euro-String zu Cent für die API
      const dataToSend = {
        ...rabattData,
        rabatt_betrag_cents: rabattData.rabatt_betrag_euro
          ? Math.round(parseFloat(rabattData.rabatt_betrag_euro.replace(',', '.')) * 100)
          : null
      };
      delete dataToSend.rabatt_betrag_euro;

      let response;
      if (rabattData.id) {
        response = await axios.put(`/tarife/rabatte/${rabattData.id}${dojoParam}`, dataToSend);
      } else {
        response = await axios.post(`/tarife/rabatte${dojoParam}`, dataToSend);
      }

      if (response.data.success) {
        await loadRabatte();
        setShowNewRabatt(false);
        setEditingRabatt(null);
        setNewRabatt({
          name: "",
          beschreibung: "",
          rabatt_typ: "prozent",
          rabatt_prozent: "",
          rabatt_betrag_euro: "",
          gueltig_von: "",
          gueltig_bis: "",
          max_nutzungen: "",
          aktiv: true,
          ist_familien_rabatt: false,
          familie_position_min: "",
          familie_position_max: ""
        });
      } else {
        alert('Fehler beim Speichern: ' + response.data.error);
      }
    } catch (error) {
      console.error('Fehler beim Speichern des Rabatts:', error);
      alert('Fehler beim Speichern des Rabatts');
    }
  };

  const handleDeleteRabatt = async (rabattId) => {
    if (window.confirm('Sind Sie sicher, dass Sie diesen Rabatt löschen möchten?')) {
      try {
        const dojoId = getDojoId();
        const dojoParam = dojoId ? `?dojo_id=${dojoId}` : '';
        const response = await axios.delete(`/tarife/rabatte/${rabattId}${dojoParam}`);

        if (response.data.success) {
          await loadRabatte();
        } else {
          alert('Fehler beim Löschen: ' + response.data.error);
        }
      } catch (error) {
        console.error('Fehler beim Löschen des Rabatts:', error);
        alert('Fehler beim Löschen des Rabatts');
      }
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unbegrenzt';
    return new Date(dateString).toLocaleDateString('de-DE');
  };

  const formatRabattValue = (rabatt) => {
    if (rabatt.rabatt_typ === 'betrag' && rabatt.rabatt_betrag_cents) {
      return `${(rabatt.rabatt_betrag_cents / 100).toFixed(2)} €`;
    }
    return `${rabatt.rabatt_prozent || 0}%`;
  };

  const isRabattActive = (rabatt) => {
    if (!rabatt.aktiv) return false;
    const now = new Date();
    const von = rabatt.gueltig_von ? new Date(rabatt.gueltig_von) : null;
    const bis = rabatt.gueltig_bis ? new Date(rabatt.gueltig_bis) : null;

    if (von && now < von) return false;
    if (bis && now > bis) return false;
    if (rabatt.max_nutzungen && rabatt.genutzt >= rabatt.max_nutzungen) return false;

    return true;
  };

  // Bereitet Rabatt für Bearbeitung vor (konvertiert Cent zu Euro-String)
  const prepareRabattForEdit = (rabatt) => {
    return {
      ...rabatt,
      rabatt_betrag_euro: rabatt.rabatt_betrag_cents
        ? (rabatt.rabatt_betrag_cents / 100).toFixed(2)
        : '',
      familie_position_min: rabatt.familie_position_min || '',
      familie_position_max: rabatt.familie_position_max || ''
    };
  };

  // Modal Header Style für Light Mode
  const modalHeaderStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--border-color, #e5e7eb)',
    background: 'var(--card-bg, #1e293b)',
    borderRadius: '0.5rem 0.5rem 0 0'
  };

  const modalHeaderTitleStyle = {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: '600',
    color: 'var(--text-primary, #f8fafc)'
  };

  if (loading) {
    return (
      <div className="tarife-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Rabatt-Daten...</p>
        </div>
      </div>
    );
  }

  const aktiveRabatte = rabatte.filter(r => isRabattActive(r));
  const inaktiveRabatte = rabatte.filter(r => !isRabattActive(r));

  return (
    <div className="tarife-container">
      <div className="tarife-header">
        <h1>Rabattsystem</h1>
        <p>Verwalte alle Rabatte und Sonderkonditionen für Mitgliedschaften</p>
      </div>

      {/* Statistik-Übersicht */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">
            <Percent size={32} />
          </div>
          <div className="stat-info">
            <h3>Gesamt Rabatte</h3>
            <p className="stat-value">{rabatte.length}</p>
            <span className="stat-trend">definiert</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <CheckCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>Aktive Rabatte</h3>
            <p className="stat-value">{aktiveRabatte.length}</p>
            <span className="stat-trend">aktuell nutzbar</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">
            <XCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>Inaktive Rabatte</h3>
            <p className="stat-value">{inaktiveRabatte.length}</p>
            <span className="stat-trend">abgelaufen/deaktiviert</span>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">
            <Users size={32} />
          </div>
          <div className="stat-info">
            <h3>Gesamtnutzungen</h3>
            <p className="stat-value">{rabatte.reduce((sum, r) => sum + (r.genutzt || 0), 0)}</p>
            <span className="stat-trend">angewendet</span>
          </div>
        </div>
      </div>

      {/* Aktive Rabatte Sektion */}
      <div className="section">
        <div className="section-header">
          <h2>
            <CheckCircle size={24} /> Aktive Rabatte
            <span className="tarif-count">({aktiveRabatte.length})</span>
          </h2>
          <div className="header-actions">
            <button
              className="btn btn-primary"
              onClick={() => setShowNewRabatt(true)}
            >
              <Plus size={20} />
              Neuer Rabatt
            </button>
          </div>
        </div>

        {aktiveRabatte.length === 0 ? (
          <div className="info-box">
            <p>Keine aktiven Rabatte vorhanden. Erstellen Sie einen neuen Rabatt.</p>
          </div>
        ) : (
          <div className="tarife-grid">
            {aktiveRabatte.map(rabatt => (
              <div key={rabatt.id} className="tarif-card">
                <div className="tarif-header">
                  <div className="tarif-title">
                    <h3>{rabatt.name}</h3>
                    <div className="u-flex-wrap-gap">
                      <span className="status-badge active">Aktiv</span>
                      {rabatt.ist_familien_rabatt && (
                        <span className="status-badge rs-badge-purple">
                          <Users size={12} className="rs-mr-025" />
                          Familie
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="tarif-actions">
                    <button
                      className="action-btn edit"
                      onClick={() => setEditingRabatt(prepareRabattForEdit(rabatt))}
                      title="Bearbeiten"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteRabatt(rabatt.id)}
                      title="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="tarif-price">
                  <span className="currency">{rabatt.rabatt_typ === 'betrag' ? '-' : '-'}</span>
                  {formatRabattValue(rabatt)}
                </div>

                <div className="tarif-details">
                  {rabatt.beschreibung && (
                    <div className="detail-item rs-detail-full">
                      <span className="label">
                        <Tag size={14} /> Beschreibung
                      </span>
                      <div className="value">{rabatt.beschreibung}</div>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="label">
                      {rabatt.rabatt_typ === 'betrag' ? <DollarSign size={14} /> : <Percent size={14} />} Typ
                    </span>
                    <div className="value">{rabatt.rabatt_typ === 'betrag' ? 'Festbetrag' : 'Prozent'}</div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Calendar size={14} /> Gültig von
                    </span>
                    <div className="value">{formatDate(rabatt.gueltig_von)}</div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Calendar size={14} /> Gültig bis
                    </span>
                    <div className="value rs-value-icon">
                      {rabatt.gueltig_bis ? formatDate(rabatt.gueltig_bis) : (
                        <>
                          <Infinity size={14} /> Unbegrenzt
                        </>
                      )}
                    </div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Users size={14} /> Nutzungen
                    </span>
                    <div className="value">
                      {rabatt.genutzt || 0}{rabatt.max_nutzungen ? ` / ${rabatt.max_nutzungen}` : ' (unbegrenzt)'}
                    </div>
                  </div>
                  {rabatt.ist_familien_rabatt && (
                    <div className="detail-item">
                      <span className="label">
                        <Users size={14} /> Gilt für
                      </span>
                      <div className="value">
                        {rabatt.familie_position_min === rabatt.familie_position_max
                          ? `${rabatt.familie_position_min}. Familienmitglied`
                          : rabatt.familie_position_max
                            ? `${rabatt.familie_position_min}. - ${rabatt.familie_position_max}. Familienmitglied`
                            : `${rabatt.familie_position_min}.+ Familienmitglied`
                        }
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inaktive Rabatte Sektion */}
      {inaktiveRabatte.length > 0 && (
        <div className="section">
          <div
            className="section-header rs-section-header-inactive"
          >
            <h2 className="u-text-muted">
              <XCircle size={24} /> Inaktive Rabatte
              <span className="tarif-count">({inaktiveRabatte.length})</span>
            </h2>
          </div>

          <div className="tarife-grid">
            {inaktiveRabatte.map(rabatt => (
              <div key={rabatt.id} className="tarif-card rs-card-inactive">
                <div className="tarif-header">
                  <div className="tarif-title">
                    <h3>{rabatt.name}</h3>
                    <span className="status-badge rs-badge-gray">
                      Inaktiv
                    </span>
                  </div>
                  <div className="tarif-actions">
                    <button
                      className="action-btn edit"
                      onClick={() => setEditingRabatt(prepareRabattForEdit(rabatt))}
                      title="Bearbeiten"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteRabatt(rabatt.id)}
                      title="Löschen"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="tarif-price">
                  <span className="currency">-</span>
                  {formatRabattValue(rabatt)}
                </div>

                <div className="tarif-details">
                  <div className="detail-item">
                    <span className="label">
                      <Calendar size={14} /> Gültig von
                    </span>
                    <div className="value">{formatDate(rabatt.gueltig_von)}</div>
                  </div>
                  <div className="detail-item">
                    <span className="label">
                      <Calendar size={14} /> Gültig bis
                    </span>
                    <div className="value">{formatDate(rabatt.gueltig_bis)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Neuer Rabatt Modal */}
      {showNewRabatt && (
        <div className="modal-overlay">
          <div className="modal rs-max-600">
            <div style={modalHeaderStyle}>
              <h3 style={modalHeaderTitleStyle}>Neuer Rabatt</h3>
              <button
                className="close-btn rs-close-btn"
                onClick={() => setShowNewRabatt(false)}
              >
                <X size={20} className="rs-icon-primary" />
              </button>
            </div>

            <div className="rs-p-15">
              <div className="rs-mb-1">
                <label className="u-form-label">
                  Name *
                </label>
                <input
                  type="text"
                  value={newRabatt.name}
                  onChange={(e) => setNewRabatt({...newRabatt, name: e.target.value})}
                  placeholder="z.B. Familienrabatt, Studentenrabatt"
                  className="u-input-sm"
                />
              </div>

              <div className="rs-mb-1">
                <label className="u-form-label">
                  Beschreibung
                </label>
                <textarea
                  value={newRabatt.beschreibung}
                  onChange={(e) => setNewRabatt({...newRabatt, beschreibung: e.target.value})}
                  placeholder="Beschreibung des Rabatts..."
                  rows={3}
                  className="u-input-sm"
                />
              </div>

              {/* Rabatt-Typ Auswahl */}
              <div className="rs-mb-1">
                <label className="u-form-label">
                  Rabatt-Typ *
                </label>
                <div className="rs-flex-gap-1">
                  <label className="rs-label-check">
                    <input
                      type="radio"
                      name="rabatt_typ"
                      value="prozent"
                      checked={newRabatt.rabatt_typ === 'prozent'}
                      onChange={(e) => setNewRabatt({...newRabatt, rabatt_typ: e.target.value, rabatt_betrag_euro: ''})}
                    />
                    <Percent size={16} /> Prozent
                  </label>
                  <label className="rs-label-check">
                    <input
                      type="radio"
                      name="rabatt_typ"
                      value="betrag"
                      checked={newRabatt.rabatt_typ === 'betrag'}
                      onChange={(e) => setNewRabatt({...newRabatt, rabatt_typ: e.target.value, rabatt_prozent: ''})}
                    />
                    <DollarSign size={16} /> Festbetrag
                  </label>
                </div>
              </div>

              <div className="u-grid-2col">
                {newRabatt.rabatt_typ === 'prozent' ? (
                  <div>
                    <label className="u-form-label">
                      Rabatt (%) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={newRabatt.rabatt_prozent}
                      onChange={(e) => setNewRabatt({...newRabatt, rabatt_prozent: e.target.value})}
                      placeholder="z.B. 10"
                      className="u-input-sm"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="u-form-label">
                      Rabatt-Betrag (EUR) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={newRabatt.rabatt_betrag_euro}
                      onChange={(e) => setNewRabatt({...newRabatt, rabatt_betrag_euro: e.target.value})}
                      placeholder="z.B. 5.00 oder 10,50"
                      className="u-input-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="u-form-label">
                    Max. Nutzungen
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={newRabatt.max_nutzungen}
                    onChange={(e) => setNewRabatt({...newRabatt, max_nutzungen: e.target.value})}
                    placeholder="Leer = unbegrenzt"
                    className="u-input-sm"
                  />
                </div>
              </div>

              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">
                    Gültig von *
                  </label>
                  <input
                    type="date"
                    value={newRabatt.gueltig_von}
                    onChange={(e) => setNewRabatt({...newRabatt, gueltig_von: e.target.value})}
                    className="u-input-sm"
                  />
                </div>
                <div>
                  <label className="u-form-label">
                    Gültig bis <span className="rs-hint">(leer = unbegrenzt)</span>
                  </label>
                  <input
                    type="date"
                    value={newRabatt.gueltig_bis}
                    onChange={(e) => setNewRabatt({...newRabatt, gueltig_bis: e.target.value})}
                    className="u-input-sm"
                  />
                </div>
              </div>

              <div className="rs-mb-1">
                <label className="rs-label-check-sm">
                  <input
                    type="checkbox"
                    checked={newRabatt.aktiv}
                    onChange={(e) => setNewRabatt({...newRabatt, aktiv: e.target.checked})}
                  />
                  Rabatt ist aktiv
                </label>
              </div>

              {/* Familien-Rabatt Einstellungen */}
              <div className="rs-familien-box">
                <label className="rs-label-check-sm-mb">
                  <input
                    type="checkbox"
                    checked={newRabatt.ist_familien_rabatt}
                    onChange={(e) => setNewRabatt({...newRabatt, ist_familien_rabatt: e.target.checked})}
                  />
                  <Users size={16} />
                  Familien-Rabatt (für 2., 3., ... Familienmitglied)
                </label>

                {newRabatt.ist_familien_rabatt && (
                  <div className="rs-familien-grid">
                    <div>
                      <label className="u-form-label">
                        Ab Position *
                      </label>
                      <input
                        type="number"
                        min="2"
                        value={newRabatt.familie_position_min}
                        onChange={(e) => setNewRabatt({...newRabatt, familie_position_min: e.target.value})}
                        placeholder="z.B. 2 für 2. Mitglied"
                        className="u-input-sm"
                      />
                    </div>
                    <div>
                      <label className="u-form-label">
                        Bis Position <span className="rs-hint">(leer = unbegrenzt)</span>
                      </label>
                      <input
                        type="number"
                        min="2"
                        value={newRabatt.familie_position_max}
                        onChange={(e) => setNewRabatt({...newRabatt, familie_position_max: e.target.value})}
                        placeholder="z.B. 2 für nur 2. Mitglied"
                        className="u-input-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rs-modal-footer">
                <button
                  className="btn btn-secondary rs-btn-sm"
                  onClick={() => setShowNewRabatt(false)}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-primary rs-btn-sm-icon"
                  onClick={() => handleSaveRabatt(newRabatt)}
                  disabled={!newRabatt.name || !newRabatt.gueltig_von || (newRabatt.rabatt_typ === 'prozent' ? !newRabatt.rabatt_prozent : !newRabatt.rabatt_betrag_euro)}
                >
                  <Save size={16} />
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rabatt bearbeiten Modal */}
      {editingRabatt && (
        <div className="modal-overlay">
          <div className="modal rs-max-600">
            <div style={modalHeaderStyle}>
              <h3 style={modalHeaderTitleStyle}>Rabatt bearbeiten</h3>
              <button
                className="close-btn rs-close-btn"
                onClick={() => setEditingRabatt(null)}
              >
                <X size={20} className="rs-icon-primary" />
              </button>
            </div>

            <div className="rs-p-15">
              <div className="rs-mb-1">
                <label className="u-form-label">
                  Name *
                </label>
                <input
                  type="text"
                  value={editingRabatt.name}
                  onChange={(e) => setEditingRabatt({...editingRabatt, name: e.target.value})}
                  className="u-input-sm"
                />
              </div>

              <div className="rs-mb-1">
                <label className="u-form-label">
                  Beschreibung
                </label>
                <textarea
                  value={editingRabatt.beschreibung || ''}
                  onChange={(e) => setEditingRabatt({...editingRabatt, beschreibung: e.target.value})}
                  rows={3}
                  className="u-input-sm"
                />
              </div>

              {/* Rabatt-Typ Auswahl */}
              <div className="rs-mb-1">
                <label className="u-form-label">
                  Rabatt-Typ *
                </label>
                <div className="rs-flex-gap-1">
                  <label className="rs-label-check">
                    <input
                      type="radio"
                      name="edit_rabatt_typ"
                      value="prozent"
                      checked={editingRabatt.rabatt_typ === 'prozent'}
                      onChange={(e) => setEditingRabatt({...editingRabatt, rabatt_typ: e.target.value, rabatt_betrag_euro: ''})}
                    />
                    <Percent size={16} /> Prozent
                  </label>
                  <label className="rs-label-check">
                    <input
                      type="radio"
                      name="edit_rabatt_typ"
                      value="betrag"
                      checked={editingRabatt.rabatt_typ === 'betrag'}
                      onChange={(e) => setEditingRabatt({...editingRabatt, rabatt_typ: e.target.value, rabatt_prozent: null})}
                    />
                    <DollarSign size={16} /> Festbetrag
                  </label>
                </div>
              </div>

              <div className="u-grid-2col">
                {editingRabatt.rabatt_typ === 'prozent' ? (
                  <div>
                    <label className="u-form-label">
                      Rabatt (%) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={editingRabatt.rabatt_prozent || ''}
                      onChange={(e) => setEditingRabatt({...editingRabatt, rabatt_prozent: parseFloat(e.target.value)})}
                      className="u-input-sm"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="u-form-label">
                      Rabatt-Betrag (EUR) *
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={editingRabatt.rabatt_betrag_euro || ''}
                      onChange={(e) => setEditingRabatt({...editingRabatt, rabatt_betrag_euro: e.target.value})}
                      placeholder="z.B. 5.00 oder 10,50"
                      className="u-input-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="u-form-label">
                    Max. Nutzungen
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editingRabatt.max_nutzungen || ''}
                    onChange={(e) => setEditingRabatt({...editingRabatt, max_nutzungen: e.target.value ? parseInt(e.target.value) : null})}
                    placeholder="Leer = unbegrenzt"
                    className="u-input-sm"
                  />
                </div>
              </div>

              <div className="u-grid-2col">
                <div>
                  <label className="u-form-label">
                    Gültig von *
                  </label>
                  <input
                    type="date"
                    value={editingRabatt.gueltig_von ? editingRabatt.gueltig_von.split('T')[0] : ''}
                    onChange={(e) => setEditingRabatt({...editingRabatt, gueltig_von: e.target.value})}
                    className="u-input-sm"
                  />
                </div>
                <div>
                  <label className="u-form-label">
                    Gültig bis <span className="rs-hint">(leer = unbegrenzt)</span>
                  </label>
                  <input
                    type="date"
                    value={editingRabatt.gueltig_bis ? editingRabatt.gueltig_bis.split('T')[0] : ''}
                    onChange={(e) => setEditingRabatt({...editingRabatt, gueltig_bis: e.target.value})}
                    className="u-input-sm"
                  />
                </div>
              </div>

              <div className="rs-mb-1">
                <label className="rs-label-check-sm">
                  <input
                    type="checkbox"
                    checked={editingRabatt.aktiv}
                    onChange={(e) => setEditingRabatt({...editingRabatt, aktiv: e.target.checked})}
                  />
                  Rabatt ist aktiv
                </label>
              </div>

              {/* Familien-Rabatt Einstellungen */}
              <div className="rs-familien-box">
                <label className="rs-label-check-sm-mb">
                  <input
                    type="checkbox"
                    checked={editingRabatt.ist_familien_rabatt}
                    onChange={(e) => setEditingRabatt({...editingRabatt, ist_familien_rabatt: e.target.checked})}
                  />
                  <Users size={16} />
                  Familien-Rabatt (für 2., 3., ... Familienmitglied)
                </label>

                {editingRabatt.ist_familien_rabatt && (
                  <div className="rs-familien-grid">
                    <div>
                      <label className="u-form-label">
                        Ab Position *
                      </label>
                      <input
                        type="number"
                        min="2"
                        value={editingRabatt.familie_position_min || ''}
                        onChange={(e) => setEditingRabatt({...editingRabatt, familie_position_min: e.target.value})}
                        placeholder="z.B. 2 für 2. Mitglied"
                        className="u-input-sm"
                      />
                    </div>
                    <div>
                      <label className="u-form-label">
                        Bis Position <span className="rs-hint">(leer = unbegrenzt)</span>
                      </label>
                      <input
                        type="number"
                        min="2"
                        value={editingRabatt.familie_position_max || ''}
                        onChange={(e) => setEditingRabatt({...editingRabatt, familie_position_max: e.target.value})}
                        placeholder="z.B. 2 für nur 2. Mitglied"
                        className="u-input-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rs-modal-footer">
                <button
                  className="btn btn-secondary rs-btn-sm"
                  onClick={() => setEditingRabatt(null)}
                >
                  Abbrechen
                </button>
                <button
                  className="btn btn-primary rs-btn-sm-icon"
                  onClick={() => handleSaveRabatt(editingRabatt)}
                  disabled={!editingRabatt.name || (editingRabatt.rabatt_typ === 'prozent' ? !editingRabatt.rabatt_prozent : !editingRabatt.rabatt_betrag_euro)}
                >
                  <Save size={16} />
                  Speichern
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rabattsystem;
