import React, { useState, useEffect, useMemo, useRef } from 'react';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import LoadingTimer from './LoadingTimer';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { logActivity } from '../utils/activityLogger';
import { useAuth } from './auth/AuthProvider';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Select, { components } from 'react-select';
import { 
    Award, 
    Activity, 
    MapPin, 
    FileText,
    X, 
    Maximize2, 
    AlertTriangle, 
    BookOpen, 
    TrendingUp, 
    HelpCircle,
    CheckCircle,
    ChevronRight,
    Users,
    Download,
    SlidersHorizontal,
    Sparkles,
    UserCheck
} from 'lucide-react';

const loadFont = async (url) => {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
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

const loadImage = (url) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
};

const createHighResChartImage = (type, data, options, width = 1400, height = 950) => {
    return new Promise((resolve) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            const chart = new ChartJS(ctx, {
                type: type,
                data: data,
                options: {
                    ...options,
                    responsive: false,
                    animation: false,
                    devicePixelRatio: 2
                }
            });

            setTimeout(() => {
                const imgData = canvas.toDataURL('image/png', 1.0);
                chart.destroy();
                resolve(imgData);
            }, 80);
        } catch (e) {
            console.error("Offscreen 4K chart error:", e);
            resolve(null);
        }
    });
};

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    ChartDataLabels
);

// Custom components for multi-select dropdown with checkboxes
const CheckboxOption = (props) => {
    return (
        <components.Option {...props}>
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                    type="checkbox"
                    checked={props.isSelected}
                    onChange={() => null}
                    style={{ 
                        marginRight: '8px', 
                        cursor: 'pointer',
                        accentColor: '#1e40af',
                        pointerEvents: 'none'
                    }}
                />
                <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: '500' }}>{props.label}</span>
            </div>
        </components.Option>
    );
};

const CompactValueContainer = ({ children, ...props }) => {
    const selected = props.getValue().filter(v => v.value !== "SELECT_ALL");
    const totalOptions = props.options.filter(v => v.value !== "SELECT_ALL").length;
    
    if (selected.length > 2) {
        return (
            <components.ValueContainer {...props}>
                <div style={{
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    color: '#1e3a8a',
                    whiteSpace: 'nowrap',
                    background: '#eff6ff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span style={{ opacity: 0.7 }}>📊</span>
                    {selected.length === totalOptions ? 'All Exams Selected' : `${selected.length} Selected`}
                </div>
                {children.map(child => child && child.type?.name === 'Input' ? child : null)}
                {Array.isArray(children) ? children.filter(c => c && (c.key === 'placeholder' || (c.props && c.props.editable))) : children}
            </components.ValueContainer>
        );
    }
    return <components.ValueContainer {...props}>{children}</components.ValueContainer>;
};

const reactSelectStyles = {
    control: (provided) => ({
        ...provided,
        minHeight: '38px',
        borderRadius: '8px',
        borderColor: '#cbd5e1',
        boxShadow: 'none',
        '&:hover': { borderColor: '#94a3b8' }
    }),
    valueContainer: (provided) => ({
        ...provided,
        padding: '2px 10px'
    }),
    input: (provided) => ({
        ...provided,
        margin: '0',
        padding: '0'
    }),
    menu: (provided) => ({
        ...provided,
        zIndex: 9999
    })
};

const TopperMarksLossReport = ({ filters, setFilters, setActivePage }) => {
    const { userData } = useAuth();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Top N Filter State
    const [topLimit, setTopLimit] = useState(10);
    const [customInput, setCustomInput] = useState('10');
    
    // Selected Student State
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [erpData, setErpData] = useState([]);
    const [erpLoading, setErpLoading] = useState(false);
    const [selectedErpTests, setSelectedErpTests] = useState([]);
    const [zoomImage, setZoomImage] = useState(null);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const subjectBarChartRef = useRef(null);
    const lossDoughnutChartRef = useRef(null);

    // Zoom and pan states for question preview
    const [zoomScale, setZoomScale] = useState(1);
    const [zoomOffset, setZoomOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const zoomContainerRef = useRef(null);

    // Reset zoom when image changes
    useEffect(() => {
        setZoomScale(1);
        setZoomOffset({ x: 0, y: 0 });
        setIsDragging(false);
    }, [zoomImage]);

    // Handle mouse wheel zoom
    useEffect(() => {
        const handleWheelEvent = (e) => {
            if (zoomImage) {
                e.preventDefault();
                const delta = e.deltaY;
                const zoomSpeed = 0.15;
                setZoomScale(prev => {
                    let next = prev + (delta < 0 ? zoomSpeed : -zoomSpeed);
                    next = Math.min(Math.max(next, 1), 6);
                    if (next === 1) {
                        setZoomOffset({ x: 0, y: 0 });
                    }
                    return next;
                });
            }
        };

        const container = zoomContainerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheelEvent, { passive: false });
        }
        return () => {
            if (container) {
                container.removeEventListener('wheel', handleWheelEvent);
            }
        };
    }, [zoomImage]);

    const handleMouseDown = (e) => {
        if (zoomScale > 1) {
            setIsDragging(true);
            setDragStart({
                x: e.clientX - zoomOffset.x,
                y: e.clientY - zoomOffset.y
            });
        }
    };

    const handleMouseMove = (e) => {
        if (isDragging && zoomScale > 1) {
            setZoomOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Fetch data using analysis-report endpoint
    useEffect(() => {
        const controller = new AbortController();
        const fetchData = async () => {
            setLoading(true);
            try {
                const queryParams = buildQueryParams(filters).toString();
                const res = await fetch(`${API_URL}/api/analysis-report?${queryParams}`, { signal: controller.signal });
                const data = await res.json();
                
                if (!controller.signal.aborted && data) {
                    const fetchedStudents = data.students || [];
                    setStudents(fetchedStudents);
                    
                    if (fetchedStudents.length > 0) {
                        const sorted = [...fetchedStudents].sort((a, b) => (Number(b.tot) || 0) - (Number(a.tot) || 0));
                        setSelectedStudent(sorted[0]);
                        logActivity(userData, 'Generated Toppers Marks Loss Report', { count: fetchedStudents.length });
                    } else {
                        setSelectedStudent(null);
                    }
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error("Failed to fetch toppers data:", error);
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchData, 400);
        return () => { controller.abort(); clearTimeout(timeoutId); };
    }, [filters]);

    // Handle top limit change
    const handleSetTopLimit = (num) => {
        const parsed = parseInt(num, 10);
        if (!isNaN(parsed) && parsed > 0) {
            setTopLimit(parsed);
            setCustomInput(String(parsed));
        }
    };

    // Slice toppers list based on topLimit
    const toppersList = useMemo(() => {
        if (!students || students.length === 0) return [];
        const sorted = [...students].sort((a, b) => (Number(b.tot) || 0) - (Number(a.tot) || 0));
        return sorted.slice(0, topLimit);
    }, [students, topLimit]);

    // Update selectedStudent if current one is not in toppersList
    useEffect(() => {
        if (toppersList.length > 0) {
            const exists = toppersList.some(s => s.STUD_ID === selectedStudent?.STUD_ID);
            if (!exists) {
                setSelectedStudent(toppersList[0]);
            }
        } else {
            setSelectedStudent(null);
        }
    }, [toppersList]);

    // Fetch ERP data for the selected student
    useEffect(() => {
        if (!selectedStudent) {
            setErpData([]);
            setSelectedErpTests([]);
            return;
        }

        const fetchErpData = async () => {
            setErpLoading(true);
            try {
                const year = filters.academicYear || '2026';
                const res = await fetch(`${API_URL}/api/erp/report?academicYear=${year}&studentSearch=${selectedStudent.STUD_ID}`);
                const data = await res.json();
                const safeData = Array.isArray(data) ? data : [];
                setErpData(safeData);
                
                if (safeData.length > 0) {
                    const uniqueTests = [...new Set(safeData.map(r => r.Test).filter(Boolean))];
                    if (filters?.test && Array.isArray(filters.test) && filters.test.length > 0) {
                        const filterTestsLower = filters.test.map(t => String(t).trim().toLowerCase());
                        const matched = uniqueTests.filter(t => {
                            const tLower = String(t).trim().toLowerCase();
                            return filterTestsLower.some(ft => ft === tLower || tLower.includes(ft) || ft.includes(tLower));
                        });
                        if (matched.length > 0) {
                            setSelectedErpTests(matched);
                        } else {
                            setSelectedErpTests(uniqueTests);
                        }
                    } else {
                        setSelectedErpTests(uniqueTests);
                    }
                } else {
                    setSelectedErpTests([]);
                }
            } catch (error) {
                console.error("Failed to fetch ERP data for topper:", error);
                setErpData([]);
                setSelectedErpTests([]);
            } finally {
                setErpLoading(false);
            }
        };

        fetchErpData();
    }, [selectedStudent, filters.academicYear, filters.test]);

    // Calculate Marks Loss Details for current selected tests
    const erpAnalysis = useMemo(() => {
        if (!selectedStudent || erpData.length === 0 || !selectedErpTests || selectedErpTests.length === 0) {
            return { 
                totalLost: 0, 
                wrongCount: 0, 
                wrongLost: 0, 
                unattemptedCount: 0, 
                unattemptedLost: 0, 
                questions: [], 
                subjects: {
                    BOTANY: { w: 0, u: 0, lost: 0 },
                    ZOOLOGY: { w: 0, u: 0, lost: 0 },
                    PHYSICS: { w: 0, u: 0, lost: 0 },
                    CHEMISTRY: { w: 0, u: 0, lost: 0 }
                },
                scoredMarks: { BOTANY: 180, ZOOLOGY: 180, PHYSICS: 180, CHEMISTRY: 180 },
                totalScored: 720
            };
        }

        const testRows = erpData.filter(r => selectedErpTests.includes(r.Test));
        
        let wrongCount = 0;
        let unattemptedCount = 0;
        const questionsList = [];
        
        const subMap = {
            BOTANY: { w: 0, u: 0, lost: 0 },
            ZOOLOGY: { w: 0, u: 0, lost: 0 },
            PHYSICS: { w: 0, u: 0, lost: 0 },
            CHEMISTRY: { w: 0, u: 0, lost: 0 }
        };

        testRows.forEach(row => {
            const status = String(row.W_U || '').trim().toUpperCase();
            const subject = String(row.Subject || '').trim().toUpperCase();
            let lost = 0;

            if (status === 'W') {
                wrongCount++;
                lost = 5;
                if (subMap[subject]) {
                    subMap[subject].w++;
                    subMap[subject].lost += 5;
                }
            } else if (status === 'U') {
                unattemptedCount++;
                lost = 4;
                if (subMap[subject]) {
                    subMap[subject].u++;
                    subMap[subject].lost += 4;
                }
            }

            questionsList.push({
                test: row.Test,
                qNo: row.Q_No,
                subject: row.Subject,
                topic: row.Topic || 'Unknown Topic',
                subTopic: row.Sub_Topic || '',
                status: status,
                lost: lost,
                qUrl: row.Q_URL,
                sUrl: row.S_URL,
                keyValue: row.Key_Value
            });
        });

        // Compute average scored marks per subject across all selected tests
        const testScores = selectedErpTests.map(tName => {
            const firstRowForTest = erpData.find(r => r.Test === tName);
            if (firstRowForTest) {
                return {
                    botany: Number(firstRowForTest.Botany) || 0,
                    zoology: Number(firstRowForTest.Zoology) || 0,
                    physics: Number(firstRowForTest.Physics) || 0,
                    chemistry: Number(firstRowForTest.Chemistry) || 0,
                    total: Number(firstRowForTest.Tot_720) || 0
                };
            } else {
                return { botany: 180, zoology: 180, physics: 180, chemistry: 180, total: 720 };
            }
        });

        const numTests = testScores.length || 1;
        const scoredMarks = {
            BOTANY: Math.round(testScores.reduce((sum, s) => sum + s.botany, 0) / numTests),
            ZOOLOGY: Math.round(testScores.reduce((sum, s) => sum + s.zoology, 0) / numTests),
            PHYSICS: Math.round(testScores.reduce((sum, s) => sum + s.physics, 0) / numTests),
            CHEMISTRY: Math.round(testScores.reduce((sum, s) => sum + s.chemistry, 0) / numTests)
        };
        const totalScored = Math.round(testScores.reduce((sum, s) => sum + s.total, 0) / numTests);

        const wrongLost = wrongCount * 5;
        const unattemptedLost = unattemptedCount * 4;
        const totalLost = wrongLost + unattemptedLost;

        return {
            totalLost,
            wrongCount,
            wrongLost,
            unattemptedCount,
            unattemptedLost,
            questions: questionsList.sort((a, b) => a.test.localeCompare(b.test) || a.qNo - b.qNo),
            subjects: subMap,
            scoredMarks,
            totalScored
        };
    }, [selectedStudent, erpData, selectedErpTests]);

    const uniqueTests = useMemo(() => [...new Set(erpData.map(r => r.Test))], [erpData]);

    // Download Student Marks Loss Report as PDF (Ultra-Sharp 4K Single Page Executive Report)
    const downloadStudentPdf = async () => {
        if (!selectedStudent || !erpAnalysis) return;
        setIsExportingPdf(true);

        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 12;
            const contentWidth = pageWidth - (margin * 2);

            // 1. Load fonts & logo in parallel
            const [impactFont, bookmanFont, bookmanBoldFont, logoImg] = await Promise.all([
                loadFont('/fonts/unicode.impact.ttf'),
                loadFont('/fonts/bookman-old-style.ttf'),
                loadFont('/fonts/BOOKOSB.TTF'),
                loadImage('/logo.png')
            ]);

            // Register Fonts if available
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

            // 2. Generate Ultra-Sharp Offscreen Charts with Large Bold Text
            const bar4kPromise = createHighResChartImage(
                'bar',
                {
                    labels: ['Botany', 'Zoology', 'Physics', 'Chemistry'],
                    datasets: [{
                        data: [
                            erpAnalysis.scoredMarks.BOTANY,
                            erpAnalysis.scoredMarks.ZOOLOGY,
                            erpAnalysis.scoredMarks.PHYSICS,
                            erpAnalysis.scoredMarks.CHEMISTRY
                        ],
                        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899'],
                        borderRadius: 8,
                        barThickness: 50,
                        datalabels: {
                            color: '#0f172a',
                            anchor: 'end',
                            align: 'end',
                            offset: 4,
                            font: { weight: 'bold', size: 30 },
                            formatter: (val) => val
                        }
                    }]
                },
                {
                    plugins: {
                        legend: { display: false },
                        datalabels: { display: true }
                    },
                    scales: {
                        x: {
                            grid: { display: false },
                            ticks: { font: { size: 26, weight: 'bold' }, color: '#0f172a', padding: 8 }
                        },
                        y: {
                            grid: { display: true, color: '#e2e8f0' },
                            max: 180,
                            ticks: { font: { size: 20, weight: 'bold' }, color: '#64748b', stepSize: 45 }
                        }
                    },
                    layout: { padding: { top: 45, bottom: 10, left: 15, right: 15 } }
                },
                750,
                550
            );

            const doughnut4kPromise = createHighResChartImage(
                'doughnut',
                {
                    labels: ['Botany', 'Zoology', 'Physics', 'Chemistry'],
                    datasets: [{
                        data: [
                            erpAnalysis.subjects.BOTANY.lost,
                            erpAnalysis.subjects.ZOOLOGY.lost,
                            erpAnalysis.subjects.PHYSICS.lost,
                            erpAnalysis.subjects.CHEMISTRY.lost
                        ],
                        backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899'],
                        borderWidth: 3,
                        borderColor: '#ffffff',
                        datalabels: {
                            color: '#ffffff',
                            font: { weight: 'bold', size: 28 },
                            formatter: (val) => val > 0 ? `-${val}` : ''
                        }
                    }]
                },
                {
                    cutout: '50%',
                    plugins: {
                        legend: {
                            display: true,
                            position: 'bottom',
                            labels: {
                                boxWidth: 24,
                                padding: 20,
                                font: { size: 24, weight: 'bold' },
                                color: '#0f172a'
                            }
                        },
                        datalabels: { display: true }
                    },
                    layout: { padding: { top: 15, bottom: 15, left: 15, right: 15 } }
                },
                750,
                550
            );

            const [bar4kImg, doughnut4kImg] = await Promise.all([bar4kPromise, doughnut4kPromise]);

            // 3. Top Accent Bar (Positioned high with generous margin to avoid colliding with text)
            let y = 10;
            doc.setFillColor(15, 23, 42); // Navy dark #0f172a
            doc.rect(margin, y, contentWidth, 2.5, 'F');
            doc.setFillColor(245, 158, 11); // Amber accent #f59e0b
            doc.rect(margin, y + 2.5, contentWidth, 1, 'F');

            y = 22; // Clear 8.5mm spacing below accent bar

            // 4. Logo & Institution Header
            let logoW = 0;
            const logoH = 11;
            if (logoImg && logoImg.width) {
                const asp = logoImg.width / logoImg.height;
                logoW = logoH * asp;
            }

            const part1 = "Sri Chaitanya";
            const part2 = " Educational Institutions";

            doc.setFontSize(22);
            if (impactFont) doc.setFont("Impact", "normal");
            else doc.setFont("helvetica", "bold");
            const w1 = doc.getTextWidth(part1);

            if (bookmanFont) doc.setFont("Bookman", "normal");
            else doc.setFont("helvetica", "normal");
            const w2 = doc.getTextWidth(part2);

            const gap = logoImg ? 4 : 0;
            const totalWidth = logoW + gap + w1 + w2;
            const startX = Math.max(margin, (pageWidth - totalWidth) / 2);
            let currentX = startX;

            if (logoImg) {
                try {
                    doc.addImage(logoImg, 'PNG', currentX, y - 7.5, logoW, logoH);
                } catch (e) {}
                currentX += logoW + gap;
            }

            if (impactFont) doc.setFont("Impact", "normal");
            else doc.setFont("helvetica", "bold");
            doc.setTextColor(0, 112, 192);
            doc.text(part1, currentX, y);

            if (bookmanFont) doc.setFont("Bookman", "normal");
            else doc.setFont("helvetica", "normal");
            doc.setTextColor(0, 112, 192);
            doc.text(part2, currentX + w1, y);

            y += 6;
            doc.setFont("helvetica", "bold");
            doc.setFontSize(8.5);
            doc.setTextColor(71, 85, 105);
            doc.text("Central Office, Bangalore • Academic Performance Division", pageWidth / 2, y, { align: 'center' });

            y += 6;
            // Document Main Title Banner
            doc.setFillColor(30, 58, 138); // #1e3a8a
            doc.roundedRect(margin, y, contentWidth, 9, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text("STUDENT MARKS LOSS & PERFORMANCE ANALYSIS REPORT", pageWidth / 2, y + 6, { align: 'center' });

            y += 13;

            // 5. Student Information Profile Box
            doc.setFillColor(248, 250, 252); // #f8fafc
            doc.setDrawColor(226, 232, 240); // #e2e8f0
            doc.setLineWidth(0.4);
            doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

            doc.setFontSize(9);
            doc.setTextColor(15, 23, 42);

            const col1X = margin + 5;
            const col2X = margin + (contentWidth / 2) + 5;

            // Left Column
            doc.setFont("helvetica", "bold");
            doc.text("Student Name:", col1X, y + 6);
            doc.setFont("helvetica", "normal");
            doc.text(selectedStudent.name || '-', col1X + 26, y + 6);

            doc.setFont("helvetica", "bold");
            doc.text("Student ID:", col1X, y + 12);
            doc.setFont("helvetica", "normal");
            doc.text(String(selectedStudent.STUD_ID || '-'), col1X + 26, y + 12);

            doc.setFont("helvetica", "bold");
            doc.text("Campus:", col1X, y + 18);
            doc.setFont("helvetica", "normal");
            doc.text(selectedStudent.campus || '-', col1X + 26, y + 18);

            // Right Column
            const academicYr = filters.academicYear || '2026';
            const studentStream = selectedStudent.stream || selectedStudent.Stream || (erpData && erpData.length > 0 ? erpData.find(r => r.Stream)?.Stream : null) || (filters.stream && filters.stream.length > 0 ? filters.stream.join(', ') : '-');
            const testNameText = selectedErpTests.length === uniqueTests.length 
                ? `All Exams (${uniqueTests.length})` 
                : selectedErpTests.join(', ');

            doc.setFont("helvetica", "bold");
            doc.text("Academic Year:", col2X, y + 6);
            doc.setFont("helvetica", "normal");
            doc.text(academicYr, col2X + 26, y + 6);

            doc.setFont("helvetica", "bold");
            doc.text("Stream:", col2X, y + 12);
            doc.setFont("helvetica", "normal");
            doc.text(String(studentStream || '-'), col2X + 26, y + 12);

            doc.setFont("helvetica", "bold");
            doc.text("Test:", col2X, y + 18);
            doc.setFont("helvetica", "normal");
            doc.text(testNameText, col2X + 26, y + 18);

            y += 28;

            // 6. Ultra-Sharp 4K Side-by-Side Performance Charts
            const chartBoxWidth = (contentWidth - 6) / 2;
            const chartBoxHeight = 85;

            // Bar Chart Frame
            if (bar4kImg) {
                doc.setDrawColor(226, 232, 240);
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(margin, y, chartBoxWidth, chartBoxHeight, 2, 2, 'FD');
                doc.setFontSize(9.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(15, 23, 42);
                doc.text("Subject Wise Performance (Scored Marks)", margin + 6, y + 6.5);
                try {
                    doc.addImage(bar4kImg, 'PNG', margin + 2, y + 9, chartBoxWidth - 4, chartBoxHeight - 12);
                } catch (e) { console.error("Bar image error:", e); }
            }

            // Doughnut Chart Frame
            if (doughnut4kImg) {
                const dX = margin + chartBoxWidth + 6;
                doc.setDrawColor(226, 232, 240);
                doc.setFillColor(255, 255, 255);
                doc.roundedRect(dX, y, chartBoxWidth, chartBoxHeight, 2, 2, 'FD');
                doc.setFontSize(9.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(15, 23, 42);
                doc.text("Marks Loss Distribution (Subject Penalty)", dX + 6, y + 6.5);
                try {
                    doc.addImage(doughnut4kImg, 'PNG', dX + 2, y + 9, chartBoxWidth - 4, chartBoxHeight - 12);
                } catch (e) { console.error("Doughnut image error:", e); }
            }

            y += chartBoxHeight + 10;

            // 7. Subject Breakdown Table (autoTable)
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text("SUBJECT-WISE SCORE & MARKS LOSS BREAKDOWN", margin, y);

            y += 4;

            const tableRows = Object.entries(erpAnalysis.subjects).map(([subj, stats]) => {
                const scored = erpAnalysis.scoredMarks[subj] || 0;
                return [
                    subj,
                    `${scored} / 180 ${selectedErpTests.length > 1 ? '(avg)' : ''}`,
                    `${stats.w} (-${stats.w * 5})`,
                    `${stats.u} (-${stats.u * 4})`,
                    `-${stats.lost}`
                ];
            });

            // Add Total Row
            tableRows.push([
                'TOTAL',
                `${erpAnalysis.totalScored} / 720 ${selectedErpTests.length > 1 ? '(avg)' : ''}`,
                `${erpAnalysis.wrongCount} (-${erpAnalysis.wrongLost})`,
                `${erpAnalysis.unattemptedCount} (-${erpAnalysis.unattemptedLost})`,
                `-${erpAnalysis.totalLost}`
            ]);

            autoTable(doc, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [['Subject', 'Scored Marks', 'Wrong Answers (W)', 'Unattempted (U)', 'Total Marks Lost']],
                body: tableRows,
                theme: 'grid',
                headStyles: {
                    fillColor: [30, 58, 138],
                    textColor: [255, 255, 255],
                    fontStyle: 'bold',
                    fontSize: 9,
                    halign: 'center'
                },
                bodyStyles: {
                    fontSize: 8.5,
                    textColor: [30, 41, 59],
                    halign: 'center'
                },
                columnStyles: {
                    0: { halign: 'left', fontStyle: 'bold' },
                    1: { halign: 'center', fontStyle: 'bold' },
                    2: { halign: 'center' },
                    3: { halign: 'center' },
                    4: { halign: 'center', textColor: [220, 38, 38], fontStyle: 'bold' }
                },
                didParseCell: (data) => {
                    if (data.row.index === tableRows.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [241, 245, 249];
                        data.cell.styles.textColor = [15, 23, 42];
                    }
                }
            });

            // 8. Single Clean Footer (Fixed X positions so left and right text never overlap)
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.text("Generated automatically via Sri Chaitanya Medicon Analytics Platform", margin, pageHeight - 7);
            doc.text(`Page 1 of 1`, pageWidth - margin, pageHeight - 7, { align: 'right' });

            const cleanFileName = `${selectedStudent.name.replace(/[^a-zA-Z0-9]/g, '_')}_Marks_Loss_Report.pdf`;
            doc.save(cleanFileName);
            logActivity(userData, 'Downloaded Marks Loss PDF', { student: selectedStudent.name, studentId: selectedStudent.STUD_ID });
        } catch (err) {
            console.error("Failed to export Executive PDF:", err);
        } finally {
            setIsExportingPdf(false);
        }
    };

    return (
        <div className="topper-marks-loss-container">
            {/* Top Control Bar with Top N Filters */}
            <div className="toppers-controls-bar">
                <div className="results-indicator">
                    <div className="title-icon-badge">
                        <Award size={22} color="#ffffff" />
                    </div>
                    <div>
                        <strong className="main-title">Topper Marks Loss Executive Directory</strong>
                        <span className="sub-title">
                            Found <strong>{students.length}</strong> Toppers matching filters • Showing <strong>Top {toppersList.length}</strong>
                        </span>
                    </div>
                </div>

                <div className="control-right">
                    {/* Preset Pills */}
                    <div className="pill-group">
                        {[5, 10, 15, 20, 50, 100].map((num) => (
                            <button
                                key={num}
                                className={`pill-btn ${topLimit === num ? 'active' : ''}`}
                                onClick={() => handleSetTopLimit(num)}
                            >
                                Top {num}
                            </button>
                        ))}
                    </div>

                    {/* Custom Input */}
                    <div className="custom-input-box">
                        <span className="custom-label">Custom:</span>
                        <input
                            type="number"
                            min="1"
                            max="500"
                            className="custom-number-input"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSetTopLimit(customInput);
                            }}
                        />
                        <button
                            className="custom-set-btn"
                            onClick={() => handleSetTopLimit(customInput)}
                        >
                            Set
                        </button>
                    </div>
                </div>
            </div>

            {/* Student Selection Button Tabs */}
            {loading ? (
                <div className="loader-box">
                    <div className="loading-spinner"></div>
                    <p>Loading Toppers Directory...</p>
                </div>
            ) : toppersList.length === 0 ? (
                <div className="empty-box">
                    <Users size={44} color="#94a3b8" />
                    <h4>No Toppers Found</h4>
                    <p>Try adjusting your filters to find students matching criteria.</p>
                </div>
            ) : (
                <>
                    <div className="student-buttons-bar">
                        {toppersList.map((stud, idx) => {
                            const isSelected = selectedStudent?.STUD_ID === stud.STUD_ID;
                            const rankNum = idx + 1;
                            let badgeClass = 'rank-badge normal';
                            if (rankNum === 1) badgeClass = 'rank-badge gold';
                            else if (rankNum === 2) badgeClass = 'rank-badge silver';
                            else if (rankNum === 3) badgeClass = 'rank-badge bronze';

                            return (
                                <button
                                    key={stud.STUD_ID || idx}
                                    onClick={() => setSelectedStudent(stud)}
                                    className={`student-tab-btn ${isSelected ? 'selected' : ''}`}
                                >
                                    <span className={badgeClass}>
                                        #{rankNum}
                                    </span>
                                    <span className="stud-name">{stud.name || stud.STUD_NAME}</span>
                                    <span className="stud-score">
                                        ({Number(stud.tot || 0).toFixed(1)})
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Main Content Area for Selected Student */}
                    {selectedStudent && (
                        <div className="marks-loss-executive-card">
                            {/* Executive Header Banner */}
                            <div className="executive-header">
                                <div className="student-profile-info">
                                    <div className="profile-avatar">
                                        <UserCheck size={26} color="#ffffff" />
                                    </div>
                                    <div>
                                        <div className="title-row">
                                            <h2 className="student-full-name">
                                                {selectedStudent.name || selectedStudent.STUD_NAME}
                                            </h2>
                                            <span className="id-badge">
                                                ID: {selectedStudent.STUD_ID}
                                            </span>
                                        </div>
                                        <p className="student-submeta">
                                            Campus: <strong>{selectedStudent.campus || '-'}</strong> • Stream: <strong>{selectedStudent.stream || selectedStudent.Stream || 'SR_ELITE'}</strong>
                                        </p>
                                    </div>
                                </div>

                                <button
                                    onClick={downloadStudentPdf}
                                    disabled={isExportingPdf || erpLoading || erpData.length === 0}
                                    className="download-pdf-exec-btn"
                                >
                                    <FileText size={18} />
                                    {isExportingPdf ? 'Generating Executive PDF...' : 'Download PDF Report'}
                                </button>
                            </div>

                            {/* ERP Data Content */}
                            {erpLoading ? (
                                <div className="loader-box">
                                    <div className="loading-spinner"></div>
                                    <p>Fetching ERP Marks Loss details for {selectedStudent.name}...</p>
                                </div>
                            ) : erpData.length === 0 ? (
                                <div className="empty-box">
                                    <AlertTriangle size={48} color="#eab308" />
                                    <h4>No Marks Loss Data Available</h4>
                                    <p>We couldn't find any Wrong (W) or Unattempted (U) records in the database for this student.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Score Loss Cards */}
                                            <div className="drawer-loss-cards">
                                                <div className="loss-summary-card total">
                                                    <span className="loss-card-title">Total Score Loss</span>
                                                    <span className="loss-card-val">-{erpAnalysis.totalLost} Marks</span>
                                                    <span className="loss-card-sub">Sum of penalties</span>
                                                </div>

                                                <div className="loss-summary-card wrong">
                                                    <span className="loss-card-title">Wrong Answers (W)</span>
                                                    <span className="loss-card-val">-{erpAnalysis.wrongLost} Marks</span>
                                                    <span className="loss-card-sub">
                                                        <strong>{erpAnalysis.wrongCount}</strong> wrong (-1 penalty, -5 loss each)
                                                    </span>
                                                </div>

                                                <div className="loss-summary-card skipped">
                                                    <span className="loss-card-title">Unattempted (U)</span>
                                                    <span className="loss-card-val">-{erpAnalysis.unattemptedLost} Marks</span>
                                                    <span className="loss-card-sub">
                                                        <strong>{erpAnalysis.unattemptedCount}</strong> skipped (0 penalty, -4 loss each)
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Potential Score Banner */}
                                            <div className="potential-score-banner">
                                                <CheckCircle size={20} color="#10b981" style={{ marginRight: '10px', flexShrink: 0 }} />
                                                <span>
                                                    {selectedErpTests.length > 1 ? (
                                                        <>
                                                            With 0 mistakes, this student's average score across these tests would have been 
                                                            <strong> {720 - Math.round(erpAnalysis.totalLost / selectedErpTests.length)} / 720</strong>.
                                                        </>
                                                    ) : (
                                                        <>
                                                            With 0 mistakes, this student's score on this test would have been 
                                                            <strong> {720 - erpAnalysis.totalLost} / 720</strong>.
                                                        </>
                                                    )}
                                                </span>
                                            </div>

                                            {/* Charts Row */}
                                            <div className="drawer-charts-row">
                                                <div className="drawer-chart-col">
                                                    <h4 className="drawer-section-title">Subject Wise Performance</h4>
                                                    <div style={{ height: '240px', position: 'relative' }}>
                                                        <Bar 
                                                            ref={subjectBarChartRef}
                                                            data={{
                                                                labels: ['Botany', 'Zoology', 'Physics', 'Chemistry'],
                                                                datasets: [{
                                                                    data: [
                                                                        erpAnalysis.scoredMarks.BOTANY,
                                                                        erpAnalysis.scoredMarks.ZOOLOGY,
                                                                        erpAnalysis.scoredMarks.PHYSICS,
                                                                        erpAnalysis.scoredMarks.CHEMISTRY
                                                                    ],
                                                                    backgroundColor: ['#10b981', '#3b82f6', '#eab308', '#ec4899'],
                                                                    borderRadius: 6,
                                                                    barThickness: 24,
                                                                    datalabels: {
                                                                        color: '#000000',
                                                                        anchor: 'end',
                                                                        align: 'end',
                                                                        offset: 4,
                                                                        font: { weight: 'bold', size: 10 },
                                                                        formatter: (val) => val
                                                                    }
                                                                }]
                                                            }}
                                                            options={{
                                                                responsive: true,
                                                                maintainAspectRatio: false,
                                                                plugins: {
                                                                    legend: { display: false },
                                                                    datalabels: { display: true }
                                                                },
                                                                scales: {
                                                                    x: { grid: { display: false }, ticks: { font: { size: 10, weight: 'bold' } } },
                                                                    y: { grid: { display: true, color: '#f1f5f9' }, max: 180, ticks: { font: { size: 9 }, stepSize: 45 } }
                                                                },
                                                                layout: { padding: { top: 15 } }
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="drawer-chart-col">
                                                    <h4 className="drawer-section-title">Marks Loss Distribution</h4>
                                                    <div style={{ height: '240px', position: 'relative' }}>
                                                        <Doughnut 
                                                            ref={lossDoughnutChartRef}
                                                            data={{
                                                                labels: ['Botany', 'Zoology', 'Physics', 'Chemistry'],
                                                                datasets: [{
                                                                    data: [
                                                                        erpAnalysis.subjects.BOTANY.lost,
                                                                        erpAnalysis.subjects.ZOOLOGY.lost,
                                                                        erpAnalysis.subjects.PHYSICS.lost,
                                                                        erpAnalysis.subjects.CHEMISTRY.lost
                                                                    ],
                                                                    backgroundColor: ['#10b981', '#3b82f6', '#eab308', '#ec4899'],
                                                                    borderWidth: 1,
                                                                    borderColor: '#ffffff',
                                                                    datalabels: {
                                                                        color: '#ffffff',
                                                                        font: { weight: 'bold', size: 10 },
                                                                        formatter: (val) => val > 0 ? `-${val}` : ''
                                                                    }
                                                                }]
                                                            }}
                                                            options={{
                                                                responsive: true,
                                                                maintainAspectRatio: false,
                                                                cutout: '60%',
                                                                plugins: {
                                                                    legend: {
                                                                        display: true,
                                                                        position: 'right',
                                                                        labels: { boxWidth: 10, padding: 8, font: { size: 9, weight: 'bold' } }
                                                                    },
                                                                    datalabels: { display: true }
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Subject Breakdown Table */}
                                            <div className="drawer-subject-breakdown">
                                                <h4 className="drawer-section-title">Subject-wise Score & Loss</h4>
                                                <table className="drawer-mini-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Subject</th>
                                                            <th>Scored Marks</th>
                                                            <th>Wrong (W)</th>
                                                            <th>Unattempted (U)</th>
                                                            <th>Total Lost</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {Object.entries(erpAnalysis.subjects).map(([subject, stats]) => (
                                                            <tr key={subject}>
                                                                <td className="font-bold">{subject}</td>
                                                                <td className="font-bold" style={{ color: '#0f172a' }}>
                                                                    {erpAnalysis.scoredMarks[subject]} / 180 {selectedErpTests.length > 1 && <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>(avg)</span>}
                                                                </td>
                                                                <td>{stats.w} <span className="sub-text">(-{stats.w * 5})</span></td>
                                                                <td>{stats.u} <span className="sub-text">(-{stats.u * 4})</span></td>
                                                                <td className="loss-red font-bold">-{stats.lost}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr style={{ background: '#f8fafc', fontWeight: 'bold', borderTop: '2px solid #cbd5e1' }}>
                                                            <td>TOTAL</td>
                                                            <td style={{ color: '#172554', fontSize: '0.85rem' }}>
                                                                {erpAnalysis.totalScored} / 720 {selectedErpTests.length > 1 && <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 'normal' }}>(avg)</span>}
                                                            </td>
                                                            <td>{erpAnalysis.wrongCount} <span className="sub-text">(-{erpAnalysis.wrongLost})</span></td>
                                                            <td>{erpAnalysis.unattemptedCount} <span className="sub-text">(-{erpAnalysis.unattemptedLost})</span></td>
                                                            <td className="loss-red" style={{ fontSize: '0.85rem' }}>-{erpAnalysis.totalLost}</td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>

                                            {/* Question Details Grid */}
                                            <div className="drawer-questions-list">
                                                <div className="drawer-section-header">
                                                    <h4 className="drawer-section-title">Incorrect / Skipped Questions</h4>
                                                    <span className="q-count-badge">{erpAnalysis.questions.length} items</span>
                                                </div>
                                                
                                                {erpAnalysis.questions.length === 0 ? (
                                                    <p className="no-questions-text">No wrong/unattempted questions recorded for this test.</p>
                                                ) : (
                                                    <div className="questions-grid-wrapper">
                                                        {erpAnalysis.questions.map((q, idx) => (
                                                            <div className={`q-detail-card ${q.status.toLowerCase()}`} key={idx}>
                                                                <div className="q-card-top">
                                                                    <div className="q-identifier">
                                                                        <span className="q-badge-test">{q.test}</span>
                                                                        <span className="q-badge-subject">{q.subject}</span>
                                                                        <span className="q-num">Q{q.qNo}</span>
                                                                    </div>
                                                                    <div className={`q-status-tag ${q.status.toLowerCase()}`}>
                                                                        {q.status === 'W' ? 'Wrong (-5)' : 'Unattempted (-4)'}
                                                                    </div>
                                                                </div>

                                                                <div className="q-topic-line">
                                                                    <strong>Topic:</strong> {q.topic}
                                                                    {q.subTopic && <span className="q-subtopic"> • {q.subTopic}</span>}
                                                                </div>

                                                                {q.keyValue && (
                                                                    <div className="q-key-line" style={{ marginTop: '4px', fontSize: '0.78rem', color: '#475569' }}>
                                                                        <strong>Correct Answer:</strong> <span style={{ color: '#16a34a', fontWeight: 'bold' }}>{q.keyValue}</span>
                                                                    </div>
                                                                )}

                                                                {q.qUrl && (
                                                                    <div className="q-actions-bar">
                                                                        <button 
                                                                            className="q-preview-btn"
                                                                            onClick={() => setZoomImage({ url: q.qUrl, title: `${q.test} - Q${q.qNo} (${q.subject})` })}
                                                                        >
                                                                            <Maximize2 size={13} /> View Question
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}

            {/* Question Image Zoom Modal */}
            {zoomImage && (
                <div className="zoom-modal-overlay" onClick={() => setZoomImage(null)}>
                    <div className="zoom-modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="zoom-modal-header">
                            <h5>{zoomImage.title}</h5>
                            <button className="zoom-close-btn" onClick={() => setZoomImage(null)}>
                                <X size={20} />
                            </button>
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

            {/* Dedicated Styling for Executive Topper Marks Loss Report */}
            <style>{`
                .topper-marks-loss-container {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    width: 100%;
                }

                /* Control Bar */
                .toppers-controls-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(226, 232, 240, 0.8);
                    padding: 12px 22px;
                    border-radius: 14px;
                    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
                    flex-wrap: wrap;
                    gap: 15px;
                }

                .results-indicator {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .title-icon-badge {
                    width: 42px;
                    height: 42px;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
                }

                .main-title {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #0f172a;
                    display: block;
                    letter-spacing: -0.01em;
                }

                .sub-title {
                    font-size: 0.82rem;
                    color: #64748b;
                    display: block;
                    margin-top: 1px;
                }

                .control-right {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    flex-wrap: wrap;
                }

                /* Preset Pills */
                .pill-group {
                    display: flex;
                    background: #f1f5f9;
                    border-radius: 20px;
                    padding: 3px;
                    border: 1px solid #e2e8f0;
                }

                .pill-btn {
                    border: none;
                    background: transparent;
                    color: #475569;
                    font-size: 0.82rem;
                    font-weight: 700;
                    padding: 6px 14px;
                    border-radius: 17px;
                    cursor: pointer;
                    transition: all 0.2s ease-in-out;
                }

                .pill-btn:hover {
                    color: #0f172a;
                }

                .pill-btn.active {
                    background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
                    color: white;
                    box-shadow: 0 3px 8px rgba(30, 58, 138, 0.3);
                }

                /* Custom Input Box */
                .custom-input-box {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: #f8fafc;
                    padding: 4px 10px;
                    border-radius: 20px;
                    border: 1px solid #cbd5e1;
                }

                .custom-label {
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #475569;
                }

                .custom-number-input {
                    width: 55px;
                    padding: 4px 8px;
                    border-radius: 6px;
                    border: 1px solid #cbd5e1;
                    font-size: 0.85rem;
                    font-weight: 800;
                    text-align: center;
                    outline: none;
                    color: #0f172a;
                }

                .custom-number-input:focus {
                    border-color: #3b82f6;
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
                }

                .custom-set-btn {
                    background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
                    color: white;
                    border: none;
                    padding: 5px 12px;
                    border-radius: 12px;
                    font-size: 0.78rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 4px rgba(30, 58, 138, 0.2);
                }

                .custom-set-btn:hover {
                    opacity: 0.95;
                    transform: translateY(-1px);
                }

                /* Student Button Tabs Bar */
                .student-buttons-bar {
                    display: flex;
                    gap: 10px;
                    overflow-x: auto;
                    padding: 10px 6px;
                    background: #ffffff;
                    border-radius: 14px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.03);
                    scrollbar-width: thin;
                }

                .student-tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 16px;
                    border-radius: 10px;
                    border: 1px solid #cbd5e1;
                    background: #f8fafc;
                    color: #1e293b;
                    font-weight: 600;
                    font-size: 0.84rem;
                    cursor: pointer;
                    white-space: nowrap;
                    transition: all 0.2s ease-in-out;
                }

                .student-tab-btn:hover {
                    background: #f1f5f9;
                    border-color: #94a3b8;
                    transform: translateY(-1px);
                }

                .student-tab-btn.selected {
                    border: 2px solid #1e3a8a;
                    background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%);
                    color: #ffffff;
                    font-weight: 700;
                    box-shadow: 0 6px 15px -3px rgba(30, 58, 138, 0.35);
                }

                .rank-badge {
                    padding: 3px 8px;
                    border-radius: 6px;
                    font-size: 0.72rem;
                    font-weight: 800;
                    letter-spacing: 0.02em;
                }

                .rank-badge.gold {
                    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
                    color: #ffffff;
                    box-shadow: 0 2px 4px rgba(217, 119, 6, 0.3);
                }

                .rank-badge.silver {
                    background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
                    color: #ffffff;
                }

                .rank-badge.bronze {
                    background: linear-gradient(135deg, #b45309 0%, #78350f 100%);
                    color: #ffffff;
                }

                .rank-badge.normal {
                    background: #e2e8f0;
                    color: #334155;
                }

                .student-tab-btn.selected .rank-badge.normal {
                    background: rgba(255, 255, 255, 0.2);
                    color: #ffffff;
                }

                .stud-name {
                    font-size: 0.85rem;
                }

                .stud-score {
                    font-size: 0.76rem;
                    opacity: 0.85;
                    font-weight: 700;
                }

                /* Executive Main Card */
                .marks-loss-executive-card {
                    background: #ffffff;
                    border-radius: 16px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.05);
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 22px;
                }

                /* Executive Header */
                .executive-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-bottom: 2px solid #f1f5f9;
                    padding-bottom: 18px;
                    flex-wrap: wrap;
                    gap: 15px;
                }

                .student-profile-info {
                    display: flex;
                    align-items: center;
                    gap: 14px;
                }

                .profile-avatar {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(30, 58, 138, 0.25);
                }

                .title-row {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .student-full-name {
                    font-size: 1.45rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0;
                    letter-spacing: -0.01em;
                }

                .id-badge {
                    background: #eff6ff;
                    color: #1e40af;
                    padding: 3px 10px;
                    border-radius: 6px;
                    font-size: 0.78rem;
                    font-weight: 800;
                    border: 1px solid #bfdbfe;
                }

                .student-submeta {
                    font-size: 0.88rem;
                    color: #64748b;
                    margin: 3px 0 0 0;
                }

                .download-pdf-exec-btn {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 10px 20px;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    color: white;
                    border: none;
                    font-weight: 800;
                    font-size: 0.88rem;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
                    transition: all 0.2s ease-in-out;
                }

                .download-pdf-exec-btn:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(220, 38, 38, 0.4);
                }

                .test-selector-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    max-width: 420px;
                }

                /* Loss Cards */
                .drawer-loss-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 15px;
                }

                .loss-summary-card {
                    padding: 16px 20px;
                    border-radius: 12px;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.03);
                    transition: transform 0.2s;
                }

                .loss-summary-card:hover {
                    transform: translateY(-2px);
                }

                .loss-summary-card.total {
                    background: linear-gradient(135deg, #fef2f2 0%, #ffe4e6 100%);
                    border: 1px solid #fecaca;
                    color: #991b1b;
                }

                .loss-summary-card.wrong {
                    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
                    border: 1px solid #fde68a;
                    color: #92400e;
                }

                .loss-summary-card.skipped {
                    background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
                    border: 1px solid #bbf7d0;
                    color: #166534;
                }

                .loss-card-title {
                    font-size: 0.75rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                    opacity: 0.85;
                }

                .loss-card-val {
                    font-size: 1.4rem;
                    font-weight: 900;
                    margin-top: 4px;
                }

                .loss-card-sub {
                    font-size: 0.76rem;
                    margin-top: 4px;
                    opacity: 0.9;
                }

                /* Potential Score Banner */
                .potential-score-banner {
                    display: flex;
                    align-items: center;
                    background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
                    border: 1px solid #a7f3d0;
                    color: #065f46;
                    padding: 12px 18px;
                    border-radius: 10px;
                    font-size: 0.92rem;
                    box-shadow: 0 2px 5px rgba(16, 185, 129, 0.08);
                }

                .potential-score-banner strong {
                    margin: 0 4px;
                    font-weight: 900;
                    color: #047857;
                }

                /* Charts Grid */
                .drawer-charts-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    background: #f8fafc;
                    padding: 18px;
                    border-radius: 14px;
                    border: 1px solid #e2e8f0;
                }

                @media (max-width: 900px) {
                    .drawer-charts-row {
                        grid-template-columns: 1fr;
                    }
                }

                .drawer-chart-col {
                    background: #ffffff;
                    border-radius: 10px;
                    padding: 14px;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }

                .drawer-section-title {
                    font-size: 0.92rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 12px;
                    text-transform: uppercase;
                    letter-spacing: 0.03em;
                }

                /* Mini Table */
                .drawer-subject-breakdown {
                    background: #ffffff;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 16px;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.02);
                }

                .drawer-mini-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.85rem;
                }

                .drawer-mini-table th {
                    text-align: left;
                    background: #1e3a8a;
                    color: #ffffff;
                    padding: 10px 14px;
                    font-weight: 800;
                    font-size: 0.8rem;
                    letter-spacing: 0.02em;
                }

                .drawer-mini-table td {
                    padding: 10px 14px;
                    border-bottom: 1px solid #f1f5f9;
                    color: #1e293b;
                }

                .drawer-mini-table tr:hover {
                    background: #f8fafc;
                }

                .sub-text {
                    font-size: 0.72rem;
                    color: #64748b;
                    margin-left: 4px;
                }

                .loss-red {
                    color: #dc2626;
                }

                /* Questions List */
                .drawer-questions-list {
                    background: #ffffff;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    padding: 16px;
                }

                .drawer-section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 14px;
                    border-bottom: 1px solid #f1f5f9;
                    padding-bottom: 8px;
                }

                .q-count-badge {
                    background: #eff6ff;
                    color: #1e40af;
                    padding: 3px 10px;
                    border-radius: 12px;
                    font-size: 0.78rem;
                    font-weight: 800;
                }

                .questions-grid-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .q-detail-card {
                    background: #f8fafc;
                    border-radius: 10px;
                    padding: 14px;
                    border-left: 5px solid #cbd5e1;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.03);
                }

                .q-detail-card.w {
                    border-left-color: #f59e0b;
                }

                .q-detail-card.u {
                    border-left-color: #10b981;
                }

                .q-card-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .q-identifier {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .q-badge-test {
                    background: #e0e7ff;
                    color: #4338ca;
                    font-weight: 800;
                    font-size: 0.72rem;
                    padding: 2px 8px;
                    border-radius: 4px;
                }

                .q-badge-subject {
                    background: #e2e8f0;
                    color: #334155;
                    font-weight: 800;
                    font-size: 0.72rem;
                    padding: 2px 8px;
                    border-radius: 4px;
                }

                .q-num {
                    font-weight: 800;
                    color: #0f172a;
                    font-size: 0.9rem;
                }

                .q-status-tag {
                    font-size: 0.72rem;
                    font-weight: 800;
                    padding: 3px 8px;
                    border-radius: 6px;
                }

                .q-status-tag.w {
                    background: #fffbeb;
                    color: #b45309;
                    border: 1px solid #fde68a;
                }

                .q-status-tag.u {
                    background: #f0fdf4;
                    color: #15803d;
                    border: 1px solid #bbf7d0;
                }

                .q-topic-line {
                    font-size: 0.84rem;
                    color: #334155;
                }

                .q-actions-bar {
                    display: flex;
                    gap: 10px;
                    margin-top: 4px;
                }

                .q-preview-btn {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    border: 1px solid #cbd5e1;
                    background: #ffffff;
                    color: #475569;
                    font-size: 0.76rem;
                    font-weight: 700;
                    padding: 5px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.15s;
                }

                .q-preview-btn:hover {
                    background: #f8fafc;
                    border-color: #6366f1;
                    color: #6366f1;
                }

                .q-preview-btn.solution:hover {
                    border-color: #10b981;
                    color: #10b981;
                }

                /* Zoom Modal */
                .zoom-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.75);
                    backdrop-filter: blur(4px);
                    z-index: 10000;
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

                .zoom-modal-header h5 {
                    font-weight: 800;
                    color: #0f172a;
                    font-size: 0.95rem;
                    margin: 0;
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
                    overflow: hidden;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background: #f1f5f9;
                }

                .zoomable-image {
                    max-width: 100%;
                    max-height: 75vh;
                    object-fit: contain;
                    border-radius: 6px;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.15);
                }

                .loader-box {
                    padding: 50px;
                    text-align: center;
                    background: #ffffff;
                    border-radius: 14px;
                    border: 1px solid #e2e8f0;
                }

                .loading-spinner {
                    width: 36px;
                    height: 36px;
                    border: 4px solid #f1f5f9;
                    border-top-color: #1e3a8a;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    margin: 0 auto 12px;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                .empty-box {
                    padding: 50px;
                    text-align: center;
                    background: #ffffff;
                    border-radius: 14px;
                    border: 1px dashed #cbd5e1;
                }

                .empty-box h4 {
                    margin: 12px 0 6px;
                    color: #0f172a;
                    font-weight: 800;
                }

                .empty-box p {
                    color: #64748b;
                    font-size: 0.88rem;
                    margin: 0;
                }
            `}</style>
        </div>
    );
};

export default TopperMarksLossReport;
