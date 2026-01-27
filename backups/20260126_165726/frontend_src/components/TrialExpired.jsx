import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, Mail, Phone, CheckCircle } from 'lucide-react';
import '../styles/TrialExpired.css';
import logo from '../assets/dojo-logo.png';

const TrialExpired = ({ trialInfo }) => {
  const [daysExpired, setDaysExpired] = useState(0);

  useEffect(() => {
    if (trialInfo?.trial_ends_at) {
      const endDate = new Date(trialInfo.trial_ends_at);
      const today = new Date();
      const diff = Math.floor((today - endDate) / (1000 * 60 * 60 * 24));
      setDaysExpired(diff);
    }
  }, [trialInfo]);

  return (
    <div className="trial-expired-container">
      <div className="trial-expired-content">
        {/* Logo */}
        <div className="trial-expired-logo">
          <img src={logo} alt="DojoSoftware Logo" />
        </div>

        {/* Icon */}
        <div className="trial-expired-icon">
          <AlertCircle size={64} />
        </div>

        {/* Heading */}
        <h1 className="trial-expired-title">Testphase abgelaufen</h1>

        {/* Message */}
        <div className="trial-expired-message">
          <p>
            Die 14-tägige Testphase für <strong>{trialInfo?.dojoname || 'Ihr Dojo'}</strong> ist
            {daysExpired > 0 && <> vor {daysExpired} {daysExpired === 1 ? 'Tag' : 'Tagen'}</>} abgelaufen.
          </p>
          <p>
            Um weiterhin Zugriff auf DojoSoftware zu haben, schließen Sie bitte ein Abonnement ab.
          </p>
        </div>

        {/* Features */}
        <div className="trial-expired-features">
          <h3>Mit DojoSoftware profitieren Sie von:</h3>
          <ul>
            <li>
              <CheckCircle size={20} />
              <span>Vollständige Mitgliederverwaltung</span>
            </li>
            <li>
              <CheckCircle size={20} />
              <span>Automatische Beitragsabrechnung</span>
            </li>
            <li>
              <CheckCircle size={20} />
              <span>Check-in System</span>
            </li>
            <li>
              <CheckCircle size={20} />
              <span>Stundenplan & Kursverwaltung</span>
            </li>
            <li>
              <CheckCircle size={20} />
              <span>Rechnungserstellung & SEPA-Lastschriften</span>
            </li>
            <li>
              <CheckCircle size={20} />
              <span>Unbegrenzter Cloud-Speicher</span>
            </li>
          </ul>
        </div>

        {/* Pricing */}
        <div className="trial-expired-pricing">
          <h3>Preise</h3>
          <div className="pricing-options">
            <div className="pricing-card">
              <div className="pricing-header">
                <h4>Basic</h4>
                <div className="pricing-price">29€</div>
                <div className="pricing-period">pro Monat</div>
              </div>
              <ul className="pricing-features">
                <li>Bis 100 Mitglieder</li>
                <li>1 Administrator</li>
                <li>10 GB Speicher</li>
              </ul>
            </div>

            <div className="pricing-card featured">
              <div className="pricing-badge">Beliebt</div>
              <div className="pricing-header">
                <h4>Premium</h4>
                <div className="pricing-price">49€</div>
                <div className="pricing-period">pro Monat</div>
              </div>
              <ul className="pricing-features">
                <li>Unbegrenzte Mitglieder</li>
                <li>5 Administratoren</li>
                <li>50 GB Speicher</li>
                <li>Priority Support</li>
              </ul>
            </div>

            <div className="pricing-card">
              <div className="pricing-header">
                <h4>Enterprise</h4>
                <div className="pricing-price">99€</div>
                <div className="pricing-period">pro Monat</div>
              </div>
              <ul className="pricing-features">
                <li>Unbegrenzt alles</li>
                <li>Dedizierter Support</li>
                <li>Custom Features</li>
                <li>API-Zugang</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="trial-expired-contact">
          <h3>Jetzt Abonnement abschließen</h3>
          <p>Kontaktieren Sie uns, um Ihr Abonnement zu aktivieren:</p>

          <div className="contact-options">
            <a href="mailto:abo@tda-intl.org" className="contact-button">
              <Mail size={20} />
              <span>abo@tda-intl.org</span>
            </a>

            <a href="tel:+4940123456" className="contact-button">
              <Phone size={20} />
              <span>+49 40 123 456</span>
            </a>
          </div>

          <div className="contact-note">
            <Clock size={16} />
            <span>Nach Zahlungseingang wird Ihr Zugang innerhalb von 24 Stunden freigeschaltet.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="trial-expired-footer">
          <p>
            Haben Sie Fragen? Besuchen Sie unsere{' '}
            <a href="https://tda-intl.org/hilfe" target="_blank" rel="noopener noreferrer">
              Hilfe-Seite
            </a>
            {' '}oder kontaktieren Sie unseren Support.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrialExpired;
