import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../config/config.js';
import '../styles/themes.css';
import './PricingPage.css';
import SEO from '../components/SEO';
import PublicFooter from '../components/PublicFooter';

const dojoLogo = '/dojo-logo.png';

function PricingPage() {
  const navigate = useNavigate();
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [plans, setPlans] = useState([]);
  const [allFeatures, setAllFeatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      // Lade Pläne mit Features aus der Datenbank
      const response = await fetch(`${config.apiBaseUrl}/subscription/plans-with-features`);
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
        setAllFeatures(data.all_features || []);
      } else {
        // Fallback auf alten Endpoint
        const fallbackResponse = await fetch(`${config.apiBaseUrl}/onboarding/plans`);
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          setPlans(fallbackData.plans || []);
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Pläne:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPrice = (plan) => {
    return billingInterval === "yearly" ? (plan.price_yearly || 0) : (plan.price_monthly || 0);
  };

  const getSavings = (plan) => {
    const monthlyTotal = (plan.price_monthly || 0) * 12;
    const yearlySavings = monthlyTotal - (plan.price_yearly || 0);
    return yearlySavings;
  };

  const handleSelectPlan = (planName) => {
    navigate('/register', { state: { selectedPlan: planName, billingInterval } });
  };

  // Alle Features mit included/not-included für eine Card
  const getPlanFeatureRows = (plan) => {
    if (!plan.features || plan.features.length === 0) return [];
    return plan.features.map(f => ({
      name: f.feature_name,
      icon: f.feature_icon,
      included: !!f.included,
      category: f.feature_category,
    }));
  };

  // Plan-Limits als Badge-Daten
  const getPlanLimits = (plan) => {
    const limits = [];
    if (plan.max_members >= 999999) {
      limits.push({ label: 'Unbegrenzt Mitglieder', highlight: true });
    } else {
      limits.push({ label: `Bis ${plan.max_members} Mitglieder`, highlight: false });
    }
    if (plan.max_dojos > 1) {
      limits.push({ label: `Bis zu ${plan.max_dojos} Dojos`, highlight: true });
    } else {
      limits.push({ label: '1 Standort', highlight: false });
    }
    const storageGB = plan.storage_limit_mb >= 1000
      ? `${Math.round(plan.storage_limit_mb / 1000)} GB`
      : `${plan.storage_limit_mb} MB`;
    limits.push({ label: `${storageGB} Speicher`, highlight: false });
    return limits;
  };

  if (loading) {
    return <div className="pricing-loading">Lade Preise...</div>;
  }

  return (
    <div className="pricing-page">
      <SEO
        title="Preise & Pakete – DojoSoftware"
        description="DojoSoftware Preise: Flexible Pakete für Kampfsportschulen jeder Größe. Starter, Professional und Enterprise – inklusive 14 Tage kostenloser Testphase ohne Kreditkarte."
        keywords="DojoSoftware Preise, Kampfsportschule Software Kosten, Dojo Verwaltung Preis, Vereinssoftware Pakete, TDA Systems Pricing"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'DojoSoftware', item: 'https://dojo.tda-intl.org/' },
            { '@type': 'ListItem', position: 2, name: 'Preise', item: 'https://dojo.tda-intl.org/pricing' },
          ],
        }}
      />
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

                {/* Limits-Badges */}
                <div className="plan-limits">
                  {getPlanLimits(plan).map((l, i) => (
                    <span key={i} className={`limit-badge ${l.highlight ? 'limit-badge--highlight' : ''}`}>
                      {l.label}
                    </span>
                  ))}
                </div>

                <div className="card-price">
                  <div className="price-amount">
                    €{(Number(getPrice(plan)) || 0).toFixed(0)}
                    <span className="price-period">/{billingInterval === 'yearly' ? 'Jahr' : 'Monat'}</span>
                  </div>
                  {billingInterval === 'yearly' && (
                    <div className="price-savings">
                      Spare €{(Number(getSavings(plan)) || 0).toFixed(0)} pro Jahr
                    </div>
                  )}
                  {billingInterval === 'monthly' && plan.max_members < 999999 && (
                    <div className="price-note">
                      ca. €{(Number(getPrice(plan)) / (Number(plan.max_members) || 1)).toFixed(2)} pro Mitglied
                    </div>
                  )}
                </div>

                <button
                  className="select-plan-btn"
                  onClick={() => handleSelectPlan(plan.plan_name)}
                >
                  Jetzt starten
                </button>

                <div className="card-features">
                  <ul>
                    {getPlanFeatureRows(plan).map((f, index) => (
                      <li key={index} className={f.included ? 'feature-included' : 'feature-excluded'}>
                        <span className={f.included ? 'feature-check' : 'feature-dash'}>
                          {f.included ? '✓' : '—'}
                        </span>
                        <span className="feature-icon-label">{f.icon}</span>
                        {f.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table - Dynamisch aus Datenbank */}
      <section className="feature-comparison">
        <div className="container">
          <h2>Detaillierter Feature-Vergleich</h2>
          <div className="comparison-table">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  {plans.map(plan => (
                    <th key={plan.plan_name}>{plan.display_name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Maximale Mitglieder */}
                <tr>
                  <td>Maximale Mitglieder</td>
                  {plans.map(plan => (
                    <td key={plan.plan_name}>
                      {plan.max_members >= 999999 ? 'Unbegrenzt' : plan.max_members}
                    </td>
                  ))}
                </tr>
                {/* Anzahl Dojos */}
                <tr>
                  <td>Anzahl Dojos</td>
                  {plans.map(plan => (
                    <td key={plan.plan_name}>{plan.max_dojos || 1}</td>
                  ))}
                </tr>
                {/* Dokumentenspeicher */}
                <tr>
                  <td>Dokumentenspeicher</td>
                  {plans.map(plan => (
                    <td key={plan.plan_name}>
                      {plan.storage_limit_mb >= 1000
                        ? `${Math.round(plan.storage_limit_mb / 1000)} GB`
                        : `${plan.storage_limit_mb} MB`}
                    </td>
                  ))}
                </tr>
                {/* Dynamische Features aus Datenbank */}
                {allFeatures.map(feature => (
                  <tr key={feature.feature_id}>
                    <td>
                      <span className="feature-icon">{feature.feature_icon}</span>
                      {feature.feature_name}
                    </td>
                    {plans.map(plan => {
                      const planFeature = plan.features?.find(f => f.feature_id === feature.feature_id);
                      const isIncluded = planFeature?.included;
                      return (
                        <td key={plan.plan_name} className={isIncluded ? 'included' : 'not-included'}>
                          {isIncluded ? '✓' : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
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
