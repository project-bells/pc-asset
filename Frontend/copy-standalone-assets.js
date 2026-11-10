const fs = require('fs');
const path = require('path');

const srcStatic = path.join(__dirname, '.next', 'static');
const destStatic = path.join(__dirname, '.next', 'standalone', '.next', 'static');

const srcPublic = path.join(__dirname, 'public');
const destPublic = path.join(__dirname, '.next', 'standalone', 'public');

if (fs.existsSync(srcStatic)) {
  fs.mkdirSync(path.dirname(destStatic), { recursive: true });
  fs.cpSync(srcStatic, destStatic, { recursive: true, force: true });
  console.log('✓ Copied .next/static to .next/standalone/.next/static');
}

if (fs.existsSync(srcPublic)) {
  fs.mkdirSync(destPublic, { recursive: true });
  fs.cpSync(srcPublic, destPublic, { recursive: true, force: true });
  console.log('✓ Copied public to .next/standalone/public');
}

