const { connectToDb } = require('./db');

async function testFilters() {
    try {
        console.log("Testing /api/filters for 2025...");
        const pool = await connectToDb('2025');
        const campusesQuery = 'SELECT DISTINCT TRIM(CAMPUS_NAME) as CAMPUS_NAME FROM MEDICAL_RESULT WHERE CAMPUS_NAME IS NOT NULL AND CAMPUS_NAME != \'\' ORDER BY CAMPUS_NAME';
        const result = await pool.request().query(campusesQuery);
        console.log(`Found ${result.recordset.length} campuses in 2025.`);
        console.log("First 5:", result.recordset.slice(0, 5).map(r => r.CAMPUS_NAME));
        process.exit(0);
    } catch (err) {
        console.error("Filter test failed:", err);
        process.exit(1);
    }
}

testFilters();
