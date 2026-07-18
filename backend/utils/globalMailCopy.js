// Globaler stiller BCC: JEDE über nodemailer versendete E-Mail geht als Kopie
// an die System-Adresse (Standard: info@tda-intl.com). Realisiert als einmaliges
// Monkey-Patch von nodemailer.createTransport → wrappt sendMail. Damit sind ALLE
// Transporter im Projekt abgedeckt (emailService, cron-jobs, mahnwesen,
// notifications, buddy, vorlagen, ruecklastschriften, agb, …) ohne jede Sendestelle
// einzeln anfassen zu müssen. Überschreibbar via ENV MAIL_BCC_ALL. Muss VOR dem
// ersten Mailversand geladen werden (früh in server.js requiren).
const nodemailer = require('nodemailer');
let logger; try { logger = require('./logger'); } catch (_) { logger = { info() {}, warn() {} }; }

const COPY_TO = (process.env.MAIL_BCC_ALL || 'info@tda-intl.com').toLowerCase().trim();

if (COPY_TO && !nodemailer.__bccPatched) {
  const origCreate = nodemailer.createTransport.bind(nodemailer);
  nodemailer.createTransport = function patchedCreateTransport(...args) {
    const transport = origCreate(...args);
    if (transport && typeof transport.sendMail === 'function' && !transport.__bccWrapped) {
      const origSend = transport.sendMail.bind(transport);
      transport.sendMail = function (mailOptions, callback) {
        try {
          const mo = mailOptions || {};
          const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
          const has = (v) => asList(v).join(',').toLowerCase().includes(COPY_TO);
          // Nicht doppelt kopieren, wenn Adresse ohnehin schon Empfänger ist
          if (!has(mo.to) && !has(mo.cc) && !has(mo.bcc)) {
            mo.bcc = asList(mo.bcc).concat([COPY_TO]);
          }
          mailOptions = mo;
        } catch (e) {
          try { logger.warn('globalMailCopy: BCC konnte nicht gesetzt werden', { error: e.message }); } catch (_) {}
        }
        return origSend(mailOptions, callback);
      };
      transport.__bccWrapped = true;
    }
    return transport;
  };
  nodemailer.__bccPatched = true;
  try { logger.info(`globalMailCopy aktiv – stilles BCC an ${COPY_TO} auf allen ausgehenden Mails`); } catch (_) {}
}

module.exports = { COPY_TO };
