const { connectToDb } = require('./db');
async function run() {
    const pool = await connectToDb('2026');
    const result = await pool.request().query(`
        SELECT COUNT(*) as c FROM ERP_REPORT 
    `);
    console.log("Total in ERP_REPORT 2026:", result.recordset);

    const namesResult = await pool.request().query(`
        SELECT DISTINCT Student_Name FROM ERP_REPORT LIMIT 20
    `);
    console.log("Some names in 2026:", namesResult.recordset);

    const matchResult = await pool.request().query(`
        SELECT COUNT(*) as c FROM ERP_REPORT WHERE UPPER(TRIM(Student_Name)) IN ('ABHIRAM M', 'AVANEESH C CHINIWAL')
    `);
    console.log("Matches for top students:", matchResult.recordset);

    process.exit(0);
}
run();
