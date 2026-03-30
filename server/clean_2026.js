const { connectToDb } = require('./db');

async function clean2026() {
    try {
        console.log("Cleaning up accidental 2026 data for NST-01...");
        const pool = await connectToDb('2026');
        const [res] = await pool.rawPool.query("DELETE FROM MEDICAL_RESULT WHERE Test = 'NST-01' AND DATE = '20/03/2026'");
        console.log(`Deleted rows from 2026: ${res.affectedRows}`);
        process.exit(0);
    } catch (err) {
        console.error("Scale error:", err);
        process.exit(1);
    }
}

clean2026();
