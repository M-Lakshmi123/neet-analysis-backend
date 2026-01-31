import React, { useState, useEffect, useRef } from 'react';
import FilterBar from './FilterBar';
import { API_URL, buildQueryParams, formatDate } from '../utils/apiHelper';
import { useAuth } from './auth/AuthProvider';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

const ErrorReport = () => {
    const { userData, isAdmin } = useAuth();
    const [filters, setFilters] = useState({
        campus: [],
        stream: [],
        testType: [],
        test: [],
        topAll: [],
        studentSearch: []
    });
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [pdfProgress, setPdfProgress] = useState('');

    // Fetch Report Data
    useEffect(() => {
        const fetchData = async () => {
            if (filters.test.length === 0 && filters.studentSearch.length === 0) {
                setReportData([]);
                return;
            }

            setLoading(true);
            try {
                const params = buildQueryParams(filters);
                const res = await fetch(`${API_URL}/api/erp/report?${params.toString()}`);
                const data = await res.json();

                // Group Data
                const grouped = {};
                data.forEach(row => {
                    const studKey = `${row.STUD_ID}_${row.Student_Name}`;
                    if (!grouped[studKey]) {
                        grouped[studKey] = {
                            info: {
                                name: row.Student_Name,
                                id: row.STUD_ID,
                                branch: row.Branch,
                                stream: row.Stream
                            },
                            tests: {}
                        };
                    }
                    const testKey = row.Test;
                    if (!grouped[studKey].tests[testKey]) {
                        grouped[studKey].tests[testKey] = {
                            meta: {
                                testName: row.Test,
                                date: row.Exam_Date,
                                tot: row.Tot_720,
                                air: row.AIR,
                                bot: row.Botany,
                                b_rank: row.B_Rank,
                                zoo: row.Zoology,
                                z_rank: row.Z_Rank,
                                phy: row.Physics,
                                p_rank: row.P_Rank,
                                chem: row.Chemistry,
                                c_rank: row.C_Rank
                            },
                            questions: []
                        };
                    }
                    grouped[studKey].tests[testKey].questions.push(row);
                });

                const processed = Object.values(grouped).map(student => ({
                    ...student,
                    tests: Object.values(student.tests)
                }));
                setReportData(processed);

            } catch (err) {
                console.error("Error fetching report:", err);
            } finally {
                setLoading(false);
            }
        };

        const timeout = setTimeout(fetchData, 500);
        return () => clearTimeout(timeout);
    }, [filters]);

    // Helper: Load Image
    const loadImage = (src) => {
        if (!src) return Promise.resolve(null);
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = src;
            img.onload = () => resolve(img);
            img.onerror = () => {
                console.warn("Failed to load image:", src);
                resolve(null);
            };
        });
    };

    // PDF Generator
    const generatePDF = async () => {
        if (reportData.length === 0) return;
        setGeneratingPdf(true);
        setPdfProgress('Initializing...');

        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 10;
            const contentWidth = pageWidth - (margin * 2);

            let isFirstPage = true;

            const addHeader = (doc) => {
                // Title
                doc.setFont("helvetica", "bold");
                doc.setFontSize(22);
                doc.setTextColor(0, 0, 128); // Navy Blue
                doc.text("SRI CHAITANYA EDUCATIONAL INSTITUTIONS", pageWidth / 2, 15, { align: 'center' });

                // Subtitles
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.text("A.P, Telangana, Karnataka, Tamilnadu, Maharashtra, Delhi, Ranchi", pageWidth / 2, 20, { align: 'center' });

                doc.setFont("times", "italic"); // Serif italic
                doc.setFontSize(14);
                doc.text("A Right Choice for the Real Aspirant", pageWidth / 2, 26, { align: 'center' });

                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.text("CENTRAL OFFICE, BANGALORE", pageWidth / 2, 31, { align: 'center' });
            };

            for (const student of reportData) {
                for (const test of student.tests) {
                    if (!isFirstPage) doc.addPage();
                    addHeader(doc);
                    isFirstPage = false;

                    let yPos = 35;

                    // Student & Test Info Table
                    // Row 1: Name and Campus
                    doc.setLineWidth(0.3);
                    doc.setDrawColor(0);
                    doc.setFillColor(255, 248, 220); // Cornsilk
                    doc.rect(margin, yPos, contentWidth, 8, 'FD'); // Name Row BG

                    doc.setFontSize(11);
                    doc.setTextColor(0);
                    doc.text(student.info.name || '', margin + 2, yPos + 5.5);
                    doc.text(student.info.branch || '', pageWidth - margin - 2, yPos + 5.5, { align: 'right' });

                    doc.line(pageWidth / 2, yPos, pageWidth / 2, yPos + 8); // Split Name/Branch
                    yPos += 8;

                    // Row 2: Headers
                    const colCount = 12;
                    const colW = contentWidth / colCount;
                    const headers = ["Test", "Date", "TOT", "AIR", "BOT", "Rank", "ZOO", "Rank", "PHY", "Rank", "CHEM", "Rank"];

                    doc.setFillColor(252, 228, 214); // Light Orange header
                    doc.rect(margin, yPos, contentWidth, 6, 'FD');

                    doc.setFontSize(9);
                    headers.forEach((h, i) => {
                        const x = margin + (i * colW);
                        doc.text(h, x + (colW / 2), yPos + 4, { align: 'center' });
                        if (i > 0) doc.line(x, yPos, x, yPos + 6);
                    });
                    yPos += 6;

                    // Row 3: Values
                    const values = [
                        test.meta.testName, test.meta.date,
                        test.meta.tot, test.meta.air,
                        test.meta.bot, test.meta.b_rank,
                        test.meta.zoo, test.meta.z_rank,
                        test.meta.phy, test.meta.p_rank,
                        test.meta.chem, test.meta.c_rank
                    ];

                    doc.setFillColor(255, 255, 255);
                    doc.rect(margin, yPos, contentWidth, 6, 'FD');
                    doc.setTextColor(180, 0, 0); // Red text

                    values.forEach((v, i) => {
                        const x = margin + (i * colW);
                        doc.text(String(v || '-'), x + (colW / 2), yPos + 4, { align: 'center' });
                        if (i > 0) doc.line(x, yPos, x, yPos + 6);
                    });

                    // Outer border for table
                    doc.rect(margin, yPos - 12, contentWidth, 18);
                    yPos += 10; // Spacing after table

                    // QUESTIONS Loop
                    setPdfProgress(`Processing ${student.info.name}...`);

                    for (let i = 0; i < test.questions.length; i++) {
                        const q = test.questions[i];

                        // Check Page Break
                        // Need approx 45mm for a question block + gap
                        if (yPos + 45 > pageHeight - margin) {
                            doc.addPage();
                            addHeader(doc);
                            yPos = 35; // Reset Y
                        } else if (i > 0) {
                            yPos += 2; // Gap between questions
                        }

                        // Block Height and Layout
                        const blockH = 45; // Fixed height for block
                        const headerH = 7;

                        // 1. Header Bar (Red)
                        doc.setFillColor(128, 0, 0); // Maroon
                        doc.rect(margin, yPos, contentWidth, headerH, 'F');

                        doc.setTextColor(255, 255, 255);
                        doc.setFontSize(9);
                        doc.setFont("helvetica", "bold");

                        // Header Content
                        // W/U | Q No | Topic | Sub Topic | Key
                        let x = margin;

                        // W/U
                        doc.text(String(q.W_U || ''), x + 5, yPos + 4.5);
                        doc.setDrawColor(255);
                        doc.line(x + 10, yPos, x + 10, yPos + headerH);
                        x += 10;

                        // Q No
                        doc.text(String(q.Q_No), x + 5, yPos + 4.5);
                        doc.line(x + 10, yPos, x + 10, yPos + headerH);
                        x += 10;

                        // Topic
                        doc.text(`Topic: ${q.Topic || ''}`, x + 2, yPos + 4.5);
                        // Subtopic (Right aligned-ish)
                        const subX = margin + contentWidth - 60;
                        doc.text(`Sub Topic: ${q.Sub_Topic || ''}`, subX - 30, yPos + 4.5);

                        // Key
                        const keyX = margin + contentWidth - 15;
                        doc.line(keyX - 5, yPos, keyX - 5, yPos + headerH);
                        doc.text(`Key: ${q.Key_Value}`, keyX, yPos + 4.5, { align: 'center' });

                        // 2. Content Block Border
                        doc.setDrawColor(0);
                        doc.rect(margin, yPos, contentWidth, blockH); // Outer Border

                        // 3. Subject Strip (Blue Vertical)
                        doc.setFillColor(70, 130, 180); // SteelBlue
                        doc.rect(margin, yPos + headerH, 8, blockH - headerH, 'F');
                        doc.setTextColor(255);
                        doc.setFontSize(8);

                        // Vertical Text Helper
                        doc.text(String(q.Subject || ''), margin + 5, yPos + headerH + 30, { angle: 90 });

                        // 4. Images Area
                        const imgAreaX = margin + 8;
                        const imgAreaW = contentWidth - 8;
                        const imgAreaH = blockH - headerH;

                        // Split Q and Sol
                        doc.setDrawColor(0);
                        doc.line(imgAreaX + (imgAreaW / 2), yPos + headerH, imgAreaX + (imgAreaW / 2), yPos + blockH);

                        // Load Images
                        const qImg = await loadImage(q.Q_URL);
                        const sImg = await loadImage(q.S_URL);

                        const fitImage = (img, x, y, w, h) => {
                            if (!img) return;
                            const aspect = img.width / img.height;
                            let drawW = w - 4; // padding
                            let drawH = drawW / aspect;
                            if (drawH > h - 4) {
                                drawH = h - 4;
                                drawW = drawH * aspect;
                            }
                            const offX = (w - drawW) / 2;
                            const offY = (h - drawH) / 2;
                            try {
                                doc.addImage(img, 'PNG', x + offX, y + offY, drawW, drawH);
                            } catch (e) { console.warn("Image add error", e); }
                        };

                        // Draw Q Image
                        // doc.setTextColor(0);
                        // doc.text(`${q.Q_No}`, imgAreaX + 2, yPos + headerH + 5); // Q No inside
                        if (qImg) {
                            fitImage(qImg, imgAreaX, yPos + headerH, imgAreaW / 2, imgAreaH);
                        } else {
                            doc.setTextColor(150);
                            doc.text("No Q Image", imgAreaX + 20, yPos + headerH + 20);
                        }

                        // Draw S Image
                        if (sImg) {
                            fitImage(sImg, imgAreaX + (imgAreaW / 2), yPos + headerH, imgAreaW / 2, imgAreaH);
                        }

                        yPos += blockH;
                    }
                }
            }

            doc.save(`Error_Report_${reportData[0].info.name}.pdf`);

        } catch (err) {
            console.error("PDF Generation failed:", err);
            alert("Failed to generate PDF. See console.");
        } finally {
            setGeneratingPdf(false);
            setPdfProgress('');
        }
    };


    return (
        <div className="error-report-page">
            <div className="no-print">
                <FilterBar
                    filters={filters}
                    setFilters={setFilters}
                    restrictedCampus={!isAdmin ? userData?.campus : null}
                    apiEndpoints={{
                        filters: '/api/erp/filters',
                        students: '/api/erp/students'
                    }}
                />

                <div className="controls flex justify-between items-center bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-200">
                    <div className="text-sm text-gray-600 font-bold">
                        {reportData.length > 0 ? `${reportData.length} Student(s) Loaded` : 'No Data Loaded'}
                    </div>
                    <button
                        onClick={generatePDF}
                        disabled={reportData.length === 0 || generatingPdf}
                        className={`btn-primary ${reportData.length === 0 || generatingPdf ? 'opacity-50 cursor-not-allowed' : ''} flex items-center gap-2`}
                    >
                        {generatingPdf ? (
                            <>
                                <span className="animate-spin">↻</span> {pdfProgress || 'Generating PDF...'}
                            </>
                        ) : (
                            '⬇ Download PDF File'
                        )}
                    </button>
                </div>
            </div>

            {/* Preview Section */}
            <div className="pdf-viewer-container" style={{ background: '#525659', padding: '20px', minHeight: '400px', overflowX: 'auto' }}>
                {!loading && reportData.length === 0 && (
                    <div className="bg-white p-12 rounded shadow text-center mx-auto max-w-xl">
                        <h2 className="text-xl font-bold text-gray-700 mb-2">No Report Data</h2>
                        <p className="text-gray-500">Select a Test or Student to generate the report.</p>
                    </div>
                )}

                {reportData.length > 0 && (
                    <div className="bg-white p-4 mx-auto max-w-4xl text-center shadow">
                        <h3 className="text-lg font-bold text-gray-700">Report Ready</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            The report covers {reportData.length} student(s).<br />
                            Click <b>Download PDF File</b> above to generate the high-quality PDF.
                        </p>
                        <div className="preview-list text-left border p-4 max-h-[300px] overflow-y-auto bg-gray-50">
                            <h4 className="font-bold border-b mb-2 pb-1">Students Found:</h4>
                            <ul className="list-disc pl-5">
                                {reportData.map((s, i) => (
                                    <li key={i} className="text-sm py-1">
                                        <b>{s.info.name}</b> - {s.tests.length} Test(s)
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ErrorReport;
