const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: 'f:/Projects/NEET Analysis/server/.env' });

async function migrate() {
    const config2025 = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: parseInt(process.env.DB_PORT) || 4000,
        ssl: { rejectUnauthorized: true }
    };

    const config2026 = {
        host: process.env.DB_HOST_2026,
        user: process.env.DB_USER_2026,
        password: process.env.DB_PASSWORD_2026,
        database: process.env.DB_NAME_2026,
        port: parseInt(process.env.DB_PORT_2026) || 4000,
        ssl: { rejectUnauthorized: true }
    };

    const config2026Base = {
        host: process.env.DB_HOST_2026,
        user: process.env.DB_USER_2026,
        password: process.env.DB_PASSWORD_2026,
        port: parseInt(process.env.DB_PORT_2026) || 4000,
        ssl: { rejectUnauthorized: true }
    };

    console.log("Connecting to 2025 DB...");
    const conn2025 = await mysql.createConnection(config2025);

    console.log("Connecting to 2026 Server (check/create DB)...");
    const conn2026Base = await mysql.createConnection(config2026Base);
    await conn2026Base.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME_2026}\``);
    await conn2026Base.query(`USE \`${process.env.DB_NAME_2026}\``);
    const conn2026 = conn2026Base; // Re-use connection

    try {
        const [tables] = await conn2025.query("SHOW TABLES");
        const tableNames = tables.map(t => Object.values(t)[0]);
        console.log("Tables found in 2025:", tableNames);

        for (const tableName of tableNames) {
            console.log(`Extracting schema for ${tableName}...`);
            const [createTableResult] = await conn2025.query(`SHOW CREATE TABLE ${tableName}`);
            const createSql = createTableResult[0]['Create Table'];

            console.log(`Creating table ${tableName} in 2026 DB...`);
            // Drop if exists to ensure clean slate if needed, or just create
            await conn2026.query(`DROP TABLE IF EXISTS ${tableName}`);
            await conn2026.query(createSql);
            console.log(`Table ${tableName} created successfully.`);
        }

        console.log("Schema migration completed!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await conn2025.end();
        await conn2026.end();
    }
}

migrate();
