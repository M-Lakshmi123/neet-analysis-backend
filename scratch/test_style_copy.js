const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');

async function run() {
    try {
        const templatePath = path.join(__dirname, '../Template.xlsx');
        const workbook = await XlsxPopulate.fromFileAsync(templatePath);
        const sheet = workbook.sheet(0);
        console.log("Style of A7 (STUD_ID):", sheet.cell(7, 1).style());
        console.log("Style of D7 (Tot 720):", sheet.cell(7, 4).style());
    } catch (err) {
        console.error(err);
    }
}
run();
