const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function createErpTable() {
    try {
        const config = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT) || 4000,
            ssl: { rejectUnauthorized: true }
        };

        console.log("Connecting to Database...");
        const conn = await mysql.createConnection(config);

        // 1. Get Schema of MEDICAL_RESULT
        console.log("Reading structure of 'MEDICAL_RESULT'...");
        const [columns] = await conn.query("SHOW COLUMNS FROM MEDICAL_RESULT");

        if (columns.length === 0) {
            console.error("❌ Error: MEDICAL_RESULT table does not exist or has no columns.");
            process.exit(1);
        }

        console.log(`Found ${columns.length} columns.`);

        // 2. Build Create Statement
        const colDefs = columns.map(col => {
            // Keep original type, nullability, etc? 
            // The simple "Show Columns" gives Field, Type, Null, Key, Default, Extra
            // For TiDB/MySQL simplified creation:

            let def = `\`${col.Field}\` ${col.Type}`;
            // Note: We ignore Key/AutoIncrement for now unless we want to exactly duplicate keys too.
            // User asked for "same columns", usually implying structure.
            // If MEDICAL_RESULT doesn't have ID (as per previous request), ERP_REPORT won't either.

            return def;
        });

        const createSql = `
            CREATE TABLE IF NOT EXISTS ERP_REPORT (
                ${colDefs.join(',\n                ')}
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `;

        // 3. Create Table
        console.log("Creating 'ERP_REPORT' table...");
        await conn.query("DROP TABLE IF EXISTS ERP_REPORT"); // Reset to be sure
        await conn.query(createSql);

        console.log("✅ 'ERP_REPORT' created successfully with same columns as 'MEDICAL_RESULT'.");
        console.log("Columns:", columns.map(c => c.Field).join(', '));

        await conn.end();

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

createErpTable();
