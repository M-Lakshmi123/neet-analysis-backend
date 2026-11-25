const path = require('path');
const ExcelJS = require(path.resolve('client/node_modules/exceljs'));

async function testIndex() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('test');
    ws.addRow(['Col1', 'Col2', 'Col3']);
    console.log('Cell 1:', ws.getRow(1).getCell(1).value);
    console.log('Cell 2:', ws.getRow(1).getCell(2).value);
    console.log('Cell 3:', ws.getRow(1).getCell(3).value);
}
testIndex();
