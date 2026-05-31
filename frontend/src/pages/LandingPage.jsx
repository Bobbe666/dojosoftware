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
    { feature_icon: '👥', feature_name: 'Mitgliederverwaltung', feature_description: 'Verträge, Kündigungen, Dokumente, Familienverbund – alles an einem Ort' },
    { feature_icon: '🌐', feature_name: 'Online-Registrierung', feature_description: 'Selbstständige Anmeldung mit automatischer Vertragserstellung' },
    { feature_icon: '📱', feature_name: 'Mitglieder-Portal', feature_description: 'Self-Service: Adressänderung, Kündigung, Ruhepause – ohne deinen Aufwand' },
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
          setExpandedCards({});
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

  const getRatingEmoji = (rating) => {
    switch (rating) {
      case 'full': return '✅';
      case 'partial': return '⚠️';
      default: return '❌';
    }
  };

  const testimonials = [
    { name: '', dojo: '', text: '', rating: 5, image: null },
    { name: '', dojo: '', text: '', rating: 5, image: null },
    {
      name: 'Sascha S.',
      dojo: 'Kampfsportschule Schreiner',
      text: 'Endlich eine Software die speziell für Kampfsportschulen entwickelt wurde.',
      rating: 5,
      image: null
    }
  ];

  const [currentTestimonial, setCurrentTestimonial] = useState(2);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial(2);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const hdpActivities = [
    { dot: 'gold', text: 'Max Mustermann — Beitrag eingezogen' },
    { dot: 'green', text: 'Anna K. — Online-Anmeldung abgeschlossen' },
    { dot: 'gold', text: 'Kurs "Kickboxen Fortg." — 12 Teilnehmer' },
    { dot: 'muted', text: 'Prüfung: 3 Mitglieder bestanden' },
  ];

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

      {/* TDA Systems Intro */}
      {showIntro && <TDAIntroPopup onComplete={handleIntroComplete} />}

      {/* ── 1. PROMO BANNER ── */}
      {promoData && promoData.active && promoData.spotsRemaining > 0 && (
        <div className="lp-promo-banner" onClick={() => navigate('/register')}>
          <div className="lp-promo-inner">
            <span className="lp-promo-pill">EARLY BIRD</span>
            <span className="lp-promo-text">
              <strong>{promoData.freeMonths} Monate GRATIS</strong> + <strong>{promoData.discountPercent}% Rabatt</strong> für {promoData.discountMonths} Monate
              <span className="lp-promo-spots"> · Noch <strong>{promoData.spotsRemaining}</strong> Plätze</span>
            </span>
            <span className="lp-promo-arrow">Jetzt sichern →</span>
          </div>
        </div>
      )}

      {/* ── 2. NAVIGATION ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-logo">
            <img src={dojoLogo} alt="DojoSoftware Logo" className="lp-nav-logo-img" />
            <span className="lp-nav-logo-text">DojoSoftware</span>
          </div>
          <div className="lp-nav-links">
            <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Home</a>
            <a href="#features">Features</a>
            <a href="#galerie" onClick={(e) => { e.preventDefault(); navigate('/galerie'); }}>Galerie</a>
            <a href="#pricing" onClick={(e) => { e.preventDefault(); navigate('/pricing'); }}>Preise</a>
            <a href="#testimonials">Referenzen</a>
          </div>
          <button className="lp-nav-login" onClick={() => navigate('/login')}>Login</button>
        </div>
      </nav>

      {/* ── 3. HERO ── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          {/* Kanji Deko */}
          <div className="lp-kanji-strip">
            <span className="lp-kanji" title="Bu — Kampfkunst">武</span>
            <span className="lp-kanji-divider" />
            <span className="lp-kanji" title="Dō — Der Weg">道</span>
            <span className="lp-kanji-divider" />
            <span className="lp-kanji" title="Waza — Technik">技</span>
          </div>

          {/* Eyebrow */}
          <div className="lp-eyebrow">
            <span className="lp-eyebrow-dot" />
            Entwickelt von einem 17-fachen Weltmeister
          </div>

          {/* Headline */}
          <h1 className="lp-hero-title">
            Mehr Mitglieder.<br />
            Weniger Chaos.<br />
            <span className="lp-hero-gold">Volle Kontrolle.</span>
          </h1>

          {/* Subtitle */}
          <p className="lp-hero-sub">
            Die Software, die dein Dojo organisiert — während du trainierst.
            Kein generisches Vereinstool. Gebaut für Kampfsport. Aus der Praxis.
          </p>

          {/* CTA Buttons */}
          <div className="lp-hero-cta">
            <button className="lp-btn-primary lp-btn-pulse" onClick={() => navigate('/register')}>
              Jetzt kostenlos testen <span className="lp-btn-sub">(14 Tage)</span>
            </button>
            <button className="lp-btn-demo" onClick={() => navigate('/demo-buchen')}>
              Demo buchen
            </button>
          </div>

          {/* Benefit Chips */}
          <div className="lp-hero-chips">
            <span className="lp-chip">✓ Keine Kreditkarte</span>
            <span className="lp-chip">✓ 5 Min startklar</span>
            <span className="lp-chip">✓ Jederzeit kündbar</span>
          </div>

          {/* Dashboard Preview Card */}
          <div className="lp-hdp">
            {/* Browser Chrome */}
            <div className="hdp-chrome">
              <div className="hdp-dots">
                <span className="hdp-dot hdp-dot--red" />
                <span className="hdp-dot hdp-dot--yellow" />
                <span className="hdp-dot hdp-dot--green" />
              </div>
              <div className="hdp-url">dojo.tda-intl.org/dashboard</div>
              <div className="hdp-chrome-spacer" />
            </div>

            {/* Dashboard Body */}
            <div className="hdp-body">
              {/* Stat Cards Row */}
              <div className="hdp-stats-row">
                {[
                  { n: '248', l: 'Mitglieder', t: '+12' },
                  { n: '€4.280', l: 'Einnahmen', t: '+8%' },
                  { n: '97%', l: 'Einzugsquote', green: true },
                  { n: '12', l: 'Aktive Kurse' }
                ].map((s, i) => (
                  <div key={i} className="hdp-stat-card">
                    <div className="hdp-stat-num">{s.n}</div>
                    <div className="hdp-stat-label">{s.l}</div>
                    {s.t && <div className={`hdp-stat-trend ${s.green ? 'hdp-stat-trend--green' : ''}`}>{s.t}</div>}
                    {s.green && !s.t && <div className="hdp-stat-trend hdp-stat-trend--green">+2%</div>}
                  </div>
                ))}
              </div>

              {/* Content Row */}
              <div className="hdp-content-row">
                {/* Activity List */}
                <div className="hdp-activity">
                  <div className="hdp-section-title">Letzte Aktivitäten</div>
                  <ul className="hdp-activity-list">
                    {hdpActivities.map((a, i) => (
                      <li key={i} className="hdp-activity-item">
                        <span className={`hdp-activity-dot hdp-activity-dot--${a.dot}`} />
                        <span className="hdp-activity-text">{a.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bar Chart */}
                <div className="hdp-chart">
                  <div className="hdp-section-title">Einnahmen / Monat</div>
                  <div className="hdp-bars-wrap">
                    {[45, 60, 55, 78, 65, 82, 74].map((h, i) => (
                      <div
                        key={i}
                        className="hdp-bar"
                        style={{ '--bar-h': h + '%', '--bar-delay': (i * 0.1) + 's' }}
                      />
                    ))}
                  </div>
                  <div className="hdp-months">
                    {['Nov', 'Dez', 'Jan', 'Feb', 'Mrz', 'Apr', 'Mai'].map(m => (
                      <span key={m}>{m}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Badges Bar */}
          <div className="lp-trust-bar">
            <div className="lp-trust-item"><span className="lp-trust-icon">🔒</span>SSL-verschlüsselt</div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item"><span className="lp-trust-icon">🇩🇪</span>Deutsche Server</div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item"><span className="lp-trust-icon">✓</span>DSGVO-konform</div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item"><span className="lp-trust-icon">🛡️</span>Made in Germany</div>
            <div className="lp-trust-sep" />
            <div className="lp-trust-item"><span className="lp-trust-icon">💳</span>Keine Kreditkarte</div>
          </div>
        </div>
      </section>

      {/* ── 4. PROBLEM SECTION ── */}
      <section className="lp-problem">
        <div className="lp-container">
          <div className="lp-section-tag">Das Problem</div>
          <h2 className="lp-section-title">Kennst du das?</h2>
          <p className="lp-section-sub">Jedes Dojo, das wächst, kennt diese Momente.</p>
          <div className="lp-problem-grid">
            {[
              'Mitgliederlisten verteilt auf Excel, WhatsApp und Papier',
              'Beiträge werden vergessen — du verlierst Geld, ohne es zu merken',
              'Chaos bei Turnieren: Anmeldungen, Listen, Einteilung — alles manuell',
              'Trainer verlieren den Überblick, wenn das Dojo wächst',
              'Stunden verloren durch Verwaltung statt Training',
              'Dein Dojo wächst — aber dein System nicht'
            ].map((text, i) => (
              <div key={i} className="lp-problem-card">
                <span className="lp-problem-x">✕</span>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <div className="lp-problem-footer">
            <p>Das kostet dich Zeit, Geld — und bremst dein Wachstum.</p>
            <button className="lp-btn-primary" onClick={() => navigate('/register')}>Ich will das ändern</button>
          </div>
        </div>
      </section>

      {/* ── 5. AUTHORITY SECTION ── */}
      <section className="lp-authority">
        <div className="lp-container">
          <div className="lp-authority-inner">
            <div className="lp-authority-badge">
              <span className="lp-authority-num">17×</span>
              <span className="lp-authority-lbl">Weltmeister</span>
            </div>
            <div className="lp-authority-text">
              <h2>Nicht von Entwicklern gebaut — sondern von jemandem, der selbst auf der Matte steht.</h2>
              <p>
                Ich habe als Trainer selbst erlebt, wie schnell ein Dojo im Chaos versinkt, wenn es wächst.
                Stundenlange Verwaltung statt Training. Mitglieder, die vergessen werden. Turniere ohne System.
              </p>
              <p>
                Genau deshalb habe ich DojoSoftware entwickelt — eine Lösung aus der Praxis,
                für die Praxis. Nicht für Vereine im Allgemeinen. Speziell für Kampfsport.
              </p>
              <blockquote className="lp-authority-quote">
                „Damit du dich auf das konzentrieren kannst, was wirklich zählt: dein Training und deine Schüler."
              </blockquote>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. TRANSFORMATION SECTION ── */}
      <section className="lp-transformation">
        <div className="lp-container">
          <div className="lp-section-tag">Transformation</div>
          <h2 className="lp-section-title">Von Chaos zu Kontrolle</h2>
          <p className="lp-section-sub">Was sich ändert, wenn dein Dojo ein echtes System hat</p>
          <div className="lp-transform-table">
            <div className="lp-transform-col lp-transform-col--before">
              <div className="lp-transform-header">
                <span className="lp-transform-x">✕</span> Ohne DojoSoftware
              </div>
              {['Mitglieder unübersichtlich verteilt','Beiträge gehen verloren','Stundenlange Zettelwirtschaft','Turnierchaos','Bauchgefühl statt Zahlen','Wachstum bremst sich selbst'].map((t,i) => (
                <div key={i} className="lp-transform-item">{t}</div>
              ))}
            </div>
            <div className="lp-transform-divider">→</div>
            <div className="lp-transform-col lp-transform-col--after">
              <div className="lp-transform-header">
                <span className="lp-transform-check">✓</span> Mit DojoSoftware
              </div>
              {['Alles an einem Ort — sofort abrufbar','Automatische Lastschriften & Mahnungen','Alles läuft — während du trainierst','Turniere in Minuten organisiert','Klare Zahlen & Auswertungen','Skalierbar ohne Stress'].map((t,i) => (
                <div key={i} className="lp-transform-item">{t}</div>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '2.5rem' }}>
            <button className="lp-btn-primary lp-btn-pulse" onClick={() => navigate('/register')}>
              Starte jetzt — 14 Tage kostenlos
            </button>
          </div>
        </div>
      </section>

      {/* ── 7. STORY SECTION ── */}
      <section className="lp-story">
        <div className="lp-container">
          <div className="lp-story-card">
            <div className="lp-story-quotemark">"</div>
            <p className="lp-story-text">
              Ein Trainer mit über 80 Mitgliedern verlor jede Woche mehrere Stunden —
              Anwesenheitslisten führen, Beiträge nachverfolgen, Turnieranmeldungen per
              WhatsApp koordinieren, Dokumente suchen.
            </p>
            <p className="lp-story-text">
              Nach der Umstellung auf DojoSoftware hatte er alles in einem System.
              Die Mitglieder registrieren sich selbst, Beiträge werden automatisch eingezogen,
              Turniere laufen strukturiert. <strong>Er konnte sich wieder aufs Training konzentrieren.</strong>
            </p>
            <div className="lp-story-results">
              <span>⏱ Mehrere Stunden pro Woche gespart</span>
              <span>💶 Keine vergessenen Beiträge mehr</span>
              <span>🏆 Professionelles Dojo-Management</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. EARLY BIRD SECTION ── */}
      {promoData && promoData.active && promoData.spotsRemaining > 0 && (
        <section className="lp-earlybird">
          <div className="lp-earlybird-inner">
            <div className="lp-eb-badge">☆ EARLY BIRD SPECIAL</div>
            <div className="lp-eb-content">
              <div className="lp-eb-discount">
                <div className="lp-eb-pct">{promoData.discountPercent}%</div>
                <div className="lp-eb-pct-lbl">RABATT</div>
              </div>
              <div className="lp-eb-text">
                <h2>Für die ersten <span className="lp-gold">{promoData.maxDojos} Dojos</span></h2>
                <ul className="lp-eb-list">
                  <li><span className="lp-eb-check">✓</span><span><strong className="lp-gold">{promoData.discountPercent}% Rabatt</strong> für {promoData.discountMonths} Monate</span></li>
                  <li><span className="lp-eb-check">✓</span><span><strong className="lp-gold">{promoData.freeMonths} Monate GRATIS</strong> zum Testen</span></li>
                  <li><span className="lp-eb-check">✓</span><span>Voller Zugang zur Dojo-Software</span></li>
                </ul>
              </div>
              <div className="lp-eb-counter">
                <div className="lp-eb-ring-wrap">
                  <svg className="lp-eb-ring" viewBox="0 0 120 120">
                    <circle className="lp-eb-ring-bg" cx="60" cy="60" r="52" />
                    <circle
                      className="lp-eb-ring-bar"
                      cx="60" cy="60" r="52"
                      style={{
                        strokeDasharray: `${2 * Math.PI * 52}`,
                        strokeDashoffset: `${2 * Math.PI * 52 * (1 - (promoData.maxDojos - promoData.spotsRemaining) / promoData.maxDojos)}`
                      }}
                    />
                  </svg>
                  <div className="lp-eb-counter-txt">
                    <span className="lp-eb-cur">{promoData.maxDojos - promoData.spotsRemaining}</span>
                    <span className="lp-eb-div">/</span>
                    <span className="lp-eb-max">{promoData.maxDojos}</span>
                  </div>
                </div>
                <div className="lp-eb-spots">Noch <strong>{promoData.spotsRemaining}</strong> Plätze!</div>
              </div>
            </div>
            <button className="lp-btn-primary" onClick={() => navigate('/register')}>
              Jetzt DojoSoftware testen →
            </button>
            <p className="lp-eb-disclaimer">Nur für begrenzte Zeit – Aktion endet bei {promoData.maxDojos} Anmeldungen!</p>
          </div>
        </section>
      )}

      {/* ── 9. CAROUSEL HEADLINE ── */}
      <section className="lp-carousel-headline">
        <div className="lp-container" style={{ textAlign: 'center' }}>
          <h2 className="lp-carousel-title">Die All-in-One Lösung für dein Dojo</h2>
          <p className="lp-carousel-sub">by <strong>TDA Systems</strong></p>
        </div>
      </section>

      {/* ── 10. HERO SLIDER ── */}
      <HeroSlider />

      {/* ── 11. MOCKUP SECTION ── */}
      <section className="lp-mockup">
        <div className="lp-container">
          <div className="lp-mockup-card">
            <div className="lp-mockup-sidebar">
              <div className="lp-mockup-sidebar-inner">
                <div className="lp-mockup-why">WARUM</div>
                <div className="lp-mockup-arrow">→</div>
                <div className="lp-mockup-why">DARUM</div>
                <div className="lp-mockup-why-sub">Die Lösung für mehr Zeit & weniger Arbeit</div>
              </div>
            </div>
            <div className="lp-mockup-main">
              {[
                { icon: '📝', title: 'Online-Registrierung', desc: 'Mitglieder registrieren sich selbst online. Alles ist sofort im System verfügbar — Mitgliederzugang, Vertrag, alles automatisch angelegt.' },
                { icon: '⚡', title: 'Keine Papierarbeit mehr', desc: 'Keine Zeitverschwendung durch manuelles Erfassen. Kein Papier, keine Akten — alles digital und sofort verfügbar.' },
                { icon: '👤', title: 'Selbstverwaltung durch Mitglieder', desc: 'Mitglieder verwalten ihren Vertrag selbst: Ruhepause, Adress- und Kontoänderungen, Kündigung — alles online. Absolut kein Arbeitsaufwand mehr für dich.' }
              ].map((c, i) => (
                <div key={i} className="lp-mockup-item">
                  <div className="lp-mockup-icon-wrap">
                    <span className="lp-mockup-icon">{c.icon}</span>
                  </div>
                  <div className="lp-mockup-item-body">
                    <h4>{c.title}</h4>
                    <p>{c.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 12. SOCIAL PROOF ── */}
      <section className="lp-social-proof">
        <div className="lp-container">
          <p className="lp-social-text">Vertrauen von <strong>Kampfsportschulen</strong> auf der ganzen Welt</p>
          <div className="lp-disciplines">
            {[
              { icon: '🥋', name: 'Karate' }, { icon: '🥊', name: 'Kickboxen' },
              { icon: '🤺', name: 'Taekwondo' }, { icon: '🤼', name: 'Judo' },
              { icon: '🥋', name: 'BJJ' }, { icon: '👊', name: 'Kung Fu' },
              { icon: '⚔️', name: 'MMA' }, { icon: '🛡️', name: 'ShieldX' },
              { icon: '⚡', name: 'Krav Maga' }, { icon: '🥋', name: 'Hapkido' },
              { icon: '⚡', name: 'und mehr...' }
            ].map((d, i) => (
              <div key={i} className="lp-discipline-chip">
                <span>{d.icon}</span><span>{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 13. FEATURES SECTION ── */}
      <section className="lp-features" id="features">
        <div className="lp-container">
          <div className="lp-section-tag">Features</div>
          <h2 className="lp-section-title">Alles was dein Dojo braucht</h2>
          <p className="lp-section-sub">Eine komplette Lösung — von der Mitgliederverwaltung bis zur Buchführung</p>
          <div className="lp-features-grid">
            {features.map((feature, index) => (
              <div key={feature.feature_key || index} className="lp-feature-card">
                <div className="lp-feature-icon-wrap">
                  <span className="lp-feature-icon">{feature.feature_icon}</span>
                </div>
                <h3 className="lp-feature-title">{feature.feature_name}</h3>
                <p className="lp-feature-desc">{feature.feature_description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 14. COMPARISON SECTION ── */}
      <section className="lp-comparison" id="comparison">
        <div className="lp-container">
          <div className="lp-section-tag">Vergleich</div>
          <h2 className="lp-section-title">Der ehrliche Vergleich</h2>
          <p className="lp-section-sub">
            DojoSoftware vs. {comparisonData.competitors.map(c => c.name).join(' vs. ') || 'Konkurrenz'}
          </p>
          <div className="lp-comparison-cards">
            {comparisonData.categories.map((category) => {
              const isExpanded = !!expandedCards[category.id];
              const safeIcon = category.icon && category.icon !== 'null' ? category.icon : '';
              const safeName = category.name && category.name !== 'null' ? category.name : '';
              return (
                <div key={category.id} className={`lp-comp-card ${category.is_highlight ? 'lp-comp-card--highlight' : ''} ${isExpanded ? 'lp-comp-card--open' : ''}`}>
                  <button
                    className="lp-comp-card-header"
                    onClick={() => toggleCard(category.id)}
                    aria-expanded={isExpanded}
                  >
                    {safeIcon && <span className="lp-comp-icon">{safeIcon}</span>}
                    <h3>{safeName}</h3>
                    {!!category.is_highlight && category.highlight_note && category.highlight_note !== '0' && category.highlight_note !== 0 && (
                      <span className="lp-comp-badge">{category.highlight_note}</span>
                    )}
                    <span className="lp-comp-chevron">{isExpanded ? '▲' : '▼'}</span>
                  </button>
                  {isExpanded && (
                    <div className="lp-comp-body">
                      <div className={`lp-mini-table ${category.is_highlight ? 'lp-mini-table--highlight' : ''}`}>
                        <div className="lp-mini-header lp-mini-five">
                          <span></span>
                          <span className="lp-mini-ours">Wir</span>
                          {comparisonData.competitors.map(comp => (
                            <span key={comp.id}>{comp.short_name || comp.name}</span>
                          ))}
                        </div>
                        {category.items && category.items.map((item, idx) => (
                          <div key={idx} className="lp-mini-row lp-mini-five">
                            <span>{item.name && item.name !== 'null' ? item.name : ''}</span>
                            <span className="lp-mini-ours">{getRatingEmoji(item.ours)}</span>
                            {comparisonData.competitors.map(comp => (
                              <span key={comp.id}>{getRatingEmoji(item.competitors[comp.id])}</span>
                            ))}
                          </div>
                        ))}
                      </div>
                      {!!category.is_highlight && category.highlight_note && category.highlight_note !== '0' && category.highlight_note !== 0 && (
                        <p className="lp-comp-note">{category.highlight_note}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="lp-comp-legend">
            <span>✅ Vollständig</span>
            <span>⚠️ Eingeschränkt</span>
            <span>❌ Nicht vorhanden</span>
          </div>

          <div className="lp-comp-summary">
            {[
              { icon: '💰', text: <><strong>Ab 29€/Monat</strong> vs. 70€+ bei der Konkurrenz</> },
              { icon: '🏆', text: <><strong>Einzige</strong> Lösung mit echtem Wettbewerbssystem</> },
              { icon: '🇩🇪', text: <><strong>100%</strong> DSGVO-konform auf deutschen Servern</> },
            ].map((s, i) => (
              <div key={i} className="lp-comp-summary-item">
                <span className="lp-comp-summary-icon">{s.icon}</span>
                <span>{s.text}</span>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button className="lp-btn-primary" onClick={() => navigate('/register')}>
              Jetzt 14 Tage kostenlos testen
            </button>
          </div>
        </div>
      </section>

      {/* ── 15. TESTIMONIALS ── */}
      <section className="lp-testimonials" id="testimonials">
        <div className="lp-container">
          <div className="lp-section-tag">Referenzen</div>
          <h2 className="lp-section-title">Was unsere Kunden sagen</h2>
          <div className="lp-testimonials-wrap">
            <div className="lp-testimonial-card">
              {testimonials[currentTestimonial].text && (
                <>
                  <div className="lp-testimonial-stars">
                    {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                      <span key={i} className="lp-star">★</span>
                    ))}
                  </div>
                  <p className="lp-testimonial-text">"{testimonials[currentTestimonial].text}"</p>
                  {testimonials[currentTestimonial].name && (
                    <div className="lp-testimonial-author">
                      <strong>{testimonials[currentTestimonial].name}</strong>
                      {testimonials[currentTestimonial].dojo && (
                        <span>{testimonials[currentTestimonial].dojo}</span>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="lp-testimonial-dots">
              {testimonials.map((_, index) => {
                if (index < 2) return null;
                return (
                  <button
                    key={index}
                    className={`lp-testimonial-dot ${currentTestimonial === index ? 'lp-testimonial-dot--active' : ''}`}
                    onClick={() => setCurrentTestimonial(index)}
                    aria-label={`Testimonial ${index + 1}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── 16. PRICING PREVIEW ── */}
      <section className="lp-pricing" id="pricing">
        <div className="lp-container">
          <div className="lp-section-tag">Preise</div>
          <h2 className="lp-section-title">Transparent & Fair</h2>
          <p className="lp-section-sub">Wähle den Plan der zu deinem Dojo passt</p>
          <div className="lp-pricing-cards">
            {pricingPlans.map((plan) => (
              <div
                key={plan.plan_name}
                className={`lp-pricing-card ${plan.plan_name === 'professional' ? 'lp-pricing-card--featured' : ''}`}
              >
                {plan.plan_name === 'professional' && <div className="lp-pricing-popular">Beliebt</div>}
                <h3 className="lp-pricing-name">{plan.display_name}</h3>
                <div className="lp-pricing-price">€{parseInt(plan.price_monthly)}<span>/Mo</span></div>
                <p className="lp-pricing-members">{plan.max_members >= 999999 ? 'Unbegrenzt' : `Bis ${plan.max_members}`} Mitglieder</p>
              </div>
            ))}
          </div>

          <div className="lp-pricing-table-wrap">
            <table className="lp-pricing-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  {pricingPlans.map((plan) => (
                    <th key={plan.plan_name} className={plan.plan_name === 'professional' ? 'lp-pt-hl' : ''}>
                      {plan.display_name}<br />
                      <span className="lp-pt-price">€{parseInt(plan.price_monthly)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {featureMatrix.map((feature, idx) => (
                  <tr key={idx}>
                    <td>{feature.label}</td>
                    {pricingPlans.map((plan) => (
                      <td key={plan.plan_name} className={plan.plan_name === 'professional' ? 'lp-pt-hl' : ''}>
                        {plan.features && plan.features[feature.key] ? '✅' : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="lp-pt-members-row">
                  <td><strong>Max. Mitglieder</strong></td>
                  {pricingPlans.map((plan) => (
                    <td key={plan.plan_name} className={plan.plan_name === 'professional' ? 'lp-pt-hl' : ''}>
                      {plan.max_members >= 999999 ? 'Unbegrenzt' : plan.max_members}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: 'center', marginTop: '2rem' }}>
            <button className="lp-btn-outline" onClick={() => navigate('/pricing')}>
              Alle Preise & Features ansehen
            </button>
          </div>
        </div>
      </section>

      {/* ── 17. FAQ ── */}
      <section className="lp-faq">
        <div className="lp-container">
          <div className="lp-section-tag">FAQ</div>
          <h2 className="lp-section-title">Häufig gestellte Fragen</h2>
          <div className="lp-faq-grid">
            {[
              { q: 'Wie funktioniert der 14-Tage-Test?', a: 'Registriere dich kostenlos und teste alle Features 14 Tage lang. Keine Kreditkarte erforderlich.' },
              { q: 'Sind meine Daten sicher (DSGVO)?', a: 'Ja, alle Daten werden verschlüsselt auf deutschen Servern gespeichert. 100% DSGVO-konform.' },
              { q: 'Funktioniert es für mehrere Standorte?', a: 'Ja, mit dem Enterprise-Plan kannst du mehrere Dojos zentral verwalten mit einem Account. Getrennte oder gemeinsame Ansicht und Auswertung.' },
              { q: 'Wie lange dauert die Einrichtung?', a: 'In der Regel bist du in unter 5 Minuten startklar. Einfach registrieren, Dojo-Daten eintragen und loslegen.' }
            ].map((item, i) => (
              <div key={i} className="lp-faq-item">
                <h3 className="lp-faq-q">{item.q}</h3>
                <p className="lp-faq-a">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 18. DEMO BOOKING ── */}
      <section className="lp-demo-booking">
        <div className="lp-container">
          <div className="lp-demo-inner">
            <div className="lp-demo-badge">Kostenlos & unverbindlich</div>
            <h2 className="lp-demo-title">Sieh die Software live in Aktion</h2>
            <p className="lp-demo-sub">
              In einem persönlichen 60-Minuten-Demo zeigen wir dir genau, wie DojoSoftware
              deinen Alltag vereinfacht — abgestimmt auf deine Schule und deine Fragen.
            </p>
            <div className="lp-demo-features">
              <div className="lp-demo-feat"><span>✓</span> Persönliche Präsentation per Zoom</div>
              <div className="lp-demo-feat"><span>✓</span> Alle deine Fragen direkt beantwortet</div>
              <div className="lp-demo-feat"><span>✓</span> Setup-Beratung inklusive</div>
              <div className="lp-demo-feat"><span>✓</span> Kein Verkaufsdruck</div>
            </div>
            <button className="lp-btn-demo-book" onClick={() => navigate('/demo-buchen')}>
              <span>📅</span>
              Jetzt Demo-Termin buchen
              <span className="lp-btn-arrow">→</span>
            </button>
            <p className="lp-demo-hint">Wähle einfach einen freien Termin — wir bestätigen innerhalb von 24h.</p>
          </div>
        </div>
      </section>

      {/* ── 19. FINAL CTA ── */}
      <section className="lp-final-cta">
        <div className="lp-final-cta-glow" />
        <div className="lp-container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <h2 className="lp-final-cta-title">Bereit dein Dojo zu digitalisieren?</h2>
          <p className="lp-final-cta-sub">Starte jetzt — komplett kostenlos</p>
          <button className="lp-btn-primary lp-btn-lg lp-btn-pulse" onClick={() => navigate('/register')}>
            Jetzt 14 Tage gratis testen
          </button>
          <p className="lp-final-cta-note">Keine Kreditkarte nötig</p>
        </div>
      </section>

      {/* ── 20. FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-grid">
            <div className="lp-footer-col">
              <h4>Produkt</h4>
              <a href="#features">Features</a>
              <a href="/pricing">Preise</a>
              <a href="/demo">Demo-Video</a>
              <a href="/demo-buchen">Demo-Termin buchen</a>
            </div>
            <div className="lp-footer-col">
              <h4>Unternehmen</h4>
              <a href="/about">Über uns</a>
              <a href="/contact">Kontakt</a>
              <a href="/impressum">Impressum</a>
            </div>
            <div className="lp-footer-col">
              <h4>Support</h4>
              <a href="/help">Hilfe-Center</a>
              <a href="/login">Login</a>
              <a href="mailto:support@dojo.tda-intl.org">Email Support</a>
            </div>
            <div className="lp-footer-col">
              <h4>Rechtliches</h4>
              <a href="/datenschutz">Datenschutz</a>
              <a href="/agb">AGB</a>
            </div>
          </div>
          <div className="lp-footer-bottom">
            <p>© 2026 DojoSoftware by TDA International · Alle Rechte vorbehalten</p>
            <p className="lp-footer-langs">Coming soon: English · Español · Français · Italiano</p>
          </div>
        </div>
      </footer>

      {/* ── 21. SCROLL TO TOP ── */}
      {showScrollTop && (
        <button
          className="lp-scroll-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Nach oben"
        >
          ↑
        </button>
      )}

      {/* Custom Cursor */}
    </div>
  );
}

export default LandingPage;
