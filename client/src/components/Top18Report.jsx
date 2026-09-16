import React, { useState, useEffect, useMemo, useRef } from 'react';
import LoadingTimer from './LoadingTimer';
import { API_URL, buildQueryParams } from '../utils/apiHelper';
import { useAuth } from './auth/AuthProvider';
import jsPDF from 'jspdf';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import Select from 'react-select';
import { logActivity } from '../utils/activityLogger';
import { Award, Users, FileText, CheckCircle2, ChevronDown, Download, ZoomIn, ZoomOut, RefreshCw, BarChart2 } from 'lucide-react';

// Subject Sorting Order
const SUBJECT_ORDER = {
    "BOTANY": 1,
    "ZOOLOGY": 2,
    "PHYSICS": 3,
    "CHEMISTRY": 4
};

const getSubjectOrder = (subject) => {
    const s = String(subject).toUpperCase();
    return SUBJECT_ORDER[s] || 99;
};

const Top18Report = ({ academicYear = '2026' }) => {
    const { userData } = useAuth();

    const [top18Students, setTop18Students] = useState([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    const [availableTests, setAvailableTests] = useState([]);
    const [selectedTests, setSelectedTests] = useState([]);
    const [subjectFilter, setSubjectFilter] = useState({ value: 'ALL', label: 'All Subjects' });
    const [viewMode, setViewMode] = useState('errors'); // 'errors' or 'performance'
    const [reportData, setReportData] = useState([]);
    const [performanceData, setPerformanceData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingInit, setLoadingInit] = useState(true);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    const [pdfProgress, setPdfProgress] = useState('');
    const [generatingExcel, setGeneratingExcel] = useState(false);
    const [excelProgress, setExcelProgress] = useState('');
    const [zoom, setZoom] = useState(1);

    const subjectOptions = [
        { value: 'ALL', label: 'All Subjects' },
        { value: 'PHYSICS', label: 'Physics' },
        { value: 'CHEMISTRY', label: 'Chemistry' },
        { value: 'BOTANY', label: 'Botany' },
        { value: 'ZOOLOGY', label: 'Zoology' }
    ];

    // 1. Fetch TOP 18 Students list on mount
    useEffect(() => {
        const fetchTop18 = async () => {
            setLoadingInit(true);
            try {
                const res = await fetch(`${API_URL}/api/config/top-18?academicYear=${academicYear}`);
                const data = await res.json();
                if (data && data.students) {
                    setTop18Students(data.students);
                    // By default, select all 18 students
                    const allIds = data.students.map(s => String(s.id));
                    setSelectedStudentIds(allIds);

                    // Also fetch available tests for these 18 students
                    const erpParams = new URLSearchParams();
                    allIds.forEach(id => erpParams.append('studentSearch', id));
                    erpParams.append('academicYear', academicYear);
                    const testsRes = await fetch(`${API_URL}/api/erp/filters?${erpParams.toString()}`);
                    const testsData = await testsRes.json();
                    if (testsData && testsData.tests) {
                        setAvailableTests(testsData.tests);
                    }
                }
            } catch (err) {
                console.error("Failed to load Top 18 students:", err);
            } finally {
                setLoadingInit(false);
            }
        };

        fetchTop18();
    }, [academicYear]);

    // 2. Fetch Report Data for selected students and tests
    const fetchReport = async () => {
        if (selectedStudentIds.length === 0) {
            alert("Please select at least one Top 18 student.");
            return;
        }

        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('academicYear', academicYear);
            selectedStudentIds.forEach(id => params.append('studentSearch', id));
            selectedTests.forEach(t => params.append('test', t));

            const res = await fetch(`${API_URL}/api/erp/report?${params.toString()}`);
            const data = await res.json();

            // Group by Student
            const grouped = {};
            const perfMap = {};

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

                if (!perfMap[studKey]) {
                    perfMap[studKey] = {
                        id: row.STUD_ID,
                        name: row.Student_Name,
                        branch: row.Branch,
                        stream: row.Stream,
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
                            c_rank: row.C_Rank,
                            customHeading: row.Custom_Heading
                        },
                        questions: []
                    };

                    perfMap[studKey].tests[testKey] = {
                        testName: row.Test,
                        date: row.Exam_Date,
                        tot: parseFloat(row.Tot_720) || 0,
                        air: parseFloat(row.AIR) || 999999,
                        bot: parseFloat(row.Botany) || 0,
                        zoo: parseFloat(row.Zoology) || 0,
                        phy: parseFloat(row.Physics) || 0,
                        chem: parseFloat(row.Chemistry) || 0
                    };
                }
                grouped[studKey].tests[testKey].questions.push(row);
            });

            // Process & Sort
            const processed = Object.values(grouped).map(student => {
                let testsArr = Object.values(student.tests);

                const parseDate = (d) => {
                    if (!d || typeof d !== 'string') return 0;
                    const clean = d.replace(/\//g, '-');
                    const parts = clean.split('-');
                    if (parts.length !== 3) return 0;
                    const [day, month, year] = parts.map(Number);
                    const fullYear = year < 100 ? 2000 + year : year;
                    return new Date(fullYear, month - 1, day).getTime();
                };

                testsArr.sort((a, b) => parseDate(a.meta.date) - parseDate(b.meta.date));

                testsArr = testsArr.map(t => {
                    t.questions.sort((a, b) => {
                        const subA = getSubjectOrder(a.Subject);
                        const subB = getSubjectOrder(b.Subject);
                        if (subA !== subB) return subA - subB;

                        const topicA = String(a.Topic || '').trim().toUpperCase();
                        const topicB = String(b.Topic || '').trim().toUpperCase();
                        const topicComp = topicA.localeCompare(topicB);
                        if (topicComp !== 0) return topicComp;

                        const qNoA = parseInt(a.Q_No) || 0;
                        const qNoB = parseInt(b.Q_No) || 0;
                        return qNoA - qNoB;
                    });
                    return t;
                });

                let sumTot = 0;
                let bestAir = 999999;
                testsArr.forEach(t => {
                    const tot = parseFloat(t.meta?.tot) || 0;
                    const air = parseFloat(t.meta?.air) || 999999;
                    sumTot += tot;
                    if (air > 0 && air < bestAir) bestAir = air;
                });
                const avgTot = testsArr.length > 0 ? (sumTot / testsArr.length) : 0;

                return {
                    ...student,
                    tests: testsArr,
                    avgTot,
                    bestAir
                };
            });

            // Sort by average marks descending
            processed.sort((a, b) => {
                if (Math.abs(b.avgTot - a.avgTot) > 0.001) return b.avgTot - a.avgTot;
                if (a.bestAir !== b.bestAir) return a.bestAir - b.bestAir;
                return (a.info.name || '').localeCompare(b.info.name || '');
            });

            // Calculate Performance Overview rows
            const perfRows = Object.values(perfMap).map(s => {
                const testValues = Object.values(s.tests);
                const count = testValues.length;
                const avgTot = count > 0 ? (testValues.reduce((sum, t) => sum + t.tot, 0) / count) : 0;
                const bestAir = count > 0 ? Math.min(...testValues.map(t => t.air)) : 999999;
                const avgBot = count > 0 ? (testValues.reduce((sum, t) => sum + t.bot, 0) / count) : 0;
                const avgZoo = count > 0 ? (testValues.reduce((sum, t) => sum + t.zoo, 0) / count) : 0;
                const avgPhy = count > 0 ? (testValues.reduce((sum, t) => sum + t.phy, 0) / count) : 0;
                const avgChem = count > 0 ? (testValues.reduce((sum, t) => sum + t.chem, 0) / count) : 0;

                return {
                    ...s,
                    testCount: count,
                    avgTot: Math.round(avgTot * 10) / 10,
                    bestAir: bestAir === 999999 ? '-' : bestAir,
                    avgBot: Math.round(avgBot * 10) / 10,
                    avgZoo: Math.round(avgZoo * 10) / 10,
                    avgPhy: Math.round(avgPhy * 10) / 10,
                    avgChem: Math.round(avgChem * 10) / 10
                };
            });

            perfRows.sort((a, b) => b.avgTot - a.avgTot);

            setReportData(processed);
            setPerformanceData(perfRows);

            logActivity(userData, 'Generated Top 18 Report', {
                studentCount: processed.length,
                testsCount: selectedTests.length || 'All'
            });

        } catch (err) {
            console.error("Error fetching Top 18 report:", err);
            alert("Failed to load Top 18 report.");
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch when initial students load
    useEffect(() => {
        if (top18Students.length > 0 && selectedStudentIds.length > 0) {
            fetchReport();
        }
    }, [top18Students]);

    const toggleStudent = (id) => {
        const idStr = String(id);
        setSelectedStudentIds(prev => 
            prev.includes(idStr) ? prev.filter(i => i !== idStr) : [...prev, idStr]
        );
    };

    const selectAllStudents = () => {
        setSelectedStudentIds(top18Students.map(s => String(s.id)));
    };

    const deselectAllStudents = () => {
        setSelectedStudentIds([]);
    };

    const getFilteredQuestions = (questions) => {
        if (subjectFilter.value === 'ALL') return questions;
        return questions.filter(q => q.Subject && q.Subject.toUpperCase() === subjectFilter.value);
    };

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

    // --- PDF GENERATION CORE (Single Student) ---
    const createStudentPDF = async (student, fonts, logoImg) => {
        const { impactFont, bookmanFont, bookmanBoldFont } = fonts;
        const doc = new jsPDF('p', 'mm', 'a4');
        const pageWidth = 210;
        const pageHeight = 297;
        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);

        if (impactFont) { doc.addFileToVFS("unicode.impact.ttf", impactFont); doc.addFont("unicode.impact.ttf", "Impact", "normal"); }
        if (bookmanFont) { doc.addFileToVFS("bookman-old-style.ttf", bookmanFont); doc.addFont("bookman-old-style.ttf", "Bookman", "normal"); }
        if (bookmanBoldFont) { doc.addFileToVFS("BOOKOSB.TTF", bookmanBoldFont); doc.addFont("BOOKOSB.TTF", "Bookman", "bold"); }

        const drawMainHeader = (doc) => {
            let y = 15;
            const part1 = "Sri Chaitanya";
            const part2 = " Educational Institutions";

            doc.setFontSize(26);
            if (impactFont) doc.setFont("Impact", "normal"); else doc.setFont("helvetica", "bold");
            const w1 = doc.getTextWidth(part1);

            if (bookmanFont) doc.setFont("Bookman", "normal"); else doc.setFont("helvetica", "normal");
            const w2 = doc.getTextWidth(part2);

            let logoW = 0;
            const logoH = 12;
            if (logoImg) {
                const asp = logoImg.width / logoImg.height;
                logoW = logoH * asp;
            }

            const gap = logoImg ? 4 : 0;
            const totalWidth = logoW + gap + w1 + w2;
            const startX = (pageWidth - totalWidth) / 2;
            let currentX = startX;

            if (logoImg) {
                try { doc.addImage(logoImg, 'PNG', currentX, y - 9, logoW, logoH); } catch (e) { }
                currentX += logoW + gap;
            }

            if (impactFont) doc.setFont("Impact", "normal"); else doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 112, 192);
            doc.text(part1, currentX, y);

            if (bookmanFont) doc.setFont("Bookman", "normal"); else doc.setFont("helvetica", "normal");
            doc.setTextColor(0, 112, 192);
            doc.text(part2, currentX + w1, y);

            y += 8;
            if (bookmanBoldFont) doc.setFont("Bookman", "bold"); else doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.text("Central Office, Bangalore - Top 18 Performance Report", pageWidth / 2, y, { align: 'center' });

            return y + 8;
        };

        const headerBottom = drawMainHeader(doc);
        let yPos = headerBottom + 1;

        doc.setLineWidth(0.3);
        doc.setDrawColor(0);
        doc.setFillColor(255, 248, 220);
        doc.rect(margin, yPos, contentWidth, 8, 'FD');

        if (bookmanBoldFont) doc.setFont("Bookman", "bold"); else doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(0);

        const leftCenter = margin + (contentWidth / 4);
        doc.text(student.info.name || '', leftCenter, yPos + 5.5, { align: 'center' });

        const rightCenter = margin + (contentWidth * 0.75);
        doc.text(student.info.branch || '', rightCenter, yPos + 5.5, { align: 'center' });

        doc.line(pageWidth / 2, yPos, pageWidth / 2, yPos + 8);
        yPos += 8;

        for (const test of student.tests) {
            if (yPos + 15 > pageHeight - margin) {
                doc.addPage();
                yPos = 15;
            }
            doc.setFontSize(14);
            doc.setTextColor(0);
            if (bookmanBoldFont) doc.setFont("Bookman", "bold"); else doc.setFont("helvetica", "bold");
            const testTitle = test.meta.customHeading || `${test.meta.date}_${student.info.stream}_${test.meta.testName}_Error Analysis`;
            doc.text(testTitle, pageWidth / 2, yPos + 6, { align: 'center' });
            yPos += 12;

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

            const filteredQs = getFilteredQuestions(test.questions);
            for (let i = 0; i < filteredQs.length; i++) {
                const q = filteredQs[i];
                const qImg = await loadImage(q.Q_URL);
                const sImg = await loadImage(q.S_URL);

                const wStat = 15;
                const wQ = 11;
                const wDetails = 22;
                const remainingW = contentWidth - wStat - wQ - wDetails;
                const wTopic = remainingW / 2;
                const wSub = remainingW / 2;

                const headerH = 10;
                const imgTargetW = 85;
                let qH = 0; if (qImg) qH = (qImg.height / qImg.width) * imgTargetW;
                let sH = 0; if (sImg) sH = (sImg.height / sImg.width) * imgTargetW;
                let maxContentH = Math.max(qH, sH, 20);
                let blockH = headerH + maxContentH + 2;

                if (yPos + blockH > pageHeight - margin) {
                    doc.addPage();
                    yPos = 15;
                }

                doc.setFillColor(128, 0, 0);
                doc.rect(margin, yPos, contentWidth, headerH, 'F');
                doc.setTextColor(255);
                doc.setFontSize(9);

                let cx = margin;
                const ty = yPos + 5.5;

                doc.text(String(q.W_U || ''), cx + (wStat / 2), ty, { align: 'center' });
                cx += wStat;
                doc.text(String(q.Q_No), cx + (wQ / 2), ty, { align: 'center' });
                cx += wQ;

                doc.setTextColor(255, 255, 0);
                doc.text("Topic: ", cx + 1, ty);
                doc.setTextColor(255, 255, 255);
                doc.text(String(q.Topic || '').slice(0, 25), cx + 12, ty);
                cx += wTopic;

                doc.setTextColor(255, 255, 0);
                doc.text("Sub: ", cx + 1, ty);
                doc.setTextColor(255, 255, 255);
                doc.text(String(q.Sub_Topic || '').slice(0, 25), cx + 9, ty);
                cx += wSub;

                doc.setTextColor(255, 255, 0);
                doc.text("Key: ", cx + 2, ty);
                doc.setTextColor(255, 255, 255);
                doc.text(String(q.Key_Value || ''), cx + 10, ty);

                doc.setDrawColor(0);
                doc.rect(margin, yPos, contentWidth, blockH);

                doc.setFillColor(79, 129, 189);
                doc.rect(margin, yPos + headerH, wStat, blockH - headerH, 'F');
                doc.setTextColor(255);
                doc.text(String(q.Subject || '').slice(0, 4), margin + (wStat / 2), yPos + headerH + ((blockH - headerH) / 2), { align: 'center' });

                const ibx = margin + wStat;
                const iby = yPos + headerH;
                const halfImgW = (contentWidth - wStat) / 2;

                const drwImg = (img, x, y, h) => {
                    const asp = img.width / img.height;
                    let w = h * asp;
                    const offX = (halfImgW - w) / 2;
                    try { doc.addImage(img, 'PNG', x + offX, y + 1, w, h); } catch (e) { }
                };

                if (qImg) drwImg(qImg, ibx, iby, qH);
                if (sImg) drwImg(sImg, ibx + halfImgW, iby, sH);

                yPos += blockH + 2;
            }
        }

        const totalPages = doc.internal.getNumberOfPages();
        doc.setFontSize(9);
        doc.setTextColor(0);
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            doc.text(`Page ${p} of ${totalPages}`, pageWidth / 2, pageHeight - 5, { align: 'center' });
        }

        return doc;
    };

    // Download PDF for selected Top 18
    const downloadPDF = async () => {
        if (reportData.length === 0) return;
        setGeneratingPdf(true);
        setPdfProgress('Loading Resources...');

        try {
            const [impactFont, bookmanFont, bookmanBoldFont] = await Promise.all([
                loadFont('/fonts/unicode.impact.ttf'),
                loadFont('/fonts/bookman-old-style.ttf'),
                loadFont('/fonts/BOOKOSB.TTF')
            ]);
            const logoImg = await loadImage('/logo.png');
            const fonts = { impactFont, bookmanFont, bookmanBoldFont };

            if (reportData.length === 1) {
                const doc = await createStudentPDF(reportData[0], fonts, logoImg);
                doc.save(`TOP18_${reportData[0].info.name}_${reportData[0].info.branch}.pdf`);
                logActivity(userData, 'Downloaded Top 18 Single PDF', { student: reportData[0].info.name });
            } else {
                const zip = new JSZip();
                for (let i = 0; i < reportData.length; i++) {
                    const student = reportData[i];
                    setPdfProgress(`Generating PDF ${i + 1}/${reportData.length}: ${student.info.name}...`);
                    const doc = await createStudentPDF(student, fonts, logoImg);
                    const blob = doc.output('blob');
                    zip.file(`TOP18_${student.info.name}_${student.info.branch}.pdf`, blob);
                }

                setPdfProgress('Compressing ZIP...');
                const zipContent = await zip.generateAsync({ type: 'blob' });
                saveAs(zipContent, `TOP18_Error_Reports_${subjectFilter.value}.zip`);
                logActivity(userData, 'Downloaded Bulk Top 18 Reports', { count: reportData.length });
            }
        } catch (err) {
            console.error("PDF generation failed:", err);
            alert("Error generating PDF: " + err.message);
        } finally {
            setGeneratingPdf(false);
            setPdfProgress('');
        }
    };

    // Download Consolidated Excel for Top 18
    const downloadExcel = async () => {
        if (performanceData.length === 0 && reportData.length === 0) return;
        setGeneratingExcel(true);
        setExcelProgress('Building Excel...');

        try {
            const workbook = new ExcelJS.Workbook();
            
            // Sheet 1: Performance Matrix
            const perfSheet = workbook.addWorksheet('Top 18 Summary');
            perfSheet.columns = [
                { header: 'Rank', key: 'rank', width: 8 },
                { header: 'Student ID', key: 'id', width: 15 },
                { header: 'Student Name', key: 'name', width: 28 },
                { header: 'Campus', key: 'branch', width: 22 },
                { header: 'Stream', key: 'stream', width: 20 },
                { header: 'Tests Count', key: 'testCount', width: 12 },
                { header: 'Avg Marks', key: 'avgTot', width: 12 },
                { header: 'Best AIR', key: 'bestAir', width: 12 },
                { header: 'Avg Botany', key: 'avgBot', width: 12 },
                { header: 'Avg Zoology', key: 'avgZoo', width: 12 },
                { header: 'Avg Physics', key: 'avgPhy', width: 12 },
                { header: 'Avg Chemistry', key: 'avgChem', width: 12 }
            ];

            // Style Header
            const headerRow = perfSheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };

            performanceData.forEach((s, idx) => {
                perfSheet.addRow({
                    rank: idx + 1,
                    id: s.id,
                    name: s.name,
                    branch: s.branch,
                    stream: s.stream,
                    testCount: s.testCount,
                    avgTot: s.avgTot,
                    bestAir: s.bestAir,
                    avgBot: s.avgBot,
                    avgZoo: s.avgZoo,
                    avgPhy: s.avgPhy,
                    avgChem: s.avgChem
                });
            });

            // Sheet 2: Detailed Questions Error Log
            const errSheet = workbook.addWorksheet('Questions Error Log');
            errSheet.columns = [
                { header: 'Student ID', key: 'id', width: 15 },
                { header: 'Student Name', key: 'name', width: 25 },
                { header: 'Campus', key: 'branch', width: 20 },
                { header: 'Test Name', key: 'test', width: 15 },
                { header: 'Exam Date', key: 'date', width: 15 },
                { header: 'Q.No', key: 'qno', width: 8 },
                { header: 'W/U', key: 'wu', width: 8 },
                { header: 'Subject', key: 'subject', width: 15 },
                { header: 'Topic', key: 'topic', width: 30 },
                { header: 'Sub Topic', key: 'subtopic', width: 30 },
                { header: 'Key', key: 'key', width: 10 }
            ];

            const errHeader = errSheet.getRow(1);
            errHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            errHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800000' } };

            reportData.forEach(student => {
                student.tests.forEach(test => {
                    const qs = getFilteredQuestions(test.questions);
                    qs.forEach(q => {
                        errSheet.addRow({
                            id: student.info.id,
                            name: student.info.name,
                            branch: student.info.branch,
                            test: test.meta.testName,
                            date: test.meta.date,
                            qno: q.Q_No,
                            wu: q.W_U,
                            subject: q.Subject,
                            topic: q.Topic,
                            subtopic: q.Sub_Topic,
                            key: q.Key_Value
                        });
                    });
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `TOP_18_Consolidated_Report_${academicYear}.xlsx`);
            logActivity(userData, 'Downloaded Top 18 Consolidated Excel');

        } catch (err) {
            console.error("Excel generation error:", err);
            alert("Failed to export Excel: " + err.message);
        } finally {
            setGeneratingExcel(false);
            setExcelProgress('');
        }
    };

    if (loadingInit) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: '#1e3a8a', backgroundColor: '#f8fafc', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={48} color="#2563eb" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: 'bold' }}>Loading TOP 18 Members from Config...</h3>
                <p style={{ color: '#64748b', fontSize: '14px', marginTop: '6px' }}>Synchronizing student IDs from Uploader_Config.xlsx</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '20px', backgroundColor: '#f1f5f9', minHeight: '100vh', fontFamily: 'Arial, sans-serif' }}>
            {/* TOP 18 BANNER */}
            <div style={{
                background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 50%, #3b82f6 100%)',
                color: 'white',
                padding: '20px 24px',
                borderRadius: '12px',
                boxShadow: '0 4px 15px rgba(30, 58, 138, 0.25)',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '15px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        padding: '12px',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Award size={32} color="#fbbf24" />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>TOP 18 Exclusive Dashboard</h1>
                            <span style={{ backgroundColor: '#fbbf24', color: '#78350f', fontSize: '11px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '12px' }}>
                                VIP TOPPERS
                            </span>
                        </div>
                        <p style={{ margin: '4px 0 0 0', opacity: 0.9, fontSize: '13px' }}>
                            Automatically loaded 18 top performers from <code style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '4px' }}>Uploader_Config.xlsx [TOP 18]</code>
                        </p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        onClick={() => setViewMode('errors')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: viewMode === 'errors' ? '#ffffff' : 'rgba(255, 255, 255, 0.2)',
                            color: viewMode === 'errors' ? '#1e40af' : '#ffffff',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <FileText size={16} /> Error Analysis
                    </button>
                    <button
                        onClick={() => setViewMode('performance')}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            backgroundColor: viewMode === 'performance' ? '#ffffff' : 'rgba(255, 255, 255, 0.2)',
                            color: viewMode === 'performance' ? '#1e40af' : '#ffffff',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s'
                        }}
                    >
                        <BarChart2 size={16} /> Score Summary
                    </button>
                </div>
            </div>

            {/* CONTROLS CARD */}
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: '20px' }}>
                {/* 18 Students Chips */}
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#1e293b' }}>
                            Top 18 Students ({selectedStudentIds.length}/{top18Students.length} Selected):
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={selectAllStudents}
                                style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer', fontWeight: 'bold', color: '#0284c7' }}
                            >
                                Select All 18
                            </button>
                            <button
                                onClick={deselectAllStudents}
                                style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#f8fafc', cursor: 'pointer', fontWeight: 'bold', color: '#64748b' }}
                            >
                                Clear Selection
                            </button>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '120px', overflowY: 'auto', padding: '4px' }}>
                        {top18Students.map((s) => {
                            const isSelected = selectedStudentIds.includes(String(s.id));
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => toggleStudent(s.id)}
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '20px',
                                        border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                                        backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                                        color: isSelected ? '#1d4ed8' : '#475569',
                                        fontWeight: isSelected ? 'bold' : '500',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        boxShadow: isSelected ? '0 1px 3px rgba(37,99,235,0.2)' : 'none',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {isSelected && <CheckCircle2 size={14} color="#2563eb" />}
                                    <span>{s.name}</span>
                                    <span style={{ fontSize: '10px', color: isSelected ? '#3b82f6' : '#94a3b8' }}>({s.campus || s.id})</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Filters Row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'center', justifyContent: 'space-between', paddingTop: '15px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                        {/* Test Selection */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <span style={{ marginRight: '8px', fontWeight: 'bold', fontSize: '13px' }}>Tests:</span>
                            <div style={{ width: '220px' }}>
                                <Select
                                    isMulti
                                    options={availableTests.map(t => ({ value: t, label: t }))}
                                    value={selectedTests.map(t => ({ value: t, label: t }))}
                                    onChange={(opts) => setSelectedTests(opts ? opts.map(o => o.value) : [])}
                                    placeholder="All Tests (Default)"
                                    closeMenuOnSelect={false}
                                />
                            </div>
                        </div>

                        {/* Subject Filter */}
                        {viewMode === 'errors' && (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                <span style={{ marginRight: '8px', fontWeight: 'bold', fontSize: '13px' }}>Subject:</span>
                                <div style={{ width: '170px' }}>
                                    <Select
                                        options={subjectOptions}
                                        value={subjectFilter}
                                        onChange={setSubjectFilter}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Zoom Controls */}
                        {viewMode === 'errors' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f8fafc', padding: '4px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '12px', marginRight: '4px' }}>Zoom:</span>
                                <button onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.5))} style={{ padding: '2px 6px', cursor: 'pointer' }}>-</button>
                                <span style={{ minWidth: '40px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>{Math.round(zoom * 100)}%</span>
                                <button onClick={() => setZoom(prev => Math.min(prev + 0.1, 2))} style={{ padding: '2px 6px', cursor: 'pointer' }}>+</button>
                                <button onClick={() => setZoom(1)} style={{ padding: '2px 6px', cursor: 'pointer', marginLeft: '4px', fontSize: '11px' }}>Reset</button>
                            </div>
                        )}

                        <button
                            onClick={fetchReport}
                            disabled={loading}
                            style={{
                                backgroundColor: '#2563eb',
                                color: 'white',
                                border: 'none',
                                padding: '8px 18px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {loading ? 'Refreshing...' : 'Apply & View'}
                        </button>
                    </div>

                    {/* Download Buttons */}
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                            onClick={downloadPDF}
                            disabled={reportData.length === 0 || generatingPdf || generatingExcel}
                            style={{
                                backgroundColor: '#0284c7',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Download size={15} />
                            {generatingPdf ? pdfProgress || 'Generating...' : `Download PDF (${reportData.length})`}
                        </button>
                        <button
                            onClick={downloadExcel}
                            disabled={(performanceData.length === 0 && reportData.length === 0) || generatingPdf || generatingExcel}
                            style={{
                                backgroundColor: '#107c41',
                                color: 'white',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Download size={15} />
                            {generatingExcel ? excelProgress || 'Generating...' : `Export Excel (${reportData.length})`}
                        </button>
                    </div>
                </div>
            </div>

            <LoadingTimer isLoading={loading} />

            {/* PERFORMANCE SCORE SUMMARY TABLE VIEW */}
            {!loading && viewMode === 'performance' && (
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', marginBottom: '15px' }}>
                        Top 18 Performance Overview & Average Scores
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#1e40af', color: 'white' }}>
                                <th style={{ padding: '10px 12px' }}>#</th>
                                <th style={{ padding: '10px 12px' }}>Student Name</th>
                                <th style={{ padding: '10px 12px' }}>Campus</th>
                                <th style={{ padding: '10px 12px' }}>Stream</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Tests Taken</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center', backgroundColor: '#1d4ed8' }}>Avg Total (720)</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Best AIR</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Avg Botany</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Avg Zoology</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Avg Physics</th>
                                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Avg Chemistry</th>
                            </tr>
                        </thead>
                        <tbody>
                            {performanceData.map((s, idx) => (
                                <tr key={s.id} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                    <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{idx + 1}</td>
                                    <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#1e3a8a' }}>{s.name}</td>
                                    <td style={{ padding: '10px 12px' }}>{s.branch}</td>
                                    <td style={{ padding: '10px 12px', color: '#64748b' }}>{s.stream}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{s.testCount}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: '#15803d', backgroundColor: '#f0fdf4' }}>{s.avgTot}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 'bold', color: '#0284c7' }}>{s.bestAir}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{s.avgBot}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{s.avgZoo}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{s.avgPhy}</td>
                                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>{s.avgChem}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ERROR ANALYSIS VIEW */}
            {!loading && viewMode === 'errors' && reportData.map((student, sIdx) => (
                <div key={sIdx} style={{
                    width: '98%',
                    minHeight: '297mm',
                    margin: '0 auto 40px auto',
                    backgroundColor: 'white',
                    padding: '10mm',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                    boxSizing: 'border-box',
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top center',
                    fontFamily: '"Bookman Old Style", "Times New Roman", serif',
                    marginBottom: `${(zoom - 1) * 287 + 20}mm`
                }}>
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: '15px' }}>
                        <div style={{ color: '#0070c0', marginBottom: '5px', display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                            <span style={{ fontFamily: 'Impact, sans-serif', fontSize: '26px' }}>Sri Chaitanya</span>
                            <span style={{ fontFamily: '"Bookman Old Style", serif', fontSize: '26px', marginLeft: '5px' }}> Educational Institutions</span>
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', marginTop: '4px' }}>
                            Central Office, Bangalore - Top 18 Elite Error Analysis
                        </div>
                    </div>

                    {/* Student Info Bar */}
                    <div style={{ width: '100%', border: '1px solid black', display: 'flex', backgroundColor: '#fff8dc', marginBottom: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                        <div style={{ flex: 1, padding: '8px', textAlign: 'center', textTransform: 'uppercase', borderRight: '1px solid black' }}>
                            {student.info.name} (ID: {student.info.id})
                        </div>
                        <div style={{ flex: 1, padding: '8px', textAlign: 'center', textTransform: 'uppercase' }}>
                            {student.info.branch}
                        </div>
                    </div>

                    {student.tests.map((test, tIdx) => {
                        const renderQs = getFilteredQuestions(test.questions);
                        if (renderQs.length === 0) return null;

                        return (
                            <div key={tIdx} style={{ marginBottom: '30px' }}>
                                <h2 style={{ textAlign: 'center', color: '#000', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                                    {test.meta.customHeading || `${test.meta.date}_${student.info.stream}_${test.meta.testName}_Error Analysis`}
                                </h2>

                                {/* Score Table */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '15px', fontSize: '12px', textAlign: 'center', fontWeight: 'bold' }}>
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

                                {/* Questions */}
                                {renderQs.map((q, qIdx) => (
                                    <table key={qIdx} style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', marginBottom: '10px', backgroundColor: 'white' }}>
                                        <colgroup>
                                            <col style={{ width: '7.8%' }} />
                                            <col style={{ width: '5.7%' }} />
                                            <col style={{ width: '37.5%' }} />
                                            <col style={{ width: '37.5%' }} />
                                            <col style={{ width: '11.5%' }} />
                                        </colgroup>
                                        <thead>
                                            <tr style={{ backgroundColor: '#800000', color: 'white', fontSize: '13px', fontWeight: 'bold' }}>
                                                <td style={{ border: '1px solid black', textAlign: 'center', height: '28px' }}>{q.W_U}</td>
                                                <td style={{ border: '1px solid black', textAlign: 'center' }}>{q.Q_No}</td>
                                                <td style={{ border: '1px solid black', padding: '4px' }}>
                                                    <span style={{ color: '#FFFF00' }}>Topic: </span>{q.Topic}
                                                </td>
                                                <td style={{ border: '1px solid black', padding: '4px' }}>
                                                    <span style={{ color: '#FFFF00' }}>Sub Topic: </span>{q.Sub_Topic}
                                                </td>
                                                <td style={{ border: '1px solid black', padding: '2px 4px' }}>
                                                    <div><span style={{ color: '#FFFF00' }}>Key: </span>{q.Key_Value}</div>
                                                </td>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td style={{ backgroundColor: '#4F81BD', border: '1px solid black', textAlign: 'center', color: 'white', fontWeight: 'bold', fontSize: '12px' }}>
                                                    {q.Subject}
                                                </td>
                                                <td colSpan="4" style={{ padding: 0, border: '1px solid black' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                                        <tbody>
                                                            <tr>
                                                                <td style={{ width: '50%', borderRight: '1px solid black', verticalAlign: 'top', padding: '4px' }}>
                                                                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#666' }}>Q.{q.Q_No}</div>
                                                                    <div style={{ textAlign: 'center' }}>
                                                                        {q.Q_URL ? (
                                                                            <img src={q.Q_URL} style={{ width: '100%', maxWidth: '450px', height: 'auto', display: 'block', margin: '0 auto' }} alt="Q" />
                                                                        ) : (
                                                                            <div style={{ padding: '15px', color: '#999', fontSize: '12px' }}>No Image</div>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td style={{ width: '50%', verticalAlign: 'top', padding: '4px' }}>
                                                                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: '#666' }}>Sol</div>
                                                                    <div style={{ textAlign: 'center' }}>
                                                                        {q.S_URL ? (
                                                                            <img src={q.S_URL} style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }} alt="S" />
                                                                        ) : (
                                                                            <div style={{ padding: '15px', color: '#999', fontSize: '12px' }}>No Solution</div>
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
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default Top18Report;
