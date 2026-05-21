const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');

async function inspect() {
    try {
        const filePath = path.join(__dirname, '../Template.xlsx');
        console.log("Loading", filePath);
        const workbook = await XlsxPopulate.fromFileAsync(filePath);
        const sheet = workbook.sheet(0);
        
        console.log("Sheet Name:", sheet.name());
        
        // Print values of first 15 rows, columns 1 to 14
        for (let r = 1; r <= 15; r++) {
            const rowValues = [];
            for (let c = 1; c <= 14; c++) {
                const cell = sheet.cell(r, c);
                rowValues.push(cell.value());
            }
            console.log(`Row ${r}:`, rowValues.map(v => v === undefined ? '' : String(v).substring(0, 20)).join(' | '));
        }

        // Print some styles of row 7 and row 5 to see which one has the actual style
        console.log("\n--- Row 5 Cell Styles (Col 1-5) ---");
        for (let c = 1; c <= 5; c++) {
            const cell = sheet.cell(5, c);
            console.log(`Col ${c}:`, {
                value: cell.value(),
                bold: cell.style('bold'),
                fill: cell.style('fill'),
                border: cell.style('border'),
                fontColor: cell.style('fontColor'),
                fontSize: cell.style('fontSize')
            });
        }

        console.log("\n--- Row 7 Cell Styles (Col 1-5) ---");
        for (let c = 1; c <= 5; c++) {
            const cell = sheet.cell(7, c);
            console.log(`Col ${c}:`, {
                value: cell.value(),
                bold: cell.style('bold'),
                fill: cell.style('fill'),
                border: cell.style('border'),
                fontColor: cell.style('fontColor'),
                fontSize: cell.style('fontSize')
            });
        }

    } catch (err) {
        console.error("Error inspecting:", err);
    }
}

inspect();
