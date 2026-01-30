const { connectToDb } = require('./db');

async function debugData() {
    try {
        const pool = await connectToDb();
        console.log("Details for MT-01:");
        const result = await pool.request().query("SELECT TOP 5 Test, Test_Type, Stream, CAMPUS_NAME FROM MEDICAL_RESULT WHERE Test = 'MT-01'");
        console.log(JSON.stringify(result.recordset, null, 2));

        console.log("\nDetails for GRAND TEST-01:");
        const result2 = await pool.request().query("SELECT TOP 5 Test, Test_Type, Stream, CAMPUS_NAME FROM MEDICAL_RESULT WHERE Test = 'GRAND TEST-01'");
        console.log(JSON.stringify(result2.recordset, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugData();
