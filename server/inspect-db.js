const { connectToDb, sql } = require('./db');

async function listTables() {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
        `);
        console.log("Tables found:", result.recordset);

        if (result.recordset.length > 0) {
            const firstTable = result.recordset[0].TABLE_NAME;
            console.log(`\nInspecting columns for table: ${firstTable}`);
            const columns = await pool.request().query(`
                SELECT COLUMN_NAME, DATA_TYPE 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_NAME = '${firstTable}'
            `);
            console.log(columns.recordset);
        }

    } catch (err) {
        console.error("Error inspecting DB:", err);
    } finally {
        // sql.close(); // Keep pool open or handle exit
        process.exit(0);
    }
}

listTables();
