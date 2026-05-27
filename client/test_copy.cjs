const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

async function main() {
    const workbook = new ExcelJS.Workbook();
    const templatePath = path.resolve('..\\Error Report Template.xlsx');
    await workbook.xlsx.readFile(templatePath);
    
    const templateSheet = workbook.getWorksheet(1) || workbook.worksheets[0];
    const newSheet = workbook.addWorksheet('Error Report New');
    
    // Copy column widths and keys
    newSheet.columns = templateSheet.columns.map(col => ({
        key: col.key,
        width: col.width
    }));
    
    // Copy rows 1 to 5
    for (let r = 1; r <= 5; r++) {
        const srcRow = templateSheet.getRow(r);
        const destRow = newSheet.getRow(r);
        destRow.height = srcRow.height;
        
        srcRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            const destCell = destRow.getCell(colNumber);
            destCell.value = cell.value;
            destCell.style = cell.style;
        });
    }
    
    // Copy merges
    templateSheet.model.merges.forEach(merge => {
        const match = merge.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (match) {
            const r1 = parseInt(match[2]);
            const r2 = parseInt(match[4]);
            if (r1 <= 5 && r2 <= 5) {
                newSheet.mergeCells(merge);
            }
        }
    });
    
    // Copy images using existing imageId
    templateSheet.getImages().forEach(img => {
        newSheet.addImage(img.imageId, img.range);
    });
    
    // Write student details on row 4
    newSheet.getCell('A4').value = "STUDENT NAME: JOHN DOE";
    newSheet.getCell('F4').value = "BRANCH: TEST BRANCH";
    
    // Write headers on row 5
    const headers = [
        'S.No', 'Test type', 'Date', 'Test Name', 'Q.No', 'W/U', 'Subject', 'Topic', 'Sub Topic', 'Top%'
    ];
    headers.forEach((h, index) => {
        newSheet.getCell(5, index + 1).value = h;
    });
    
    // Add some test data
    const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
    };
    const centerAlign = { horizontal: 'center', vertical: 'middle' };
    const leftAlign = { horizontal: 'left', vertical: 'middle' };
    
    for (let r = 6; r <= 15; r++) {
        const row = newSheet.getRow(r);
        row.height = 22;
        row.getCell(1).value = r - 5;
        row.getCell(2).value = 'MT';
        row.getCell(3).value = '15/09/2025';
        row.getCell(4).value = 'MT-01';
        row.getCell(5).value = 19;
        row.getCell(6).value = 'W';
        row.getCell(7).value = 'PHYSICS';
        row.getCell(8).value = 'Ray Optics and Optical Instruments';
        row.getCell(9).value = 'Refraction at spherical surfaces';
        row.getCell(10).value = '51%';
        
        row.eachCell((cell, colIdx) => {
            cell.border = thinBorder;
            cell.font = { name: 'Bookman Old Style', size: 10 };
            if (colIdx === 8 || colIdx === 9) {
                cell.alignment = leftAlign;
            } else {
                cell.alignment = centerAlign;
            }
            if (colIdx === 7) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAEEF3' } };
                cell.font = { name: 'Bookman Old Style', size: 10, bold: true, color: { argb: 'FF000000' } };
            }
            if (colIdx === 6) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE2E2' } };
                cell.font = { name: 'Bookman Old Style', size: 10, bold: true, color: { argb: 'FFB91C1C' } };
            }
        });
    }
    
    // Delete the original sheet
    workbook.removeWorksheet(templateSheet.name);
    // Rename the new sheet
    newSheet.name = 'Error Report';
    
    await workbook.xlsx.writeFile('test_copy.xlsx');
    console.log('Copy test written successfully!');
    
    const size = fs.statSync('test_copy.xlsx').size;
    console.log('New file size:', size);
}

main().catch(err => console.error(err));
