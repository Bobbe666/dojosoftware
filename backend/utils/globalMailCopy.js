// Globaler Mail-Interzeptor auf nodemailer-Ebene. Zwei Aufgaben für JEDE
// ausgehende Mail (deckt alle Transporter ab: emailService, cron-jobs, mahnwesen,
// notifications, buddy, vorlagen, ruecklastschriften, agb, email-settings, …):
//   1) Stilles BCC an die System-Adresse (Standard info@tda-intl.com, ENV MAIL_BCC_ALL)
//   2) Archivierung in dojo_email_archive (ansehbar/abrufbar in der Software)
// Einmaliges Monkey-Patch von nodemailer.createTransport → wrappt sendMail.
// Muss VOR dem ersten Mailversand geladen werden (früh in server.js).
const nodemailer = require('nodemailer');
let logger; try { logger = require('./logger'); } catch (_) { logger = { info() {}, warn() {} }; }

const COPY_TO = (process.env.MAIL_BCC_ALL || 'info@tda-intl.com').toLowerCase().trim();

const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const joinAddr = (v) => asList(v).map((a) => (typeof a === 'object' && a ? a.address || '' : a)).join(', ');

function archive(mo, info, err) {
  try {
    const { archiveEmail } = require('../services/emailArchive');
    archiveEmail({
      dojoId: mo.__dojoId || null,
      from: joinAddr(mo.from) || null,
      to: joinAddr(mo.to),
      cc: joinAddr(mo.cc) || null,
      bcc: joinAddr(mo.bcc) || null,
      name: mo.__archiveName || null,
      subject: mo.subject || '(kein Betreff)',
      html: mo.html || null,
      text: typeof mo.text === 'string' ? mo.text : null,
      typ: mo.__typ || 'system',
      messageId: info && info.messageId,
      status: err ? 'fehler' : 'gesendet',
    }).catch(() => {});
  } catch (_) { /* Archiv darf den Versand nie stören */ }
}

if (!nodemailer.__mailInterceptorPatched) {
  const origCreate = nodemailer.createTransport.bind(nodemailer);
  nodemailer.createTransport = function patchedCreateTransport(...args) {
    const transport = origCreate(...args);
    if (transport && typeof transport.sendMail === 'function' && !transport.__wrapped) {
      const origSend = transport.sendMail.bind(transport);
      transport.sendMail = function (mailOptions, callback) {
        const mo = mailOptions || {};
        // 1) BCC an System-Adresse (keine Doppel-/Selbstkopie)
        try {
          const has = (v) => joinAddr(v).toLowerCase().includes(COPY_TO);
          if (COPY_TO && !has(mo.to) && !has(mo.cc) && !has(mo.bcc)) {
            mo.bcc = asList(mo.bcc).concat([COPY_TO]);
          }
        } catch (e) {
          try { logger.warn('globalMailCopy: BCC-Fehler', { error: e.message }); } catch (_) {}
        }
        // 2) Archivierung (nach Versand, fire-and-forget)
        if (typeof callback === 'function') {
          return origSend(mo, (err, info) => { archive(mo, info, err); callback(err, info); });
        }
        const p = origSend(mo);
        p.then((info) => archive(mo, info, null)).catch((err) => archive(mo, null, err));
        return p;
      };
      transport.__wrapped = true;
    }
    return transport;
  };
  nodemailer.__mailInterceptorPatched = true;
  try { logger.info(`globalMailCopy aktiv – BCC + Archiv (${COPY_TO}) auf allen ausgehenden Mails`); } catch (_) {}
}

module.exports = { COPY_TO };
