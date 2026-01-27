import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForceDarkTheme } from '../context/ThemeContext';
import '../styles/themes.css';
import './LandingPage.css';
import dojoLogo from '../assets/dojo-logo.png';

function LandingPage() {
  const navigate = useNavigate();
  useForceDarkTheme();

  const features = [
    {
      icon: '👥',
      title: 'Mitgliederverwaltung',
      description: 'Verträge, Kündigungen, Dokumente - alles an einem Ort'
    },
    {
      icon: '✅',
      title: 'Check-In System',
      description: 'QR-Code basiertes Check-In mit Live-Display'
    },
    {
      icon: '💶',
      title: 'SEPA-Lastschrift',
      description: 'Automatische Beitragseinzüge per SEPA-Mandat'
    },
    {
      icon: '🥋',
      title: 'Prüfungsverwaltung',
      description: 'Gürtelprüfungen digital organisieren'
    },
    {
      icon: '📊',
      title: 'Statistiken & Reports',
      description: 'Dashboard mit Echtzeit-Auswertungen'
    },
    {
      icon: '🛒',
      title: 'Verkauf & Lager',
      description: 'Artikel, Kasse und Bestandsverwaltung'
    },
    {
      icon: '📈',
      title: 'Buchführung',
      description: 'Professionelle Finanzverwaltung und Rechnungswesen'
    },
    {
      icon: '🌐',
      title: 'Online-Registrierung für Neumitglieder',
      description: 'Selbstständige Anmeldung neuer Mitglieder online'
    },
    {
      icon: '📅',
      title: 'Terminverwaltung & Stundenplan',
      description: 'Trainingszeiten, Kursplanung und Termine verwalten'
    },
    {
      icon: '🎯',
      title: 'Events & Veranstaltungen',
      description: 'Turniere, Seminare und Events organisieren'
    },
    {
      icon: '📧',
      title: 'Kommunikation & Newsletter',
      description: 'E-Mail-Versand und Mitgliederansprache'
    }
  ];

  const testimonials = [
    {
      name: '',
      dojo: '',
      text: '',
      rating: 5,
      image: null
    },
    {
      name: '',
      dojo: '',
      text: '',
      rating: 5,
      image: null
    },
    {
      name: 'Sascha S.',
      dojo: 'Kampfsportschule Schreiner',
      text: 'Endlich eine Software die speziell für Kampfsportschulen entwickelt wurde.',
      rating: 5,
      image: null
    }
  ];

  const [currentTestimonial, setCurrentTestimonial] = useState(2); // Starte beim dritten (Index 2)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => {
        // Überspringe leere Testimonials (Index 0 und 1)
        // Wir haben nur einen nicht-leeren Testimonial (Index 2)
        // Für zukünftige Erweiterung: Springe zurück zum ersten nicht-leeren
        return 2; // Immer Index 2, da nur dieser befüllt ist
      });
    }, 5000); // Wechselt alle 5 Sekunden

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="nav-container">
          <div className="nav-logo">
            <img src={dojoLogo} alt="DojoSoftware Logo" className="nav-logo-image" />
            <span className="logo-text">DojoSoftware</span>
          </div>
          <div className="nav-links">
            <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Home</a>
            <a href="#features">Features</a>
            <a href="#galerie" onClick={(e) => { e.preventDefault(); navigate('/galerie'); }}>Galerie</a>
            <a href="#pricing" onClick={(e) => { e.preventDefault(); navigate('/pricing'); }}>Preise</a>
            <a href="#testimonials">Referenzen</a>
            <button className="nav-login-btn" onClick={() => navigate('/login')}>
              Login
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">
              Die professionelle Lösung für<br />
              <span className="hero-highlight">Kampfsportschulen</span>
            </h1>
            <p className="hero-subtitle">
              Mitgliederverwaltung • Check-In • SEPA • Verkauf • Buchführung • Online-Registrierung für Neumitglieder • Prüfungswesen • uvm.
            </p>
            <div className="hero-cta">
              <button className="cta-primary" onClick={() => navigate('/register')}>
                <span className="cta-icon">🚀</span>
                Jetzt kostenlos testen (14 Tage)
              </button>
              <button className="cta-secondary" onClick={() => navigate('/demo')}>
                <span className="cta-icon">📺</span>
                Demo ansehen
              </button>
            </div>
            <div className="hero-benefits">
              <div className="benefit">✓ Keine Kreditkarte nötig</div>
              <div className="benefit">✓ In 5 Minuten startklar</div>
            </div>
          </div>
          <div className="hero-image">
            <div className="hero-logo-container">
              <img src={dojoLogo} alt="DojoSoftware Logo" className="hero-logo" />
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Mockup Section - Full Width */}
      <section className="mockup-section">
        <div className="container">
          <div className="dashboard-mockup">
            <div className="mockup-header">
              <div className="mockup-dot"></div>
              <div className="mockup-dot"></div>
              <div className="mockup-dot"></div>
            </div>
            <div className="mockup-content">
              <div className="mockup-sidebar">
                <div className="sidebar-content">
                  <div className="sidebar-title">WARUM</div>
                  <div className="sidebar-arrow">→</div>
                  <div className="sidebar-title">DARUM</div>
                  <div className="sidebar-subtitle">Die Lösung für mehr Zeit & weniger Arbeit</div>
                </div>
              </div>
              <div className="mockup-main">
                <div className="mockup-card">
                  <div className="mockup-card-icon">📝</div>
                  <div className="mockup-card-content">
                    <h4>Online-Registrierung</h4>
                    <p>Mitglieder registrieren sich selbst online. Alles ist sofort im System verfügbar - Mitgliederzugang, Vertrag, alles automatisch angelegt.</p>
                  </div>
                </div>
                <div className="mockup-card">
                  <div className="mockup-card-icon">⚡</div>
                  <div className="mockup-card-content">
                    <h4>Keine Papierarbeit mehr</h4>
                    <p>Keine Zeitverschwendung durch manuelles Erfassen. Kein Papier, keine Akten - alles digital und sofort verfügbar.</p>
                  </div>
                </div>
                <div className="mockup-card">
                  <div className="mockup-card-icon">👤</div>
                  <div className="mockup-card-content">
                    <h4>Selbstverwaltung durch Mitglieder</h4>
                    <p>Mitglieder verwalten ihren Vertrag selbst: Ruhepause, Adress- und Kontoänderungen, Kündigung - alles online. <strong>Absolut kein Arbeitsaufwand mehr für dich.</strong></p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="social-proof">
        <div className="container">
          <p className="social-proof-text">
            Vertrauen von <strong>Kampfsportschulen</strong> auf der ganzen Welt
          </p>
          <div className="trust-badges">
            <div className="trust-badge"><span>🥋</span><span>Karate</span></div>
            <div className="trust-badge"><span>🥊</span><span>Kickboxen</span></div>
            <div className="trust-badge"><span>🤺</span><span>Taekwondo</span></div>
            <div className="trust-badge"><span>🤼</span><span>Judo</span></div>
            <div className="trust-badge"><span>🥋</span><span>BJJ</span></div>
            <div className="trust-badge"><span>👊</span><span>Kung Fu</span></div>
            <div className="trust-badge"><span>⚔️</span><span>MMA</span></div>
            <div className="trust-badge"><span>🛡️</span><span>ShieldX</span></div>
            <div className="trust-badge"><span>⚡</span><span>Krav Maga</span></div>
            <div className="trust-badge"><span>🥋</span><span>Hapkido</span></div>
            <div className="trust-badge"><span>⚡</span><span>und mehr...</span></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section" id="features">
        <div className="container">
          <h2 className="section-title">Alles was dein Dojo braucht</h2>
          <p className="section-subtitle">
            Eine komplette Lösung - von der Mitgliederverwaltung bis zur Buchführung
          </p>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Galerie */}
      <section className="testimonials-section" id="testimonials">
        <div className="container">
          <h2 className="section-title">Was unsere Kunden sagen</h2>
          <div className="testimonials-gallery">
            <div className="testimonial-slide active">
              <div className="testimonial-card">
                {testimonials[currentTestimonial].text && (
                  <>
                    <div className="testimonial-stars">
                      {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                        <span key={i} className="star">⭐</span>
                      ))}
                    </div>
                    <p className="testimonial-text">"{testimonials[currentTestimonial].text}"</p>
                    {testimonials[currentTestimonial].name && (
                      <div className="testimonial-author">
                        <strong>{testimonials[currentTestimonial].name}</strong>
                        {testimonials[currentTestimonial].dojo && (
                          <span>{testimonials[currentTestimonial].dojo}</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="testimonial-indicators">
              {testimonials.map((_, index) => {
                if (index < 2) return null; // Überspringe leere Testimonials
                return (
                  <button
                    key={index}
                    className={`indicator ${currentTestimonial === index ? 'active' : ''}`}
                    onClick={() => setCurrentTestimonial(index)}
                    aria-label={`Gehe zu Testimonial ${index + 1}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="pricing-preview">
        <div className="container">
          <h2 className="section-title">Transparent & Fair</h2>
          <p className="section-subtitle">
            Wähle den Plan der zu deinem Dojo passt
          </p>
          <div className="pricing-cards-preview">
            <div className="pricing-card-preview">
              <h3>Starter</h3>
              <div className="price">€49<span>/Monat</span></div>
              <p>Bis 100 Mitglieder</p>
            </div>
            <div className="pricing-card-preview featured">
              <div className="popular-badge">Beliebt</div>
              <h3>Professional</h3>
              <div className="price">€89<span>/Monat</span></div>
              <p>Bis 300 Mitglieder</p>
            </div>
            <div className="pricing-card-preview">
              <h3>Premium</h3>
              <div className="price">€149<span>/Monat</span></div>
              <p>Unbegrenzt Mitglieder</p>
            </div>
          </div>
          <button className="cta-secondary" onClick={() => navigate('/pricing')}>
            Alle Preise & Features ansehen
          </button>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section">
        <div className="container">
          <h2 className="section-title">Häufig gestellte Fragen</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h3>Wie funktioniert der 14-Tage-Test?</h3>
              <p>Registriere dich kostenlos und teste alle Features 14 Tage lang. Keine Kreditkarte erforderlich.</p>
            </div>
            <div className="faq-item">
              <h3>Kann ich jederzeit kündigen?</h3>
              <p>Ja, du kannst monatlich kündigen. Keine Mindestlaufzeit, keine versteckten Kosten.</p>
            </div>
            <div className="faq-item">
              <h3>Sind meine Daten sicher (DSGVO)?</h3>
              <p>Ja, alle Daten werden verschlüsselt auf deutschen Servern gespeichert. 100% DSGVO-konform.</p>
            </div>
            <div className="faq-item">
              <h3>Funktioniert es für mehrere Standorte?</h3>
              <p>Ja, mit dem Enterprise-Plan kannst du mehrere Dojos zentral verwalten mit einem Account. Getrennte oder gemeinsame Ansicht und Auswertung.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="final-cta">
        <div className="container">
          <h2>Bereit dein Dojo zu digitalisieren?</h2>
          <p>Starte jetzt - komplett kostenlos</p>
          <button className="cta-primary large" onClick={() => navigate('/register')}>
            <span className="cta-icon">🚀</span>
            Jetzt 14 Tage gratis testen
          </button>
          <p className="cta-note">Keine Kreditkarte nötig</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-col">
              <h4>Produkt</h4>
              <a href="#features">Features</a>
              <a href="/pricing">Preise</a>
              <a href="/demo">Demo</a>
            </div>
            <div className="footer-col">
              <h4>Unternehmen</h4>
              <a href="/about">Über uns</a>
              <a href="/contact">Kontakt</a>
              <a href="/impressum">Impressum</a>
            </div>
            <div className="footer-col">
              <h4>Support</h4>
              <a href="/help">Hilfe-Center</a>
              <a href="/login">Login</a>
              <a href="mailto:support@dojo.tda-intl.org">Email Support</a>
            </div>
            <div className="footer-col">
              <h4>Rechtliches</h4>
              <a href="/datenschutz">Datenschutz</a>
              <a href="/agb">AGB</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 DojoSoftware by TDA International • Alle Rechte vorbehalten</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
