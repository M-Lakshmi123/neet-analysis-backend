const chokidar = require('chokidar');
const fs = require('fs');
const csv = require('csv-parser');
const { connectToDb } = require('./db');
const path = require('path');

// --- CONFIGURATION ---
const WATCH_FOLDER = 'F:/Project files';
const FILES_TO_WATCH = ['MEDICAL_RESULT.csv', 'ERP_REPORT.csv'];
const WATCH_PATHS = FILES_TO_WATCH.map(f => path.join(WATCH_FOLDER, f));

console.log("-----------------------------------------");
console.log("   NEET DATA AUTO-UPLOADER (TiDB Cloud)  ");
console.log("-----------------------------------------");
console.log(`Watching folder: ${WATCH_FOLDER}`);
console.log(`Files: ${FILES_TO_WATCH.join(', ')}`);

// Debounce to avoid double-uploads on save
let isProcessing = false;

// Initialize Watcher
const watcher = chokidar.watch(WATCH_PATHS, {
    persistent: true,
    awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
    }
});

watcher
    .on('add', (path) => processFile(path))
    .on('change', (path) => processFile(path))
    .on('error', error => console.error(`Watcher error: ${error}`));

async function processFile(filePath) {
    if (isProcessing) return;
    isProcessing = true;

    // Determine Table Name from Filename
    const filename = require('path').basename(filePath); // Safe usage even if shadowed, but better to use require
    // actually 'path' module is top level. But 'filePath' argument avoids shadowing 'path' module if I renamed it.
    // The previous code had 'path' as argument which SHADOWED the module.
    // So I can just use 'path.basename(filePath)' if I rename argument to filePath.

    let tableName = 'MEDICAL_RESULT';
    if (filename.toUpperCase().includes('ERP_REPORT')) {
        tableName = 'ERP_REPORT';
    } else if (filename.toUpperCase().includes('MEDICAL_RESULT')) {
        tableName = 'MEDICAL_RESULT';
    } else {
        console.log(`Skipping file: ${filename}`);
        isProcessing = false;
        return;
    }

    console.log(`\n📄 Change detected! File: ${filename} -> Table: ${tableName}`);

    const results = [];

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            console.log(`Parsed ${results.length} rows from CSV.`);
            if (results.length > 0) {
                await uploadToDB(results, tableName);
            } else {
                console.log("⚠️ File is empty. Skipping.");
            }
            isProcessing = false;
        })
        .on('error', (err) => {
            console.error("Error reading CSV:", err.message);
            isProcessing = false;
        });
}

async function uploadToDB(rows, tableName) {
    let pool;
    try {
        console.log("Connecting to TiDB...");
        pool = await connectToDb();

        console.log(`Starting upload of ${rows.length} records...`);
        let successCount = 0;
        let failCount = 0;

        // BATCH INSERT? Slow but safer to do individually or small batches for errors
        // For speed, let's do individual but async parallel limit? 
        // Or simple loop for reliability first.

        // Let's verify columns first from the first row
        const firstRow = rows[0];
        const columns = Object.keys(firstRow).map(c => c.trim());

        // Basic Validation
        if (!columns.includes('STUD_ID')) {
            console.error("❌ ERROR: CSV missing 'STUD_ID' column. Check header names!");
            return;
        }

        // Prepare INSERT statement dynamically based on CSV headers matching DB columns
        // Note: This assumes CSV headers MATCH Database columns exactly (or close enough)

        for (const row of rows) {
            const keys = Object.keys(row);
            // Wrap keys in backticks to handle spaces in column names
            const safeKeys = keys.map(k => `\`${k.trim()}\``).join(',');

            // Helper for finding index of key case-insensitively
            const findKeyIndex = (name) => keys.findIndex(k => k.trim().toUpperCase() === name);
            const studIdIndex = findKeyIndex('STUD_ID');
            const testIndex = findKeyIndex('TEST');

            const values = Object.values(row).map((v, index) => {
                const key = keys[index];
                if (v === null || v === undefined) return "NULL";
                let s = String(v).trim();
                const upperKey = key.toUpperCase().trim();

                // --- 1. Fix STUD_ID Scientific Notation ---
                if (upperKey === 'STUD_ID') {
                    // Check for scientific notation like 1.23E+10
                    if (/[eE][+-]?\d+$/.test(s) || /^\d+\.\d+$/.test(s)) {
                        // Note: plain floats also caught here to ensure integer string
                        try {
                            const n = Number(s);
                            if (!isNaN(n)) s = n.toLocaleString('fullwide', { useGrouping: false });
                        } catch (e) { }
                    }
                }

                // --- 2. Fix Date Formats (Excel Serial, DD/MM/YYYY, DD-MM-YYYY) ---
                if (upperKey === 'DATE' || upperKey === 'EXAM_DATE') {
                    // Case A: Excel Serial Number (e.g. 45831)
                    if (/^\d{5}(\.\d+)?$/.test(s)) {
                        try {
                            const serial = parseFloat(s);
                            // Excel base date: Dec 30, 1899
                            const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
                            const d = date.getDate();
                            const m = date.getMonth() + 1;
                            const y = date.getFullYear();
                            s = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
                        } catch (e) { console.error("Date Parse Error:", e); }
                    }
                    // Case B: Slash Separated (DD/MM/YYYY)
                    else if (s.includes('/')) {
                        const parts = s.split('/');
                        if (parts.length === 3) {
                            // Assuming DD/MM/YYYY
                            s = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
                        }
                    }
                    // Case C: Hyphen Separated (DD-MM-YYYY) - already correct usually, but ensure padding
                    else if (s.includes('-')) {
                        const parts = s.split('-');
                        if (parts.length === 3) {
                            s = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
                        }
                    }
                }

                s = s.replace(/'/g, "''"); // SQL Escape
                return `'${s}'`;
            });

            // --- 3. Duplicate Check ---
            let isDuplicate = false;

            // Need safely formatted values (they already contain single quotes)
            const studIdVal = studIdIndex !== -1 ? values[studIdIndex] : null;
            const testVal = testIndex !== -1 ? values[testIndex] : null;

            if (studIdVal) {
                let checkSql = `SELECT 1 FROM ${tableName} WHERE STUD_ID = ${studIdVal}`;
                if (testVal) {
                    checkSql += ` AND Test = ${testVal}`;
                }
                checkSql += ` LIMIT 1`;

                try {
                    const existing = await pool.request().query(checkSql);
                    if (existing.recordset && existing.recordset.length > 0) {
                        isDuplicate = true;
                    }
                } catch (checkErr) {
                    // Warning: Table might not have columns yet if empty?
                }
            }

            if (isDuplicate) {
                // Count as failed/skipped
                failCount++;
                continue;
            }

            // Construct INSERT (without Update)
            const sql = `INSERT INTO ${tableName} (${safeKeys}) VALUES (${values.join(',')})`;

            try {
                await pool.request().query(sql);
                successCount++;
                process.stdout.write(".");
            } catch (err) {
                failCount++;
                console.error(`\n[Row Error] STUD_ID: ${row['STUD_ID'] || '?'} - ${err.message}`);
            }
        }

        console.log(`\n\n✅ Upload Complete!`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed:  ${failCount} (Likely duplicates or data errors)`);

    } catch (err) {
        console.error("❌ Database Error:", err.message);
    }
}
