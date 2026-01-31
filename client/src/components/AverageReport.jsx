
import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const AverageReport = ({ filters }) => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });


    // Reset results when filters change to maintain consistency
    useEffect(() => {
        setHistory([]);
        setHasSearched(false);
    }, [filters.campus, filters.stream, filters.testType, filters.test, filters.topAll, filters.studentSearch]);

    const fetchData = async () => {
        if (!filters.studentSearch || filters.studentSearch.length === 0) {
            setModal({
                isOpen: true,
                type: 'info',
                title: 'Select Student',
                message: 'Please select a student from the filters first.',
                onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
            });
            return;
        }

        setLoading(true);
        setHasSearched(true);
        try {
            const params = buildQueryParams(filters);
            const response = await fetch(`${API_URL}/api/history?${params.toString()}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Status: ${response.status}`);
            }
            const data = await response.json();
            setHistory(data);
        } catch (err) {
            console.error("Fetch Error:", err);
            setModal({
                isOpen: true,
                type: 'danger',
                title: 'Error',
                message: `Failed to load student history: ${err.message}`,
                onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
            });
        } finally {
            setLoading(false);
        }
    };

    const loadImage = (src) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
        });
    };

    const generateStudentPDF = (studentData, bgImg, logoImg) => {
        const doc = new jsPDF('p', 'mm', 'a4');

        // Draw background on first page
        if (bgImg) {
            try {
                doc.addImage(bgImg, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
            } catch (e) { }
        }

        // Add event listener for SUBSEQUENT pages to draw background BEFORE content
        doc.internal.events.subscribe('addPage', () => {
            if (bgImg) {
                try {
                    doc.addImage(bgImg, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
                } catch (e) { }
            }
        });

        let currentY = 11; // Reduced top margin

        // 1. Logo & Institution Name - Centered Together
        // Split Title into two lines with custom colors/fonts
        const title1 = "SRI CHAITANYA";
        const title2 = "EDUCATIONAL INSTITUTIONS";

        doc.setFont("helvetica", "bold");
        doc.setFontSize(22); // Consistent size as before
        doc.setTextColor(0, 112, 192); // #0070C0

        if (logoImg) {
            const aspect = logoImg.width / logoImg.height;
            let logoH = 20; // Slightly larger logo
            let logoW = logoH * aspect;

            // Draw Logo Centered Top
            const logoX = (210 - logoW) / 2;
            doc.addImage(logoImg, 'PNG', logoX, currentY, logoW, logoH, undefined, 'FAST');
            currentY += logoH + 6; // Reduced gap below logo

            // Draw Title 1
            doc.setFont("helvetica", "bold");
            doc.setFontSize(30); // Increased size
            doc.setTextColor(0, 112, 192);
            doc.text(title1, 105, currentY, { align: 'center' });
            currentY += 8;

            currentY += 8;

            // Draw Title 2
            doc.setFontSize(18); // Slightly larger
            doc.setTextColor(0, 102, 204);
            doc.text(title2, 105, currentY, { align: 'center' });
        } else {
            // Draw Title 1
            doc.setFont("helvetica", "bold");
            doc.setFontSize(30); // Increased size
            doc.setTextColor(0, 112, 192);
            doc.text(title1, 105, currentY, { align: 'center' });
            currentY += 8;

            // Draw Title 2
            doc.setFontSize(18); // Slightly larger
            doc.setTextColor(0, 102, 204);
            doc.text(title2, 105, currentY, { align: 'center' });
        }
        currentY += 10; // Reduced gap below title

        // 3. Subtitle
        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(12); // Slightly smaller
        doc.setTextColor(0, 0, 0); // Pure Black
        const subTitle = "P R O G R E S S   R E P O R T";
        doc.text(subTitle, 105, currentY, { align: 'center' });
        currentY += 4; // Reduced gap below subtitle

        // 4. Line
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        doc.line(15, currentY, 195, currentY);
        currentY += 5; // Reduced gap below line

        // 5. Details Header - Pastel Background
        if (studentData.length > 0) {
            const student = studentData[0];
            doc.setFillColor(239, 246, 255); // Pastel Blue
            doc.setDrawColor(0, 0, 0); // Black border
            doc.setLineWidth(0.1);
            doc.roundedRect(15, currentY, 180, 20, 1, 1, 'FD'); // FD = Fill then Draw

            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);

            const textYStart = currentY + 8;
            const col1X = 20;
            const col2X = 115;

            doc.text("Student Name:", col1X, textYStart);
            doc.setFont("helvetica", "normal");
            doc.text(student.NAME_OF_THE_STUDENT || '', col1X + 30, textYStart);

            doc.setFont("helvetica", "bold");
            doc.text("Campus:", col2X, textYStart);
            doc.setFont("helvetica", "normal");
            doc.text(student.CAMPUS_NAME || '', col2X + 22, textYStart);

            const row2Y = textYStart + 7;
            doc.setFont("helvetica", "bold");
            doc.text("Student ID:", col1X, row2Y);
            doc.setFont("helvetica", "normal");
            doc.text(student.STUD_ID?.toString() || '', col1X + 30, row2Y);
            currentY += 20;
        }

        const tableColumn = ["Test Name", "Date", "Total\n720", "AIR", "Bot\n180", "Zoo\n180", "Phy\n180", "Chem\n180"];
        const tableRows = studentData.map(row => [
            row.Test,
            formatDate(row.DATE),
            Math.round(row.Tot_720 || 0),
            Math.round(row.AIR) || '-',
            Math.round(row.Botany || 0),
            Math.round(row.Zoology || 0),
            Math.round(row.Physics || 0),
            Math.round(row.Chemistry || 0)
        ]);

        // Average
        if (studentData.length > 0) {
            const avg = (key) => Math.round(studentData.reduce((a, b) => a + (Number(b[key]) || 0), 0) / studentData.length);
            const avgAIR = Math.round(studentData.reduce((a, b) => a + (Number(b.AIR) || 0), 0) / studentData.length);

            tableRows.push([
                "AVERAGE",
                "",
                avg('Tot_720'),
                avgAIR,
                avg('Botany'),
                avg('Zoology'),
                avg('Physics'),
                avg('Chemistry')
            ]);
        }

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: currentY + 5, // Start closer to detail header
            theme: 'grid',
            headStyles: {
                fillColor: [0, 0, 0], // Pure Black headers
                textColor: [255, 255, 255],
                font: "helvetica",
                fontStyle: "bold",
                halign: 'center',
                valign: 'middle',
                lineWidth: 0.2
            },
            styles: {
                font: "helvetica",
                fontSize: 9, // Smaller font for compactness
                cellPadding: 2.5, // Tighter padding
                overflow: 'linebreak',
                halign: 'center',
                valign: 'middle',
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                textColor: [0, 0, 0] // Black text in cells
            },
            columnStyles: {
                0: { halign: 'center' } // Centered and auto-fit
            },
            margin: { left: 15, right: 15, bottom: 15 },
            didParseCell: (data) => {
                if (data.row.index === tableRows.length - 1) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = [224, 231, 255];
                    data.cell.styles.textColor = [0, 0, 0];
                }
            }
        });

        return doc;
    };

    const downloadPDF = async () => {
        try {
            const [bgImg, logoImg] = await Promise.all([
                loadImage('/college-bg.png'),
                loadImage('/logo.png')
            ]);

            // Group by Student ID
            const grouped = history.reduce((acc, row) => {
                const id = row.STUD_ID || 'Unknown';
                if (!acc[id]) acc[id] = [];
                acc[id].push(row);
                return acc;
            }, {});

            const studentIds = Object.keys(grouped);
            if (studentIds.length === 0) return;

            if (studentIds.length === 1) {
                // Single Download
                const doc = generateStudentPDF(grouped[studentIds[0]], bgImg, logoImg);
                const sName = grouped[studentIds[0]][0].NAME_OF_THE_STUDENT || 'Report';
                doc.save(`${sName}_Progress_Report.pdf`);
            } else {
                // Bulk Download (ZIP)
                const zip = new JSZip();
                const campusName = grouped[studentIds[0]][0].CAMPUS_NAME || 'Campus';

                studentIds.forEach(id => {
                    const sRows = grouped[id];
                    const sName = sRows[0].NAME_OF_THE_STUDENT || id;
                    const doc = generateStudentPDF(sRows, bgImg, logoImg);
                    const pdfBlob = doc.output('blob');
                    zip.file(`${sName}_Progress_Report.pdf`, pdfBlob);
                });

                const content = await zip.generateAsync({ type: "blob" });
                saveAs(content, `${campusName}_Progress_Reports.zip`);
            }

        } catch (err) {
            console.error("PDF Generation Error:", err);
            setModal({
                isOpen: true,
                type: 'danger',
                title: 'PDF Error',
                message: "Failed to generate PDF(s).",
                onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
            });
        }
    };

    // UI: If multiple students, show a summary or just the first student?
    // User requested Bulk Download, implies they might be okay seeing one or just knowing they are selected.
    // For now, let's show the FIRST student's data as a preview if multiple are selected,
    // possibly adding a banner saying "X Students Selected".

    // Helper to get preview student
    const previewStudent = history.length > 0 ? history[0] : null;
    // Actually, if mixed, history[0] is just the first row. We need to find rows for that student.
    const previewRows = previewStudent
        ? history.filter(h => h.STUD_ID?.toString() === previewStudent.STUD_ID?.toString())
        : [];

    // Unique students count
    const uniqueStudents = new Set(history.map(h => h.STUD_ID)).size;

    return (
        <div className="average-report-container">
            <div className="card">
                <div className="toolbar">
                    <div>
                        <h3 style={{ margin: 0 }}>Detailed Performance</h3>
                        {uniqueStudents > 1 && (
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                                (Previewing 1 of {uniqueStudents} selected students)
                            </span>
                        )}
                    </div>
                    <div className="button-group" style={{ display: 'flex', gap: '10px' }}>
                        <button className="btn-primary" onClick={fetchData} style={{ backgroundColor: '#6366f1' }}>
                            View Report
                        </button>
                        <button className="btn-primary" onClick={downloadPDF} disabled={history.length === 0} style={{ backgroundColor: '#10b981' }}>
                            {uniqueStudents > 1 ? `Download All (${uniqueStudents})` : 'Download PDF'}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <p>Updating Report History...</p>
                    </div>
                ) : !hasSearched ? (
                    <div className="empty-state">
                        <p>Select a student and click <strong>View Report</strong> to see detailed performance.</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="empty-state">
                        <p>No data found for this student with the current filters.</p>
                    </div>
                ) : (
                    <>
                        {previewRows.length > 0 && (
                            <div className="table-container">
                                <table className="analysis-table merit-style">
                                    <thead>
                                        <tr className="grouped-header">
                                            <th colSpan={3} className="header-group-blue">
                                                <div className="header-label">CAMPUS</div>
                                                <div className="header-value">{previewRows[0].CAMPUS_NAME}</div>
                                            </th>
                                            <th colSpan={1} className="header-group-blue">
                                                <div className="header-label">STUD ID</div>
                                                <div className="header-value">{previewRows[0].STUD_ID}</div>
                                            </th>
                                            <th colSpan={5} className="header-group-blue">
                                                <div className="header-label">NAME OF THE STUDENT</div>
                                                <div className="header-value">
                                                    {previewRows[0].NAME_OF_THE_STUDENT}
                                                </div>
                                            </th>

                                        </tr>
                                        <tr className="table-main-header">
                                            <th className="w-test">Test Name</th>
                                            <th className="w-date">Date</th>
                                            <th className="w-total col-yellow">Total<br />720</th>
                                            <th className="w-air">AIR</th>
                                            <th className="w-sub col-orange">Bot<br />180</th>
                                            <th className="w-sub col-blue-light">Zoo<br />180</th>
                                            <th className="w-sub col-blue-med">Bio<br />360</th>
                                            <th className="w-sub col-green-pale">Phy<br />180</th>
                                            <th className="w-sub col-pink-pale">Chem<br />180</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewRows.map((row, idx) => (
                                            <tr key={idx}>
                                                <td>{row.Test}</td>
                                                <td>{formatDate(row.DATE)}</td>
                                                <td className="col-yellow font-bold">{Number(row.Tot_720 || 0).toFixed(1)}</td>
                                                <td className="text-brown">{Math.round(row.AIR) || '-'}</td>
                                                <td className="col-orange">{Number(row.Botany || 0).toFixed(1)}</td>
                                                <td className="col-blue-light">{Number(row.Zoology || 0).toFixed(1)}</td>
                                                <td className="col-blue-med font-bold">{((Number(row.Botany || 0) + Number(row.Zoology || 0))).toFixed(1)}</td>
                                                <td className="col-green-pale">{Number(row.Physics || 0).toFixed(1)}</td>
                                                <td className="col-pink-pale">{Number(row.Chemistry || 0).toFixed(1)}</td>
                                            </tr>
                                        ))}
                                        <tr className="total-row">
                                            <td colSpan={2} className="text-right">AVERAGES</td>
                                            <td className="col-yellow">{(previewRows.reduce((a, b) => a + (Number(b.Tot_720) || 0), 0) / previewRows.length).toFixed(1)}</td>
                                            <td>{Math.round(previewRows.reduce((a, b) => a + (Number(b.AIR) || 0), 0) / previewRows.length)}</td>
                                            <td className="col-orange">{(previewRows.reduce((a, b) => a + (Number(b.Botany) || 0), 0) / previewRows.length).toFixed(1)}</td>
                                            <td className="col-blue-light">{(previewRows.reduce((a, b) => a + (Number(b.Zoology) || 0), 0) / previewRows.length).toFixed(1)}</td>
                                            <td className="col-blue-med">{(previewRows.reduce((a, b) => a + (Number(b.Botany || 0) + Number(b.Zoology || 0)), 0) / previewRows.length).toFixed(1)}</td>
                                            <td className="col-green-pale">{(previewRows.reduce((a, b) => a + (Number(b.Physics) || 0), 0) / previewRows.length).toFixed(1)}</td>
                                            <td className="col-pink-pale">{(previewRows.reduce((a, b) => a + (Number(b.Chemistry) || 0), 0) / previewRows.length).toFixed(1)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

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

export default AverageReport;
