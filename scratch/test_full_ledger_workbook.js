const path = require('path');
const ExcelJS = require(path.resolve('client/node_modules/exceljs'));
const fs = require('fs');

async function testFullLedgerWorkbook() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sri Chaitanya Educational Institutions';
    workbook.created = new Date();

    const headerFillNavy = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2057' } };
    const subHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF172B6B' } };
    const botHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F4FB' } };
    const borderGold = {
        top: { style: 'thin', color: { argb: 'FFC9962B' } },
        bottom: { style: 'medium', color: { argb: 'FFC9962B' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };

    // ---------------------------------------------------------
    // 1. CBSE_Track_Sheet
    // ---------------------------------------------------------
    const cbseSheet = workbook.addWorksheet('CBSE_Track_Sheet', { views: [{ showGridLines: true }] });

    const cbseR1 = [];
    cbseR1[1] = 'S NO';
    cbseR1[2] = 'OMR';
    cbseR1[3] = 'OMR';
    cbseR1[4] = 'STUDENT NAME';
    cbseR1[5] = 'BOARD';
    cbseR1[6] = 'SECTION';
    cbseR1[7] = 'WET- 1\nDATE :-16-06-2025';
    cbseR1[13] = 'WET- 2\nDATE: 23-06-2025';
    cbseR1[19] = 'WET-3\nDATE : 30-06-2025';
    cbseR1[25] = 'UT-1\nDATE 07-07-2025';
    cbseR1[31] = 'WET-4\nDATE :14-07-2025';
    cbseR1[37] = 'WET-5\nDATE 20-07-2025';
    cbseR1[43] = 'WET-7\nDATE: 18-08-2025';
    cbseR1[49] = 'WET-8\nDATE: 25-08-2025';
    cbseR1[55] = 'WET-09\n01-09-2025';
    cbseR1[57] = 'WET-13\n21-10-2025';
    cbseR1[59] = 'UT-5\n27-10-2025';
    cbseR1[61] = 'PRE-MID-TERM(CBSE)';
    cbseR1[69] = 'ATTENDANCE';

    cbseSheet.addRow(cbseR1);

    const cbseR2 = [];
    cbseR2[61] = 'ENG\n40';
    cbseR2[62] = 'BIO\n35';
    cbseR2[63] = 'PHY\n35';
    cbseR2[64] = 'CHE\n35';
    cbseR2[65] = 'OPTIONALS';
    cbseR2[68] = 'TOT\n185/180';
    cbseR2[69] = 'TOTAL NO.OF WORKING DAYS';
    cbseR2[70] = 'ABSENT';
    cbseR2[71] = 'PRESENT';
    cbseR2[72] = 'SICK';
    cbseR2[73] = 'TOTAL';
    cbseSheet.addRow(cbseR2);

    const cbseR3 = [];
    const subs6 = ['BOT', 'ZOO', 'PHY', 'CHE', 'TOT', 'AIR'];
    const subs2 = ['TOT', 'AIR'];

    for (let t = 0; t < 8; t++) {
        const start = 7 + (t * 6);
        subs6.forEach((sub, sIdx) => { cbseR3[start + sIdx] = sub; });
    }
    for (let t = 0; t < 3; t++) {
        const start = 55 + (t * 2);
        subs2.forEach((sub, sIdx) => { cbseR3[start + sIdx] = sub; });
    }
    cbseR3[65] = 'MAT\n40';
    cbseR3[66] = 'IP\n35';
    cbseR3[67] = 'PE\n35';
    cbseSheet.addRow(cbseR3);

    // Merges
    cbseSheet.mergeCells(1, 1, 3, 1);
    cbseSheet.mergeCells(1, 2, 3, 2);
    cbseSheet.mergeCells(1, 3, 3, 3);
    cbseSheet.mergeCells(1, 4, 3, 4);
    cbseSheet.mergeCells(1, 5, 3, 5);
    cbseSheet.mergeCells(1, 6, 3, 6);

    for (let t = 0; t < 8; t++) {
        const c = 7 + (t * 6);
        cbseSheet.mergeCells(1, c, 1, c + 5);
    }
    for (let t = 0; t < 3; t++) {
        const c = 55 + (t * 2);
        cbseSheet.mergeCells(1, c, 1, c + 1);
    }
    cbseSheet.mergeCells(1, 61, 1, 68);
    cbseSheet.mergeCells(2, 61, 3, 61);
    cbseSheet.mergeCells(2, 62, 3, 62);
    cbseSheet.mergeCells(2, 63, 3, 63);
    cbseSheet.mergeCells(2, 64, 3, 64);
    cbseSheet.mergeCells(2, 65, 2, 67);
    cbseSheet.mergeCells(2, 68, 3, 68);

    cbseSheet.mergeCells(1, 69, 1, 73);
    cbseSheet.mergeCells(2, 69, 3, 69);
    cbseSheet.mergeCells(2, 70, 3, 70);
    cbseSheet.mergeCells(2, 71, 3, 71);
    cbseSheet.mergeCells(2, 72, 3, 72);
    cbseSheet.mergeCells(2, 73, 3, 73);

    // Styling Rows 1, 2, 3
    cbseSheet.getRow(1).height = 32;
    cbseSheet.getRow(1).eachCell(cell => {
        cell.fill = headerFillNavy;
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = borderGold;
    });

    cbseSheet.getRow(2).height = 24;
    cbseSheet.getRow(2).eachCell(cell => {
        cell.fill = subHeaderFill;
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFCD34D' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = borderGold;
    });

    cbseSheet.getRow(3).height = 22;
    cbseSheet.getRow(3).eachCell(cell => {
        cell.fill = botHeaderFill;
        cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF0F2057' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = borderGold;
    });

    // Sample Students
    const cbseSamples = [
        [1, '257403819', '7403819', 'M G YASHASWINI', 'CBSE', 'ELITE C', 165, 175, 150, 150, 640, 1322, 135, 143, 84, 74, 436, 2721, 146, 116, 67, 90, 419, 1896, '-', '-', '-', '-', '-', '-', 115, 97, 112, 72, 396, 2487, 116, 128, 96, 92, 432, 2390, 115, 126, 74, 108, 423, 1888, 136, 161, 90, 83, 470, 920, '-', '-', 370, 1912, 458, 1671, 36, 34, 31, 34, 23, 0, 0, 158, 180, 6, 170, 4, 180],
        [2, '257404580', '7404580', 'AMRUTHA LAKSHMI S N', 'CBSE', 'ELITE A', 170, 175, 145, 145, 635, 1416, 145, 127, 81, 111, 464, 2309, 140, 126, 72, 102, 440, 1603, 175, 95, 51, 56, 377, 2242, 150, 145, 122, 44, 461, 1516, 117, 106, 122, 117, 462, 1962, 100, 115, 89, 59, 363, 2798, 111, 125, 115, 60, 411, 1588, 395, 2419, 432, 1165, 493, 1227, 39, 35, 33, 31, 0, 0, 28, 166, 180, 4, 172, 4, 180]
    ];
    cbseSamples.forEach(rowArr => {
        const added = cbseSheet.addRow(rowArr);
        added.height = 20;
        added.eachCell((cell, colNum) => {
            cell.font = { name: 'Segoe UI', size: 9 };
            cell.alignment = { vertical: 'middle', horizontal: colNum === 4 ? 'left' : 'center' };
        });
    });

    // ---------------------------------------------------------
    // 2. STATE_PU_Track_Sheet
    // ---------------------------------------------------------
    const puSheet = workbook.addWorksheet('STATE_PU_Track_Sheet', { views: [{ showGridLines: true }] });

    const puR1 = [];
    puR1[1] = 'S NO';
    puR1[2] = 'OMR';
    puR1[3] = 'OMR';
    puR1[4] = 'STUDENT NAME';
    puR1[5] = 'BOARD';
    puR1[6] = 'SECTION';
    puR1[7] = 'WET- 1\nDATE :-16-06-2025';
    puR1[13] = 'WET- 2\nDATE: 23-06-2025';
    puR1[19] = 'WET-3\nDATE : 30-06-2025';
    puR1[25] = 'UT-1\nDATE 07-07-2025';
    puR1[31] = 'WET-8\nDATE: 25-08-2025';
    puR1[37] = 'PRE-MID-TERM(PU)';
    puR1[48] = 'ATTENDANCE';
    puSheet.addRow(puR1);

    const puR2 = [];
    puR2[37] = 'ENG\n40';
    puR2[38] = 'LANGUAGES';
    puR2[41] = 'BIO\n35';
    puR2[42] = 'PHY\n35';
    puR2[43] = 'CHE\n35';
    puR2[44] = 'OPT';
    puR2[47] = 'TOTAL\n225/';
    puR2[48] = 'TOTAL NO.OF WORKING DAYS';
    puR2[49] = 'ABSENT';
    puR2[50] = 'PRESENT';
    puR2[51] = 'SICK';
    puR2[52] = 'TOTAL';
    puSheet.addRow(puR2);

    const puR3 = [];
    for (let t = 0; t < 5; t++) {
        const start = 7 + (t * 6);
        subs6.forEach((sub, sIdx) => { puR3[start + sIdx] = sub; });
    }
    puR3[38] = 'KAN\n40';
    puR3[39] = 'HIN\n40';
    puR3[40] = 'SAN\n40';
    puR3[44] = 'MAT\n40';
    puR3[45] = 'CS\n35';
    puR3[46] = 'ELE\n35';
    puSheet.addRow(puR3);

    // Merges
    puSheet.mergeCells(1, 1, 3, 1);
    puSheet.mergeCells(1, 2, 3, 2);
    puSheet.mergeCells(1, 3, 3, 3);
    puSheet.mergeCells(1, 4, 3, 4);
    puSheet.mergeCells(1, 5, 3, 5);
    puSheet.mergeCells(1, 6, 3, 6);

    for (let t = 0; t < 5; t++) {
        const c = 7 + (t * 6);
        puSheet.mergeCells(1, c, 1, c + 5);
    }

    puSheet.mergeCells(1, 37, 1, 47);
    puSheet.mergeCells(2, 37, 3, 37); // ENG
    puSheet.mergeCells(2, 38, 2, 40); // LANGUAGES
    puSheet.mergeCells(2, 41, 3, 41); // BIO
    puSheet.mergeCells(2, 42, 3, 42); // PHY
    puSheet.mergeCells(2, 43, 3, 43); // CHE
    puSheet.mergeCells(2, 44, 2, 46); // OPT
    puSheet.mergeCells(2, 47, 3, 47); // TOTAL

    puSheet.mergeCells(1, 48, 1, 52); // ATTENDANCE
    puSheet.mergeCells(2, 48, 3, 48);
    puSheet.mergeCells(2, 49, 3, 49);
    puSheet.mergeCells(2, 50, 3, 50);
    puSheet.mergeCells(2, 51, 3, 51);
    puSheet.mergeCells(2, 52, 3, 52);

    // Styling Rows 1, 2, 3
    puSheet.getRow(1).height = 32;
    puSheet.getRow(1).eachCell(cell => {
        cell.fill = headerFillNavy;
        cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = borderGold;
    });

    puSheet.getRow(2).height = 24;
    puSheet.getRow(2).eachCell(cell => {
        cell.fill = subHeaderFill;
        cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFCD34D' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = borderGold;
    });

    puSheet.getRow(3).height = 22;
    puSheet.getRow(3).eachCell(cell => {
        cell.fill = botHeaderFill;
        cell.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF0F2057' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = borderGold;
    });

    const puSamples = [
        [1, '257403848', '7403848', 'Akshara P Achar', 'STATE', 'ELITE S1', 165, 175, 162, 150, 652, 1108, 146, 157, 86, 106, 495, 1891, 135, 126, 81, 117, 459, 1335, 156, 105, 28, 91, 380, 2192, 131, 103, 75, 49, 358, 2462, 35, 40, 0, 0, 34, 35, 34, 38, 0, 0, 216, 180, 5, 172, 3, 180]
    ];
    puSamples.forEach(rowArr => {
        const added = puSheet.addRow(rowArr);
        added.height = 20;
        added.eachCell((cell, colNum) => {
            cell.font = { name: 'Segoe UI', size: 9 };
            cell.alignment = { vertical: 'middle', horizontal: colNum === 4 ? 'left' : 'center' };
        });
    });

    // Column widths
    [cbseSheet, puSheet].forEach(sheet => {
        sheet.getColumn(1).width = 7;
        sheet.getColumn(2).width = 14;
        sheet.getColumn(3).width = 12;
        sheet.getColumn(4).width = 28;
        sheet.getColumn(5).width = 11;
        sheet.getColumn(6).width = 13;
        for (let col = 7; col <= 75; col++) {
            const c = sheet.getColumn(col);
            if (!c.width) c.width = 10;
        }
    });

    await workbook.xlsx.writeFile('scratch/Campus_Ledger_Complete_Template.xlsx');
    console.log('Saved scratch/Campus_Ledger_Complete_Template.xlsx successfully!');
}

testFullLedgerWorkbook().catch(console.error);
