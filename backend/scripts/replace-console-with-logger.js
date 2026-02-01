#!/usr/bin/env node
/**
 * Script to replace console.log/error/warn with structured logger
 * Usage: node scripts/replace-console-with-logger.js [file-or-directory]
 */

const fs = require('fs');
const path = require('path');

// Files to process
const targetDir = process.argv[2] || './routes';

// Track statistics
let totalFiles = 0;
let totalReplacements = 0;

function processFile(filePath) {
    if (!filePath.endsWith('.js')) return;

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let replacements = 0;

    // Check if logger is already imported
    const hasLoggerImport = content.includes("require('./utils/logger')") ||
                           content.includes("require('../utils/logger')") ||
                           content.includes('require("./utils/logger")') ||
                           content.includes('require("../utils/logger")');

    // Determine relative path for logger import
    const relativePath = filePath.includes('/routes/') || filePath.includes('/middleware/')
        ? '../utils/logger'
        : './utils/logger';

    // Add logger import if not present and we have console statements
    if (!hasLoggerImport && (content.includes('console.log') || content.includes('console.error') || content.includes('console.warn'))) {
        const requireMatch = content.match(/const \w+ = require\([^)]+\);?\n/);
        if (requireMatch) {
            const insertPos = requireMatch.index + requireMatch[0].length;
            content = content.slice(0, insertPos) +
                     `const logger = require('${relativePath}');\n` +
                     content.slice(insertPos);
            replacements++;
        }
    }

    // Simple patterns - single line with emoji prefixes
    const simpleReplacements = [
        // Error with emoji
        [/console\.error\s*\(\s*['"`]❌\s*([^'"`]+)['"`]\s*\)/g, "logger.error('$1')"],
        [/console\.log\s*\(\s*['"`]❌\s*([^'"`]+)['"`]\s*\)/g, "logger.error('$1')"],

        // Success with emoji
        [/console\.log\s*\(\s*['"`]✅\s*([^'"`]+)['"`]\s*\)/g, "logger.info('$1')"],

        // Warning with emoji
        [/console\.warn\s*\(\s*['"`]⚠️\s*([^'"`]+)['"`]\s*\)/g, "logger.warn('$1')"],
        [/console\.log\s*\(\s*['"`]⚠️\s*([^'"`]+)['"`]\s*\)/g, "logger.warn('$1')"],

        // Debug with emoji
        [/console\.log\s*\(\s*['"`]🔍\s*([^'"`]+)['"`]\s*\)/g, "logger.debug('$1')"],
        [/console\.log\s*\(\s*['"`]📥\s*([^'"`]+)['"`]\s*\)/g, "logger.debug('$1')"],
        [/console\.log\s*\(\s*['"`]📖\s*([^'"`]+)['"`]\s*\)/g, "logger.debug('$1')"],
        [/console\.log\s*\(\s*['"`]📝\s*([^'"`]+)['"`]\s*\)/g, "logger.debug('$1')"],
        [/console\.log\s*\(\s*['"`]📨\s*([^'"`]+)['"`]\s*\)/g, "logger.debug('$1')"],
        [/console\.log\s*\(\s*['"`]📋\s*([^'"`]+)['"`]\s*\)/g, "logger.debug('$1')"],
        [/console\.log\s*\(\s*['"`]👥\s*([^'"`]+)['"`]\s*\)/g, "logger.debug('$1')"],
        [/console\.log\s*\(\s*['"`]📸\s*([^'"`]+)['"`]\s*\)/g, "logger.debug('$1')"],
        [/console\.log\s*\(\s*['"`]🔐\s*([^'"`]+)['"`]\s*\)/g, "logger.debug('$1')"],

        // Generic simple patterns
        [/console\.error\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, "logger.error('$1')"],
        [/console\.warn\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g, "logger.warn('$1')"],
    ];

    for (const [pattern, replacement] of simpleReplacements) {
        const before = content;
        content = content.replace(pattern, replacement);
        if (content !== before) {
            const matches = before.match(pattern);
            replacements += matches ? matches.length : 0;
        }
    }

    // Complex patterns with second argument
    content = content.replace(
        /console\.error\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\w+)\s*\)/g,
        (match, msg, errVar) => {
            replacements++;
            return `logger.error('${msg}', { error: ${errVar} })`;
        }
    );

    content = content.replace(
        /console\.log\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(\{[^}]+\})\s*\)/g,
        (match, msg, obj) => {
            replacements++;
            return `logger.debug('${msg}', ${obj})`;
        }
    );

    // Only write if changes were made
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        totalFiles++;
        totalReplacements += replacements;
        console.log(`✅ ${filePath}: ${replacements} replacements`);
    }
}

function processDirectory(dirPath) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory() && !entry.name.includes('node_modules')) {
            processDirectory(fullPath);
        } else if (entry.isFile()) {
            processFile(fullPath);
        }
    }
}

// Run
console.log(`Processing: ${targetDir}\n`);

if (fs.statSync(targetDir).isDirectory()) {
    processDirectory(targetDir);
} else {
    processFile(targetDir);
}

console.log(`\n📊 Summary: ${totalReplacements} replacements in ${totalFiles} files`);
