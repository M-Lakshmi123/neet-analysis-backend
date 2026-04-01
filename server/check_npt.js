const { connectToDb } = require('./db');

async function check() {
    try {
        console.log("Connecting to 2026 DB...");
        const pool = await connectToDb('2026');
        
        console.log("Checking for 'NPT(P1)-02' test data...");
        const [rows] = await pool.rawPool.query("SELECT STUD_ID, Botany, B_Rank, Zoology, Z_Rank, Physics, P_Rank, Chemistry, C_Rank FROM MEDICAL_RESULT WHERE Test LIKE '%NPT(P1)-02%' LIMIT 10");
        
        if (rows.length === 0) {
            console.log("No data found for 'NPT(P1)-02'. Let's see some samples from the table.");
            const [samples] = await pool.rawPool.query("SELECT STUD_ID, Test, Botany, B_Rank FROM MEDICAL_RESULT LIMIT 5");
            console.table(samples);
        } else {
            console.log("Data for NPT(P1)-02:");
            console.table(rows);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
