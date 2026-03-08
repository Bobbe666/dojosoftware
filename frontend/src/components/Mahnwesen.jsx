import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  DollarSign,
  Users,
  FileText,
  Send,
  CheckCircle,
  Clock,
  TrendingUp,
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Download,
  Play,
  Settings,
  RefreshCw
} from "lucide-react";
import config from "../config/config";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Mahnwesen.css";
import { fetchWithAuth } from '../utils/fetchWithAuth';


const Mahnwesen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [offeneBeitraege, setOffeneBeitraege] = useState([]);
  const [mahnungen, setMahnungen] = useState([]);
  const [statistiken, setStatistiken] = useState({});
  const [selectedView, setSelectedView] = useState('offene'); // 'offene' oder 'mahnungen'
  const [mahnlaufLoading, setMahnlaufLoading] = useState(false);
  const [mahnlaufErgebnis, setMahnlaufErgebnis] = useState(null);

  useEffect(() => {
    loadMahnwesenData();
  }, []);

  const loadMahnwesenData = async () => {
    try {
      setLoading(true);

      const [offeneRes, mahnungenRes, statsRes] = await Promise.all([
        fetchWithAuth(`${config.apiBaseUrl}/mahnwesen/offene-beitraege`),
        fetchWithAuth(`${config.apiBaseUrl}/mahnwesen/mahnungen`),
        fetchWithAuth(`${config.apiBaseUrl}/mahnwesen/statistiken`)
      ]);

      if (!offeneRes.ok || !mahnungenRes.ok || !statsRes.ok) {
        throw new Error('Fehler beim Laden der Mahnwesen-Daten');
      }

      const offeneData = await offeneRes.json();
      const mahnungenData = await mahnungenRes.json();
      const statsData = await statsRes.json();

      setOffeneBeitraege(offeneData.data || []);
      setMahnungen(mahnungenData.data || []);
      setStatistiken(statsData.data || {});

      setLoading(false);
    } catch (error) {
      console.error('Fehler beim Laden der Mahnwesen-Daten:', error);
      setLoading(false);
    }
  };

  const handleMahnungErstellen = async (beitrag_id, mahnstufe) => {
    if (!window.confirm(`Mahnung der Stufe ${mahnstufe} erstellen?`)) {
      return;
    }

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/mahnwesen/mahnungen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          beitrag_id,
          mahnstufe,
          mahngebuehr: mahnstufe === 1 ? 5 : mahnstufe === 2 ? 10 : 15,
          versand_art: 'email'
        })
      });

      if (!response.ok) {
        throw new Error('Fehler beim Erstellen der Mahnung');
      }

      alert('Mahnung erfolgreich erstellt');
      loadMahnwesenData();
    } catch (error) {
      console.error('Fehler beim Erstellen der Mahnung:', error);
      alert('Fehler beim Erstellen der Mahnung');
    }
  };

  const handleAlsBezahltMarkieren = async (beitrag_id) => {
    if (!window.confirm('Beitrag als bezahlt markieren?')) {
      return;
    }

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/mahnwesen/beitraege/${beitrag_id}/bezahlt`, {
        method: 'PUT'
      });

      if (!response.ok) {
        throw new Error('Fehler beim Markieren als bezahlt');
      }

      alert('Beitrag als bezahlt markiert');
      loadMahnwesenData();
    } catch (error) {
      console.error('Fehler beim Markieren als bezahlt:', error);
      alert('Fehler beim Markieren als bezahlt');
    }
  };

  // PDF herunterladen
  const handlePdfDownload = async (mahnung_id, mitgliedName) => {
    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/mahnwesen/mahnungen/${mahnung_id}/pdf`);

      if (!response.ok) {
        throw new Error('PDF konnte nicht generiert werden');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Mahnung_${mitgliedName.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Fehler beim PDF-Download:', error);
      alert('Fehler beim PDF-Download: ' + error.message);
    }
  };

  // Mahnung per E-Mail versenden
  const handleMahnungSenden = async (mahnung_id, email) => {
    if (!email) {
      alert('Mitglied hat keine E-Mail-Adresse hinterlegt');
      return;
    }

    if (!window.confirm(`Mahnung per E-Mail an ${email} senden?`)) {
      return;
    }

    try {
      const response = await fetchWithAuth(`${config.apiBaseUrl}/mahnwesen/mahnungen/${mahnung_id}/senden`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mitPdf: true })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'E-Mail konnte nicht gesendet werden');
      }

      alert('Mahnung erfolgreich versendet!');
      loadMahnwesenData();
    } catch (error) {
      console.error('Fehler beim Versenden:', error);
      alert('Fehler beim Versenden: ' + error.message);
    }
  };

  // Automatischer Mahnlauf
  const handleMahnlauf = async (nurSimulation = true) => {
    const confirmMsg = nurSimulation
      ? 'Mahnlauf simulieren? Es werden keine echten Mahnungen erstellt.'
      : 'Automatischen Mahnlauf durchfuehren? Es werden echte Mahnungen erstellt!';

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setMahnlaufLoading(true);
      setMahnlaufErgebnis(null);

      const response = await fetchWithAuth(`${config.apiBaseUrl}/mahnwesen/mahnlauf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nurSimulation })
      });

      if (!response.ok) {
        throw new Error('Mahnlauf fehlgeschlagen');
      }

      const data = await response.json();
      setMahnlaufErgebnis(data);

      if (!nurSimulation) {
        loadMahnwesenData();
      }
    } catch (error) {
      console.error('Fehler beim Mahnlauf:', error);
      alert('Fehler beim Mahnlauf: ' + error.message);
    } finally {
      setMahnlaufLoading(false);
    }
  };

  const getMahnstufeColor = (mahnstufe) => {
    if (mahnstufe === 0) return 'info';
    if (mahnstufe === 1) return 'warning';
    if (mahnstufe === 2) return 'danger';
    return 'danger';
  };

  const getMahnstufeText = (mahnstufe) => {
    if (mahnstufe === 0) return 'Keine Mahnung';
    if (mahnstufe === 1) return '1. Mahnung';
    if (mahnstufe === 2) return '2. Mahnung';
    return '3. Mahnung';
  };

  if (loading) {
    return (
      <div className="mahnwesen-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Lade Mahnwesen-Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mahnwesen-container">
      {/* Header */}
      <div className="mahnwesen-header">
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard/beitraege')}>
          <ArrowLeft size={20} />
          Zurück
        </button>
        <div>
          <h1>⚠️ Mahnwesen</h1>
          <p>Verwalte offene Beiträge und Mahnungen</p>
        </div>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/dashboard/einstellungen/mahnstufen')}
            title="Mahnstufen konfigurieren"
          >
            <Settings size={18} />
            Einstellungen
          </button>
          <button
            className="btn btn-warning"
            onClick={() => handleMahnlauf(true)}
            disabled={mahnlaufLoading}
            title="Simuliert den Mahnlauf ohne echte Mahnungen zu erstellen"
          >
            <Play size={18} />
            {mahnlaufLoading ? 'Läuft...' : 'Mahnlauf simulieren'}
          </button>
          <button
            className="btn btn-danger"
            onClick={() => handleMahnlauf(false)}
            disabled={mahnlaufLoading}
            title="Erstellt echte Mahnungen basierend auf den Mahnstufen-Einstellungen"
          >
            <RefreshCw size={18} />
            Mahnlauf starten
          </button>
        </div>
      </div>

      {/* Mahnlauf Ergebnis */}
      {mahnlaufErgebnis && (
        <div className={`mahnlauf-ergebnis${mahnlaufErgebnis.simulation ? ' mahnlauf-ergebnis--simulation' : ' mahnlauf-ergebnis--real'}`}>
          <div className="mahnlauf-ergebnis-header">
            <h3 className="mahnlauf-ergebnis-title">
              {mahnlaufErgebnis.simulation ? '🔍 Simulation' : '✅ Mahnlauf durchgeführt'}
            </h3>
            <button
              className="btn btn-sm btn-secondary mahnlauf-close-btn"
              onClick={() => setMahnlaufErgebnis(null)}
            >
              ×
            </button>
          </div>
          <div className="mahnlauf-grid">
            <div>
              <strong>Geprüft:</strong> {mahnlaufErgebnis.zusammenfassung?.geprueft || 0}
            </div>
            <div className="u-text-success">
              <strong>Neue Mahnungen:</strong> {mahnlaufErgebnis.zusammenfassung?.neueMahnungen || 0}
            </div>
            <div className="u-text-muted">
              <strong>Übersprungen:</strong> {mahnlaufErgebnis.zusammenfassung?.uebersprungen || 0}
            </div>
            <div className="u-text-error">
              <strong>Fehler:</strong> {mahnlaufErgebnis.zusammenfassung?.fehler || 0}
            </div>
          </div>
          {mahnlaufErgebnis.ergebnisse?.neueMahnungen?.length > 0 && (
            <div className="mahnlauf-ergebnis-details">
              <strong>Neue Mahnungen:</strong>
              <ul className="mahnlauf-ergebnis-list">
                {mahnlaufErgebnis.ergebnisse.neueMahnungen.slice(0, 5).map((m, i) => (
                  <li key={i}>{m.mitglied} - {m.mahnstufe}. Mahnung (€{parseFloat(m.betrag).toFixed(2)})</li>
                ))}
                {mahnlaufErgebnis.ergebnisse.neueMahnungen.length > 5 && (
                  <li>... und {mahnlaufErgebnis.ergebnisse.neueMahnungen.length - 5} weitere</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Statistiken */}
      <div className="stats-grid">
        <div className="stat-card warning">
          <div className="stat-icon">
            <AlertCircle size={24} />
          </div>
          <div className="stat-info">
            <h3>Offene Beiträge</h3>
            <p className="stat-value">{statistiken.offene_beitraege || 0}</p>
            <span className="stat-trend">Nicht bezahlt</span>
          </div>
        </div>

        <div className="stat-card danger">
          <div className="stat-icon">
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <h3>Offene Summe</h3>
            <p className="stat-value">€{parseFloat(statistiken.offene_summe || 0).toFixed(2)}</p>
            <span className="stat-trend">Gesamt</span>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">
            <Clock size={24} />
          </div>
          <div className="stat-info">
            <h3>Überfällig 30+ Tage</h3>
            <p className="stat-value">{statistiken.ueberfaellig_30_tage || 0}</p>
            <span className="stat-trend">Kritisch</span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <FileText size={24} />
          </div>
          <div className="stat-info">
            <h3>Mahnungen gesamt</h3>
            <p className="stat-value">{statistiken.anzahl_mahnungen || 0}</p>
            <span className="stat-trend">
              {statistiken.mahnstufe_1 || 0} / {statistiken.mahnstufe_2 || 0} / {statistiken.mahnstufe_3 || 0}
            </span>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="view-toggle">
        <button
          className={`btn-toggle ${selectedView === 'offene' ? 'active' : ''}`}
          onClick={() => setSelectedView('offene')}
        >
          <AlertCircle size={18} />
          Offene Beiträge ({offeneBeitraege.length})
        </button>
        <button
          className={`btn-toggle ${selectedView === 'mahnungen' ? 'active' : ''}`}
          onClick={() => setSelectedView('mahnungen')}
        >
          <FileText size={18} />
          Mahnungen ({mahnungen.length})
        </button>
      </div>

      {/* Offene Beiträge Ansicht */}
      {selectedView === 'offene' && (
        <div className="section">
          <div className="section-header">
            <h2>Offene Beiträge</h2>
          </div>

          {offeneBeitraege.length === 0 ? (
            <div className="empty-state">
              <CheckCircle size={48} />
              <p>Keine offenen Beiträge vorhanden</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mitglied</th>
                    <th>Betrag</th>
                    <th>Fällig seit</th>
                    <th>Überfällig</th>
                    <th>Mahnstufe</th>
                    <th>Kontakt</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {offeneBeitraege.map((beitrag) => (
                    <tr key={beitrag.beitrag_id}>
                      <td>{beitrag.mitglied_name}</td>
                      <td className="amount">€{parseFloat(beitrag.betrag).toFixed(2)}</td>
                      <td>{new Date(beitrag.zahlungsdatum).toLocaleDateString('de-DE')}</td>
                      <td className={beitrag.tage_ueberfaellig > 30 ? 'critical' : 'warning'}>
                        {beitrag.tage_ueberfaellig} Tage
                      </td>
                      <td>
                        <span className={`badge badge-${getMahnstufeColor(beitrag.mahnstufe)}`}>
                          {getMahnstufeText(beitrag.mahnstufe)}
                        </span>
                      </td>
                      <td className="contact-info">
                        {beitrag.email && (
                          <div><Mail size={14} /> {beitrag.email}</div>
                        )}
                        {beitrag.telefon && (
                          <div><Phone size={14} /> {beitrag.telefon}</div>
                        )}
                      </td>
                      <td className="actions">
                        <button
                          className="btn btn-sm btn-warning"
                          onClick={() => handleMahnungErstellen(beitrag.beitrag_id, beitrag.mahnstufe + 1)}
                          disabled={beitrag.mahnstufe >= 3}
                        >
                          <Send size={14} />
                          Mahnung
                        </button>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleAlsBezahltMarkieren(beitrag.beitrag_id)}
                        >
                          <CheckCircle size={14} />
                          Bezahlt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Mahnungen Ansicht */}
      {selectedView === 'mahnungen' && (
        <div className="section">
          <div className="section-header">
            <h2>Versendete Mahnungen</h2>
          </div>

          {mahnungen.length === 0 ? (
            <div className="empty-state">
              <FileText size={48} />
              <p>Keine Mahnungen vorhanden</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mitglied</th>
                    <th>Beitrag</th>
                    <th>Mahnstufe</th>
                    <th>Mahndatum</th>
                    <th>Mahngebühr</th>
                    <th>Status</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {mahnungen.map((mahnung) => (
                    <tr key={mahnung.mahnung_id}>
                      <td>{mahnung.mitglied_name}</td>
                      <td className="amount">€{parseFloat(mahnung.beitrag_betrag).toFixed(2)}</td>
                      <td>
                        <span className={`badge badge-${getMahnstufeColor(mahnung.mahnstufe)}`}>
                          {getMahnstufeText(mahnung.mahnstufe)}
                        </span>
                      </td>
                      <td>{new Date(mahnung.mahndatum).toLocaleDateString('de-DE')}</td>
                      <td className="amount">€{parseFloat(mahnung.mahngebuehr).toFixed(2)}</td>
                      <td>
                        {mahnung.versandt ? (
                          <span className="badge badge-success">Versendet</span>
                        ) : (
                          <span className="badge badge-warning">Ausstehend</span>
                        )}
                      </td>
                      <td className="actions">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => handlePdfDownload(mahnung.mahnung_id, mahnung.mitglied_name)}
                          title="PDF herunterladen"
                        >
                          <Download size={14} />
                        </button>
                        {!mahnung.versandt && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => handleMahnungSenden(mahnung.mahnung_id, mahnung.email)}
                            title={mahnung.email ? `E-Mail an ${mahnung.email}` : 'Keine E-Mail hinterlegt'}
                            disabled={!mahnung.email}
                          >
                            <Send size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Mahnwesen;
