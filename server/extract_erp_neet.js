const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { connectToDb } = require('./db');
const readline = require('readline-sync');

// --- Configuration ---
const ERP_BASE_DIR = 'f:\\Projects\\NEET Analysis\\ERP Report';
const CONFIG_FILE = 'f:\\Projects\\NEET Analysis\\Uploader_Config.xlsx';
const DEFAULT_S_URL = 'https://i.ibb.co/p6D1ywtP/No-Name.png';

const normalizeId = (id) => String(id || '').trim().replace(/[^0-9]/g, '');
const normalizeForMatch = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function processErp() {
    const args = process.argv.slice(2);
    const forcedTest = args[0];
    const forcedType = args[1];

    if (forcedTest && forcedType) {
        console.log(`[MANUAL] Forcing Test: ${forcedTest}, Type: ${forcedType}`);
    }

    let pool;
    try {
        const yearResponse = readline.question(`Enter Academic Year (2025/2026) [Default 2025]: `, { defaultInput: '2025' });
        const year = yearResponse.trim();

        console.log(`\nExtraction Modes:`);
        console.log(`1. TOP (Includes TOP, SUPER ELITE TOP, SUPER JR ELITE TOP)`);
        console.log(`2. ALL (Excludes TOP categories)`);
        console.log(`3. Both (Uploads everyone with their respective labels)`);
        const modeChoice = readline.question(`Select Extraction Mode (1/2/3) [Default 3]: `, { defaultInput: '3' });
        
        const customHeading = readline.question(`Enter Custom Heading (Optional, leave blank to use default): `);

        let modeArg = 'BOTH';
        if (modeChoice === '1') modeArg = 'TOP';
        else if (modeChoice === '2') modeArg = 'ALL';

        pool = await connectToDb(year);
        console.log(`Connected to TiDB (NEET ERP Extraction - Year ${year}, Mode: ${modeArg}${customHeading ? `, Heading: ${customHeading}` : ''})`);

        // Categories considered as "TOP"
        const TOP_CATEGORIES = ['TOP', 'SUPER ELITE TOP', 'SUPER JR ELITE TOP'];

        const configData = { '2025': {}, '2026': {} };
        const normalizeId = (id) => String(id || '').trim().replace(/[^0-9]/g, '');

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
            console.log(`[CONFIG] Loaded category mappings for all sheets.`);
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
                if (normalizedStream === 'SR ELITE') {
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

        // 2. Load ImgBB Mapping
        let urlMapping = { mappings: {} };
        const mappingPath = path.join(__dirname, 'url_mapping_neet.json');
        if (fs.existsSync(mappingPath)) {
            try {
                urlMapping = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
                console.log(`[URLS] Loaded ImgBB URL mappings.`);
            } catch (e) {
                console.warn(`[WARNING] Could not parse ${mappingPath}. File might be corrupted. Using empty mappings.`);
                urlMapping = { mappings: {} };
            }
        }

        let allFiles = fs.readdirSync(ERP_BASE_DIR).map(f => ({ name: f, path: path.join(ERP_BASE_DIR, f) }));
        
        // Also look inside PICS folder if it exists
        const picsDir = path.join(ERP_BASE_DIR, 'PICS');
        if (fs.existsSync(picsDir)) {
            const picsFiles = fs.readdirSync(picsDir).map(f => ({ name: f, path: path.join(picsDir, f) }));
            allFiles = [...allFiles, ...picsFiles];
        }

        const erpFiles = allFiles.filter(f => (f.name.endsWith('.xlsx') || f.name.endsWith('.xls')) && !f.name.startsWith('~$'));

        console.log(`[FILES] Found ${erpFiles.length} ERP files to process.`);

        for (const erpObj of erpFiles) {
            const erpFile = erpObj.name;
            const fullPath = erpObj.path;
            console.log(`\nProcessing ERP File: ${erpFile}`);
            const wb = XLSX.readFile(fullPath);

            // A. Find 'Marks List' case-insensitively
            const marksSheetName = wb.SheetNames.find(n => n.toUpperCase().replace(/\s/g, '') === 'MARKSLIST') || 'Marks List';
            const marksWs = wb.Sheets[marksSheetName];
            if (!marksWs) {
                console.warn(`  [SKIP] 'Marks List' sheet (or variation) not found in ${erpFile}`);
                continue;
            }
            const marksData = XLSX.utils.sheet_to_json(marksWs, { header: 1 });

            // Extract Metadata from row 2 (index 1) for Date
            // Search row 2 (index 1) across first 10 columns for a string containing an underscore or date
            let metadataRow = null;
            if (marksData[1]) {
                for (let c = 0; c < 10; c++) {
                    const cell = String(marksData[1][c] || '').trim();
                    if (cell.includes('_') || cell.match(/\d{2}[-/.]\d{2}[-/.]\d{2,4}/)) {
                        metadataRow = cell;
                        break;
                    }
                }
            }
            if (!metadataRow && marksData[0]) { // fallback to row 1
                for (let c = 0; c < 10; c++) {
                    const cell = String(marksData[0][c] || '').trim();
                    if (cell.includes('_')) { metadataRow = cell; break; }
                }
            }
            if (!metadataRow) {
                console.warn(`  [ERROR] Row 2 metadata missing in ${erpFile}`);
                continue;
            }
            const parts = String(metadataRow).split('_');
            const rawExamDate = parts[0] ? parts[0].trim().replace(/-/g, '/') : '01/01/2025';

            // Auto-detect Stream and Test
            let streamFromMetadata = "UNKNOWN_STREAM";
            let testName = forcedTest || "SGT-01"; 

            if (true) {
                const picsBaseDir = path.join(ERP_BASE_DIR, 'PICS');
                if (fs.existsSync(picsBaseDir)) {
                    const streams = fs.readdirSync(picsBaseDir).filter(f => fs.statSync(path.join(picsBaseDir, f)).isDirectory());

                    // Match stream from metadata row or erpFile name
                    const searchStringNorm = normalizeForMatch(String(metadataRow) + " " + erpFile);
                    const matchedStream = streams.find(s => searchStringNorm.includes(normalizeForMatch(s)));

                    if (matchedStream) {
                        streamFromMetadata = matchedStream;
                        const streamPath = path.join(picsBaseDir, streamFromMetadata);
                        const tests = fs.readdirSync(streamPath).filter(f => fs.statSync(path.join(streamPath, f)).isDirectory());

                        // Match test name (e.g., SGT-01, Grand Test 1)
                        if (!forcedTest) {
                            const matchedTest = tests.find(t => searchStringNorm.includes(normalizeForMatch(t)));
                            if (matchedTest) testName = matchedTest;
                            else if (tests.length > 0) testName = tests[0];
                        }
                    } else if (streams.length > 0) {
                        // Fallback to first stream if no match
                        streamFromMetadata = streams[0];
                        if (!forcedTest) {
                            const streamPath = path.join(picsBaseDir, streamFromMetadata);
                            const tests = fs.readdirSync(streamPath).filter(f => fs.statSync(path.join(streamPath, f)).isDirectory());
                            if (tests.length > 0) testName = tests[0];
                        }
                    }
                }

                if (!forcedTest && String(metadataRow).toUpperCase().includes('SPECIAL GRAND TEST')) {
                    const sgMatch = String(metadataRow).match(/SPECIAL GRAND TEST\s*[-_]\s*(\d+)/i);
                    if (sgMatch) {
                        testName = `NST-${sgMatch[1].padStart(2, '0')}`;
                    } else {
                        testName = 'NST-01';
                    }
                }
            }

            const testType = forcedType || testName.split('-')[0].trim();

            console.log(`  Test: ${testName}, Date: ${rawExamDate}, Stream: ${streamFromMetadata}`);

            // B. STUD_ERP Sheet (Question-wise Response)
            const studErpWs = wb.Sheets['STUD_ERP'];
            if (!studErpWs) {
                console.warn(`  [SKIP] 'STUD_ERP' sheet not found in ${erpFile}`);
                continue;
            }
            const studErpData = XLSX.utils.sheet_to_json(studErpWs, { header: 1 });

            // C. TOP-100_Error Sheet (National Wide Error %)
            const top100SheetName = wb.SheetNames.find(n => {
                const cleanStr = n.toUpperCase().replace(/[-\s_]/g, '');
                return cleanStr.includes('TOP100') || cleanStr.includes('ERROR') || cleanStr.includes('WANDU') || cleanStr.includes('W&U');
            }) || 'TOP-100_Error';
            const top100Ws = wb.Sheets[top100SheetName];
            const nationalErrorMap = {}; // { "QNo": { "W": "percentage", "U": "percentage" } }
            if (top100Ws) {
                const top100Data = XLSX.utils.sheet_to_json(top100Ws, { header: 1 });

                // Dynamically find header row in TOP-100_Error
                let headerRowIdx = -1;
                for (let i = 0; i < 12; i++) {
                    const row = top100Data[i];
                    if (!row) continue;
                    if (row.some(c => {
                        const s = String(c || '').toUpperCase().trim();
                        const sClean = s.replace(/[\s\.]/g, '');
                        return s === 'W' || s === 'U' || s === 'W%' || s === 'U%' || 
                               s.includes('WRONG') || s.includes('UNATTEMPTED') || 
                               sClean === 'QNO';
                    })) {
                        headerRowIdx = i;
                        break;
                    }
                }

                if (headerRowIdx !== -1) {
                    const headRow = top100Data[headerRowIdx];
                    // Dynamically map W and U columns, fallback to Hardcoded 6 and 8
                    let finalWCol = 6; 
                    let finalUCol = 8; 
                    
                    for (let c = 0; c < headRow.length; c++) {
                        const th = String(headRow[c] || '').toUpperCase().trim();
                        if (th === 'W' || th === 'W%' || th.includes('WRONG')) finalWCol = c;
                        if (th === 'U' || th === 'U%' || th.includes('UNATTEMPTED')) finalUCol = c;
                    }

                    // Data starts from either current header row if QNo is there, or next row
                    const firstColHeader = String(top100Data[headerRowIdx][0] || '').toUpperCase();
                    const startDataIdx = (firstColHeader.startsWith('Q') || /^\d+$/.test(firstColHeader)) ? headerRowIdx : headerRowIdx + 1;

                    for (let i = startDataIdx; i < top100Data.length; i++) {
                        const row = top100Data[i];
                        if (!row || row[0] === undefined || row[0] === null || String(row[0]).trim() === '') continue;
                        const qNoRaw = String(row[0]).trim();
                        // Allow Q1 or just 1
                        if (!qNoRaw.toUpperCase().startsWith('Q') && isNaN(parseInt(qNoRaw))) continue;
                        const qNo = qNoRaw.replace(/[^0-9]/g, '');
                        
                        // LITERALLY take from the identified columns
                        const wVal = row[finalWCol];
                        const uVal = row[finalUCol];

                        nationalErrorMap[qNo] = {
                            W: formatPercentage(wVal),
                            U: formatPercentage(uVal)
                        };
                    }
                }
                console.log(`  [INFO] Loaded National Error stats for ${Object.keys(nationalErrorMap).length} questions from ${top100SheetName}.`);
            }

            // D. Load Meta Data from PICS subfolder
            const picsSubDir = findPicsSubFolder(ERP_BASE_DIR, streamFromMetadata, testName);
            const { meta: questionMeta } = loadZeroReport(picsSubDir);
            const keysMap = loadKeys(path.join(picsSubDir, 'K.xlsx'));

            // E. Process Students
            const marksColMap = identifyHeaders(marksData);
            const studErpColMap = identifyStudErpHeaders(studErpData);

            if (marksColMap.STUD_ID === -1) {
                console.error(`  [ERROR] Could not find STUDENT ID column in 'Marks List' for ${erpFile}`);
                continue;
            }

            const urlSubMap = (urlMapping.mappings[streamFromMetadata] && urlMapping.mappings[streamFromMetadata][testName]) || { Q: {}, S: {} };
            const rowsToUpload = [];

            // Find where student data actually starts
            let startRow = 6;
            for (let i = 0; i < 15; i++) {
                if (marksData[i] && marksData[i][marksColMap.STUD_ID] && !isNaN(parseInt(normalizeId(marksData[i][marksColMap.STUD_ID])))) {
                    startRow = i;
                    break;
                }
            }

            for (let i = startRow; i < marksData.length; i++) {
                const row = marksData[i];
                if (!row || !row[marksColMap.STUD_ID]) continue;

                const rawStudId = String(row[marksColMap.STUD_ID]).trim();
                const studId = normalizeId(rawStudId);
                if (!studId) continue;

                const studentName = String(row[marksColMap.NAME] || '').trim();
                const branchName = normalizeCampus(row[marksColMap.CAMPUS]);

                // --- TOP/ALL MODE FILTERING ---
                const configCategory = getMappedCategory(studId, year, streamFromMetadata);
                const isTopCategory = configCategory !== 'ALL';

                let targetType = "";
                if (modeArg === 'TOP') {
                    if (!isTopCategory) continue;
                    targetType = configCategory;
                } else if (modeArg === 'ALL') {
                    if (isTopCategory) continue;
                    targetType = "ALL";
                } else { // BOTH
                    targetType = configCategory;
                }

                // Find student in STUD_ERP sheet
                const erpRowIdx = studErpData.findIndex(r => r && normalizeId(r[studErpColMap.STUD_ID]) === studId);
                if (erpRowIdx === -1) continue;
                const erpRow = studErpData[erpRowIdx];

                for (const qColObj of studErpColMap.Q_COLS) {
                    const val = String(erpRow[qColObj.col] || '').trim().toUpperCase();
                    if (val === 'W' || val === 'U') {
                        const qNo = qColObj.qNo;
                        const meta = questionMeta[qNo] || {};

                        rowsToUpload.push({
                            STUD_ID: studId, Student_Name: studentName, Branch: branchName,
                            Exam_Date: formatDateToSQL(rawExamDate), Test_Type: testType, Test: testName,
                            Tot_720: row[marksColMap.TOT], AIR: row[marksColMap.AIR],
                            Botany: row[marksColMap.BOT], B_Rank: row[marksColMap.B_Rank],
                            Zoology: row[marksColMap.ZOO], Z_Rank: row[marksColMap.Z_Rank],
                            Physics: row[marksColMap.PHY], P_Rank: row[marksColMap.P_Rank],
                            Chemistry: row[marksColMap.CHE], C_Rank: row[marksColMap.C_Rank],
                            Q_No: parseInt(qNo), W_U: val,
                            National_Wide_Error: (nationalErrorMap[qNo] ? (val === 'W' ? nationalErrorMap[qNo].W : nationalErrorMap[qNo].U) : '--'),
                            Q_URL: urlSubMap.Q[qNo] || '', S_URL: urlSubMap.S[qNo] || DEFAULT_S_URL,
                            Key_Value: keysMap[qNo] || '', Subject: meta.Subject || '--',
                            Topic: meta.Topic || '--', Sub_Topic: meta.Sub_Topic || '--',
                            Question_Type: meta.Question_Type || '--', Statement: meta.Statement || '--',
                            Year: year, Top_ALL: targetType, Stream: streamFromMetadata,
                            Custom_Heading: customHeading || null
                        });
                    }
                }
            }

            console.log(`  [SYNC] Processing ${rowsToUpload.length} error records (Skipping duplicates)...`);
            if (rowsToUpload.length > 0) {
                await uploadErpRows(pool, rowsToUpload);
            }
        }

    } catch (err) {
        console.error("ERP Extraction Fatal Error:", err);
    } finally {
        process.exit(0);
    }
}

function identifyHeaders(data) {
    const norm = (s) => String(s || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    const find = (text, startRowIdx) => {
        const searchText = norm(text);
        for (let r = startRowIdx; r < 12; r++) {
            const row = data[r];
            if (!row) continue;
            const idx = row.findIndex(h => norm(h).includes(searchText));
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const firstValidIdx = (labels, startRow) => {
        for (const label of labels) {
            const idx = find(label, startRow);
            if (idx !== -1) return idx;
        }
        return -1;
    };

    const colMap = {
        STUD_ID: firstValidIdx(['STUDID', 'ADMNO', 'ADM_NO', 'OMRID', 'OMR_ID', 'ID'], 2),
        NAME: firstValidIdx(['NAMEOFTHESTUDENT', 'STUDENTNAME', 'NAME', 'STUDNAME'], 2),
        CAMPUS: firstValidIdx(['CAMPUSNAME', 'CAMPUS', 'BRANCH', 'CAMPUS_NAME'], 2),
        TOT: firstValidIdx(['TOT720', 'TOT', 'TOTAL', 'GRAND_TOTAL', 'SCORE'], 2),
        AIR: firstValidIdx(['AIR', 'RANK', 'ALLINDIARANK'], 2),
        BOT: firstValidIdx(['BOTANY', 'BOT', 'BIOLOGY'], 2),
        ZOO: firstValidIdx(['ZOOLOGY', 'ZOO'], 2),
        PHY: firstValidIdx(['PHYSICS', 'PHY'], 2),
        CHE: firstValidIdx(['CHEMISTRY', 'CHE'], 2)
    };

    // Generic rank finder logic
    const findRank = (subjectIdx) => {
        if (subjectIdx === -1) return -1;
        for (let i = subjectIdx + 1; i < subjectIdx + 5 && i < data[5].length; i++) {
            if (norm(data[5][i]) === 'RANK' || norm(data[4][i]) === 'RANK') return i;
        }
        return -1;
    };

    colMap.B_Rank = findRank(colMap.BOT);
    colMap.Z_Rank = findRank(colMap.ZOO);
    colMap.P_Rank = findRank(colMap.PHY);
    colMap.C_Rank = findRank(colMap.CHE);

    return colMap;
}

function identifyStudErpHeaders(data) {
    const colMap = { STUD_ID: -1, Q_COLS: [] };

    let headerRowIdx = -1;
    for (let i = 0; i < 5; i++) {
        if (!data[i]) continue;
        const hasId = data[i].some(v => {
            const up = String(v).toUpperCase();
            return up.includes('ADM_NO') || up.includes('STUD_ID') || up.includes('STUDENT');
        });
        if (hasId) {
            headerRowIdx = i;
            break;
        }
    }

    if (headerRowIdx === -1) return colMap;

    const row = data[headerRowIdx];
    for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim().toUpperCase();
        if (val.includes('STUD_ID') || val.includes('ADM_NO') || (val.includes('STUDENT') && !val.includes('NAME'))) {
            colMap.STUD_ID = c;
        }
        else if (val.startsWith('Q') && !isNaN(val.replace('Q', ''))) {
            const qNo = val.replace('Q', '');
            colMap.Q_COLS.push({ col: c, qNo: qNo });
        }
    }
    return colMap;
}

function findPicsSubFolder(base, stream, test) {
    const picsDir = path.join(base, 'PICS');
    if (!fs.existsSync(picsDir)) return "";

    // Exact matches first
    const path1 = path.join(picsDir, stream, test);
    if (fs.existsSync(path1)) return path1;

    // Case-insensitive search
    const streams = fs.readdirSync(picsDir);
    const sMatch = streams.find(s => s.toUpperCase() === stream.toUpperCase());
    if (sMatch) {
        const tests = fs.readdirSync(path.join(picsDir, sMatch));
        const tMatch = tests.find(t => t.toUpperCase() === test.toUpperCase());
        if (tMatch) return path.join(picsDir, sMatch, tMatch);
    }

    return "";
}

function loadZeroReport(picsSubDir) {
    if (!picsSubDir || !fs.existsSync(picsSubDir)) return { meta: {}, testName: null };
    const files = fs.readdirSync(picsSubDir);
    const zFile = files.find(f => f.toUpperCase().includes('ZERO') && f.toUpperCase().includes('REPORT') && f.endsWith('.xlsx'));
    if (!zFile) return { meta: {}, testName: null };

    const wb = XLSX.readFile(path.join(picsSubDir, zFile));
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);

    const mapping = {};
    data.forEach(r => {
        const qNo = String(r['Q_No'] || r['QNo'] || r['Q.No'] || r['Q NO'] || '').trim().replace('Q', '');
        if (!qNo) return;
        mapping[qNo] = {
            Subject: r['Subject'] || r['SUBJECT'] || '--',
            Topic: r['Topic'] || r['TOPIC'] || '--',
            Sub_Topic: r['Sub_Topic'] || r['Sub_Topics'] || r['SUB_TOPICS'] || r['SUB_TOPIC'] || '--',
            Question_Type: r['Question_Type'] || r['Question Type'] || r['QUESTION_TYPE'] || '--',
            Statement: r['Statement'] || r['STATEMENT'] || '--'
        };
    });
    return { meta: mapping, testName: null };
}

function loadKeys(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const wb = XLSX.readFile(filePath);
    // User said sheet name is "Key"
    const targetSheet = wb.SheetNames.find(n => n.toUpperCase() === 'KEY') || wb.SheetNames[0];
    const ws = wb.Sheets[targetSheet];
    const data = XLSX.utils.sheet_to_json(ws);

    const keys = {};
    data.forEach(r => {
        let qNoRaw = r['Q_No'] || r['Q.No'] || r['QNo'] || Object.values(r)[0];
        let keyRaw = r['Key'] || r['Answer'] || r['Correct Key'] || Object.values(r)[1];
        if (qNoRaw !== undefined && keyRaw !== undefined) {
            const qNo = String(parseInt(String(qNoRaw).replace('Q', '')));
            keys[qNo] = String(keyRaw).trim();
        }
    });
    return keys;
}

function formatPercentage(val) {
    if (val === undefined || val === null) return '--';
    if (typeof val === 'number') {
        if (val <= 1) return (val * 100).toFixed(0) + '%';
        return val.toFixed(0) + '%';
    }
    return String(val).trim();
}

function normalizeCampus(name) {
    if (!name) return "";
    let cleaned = String(name).trim().toUpperCase();
    if (cleaned.includes('/')) cleaned = cleaned.split('/')[1];
    cleaned = cleaned.replace(/PU COLLEGE\s+/i, '').replace(/PUC\s+/i, '').trim();
    return cleaned;
}

function formatDateToSQL(dateStr) {
    // Expected DD/MM/YYYY or DD-MM-YYYY or possibly YYYY-MM-DD
    const parts = dateStr.replace(/\//g, '-').split('-');
    if (parts.length < 3) return dateStr;

    let day, month, year;
    if (parts[0].length === 4) { // Input is YYYY-MM-DD
        year = parts[0];
        month = parts[1];
        day = parts[2];
    } else { // Input is DD-MM-YYYY
        day = parts[0];
        month = parts[1];
        year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    }

    // Return in DD-MM-YYYY format to match 2025 DB exactly
    return `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${year}`;
}

async function uploadErpRows(pool, rows) {
    const esc = (str) => String(str || '').replace(/'/g, "''");
    let count = 0;

    for (const r of rows) {
        // Step 1: Update existing record's Top_ALL and other metadata if it matches
        const updateSql = `
            UPDATE ERP_REPORT 
            SET Top_ALL = '${esc(r.Top_ALL)}',
                Stream = '${esc(r.Stream)}',
                Custom_Heading = ${r.Custom_Heading ? `'${esc(r.Custom_Heading)}'` : 'NULL'}
            WHERE STUD_ID = '${esc(r.STUD_ID)}' 
              AND Test = '${esc(r.Test)}' 
              AND Q_No = ${r.Q_No}
              AND Stream = '${esc(r.Stream)}'
              AND Exam_Date = '${r.Exam_Date}'
        `;

        const insertSql = `
            INSERT INTO ERP_REPORT (
                STUD_ID, Student_Name, Branch, Exam_Date, Test_Type, Test, Tot_720, AIR,
                Botany, B_Rank, Zoology, Z_Rank, Physics, P_Rank, Chemistry, C_Rank,
                Q_No, W_U, National_Wide_Error, Q_URL, S_URL,
                Key_Value, Subject, Topic, Sub_Topic, Question_Type, Statement, Year, Top_ALL, Stream, Custom_Heading
            )
            SELECT 
                '${esc(r.STUD_ID)}', '${esc(r.Student_Name)}', '${esc(r.Branch)}', '${r.Exam_Date}',
                '${esc(r.Test_Type)}', '${esc(r.Test)}', '${esc(r.Tot_720)}', '${esc(r.AIR)}',
                '${esc(r.Botany)}', '${esc(r.B_Rank)}', '${esc(r.Zoology)}', '${esc(r.Z_Rank)}',
                '${esc(r.Physics)}', '${esc(r.P_Rank)}', '${esc(r.Chemistry)}', '${esc(r.C_Rank)}',
                ${r.Q_No}, '${r.W_U}', '${esc(r.National_Wide_Error)}', '${r.Q_URL}', '${r.S_URL}',
                '${esc(r.Key_Value)}', '${esc(r.Subject)}', '${esc(r.Topic)}', '${esc(r.Sub_Topic)}',
                '${esc(r.Question_Type)}', '${esc(r.Statement)}', '${r.Year}', '${esc(r.Top_ALL)}', '${esc(r.Stream)}', ${r.Custom_Heading ? `'${esc(r.Custom_Heading)}'` : 'NULL'}
            FROM (SELECT 1 as dummy) AS t
            WHERE NOT EXISTS (
                SELECT 1 FROM ERP_REPORT 
                WHERE STUD_ID = '${esc(r.STUD_ID)}' 
                  AND Test = '${esc(r.Test)}' 
                  AND Q_No = ${r.Q_No}
                  AND Stream = '${esc(r.Stream)}'
                  AND Exam_Date = '${r.Exam_Date}'
            )
        `;

        try {
            // Try updating first (to correct labels if already exists)
            await pool.request().query(updateSql);
            // Then try inserting
            const result = await pool.request().query(insertSql);
            if (result.rowsAffected[0] > 0) count++;
        } catch (err) {
            console.error(`  [!] Error processing student ${r.STUD_ID} Q${r.Q_No}:`, err.message);
        }
    }
    console.log(`  [INFO] Uploaded ${count} new records (Skipped ${rows.length - count} duplicates).`);
}

processErp();
