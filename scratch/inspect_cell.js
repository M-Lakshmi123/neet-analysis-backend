const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');

async function test() {
    const templatePath = path.join(__dirname, '../Template.xlsx');
    const wb = await XlsxPopulate.fromFileAsync(templatePath);
    const sheet = wb.sheet(0);
    const cell = sheet.cell(7, 1);
    
    console.log("Cell properties:");
    console.log(Object.getOwnPropertyNames(cell));
    console.log("Cell prototype properties:");
    console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(cell)));
    
    console.log("Cell _node keys:");
    if (cell._node) {
        console.log(Object.keys(cell._node));
        console.log("Cell _node name:", cell._node.name);
        console.log("Cell _node attributes:", cell._node.attributes);
    }
}
test();
