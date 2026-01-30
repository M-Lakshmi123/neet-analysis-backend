import React, { useState, useEffect } from 'react';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Modal from './Modal';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';


const AnalysisReport = ({ filters }) => {
    const [examStats, setExamStats] = useState([]);
    const [studentMarks, setStudentMarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [meritSortConfig, setMeritSortConfig] = useState({ key: 'tot', direction: 'desc' });
    const [statsSortConfig, setStatsSortConfig] = useState({ key: 'DATE', direction: 'asc' });
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const queryParams = buildQueryParams(filters).toString();
                // Fetch Table 1: Exam Stats
                const statsRes = await fetch(`${API_URL}/api/exam-stats?${queryParams}`);
                const statsData = await statsRes.json();
                setExamStats(statsData && Array.isArray(statsData) ? statsData : []);

                // Fetch Table 2: Student Marks
                const marksRes = await fetch(`${API_URL}/api/analysis-report?${queryParams}`);
                const marksData = await marksRes.json();
                // backend returns { students: [], exams: [], t_cnt: X }
                setStudentMarks(marksData && marksData.students ? marksData.students : []);

            } catch (error) {
                console.error("Failed to fetch reports:", error);
                setExamStats([]);
                setStudentMarks([]);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchData();
        }, 500); // 500ms debounce for heavy reports

        return () => clearTimeout(timeoutId);
    }, [filters]);

    const calculateTotals = () => {
        if (!studentMarks || studentMarks.length === 0) return null;
        const count = studentMarks.length;
        const sum = (field) => studentMarks.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);
        return {
            tot: Math.round(sum('tot') / count),
            air: Math.round(sum('air') / count),
            bot: Math.round(sum('bot') / count),
            b_rank: Math.round(sum('b_rank') / count),
            zoo: Math.round(sum('zoo') / count),
            z_rank: Math.round(sum('z_rank') / count),
            phy: Math.round(sum('phy') / count),
            p_rank: Math.round(sum('p_rank') / count),
            che: Math.round(sum('che') / count),
            c_rank: Math.round(sum('c_rank') / count),
        };
    };

    const calculateStatsSummary = () => {
        if (!studentMarks || studentMarks.length === 0 || !examStats || examStats.length === 0) return null;

        // Count how many students met thresholds based on their AVERAGE performance across the selection
        const countIf = (predicate) => studentMarks.filter(predicate).length;

        // For non-threshold fields (Attn, Max_T, Max_B, etc.), we take the maximum from the individual exam stats in this selection
        // or we could take average. Looking at the user request "same way if we select multiple exams... take the count of that T>700... want to display at bottom"
        // This implies the threshold columns should be counts of students in the CURRENT selection.

        return {
            Attn: studentMarks.length,
            Max_T: Math.max(...examStats.map(s => Number(s.Max_T) || 0)),
            T_700: countIf(s => Number(s.tot) > 700),
            T_680: countIf(s => Number(s.tot) > 680),
            T_650: countIf(s => Number(s.tot) > 650),
            T_600: countIf(s => Number(s.tot) > 600),
            T_550: countIf(s => Number(s.tot) > 550),
            T_530: countIf(s => Number(s.tot) > 530),
            T_450: countIf(s => Number(s.tot) > 450),
            Max_B: Math.max(...examStats.map(s => Number(s.Max_B) || 0)),
            B_160: countIf(s => Number(s.bot) > 160),
            Max_Z: Math.max(...examStats.map(s => Number(s.Max_Z) || 0)),
            Z_160: countIf(s => Number(s.zoo) > 160),
            Max_P: Math.max(...examStats.map(s => Number(s.Max_P) || 0)),
            P_120: countIf(s => Number(s.phy) > 120),
            P_100: countIf(s => Number(s.phy) > 100),
            Max_C: Math.max(...examStats.map(s => Number(s.Max_C) || 0)),
            C_130: countIf(s => Number(s.che) > 130),
            C_100: countIf(s => Number(s.che) > 100)
        };
    };

    const totals = calculateTotals();
    const statsSummary = calculateStatsSummary();

    const sortData = (data, key, direction) => {
        if (!key) return data;
        const sorted = [...data].sort((a, b) => {
            let aVal, bVal;

            if (key === 'bio') {
                aVal = (Number(a.bot) || 0) + (Number(a.zoo) || 0);
                bVal = (Number(b.bot) || 0) + (Number(b.zoo) || 0);
            } else {
                aVal = a[key];
                bVal = b[key];
            }

            // Handle numeric conversion for marks/ranks
            if (!isNaN(aVal) && !isNaN(bVal)) {
                aVal = Number(aVal);
                bVal = Number(bVal);
            } else if (key === 'DATE') {
                aVal = new Date(aVal);
                bVal = new Date(bVal);
            }

            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    };

    const requestSort = (configSetter, key) => {
        configSetter(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const sortedExamStats = sortData(examStats, statsSortConfig.key, statsSortConfig.direction);
    const sortedStudentMarks = sortData(studentMarks, meritSortConfig.key, meritSortConfig.direction);

    const SortIcon = ({ config, columnKey }) => {
        if (config.key !== columnKey) return <span style={{ opacity: 0.3, marginLeft: '4px', fontSize: '0.6rem' }}>↕</span>;
        return <span style={{ marginLeft: '4px', fontSize: '0.6rem' }}>{config.direction === 'desc' ? '▼' : '▲'}</span>;
    };

    const loadImage = (src) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
        });
    };

    const downloadPDF = async () => {
        try {
            const doc = new jsPDF('l', 'mm', 'a4'); // Landscape
            const logoImg = await loadImage('/logo.png');

            const pageWidth = doc.internal.pageSize.getWidth();
            let currentY = 12; // Reduced top margin

            // 1. Logo & Institution Name - Centered Together
            const title = "SRI CHAITANYA EDUCATIONAL INSTITUTIONS";
            doc.setFont("helvetica", "bold");
            doc.setFontSize(26);
            doc.setTextColor(0, 0, 0);
            const titleWidth = doc.getTextWidth(title);

            if (logoImg) {
                const aspect = logoImg.width / logoImg.height;
                const logoH = 22; // Larger logo for landscape
                const logoW = logoH * aspect;

                // 1. Draw Logo Centered Top
                const logoX = (pageWidth - logoW) / 2;
                doc.addImage(logoImg, 'PNG', logoX, currentY, logoW, logoH, undefined, 'FAST');
                currentY += logoH + 12; // Increased gap to prevent overlap

                // 2. Draw Title Centered below logo
                doc.text(title, pageWidth / 2, currentY, { align: 'center' });
            } else {
                doc.text(title, pageWidth / 2, currentY, { align: 'center' });
            }
            currentY += 8; // Reduced gap below title

            // 3. Custom Header Pattern
            // Pattern: Exam_date_Stream_Test_All India Marks Analysis
            const testDate = examStats.length > 0 ? formatDate(examStats[0].DATE) : formatDate(new Date());
            const stream = (filters.stream && filters.stream.length > 0) ? filters.stream.join(',') : 'SR_ELITE';
            const testName = examStats.length > 0 ? examStats[0].Test : 'GRAND TEST';
            const fullPattern = `${testDate}_${stream}_${testName}_All India Marks Analysis`.replace(/\//g, '-');

            doc.setFont("helvetica", "bolditalic");
            doc.setFontSize(16);
            doc.setTextColor(128, 0, 64); // Reverted to Maroon (#800040)
            doc.text(fullPattern, pageWidth / 2, currentY, { align: 'center' });
            currentY += 8; // Reduced gap below subtitle

            // 4. Data Tables
            const tableColumn = [
                { content: "STUD ID", rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
                { content: "NAME OF THE STUDENT", rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
                { content: "CAMPUS NAME", rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
                { content: "Tot\n720", rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [255, 255, 204] } },
                { content: "AIR", rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [255, 255, 204] } },
                { content: "Botany\nM180", colSpan: 2, styles: { halign: 'center', fillColor: [253, 233, 217] } },
                { content: "Zoology\nM180", colSpan: 2, styles: { halign: 'center', fillColor: [218, 238, 243] } },
                { content: "Biology\n360", rowSpan: 2, styles: { halign: 'center', valign: 'middle', fillColor: [191, 191, 191] } },
                { content: "Physics\nM180", colSpan: 2, styles: { halign: 'center', fillColor: [235, 241, 222] } },
                { content: "Chemistry\nM180", colSpan: 2, styles: { halign: 'center', fillColor: [242, 220, 219] } }
            ];

            const subHeader = [
                { content: "BOT", styles: { halign: 'center', textColor: [0, 0, 0], fillColor: [253, 233, 217] } },
                { content: "RANK", styles: { halign: 'center', textColor: [0, 0, 0], fillColor: [253, 233, 217] } },
                { content: "ZOO", styles: { halign: 'center', textColor: [0, 0, 0], fillColor: [218, 238, 243] } },
                { content: "RANK", styles: { halign: 'center', textColor: [0, 0, 0], fillColor: [218, 238, 243] } },
                { content: "PHY", styles: { halign: 'center', textColor: [0, 0, 0], fillColor: [235, 241, 222] } },
                { content: "RANK", styles: { halign: 'center', textColor: [0, 0, 0], fillColor: [235, 241, 222] } },
                { content: "CHEM", styles: { halign: 'center', textColor: [0, 0, 0], fillColor: [242, 220, 219] } },
                { content: "RANK", styles: { halign: 'center', textColor: [0, 0, 0], fillColor: [242, 220, 219] } }
            ];

            const body = studentMarks.map(row => [
                row.STUD_ID || '',
                (row.name || '').toUpperCase(),
                (row.campus || '').toUpperCase(),
                Math.round(row.tot) || '0',
                Math.round(row.air) || '-',
                Math.round(row.bot) || '0',
                Math.round(row.b_rank) || '-',
                Math.round(row.zoo) || '0',
                Math.round(row.z_rank) || '-',
                Math.round((Number(row.bot) || 0) + (Number(row.zoo) || 0)),
                Math.round(row.phy) || '0',
                Math.round(row.p_rank) || '-',
                Math.round(row.che) || '0',
                Math.round(row.c_rank) || '-'
            ]);

            autoTable(doc, {
                head: [tableColumn, subHeader],
                body: body,
                startY: currentY,
                theme: 'grid',
                styles: {
                    fontSize: 11, // Body font size
                    cellPadding: 0.8, // Slightly more compact to save rows
                    halign: 'center',
                    valign: 'middle',
                    lineColor: [173, 216, 230], // Standard LightBlue #ADD8E6
                    lineWidth: 0.15,
                    textColor: [0, 0, 0], // Default black
                    font: "helvetica",
                    fontStyle: 'bold'
                },
                headStyles: {
                    fillColor: [255, 255, 255],
                    textColor: [0, 0, 0], // Pure Black headers
                    fontStyle: 'bold',
                    lineWidth: 0.2, // Slightly thicker border for headers
                    fontSize: 10, // Header font size 10pt as requested
                    cellPadding: 0.8 // Compact headers
                },
                columnStyles: {
                    0: { cellWidth: 20, fillColor: [255, 255, 255] }, // STUD ID
                    1: { halign: 'left', cellWidth: 50, fillColor: [255, 255, 255] }, // NAME (increased from 46)
                    2: { halign: 'left', cellWidth: 39, fillColor: [255, 255, 255] }, // CAMPUS (increased from 36)
                    3: { cellWidth: 14, fillColor: [255, 255, 204] }, // Tot 720
                    4: { cellWidth: 14, fillColor: [255, 255, 255], textColor: [0, 0, 0] }, // AIR - Pure Black
                    5: { cellWidth: 17, fillColor: [253, 233, 217] }, // Botany Marks
                    6: { cellWidth: 14, fillColor: [255, 255, 255] }, // Botany Rank
                    7: { cellWidth: 17, fillColor: [218, 238, 243] }, // Zoology Marks
                    8: { cellWidth: 14, fillColor: [255, 255, 255] }, // Zoology Rank
                    9: { cellWidth: 17, fillColor: [191, 191, 191], textColor: [0, 0, 0] }, // Biology 360 - Pure Black
                    10: { cellWidth: 17, fillColor: [235, 241, 222] }, // Physics Marks
                    11: { cellWidth: 14, fillColor: [255, 255, 255] }, // Physics Rank
                    12: { cellWidth: 18, fillColor: [242, 220, 219] }, // Chem Marks
                    13: { cellWidth: 14, fillColor: [255, 255, 255] }  // Chem Rank
                },
                margin: { left: 9, right: 9, top: 15, bottom: 15 },
                tableWidth: 'auto', // Let it take full width between margins
                rowPageBreak: 'avoid', // Prevent rows from splitting across pages (Corrected placement)
                didParseCell: (data) => {
                    // Reduce font size for first 3 columns to 10pt as requested
                    if (data.section === 'body' && (data.column.index === 0 || data.column.index === 1 || data.column.index === 2)) {
                        data.cell.styles.fontSize = 10;
                    }
                }
            });

            doc.save(`${fullPattern}.pdf`);
        } catch (error) {
            console.error("PDF Export Error:", error);
            setModal({
                isOpen: true,
                type: 'danger',
                title: 'PDF Export Failed',
                message: 'Failed to generate PDF. Check console for details.',
                onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
            });
        }
    };

    const downloadExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Analysis Report');

            // 1. Add Title (Merged Row 1)
            worksheet.addRow(['SRI CHAITANYA EDUCATIONAL INSTITUTIONS']);
            worksheet.mergeCells('A1:O1');
            const titleCell = worksheet.getCell('A1');
            titleCell.font = { size: 20, bold: true, color: { argb: 'FF800040' } };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getRow(1).height = 30;

            // 2. Add Subtitle (Pattern Row 2)
            const testDate = examStats.length > 0 ? formatDate(examStats[0].DATE) : formatDate(new Date());
            const stream = (filters.stream && filters.stream.length > 0) ? filters.stream.join(',') : 'SR_ELITE';
            const testName = examStats.length > 0 ? examStats[0].Test : 'GRAND TEST';
            const fullPattern = `${testDate}_${stream}_${testName}_All India Marks Analysis`.replace(/\//g, '-');

            worksheet.addRow([fullPattern]);
            worksheet.mergeCells('A2:O2');
            const subTitleCell = worksheet.getCell('A2');
            subTitleCell.font = { size: 14, bold: true, italic: true, color: { argb: 'FF800040' } };
            subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            worksheet.getRow(2).height = 25;

            // Empty spacer row
            worksheet.addRow([]);

            // 3. Multi-level Headers (Rows 4 & 5)
            const headerRow4Values = [
                'STUD ID', 'NAME OF THE STUDENT', 'CAMPUS NAME', 'Tot 720', 'AIR',
                'Botany M180', '', 'Zoology M180', '', 'Biology 360',
                'Physics M180', '', 'Chemistry M180', '', 'EXAMS'
            ];
            worksheet.addRow(headerRow4Values);
            worksheet.mergeCells('F4:G4');
            worksheet.mergeCells('H4:I4');
            worksheet.mergeCells('K4:L4');
            worksheet.mergeCells('M4:N4');
            // Merge single column headers vertically
            ['A', 'B', 'C', 'D', 'E', 'J', 'O'].forEach(col => {
                worksheet.mergeCells(`${col}4:${col}5`);
            });

            const headerRow5Values = [
                '', '', '', '', '',
                'BOT', 'RANK', 'ZOO', 'RANK', '',
                'PHY', 'RANK', 'CHEM', 'RANK', ''
            ];
            worksheet.addRow(headerRow5Values);

            // Style headers
            [4, 5].forEach(rowNum => {
                const row = worksheet.getRow(rowNum);
                row.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
                    cell.font = { color: { argb: 'FFFFFFFF' }, bold: true, size: 10 };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                        left: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                        bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } },
                        right: { style: 'thin', color: { argb: 'FFFFFFFF' } }
                    };
                });
            });

            // Set column widths
            worksheet.columns = [
                { width: 15 }, { width: 35 }, { width: 25 }, { width: 10 }, { width: 10 },
                { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 },
                { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }
            ];

            // 4. Add Data Rows
            studentMarks.forEach(student => {
                const rowData = [
                    student.STUD_ID,
                    (student.name || '').toUpperCase(),
                    (student.campus || '').toUpperCase(),
                    Math.round(student.tot),
                    Math.round(student.air) || '-',
                    Math.round(student.bot),
                    Math.round(student.b_rank) || '-',
                    Math.round(student.zoo),
                    Math.round(student.z_rank) || '-',
                    Math.round((Number(student.bot) || 0) + (Number(student.zoo) || 0)),
                    Math.round(student.phy),
                    Math.round(student.p_rank) || '-',
                    Math.round(student.che),
                    Math.round(student.c_rank) || '-',
                    student.t_app
                ];
                const row = worksheet.addRow(rowData);

                row.eachCell((cell, colNumber) => {
                    cell.alignment = { horizontal: colNumber <= 3 ? 'left' : 'center', vertical: 'middle' };
                    cell.font = { size: 10, bold: colNumber === 4 || colNumber === 10 };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFADD8E6' } },
                        left: { style: 'thin', color: { argb: 'FFADD8E6' } },
                        bottom: { style: 'thin', color: { argb: 'FFADD8E6' } },
                        right: { style: 'thin', color: { argb: 'FFADD8E6' } }
                    };

                    // Background Colors matching PDF
                    if (colNumber === 4) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } }; // Yellow
                    if (colNumber === 6 || colNumber === 7) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE9D9' } }; // Orange
                    if (colNumber === 8 || colNumber === 9) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAEEF3' } }; // Light Blue
                    if (colNumber === 10) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBFBFBF' } }; // Biology Grey
                    if (colNumber === 11 || colNumber === 12) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1DE' } }; // Green pale
                    if (colNumber === 13 || colNumber === 14) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2DCDB' } }; // Pink pale
                });
            });

            // 5. Add Totals Row
            if (totals) {
                const totalRowData = [
                    'Campus Selection Average', '', '',
                    totals.tot, totals.air, totals.bot, totals.b_rank,
                    totals.zoo, totals.z_rank, (Number(totals.bot) + Number(totals.zoo)),
                    totals.phy, totals.p_rank, totals.che, totals.c_rank, ''
                ];
                const totalRow = worksheet.addRow(totalRowData);
                worksheet.mergeCells(`A${totalRow.number}:C${totalRow.number}`);

                totalRow.eachCell(cell => {
                    cell.font = { bold: true, size: 10 };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FF000000' } },
                        left: { style: 'thin', color: { argb: 'FF000000' } },
                        bottom: { style: 'thin', color: { argb: 'FF000000' } },
                        right: { style: 'thin', color: { argb: 'FF000000' } }
                    };
                });
            }

            // Write buffer and save
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `${fullPattern}.xlsx`);

        } catch (error) {
            console.error("Excel Export Error:", error);
            setModal({
                isOpen: true,
                type: 'danger',
                title: 'Excel Export Failed',
                message: 'Failed to generate Excel file. Check console for details.',
                onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
            });
        }
    };

    if (loading) return <div className="loading-state">Updating analytics...</div>;

    const noData = examStats.length === 0 && studentMarks.length === 0;


    return (
        <div className="analysis-report-container">
            <div className="report-actions-top">
                <h3 className="section-title">Report Statistics</h3>
                <div className="flex gap-3 items-center">
                    <button className="btn-primary" onClick={downloadExcel} style={{ backgroundColor: '#1e40af' }}>
                        Generate Excel
                    </button>
                    <button className="btn-primary" onClick={downloadPDF} style={{ backgroundColor: '#10b981' }}>
                        Generate PDF
                    </button>
                </div>
            </div>

            {noData && !loading ? (
                <div className="report-section" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No data found for the selected filters. Please try adjusting your selection.
                </div>
            ) : (
                <>
                    {/* Table 1: Exam Statistics */}
                    <div className="report-section">
                        <div className="report-header">
                            <span>📊</span> Exam Performance Statistics
                        </div>
                        <div className="table-responsive">
                            <table className="analysis-table">
                                <thead>
                                    <tr style={{ cursor: 'pointer' }}>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'DATE')}>Date <SortIcon config={statsSortConfig} columnKey="DATE" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'Test')} style={{ whiteSpace: 'nowrap' }}>Test Name <SortIcon config={statsSortConfig} columnKey="Test" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'Attn')} style={{ color: 'var(--accent)' }}>Attn <SortIcon config={statsSortConfig} columnKey="Attn" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'Max_T')}>Max_T <SortIcon config={statsSortConfig} columnKey="Max_T" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'T_700')}>T&gt;700 <SortIcon config={statsSortConfig} columnKey="T_700" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'T_680')}>T&gt;680 <SortIcon config={statsSortConfig} columnKey="T_680" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'T_650')}>T&gt;650 <SortIcon config={statsSortConfig} columnKey="T_650" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'T_600')}>T&gt;600 <SortIcon config={statsSortConfig} columnKey="T_600" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'T_550')}>T&gt;550 <SortIcon config={statsSortConfig} columnKey="T_550" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'T_530')}>T&gt;530 <SortIcon config={statsSortConfig} columnKey="T_530" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'T_450')}>T&gt;450 <SortIcon config={statsSortConfig} columnKey="T_450" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'Max_B')}>Max_B <SortIcon config={statsSortConfig} columnKey="Max_B" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'B_160')}>B&gt;160 <SortIcon config={statsSortConfig} columnKey="B_160" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'Max_Z')}>Max_Z <SortIcon config={statsSortConfig} columnKey="Max_Z" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'Z_160')}>Z&gt;160 <SortIcon config={statsSortConfig} columnKey="Z_160" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'Max_P')}>Max_P <SortIcon config={statsSortConfig} columnKey="Max_P" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'P_120')}>P&gt;120 <SortIcon config={statsSortConfig} columnKey="P_120" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'P_100')}>P&gt;100 <SortIcon config={statsSortConfig} columnKey="P_100" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'Max_C')}>Max_C <SortIcon config={statsSortConfig} columnKey="Max_C" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'C_130')}>C&gt;130 <SortIcon config={statsSortConfig} columnKey="C_130" /></th>
                                        <th onClick={() => requestSort(setStatsSortConfig, 'C_100')}>C&gt;100 <SortIcon config={statsSortConfig} columnKey="C_100" /></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedExamStats.map((row, i) => (
                                        <tr key={i}>
                                            <td className="text-left">{formatDate(row.DATE)}</td>
                                            <td className="text-left" style={{ whiteSpace: 'nowrap' }}>{row.Test}</td>
                                            <td style={{ fontWeight: '700' }}>{row.Attn}</td>
                                            <td>{row.Max_T}</td>
                                            <td>{row.T_700}</td>
                                            <td>{row.T_680}</td>
                                            <td>{row.T_650}</td>
                                            <td>{row.T_600}</td>
                                            <td>{row.T_550}</td>
                                            <td>{row.T_530}</td>
                                            <td>{row.T_450}</td>
                                            <td>{row.Max_B}</td>
                                            <td>{row.B_160}</td>
                                            <td>{row.Max_Z}</td>
                                            <td>{row.Z_160}</td>
                                            <td>{row.Max_P}</td>
                                            <td>{row.P_120}</td>
                                            <td>{row.P_100}</td>
                                            <td>{row.Max_C}</td>
                                            <td>{row.C_130}</td>
                                            <td>{row.C_100}</td>
                                        </tr>
                                    ))}
                                    {statsSummary && (
                                        <tr className="total-row" style={{ backgroundColor: '#FFF2CC', color: 'black', fontWeight: 'bold' }}>
                                            <td colSpan="2" className="text-left">Average Count</td>
                                            <td style={{ fontWeight: '700' }}>{statsSummary.Attn}</td>
                                            <td>{statsSummary.Max_T}</td>
                                            <td>{statsSummary.T_700}</td>
                                            <td>{statsSummary.T_680}</td>
                                            <td>{statsSummary.T_650}</td>
                                            <td>{statsSummary.T_600}</td>
                                            <td>{statsSummary.T_550}</td>
                                            <td>{statsSummary.T_530}</td>
                                            <td>{statsSummary.T_450}</td>
                                            <td>{statsSummary.Max_B}</td>
                                            <td>{statsSummary.B_160}</td>
                                            <td>{statsSummary.Max_Z}</td>
                                            <td>{statsSummary.Z_160}</td>
                                            <td>{statsSummary.Max_P}</td>
                                            <td>{statsSummary.P_120}</td>
                                            <td>{statsSummary.P_100}</td>
                                            <td>{statsSummary.Max_C}</td>
                                            <td>{statsSummary.C_130}</td>
                                            <td>{statsSummary.C_100}</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Table 2: Student Marks */}
                    <div className="report-section">
                        <div className="report-header">
                            <span>👥</span> Student Merit List (Averages)
                        </div>
                        <div className="table-responsive">
                            <table className="analysis-table merit-table">
                                <thead style={{ cursor: 'pointer' }}>
                                    <tr style={{ color: '#000066' }}>
                                        <th className="w-id-col" onClick={() => requestSort(setMeritSortConfig, 'STUD_ID')}>ID <SortIcon config={meritSortConfig} columnKey="STUD_ID" /></th>
                                        <th className="w-name-col" onClick={() => requestSort(setMeritSortConfig, 'name')}>Name <SortIcon config={meritSortConfig} columnKey="name" /></th>
                                        <th className="w-campus-col" onClick={() => requestSort(setMeritSortConfig, 'campus')}>Campus <SortIcon config={meritSortConfig} columnKey="campus" /></th>
                                        <th className="col-yellow w-marks-col" onClick={() => requestSort(setMeritSortConfig, 'tot')}>TOTAL <SortIcon config={meritSortConfig} columnKey="tot" /></th>
                                        <th className="col-yellow w-marks-col" onClick={() => requestSort(setMeritSortConfig, 'air')}>AIR <SortIcon config={meritSortConfig} columnKey="air" /></th>
                                        <th className="col-green w-marks-col" onClick={() => requestSort(setMeritSortConfig, 'bot')}>BOTANY <SortIcon config={meritSortConfig} columnKey="bot" /></th>
                                        <th className="col-green w-marks-col" onClick={() => requestSort(setMeritSortConfig, 'b_rank')}>RANK <SortIcon config={meritSortConfig} columnKey="b_rank" /></th>
                                        <th className="col-blue-light w-marks-col" onClick={() => requestSort(setMeritSortConfig, 'zoo')}>ZOOLOGY <SortIcon config={meritSortConfig} columnKey="zoo" /></th>
                                        <th className="col-blue-light w-marks-col" onClick={() => requestSort(setMeritSortConfig, 'z_rank')}>RANK <SortIcon config={meritSortConfig} columnKey="z_rank" /></th>
                                        <th className="col-blue-med w-marks-col" onClick={() => requestSort(setMeritSortConfig, 'bio')}>BIOLOGY <SortIcon config={meritSortConfig} columnKey="bio" /></th>
                                        <th className="col-green-pale w-marks-col" onClick={() => requestSort(setMeritSortConfig, 'phy')}>PHYSICS <SortIcon config={meritSortConfig} columnKey="phy" /></th>
                                        <th className="col-green-pale w-marks-col" onClick={() => requestSort(setMeritSortConfig, 'p_rank')}>RANK <SortIcon config={meritSortConfig} columnKey="p_rank" /></th>
                                        <th className="col-pink-pale w-marks-col" onClick={() => requestSort(setMeritSortConfig, 'che')}>CHEMISTRY <SortIcon config={meritSortConfig} columnKey="che" /></th>
                                        <th className="col-pink-pale w-marks-col" onClick={() => requestSort(setMeritSortConfig, 'c_rank')}>RANK <SortIcon config={meritSortConfig} columnKey="c_rank" /></th>
                                        <th className="col-exams w-marks-col" onClick={() => requestSort(setMeritSortConfig, 't_app')}>EXAMS <SortIcon config={meritSortConfig} columnKey="t_app" /></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedStudentMarks.map((student, i) => (
                                        <tr key={i}>
                                            <td style={{ color: 'black' }}>{student.STUD_ID}</td>
                                            <td className="text-left" style={{ fontWeight: '700', color: 'black' }}>
                                                {student.name}
                                            </td>
                                            <td className="text-left" style={{ color: 'black' }}>{student.campus}</td>
                                            <td className="col-yellow" style={{ fontWeight: '800', color: 'black' }}>{Math.round(student.tot)}</td>
                                            <td className="col-white" style={{ fontWeight: '700', color: '#6c361e' }}>{Math.round(student.air) || '-'}</td>
                                            <td className="col-green" style={{ color: 'black' }}>{Math.round(student.bot)}</td>
                                            <td className="col-white" style={{ color: 'black' }}>{Math.round(student.b_rank) || '-'}</td>
                                            <td className="col-blue-light" style={{ color: 'black' }}>{Math.round(student.zoo)}</td>
                                            <td className="col-white" style={{ color: 'black' }}>{Math.round(student.z_rank) || '-'}</td>
                                            <td className="col-blue-med" style={{ fontWeight: '800', color: '#1e4a80' }}>{Math.round((Number(student.bot) || 0) + (Number(student.zoo) || 0))}</td>
                                            <td className="col-green-pale" style={{ color: 'black' }}>{Math.round(student.phy)}</td>
                                            <td className="col-white" style={{ color: 'black' }}>{Math.round(student.p_rank) || '-'}</td>
                                            <td className="col-pink-pale" style={{ color: 'black' }}>{Math.round(student.che)}</td>
                                            <td className="col-white" style={{ color: 'black' }}>{Math.round(student.c_rank) || '-'}</td>
                                            <td className="col-exams" style={{ fontWeight: '700', color: 'black' }}>{student.t_app}</td>
                                        </tr>
                                    ))}
                                    {totals && (
                                        <tr className="total-row">
                                            <td colSpan="3" className="text-left" style={{ color: 'black' }}>Campus Selection Average</td>
                                            <td className="col-yellow" style={{ color: 'black' }}>{totals.tot}</td>
                                            <td className="col-white" style={{ color: '#6c361e' }}>{totals.air}</td>
                                            <td className="col-green" style={{ color: 'black' }}>{totals.bot}</td>
                                            <td className="col-white" style={{ color: 'black' }}>{totals.b_rank}</td>
                                            <td className="col-blue-light" style={{ color: 'black' }}>{totals.zoo}</td>
                                            <td className="col-white" style={{ color: 'black' }}>{totals.z_rank}</td>
                                            <td className="col-blue-med" style={{ color: '#1e4a80' }}>{(Number(totals.bot) || 0) + (Number(totals.zoo) || 0)}</td>
                                            <td className="col-green-pale" style={{ color: 'black' }}>{totals.phy}</td>
                                            <td className="col-white" style={{ color: 'black' }}>{totals.p_rank}</td>
                                            <td className="col-pink-pale" style={{ color: 'black' }}>{totals.che}</td>
                                            <td className="col-white" style={{ color: 'black' }}>{totals.c_rank}</td>
                                            <td className="col-exams"></td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
            <style>{`
                .analysis-report-container {
                    width: 100%;
                }
                .analysis-table {
                    table-layout: auto;
                    width: 100%;
                }
                .merit-table {
                    font-size: 0.75rem !important;
                    table-layout: fixed !important;
                }
                .merit-table th, .merit-table td {
                    padding: 0.25rem 0.1rem !important;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .w-id-col { width: 45px !important; }
                .w-campus-col { 
                    width: 85px !important; 
                    white-space: normal !important;
                    line-height: 1.1 !important;
                }
                .w-name-col { 
                    width: 75px !important; 
                    text-align: left !important; 
                    white-space: normal !important; 
                    overflow-wrap: break-word !important; 
                    word-break: break-word !important;
                    line-height: 1.1 !important;
                }
                .w-marks-col { width: 33px !important; text-align: center !important; }
                .col-exams { width: 33px !important; text-align: center !important; }
                .total-row, .total-row td {
                    background-color: #FFF2CC !important;
                    color: black !important;
                    font-weight: bold !important;
                }
            `}</style>
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

export default AnalysisReport;
