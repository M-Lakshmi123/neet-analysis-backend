const { connectToDb } = require('../server/db');

async function checkData() {
    try {
        const pool2026 = await connectToDb('2026');
        
        console.log("Querying 2026 tests...");
        const res2026 = await pool2026.request().query('SELECT DISTINCT Test, DATE FROM MEDICAL_RESULT LIMIT 20');
        console.log("2026 Tests:", res2026.recordset);

        const count2026 = await pool2026.request().query('SELECT COUNT(*) as cnt FROM MEDICAL_RESULT');
        console.log("2026 total row count:", count2026.recordset[0].cnt);

        console.log("Querying 2026 campuses...");
        const campuses2026 = await pool2026.request().query('SELECT DISTINCT CAMPUS_NAME FROM MEDICAL_RESULT LIMIT 10');
        console.log("2026 Campuses:", campuses2026.recordset);
        
    } catch (err) {
        console.error("Error querying db:", err);
    }
    process.exit(0);
}

checkData();
