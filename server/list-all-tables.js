const { connectToDb, sql } = require('./db');

async function listAllTables() {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            ORDER BY TABLE_NAME
        `);
        console.log("All Tables:", result.recordset.map(r => r.TABLE_NAME));
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}

listAllTables();
