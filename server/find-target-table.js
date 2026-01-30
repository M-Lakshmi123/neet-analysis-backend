const { connectToDb, sql } = require('./db');

async function findTable() {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query(`
            SELECT TABLE_NAME, COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE COLUMN_NAME = 'Test_Type'
        `);
        console.log("Found tables with Test_Type:", result.recordset);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}

findTable();
