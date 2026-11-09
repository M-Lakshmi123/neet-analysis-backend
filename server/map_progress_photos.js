const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { connectToDb } = require('./db.js');

function normalizeName(name) {
    if (!name) return '';
    return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function run() {
    console.log("=== Mapping Photos to Progress Report Database ===");

    // 1. Load Excel DS Student List
    const excelPath = 'E:\\2026\\Acadamic 2026-2027\\Academic Student Photos\\DS Student List.xlsx';
    const wb = xlsx.readFile(excelPath);
    const excelStudents = [];
    
    if (wb.Sheets['SR & JR']) {
        const rows = xlsx.utils.sheet_to_json(wb.Sheets['SR & JR']);
        rows.forEach(r => {
            const adm = String(r['Admission No'] || '').trim().toUpperCase();
            const omr = String(r['OMR ID '] || r['OMR ID'] || '').trim();
            const omr7 = String(r['7DIGIT OMR '] || r['7DIGIT OMR'] || '').trim();
            const name = String(r['Student Name'] || '').trim();
            if (adm || name || omr) {
                excelStudents.push({
                    adm,
                    omr,
                    omr7: omr7 || (omr.length >= 7 ? omr.slice(-7) : omr),
                    name,
                    normName: normalizeName(name)
                });
            }
        });
    }

    if (wb.Sheets['ALL']) {
        const rows = xlsx.utils.sheet_to_json(wb.Sheets['ALL'], { range: 1 });
        rows.forEach(r => {
            const adm = String(r['Admission No'] || '').trim().toUpperCase();
            const omr = String(r['OMR ID '] || r['OMR ID'] || '').trim();
            if (adm && omr) {
                const existing = excelStudents.find(s => s.adm === adm);
                if (existing) {
                    if (!existing.omr) existing.omr = omr;
                } else {
                    excelStudents.push({
                        adm,
                        omr,
                        omr7: omr.length >= 7 ? omr.slice(-7) : omr,
                        name: '',
                        normName: ''
                    });
                }
            }
        });
    }

    console.log(`Loaded ${excelStudents.length} students from Excel.`);

    // 2. Load Cropped Photos on disk
    const croppedDir = 'E:\\2026\\Acadamic 2026-2027\\Academic Student Photos\\Cropped_OMR_Photos';
    const summaryFile = path.join(croppedDir, 'crop_summary.json');
    const photoSummary = fs.existsSync(summaryFile) ? JSON.parse(fs.readFileSync(summaryFile, 'utf8')) : [];
    console.log(`Loaded ${photoSummary.length} cropped photos from summary.`);

    // Map photo data URLs
    const photoDataCache = new Map();
    function getPhotoData(filename) {
        if (!photoDataCache.has(filename)) {
            const fullPath = path.join(croppedDir, filename);
            if (fs.existsSync(fullPath)) {
                const buf = fs.readFileSync(fullPath);
                photoDataCache.set(filename, `data:image/jpeg;base64,${buf.toString('base64')}`);
            } else {
                photoDataCache.set(filename, null);
            }
        }
        return photoDataCache.get(filename);
    }

    // 3. Process both academic years 2026 and 2025
    for (const year of ['2026', '2025']) {
        console.log(`\n---------------- Processing Academic Year: ${year} ----------------`);
        const pool = await connectToDb(year);

        // Fetch existing photos in DB
        const [existingPhotos] = await pool.rawPool.query('SELECT student_id FROM student_photos');
        const photoKeySet = new Set(existingPhotos.map(p => p.student_id));
        console.log(`Current photo keys in ${year} DB: ${photoKeySet.size}`);

        // Fetch ERP_REPORT students
        const [erpStudents] = await pool.rawPool.query(`
            SELECT DISTINCT CAST(STUD_ID AS CHAR) as id, TRIM(Student_Name) as name, Branch 
            FROM ERP_REPORT 
            WHERE STUD_ID IS NOT NULL AND STUD_ID != ''
        `);
        console.log(`Unique ERP_REPORT students in ${year}: ${erpStudents.length}`);

        // Fetch MEDICAL_RESULT students
        const [medStudents] = await pool.rawPool.query(`
            SELECT DISTINCT CAST(STUD_ID AS CHAR) as id, TRIM(NAME_OF_THE_STUDENT) as name, CAMPUS_NAME as branch 
            FROM MEDICAL_RESULT 
            WHERE STUD_ID IS NOT NULL AND STUD_ID != ''
        `);
        console.log(`Unique MEDICAL_RESULT students in ${year}: ${medStudents.length}`);

        // Match ERP students
        const newMappingsToInsert = [];
        let directMatches = 0;
        let suffixMatches = 0;
        let nameMatches = 0;
        let unmatchedStudents = [];

        erpStudents.forEach(erp => {
            const cleanId = erp.id.trim();
            const normErpName = normalizeName(erp.name);

            // 1. Direct ID match
            if (photoKeySet.has(cleanId)) {
                directMatches++;
                return;
            }

            // 2. Suffix ID match in photoKeySet
            const suffixMatch = Array.from(photoKeySet).find(pid => cleanId.endsWith(pid) || pid.endsWith(cleanId));
            if (suffixMatch) {
                suffixMatches++;
                // Add direct alias mapping in DB so queries for cleanId are instant
                newMappingsToInsert.push({ studentId: cleanId, aliasFrom: suffixMatch });
                return;
            }

            // 3. Name match in Excel
            if (normErpName.length > 4) {
                const nameMatch = excelStudents.find(s => {
                    if (!s.normName) return false;
                    return s.normName === normErpName || 
                           s.normName.includes(normErpName) || 
                           normErpName.includes(s.normName);
                });

                if (nameMatch) {
                    nameMatches++;
                    // Find photo for this Excel student
                    const pItem = photoSummary.find(p => 
                        p.omr_id === nameMatch.omr || 
                        p.scs_number === nameMatch.adm ||
                        (nameMatch.omr7 && p.omr_id.endsWith(nameMatch.omr7))
                    );

                    if (pItem) {
                        const photoData = getPhotoData(pItem.output_file);
                        if (photoData) {
                            newMappingsToInsert.push({ studentId: cleanId, directData: photoData });
                            return;
                        }
                    }
                }
            }

            unmatchedStudents.push(erp);
        });

        console.log(`\nMatch Results for ERP_REPORT (${year}):`);
        console.log(`  - Direct ID matches: ${directMatches}`);
        console.log(`  - Suffix ID matches: ${suffixMatches}`);
        console.log(`  - Name matches from Excel: ${nameMatches}`);
        console.log(`  - Unmatched: ${unmatchedStudents.length}`);
        console.log(`  - New mappings to insert: ${newMappingsToInsert.length}`);

        // Insert new mappings
        if (newMappingsToInsert.length > 0) {
            console.log(`Inserting ${newMappingsToInsert.length} new student mappings into student_photos (${year})...`);
            for (const item of newMappingsToInsert) {
                if (item.directData) {
                    await pool.rawPool.query(
                        `INSERT INTO student_photos (student_id, photo_data, mime_type, updated_at) 
                         VALUES (?, ?, 'image/jpeg', NOW()) 
                         ON DUPLICATE KEY UPDATE photo_data = VALUES(photo_data), updated_at = NOW()`,
                        [item.studentId, item.directData]
                    );
                } else if (item.aliasFrom) {
                    // Copy photo_data from alias
                    const [sourceRows] = await pool.rawPool.query('SELECT photo_data FROM student_photos WHERE student_id = ? LIMIT 1', [item.aliasFrom]);
                    if (sourceRows.length > 0) {
                        await pool.rawPool.query(
                            `INSERT INTO student_photos (student_id, photo_data, mime_type, updated_at) 
                             VALUES (?, ?, 'image/jpeg', NOW()) 
                             ON DUPLICATE KEY UPDATE photo_data = VALUES(photo_data), updated_at = NOW()`,
                            [item.studentId, sourceRows[0].photo_data]
                        );
                    }
                }
            }
            console.log(`Saved new mappings into ${year}!`);
        }

        // Also check MEDICAL_RESULT coverage
        let medCoverage = 0;
        const [updatedPhotos] = await pool.rawPool.query('SELECT student_id FROM student_photos');
        const updatedKeySet = new Set(updatedPhotos.map(p => p.student_id));
        medStudents.forEach(m => {
            if (updatedKeySet.has(m.id)) medCoverage++;
        });
        console.log(`MEDICAL_RESULT students with photo in ${year}: ${medCoverage} / ${medStudents.length}`);
    }

    console.log("\nMapping process completed successfully!");
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
