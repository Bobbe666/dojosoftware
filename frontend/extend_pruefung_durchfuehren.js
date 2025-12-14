// Script zum Erweitern von PruefungDurchfuehren.jsx mit Bewertungsfunktionalität
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'PruefungDurchfuehren.jsx');

console.log('📖 Lese Datei:', filePath);

fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('❌ Fehler beim Lesen:', err);
    process.exit(1);
  }

  let content = data;

  // 1. Erweitere State-Deklarationen
  console.log('1️⃣ Erweitere State...');
  const stateAddition = `
  // Bewertungs-States
  const [pruefungsinhalte, setPruefungsinhalte] = useState({}); // Key: pruefung_id, Value: Inhalte
  const [bewertungen, setBewertungen] = useState({}); // Key: pruefung_id, Value: Bewertungen-Objekt
`;

  content = content.replace(
    /const \[ergebnisse, setErgebnisse\] = useState\({}\);.*\n/,
    `const [ergebnisse, setErgebnisse] = useState({}); // Key: pruefung_id, Value: ergebnis-Objekt\n${stateAddition}`
  );

  // 2. Füge Funktion zum Laden der Prüfungsinhalte hinzu (nach fetchPruefungen)
  console.log('2️⃣ Füge Lade-Funktion hinzu...');
  const loadInhalteFunktion = `
  // Lädt Prüfungsinhalte für eine Graduierung
  const loadPruefungsinhalte = async (pruefungId, graduierungId) => {
    try {
      const response = await fetch(
        \`\${API_BASE_URL}/stile/graduierungen/\${graduierungId}/pruefungsinhalte\`,
        { headers: { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` } }
      );

      if (!response.ok) {
        console.error('Fehler beim Laden der Prüfungsinhalte');
        return;
      }

      const data = await response.json();
      console.log('📚 Prüfungsinhalte geladen:', data);

      setPruefungsinhalte(prev => ({
        ...prev,
        [pruefungId]: data.pruefungsinhalte || {}
      }));

      // Lade bestehende Bewertungen
      await loadBewertungen(pruefungId);
    } catch (error) {
      console.error('Fehler beim Laden der Prüfungsinhalte:', error);
    }
  };

  // Lädt bestehende Bewertungen für eine Prüfung
  const loadBewertungen = async (pruefungId) => {
    try {
      const response = await fetch(
        \`\${API_BASE_URL}/pruefungen/\${pruefungId}/bewertungen\`,
        { headers: { 'Authorization': \`Bearer \${localStorage.getItem('token')}\` } }
      );

      if (!response.ok) return;

      const data = await response.json();
      if (data.success && data.bewertungen) {
        setBewertungen(prev => ({
          ...prev,
          [pruefungId]: data.bewertungen
        }));
      }
    } catch (error) {
      console.error('Fehler beim Laden der Bewertungen:', error);
    }
  };

  // Aktualisiert eine einzelne Bewertung
  const updateBewertung = (pruefungId, inhaltId, field, value) => {
    setBewertungen(prev => {
      const pruefungBewertungen = prev[pruefungId] || {};
      const kategorieBewertungen = Object.keys(pruefungBewertungen).reduce((acc, kat) => {
        acc[kat] = pruefungBewertungen[kat].map(bew => {
          if (bew.inhalt_id === inhaltId) {
            return { ...bew, [field]: value };
          }
          return bew;
        });
        return acc;
      }, {});

      return {
        ...prev,
        [pruefungId]: kategorieBewertungen
      };
    });
  };
`;

  // Füge nach der updateMemberGraduierung Funktion ein
  content = content.replace(
    /(const updateMemberGraduierung = async[\s\S]*?\n  };)/,
    `$1\n${loadInhalteFunktion}`
  );

  // 3. Erweitere handleToggleEdit um Prüfungsinhalte zu laden
  console.log('3️⃣ Erweitere handleToggleEdit...');
  content = content.replace(
    /(setEditingPruefling\(pruefling\);)/,
    `$1\n      // Lade Prüfungsinhalte\n      loadPruefungsinhalte(pruefling.pruefung_id, targetGurt?.id || pruefling.graduierung_nachher_id);`
  );

  // 4. Erweitere handleSpeichern um Bewertungen zu speichern
  console.log('4️⃣ Erweitere handleSpeichern...');
  const saveBewertungenCode = `
      // Bewertungen speichern
      const pruefungBewertungen = bewertungen[pruefling.pruefung_id];
      if (pruefungBewertungen) {
        const bewertungenArray = [];
        Object.values(pruefungBewertungen).forEach(kategorieBewertungen => {
          if (Array.isArray(kategorieBewertungen)) {
            kategorieBewertungen.forEach(bew => {
              bewertungenArray.push({
                inhalt_id: bew.inhalt_id,
                bestanden: bew.bestanden,
                punktzahl: bew.punktzahl,
                max_punktzahl: bew.max_punktzahl || 10,
                kommentar: bew.kommentar
              });
            });
          }
        });

        if (bewertungenArray.length > 0) {
          await fetch(\`\${API_BASE_URL}/pruefungen/\${pruefling.pruefung_id}/bewertungen\`, {
            method: 'POST',
            headers: {
              'Authorization': \`Bearer \${localStorage.getItem('token')}\`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ bewertungen: bewertungenArray })
          });
        }
      }
`;

  content = content.replace(
    /(setSuccess\('Prüfungsergebnis erfolgreich gespeichert!'\);)/,
    `${saveBewertungenCode}\n      $1`
  );

  // 5. Füge Bewertungs-UI Komponente hinzu (vor dem return im Render)
  console.log('5️⃣ Füge Bewertungs-UI hinzu...');
  const bewertungsUI = `
                      {/* Prüfungsinhalte & Bewertungen */}
                      {pruefungsinhalte[pruefling.pruefung_id] && (
                        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                          <h4 style={{ color: '#ffd700', marginBottom: '1rem', fontSize: '1.1rem' }}>
                            📋 Prüfungsinhalte bewerten
                          </h4>
                          {Object.entries(pruefungsinhalte[pruefling.pruefung_id]).map(([kategorie, inhalte]) => (
                            <div key={kategorie} style={{ marginBottom: '1.5rem' }}>
                              <h5 style={{
                                color: '#ffd700',
                                fontSize: '0.95rem',
                                marginBottom: '0.75rem',
                                borderBottom: '1px solid rgba(255,215,0,0.2)',
                                paddingBottom: '0.5rem'
                              }}>
                                {kategorie === 'grundtechniken' && '🥋 Grundtechniken'}
                                {kategorie === 'kata' && '🎭 Kata / Formen'}
                                {kategorie === 'kumite' && '⚔️ Kumite / Sparring'}
                                {kategorie === 'theorie' && '📚 Theorie'}
                              </h5>
                              <div style={{ display: 'grid', gap: '0.75rem' }}>
                                {inhalte.map(inhalt => {
                                  const bewertung = bewertungen[pruefling.pruefung_id]?.[kategorie]?.find(b => b.inhalt_id === inhalt.id) || {};
                                  return (
                                    <div key={inhalt.id} style={{
                                      display: 'grid',
                                      gridTemplateColumns: '1fr auto auto auto',
                                      gap: '0.75rem',
                                      alignItems: 'center',
                                      padding: '0.5rem',
                                      background: 'rgba(0,0,0,0.2)',
                                      borderRadius: '6px',
                                      fontSize: '0.9rem'
                                    }}>
                                      <span style={{ color: 'rgba(255,255,255,0.9)' }}>{inhalt.inhalt || inhalt.titel}</span>

                                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.7)' }}>
                                        <input
                                          type="checkbox"
                                          checked={bewertung.bestanden || false}
                                          onChange={(e) => updateBewertung(pruefling.pruefung_id, inhalt.id, 'bestanden', e.target.checked)}
                                          style={{ width: '16px', height: '16px' }}
                                        />
                                        Bestanden
                                      </label>

                                      <input
                                        type="number"
                                        placeholder="Punkte"
                                        value={bewertung.punktzahl || ''}
                                        onChange={(e) => updateBewertung(pruefling.pruefung_id, inhalt.id, 'punktzahl', e.target.value)}
                                        style={{
                                          width: '80px',
                                          padding: '0.4rem',
                                          background: 'rgba(255,255,255,0.1)',
                                          border: '1px solid rgba(255,215,0,0.3)',
                                          borderRadius: '4px',
                                          color: '#fff',
                                          fontSize: '0.85rem'
                                        }}
                                      />

                                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem' }}>
                                        / {inhalt.max_punktzahl || bewertung.max_punktzahl || 10}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
`;

  // Füge vor dem Speichern-Button ein (suche nach dem Kommentar-Feld)
  content = content.replace(
    /(textarea[^>]*value=\{.*?prueferkommentar.*?\}[^>]*>.*?<\/textarea>\s*<\/div>)/s,
    `$1\n${bewertungsUI}`
  );

  // Schreibe erweiterte Datei
  console.log('💾 Schreibe erweiterte Datei...');
  fs.writeFile(filePath, content, 'utf8', (writeErr) => {
    if (writeErr) {
      console.error('❌ Fehler beim Schreiben:', writeErr);
      process.exit(1);
    }

    console.log('✅ Datei erfolgreich erweitert!');
    console.log('📝 Datei:', filePath);
    console.log('\n🎯 Hinzugefügte Features:');
    console.log('  - State für Prüfungsinhalte und Bewertungen');
    console.log('  - Funktion zum Laden der Prüfungsinhalte');
    console.log('  - Funktion zum Laden bestehender Bewertungen');
    console.log('  - Bewertungs-UI für jede Technik');
    console.log('  - Speicherfunktion für Bewertungen');
    console.log('\n✨ Bereit zum Testen!');
    process.exit(0);
  });
});
