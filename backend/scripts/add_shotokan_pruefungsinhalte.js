// Script zum Eintragen der Standard Shotokan-Prüfungsinhalte
// Basierend auf typischer Shotokan-Prüfungsordnung

const db = require('../db');

const pruefungsinhalte = {
  // 47 - Weißgurt (9. Kyu)
  47: {
    grundtechniken: [
      { titel: 'Zenkutsu Dachi (Vorwärtsstellung)', reihenfolge: 1 },
      { titel: 'Oi Zuki (Fauststoß mit vorderem Arm)', reihenfolge: 2 },
      { titel: 'Age Uke (Abwehr nach oben)', reihenfolge: 3 },
      { titel: 'Gedan Barai (Abwehr nach unten)', reihenfolge: 4 },
      { titel: 'Soto Uke (Abwehr von außen nach innen)', reihenfolge: 5 }
    ],
    kata: [
      { titel: 'Taikyoku Shodan', reihenfolge: 1 }
    ],
    kumite: [
      { titel: 'Gohon Kumite (5-Schritt-Kumite)', reihenfolge: 1 }
    ],
    theorie: [
      { titel: 'Dojo-Kun (Verhaltensregeln)', reihenfolge: 1 },
      { titel: 'Grundbegriffe: Rei, Hajime, Yame', reihenfolge: 2 },
      { titel: 'Bedeutung des weißen Gürtels', reihenfolge: 3 }
    ]
  },

  // 63 - Weiß-Gelbgurt
  63: {
    grundtechniken: [
      { titel: 'Wiederholung Weißgurt-Programm', reihenfolge: 1 },
      { titel: 'Mae Geri (Fußstoß vorwärts)', reihenfolge: 2 },
      { titel: 'Uchi Uke (Abwehr von innen nach außen)', reihenfolge: 3 }
    ],
    kata: [
      { titel: 'Taikyoku Shodan (Wiederholung)', reihenfolge: 1 }
    ],
    kumite: [
      { titel: 'Gohon Kumite Jodan/Chudan', reihenfolge: 1 }
    ],
    theorie: [
      { titel: 'Zählweise 1-10 (japanisch)', reihenfolge: 1 },
      { titel: 'Grundstellungen benennen', reihenfolge: 2 }
    ]
  },

  // 48 - Gelbgurt (8. Kyu)
  48: {
    grundtechniken: [
      { titel: 'Kokutsu Dachi (Rückwärtsstellung)', reihenfolge: 1 },
      { titel: 'Gyaku Zuki (Fauststoß mit hinterem Arm)', reihenfolge: 2 },
      { titel: 'Shuto Uke (Handkantenabwehr)', reihenfolge: 3 },
      { titel: 'Mae Geri Keage/Kekomi', reihenfolge: 4 }
    ],
    kata: [
      { titel: 'Heian Shodan', reihenfolge: 1 }
    ],
    kumite: [
      { titel: 'Gohon Kumite (Jodan & Chudan)', reihenfolge: 1 }
    ],
    theorie: [
      { titel: 'Zählweise 1-20', reihenfolge: 1 },
      { titel: 'Bedeutung von "Karate"', reihenfolge: 2 },
      { titel: 'Name des Dojo-Leiters', reihenfolge: 3 }
    ]
  },

  // 67 - Gelb-Grüngurt
  67: {
    grundtechniken: [
      { titel: 'Yoko Geri Keage (Seitwärtsfußstoß schnappend)', reihenfolge: 1 },
      { titel: 'Yoko Geri Kekomi (Seitwärtsfußstoß stoßend)', reihenfolge: 2 },
      { titel: 'Mawashi Geri (Fußstoß halbrund)', reihenfolge: 3 }
    ],
    kata: [
      { titel: 'Heian Nidan', reihenfolge: 1 }
    ],
    kumite: [
      { titel: 'Sanbon Kumite (3-Schritt-Kumite)', reihenfolge: 1 }
    ],
    theorie: [
      { titel: 'Meister Funakoshi Gichin', reihenfolge: 1 },
      { titel: 'Geschichte des Shotokan', reihenfolge: 2 }
    ]
  },

  // 50 - Grüngurt (6. Kyu)
  50: {
    grundtechniken: [
      { titel: 'Kiba Dachi (Reiterstellung)', reihenfolge: 1 },
      { titel: 'Empi Uchi (Ellbogenstoß)', reihenfolge: 2 },
      { titel: 'Ushiro Geri (Fußstoß rückwärts)', reihenfolge: 3 },
      { titel: 'Uraken Uchi (Schlag mit Handrücken)', reihenfolge: 4 }
    ],
    kata: [
      { titel: 'Heian Sandan', reihenfolge: 1 }
    ],
    kumite: [
      { titel: 'Kihon Ippon Kumite (Jodan, Chudan)', reihenfolge: 1 }
    ],
    theorie: [
      { titel: 'Karate-Do Philosophie', reihenfolge: 1 },
      { titel: 'Alle bisherigen Kata benennen', reihenfolge: 2 }
    ]
  },

  // 68 - Grün-Blaugurt
  68: {
    grundtechniken: [
      { titel: 'Fudo Dachi', reihenfolge: 1 },
      { titel: 'Teisho Uchi (Handballenstoß)', reihenfolge: 2 },
      { titel: 'Kombinationen in verschiedenen Stellungen', reihenfolge: 3 }
    ],
    kata: [
      { titel: 'Heian Yondan', reihenfolge: 1 }
    ],
    kumite: [
      { titel: 'Kihon Ippon Kumite (Jodan, Chudan, Mae Geri)', reihenfolge: 1 }
    ],
    theorie: [
      { titel: 'Dojo-Etikette erklären', reihenfolge: 1 },
      { titel: 'Bedeutung der Heian-Kata', reihenfolge: 2 }
    ]
  },

  // 64 - Blaugurt (5. Kyu)
  64: {
    grundtechniken: [
      { titel: 'Alle Grundstellungen perfektioniert', reihenfolge: 1 },
      { titel: 'Ren-Zuki (Doppelfauststoß)', reihenfolge: 2 },
      { titel: 'Mawashi Geri Jodan', reihenfolge: 3 },
      { titel: 'Kombinationen mit Richtungswechsel', reihenfolge: 4 }
    ],
    kata: [
      { titel: 'Heian Godan', reihenfolge: 1 }
    ],
    kumite: [
      { titel: 'Kihon Ippon Kumite (alle Grundangriffe)', reihenfolge: 1 },
      { titel: 'Einführung Jiyu Ippon Kumite', reihenfolge: 2 }
    ],
    theorie: [
      { titel: 'Alle Heian-Kata demonstrieren können', reihenfolge: 1 },
      { titel: 'Prüfungsprogramm erklären', reihenfolge: 2 }
    ]
  },

  // 62 - Blau-Braungurt
  62: {
    grundtechniken: [
      { titel: 'Komplexe Kombinationen', reihenfolge: 1 },
      { titel: 'Gedan Mawashi Geri', reihenfolge: 2 },
      { titel: 'Mae Geri mit Richtungswechsel', reihenfolge: 3 }
    ],
    kata: [
      { titel: 'Tekki Shodan', reihenfolge: 1 }
    ],
    kumite: [
      { titel: 'Jiyu Ippon Kumite (alle Angriffe)', reihenfolge: 1 }
    ],
    theorie: [
      { titel: 'Kata-Bedeutungen erklären', reihenfolge: 1 },
      { titel: 'Grundlagen Bunkai', reihenfolge: 2 }
    ]
  },

  // 65 - Rot-Schwarzgurt (4. Kyu)
  65: {
    grundtechniken: [
      { titel: 'Alle Techniken in höchster Qualität', reihenfolge: 1 },
      { titel: 'Freie Kombinationen', reihenfolge: 2 }
    ],
    kata: [
      { titel: 'Eine Shitei-Kata nach Wahl', reihenfolge: 1 },
      { titel: 'Bassai Dai oder Kanku Dai (Einführung)', reihenfolge: 2 }
    ],
    kumite: [
      { titel: 'Jiyu Ippon Kumite (fortgeschritten)', reihenfolge: 1 },
      { titel: 'Einführung Jiyu Kumite', reihenfolge: 2 }
    ],
    theorie: [
      { titel: 'Bunkai zu Heian-Kata', reihenfolge: 1 },
      { titel: 'Geschichte des Karate-Do', reihenfolge: 2 }
    ]
  },

  // 69 - Rotgurt (3. Kyu)
  69: {
    grundtechniken: [
      { titel: 'Perfektionierte Grundtechniken', reihenfolge: 1 },
      { titel: 'Alle Fußtechniken in Kombination', reihenfolge: 2 }
    ],
    kata: [
      { titel: 'Alle Heian-Kata', reihenfolge: 1 },
      { titel: 'Tekki Shodan', reihenfolge: 2 },
      { titel: 'Bassai Dai oder Kanku Dai', reihenfolge: 3 }
    ],
    kumite: [
      { titel: 'Jiyu Ippon Kumite gegen mehrere Angreifer', reihenfolge: 1 },
      { titel: 'Jiyu Kumite', reihenfolge: 2 }
    ],
    theorie: [
      { titel: 'Bunkai demonstrieren können', reihenfolge: 1 },
      { titel: 'Philosophie des Karate-Do', reihenfolge: 2 },
      { titel: 'Prüfling kann bei Prüfungen assistieren', reihenfolge: 3 }
    ]
  },

  // 51 - Schwarzgurt (1. Dan)
  51: {
    grundtechniken: [
      { titel: 'Alle Grundtechniken in Meisterqualität', reihenfolge: 1 },
      { titel: 'Freie Kombinationen mit höchster Präzision', reihenfolge: 2 }
    ],
    kata: [
      { titel: 'Alle 5 Heian-Kata', reihenfolge: 1 },
      { titel: 'Tekki Shodan', reihenfolge: 2 },
      { titel: 'Bassai Dai', reihenfolge: 3 },
      { titel: 'Kanku Dai', reihenfolge: 4 },
      { titel: 'Jion', reihenfolge: 5 },
      { titel: 'Enpi', reihenfolge: 6 },
      { titel: 'Hangetsu', reihenfolge: 7 },
      { titel: 'Eine Tokui-Kata (Lieblingskata)', reihenfolge: 8 }
    ],
    kumite: [
      { titel: 'Jiyu Kumite gegen mehrere Gegner', reihenfolge: 1 },
      { titel: 'Kumite mit wechselnden Partnern', reihenfolge: 2 }
    ],
    theorie: [
      { titel: 'Geschichte des Karate und Shotokan', reihenfolge: 1 },
      { titel: 'Philosophie und Dojo-Kun', reihenfolge: 2 },
      { titel: 'Bunkai zu allen geprüften Kata', reihenfolge: 3 },
      { titel: 'Fähigkeit zum Unterrichten', reihenfolge: 4 }
    ]
  },

  // 77 - 2. DAN Schwarzgurt
  77: {
    grundtechniken: [
      { titel: 'Meisterhafte Ausführung aller Techniken', reihenfolge: 1 },
      { titel: 'Unterrichtsfähigkeit demonstrieren', reihenfolge: 2 }
    ],
    kata: [
      { titel: 'Alle 1. Dan Kata', reihenfolge: 1 },
      { titel: 'Jitte', reihenfolge: 2 },
      { titel: 'Gankaku', reihenfolge: 3 },
      { titel: 'Tekki Nidan', reihenfolge: 4 },
      { titel: 'Erweiterte Tokui-Kata', reihenfolge: 5 }
    ],
    kumite: [
      { titel: 'Freikampf auf hohem Niveau', reihenfolge: 1 },
      { titel: 'Demonstration von Kontrolle und Präzision', reihenfolge: 2 }
    ],
    theorie: [
      { titel: 'Vertiefte Kata-Analyse und Bunkai', reihenfolge: 1 },
      { titel: 'Lehrkompetenz nachweisen', reihenfolge: 2 },
      { titel: 'Geschichte der Meister', reihenfolge: 3 }
    ]
  }
};

console.log('🚀 Starte Eintragung der Shotokan-Prüfungsinhalte...\n');

let processedCount = 0;
const totalGraduierungen = Object.keys(pruefungsinhalte).length;

// Funktion zum Eintragen der Inhalte für eine Graduierung
function insertInhalteForGraduierung(graduierungId, inhalte) {
  return new Promise((resolve, reject) => {
    // Erst alle alten Inhalte löschen
    const deleteQuery = 'DELETE FROM pruefungsinhalte WHERE graduierung_id = ?';

    db.query(deleteQuery, [graduierungId], (deleteError) => {
      if (deleteError) {
        return reject(deleteError);
      }

      const insertPromises = [];

      // Für jede Kategorie die Inhalte eintragen
      Object.entries(inhalte).forEach(([kategorie, items]) => {
        items.forEach(item => {
          const insertQuery = `
            INSERT INTO pruefungsinhalte
            (graduierung_id, kategorie, titel, beschreibung, reihenfolge, pflicht, aktiv)
            VALUES (?, ?, ?, '', ?, 1, 1)
          `;

          insertPromises.push(
            new Promise((res, rej) => {
              db.query(insertQuery, [graduierungId, kategorie, item.titel, item.reihenfolge], (err) => {
                if (err) rej(err);
                else res();
              });
            })
          );
        });
      });

      Promise.all(insertPromises)
        .then(() => resolve())
        .catch(reject);
    });
  });
}

// Verarbeite alle Graduierungen sequenziell
async function processAll() {
  for (const [graduierungId, inhalte] of Object.entries(pruefungsinhalte)) {
    try {
      await insertInhalteForGraduierung(graduierungId, inhalte);
      processedCount++;

      // Hole Graduierungsname für Anzeige
      const nameQuery = 'SELECT name FROM graduierungen WHERE graduierung_id = ?';
      db.query(nameQuery, [graduierungId], (err, results) => {
        if (!err && results.length > 0) {
          const totalItems = Object.values(inhalte).reduce((sum, items) => sum + items.length, 0);
          console.log(`✅ ${processedCount}/${totalGraduierungen} - ${results[0].name}: ${totalItems} Inhalte eingetragen`);
        }
      });
    } catch (error) {
      console.error(`❌ Fehler bei Graduierung ${graduierungId}:`, error.message);
    }
  }

  setTimeout(() => {
    console.log(`\n🎉 Fertig! ${processedCount} Graduierungen mit Shotokan-Prüfungsinhalten befüllt.`);
    console.log('\n📝 Sie können die Inhalte nun im Frontend anpassen.');
    process.exit(0);
  }, 1000);
}

processAll();
