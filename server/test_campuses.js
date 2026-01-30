const { connectToDb } = require('./db');
async function check() {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query('SELECT DISTINCT CAMPUS_NAME FROM MEDICAL_RESULT WITH (NOLOCK) WHERE CAMPUS_NAME IS NOT NULL AND CAMPUS_NAME != \'\'');
        console.log("CAMPUSES:", JSON.stringify(result.recordset, null, 2));
        process.exit();
    } catch (err) {
        console.error("ERROR:", err);
        process.exit(1);
    }
}
check();
