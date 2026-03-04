const ExcelJS = require('exceljs');

async function test() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet1');
    worksheet.columns = Array(38).fill({ width: 10 });
    // add some rows
    worksheet.addRow(['test', 'test2', 'test3']);

    try {
        worksheet.columns.forEach((column) => {
            let maxLength = 8;
            column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                if (rowNumber >= 4) {
                    const columnLength = cell.value ? cell.value.toString().length : 0;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                }
            });
            column.width = maxLength + 2;
        });
        console.log("Success");
    } catch (e) {
        console.log("Error:", e);
    }
}
test();
