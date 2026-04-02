import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML to prevent XSS attacks
 * @param {string} dirty - Unsanitized HTML string
 * @param {object} config - DOMPurify configuration options
 * @returns {string} Sanitized HTML safe for rendering
 */
export const sanitizeHtml = (dirty, config = {}) => {
  if (!dirty) return '';
  
  const defaultConfig = {
    ALLOWED_TAGS: [
      'b', 'i', 'u', 'strong', 'em', 'br', 'p', 'a', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'blockquote',
      'code', 'pre', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'id', 'style'],
    ALLOW_DATA_ATTR: false,
    // Prevent target="_blank" without noopener noreferrer
    SAFE_FOR_TEMPLATES: true,
    ...config
  };

  return DOMPurify.sanitize(dirty, defaultConfig);
};

/**
 * Creates a sanitized HTML object for use with dangerouslySetInnerHTML
 * @param {string} html - HTML to sanitize
 * @returns {object} Object with __html property
 */
export const createSafeHtml = (html) => {
  return { __html: sanitizeHtml(html) };
};
