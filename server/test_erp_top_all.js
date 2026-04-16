const { connectToDb } = require('./db');

async function test() {
    try {
        const pool = await connectToDb('2025');
        const res = await pool.request().query("SELECT Top_ALL, COUNT(*) as cnt FROM ERP_REPORT GROUP BY Top_ALL");
        console.log(res.recordset);
    } catch (e) { console.error(e) }
    process.exit(0);
}
test();
