const { connectToDb } = require('./db');

async function addIndexes() {
    try {
        const pool = await connectToDb();
        console.log("Adding indexes to MEDICAL_RESULT...");
        await pool.request().query('ALTER TABLE MEDICAL_RESULT ADD INDEX idx_campus (CAMPUS_NAME)');
        await pool.request().query('ALTER TABLE MEDICAL_RESULT ADD INDEX idx_test (Test)');
        await pool.request().query('ALTER TABLE MEDICAL_RESULT ADD INDEX idx_stream (Stream)');
        await pool.request().query('ALTER TABLE MEDICAL_RESULT ADD INDEX idx_test_type (Test_Type)');
        await pool.request().query('ALTER TABLE MEDICAL_RESULT ADD INDEX idx_stud_id (STUD_ID)');

        console.log("Adding indexes to ERP_REPORT...");
        await pool.request().query('ALTER TABLE ERP_REPORT ADD INDEX idx_branch (Branch)');
        await pool.request().query('ALTER TABLE ERP_REPORT ADD INDEX idx_test (Test)');
        await pool.request().query('ALTER TABLE ERP_REPORT ADD INDEX idx_stream (Stream)');
        await pool.request().query('ALTER TABLE ERP_REPORT ADD INDEX idx_test_type (Test_Type)');
        await pool.request().query('ALTER TABLE ERP_REPORT ADD INDEX idx_stud_id (STUD_ID)');

        console.log("Indexes added successfully! ✅");
        process.exit(0);
    } catch (err) {
        console.error("Error adding indexes:", err.message);
        process.exit(1);
    }
}

addIndexes();
