import React, { useState, useEffect } from 'react';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Modal from './Modal';
import LoadingTimer from './LoadingTimer';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { logActivity } from '../utils/activityLogger';
import { useAuth } from './auth/AuthProvider';


const AnalysisReport = ({ filters }) => {
    const { userData } = useAuth();
    const [examStats, setExamStats] = useState([]);
    const [studentMarks, setStudentMarks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [meritSortConfig, setMeritSortConfig] = useState({ key: 'tot', direction: 'desc' });
    const [statsSortConfig, setStatsSortConfig] = useState({ key: 'DATE', direction: 'desc' });
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    useEffect(() => {
        const controller = new AbortController();
        const fetchData = async () => {
            setLoading(true);
            setExamStats([]); // Clear old data immediately
            setStudentMarks([]); // Clear old data immediately

            try {
                const queryParams = buildQueryParams(filters).toString();
                // Fetch Table 1: Exam Stats
                const statsRes = await fetch(`${API_URL}/api/exam-stats?${queryParams}`, { signal: controller.signal });
                const statsData = await statsRes.json();
                if (!controller.signal.aborted) {
                    let processedStats = [];
                    if (statsData && Array.isArray(statsData)) {
                        // Aggregate duplicate rows (test + date)
                        const grouped = statsData.reduce((acc, curr) => {
                            // Normalize Key: Use the same display format for the key to avoid timezone/format mismatches
                            const dateKey = formatDate(curr.DATE);
                            const testKey = String(curr.Test || '').trim().toUpperCase();
                            const groupKey = `${dateKey}_${testKey}`;

                            if (!acc[groupKey]) {
                                acc[groupKey] = { ...curr };
                                // Ensure numeric fields are numbers
                                acc[groupKey].Attn = Number(curr.Attn) || 0;
                                acc[groupKey].Max_T = Number(curr.Max_T) || 0;
                                acc[groupKey].Max_B = Number(curr.Max_B) || 0;
                                acc[groupKey].Max_Z = Number(curr.Max_Z) || 0;
                                acc[groupKey].Max_P = Number(curr.Max_P) || 0;
                                acc[groupKey].Max_C = Number(curr.Max_C) || 0;
                                ['T_700', 'T_680', 'T_650', 'T_600', 'T_550', 'T_530', 'T_450', 'B_160', 'Z_160', 'P_120', 'P_100', 'C_130', 'C_100'].forEach(field => {
                                    acc[groupKey][field] = Number(curr[field]) || 0;
                                });
                            } else {
                                acc[groupKey].Attn = (Number(acc[groupKey].Attn) || 0) + (Number(curr.Attn) || 0);
                                // Max of max scores
                                acc[groupKey].Max_T = Math.max(Number(acc[groupKey].Max_T) || 0, Number(curr.Max_T) || 0, Number(acc[groupKey].Max_T) || 0);
                                acc[groupKey].Max_B = Math.max(Number(acc[groupKey].Max_B) || 0, Number(curr.Max_B) || 0, Number(acc[groupKey].Max_B) || 0);
                                acc[groupKey].Max_Z = Math.max(Number(acc[groupKey].Max_Z) || 0, Number(curr.Max_Z) || 0, Number(acc[groupKey].Max_Z) || 0);
                                acc[groupKey].Max_P = Math.max(Number(acc[groupKey].Max_P) || 0, Number(curr.Max_P) || 0, Number(acc[groupKey].Max_P) || 0);
                                acc[groupKey].Max_C = Math.max(Number(acc[groupKey].Max_C) || 0, Number(curr.Max_C) || 0, Number(acc[groupKey].Max_C) || 0);
                                // Sum of threshold counts
                                ['T_700', 'T_680', 'T_650', 'T_600', 'T_550', 'T_530', 'T_450', 'B_160', 'Z_160', 'P_120', 'P_100', 'C_130', 'C_100'].forEach(field => {
                                    acc[groupKey][field] = (Number(acc[groupKey][field]) || 0) + (Number(curr[field]) || 0);
                                });
                            }
                            return acc;
                        }, {});
                        processedStats = Object.values(grouped);
                    }
                    setExamStats(processedStats);
                }

                // Fetch Table 2: Student Marks
                const marksRes = await fetch(`${API_URL}/api/analysis-report?${queryParams}`, { signal: controller.signal });
                const marksData = await marksRes.json();

                if (!controller.signal.aborted) {
                    setStudentMarks(marksData && marksData.students ? marksData.students : []);
                    // Log activity
                    if (marksData && marksData.students && marksData.students.length > 0) {
                        logActivity(userData, 'Generated Analysis Report', { studentCount: marksData.students.length });
                    }
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error("Failed to fetch reports:", error);
                    setExamStats([]);
                    setStudentMarks([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        // Debounce only the network call, but show loading immediately?
        // User wants "till full data loading only show the table from the database". 
        // Showing loading immediately is safer to avoid confusion.
        const timeoutId = setTimeout(() => {
            fetchData();
        }, 500);

        return () => {
            controller.abort();
            clearTimeout(timeoutId);
        };
    }, [filters]);

    const getStreamLabel = () => {
        const selectedStreams = Array.isArray(filters.stream) ? filters.stream : [];
        if (selectedStreams.length === 0) return "ALL";
        const srEliteMatches = ["SR ELITE", "SR_ELITE_SET_01", "SET-02"];
        const jrEliteMatches = ["JR ELITE"];
        const isSrElite = selectedStreams.every(s => srEliteMatches.includes(s));
        if (isSrElite) return "SR ELITE";
        const isJrElite = selectedStreams.every(s => jrEliteMatches.includes(s));
        if (isJrElite) return "JR ELITE";
        return selectedStreams.join(', ');
    };

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

        // CORRECTION: If only one exam is selected, the "Average" row should exactly match that single exam's stats.
        if (examStats.length === 1) {
            return examStats[0];
        }

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
                aVal = a[key] ?? '';
                bVal = b[key] ?? '';
            }

            // Handle numeric conversion for marks/ranks
            const isNumeric = (val) => typeof val === 'number' || (typeof val === 'string' && val.trim() !== '' && !isNaN(val));

            const parseDateVal = (dateStr) => {
                if (!dateStr) return new Date(0);
                if (dateStr instanceof Date) return dateStr;
                const dmyPattern = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/;
                const match = String(dateStr).match(dmyPattern);
                if (match) {
                    let yearStr = match[3];
                    if (yearStr.length === 2) yearStr = '20' + yearStr;
                    return new Date(yearStr, match[2] - 1, match[1]);
                }
                const d = new Date(dateStr);
                return isNaN(d.getTime()) ? new Date(0) : d;
            };

            if (key === 'DATE') {
                aVal = parseDateVal(aVal).getTime();
                bVal = parseDateVal(bVal).getTime();
            } else if (isNumeric(aVal) && isNumeric(bVal)) {
                aVal = Number(aVal);
                bVal = Number(bVal);
            } else {
                // String comparison
                return direction === 'asc'
                    ? String(aVal).localeCompare(String(bVal))
                    : String(bVal).localeCompare(String(aVal));
            }

            if (aVal === bVal) return 0;
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        return sorted;
    };

    const requestSort = (configSetter, key) => {
        configSetter(prev => {
            // Default direction based on column type
            const isNumericCol = ['tot', 'air', 'bot', 'b_rank', 'zoo', 'z_rank', 'bio', 'phy', 'p_rank', 'che', 'c_rank', 'STUD_ID'].includes(key);
            const isDateCol = key === 'DATE';
            const defaultDir = (isNumericCol || isDateCol) ? 'desc' : 'asc';

            return {
                key,
                direction: prev.key === key
                    ? (prev.direction === 'desc' ? 'asc' : 'desc')
                    : defaultDir
            };
        });
    };

    const sortedExamStats = sortData(examStats, statsSortConfig.key, statsSortConfig.direction);
    const sortedStudentMarks = sortData(studentMarks, meritSortConfig.key, meritSortConfig.direction);

    const SortIcon = ({ config, columnKey }) => {
        if (config.key !== columnKey) return <span style={{ opacity: 0.2, marginLeft: '4px', fontSize: '0.8rem' }}>⇅</span>;
        return <span style={{ marginLeft: '4px', fontSize: '0.8rem', fontWeight: 'bold', color: '#6366f1' }}>{config.direction === 'desc' ? '↓' : '↑'}</span>;
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

            // Helper to load font
            const loadFont = async (url) => {
                console.log(`[PDF] Attempting to load font from: ${url}`);
                try {
                    const res = await fetch(url);
                    if (!res.ok) {
                        console.error(`[PDF] Failed to fetch font: ${res.statusText}`);
                        throw new Error(`Failed to load font: ${url}`);
                    }
                    const blob = await res.blob();
                    console.log(`[PDF] Font loaded successfully. Size: ${blob.size}`);
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result.split(',')[1]);
                        reader.readAsDataURL(blob);
                    });
                } catch (err) {
                    console.error("[PDF] Font loading error:", err);
                    return null;
                }
            };

            const [bgImg, logoImg, impactFont] = await Promise.all([
                loadImage('/college-bg.png'),
                loadImage('/logo.png'),
                loadFont('/fonts/unicode.impact.ttf')
            ]);

            // Add Font
            if (impactFont) {
                doc.addFileToVFS("unicode.impact.ttf", impactFont);
                doc.addFont("unicode.impact.ttf", "Impact", "normal");
            }

            const pageWidth = doc.internal.pageSize.getWidth();
            let currentY = 10; // Top Margin Reduced to move up

            // --- HEADER LAYOUT: VERTICAL STACK (Logo -> Title -> Subtitle) ---

            // Logo Dimensions
            const logoH = 23; // Reduced size
            let logoW = 23;
            if (logoImg) {
                const aspect = logoImg.width / logoImg.height;
                logoW = logoH * aspect;
            }

            // 1. Draw Logo (Centered)
            if (logoImg) {
                const logoX = (pageWidth - logoW) / 2;
                doc.addImage(logoImg, 'PNG', logoX, currentY, logoW, logoH, undefined, 'FAST');
                currentY += logoH + 2; // Reduced gap below logo
            } else {
                currentY += 10;
            }

            // Title Configuration
            const part1 = "Sri Chaitanya";
            const part2 = " Educational Institutions";
            doc.setFontSize(35); // Reduced from 36

            // Calculate Widths
            // Part 1: Impact (User provided font)
            // Fallback to helvetica bold if font didn't load
            if (impactFont) {
                doc.setFont("Impact", "normal");
            } else {
                doc.setFont("helvetica", "bold");
            }
            const w1 = doc.getTextWidth(part1);

            // Part 2: Helvetica
            doc.setFont("helvetica", "normal");
            const w2 = doc.getTextWidth(part2);

            // Total centering width
            const totalTitleWidth = w1 + w2;
            const titleStartX = (pageWidth - totalTitleWidth) / 2;

            // 2. Draw Title Text (Part 1 - "Sri Chaitanya")
            if (impactFont) {
                doc.setFont("Impact", "normal");
            } else {
                doc.setFont("helvetica", "bold");
            }
            doc.setTextColor(0, 112, 192); // #0070C0
            doc.text(part1, titleStartX, currentY + 10);

            // 3. Draw Title Text (Part 2 - "Educational Institutions") - Normal Style
            doc.setFont("helvetica", "normal");
            doc.setTextColor(0, 102, 204); // #0066CC
            doc.text(part2, titleStartX + w1, currentY + 10);

            currentY += 20; // Increased gap below title for better separation

            // 4. Custom Subtitle Pattern
            const testDate = examStats.length > 0 ? formatDate(examStats[0].DATE) : formatDate(new Date());
            const stream = (filters.stream && filters.stream.length > 0) ? filters.stream.join(',') : 'SR_ELITE';
            const testName = examStats.length > 0 ? examStats[0].Test : 'GRAND TEST';
            const fullPattern = `${testDate}_${stream}_${testName}_All India Marks Analysis`.replace(/\//g, '-');

            doc.setFont("helvetica", "bolditalic");
            doc.setFontSize(18); // Increased to 18
            doc.setTextColor(128, 0, 64); // Maroon
            doc.text(fullPattern, pageWidth / 2, currentY, { align: 'center', maxWidth: pageWidth - 20 });

            currentY += 8; // Reduced gap before table

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
                Math.round(row.tot || 0),
                Math.round(row.air) || '-',
                Math.round(row.bot || 0),
                Math.round(row.b_rank || 0),
                Math.round(row.zoo || 0),
                Math.round(row.z_rank || 0),
                Math.round((Number(row.bot) || 0) + (Number(row.zoo) || 0)),
                Math.round(row.phy || 0),
                Math.round(row.p_rank || 0),
                Math.round(row.che || 0),
                Math.round(row.c_rank || 0)
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
            logActivity(userData, 'Exported Analysis PDF', { file: fullPattern });
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
            const stream = getStreamLabel();

            const borderStyle = {
                top: { style: 'thin', color: { argb: 'FF00B0F0' } },
                left: { style: 'thin', color: { argb: 'FF00B0F0' } },
                bottom: { style: 'thin', color: { argb: 'FF00B0F0' } },
                right: { style: 'thin', color: { argb: 'FF00B0F0' } }
            };

            const getHeaderBaseStyle = (bgColor, fgColor = 'FF0000FF') => ({
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } },
                font: { color: { argb: fgColor }, bold: true, size: 10 },
                alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
                border: borderStyle
            });

            // 1. Add Title (Merged Row 1) with Logo
            worksheet.mergeCells('A1:O1');
            const titleCell = worksheet.getCell('A1');
            titleCell.value = {
                richText: [
                    { text: '          Sri Chaitanya ', font: { name: 'Impact', size: 32, color: { argb: 'FF00B0F0' } } },
                    { text: 'Educational Institutions., India', font: { name: 'Gill Sans MT', size: 32, color: { argb: 'FF00B0F0' } } }
                ]
            };
            titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            titleCell.border = borderStyle;
            worksheet.getRow(1).height = 50;

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
                    ext: { width: 65, height: 60 },
                    editAs: 'oneCell'
                });
            } catch (e) {
                console.error("Failed to add logo to excel:", e);
            }

            // 2. Add Subtitle (Row 2)
            const subTitleText = `${stream}_Averages of the Selected Exams`;
            worksheet.mergeCells('A2:O2');
            const subTitleCell = worksheet.getCell('A2');
            subTitleCell.value = subTitleText;
            subTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF31869B' } };
            subTitleCell.font = { name: 'MS Gothic', size: 16, color: { argb: 'FFFFFF00' }, bold: true };
            subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
            subTitleCell.border = borderStyle;
            worksheet.getRow(2).height = 30;

            // Spacer Row
            worksheet.addRow([]);
            worksheet.getRow(3).height = 10;

            // 3. Multi-level Headers (Rows 4 & 5)
            const headerRow4Values = [
                'STUD ID', 'NAME OF THE STUDENT', 'CAMPUS NAME', 'Tot 720', 'AIR',
                'Botany M180', '', 'Zoology M180', '', 'Biology 360',
                'Physics M180', '', 'Chemistry M180', '', 'EXAMS'
            ];
            const row4 = worksheet.addRow(headerRow4Values);
            row4.height = 30;
            worksheet.mergeCells('F4:G4');
            worksheet.mergeCells('H4:I4');
            worksheet.mergeCells('K4:L4');
            worksheet.mergeCells('M4:N4');
            ['A', 'B', 'C', 'D', 'E', 'J', 'O'].forEach(col => {
                worksheet.mergeCells(`${col}4:${col}5`);
            });

            const headerRow5Values = [
                '', '', '', '', '',
                'BOT', 'RANK', 'ZOO', 'RANK', '',
                'PHY', 'RANK', 'CHEM', 'RANK', ''
            ];
            const row5 = worksheet.addRow(headerRow5Values);
            row5.height = 25;

            // Style headers matching AverageMarksReport
            [row4, row5].forEach(row => {
                row.eachCell((cell, colNumber) => {
                    if ([1, 2, 3, 6, 7].includes(colNumber)) cell.style = getHeaderBaseStyle('FFFFFFCC');
                    else if (colNumber === 4) cell.style = getHeaderBaseStyle('FF002060', 'FFFFFF00');
                    else if (colNumber === 5) cell.style = getHeaderBaseStyle('FFFFFF00', 'FF0000FF');
                    else if ([8, 9].includes(colNumber)) cell.style = getHeaderBaseStyle('FFFDE9D9');
                    else if (colNumber === 10) cell.style = getHeaderBaseStyle('FFD9D9D9');
                    else if ([11, 12].includes(colNumber)) cell.style = getHeaderBaseStyle('FFE4DFEC');
                    else if ([13, 14].includes(colNumber)) cell.style = getHeaderBaseStyle('FFDDD9C4');
                    else if (colNumber === 15) cell.style = getHeaderBaseStyle('FFFCD5B4');
                });
            });

            // Set column widths
            worksheet.columns = [
                { width: 14 }, { width: 35 }, { width: 25 }, { width: 10 }, { width: 10 },
                { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 },
                { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }
            ];

            // 4. Add Data Rows
            studentMarks.forEach(student => {
                const rowData = [
                    student.STUD_ID,
                    (student.name || '').toUpperCase(),
                    (student.campus || '').toUpperCase(),
                    Number(student.tot || 0),
                    Math.round(student.air) || '-',
                    Number(student.bot || 0),
                    Number(student.b_rank || 0),
                    Number(student.zoo || 0),
                    Number(student.z_rank || 0),
                    Number((Number(student.bot) || 0) + (Number(student.zoo) || 0)),
                    Number(student.phy || 0),
                    Number(student.p_rank || 0),
                    Number(student.che || 0),
                    Number(student.c_rank || 0),
                    student.t_app
                ];
                const row = worksheet.addRow(rowData);
                row.height = 20;

                row.eachCell((cell, colNumber) => {
                    cell.border = borderStyle;
                    cell.alignment = { vertical: 'middle', horizontal: colNumber <= 3 ? 'left' : 'center' };

                    // Format numbers with 1 decimal point for marks
                    if ([4, 6, 8, 10, 11, 13].includes(colNumber)) {
                        cell.numFmt = '0.0';
                    }

                    if (colNumber <= 3) {
                        cell.font = { name: 'Arial', size: 9, color: { argb: 'FF000000' } };
                    } else if ([4, 6, 8, 10, 11, 13].includes(colNumber)) {
                        const color = (colNumber === 4) ? 'FF0070C0' : 'FF7030A0'; // Blue for TOT, Purple for others
                        const fontName = (colNumber === 4) ? 'Arial Black' : 'Arial';
                        cell.font = { name: fontName, size: 10, bold: true, color: { argb: color } };
                    } else if ([5, 7, 9, 12, 14].includes(colNumber)) {
                        const color = (colNumber === 5) ? 'FF0000FF' : 'FFFF0000'; // Blue for AIR, Red for Others
                        cell.font = { name: 'Arial', size: 10, bold: true, italic: (colNumber === 5), color: { argb: color } };
                    } else {
                        cell.font = { name: 'Arial', size: 10, color: { argb: 'FF000000' } };
                    }

                    // Background Colors matching headers roughly
                    if ([1, 2, 3, 6, 7].includes(colNumber)) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFCEB' } }; // Light Yellow
                    else if (colNumber === 4) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }; // Matches TOT
                    else if (colNumber === 5) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // White for AIR
                    else if ([8, 9].includes(colNumber)) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } }; // Light Blue
                    else if (colNumber === 10) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; // Grey
                    else if ([11, 12].includes(colNumber)) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7FEE7' } }; // Light Green 
                    else if ([13, 14].includes(colNumber)) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF2F8' } }; // Light Pink
                });
            });

            // 5. Add Totals Row
            if (totals) {
                const totalRowData = [
                    'Selection Average', '', '',
                    totals.tot, totals.air, totals.bot, totals.b_rank,
                    totals.zoo, totals.z_rank, (Number(totals.bot) + Number(totals.zoo)),
                    totals.phy, totals.p_rank, totals.che, totals.c_rank, ''
                ];
                const totalRow = worksheet.addRow(totalRowData);
                worksheet.mergeCells(`A${totalRow.number}:C${totalRow.number}`);
                totalRow.height = 25;

                totalRow.eachCell(cell => {
                    cell.font = { bold: true, size: 10 };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.border = borderStyle;
                });
            }

            const testDate = examStats.length > 0 ? formatDate(examStats[0].DATE) : formatDate(new Date());
            const fileName = `${stream}_Averages_${testDate}`.replace(/\//g, '-');
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `${fileName}.xlsx`);
            logActivity(userData, 'Exported Analysis Excel', { file: fileName });

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

    const noData = !loading && examStats.length === 0 && studentMarks.length === 0;

    return (
        <div className="analysis-report-container">
            <LoadingTimer isLoading={loading} />
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

            {noData ? (
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
                                    {loading ? (
                                        <tr><td colSpan="21" className="text-center py-4" style={{ color: '#64748b' }}>Loading statistics...</td></tr>
                                    ) : (
                                        sortedExamStats.map((row, i) => (
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
                                        ))
                                    )}
                                    {!loading && statsSummary && (
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
                                    {loading ? (
                                        <tr><td colSpan="15" className="text-center py-4" style={{ color: '#64748b' }}>Loading merit list...</td></tr>
                                    ) : (
                                        sortedStudentMarks.map((student, i) => (
                                            <tr key={i}>
                                                <td style={{ color: 'black' }}>{student.STUD_ID}</td>
                                                <td className="text-left" style={{ fontWeight: '700', color: 'black' }}>
                                                    {student.name}
                                                </td>
                                                <td className="text-left" style={{ color: 'black' }}>{student.campus}</td>
                                                <td className="col-yellow" style={{ fontWeight: '800', color: 'black' }}>{Number(student.tot || 0).toFixed(1)}</td>
                                                <td className="col-white" style={{ fontWeight: '700', color: '#6c361e' }}>{Math.round(student.air) || '-'}</td>
                                                <td className="col-green" style={{ color: 'black' }}>{Number(student.bot || 0).toFixed(1)}</td>
                                                <td className="col-white" style={{ color: 'black' }}>{Number(student.b_rank || 0).toFixed(1)}</td>
                                                <td className="col-blue-light" style={{ color: 'black' }}>{Number(student.zoo || 0).toFixed(1)}</td>
                                                <td className="col-white" style={{ color: 'black' }}>{Number(student.z_rank || 0).toFixed(1)}</td>
                                                <td className="col-blue-med" style={{ fontWeight: '800', color: '#1e4a80' }}>{((Number(student.bot) || 0) + (Number(student.zoo) || 0)).toFixed(1)}</td>
                                                <td className="col-green-pale" style={{ color: 'black' }}>{Number(student.phy || 0).toFixed(1)}</td>
                                                <td className="col-white" style={{ color: 'black' }}>{Number(student.p_rank || 0).toFixed(1)}</td>
                                                <td className="col-pink-pale" style={{ color: 'black' }}>{Number(student.che || 0).toFixed(1)}</td>
                                                <td className="col-white" style={{ color: 'black' }}>{Number(student.c_rank || 0).toFixed(1)}</td>
                                                <td className="col-exams" style={{ fontWeight: '700', color: 'black' }}>{student.t_app}</td>
                                            </tr>
                                        ))
                                    )}
                                    {!loading && totals && (
                                        <tr className="total-row">
                                            <td colSpan="3" className="text-left" style={{ color: 'black' }}>Campus Selection Average</td>
                                            <td className="col-yellow" style={{ color: 'black' }}>{Number(totals.tot || 0).toFixed(1)}</td>
                                            <td className="col-white" style={{ color: '#6c361e' }}>{Math.round(totals.air) || '-'}</td>
                                            <td className="col-green" style={{ color: 'black' }}>{Number(totals.bot || 0).toFixed(1)}</td>
                                            <td className="col-white" style={{ color: 'black' }}>{Number(totals.b_rank || 0).toFixed(1)}</td>
                                            <td className="col-blue-light" style={{ color: 'black' }}>{Number(totals.zoo || 0).toFixed(1)}</td>
                                            <td className="col-white" style={{ color: 'black' }}>{Number(totals.z_rank || 0).toFixed(1)}</td>
                                            <td className="col-blue-med" style={{ color: '#1e4a80' }}>{((Number(totals.bot) || 0) + (Number(totals.zoo) || 0)).toFixed(1)}</td>
                                            <td className="col-green-pale" style={{ color: 'black' }}>{Number(totals.phy || 0).toFixed(1)}</td>
                                            <td className="col-white" style={{ color: 'black' }}>{Number(totals.p_rank || 0).toFixed(1)}</td>
                                            <td className="col-pink-pale" style={{ color: 'black' }}>{Number(totals.che || 0).toFixed(1)}</td>
                                            <td className="col-white" style={{ color: 'black' }}>{Number(totals.c_rank || 0).toFixed(1)}</td>
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
                    font-size: 0.7rem !important;
                    table-layout: fixed !important;
                }
                .merit-table th, .merit-table td {
                    padding: 0.2rem 0.1rem !important;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .w-id-col { width: 45px !important; }
                .w-campus-col { 
                    width: 80px !important; 
                    white-space: normal !important;
                    line-height: 1.1 !important;
                }
                .w-name-col { 
                    width: 70px !important; 
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
