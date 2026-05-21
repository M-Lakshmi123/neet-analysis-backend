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
                cell._styleId = undefined;
            }
        }
        
        const outputPath = path.join(__dirname, 'v7_style_undefined.xlsx');
        await wb.toFileAsync(outputPath);
        console.log("Saved to:", outputPath);
        
        const data = fs.readFileSync(outputPath);
        const zip = await JSZip.loadAsync(data);
        const stylesXml = await zip.file("xl/styles.xml").async("string");
        console.log("v7 styles.xml size:", stylesXml.length);
        
        // Let's check sheet1.xml cell structure
        const sheet1 = await zip.file("xl/worksheets/sheet1.xml").async("string");
        console.log("Sheet XML length:", sheet1.length);
        const match = sheet1.match(/<c r="A12" s="(\d+)"/);
        if (match) {
            console.log("Style index of A12:", match[1]);
        } else {
            console.log("No specific style index found for A12 (which means it's using default or is not in XML)");
            const cellMatch = sheet1.match(/<c r="A12"/);
            if (cellMatch) {
                console.log("Cell A12 exists in XML but has no style index attribute!");
            } else {
                console.log("Cell A12 does not even exist in XML!");
            }
        }
    } catch (err) {
        console.error(err);
    }
}
test();
