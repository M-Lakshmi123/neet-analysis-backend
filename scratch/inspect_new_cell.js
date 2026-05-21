const XlsxPopulate = require('../client/node_modules/xlsx-populate');

async function test() {
    const wb = await XlsxPopulate.fromBlankAsync();
    const sheet = wb.sheet(0);
    const cell = sheet.cell("A1");
    console.log("New cell properties:");
    console.log("value:", cell.value());
    console.log("_styleId:", cell._styleId);
    console.log("_style:", cell._style);
}
test();
