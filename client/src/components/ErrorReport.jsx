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

                return y + 2; // Reduced bottom margin (was 5)
            };

            for (const student of reportData) {
                for (const test of student.tests) {
                    if (!isFirstPage) doc.addPage();
                    const headerBottom = addHeader(doc);
                    isFirstPage = false;

                    let yPos = headerBottom + 1; // Start immediately after header (reduced gap)

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
                        // Calculate center Y for vertical text
                        const stripCenterY = yPos + headerH + ((blockH - headerH) / 2);
                        doc.text(String(q.Subject || ''), margin + 5, stripCenterY + 5, { angle: 90, align: 'center' });

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
                            // Target width 321px approx 85mm
                            let drawW = 85;
                            if (drawW > w - 2) drawW = w - 2; // Constrain to column if smaller than target

                            let drawH = drawW / aspect;
                            if (drawH > h - 2) {
                                drawH = h - 2;
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
        <div className="error-report-page min-h-screen bg-gray-500 p-8 overflow-auto">
            {/* Controls */}
            <div className="no-print max-w-[210mm] mx-auto mb-6 bg-white rounded p-4 shadow">
                <FilterBar
                    filters={filters}
                    setFilters={setFilters}
                    restrictedCampus={!isAdmin ? userData?.campus : null}
                    apiEndpoints={{
                        filters: '/api/erp/filters',
                        students: '/api/erp/students'
                    }}
                />

                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                    <div className="font-bold text-gray-700">
                        {reportData.length} Student(s) Loaded
                    </div>
                    <button
                        onClick={generatePDF}
                        disabled={reportData.length === 0 || generatingPdf}
                        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                    >
                        {generatingPdf ? 'Generating PDF...' : '⬇ Download PDF File'}
                    </button>
                </div>
            </div>

            {loading && (
                <div className="text-white text-center text-xl font-bold mt-10">Loading Data...</div>
            )}

            {!loading && reportData.length > 0 && (
                <div className="reports-container flex flex-col gap-8 items-center">
                    {reportData.map((student, sIdx) => (
                        <div key={sIdx} className="student-sheet bg-white shadow-2xl" style={{ width: '210mm', minHeight: '297mm', padding: '10mm', boxSizing: 'border-box' }}>

                            {/* HEADER */}
                            <div className="text-center mb-4">
                                <div className="flex justify-center items-end" style={{ color: '#0070c0' }}>
                                    <span style={{ fontFamily: 'Impact, sans-serif', fontSize: '26px' }}>Sri Chaitanya</span>
                                    <span style={{ fontFamily: 'Bookman, serif', fontSize: '26px', marginLeft: '5px' }}> Educational Institutions</span>
                                </div>
                                <div className="text-[10px] font-bold uppercase mt-1">
                                    A.P, Telangana, Karnataka, Tamilnadu, Maharashtra, Delhi, Ranchi
                                </div>
                                <div className="font-serif italic text-lg mt-1">
                                    A Right Choice for the Real Aspirant
                                </div>
                                <div className="text-sm font-bold uppercase mt-1">
                                    Central Office, Bangalore
                                </div>
                            </div>

                            {/* STUDENT INFO TABLE */}
                            <table className="w-full border-collapse border border-black mb-4 text-xs font-bold font-sans">
                                <tbody>
                                    <tr className="bg-[#fff8dc]">
                                        <td className="border border-black p-2 text-center w-1/2 uppercase">{student.info.name}</td>
                                        <td className="border border-black p-2 text-center w-1/2 uppercase">{student.info.branch}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* TESTS LOOP */}
                            {student.tests.map((test, tIdx) => (
                                <div key={tIdx} className="mb-6">

                                    {/* SCORES TABLE */}
                                    <table className="w-full border-collapse border border-black mb-4 text-xs text-center font-bold">
                                        <thead>
                                            <tr className="bg-[#fce4d6]">
                                                {["Test", "Date", "TOT", "AIR", "BOT", "Rank", "ZOO", "Rank", "PHY", "Rank", "CHEM", "Rank"].map((h, i) => (
                                                    <td key={i} className="border border-black p-1">{h}</td>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr className="text-[#b40000]">
                                                <td className="border border-black p-1 text-black">{test.meta.testName}</td>
                                                <td className="border border-black p-1 text-black">{test.meta.date}</td>
                                                <td className="border border-black p-1 text-black">{test.meta.tot}</td>
                                                <td className="border border-black p-1 text-black">{test.meta.air}</td>
                                                <td className="border border-black p-1">{test.meta.bot}</td>
                                                <td className="border border-black p-1">{test.meta.b_rank}</td>
                                                <td className="border border-black p-1">{test.meta.zoo}</td>
                                                <td className="border border-black p-1">{test.meta.z_rank}</td>
                                                <td className="border border-black p-1">{test.meta.phy}</td>
                                                <td className="border border-black p-1">{test.meta.p_rank}</td>
                                                <td className="border border-black p-1">{test.meta.chem}</td>
                                                <td className="border border-black p-1">{test.meta.c_rank}</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* QUESTIONS LIST */}
                                    <div className="flex flex-col gap-2">
                                        {test.questions.map((q, qIdx) => (
                                            <div key={qIdx} className="border border-black flex flex-col break-inside-avoid">
                                                {/* Header Bar */}
                                                <div className="flex h-7 bg-[#800000] text-white text-xs font-bold border-b border-black">
                                                    <div className="w-10 flex items-center justify-center border-r border-white">{q.W_U}</div>
                                                    <div className="w-10 flex items-center justify-center border-r border-white">{q.Q_No}</div>
                                                    <div className="flex-1 flex items-center px-2 border-r border-white truncate">
                                                        Topic: <span className="text-[#ffff00] ml-1">{q.Topic}</span>
                                                    </div>
                                                    <div className="flex-1 flex items-center px-2 border-r border-white truncate">
                                                        Sub: <span className="text-[#ffff00] ml-1">{q.Sub_Topic}</span>
                                                    </div>
                                                    <div className="w-20 flex items-center justify-center">Key: {q.Key_Value}</div>
                                                </div>

                                                {/* Body */}
                                                <div className="flex">
                                                    {/* Subject Strip */}
                                                    <div className="w-8 bg-[#4682b4] flex items-center justify-center border-r border-black relative">
                                                        {/* Rotated Text */}
                                                        <div style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', color: 'white', fontSize: '10px', fontWeight: 'bold' }}>
                                                            {q.Subject}
                                                        </div>
                                                    </div>

                                                    {/* Content: Q Image & S Image */}
                                                    <div className="flex flex-1">
                                                        {/* Question Cell */}
                                                        <div className="w-1/2 border-r border-black flex flex-col bg-white">
                                                            <div className="p-1 text-[10px] font-bold text-gray-400">Q.{q.Q_No}</div>
                                                            <div className="flex justify-center items-start pb-2">
                                                                {q.Q_URL ? (
                                                                    <img src={q.Q_URL} style={{ width: '321px', height: 'auto', display: 'block' }} alt="Question" />
                                                                ) : (
                                                                    <span className="text-xs text-gray-300 italic p-4">No Image</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Solution Cell */}
                                                        <div className="w-1/2 flex flex-col bg-white">
                                                            <div className="p-1 text-[10px] font-bold text-gray-400">Sol</div>
                                                            <div className="flex justify-center items-start pb-2">
                                                                {q.S_URL ? (
                                                                    <img src={q.S_URL} style={{ width: '321px', height: 'auto', display: 'block' }} alt="Solution" />
                                                                ) : (
                                                                    <span className="text-xs text-gray-300 italic p-4">No Solution</span>
                                                                )}
                                                            </div>
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
    );
};

export default ErrorReport;
