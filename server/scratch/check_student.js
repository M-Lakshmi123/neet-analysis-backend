const { connectToDb } = require('../db');

(async () => {
    try {
        const pool = await connectToDb('2026');
        const res = await pool.request().query("SELECT DISTINCT STUD_ID, NAME_OF_THE_STUDENT, CAMPUS_NAME, Stream FROM MEDICAL_RESULT WHERE STUD_ID = '268404326'");
        console.log('Student record:', res.recordset);

        const res2 = await pool.request().query("SELECT DISTINCT CAMPUS_NAME, Stream FROM MEDICAL_RESULT WHERE STUD_ID = '268404326'");
        console.log('Student campus/stream:', res2.recordset);

        const res3 = await pool.request().query("SELECT DISTINCT Stream FROM MEDICAL_RESULT WHERE UPPER(TRIM(CAMPUS_NAME)) LIKE '%ELECTRONIC%'");
        console.log('Electronic City streams in DB:', res3.recordset);

        const res4 = await pool.request().query("SELECT COUNT(DISTINCT STUD_ID) as count FROM MEDICAL_RESULT WHERE UPPER(TRIM(CAMPUS_NAME)) LIKE '%ELECTRONIC%'");
        console.log('Electronic City total students:', res4.recordset);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
