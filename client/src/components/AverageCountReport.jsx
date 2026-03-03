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

const AverageCountReport = ({ filters }) => {
    const { userData } = useAuth();
    const [examStats, setExamStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statsSortConfig, setStatsSortConfig] = useState({ key: 'Campus', direction: 'asc' });
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    useEffect(() => {
        const controller = new AbortController();
        const fetchData = async () => {
            setLoading(true);
            setExamStats([]);

            try {
                const queryParams = buildQueryParams(filters).toString();
                // We're adapting the analysis report logic but grouping by Campus to match the Average Count Report picture
                const marksRes = await fetch(`${API_URL}/api/analysis-report?${queryParams}`, { signal: controller.signal });
                const marksData = await marksRes.json();

                if (!controller.signal.aborted) {
                    let processedStats = [];
                    if (marksData && marksData.students) {
                        // Aggregate by campus
                        const grouped = marksData.students.reduce((acc, curr) => {
                            const campus = String(curr.campus || '').trim().toUpperCase();
                            if (!acc[campus]) {
                                acc[campus] = {
                                    Campus: campus,
                                    Section: 'SR_ELITE', // default/derived
                                    Strength: 0,
                                    Mark: 0,
                                    Rank: Infinity,
                                    // Counts per thresholds
                                    T_350: 0, T_650: 0, T_600: 0, T_580: 0, T_530: 0, T_490: 0,
                                    T_450: 0, T_400: 0, T_360: 0, T_320: 0, T_280: 0, T_L200: 0,

                                    B_175: 0, B_170: 0, B_160: 0, B_160_170: 0, B_150: 0, B_130: 0,
                                    Z_175: 0, Z_170: 0, Z_160: 0, Z_160_170: 0, Z_150: 0, Z_130: 0,
                                    P_70: 0, P_50_70: 0, P_L50: 0, P_L20: 0,
                                    C_100: 0, C_70_100: 0, C_50_70: 0, C_L50: 0, C_L20: 0,

                                    // Averages or tops? The picture implies counts >= or ranges.
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

                            // Total bins
                            if (tot <= 350) acc[campus].T_350++;
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

                            // Botany
                            if (bot >= 175) acc[campus].B_175++;
                            if (bot >= 170) acc[campus].B_170++;
                            if (bot >= 160) acc[campus].B_160++;
                            if (bot >= 160 && bot < 170) acc[campus].B_160_170++;
                            if (bot >= 150) acc[campus].B_150++;
                            if (bot >= 130) acc[campus].B_130++;

                            // Zoology
                            if (zoo >= 175) acc[campus].Z_175++;
                            if (zoo >= 170) acc[campus].Z_170++;
                            if (zoo >= 160) acc[campus].Z_160++;
                            if (zoo >= 160 && zoo < 170) acc[campus].Z_160_170++;
                            if (zoo >= 150) acc[campus].Z_150++;
                            if (zoo >= 130) acc[campus].Z_130++;

                            // Physics
                            if (phy >= 70) acc[campus].P_70++;
                            if (phy >= 50 && phy < 70) acc[campus].P_50_70++;
                            if (phy <= 50) acc[campus].P_L50++;
                            if (phy <= 20) acc[campus].P_L20++;

                            // Chemistry
                            if (che >= 100) acc[campus].C_100++;
                            if (che >= 70 && che < 100) acc[campus].C_70_100++;
                            if (che >= 50 && che < 70) acc[campus].C_50_70++;
                            if (che <= 50) acc[campus].C_L50++;
                            if (che <= 20) acc[campus].C_L20++;

                            return acc;
                        }, {});

                        processedStats = Object.values(grouped);
                    }
                    setExamStats(processedStats);

                    if (marksData && marksData.students && marksData.students.length > 0) {
                        logActivity(userData, 'Generated Average Count Report', { campusCount: processedStats.length });
                    }
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error("Failed to fetch reports:", error);
                    setExamStats([]);
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

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
        return selectedStreams.join(', ');
    };

    const sortData = (data, key, direction) => {
        if (!key) return data;
        const sorted = [...data].sort((a, b) => {
            let aVal = a[key] ?? '';
            let bVal = b[key] ?? '';

            const isNumeric = (val) => typeof val === 'number' || (typeof val === 'string' && val.trim() !== '' && !isNaN(val));

            if (isNumeric(aVal) && isNumeric(bVal)) {
                aVal = Number(aVal);
                bVal = Number(bVal);
            } else {
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
            const isNumericCol = key !== 'Campus' && key !== 'Section';
            const defaultDir = isNumericCol ? 'desc' : 'asc';

            return {
                key,
                direction: prev.key === key
                    ? (prev.direction === 'desc' ? 'asc' : 'desc')
                    : defaultDir
            };
        });
    };

    const sortedExamStats = sortData(examStats, statsSortConfig.key, statsSortConfig.direction);

    // Calculate Grand Totals
    const calculateTotals = () => {
        if (!examStats || examStats.length === 0) return null;

        const sum = (field) => examStats.reduce((acc, curr) => acc + (Number(curr[field]) || 0), 0);

        return {
            Strength: sum('Strength'),
            Mark: Math.max(...examStats.map(s => Number(s.Mark) || 0)),
            Rank: Math.min(...examStats.filter(s => s.Rank !== Infinity).map(s => Number(s.Rank))),
            T_350: sum('T_350'), T_650: sum('T_650'), T_600: sum('T_600'), T_580: sum('T_580'), T_530: sum('T_530'), T_490: sum('T_490'),
            T_450: sum('T_450'), T_400: sum('T_400'), T_360: sum('T_360'), T_320: sum('T_320'), T_280: sum('T_280'), T_L200: sum('T_L200'),

            B_175: sum('B_175'), B_170: sum('B_170'), B_160: sum('B_160'), B_160_170: sum('B_160_170'), B_150: sum('B_150'), B_130: sum('B_130'),
            Z_175: sum('Z_175'), Z_170: sum('Z_170'), Z_160: sum('Z_160'), Z_160_170: sum('Z_160_170'), Z_150: sum('Z_150'), Z_130: sum('Z_130'),
            P_70: sum('P_70'), P_50_70: sum('P_50_70'), P_L50: sum('P_L50'), P_L20: sum('P_L20'),
            C_100: sum('C_100'), C_70_100: sum('C_70_100'), C_50_70: sum('C_50_70'), C_L50: sum('C_L50'), C_L20: sum('C_L20'),
        };
    };
    const totals = calculateTotals();

    const SortIcon = ({ config, columnKey }) => {
        if (config.key !== columnKey) return <span style={{ opacity: 0.2, marginLeft: '4px', fontSize: '0.8rem' }}>⇅</span>;
        return <span style={{ marginLeft: '4px', fontSize: '0.8rem', fontWeight: 'bold', color: '#6366f1' }}>{config.direction === 'desc' ? '↓' : '↑'}</span>;
    };

    const downloadExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Average Count Report');
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

            // Set column widths
            worksheet.columns = [
                { width: 35 }, { width: 14 }, { width: 10 }, { width: 10 }, { width: 10 },
                { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
                { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
                { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
                { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
                { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
                { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 },
                { width: 10 }, { width: 10 }, { width: 10 }
            ];

            // Title Row
            const titleRowValues = ['Total', '', totals ? totals.Strength : 0, totals?.Mark, totals?.Rank === Infinity ? '-' : totals?.Rank,
                totals?.T_350, totals?.T_650, totals?.T_600, totals?.T_580, totals?.T_530, totals?.T_490,
                totals?.T_450, totals?.T_400, totals?.T_360, totals?.T_320, totals?.T_280, totals?.T_L200,
                totals?.B_175, totals?.B_170, totals?.B_160, totals?.B_160_170, totals?.B_150, totals?.B_130,
                totals?.Z_175, totals?.Z_170, totals?.Z_160, totals?.Z_160_170, totals?.Z_150, totals?.Z_130,
                totals?.P_70, totals?.P_50_70, totals?.P_L50, totals?.P_L20,
                totals?.C_100, totals?.C_70_100, totals?.C_50_70, totals?.C_L50, totals?.C_L20
            ];

            const titleRow = worksheet.addRow(titleRowValues);
            titleRow.height = 30;
            worksheet.mergeCells('A1:B1');

            titleRow.eachCell((cell, colNumber) => {
                cell.font = { bold: true, color: { argb: 'FF800080' }, size: 10 }; // Purple text for top row typically
                cell.alignment = { horizontal: 'center', vertical: 'middle' };
                cell.border = borderStyle;
            });

            // Headers
            const header1 = [
                'Campus', 'Section', 'Strength', 'Mark', 'Rank',
                'TOT', 'TOTAL', '', '', '', '', '', '', '', '', '', '',
                'Botany(>170M)', '', '', '', '', '',
                'Zoology(>170M)', '', '', '', '', '',
                'Physics (>70M)', '', '', '',
                'Chemistry ( >100M)', '', '', '', ''
            ];
            const h1Row = worksheet.addRow(header1);
            h1Row.height = 25;
            worksheet.mergeCells('A2:A3');
            worksheet.mergeCells('B2:B3');
            worksheet.mergeCells('C2:C3');
            worksheet.mergeCells('D2:E3'); // Mark, Rank

            worksheet.mergeCells('G2:Q2'); // TOTAL
            worksheet.mergeCells('R2:W2'); // Botany
            worksheet.mergeCells('X2:AC2'); // Zoology
            worksheet.mergeCells('AD2:AG2'); // Physics
            worksheet.mergeCells('AH2:AL2'); // Chem

            const header2 = [
                '', '', '', '', '',
                '<=350', '>=650', '>=600', '>=580', '>=530', '>=490', '>=450', '>=400', '>=360', '>=320', '>=280', '<=200',
                '>=175', '>=170', '>=160', '180 - 170', '>=150', '>=130',
                '>=175', '>=170', '>=160', '180 - 170', '>=150', '>=130',
                '>=70', '50 - 70', '<=50', '<=20',
                '>=100', '70 - 100', '50 -70', '<=50', '<=20'
            ];
            const h2Row = worksheet.addRow(header2);
            h2Row.height = 25;

            // Header styles
            [h1Row, h2Row].forEach(row => {
                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = borderStyle;
                    if (colNumber <= 5) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                    else if (colNumber <= 17) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } }; // Yellow
                    } else if (colNumber <= 23) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE9D9' } }; // Light Orange
                        if (row.number === 2) cell.font = { bold: true, color: { argb: 'FFFF00FF' } }; // Pinkish text for Subject
                    } else if (colNumber <= 29) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } }; // Light Blue
                        if (row.number === 2) cell.font = { bold: true, color: { argb: 'FFFF00FF' } };
                    } else if (colNumber <= 33) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1DE' } }; // Light Green
                        if (row.number === 2) cell.font = { bold: true, color: { argb: 'FFFF00FF' } };
                    } else {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2DCDB' } }; // Light Red/Pink
                        if (row.number === 2) cell.font = { bold: true, color: { argb: 'FFFF00FF' } };
                    }
                });
            });

            // Data
            sortedExamStats.forEach(row => {
                const dataRow = [
                    row.Campus, row.Section, row.Strength, row.Mark, row.Rank === Infinity ? '-' : row.Rank,
                    row.T_350, row.T_650, row.T_600, row.T_580, row.T_530, row.T_490, row.T_450, row.T_400, row.T_360, row.T_320, row.T_280, row.T_L200,
                    row.B_175, row.B_170, row.B_160, row.B_160_170, row.B_150, row.B_130,
                    row.Z_175, row.Z_170, row.Z_160, row.Z_160_170, row.Z_150, row.Z_130,
                    row.P_70, row.P_50_70, row.P_L50, row.P_L20,
                    row.C_100, row.C_70_100, row.C_50_70, row.C_L50, row.C_L20
                ];
                const wRow = worksheet.addRow(dataRow);
                wRow.height = 20;
                wRow.eachCell((cell, colNumber) => {
                    cell.border = borderStyle;
                    if (colNumber === 1 || colNumber === 2) cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    else cell.alignment = { horizontal: 'center', vertical: 'middle' };
                })
            });

            const fileName = `Average_Count_Report_${formatDate(new Date())}`.replace(/\//g, '-');
            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), `${fileName}.xlsx`);
            logActivity(userData, 'Exported Average Count Excel', { file: fileName });
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

    const noData = !loading && examStats.length === 0;

    return (
        <div className="analysis-report-container" style={{ width: '100%', overflowX: 'auto' }}>
            <LoadingTimer isLoading={loading} />
            <div className="report-actions-top">
                <h3 className="section-title">Average Count Report</h3>
                <div className="flex gap-3 items-center">
                    <button className="btn-primary" onClick={downloadExcel} style={{ backgroundColor: '#1e40af' }}>
                        Generate Excel
                    </button>
                </div>
            </div>

            {noData ? (
                <div className="report-section" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    No data found for the selected filters. Please try adjusting your selection.
                </div>
            ) : (
                <div className="report-section">
                    <div className="table-responsive" style={{ overflowX: 'auto' }}>
                        <table className="analysis-table" style={{ minWidth: '2000px', fontSize: '0.85rem' }}>
                            <thead>
                                {/* Top Total Row */}
                                {totals && (
                                    <tr style={{ backgroundColor: '#fdfbfe', fontWeight: 'bold', color: '#800080' }}>
                                        <td colSpan={2} style={{ textAlign: 'center' }}>Total</td>
                                        <td style={{ textAlign: 'center' }}>{totals.Strength}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.Mark}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.Rank === Infinity || totals.Rank === null || totals.Rank === undefined || isNaN(totals.Rank) ? '-' : totals.Rank}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.T_350}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.T_650}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.T_600}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.T_580}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.T_530}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.T_490}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.T_450}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.T_400}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.T_360}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.T_320}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.T_280}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.T_L200}</td>

                                        <td style={{ textAlign: 'center' }}>{totals.B_175}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.B_170}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.B_160}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.B_160_170}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.B_150}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.B_130}</td>

                                        <td style={{ textAlign: 'center' }}>{totals.Z_175}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.Z_170}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.Z_160}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.Z_160_170}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.Z_150}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.Z_130}</td>

                                        <td style={{ textAlign: 'center' }}>{totals.P_70}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.P_50_70}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.P_L50}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.P_L20}</td>

                                        <td style={{ textAlign: 'center' }}>{totals.C_100}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.C_70_100}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.C_50_70}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.C_L50}</td>
                                        <td style={{ textAlign: 'center' }}>{totals.C_L20}</td>
                                    </tr>
                                )}

                                <tr>
                                    <th rowSpan="2" onClick={() => requestSort(setStatsSortConfig, 'Campus')} style={{ cursor: 'pointer', backgroundColor: '#f2f2f2' }}>Campus <SortIcon config={statsSortConfig} columnKey="Campus" /></th>
                                    <th rowSpan="2" style={{ backgroundColor: '#f2f2f2' }}>Section</th>
                                    <th rowSpan="2" onClick={() => requestSort(setStatsSortConfig, 'Strength')} style={{ cursor: 'pointer', backgroundColor: '#f2f2f2' }}>Strength <SortIcon config={statsSortConfig} columnKey="Strength" /></th>
                                    <th colSpan="2" style={{ backgroundColor: '#f2f2f2' }}>Mark / Rank</th>

                                    <th colSpan="12" style={{ backgroundColor: '#ffffe0', textAlign: 'center' }}>TOTAL</th>
                                    <th colSpan="6" style={{ backgroundColor: '#faebd7', color: '#ff1493', textAlign: 'center' }}>Botany({'>'}170M)</th>
                                    <th colSpan="6" style={{ backgroundColor: '#e0ffff', color: '#ff1493', textAlign: 'center' }}>Zoology({'>'}170M)</th>
                                    <th colSpan="4" style={{ backgroundColor: '#f0fff0', color: '#ff1493', textAlign: 'center' }}>Physics ({'>'}70M)</th>
                                    <th colSpan="5" style={{ backgroundColor: '#fff0f5', color: '#ff1493', textAlign: 'center' }}>Chemistry ( {'>'}100M)</th>
                                </tr>
                                <tr>
                                    <th style={{ backgroundColor: '#ffffe0' }}>&lt;=350</th>
                                    <th style={{ backgroundColor: '#ffffe0' }}>&gt;=650</th>
                                    <th style={{ backgroundColor: '#ffffe0' }}>&gt;=600</th>
                                    <th style={{ backgroundColor: '#ffffe0' }}>&gt;=580</th>
                                    <th style={{ backgroundColor: '#ffffe0' }}>&gt;=530</th>
                                    <th style={{ backgroundColor: '#ffffe0' }}>&gt;=490</th>
                                    <th style={{ backgroundColor: '#ffffe0' }}>&gt;=450</th>
                                    <th style={{ backgroundColor: '#ffffe0' }}>&gt;=400</th>
                                    <th style={{ backgroundColor: '#ffffe0' }}>&gt;=360</th>
                                    <th style={{ backgroundColor: '#ffffe0' }}>&gt;=320</th>
                                    <th style={{ backgroundColor: '#ffffe0' }}>&gt;=280</th>
                                    <th style={{ backgroundColor: '#ffffe0' }}>&lt;=200</th>

                                    <th style={{ backgroundColor: '#faebd7' }}>&gt;=175</th>
                                    <th style={{ backgroundColor: '#faebd7' }}>&gt;=170</th>
                                    <th style={{ backgroundColor: '#faebd7' }}>&gt;=160</th>
                                    <th style={{ backgroundColor: '#faebd7' }}>180 - 170</th>
                                    <th style={{ backgroundColor: '#faebd7' }}>&gt;=150</th>
                                    <th style={{ backgroundColor: '#faebd7' }}>&gt;=130</th>

                                    <th style={{ backgroundColor: '#e0ffff' }}>&gt;=175</th>
                                    <th style={{ backgroundColor: '#e0ffff' }}>&gt;=170</th>
                                    <th style={{ backgroundColor: '#e0ffff' }}>&gt;=160</th>
                                    <th style={{ backgroundColor: '#e0ffff' }}>180 - 170</th>
                                    <th style={{ backgroundColor: '#e0ffff' }}>&gt;=150</th>
                                    <th style={{ backgroundColor: '#e0ffff' }}>&gt;=130</th>

                                    <th style={{ backgroundColor: '#f0fff0' }}>&gt;=70</th>
                                    <th style={{ backgroundColor: '#f0fff0' }}>50 - 70</th>
                                    <th style={{ backgroundColor: '#f0fff0' }}>&lt;=50</th>
                                    <th style={{ backgroundColor: '#f0fff0' }}>&lt;=20</th>

                                    <th style={{ backgroundColor: '#fff0f5' }}>&gt;=100</th>
                                    <th style={{ backgroundColor: '#fff0f5' }}>70 - 100</th>
                                    <th style={{ backgroundColor: '#fff0f5' }}>50 -70</th>
                                    <th style={{ backgroundColor: '#fff0f5' }}>&lt;=50</th>
                                    <th style={{ backgroundColor: '#fff0f5' }}>&lt;=20</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="38" className="text-center py-4" style={{ color: '#64748b' }}>Loading statistics...</td></tr>
                                ) : (
                                    sortedExamStats.map((row, i) => (
                                        <tr key={i}>
                                            <td className="text-left" style={{ whiteSpace: 'nowrap' }}>{row.Campus}</td>
                                            <td className="text-left">{row.Section}</td>
                                            <td style={{ fontWeight: '700' }}>{row.Strength}</td>
                                            <td>{row.Mark}</td>
                                            <td>{row.Rank === Infinity ? '-' : row.Rank}</td>

                                            <td>{row.T_350}</td>
                                            <td>{row.T_650}</td>
                                            <td>{row.T_600}</td>
                                            <td>{row.T_580}</td>
                                            <td>{row.T_530}</td>
                                            <td>{row.T_490}</td>
                                            <td>{row.T_450}</td>
                                            <td>{row.T_400}</td>
                                            <td>{row.T_360}</td>
                                            <td>{row.T_320}</td>
                                            <td>{row.T_280}</td>
                                            <td>{row.T_L200}</td>

                                            <td>{row.B_175}</td>
                                            <td>{row.B_170}</td>
                                            <td>{row.B_160}</td>
                                            <td>{row.B_160_170}</td>
                                            <td>{row.B_150}</td>
                                            <td>{row.B_130}</td>

                                            <td>{row.Z_175}</td>
                                            <td>{row.Z_170}</td>
                                            <td>{row.Z_160}</td>
                                            <td>{row.Z_160_170}</td>
                                            <td>{row.Z_150}</td>
                                            <td>{row.Z_130}</td>

                                            <td>{row.P_70}</td>
                                            <td>{row.P_50_70}</td>
                                            <td>{row.P_L50}</td>
                                            <td>{row.P_L20}</td>

                                            <td>{row.C_100}</td>
                                            <td>{row.C_70_100}</td>
                                            <td>{row.C_50_70}</td>
                                            <td>{row.C_L50}</td>
                                            <td>{row.C_L20}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AverageCountReport;
