const path = require('path');
const ExcelJS = require(path.resolve('client/node_modules/exceljs'));
const fs = require('fs');

async function testGenerate() {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sri Chaitanya Educational Institutions';
    workbook.created = new Date();

    // ---------------------------------------------------------
    // SHEET 1: CBSE_Track_Sheet
    // ---------------------------------------------------------
    const cbseSheet = workbook.addWorksheet('CBSE_Track_Sheet', {
        views: [{ showGridLines: true }]
    });

    const r1 = [];
    r1[1] = 'S NO';
    r1[2] = 'OMR';
    r1[3] = 'OMR';
    r1[4] = 'STUDENT NAME';
    r1[5] = 'BOARD';
    r1[6] = 'SECTION';
    r1[7] = 'WET- 1\nDATE :-16-06-2025';
    r1[13] = 'WET- 2\nDATE: 23-06-2025';
    r1[19] = 'WET-3\nDATE : 30-06-2025';
    r1[25] = 'UT-1\nDATE 07-07-2025';
    r1[31] = 'WET-4\nDATE :14-07-2025';
    r1[37] = 'WET-5\nDATE 20-07-2025';
    r1[43] = 'WET-7\nDATE: 18-08-2025';
    r1[49] = 'WET-8\nDATE: 25-08-2025';
    r1[55] = 'WET-09\n01-09-2025';
    r1[57] = 'WET-13\n21-10-2025';
    r1[59] = 'UT-5\n27-10-2025';
    r1[61] = 'PRE-MID-TERM(CBSE)';

    cbseSheet.addRow(r1);

    // Row 2: Mid-level headers / Subgroups
    const r2 = [];
    r2[61] = 'ENG\n40';
    r2[62] = 'BIO\n35';
    r2[63] = 'PHY\n35';
    r2[64] = 'CHE\n35';
    r2[65] = 'OPTIONALS';
    r2[68] = 'TOT\n185/180';
    cbseSheet.addRow(r2);

    // Row 3: Bottom-level subjects
    const r3 = [];
    const neetSubs6 = ['BOT', 'ZOO', 'PHY', 'CHE', 'TOT', 'AIR'];
    const neetSubs2 = ['TOT', 'AIR'];

    // 8 tests with 6 cols each
    for (let t = 0; t < 8; t++) {
        const start = 7 + (t * 6);
        neetSubs6.forEach((sub, sIdx) => {
            r3[start + sIdx] = sub;
        });
    }
    // 3 tests with 2 cols each
    for (let t = 0; t < 3; t++) {
        const start = 55 + (t * 2);
        neetSubs2.forEach((sub, sIdx) => {
            r3[start + sIdx] = sub;
        });
    }
    // Optionals
    r3[65] = 'MAT\n40';
    r3[66] = 'IP\n35';
    r3[67] = 'PE\n35';
    cbseSheet.addRow(r3);

    // Merges for Row 1
    cbseSheet.mergeCells(1, 1, 3, 1); // S NO
    cbseSheet.mergeCells(1, 2, 3, 2); // OMR (9)
    cbseSheet.mergeCells(1, 3, 3, 3); // OMR (7)
    cbseSheet.mergeCells(1, 4, 3, 4); // STUDENT NAME
    cbseSheet.mergeCells(1, 5, 3, 5); // BOARD
    cbseSheet.mergeCells(1, 6, 3, 6); // SECTION

    for (let t = 0; t < 8; t++) {
        const c = 7 + (t * 6);
        cbseSheet.mergeCells(1, c, 1, c + 5);
    }
    for (let t = 0; t < 3; t++) {
        const c = 55 + (t * 2);
        cbseSheet.mergeCells(1, c, 1, c + 1);
    }
    cbseSheet.mergeCells(1, 61, 1, 68); // PRE-MID-TERM(CBSE)
    cbseSheet.mergeCells(2, 61, 3, 61); // ENG
    cbseSheet.mergeCells(2, 62, 3, 62); // BIO
    cbseSheet.mergeCells(2, 63, 3, 63); // PHY
    cbseSheet.mergeCells(2, 64, 3, 64); // CHE
    cbseSheet.mergeCells(2, 65, 2, 67); // OPTIONALS
    cbseSheet.mergeCells(2, 68, 3, 68); // TOT

    // Sample Row
    const sRow = [
        null,
        1,
        '257403819',
        '7403819',
        'M G YASHASWINI',
        'CBSE',
        'ELITE C',
        // WET-1
        165, 175, 150, 150, 640, 1322,
        // WET-2
        135, 143, 84, 74, 436, 2721,
        // WET-3
        146, 116, 67, 90, 419, 1896,
        // UT-1
        '-', '-', '-', '-', '-', '-',
        // WET-4
        115, 97, 112, 72, 396, 2487,
        // WET-5
        116, 128, 96, 92, 432, 2390,
        // WET-7
        115, 126, 74, 108, 423, 1888,
        // WET-8
        136, 161, 90, 83, 470, 920,
        // WET-09
        '-', '-',
        // WET-13
        370, 1912,
        // UT-5
        458, 1671,
        // Pre-Mid-Term
        36, 34, 31, 34, 23, 0, 0, 158
    ];
    cbseSheet.addRow(sRow);

    await workbook.xlsx.writeFile('scratch/Test_Generated_Template.xlsx');
    console.log('Saved Test_Generated_Template.xlsx successfully!');
}

testGenerate().catch(console.error);
