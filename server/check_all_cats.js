const XLSX = require('xlsx');
const path = require('path');
const CONFIG_PATH = path.join(__dirname, '../Uploader_Config.xlsx');
const wb = XLSX.readFile(CONFIG_PATH);
wb.SheetNames.forEach(s => {
    if (s.includes('Campus')) return;
    const data = XLSX.utils.sheet_to_json(wb.Sheets[s]);
    const cats = [...new Set(data.map(r => r.Category || r.CATEGORY))];
    console.log(`Sheet: ${s}, Categories: ${cats}`);
});
