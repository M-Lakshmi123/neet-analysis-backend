const { connectToDb } = require('../db');

(async () => {
    try {
        const pool = await connectToDb('2026');
        const count = await pool.request().query("SELECT COUNT(*) as count FROM ERP_REPORT WHERE UPPER(TRIM(Branch)) LIKE '%ELECTRONIC%' AND (UPPER(TRIM(W_U)) = 'W' OR UPPER(TRIM(W_U)) = 'U')");
        console.log('ERP wrong/unattempted rows count:', count.recordset);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
