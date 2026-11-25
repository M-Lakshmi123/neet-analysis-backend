const path = require('path');
const ExcelJS = require(path.resolve('client/node_modules/exceljs'));
const { jsPDF } = require(path.resolve('client/node_modules/jspdf'));
const autoTableModule = require(path.resolve('client/node_modules/jspdf-autotable'));
const autoTable = autoTableModule.default || autoTableModule;
const fs = require('fs');

// Verify parsing of the user's actual uploaded file
const code = fs.readFileSync('scratch/test_user_file_fix.js', 'utf8');
eval(code.substring(0, code.indexOf('async function testUserFile()')));

async function verifyE2E() {
    console.log('--- 1. Testing User Excel File Reading & Parsing ---');
    const userWb = new ExcelJS.Workbook();
    await userWb.xlsx.readFile('C:/Users/Administrator/.gemini/antigravity/brain/8fbdb510-dcfa-425a-9491-b1e42849ba76/.user_uploaded/media_1795584830408_b9715aee.xlsx');

    const sheetGrids = [];
    userWb.worksheets.forEach(ws => {
        if (ws.name === 'Instructions') return;
        const wsRows = [];
        ws.eachRow({ includeEmpty: false }, row => {
            const rVals = [];
            for (let col = 1; col <= Math.max(ws.columnCount, 75); col++) {
                const val = getVal(row.getCell(col));
                rVals.push(val !== undefined && val !== null ? String(val).trim() : '');
            }
            wsRows.push(rVals);
        });
        if (wsRows.length > 0) {
            sheetGrids.push({ name: ws.name, rows: wsRows });
        }
    });

    const ledgerSheets = sheetGrids.filter(sg => isHorizontalLedger(sg.rows));
    console.log(`Found ${ledgerSheets.length} horizontal ledger sheets:`, ledgerSheets.map(s => s.name));

    let allStudents = [];
    ledgerSheets.forEach(sg => {
        const parsed = parseHorizontalLedger(sg.rows);
        allStudents.push(...parsed);
    });
    console.log(`Parsed total ${allStudents.length} students across both sheets.`);

    const cbseStudent = allStudents.find(s => s.board.includes('CBSE'));
    const puStudent = allStudents.find(s => s.board.includes('STATE') || s.board.includes('PU'));

    console.log(`\nCBSE Student: ${cbseStudent.name} (${cbseStudent.id}), Sec: ${cbseStudent.section}`);
    console.log(`  Medical tests: ${cbseStudent.streamTests.MEDICAL.length}`);
    console.log(`  CBSE tests: ${cbseStudent.streamTests.CBSE.length}`);

    console.log(`\nPU Student: ${puStudent.name} (${puStudent.id}), Sec: ${puStudent.section}`);
    console.log(`  Medical tests: ${puStudent.streamTests.MEDICAL.length}`);
    console.log(`  PU tests: ${puStudent.streamTests.PU.length}`);

    console.log('\n--- 2. Testing PDF Rendering for CBSE & PU Students ---');
    const doc = new jsPDF('p', 'mm', 'a4');

    // Helper to render student table in doc
    const renderStudentTables = (stud, isFirst) => {
        if (!isFirst) doc.addPage();

        // Header
        doc.setFillColor(15, 32, 87);
        doc.rect(14, 12, 182, 14, 'F');
        doc.setFontSize(14);
        doc.setTextColor(255, 255, 255);
        doc.text('SRI CHAITANYA EDUCATIONAL INSTITUTIONS', 105, 20, { align: 'center' });

        // Student Info
        doc.setFontSize(10);
        doc.setTextColor(15, 32, 87);
        doc.text(`Student: ${stud.name}  |  ID: ${stud.id}  |  Section: ${stud.section}  |  Stream: ${stud.stream}`, 14, 33);

        let currentY = 38;

        // Render Medical Table
        const medTests = stud.streamTests.MEDICAL || [];
        if (medTests.length > 0) {
            doc.setFontSize(11);
            doc.setTextColor(15, 32, 87);
            doc.text('Medical (NEET) - Test-wise record', 14, currentY);
            currentY += 4;

            const rows = medTests.map(t => [
                t.testName,
                t.date || '-',
                String(t.total || '-'),
                String(t.marks?.BOTANY !== undefined ? t.marks.BOTANY : '-'),
                String(t.marks?.ZOOLOGY !== undefined ? t.marks.ZOOLOGY : '-'),
                String(t.marks?.PHYSICS !== undefined ? t.marks.PHYSICS : '-'),
                String(t.marks?.CHEMISTRY !== undefined ? t.marks.CHEMISTRY : '-')
            ]);

            autoTable(doc, {
                head: [
                    [
                        { content: 'Test', rowSpan: 2 },
                        { content: 'Date', rowSpan: 2 },
                        { content: 'Total' },
                        { content: 'BOTANY' },
                        { content: 'ZOOLOGY' },
                        { content: 'PHYSICS' },
                        { content: 'CHEMISTRY' }
                    ],
                    ['720', '180', '180', '180', '180']
                ],
                body: rows,
                startY: currentY,
                theme: 'grid',
                headStyles: { fillColor: [15, 32, 87], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
                styles: { fontSize: 7.5, halign: 'center', cellPadding: 1.5 },
                margin: { left: 14, right: 14 }
            });
            currentY = doc.lastAutoTable.finalY + 6;
        }

        // Render Board Table (CBSE or PU)
        const boardKey = stud.streamTests.CBSE ? 'CBSE' : stud.streamTests.PU ? 'PU' : null;
        if (boardKey) {
            const bTests = stud.streamTests[boardKey] || [];
            if (bTests.length > 0) {
                const subs = [...new Set(bTests.flatMap(t => Object.keys(t.marks || {})))].filter(Boolean);
                doc.setFontSize(11);
                doc.setTextColor(15, 32, 87);
                doc.text(`${boardKey === 'CBSE' ? 'CBSE Board' : 'PU Board'} - Test-wise record`, 14, currentY);
                currentY += 4;

                const headRow1 = [
                    { content: 'Test', rowSpan: 2 },
                    { content: 'Date', rowSpan: 2 },
                    { content: 'Total' },
                    ...subs.map(s => ({ content: s }))
                ];
                const headRow2 = [
                    boardKey === 'CBSE' ? '185' : '225',
                    ...subs.map(s => (['ENGLISH', 'MATHS', 'KANNADA', 'HINDI', 'SANSKRIT'].includes(s) ? '40' : '35'))
                ];

                const rows = bTests.map(t => [
                    t.testName,
                    t.date || '-',
                    String(t.total || '-'),
                    ...subs.map(s => String(t.marks?.[s] !== undefined ? t.marks[s] : '-'))
                ]);

                autoTable(doc, {
                    head: [headRow1, headRow2],
                    body: rows,
                    startY: currentY,
                    theme: 'grid',
                    headStyles: { fillColor: [23, 43, 107], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
                    styles: { fontSize: 7.5, halign: 'center', cellPadding: 1.5 },
                    margin: { left: 14, right: 14 }
                });
                currentY = doc.lastAutoTable.finalY + 6;
            }
        }
        console.log(`Rendered ${stud.name}: finished at Y = ${currentY.toFixed(1)} mm on page ${doc.internal.getNumberOfPages()}`);
    };

    renderStudentTables(cbseStudent, true);
    renderStudentTables(puStudent, false);

    const pdfBuffer = doc.output('arraybuffer');
    fs.writeFileSync('scratch/Full_Verification_Test.pdf', Buffer.from(pdfBuffer));
    console.log('Saved scratch/Full_Verification_Test.pdf with', doc.internal.getNumberOfPages(), 'pages.');
}

verifyE2E().catch(console.error);
