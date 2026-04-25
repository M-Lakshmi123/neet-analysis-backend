const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function addColumn() {
    const years = ['', '_2026'];
    for (const suffix of years) {
        console.log(`\nUpdating DB ${suffix || '2025'}...`);
        const config = {
            host: process.env[`DB_HOST${suffix}`] || process.env.DB_HOST,
            user: process.env[`DB_USER${suffix}`] || process.env.DB_USER,
            password: process.env[`DB_PASSWORD${suffix}`] || process.env.DB_PASSWORD,
            database: process.env[`DB_NAME${suffix}`] || process.env.DB_NAME,
            port: parseInt(process.env[`DB_PORT${suffix}`] || process.env.DB_PORT) || 4000,
            ssl: { rejectUnauthorized: true }
        };

        try {
            const connection = await mysql.createConnection(config);
            console.log('Adding Custom_Heading to MEDICAL_RESULT...');
            await connection.query('ALTER TABLE MEDICAL_RESULT ADD COLUMN Custom_Heading VARCHAR(255) DEFAULT NULL');
            console.log('✅ Column added successfully.');
            await connection.end();
        } catch (err) {
            console.error('Error:', err.message);
        }
    }
}

addColumn();
