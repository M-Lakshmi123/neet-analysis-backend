const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function checkSchema() {
    const years = ['', '_2026'];
    for (const suffix of years) {
        console.log(`\nChecking DB ${suffix || '2025'}...`);
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
            const [rows] = await connection.query('SHOW COLUMNS FROM MEDICAL_RESULT');
            const columns = rows.map(r => r.Field);
            console.log('Columns:', columns.join(', '));
            if (!columns.includes('Custom_Heading')) {
                console.log('❌ Custom_Heading is MISSING!');
            } else {
                console.log('✅ Custom_Heading exists.');
            }
            await connection.end();
        } catch (err) {
            console.error('Error:', err.message);
        }
    }
}

checkSchema();
