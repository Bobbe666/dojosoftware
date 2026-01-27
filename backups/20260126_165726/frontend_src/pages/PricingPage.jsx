import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import config from '../config';
import { useForceDarkTheme } from '../context/ThemeContext';
import '../styles/themes.css';
import './PricingPage.css';
import dojoLogo from '../assets/dojo-logo.png';
import PublicFooter from '../components/PublicFooter';

function PricingPage() {
  const navigate = useNavigate();
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  // Erzwinge dunkles Theme
  useForceDarkTheme();

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const response = await axios.get(`/onboarding/plans`);
      setPlans(response.data.plans || []);
    } catch (error) {
      console.error('Fehler beim Laden der Pläne:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPrice = (plan) => {
    return billingInterval === 'yearly' ? plan.price_yearly : plan.price_monthly;
  };

  const getSavings = (plan) => {
    const monthlyTotal = plan.price_monthly * 12;
    const yearlySavings = monthlyTotal - plan.price_yearly;
    return yearlySavings;
  };

  const handleSelectPlan = (planName) => {
    navigate('/register', { state: { selectedPlan: planName, billingInterval } });
  };

  const planFeatures = {
    starter: [
      'Bis 100 aktive Mitglieder',
      'Mitgliederverwaltung',
      'Vertragsverwaltung',
      'SEPA-Lastschrift',
      'Anwesenheit & Check-In',
      'Prüfungsverwaltung',
      'Zehnerkarten',
      'Stundenplan & Kurse',
      'Basis-Statistiken',
      'Dokumentenverwaltung (1 GB)',
      'Email-Support (48h)'
    ],
    professional: [
      'Alles aus Starter +',
      'Bis 300 aktive Mitglieder',
      '✨ Verkauf & Lagerhaltung',
      '✨ Kassenmodul',
      '✨ Events-Verwaltung',
      'Erweiterte Reports',
      'Export-Funktionen',
      'Dokumentenspeicher (5 GB)',
      'Priority Support (24h)'
    ],
    premium: [
      'Alles aus Professional +',
      '⭐ Unbegrenzt Mitglieder',
      '⭐ Vollständige Buchführung',
      '⭐ Rechnungserstellung',
      '⭐ Mahnwesen',
      '⭐ Finanzcockpit',
      '⭐ API-Zugang',
      'DATEV-Export',
      'Dokumentenspeicher (20 GB)',
      'Premium Support (12h)',
      'Kostenlose Schulung'
    ],
    enterprise: [
      'Alles aus Premium +',
      '🚀 Bis zu 3 Dojos',
      '🚀 Multi-Dojo-Verwaltung',
      '🚀 Übergreifende Auswertungen',
      '🚀 White-Label-Option',
      'Unbegrenzte Mitglieder',
      'Dokumentenspeicher (50 GB)',
      'VIP-Support (4h)',
      'Dedizierter Ansprechpartner',
      'Strategy-Calls'
    ]
  };

  if (loading) {
    return <div className="pricing-loading">Lade Preise...</div>;
  }

  return (
    <div className="pricing-page">
      {/* Navigation */}
      <nav className="pricing-nav">
        <div className="nav-container">
          <div className="nav-logo" onClick={() => navigate('/')}>
            <img src={dojoLogo} alt="DojoSoftware Logo" className="nav-logo-image" />
            <span className="logo-text">DojoSoftware</span>
          </div>
          <div className="nav-links">
            <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Home</a>
            <a href="/#features">Features</a>
            <a href="/galerie">Galerie</a>
            <a href="/pricing">Preise</a>
            <a href="/#testimonials">Referenzen</a>
            <button className="nav-login-btn" onClick={() => navigate('/login')}>
              Login
            </button>
          </div>
        </div>
      </nav>

      {/* Header */}
      <section className="pricing-header">
        <h1>Transparent & Fair</h1>
        <p>Wähle den Plan der zu deinem Dojo passt</p>

        {/* Billing Toggle */}
        <div className="billing-toggle">
          <button
            className={billingInterval === 'monthly' ? 'active' : ''}
            onClick={() => setBillingInterval('monthly')}
          >
            Monatlich
          </button>
          <button
            className={billingInterval === 'yearly' ? 'active' : ''}
            onClick={() => setBillingInterval('yearly')}
          >
            Jährlich
            <span className="savings-badge">2 Monate gratis</span>
          </button>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pricing-cards">
        <div className="container">
          <div className="cards-grid">
            {plans.map((plan) => (
              <div
                key={plan.plan_name}
                className={`pricing-card ${plan.plan_name === 'professional' ? 'featured' : ''}`}
              >
                {plan.plan_name === 'professional' && (
                  <div className="popular-badge">⭐ Beliebt</div>
                )}

                <div className="card-header">
                  <h3>{plan.display_name}</h3>
                  <p className="card-description">{plan.description}</p>
                </div>

                <div className="card-price">
                  <div className="price-amount">
                    €{getPrice(plan).toFixed(0)}
                    <span className="price-period">/{billingInterval === 'yearly' ? 'Jahr' : 'Monat'}</span>
                  </div>
                  {billingInterval === 'yearly' && (
                    <div className="price-savings">
                      Spare €{getSavings(plan).toFixed(0)} pro Jahr
                    </div>
                  )}
                  {billingInterval === 'monthly' && plan.max_members < 999999 && (
                    <div className="price-note">
                      ca. €{(getPrice(plan) / plan.max_members).toFixed(2)} pro Mitglied
                    </div>
                  )}
                </div>

                <button
                  className="select-plan-btn"
                  onClick={() => handleSelectPlan(plan.plan_name)}
                >
                  Plan wählen
                </button>

                <div className="card-features">
                  <ul>
                    {planFeatures[plan.plan_name]?.map((feature, index) => (
                      <li key={index}>
                        <span className="feature-check">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="feature-comparison">
        <div className="container">
          <h2>Detaillierter Feature-Vergleich</h2>
          <div className="comparison-table">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Starter</th>
                  <th>Professional</th>
                  <th>Premium</th>
                  <th>Enterprise</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Maximale Mitglieder</td>
                  <td>100</td>
                  <td>300</td>
                  <td>Unbegrenzt</td>
                  <td>Unbegrenzt</td>
                </tr>
                <tr>
                  <td>Anzahl Dojos</td>
                  <td>1</td>
                  <td>1</td>
                  <td>1</td>
                  <td>3</td>
                </tr>
                <tr>
                  <td>Mitgliederverwaltung</td>
                  <td>✓</td>
                  <td>✓</td>
                  <td>✓</td>
                  <td>✓</td>
                </tr>
                <tr>
                  <td>SEPA-Lastschrift</td>
                  <td>✓</td>
                  <td>✓</td>
                  <td>✓</td>
                  <td>✓</td>
                </tr>
                <tr>
                  <td>Check-In System</td>
                  <td>✓</td>
                  <td>✓</td>
                  <td>✓</td>
                  <td>✓</td>
                </tr>
                <tr>
                  <td>Verkauf & Lager</td>
                  <td>—</td>
                  <td>✓</td>
                  <td>✓</td>
                  <td>✓</td>
                </tr>
                <tr>
                  <td>Events-Verwaltung</td>
                  <td>—</td>
                  <td>✓</td>
                  <td>✓</td>
                  <td>✓</td>
                </tr>
                <tr>
                  <td>Rechnungserstellung</td>
                  <td>—</td>
                  <td>—</td>
                  <td>✓</td>
                  <td>✓</td>
                </tr>
                <tr>
                  <td>Buchführung & Mahnwesen</td>
                  <td>—</td>
                  <td>—</td>
                  <td>✓</td>
                  <td>✓</td>
                </tr>
                <tr>
                  <td>API-Zugang</td>
                  <td>—</td>
                  <td>—</td>
                  <td>✓</td>
                  <td>✓</td>
                </tr>
                <tr>
                  <td>Multi-Dojo-Verwaltung</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>✓</td>
                </tr>
                <tr>
                  <td>Dokumentenspeicher</td>
                  <td>1 GB</td>
                  <td>5 GB</td>
                  <td>20 GB</td>
                  <td>50 GB</td>
                </tr>
                <tr>
                  <td>Support</td>
                  <td>Email (48h)</td>
                  <td>Priority (24h)</td>
                  <td>Premium (12h)</td>
                  <td>VIP (4h)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pricing-faq">
        <div className="container">
          <h2>Häufige Fragen zu den Preisen</h2>
          <div className="faq-grid">
            <div className="faq-item">
              <h3>💳 Welche Zahlungsmethoden akzeptiert ihr?</h3>
              <p>SEPA-Lastschrift, Rechnung und Kreditkarte. Bei Jahreszahlung bieten wir zusätzlich Rechnung an.</p>
            </div>
            <div className="faq-item">
              <h3>🔄 Kann ich meinen Plan später wechseln?</h3>
              <p>Ja, du kannst jederzeit upgraden oder downgraden. Upgrades gelten sofort, Downgrades zum nächsten Abrechnungszeitraum.</p>
            </div>
            <div className="faq-item">
              <h3>📊 Was passiert wenn ich das Mitgliederlimit überschreite?</h3>
              <p>Du wirst automatisch benachrichtigt und kannst auf einen höheren Plan upgraden. Keine versteckten Kosten.</p>
            </div>
            <div className="faq-item">
              <h3>🎓 Gibt es Rabatte für gemeinnützige Vereine?</h3>
              <p>Ja! Kontaktiere uns für spezielle Non-Profit-Preise.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pricing-cta">
        <div className="container">
          <h2>Bereit zu starten?</h2>
          <p>Teste jetzt 14 Tage kostenlos - keine Kreditkarte nötig</p>
          <button className="cta-btn" onClick={() => navigate('/register')}>
            Jetzt kostenlos testen
          </button>
        </div>
      </section>

      {/* Footer */}
      <PublicFooter />
    </div>
  );
}

export default PricingPage;
