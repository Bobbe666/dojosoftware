import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  FileText, Plus, Trash2, Save, Eye, Download, Building2, User,
  Euro, Calendar, Search, X, CheckCircle, AlertCircle, Loader2, ShoppingBag,
  ChevronDown, ChevronUp, List
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
  const [empfaenger, setEmpfaenger] = useState({ verbandsmitglieder: [], softwareNutzer: [], dojoMitglieder: [] });
  const [selectedEmpfaenger, setSelectedEmpfaenger] = useState(null);
  const [empfaengerTyp, setEmpfaengerTyp] = useState('dojo_mitglied');
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

  // Vorschau Modal
  const [showVorschauModal, setShowVorschauModal] = useState(false);
  const [vorschauUrl, setVorschauUrl] = useState('');

  // API Helper
  const getApi = () => axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${token}` }
  });

  useEffect(() => {
    if (token) loadData();
  }, [token]);

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
        getApi().get('/verband-rechnungen/empfaenger'),
        getApi().get('/verband-rechnungen/nummernkreis'),
        getApi().get('/verband-rechnungen'),
        getApi().get('/artikel?dojo_id=2')
      ]);

      if (empfaengerRes.data.success) setEmpfaenger(empfaengerRes.data.empfaenger);
      if (nummernRes.data.success) setRechnungsnummer(nummernRes.data.rechnungsnummer);
      if (rechnungenRes.data.success) setRechnungen(rechnungenRes.data.rechnungen);
      const artikelData = artikelRes.data?.data || artikelRes.data || [];
      setArtikel(Array.isArray(artikelData) ? artikelData : []);
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectEmpfaenger = (emp, typ) => {
    setSelectedEmpfaenger(emp);
    setEmpfaengerTyp(typ);
    setSearchTerm('');
  };

  const getFilteredEmpfaenger = () => {
    const term = searchTerm.toLowerCase();
    if (empfaengerTyp === 'verbandsmitglied') {
      return empfaenger.verbandsmitglieder.filter(e =>
        e.name?.toLowerCase().includes(term) || e.mitgliedsnummer?.toLowerCase().includes(term)
      );
    } else if (empfaengerTyp === 'dojo_mitglied') {
      return (empfaenger.dojoMitglieder || []).filter(e =>
        e.name?.toLowerCase().includes(term) || e.dojo_name?.toLowerCase().includes(term)
      );
    } else if (empfaengerTyp === 'software_nutzer') {
      return empfaenger.softwareNutzer.filter(e => e.name?.toLowerCase().includes(term));
    }
    return [];
  };

  const addPosition = () => {
    setPositionen([...positionen, { artikel_id: '', bezeichnung: '', menge: 1, einzelpreis: 0, mwst_satz: 19, einheit: 'Stück' }]);
  };

  const handleArtikelSelect = (index, artikelId) => {
    if (!artikelId) {
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

  const removePosition = (index) => {
    if (positionen.length > 1) setPositionen(positionen.filter((_, i) => i !== index));
  };

  const updatePosition = (index, field, value) => {
    const updated = [...positionen];
    updated[index][field] = value;
    setPositionen(updated);
  };

  const calculateSums = () => {
    let netto = 0, mwst = 0;
    positionen.forEach(pos => {
      const posNetto = pos.menge * pos.einzelpreis;
      const posMwst = posNetto * (pos.mwst_satz / 100);
      netto += posNetto;
      mwst += posMwst;
    });
    return { netto, mwst, brutto: netto + mwst };
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');

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

      const response = await getApi().post('/verband-rechnungen', data);

      if (response.data.success) {
        setSuccess(`Rechnung ${rechnungsnummer} erfolgreich erstellt!`);
        setVorschauUrl(`/api/verband-rechnungen/${response.data.rechnung_id}/pdf`);
        setShowVorschauModal(true);

        // Reset form
        setSelectedEmpfaenger(null);
        setManuellName('');
        setManuellAdresse('');
        setManuellEmail('');
        setPositionen([{ bezeichnung: '', menge: 1, einzelpreis: 0, mwst_satz: 19, einheit: 'Stück' }]);
        setNotizen('');

        const numRes = await getApi().get('/verband-rechnungen/nummernkreis');
        if (numRes.data.success) setRechnungsnummer(numRes.data.rechnungsnummer);
        loadData();
      }
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern der Rechnung');
    } finally {
      setSaving(false);
    }
  };

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
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';

  const getEmpfaengerName = () => {
    if (empfaengerTyp === 'manuell') return manuellName || 'Empfänger auswählen...';
    return selectedEmpfaenger?.name || 'Empfänger auswählen...';
  };

  const getEmpfaengerAdresse = () => {
    if (empfaengerTyp === 'manuell') return manuellAdresse;
    return selectedEmpfaenger?.adresse || '';
  };

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
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <FileText size={24} />
          <h2>Rechnung erstellen</h2>
        </div>
        <button className="btn btn-outline" onClick={() => setShowRechnungen(!showRechnungen)}>
          <List size={16} />
          {showRechnungen ? 'Neue Rechnung' : `Rechnungen (${rechnungen.length})`}
        </button>
      </div>

      {/* Alerts */}
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
                  <td>{formatDate(r.rechnungsdatum)}</td>
                  <td>{formatCurrency(r.summe_brutto)} €</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>
                    <button className="btn-icon" onClick={() => window.open(`/api/verband-rechnungen/${r.id}/pdf`, '_blank')} title="PDF">
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {rechnungen.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: '#888' }}>Noch keine Rechnungen</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Zwei-Spalten Layout: Formular + Vorschau */
        <div className="rechnung-split-layout">
          {/* Linke Seite: Formular */}
          <div className="rechnung-form-column">
            {/* Empfänger */}
            <div className="form-card">
              <div className="form-card-header">
                <User size={18} />
                <span>Empfänger</span>
              </div>
              <div className="form-card-body">
                <div className="empfaenger-tabs compact">
                  <button className={empfaengerTyp === 'dojo_mitglied' ? 'active' : ''} onClick={() => { setEmpfaengerTyp('dojo_mitglied'); setSelectedEmpfaenger(null); }}>
                    Mitglieder ({(empfaenger.dojoMitglieder || []).length})
                  </button>
                  <button className={empfaengerTyp === 'verbandsmitglied' ? 'active' : ''} onClick={() => { setEmpfaengerTyp('verbandsmitglied'); setSelectedEmpfaenger(null); }}>
                    Verband ({empfaenger.verbandsmitglieder.length})
                  </button>
                  <button className={empfaengerTyp === 'software_nutzer' ? 'active' : ''} onClick={() => { setEmpfaengerTyp('software_nutzer'); setSelectedEmpfaenger(null); }}>
                    Software ({empfaenger.softwareNutzer.length})
                  </button>
                  <button className={empfaengerTyp === 'manuell' ? 'active' : ''} onClick={() => { setEmpfaengerTyp('manuell'); setSelectedEmpfaenger(null); }}>
                    Manuell
                  </button>
                </div>

                {empfaengerTyp !== 'manuell' ? (
                  <>
                    <div className="search-box compact">
                      <Search size={16} />
                      <input type="text" placeholder="Suchen..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                    {selectedEmpfaenger ? (
                      <div className="selected-empfaenger compact">
                        <div>
                          <strong>{selectedEmpfaenger.name}</strong>
                          {selectedEmpfaenger.dojo_name && <span className="dojo-tag">{selectedEmpfaenger.dojo_name}</span>}
                          <small>{selectedEmpfaenger.email}</small>
                        </div>
                        <button onClick={() => setSelectedEmpfaenger(null)}><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="empfaenger-liste compact">
                        {getFilteredEmpfaenger().slice(0, 8).map(emp => (
                          <div key={emp.id} className="empfaenger-item compact" onClick={() => handleSelectEmpfaenger(emp, empfaengerTyp)}>
                            <strong>{emp.name}</strong>
                            {emp.dojo_name && <span className="dojo-tag small">{emp.dojo_name}</span>}
                          </div>
                        ))}
                        {getFilteredEmpfaenger().length === 0 && <div className="no-results">Keine Treffer</div>}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="manuell-form compact">
                    <input type="text" value={manuellName} onChange={(e) => setManuellName(e.target.value)} placeholder="Name / Firma *" />
                    <textarea value={manuellAdresse} onChange={(e) => setManuellAdresse(e.target.value)} placeholder="Adresse *" rows={2} />
                    <input type="email" value={manuellEmail} onChange={(e) => setManuellEmail(e.target.value)} placeholder="E-Mail" />
                  </div>
                )}
              </div>
            </div>

            {/* Rechnungsdaten */}
            <div className="form-card">
              <div className="form-card-header">
                <Calendar size={18} />
                <span>Rechnungsdaten</span>
              </div>
              <div className="form-card-body">
                <div className="form-grid-2">
                  <div className="form-field">
                    <label>Rechnungsnr.</label>
                    <input type="text" value={rechnungsnummer} readOnly className="readonly" />
                  </div>
                  <div className="form-field">
                    <label>Rechnungsdatum</label>
                    <input type="date" value={rechnungsdatum} onChange={(e) => setRechnungsdatum(e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Leistungsdatum</label>
                    <input type="date" value={leistungsdatum} onChange={(e) => setLeistungsdatum(e.target.value)} />
                  </div>
                  <div className="form-field">
                    <label>Fällig bis</label>
                    <input type="date" value={faelligAm} onChange={(e) => setFaelligAm(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Positionen */}
            <div className="form-card">
              <div className="form-card-header">
                <ShoppingBag size={18} />
                <span>Positionen</span>
                <button className="btn-add-small" onClick={addPosition}><Plus size={14} /></button>
              </div>
              <div className="form-card-body no-padding">
                <div className="positionen-compact">
                  {positionen.map((pos, index) => (
                    <div key={index} className="position-row">
                      <div className="position-main">
                        <select value={pos.artikel_id || ''} onChange={(e) => handleArtikelSelect(index, e.target.value)}>
                          <option value="">Artikel wählen...</option>
                          {artikel.map(art => (
                            <option key={art.artikel_id || art.id} value={art.artikel_id || art.id}>
                              {art.name || art.bezeichnung}
                            </option>
                          ))}
                        </select>
                        <input type="text" value={pos.bezeichnung} onChange={(e) => updatePosition(index, 'bezeichnung', e.target.value)} placeholder="Bezeichnung" />
                      </div>
                      <div className="position-details">
                        <input type="number" value={pos.menge} onChange={(e) => updatePosition(index, 'menge', parseFloat(e.target.value) || 0)} min="0" step="1" className="menge" />
                        <span className="multiply">×</span>
                        <input type="number" value={pos.einzelpreis} onChange={(e) => updatePosition(index, 'einzelpreis', parseFloat(e.target.value) || 0)} min="0" step="0.01" className="preis" />
                        <span className="currency">€</span>
                        <select value={pos.mwst_satz} onChange={(e) => updatePosition(index, 'mwst_satz', parseFloat(e.target.value))} className="mwst">
                          <option value="19">19%</option>
                          <option value="7">7%</option>
                          <option value="0">0%</option>
                        </select>
                        <span className="pos-total">{formatCurrency(pos.menge * pos.einzelpreis * (1 + pos.mwst_satz / 100))} €</span>
                        <button className="btn-remove" onClick={() => removePosition(index)} disabled={positionen.length === 1}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Notizen */}
            <div className="form-card">
              <div className="form-card-header">
                <FileText size={18} />
                <span>Notizen</span>
              </div>
              <div className="form-card-body">
                <textarea value={notizen} onChange={(e) => setNotizen(e.target.value)} placeholder="Optionale Hinweise..." rows={2} />
              </div>
            </div>
          </div>

          {/* Rechte Seite: Live-Vorschau */}
          <div className="rechnung-preview-column">
            <div className="preview-card">
              <div className="preview-header">
                <Eye size={18} />
                <span>Live-Vorschau</span>
              </div>
              <div className="preview-content">
                {/* Rechnungskopf */}
                <div className="preview-document">
                  <div className="preview-logo">
                    <strong>Tiger & Dragon Association</strong>
                    <small>International</small>
                  </div>

                  <div className="preview-recipient">
                    <small>Empfänger:</small>
                    <strong>{getEmpfaengerName()}</strong>
                    <span>{getEmpfaengerAdresse()}</span>
                  </div>

                  <div className="preview-meta">
                    <div className="preview-title">RECHNUNG</div>
                    <div className="preview-info">
                      <div><span>Nr.:</span> <strong>{rechnungsnummer}</strong></div>
                      <div><span>Datum:</span> {formatDate(rechnungsdatum)}</div>
                      <div><span>Fällig:</span> {formatDate(faelligAm)}</div>
                    </div>
                  </div>

                  {/* Positionen */}
                  <table className="preview-table">
                    <thead>
                      <tr>
                        <th>Beschreibung</th>
                        <th>Menge</th>
                        <th>Preis</th>
                        <th>Gesamt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positionen.filter(p => p.bezeichnung).map((pos, i) => (
                        <tr key={i}>
                          <td>{pos.bezeichnung}</td>
                          <td>{pos.menge}</td>
                          <td>{formatCurrency(pos.einzelpreis)} €</td>
                          <td>{formatCurrency(pos.menge * pos.einzelpreis * (1 + pos.mwst_satz / 100))} €</td>
                        </tr>
                      ))}
                      {positionen.every(p => !p.bezeichnung) && (
                        <tr><td colSpan="4" className="empty">Positionen hinzufügen...</td></tr>
                      )}
                    </tbody>
                  </table>

                  {/* Summen */}
                  <div className="preview-sums">
                    <div className="sum-row"><span>Netto:</span> <span>{formatCurrency(sums.netto)} €</span></div>
                    <div className="sum-row"><span>MwSt.:</span> <span>{formatCurrency(sums.mwst)} €</span></div>
                    <div className="sum-row total"><span>Gesamt:</span> <span>{formatCurrency(sums.brutto)} €</span></div>
                  </div>

                  {notizen && (
                    <div className="preview-notes">
                      <small>Hinweis:</small>
                      <p>{notizen}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Aktionen */}
              <div className="preview-actions">
                <button className="btn btn-primary btn-large" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
                  Rechnung erstellen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vorschau Modal nach Erstellung */}
      {showVorschauModal && (
        <div className="modal-overlay" onClick={() => setShowVorschauModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Rechnung erstellt</h3>
              <button onClick={() => setShowVorschauModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <iframe src={vorschauUrl} title="Rechnung Vorschau" />
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowVorschauModal(false)}>Schließen</button>
              <button className="btn btn-primary" onClick={() => window.open(vorschauUrl + '?print=1', '_blank')}>
                <Download size={16} /> PDF herunterladen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VerbandRechnungErstellen;
