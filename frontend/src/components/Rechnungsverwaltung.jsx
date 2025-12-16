import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  FileText,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  Archive,
  Eye,
  Edit,
  Trash2,
  Download,
  TrendingUp,
  Calendar
} from "lucide-react";
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Rechnungsverwaltung.css";

const Rechnungsverwaltung = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('alle'); // alle, offen, bezahlt, ueberfaellig, archiv
  const [searchTerm, setSearchTerm] = useState('');
  const [rechnungen, setRechnungen] = useState([]);
  const [filteredRechnungen, setFilteredRechnungen] = useState([]);
  const [statistiken, setStatistiken] = useState({
    gesamt_rechnungen: 0,
    offene_rechnungen: 0,
    bezahlte_rechnungen: 0,
    ueberfaellige_rechnungen: 0,
    offene_summe: 0,
    bezahlte_summe: 0,
    ueberfaellige_summe: 0,
    gesamt_summe: 0
  });
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form States
  const [mitglieder, setMitglieder] = useState([]);
  const [artikel, setArtikel] = useState([]);
  const [formData, setFormData] = useState({
    mitglied_id: '',
    datum: new Date().toISOString().split('T')[0],
    faelligkeitsdatum: '',
    art: 'Verkauf',
    beschreibung: '',
    notizen: '',
    mwst_satz: 19
  });
  const [positionen, setPositionen] = useState([]);
  const [selectedArtikel, setSelectedArtikel] = useState('');
  const [menge, setMenge] = useState(1);

  useEffect(() => {
    loadData();
    loadMitglieder();
    loadArtikel();
  }, []);

  useEffect(() => {
    filterRechnungen();
  }, [activeView, searchTerm, rechnungen]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [rechnungenRes, statsRes] = await Promise.all([
        fetch(`${config.apiBaseUrl}/rechnungen`),
        fetch(`${config.apiBaseUrl}/rechnungen/statistiken`)
      ]);

      if (rechnungenRes.ok) {
        const rechnungenData = await rechnungenRes.json();
        setRechnungen(rechnungenData.data || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStatistiken(statsData.data || statistiken);
      }

      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Daten:', error);
      setLoading(false);
    }
  };

  const loadMitglieder = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/mitglieder`);
      if (response.ok) {
        const data = await response.json();
        setMitglieder(data || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Mitglieder:', error);
    }
  };

  const loadArtikel = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/artikel`);
      if (response.ok) {
        const data = await response.json();
        setArtikel(data.data || []);
      }
    } catch (error) {
      console.error('Fehler beim Laden der Artikel:', error);
    }
  };

  const filterRechnungen = () => {
    let filtered = [...rechnungen];

    // Filter nach View
    switch (activeView) {
      case 'offen':
        filtered = filtered.filter(r => r.status === 'offen' && r.archiviert === 0);
        break;
      case 'bezahlt':
        filtered = filtered.filter(r => r.status === 'bezahlt' && r.archiviert === 0);
        break;
      case 'ueberfaellig':
        filtered = filtered.filter(r => {
          const faellig = new Date(r.faelligkeitsdatum);
          const heute = new Date();
          return (r.status === 'offen' || r.status === 'ueberfaellig') && faellig < heute && r.archiviert === 0;
        });
        break;
      case 'archiv':
        filtered = filtered.filter(r => r.archiviert === 1);
        break;
      default:
        filtered = filtered.filter(r => r.archiviert === 0);
    }

    // Suchfilter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(r =>
        r.rechnungsnummer.toLowerCase().includes(search) ||
        r.mitglied_name.toLowerCase().includes(search) ||
        r.beschreibung?.toLowerCase().includes(search)
      );
    }

    setFilteredRechnungen(filtered);
  };

  // Formular-Funktionen
  const addPosition = () => {
    if (!selectedArtikel || menge <= 0) return;

    const foundArtikel = artikel.find(a => a.artikel_id === parseInt(selectedArtikel));
    if (!foundArtikel) return;

    const einzelpreis = foundArtikel.verkaufspreis_cent / 100;
    const gesamtpreis = einzelpreis * menge;

    const neuePosition = {
      artikel_id: foundArtikel.artikel_id,
      bezeichnung: foundArtikel.name,
      menge: menge,
      einzelpreis: einzelpreis,
      gesamtpreis: gesamtpreis,
      mwst_satz: formData.mwst_satz,
      beschreibung: foundArtikel.beschreibung || ''
    };

    setPositionen([...positionen, neuePosition]);
    setSelectedArtikel('');
    setMenge(1);
  };

  const removePosition = (index) => {
    setPositionen(positionen.filter((_, i) => i !== index));
  };

  const calculateTotals = () => {
    const netto = positionen.reduce((sum, pos) => sum + pos.gesamtpreis, 0);
    const mwst = netto * (formData.mwst_satz / 100);
    const brutto = netto + mwst;
    return { netto, mwst, brutto };
  };

  const handleSubmit = async () => {
    if (!formData.mitglied_id || !formData.datum || !formData.faelligkeitsdatum || positionen.length === 0) {
      alert('Bitte füllen Sie alle Pflichtfelder aus und fügen Sie mindestens eine Position hinzu.');
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/rechnungen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          positionen
        })
      });

      if (response.ok) {
        alert('Rechnung erfolgreich erstellt!');
        setShowCreateModal(false);
        // Reset form
        setFormData({
          mitglied_id: '',
          datum: new Date().toISOString().split('T')[0],
          faelligkeitsdatum: '',
          art: 'Verkauf',
          beschreibung: '',
          notizen: '',
          mwst_satz: 19
        });
        setPositionen([]);
        loadData();
      } else {
        const error = await response.json();
        alert('Fehler beim Erstellen der Rechnung: ' + (error.error || 'Unbekannter Fehler'));
      }
    } catch (error) {
      console.error('Fehler beim Erstellen der Rechnung:', error);
      alert('Fehler beim Erstellen der Rechnung.');
    }
  };

  const handleArchivieren = async (rechnung_id, archivieren) => {
    if (!window.confirm(archivieren ? 'Rechnung archivieren?' : 'Archivierung aufheben?')) {
      return;
    }

    try {
      const res = await fetch(`${config.apiBaseUrl}/rechnungen/${rechnung_id}/archivieren`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archiviert: archivieren })
      });

      if (res.ok) {
        alert(archivieren ? 'Rechnung archiviert' : 'Archivierung aufgehoben');
        loadData();
      }
    } catch (error) {
      console.error('Fehler beim Archivieren:', error);
      alert('Fehler beim Archivieren');
    }
  };

  const handleDelete = async (rechnung_id) => {
    if (!window.confirm('Rechnung wirklich löschen? Dies kann nicht rückgängig gemacht werden!')) {
      return;
    }

    try {
      const res = await fetch(`${config.apiBaseUrl}/rechnungen/${rechnung_id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        alert('Rechnung gelöscht');
        loadData();
      }
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      alert('Fehler beim Löschen');
    }
  };

  const getStatusBadge = (rechnung) => {
    const faellig = new Date(rechnung.faelligkeitsdatum);
    const heute = new Date();

    if (rechnung.status === 'bezahlt') {
      return <span className="badge badge-success">Bezahlt</span>;
    } else if (rechnung.status === 'teilweise_bezahlt') {
      return <span className="badge badge-warning">Teilweise bezahlt</span>;
    } else if (faellig < heute) {
      return <span className="badge badge-danger">Überfällig</span>;
    } else {
      return <span className="badge badge-info">Offen</span>;
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE');
  };

  if (loading) {
    return (
      <div className="rechnungen-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Rechnungen...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rechnungen-container">
      {/* Header */}
      <div className="rechnungen-header">
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/beitraege')}>
          <ArrowLeft size={20} />
          Zurück
        </button>
        <div>
          <h1>📄 Rechnungsverwaltung</h1>
          <p>Erstelle, verwalte und prüfe alle Rechnungen</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={20} />
          Neue Rechnung
        </button>
      </div>

      {/* Statistiken */}
      <div className="stats-grid">
        <div className="stat-card info">
          <div className="stat-icon">
            <FileText size={32} />
          </div>
          <div className="stat-info">
            <h3>Gesamt Rechnungen</h3>
            <p className="stat-value">{statistiken.gesamt_rechnungen}</p>
            <span className="stat-trend">{formatCurrency(statistiken.gesamt_summe)}</span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">
            <Clock size={32} />
          </div>
          <div className="stat-info">
            <h3>Offene Rechnungen</h3>
            <p className="stat-value">{statistiken.offene_rechnungen}</p>
            <span className="stat-trend">{formatCurrency(statistiken.offene_summe)}</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <CheckCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>Bezahlte Rechnungen</h3>
            <p className="stat-value">{statistiken.bezahlte_rechnungen}</p>
            <span className="stat-trend">{formatCurrency(statistiken.bezahlte_summe)}</span>
          </div>
        </div>

        <div className="stat-card danger">
          <div className="stat-icon">
            <AlertCircle size={32} />
          </div>
          <div className="stat-info">
            <h3>Überfällige Rechnungen</h3>
            <p className="stat-value">{statistiken.ueberfaellige_rechnungen}</p>
            <span className="stat-trend">{formatCurrency(statistiken.ueberfaellige_summe)}</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="view-tabs">
        <button
          className={`tab ${activeView === 'alle' ? 'active' : ''}`}
          onClick={() => setActiveView('alle')}
        >
          <FileText size={18} />
          Alle Rechnungen
        </button>
        <button
          className={`tab ${activeView === 'offen' ? 'active' : ''}`}
          onClick={() => setActiveView('offen')}
        >
          <Clock size={18} />
          Offen
        </button>
        <button
          className={`tab ${activeView === 'bezahlt' ? 'active' : ''}`}
          onClick={() => setActiveView('bezahlt')}
        >
          <CheckCircle size={18} />
          Bezahlt
        </button>
        <button
          className={`tab ${activeView === 'ueberfaellig' ? 'active' : ''}`}
          onClick={() => setActiveView('ueberfaellig')}
        >
          <AlertCircle size={18} />
          Überfällig
        </button>
        <button
          className={`tab ${activeView === 'archiv' ? 'active' : ''}`}
          onClick={() => setActiveView('archiv')}
        >
          <Archive size={18} />
          Archiv
        </button>
      </div>

      {/* Suchfeld */}
      <div className="search-bar">
        <Search size={20} />
        <input
          type="text"
          placeholder="Suche nach Rechnungsnummer, Mitglied oder Beschreibung..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Rechnungstabelle */}
      <div className="rechnungen-table-container">
        {filteredRechnungen.length === 0 ? (
          <div className="empty-state">
            <FileText size={64} />
            <h3>Keine Rechnungen gefunden</h3>
            <p>
              {activeView === 'alle' && 'Es wurden noch keine Rechnungen erstellt.'}
              {activeView === 'offen' && 'Keine offenen Rechnungen vorhanden.'}
              {activeView === 'bezahlt' && 'Keine bezahlten Rechnungen vorhanden.'}
              {activeView === 'ueberfaellig' && 'Keine überfälligen Rechnungen vorhanden.'}
              {activeView === 'archiv' && 'Keine archivierten Rechnungen vorhanden.'}
            </p>
          </div>
        ) : (
          <table className="rechnungen-table">
            <thead>
              <tr>
                <th>Rechnungsnr.</th>
                <th>Mitglied</th>
                <th>Datum</th>
                <th>Fälligkeit</th>
                <th>Art</th>
                <th>Betrag</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredRechnungen.map(rechnung => (
                <tr key={rechnung.rechnung_id}>
                  <td>
                    <strong>{rechnung.rechnungsnummer}</strong>
                  </td>
                  <td>{rechnung.mitglied_name}</td>
                  <td>{formatDate(rechnung.datum)}</td>
                  <td>{formatDate(rechnung.faelligkeitsdatum)}</td>
                  <td>
                    <span className="badge badge-neutral">
                      {rechnung.art === 'mitgliedsbeitrag' && 'Mitgliedsbeitrag'}
                      {rechnung.art === 'pruefungsgebuehr' && 'Prüfungsgebühr'}
                      {rechnung.art === 'kursgebuehr' && 'Kursgebühr'}
                      {rechnung.art === 'ausruestung' && 'Ausrüstung'}
                      {rechnung.art === 'sonstiges' && 'Sonstiges'}
                    </span>
                  </td>
                  <td><strong>{formatCurrency(rechnung.betrag)}</strong></td>
                  <td>{getStatusBadge(rechnung)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon btn-info"
                        onClick={() => navigate(`/dashboard/rechnungen/${rechnung.rechnung_id}`)}
                        title="Details anzeigen"
                      >
                        <Eye size={16} />
                      </button>
                      {rechnung.archiviert === 0 ? (
                        <button
                          className="btn-icon btn-secondary"
                          onClick={() => handleArchivieren(rechnung.rechnung_id, true)}
                          title="Archivieren"
                        >
                          <Archive size={16} />
                        </button>
                      ) : (
                        <button
                          className="btn-icon btn-success"
                          onClick={() => handleArchivieren(rechnung.rechnung_id, false)}
                          title="Wiederherstellen"
                        >
                          <Archive size={16} />
                        </button>
                      )}
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => handleDelete(rechnung.rechnung_id)}
                        title="Löschen"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h2>Neue Rechnung erstellen</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Mitglied */}
                <div className="form-group">
                  <label>Mitglied *</label>
                  <select
                    value={formData.mitglied_id}
                    onChange={(e) => setFormData({...formData, mitglied_id: e.target.value})}
                    required
                  >
                    <option value="">Bitte wählen...</option>
                    {mitglieder.map(m => (
                      <option key={m.mitglied_id} value={m.mitglied_id}>
                        {m.vorname} {m.nachname}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Art */}
                <div className="form-group">
                  <label>Art *</label>
                  <select
                    value={formData.art}
                    onChange={(e) => setFormData({...formData, art: e.target.value})}
                  >
                    <option value="Verkauf">Verkauf</option>
                    <option value="Mitgliedsbeitrag">Mitgliedsbeitrag</option>
                    <option value="Prüfungsgebühr">Prüfungsgebühr</option>
                    <option value="Lehrgang">Lehrgang</option>
                    <option value="Sonstiges">Sonstiges</option>
                  </select>
                </div>

                {/* Datum */}
                <div className="form-group">
                  <label>Rechnungsdatum *</label>
                  <input
                    type="date"
                    value={formData.datum}
                    onChange={(e) => setFormData({...formData, datum: e.target.value})}
                    required
                  />
                </div>

                {/* Fälligkeitsdatum */}
                <div className="form-group">
                  <label>Fälligkeitsdatum *</label>
                  <input
                    type="date"
                    value={formData.faelligkeitsdatum}
                    onChange={(e) => setFormData({...formData, faelligkeitsdatum: e.target.value})}
                    required
                  />
                </div>

                {/* MwSt Satz */}
                <div className="form-group">
                  <label>MwSt-Satz (%)</label>
                  <input
                    type="number"
                    value={formData.mwst_satz}
                    onChange={(e) => setFormData({...formData, mwst_satz: parseFloat(e.target.value)})}
                    min="0"
                    max="100"
                    step="0.01"
                  />
                </div>

                {/* Beschreibung */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Beschreibung</label>
                  <textarea
                    value={formData.beschreibung}
                    onChange={(e) => setFormData({...formData, beschreibung: e.target.value})}
                    rows="2"
                  ></textarea>
                </div>

                {/* Notizen */}
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label>Interne Notizen</label>
                  <textarea
                    value={formData.notizen}
                    onChange={(e) => setFormData({...formData, notizen: e.target.value})}
                    rows="2"
                  ></textarea>
                </div>
              </div>

              <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid #ddd' }} />

              {/* Positionen hinzufügen */}
              <h3 style={{ marginBottom: '1rem' }}>Positionen</h3>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <select
                  value={selectedArtikel}
                  onChange={(e) => setSelectedArtikel(e.target.value)}
                  style={{ flex: 1 }}
                >
                  <option value="">Artikel wählen...</option>
                  {artikel.map(a => (
                    <option key={a.artikel_id} value={a.artikel_id}>
                      {a.name} - {(a.verkaufspreis_cent / 100).toFixed(2)} €
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={menge}
                  onChange={(e) => setMenge(parseInt(e.target.value))}
                  min="1"
                  placeholder="Menge"
                  style={{ width: '100px' }}
                />
                <button
                  className="btn btn-primary"
                  onClick={addPosition}
                  type="button"
                >
                  Hinzufügen
                </button>
              </div>

              {/* Positionsliste */}
              {positionen.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ddd' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Bezeichnung</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Menge</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Einzelpreis</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Gesamtpreis</th>
                        <th style={{ padding: '0.5rem' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {positionen.map((pos, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '0.5rem' }}>{pos.bezeichnung}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{pos.menge}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{pos.einzelpreis.toFixed(2)} €</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{pos.gesamtpreis.toFixed(2)} €</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <button
                              onClick={() => removePosition(index)}
                              style={{ background: '#dc3545', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summen */}
              {positionen.length > 0 && (
                <div style={{ textAlign: 'right', marginTop: '1rem' }}>
                  <div><strong>Netto:</strong> {calculateTotals().netto.toFixed(2)} €</div>
                  <div><strong>MwSt ({formData.mwst_satz}%):</strong> {calculateTotals().mwst.toFixed(2)} €</div>
                  <div style={{ fontSize: '1.2rem', marginTop: '0.5rem' }}>
                    <strong>Brutto:</strong> {calculateTotals().brutto.toFixed(2)} €
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                Abbrechen
              </button>
              <button className="btn btn-primary" onClick={handleSubmit}>
                Rechnung erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rechnungsverwaltung;
