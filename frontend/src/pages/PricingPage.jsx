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
  const [expandedCards, setExpandedCards] = useState({});

  useEffect(() => { loadPlans(); }, []);

  const loadPlans = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/subscription/plans-with-features`);
      if (response.ok) {
        const data = await response.json();
        setPlans(data.plans || []);
        setAllFeatures(data.all_features || []);
      } else {
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

  const getPrice = (plan) =>
    billingInterval === 'yearly' ? (plan.price_yearly || 0) : (plan.price_monthly || 0);

  const getSavings = (plan) =>
    (plan.price_monthly || 0) * 12 - (plan.price_yearly || 0);

  const handleSelectPlan = (planName) =>
    navigate('/register', { state: { selectedPlan: planName, billingInterval } });

  const getPlanFeatureRows = (plan) => {
    if (!plan.features || plan.features.length === 0) return [];
    return plan.features.map(f => ({
      name: f.feature_name,
      icon: f.feature_icon,
      included: !!f.included,
    }));
  };

  const getPlanLimits = (plan) => {
    const limits = [];
    if (plan.max_members >= 999999) {
      limits.push({ label: '∞ Mitglieder', gold: true });
    } else {
      limits.push({ label: `bis ${plan.max_members} Mitglieder`, gold: false });
    }
    if (plan.max_dojos > 1) {
      limits.push({ label: `${plan.max_dojos} Dojos`, gold: true });
    } else {
      limits.push({ label: '1 Standort', gold: false });
    }
    const storageGB = plan.storage_limit_mb >= 1000
      ? `${Math.round(plan.storage_limit_mb / 1000)} GB`
      : `${plan.storage_limit_mb} MB`;
    limits.push({ label: storageGB, gold: false });
    return limits;
  };

  const isFeatured = (plan) => plan.plan_name === 'professional';
  const isFree = (plan) => Number(plan.price_monthly) === 0;

  if (loading) return <div className="pp-loading">Lade Preise…</div>;

  return (
    <div className="pricing-page">
      <SEO
        title="Preise & Pakete – DojoSoftware"
        description="DojoSoftware Preise: Flexible Pakete für Kampfsportschulen jeder Größe. Starter, Professional und Enterprise – inklusive 14 Tage kostenloser Testphase ohne Kreditkarte."
        keywords="DojoSoftware Preise, Kampfsportschule Software Kosten, Dojo Verwaltung Preis, Vereinssoftware Pakete, TDA Systems Pricing"
      />

      {/* Nav */}
      <nav className="pp-nav">
        <div className="pp-nav-inner">
          <div className="pp-nav-logo" onClick={() => navigate('/')}>
            <img src={dojoLogo} alt="DojoSoftware" className="pp-nav-logo-img" />
            <span className="pp-nav-logo-text">DojoSoftware</span>
          </div>
          <div className="pp-nav-links">
            <a href="/" onClick={e => { e.preventDefault(); navigate('/'); }}>Home</a>
            <a href="/#features">Features</a>
            <a href="/galerie">Galerie</a>
            <a href="/pricing">Preise</a>
            <a href="/#testimonials">Referenzen</a>
          </div>
          <button className="pp-nav-login" onClick={() => navigate('/login')}>Login</button>
        </div>
      </nav>

      {/* Header */}
      <header className="pp-header">
        <div className="pp-section-tag">Preise</div>
        <h1 className="pp-header-title">Transparent & Fair</h1>
        <p className="pp-header-sub">Wähle den Plan der zu deinem Dojo passt</p>

        <div className="pp-billing-toggle">
          <button
            className={billingInterval === 'monthly' ? 'active' : ''}
            onClick={() => setBillingInterval('monthly')}
          >Monatlich</button>
          <button
            className={billingInterval === 'yearly' ? 'active' : ''}
            onClick={() => setBillingInterval('yearly')}
          >
            Jährlich
            <span className="pp-savings-pill">2 Monate gratis</span>
          </button>
        </div>
      </header>

      {/* Cards */}
      <section className="pp-cards-section">
        <div className="pp-container">
          <div className="pp-cards-grid">
            {plans.map(plan => {
              const rows = getPlanFeatureRows(plan);
              const isExpanded = !!expandedCards[plan.plan_name];
              const price = Number(getPrice(plan));
              const includedCount = rows.filter(r => r.included).length;

              return (
                <div
                  key={plan.plan_name}
                  className={`pp-card${isFeatured(plan) ? ' pp-card--featured' : ''}${isFree(plan) ? ' pp-card--free' : ''}`}
                >
                  {isFeatured(plan) && <div className="pp-card-badge">Beliebt</div>}

                  <div className="pp-card-top">
                    <div className="pp-card-name">{plan.display_name}</div>
                    <div className="pp-card-desc">{plan.description}</div>
                  </div>

                  <div className="pp-card-price">
                    <span className="pp-price-num">€{price.toFixed(0)}</span>
                    <span className="pp-price-period">
                      /{billingInterval === 'yearly' ? 'Jahr' : 'Monat'}
                    </span>
                  </div>

                  {billingInterval === 'yearly' && getSavings(plan) > 0 && (
                    <div className="pp-price-saving">Spare €{getSavings(plan).toFixed(0)} / Jahr</div>
                  )}

                  <div className="pp-card-limits">
                    {getPlanLimits(plan).map((l, i) => (
                      <span key={i} className={`pp-limit-chip${l.gold ? ' pp-limit-chip--gold' : ''}`}>
                        {l.label}
                      </span>
                    ))}
                  </div>

                  <button
                    className={`pp-card-cta${isFeatured(plan) ? ' pp-card-cta--gold' : ''}`}
                    onClick={() => handleSelectPlan(plan.plan_name)}
                  >
                    {isFree(plan) ? 'Kostenlos starten' : 'Jetzt starten'}
                  </button>

                  {rows.length > 0 && (
                    <div className="pp-card-features">
                      <button
                        className="pp-features-toggle"
                        onClick={() => setExpandedCards(prev => ({ ...prev, [plan.plan_name]: !prev[plan.plan_name] }))}
                      >
                        {isExpanded
                          ? 'Weniger anzeigen ▲'
                          : `${includedCount} enthaltene Features ▼`}
                      </button>

                      {isExpanded && (
                        <ul className="pp-feature-list">
                          {rows.filter(r => r.included).map((f, i) => (
                            <li key={i} className="pp-feature-item">
                              <span className="pp-feature-check">✓</span>
                              <span className="pp-feature-icon">{f.icon}</span>
                              <span>{f.name}</span>
                            </li>
                          ))}
                          {rows.filter(r => !r.included).map((f, i) => (
                            <li key={`x${i}`} className="pp-feature-item pp-feature-item--off">
                              <span className="pp-feature-dash">—</span>
                              <span className="pp-feature-icon">{f.icon}</span>
                              <span>{f.name}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      {allFeatures.length > 0 && (
        <section className="pp-compare">
          <div className="pp-container">
            <h2 className="pp-section-title">Feature-Vergleich</h2>
            <div className="pp-table-wrap">
              <table className="pp-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    {plans.map(p => <th key={p.plan_name}>{p.display_name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Max. Mitglieder</td>
                    {plans.map(p => (
                      <td key={p.plan_name}>{p.max_members >= 999999 ? '∞' : p.max_members}</td>
                    ))}
                  </tr>
                  <tr>
                    <td>Standorte</td>
                    {plans.map(p => <td key={p.plan_name}>{p.max_dojos || 1}</td>)}
                  </tr>
                  <tr>
                    <td>Speicher</td>
                    {plans.map(p => (
                      <td key={p.plan_name}>
                        {p.storage_limit_mb >= 1000
                          ? `${Math.round(p.storage_limit_mb / 1000)} GB`
                          : `${p.storage_limit_mb} MB`}
                      </td>
                    ))}
                  </tr>
                  {allFeatures.map(feature => (
                    <tr key={feature.feature_id}>
                      <td>
                        <span className="pp-table-icon">{feature.feature_icon}</span>
                        {feature.feature_name}
                      </td>
                      {plans.map(p => {
                        const pf = p.features?.find(f => f.feature_id === feature.feature_id);
                        return (
                          <td key={p.plan_name} className={pf?.included ? 'pp-td-yes' : 'pp-td-no'}>
                            {pf?.included ? '✓' : '—'}
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
      )}

      {/* FAQ */}
      <section className="pp-faq">
        <div className="pp-container">
          <h2 className="pp-section-title">Häufige Fragen</h2>
          <div className="pp-faq-grid">
            {[
              { q: 'Welche Zahlungsmethoden?', a: 'SEPA-Lastschrift, Rechnung und Kreditkarte. Bei Jahreszahlung zusätzlich per Überweisung.' },
              { q: 'Plan später wechseln?', a: 'Ja, jederzeit upgraden oder downgraden. Upgrades gelten sofort, Downgrades zum nächsten Abrechnungszeitraum.' },
              { q: 'Mitgliederlimit überschritten?', a: 'Du wirst automatisch benachrichtigt und kannst auf einen höheren Plan upgraden. Keine versteckten Kosten.' },
              { q: 'Rabatte für Vereine?', a: 'Ja! Kontaktiere uns für spezielle Non-Profit-Preise. Wir unterstützen gemeinnützige Dojos.' },
            ].map((f, i) => (
              <div key={i} className="pp-faq-item">
                <div className="pp-faq-q">{f.q}</div>
                <div className="pp-faq-a">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="pp-cta">
        <div className="pp-container">
          <h2 className="pp-cta-title">Bereit dein Dojo zu digitalisieren?</h2>
          <p className="pp-cta-sub">14 Tage kostenlos testen — keine Kreditkarte nötig</p>
          <button className="pp-cta-btn" onClick={() => navigate('/register')}>
            Jetzt kostenlos starten
          </button>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

export default PricingPage;
