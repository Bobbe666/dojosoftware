// Wiederverwendbare Vertragsformular-Komponente
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/MitgliedDetail.css';

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
  mitgliedId = null
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
      // Wenn keine Altersgruppe definiert, zeige den Tarif
      if (!tarif.altersgruppe) return true;

      const gruppe = tarif.altersgruppe.toLowerCase();

      // Schüler/Studenten über 18 Jahre
      if (istSchuelerStudent && age >= 18) {
        // Zeige Schüler/Studenten-Tarife UND Kinder/Jugendliche-Tarife (gleiche Preise)
        if (gruppe.includes('schüler') || gruppe.includes('schueler') ||
            gruppe.includes('student') || gruppe.includes('kind') ||
            gruppe.includes('jugend')) {
          return true;
        }
      }

      // Kinder (bis 12 Jahre)
      if (gruppe.includes('kind') || gruppe.includes('kinder')) {
        return age <= 12;
      }

      // Jugendliche (13-17 Jahre)
      if (gruppe.includes('jugend')) {
        return age >= 13 && age <= 17;
      }

      // Schüler/Studenten - speziell für Ü18
      if (gruppe.includes('schüler') || gruppe.includes('schueler') || gruppe.includes('student')) {
        return istSchuelerStudent && age >= 18;
      }

      // Erwachsene (18+ Jahre) - NICHT für Schüler/Studenten
      if (gruppe.includes('erwachsen') || gruppe.includes('adult')) {
        return age >= 18 && !istSchuelerStudent;
      }

      // Senioren (60+ Jahre)
      if (gruppe.includes('senior')) {
        return age >= 60;
      }

      // Familie/Familientarife - immer anzeigen
      if (gruppe.includes('familie') || gruppe.includes('family')) {
        return true;
      }

      return true;
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
        // Tarife laden
        const tarifeRes = await axios.get('/tarife');
        let allTarife = tarifeRes.data?.data || tarifeRes.data || [];

        // Filtere archivierte Tarife heraus (alte Tarife nicht für neue Mitglieder)
        const aktiveTarife = allTarife.filter(tarif => !tarif.ist_archiviert);

        // Filtere nach Alter und Schüler/Student-Status
        const age = calculateAge(geburtsdatum);
        const filteredTarife = filterTarifeByAge(aktiveTarife, age, schuelerStudent);
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
            const allMandate = mandateRes.data || [];
            const aktiv = allMandate.find(m => m.status === 'aktiv');
            const archiviert = allMandate.filter(m => m.status === 'archiviert');
            setSepaMandate(aktiv || null);
            setArchivierteMandate(archiviert);
          } catch (err) {
            console.warn('Keine SEPA-Mandate gefunden:', err);
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
    return <div style={{ padding: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>Lade Vertragsdaten...</div>;
  }

  return (
    <div className="vertrag-formular">
      <div className="form-grid" style={{ gap: '1rem' }}>
        {/* Tarif Auswahl */}
        <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Tarif *</label>
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
                aufnahmegebuehr_cents: selectedTarif?.aufnahmegebuehr_cents || 4999,
                vertragsende: calculatedEnde
              });
            }}
            style={{ padding: '0.6rem 0.75rem', fontSize: '0.9rem', lineHeight: '1.5', minHeight: '44px', height: 'auto' }}
          >
            <option value="">Tarif auswählen</option>
            {tarife.map(tarif => (
              <option key={tarif.id} value={tarif.id}>
                {tarif.mindestlaufzeit_monate === 12 && '⭐ '}
                {tarif.name} - €{(tarif.price_cents / 100).toFixed(2)}/{translateBillingCycle(tarif.billing_cycle)}
                {tarif.mindestlaufzeit_monate && ` (${tarif.mindestlaufzeit_monate} Monate)`}
                {tarif.altersgruppe && ` - ${tarif.altersgruppe}`}
              </option>
            ))}
          </select>
          {tarife.length === 0 && (
            <p style={{ fontSize: '0.75rem', color: '#F59E0B', marginTop: '0.3rem', marginBottom: 0 }}>
              ⚠️ Keine passenden Tarife gefunden
            </p>
          )}
        </div>

        {/* Zahlungsintervall & Vertragsbeginn */}
        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Zahlungsintervall *</label>
          <select
            value={vertrag.billing_cycle || ''}
            onChange={(e) => onChange({...vertrag, billing_cycle: e.target.value})}
            style={{ padding: '0.6rem 0.75rem', fontSize: '0.9rem', lineHeight: '1.5', minHeight: '44px', height: 'auto' }}
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

        <div className="form-group" style={{ marginBottom: '0.5rem' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>Vertragsbeginn *</label>
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
            style={{ padding: '0.6rem 0.75rem', fontSize: '0.9rem', lineHeight: '1.5', minHeight: '44px', height: 'auto' }}
          />
        </div>

        {/* Zahlungsbetrag Anzeige */}
        {vertrag.tarif_id && vertrag.billing_cycle && (() => {
          const paymentInfo = calculatePaymentAmount();
          if (!paymentInfo) return null;

          return (
            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
              <div style={{
                padding: '0.8rem',
                background: paymentInfo.discount > 0 ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(255, 255, 255, 0.12) 100%)' : 'rgba(255, 255, 255, 0.08)',
                border: paymentInfo.discount > 0 ? '2px solid rgba(16, 185, 129, 0.5)' : '2px solid rgba(255, 215, 0, 0.3)',
                borderRadius: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h5 style={{
                      margin: '0 0 0.3rem 0',
                      color: paymentInfo.discount > 0 ? '#10B981' : '#ffd700',
                      fontSize: '0.85rem',
                      fontWeight: '700'
                    }}>
                      💶 Zahlungsbetrag pro {paymentInfo.period}
                    </h5>
                    {paymentInfo.discount > 0 && (
                      <div style={{ fontSize: '0.8rem', color: '#10B981', marginBottom: '0.2rem' }}>
                        <span style={{ textDecoration: 'line-through', opacity: '0.7', color: 'rgba(255, 255, 255, 0.6)' }}>
                          €{paymentInfo.originalAmount.toFixed(2)}
                        </span>
                        <span style={{ marginLeft: '0.4rem', fontWeight: '600', color: '#10B981' }}>
                          → €{paymentInfo.amount.toFixed(2)}
                        </span>
                      </div>
                    )}
                    {paymentInfo.discount === 0 && (
                      <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'rgba(255, 255, 255, 0.95)' }}>
                        €{paymentInfo.amount.toFixed(2)}
                      </div>
                    )}
                  </div>
                  {paymentInfo.discount > 0 && (
                    <div style={{
                      padding: '0.4rem 0.8rem',
                      background: '#10B981',
                      color: 'white',
                      borderRadius: '16px',
                      fontWeight: '700',
                      fontSize: '0.8rem'
                    }}>
                      🎉 {paymentInfo.discount}% Rabatt
                    </div>
                  )}
                </div>
                {paymentInfo.discount > 0 && (
                  <div style={{
                    marginTop: '0.3rem',
                    fontSize: '0.75rem',
                    color: '#10B981',
                    fontStyle: 'italic'
                  }}>
                    💰 Sie sparen €{(paymentInfo.originalAmount - paymentInfo.amount).toFixed(2)} im Jahr!
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Vertragszusammenfassung - Readonly Felder */}
        {vertrag.tarif_id && (
          <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '0.5rem', marginBottom: '1rem' }}>
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
                <div style={{ color: 'rgba(255, 255, 255, 0.9)', marginTop: '0.3rem' }}>
                  • Der Vertrag hat eine Mindestlaufzeit von <strong>{vertrag.mindestlaufzeit_monate || 12} Monaten</strong>, die vollständig abgelaufen sein muss<br/>
                  • Frühestmögliches Vertragsende: <strong>{vertrag.vertragsende ? new Date(vertrag.vertragsende).toLocaleDateString('de-DE') : 'N/A'}</strong><br/>
                  • Kündigung muss <strong>{vertrag.kuendigungsfrist_monate || 3} Monate</strong> vor Vertragsende eingehen<br/>
                  • Spätester Kündigungstermin: <strong>{calculateKuendigungsdatum()}</strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SEPA-Mandat bei Lastschrift */}
        {vertrag.payment_method === 'direct_debit' && mitgliedId && (
          <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', display: 'block' }}>SEPA-Mandat</label>
            <select
              value={vertrag.sepa_mandat_id || ''}
              onChange={(e) => onChange({...vertrag, sepa_mandat_id: e.target.value ? parseInt(e.target.value) : null})}
              style={{ padding: '0.6rem 0.75rem', fontSize: '0.9rem', lineHeight: '1.5', minHeight: '44px', height: 'auto' }}
            >
              <option value="">Kein SEPA-Mandat ausgewählt</option>
              {sepaMandate && (
                <option value={sepaMandate.id}>
                  ✓ Aktives Mandat: {sepaMandate.mandatsreferenz} - {sepaMandate.iban}
                </option>
              )}
              {archivierteMandate.map(mandat => (
                <option key={mandat.id} value={mandat.id}>
                  📋 Archiviert: {mandat.mandatsreferenz} - {mandat.iban} (bis {new Date(mandat.gueltig_bis).toLocaleDateString('de-DE')})
                </option>
              ))}
            </select>
            {!sepaMandate && archivierteMandate.length === 0 && (
              <p style={{ fontSize: '0.75rem', color: '#F59E0B', marginTop: '0.3rem', marginBottom: 0, fontStyle: 'italic' }}>
                ℹ️ Hinweis: Kein SEPA-Mandat vorhanden. {mitgliedId ? 'Sie können später ein SEPA-Mandat im Finanzen-Tab erstellen.' : 'Das SEPA-Mandat kann nach der Mitgliedserstellung hinzugefügt werden.'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Rechtliche Akzeptanzen */}
      <div className="vertrag-legal-box">
        <h4>📋 Rechtliche Dokumente & Einverständniserklärungen</h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div className={`vertrag-checkbox-wrapper ${vertrag.agb_akzeptiert ? 'checked' : ''}`}>
            <input
              type="checkbox"
              className="vertrag-checkbox"
              checked={vertrag.agb_akzeptiert || false}
              onChange={(e) => onChange({...vertrag, agb_akzeptiert: e.target.checked})}
            />
            <span className="vertrag-checkbox-label" style={{ fontSize: '0.8rem' }}>
              <strong>AGB akzeptiert *</strong> (Version {vertrag.agb_version || '1.0'})
              {' '}
              <button
                type="button"
                onClick={() => openDokument('agb')}
                style={{ marginLeft: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', background: 'rgba(255, 215, 0, 0.2)', border: '1px solid rgba(255, 215, 0, 0.5)', borderRadius: '4px', color: '#ffd700' }}
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
            <span className="vertrag-checkbox-label" style={{ fontSize: '0.8rem' }}>
              <strong>Datenschutzerklärung akzeptiert *</strong> (Version {vertrag.datenschutz_version || '1.0'})
              {' '}
              <button
                type="button"
                onClick={() => openDokument('dsgvo')}
                style={{ marginLeft: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', background: 'rgba(255, 215, 0, 0.2)', border: '1px solid rgba(255, 215, 0, 0.5)', borderRadius: '4px', color: '#ffd700' }}
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
            <span className="vertrag-checkbox-label" style={{ fontSize: '0.8rem' }}>
              <strong>Dojo-Regeln akzeptiert *</strong>
              {' '}
              <button
                type="button"
                onClick={() => openDokument('dojo_regeln')}
                style={{ marginLeft: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', background: 'rgba(255, 215, 0, 0.2)', border: '1px solid rgba(255, 215, 0, 0.5)', borderRadius: '4px', color: '#ffd700' }}
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
            <span className="vertrag-checkbox-label" style={{ fontSize: '0.8rem' }}>
              <strong>Hausordnung akzeptiert *</strong>
              {' '}
              <button
                type="button"
                onClick={() => openDokument('hausordnung')}
                style={{ marginLeft: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', background: 'rgba(255, 215, 0, 0.2)', border: '1px solid rgba(255, 215, 0, 0.5)', borderRadius: '4px', color: '#ffd700' }}
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
            <span className="vertrag-checkbox-label" style={{ fontSize: '0.8rem' }}>
              <strong>Haftungsausschluss akzeptiert</strong>
              {' '}
              <button
                type="button"
                onClick={() => openDokument('haftungsausschluss')}
                style={{ marginLeft: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.75rem', cursor: 'pointer', background: 'rgba(255, 215, 0, 0.2)', border: '1px solid rgba(255, 215, 0, 0.5)', borderRadius: '4px', color: '#ffd700' }}
              >
                📄 Anzeigen
              </button>
            </span>
          </div>

          <label className={`vertrag-checkbox-wrapper ${vertrag.gesundheitserklaerung ? 'checked' : ''}`} style={{ marginTop: '1rem' }}>
            <input
              type="checkbox"
              className="vertrag-checkbox"
              checked={vertrag.gesundheitserklaerung || false}
              onChange={(e) => onChange({...vertrag, gesundheitserklaerung: e.target.checked})}
            />
            <span className="vertrag-checkbox-label" style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.9)' }}>
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
            <span className="vertrag-checkbox-label" style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.9)' }}>
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '2rem'
          }}
          onClick={() => setShowDokumentModal(false)}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%)',
              borderRadius: '12px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              border: '1px solid rgba(255, 215, 0, 0.3)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: '1.5rem',
                borderBottom: '1px solid rgba(255, 215, 0, 0.2)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.05)'
              }}
            >
              <h3 style={{ margin: 0, color: '#ffd700', fontSize: '1.3rem' }}>
                {aktuellesDokument.titel}
              </h3>
              <button
                onClick={() => setShowDokumentModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffd700',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.5rem'
                }}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                padding: '1.5rem',
                overflowY: 'auto',
                maxHeight: 'calc(80vh - 100px)',
                color: 'rgba(255, 255, 255, 0.9)',
                lineHeight: '1.6'
              }}
            >
              {aktuellesDokument.text.split('\n').map((zeile, index) => (
                <p key={index} style={{ marginBottom: '0.8rem' }}>
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
