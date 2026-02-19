import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './GaleriePage.css';

const GALLERY_ITEMS = [
  {
    id: 1,
    webp: '/gallery/checkin-overview.webp',
    fallback: '/gallery/checkin-overview.png',
    title: 'Check-In System',
    description: 'Alle Check-In Module auf einen Blick: Mitglieder-Check-In, Anwesenheitslisten, Personal-Erfassung und Live-Displays.',
    category: 'check-in'
  },
  {
    id: 2,
    webp: '/gallery/checkin-terminal.webp',
    fallback: '/gallery/checkin-terminal.png',
    title: 'Check-In Terminal',
    description: 'Einfaches Check-In per QR-Code oder Namenssuche. Echtzeit-Statistiken zu Anwesenheit und Kursen.',
    category: 'check-in'
  },
  {
    id: 3,
    webp: '/gallery/mitgliederverwaltung.webp',
    fallback: '/gallery/mitgliederverwaltung.png',
    title: 'Mitgliederverwaltung',
    description: 'Zentrale Verwaltung aller Mitglieder, Buddy-Gruppen, Newsletter und Kommunikation.',
    category: 'mitglieder'
  },
  {
    id: 4,
    webp: '/gallery/pruefungswesen.webp',
    fallback: '/gallery/pruefungswesen.png',
    title: 'Prüfungswesen',
    description: 'Prüfungen planen und durchführen, Ergebnisse dokumentieren und Auszeichnungen vergeben.',
    category: 'pruefungen'
  },
  {
    id: 5,
    webp: '/gallery/badge-verwaltung.webp',
    fallback: '/gallery/badge-verwaltung.png',
    title: 'Badge-Verwaltung',
    description: 'Motiviere deine Mitglieder mit Auszeichnungen und Badges für Trainingsleistungen.',
    category: 'pruefungen'
  },
  {
    id: 6,
    webp: '/gallery/finanzen.webp',
    fallback: '/gallery/finanzen.png',
    title: 'Finanzen & Buchhaltung',
    description: 'Komplettes Finanzmodul: Beiträge, SEPA-Lastschriften, Mahnwesen, Rechnungen und DATEV-Export.',
    category: 'finanzen'
  },
  {
    id: 7,
    webp: '/gallery/dojo-verwaltung.webp',
    fallback: '/gallery/dojo-verwaltung.png',
    title: 'Dojo-Verwaltung',
    description: 'Kurse, Stundenplan, Kampfkunst-Stile, Gruppen und Standorte zentral verwalten.',
    category: 'verwaltung'
  },
  {
    id: 8,
    webp: '/gallery/stil-verwaltung.webp',
    fallback: '/gallery/stil-verwaltung.png',
    title: 'Stil-Verwaltung',
    description: 'Kampfkunst-Stile mit Graduierungssystemen, Prüfungsanforderungen und Gürtelfarben definieren.',
    category: 'verwaltung'
  },
  {
    id: 9,
    webp: '/gallery/auswertungen.webp',
    fallback: '/gallery/auswertungen.png',
    title: 'Auswertungen & Analysen',
    description: 'Break-Even-Analyse, Finanzübersicht, Mitgliederstatistiken und Performance-Prognosen.',
    category: 'finanzen'
  }
];

const CATEGORIES = [
  { key: 'all', label: 'Alle' },
  { key: 'check-in', label: 'Check-In' },
  { key: 'mitglieder', label: 'Mitglieder' },
  { key: 'pruefungen', label: 'Prüfungen' },
  { key: 'finanzen', label: 'Finanzen' },
  { key: 'verwaltung', label: 'Verwaltung' }
];

const GaleriePage = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [lightboxImage, setLightboxImage] = useState(null);

  const filteredItems = selectedCategory === 'all'
    ? GALLERY_ITEMS
    : GALLERY_ITEMS.filter(item => item.category === selectedCategory);

  const openLightbox = (item) => {
    setLightboxImage(item);
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    setLightboxImage(null);
    document.body.style.overflow = 'auto';
  };

  return (
    <div className="galerie-page">
      {/* Header */}
      <header className="galerie-header">
        <div className="container">
          <Link to="/" className="galerie-logo">
            DojoSoftware
          </Link>
          <nav className="galerie-nav">
            <Link to="/">Home</Link>
            <Link to="/pricing">Preise</Link>
            <Link to="/login">Login</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="galerie-hero">
        <div className="container">
          <span className="galerie-label">Screenshots</span>
          <h1>So sieht DojoSoftware aus</h1>
          <p>Entdecke alle Funktionen in unserer Bildergalerie</p>
        </div>
      </section>

      {/* Filter */}
      <section className="galerie-filter">
        <div className="container">
          <div className="filter-buttons">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                className={`filter-btn ${selectedCategory === cat.key ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="galerie-grid-section">
        <div className="container">
          <div className="galerie-grid">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="galerie-item"
                onClick={() => openLightbox(item)}
              >
                <div className="galerie-image-wrapper">
                  <picture>
                    <source srcSet={item.webp} type="image/webp" />
                    <img
                      src={item.fallback}
                      alt={item.title}
                      loading="lazy"
                    />
                  </picture>
                  <div className="galerie-overlay">
                    <span className="zoom-icon">🔍</span>
                  </div>
                </div>
                <div className="galerie-info">
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="galerie-cta">
        <div className="container">
          <h2>Überzeug dich selbst</h2>
          <p>Teste DojoSoftware 14 Tage kostenlos - keine Kreditkarte nötig</p>
          <Link to="/register" className="cta-btn">
            Jetzt kostenlos testen
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="galerie-footer">
        <div className="container">
          <p>© 2026 DojoSoftware by TDA International</p>
          <div className="footer-links">
            <Link to="/">Startseite</Link>
            <Link to="/datenschutz">Datenschutz</Link>
            <Link to="/impressum">Impressum</Link>
          </div>
        </div>
      </footer>

      {/* Lightbox */}
      {lightboxImage && (
        <div className="lightbox" onClick={closeLightbox}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeLightbox}>×</button>
            <picture>
              <source srcSet={lightboxImage.webp} type="image/webp" />
              <img src={lightboxImage.fallback} alt={lightboxImage.title} />
            </picture>
            <div className="lightbox-info">
              <h3>{lightboxImage.title}</h3>
              <p>{lightboxImage.description}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GaleriePage;
