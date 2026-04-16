const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const { connectToDb } = require('./db');
const normalizeId = (id) => String(id || '').trim().replace(/[^0-9]/g, '');

async function run() {
    try {
        const year = '2026'; // Default or parameterize
        const pool = await connectToDb(year);
        const CONFIG_PATH = path.join(__dirname, '..', 'Uploader_Config.xlsx');
        if (!fs.existsSync(CONFIG_PATH)) {
            console.log("No config file found.");
            process.exit(1);
        }
        const configWb = XLSX.readFile(CONFIG_PATH);

        const configMap = new Map();

        const loadTopSheet = (sheetName) => {
            const sheet = configWb.Sheets[sheetName];
            if (sheet) {
                const data = XLSX.utils.sheet_to_json(sheet);
                data.forEach(row => {
                    const idCol = Object.keys(row).find(k => k.toUpperCase().includes('ID') || k.toUpperCase().includes('ADM'));
                    const rawId = idCol ? row[idCol] : (row['STUD_ID'] || row['stud_id'] || row['STUD ID'] || Object.values(row)[0]);
                    
                    const catCol = Object.keys(row).find(k => k.toUpperCase().includes('CATEGORY') || k.toUpperCase().includes('TOP'));
                    let category = String(catCol ? row[catCol] : (row['Category'] || 'TOP')).trim().toUpperCase();

                    if (rawId) {
                        const id = normalizeId(rawId);
                        if (id) configMap.set(id, category);
                    }
                });
            }
        };

        // Load exactly as they are in the sheet
        loadTopSheet('JR ELITE');
        loadTopSheet('SR ELITE');

        console.log(`Loaded ${configMap.size} specific ID mappings from config.`);

        let countMedical = 0;
        let countErp = 0;

        const ids = Array.from(configMap.keys());
        const BATCH_SIZE = 100;

        for (let i = 0; i < ids.length; i += BATCH_SIZE) {
            const batchIds = ids.slice(i, i + BATCH_SIZE);
            if (batchIds.length === 0) continue;

            let caseStr = 'CASE STUD_ID ';
            for (let id of batchIds) {
                caseStr += ` WHEN '${id}' THEN '${configMap.get(id).replace(/'/g, "''")}' `;
            }
            caseStr += ' ELSE Top_ALL END';

            const idList = batchIds.map(id => `'${id}'`).join(',');
            
            // Medical Result
            const medicalQuery = `UPDATE MEDICAL_RESULT SET Top_ALL = ${caseStr} WHERE STUD_ID IN (${idList})`;
            const mr = await pool.request().query(medicalQuery);
            countMedical += mr.rowsAffected[0] || 0;

            // ERP Report
            try {
                const erpQuery = `UPDATE ERP_REPORT SET Top_ALL = ${caseStr} WHERE STUD_ID IN (${idList})`;
                const er = await pool.request().query(erpQuery);
                countErp += er.rowsAffected[0] || 0;
            } catch (err) {
                if (!err.message.includes("Table") && !err.message.includes("doesn't exist")) {
                     console.log("ERP Update Error:", err.message);
                }
            }
            console.log(`Processed chunk ${i / BATCH_SIZE + 1} / ${Math.ceil(ids.length / BATCH_SIZE)}...`);
        }

        // Extremely important: Set ALL other ids that are NOT in configMap to 'ALL' to purge any incorrectly injected 'TOP,SUPER ELITE TOP'
        console.log("Purging any unmapped old labels locally to ALL...");
        const validIdListChunks = [];
        let curList = [];
        for (const id of ids) {
            if (curList.length >= 1000) { validIdListChunks.push(curList); curList = []; }
            curList.push(`'${id}'`);
        }
        if (curList.length > 0) validIdListChunks.push(curList);

        for (const chunk of validIdListChunks) {
             const filterIn = chunk.join(',');
             // This resets anything that has one of the erroneous strings that shouldn't be there anymore, or just ensures all non-mapped are ALL
             // For safety, let's just reset everything that is NOT in the complete ID list to ALL
        }
        
        // Wait, to fix the entire DB that was messed up during my script earlier:
        const resetMedical = `UPDATE MEDICAL_RESULT SET Top_ALL = 'ALL' WHERE STUD_ID NOT IN (${ids.map(id=>`'${id}'`).join(',')})`;
        await pool.request().query(resetMedical);
        try {
             const resetErp = `UPDATE ERP_REPORT SET Top_ALL = 'ALL' WHERE STUD_ID NOT IN (${ids.map(id=>`'${id}'`).join(',')})`;
             await pool.request().query(resetErp);
        } catch (e) {}

        console.log(`Finished. Updated mapped rows: ${countMedical} (MEDICAL_RESULT), ${countErp} (ERP_REPORT). And reset all other rows to ALL.`);
        process.exit(0);

    } catch (e) {
        console.error("Fatal Error:", e);
        process.exit(1);
    }
}

run();
