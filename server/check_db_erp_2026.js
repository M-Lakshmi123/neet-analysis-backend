const { connectToDb } = require('./db');

async function check() {
    try {
        const pool2026 = await connectToDb('2026');
        console.log('--- 2026 ERP_REPORT ---');
        const res2026 = await pool2026.request().query('SELECT STUD_ID, Test, Q_No, Q_URL, Top_ALL FROM ERP_REPORT LIMIT 10');
        console.table(res2026.recordset);

        if (res2026.recordset.length === 0) {
            const count = await pool2026.request().query('SELECT COUNT(*) as count FROM ERP_REPORT');
            console.log('Total count in 2026 ERP_REPORT:', count.recordset[0].count);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
