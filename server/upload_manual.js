const fs = require('fs');
const csv = require('csv-parser');
const { connectToDb } = require('./db');
const path = require('path');

// Look for file in project root or current folder
const FILENAME = 'MEDICAL_RESULT.csv';
const FILE_PATHS = [
    path.join(__dirname, '..', FILENAME), // Project root
    path.join(__dirname, FILENAME),       // Server folder
    'F:/Project files/MEDICAL_RESULT.csv' // Original path
];

async function uploadData() {
    let targetPath = null;
    for (const p of FILE_PATHS) {
        if (fs.existsSync(p)) {
            targetPath = p;
            break;
        }
    }

    if (!targetPath) {
        console.error("❌ ERROR: Could not find 'MEDICAL_RESULT.csv'.");
        console.error("Please place the file in one of these locations:");
        FILE_PATHS.forEach(p => console.error(` - ${p}`));
        process.exit(1);
    }

    console.log(`\n📄 Found data file: ${targetPath}`);
    console.log("Reading CSV...");

    const results = [];
    fs.createReadStream(targetPath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            console.log(`Parsed ${results.length} rows.`);
            if (results.length > 0) {
                await uploadToDB(results);
                process.exit(0);
            } else {
                console.log("⚠️ File is empty.");
                process.exit(1);
            }
        });
}

async function uploadToDB(rows) {
    let pool;
    try {
        console.log("Connecting to Database...");
        pool = await connectToDb();
        console.log("Connected.");

        console.log(`Starting upload of ${rows.length} records...`);
        let successCount = 0;
        let failCount = 0;

        for (const row of rows) {
            // Get columns and values
            const keys = Object.keys(row);
            const safeKeys = keys.map(k => `\`${k.trim()}\``).join(',');

            const values = Object.values(row).map((v, index) => {
                const key = keys[index];
                if (v === null || v === undefined) return "NULL";
                let s = String(v).trim();

                // Fix Date Format if needed (DD-MM-YYYY -> YYYY-MM-DD)
                if (key.toUpperCase().includes('DATE') && s.includes('-')) {
                    const parts = s.split('-');
                    if (parts.length === 3) {
                        let d = parseInt(parts[0]);
                        let m = parseInt(parts[1]);
                        let y = parseInt(parts[2]);
                        if (y < 100) y += 2000;
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
                if (successCount % 100 === 0) process.stdout.write(".");
            } catch (err) {
                failCount++;
                // console.error("Row Error:", err.message);
            }
        }

        console.log(`\n\n✅ Upload Complete!`);
        console.log(`Saved: ${successCount}`);
        console.log(`Failed: ${failCount} (Duplicates or Errors)`);
    } catch (err) {
        console.error("❌ Fatal DB Error:", err);
    }
}

uploadData();
