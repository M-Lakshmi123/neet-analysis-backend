const Service = require('node-windows').Service;
const path = require('path');

console.log('Initializing Service Installation...');

// --- configuration ---

// 1. Backend Service Configuration
const backendSvc = new Service({
    name: 'NEET Analysis Backend',
    description: 'Node.js Backend Server for NEET Analysis API',
    script: path.join(__dirname, '..', 'server', 'index.js'),
    workingDirectory: path.join(__dirname, '..', 'server'),
    nodeOptions: [
        '--harmony',
        '--max_old_space_size=4096'
    ]
});

// 2. Frontend Service Configuration
const frontendSvc = new Service({
    name: 'NEET Analysis Frontend',
    description: 'Vite Frontend Server for NEET Analysis UI',
    script: path.join(__dirname, 'client_wrapper.js'),
    workingDirectory: path.join(__dirname),
    env: [{
        name: "NODE_ENV",
        value: "production"
    }]
});

// --- Installation Logic ---

backendSvc.on('install', () => {
    console.log('✅ Backend Service Installed Successfully!');
    console.log('Starting Backend Service...');
    backendSvc.start();

    // Install Frontend after Backend is done
    console.log('⏳ Proceeding to install Frontend Service...');
    frontendSvc.install();
});

backendSvc.on('alreadyinstalled', () => {
    console.log('⚠️ Backend Service is already installed.');
    console.log('⏳ Proceeding to install Frontend Service...');
    frontendSvc.install();
});

backendSvc.on('start', () => {
    console.log('🚀 Backend Service Started.');
});

frontendSvc.on('install', () => {
    console.log('✅ Frontend Service Installed Successfully!');
    console.log('Starting Frontend Service...');
    frontendSvc.start();
    console.log('🎉 All Services Installed! Your website will now auto-start with Windows.');
});

frontendSvc.on('alreadyinstalled', () => {
    console.log('⚠️ Frontend Service is already installed.');
});

frontendSvc.on('start', () => {
    console.log('🚀 Frontend Service Started.');
});

// Start installation chain
console.log('--- Installing NEET Analysis Backend ---');
backendSvc.install();
