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
    Download
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
        minHeight: '36px',
        borderRadius: '8px',
        borderColor: '#cbd5e1',
        boxShadow: 'none',
        '&:hover': { borderColor: '#94a3b8' }
    }),
    valueContainer: (provided) => ({
        ...provided,
        padding: '2px 8px'
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
                    
                    // Default to selecting the #1 topper if available
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
                    // If main filter test is selected, match against uniqueTests
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

    // Download Student Marks Loss Report as PDF
    const downloadStudentPdf = async () => {
        if (!selectedStudent || !erpAnalysis) return;
        setIsExportingPdf(true);

        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 12;
            const contentWidth = pageWidth - (margin * 2);

            const [impactFont, bookmanFont, bookmanBoldFont, logoImg] = await Promise.all([
                loadFont('/fonts/unicode.impact.ttf'),
                loadFont('/fonts/bookman-old-style.ttf'),
                loadFont('/fonts/BOOKOSB.TTF'),
                loadImage('/logo.png')
            ]);

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

            let y = 10;
            doc.setFillColor(15, 23, 42);
            doc.rect(margin, y, contentWidth, 2.5, 'F');
            doc.setFillColor(245, 158, 11);
            doc.rect(margin, y + 2.5, contentWidth, 1, 'F');

            y = 22;

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
            doc.setFillColor(30, 58, 138);
            doc.roundedRect(margin, y, contentWidth, 9, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.text("STUDENT MARKS LOSS & PERFORMANCE ANALYSIS REPORT", pageWidth / 2, y + 6, { align: 'center' });

            y += 13;

            doc.setFillColor(248, 250, 252);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.4);
            doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

            const col1X = margin + 4;
            const col2X = margin + (contentWidth / 2) + 4;

            doc.setTextColor(71, 85, 105);
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "normal");

            doc.text("Student Name:", col1X, y + 6);
            doc.text("Student ID:", col1X, y + 12);
            doc.text("Campus:", col1X, y + 18);

            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", "bold");
            doc.text(selectedStudent.name || '-', col1X + 26, y + 6);
            doc.text(String(selectedStudent.STUD_ID || '-'), col1X + 26, y + 12);
            doc.text(selectedStudent.campus || '-', col1X + 26, y + 18);

            const studentStream = selectedStudent.stream || selectedStudent.Stream || (erpData && erpData.length > 0 ? erpData.find(r => r.Stream)?.Stream : null) || (filters.stream && filters.stream.length > 0 ? filters.stream.join(', ') : '-');
            const testNameText = selectedErpTests.length === uniqueTests.length 
                ? `All Exams (${selectedErpTests.length})` 
                : selectedErpTests.join(', ');

            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            doc.text("Stream:", col2X, y + 6);
            doc.text("Exam(s) Analyzed:", col2X, y + 12);
            doc.text("Report Date:", col2X, y + 18);

            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", "bold");
            doc.text(studentStream, col2X + 30, y + 6);
            
            const maxTestWidth = 55;
            let displayTestText = testNameText;
            if (doc.getTextWidth(displayTestText) > maxTestWidth) {
                while (displayTestText.length > 3 && doc.getTextWidth(displayTestText + '...') > maxTestWidth) {
                    displayTestText = displayTestText.slice(0, -1);
                }
                displayTestText += '...';
            }
            doc.text(displayTestText, col2X + 30, y + 12);
            doc.text(formatDate(new Date()), col2X + 30, y + 18);

            y += 26;

            const cardWidth = (contentWidth - 6) / 3;
            const cardHeight = 16;

            doc.setFillColor(254, 242, 242);
            doc.setDrawColor(254, 202, 202);
            doc.roundedRect(margin, y, cardWidth, cardHeight, 2, 2, 'FD');
            doc.setTextColor(153, 27, 27);
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.text("TOTAL SCORE LOSS", margin + 4, y + 4.5);
            doc.setFontSize(12);
            doc.text(`-${erpAnalysis.totalLost} Marks`, margin + 4, y + 11);

            const card2X = margin + cardWidth + 3;
            doc.setFillColor(255, 251, 235);
            doc.setDrawColor(253, 230, 138);
            doc.roundedRect(card2X, y, cardWidth, cardHeight, 2, 2, 'FD');
            doc.setTextColor(146, 64, 14);
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.text("WRONG ANSWERS (W)", card2X + 4, y + 4.5);
            doc.setFontSize(12);
            doc.text(`-${erpAnalysis.wrongLost} Marks`, card2X + 4, y + 11);
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.text(`(${erpAnalysis.wrongCount} wrong × -5)`, card2X + 4, y + 14.5);

            const card3X = card2X + cardWidth + 3;
            doc.setFillColor(240, 253, 244);
            doc.setDrawColor(187, 247, 208);
            doc.roundedRect(card3X, y, cardWidth, cardHeight, 2, 2, 'FD');
            doc.setTextColor(22, 101, 52);
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.text("UNATTEMPTED (U)", card3X + 4, y + 4.5);
            doc.setFontSize(12);
            doc.text(`-${erpAnalysis.unattemptedLost} Marks`, card3X + 4, y + 11);
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.text(`(${erpAnalysis.unattemptedCount} skipped × -4)`, card3X + 4, y + 14.5);

            y += cardHeight + 4;

            doc.setFillColor(236, 253, 245);
            doc.setDrawColor(167, 243, 208);
            doc.roundedRect(margin, y, contentWidth, 7.5, 1.5, 1.5, 'FD');
            doc.setTextColor(6, 95, 70);
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            const potentialScoreText = selectedErpTests.length > 1
                ? `With 0 mistakes, average score across these tests would have been: ${720 - Math.round(erpAnalysis.totalLost / selectedErpTests.length)} / 720`
                : `With 0 mistakes, score on this test would have been: ${720 - erpAnalysis.totalLost} / 720`;
            doc.text(potentialScoreText, pageWidth / 2, y + 5, { align: 'center' });

            y += 10.5;

            const chartBoxW = (contentWidth - 4) / 2;
            const chartBoxH = 48;

            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(margin, y, chartBoxW, chartBoxH, 2, 2, 'FD');
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.text("Subject Wise Performance (Scored)", margin + 6, y + 6.5);

            if (bar4kImg) {
                doc.addImage(bar4kImg, 'PNG', margin + 3, y + 8, chartBoxW - 6, chartBoxH - 10);
            }

            const dX = margin + chartBoxW + 4;
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(dX, y, chartBoxW, chartBoxH, 2, 2, 'FD');
            doc.setTextColor(30, 41, 59);
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.text("Marks Loss Distribution (Subject Penalty)", dX + 6, y + 6.5);

            if (doughnut4kImg) {
                doc.addImage(doughnut4kImg, 'PNG', dX + 3, y + 8, chartBoxW - 6, chartBoxH - 10);
            }

            y += chartBoxH + 4;

            doc.setTextColor(30, 41, 59);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text("SUBJECT-WISE SCORE & MARKS LOSS BREAKDOWN", margin, y);

            y += 2.5;

            const subjectRows = Object.entries(erpAnalysis.subjects).map(([subject, stats]) => {
                const scored = erpAnalysis.scoredMarks[subject] || 0;
                return [
                    subject,
                    '180',
                    `${scored} / 180 ${selectedErpTests.length > 1 ? '(avg)' : ''}`,
                    `${stats.w} (-${stats.w * 5})`,
                    `${stats.u} (-${stats.u * 4})`,
                    `-${stats.lost}`
                ];
            });

            subjectRows.push([
                'TOTAL',
                '720',
                `${erpAnalysis.totalScored} / 720 ${selectedErpTests.length > 1 ? '(avg)' : ''}`,
                `${erpAnalysis.wrongCount} (-${erpAnalysis.wrongLost})`,
                `${erpAnalysis.unattemptedCount} (-${erpAnalysis.unattemptedLost})`,
                `-${erpAnalysis.totalLost}`
            ]);

            autoTable(doc, {
                startY: y,
                head: [['Subject', 'Target', 'Scored Marks', 'Wrong (W)', 'Unattempted (U)', 'Net Lost']],
                body: subjectRows,
                theme: 'grid',
                margin: { left: margin, right: margin },
                headStyles: {
                    fillColor: [30, 58, 138],
                    textColor: [255, 255, 255],
                    fontSize: 8,
                    fontStyle: 'bold',
                    halign: 'center',
                    cellPadding: 1.8
                },
                bodyStyles: {
                    fontSize: 7.5,
                    textColor: [30, 41, 59],
                    cellPadding: 1.5
                },
                columnStyles: {
                    0: { fontStyle: 'bold', halign: 'left' },
                    1: { halign: 'center' },
                    2: { halign: 'center', fontStyle: 'bold' },
                    3: { halign: 'center', textColor: [180, 83, 9] },
                    4: { halign: 'center', textColor: [22, 101, 52] },
                    5: { halign: 'center', fontStyle: 'bold', textColor: [220, 38, 38] }
                },
                didParseCell: (data) => {
                    if (data.row.index === subjectRows.length - 1) {
                        data.cell.styles.fontStyle = 'bold';
                        data.cell.styles.fillColor = [241, 245, 249];
                        data.cell.styles.textColor = [15, 23, 42];
                    }
                }
            });

            y = doc.lastAutoTable.finalY + 4;

            doc.setTextColor(30, 41, 59);
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.text(`QUESTION PENALTY DETAILS (${erpAnalysis.questions.length} INCORRECT / SKIPPED)`, margin, y);

            y += 2.5;

            const qTableRows = erpAnalysis.questions.map((q, idx) => [
                String(idx + 1),
                String(q.test || '-'),
                String(q.qNo || '-'),
                String(q.subject || '-'),
                String(q.topic || 'Unknown Topic'),
                q.status === 'W' ? 'Wrong' : 'Skipped',
                q.status === 'W' ? '-5 Marks' : '-4 Marks',
                String(q.keyValue || '-')
            ]);

            const availableHeight = pageHeight - y - 10;
            const rowHeightEst = 3.8;
            const maxRowsThatFit = Math.max(3, Math.floor(availableHeight / rowHeightEst));
            const displayQRows = qTableRows.slice(0, maxRowsThatFit);

            autoTable(doc, {
                startY: y,
                head: [['#', 'Exam', 'Q.No', 'Subject', 'Topic Name', 'Status', 'Penalty', 'Key']],
                body: displayQRows.length > 0 ? displayQRows : [['-', '-', '-', '-', 'No penalty questions recorded', '-', '-', '-']],
                theme: 'striped',
                margin: { left: margin, right: margin },
                headStyles: {
                    fillColor: [15, 23, 42],
                    textColor: [255, 255, 255],
                    fontSize: 7.5,
                    fontStyle: 'bold',
                    halign: 'center',
                    cellPadding: 1.2
                },
                bodyStyles: {
                    fontSize: 6.8,
                    textColor: [15, 23, 42],
                    cellPadding: 1.0
                },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 8 },
                    1: { halign: 'center', cellWidth: 20 },
                    2: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
                    3: { halign: 'center', cellWidth: 22 },
                    4: { halign: 'left', cellWidth: 'auto' },
                    5: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
                    6: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
                    7: { halign: 'center', cellWidth: 12 }
                },
                didParseCell: (data) => {
                    if (data.section === 'body') {
                        const statusVal = data.row.cells[5]?.text?.[0];
                        if (statusVal === 'Wrong') {
                            if (data.column.index === 5 || data.column.index === 6) {
                                data.cell.styles.textColor = [220, 38, 38];
                            }
                        } else if (statusVal === 'Skipped') {
                            if (data.column.index === 5 || data.column.index === 6) {
                                data.cell.styles.textColor = [217, 119, 6];
                            }
                        }
                    }
                }
            });

            if (qTableRows.length > maxRowsThatFit) {
                const footerY = Math.min(pageHeight - 6, doc.lastAutoTable.finalY + 3.5);
                doc.setFontSize(6.5);
                doc.setFont("helvetica", "italic");
                doc.setTextColor(100, 116, 139);
                doc.text(`* Showing ${maxRowsThatFit} of ${qTableRows.length} total mistake questions. See dashboard for full interactive details.`, margin, footerY);
            }

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
            <div className="toppers-controls-bar" style={{ flexWrap: 'wrap', gap: '12px' }}>
                <div className="results-indicator" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Award size={20} color="#1e3a8a" />
                    <div>
                        <strong style={{ color: '#0f172a', fontSize: '1.05rem' }}>Topper Marks Loss Executive Directory</strong>
                        <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b' }}>
                            Found <strong>{students.length}</strong> Toppers matching filters. Showing <strong>Top {toppersList.length}</strong>.
                        </span>
                    </div>
                </div>

                <div className="control-right" style={{ flexWrap: 'wrap', gap: '10px' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', padding: '3px 8px', borderRadius: '20px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>Custom Top:</span>
                        <input
                            type="number"
                            min="1"
                            max="500"
                            value={customInput}
                            onChange={(e) => setCustomInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSetTopLimit(customInput);
                            }}
                            style={{
                                width: '50px',
                                padding: '3px 6px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                textAlign: 'center'
                            }}
                        />
                        <button
                            onClick={() => handleSetTopLimit(customInput)}
                            style={{
                                background: '#1e3a8a',
                                color: 'white',
                                border: 'none',
                                padding: '4px 10px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: '700',
                                cursor: 'pointer'
                            }}
                        >
                            Set
                        </button>
                    </div>
                </div>
            </div>

            {/* Student Selection Button Tabs */}
            {loading ? (
                <div style={{ padding: '30px', textAlign: 'center', background: '#fff', borderRadius: '12px' }}>
                    <div className="loading-spinner"></div>
                    <p style={{ marginTop: '10px', color: '#64748b' }}>Loading Toppers List...</p>
                </div>
            ) : toppersList.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <Users size={40} color="#94a3b8" />
                    <h4 style={{ margin: '10px 0 5px', color: '#1e293b' }}>No Students Found</h4>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Try adjusting your filters to find toppers matching your criteria.</p>
                </div>
            ) : (
                <>
                    <div className="student-buttons-row" style={{
                        display: 'flex',
                        gap: '8px',
                        overflowX: 'auto',
                        padding: '8px 4px',
                        background: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                        {toppersList.map((stud, idx) => {
                            const isSelected = selectedStudent?.STUD_ID === stud.STUD_ID;
                            return (
                                <button
                                    key={stud.STUD_ID || idx}
                                    onClick={() => setSelectedStudent(stud)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        border: isSelected ? '2px solid #1e3a8a' : '1px solid #cbd5e1',
                                        background: isSelected ? 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)' : '#f8fafc',
                                        color: isSelected ? '#ffffff' : '#1e293b',
                                        fontWeight: isSelected ? '700' : '600',
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.2s',
                                        boxShadow: isSelected ? '0 4px 6px -1px rgba(30, 58, 138, 0.3)' : 'none'
                                    }}
                                >
                                    <span style={{
                                        background: isSelected ? 'rgba(255,255,255,0.2)' : '#e2e8f0',
                                        color: isSelected ? '#ffffff' : '#475569',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '0.72rem',
                                        fontWeight: '800'
                                    }}>
                                        #{idx + 1}
                                    </span>
                                    <span>{stud.name || stud.STUD_NAME}</span>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        opacity: isSelected ? 0.9 : 0.7,
                                        fontWeight: '700'
                                    }}>
                                        ({Number(stud.tot || 0).toFixed(1)})
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Main Content Area for Selected Student */}
                    {selectedStudent && (
                        <div className="marks-loss-executive-view" style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
                            padding: '24px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '20px'
                        }}>
                            {/* Executive Header Banner */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: '2px solid #f1f5f9',
                                paddingBottom: '16px',
                                flexWrap: 'wrap',
                                gap: '15px'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                        <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                                            {selectedStudent.name || selectedStudent.STUD_NAME}
                                        </h2>
                                        <span style={{
                                            background: '#eff6ff',
                                            color: '#1e40af',
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: '700'
                                        }}>
                                            ID: {selectedStudent.STUD_ID}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.88rem', color: '#64748b', margin: 0 }}>
                                        Campus: <strong>{selectedStudent.campus || '-'}</strong> • Stream: <strong>{selectedStudent.stream || selectedStudent.Stream || 'SR_ELITE'}</strong>
                                    </p>
                                </div>

                                <button
                                    onClick={downloadStudentPdf}
                                    disabled={isExportingPdf || erpLoading || erpData.length === 0}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '10px 20px',
                                        borderRadius: '10px',
                                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                        color: 'white',
                                        border: 'none',
                                        fontWeight: '700',
                                        fontSize: '0.9rem',
                                        cursor: isExportingPdf || erpLoading || erpData.length === 0 ? 'not-allowed' : 'pointer',
                                        boxShadow: '0 4px 10px rgba(220, 38, 38, 0.3)',
                                        transition: 'all 0.2s',
                                        opacity: isExportingPdf || erpLoading || erpData.length === 0 ? 0.6 : 1
                                    }}
                                >
                                    <FileText size={18} />
                                    {isExportingPdf ? 'Generating Executive PDF...' : 'Download PDF Report'}
                                </button>
                            </div>

                            {/* ERP Data Content */}
                            {erpLoading ? (
                                <div style={{ padding: '60px', textAlign: 'center' }}>
                                    <div className="loading-spinner"></div>
                                    <p style={{ marginTop: '12px', color: '#64748b', fontWeight: '500' }}>Fetching ERP Marks Loss details for {selectedStudent.name}...</p>
                                </div>
                            ) : erpData.length === 0 ? (
                                <div style={{ padding: '60px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                                    <AlertTriangle size={48} color="#eab308" style={{ marginBottom: '12px' }} />
                                    <h4 style={{ fontSize: '1.1rem', color: '#0f172a', margin: '0 0 6px' }}>No Marks Loss Data Available</h4>
                                    <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>We couldn't find any Wrong (W) or Unattempted (U) records in the database for this student.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Test Selector */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '400px' }}>
                                        <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155' }}>Select Exam(s) to Analyze:</label>
                                        <Select
                                            isMulti
                                            options={[
                                                { value: "SELECT_ALL", label: "Select All" },
                                                ...uniqueTests.map(t => ({ value: t, label: t }))
                                            ]}
                                            value={
                                                selectedErpTests.length === uniqueTests.length
                                                    ? [{ value: "SELECT_ALL", label: "Select All" }, ...selectedErpTests.map(t => ({ value: t, label: t }))]
                                                    : selectedErpTests.map(t => ({ value: t, label: t }))
                                            }
                                            onChange={(selectedOptions, actionMeta) => {
                                                if (actionMeta.action === "select-option" && actionMeta.option.value === "SELECT_ALL") {
                                                    setSelectedErpTests(uniqueTests);
                                                } else if (actionMeta.action === "deselect-option" && actionMeta.option.value === "SELECT_ALL") {
                                                    setSelectedErpTests([]);
                                                } else {
                                                    let values = selectedOptions ? selectedOptions.map(opt => opt.value).filter(v => v !== 'SELECT_ALL') : [];
                                                    setSelectedErpTests(values);
                                                }
                                            }}
                                            closeMenuOnSelect={false}
                                            hideSelectedOptions={false}
                                            components={{ Option: CheckboxOption, ValueContainer: CompactValueContainer }}
                                            styles={reactSelectStyles}
                                            placeholder="Select Exams..."
                                        />
                                    </div>

                                    {selectedErpTests.length === 0 ? (
                                        <div style={{ padding: '60px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px' }}>
                                            <HelpCircle size={48} color="#6366f1" style={{ marginBottom: '12px' }} />
                                            <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0f172a', margin: '0 0 8px' }}>No Exam Selected</h4>
                                            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Select one or more exams from the dropdown above to view the analysis.</p>
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
                                                <CheckCircle size={18} color="#10b981" style={{ marginRight: '8px', flexShrink: 0 }} />
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

                                                                {(q.qUrl || q.sUrl) && (
                                                                    <div className="q-actions-bar">
                                                                        {q.qUrl && (
                                                                            <button 
                                                                                className="q-preview-btn"
                                                                                onClick={() => setZoomImage({ url: q.qUrl, title: `${q.test} - Q${q.qNo} (${q.subject})` })}
                                                                            >
                                                                                <Maximize2 size={13} /> View Question
                                                                            </button>
                                                                        )}
                                                                        {q.sUrl && (
                                                                            <button 
                                                                                className="q-preview-btn solution"
                                                                                onClick={() => setZoomImage({ url: q.sUrl, title: `${q.test} - Q${q.qNo} Solution (${q.subject})` })}
                                                                            >
                                                                                <BookOpen size={13} /> View Solution
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
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
        </div>
    );
};

export default TopperMarksLossReport;
