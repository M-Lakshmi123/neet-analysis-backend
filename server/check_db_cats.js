const { connectToDb } = require('./db');

async function check() {
    for (const year of ['2025', '2026']) {
        console.log(`\n--- Year ${year} DB ---`);
        const pool = await connectToDb(year);
        const res = await pool.request().query(`
            SELECT DISTINCT Top_ALL FROM MEDICAL_RESULT
            UNION
            SELECT DISTINCT Top_ALL FROM ERP_REPORT
        `);
        console.log(`Categories:`, res.recordset.map(r => r.Top_ALL).filter(Boolean));
    }
    process.exit(0);
}
check();
