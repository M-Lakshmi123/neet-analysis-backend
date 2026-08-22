import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ChevronLeft, ChevronRight, AlertTriangle, TrendingUp } from 'lucide-react';
import { logActivity } from '../utils/activityLogger';
import { useAuth } from './auth/AuthProvider';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    LineController,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    LineController,
    Filler,
    ChartDataLabels
);

// Diagnostics Helper: Find primary lagging subject & test-wise marks loss
const analyzeLaggingSubjectAndLosses = (transformedRows) => {
    if (!transformedRows || transformedRows.length === 0) return null;

    const attempted = transformedRows.filter(r => !r.isAB);
    if (attempted.length === 0) return null;

    const count = attempted.length;
    const avgBot = Math.round(attempted.reduce((a, b) => a + (Number(b.Botany) || 0), 0) / count);
    const avgZoo = Math.round(attempted.reduce((a, b) => a + (Number(b.Zoology) || 0), 0) / count);
    const avgPhy = Math.round(attempted.reduce((a, b) => a + (Number(b.Physics) || 0), 0) / count);
    const avgChem = Math.round(attempted.reduce((a, b) => a + (Number(b.Chemistry) || 0), 0) / count);

    const subjects = [
        { name: 'Botany', key: 'Botany', avg: avgBot, max: 180, pct: (avgBot / 180) * 100 },
        { name: 'Zoology', key: 'Zoology', avg: avgZoo, max: 180, pct: (avgZoo / 180) * 100 },
        { name: 'Physics', key: 'Physics', avg: avgPhy, max: 180, pct: (avgPhy / 180) * 100 },
        { name: 'Chemistry', key: 'Chemistry', avg: avgChem, max: 180, pct: (avgChem / 180) * 100 },
    ];

    subjects.sort((a, b) => a.pct - b.pct);
    const lagging = subjects[0];

    const testLosses = transformedRows.map(row => {
        const testName = row.Test?.trim() || '';
        if (row.isAB) {
            return `${testName}: AB (-${lagging.max})`;
        }
        const scored = Math.round(Number(row[lagging.key]) || 0);
        const loss = lagging.max - scored;
        return `${testName}: -${loss}`;
    });

    return {
        laggingSubjectName: lagging.name,
        laggingAvg: lagging.avg,
        laggingMax: lagging.max,
        marksLossString: testLosses.join(', ')
    };
};

// High-DPI Canvas Chart Generator tailored specifically for crisp PDF export
const generateChartImage = (transformedRows) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1900;
        canvas.height = 700;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const labels = [];
        const totalScores = [];

        transformedRows.forEach(row => {
            labels.push(row.Test?.trim() || '');
            if (!row.isAB) {
                totalScores.push(Math.round(Number(row.Tot_720) || 0));
            } else {
                totalScores.push(null);
            }
        });

        const chart = new ChartJS(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Total Score (720)',
                        data: totalScores,
                        borderColor: '#1d4ed8',
                        backgroundColor: 'rgba(29, 78, 216, 0.12)',
                        borderWidth: 6,
                        pointRadius: 10,
                        pointHoverRadius: 13,
                        pointBackgroundColor: '#1d4ed8',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 3,
                        tension: 0.35,
                        fill: true,
                        datalabels: {
                            display: true,
                            align: 'top',
                            anchor: 'end',
                            offset: 6,
                            color: '#1e3a8a',
                            font: { weight: 'bold', size: 28 },
                            formatter: (val) => val !== null ? val : 'AB'
                        }
                    }
                ]
            },
            options: {
                responsive: false,
                animation: false,
                layout: {
                    padding: { top: 45, right: 40, bottom: 20, left: 30 }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Student Performance Trend (Total Marks / 720)',
                        font: { size: 34, weight: 'bold' },
                        color: '#0f172a',
                        padding: { top: 15, bottom: 25 }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 720,
                        ticks: { stepSize: 100, font: { size: 24, weight: 'bold' }, color: '#334155' },
                        title: { display: true, text: 'Total Marks / 720', font: { size: 26, weight: 'bold' }, color: '#1e293b', padding: { bottom: 10 } },
                        grid: { color: '#e2e8f0', lineWidth: 1.5 }
                    },
                    x: {
                        title: { display: true, text: 'Exams', font: { size: 26, weight: 'bold' }, color: '#1e293b', padding: { top: 10 } },
                        grid: { color: '#f1f5f9', lineWidth: 1.5 },
                        ticks: { font: { size: 24, weight: 'bold' }, color: '#334155' }
                    }
                }
            },
            plugins: [ChartDataLabels]
        });

        setTimeout(() => {
            const dataUrl = canvas.toDataURL('image/png');
            chart.destroy();
            resolve(dataUrl);
        }, 50);
    });
};

const AverageReport = ({ filters }) => {
    const { userData } = useAuth();
    const [history, setHistory] = useState([]);
    const [allExams, setAllExams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });

    useEffect(() => {
        setHistory([]);
        setAllExams([]);
        setHasSearched(false);
        setCurrentStudentIndex(0);
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
            params.append('includeExams', 'true');
            const response = await fetch(`${API_URL}/api/history?${params.toString()}`);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Status: ${response.status}`);
            }
            const data = await response.json();

            const historyData = data.history || [];
            const examData = data.allExams || [];

            setHistory(historyData);
            setAllExams(examData);
            setCurrentStudentIndex(0);

            const studentCount = new Set(historyData.map(h => h.STUD_ID)).size;
            logActivity(userData, 'Generated Progress Report', {
                studentCount,
                campus: filters.campus
            });
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

    const getNormalizedStream = (data) => {
        const streams = [...new Set(data.map(row => row.Stream?.trim().toUpperCase()).filter(Boolean))];
        if (streams.length === 0) return '';

        const selectedStream = (Array.isArray(filters.stream) ? filters.stream[0] : filters.stream)?.toString().toUpperCase() || '';
        const isFilteringJR = selectedStream.includes('JR');
        const isFilteringSR = selectedStream.includes('SR');

        const hasSr = streams.some(s => s.includes('SR ELITE') || s.includes('SR_ELITE'));
        const hasJrEliteAiims = streams.some(s => (s.includes('JR ELITE') || s.includes('JR_ELITE')) && s.includes('AIIMS'));
        const hasJrElite = streams.includes('JR ELITE') || streams.includes('JR_ELITE');
        const hasJrAiims = streams.includes('JR AIIMS') || streams.includes('JR_AIIMS');

        if (isFilteringJR) {
            if (hasJrEliteAiims && hasJrElite) return 'JR ELITE';
            if (hasJrEliteAiims && hasJrAiims) return 'JR AIIMS';
            if (hasJrElite) return 'JR ELITE';
            if (hasJrAiims) return 'JR AIIMS';
        }

        if (isFilteringSR && hasSr) {
            return 'SR ELITE';
        }

        if (hasSr) return 'SR ELITE';

        if (hasJrEliteAiims && hasJrElite) return 'JR ELITE';
        if (hasJrEliteAiims && hasJrAiims) return 'JR AIIMS';
        if (hasJrElite) return 'JR ELITE';
        if (hasJrAiims) return 'JR AIIMS';

        return streams[0];
    };

    const loadImage = (src) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
        });
    };

    const generateStudentPDF = (studentData, logoImg, impactFont, bookmanFont, bookmanBoldFont, chartImgData, transformedRows) => {
        const doc = new jsPDF('p', 'mm', 'a4');

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

        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, 210, 297, 'F');

        let currentY = 11;

        if (impactFont) {
            doc.setFont("Impact", "normal");
        } else {
            doc.setFont("helvetica", "bold");
        }
        doc.setFontSize(22);
        doc.setTextColor(0, 112, 192);

        if (logoImg) {
            const aspect = logoImg.width / logoImg.height;
            let logoH = 20;
            let logoW = logoH * aspect;

            const logoX = (210 - logoW) / 2;
            doc.addImage(logoImg, 'PNG', logoX, currentY, logoW, logoH, undefined, 'FAST');
            currentY += logoH + 6;
        } else {
            currentY += 10;
        }

        const part1 = "Sri Chaitanya";
        const part2 = " Educational Institutions";
        doc.setFontSize(26);

        if (impactFont) doc.setFont("Impact", "normal");
        else doc.setFont("helvetica", "bold");
        const w1 = doc.getTextWidth(part1);

        if (bookmanFont) doc.setFont("Bookman", "normal");
        else doc.setFont("helvetica", "normal");
        const w2 = doc.getTextWidth(part2);

        const totalWidth = w1 + w2;
        const startX = (210 - totalWidth) / 2;

        if (impactFont) doc.setFont("Impact", "normal");
        else doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 112, 192);
        doc.text(part1, startX, currentY);

        if (bookmanFont) doc.setFont("Bookman", "normal");
        else doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 102, 204);
        doc.text(part2, startX + w1, currentY);

        currentY += 8;

        if (bookmanFont) doc.setFont("Bookman", "bold");
        else doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        const subTitle = "P R O G R E S S   R E P O R T";
        doc.text(subTitle, 105, currentY, { align: 'center' });
        currentY += 6;

        const pageWidth = doc.internal.pageSize.getWidth();
        const contentWidth = 190;
        const marginX = (pageWidth - contentWidth) / 2;

        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.4);
        doc.line(marginX, currentY, pageWidth - marginX, currentY);
        currentY += 4;

        // Dynamic Header Box (Student Info) with Space & Next-Line Layout
        if (studentData.length > 0) {
            const student = studentData[0];
            const normalizedStream = getNormalizedStream(studentData);

            const col1X = marginX + 6; // 16mm
            const col2X = marginX + 98; // 108mm
            const col1ValX = col1X + 33; // 49mm (leaves proper space after "Student Name:")
            const col2ValX = col2X + 22; // 130mm

            const nameStr = (student.NAME_OF_THE_STUDENT || '').toUpperCase().trim();
            const campusStr = (student.CAMPUS_NAME || '').toUpperCase().trim();

            if (bookmanFont) doc.setFont("Bookman", "bold");
            else doc.setFont("helvetica", "bold");
            doc.setFontSize(11);

            const maxNameWidthOnRow1 = col2X - col1ValX - 4;
            const nameWidth = doc.getTextWidth(nameStr);

            let isNameOnNextLine = nameWidth > maxNameWidthOnRow1;
            let boxHeight = isNameOnNextLine ? 30 : 24;

            doc.setFillColor(239, 246, 255);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.1);
            doc.roundedRect(marginX, currentY, contentWidth, boxHeight, 1, 1, 'FD');

            const textYStart = currentY + 8;

            // Student Name Label
            if (bookmanFont) doc.setFont("Bookman", "bold");
            else doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.text("Student Name:", col1X, textYStart);

            // Campus Label & Value (Row 1 Right)
            doc.text("Campus:", col2X, textYStart);
            if (bookmanFont) doc.setFont("Bookman", "bold");
            else doc.setFont("helvetica", "normal");
            doc.text(campusStr, col2ValX, textYStart);

            let row2Y = textYStart + 9;

            if (isNameOnNextLine) {
                // Render student name on Line 2 clearly with space
                if (bookmanFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.setTextColor(0, 51, 153);
                doc.text(nameStr, col1X + 4, textYStart + 7);

                row2Y = textYStart + 16;
            } else {
                // Name on Line 1 with space after label
                if (bookmanFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "normal");
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                doc.text(nameStr, col1ValX, textYStart);
            }

            // Student ID & Stream
            if (bookmanFont) doc.setFont("Bookman", "bold");
            else doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.text("Student ID:", col1X, row2Y);

            if (bookmanFont) doc.setFont("Bookman", "bold");
            else doc.setFont("helvetica", "normal");
            doc.text(student.STUD_ID?.toString() || '', col1ValX, row2Y);

            if (bookmanFont) doc.setFont("Bookman", "bold");
            else doc.setFont("helvetica", "bold");
            doc.text("Stream:", col2X, row2Y);

            if (bookmanFont) doc.setFont("Bookman", "bold");
            else doc.setFont("helvetica", "normal");
            doc.text(normalizedStream, col2ValX, row2Y);

            currentY += boxHeight;
        }

        const tableColumn = ["Test Name", "Date", "Total\n720", "AIR", "Bot\n180", "Zoo\n180", "Bio\n360", "Phy\n180", "Chem\n180"];

        const tableRows = transformedRows.map(row => {
            if (row.isAB) {
                return [
                    row.Test,
                    formatDate(row.DATE),
                    { content: 'AB', styles: { textColor: [255, 0, 0], fontStyle: 'bold' } },
                    { content: 'AB', styles: { textColor: [255, 0, 0], fontStyle: 'bold' } },
                    { content: 'AB', styles: { textColor: [255, 0, 0], fontStyle: 'bold' } },
                    { content: 'AB', styles: { textColor: [255, 0, 0], fontStyle: 'bold' } },
                    { content: 'AB', styles: { textColor: [255, 0, 0], fontStyle: 'bold' } },
                    { content: 'AB', styles: { textColor: [255, 0, 0], fontStyle: 'bold' } },
                    { content: 'AB', styles: { textColor: [255, 0, 0], fontStyle: 'bold' } }
                ];
            }
            return [
                row.Test,
                formatDate(row.DATE),
                Math.round(row.Tot_720 || 0),
                Math.round(row.AIR) || '-',
                Math.round(row.Botany || 0),
                Math.round(row.Zoology || 0),
                Math.round((Number(row.Botany) || 0) + (Number(row.Zoology) || 0)),
                Math.round(row.Physics || 0),
                Math.round(row.Chemistry || 0)
            ];
        });

        const attemptedRows = studentData;
        if (attemptedRows.length > 0) {
            const avg = (key) => Math.round(attemptedRows.reduce((a, b) => a + (Number(b[key]) || 0), 0) / attemptedRows.length);
            const avgAIR = Math.round(attemptedRows.reduce((a, b) => a + (Number(b.AIR) || 0), 0) / attemptedRows.length);
            const avgBio = Math.round(attemptedRows.reduce((a, b) => a + (Number(b.Botany) || 0) + (Number(b.Zoology) || 0), 0) / attemptedRows.length);

            tableRows.push([
                { content: "AVERAGE", colSpan: 2 },
                avg('Tot_720'),
                avgAIR,
                avg('Botany'),
                avg('Zoology'),
                avgBio,
                avg('Physics'),
                avg('Chemistry')
            ]);
        }

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: currentY + 4,
            theme: 'grid',
            headStyles: {
                fillColor: [0, 0, 0],
                textColor: [255, 255, 255],
                font: bookmanFont ? "Bookman" : "helvetica",
                fontStyle: "bold",
                halign: 'center',
                valign: 'middle',
                lineWidth: 0.2,
                fontSize: 11
            },
            styles: {
                font: bookmanFont ? "Bookman" : "helvetica",
                fontSize: 11,
                cellPadding: 1.5,
                overflow: 'ellipsize',
                halign: 'center',
                valign: 'middle',
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                textColor: [0, 0, 0]
            },
            columnStyles: {
                0: { halign: 'center', cellWidth: 55, fontSize: 10, fontStyle: 'bold' },
                1: { cellWidth: 28 },
                2: { cellWidth: 17, fillColor: [255, 255, 204] },
                3: { cellWidth: 15 },
                4: { cellWidth: 15, fillColor: [253, 233, 217] },
                5: { cellWidth: 15, fillColor: [218, 238, 243] },
                6: { cellWidth: 15, fillColor: [224, 231, 255] },
                7: { cellWidth: 15, fillColor: [235, 241, 222] },
                8: { cellWidth: 15, fillColor: [242, 220, 219] }
            },
            margin: { left: marginX, right: marginX, bottom: 15 },
            didParseCell: (data) => {
                if (data.row.index === tableRows.length - 1) {
                    if (bookmanFont) {
                        data.cell.styles.font = "Bookman";
                        data.cell.styles.fontStyle = 'bold';
                    } else {
                        data.cell.styles.fontStyle = 'bold';
                    }
                    data.cell.styles.fillColor = [218, 238, 243];
                    data.cell.styles.textColor = [0, 0, 0];
                }
            }
        });

        // 6. Modern Chart & Lagging Subject Marks Loss Diagnostics Section
        if (chartImgData) {
            const analysis = analyzeLaggingSubjectAndLosses(transformedRows);
            const chartHeight = 65;

            let advisoryHeight = 24;
            let lossLines = [];
            if (analysis) {
                if (bookmanFont) doc.setFont("Bookman", "normal");
                else doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                const maxLossWidth = contentWidth - 8;
                lossLines = doc.splitTextToSize(analysis.marksLossString, maxLossWidth);
                advisoryHeight = 22 + (lossLines.length * 4.5);
            }

            const totalRequiredHeight = chartHeight + advisoryHeight + 10;
            const pageHeight = 297;
            const bottomMargin = 12;

            let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : currentY;
            let chartStartY = finalY + 6;

            if (chartStartY + totalRequiredHeight > pageHeight - bottomMargin) {
                doc.addPage();
                chartStartY = 14;

                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setFontSize(13);
                doc.setTextColor(0, 112, 192);
                doc.text("SRI CHAITANYA EDUCATIONAL INSTITUTIONS", 105, chartStartY, { align: 'center' });

                chartStartY += 5;
                doc.setFontSize(10.5);
                doc.setTextColor(0, 0, 0);
                doc.text("STUDENT PERFORMANCE REPORT & MARKS LOSS ANALYSIS", 105, chartStartY, { align: 'center' });

                chartStartY += 4;
                doc.setDrawColor(0, 0, 0);
                doc.setLineWidth(0.3);
                doc.line(marginX, chartStartY, pageWidth - marginX, chartStartY);

                chartStartY += 6;
            } else {
                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.setTextColor(0, 112, 192);
                doc.text("STUDENT PERFORMANCE TREND CHART", marginX, chartStartY);
                chartStartY += 4;
            }

            // Render Crisp High-DPI Chart Image
            doc.addImage(chartImgData, 'PNG', marginX, chartStartY, contentWidth, chartHeight);

            // Render Diagnostics Box with Exact Dynamic Label Measurement
            if (analysis) {
                const advisoryY = chartStartY + chartHeight + 4;

                doc.setFillColor(248, 250, 252);
                doc.setDrawColor(203, 213, 225);
                doc.roundedRect(marginX, advisoryY, contentWidth, advisoryHeight, 1, 1, 'FD');

                // Header Bar
                doc.setFillColor(224, 231, 255);
                doc.rect(marginX, advisoryY, contentWidth, 7, 'F');
                doc.setDrawColor(203, 213, 225);
                doc.line(marginX, advisoryY + 7, marginX + contentWidth, advisoryY + 7);

                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setFontSize(9.5);
                doc.setTextColor(30, 58, 138);
                doc.text("PERFORMANCE DIAGNOSTICS & MARKS LOSS ANALYSIS", marginX + 4, advisoryY + 5);

                let lineY = advisoryY + 12;

                // Line 1: Primary Lagging Subject with Dynamic Width Gap
                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setFontSize(9.5);
                doc.setTextColor(185, 28, 28);
                const labelText = "Primary Lagging Subject: ";
                doc.text(labelText, marginX + 4, lineY);

                const labelWidth = doc.getTextWidth(labelText);

                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setTextColor(30, 41, 59);
                doc.text(`${analysis.laggingSubjectName} (${analysis.laggingAvg}/${analysis.laggingMax})`, marginX + 4 + labelWidth + 3, lineY);

                lineY += 6;

                // Line 2: Marks Loss Title
                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setFontSize(9);
                doc.setTextColor(30, 58, 138);
                doc.text(`Marks Loss in ${analysis.laggingSubjectName} across Tests:`, marginX + 4, lineY);

                lineY += 5;

                // Line 3+: Wrapped Test Marks Loss List
                if (bookmanFont) doc.setFont("Bookman", "normal");
                else doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(51, 65, 85);

                lossLines.forEach((line) => {
                    doc.text(line, marginX + 4, lineY);
                    lineY += 4.5;
                });
            }
        }

        return doc;
    };

    const downloadPDF = async () => {
        try {
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
                    console.error("[PDF] Font loading error:", err);
                    return null;
                }
            };

            const [logoImg, impactFont, bookmanFont, bookmanBoldFont] = await Promise.all([
                loadImage('/logo.png'),
                loadFont('/fonts/unicode.impact.ttf'),
                loadFont('/fonts/bookman-old-style.ttf'),
                loadFont('/fonts/BOOKOSB.TTF')
            ]);

            const grouped = history.reduce((acc, row) => {
                const id = row.STUD_ID || 'Unknown';
                if (!acc[id]) acc[id] = [];
                acc[id].push(row);
                return acc;
            }, {});

            const studentIds = Object.keys(grouped);
            if (studentIds.length === 0) return;

            const getTransformedRows = (sRows) => {
                return allExams.map(exam => {
                    const examTest = exam.Test?.trim();
                    const existing = sRows.find(r => r.Test?.trim() === examTest);
                    if (existing) {
                        return { ...existing, isAB: false };
                    } else {
                        return { Test: exam.Test, DATE: exam.DATE, isAB: true };
                    }
                });
            };

            if (studentIds.length === 1) {
                const sRows = grouped[studentIds[0]];
                const transformed = getTransformedRows(sRows);
                const chartImgData = await generateChartImage(transformed);
                const doc = generateStudentPDF(sRows, logoImg, impactFont, bookmanFont, bookmanBoldFont, chartImgData, transformed);
                const sName = sRows[0].NAME_OF_THE_STUDENT || 'Report';
                doc.save(`${sName}_Progress_Report.pdf`);
                logActivity(userData, 'Downloaded Progress PDF', { student: sName });
            } else {
                const zip = new JSZip();
                const campusName = grouped[studentIds[0]][0].CAMPUS_NAME || 'Campus';

                for (const id of studentIds) {
                    const sRows = grouped[id];
                    const sName = sRows[0].NAME_OF_THE_STUDENT || id;
                    const transformed = getTransformedRows(sRows);
                    const chartImgData = await generateChartImage(transformed);
                    const doc = generateStudentPDF(sRows, logoImg, impactFont, bookmanFont, bookmanBoldFont, chartImgData, transformed);
                    const pdfBlob = doc.output('blob');
                    zip.file(`${sName}_Progress_Report.pdf`, pdfBlob);
                }

                const content = await zip.generateAsync({ type: "blob" });
                saveAs(content, `${campusName}_Progress_Reports.zip`);
                logActivity(userData, 'Downloaded Bulk Progress PDF', { count: studentIds.length, campus: campusName });
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

    const uniqueStudentIds = [...new Set(history.map(h => h.STUD_ID))];
    const uniqueStudents = uniqueStudentIds.length;

    const previewStudentId = uniqueStudentIds[currentStudentIndex];
    const previewRows = previewStudentId
        ? history.filter(h => h.STUD_ID?.toString() === previewStudentId.toString())
        : [];

    const transformedPreviewRows = useMemo(() => {
        if (previewRows.length === 0 || allExams.length === 0) return [];
        return allExams.map(exam => {
            const examTest = exam.Test?.trim();
            const existing = previewRows.find(r => r.Test?.trim() === examTest);
            if (existing) {
                return { ...existing, isAB: false };
            } else {
                return { Test: exam.Test, DATE: exam.DATE, isAB: true };
            }
        });
    }, [previewRows, allExams]);

    const performanceDiagnostics = useMemo(() => {
        return analyzeLaggingSubjectAndLosses(transformedPreviewRows);
    }, [transformedPreviewRows]);

    const chartData = useMemo(() => {
        if (transformedPreviewRows.length === 0) return null;
        const labels = transformedPreviewRows.map(r => r.Test?.trim());
        const total = transformedPreviewRows.map(r => r.isAB ? null : Math.round(Number(r.Tot_720) || 0));

        return {
            labels,
            datasets: [
                {
                    label: 'Total Score (720)',
                    data: total,
                    borderColor: '#1d4ed8',
                    backgroundColor: 'rgba(29, 78, 216, 0.12)',
                    borderWidth: 3,
                    pointRadius: 6,
                    pointBackgroundColor: '#1d4ed8',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    tension: 0.35,
                    fill: true,
                    datalabels: {
                        display: true,
                        align: 'top',
                        color: '#1e3a8a',
                        font: { weight: 'bold', size: 12 },
                        formatter: (val) => val !== null ? val : 'AB'
                    }
                }
            ]
        };
    }, [transformedPreviewRows]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: { display: true, text: 'Student Performance Trend (Total Marks / 720)', font: { size: 16, weight: 'bold' } }
        },
        scales: {
            y: { beginAtZero: true, max: 720, title: { display: true, text: 'Total Marks / 720' } },
            x: { title: { display: true, text: 'Exams' } }
        }
    };

    const handleNext = () => {
        setCurrentStudentIndex(prev => (prev + 1) % uniqueStudents);
    };

    const handlePrev = () => {
        setCurrentStudentIndex(prev => (prev - 1 + uniqueStudents) % uniqueStudents);
    };

    return (
        <div className="average-report-container">
            <div className="card">
                <div className="toolbar">
                    <div>
                        <h3 style={{ margin: 0 }}>Detailed Performance</h3>
                        {uniqueStudents > 1 && (
                            <div className="navigation-status" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                <button className="nav-btn" onClick={handlePrev} title="Previous Student">
                                    <ChevronLeft size={16} />
                                </button>
                                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                                    Student {currentStudentIndex + 1} of {uniqueStudents}
                                </span>
                                <button className="nav-btn" onClick={handleNext} title="Next Student">
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="button-group" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
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
                                <table className="analysis-table merit-style" style={{ fontFamily: 'Bookman, serif', fontSize: '12px' }}>
                                    <thead style={{ fontWeight: 'bold' }}>
                                        <tr className="grouped-header">
                                            <th colSpan={3} className="header-group-blue" style={{ fontSize: '12px' }}>
                                                <div className="header-label" style={{ fontSize: '0.75rem' }}>CAMPUS</div>
                                                <div className="header-value" style={{ fontSize: '1rem' }}>{previewRows[0].CAMPUS_NAME}</div>
                                            </th>
                                            <th colSpan={1} className="header-group-blue" style={{ fontSize: '12px' }}>
                                                <div className="header-label" style={{ fontSize: '0.75rem' }}>STUD ID</div>
                                                <div className="header-value" style={{ fontSize: '1rem' }}>{previewRows[0].STUD_ID}</div>
                                            </th>
                                            <th colSpan={2} className="header-group-blue" style={{ fontSize: '12px' }}>
                                                <div className="header-label" style={{ fontSize: '0.75rem' }}>STREAM</div>
                                                <div className="header-value" style={{ fontSize: '1rem' }}>{getNormalizedStream(previewRows)}</div>
                                            </th>
                                            <th colSpan={3} className="header-group-blue" style={{ fontSize: '12px' }}>
                                                <div className="header-label" style={{ fontSize: '0.75rem' }}>NAME OF THE STUDENT</div>
                                                <div className="header-value" style={{ fontSize: '1rem' }}>
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
                                        {allExams.map((exam, idx) => {
                                            const examTest = exam.Test?.trim();
                                            const row = previewRows.find(r => r.Test?.trim() === examTest);
                                            if (row) {
                                                return (
                                                    <tr key={idx}>
                                                        <td>{row.Test}</td>
                                                        <td>{formatDate(row.DATE)}</td>
                                                        <td className="col-yellow font-bold">{Math.round(row.Tot_720 || 0)}</td>
                                                        <td className="text-brown">{Math.round(row.AIR) || '-'}</td>
                                                        <td className="col-orange">{Math.round(row.Botany || 0)}</td>
                                                        <td className="col-blue-light">{Math.round(row.Zoology || 0)}</td>
                                                        <td className="col-blue-med font-bold">{Math.round((Number(row.Botany || 0) + Number(row.Zoology || 0)))}</td>
                                                        <td className="col-green-pale">{Math.round(row.Physics || 0)}</td>
                                                        <td className="col-pink-pale">{Math.round(row.Chemistry || 0)}</td>
                                                    </tr>
                                                );
                                            } else {
                                                return (
                                                    <tr key={idx}>
                                                        <td>{exam.Test}</td>
                                                        <td>{formatDate(exam.DATE)}</td>
                                                        <td className="text-red font-bold" style={{ color: 'red', fontWeight: 'bold' }}>AB</td>
                                                        <td className="text-red font-bold" style={{ color: 'red', fontWeight: 'bold' }}>AB</td>
                                                        <td className="text-red font-bold" style={{ color: 'red', fontWeight: 'bold' }}>AB</td>
                                                        <td className="text-red font-bold" style={{ color: 'red', fontWeight: 'bold' }}>AB</td>
                                                        <td className="text-red font-bold" style={{ color: 'red', fontWeight: 'bold' }}>AB</td>
                                                        <td className="text-red font-bold" style={{ color: 'red', fontWeight: 'bold' }}>AB</td>
                                                        <td className="text-red font-bold" style={{ color: 'red', fontWeight: 'bold' }}>AB</td>
                                                    </tr>
                                                );
                                            }
                                        })}
                                        {previewRows.length > 0 && (
                                            <tr className="total-row">
                                                <td colSpan={2} className="text-right">AVERAGES</td>
                                                <td className="col-yellow">{Math.round(previewRows.reduce((a, b) => a + (Number(b.Tot_720) || 0), 0) / previewRows.length)}</td>
                                                <td>{Math.round(previewRows.reduce((a, b) => a + (Number(b.AIR) || 0), 0) / previewRows.length)}</td>
                                                <td className="col-orange">{Math.round(previewRows.reduce((a, b) => a + (Number(b.Botany) || 0), 0) / previewRows.length)}</td>
                                                <td className="col-blue-light">{Math.round(previewRows.reduce((a, b) => a + (Number(b.Zoology) || 0), 0) / previewRows.length)}</td>
                                                <td className="col-blue-med">{Math.round(previewRows.reduce((a, b) => a + (Number(b.Botany || 0) + Number(b.Zoology || 0)), 0) / previewRows.length)}</td>
                                                <td className="col-green-pale">{Math.round(previewRows.reduce((a, b) => a + (Number(b.Physics) || 0), 0) / previewRows.length)}</td>
                                                <td className="col-pink-pale">{Math.round(previewRows.reduce((a, b) => a + (Number(b.Chemistry) || 0), 0) / previewRows.length)}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Modern Performance Chart & Lagging Subject Marks Loss Card */}
                        {chartData && performanceDiagnostics && (
                            <div className="ptm-analysis-card" style={{ marginTop: '24px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ height: '340px', marginBottom: '20px' }}>
                                    <Line data={chartData} options={chartOptions} />
                                </div>

                                <div className="ptm-advisory-box" style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '8px', borderLeft: '5px solid #2563eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                                        <TrendingUp size={18} color="#2563eb" /> Performance Diagnostics & Marks Loss Analysis
                                    </h4>

                                    <div style={{ marginBottom: '12px' }}>
                                        <span style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '0.95rem' }}>Primary Lagging Subject: </span>
                                        <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{performanceDiagnostics.laggingSubjectName} ({performanceDiagnostics.laggingAvg}/{performanceDiagnostics.laggingMax})</strong>
                                    </div>

                                    <div style={{ background: '#f1f5f9', padding: '12px 14px', borderRadius: '6px' }}>
                                        <span style={{ fontWeight: 'bold', color: '#1e3a8a', display: 'block', marginBottom: '6px', fontSize: '0.9rem' }}>
                                            Marks Loss in {performanceDiagnostics.laggingSubjectName} across Tests:
                                        </span>
                                        <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', lineHeight: '1.5' }}>
                                            {performanceDiagnostics.marksLossString}
                                        </p>
                                    </div>
                                </div>
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
