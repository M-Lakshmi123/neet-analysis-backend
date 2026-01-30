const { connectToDb, sql } = require('./db');

async function listTables() {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
        `);
        console.log("TABLES:", JSON.stringify(result.recordset, null, 2));
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}

listTables();
