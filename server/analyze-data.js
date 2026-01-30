const { connectToDb } = require('./db');

async function analyzeData() {
    try {
        const pool = await connectToDb();

        // 1. Check distinct Test Types and Streams
        const meta = await pool.request().query(`
            SELECT DISTINCT Test_Type FROM MEDICAL_RESULT;
            SELECT DISTINCT Stream FROM MEDICAL_RESULT;
            SELECT DISTINCT CAMPUS_NAME FROM MEDICAL_RESULT;
        `);
        console.log("--- DISTINCT METADATA ---");
        console.log("Test Types:", meta.recordsets[0]);
        console.log("Streams:", meta.recordsets[1]);

        // 2. Check if students have multiple tests
        // Group by Student ID and count
        const history = await pool.request().query(`
            SELECT TOP 5 STUD_ID, COUNT(*) as TestCount 
            FROM MEDICAL_RESULT 
            GROUP BY STUD_ID 
            ORDER BY TestCount DESC
        `);
        console.log("\n--- STUDENT HISTORY SAMPLE ---");
        console.log(history.recordset);

        // 3. Get one student's full history to verify columns for the "Average Report"
        if (history.recordset.length > 0) {
            const id = history.recordset[0].STUD_ID;
            const studentHistory = await pool.request().query(`
                SELECT Test, DATE, Tot_720, Botany, Zoology, Physics, Chemistry, AIR 
                FROM MEDICAL_RESULT 
                WHERE STUD_ID = ${id}
                ORDER BY DATE
            `);
            console.log(`\n--- HISTORY FOR ID ${id} ---`);
            console.log(studentHistory.recordset);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

analyzeData();
