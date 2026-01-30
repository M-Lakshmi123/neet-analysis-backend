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

            const values = Object.values(row).map((v, index) => {
                const key = keys[index];
                if (v === null || v === undefined) return "NULL";
                let s = String(v).trim();

                // Fix STUD_ID Scientific Notation (e.g. 1.23E+10 -> 12300000000)
                if (key.toUpperCase() === 'STUD_ID') {
                    // Check if it looks like scientific notation
                    if (/[eE][+-]?\d+$/.test(s)) {
                        try {
                            // Use BigInt or toLocaleString to verify
                            const n = Number(s);
                            if (!isNaN(n)) {
                                s = n.toLocaleString('fullwide', { useGrouping: false });
                            }
                        } catch (e) { /* ignore */ }
                    }
                }

                // Format Date to DD-MM-YYYY (User requested format in DB)
                // Appy to 'DATE' or 'Exam_Date'
                const upperKey = key.toUpperCase();
                if ((upperKey === 'DATE' || upperKey === 'EXAM_DATE') && s.includes('-')) {
                    const parts = s.split('-');
                    if (parts.length === 3) {
                        let d = parseInt(parts[0]);
                        let m = parseInt(parts[1]);
                        let y = parseInt(parts[2]);

                        // Handle 2 digit year (e.g., 25 -> 2025)
                        if (y < 100) y += 2000;

                        if (m <= 12 && d <= 31) {
                            // Storing as DD-MM-YYYY per user request
                            s = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
                        }
                    }
                }

                s = s.replace(/'/g, "''"); // SQL Escape
                return `'${s}'`;
            });

            const sql = `INSERT INTO ${tableName} (${safeKeys}) VALUES (${values.join(',')})`;

            try {
                await pool.request().query(sql);
                successCount++;
                process.stdout.write("."); // Progress dot
            } catch (err) {
                failCount++;
                // process.stdout.write("x");
                // console.error("\nFailed Row:", row['STUD_ID'], err.message);
            }
        }

        console.log(`\n\n✅ Upload Complete!`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed:  ${failCount} (Likely duplicates or data errors)`);

    } catch (err) {
        console.error("❌ Database Error:", err.message);
    }
}
