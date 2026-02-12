
import React, { useState, useEffect } from 'react';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import LoadingTimer from './LoadingTimer';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import Modal from './Modal';
import { logActivity } from '../utils/activityLogger';
import { useAuth } from './auth/AuthProvider';

const ErrorCountReport = ({ filters }) => {
    const { userData } = useAuth();
    const [data, setData] = useState({ students: [], tests: [] });
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    // Header structure for Table 2
    const subHeaders = [
        'TOT', 'AIR',
        'BOT', 'RANK', 'W', 'U',
        'ZOO', 'RANK', 'W', 'U',
        'PHY', 'RANK', 'W', 'U',
        'CHE', 'RANK', 'W', 'U'
    ];

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
            // Log activity
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
        const worksheet = workbook.addWorksheet('Error Count Report');

        const totalCols = 3 + data.tests.length * 18;

        // Define border style
        const thinBorder = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
        };

        // 1. Branding Row 1
        // Logo area (A1:B1)
        worksheet.mergeCells('A1:B1');
        // Brand Name area (C1:M1)
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

        // 2. Report Name Row 2 (Not merged across entire row)
        worksheet.mergeCells('A2:G2');
        const nameCellR2 = worksheet.getCell('A2');
        nameCellR2.value = "Test Wise 'W' and 'U' Counts";
        nameCellR2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF339966' } };
        nameCellR2.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
        nameCellR2.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(2).height = 30;

        // Header Structure Rows 3 and 4
        const row3 = worksheet.getRow(3);
        const row4 = worksheet.getRow(4);

        row3.getCell(1).value = 'STUD_ID';
        row3.getCell(2).value = 'Name';
        row3.getCell(3).value = 'Campus';

        // Vertical Merge for fixed headers
        worksheet.mergeCells('A3:A4');
        worksheet.mergeCells('B3:B4');
        worksheet.mergeCells('C3:C4');

        ['A3', 'B3', 'C3'].forEach(addr => {
            const cell = worksheet.getCell(addr);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = thinBorder;
            // Also apply border to the row 4 counterpart
            worksheet.getCell(addr.replace('3', '4')).border = thinBorder;
        });

        const labels = [
            'TOT', 'AIR',
            'BOT', 'B_RANK', 'BOT W Count', 'BOT U Count',
            'ZOO', 'Z_RANK', 'ZOO W Count', 'ZOO U Count',
            'PHY', 'P_RANK', 'PHY W Count', 'PHY U Count',
            'CHE', 'C_RANK', 'CHE W Count', 'CHE U Count'
        ];

        // Pastel Colors (One for each test group)
        const testPastels = ['FFEBF1DE', 'FFFDE9D9', 'FFE4DFEC', 'FFDCE6F1', 'FFDDD9C4', 'FFFFF2CC'];

        data.tests.forEach((testName, idx) => {
            const startCol = 4 + (idx * 18);
            const endCol = startCol + 17;
            const pastel = testPastels[idx % testPastels.length];

            // Row 3: Merge Test Name Header
            worksheet.mergeCells(3, startCol, 3, endCol);
            const testTitleCell = worksheet.getCell(3, startCol);
            testTitleCell.value = testName;
            testTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pastel } };
            testTitleCell.font = { bold: true, size: 12, color: { argb: 'FF000000' } };
            testTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

            // Apply borders to merged Row 3 area
            for (let c = startCol; c <= endCol; c++) {
                worksheet.getCell(3, c).border = thinBorder;
            }

            // Row 4: Fill Sub-headers with SAME pastel color
            labels.forEach((lbl, lblIdx) => {
                const c = startCol + lblIdx;
                const lblCell = worksheet.getCell(4, c);
                lblCell.value = lbl;
                lblCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pastel } };
                lblCell.font = { bold: true, size: 9 };
                lblCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                lblCell.border = thinBorder;
            });
        });

        worksheet.getRow(3).height = 30;
        worksheet.getRow(4).height = 40;

        // 5. Data Rows (Starting Row 5)
        data.students.forEach(student => {
            const vals = [student.STUD_ID || '', student.name || '', student.campus || ''];
            data.tests.forEach(testName => {
                const t = student.tests[testName] || {};
                vals.push(
                    t.tot || 0, t.air || 0,
                    t.bot || 0, t.bot_rank || 0, t.bot_w || 0, t.bot_u || 0,
                    t.zoo || 0, t.zoo_rank || 0, t.zoo_w || 0, t.zoo_u || 0,
                    t.phy || 0, t.phy_rank || 0, t.phy_w || 0, t.phy_u || 0,
                    t.che || 0, t.che_rank || 0, t.che_w || 0, t.che_u || 0
                );
            });
            const dataRow = worksheet.addRow(vals);
            dataRow.eachCell((cell, colIdx) => {
                cell.alignment = { horizontal: colIdx <= 3 ? 'left' : 'center', vertical: 'middle' };
                cell.border = thinBorder;
                cell.font = { size: 10 };

                // Bold W (Wrong) and U (Unattempted) columns
                if (colIdx > 3) {
                    const relativeIdx = (colIdx - 4) % 18;
                    const isW = [4, 8, 12, 16].includes(relativeIdx);
                    const isU = [5, 9, 13, 17].includes(relativeIdx);

                    if (isW) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE2E2' } };
                        cell.font = { bold: true, size: 10 };
                    }
                    if (isU) {
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
                        cell.font = { bold: true, size: 10 };
                    }
                }
            });
        });

        // Column Widths
        worksheet.getColumn(1).width = 15;
        worksheet.getColumn(2).width = 30;
        worksheet.getColumn(3).width = 25;
        const totalColsCalc = 3 + data.tests.length * 18;
        for (let i = 4; i <= totalColsCalc; i++) {
            worksheet.getColumn(i).width = 9;
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const fileName = `Error_Count_Report_${formatDate(new Date(), 'dd-mmm-yy')}.xlsx`;
        saveAs(new Blob([buffer]), fileName);
        logActivity(userData, 'Exported Error Count Excel', { file: fileName });
    };

    const getColumnLetter = (col) => {
        let letter = "";
        while (col > 0) {
            let temp = (col - 1) % 26;
            letter = String.fromCharCode(65 + temp) + letter;
            col = (col - temp - 1) / 26;
        }
        return letter;
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
                                </tr>
                                <tr style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
                                    {data.tests.map((_, i) => (
                                        <React.Fragment key={i}>
                                            <th style={{ border: '1px solid #ddd' }}>TOT</th>
                                            <th style={{ border: '1px solid #ddd' }}>AIR</th>
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
                                </tr>
                            </thead>
                            <tbody>
                                {data.students.map((student, sIdx) => (
                                    <tr key={sIdx}>
                                        <td style={{ border: '1px solid #eee' }}>{student.STUD_ID}</td>
                                        <td className="text-left" style={{ border: '1px solid #eee', fontWeight: 'bold' }}>{student.name}</td>
                                        <td className="text-left" style={{ border: '1px solid #eee' }}>{student.campus}</td>
                                        {data.tests.map((test, tIdx) => {
                                            const t = student.tests[test] || {};
                                            return (
                                                <React.Fragment key={tIdx}>
                                                    <td style={{ border: '1px solid #eee' }}>{t.tot || '-'}</td>
                                                    <td style={{ border: '1px solid #eee' }}>{t.air || '-'}</td>
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
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : !loading && (
                <div className="empty-state">
                    <p>Select at least one Test and click <strong>View Report</strong> to generate the summary.</p>
                </div>
            )
            }

            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ ...modal, isOpen: false })}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            />
        </div >
    );
};

export default ErrorCountReport;
