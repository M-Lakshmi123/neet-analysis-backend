const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function check() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT) || 4000,
        ssl: { rejectUnauthorized: true }
    };

    console.log(`Connecting to ${config.host} as ${config.user}...`);

    try {
        const conn = await mysql.createConnection(config);
        console.log("✅ Connection Successful!");

        const [rows] = await conn.query("SHOW DATABASES");
        console.log("Existing Databases:");
        rows.forEach(row => console.log(` - ${row.Database}`));

        const hasNeet = rows.some(r => r.Database === 'NEET');
        if (hasNeet) {
            console.log("\n✅ Database 'NEET' exists.");
        } else {
            console.log("\n❌ Database 'NEET' DOES NOT exist. You need to create it.");
        }

        await conn.end();
    } catch (err) {
        console.error("❌ Connection Failed:", err.message);
    }
}

check();
