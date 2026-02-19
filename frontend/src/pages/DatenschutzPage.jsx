import React from 'react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

const DatenschutzPage = () => {
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
          <h1>Datenschutzerklärung</h1>
          <p>Informationen zum Schutz Ihrer personenbezogenen Daten</p>
        </div>
      </section>

      {/* Content */}
      <section className="legal-content">
        <div className="container">
          <article className="legal-article">

            {/* 1. Einleitung */}
            <div className="legal-block">
              <h2>1. Datenschutz auf einen Blick</h2>

              <h3>Allgemeine Hinweise</h3>
              <p>
                Die folgenden Hinweise geben einen einfachen Überblick darüber, was mit Ihren
                personenbezogenen Daten passiert, wenn Sie unsere Website besuchen oder unsere
                Software nutzen. Personenbezogene Daten sind alle Daten, mit denen Sie persönlich
                identifiziert werden können.
              </p>

              <h3>Datenerfassung auf dieser Website</h3>
              <p>
                <strong>Wer ist verantwortlich für die Datenerfassung?</strong><br />
                Die Datenverarbeitung auf dieser Website erfolgt durch den Websitebetreiber.
                Dessen Kontaktdaten können Sie dem Abschnitt „Verantwortliche Stelle" entnehmen.
              </p>
              <p>
                <strong>Wie erfassen wir Ihre Daten?</strong><br />
                Ihre Daten werden zum einen dadurch erhoben, dass Sie uns diese mitteilen
                (z.B. bei der Registrierung, Kontaktformular). Andere Daten werden automatisch
                oder nach Ihrer Einwilligung beim Besuch der Website durch unsere IT-Systeme erfasst.
              </p>
            </div>

            {/* 2. Verantwortliche Stelle */}
            <div className="legal-block">
              <h2>2. Verantwortliche Stelle</h2>
              <p>Verantwortlich für die Datenverarbeitung auf dieser Website ist:</p>
              <address>
                <strong>TDA International</strong><br />
                Tiger & Dragon Association<br />
                Sascha Schreiner<br />
                Ohmstr. 14<br />
                84137 Vilsbiburg<br />
                Deutschland<br /><br />
                Telefon: +49 157 52461776<br />
                E-Mail: <a href="mailto:datenschutz@tda-intl.org">datenschutz@tda-intl.org</a>
              </address>
            </div>

            {/* 3. Hosting */}
            <div className="legal-block">
              <h2>3. Hosting und Server</h2>
              <p>
                Unsere Website und Software werden auf Servern in Deutschland gehostet.
                Der Hosting-Anbieter erhebt in sogenannten Logfiles folgende Daten,
                die Ihr Browser übermittelt:
              </p>
              <ul>
                <li>IP-Adresse</li>
                <li>Adresse der vorher besuchten Website (Referrer)</li>
                <li>Datum und Uhrzeit der Anfrage</li>
                <li>Zeitzonendifferenz zur Greenwich Mean Time (GMT)</li>
                <li>Inhalt der Anforderung (konkrete Seite)</li>
                <li>Zugriffsstatus/HTTP-Statuscode</li>
                <li>Übertragene Datenmenge</li>
                <li>Browser und Browserversion</li>
                <li>Betriebssystem</li>
              </ul>
              <p>
                Die Speicherung dieser Daten ist für den Betrieb der Website aus technischen
                Gründen erforderlich. Eine Zusammenführung dieser Daten mit anderen Datenquellen
                wird nicht vorgenommen. Die Erfassung erfolgt auf Grundlage von Art. 6 Abs. 1
                lit. f DSGVO.
              </p>
            </div>

            {/* 4. DojoSoftware spezifische Daten */}
            <div className="legal-block">
              <h2>4. Datenverarbeitung in der DojoSoftware</h2>

              <h3>4.1 Registrierung und Nutzerkonto</h3>
              <p>
                Bei der Registrierung für DojoSoftware erheben wir folgende Daten:
              </p>
              <ul>
                <li>Name des Dojos/Vereins</li>
                <li>Vor- und Nachname des Kontoinhabers</li>
                <li>E-Mail-Adresse</li>
                <li>Passwort (verschlüsselt gespeichert)</li>
                <li>Optional: Telefonnummer, Adresse</li>
              </ul>
              <p>
                Diese Daten werden zur Bereitstellung unseres Dienstes benötigt
                (Art. 6 Abs. 1 lit. b DSGVO - Vertragserfüllung).
              </p>

              <h3>4.2 Mitgliederdaten (Auftragsverarbeitung)</h3>
              <p>
                Als Dojo-Betreiber speichern Sie Daten Ihrer Mitglieder in unserer Software.
                In diesem Fall handeln wir als <strong>Auftragsverarbeiter</strong> nach Art. 28 DSGVO.
                Die Verantwortlichkeit für diese Daten liegt beim Dojo-Betreiber.
              </p>
              <p>Typische Mitgliederdaten umfassen:</p>
              <ul>
                <li>Name, Vorname, Geburtsdatum</li>
                <li>Kontaktdaten (Adresse, Telefon, E-Mail)</li>
                <li>Vertragsdaten (Tarif, Laufzeit, Beiträge)</li>
                <li>Bankverbindung (für SEPA-Lastschriften)</li>
                <li>Anwesenheitsdaten (Check-In)</li>
                <li>Prüfungsdaten (Graduierungen)</li>
                <li>Optional: Fotos</li>
              </ul>
              <p>
                Wir stellen sicher, dass diese Daten ausschließlich auf deutschen Servern
                gespeichert werden und nach höchsten Sicherheitsstandards geschützt sind.
              </p>

              <h3>4.3 Zahlungsdaten</h3>
              <p>
                Für die Abwicklung von Zahlungen nutzen wir den Zahlungsdienstleister
                <strong> Stripe</strong> (Stripe Payments Europe, Ltd., Irland).
                Stripe verarbeitet Ihre Zahlungsdaten unter eigener Verantwortung.
                Weitere Informationen finden Sie in der{' '}
                <a href="https://stripe.com/de/privacy" target="_blank" rel="noopener noreferrer">
                  Datenschutzerklärung von Stripe
                </a>.
              </p>
            </div>

            {/* 5. Cookies */}
            <div className="legal-block">
              <h2>5. Cookies und lokale Speicherung</h2>
              <p>
                Unsere Website verwendet Cookies und lokale Speichertechnologien.
                Dabei handelt es sich um kleine Textdateien, die auf Ihrem Endgerät
                gespeichert werden.
              </p>

              <h3>Technisch notwendige Cookies</h3>
              <p>
                Diese Cookies sind für die Funktion der Website unbedingt erforderlich
                und können nicht deaktiviert werden:
              </p>
              <ul>
                <li><strong>Session-Cookie:</strong> Authentifizierung und Login-Status</li>
                <li><strong>CSRF-Token:</strong> Schutz vor Cross-Site-Request-Forgery</li>
                <li><strong>Spracheinstellung:</strong> Speicherung Ihrer Sprachpräferenz</li>
              </ul>
              <p>
                Die Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse
                an der technischen Bereitstellung).
              </p>

              <h3>Keine Tracking-Cookies</h3>
              <p>
                Wir verwenden <strong>keine</strong> Analyse- oder Marketing-Cookies.
                Es erfolgt kein Tracking Ihres Nutzungsverhaltens durch Drittanbieter.
              </p>
            </div>

            {/* 6. SSL-Verschlüsselung */}
            <div className="legal-block">
              <h2>6. SSL-/TLS-Verschlüsselung</h2>
              <p>
                Diese Seite nutzt aus Sicherheitsgründen eine SSL- bzw. TLS-Verschlüsselung.
                Eine verschlüsselte Verbindung erkennen Sie daran, dass die Adresszeile
                des Browsers von „http://" auf „https://" wechselt und an dem Schloss-Symbol.
              </p>
              <p>
                Wenn die SSL- bzw. TLS-Verschlüsselung aktiviert ist, können die Daten,
                die Sie an uns übermitteln, nicht von Dritten mitgelesen werden.
              </p>
            </div>

            {/* 7. Ihre Rechte */}
            <div className="legal-block">
              <h2>7. Ihre Rechte nach DSGVO</h2>
              <p>Sie haben gegenüber uns folgende Rechte hinsichtlich Ihrer personenbezogenen Daten:</p>
              <ul>
                <li><strong>Auskunftsrecht (Art. 15 DSGVO):</strong> Sie können Auskunft über Ihre bei uns gespeicherten Daten verlangen.</li>
                <li><strong>Berichtigungsrecht (Art. 16 DSGVO):</strong> Sie können die Berichtigung unrichtiger Daten verlangen.</li>
                <li><strong>Löschungsrecht (Art. 17 DSGVO):</strong> Sie können die Löschung Ihrer Daten verlangen, sofern keine gesetzlichen Aufbewahrungspflichten bestehen.</li>
                <li><strong>Einschränkung (Art. 18 DSGVO):</strong> Sie können die Einschränkung der Verarbeitung verlangen.</li>
                <li><strong>Datenübertragbarkeit (Art. 20 DSGVO):</strong> Sie können Ihre Daten in einem maschinenlesbaren Format erhalten.</li>
                <li><strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> Sie können der Verarbeitung widersprechen.</li>
                <li><strong>Widerruf der Einwilligung (Art. 7 Abs. 3 DSGVO):</strong> Sie können eine erteilte Einwilligung jederzeit widerrufen.</li>
              </ul>
              <p>
                Zur Ausübung Ihrer Rechte wenden Sie sich bitte an:{' '}
                <a href="mailto:datenschutz@tda-intl.org">datenschutz@tda-intl.org</a>
              </p>
            </div>

            {/* 8. Beschwerderecht */}
            <div className="legal-block">
              <h2>8. Beschwerderecht bei der Aufsichtsbehörde</h2>
              <p>
                Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über
                die Verarbeitung Ihrer personenbezogenen Daten zu beschweren.
              </p>
              <p>Die für uns zuständige Aufsichtsbehörde ist:</p>
              <address>
                Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)<br />
                Promenade 18<br />
                91522 Ansbach<br />
                <a href="https://www.lda.bayern.de" target="_blank" rel="noopener noreferrer">
                  www.lda.bayern.de
                </a>
              </address>
            </div>

            {/* 9. Speicherdauer */}
            <div className="legal-block">
              <h2>9. Speicherdauer</h2>
              <p>
                Wir speichern Ihre Daten nur so lange, wie dies für die jeweiligen
                Verarbeitungszwecke erforderlich ist oder gesetzliche Aufbewahrungsfristen
                bestehen.
              </p>
              <ul>
                <li><strong>Nutzerkonto:</strong> Bis zur Löschung des Kontos</li>
                <li><strong>Mitgliederdaten:</strong> Gemäß den Einstellungen des Dojo-Betreibers</li>
                <li><strong>Rechnungsdaten:</strong> 10 Jahre (gesetzliche Aufbewahrungspflicht)</li>
                <li><strong>Server-Logs:</strong> 30 Tage</li>
              </ul>
            </div>

            {/* 10. Änderungen */}
            <div className="legal-block">
              <h2>10. Änderungen dieser Datenschutzerklärung</h2>
              <p>
                Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie an
                geänderte Rechtslagen oder bei Änderungen des Dienstes anzupassen.
              </p>
              <p>
                <em>Stand: Februar 2026</em>
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
            <Link to="/impressum">Impressum</Link>
            <Link to="/agb">AGB</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default DatenschutzPage;
