const { connectToDb } = require('./db');

async function checkDb() {
    try {
        console.log("Checking NEET_2025 database for NST-01...");
        const pool = await connectToDb('2025');
        
        const [rows] = await pool.rawPool.query("SELECT COUNT(*) as count FROM MEDICAL_RESULT WHERE Test = 'NST-01'");
        console.log(`Total rows in MEDICAL_RESULT for Test 'NST-01': ${rows[0].count}`);

        const [distinctRows] = await pool.rawPool.query("SELECT Test, Test_Type, DATE FROM MEDICAL_RESULT WHERE Test = 'NST-01' LIMIT 5");
        console.log("Example rows for NST-01:");
        distinctRows.forEach(r => console.log(` - Test: ${r.Test}, Type: ${r.Test_Type}, Date: ${r.DATE}`));

        process.exit(0);
    } catch (err) {
        console.error("Error checking database:", err);
        process.exit(1);
    }
}

checkDb();
