import React, { useState, useEffect } from 'react';
import FilterBar from './FilterBar';
import { API_URL, buildQueryParams } from '../utils/apiHelper';
import { useAuth } from './auth/AuthProvider';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import Select from 'react-select';

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

const TOP_STUDENTS = [
    'ABHIRAM M', 'AVANEESH C CHINIWAL', 'AVANTHIKA S RAIKAR',
    'DAYANITHA P', 'HRISHIKESH V SHOLAPURKAR', 'LIKHITH P GOWDA',
    'RAGHURAM M', 'RAVIKIRAN KINI', 'SAGAN J S', 'SRAVYA SRI CHIDELLA',
    'Vaishnavi Das', 'SUCHITA MANNE', 'UNNATHI JONNALA ', 'DHRUV SINGH PHOGAT',
    'B R DHYAN', 'SURYA S'
];

const ErrorTop100 = () => {
    const { isAdmin, isCoAdmin } = useAuth();
    const [filters, setFilters] = useState({
        campus: [],
        stream: [],
        testType: [],
        test: [],
        topAll: [],
        studentSearch: []
    });
    const [subjectFilter, setSubjectFilter] = useState({ value: 'ALL', label: 'All Subjects' });
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [pdfProgress, setPdfProgress] = useState('');

    // Subject Options
    const subjectOptions = [
        { value: 'ALL', label: 'All Subjects' },
        { value: 'PHYSICS', label: 'Physics' },
        { value: 'CHEMISTRY', label: 'Chemistry' },
        { value: 'BOTANY', label: 'Botany' },
        { value: 'ZOOLOGY', label: 'Zoology' }
    ];

    // Fetch Report Data
    useEffect(() => {
        const fetchData = async () => {
            if (filters.test.length === 0) {
                setReportData([]);
                return;
            }

            setLoading(true);
            try {
                // Fetch data for TOP_STUDENTS
                const topFilters = { ...filters, studentNames: TOP_STUDENTS };
                const params = buildQueryParams(topFilters);

                // Fetch error data
                const res = await fetch(`${API_URL}/api/erp/report?${params.toString()}`);
                const errorData = await res.json();

                // Fetch total participants from the list for these tests
                const participantsRes = await fetch(`${API_URL}/api/erp/participants?${params.toString()}`);
                const participantsData = await participantsRes.json();

                // Group by Test then by Question
                const testsGrouped = {};

                errorData.forEach(row => {
                    const testKey = row.Test;
                    if (!testsGrouped[testKey]) {
                        testsGrouped[testKey] = {
                            testName: row.Test,
                            date: row.Exam_Date,
                            stream: row.Stream,
                            questions: {}
                        };
                    }

                    const qKey = `${row.Subject}_${row.Q_No}`;
                    if (!testsGrouped[testKey].questions[qKey]) {
                        testsGrouped[testKey].questions[qKey] = {
                            qNo: row.Q_No,
                            subject: row.Subject,
                            topic: row.Topic,
                            subTopic: row.Sub_Topic,
                            qUrl: row.Q_URL,
                            sUrl: row.S_URL,
                            keyValue: row.Key_Value,
                            nationalError: row.National_Wide_Error,
                            wrongStudents: []
                        };
                    }
                    testsGrouped[testKey].questions[qKey].wrongStudents.push({
                        name: row.Student_Name,
                        campus: row.Branch
                    });
                });

                // Process into array and sort
                const processed = Object.values(testsGrouped).map(test => {
                    const questionsArr = Object.values(test.questions).map(q => {
                        // Group wrong students by campus
                        const byCampus = {};
                        q.wrongStudents.forEach(s => {
                            if (!byCampus[s.campus]) byCampus[s.campus] = [];
                            byCampus[s.campus].push(s.name);
                        });

                        // Total students from list who took this test
                        const totalInList = participantsData[test.testName] || TOP_STUDENTS.length;

                        return {
                            ...q,
                            byCampus,
                            wrongCount: q.wrongStudents.length,
                            totalCount: totalInList
                        };
                    });

                    // Sort Questions
                    questionsArr.sort((a, b) => {
                        const subOrder = getSubjectOrder(a.subject) - getSubjectOrder(b.subject);
                        if (subOrder !== 0) return subOrder;
                        return (parseInt(a.qNo) || 0) - (parseInt(b.qNo) || 0);
                    });

                    return { ...test, questions: questionsArr };
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

    // Apply Subject Filter
    const getFilteredQuestions = (questions) => {
        if (subjectFilter.value === 'ALL') return questions;
        return questions.filter(q => q.subject && q.subject.toUpperCase() === subjectFilter.value);
    };

    // Helper: Load Image
    const loadImage = (src) => {
        if (!src) return Promise.resolve(null);
        return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = src;
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
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
            return null;
        }
    };

    const generatePDF = async () => {
        if (reportData.length === 0) return;
        setGeneratingPdf(true);
        setPdfProgress('Loading Resources...');

        try {
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

            if (impactFont) { doc.addFileToVFS("unicode.impact.ttf", impactFont); doc.addFont("unicode.impact.ttf", "Impact", "normal"); }
            if (bookmanFont) { doc.addFileToVFS("bookman-old-style.ttf", bookmanFont); doc.addFont("bookman-old-style.ttf", "Bookman", "normal"); }
            if (bookmanBoldFont) { doc.addFileToVFS("BOOKOSB.TTF", bookmanBoldFont); doc.addFont("BOOKOSB.TTF", "Bookman", "bold"); }

            const drawHeader = (test) => {
                let y = 15;
                doc.setFontSize(26);
                doc.setTextColor(0, 112, 192);
                const p1 = "Sri Chaitanya";
                const p2 = " Educational Institutions";
                if (impactFont) doc.setFont("Impact", "normal"); else doc.setFont("helvetica", "bold");
                const w1 = doc.getTextWidth(p1);
                if (bookmanFont) doc.setFont("Bookman", "normal"); else doc.setFont("helvetica", "normal");
                const w2 = doc.getTextWidth(p2);
                const startX = (pageWidth - (w1 + w2)) / 2;
                if (impactFont) doc.setFont("Impact", "normal"); else doc.setFont("helvetica", "bold");
                doc.text(p1, startX, y);
                if (bookmanFont) doc.setFont("Bookman", "normal"); else doc.setFont("helvetica", "normal");
                doc.text(p2, startX + w1, y);

                y += 6;
                doc.setFontSize(9);
                doc.setTextColor(0);
                if (bookmanBoldFont) doc.setFont("Bookman", "bold"); else doc.setFont("helvetica", "bold");
                doc.text("A.P, TELANGANA, KARNATAKA, TAMILNADU, MAHARASHTRA, DELHI, RANCHI", pageWidth / 2, y, { align: 'center' });
                y += 5;
                doc.setFont("times", "italic");
                doc.setFontSize(14);
                doc.text("A right Choice for the Real Aspirant", pageWidth / 2, y, { align: 'center' });
                y += 5;
                if (bookmanBoldFont) doc.setFont("Bookman", "bold"); else doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.text("Central Office, Bangalore", pageWidth / 2, y, { align: 'center' });
                y += 7;
                doc.setFontSize(14);
                const testTitle = `${test.date}_${test.stream}_${test.testName}_Error Analysis`;
                doc.text(testTitle, pageWidth / 2, y, { align: 'center' });
                return y + 5;
            };

            for (const test of reportData) {
                const filteredQs = getFilteredQuestions(test.questions);
                if (filteredQs.length === 0) continue;

                let yPos = drawHeader(test);

                // Table Header
                doc.setFillColor(255, 248, 220);
                doc.rect(margin, yPos, contentWidth, 8, 'FD');
                doc.setFontSize(10);
                doc.setTextColor(0);
                if (bookmanBoldFont) doc.setFont("Bookman", "bold");

                const cols = [
                    { name: 'Q.No', w: 12 },
                    { name: 'W', w: 12 },
                    { name: '%', w: 18 },
                    { name: 'Question', w: 98 },
                    { name: 'Subject', w: 20 },
                    { name: 'Student List', w: 30 }
                ];

                let cx = margin;
                cols.forEach(c => {
                    doc.rect(cx, yPos, c.w, 8);
                    doc.text(c.name, cx + c.w / 2, yPos + 5.5, { align: 'center' });
                    cx += c.w;
                });
                yPos += 8;

                for (const q of filteredQs) {
                    const qImg = await loadImage(q.qUrl);
                    let imgWidth = 85; // Fixed width (~321px)
                    let qH = 20;
                    if (qImg) qH = (qImg.height / qImg.width) * imgWidth;

                    let studH = 10;
                    Object.entries(q.byCampus).forEach(([campus, names]) => {
                        studH += 4 + (names.length * 3.5);
                    });

                    const rowH = Math.max(qH + 10, studH + 10, 30);
                    const maroonH = 7;

                    if (yPos + rowH + maroonH > pageHeight - 20) {
                        doc.addPage();
                        yPos = drawHeader(test);
                        // Redraw Table Header on new page
                        doc.setFillColor(255, 248, 220);
                        doc.rect(margin, yPos, contentWidth, 8, 'FD');
                        let tcx = margin;
                        cols.forEach(c => {
                            doc.rect(tcx, yPos, c.w, 8);
                            doc.text(c.name, tcx + c.w / 2, yPos + 5.5, { align: 'center' });
                            tcx += c.w;
                        });
                        yPos += 8;
                    }

                    // Maroon Topic/Key Bar
                    doc.setFillColor(128, 0, 0);
                    doc.rect(margin, yPos, contentWidth, maroonH, 'F');
                    doc.setFontSize(9);
                    doc.setFont("helvetica", "bold");

                    // Topic
                    doc.setTextColor(255, 255, 0);
                    doc.text("Topic : ", margin + 2, yPos + 5);
                    doc.setTextColor(255, 255, 255);
                    doc.text(String(q.topic), margin + 2 + doc.getTextWidth("Topic : "), yPos + 5);

                    // Key
                    const keyLabel = "Key : ";
                    const keyVal = String(q.keyValue);
                    doc.setTextColor(255, 255, 0);
                    const keyX = margin + 140; // Align to right-side sections
                    doc.text(keyLabel, keyX, yPos + 5);
                    doc.setTextColor(255, 255, 255);
                    doc.text(keyVal, keyX + doc.getTextWidth(keyLabel), yPos + 5);

                    yPos += maroonH;

                    doc.setDrawColor(0);
                    doc.rect(margin, yPos, contentWidth, rowH);

                    let currX = margin;
                    doc.setFontSize(10);
                    doc.setTextColor(0);
                    doc.text(String(q.qNo), currX + 6, yPos + rowH / 2, { align: 'center' });
                    currX += 12;
                    doc.setTextColor(255, 0, 0);
                    doc.text(`${q.wrongCount}/${q.totalCount}`, currX + 6, yPos + rowH / 2, { align: 'center' });
                    doc.setTextColor(0);
                    currX += 12;
                    doc.setFontSize(7);
                    doc.setTextColor(0, 0, 150);
                    doc.text("Top 100", currX + 9, yPos + rowH / 2 - 3, { align: 'center' });
                    doc.text("(%):", currX + 9, yPos + rowH / 2 + 1, { align: 'center' });
                    doc.setTextColor(255, 0, 0);
                    doc.setFontSize(9);
                    const perc = q.nationalError ? Math.round(parseFloat(q.nationalError) * 100) + '%' : '0%';
                    doc.text(perc, currX + 9, yPos + rowH / 2 + 6, { align: 'center' });
                    doc.setTextColor(0);
                    currX += 18;

                    if (qImg) {
                        try { doc.addImage(qImg, 'PNG', currX + (98 - imgWidth) / 2, yPos + 5, imgWidth, qH); } catch (e) { }
                    }
                    currX += 98;

                    doc.setFontSize(8);
                    doc.setFont("helvetica", "bold");
                    doc.text(String(q.subject), currX + 10, yPos + rowH / 2, { align: 'center' });
                    currX += 20;

                    let sy = yPos + 5;
                    doc.setFontSize(7);
                    doc.setTextColor(0, 0, 150);
                    doc.text("Wrong Attempts -Students", currX + 2, sy);
                    sy += 4;
                    Object.entries(q.byCampus).forEach(([campus, names]) => {
                        doc.setTextColor(150, 150, 0);
                        doc.setFont("helvetica", "bold");
                        doc.text(campus, currX + 2, sy);
                        sy += 3;
                        doc.setTextColor(100);
                        doc.setFont("helvetica", "normal");
                        names.forEach(name => {
                            doc.text(name, currX + 2, sy);
                            sy += 3;
                        });
                        sy += 1;
                    });

                    yPos += rowH;
                }

                if (test !== reportData[reportData.length - 1]) doc.addPage();
            }

            doc.save(`Top_100_Error_Report.pdf`);

        } catch (err) {
            console.error(err);
            alert("Error generating PDF");
        } finally {
            setGeneratingPdf(false);
        }
    };

    if (!isAdmin && !isCoAdmin) return <div style={{ padding: '50px', textAlign: 'center', color: 'white' }}>Access Denied. Admins Only.</div>;

    return (
        <div style={{ padding: '20px', backgroundColor: '#808080', minHeight: '100vh', boxSizing: 'border-box' }}>
            <div className="no-print" style={{ maxWidth: '1200px', margin: '0 auto 20px auto', backgroundColor: 'white', padding: '15px', borderRadius: '5px' }}>
                <FilterBar
                    filters={filters}
                    setFilters={setFilters}
                    apiEndpoints={{ filters: '/api/erp/filters', students: '/api/erp/students' }}
                />

                <div style={{ marginTop: '15px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ marginRight: '10px', fontWeight: 'bold' }}>Subject:</span>
                        <div style={{ width: '200px' }}>
                            <Select options={subjectOptions} value={subjectFilter} onChange={setSubjectFilter} />
                        </div>
                    </div>

                    <div style={{ flex: 1, textAlign: 'right' }}>
                        <button
                            onClick={generatePDF}
                            disabled={reportData.length === 0 || generatingPdf}
                            style={{ backgroundColor: '#0070c0', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            {generatingPdf ? 'Generating...' : `⬇ Download PDF Report`}
                        </button>
                    </div>
                </div>
            </div>

            {loading && <div style={{ textAlign: 'center', color: 'white', fontSize: '20px' }}>Loading Top 100% Error Data...</div>}

            {!loading && reportData.map((test, tIdx) => {
                const renderQs = getFilteredQuestions(test.questions);
                if (renderQs.length === 0) return null;

                return (
                    <div key={tIdx} style={{ maxWidth: '1200px', margin: '0 auto 40px auto', backgroundColor: 'white', padding: '20px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
                        <h2 style={{ textAlign: 'center', color: '#000', fontSize: '24px', fontWeight: 'bold' }}>
                            {test.date}_{test.stream}_{test.testName}_Error Analysis
                        </h2>

                        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginTop: '20px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#fff8dc', fontSize: '14px', fontWeight: 'bold' }}>
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', width: '60px' }}>Q.No</td>
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', width: '60px' }}>W</td>
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', width: '100px' }}>%</td>
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>Question</td>
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', width: '120px' }}>Subject</td>
                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', width: '250px' }}>Student List</td>
                                </tr>
                            </thead>
                            <tbody>
                                {renderQs.map((q, qIdx) => (
                                    <React.Fragment key={qIdx}>
                                        {/* Maroon Header Row for each question */}
                                        <tr style={{ backgroundColor: '#800000', color: 'white', fontWeight: 'bold', fontSize: '13px' }}>
                                            <td colSpan="4" style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>
                                                <span style={{ color: '#FFFF00' }}>Topic : </span>
                                                <span style={{ color: 'white' }}>{q.topic}</span>
                                            </td>
                                            <td colSpan="2" style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>
                                                <span style={{ color: '#FFFF00' }}>Key : </span>
                                                <span style={{ color: 'white' }}>{q.keyValue}</span>
                                            </td>
                                        </tr>
                                        {/* Main Data Row */}
                                        <tr>
                                            <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{q.qNo}</td>
                                            <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold', color: 'red' }}>{q.wrongCount}/{q.totalCount}</td>
                                            <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>
                                                <div style={{ color: 'blue', fontSize: '11px', fontWeight: 'bold' }}>Top 100(%):</div>
                                                <div style={{ color: 'red', fontSize: '14px', fontWeight: 'bold' }}>
                                                    {q.nationalError ? Math.round(parseFloat(q.nationalError) * 100) + '%' : '0%'}
                                                </div>
                                            </td>
                                            <td style={{ border: '1px solid black', padding: '10px', textAlign: 'center' }}>
                                                {q.qUrl && <img src={q.qUrl} alt="Question" style={{ width: '321px', height: 'auto', display: 'block', margin: '0 auto' }} />}
                                            </td>
                                            <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center', fontWeight: 'bold' }}>{q.subject}</td>
                                            <td style={{ border: '1px solid black', padding: '8px', verticalAlign: 'top', backgroundColor: '#4F81BD', color: 'white' }}>
                                                <div style={{ fontSize: '12px', color: 'white', textDecoration: 'underline', marginBottom: '8px', fontWeight: 'bold', textAlign: 'center' }}>Wrong Attempts -Students</div>
                                                {Object.entries(q.byCampus).map(([campus, names]) => (
                                                    <div key={campus} style={{ marginBottom: '12px' }}>
                                                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#FFFF00', textTransform: 'uppercase', textDecoration: 'underline', marginBottom: '2px' }}>{campus}</div>
                                                        {names.map(name => (
                                                            <div key={name} style={{ fontSize: '11px', color: 'white', marginLeft: '2px', lineHeight: '1.2' }}>{name}</div>
                                                        ))}
                                                    </div>
                                                ))}
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
};

export default ErrorTop100;
