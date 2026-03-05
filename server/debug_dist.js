const { connectToDb } = require('./db');

async function checkDistribution() {
    try {
        const pool = await connectToDb();

        console.log("\n--- Row counts by Stream and Top_ALL ---");
        const query = `
            SELECT Stream, Top_ALL, COUNT(*) as count 
            FROM MEDICAL_RESULT 
            WHERE Stream IN ('SR_ELITE_SET_01', 'SR_ELITE_SET_02', 'SR ELITE', 'JR ELITE', 'JR AIIMS')
            GROUP BY Stream, Top_ALL
            ORDER BY Stream, Top_ALL
        `;
        const result = await pool.request().query(query);
        console.table(result.recordset);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDistribution();
