const fs = require('fs');
const path = require('path');
const { connectToDb } = require('./db');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BASE_DIR = path.join(PROJECT_ROOT, 'ERP_Count_Reports');

async function createExactStreamTestFolders() {
    console.log(`========================================================`);
    console.log(`  EXACT STREAM & TEST FOLDER GENERATOR (STRICT DB MATCH)`);
    console.log(`========================================================\n`);

    console.log(`[FOLDERS] Ensuring directory structure in ${BASE_DIR}...`);
    if (!fs.existsSync(BASE_DIR)) {
        fs.mkdirSync(BASE_DIR, { recursive: true });
    }

    const years = ['2026', '2025'];
    let totalFolders = 0;

    for (const year of years) {
        const yrDir = path.join(BASE_DIR, year);
        fs.mkdirSync(yrDir, { recursive: true });

        try {
            console.log(`[DB ${year}] Querying exact Stream and Test pairs from ${year} database...`);
            const pool = await connectToDb(year);
            
            const res = await pool.request().query(`
                SELECT DISTINCT TRIM(Stream) as Stream, TRIM(Test) as Test FROM ERP_REPORT WHERE Stream IS NOT NULL AND Stream != '' AND Test IS NOT NULL AND Test != ''
                UNION
                SELECT DISTINCT TRIM(Stream) as Stream, TRIM(Test) as Test FROM MEDICAL_RESULT WHERE Stream IS NOT NULL AND Stream != '' AND Test IS NOT NULL AND Test != ''
            `);

            const streamMap = {};
            res.recordset.forEach(r => {
                const s = r.Stream;
                const t = r.Test;
                if (!streamMap[s]) streamMap[s] = new Set();
                streamMap[s].add(t);
            });

            const streams = Object.keys(streamMap).sort();
            console.log(`[DB ${year}] Found ${streams.length} stream(s).`);

            streams.forEach(stream => {
                const streamDir = path.join(yrDir, stream);
                fs.mkdirSync(streamDir, { recursive: true });

                const tests = Array.from(streamMap[stream]).sort();
                tests.forEach(test => {
                    const testDir = path.join(streamDir, test);
                    fs.mkdirSync(testDir, { recursive: true });
                    totalFolders++;
                });
                console.log(`   📁 Year ${year} -> Stream "${stream}" (${tests.length} tests): ${tests.join(', ')}`);
            });
        } catch (err) {
            console.warn(`[WARNING] Failed querying ${year} database:`, err.message);
        }
    }

    console.log(`\n✅ [SUCCESS] Created ${totalFolders} exact database matching test folders in: ${BASE_DIR}`);
    console.log(`\nStructure: ERP_Count_Reports -> <YEAR> -> <STREAM> -> <EXACT_TEST>`);
}

createExactStreamTestFolders().then(() => process.exit(0)).catch(err => {
    console.error("Folder creation error:", err);
    process.exit(1);
});
