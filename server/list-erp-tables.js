const { connectToDb, sql } = require('./db');

async function listErpTables() {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME LIKE 'ERP_%'
        `);
        console.log("ERP Tables:", result.recordset);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}

listErpTables();
