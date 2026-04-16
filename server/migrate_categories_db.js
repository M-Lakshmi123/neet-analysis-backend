const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { connectToDb } = require('./db');

const CONFIG_PATH = path.join(__dirname, '../Uploader_Config.xlsx');

async function migrate() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error("Config file not found at:", CONFIG_PATH);
        return;
    }

    console.log("Reading Uploader_Config.xlsx...");
    const wb = XLSX.readFile(CONFIG_PATH);
    const updates = { '2025': new Map(), '2026': new Map() };

    wb.SheetNames.forEach(sheetName => {
        if (sheetName.toUpperCase().includes('CAMPUS')) return;
        
        const sheet = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        
        data.forEach(row => {
            const year = String(row['Year'] || row['YEAR'] || '').trim();
            if (!year || !updates[year]) return;

            const idCol = Object.keys(row).find(k => k.toUpperCase().includes('ID') || k.toUpperCase().includes('ADM'));
            const rawId = idCol ? row[idCol] : (row['STUD_ID'] || row['stud_id'] || Object.values(row)[0]);
            const sid = String(rawId || '').trim();
            if (!sid) return;

            const catCol = Object.keys(row).find(k => k.toUpperCase().includes('CATEGORY') || k.toUpperCase().includes('TOP'));
            let category = String(catCol ? row[catCol] : (row['Category'] || 'TOP')).trim().toUpperCase();

            updates[year].set(sid, category);
        });
    });

    for (const year of ['2025', '2026']) {
        const idMap = updates[year];
        if (idMap.size === 0) continue;

        console.log(`\n--- Processing Year ${year} (${idMap.size} IDs found) ---`);
        try {
            const pool = await connectToDb(year);
            let processed = 0;
            const ids = Array.from(idMap.keys());
            
            // We'll process in chunks of 50 to avoid long query strings
            const CHUNK_SIZE = 50;
            for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
                const chunk = ids.slice(i, i + CHUNK_SIZE);
                
                // For each ID in chunk, we update individually for precision
                for(const sid of chunk) {
                    const category = idMap.get(sid);
                    const safeCat = category.replace(/'/g, "''");
                    const safeId = sid.replace(/'/g, "''");

                    // 1. Update MEDICAL_RESULT
                    await pool.request().query(`
                        UPDATE MEDICAL_RESULT 
                        SET Top_ALL = '${safeCat}' 
                        WHERE STUD_ID = '${safeId}' AND Year = '${year}'
                    `);

                    // 2. Update ERP_REPORT
                    await pool.request().query(`
                        UPDATE ERP_REPORT 
                        SET Top_ALL = '${safeCat}' 
                        WHERE STUD_ID = '${safeId}' AND Year = '${year}'
                    `);
                    
                    processed++;
                }
                process.stdout.write(`\rProgress: ${processed}/${idMap.size}...`);
            }
            console.log(`\n✅ Year ${year} updates complete.`);
        } catch (err) {
            console.error(`\n❌ Error processing Year ${year}:`, err.message);
        }
    }

    console.log("\nMigration finished. All existing database records have been synchronized with the latest Category mapping.");
    process.exit(0);
}

migrate();
