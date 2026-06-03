// =============================================================================
// MemberNewsWidget — News-Karten + News-Modal (aus MemberDashboard extrahiert).
// Eigener State + eigener Fetch → rendert nur bei eigenen Datenänderungen,
// nicht bei jedem Parent-Re-Render. CSS-Klassen (member-news-*) liegen global
// in MemberDashboard.css. React.memo.
// =============================================================================
import React, { useState, useEffect, useRef } from 'react';
import config from '../config/config.js';
import { fetchWithAuth } from '../utils/fetchWithAuth';

const deferIdle = (cb) =>
  (typeof window !== 'undefined' && window.requestIdleCallback)
    ? window.requestIdleCallback(cb, { timeout: 1500 })
    : setTimeout(cb, 250);

function MemberNewsSlideshow({ bilder, titel }) {
  const [aktiv, setAktiv] = useState(0);
  const timerRef = useRef(null);
  useEffect(() => {
    setAktiv(0);
    if (bilder.length < 2) return;
    timerRef.current = setInterval(() => {
      setAktiv(prev => (prev + 1) % bilder.length);
    }, 4000);
    return () => clearInterval(timerRef.current);
  }, [bilder.length]);
  return (
    <div className="member-news-slideshow">
      {bilder.map((url, i) => (
        <img key={i} src={url} alt={`${titel} ${i + 1}`}
          className={`member-news-slide${i === aktiv ? ' aktiv' : ''}`} loading="lazy" />
      ))}
      {bilder.length > 1 && (
        <div className="member-news-slide-dots">
          {bilder.map((_, i) => (
            <span key={i} className={`member-slide-dot${i === aktiv ? ' aktiv' : ''}`}
              onClick={() => setAktiv(i)} />
          ))}
        </div>
      )}
    </div>
  );
}

function MemberNewsModal({ artikel, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  const inhalt = artikel.inhalt || '';
  const isHtml = /<[a-z][\s\S]*>/i.test(inhalt);
  return (
    <div className="member-news-modal-overlay" onClick={onClose}>
      <div className="member-news-modal-box" onClick={e => e.stopPropagation()}>
        <button className="member-news-modal-close" onClick={onClose} aria-label="Schließen">✕</button>
        {artikel.bilder.length > 0 && (
          <div className="member-news-modal-bild">
            <MemberNewsSlideshow bilder={artikel.bilder} titel={artikel.titel} />
          </div>
        )}
        <div className="member-news-modal-inhalt">
          <div className="member-news-modal-date">{formatDate(artikel.datum)}</div>
          <h2 className="member-news-modal-titel">{artikel.titel}</h2>
          <div className="member-news-modal-text">
            {isHtml
              ? <div dangerouslySetInnerHTML={{ __html: inhalt }} />
              : inhalt.split(/\n\s*\n/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>)
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberNewsWidget() {
  const [memberNews, setMemberNews] = useState([]);
  const [offeneNews, setOffeneNews] = useState(null);

  useEffect(() => {
    deferIdle(async () => {
      try {
        const response = await fetchWithAuth(`${config.apiBaseUrl}/news/public`);
        if (!response.ok) return;
        const data = await response.json();
        if (data.news && data.news.length > 0) {
          const toAbs = (url) => url ? (url.startsWith('http') ? url : `https://app.tda-vib.de${url}`) : null;
          const mapped = data.news.map(a => {
            let bilder = [];
            if (a.bilder_json) {
              try { bilder = JSON.parse(a.bilder_json).map(toAbs).filter(Boolean); } catch {}
            }
            if (bilder.length === 0 && a.bild_url) bilder = [toAbs(a.bild_url)];
            return {
              id: a.id,
              titel: a.titel,
              kurzbeschreibung: a.kurzbeschreibung,
              inhalt: a.inhalt || '',
              bilder,
              datum: a.veroeffentlicht_am || a.created_at,
            };
          });
          setMemberNews(mapped);
        }
      } catch { /* still */ }
    });
  }, []);

  return (
    <>
      {/* News Widget */}
      {memberNews.length > 0 && (
        <div className="member-news-wrap">
          <div className="member-news-header">
            <h3 className="member-news-title">📰 Aktuelles</h3>
          </div>
          <div className="member-news-list">
            {memberNews.slice(0, 3).map(artikel => (
              <div key={artikel.id} className="member-news-card">
                {artikel.bilder.length > 0 && (
                  <MemberNewsSlideshow bilder={artikel.bilder} titel={artikel.titel} />
                )}
                <div className="member-news-card-content">
                  <div className="member-news-date">
                    {artikel.datum
                      ? new Date(artikel.datum).toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' })
                      : ''}
                  </div>
                  <div className="member-news-card-titel">{artikel.titel}</div>
                  {artikel.kurzbeschreibung && (
                    <p className="member-news-card-excerpt">{artikel.kurzbeschreibung}</p>
                  )}
                  {artikel.inhalt && (
                    <button className="member-news-weiterlesen" onClick={() => setOffeneNews(artikel)}>
                      Weiterlesen →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* News Modal */}
      {offeneNews && (
        <MemberNewsModal artikel={offeneNews} onClose={() => setOffeneNews(null)} />
      )}
    </>
  );
}

export default React.memo(MemberNewsWidget);
