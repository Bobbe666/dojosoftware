// ============================================================================
// ZIELE & ENTWICKLUNG - Entwicklungsplanung und Finanzprognose
// ============================================================================
// Verschiedene Bereiche:
// - org: Alle Bereiche (Verbandsmitglieder, Dojo-Mitglieder, Software-Nutzer, Dojos, Umsatz)
// - verband: Nur Verbandsmitgliedschaften
// - dojo: Nur Dojo-Mitglieder

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  Target, TrendingUp, TrendingDown, Users, Building2, Euro, Calculator,
  Save, Edit2, Plus, Minus, ChevronDown, ChevronUp,
  BarChart3, ArrowRight, ArrowUp, ArrowDown, CheckCircle, AlertTriangle, Loader2,
  ExternalLink, Globe, Home, Monitor, Percent
} from 'lucide-react';
import '../styles/ZieleEntwicklung.css';

const ZieleEntwicklung = ({
  bereich = 'org',  // 'org' | 'verband' | 'dojo'
  kontextId = null,
  showFinanzrechner = true,
  showNavigation = true
}) => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Ziele-Daten
  const [ziele, setZiele] = useState({});
  const [statistiken, setStatistiken] = useState({});
  const [beitraege, setBeitraege] = useState([]);
  const [vergleiche, setVergleiche] = useState(null);

  // UI State
  const [editMode, setEditMode] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    vergleich: true,
    ziele: true,
    umsatzplanung: true,
    rechner: false
  });

  // Finanzrechner State - jetzt mit 5-Jahres Planung
  const [rechnerDaten, setRechnerDaten] = useState({
    mitgliederPlanung: {}, // { 2026: 100, 2027: 120, ... }
    beitragsverteilung: []
  });

  // Umsatzziel-Planung: verwendet direkt ziele['umsatz'] (in DB gespeichert)

  // Jahre für die Planung (aktuelles Jahr + 4)
  const currentYear = new Date().getFullYear();
  const planungsJahre = [currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4];

  // Bereichs-Konfiguration
  const bereichsConfig = {
    org: {
      titel: 'Organisation Gesamtübersicht',
      subtitel: 'Alle Bereiche: Verband, Dojos & Software',
      kontextTyp: 'global',
      icon: Globe,
      color: 'var(--color-midnight-500)'
    },
    verband: {
      titel: 'Verbandsmitgliedschaften',
      subtitel: 'Entwicklung der Verbandsmitglieder',
      kontextTyp: 'verband',
      icon: Users,
      color: '#8b5cf6'
    },
    dojo: {
      titel: 'Dojo-Mitglieder',
      subtitel: 'Entwicklung der Dojo-Mitgliedschaften',
      kontextTyp: 'dojo',
      icon: Home,
      color: 'var(--success)'
    }
  };

  const config = bereichsConfig[bereich] || bereichsConfig.org;

  // Ziel-Typen basierend auf Bereich
  const getZielTypen = () => {
    switch (bereich) {
      case 'verband':
        return [
          { key: 'verband_mitglieder', label: 'Verbandsmitglieder', icon: Users, color: 'var(--color-midnight-500)', einheit: '' },
          { key: 'umsatz', label: 'Verbandsbeiträge', icon: Euro, color: 'var(--warning)', einheit: 'EUR' }
        ];
      case 'dojo':
        return [
          { key: 'dojo_mitglieder', label: 'Dojo-Mitglieder', icon: Users, color: 'var(--success)', einheit: '' },
          { key: 'umsatz', label: 'Mitgliedsbeiträge', icon: Euro, color: 'var(--warning)', einheit: 'EUR' }
        ];
      case 'org':
      default:
        return [
          { key: 'verband_mitglieder', label: 'Verbandsmitglieder', icon: Users, color: 'var(--color-midnight-500)', einheit: '' },
          { key: 'dojos', label: 'Aktive Dojos', icon: Building2, color: '#8b5cf6', einheit: '' },
          { key: 'dojo_mitglieder', label: 'Mitglieder (aktiv)', icon: Users, color: 'var(--success)', einheit: '' },
          { key: 'software_nutzer', label: 'SaaS-Lizenzen', icon: Monitor, color: '#06b6d4', einheit: '' },
          { key: 'umsatz', label: 'Gesamtumsatz', icon: Euro, color: 'var(--warning)', einheit: 'EUR' }
        ];
    }
  };

  const zielTypen = getZielTypen();

  // Navigation Links zu anderen Bereichen
  const getNavigationLinks = () => {
    const links = [];

    if (bereich !== 'org') {
      links.push({
        key: 'org',
        label: 'Org-Übersicht',
        icon: Globe,
        path: '/dashboard/superadmin'
      });
    }
    if (bereich !== 'verband') {
      links.push({
        key: 'verband',
        label: 'Verband',
        icon: Users,
        path: '/dashboard/verband'
      });
    }
    if (bereich !== 'dojo') {
      links.push({
        key: 'dojo',
        label: 'Dojo',
        icon: Home,
        path: '/dashboard'
      });
    }

    return links;
  };

  // Daten laden
  useEffect(() => {
    loadData();
  }, [bereich, kontextId]);

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [zieleRes, statsRes, beitraegeRes, vergleicheRes] = await Promise.all([
        axios.get('/entwicklungsziele', {
          params: { kontext_typ: config.kontextTyp, kontext_id: kontextId },
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })),
        axios.get('/entwicklungsziele/statistiken', {
          params: { kontext_typ: config.kontextTyp, kontext_id: kontextId },
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: {} })),
        axios.get('/entwicklungsziele/beitraege', {
          params: { kontext_typ: config.kontextTyp, kontext_id: kontextId },
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })),
        axios.get('/entwicklungsziele/vergleiche', {
          params: { kontext_typ: config.kontextTyp, kontext_id: kontextId },
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: null }))
      ]);

      // Ziele in strukturiertes Format umwandeln
      const zieleMap = {};
      zielTypen.forEach(typ => {
        zieleMap[typ.key] = {};
        planungsJahre.forEach(jahr => {
          zieleMap[typ.key][jahr] = 0;
        });
      });

      (zieleRes.data || []).forEach(ziel => {
        if (zieleMap[ziel.typ] && planungsJahre.includes(ziel.jahr)) {
          zieleMap[ziel.typ][ziel.jahr] = parseFloat(ziel.ziel_wert) || 0;
        }
      });

      setZiele(zieleMap);
      setStatistiken(statsRes.data || {});
      setBeitraege(beitraegeRes.data || []);
      setVergleiche(vergleicheRes.data);

      // Rechner initialisieren
      const beitragsverteilung = (beitraegeRes.data || []).map(b => ({
        id: b.id,
        name: b.name,
        monatsbeitrag: parseFloat(b.monatsbeitrag) || 0,
        jahresbeitrag: parseFloat(b.jahresbeitrag) || 0,
        anteil: parseFloat(b.anteil_prozent) || 0,
        beschreibung: b.beschreibung
      }));

      // 5-Jahres Mitgliederplanung initialisieren
      const mitgliederPlanung = {};
      const hauptTyp = bereich === 'verband' ? 'verband_mitglieder' : 'dojo_mitglieder';
      const istWert = statsRes.data?.[hauptTyp] || 0;

      planungsJahre.forEach((jahr) => {
        const gespeichertesZiel = zieleMap[hauptTyp]?.[jahr];
        mitgliederPlanung[jahr] = gespeichertesZiel > 0 ? gespeichertesZiel : 0;
      });

      setRechnerDaten({
        mitgliederPlanung,
        beitragsverteilung
      });

    } catch (err) {
      console.error('Fehler beim Laden:', err);
      setError('Fehler beim Laden der Entwicklungsziele');
    } finally {
      setLoading(false);
    }
  };

  // Ziele speichern
  const saveZiele = async () => {
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const zieleArray = [];

      Object.entries(ziele).forEach(([typ, jahre]) => {
        Object.entries(jahre).forEach(([jahr, wert]) => {
          if (wert > 0) {
            zieleArray.push({
              typ,
              kontext_typ: config.kontextTyp,
              kontext_id: kontextId,
              jahr: parseInt(jahr),
              ziel_wert: parseFloat(wert)
            });
          }
        });
      });

      await axios.post('/entwicklungsziele/batch', {
        ziele: zieleArray
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Ziele erfolgreich gespeichert');
      setEditMode(false);
      loadData(); // Reload für aktuelle Vergleiche
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      const status = err.response?.status;
      const msg = err.response?.data?.error || err.response?.data?.message || err.message;
      setError(`Fehler beim Speichern (${status || 'Netzwerk'}): ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  // Zielwert ändern
  const updateZiel = (typ, jahr, wert) => {
    setZiele(prev => ({
      ...prev,
      [typ]: {
        ...prev[typ],
        [jahr]: parseFloat(wert) || 0
      }
    }));
  };

  // Mitgliederplanung ändern
  const updateMitgliederPlanung = (jahr, wert) => {
    setRechnerDaten(prev => ({
      ...prev,
      mitgliederPlanung: {
        ...prev.mitgliederPlanung,
        [jahr]: parseInt(wert) || 0
      }
    }));
  };

  // Finanzprognose für ein Jahr berechnen
  const berechneFinanzprognoseJahr = (mitgliederAnzahl) => {
    const { beitragsverteilung } = rechnerDaten;

    let monatlichGesamt = 0;
    const details = beitragsverteilung.map(gruppe => {
      const anzahl = Math.round(mitgliederAnzahl * (gruppe.anteil / 100));
      const monatlich = anzahl * gruppe.monatsbeitrag;
      monatlichGesamt += monatlich;

      return {
        ...gruppe,
        anzahl,
        monatlich,
        jaehrlich: monatlich * 12
      };
    });

    return {
      details,
      monatlich: monatlichGesamt,
      jaehrlich: monatlichGesamt * 12
    };
  };

  // Durchschnittlicher Jahresbeitrag (gewichtet nach Anteil)
  const getDurchschnittsbeitrag = () => {
    const { beitragsverteilung } = rechnerDaten;
    if (!beitragsverteilung || beitragsverteilung.length === 0) return 0;
    return beitragsverteilung.reduce((sum, g) => {
      const jb = g.jahresbeitrag > 0 ? g.jahresbeitrag : g.monatsbeitrag * 12;
      return sum + (jb * (g.anteil / 100));
    }, 0);
  };

  // Toggle Section
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Fortschritt berechnen
  const getProgress = (typ) => {
    const ist = statistiken[typ] || 0;
    const soll = ziele[typ]?.[currentYear] || 0;
    if (soll === 0) return { prozent: 0, differenz: 0, trend: 'neutral' };

    const prozent = Math.round((ist / soll) * 100);
    const differenz = ist - soll;
    const trend = prozent >= 100 ? 'up' : prozent >= 80 ? 'neutral' : 'down';

    return { prozent, differenz, trend };
  };

  // Wert formatieren
  const formatWert = (wert, einheit) => {
    if (einheit === 'EUR') {
      return `${Math.round(wert).toLocaleString('de-DE')} EUR`;
    }
    return wert.toLocaleString('de-DE');
  };

  const navLinks = getNavigationLinks();
  const BereichIcon = config.icon;

  if (loading) {
    return (
      <div className="ziele-entwicklung loading">
        <Loader2 className="spin" size={32} />
        <span>Lade Entwicklungsziele...</span>
      </div>
    );
  }

  return (
    <div className="ziele-entwicklung">
      {/* Header */}
      <div className="ziele-header">
        <div className="ziele-title" style={{ '--config-color': config.color }}>
          <BereichIcon size={24} className="ze-bereich-icon" />
          <div>
            <h2>Ziele & Entwicklung</h2>
            <span className="bereich-subtitel">{config.subtitel}</span>
          </div>
        </div>
        <div className="ziele-header-right">
          {showNavigation && navLinks.length > 0 && (
            <div className="bereich-navigation">
              {navLinks.map(link => {
                const LinkIcon = link.icon;
                return (
                  <button
                    key={link.key}
                    className="nav-link-btn"
                    onClick={() => navigate(link.path)}
                    title={`Zu ${link.label} wechseln`}
                  >
                    <LinkIcon size={16} />
                    <span>{link.label}</span>
                    <ExternalLink size={12} />
                  </button>
                );
              })}
            </div>
          )}
          {isAdmin && (
            <div className="ziele-actions">
              {editMode ? (
                <>
                  <button
                    className="btn-secondary"
                    onClick={() => setEditMode(false)}
                    disabled={saving}
                  >
                    Abbrechen
                  </button>
                  <button
                    className="btn-primary"
                    onClick={saveZiele}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                    Speichern
                  </button>
                </>
              ) : (
                <button className="btn-secondary" onClick={() => setEditMode(true)}>
                  <Edit2 size={16} />
                  Bearbeiten
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="ziele-message error">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}
      {success && (
        <div className="ziele-message success">
          <CheckCircle size={16} />
          {success}
        </div>
      )}

      {/* IST vs SOLL Vergleich Karten */}
      <div className="ziele-section">
        <div
          className="section-header clickable"
          onClick={() => toggleSection('vergleich')}
        >
          <div className="section-title">
            <Percent size={20} />
            <span>IST vs. SOLL Vergleich {currentYear}</span>
          </div>
          {expandedSections.vergleich ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>

        {expandedSections.vergleich && (
          <div className="vergleich-grid">
            {zielTypen.map(typ => {
              const progress = getProgress(typ.key);
              const istWert = statistiken[typ.key] || 0;
              const sollWert = ziele[typ.key]?.[currentYear] || 0;
              const Icon = typ.icon;

              return (
                <div key={typ.key} className={`vergleich-card ${progress.trend}`} style={{ '--typ-color': typ.color }}>
                  <div className="vergleich-header">
                    <Icon size={20} className="ze-typ-icon" />
                    <span>{typ.label}</span>
                  </div>

                  <div className="vergleich-werte">
                    <div className="wert-block ist">
                      <span className="wert-label">IST</span>
                      <span className="wert-zahl">{formatWert(istWert, typ.einheit)}</span>
                    </div>
                    <div className="wert-divider">
                      {progress.trend === 'up' && <ArrowUp size={20} className="trend-up" />}
                      {progress.trend === 'down' && <ArrowDown size={20} className="trend-down" />}
                      {progress.trend === 'neutral' && <ArrowRight size={20} className="trend-neutral" />}
                    </div>
                    <div className="wert-block soll">
                      <span className="wert-label">SOLL</span>
                      <span className="wert-zahl">{formatWert(sollWert, typ.einheit)}</span>
                    </div>
                  </div>

                  <div className="vergleich-progress">
                    <div className="progress-bar-bg">
                      <div
                        className={`progress-bar-fill ${progress.trend}`}
                        style={{ width: `${Math.min(100, progress.prozent)}%` }}
                      />
                    </div>
                    <div className="progress-stats">
                      <span className={`progress-prozent ${progress.trend}`}>
                        {progress.prozent}%
                      </span>
                      <span className={`progress-differenz ${progress.differenz >= 0 ? 'positive' : 'negative'}`}>
                        {progress.differenz >= 0 ? '+' : ''}{formatWert(progress.differenz, typ.einheit)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ziele Section */}
      <div className="ziele-section">
        <div
          className="section-header clickable"
          onClick={() => toggleSection('ziele')}
        >
          <div className="section-title">
            <BarChart3 size={20} />
            <span>5-Jahres-Planung</span>
          </div>
          {expandedSections.ziele ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>

        {expandedSections.ziele && (
          <div className="ziele-table-container">
            <table className="ziele-table">
              <thead>
                <tr>
                  <th className="kennzahl-col">Kennzahl</th>
                  <th className="ist-col">IST {currentYear}</th>
                  {planungsJahre.map(jahr => (
                    <th key={jahr} className={jahr === currentYear ? 'current-year' : ''}>
                      {jahr === currentYear ? `${jahr} (Ziel)` : jahr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zielTypen.map(typ => {
                  const istWert = statistiken[typ.key] || 0;
                  const Icon = typ.icon;

                  return (
                    <tr key={typ.key} style={{ '--typ-color': typ.color }}>
                      <td className="kennzahl-col">
                        <div className="kennzahl-label">
                          <Icon size={16} className="ze-typ-icon" />
                          <span>{typ.label}</span>
                        </div>
                      </td>
                      <td className="ist-col">
                        <span className="ist-wert">{formatWert(istWert, typ.einheit)}</span>
                      </td>
                      {planungsJahre.map(jahr => {
                        const sollWert = ziele[typ.key]?.[jahr] || 0;
                        const isAktuell = jahr === currentYear;
                        const progress = isAktuell ? getProgress(typ.key) : null;

                        return (
                          <td
                            key={jahr}
                            className={`${isAktuell ? 'current-year' : ''} ${editMode ? 'editable' : ''}`}
                          >
                            {editMode ? (
                              <input
                                type="number"
                                min="0"
                                value={ziele[typ.key]?.[jahr] || ''}
                                onChange={(e) => updateZiel(typ.key, jahr, e.target.value)}
                                placeholder="0"
                              />
                            ) : (
                              <div className="ziel-cell">
                                <span className="ziel-wert">{formatWert(sollWert, typ.einheit)}</span>
                                {isAktuell && progress && sollWert > 0 && (
                                  <span className={`mini-badge ${progress.trend}`}>
                                    {progress.prozent}%
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Umsatzziel-Planung Section */}
      {showFinanzrechner && (() => {
        // Ø Jahresbeitrag: erst aus beitragsstrukturen (Rechner), Fallback aus Tarif-Statistik
        const avgBeitrag = getDurchschnittsbeitrag() || (statistiken.avg_jahresbeitrag || 0);
        const hauptTyp = bereich === 'verband' ? 'verband_mitglieder' : 'dojo_mitglieder';
        const istMitglieder = statistiken[hauptTyp] || 0;
        const istUmsatz = statistiken.umsatz || 0;

        return (
          <div className="ziele-section">
            <div
              className="section-header clickable"
              onClick={() => toggleSection('umsatzplanung')}
            >
              <div className="section-title">
                <Euro size={20} />
                <span>Umsatzziel-Planung</span>
              </div>
              {expandedSections.umsatzplanung ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>

            {expandedSections.umsatzplanung && (
              <div className="umsatzplanung-container">
                {/* Durchschnittsbeitrag Info */}
                <div className="umsatz-info-bar">
                  <div className="umsatz-info-item">
                    <span className="umsatz-info-label">Ø Jahresbeitrag</span>
                    <span className="umsatz-info-wert highlight">
                      {avgBeitrag > 0
                        ? avgBeitrag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR'
                        : '—'}
                    </span>
                  </div>
                  <div className="umsatz-info-item">
                    <span className="umsatz-info-label">IST Mitglieder</span>
                    <span className="umsatz-info-wert">{istMitglieder.toLocaleString('de-DE')}</span>
                  </div>
                  <div className="umsatz-info-item">
                    <span className="umsatz-info-label">IST Umsatz</span>
                    <span className="umsatz-info-wert">
                      {istUmsatz > 0
                        ? istUmsatz.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' EUR'
                        : 'nicht erfasst'}
                    </span>
                  </div>
                  <div className="umsatz-info-item">
                    <span className="umsatz-info-label">Beitragsstruktur</span>
                    <span className="umsatz-info-wert ze-umsatz-info-wert--dim">
                      {rechnerDaten.beitragsverteilung.map(g => `${g.name} ${g.anteil}%`).join(' · ')}
                    </span>
                  </div>
                </div>

                {/* Haupt-Tabelle */}
                <div className="umsatz-tabelle-wrap">
                  <table className="umsatz-tabelle">
                    <thead>
                      <tr>
                        <th className="row-label-col">Kennzahl</th>
                        <th className="ist-col-up">IST {currentYear}</th>
                        {planungsJahre.map(jahr => (
                          <th key={jahr} className={jahr === currentYear ? 'current-year' : ''}>
                            {jahr === currentYear ? `${jahr} (Ziel)` : jahr}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Zeile 1: Zielumsatz (editierbar) */}
                      <tr className="row-zielumsatz">
                        <td className="row-label">
                          <div className="kennzahl-label">
                            <Euro size={14} className="u-text-warning" />
                            <span>Zielumsatz</span>
                          </div>
                          <div className="row-hint">{editMode ? 'Zielumsatz eingeben' : 'aus 5-Jahres-Planung'}</div>
                        </td>
                        <td className="ist-col-val">
                          <span className="ist-wert dim">
                            {istUmsatz > 0
                              ? (istUmsatz / 1000).toFixed(0) + 'k EUR'
                              : '—'}
                          </span>
                        </td>
                        {planungsJahre.map(jahr => {
                          const zielUmsatz = ziele['umsatz']?.[jahr] || 0;
                          return (
                            <td key={jahr} className={`editable-cell ${jahr === currentYear ? 'current-year' : ''}`}>
                              {editMode ? (
                                <>
                                  <div className="umsatz-input-wrap">
                                    <input
                                      type="number"
                                      min="0"
                                      step="1000"
                                      value={zielUmsatz || ''}
                                      onChange={(e) => updateZiel('umsatz', jahr, e.target.value)}
                                      placeholder="0"
                                      className="umsatz-input"
                                    />
                                    <span className="input-unit">EUR</span>
                                  </div>
                                  {zielUmsatz > 0 && (
                                    <div className="input-kilo">
                                      = {(zielUmsatz / 1000).toFixed(1)}k
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="ziel-wert">
                                  {zielUmsatz > 0
                                    ? zielUmsatz.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' EUR'
                                    : '—'}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Zeile 2: Benötigte Mitglieder (berechnet) */}
                      <tr className="row-benoetigt">
                        <td className="row-label">
                          <div className="kennzahl-label">
                            <Users size={14} className="ze-icon-info" />
                            <span>Benötigte Mitglieder</span>
                          </div>
                          <div className="row-hint">bei Ø {avgBeitrag > 0 ? avgBeitrag.toFixed(0) + ' EUR/Jahr' : '—'}</div>
                        </td>
                        <td className="ist-col-val">
                          <span className="ist-wert">{istMitglieder.toLocaleString('de-DE')}</span>
                        </td>
                        {planungsJahre.map(jahr => {
                          const wunsch = ziele['umsatz']?.[jahr] || 0;
                          const benoetigt = avgBeitrag > 0 && wunsch > 0
                            ? Math.ceil(wunsch / avgBeitrag)
                            : null;
                          return (
                            <td key={jahr} className={`berechnet-cell ${jahr === currentYear ? 'current-year' : ''}`}>
                              {benoetigt !== null ? (
                                <span className="berechnet-wert">
                                  {benoetigt.toLocaleString('de-DE')}
                                </span>
                              ) : (
                                <span className="berechnet-leer">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Zeile 3: IST Mitglieder (flach, zum Vergleich) */}
                      <tr className="row-ist">
                        <td className="row-label">
                          <div className="kennzahl-label">
                            <Users size={14} className="u-text-success" />
                            <span>IST Mitglieder</span>
                          </div>
                          <div className="row-hint">aktueller Stand</div>
                        </td>
                        <td className="ist-col-val">
                          <span className="ist-wert highlight-green">{istMitglieder.toLocaleString('de-DE')}</span>
                        </td>
                        {planungsJahre.map(jahr => (
                          <td key={jahr} className={`ist-ref-cell ${jahr === currentYear ? 'current-year' : ''}`}>
                            <span className="ist-ref">{istMitglieder.toLocaleString('de-DE')}</span>
                          </td>
                        ))}
                      </tr>

                      {/* Zeile 4: Differenz */}
                      <tr className="row-differenz">
                        <td className="row-label">
                          <div className="kennzahl-label">
                            <TrendingUp size={14} className="ze-icon-purple" />
                            <span>Differenz Mitglieder</span>
                          </div>
                          <div className="row-hint">benötigt − IST</div>
                        </td>
                        <td className="ist-col-val">—</td>
                        {planungsJahre.map(jahr => {
                          const wunsch = ziele['umsatz']?.[jahr] || 0;
                          const benoetigt = avgBeitrag > 0 && wunsch > 0
                            ? Math.ceil(wunsch / avgBeitrag)
                            : null;
                          const diff = benoetigt !== null ? benoetigt - istMitglieder : null;
                          return (
                            <td key={jahr} className={`diff-cell ${diff !== null ? (diff <= 0 ? 'diff-ok' : 'diff-fehlt') : ''} ${jahr === currentYear ? 'current-year' : ''}`}>
                              {diff !== null ? (
                                <div className="diff-content">
                                  <span className="diff-zahl">
                                    {diff > 0 ? '+' : ''}{diff.toLocaleString('de-DE')}
                                  </span>
                                  {diff !== 0 && (
                                    <span className="diff-label">
                                      {diff > 0 ? 'fehlen noch' : 'Ziel erreicht ✓'}
                                    </span>
                                  )}
                                </div>
                              ) : '—'}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Zeile 5: Erreichbarer Umsatz mit IST-Mitgliedern */}
                      <tr className="row-erreichbar">
                        <td className="row-label">
                          <div className="kennzahl-label">
                            <Euro size={14} className="ze-icon-green" />
                            <span>Erreichbarer Umsatz</span>
                          </div>
                          <div className="row-hint">mit IST-Mitgliedern</div>
                        </td>
                        <td className="ist-col-val">
                          <span className="ist-wert highlight-green">
                            {avgBeitrag > 0
                              ? (istMitglieder * avgBeitrag).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' EUR'
                              : '—'}
                          </span>
                        </td>
                        {planungsJahre.map(jahr => {
                          const erreichbar = avgBeitrag > 0 ? istMitglieder * avgBeitrag : null;
                          const wunsch = ziele['umsatz']?.[jahr] || 0;
                          const pct = wunsch > 0 && erreichbar !== null ? Math.round((erreichbar / wunsch) * 100) : null;
                          return (
                            <td key={jahr} className={`erreichbar-cell ${jahr === currentYear ? 'current-year' : ''}`}>
                              {erreichbar !== null ? (
                                <div className="erreichbar-content">
                                  <span className="erreichbar-wert">
                                    {(erreichbar / 1000).toFixed(1)}k EUR
                                  </span>
                                  {pct !== null && (
                                    <div className={`erreichbar-bar-wrap`}>
                                      <div className="erreichbar-bar-bg">
                                        <div
                                          className={`erreichbar-bar-fill${pct >= 100 ? ' ze-erreichbar-fill--full' : pct >= 75 ? ' ze-erreichbar-fill--mid' : ' ze-erreichbar-fill--low'}`}
                                          style={{ width: `${Math.min(100, pct)}%` }}
                                        />
                                      </div>
                                      <span className={`erreichbar-pct${pct >= 100 ? ' ze-erreichbar-pct--full' : pct >= 75 ? ' ze-erreichbar-pct--mid' : ' ze-erreichbar-pct--low'}`}>
                                        {pct}%
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Hinweis */}
                <div className="umsatz-hinweis">
                  <AlertTriangle size={13} />
                  <span>
                    Berechnung basiert auf dem gewichteten Ø-Jahresbeitrag aus der Beitragsstruktur.
                    Zielumsatz über „Bearbeiten" setzen und speichern — wird in der Datenbank gespeichert.
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Finanzrechner Section */}
      {showFinanzrechner && (
        <div className="ziele-section">
          <div
            className="section-header clickable"
            onClick={() => toggleSection('rechner')}
          >
            <div className="section-title">
              <Calculator size={20} />
              <span>5-Jahres Finanzprognose</span>
            </div>
            {expandedSections.rechner ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>

          {expandedSections.rechner && (
            <div className="finanz-rechner">
              {/* Mitgliederplanung */}
              <div className="rechner-eingabe">
                <div className="eingabe-gruppe full-width">
                  <label>Geplante Mitgliederzahlen pro Jahr</label>
                  <div className="jahr-inputs">
                    {planungsJahre.map(jahr => (
                      <div key={jahr} className="jahr-input-gruppe">
                        <span className="jahr-label">{jahr}</span>
                        {editMode ? (
                          <input
                            type="number"
                            min="0"
                            value={rechnerDaten.mitgliederPlanung[jahr] || 0}
                            onChange={(e) => updateMitgliederPlanung(jahr, e.target.value)}
                          />
                        ) : (
                          <span className="ist-wert ze-ist-wert--planning">
                            {(rechnerDaten.mitgliederPlanung[jahr] || 0).toLocaleString('de-DE')}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="beitrags-gruppen">
                  <label>Beitragsstruktur (basierend auf aktuellen Tarifen)</label>
                  {rechnerDaten.beitragsverteilung.map((gruppe, idx) => (
                    <div key={gruppe.id || idx} className="beitrags-gruppe">
                      <span className="gruppe-name">{gruppe.name}</span>
                      <div className="gruppe-info">
                        <span className="gruppe-beitrag">{gruppe.monatsbeitrag.toFixed(2)} EUR/Monat</span>
                        <span className="gruppe-anteil">{gruppe.anteil}% Anteil</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 5-Jahres Prognose Tabelle */}
              <div className="prognose-tabelle">
                <table>
                  <thead>
                    <tr>
                      <th>Jahr</th>
                      <th>Mitglieder</th>
                      <th>Monatlich</th>
                      <th>Jährlich</th>
                      <th>Wachstum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planungsJahre.map((jahr, idx) => {
                      const mitglieder = rechnerDaten.mitgliederPlanung[jahr] || 0;
                      const prognose = berechneFinanzprognoseJahr(mitglieder);
                      const vorjahr = idx > 0 ? rechnerDaten.mitgliederPlanung[planungsJahre[idx - 1]] || 0 : null;
                      const wachstum = vorjahr ? Math.round(((mitglieder - vorjahr) / vorjahr) * 100) : null;

                      return (
                        <tr key={jahr} className={jahr === currentYear ? 'current-year' : ''}>
                          <td className="jahr">{jahr}</td>
                          <td className="mitglieder">{mitglieder.toLocaleString('de-DE')}</td>
                          <td className="monatlich">
                            {prognose.monatlich.toLocaleString('de-DE', { minimumFractionDigits: 2 })} EUR
                          </td>
                          <td className="jaehrlich highlight">
                            {prognose.jaehrlich.toLocaleString('de-DE', { minimumFractionDigits: 2 })} EUR
                          </td>
                          <td className={`wachstum ${wachstum && wachstum > 0 ? 'positive' : wachstum && wachstum < 0 ? 'negative' : ''}`}>
                            {wachstum !== null ? (
                              <>
                                {wachstum > 0 && <TrendingUp size={14} />}
                                {wachstum < 0 && <TrendingDown size={14} />}
                                {wachstum >= 0 ? '+' : ''}{wachstum}%
                              </>
                            ) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="3" className="summe-label">5-Jahres Gesamtsumme:</td>
                      <td className="summe-wert" colSpan="2">
                        {planungsJahre.reduce((sum, jahr) => {
                          const mitglieder = rechnerDaten.mitgliederPlanung[jahr] || 0;
                          return sum + berechneFinanzprognoseJahr(mitglieder).jaehrlich;
                        }, 0).toLocaleString('de-DE', { minimumFractionDigits: 2 })} EUR
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ZieleEntwicklung;
