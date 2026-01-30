const Service = require('node-windows').Service;
const path = require('path');

// Create Backend Service
const svc = new Service({
    name: 'NEET_Backend_Service',
    description: 'Node.js Backend for NEET Analysis System',
    script: path.join(__dirname, '../server/index.js'),
    env: [
        {
            name: "PORT",
            value: 5000
        }
    ]
});

svc.on('install', function () {
    console.log('Backend Service Installed Successfully!');
    svc.start();
});

svc.on('alreadyinstalled', function () {
    console.log('Backend Service already installed. Starting...');
    svc.start();
});

svc.on('start', function () {
    console.log('Backend Service Started');
});

console.log("Installing Backend Service...");
svc.install();
