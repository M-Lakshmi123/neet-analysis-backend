# Service Setup Instructions

To make the NEET Analysis application run automatically in the background when the PC starts (without opening any command prompts):

## Prerequisites
- Open this folder in a terminal: `f:\Projects\NEET Analysis\service_setup`
- Run `npm install` to get the necessary `node-windows` package.

## How to Install Services (Run Once)
1. Open PowerShell or Command Prompt as **Administrator**.
2. Run the following command:
   ```bash
   node install_services.js
   ```
3. You will see prompts asking for permission to create the services. click **Yes/Allow**.
4. Once completed, two Windows services will be created:
   - **NEET_Backend_Service**
   - **NEET_Frontend_Service**

These services are set to "Automatic" startup type, meaning they will launch whenever the computer boots up, with no visible windows.

## verification
1. Open Task Manager -> Services tab.
2. Look for `NEET_Backend_Service` and `NEET_Frontend_Service`.
3. They should show as "Running".

## How to Uninstall
If you want to stop them from running automatically or remove them:
1. Open PowerShell as **Administrator**.
2. Run:
   ```bash
   node uninstall_services.js
   ```
