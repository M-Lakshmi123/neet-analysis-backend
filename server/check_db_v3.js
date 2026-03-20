const { connectToDb } = require('./db');
require('dotenv').config();

async function checkDb() {
    try {
        console.log("Checking NEET (default) database...");
        // Re-implement a direct connect to 2025 if needed
        const mysql = require('mysql2/promise');
        const config = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT) || 4000,
            ssl: { rejectUnauthorized: true }
        };
        const poolRaw = mysql.createPool(config);
        const [tables] = await poolRaw.query('SHOW TABLES');
        console.log("Tables in NEET:");
        tables.forEach(r => console.log(` - ${Object.values(r)[0]}`));

        const [countRes] = await poolRaw.query('SELECT COUNT(*) as count FROM MEDICAL_RESULT');
        console.log(`Total rows in MEDICAL_RESULT: ${countRes[0].count}`);

        const [distinctRes] = await poolRaw.query('SELECT DISTINCT CAMPUS_NAME FROM MEDICAL_RESULT LIMIT 20');
        console.log("Distinct CAMPUS_NAME (first 20):");
        distinctRes.forEach(r => console.log(` - ${r.CAMPUS_NAME}`));

        process.exit(0);
    } catch (err) {
        console.error("Error checking database:", err);
        process.exit(1);
    }
}

checkDb();
