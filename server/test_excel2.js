const xlsx = require('xlsx');
const fs = require('fs');

const filePath = 'F:\\Projects\\NEET Analysis\\2025-26_SR_ELITE_SR_AIIMS S60_NEET_Estimated_Avgs.xlsx';
const workbook = xlsx.readFile(filePath, { cellStyles: true });

const sheetName = 'SR ELITE'; // user mentioned this sheet
const worksheet = workbook.Sheets[sheetName];

const merges = worksheet['!merges'] || [];

let output = [];
for (let r = 0; r < 4; r++) {
    let rowValues = [];
    for (let c = 0; c < 45; c++) {
        const address = xlsx.utils.encode_cell({ r, c });
        const cell = worksheet[address];
        let val = '';
        if (cell) {
            val = cell.v !== undefined ? cell.v : '';
        }
        rowValues.push(val);
    }
    output.push(`ROW ${r}: ${JSON.stringify(rowValues)}`);
}

fs.writeFileSync('output.json', JSON.stringify({ merges, output }, null, 2));
