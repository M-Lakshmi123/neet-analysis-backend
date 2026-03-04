const ExcelJS = require('exceljs');

async function test() {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Count Summary');

        const borderStyle = {
            top: { style: 'thin', color: { argb: 'FF40E0D0' } },
            left: { style: 'thin', color: { argb: 'FF40E0D0' } },
            bottom: { style: 'thin', color: { argb: 'FF40E0D0' } },
            right: { style: 'thin', color: { argb: 'FF40E0D0' } }
        };

        worksheet.columns = Array(38).fill({ width: 10 });
        worksheet.columns[0] = { width: 35 };

        worksheet.mergeCells('A1:AL1');
        const row1 = worksheet.getCell('A1');
        row1.value = 'Logo Row';

        const gtLabels = ['Total', '', 100, 'All India\nBest', '', 1, 1, 1, 1, 1];
        const gtRow = worksheet.addRow(gtLabels);
        worksheet.mergeCells('A2:B2');
        worksheet.mergeCells('D2:E2');

        const h1 = worksheet.addRow(['Campus', 'Section', 'Strength', 'Mark', 'Rank', 'TOT', 'TOTAL', '', '', '', '', '', '', '', '', '', '', 'Botany(>170M)', '', '', '', '', '', 'Zoology(>170M)', '', '', '', '', '', 'Physics (>70M)', '', '', '', 'Chemistry ( >100M)', '', '', '', '']);

        worksheet.mergeCells('A3:A4');
        worksheet.mergeCells('B3:B4');
        worksheet.mergeCells('C3:C4');
        worksheet.mergeCells('D3:D4');
        worksheet.mergeCells('E3:E4');
        worksheet.mergeCells('F3:Q3');
        worksheet.mergeCells('R3:W3');
        worksheet.mergeCells('X3:AC3');
        worksheet.mergeCells('AD3:AG3');
        worksheet.mergeCells('AH3:AL3');

        const h2 = worksheet.addRow(['', '', '', '', '', '<=350', '>=650', '>=600']);

        // Data Rows
        const sortedExamStats = [
            { Campus: "Campus 1", Section: "SR", Strength: 100, Mark: 700, Rank: 1 }
        ];

        sortedExamStats.forEach(row => {
            const r = worksheet.addRow([row.Campus, row.Section, row.Strength, Number(row.Mark).toFixed(2), (row.Rank === Infinity ? '-' : Number(row.Rank).toFixed(2)), row.T_350, row.T_650, row.T_600, row.T_580, row.T_530, row.T_490, row.T_450, row.T_400, row.T_360, row.T_320, row.T_280, row.T_L200, row.B_175, row.B_170, row.B_160, row.B_170_180, row.B_150, row.B_130, row.Z_175, row.Z_170, row.Z_160, row.Z_170_180, row.Z_150, row.Z_130, row.P_70, row.P_50_70, row.P_L50, row.P_L30, row.C_100, row.C_70_100, row.C_50_70, row.C_L50, row.C_L20]);
            r.eachCell((cell, colNumber) => {
                cell.border = borderStyle;
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                if (colNumber >= 6 && colNumber <= 17) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFF0' } }; }
                else { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; }
            });
        });

        for (let i = 1; i <= 38; i++) {
            let maxLength = 8;
            worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                if (rowNumber >= 4) {
                    const cell = row.getCell(i);
                    let cellVal = cell.value;
                    if (cellVal && typeof cellVal === 'object' && cellVal.richText) {
                        cellVal = cellVal.richText.map(rt => rt.text).join('');
                    }
                    const columnLength = cellVal ? cellVal.toString().length : 0;
                    if (columnLength > maxLength) {
                        maxLength = columnLength;
                    }
                }
            });
            worksheet.getColumn(i).width = Math.min(maxLength + 2, 40);
        }

        const buffer = await workbook.xlsx.writeBuffer();
        console.log("Success! buffer size:", buffer.length);
    } catch (e) {
        console.error("Error creating excel:", e);
    }
}
test();
