import React, { useState, useEffect } from 'react';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import LoadingTimer from './LoadingTimer';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { logActivity } from '../utils/activityLogger';
import { useAuth } from './auth/AuthProvider';
import { FileSpreadsheet } from 'lucide-react';

const AverageCountReport = ({ filters }) => {
    const { userData } = useAuth();
    const [examStats, setExamStats] = useState([]);
    const [studentData, setStudentData] = useState([]);
    const [totalConducted, setTotalConducted] = useState(0);
    const [examMeta, setExamMeta] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statsSortConfig, setStatsSortConfig] = useState({ key: 'Campus', direction: 'asc' });
    const [studentSortConfig, setStudentSortConfig] = useState({ key: 'tot', direction: 'desc' });

    const getStreamLabel = () => {
        const streamFilter = filters.stream;
        const selected = Array.isArray(streamFilter) ? streamFilter : (streamFilter ? [streamFilter] : []);
        if (selected.length === 0 || selected.includes('ALL')) return "ALL STREAMS";
        const sStr = selected.map(s => s.toUpperCase().replace(/_/g, ' ')).join('|');
        if (sStr.includes('JR AIIMS')) return 'JR AIIMS';
        if (sStr.includes('JR ELITE')) return 'JR ELITE';
        if (sStr.includes('SR ELITE')) return 'SR ELITE';
        if (sStr.includes('SR AIIMS')) return 'SR AIIMS';
        return selected[0].toUpperCase().replace(/_/g, ' ');
    };

    useEffect(() => {
        const controller = new AbortController();
        const fetchData = async () => {
            setLoading(true);
            try {
                const queryParams = buildQueryParams(filters).toString();
                const marksRes = await fetch(`${API_URL}/api/analysis-report?${queryParams}`, { signal: controller.signal });
                const marksData = await marksRes.json();

                if (!controller.signal.aborted) {
                    if (marksData && marksData.students) {
                        setStudentData(marksData.students);
                        setTotalConducted(marksData.t_cnt || 0);
                        setExamMeta(marksData.exams || []);
                        const currentStream = getStreamLabel();
                        const grouped = marksData.students.reduce((acc, curr) => {
                            const campus = String(curr.campus || '').trim().toUpperCase();
                            if (!campus) return acc;
                            if (!acc[campus]) {
                                acc[campus] = {
                                    Campus: campus, Section: currentStream, Strength: 0, Mark: 0, Rank: Infinity,
                                    T_350: 0, T_650: 0, T_600: 0, T_580: 0, T_530: 0, T_490: 0, T_450: 0, T_400: 0, T_360: 0, T_320: 0, T_280: 0, T_L200: 0,
                                    B_175: 0, B_170: 0, B_160: 0, B_170_180: 0, B_150: 0, B_130: 0,
                                    Z_175: 0, Z_170: 0, Z_160: 0, Z_170_180: 0, Z_150: 0, Z_130: 0,
                                    P_70: 0, P_50_70: 0, P_L50: 0, P_L30: 0,
                                    C_100: 0, C_70_100: 0, C_50_70: 0, C_L50: 0, C_L20: 0,
                                };
                            }
                            acc[campus].Strength += 1;
                            const tot = Number(curr.tot) || 0;
                            const air = Number(curr.air) || 0;
                            const bot = Number(curr.bot) || 0;
                            const zoo = Number(curr.zoo) || 0;
                            const phy = Number(curr.phy) || 0;
                            const che = Number(curr.che) || 0;
                            if (tot > acc[campus].Mark) acc[campus].Mark = tot;
                            if (air > 0 && air < acc[campus].Rank) acc[campus].Rank = air;
                            if (tot >= 650) acc[campus].T_650++;
                            if (tot >= 600) acc[campus].T_600++;
                            if (tot >= 580) acc[campus].T_580++;
                            if (tot >= 530) acc[campus].T_530++;
                            if (tot >= 490) acc[campus].T_490++;
                            if (tot >= 450) acc[campus].T_450++;
                            if (tot >= 400) acc[campus].T_400++;
                            if (tot >= 360) acc[campus].T_360++;
                            if (tot >= 320) acc[campus].T_320++;
                            if (tot >= 280) acc[campus].T_280++;
                            if (tot <= 200) acc[campus].T_L200++;
                            if (tot <= 350) acc[campus].T_350++;
                            if (bot >= 175) acc[campus].B_175++;
                            if (bot >= 170) acc[campus].B_170++;
                            if (bot >= 160) acc[campus].B_160++;
                            if (bot >= 170 && bot <= 180) acc[campus].B_170_180++;
                            if (bot >= 150) acc[campus].B_150++;
                            if (bot >= 130) acc[campus].B_130++;
                            if (zoo >= 175) acc[campus].Z_175++;
                            if (zoo >= 170) acc[campus].Z_170++;
                            if (zoo >= 160) acc[campus].Z_160++;
                            if (zoo >= 170 && zoo <= 180) acc[campus].Z_170_180++;
                            if (zoo >= 150) acc[campus].Z_150++;
                            if (zoo >= 130) acc[campus].Z_130++;
                            if (phy >= 70) acc[campus].P_70++;
                            if (phy >= 50 && phy < 70) acc[campus].P_50_70++;
                            if (phy <= 50) acc[campus].P_L50++;
                            if (phy <= 30) acc[campus].P_L30++;
                            if (che >= 100) acc[campus].C_100++;
                            if (che >= 70 && che < 100) acc[campus].C_70_100++;
                            if (che >= 50 && che < 70) acc[campus].C_50_70++;
                            if (che <= 50) acc[campus].C_L50++;
                            if (che <= 20) acc[campus].C_L20++;
                            return acc;
                        }, {});
                        setExamStats(Object.values(grouped));
                    }
                }
            } catch (error) {
                if (error.name !== 'AbortError') console.error("Failed to fetch reports:", error);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        const timeoutId = setTimeout(fetchData, 500);
        return () => {
            controller.abort();
            clearTimeout(timeoutId);
        };
    }, [filters]);

    const sortData = (data, key, direction) => {
        if (!key) return data;
        return [...data].sort((a, b) => {
            let aVal = a[key] ?? '';
            let bVal = b[key] ?? '';
            const isNumeric = (val) => typeof val === 'number' || (typeof val === 'string' && val.trim() !== '' && !isNaN(val));
            if (isNumeric(aVal) && isNumeric(bVal)) { aVal = Number(aVal); bVal = Number(bVal); }
            else { aVal = String(aVal).toLowerCase(); bVal = String(bVal).toLowerCase(); return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal); }
            if (aVal === bVal) return 0;
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            return direction === 'asc' ? 1 : -1;
        });
    };

    const sortedExamStats = sortData(examStats, statsSortConfig.key, statsSortConfig.direction);
    const sortedStudentList = sortData(studentData, studentSortConfig.key, studentSortConfig.direction);

    const calculateTotals = () => {
        if (!examStats || examStats.length === 0) return null;
        const sum = (field) => examStats.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);
        return {
            Strength: sum('Strength'),
            Mark: Math.max(...examStats.map(s => Number(s.Mark) || 0)),
            Rank: Math.min(...examStats.filter(s => s.Rank !== Infinity).map(s => Number(s.Rank))),
            T_350: sum('T_350'), T_650: sum('T_650'), T_600: sum('T_600'), T_580: sum('T_580'), T_530: sum('T_530'), T_490: sum('T_490'),
            T_450: sum('T_450'), T_400: sum('T_400'), T_360: sum('T_360'), T_320: sum('T_320'), T_280: sum('T_280'), T_L200: sum('T_L200'),
            B_175: sum('B_175'), B_170: sum('B_170'), B_160: sum('B_160'), B_170_180: sum('B_170_180'), B_150: sum('B_150'), B_130: sum('B_130'),
            Z_175: sum('Z_175'), Z_170: sum('Z_170'), Z_160: sum('Z_160'), Z_170_180: sum('Z_170_180'), Z_150: sum('Z_150'), Z_130: sum('Z_130'),
            P_70: sum('P_70'), P_50_70: sum('P_50_70'), P_L50: sum('P_L50'), P_L30: sum('P_L30'),
            C_100: sum('C_100'), C_70_100: sum('C_70_100'), C_50_70: sum('C_50_70'), C_L50: sum('C_L50'), C_L20: sum('C_L20'),
        };
    };
    const totals = calculateTotals();

    const downloadCountExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Count Summary');
            const borderStyle = {
                top: { style: 'thin', color: { argb: 'FF40E0D0' } },
                left: { style: 'thin', color: { argb: 'FF40E0D0' } },
                bottom: { style: 'thin', color: { argb: 'FF40E0D0' } },
                right: { style: 'thin', color: { argb: 'FF40E0D0' } }
            };
            worksheet.columns = Array.from({ length: 38 }, () => ({ width: 15 }));
            worksheet.columns[0] = { width: 35 };

            // --- ROW 1: Logo and Organization Name ---
            worksheet.mergeCells('A1:AL1');
            const row1 = worksheet.getCell('A1');
            row1.value = { richText: [{ text: '          Sri Chaitanya ', font: { name: 'Impact', size: 32, color: { argb: 'FF00B0F0' } } }, { text: 'Educational Institutions., India', font: { name: 'Gill Sans MT', size: 32, color: { argb: 'FF00B0F0' } } }] };
            row1.alignment = { horizontal: 'center', vertical: 'middle' }; row1.border = borderStyle; worksheet.getRow(1).height = 50;
            try {
                const response = await fetch('/logo.png');
                if (response.ok) {
                    const blob = await response.blob(); const arrayBuffer = await blob.arrayBuffer();
                    const imageId = workbook.addImage({ buffer: arrayBuffer, extension: 'png' });
                    worksheet.addImage(imageId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 65, height: 60 }, editAs: 'oneCell' });
                }
            } catch (e) { console.error("Failed to add logo:", e); }

            // --- ROW 2: Detailed Numerical Totals (Grand Total) ---
            const gtLabels = ['Total', '', totals?.Strength || 0, 'All India\nBest', '', totals?.T_350, totals?.T_650, totals?.T_600, totals?.T_580, totals?.T_530, totals?.T_490, totals?.T_450, totals?.T_400, totals?.T_360, totals?.T_320, totals?.T_280, totals?.T_L200, totals?.B_175, totals?.B_170, totals?.B_160, totals?.B_170_180, totals?.B_150, totals?.B_130, totals?.Z_175, totals?.Z_170, totals?.Z_160, totals?.Z_170_180, totals?.Z_150, totals?.Z_130, totals?.P_70, totals?.P_50_70, totals?.P_L50, totals?.P_L30, totals?.C_100, totals?.C_70_100, totals?.C_50_70, totals?.C_L50, totals?.C_L20];

            const gtRow = worksheet.addRow(gtLabels);
            worksheet.mergeCells('A2:B2');
            worksheet.mergeCells('D2:E2');

            gtRow.eachCell((cell, colNumber) => {
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = borderStyle;
                // 2nd row Candara 13 for "Total", strength(col 3), "All india best"(col 4)
                if (colNumber === 1 || colNumber === 2 || colNumber === 3 || colNumber === 4 || colNumber === 5) {
                    cell.font = { name: 'Candara', size: 13, bold: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Adjust if need specific BG
                } else {
                    cell.font = { name: 'Comic Sans MS', size: 12, bold: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } };
                }
            });

            // --- ROW 3: Category Headers ---
            // Need to add 3rd and 4th row headers as requested.
            const h1 = worksheet.addRow(['Campus', 'Section', 'Strength', 'Mark', 'Rank', 'TOT', 'TOTAL', '', '', '', '', '', '', '', '', '', '', 'Botany(>170M)', '', '', '', '', '', 'Zoology(>170M)', '', '', '', '', '', 'Physics (>70M)', '', '', '', 'Chemistry ( >100M)', '', '', '', '']);

            // Merge 3rd & 4th row for these specific columns
            worksheet.mergeCells('A3:A4');
            worksheet.mergeCells('B3:B4');
            worksheet.mergeCells('C3:C4');
            worksheet.mergeCells('D3:D4');
            worksheet.mergeCells('E3:E4');

            // Merging others in 3rd row
            worksheet.mergeCells('F3:Q3'); // TOT, TOTAL ... 
            worksheet.mergeCells('R3:W3'); // Botany
            worksheet.mergeCells('X3:AC3'); // Zoology
            worksheet.mergeCells('AD3:AG3'); // Physics
            worksheet.mergeCells('AH3:AL3'); // Chemistry

            // --- ROW 4: Detail Labels ---
            const h2 = worksheet.addRow(['', '', '', '', '', '<=350', '>=650', '>=600', '>=580', '>=530', '>=490', '>=450', '>=400', '>=360', '>=320', '>=280', '<=200', '>=175', '>=170', '>=160', '180-170', '>=150', '>=130', '>=175', '>=170', '>=160', '180-170', '>=150', '>=130', '>=70', '50-70', '<=50', '<=30', '>=100', '70-100', '50-70', '<=50', '<=20']);

            // Styling ROW 3
            h1.eachCell((cell, colNumber) => {
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = borderStyle;

                if (colNumber === 1 || colNumber === 2 || colNumber === 3) {
                    cell.font = { name: 'Candara', size: 13, bold: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                } else if (colNumber === 4 || colNumber === 5) {
                    cell.font = { name: 'Candara', size: 11, bold: true };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
                } else if (colNumber === 6) { // TOT cell in combined merged area (starts F3)
                } else if (colNumber === 7) { // TOTAL cell in combined merged area (starts G3, but Wait, F:Q is merged! Let's handle formatting manually after loop for merges)
                }
            });

            // Explicit formatting for Merged Cells in Row 3
            // F3 (TOT, TOTAL)
            const cellF3 = worksheet.getCell('F3');
            cellF3.value = { richText: [{ text: 'TOT', font: { name: 'Comic Sans MS', size: 12, bold: true, color: { argb: 'FF000000' } } }, { text: ' ', font: { name: 'Calibri', size: 13, bold: true } }, { text: 'TOTAL', font: { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF000000' } } }] };
            cellF3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } }; // #FFFFCC

            // R3 (Botany)
            const cellR3 = worksheet.getCell('R3');
            cellR3.value = 'Botany(>170M)';
            cellR3.font = { name: 'Comic Sans MS', size: 12, bold: true, color: { argb: 'FFFF0066' } }; // #FF0066
            cellR3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE9D9' } }; // #FDE9D9

            // X3 (Zoology)
            const cellX3 = worksheet.getCell('X3');
            cellX3.value = 'Zoology(>170M)';
            cellX3.font = { name: 'Comic Sans MS', size: 12, bold: true, color: { argb: 'FFFF0066' } }; // #FF0066
            cellX3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAEEF3' } }; // #DAEEF3

            // AD3 (Physics)
            const cellAD3 = worksheet.getCell('AD3');
            cellAD3.value = 'Physics (>70M)';
            cellAD3.font = { name: 'Comic Sans MS', size: 12, bold: true, color: { argb: 'FFFF0066' } }; // #FF0066
            cellAD3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1DE' } }; // #EBF1DE

            // AH3 (Chemistry)
            const cellAH3 = worksheet.getCell('AH3');
            cellAH3.value = 'Chemistry ( >100M)';
            cellAH3.font = { name: 'Comic Sans MS', size: 12, bold: true, color: { argb: 'FFFF0066' } }; // #FF0066
            cellAH3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2DCDB' } }; // #F2DCDB


            // Styling ROW 4
            h2.eachCell((cell, colNumber) => {
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.border = borderStyle;
                cell.font = { name: 'Comic Sans MS', size: 12, bold: true };

                if (colNumber >= 6 && colNumber <= 17) { // TOT / TOTAL area
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFF0' } }; // #FFFFF0
                } else if (colNumber >= 18 && colNumber <= 23) { // Botany
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // white
                } else if (colNumber >= 24 && colNumber <= 29) { // Zoology
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }; // #F5F5F5
                } else if (colNumber >= 30 && colNumber <= 33) { // Physics
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // white
                } else if (colNumber >= 34 && colNumber <= 38) { // Chemistry
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }; // #F5F5F5
                }
            });

            // Data Rows
            sortedExamStats.forEach(row => {
                const r = worksheet.addRow([row.Campus, row.Section, row.Strength, Number(row.Mark).toFixed(2), (row.Rank === Infinity ? '-' : Number(row.Rank).toFixed(2)), row.T_350, row.T_650, row.T_600, row.T_580, row.T_530, row.T_490, row.T_450, row.T_400, row.T_360, row.T_320, row.T_280, row.T_L200, row.B_175, row.B_170, row.B_160, row.B_170_180, row.B_150, row.B_130, row.Z_175, row.Z_170, row.Z_160, row.Z_170_180, row.Z_150, row.Z_130, row.P_70, row.P_50_70, row.P_L50, row.P_L30, row.C_100, row.C_70_100, row.C_50_70, row.C_L50, row.C_L20]);
                r.eachCell((cell, colNumber) => {
                    cell.border = borderStyle;
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };

                    if (colNumber >= 1 && colNumber <= 3) {
                        cell.font = { name: 'Candara', size: 13, bold: false };
                    } else {
                        cell.font = { name: 'Comic Sans MS', size: 12, bold: false };
                    }

                    if (colNumber >= 6 && colNumber <= 17) { // TOT / TOTAL area
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFF0' } }; // #FFFFF0
                    } else if (colNumber >= 18 && colNumber <= 23) { // Botany
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // white
                    } else if (colNumber >= 24 && colNumber <= 29) { // Zoology
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }; // #F5F5F5
                    } else if (colNumber >= 30 && colNumber <= 33) { // Physics
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // white
                    } else if (colNumber >= 34 && colNumber <= 38) { // Chemistry
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }; // #F5F5F5
                    } else {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // White for A-E and default
                    }
                });
            });

            // Auto-fit columns based on data from row 4 onwards
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
            const rawFileName = `Count_Summary_${getStreamLabel()}`;
            const cleanFileName = rawFileName.replace(/[^a-z0-9\-_]/gi, '_');
            saveAs(new Blob([buffer]), `${cleanFileName}.xlsx`);
        } catch (error) {
            alert("Excel Download Error: " + error.message);
            console.error("Excel generation error:", error);
        }
    };

    const downloadListExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Estimated Avg');
        const stream = getStreamLabel();
        const datesStrWrap = examMeta.map((ex, idx) => `${idx + 1}.(${formatDate(ex.DATE, 'dd/mm/yyyy')})`).join(' ');
        worksheet.columns = [
            { width: 10 }, { width: 12 }, { width: 35 }, { width: 30 }, { width: 15 },
            { width: 10 }, { width: 8 }, { width: 10 }, { width: 8 }, { width: 10 },
            { width: 10 }, { width: 8 }, { width: 10 }, { width: 8 }, { width: 12 },
            { width: 10 }, { width: 10 }, { width: 10 }
        ];
        const borderStyle = {
            top: { style: 'thin', color: { argb: 'FF00B0F0' } }, left: { style: 'thin', color: { argb: 'FF00B0F0' } },
            bottom: { style: 'thin', color: { argb: 'FF00B0F0' } }, right: { style: 'thin', color: { argb: 'FF00B0F0' } }
        };
        const getHeaderBaseStyle = (bgColor, fgColor = 'FF0000FF') => ({
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }, font: { color: { argb: fgColor }, bold: true },
            alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: borderStyle
        });

        worksheet.mergeCells('A1:R1');
        const row1 = worksheet.getCell('A1');
        row1.value = { richText: [{ text: '          Sri Chaitanya ', font: { name: 'Impact', size: 32, color: { argb: 'FF00B0F0' } } }, { text: 'Educational Institutions., India', font: { name: 'Gill Sans MT', size: 32, color: { argb: 'FF00B0F0' } } }] };
        row1.alignment = { horizontal: 'center', vertical: 'middle' }; row1.border = borderStyle; worksheet.getRow(1).height = 50;

        try {
            const response = await fetch('/logo.png');
            if (response.ok) {
                const blob = await response.blob(); const arrayBuffer = await blob.arrayBuffer();
                const imageId = workbook.addImage({ buffer: arrayBuffer, extension: 'png' });
                worksheet.addImage(imageId, { tl: { col: 0.1, row: 0.1 }, ext: { width: 65, height: 60 }, editAs: 'oneCell' });
            }
        } catch (e) { console.error("Failed to add logo:", e); }

        worksheet.mergeCells('A2:R2');
        const row2 = worksheet.getCell('A2'); row2.value = 'Central Office, Bangalore'; row2.font = { bold: true, size: 14 };
        row2.alignment = { horizontal: 'center', vertical: 'middle' }; row2.border = borderStyle; worksheet.getRow(2).height = 25;

        worksheet.mergeCells('A3:E4');
        const cellA3 = worksheet.getCell('A3');
        cellA3.value = { richText: [{ text: '2025-26_', font: { name: 'MS Gothic', size: 16, color: { argb: 'FFCCCCFF' }, bold: true } }, { text: stream, font: { name: 'MS Gothic', size: 16, color: { argb: 'FFFFFF00' }, bold: true } }, { text: '_NEET Avg\'s', font: { name: 'MS Gothic', size: 16, color: { argb: 'FFCCCCFF' }, bold: true } }] };
        cellA3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF31869B' } }; cellA3.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; cellA3.border = borderStyle;

        worksheet.mergeCells('F3:R4');
        const cellF3 = worksheet.getCell('F3');
        cellF3.value = { richText: [{ text: `Over All Sr.Inter (Revi) NEET Avg's : \n`, font: { color: { argb: 'FFFF0000' }, name: 'Arial', size: 10, bold: true } }, { text: `Dates :- ${datesStrWrap}`, font: { color: { argb: 'FF000000' }, name: 'Arial', size: 10 } }] };
        cellF3.alignment = { horizontal: 'left', vertical: 'top', wrapText: true }; cellF3.border = borderStyle; worksheet.getRow(3).height = 20; worksheet.getRow(4).height = 30;

        const headerLabels = ['S.No', 'Stud_ID', 'Name', 'CAMPUS NAME', 'Prog. Name', 'BOT 180', 'B_R', 'ZOO 180', 'Z_R', 'BIO', 'PHY 180', 'P_R', 'CHE 180', 'C_R', 'TOT', 'AIR', 'T_App', 'T_Cnt'];
        const row5 = worksheet.addRow(headerLabels); row5.height = 35;
        row5.eachCell((cell, colNumber) => {
            if (colNumber <= 5) cell.style = getHeaderBaseStyle('FFFFFFCC');
            else if (colNumber <= 7) cell.style = getHeaderBaseStyle('FFFFFFCC');
            else if (colNumber <= 9) cell.style = getHeaderBaseStyle('FFFDE9D9');
            else if (colNumber === 10) cell.style = getHeaderBaseStyle('F2F2F2F2');
            else if (colNumber <= 12) cell.style = getHeaderBaseStyle('FFE4DFEC');
            else if (colNumber <= 14) cell.style = getHeaderBaseStyle('FFDDD9C4');
            else if (colNumber === 15) cell.style = getHeaderBaseStyle('FF002060', 'FFFFFF00');
            else if (colNumber === 16) cell.style = getHeaderBaseStyle('FFFFFF00', 'FF0000FF');
            else if (colNumber === 17) cell.style = getHeaderBaseStyle('FFFCD5B4');
            else cell.style = getHeaderBaseStyle('FFD9D9D9');
        });

        sortedStudentList.forEach((s, idx) => {
            const bio = (Number(s.bot || 0) + Number(s.zoo || 0)).toFixed(1);
            const rowData = [idx + 1, s.STUD_ID || '', (s.name || ''), (s.campus || ''), stream, Number(s.bot || 0).toFixed(1), Number(s.b_rank || 0).toFixed(1), Number(s.zoo || 0).toFixed(1), Number(s.z_rank || 0).toFixed(1), bio, Number(s.phy || 0).toFixed(1), Number(s.p_rank || 0).toFixed(1), Number(s.che || 0).toFixed(1), Number(s.c_rank || 0).toFixed(1), Number(s.tot || 0).toFixed(1), Number(s.air || 0).toFixed(1), s.t_app || 0, totalConducted];
            const dataRow = worksheet.addRow(rowData);
            dataRow.eachCell((cell, colNumber) => {
                cell.border = borderStyle; cell.alignment = { vertical: 'middle', horizontal: colNumber <= 4 ? 'left' : 'center' };

                if ([15].includes(colNumber)) {
                    cell.font = { name: 'Arial Black', size: 10, bold: true, color: { argb: 'FF0070C0' } };
                } else if ([6, 8, 10, 11, 13].includes(colNumber)) {
                    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF7030A0' } };
                } else if ([7, 9, 12, 14].includes(colNumber)) {
                    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFF0000' } };
                } else if (colNumber === 16) {
                    cell.font = { name: 'Arial', size: 12, bold: true, italic: true, color: { argb: 'FF0000FF' } };
                } else {
                    cell.font = { name: 'Arial', size: 9, color: { argb: 'FF000000' } };
                }
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `${stream}_Estimated_Avg`.replace(/[^a-z0-9\-_]/gi, '_');
        saveAs(new Blob([buffer]), `${fileName}.xlsx`);
    };

    const SortIcon = ({ config, columnKey }) => {
        if (config.key !== columnKey) return <span style={{ opacity: 0.2, marginLeft: '4px' }}>⇅</span>;
        return <span style={{ marginLeft: '4px', fontWeight: 'bold', color: '#6366f1' }}>{config.direction === 'desc' ? '↓' : '↑'}</span>;
    };
    const requestSort = (setter, key) => setter(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));

    return (
        <div className="report-container-main">
            <LoadingTimer isLoading={loading} />
            <div className="sticky-action-bar">
                <div className="action-header">
                    <h3 className="page-title">Average Count & List Report</h3>
                    <div className="action-buttons">
                        <button className="btn-excel count" onClick={downloadCountExcel}><FileSpreadsheet size={16} /> COUNT EXCEL</button>
                        <button className="btn-excel list" onClick={downloadListExcel}><FileSpreadsheet size={16} /> LIST EXCEL</button>
                    </div>
                </div>
            </div>

            <div className="compact-layout">
                <div className="report-block">
                    <div className="block-header">Campus Wise Count Summary</div>
                    <div className="table-wrapper scroll-both">
                        <table className="analysis-table count-tbl">
                            <thead>
                                {totals && (
                                    <tr className="grand-total-header-row">
                                        <th colSpan={2} className="txt-center bg-yellow-soft">Grand Total</th>
                                        <th className="bg-yellow-soft">{totals.Strength}</th>
                                        <th className="bg-yellow-soft bold">{Number(totals.Mark).toFixed(2)}</th>
                                        <th className="bg-yellow-soft bold">{totals.Rank === Infinity ? '-' : Number(totals.Rank).toFixed(2)}</th>
                                        <th className="bg-yellow bold">{totals.T_350}</th>
                                        <th className="bg-yellow">{totals.T_650}</th><th className="bg-yellow">{totals.T_600}</th><th className="bg-yellow">{totals.T_580}</th>
                                        <th className="bg-yellow">{totals.T_530}</th><th className="bg-yellow">{totals.T_490}</th><th className="bg-yellow">{totals.T_450}</th>
                                        <th className="bg-yellow">{totals.T_400}</th><th className="bg-yellow">{totals.T_360}</th><th className="bg-yellow">{totals.T_320}</th>
                                        <th className="bg-yellow">{totals.T_280}</th><th className="bg-yellow">{totals.T_L200}</th>
                                        <th className="bg-orange">{totals.B_175}</th><th className="bg-orange">{totals.B_170}</th><th className="bg-orange">{totals.B_160}</th><th className="bg-orange">{totals.B_170_180}</th><th className="bg-orange">{totals.B_150}</th><th className="bg-orange">{totals.B_130}</th>
                                        <th className="bg-blue">{totals.Z_175}</th><th className="bg-blue">{totals.Z_170}</th><th className="bg-blue">{totals.Z_160}</th><th className="bg-blue">{totals.Z_170_180}</th><th className="bg-blue">{totals.Z_150}</th><th className="bg-blue">{totals.Z_130}</th>
                                        <th className="bg-green">{totals.P_70}</th><th className="bg-green">{totals.P_50_70}</th><th className="bg-green">{totals.P_L50}</th><th className="bg-green">{totals.P_L30}</th>
                                        <th className="bg-pink">{totals.C_100}</th><th className="bg-pink">{totals.C_70_100}</th><th className="bg-pink">{totals.C_50_70}</th><th className="bg-pink">{totals.C_L50}</th><th className="bg-pink">{totals.C_L20}</th>
                                    </tr>
                                )}
                                <tr>
                                    <th rowSpan="2" onClick={() => requestSort(setStatsSortConfig, 'Campus')} className="sortable">CAMPUS <SortIcon config={statsSortConfig} columnKey="Campus" /></th>
                                    <th rowSpan="2">SECTION</th>
                                    <th rowSpan="2" onClick={() => requestSort(setStatsSortConfig, 'Strength')} className="sortable">STRENGTH <SortIcon config={statsSortConfig} columnKey="Strength" /></th>
                                    <th colSpan="2">TOP MARK / RANK</th>
                                    <th colSpan="12" className="bg-yellow">TOTAL</th>
                                    <th colSpan="6" className="bg-orange">BOTANY</th>
                                    <th colSpan="6" className="bg-blue">ZOOLOGY</th>
                                    <th colSpan="4" className="bg-green">PHYSICS</th>
                                    <th colSpan="5" className="bg-pink">CHEMISTRY</th>
                                </tr>
                                <tr>
                                    <th>MARK</th><th>RANK</th>
                                    <th className="bg-yellow">{'<='}350</th><th className="bg-yellow">{'>='}650</th><th className="bg-yellow">{'>='}600</th><th className="bg-yellow">{'>='}580</th><th className="bg-yellow">{'>='}530</th><th className="bg-yellow">{'>='}490</th><th className="bg-yellow">{'>='}450</th><th className="bg-yellow">{'>='}400</th><th className="bg-yellow">{'>='}360</th><th className="bg-yellow">{'>='}320</th><th className="bg-yellow">{'>='}280</th><th className="bg-yellow">{'<='}200</th>
                                    <th className="bg-orange">{'>='}175</th><th className="bg-orange">{'>='}170</th><th className="bg-orange">{'>='}160</th><th className="bg-orange">180-170</th><th className="bg-orange">{'>='}150</th><th className="bg-orange">{'>='}130</th>
                                    <th className="bg-blue">{'>='}175</th><th className="bg-blue">{'>='}170</th><th className="bg-blue">{'>='}160</th><th className="bg-blue">180-170</th><th className="bg-blue">{'>='}150</th><th className="bg-blue">{'>='}130</th>
                                    <th className="bg-green">{'>='}70</th><th className="bg-green">50-70</th><th className="bg-green">{'<='}50</th><th className="bg-green">{'<='}30</th>
                                    <th className="bg-pink">{'>='}100</th><th className="bg-pink">70-100</th><th className="bg-pink">50-70</th><th className="bg-pink">{'<='}50</th><th className="bg-pink">{'<='}20</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedExamStats.map((row, i) => (
                                    <tr key={i}>
                                        <td className="txt-left bold-text">{row.Campus}</td>
                                        <td>{row.Section}</td>
                                        <td>{row.Strength}</td>
                                        <td className="bold">{Number(row.Mark).toFixed(2)}</td>
                                        <td className="bold">{row.Rank === Infinity ? '-' : Number(row.Rank).toFixed(2)}</td>
                                        <td className="bg-light-yellow bold">{row.T_350}</td>
                                        <td>{row.T_650}</td><td>{row.T_600}</td><td>{row.T_580}</td><td>{row.T_530}</td><td>{row.T_490}</td><td>{row.T_450}</td><td>{row.T_400}</td><td>{row.T_360}</td><td>{row.T_320}</td><td>{row.T_280}</td><td>{row.T_L200}</td>
                                        <td className="bg-light-orange">{row.B_175}</td><td>{row.B_170}</td><td>{row.B_160}</td><td>{row.B_170_180}</td><td>{row.B_150}</td><td>{row.B_130}</td>
                                        <td className="bg-light-blue">{row.Z_175}</td><td>{row.Z_170}</td><td>{row.Z_160}</td><td>{row.Z_170_180}</td><td>{row.Z_150}</td><td>{row.Z_130}</td>
                                        <td className="bg-light-green">{row.P_70}</td><td>{row.P_50_70}</td><td>{row.P_L50}</td><td>{row.P_L30}</td>
                                        <td className="bg-light-pink">{row.C_100}</td><td>{row.C_70_100}</td><td>{row.C_50_70}</td><td>{row.C_L50}</td><td>{row.C_L20}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="report-block">
                    <div className="block-header">Detailed Student List (Averages)_{getStreamLabel()}</div>
                    <div className="table-wrapper scroll-both">
                        <table className="analysis-table list-tbl">
                            <thead>
                                <tr>
                                    <th>S.No</th>
                                    <th onClick={() => requestSort(setStudentSortConfig, 'STUD_ID')} className="sortable">STUD_ID <SortIcon config={studentSortConfig} columnKey="STUD_ID" /></th>
                                    <th onClick={() => requestSort(setStudentSortConfig, 'name')} className="sortable">NAME <SortIcon config={studentSortConfig} columnKey="name" /></th>
                                    <th onClick={() => requestSort(setStudentSortConfig, 'campus')} className="sortable">CAMPUS <SortIcon config={studentSortConfig} columnKey="campus" /></th>
                                    <th className="bg-yellow">BOT</th><th className="bg-yellow">B_R</th>
                                    <th className="bg-blue">ZOO</th><th className="bg-blue">Z_R</th>
                                    <th className="bg-purple">BIO</th>
                                    <th className="bg-green">PHY</th><th className="bg-green">P_R</th>
                                    <th className="bg-orange">CHE</th><th className="bg-orange">C_R</th>
                                    <th onClick={() => requestSort(setStudentSortConfig, 'tot')} className="sortable bg-dark-blue">TOT 720 <SortIcon config={studentSortConfig} columnKey="tot" /></th>
                                    <th onClick={() => requestSort(setStudentSortConfig, 'air')} className="sortable bg-yellow-bright">AIR <SortIcon config={studentSortConfig} columnKey="air" /></th>
                                    <th>T_APP</th><th>T_CNT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="17" className="txt-center py-8">Loading...</td></tr>
                                ) : sortedStudentList.map((s, idx) => (
                                    <tr key={idx}>
                                        <td>{idx + 1}</td> <td>{s.STUD_ID}</td> <td className="txt-left">{s.name}</td> <td className="txt-left">{s.campus}</td>
                                        <td>{Number(s.bot || 0).toFixed(2)}</td> <td className="text-red bold">{Number(s.b_rank || 0).toFixed(2)}</td>
                                        <td>{Number(s.zoo || 0).toFixed(2)}</td> <td className="text-red bold">{Number(s.z_rank || 0).toFixed(2)}</td>
                                        <td className="bold text-purple">{(Number(s.bot || 0) + Number(s.zoo || 0)).toFixed(2)}</td>
                                        <td>{Number(s.phy || 0).toFixed(2)}</td> <td className="text-red bold">{Number(s.p_rank || 0).toFixed(2)}</td>
                                        <td>{Number(s.che || 0).toFixed(2)}</td> <td className="text-red bold">{Number(s.c_rank || 0).toFixed(2)}</td>
                                        <td className="bold text-blue-dark">{Number(s.tot || 0).toFixed(2)}</td>
                                        <td className="bold text-blue-bright italic">{Number(s.air || 0).toFixed(2)}</td>
                                        <td>{s.t_app}</td><td>{totalConducted}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>{`
                .report-container-main { padding: 15px; background: #f1f5f9; min-height: 100vh; font-family: 'Inter', sans-serif; }
                .sticky-action-bar { position: sticky; top: 0; z-index: 100; background: white; padding: 15px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); margin-bottom: 20px; }
                .action-header { display: flex; justify-content: space-between; align-items: center; }
                .page-title { margin: 0; font-size: 1.25rem; font-weight: 700; color: #1e293b; }
                .action-buttons { display: flex; gap: 10px; }
                .btn-excel { display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 0.8rem; border: none; cursor: pointer; color: white; transition: all 0.2s; }
                .btn-excel.count { background: #1e3a8a; }
                .btn-excel.list { background: #059669; }
                .report-block { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; margin-bottom: 20px; }
                .block-header { background: #f8fafc; padding: 10px 20px; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; }
                .table-wrapper { position: relative; max-height: 450px; overflow: auto; }
                .analysis-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.75rem; }
                .analysis-table thead th { position: sticky; top: 0; z-index: 10; background: #f8fafc; padding: 8px; border-bottom: 1px solid #cbd5e1; border-right: 1px solid #e2e8f0; }
                .analysis-table td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; text-align: center; }
                .analysis-table.count-tbl { min-width: 2600px; }
                .analysis-table.list-tbl { min-width: 1700px; }
                .txt-left { text-align: left !important; }
                .txt-center { text-align: center !important; }
                .bold { font-weight: 700 !important; }
                .bg-yellow { background-color: #fef9c3 !important; }
                .bg-blue { background-color: #dbeafe !important; }
                .bg-orange { background-color: #ffedd5 !important; }
                .bg-green { background-color: #dcfce7 !important; }
                .bg-pink { background-color: #fce7f3 !important; }
                .bg-purple { background-color: #f3e8ff !important; }
                .bg-dark-blue { background-color: #1e3a8a !important; color: white !important; }
                .bg-yellow-bright { background-color: #facc15 !important; }
                .text-red { color: #dc2626; font-weight: bold; }
                .text-purple { color: #7c3aed; }
                .text-blue-dark { color: #1e40af; }
                .text-blue-bright { color: #2563eb; }
                .sortable { cursor: pointer; }
                .grand-total-header-row th { border-bottom: 2px solid #94a3b8 !important; border-top: 1px solid #e2e8f0; }
                .bg-yellow-soft { background-color: #fefce8 !important; }
            `}</style>
        </div>
    );
};

export default AverageCountReport;
