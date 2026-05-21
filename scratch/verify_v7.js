const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');

async function test() {
    try {
        const filePath = path.join(__dirname, 'v7_style_undefined.xlsx');
        console.log("Loading generated workbook...");
        const wb = await XlsxPopulate.fromFileAsync(filePath);
        const sheet = wb.sheet(0);
        
        console.log("Row 12 Col 1 style:");
        const cell = sheet.cell(12, 1);
        console.log({
            value: cell.value(),
            bold: cell.style('bold'),
            fill: cell.style('fill'),
            border: cell.style('border'),
            fontColor: cell.style('fontColor'),
            fontSize: cell.style('fontSize')
        });
        
        console.log("Workbook loaded successfully. No errors.");
    } catch (err) {
        console.error("Error reading workbook:", err);
    }
}
test();
