// Wiederverwendbare Vertragsformular-Komponente
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/MitgliedDetail.css';
import '../styles/VertragFormular.css';

/**
 * Wiederverwendbares Vertragsformular
 * Wird verwendet in:
 * - MitgliedDetail (Neuer Vertrag / Vertrag bearbeiten)
 * - NeuesMitgliedAnlegen (Schritt 6: Vertragsauswahl)
 */
const VertragFormular = ({
  vertrag,
  onChange,
  geburtsdatum = null,
  schuelerStudent = false,
  mode = 'create', // 'create' oder 'edit'
  showMindestlaufzeitOptions = true,
  mitgliedId = null,
  isPublic = false // Für öffentliche Registrierung ohne Auth
}) => {
  const [tarife, setTarife] = useState([]);
  const [zahlungszyklen, setZahlungszyklen] = useState([]);
  const [sepaMandate, setSepaMandate] = useState(null);
  const [archivierteMandate, setArchivierteMandate] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal für Dokumentenanzeige
  const [showDokumentModal, setShowDokumentModal] = useState(false);
  const [aktuellesDokument, setAktuellesDokument] = useState(null);
  const [dokumente, setDokumente] = useState({
    agb_text: '',
    dsgvo_text: '',
    dojo_regeln_text: '',
    hausordnung_text: '',
    haftungsausschluss_text: '',
    widerrufsbelehrung_text: ''
  });

  // Berechne Alter aus Geburtsdatum
  const calculateAge = (birthDate) => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  // Filtere Tarife nach Altersgruppe
  const filterTarifeByAge = (allTarife, age, istSchuelerStudent = false) => {
    if (age === null) return allTarife;

    return allTarife.filter(tarif => {
      const gruppe = tarif.altersgruppe ? tarif.altersgruppe.toLowerCase() : '';

      // Schüler/Studenten über 18 Jahre
      if (istSchuelerStudent && age >= 18) {
        // Zeige Schüler/Studenten-Tarife UND Kinder/Jugendliche-Tarife (gleiche Preise)
        if (gruppe.includes('schüler') || gruppe.includes('schueler') ||
            gruppe.includes('student') || gruppe.includes('kind') ||
            gruppe.includes('jugend')) {
          return true;
        }
        // Auch Tarife ohne Altersgruppe für Schüler/Studenten
        if (!tarif.altersgruppe) return true;
        return false;
      }

      // Kinder (bis 12 Jahre)
      if (age <= 12) {
        if (gruppe.includes('kind') || gruppe.includes('kinder')) {
          return true;
        }
        // Tarife ohne Altersgruppe auch für Kinder
        if (!tarif.altersgruppe) return true;
        return false;
      }

      // Jugendliche (13-17 Jahre)
      if (age >= 13 && age <= 17) {
        if (gruppe.includes('jugend') || gruppe.includes('kind') || gruppe.includes('kinder')) {
          return true;
        }
        // Tarife ohne Altersgruppe auch für Jugendliche
        if (!tarif.altersgruppe) return true;
        return false;
      }

      // Erwachsene (18+ Jahre) - NICHT Schüler/Studenten
      if (age >= 18 && !istSchuelerStudent) {
        // NUR Erwachsenen-Tarife oder Tarife ohne Altersgruppe
        if (gruppe.includes('erwachsen') || gruppe.includes('adult') || !tarif.altersgruppe) {
          return true;
        }
        // KEINE Kinder/Jugend/Schüler-Tarife für normale Erwachsene
        return false;
      }

      // Senioren (60+ Jahre)
      if (age >= 60) {
        if (gruppe.includes('senior')) {
          return true;
        }
      }

      // Familie/Familientarife - immer anzeigen
      if (gruppe.includes('familie') || gruppe.includes('family')) {
        return true;
      }

      return false;
    });
  };

  // Sortiere Tarife nach Mindestlaufzeit (12 Monate zuerst)
  const sortTarifeByLaufzeit = (tarife) => {
    return [...tarife].sort((a, b) => {
      // 12-Monats-Verträge zuerst
      if (a.mindestlaufzeit_monate === 12 && b.mindestlaufzeit_monate !== 12) return -1;
      if (b.mindestlaufzeit_monate === 12 && a.mindestlaufzeit_monate !== 12) return 1;

      // Dann nach Mindestlaufzeit aufsteigend
      return (a.mindestlaufzeit_monate || 0) - (b.mindestlaufzeit_monate || 0);
    });
  };

  // Berechne Vertragsende automatisch aus Vertragsbeginn + Mindestlaufzeit
  const calculateVertragsende = (vertragsbeginn, mindestlaufzeit) => {
    if (!vertragsbeginn || !mindestlaufzeit) return '';

    const startDate = new Date(vertragsbeginn);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + mindestlaufzeit);

    return endDate.toISOString().split('T')[0];
  };

  // Automatische Berechnung von Vertragsende
  useEffect(() => {
    if (vertrag.vertragsbeginn && vertrag.mindestlaufzeit_monate) {
      const calculatedEnde = calculateVertragsende(vertrag.vertragsbeginn, vertrag.mindestlaufzeit_monate);
      if (calculatedEnde !== vertrag.vertragsende) {
        onChange({ ...vertrag, vertragsende: calculatedEnde });
      }
    }
  }, [vertrag.vertragsbeginn, vertrag.mindestlaufzeit_monate]);

  // Lade Tarife, Zahlungszyklen und SEPA-Mandate
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Tarife laden - bei öffentlicher Registrierung den public-Endpunkt verwenden
        const tarifeEndpoint = isPublic ? '/public/tarife' : '/tarife';
        const tarifeRes = await axios.get(tarifeEndpoint);
        let allTarife = tarifeRes.data?.data || tarifeRes.data || [];

        // Filtere archivierte Tarife heraus (alte Tarife nicht für neue Mitglieder)
        const aktiveTarife = allTarife.filter(tarif => !tarif.ist_archiviert);

        // Nur Monatsverträge (3, 6, 12 Monate) und 10er-Karten anzeigen
        const erlaubteTarife = aktiveTarife.filter(tarif => {
          const is10erKarte = tarif.name && (
            tarif.name.toLowerCase().includes('10er') ||
            tarif.name.toLowerCase().includes('10-er') ||
            tarif.name.toLowerCase().includes('zehnerkarte')
          );
          const istMonatsVertrag = [3, 6, 12].includes(parseInt(tarif.duration_months));

          return is10erKarte || istMonatsVertrag;
        });

        // Filtere nach Alter und Schüler/Student-Status
        const age = calculateAge(geburtsdatum);
        const filteredTarife = filterTarifeByAge(erlaubteTarife, age, schuelerStudent);
        const sortedTarife = sortTarifeByLaufzeit(filteredTarife);
        setTarife(sortedTarife);

        // Zahlungszyklen laden
        const zyklenRes = await axios.get('/zahlungszyklen');
        setZahlungszyklen(zyklenRes.data || []);

        // Dokumente laden (AGB, DSGVO, etc.)
        try {
          const dokumenteRes = await axios.get('/dojo/dokumente');
          setDokumente(dokumenteRes.data || {
            agb_text: '',
            dsgvo_text: '',
            dojo_regeln_text: '',
            hausordnung_text: '',
            haftungsausschluss_text: ''
          });
        } catch (err) {
          console.warn('Fehler beim Laden der Dokumente:', err);
        }

        // SEPA-Mandate laden (nur wenn mitgliedId vorhanden)
        if (mitgliedId) {
          try {
            const mandateRes = await axios.get(`/mitglieder/${mitgliedId}/sepa-mandate`);
            // Backend gibt einzelnes Objekt zurück, nicht Array
            const mandateData = mandateRes.data;
            if (mandateData && mandateData.mandat_id) {
              setSepaMandate(mandateData);
            } else {
              setSepaMandate(null);
            }
          } catch (err) {
            console.warn('Keine SEPA-Mandate gefunden:', err);
            setSepaMandate(null);
          }
          // Archivierte Mandate separat laden
          try {
            const archivRes = await axios.get(`/mitglieder/${mitgliedId}/sepa-mandate/archiv`);
            setArchivierteMandate(archivRes.data || []);
          } catch {
            setArchivierteMandate([]);
          }
        }

        // Wenn 12-Monats-Vertrag vorhanden und noch kein Tarif gewählt, diesen vorauswählen
        if (!vertrag.tarif_id && sortedTarife.length > 0) {
          const tarif12 = sortedTarife.find(t => t.mindestlaufzeit_monate === 12);
          if (tarif12) {
            const calculatedEnde = calculateVertragsende(vertrag.vertragsbeginn, tarif12.mindestlaufzeit_monate);
            onChange({
              ...vertrag,
              tarif_id: tarif12.id,
              mindestlaufzeit_monate: tarif12.mindestlaufzeit_monate,
              kuendigungsfrist_monate: tarif12.kuendigungsfrist_monate,
              vertragsende: calculatedEnde
            });
          }
        }
      } catch (error) {
        console.error('❌ Fehler beim Laden der Daten:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [geburtsdatum, mitgliedId, schuelerStudent]);

  // Berechne Kündigungsdatum
  const calculateKuendigungsdatum = () => {
    if (!vertrag.vertragsende || !vertrag.kuendigungsfrist_monate) return 'N/A';

    const ende = new Date(vertrag.vertragsende);
    const kuendigungsDatum = new Date(ende);
    kuendigungsDatum.setMonth(kuendigungsDatum.getMonth() - vertrag.kuendigungsfrist_monate);

    return kuendigungsDatum.toLocaleDateString('de-DE');
  };

  // Übersetze billing_cycle ins Deutsche
  const translateBillingCycle = (cycle) => {
    if (!cycle) return '';
    const cycleMap = {
      'monthly': 'Monat',
      'monatlich': 'Monat',
      'quarterly': 'Quartal',
      'vierteljaehrlich': 'Quartal',
      'semi-annually': 'Halbjahr',
      'halbjaehrlich': 'Halbjahr',
      'annually': 'Jahr',
      'jaehrlich': 'Jahr',
      'yearly': 'Jahr'
    };
    return cycleMap[cycle.toLowerCase()] || cycle;
  };

  // Öffne Dokument-Modal
  const openDokument = (dokumentTyp) => {
    const dokumentTitel = {
      agb: 'Allgemeine Geschäftsbedingungen (AGB)',
      dsgvo: 'Datenschutzerklärung (DSGVO)',
      dojo_regeln: 'Dojo-Regeln',
      hausordnung: 'Hausordnung',
      haftungsausschluss: 'Haftungsausschluss',
      widerruf: 'Widerrufsbelehrung'
    };

    setAktuellesDokument({
      titel: dokumentTitel[dokumentTyp] || dokumentTyp,
      text: dokumente[`${dokumentTyp === 'widerruf' ? 'widerrufsbelehrung' : dokumentTyp}_text`] || 'Kein Inhalt vorhanden.'
    });
    setShowDokumentModal(true);
  };

  // Berechne Zahlungsbetrag basierend auf Intervall
  const calculatePaymentAmount = () => {
    const selectedTarif = tarife.find(t => t.id === parseInt(vertrag.tarif_id));
    if (!selectedTarif || !vertrag.billing_cycle) return null;

    const monthlyPrice = selectedTarif.price_cents / 100; // Cents zu Euro
    const cycle = vertrag.billing_cycle.toLowerCase();

    // Monatlich / Monthly
    if (cycle === 'monthly' || cycle === 'monatlich') {
      return {
        amount: monthlyPrice,
        originalAmount: monthlyPrice,
        discount: 0,
        period: 'Monat'
      };
    }

    // Vierteljährlich / Quarterly
    if (cycle === 'quarterly' || cycle === 'vierteljährlich') {
      return {
        amount: monthlyPrice * 3,
        originalAmount: monthlyPrice * 3,
        discount: 0,
        period: 'Quartal'
      };
    }

    // Jährlich / Yearly - mit 10% Rabatt
    if (cycle === 'yearly' || cycle === 'jährlich') {
      const yearlyOriginal = monthlyPrice * 12;
      const yearlyDiscounted = yearlyOriginal * 0.9; // 10% Rabatt
      return {
        amount: yearlyDiscounted,
        originalAmount: yearlyOriginal,
        discount: 10,
        period: 'Jahr'
      };
    }

    return null;
  };

  if (loading) {
    return <div className="vf-loading">Lade Vertragsdaten...</div>;
  }

  return (
    <div className="vertrag-formular">
      <div className="form-grid vf-gap-1">
        {/* Tarif Auswahl */}
        <div className="form-group vf-full-col">
          <label className="vf-label">Tarif *</label>
          <select
            value={vertrag.tarif_id || ''}
            onChange={(e) => {
              const selectedTarif = tarife.find(t => t.id === parseInt(e.target.value));
              const mindestlaufzeit = selectedTarif?.mindestlaufzeit_monate || 12;
              const calculatedEnde = calculateVertragsende(vertrag.vertragsbeginn, mindestlaufzeit);

              onChange({
                ...vertrag,
                tarif_id: e.target.value,
                mindestlaufzeit_monate: mindestlaufzeit,
                kuendigungsfrist_monate: selectedTarif?.kuendigungsfrist_monate || 3,
                aufnahmegebuehr_cents: selectedTarif?.aufnahmegebuehr_cents ?? 4999,
                billing_cycle: selectedTarif?.billing_cycle?.toLowerCase() || vertrag.billing_cycle,
                monatsbeitrag: selectedTarif ? selectedTarif.price_cents / 100 : vertrag.monatsbeitrag,
                vertragsende: calculatedEnde
              });
            }}
            className="vf-select"
          >
            <option value="">Tarif auswählen</option>
            {tarife.map(tarif => (
              <option key={tarif.id} value={tarif.id}>
                {tarif.mindestlaufzeit_monate === 12 && '⭐ '}
                {tarif.name} - €{(tarif.price_cents / 100).toFixed(2)}/{translateBillingCycle(tarif.billing_cycle)}
                {tarif.mindestlaufzeit_monate && ` (${tarif.mindestlaufzeit_monate} Monate)`}
                {tarif.altersgruppe && ` - ${tarif.altersgruppe}`}
                {tarif.aufnahmegebuehr_cents > 0 && ` + €${(tarif.aufnahmegebuehr_cents / 100).toFixed(2)} Aufnahmegebühr`}
              </option>
            ))}
          </select>
          {tarife.length === 0 && (
            <p className="vf-field-warning">
              ⚠️ Keine passenden Tarife gefunden
            </p>
          )}
        </div>

        {/* Zahlungsintervall & Vertragsbeginn */}
        <div className="form-group vf-form-group-mb">
          <label className="vf-label">Zahlungsintervall *</label>
          <select
            value={vertrag.billing_cycle || ''}
            onChange={(e) => onChange({...vertrag, billing_cycle: e.target.value})}
            className="vf-select"
          >
            <option value="">Bitte wählen...</option>
            {zahlungszyklen.length > 0 ? (
              zahlungszyklen.map(zyklus => {
                const cycleValue = zyklus.name?.toLowerCase() || zyklus.intervall?.toLowerCase() || '';
                return (
                  <option key={zyklus.id || zyklus.zyklus_id} value={cycleValue}>
                    {zyklus.name || zyklus.intervall}
                  </option>
                );
              })
            ) : (
              <>
                <option value="monthly">Monatlich</option>
                <option value="quarterly">Vierteljährlich</option>
                <option value="yearly">Jährlich (10% Rabatt)</option>
              </>
            )}
          </select>
        </div>

        <div className="form-group vf-form-group-mb">
          <label className="vf-label">Vertragsbeginn *</label>
          <input
            type="date"
            value={vertrag.vertragsbeginn || ''}
            onChange={(e) => {
              const calculatedEnde = calculateVertragsende(e.target.value, vertrag.mindestlaufzeit_monate);
              onChange({
                ...vertrag,
                vertragsbeginn: e.target.value,
                vertragsende: calculatedEnde
              });
            }}
            className="vf-select"
          />
        </div>

        {/* Zahlungsbetrag Anzeige */}
        {vertrag.tarif_id && vertrag.billing_cycle && (() => {
          const paymentInfo = calculatePaymentAmount();
          if (!paymentInfo) return null;

          return (
            <div className="form-group vf-full-col">
              <div className={`vf-price-box${paymentInfo.discount > 0 ? ' vf-price-box--discount' : ' vf-price-box--standard'}`}>
                <div className="vf-price-row">
                  <div>
                    <h5 className={`vf-price-heading${paymentInfo.discount > 0 ? ' vf-price-heading--discount' : ''}`}>
                      💶 Zahlungsbetrag pro {paymentInfo.period}
                    </h5>
                    {paymentInfo.discount > 0 && (
                      <div className="vf-success-note">
                        <span className="vf-price-strike">
                          €{paymentInfo.originalAmount.toFixed(2)}
                        </span>
                        <span className="vf-discount-amount">
                          → €{paymentInfo.amount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {paymentInfo.discount === 0 && (
                      <div className="vf-price-strong">
                        €{paymentInfo.amount.toFixed(2)}
                      </div>
                    )}
                  </div>
                  {paymentInfo.discount > 0 && (
                    <div className="vf-discount-badge">
                      🎉 {paymentInfo.discount}% Rabatt
                    </div>
                  )}
                </div>
                {paymentInfo.discount > 0 && (
                  <div className="vf-savings-note">
                    💰 Sie sparen €{(paymentInfo.originalAmount - paymentInfo.amount).toFixed(2)} im Jahr!
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Vertragszusammenfassung - Readonly Felder */}
        {vertrag.tarif_id && (
          <div className="form-group vf-full-col-top">
            <div className="vertrag-info-box">
              <h4>📋 Vertragszusammenfassung</h4>

              <div className="info-grid">
                <div>
                  <div className="info-label">Vertragsende (automatisch):</div>
                  <div className="info-value">
                    {vertrag.vertragsende ? new Date(vertrag.vertragsende).toLocaleDateString('de-DE') : 'N/A'}
                  </div>
                </div>

                <div>
                  <div className="info-label">Mindestlaufzeit:</div>
                  <div className="info-value">
                    {vertrag.mindestlaufzeit_monate || 12} Monate
                  </div>
                </div>

                <div>
                  <div className="info-label">Kündigungsfrist:</div>
                  <div className="info-value">
                    {vertrag.kuendigungsfrist_monate || 3} Monate
                  </div>
                </div>

                <div>
                  <div className="info-label">Zahlungsmethode:</div>
                  <div className="info-value">
                    SEPA-Lastschrift
                  </div>
                </div>
              </div>

              <div className="vertrag-warning-box">
                <strong>⚠️ Wichtig zur Kündigung:</strong>
                <div className="vf-text-primary-mt">
                  • Der Vertrag hat eine Mindestlaufzeit von <strong>{vertrag.mindestlaufzeit_monate || 12} Monaten</strong>, die vollständig abgelaufen sein muss<br/>
                  • Frühestmögliches Vertragsende: <strong>{vertrag.vertragsende ? new Date(vertrag.vertragsende).toLocaleDateString('de-DE') : 'N/A'}</strong><br/>
                  • Kündigung muss <strong>{vertrag.kuendigungsfrist_monate || 3} Monate</strong> vor Vertragsende eingehen<br/>
                  • Spätester Kündigungstermin: <strong>{calculateKuendigungsdatum()}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SEPA-Mandat - PFLICHTFELD für Lastschrift */}
        {mitgliedId && (
          <div className="form-group vf-full-col">
            <label className="vf-label">
              SEPA-Mandat <span className="u-text-error">*</span>
            </label>
            <select
              value={vertrag.sepa_mandat_id || ''}
              onChange={(e) => onChange({...vertrag, sepa_mandat_id: e.target.value ? parseInt(e.target.value) : null})}
              className={`vf-select${!vertrag.sepa_mandat_id && (sepaMandate || archivierteMandate.length > 0) ? ' vf-select--error' : ''}`}
            >
              <option value="">-- Bitte SEPA-Mandat auswählen --</option>
              {sepaMandate && (
                <option value={sepaMandate.mandat_id}>
                  ✓ Aktives Mandat: {sepaMandate.mandatsreferenz} - {sepaMandate.iban}
                </option>
              )}
              {archivierteMandate.map(mandat => (
                <option key={mandat.mandat_id} value={mandat.mandat_id}>
                  📋 Archiviert: {mandat.mandatsreferenz} - {mandat.iban} {mandat.widerruf_datum ? `(widerrufen ${new Date(mandat.widerruf_datum).toLocaleDateString('de-DE')})` : ''}
                </option>
              ))}
            </select>

            {/* Fehler: Kein Mandat ausgewählt aber Mandate vorhanden */}
            {!vertrag.sepa_mandat_id && (sepaMandate || archivierteMandate.length > 0) && (
              <p className="vf-notice vf-notice-error">
                ⚠️ <strong>Pflichtfeld:</strong> Bitte wählen Sie ein SEPA-Mandat aus. Ohne SEPA-Mandat kann keine Lastschrift eingezogen werden.
              </p>
            )}

            {/* Hinweis: Kein Mandat vorhanden */}
            {!sepaMandate && archivierteMandate.length === 0 && (
              <p className="vf-notice vf-notice-warning">
                ⚠️ <strong>Kein SEPA-Mandat vorhanden!</strong> Bitte erstellen Sie zuerst ein SEPA-Mandat im Finanzen-Tab, bevor Sie den Vertrag speichern.
              </p>
            )}

            {/* Bestätigung: Mandat ausgewählt */}
            {vertrag.sepa_mandat_id && (
              <p className="vf-notice vf-notice-success">
                ✓ SEPA-Mandat ausgewählt. Lastschriften können eingezogen werden.
              </p>
            )}
          </div>
        )}

        {/* Hinweis für neue Mitglieder ohne ID */}
        {!mitgliedId && (
          <div className="form-group vf-full-col">
            <div className="vf-info-box">
              <strong>💳 SEPA-Lastschriftmandat:</strong>
              <p className="vf-secondary-para">
                Das SEPA-Mandat wird nach dem Speichern des Mitglieds im Finanzen-Tab erstellt.
                Ohne gültiges SEPA-Mandat können keine Lastschriften eingezogen werden.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Rechtliche Akzeptanzen */}
      <div className="vertrag-legal-box">
        <h4>📋 Rechtliche Dokumente & Einverständniserklärungen</h4>

        <div className="u-flex-col-sm">
          <div className={`vertrag-checkbox-wrapper ${vertrag.agb_akzeptiert ? 'checked' : ''}`}>
            <input
              type="checkbox"
              className="vertrag-checkbox"
              checked={vertrag.agb_akzeptiert || false}
              onChange={(e) => onChange({...vertrag, agb_akzeptiert: e.target.checked})}
            />
            <span className="vertrag-checkbox-label vf-small">
              <strong>AGB akzeptiert *</strong> (Version {vertrag.agb_version || '1.0'})
              {' '}
              <button
                type="button"
                onClick={() => openDokument('agb')}
                className="vf-gold-btn"
              >
                📄 Anzeigen
              </button>
            </span>
          </div>

          <div className={`vertrag-checkbox-wrapper ${vertrag.datenschutz_akzeptiert ? 'checked' : ''}`}>
            <input
              type="checkbox"
              className="vertrag-checkbox"
              checked={vertrag.datenschutz_akzeptiert || false}
              onChange={(e) => onChange({...vertrag, datenschutz_akzeptiert: e.target.checked})}
            />
            <span className="vertrag-checkbox-label vf-small">
              <strong>Datenschutzerklärung akzeptiert *</strong> (Version {vertrag.datenschutz_version || '1.0'})
              {' '}
              <button
                type="button"
                onClick={() => openDokument('dsgvo')}
                className="vf-gold-btn"
              >
                📄 Anzeigen
              </button>
            </span>
          </div>

          <div className={`vertrag-checkbox-wrapper ${vertrag.dojo_regeln_akzeptiert ? 'checked' : ''}`}>
            <input
              type="checkbox"
              className="vertrag-checkbox"
              checked={vertrag.dojo_regeln_akzeptiert || false}
              onChange={(e) => onChange({...vertrag, dojo_regeln_akzeptiert: e.target.checked})}
            />
            <span className="vertrag-checkbox-label vf-small">
              <strong>Dojo-Regeln akzeptiert *</strong>
              {' '}
              <button
                type="button"
                onClick={() => openDokument('dojo_regeln')}
                className="vf-gold-btn"
              >
                📄 Anzeigen
              </button>
            </span>
          </div>

          <div className={`vertrag-checkbox-wrapper ${vertrag.hausordnung_akzeptiert ? 'checked' : ''}`}>
            <input
              type="checkbox"
              className="vertrag-checkbox"
              checked={vertrag.hausordnung_akzeptiert || false}
              onChange={(e) => onChange({...vertrag, hausordnung_akzeptiert: e.target.checked})}
            />
            <span className="vertrag-checkbox-label vf-small">
              <strong>Hausordnung akzeptiert *</strong>
              {' '}
              <button
                type="button"
                onClick={() => openDokument('hausordnung')}
                className="vf-gold-btn"
              >
                📄 Anzeigen
              </button>
            </span>
          </div>

          <div className={`vertrag-checkbox-wrapper ${vertrag.haftungsausschluss_akzeptiert ? 'checked' : ''}`}>
            <input
              type="checkbox"
              className="vertrag-checkbox"
              checked={vertrag.haftungsausschluss_akzeptiert || false}
              onChange={(e) => onChange({...vertrag, haftungsausschluss_akzeptiert: e.target.checked})}
            />
            <span className="vertrag-checkbox-label vf-small">
              <strong>Haftungsausschluss akzeptiert</strong>
              {' '}
              <button
                type="button"
                onClick={() => openDokument('haftungsausschluss')}
                className="vf-gold-btn"
              >
                📄 Anzeigen
              </button>
            </span>
          </div>

          <label className={`vertrag-checkbox-wrapper ${vertrag.gesundheitserklaerung ? 'checked' : ''} vf-mt-1`}>
            <input
              type="checkbox"
              className="vertrag-checkbox"
              checked={vertrag.gesundheitserklaerung || false}
              onChange={(e) => onChange({...vertrag, gesundheitserklaerung: e.target.checked})}
            />
            <span className="vertrag-checkbox-label vf-small-primary">
              Gesundheitliche Eignung bestätigt
            </span>
          </label>

          <label className={`vertrag-checkbox-wrapper ${vertrag.foto_einverstaendnis ? 'checked' : ''}`}>
            <input
              type="checkbox"
              className="vertrag-checkbox"
              checked={vertrag.foto_einverstaendnis || false}
              onChange={(e) => onChange({...vertrag, foto_einverstaendnis: e.target.checked})}
            />
            <span className="vertrag-checkbox-label vf-small-primary">
              Foto/Video-Einwilligung erteilt
            </span>
          </label>
        </div>

        <p className="help-text">
          * Pflichtfelder - Zeitstempel werden automatisch bei Vertragsabschluss erfasst
        </p>
      </div>

      {/* Dokument-Anzeige Modal */}
      {showDokumentModal && aktuellesDokument && (
        <div
          className="vf-modal-overlay"
          onClick={() => setShowDokumentModal(false)}
        >
          <div
            className="vf-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="vf-modal-header">
              <h3 className="vf-doc-heading">
                {aktuellesDokument.titel}
              </h3>
              <button
                onClick={() => setShowDokumentModal(false)}
                className="vf-modal-close-btn"
              >
                ✕
              </button>
            </div>
            <div className="vf-modal-body">
              {aktuellesDokument.text.split('\n').map((zeile, index) => (
                <p key={index} className="vf-margin-bottom-08">
                  {zeile}
                </p>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VertragFormular;
