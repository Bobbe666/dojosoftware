import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const BASE_URL = 'https://dojo.tda-intl.org';
const SITE_NAME = 'DojoSoftware – TDA Systems';
const DEFAULT_IMAGE = `${BASE_URL}/tda-systems-logo.png`;

export default function SEO({ title, description, keywords, image, noindex = false, structuredData }) {
  const { pathname } = useLocation();
  const canonical = `${BASE_URL}${pathname}`;
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const ogImage = image || DEFAULT_IMAGE;

  useEffect(() => {
    const set = (sel, attr, val) => {
      let el = document.querySelector(sel);
      if (!el) {
        el = document.createElement('meta');
        const parts = sel.replace('meta[', '').replace(']', '').replace(/"/g, '').split('=');
        el.setAttribute(parts[0], parts[1]);
        document.head.appendChild(el);
      }
      el.setAttribute(attr, val);
    };
    const setLink = (rel, href) => {
      let el = document.querySelector(`link[rel="${rel}"]`);
      if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el); }
      el.setAttribute('href', href);
    };

    document.title = fullTitle;
    if (description) set('meta[name="description"]', 'content', description);
    if (keywords) set('meta[name="keywords"]', 'content', keywords);
    set('meta[name="robots"]', 'content', noindex ? 'noindex,nofollow' : 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1');
    setLink('canonical', canonical);
    set('meta[property="og:title"]', 'content', fullTitle);
    if (description) set('meta[property="og:description"]', 'content', description);
    set('meta[property="og:url"]', 'content', canonical);
    set('meta[property="og:image"]', 'content', ogImage);
    set('meta[name="twitter:title"]', 'content', fullTitle);
    if (description) set('meta[name="twitter:description"]', 'content', description);
    set('meta[name="twitter:image"]', 'content', ogImage);

    const id = 'seo-page-ld';
    let sdEl = document.getElementById(id);
    if (structuredData) {
      if (!sdEl) { sdEl = document.createElement('script'); sdEl.id = id; sdEl.type = 'application/ld+json'; document.head.appendChild(sdEl); }
      sdEl.textContent = JSON.stringify(structuredData);
    } else if (sdEl) sdEl.remove();

    return () => { const s = document.getElementById(id); if (s) s.remove(); };
  }, [fullTitle, description, keywords, canonical, ogImage, noindex, structuredData]);

  return null;
}
