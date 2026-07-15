// Subdomain-abhängiges Co-Branding für den Login.
// Zeigt pro Schule ihr eigenes Logo + den Hinweis, dass sie DojoSoftware (by TDA) nutzt.
// Neue Schule ergänzen: Logo nach src/assets/tenants/ legen, hier importieren und Eintrag hinzufügen.

import nenadsKarateschule from '../assets/tenants/nenads-karateschule.jpg';

// Key = erste Subdomain-Ebene (z. B. "nenads-karateschule" aus nenads-karateschule.dojo.tda-intl.org)
const TENANT_BRANDING = {
  'nenads-karateschule': {
    name: "Nenad's Karateschule",
    logo: nenadsKarateschule,
  },
};

/**
 * Liefert das Branding zur aktuellen Subdomain – oder null (dann Standard-DojoSoftware-Login).
 */
export function getTenantBranding(hostname = window.location.hostname) {
  const sub = (hostname || '').split('.')[0];
  return TENANT_BRANDING[sub] || null;
}

export default TENANT_BRANDING;
