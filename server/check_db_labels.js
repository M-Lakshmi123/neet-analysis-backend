const { connectToDb } = require('./db');
async function run() {
    const pool = await connectToDb('2025');
    const result = await pool.request().query(`
        SELECT STUD_ID, Top_ALL, CAMPUS_NAME, Stream 
        FROM MEDICAL_RESULT 
        WHERE Top_ALL != 'ALL'
        LIMIT 10
    `);
    console.log("NOT ALL:", result.recordset);

    const allResult = await pool.request().query(`
        SELECT STUD_ID, Top_ALL, CAMPUS_NAME, Stream 
        FROM MEDICAL_RESULT 
        LIMIT 10
    `);
    console.log("ANY:", allResult.recordset);
    process.exit(0);
}
run();
