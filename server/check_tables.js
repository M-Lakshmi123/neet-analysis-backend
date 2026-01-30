const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function checkTables() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT) || 4000,
        ssl: { rejectUnauthorized: true }
    };

    try {
        const conn = await mysql.createConnection(config);
        console.log("Connected to DB.");

        const [tables] = await conn.query("SHOW TABLES");
        const tableNames = tables.map(r => Object.values(r)[0]);

        console.log("Tables found:", tableNames.join(', '));

        if (tableNames.includes('ERP_REPORT')) {
            console.log("✅ ERP_REPORT exists.");

            // Check columns
            const [cols] = await conn.query("SHOW COLUMNS FROM ERP_REPORT");
            console.log(`ERP_REPORT has ${cols.length} columns.`);
        } else {
            console.log("❌ ERP_REPORT missing.");
        }

        await conn.end();
    } catch (err) {
        console.error("Error:", err.message);
    }
}

checkTables();
