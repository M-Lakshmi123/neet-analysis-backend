const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');

async function test() {
    const templatePath = path.join(__dirname, '../Template.xlsx');
    const wb = await XlsxPopulate.fromFileAsync(templatePath);
    const ss = wb.styleSheet();
    console.log("StyleSheet prototype properties:");
    console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(ss)));
}
test();
