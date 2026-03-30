const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const FILE_PATH = 'f:\\Projects\\NEET Analysis\\Result\\SR_ELITE_SET_01\\BAN_BASAVESWARA NAGAR COACHING CENTER.xls';
if (fs.existsSync(FILE_PATH)) {
    const wb = XLSX.readFile(FILE_PATH);
    const ws = wb.Sheets['Marks List'];
    if (ws) {
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        console.log("First 4 rows:");
        for(let i=0; i<4; i++) {
            console.log(`Row ${i}: `, data[i]);
        }
    } else {
        console.log("Sheet 'Marks List' not found.");
    }
} else {
    console.log("File not found.");
}
