import React from 'react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

const ImpressumPage = () => {
  return (
    <div className="legal-page">
      {/* Header */}
      <header className="legal-header">
        <div className="container">
          <Link to="/" className="legal-logo">
            DojoSoftware
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="legal-hero">
        <div className="container">
          <span className="legal-label">Rechtliches</span>
          <h1>Impressum</h1>
          <p>Angaben gemäß § 5 TMG</p>
        </div>
      </section>

      {/* Content */}
      <section className="legal-content">
        <div className="container">
          <article className="legal-article">

            {/* Anbieter */}
            <div className="legal-block">
              <h2>Diensteanbieter</h2>
              <address>
                <strong>TDA International</strong><br />
                Tiger & Dragon Association<br />
                Ohmstr. 14<br />
                84137 Vilsbiburg<br />
                Deutschland
              </address>
            </div>

            {/* Vertreten durch */}
            <div className="legal-block">
              <h2>Vertreten durch</h2>
              <p>Sascha Schreiner (World President)</p>
            </div>

            {/* Kontakt */}
            <div className="legal-block">
              <h2>Kontakt</h2>
              <p>
                Telefon: +49 157 52461776<br />
                E-Mail: <a href="mailto:info@tda-intl.org">info@tda-intl.org</a><br />
                Website: <a href="https://tda-intl.org" target="_blank" rel="noopener noreferrer">www.tda-intl.org</a>
              </p>
            </div>

            {/* Haftung für Inhalte */}
            <div className="legal-block">
              <h2>Haftung für Inhalte</h2>
              <p>
                Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen
                Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind
                wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte
                fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine
                rechtswidrige Tätigkeit hinweisen.
              </p>
              <p>
                Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach
                den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung
                ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung
                möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese
                Inhalte umgehend entfernen.
              </p>
            </div>

            {/* Haftung für Links */}
            <div className="legal-block">
              <h2>Haftung für Links</h2>
              <p>
                Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir
                keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine
                Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige
                Anbieter oder Betreiber der Seiten verantwortlich.
              </p>
              <p>
                Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche
                Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der
                Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten
                Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht
                zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links
                umgehend entfernen.
              </p>
            </div>

            {/* Urheberrecht */}
            <div className="legal-block">
              <h2>Urheberrecht</h2>
              <p>
                Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten
                unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung,
                Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes
                bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
              </p>
              <p>
                Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen
                Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht vom Betreiber
                erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden
                Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine
                Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden
                Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte
                umgehend entfernen.
              </p>
            </div>

            {/* Streitschlichtung */}
            <div className="legal-block">
              <h2>Streitschlichtung</h2>
              <p>
                Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
                <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
                  https://ec.europa.eu/consumers/odr
                </a>
              </p>
              <p>
                Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
                Verbraucherschlichtungsstelle teilzunehmen.
              </p>
            </div>

            {/* Bildnachweise */}
            <div className="legal-block">
              <h2>Bildnachweise</h2>
              <p>
                Die auf dieser Website verwendeten Bilder und Grafiken stammen aus eigener
                Produktion oder von lizenzfreien Bildportalen.
              </p>
            </div>

          </article>
        </div>
      </section>

      {/* Footer */}
      <footer className="legal-footer">
        <div className="container">
          <p>© 2026 DojoSoftware by TDA International</p>
          <div className="legal-footer-links">
            <Link to="/">Startseite</Link>
            <Link to="/datenschutz">Datenschutz</Link>
            <Link to="/agb">AGB</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default ImpressumPage;
