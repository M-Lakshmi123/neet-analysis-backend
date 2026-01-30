const Service = require('node-windows').Service;
const path = require('path');

// 1. Create SINGLE Backend Service
// Now the backend serves the frontend too!
const backendSvc = new Service({
    name: 'NEET_Analysis_System', // New Unified Name
    description: 'NEET Analysis System (Backend + Frontend)',
    script: path.join(__dirname, '../server/index.js'),
    env: [
        {
            name: "PORT",
            value: 5000
        }
    ]
});

backendSvc.on('install', function () {
    console.log('Unified NEET System Service Installed');
    backendSvc.start();
});

backendSvc.on('alreadyinstalled', function () {
    console.log('Service already installed. Starting...');
    backendSvc.start();
});

backendSvc.on('start', function () {
    console.log('Service started successfully.');
    console.log('Your website is live at: http://localhost:5000');
});

console.log("Installing Unified Service...");
backendSvc.install();
