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
    const reportRef = useRef(null);

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
                // console.warn("Failed to load image:", src);
                resolve(null);
            };
        });
    };

    // Helper: Load Font
    const loadFont = async (url) => {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to load font: ${url}`);
            const blob = await res.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(blob);
            });
        } catch (err) {
            console.error("Font load error:", err);
            return null;
        }
    };

    // PDF Generator
    const generatePDF = async () => {
        if (reportData.length === 0) return;
        setGeneratingPdf(true);
        setPdfProgress('Loading Resources...');

        try {
            // Load Fonts & Resources
            const [impactFont, bookmanFont, bookmanBoldFont] = await Promise.all([
                loadFont('/fonts/unicode.impact.ttf'),
                loadFont('/fonts/bookman-old-style.ttf'),
                loadFont('/fonts/BOOKOSB.TTF')
            ]);

            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 10;
            const contentWidth = pageWidth - (margin * 2);

            // Register Fonts
            if (impactFont) {
                doc.addFileToVFS("unicode.impact.ttf", impactFont);
                doc.addFont("unicode.impact.ttf", "Impact", "normal");
            }
            if (bookmanFont) {
                doc.addFileToVFS("bookman-old-style.ttf", bookmanFont);
                doc.addFont("bookman-old-style.ttf", "Bookman", "normal");
            }
            if (bookmanBoldFont) {
                doc.addFileToVFS("BOOKOSB.TTF", bookmanBoldFont);
                doc.addFont("BOOKOSB.TTF", "Bookman", "bold");
            }

            let isFirstPage = true;

            const addHeader = (doc) => {
                let y = 15;

                // 1. Title: "Sri Chaitanya" (Impact) + " Educational Institutions" (Bookman)
                const part1 = "Sri Chaitanya";
                const part2 = " Educational Institutions";

                doc.setFontSize(26);

                // Measure
                if (impactFont) doc.setFont("Impact", "normal");
                else doc.setFont("helvetica", "bold");
                const w1 = doc.getTextWidth(part1);

                if (bookmanFont) doc.setFont("Bookman", "normal");
                else doc.setFont("helvetica", "normal");
                const w2 = doc.getTextWidth(part2);

                const startX = (pageWidth - (w1 + w2)) / 2;

                // Draw Part 1
                if (impactFont) doc.setFont("Impact", "normal");
                else doc.setFont("helvetica", "bold");
                doc.setTextColor(0, 112, 192); // #0070C0
                doc.text(part1, startX, y);

                // Draw Part 2
                if (bookmanFont) doc.setFont("Bookman", "normal");
                else doc.setFont("helvetica", "normal");
                doc.setTextColor(0, 112, 192); // Same Blue
                doc.text(part2, startX + w1, y);

                y += 6;

                // 2. Subtitles
                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.text("A.P, Telangana, Karnataka, Tamilnadu, Maharashtra, Delhi, Ranchi", pageWidth / 2, y, { align: 'center' });
                y += 5;

                doc.setFont("times", "italic"); // Serif italic
                doc.setFontSize(14);
                doc.text("A Right Choice for the Real Aspirant", pageWidth / 2, y, { align: 'center' });
                y += 5;

                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.text("CENTRAL OFFICE, BANGALORE", pageWidth / 2, y, { align: 'center' });

                return y + 5; // Return text bottom Y
            };

            for (const student of reportData) {
                for (const test of student.tests) {
                    if (!isFirstPage) doc.addPage();
                    const headerBottom = addHeader(doc);
                    isFirstPage = false;

                    let yPos = headerBottom + 2;

                    // Student & Test Info Table
                    // Row 1: Name and Campus
                    // Centered Text in each half
                    doc.setLineWidth(0.3);
                    doc.setDrawColor(0);
                    doc.setFillColor(255, 248, 220); // Cornsilk
                    doc.rect(margin, yPos, contentWidth, 8, 'FD'); // Name Row BG

                    if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                    else doc.setFont("helvetica", "bold");
                    doc.setFontSize(11);
                    doc.setTextColor(0);

                    // Left Half Center
                    const leftCenter = margin + (contentWidth / 4);
                    doc.text(student.info.name || '', leftCenter, yPos + 5.5, { align: 'center' });

                    // Right Half Center
                    const rightCenter = margin + (contentWidth * 0.75);
                    doc.text(student.info.branch || '', rightCenter, yPos + 5.5, { align: 'center' });

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
                    yPos += 8; // Small gap

                    // QUESTIONS Loop
                    setPdfProgress(`Processing ${student.info.name}...`);

                    for (let i = 0; i < test.questions.length; i++) {
                        const q = test.questions[i];

                        // Check Page Break
                        // Need approx 50mm for a question block
                        if (yPos + 55 > pageHeight - margin) {
                            doc.addPage();
                            addHeader(doc);
                            yPos = 35; // Reset Y (approx) or calculate dynamic
                        } else if (i > 0) {
                            yPos += 2; // Gap between questions
                        }

                        // Block Height and Layout
                        const blockH = 45; // Fixed height for block
                        const headerH = 7;

                        // 1. Header Bar (Red)
                        doc.setFillColor(128, 0, 0); // Maroon
                        doc.rect(margin, yPos, contentWidth, headerH, 'F');

                        doc.setTextColor(255);
                        if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                        else doc.setFont("helvetica", "bold");
                        doc.setFontSize(9);

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
                        if (qImg) {
                            fitImage(qImg, imgAreaX, yPos + headerH, imgAreaW / 2, imgAreaH);
                        } else {
                            doc.setTextColor(150);
                            doc.text("No Q Image", imgAreaX + 10, yPos + headerH + 10);
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
            <div className="pdf-viewer-container" style={{ background: '#525659', padding: '20px', minHeight: '600px', overflowX: 'auto' }}>
                {loading && (
                    <div className="bg-white p-8 rounded shadow text-center mx-auto max-w-lg">
                        <div className="animate-spin text-4xl mb-4">↻</div>
                        <div>Loading Report Data...</div>
                    </div>
                )}

                {!loading && reportData.length === 0 && (
                    <div className="bg-white p-12 rounded shadow text-center mx-auto max-w-xl">
                        <h2 className="text-xl font-bold text-gray-700 mb-2">No Report Data</h2>
                        <p className="text-gray-500">Select a Test or Student to generate the report.</p>
                    </div>
                )}

                {reportData.length > 0 && (
                    <div ref={reportRef} className="report-content">
                        {reportData.map((student, sIdx) => (
                            <div key={sIdx} className="student-group">
                                {student.tests.map((test, tIdx) => (
                                    <div key={tIdx} className="report-page shadow-lg mx-auto bg-white mb-8" style={{ width: '210mm', minHeight: '297mm', padding: '10mm', position: 'relative' }}>

                                        {/* SCREEN PREVIEW HEADER */}
                                        <div className="brand-header text-center mb-4">
                                            <div className="flex justify-center items-end" style={{ color: '#0070c0' }}>
                                                <span style={{ fontFamily: 'Impact, sans-serif', fontSize: '26px' }}>Sri Chaitanya</span>
                                                <span style={{ fontFamily: 'Bookman, serif', fontSize: '26px', marginLeft: '5px' }}> Educational Institutions</span>
                                            </div>
                                            <div className="text-center font-bold text-[10px] uppercase mb-1">
                                                A.P, Telangana, Karnataka, Tamilnadu, Maharashtra, Delhi, Ranchi
                                            </div>
                                            <div className="font-serif italic text-lg mb-1">
                                                A Right Choice for the Real Aspirant
                                            </div>
                                            <div className="font-bold text-sm uppercase">
                                                Central Office, Bangalore
                                            </div>
                                        </div>

                                        {/* INFO TABLE */}
                                        <div className="info-section border border-black mb-4 text-xs font-bold">
                                            <div className="flex border-b border-black bg-[#fff8dc]">
                                                <div className="flex-1 p-2 border-r border-black uppercase text-center">{student.info.name}</div>
                                                <div className="flex-1 p-2 uppercase text-center">{student.info.branch}</div>
                                            </div>
                                            <div className="flex text-center bg-[#fce4d6] border-b border-black">
                                                <div className="flex-1 border-r border-black p-1">Test</div>
                                                <div className="flex-1 border-r border-black p-1">Date</div>
                                                <div className="flex-1 border-r border-black p-1">TOT</div>
                                                <div className="flex-1 border-r border-black p-1">AIR</div>
                                                <div className="flex-1 border-r border-black p-1">BOT</div>
                                                <div className="flex-1 border-r border-black p-1">Rank</div>
                                                <div className="flex-1 border-r border-black p-1">ZOO</div>
                                                <div className="flex-1 border-r border-black p-1">Rank</div>
                                                <div className="flex-1 border-r border-black p-1">PHY</div>
                                                <div className="flex-1 border-r border-black p-1">Rank</div>
                                                <div className="flex-1 border-r border-black p-1">CHEM</div>
                                                <div className="flex-1 p-1">Rank</div>
                                            </div>
                                            <div className="flex text-center bg-white text-red-700">
                                                <div className="flex-1 border-r border-black p-1">{test.meta.testName}</div>
                                                <div className="flex-1 border-r border-black p-1">{test.meta.date}</div>
                                                <div className="flex-1 border-r border-black p-1">{test.meta.tot}</div>
                                                <div className="flex-1 border-r border-black p-1">{test.meta.air}</div>
                                                <div className="flex-1 border-r border-black p-1 text-red-800">{test.meta.bot}</div>
                                                <div className="flex-1 border-r border-black p-1 text-red-800">{test.meta.b_rank}</div>
                                                <div className="flex-1 border-r border-black p-1 text-red-800">{test.meta.zoo}</div>
                                                <div className="flex-1 border-r border-black p-1 text-red-800">{test.meta.z_rank}</div>
                                                <div className="flex-1 border-r border-black p-1 text-red-800">{test.meta.phy}</div>
                                                <div className="flex-1 border-r border-black p-1 text-red-800">{test.meta.p_rank}</div>
                                                <div className="flex-1 border-r border-black p-1 text-red-800">{test.meta.chem}</div>
                                                <div className="flex-1 p-1 text-red-800">{test.meta.c_rank}</div>
                                            </div>
                                        </div>

                                        {/* QUESTIONS */}
                                        <div className="questions-list">
                                            {test.questions.map((q, idx) => (
                                                <div key={idx} className="question-block mb-2 border border-black break-inside-avoid">
                                                    {/* Q Header */}
                                                    <div className="flex items-center bg-[#800000] text-white text-xs font-bold h-6 border-b border-black">
                                                        <div className="w-10 text-center border-r border-white">{q.W_U}</div>
                                                        <div className="w-10 text-center border-r border-white">{q.Q_No}</div>
                                                        <div className="flex-1 pl-2 truncate border-r border-white">Topic: <span className="text-yellow-200">{q.Topic}</span></div>
                                                        <div className="flex-1 pl-2 truncate border-r border-white">Sub: <span className="text-yellow-200">{q.Sub_Topic}</span></div>
                                                        <div className="w-20 text-center">Key: {q.Key_Value}</div>
                                                    </div>

                                                    {/* Q Content */}
                                                    <div className="flex h-[180px]">
                                                        {/* Side Strip */}
                                                        <div className="w-8 bg-[#4682b4] text-white flex items-center justify-center border-r border-black">
                                                            <div style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: '10px', fontWeight: 'bold', letterSpacing: '1px' }}>
                                                                {q.Subject}
                                                            </div>
                                                        </div>
                                                        {/* Images */}
                                                        <div className="flex flex-1">
                                                            <div className="w-1/2 border-r border-black p-1 flex items-center justify-center relative">
                                                                <span className="absolute top-1 left-1 text-xs font-bold">{q.Q_No}</span>
                                                                {q.Q_URL ? <img src={q.Q_URL} style={{ maxWidth: '321px', maxHeight: '100%' }} alt="Q" /> : <span className="text-xs text-gray-300">No Image</span>}
                                                            </div>
                                                            <div className="w-1/2 p-1 flex items-center justify-center">
                                                                {q.S_URL ? <img src={q.S_URL} style={{ maxWidth: '321px', maxHeight: '100%' }} alt="Sol" /> : <span className="text-xs text-gray-300">No Solution</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ErrorReport;
