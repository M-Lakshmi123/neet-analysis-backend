const ExcelJS = require('exceljs');
async function test() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.mergeCells('A1:AL1');
    const row1 = worksheet.getCell('A1');
    row1.value = 'test';

    const r2 = worksheet.addRow(['gt']);
    const r3 = worksheet.addRow(['h1']);

    console.log(row1.row, r2.number, r3.number);
}
test();
