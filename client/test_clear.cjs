const ExcelJS = require('exceljs');
const path = require('path');

async function main() {
    const workbook = new ExcelJS.Workbook();
    const templatePath = path.resolve('..\\Error Report Template.xlsx');
    await workbook.xlsx.readFile(templatePath);
    const worksheet = workbook.getWorksheet(1) || workbook.worksheets[0];
    
    // Clear rows from 10 to 682 by setting styles to null/undefined
    for (let r = 10; r <= 682; r++) {
        const row = worksheet.getRow(r);
        row.eachCell({ includeEmpty: true }, (cell) => {
            cell.value = null;
            cell.style = null;
            cell.border = null;
            cell.fill = null;
            cell.font = null;
            cell.alignment = null;
        });
        row.height = undefined;
    }
    
    await workbook.xlsx.writeFile('test_clear.xlsx');
    console.log('Test file written successfully!');
}

main().catch(err => console.error(err));
