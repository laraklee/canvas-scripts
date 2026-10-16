// ESLint settings for Google Apps Script code (V8 runtime).
const security = require('eslint-plugin-security');

const appsScriptGlobals = Object.fromEntries(
  [
    'SpreadsheetApp', 'DocumentApp', 'SlidesApp', 'FormApp', 'DriveApp', 'Drive',
    'UrlFetchApp', 'PropertiesService', 'CacheService', 'LockService', 'ScriptApp',
    'Session', 'Utilities', 'Logger', 'HtmlService', 'ContentService', 'MailApp',
    'GmailApp', 'CalendarApp', 'Browser', 'console',
  ].map((g) => [g, 'readonly'])
);

module.exports = [
  { ignores: ['node_modules/**', 'scripts/**', '.claude/**', 'eslint.config.cjs'] },
  security.configs.recommended,
  {
    files: ['**/*.js', '**/*.gs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: appsScriptGlobals },
    rules: {
      // Apps Script shares one global scope across files, so these would be noisy.
      'no-undef': 'off',
      'no-unused-vars': ['warn', { vars: 'local', args: 'none' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-var': 'warn',
      'prefer-const': 'warn',
      eqeqeq: ['warn', 'smart'],
    },
  },
];
