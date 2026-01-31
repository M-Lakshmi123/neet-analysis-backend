import React, { useState, useEffect, useRef } from 'react';
import FilterBar from './FilterBar';
import { API_URL, buildQueryParams, formatDate } from '../utils/apiHelper';
import { useAuth } from './auth/AuthProvider';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';

// Subject Sorting Order
const SUBJECT_ORDER = {
    "PHYSICS": 1,
    "CHEMISTRY": 2,
    "BOTANY": 3,
    "ZOOLOGY": 4
};

const getSubjectOrder = (subject) => {
    const s = String(subject).toUpperCase();
    return SUBJECT_ORDER[s] || 99;
};

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

                // Sort Questions by Subject
                const processed = Object.values(grouped).map(student => {
                    // Convert tests object to array
                    const testsArr = Object.values(student.tests).map(t => {
                        t.questions.sort((a, b) => getSubjectOrder(a.Subject) - getSubjectOrder(b.Subject));
                        return t;
                    });
                    return { ...student, tests: testsArr };
                });

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

            // Function to draw the "Sri Chaitanya" Header
            const drawMainHeader = (doc) => {
                let y = 15;

                // 1. Title
                const part1 = "Sri Chaitanya";
                const part2 = " Educational Institutions";

                doc.setFontSize(26);
                if (impactFont) doc.setFont("Impact", "normal");
                else doc.setFont("helvetica", "bold");
                const w1 = doc.getTextWidth(part1);

                if (bookmanFont) doc.setFont("Bookman", "normal");
                else doc.setFont("helvetica", "normal");
                const w2 = doc.getTextWidth(part2);

                const startX = (pageWidth - (w1 + w2)) / 2;

                if (impactFont) doc.setFont("Impact", "normal");
                else doc.setFont("helvetica", "bold");
                doc.setTextColor(0, 112, 192);
                doc.text(part1, startX, y);

                if (bookmanFont) doc.setFont("Bookman", "normal");
                else doc.setFont("helvetica", "normal");
                doc.setTextColor(0, 112, 192);
                doc.text(part2, startX + w1, y);

                y += 6;

                // 2. Subtitles
                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(0, 0, 0);
                doc.text("A.P, Telangana, Karnataka, Tamilnadu, Maharashtra, Delhi, Ranchi", pageWidth / 2, y, { align: 'center' });
                y += 5;

                doc.setFont("times", "italic");
                doc.setFontSize(14);
                doc.text("A Right Choice for the Real Aspirant", pageWidth / 2, y, { align: 'center' });
                y += 5;

                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.text("CENTRAL OFFICE, BANGALORE", pageWidth / 2, y, { align: 'center' });

                return y + 2;
            };

            // Iterate Students
            for (let sIdx = 0; sIdx < reportData.length; sIdx++) {
                const student = reportData[sIdx];
                if (sIdx > 0) doc.addPage(); // Start new student on new page

                const startPageNum = doc.internal.getNumberOfPages();

                // Draw Header ONLY on first page of student
                let headerBottom = drawMainHeader(doc);
                let yPos = headerBottom + 1;

                // Student Info Table (Only on First Page)
                doc.setLineWidth(0.3);
                doc.setDrawColor(0);
                doc.setFillColor(255, 248, 220); // Cornsilk
                doc.rect(margin, yPos, contentWidth, 8, 'FD');

                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.setTextColor(0);

                const leftCenter = margin + (contentWidth / 4);
                doc.text(student.info.name || '', leftCenter, yPos + 5.5, { align: 'center' });

                const rightCenter = margin + (contentWidth * 0.75);
                doc.text(student.info.branch || '', rightCenter, yPos + 5.5, { align: 'center' });

                doc.line(pageWidth / 2, yPos, pageWidth / 2, yPos + 8);
                yPos += 8;

                // Iterate Tests
                for (const test of student.tests) {
                    // Score Table (Only on First Page of Student/Test combination? 
                    // Usually Score table is Summary, so keep it at start).

                    // Col Definitions
                    const colDefs = [
                        { name: "Test", w: 25, bg: [255, 255, 255] },
                        { name: "Date", w: 25, bg: [255, 255, 255] },
                        { name: "TOT", w: 14, bg: [255, 255, 204] },
                        { name: "AIR", w: 14, bg: [255, 255, 255] },
                        { name: "BOT", w: 14, bg: [253, 233, 217] },
                        { name: "Rank", w: 14, bg: [253, 233, 217] },
                        { name: "ZOO", w: 14, bg: [218, 238, 243] },
                        { name: "Rank", w: 14, bg: [218, 238, 243] },
                        { name: "PHY", w: 14, bg: [235, 241, 222] },
                        { name: "Rank", w: 14, bg: [235, 241, 222] },
                        { name: "CHEM", w: 14, bg: [242, 220, 219] },
                        { name: "Rank", w: 14, bg: [242, 220, 219] }
                    ];

                    const values = [
                        test.meta.testName, test.meta.date,
                        test.meta.tot, test.meta.air,
                        test.meta.bot, test.meta.b_rank,
                        test.meta.zoo, test.meta.z_rank,
                        test.meta.phy, test.meta.p_rank,
                        test.meta.chem, test.meta.c_rank
                    ];

                    // Draw Headers
                    let currentX = margin;
                    doc.setFontSize(9);
                    doc.setTextColor(0, 0, 0);

                    colDefs.forEach((col) => {
                        doc.setFillColor(...col.bg);
                        doc.rect(currentX, yPos, col.w, 6, 'FD');
                        doc.text(col.name, currentX + (col.w / 2), yPos + 4, { align: 'center' });
                        currentX += col.w;
                    });

                    yPos += 6;

                    // Draw Values
                    currentX = margin;
                    doc.setFontSize(10);
                    doc.setTextColor(128, 0, 0);

                    colDefs.forEach((col, i) => {
                        doc.setFillColor(...col.bg);
                        doc.rect(currentX, yPos, col.w, 6, 'FD');
                        doc.text(String(values[i] || '-'), currentX + (col.w / 2), yPos + 4, { align: 'center' });
                        currentX += col.w;
                    });

                    yPos += 8;

                    // QUESTIONS Loop
                    setPdfProgress(`Processing ${student.info.name}...`);

                    for (let i = 0; i < test.questions.length; i++) {
                        const q = test.questions[i];

                        const qImg = await loadImage(q.Q_URL);
                        const sImg = await loadImage(q.S_URL);

                        // Layout
                        const wStat = 18;
                        const wQ = 12;
                        const wKey = 18;
                        const imgAreaW = contentWidth - wStat;
                        const halfImgW = imgAreaW / 2;

                        // Strict Alignment
                        const wTopic = halfImgW - wQ;
                        const wSub = halfImgW - 18; // (Key W is 18)

                        // Font Setup
                        if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                        else doc.setFont("helvetica", "bold");
                        doc.setFontSize(9);

                        // Text Wrap
                        const topicLabel = "Topic: ";
                        const topicVal = q.Topic || '';
                        // Calc max width for Value: wTopic - LabelWidth - Padding
                        const topicValReqW = widthInMM(doc, topicVal);
                        const topicMaxW = wTopic - doc.getTextWidth(topicLabel) - 2;
                        const topicLines = doc.splitTextToSize(topicVal, topicMaxW);

                        const subLabel = "Sub Topic: ";
                        const subVal = q.Sub_Topic || '';
                        const subMaxW = wSub - doc.getTextWidth(subLabel) - 2;
                        const subLines = doc.splitTextToSize(subVal, subMaxW);

                        const maxHeaderLines = Math.max(1, topicLines.length, subLines.length);
                        const lineHeight = 4;
                        const headerH = Math.max(7, (maxHeaderLines * lineHeight) + 2.5);

                        // Content H
                        const imgTargetW = 85;
                        let qH = 0; if (qImg) qH = (qImg.height / qImg.width) * imgTargetW;
                        let sH = 0; if (sImg) sH = (sImg.height / sImg.width) * imgTargetW;
                        const maxContentH = Math.max(qH, sH, 20);
                        const blockH = headerH + maxContentH + 2;

                        // Page Break Check
                        if (yPos + blockH > pageHeight - margin) {
                            doc.addPage();
                            // Do NOT add Main Header or Student Info on subsequent pages
                            // Just reset padding
                            yPos = 15;
                        } else if (i > 0) {
                            yPos += 2;
                        }

                        // Draw Question Block
                        // 1. Header Bar
                        doc.setFillColor(128, 0, 0);
                        doc.rect(margin, yPos, contentWidth, headerH, 'F');
                        doc.setTextColor(255);

                        let currentX = margin;
                        const baseTextY = yPos + 4.5;

                        // W/U
                        doc.text(String(q.W_U || ''), currentX + (wStat / 2), baseTextY, { align: 'center' });
                        doc.setDrawColor(255);
                        doc.line(currentX + wStat, yPos, currentX + wStat, yPos + headerH);
                        currentX += wStat;

                        // Q No
                        doc.text(String(q.Q_No), currentX + (wQ / 2), baseTextY, { align: 'center' });
                        doc.line(currentX + wQ, yPos, currentX + wQ, yPos + headerH);
                        currentX += wQ;

                        // Topic
                        doc.setTextColor(255, 255, 255);
                        doc.text(topicLabel, currentX + 1, baseTextY);

                        doc.setTextColor(240, 230, 140); // Khaki
                        doc.text(topicLines, currentX + doc.getTextWidth(topicLabel) + 1, baseTextY);

                        doc.setDrawColor(255);
                        doc.line(currentX + wTopic, yPos, currentX + wTopic, yPos + headerH);
                        currentX += wTopic;

                        // Sub Topic
                        doc.setTextColor(255, 255, 255);
                        doc.text(subLabel, currentX + 1, baseTextY);

                        doc.setTextColor(240, 230, 140);
                        doc.text(subLines, currentX + doc.getTextWidth(subLabel) + 1, baseTextY);

                        doc.setDrawColor(255);
                        doc.line(currentX + wSub, yPos, currentX + wSub, yPos + headerH);
                        currentX += wSub;

                        // Key
                        const keyLabel = "Key: ";
                        const keyVal = q.Key_Value || '';
                        const kTotalW = doc.getTextWidth(keyLabel + keyVal);
                        const kStart = (currentX + (wKey / 2)) - (kTotalW / 2);

                        doc.setTextColor(255, 255, 255);
                        doc.text(keyLabel, kStart, baseTextY);
                        doc.setTextColor(240, 230, 140);
                        doc.text(keyVal, kStart + doc.getTextWidth(keyLabel), baseTextY);
                        // Reset Align/Color etc implicit

                        // 2. Content Border
                        doc.setDrawColor(0);
                        doc.rect(margin, yPos, contentWidth, blockH);

                        // 3. Subject Strip (Auto-fit Font)
                        doc.setFillColor(79, 129, 189);
                        doc.rect(margin, yPos + headerH, wStat, blockH - headerH, 'F');

                        doc.setTextColor(255);
                        const subjectText = String(q.Subject || '');
                        let subjFontSize = 9;
                        doc.setFontSize(subjFontSize);
                        const maxSubjW = wStat - 2;
                        while (doc.getTextWidth(subjectText) > maxSubjW && subjFontSize > 4) {
                            subjFontSize -= 0.5;
                            doc.setFontSize(subjFontSize);
                        }
                        const stripCenterY = yPos + headerH + ((blockH - headerH) / 2);
                        const stripCenterX = margin + (wStat / 2);
                        doc.text(subjectText, stripCenterX, stripCenterY + (subjFontSize / 3), { align: 'center' });

                        // 4. Images
                        const imgBaseX = margin + wStat;
                        const imgContentY = yPos + headerH;

                        doc.setDrawColor(0);
                        doc.line(imgBaseX + halfImgW, imgContentY, imgBaseX + halfImgW, yPos + blockH);

                        const drawImage = (img, x, y, drawnH) => {
                            if (!img) return;
                            const aspect = img.width / img.height;
                            let w = drawnH * aspect;
                            const colWidth = halfImgW;
                            const offX = (colWidth - w) / 2;
                            try { doc.addImage(img, 'PNG', x + offX, y + 1, w, drawnH); } catch (e) { }
                        };

                        if (qImg) drawImage(qImg, imgBaseX, imgContentY, qH);
                        else {
                            doc.setTextColor(150); doc.setFontSize(8);
                            doc.text("No Q Image", imgBaseX + 5, imgContentY + 5);
                        }

                        if (sImg) drawImage(sImg, imgBaseX + halfImgW, imgContentY, sH);

                        yPos += blockH;
                    } // End Questions Match
                } // End Tests

                // Add Page Numbers for this student
                const endPageNum = doc.internal.getNumberOfPages();
                doc.setFontSize(9);
                doc.setTextColor(0);
                if (bookmanFont) doc.setFont("Bookman", "normal");

                for (let p = startPageNum; p <= endPageNum; p++) {
                    doc.setPage(p);
                    const pageText = `Page ${p - startPageNum + 1} of ${endPageNum - startPageNum + 1}`;
                    doc.text(pageText, pageWidth / 2, pageHeight - 5, { align: 'center' });
                }

            } // End Students

            doc.save(`Error_Report_${reportData[0].info.name}.pdf`);

        } catch (err) {
            console.error("PDF Fail", err);
            alert("PDF Error: " + err.message);
        } finally {
            setGeneratingPdf(false);
            setPdfProgress('');
        }
    };

    // Helper to calc MM width roughly if needed, but jspdf handles it
    const widthInMM = (doc, text) => {
        return doc.getTextWidth(text);
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#808080', fontFamily: '"Bookman Old Style", "Times New Roman", serif', minHeight: '100vh', boxSizing: 'border-box', overflow: 'auto' }}>
            <div className="no-print" style={{ maxWidth: '210mm', margin: '0 auto 20px auto', backgroundColor: 'white', padding: '15px', borderRadius: '5px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)', fontFamily: 'Arial, sans-serif' }}>
                <FilterBar
                    filters={filters}
                    setFilters={setFilters}
                    restrictedCampus={!isAdmin ? userData?.campus : null}
                    apiEndpoints={{ filters: '/api/erp/filters', students: '/api/erp/students' }}
                />
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: '#333' }}>{reportData.length} Student(s) Loaded</span>
                    <button
                        onClick={generatePDF}
                        disabled={reportData.length === 0 || generatingPdf}
                        style={{ backgroundColor: '#0070c0', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        {generatingPdf ? 'Generating PDF...' : '⬇ Download PDF File'}
                    </button>
                </div>
            </div>

            {loading && <div style={{ textAlign: 'center', fontSize: '20px', marginTop: '50px', color: 'white', fontFamily: 'Arial' }}>Loading Data...</div>}

            {!loading && reportData.map((student, sIdx) => (
                <div key={sIdx} style={{ width: '210mm', minHeight: '297mm', margin: '0 auto 40px auto', backgroundColor: 'white', padding: '10mm', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', boxSizing: 'border-box' }}>

                    {/* Header - Always Show on Page 1 of View */}
                    <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                        <div style={{ color: '#0070c0', marginBottom: '5px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                            <span style={{ fontFamily: 'Impact, sans-serif', fontSize: '26px' }}>Sri Chaitanya</span>
                            <span style={{ fontFamily: '"Bookman Old Style", serif', fontSize: '26px', marginLeft: '5px' }}> Educational Institutions</span>
                        </div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '4px', fontFamily: '"Bookman Old Style", serif' }}>
                            A.P, Telangana, Karnataka, Tamilnadu, Maharashtra, Delhi, Ranchi
                        </div>
                        <div style={{ fontFamily: '"Bookman Old Style", serif', fontStyle: 'italic', fontSize: '18px', margin: '2px 0' }}>
                            A Right Choice for the Real Aspirant
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '2px', fontFamily: '"Bookman Old Style", serif' }}>
                            CENTRAL OFFICE, BANGALORE
                        </div>
                    </div>

                    <div style={{ width: '100%', border: '1px solid black', display: 'flex', backgroundColor: '#fff8dc', marginBottom: '20px', fontSize: '12px', fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                        <div style={{ flex: 1, padding: '8px', textAlign: 'center', textTransform: 'uppercase', borderRight: '1px solid black' }}>
                            {student.info.name}
                        </div>
                        <div style={{ flex: 1, padding: '8px', textAlign: 'center', textTransform: 'uppercase' }}>
                            {student.info.branch}
                        </div>
                    </div>

                    {student.tests.map((test, tIdx) => (
                        <div key={tIdx} style={{ marginBottom: '30px' }}>
                            {/* Score Table */}
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '15px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold' }}>
                                    <colgroup>
                                        <col style={{ width: '13.15%' }} />
                                        <col style={{ width: '13.15%' }} />
                                        <col style={{ width: '7.36%' }} />
                                        <col style={{ width: '7.36%' }} />
                                        <col style={{ width: '7.36%' }} />
                                        <col style={{ width: '7.36%' }} />
                                        <col style={{ width: '7.36%' }} />
                                        <col style={{ width: '7.36%' }} />
                                        <col style={{ width: '7.36%' }} />
                                        <col style={{ width: '7.36%' }} />
                                        <col style={{ width: '7.36%' }} />
                                        <col style={{ width: '7.36%' }} />
                                    </colgroup>
                                    <thead>
                                        <tr style={{ height: '24px' }}>
                                            <td style={{ border: '1px solid black', backgroundColor: 'white' }}>Test</td>
                                            <td style={{ border: '1px solid black', backgroundColor: 'white' }}>Date</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#ffffcc' }}>TOT</td>
                                            <td style={{ border: '1px solid black', backgroundColor: 'white' }}>AIR</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#fde9d9' }}>BOT</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#fde9d9' }}>Rank</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#daeef3' }}>ZOO</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#daeef3' }}>Rank</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#ebf1de' }}>PHY</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#ebf1de' }}>Rank</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#f2dcdb' }}>CHEM</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#f2dcdb' }}>Rank</td>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr style={{ color: '#800000', height: '24px' }}>
                                            <td style={{ border: '1px solid black', backgroundColor: 'white' }}>{test.meta.testName}</td>
                                            <td style={{ border: '1px solid black', backgroundColor: 'white' }}>{test.meta.date}</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#ffffcc' }}>{test.meta.tot}</td>
                                            <td style={{ border: '1px solid black', backgroundColor: 'white' }}>{test.meta.air}</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#fde9d9' }}>{test.meta.bot}</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#fde9d9' }}>{test.meta.b_rank}</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#daeef3' }}>{test.meta.zoo}</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#daeef3' }}>{test.meta.z_rank}</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#ebf1de' }}>{test.meta.phy}</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#ebf1de' }}>{test.meta.p_rank}</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#f2dcdb' }}>{test.meta.chem}</td>
                                            <td style={{ border: '1px solid black', backgroundColor: '#f2dcdb' }}>{test.meta.c_rank}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Sorted Questions Render */}
                            {test.questions.map((q, qIdx) => (
                                <table key={qIdx} style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '10px', backgroundColor: 'white' }}>
                                    <colgroup>
                                        <col style={{ width: '18mm' }} />
                                        <col style={{ width: '12mm' }} />
                                        <col style={{ width: '74mm' }} />
                                        <col style={{ width: '68mm' }} />
                                        <col style={{ width: '18mm' }} />
                                    </colgroup>
                                    <thead>
                                        <tr style={{ backgroundColor: '#800000', color: 'white', fontSize: '11px', fontWeight: 'bold' }}>
                                            <td style={{ border: '1px solid black', borderRight: '1px solid white', textAlign: 'center', height: '28px' }}>{q.W_U}</td>
                                            <td style={{ border: '1px solid black', borderRight: '1px solid white', textAlign: 'center' }}>{q.Q_No}</td>

                                            <td style={{ border: '1px solid black', borderRight: '1px solid white', padding: '4px', verticalAlign: 'top', wordWrap: 'break-word' }}>
                                                <span>Topic: </span>
                                                <span style={{ color: '#F0E68C', marginLeft: '5px' }}>{q.Topic}</span>
                                            </td>
                                            <td style={{ border: '1px solid black', borderRight: '1px solid white', padding: '4px', verticalAlign: 'top', wordWrap: 'break-word' }}>
                                                <span>Sub Topic: </span>
                                                <span style={{ color: '#F0E68C', marginLeft: '5px' }}>{q.Sub_Topic}</span>
                                            </td>

                                            <td style={{ border: '1px solid black', textAlign: 'center' }}>
                                                <span>Key: </span>
                                                <span style={{ color: '#F0E68C', marginLeft: '5px' }}>{q.Key_Value}</span>
                                            </td>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td style={{ backgroundColor: '#4F81BD', border: '1px solid black', verticalAlign: 'middle', textAlign: 'center', padding: '0 5px', color: 'white', fontWeight: 'bold', fontSize: '12px' }}>
                                                {q.Subject}
                                            </td>

                                            <td colSpan="4" style={{ padding: 0, border: '1px solid black' }}>
                                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                    <tbody>
                                                        <tr>
                                                            <td style={{ width: '50%', borderRight: '1px solid black', verticalAlign: 'top', padding: 0 }}>
                                                                <div style={{ padding: '4px', fontSize: '10px', fontWeight: 'bold', color: '#666' }}>Q.{q.Q_No}</div>
                                                                <div style={{ textAlign: 'center', paddingBottom: '10px' }}>
                                                                    {q.Q_URL ? (
                                                                        <img src={q.Q_URL} style={{ width: '320px', height: 'auto', display: 'block', margin: '0 auto' }} alt="Q" />
                                                                    ) : (
                                                                        <div style={{ padding: '20px', fontStyle: 'italic', color: '#ccc', fontSize: '12px' }}>No Image</div>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            <td style={{ width: '50%', verticalAlign: 'top', padding: 0 }}>
                                                                <div style={{ padding: '4px', fontSize: '10px', fontWeight: 'bold', color: '#666' }}>Sol</div>
                                                                <div style={{ textAlign: 'center', paddingBottom: '10px' }}>
                                                                    {q.S_URL ? (
                                                                        <img src={q.S_URL} style={{ width: '320px', height: 'auto', display: 'block', margin: '0 auto' }} alt="S" />
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
