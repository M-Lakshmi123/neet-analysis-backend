const XLSX = require('xlsx');
const path = require('path');
const { connectToDb } = require('./db');
const fs = require('fs');
const readline = require('readline-sync');

const CONFIG_PATH = path.join(__dirname, '..', 'Uploader_Config.xlsx');
const RESULT_DIR = path.join(__dirname, '..', 'Result');
const LOG_PATH = path.join(__dirname, '..', 'Missing_Columns_Log.txt');

async function run() {
    try {
        const manualTestType = process.argv[2] && process.argv[2].trim() !== "" ? process.argv[2].trim() : null;
        const manualTestName = process.argv[3] && process.argv[3].trim() !== "" ? process.argv[3].trim() : null;

        const yearResponse = readline.question(`Enter Academic Year (2025/2026) [Default 2025]: `, { defaultInput: '2025' });
        const year = yearResponse.trim();

        const customHeading = readline.question(`Enter Custom Heading for PDF (Optional): `);


        const pool = await connectToDb(year);
        console.log(`Connected to TiDB (NEET ${year}).`);

        fs.writeFileSync(LOG_PATH, `=== NEET UPLOADER LOG: ${new Date().toLocaleString()} ===\n\n`);

        if (!fs.existsSync(CONFIG_PATH)) {
            console.error("Config file not found: " + CONFIG_PATH);
            process.exit(1);
        }
        const configData = { '2025': {}, '2026': {} };
        const allowedCampuses = new Set();
        const normalizeId = (id) => String(id || '').trim().replace(/[^0-9]/g, '');

        // Load Uploader Config (Top IDs Mapping)
        if (fs.existsSync(CONFIG_PATH)) {
            const configWb = XLSX.readFile(CONFIG_PATH);
            configWb.SheetNames.forEach(sheetName => {
                if (sheetName.toUpperCase().includes('CAMPUS')) return;
                
                const sheet = configWb.Sheets[sheetName];
                const data = XLSX.utils.sheet_to_json(sheet);
                
                const sheetMap = new Map();
                data.forEach(row => {
                    const rowYear = String(row['Year'] || row['YEAR'] || '').trim();
                    if (!configData[rowYear]) return;

                    const idCol = Object.keys(row).find(k => k.toUpperCase().includes('ID') || k.toUpperCase().includes('ADM'));
                    const rawId = idCol ? row[idCol] : (row['STUD_ID'] || row['stud_id'] || Object.values(row)[0]);
                    const nid = normalizeId(rawId);
                    if (!nid) return;

                    const catCol = Object.keys(row).find(k => k.toUpperCase().includes('CATEGORY') || k.toUpperCase().includes('TOP'));
                    const category = String(catCol ? row[catCol] : (row['Category'] || 'TOP')).trim().toUpperCase();
                    
                    sheetMap.set(nid, category);
                });
                
                Object.keys(configData).forEach(y => {
                    if (sheetName.includes(y)) {
                        configData[y][sheetName] = sheetMap;
                    }
                });
            });
            console.log(`[CONFIG] Loaded category mappings for all sheets.`);

            const campusSheet = configWb.Sheets['Allowed_Campuses'];
            if (campusSheet) {
                const data = XLSX.utils.sheet_to_json(campusSheet);
                data.forEach(row => {
                    const name = row['CAMPUS_NAME'] || row['campus_name'] || row['CAMPUS NAME'] || row['CAMPUS'];
                    if (name) allowedCampuses.add(String(name).trim().toUpperCase());
                });
            }
        }

        let totalIds = 0;
        Object.keys(configData).forEach(y => {
            Object.keys(configData[y]).forEach(s => totalIds += configData[y][s].size);
        });
        console.log(`Loaded Config: Total IDs=${totalIds}, Campuses=${allowedCampuses.size}`);

        // Logic to get category based on ID, Year and Stream
        const getMappedCategory = (studentId, studentYear, studentStream) => {
            const normalizedStream = String(studentStream || '').toUpperCase();
            const sid = normalizeId(studentId);
            
            let targetSheet = "";
            if (studentYear === '2025') {
                if (['SR ELITE', 'SR_ELITE_SET_01', 'SR_ELITE_SET_02'].includes(normalizedStream)) {
                    targetSheet = "SR ELITE(2025)";
                } else if (normalizedStream === 'JR ELITE') {
                    targetSheet = "JR ELITE(2025)";
                }
            } else if (studentYear === '2026') {
                if (normalizedStream === 'SR ELITE') {
                    targetSheet = "SR ELITE (2026)";
                }
            }

            // 1. Try Specific Sheet
            if (targetSheet && configData[studentYear] && configData[studentYear][targetSheet] && configData[studentYear][targetSheet].has(sid)) {
                return configData[studentYear][targetSheet].get(sid);
            }

            // 2. Fallback: Check ALL sheets for that year
            const yearSheets = configData[studentYear] || {};
            for (const sName in yearSheets) {
                if (yearSheets[sName].has(sid)) return yearSheets[sName].get(sid);
            }

            return "ALL";
        };

        const files = findResultFiles(RESULT_DIR);
        console.log(`Found ${files.length} result files to process.`);

        let totalUploaded = 0;
        for (const fileObj of files) {
            console.log(`\nProcessing: ${path.basename(fileObj.path)} [Folder: ${fileObj.folder}]`);
            const count = await processResultFile(fileObj.path, fileObj.folder, pool, getMappedCategory, allowedCampuses, year, manualTestType, manualTestName, customHeading);
            totalUploaded += count || 0;
        }


        console.log(`\n========================================================`);
        console.log(`✅ EXECUTION COMPLETE`);
        console.log(`📊 TOTAL STUDENTS UPLOADED: ${totalUploaded}`);
        console.log(`========================================================`);
        console.log(`\nCheck "${path.basename(LOG_PATH)}" for missing column reports.`);
        process.exit(0);
    } catch (err) {
        console.error("Fatal Error:", err);
        process.exit(1);
    }
}

function findResultFiles(dir, parentDir = "") {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            results = results.concat(findResultFiles(fullPath, file));
        } else if ((file.endsWith('.xls') || file.endsWith('.xlsx')) && !file.startsWith('~$')) {
            results.push({ path: fullPath, folder: parentDir });
        }
    });
    return results;
}

function normalizeHeader(h) {
    if (!h) return "";
    return String(h).trim().toUpperCase().replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
}

function cleanCampusName(name) {
    if (!name) return "";
    let cleaned = name.includes('/') ? name.split('/')[1] : name;
    cleaned = cleaned.replace(/PU COLLEGE\s+/i, '');
    cleaned = cleaned.replace(/PUC\s+/i, '');
    cleaned = cleaned.replace(/MARTHAHALLY/i, 'MARTHAHALLI');
    return cleaned.trim();
}

function isKarnatakaCampus(name, allowedCampuses) {
    if (!name) return false;
    const upper = name.toUpperCase().trim();

    // 1. Check if explicitly allowed in Uploader_Config.xlsx
    if (allowedCampuses && allowedCampuses.has(upper)) return true;

    // 2. Check by known Karnataka/Bangalore prefixes
    const keywords = [
        'BEN/', 'BAN/', 'SAR/', 'HUB/', 'DAV/', 'MYS/', 'TUM/',
        'BEL/', 'BAL/', 'MANG/', 'KAR/', 'MAN/', 'BID/', 'KOL/',
        'BAG/', 'GAD/', 'DHAD/', 'HASS/', 'CHI/', 'CHIT/', 'RAI/',
        'BIJ/', 'KOP/', 'YAD/', 'UDU/', 'KOD/', 'HAW/'
    ];
    return keywords.some(k => upper.includes(k));
}

async function processResultFile(filePath, streamFromFolder, pool, getMappedCategory, allowedCampuses, year, manualTestType, manualTestName, customHeading) {

    const wb = XLSX.readFile(filePath);

    // 1. Marks List Sheet
    const marksWs = wb.Sheets['Marks List'];
    if (!marksWs) {
        console.log(`  [SKIP] "Marks List" sheet not found in ${path.basename(filePath)}`);
        return;
    }
    const marksData = XLSX.utils.sheet_to_json(marksWs, { header: 1 });

    // Extract Metadata dynamically (usually row 2, but safely searches top 4 rows)
    let metaStr = '';
    for (let i = 0; i < 4; i++) {
        const cell = marksData[i] && marksData[i][0];
        if (cell && /\d{2}-\d{2}-\d{4}/.test(String(cell))) {
            metaStr = String(cell).trim();
            break;
        }
    }
    
    if (!metaStr) {
        console.log("  [ERROR] Metadata row containing date missing.");
        return;
    }

    let dateStr = '';
    let testName = '';
    let testType = '';

    // 1. Extract Date using Regex
    const dateMatch = metaStr.match(/\b(\d{2}-\d{2}-\d{4})\b/);
    if (dateMatch) {
         dateStr = dateMatch[1].replace(/-/g, '/');
    } else {
         const parts = metaStr.split(/_+/); // fallback split
         dateStr = String(parts[0]).trim().replace(/-/g, '/');
    }

    // 2. Extract or use Manual Test Name/Type
    if (manualTestType && manualTestName) {
        testType = manualTestType;
        testName = manualTestName;
    } else {
        if (metaStr.toUpperCase().includes('SPECIAL GRAND TEST')) {
            const sgMatch = metaStr.match(/SPECIAL GRAND TEST\s*[-_]\s*(\d+)/i);
            if (sgMatch) {
                testName = `NST-${sgMatch[1].padStart(2, '0')}`;
                testType = 'NST';
            } else {
                testName = 'NST-01';
                testType = 'NST';
            }
        } else {
            const testMatch = metaStr.match(/([a-zA-Z]{1,5}[-_]\d{1,3}[a-zA-Z]*)/);
            if (testMatch) {
                testName = testMatch[1];
                testType = testName.split(/[-_]/)[0].trim();
            } else {
                // Fallback: If no regex match, split by '__'
                const parts = metaStr.split('__');
                if (parts.length >= 4) {
                    testName = parts[3].trim();
                    testType = testName.split(/[-_]/)[0].trim();
                } else {
                    console.log("  [ERROR] Metadata test format unrecognized: " + metaStr);
                    return;
                }
            }
        }
    }


    console.log(`  Metadata: Date=[${dateStr}], StreamFolder=[${streamFromFolder}], Test=[${testName}], Type=[${testType}]`);

    // TOP/SUPER mapping lookup is now handled dynamically via getMappedCategory function

    // Determine DB Stream based on folder (Verbatim as per user request)
    let dbStream = streamFromFolder || "Unknown";

    // Identify Headers (Row 4, 5, 6)
    const row4 = marksData[3] || [];
    const row5 = marksData[4] || [];
    const row6 = marksData[5] || [];

    const colMap = {};
    const findInRows = (text, rows) => {
        for (const row of rows) {
            const idx = row.findIndex(h => normalizeHeader(h).includes(normalizeHeader(text)));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    colMap.STUD_ID = findInRows('STUD_ID', [row4]);
    colMap.NAME = findInRows('NAME OF THE STUDENT', [row4]) || findInRows('STUDENT NAME', [row4]);
    colMap.CAMPUS = findInRows('CAMPUS NAME', [row4]) || findInRows('CAMPUS', [row4]);
    colMap.TOT = findInRows('Tot 720', [row5]) || findInRows('TOT', [row5]);
    colMap.AIR = findInRows('AIR', [row5]);
    colMap.BOT = findInRows('Botany', [row5, row6]);
    colMap.ZOO = findInRows('Zoology', [row5, row6]);
    colMap.BIO = findInRows('Biology', [row5, row6]) || findInRows('BIO LOGY', [row5, row6]);
    colMap.PHY = findInRows('Physics', [row5, row6]);
    colMap.CHE = findInRows('Chemistry', [row5, row6]);

    // Rank columns
    const findRankAfter = (idx) => {
        if (idx === -1) return -1;
        // Check next few columns
        for (let i = idx + 1; i < idx + 5 && i < marksData[5].length; i++) {
            const h = normalizeHeader(marksData[5][i]) || normalizeHeader(marksData[4][i]);
            if (h === 'RANK') return i;
        }
        return -1;
    };

    colMap.B_Rank = findRankAfter(colMap.BOT);
    colMap.Z_Rank = findRankAfter(colMap.ZOO);
    colMap.P_Rank = findRankAfter(colMap.PHY);
    colMap.C_Rank = findRankAfter(colMap.CHE);

    // Errors Identification from "NEET(Micro)"
    const errorMap = new Map(); // STUD_ID -> { bot, zoo, phy, che }
    const microWs = wb.Sheets['NEET(Micro)'];
    if (microWs) {
        const microData = XLSX.utils.sheet_to_json(microWs, { header: 1 });
        const mRow4 = microData[3] || [];
        const mRow5 = microData[4] || [];
        const mRow6 = microData[5] || [];

        const mStudIdCol = mRow4.findIndex(h => normalizeHeader(h) === 'STUD_ID');

        const findWQsForSubject = (subjectPattern) => {
            const sIdx = mRow5.findIndex(h => normalizeHeader(h).includes(normalizeHeader(subjectPattern)));
            if (sIdx === -1) return -1;
            // Search for W_Qs in row 6 starting from sIdx
            for (let i = sIdx; i < sIdx + 5 && i < mRow6.length; i++) {
                if (normalizeHeader(mRow6[i]) === 'W_QS') return i;
            }
            return -1;
        };

        const wBot = findWQsForSubject('Bot_Qs');
        const wZoo = findWQsForSubject('Zoo_Qs');
        const wPhy = findWQsForSubject('Phy_Qs');
        const wChe = findWQsForSubject('Che_Qs');

        if (mStudIdCol !== -1) {
            for (let i = 6; i < microData.length; i++) {
                const row = microData[i];
                if (!row || !row[mStudIdCol]) continue;
                errorMap.set(String(row[mStudIdCol]).trim(), {
                    bot: row[wBot] || '',
                    zoo: row[wZoo] || '',
                    phy: row[wPhy] || '',
                    che: row[wChe] || ''
                });
            }
        }
    }

    const studentsToUpload = [];
    // Every excel data start at 7th row (index 6)
    for (let i = 6; i < marksData.length; i++) {
        const row = marksData[i];
        if (!row || !row[colMap.STUD_ID]) continue;

        const rawStudId = String(row[colMap.STUD_ID] || '').trim();
        const studId = rawStudId.replace(/[^0-9]/g, '');
        if (!studId) continue;

        const campusRaw = String(row[colMap.CAMPUS] || '').trim().toUpperCase();

        // Karnataka/Bangalore Filter Logic
        if (!isKarnatakaCampus(campusRaw, allowedCampuses)) continue;

        const cleanedCampus = cleanCampusName(campusRaw);
        const errors = errorMap.get(rawStudId) || errorMap.get(studId) || { bot: '', zoo: '', phy: '', che: '' };

        const student = {
            Test_Type: testType,
            Test: testName,
            DATE: dateStr,
            STUD_ID: studId,
            NAME_OF_THE_STUDENT: String(row[colMap.NAME] || '').trim(),
            CAMPUS_NAME: cleanedCampus,
            Tot_720: row[colMap.TOT],
            AIR: row[colMap.AIR],
            Botany: row[colMap.BOT],
            B_Rank: row[colMap.B_Rank],
            Zoology: row[colMap.ZOO],
            Z_Rank: row[colMap.Z_Rank],
            Biology: row[colMap.BIO],
            Physics: row[colMap.PHY],
            P_Rank: row[colMap.P_Rank],
            Chemistry: row[colMap.CHE],
            C_Rank: row[colMap.C_Rank],
            Stream: dbStream,
            Year: year,
            Errors_Bot: errors.bot,
            Errors_Zoo: errors.zoo,
            Errors_Phy: errors.phy,
            Errors_Che: errors.che
        };

        studentsToUpload.push(student);
    }

    console.log(`  Ready to upload ${studentsToUpload.length} students.`);

    const uploadedCount = await uploadStudents(pool, studentsToUpload, dateStr, testName, year, dbStream, getMappedCategory, customHeading);
    return uploadedCount;
}

async function uploadStudents(pool, studentsToUpload, dateStr, testName, year, dbStream, getMappedCategory, customHeading) {
    if (studentsToUpload.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < studentsToUpload.length; i += batchSize) {
            const batch = studentsToUpload.slice(i, i + batchSize).map(s => {
                // Determine Top_ALL dynamically during upload preparation
                const category = getMappedCategory(s.STUD_ID, year, dbStream);
                return {
                    ...s,
                    Top_ALL: category,
                    Year: year,
                    Custom_Heading: customHeading
                };
            });

            // Delete existing records for these specific students to handle re-uploads
            const studentIds = batch.map(s => `'${s.STUD_ID}'`).join(',');
            const safeTest = testName.replace(/'/g, "''");
            const safeStream = dbStream.replace(/'/g, "''");
            await pool.request().query(`DELETE FROM MEDICAL_RESULT WHERE Test = '${safeTest}' AND DATE = '${dateStr}' AND Stream = '${safeStream}' AND STUD_ID IN (${studentIds})`);

            const values = batch.map(s => {
                const cols = [
                    s.Test_Type, s.Test, s.DATE, s.STUD_ID, s.NAME_OF_THE_STUDENT, s.CAMPUS_NAME,
                    s.Tot_720, s.AIR, s.Botany, s.B_Rank, s.Zoology, s.Z_Rank, s.Biology,
                    s.Physics, s.P_Rank, s.Chemistry, s.C_Rank, s.Stream, s.Year, s.Top_ALL,
                    s.Errors_Bot, s.Errors_Zoo, s.Errors_Phy, s.Errors_Che, s.Custom_Heading
                ].map(v => v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
                return `(${cols.join(',')})`;
            }).join(',');

            const sql = `INSERT INTO MEDICAL_RESULT (
                Test_Type, Test, DATE, STUD_ID, NAME_OF_THE_STUDENT, CAMPUS_NAME,
                Tot_720, AIR, Botany, B_Rank, Zoology, Z_Rank, Biology,
                Physics, P_Rank, Chemistry, C_Rank, Stream, Year, Top_ALL,
                \`Errors In Botany\`, \`Errors In Zoology\`, \`Errors In Physics\`, \`Errors In Chemistry\`,
                Custom_Heading
            ) VALUES ${values}`;

            await pool.request().query(sql);
        }
        console.log(`  ✅ Uploaded ${studentsToUpload.length} students.`);
        return studentsToUpload.length;
    }
    return 0;
}

run();
