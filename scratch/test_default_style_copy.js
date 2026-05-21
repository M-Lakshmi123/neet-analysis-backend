const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');
const fs = require('fs');
const JSZip = require('../client/node_modules/jszip');

async function test() {
    try {
        const templatePath = path.join(__dirname, '../Template.xlsx');
        const wb = await XlsxPopulate.fromFileAsync(templatePath);
        const sheet = wb.sheet(0);
        
        console.log("Reading default style from cell A180...");
        const defaultStyle = sheet.cell(180, 1).style([
            'bold', 'italic', 'underline', 'strikethrough', 'fontColor', 'fontFamily', 'fontSize', 
            'fill', 'border', 'numberFormat', 'horizontalAlignment', 'verticalAlignment', 'wrapText'
        ]);
        
        console.log("Applying default style to rows 12 to 178...");
        for (let r = 12; r <= 178; r++) {
            for (let c = 1; c <= 14; c++) {
                const cell = sheet.cell(r, c);
                cell.value(null);
                cell.style(defaultStyle);
            }
        }
        
        const outputPath = path.join(__dirname, 'v5_default_style_copy.xlsx');
        await wb.toFileAsync(outputPath);
        console.log("Saved to:", outputPath);
        
        const data = fs.readFileSync(outputPath);
        const zip = await JSZip.loadAsync(data);
        const stylesXml = await zip.file("xl/styles.xml").async("string");
        console.log("v5 styles.xml size:", stylesXml.length);
    } catch (err) {
        console.error(err);
    }
}
test();
