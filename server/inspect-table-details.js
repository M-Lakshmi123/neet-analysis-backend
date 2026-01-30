const { connectToDb, sql } = require('./db');

async function debugDb() {
    try {
        const pool = await connectToDb();
        const tables = await pool.request().query("SELECT TOP 1 TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'");

        if (tables.recordset.length === 0) {
            console.log("No tables found.");
            return;
        }

        const tableName = tables.recordset[0].TABLE_NAME;
        console.log("Found Table:", tableName);

        const data = await pool.request().query(`SELECT TOP 1 * FROM [${tableName}]`);
        console.log("Sample Data Keys:", Object.keys(data.recordset[0] || {}));

    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}

debugDb();
