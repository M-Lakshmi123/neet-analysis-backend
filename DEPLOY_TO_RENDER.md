# How to Deploy Backend to Render (Free Cloud)

To make your website work 24/7 without your laptop, we need to move the **Backend Code** to Render.com.

### Step 1: Push Code to GitHub
Since you already have the code on your laptop, the easiest way is to use GitHub Desktop or the Command Line.
1.  Create a **New Repository** on [GitHub.com](https://github.com/new). Name it `neet-analysis-backend`.
2.  Do **NOT** add a README, gitignore, or license (we already have them).
3.  Copy the URL of your new repository (e.g., `https://github.com/YourName/neet-analysis-backend.git`).
4.  Open your Command Prompt in the project folder and run:
    ```cmd
    git remote add origin YOUR_GITHUB_URL_HERE
    git push -u origin master
    ```

### Step 2: Create Service on Render
1.  Go to [dashboard.render.com](https://dashboard.render.com/).
2.  Click **New +** -> **Web Service**.
3.  Connect your GitHub account and select the `neet-analysis-backend` repository.
4.  **Configuration:**
    *   **Name:** `neet-backend` (or similar)
    *   **Region:** Singapore (closest to India) or Frankfurt.
    *   **Root Directory:** `server`  <-- **IMPORTANT!**
    *   **Runtime:** Node
    *   **Build Command:** `npm install`
    *   **Start Command:** `npm start`
    *   **Plan:** Free

### Step 3: Add Environment Variables
In the Render setup page (or in Settings -> Environment Variables later), add the credentials from your local `server/.env` file:
*   `DB_HOST`: (Copy from your .env)
*   `DB_USER`: (Copy from your .env)
*   `DB_PASSWORD`: (Copy from your .env)
*   `DB_NAME`: `NEET`
*   `DB_PORT`: `4000`
*   `EMAIL_USER`: `yenjarappa.s@varsitymgmt.com`
*   `EMAIL_PASS`: `Neet@123#`

### Step 4: Finalize
1.  Click **Create Web Service**.
2.  Wait for deployment to finish.
3.  Render will give you a **URL** (e.g., `https://neet-backend.onrender.com`).
4.  **Copy this URL**.

### Step 5: Update Frontend
1.  Open `client/.env.production` on your laptop.
2.  Replace the old Cloudflare URL with your new Render URL:
    ```env
    VITE_API_URL=https://neet-backend.onrender.com
    ```
3.  Run in terminal:
    ```cmd
    cd client
    npm run build
    firebase deploy
    ```
