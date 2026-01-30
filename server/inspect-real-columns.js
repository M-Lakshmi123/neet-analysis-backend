const { connectToDb } = require('./db');

async function inspectColumns() {
    try {
        const pool = await connectToDb();
        console.log("Connected. Fetching columns for MEDICAL_RESULT...");

        const result = await pool.request().query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'MEDICAL_RESULT'
        `);

        console.log("--- COLUMNS FOUND ---");
        console.log(result.recordset.map(row => row.COLUMN_NAME).join(', '));

        const sample = await pool.request().query('SELECT TOP 1 * FROM MEDICAL_RESULT');
        console.log("\n--- SAMPLE ROW ---");
        console.log(sample.recordset[0]);

        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

inspectColumns();
