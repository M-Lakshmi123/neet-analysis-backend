const { connectToDb, sql } = require('./db');

async function inspectAll() {
    try {
        const pool = await connectToDb();
        const tables = await pool.request().query(`SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE='BASE TABLE'`);

        for (const row of tables.recordset) {
            const table = row.TABLE_NAME;
            // console.log(`Checking ${table}...`);
            try {
                const data = await pool.request().query(`SELECT TOP 1 * FROM [${table}]`);
                if (data.recordset.length > 0) {
                    console.log(`\nTable: ${table}`);
                    console.log(`Columns: ${Object.keys(data.recordset[0]).join(', ')}`);
                }
            } catch (e) {
                // Ignore empty or error tables
            }
        }
    } catch (err) {
        console.error("Error:", err);
    } finally {
        process.exit(0);
    }
}

inspectAll();
