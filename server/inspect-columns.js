const { connectToDb, sql } = require('./db');

async function inspectColumns() {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'MEDICAL_RESULT'
            ORDER BY ORDINAL_POSITION
        `);
        console.log("Columns:", result.recordset.map(r => r.COLUMN_NAME).join(', '));

        const sample = await pool.request().query(`SELECT TOP 1 * FROM MEDICAL_RESULT`);
        console.log("\nSample Row Keys:", Object.keys(sample.recordset[0] || {}));
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}

inspectColumns();
