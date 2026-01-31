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

                        // Load Images First to calculate height
                        const qImg = await loadImage(q.Q_URL);
                        const sImg = await loadImage(q.S_URL);

                        // Calculate Dynamic Height based on Width
                        const headerH = 7;
                        const colW = (contentWidth - 8) / 2; // ~91mm
                        const imgTargetW = 85;

                        let qH = 0;
                        if (qImg) {
                            qH = (qImg.height / qImg.width) * imgTargetW;
                        }

                        let sH = 0;
                        if (sImg) {
                            sH = (sImg.height / sImg.width) * imgTargetW;
                        }

                        // Min content height or max of images
                        const maxContentH = Math.max(qH, sH, 20); // Min 20mm for content
                        const blockH = headerH + maxContentH + 2; // +2mm padding

                        // Check Page Break
                        if (yPos + blockH > pageHeight - margin) {
                            doc.addPage();
                            addHeader(doc);
                            yPos = 35;
                        } else if (i > 0) {
                            yPos += 2;
                        }

                        // 1. Header Bar (Red)
                        doc.setFillColor(128, 0, 0); // Maroon
                        doc.rect(margin, yPos, contentWidth, headerH, 'F');

                        doc.setTextColor(255);
                        if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                        else doc.setFont("helvetica", "bold");
                        doc.setFontSize(9);

                        // Header Content
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
                        // Subtopic
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

                        // Vertical Text
                        const stripCenterY = yPos + headerH + ((blockH - headerH) / 2);
                        doc.text(String(q.Subject || ''), margin + 5, stripCenterY + 5, { angle: 90, align: 'center' });

                        // 4. Images Area
                        const imgAreaX = margin + 8;
                        const imgAreaW = contentWidth - 8;
                        const imgAreaY = yPos + headerH;

                        // Split Q and Sol line
                        doc.setDrawColor(0);
                        doc.line(imgAreaX + (imgAreaW / 2), imgAreaY, imgAreaX + (imgAreaW / 2), yPos + blockH);

                        const drawImage = (img, x, y, drawnH) => {
                            if (!img) return;
                            const aspect = img.width / img.height;
                            let w = drawnH * aspect;
                            // Center in column
                            const colWidth = imgAreaW / 2;
                            const offX = (colWidth - w) / 2;
                            try {
                                doc.addImage(img, 'PNG', x + offX, y + 1, w, drawnH);
                            } catch (e) { console.warn("Image add error", e); }
                        };

                        if (qImg) {
                            drawImage(qImg, imgAreaX, imgAreaY, qH);
                        } else {
                            doc.setTextColor(150);
                            doc.text("No Q Image", imgAreaX + 10, imgAreaY + 10);
                        }

                        if (sImg) {
                            drawImage(sImg, imgAreaX + (imgAreaW / 2), imgAreaY, sH);
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
        <div style={{ padding: '20px', backgroundColor: '#808080', fontFamily: 'Arial, sans-serif', minHeight: '100vh', boxSizing: 'border-box', overflow: 'auto' }}>
            {/* Control Bar */}
            <div className="no-print" style={{ maxWidth: '210mm', margin: '0 auto 20px auto', backgroundColor: 'white', padding: '15px', borderRadius: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
                <FilterBar
                    filters={filters}
                    setFilters={setFilters}
                    restrictedCampus={!isAdmin ? userData?.campus : null}
                    apiEndpoints={{
                        filters: '/api/erp/filters',
                        students: '/api/erp/students'
                    }}
                />
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>{reportData.length} Student(s) Loaded</span>
                    <button
                        onClick={generatePDF}
                        disabled={reportData.length === 0 || generatingPdf}
                        style={{
                            backgroundColor: '#0070c0',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            opacity: generatingPdf || reportData.length === 0 ? 0.6 : 1,
                            fontSize: '14px',
                            fontWeight: 'bold'
                        }}
                    >
                        {generatingPdf ? 'Generating PDF...' : '⬇ Download PDF File'}
                    </button>
                </div>
            </div>

            {loading && <div style={{ textAlign: 'center', fontSize: '20px', marginTop: '50px', color: 'white' }}>Loading Data...</div>}

            {/* Main Report Area */}
            {!loading && reportData.map((student, sIdx) => (
                <div key={sIdx} style={{ width: '210mm', minHeight: '297mm', margin: '0 auto 40px auto', backgroundColor: 'white', padding: '10mm', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', boxSizing: 'border-box' }}>

                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                        <div style={{ color: '#0070c0', marginBottom: '5px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                            <span style={{ fontFamily: 'Impact, sans-serif', fontSize: '26px' }}>Sri Chaitanya</span>
                            <span style={{ fontFamily: 'Bookman, serif', fontSize: '26px', marginLeft: '5px' }}> Educational Institutions</span>
                        </div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '4px' }}>
                            A.P, Telangana, Karnataka, Tamilnadu, Maharashtra, Delhi, Ranchi
                        </div>
                        <div style={{ fontFamily: 'serif', fontStyle: 'italic', fontSize: '18px', margin: '2px 0' }}>
                            A Right Choice for the Real Aspirant
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '2px' }}>
                            CENTRAL OFFICE, BANGALORE
                        </div>
                    </div>

                    {/* Student Info Table */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '20px', fontSize: '12px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                        <tbody>
                            <tr style={{ backgroundColor: '#fff8dc' }}>
                                <td style={{ border: '1px solid black', padding: '8px', width: '50%', textAlign: 'center', textTransform: 'uppercase' }}>{student.info.name}</td>
                                <td style={{ border: '1px solid black', padding: '8px', width: '50%', textAlign: 'center', textTransform: 'uppercase' }}>{student.info.branch}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Tests Loop */}
                    {student.tests.map((test, tIdx) => (
                        <div key={tIdx} style={{ marginBottom: '30px' }}>
                            {/* Score Table */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '15px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#fce4d6' }}>
                                        {["Test", "Date", "TOT", "AIR", "BOT", "Rank", "ZOO", "Rank", "PHY", "Rank", "CHEM", "Rank"].map((h, i) => (
                                            <td key={i} style={{ border: '1px solid black', padding: '4px' }}>{h}</td>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ color: '#b40000', backgroundColor: 'white' }}>
                                        <td style={{ border: '1px solid black', padding: '4px', color: 'black' }}>{test.meta.testName}</td>
                                        <td style={{ border: '1px solid black', padding: '4px', color: 'black' }}>{test.meta.date}</td>
                                        <td style={{ border: '1px solid black', padding: '4px', color: 'black' }}>{test.meta.tot}</td>
                                        <td style={{ border: '1px solid black', padding: '4px', color: 'black' }}>{test.meta.air}</td>
                                        <td style={{ border: '1px solid black', padding: '4px' }}>{test.meta.bot}</td>
                                        <td style={{ border: '1px solid black', padding: '4px' }}>{test.meta.b_rank}</td>
                                        <td style={{ border: '1px solid black', padding: '4px' }}>{test.meta.zoo}</td>
                                        <td style={{ border: '1px solid black', padding: '4px' }}>{test.meta.z_rank}</td>
                                        <td style={{ border: '1px solid black', padding: '4px' }}>{test.meta.phy}</td>
                                        <td style={{ border: '1px solid black', padding: '4px' }}>{test.meta.p_rank}</td>
                                        <td style={{ border: '1px solid black', padding: '4px' }}>{test.meta.chem}</td>
                                        <td style={{ border: '1px solid black', padding: '4px' }}>{test.meta.c_rank}</td>
                                    </tr>
                                </tbody>
                            </table>

                            {/* Questions */}
                            {test.questions.map((q, qIdx) => (
                                <table key={qIdx} style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '10px', backgroundColor: 'white' }}>
                                    {/* Header Row */}
                                    <thead>
                                        <tr style={{ backgroundColor: '#800000', color: 'white', fontSize: '12px', fontWeight: 'bold', height: '28px' }}>
                                            <td style={{ border: '1px solid black', borderRight: '1px solid white', width: '40px', textAlign: 'center' }}>{q.W_U}</td>
                                            <td style={{ border: '1px solid black', borderRight: '1px solid white', width: '40px', textAlign: 'center' }}>{q.Q_No}</td>
                                            <td style={{ border: '1px solid black', borderRight: '1px solid white', padding: '0 8px', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                                Topic: <span style={{ color: '#ffff00', marginLeft: '5px' }}>{q.Topic}</span>
                                            </td>
                                            <td style={{ border: '1px solid black', borderRight: '1px solid white', padding: '0 8px', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>
                                                Sub: <span style={{ color: '#ffff00', marginLeft: '5px' }}>{q.Sub_Topic}</span>
                                            </td>
                                            <td style={{ border: '1px solid black', width: '80px', textAlign: 'center' }}>Key: {q.Key_Value}</td>
                                        </tr>
                                    </thead>
                                    {/* Body Row */}
                                    <tbody>
                                        <tr>
                                            {/* We use a nested table in a single cell spanning 5 cols to handle strict column widths of the body independent of header */}
                                            <td colSpan="5" style={{ padding: 0, border: '1px solid black' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                    <tbody>
                                                        <tr>
                                                            {/* Vertical Strip */}
                                                            <td style={{ width: '30px', backgroundColor: '#4682b4', borderRight: '1px solid black', verticalAlign: 'middle', textAlign: 'center', padding: 0 }}>
                                                                <div style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)', color: 'white', fontWeight: 'bold', fontSize: '10px', whiteSpace: 'nowrap', margin: 'auto' }}>
                                                                    {q.Subject}
                                                                </div>
                                                            </td>

                                                            {/* Q Image */}
                                                            <td style={{ width: '50%', borderRight: '1px solid black', verticalAlign: 'top', padding: 0 }}>
                                                                <div style={{ padding: '4px', fontSize: '10px', fontWeight: 'bold', color: '#666' }}>Q.{q.Q_No}</div>
                                                                <div style={{ textAlign: 'center', paddingBottom: '10px' }}>
                                                                    {q.Q_URL ? (
                                                                        <img src={q.Q_URL} style={{ width: '321px', height: 'auto', display: 'block', margin: '0 auto' }} alt="Q" />
                                                                    ) : (
                                                                        <div style={{ padding: '20px', fontStyle: 'italic', color: '#ccc', fontSize: '12px' }}>No Image</div>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            {/* S Image */}
                                                            <td style={{ width: '50%', verticalAlign: 'top', padding: 0 }}>
                                                                <div style={{ padding: '4px', fontSize: '10px', fontWeight: 'bold', color: '#666' }}>Sol</div>
                                                                <div style={{ textAlign: 'center', paddingBottom: '10px' }}>
                                                                    {q.S_URL ? (
                                                                        <img src={q.S_URL} style={{ width: '321px', height: 'auto', display: 'block', margin: '0 auto' }} alt="S" />
                                                                    ) : (
                                                                        <div style={{ padding: '20px', fontStyle: 'italic', color: '#ccc', fontSize: '12px' }}>No Solution</div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            ))}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};

export default ErrorReport;
