/**
 * UrkundeDrucken.js
 * Druckt direkt im aktuellen Fenster via Print-Overlay.
 * Kein Popup, keine Blob-URL — funktioniert in allen Browsern.
 */

export function druckeHofNominierung(u) {
  const name         = `${u.vorname} ${u.nachname}`;
  const award        = u.grad         || 'Dragon Award';
  const nominatedBy  = u.ausgestellt_von || 'TDA Committee';
  const clearedBy    = u.dojo_schule  || 'TDA Intl';
  const certNr       = u.urkundennummer || '';

  // Great-Vibes-Font laden (für den Namen)
  if (!document.getElementById('gv-font-style')) {
    const fs = document.createElement('style');
    fs.id = 'gv-font-style';
    fs.textContent = `@import url('https://fonts.googleapis.com/css2?family=Great+Vibes&display=swap');`;
    document.head.appendChild(fs);
  }

  const printStyle = document.createElement('style');
  printStyle.id = 'hof-print-style';
  printStyle.textContent = `
    @media print {
      @page { size: A3 landscape; margin: 0; }
      #root { display: none !important; }
      #hof-overlay { display: block !important; }
    }
    #hof-overlay { display: none; }
  `;
  document.head.appendChild(printStyle);

  const overlay = document.createElement('div');
  overlay.id = 'hof-overlay';
  overlay.innerHTML = `
    <div style="position:relative;width:420mm;height:297mm;overflow:hidden;">
      <img src="/assets/urkunde_hof_nominierung.png"
           style="position:absolute;top:0;left:0;width:420mm;height:297mm;object-fit:cover;" />

      <!-- Dear + Name -->
      <div style="position:absolute;top:99mm;left:155mm;width:250mm;text-align:center;
                  font-family:Georgia,serif;font-size:12pt;color:#2c1a08;letter-spacing:1px;">
        Dear
      </div>
      <div style="position:absolute;top:106mm;left:155mm;width:250mm;text-align:center;
                  font-family:'Great Vibes',cursive;font-size:28pt;color:#1a0c05;line-height:1;">
        ${name}
      </div>

      <!-- Intro-Text -->
      <div style="position:absolute;top:125mm;left:158mm;width:244mm;text-align:center;
                  font-family:Georgia,serif;font-size:8.5pt;color:#2c1a08;line-height:1.5;">
        In great honor, we are proud to inform you of your nomination<br>
        to be inducted into the Hall of Fame of the Tiger &amp; Dragon Association &ndash; International.
      </div>

      <!-- Nominated For -->
      <div style="position:absolute;top:142mm;left:155mm;width:250mm;text-align:center;
                  font-family:Georgia,serif;font-size:9pt;color:#5a3e1b;letter-spacing:2px;text-transform:uppercase;">
        &mdash;&nbsp; Nominated For &nbsp;&mdash;
      </div>
      <div style="position:absolute;top:150mm;left:155mm;width:250mm;text-align:center;
                  font-family:Georgia,serif;font-size:20pt;font-weight:bold;color:#1a0c05;
                  letter-spacing:2px;text-transform:uppercase;">
        ${award}
      </div>

      <!-- Recognition text -->
      <div style="position:absolute;top:170mm;left:158mm;width:244mm;text-align:center;
                  font-family:Georgia,serif;font-size:8pt;color:#2c1a08;line-height:1.5;font-style:italic;">
        In recognition of exceptional achievements<br>
        and outstanding contributions to the martial arts.
      </div>

      <!-- Nominated By / Cleared By -->
      <div style="position:absolute;top:186mm;left:160mm;width:110mm;
                  font-family:Georgia,serif;font-size:8.5pt;color:#2c1a08;">
        <span style="color:#5a3e1b;font-weight:bold;">Nominated By:</span>&nbsp;&nbsp;${nominatedBy}
      </div>
      <div style="position:absolute;top:193mm;left:160mm;width:244mm;
                  font-family:Georgia,serif;font-size:8.5pt;color:#2c1a08;">
        <span style="color:#5a3e1b;font-weight:bold;">Submitted &amp; Cleared By:</span>&nbsp;&nbsp;${clearedBy}
      </div>

      <!-- Certificate Number -->
      ${certNr ? `
      <div style="position:absolute;top:207mm;left:160mm;width:244mm;
                  font-family:Georgia,serif;font-size:8.5pt;color:#5a3e1b;letter-spacing:1px;">
        ${certNr}
      </div>
      <div style="position:absolute;top:214mm;left:160mm;width:244mm;
                  font-family:Georgia,serif;font-size:8.5pt;color:#2c1a08;">
        <span style="color:#5a3e1b;font-weight:bold;">Nomination No.:</span>&nbsp;&nbsp;${certNr.split('-').pop()}
      </div>` : ''}
    </div>
  `;
  document.body.appendChild(overlay);

  document.fonts.ready.then(() => {
    window.print();
    document.body.removeChild(overlay);
    document.head.removeChild(printStyle);
  });
}

const toBonzai = (str) => (str || '').replace(/ß/g, 'ss');

const formatDatum = (raw) => {
  if (!raw) return '';
  return new Date(raw).toLocaleDateString('de-DE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
};

export function druckeKickboxSchuelergrad(u) {
  const name    = `${u.vorname} ${u.nachname}`;
  const grad    = u.grad || '';
  const certNr  = u.urkundennummer || '';
  const datum   = formatDatum(u.ausstellungsdatum);

  const printStyle = document.createElement('style');
  printStyle.id = 'kb-print-style';
  printStyle.textContent = `
    @media print {
      @page { size: A4 landscape; margin: 0; }
      #root { display: none !important; }
      #kb-overlay { display: block !important; }
    }
    #kb-overlay { display: none; }
  `;
  document.head.appendChild(printStyle);

  const overlay = document.createElement('div');
  overlay.id = 'kb-overlay';
  overlay.innerHTML = `
    <div style="position:relative;width:297mm;height:210mm;background:transparent;">
      <div style="position:absolute;width:100%;top:64mm;text-align:center;
                  font-family:'Times New Roman',Georgia,serif;font-size:22pt;
                  font-style:italic;color:#000;letter-spacing:0.5px;">
        ${name}
      </div>
      <div style="position:absolute;width:100%;top:102mm;text-align:center;
                  font-family:'Times New Roman',Georgia,serif;font-size:22pt;
                  font-style:italic;color:#000;letter-spacing:0.5px;">
        ${grad}
      </div>
      ${certNr ? `<div style="position:absolute;width:100%;top:165mm;text-align:center;
                  font-family:'Times New Roman',Georgia,serif;font-size:11pt;
                  color:#000;letter-spacing:1px;">${certNr}</div>` : ''}
      <div style="position:absolute;width:100%;top:173mm;text-align:center;
                  font-family:'Times New Roman',Georgia,serif;font-size:11pt;color:#000;">
        ${datum}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.fonts.ready.then(() => {
    window.print();
    document.body.removeChild(overlay);
    document.head.removeChild(printStyle);
  });
}

export function druckeAikidoSchuelergrad(u) {
  const name   = `${u.vorname} ${u.nachname}`;
  const grad   = u.grad || '';
  const certNr = u.urkundennummer || '';

  // Bonzai-Font laden
  if (!document.getElementById('bonzai-font-style')) {
    const fs = document.createElement('style');
    fs.id = 'bonzai-font-style';
    fs.textContent = `@font-face {
      font-family: 'Bonzai';
      src: url('/assets/bonzai.ttf') format('truetype');
    }`;
    document.head.appendChild(fs);
  }

  const printStyle = document.createElement('style');
  printStyle.id = 'aikido-print-style';
  printStyle.textContent = `
    @media print {
      @page { size: A4 landscape; margin: 0; }
      #root { display: none !important; }
      #aikido-overlay { display: block !important; }
    }
    #aikido-overlay { display: none; }
  `;
  document.head.appendChild(printStyle);

  const overlay = document.createElement('div');
  overlay.id = 'aikido-overlay';
  overlay.innerHTML = `
    <div style="position:relative;width:297mm;height:210mm;background:transparent;">
      <!-- Name: 1cm höher als vorher -->
      <div style="position:absolute;top:64mm;left:135mm;width:148mm;text-align:center;
                  font-family:'Bonzai',cursive;font-size:26pt;
                  color:#1a1a1a;">
        ${toBonzai(name)}
      </div>
      <!-- Grad -->
      <div style="position:absolute;top:109mm;left:135mm;width:148mm;text-align:center;
                  font-family:'Bonzai',cursive;font-size:22pt;
                  color:#1a1a1a;">
        ${toBonzai(grad)}
      </div>
      <!-- Urkundennummer unter dem Aikido-Bild links -->
      ${certNr ? `<div style="position:absolute;top:174mm;left:20mm;width:115mm;text-align:center;
                  font-family:'Bonzai',cursive;font-size:13pt;
                  color:#1a1a1a;letter-spacing:0.5px;">
        ${toBonzai(certNr)}
      </div>` : ''}
    </div>
  `;
  document.body.appendChild(overlay);

  document.fonts.ready.then(() => {
    window.print();
    document.body.removeChild(overlay);
    document.head.removeChild(printStyle);
  });
}

export function druckeBoB(u) {
  const name   = `${u.vorname} ${u.nachname}`;
  const certNr = u.urkundennummer || '';
  const datum  = formatDatum(u.ausstellungsdatum);

  // 1) Bonzai-Font in aktuelle Seite laden (gleiche Origin = kein CORS)
  if (!document.getElementById('bonzai-font-style')) {
    const fs = document.createElement('style');
    fs.id = 'bonzai-font-style';
    fs.textContent = `@font-face {
      font-family: 'Bonzai';
      src: url('/assets/bonzai.ttf') format('truetype');
    }`;
    document.head.appendChild(fs);
  }

  // 2) Print-CSS: React-App ausblenden, nur Overlay anzeigen
  const printStyle = document.createElement('style');
  printStyle.id = 'bobb-print-style';
  printStyle.textContent = `
    @media print {
      @page { size: A3 landscape; margin: 0; }
      #root { display: none !important; }
      #bobb-overlay { display: block !important; }
    }
    #bobb-overlay { display: none; }
  `;
  document.head.appendChild(printStyle);

  // 3) Print-Overlay mit positionierten Feldern
  const overlay = document.createElement('div');
  overlay.id = 'bobb-overlay';
  overlay.innerHTML = `
    <div style="position:relative;width:420mm;height:297mm;">
      <div style="position:absolute;top:69mm;left:8mm;width:136mm;text-align:center;
                  font-family:'Great Vibes',cursive;font-size:30pt;line-height:1;color:#1a0f08;">
        ${name}
      </div>
      <div style="position:absolute;top:168mm;left:28mm;
                  font-family:'Bonzai',cursive;font-size:14pt;color:#1a0f08;">
        ${certNr}
      </div>
      <div style="position:absolute;top:180mm;left:19mm;
                  font-family:'Bonzai',cursive;font-size:14pt;color:#1a0f08;">
        ${datum}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // 4) Auf Font-Laden warten, dann drucken
  document.fonts.ready.then(() => {
    window.print();
    // Aufräumen
    document.body.removeChild(overlay);
    document.head.removeChild(printStyle);
  });
}
