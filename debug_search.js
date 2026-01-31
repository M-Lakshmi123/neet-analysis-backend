const { connectToDb } = require('./server/db');
const fs = require('fs');

(async () => {
    try {
        const pool = await connectToDb();

        const search = "SUC";
        const sql = `
            SELECT * FROM MEDICAL_RESULT 
            WHERE (UPPER(TRIM(NAME_OF_THE_STUDENT)) LIKE '%${search}%' OR UPPER(TRIM(STUD_ID)) LIKE '%${search}%')
            LIMIT 5
        `;

        const res = await pool.request().query(sql);
        const out = `Found ${res.recordset.length} rows.\nExample: ${JSON.stringify(res.recordset[0] || {})}`;
        fs.writeFileSync('debug_search_out.txt', out);

        process.exit(0);
    } catch (e) {
        fs.writeFileSync('debug_search_out.txt', "ERROR: " + e.message);
        process.exit(1);
    }
})();
