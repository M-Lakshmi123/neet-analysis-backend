const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { connectToDb } = require('./db');
const readline = require('readline-sync');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const BASE_DIR = path.join(PROJECT_ROOT, 'ERP_Count_Reports');
const ALT_BASE_DIR = path.join(PROJECT_ROOT, 'ERP Report');
const CONFIG_FILE = path.join(PROJECT_ROOT, 'Uploader_Config.xlsx');

const normalizeId = (id) => String(id || '').trim().replace(/[^0-9]/g, '');

function normalizeCampus(name) {
    if (!name) return '';
    let cleaned = String(name).trim();
    if (cleaned.includes('/')) cleaned = cleaned.split('/')[1];
    cleaned = cleaned.replace(/PU COLLEGE\s+/i, '').replace(/PUC\s+/i, '').trim();
    return cleaned;
}

function formatDateToSQL(dateStr) {
    if (!dateStr) return '01-01-2026';
    const parts = String(dateStr).replace(/\//g, '-').split('-');
    if (parts.length < 3) return String(dateStr);
    let day, month, year;
    if (parts[0].length === 4) {
        year = parts[0]; month = parts[1]; day = parts[2];
    } else {
        day = parts[0]; month = parts[1];
        year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    }
    return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
}

async function ensureTable(pool) {
    const sql = `
        CREATE TABLE IF NOT EXISTS ERP_ERROR_COUNTS (
            id INT AUTO_INCREMENT PRIMARY KEY,
            STUD_ID VARCHAR(50) NOT NULL,
            Student_Name VARCHAR(150),
            Branch VARCHAR(100),
            Exam_Date VARCHAR(50),
            Test_Type VARCHAR(50),
            Test VARCHAR(50),
            Tot_720 INT DEFAULT 0,
            AIR INT DEFAULT 0,
            Botany INT DEFAULT 0,
            B_Rank INT DEFAULT 0,
            Bot_W INT DEFAULT 0,
            Bot_U INT DEFAULT 0,
            Zoology INT DEFAULT 0,
            Z_Rank INT DEFAULT 0,
            Zoo_W INT DEFAULT 0,
            Zoo_U INT DEFAULT 0,
            Physics INT DEFAULT 0,
            P_Rank INT DEFAULT 0,
            Phy_W INT DEFAULT 0,
            Phy_U INT DEFAULT 0,
            Chemistry INT DEFAULT 0,
            C_Rank INT DEFAULT 0,
            Che_W INT DEFAULT 0,
            Che_U INT DEFAULT 0,
            Year VARCHAR(10),
            Top_ALL VARCHAR(50),
            Stream VARCHAR(100),
            Custom_Heading VARCHAR(255),
            UNIQUE KEY uq_student_test (STUD_ID, Test, Stream, Year)
        )
    `;
    await pool.request().query(sql);
}

function findAllExcelFiles(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;

    function search(currentDir) {
        const items = fs.readdirSync(currentDir);
        for (const item of items) {
            if (item === 'PICS') continue;
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                search(fullPath);
            } else if ((item.endsWith('.xls') || item.endsWith('.xlsx')) && !item.startsWith('~$')) {
                const relPath = path.relative(dir, fullPath);
                const pathParts = relPath.split(path.sep);

                let fileYear = null;
                let fileStream = null;
                let fileTest = null;

                if (pathParts[0] === '2025' || pathParts[0] === '2026') {
                    fileYear = pathParts[0];
                    fileStream = pathParts.length > 1 ? pathParts[1] : null;
                    fileTest = pathParts.length > 2 ? pathParts[2] : null;
                } else {
                    fileStream = pathParts.length > 1 ? pathParts[0] : null;
                    fileTest = pathParts.length > 2 ? pathParts[1] : null;
                }

                files.push({ 
                    name: item, 
                    path: fullPath, 
                    yearFolder: fileYear,
                    streamFolder: fileStream,
                    testFolder: fileTest
                });
            }
        }
    }

    search(dir);
    return files;
}

function identifyHeaders(marksData) {
    const colMap = {
        STUD_ID: -1, NAME: -1, CAMPUS: -1, TOT: -1, AIR: -1,
        BOT: -1, B_Rank: -1, ZOO: -1, Z_Rank: -1, PHY: -1, P_Rank: -1, CHE: -1, C_Rank: -1
    };

    const maxCols = Math.max(...marksData.slice(0, 10).map(r => (r ? r.length : 0)));

    for (let col = 0; col < maxCols; col++) {
        let combined = '';
        for (let r = 0; r < Math.min(7, marksData.length); r++) {
            if (marksData[r] && marksData[r][col] !== undefined && marksData[r][col] !== null) {
                combined += ' ' + String(marksData[r][col]).toUpperCase().trim().replace(/[\r\n]/g, ' ');
            }
        }
        const clean = combined.replace(/[\s_.]/g, '');

        if (clean.includes('STUDID') || clean.includes('ADMNO') || clean.includes('STUDENTID')) {
            if (colMap.STUD_ID === -1) colMap.STUD_ID = col;
        }
        if (clean.includes('NAMEOF') || clean.includes('STUDENTNAME') || clean === 'NAME') {
            if (colMap.NAME === -1) colMap.NAME = col;
        }
        if (clean.includes('CAMPUSNAME') || clean.includes('BRANCH') || clean.includes('CENTER')) {
            if (colMap.CAMPUS === -1) colMap.CAMPUS = col;
        }
        if (clean.includes('TOT720') || clean.includes('TOTAL720') || clean.includes('SCORE720')) {
            colMap.TOT = col;
        }
        if (clean.includes('AIR') && !clean.includes('AIRNK') && !clean.includes('AIRANK')) {
            if (colMap.AIR === -1) colMap.AIR = col;
        }
        if (clean.includes('BOTANYM180') || clean.includes('BOTANY180') || clean.includes('BOTANY')) {
            if (colMap.BOT === -1) colMap.BOT = col;
        }
        if (clean.includes('BOTANYRANK') || (colMap.BOT !== -1 && col === colMap.BOT + 1)) {
            if (colMap.B_Rank === -1 && clean.includes('RANK')) colMap.B_Rank = col;
        }
        if (clean.includes('ZOOLOGYM180') || clean.includes('ZOOLOGY180') || clean.includes('ZOOLOGY')) {
            if (colMap.ZOO === -1) colMap.ZOO = col;
        }
        if (clean.includes('ZOOLOGYRANK') || (colMap.ZOO !== -1 && col === colMap.ZOO + 1)) {
            if (colMap.Z_Rank === -1 && clean.includes('RANK')) colMap.Z_Rank = col;
        }
        if (clean.includes('PHYSICSM180') || clean.includes('PHYSICS180') || clean.includes('PHYSICS')) {
            if (colMap.PHY === -1) colMap.PHY = col;
        }
        if (clean.includes('PHYSICSRANK') || (colMap.PHY !== -1 && col === colMap.PHY + 1)) {
            if (colMap.P_Rank === -1 && clean.includes('RANK')) colMap.P_Rank = col;
        }
        if (clean.includes('CHEMISTRYM180') || clean.includes('CHEMISTRY180') || clean.includes('CHEMISTRY')) {
            if (colMap.CHE === -1) colMap.CHE = col;
        }
        if (clean.includes('CHEMISTRYRANK') || (colMap.CHE !== -1 && col === colMap.CHE + 1)) {
            if (colMap.C_Rank === -1 && clean.includes('RANK')) colMap.C_Rank = col;
        }
    }

    if (colMap.STUD_ID === -1) colMap.STUD_ID = 0;
    if (colMap.NAME === -1) colMap.NAME = 1;
    if (colMap.CAMPUS === -1) colMap.CAMPUS = 2;
    if (colMap.TOT === -1) colMap.TOT = 7;
    if (colMap.AIR === -1) colMap.AIR = 8;
    if (colMap.BOT === -1) colMap.BOT = 9;
    if (colMap.B_Rank === -1) colMap.B_Rank = 10;
    if (colMap.ZOO === -1) colMap.ZOO = 19;
    if (colMap.Z_Rank === -1) colMap.Z_Rank = 20;
    if (colMap.PHY === -1) colMap.PHY = 30;
    if (colMap.P_Rank === -1) colMap.P_Rank = 31;
    if (colMap.CHE === -1) colMap.CHE = 43;
    if (colMap.C_Rank === -1) colMap.C_Rank = 44;

    return colMap;
}

function identifyStudErpHeaders(studErpData) {
    const colMap = { STUD_ID: -1, Q_COLS: [] };
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(10, studErpData.length); i++) {
        const row = studErpData[i];
        if (!row) continue;
        if (row.some(c => {
            const s = String(c || '').toUpperCase().trim();
            return s === 'ADM_NO' || s.includes('STUDENT') || s === 'Q1' || s === 'Q2' || s === 'Q3';
        })) {
            headerRowIdx = i;
            break;
        }
    }
    if (headerRowIdx === -1) headerRowIdx = 2;

    const headRow = studErpData[headerRowIdx] || [];
    headRow.forEach((cell, idx) => {
        const val = String(cell || '').trim().toUpperCase();
        if (val.includes('ADM') || val.includes('STUD') || val === 'ID' || val === 'SLNO') {
            if (colMap.STUD_ID === -1) colMap.STUD_ID = idx;
        } else if (/^Q\d+$/i.test(val) || /^Q\.\d+$/i.test(val) || (val.startsWith('Q') && !isNaN(parseInt(val.replace('Q', ''))))) {
            const qNo = val.replace(/[^0-9]/g, '');
            if (qNo) colMap.Q_COLS.push({ col: idx, qNo: parseInt(qNo) });
        }
    });

    if (colMap.STUD_ID === -1) colMap.STUD_ID = 0;
    return colMap;
}

function loadZeroReportSubjectMap(picsSubDir) {
    const mapping = {};
    if (!picsSubDir || !fs.existsSync(picsSubDir)) return mapping;
    const files = fs.readdirSync(picsSubDir);
    const zFile = files.find(f => f.toUpperCase().includes('ZERO') && f.toUpperCase().includes('REPORT') && f.endsWith('.xlsx'));
    if (!zFile) return mapping;

    const wb = XLSX.readFile(path.join(picsSubDir, zFile));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);

    data.forEach(r => {
        const qNo = String(r['Q_No'] || r['QNo'] || r['Q.No'] || r['Q NO'] || '').trim().replace('Q', '');
        if (!qNo) return;
        const subj = String(r['Subject'] || r['SUBJECT'] || '').trim().toUpperCase();
        if (subj && subj !== '--') mapping[qNo] = subj;
    });
    return mapping;
}

function getSubjectForQuestion(qNoStr, zeroReportMap) {
    const q = parseInt(qNoStr);
    if (zeroReportMap[qNoStr]) return zeroReportMap[qNoStr];
    if (zeroReportMap[q]) return zeroReportMap[q];
    if (q >= 1 && q <= 45) return 'BOTANY';
    if (q >= 46 && q <= 90) return 'ZOOLOGY';
    if (q >= 91 && q <= 135) return 'PHYSICS';
    if (q >= 136 && q <= 200) return 'CHEMISTRY';
    return 'BOTANY';
}

async function runCountExtraction() {
    const args = process.argv.slice(2);
    const forcedTest = args.find(a => !a.startsWith('--'));
    const isAutoMode = args.includes('--auto') || !process.stdin.isTTY;

    console.log(`========================================================`);
    console.log(`  ERROR COUNT REPORT GENERATOR (AUTOMATIC UPLOAD)`);
    console.log(`========================================================\n`);

    const pools = {};
    async function getPool(yearStr) {
        const y = yearStr || '2026';
        if (!pools[y]) {
            pools[y] = await connectToDb(y);
            await ensureTable(pools[y]);
            console.log(`[DB] Connected to TiDB Year ${y}`);
        }
        return pools[y];
    }

    const configData = { '2025': {}, '2026': {} };
    if (fs.existsSync(CONFIG_FILE)) {
        const configWb = XLSX.readFile(CONFIG_FILE);
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
        console.log(`[CONFIG] Loaded category mappings from Uploader_Config.xlsx`);
    }

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
            if (normalizedStream === 'SR ELITE' || normalizedStream.includes('SR ELITE')) {
                targetSheet = "SR ELITE (2026)";
            }
        }

        if (targetSheet && configData[studentYear] && configData[studentYear][targetSheet] && configData[studentYear][targetSheet].has(sid)) {
            return configData[studentYear][targetSheet].get(sid);
        }

        const yearSheets = configData[studentYear] || {};
        for (const sName in yearSheets) {
            if (yearSheets[sName].has(sid)) return yearSheets[sName].get(sid);
        }

        return "ALL";
    };

    let files = findAllExcelFiles(BASE_DIR);
    if (files.length === 0) {
        console.log(`[NOTICE] No Excel files found in ${BASE_DIR}. Checking ${ALT_BASE_DIR}...`);
        files = findAllExcelFiles(ALT_BASE_DIR);
    }

    console.log(`\nFound ${files.length} Excel file(s) across folders to process automatically.\n`);

    let totalStudentsUploaded = 0;

    for (let fIdx = 0; fIdx < files.length; fIdx++) {
        const fileObj = files[fIdx];
        console.log(`[${fIdx + 1}/${files.length}] Processing file: ${path.basename(fileObj.path)}`);

        const wb = XLSX.readFile(fileObj.path);

        const marksSheetName = wb.SheetNames.find(n => n.toUpperCase().replace(/\s/g, '') === 'MARKSLIST') || 'Marks List';
        const marksWs = wb.Sheets[marksSheetName];
        if (!marksWs) {
            console.warn(`  [SKIP] 'Marks List' sheet not found in ${fileObj.name}`);
            continue;
        }
        const marksData = XLSX.utils.sheet_to_json(marksWs, { header: 1 });

        let metadataRow = null;
        if (marksData[1]) {
            for (let c = 0; c < 10; c++) {
                const cell = String(marksData[1][c] || '').trim();
                if (cell.includes('_') || cell.match(/\d{2}[-/.]\d{2}[-/.]\d{2,4}/)) {
                    metadataRow = cell; break;
                }
            }
        }
        if (!metadataRow && marksData[0]) {
            for (let c = 0; c < 10; c++) {
                const cell = String(marksData[0][c] || '').trim();
                if (cell.includes('_')) { metadataRow = cell; break; }
            }
        }
        if (!metadataRow) metadataRow = "01-01-2026_SR ELITE_MT-01";

        const parts = String(metadataRow).split('_');
        const rawExamDate = parts[0] ? parts[0].trim().replace(/-/g, '/') : '01/01/2026';

        const currentYear = fileObj.yearFolder || '2026';
        const streamFromMetadata = fileObj.streamFolder || (parts[1] ? parts[1].trim() : "SR ELITE");
        let testName = fileObj.testFolder || forcedTest || (parts[2] ? parts[2].trim() : "MT-01");
        testName = testName.replace(/\s+/g, '').replace(/-+/g, '-');
        const testType = testName.split('-')[0].trim();

        console.log(`  -> Folder Meta: Year=${currentYear}, Stream="${streamFromMetadata}", Test="${testName}"`);

        const pool = await getPool(currentYear);

        const studErpWs = wb.Sheets['STUD_ERP'];
        if (!studErpWs) {
            console.warn(`  [SKIP] 'STUD_ERP' sheet not found in ${fileObj.name}`);
            continue;
        }
        const studErpData = XLSX.utils.sheet_to_json(studErpWs, { header: 1 });

        const picsDir = path.join(ALT_BASE_DIR, 'PICS', streamFromMetadata, testName);
        const zeroReportMap = loadZeroReportSubjectMap(picsDir);

        const marksColMap = identifyHeaders(marksData);
        const studErpColMap = identifyStudErpHeaders(studErpData);

        let startRow = 6;
        for (let i = 0; i < 15; i++) {
            if (marksData[i] && marksData[i][marksColMap.STUD_ID] && !isNaN(parseInt(normalizeId(marksData[i][marksColMap.STUD_ID])))) {
                startRow = i; break;
            }
        }

        const studentRows = [];

        for (let i = startRow; i < marksData.length; i++) {
            const row = marksData[i];
            if (!row || !row[marksColMap.STUD_ID]) continue;

            const rawStudId = String(row[marksColMap.STUD_ID]).trim();
            const studId = normalizeId(rawStudId);
            if (!studId) continue;

            const studentName = String(row[marksColMap.NAME] || '').trim();
            const branchName = normalizeCampus(row[marksColMap.CAMPUS]);

            const configCategory = getMappedCategory(studId, currentYear, streamFromMetadata);
            const targetType = configCategory;

            const erpRowIdx = studErpData.findIndex(r => r && normalizeId(r[studErpColMap.STUD_ID]) === studId);
            if (erpRowIdx === -1) continue;
            const erpRow = studErpData[erpRowIdx];

            let bot_w = 0, bot_u = 0;
            let zoo_w = 0, zoo_u = 0;
            let phy_w = 0, phy_u = 0;
            let che_w = 0, che_u = 0;

            for (const qColObj of studErpColMap.Q_COLS) {
                const val = String(erpRow[qColObj.col] || '').trim().toUpperCase();
                if (val === 'W' || val === 'U') {
                    const qNo = qColObj.qNo;
                    const subj = getSubjectForQuestion(qNo, zeroReportMap);

                    if (subj === 'BOTANY') {
                        if (val === 'W') bot_w++; else bot_u++;
                    } else if (subj === 'ZOOLOGY') {
                        if (val === 'W') zoo_w++; else zoo_u++;
                    } else if (subj === 'PHYSICS') {
                        if (val === 'W') phy_w++; else phy_u++;
                    } else if (subj === 'CHEMISTRY') {
                        if (val === 'W') che_w++; else che_u++;
                    }
                }
            }

            const parseNum = (val) => {
                if (val === undefined || val === null || val === '') return 0;
                const n = parseInt(String(val).replace(/[^0-9]/g, ''));
                return isNaN(n) ? 0 : n;
            };

            studentRows.push({
                STUD_ID: studId,
                Student_Name: studentName,
                Branch: branchName,
                Exam_Date: formatDateToSQL(rawExamDate),
                Test_Type: testType,
                Test: testName,
                Tot_720: parseNum(row[marksColMap.TOT]),
                AIR: parseNum(row[marksColMap.AIR]),
                Botany: parseNum(row[marksColMap.BOT]),
                B_Rank: parseNum(row[marksColMap.B_Rank]),
                Bot_W: bot_w,
                Bot_U: bot_u,
                Zoology: parseNum(row[marksColMap.ZOO]),
                Z_Rank: parseNum(row[marksColMap.Z_Rank]),
                Zoo_W: zoo_w,
                Zoo_U: zoo_u,
                Physics: parseNum(row[marksColMap.PHY]),
                P_Rank: parseNum(row[marksColMap.P_Rank]),
                Phy_W: phy_w,
                Phy_U: phy_u,
                Chemistry: parseNum(row[marksColMap.CHE]),
                C_Rank: parseNum(row[marksColMap.C_Rank]),
                Che_W: che_w,
                Che_U: che_u,
                Year: currentYear,
                Top_ALL: targetType,
                Stream: streamFromMetadata,
                Custom_Heading: null
            });
        }

        const esc = (s) => String(s || '').replace(/'/g, "''");
        let inserted = 0;
        let skipped = 0;

        let existingStudentIds = new Set();
        try {
            const existingRes = await pool.request().query(
                `SELECT CAST(STUD_ID AS CHAR) as id FROM ERP_ERROR_COUNTS WHERE Test = '${esc(testName)}' AND Stream = '${esc(streamFromMetadata)}' AND Year = '${esc(currentYear)}'`
            );
            existingStudentIds = new Set((existingRes.recordset || []).map(r => String(r.id).trim()));
        } catch (e) {
            // Table might be fresh
        }

        for (const s of studentRows) {
            if (existingStudentIds.has(s.STUD_ID)) {
                skipped++;
                continue;
            }

            const query = `
                INSERT INTO ERP_ERROR_COUNTS (
                    STUD_ID, Student_Name, Branch, Exam_Date, Test_Type, Test,
                    Tot_720, AIR, Botany, B_Rank, Bot_W, Bot_U,
                    Zoology, Z_Rank, Zoo_W, Zoo_U, Physics, P_Rank, Phy_W, Phy_U,
                    Chemistry, C_Rank, Che_W, Che_U, Year, Top_ALL, Stream, Custom_Heading
                ) VALUES (
                    '${esc(s.STUD_ID)}', '${esc(s.Student_Name)}', '${esc(s.Branch)}', '${s.Exam_Date}',
                    '${esc(s.Test_Type)}', '${esc(s.Test)}', ${s.Tot_720}, ${s.AIR},
                    ${s.Botany}, ${s.B_Rank}, ${s.Bot_W}, ${s.Bot_U},
                    ${s.Zoology}, ${s.Z_Rank}, ${s.Zoo_W}, ${s.Zoo_U},
                    ${s.Physics}, ${s.P_Rank}, ${s.Phy_W}, ${s.Phy_U},
                    ${s.Chemistry}, ${s.C_Rank}, ${s.Che_W}, ${s.Che_U},
                    '${s.Year}', '${esc(s.Top_ALL)}', '${esc(s.Stream)}', ${s.Custom_Heading ? `'${esc(s.Custom_Heading)}'` : 'NULL'}
                )
            `;
            try {
                await pool.request().query(query);
                inserted++;
            } catch (err) {
                console.error(`  [!] Database error for student ${s.STUD_ID}:`, err.message);
            }
        }

        if (skipped > 0) {
            console.log(`  ⏩ Synced ${inserted} new record(s) (Skipped ${skipped} duplicate student record(s) already in DB).`);
        } else {
            console.log(`  ✅ Synced ${inserted} student record(s) for ${streamFromMetadata} -> ${testName} (Year ${currentYear}).`);
        }
        totalStudentsUploaded += inserted;
    }

    console.log(`\n========================================================`);
    console.log(`✅ AUTOMATIC PROCESS COMPLETE`);
    console.log(`📊 TOTAL STUDENT RECORDS SYNCED ACROSS ALL FOLDERS: ${totalStudentsUploaded}`);
    console.log(`========================================================\n`);
    process.exit(0);
}

runCountExtraction().catch(err => {
    console.error("Fatal Error:", err);
    process.exit(1);
});
