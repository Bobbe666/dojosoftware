import React from 'react';
import { Link } from 'react-router-dom';
import './LegalPage.css';

const AGBPage = () => {
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
          <h1>Allgemeine Geschäftsbedingungen</h1>
          <p>Nutzungsbedingungen für DojoSoftware</p>
        </div>
      </section>

      {/* Content */}
      <section className="legal-content">
        <div className="container">
          <article className="legal-article">

            {/* §1 Geltungsbereich */}
            <div className="legal-block">
              <h2>§ 1 Geltungsbereich</h2>
              <p>
                (1) Diese Allgemeinen Geschäftsbedingungen (nachfolgend „AGB") gelten für alle
                Verträge zwischen TDA International (nachfolgend „Anbieter") und dem Kunden
                (nachfolgend „Nutzer") über die Nutzung der Software-as-a-Service-Lösung
                „DojoSoftware".
              </p>
              <p>
                (2) Abweichende, entgegenstehende oder ergänzende AGB des Nutzers werden nur
                dann Vertragsbestandteil, wenn und soweit der Anbieter ihrer Geltung
                ausdrücklich schriftlich zugestimmt hat.
              </p>
              <p>
                (3) Die AGB gelten auch für alle künftigen Geschäfte zwischen den Parteien,
                soweit es sich um Rechtsgeschäfte verwandter Art handelt.
              </p>
            </div>

            {/* §2 Vertragsgegenstand */}
            <div className="legal-block">
              <h2>§ 2 Vertragsgegenstand</h2>
              <p>
                (1) Gegenstand des Vertrages ist die Bereitstellung der cloudbasierten
                Software „DojoSoftware" zur Verwaltung von Kampfsportschulen, Vereinen
                und Dojos (nachfolgend „Software").
              </p>
              <p>
                (2) Die Software wird als Software-as-a-Service (SaaS) über das Internet
                bereitgestellt. Der Anbieter stellt dem Nutzer die Software zur Nutzung
                über einen Webbrowser zur Verfügung.
              </p>
              <p>
                (3) Der Funktionsumfang richtet sich nach dem gewählten Tarif
                (Basic, Starter, Professional, Premium oder Enterprise).
              </p>
            </div>

            {/* §3 Registrierung */}
            <div className="legal-block">
              <h2>§ 3 Registrierung und Nutzerkonto</h2>
              <p>
                (1) Die Nutzung der Software setzt eine Registrierung voraus. Der Nutzer
                verpflichtet sich, bei der Registrierung wahrheitsgemäße Angaben zu machen.
              </p>
              <p>
                (2) Jeder Nutzer darf nur ein Konto anlegen. Das Konto ist nicht übertragbar.
              </p>
              <p>
                (3) Der Nutzer ist verpflichtet, seine Zugangsdaten geheim zu halten und
                vor dem Zugriff Dritter zu schützen. Bei Verdacht auf Missbrauch ist der
                Anbieter unverzüglich zu informieren.
              </p>
              <p>
                (4) Der Anbieter behält sich vor, Registrierungen ohne Angabe von Gründen
                abzulehnen.
              </p>
            </div>

            {/* §4 Kostenlose Testphase */}
            <div className="legal-block">
              <h2>§ 4 Kostenlose Testphase</h2>
              <p>
                (1) Der Anbieter bietet eine kostenlose Testphase von 14 Tagen an.
                Während dieser Zeit kann der volle Funktionsumfang genutzt werden.
              </p>
              <p>
                (2) Nach Ablauf der Testphase wird der Zugang eingeschränkt, sofern
                kein kostenpflichtiger Tarif gewählt wird.
              </p>
              <p>
                (3) Es besteht keine automatische Umwandlung in ein kostenpflichtiges
                Abonnement. Eine Kreditkarte ist für die Testphase nicht erforderlich.
              </p>
            </div>

            {/* §5 Preise und Zahlung */}
            <div className="legal-block">
              <h2>§ 5 Preise und Zahlung</h2>
              <p>
                (1) Die aktuellen Preise sind auf der Website unter „Preise" einsehbar.
                Alle Preise verstehen sich als Nettopreise zuzüglich der gesetzlichen
                Mehrwertsteuer.
              </p>
              <p>
                (2) Die Abrechnung erfolgt monatlich oder jährlich im Voraus, je nach
                gewähltem Zahlungsintervall. Bei jährlicher Zahlung wird ein Rabatt gewährt.
              </p>
              <p>
                (3) Die Zahlung erfolgt per SEPA-Lastschrift oder Kreditkarte über den
                Zahlungsdienstleister Stripe.
              </p>
              <p>
                (4) Bei Zahlungsverzug ist der Anbieter berechtigt, den Zugang zur
                Software vorübergehend zu sperren, bis die ausstehenden Zahlungen
                beglichen sind.
              </p>
            </div>

            {/* §6 Laufzeit und Kündigung */}
            <div className="legal-block">
              <h2>§ 6 Laufzeit und Kündigung</h2>
              <p>
                (1) Der Vertrag wird auf unbestimmte Zeit geschlossen und kann von
                beiden Parteien mit einer Frist von einem Monat zum Ende des
                Abrechnungszeitraums gekündigt werden.
              </p>
              <p>
                (2) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund
                bleibt unberührt.
              </p>
              <p>
                (3) Die Kündigung kann über die Kontoeinstellungen oder per E-Mail
                an support@dojo.tda-intl.org erfolgen.
              </p>
              <p>
                (4) Nach Vertragsende werden die Daten des Nutzers nach einer
                Übergangsfrist von 30 Tagen gelöscht, sofern keine gesetzlichen
                Aufbewahrungspflichten entgegenstehen. Der Nutzer kann vor der
                Löschung einen Datenexport anfordern.
              </p>
            </div>

            {/* §7 Pflichten des Nutzers */}
            <div className="legal-block">
              <h2>§ 7 Pflichten des Nutzers</h2>
              <p>(1) Der Nutzer verpflichtet sich:</p>
              <ul>
                <li>die Software nur im Rahmen der geltenden Gesetze zu nutzen;</li>
                <li>keine Inhalte zu speichern oder zu verbreiten, die rechtswidrig sind;</li>
                <li>die Datenschutzbestimmungen (DSGVO) bei der Verarbeitung von
                    Mitgliederdaten einzuhalten;</li>
                <li>regelmäßig Datensicherungen durchzuführen oder den Export-Service
                    des Anbieters zu nutzen;</li>
                <li>den Anbieter über technische Probleme unverzüglich zu informieren.</li>
              </ul>
              <p>
                (2) Der Nutzer ist für alle Aktivitäten verantwortlich, die über sein
                Konto erfolgen.
              </p>
              <p>
                (3) Der Nutzer stellt den Anbieter von allen Ansprüchen Dritter frei,
                die aufgrund einer Verletzung dieser Pflichten entstehen.
              </p>
            </div>

            {/* §8 Leistungen des Anbieters */}
            <div className="legal-block">
              <h2>§ 8 Leistungen des Anbieters</h2>
              <p>
                (1) Der Anbieter stellt die Software mit einer Verfügbarkeit von
                99% im Jahresmittel bereit. Geplante Wartungsarbeiten werden
                mindestens 48 Stunden vorher angekündigt.
              </p>
              <p>
                (2) Der Anbieter führt regelmäßige Backups der Nutzerdaten durch.
              </p>
              <p>
                (3) Support wird per E-Mail bereitgestellt. Die Reaktionszeit
                richtet sich nach dem gewählten Tarif.
              </p>
              <p>
                (4) Der Anbieter behält sich vor, die Software weiterzuentwickeln
                und zu verbessern. Der vereinbarte Funktionsumfang bleibt dabei
                erhalten.
              </p>
            </div>

            {/* §9 Datenschutz */}
            <div className="legal-block">
              <h2>§ 9 Datenschutz</h2>
              <p>
                (1) Der Anbieter verarbeitet personenbezogene Daten gemäß der
                Datenschutz-Grundverordnung (DSGVO). Details sind in der{' '}
                <Link to="/datenschutz">Datenschutzerklärung</Link> beschrieben.
              </p>
              <p>
                (2) Für die Verarbeitung von Mitgliederdaten durch den Nutzer
                handelt der Anbieter als Auftragsverarbeiter gemäß Art. 28 DSGVO.
                Ein entsprechender Auftragsverarbeitungsvertrag (AVV) wird bei
                Vertragsschluss bereitgestellt.
              </p>
              <p>
                (3) Alle Daten werden auf Servern in Deutschland gespeichert.
              </p>
            </div>

            {/* §10 Haftung */}
            <div className="legal-block">
              <h2>§ 10 Haftung</h2>
              <p>
                (1) Der Anbieter haftet unbeschränkt für Schäden aus der Verletzung
                des Lebens, des Körpers oder der Gesundheit, die auf einer
                vorsätzlichen oder fahrlässigen Pflichtverletzung beruhen.
              </p>
              <p>
                (2) Für sonstige Schäden haftet der Anbieter nur, soweit diese auf
                einer vorsätzlichen oder grob fahrlässigen Pflichtverletzung oder
                auf der schuldhaften Verletzung wesentlicher Vertragspflichten beruhen.
              </p>
              <p>
                (3) Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten
                ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt.
              </p>
              <p>
                (4) Der Anbieter haftet nicht für Schäden, die durch höhere Gewalt,
                Störungen im Internet oder durch Handlungen des Nutzers oder Dritter
                verursacht werden.
              </p>
              <p>
                (5) Der Anbieter haftet nicht für den Verlust von Daten, soweit der
                Schaden durch eine ordnungsgemäße Datensicherung des Nutzers hätte
                vermieden werden können.
              </p>
            </div>

            {/* §11 Geistiges Eigentum */}
            <div className="legal-block">
              <h2>§ 11 Geistiges Eigentum</h2>
              <p>
                (1) Alle Rechte an der Software, einschließlich Urheberrechte,
                Markenrechte und Know-how, verbleiben beim Anbieter.
              </p>
              <p>
                (2) Der Nutzer erhält ein einfaches, nicht übertragbares Nutzungsrecht
                für die Dauer des Vertrages.
              </p>
              <p>
                (3) Die vom Nutzer eingegebenen Daten verbleiben im Eigentum des Nutzers.
              </p>
            </div>

            {/* §12 Änderungen der AGB */}
            <div className="legal-block">
              <h2>§ 12 Änderungen der AGB</h2>
              <p>
                (1) Der Anbieter behält sich vor, diese AGB zu ändern, soweit dies
                erforderlich ist und den Nutzer nicht unangemessen benachteiligt.
              </p>
              <p>
                (2) Änderungen werden dem Nutzer mindestens 30 Tage vor Inkrafttreten
                per E-Mail mitgeteilt. Widerspricht der Nutzer nicht innerhalb von
                14 Tagen nach Zugang der Änderungsmitteilung, gelten die Änderungen
                als genehmigt.
              </p>
              <p>
                (3) Bei Widerspruch hat der Anbieter das Recht, den Vertrag zum
                Zeitpunkt des Inkrafttretens der Änderungen zu kündigen.
              </p>
            </div>

            {/* §13 Schlussbestimmungen */}
            <div className="legal-block">
              <h2>§ 13 Schlussbestimmungen</h2>
              <p>
                (1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss
                des UN-Kaufrechts.
              </p>
              <p>
                (2) Ist der Nutzer Kaufmann, juristische Person des öffentlichen Rechts
                oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand für alle
                Streitigkeiten aus diesem Vertrag der Geschäftssitz des Anbieters.
              </p>
              <p>
                (3) Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden,
                bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.
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
            <Link to="/datenschutz">Datenschutz</Link>
            <Link to="/impressum">Impressum</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AGBPage;
