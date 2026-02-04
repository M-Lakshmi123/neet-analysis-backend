const chokidar = require('chokidar');
const fs = require('fs');
const csv = require('csv-parser');
const { connectToDb } = require('./db');
const path = require('path');
const CHECKPOINT_FILE = path.join(__dirname, 'upload_checkpoint_medical.json');

// --- CONFIGURATION ---
const WATCH_FOLDER = 'F:/Project files';
// STRICTLY WATCH ONLY MEDICAL RESULTS
const FILES_TO_WATCH = ['MEDICAL_RESULT.csv', 'Medical Result.csv'];
const WATCH_PATHS = FILES_TO_WATCH.map(f => path.join(WATCH_FOLDER, f));

console.log("-----------------------------------------");
console.log("   MEDICAL RESULT AUTO-UPLOADER          ");
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
    const filename = require('path').basename(filePath);

    // STRICTLY MEDICAL RESULT
    let tableName = 'MEDICAL_RESULT';
    const upperName = filename.toUpperCase();

    // Just to be safe, though pattern matching above handles it
    if (upperName.includes('MEDICAL') || upperName.includes('RESULT')) {
        tableName = 'MEDICAL_RESULT';
    } else {
        // Fallback or ignore
        console.log(`Skipping unknown file: ${filename}`);
        isProcessing = false;
        return;
    }

    console.log(`\n📄 Change detected! File: ${filename} -> Table: ${tableName}`);

    // --- Ensure Table Exists for MEDICAL_RESULT ---
    if (tableName === 'MEDICAL_RESULT') {
        try {
            const pool = await connectToDb();
            // Check if table exists
            const checkTableSql = `SHOW TABLES LIKE 'MEDICAL_RESULT'`;
            const tableExists = await pool.request().query(checkTableSql);

            if (!tableExists.recordset || tableExists.recordset.length === 0) {
                console.log("⚠️ Table 'MEDICAL_RESULT' not found. Creating it...");
                const createTableSql = `
                    CREATE TABLE IF NOT EXISTS MEDICAL_RESULT (
                        Test_Type VARCHAR(50),
                        Test VARCHAR(255),
                        DATE VARCHAR(50),
                        STUD_ID VARCHAR(255),
                        NAME_OF_THE_STUDENT VARCHAR(255),
                        CAMPUS_NAME VARCHAR(255),
                        Tot_720 VARCHAR(50),
                        AIR VARCHAR(50),
                        Botany VARCHAR(50),
                        B_Rank VARCHAR(50),
                        Zoology VARCHAR(50),
                        Z_Rank VARCHAR(50),
                        Biology VARCHAR(50),
                        Physics VARCHAR(50),
                        P_Rank VARCHAR(50),
                        Chemistry VARCHAR(50),
                        C_Rank VARCHAR(50),
                        Stream VARCHAR(100),
                        Year VARCHAR(50),
                        Top_ALL VARCHAR(50),
                        \`Errors In Botany\` TEXT,
                        \`Errors In Zoology\` TEXT,
                        \`Errors In Physics\` TEXT,
                        \`Errors In Chemistry\` TEXT
                    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
                `;
                await pool.request().query(createTableSql);
                console.log("✅ Table 'MEDICAL_RESULT' created successfully.");
            }
        } catch (err) {
            console.error("❌ Error ensuring table existence:", err.message);
            isProcessing = false;
            return;
        }
    }

    const results = [];

    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
            // Filter out empty rows (Excel sometimes exports thousands of empty rows with delimiters)
            const hasData = Object.values(data).some(val => val && String(val).trim().length > 0);
            if (hasData) {
                results.push(data);
            }
        })
        .on('end', async () => {
            console.log(`Parsed ${results.length} rows from CSV.`);
            if (results.length > 0) {
                await uploadToDB(results, tableName, filename);
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

async function uploadToDB(rows, tableName, filename) {
    let pool;
    try {
        console.log("Connecting to TiDB...");
        pool = await connectToDb();

        const checkpoints = loadCheckpoint();
        let startIndex = 0;

        // --- RESUME LOGIC ---
        // 1. Manual override via Environment Variable
        if (process.env.SKIP_RECORDS) {
            startIndex = parseInt(process.env.SKIP_RECORDS);
            console.log(`\n⏭️  Manual Skip: Starting from record ${startIndex} (via env SKIP_RECORDS)...`);
        }
        // 2. Checkpoint Resume
        else if (checkpoints[filename]) {
            if (checkpoints[filename].totalRows !== rows.length) {
                console.log(`⚠️ Note: CSV row count changed (${checkpoints[filename].totalRows} -> ${rows.length}).`);
            }
            startIndex = checkpoints[filename].lastIndex + 1;
            console.log(`\n🔄 Resuming upload for '${filename}' from row ${startIndex + 1} (skipping ${startIndex} rows)...`);
        } else {
            console.log(`Starting upload of ${rows.length} records...`);
        }

        let successCount = 0;
        let failCount = 0;

        // Basic Validation
        const firstRow = rows[0];
        const columns = Object.keys(firstRow).map(c => c.trim());

        if (!columns.includes('STUD_ID')) {
            console.error("❌ ERROR: CSV missing 'STUD_ID' column. Check header names!");
            return;
        }

        const BATCH_SIZE = 50; // Upload in batches to save RUs

        for (let i = startIndex; i < rows.length; i += BATCH_SIZE) {
            const batchRows = rows.slice(i, i + BATCH_SIZE);
            const batchInserts = [];
            const checkConditions = [];
            let safeKeysStr = ""; // Store one instance of keys for the INSERT statement

            // 1. Process Data & Prepare Checks
            for (const row of batchRows) {
                const keys = Object.keys(row);
                if (!safeKeysStr) safeKeysStr = keys.map(k => `\`${k.trim()}\``).join(',');

                const findKeyIndex = (name) => keys.findIndex(k => k.trim().toUpperCase() === name);
                const studIdIndex = findKeyIndex('STUD_ID');
                const testIndex = findKeyIndex('TEST');
                // No Q_No in Medical Result usually, just Test based

                const values = Object.values(row).map((v, index) => {
                    const key = keys[index];
                    if (v === null || v === undefined) return "NULL";
                    let s = String(v).trim();
                    const upperKey = key.toUpperCase().trim();

                    if (upperKey === 'STUD_ID') {
                        if (/[eE][+-]?\d+$/.test(s) || /^\d+\.\d+$/.test(s)) {
                            try {
                                const n = Number(s);
                                if (!isNaN(n)) s = n.toLocaleString('fullwide', { useGrouping: false });
                            } catch (e) { }
                        }
                    }
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

                // Duplicate Logic Preparation
                const studIdVal = studIdIndex !== -1 ? values[studIdIndex] : null;
                const testVal = testIndex !== -1 ? values[testIndex] : null;

                if (studIdVal) {
                    let clause = `(STUD_ID = ${studIdVal}`;
                    if (testVal) clause += ` AND Test = ${testVal}`;
                    // Unique Logic: STUD_ID + Test is unique for Medical Result
                    clause += `)`;
                    checkConditions.push(clause);
                }

                batchInserts.push(`(${values.join(',')})`);
            }

            // 2. Optimized Duplicate Check & Insert
            let dbDuplicates = new Set();
            if (checkConditions.length > 0) {
                // Fetch all matching records for this batch in one go
                const batchCheckSql = `SELECT STUD_ID, Test FROM ${tableName} WHERE ${checkConditions.join(' OR ')}`;
                try {
                    const existing = await pool.request().query(batchCheckSql);
                    if (existing.recordset) {
                        existing.recordset.forEach(r => {
                            // Normalize keys for comparison
                            const sId = String(r.STUD_ID).trim();
                            const test = r.Test ? String(r.Test).trim() : 'NULL';
                            const key = `${sId}|${test}`.toUpperCase();
                            dbDuplicates.add(key);
                        });
                    }
                } catch (checkErr) {
                    console.error("Batch Check Warning:", checkErr.message);
                }
            }

            // 3. Filter and Insert
            let validBatchInserts = [];
            let duplicatesInBatch = 0;

            for (let b = 0; b < batchRows.length; b++) {
                const row = batchRows[b];
                const keys = Object.keys(row);

                const getVal = (name) => {
                    const k = keys.find(key => key.trim().toUpperCase() === name);
                    return k ? row[k] : null;
                };

                const clean = (v) => {
                    if (v === null || v === undefined) return 'NULL';
                    let s = String(v).trim();
                    if (/[eE][+-]?\d+$/.test(s) || /^\d+\.\d+$/.test(s)) {
                        try { const n = Number(s); if (!isNaN(n)) s = n.toLocaleString('fullwide', { useGrouping: false }); } catch (e) { }
                    }
                    return s;
                };

                const sIdRaw = clean(getVal('STUD_ID'));
                const testRaw = clean(getVal('TEST'));
                // Medical Table uses STUD_ID + TEST combination for uniqueness

                const key = `${sIdRaw}|${testRaw}`.toUpperCase();

                if (dbDuplicates.has(key)) {
                    duplicatesInBatch++;
                    failCount++;
                } else {
                    validBatchInserts.push(batchInserts[b]);
                }
            }

            if (validBatchInserts.length > 0) {
                const sql = `INSERT INTO ${tableName} (${safeKeysStr}) VALUES ${validBatchInserts.join(',')}`;
                try {
                    await pool.request().query(sql);
                    successCount += validBatchInserts.length;
                    process.stdout.write(`B(${successCount}) `); // Batch indicator with running total
                } catch (e) {
                    console.error(`\nBatch Insert Failed: ${e.message}`);
                }
            }

            // Save Checkpoint after every batch
            checkpoints[filename] = { lastIndex: (i + batchRows.length - 1), totalRows: rows.length };
            saveCheckpoint(checkpoints);
        }
        console.log(`\n\n✅ Upload Complete!`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed:  ${failCount} (Likely duplicates or data errors)`);

        // Clear checkpoint on completion
        if (checkpoints[filename]) {
            delete checkpoints[filename];
            saveCheckpoint(checkpoints);
        }

    } catch (err) {
        console.error("❌ Database Error:", err.message);
    }
}

// --- Checkpoint Helpers ---
function loadCheckpoint() {
    try {
        if (fs.existsSync(CHECKPOINT_FILE)) {
            return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
        }
    } catch (e) { return {}; }
    return {};
}

function saveCheckpoint(data) {
    try {
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
    } catch (e) { }
}
