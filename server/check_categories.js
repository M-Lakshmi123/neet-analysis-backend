const { connectToDb } = require('./db');

async function check() {
    try {
        const pool2025 = await connectToDb('2025');
        console.log('--- 2025 Distinct Top_ALL ---');
        const res2025 = await pool2025.request().query('SELECT DISTINCT Top_ALL FROM MEDICAL_RESULT');
        console.table(res2025.recordset);
        
        const res2025erp = await pool2025.request().query('SELECT DISTINCT Top_ALL FROM ERP_REPORT');
        console.log('--- 2025 Distinct Top_ALL (ERP) ---');
        console.table(res2025erp.recordset);

        const pool2026 = await connectToDb('2026');
        console.log('\n--- 2026 Distinct Top_ALL ---');
        const res2026 = await pool2026.request().query('SELECT DISTINCT Top_ALL FROM MEDICAL_RESULT');
        console.table(res2026.recordset);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
