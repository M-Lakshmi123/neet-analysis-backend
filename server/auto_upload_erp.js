const chokidar = require('chokidar');
const fs = require('fs');
const csv = require('csv-parser');
const { connectToDb } = require('./db');
const path = require('path');

// --- CONFIGURATION ---
const WATCH_FOLDER = 'F:/Project files';
// STRICTLY WATCH ONLY ERP REPORT
const FILES_TO_WATCH = ['Error report.csv'];
const WATCH_PATHS = FILES_TO_WATCH.map(f => path.join(WATCH_FOLDER, f));

console.log("-----------------------------------------");
console.log("      ERP REPORT AUTO-UPLOADER           ");
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

    // STRICTLY ERP REPORT
    let tableName = 'ERP_REPORT';
    const upperName = filename.toUpperCase();

    if (upperName.includes('Error report') || upperName.includes('ERROR REPORT') || upperName.includes('ERP_REPORT')) {
        tableName = 'ERP_REPORT';
    } else {
        // Fallback or ignore
        console.log(`Skipping unknown file: ${filename}`);
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

        // Basic Validation
        const firstRow = rows[0];
        const columns = Object.keys(firstRow).map(c => c.trim());

        if (!columns.includes('STUD_ID')) {
            console.error("❌ ERROR: CSV missing 'STUD_ID' column. Check header names!");
            return;
        }

        for (const row of rows) {
            const keys = Object.keys(row);
            const safeKeys = keys.map(k => `\`${k.trim()}\``).join(',');
            const findKeyIndex = (name) => keys.findIndex(k => k.trim().toUpperCase() === name);
            const studIdIndex = findKeyIndex('STUD_ID');
            // Check for Q_No for duplicates in ERP Report instead of Test? 
            // Or maybe combine STUD_ID + Q_No + Test
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

            // Duplicate Check (Specific for ERP Report)
            // STUD_ID + Test + Q_No should probably be unique for a specific error report entry?
            let isDuplicate = false;
            const studIdVal = studIdIndex !== -1 ? values[studIdIndex] : null;
            const testVal = testIndex !== -1 ? values[testIndex] : null;
            const qNoVal = qNoIndex !== -1 ? values[qNoIndex] : null;

            if (studIdVal) {
                let checkSql = `SELECT 1 FROM ${tableName} WHERE STUD_ID = ${studIdVal}`;
                if (testVal) checkSql += ` AND Test = ${testVal}`;
                if (qNoVal) checkSql += ` AND Q_No = ${qNoVal}`;

                checkSql += ` LIMIT 1`;

                try {
                    const existing = await pool.request().query(checkSql);
                    if (existing.recordset && existing.recordset.length > 0) {
                        isDuplicate = true;
                    }
                } catch (checkErr) { }
            }

            if (isDuplicate) {
                failCount++;
                continue;
            }

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
