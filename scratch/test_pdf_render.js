const path = require('path');
const { jsPDF } = require(path.resolve('client/node_modules/jspdf'));
let autoTable = require(path.resolve('client/node_modules/jspdf-autotable'));
if (autoTable.default) autoTable = autoTable.default;
const fs = require('fs');

async function testPdf() {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Add page border
    doc.setDrawColor(201, 150, 43);
    doc.setLineWidth(0.8);
    doc.rect(10, 10, 190, 277);

    doc.setFontSize(16);
    doc.setTextColor(15, 32, 87);
    doc.text('Sri Chaitanya Educational Institutions', 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text('PROGRESS REPORT CARD', 105, 27, { align: 'center' });

    // Student Info
    autoTable(doc, {
        body: [
            ['Name of the Student', 'M G YASHASWINI'],
            ['Student ID', '7403819'],
            ['Section', 'ELITE C'],
            ['Campus and Stream', 'Indiranagar Campus · Medical (NEET) & CBSE Board']
        ],
        startY: 32,
        margin: { left: 14, right: 14 },
        theme: 'plain',
        styles: { fontSize: 8.5, cellPadding: 1.5 }
    });

    let currentY = doc.lastAutoTable.finalY + 6;

    // Table 1: Medical (NEET)
    doc.setFontSize(12);
    doc.setTextColor(15, 32, 87);
    doc.text('Medical (NEET) - Test-wise record', 14, currentY);
    currentY += 4;

    const medRows = [
        ['WET- 1', '16/06/2025', '640', '165', '175', '150', '150'],
        ['WET- 2', '23/06/2025', '436', '135', '143', '84', '74'],
        ['WET-3', '30/06/2025', '419', '146', '116', '67', '90'],
        ['WET-4', '14/07/2025', '396', '115', '97', '112', '72'],
        ['WET-5', '20/07/2025', '432', '116', '128', '96', '92'],
        ['WET-7', '18/08/2025', '423', '115', '126', '74', '108'],
        ['WET-8', '25/08/2025', '470', '136', '161', '90', '83'],
        ['WET-13', '21/10/2025', '370', '-', '-', '-', '-'],
        ['UT-5', '27/10/2025', '458', '-', '-', '-', '-'],
        ['Average', '-', '450', '130', '135', '92', '96']
    ];

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
            [
                '720', '180', '180', '180', '180'
            ]
        ],
        body: medRows,
        startY: currentY,
        margin: { left: 14, right: 14 },
        theme: 'plain',
        headStyles: { fillColor: [15, 32, 87], textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
        styles: { fontSize: 8, halign: 'center', cellPadding: 1.5 }
    });

    currentY = doc.lastAutoTable.finalY + 6;

    // Table 2: CBSE Board
    doc.setFontSize(12);
    doc.setTextColor(15, 32, 87);
    doc.text('CBSE Board - Test-wise record', 14, currentY);
    currentY += 4;

    const cbseRows = [
        ['Pre-Mid-Term Board Exam', '27/10/2025', '158', '36', '34', '31', '34', '23'],
        ['Average', '-', '158', '36', '34', '31', '34', '23']
    ];

    autoTable(doc, {
        head: [
            [
                { content: 'Test', rowSpan: 2 },
                { content: 'Date', rowSpan: 2 },
                { content: 'Total' },
                { content: 'ENGLISH' },
                { content: 'BIOLOGY' },
                { content: 'PHYSICS' },
                { content: 'CHEMISTRY' },
                { content: 'MATHS' }
            ],
            [
                '185', '40', '35', '35', '35', '40'
            ]
        ],
        body: cbseRows,
        startY: currentY,
        margin: { left: 14, right: 14 },
        theme: 'plain',
        headStyles: { fillColor: [15, 32, 87], textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
        styles: { fontSize: 8, halign: 'center', cellPadding: 1.5 }
    });

    currentY = doc.lastAutoTable.finalY + 8;
    console.log('Final Y on Page 1:', currentY);

    const sigY = 271;
    doc.setDrawColor(207, 214, 232);
    doc.line(22, sigY, 70, sigY);
    doc.line(82, sigY, 128, sigY);
    doc.line(140, sigY, 188, sigY);
    doc.text("Class Teacher", 46, sigY + 4.5, { align: 'center' });
    doc.text("Parent / Guardian", 105, sigY + 4.5, { align: 'center' });
    doc.text("Principal", 164, sigY + 4.5, { align: 'center' });

    fs.writeFileSync('scratch/Test_Report_Output.pdf', Buffer.from(doc.output('arraybuffer')));
    console.log('Successfully generated scratch/Test_Report_Output.pdf!');
}

testPdf().catch(console.error);
