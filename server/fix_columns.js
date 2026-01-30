const fs = require('fs');
const csv = require('csv-parser');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const CSV_PATH = 'F:/Project files/MEDICAL_RESULT.csv';

async function check() {
    console.log("Checking Columns...");

    // 1. Get CSV Headers
    const getCsvHeaders = () => new Promise((resolve, reject) => {
        const stream = fs.createReadStream(CSV_PATH).pipe(csv());
        stream.on('data', (data) => {
            resolve(Object.keys(data).map(k => k.trim()));
            stream.destroy();
        });
        stream.on('error', reject);
    });

    try {
        const csvHeaders = await getCsvHeaders();
        console.log("CSV Columns:", csvHeaders.length);
        console.log(csvHeaders.join(', '));

        // 2. Get DB Columns
        const config = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT) || 4000,
            ssl: { rejectUnauthorized: true }
        };

        const conn = await mysql.createConnection(config);
        const [rows] = await conn.query(`SHOW COLUMNS FROM MEDICAL_RESULT`);
        const dbColumns = rows.map(r => r.Field);
        console.log("\nDB Columns:", dbColumns.length);
        console.log(dbColumns.join(', '));

        // 3. Compare
        const missing = csvHeaders.filter(h => !dbColumns.includes(h) && h.toLowerCase() !== 'id'); // id is auto-inc

        if (missing.length > 0) {
            console.log("\n❌ MISSING COLUMNS IN DB:");
            missing.forEach(m => console.log(` - ${m}`));

            // Generate ALTER statements
            console.log("\nGenerated Fix Script:");
            const alterStmts = missing.map(col => `ADD \`${col}\` VARCHAR(255)`);
            const sql = `ALTER TABLE MEDICAL_RESULT ${alterStmts.join(', ')};`;
            console.log(sql);

            // Apply Fix?
            console.log("\nApplying fix...");
            await conn.query(sql);
            console.log("✅ Columns added successfully!");
        } else {
            console.log("\n✅ All columns are present.");
        }

        await conn.end();

    } catch (err) {
        console.error("Error:", err.message);
    }
}

check();
