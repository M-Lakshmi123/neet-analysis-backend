const path = require('path');
const ExcelJS = require(path.resolve('client/node_modules/exceljs'));

async function testReadGenerated() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile('scratch/Test_Generated_Template.xlsx');
    console.log('Worksheets:', workbook.worksheets.map(w => w.name));
    const sheet = workbook.worksheets[0];
    console.log(`Sheet "${sheet.name}" has ${sheet.rowCount} rows and ${sheet.columnCount} columns.`);
    const r1 = sheet.getRow(1);
    const r2 = sheet.getRow(2);
    const r3 = sheet.getRow(3);
    const r4 = sheet.getRow(4);
    console.log('Row 1 (WET-1):', r1.getCell(7).value);
    console.log('Row 3 (BOT):', r3.getCell(7).value);
    console.log('Row 4 (Student Name):', r4.getCell(4).value);
    console.log('Row 4 (WET-1 Bot mark):', r4.getCell(7).value);
}

testReadGenerated().catch(console.error);
