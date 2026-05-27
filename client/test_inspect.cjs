const ExcelJS = require('exceljs');
const path = require('path');

async function main() {
    const workbook = new ExcelJS.Workbook();
    const templatePath = path.resolve('..\\Error Report Template.xlsx');
    await workbook.xlsx.readFile(templatePath);
    const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
    console.log('Worksheet name:', worksheet.name);
    console.log('Row count:', worksheet.rowCount);
    console.log('Actual row count:', worksheet.actualRowCount);
    
    // Find the last row that has any style or border
    let lastStyledRow = 0;
    for (let r = 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        let hasStyle = false;
        for (let c = 1; c <= 10; c++) {
            const cell = row.getCell(c);
            if (cell.font || cell.fill || cell.border || cell.alignment) {
                hasStyle = true;
                break;
            }
        }
        if (hasStyle) {
            lastStyledRow = r;
        }
    }
    console.log('Last styled row:', lastStyledRow);
}

main().catch(err => console.error(err));
