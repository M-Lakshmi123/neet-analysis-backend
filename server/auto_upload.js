const chokidar = require('chokidar');
const fs = require('fs');
const csv = require('csv-parser');
const { connectToDb } = require('./db');
const path = require('path');

// --- CONFIGURATION ---
const WATCH_FOLDER = 'F:/Project files';
const TARGET_FILE = 'MEDICAL_RESULT.csv';
const FILE_PATH = path.join(WATCH_FOLDER, TARGET_FILE);

console.log("-----------------------------------------");
console.log("   NEET DATA AUTO-UPLOADER (TiDB Cloud)  ");
console.log("-----------------------------------------");
console.log(`Watching for file: ${FILE_PATH}`);

// Debounce to avoid double-uploads on save
let isProcessing = false;

// Initialize Watcher
const watcher = chokidar.watch(FILE_PATH, {
    persistent: true,
    awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
    }
});

watcher
    .on('add', processFile)
    .on('change', processFile)
    .on('error', error => console.error(`Watcher error: ${error}`));

async function processFile(path) {
    if (isProcessing) return;
    isProcessing = true;

    console.log(`\n📄 Change detected! Processing: ${path}`);

    const results = [];

    fs.createReadStream(path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            console.log(`Parsed ${results.length} rows from CSV.`);
            if (results.length > 0) {
                await uploadToDB(results);
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

async function uploadToDB(rows) {
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

                // Fix Date Format (DD-MM-YY or DD-MM-YYYY -> YYYY-MM-DD)
                if (key.toUpperCase() === 'DATE' && s.includes('-')) {
                    const parts = s.split('-');
                    if (parts.length === 3) {
                        let d = parseInt(parts[0]);
                        let m = parseInt(parts[1]);
                        let y = parseInt(parts[2]);

                        // Handle 2 digit year (e.g., 25 -> 2025)
                        if (y < 100) y += 2000;

                        // If it looks like DD-MM-YYYY, return YYYY-MM-DD
                        // Basic check: Month must be <= 12, Day <= 31
                        if (m <= 12 && d <= 31) {
                            s = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        }
                    }
                }

                s = s.replace(/'/g, "''"); // SQL Escape
                return `'${s}'`;
            });

            const sql = `INSERT INTO MEDICAL_RESULT (${safeKeys}) VALUES (${values.join(',')})`;

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
