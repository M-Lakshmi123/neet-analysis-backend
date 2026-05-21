const XlsxPopulate = require('../client/node_modules/xlsx-populate');
const path = require('path');
const fs = require('fs');
const JSZip = require('../client/node_modules/jszip');

async function run() {
    try {
        const templatePath = path.join(__dirname, '../Template.xlsx');
        console.log("Loading template...");
        const wb = await XlsxPopulate.fromFileAsync(templatePath);
        const sheet = wb.sheet(0);
        
        sheet.cell('A2').value("27-04-2026_TEST_AVERAGE_REPORT");
        
        // Read cell styles and style IDs from row 7
        const styles = [];
        const row7StyleIds = [];
        for (let col = 1; col <= 14; col++) {
            row7StyleIds[col] = sheet.cell(7, col)._styleId;
            styles[col] = sheet.cell(7, col).style([
                'bold', 'italic', 'underline', 'strikethrough', 'fontColor', 'fontFamily', 'fontSize', 
                'fill', 'border', 'numberFormat', 'horizontalAlignment', 'verticalAlignment', 'wrapText'
            ]);
        }
        
        // Write 50 rows of data
        let r = 7;
        for (let sIdx = 1; sIdx <= 50; sIdx++) {
            const rowData = [
                sIdx, `STUDENT ${sIdx}`, `CAMPUS ${sIdx % 3}`,
                500 + sIdx, sIdx, 150 + sIdx, sIdx, 150 - sIdx, sIdx, 300, 100, sIdx, 100, sIdx
            ];
            for (let col = 1; col <= 14; col++) {
                const cell = sheet.cell(r, col);
                cell.value(rowData[col - 1]);
                cell._styleId = row7StyleIds[col];
            }
            sheet.row(r).height(20);
            r++;
        }
        
        // Add "Campus Selection Average" row
        const totalRowData = [
            'Campus Selection Average', '', '',
            525.5, 25.5, 175.5, 25.5, 175.5, 25.5, 351, 100.5, 25.5, 100.5, 25.5
        ];
        
        sheet.range(`A${r}:C${r}`).merged(true);
        for (let col = 1; col <= 14; col++) {
            const cell = sheet.cell(r, col);
            if (col <= 3) {
                if (col === 1) {
                    cell.value(totalRowData[col - 1]);
                } else {
                    cell.value(null);
                }
            } else {
                cell.value(totalRowData[col - 1]);
            }
            
            const baseStyle = { ...styles[col] };
            baseStyle.bold = true;
            baseStyle.fill = { type: 'solid', color: { rgb: 'FFF2CC' } };
            cell.style(baseStyle);
        }
        sheet.row(r).height(25);
        r++;
        
        // Clear remaining template rows from r up to 178
        console.log(`Clearing rows ${r} to 178...`);
        for (let rowIdx = r; rowIdx <= 178; rowIdx++) {
            for (let col = 1; col <= 14; col++) {
                const cell = sheet.cell(rowIdx, col);
                cell.value(null);
                delete cell._style;
                cell._styleId = undefined;
            }
            sheet.row(rowIdx).height(undefined);
        }
        
        const outputPath = path.join(__dirname, 'complete_output.xlsx');
        await wb.toFileAsync(outputPath);
        console.log("Workbook saved successfully to:", outputPath);
        
        const data = fs.readFileSync(outputPath);
        const zip = await JSZip.loadAsync(data);
        const stylesXml = await zip.file("xl/styles.xml").async("string");
        console.log("styles.xml size:", stylesXml.length);
        
        // Verify we can read it back
        const wbRead = await XlsxPopulate.fromFileAsync(outputPath);
        console.log("Workbook read back successfully with sheet count:", wbRead.sheets().length);
    } catch (err) {
        console.error("Error during complete cycle test:", err);
    }
}
run();
