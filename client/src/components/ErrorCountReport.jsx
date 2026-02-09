
import React, { useState, useEffect } from 'react';
import { buildQueryParams, API_URL } from '../utils/apiHelper';
import LoadingTimer from './LoadingTimer';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import Modal from './Modal';

const ErrorCountReport = ({ filters }) => {
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

        // 1. Branding Row
        worksheet.addRow(['Sri Chaitanya Educational Institutions., India']);
        const totalCols = 3 + data.tests.length * 18;
        const lastColLetter = getColumnLetter(totalCols);
        worksheet.mergeCells(`A1:${lastColLetter}1`);
        const brandingCell = worksheet.getCell('A1');
        brandingCell.font = { size: 20, bold: true, color: { argb: 'FF0070C0' } };
        brandingCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(1).height = 35;

        // 2. Report Name Row
        worksheet.addRow(["Test Wise 'W' and 'U' Counts"]);
        worksheet.mergeCells('A2:C2');
        const nameCell = worksheet.getCell('A2');
        nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF339966' } };
        nameCell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
        nameCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(2).height = 25;

        // 3. Header Row 1 (Fixed cols + Test Names)
        const header1 = ['STUD_ID', 'Name', 'Campus'];
        data.tests.forEach(testName => {
            header1.push(testName);
            for (let i = 1; i < 18; i++) header1.push('');
        });
        worksheet.addRow(header1);

        // Merge STUD_ID, Name, Campus vertically (Rows 3 & 4)
        worksheet.mergeCells('A3:A4');
        worksheet.mergeCells('B3:B4');
        worksheet.mergeCells('C3:C4');

        // Merge Test Names horizontally
        data.tests.forEach((_, idx) => {
            const startCol = 4 + idx * 18;
            const endCol = startCol + 17;
            worksheet.mergeCells(3, startCol, 3, endCol);
        });

        // 4. Header Row 2 (Subheaders)
        const header2 = ['', '', ''];
        data.tests.forEach(() => {
            header2.push(
                'TOT', 'AIR',
                'BOT', 'B_RANK', 'BOT W Count', 'BOT U Count',
                'ZOO', 'Z_RANK', 'ZOO W Count', 'ZOO U Count',
                'PHY', 'P_RANK', 'PHY W Count', 'PHY U Count',
                'CHE', 'C_RANK', 'CHE W Count', 'CHE U Count'
            );
        });
        worksheet.addRow(header2);

        // Styling Headers
        [3, 4].forEach(rowNum => {
            const row = worksheet.getRow(rowNum);
            row.eachCell(cell => {
                cell.font = { bold: true, size: 9 };
                cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowNum === 3 ? 'FF008080' : 'FFF3F4F6' } };
                if (rowNum === 3) cell.font.color = { argb: 'FFFFFFFF' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // 5. Data Rows
        data.students.forEach(student => {
            const vals = [student.STUD_ID, student.name, student.campus];
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
            const row = worksheet.addRow(vals);
            row.eachCell((cell, colIdx) => {
                cell.alignment = { horizontal: colIdx <= 3 ? 'left' : 'center' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };

                // Highlight W and U columns
                if (colIdx > 3) {
                    const relativeIdx = (colIdx - 4) % 18;
                    const isW = [4, 8, 12, 16].includes(relativeIdx);
                    const isU = [5, 9, 13, 17].includes(relativeIdx);
                    if (isW) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE2E2' } };
                    if (isU) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
                }
            });
        });

        // Column Widths
        worksheet.getColumn(1).width = 15;
        worksheet.getColumn(2).width = 30;
        worksheet.getColumn(3).width = 25;
        for (let i = 4; i <= totalCols; i++) {
            worksheet.getColumn(i).width = 8;
        }

        const buffer = await workbook.xlsx.writeBuffer();
        saveAs(new Blob([buffer]), 'Error_Count_Report.xlsx');
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
