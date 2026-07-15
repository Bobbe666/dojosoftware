import axios from 'axios';
import { detectSubdomain } from './dsTheme';
import { getTenantBranding } from '../config/tenantBranding';

/**
 * PWA-Branding pro Dojo-Subdomain (Client-seitig).
 *
 * Setzt Name + Icon der installierten App, damit auf dem Homescreen die
 * Schule erscheint (statt „DojoSoftware"):
 *  - document.title + apple-mobile-web-app-title = Schulname  (alle Dojos)
 *  - apple-touch-icon = Schul-Logo, sofern hinterlegt (tenantBranding)
 *
 * iOS „Zum Home-Bildschirm" nutzt genau diese Apple-Tags – kein Web-Manifest
 * nötig. Das Android-Manifest (installierbare PWA) kommt separat als
 * same-origin Backend-Endpoint (`/manifest.webmanifest`), weil die CSP
 * (default-src 'self') blob:/data:-Manifeste blockiert.
 */

function upsertMeta(name, content) {
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export async function initDojoPwaBranding() {
  const sub = detectSubdomain();
  if (!sub) return;

  // Schulname öffentlich holen (ohne Login)
  let dojoName = null;
  try {
    const { data } = await axios.get(`/public/dojo/${sub}`);
    dojoName = data?.data?.dojoname || null;
  } catch {
    /* Endpoint nicht erreichbar → Standard-Branding behalten */
  }

  const tenant = getTenantBranding();
  const appName = dojoName || tenant?.name || null;

  if (appName) {
    document.title = appName;
    upsertMeta('apple-mobile-web-app-title', appName);
    upsertMeta('application-name', appName);
  }

  // Icon nur überschreiben, wenn wir ein Schul-Logo haben (sonst Default behalten)
  if (tenant?.logo) {
    upsertLink('apple-touch-icon', tenant.logo);
  }
}

export default initDojoPwaBranding;
