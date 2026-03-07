const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const createTableSQL = `
CREATE TABLE IF NOT EXISTS uploaded_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`;

async function init() {
    const years = ['2025', '2026'];

    for (const year of years) {
        const suffix = year === '2026' ? '_2026' : '';
        const config = {
            host: process.env[`DB_HOST${suffix}`] || process.env.DB_HOST,
            user: process.env[`DB_USER${suffix}`] || process.env.DB_USER,
            password: process.env[`DB_PASSWORD${suffix}`] || process.env.DB_PASSWORD,
            database: process.env[`DB_NAME${suffix}`] || process.env.DB_NAME,
            port: parseInt(process.env[`DB_PORT${suffix}`] || process.env.DB_PORT) || 4000,
            ssl: { rejectUnauthorized: true }
        };

        if (!config.host) continue;

        console.log(`Initializing File Management Table for ${year}...`);
        let conn;

        try {
            conn = await mysql.createConnection(config);
            await conn.query(createTableSQL);
            console.log(`✅ Table 'uploaded_files' created successfully in ${year}.`);
            await conn.end();
        } catch (err) {
            console.error(`❌ Initialization Failed for ${year}:`, err.message);
            if (conn) await conn.end();
        }
    }
}

init();
