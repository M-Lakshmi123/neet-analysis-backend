const { connectToDb } = require('./db');

async function checkDb() {
    try {
        console.log("Checking NEET_2025 database for TOP categories in NST-01...");
        const pool = await connectToDb('2025');
        
        const [rows] = await pool.rawPool.query("SELECT Top_ALL, COUNT(*) as count FROM MEDICAL_RESULT WHERE Test = 'NST-01' GROUP BY Top_ALL");
        console.log("TOP Category counts for NST-01:");
        rows.forEach(r => console.log(` - ${r.Top_ALL}: ${r.count}`));

        process.exit(0);
    } catch (err) {
        console.error("Error checking database:", err);
        process.exit(1);
    }
}

checkDb();
