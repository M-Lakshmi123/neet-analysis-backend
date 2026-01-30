# How to Deploy Frontend to Firebase

### Prerequisites
1.  **Node.js** installed.
2.  **Firebase CLI** installed (`npm install -g firebase-tools`).
3.  **Logged in** to Firebase (`firebase login`).

### Step 1: Verification
Ensure your `.env.production` file has the correct Backend URL (from Render).
*   Current Value: `https://neet-backend-3oxu.onrender.com`
*   *If your Render URL changed, update this file first!*

### Step 2: Build and Deploy
Open your terminal and run these commands:

```powershell
cd client
npm install
npm run build
firebase deploy
```

### Troubleshooting
*   **"firebase" is not recognized**: Run `npm install -g firebase-tools` and try again.
*   **Login Error**: Run `firebase login` to authenticate.
