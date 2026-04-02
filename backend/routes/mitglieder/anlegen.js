/**
 * Route: Neues Mitglied anlegen (POST /)
 * Extrahiert aus mitglieder.js
 */
const express = require('express');
const logger = require('../../utils/logger');
const db = require('../../db');
const bcrypt = require('bcryptjs');
const auditLog = require('../../services/auditLogService');
const { requireFields, sanitizeStrings } = require('../../middleware/validation');
const { sendEmail, sendEmailForDojo } = require('../../services/emailService');
const router = express.Router();

router.post("/",
    requireFields(['vorname', 'nachname', 'geburtsdatum', 'dojo_id']),
    sanitizeStrings(['vorname', 'nachname', 'email', 'strasse', 'ort', 'bemerkungen']),
    (req, res) => {

    const memberData = req.body;

    // 🔄 DOKUMENTAKZEPTANZEN: Kopiere Daten vom Vertrag auch in mitglieder-Tabelle (für Auswertungen!)
    // Frontend sendet: vertrag_agb_akzeptiert, Backend braucht: agb_akzeptiert + agb_akzeptiert_am
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19); // MySQL-Format

    if (memberData.vertrag_agb_akzeptiert) {
        memberData.agb_akzeptiert = true;
        memberData.agb_akzeptiert_am = now;
    }
    if (memberData.vertrag_datenschutz_akzeptiert) {
        memberData.datenschutz_akzeptiert = true;
        memberData.datenschutz_akzeptiert_am = now;
    }
    if (memberData.vertrag_hausordnung_akzeptiert) {
        memberData.hausordnung_akzeptiert = true;
        memberData.hausordnung_akzeptiert_am = now;
    }
    if (memberData.vertrag_haftungsausschluss_akzeptiert) {
        memberData.haftungsausschluss_akzeptiert = true;
        memberData.haftungsausschluss_datum = now;
    }
    if (memberData.vertrag_gesundheitserklaerung) {
        memberData.gesundheitserklaerung = true;
        memberData.gesundheitserklaerung_datum = now;
    }
    if (memberData.vertrag_foto_einverstaendnis) {
        memberData.foto_einverstaendnis = true;
        memberData.foto_einverstaendnis_datum = now;
    }

    // 👨‍👩‍👧 SPEZIALFALL: existing_member_mode - Nur Familienmitglieder hinzufügen (kein neues Hauptmitglied)
    if (memberData.existing_member_mode && memberData.family_members && memberData.family_members.length > 0) {
        logger.info(`👨‍👩‍👧 Existing Member Mode: Füge ${memberData.family_members.length} Familienmitglieder zu bestehendem Mitglied hinzu`);

        // dojo_id vom bestehenden Mitglied holen wenn nicht vorhanden
        const dojoId = memberData.dojo_id || memberData.existing_member_dojo_id;
        if (!dojoId) {
            return res.status(400).json({ error: "dojo_id ist erforderlich für Familienmitglieder" });
        }

        const existingMemberId = memberData.existing_member_id;
        if (!existingMemberId) {
            return res.status(400).json({ error: "existing_member_id ist erforderlich für Familienmitglieder" });
        }

        // 1. Bestehende Mitgliederdaten holen (für familien_id und Vertreter-Info)
        db.query(
            'SELECT mitglied_id, familien_id, vorname, nachname, email, telefon FROM mitglieder WHERE mitglied_id = ?',
            [existingMemberId],
            (err, existingMemberRows) => {
                if (err || existingMemberRows.length === 0) {
                    logger.error('Fehler beim Abrufen des bestehenden Mitglieds:', err);
                    return res.status(404).json({ error: "Bestehendes Mitglied nicht gefunden" });
                }

                const existingMember = existingMemberRows[0];
                let familienId = existingMember.familien_id;

                // 2. Falls kein familien_id vorhanden, verwende mitglied_id als familien_id
                const ensureFamilienIdAndContinue = () => {
                    // Familienmitglieder erstellen mit familien_id und Vertreter-Info
                    const enrichedMainData = {
                        ...memberData,
                        familien_id: familienId,
                        vertreter_vorname: existingMember.vorname,
                        vertreter_nachname: existingMember.nachname,
                        vertreter_email: existingMember.email || memberData.email,
                        vertreter_telefon: existingMember.telefon || memberData.telefon
                    };

                    createFamilyMembers(memberData.family_members, enrichedMainData, dojoId, (famErr, createdFamilyMembers) => {
                        if (famErr) {
                            logger.error('Fehler beim Erstellen der Familienmitglieder:', famErr);
                            return res.status(500).json({ error: "Fehler beim Erstellen der Familienmitglieder" });
                        }

                        res.status(201).json({
                            success: true,
                            message: `${createdFamilyMembers.length} Familienmitglieder erfolgreich erstellt`,
                            family_members_created: createdFamilyMembers,
                            existing_member_id: existingMemberId,
                            familien_id: familienId
                        });
                    });
                };

                if (!familienId) {
                    // Setze mitglied_id als familien_id für das bestehende Mitglied
                    familienId = existingMemberId;
                    db.query(
                        'UPDATE mitglieder SET familien_id = ? WHERE mitglied_id = ?',
                        [familienId, existingMemberId],
                        (updateErr) => {
                            if (updateErr) {
                                logger.error('Fehler beim Setzen der familien_id:', updateErr);
                            } else {
                                logger.info(`✅ familien_id ${familienId} für bestehendes Mitglied ${existingMemberId} gesetzt`);
                            }
                            ensureFamilienIdAndContinue();
                        }
                    );
                } else {
                    ensureFamilienIdAndContinue();
                }
            }
        );
        return; // Wichtig: Hier aufhören, nicht weiter zum normalen Flow
    }

    // 🔒 KRITISCH: dojo_id ist PFLICHTFELD für Tax Compliance!
    if (!memberData.dojo_id) {
        logger.error('KRITISCHER FEHLER: Neues Mitglied ohne dojo_id!');
        return res.status(400).json({
            error: "dojo_id ist erforderlich - jedes Mitglied MUSS einem Dojo zugeordnet sein (Tax Compliance!)",
            required: ['vorname', 'nachname', 'geburtsdatum', 'dojo_id']
        });
    }

    // Erforderliche Felder prüfen
    const requiredFields = ['vorname', 'nachname', 'geburtsdatum', 'dojo_id'];
    const missingFields = requiredFields.filter(field => !memberData[field]);

    if (missingFields.length > 0) {
        return res.status(400).json({
            error: "Fehlende erforderliche Felder",
            missingFields
        });
    }

    // SQL Query für INSERT mit allen möglichen Feldern (inkl. dojo_id!)
    const fields = [
        'dojo_id',  // 🔒 KRITISCH: dojo_id MUSS als erstes kommen!
        'vorname', 'nachname', 'geburtsdatum', 'geschlecht', 'schueler_student', 'gewicht',
        'email', 'telefon', 'telefon_mobil', 'strasse', 'hausnummer',
        'plz', 'ort', 'iban', 'bic', 'bankname', 'kontoinhaber',
        'allergien', 'medizinische_hinweise', 'notfallkontakt_name',
        'notfallkontakt_telefon', 'notfallkontakt_verhaeltnis',
        'hausordnung_akzeptiert', 'hausordnung_akzeptiert_am',
        'datenschutz_akzeptiert', 'datenschutz_akzeptiert_am',
        'foto_einverstaendnis', 'foto_einverstaendnis_datum',
        'agb_akzeptiert', 'agb_akzeptiert_am',
        'haftungsausschluss_akzeptiert', 'haftungsausschluss_datum',
        'gesundheitserklaerung', 'gesundheitserklaerung_datum',
        'eintrittsdatum'
    ];

    const insertFields = fields.filter(field => memberData[field] !== undefined);
    const placeholders = insertFields.map(() => '?').join(', ');
    const values = insertFields.map(field => memberData[field]);

    const query = `
        INSERT INTO mitglieder (${insertFields.join(', ')})
        VALUES (${placeholders})
    `;

    db.query(query, values, (err, result) => {
        if (err) {
            logger.error('Fehler beim Erstellen des Mitglieds:', err);
            return res.status(500).json({
                error: "Fehler beim Erstellen des Mitglieds",
                details: err.message
            });
        }

        const newMemberId = result.insertId;

        // Audit-Log: Neues Mitglied erstellt
        auditLog.log({
            req,
            aktion: auditLog.AKTION.MITGLIED_ERSTELLT,
            kategorie: auditLog.KATEGORIE.MITGLIED,
            entityType: 'mitglieder',
            entityId: newMemberId,
            entityName: `${memberData.vorname} ${memberData.nachname}`,
            neueWerte: { vorname: memberData.vorname, nachname: memberData.nachname, dojo_id: memberData.dojo_id },
            beschreibung: `Neues Mitglied erstellt: ${memberData.vorname} ${memberData.nachname}`
        });

        // 🆕 VERTRAG AUTOMATISCH ERSTELLEN (wenn Vertragsdaten vorhanden)
        if (memberData.vertrag_tarif_id) {

            const vertragData = {
                mitglied_id: newMemberId,
                dojo_id: memberData.dojo_id,  // 🔒 KRITISCH: Tax Compliance!
                tarif_id: memberData.vertrag_tarif_id,
                kuendigungsfrist_monate: memberData.vertrag_kuendigungsfrist_monate || 3,
                mindestlaufzeit_monate: memberData.vertrag_mindestlaufzeit_monate || 12,
                automatische_verlaengerung: memberData.vertrag_automatische_verlaengerung !== undefined ? memberData.vertrag_automatische_verlaengerung : true,
                verlaengerung_monate: memberData.vertrag_verlaengerung_monate || 12,
                faelligkeit_tag: memberData.vertrag_faelligkeit_tag || 1,
                agb_akzeptiert_am: memberData.vertrag_agb_akzeptiert ? new Date() : null,
                agb_version: memberData.vertrag_agb_version || '1.0',
                datenschutz_akzeptiert_am: memberData.vertrag_datenschutz_akzeptiert ? new Date() : null,
                datenschutz_version: memberData.vertrag_datenschutz_version || '1.0',
                hausordnung_akzeptiert_am: memberData.vertrag_hausordnung_akzeptiert ? new Date() : null,
                haftungsausschluss_akzeptiert: memberData.vertrag_haftungsausschluss_akzeptiert ? 1 : 0,
                haftungsausschluss_datum: memberData.vertrag_haftungsausschluss_akzeptiert ? new Date() : null,
                gesundheitserklaerung: memberData.vertrag_gesundheitserklaerung ? 1 : 0,
                gesundheitserklaerung_datum: memberData.vertrag_gesundheitserklaerung ? new Date() : null,
                foto_einverstaendnis: memberData.vertrag_foto_einverstaendnis ? 1 : 0,
                foto_einverstaendnis_datum: memberData.vertrag_foto_einverstaendnis ? new Date() : null,
                status: 'aktiv',
                unterschrift_datum: new Date()
            };

            const vertragFields = Object.keys(vertragData);
            const vertragPlaceholders = vertragFields.map(() => '?').join(', ');
            const vertragValues = vertragFields.map(field => vertragData[field]);

            const vertragQuery = `
                INSERT INTO vertraege (${vertragFields.join(', ')})
                VALUES (${vertragPlaceholders})
            `;

            db.query(vertragQuery, vertragValues, (vertragErr, vertragResult) => {
                if (vertragErr) {
                    logger.error('Fehler beim Erstellen des Vertrags:', vertragErr);
                    // Mitglied wurde erstellt, aber Vertrag fehlgeschlagen
                    return res.status(201).json({
                        success: true,
                        mitglied_id: newMemberId,
                        dojo_id: memberData.dojo_id,
                        warning: "Mitglied erstellt, aber Vertrag konnte nicht angelegt werden",
                        vertrag_error: vertragErr.message,
                        data: {
                            ...memberData,
                            mitglied_id: newMemberId
                        }
                    });
                }

                const vertragId = vertragResult.insertId;

                // 💰 Ersten Beitrag automatisch erstellen
                const createFirstBeitrag = (callback) => {
                    // Tarif-Preis holen
                    db.query('SELECT price_cents FROM tarife WHERE id = ?', [memberData.vertrag_tarif_id], (tarifErr, tarifResults) => {
                        if (tarifErr || tarifResults.length === 0) {
                            logger.warn('Tarif nicht gefunden für Beitragserstellung');
                            return callback();
                        }

                        const tarifPreis = tarifResults[0].price_cents / 100;
                        const beitragQuery = `
                            INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id)
                            VALUES (?, ?, DATE_FORMAT(NOW(), '%Y-%m-01'), 'SEPA', 0, ?)
                        `;
                        db.query(beitragQuery, [newMemberId, tarifPreis, memberData.dojo_id], (beitragErr, beitragResult) => {
                            if (beitragErr) {
                                logger.error('Fehler beim Erstellen des ersten Beitrags:', beitragErr);
                            } else {
                                logger.info(`💰 Erster Beitrag erstellt: ${tarifPreis}€ für Mitglied ${newMemberId}`);
                            }
                            callback();
                        });
                    });
                };

                // Beitrag erstellen, dann User-Account und Familienmitglieder
                createFirstBeitrag(() => {
                    // 🔐 User-Account erstellen (nur bei öffentlicher Registrierung mit Benutzername/Passwort)
                    createUserAccountIfNeeded(memberData, newMemberId, (userErr, userResult) => {
                        // 👨‍👩‍👧 Familienmitglieder erstellen (wenn vorhanden)
                        createFamilyMembers(memberData.family_members, memberData, memberData.dojo_id, (famErr, createdFamilyMembers) => {
                            const response = {
                                success: true,
                                mitglied_id: newMemberId,
                                vertrag_id: vertragId,
                                dojo_id: memberData.dojo_id,
                                message: "Mitglied und Vertrag erfolgreich erstellt",
                                family_members_created: createdFamilyMembers || [],
                                data: {
                                    ...memberData,
                                    mitglied_id: newMemberId,
                                    vertrag_id: vertragId
                                }
                            };
                            // User-Account Info hinzufügen (falls vorhanden)
                            if (userResult) {
                                response.user_account = userResult;
                            }
                            res.status(201).json(response);
                        });
                    });
                });
            });
        } else {
            // Kein Vertrag, nur Mitglied erstellt
            // 🔐 User-Account erstellen (nur bei öffentlicher Registrierung mit Benutzername/Passwort)
            createUserAccountIfNeeded(memberData, newMemberId, (userErr, userResult) => {
                // 👨‍👩‍👧 Familienmitglieder erstellen (wenn vorhanden)
                createFamilyMembers(memberData.family_members, memberData, memberData.dojo_id, (famErr, createdFamilyMembers) => {
                    const response = {
                        success: true,
                        mitglied_id: newMemberId,
                        dojo_id: memberData.dojo_id,
                        message: "Mitglied erfolgreich erstellt",
                        family_members_created: createdFamilyMembers || [],
                        data: {
                            ...memberData,
                            mitglied_id: newMemberId
                        }
                    };
                    // User-Account Info hinzufügen (falls vorhanden)
                    if (userResult) {
                        response.user_account = userResult;
                    }
                    res.status(201).json(response);
                });
            });
        }
    });
});

// 👨‍👩‍👧 HILFSFUNKTION: Familienmitglieder erstellen
async function createFamilyMembers(familyMembers, mainMemberData, dojoId, callback) {
    if (!familyMembers || familyMembers.length === 0) {
        return callback(null, []);
    }

    logger.info(`👨‍👩‍👧 Erstelle ${familyMembers.length} Familienmitglieder...`);
    const createdMembers = [];
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Hilfsfunktion: Prüfe ob Person minderjährig ist
    const isMinor = (geburtsdatum) => {
        if (!geburtsdatum) return false;
        const birthDate = new Date(geburtsdatum);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age < 18;
    };

    const createMember = async (index) => {
        if (index >= familyMembers.length) {
            return callback(null, createdMembers);
        }

        const fm = familyMembers[index];
        logger.info(`👤 Erstelle Familienmitglied ${index + 1}: ${fm.vorname} ${fm.nachname}`);

        // Prüfe ob das Familienmitglied minderjährig ist
        const isFamilyMemberMinor = isMinor(fm.geburtsdatum);

        // Familienmitglied-Daten vorbereiten
        const memberFields = {
            dojo_id: dojoId,
            vorname: fm.vorname,
            nachname: fm.nachname,
            geburtsdatum: fm.geburtsdatum,
            geschlecht: fm.geschlecht || 'divers',
            email: fm.email || null,
            // 👨‍👩‍👧 FAMILIEN-VERKNÜPFUNG
            familien_id: mainMemberData.familien_id || null,
            rabatt_grund: 'Familie',
            // Adresse vom Hauptmitglied übernehmen
            strasse: mainMemberData.strasse || null,
            hausnummer: mainMemberData.hausnummer || null,
            plz: mainMemberData.plz || null,
            ort: mainMemberData.ort || null,
            telefon: mainMemberData.telefon || null,
            // 💳 BANKDATEN vom Hauptmitglied übernehmen
            kontoinhaber: mainMemberData.kontoinhaber || null,
            iban: mainMemberData.iban || null,
            bic: mainMemberData.bic || null,
            bankname: mainMemberData.bankname || mainMemberData.bank_name || null,
            // 👨‍👩‍👧 VERTRETER für Minderjährige
            vertreter1_typ: isFamilyMemberMinor ? 'sonstiger gesetzl. Vertreter' : null,
            vertreter1_name: isFamilyMemberMinor ? `${mainMemberData.vertreter_vorname || mainMemberData.vorname} ${mainMemberData.vertreter_nachname || mainMemberData.nachname}` : null,
            vertreter1_email: isFamilyMemberMinor ? (mainMemberData.vertreter_email || mainMemberData.email) : null,
            vertreter1_telefon: isFamilyMemberMinor ? (mainMemberData.vertreter_telefon || mainMemberData.telefon) : null,
            // Dokumentakzeptanzen (gelten für alle Familienmitglieder)
            agb_akzeptiert: mainMemberData.vertrag_agb_akzeptiert ? 1 : 0,
            agb_akzeptiert_am: mainMemberData.vertrag_agb_akzeptiert ? now : null,
            datenschutz_akzeptiert: mainMemberData.vertrag_datenschutz_akzeptiert ? 1 : 0,
            datenschutz_akzeptiert_am: mainMemberData.vertrag_datenschutz_akzeptiert ? now : null,
            hausordnung_akzeptiert: mainMemberData.vertrag_hausordnung_akzeptiert ? 1 : 0,
            hausordnung_akzeptiert_am: mainMemberData.vertrag_hausordnung_akzeptiert ? now : null,
            eintrittsdatum: now.split(' ')[0]
        };

        logger.info(`📎 Familien-Verknüpfung: familien_id=${memberFields.familien_id}, minderjährig=${isFamilyMemberMinor}`);

        const insertFields = Object.keys(memberFields).filter(k => memberFields[k] !== undefined && memberFields[k] !== null);
        const placeholders = insertFields.map(() => '?').join(', ');
        const values = insertFields.map(k => memberFields[k]);

        const memberQuery = `INSERT INTO mitglieder (${insertFields.join(', ')}) VALUES (${placeholders})`;

        db.query(memberQuery, values, (err, result) => {
            if (err) {
                logger.error(`❌ Fehler beim Erstellen von Familienmitglied ${fm.vorname}:`, err);
                return createMember(index + 1); // Weitermachen mit nächstem
            }

            const newMemberId = result.insertId;
            logger.info(`✅ Familienmitglied erstellt: ID ${newMemberId}`);

            // Vertrag für Familienmitglied erstellen (wenn tarif_id vorhanden)
            if (fm.tarif_id) {
                // Erst Tarif-Details holen für korrekten Preis
                db.query('SELECT * FROM tarife WHERE id = ?', [fm.tarif_id], (tarifErr, tarifResults) => {
                    if (tarifErr || tarifResults.length === 0) {
                        logger.error(`❌ Tarif ${fm.tarif_id} nicht gefunden`);
                        createdMembers.push({ mitglied_id: newMemberId, vorname: fm.vorname, nachname: fm.nachname });
                        return createMember(index + 1);
                    }

                    const tarif = tarifResults[0];
                    const tarifPreis = tarif.price_cents / 100; // Preis in Euro

                    // Rabatt berechnen (aus fm oder mainMemberData)
                    let rabattProzent = fm.custom_discount_value || fm.rabatt_prozent || 0;
                    let rabattGrund = 'Familienrabatt';
                    let monatsbeitrag = tarifPreis;

                    if (rabattProzent > 0) {
                        monatsbeitrag = Math.round((tarifPreis * (100 - rabattProzent)) * 100) / 100;
                    }

                    const vertragData = {
                        mitglied_id: newMemberId,
                        dojo_id: dojoId,
                        tarif_id: fm.tarif_id,
                        status: 'aktiv',
                        vertragsbeginn: mainMemberData.vertragsbeginn || new Date().toISOString().split('T')[0],
                        monatsbeitrag: monatsbeitrag,
                        monatlicher_beitrag: monatsbeitrag,
                        rabatt_prozent: rabattProzent,
                        rabatt_grund: rabattProzent > 0 ? rabattGrund : null,
                        mindestlaufzeit_monate: tarif.mindestlaufzeit_monate || 12,
                        kuendigungsfrist_monate: tarif.kuendigungsfrist_monate || 3,
                        aufnahmegebuehr_cents: tarif.aufnahmegebuehr_cents || 0,
                        agb_akzeptiert_am: mainMemberData.vertrag_agb_akzeptiert ? new Date() : null,
                        datenschutz_akzeptiert_am: mainMemberData.vertrag_datenschutz_akzeptiert ? new Date() : null,
                        hausordnung_akzeptiert_am: mainMemberData.vertrag_hausordnung_akzeptiert ? new Date() : null,
                        unterschrift_datum: new Date()
                    };

                    logger.info(`📝 Vertrag für ${fm.vorname}: Tarif=${tarif.name}, Preis=${tarifPreis}€, Rabatt=${rabattProzent}%, Final=${monatsbeitrag}€`);

                    const vFields = Object.keys(vertragData).filter(k => vertragData[k] !== null && vertragData[k] !== undefined);
                    const vPlaceholders = vFields.map(() => '?').join(', ');
                    const vValues = vFields.map(k => vertragData[k]);

                    const vertragQuery = `INSERT INTO vertraege (${vFields.join(', ')}) VALUES (${vPlaceholders})`;

                    db.query(vertragQuery, vValues, (vertragErr, vertragResult) => {
                        if (vertragErr) {
                            logger.error(`❌ Fehler beim Erstellen des Vertrags für Familienmitglied:`, vertragErr);
                            createdMembers.push({ mitglied_id: newMemberId, vorname: fm.vorname, nachname: fm.nachname });
                            return createMember(index + 1);
                        }

                        logger.info(`✅ Vertrag für Familienmitglied erstellt: ID ${vertragResult.insertId}`);

                        // 💰 Ersten Beitrag automatisch erstellen
                        const beitragQuery = `
                            INSERT INTO beitraege (mitglied_id, betrag, zahlungsdatum, zahlungsart, bezahlt, dojo_id)
                            VALUES (?, ?, DATE_FORMAT(NOW(), '%Y-%m-01'), 'SEPA', 0, ?)
                        `;
                        db.query(beitragQuery, [newMemberId, monatsbeitrag, dojoId], (beitragErr, beitragResult) => {
                            if (beitragErr) {
                                logger.error(`❌ Fehler beim Erstellen des ersten Beitrags:`, beitragErr);
                            } else {
                                logger.info(`💰 Erster Beitrag erstellt: ${monatsbeitrag}€ für Mitglied ${newMemberId}`);
                            }

                            createdMembers.push({
                                mitglied_id: newMemberId,
                                vorname: fm.vorname,
                                nachname: fm.nachname,
                                vertrag_id: vertragResult?.insertId,
                                beitrag_id: beitragResult?.insertId
                            });
                            createMember(index + 1);
                        });
                    });
                });
            } else {
                createdMembers.push({ mitglied_id: newMemberId, vorname: fm.vorname, nachname: fm.nachname });
                createMember(index + 1);
            }
        });
    };

    createMember(0);
}

// 🔐 HILFSFUNKTION: Benutzernamen aus Vor-/Nachname generieren
function generateUsername(vorname, nachname) {
    const clean = s => (s || '').trim().toLowerCase()
        .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
        .replace(/\s+/g, '');
    return clean(vorname) + '.' + clean(nachname);
}

// 🔐 HILFSFUNKTION: Passwort aus Geburtsdatum generieren (dd/mm/yyyy)
function generatePasswordFromBirthdate(geburtsdatum) {
    if (!geburtsdatum) return null;
    const [y, m, d] = String(geburtsdatum).split('-');
    if (!y || !m || !d) return null;
    return d + '/' + m + '/' + y;
}

// 🔐 HILFSFUNKTION: User-Account erstellen (automatisch bei jeder Mitgliederanlage)
async function createUserAccountIfNeeded(memberData, mitgliedId, callback) {
    // Benutzername und Passwort: explizit angegeben ODER automatisch generieren
    const username = memberData.benutzername
        ? memberData.benutzername.trim()
        : generateUsername(memberData.vorname, memberData.nachname);
    const password = memberData.passwort
        ? memberData.passwort
        : generatePasswordFromBirthdate(memberData.geburtsdatum);

    if (!username || !password) {
        logger.warn('Kein Benutzername oder Passwort generierbar – kein Account erstellt', { mitgliedId });
        return callback();
    }

    if (username.toLowerCase() === 'admin') {
        logger.warn('Reservierter Benutzername "admin" – kein Account erstellt');
        return callback(null, { warning: 'Benutzername "admin" ist reserviert' });
    }

    const email = memberData.email || null;

    try {
        // Existiert Benutzername bereits?
        db.query(
            'SELECT id, mitglied_id FROM users WHERE username = ?',
            [username],
            async (checkErr, existingUsers) => {
                if (checkErr) {
                    logger.error('Fehler bei User-Prüfung:', checkErr);
                    return callback(null, { warning: 'Fehler bei User-Prüfung' });
                }

                if (existingUsers.length > 0) {
                    const existing = existingUsers[0];
                    if (existing.mitglied_id === mitgliedId) {
                        return callback(null, { userId: existing.id, message: 'User existiert bereits' });
                    }
                    // Benutzername vergeben → Suffix anhängen
                    const usernameFallback = username + '.' + mitgliedId;
                    logger.warn(`Benutzername ${username} vergeben, nutze ${usernameFallback}`);
                    const hash2 = await bcrypt.hash(password, 10);
                    db.query(
                        'INSERT IGNORE INTO users (username, email, password, role, mitglied_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                        [usernameFallback, email, hash2, 'member', mitgliedId],
                        (err2, res2) => {
                            if (err2) return callback(null, { warning: 'Fallback-Account fehlgeschlagen' });
                            logger.info(`✅ Fallback-Account erstellt: ${usernameFallback}`);
                            callback(null, { userId: res2.insertId, username: usernameFallback });
                        }
                    );
                    return;
                }

                // Neu erstellen
                const hashedPassword = await bcrypt.hash(password, 10);
                db.query(
                    'INSERT INTO users (username, email, password, role, mitglied_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                    [username, email, hashedPassword, 'member', mitgliedId],
                    (userErr, userResult) => {
                        if (userErr) {
                            logger.error('Fehler beim Erstellen des User-Accounts:', userErr);
                            return callback(null, { warning: 'User-Account konnte nicht erstellt werden' });
                        }
                        logger.info(`✅ User-Account automatisch erstellt: ${username} für Mitglied ${mitgliedId}`);
                        callback(null, { userId: userResult.insertId, username, message: 'User-Account erstellt' });
                    }
                );
            }
        );
    } catch (hashError) {
        logger.error('Fehler beim Hashen des Passworts:', hashError);
        callback(null, { warning: 'Passwort-Verarbeitung fehlgeschlagen' });
    }
}

// ===================================================================
// 📧 NOTIFICATION RECIPIENTS (TEMP)
// ===================================================================


module.exports = router;
