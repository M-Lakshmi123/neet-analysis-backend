const path = require('path');
const ExcelJS = require(path.resolve('client/node_modules/exceljs'));

async function run() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:/Users/Administrator/.gemini/antigravity/brain/8fbdb510-dcfa-425a-9491-b1e42849ba76/.user_uploaded/media_1795584830408_b9715aee.xlsx');
    const ws = wb.getWorksheet('ELITE CBSE');
    console.log('Worksheet rowCount:', ws.rowCount, 'colCount:', ws.columnCount);
    const r1 = ws.getRow(1);
    const r2 = ws.getRow(2);
    const r3 = ws.getRow(3);
    const r4 = ws.getRow(4);
    for (let c = 1; c <= ws.columnCount; c++) {
        const v1 = (r1.getCell(c).value || '').toString().replace(/\n/g, ' ');
        const v2 = (r2.getCell(c).value || '').toString().replace(/\n/g, ' ');
        const v3 = (r3.getCell(c).value || '').toString().replace(/\n/g, ' ');
        const v4 = (r4.getCell(c).value !== undefined && r4.getCell(c).value !== null ? r4.getCell(c).value : '').toString();
        console.log(`Col ${c}: R1=[${v1}] | R2=[${v2}] | R3=[${v3}] | R4=[${v4}]`);
    }
}
run().catch(console.error);
