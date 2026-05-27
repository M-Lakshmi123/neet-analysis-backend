const ExcelJS = require('exceljs');
const path = require('path');

async function main() {
    const workbook = new ExcelJS.Workbook();
    const templatePath = path.resolve('..\\Error Report Template.xlsx');
    console.log('Loading template from:', templatePath);
    await workbook.xlsx.readFile(templatePath);
    
    const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
    console.log('Worksheet name:', worksheet.name);
    
    // Print row heights
    for (let r = 1; r <= 8; r++) {
        const row = worksheet.getRow(r);
        console.log(`Row ${r} height: ${row.height}`);
    }
    
    // Print merge ranges
    console.log('Merge cells:');
    console.log(worksheet.model.merges);
    
    // Print cell values and fonts for rows 1 to 5
    for (let r = 1; r <= 6; r++) {
        const row = worksheet.getRow(r);
        console.log(`--- Row ${r} ---`);
        for (let c = 1; c <= 10; c++) {
            const cell = row.getCell(c);
            if (cell.value) {
                console.log(`Cell ${cell.address}:`, typeof cell.value === 'object' ? JSON.stringify(cell.value) : cell.value);
                console.log(`Font:`, JSON.stringify(cell.font));
                console.log(`Alignment:`, JSON.stringify(cell.alignment));
                console.log(`Fill:`, JSON.stringify(cell.fill));
                console.log(`Border:`, JSON.stringify(cell.border));
            }
        }
    }
    
    // Print columns info
    console.log('Columns:');
    worksheet.columns.forEach((col, idx) => {
        console.log(`Col ${idx + 1} (${col.key}): width = ${col.width}`);
    });
}

main().catch(err => console.error(err));
