const Service = require('node-windows').Service;
const path = require('path');

// 1. Backend Service
const backendSvc = new Service({
    name: 'NEET Analysis Backend',
    script: path.join(__dirname, '..', 'server', 'index.js')
});

// 2. Frontend Service
const frontendSvc = new Service({
    name: 'NEET Analysis Frontend',
    script: path.join(__dirname, 'client_wrapper.js')
});

backendSvc.on('uninstall', () => {
    console.log('✅ Backend Service Uninstalled.');
    frontendSvc.uninstall();
});

frontendSvc.on('uninstall', () => {
    console.log('✅ Frontend Service Uninstalled.');
    console.log('Done.');
});

console.log('Uninstalling Services...');
backendSvc.uninstall();
