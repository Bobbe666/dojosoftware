// scripts/preview-emails.js — Dojosoftware Mail-Vorschau (rendert, verschickt nichts).
//   node scripts/preview-emails.js  → ../email-previews/
// Nutzt renderEmail direkt mit Beispiel-Themes (kein DB-Zugriff nötig).
const fs = require("fs");
const path = require("path");
const { renderEmail, DEFAULT_THEME } = require("../services/emailLayout");

const placeholder = (label, c1, c2) => "data:image/svg+xml," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400" viewBox="0 0 1200 400">
   <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
   <rect width="1200" height="400" fill="url(#g)"/><rect x="40" y="40" width="1120" height="320" fill="none" stroke="#fff" stroke-opacity="0.4" stroke-width="2"/>
   <text x="600" y="190" fill="#ffffff" font-family="Arial" font-size="22" letter-spacing="8" text-anchor="middle" opacity="0.8">DEIN BANNER HIER</text>
   <text x="600" y="250" fill="#fff" font-family="Arial" font-size="42" font-weight="bold" text-anchor="middle">${label}</text>
   <text x="600" y="305" fill="#fff" font-family="Arial" font-size="16" text-anchor="middle" opacity="0.7">1200 × 400 px (PNG/JPG)</text></svg>`);

// Zwei Beispiel-Dojos zur White-Label-Demonstration
const themeSchreiner = { ...DEFAULT_THEME, dojoName: "Kampfkunstschule Schreiner", accent: "#DAA520", accent2: "#FFD700" };
const themeDemo      = { ...DEFAULT_THEME, dojoName: "Taekwondo Demo e.V.", primary: "#1e1b4b", primary2: "#0f0a2e", accent: "#a855f7", accent2: "#ec4899" };

const box = (inner) => `<div class="box"><p>${inner}</p></div>`;

const items = {
  willkommen: {
    theme: themeSchreiner, anlass: "begruessung", titel: themeSchreiner.dojoName, subtitel: "Ihr Mitgliedschaftsvertrag",
    bannerUrl: placeholder("Willkommen", "#1e293b", "#0f172a"),
    bodyHtml: `<p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Sehr geehrte/r Lena Bauer,</p>
      <p style="margin:0 0 14px;">vielen Dank für Ihre Anmeldung bei <strong>${themeSchreiner.dojoName}</strong>. Wir freuen uns, Sie als neues Mitglied begrüßen zu dürfen!</p>
      ${box("<strong>Wichtig:</strong> Im Anhang finden Sie Ihren Mitgliedschaftsvertrag, AGB und Datenschutzerklärung. Bitte sorgfältig aufbewahren.")}
      <p style="margin:14px 0 0;">Mit freundlichen Grüßen<br><strong>Ihr ${themeSchreiner.dojoName} Team</strong></p>`,
  },
  auszeichnung: {
    theme: themeDemo, anlass: "allgemein", titel: themeDemo.dojoName, subtitel: "🎉 Neue Auszeichnung erhalten!",
    bodyHtml: `<p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Hallo Tom,</p>
      <p style="margin:0;">du hast eine neue Auszeichnung erhalten!</p>
      <div style="text-align:center;margin:26px 0;"><div style="display:inline-block;background:${themeDemo.accent}22;border:3px solid ${themeDemo.accent};border-radius:50%;width:80px;height:80px;line-height:80px;font-size:40px;">🏅</div>
      <h2 style="color:${themeDemo.accent};margin:18px 0 8px;font-size:23px;">100 Trainings</h2><p style="font-size:14px;color:#64748b;margin:0;">Für 100 absolvierte Trainingseinheiten.</p></div>
      ${box("<strong>Weiter so!</strong> Dein Engagement wird belohnt. (Dieses Dojo nutzt eine eigene Theme-Farbe — White-Label.)")}`,
    cta: { url: "#", label: "Profil ansehen" },
  },
  pruefung: {
    theme: themeSchreiner, anlass: "allgemein", titel: themeSchreiner.dojoName, subtitel: "🥋 Prüfungsanmeldung bestätigt",
    bodyHtml: `<p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Hallo Lena Bauer,</p>
      <p style="margin:0;">Ihre Anmeldung zur Prüfung wurde erfolgreich registriert.</p>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:18px 20px;margin:18px 0;"><p style="margin:0 0 10px;color:#166534;"><strong>Prüfungsdetails:</strong></p>
      <table role="presentation" width="100%" style="font-size:14px;"><tr><td style="padding:4px 0;color:#475569;width:45%;">Stil:</td><td style="padding:4px 0;font-weight:bold;">Taekwondo</td></tr>
      <tr><td style="padding:4px 0;color:#475569;">Datum:</td><td style="padding:4px 0;font-weight:bold;">Samstag, 7. November 2026</td></tr>
      <tr><td style="padding:4px 0;color:#475569;">Gebühr:</td><td style="padding:4px 0;font-weight:bold;">45 €</td></tr></table></div>
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:18px 0;"><p style="margin:0;font-size:13px;color:#78350f;"><strong>Hinweis:</strong> Kostenfreie Abmeldung bis 7 Tage vor der Prüfung.</p></div>`,
  },
  probetraining: {
    theme: themeSchreiner, anlass: "begruessung", titel: themeSchreiner.dojoName, subtitel: "🥋 Vielen Dank für Ihre Anfrage!",
    bodyHtml: `<p style="font-size:16px;color:#1e293b;margin:0 0 14px;">Hallo Max,</p>
      <p style="margin:0;">vielen Dank für Ihr Interesse an einem Probetraining! Wir melden uns in Kürze.</p>
      ${box("<strong>Was Sie mitbringen sollten:</strong><br>• Bequeme Sportkleidung<br>• Etwas zu trinken<br>• Gute Laune! 😊")}`,
  },
};

const outDir = path.join(__dirname, "..", "..", "email-previews");
fs.mkdirSync(outDir, { recursive: true });
const links = [];
for (const [key, data] of Object.entries(items)) {
  const file = `dojo-${key}.html`;
  fs.writeFileSync(path.join(outDir, file), renderEmail(data));
  links.push({ key, file, subtitel: data.subtitel, dojo: data.theme.dojoName });
}
const index = `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Dojosoftware Mail-Vorschau</title>
<style>body{margin:0;background:#f1f5f9;color:#334155;font-family:Arial;padding:30px;}h1{color:#1e293b;}
.grid{display:flex;flex-wrap:wrap;gap:24px;margin-top:20px;}.card{background:#fff;border:1px solid #e2e8f0;border-radius:10px;width:640px;max-width:100%;overflow:hidden;box-shadow:0 2px 10px rgba(15,23,42,.1);}
.lbl{padding:12px 18px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#1e293b;border-bottom:1px solid #eef2f7;}
iframe{width:100%;height:780px;border:0;display:block;}a{color:#0369a1;}</style></head><body>
<h1>Dojosoftware Mail-Vorschau</h1>
<p>Nur Deutsch, White-Label pro Dojo (Logo/Farbe). „Auszeichnung" nutzt ein anderes Dojo-Theme (lila) zur Demo. Banner sind Platzhalter (1200×400, PNG/JPG), aktivierbar per <code>DOJO_MAIL_BANNERS=1</code>.</p>
<div class="grid">${links.map(l => `<div class="card"><div class="lbl">${l.key} — ${l.dojo} &middot; ${l.subtitel} &middot; <a href="${l.file}" target="_blank">neuer Tab ↗</a></div><iframe src="${l.file}"></iframe></div>`).join("")}</div>
</body></html>`;
fs.writeFileSync(path.join(outDir, "index.html"), index);
console.log("Vorschau erzeugt:", outDir);
links.forEach(l => console.log("  -", l.file));
