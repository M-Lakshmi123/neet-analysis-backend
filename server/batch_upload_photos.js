const fs = require('fs');
const path = require('path');
const { connectToDb } = require('./db.js');

async function main() {
    console.log('=== Batch Student Photos Upload to TiDB ===\n');

    const jsonPath = path.join(__dirname, 'optimized_photos_temp.json');
    if (!fs.existsSync(jsonPath)) {
        throw new Error('optimized_photos_temp.json not found!');
    }

    let rawJson = fs.readFileSync(jsonPath, 'utf8');
    if (rawJson.charCodeAt(0) === 0xFEFF) {
        rawJson = rawJson.slice(1);
    }
    const photoList = JSON.parse(rawJson);
    console.log(`Loaded ${photoList.length} optimized photos from temp JSON.`);

    // 1. Fetch all student records from 2026
    const pool2026 = await connectToDb('2026');
    const [med2026] = await pool2026.rawPool.query(`
        SELECT DISTINCT CAST(STUD_ID AS CHAR) as id, TRIM(NAME_OF_THE_STUDENT) as name, CAMPUS_NAME as branch 
        FROM MEDICAL_RESULT 
        WHERE STUD_ID IS NOT NULL AND STUD_ID != ''
    `);
    const [erp2026] = await pool2026.rawPool.query(`
        SELECT DISTINCT CAST(STUD_ID AS CHAR) as id, TRIM(Student_Name) as name, Branch as branch 
        FROM ERP_REPORT 
        WHERE STUD_ID IS NOT NULL AND STUD_ID != ''
    `);

    // 2. Fetch all student records from 2025
    const pool2025 = await connectToDb('2025');
    const [med2025] = await pool2025.rawPool.query(`
        SELECT DISTINCT CAST(STUD_ID AS CHAR) as id, TRIM(NAME_OF_THE_STUDENT) as name, CAMPUS_NAME as branch 
        FROM MEDICAL_RESULT 
        WHERE STUD_ID IS NOT NULL AND STUD_ID != ''
    `);
    const [erp2025] = await pool2025.rawPool.query(`
        SELECT DISTINCT CAST(STUD_ID AS CHAR) as id, TRIM(Student_Name) as name, Branch as branch 
        FROM ERP_REPORT 
        WHERE STUD_ID IS NOT NULL AND STUD_ID != ''
    `);

    // Combine student registries
    const studentMap2026 = new Map();
    erp2026.forEach(s => studentMap2026.set(s.id, s));
    med2026.forEach(s => { if (!studentMap2026.has(s.id)) studentMap2026.set(s.id, s); });

    const studentMap2025 = new Map();
    erp2025.forEach(s => studentMap2025.set(s.id, s));
    med2025.forEach(s => { if (!studentMap2025.has(s.id)) studentMap2025.set(s.id, s); });

    console.log(`Students in 2026 DB: ${studentMap2026.size}`);
    console.log(`Students in 2025 DB: ${studentMap2025.size}`);

    const allStudentsList = [
        ...Array.from(studentMap2026.values()),
        ...Array.from(studentMap2025.values())
    ];

    // Build photo insert pairs: { studentId, photoData, mimeType, matchedName, sourceYear }
    const recordsToInsert2026 = [];
    const recordsToInsert2025 = [];
    const summaryList = [];

    for (const p of photoList) {
        const base = p.photoBase;
        // Find match in 2026 first
        let matched = Array.from(studentMap2026.values()).find(s => s.id === base || s.id.endsWith(base));
        let matchSource = '2026 DB';

        // If not found in 2026, find in 2025
        if (!matched) {
            matched = Array.from(studentMap2025.values()).find(s => s.id === base || s.id.endsWith(base));
            matchSource = matched ? '2025 DB' : 'Unmatched';
        }

        const fullStudentId = matched ? matched.id : base;
        const studentName = matched ? matched.name : '(Not in exam table)';
        const branch = matched ? matched.branch : '-';

        summaryList.push({
            photoFile: p.fileName,
            photoBase: base,
            matchedFullId: fullStudentId,
            studentName,
            branch,
            matchSource,
            sizeKB: p.sizeKB
        });

        // Insert into 2026 DB under fullStudentId
        recordsToInsert2026.push({ studentId: fullStudentId, photoData: p.dataUrl, mime: 'image/jpeg' });
        // Also insert short ID alias if different from full ID
        if (fullStudentId !== base) {
            recordsToInsert2026.push({ studentId: base, photoData: p.dataUrl, mime: 'image/jpeg' });
        }

        // Insert into 2025 DB as well
        recordsToInsert2025.push({ studentId: fullStudentId, photoData: p.dataUrl, mime: 'image/jpeg' });
        if (fullStudentId !== base) {
            recordsToInsert2025.push({ studentId: base, photoData: p.dataUrl, mime: 'image/jpeg' });
        }
    }

    console.log(`\nPrepared ${recordsToInsert2026.length} entries for NEET_2026 student_photos table.`);
    console.log(`Prepared ${recordsToInsert2025.length} entries for NEET (2025) student_photos table.`);

    // Upload to NEET_2026 in batches of 20
    console.log('\n--> Uploading to TiDB 2026 (NEET_2026)...');
    let count2026 = 0;
    for (let i = 0; i < recordsToInsert2026.length; i += 20) {
        const chunk = recordsToInsert2026.slice(i, i + 20);
        for (const item of chunk) {
            await pool2026.rawPool.query(
                `INSERT INTO student_photos (student_id, photo_data, mime_type, updated_at) 
                 VALUES (?, ?, ?, NOW()) 
                 ON DUPLICATE KEY UPDATE photo_data = VALUES(photo_data), mime_type = VALUES(mime_type), updated_at = NOW()`,
                [item.studentId, item.photoData, item.mime]
            );
            count2026++;
        }
        process.stdout.write(`Uploaded ${count2026} / ${recordsToInsert2026.length} records to 2026...\r`);
    }
    console.log(`\nSuccessfully saved ${count2026} photo records to NEET_2026!`);

    // Upload to NEET (2025) in batches of 20
    console.log('\n--> Uploading to TiDB 2025 (NEET)...');
    let count2025 = 0;
    for (let i = 0; i < recordsToInsert2025.length; i += 20) {
        const chunk = recordsToInsert2025.slice(i, i + 20);
        for (const item of chunk) {
            await pool2025.rawPool.query(
                `INSERT INTO student_photos (student_id, photo_data, mime_type, updated_at) 
                 VALUES (?, ?, ?, NOW()) 
                 ON DUPLICATE KEY UPDATE photo_data = VALUES(photo_data), mime_type = VALUES(mime_type), updated_at = NOW()`,
                [item.studentId, item.photoData, item.mime]
            );
            count2025++;
        }
        process.stdout.write(`Uploaded ${count2025} / ${recordsToInsert2025.length} records to 2025...\r`);
    }
    console.log(`\nSuccessfully saved ${count2025} photo records to NEET 2025!`);

    // Verify
    const [[{ totalPhotos2026 }]] = await pool2026.rawPool.query('SELECT COUNT(*) as totalPhotos2026 FROM student_photos');
    const [[{ totalPhotos2025 }]] = await pool2025.rawPool.query('SELECT COUNT(*) as totalPhotos2025 FROM student_photos');
    console.log('\n=== VERIFICATION RESULTS ===');
    console.log(`Total photos in 2026 student_photos table: ${totalPhotos2026}`);
    console.log(`Total photos in 2025 student_photos table: ${totalPhotos2025}`);

    // Sample check: check user's example student 246555671 and 6555671
    const [sampleRow] = await pool2026.rawPool.query('SELECT student_id, mime_type, LENGTH(photo_data) as photoBytes, updated_at FROM student_photos WHERE student_id IN ("246555671", "6555671")');
    console.log('\nUser example check (246555671 & 6555671):', sampleRow);

    // Save summary report to JSON
    fs.writeFileSync(path.join(__dirname, 'upload_summary.json'), JSON.stringify(summaryList, null, 2), 'utf8');
    console.log('Saved detailed match summary to server/upload_summary.json');

    // Clean up temporary JSON
    try {
        fs.unlinkSync(jsonPath);
        console.log('Cleaned up optimized_photos_temp.json');
    } catch(e) {}

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal upload error:', err);
    process.exit(1);
});
