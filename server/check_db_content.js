const { connectToDb } = require('./db');

async function checkData() {
    try {
        const pool = await connectToDb();
        console.log("Connected to DB");

        const countResult = await pool.request().query('SELECT COUNT(*) as count FROM MEDICAL_RESULT');
        console.log("Total rows in MEDICAL_RESULT:", countResult.recordset[0].count);

        const sampleResult = await pool.request().query('SELECT CAMPUS_NAME, Stream, Test_Type, Test FROM MEDICAL_RESULT LIMIT 5');
        console.log("Sample Data:", JSON.stringify(sampleResult.recordset, null, 2));

        const campusStats = await pool.request().query("SELECT DISTINCT CAMPUS_NAME FROM MEDICAL_RESULT WHERE CAMPUS_NAME IS NOT NULL AND CAMPUS_NAME != ''");
        console.log("Campuses Found:", campusStats.recordset.length);
        console.log("Campuses:", campusStats.recordset.map(r => r.CAMPUS_NAME));

        process.exit(0);
    } catch (err) {
        console.error("Check failed:", err);
        process.exit(1);
    }
}

checkData();
