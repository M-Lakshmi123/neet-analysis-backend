const { exec } = require('child_process');
const path = require('path');

// Set working directory to client folder
const clientDir = path.join(__dirname, '../client');

console.log('Starting Vite Client in:', clientDir);

// Run 'npm run dev' to start Vite
// --host is important to ensure it binds correctly in background
const child = exec('npm run dev -- --host', {
    cwd: clientDir,
    windowsHide: true // Hide the window
});

child.stdout.on('data', (data) => {
    console.log(`[Client]: ${data}`);
});

child.stderr.on('data', (data) => {
    console.error(`[Client Error]: ${data}`);
});

child.on('close', (code) => {
    console.log(`Client process exited with code ${code}`);
});
