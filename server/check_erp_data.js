const { connectToDb } = require('./db');

async function test() {
    try {
        const pool = await connectToDb('2025');
        const res = await pool.request().query("SELECT DISTINCT Test FROM ERP_REPORT WHERE Top_ALL = 'SUPER JR ELITE TOP' LIMIT 10");
        console.log("Tests with SUPER JR ELITE TOP in ERP_REPORT:", res.recordset);
        
        if (res.recordset.length > 0) {
            const testName = res.recordset[0].Test;
            const res2 = await pool.request().query(`SELECT Student_Name FROM ERP_REPORT WHERE Top_ALL = 'SUPER JR ELITE TOP' AND Test = '${testName}' LIMIT 5`);
            console.log(`Students in ${testName} with label:`, res2.recordset);
        }
    } catch (e) { console.error(e) }
    process.exit(0);
}
test();
