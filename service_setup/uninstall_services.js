const Service = require('node-windows').Service;
const path = require('path');

// 1. Uninstall Backend
const backendSvc = new Service({
    name: 'NEET_Backend_Service',
    script: path.join(__dirname, '../server/index.js')
});

// 2. Uninstall Frontend
const frontendSvc = new Service({
    name: 'NEET_Frontend_Service',
    script: path.join(__dirname, 'client_wrapper.js')
});

backendSvc.on('uninstall', function () {
    console.log('Backend Service Uninstall Complete');
    console.log('The service exists: ', backendSvc.exists);
});

frontendSvc.on('uninstall', function () {
    console.log('Frontend Service Uninstall Complete');
    console.log('The service exists: ', frontendSvc.exists);
});

console.log("Uninstalling Services...");
backendSvc.uninstall();
frontendSvc.uninstall();
