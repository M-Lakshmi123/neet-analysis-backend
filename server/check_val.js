
const { connectToDb } = require('./db');
(async () => {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query("SELECT * FROM ERP_REPORT WHERE Student_Name LIKE '%DAYANITHA%' AND Test = 'PT-06' AND Q_No = 22 LIMIT 1");
        console.log(JSON.stringify(result.recordset, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
