const { connectToDb } = require('./db');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function test() {
    console.log("Verifying Table Data...");
    try {
        const pool = await connectToDb();

        // LIMIT 1 is MySQL syntax (which TiDB uses)
        // TOP 1 is MSSQL (which we just replaced)
        // This test verifies BOTH connection AND syntax compatibility
        const result = await pool.request().query('SELECT * FROM MEDICAL_RESULT LIMIT 1');

        if (result.recordset.length > 0) {
            console.log("✅ DATA FOUND! Table 'MEDICAL_RESULT' exists and has data.");
            console.log("Sample:", result.recordset[0]);
        } else {
            console.log("⚠️ Table exists but is EMPTY.");
        }

        process.exit(0);
    } catch (err) {
        console.error("❌ QUERY FAILED:", err.message);
        if (err.message.includes("doesn't exist")) {
            console.error("CRITICAL: The table 'MEDICAL_RESULT' was not found in the TiDB database.");
        }
        process.exit(1);
    }
}

test();
