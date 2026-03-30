const { connectToDb } = require('./db');

async function checkDb() {
    try {
        console.log("Checking NEET_2026 database for NST-01...");
        const pool = await connectToDb('2026');
        
        const [rows] = await pool.rawPool.query("SELECT COUNT(*) as count FROM MEDICAL_RESULT WHERE Test = 'NST-01'");
        console.log(`Total rows in MEDICAL_RESULT for Test 'NST-01': ${rows[0].count}`);

        const [distinctTests] = await pool.rawPool.query("SELECT DISTINCT Test, Test_Type FROM MEDICAL_RESULT LIMIT 20");
        console.log("Distinct Tests/Types in 2026:");
        distinctTests.forEach(r => console.log(` - ${r.Test} (${r.Test_Type})`));

        process.exit(0);
    } catch (err) {
        console.error("Error checking database:", err);
        process.exit(1);
    }
}

checkDb();
