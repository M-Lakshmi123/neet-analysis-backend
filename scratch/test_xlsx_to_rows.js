const path = require('path');
const ExcelJS = require(path.resolve('client/node_modules/exceljs'));
const fs = require('fs');

async function testXLSXToRows() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('scratch/Test_Generated_Template.xlsx');
    
    for (const ws of wb.worksheets) {
        console.log(`Checking worksheet: ${ws.name}`);
        const rows = [];
        ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            const rowVals = [];
            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                rowVals[colNumber - 1] = cell.value !== undefined && cell.value !== null ? String(cell.value).trim() : '';
            });
            rows.push(rowVals);
        });
        console.log(`Sheet has ${rows.length} rows.`);
        console.log('Row 0 (WET-1 at index 6):', rows[0][6]);
        console.log('Row 2 (BOT at index 6):', rows[2][6]);
        console.log('Row 3 (Student 1 name at index 4):', rows[3][4]);
    }
}
testXLSXToRows().catch(console.error);
