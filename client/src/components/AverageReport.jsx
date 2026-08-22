import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle, Target, TrendingUp, Info } from 'lucide-react';
import { logActivity } from '../utils/activityLogger';
import { useAuth } from './auth/AuthProvider';

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    LineController,
    BarController,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    LineController,
    BarController,
    Filler,
    ChartDataLabels
);

// Performance Analysis & Advisory Helper
const analyzeStudentPerformance = (transformedRows, allExams) => {
    if (!transformedRows || transformedRows.length === 0) return null;

    const attempted = transformedRows.filter(r => !r.isAB);
    const count = attempted.length;
    if (count === 0) return null;

    const avgBot = Math.round(attempted.reduce((a, b) => a + (Number(b.Botany) || 0), 0) / count);
    const avgZoo = Math.round(attempted.reduce((a, b) => a + (Number(b.Zoology) || 0), 0) / count);
    const avgBio = avgBot + avgZoo;
    const avgPhy = Math.round(attempted.reduce((a, b) => a + (Number(b.Physics) || 0), 0) / count);
    const avgChem = Math.round(attempted.reduce((a, b) => a + (Number(b.Chemistry) || 0), 0) / count);
    const avgTotal = Math.round(attempted.reduce((a, b) => a + (Number(b.Tot_720) || 0), 0) / count);

    const botPct = (avgBot / 180) * 100;
    const zooPct = (avgZoo / 180) * 100;
    const bioPct = (avgBio / 360) * 100;
    const phyPct = (avgPhy / 180) * 100;
    const chemPct = (avgChem / 180) * 100;

    const subjects = [
        { name: 'Botany', avg: avgBot, max: 180, pct: botPct },
        { name: 'Zoology', avg: avgZoo, max: 180, pct: zooPct },
        { name: 'Physics', avg: avgPhy, max: 180, pct: phyPct },
        { name: 'Chemistry', avg: avgChem, max: 180, pct: chemPct },
    ];

    subjects.sort((a, b) => a.pct - b.pct);
    const weakest = subjects[0];
    const secondWeakest = subjects[1];
    const strongest = subjects[subjects.length - 1];

    const absents = allExams ? (allExams.length - count) : 0;

    const recommendations = [];

    if (weakest.pct < 70) {
        recommendations.push({
            type: 'warning',
            title: `Primary Focus: ${weakest.name} (Lagging)`,
            text: `Averaging ${weakest.avg}/${weakest.max} (${weakest.pct.toFixed(1)}%). Requires focused numerical practice and formula revision.`
        });
    } else {
        recommendations.push({
            type: 'info',
            title: `Lowest Subject: ${weakest.name}`,
            text: `Averaging ${weakest.avg}/${weakest.max} (${weakest.pct.toFixed(1)}%). Focused revision can push score to 85%+`
        });
    }

    if (secondWeakest.pct < 75 && secondWeakest.name !== weakest.name) {
        recommendations.push({
            type: 'warning',
            title: `Secondary Focus: ${secondWeakest.name}`,
            text: `Averaging ${secondWeakest.avg}/${secondWeakest.max} (${secondWeakest.pct.toFixed(1)}%). Pay extra attention to test error analysis.`
        });
    }

    recommendations.push({
        type: 'success',
        title: `Strongest Area: ${strongest.name}`,
        text: `Performing well at ${strongest.avg}/${strongest.max} (${strongest.pct.toFixed(1)}%). Maintain momentum while practicing weak subjects.`
    });

    const targetGain = Math.max(0, Math.round((0.80 - (weakest.pct / 100)) * weakest.max));
    if (targetGain > 10) {
        recommendations.push({
            type: 'target',
            title: `PTM Action Plan`,
            text: `Raising ${weakest.name} to 80% (+${targetGain} marks) will boost overall average from ${avgTotal} to ${avgTotal + targetGain}/720.`
        });
    }

    if (absents > 0) {
        recommendations.push({
            type: 'caution',
            title: `Attendance Note`,
            text: `Student missed ${absents} test(s). Regular attendance is essential for continuous score improvement.`
        });
    }

    return {
        avgTotal,
        avgBot,
        avgZoo,
        avgBio,
        avgPhy,
        avgChem,
        botPct,
        zooPct,
        bioPct,
        phyPct,
        chemPct,
        weakest,
        secondWeakest,
        strongest,
        attemptedCount: count,
        totalExamsCount: allExams ? allExams.length : count,
        recommendations
    };
};

// Canvas Chart Data URL generator for PDF
const generateChartImage = (transformedRows) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1600;
        canvas.height = 650;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const labels = [];
        const totalScores = [];
        const bioScores = [];
        const phyScores = [];
        const chemScores = [];

        transformedRows.forEach(row => {
            labels.push(row.Test?.trim() || '');
            if (!row.isAB) {
                totalScores.push(Math.round(Number(row.Tot_720) || 0));
                const bot = Number(row.Botany) || 0;
                const zoo = Number(row.Zoology) || 0;
                bioScores.push(Math.round(bot + zoo));
                phyScores.push(Math.round(Number(row.Physics) || 0));
                chemScores.push(Math.round(Number(row.Chemistry) || 0));
            } else {
                totalScores.push(null);
                bioScores.push(null);
                phyScores.push(null);
                chemScores.push(null);
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
                        borderColor: '#0070C0',
                        backgroundColor: 'rgba(0, 112, 192, 0.08)',
                        borderWidth: 3,
                        pointRadius: 6,
                        pointBackgroundColor: '#0070C0',
                        tension: 0.25,
                        fill: true,
                        datalabels: {
                            display: true,
                            align: 'top',
                            anchor: 'end',
                            color: '#0070C0',
                            font: { weight: 'bold', size: 13 },
                            formatter: (val) => val !== null ? val : 'AB'
                        }
                    },
                    {
                        label: 'Biology (360)',
                        data: bioScores,
                        borderColor: '#8b5cf6',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: '#8b5cf6',
                        tension: 0.2,
                        fill: false,
                        datalabels: { display: false }
                    },
                    {
                        label: 'Physics (180)',
                        data: phyScores,
                        borderColor: '#10b981',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: '#10b981',
                        tension: 0.2,
                        fill: false,
                        datalabels: { display: false }
                    },
                    {
                        label: 'Chemistry (180)',
                        data: chemScores,
                        borderColor: '#ef4444',
                        borderWidth: 2,
                        pointRadius: 4,
                        pointBackgroundColor: '#ef4444',
                        tension: 0.2,
                        fill: false,
                        datalabels: { display: false }
                    }
                ]
            },
            options: {
                responsive: false,
                animation: false,
                layout: {
                    padding: { top: 25, right: 25, bottom: 10, left: 15 }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'STUDENT PERFORMANCE TREND (PTM SUMMARY CHART)',
                        font: { size: 20, weight: 'bold' },
                        color: '#0f172a',
                        padding: { top: 10, bottom: 15 }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: { size: 13, weight: 'bold' },
                            padding: 15,
                            usePointStyle: true
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 720,
                        ticks: { stepSize: 100, font: { size: 12, weight: 'bold' } },
                        title: { display: true, text: 'Marks Scored', font: { size: 14, weight: 'bold' } },
                        grid: { color: '#e2e8f0' }
                    },
                    x: {
                        title: { display: true, text: 'Test Name', font: { size: 14, weight: 'bold' } },
                        grid: { color: '#f1f5f9' },
                        ticks: { font: { size: 12, weight: 'bold' } }
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

        // Dynamic Header Box (Student Info) with Font Scaling & Word Wrapping Fix
        if (studentData.length > 0) {
            const student = studentData[0];
            const normalizedStream = getNormalizedStream(studentData);

            const col1X = marginX + 6; // 16mm
            const col2X = marginX + 98; // 108mm
            const col1ValX = col1X + 30; // 46mm
            const col2ValX = col2X + 22; // 130mm

            const maxNameWidth = col2X - col1ValX - 3; // 59mm
            const nameStr = (student.NAME_OF_THE_STUDENT || '').toUpperCase().trim();
            const campusStr = (student.CAMPUS_NAME || '').toUpperCase().trim();

            if (bookmanFont) doc.setFont("Bookman", "bold");
            else doc.setFont("helvetica", "bold");

            let nameFontSize = 11;
            doc.setFontSize(nameFontSize);
            let nameWidth = doc.getTextWidth(nameStr);

            if (nameWidth > maxNameWidth) {
                const scaledSize = Math.max(8.5, Math.floor((maxNameWidth / nameWidth) * 11 * 10) / 10);
                doc.setFontSize(scaledSize);
                nameWidth = doc.getTextWidth(nameStr);
                if (nameWidth <= maxNameWidth) {
                    nameFontSize = scaledSize;
                }
            }

            doc.setFontSize(nameFontSize);
            let nameLines = [nameStr];
            if (doc.getTextWidth(nameStr) > maxNameWidth) {
                nameLines = doc.splitTextToSize(nameStr, maxNameWidth);
            }

            const maxCampusWidth = (pageWidth - marginX - 5) - col2ValX;
            let campusFontSize = 11;
            doc.setFontSize(campusFontSize);
            if (doc.getTextWidth(campusStr) > maxCampusWidth) {
                campusFontSize = Math.max(8.5, Math.floor((maxCampusWidth / doc.getTextWidth(campusStr)) * 11 * 10) / 10);
            }

            const nameLineCount = nameLines.length;
            const extraHeight = (nameLineCount - 1) * 5;
            const boxHeight = 24 + extraHeight;

            doc.setFillColor(239, 246, 255);
            doc.setDrawColor(0, 0, 0);
            doc.setLineWidth(0.1);
            doc.roundedRect(marginX, currentY, contentWidth, boxHeight, 1, 1, 'FD');

            const textYStart = currentY + 8;

            // Student Name
            if (bookmanFont) doc.setFont("Bookman", "bold");
            else doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.text("Student Name:", col1X, textYStart);

            if (bookmanFont) doc.setFont("Bookman", "bold");
            else doc.setFont("helvetica", "normal");
            doc.setFontSize(nameFontSize);
            nameLines.forEach((line, idx) => {
                doc.text(line, col1ValX, textYStart + (idx * 5));
            });

            // Campus
            if (bookmanFont) doc.setFont("Bookman", "bold");
            else doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("Campus:", col2X, textYStart);

            if (bookmanFont) doc.setFont("Bookman", "bold");
            else doc.setFont("helvetica", "normal");
            doc.setFontSize(campusFontSize);
            doc.text(campusStr, col2ValX, textYStart);

            // Row 2: Student ID & Stream
            const row2Y = textYStart + 9 + (nameLineCount - 1) * 5;

            if (bookmanFont) doc.setFont("Bookman", "bold");
            else doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
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

        // 6. PTM Chart & Detailed Subject Advisory Section
        if (chartImgData) {
            const chartHeight = 58;
            const advisoryHeight = 35;
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
                doc.text("PARENT TEACHER MEETING (PTM) - PERFORMANCE & IMPROVEMENT ADVISORY", 105, chartStartY, { align: 'center' });

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
                doc.text("PTM PERFORMANCE TREND CHART", marginX, chartStartY);
                chartStartY += 4;
            }

            // Render Chart Image
            doc.addImage(chartImgData, 'PNG', marginX, chartStartY, contentWidth, chartHeight);

            // Render Detailed PTM Subject Advisory Box
            const advisoryY = chartStartY + chartHeight + 4;
            const analysis = analyzeStudentPerformance(transformedRows, allExams);

            if (analysis) {
                doc.setFillColor(248, 250, 252);
                doc.setDrawColor(203, 213, 225);
                doc.roundedRect(marginX, advisoryY, contentWidth, advisoryHeight, 1, 1, 'FD');

                // Advisory Title Header Bar
                doc.setFillColor(224, 231, 255);
                doc.rect(marginX, advisoryY, contentWidth, 7, 'F');
                doc.setDrawColor(203, 213, 225);
                doc.line(marginX, advisoryY + 7, marginX + contentWidth, advisoryY + 7);

                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setFontSize(9.5);
                doc.setTextColor(30, 58, 138);
                doc.text("PTM SUBJECT PERFORMANCE DIAGNOSTICS & IMPROVEMENT ADVISORY", marginX + 4, advisoryY + 5);

                let lineY = advisoryY + 11.5;

                // Row 1: Subject Averages Summary
                if (bookmanFont) doc.setFont("Bookman", "normal");
                else doc.setFont("helvetica", "normal");
                doc.setFontSize(8.5);
                doc.setTextColor(30, 41, 59);

                const subjSummary = `Subject Averages:  Botany: ${analysis.avgBot}/180 (${analysis.botPct.toFixed(0)}%)  |  Zoology: ${analysis.avgZoo}/180 (${analysis.zooPct.toFixed(0)}%)  |  Physics: ${analysis.avgPhy}/180 (${analysis.phyPct.toFixed(0)}%)  |  Chemistry: ${analysis.avgChem}/180 (${analysis.chemPct.toFixed(0)}%)`;
                doc.text(subjSummary, marginX + 4, lineY);
                lineY += 5.5;

                // Row 2: Lagging Subject Diagnosis
                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setTextColor(185, 28, 28);
                doc.text("Primary Lagging Subject: ", marginX + 4, lineY);

                if (bookmanFont) doc.setFont("Bookman", "normal");
                else doc.setFont("helvetica", "normal");
                doc.setTextColor(30, 41, 59);
                const lagMsg = `${analysis.weakest.name} is the lowest scoring area at ${analysis.weakest.avg}/${analysis.weakest.max} (${analysis.weakest.pct.toFixed(1)}%). Requires extra numerical practice & doubt resolution.`;
                doc.text(lagMsg, marginX + 46, lineY);
                lineY += 5.5;

                // Row 3: Strongest Subject
                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setTextColor(21, 128, 61);
                doc.text("Strongest Subject: ", marginX + 4, lineY);

                if (bookmanFont) doc.setFont("Bookman", "normal");
                else doc.setFont("helvetica", "normal");
                doc.setTextColor(30, 41, 59);
                const strongMsg = `${analysis.strongest.name} is performing well at ${analysis.strongest.avg}/${analysis.strongest.max} (${analysis.strongest.pct.toFixed(1)}%). Maintain regular revision while focusing on weak topics.`;
                doc.text(strongMsg, marginX + 38, lineY);
                lineY += 5.5;

                // Row 4: Score Boost Target Plan
                const targetGain = Math.max(0, Math.round((0.80 - (analysis.weakest.pct / 100)) * analysis.weakest.max));
                if (bookmanBoldFont) doc.setFont("Bookman", "bold");
                else doc.setFont("helvetica", "bold");
                doc.setTextColor(67, 56, 202);
                doc.text("PTM Action Plan: ", marginX + 4, lineY);

                if (bookmanFont) doc.setFont("Bookman", "normal");
                else doc.setFont("helvetica", "normal");
                doc.setTextColor(30, 41, 59);
                const planMsg = `Improving ${analysis.weakest.name} to 80% (+${targetGain} marks) will elevate overall score from ${analysis.avgTotal} to ${analysis.avgTotal + targetGain}/720.`;
                doc.text(planMsg, marginX + 34, lineY);
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

    const performanceAnalysis = useMemo(() => {
        return analyzeStudentPerformance(transformedPreviewRows, allExams);
    }, [transformedPreviewRows, allExams]);

    const chartData = useMemo(() => {
        if (transformedPreviewRows.length === 0) return null;
        const labels = transformedPreviewRows.map(r => r.Test?.trim());
        const total = transformedPreviewRows.map(r => r.isAB ? null : Math.round(Number(r.Tot_720) || 0));
        const bio = transformedPreviewRows.map(r => r.isAB ? null : Math.round((Number(r.Botany) || 0) + (Number(r.Zoology) || 0)));
        const phy = transformedPreviewRows.map(r => r.isAB ? null : Math.round(Number(r.Physics) || 0));
        const chem = transformedPreviewRows.map(r => r.isAB ? null : Math.round(Number(r.Chemistry) || 0));

        return {
            labels,
            datasets: [
                {
                    label: 'Total Score (720)',
                    data: total,
                    borderColor: '#0070C0',
                    backgroundColor: 'rgba(0, 112, 192, 0.08)',
                    borderWidth: 3,
                    pointRadius: 5,
                    pointBackgroundColor: '#0070C0',
                    tension: 0.25,
                    fill: true,
                    datalabels: {
                        display: true,
                        align: 'top',
                        color: '#0070C0',
                        font: { weight: 'bold', size: 11 },
                        formatter: (val) => val !== null ? val : 'AB'
                    }
                },
                {
                    label: 'Biology (360)',
                    data: bio,
                    borderColor: '#8b5cf6',
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.2,
                    fill: false,
                    datalabels: { display: false }
                },
                {
                    label: 'Physics (180)',
                    data: phy,
                    borderColor: '#10b981',
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.2,
                    fill: false,
                    datalabels: { display: false }
                },
                {
                    label: 'Chemistry (180)',
                    data: chem,
                    borderColor: '#ef4444',
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.2,
                    fill: false,
                    datalabels: { display: false }
                }
            ]
        };
    }, [transformedPreviewRows]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { font: { weight: 'bold' } } },
            title: { display: true, text: 'Parent Teacher Meeting (PTM) Performance Trend', font: { size: 16, weight: 'bold' } }
        },
        scales: {
            y: { beginAtZero: true, max: 720, title: { display: true, text: 'Marks' } },
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

                        {/* PTM Performance Chart & Subject Advisory Card */}
                        {chartData && performanceAnalysis && (
                            <div className="ptm-analysis-card" style={{ marginTop: '24px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ height: '320px', marginBottom: '20px' }}>
                                    <Line data={chartData} options={chartOptions} />
                                </div>

                                <div className="ptm-advisory-box" style={{ background: '#ffffff', padding: '16px 20px', borderRadius: '8px', borderLeft: '5px solid #6366f1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                                        <TrendingUp size={18} color="#6366f1" /> Parent Teacher Meeting (PTM) Subject Diagnostics & Improvement Advisory
                                    </h4>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                                        <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '6px' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Botany Average</span>
                                            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{performanceAnalysis.avgBot} / 180 ({performanceAnalysis.botPct.toFixed(0)}%)</strong>
                                        </div>
                                        <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '6px' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Zoology Average</span>
                                            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{performanceAnalysis.avgZoo} / 180 ({performanceAnalysis.zooPct.toFixed(0)}%)</strong>
                                        </div>
                                        <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '6px' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Physics Average</span>
                                            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{performanceAnalysis.avgPhy} / 180 ({performanceAnalysis.phyPct.toFixed(0)}%)</strong>
                                        </div>
                                        <div style={{ background: '#f1f5f9', padding: '10px 14px', borderRadius: '6px' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block' }}>Chemistry Average</span>
                                            <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{performanceAnalysis.avgChem} / 180 ({performanceAnalysis.chemPct.toFixed(0)}%)</strong>
                                        </div>
                                    </div>

                                    <div className="recommendations-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        {performanceAnalysis.recommendations.map((rec, idx) => (
                                            <div key={idx} style={{
                                                padding: '10px 14px',
                                                borderRadius: '6px',
                                                fontSize: '0.88rem',
                                                display: 'flex',
                                                alignItems: 'flex-start',
                                                gap: '10px',
                                                backgroundColor: rec.type === 'warning' ? '#fef2f2' : rec.type === 'success' ? '#f0fdf4' : rec.type === 'target' ? '#eef2ff' : '#fffbeb',
                                                color: rec.type === 'warning' ? '#991b1b' : rec.type === 'success' ? '#166534' : rec.type === 'target' ? '#3730a3' : '#92400e',
                                                border: `1px solid ${rec.type === 'warning' ? '#fecaca' : rec.type === 'success' ? '#bbf7d0' : rec.type === 'target' ? '#c7d2fe' : '#fef08a'}`
                                            }}>
                                                {rec.type === 'warning' && <AlertTriangle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />}
                                                {rec.type === 'success' && <CheckCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />}
                                                {rec.type === 'target' && <Target size={16} style={{ marginTop: '2px', flexShrink: 0 }} />}
                                                {rec.type === 'caution' && <Info size={16} style={{ marginTop: '2px', flexShrink: 0 }} />}
                                                <div>
                                                    <strong>{rec.title}: </strong> {rec.text}
                                                </div>
                                            </div>
                                        ))}
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
