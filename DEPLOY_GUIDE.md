# How to Deploy Your Website to Firebase

Since you have a **Frontend** (Vite/React) and a **Backend** (Node.js/SQL Server), the process has two parts.

## Part 1: Deploy the Frontend to Firebase

1. Open your terminal in the `client` folder:
   ```cmd
   cd "f:\Projects\NEET Analysis\client"
   ```
2. Build the production files:
   ```cmd
   npm run build
   ```
3. Deploy to Firebase:
   ```cmd
   firebase deploy
   ```
   *Your website will be live at: `https://medical-2025-srichaitanya.web.app`*

---

## Part 2: Connect the Hosted Frontend to your Local Backend

Because your Frontend is now on the internet (HTTPS), it cannot talk to `localhost` (HTTP). You need to give your local server a secure public URL.

### recommended: Cloudflare Tunnel (Free & Secure)
1. Download `cloudflared` from [Cloudflare](https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi) and install it.
2. Open terminal and run:
   ```cmd
   cloudflared tunnel --url http://localhost:5000
   ```
3. Cloudflare will give you a random URL like `https://random-words.trycloudflare.com`.
4. **Copy that URL.**

### Part 3: Update the Website with the new URL
1. Create a file named `.env.production` in your `client` folder.
2. Add your Cloudflare URL there:
   ```env
   VITE_API_URL=https://your-cloudflare-url.trycloudflare.com
   ```
3. **Re-build and Re-deploy**:
   ```cmd
   npm run build
   ```
   ```cmd
   firebase deploy
   ```

Now your website on the internet can safely talk to your backend running on your PC!
