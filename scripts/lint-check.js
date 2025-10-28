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
  execSync(`npx eslint --max-warnings=0 ${filesToLint.join(' ')}`, {
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  process.exit(0);
} catch (error) {
  console.error('\n❌ Commit blocked: Linting errors found\n');
  console.error('Please fix the following issues:\n');

  // Parse and display only the essential error info
  const output = error.stdout || error.stderr || '';
  const lines = output.split('\n');

  let currentFile = '';
  lines.forEach((line) => {
    // Extract file path
    if (
      line.includes('.tsx') ||
      line.includes('.ts') ||
      line.includes('.jsx') ||
      line.includes('.js')
    ) {
      const match = line.match(/([^\s]+\.(tsx?|jsx?))$/);
      if (match && !line.includes('warning') && !line.includes('error')) {
        currentFile = match[1].split('/').slice(-1)[0];
        console.error(`\n📄 ${currentFile}`);
      }
    }

    // Extract error/warning lines
    if (line.match(/^\s+\d+:\d+/)) {
      const cleaned = line.trim();
      console.error(`   ${cleaned}`);
    }
  });

  console.error('\n💡 Fix these issues and try committing again.');
  console.error('   Run: npm run lint:fix\n');

  process.exit(1);
}
