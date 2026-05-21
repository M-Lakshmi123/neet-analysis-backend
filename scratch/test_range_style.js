const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');
const fs = require('fs');
const JSZip = require('../client/node_modules/jszip');

async function test() {
    try {
        const templatePath = path.join(__dirname, '../Template.xlsx');
        const wb = await XlsxPopulate.fromFileAsync(templatePath);
        const sheet = wb.sheet(0);
        
        console.log("Setting range values to null...");
        sheet.range("A12:N178").value(null);
        
        console.log("Applying style reset to range...");
        sheet.range("A12:N178").style({
            bold: false,
            italic: false,
            underline: false,
            strikethrough: false,
            fontColor: null,
            fill: null,
            border: null,
            numberFormat: null,
            horizontalAlignment: null,
            verticalAlignment: null,
            wrapText: false
        });
        
        const outputPath = path.join(__dirname, 'v4_range_style.xlsx');
        await wb.toFileAsync(outputPath);
        console.log("Saved to:", outputPath);
        
        const data = fs.readFileSync(outputPath);
        const zip = await JSZip.loadAsync(data);
        const stylesXml = await zip.file("xl/styles.xml").async("string");
        console.log("v4 styles.xml size:", stylesXml.length);
    } catch (err) {
        console.error(err);
    }
}
test();
