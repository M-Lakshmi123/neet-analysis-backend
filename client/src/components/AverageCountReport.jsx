import React, { useState, useEffect } from 'react';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import LoadingTimer from './LoadingTimer';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { logActivity } from '../utils/activityLogger';
import { useAuth } from './auth/AuthProvider';
import { FileSpreadsheet, Search } from 'lucide-react';

const AverageCountReport = ({ filters }) => {
    const { userData } = useAuth();
    const [examStats, setExamStats] = useState([]);
    const [studentData, setStudentData] = useState([]);
    const [totalConducted, setTotalConducted] = useState(0);
    const [examMeta, setExamMeta] = useState([]);
    const [loading, setLoading] = useState(true);
    const [statsSortConfig, setStatsSortConfig] = useState({ key: 'Campus', direction: 'asc' });
    const [studentSortConfig, setStudentSortConfig] = useState({ key: 'tot', direction: 'desc' });
    const [searchTerm, setSearchTerm] = useState('');

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
                            if (tot <= 350) acc[campus].T_350++; // TOT column

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
                aVal = String(aVal).toLowerCase();
                bVal = String(bVal).toLowerCase();
                return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
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
            if (idx > 0 && Math.round(s.tot * 100) < Math.round(sorted[idx - 1].tot * 100)) {
                currentRank = idx + 1;
            }
            return { ...s, calculatedRank: currentRank };
        });
    };

    const sortedExamStats = sortData(examStats, statsSortConfig.key, statsSortConfig.direction);
    const rankedStudents = getRankedStudents(studentData);

    const filteredStudentsBySearch = searchTerm
        ? rankedStudents.filter(s =>
            s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.STUD_ID?.toString().includes(searchTerm) ||
            s.campus?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : rankedStudents;

    const sortedStudentList = sortData(filteredStudentsBySearch, studentSortConfig.key, studentSortConfig.direction);

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
        return selectedStreams.length === 0 ? "SR_ELITE" : selectedStreams.join(', ');
    };

    const downloadCountExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Count Summary');
        const stream = getStreamLabel();
        const borderStyle = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };

        worksheet.columns = Array(38).fill({ width: 10 });
        worksheet.columns[0] = { width: 35 };

        const titleRow = worksheet.addRow(['Grand Total', '', totals?.Strength || 0, Number(totals?.Mark || 0).toFixed(2), (totals?.Rank === Infinity ? '-' : Number(totals?.Rank || 0).toFixed(2)),
            totals?.T_350, totals?.T_650, totals?.T_600, totals?.T_580, totals?.T_530, totals?.T_490,
            totals?.T_450, totals?.T_400, totals?.T_360, totals?.T_320, totals?.T_280, totals?.T_L200,
            totals?.B_175, totals?.B_170, totals?.B_160, totals?.B_160_170, totals?.B_150, totals?.B_130,
            totals?.Z_175, totals?.Z_170, totals?.Z_160, totals?.Z_160_170, totals?.Z_150, totals?.Z_130,
            totals?.P_70, totals?.P_50_70, totals?.P_L50, totals?.P_L20,
            totals?.C_100, totals?.C_70_100, totals?.C_50_70, totals?.C_L50, totals?.C_L20
        ]);
        worksheet.mergeCells('A1:B1');
        titleRow.eachCell(cell => {
            cell.font = { bold: true, color: { argb: 'FF000000' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = borderStyle;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
        });

        const h1 = worksheet.addRow(['CAMPUS', 'SECTION', 'STRENGTH', 'TOP MARK/RANK', '', 'TOT', 'TOTAL', ...Array(10).fill(''), 'BOTANY', ...Array(5).fill(''), 'ZOOLOGY', ...Array(5).fill(''), 'PHYSICS', ...Array(3).fill(''), 'CHEMISTRY', ...Array(4).fill('')]);
        worksheet.mergeCells('A2:A3'); worksheet.mergeCells('B2:B3'); worksheet.mergeCells('C2:C3'); worksheet.mergeCells('D2:E2');
        worksheet.mergeCells('F2:F3'); worksheet.mergeCells('G2:Q2'); worksheet.mergeCells('R2:W2'); worksheet.mergeCells('X2:AC2'); worksheet.mergeCells('AD2:AG2'); worksheet.mergeCells('AH2:AL2');

        const h2 = worksheet.addRow(['', '', '', 'MARK', 'RANK', '', '>=650', '>=600', '>=580', '>=530', '>=490', '>=450', '>=400', '>=360', '>=320', '>=280', '<=200', '>=175', '>=170', '>=160', '160-170', '>=150', '>=130', '>=175', '>=170', '>=160', '160-170', '>=150', '>=130', '>=70', '50-70', '<=50', '<=20', '>=100', '70-100', '50-70', '<=50', '<=20']);

        [h1, h2].forEach(row => row.eachCell(cell => {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = borderStyle;
            cell.font = { bold: true, size: 9 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE9ECEF' } };
        }));

        sortedExamStats.forEach(row => {
            const r = worksheet.addRow([row.Campus, row.Section, row.Strength, Number(row.Mark).toFixed(2), (row.Rank === Infinity ? '-' : Number(row.Rank).toFixed(2)), row.T_350, row.T_650, row.T_600, row.T_580, row.T_530, row.T_490, row.T_450, row.T_400, row.T_360, row.T_320, row.T_280, row.T_L200, row.B_175, row.B_170, row.B_160, row.B_160_170, row.B_150, row.B_130, row.Z_175, row.Z_170, row.Z_160, row.Z_160_170, row.Z_150, row.Z_130, row.P_70, row.P_50_70, row.P_L50, row.P_L20, row.C_100, row.C_70_100, row.C_50_70, row.C_L50, row.C_L20]);
            r.eachCell(cell => {
                cell.border = borderStyle;
                cell.alignment = { horizontal: 'center' };
                cell.font = { size: 9 };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Average_Count_Summary_${formatDate(new Date())}.xlsx`);
    };

    const downloadListExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Student List');
        const stream = getStreamLabel();
        const borderStyle = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };

        worksheet.mergeCells('A1:P1');
        const headerCell = worksheet.getCell('A1');
        headerCell.value = 'Sri Chaitanya Educational Institutions., India';
        headerCell.font = { bold: true, size: 28, color: { argb: 'FF0070C0' }, name: 'Impact' };
        headerCell.alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.mergeCells('A2:P2');
        const subHeaderCell = worksheet.getCell('A2');
        subHeaderCell.value = 'Central Office, Madhapur-Hyd.';
        subHeaderCell.font = { bold: true, size: 14, color: { argb: 'FF000000' } };
        subHeaderCell.alignment = { horizontal: 'center', vertical: 'middle' };

        worksheet.getRow(1).height = 45;
        worksheet.getRow(2).height = 25;

        worksheet.mergeCells('A3:D4');
        const pinkHeader = worksheet.getCell('A3');
        pinkHeader.value = `2025-26_${stream}_NEET Avg's`;
        pinkHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF31869B' } };
        pinkHeader.font = { bold: true, size: 24, color: { argb: 'FFDCE6F1' } };
        pinkHeader.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

        worksheet.mergeCells('E3:P4');
        const rightLabel = worksheet.getCell('E3');
        const examDates = examMeta.map(e => formatDate(e.DATE, 'dd-mm-yy')).join(', ');
        rightLabel.value = {
            richText: [
                { text: `Over All Sr.Inter (Revi) NEET Avg's : \n`, font: { bold: true, size: 14, color: { argb: 'FFFF0000' } } },
                { text: `Dates :- ${examDates}`, font: { size: 9, color: { argb: 'FF000000' } } }
            ]
        };
        rightLabel.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

        worksheet.columns = [
            { width: 10 }, { width: 12 }, { width: 30 }, { width: 30 }, { width: 12 },
            { width: 10 }, { width: 8 }, { width: 10 }, { width: 8 },
            { width: 10 }, { width: 10 }, { width: 8 }, { width: 10 }, { width: 8 },
            { width: 12 }, { width: 10 }
        ];

        const row5 = worksheet.addRow(['RANK', 'Stud_ID', 'Name', 'CAMPUS NAME', 'Prog. Name', 'BOT 180', 'B_R', 'ZOO 180', 'Z_R', 'BIO', 'PHY 180', 'P_R', 'CHE 180', 'C_R', 'TOT 720', 'AIR', 'T_APP', 'T_CNT']);
        row5.height = 30;
        row5.eachCell((cell, col) => {
            cell.font = { bold: true, size: 10, color: { argb: 'FF0000FF' } };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = borderStyle;
            if (col <= 5) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } };
            else if (col <= 7) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFFFF' } };
            else if (col <= 9) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE9D9' } };
            else if (col === 10) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE4DFEC' } };
            else if (col <= 12) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
            else if (col <= 14) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDD9C4' } };
            else if (col === 15) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' }, font: { color: { argb: 'FFFFFF00' }, bold: true } };
            else cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
        });

        sortedStudentList.forEach(s => {
            const bio = (Number(s.bot) || 0) + (Number(s.zoo) || 0);
            const r = worksheet.addRow([
                s.calculatedRank, s.STUD_ID, s.name, s.campus, stream,
                Number(s.bot).toFixed(1), s.b_rank || '-',
                Number(s.zoo).toFixed(1), s.z_rank || '-',
                bio.toFixed(1),
                Number(s.phy).toFixed(1), s.p_rank || '-',
                Number(s.che).toFixed(1), s.c_rank || '-',
                Number(s.tot).toFixed(1), s.air || '-',
                s.t_app, totalConducted
            ]);
            r.eachCell((cell, col) => {
                cell.border = borderStyle;
                cell.alignment = { horizontal: col === 3 || col === 4 ? 'left' : 'center', vertical: 'middle' };
                cell.font = { size: 9 };
                if (col === 15) cell.font = { bold: true, color: { argb: 'FF0070C0' } };
                if (col === 16) cell.font = { bold: true, color: { argb: 'FF0000FF' }, italic: true };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), `Student_List_NEET_Avgs_${formatDate(new Date())}.xlsx`);
    };

    const SortIcon = ({ config, columnKey }) => {
        if (config.key !== columnKey) return <span style={{ opacity: 0.2, marginLeft: '4px' }}>⇅</span>;
        return <span style={{ marginLeft: '4px', fontWeight: 'bold', color: '#6366f1' }}>{config.direction === 'desc' ? '↓' : '↑'}</span>;
    };

    const requestSort = (setter, key) => {
        setter(prev => ({ key, direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc' }));
    };

    return (
        <div className="report-container-main">
            <LoadingTimer isLoading={loading} />

            <div className="sticky-action-bar">
                <div className="action-header">
                    <h3 className="page-title">Average Count & List Report</h3>
                    <div className="action-buttons">
                        <button className="btn-excel count" onClick={downloadCountExcel}>
                            <FileSpreadsheet size={16} /> COUNT EXCEL
                        </button>
                        <button className="btn-excel list" onClick={downloadListExcel}>
                            <FileSpreadsheet size={16} /> LIST EXCEL
                        </button>
                    </div>
                </div>
                <div className="search-bar">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by ID, Name or Campus..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="compact-layout">
                {/* Table 1: Count Summary */}
                <div className="report-block">
                    <div className="block-header">Campus Wise Count Summary</div>
                    <div className="table-wrapper scroll-both">
                        <table className="analysis-table count-tbl">
                            <thead>
                                {totals && (
                                    <tr className="grand-total-row">
                                        <td colSpan={2} className="txt-center">Grand Total</td>
                                        <td>{totals.Strength}</td>
                                        <td>{Number(totals.Mark).toFixed(2)}</td>
                                        <td>{totals.Rank === Infinity ? '-' : Number(totals.Rank).toFixed(2)}</td>
                                        <td className="col-tot-highlight">{totals.T_350}</td>
                                        <td>{totals.T_650}</td><td>{totals.T_600}</td><td>{totals.T_580}</td>
                                        <td>{totals.T_530}</td><td>{totals.T_490}</td><td>{totals.T_450}</td>
                                        <td>{totals.T_400}</td><td>{totals.T_360}</td><td>{totals.T_320}</td>
                                        <td>{totals.T_280}</td><td>{totals.T_L200}</td>
                                        <td colSpan={6} className="subj-summary">BOT: {totals.B_175} ({totals.B_170}+)</td>
                                        <td colSpan={6} className="subj-summary">ZOO: {totals.Z_175} ({totals.Z_170}+)</td>
                                        <td colSpan={4} className="subj-summary">PHY: {totals.P_70} (50-70: {totals.P_50_70})</td>
                                        <td colSpan={5} className="subj-summary">CHE: {totals.C_100} (70-100: {totals.C_70_100})</td>
                                    </tr>
                                )}
                                <tr>
                                    <th rowSpan="2" onClick={() => requestSort(setStatsSortConfig, 'Campus')} className="sortable">CAMPUS <SortIcon config={statsSortConfig} columnKey="Campus" /></th>
                                    <th rowSpan="2">SECTION</th>
                                    <th rowSpan="2" onClick={() => requestSort(setStatsSortConfig, 'Strength')} className="sortable">STRENGTH <SortIcon config={statsSortConfig} columnKey="Strength" /></th>
                                    <th colSpan="2">TOP MARK/RANK</th>
                                    <th rowSpan="2" className="bg-yellow">TOT</th>
                                    <th colSpan="11" className="bg-yellow">TOTAL</th>
                                    <th colSpan="6" className="bg-orange">BOTANY</th>
                                    <th colSpan="6" className="bg-blue">ZOOLOGY</th>
                                    <th colSpan="4" className="bg-green">PHYSICS</th>
                                    <th colSpan="5" className="bg-pink">CHEMISTRY</th>
                                </tr>
                                <tr>
                                    <th>MARK</th><th>RANK</th>
                                    <th className="bg-yellow">{'='}650</th><th className="bg-yellow">{'='}600</th><th className="bg-yellow">{'='}580</th><th className="bg-yellow">{'='}530</th><th className="bg-yellow">{'='}490</th><th className="bg-yellow">{'='}450</th><th className="bg-yellow">{'='}400</th><th className="bg-yellow">{'='}360</th><th className="bg-yellow">{'='}320</th><th className="bg-yellow">{'='}280</th><th className="bg-yellow">{'<'}200</th>
                                    <th className="bg-orange">{'='}175</th><th className="bg-orange">{'='}170</th><th className="bg-orange">{'='}160</th><th className="bg-orange">160-170</th><th className="bg-orange">{'='}150</th><th className="bg-orange">{'='}130</th>
                                    <th className="bg-blue">{'='}175</th><th className="bg-blue">{'='}170</th><th className="bg-blue">{'='}160</th><th className="bg-blue">160-170</th><th className="bg-blue">{'='}150</th><th className="bg-blue">{'='}130</th>
                                    <th className="bg-green">{'='}70</th><th className="bg-green">50-70</th><th className="bg-green">{'<'}50</th><th className="bg-green">{'<'}20</th>
                                    <th className="bg-pink">{'='}100</th><th className="bg-pink">70-100</th><th className="bg-pink">50-70</th><th className="bg-pink">{'<'}50</th><th className="bg-pink">{'<'}20</th>
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
                                        <td className="bg-light-orange">{row.B_175}</td><td>{row.B_170}</td><td>{row.B_160}</td><td>{row.B_160_170}</td><td>{row.B_150}</td><td>{row.B_130}</td>
                                        <td className="bg-light-blue">{row.Z_175}</td><td>{row.Z_170}</td><td>{row.Z_160}</td><td>{row.Z_160_170}</td><td>{row.Z_150}</td><td>{row.Z_130}</td>
                                        <td className="bg-light-green">{row.P_70}</td><td>{row.P_50_70}</td><td>{row.P_L50}</td><td>{row.P_L20}</td>
                                        <td className="bg-light-pink">{row.C_100}</td><td>{row.C_70_100}</td><td>{row.C_50_70}</td><td>{row.C_L50}</td><td>{row.C_L20}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Table 2: Detailed Student List */}
                <div className="report-block">
                    <div className="block-header">Detailed Student List (Averages)</div>
                    <div className="table-wrapper scroll-both">
                        <table className="analysis-table list-tbl">
                            <thead>
                                <tr>
                                    <th onClick={() => requestSort(setStudentSortConfig, 'calculatedRank')} className="sortable">RANK <SortIcon config={studentSortConfig} columnKey="calculatedRank" /></th>
                                    <th onClick={() => requestSort(setStudentSortConfig, 'STUD_ID')} className="sortable">STUD_ID <SortIcon config={studentSortConfig} columnKey="STUD_ID" /></th>
                                    <th onClick={() => requestSort(setStudentSortConfig, 'name')} className="sortable">NAME <SortIcon config={studentSortConfig} columnKey="name" /></th>
                                    <th onClick={() => requestSort(setStudentSortConfig, 'campus')} className="sortable">CAMPUS <SortIcon config={studentSortConfig} columnKey="campus" /></th>
                                    <th className="bg-yellow">BOT</th>
                                    <th className="bg-yellow">B_R</th>
                                    <th className="bg-blue">ZOO</th>
                                    <th className="bg-blue">Z_R</th>
                                    <th className="bg-purple">BIO</th>
                                    <th className="bg-green">PHY</th>
                                    <th className="bg-green">P_R</th>
                                    <th className="bg-orange">CHE</th>
                                    <th className="bg-orange">C_R</th>
                                    <th onClick={() => requestSort(setStudentSortConfig, 'tot')} className="sortable bg-dark-blue">TOT 720 <SortIcon config={studentSortConfig} columnKey="tot" /></th>
                                    <th onClick={() => requestSort(setStudentSortConfig, 'air')} className="sortable bg-yellow-bright">AIR <SortIcon config={studentSortConfig} columnKey="air" /></th>
                                    <th>T_APP</th>
                                    <th>T_CNT</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="17" className="txt-center py-8">Loading student list...</td></tr>
                                ) : sortedStudentList.length === 0 ? (
                                    <tr><td colSpan="17" className="txt-center py-8">No results found.</td></tr>
                                ) : (
                                    sortedStudentList.map((s, idx) => (
                                        <tr key={idx}>
                                            <td className="bold">{s.calculatedRank}</td>
                                            <td>{s.STUD_ID}</td>
                                            <td className="txt-left capitalize">{s.name?.toLowerCase()}</td>
                                            <td className="txt-left">{s.campus}</td>
                                            <td>{Number(s.bot || 0).toFixed(1)}</td>
                                            <td className="text-red bold">{s.b_rank || '-'}</td>
                                            <td>{Number(s.zoo || 0).toFixed(1)}</td>
                                            <td className="text-red bold">{s.z_rank || '-'}</td>
                                            <td className="bold text-purple">{(Number(s.bot || 0) + Number(s.zoo || 0)).toFixed(1)}</td>
                                            <td>{Number(s.phy || 0).toFixed(1)}</td>
                                            <td className="text-red bold">{s.p_rank || '-'}</td>
                                            <td>{Number(s.che || 0).toFixed(1)}</td>
                                            <td className="text-red bold">{s.c_rank || '-'}</td>
                                            <td className="bold text-blue-dark">{Number(s.tot || 0).toFixed(1)}</td>
                                            <td className="bold text-blue-bright italic">{s.air || '-'}</td>
                                            <td>{s.t_app}</td>
                                            <td>{totalConducted}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style>{`
                .report-container-main { padding: 15px; background: #f1f5f9; min-height: 100vh; font-family: 'Inter', sans-serif; }
                .sticky-action-bar { position: sticky; top: 0; z-index: 100; background: white; padding: 15px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); margin-bottom: 20px; }
                .action-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
                .page-title { margin: 0; font-size: 1.25rem; font-weight: 700; color: #1e293b; }
                .action-buttons { display: flex; gap: 10px; }
                
                .btn-excel { display: flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 8px; font-weight: 600; font-size: 0.85rem; border: none; cursor: pointer; color: white; transition: all 0.2s; }
                .btn-excel.count { background: #1e3a8a; }
                .btn-excel.list { background: #059669; }
                
                .search-bar { position: relative; width: 100%; border: 1px solid #e2e8f0; border-radius: 8px; display: flex; align-items: center; padding: 0 12px; }
                .search-bar input { border: none; padding: 10px 0; width: 100%; outline: none; font-size: 0.9rem; }
                
                .report-block { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; margin-bottom: 20px; }
                .block-header { background: #f8fafc; padding: 12px 20px; font-weight: 700; color: #334155; border-bottom: 1px solid #e2e8f0; }
                
                .table-wrapper { position: relative; max-height: 400px; overflow: auto; }
                .analysis-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.8rem; }
                .analysis-table thead th { position: sticky; top: 0; z-index: 10; background: #f1f5f9; padding: 10px 8px; border-bottom: 2px solid #cbd5e1; border-right: 1px solid #e2e8f0; }
                .analysis-table td { padding: 8px; border-bottom: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; text-align: center; }
                
                .analysis-table.count-tbl { min-width: 2500px; }
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
                .text-red { color: #dc2626; }
                .text-purple { color: #7c3aed; }
                .text-blue-dark { color: #1e40af; }
                .text-blue-bright { color: #2563eb; }
                .italic { font-style: italic; }
            `}</style>
        </div>
    );
};

export default AverageCountReport;
