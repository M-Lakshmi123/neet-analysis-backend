const { connectToDb } = require('./db');
async function check() {
    const pool = await connectToDb();
    const result = await pool.request().query('SELECT TOP 5 * FROM MEDICAL_RESULT');
    console.log(JSON.stringify(result.recordset, null, 2));
    process.exit();
}
check();
