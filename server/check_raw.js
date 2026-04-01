const { connectToDb } = require('./db');

async function check() {
    try {
        const pool = await connectToDb('2025');
        const [rows] = await pool.rawPool.query("SELECT STUD_ID, B_Rank, Z_Rank FROM MEDICAL_RESULT WHERE Test LIKE '%NPT(P1)-02%' LIMIT 5");
        console.log("Raw Ranks for NPT(P1)-02 from 2025 DB:");
        rows.forEach(r => console.log(`ID: ${r.STUD_ID}, B_Rank: ${r.B_Rank}, Z_Rank: ${r.Z_Rank}`));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
