#!/usr/bin/env node

const { execSync } = require('child_process');
const process = require('process');

const files = process.argv.slice(2);

// Filter out files that should be ignored (scripts directory, config files, etc.)
const filesToLint = files.filter((file) => {
  return (
    !file.includes('scripts/') &&
    !file.includes('eslint.config.js') &&
    !file.includes('eslint.config.mjs')
  );
});

if (filesToLint.length === 0) {
  process.exit(0);
}

try {
  // Run eslint check with max warnings
  // Properly quote each file path to handle special characters like parentheses
  const quotedFiles = filesToLint.map((file) => `"${file}"`).join(' ');
  execSync(`npx eslint --max-warnings=0 ${quotedFiles}`, {
    stdio: 'inherit',
    encoding: 'utf-8',
  });
  process.exit(0);
} catch (error) {
  console.error('\n❌ Commit blocked: Linting errors found\n');
  console.error('💡 Fix these issues and try committing again.');
  console.error('   Run: npm run format\n');
  process.exit(1);
}
