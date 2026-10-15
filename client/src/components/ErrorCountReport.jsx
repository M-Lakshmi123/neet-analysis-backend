import React, { useState, useEffect, useMemo } from 'react';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import LoadingTimer from './LoadingTimer';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import Modal from './Modal';
import { logActivity } from '../utils/activityLogger';
import { useAuth } from './auth/AuthProvider';

// Helper to format test ranges like "MT-01 TO MT-05 & PT-01"
const formatTestRange = (tests) => {
    if (!tests || tests.length === 0) return '';
    if (tests.length === 1) return tests[0];

    const groups = [];
    let currentGroup = [];
    let currentPrefix = '';

    tests.forEach((t) => {
        const match = t.match(/^([A-Za-z]+)/);
        const prefix = match ? match[1].toUpperCase() : '';

        if (currentGroup.length === 0 || prefix === currentPrefix) {
            currentGroup.push(t);
            currentPrefix = prefix;
        } else {
            groups.push(currentGroup);
            currentGroup = [t];
            currentPrefix = prefix;
        }
    });
    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }

    return groups.map(grp => {
        if (grp.length === 1) return grp[0];
        return `${grp[0]} TO ${grp[grp.length - 1]}`;
    }).join(' & ');
};

// Helper to compute student averages across tests and total error counts
const computeStudentStats = (student, tests) => {
    let totSum = 0, totCount = 0;
    let airSum = 0, airCount = 0;
    let botSum = 0, botCount = 0;
    let bRankSum = 0, bRankCount = 0;
    let zooSum = 0, zooCount = 0;
    let zRankSum = 0, zRankCount = 0;
    let phySum = 0, phyCount = 0;
    let pRankSum = 0, pRankCount = 0;
    let cheSum = 0, cheCount = 0;
    let cRankSum = 0, cRankCount = 0;

    let bot_w = 0, bot_u = 0;
    let zoo_w = 0, zoo_u = 0;
    let phy_w = 0, phy_u = 0;
    let che_w = 0, che_u = 0;

    tests.forEach(testName => {
        const t = student.tests?.[testName];
        if (!t) return;

        const isValidNum = (v) => v !== null && v !== undefined && v !== '' && v !== '-' && !isNaN(Number(v)) && Number(v) > 0;

        if (isValidNum(t.tot)) { totSum += Number(t.tot); totCount++; }
        if (isValidNum(t.air)) { airSum += Number(t.air); airCount++; }

        if (isValidNum(t.bot)) { botSum += Number(t.bot); botCount++; }
        if (isValidNum(t.bot_rank)) { bRankSum += Number(t.bot_rank); bRankCount++; }

        if (isValidNum(t.zoo)) { zooSum += Number(t.zoo); zooCount++; }
        if (isValidNum(t.zoo_rank)) { zRankSum += Number(t.zoo_rank); zRankCount++; }

        if (isValidNum(t.phy)) { phySum += Number(t.phy); phyCount++; }
        if (isValidNum(t.phy_rank)) { pRankSum += Number(t.phy_rank); pRankCount++; }

        if (isValidNum(t.che)) { cheSum += Number(t.che); cheCount++; }
        if (isValidNum(t.che_rank)) { cRankSum += Number(t.che_rank); cRankCount++; }

        bot_w += Number(t.bot_w) || 0;
        bot_u += Number(t.bot_u) || 0;
        zoo_w += Number(t.zoo_w) || 0;
        zoo_u += Number(t.zoo_u) || 0;
        phy_w += Number(t.phy_w) || 0;
        phy_u += Number(t.phy_u) || 0;
        che_w += Number(t.che_w) || 0;
        che_u += Number(t.che_u) || 0;
    });

    return {
        avgTot: totCount > 0 ? parseFloat((totSum / totCount).toFixed(1)) : 0,
        totCount,
        avgAir: airCount > 0 ? Math.round(airSum / airCount) : '-',
        avgBot: botCount > 0 ? parseFloat((botSum / botCount).toFixed(2)) : 0,
        avgBRank: bRankCount > 0 ? Math.round(bRankSum / bRankCount) : '-',
        avgZoo: zooCount > 0 ? parseFloat((zooSum / zooCount).toFixed(2)) : 0,
        avgZRank: zRankCount > 0 ? Math.round(zRankSum / zRankCount) : '-',
        avgPhy: phyCount > 0 ? parseFloat((phySum / phyCount).toFixed(2)) : 0,
        avgPRank: pRankCount > 0 ? Math.round(pRankSum / pRankCount) : '-',
        avgChe: cheCount > 0 ? parseFloat((cheSum / cheCount).toFixed(2)) : 0,
        avgCRank: cRankCount > 0 ? Math.round(cRankSum / cRankCount) : '-',
        bot_w, bot_u,
        zoo_w, zoo_u,
        phy_w, phy_u,
        che_w, che_u
    };
};

const ErrorCountReport = ({ filters }) => {
    const { userData } = useAuth();
    const [data, setData] = useState({ students: [], tests: [] });
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    // Precalculate student averages & stats
    const studentStatsMap = useMemo(() => {
        const map = new Map();
        if (!data.students || !data.tests) return map;
        data.students.forEach(student => {
            map.set(student.STUD_ID, computeStudentStats(student, data.tests));
        });
        return map;
    }, [data]);

    // Sort students by average TOT descending (ties by name)
    const sortedStudents = useMemo(() => {
        if (!data.students) return [];
        return [...data.students].sort((a, b) => {
            const aStats = studentStatsMap.get(a.STUD_ID);
            const bStats = studentStatsMap.get(b.STUD_ID);
            const aTot = aStats ? aStats.avgTot : 0;
            const bTot = bStats ? bStats.avgTot : 0;
            if (bTot !== aTot) return bTot - aTot;
            return (a.name || '').localeCompare(b.name || '');
        });
    }, [data.students, studentStatsMap]);

    const fetchData = async () => {
        if (!filters.test || filters.test.length === 0) {
            setModal({
                isOpen: true,
                type: 'info',
                title: 'Select Test',
                message: 'Please select at least one test from the filters.',
                onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
            });
            return;
        }

        setLoading(true);
        try {
            const params = buildQueryParams(filters);
            const response = await fetch(`${API_URL}/api/erp/error-count-report?${params.toString()}`);
            if (!response.ok) throw new Error("Failed to fetch data");
            const result = await response.json();
            setData(result);
            if (result.students && result.students.length > 0) {
                logActivity(userData, 'Generated Error Count Report', { studentCount: result.students.length });
            }
        } catch (err) {
            console.error(err);
            setModal({
                isOpen: true,
                type: 'danger',
                title: 'Error',
                message: err.message,
                onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
            });
        } finally {
            setLoading(false);
        }
    };

    const downloadExcel = async () => {
        if (data.students.length === 0) return;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('ERROR COUNT');

        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };

        const cyanBorder = {
            top: { style: 'thin', color: { argb: 'FF00B0F0' } },
            left: { style: 'thin', color: { argb: 'FF00B0F0' } },
            bottom: { style: 'thin', color: { argb: 'FF00B0F0' } },
            right: { style: 'thin', color: { argb: 'FF00B0F0' } }
        };

        // 1. Branding Row 1
        worksheet.mergeCells('A1:B1');
        worksheet.mergeCells('C1:M1');
        const brandCell = worksheet.getCell('C1');
        brandCell.value = {
            richText: [
                { text: 'Sri Chaitanya ', font: { name: 'Impact', size: 32, color: { argb: 'FF00B0F0' } } },
                { text: 'Educational Institutions., India', font: { name: 'Gill Sans MT', size: 32, color: { argb: 'FF00B0F0' } } }
            ]
        };
        brandCell.alignment = { horizontal: 'left', vertical: 'middle' };
        worksheet.getRow(1).height = 65;

        // Add Logo
        try {
            const response = await fetch('/logo.png');
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const imageId = workbook.addImage({
                buffer: arrayBuffer,
                extension: 'png',
            });
            worksheet.addImage(imageId, {
                tl: { col: 0.1, row: 0.1 },
                ext: { width: 70, height: 60 },
                editAs: 'oneCell'
            });
        } catch (e) {
            console.error("Failed to add logo:", e);
        }

        // 2. Report Name Row 2
        worksheet.mergeCells('A2:G2');
        const nameCellR2 = worksheet.getCell('A2');
        nameCellR2.value = "Test Wise 'W' and 'U' Counts";
        nameCellR2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF339966' } };
        nameCellR2.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        nameCellR2.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(2).height = 30;

        // 3. Header Structure Rows 3 and 4
        const row3 = worksheet.getRow(3);
        const row4 = worksheet.getRow(4);

        row3.getCell(1).value = 'STUD_ID';
        row3.getCell(2).value = 'Name';
        row3.getCell(3).value = 'Campus';

        worksheet.mergeCells('A3:A4');
        worksheet.mergeCells('B3:B4');
        worksheet.mergeCells('C3:C4');

        ['A3', 'B3', 'C3'].forEach(addr => {
            const cell = worksheet.getCell(addr);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = thinBorder;
            worksheet.getCell(addr.replace('3', '4')).border = thinBorder;
        });

        const testLabels = [
            'TOT 720', 'All India Rank',
            'BOT', 'B_RANK', 'BOT W Count', 'BOT U Count',
            'ZOO', 'Z_RANK', 'ZOO W Count', 'ZOO U Count',
            'PHY', 'P_RANK', 'PHY W Count', 'PHY U Count',
            'CHE', 'C_RANK', 'CHE W Count', 'CHE U Count'
        ];

        const testPastels = ['FFEBF1DE', 'FFFDE9D9', 'FFE4DFEC', 'FFDCE6F1', 'FFDDD9C4', 'FFFFF2CC'];

        // Add Individual Exam Column Headers
        data.tests.forEach((testName, idx) => {
            const startCol = 4 + (idx * 18);
            const endCol = startCol + 17;
            const pastel = testPastels[idx % testPastels.length];

            // Row 3: Test Name
            worksheet.mergeCells(3, startCol, 3, endCol);
            const testTitleCell = worksheet.getCell(3, startCol);
            testTitleCell.value = testName;
            testTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pastel } };
            testTitleCell.font = { bold: true, size: 12, color: { argb: 'FF000000' } };
            testTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            for (let c = startCol; c <= endCol; c++) {
                worksheet.getCell(3, c).border = thinBorder;
            }

            // Row 4: Sub-headers
            testLabels.forEach((lbl, lblIdx) => {
                const c = startCol + lblIdx;
                const lblCell = worksheet.getCell(4, c);
                lblCell.value = lbl;
                lblCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

                if (lblIdx === 0) {
                    // TOT 720 column header: Dark Blue background, Yellow bold text
                    lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
                    lblCell.font = { bold: true, size: 10, color: { argb: 'FFFFFF00' } };
                    lblCell.border = cyanBorder;
                } else if (lblIdx === 1) {
                    // All India Rank header: Bright Yellow background, Navy bold text
                    lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                    lblCell.font = { bold: true, size: 10, color: { argb: 'FF002060' } };
                    lblCell.border = cyanBorder;
                } else {
                    lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pastel } };
                    lblCell.font = { bold: true, size: 9 };
                    lblCell.border = thinBorder;
                }
            });
        });

        // 4. Summary Section Column Headers (Row 3 & Row 4)
        const summaryStartCol = 4 + (data.tests.length * 18);
        const summaryEndCol = summaryStartCol + 17;
        const totalColsCalc = summaryEndCol;

        // Row 3: Summary Banner
        worksheet.mergeCells(3, summaryStartCol, 3, summaryEndCol);
        const summaryTitleCell = worksheet.getCell(3, summaryStartCol);
        summaryTitleCell.value = `${formatTestRange(data.tests)} TOTAL COUNT (W & U COUNT)`;
        summaryTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC5D9F1' } };
        summaryTitleCell.font = { bold: true, size: 11, color: { argb: 'FF000000' } };
        summaryTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        for (let c = summaryStartCol; c <= summaryEndCol; c++) {
            worksheet.getCell(3, c).border = thinBorder;
        }

        // Row 4: Summary Subheaders
        const summaryLabels = [
            'BOT', 'B_RANK', 'BOT W Count', 'BOT U Count',
            'ZOO', 'Z_RANK', 'ZOO W Count', 'ZOO U Count',
            'PHY', 'P_RANK', 'PHY W Count', 'PHY U Count',
            'CHE', 'C_RANK', 'CHE W Count', 'CHE U Count',
            'TOT 720', 'All India Rank'
        ];

        summaryLabels.forEach((lbl, lblIdx) => {
            const c = summaryStartCol + lblIdx;
            const lblCell = worksheet.getCell(4, c);
            lblCell.value = lbl;
            lblCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

            if (lblIdx === 16) {
                // Summary TOT 720: Dark Blue background, Yellow bold text
                lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
                lblCell.font = { bold: true, size: 10, color: { argb: 'FFFFFF00' } };
                lblCell.border = cyanBorder;
            } else if (lblIdx === 17) {
                // Summary All India Rank: Yellow background, Navy bold text
                lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
                lblCell.font = { bold: true, size: 10, color: { argb: 'FF002060' } };
                lblCell.border = cyanBorder;
            } else {
                lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
                lblCell.font = { bold: true, size: 9 };
                lblCell.border = thinBorder;
            }
        });

        worksheet.getRow(3).height = 30;
        worksheet.getRow(4).height = 40;

        // 5. Data Rows (Starting Row 5)
        sortedStudents.forEach(student => {
            const vals = [student.STUD_ID || '', student.name || '', student.campus || ''];

            // Individual exam values
            data.tests.forEach(testName => {
                const t = student.tests?.[testName] || {};
                const hasScore = (v) => v !== null && v !== undefined && v !== '' && v !== '-' && !isNaN(Number(v)) && Number(v) > 0;
                vals.push(
                    hasScore(t.tot) ? Number(t.tot) : '-',
                    hasScore(t.air) ? Number(t.air) : '-',
                    hasScore(t.bot) ? Number(t.bot) : '-',
                    hasScore(t.bot_rank) ? Number(t.bot_rank) : '-',
                    Number(t.bot_w) || 0,
                    Number(t.bot_u) || 0,
                    hasScore(t.zoo) ? Number(t.zoo) : '-',
                    hasScore(t.zoo_rank) ? Number(t.zoo_rank) : '-',
                    Number(t.zoo_w) || 0,
                    Number(t.zoo_u) || 0,
                    hasScore(t.phy) ? Number(t.phy) : '-',
                    hasScore(t.phy_rank) ? Number(t.phy_rank) : '-',
                    Number(t.phy_w) || 0,
                    Number(t.phy_u) || 0,
                    hasScore(t.che) ? Number(t.che) : '-',
                    hasScore(t.che_rank) ? Number(t.che_rank) : '-',
                    Number(t.che_w) || 0,
                    Number(t.che_u) || 0
                );
            });

            // Summary values
            const sStats = studentStatsMap.get(student.STUD_ID) || {};
            vals.push(
                sStats.avgBot > 0 ? sStats.avgBot : '-',
                sStats.avgBRank !== '-' ? sStats.avgBRank : '-',
                sStats.bot_w || 0,
                sStats.bot_u || 0,
                sStats.avgZoo > 0 ? sStats.avgZoo : '-',
                sStats.avgZRank !== '-' ? sStats.avgZRank : '-',
                sStats.zoo_w || 0,
                sStats.zoo_u || 0,
                sStats.avgPhy > 0 ? sStats.avgPhy : '-',
                sStats.avgPRank !== '-' ? sStats.avgPRank : '-',
                sStats.phy_w || 0,
                sStats.phy_u || 0,
                sStats.avgChe > 0 ? sStats.avgChe : '-',
                sStats.avgCRank !== '-' ? sStats.avgCRank : '-',
                sStats.che_w || 0,
                sStats.che_u || 0,
                sStats.avgTot > 0 ? Number(sStats.avgTot.toFixed(1)) : '-',
                sStats.avgAir !== '-' ? sStats.avgAir : '-'
            );

            const dataRow = worksheet.addRow(vals);
            dataRow.eachCell((cell, colIdx) => {
                cell.alignment = { horizontal: colIdx <= 3 ? 'left' : 'center', vertical: 'middle' };
                cell.font = { size: 10 };

                if (colIdx <= 3) {
                    cell.border = thinBorder;
                } else if (colIdx < summaryStartCol) {
                    // Individual Exam Columns
                    const relativeIdx = (colIdx - 4) % 18;
                    if (relativeIdx === 0) {
                        // TOT 720: Blue bold font, cyan border
                        cell.font = { bold: true, size: 11, color: { argb: 'FF0070C0' } };
                        cell.border = cyanBorder;
                        if (typeof cell.value === 'number') {
                            cell.numFmt = Number.isInteger(cell.value) ? '0' : '0.0';
                        }
                    } else if (relativeIdx === 1) {
                        // All India Rank: Blue bold italic font, cyan border
                        cell.font = { bold: true, italic: true, size: 11, color: { argb: 'FF0000FF' } };
                        cell.border = cyanBorder;
                    } else if ([4, 8, 12, 16].includes(relativeIdx)) {
                        // W count: light pink fill, bold
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE2E2' } };
                        cell.font = { bold: true, size: 10 };
                        cell.border = thinBorder;
                    } else if ([5, 9, 13, 17].includes(relativeIdx)) {
                        // U count: light blue fill, bold
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
                        cell.font = { bold: true, size: 10 };
                        cell.border = thinBorder;
                    } else {
                        cell.border = thinBorder;
                    }
                } else {
                    // Summary Section Columns
                    const summaryRelIdx = colIdx - summaryStartCol;
                    if (summaryRelIdx === 16) {
                        // Summary TOT 720: Blue bold font, cyan border, 1 decimal place
                        cell.font = { bold: true, size: 11, color: { argb: 'FF0070C0' } };
                        cell.border = cyanBorder;
                        if (typeof cell.value === 'number') {
                            cell.numFmt = '0.0';
                        }
                    } else if (summaryRelIdx === 17) {
                        // Summary All India Rank: Blue bold italic font, cyan border
                        cell.font = { bold: true, italic: true, size: 11, color: { argb: 'FF0000FF' } };
                        cell.border = cyanBorder;
                    } else if ([2, 6, 10, 14].includes(summaryRelIdx)) {
                        // Summary W counts
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE2E2' } };
                        cell.font = { bold: true, size: 10 };
                        cell.border = thinBorder;
                    } else if ([3, 7, 11, 15].includes(summaryRelIdx)) {
                        // Summary U counts
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
                        cell.font = { bold: true, size: 10 };
                        cell.border = thinBorder;
                    } else {
                        cell.border = thinBorder;
                        if (typeof cell.value === 'number' && !Number.isInteger(cell.value)) {
                            cell.numFmt = '0.00';
                        }
                    }
                }
            });
        });

        // 6. Column Widths
        worksheet.getColumn(1).width = 15;
        worksheet.getColumn(2).width = 30;
        worksheet.getColumn(3).width = 25;

        // Individual exams
        for (let i = 0; i < data.tests.length; i++) {
            const start = 4 + (i * 18);
            worksheet.getColumn(start).width = 11;     // TOT 720
            worksheet.getColumn(start + 1).width = 13; // All India Rank
            for (let j = 2; j < 18; j++) {
                worksheet.getColumn(start + j).width = [4, 5, 8, 9, 12, 13, 16, 17].includes(j) ? 8 : 9;
            }
        }

        // Summary section
        for (let j = 0; j < 16; j++) {
            worksheet.getColumn(summaryStartCol + j).width = [2, 3, 6, 7, 10, 11, 14, 15].includes(j) ? 8 : 9;
        }
        worksheet.getColumn(summaryStartCol + 16).width = 11; // TOT 720
        worksheet.getColumn(summaryStartCol + 17).width = 13; // All India Rank

        // 7. AutoFilter & Freeze Panes
        worksheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: totalColsCalc } };
        worksheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];

        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `Error_Count_Report_${formatDate(new Date(), 'dd-mmm-yy')}.xlsx`;
        saveAs(new Blob([buffer]), fileName);
        logActivity(userData, 'Exported Error Count Excel', { file: fileName });
    };

    return (
        <div className="report-container">
            <LoadingTimer isLoading={loading} />

            <div className="report-actions-top">
                <h3 className="section-title">Error Count Report</h3>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn-primary" onClick={fetchData} style={{ backgroundColor: '#6366f1' }}>
                        View Report
                    </button>
                    <button className="btn-primary" onClick={downloadExcel} disabled={data.students.length === 0} style={{ backgroundColor: '#10b981' }}>
                        Download Excel
                    </button>
                </div>
            </div>

            {data.students.length > 0 ? (
                <div className="report-section" style={{ overflow: 'hidden' }}>
                    <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 350px)', overflow: 'auto' }}>
                        <table className="analysis-table merit-style" style={{ fontSize: '0.7rem' }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                                <tr style={{ backgroundColor: '#008080', color: 'white' }}>
                                    <th rowSpan="2" style={{ minWidth: '80px', border: '1px solid #ddd' }}>STUD_ID</th>
                                    <th rowSpan="2" style={{ minWidth: '150px', border: '1px solid #ddd' }}>Name</th>
                                    <th rowSpan="2" style={{ minWidth: '120px', border: '1px solid #ddd' }}>Campus</th>
                                    {data.tests.map((test, i) => (
                                        <th key={i} colSpan="18" style={{ border: '1px solid #ddd', padding: '8px' }}>{test}</th>
                                    ))}
                                    <th colSpan="18" style={{ backgroundColor: '#c5d9f1', color: '#002060', border: '1px solid #93c5fd', padding: '8px', fontWeight: 'bold' }}>
                                        {formatTestRange(data.tests)} TOTAL COUNT (W & U COUNT)
                                    </th>
                                </tr>
                                <tr style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                                    {/* Test columns */}
                                    {data.tests.map((_, i) => (
                                        <React.Fragment key={i}>
                                            <th style={{ border: '1px solid #00b0f0', backgroundColor: '#002060', color: '#ffff00', fontWeight: 'bold' }}>TOT 720</th>
                                            <th style={{ border: '1px solid #00b0f0', backgroundColor: '#ffff00', color: '#002060', fontWeight: 'bold' }}>All India Rank</th>
                                            <th style={{ border: '1px solid #ddd' }}>BOT</th>
                                            <th style={{ border: '1px solid #ddd' }}>B_R</th>
                                            <th style={{ border: '1px solid #ddd', color: '#b91c1c' }}>W</th>
                                            <th style={{ border: '1px solid #ddd', color: '#1d4ed8' }}>U</th>
                                            <th style={{ border: '1px solid #ddd' }}>ZOO</th>
                                            <th style={{ border: '1px solid #ddd' }}>Z_R</th>
                                            <th style={{ border: '1px solid #ddd', color: '#b91c1c' }}>W</th>
                                            <th style={{ border: '1px solid #ddd', color: '#1d4ed8' }}>U</th>
                                            <th style={{ border: '1px solid #ddd' }}>PHY</th>
                                            <th style={{ border: '1px solid #ddd' }}>P_R</th>
                                            <th style={{ border: '1px solid #ddd', color: '#b91c1c' }}>W</th>
                                            <th style={{ border: '1px solid #ddd', color: '#1d4ed8' }}>U</th>
                                            <th style={{ border: '1px solid #ddd' }}>CHE</th>
                                            <th style={{ border: '1px solid #ddd' }}>C_R</th>
                                            <th style={{ border: '1px solid #ddd', color: '#b91c1c' }}>W</th>
                                            <th style={{ border: '1px solid #ddd', color: '#1d4ed8' }}>U</th>
                                        </React.Fragment>
                                    ))}

                                    {/* Summary columns */}
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc' }}>BOT</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc' }}>B_R</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc', color: '#b91c1c' }}>W</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc', color: '#1d4ed8' }}>U</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc' }}>ZOO</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc' }}>Z_R</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc', color: '#b91c1c' }}>W</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc', color: '#1d4ed8' }}>U</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc' }}>PHY</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc' }}>P_R</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc', color: '#b91c1c' }}>W</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc', color: '#1d4ed8' }}>U</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc' }}>CHE</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc' }}>C_R</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc', color: '#b91c1c' }}>W</th>
                                    <th style={{ border: '1px solid #ddd', backgroundColor: '#fff2cc', color: '#1d4ed8' }}>U</th>
                                    <th style={{ border: '1px solid #00b0f0', backgroundColor: '#002060', color: '#ffff00', fontWeight: 'bold' }}>TOT 720</th>
                                    <th style={{ border: '1px solid #00b0f0', backgroundColor: '#ffff00', color: '#002060', fontWeight: 'bold' }}>All India Rank</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedStudents.map((student, sIdx) => {
                                    const sStats = studentStatsMap.get(student.STUD_ID) || {};
                                    return (
                                        <tr key={sIdx}>
                                            <td style={{ border: '1px solid #eee' }}>{student.STUD_ID}</td>
                                            <td className="text-left" style={{ border: '1px solid #eee', fontWeight: 'bold' }}>{student.name}</td>
                                            <td className="text-left" style={{ border: '1px solid #eee' }}>{student.campus}</td>

                                            {/* Each Exam */}
                                            {data.tests.map((test, tIdx) => {
                                                const t = student.tests?.[test] || {};
                                                return (
                                                    <React.Fragment key={tIdx}>
                                                        <td style={{ border: '1px solid #00b0f0', color: '#0070c0', fontWeight: 'bold' }}>{t.tot || '-'}</td>
                                                        <td style={{ border: '1px solid #00b0f0', color: '#0000ff', fontWeight: 'bold', fontStyle: 'italic' }}>{t.air || '-'}</td>
                                                        <td style={{ border: '1px solid #eee' }}>{t.bot || '-'}</td>
                                                        <td style={{ border: '1px solid #eee' }}>{t.bot_rank || '-'}</td>
                                                        <td style={{ border: '1px solid #eee', backgroundColor: '#fff5f5', color: '#b91c1c', fontWeight: 'bold' }}>{t.bot_w || 0}</td>
                                                        <td style={{ border: '1px solid #eee', backgroundColor: '#f0f9ff', color: '#1d4ed8', fontWeight: 'bold' }}>{t.bot_u || 0}</td>
                                                        <td style={{ border: '1px solid #eee' }}>{t.zoo || '-'}</td>
                                                        <td style={{ border: '1px solid #eee' }}>{t.zoo_rank || '-'}</td>
                                                        <td style={{ border: '1px solid #eee', backgroundColor: '#fff5f5', color: '#b91c1c', fontWeight: 'bold' }}>{t.zoo_w || 0}</td>
                                                        <td style={{ border: '1px solid #eee', backgroundColor: '#f0f9ff', color: '#1d4ed8', fontWeight: 'bold' }}>{t.zoo_u || 0}</td>
                                                        <td style={{ border: '1px solid #eee' }}>{t.phy || '-'}</td>
                                                        <td style={{ border: '1px solid #eee' }}>{t.phy_rank || '-'}</td>
                                                        <td style={{ border: '1px solid #eee', backgroundColor: '#fff5f5', color: '#b91c1c', fontWeight: 'bold' }}>{t.phy_w || 0}</td>
                                                        <td style={{ border: '1px solid #eee', backgroundColor: '#f0f9ff', color: '#1d4ed8', fontWeight: 'bold' }}>{t.phy_u || 0}</td>
                                                        <td style={{ border: '1px solid #eee' }}>{t.che || '-'}</td>
                                                        <td style={{ border: '1px solid #eee' }}>{t.che_rank || '-'}</td>
                                                        <td style={{ border: '1px solid #eee', backgroundColor: '#fff5f5', color: '#b91c1c', fontWeight: 'bold' }}>{t.che_w || 0}</td>
                                                        <td style={{ border: '1px solid #eee', backgroundColor: '#f0f9ff', color: '#1d4ed8', fontWeight: 'bold' }}>{t.che_u || 0}</td>
                                                    </React.Fragment>
                                                );
                                            })}

                                            {/* Summary Section */}
                                            <td style={{ border: '1px solid #eee' }}>{sStats.avgBot > 0 ? sStats.avgBot : '-'}</td>
                                            <td style={{ border: '1px solid #eee' }}>{sStats.avgBRank !== '-' ? sStats.avgBRank : '-'}</td>
                                            <td style={{ border: '1px solid #eee', backgroundColor: '#fff5f5', color: '#b91c1c', fontWeight: 'bold' }}>{sStats.bot_w || 0}</td>
                                            <td style={{ border: '1px solid #eee', backgroundColor: '#f0f9ff', color: '#1d4ed8', fontWeight: 'bold' }}>{sStats.bot_u || 0}</td>
                                            <td style={{ border: '1px solid #eee' }}>{sStats.avgZoo > 0 ? sStats.avgZoo : '-'}</td>
                                            <td style={{ border: '1px solid #eee' }}>{sStats.avgZRank !== '-' ? sStats.avgZRank : '-'}</td>
                                            <td style={{ border: '1px solid #eee', backgroundColor: '#fff5f5', color: '#b91c1c', fontWeight: 'bold' }}>{sStats.zoo_w || 0}</td>
                                            <td style={{ border: '1px solid #eee', backgroundColor: '#f0f9ff', color: '#1d4ed8', fontWeight: 'bold' }}>{sStats.zoo_u || 0}</td>
                                            <td style={{ border: '1px solid #eee' }}>{sStats.avgPhy > 0 ? sStats.avgPhy : '-'}</td>
                                            <td style={{ border: '1px solid #eee' }}>{sStats.avgPRank !== '-' ? sStats.avgPRank : '-'}</td>
                                            <td style={{ border: '1px solid #eee', backgroundColor: '#fff5f5', color: '#b91c1c', fontWeight: 'bold' }}>{sStats.phy_w || 0}</td>
                                            <td style={{ border: '1px solid #eee', backgroundColor: '#f0f9ff', color: '#1d4ed8', fontWeight: 'bold' }}>{sStats.phy_u || 0}</td>
                                            <td style={{ border: '1px solid #eee' }}>{sStats.avgChe > 0 ? sStats.avgChe : '-'}</td>
                                            <td style={{ border: '1px solid #eee' }}>{sStats.avgCRank !== '-' ? sStats.avgCRank : '-'}</td>
                                            <td style={{ border: '1px solid #eee', backgroundColor: '#fff5f5', color: '#b91c1c', fontWeight: 'bold' }}>{sStats.che_w || 0}</td>
                                            <td style={{ border: '1px solid #eee', backgroundColor: '#f0f9ff', color: '#1d4ed8', fontWeight: 'bold' }}>{sStats.che_u || 0}</td>
                                            <td style={{ border: '1px solid #00b0f0', color: '#0070c0', fontWeight: 'bold', backgroundColor: '#f0fdf4' }}>{sStats.avgTot > 0 ? sStats.avgTot.toFixed(1) : '-'}</td>
                                            <td style={{ border: '1px solid #00b0f0', color: '#0000ff', fontWeight: 'bold', fontStyle: 'italic', backgroundColor: '#fefce8' }}>{sStats.avgAir !== '-' ? sStats.avgAir : '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : !loading && (
                <div className="empty-state">
                    <p>Select at least one Test and click <strong>View Report</strong> to generate the summary.</p>
                </div>
            )}

            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ ...modal, isOpen: false })}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            />
        </div>
    );
};

export default ErrorCountReport;
