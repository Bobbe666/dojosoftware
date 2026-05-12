// ISO 3166-1 IBAN lengths for SEPA and common countries
export const IBAN_LENGTHS = {
  AD:24,AE:23,AL:28,AT:20,AZ:28,BA:20,BE:16,BG:22,BH:22,BR:29,BY:28,
  CH:21,CR:22,CY:28,CZ:24,DE:22,DJ:27,DK:18,DO:28,DZ:26,EE:20,EG:29,
  ES:24,FI:18,FK:18,FO:18,FR:27,GB:22,GE:22,GI:23,GL:18,GR:27,GT:28,
  HR:21,HU:28,IE:22,IL:23,IQ:23,IS:26,IT:27,JO:30,KW:30,KZ:20,LB:28,
  LC:32,LI:21,LT:20,LU:20,LV:21,LY:25,MA:28,MC:27,MD:24,ME:22,MK:19,
  MN:20,MR:27,MT:31,MU:30,MZ:25,NI:28,NL:18,NO:15,OM:23,PK:24,PL:28,
  PS:29,PT:25,QA:29,RO:24,RS:22,RU:33,SA:24,SC:31,SD:18,SE:24,SI:19,
  SK:24,SM:27,SO:23,ST:25,SV:28,TL:23,TN:24,TR:26,UA:29,VA:22,VG:24,XK:20,
};

/**
 * Analyses an IBAN and returns {iban, countryCode, checkDigits, bban, expectedLength, errors[], ok}
 * Returns null if input is empty.
 */
export function diagnoseIban(raw) {
  const iban = (raw || '').replace(/\s/g, '').toUpperCase();
  if (!iban) return null;

  const countryCode = iban.slice(0, 2);
  const checkDigits = iban.slice(2, 4);
  const bban = iban.slice(4);
  const errors = [];
  let expectedLength = null;

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    errors.push(`Ländercode „${countryCode}" ungültig (muss 2 Großbuchstaben sein)`);
  } else if (!IBAN_LENGTHS[countryCode]) {
    errors.push(`Ländercode „${countryCode}" nicht im SEPA-Raum bekannt`);
  } else {
    expectedLength = IBAN_LENGTHS[countryCode];
    if (iban.length !== expectedLength) {
      const diff = iban.length - expectedLength;
      errors.push(
        `Länge: ${iban.length} Zeichen, erwartet ${expectedLength} für ${countryCode} ` +
        `(${diff > 0 ? `${diff} zu viel` : `${Math.abs(diff)} fehlen`})`
      );
    }
  }

  if (!/^\d{2}$/.test(checkDigits)) {
    errors.push(`Prüfziffern „${checkDigits}" ungültig (müssen 2 Ziffern sein)`);
  }

  if (!/^[A-Z0-9]*$/.test(bban) && bban.length > 0) {
    errors.push('BBAN enthält ungültige Zeichen');
  }

  // MOD-97 only when format is otherwise clean
  if (errors.length === 0) {
    const digits = (iban.slice(4) + iban.slice(0, 4)).split('').map(c => {
      const code = c.charCodeAt(0);
      return code >= 65 ? (code - 55).toString() : c;
    }).join('');
    let rem = 0;
    for (const ch of digits) rem = (rem * 10 + parseInt(ch, 10)) % 97;
    if (rem !== 1) errors.push('Prüfsumme (MOD-97) falsch — wahrscheinlich ein Tippfehler');
  }

  return { iban, countryCode, checkDigits, bban, expectedLength, errors, ok: errors.length === 0 };
}
