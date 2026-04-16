const { connectToDb } = require('./db');

async function test() {
    try {
        const pool = await connectToDb('2025');
        const res = await pool.request().query("SELECT Top_ALL, COUNT(*) as cnt FROM MEDICAL_RESULT GROUP BY Top_ALL");
        console.log("MEDICAL_RESULT 2025:", res.recordset);
        
        const res2 = await pool.request().query("SELECT Top_ALL, COUNT(*) as cnt FROM ERP_REPORT GROUP BY Top_ALL");
        console.log("ERP_REPORT 2025:", res2.recordset);
    } catch (e) { console.error(e) }
    process.exit(0);
}
test();
