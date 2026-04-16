const { connectToDb } = require('./db');

async function check() {
    try {
        const pool2026 = await connectToDb('2026');
        console.log('--- 2026 ERP_REPORT ---');
        const res2026 = await pool2026.request().query('SELECT STUD_ID, Test, Q_No, Q_URL, Top_ALL FROM ERP_REPORT LIMIT 5');
        console.table(res2026.recordset);

        const pool2025 = await connectToDb('2025');
        console.log('\n--- 2025 ERP_REPORT ---');
        const res2025 = await pool2025.request().query('SELECT STUD_ID, Test, Q_No, Q_URL, Top_ALL FROM ERP_REPORT LIMIT 5');
        console.table(res2025.recordset);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
