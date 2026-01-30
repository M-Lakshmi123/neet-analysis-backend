const { connectToDb } = require('./db');

async function checkSchema() {
    try {
        const pool = await connectToDb();
        const result = await pool.request().query(`
            SELECT 
                COLUMN_NAME, 
                DATA_TYPE, 
                CHARACTER_MAXIMUM_LENGTH 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'MEDICAL_RESULT'
            AND COLUMN_NAME IN ('CAMPUS_NAME', 'Stream', 'Test_Type', 'Test', 'STUD_ID', 'Tot_720')
        `);
        result.recordset.forEach(row => {
            console.log(`${row.COLUMN_NAME}: ${row.DATA_TYPE}(${row.CHARACTER_MAXIMUM_LENGTH})`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
