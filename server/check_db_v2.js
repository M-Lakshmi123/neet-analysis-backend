const { connectToDb } = require('./db');

async function checkDb() {
    try {
        console.log("Checking NEET_2026 database...");
        const pool = await connectToDb('2026');
        const [rows] = await pool.rawPool.query('SHOW TABLES');
        console.log("Tables in NEET_2026:");
        rows.forEach(r => console.log(` - ${Object.values(r)[0]}`));
        
        const [countRes] = await pool.rawPool.query('SELECT COUNT(*) as count FROM MEDICAL_RESULT');
        console.log(`Total rows in MEDICAL_RESULT: ${countRes[0].count}`);

        const [distinctRes] = await pool.rawPool.query('SELECT DISTINCT CAMPUS_NAME FROM MEDICAL_RESULT LIMIT 10');
        console.log("Distinct CAMPUS_NAME (first 10):", distinctRes.map(r => r.CAMPUS_NAME || r.campus_name));

        process.exit(0);
    } catch (err) {
        console.error("Error checking database:", err);
        process.exit(1);
    }
}

checkDb();
