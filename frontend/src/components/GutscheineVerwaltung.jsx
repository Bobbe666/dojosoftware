/**
 * GutscheineVerwaltung.jsx
 * Premium-Feature in der Marketing-Zentrale
 * Gutscheine erstellen, verwalten und als Link auf die Homepage einbetten
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Gift, Plus, Copy, CheckCircle, XCircle, Search, Eye, Trash2,
  Link, ExternalLink, QrCode, RefreshCw, Tag, AlertCircle
} from 'lucide-react';
import { fetchWithAuth } from '../utils/fetchWithAuth';
import config from '../config/config.js';
import { useDojoContext } from '../context/DojoContext';
import '../styles/GutscheineVerwaltung.css';

// Anlässe mit Labels und Emojis
const ANLAESSE = [
  { id: 'alle',        label: 'Alle',       emoji: '🎁' },
  { id: 'weihnachten', label: 'Weihnachten', emoji: '🎄' },
  { id: 'geburtstag',  label: 'Geburtstag',  emoji: '🎂' },
  { id: 'kinder',      label: 'Kinder',      emoji: '🧒' },
  { id: 'erwachsene',  label: 'Erwachsene',  emoji: '🏋️' },
  { id: 'allgemein',   label: 'Allgemein',   emoji: '⭐' },
];

// Vorgefertigte Werte
const PRESET_WERTE = [50, 100, 150, 200];

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://dojo.tda-intl.org';

export default function GutscheineVerwaltung() {
  const { activeDojo } = useDojoContext();
  const [tab, setTab]                   = useState('erstellen'); // erstellen | liste | einbetten
  const [vorlagen, setVorlagen]         = useState([]);
  const [gutscheine, setGutscheine]     = useState([]);
  const [stats, setStats]               = useState(null);
  const [loading, setLoading]           = useState(false);
  const [msg, setMsg]                   = useState({ type: '', text: '' });

  // Erstellen-Form
  const [selectedAnlass, setSelectedAnlass] = useState('alle');
  const [selectedVorlage, setSelectedVorlage] = useState(null);
  const [wertPreset, setWertPreset]     = useState(null);    // null = individuell
  const [wertCustom, setWertCustom]     = useState('');
  const [form, setForm]                 = useState({
    titel: '', nachricht: '', gueltig_bis: '',
    empfaenger_name: '', empfaenger_email: '',
  });
  const [saving, setSaving]             = useState(false);
  const [neuerCode, setNeuerCode]       = useState(null);    // frisch erstellter Gutschein

  // Liste-Filter
  const [filterEingeloest, setFilterEingeloest] = useState('offen');
  const [search, setSearch]             = useState('');

  // Copied-State für Links
  const [copied, setCopied]             = useState('');

  // ── Daten laden ──────────────────────────────────────────────────────────────

  const loadVorlagen = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/gutscheine/vorlagen`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setVorlagen(data.vorlagen || []);
    } catch {
      showMsg('error', 'Vorlagen konnten nicht geladen werden');
    }
  }, []);

  const loadGutscheine = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterEingeloest !== 'alle') params.set('eingeloest', filterEingeloest === 'eingeloest' ? 'true' : 'false');
      if (search) params.set('search', search);
      const res = await fetchWithAuth(`${config.apiBaseUrl}/gutscheine?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setGutscheine(data.gutscheine || []);
    } catch {
      showMsg('error', 'Gutscheine konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [filterEingeloest, search]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/gutscheine/stats`);
      if (!res.ok) return;
      const data = await res.json();
      setStats(data.stats);
    } catch {}
  }, []);

  useEffect(() => { loadVorlagen(); loadStats(); }, [loadVorlagen, loadStats]);
  useEffect(() => { if (tab === 'liste') loadGutscheine(); }, [tab, loadGutscheine]);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function showMsg(type, text) {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 4500);
  }

  function copyToClipboard(text, key) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(''), 2200);
    });
  }

  const filteredVorlagen = selectedAnlass === 'alle'
    ? vorlagen
    : vorlagen.filter(v => v.anlass === selectedAnlass);

  const finalWert = wertPreset !== null ? wertPreset : parseFloat(wertCustom) || 0;

  // ── Gutschein erstellen ───────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!selectedVorlage) return showMsg('error', 'Bitte ein Bild auswählen');
    if (!finalWert || finalWert <= 0) return showMsg('error', 'Bitte einen Wert eingeben');
    if (!form.titel.trim()) return showMsg('error', 'Bitte einen Titel eingeben');

    setSaving(true);
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/gutscheine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vorlage_id: selectedVorlage.id,
          wert: finalWert,
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Fehler');
      setNeuerCode(data.gutschein);
      loadStats();
      showMsg('success', 'Gutschein erfolgreich erstellt!');
    } catch (e) {
      showMsg('error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSelectedVorlage(null);
    setWertPreset(null);
    setWertCustom('');
    setForm({ titel: '', nachricht: '', gueltig_bis: '', empfaenger_name: '', empfaenger_email: '' });
    setNeuerCode(null);
  };

  // ── Einlösen / Löschen ────────────────────────────────────────────────────────

  const handleEinloesen = async (id) => {
    if (!window.confirm('Gutschein als eingelöst markieren?')) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/gutscheine/${id}/einloesen`, { method: 'PUT' });
      if (!res.ok) throw new Error();
      loadGutscheine(); loadStats();
      showMsg('success', 'Als eingelöst markiert');
    } catch { showMsg('error', 'Fehler'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Gutschein dauerhaft löschen?')) return;
    try {
      const res = await fetchWithAuth(`${config.apiBaseUrl}/gutscheine/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      loadGutscheine(); loadStats();
    } catch { showMsg('error', 'Fehler beim Löschen'); }
  };

  // ── Widget-Code ───────────────────────────────────────────────────────────────

  const dojoIdForShop = activeDojo?.id || '';
  const widgetUrl  = `${BASE_URL}/gutschein-shop/${dojoIdForShop}`;
  const embedCode  = `<iframe src="${widgetUrl}" width="100%" height="700" style="border:none;border-radius:12px;" loading="lazy"></iframe>`;
  const scriptCode = `<script src="${BASE_URL}/gutschein-widget.js" data-dojo-id="${dojoIdForShop}" async></script>`;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="gv-container">
      {/* Stats-Leiste */}
      {stats && (
        <div className="gv-stats-bar">
          <div className="gv-stat"><span className="gv-stat-val">{stats.gesamt}</span><span className="gv-stat-lbl">Gesamt</span></div>
          <div className="gv-stat"><span className="gv-stat-val gv-stat-green">{stats.offen}</span><span className="gv-stat-lbl">Offen</span></div>
          <div className="gv-stat"><span className="gv-stat-val gv-stat-muted">{stats.eingeloest}</span><span className="gv-stat-lbl">Eingelöst</span></div>
          <div className="gv-stat"><span className="gv-stat-val">{parseFloat(stats.wert_offen || 0).toLocaleString('de-DE')} €</span><span className="gv-stat-lbl">Offener Wert</span></div>
        </div>
      )}

      {/* Nachrichten */}
      {msg.text && (
        <div className={`gv-msg gv-msg--${msg.type}`}>
          {msg.type === 'error' ? <AlertCircle size={16}/> : <CheckCircle size={16}/>}
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="gv-tabs">
        {[
          { id: 'erstellen', label: 'Gutschein erstellen', icon: Plus },
          { id: 'liste',     label: 'Meine Gutscheine',    icon: Gift },
          { id: 'einbetten', label: 'Auf Homepage einbetten', icon: Link },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`gv-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB: ERSTELLEN ── */}
      {tab === 'erstellen' && (
        <div className="gv-erstellen">
          {neuerCode ? (
            /* Erfolg: Code anzeigen */
            <div className="gv-success-card">
              <div className="gv-success-icon">🎁</div>
              <h3>Gutschein erstellt!</h3>
              <div className="gv-code-display">{neuerCode.code}</div>
              <p>Gutschein-Link:</p>
              <div className="gv-link-row">
                <span className="gv-link-text">{BASE_URL}/gutschein/{neuerCode.code}</span>
                <button
                  className="gv-copy-btn"
                  onClick={() => copyToClipboard(`${BASE_URL}/gutschein/${neuerCode.code}`, 'new')}
                >
                  {copied === 'new' ? <CheckCircle size={16}/> : <Copy size={16}/>}
                  {copied === 'new' ? 'Kopiert!' : 'Kopieren'}
                </button>
              </div>
              <div className="gv-success-img">
                <img src={neuerCode.bild_url} alt="Gutschein" />
                <div className="gv-success-overlay">
                  <div className="gv-success-wert">{parseFloat(neuerCode.wert).toFixed(0)} €</div>
                  <div className="gv-success-titel">{neuerCode.titel}</div>
                </div>
              </div>
              <button className="gv-btn gv-btn-primary" onClick={resetForm}>
                <Plus size={16}/> Weiteren Gutschein erstellen
              </button>
            </div>
          ) : (
            <>
              {/* Schritt 1: Anlass wählen */}
              <div className="gv-section">
                <h3 className="gv-section-title">1. Anlass wählen</h3>
                <div className="gv-anlass-row">
                  {ANLAESSE.map(a => (
                    <button
                      key={a.id}
                      className={`gv-anlass-btn ${selectedAnlass === a.id ? 'active' : ''}`}
                      onClick={() => { setSelectedAnlass(a.id); setSelectedVorlage(null); }}
                    >
                      {a.emoji} {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schritt 2: Bild wählen */}
              <div className="gv-section">
                <h3 className="gv-section-title">2. Bild auswählen</h3>
                {filteredVorlagen.length === 0 ? (
                  <div className="gv-empty">Keine Bilder für diesen Anlass verfügbar</div>
                ) : (
                  <div className="gv-vorlagen-grid">
                    {filteredVorlagen.map(v => (
                      <div
                        key={v.id}
                        className={`gv-vorlage-card ${selectedVorlage?.id === v.id ? 'selected' : ''}`}
                        onClick={() => setSelectedVorlage(v)}
                      >
                        <img src={v.bild_url} alt={v.titel} />
                        <div className="gv-vorlage-label">
                          <span className="gv-anlass-badge">{ANLAESSE.find(a => a.id === v.anlass)?.emoji} {v.anlass}</span>
                          <span>{v.titel}</span>
                        </div>
                        {selectedVorlage?.id === v.id && (
                          <div className="gv-vorlage-check"><CheckCircle size={24}/></div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schritt 3: Wert */}
              <div className="gv-section">
                <h3 className="gv-section-title">3. Wert festlegen</h3>
                <div className="gv-wert-row">
                  {PRESET_WERTE.map(w => (
                    <button
                      key={w}
                      className={`gv-wert-btn ${wertPreset === w ? 'active' : ''}`}
                      onClick={() => { setWertPreset(w); setWertCustom(''); }}
                    >
                      {w} €
                    </button>
                  ))}
                  <button
                    className={`gv-wert-btn ${wertPreset === null ? 'active' : ''}`}
                    onClick={() => setWertPreset(null)}
                  >
                    Individuell
                  </button>
                </div>
                {wertPreset === null && (
                  <div className="gv-custom-wert">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="z.B. 75"
                      value={wertCustom}
                      onChange={e => setWertCustom(e.target.value)}
                      className="gv-input"
                    />
                    <span className="gv-input-suffix">€</span>
                  </div>
                )}
              </div>

              {/* Schritt 4: Details */}
              <div className="gv-section">
                <h3 className="gv-section-title">4. Details</h3>
                <div className="gv-form-grid">
                  <div className="gv-form-field gv-form-field--full">
                    <label>Titel *</label>
                    <input
                      className="gv-input"
                      placeholder="z.B. Geburtstags-Gutschein für Kampfkunstkurs"
                      value={form.titel}
                      onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
                    />
                  </div>
                  <div className="gv-form-field gv-form-field--full">
                    <label>Persönliche Nachricht</label>
                    <textarea
                      className="gv-input gv-textarea"
                      placeholder="Herzlichen Glückwunsch! Viel Freude beim Training..."
                      rows={3}
                      value={form.nachricht}
                      onChange={e => setForm(f => ({ ...f, nachricht: e.target.value }))}
                    />
                  </div>
                  <div className="gv-form-field">
                    <label>Empfänger Name</label>
                    <input
                      className="gv-input"
                      placeholder="Max Mustermann"
                      value={form.empfaenger_name}
                      onChange={e => setForm(f => ({ ...f, empfaenger_name: e.target.value }))}
                    />
                  </div>
                  <div className="gv-form-field">
                    <label>Empfänger E-Mail</label>
                    <input
                      type="email"
                      className="gv-input"
                      placeholder="max@beispiel.de"
                      value={form.empfaenger_email}
                      onChange={e => setForm(f => ({ ...f, empfaenger_email: e.target.value }))}
                    />
                  </div>
                  <div className="gv-form-field">
                    <label>Gültig bis</label>
                    <input
                      type="date"
                      className="gv-input"
                      value={form.gueltig_bis}
                      onChange={e => setForm(f => ({ ...f, gueltig_bis: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              {/* Vorschau & Erstellen */}
              {selectedVorlage && finalWert > 0 && (
                <div className="gv-preview-section">
                  <h3 className="gv-section-title">Vorschau</h3>
                  <div className="gv-preview-card">
                    <img src={selectedVorlage.bild_url} alt="Vorschau" className="gv-preview-img" />
                    <div className="gv-preview-overlay">
                      <div className="gv-preview-wert">{finalWert.toFixed(0)} €</div>
                      {form.titel && <div className="gv-preview-titel">{form.titel}</div>}
                      {form.nachricht && <div className="gv-preview-msg">{form.nachricht}</div>}
                    </div>
                  </div>
                </div>
              )}

              <button
                className="gv-btn gv-btn-primary gv-btn-create"
                onClick={handleCreate}
                disabled={saving || !selectedVorlage || !finalWert || !form.titel.trim()}
              >
                {saving ? <RefreshCw size={16} className="gv-spin"/> : <Gift size={16}/>}
                {saving ? 'Wird erstellt…' : 'Gutschein erstellen'}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── TAB: LISTE ── */}
      {tab === 'liste' && (
        <div className="gv-liste">
          <div className="gv-liste-toolbar">
            <div className="gv-search-wrap">
              <Search size={15}/>
              <input
                className="gv-input gv-search-input"
                placeholder="Code, Name oder E-Mail suchen…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="gv-filter-btns">
              {[
                { id: 'offen',      label: 'Offen' },
                { id: 'eingeloest', label: 'Eingelöst' },
                { id: 'alle',       label: 'Alle' },
              ].map(f => (
                <button
                  key={f.id}
                  className={`gv-filter-btn ${filterEingeloest === f.id ? 'active' : ''}`}
                  onClick={() => setFilterEingeloest(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <button className="gv-icon-btn" onClick={loadGutscheine} title="Aktualisieren">
              <RefreshCw size={15} className={loading ? 'gv-spin' : ''}/>
            </button>
          </div>

          {loading ? (
            <div className="gv-loading"><RefreshCw size={20} className="gv-spin"/> Laden…</div>
          ) : gutscheine.length === 0 ? (
            <div className="gv-empty">Keine Gutscheine gefunden</div>
          ) : (
            <div className="gv-table-wrap">
              <table className="gv-table">
                <thead>
                  <tr>
                    <th>Bild</th>
                    <th>Code</th>
                    <th>Titel</th>
                    <th>Wert</th>
                    <th>Empfänger</th>
                    <th>Gültig bis</th>
                    <th>Status</th>
                    <th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {gutscheine.map(g => (
                    <tr key={g.id} className={g.eingeloest ? 'gv-row-eingeloest' : ''}>
                      <td>
                        <img src={g.bild_url} alt="" className="gv-table-img"/>
                      </td>
                      <td>
                        <div className="gv-code-cell">
                          <span className="gv-code-tag">{g.code}</span>
                          <button
                            className="gv-copy-mini"
                            onClick={() => copyToClipboard(`${BASE_URL}/gutschein/${g.code}`, g.code)}
                            title="Link kopieren"
                          >
                            {copied === g.code ? <CheckCircle size={13}/> : <Copy size={13}/>}
                          </button>
                        </div>
                      </td>
                      <td>{g.titel}</td>
                      <td className="gv-wert-cell">{parseFloat(g.wert).toFixed(2)} €</td>
                      <td>{g.empfaenger_name || <span className="gv-muted">—</span>}</td>
                      <td>{g.gueltig_bis ? new Date(g.gueltig_bis).toLocaleDateString('de-DE') : <span className="gv-muted">unbegrenzt</span>}</td>
                      <td>
                        {g.eingeloest
                          ? <span className="gv-badge gv-badge-eingeloest"><XCircle size={12}/> Eingelöst</span>
                          : <span className="gv-badge gv-badge-offen"><CheckCircle size={12}/> Offen</span>
                        }
                      </td>
                      <td>
                        <div className="gv-row-actions">
                          {!g.eingeloest && (
                            <button className="gv-icon-btn gv-btn-check" onClick={() => handleEinloesen(g.id)} title="Als eingelöst markieren">
                              <CheckCircle size={15}/>
                            </button>
                          )}
                          <button
                            className="gv-icon-btn"
                            onClick={() => window.open(`${BASE_URL}/gutschein/${g.code}`, '_blank')}
                            title="Gutschein öffnen"
                          >
                            <Eye size={15}/>
                          </button>
                          {!g.eingeloest && (
                            <button className="gv-icon-btn gv-btn-del" onClick={() => handleDelete(g.id)} title="Löschen">
                              <Trash2 size={15}/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: EINBETTEN ── */}
      {tab === 'einbetten' && (
        <div className="gv-einbetten">
          <div className="gv-embed-intro">
            <Gift size={32}/>
            <h3>Gutschein-Shop auf Ihrer Homepage einbetten</h3>
            <p>
              Ihre Kunden können direkt auf Ihrer Website Gutscheine kaufen und verschenken.
              Kopieren Sie einfach den Link oder den Einbettungs-Code auf Ihre Homepage.
            </p>
          </div>

          {/* Direkter Link */}
          <div className="gv-embed-card">
            <div className="gv-embed-card-header">
              <ExternalLink size={18}/> <strong>Direkter Link</strong>
              <span className="gv-embed-badge">Empfohlen</span>
            </div>
            <p>Setzen Sie diesen Link als Button auf Ihrer Homepage:</p>
            <div className="gv-embed-code-row">
              <code className="gv-embed-code">{widgetUrl}</code>
              <button
                className="gv-copy-btn"
                onClick={() => copyToClipboard(widgetUrl, 'directlink')}
              >
                {copied === 'directlink' ? <CheckCircle size={15}/> : <Copy size={15}/>}
                {copied === 'directlink' ? 'Kopiert!' : 'Kopieren'}
              </button>
            </div>
          </div>

          {/* iFrame */}
          <div className="gv-embed-card">
            <div className="gv-embed-card-header">
              <QrCode size={18}/> <strong>iFrame einbetten</strong>
            </div>
            <p>Betten Sie den Gutschein-Shop direkt in Ihre Webseite ein:</p>
            <div className="gv-embed-code-row">
              <code className="gv-embed-code gv-embed-code--long">{embedCode}</code>
              <button
                className="gv-copy-btn"
                onClick={() => copyToClipboard(embedCode, 'iframe')}
              >
                {copied === 'iframe' ? <CheckCircle size={15}/> : <Copy size={15}/>}
                {copied === 'iframe' ? 'Kopiert!' : 'Kopieren'}
              </button>
            </div>
          </div>

          {/* TDA-VIB Verbindung */}
          <div className="gv-embed-card gv-embed-card--tda">
            <div className="gv-embed-card-header">
              <Link size={18}/> <strong>tda-vib.de — Direkte Verbindung</strong>
              <span className="gv-embed-badge gv-embed-badge--gold">TDA Verband</span>
            </div>
            <p>
              Ihr Gutschein-Shop wird automatisch auf <strong>tda-vib.de</strong> unter
              Ihrem Dojo-Profil eingebunden. Besucher der Verbands-Website können
              Gutscheine direkt bei Ihrem Dojo kaufen.
            </p>
            <div className="gv-tda-steps">
              <div className="gv-tda-step">
                <span className="gv-tda-step-num">1</span>
                <span>Gutschein erstellen (Tab links)</span>
              </div>
              <div className="gv-tda-step">
                <span className="gv-tda-step-num">2</span>
                <span>Gutschein wird automatisch auf tda-vib.de sichtbar</span>
              </div>
              <div className="gv-tda-step">
                <span className="gv-tda-step-num">3</span>
                <span>Eingelöste Codes hier als "eingelöst" markieren</span>
              </div>
            </div>
            <a
              href="https://tda-vib.de"
              target="_blank"
              rel="noopener noreferrer"
              className="gv-btn gv-btn-tda"
            >
              <ExternalLink size={15}/> tda-vib.de öffnen
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
