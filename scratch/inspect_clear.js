const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');

async function test() {
    const templatePath = path.join(__dirname, '../Template.xlsx');
    const wb = await XlsxPopulate.fromFileAsync(templatePath);
    const sheet = wb.sheet(0);
    const cell = sheet.cell(7, 1);
    
    console.log("cell.clear implementation:");
    console.log(cell.clear.toString());
    
    console.log("\ncell.style implementation:");
    console.log(cell.style.toString());
}
test();
