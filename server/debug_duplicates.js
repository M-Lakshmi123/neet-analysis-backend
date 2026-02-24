const { connectToDb } = require('./db');
(async () => {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query("SELECT DISTINCT Stream FROM MEDICAL_RESULT WHERE STUD_ID = '257400127'");
        console.log(JSON.stringify(result.recordset, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
})();
