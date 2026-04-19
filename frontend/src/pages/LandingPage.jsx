import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../config/config.js';
import HeroSlider from '../components/HeroSlider';
import TDAIntroPopup from '../components/TDAIntroPopup';
import SEO from '../components/SEO';
import '../styles/themes.css';
import './LandingPage.css';
const dojoLogo = '/dojo-logo.png';

function LandingPage() {
  const navigate = useNavigate();

  // Intro Popup: einmalig pro Session
  const [showIntro, setShowIntro] = useState(() => !sessionStorage.getItem('tda-intro-shown'));
  const handleIntroComplete = () => {
    sessionStorage.setItem('tda-intro-shown', 'true');
    setShowIntro(false);
  };

  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Early Bird Promo State
  const [promoData, setPromoData] = useState(null);

  // Dynamische Features und Pricing aus der Datenbank
  const [features, setFeatures] = useState([]);
  const [pricingPlans, setPricingPlans] = useState([]);
  const [comparisonData, setComparisonData] = useState({ competitors: [], categories: [] });
  const [expandedCards, setExpandedCards] = useState({});
  const [loading, setLoading] = useState(true);

  // Fallback-Features falls API nicht erreichbar
  const fallbackFeatures = [
    { feature_icon: '👥', feature_name: 'Mitgliederverwaltung', feature_description: 'Verträge, Kündigungen, Dokumente, Familienverbund - alles an einem Ort' },
    { feature_icon: '🌐', feature_name: 'Online-Registrierung', feature_description: 'Selbstständige Anmeldung mit automatischer Vertragserstellung' },
    { feature_icon: '📱', feature_name: 'Mitglieder-Portal', feature_description: 'Self-Service: Adressänderung, Kündigung, Ruhepause - ohne deinen Aufwand' },
    { feature_icon: '✅', feature_name: 'Check-In System', feature_description: 'QR-Code basiertes Check-In mit Live-Display für dein Dojo' },
    { feature_icon: '💶', feature_name: 'SEPA & Finanzen', feature_description: 'Automatische Lastschriften, Rabattsystem, Mahnwesen' },
    { feature_icon: '🥋', feature_name: 'Prüfungswesen', feature_description: 'Gürtelprüfungen, historische Prüfungen, Lehrgänge & Ehrungen' },
    { feature_icon: '📄', feature_name: 'Vertragsverwaltung', feature_description: 'Automatische Verlängerung, Tarifwechsel, Rabatte, PDF-Export' },
    { feature_icon: '👨‍👩‍👧‍👦', feature_name: 'Familienverwaltung', feature_description: 'Familienrabatte, Erziehungsberechtigte, verknüpfte Konten' },
    { feature_icon: '📊', feature_name: 'Dashboard & Statistiken', feature_description: 'Echtzeit-Auswertungen, Einnahmen, Austritte, Anwesenheit' },
    { feature_icon: '📧', feature_name: 'Kommunikation', feature_description: 'E-Mail-Versand, Newsletter, Benachrichtigungen' },
    { feature_icon: '🔔', feature_name: 'Benachrichtigungen', feature_description: 'Automatische Erinnerungen, Zahlungseingänge, Kündigungen' },
    { feature_icon: '📁', feature_name: 'Dokumentenverwaltung', feature_description: 'Upload, Speicherung und Verwaltung aller Dokumente' },
    { feature_icon: '🔒', feature_name: 'Sicherheit & DSGVO', feature_description: 'Verschlüsselte Daten, deutsche Server, 100% DSGVO-konform' }
  ];

  const fallbackPricing = [
    { plan_name: 'basic', display_name: 'Basic', price_monthly: '29.00', max_members: 50, features: { mitgliederverwaltung: true, checkin: true, online_registration: true, member_portal: false, sepa: false, pruefungen: false, verkauf: false, events: false, buchfuehrung: false, api: false, multidojo: false, priority_support: false } },
    { plan_name: 'starter', display_name: 'Starter', price_monthly: '49.00', max_members: 100, features: { mitgliederverwaltung: true, checkin: true, online_registration: true, member_portal: true, sepa: true, pruefungen: true, verkauf: false, events: false, buchfuehrung: false, api: false, multidojo: false, priority_support: false } },
    { plan_name: 'professional', display_name: 'Professional', price_monthly: '89.00', max_members: 300, features: { mitgliederverwaltung: true, checkin: true, online_registration: true, member_portal: true, sepa: true, pruefungen: true, verkauf: true, events: true, buchfuehrung: false, api: false, multidojo: false, priority_support: false } },
    { plan_name: 'premium', display_name: 'Premium', price_monthly: '149.00', max_members: 999999, features: { mitgliederverwaltung: true, checkin: true, online_registration: true, member_portal: true, sepa: true, pruefungen: true, verkauf: true, events: true, buchfuehrung: true, api: true, multidojo: false, priority_support: true } },
    { plan_name: 'enterprise', display_name: 'Enterprise', price_monthly: '249.00', max_members: 999999, features: { mitgliederverwaltung: true, checkin: true, online_registration: true, member_portal: true, sepa: true, pruefungen: true, verkauf: true, events: true, buchfuehrung: true, api: true, multidojo: true, priority_support: true } }
  ];

  // Feature-Matrix Labels (wird dynamisch aus API geladen oder Fallback verwendet)
  const fallbackFeatureMatrix = [
    { key: 'mitgliederverwaltung', label: 'Mitgliederverwaltung' },
    { key: 'checkin', label: 'Check-In System' },
    { key: 'online_registration', label: 'Online-Registrierung' },
    { key: 'member_portal', label: 'Mitglieder-Portal' },
    { key: 'sepa', label: 'SEPA-Lastschriften' },
    { key: 'pruefungen', label: 'Prüfungswesen' },
    { key: 'verkauf', label: 'Verkauf & Kasse' },
    { key: 'events', label: 'Events & Turniere' },
    { key: 'buchfuehrung', label: 'Buchführung & EÜR' },
    { key: 'api', label: 'API-Zugang' },
    { key: 'multidojo', label: 'Multi-Dojo' },
    { key: 'priority_support', label: 'Prioritäts-Support' }
  ];

  const [featureMatrix, setFeatureMatrix] = useState(fallbackFeatureMatrix);

  // Early Bird Promo laden
  useEffect(() => {
    const loadPromoData = async () => {
      try {
        const res = await fetch(`${config.apiBaseUrl}/promo/early-bird`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.promo && data.promo.active) {
            setPromoData(data.promo);
          }
        }
      } catch (err) {
        console.error('Fehler beim Laden der Promo-Daten:', err);
      }
    };
    loadPromoData();
  }, []);

  useEffect(() => {
    const loadDynamicData = async () => {
      try {
        // Features, Pricing und Comparison parallel laden
        const [featuresRes, pricingRes, comparisonRes] = await Promise.all([
          fetch(`${config.apiBaseUrl}/subscription/landing-features`),
          fetch(`${config.apiBaseUrl}/subscription/pricing-preview`),
          fetch(`${config.apiBaseUrl}/subscription/comparison`)
        ]);

        if (featuresRes.ok) {
          const featuresData = await featuresRes.json();
          setFeatures(featuresData.features || fallbackFeatures);
        } else {
          setFeatures(fallbackFeatures);
        }

        if (pricingRes.ok) {
          const pricingData = await pricingRes.json();
          setPricingPlans(pricingData.plans || fallbackPricing);
          if (pricingData.featureMatrix) {
            setFeatureMatrix(pricingData.featureMatrix);
          }
        } else {
          setPricingPlans(fallbackPricing);
        }

        if (comparisonRes.ok) {
          const comparisonDataJson = await comparisonRes.json();
          const cats = comparisonDataJson.categories || [];
          setComparisonData({
            competitors: comparisonDataJson.competitors || [],
            categories: cats
          });
          const initialExpanded = {};
          let expandedFirst = false;
          cats.forEach(cat => {
            if (cat.is_highlight && !expandedFirst) {
              initialExpanded[cat.id] = true;
              expandedFirst = true;
            }
          });
          setExpandedCards(initialExpanded);
        }
      } catch (error) {
        console.error('Fehler beim Laden der dynamischen Daten:', error);
        setFeatures(fallbackFeatures);
        setPricingPlans(fallbackPricing);
      } finally {
        setLoading(false);
      }
    };

    loadDynamicData();
  }, []);

  const toggleCard = (id) => {
    setExpandedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Helper function für Rating-Emojis
  const getRatingEmoji = (rating) => {
    switch (rating) {
      case 'full': return '✅';
      case 'partial': return '⚠️';
      default: return '❌';
    }
  };

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
      <SEO
        title="DojoSoftware – Die Verwaltungssoftware für Kampfsportschulen"
        description="DojoSoftware: All-in-One Verwaltungssoftware für Kampfsportschulen und Dojos. Mitgliederverwaltung, SEPA-Lastschriften, Stundenplan, Check-In, Prüfungswesen & Online-Registrierung. 14 Tage kostenlos testen!"
        keywords="DojoSoftware, Kampfsportschule Software, Dojo Verwaltung, Mitgliederverwaltung Kampfsport, SEPA Lastschrift, Karate Software, Kickboxen Software, BJJ Verwaltung, TDA Systems"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            { '@type': 'Question', name: 'Für wen ist DojoSoftware geeignet?', acceptedAnswer: { '@type': 'Answer', text: 'DojoSoftware ist für alle Kampfsportschulen, Dojos und Vereine geeignet – unabhängig von Größe und Disziplin. Von Karate über Kickboxen bis BJJ und MMA.' } },
            { '@type': 'Question', name: 'Gibt es eine kostenlose Testphase?', acceptedAnswer: { '@type': 'Answer', text: 'Ja, DojoSoftware kann 14 Tage kostenlos und ohne Kreditkarte getestet werden. Einfach registrieren und loslegen.' } },
            { '@type': 'Question', name: 'Welche Zahlungsmethoden werden unterstützt?', acceptedAnswer: { '@type': 'Answer', text: 'DojoSoftware unterstützt SEPA-Lastschriften mit automatischem Einzug, Mandatsverwaltung und Mahnwesen. Außerdem Bar, Überweisung und PayPal.' } },
            { '@type': 'Question', name: 'Kann ich die Software auf mehreren Geräten nutzen?', acceptedAnswer: { '@type': 'Answer', text: 'Ja, DojoSoftware ist vollständig webbasiert und auf allen Geräten nutzbar – PC, Tablet und Smartphone. Es ist keine Installation erforderlich.' } },
          ],
        }}
      />
      {/* TDA Systems Intro - einmalig pro Session */}
      {showIntro && <TDAIntroPopup onComplete={handleIntroComplete} />}

      {/* Early Bird Promo Banner - VOR der Navigation */}
      {promoData && promoData.active && promoData.spotsRemaining > 0 && (
        <div className="landing-promo-banner" onClick={() => navigate('/register')}>
          <div className="promo-banner-content">
            <div className="promo-badge-small">
              <span>⭐</span> EARLY BIRD
            </div>
            <div className="promo-text">
              <strong>{promoData.freeMonths} Monate GRATIS</strong> + <strong>{promoData.discountPercent}% Rabatt</strong> für {promoData.discountMonths} Monate
              <span className="promo-spots">• Noch <strong>{promoData.spotsRemaining}</strong> von {promoData.maxDojos} Plätzen!</span>
            </div>
            <div className="promo-cta-small">
              Jetzt sichern →
            </div>
          </div>
        </div>
      )}

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
            <div className="hero-eyebrow">Entwickelt von einem 17-fachen Weltmeister</div>
            <h1 className="hero-title">
              Mehr Mitglieder.<br />
              Weniger Chaos.<br />
              <span className="hero-highlight">Volle Kontrolle.</span>
            </h1>
            <p className="hero-subtitle">
              Die Software, die dein Dojo organisiert — während du trainierst.
              Kein generisches Vereinstool. Gebaut für Kampfsport. Aus der Praxis.
            </p>
            <div className="hero-cta">
              <button className="cta-primary cta-pulse" onClick={() => navigate('/register')}>
                Jetzt kostenlos testen (14 Tage)
              </button>
              <button className="cta-demo-book" onClick={() => navigate('/demo-buchen')}>
                Demo-Termin buchen
              </button>
            </div>
            <div className="hero-benefits">
              <div className="benefit">✓ Keine Kreditkarte nötig</div>
              <div className="benefit">✓ In 5 Minuten startklar</div>
              <div className="benefit">✓ Kein Vertrag — jederzeit kündbar</div>
            </div>
          </div>
          <div className="hero-image">
            <div className="hero-logo-container">
              <img src={dojoLogo} alt="DojoSoftware Logo" className="hero-logo" />
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="trust-badges-bar">
          <div className="trust-badge-item">
            <span className="trust-icon">🔒</span>
            <span className="trust-text">SSL-verschlüsselt</span>
          </div>
          <div className="trust-badge-item">
            <span className="trust-icon">🇩🇪</span>
            <span className="trust-text">Deutsche Server</span>
          </div>
          <div className="trust-badge-item">
            <span className="trust-icon">✓</span>
            <span className="trust-text">DSGVO-konform</span>
          </div>
          <div className="trust-badge-item">
            <span className="trust-icon">🛡️</span>
            <span className="trust-text">Made in Germany</span>
          </div>
          <div className="trust-badge-item">
            <span className="trust-icon">💳</span>
            <span className="trust-text">Keine Kreditkarte</span>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="problem-section">
        <div className="container">
          <div className="problem-headline-wrap">
            <h2 className="problem-headline">Kennst du das?</h2>
            <p className="problem-subline">Jedes Dojo, das wächst, kennt diese Momente.</p>
          </div>
          <div className="problem-grid">
            <div className="problem-card">
              <span className="problem-icon">❌</span>
              <p>Mitgliederlisten verteilt auf Excel, WhatsApp und Papier</p>
            </div>
            <div className="problem-card">
              <span className="problem-icon">❌</span>
              <p>Beiträge werden vergessen — du verlierst Geld, ohne es zu merken</p>
            </div>
            <div className="problem-card">
              <span className="problem-icon">❌</span>
              <p>Chaos bei Turnieren: Anmeldungen, Listen, Einteilung — alles manuell</p>
            </div>
            <div className="problem-card">
              <span className="problem-icon">❌</span>
              <p>Trainer verlieren den Überblick, wenn das Dojo wächst</p>
            </div>
            <div className="problem-card">
              <span className="problem-icon">❌</span>
              <p>Stunden verloren durch Verwaltung statt Training</p>
            </div>
            <div className="problem-card">
              <span className="problem-icon">❌</span>
              <p>Dein Dojo wächst — aber dein System nicht</p>
            </div>
          </div>
          <div className="problem-conclusion">
            <p>Das kostet dich Zeit, Geld — und bremst dein Wachstum.</p>
            <button className="cta-primary" onClick={() => navigate('/register')}>
              Ich will das ändern
            </button>
          </div>
        </div>
      </section>

      {/* Authority Section */}
      <section className="authority-section">
        <div className="container">
          <div className="authority-content">
            <div className="authority-badge-wrap">
              <div className="authority-badge">
                <span className="authority-number">17×</span>
                <span className="authority-label">Weltmeister</span>
              </div>
            </div>
            <div className="authority-text">
              <h2>Nicht von Entwicklern gebaut — sondern von jemandem, der selbst auf der Matte steht.</h2>
              <p>
                Ich habe als Trainer selbst erlebt, wie schnell ein Dojo im Chaos versinkt, wenn es wächst.
                Stundenlange Verwaltung statt Training. Mitglieder, die vergessen werden. Turniere ohne System.
              </p>
              <p>
                Genau deshalb habe ich DojoSoftware entwickelt — eine Lösung aus der Praxis,
                für die Praxis. Nicht für Vereine im Allgemeinen. Speziell für Kampfsport.
              </p>
              <div className="authority-quote">
                „Damit du dich auf das konzentrieren kannst, was wirklich zählt: dein Training und deine Schüler."
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transformation Section */}
      <section className="transformation-section">
        <div className="container">
          <h2 className="section-title">Von Chaos zu Kontrolle</h2>
          <p className="section-subtitle">Was sich ändert, wenn dein Dojo ein echtes System hat</p>
          <div className="transformation-table">
            <div className="transform-col transform-col--before">
              <div className="transform-col-header">
                <span className="transform-icon">❌</span> Ohne DojoSoftware
              </div>
              <div className="transform-item">Mitglieder unübersichtlich verteilt</div>
              <div className="transform-item">Beiträge gehen verloren</div>
              <div className="transform-item">Stundenlange Zettelwirtschaft</div>
              <div className="transform-item">Turnierchaos</div>
              <div className="transform-item">Bauchgefühl statt Zahlen</div>
              <div className="transform-item">Wachstum bremst sich selbst</div>
            </div>
            <div className="transform-arrow-col">→</div>
            <div className="transform-col transform-col--after">
              <div className="transform-col-header">
                <span className="transform-icon">✅</span> Mit DojoSoftware
              </div>
              <div className="transform-item">Alles an einem Ort — sofort abrufbar</div>
              <div className="transform-item">Automatische Lastschriften & Mahnungen</div>
              <div className="transform-item">Alles läuft — während du trainierst</div>
              <div className="transform-item">Turniere in Minuten organisiert</div>
              <div className="transform-item">Klare Zahlen & Auswertungen</div>
              <div className="transform-item">Skalierbar ohne Stress</div>
            </div>
          </div>
          <div className="transformation-cta">
            <button className="cta-primary cta-pulse" onClick={() => navigate('/register')}>
              Starte jetzt — 14 Tage kostenlos
            </button>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="story-section">
        <div className="container">
          <div className="story-card">
            <div className="story-quote-mark">"</div>
            <p className="story-text">
              Ein Trainer mit über 80 Mitgliedern verlor jede Woche mehrere Stunden —
              Anwesenheitslisten führen, Beiträge nachverfolgen, Turnieranmeldungen per
              WhatsApp koordinieren, Dokumente suchen.
            </p>
            <p className="story-text">
              Nach der Umstellung auf DojoSoftware hatte er alles in einem System.
              Die Mitglieder registrieren sich selbst, Beiträge werden automatisch eingezogen,
              Turniere laufen strukturiert. <strong>Er konnte sich wieder aufs Training konzentrieren.</strong>
            </p>
            <div className="story-result">
              <span>⏱ Mehrere Stunden pro Woche gespart</span>
              <span>💶 Keine vergessenen Beiträge mehr</span>
              <span>🏆 Professionelles Dojo-Management</span>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Early Bird Section */}
      {promoData && promoData.active && promoData.spotsRemaining > 0 && (
        <section className="early-bird-section">
          <div className="early-bird-container">
            {/* Badge */}
            <div className="eb-badge">
              <span className="eb-badge-icon">☆</span>
              <span>EARLY BIRD SPECIAL</span>
            </div>

            {/* Main Content */}
            <div className="eb-content">
              {/* Left - Rabatt Box */}
              <div className="eb-discount-box">
                <div className="eb-discount-value">{promoData.discountPercent}%</div>
                <div className="eb-discount-label">RABATT</div>
              </div>

              {/* Center - Text */}
              <div className="eb-text">
                <h2 className="eb-headline">
                  Für die ersten <span className="eb-gold">{promoData.maxDojos} Dojos</span>
                </h2>
                <ul className="eb-benefits">
                  <li>
                    <span className="eb-check">✓</span>
                    <span><strong className="eb-gold">{promoData.discountPercent}% Rabatt</strong> für {promoData.discountMonths} Monate</span>
                  </li>
                  <li>
                    <span className="eb-check">✓</span>
                    <span><strong className="eb-gold">{promoData.freeMonths} Monate GRATIS</strong> zum Testen</span>
                  </li>
                  <li>
                    <span className="eb-check">✓</span>
                    <span>Voller Zugang zur Dojo-Software</span>
                  </li>
                </ul>
              </div>

              {/* Right - Counter */}
              <div className="eb-counter">
                <div className="eb-ring-wrapper">
                  <svg className="eb-progress-ring" viewBox="0 0 120 120">
                    <circle className="eb-progress-bg" cx="60" cy="60" r="52" />
                    <circle
                      className="eb-progress-bar"
                      cx="60"
                      cy="60"
                      r="52"
                      style={{
                        strokeDasharray: `${2 * Math.PI * 52}`,
                        strokeDashoffset: `${2 * Math.PI * 52 * (1 - (promoData.maxDojos - promoData.spotsRemaining) / promoData.maxDojos)}`
                      }}
                    />
                  </svg>
                  <div className="eb-counter-text">
                    <span className="eb-counter-current">{promoData.maxDojos - promoData.spotsRemaining}</span>
                    <span className="eb-counter-divider">/</span>
                    <span className="eb-counter-max">{promoData.maxDojos}</span>
                  </div>
                </div>
                <div className="eb-spots-remaining">
                  Noch <strong>{promoData.spotsRemaining}</strong> Plätze!
                </div>
              </div>
            </div>

            {/* CTA */}
            <button className="eb-cta" onClick={() => navigate('/register')}>
              Jetzt DojoSoftware testen
              <span className="eb-cta-arrow">→</span>
            </button>

            <p className="eb-disclaimer">
              Nur für begrenzte Zeit - Aktion endet bei {promoData.maxDojos} Anmeldungen!
            </p>
          </div>
        </section>
      )}

      {/* Carousel Headline */}
      <section className="carousel-headline-section">
        <div className="container">
          <h2 className="carousel-headline">Die All-in-One Lösung für dein Dojo</h2>
          <p className="carousel-subline">by <strong>TDA Systems</strong></p>
        </div>
      </section>

      {/* Banner Slider - Werbebanner */}
      <HeroSlider />

      {/* Dashboard Mockup Section - Full Width */}
      <section className="mockup-section">
        <div className="container">
          <div className="dashboard-mockup">
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
              <div key={feature.feature_key || index} className="feature-card">
                <div className="feature-icon">{feature.feature_icon}</div>
                <h3 className="feature-title">{feature.feature_name}</h3>
                <p className="feature-description">{feature.feature_description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Competitor Comparison */}
      <section className="comparison-section" id="comparison">
        <div className="container">
          <h2 className="section-title">Der ehrliche Vergleich</h2>
          <p className="section-subtitle">
            DojoSoftware vs. {comparisonData.competitors.map(c => c.name).join(' vs. ') || 'Konkurrenz'}
          </p>

          {/* Compact Comparison Cards - Dynamisch */}
          <div className="comparison-cards">
            {comparisonData.categories.map((category) => {
              const isExpanded = !!expandedCards[category.id];
              const safeIcon = category.icon && category.icon !== 'null' ? category.icon : '';
              const safeName = category.name && category.name !== 'null' ? category.name : '';
              return (
                <div key={category.id} className={`comparison-card ${category.is_highlight ? 'highlight-card' : ''} ${isExpanded ? 'card-expanded' : 'card-collapsed'}`}>
                  <button
                    className="card-header card-toggle"
                    onClick={() => toggleCard(category.id)}
                    aria-expanded={isExpanded}
                  >
                    {safeIcon && <span className="card-icon">{safeIcon}</span>}
                    <h3>{safeName}</h3>
                    {!!category.is_highlight && category.highlight_note && category.highlight_note !== '0' && category.highlight_note !== 0 && (
                      <span className="card-badge">{category.highlight_note}</span>
                    )}
                    <span className="card-chevron">{isExpanded ? '▲' : '▼'}</span>
                  </button>
                  {isExpanded && (
                    <div className="card-content">
                      <div className={`mini-table ${category.is_highlight ? 'highlight-table' : ''}`}>
                        <div className="mini-header five-cols">
                          <span></span>
                          <span className="highlight-col">Wir</span>
                          {comparisonData.competitors.map(comp => (
                            <span key={comp.id}>{comp.short_name || comp.name}</span>
                          ))}
                        </div>
                        {category.items && category.items.map((item, idx) => (
                          <div key={idx} className="mini-row five-cols">
                            <span>{item.name && item.name !== 'null' ? item.name : ''}</span>
                            <span className="highlight-col">{getRatingEmoji(item.ours)}</span>
                            {comparisonData.competitors.map(comp => (
                              <span key={comp.id}>{getRatingEmoji(item.competitors[comp.id])}</span>
                            ))}
                          </div>
                        ))}
                      </div>
                      {!!category.is_highlight && category.highlight_note && category.highlight_note !== '0' && category.highlight_note !== 0 && (
                        <p className="card-note">{category.highlight_note}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="comparison-legend">
            <span>✅ Vollständig</span>
            <span>⚠️ Eingeschränkt</span>
            <span>❌ Nicht vorhanden</span>
          </div>

          <div className="comparison-summary">
            <div className="summary-item">
              <span className="summary-icon">💰</span>
              <span><strong>Ab 29€/Monat</strong> vs. 70€+ bei der Konkurrenz</span>
            </div>
            <div className="summary-item">
              <span className="summary-icon">🏆</span>
              <span><strong>Einzige</strong> Lösung mit echtem Wettbewerbssystem</span>
            </div>
            <div className="summary-item">
              <span className="summary-icon">🇩🇪</span>
              <span><strong>100%</strong> DSGVO-konform auf deutschen Servern</span>
            </div>
          </div>

          <div className="comparison-cta">
            <button className="cta-primary" onClick={() => navigate('/register')}>
              Jetzt 14 Tage kostenlos testen
            </button>
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
            {pricingPlans.map((plan, index) => (
              <div
                key={plan.plan_name}
                className={`pricing-card-preview ${plan.plan_name === 'professional' ? 'featured' : ''}`}
              >
                {plan.plan_name === 'professional' && <div className="popular-badge">Beliebt</div>}
                <h3>{plan.display_name}</h3>
                <div className="price">€{parseInt(plan.price_monthly)}<span>/Monat</span></div>
                <p>{plan.max_members >= 999999 ? 'Unbegrenzt Mitglieder' : `Bis ${plan.max_members} Mitglieder`}</p>
              </div>
            ))}
          </div>

          {/* Feature-Vergleichstabelle - Dynamisch */}
          <div className="feature-comparison-table">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  {pricingPlans.map((plan) => (
                    <th key={plan.plan_name} className={plan.plan_name === 'professional' ? 'highlight-col' : ''}>
                      {plan.display_name}<br/>
                      <span className="th-price">€{parseInt(plan.price_monthly)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureMatrix.map((feature, idx) => (
                  <tr key={idx}>
                    <td>{feature.label}</td>
                    {pricingPlans.map((plan) => (
                      <td key={plan.plan_name} className={plan.plan_name === 'professional' ? 'highlight-col' : ''}>
                        {plan.features && plan.features[feature.key] ? '✅' : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="members-row">
                  <td><strong>Max. Mitglieder</strong></td>
                  {pricingPlans.map((plan) => (
                    <td key={plan.plan_name} className={plan.plan_name === 'professional' ? 'highlight-col' : ''}>
                      {plan.max_members >= 999999 ? 'Unbegrenzt' : plan.max_members}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
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

      {/* Demo-Termin Sektion */}
      <section className="demo-booking-section">
        <div className="container">
          <div className="demo-booking-inner">
            <div className="demo-booking-badge">Kostenlos & unverbindlich</div>
            <h2 className="demo-booking-title">
              Sieh die Software live in Aktion
            </h2>
            <p className="demo-booking-sub">
              In einem persönlichen 60-Minuten-Demo zeigen wir dir genau, wie DojoSoftware
              deinen Alltag vereinfacht — abgestimmt auf deine Schule und deine Fragen.
            </p>
            <div className="demo-booking-features">
              <div className="demo-booking-feat"><span>✓</span> Persönliche Präsentation per Zoom</div>
              <div className="demo-booking-feat"><span>✓</span> Alle deine Fragen direkt beantwortet</div>
              <div className="demo-booking-feat"><span>✓</span> Setup-Beratung inklusive</div>
              <div className="demo-booking-feat"><span>✓</span> Kein Verkaufsdruck</div>
            </div>
            <button className="demo-booking-btn" onClick={() => navigate('/demo-buchen')}>
              <span>📅</span>
              Jetzt Demo-Termin buchen
              <span className="demo-booking-arrow">→</span>
            </button>
            <p className="demo-booking-hint">Wähle einfach einen freien Termin — wir bestätigen innerhalb von 24h.</p>
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
              <a href="/demo">Demo-Video</a>
              <a href="/demo-buchen">Demo-Termin buchen</a>
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
            <p className="u-mt-05 u-fs-075rem u-opacity-07">Coming soon: English • Español • Français • Italiano</p>
          </div>
        </div>
      </footer>
      {/* Scroll-to-top Button */}
      {showScrollTop && (
        <button
          className="scroll-top-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Nach oben scrollen"
        >
          ↑
        </button>
      )}
    </div>
  );
}

export default LandingPage;
