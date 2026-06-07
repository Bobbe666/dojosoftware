import React, { useState } from "react";
import PublicRegistration from "./PublicRegistration";
import PilotPopup from "./PilotPopup";
import "../styles/themes.css";
import "../styles/components.css";
import "../styles/Homepage.css";

const Homepage = () => {
  const [showRegistration, setShowRegistration] = useState(false);

  const openRegistration = () => {
    setShowRegistration(true);
  };

  const closeRegistration = () => {
    setShowRegistration(false);
  };

  return (
    <div className="homepage">
      <PilotPopup />
      <header className="homepage-header">
        <div className="container">
          <nav className="homepage-nav">
            <div className="logo">
              <h1>DojoSoftware</h1>
            </div>
            <div className="nav-links">
              <a href="/public-timetable">Stundenplan</a>
              <a href="/public-checkin">Check-In</a>
              <button className="register-btn" onClick={openRegistration}>
                Mitglied werden
              </button>
            </div>
          </nav>
        </div>
      </header>

      <main className="homepage-main">
        <section className="hero-section">
          <div className="container">
            <div className="hero-content">
              <h2>Willkommen in unserem Dojo</h2>
              <p>
                Entdecken Sie die Welt der Kampfkünste und werden Sie Teil unserer Gemeinschaft.
                Trainieren Sie mit erfahrenen Lehrern und erreichen Sie Ihre Ziele.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary" onClick={openRegistration}>
                  Jetzt Mitglied werden
                </button>
                <a href="/public-timetable" className="btn btn-secondary">
                  Stundenplan ansehen
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="features-section">
          <div className="container">
            <h3>Warum unser Dojo?</h3>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">🥋</div>
                <h4>Traditionelle Kampfkunst</h4>
                <p>Lernen Sie authentische Techniken von erfahrenen Meistern</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">👥</div>
                <h4>Starke Gemeinschaft</h4>
                <p>Trainieren Sie in einer unterstützenden und freundlichen Umgebung</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">📈</div>
                <h4>Persönliche Entwicklung</h4>
                <p>Verbessern Sie Fitness, Disziplin und Selbstvertrauen</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🏆</div>
                <h4>Graduierungssystem</h4>
                <p>Verfolgen Sie Ihren Fortschritt durch unser strukturiertes Gürtelsystem</p>
              </div>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <div className="container">
            <div className="cta-content">
              <h3>Bereit für den ersten Schritt?</h3>
              <p>
                Registrieren Sie sich jetzt und beginnen Sie Ihre Reise in die Welt der Kampfkünste.
                Unser mehrstufiger Anmeldeprozess ist einfach und sicher.
              </p>
              <button className="btn btn-primary btn-large" onClick={openRegistration}>
                Mitgliedschaft beantragen
              </button>
              <div className="registration-info">
                <p>
                  <strong>✓</strong> Sichere Online-Registrierung<br/>
                  <strong>✓</strong> Flexible Tarife und Zahlungsmöglichkeiten<br/>
                  <strong>✓</strong> Schnelle Bearbeitung Ihrer Anmeldung
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="homepage-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h4>Kontakt</h4>
              <p>Ihr Dojo<br/>
              Musterstraße 123<br/>
              12345 Musterstadt</p>
            </div>
            <div className="footer-section">
              <h4>Öffnungszeiten</h4>
              <p>Mo-Fr: 17:00 - 21:00<br/>
              Sa: 10:00 - 16:00<br/>
              So: 10:00 - 14:00</p>
            </div>
            <div className="footer-section">
              <h4>Links</h4>
              <a href="/public-timetable">Stundenplan</a><br/>
              <a href="/public-checkin">Check-In</a><br/>
              <button onClick={openRegistration} className="footer-link-btn">
                Mitglied werden
              </button>
            </div>
            <div className="footer-section">
              <h4>Rechtliches</h4>
              <a href="/agb">AGB</a><br/>
              <a href="/datenschutz">Datenschutz</a><br/>
              <a href="/impressum">Impressum</a>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 DojoSoftware. Alle Rechte vorbehalten.</p>
          </div>
        </div>
      </footer>

      {showRegistration && (
        <PublicRegistration onClose={closeRegistration} />
      )}
    </div>
  );
};

export default Homepage;