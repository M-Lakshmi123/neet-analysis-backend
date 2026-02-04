const chokidar = require('chokidar');
const fs = require('fs');
const csv = require('csv-parser');
const { connectToDb } = require('./db');
const path = require('path');

// --- CONFIGURATION ---
const WATCH_FOLDER = 'F:/Project files';
const FILES_TO_WATCH = ['MEDICAL_RESULT.csv', 'ERP_REPORT.csv', 'Error report.csv'];
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
    const filename = require('path').basename(filePath);

    let tableName = 'MEDICAL_RESULT';
    const upperName = filename.toUpperCase();

    if (upperName.includes('ERP_REPORT') || upperName.includes('ERROR REPORT')) {
        tableName = 'ERP_REPORT';
    } else if (upperName.includes('MEDICAL_RESULT')) {
        tableName = 'MEDICAL_RESULT';
    } else {
        console.log(`Skipping file: ${filename}`);
        isProcessing = false;
        return;
    }

    console.log(`\n📄 Change detected! File: ${filename} -> Table: ${tableName}`);

    // --- Ensure Table Exists for ERP_REPORT ---
    if (tableName === 'ERP_REPORT') {
        try {
            const pool = await connectToDb();
            // Check if table exists
            const checkTableSql = `SHOW TABLES LIKE 'ERP_REPORT'`;
            const tableExists = await pool.request().query(checkTableSql);

            if (!tableExists.recordset || tableExists.recordset.length === 0) {
                console.log("⚠️ Table 'ERP_REPORT' not found. Creating it...");
                const createTableSql = `
                    CREATE TABLE IF NOT EXISTS ERP_REPORT (
                        STUD_ID BIGINT,
                        Student_Name VARCHAR(255),
                        Branch VARCHAR(255),
                        Exam_Date VARCHAR(50),
                        Test_Type VARCHAR(50),
                        Test VARCHAR(100),
                        Tot_720 INT,
                        AIR INT,
                        Botany INT,
                        B_Rank INT,
                        Zoology INT,
                        Z_Rank INT,
                        Physics INT,
                        P_Rank INT,
                        Chemistry INT,
                        C_Rank INT,
                        Q_No INT,
                        W_U VARCHAR(50),
                        National_Wide_Error FLOAT,
                        Q_URL TEXT,
                        S_URL TEXT,
                        Key_Value INT,
                        Subject VARCHAR(100),
                        Topic VARCHAR(255),
                        Sub_Topic VARCHAR(255),
                        Question_Type VARCHAR(50),
                        Statement TEXT,
                        Year INT,
                        Top_ALL VARCHAR(50),
                        Stream VARCHAR(100)
                    )
                `;
                await pool.request().query(createTableSql);
                console.log("✅ Table 'ERP_REPORT' created successfully.");
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
        .on('data', (data) => results.push(data))
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

const CHECKPOINT_FILE = path.join(__dirname, 'upload_checkpoint.json');

async function uploadToDB(rows, tableName, filename) {
    let pool;
    try {
        console.log("Connecting to TiDB...");
        pool = await connectToDb();

        const checkpoints = loadCheckpoint();
        let startIndex = 0;

        // --- RESUME LOGIC ---
        if (process.env.SKIP_RECORDS) {
            startIndex = parseInt(process.env.SKIP_RECORDS);
            console.log(`\n⏭️  Manual Skip: Starting from record ${startIndex} (via env SKIP_RECORDS)...`);
        } else if (checkpoints[filename]) {
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

        const BATCH_SIZE = 50;

        for (let i = startIndex; i < rows.length; i += BATCH_SIZE) {
            const batchRows = rows.slice(i, i + BATCH_SIZE);
            const batchInserts = [];
            const checkConditions = [];
            let safeKeysStr = "";

            // 1. Process Data & Prepare Checks
            for (const row of batchRows) {
                const keys = Object.keys(row);
                if (!safeKeysStr) safeKeysStr = keys.map(k => `\`${k.trim()}\``).join(',');

                const findKeyIndex = (name) => keys.findIndex(k => k.trim().toUpperCase() === name);
                const studIdIndex = findKeyIndex('STUD_ID');
                const qNoIndex = findKeyIndex('Q_NO');
                const testIndex = findKeyIndex('TEST');

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
                        if (/^\d{5}(\.\d+)?$/.test(s)) {
                            try {
                                const serial = parseFloat(s);
                                const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
                                const d = date.getDate();
                                const m = date.getMonth() + 1;
                                const y = date.getFullYear();
                                s = `${String(d).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
                            } catch (e) { }
                        } else if (s.includes('/')) {
                            const parts = s.split('/');
                            if (parts.length === 3) s = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
                        } else if (s.includes('-')) {
                            const parts = s.split('-');
                            if (parts.length === 3) s = `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
                        }
                    }

                    s = s.replace(/'/g, "''");
                    return `'${s}'`;
                });

                const studIdVal = studIdIndex !== -1 ? values[studIdIndex] : null;
                const testVal = testIndex !== -1 ? values[testIndex] : null;
                const qNoVal = qNoIndex !== -1 ? values[qNoIndex] : null;

                if (studIdVal) {
                    let clause = `(STUD_ID = ${studIdVal}`;
                    if (testVal) clause += ` AND Test = ${testVal}`;
                    if (tableName === 'ERP_REPORT' && qNoVal) clause += ` AND Q_No = ${qNoVal}`;
                    clause += `)`;
                    checkConditions.push(clause);
                }

                batchInserts.push(`(${values.join(',')})`);
            }

            // 2. Duplicate Check
            let dbDuplicates = new Set();
            if (checkConditions.length > 0) {
                const checkCols = tableName === 'ERP_REPORT' ? 'STUD_ID, Test, Q_No' : 'STUD_ID, Test';
                const batchCheckSql = `SELECT ${checkCols} FROM ${tableName} WHERE ${checkConditions.join(' OR ')}`;
                try {
                    const existing = await pool.request().query(batchCheckSql);
                    if (existing.recordset) {
                        existing.recordset.forEach(r => {
                            const sId = String(r.STUD_ID).trim();
                            const test = r.Test ? String(r.Test).trim() : 'NULL';
                            const qNo = r.Q_No ? String(r.Q_No).trim() : 'NULL';
                            const key = tableName === 'ERP_REPORT' ? `${sId}|${test}|${qNo}` : `${sId}|${test}`;
                            dbDuplicates.add(key.toUpperCase());
                        });
                    }
                } catch (checkErr) { }
            }

            // 3. Filter and Insert
            let validBatchInserts = [];
            for (let b = 0; b < batchRows.length; b++) {
                const row = batchRows[b];
                const keys = Object.keys(row);
                const getVal = (name) => {
                    const k = keys.find(key => key.trim().toUpperCase() === name);
                    const v = k ? row[k] : null;
                    if (v === null || v === undefined) return 'NULL';
                    let s = String(v).trim();
                    if (/[eE][+-]?\d+$/.test(s) || /^\d+\.\d+$/.test(s)) {
                        try { const n = Number(s); if (!isNaN(n)) s = n.toLocaleString('fullwide', { useGrouping: false }); } catch (e) { }
                    }
                    return s;
                };

                const sId = getVal('STUD_ID');
                const test = getVal('TEST');
                const qNo = getVal('Q_NO');
                const key = tableName === 'ERP_REPORT' ? `${sId}|${test}|${qNo}` : `${sId}|${test}`;

                if (dbDuplicates.has(key.toUpperCase())) {
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
                    process.stdout.write(`B(${successCount}) `);
                } catch (e) {
                    console.error(`\nBatch Insert Failed: ${e.message}`);
                }
            }

            checkpoints[filename] = { lastIndex: (i + batchRows.length - 1), totalRows: rows.length };
            saveCheckpoint(checkpoints);
        }

        console.log(`\n\n✅ Upload Complete!`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed:  ${failCount} (Duplicates or Errors)`);

        if (checkpoints[filename]) {
            delete checkpoints[filename];
            saveCheckpoint(checkpoints);
        }

    } catch (err) {
        console.error("❌ Database Error:", err.message);
    }
}

function loadCheckpoint() {
    try {
        if (fs.existsSync(CHECKPOINT_FILE)) return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
    } catch (e) { }
    return {};
}

function saveCheckpoint(data) {
    try {
        fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(data, null, 2));
    } catch (e) { }
}
