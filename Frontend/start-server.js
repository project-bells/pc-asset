const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const standaloneServer = path.join(__dirname, '.next', 'standalone', 'server.js');

if (!fs.existsSync(standaloneServer)) {
  console.log('⚡ .next/standalone/server.js not found. Running production build first...');
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
}

console.log('🚀 Starting Enterprise IT Asset Guard Web Portal (Port 3000)...');
require(standaloneServer);
