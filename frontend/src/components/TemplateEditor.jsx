import React, { useEffect, useRef, useState } from 'react';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import gjsPresetWebpage from 'grapesjs-preset-webpage';
import axios from 'axios';
import '../styles/TemplateEditor.css';

const TemplateEditor = ({ templateId, dojoId, onSave, onClose }) => {
  const editorRef = useRef(null);
  const [editor, setEditor] = useState(null);
  const [templateName, setTemplateName] = useState('');
  const [templateType, setTemplateType] = useState('vertrag');
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showPlaceholders, setShowPlaceholders] = useState(false);

  // Verfügbare Platzhalter
  const placeholders = {
    mitglied: [
      { label: 'Vorname', value: '{{mitglied.vorname}}' },
      { label: 'Nachname', value: '{{mitglied.nachname}}' },
      { label: 'E-Mail', value: '{{mitglied.email}}' },
      { label: 'Telefon', value: '{{mitglied.telefon}}' },
      { label: 'Straße', value: '{{mitglied.strasse}}' },
      { label: 'Hausnummer', value: '{{mitglied.hausnummer}}' },
      { label: 'PLZ', value: '{{mitglied.plz}}' },
      { label: 'Ort', value: '{{mitglied.ort}}' },
      { label: 'Geburtsdatum', value: '{{mitglied.geburtsdatum}}' },
      { label: 'Mitgliedsnummer', value: '{{mitglied.mitgliedsnummer}}' }
    ],
    vertrag: [
      { label: 'Vertragsnummer', value: '{{vertrag.vertragsnummer}}' },
      { label: 'Vertragsbeginn', value: '{{vertrag.vertragsbeginn}}' },
      { label: 'Vertragsende', value: '{{vertrag.vertragsende}}' },
      { label: 'Monatsbeitrag', value: '{{vertrag.monatsbeitrag}}' },
      { label: 'Mindestlaufzeit', value: '{{vertrag.mindestlaufzeit_monate}}' },
      { label: 'Kündigungsfrist', value: '{{vertrag.kuendigungsfrist_monate}}' },
      { label: 'Tarifname', value: '{{vertrag.tarifname}}' }
    ],
    dojo: [
      { label: 'Dojo Name', value: '{{dojo.dojoname}}' },
      { label: 'Straße', value: '{{dojo.strasse}}' },
      { label: 'Hausnummer', value: '{{dojo.hausnummer}}' },
      { label: 'PLZ', value: '{{dojo.plz}}' },
      { label: 'Ort', value: '{{dojo.ort}}' },
      { label: 'Telefon', value: '{{dojo.telefon}}' },
      { label: 'E-Mail', value: '{{dojo.email}}' },
      { label: 'Website', value: '{{dojo.internet}}' }
    ],
    system: [
      { label: 'Heutiges Datum', value: '{{system.datum}}' },
      { label: 'Jahr', value: '{{system.jahr}}' },
      { label: 'Monat', value: '{{system.monat}}' }
    ]
  };

  useEffect(() => {
    if (!editorRef.current) return;

    const editorInstance = grapesjs.init({
      container: editorRef.current,
      height: '700px',
      width: 'auto',
      plugins: [gjsPresetWebpage],
      storageManager: false,
      pluginsOpts: {
        [gjsPresetWebpage]: {
          blocks: ['link-block', 'quote', 'text', 'image', 'video', 'map']
        }
      },
      canvas: {
        styles: [
          'https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css'
        ]
      },
      assetManager: {
        upload: false, // Wir können dies später auf einen Upload-Endpoint setzen
        uploadText: 'Logo hochladen',
        addBtnText: 'Bild hinzufügen',
        modalTitle: 'Bild auswählen',
        assets: []
      }
    });

    // Pfeile für numerische Inputs im Style Manager aktivieren
    const enableNumberInputArrows = () => {
      const styleManager = editorInstance.StyleManager;
      if (!styleManager) return;
      
      // Observer für Änderungen im Style Manager DOM
      const observer = new MutationObserver(() => {
        const panels = styleManager.getPanels();
        panels.forEach(panel => {
          const panelEl = panel.get('el');
          if (!panelEl) return;
          
          const inputs = panelEl.querySelectorAll('input[type="number"]');
          inputs.forEach(input => {
            // Prüfe ob bereits Pfeile hinzugefügt wurden
            if (input.dataset.arrowsEnabled === 'true') return;
            input.dataset.arrowsEnabled = 'true';
            
            // Finde das Parent-Element (normalerweise ein div mit der Input-Gruppe)
            let inputWrapper = input.parentElement;
            while (inputWrapper && !inputWrapper.classList.contains('gjs-sm-field')) {
              inputWrapper = inputWrapper.parentElement;
            }
            
            if (!inputWrapper) inputWrapper = input.parentElement;
            
            // Stelle sicher, dass das Wrapper-Element relative Position hat
            if (getComputedStyle(inputWrapper).position === 'static') {
              inputWrapper.style.position = 'relative';
            }
            
            // Füge Pfeile hinzu, falls noch nicht vorhanden
            if (!inputWrapper.querySelector('.gjs-number-arrows')) {
              const arrowsContainer = document.createElement('div');
              arrowsContainer.className = 'gjs-number-arrows';
              arrowsContainer.style.cssText = `
                position: absolute;
                right: 2px;
                top: 50%;
                transform: translateY(-50%);
                display: flex;
                flex-direction: column;
                gap: 1px;
                z-index: 10;
                height: calc(100% - 4px);
              `;
              
              const upArrow = document.createElement('button');
              upArrow.type = 'button';
              upArrow.innerHTML = '▲';
              upArrow.style.cssText = `
                background: rgba(0, 0, 0, 0.3);
                border: none;
                color: #fff;
                cursor: pointer;
                padding: 0;
                font-size: 8px;
                line-height: 1;
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 2px 2px 0 0;
                min-height: 0;
                transition: background 0.2s;
              `;
              upArrow.onmouseenter = () => upArrow.style.background = 'rgba(0, 0, 0, 0.5)';
              upArrow.onmouseleave = () => upArrow.style.background = 'rgba(0, 0, 0, 0.3)';
              upArrow.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const currentValue = parseFloat(input.value) || 0;
                const step = parseFloat(input.step) || 1;
                const max = input.max !== '' ? parseFloat(input.max) : undefined;
                let newValue = currentValue + step;
                if (max !== undefined && newValue > max) newValue = max;
                input.value = newValue;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
              };
              
              const downArrow = document.createElement('button');
              downArrow.type = 'button';
              downArrow.innerHTML = '▼';
              downArrow.style.cssText = `
                background: rgba(0, 0, 0, 0.3);
                border: none;
                color: #fff;
                cursor: pointer;
                padding: 0;
                font-size: 8px;
                line-height: 1;
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 0 0 2px 2px;
                min-height: 0;
                transition: background 0.2s;
              `;
              downArrow.onmouseenter = () => downArrow.style.background = 'rgba(0, 0, 0, 0.5)';
              downArrow.onmouseleave = () => downArrow.style.background = 'rgba(0, 0, 0, 0.3)';
              downArrow.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                const currentValue = parseFloat(input.value) || 0;
                const step = parseFloat(input.step) || 1;
                const min = input.min !== '' ? parseFloat(input.min) : undefined;
                let newValue = currentValue - step;
                if (min !== undefined && newValue < min) newValue = min;
                input.value = newValue;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
              };
              
              arrowsContainer.appendChild(upArrow);
              arrowsContainer.appendChild(downArrow);
              inputWrapper.appendChild(arrowsContainer);
            }
          });
        });
      });
      
      // Beobachte Änderungen im Style Manager Container
      const styleManagerEl = styleManager.getContainer();
      if (styleManagerEl) {
        observer.observe(styleManagerEl, {
          childList: true,
          subtree: true
        });
      }
      
      // Initial ausführen
      setTimeout(() => {
        const panels = styleManager.getPanels();
        panels.forEach(panel => {
          const panelEl = panel.get('el');
          if (panelEl) {
            observer.observe(panelEl, {
              childList: true,
              subtree: true
            });
          }
        });
      }, 500);
    };
    
    // Aktiviere Pfeile nach Editor-Initialisierung
    editorInstance.on('load', () => {
      setTimeout(enableNumberInputArrows, 500);

      // Füge Seitenwechsel-CSS in den Canvas ein
      try {
        const canvasDoc = editorInstance.Canvas.getDocument();
        if (canvasDoc) {
          const styleEl = canvasDoc.createElement('style');
          styleEl.innerHTML = `
            /* A4-Seiten-Simulation */
            body {
              background: #f5f5f5 !important;
              padding: 20px !important;
            }

            /* Simuliere A4-Seiten */
            body > div, body > section, body > article {
              background: white;
              max-width: 210mm;
              min-height: 297mm;
              margin: 0 auto 20mm auto;
              padding: 20mm;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
              position: relative;
            }

            /* Seitenwechsel nach ca. 297mm Höhe */
            body > div:not(:last-child)::after,
            body > section:not(:last-child)::after,
            body > article:not(:last-child)::after {
              content: '─────────── Seitenwechsel ───────────';
              display: block;
              text-align: center;
              color: #999;
              font-size: 12px;
              margin-top: 20mm;
              padding: 10px;
              background: #f0f0f0;
              border-top: 2px dashed #ccc;
              border-bottom: 2px dashed #ccc;
              position: absolute;
              bottom: -30px;
              left: 0;
              right: 0;
              width: 100%;
            }
          `;
          canvasDoc.head.appendChild(styleEl);
        }
      } catch (err) {
        console.warn('Konnte Seitenwechsel-CSS nicht einfügen:', err);
      }
    });
    
    // Aktiviere auch bei Style Manager Updates
    editorInstance.on('styleManager:update', () => {
      setTimeout(enableNumberInputArrows, 100);
    });

    // Custom Blocks für Vertragsdaten
    const blockManager = editorInstance.BlockManager;

    // ==================== BASIS BLÖCKE ====================

    // Freier Text Block
    blockManager.add('free-text-block', {
      label: '📝 Freier Text',
      category: '1️⃣ Basis',
      content: {
        type: 'text',
        content: 'Klicken Sie hier, um Text zu bearbeiten...',
        style: { padding: '10px' }
      }
    });

    // Logo Block
    blockManager.add('logo-block', {
      label: '🖼️ Logo/Bild',
      category: '1️⃣ Basis',
      content: `
        <div style="text-align: center; padding: 20px;">
          <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='100' viewBox='0 0 200 100'%3E%3Crect width='200' height='100' fill='%23e0e0e0'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='Arial' font-size='14' fill='%23666'%3ELogo hier einfügen%3C/text%3E%3C/svg%3E"
               alt="Logo"
               style="max-width: 200px; height: auto;" />
        </div>
      `
    });

    // ==================== NEUMITGLIED / VERTRAGSABSCHLUSS ====================

    // Mitgliedsdaten Block
    blockManager.add('mitglied-block', {
      label: '👤 Mitgliedsdaten',
      category: '2️⃣ Neumitglied',
      content: `
        <div class="mitglied-daten" style="padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 10px 0;">
          <h3 style="color: #1976d2; margin-bottom: 15px;">Persönliche Daten</h3>
          <p><strong>Name:</strong> {{mitglied.vorname}} {{mitglied.nachname}}</p>
          <p><strong>Adresse:</strong> {{mitglied.strasse}} {{mitglied.hausnummer}}, {{mitglied.plz}} {{mitglied.ort}}</p>
          <p><strong>E-Mail:</strong> {{mitglied.email}}</p>
          <p><strong>Telefon:</strong> {{mitglied.telefon}}</p>
        </div>
      `
    });

    // Vertragsdaten Block
    blockManager.add('vertrag-block', {
      label: '📄 Vertragsdaten',
      category: '2️⃣ Neumitglied',
      content: `
        <div class="vertrag-daten" style="padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 10px 0;">
          <h3 style="color: #1976d2; margin-bottom: 15px;">Vertragsinformationen</h3>
          <p><strong>Vertragsnummer:</strong> {{vertrag.vertragsnummer}}</p>
          <p><strong>Vertragsbeginn:</strong> {{vertrag.vertragsbeginn}}</p>
          <p><strong>Monatsbeitrag:</strong> €{{vertrag.monatsbeitrag}}</p>
          <p><strong>Laufzeit:</strong> {{vertrag.mindestlaufzeit_monate}} Monate</p>
        </div>
      `
    });

    // Dojo-Daten Block
    blockManager.add('dojo-block', {
      label: '🏢 Dojo-Informationen',
      category: '2️⃣ Neumitglied',
      content: `
        <div class="dojo-daten" style="padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 10px 0;">
          <h2 style="color: #1976d2; text-align: center;">{{dojo.dojoname}}</h2>
          <p style="text-align: center;">{{dojo.strasse}} {{dojo.hausnummer}}, {{dojo.plz}} {{dojo.ort}}</p>
          <p style="text-align: center;">Tel: {{dojo.telefon}} | E-Mail: {{dojo.email}}</p>
        </div>
      `
    });

    // Unterschriften Block
    blockManager.add('signature-block', {
      label: '✍️ Unterschriften',
      category: '2️⃣ Neumitglied',
      content: `
        <div class="signature-section" style="display: flex; justify-content: space-between; margin-top: 60px; padding: 20px;">
          <div style="text-align: center; width: 45%;">
            <div style="border-bottom: 2px solid #000; height: 50px; margin-bottom: 10px;"></div>
            <p><strong>Ort, Datum</strong></p>
            <p>Unterschrift Dojo</p>
          </div>
          <div style="text-align: center; width: 45%;">
            <div style="border-bottom: 2px solid #000; height: 50px; margin-bottom: 10px;"></div>
            <p><strong>{{system.datum}}</strong></p>
            <p>Unterschrift Mitglied</p>
          </div>
        </div>
      `
    });

    // Tabelle Block
    blockManager.add('table-block', {
      label: '📋 Tabelle',
      category: '2️⃣ Neumitglied',
      content: `
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #1976d2; color: white;">
            <th style="padding: 10px; border: 1px solid #ddd;">Bezeichnung</th>
            <th style="padding: 10px; border: 1px solid #ddd;">Wert</th>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Monatsbeitrag</td>
            <td style="padding: 10px; border: 1px solid #ddd;">€{{vertrag.monatsbeitrag}}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border: 1px solid #ddd;">Laufzeit</td>
            <td style="padding: 10px; border: 1px solid #ddd;">{{vertrag.mindestlaufzeit_monate}} Monate</td>
          </tr>
        </table>
      `
    });

    // ==================== RECHTLICHES (NEUMITGLIED) ====================

    // Widerrufsrecht
    blockManager.add('widerruf-block', {
      label: '⚖️ Widerrufsrecht',
      category: '2️⃣ Neumitglied',
      content: `
        <div style="padding: 15px; background: #fff3e0; border-left: 4px solid #ff9800; margin: 20px 0;">
          <h4 style="color: #e65100; margin-top: 0;">Widerrufsrecht</h4>
          <p>Sie haben das Recht, binnen vierzehn Tagen ohne Angabe von Gründen diesen Vertrag zu widerrufen.</p>
          <p>Die Widerrufsfrist beträgt vierzehn Tage ab dem Tag des Vertragsabschlusses.</p>
          <p>Um Ihr Widerrufsrecht auszuüben, müssen Sie uns ({{dojo.dojoname}}, {{dojo.strasse}} {{dojo.hausnummer}}, {{dojo.plz}} {{dojo.ort}}, E-Mail: {{dojo.email}}) mittels einer eindeutigen Erklärung über Ihren Entschluss, diesen Vertrag zu widerrufen, informieren.</p>
        </div>
      `
    });

    // SEPA-Mandat
    blockManager.add('sepa-block', {
      label: '🏦 SEPA-Mandat',
      category: '2️⃣ Neumitglied',
      content: `
        <div style="padding: 20px; border: 2px solid #1976d2; margin: 20px 0;">
          <h3 style="color: #1976d2; text-align: center; margin-top: 0;">SEPA-Lastschriftmandat</h3>
          <p><strong>Gläubiger:</strong> {{dojo.dojoname}}</p>
          <p><strong>Gläubiger-ID:</strong> [Gläubiger-ID eintragen]</p>
          <p><strong>Mandatsreferenz:</strong> {{vertrag.vertragsnummer}}</p>
          <br/>
          <p>Ich/Wir ermächtige(n) {{dojo.dojoname}}, Zahlungen von meinem/unserem Konto mittels Lastschrift einzuziehen. Zugleich weise(n) ich/wir mein/unser Kreditinstitut an, die von {{dojo.dojoname}} auf mein/unser Konto gezogenen Lastschriften einzulösen.</p>
          <br/>
          <p style="font-size: 0.9em; color: #666;">Hinweis: Ich kann/Wir können innerhalb von acht Wochen, beginnend mit dem Belastungsdatum, die Erstattung des belasteten Betrages verlangen. Es gelten dabei die mit meinem/unserem Kreditinstitut vereinbarten Bedingungen.</p>
          <br/>
          <table style="width: 100%; margin-top: 20px;">
            <tr>
              <td style="width: 50%; padding-right: 10px;">
                <p><strong>Kontoinhaber:</strong></p>
                <p style="border-bottom: 1px solid #000; min-height: 25px;">{{mitglied.vorname}} {{mitglied.nachname}}</p>
              </td>
              <td style="width: 50%; padding-left: 10px;">
                <p><strong>IBAN:</strong></p>
                <p style="border-bottom: 1px solid #000; min-height: 25px;">&nbsp;</p>
              </td>
            </tr>
            <tr>
              <td style="padding-right: 10px; padding-top: 15px;">
                <p><strong>BIC:</strong></p>
                <p style="border-bottom: 1px solid #000; min-height: 25px;">&nbsp;</p>
              </td>
              <td style="padding-left: 10px; padding-top: 15px;">
                <p><strong>Kreditinstitut:</strong></p>
                <p style="border-bottom: 1px solid #000; min-height: 25px;">&nbsp;</p>
              </td>
            </tr>
          </table>
        </div>
      `
    });

    // Datenschutzerklärung
    blockManager.add('datenschutz-block', {
      label: '🔒 Datenschutz',
      category: '2️⃣ Neumitglied',
      content: `
        <div style="padding: 15px; background: #e8f5e9; border-left: 4px solid #4caf50; margin: 20px 0;">
          <h4 style="color: #2e7d32; margin-top: 0;">Datenschutzhinweise</h4>
          <p>Mit der Unterzeichnung dieses Vertrags bestätige ich, dass ich die Datenschutzerklärung von {{dojo.dojoname}} zur Kenntnis genommen habe.</p>
          <p>Ich bin damit einverstanden, dass meine personenbezogenen Daten zur Vertragsabwicklung und Mitgliederverwaltung gespeichert und verarbeitet werden.</p>
          <p>Die vollständige Datenschutzerklärung ist einsehbar unter: {{dojo.internet}}/datenschutz</p>
          <br/>
          <p style="font-size: 0.85em;">☐ Ich willige ein, dass {{dojo.dojoname}} mich per E-Mail über Angebote, Events und Neuigkeiten informieren darf. Diese Einwilligung kann ich jederzeit widerrufen.</p>
        </div>
      `
    });

    // Gesundheitserklärung
    blockManager.add('gesundheit-block', {
      label: '🏥 Gesundheitserklärung',
      category: '2️⃣ Neumitglied',
      content: `
        <div style="padding: 20px; border: 2px solid #f44336; margin: 20px 0;">
          <h4 style="color: #c62828; margin-top: 0;">Gesundheitserklärung & Haftungsausschluss</h4>
          <p>Ich bestätige, dass ich gesundheitlich in der Lage bin, am Trainingsangebot teilzunehmen und keine gesundheitlichen Einschränkungen vorliegen, die einer sportlichen Betätigung entgegenstehen.</p>
          <br/>
          <p><strong>Bitte ankreuzen:</strong></p>
          <p>☐ Ich leide an keinen akuten oder chronischen Erkrankungen</p>
          <p>☐ Ich nehme keine regelmäßigen Medikamente ein</p>
          <p>☐ Ich bin nicht schwanger</p>
          <br/>
          <p style="font-size: 0.9em;"><strong>Haftungsausschluss:</strong></p>
          <p style="font-size: 0.85em;">Die Teilnahme am Training erfolgt auf eigene Gefahr. {{dojo.dojoname}} übernimmt keine Haftung für Unfälle, Verletzungen oder Schäden, die während des Trainings oder auf dem Weg zum/vom Training entstehen, sofern kein grob fahrlässiges oder vorsätzliches Verhalten vorliegt.</p>
        </div>
      `
    });

    // ==================== BESTANDSVORLAGEN ====================

    // Beitragsanpassung
    blockManager.add('beitragsanpassung-block', {
      label: '💰 Beitragsanpassung',
      category: '3️⃣ Bestand',
      content: `
        <div style="padding: 20px; background: #fff9c4; border: 2px solid #fbc02d; margin: 20px 0; border-radius: 8px;">
          <h4 style="color: #f57f17; margin-top: 0;">Mitteilung zur Beitragsanpassung</h4>
          <p>Sehr geehrte/r {{mitglied.vorname}} {{mitglied.nachname}},</p>
          <br/>
          <p>wir möchten Sie rechtzeitig über eine Anpassung Ihres Monatsbeitrags informieren.</p>
          <br/>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Aktueller Beitrag:</strong> €{{vertrag.monatsbeitrag}} pro Monat</p>
            <p><strong>Neuer Beitrag:</strong> €[Neuer Betrag] pro Monat</p>
            <p><strong>Gültig ab:</strong> [Datum einfügen]</p>
          </div>
          <p><strong>Grund für die Anpassung:</strong></p>
          <p>[Hier Begründung einfügen, z.B. gestiegene Betriebskosten, Inflation, erweiterte Leistungen]</p>
          <br/>
          <p style="background: #e3f2fd; padding: 10px; border-radius: 4px;">
            ℹ️ Sie haben ein <strong>Sonderkündigungsrecht</strong> innerhalb von 6 Wochen nach Erhalt dieser Mitteilung.
          </p>
          <br/>
          <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
        </div>
      `
    });

    // Zahlungserinnerung
    blockManager.add('zahlungserinnerung-block', {
      label: '⚠️ Zahlungserinnerung',
      category: '3️⃣ Bestand',
      content: `
        <div style="padding: 20px; background: #ffebee; border-left: 4px solid #f44336; margin: 20px 0;">
          <h4 style="color: #c62828; margin-top: 0;">Freundliche Zahlungserinnerung</h4>
          <p>Sehr geehrte/r {{mitglied.vorname}} {{mitglied.nachname}},</p>
          <br/>
          <p>uns ist aufgefallen, dass die Zahlung für Ihren Mitgliedsbeitrag noch aussteht.</p>
          <br/>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Vertragsnummer:</strong> {{vertrag.vertragsnummer}}</p>
            <p><strong>Offener Betrag:</strong> €{{vertrag.monatsbeitrag}}</p>
            <p><strong>Fällig seit:</strong> [Datum einfügen]</p>
          </div>
          <p>Bitte überweisen Sie den offenen Betrag innerhalb der nächsten 7 Tage auf folgendes Konto:</p>
          <div style="background: #f5f5f5; padding: 10px; border-radius: 4px; font-family: monospace; margin: 10px 0;">
            <p>Empfänger: {{dojo.dojoname}}</p>
            <p>IBAN: [IBAN einfügen]</p>
            <p>Verwendungszweck: {{vertrag.vertragsnummer}}</p>
          </div>
          <p style="font-size: 0.9em; color: #666;">Falls Sie bereits gezahlt haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.</p>
        </div>
      `
    });

    // Vertragsänderung
    blockManager.add('vertragsaenderung-block', {
      label: '📝 Vertragsänderung',
      category: '3️⃣ Bestand',
      content: `
        <div style="padding: 20px; background: #e3f2fd; border: 2px solid #2196f3; margin: 20px 0; border-radius: 8px;">
          <h4 style="color: #1565c0; margin-top: 0;">Bestätigung Vertragsänderung</h4>
          <p>Sehr geehrte/r {{mitglied.vorname}} {{mitglied.nachname}},</p>
          <br/>
          <p>wir bestätigen hiermit die vereinbarte Änderung Ihres Mitgliedsvertrags.</p>
          <br/>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Vertragsnummer:</strong> {{vertrag.vertragsnummer}}</p>
            <p><strong>Datum der Änderung:</strong> {{system.datum}}</p>
            <p><strong>Gültig ab:</strong> [Datum einfügen]</p>
          </div>
          <p><strong>Folgende Änderungen wurden vorgenommen:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>[Änderung 1, z.B. Tarifwechsel von Standard zu Premium]</li>
            <li>[Änderung 2, z.B. Beitragsanpassung]</li>
            <li>[Änderung 3]</li>
          </ul>
          <br/>
          <p>Alle anderen Vertragsbestandteile bleiben unverändert.</p>
        </div>
      `
    });

    // Kündigungsregelungen
    blockManager.add('kuendigung-block', {
      label: '📅 Kündigungsregelungen',
      category: '3️⃣ Bestand',
      content: `
        <div style="padding: 15px; background: #fff9c4; border-left: 4px solid #fbc02d; margin: 20px 0;">
          <h4 style="color: #f57f17; margin-top: 0;">Kündigungsregelungen</h4>
          <p><strong>Mindestlaufzeit:</strong> {{vertrag.mindestlaufzeit_monate}} Monate ab Vertragsbeginn</p>
          <p><strong>Kündigungsfrist:</strong> {{vertrag.kuendigungsfrist_monate}} Monate zum Vertragsende</p>
          <p><strong>Vertragsbeginn:</strong> {{vertrag.vertragsbeginn}}</p>
          <br/>
          <p>Nach Ablauf der Mindestlaufzeit verlängert sich der Vertrag automatisch um jeweils 12 Monate, sofern nicht fristgerecht gekündigt wird.</p>
          <p>Die Kündigung muss schriftlich (per Post oder E-Mail an {{dojo.email}}) erfolgen.</p>
          <br/>
          <p style="font-size: 0.85em;"><strong>Sonderkündigungsrecht:</strong> Bei Umzug (> 50km), längerer Krankheit (> 3 Monate mit ärztlichem Attest) oder Schwangerschaft ist eine vorzeitige Kündigung möglich.</p>
        </div>
      `
    });

    // Zahlungsmodalitäten
    blockManager.add('zahlung-block', {
      label: '💳 Zahlungsmodalitäten',
      category: '3️⃣ Bestand',
      content: `
        <div style="padding: 15px; background: #e1f5fe; border-left: 4px solid #0288d1; margin: 20px 0;">
          <h4 style="color: #01579b; margin-top: 0;">Zahlungsmodalitäten</h4>
          <p><strong>Monatsbeitrag:</strong> €{{vertrag.monatsbeitrag}}</p>
          <p><strong>Zahlungsweise:</strong> Monatlich per SEPA-Lastschrift</p>
          <p><strong>Fälligkeit:</strong> Jeweils zum 1. des Monats</p>
          <br/>
          <p>Die Beiträge werden zum 1. eines jeden Monats im Voraus fällig und per SEPA-Lastschrift eingezogen.</p>
          <p>Bei Rücklastschriften werden die entstehenden Bankgebühren in Rechnung gestellt.</p>
          <br/>
          <p style="font-size: 0.85em;"><strong>Beitragsanpassung:</strong> {{dojo.dojoname}} behält sich vor, die Beiträge mit einer Ankündigungsfrist von 6 Wochen anzupassen.</p>
        </div>
      `
    });

    // AGB-Hinweis
    blockManager.add('agb-block', {
      label: '📜 AGB-Hinweis',
      category: '3️⃣ Bestand',
      content: `
        <div style="padding: 15px; background: #f3e5f5; border-left: 4px solid #9c27b0; margin: 20px 0;">
          <h4 style="color: #6a1b9a; margin-top: 0;">Allgemeine Geschäftsbedingungen</h4>
          <p>Mit Unterzeichnung dieses Vertrags erkenne ich die Allgemeinen Geschäftsbedingungen (AGB) sowie die Hausordnung von {{dojo.dojoname}} an.</p>
          <br/>
          <p>Die vollständigen AGB und die Hausordnung wurden mir ausgehändigt und sind zudem einsehbar unter:</p>
          <p><strong>{{dojo.internet}}/agb</strong></p>
          <br/>
          <p style="font-size: 0.85em;">☐ Hiermit bestätige ich, die AGB und Hausordnung gelesen und verstanden zu haben.</p>
        </div>
      `
    });

    // Hausordnung/Verhaltensregeln
    blockManager.add('hausordnung-block', {
      label: '🥋 Hausordnung',
      category: '3️⃣ Bestand',
      content: `
        <div style="padding: 15px; background: #fce4ec; border-left: 4px solid #e91e63; margin: 20px 0;">
          <h4 style="color: #880e4f; margin-top: 0;">Hausordnung & Verhaltensregeln</h4>
          <p><strong>Wichtige Verhaltensregeln:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Pünktliches Erscheinen zum Training</li>
            <li>Saubere Sportkleidung und Hygiene</li>
            <li>Respektvoller Umgang mit Trainern und Mitgliedern</li>
            <li>Nutzung von Trainingsgeräten nur unter Anleitung</li>
            <li>Umkleiden und Duschen sauber hinterlassen</li>
          </ul>
          <br/>
          <p style="font-size: 0.85em;">Bei wiederholten Verstößen gegen die Hausordnung behält sich {{dojo.dojoname}} das Recht vor, das Vertragsverhältnis außerordentlich zu kündigen.</p>
        </div>
      `
    });

    // ==================== PLATZHALTER BLÖCKE ====================

    // Mitglied Platzhalter
    Object.entries(placeholders.mitglied).forEach((item, idx) => {
      blockManager.add(`placeholder-mitglied-${idx}`, {
        label: item[1].label,
        category: '5️⃣ Mitglied',
        content: `<span style="background: #e3f2fd; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #1565c0; border: 1px solid #90caf9;">${item[1].value}</span>`
      });
    });

    // Vertrag Platzhalter
    Object.entries(placeholders.vertrag).forEach((item, idx) => {
      blockManager.add(`placeholder-vertrag-${idx}`, {
        label: item[1].label,
        category: '6️⃣ Vertrag',
        content: `<span style="background: #fff3e0; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #e65100; border: 1px solid #ffb74d;">${item[1].value}</span>`
      });
    });

    // Dojo Platzhalter
    Object.entries(placeholders.dojo).forEach((item, idx) => {
      blockManager.add(`placeholder-dojo-${idx}`, {
        label: item[1].label,
        category: '7️⃣ Dojo',
        content: `<span style="background: #e8f5e9; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #2e7d32; border: 1px solid #81c784;">${item[1].value}</span>`
      });
    });

    // System Platzhalter
    Object.entries(placeholders.system).forEach((item, idx) => {
      blockManager.add(`placeholder-system-${idx}`, {
        label: item[1].label,
        category: '8️⃣ System',
        content: `<span style="background: #f3e5f5; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #6a1b9a; border: 1px solid #ba68c8;">${item[1].value}</span>`
      });
    });

    // ==================== KÜNDIGUNGEN ====================

    // Kündigungsbestätigung
    blockManager.add('kuendigung-bestaetigung-block', {
      label: '📋 Kündigungsbestätigung',
      category: '4️⃣ Kündigung',
      content: `
        <div style="padding: 20px; background: #ffebee; border: 2px solid #ef5350; margin: 20px 0; border-radius: 8px;">
          <h3 style="color: #c62828; text-align: center; margin-top: 0;">Kündigungsbestätigung</h3>
          <p>Sehr geehrte/r {{mitglied.vorname}} {{mitglied.nachname}},</p>
          <br/>
          <p>wir bestätigen hiermit den Eingang Ihrer Kündigung für Ihren Mitgliedsvertrag.</p>
          <br/>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Vertragsnummer:</strong> {{vertrag.vertragsnummer}}</p>
            <p><strong>Kündigungsdatum (Eingang):</strong> {{system.datum}}</p>
            <p><strong>Vertragsende:</strong> {{vertrag.vertragsende}}</p>
            <p><strong>Letzte Zahlung fällig am:</strong> [Datum einfügen]</p>
          </div>
          <p>Ihr Vertrag endet somit ordnungsgemäß zum oben genannten Datum. Bis dahin gilt Ihre Mitgliedschaft unverändert fort.</p>
          <p>Wir bedanken uns für Ihr Vertrauen und wünschen Ihnen alles Gute für die Zukunft.</p>
          <br/>
          <p>Mit freundlichen Grüßen,<br/>{{dojo.dojoname}}</p>
        </div>
      `
    });

    // Kündigungseingang
    blockManager.add('kuendigung-eingang-block', {
      label: '✉️ Kündigungseingang',
      category: '4️⃣ Kündigung',
      content: `
        <div style="padding: 20px; background: #fff3e0; border-left: 4px solid #ff9800; margin: 20px 0;">
          <h4 style="color: #e65100; margin-top: 0;">Eingangsbestätigung Kündigung</h4>
          <p>Hiermit bestätigen wir den Eingang Ihrer Kündigungserklärung vom {{system.datum}}.</p>
          <br/>
          <p><strong>Betroffener Vertrag:</strong> {{vertrag.vertragsnummer}}</p>
          <p><strong>Mitgliedsnummer:</strong> {{mitglied.mitgliedsnummer}}</p>
          <br/>
          <p>Ihre Kündigung wird geprüft und Sie erhalten in Kürze eine detaillierte Kündigungsbestätigung mit dem genauen Vertragsende.</p>
        </div>
      `
    });

    // Vertragsauslauf
    blockManager.add('vertragsauslauf-block', {
      label: '⏰ Vertragsauslauf',
      category: '4️⃣ Kündigung',
      content: `
        <div style="padding: 20px; background: #e3f2fd; border-left: 4px solid #2196f3; margin: 20px 0;">
          <h4 style="color: #1565c0; margin-top: 0;">Hinweis zum Vertragsende</h4>
          <p>Sehr geehrte/r {{mitglied.vorname}} {{mitglied.nachname}},</p>
          <br/>
          <p>wir möchten Sie daran erinnern, dass Ihr Vertrag am <strong>{{vertrag.vertragsende}}</strong> ausläuft.</p>
          <br/>
          <p><strong>Wichtige Informationen:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Bis zum Vertragsende können Sie alle Leistungen in vollem Umfang nutzen</li>
            <li>Die letzte Abbuchung erfolgt zum [Datum einfügen]</li>
            <li>Ihre Zugangskarte/Mitgliedschaft erlischt automatisch am {{vertrag.vertragsende}}</li>
            <li>Persönliche Gegenstände bitte bis zum Vertragsende abholen</li>
          </ul>
          <br/>
          <p style="background: #fff3e0; padding: 10px; border-radius: 4px; font-size: 0.9em;">
            💡 <strong>Möchten Sie doch bleiben?</strong> Gerne können Sie Ihre Kündigung bis [Frist] zurückziehen. Kontaktieren Sie uns einfach!
          </p>
        </div>
      `
    });

    // Austrittsdokument
    blockManager.add('austritt-block', {
      label: '👋 Austrittsdokument',
      category: '4️⃣ Kündigung',
      content: `
        <div style="padding: 20px; background: #f3e5f5; border: 2px solid #9c27b0; margin: 20px 0; border-radius: 8px;">
          <h3 style="color: #6a1b9a; text-align: center; margin-top: 0;">Austrittsbestätigung</h3>
          <p>{{dojo.dojoname}} bestätigt hiermit, dass</p>
          <br/>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
            <h4 style="margin: 0; color: #6a1b9a;">{{mitglied.vorname}} {{mitglied.nachname}}</h4>
            <p style="margin: 5px 0; color: #666;">Mitgliedsnummer: {{mitglied.mitgliedsnummer}}</p>
          </div>
          <p>die Mitgliedschaft zum <strong>{{vertrag.vertragsende}}</strong> ordnungsgemäß beendet hat.</p>
          <br/>
          <p><strong>Zusammenfassung:</strong></p>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li>Mitglied seit: {{vertrag.vertragsbeginn}}</li>
            <li>Vertrag beendet am: {{vertrag.vertragsende}}</li>
            <li>Alle finanziellen Verpflichtungen wurden erfüllt</li>
            <li>Keine offenen Forderungen</li>
          </ul>
          <br/>
          <p>Wir bedanken uns für die gemeinsame Zeit und wünschen alles Gute für die Zukunft!</p>
          <br/>
          <p style="text-align: center; margin-top: 40px;">
            <strong>{{dojo.dojoname}}</strong><br/>
            {{dojo.strasse}} {{dojo.hausnummer}}, {{dojo.plz}} {{dojo.ort}}<br/>
            {{dojo.email}} | {{dojo.telefon}}
          </p>
        </div>
      `
    });

    // Widerruf der Kündigung
    blockManager.add('kuendigung-widerruf-block', {
      label: '🔄 Widerruf Kündigung',
      category: '4️⃣ Kündigung',
      content: `
        <div style="padding: 20px; background: #e8f5e9; border-left: 4px solid #4caf50; margin: 20px 0;">
          <h4 style="color: #2e7d32; margin-top: 0;">Bestätigung: Rücknahme der Kündigung</h4>
          <p>Sehr geehrte/r {{mitglied.vorname}} {{mitglied.nachname}},</p>
          <br/>
          <p>wir freuen uns, dass Sie sich entschieden haben, Mitglied bei {{dojo.dojoname}} zu bleiben!</p>
          <br/>
          <p>Hiermit bestätigen wir die Rücknahme Ihrer Kündigung vom {{system.datum}}.</p>
          <br/>
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Vertragsnummer:</strong> {{vertrag.vertragsnummer}}</p>
            <p><strong>Status:</strong> <span style="color: #4caf50; font-weight: bold;">✓ AKTIV</span></p>
            <p><strong>Vertragslaufzeit:</strong> Läuft unverändert weiter</p>
          </div>
          <p>Ihre Mitgliedschaft läuft nun wie gewohnt weiter. Die Beitragszahlungen werden regulär fortgesetzt.</p>
          <br/>
          <p>Bei Fragen stehen wir Ihnen gerne zur Verfügung.</p>
          <p>Mit freundlichen Grüßen,<br/>Ihr {{dojo.dojoname}} Team</p>
        </div>
      `
    });

    setEditor(editorInstance);

    // Template laden wenn ID vorhanden
    if (templateId) {
      loadTemplate(templateId, editorInstance);
    }

    return () => {
      if (editorInstance) {
        editorInstance.destroy();
      }
    };
  }, [templateId]);

  const loadTemplate = async (id, editorInstance) => {
    try {
      const response = await axios.get(`/vertragsvorlagen/${id}`);
      const template = response.data.data;

      setTemplateName(template.name);
      setTemplateType(template.template_type);

      // Prüfe ob editorInstance vorhanden ist
      if (!editorInstance) {
        console.warn('Editor noch nicht initialisiert, warte auf Initialisierung');
        return;
      }

      if (template.grapesjs_components && template.grapesjs_styles) {
        editorInstance.setComponents(JSON.parse(template.grapesjs_components));
        editorInstance.setStyle(JSON.parse(template.grapesjs_styles));
      } else if (template.grapesjs_html) {
        editorInstance.setComponents(template.grapesjs_html);
        if (template.grapesjs_css) {
          editorInstance.setStyle(template.grapesjs_css);
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Vorlage:', error);
      // Zeige Alert nur bei echten Fehlern, nicht bei fehlender Editor-Initialisierung
      if (error.message && !error.message.includes('setComponents')) {
        alert('Fehler beim Laden der Vorlage');
      }
    }
  };

  const handleSave = async () => {
    if (!editor) return;

    if (!templateName.trim()) {
      alert('Bitte geben Sie einen Namen für die Vorlage ein');
      return;
    }

    setSaving(true);

    try {
      const html = editor.getHtml();
      const css = editor.getCss();
      const components = JSON.stringify(editor.getComponents());
      const styles = JSON.stringify(editor.getStyle());

      const templateData = {
        name: templateName,
        beschreibung: '',
        dojo_id: dojoId,
        template_type: templateType,
        grapesjs_html: html,
        grapesjs_css: css,
        grapesjs_components: components,
        grapesjs_styles: styles,
        available_placeholders: JSON.stringify(placeholders)
      };

      if (templateId) {
        await axios.put(`/vertragsvorlagen/${templateId}`, templateData);
        alert('✅ Vorlage erfolgreich aktualisiert');
      } else {
        await axios.post('/vertragsvorlagen', templateData);
        alert('✅ Vorlage erfolgreich erstellt');
      }

      if (onSave) onSave();
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      alert('❌ Fehler beim Speichern der Vorlage');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!editor) return;

    try {
      // Falls Template bereits gespeichert ist, verwende die Backend-Preview mit echten Daten
      if (templateId) {
        console.log('📡 Lade Vorschau mit echten Daten für Template:', templateId);
        const response = await axios.get(`/vertragsvorlagen/${templateId}/preview`);
        const blob = new Blob([response.data], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        // Clean up old URL if exists
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }

        setPreviewUrl(url);
      } else {
        // Für neue (noch nicht gespeicherte) Templates: lokale Vorschau mit Platzhaltern
        console.log('📝 Zeige lokale Vorschau (Template noch nicht gespeichert)');
        const html = editor.getHtml();
        const css = editor.getCss();

        const fullHtml = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="UTF-8">
              <style>${css}</style>
              <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
            </head>
            <body style="padding: 20px;">
              ${html}
              <div style="margin-top: 40px; padding: 20px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px;">
                <p style="margin: 0 0 10px 0;"><strong>ℹ️ Hinweis:</strong> Dies ist eine neue, noch nicht gespeicherte Vorlage.</p>
                <p style="margin: 0;"><strong>Speichern Sie die Vorlage</strong>, um eine Vorschau mit echten Daten aus der Datenbank zu sehen.</p>
              </div>
            </body>
          </html>
        `;

        const blob = new Blob([fullHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
        }

        setPreviewUrl(url);
      }
    } catch (error) {
      console.error('Fehler bei der Vorschau:', error);
      alert('❌ Fehler bei der Vorschau-Erstellung: ' + error.message);
    }
  };

  const insertPlaceholder = (placeholder) => {
    if (!editor) return;

    const selected = editor.getSelected();
    if (selected) {
      const currentContent = selected.get('content') || '';
      selected.set('content', currentContent + ' ' + placeholder);
    }
  };

  return (
    <div className="te-page-wrapper">
      {/* Header */}
      <div className="te-header-bar">
        <h2>📝 Vertragsvorlage bearbeiten</h2>
        <div className="te-header-actions">
          <button
            className="btn btn-secondary"
            onClick={onClose}
          >
            Abbrechen
          </button>
          <button
            className="btn btn-info"
            onClick={handlePreview}
            disabled={!editor}
          >
            👁️ Vorschau
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Speichert...' : '💾 Speichern'}
          </button>
        </div>
      </div>

      {/* Template Info */}
      <div className="te-info-grid">
        <div>
          <label className="te-form-label">
            Vorlagen-Name:
          </label>
          <input
            type="text"
            className="form-control"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="z.B. Standard Mitgliedsvertrag"
            className="te-dark-input"
          />
        </div>
        <div>
          <label className="te-form-label">
            Typ:
          </label>
          <select
            className="form-control te-dark-input"
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
          >
            <option value="vertrag">Vertrag (Neumitglied)</option>
            <option value="sepa">SEPA-Mandat</option>
            <option value="agb">AGB (Bestand)</option>
            <option value="datenschutz">Datenschutz (Bestand)</option>
            <option value="kuendigung">Kündigung</option>
            <option value="custom">Benutzerdefiniert</option>
          </select>
        </div>
      </div>

      {/* Platzhalter-Hilfe */}
      <div className="te-placeholder-box">
        <h4
          onClick={() => setShowPlaceholders(!showPlaceholders)}
          className={`te-placeholder-h4${showPlaceholders ? ' te-placeholder-h4--open' : ''}`}
        >
          <span>💡 Verfügbare Platzhalter</span>
          <span className="te-placeholder-toggle-icon">{showPlaceholders ? '▼' : '▶'}</span>
        </h4>
        {showPlaceholders && (
          <>
            <div className="te-placeholder-grid">
              {Object.entries(placeholders).map(([category, items]) => (
                <div key={category}>
                  <strong className="te-placeholder-category-label">{category.charAt(0).toUpperCase() + category.slice(1)}:</strong>
                  <div className="te-placeholder-items">
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="te-placeholder-item"
                        onClick={() => insertPlaceholder(item.value)}
                        title={`Klicken um ${item.value} einzufügen`}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="te-placeholder-tip">
              <strong>Tipps:</strong><br/>
              • Ziehen Sie die vorgefertigten Blöcke aus der rechten Sidebar<br/>
              • Klicken Sie auf einen Platzhalter, um ihn einzufügen<br/>
              • Verwenden Sie den "📝 Freier Text" Block, um beliebigen Text einzugeben<br/>
              • Für Logos: Fügen Sie den "🖼️ Logo/Bild" Block ein, klicken Sie darauf, und ändern Sie dann die Bild-URL in den Einstellungen (rechts)
            </p>
          </>
        )}
      </div>

      {/* GrapesJS Editor */}
      <div ref={editorRef} className="te-editor-container" />

      {/* Vorschau Modal */}
      {previewUrl && (
        <div
          className="te-preview-overlay"
          onClick={() => {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }}
        >
          <div
            className="te-preview-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="te-preview-header">
              <h3>👁️ Vorschau</h3>
              <button
                className="btn btn-danger"
                onClick={() => {
                  URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="te-preview-close-btn"
              >
                ✕ Schließen
              </button>
            </div>
            <iframe
              src={previewUrl}
              title="Vorschau"
              className="te-preview-iframe"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateEditor;
