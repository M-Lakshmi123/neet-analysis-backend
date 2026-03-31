const { connectToDb } = require('./db');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkDirectly() {
    console.log("--- Checking 2025 Directly ---");
    const config2025 = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: 4000,
        ssl: { rejectUnauthorized: true }
    };
    try {
        const conn2025 = await mysql.createConnection(config2025);
        const [rows2025] = await conn2025.query('SELECT DISTINCT TRIM(CAMPUS_NAME) as CAMPUS_NAME FROM MEDICAL_RESULT WHERE CAMPUS_NAME IS NOT NULL AND CAMPUS_NAME != "" ORDER BY CAMPUS_NAME');
        console.log(`2025 found ${rows2025.length} campuses.`);
        if (rows2025.length > 0) console.log("Example:", rows2025[0].CAMPUS_NAME);
        await conn2025.end();
    } catch (err) {
        console.error("2025 failed:", err.message);
    }

    console.log("\n--- Checking 2026 Directly ---");
     const config2026 = {
        host: process.env.DB_HOST_2026,
        user: process.env.DB_USER_2026,
        password: process.env.DB_PASSWORD_2026,
        database: process.env.DB_NAME_2026,
        port: 4000,
        ssl: { rejectUnauthorized: true }
    };
    try {
        const conn2026 = await mysql.createConnection(config2026);
        const [rows2026] = await conn2026.query('SELECT DISTINCT TRIM(CAMPUS_NAME) as CAMPUS_NAME FROM MEDICAL_RESULT WHERE CAMPUS_NAME IS NOT NULL AND CAMPUS_NAME != "" ORDER BY CAMPUS_NAME');
        console.log(`2026 found ${rows2026.length} campuses.`);
        if (rows2026.length > 0) console.log("Example:", rows2026[0].CAMPUS_NAME);
        await conn2026.end();
    } catch (err) {
        console.error("2026 failed:", err.message);
    }
}

checkDirectly();
