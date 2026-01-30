const Service = require('node-windows').Service;
const path = require('path');

// 1. Create Backend Service
const backendSvc = new Service({
    name: 'NEET_Backend_Service', // Updated Name
    description: 'Node.js Backend for NEET Analysis System',
    script: path.join(__dirname, '../server/index.js'), // Correct Path
    env: [
        {
            name: "PORT",
            value: 5000
        },
        // Add other env vars here if needed, but better to rely on .env file in server dir
    ]
});

// 2. Create Frontend Service (Wrapper)
// Since Vite is a dev server, for production-like background auto-start without a browser, 
// we should technically serve the 'dist' folder with a static server (like 'serve').
// However, to keep it simple and exactly as 'npm run dev', we'll wrap it.
const frontendSvc = new Service({
    name: 'NEET_Frontend_Service', // Updated Name
    description: 'Vite Frontend for NEET Analysis System',
    script: path.join(__dirname, 'client_wrapper.js'), // We need a simple wrapper for npm run dev
});

// Events for Backend
backendSvc.on('install', function () {
    console.log('Backend Service Installed');
    backendSvc.start();
});
backendSvc.on('alreadyinstalled', function () {
    console.log('Backend Service already installed. Starting...');
    backendSvc.start();
});

// Events for Frontend
frontendSvc.on('install', function () {
    console.log('Frontend Service Installed');
    frontendSvc.start();
});
frontendSvc.on('alreadyinstalled', function () {
    console.log('Frontend Service already installed. Starting...');
    frontendSvc.start();
});

// Install function
const install = () => {
    console.log("Installing Backend Service...");
    backendSvc.install();

    setTimeout(() => {
        console.log("Installing Frontend Service...");
        frontendSvc.install();
    }, 5000);
};

install();
