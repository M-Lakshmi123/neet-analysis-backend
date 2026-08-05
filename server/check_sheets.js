const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const FILE_PATH = path.resolve(__dirname, '..', 'Result', 'SR_ELITE_SET_01', 'BAN_BASAVESWARA NAGAR COACHING CENTER.xls');
if (fs.existsSync(FILE_PATH)) {
    const wb = XLSX.readFile(FILE_PATH);
    console.log("Sheet Names:", wb.SheetNames);
} else {
    console.log("File not found.");
}
