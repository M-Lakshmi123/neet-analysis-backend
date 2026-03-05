const { connectToDb } = require('./db');

async function testCascade() {
    try {
        const pool = await connectToDb();

        const stream = 'SR_ELITE_SET_02';
        console.log(`\n--- Testing Top_ALL for Stream: ${stream} ---`);

        // Mocking the backend logic
        const column = 'Stream';
        const list = `'${stream.toUpperCase()}'`;
        const streamClause = `UPPER(TRIM(${column})) IN (${list})`;

        const topWhere = `WHERE ${streamClause}`;
        const topQuery = `SELECT DISTINCT TRIM(Top_ALL) as Top_ALL FROM MEDICAL_RESULT ${topWhere} AND Top_ALL IS NOT NULL AND Top_ALL != '' ORDER BY Top_ALL`;

        console.log(`Query: ${topQuery}`);
        const result = await pool.request().query(topQuery);
        console.log("Results:");
        console.log(result.recordset.map(r => r.Top_ALL));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

testCascade();
