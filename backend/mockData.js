// ============================================
// ZENTRALE MOCK-DATEN FÜR ENTWICKLUNGSMODUS
// ============================================

const MOCK_STILE = [
  { stil_id: 1, name: 'Karate', beschreibung: 'Traditionelles Karate', aktiv: 1 },
  { stil_id: 2, name: 'Kickboxen', beschreibung: 'Modernes Kickboxen', aktiv: 1 },
  { stil_id: 3, name: 'Judo', beschreibung: 'Traditionelles Judo', aktiv: 1 },
  { stil_id: 4, name: 'Taekwondo', beschreibung: 'Koreanisches Taekwondo', aktiv: 1 }
];

const MOCK_TARIFE = [
  { tarif_id: 1, name: 'Standard', betrag_cent: 4900, betrag_euro: 49.00, beschreibung: 'Standard-Mitgliedschaft', aktiv: 1 },
  { tarif_id: 2, name: 'Familie', betrag_cent: 7900, betrag_euro: 79.00, beschreibung: 'Familien-Mitgliedschaft', aktiv: 1 },
  { tarif_id: 3, name: 'Student', betrag_cent: 3900, betrag_euro: 39.00, beschreibung: 'Studenten-Rabatt', aktiv: 1 }
];

const MOCK_ZAHLUNGSZYKLEN = [
  { zyklus_id: 1, name: 'Monatlich', beschreibung: 'Monatliche Zahlung', aktiv: 1 },
  { zyklus_id: 2, name: 'Vierteljährlich', beschreibung: 'Alle 3 Monate', aktiv: 1 },
  { zyklus_id: 3, name: 'Halbjährlich', beschreibung: 'Alle 6 Monate', aktiv: 1 },
  { zyklus_id: 4, name: 'Jährlich', beschreibung: 'Jährliche Zahlung', aktiv: 1 }
];

const MOCK_MITGLIED_STILE = {
  1: [
    { mitglied_id: 1, stil: 'Karate', stil_id: 1 },
    { mitglied_id: 1, stil: 'Kickboxen', stil_id: 2 }
  ],
  2: [
    { mitglied_id: 2, stil: 'Karate', stil_id: 1 }
  ],
  3: [
    { mitglied_id: 3, stil: 'Kickboxen', stil_id: 2 }
  ],
  4: [
    { mitglied_id: 4, stil: 'Karate', stil_id: 1 }
  ]
};

const MOCK_BEITRAEGE = {
  1: [
    { beitrag_id: 1, mitglied_id: 1, tarif_id: 1, betrag_cent: 4900, status: 'bezahlt', faellig_am: '2025-01-01' }
  ],
  2: [
    { beitrag_id: 2, mitglied_id: 2, tarif_id: 1, betrag_cent: 4900, status: 'bezahlt', faellig_am: '2025-01-01' }
  ],
  3: [
    { beitrag_id: 3, mitglied_id: 3, tarif_id: 3, betrag_cent: 3900, status: 'offen', faellig_am: '2025-12-01' }
  ],
  4: [
    { beitrag_id: 4, mitglied_id: 4, tarif_id: 1, betrag_cent: 4900, status: 'bezahlt', faellig_am: '2025-01-01' }
  ]
};

const MOCK_ANWESENHEIT = {
  1: [],
  2: [],
  3: [],
  4: []
};

const MOCK_SEPA_MANDATE = {
  1: null,
  2: null,
  3: null,
  4: null
};

module.exports = {
  MOCK_STILE,
  MOCK_TARIFE,
  MOCK_ZAHLUNGSZYKLEN,
  MOCK_MITGLIED_STILE,
  MOCK_BEITRAEGE,
  MOCK_ANWESENHEIT,
  MOCK_SEPA_MANDATE
};
