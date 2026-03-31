const { connectToDb } = require('./db');

async function testFilters() {
    try {
        for (const year of ['2025', '2026']) {
            console.log(`\n--- Testing ${year} ---`);
            const pool = await connectToDb(year);
            const campusesQuery = 'SELECT DISTINCT TRIM(CAMPUS_NAME) as CAMPUS_NAME FROM MEDICAL_RESULT WHERE CAMPUS_NAME IS NOT NULL AND CAMPUS_NAME != \'\' ORDER BY CAMPUS_NAME';
            try {
                const result = await pool.request().query(campusesQuery);
                console.log(`Found ${result.recordset.length} campuses in ${year}.`);
                if (result.recordset.length > 0) {
                    console.log("Samples:", result.recordset.slice(0, 5).map(r => r.CAMPUS_NAME));
                }
            } catch (queryErr) {
                console.error(`Query failed for ${year}: ${queryErr.message}`);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error("Filter test fatal failed:", err);
        process.exit(1);
    }
}

testFilters();
