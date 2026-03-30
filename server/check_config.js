const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = 'f:\\Projects\\NEET Analysis\\Uploader_Config.xlsx';
if (fs.existsSync(CONFIG_PATH)) {
    const wb = XLSX.readFile(CONFIG_PATH);
    console.log("Sheet Names:", wb.SheetNames);
    wb.SheetNames.forEach(n => {
        const ws = wb.Sheets[n];
        const data = XLSX.utils.sheet_to_json(ws);
        console.log(`- Sheet: ${n}, Rows: ${data.length}`);
        if(data.length > 0) console.log(`  Example Header:`, Object.keys(data[0]));
    });
} else {
    console.log("File not found.");
}
