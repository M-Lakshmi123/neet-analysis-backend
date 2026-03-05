const { connectToDb } = require('./db');

async function syncSchema() {
    console.log("Starting Schema Sync for 2026 Cluster...");

    try {
        // Connect to 2025 (Source)
        const pool2025 = await connectToDb('2025');
        // Connect to 2026 (Destination)
        const pool2026 = await connectToDb('2026');

        const tablesToSync = ['MEDICAL_RESULT', 'TARGETS'];

        for (const tableName of tablesToSync) {
            console.log(`\nProcessing table: ${tableName}`);

            // 1. Get CREATE TABLE statement from 2025
            const showCreateResult = await pool2025.request().query(`SHOW CREATE TABLE ${tableName}`);
            const createSql = showCreateResult.recordset[0]['Create Table'];

            // 2. Drop table in 2026 if exists
            console.log(`Dropping ${tableName} in 2026 if exists...`);
            await pool2026.request().query(`DROP TABLE IF EXISTS ${tableName}`);

            // 3. Create table in 2026
            console.log(`Creating ${tableName} in 2026...`);
            await pool2026.request().query(createSql);

            console.log(`Successfully synced schema for ${tableName}`);
        }

        console.log("\nSchema Sync Completed Successfully!");
        process.exit(0);
    } catch (err) {
        console.error("\nSchema Sync Failed:");
        console.error(err);
        process.exit(1);
    }
}

syncSchema();
