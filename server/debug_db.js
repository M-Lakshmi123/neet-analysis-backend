const { connectToDb } = require('./db');

async function test() {
    try {
        const pool = await connectToDb();
        console.log("Connected to DB");

        console.log("\n--- MEDICAL_RESULT Schema (Sample) ---");
        const schema = await pool.request().query("SELECT * FROM MEDICAL_RESULT LIMIT 1");
        console.log(Object.keys(schema.recordset[0]));

        console.log("\n--- Sample Distict Streams ---");
        const streams = await pool.request().query("SELECT DISTINCT Stream FROM MEDICAL_RESULT LIMIT 10");
        console.log(streams.recordset.map(r => r.Stream));

        console.log("\n--- Sample Distict Top_ALL ---");
        const tops = await pool.request().query("SELECT DISTINCT Top_ALL FROM MEDICAL_RESULT LIMIT 10");
        console.log(tops.recordset.map(r => r.Top_ALL));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

test();
