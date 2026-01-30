const { connectToDb, sql } = require('./db');

async function inspectMedicalResult() {
    try {
        const pool = await connectToDb();

        // Check columns
        const columns = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'MEDICAL_RESULT'
        `);
        console.log("COLUMNS:", columns.recordset);

        // Get sample data
        const data = await pool.request().query(`SELECT TOP 5 * FROM MEDICAL_RESULT`);
        console.log("SAMPLE DATA:", data.recordset);

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}

inspectMedicalResult();
