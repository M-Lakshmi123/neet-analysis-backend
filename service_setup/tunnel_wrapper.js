
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function startTunnel() {
    console.log("Starting Cloudflare Tunnel...");
    // Run cloudflared and capture output to get the URL
    const tunnel = spawn('cloudflared', ['tunnel', '--url', 'http://localhost:5000']);
    
    tunnel.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output);
        
        // Look for the URL in the output
        const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (urlMatch) {
            const url = urlMatch[0];
            console.log("!!! FOUND NEW TUNNEL URL:", url);
            
            // Update the .env.production file
            const envPath = "f:/Projects/NEET Analysis/client/.env.production";
            fs.writeFileSync(envPath, "VITE_API_URL=" + url + "\n");
            
            // Run build and deploy
            console.log("Redeploying website to Firebase...");
            const projectDir = "f:/Projects/NEET Analysis/client";
            const redeploy = spawn('cmd.exe', ['/c', 'npm run build && firebase deploy'], { cwd: projectDir });
            
            redeploy.stdout.on('data', (d) => console.log(d.toString()));
            redeploy.stderr.on('data', (d) => console.error(d.toString()));
        }
    });

    tunnel.stderr.on('data', (data) => {
        const output = data.toString();
        const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (urlMatch) {
             const url = urlMatch[0];
             const envPath = "f:/Projects/NEET Analysis/client/.env.production";
             fs.writeFileSync(envPath, "VITE_API_URL=" + url);
        }
        console.error(output);
    });

    tunnel.on('close', (code) => {
        console.log("Tunnel closed with code " + code + ". Restarting...");
        setTimeout(startTunnel, 5000);
    });
}

startTunnel();
