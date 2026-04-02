import React, { useState, useEffect } from 'react';
import axios from 'axios';
import openApiBlob from '../utils/openApiBlob';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { Building2, Check, Search, X, Loader2, Save, Eye, Download, CheckCircle, BookOpen } from 'lucide-react';
import '../styles/RechnungErstellen.css';
import '../styles/VerbandRechnungErstellen.css';

const VerbandRechnungErstellen = ({ token: propToken }) => {
  const { token: contextToken } = useAuth();
  const token = propToken || contextToken;

  // View Mode: 'erstellen' oder 'ansehen'
  const [viewMode, setViewMode] = useState('erstellen');

  // Organisation ist immer TDA (keine Auswahl mehr nötig)
  const [selectedOrganisation] = useState({
    id: 'tda',
    name: 'Tiger & Dragon Association International',
    adresse: 'Ohmstr. 14, 84137 Vilsbiburg',
    typ: 'verband'
  });

  // Form Data
  const [empfaenger, setEmpfaenger] = useState({ verbandsmitglieder: [], softwareNutzer: [], dojoMitglieder: [] });
  const [artikel, setArtikel] = useState([]);
  const [selectedEmpfaenger, setSelectedEmpfaenger] = useState(null);
  const [empfaengerTyp, setEmpfaengerTyp] = useState('dojo_mitglied');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  // Manuelle Empfängerdaten
  const [manuellName, setManuellName] = useState('');
  const [manuellAdresse, setManuellAdresse] = useState('');
  const [manuellEmail, setManuellEmail] = useState('');

  // TDA Bankdaten
  const [bankDaten] = useState({
    bank_name: 'Sparkasse Niederbayern-Mitte',
    iban: 'DE89370400440532013000',
    bic: 'COBADEFFXXX',
    kontoinhaber: 'Tiger & Dragon Association International'
  });

  // Berechne Zahlungsfrist (7 Tage nach Belegdatum)
  const calculateZahlungsfrist = (belegdatum) => {
    if (!belegdatum) return '';
    const datum = new Date(belegdatum);
    datum.setDate(datum.getDate() + 7);
    return datum.toISOString().split('T')[0];
  };

  const [rechnungsDaten, setRechnungsDaten] = useState({
    rechnungsnummer: 'Wird geladen...',
    kundennummer: '',
    belegdatum: new Date().toISOString().split('T')[0],
    leistungsdatum: new Date().toISOString().split('T')[0],
    zahlungsfrist: calculateZahlungsfrist(new Date().toISOString().split('T')[0]),
    rabatt_prozent: 0,
    rabatt_auf_betrag: 0,
    skonto_prozent: 0,
    skonto_tage: 0
  });

  const [positionen, setPositionen] = useState([]);
  const [neuePosition, setNeuePosition] = useState({
    artikel_id: '',
    bezeichnung: '',
    artikelnummer: '',
    menge: 1,
    einzelpreis: 0,
    ust_prozent: 19,
    ist_rabattfaehig: false,
    rabatt_prozent: 0
  });
  const [showRabattHinweis, setShowRabattHinweis] = useState(false);

  // Vorschau Modal
  const [showVorschauModal, setShowVorschauModal] = useState(false);
  const [vorschauUrl, setVorschauUrl] = useState('');

  // Bestehende Rechnungen
  const [rechnungen, setRechnungen] = useState([]);

  // API Helper
  const getApi = () => axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${token}` }
  });


  // Daten laden beim Start
  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token]);

  // Skonto-Tage automatisch berechnen
  useEffect(() => {
    if (rechnungsDaten.belegdatum && rechnungsDaten.zahlungsfrist) {
      const belegdatum = new Date(rechnungsDaten.belegdatum);
      const zahlungsfrist = new Date(rechnungsDaten.zahlungsfrist);
      const diffTime = zahlungsfrist - belegdatum;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        setRechnungsDaten(prev => ({
          ...prev,
          skonto_tage: diffDays
        }));
      }
    }
  }, [rechnungsDaten.belegdatum, rechnungsDaten.zahlungsfrist]);

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
      if (nummernRes.data.success) setRechnungsDaten(prev => ({ ...prev, rechnungsnummer: nummernRes.data.rechnungsnummer }));
      if (rechnungenRes.data.success) setRechnungen(rechnungenRes.data.rechnungen);
      const artikelData = artikelRes.data?.data || artikelRes.data || [];
      setArtikel(Array.isArray(artikelData) ? artikelData : []);
      setError(null);
    } catch (err) {
      console.error('Fehler beim Laden:', err);
      setError('Fehler beim Laden der Daten');
    } finally {
      setLoading(false);
    }
  };

  const handleEmpfaengerSelect = (emp, typ) => {
    setSelectedEmpfaenger(emp);
    setEmpfaengerTyp(typ);
    setRechnungsDaten(prev => ({ ...prev, kundennummer: emp.id || '' }));
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
        artikelnummer: art.artikel_nummer || '',
        einzelpreis: preis,
        ust_prozent: art.mwst_prozent || 19
      });
    }
  };

  const addPosition = () => {
    if (!neuePosition.bezeichnung || neuePosition.menge <= 0) return;

    // Prüfe ob Artikel bereits existiert
    const existingIndex = positionen.findIndex(pos =>
      pos.artikel_id === neuePosition.artikel_id &&
      pos.bezeichnung === neuePosition.bezeichnung &&
      Number(pos.einzelpreis) === Number(neuePosition.einzelpreis)
    );

    if (existingIndex !== -1) {
      const updatedPositionen = [...positionen];
      updatedPositionen[existingIndex] = {
        ...updatedPositionen[existingIndex],
        menge: Number(updatedPositionen[existingIndex].menge) + Number(neuePosition.menge)
      };
      setPositionen(updatedPositionen);
    } else {
      setPositionen([...positionen, {
        ...neuePosition,
        pos: positionen.length + 1,
        menge: Number(neuePosition.menge),
        einzelpreis: Number(neuePosition.einzelpreis),
        ust_prozent: Number(neuePosition.ust_prozent),
        ist_rabattfaehig: neuePosition.ist_rabattfaehig,
        rabatt_prozent: Number(neuePosition.rabatt_prozent) || 0
      }]);
    }

    setNeuePosition({
      artikel_id: '',
      bezeichnung: '',
      artikelnummer: '',
      menge: 1,
      einzelpreis: 0,
      ust_prozent: 19,
      ist_rabattfaehig: false,
      rabatt_prozent: 0
    });
  };

  const removePosition = (index) => {
    const newPositionen = positionen.filter((_, i) => i !== index);
    setPositionen(newPositionen.map((pos, i) => ({ ...pos, pos: i + 1 })));
  };

  // Berechnungen
  const calculateZwischensumme = () => {
    return positionen.reduce((sum, pos) => {
      const bruttoPreis = Number(pos.einzelpreis) * Number(pos.menge);
      const rabattProzent = Number(pos.rabatt_prozent) || 0;
      const rabattBetrag = bruttoPreis * rabattProzent / 100;
      return sum + (bruttoPreis - rabattBetrag);
    }, 0);
  };

  const calculateRabatt = () => {
    const zwischensumme = calculateZwischensumme();
    if (rechnungsDaten.rabatt_prozent > 0) {
      const rabattBasis = rechnungsDaten.rabatt_auf_betrag || zwischensumme;
      return (rabattBasis * rechnungsDaten.rabatt_prozent) / 100;
    }
    return 0;
  };

  const calculateSumme = () => {
    return calculateZwischensumme() - calculateRabatt();
  };

  const calculateSkonto = () => {
    const summe = calculateSumme();
    if (rechnungsDaten.skonto_prozent > 0 && rechnungsDaten.skonto_tage > 0) {
      return (summe * rechnungsDaten.skonto_prozent) / 100;
    }
    return 0;
  };

  const calculateUSt = () => {
    const summe = calculateSumme();
    return (summe * 19) / 100;
  };

  const calculateEndbetrag = () => {
    return calculateSumme() + calculateUSt();
  };

  // Formatiere Datum im Format dd.mm.yyyy
  const formatDateDDMMYYYY = (dateString, addDays = 0) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (addDays > 0) {
      date.setDate(date.getDate() + addDays);
    }
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

    const verwendungszweck = `Rechnung ${rechnungsDaten.rechnungsnummer || ''}`.substring(0, 140);

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
      rechnungsDaten.rechnungsnummer?.substring(0, 35) || '',
      '',
      ''
    ].join('\n');
  };

  const handleSpeichern = async () => {
    if (!selectedEmpfaenger && empfaengerTyp !== 'manuell') {
      setError('Bitte wählen Sie einen Kunden aus');
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
        rechnungsnummer: rechnungsDaten.rechnungsnummer,
        rechnungsdatum: rechnungsDaten.belegdatum,
        leistungsdatum: rechnungsDaten.leistungsdatum,
        faellig_am: rechnungsDaten.zahlungsfrist,
        rabatt_prozent: rechnungsDaten.rabatt_prozent,
        skonto_prozent: rechnungsDaten.skonto_prozent,
        skonto_tage: rechnungsDaten.skonto_tage,
        positionen: positionen.map(pos => ({
          bezeichnung: pos.bezeichnung,
          menge: pos.menge,
          einzelpreis: pos.einzelpreis,
          mwst_satz: pos.ust_prozent,
          ist_rabattfaehig: pos.ist_rabattfaehig,
          rabatt_prozent: pos.rabatt_prozent
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

        const numRes = await getApi().get('/verband-rechnungen/nummernkreis');
        if (numRes.data.success) setRechnungsDaten(prev => ({ ...prev, rechnungsnummer: numRes.data.rechnungsnummer }));
        loadData();
      }
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      setError(err.response?.data?.error || 'Fehler beim Speichern der Rechnung');
    } finally {
      setSaving(false);
    }
  };

  // Download-Funktion für Rechnungen (öffnet Print-Dialog)
  const handleDownloadRechnung = (rechnungId) => {
    openApiBlob(`/api/verband-rechnungen/${rechnungId}/pdf?print=1`);
  };

  // Rechnung ansehen (HTML in neuem Tab öffnen)
  const handleViewRechnung = (rechnungId) => {
    openApiBlob(`/api/verband-rechnungen/${rechnungId}/pdf`);
  };

  // Status-Badge Farbe
  const getStatusColor = (status) => {
    switch (status) {
      case 'bezahlt': return { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 0.5)', text: '#22c55e' };
      case 'offen': return { bg: 'rgba(234, 179, 8, 0.2)', border: 'rgba(234, 179, 8, 0.5)', text: '#eab308' };
      case 'ueberfaellig': return { bg: 'rgba(239, 68, 68, 0.2)', border: 'rgba(239, 68, 68, 0.5)', text: '#ef4444' };
      case 'storniert': return { bg: 'rgba(107, 114, 128, 0.2)', border: 'rgba(107, 114, 128, 0.5)', text: '#6b7280' };
      default: return { bg: 'rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.3)', text: '#fff' };
    }
  };

  // Rechnung als bezahlt markieren (OHNE EÜR-Eintrag)
  const handleMarkAsBezahlt = async (rechnungId) => {
    try {
      const response = await getApi().put(`/verband-rechnungen/${rechnungId}/status`, {
        status: 'bezahlt',
        bezahlt_am: new Date().toISOString().split('T')[0]
      });

      if (response.data.success) {
        setSuccess('Rechnung als bezahlt markiert');
        loadData(); // Liste neu laden
      }
    } catch (err) {
      console.error('Fehler beim Markieren:', err);
      setError('Fehler beim Markieren als bezahlt');
    }
  };

  // Rechnung in EÜR buchen (erstellt Beleg in buchhaltung_belege)
  const handleEuerZuordnen = async (rechnung) => {
    try {
      const response = await getApi().post(`/verband-rechnungen/${rechnung.id}/euer-buchen`);

      if (response.data.success) {
        setSuccess(`Rechnung ${rechnung.rechnungsnummer} in EÜR gebucht (Beleg ${response.data.beleg_nummer})`);
        loadData();
      }
    } catch (err) {
      console.error('Fehler beim EÜR-Buchen:', err);
      setError(err.response?.data?.error || 'Fehler beim Buchen in EÜR');
    }
  };

  if (loading) {
    return (
      <div className="rechnung-erstellen-container">
        <div className="vre-loading-center">
          <Loader2 size={32} className="vre-spinner-icon" />
          <p>Lade Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rechnung-erstellen-container">
      {/* View Mode Toggle */}
      <div className="vre-view-toggle">
        <button
          onClick={() => setViewMode('erstellen')}
          className={`vre-toggle-btn${viewMode === 'erstellen' ? ' vre-toggle-btn--active' : ''}`}
        >
          <Save size={18} />
          Rechnung erstellen
        </button>
        <button
          onClick={() => setViewMode('ansehen')}
          className={`vre-toggle-btn${viewMode === 'ansehen' ? ' vre-toggle-btn--active' : ''}`}
        >
          <Eye size={18} />
          Rechnungen ansehen
        </button>
      </div>

      {/* Rechnungen Liste */}
      {viewMode === 'ansehen' ? (
        <div className="vre-list-wrapper">
          <div className="vre-list-card">
            <div className="vre-list-header">
              <h2 className="vre-list-title">
                <Building2 size={24} className="u-text-accent" />
                TDA Rechnungen
              </h2>
              <span className="vre-list-count">
                {rechnungen.length} Rechnungen
              </span>
            </div>

            {rechnungen.length === 0 ? (
              <div className="vre-table-empty">
                Keine Rechnungen vorhanden
              </div>
            ) : (
              <div className="vre-table-scroll">
                <table className="vre-table">
                  <thead>
                    <tr className="vre-thead-row">
                      <th className="vre-th-center-primary">Rechnungs-Nr.</th>
                      <th className="vre-th-center-primary">Datum</th>
                      <th className="vre-th-center-primary">Empfänger</th>
                      <th className="vre-th-right-primary">Betrag</th>
                      <th className="vre-th-center-primary-center">Status</th>
                      <th className="vre-th-center-primary-center">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rechnungen.map((rechnung) => {
                      const statusColors = getStatusColor(rechnung.status);
                      return (
                        <tr key={rechnung.id} className="vre-tbody-row">
                          <td className="vre-td-mono">
                            {rechnung.rechnungsnummer}
                          </td>
                          <td className="vre-td-secondary">
                            {rechnung.rechnungsdatum ? formatDateDDMMYYYY(rechnung.rechnungsdatum) : '-'}
                          </td>
                          <td className="vre-td-secondary">
                            {rechnung.empfaenger_name || '-'}
                          </td>
                          <td className="vre-td-primary-bold">
                            {Number(rechnung.summe_brutto || 0).toFixed(2)} €
                          </td>
                          <td className="vre-td-center">
                            <span
                              className="vre-status-badge"
                              style={{ '--status-bg': statusColors.bg, '--status-border': statusColors.border, '--status-text': statusColors.text }}
                            >
                              {rechnung.status || 'offen'}
                            </span>
                          </td>
                          <td className="vre-td-actions">
                            <div className="vre-actions-flex">
                              <button
                                onClick={() => handleViewRechnung(rechnung.id)}
                                title="Ansehen"
                                className="vre-btn-view"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => handleDownloadRechnung(rechnung.id)}
                                title="Drucken/PDF"
                                className="vre-btn-download"
                              >
                                <Download size={16} />
                              </button>
                              {rechnung.status !== 'bezahlt' && (
                                <button
                                  onClick={() => handleMarkAsBezahlt(rechnung.id)}
                                  title="Als bezahlt markieren"
                                  className="vre-btn-bezahlt"
                                >
                                  <CheckCircle size={16} />
                                </button>
                              )}
                              {!rechnung.euer_gebucht && (
                                <button
                                  onClick={() => handleEuerZuordnen(rechnung)}
                                  title="In EÜR buchen"
                                  className="vre-btn-euer"
                                >
                                  <BookOpen size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {error && (
            <div className="vre-error-banner">
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="rechnung-editor">
          {/* Eingabeformular */}
          <div className="rechnung-form">
            <h2>NEUE RECHNUNG ERSTELLEN</h2>

          {/* Kunde */}
          <div className="form-section">
            <h3>KUNDE</h3>
            <div className="vre-empfaenger-tabs">
              {[
                { id: 'dojo_mitglied', label: 'Mitglieder' },
                { id: 'verbandsmitglied', label: 'Verband' },
                { id: 'software_nutzer', label: 'Software' },
                { id: 'manuell', label: 'Manuell' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setEmpfaengerTyp(tab.id); setSelectedEmpfaenger(null); }}
                  className={`vre-tab-btn${empfaengerTyp === tab.id ? ' vre-tab-btn--active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {empfaengerTyp !== 'manuell' ? (
              <select
                onChange={(e) => {
                  const emp = getFilteredEmpfaenger().find(em => em.id === parseInt(e.target.value));
                  if (emp) handleEmpfaengerSelect(emp, empfaengerTyp);
                }}
                value={selectedEmpfaenger?.id || ''}
              >
                <option value="">Bitte wählen...</option>
                {getFilteredEmpfaenger().map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.dojo_name ? `(${emp.dojo_name})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="vre-manuell-col">
                <input type="text" value={manuellName} onChange={(e) => setManuellName(e.target.value)} placeholder="Name / Firma *" />
                <textarea value={manuellAdresse} onChange={(e) => setManuellAdresse(e.target.value)} placeholder="Adresse" rows={2} className="vre-textarea-noresize" />
                <input type="email" value={manuellEmail} onChange={(e) => setManuellEmail(e.target.value)} placeholder="E-Mail" />
              </div>
            )}
          </div>

          {/* Rechnungsdaten */}
          <div className="form-section">
            <h3>RECHNUNGSDATEN</h3>
            <div className="form-grid">
              <div>
                <label>Belegdatum</label>
                <input
                  type="date"
                  value={rechnungsDaten.belegdatum}
                  onChange={(e) => setRechnungsDaten({
                    ...rechnungsDaten,
                    belegdatum: e.target.value,
                    zahlungsfrist: calculateZahlungsfrist(e.target.value)
                  })}
                />
              </div>
              <div>
                <label>Leistungsdatum</label>
                <input
                  type="date"
                  value={rechnungsDaten.leistungsdatum}
                  onChange={(e) => setRechnungsDaten({ ...rechnungsDaten, leistungsdatum: e.target.value })}
                />
              </div>
              <div>
                <label>Zahlungsfrist</label>
                <input
                  type="date"
                  value={rechnungsDaten.zahlungsfrist}
                  onChange={(e) => setRechnungsDaten({ ...rechnungsDaten, zahlungsfrist: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Position hinzufügen */}
          <div className="form-section">
            <h3>POSITION HINZUFÜGEN</h3>
            <div className="position-input">
              <select onChange={(e) => handleArtikelChange(e.target.value)} value={neuePosition.artikel_id}>
                <option value="">Artikel wählen...</option>
                {artikel.map(a => (
                  <option key={a.artikel_id || a.id} value={a.artikel_id || a.id}>
                    {a.name || a.bezeichnung}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={neuePosition.menge}
                onChange={(e) => setNeuePosition({ ...neuePosition, menge: parseInt(e.target.value) || 1 })}
                min="1"
                className="vre-qty-input"
              />
              <button onClick={addPosition} className="btn-add">Hinzufügen</button>
            </div>

            {/* Hinzugefügte Positionen */}
            {positionen.length > 0 && (
              <div className="vre-positions-list">
                {positionen.map((pos, index) => (
                  <div key={index} className="position-item vre-position-item-inner">
                    {/* Zeile 1: Bezeichnung + Löschen */}
                    <div className="vre-pos-header">
                      <span className="vre-pos-name">{pos.bezeichnung}</span>
                      <button
                        onClick={() => removePosition(index)}
                        className="vre-btn-remove-pos"
                      >×</button>
                    </div>
                    {/* Zeile 2: Menge, Preis, Rabatt, Summe - alles in einer Zeile */}
                    <div className="vre-pos-details">
                      <input
                        type="number"
                        value={pos.menge}
                        onChange={(e) => {
                          const updatedPositionen = [...positionen];
                          updatedPositionen[index] = { ...pos, menge: parseInt(e.target.value) || 1 };
                          setPositionen(updatedPositionen);
                        }}
                        min="1"
                        className="vre-pos-menge-input"
                      />
                      <span className="vre-text-muted-xs">×</span>
                      <span className="vre-pos-preis">{pos.einzelpreis.toFixed(2)}€</span>
                      <span className="vre-pos-separator">|</span>
                      <span className="vre-text-muted-xs">Rabatt</span>
                      <input
                        type="number"
                        value={pos.rabatt_prozent || 0}
                        onChange={(e) => {
                          const updatedPositionen = [...positionen];
                          const rabattVal = parseFloat(e.target.value) || 0;
                          updatedPositionen[index] = { ...pos, rabatt_prozent: rabattVal, ist_rabattfaehig: rabattVal > 0 };
                          setPositionen(updatedPositionen);
                        }}
                        min="0"
                        max="100"
                        step="1"
                        className="vre-pos-rabatt-input"
                      />
                      <span className="vre-text-muted-xs">%</span>
                      <span className="vre-pos-sum">
                        = {((pos.menge * pos.einzelpreis) * (1 - (pos.rabatt_prozent || 0) / 100)).toFixed(2)} €
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Rabatt & Skonto */}
          <div className="form-section">
            <h3>RABATT & SKONTO</h3>
            <div className="form-grid">
              <div className="vre-rabatt-field">
                <div className="vre-rabatt-label-row">
                  <label>Rabatt %</label>
                  <button
                    type="button"
                    onClick={() => setShowRabattHinweis(!showRabattHinweis)}
                    className="vre-btn-info"
                  >
                    ?
                  </button>
                </div>
                <input
                  type="number"
                  value={rechnungsDaten.rabatt_prozent}
                  onChange={(e) => setRechnungsDaten({ ...rechnungsDaten, rabatt_prozent: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
              <div>
                <label>Skonto %</label>
                <input
                  type="number"
                  value={rechnungsDaten.skonto_prozent}
                  onChange={(e) => setRechnungsDaten({ ...rechnungsDaten, skonto_prozent: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>
              <div>
                <label>Skonto Tage</label>
                <input
                  type="number"
                  value={rechnungsDaten.skonto_tage}
                  readOnly
                  className="vre-input-readonly"
                />
              </div>
            </div>
          </div>

          {/* Rabatt Hinweis Modal */}
          {showRabattHinweis && (
            <>
              <div className="vre-hint-modal">
                <strong>Globaler Rabatt:</strong> Dieser Rabatt wird auf die gesamte Rechnung angewendet.
                <br /><br />
                Für <strong>einzelne Positionen</strong> können Sie den Rabatt oben in der Positionsliste festlegen.
                <button
                  onClick={() => setShowRabattHinweis(false)}
                  className="vre-hint-modal-btn"
                >
                  Verstanden
                </button>
              </div>
              <div className="vre-hint-overlay" onClick={() => setShowRabattHinweis(false)} />
            </>
          )}

          {error && (
            <div className="vre-error-banner-sm">
              {error}
            </div>
          )}

          <button onClick={handleSpeichern} className="btn-save" disabled={saving}>
            {saving ? 'Speichern...' : 'Rechnung speichern'}
          </button>
        </div>

        {/* Rechnungsvorschau */}
        <div className="rechnung-preview">
          <div className="invoice-page">
            {/* Header */}
            <div className="invoice-header">
              <div className="company-info">
                <div className="company-small">
                  {selectedOrganisation?.name} | {selectedOrganisation?.adresse}
                </div>
                <div className="recipient-address">
                  {selectedEmpfaenger ? (
                    <>
                      <div>Herrn/Frau</div>
                      <div>{selectedEmpfaenger.name}</div>
                      {selectedEmpfaenger.adresse && selectedEmpfaenger.adresse.split(',').map((line, i) => (
                        <div key={i}>{line.trim()}</div>
                      ))}
                    </>
                  ) : empfaengerTyp === 'manuell' && manuellName ? (
                    <>
                      <div>Herrn/Frau</div>
                      <div>{manuellName}</div>
                      {manuellAdresse && manuellAdresse.split(',').map((line, i) => (
                        <div key={i}>{line.trim()}</div>
                      ))}
                    </>
                  ) : (
                    <div className="u-text-muted">Bitte Kunde wählen</div>
                  )}
                </div>
              </div>
              <div className="invoice-meta">
                <img src="/public/tda-logo.png" alt="TDA Logo" className="vre-invoice-logo" onError={(e) => { e.target.style.display = 'none'; }} />
                <div className="invoice-numbers">
                  <div>Rechnungs-Nr.: {rechnungsDaten.rechnungsnummer}</div>
                  <div>Kundennummer: {rechnungsDaten.kundennummer || '-'}</div>
                  <div>Belegdatum: {rechnungsDaten.belegdatum}</div>
                  <div>Liefer-/Leistungsdatum: {rechnungsDaten.leistungsdatum}</div>
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="invoice-title">
              <h1>RECHNUNG</h1>
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
                  <th>Rabatt %</th>
                  <th>USt %</th>
                  <th>Betrag EUR</th>
                </tr>
              </thead>
              <tbody>
                {positionen.map((pos, index) => {
                  const bruttoPreis = Number(pos.einzelpreis) * Number(pos.menge);
                  const rabattProzent = Number(pos.rabatt_prozent) || 0;
                  const rabattBetrag = bruttoPreis * rabattProzent / 100;
                  const nettoPreis = bruttoPreis - rabattBetrag;

                  return (
                    <tr key={index}>
                      <td>{pos.pos}</td>
                      <td>{pos.bezeichnung}</td>
                      <td>{pos.artikelnummer || '-'}</td>
                      <td>{pos.menge}</td>
                      <td>Stk.</td>
                      <td>{Number(pos.einzelpreis).toFixed(2)}</td>
                      <td>{rabattProzent > 0 ? `${rabattProzent.toFixed(2)} %` : '-'}</td>
                      <td>{Number(pos.ust_prozent).toFixed(2)} %</td>
                      <td>{nettoPreis.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Totals */}
            <div className="invoice-totals">
              <div className="totals-row">
                <span>Zwischensumme:</span>
                <span>{calculateZwischensumme().toFixed(2)}</span>
              </div>
              {rechnungsDaten.rabatt_prozent > 0 && (
                <div className="totals-row">
                  <span>{rechnungsDaten.rabatt_prozent.toFixed(2)} % Rabatt:</span>
                  <span>-{calculateRabatt().toFixed(2)}</span>
                </div>
              )}
              <div className="totals-row">
                <span>Summe:</span>
                <span>{calculateSumme().toFixed(2)}</span>
              </div>
              <div className="totals-row">
                <span>19,00 % USt. auf EUR {calculateSumme().toFixed(2)}:</span>
                <span>{calculateUSt().toFixed(2)}</span>
              </div>
              <div className="totals-row total-final">
                <span>Endbetrag:</span>
                <span>{calculateEndbetrag().toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Terms und QR Codes */}
            <div className="vre-payment-qr-row">
              <div className="payment-terms vre-payment-terms-col">
                <p>Bitte beachten Sie unsere Zahlungsbedingung:</p>
                {Number(rechnungsDaten.skonto_prozent) > 0 && Number(rechnungsDaten.skonto_tage) > 0 ? (
                  <p>
                    {Number(rechnungsDaten.skonto_prozent).toFixed(2)} % Skonto bei Zahlung innerhalb von {rechnungsDaten.skonto_tage} Tagen (bis zum {formatDateDDMMYYYY(rechnungsDaten.belegdatum, rechnungsDaten.skonto_tage)}).
                    <br />
                    Ohne Abzug bis zum {formatDateDDMMYYYY(rechnungsDaten.zahlungsfrist)}.
                    <br />
                    Skonto-Betrag: {calculateSkonto().toFixed(2)} €
                    <br />
                    Zu überweisender Betrag: {(calculateEndbetrag() - calculateSkonto()).toFixed(2)} €
                  </p>
                ) : (
                  <p>Ohne Abzug bis zum {formatDateDDMMYYYY(rechnungsDaten.zahlungsfrist)}.</p>
                )}
              </div>

              {/* QR Codes */}
              {calculateEndbetrag() > 0 && (
                <div className="qr-codes-section" style={{ flex: '0 0 auto', display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'nowrap', alignItems: 'flex-start', width: Number(rechnungsDaten.skonto_prozent) > 0 ? '180px' : '90px', marginRight: '5mm' }}>
                  {Number(rechnungsDaten.skonto_prozent) > 0 && Number(rechnungsDaten.skonto_tage) > 0 ? (
                    <>
                      {/* QR-Code mit Skonto */}
                      <div className="vre-td-center-w90">
                        <h4 className="qr-code-title vre-section-title">Zahlung mit Skonto</h4>
                        <div className="vre-logo-wrapper">
                          <QRCodeSVG
                            value={generateEPCQRCode(calculateEndbetrag() - calculateSkonto())}
                            size={70}
                            level="M"
                          />
                        </div>
                        <p className="vre-label-small-bold">
                          Betrag: {(calculateEndbetrag() - calculateSkonto()).toFixed(2)} €
                        </p>
                        <p className="vre-label-small">
                          bis zum {formatDateDDMMYYYY(rechnungsDaten.belegdatum, rechnungsDaten.skonto_tage)}
                        </p>
                      </div>
                      {/* QR-Code ohne Skonto */}
                      <div className="vre-td-center-w90">
                        <h4 className="qr-code-title vre-section-title">Zahlung ohne Skonto</h4>
                        <div className="vre-logo-wrapper">
                          <QRCodeSVG
                            value={generateEPCQRCode(calculateEndbetrag())}
                            size={70}
                            level="M"
                          />
                        </div>
                        <p className="vre-label-small-bold">
                          Betrag: {calculateEndbetrag().toFixed(2)} €
                        </p>
                        <p className="vre-label-small">
                          ab {formatDateDDMMYYYY(rechnungsDaten.zahlungsfrist)}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="vre-td-center-w90">
                      <h4 className="qr-code-title vre-section-title">QR-Code für Überweisung</h4>
                      <div className="vre-logo-wrapper">
                        <QRCodeSVG
                          value={generateEPCQRCode(calculateEndbetrag())}
                          size={70}
                          level="M"
                        />
                      </div>
                      <p className="vre-label-small-bold">
                        Betrag: {calculateEndbetrag().toFixed(2)} €
                      </p>
                      <p className="vre-label-small">
                        bis zum {formatDateDDMMYYYY(rechnungsDaten.zahlungsfrist)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="rechnung-footer">
              <div className="vre-footer-row-mb">
                {selectedOrganisation?.name} | {selectedOrganisation?.adresse} | info@tda-intl.org | www.tda-intl.org
              </div>
              <div>
                {bankDaten.bank_name} | {bankDaten.kontoinhaber} | {bankDaten.iban} | {bankDaten.bic}
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Vorschau Modal */}
      {showVorschauModal && (
        <div className="modal-overlay vre-modal-overlay" onClick={() => setShowVorschauModal(false)}>
          <div onClick={(e) => e.stopPropagation()} className="vre-modal-content">
            <div className="vre-modal-header">
              <h3 className="vre-modal-title">Rechnung erstellt</h3>
              <button onClick={() => setShowVorschauModal(false)} className="vre-modal-close-btn"><X size={20} /></button>
            </div>
            <div className="vre-modal-body">
              <iframe src={vorschauUrl} title="Rechnung Vorschau" className="vre-modal-iframe" />
            </div>
            <div className="vre-modal-footer">
              <button onClick={() => setShowVorschauModal(false)} className="vre-btn-modal-close">Schließen</button>
              <button onClick={() => window.open(vorschauUrl + '?print=1', '_blank')} className="vre-btn-modal-download">
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
