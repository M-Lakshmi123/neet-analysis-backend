const { connectToDb } = require('./db');

async function checkDb() {
    try {
        console.log("Checking NEET_2026 database...");
        const pool = await connectToDb('2026');
        const [rows] = await pool.rawPool.query('SELECT DISTINCT CAMPUS_NAME FROM MEDICAL_RESULT WHERE CAMPUS_NAME IS NOT NULL AND CAMPUS_NAME != \'\'');
        console.log(`Found ${rows.length} campuses:`);
        rows.forEach(r => console.log(` - ${r.CAMPUS_NAME || r.campus_name}`));
        process.exit(0);
    } catch (err) {
        console.error("Error checking database:", err);
        process.exit(1);
    }
}

checkDb();
