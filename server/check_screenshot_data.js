const { connectToDb } = require('./db');

async function check() {
    try {
        const pool = await connectToDb('2025');
        const [rows] = await pool.rawPool.query("SELECT STUD_ID, NAME_OF_THE_STUDENT, AIR, Botany, B_Rank, Zoology, Z_Rank FROM MEDICAL_RESULT WHERE Test LIKE '%NPT(P1)-02%' LIMIT 10");
        console.log("Data for NPT(P1)-02 in 2025 Cluster:");
        console.table(rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
