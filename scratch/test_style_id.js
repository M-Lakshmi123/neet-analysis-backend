const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');
const fs = require('fs');
const JSZip = require('../client/node_modules/jszip');

async function test() {
    try {
        const templatePath = path.join(__dirname, '../Template.xlsx');
        const wb = await XlsxPopulate.fromFileAsync(templatePath);
        const sheet = wb.sheet(0);
        
        console.log("Setting style properties of rows 12 to 178 to undefined / removing style ID...");
        for (let r = 12; r <= 178; r++) {
            for (let c = 1; c <= 14; c++) {
                const cell = sheet.cell(r, c);
                cell.value(null);
                // Clear the internal style references
                delete cell._style;
                cell._styleId = 0; // standard default style ID is usually 0
            }
        }
        
        const outputPath = path.join(__dirname, 'v6_style_id.xlsx');
        await wb.toFileAsync(outputPath);
        console.log("Saved to:", outputPath);
        
        const data = fs.readFileSync(outputPath);
        const zip = await JSZip.loadAsync(data);
        const stylesXml = await zip.file("xl/styles.xml").async("string");
        console.log("v6 styles.xml size:", stylesXml.length);
        
        // Let's also check if sheet1.xml cell structure has standard style index
        const sheet1 = await zip.file("xl/worksheets/sheet1.xml").async("string");
        // Print the first few cell definitions in sheet1
        console.log("Sheet XML length:", sheet1.length);
        const match = sheet1.match(/<c r="A12" s="(\d+)"/);
        if (match) {
            console.log("Style index of A12:", match[1]);
        } else {
            console.log("No specific style index found for A12 (which means it's using default or is not in XML)");
        }
    } catch (err) {
        console.error(err);
    }
}
test();
