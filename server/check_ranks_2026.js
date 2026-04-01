const { connectToDb } = require('./db');

async function check() {
    try {
        console.log("Connecting to TiDB (2026)...");
        const pool = await connectToDb('2026');
        
        console.log("Checking for ANY ranks in MEDICAL_RESULT...");
        const [rows] = await pool.rawPool.query("SELECT STUD_ID, Test, Botany, B_Rank, Zoology, Z_Rank FROM MEDICAL_RESULT WHERE B_Rank IS NOT NULL AND B_Rank != '' AND B_Rank != '0' LIMIT 10");
        
        if (rows.length === 0) {
            console.log("No ranks found in B_Rank column for 2026.");
            const [samples] = await pool.rawPool.query("SELECT STUD_ID, Test, Botany, B_Rank FROM MEDICAL_RESULT LIMIT 5");
            console.log("Sample Data:");
            console.table(samples);
        } else {
            console.log("Found some rows with ranks:");
            console.table(rows);
        }
        process.exit(0);
    } catch (err) {
        console.error("Error:", err.message);
        process.exit(1);
    }
}
check();
