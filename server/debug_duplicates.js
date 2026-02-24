const { connectToDb } = require('./db');
(async () => {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query("SELECT DATE, STR_TO_DATE(DATE, '%d-%m-%Y') as parsed FROM MEDICAL_RESULT WHERE DATE IN ('11-02-2026', '11-02-26') LIMIT 2");
        console.log(JSON.stringify(result.recordset, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
})();
