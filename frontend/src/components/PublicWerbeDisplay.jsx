import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';
import '../styles/PublicWerbeDisplay.css';

// Eigenständige Vollbild-Anzeige für einen zweiten Bildschirm (Fire-TV / Mini-PC, Kiosk-Modus).
// Aufruf: /public-display?dojo=3   — kein Login, analog zur Stundenplananzeige.
const WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

const PublicWerbeDisplay = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const dojoId = urlParams.get('dojo') || '3';

  const [config, setConfig] = useState(null);
  const [dojoname, setDojoname] = useState(null);
  const [slides, setSlides] = useState([]);
  const [index, setIndex] = useState(0);
  const [now, setNow] = useState(new Date());
  const [error, setError] = useState(null);
  const [enterprise, setEnterprise] = useState(false);

  const rotateTimer = useRef(null);

  // --- Daten laden + Auto-Refresh alle 60s ---
  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const res = await axios.get(`/public/display/${dojoId}`);
        if (!mounted) return;
        const data = res.data || {};
        setEnterprise(!!data.enterprise_erforderlich);
        setConfig(data.config || null);
        setDojoname(data.dojoname || null);
        setSlides(Array.isArray(data.slides) ? data.slides : []);
        setError(null);
      } catch (err) {
        if (!mounted) return;
        setError('Verbindung zum Server unterbrochen – nächster Versuch läuft …');
      }
    };
    fetchData();
    const dataInterval = setInterval(fetchData, 60000);
    return () => { mounted = false; clearInterval(dataInterval); };
  }, [dojoId]);

  // --- Uhr ---
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // --- Slide-Rotation (Dauer pro Slide oder Standard) ---
  useEffect(() => {
    if (rotateTimer.current) clearTimeout(rotateTimer.current);
    if (!slides.length) return;
    const safeIndex = index % slides.length;
    if (safeIndex !== index) { setIndex(safeIndex); return; }
    const slide = slides[safeIndex];
    const standard = (config?.standard_dauer && config.standard_dauer > 0) ? config.standard_dauer : 12;
    const seconds = (slide?.dauer && slide.dauer > 0) ? slide.dauer : standard;
    rotateTimer.current = setTimeout(() => {
      setIndex(prev => (prev + 1) % slides.length);
    }, seconds * 1000);
    return () => { if (rotateTimer.current) clearTimeout(rotateTimer.current); };
  }, [slides, index, config]);

  const fmtTime = () => now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = () => now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const fmtDay = (d) => {
    if (!d) return '';
    const date = new Date(d);
    return date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
  };
  const fmtHM = (t) => (t ? String(t).substring(0, 5) : '');

  // ---------- Renderer pro Slide-Typ ----------
  const renderSlide = (slide) => {
    switch (slide.typ) {
      case 'bild':
        return (
          <div className="wd-slide wd-slide-media" style={slide.hintergrund_farbe ? { background: slide.hintergrund_farbe } : null}>
            <img src={slide.medien_url} alt={slide.titel || ''} className="wd-media-img" />
            {slide.titel && <div className="wd-media-caption">{slide.titel}</div>}
          </div>
        );
      case 'video':
        return (
          <div className="wd-slide wd-slide-media" style={{ background: '#000' }}>
            <video src={slide.medien_url} className="wd-media-video" autoPlay muted loop playsInline />
            {slide.titel && <div className="wd-media-caption">{slide.titel}</div>}
          </div>
        );
      case 'qr':
        return (
          <div className="wd-slide wd-slide-qr" style={slide.hintergrund_farbe ? { background: slide.hintergrund_farbe } : null}>
            {slide.titel && <h1 className="wd-qr-title" style={slide.text_farbe ? { color: slide.text_farbe } : null}>{slide.titel}</h1>}
            <div className="wd-qr-box">
              <QRCodeCanvas value={slide.qr_daten || ''} size={420} level="M" includeMargin />
            </div>
            {slide.text_inhalt && <p className="wd-qr-sub" style={slide.text_farbe ? { color: slide.text_farbe } : null}>{slide.text_inhalt}</p>}
          </div>
        );
      case 'text':
        return (
          <div
            className="wd-slide wd-slide-text"
            style={{
              background: slide.hintergrund_farbe || 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              color: slide.text_farbe || '#ffffff'
            }}
          >
            {slide.titel && <h1 className="wd-text-title">{slide.titel}</h1>}
            {slide.text_inhalt && <p className="wd-text-body">{slide.text_inhalt}</p>}
          </div>
        );
      case 'auto_kursplan':
        return renderKursplan(slide);
      case 'auto_events':
        return renderEvents(slide);
      case 'auto_pruefungen':
        return renderPruefungen(slide);
      case 'auto_geburtstage':
        return renderGeburtstage(slide);
      case 'auto_schnellansage':
        return (
          <div className="wd-slide wd-slide-ansage">
            <div className="wd-ansage-badge">📣 Aktuelle Info</div>
            <h1 className="wd-ansage-title">{slide.titel}</h1>
            {slide.daten?.text && <p className="wd-ansage-text">{slide.daten.text}</p>}
          </div>
        );
      default:
        return <div className="wd-slide wd-slide-text"><h1 className="wd-text-title">{slide.titel || ''}</h1></div>;
    }
  };

  const renderKursplan = (slide) => {
    const heute = WOCHENTAGE[now.getDay()];
    const wochenplan = slide.daten?.wochenplan || [];
    const heutigeKurse = wochenplan.filter(k => k.tag === heute);
    return (
      <div className="wd-slide wd-slide-auto">
        <div className="wd-auto-header">🥋 Kurse heute <span className="wd-auto-sub">{heute}</span></div>
        {heutigeKurse.length === 0 ? (
          <div className="wd-auto-empty">Heute kein regulärer Kurs – bis bald im Dojo!</div>
        ) : (
          <div className="wd-kurs-grid">
            {heutigeKurse.slice(0, 8).map((k, i) => (
              <div key={i} className="wd-kurs-card">
                <div className="wd-kurs-zeit">{fmtHM(k.uhrzeit_start)}–{fmtHM(k.uhrzeit_ende)}</div>
                <div className="wd-kurs-name">{k.stil || k.gruppenname || 'Training'}</div>
                {k.gruppenname && k.stil && <div className="wd-kurs-gruppe">{k.gruppenname}</div>}
                {k.trainer && k.trainer.trim() && <div className="wd-kurs-trainer">👤 {k.trainer}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderEvents = (slide) => {
    const events = slide.daten?.events || [];
    return (
      <div className="wd-slide wd-slide-auto">
        <div className="wd-auto-header">📅 Kommende Events</div>
        <div className="wd-liste">
          {events.map((e, i) => (
            <div key={i} className="wd-liste-row">
              <div className="wd-liste-datum">{fmtDay(e.datum)}{e.uhrzeit_beginn ? ` · ${fmtHM(e.uhrzeit_beginn)}` : ''}</div>
              <div className="wd-liste-haupt">
                <span className="wd-liste-titel">{e.titel}</span>
                {e.ort && <span className="wd-liste-ort">📍 {e.ort}</span>}
              </div>
              {e.event_typ && <div className="wd-liste-tag">{e.event_typ}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPruefungen = (slide) => {
    const pruefungen = slide.daten?.pruefungen || [];
    return (
      <div className="wd-slide wd-slide-auto">
        <div className="wd-auto-header">🎓 Nächste Prüfungen</div>
        <div className="wd-liste">
          {pruefungen.map((p, i) => (
            <div key={i} className="wd-liste-row">
              <div className="wd-liste-datum">{fmtDay(p.pruefungsdatum)}{p.pruefungszeit ? ` · ${fmtHM(p.pruefungszeit)}` : ''}</div>
              <div className="wd-liste-haupt">
                <span className="wd-liste-titel">{p.stil_name || 'Gürtelprüfung'}</span>
                {p.pruefungsort && <span className="wd-liste-ort">📍 {p.pruefungsort}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderGeburtstage = (slide) => {
    const gb = slide.daten?.geburtstage || [];
    return (
      <div className="wd-slide wd-slide-auto wd-slide-geburtstag">
        <div className="wd-auto-header">🎂 Wir gratulieren</div>
        <div className="wd-gb-grid">
          {gb.map((g, i) => (
            <div key={i} className="wd-gb-card">
              <div className="wd-gb-name">{g.vorname}</div>
              <div className="wd-gb-tag">{Number(g.tage_bis) === 0 ? 'heute! 🎉' : `in ${g.tage_bis} Tg.`}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---------- Fallback / Fehler ----------
  const currentSlide = slides.length ? slides[index % slides.length] : null;

  // ---------- Enterprise-Hinweis (Feature nicht freigeschaltet) ----------
  if (enterprise) {
    return (
      <div className="wd-display wd-enterprise">
        <div className="wd-ent-inner">
          <div className="wd-ent-logo">🥋</div>
          <div className="wd-ent-badge">Enterprise</div>
          <h1 className="wd-ent-title">{dojoname || 'Werbe-/Info-Bildschirm'}</h1>
          <p className="wd-ent-text">
            Dieser Info-Bildschirm ist Teil des <strong>Enterprise-Pakets</strong> der Dojo-Software.
          </p>
          <p className="wd-ent-sub">
            Schalte das Modul „Werbe-/Info-Bildschirm" frei, um Werbung, Kurspläne, Events und mehr
            automatisch auf einem zweiten Bildschirm anzuzeigen.
          </p>
          <div className="wd-ent-foot">Dojo-Software · TDA Systems</div>
        </div>
      </div>
    );
  }

  return (
    <div className="wd-display">
      {/* Kopfzeile mit Branding + Uhr */}
      <div className="wd-topbar">
        <div className="wd-brand">{config?.titel || dojoname || 'Willkommen'}</div>
        {config?.uhr_anzeigen !== 0 && (
          <div className="wd-clock">
            <span className="wd-clock-time">{fmtTime()}</span>
            <span className="wd-clock-date">{fmtDate()}</span>
          </div>
        )}
      </div>

      {/* Bühne */}
      <div className="wd-stage">
        {error && !slides.length ? (
          <div className="wd-slide wd-slide-text">
            <div className="wd-fallback-logo">🥋</div>
            <h1 className="wd-text-title">{config?.titel || dojoname || 'Willkommen im Dojo'}</h1>
            <p className="wd-text-body">{error}</p>
          </div>
        ) : !currentSlide ? (
          <div className="wd-slide wd-slide-text">
            <div className="wd-fallback-logo">🥋</div>
            <h1 className="wd-text-title">{config?.titel || dojoname || 'Willkommen im Dojo'}</h1>
            <p className="wd-text-body">Schön, dass du da bist.</p>
          </div>
        ) : (
          <div key={currentSlide.key || index} className="wd-stage-inner">
            {renderSlide(currentSlide)}
          </div>
        )}
      </div>

      {/* Fortschrittspunkte */}
      {slides.length > 1 && (
        <div className="wd-dots">
          {slides.map((s, i) => (
            <span key={s.key || i} className={`wd-dot ${i === (index % slides.length) ? 'active' : ''}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PublicWerbeDisplay;
