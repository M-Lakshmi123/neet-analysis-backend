const { connectToDb } = require('./db');

async function listColumns() {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query("SELECT TOP 1 * FROM MEDICAL_RESULT");
        console.log("Columns in MEDICAL_RESULT:");
        Object.keys(result.recordset[0]).forEach(col => console.log(`- ${col}`));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listColumns();
