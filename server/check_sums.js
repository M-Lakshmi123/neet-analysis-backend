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

        console.log('--- TARGETS SUMS FOR SR ELITE ---');
        const [rows] = await pool.execute('SELECT Stream, SUM(`>= 710M`) as T710, SUM(`>= 550M`) as T550, COUNT(*) as RowCount FROM TARGETS WHERE Stream = "SR ELITE" GROUP BY Stream');
        console.table(rows);

        console.log('--- TARGETS RAW FOR SR ELITE ---');
        const [raw] = await pool.execute('SELECT NAME_OF_THE_CAMPUS, Stream, `>= 550M` FROM TARGETS WHERE Stream = "SR ELITE"');
        console.table(raw);

        await pool.end();
    } catch (err) {
        console.error(err);
    }
})();
