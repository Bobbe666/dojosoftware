import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';
import { useDojoContext } from '../context/DojoContext.jsx';
import '../styles/DisplayVerwaltung.css';

const SLIDE_TYPEN = [
  { value: 'bild', label: '🖼️ Bild', hint: 'Werbe-/Infobild' },
  { value: 'text', label: '📝 Text', hint: 'Überschrift + Text' },
  { value: 'video', label: '🎬 Video', hint: 'Video-Clip (MP4)' },
  { value: 'qr', label: '📱 QR-Code', hint: 'Link / Probetraining' }
];

const AUTO_FLAGS = [
  { key: 'auto_kursplan', label: '🥋 Kurse heute', hint: 'Heutiger Kursplan' },
  { key: 'auto_events', label: '📅 Kommende Events', hint: 'Turniere & Termine' },
  { key: 'auto_pruefungen', label: '🎓 Prüfungen', hint: 'Nächste Gürtelprüfungen' },
  { key: 'auto_schnellansage', label: '📣 Schnell-Ansagen', hint: 'Aktive Info-Popups' },
  { key: 'auto_geburtstage', label: '🎂 Geburtstage', hint: 'Nur Vorname · Datenschutz beachten' }
];

const leererSlide = () => ({
  typ: 'bild', titel: '', text_inhalt: '', medien_url: '', qr_daten: '',
  hintergrund_farbe: '', text_farbe: '', dauer: '', aktiv: true, start_datum: '', end_datum: ''
});

const DisplayVerwaltung = () => {
  const { activeDojo } = useDojoContext();
  const dojoId = (activeDojo && activeDojo !== 'super-admin' && activeDojo !== 'verband') ? activeDojo.id : null;
  const withDojo = useCallback(
    (url) => (activeDojo?.id ? `${url}${url.includes('?') ? '&' : '?'}dojo_id=${activeDojo.id}` : url),
    [activeDojo]
  );

  const [config, setConfig] = useState(null);
  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState(null);
  const [modalOffen, setModalOffen] = useState(false);
  const [editSlide, setEditSlide] = useState(null);
  const [uploadLaeuft, setUploadLaeuft] = useState(false);
  const [gespeichert, setGespeichert] = useState('');

  const displayUrl = dojoId ? `${window.location.origin}/public-display?dojo=${dojoId}` : null;

  const laden = useCallback(async () => {
    try {
      setLoading(true);
      const [cfgRes, slidesRes] = await Promise.all([
        axios.get(withDojo('/display/config')),
        axios.get(withDojo('/display/slides'))
      ]);
      setConfig(cfgRes.data.config);
      setSlides(slidesRes.data.slides || []);
      setFehler(null);
    } catch (err) {
      setFehler(err.response?.data?.error || 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [withDojo]);

  useEffect(() => { laden(); }, [laden]);

  const blitzGespeichert = (txt = 'Gespeichert ✓') => {
    setGespeichert(txt);
    setTimeout(() => setGespeichert(''), 1800);
  };

  // ---------- Config ----------
  const updateConfig = async (patch) => {
    const neu = { ...config, ...patch };
    setConfig(neu);
    try {
      await axios.put(withDojo('/display/config'), patch);
      blitzGespeichert();
    } catch (err) {
      setFehler(err.response?.data?.error || 'Speichern fehlgeschlagen');
    }
  };

  // ---------- Slide-Modal ----------
  const oeffneNeu = () => { setEditSlide(leererSlide()); setModalOffen(true); };
  const oeffneBearbeiten = (s) => {
    setEditSlide({
      ...s,
      aktiv: !!s.aktiv,
      dauer: s.dauer || '',
      titel: s.titel || '', text_inhalt: s.text_inhalt || '', medien_url: s.medien_url || '',
      qr_daten: s.qr_daten || '', hintergrund_farbe: s.hintergrund_farbe || '', text_farbe: s.text_farbe || '',
      start_datum: s.start_datum ? String(s.start_datum).slice(0, 10) : '',
      end_datum: s.end_datum ? String(s.end_datum).slice(0, 10) : ''
    });
    setModalOffen(true);
  };
  const schliesseModal = () => { setModalOffen(false); setEditSlide(null); };

  const handleUpload = async (e) => {
    const datei = e.target.files?.[0];
    if (!datei) return;
    const fd = new FormData();
    fd.append('datei', datei);
    try {
      setUploadLaeuft(true);
      const res = await axios.post(withDojo('/display/upload'), fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setEditSlide(prev => ({ ...prev, medien_url: res.data.url, typ: res.data.typ || prev.typ }));
    } catch (err) {
      setFehler(err.response?.data?.error || 'Upload fehlgeschlagen');
    } finally {
      setUploadLaeuft(false);
    }
  };

  const speichereSlide = async () => {
    const payload = {
      typ: editSlide.typ,
      titel: editSlide.titel || null,
      text_inhalt: editSlide.text_inhalt || null,
      medien_url: editSlide.medien_url || null,
      qr_daten: editSlide.qr_daten || null,
      hintergrund_farbe: editSlide.hintergrund_farbe || null,
      text_farbe: editSlide.text_farbe || null,
      dauer: editSlide.dauer ? parseInt(editSlide.dauer, 10) : null,
      aktiv: editSlide.aktiv,
      start_datum: editSlide.start_datum || null,
      end_datum: editSlide.end_datum || null
    };
    try {
      if (editSlide.id) {
        await axios.put(withDojo(`/display/slides/${editSlide.id}`), payload);
      } else {
        await axios.post(withDojo('/display/slides'), payload);
      }
      schliesseModal();
      laden();
      blitzGespeichert();
    } catch (err) {
      setFehler(err.response?.data?.error || 'Speichern fehlgeschlagen');
    }
  };

  const loescheSlide = async (id) => {
    if (!window.confirm('Diesen Slide wirklich löschen?')) return;
    try {
      await axios.delete(withDojo(`/display/slides/${id}`));
      laden();
    } catch (err) {
      setFehler(err.response?.data?.error || 'Löschen fehlgeschlagen');
    }
  };

  const toggleSlideAktiv = async (s) => {
    try {
      await axios.put(withDojo(`/display/slides/${s.id}`), { aktiv: !s.aktiv });
      setSlides(prev => prev.map(x => x.id === s.id ? { ...x, aktiv: s.aktiv ? 0 : 1 } : x));
    } catch (err) {
      setFehler(err.response?.data?.error || 'Fehler');
    }
  };

  const verschiebe = async (idx, richtung) => {
    const neu = [...slides];
    const ziel = idx + richtung;
    if (ziel < 0 || ziel >= neu.length) return;
    [neu[idx], neu[ziel]] = [neu[ziel], neu[idx]];
    setSlides(neu);
    try {
      await axios.post(withDojo('/display/slides/reorder'), { ids: neu.map(s => s.id) });
    } catch (err) {
      setFehler('Sortierung fehlgeschlagen');
      laden();
    }
  };

  // ---------- Render ----------
  if (!dojoId) {
    return (
      <div className="dv-wrap">
        <div className="dv-hinweis">Bitte zuerst oben ein konkretes Dojo auswählen, um den Werbe-Bildschirm zu verwalten.</div>
      </div>
    );
  }
  if (loading) return <div className="dv-wrap"><div className="dv-hinweis">Lädt …</div></div>;

  return (
    <div className="dv-wrap">
      <div className="dv-head">
        <div>
          <h1 className="dv-title">🖥️ Werbe-/Info-Bildschirm</h1>
          <p className="dv-sub">Werbung & Infos für einen zweiten Bildschirm im Dojo (Fire-TV-Stick / Mini-PC im Vollbild-Browser).</p>
        </div>
        {gespeichert && <span className="dv-saved">{gespeichert}</span>}
      </div>

      {fehler && <div className="dv-error" onClick={() => setFehler(null)}>{fehler} (zum Ausblenden klicken)</div>}

      {/* Anzeige-URL + QR */}
      <div className="dv-card dv-url-card">
        <div className="dv-url-left">
          <h3>📺 So richtest du den Bildschirm ein</h3>
          <ol className="dv-steps">
            <li>Öffne am 2. Bildschirm (Fire-TV/Mini-PC) im Browser diese Adresse:</li>
          </ol>
          <div className="dv-url-box">
            <code>{displayUrl}</code>
            <button onClick={() => { navigator.clipboard?.writeText(displayUrl); blitzGespeichert('Kopiert ✓'); }}>Kopieren</button>
          </div>
          <div className="dv-url-actions">
            <button className="dv-btn dv-btn-primary" onClick={() => window.open(displayUrl, '_blank')}>Vorschau / Vollbild öffnen ↗</button>
            <label className="dv-toggle">
              <input
                type="checkbox"
                checked={config?.aktiv !== 0}
                onChange={(e) => updateConfig({ aktiv: e.target.checked })}
              />
              <span>Bildschirm {config?.aktiv !== 0 ? 'aktiv' : 'pausiert'}</span>
            </label>
          </div>
        </div>
        <div className="dv-url-qr">
          <QRCodeCanvas value={displayUrl} size={150} level="M" includeMargin />
          <span>Mit dem TV-Browser scannen</span>
        </div>
      </div>

      {/* Allgemeine Einstellungen */}
      <div className="dv-card">
        <h3>⚙️ Einstellungen</h3>
        <div className="dv-settings-grid">
          <label className="dv-field">
            <span>Begrüßungstitel (Kopfzeile)</span>
            <input
              type="text"
              placeholder={activeDojo?.name || 'Willkommen'}
              defaultValue={config?.titel || ''}
              onBlur={(e) => updateConfig({ titel: e.target.value || null })}
            />
          </label>
          <label className="dv-field">
            <span>Standard-Anzeigedauer pro Slide (Sek.)</span>
            <input
              type="number" min="3" max="120"
              defaultValue={config?.standard_dauer || 12}
              onBlur={(e) => updateConfig({ standard_dauer: parseInt(e.target.value, 10) || 12 })}
            />
          </label>
          <label className="dv-check">
            <input type="checkbox" checked={config?.uhr_anzeigen !== 0} onChange={(e) => updateConfig({ uhr_anzeigen: e.target.checked })} />
            <span>🕐 Uhrzeit & Datum einblenden</span>
          </label>
        </div>

        <h4 className="dv-subhead">Automatische Inhalte (ziehen Daten aus dem System)</h4>
        <div className="dv-auto-grid">
          {AUTO_FLAGS.map(f => (
            <label key={f.key} className={`dv-auto-tile ${config?.[f.key] ? 'on' : ''}`}>
              <input type="checkbox" checked={!!config?.[f.key]} onChange={(e) => updateConfig({ [f.key]: e.target.checked })} />
              <span className="dv-auto-label">{f.label}</span>
              <span className="dv-auto-hint">{f.hint}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Eigene Slides */}
      <div className="dv-card">
        <div className="dv-slides-head">
          <h3>🗂️ Eigene Slides ({slides.length})</h3>
          <button className="dv-btn dv-btn-primary" onClick={oeffneNeu}>+ Slide hinzufügen</button>
        </div>
        {slides.length === 0 ? (
          <div className="dv-empty">Noch keine eigenen Slides. Füge Werbebilder, Infos, Videos oder einen QR-Code hinzu.</div>
        ) : (
          <div className="dv-slide-list">
            {slides.map((s, idx) => (
              <div key={s.id} className={`dv-slide-row ${s.aktiv ? '' : 'inaktiv'}`}>
                <div className="dv-slide-order">
                  <button onClick={() => verschiebe(idx, -1)} disabled={idx === 0}>▲</button>
                  <button onClick={() => verschiebe(idx, 1)} disabled={idx === slides.length - 1}>▼</button>
                </div>
                <div className="dv-slide-thumb">
                  {s.typ === 'bild' && s.medien_url && <img src={s.medien_url} alt="" />}
                  {s.typ === 'video' && <span className="dv-thumb-icon">🎬</span>}
                  {s.typ === 'text' && <span className="dv-thumb-icon">📝</span>}
                  {s.typ === 'qr' && <span className="dv-thumb-icon">📱</span>}
                </div>
                <div className="dv-slide-info">
                  <div className="dv-slide-titel">{s.titel || SLIDE_TYPEN.find(t => t.value === s.typ)?.label || s.typ}</div>
                  <div className="dv-slide-meta">
                    {SLIDE_TYPEN.find(t => t.value === s.typ)?.label}
                    {s.dauer ? ` · ${s.dauer}s` : ''}
                    {(s.start_datum || s.end_datum) ? ` · ${s.start_datum ? String(s.start_datum).slice(0,10) : '…'} – ${s.end_datum ? String(s.end_datum).slice(0,10) : '…'}` : ''}
                  </div>
                </div>
                <div className="dv-slide-actions">
                  <button className="dv-link" onClick={() => toggleSlideAktiv(s)}>{s.aktiv ? 'Aktiv' : 'Inaktiv'}</button>
                  <button className="dv-link" onClick={() => oeffneBearbeiten(s)}>Bearbeiten</button>
                  <button className="dv-link dv-link-danger" onClick={() => loescheSlide(s.id)}>Löschen</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOffen && editSlide && (
        <div className="dv-modal-overlay" onClick={schliesseModal}>
          <div className="dv-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editSlide.id ? 'Slide bearbeiten' : 'Neuer Slide'}</h3>

            <label className="dv-field">
              <span>Typ</span>
              <select value={editSlide.typ} onChange={(e) => setEditSlide({ ...editSlide, typ: e.target.value })}>
                {SLIDE_TYPEN.map(t => <option key={t.value} value={t.value}>{t.label} – {t.hint}</option>)}
              </select>
            </label>

            {(editSlide.typ === 'bild' || editSlide.typ === 'video') && (
              <label className="dv-field">
                <span>{editSlide.typ === 'video' ? 'Video (MP4/WEBM)' : 'Bild (JPG/PNG)'} hochladen</span>
                <input type="file" accept={editSlide.typ === 'video' ? 'video/*' : 'image/*'} onChange={handleUpload} />
                {uploadLaeuft && <small>Lädt hoch …</small>}
                {editSlide.medien_url && <small className="dv-ok">✓ {editSlide.medien_url}</small>}
              </label>
            )}

            {editSlide.typ === 'qr' && (
              <label className="dv-field">
                <span>Ziel-Link für den QR-Code</span>
                <input type="text" placeholder="https://…" value={editSlide.qr_daten} onChange={(e) => setEditSlide({ ...editSlide, qr_daten: e.target.value })} />
              </label>
            )}

            <label className="dv-field">
              <span>{editSlide.typ === 'bild' || editSlide.typ === 'video' ? 'Bildunterschrift (optional)' : 'Überschrift'}</span>
              <input type="text" value={editSlide.titel} onChange={(e) => setEditSlide({ ...editSlide, titel: e.target.value })} />
            </label>

            {(editSlide.typ === 'text' || editSlide.typ === 'qr') && (
              <label className="dv-field">
                <span>Text</span>
                <textarea rows="3" value={editSlide.text_inhalt} onChange={(e) => setEditSlide({ ...editSlide, text_inhalt: e.target.value })} />
              </label>
            )}

            {editSlide.typ === 'text' && (
              <div className="dv-row2">
                <label className="dv-field">
                  <span>Hintergrundfarbe</span>
                  <input type="color" value={editSlide.hintergrund_farbe || '#16213e'} onChange={(e) => setEditSlide({ ...editSlide, hintergrund_farbe: e.target.value })} />
                </label>
                <label className="dv-field">
                  <span>Textfarbe</span>
                  <input type="color" value={editSlide.text_farbe || '#ffffff'} onChange={(e) => setEditSlide({ ...editSlide, text_farbe: e.target.value })} />
                </label>
              </div>
            )}

            <div className="dv-row2">
              <label className="dv-field">
                <span>Anzeigedauer (Sek., leer = Standard)</span>
                <input type="number" min="3" max="300" value={editSlide.dauer} onChange={(e) => setEditSlide({ ...editSlide, dauer: e.target.value })} />
              </label>
              <label className="dv-check dv-check-inline">
                <input type="checkbox" checked={editSlide.aktiv} onChange={(e) => setEditSlide({ ...editSlide, aktiv: e.target.checked })} />
                <span>Aktiv</span>
              </label>
            </div>

            <div className="dv-row2">
              <label className="dv-field">
                <span>Anzeigen ab (optional)</span>
                <input type="date" value={editSlide.start_datum} onChange={(e) => setEditSlide({ ...editSlide, start_datum: e.target.value })} />
              </label>
              <label className="dv-field">
                <span>Anzeigen bis (optional)</span>
                <input type="date" value={editSlide.end_datum} onChange={(e) => setEditSlide({ ...editSlide, end_datum: e.target.value })} />
              </label>
            </div>

            <div className="dv-modal-actions">
              <button className="dv-btn" onClick={schliesseModal}>Abbrechen</button>
              <button className="dv-btn dv-btn-primary" onClick={speichereSlide} disabled={uploadLaeuft}>Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisplayVerwaltung;
