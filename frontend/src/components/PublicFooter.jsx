import React from 'react';
import '../styles/PublicFooter.css';

function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-col">
            <h4>Produkt</h4>
            <a href="/#features">Features</a>
            <a href="/pricing">Preise</a>
            <a href="/galerie">Galerie</a>
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
  );
}

export default PublicFooter;

