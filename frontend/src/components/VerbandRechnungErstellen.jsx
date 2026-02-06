import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  FileText, Plus, Trash2, Save, Eye, Download, Building2, User,
  Euro, Calendar, Search, X, CheckCircle, AlertCircle, Loader2, ShoppingBag
} from 'lucide-react';
import '../styles/VerbandRechnungErstellen.css';

const VerbandRechnungErstellen = ({ token: propToken }) => {
  const { token: contextToken } = useAuth();
  const token = propToken || contextToken;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Empfänger
  const [empfaenger, setEmpfaenger] = useState({ verbandsmitglieder: [], softwareNutzer: [] });
  const [selectedEmpfaenger, setSelectedEmpfaenger] = useState(null);
  const [empfaengerTyp, setEmpfaengerTyp] = useState('verbandsmitglied'); // verbandsmitglied | software_nutzer | manuell
  const [searchTerm, setSearchTerm] = useState('');

  // Rechnungsdaten
  const [rechnungsnummer, setRechnungsnummer] = useState('');
  const [rechnungsdatum, setRechnungsdatum] = useState(new Date().toISOString().split('T')[0]);
  const [leistungsdatum, setLeistungsdatum] = useState(new Date().toISOString().split('T')[0]);
  const [faelligAm, setFaelligAm] = useState('');
  const [notizen, setNotizen] = useState('');

  // Manuelle Empfängerdaten
  const [manuellName, setManuellName] = useState('');
  const [manuellAdresse, setManuellAdresse] = useState('');
  const [manuellEmail, setManuellEmail] = useState('');

  // Artikel aus Shop
  const [artikel, setArtikel] = useState([]);

  // Positionen
  const [positionen, setPositionen] = useState([
    { artikel_id: '', bezeichnung: '', menge: 1, einzelpreis: 0, mwst_satz: 19, einheit: 'Stück' }
  ]);

  // Bestehende Rechnungen
  const [rechnungen, setRechnungen] = useState([]);
  const [showRechnungen, setShowRechnungen] = useState(false);

  // Vorschau
  const [showVorschau, setShowVorschau] = useState(false);
  const [vorschauUrl, setVorschauUrl] = useState('');

  // API Helper
  const api = axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  // Daten laden
  useEffect(() => {
    loadData();
  }, []);

  // Fälligkeitsdatum automatisch setzen (14 Tage nach Rechnungsdatum)
  useEffect(() => {
    if (rechnungsdatum) {
      const date = new Date(rechnungsdatum);
      date.setDate(date.getDate() + 14);
      setFaelligAm(date.toISOString().split('T')[0]);
    }
  }, [rechnungsdatum]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empfaengerRes, nummernRes, rechnungenRes, artikelRes] = await Promise.all([
        api.get('/verband-rechnungen/empfaenger'),
        api.get('/verband-rechnungen/nummernkreis'),
        api.get('/verband-rechnungen'),
        api.get('/artikel?dojo_id=2') // TDA International Shop-Artikel
      ]);

      if (empfaengerRes.data.success) {
        setEmpfaenger(empfaengerRes.data.empfaenger);
      }
      if (nummernRes.data.success) {
        setRechnungsnummer(nummernRes.data.rechnungsnummer);
      }
      if (rechnungenRes.data.success) {
        setRechnungen(rechnungenRes.data.rechnungen);
      }
      // Artikel laden (kann Array oder {data: []} sein)
      const artikelData = artikelRes.data?.data || artikelRes.data || [];
      setArtikel(Array.isArray(artikelData) ? artikelData : []);
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  // Empfänger auswählen
  const handleSelectEmpfaenger = (emp, typ) => {
    setSelectedEmpfaenger(emp);
    setEmpfaengerTyp(typ);
    setSearchTerm('');
  };

  // Empfänger filtern
  const getFilteredEmpfaenger = () => {
    const term = searchTerm.toLowerCase();

    if (empfaengerTyp === 'verbandsmitglied') {
      return empfaenger.verbandsmitglieder.filter(e =>
        e.name?.toLowerCase().includes(term) ||
        e.mitgliedsnummer?.toLowerCase().includes(term)
      );
    } else if (empfaengerTyp === 'software_nutzer') {
      return empfaenger.softwareNutzer.filter(e =>
        e.name?.toLowerCase().includes(term)
      );
    }
    return [];
  };

  // Position hinzufügen
  const addPosition = () => {
    setPositionen([...positionen, { artikel_id: '', bezeichnung: '', menge: 1, einzelpreis: 0, mwst_satz: 19, einheit: 'Stück' }]);
  };

  // Artikel auswählen und Felder automatisch ausfüllen
  const handleArtikelSelect = (index, artikelId) => {
    if (!artikelId) {
      // Manuell - nur artikel_id leeren
      updatePosition(index, 'artikel_id', '');
      return;
    }

    const art = artikel.find(a => a.artikel_id == artikelId || a.id == artikelId);
    if (art) {
      const updated = [...positionen];
      updated[index] = {
        ...updated[index],
        artikel_id: artikelId,
        bezeichnung: art.name || art.bezeichnung || '',
        einzelpreis: parseFloat(art.verkaufspreis_brutto || art.preis || 0),
        mwst_satz: parseFloat(art.ust_prozent || art.mwst_satz || 19),
        einheit: art.einheit || 'Stück'
      };
      setPositionen(updated);
    }
  };

  // Position entfernen
  const removePosition = (index) => {
    if (positionen.length > 1) {
      setPositionen(positionen.filter((_, i) => i !== index));
    }
  };

  // Position aktualisieren
  const updatePosition = (index, field, value) => {
    const updated = [...positionen];
    updated[index][field] = value;
    setPositionen(updated);
  };

  // Summen berechnen
  const calculateSums = () => {
    let netto = 0;
    let mwst = 0;

    positionen.forEach(pos => {
      const posNetto = pos.menge * pos.einzelpreis;
      const posMwst = posNetto * (pos.mwst_satz / 100);
      netto += posNetto;
      mwst += posMwst;
    });

    return {
      netto,
      mwst,
      brutto: netto + mwst
    };
  };

  // Rechnung speichern
  const handleSave = async () => {
    setError('');
    setSuccess('');

    // Validierung
    if (empfaengerTyp === 'manuell') {
      if (!manuellName || !manuellAdresse) {
        setError('Bitte Name und Adresse des Empfängers eingeben');
        return;
      }
    } else if (!selectedEmpfaenger) {
      setError('Bitte Empfänger auswählen');
      return;
    }

    if (positionen.some(p => !p.bezeichnung || p.einzelpreis <= 0)) {
      setError('Bitte alle Positionen vollständig ausfüllen');
      return;
    }

    setSaving(true);

    try {
      const data = {
        empfaenger_typ: empfaengerTyp,
        empfaenger_id: empfaengerTyp !== 'manuell' ? selectedEmpfaenger.id : null,
        empfaenger_name: empfaengerTyp === 'manuell' ? manuellName : selectedEmpfaenger.name,
        empfaenger_adresse: empfaengerTyp === 'manuell' ? manuellAdresse : selectedEmpfaenger.adresse,
        empfaenger_email: empfaengerTyp === 'manuell' ? manuellEmail : selectedEmpfaenger.email,
        rechnungsnummer,
        rechnungsdatum,
        leistungsdatum,
        faellig_am: faelligAm,
        positionen,
        notizen
      };

      const response = await api.post('/verband-rechnungen', data);

      if (response.data.success) {
        setSuccess(`Rechnung ${rechnungsnummer} erfolgreich erstellt!`);

        // Vorschau öffnen
        setVorschauUrl(`/api/verband-rechnungen/${response.data.rechnung_id}/pdf`);
        setShowVorschau(true);

        // Formular zurücksetzen
        setSelectedEmpfaenger(null);
        setManuellName('');
        setManuellAdresse('');
        setManuellEmail('');
        setPositionen([{ bezeichnung: '', menge: 1, einzelpreis: 0, mwst_satz: 19, einheit: 'Stück' }]);
        setNotizen('');

        // Neue Rechnungsnummer laden
        const numRes = await api.get('/verband-rechnungen/nummernkreis');
        if (numRes.data.success) {
          setRechnungsnummer(numRes.data.rechnungsnummer);
        }

        // Rechnungsliste aktualisieren
        loadData();
      }
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern der Rechnung');
    } finally {
      setSaving(false);
    }
  };

  // Status Badge
  const StatusBadge = ({ status }) => {
    const config = {
      offen: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)', label: 'Offen' },
      bezahlt: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)', label: 'Bezahlt' },
      storniert: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)', label: 'Storniert' },
      mahnung: { color: '#f97316', bg: 'rgba(249, 115, 22, 0.2)', label: 'Mahnung' }
    }[status] || { color: '#666', bg: '#eee', label: status };

    return (
      <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, color: config.color, background: config.bg }}>
        {config.label}
      </span>
    );
  };

  const sums = calculateSums();
  const formatCurrency = (n) => (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <div className="verband-rechnung-loading">
        <Loader2 className="spin" size={32} />
        <p>Lade Daten...</p>
      </div>
    );
  }

  return (
    <div className="verband-rechnung-erstellen">
      <div className="page-header">
        <div className="header-left">
          <FileText size={24} />
          <h2>Verbandsrechnung erstellen</h2>
        </div>
        <button className="btn btn-outline" onClick={() => setShowRechnungen(!showRechnungen)}>
          {showRechnungen ? 'Neue Rechnung' : `Rechnungen (${rechnungen.length})`}
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError('')}><X size={16} /></button>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircle size={18} />
          <span>{success}</span>
          <button onClick={() => setSuccess('')}><X size={16} /></button>
        </div>
      )}

      {showRechnungen ? (
        /* Rechnungsliste */
        <div className="rechnungen-liste">
          <h3>Bestehende Rechnungen</h3>
          <table>
            <thead>
              <tr>
                <th>Nr.</th>
                <th>Empfänger</th>
                <th>Datum</th>
                <th>Betrag</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {rechnungen.map(r => (
                <tr key={r.id}>
                  <td>{r.rechnungsnummer}</td>
                  <td>{r.empfaenger_display_name || r.empfaenger_name}</td>
                  <td>{new Date(r.rechnungsdatum).toLocaleDateString('de-DE')}</td>
                  <td>{formatCurrency(r.summe_brutto)} €</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    <button
                      className="btn-icon"
                      onClick={() => window.open(`/api/verband-rechnungen/${r.id}/pdf`, '_blank')}
                      title="PDF anzeigen"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {rechnungen.length === 0 && (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: '#888' }}>
                    Noch keine Rechnungen vorhanden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Neue Rechnung erstellen */
        <div className="rechnung-form">
          {/* Empfänger-Auswahl */}
          <div className="form-section">
            <h3>1. Empfänger auswählen</h3>

            <div className="empfaenger-tabs">
              <button
                className={empfaengerTyp === 'verbandsmitglied' ? 'active' : ''}
                onClick={() => { setEmpfaengerTyp('verbandsmitglied'); setSelectedEmpfaenger(null); }}
              >
                <Building2 size={16} />
                Verbandsmitglieder ({empfaenger.verbandsmitglieder.length})
              </button>
              <button
                className={empfaengerTyp === 'software_nutzer' ? 'active' : ''}
                onClick={() => { setEmpfaengerTyp('software_nutzer'); setSelectedEmpfaenger(null); }}
              >
                <User size={16} />
                DojoSoftware-Nutzer ({empfaenger.softwareNutzer.length})
              </button>
              <button
                className={empfaengerTyp === 'manuell' ? 'active' : ''}
                onClick={() => { setEmpfaengerTyp('manuell'); setSelectedEmpfaenger(null); }}
              >
                <FileText size={16} />
                Manuell eingeben
              </button>
            </div>

            {empfaengerTyp !== 'manuell' ? (
              <>
                <div className="search-box">
                  <Search size={18} />
                  <input
                    type="text"
                    placeholder="Empfänger suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {selectedEmpfaenger ? (
                  <div className="selected-empfaenger">
                    <div className="empfaenger-info">
                      <strong>{selectedEmpfaenger.name}</strong>
                      {selectedEmpfaenger.mitgliedsnummer && (
                        <span className="mitgliedsnummer">{selectedEmpfaenger.mitgliedsnummer}</span>
                      )}
                      <span className="email">{selectedEmpfaenger.email}</span>
                      <span className="adresse">{selectedEmpfaenger.adresse}</span>
                    </div>
                    <button onClick={() => setSelectedEmpfaenger(null)}><X size={16} /></button>
                  </div>
                ) : (
                  <div className="empfaenger-liste">
                    {getFilteredEmpfaenger().slice(0, 10).map(emp => (
                      <div
                        key={emp.id}
                        className="empfaenger-item"
                        onClick={() => handleSelectEmpfaenger(emp, empfaengerTyp)}
                      >
                        <div className="emp-icon">
                          {empfaengerTyp === 'verbandsmitglied' ?
                            (emp.typ === 'dojo' ? <Building2 size={18} /> : <User size={18} />) :
                            <Building2 size={18} />
                          }
                        </div>
                        <div className="emp-details">
                          <strong>{emp.name}</strong>
                          {emp.mitgliedsnummer && <span>{emp.mitgliedsnummer}</span>}
                          <span className="email">{emp.email}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="manuell-form">
                <div className="form-row">
                  <label>Name / Firma *</label>
                  <input
                    type="text"
                    value={manuellName}
                    onChange={(e) => setManuellName(e.target.value)}
                    placeholder="Name des Empfängers"
                  />
                </div>
                <div className="form-row">
                  <label>Adresse *</label>
                  <textarea
                    value={manuellAdresse}
                    onChange={(e) => setManuellAdresse(e.target.value)}
                    placeholder="Straße, PLZ Ort"
                    rows={3}
                  />
                </div>
                <div className="form-row">
                  <label>E-Mail</label>
                  <input
                    type="email"
                    value={manuellEmail}
                    onChange={(e) => setManuellEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Rechnungsdaten */}
          <div className="form-section">
            <h3>2. Rechnungsdaten</h3>
            <div className="form-grid">
              <div className="form-row">
                <label>Rechnungsnummer</label>
                <input type="text" value={rechnungsnummer} readOnly className="readonly" />
              </div>
              <div className="form-row">
                <label>Rechnungsdatum</label>
                <input
                  type="date"
                  value={rechnungsdatum}
                  onChange={(e) => setRechnungsdatum(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Leistungsdatum</label>
                <input
                  type="date"
                  value={leistungsdatum}
                  onChange={(e) => setLeistungsdatum(e.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Fällig bis</label>
                <input
                  type="date"
                  value={faelligAm}
                  onChange={(e) => setFaelligAm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Positionen */}
          <div className="form-section">
            <h3><ShoppingBag size={16} style={{ marginRight: '0.5rem' }} />3. Positionen</h3>
            <table className="positionen-table">
              <thead>
                <tr>
                  <th style={{ width: '180px' }}>Artikel</th>
                  <th>Bezeichnung</th>
                  <th>Menge</th>
                  <th>Einheit</th>
                  <th>Einzelpreis</th>
                  <th>MwSt.</th>
                  <th>Gesamt</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {positionen.map((pos, index) => (
                  <tr key={index}>
                    <td>
                      <select
                        value={pos.artikel_id || ''}
                        onChange={(e) => handleArtikelSelect(index, e.target.value)}
                        style={{ minWidth: '150px' }}
                      >
                        <option value="">-- Manuell --</option>
                        {artikel.map(art => (
                          <option key={art.artikel_id || art.id} value={art.artikel_id || art.id}>
                            {art.name || art.bezeichnung} ({formatCurrency(art.verkaufspreis_brutto || art.preis || 0)} €)
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={pos.bezeichnung}
                        onChange={(e) => updatePosition(index, 'bezeichnung', e.target.value)}
                        placeholder="Beschreibung"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={pos.menge}
                        onChange={(e) => updatePosition(index, 'menge', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td>
                      <select
                        value={pos.einheit}
                        onChange={(e) => updatePosition(index, 'einheit', e.target.value)}
                      >
                        <option value="Stück">Stück</option>
                        <option value="Monat">Monat</option>
                        <option value="Jahr">Jahr</option>
                        <option value="Stunde">Stunde</option>
                        <option value="Pauschale">Pauschale</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        value={pos.einzelpreis}
                        onChange={(e) => updatePosition(index, 'einzelpreis', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td>
                      <select
                        value={pos.mwst_satz}
                        onChange={(e) => updatePosition(index, 'mwst_satz', parseFloat(e.target.value))}
                      >
                        <option value="19">19%</option>
                        <option value="7">7%</option>
                        <option value="0">0%</option>
                      </select>
                    </td>
                    <td className="text-right">
                      {formatCurrency(pos.menge * pos.einzelpreis * (1 + pos.mwst_satz / 100))} €
                    </td>
                    <td>
                      <button
                        className="btn-icon danger"
                        onClick={() => removePosition(index)}
                        disabled={positionen.length === 1}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <button className="btn btn-outline add-position" onClick={addPosition}>
              <Plus size={16} /> Position hinzufügen
            </button>

            {/* Summen */}
            <div className="summen">
              <div className="summe-row">
                <span>Netto:</span>
                <span>{formatCurrency(sums.netto)} €</span>
              </div>
              <div className="summe-row">
                <span>MwSt.:</span>
                <span>{formatCurrency(sums.mwst)} €</span>
              </div>
              <div className="summe-row total">
                <span>Gesamtbetrag:</span>
                <span>{formatCurrency(sums.brutto)} €</span>
              </div>
            </div>
          </div>

          {/* Notizen */}
          <div className="form-section">
            <h3>4. Notizen (optional)</h3>
            <textarea
              value={notizen}
              onChange={(e) => setNotizen(e.target.value)}
              placeholder="Zusätzliche Hinweise für die Rechnung..."
              rows={3}
            />
          </div>

          {/* Aktionen */}
          <div className="form-actions">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
              Rechnung erstellen
            </button>
          </div>
        </div>
      )}

      {/* Vorschau Modal */}
      {showVorschau && (
        <div className="modal-overlay" onClick={() => setShowVorschau(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rechnungsvorschau</h3>
              <button onClick={() => setShowVorschau(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <iframe src={vorschauUrl} title="Rechnung Vorschau" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowVorschau(false)}>
                Schließen
              </button>
              <button className="btn btn-primary" onClick={() => window.open(vorschauUrl + '?print=1', '_blank')}>
                <Download size={16} /> Drucken / PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerbandRechnungErstellen;
