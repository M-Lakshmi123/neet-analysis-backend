
const { connectToDb } = require('./db');
(async () => {
    try {
        const pool = await connectToDb();
        console.log("Connected to DB...");
        const query = `
            SELECT 
                STUD_ID, 
                MAX(Student_Name) as name, 
                Test, 
                SUM(CASE WHEN UPPER(TRIM(Subject)) = 'BOTANY' AND UPPER(TRIM(W_U)) = 'W' THEN 1 ELSE 0 END) as bot_w 
            FROM ERP_REPORT 
            GROUP BY STUD_ID, Test 
            LIMIT 5
        `;
        const result = await pool.request().query(query);
        console.log("Results:", JSON.stringify(result.recordset, null, 2));
    } catch (err) {
        console.error("Query Error:", err);
    }
    process.exit(0);
})();
