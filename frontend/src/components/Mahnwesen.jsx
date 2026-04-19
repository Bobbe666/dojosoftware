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
  RefreshCw,
  X
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
      <div className="mw-page">
        <div className="mw-card mw-loading">
          <div className="mw-spinner" />
          <p>Lade Mahnwesen-Daten...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mw-page">

      {/* ── Header Card ─────────────────────────────────────────── */}
      <div className="mw-card mw-header">
        <div className="mw-header__left">
          <span className="mw-eyebrow">MAHNWESEN</span>
          <div className="mw-header__title-row">
            <h1 className="mw-title">Mahnwesen</h1>
            <span className="mw-badge mw-badge--accent">
              {offeneBeitraege.length} offen
            </span>
          </div>
        </div>
        <div className="mw-header__actions">
          <button
            className="btn btn-ghost mw-btn-sm"
            onClick={() => navigate('/dashboard/einstellungen/mahnstufen')}
            title="Mahnstufen konfigurieren"
          >
            <Settings size={15} />
            Einstellungen
          </button>
          <button
            className="btn btn-warning mw-btn-sm"
            onClick={() => handleMahnlauf(true)}
            disabled={mahnlaufLoading}
            title="Simuliert den Mahnlauf ohne echte Mahnungen zu erstellen"
          >
            <Play size={15} />
            {mahnlaufLoading ? 'Läuft...' : 'Simulieren'}
          </button>
          <button
            className="btn btn-danger mw-btn-sm"
            onClick={() => handleMahnlauf(false)}
            disabled={mahnlaufLoading}
            title="Erstellt echte Mahnungen basierend auf den Mahnstufen-Einstellungen"
          >
            <RefreshCw size={15} />
            Mahnlauf starten
          </button>
        </div>
      </div>

      {/* ── Mahnlauf Ergebnis ────────────────────────────────────── */}
      {mahnlaufErgebnis && (
        <div className={`mw-card mw-result${mahnlaufErgebnis.simulation ? ' mw-result--sim' : ' mw-result--real'}`}>
          <div className="mw-result__header">
            <span className="mw-result__label">
              {mahnlaufErgebnis.simulation ? 'Simulation' : 'Mahnlauf durchgeführt'}
            </span>
            <button
              className="mw-close-btn"
              onClick={() => setMahnlaufErgebnis(null)}
              aria-label="Schließen"
            >
              <X size={14} />
            </button>
          </div>
          <div className="mw-result__grid">
            <div className="mw-result__stat">
              <span className="mw-result__stat-label">Geprüft</span>
              <span className="mw-result__stat-value">{mahnlaufErgebnis.zusammenfassung?.geprueft || 0}</span>
            </div>
            <div className="mw-result__stat mw-result__stat--success">
              <span className="mw-result__stat-label">Neue Mahnungen</span>
              <span className="mw-result__stat-value">{mahnlaufErgebnis.zusammenfassung?.neueMahnungen || 0}</span>
            </div>
            <div className="mw-result__stat">
              <span className="mw-result__stat-label">Übersprungen</span>
              <span className="mw-result__stat-value">{mahnlaufErgebnis.zusammenfassung?.uebersprungen || 0}</span>
            </div>
            <div className="mw-result__stat mw-result__stat--error">
              <span className="mw-result__stat-label">Fehler</span>
              <span className="mw-result__stat-value">{mahnlaufErgebnis.zusammenfassung?.fehler || 0}</span>
            </div>
          </div>
          {mahnlaufErgebnis.ergebnisse?.neueMahnungen?.length > 0 && (
            <div className="mw-result__details">
              <span className="mw-result__details-label">Neue Mahnungen:</span>
              <ul className="mw-result__list">
                {mahnlaufErgebnis.ergebnisse.neueMahnungen.slice(0, 5).map((m, i) => (
                  <li key={i}>{m.mitglied} — {m.mahnstufe}. Mahnung (€{parseFloat(m.betrag).toFixed(2)})</li>
                ))}
                {mahnlaufErgebnis.ergebnisse.neueMahnungen.length > 5 && (
                  <li className="mw-result__list-more">
                    ... und {mahnlaufErgebnis.ergebnisse.neueMahnungen.length - 5} weitere
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ── KPI Grid ─────────────────────────────────────────────── */}
      <div className="mw-kpi-grid">

        <div className="mw-card mw-kpi-card">
          <div className="mw-kpi__icon mw-kpi__icon--warning">
            <AlertCircle size={18} />
          </div>
          <span className="mw-kpi__label">Offene Beiträge</span>
          <span className="mw-kpi__value">{statistiken.offene_beitraege || 0}</span>
          <span className="mw-kpi__detail">Nicht bezahlt</span>
        </div>

        <div className="mw-card mw-kpi-card">
          <div className="mw-kpi__icon mw-kpi__icon--danger">
            <DollarSign size={18} />
          </div>
          <span className="mw-kpi__label">Offene Summe</span>
          <span className="mw-kpi__value mw-kpi__value--danger">
            €{parseFloat(statistiken.offene_summe || 0).toFixed(2)}
          </span>
          <span className="mw-kpi__detail">Gesamt ausstehend</span>
        </div>

        <div className="mw-card mw-kpi-card">
          <div className="mw-kpi__icon mw-kpi__icon--warning">
            <Clock size={18} />
          </div>
          <span className="mw-kpi__label">Überfällig 30+ Tage</span>
          <span className="mw-kpi__value mw-kpi__value--warning">
            {statistiken.ueberfaellig_30_tage || 0}
          </span>
          <span className="mw-kpi__detail">Kritisch</span>
        </div>

        <div className="mw-card mw-kpi-card">
          <div className="mw-kpi__icon mw-kpi__icon--neutral">
            <FileText size={18} />
          </div>
          <span className="mw-kpi__label">Mahnungen gesamt</span>
          <span className="mw-kpi__value">{statistiken.anzahl_mahnungen || 0}</span>
          <span className="mw-kpi__detail">
            Stufe 1: {statistiken.mahnstufe_1 || 0} &nbsp;·&nbsp;
            2: {statistiken.mahnstufe_2 || 0} &nbsp;·&nbsp;
            3: {statistiken.mahnstufe_3 || 0}
          </span>
        </div>

      </div>

      {/* ── Tabs + Content Card ───────────────────────────────────── */}
      <div className="mw-card mw-content-card">

        {/* Tab bar */}
        <div className="mw-tabs">
          <button
            className={`mw-tab${selectedView === 'offene' ? ' mw-tab--active' : ''}`}
            onClick={() => setSelectedView('offene')}
          >
            <AlertCircle size={14} />
            Offene Beiträge
            <span className="mw-tab__count">{offeneBeitraege.length}</span>
          </button>
          <button
            className={`mw-tab${selectedView === 'mahnungen' ? ' mw-tab--active' : ''}`}
            onClick={() => setSelectedView('mahnungen')}
          >
            <FileText size={14} />
            Mahnungen
            <span className="mw-tab__count">{mahnungen.length}</span>
          </button>
        </div>

        {/* ── Offene Beiträge ─────────────────────────────────────── */}
        {selectedView === 'offene' && (
          <div className="mw-list">
            {offeneBeitraege.length === 0 ? (
              <div className="mw-empty">
                <CheckCircle size={40} />
                <p>Keine offenen Beiträge vorhanden</p>
              </div>
            ) : (

              <div className="mw-rows">
                {/* Column headers */}
                <div className="mw-row mw-row--head">
                  <span className="mw-col mw-col--name">Mitglied</span>
                  <span className="mw-col mw-col--amount">Betrag</span>
                  <span className="mw-col mw-col--date">Fällig seit</span>
                  <span className="mw-col mw-col--days">Überfällig</span>
                  <span className="mw-col mw-col--stufe">Mahnstufe</span>
                  <span className="mw-col mw-col--actions">Aktionen</span>
                </div>

                {offeneBeitraege.map((beitrag) => (
                  <div key={beitrag.beitrag_id} className="mw-row">

                    {/* Name + Zahlungsmethode */}
                    <div className="mw-col mw-col--name">
                      <span className="mw-member-name">{beitrag.mitglied_name}</span>
                      <div className="mw-member-meta">
                        {beitrag.zahlungsmethode && (
                          <span className="mw-meta-tag">{beitrag.zahlungsmethode}</span>
                        )}
                        {beitrag.rl_anzahl > 0 && (
                          <span className="mw-badge mw-badge--warning mw-badge--xs">
                            RL {beitrag.rl_anzahl}x
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Betrag */}
                    <div className="mw-col mw-col--amount">
                      <span className="mw-amount">
                        €{parseFloat(beitrag.betrag).toFixed(2)}
                      </span>
                    </div>

                    {/* Fällig seit */}
                    <div className="mw-col mw-col--date">
                      <span className="mw-date">
                        {new Date(beitrag.zahlungsdatum).toLocaleDateString('de-DE')}
                      </span>
                    </div>

                    {/* Tage überfällig */}
                    <div className="mw-col mw-col--days">
                      <span className={`mw-badge ${beitrag.tage_ueberfaellig > 30 ? 'mw-badge--danger' : 'mw-badge--warning'}`}>
                        {beitrag.tage_ueberfaellig}d
                      </span>
                    </div>

                    {/* Mahnstufe */}
                    <div className="mw-col mw-col--stufe">
                      <span className={`mw-badge mw-badge--${getMahnstufeColor(beitrag.mahnstufe)}`}>
                        {getMahnstufeText(beitrag.mahnstufe)}
                      </span>
                    </div>

                    {/* Aktionen */}
                    <div className="mw-col mw-col--actions">
                      <button
                        className="mw-action-btn mw-action-btn--warning"
                        onClick={() => handleMahnungErstellen(beitrag.beitrag_id, beitrag.mahnstufe + 1)}
                        disabled={beitrag.mahnstufe >= 3}
                        title="Mahnung erstellen"
                      >
                        <Send size={13} />
                        Mahnung
                      </button>
                      <button
                        className="mw-action-btn mw-action-btn--success"
                        onClick={() => handleAlsBezahltMarkieren(beitrag.beitrag_id)}
                        title="Als bezahlt markieren"
                      >
                        <CheckCircle size={13} />
                        Bezahlt
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Mahnungen ───────────────────────────────────────────── */}
        {selectedView === 'mahnungen' && (
          <div className="mw-list">
            {mahnungen.length === 0 ? (
              <div className="mw-empty">
                <FileText size={40} />
                <p>Keine Mahnungen vorhanden</p>
              </div>
            ) : (

              <div className="mw-rows">
                {/* Column headers */}
                <div className="mw-row mw-row--head">
                  <span className="mw-col mw-col--name">Mitglied</span>
                  <span className="mw-col mw-col--amount">Betrag</span>
                  <span className="mw-col mw-col--stufe">Mahnstufe</span>
                  <span className="mw-col mw-col--date">Mahndatum</span>
                  <span className="mw-col mw-col--fee">Gebühr</span>
                  <span className="mw-col mw-col--status">Status</span>
                  <span className="mw-col mw-col--actions">Aktionen</span>
                </div>

                {mahnungen.map((mahnung) => (
                  <div key={mahnung.mahnung_id} className="mw-row">

                    {/* Name + Email */}
                    <div className="mw-col mw-col--name">
                      <span className="mw-member-name">{mahnung.mitglied_name}</span>
                      {mahnung.email && (
                        <span className="mw-member-email">{mahnung.email}</span>
                      )}
                    </div>

                    {/* Betrag */}
                    <div className="mw-col mw-col--amount">
                      <span className="mw-amount">
                        €{parseFloat(mahnung.beitrag_betrag).toFixed(2)}
                      </span>
                    </div>

                    {/* Mahnstufe */}
                    <div className="mw-col mw-col--stufe">
                      <span className={`mw-badge mw-badge--${getMahnstufeColor(mahnung.mahnstufe)}`}>
                        {getMahnstufeText(mahnung.mahnstufe)}
                      </span>
                    </div>

                    {/* Mahndatum */}
                    <div className="mw-col mw-col--date">
                      <span className="mw-date">
                        {new Date(mahnung.mahndatum).toLocaleDateString('de-DE')}
                      </span>
                    </div>

                    {/* Mahngebühr */}
                    <div className="mw-col mw-col--fee">
                      <span className="mw-fee">
                        €{parseFloat(mahnung.mahngebuehr).toFixed(2)}
                      </span>
                    </div>

                    {/* Versandt Status */}
                    <div className="mw-col mw-col--status">
                      {mahnung.versandt ? (
                        <span className="mw-badge mw-badge--success">Versendet</span>
                      ) : (
                        <span className="mw-badge mw-badge--warning">Ausstehend</span>
                      )}
                    </div>

                    {/* Aktionen */}
                    <div className="mw-col mw-col--actions">
                      <button
                        className="mw-action-btn mw-action-btn--ghost"
                        onClick={() => handlePdfDownload(mahnung.mahnung_id, mahnung.mitglied_name)}
                        title="PDF herunterladen"
                      >
                        <Download size={13} />
                      </button>
                      {!mahnung.versandt && (
                        <button
                          className="mw-action-btn mw-action-btn--primary"
                          onClick={() => handleMahnungSenden(mahnung.mahnung_id, mahnung.email)}
                          title={mahnung.email ? `E-Mail an ${mahnung.email}` : 'Keine E-Mail hinterlegt'}
                          disabled={!mahnung.email}
                        >
                          <Send size={13} />
                        </button>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default Mahnwesen;
