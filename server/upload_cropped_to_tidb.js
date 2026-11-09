const fs = require('fs');
const path = require('path');
const { connectToDb } = require('./db.js');

async function main() {
    console.log("=== Fast Batch Uploading Cropped Photos to TiDB ===");
    const croppedDir = 'E:\\2026\\Acadamic 2026-2027\\Academic Student Photos\\Cropped_OMR_Photos';
    const summaryPath = path.join(croppedDir, 'crop_summary.json');
    
    if (!fs.existsSync(summaryPath)) {
        throw new Error("crop_summary.json not found!");
    }
    
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    console.log(`Loaded ${summary.length} processed photo items.`);
    
    const pool2026 = await connectToDb('2026');
    const pool2025 = await connectToDb('2025');
    
    const records = [];
    for (const item of summary) {
        const filePath = path.join(croppedDir, item.output_file);
        if (!fs.existsSync(filePath)) continue;
        
        const buf = fs.readFileSync(filePath);
        const dataUrl = `data:image/jpeg;base64,${buf.toString('base64')}`;
        
        // 1. OMR ID
        if (item.omr_id) {
            records.push({ id: String(item.omr_id).trim(), data: dataUrl });
            const idStr = String(item.omr_id).trim();
            if (idStr.length >= 7) {
                const s7 = idStr.slice(-7);
                if (s7 !== idStr) {
                    records.push({ id: s7, data: dataUrl });
                }
            }
        }
        // 2. SCS Number
        if (item.scs_number) {
            records.push({ id: String(item.scs_number).trim(), data: dataUrl });
        }
    }
    
    const uniqueRecordsMap = new Map();
    records.forEach(r => {
        if (r.id && !uniqueRecordsMap.has(r.id)) {
            uniqueRecordsMap.set(r.id, r.data);
        }
    });
    
    const uniqueRecords = Array.from(uniqueRecordsMap.entries()).map(([id, data]) => ({ id, data }));
    console.log(`Total unique ID records to update in TiDB: ${uniqueRecords.length}`);
    
    async function uploadToPool(pool, yearLabel) {
        console.log(`--> Fast batch uploading to TiDB (${yearLabel})...`);
        const BATCH_SIZE = 40;
        let done = 0;
        for (let i = 0; i < uniqueRecords.length; i += BATCH_SIZE) {
            const batch = uniqueRecords.slice(i, i + BATCH_SIZE);
            const placeholders = batch.map(() => '(?, ?, "image/jpeg", NOW())').join(', ');
            const params = [];
            batch.forEach(b => {
                params.push(b.id, b.data);
            });
            
            const sql = `
                INSERT INTO student_photos (student_id, photo_data, mime_type, updated_at) 
                VALUES ${placeholders}
                ON DUPLICATE KEY UPDATE photo_data = VALUES(photo_data), mime_type = VALUES(mime_type), updated_at = NOW()
            `;
            await pool.rawPool.query(sql, params);
            done += batch.length;
            process.stdout.write(`Uploaded ${done} / ${uniqueRecords.length} records to ${yearLabel}...\r`);
        }
        console.log(`\nSuccessfully saved ${done} records in TiDB ${yearLabel}!`);
    }
    
    await uploadToPool(pool2026, '2026');
    await uploadToPool(pool2025, '2025');
    
    const [[{ total2026 }]] = await pool2026.rawPool.query('SELECT COUNT(*) as total2026 FROM student_photos');
    const [[{ total2025 }]] = await pool2025.rawPool.query('SELECT COUNT(*) as total2025 FROM student_photos');
    console.log(`\nFinal TiDB count: 2026=${total2026}, 2025=${total2025}`);
    
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
