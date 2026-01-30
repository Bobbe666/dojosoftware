#!/usr/bin/env node
/**
 * Post-build script: Creates placeholder CSS files for Vite lazy-loading bug.
 * Vite generates CSS preload references for lazy-loaded components,
 * but doesn't always emit the actual CSS files.
 */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '../dist/assets');
if (!fs.existsSync(distDir)) process.exit(0);

const jsFiles = fs.readdirSync(distDir).filter(f => f.endsWith('.js'));
const cssRegex = /[A-Za-z]+-[A-Za-z0-9_-]+\.css/g;
let count = 0;

jsFiles.forEach(jsFile => {
  const content = fs.readFileSync(path.join(distDir, jsFile), 'utf-8');
  (content.match(cssRegex) || []).forEach(cssFile => {
    const cssPath = path.join(distDir, cssFile);
    if (!fs.existsSync(cssPath)) {
      fs.writeFileSync(cssPath, '/* CSS in main bundle */\n');
      count++;
    }
  });
});

console.log(count > 0 ? `Created ${count} CSS placeholders` : 'No placeholders needed');
