import React, { useState, useEffect, useMemo, useRef } from 'react';
import Modal from './Modal';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import { ChevronLeft, ChevronRight, TrendingUp, Maximize2, X, Edit3, Camera, Trash2, Upload, Check } from 'lucide-react';
import { logActivity } from '../utils/activityLogger';
import { useAuth } from './auth/AuthProvider';

const SUBJECT_ORDER = {
    "BOTANY": 1,
    "ZOOLOGY": 2,
    "PHYSICS": 3,
    "CHEMISTRY": 4
};
const getSubjectOrder = (sub) => SUBJECT_ORDER[String(sub || '').trim().toUpperCase()] || 99;

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
            return { testName, lossText: `AB (-${lagging.max})`, isAB: true };
        }
        const scored = Math.round(Number(row[lagging.key]) || 0);
        const loss = lagging.max - scored;
        return { testName, lossText: `-${loss}`, isAB: false };
    });

    return {
        laggingSubjectName: lagging.name,
        laggingAvg: lagging.avg,
        laggingMax: lagging.max,
        testLosses
    };
};

const getStudentInitials = (name) => {
    if (!name) return 'SC';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'SC';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const getReportDateStr = () => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const compressImage = (file, maxWidth = 450, maxHeight = 550, quality = 0.85) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let { width, height } = img;
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

const generateDynamicRemarks = (studentName, transformedRows, performanceDiagnostics, erpQuestions = []) => {
    if (!transformedRows || transformedRows.length === 0) {
        return `${studentName} has active enrolment. Test records are being consolidated.`;
    }
    const attended = transformedRows.filter(r => !r.isAB);
    const count = attended.length;
    if (count === 0) {
        return `${studentName} has not attended any examinations recorded in the current period. Consistent attendance is strongly advised.`;
    }

    const avgTotal = Math.round(attended.reduce((a, b) => a + (Number(b.Tot_720) || 0), 0) / count);

    // Find best AIR
    const airs = attended.map(r => Number(r.AIR)).filter(n => !isNaN(n) && n > 0);
    const bestAir = airs.length > 0 ? Math.min(...airs) : null;

    // Subjects averages
    const avgBot = Math.round(attended.reduce((a, b) => a + (Number(b.Botany) || 0), 0) / count);
    const avgZoo = Math.round(attended.reduce((a, b) => a + (Number(b.Zoology) || 0), 0) / count);
    const avgPhy = Math.round(attended.reduce((a, b) => a + (Number(b.Physics) || 0), 0) / count);
    const avgChem = Math.round(attended.reduce((a, b) => a + (Number(b.Chemistry) || 0), 0) / count);

    const subjects = [
        { name: 'Botany', avg: avgBot, max: 180, pct: (avgBot / 180) * 100 },
        { name: 'Zoology', avg: avgZoo, max: 180, pct: (avgZoo / 180) * 100 },
        { name: 'Physics', avg: avgPhy, max: 180, pct: (avgPhy / 180) * 100 },
        { name: 'Chemistry', avg: avgChem, max: 180, pct: (avgChem / 180) * 100 }
    ];

    subjects.sort((a, b) => b.pct - a.pct); // Highest first

    const top1 = subjects[0];
    const top2 = subjects[1];
    const low1 = subjects[3]; // Lagging
    const low2 = subjects[2]; // Second lowest

    let tone = "a strong and steady";
    if (avgTotal >= 650) tone = "an outstanding and highly consistent";
    else if (avgTotal >= 600) tone = "a strong and steady";
    else if (avgTotal >= 500) tone = "a good and promising";
    else if (avgTotal >= 400) tone = "a steady";
    else tone = "a foundational";

    const airStr = bestAir ? ` and reaching an All India Rank of ${bestAir}` : '';

    let topicHint = '';
    if (erpQuestions && erpQuestions.length > 0) {
        const laggingTopics = erpQuestions
            .filter(q => String(q.subject || '').toUpperCase() === low1.name.toUpperCase())
            .map(q => q.topic)
            .filter(Boolean);
        if (laggingTopics.length > 0) {
            const uniqueTopics = [...new Set(laggingTopics)];
            topicHint = `, particularly ${uniqueTopics.slice(0, 2).join(' & ')} topics,`;
        }
    }
    if (!topicHint && low1.name === 'Chemistry') topicHint = ', particularly organic topics,';
    if (!topicHint && low1.name === 'Physics') topicHint = ', particularly numerical problem-solving,';

    return `${studentName} has maintained ${tone} record this year, averaging ${avgTotal} out of 720 across ${count} tests${airStr}. ${top1.name} and ${top2.name} are consistently excellent. ${low1.name}${topicHint} and ${low2.name} deserve extra practice to lift an already impressive score further.`;
};

// Canvas Chart Generator with exact 10.3pt PDF Font Size ONLY (46px canvas size) & High-Contrast Dark Slate Navy Labels
const generateChartImage = (transformedRows) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = 2400;
        canvas.height = 950;
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

        try {
            const chart = new ChartJS(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [
                        {
                            label: 'Total Score (720)',
                            data: totalScores,
                            borderColor: '#1d4ed8',
                            backgroundColor: 'rgba(29, 78, 216, 0.10)',
                            borderWidth: 5,
                            pointRadius: 10,
                            pointHoverRadius: 13,
                            pointBackgroundColor: '#1d4ed8',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2.5,
                            tension: 0.35,
                            fill: true,
                            datalabels: {
                                display: true,
                                align: 'top',
                                anchor: 'end',
                                offset: 10,
                                color: '#0f172a',
                                backgroundColor: '#ffffff',
                                borderColor: '#94a3b8',
                                borderWidth: 2,
                                borderRadius: 8,
                                padding: { top: 4, bottom: 4, left: 8, right: 8 },
                                font: { weight: 'bold', size: 46 },
                                formatter: (val) => val !== null ? val : 'AB'
                            }
                        }
                    ]
                },
                options: {
                    responsive: false,
                    animation: false,
                    layout: {
                        padding: { top: 85, right: 70, bottom: 25, left: 80 }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: 'Student Performance Trend (Total Marks / 720)',
                            font: { size: 44, weight: 'bold' },
                            color: '#0f172a',
                            padding: { top: 15, bottom: 30 }
                        },
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 800,
                            ticks: { stepSize: 100, font: { size: 32, weight: 'bold' }, color: '#334155', padding: 12 },
                            title: { display: true, text: 'Total Marks / 720', font: { size: 34, weight: 'bold' }, color: '#0f172a', padding: { bottom: 12 } },
                            grid: { color: '#cbd5e1', lineWidth: 1.5 }
                        },
                        x: {
                            offset: true,
                            title: { display: true, text: 'Exams', font: { size: 34, weight: 'bold' }, color: '#0f172a', padding: { top: 15 } },
                            grid: { color: '#e2e8f0', lineWidth: 1.5 },
                            ticks: { font: { size: 32, weight: 'bold' }, color: '#1e293b' }
                        }
                    }
                },
                plugins: [ChartDataLabels]
            });

            const dataUrl = canvas.toDataURL('image/png');
            chart.destroy();
            canvas.width = 0;
            canvas.height = 0;
            resolve(dataUrl);
        } catch (chartErr) {
            console.warn("[Bulk PDF] Chart generation error for student, continuing without chart:", chartErr);
            resolve(null);
        }
    });
};

const AverageReport = ({ filters }) => {
    const { userData } = useAuth();
    const [history, setHistory] = useState([]);
    const [allExams, setAllExams] = useState([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
    const [includeChart, setIncludeChart] = useState(true); // Toggle to include or exclude chart & diagnostics
    const [includeTopicDetails, setIncludeTopicDetails] = useState(true); // Toggle to include or exclude Topic & Subtopic details
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
    const [isExcelDownloading, setIsExcelDownloading] = useState(false);
    const [excelProgress, setExcelProgress] = useState({ current: 0, total: 0 });
    const [modal, setModal] = useState({ isOpen: false, type: 'info', title: '', message: '' });
    const [whatsappNumber, setWhatsappNumber] = useState('');

    const [studentErpQuestions, setStudentErpQuestions] = useState([]);
    // Student Photo state (stored directly in TiDB database)
    const [currentPhoto, setCurrentPhoto] = useState(null);
    const [photoUploading, setPhotoUploading] = useState(false);
    const photoInputRef = useRef(null);

    // Custom Remarks state
    const [customRemarks, setCustomRemarks] = useState({});
    const [isEditingRemarks, setIsEditingRemarks] = useState(false);
    const [tempRemarksText, setTempRemarksText] = useState('');
    const [toastMessage, setToastMessage] = useState(null);
    const [erpLoading, setErpLoading] = useState(false);
    const [zoomImage, setZoomImage] = useState(null);

    // Key editing states
    const [editingKeyItem, setEditingKeyItem] = useState(null);
    const [newKeyValue, setNewKeyValue] = useState('');
    const [isUpdatingKey, setIsUpdatingKey] = useState(false);

    const handleEditKey = (q) => {
        setEditingKeyItem(q);
        setNewKeyValue(q.keyValue || '');
    };

    const saveUpdatedKey = async () => {
        if (!editingKeyItem) return;
        setIsUpdatingKey(true);
        try {
            const year = filters.academicYear || '2026';
            const res = await fetch(`${API_URL}/api/erp/update-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    academicYear: year,
                    test: editingKeyItem.test,
                    qNo: editingKeyItem.qNo,
                    subject: editingKeyItem.subject,
                    newKey: newKeyValue.trim()
                })
            });

            if (!res.ok) throw new Error('Failed to update key in database.');

            const updatedVal = newKeyValue.trim();

            setStudentErpQuestions(prev => prev.map(q => {
                if (q.test === editingKeyItem.test && String(q.qNo) === String(editingKeyItem.qNo) && String(q.subject).toUpperCase() === String(editingKeyItem.subject).toUpperCase()) {
                    return { ...q, keyValue: updatedVal };
                }
                return q;
            }));

            setEditingKeyItem(null);
            logActivity(userData, 'Updated Answer Key', { test: editingKeyItem.test, qNo: editingKeyItem.qNo, subject: editingKeyItem.subject, newKey: updatedVal });
        } catch (err) {
            console.error("Key update error:", err);
            setModal({
                isOpen: true,
                type: 'danger',
                title: 'Update Error',
                message: 'Failed to update key in database.',
                onClose: () => setModal(p => ({ ...p, isOpen: false }))
            });
        } finally {
            setIsUpdatingKey(false);
        }
    };

    // Zoom and pan states for question preview
    const [zoomScale, setZoomScale] = useState(1);
    const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const zoomContainerRef = useRef(null);

    useEffect(() => {
        setZoomScale(1);
        setZoomOffset({ x: 0, y: 0 });
        setIsDragging(false);
    }, [zoomImage]);

    useEffect(() => {
        setHistory([]);
        setAllExams([]);
        setHasSearched(false);
        setCurrentStudentIndex(0);
    }, [filters.campus, filters.stream, filters.testType, filters.test, filters.topAll, filters.studentSearch]);

    const fetchStudentErpQuestionsForPdf = async (studId, studentName = '') => {
        if (!studId && !studentName) return [];
        try {
            const params = buildQueryParams(filters);
            params.delete('studentSearch');
            params.delete('studentNames');
            if (studId) params.append('studentSearch', studId);
            if (studentName) params.append('studentNames', studentName);

            const res = await fetch(`${API_URL}/api/erp/report?${params.toString()}`);
            const data = await res.json();
            let safeData = Array.isArray(data) ? data : [];

            if (filters?.test && Array.isArray(filters.test) && filters.test.length > 0 && filters.test[0] !== '__ALL__') {
                const filterTestsLower = filters.test.map(t => String(t).trim().toLowerCase());
                safeData = safeData.filter(r => {
                    const tLower = String(r.Test || '').trim().toLowerCase();
                    return filterTestsLower.some(ft => ft === tLower || tLower.includes(ft) || ft.includes(tLower));
                });
            }

            let qList = [];

            if (safeData.length > 0) {
                qList = safeData.map(row => {
                    const status = String(row.W_U || '').trim().toUpperCase();
                    return {
                        test: row.Test,
                        qNo: row.Q_No,
                        subject: row.Subject,
                        topic: row.Topic || 'Unknown Topic',
                        subTopic: row.Sub_Topic || '',
                        status: status,
                        lost: status === 'W' ? 5 : 4,
                        qUrl: row.Q_URL,
                        sUrl: row.S_URL,
                        keyValue: row.Key_Value
                    };
                });
            }

            qList.sort((a, b) => {
                const tComp = String(a.test || '').localeCompare(String(b.test || ''));
                if (tComp !== 0) return tComp;
                const subComp = getSubjectOrder(a.subject) - getSubjectOrder(b.subject);
                if (subComp !== 0) return subComp;
                const topicComp = String(a.topic || '').localeCompare(String(b.topic || ''));
                if (topicComp !== 0) return topicComp;
                return (parseInt(a.qNo) || 0) - (parseInt(b.qNo) || 0);
            });
            return qList;
        } catch (e) {
            console.error("Failed to fetch student ERP questions:", e);
            return [];
        }
    };

    const fetchData = async () => {
        const effectiveCampus = (filters.campus && filters.campus.length > 0) ? filters.campus : (filters._allowedCampuses || []);

        // Allow generating if either studentSearch is specified OR campus/stream filter is active
        if ((!filters.studentSearch || filters.studentSearch.length === 0) && (!effectiveCampus || effectiveCampus.length === 0) && (!filters.stream || filters.stream.length === 0)) {
            setModal({
                isOpen: true,
                type: 'info',
                title: 'Select Filter',
                message: 'Please select a Campus, Stream, or Student from the filters first.',
                onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
            });
            return;
        }

        setLoading(true);
        setHasSearched(true);
        try {
            const bodyPayload = {
                ...filters,
                campus: effectiveCampus,
                includeExams: 'true',
                academicYear: filters.academicYear || '2026'
            };

            // Use POST to avoid HTTP GET URL length limit (8KB) when hundreds of students are selected
            const response = await fetch(`${API_URL}/api/history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `Status: ${response.status}`);
            }
            const data = await response.json();

            const historyData = data.history || [];
            const examData = data.allExams || [];

            if (historyData.length === 0) {
                setModal({
                    isOpen: true,
                    type: 'info',
                    title: 'No Data Found',
                    message: 'No student progress records found for the selected filter criteria.',
                    onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
                });
            }

            setHistory(historyData);
            setAllExams(examData);
            setCurrentStudentIndex(0);

            const studentCount = new Set(historyData.map(h => h.STUD_ID)).size;
            logActivity(userData, 'Generated Progress Report', {
                studentCount,
                campus: effectiveCampus
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

    const generateStudentPDF = (
        studentData,
        logoImg,
        fonts,
        studentPhoto,
        chartImgData,
        transformedRows,
        isChartIncluded,
        erpQuestions = [],
        isTopicDetailsIncluded = true,
        customRemarksText = null
    ) => {
        const doc = new jsPDF('p', 'mm', 'a4');

        if (fonts?.oswaldBold) {
            doc.addFileToVFS("Oswald-Bold.ttf", fonts.oswaldBold);
            doc.addFont("Oswald-Bold.ttf", "Oswald", "bold");
        }
        if (fonts?.libreBaskerville) {
            doc.addFileToVFS("LibreBaskerville-Regular.ttf", fonts.libreBaskerville);
            doc.addFont("LibreBaskerville-Regular.ttf", "LibreBaskerville", "normal");
        }
        if (fonts?.cormorantBold) {
            doc.addFileToVFS("CormorantGaramond-Bold.ttf", fonts.cormorantBold);
            doc.addFont("CormorantGaramond-Bold.ttf", "CormorantGaramond", "bold");
        }
        if (fonts?.cormorantItalic) {
            doc.addFileToVFS("CormorantGaramond-Italic.ttf", fonts.cormorantItalic);
            doc.addFont("CormorantGaramond-Italic.ttf", "CormorantGaramond", "italic");
        }
        if (fonts?.nunitoRegular) {
            doc.addFileToVFS("NunitoSans-Regular.ttf", fonts.nunitoRegular);
            doc.addFont("NunitoSans-Regular.ttf", "NunitoSans", "normal");
        }
        if (fonts?.nunitoExtraBold || fonts?.nunitoBold || fonts?.nunitoSemiBold) {
            doc.addFileToVFS("NunitoSans-Bold.ttf", fonts.nunitoExtraBold || fonts.nunitoBold || fonts.nunitoSemiBold);
            doc.addFont("NunitoSans-Bold.ttf", "NunitoSans", "bold");
        }

        const setFontOswald = () => {
            if (fonts?.oswaldBold) doc.setFont("Oswald", "bold");
            else doc.setFont("helvetica", "bold");
        };
        const setFontLibreBaskerville = () => {
            if (fonts?.libreBaskerville) doc.setFont("LibreBaskerville", "normal");
            else doc.setFont("times", "normal");
        };
        const setFontCormorantBold = () => {
            if (fonts?.cormorantBold) doc.setFont("CormorantGaramond", "bold");
            else doc.setFont("times", "bold");
        };
        const setFontCormorantItalic = () => {
            if (fonts?.cormorantItalic) doc.setFont("CormorantGaramond", "italic");
            else doc.setFont("times", "italic");
        };
        const setFontNunitoRegular = () => {
            if (fonts?.nunitoRegular) doc.setFont("NunitoSans", "normal");
            else doc.setFont("helvetica", "normal");
        };
        const setFontNunitoBold = () => {
            if (fonts?.nunitoExtraBold || fonts?.nunitoBold || fonts?.nunitoSemiBold) doc.setFont("NunitoSans", "bold");
            else doc.setFont("helvetica", "bold");
        };

        const drawPageBorderAndBackground = () => {
            const pageWidth = 210;
            const pageHeight = 297;
            // Warm off-white sheet background: #FFFDF8 -> [255, 253, 248]
            doc.setFillColor(255, 253, 248);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');

            // Outer gold border: #C9962B -> [201, 150, 43], 2px -> 0.7mm
            doc.setDrawColor(201, 150, 43);
            doc.setLineWidth(0.7);
            doc.rect(7.5, 7.5, pageWidth - 15, pageHeight - 15, 'S');

            // Inner thin line: #C9962B, 0.25mm
            doc.setLineWidth(0.25);
            doc.rect(9.2, 9.2, pageWidth - 18.4, pageHeight - 18.4, 'S');
        };

        // Draw frame on page 1
        drawPageBorderAndBackground();

        const student = studentData[0] || {};
        const studentName = student.NAME_OF_THE_STUDENT || '';
        const studentId = String(student.STUD_ID || '');
        const campus = student.CAMPUS_NAME || '';
        const stream = getNormalizedStream(studentData);

        // 1. Logo
        if (logoImg) {
            const logoW = 18;
            const logoH = 18;
            const logoX = (210 - logoW) / 2;
            doc.addImage(logoImg, 'PNG', logoX, 12, logoW, logoH, undefined, 'FAST');
        }

        // 2. Title
        const titleY = 34.5;
        setFontOswald();
        doc.setFontSize(22);
        doc.setTextColor(10, 79, 196); // #0A4FC4
        const w1 = doc.getTextWidth("Sri Chaitanya ");

        setFontLibreBaskerville();
        doc.setFontSize(17); // ~78% of 22
        doc.setTextColor(26, 99, 200); // #1A63C8
        const w2 = doc.getTextWidth("Educational Institutions");

        const startX = (210 - (w1 + w2)) / 2;

        setFontOswald();
        doc.setFontSize(22);
        doc.setTextColor(10, 79, 196);
        doc.text("Sri Chaitanya ", startX, titleY);

        setFontLibreBaskerville();
        doc.setFontSize(17);
        doc.setTextColor(26, 99, 200);
        doc.text("Educational Institutions", startX + w1, titleY);

        // 3. Ribbon: PROGRESS REPORT CARD
        const ribbonY = 40;
        const ribbonW = 86;
        const ribbonH = 7.2;
        const ribbonX = (210 - ribbonW) / 2;

        doc.setFillColor(15, 32, 87); // #0F2057
        doc.lines(
            [
                [ribbonW - 6, 0],
                [3, ribbonH],
                [-(ribbonW), 0],
                [3, -ribbonH]
            ],
            ribbonX + 3, ribbonY, [1, 1], 'F', true
        );

        setFontNunitoBold();
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text("PROGRESS REPORT CARD", 105, ribbonY + 5.1, { align: 'center' });

        // 4. Student Info Table & Photo Box (4 rows only - removed Date of Report and Status of Student as requested)
        const infoY = 49.5;
        const infoX = 14;
        const infoW = 142;
        const infoH = 29.6;
        const rowH = infoH / 4;

        const infoData = [
            { label: "Type of Report Card", value: "Academic", isBold: false },
            { label: "Name of the Student", value: studentName, isBold: true },
            { label: "Student ID", value: studentId, isBold: true },
            { label: "Campus and Stream", value: `${campus} · ${stream}`, isBold: false }
        ];

        infoData.forEach((row, i) => {
            const y = infoY + (i * rowH);
            // Label cell
            doc.setFillColor(241, 244, 251); // #F1F4FB
            doc.setDrawColor(207, 214, 232); // #CFD6E8
            doc.setLineWidth(0.25);
            doc.rect(infoX, y, 48, rowH, 'FD');

            setFontNunitoBold();
            doc.setFontSize(8.5);
            doc.setTextColor(15, 32, 87); // #0F2057
            doc.text(row.label, infoX + 3, y + 4.8);

            // Value cell
            doc.setFillColor(255, 253, 248); // #FFFDF8
            doc.rect(infoX + 48, y, 94, rowH, 'FD');

            if (row.isBold) {
                setFontNunitoBold();
            } else {
                setFontNunitoRegular();
            }
            doc.setFontSize(8.5);
            doc.setTextColor(20, 32, 74); // #14204A
            doc.text(row.value, infoX + 51, y + 4.8);
        });

        // Photo Box on Right (Matches 4 rows height with 3px gold border)
        const photoX = 160;
        const photoY = infoY;
        const photoW = 36;
        const photoH = infoH;

        doc.setFillColor(255, 253, 248);
        doc.setDrawColor(201, 150, 43); // #C9962B
        doc.setLineWidth(0.9); // 3px gold border
        doc.rect(photoX, photoY, photoW, photoH, 'FD');

        if (studentPhoto) {
            try {
                doc.addImage(studentPhoto, 'JPEG', photoX + 0.6, photoY + 0.6, photoW - 1.2, photoH - 1.2, undefined, 'FAST');
            } catch (imgErr) {
                console.warn("Could not render photo in PDF, falling back to initials:", imgErr);
                setFontCormorantBold();
                doc.setFontSize(22);
                doc.setTextColor(15, 32, 87);
                doc.text(getStudentInitials(studentName), photoX + (photoW / 2), photoY + 16, { align: 'center' });
            }
        } else {
            setFontCormorantBold();
            doc.setFontSize(22);
            doc.setTextColor(15, 32, 87);
            doc.text(getStudentInitials(studentName), photoX + (photoW / 2), photoY + 16, { align: 'center' });

            setFontNunitoRegular();
            doc.setFontSize(7);
            doc.setTextColor(93, 103, 136); // #5D6788
            doc.text("Student Photo", photoX + (photoW / 2), photoY + 23, { align: 'center' });
        }

        // 5. Section Heading
        const secHeadingY = 85.5;
        setFontCormorantBold();
        doc.setFontSize(14);
        doc.setTextColor(15, 32, 87);
        doc.text("Test-wise record", infoX, secHeadingY);

        // 6. Test-wise Table (Bold font on Test, Date, and Marks as requested)
        const tableRows = transformedRows.map(row => {
            if (row.isAB) {
                return [
                    { content: row.Test, styles: { textColor: [198, 45, 71], fontStyle: 'bold', halign: 'left' } },
                    { content: formatDate(row.DATE), styles: { textColor: [198, 45, 71], fontStyle: 'bold', halign: 'center' } },
                    { content: 'Absent', colSpan: 6, styles: { halign: 'center', textColor: [198, 45, 71], fontStyle: 'bold' } }
                ];
            }
            return [
                { content: row.Test, styles: { fontStyle: 'bold', halign: 'left' } },
                { content: formatDate(row.DATE), styles: { fontStyle: 'bold', halign: 'center' } },
                { content: String(Math.round(row.Tot_720 || 0)), styles: { fontStyle: 'bold', halign: 'center' } },
                { content: String(Math.round(row.AIR) || '-'), styles: { halign: 'center' } },
                { content: String(Math.round(row.Botany || 0)), styles: { fontStyle: 'bold', halign: 'center' } },
                { content: String(Math.round(row.Zoology || 0)), styles: { fontStyle: 'bold', halign: 'center' } },
                { content: String(Math.round(row.Physics || 0)), styles: { fontStyle: 'bold', halign: 'center' } },
                { content: String(Math.round(row.Chemistry || 0)), styles: { fontStyle: 'bold', halign: 'center' } }
            ];
        });

        const attendedRows = studentData.filter(r => !r.isAB);
        const count = attendedRows.length;
        const avg = (key) => count > 0 ? String(Math.round(attendedRows.reduce((a, b) => a + (Number(b[key]) || 0), 0) / count)) : '-';
        const avgAIR = count > 0 ? String(Math.round(attendedRows.reduce((a, b) => a + (Number(b.AIR) || 0), 0) / count)) : '-';

        // Add Average Row (Bold fonts across all marks)
        tableRows.push([
            { content: "Average", colSpan: 2, styles: { fontStyle: 'bold', halign: 'left', fillColor: [241, 244, 251] } },
            { content: avg('Tot_720'), styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 244, 251] } },
            { content: avgAIR, styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 244, 251] } },
            { content: avg('Botany'), styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 244, 251] } },
            { content: avg('Zoology'), styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 244, 251] } },
            { content: avg('Physics'), styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 244, 251] } },
            { content: avg('Chemistry'), styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 244, 251] } }
        ]);

        autoTable(doc, {
            head: [["Test", "Date", "Total /720", "AIR", "Bot", "Zoo", "Phy", "Chem"]],
            body: tableRows,
            startY: 88.5,
            margin: { left: 14, right: 14, top: 16, bottom: 22 },
            theme: 'plain',
            headStyles: {
                fillColor: [15, 32, 87], // #0F2057
                textColor: [255, 255, 255],
                font: 'NunitoSans',
                fontStyle: 'bold',
                fontSize: 8.5,
                halign: 'center',
                valign: 'middle',
                cellPadding: 2,
                lineColor: [207, 214, 232],
                lineWidth: 0.2
            },
            styles: {
                font: 'NunitoSans',
                fontSize: 8.5,
                textColor: [20, 32, 74], // #14204A
                lineColor: [207, 214, 232], // #CFD6E8
                lineWidth: 0.2,
                valign: 'middle',
                cellPadding: 1.6
            },
            columnStyles: {
                0: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
                1: { halign: 'center', fontStyle: 'bold', cellWidth: 26 },
                2: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
                3: { halign: 'center', cellWidth: 20 },
                4: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
                5: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
                6: { halign: 'center', fontStyle: 'bold', cellWidth: 21 },
                7: { halign: 'center', fontStyle: 'bold', cellWidth: 21 }
            },
            willDrawPage: (data) => {
                // IMPORTANT: Do NOT redraw border and background on page 1, because that paints
                // a solid opaque rectangle over the logo, header title, ribbon, info table, and photo!
                if (data.pageNumber > 1) {
                    drawPageBorderAndBackground();
                }
            },
            didParseCell: (data) => {
                if (data.section === 'body') {
                    // Force bold on Test, Date, and all subject marks
                    if ([0, 1, 2, 4, 5, 6, 7].includes(data.column.index)) {
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            },
            didDrawCell: (data) => {
                if (data.row.index === tableRows.length - 1) {
                    // Gold top line on Average row
                    doc.setDrawColor(201, 150, 43); // #C9962B
                    doc.setLineWidth(0.6);
                    doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
                }
            }
        });

        let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 6 : 140;

        // Check if remarks and signatures fit on current page, else add new page
        if (finalY + 45 > 270) {
            doc.addPage();
            drawPageBorderAndBackground();
            finalY = 22;
        }

        // Remarks Box (Table note "AB means absent. Lower AIR is better." removed as requested)
        const remarksBoxY = finalY;
        const remarksBoxW = 182;
        const remarksContent = customRemarksText || generateDynamicRemarks(studentName, transformedRows, analyzeLaggingSubjectAndLosses(transformedRows), erpQuestions);

        setFontCormorantItalic();
        doc.setFontSize(10.5);
        const splitRemarks = doc.splitTextToSize("Remarks: " + remarksContent, remarksBoxW - 12);
        const remarksH = (splitRemarks.length * 5) + 8;

        doc.setFillColor(241, 244, 251); // #F1F4FB
        doc.setDrawColor(45, 86, 201); // #2D56C9
        doc.setLineWidth(0.4);
        doc.roundedRect(14, remarksBoxY, remarksBoxW, remarksH, 2, 2, 'FD');

        doc.setTextColor(20, 32, 74); // #14204A
        doc.text(splitRemarks, 20, remarksBoxY + 6);

        // 9. Signatures
        const sigY = 271;
        doc.setDrawColor(207, 214, 232); // #CFD6E8
        doc.setLineWidth(0.3);
        doc.line(22, sigY, 70, sigY);
        doc.line(82, sigY, 128, sigY);
        doc.line(140, sigY, 188, sigY);

        setFontNunitoRegular();
        doc.setFontSize(8.5);
        doc.setTextColor(93, 103, 136); // #5D6788
        doc.text("Class Teacher", 46, sigY + 4.5, { align: 'center' });
        doc.text("Parent / Guardian", 105, sigY + 4.5, { align: 'center' });
        doc.text("Principal", 164, sigY + 4.5, { align: 'center' });

        // 10. Optional Chart & Performance Analysis Page
        let currentAnalysisPage = false;
        let currentAnalysisY = 16;

        if (isChartIncluded && chartImgData) {
            doc.addPage();
            drawPageBorderAndBackground();
            currentAnalysisPage = true;

            setFontOswald();
            doc.setFontSize(15);
            doc.setTextColor(10, 79, 196);
            doc.text("SRI CHAITANYA EDUCATIONAL INSTITUTIONS", 105, currentAnalysisY, { align: 'center' });

            currentAnalysisY += 5.5;
            setFontNunitoBold();
            doc.setFontSize(10);
            doc.setTextColor(15, 32, 87);
            doc.text("STUDENT PERFORMANCE REPORT & MARKS LOSS ANALYSIS", 105, currentAnalysisY, { align: 'center' });

            currentAnalysisY += 4;
            doc.setDrawColor(207, 214, 232);
            doc.setLineWidth(0.3);
            doc.line(14, currentAnalysisY, 196, currentAnalysisY);

            currentAnalysisY += 5;
            const chartH = 65;
            doc.addImage(chartImgData, 'PNG', 14, currentAnalysisY, 182, chartH);
            currentAnalysisY += chartH + 5;

            const analysis = analyzeLaggingSubjectAndLosses(transformedRows);
            if (analysis) {
                const advY = currentAnalysisY;

                // Pre-calculate height with individual tokens (Test Name in Navy Bold, Loss in Crimson Red Bold)
                let simX = 18;
                let simY = advY + 25;
                const maxX = 190;
                const lineHeight = 5.2;

                analysis.testLosses.forEach((item, idx) => {
                    setFontNunitoBold();
                    doc.setFontSize(8.5);
                    const testStr = `${item.testName}: `;
                    const testW = doc.getTextWidth(testStr);
                    const lossStr = String(item.lossText);
                    const lossW = doc.getTextWidth(lossStr);
                    const sepStr = (idx < analysis.testLosses.length - 1) ? '   |   ' : '';
                    setFontNunitoRegular();
                    const sepW = doc.getTextWidth(sepStr);

                    if (simX + testW + lossW > maxX && simX > 18) {
                        simX = 18;
                        simY += lineHeight;
                    }
                    simX += testW + lossW + sepW;
                });

                const diagBoxH = (simY - advY) + 8;

                doc.setFillColor(241, 244, 251);
                doc.setDrawColor(45, 86, 201);
                doc.setLineWidth(0.3);
                doc.roundedRect(14, advY, 182, diagBoxH, 2, 2, 'FD');

                setFontNunitoBold();
                doc.setFontSize(9.5);
                doc.setTextColor(15, 32, 87);
                doc.text("PERFORMANCE DIAGNOSTICS & MARKS LOSS ANALYSIS", 18, advY + 6.5);

                doc.setFontSize(8.5);
                doc.setTextColor(198, 45, 71);
                doc.text("Primary Lagging Subject: ", 18, advY + 13.5);
                const lw = doc.getTextWidth("Primary Lagging Subject: ");
                setFontNunitoBold();
                doc.setTextColor(15, 32, 87);
                doc.text(`${analysis.laggingSubjectName} (${analysis.laggingAvg}/${analysis.laggingMax})`, 18 + lw + 2, advY + 13.5);

                doc.text(`Marks Loss in ${analysis.laggingSubjectName} across Tests:`, 18, advY + 19.5);

                // Render each test loss token: Test Name in Navy Bold, Marks in Crimson Red Bold, Separator in Slate Gray
                let curX = 18;
                let curY = advY + 25;

                analysis.testLosses.forEach((item, idx) => {
                    setFontNunitoBold();
                    doc.setFontSize(8.5);
                    const testStr = `${item.testName}: `;
                    const testW = doc.getTextWidth(testStr);
                    const lossStr = String(item.lossText);
                    const lossW = doc.getTextWidth(lossStr);
                    const sepStr = (idx < analysis.testLosses.length - 1) ? '   |   ' : '';
                    setFontNunitoRegular();
                    const sepW = doc.getTextWidth(sepStr);

                    if (curX + testW + lossW > maxX && curX > 18) {
                        curX = 18;
                        curY += lineHeight;
                    }

                    // 1. Test Name (Navy Bold)
                    setFontNunitoBold();
                    doc.setFontSize(8.5);
                    doc.setTextColor(15, 32, 87); // #0F2057
                    doc.text(testStr, curX, curY);
                    curX += testW;

                    // 2. Marks Loss (Crimson Red Bold)
                    setFontNunitoBold();
                    doc.setTextColor(198, 45, 71); // #C62D47
                    doc.text(lossStr, curX, curY);
                    curX += lossW;

                    // 3. Separator
                    if (sepStr) {
                        setFontNunitoRegular();
                        doc.setTextColor(160, 174, 192); // Muted slate gray
                        doc.text(sepStr, curX, curY);
                        curX += sepW;
                    }
                });

                currentAnalysisY = advY + diagBoxH + 6;
            }
        }

        // 11. Topic Details (Wrong & Unattempted Questions Table)
        // User explicitly requested: "and the error table want to continue not in the new page"
        if (isTopicDetailsIncluded && erpQuestions && erpQuestions.length > 0) {
            let errorTableStartY;

            // Check if we can continue seamlessly on the same page as Chart/Diagnostics
            if (currentAnalysisPage && (275 - currentAnalysisY >= 50)) {
                // Continue directly on the same page!
                setFontNunitoBold();
                doc.setFontSize(10);
                doc.setTextColor(15, 32, 87);
                doc.text("WRONG & UNATTEMPTED QUESTIONS (TOPIC & SUBTOPIC DETAILS)", 14, currentAnalysisY + 3);

                doc.setDrawColor(207, 214, 232);
                doc.setLineWidth(0.25);
                doc.line(14, currentAnalysisY + 5.5, 196, currentAnalysisY + 5.5);

                errorTableStartY = currentAnalysisY + 8;
            } else {
                // If not enough room, start a fresh page with clean header
                doc.addPage();
                drawPageBorderAndBackground();

                let topY = 16;
                setFontOswald();
                doc.setFontSize(15);
                doc.setTextColor(10, 79, 196);
                doc.text("SRI CHAITANYA EDUCATIONAL INSTITUTIONS", 105, topY, { align: 'center' });

                topY += 5.5;
                setFontNunitoBold();
                doc.setFontSize(10);
                doc.setTextColor(15, 32, 87);
                doc.text("WRONG & UNATTEMPTED QUESTIONS (TOPIC & SUBTOPIC DETAILS)", 105, topY, { align: 'center' });

                topY += 4;
                doc.setDrawColor(207, 214, 232);
                doc.setLineWidth(0.3);
                doc.line(14, topY, 196, topY);

                errorTableStartY = topY + 6;
            }

            const qTableRows = erpQuestions.map(q => [
                q.test,
                `Q${q.qNo}`,
                q.subject,
                q.topic,
                q.subTopic || '-',
                q.status === 'W' ? 'Wrong (W)' : 'Unattempted (U)',
                `-${q.lost}`
            ]);

            autoTable(doc, {
                startY: errorTableStartY,
                margin: { left: 14, right: 14, top: 16, bottom: 20 },
                head: [['Test', 'Q.No', 'Subject', 'Topic', 'Sub-Topic', 'Status', 'Marks Lost']],
                body: qTableRows,
                theme: 'plain',
                headStyles: {
                    fillColor: [15, 32, 87],
                    textColor: [255, 255, 255],
                    font: 'NunitoSans',
                    fontStyle: 'bold',
                    fontSize: 8.5,
                    halign: 'center',
                    lineColor: [207, 214, 232],
                    lineWidth: 0.2
                },
                styles: {
                    font: 'NunitoSans',
                    fontSize: 8.5,
                    cellPadding: 1.6,
                    lineColor: [207, 214, 232],
                    lineWidth: 0.2,
                    textColor: [20, 32, 74]
                },
                columnStyles: {
                    0: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
                    1: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
                    2: { halign: 'left', fontStyle: 'bold', cellWidth: 24 },
                    3: { halign: 'left', cellWidth: 50 },
                    4: { halign: 'left', cellWidth: 44 },
                    5: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
                    6: { halign: 'center', textColor: [198, 45, 71], fontStyle: 'bold', cellWidth: 14 }
                },
                willDrawPage: (data) => {
                    if (data.pageNumber > 1) {
                        drawPageBorderAndBackground();
                    }
                },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 5) {
                        const cellVal = String(data.cell.raw);
                        if (cellVal.includes('Wrong')) {
                            data.cell.styles.textColor = [198, 45, 71];
                            data.cell.styles.fontStyle = 'bold';
                        } else if (cellVal.includes('Unattempted')) {
                            data.cell.styles.textColor = [22, 101, 52];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                }
            });
        }

        return doc;
    };

    const downloadPDF = async (targetStudentId = null) => {
        setIsDownloading(true);
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
                    console.warn("[PDF] Font loading error:", url, err);
                    return null;
                }
            };

            const [
                logoImg,
                oswaldBold,
                libreBaskerville,
                cormorantBold,
                cormorantItalic,
                nunitoRegular,
                nunitoSemiBold,
                nunitoBold,
                nunitoExtraBold
            ] = await Promise.all([
                loadImage('/logo.png'),
                loadFont('/fonts/Oswald-Bold.ttf'),
                loadFont('/fonts/LibreBaskerville-Regular.ttf'),
                loadFont('/fonts/CormorantGaramond-Bold.ttf'),
                loadFont('/fonts/CormorantGaramond-Italic.ttf'),
                loadFont('/fonts/NunitoSans-Regular.ttf'),
                loadFont('/fonts/NunitoSans-SemiBold.ttf'),
                loadFont('/fonts/NunitoSans-Bold.ttf'),
                loadFont('/fonts/NunitoSans-ExtraBold.ttf')
            ]);

            const fonts = {
                oswaldBold,
                libreBaskerville,
                cormorantBold,
                cormorantItalic,
                nunitoRegular,
                nunitoSemiBold,
                nunitoBold,
                nunitoExtraBold
            };

            const grouped = history.reduce((acc, row) => {
                const id = row.STUD_ID || 'Unknown';
                if (!acc[id]) acc[id] = [];
                acc[id].push(row);
                return acc;
            }, {});

            const allStudentIds = Object.keys(grouped);
            const studentIds = targetStudentId ? allStudentIds.filter(id => String(id) === String(targetStudentId)) : allStudentIds;
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
                setDownloadProgress({ current: 1, total: 1 });
                const sid = studentIds[0];
                const sRows = grouped[sid];
                const transformed = getTransformedRows(sRows);
                const chartImgData = includeChart ? await generateChartImage(transformed) : null;
                const sName = sRows[0]?.NAME_OF_THE_STUDENT || '';
                const erpQ = await fetchStudentErpQuestionsForPdf(sid, sName);

                // Fetch student photo from TiDB if not already loaded in currentPhoto
                let studentPhoto = (sid.toString() === previewStudentId?.toString()) ? currentPhoto : null;
                if (!studentPhoto) {
                    try {
                        const pRes = await fetch(`${API_URL}/api/student-photo/${encodeURIComponent(sid)}?academicYear=${filters.academicYear || '2026'}`);
                        if (pRes.ok) {
                            const pData = await pRes.json();
                            studentPhoto = pData.photo?.photo_data || null;
                        }
                    } catch (photoErr) {
                        console.warn("Could not load photo for student in PDF:", photoErr);
                    }
                }

                const studentRem = customRemarks[sid] || null;
                const doc = generateStudentPDF(sRows, logoImg, fonts, studentPhoto, chartImgData, transformed, includeChart, erpQ, includeTopicDetails, studentRem);
                const sanitizedName = String(sName || 'Report').replace(/[/\\?%*:|"<>]/g, '_').trim();
                doc.save(`${sanitizedName}_Progress_Report.pdf`);
                logActivity(userData, 'Downloaded Progress PDF', { student: sName, includeChart, includeTopicDetails });
            } else {
                const zip = new JSZip();
                const campusName = grouped[studentIds[0]][0].CAMPUS_NAME || 'Campus';
                const total = studentIds.length;
                setDownloadProgress({ current: 0, total });

                // Pre-fetch all student photos in batch from TiDB!
                let photosMap = {};
                try {
                    const batchRes = await fetch(`${API_URL}/api/student-photos/batch`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            studentIds: studentIds,
                            academicYear: filters.academicYear || '2026'
                        })
                    });
                    if (batchRes.ok) {
                        const batchData = await batchRes.json();
                        photosMap = batchData.photos || {};
                    }
                } catch (batchErr) {
                    console.warn("[Bulk PDF] Batch photos fetch failed:", batchErr);
                }

                // High Performance: Pre-fetch all ERP questions in a single batch request
                const erpMap = {};
                const effectiveCampus = (filters.campus && filters.campus.length > 0) ? filters.campus : (filters._allowedCampuses || []);
                if (includeTopicDetails) {
                    try {
                        const erpPayload = {
                            ...filters,
                            campus: effectiveCampus,
                            academicYear: filters.academicYear || '2026'
                        };
                        const erpRes = await fetch(`${API_URL}/api/erp/report`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(erpPayload)
                        });
                        if (erpRes.ok) {
                            const erpData = await erpRes.json();
                            if (Array.isArray(erpData)) {
                                erpData.forEach(row => {
                                    const sid = String(row.STUD_ID || '').trim();
                                    const sname = String(row.Student_Name || '').trim().toUpperCase();
                                    const status = String(row.W_U || '').trim().toUpperCase();
                                    const qObj = {
                                        test: row.Test,
                                        qNo: row.Q_No,
                                        subject: row.Subject,
                                        topic: row.Topic || 'Unknown Topic',
                                        subTopic: row.Sub_Topic || '',
                                        status: status,
                                        lost: status === 'W' ? 5 : 4,
                                        qUrl: row.Q_URL,
                                        sUrl: row.S_URL,
                                        keyValue: row.Key_Value
                                    };
                                    if (sid) {
                                        if (!erpMap[sid]) erpMap[sid] = [];
                                        erpMap[sid].push(qObj);
                                    }
                                    if (sname) {
                                        if (!erpMap[sname]) erpMap[sname] = [];
                                        erpMap[sname].push(qObj);
                                    }
                                });
                            }
                        }
                    } catch (erpBatchErr) {
                        console.warn("[Bulk PDF] Batch ERP questions fetch failed, will fallback:", erpBatchErr);
                    }
                }

                let count = 0;
                for (const id of studentIds) {
                    count++;
                    setDownloadProgress({ current: count, total });
                    await new Promise((resolve) => setTimeout(resolve, count % 10 === 0 ? 20 : 0));

                    try {
                        const sRows = grouped[id];
                        if (!sRows || sRows.length === 0) continue;
                        const sName = sRows[0]?.NAME_OF_THE_STUDENT || id;
                        const sanitizedName = String(sName).replace(/[/\\?%*:|"<>]/g, '_').trim();
                        const fileName = `${sanitizedName}_${id}_Progress_Report.pdf`;

                        const transformed = getTransformedRows(sRows);
                        const chartImgData = includeChart ? await generateChartImage(transformed) : null;

                        let erpQ = erpMap[id] || (sName ? erpMap[sName.toUpperCase()] : null);
                        if (!erpQ && includeTopicDetails && studentIds.length <= 25) {
                            erpQ = await fetchStudentErpQuestionsForPdf(id, sName);
                        }
                        erpQ = erpQ || [];

                        const studentPhoto = photosMap[id] || null;
                        const studentRem = customRemarks[id] || null;

                        const doc = generateStudentPDF(sRows, logoImg, fonts, studentPhoto, chartImgData, transformed, includeChart, erpQ, includeTopicDetails, studentRem);
                        const pdfArrayBuffer = doc.output('arraybuffer');
                        zip.file(fileName, pdfArrayBuffer);
                    } catch (singleStudentErr) {
                        console.warn(`[Bulk PDF] Failed generating PDF for student ID ${id}:`, singleStudentErr);
                    }
                }

                const content = await zip.generateAsync({
                    type: 'blob',
                    compression: 'DEFLATE',
                    compressionOptions: { level: 1 },
                    streamFiles: true
                });
                const sanitizedCampus = String(campusName).replace(/[/\\?%*:|"<>]/g, '_').trim();
                saveAs(content, `${sanitizedCampus}_Progress_Reports.zip`);
                logActivity(userData, 'Downloaded Bulk Progress PDF', { count: studentIds.length, campus: campusName, includeChart });
            }

        } catch (err) {
            console.error("PDF Generation Error:", err);
            setModal({
                isOpen: true,
                type: 'danger',
                title: 'PDF Error',
                message: `Failed to generate PDF(s): ${err.message || 'Browser memory limit reached.'}`,
                onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
            });
        } finally {
            setIsDownloading(false);
            setDownloadProgress({ current: 0, total: 0 });
        }
    };

        const downloadExcel = async (targetStudentId = null) => {
        setIsExcelDownloading(true);
        setExcelProgress({ current: 0, total: 0 });
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Sri Chaitanya';
            workbook.created = new Date();

            // 1. Group history by student ID
            const grouped = history.reduce((acc, row) => {
                const id = row.STUD_ID || 'Unknown';
                if (!acc[id]) acc[id] = [];
                acc[id].push(row);
                return acc;
            }, {});

            const allStudentIds = Object.keys(grouped);
            const studentIds = targetStudentId
                ? allStudentIds.filter(id => String(id) === String(targetStudentId))
                : allStudentIds;

            if (studentIds.length === 0) return;

            // 2. Fetch Logo
            let logoId = null;
            try {
                const logoRes = await fetch('/logo.png');
                if (logoRes.ok) {
                    const logoBlob = await logoRes.blob();
                    const logoBuffer = await logoBlob.arrayBuffer();
                    logoId = workbook.addImage({
                        buffer: logoBuffer,
                        extension: 'png'
                    });
                }
            } catch (e) {
                console.warn("[Excel] Logo fetch error:", e);
            }

            // 3. Batch fetch ERP questions if includeTopicDetails is enabled
            const erpMap = {};
            const effectiveCampus = (filters.campus && filters.campus.length > 0) ? filters.campus : (filters._allowedCampuses || []);
            if (includeTopicDetails) {
                try {
                    const erpPayload = {
                        ...filters,
                        campus: effectiveCampus,
                        academicYear: filters.academicYear || '2026'
                    };
                    const erpRes = await fetch(`${API_URL}/api/erp/report`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(erpPayload)
                    });
                    if (erpRes.ok) {
                        const erpData = await erpRes.json();
                        if (Array.isArray(erpData)) {
                            erpData.forEach(row => {
                                const sid = String(row.STUD_ID || '').trim();
                                const sname = String(row.Student_Name || '').trim().toUpperCase();
                                const status = String(row.W_U || '').trim().toUpperCase();
                                const qObj = {
                                    test: row.Test,
                                    qNo: row.Q_No,
                                    subject: row.Subject,
                                    topic: row.Topic || 'Unknown Topic',
                                    subTopic: row.Sub_Topic || '',
                                    status: status,
                                    lost: status === 'W' ? 5 : 4,
                                    qUrl: row.Q_URL,
                                    sUrl: row.S_URL,
                                    keyValue: row.Key_Value
                                };
                                if (sid) {
                                    if (!erpMap[sid]) erpMap[sid] = [];
                                    erpMap[sid].push(qObj);
                                }
                                if (sname) {
                                    if (!erpMap[sname]) erpMap[sname] = [];
                                    erpMap[sname].push(qObj);
                                }
                            });
                        }
                    }
                } catch (erpErr) {
                    console.warn("[Excel] Batch ERP fetch failed:", erpErr);
                }
            }

            const getTransformedRows = (sRows) => {
                if (!allExams || allExams.length === 0) {
                    return (sRows || []).map(r => ({ ...r, isAB: false }));
                }
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

            // 4. Calculate student averages & SORT BY TOP MARKS OF AVERAGE (DESCENDING)
            const studentSummaries = studentIds.map(id => {
                const sRows = grouped[id];
                const sName = sRows[0]?.NAME_OF_THE_STUDENT || id;
                const campus = sRows[0]?.CAMPUS_NAME || '';
                const stream = getNormalizedStream(sRows);

                const attemptedRows = sRows.filter(r => !r.isAB);
                const validRows = attemptedRows.length > 0 ? attemptedRows : sRows;
                const count = validRows.length;
                const avgTot = count > 0
                    ? (validRows.reduce((sum, r) => sum + (Number(r.Tot_720) || 0), 0) / count)
                    : 0;
                const avgAIR = count > 0
                    ? Math.round(validRows.reduce((sum, r) => sum + (Number(r.AIR) || 0), 0) / count)
                    : 999999;

                return {
                    id,
                    name: sName,
                    campus,
                    stream,
                    sRows,
                    avgTot,
                    avgAIR
                };
            });

            // SORT: Top 1 average marks first, then rank, then name
            studentSummaries.sort((a, b) => {
                if (b.avgTot !== a.avgTot) return b.avgTot - a.avgTot;
                if (a.avgAIR !== b.avgAIR) return a.avgAIR - b.avgAIR;
                return (a.name || '').localeCompare(b.name || '');
            });

            const totalStudents = studentSummaries.length;
            setExcelProgress({ current: 0, total: totalStudents });

            const usedSheetNames = new Set();

            const thinBorder = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };

            const doubleBottomBorder = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'double', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };

            // 5. Generate one worksheet per student in sorted order
            for (let idx = 0; idx < studentSummaries.length; idx++) {
                const student = studentSummaries[idx];
                setExcelProgress({ current: idx + 1, total: totalStudents });
                if (idx % 10 === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }

                // Sanitize sheet name: max 31 chars, no invalid chars : \ / ? * [ ], unique
                let baseName = String(student.name || `Student_${student.id || '1'}`)
                    .replace(/[:\\/?*\[\]]/g, '')
                    .replace(/^'+|'+$/g, '')
                    .trim();
                if (!baseName) baseName = `Student_${student.id || '1'}`;
                baseName = baseName.slice(0, 31).trim();

                let uniqueSheetName = baseName;
                let counter = 2;
                while (usedSheetNames.has(uniqueSheetName.toLowerCase())) {
                    const suffix = `_${counter}`;
                    uniqueSheetName = `${baseName.slice(0, 31 - suffix.length).trim()}${suffix}`;
                    counter++;
                }
                usedSheetNames.add(uniqueSheetName.toLowerCase());

                const ws = workbook.addWorksheet(uniqueSheetName);
                ws.views = [{ showGridLines: true }];

                // Column widths matching progress report
                ws.getColumn(1).width = 20; // Test Name
                ws.getColumn(2).width = 14; // Date
                ws.getColumn(3).width = 13; // Total 720
                ws.getColumn(4).width = 12; // AIR
                ws.getColumn(5).width = 11; // Bot 180
                ws.getColumn(6).width = 11; // Zoo 180
                ws.getColumn(7).width = 12; // Bio 360
                ws.getColumn(8).width = 11; // Phy 180
                ws.getColumn(9).width = 12; // Chem 180

                // Header Banner: Logo & Title
                if (logoId !== null) {
                    ws.addImage(logoId, {
                        tl: { col: 0.15, row: 0.1 },
                        ext: { width: 55, height: 48 },
                        editAs: 'oneCell'
                    });
                }

                ws.mergeCells('B1:I1');
                const titleCell = ws.getCell('B1');
                titleCell.value = {
                    richText: [
                        { text: 'Sri Chaitanya ', font: { name: 'Impact', size: 20, bold: true, color: { argb: 'FF0070C0' } } },
                        { text: 'Educational Institutions., India', font: { name: 'Bookman Old Style', size: 18, bold: true, color: { argb: 'FF003399' } } }
                    ]
                };
                titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                ws.getRow(1).height = 36;

                // Subtitle
                ws.mergeCells('A2:I2');
                const subTitleCell = ws.getCell('A2');
                subTitleCell.value = 'P R O G R E S S   R E P O R T';
                subTitleCell.font = { name: 'Bookman Old Style', size: 13, bold: true, color: { argb: 'FF000000' } };
                subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                ws.getRow(2).height = 24;

                // Spacer row 3
                ws.getRow(3).height = 8;

                // Student Info Box (Rows 4-5)
                ws.getCell('A4').value = 'Student Name:';
                ws.getCell('A4').font = { name: 'Bookman Old Style', bold: true, size: 10, color: { argb: 'FF000000' } };
                ws.getCell('A4').alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                ws.mergeCells('B4:E4');
                const nameCell = ws.getCell('B4');
                nameCell.value = student.name;
                nameCell.font = { name: 'Bookman Old Style', bold: true, size: 11, color: { argb: 'FF003399' } };
                nameCell.alignment = { horizontal: 'left', vertical: 'middle' };

                ws.getCell('F4').value = 'Campus:';
                ws.getCell('F4').font = { name: 'Bookman Old Style', bold: true, size: 10, color: { argb: 'FF000000' } };
                ws.getCell('F4').alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                ws.mergeCells('G4:I4');
                const campusCell = ws.getCell('G4');
                campusCell.value = student.campus;
                campusCell.font = { name: 'Bookman Old Style', bold: true, size: 11, color: { argb: 'FF003399' } };
                campusCell.alignment = { horizontal: 'left', vertical: 'middle' };

                ws.getCell('A5').value = 'Student ID:';
                ws.getCell('A5').font = { name: 'Bookman Old Style', bold: true, size: 10, color: { argb: 'FF000000' } };
                ws.getCell('A5').alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                ws.mergeCells('B5:E5');
                const idCell = ws.getCell('B5');
                idCell.value = String(student.id || '');
                idCell.font = { name: 'Bookman Old Style', bold: true, size: 11, color: { argb: 'FF003399' } };
                idCell.alignment = { horizontal: 'left', vertical: 'middle' };

                ws.getCell('F5').value = 'Stream:';
                ws.getCell('F5').font = { name: 'Bookman Old Style', bold: true, size: 10, color: { argb: 'FF000000' } };
                ws.getCell('F5').alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                ws.mergeCells('G5:I5');
                const streamCell = ws.getCell('G5');
                streamCell.value = student.stream;
                streamCell.font = { name: 'Bookman Old Style', bold: true, size: 11, color: { argb: 'FF003399' } };
                streamCell.alignment = { horizontal: 'left', vertical: 'middle' };

                ws.getRow(4).height = 22;
                ws.getRow(5).height = 22;

                for (let r = 4; r <= 5; r++) {
                    for (let c = 1; c <= 9; c++) {
                        const boxCell = ws.getCell(r, c);
                        boxCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
                        boxCell.border = {
                            top: r === 4 ? { style: 'thin', color: { argb: 'FF93C5FD' } } : undefined,
                            bottom: r === 5 ? { style: 'thin', color: { argb: 'FF93C5FD' } } : undefined,
                            left: c === 1 ? { style: 'thin', color: { argb: 'FF93C5FD' } } : undefined,
                            right: c === 9 ? { style: 'thin', color: { argb: 'FF93C5FD' } } : undefined,
                        };
                    }
                }

                // Spacer row 6
                ws.getRow(6).height = 10;

                // Score Table Header (Row 7)
                const headers = ['Test Name', 'Date', 'Total\n720', 'AIR', 'Bot\n180', 'Zoo\n180', 'Bio\n360', 'Phy\n180', 'Chem\n180'];
                headers.forEach((h, i) => {
                    const cell = ws.getCell(7, i + 1);
                    cell.value = h;
                    cell.font = { name: 'Bookman Old Style', bold: true, size: 10.5, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cell.border = thinBorder;
                });
                ws.getRow(7).height = 30;

                // Score Table Data Rows
                const transformedRows = getTransformedRows(student.sRows);
                let currentRow = 8;

                transformedRows.forEach(row => {
                    ws.getCell(currentRow, 1).value = row.Test || '';
                    ws.getCell(currentRow, 1).font = { name: 'Bookman Old Style', bold: true, size: 10 };
                    ws.getCell(currentRow, 1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                    ws.getCell(currentRow, 1).border = thinBorder;

                    ws.getCell(currentRow, 2).value = formatDate(row.DATE);
                    ws.getCell(currentRow, 2).font = { name: 'Bookman Old Style', size: 10 };
                    ws.getCell(currentRow, 2).alignment = { horizontal: 'center', vertical: 'middle' };
                    ws.getCell(currentRow, 2).border = thinBorder;

                    if (!row.isAB) {
                        const cTot = ws.getCell(currentRow, 3);
                        cTot.value = Math.round(row.Tot_720 || 0);
                        cTot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFCC' } };
                        cTot.font = { name: 'Bookman Old Style', bold: true, size: 11, color: { argb: 'FF000000' } };
                        cTot.alignment = { horizontal: 'center', vertical: 'middle' };
                        cTot.border = thinBorder;

                        const cAir = ws.getCell(currentRow, 4);
                        cAir.value = Math.round(row.AIR) || '-';
                        cAir.font = { name: 'Bookman Old Style', size: 10, color: { argb: 'FF78350F' } };
                        cAir.alignment = { horizontal: 'center', vertical: 'middle' };
                        cAir.border = thinBorder;

                        const cBot = ws.getCell(currentRow, 5);
                        cBot.value = Math.round(row.Botany || 0);
                        cBot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDE9D9' } };
                        cBot.font = { name: 'Bookman Old Style', size: 10 };
                        cBot.alignment = { horizontal: 'center', vertical: 'middle' };
                        cBot.border = thinBorder;

                        const cZoo = ws.getCell(currentRow, 6);
                        cZoo.value = Math.round(row.Zoology || 0);
                        cZoo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAEEF3' } };
                        cZoo.font = { name: 'Bookman Old Style', size: 10 };
                        cZoo.alignment = { horizontal: 'center', vertical: 'middle' };
                        cZoo.border = thinBorder;

                        const cBio = ws.getCell(currentRow, 7);
                        cBio.value = Math.round((Number(row.Botany) || 0) + (Number(row.Zoology) || 0));
                        cBio.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
                        cBio.font = { name: 'Bookman Old Style', bold: true, size: 10 };
                        cBio.alignment = { horizontal: 'center', vertical: 'middle' };
                        cBio.border = thinBorder;

                        const cPhy = ws.getCell(currentRow, 8);
                        cPhy.value = Math.round(row.Physics || 0);
                        cPhy.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEBF1DE' } };
                        cPhy.font = { name: 'Bookman Old Style', size: 10 };
                        cPhy.alignment = { horizontal: 'center', vertical: 'middle' };
                        cPhy.border = thinBorder;

                        const cChe = ws.getCell(currentRow, 9);
                        cChe.value = Math.round(row.Chemistry || 0);
                        cChe.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2DCDB' } };
                        cChe.font = { name: 'Bookman Old Style', size: 10 };
                        cChe.alignment = { horizontal: 'center', vertical: 'middle' };
                        cChe.border = thinBorder;
                    } else {
                        for (let c = 3; c <= 9; c++) {
                            const cell = ws.getCell(currentRow, c);
                            cell.value = 'AB';
                            cell.font = { name: 'Bookman Old Style', bold: true, size: 10.5, color: { argb: 'FFFF0000' } };
                            cell.alignment = { horizontal: 'center', vertical: 'middle' };
                            cell.border = thinBorder;
                        }
                    }

                    ws.getRow(currentRow).height = 20;
                    currentRow++;
                });

                // Average Row
                const avgRow = currentRow;
                ws.mergeCells(`A${avgRow}:B${avgRow}`);
                const avgLabelCell = ws.getCell(`A${avgRow}`);
                avgLabelCell.value = 'AVERAGE';
                avgLabelCell.font = { name: 'Bookman Old Style', bold: true, size: 11, color: { argb: 'FF000000' } };
                avgLabelCell.alignment = { horizontal: 'center', vertical: 'middle' };

                const attemptedRows = student.sRows.filter(r => !r.isAB);
                const validRows = attemptedRows.length > 0 ? attemptedRows : student.sRows;
                const vCount = validRows.length;

                const cAvgTot = vCount > 0 ? Math.round(validRows.reduce((a, b) => a + (Number(b.Tot_720) || 0), 0) / vCount) : 0;
                const cAvgAir = vCount > 0 ? Math.round(validRows.reduce((a, b) => a + (Number(b.AIR) || 0), 0) / vCount) : '-';
                const cAvgBot = vCount > 0 ? Math.round(validRows.reduce((a, b) => a + (Number(b.Botany) || 0), 0) / vCount) : 0;
                const cAvgZoo = vCount > 0 ? Math.round(validRows.reduce((a, b) => a + (Number(b.Zoology) || 0), 0) / vCount) : 0;
                const cAvgBio = vCount > 0 ? Math.round(validRows.reduce((a, b) => a + (Number(b.Botany) || 0) + (Number(b.Zoology) || 0), 0) / vCount) : 0;
                const cAvgPhy = vCount > 0 ? Math.round(validRows.reduce((a, b) => a + (Number(b.Physics) || 0), 0) / vCount) : 0;
                const cAvgChe = vCount > 0 ? Math.round(validRows.reduce((a, b) => a + (Number(b.Chemistry) || 0), 0) / vCount) : 0;

                ws.getCell(avgRow, 3).value = cAvgTot;
                ws.getCell(avgRow, 4).value = cAvgAir;
                ws.getCell(avgRow, 5).value = cAvgBot;
                ws.getCell(avgRow, 6).value = cAvgZoo;
                ws.getCell(avgRow, 7).value = cAvgBio;
                ws.getCell(avgRow, 8).value = cAvgPhy;
                ws.getCell(avgRow, 9).value = cAvgChe;

                for (let c = 1; c <= 9; c++) {
                    const cell = ws.getCell(avgRow, c);
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAEEF3' } };
                    cell.font = { name: 'Bookman Old Style', bold: true, size: 10.5, color: { argb: 'FF000000' } };
                    if (c > 2) cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    cell.border = doubleBottomBorder;
                }
                ws.getRow(avgRow).height = 22;
                currentRow++;

                // Diagnostics Box (if includeChart)
                if (includeChart) {
                    const analysis = analyzeLaggingSubjectAndLosses(transformedRows);
                    if (analysis) {
                        currentRow++; // blank row
                        ws.getRow(currentRow).height = 10;
                        currentRow++;

                        // Header row
                        ws.mergeCells(`A${currentRow}:I${currentRow}`);
                        const diagHeader = ws.getCell(`A${currentRow}`);
                        diagHeader.value = 'PERFORMANCE DIAGNOSTICS & MARKS LOSS ANALYSIS';
                        diagHeader.font = { name: 'Bookman Old Style', bold: true, size: 10.5, color: { argb: 'FF1E3A8A' } };
                        diagHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
                        diagHeader.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                        for (let c = 1; c <= 9; c++) ws.getCell(currentRow, c).border = thinBorder;
                        ws.getRow(currentRow).height = 22;
                        currentRow++;

                        // Line 1: Lagging Subject
                        ws.mergeCells(`A${currentRow}:I${currentRow}`);
                        const diagSubj = ws.getCell(`A${currentRow}`);
                        diagSubj.value = {
                            richText: [
                                { text: 'Primary Lagging Subject: ', font: { name: 'Bookman Old Style', bold: true, size: 10, color: { argb: 'FFDC2626' } } },
                                { text: `${analysis.laggingSubjectName} (${analysis.laggingAvg}/${analysis.laggingMax})`, font: { name: 'Bookman Old Style', bold: true, size: 10, color: { argb: 'FF003399' } } }
                            ]
                        };
                        diagSubj.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                        diagSubj.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                        for (let c = 1; c <= 9; c++) ws.getCell(currentRow, c).border = thinBorder;
                        ws.getRow(currentRow).height = 20;
                        currentRow++;

                        // Line 2: Marks Loss Header
                        ws.mergeCells(`A${currentRow}:I${currentRow}`);
                        const diagLossHead = ws.getCell(`A${currentRow}`);
                        diagLossHead.value = `Marks Loss in ${analysis.laggingSubjectName} across Tests:`;
                        diagLossHead.font = { name: 'Bookman Old Style', bold: true, size: 9.5, color: { argb: 'FF1E3A8A' } };
                        diagLossHead.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                        diagLossHead.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                        for (let c = 1; c <= 9; c++) ws.getCell(currentRow, c).border = thinBorder;
                        ws.getRow(currentRow).height = 18;
                        currentRow++;

                        // Line 3: Losses breakdown
                        ws.mergeCells(`A${currentRow}:I${currentRow}`);
                        const diagLossList = ws.getCell(`A${currentRow}`);
                        diagLossList.value = {
                            richText: analysis.testLosses.flatMap((item, lIdx) => [
                                { text: `${item.testName}: `, font: { name: 'Bookman Old Style', bold: true, size: 9.5, color: { argb: 'FF1E293B' } } },
                                { text: item.lossText, font: { name: 'Bookman Old Style', bold: true, size: 9.5, color: { argb: 'FFDC2626' } } },
                                ...(lIdx < analysis.testLosses.length - 1 ? [{ text: '   |   ', font: { name: 'Bookman Old Style', size: 9, color: { argb: 'FF94A3B8' } } }] : [])
                            ])
                        };
                        diagLossList.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                        diagLossList.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                        for (let c = 1; c <= 9; c++) ws.getCell(currentRow, c).border = thinBorder;
                        ws.getRow(currentRow).height = 22;
                        currentRow++;
                    }
                }

                // Wrong & Unattempted Questions Table (if includeTopicDetails)
                if (includeTopicDetails) {
                    let erpQ = erpMap[student.id] || (student.name ? erpMap[student.name.toUpperCase()] : null);
                    if (!erpQ && studentSummaries.length <= 15) {
                        erpQ = await fetchStudentErpQuestionsForPdf(student.id, student.name);
                    }
                    erpQ = erpQ || [];

                    if (erpQ.length > 0) {
                        currentRow++; // blank row
                        ws.getRow(currentRow).height = 10;
                        currentRow++;

                        // Section title
                        ws.mergeCells(`A${currentRow}:I${currentRow}`);
                        const qTitle = ws.getCell(`A${currentRow}`);
                        qTitle.value = `WRONG & UNATTEMPTED QUESTIONS (TOPIC & SUBTOPIC DETAILS) — ${erpQ.length} ITEMS`;
                        qTitle.font = { name: 'Bookman Old Style', bold: true, size: 11, color: { argb: 'FF003399' } };
                        qTitle.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                        ws.getRow(currentRow).height = 24;
                        currentRow++;

                        // Header row
                        ws.getCell(currentRow, 1).value = 'Test';
                        ws.getCell(currentRow, 2).value = 'Q.No';
                        ws.getCell(currentRow, 3).value = 'Subject';
                        ws.mergeCells(`D${currentRow}:E${currentRow}`);
                        ws.getCell(`D${currentRow}`).value = 'Topic';
                        ws.mergeCells(`F${currentRow}:G${currentRow}`);
                        ws.getCell(`F${currentRow}`).value = 'Sub-Topic';
                        ws.getCell(currentRow, 8).value = 'Status';
                        ws.getCell(currentRow, 9).value = 'Marks Lost';

                        for (let c = 1; c <= 9; c++) {
                            const cell = ws.getCell(currentRow, c);
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003399' } };
                            cell.font = { name: 'Bookman Old Style', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
                            cell.alignment = { horizontal: 'center', vertical: 'middle' };
                            cell.border = thinBorder;
                        }
                        ws.getRow(currentRow).height = 24;
                        currentRow++;

                        // Question Rows
                        erpQ.forEach(q => {
                            ws.getCell(currentRow, 1).value = q.test || '';
                            ws.getCell(currentRow, 1).font = { name: 'Bookman Old Style', bold: true, size: 9.5 };
                            ws.getCell(currentRow, 1).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                            ws.getCell(currentRow, 1).border = thinBorder;

                            ws.getCell(currentRow, 2).value = `Q${q.qNo}`;
                            ws.getCell(currentRow, 2).font = { name: 'Bookman Old Style', bold: true, size: 9.5 };
                            ws.getCell(currentRow, 2).alignment = { horizontal: 'center', vertical: 'middle' };
                            ws.getCell(currentRow, 2).border = thinBorder;

                            ws.getCell(currentRow, 3).value = q.subject || '';
                            ws.getCell(currentRow, 3).font = { name: 'Bookman Old Style', bold: true, size: 9.5 };
                            ws.getCell(currentRow, 3).alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
                            ws.getCell(currentRow, 3).border = thinBorder;

                            ws.mergeCells(`D${currentRow}:E${currentRow}`);
                            const topCell = ws.getCell(`D${currentRow}`);
                            topCell.value = q.topic || '-';
                            topCell.font = { name: 'Bookman Old Style', size: 9.5 };
                            topCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
                            ws.getCell(currentRow, 4).border = thinBorder;
                            ws.getCell(currentRow, 5).border = thinBorder;

                            ws.mergeCells(`F${currentRow}:G${currentRow}`);
                            const subCell = ws.getCell(`F${currentRow}`);
                            subCell.value = q.subTopic || '-';
                            subCell.font = { name: 'Bookman Old Style', size: 9.5 };
                            subCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
                            ws.getCell(currentRow, 6).border = thinBorder;
                            ws.getCell(currentRow, 7).border = thinBorder;

                            const isW = q.status === 'W';
                            const statCell = ws.getCell(currentRow, 8);
                            statCell.value = isW ? 'Wrong (W)' : 'Unattempted (U)';
                            statCell.font = { name: 'Bookman Old Style', bold: true, size: 9.5, color: { argb: isW ? 'FFB91C1C' : 'FF15803D' } };
                            statCell.alignment = { horizontal: 'center', vertical: 'middle' };
                            statCell.border = thinBorder;

                            const lostCell = ws.getCell(currentRow, 9);
                            lostCell.value = `-${q.lost}`;
                            lostCell.font = { name: 'Bookman Old Style', bold: true, size: 10, color: { argb: 'FFDC2626' } };
                            lostCell.alignment = { horizontal: 'center', vertical: 'middle' };
                            lostCell.border = thinBorder;

                            ws.getRow(currentRow).height = 20;
                            currentRow++;
                        });
                    }
                }
            }

            // 6. Generate buffer & save file
            const buffer = await workbook.xlsx.writeBuffer();
            const campusName = studentSummaries[0]?.campus || 'Campus';
            const sanitizedCampus = String(campusName).replace(/[/\\?%*:|"<>]/g, '_').trim();
            const dateStr = formatDate(new Date(), 'dd-mmm-yy');

            let fileName;
            if (studentSummaries.length === 1) {
                const singleName = String(studentSummaries[0].name).replace(/[/\\?%*:|"<>]/g, '_').trim();
                fileName = `${singleName}_Progress_Report_${dateStr}.xlsx`;
            } else {
                fileName = `${sanitizedCampus}_Progress_Reports_Sorted_${dateStr}.xlsx`;
            }

            saveAs(new Blob([buffer]), fileName);
            logActivity(userData, 'Downloaded Progress Excel', {
                studentCount: studentSummaries.length,
                campus: campusName,
                includeChart,
                includeTopicDetails
            });

        } catch (err) {
            console.error("Excel Generation Error:", err);
            setModal({
                isOpen: true,
                type: 'danger',
                title: 'Excel Export Error',
                message: `Failed to generate Excel file: ${err.message || 'Unknown error'}`,
                onClose: () => setModal(prev => ({ ...prev, isOpen: false }))
            });
        } finally {
            setIsExcelDownloading(false);
            setExcelProgress({ current: 0, total: 0 });
        }
    };

    const uniqueStudentIds = [...new Set(history.map(h => h.STUD_ID))];
    const uniqueStudents = uniqueStudentIds.length;

    const previewStudentId = uniqueStudentIds[currentStudentIndex];
    const previewRows = useMemo(() => {
        if (!previewStudentId) return [];
        return history.filter(h => h.STUD_ID?.toString() === previewStudentId.toString());
    }, [history, previewStudentId]);

    const previewStudentName = previewRows[0]?.NAME_OF_THE_STUDENT || '';

    // Fetch Student Photo from TiDB whenever active student changes
    useEffect(() => {
        if (!previewStudentId) {
            setCurrentPhoto(null);
            return;
        }

        let isMounted = true;
        const fetchPhoto = async () => {
            try {
                const res = await fetch(`${API_URL}/api/student-photo/${encodeURIComponent(previewStudentId)}?academicYear=${filters.academicYear || '2026'}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setCurrentPhoto(data.photo ? data.photo.photo_data : null);
                    }
                }
            } catch (err) {
                console.warn("Failed to load student photo:", err);
            }
        };

        fetchPhoto();
        return () => { isMounted = false; };
    }, [previewStudentId, filters.academicYear]);

    // Handle interactive photo upload directly to TiDB database
    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !previewStudentId) return;

        setPhotoUploading(true);
        try {
            // Compress image to optimized JPEG (~50-100KB)
            const compressedBase64 = await compressImage(file, 450, 550, 0.85);

            const res = await fetch(`${API_URL}/api/student-photo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: previewStudentId,
                    photoData: compressedBase64,
                    mimeType: 'image/jpeg',
                    academicYear: filters.academicYear || '2026'
                })
            });

            if (!res.ok) throw new Error('Failed to save student photo in database');

            setCurrentPhoto(compressedBase64);
            logActivity(userData, 'Uploaded Student Photo', { studentId: previewStudentId });
        } catch (err) {
            console.error("Photo upload error:", err);
            setModal({
                isOpen: true,
                type: 'danger',
                title: 'Upload Error',
                message: 'Failed to upload photo to TiDB: ' + err.message,
                onClose: () => setModal(p => ({ ...p, isOpen: false }))
            });
        } finally {
            setPhotoUploading(false);
            if (photoInputRef.current) photoInputRef.current.value = '';
        }
    };

    const handleDeletePhoto = async (e) => {
        e.stopPropagation();
        if (!previewStudentId) return;
        if (!window.confirm("Remove this student's photo from database?")) return;

        try {
            const res = await fetch(`${API_URL}/api/student-photo/${encodeURIComponent(previewStudentId)}?academicYear=${filters.academicYear || '2026'}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setCurrentPhoto(null);
                logActivity(userData, 'Deleted Student Photo', { studentId: previewStudentId });
            }
        } catch (err) {
            console.error("Failed to delete photo:", err);
        }
    };

    useEffect(() => {
        if (!previewStudentId) {
            setStudentErpQuestions([]);
            setErpLoading(false);
            return;
        }

        let isMounted = true;
        setErpLoading(true);
        fetchStudentErpQuestionsForPdf(previewStudentId, previewStudentName).then(qList => {
            if (isMounted) {
                setStudentErpQuestions(qList);
                setErpLoading(false);
            }
        }).catch((err) => {
            console.error("ERP question loading error:", err);
            if (isMounted) {
                setStudentErpQuestions([]);
                setErpLoading(false);
            }
        });
        return () => { isMounted = false; };
    }, [previewStudentId, previewStudentName, filters.academicYear, filters.campus, filters.stream, filters.testType, filters.test, filters.topAll]);

    useEffect(() => {
        if (previewRows && previewRows.length > 0) {
            const student = previewRows[0];
            const parentPhone = student.PARENT_MOBILE || student.PARENT_PHONE || student.MOBILE || student.MOB_NO || student.PHONE || '';
            if (parentPhone) {
                setWhatsappNumber(String(parentPhone).trim());
            }
        }
    }, [previewStudentId, previewRows]);

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

    // Calculate dynamic remarks
    const computedRemarks = useMemo(() => {
        if (!previewRows || previewRows.length === 0) return '';
        if (customRemarks[previewStudentId]) return customRemarks[previewStudentId];
        return generateDynamicRemarks(previewStudentName, transformedPreviewRows, performanceDiagnostics, studentErpQuestions);
    }, [previewRows, customRemarks, previewStudentId, previewStudentName, transformedPreviewRows, performanceDiagnostics, studentErpQuestions]);

    const handleSendWhatsApp = async () => {
        const rawNumber = String(whatsappNumber || '').trim().replace(/\D/g, '');
        if (!rawNumber || rawNumber.length < 10) {
            setModal({
                isOpen: true,
                type: 'info',
                title: 'Invalid WhatsApp Number',
                message: 'Please enter a valid 10-digit parent WhatsApp phone number.',
                onClose: () => setModal(p => ({ ...p, isOpen: false }))
            });
            return;
        }

        const cleanPhone = rawNumber.length === 10 ? `91${rawNumber}` : rawNumber;
        const studentName = previewRows[0]?.NAME_OF_THE_STUDENT || 'Student';
        const studentId = previewRows[0]?.STUD_ID || '';
        const campus = previewRows[0]?.CAMPUS_NAME || '';
        const stream = getNormalizedStream(previewRows);

        const avgScore = previewRows.length > 0 
            ? Math.round(previewRows.reduce((a, b) => a + (Number(b.Tot_720) || 0), 0) / previewRows.length)
            : 0;

        const examRows = (transformedPreviewRows && transformedPreviewRows.length > 0) ? transformedPreviewRows : previewRows;
        const examSummaryLines = examRows.map(row => {
            const testName = row.Test?.trim() || 'Exam';
            if (row.isAB) {
                return `• *${testName}:* AB (Absent)`;
            } else {
                const total = Math.round(Number(row.Tot_720) || 0);
                const air = (row.AIR && !isNaN(row.AIR) && Number(row.AIR) > 0) ? ` (AIR: ${Math.round(row.AIR)})` : '';
                return `• *${testName}:* ${total} / 720${air}`;
            }
        }).join('\n');

        const message = `*SRI CHAITANYA EDUCATIONAL INSTITUTIONS*\n` +
            `*Progress Report Summary*\n\n` +
            `*Student Name:* ${studentName}\n` +
            `*Student ID:* ${studentId}\n` +
            `*Campus:* ${campus}\n` +
            (stream ? `*Stream:* ${stream}\n` : '') +
            `\n*EXAM WISE RESULTS:*\n` +
            `${examSummaryLines}\n\n` +
            `*OVERALL AVERAGE SCORE:* ${avgScore} / 720\n\n` +
            `Dear Parent,\n` +
            `Please review the detailed Progress Report PDF for *${studentName}* attached with this message.\n\n` +
            `Best Regards,\n` +
            `*Sri Chaitanya Academic Team*`;

        if (previewStudentId) {
            await downloadPDF(previewStudentId);
        } else {
            await downloadPDF();
        }

        const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
    };

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
                        anchor: 'end',
                        offset: 6,
                        color: '#0f172a', // High contrast Dark Navy text in Web view!
                        backgroundColor: '#ffffff',
                        borderColor: '#cbd5e1',
                        borderWidth: 1.5,
                        borderRadius: 4,
                        padding: { top: 2, bottom: 2, left: 5, right: 5 },
                        font: { weight: 'bold', size: 11 }, // Restored original 11px bold font in Web UI!
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
            y: { beginAtZero: true, max: 800, ticks: { padding: 10 }, title: { display: true, text: 'Total Marks / 720' } },
            x: { offset: true, title: { display: true, text: 'Exams' } }
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
                    <div className="button-group" style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.86rem', color: '#334155', fontWeight: '600', userSelect: 'none', background: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                            <input
                                type="checkbox"
                                checked={includeChart}
                                onChange={(e) => setIncludeChart(e.target.checked)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
                            />
                            Include Chart & Analysis
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '0.86rem', color: '#334155', fontWeight: '600', userSelect: 'none', background: '#f1f5f9', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                            <input
                                type="checkbox"
                                checked={includeTopicDetails}
                                onChange={(e) => setIncludeTopicDetails(e.target.checked)}
                                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#2563eb' }}
                            />
                            Include Topic & Subtopic Details
                        </label>
                        <button className="btn-primary" onClick={fetchData} disabled={isDownloading || isExcelDownloading} style={{ backgroundColor: '#6366f1' }}>
                            View Report
                        </button>
                        <button 
                            className="btn-primary" 
                            onClick={() => downloadPDF()} 
                            disabled={history.length === 0 || isDownloading || isExcelDownloading} 
                            style={{ 
                                backgroundColor: isDownloading ? '#64748b' : '#10b981', 
                                cursor: (history.length === 0 || isDownloading || isExcelDownloading) ? 'not-allowed' : (isDownloading ? 'wait' : 'pointer'),
                                minWidth: '160px', 
                                transition: 'all 0.2s ease' 
                            }}
                        >
                            {isDownloading ? (
                                downloadProgress.total > 1 
                                    ? `Preparing ${downloadProgress.current}/${downloadProgress.total}...` 
                                    : 'Generating PDF...'
                            ) : (
                                uniqueStudents > 1 ? `Download All (${uniqueStudents})` : 'Download PDF'
                            )}
                        </button>
                        <button 
                            className="btn-primary" 
                            onClick={() => downloadExcel()} 
                            disabled={history.length === 0 || isDownloading || isExcelDownloading} 
                            style={{ 
                                backgroundColor: isExcelDownloading ? '#64748b' : '#059669', 
                                cursor: (history.length === 0 || isDownloading || isExcelDownloading) ? 'not-allowed' : (isExcelDownloading ? 'wait' : 'pointer'),
                                minWidth: '160px', 
                                transition: 'all 0.2s ease' 
                            }}
                        >
                            {isExcelDownloading ? (
                                excelProgress.total > 1 
                                    ? `Preparing Excel ${excelProgress.current}/${excelProgress.total}...` 
                                    : 'Generating Excel...'
                            ) : (
                                uniqueStudents > 1 ? `Download Excel (${uniqueStudents})` : 'Download Excel'
                            )}
                        </button>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', padding: '4px 8px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                            <input
                                type="tel"
                                placeholder="Parent WhatsApp No."
                                value={whatsappNumber}
                                onChange={(e) => setWhatsappNumber(e.target.value)}
                                disabled={history.length === 0 || isDownloading || isExcelDownloading}
                                maxLength={13}
                                style={{
                                    padding: '6px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid #86efac',
                                    fontSize: '0.85rem',
                                    width: '165px',
                                    outline: 'none',
                                    background: 'white',
                                    color: '#1e293b',
                                    fontWeight: '500'
                                }}
                            />
                            <button
                                type="button"
                                className="btn-whatsapp"
                                onClick={handleSendWhatsApp}
                                disabled={history.length === 0 || isDownloading || isExcelDownloading}
                                title="Download PDF & Open WhatsApp"
                                style={{
                                    cursor: (history.length === 0 || isDownloading || isExcelDownloading) ? 'not-allowed' : 'pointer',
                                    opacity: (history.length === 0 || isDownloading || isExcelDownloading) ? 0.6 : 1,
                                    padding: '7px 14px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    textTransform: 'none'
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.573-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.99c-.002 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                </svg>
                                Send WhatsApp
                            </button>
                        </div>
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
                            <div className="report-card-wrapper">
                                <div className="report-card-sheet">
                                    {/* Header */}
                                    <div className="rc-header">
                                        <img src="/logo.png" alt="Sri Chaitanya Logo" className="rc-logo" />
                                        <div className="rc-title">
                                            <span className="rc-title-primary">Sri Chaitanya</span>
                                            <span className="rc-title-secondary">Educational Institutions</span>
                                        </div>
                                        <div className="rc-ribbon-container">
                                            <div className="rc-ribbon">PROGRESS REPORT CARD</div>
                                        </div>
                                    </div>

                                    {/* Student Info & Photo Section */}
                                    <div className="rc-student-section">
                                        <table className="rc-info-table">
                                            <tbody>
                                                <tr>
                                                    <td className="rc-info-label">Type of Report Card</td>
                                                    <td className="rc-info-value">Academic</td>
                                                </tr>
                                                <tr>
                                                    <td className="rc-info-label">Name of the Student</td>
                                                    <td className="rc-info-value">{previewRows[0]?.NAME_OF_THE_STUDENT || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="rc-info-label">Student ID</td>
                                                    <td className="rc-info-value">{previewRows[0]?.STUD_ID || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="rc-info-label">Campus and Stream</td>
                                                    <td className="rc-info-value">
                                                        {previewRows[0]?.CAMPUS_NAME || '-'} · {getNormalizedStream(previewRows)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        {/* Photo Box */}
                                        <div 
                                            className="rc-photo-box" 
                                            onClick={() => photoInputRef.current?.click()}
                                            title={currentPhoto ? "Click to change photo" : "Click to upload student photo (saved directly to TiDB)"}
                                        >
                                            <input 
                                                type="file" 
                                                ref={photoInputRef} 
                                                onChange={handlePhotoUpload} 
                                                accept="image/*" 
                                                style={{ display: 'none' }} 
                                            />

                                            {photoUploading ? (
                                                <div className="rc-photo-placeholder">
                                                    <span style={{ fontSize: '11px', color: '#5D6788' }}>Saving to TiDB...</span>
                                                </div>
                                            ) : currentPhoto ? (
                                                <>
                                                    <img src={currentPhoto} alt="Student" className="rc-photo-img" />
                                                    <div className="rc-photo-overlay">
                                                        <span style={{ fontSize: '10px', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <Camera size={12} /> Change
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={handleDeletePhoto}
                                                            style={{
                                                                background: '#ef4444',
                                                                color: '#ffffff',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                padding: '2px 6px',
                                                                fontSize: '10px',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '3px'
                                                            }}
                                                        >
                                                            <Trash2 size={10} /> Delete
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="rc-photo-placeholder">
                                                    <div className="rc-photo-initials">
                                                        {getStudentInitials(previewRows[0]?.NAME_OF_THE_STUDENT)}
                                                    </div>
                                                    <div className="rc-photo-add-text">
                                                        <Camera size={12} /> Click to add photo
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Section Heading */}
                                    <h3 className="rc-section-heading">Test-wise record</h3>

                                    {/* Test-wise Table */}
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="rc-test-table">
                                            <thead>
                                                <tr>
                                                    <th className="th-test">Test</th>
                                                    <th>Date</th>
                                                    <th>Total /720</th>
                                                    <th>AIR</th>
                                                    <th>Bot</th>
                                                    <th>Zoo</th>
                                                    <th>Phy</th>
                                                    <th>Chem</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {allExams.map((exam, idx) => {
                                                    const examTest = exam.Test?.trim();
                                                    const row = previewRows.find(r => r.Test?.trim() === examTest);
                                                    if (row) {
                                                        return (
                                                            <tr key={idx}>
                                                                <td className="td-test">{row.Test}</td>
                                                                <td className="td-date">{formatDate(row.DATE)}</td>
                                                                <td className="td-total">{Math.round(row.Tot_720 || 0)}</td>
                                                                <td>{Math.round(row.AIR) || '-'}</td>
                                                                <td className="td-mark">{Math.round(row.Botany || 0)}</td>
                                                                <td className="td-mark">{Math.round(row.Zoology || 0)}</td>
                                                                <td className="td-mark">{Math.round(row.Physics || 0)}</td>
                                                                <td className="td-mark">{Math.round(row.Chemistry || 0)}</td>
                                                            </tr>
                                                        );
                                                    } else {
                                                        return (
                                                            <tr key={idx} className="rc-absent-row">
                                                                <td className="td-test">{exam.Test}</td>
                                                                <td className="td-date">{formatDate(exam.DATE)}</td>
                                                                <td colSpan={6} className="td-absent">Absent</td>
                                                            </tr>
                                                        );
                                                    }
                                                })}

                                                {/* Average Row */}
                                                {previewRows.length > 0 && (
                                                    <tr className="rc-avg-row">
                                                        <td className="td-avg-label" colSpan={2}>Average</td>
                                                        <td>{Math.round(previewRows.reduce((a, b) => a + (Number(b.Tot_720) || 0), 0) / previewRows.length)}</td>
                                                        <td>{Math.round(previewRows.reduce((a, b) => a + (Number(b.AIR) || 0), 0) / previewRows.length)}</td>
                                                        <td>{Math.round(previewRows.reduce((a, b) => a + (Number(b.Botany) || 0), 0) / previewRows.length)}</td>
                                                        <td>{Math.round(previewRows.reduce((a, b) => a + (Number(b.Zoology) || 0), 0) / previewRows.length)}</td>
                                                        <td>{Math.round(previewRows.reduce((a, b) => a + (Number(b.Physics) || 0), 0) / previewRows.length)}</td>
                                                        <td>{Math.round(previewRows.reduce((a, b) => a + (Number(b.Chemistry) || 0), 0) / previewRows.length)}</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>



                                    {/* Remarks Box */}
                                    <div className="rc-remarks-box">
                                        {isEditingRemarks ? (
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <span className="rc-remarks-title">Edit Remarks:</span>
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setCustomRemarks(prev => ({ ...prev, [previewStudentId]: tempRemarksText }));
                                                                setIsEditingRemarks(false);
                                                            }}
                                                            style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', padding: '3px 10px', fontSize: '12px', cursor: 'pointer' }}
                                                        >
                                                            Save
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsEditingRemarks(false)}
                                                            style={{ background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', padding: '3px 10px', fontSize: '12px', cursor: 'pointer' }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                                <textarea
                                                    value={tempRemarksText}
                                                    onChange={(e) => setTempRemarksText(e.target.value)}
                                                    rows={3}
                                                    style={{ width: '100%', fontFamily: 'inherit', fontSize: '16px', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                                                />
                                            </div>
                                        ) : (
                                            <div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div>
                                                        <span className="rc-remarks-title">Remarks:</span>
                                                        <span>{computedRemarks}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setTempRemarksText(computedRemarks);
                                                            setIsEditingRemarks(true);
                                                        }}
                                                        title="Customize Remarks"
                                                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '2px 4px' }}
                                                    >
                                                        <Edit3 size={14} color="#2D56C9" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Signatures */}
                                    <div className="rc-signatures">
                                        <div className="rc-sig-col">
                                            <div className="rc-sig-line"></div>
                                            <div className="rc-sig-label">Class Teacher</div>
                                        </div>
                                        <div className="rc-sig-col">
                                            <div className="rc-sig-line"></div>
                                            <div className="rc-sig-label">Parent / Guardian</div>
                                        </div>
                                        <div className="rc-sig-col">
                                            <div className="rc-sig-line"></div>
                                            <div className="rc-sig-label">Principal</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Modern Performance Chart & Lagging Subject Marks Loss Card (Only shown when includeChart is true) */}
                        {includeChart && chartData && performanceDiagnostics && (
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
                                        <strong style={{ fontSize: '1rem', color: '#003399' }}>{performanceDiagnostics.laggingSubjectName} ({performanceDiagnostics.laggingAvg}/{performanceDiagnostics.laggingMax})</strong>
                                    </div>

                                    <div style={{ background: '#f1f5f9', padding: '12px 14px', borderRadius: '6px' }}>
                                        <span style={{ fontWeight: 'bold', color: '#1e3a8a', display: 'block', marginBottom: '8px', fontSize: '0.9rem' }}>
                                            Marks Loss in {performanceDiagnostics.laggingSubjectName} across Tests:
                                        </span>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 10px', fontSize: '0.88rem' }}>
                                            {performanceDiagnostics.testLosses.map((item, idx) => (
                                                <span key={idx} style={{ background: '#ffffff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
                                                    <span style={{ fontWeight: '800', color: '#0F2057' }}>{item.testName}: </span>
                                                    <span style={{ fontWeight: '800', color: '#dc2626' }}>{item.lossText}</span>
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Wrong & Unattempted Questions (Topic & Subtopic Details) Table */}
                        {includeTopicDetails && previewRows.length > 0 && (
                            <div className="drawer-subject-breakdown" style={{ marginTop: '24px', background: '#ffffff', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                        Wrong & Unattempted Questions (Topic & Subtopic Details)
                                    </h4>
                                    <span className="q-count-badge" style={{ background: '#eff6ff', color: '#1e40af', padding: '3px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: '800' }}>
                                        {studentErpQuestions.length} items
                                    </span>
                                </div>

                                {erpLoading ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
                                        Loading Topic & Subtopic details...
                                    </div>
                                ) : studentErpQuestions.length > 0 ? (
                                    <div style={{ overflowX: 'auto' }}>
                                        <table className="drawer-mini-table topic-details-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                            <thead>
                                                <tr style={{ background: '#1e3a8a', color: '#ffffff' }}>
                                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: '800' }}>Test</th>
                                                    <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: '800' }}>Q.No</th>
                                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: '800' }}>Subject</th>
                                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: '800' }}>Topic</th>
                                                    <th style={{ textAlign: 'left', padding: '10px 14px', fontWeight: '800' }}>Sub-Topic</th>
                                                    <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: '800' }}>Status</th>
                                                    <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: '800' }}>Marks Lost</th>
                                                    <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: '800' }}>Key</th>
                                                    <th style={{ textAlign: 'center', padding: '10px 14px', fontWeight: '800' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {studentErpQuestions.map((q, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '10px 14px', fontWeight: 'bold' }}>{q.test}</td>
                                                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold' }}>Q{q.qNo}</td>
                                                        <td style={{ padding: '10px 14px', fontWeight: 'bold' }}>{q.subject}</td>
                                                        <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1e293b', whiteSpace: 'normal', wordBreak: 'break-word' }}>{q.topic}</td>
                                                        <td style={{ padding: '10px 14px', color: '#475569', whiteSpace: 'normal', wordBreak: 'break-word' }}>{q.subTopic || '-'}</td>
                                                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                            <span className={`status-badge ${q.status.toLowerCase()}`}>
                                                                {q.status === 'W' ? 'Wrong (W)' : 'Unattempted (U)'}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold', color: '#dc2626' }}>
                                                            -{q.lost}
                                                        </td>
                                                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold', color: '#16a34a' }}>
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                                <span>{q.keyValue || '-'}</span>
                                                                <button
                                                                    title="Edit Answer Key"
                                                                    className="key-edit-pen-btn"
                                                                    style={{
                                                                        background: '#f1f5f9',
                                                                        border: '1px solid #cbd5e1',
                                                                        borderRadius: '4px',
                                                                        padding: '3px 5px',
                                                                        cursor: 'pointer',
                                                                        color: '#475569',
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center'
                                                                    }}
                                                                    onClick={() => handleEditKey(q)}
                                                                >
                                                                    <Edit3 size={12} color="#2563eb" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                                                            {q.qUrl ? (
                                                                <button 
                                                                    className="q-preview-btn-sm"
                                                                    onClick={() => setZoomImage({ url: q.qUrl, title: `${q.test} - Q${q.qNo} (${q.subject}): ${q.topic}` })}
                                                                >
                                                                    <Maximize2 size={12} /> View
                                                                </button>
                                                            ) : '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem', fontWeight: '500' }}>
                                        This test has no topic or subtopics.
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Edit Key Modal */}
            {editingKeyItem && (
                <div className="zoom-modal-overlay" onClick={() => setEditingKeyItem(null)}>
                    <div style={{ background: 'white', borderRadius: '14px', width: '90%', maxWidth: '420px', padding: '24px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)' }} onClick={(e) => e.stopPropagation()}>
                        <h4 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '1.05rem', fontWeight: '800' }}>Edit Answer Key</h4>
                        <p style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: '#64748b' }}>
                            Test: <strong style={{ color: '#1e3a8a' }}>{editingKeyItem.test}</strong> | Q.No: <strong style={{ color: '#1e3a8a' }}>Q{editingKeyItem.qNo}</strong> ({editingKeyItem.subject})
                        </p>
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>Correct Answer Key Option</label>
                            <input
                                type="text"
                                value={newKeyValue}
                                onChange={(e) => setNewKeyValue(e.target.value)}
                                placeholder="Enter key (e.g. 1, 2, 3, 4)"
                                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', fontWeight: 'bold', boxSizing: 'border-box' }}
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <button className="btn-secondary" onClick={() => setEditingKeyItem(null)} disabled={isUpdatingKey}>Cancel</button>
                            <button className="btn-primary" onClick={saveUpdatedKey} disabled={isUpdatingKey} style={{ backgroundColor: '#2563eb' }}>
                                {isUpdatingKey ? 'Saving...' : 'Save Key'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Question Image Zoom Modal */}
            {zoomImage && (
                <div className="zoom-modal-overlay" onClick={() => setZoomImage(null)}>
                    <div className="zoom-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="zoom-modal-header">
                            <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '800', color: '#0f172a' }}>{zoomImage.title}</h5>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem', fontWeight: '700' }} onClick={() => setZoomScale(prev => Math.min(prev + 0.5, 4))}>+</button>
                                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem', fontWeight: '700' }} onClick={() => setZoomScale(prev => Math.max(prev - 0.5, 1))}>-</button>
                                <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem', fontWeight: '700' }} onClick={() => { setZoomScale(1); setZoomOffset({ x: 0, y: 0 }); }}>Reset</button>
                                <button className="zoom-close-btn" onClick={() => setZoomImage(null)}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        <div 
                            className="zoom-modal-body"
                            ref={zoomContainerRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            style={{ cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                        >
                            <img 
                                src={zoomImage.url} 
                                alt={zoomImage.title} 
                                className="zoomable-image"
                                style={{
                                    transform: `translate(${zoomOffset.x}px, ${zoomOffset.y}px) scale(${zoomScale})`,
                                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                                }}
                                draggable={false}
                            />
                        </div>
                    </div>
                </div>
            )}

            <Modal
                isOpen={modal.isOpen}
                onClose={() => setModal({ ...modal, isOpen: false })}
                title={modal.title}
                message={modal.message}
                type={modal.type}
            />

            <style>{`
                .q-preview-btn-sm {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    background: #eff6ff;
                    color: #1d4ed8;
                    border: 1px solid #bfdbfe;
                    padding: 3px 8px;
                    border-radius: 6px;
                    font-size: 0.78rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .q-preview-btn-sm:hover {
                    background: #dbeafe;
                    color: #1e40af;
                }
                .zoom-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(4px);
                    z-index: 100000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .zoom-modal-content {
                    background: white;
                    border-radius: 14px;
                    width: 90%;
                    max-width: 1100px;
                    height: 85vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.3);
                }
                .zoom-modal-header {
                    padding: 14px 20px;
                    background: #f8fafc;
                    border-bottom: 1px solid #cbd5e1;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .zoom-close-btn {
                    border: none;
                    background: transparent;
                    color: #475569;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 50%;
                }
                .zoom-close-btn:hover {
                    background: #e2e8f0;
                }
                .zoom-modal-body {
                    padding: 20px;
                    flex: 1;
                    overflow: auto;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background: #f1f5f9;
                    position: relative;
                }
                .zoomable-image {
                    max-width: 100%;
                    max-height: 75vh;
                    object-fit: contain;
                    border-radius: 6px;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.15);
                }
            `}</style>
        </div>
    );
};

export default AverageReport;
