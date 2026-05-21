const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');
const fs = require('fs');
const JSZip = require('../client/node_modules/jszip');

async function test() {
    try {
        const templatePath = path.join(__dirname, '../Template.xlsx');
        const wb = await XlsxPopulate.fromFileAsync(templatePath);
        const sheet = wb.sheet(0);
        
        console.log("Setting cell styles to reset object...");
        for (let r = 12; r <= 178; r++) {
            for (let c = 1; c <= 14; c++) {
                const cell = sheet.cell(r, c);
                cell.value(null);
                cell.style({
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
            }
        }
        
        const outputPath = path.join(__dirname, 'v3_style_null.xlsx');
        await wb.toFileAsync(outputPath);
        console.log("Saved to:", outputPath);
        
        const data = fs.readFileSync(outputPath);
        const zip = await JSZip.loadAsync(data);
        const stylesXml = await zip.file("xl/styles.xml").async("string");
        console.log("v3 styles.xml size:", stylesXml.length);
    } catch (err) {
        console.error(err);
    }
}
test();
