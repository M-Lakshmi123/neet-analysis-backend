const fs = require('fs');
const csv = require('csv-parser');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const CSV_PATH = 'F:/Project files/MEDICAL_RESULT.csv';

async function resetTable() {
    console.log("Reading CSV Headers to create exact table structure...");

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
        const headers = await getCsvHeaders();
        console.log(`Found ${headers.length} columns in CSV.`);
        console.log("Columns:", headers.join(', '));

        if (headers.includes('id') || headers.includes('ID')) {
            console.log("Note: CSV contains an 'id' column, using it.");
        } else {
            console.log("Note: CSV does NOT contain 'id'. Table will be created without a Primary Key ID column (as requested).");
        }

        // 2. Prepare SQL
        // We use TEXT or VARCHAR to be safe for all data types unless we analyze them
        // Using VARCHAR(255) is standard, but some might be longer. Let's use VARCHAR(255) for most, TEXT for potentially long ones?
        // User said "Take same columns same data".

        const columnDefs = headers.map(col => {
            const safeCol = `\`${col}\``;
            return `${safeCol} VARCHAR(255)`;
        });

        const createSql = `
            CREATE TABLE MEDICAL_RESULT (
                ${columnDefs.join(',\n                ')}
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `;

        // 3. Execute
        const config = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT) || 4000,
            ssl: { rejectUnauthorized: true }
        };

        console.log("\nConnecting to Database...");
        const conn = await mysql.createConnection(config);

        console.log("Dropping existing table...");
        await conn.query("DROP TABLE IF EXISTS MEDICAL_RESULT");

        console.log("Creating new table with EXACT CSV columns...");
        await conn.query(createSql);

        console.log("✅ Table created successfully!");

        await conn.end();

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

resetTable();
