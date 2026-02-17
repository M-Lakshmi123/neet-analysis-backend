const mysql = require('mysql2/promise');
require('dotenv').config();

(async () => {
    try {
        const pool = await mysql.createPool({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT,
            ssl: { rejectUnauthorized: false }
        });
        const [rows] = await pool.execute('SELECT Stream, NAME_OF_THE_CAMPUS, `>= 550M` FROM TARGETS LIMIT 10');
        console.log('TARGETS SAMPLE:');
        console.table(rows);
        await pool.end();
    } catch (err) {
        console.error(err);
    }
})();
