import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import {
  FileText, Plus, Trash2, Save, Eye, Download, Building2, User,
  Euro, Calendar, Search, X, CheckCircle, AlertCircle, Loader2, Users
} from 'lucide-react';
import '../styles/RechnungErstellen.css';

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
  const [positionen, setPositionen] = useState([]);
  const [neuePosition, setNeuePosition] = useState({
    artikel_id: '',
    bezeichnung: '',
    menge: 1,
    einzelpreis: 0,
    mwst_satz: 19
  });

  // Bestehende Rechnungen
  const [rechnungen, setRechnungen] = useState([]);
  const [showRechnungen, setShowRechnungen] = useState(false);

  // Vorschau Modal
  const [showVorschauModal, setShowVorschauModal] = useState(false);
  const [vorschauUrl, setVorschauUrl] = useState('');

  // TDA Bankdaten (fest)
  const bankDaten = {
    bank_name: 'Sparkasse',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    kontoinhaber: 'Tiger & Dragon Association International'
  };

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
    let list = [];
    if (empfaengerTyp === 'verbandsmitglied') list = empfaenger.verbandsmitglieder || [];
    else if (empfaengerTyp === 'software_nutzer') list = empfaenger.softwareNutzer || [];
    else if (empfaengerTyp === 'dojo_mitglied') list = empfaenger.dojoMitglieder || [];

    if (!searchTerm) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(e =>
      e.name?.toLowerCase().includes(term) ||
      e.email?.toLowerCase().includes(term) ||
      e.dojo_name?.toLowerCase().includes(term)
    );
  };

  const handleArtikelChange = (artikel_id) => {
    const art = artikel.find(a => (a.artikel_id || a.id) === parseInt(artikel_id));
    if (art) {
      const preis = art.verkaufspreis_cent ? art.verkaufspreis_cent / 100 : (art.preis || 0);
      setNeuePosition({
        ...neuePosition,
        artikel_id: art.artikel_id || art.id,
        bezeichnung: art.name || art.bezeichnung,
        einzelpreis: preis,
        mwst_satz: art.mwst_prozent || 19
      });
    }
  };

  const addPosition = () => {
    if (!neuePosition.bezeichnung || neuePosition.menge <= 0) return;

    setPositionen([...positionen, {
      ...neuePosition,
      pos: positionen.length + 1,
      menge: Number(neuePosition.menge),
      einzelpreis: Number(neuePosition.einzelpreis),
      mwst_satz: Number(neuePosition.mwst_satz)
    }]);

    setNeuePosition({
      artikel_id: '',
      bezeichnung: '',
      menge: 1,
      einzelpreis: 0,
      mwst_satz: 19
    });
  };

  const removePosition = (index) => {
    const newPositionen = positionen.filter((_, i) => i !== index);
    setPositionen(newPositionen.map((pos, i) => ({ ...pos, pos: i + 1 })));
  };

  // Berechnungen
  const calculateNetto = () => {
    return positionen.reduce((sum, pos) => sum + (Number(pos.einzelpreis) * Number(pos.menge)), 0);
  };

  const calculateMwst = () => {
    return positionen.reduce((sum, pos) => {
      const netto = Number(pos.einzelpreis) * Number(pos.menge);
      return sum + (netto * Number(pos.mwst_satz) / 100);
    }, 0);
  };

  const calculateBrutto = () => {
    return calculateNetto() + calculateMwst();
  };

  const formatCurrency = (n) => (n || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDateDDMMYYYY = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  };

  // EPC QR-Code generieren
  const generateEPCQRCode = (betrag) => {
    if (!bankDaten.iban || !bankDaten.bic || !bankDaten.kontoinhaber || !betrag || betrag <= 0) {
      return '';
    }

    const verwendungszweck = `Rechnung ${rechnungsnummer || ''}`.substring(0, 140);

    return [
      'BCD',
      '002',
      '1',
      'SCT',
      bankDaten.bic.trim(),
      bankDaten.kontoinhaber.trim().substring(0, 70),
      bankDaten.iban.replace(/\s/g, '').toUpperCase(),
      `EUR${Number(betrag).toFixed(2)}`,
      '',
      verwendungszweck,
      rechnungsnummer?.substring(0, 35) || '',
      '',
      ''
    ].join('\n');
  };

  const handleSave = async () => {
    if (!selectedEmpfaenger && empfaengerTyp !== 'manuell') {
      setError('Bitte wählen Sie einen Empfänger aus');
      return;
    }
    if (empfaengerTyp === 'manuell' && !manuellName) {
      setError('Bitte geben Sie einen Namen ein');
      return;
    }
    if (positionen.length === 0) {
      setError('Bitte fügen Sie mindestens eine Position hinzu');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const data = {
        empfaenger_typ: empfaengerTyp,
        empfaenger_id: selectedEmpfaenger?.id || null,
        empfaenger_name: empfaengerTyp === 'manuell' ? manuellName : selectedEmpfaenger?.name,
        empfaenger_adresse: empfaengerTyp === 'manuell' ? manuellAdresse : selectedEmpfaenger?.adresse,
        empfaenger_email: empfaengerTyp === 'manuell' ? manuellEmail : selectedEmpfaenger?.email,
        rechnungsdatum,
        leistungsdatum,
        faelligkeitsdatum: faelligAm,
        notizen,
        positionen: positionen.map(pos => ({
          bezeichnung: pos.bezeichnung,
          menge: pos.menge,
          einzelpreis: pos.einzelpreis,
          mwst_satz: pos.mwst_satz
        }))
      };

      const response = await getApi().post('/verband-rechnungen', data);

      if (response.data.success) {
        setSuccess(`Rechnung ${response.data.rechnungsnummer} erfolgreich erstellt!`);
        setVorschauUrl(`/api/verband-rechnungen/${response.data.rechnung_id}/pdf`);
        setShowVorschauModal(true);

        // Reset form
        setSelectedEmpfaenger(null);
        setManuellName('');
        setManuellAdresse('');
        setManuellEmail('');
        setPositionen([]);
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

  const getEmpfaengerName = () => {
    if (empfaengerTyp === 'manuell') return manuellName || 'Bitte Empfänger wählen';
    return selectedEmpfaenger?.name || 'Bitte Empfänger wählen';
  };

  const getEmpfaengerAdresse = () => {
    if (empfaengerTyp === 'manuell') return manuellAdresse;
    return selectedEmpfaenger?.adresse || '';
  };

  if (loading) {
    return (
      <div className="rechnung-erstellen-container">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#ffffff' }}>
          <Loader2 className="spin" size={32} style={{ animation: 'spin 1s linear infinite' }} />
          <p>Lade Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rechnung-erstellen-container">
      {/* Alerts */}
      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}
      {success && (
        <div style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', color: '#22c55e', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle size={18} />
          <span>{success}</span>
          <button onClick={() => setSuccess('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}><X size={16} /></button>
        </div>
      )}

      {showRechnungen ? (
        /* Rechnungsliste */
        <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: '#ffd700', margin: 0 }}>Bestehende Rechnungen</h3>
            <button onClick={() => setShowRechnungen(false)} className="btn-add">Neue Rechnung</button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: '#888', fontSize: '0.75rem' }}>Nr.</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: '#888', fontSize: '0.75rem' }}>Empfänger</th>
                <th style={{ padding: '0.75rem', textAlign: 'left', color: '#888', fontSize: '0.75rem' }}>Datum</th>
                <th style={{ padding: '0.75rem', textAlign: 'right', color: '#888', fontSize: '0.75rem' }}>Betrag</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#888', fontSize: '0.75rem' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'center', color: '#888', fontSize: '0.75rem' }}>PDF</th>
              </tr>
            </thead>
            <tbody>
              {rechnungen.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '0.75rem', color: '#ddd' }}>{r.rechnungsnummer}</td>
                  <td style={{ padding: '0.75rem', color: '#ddd' }}>{r.empfaenger_display_name || r.empfaenger_name}</td>
                  <td style={{ padding: '0.75rem', color: '#ddd' }}>{formatDateDDMMYYYY(r.rechnungsdatum)}</td>
                  <td style={{ padding: '0.75rem', color: '#ddd', textAlign: 'right' }}>{formatCurrency(r.summe_brutto)} €</td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}><StatusBadge status={r.status} /></td>
                  <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                    <button onClick={() => window.open(`/api/verband-rechnungen/${r.id}/pdf`, '_blank')} style={{ background: 'none', border: 'none', color: '#c9a227', cursor: 'pointer' }}>
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {rechnungen.length === 0 && (
                <tr><td colSpan="6" style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>Noch keine Rechnungen</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Formular + Vorschau Layout */
        <div className="rechnung-editor">
          {/* Linke Seite: Formular */}
          <div className="rechnung-form">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h2>TDA Rechnung erstellen</h2>
              <button onClick={() => setShowRechnungen(true)} style={{ background: 'none', border: '1px solid rgba(255, 215, 0, 0.3)', color: '#ffd700', padding: '0.3rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', cursor: 'pointer' }}>
                Rechnungen ({rechnungen.length})
              </button>
            </div>

            {/* Empfänger */}
            <div className="form-section">
              <h3>Empfänger</h3>
              <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { id: 'dojo_mitglied', label: `Mitglieder (${(empfaenger.dojoMitglieder || []).length})` },
                  { id: 'verbandsmitglied', label: `Verband (${empfaenger.verbandsmitglieder.length})` },
                  { id: 'software_nutzer', label: `Software (${empfaenger.softwareNutzer.length})` },
                  { id: 'manuell', label: 'Manuell' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setEmpfaengerTyp(tab.id); setSelectedEmpfaenger(null); }}
                    style={{
                      padding: '0.3rem 0.5rem',
                      fontSize: '0.7rem',
                      background: empfaengerTyp === tab.id ? 'rgba(255, 215, 0, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${empfaengerTyp === tab.id ? '#ffd700' : 'rgba(255, 255, 255, 0.1)'}`,
                      borderRadius: '4px',
                      color: empfaengerTyp === tab.id ? '#ffd700' : '#aaa',
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {empfaengerTyp !== 'manuell' ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0, 0, 0, 0.3)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px', padding: '0.3rem 0.5rem', marginBottom: '0.5rem' }}>
                    <Search size={14} style={{ color: '#666' }} />
                    <input
                      type="text"
                      placeholder="Suchen..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      style={{ flex: 1, background: 'none', border: 'none', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                    />
                  </div>
                  {selectedEmpfaenger ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 215, 0, 0.1)', border: '1px solid rgba(255, 215, 0, 0.3)', borderRadius: '6px', padding: '0.5rem 0.75rem' }}>
                      <div>
                        <strong style={{ color: '#fff', fontSize: '0.85rem' }}>{selectedEmpfaenger.name}</strong>
                        {selectedEmpfaenger.dojo_name && <span style={{ marginLeft: '0.5rem', padding: '0.15rem 0.4rem', background: 'rgba(255, 215, 0, 0.2)', color: '#ffd700', borderRadius: '4px', fontSize: '0.65rem' }}>{selectedEmpfaenger.dojo_name}</span>}
                        <div style={{ color: '#888', fontSize: '0.7rem' }}>{selectedEmpfaenger.email}</div>
                      </div>
                      <button onClick={() => setSelectedEmpfaenger(null)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={14} /></button>
                    </div>
                  ) : (
                    <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {getFilteredEmpfaenger().slice(0, 8).map(emp => (
                        <div
                          key={emp.id}
                          onClick={() => handleSelectEmpfaenger(emp, empfaengerTyp)}
                          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.5rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          <strong style={{ color: '#fff', fontSize: '0.8rem' }}>{emp.name}</strong>
                          {emp.dojo_name && <span style={{ padding: '0.1rem 0.3rem', background: 'rgba(255, 215, 0, 0.2)', color: '#ffd700', borderRadius: '3px', fontSize: '0.6rem' }}>{emp.dojo_name}</span>}
                        </div>
                      ))}
                      {getFilteredEmpfaenger().length === 0 && <div style={{ textAlign: 'center', color: '#666', padding: '0.5rem', fontSize: '0.8rem' }}>Keine Treffer</div>}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <input type="text" value={manuellName} onChange={(e) => setManuellName(e.target.value)} placeholder="Name / Firma *" />
                  <textarea value={manuellAdresse} onChange={(e) => setManuellAdresse(e.target.value)} placeholder="Adresse *" rows={2} style={{ resize: 'none' }} />
                  <input type="email" value={manuellEmail} onChange={(e) => setManuellEmail(e.target.value)} placeholder="E-Mail" />
                </div>
              )}
            </div>

            {/* Rechnungsdaten */}
            <div className="form-section">
              <h3>Rechnungsdaten</h3>
              <div className="form-grid">
                <div>
                  <label>Belegdatum</label>
                  <input type="date" value={rechnungsdatum} onChange={(e) => setRechnungsdatum(e.target.value)} />
                </div>
                <div>
                  <label>Leistungsdatum</label>
                  <input type="date" value={leistungsdatum} onChange={(e) => setLeistungsdatum(e.target.value)} />
                </div>
                <div>
                  <label>Zahlungsfrist</label>
                  <input type="date" value={faelligAm} onChange={(e) => setFaelligAm(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Position hinzufügen */}
            <div className="form-section">
              <h3>Position hinzufügen</h3>
              <div className="position-input">
                <select onChange={(e) => handleArtikelChange(e.target.value)} value={neuePosition.artikel_id}>
                  <option value="">Artikel wählen...</option>
                  {artikel.map(a => (
                    <option key={a.artikel_id || a.id} value={a.artikel_id || a.id}>
                      {a.name || a.bezeichnung} - {formatCurrency(a.verkaufspreis_cent ? a.verkaufspreis_cent / 100 : a.preis)} €
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Menge"
                  value={neuePosition.menge}
                  onChange={(e) => setNeuePosition({ ...neuePosition, menge: parseInt(e.target.value) || 1 })}
                  min="1"
                  style={{ width: '60px' }}
                />
                <button onClick={addPosition} className="btn-add">Hinzufügen</button>
              </div>

              {/* Hinzugefügte Positionen */}
              {positionen.length > 0 && (
                <div style={{ marginTop: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                  <h4 className="positionen-liste-header">Hinzugefügte Positionen:</h4>
                  {positionen.map((pos, index) => (
                    <div key={index} className="position-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div className="position-item-text">
                          <strong>{pos.bezeichnung}</strong> - {pos.menge}x {formatCurrency(pos.einzelpreis)} €
                        </div>
                        <button
                          onClick={() => removePosition(index)}
                          style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '4px', color: '#ef4444', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem', fontWeight: 'bold', padding: 0 }}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notizen */}
            <div className="form-section" style={{ borderBottom: 'none' }}>
              <h3>Notizen</h3>
              <textarea
                value={notizen}
                onChange={(e) => setNotizen(e.target.value)}
                placeholder="Optionale Hinweise für die Rechnung..."
                rows={2}
                style={{ resize: 'none' }}
              />
            </div>

            <button onClick={handleSave} className="btn-save" disabled={saving}>
              {saving ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Speichern...</> : <><Save size={16} /> Rechnung speichern</>}
            </button>
          </div>

          {/* Rechte Seite: Vorschau */}
          <div className="rechnung-preview">
            <div className="invoice-page">
              {/* Header */}
              <div className="invoice-header">
                <div className="company-info">
                  <div className="company-small">
                    Tiger & Dragon Association International | Schwandweg 3a | 92712 Pirk
                  </div>
                  <div className="recipient-address">
                    {selectedEmpfaenger || (empfaengerTyp === 'manuell' && manuellName) ? (
                      <>
                        <div>Herrn/Frau</div>
                        <div>{getEmpfaengerName()}</div>
                        {getEmpfaengerAdresse() && getEmpfaengerAdresse().split('\n').map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </>
                    ) : (
                      <div style={{ color: '#999' }}>Bitte Kunde wählen</div>
                    )}
                  </div>
                </div>
                <div className="invoice-meta">
                  <div className="logo-placeholder">TDA</div>
                  <div className="invoice-numbers">
                    <div>Rechnungs-Nr.: {rechnungsnummer || 'wird generiert'}</div>
                    <div>Kundennummer: {selectedEmpfaenger?.id || '-'}</div>
                    <div>Belegdatum: {formatDateDDMMYYYY(rechnungsdatum)}</div>
                    <div>Liefer-/Leistungsdatum: {formatDateDDMMYYYY(leistungsdatum)}</div>
                  </div>
                </div>
              </div>

              {/* Title */}
              <div className="invoice-title">
                <h1 style={{ color: '#000000', fontWeight: 'bold', textShadow: 'none', boxShadow: 'none' }}>Rechnung</h1>
                <div className="page-number">Seite 1 von 1</div>
              </div>

              {/* Positions Table */}
              <table className="invoice-table">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Bezeichnung</th>
                    <th>Artikelnummer</th>
                    <th>Menge</th>
                    <th>Einheit</th>
                    <th>Preis</th>
                    <th>USt %</th>
                    <th>Betrag EUR</th>
                  </tr>
                </thead>
                <tbody>
                  {positionen.length > 0 ? positionen.map((pos, index) => (
                    <tr key={index}>
                      <td>{pos.pos}</td>
                      <td>{pos.bezeichnung}</td>
                      <td>-</td>
                      <td style={{ textAlign: 'right' }}>{pos.menge}</td>
                      <td style={{ textAlign: 'center' }}>Stk.</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(pos.einzelpreis)}</td>
                      <td style={{ textAlign: 'right' }}>{pos.mwst_satz.toFixed(2)} %</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(pos.einzelpreis * pos.menge)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                        Keine Positionen
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Totals */}
              <div className="invoice-totals">
                <div className="totals-row">
                  <span>Zwischensumme:</span>
                  <span>{formatCurrency(calculateNetto())}</span>
                </div>
                <div className="totals-row">
                  <span>Summe:</span>
                  <span>{formatCurrency(calculateNetto())}</span>
                </div>
                <div className="totals-row">
                  <span>19,00 % USt. auf EUR {formatCurrency(calculateNetto())}:</span>
                  <span>{formatCurrency(calculateMwst())}</span>
                </div>
                <div className="totals-row total-final">
                  <span>Endbetrag:</span>
                  <span>{formatCurrency(calculateBrutto())}</span>
                </div>
              </div>

              {/* Payment Terms und QR Codes nebeneinander */}
              <div style={{ display: 'flex', gap: '2rem', marginTop: '2rem', alignItems: 'flex-start' }}>
                {/* Payment Terms - Links */}
                <div className="payment-terms" style={{ flex: '1', minWidth: '300px' }}>
                  <p>Bitte beachten Sie unsere Zahlungsbedingung:</p>
                  <p>Ohne Abzug bis zum {formatDateDDMMYYYY(faelligAm)}.</p>
                  {notizen && (
                    <p style={{ marginTop: '1rem', fontStyle: 'italic' }}>
                      Hinweis: {notizen}
                    </p>
                  )}
                </div>

                {/* QR Codes für Überweisung - Rechts */}
                {calculateBrutto() > 0 && (
                  <div className="qr-codes-section" style={{ flex: '0 0 auto', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'nowrap', alignItems: 'flex-start', width: '100px', marginRight: '5mm' }}>
                    <div style={{ textAlign: 'center', flex: '0 0 auto', width: '100px' }}>
                      <h4 className="qr-code-title" style={{ marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 'bold', color: '#000000', textShadow: 'none', boxShadow: 'none', textTransform: 'uppercase' }}>QR-Code für Überweisung</h4>
                      <div style={{ padding: '0.3rem', background: '#fff', display: 'inline-block', borderRadius: '4px' }}>
                        <QRCodeSVG
                          value={generateEPCQRCode(calculateBrutto())}
                          size={70}
                          level="M"
                        />
                      </div>
                      <p style={{ marginTop: '0', fontSize: '0.75rem', color: '#000000', fontWeight: '600', lineHeight: '1.2' }}>
                        Betrag: {formatCurrency(calculateBrutto())} €
                      </p>
                      <p style={{ marginTop: '0', fontSize: '0.7rem', color: '#000000', fontWeight: '600', lineHeight: '1.2' }}>
                        bis zum {formatDateDDMMYYYY(faelligAm)} zu zahlen
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Fußzeile mit TDA-Daten und Bankdaten */}
              <div className="rechnung-footer" style={{
                position: 'absolute',
                bottom: '0',
                left: '20mm',
                right: '20mm',
                paddingTop: '0.75rem',
                paddingBottom: '0.5rem',
                borderTop: '1px solid rgba(0, 0, 0, 0.2)',
                fontSize: '7pt',
                color: '#000000',
                lineHeight: '1.6',
                textAlign: 'center'
              }}>
                {/* Zeile 1: TDA-Informationen */}
                <div style={{ marginBottom: '0.3rem' }}>
                  Tiger & Dragon Association International | Schwandweg 3a | 92712 Pirk | info@tda-intl.org | www.tda-intl.org
                </div>
                {/* Zeile 2: Bankdaten */}
                <div>
                  {bankDaten.bank_name} | {bankDaten.kontoinhaber} | {bankDaten.iban} | {bankDaten.bic}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Vorschau Modal nach Erstellung */}
      {showVorschauModal && (
        <div className="modal-overlay" onClick={() => setShowVorschauModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#1a1a2e', border: '1px solid rgba(201, 162, 39, 0.3)', borderRadius: '12px', width: '900px', height: '85vh', maxWidth: '90vw', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 style={{ color: '#fff', margin: 0 }}>Rechnung erstellt</h3>
              <button onClick={() => setShowVorschauModal(false)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <iframe src={vorschauUrl} title="Rechnung Vorschau" style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.25rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <button onClick={() => setShowVorschauModal(false)} style={{ padding: '0.6rem 1rem', background: 'transparent', border: '1px solid rgba(201, 162, 39, 0.5)', color: '#c9a227', borderRadius: '6px', cursor: 'pointer' }}>Schließen</button>
              <button onClick={() => window.open(vorschauUrl + '?print=1', '_blank')} style={{ padding: '0.6rem 1rem', background: 'linear-gradient(135deg, #c9a227, #a68519)', color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} /> PDF herunterladen
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default VerbandRechnungErstellen;
