const { connectToDb } = require('./db');

async function checkColumns() {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'MEDICAL_RESULT'");
        console.log("Columns:", result.recordset.map(r => r.COLUMN_NAME).join(', '));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkColumns();
