import React from 'react';
import { Link } from 'react-router-dom';
import './LegalPage.css';
import SEO from '../components/SEO';

const WiderrufsPage = () => {
  return (
    <div className="legal-page">
      <SEO title="Widerrufsbelehrung" description="Widerrufsbelehrung für DojoSoftware gemäß § 312g BGB." noindex={true} />
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
          <h1>Widerrufsbelehrung</h1>
          <p>Informationen zu Ihrem Widerrufsrecht gemäß § 312g BGB</p>
        </div>
      </section>

      {/* Content */}
      <section className="legal-content">
        <div className="container">
          <article className="legal-article">

            {/* Hinweis B2B */}
            <div className="legal-block legal-block--info">
              <h2>Hinweis für gewerbliche Kunden</h2>
              <p>
                Das gesetzliche Widerrufsrecht steht ausschließlich Verbrauchern im
                Sinne des § 13 BGB zu (natürliche Personen, die ein Rechtsgeschäft
                zu einem Zweck abschließen, der überwiegend weder ihrer gewerblichen
                noch ihrer selbständigen beruflichen Tätigkeit zugerechnet werden kann).
              </p>
              <p>
                Schließen Sie DojoSoftware als Unternehmer, Verein oder juristische
                Person im Rahmen Ihrer gewerblichen oder selbständigen beruflichen
                Tätigkeit ab, steht Ihnen kein Widerrufsrecht zu. Die Regelungen
                dieser Widerrufsbelehrung gelten in diesem Fall nicht für Sie.
              </p>
            </div>

            {/* Widerrufsrecht */}
            <div className="legal-block">
              <h2>Widerrufsrecht</h2>
              <p>
                Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen
                diesen Vertrag zu widerrufen.
              </p>
              <p>
                Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.
              </p>
              <p>
                Um Ihr Widerrufsrecht auszuüben, müssen Sie uns
              </p>
              <p style={{ marginLeft: '1rem' }}>
                <strong>TDA International</strong><br />
                Ohmstr. 14<br />
                84137 Vilsbiburg<br />
                E-Mail: <a href="mailto:info@tda-intl.com">info@tda-intl.com</a>
              </p>
              <p>
                mittels einer eindeutigen Erklärung (z.&nbsp;B. ein mit der Post versandter
                Brief oder eine E-Mail) über Ihren Entschluss, diesen Vertrag zu widerrufen,
                informieren. Sie können dafür das beigefügte Muster-Widerrufsformular
                verwenden, das jedoch nicht vorgeschrieben ist.
              </p>
              <p>
                Zur Wahrung der Widerrufsfrist reicht es aus, dass Sie die Mitteilung
                über die Ausübung des Widerrufsrechts vor Ablauf der Widerrufsfrist absenden.
              </p>
            </div>

            {/* Widerrufsfolgen */}
            <div className="legal-block">
              <h2>Folgen des Widerrufs</h2>
              <p>
                Wenn Sie diesen Vertrag widerrufen, haben wir Ihnen alle Zahlungen,
                die wir von Ihnen erhalten haben, unverzüglich und spätestens binnen
                vierzehn Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über
                Ihren Widerruf dieses Vertrags bei uns eingegangen ist. Für diese
                Rückzahlung verwenden wir dasselbe Zahlungsmittel, das Sie bei der
                ursprünglichen Transaktion eingesetzt haben, es sei denn, mit Ihnen
                wurde ausdrücklich etwas anderes vereinbart; in keinem Fall werden
                Ihnen wegen dieser Rückzahlung Entgelte berechnet.
              </p>
            </div>

            {/* Erlöschen des Widerrufsrechts */}
            <div className="legal-block legal-block--warning">
              <h2>Vorzeitiges Erlöschen des Widerrufsrechts bei digitalen Inhalten</h2>
              <p>
                <strong>
                  Ihr Widerrufsrecht erlischt vorzeitig, wenn wir mit der Ausführung
                  des Vertrages begonnen haben, nachdem Sie ausdrücklich zugestimmt
                  haben, dass wir vor Ablauf der Widerrufsfrist mit der Ausführung
                  des Vertrages beginnen, und Sie Ihre Kenntnis davon bestätigt haben,
                  dass Sie durch Ihre Zustimmung mit Beginn der Ausführung des Vertrages
                  Ihr Widerrufsrecht verlieren.
                </strong>
              </p>
              <p>
                Bei DojoSoftware handelt es sich um eine digitale Dienstleistung
                (SaaS), die unmittelbar nach Vertragsabschluss und Freischaltung
                Ihres Zugangs bereitgestellt wird. Wenn Sie im Rahmen des
                Registrierungsprozesses ausdrücklich bestätigt haben, dass die
                Ausführung des Vertrages sofort beginnen soll, und dabei zur Kenntnis
                genommen haben, dass Sie mit Beginn der Ausführung Ihr Widerrufsrecht
                verlieren, erlischt das Widerrufsrecht mit Beginn der Vertragsausführung.
              </p>
              <p>
                Die kostenlose 14-tägige Testphase ist kein entgeltlicher Vertrag im
                Sinne dieser Widerrufsbelehrung. Das Widerrufsrecht bezieht sich auf
                den kostenpflichtigen Abonnementvertrag.
              </p>
            </div>

            {/* Muster-Widerrufsformular */}
            <div className="legal-block legal-block--form">
              <h2>Muster-Widerrufsformular</h2>
              <p>
                (Wenn Sie den Vertrag widerrufen wollen, dann füllen Sie bitte dieses
                Formular aus und senden Sie es zurück.)
              </p>
              <div style={{
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                padding: '1.25rem 1.5rem',
                marginTop: '1rem',
                background: 'rgba(255,255,255,0.03)',
                fontFamily: 'monospace',
                fontSize: '0.88rem',
                lineHeight: '1.8'
              }}>
                <p>An:</p>
                <p>
                  TDA International<br />
                  Ohmstr. 14<br />
                  84137 Vilsbiburg<br />
                  E-Mail: info@tda-intl.com
                </p>
                <p>
                  Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen
                  Vertrag über die Erbringung der folgenden Dienstleistung (*):
                </p>
                <p>
                  ____________________________________________<br />
                  (Beschreibung der Dienstleistung / Tarifbezeichnung)
                </p>
                <p>Bestellt am (*): ____________________________</p>
                <p>Name des/der Verbraucher(s): ____________________________</p>
                <p>Anschrift des/der Verbraucher(s): ____________________________</p>
                <p>
                  Unterschrift des/der Verbraucher(s)<br />
                  (nur bei Mitteilung auf Papier): ____________________________
                </p>
                <p>Datum: ____________________________</p>
                <p style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  (*) Unzutreffendes streichen.
                </p>
              </div>
            </div>

            {/* Stand */}
            <div className="legal-block">
              <p>
                <em>Stand: Mai 2026</em>
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
            <Link to="/agb">AGB</Link>
            <Link to="/datenschutz">Datenschutz</Link>
            <Link to="/impressum">Impressum</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default WiderrufsPage;
