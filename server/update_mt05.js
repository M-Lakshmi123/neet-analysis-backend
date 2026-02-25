const { connectToDb } = require('./db');

async function run() {
    try {
        const pool = await connectToDb();
        console.log("Checking records for MT-05 with stream 'JR ELITE & AIIMS'...");
        const resBefore = await pool.request().query("SELECT COUNT(*) as count FROM MEDICAL_RESULT WHERE Stream = 'JR ELITE & AIIMS' AND Test = 'MT-05'");
        console.log('Count before:', resBefore.recordset[0].count);

        await pool.request().query("UPDATE MEDICAL_RESULT SET Stream = 'JR ELITE' WHERE Stream = 'JR ELITE & AIIMS' AND Test = 'MT-05'");
        console.log('Update executed.');

        const resAfter = await pool.request().query("SELECT COUNT(*) as count FROM MEDICAL_RESULT WHERE Stream = 'JR ELITE' AND Test = 'MT-05'");
        console.log('Count for JR ELITE now:', resAfter.recordset[0].count);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
