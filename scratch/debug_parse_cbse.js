const path = require('path');
const ExcelJS = require(path.resolve('client/node_modules/exceljs'));

function getVal(c) {
    if (!c || c.value === null || c.value === undefined) return '';
    if (typeof c.value === 'object') {
        if (c.value.result !== undefined && c.value.result !== null) return c.value.result;
        if (c.value.text !== undefined) return c.value.text;
        if (c.value instanceof Date) return c.value.toISOString().split('T')[0];
        return '';
    }
    return c.value;
}

async function debugParse() {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('C:/Users/Administrator/.gemini/antigravity/brain/8fbdb510-dcfa-425a-9491-b1e42849ba76/.user_uploaded/media_1795584830408_b9715aee.xlsx');
    
    const ws = wb.getWorksheet('ELITE CBSE');
    const rows = [];
    ws.eachRow({ includeEmpty: false }, row => {
        const rVals = [];
        for (let col = 1; col <= ws.columnCount; col++) {
            const val = getVal(row.getCell(col));
            rVals.push(val !== undefined && val !== null ? String(val).trim() : '');
        }
        rows.push(rVals);
    });

    console.log('Row 0 (Header 1):', rows[0].slice(0, 15));
    console.log('Row 1 (Header 2):', rows[1].slice(0, 15));
    console.log('Row 2 (Header 3):', rows[2].slice(0, 15));

    // Test block extraction
    const h0 = rows[0];
    const h1 = rows[1];
    const h2 = rows[2];
    console.log('Total columns in h0:', h0.length);

    const testBlocks = [];
    let curBlock = null;
    for (let c = 6; c < h0.length; c++) {
        const topH = (h0[c] || '').trim();
        const midH = (h1[c] || '').trim();
        const botH = (h2[c] || '').trim();

        if (topH && (topH.toUpperCase().includes('WET') || topH.toUpperCase().includes('UT-') || topH.toUpperCase().includes('PRE-MID-TERM'))) {
            if (!curBlock || curBlock.rawName !== topH) {
                if (curBlock) testBlocks.push(curBlock);
                curBlock = {
                    startCol: c,
                    endCol: c,
                    rawName: topH,
                    isBoard: topH.toUpperCase().includes('PRE-MID-TERM'),
                    cols: []
                };
            }
        } else if (topH && topH.toUpperCase().includes('ATTENDANCE')) {
            if (!curBlock || curBlock.rawName !== topH) {
                if (curBlock) testBlocks.push(curBlock);
                curBlock = {
                    startCol: c,
                    endCol: c,
                    rawName: topH,
                    isAttendance: true,
                    cols: []
                };
            }
        }
        if (curBlock) {
            curBlock.endCol = c;
            curBlock.cols.push({ colIdx: c, top: topH, mid: midH, bot: botH });
        }
    }
    if (curBlock) testBlocks.push(curBlock);

    console.log('Detected Test Blocks:', testBlocks.map(tb => ({
        name: tb.rawName.replace(/\n/g, ' '),
        cols: tb.cols.length,
        isBoard: tb.isBoard
    })));

    // Now test row 3 (which is student 1: Yashaswini)
    const yashaRow = rows[3];
    console.log('Student row length:', yashaRow.length, 'ID:', yashaRow[2], 'Name:', yashaRow[3]);
    testBlocks.forEach(tb => {
        const vals = tb.cols.map(col => yashaRow[col.colIdx]);
        console.log(`Test [${tb.rawName.replace(/\n/g, ' ')}]:`, vals);
    });
}

debugParse().catch(console.error);
