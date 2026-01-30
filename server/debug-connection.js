const sql = require('mssql');
require('dotenv').config();

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function diagnose() {
    console.log("--- DATABASE CONNECTION DIAGNOSIS ---");
    console.log(`Server: ${config.server}`);
    console.log(`User: ${config.user}`);
    console.log(`Database: ${config.database}`);
    console.log("-------------------------------------");

    try {
        console.log("1. Attempting connection...");
        let pool = await sql.connect(config);
        console.log("✅ CONNECTION SUCCESSFUL");

        console.log("2. Verifying Table Access...");
        const result = await pool.request().query('SELECT TOP 1 * FROM MEDICAL_RESULT');
        console.log("✅ QUERY SUCCESSFUL");
        console.log("Sample Data found:", result.recordset.length > 0 ? "YES" : "NO");

        pool.close();
    } catch (err) {
        console.error("❌ FAILURE DETECTED");
        console.error("Error Name:", err.name);
        console.error("Error Message:", err.message);
        console.error("Specific Code:", err.code);

        if (err.code === 'ESOCKET') {
            console.log("\n💡 TIP: Check if SQL Server is running via Services.msc");
            console.log("   Verify TCP/IP is enabled in SQL Server Configuration Manager.");
        } else if (err.code === 'ELOGIN') {
            console.log("\n💡 TIP: Check your username and password in .env");
        }
    }
}

diagnose();
