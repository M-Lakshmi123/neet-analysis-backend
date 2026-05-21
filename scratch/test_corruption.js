const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');
const fs = require('fs');

async function generate() {
    try {
        const templatePath = path.join(__dirname, '../Template.xlsx');
        
        // Version 1: With style({})
        console.log("Generating v1 (with cell.style({}))...");
        const wb1 = await XlsxPopulate.fromFileAsync(templatePath);
        const sheet1 = wb1.sheet(0);
        
        // Write 5 student rows
        for (let r = 7; r <= 11; r++) {
            for (let c = 1; c <= 14; c++) {
                sheet1.cell(r, c).value(r * c);
            }
        }
        // Clear remaining
        for (let r = 12; r <= 178; r++) {
            for (let c = 1; c <= 14; c++) {
                sheet1.cell(r, c).value(null);
                sheet1.cell(r, c).style({});
            }
        }
        await wb1.toFileAsync(path.join(__dirname, 'v1_style_empty.xlsx'));
        
        // Version 2: Without style({}) - only value(null)
        console.log("Generating v2 (only cell.value(null))...");
        const wb2 = await XlsxPopulate.fromFileAsync(templatePath);
        const sheet2 = wb2.sheet(0);
        
        // Write 5 student rows
        for (let r = 7; r <= 11; r++) {
            for (let c = 1; c <= 14; c++) {
                sheet2.cell(r, c).value(r * c);
            }
        }
        // Clear remaining
        for (let r = 12; r <= 178; r++) {
            for (let c = 1; c <= 14; c++) {
                sheet2.cell(r, c).value(null);
            }
        }
        await wb2.toFileAsync(path.join(__dirname, 'v2_value_null.xlsx'));
        
        console.log("Successfully generated both test files.");
    } catch (err) {
        console.error("Error generating:", err);
    }
}

generate();
