const { connectToDb } = require('./db');

async function checkCounts() {
    try {
        const pool = await connectToDb();
        const medRes = await pool.request().query('SELECT COUNT(*) as count FROM MEDICAL_RESULT');
        const erpRes = await pool.request().query('SELECT COUNT(*) as count FROM ERP_REPORT');
        console.log(`MEDICAL_RESULT: ${medRes.recordset[0].count} rows`);
        console.log(`ERP_REPORT: ${erpRes.recordset[0].count} rows`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkCounts();
