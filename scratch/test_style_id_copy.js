const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');
const fs = require('fs');
const JSZip = require('../client/node_modules/jszip');

async function test() {
    try {
        const templatePath = path.join(__dirname, '../Template.xlsx');
        const wb = await XlsxPopulate.fromFileAsync(templatePath);
        const sheet = wb.sheet(0);
        
        console.log("Checking style IDs of row 7:");
        const row7StyleIds = [];
        for (let col = 1; col <= 14; col++) {
            row7StyleIds[col] = sheet.cell(7, col)._styleId;
        }
        console.log("Row 7 style IDs:", row7StyleIds);
        
        console.log("Writing 50 rows of data using _styleId copy...");
        for (let r = 7; r <= 56; r++) {
            for (let col = 1; col <= 14; col++) {
                const cell = sheet.cell(r, col);
                cell.value(r * col);
                cell._styleId = row7StyleIds[col];
            }
        }
        
        console.log("Clearing rows 57 to 178 using styleId = undefined...");
        for (let r = 57; r <= 178; r++) {
            for (let col = 1; col <= 14; col++) {
                const cell = sheet.cell(r, col);
                cell.value(null);
                delete cell._style;
                cell._styleId = undefined;
            }
        }
        
        const outputPath = path.join(__dirname, 'v8_style_id_copy.xlsx');
        await wb.toFileAsync(outputPath);
        console.log("Saved to:", outputPath);
        
        const data = fs.readFileSync(outputPath);
        const zip = await JSZip.loadAsync(data);
        const stylesXml = await zip.file("xl/styles.xml").async("string");
        console.log("v8 styles.xml size:", stylesXml.length);
        
        // Read it back and check the style of a populated cell
        const wbRead = await XlsxPopulate.fromFileAsync(outputPath);
        const sheetRead = wbRead.sheet(0);
        console.log("Row 20 Col 1 style:");
        const cellRead = sheetRead.cell(20, 1);
        console.log({
            value: cellRead.value(),
            bold: cellRead.style('bold'),
            fill: cellRead.style('fill'),
            border: cellRead.style('border'),
            fontColor: cellRead.style('fontColor'),
            fontSize: cellRead.style('fontSize')
        });
        
    } catch (err) {
        console.error(err);
    }
}
test();
