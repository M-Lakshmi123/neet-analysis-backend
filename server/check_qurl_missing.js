const { connectToDb } = require('./db');

async function checkMissingQURL(year) {
    console.log(`\n--- Checking Missing Q_URL for Academic Year ${year} ---`);
    try {
        const pool = await connectToDb(year);
        
        // Query to find unique Test names where Q_URL is missing or empty
        const query = `
            SELECT DISTINCT Test, Test_Type 
            FROM ERP_REPORT 
            WHERE Q_URL IS NULL OR Q_URL = '' OR Q_URL = 'NULL'
            ORDER BY Test DESC
        `;
        
        const result = await pool.request().query(query);
        const missing = result.recordset;
        
        if (missing.length === 0) {
            console.log(`✅ All exams in ${year} have a valid Q_URL.`);
        } else {
            console.log(`❌ Found ${missing.length} tests with missing Q_URL:`);
            missing.forEach((item, index) => {
                console.log(`${index + 1}. [${item.Test_Type}] ${item.Test}`);
            });
        }
    } catch (err) {
        console.error(`Error checking ${year}:`, err.message);
    }
}

async function run() {
    await checkMissingQURL('2025');
    await checkMissingQURL('2026');
    process.exit(0);
}

run();
