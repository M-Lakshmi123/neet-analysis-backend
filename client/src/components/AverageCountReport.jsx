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
    const [loading, setLoading] = useState(true);
    const [statsSortConfig, setStatsSortConfig] = useState({ key: 'Campus', direction: 'asc' });
    const [studentSortConfig, setStudentSortConfig] = useState({ key: 'tot', direction: 'desc' });

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

                        // Aggregate by campus for Count Table
                        const grouped = marksData.students.reduce((acc, curr) => {
                            const campus = String(curr.campus || '').trim().toUpperCase();
                            if (!acc[campus]) {
                                acc[campus] = {
                                    Campus: campus,
                                    Section: 'SR_ELITE',
                                    Strength: 0,
                                    Mark: 0,
                                    Rank: Infinity,
                                    T_350: 0, T_650: 0, T_600: 0, T_580: 0, T_530: 0, T_490: 0,
                                    T_450: 0, T_400: 0, T_360: 0, T_320: 0, T_280: 0, T_L200: 0,
                                    B_175: 0, B_170: 0, B_160: 0, B_160_170: 0, B_150: 0, B_130: 0,
                                    Z_175: 0, Z_170: 0, Z_160: 0, Z_160_170: 0, Z_150: 0, Z_130: 0,
                                    P_70: 0, P_50_70: 0, P_L50: 0, P_L20: 0,
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

                            if (bot >= 175) acc[campus].B_175++;
                            if (bot >= 170) acc[campus].B_170++;
                            if (bot >= 160) acc[campus].B_160++;
                            if (bot >= 160 && bot < 170) acc[campus].B_160_170++;
                            if (bot >= 150) acc[campus].B_150++;
                            if (bot >= 130) acc[campus].B_130++;

                            if (zoo >= 175) acc[campus].Z_175++;
                            if (zoo >= 170) acc[campus].Z_170++;
                            if (zoo >= 160) acc[campus].Z_160++;
                            if (zoo >= 160 && zoo < 170) acc[campus].Z_160_170++;
                            if (zoo >= 150) acc[campus].Z_150++;
                            if (zoo >= 130) acc[campus].Z_130++;

                            if (phy >= 70) acc[campus].P_70++;
                            if (phy >= 50 && phy < 70) acc[campus].P_50_70++;
                            if (phy <= 50) acc[campus].P_L50++;
                            if (phy <= 20) acc[campus].P_L20++;

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
                if (error.name !== 'AbortError') {
                    console.error("Failed to fetch reports:", error);
                }
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
            if (isNumeric(aVal) && isNumeric(bVal)) {
                aVal = Number(aVal);
                bVal = Number(bVal);
            } else {
                return direction === 'asc' ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
            }
            if (aVal === bVal) return 0;
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            return direction === 'asc' ? 1 : -1;
        });
    };

    const getRankedStudents = (students) => {
        if (!students || students.length === 0) return [];
        const sorted = [...students].sort((a, b) => b.tot - a.tot);
        let currentRank = 1;
        return sorted.map((s, idx) => {
            if (idx > 0 && Math.round(s.tot) < Math.round(sorted[idx - 1].tot)) {
                currentRank = idx + 1;
            }
            return { ...s, calculatedRank: currentRank };
        });
    };

    const sortedExamStats = sortData(examStats, statsSortConfig.key, statsSortConfig.direction);
    const rankedStudents = getRankedStudents(studentData);
    const sortedStudentList = sortData(rankedStudents, studentSortConfig.key, studentSortConfig.direction);

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

    const getStreamLabel = () => {
        const selectedStreams = Array.isArray(filters.stream) ? filters.stream : [];
        return selectedStreams.length === 0 ? "ALL" : selectedStreams.join(', ');
    };

    const downloadCountExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Count Summary');
        const stream = getStreamLabel();
        const borderStyle = {
            top: { style: 'thin', color: { argb: 'FF00B0F0' } },
            left: { style: 'thin', color: { argb: 'FF00B0F0' } },
            bottom: { style: 'thin', color: { argb: 'FF00B0F0' } },
            right: { style: 'thin', color: { argb: 'FF00B0F0' } }
        };

        worksheet.columns = Array(38).fill({ width: 10 });
        worksheet.columns[0] = { width: 35 };

        // Grand Totals Row
        const titleRow = worksheet.addRow(['Total', '', totals?.Strength || 0, Number(totals?.Mark || 0).toFixed(2), (totals?.Rank === Infinity ? '-' : Number(totals?.Rank || 0).toFixed(2)),
            totals?.T_350, totals?.T_650, totals?.T_600, totals?.T_580, totals?.T_530, totals?.T_490,
            totals?.T_450, totals?.T_400, totals?.T_360, totals?.T_320, totals?.T_280, totals?.T_L200,
            totals?.B_175, totals?.B_170, totals?.B_160, totals?.B_160_170, totals?.B_150, totals?.B_130,
            totals?.Z_175, totals?.Z_170, totals?.Z_160, totals?.Z_160_170, totals?.Z_150, totals?.Z_130,
            totals?.P_70, totals?.P_50_70, totals?.P_L50, totals?.P_L20,
            totals?.C_100, totals?.C_70_100, totals?.C_50_70, totals?.C_L50, totals?.C_L20
        ]);
        worksheet.mergeCells('A1:B1');
        titleRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FF800080' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = borderStyle;
        });

        // Headers
        const h1 = worksheet.addRow(['Campus', 'Section', 'Strength', 'Mark', 'Rank', 'TOT', 'TOTAL', ...Array(10).fill(''), 'Botany', ...Array(5).fill(''), 'Zoology', ...Array(5).fill(''), 'Physics', ...Array(3).fill(''), 'Chemistry', ...Array(4).fill('')]);
        worksheet.mergeCells('A2:A3'); worksheet.mergeCells('B2:B3'); worksheet.mergeCells('C2:C3'); worksheet.mergeCells('D2:D3'); worksheet.mergeCells('E2:E3');
        worksheet.mergeCells('F2:F3'); worksheet.mergeCells('G2:Q2'); worksheet.mergeCells('R2:W2'); worksheet.mergeCells('X2:AC2'); worksheet.mergeCells('AD2:AG2'); worksheet.mergeCells('AH2:AL2');

        const h2 = worksheet.addRow(['', '', '', '', '', '', '>=650', '>=600', '>=580', '>=530', '>=490', '>=450', '>=400', '>=360', '>=320', '>=280', '<=200', '>=175', '>=170', '>=160', '160-170', '>=150', '>=130', '>=175', '>=170', '>=160', '160-170', '>=150', '>=130', '>=70', '50-70', '<=50', '<=20', '>=100', '70-100', '50-70', '<=50', '<=20']);
        [h1, h2].forEach(row => row.eachCell(cell => { cell.alignment = { horizontal: 'center' }; cell.border = borderStyle; cell.font = { bold: true }; }));

        sortedExamStats.forEach(row => {
            const r = worksheet.addRow([row.Campus, row.Section, row.Strength, Number(row.Mark).toFixed(2), (row.Rank === Infinity ? '-' : Number(row.Rank).toFixed(2)), row.T_350, row.T_650, row.T_600, row.T_580, row.T_530, row.T_490, row.T_450, row.T_400, row.T_360, row.T_320, row.T_280, row.T_L200, row.B_175, row.B_170, row.B_160, row.B_160_170, row.B_150, row.B_130, row.Z_175, row.Z_170, row.Z_160, row.Z_160_170, row.Z_150, row.Z_130, row.P_70, row.P_50_70, row.P_L50, row.P_L20, row.C_100, row.C_70_100, row.C_50_70, row.C_L50, row.C_L20]);
            r.eachCell(cell => cell.border = borderStyle);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Average_Count_Summary_${formatDate(new Date())}.xlsx`);
    };

    const downloadListExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Student List');
        const stream = getStreamLabel();
        const borderStyle = {
            top: { style: 'thin', color: { argb: 'FF00B0F0' } },
            left: { style: 'thin', color: { argb: 'FF00B0F0' } },
            bottom: { style: 'thin', color: { argb: 'FF00B0F0' } },
            right: { style: 'thin', color: { argb: 'FF00B0F0' } }
        };

        worksheet.columns = [{ width: 8 }, { width: 12 }, { width: 35 }, { width: 25 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 10 }, { width: 12 }, { width: 10 }];
        const titleRow = worksheet.addRow([`Student List - ${stream}`, '', '', '', '', '', '', '', '', '', '']);
        worksheet.mergeCells('A1:K1');
        titleRow.eachCell(cell => { cell.font = { bold: true, size: 14 }; cell.alignment = { horizontal: 'center' }; cell.border = borderStyle; });

        const header = worksheet.addRow(['Rank', 'Roll No', 'Name', 'Campus', 'TOT', 'BOT', 'ZOO', 'PHY', 'CHE', 'AIR', 'T_APP']);
        header.eachCell(cell => { cell.font = { bold: true }; cell.border = borderStyle; cell.alignment = { horizontal: 'center' }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }; });

        sortedStudentList.forEach(s => {
            const r = worksheet.addRow([s.calculatedRank, s.roll_no, s.name, s.campus, Number(s.tot).toFixed(2), Number(s.bot).toFixed(2), Number(s.zoo).toFixed(2), Number(s.phy).toFixed(2), Number(s.che).toFixed(2), s.air || '-', s.t_app]);
            r.eachCell(cell => cell.border = borderStyle);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Student_Average_List_${formatDate(new Date())}.xlsx`);
    };

    const SortIcon = ({ config, columnKey }) => {
        if (config.key !== columnKey) return <span style={{ opacity: 0.2, marginLeft: '4px' }}>⇅</span>;
        return <span style={{ marginLeft: '4px', fontWeight: 'bold', color: '#6366f1' }}>{config.direction === 'desc' ? '↓' : '↑'}</span>;
    };

    const requestSort = (setter, key) => {
        setter(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
    };

    return (
        <div className="analysis-report-container" style={{ padding: '20px' }}>
            <LoadingTimer isLoading={loading} />

            <div className="report-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', alignItems: 'center' }}>
                <h3 className="section-title">Average Count & Student List Report</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn-primary" onClick={downloadCountExcel} style={{ backgroundColor: '#1e40af', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <FileSpreadsheet size={16} /> Count Excel
                    </button>
                    <button className="btn-primary" onClick={downloadListExcel} style={{ backgroundColor: '#059669', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <FileSpreadsheet size={16} /> List Excel
                    </button>
                </div>
            </div>

            {/* Table 1: Count Summary */}
            <div className="report-section" style={{ marginBottom: '40px' }}>
                <h4 style={{ marginBottom: '10px', color: '#1e293b' }}>Campus Wise Count Summary</h4>
                <div className="table-responsive" style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <table className="analysis-table" style={{ minWidth: '2000px', fontSize: '0.8rem' }}>
                        <thead>
                            {totals && (
                                <tr style={{ backgroundColor: '#f8fafc', fontWeight: 'bold', color: '#800080' }}>
                                    <td colSpan={2} style={{ textAlign: 'center' }}>Grand Total</td>
                                    <td style={{ textAlign: 'center' }}>{totals.Strength}</td>
                                    <td style={{ textAlign: 'center' }}>{Number(totals.Mark).toFixed(2)}</td>
                                    <td style={{ textAlign: 'center' }}>{totals.Rank === Infinity ? '-' : Number(totals.Rank).toFixed(2)}</td>
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
                            <tr style={{ backgroundColor: '#f1f5f9' }}>
                                <th rowSpan="2" onClick={() => requestSort(setStatsSortConfig, 'Campus')} style={{ cursor: 'pointer' }}>Campus <SortIcon config={statsSortConfig} columnKey="Campus" /></th>
                                <th rowSpan="2">Section</th>
                                <th rowSpan="2" onClick={() => requestSort(setStatsSortConfig, 'Strength')} style={{ cursor: 'pointer' }}>Strength <SortIcon config={statsSortConfig} columnKey="Strength" /></th>
                                <th colSpan="2">Top Mark/Rank</th>
                                <th rowSpan="2" style={{ backgroundColor: '#ffffe0' }}>TOT</th>
                                <th colSpan="11" style={{ backgroundColor: '#ffffe0' }}>TOTAL BINS</th>
                                <th colSpan="6" style={{ backgroundColor: '#faebd7' }}>BOTANY</th>
                                <th colSpan="6" style={{ backgroundColor: '#e0ffff' }}>ZOOLOGY</th>
                                <th colSpan="4" style={{ backgroundColor: '#f0fff0' }}>PHYSICS</th>
                                <th colSpan="5" style={{ backgroundColor: '#fff0f5' }}>CHEMISTRY</th>
                            </tr>
                            <tr style={{ backgroundColor: '#f1f5f9' }}>
                                <th>Mark</th><th>Rank</th>
                                <th style={{ backgroundColor: '#ffffe0' }}>&gt;=650</th><th style={{ backgroundColor: '#ffffe0' }}>&gt;=600</th><th style={{ backgroundColor: '#ffffe0' }}>&gt;=580</th><th style={{ backgroundColor: '#ffffe0' }}>&gt;=530</th><th style={{ backgroundColor: '#ffffe0' }}>&gt;=490</th><th style={{ backgroundColor: '#ffffe0' }}>&gt;=450</th><th style={{ backgroundColor: '#ffffe0' }}>&gt;=400</th><th style={{ backgroundColor: '#ffffe0' }}>&gt;=360</th><th style={{ backgroundColor: '#ffffe0' }}>&gt;=320</th><th style={{ backgroundColor: '#ffffe0' }}>&gt;=280</th><th style={{ backgroundColor: '#ffffe0' }}>&lt;=200</th>
                                <th style={{ backgroundColor: '#faebd7' }}>&gt;=175</th><th style={{ backgroundColor: '#faebd7' }}>&gt;=170</th><th style={{ backgroundColor: '#faebd7' }}>&gt;=160</th><th style={{ backgroundColor: '#faebd7' }}>160-170</th><th style={{ backgroundColor: '#faebd7' }}>&gt;=150</th><th style={{ backgroundColor: '#faebd7' }}>&gt;=130</th>
                                <th style={{ backgroundColor: '#e0ffff' }}>&gt;=175</th><th style={{ backgroundColor: '#e0ffff' }}>&gt;=170</th><th style={{ backgroundColor: '#e0ffff' }}>&gt;=160</th><th style={{ backgroundColor: '#e0ffff' }}>160-170</th><th style={{ backgroundColor: '#e0ffff' }}>&gt;=150</th><th style={{ backgroundColor: '#e0ffff' }}>&gt;=130</th>
                                <th style={{ backgroundColor: '#f0fff0' }}>&gt;=70</th><th style={{ backgroundColor: '#f0fff0' }}>50-70</th><th style={{ backgroundColor: '#f0fff0' }}>&lt;=50</th><th style={{ backgroundColor: '#f0fff0' }}>&lt;=20</th>
                                <th style={{ backgroundColor: '#fff0f5' }}>&gt;=100</th><th style={{ backgroundColor: '#fff0f5' }}>70-100</th><th style={{ backgroundColor: '#fff0f5' }}>50-70</th><th style={{ backgroundColor: '#fff0f5' }}>&lt;=50</th><th style={{ backgroundColor: '#fff0f5' }}>&lt;=20</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedExamStats.map((row, i) => (
                                <tr key={i}>
                                    <td className="text-left font-medium">{row.Campus}</td>
                                    <td>{row.Section}</td>
                                    <td>{row.Strength}</td>
                                    <td>{Number(row.Mark).toFixed(2)}</td>
                                    <td>{row.Rank === Infinity ? '-' : Number(row.Rank).toFixed(2)}</td>
                                    <td style={{ backgroundColor: '#fffbeb' }}>{row.T_350}</td>
                                    <td>{row.T_650}</td><td>{row.T_600}</td><td>{row.T_580}</td><td>{row.T_530}</td><td>{row.T_490}</td><td>{row.T_450}</td><td>{row.T_400}</td><td>{row.T_360}</td><td>{row.T_320}</td><td>{row.T_280}</td><td>{row.T_L200}</td>
                                    <td style={{ backgroundColor: '#fff7ed' }}>{row.B_175}</td><td>{row.B_170}</td><td>{row.B_160}</td><td>{row.B_160_170}</td><td>{row.B_150}</td><td>{row.B_130}</td>
                                    <td style={{ backgroundColor: '#f0f9ff' }}>{row.Z_175}</td><td>{row.Z_170}</td><td>{row.Z_160}</td><td>{row.Z_160_170}</td><td>{row.Z_150}</td><td>{row.Z_130}</td>
                                    <td style={{ backgroundColor: '#f0fdf4' }}>{row.P_70}</td><td>{row.P_50_70}</td><td>{row.P_L50}</td><td>{row.P_L20}</td>
                                    <td style={{ backgroundColor: '#fdf2f8' }}>{row.C_100}</td><td>{row.C_70_100}</td><td>{row.C_50_70}</td><td>{row.C_L50}</td><td>{row.C_L20}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Table 2: Detailed Student List */}
            <div className="report-section">
                <h4 style={{ marginBottom: '10px', color: '#1e293b' }}>Detailed Student List (Averages)</h4>
                <div className="table-responsive" style={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <table className="analysis-table merit-style" style={{ fontSize: '0.8rem' }}>
                        <thead style={{ backgroundColor: '#1e293b', color: 'white' }}>
                            <tr>
                                <th onClick={() => requestSort(setStudentSortConfig, 'calculatedRank')} style={{ cursor: 'pointer' }}>Rank <SortIcon config={studentSortConfig} columnKey="calculatedRank" /></th>
                                <th>Roll No</th>
                                <th onClick={() => requestSort(setStudentSortConfig, 'name')} style={{ cursor: 'pointer' }}>Name <SortIcon config={studentSortConfig} columnKey="name" /></th>
                                <th onClick={() => requestSort(setStudentSortConfig, 'campus')} style={{ cursor: 'pointer' }}>Campus <SortIcon config={studentSortConfig} columnKey="campus" /></th>
                                <th onClick={() => requestSort(setStudentSortConfig, 'tot')} style={{ cursor: 'pointer' }} className="col-yellow">TOT <SortIcon config={studentSortConfig} columnKey="tot" /></th>
                                <th className="col-green">BOT</th>
                                <th className="col-blue-light">ZOO</th>
                                <th className="col-green-pale">PHY</th>
                                <th className="col-pink-pale">CHE</th>
                                <th>AIR</th>
                                <th>T_APP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (<tr><td colSpan="11" className="text-center py-4">Loading list...</td></tr>) : sortedStudentList.length === 0 ? (<tr><td colSpan="11" className="text-center py-4">No student data found</td></tr>) : (
                                sortedStudentList.map((s, idx) => (
                                    <tr key={idx}>
                                        <td>{s.calculatedRank}</td>
                                        <td>{s.roll_no}</td>
                                        <td className="text-left font-medium">{s.name}</td>
                                        <td className="text-left">{s.campus}</td>
                                        <td className="font-bold">{Number(s.tot).toFixed(2)}</td>
                                        <td>{Number(s.bot).toFixed(2)}</td>
                                        <td>{Number(s.zoo).toFixed(2)}</td>
                                        <td>{Number(s.phy).toFixed(2)}</td>
                                        <td>{Number(s.che).toFixed(2)}</td>
                                        <td>{s.air || '-'}</td>
                                        <td>{s.t_app} / {totalConducted}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <style>{`
                .analysis-table th, .analysis-table td { border: 1px solid #e2e8f0; padding: 8px; text-align: center; }
                .text-left { text-align: left !important; }
                .font-bold { font-weight: 700; }
                .font-medium { font-weight: 500; }
                .col-yellow { background-color: #fffbeb !important; color: #000 !important; }
                .col-green { background-color: #f0fdf4 !important; color: #000 !important; }
                .col-blue-light { background-color: #eff6ff !important; color: #000 !important; }
                .col-green-pale { background-color: #f7fee7 !important; color: #000 !important; }
                .col-pink-pale { background-color: #fdf2f8 !important; color: #000 !important; }
                .merit-style thead th { vertical-align: middle; }
            `}</style>
        </div>
    );
};

export default AverageCountReport;
