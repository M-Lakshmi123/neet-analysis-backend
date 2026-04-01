const { connectToDb } = require('./db');

async function check() {
    try {
        for (const year of ['2025', '2026']) {
            console.log(`\n--- Cluster: ${year} ---`);
            const pool = await connectToDb(year);
            const [tests] = await pool.rawPool.query("SELECT DISTINCT Test FROM MEDICAL_RESULT LIMIT 20");
            console.log(`Recent Tests in ${year}:`);
            console.table(tests);
            
            const [npt] = await pool.rawPool.query("SELECT STUD_ID, Test, Botany, B_Rank FROM MEDICAL_RESULT WHERE Test LIKE '%NPT%' LIMIT 3");
            if (npt.length > 0) {
                console.log(`NPT Data in ${year}:`);
                console.table(npt);
            }
        }
        process.exit(0);
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
}
check();
