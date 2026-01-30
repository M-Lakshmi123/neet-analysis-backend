# How to Upload New Data to TiDB Cloud

Since you are already comfortable with **MySQL Workbench**, that is the easiest way to upload new data.

### Option 1: Using MySQL Workbench (Recommended)
1.  **Open MySQL Workbench** on your laptop.
2.  **Connect** to your TiDB Cloud database (using the connection you already saved).
3.  On the left sidebar, **Right-Click** on the `MEDICAL_RESULT` table.
4.  Select **"Table Data Import Wizard"**.
5.  **Browse** and select your new data file (CSV or JSON).
6.  Click **Next**.
7.  **Map Columns:** Ensure the columns in your Excel/CSV match the columns in the database (e.g., `Tot_720`, `Physics`, `NAME_OF_THE_STUDENT`, etc.).
    *   *Tip: It is best if your CSV headers match the database column names exactly.*
8.  Click **Next** -> **Next** -> **Finish**.

### Option 2: Using TiDB Cloud Console (Web)
1.  Login to [tidbcloud.com](https://tidbcloud.com).
2.  Go to your **Cluster** -> **Import**.
3.  You can upload a CSV file directly from the browser.
4.  Define the target table (`MEDICAL_RESULT`).
5.  Start Import.

---

### 💡 Feature Idea: Admin Upload Page
Currently, you have to use these external tools.
**Would you like me to build an "Upload Results" page inside your Website's Admin Dashboard?**

This would allow you to:
1.  Login to your website as Admin.
2.  Click "Upload Results".
3.  Drag & Drop your Excel file.
4.  The website automatically validates and uploads it to TiDB.
