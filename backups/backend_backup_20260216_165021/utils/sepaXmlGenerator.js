/**
 * SEPA XML Generator - PAIN.008.001.02 Standard
 * ISO 20022 Direct Debit Initiation
 *
 * Generiert SEPA-Lastschrift XML-Dateien fuer den Bank-Upload
 */

const { create } = require('xmlbuilder2');

class SepaXmlGenerator {
  /**
   * @param {Object} creditorData - Glaeubigerinformationen (Dojo)
   * @param {string} creditorData.dojoname - Name des Dojos
   * @param {string} creditorData.strasse - Strasse
   * @param {string} creditorData.hausnummer - Hausnummer
   * @param {string} creditorData.plz - PLZ
   * @param {string} creditorData.ort - Ort
   * @param {string} creditorData.sepa_glaeubiger_id - SEPA Glaeubiger-ID (z.B. DE98ZZZ09999999999)
   * @param {string} creditorData.iban - Glaeubigerr-IBAN
   * @param {string} creditorData.bic - Glaeubigerr-BIC
   */
  constructor(creditorData) {
    this.creditor = creditorData;
    this.messageId = this.generateMessageId();
    this.creationDateTime = new Date().toISOString();
  }

  /**
   * Generiert eine eindeutige Message-ID
   * Format: DOJO-YYYYMMDD-HHMMSS-RANDOM
   * Max 35 Zeichen nach SEPA-Standard
   */
  generateMessageId() {
    const now = new Date();
    const dateStr = now.toISOString().replace(/[-:T]/g, '').substring(0, 14);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `DOJO-${dateStr}-${random}`.substring(0, 35);
  }

  /**
   * Generiert Payment Information ID
   */
  generatePaymentInfoId(index = 1) {
    return `PMT-${this.messageId.substring(5, 19)}-${String(index).padStart(3, '0')}`.substring(0, 35);
  }

  /**
   * Generiert End-to-End ID fuer einzelne Transaktion
   * Max 35 Zeichen nach SEPA-Standard
   */
  generateEndToEndId(mitgliedId, mandatsreferenz) {
    const dateStr = new Date().toISOString().substring(0, 10).replace(/-/g, '');
    // Mandatsreferenz kuerzen wenn noetig
    const ref = mandatsreferenz.substring(0, 20);
    return `${ref}-${dateStr}`.substring(0, 35);
  }

  /**
   * Formatiert Datum fuer SEPA (YYYY-MM-DD)
   */
  formatDate(date) {
    if (!date) return new Date().toISOString().substring(0, 10);
    const d = new Date(date);
    return d.toISOString().substring(0, 10);
  }

  /**
   * Formatiert Betrag (2 Dezimalstellen)
   */
  formatAmount(amount) {
    return parseFloat(amount).toFixed(2);
  }

  /**
   * Bereinigt Text fuer SEPA (entfernt Sonderzeichen)
   */
  sanitizeText(text) {
    if (!text) return '';
    // SEPA erlaubt nur: a-z A-Z 0-9 / - ? : ( ) . , ' + Leerzeichen
    return text
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-zA-Z0-9\s\/\-\?\:\(\)\.\,\'\+]/g, '')
      .substring(0, 70);
  }

  /**
   * Hauptmethode: Generiert PAIN.008.001.02 XML
   * @param {Array} transactions - Array von Lastschrift-Transaktionen
   * @param {Date} requestedCollectionDate - Gewuenschtes Einzugsdatum
   * @returns {string} XML-String
   */
  generatePainXml(transactions, requestedCollectionDate) {
    const numberOfTransactions = transactions.length;
    const controlSum = transactions
      .reduce((sum, t) => sum + parseFloat(t.betrag || 0), 0)
      .toFixed(2);

    // Glaeubigerr-Adresse
    const creditorStreet = this.sanitizeText(
      `${this.creditor.strasse || ''} ${this.creditor.hausnummer || ''}`.trim()
    );
    const creditorCity = this.sanitizeText(
      `${this.creditor.plz || ''} ${this.creditor.ort || ''}`.trim()
    );

    // Root Document erstellen
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Document', {
        'xmlns': 'urn:iso:std:iso:20022:tech:xsd:pain.008.001.02',
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance'
      });

    // Customer Direct Debit Initiation
    const cstmrDrctDbtInitn = root.ele('CstmrDrctDbtInitn');

    // ===== Group Header =====
    const grpHdr = cstmrDrctDbtInitn.ele('GrpHdr');
    grpHdr.ele('MsgId').txt(this.messageId);
    grpHdr.ele('CreDtTm').txt(this.creationDateTime);
    grpHdr.ele('NbOfTxs').txt(numberOfTransactions.toString());
    grpHdr.ele('CtrlSum').txt(controlSum);
    grpHdr.ele('InitgPty')
      .ele('Nm').txt(this.sanitizeText(this.creditor.dojoname));

    // ===== Payment Information =====
    const pmtInf = cstmrDrctDbtInitn.ele('PmtInf');
    pmtInf.ele('PmtInfId').txt(this.generatePaymentInfoId());
    pmtInf.ele('PmtMtd').txt('DD'); // Direct Debit
    pmtInf.ele('BtchBookg').txt('true');
    pmtInf.ele('NbOfTxs').txt(numberOfTransactions.toString());
    pmtInf.ele('CtrlSum').txt(controlSum);

    // Payment Type Information
    const pmtTpInf = pmtInf.ele('PmtTpInf');
    pmtTpInf.ele('SvcLvl').ele('Cd').txt('SEPA');
    pmtTpInf.ele('LclInstrm').ele('Cd').txt('CORE'); // CORE fuer Privatpersonen
    pmtTpInf.ele('SeqTp').txt('RCUR'); // Recurring

    // Requested Collection Date
    pmtInf.ele('ReqdColltnDt').txt(this.formatDate(requestedCollectionDate));

    // Creditor (Glaeubigerr = Dojo)
    const cdtr = pmtInf.ele('Cdtr');
    cdtr.ele('Nm').txt(this.sanitizeText(this.creditor.dojoname));
    if (creditorStreet || creditorCity) {
      const pstlAdr = cdtr.ele('PstlAdr');
      pstlAdr.ele('Ctry').txt('DE');
      if (creditorStreet) pstlAdr.ele('AdrLine').txt(creditorStreet);
      if (creditorCity) pstlAdr.ele('AdrLine').txt(creditorCity);
    }

    // Creditor Account
    pmtInf.ele('CdtrAcct')
      .ele('Id')
      .ele('IBAN').txt((this.creditor.iban || this.creditor.bank_iban || '').replace(/\s/g, ''));

    // Creditor Agent (Bank des Glaeubiger)
    const cdtrAgt = pmtInf.ele('CdtrAgt').ele('FinInstnId');
    const creditorBic = this.creditor.bic || this.creditor.bank_bic;
    if (creditorBic) {
      cdtrAgt.ele('BIC').txt(creditorBic);
    } else {
      cdtrAgt.ele('Othr').ele('Id').txt('NOTPROVIDED');
    }

    // Charge Bearer
    pmtInf.ele('ChrgBr').txt('SLEV'); // Shared

    // Creditor Scheme Identification (Glaeubiger-ID)
    const cdtrSchmeId = pmtInf.ele('CdtrSchmeId');
    cdtrSchmeId.ele('Id')
      .ele('PrvtId')
      .ele('Othr')
      .ele('Id').txt(this.creditor.sepa_glaeubiger_id)
      .up()
      .ele('SchmeNm')
      .ele('Prtry').txt('SEPA');

    // ===== Transactions =====
    transactions.forEach((transaction, index) => {
      this.addTransaction(pmtInf, transaction, index);
    });

    return root.end({ prettyPrint: true });
  }

  /**
   * Fuegt eine einzelne Transaktion hinzu
   */
  addTransaction(pmtInf, transaction, index) {
    const endToEndId = this.generateEndToEndId(
      transaction.mitglied_id,
      transaction.mandatsreferenz
    );

    const drctDbtTxInf = pmtInf.ele('DrctDbtTxInf');

    // Payment Identification
    drctDbtTxInf.ele('PmtId')
      .ele('EndToEndId').txt(endToEndId);

    // Instructed Amount
    drctDbtTxInf.ele('InstdAmt', { Ccy: 'EUR' })
      .txt(this.formatAmount(transaction.betrag));

    // Direct Debit Transaction
    const drctDbtTx = drctDbtTxInf.ele('DrctDbtTx');
    const mndtRltdInf = drctDbtTx.ele('MndtRltdInf');
    mndtRltdInf.ele('MndtId').txt(transaction.mandatsreferenz.substring(0, 35));
    mndtRltdInf.ele('DtOfSgntr').txt(this.formatDate(transaction.mandat_datum));

    // Debtor Agent (Bank des Schuldners)
    const dbtrAgt = drctDbtTxInf.ele('DbtrAgt').ele('FinInstnId');
    if (transaction.bic) {
      dbtrAgt.ele('BIC').txt(transaction.bic);
    } else {
      dbtrAgt.ele('Othr').ele('Id').txt('NOTPROVIDED');
    }

    // Debtor (Schuldner = Mitglied)
    const kontoinhaber = transaction.kontoinhaber ||
      `${transaction.vorname || ''} ${transaction.nachname || ''}`.trim();
    drctDbtTxInf.ele('Dbtr')
      .ele('Nm').txt(this.sanitizeText(kontoinhaber));

    // Debtor Account
    drctDbtTxInf.ele('DbtrAcct')
      .ele('Id')
      .ele('IBAN').txt((transaction.iban || '').replace(/\s/g, ''));

    // Remittance Information (Verwendungszweck)
    const verwendungszweck = transaction.verwendungszweck ||
      `Mitgliedsbeitrag ${new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}`;
    drctDbtTxInf.ele('RmtInf')
      .ele('Ustrd').txt(this.sanitizeText(verwendungszweck));
  }

  /**
   * Validiert IBAN
   */
  static validateIBAN(iban) {
    if (!iban) return false;
    const cleanIban = iban.replace(/\s/g, '').toUpperCase();
    // Einfache Validierung: DE + 20 Zeichen
    return /^[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}$/.test(cleanIban);
  }

  /**
   * Validiert BIC
   */
  static validateBIC(bic) {
    if (!bic) return true; // BIC ist optional bei SEPA
    return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic.toUpperCase());
  }

  /**
   * Validiert Glaeubiger-ID
   */
  static validateCreditorId(creditorId) {
    if (!creditorId) return false;
    // Deutsche Glaeubiger-ID: DE + 2 Pruefc + ZZZ + 8 Zeichen
    return /^DE[0-9]{2}[A-Z0-9]{3}[A-Z0-9]{8,}$/.test(creditorId.toUpperCase());
  }
}

module.exports = SepaXmlGenerator;
