const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');

async function test() {
    try {
        const templatePath = path.join(__dirname, '../Template.xlsx');
        const outputPath = path.join(__dirname, '../scratch/test_populated.xlsx');
        
        console.log("Loading template...");
        const workbook = await XlsxPopulate.fromFileAsync(templatePath);
        const sheet = workbook.sheet(0);
        
        console.log("Reading styles from row 7...");
        const styles = [];
        for (let col = 1; col <= 14; col++) {
            styles[col] = sheet.cell(7, col).style([
                'bold', 'italic', 'underline', 'strikethrough', 'fontColor', 'fontFamily', 'fontSize', 
                'fill', 'border', 'numberFormat', 'horizontalAlignment', 'verticalAlignment', 'wrapText'
            ]);
        }
        
        console.log("Populating data rows...");
        // Let's write 5 rows of data
        for (let r = 7; r <= 11; r++) {
            for (let col = 1; col <= 14; col++) {
                const cell = sheet.cell(r, col);
                cell.value(`Val ${r},${col}`);
                cell.style(styles[col]);
            }
        }
        
        console.log("Clearing rows 12 to 178...");
        for (let rowIdx = 12; rowIdx <= 178; rowIdx++) {
            for (let col = 1; col <= 14; col++) {
                const cell = sheet.cell(rowIdx, col);
                cell.value(null);
                cell.style({});
            }
            sheet.row(rowIdx).height(undefined);
        }

        console.log("Saving workbook...");
        await workbook.toFileAsync(outputPath);
        console.log("Workbook saved successfully to:", outputPath);

        console.log("Reading workbook back...");
        const readWorkbook = await XlsxPopulate.fromFileAsync(outputPath);
        console.log("Workbook read back successfully! Sheet count:", readWorkbook.sheets().length);
    } catch (err) {
        console.error("Error during populate and read:", err);
    }
}

test();
