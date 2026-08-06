import React, { useState, useEffect, useMemo, useRef } from 'react';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import LoadingTimer from './LoadingTimer';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
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
    FileSpreadsheet, 
    FileText,
    X, 
    Maximize2, 
    AlertTriangle, 
    BookOpen, 
    TrendingUp, 
    HelpCircle,
    CheckCircle,
    ChevronRight
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

const ToppersPerformanceReport = ({ filters, setFilters, setActivePage }) => {
    const { userData } = useAuth();
    const [students, setStudents] = useState([]);
    const [examMeta, setExamMeta] = useState([]);
    const [loading, setLoading] = useState(true);
    const [topLimit, setTopLimit] = useState(10); // 10, 50, 100
    const [sortConfig, setSortConfig] = useState({ key: 'tot', direction: 'desc' });
    const [activeTab, setActiveTab] = useState('scores'); // 'scores', 'subjects', 'campuses'
    
    // Marks Loss Analyzer States
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [erpData, setErpData] = useState([]);
    const [erpLoading, setErpLoading] = useState(false);
    const [selectedErpTests, setSelectedErpTests] = useState([]);
    const [zoomImage, setZoomImage] = useState(null); // { url, title }
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

    // Handle mouse wheel zoom with passive: false to prevent background page scroll
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

    // Fetch data using the existing analysis-report endpoint
    useEffect(() => {
        const controller = new AbortController();
        const fetchData = async () => {
            setLoading(true);
            try {
                const queryParams = buildQueryParams(filters).toString();
                const res = await fetch(`${API_URL}/api/analysis-report?${queryParams}`, { signal: controller.signal });
                const data = await res.json();
                
                if (!controller.signal.aborted && data) {
                    setStudents(data.students || []);
                    setExamMeta(data.exams || []);
                    if (data.students && data.students.length > 0) {
                        logActivity(userData, 'Generated Toppers Report', { count: data.students.length });
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

    // Fetch ERP data for the selected student when the drawer opens
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

    // Slice and sort toppers list
    const toppersList = useMemo(() => {
        if (!students || students.length === 0) return [];
        
        // Sort first
        const sorted = [...students].sort((a, b) => {
            let aVal = a[sortConfig.key];
            let bVal = b[sortConfig.key];

            // Biology is bot + zoo
            if (sortConfig.key === 'bio') {
                aVal = (Number(a.bot) || 0) + (Number(a.zoo) || 0);
                bVal = (Number(b.bot) || 0) + (Number(b.zoo) || 0);
            }

            const isNumeric = (val) => typeof val === 'number' || (typeof val === 'string' && val.trim() !== '' && !isNaN(val));

            if (isNumeric(aVal) && isNumeric(bVal)) {
                aVal = Number(aVal);
                bVal = Number(bVal);
            } else {
                aVal = String(aVal || '').toLowerCase();
                bVal = String(bVal || '').toLowerCase();
                return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            }

            if (aVal === bVal) return 0;
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            return sortConfig.direction === 'asc' ? 1 : -1;
        });

        // Limit to selected Top N
        return sorted.slice(0, topLimit);
    }, [students, topLimit, sortConfig]);

    // Sort request helper
    const requestSort = (key) => {
        setSortConfig(prev => {
            const isDescByDefault = ['tot', 'air', 'bot', 'zoo', 'bio', 'phy', 'che', 't_app'].includes(key);
            const defaultDir = isDescByDefault ? 'desc' : 'asc';
            return {
                key,
                direction: prev.key === key ? (prev.direction === 'desc' ? 'asc' : 'desc') : defaultDir
            };
        });
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <span style={{ opacity: 0.2, marginLeft: '4px', fontSize: '0.8rem' }}>⇅</span>;
        return <span style={{ marginLeft: '4px', fontSize: '0.8rem', color: '#6366f1', fontWeight: 'bold' }}>{sortConfig.direction === 'desc' ? '↓' : '↑'}</span>;
    };

    // Calculate Summary Metrics for the current toppers list
    const summaryStats = useMemo(() => {
        if (toppersList.length === 0) return { max: 0, min: 0, avg: 0, campuses: 0 };
        
        const max = Number(toppersList[0]?.tot || 0).toFixed(1);
        const min = Number(toppersList[toppersList.length - 1]?.tot || 0).toFixed(1);
        const sum = toppersList.reduce((acc, curr) => acc + (Number(curr.tot) || 0), 0);
        const avg = (sum / toppersList.length).toFixed(1);
        
        const uniqueCampuses = new Set(toppersList.map(s => String(s.campus || '').trim().toUpperCase())).size;
        
        return { max, min, avg, campuses: uniqueCampuses };
    }, [toppersList]);

    // Chart 1: Individual Student Scores
    const studentScoresChartData = useMemo(() => {
        if (toppersList.length === 0) return { labels: [], datasets: [] };
        
        // No reverse so highest score is at the top
        const displayData = toppersList;

        return {
            labels: displayData.map(s => s.name),
            datasets: [
                {
                    label: 'Average Score',
                    data: displayData.map(s => Number(s.tot || 0).toFixed(1)),
                    backgroundColor: displayData.map((_, idx) => {
                        // Gold gradient feel for top 3
                        if (topLimit <= 10) {
                            if (idx === 0) return '#fbbf24'; // Gold
                            if (idx === 1) return '#94a3b8'; // Silver
                            if (idx === 2) return '#b45309'; // Bronze
                        }
                        return '#6366f1'; // Indigo for rest
                    }),
                    borderRadius: 6,
                    barThickness: 'flex',
                    maxBarThickness: topLimit > 10 ? 24 : 45,
                    datalabels: {
                        color: '#000000',
                        anchor: 'end',
                        align: 'end',
                        offset: 4,
                        font: { weight: 'bold', size: topLimit > 10 ? 10 : 12 },
                        formatter: (val) => Math.round(val)
                    }
                }
            ]
        };
    }, [toppersList, topLimit]);

    // Chart 2: Subject-wise Averages of Toppers
    const subjectAveragesChartData = useMemo(() => {
        if (toppersList.length === 0) return { labels: [], datasets: [] };

        const avgOf = (key) => (toppersList.reduce((acc, s) => acc + (Number(s[key]) || 0), 0) / toppersList.length).toFixed(1);

        return {
            labels: ['Botany', 'Zoology', 'Biology (Total)', 'Physics', 'Chemistry'],
            datasets: [
                {
                    label: 'Subject Average',
                    data: [
                        avgOf('bot'),
                        avgOf('zoo'),
                        (Number(avgOf('bot')) + Number(avgOf('zoo'))).toFixed(1),
                        avgOf('phy'),
                        avgOf('che')
                    ],
                    backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6', '#eab308', '#ec4899'],
                    borderRadius: 8,
                    barThickness: 45,
                    datalabels: {
                        color: '#000000',
                        anchor: 'end',
                        align: 'top',
                        font: { weight: '900', size: 13 },
                        formatter: (val) => Math.round(val)
                    }
                }
            ]
        };
    }, [toppersList]);

    // Chart 3: Campus Distribution (Doughnut Chart)
    const campusDistributionChartData = useMemo(() => {
        if (toppersList.length === 0) return { labels: [], datasets: [] };

        const counts = toppersList.reduce((acc, curr) => {
            const camp = String(curr.campus || 'Unknown').trim().toUpperCase();
            acc[camp] = (acc[camp] || 0) + 1;
            return acc;
        }, {});

        // Sort campuses by count descending
        const sortedCampuses = Object.entries(counts).sort((a, b) => b[1] - a[1]);

        return {
            labels: sortedCampuses.map(item => item[0]),
            datasets: [
                {
                    data: sortedCampuses.map(item => item[1]),
                    backgroundColor: [
                        '#4f46e5', // Indigo
                        '#10b981', // Emerald
                        '#f59e0b', // Amber
                        '#f43f5e', // Rose
                        '#06b6d4', // Cyan
                        '#8b5cf6', // Purple
                        '#ec4899', // Pink
                        '#1e293b', // Slate
                        '#64748b', // Slate light
                        '#3b82f6'  // Blue
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff',
                    datalabels: {
                        color: '#ffffff',
                        font: { weight: 'bold', size: 12 },
                        formatter: (val) => val
                    }
                }
            ]
        };
    }, [toppersList]);

    // Chart Options configurations
    const studentScoresChartOptions = {
        indexAxis: topLimit > 10 ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1e293b',
                bodyColor: '#0f172a',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 10
            },
            datalabels: { display: true }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: {
                    color: '#475569',
                    font: { size: 10, weight: '600' },
                    maxRotation: topLimit > 10 ? 0 : 45,
                    minRotation: topLimit > 10 ? 0 : 0
                },
                max: 720
            },
            y: {
                grid: { display: false },
                ticks: {
                    color: '#475569',
                    font: { size: topLimit > 10 ? 9 : 11, weight: 'bold' }
                }
            }
        },
        layout: {
            padding: { right: topLimit > 10 ? 40 : 10, top: topLimit > 10 ? 10 : 30 }
        }
    };

    const subjectAveragesChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1e293b',
                bodyColor: '#0f172a',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 10
            },
            datalabels: { display: true }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#475569', font: { size: 12, weight: 'bold' } }
            },
            y: {
                grid: { display: true, color: '#f1f5f9' },
                ticks: { color: '#475569' },
                max: 360 // Subject max or total Bio max
            }
        },
        layout: {
            padding: { top: 30 }
        }
    };

    const campusDistributionChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '60%',
        plugins: {
            legend: {
                display: true,
                position: 'right',
                labels: {
                    color: '#475569',
                    font: { weight: 'bold', size: 11 },
                    padding: 12
                }
            },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1e293b',
                bodyColor: '#0f172a',
                borderColor: '#e2e8f0',
                borderWidth: 1,
                padding: 10
            },
            datalabels: {
                display: true
            }
        }
    };

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
                lost = 5; // 4 missed + 1 negative
                if (subMap[subject]) {
                    subMap[subject].w++;
                    subMap[subject].lost += 5;
                }
            } else if (status === 'U') {
                unattemptedCount++;
                lost = 4; // 4 missed, 0 negative
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

    const handleSelectAllTests = () => {
        if (selectedErpTests.length === uniqueTests.length) {
            setSelectedErpTests([uniqueTests[0]]);
        } else {
            setSelectedErpTests(uniqueTests);
        }
    };

    const handleToggleTest = (test) => {
        setSelectedErpTests(prev => {
            if (prev.includes(test)) {
                if (prev.length === 1) return prev;
                return prev.filter(t => t !== test);
            } else {
                return [...prev, test];
            }
        });
    };

    const reactSelectStyles = {
        control: (base, state) => ({
            ...base,
            background: 'white',
            borderColor: state.isFocused ? '#172554' : '#e2e8f0',
            minHeight: '32px',
            height: '32px',
            borderRadius: '8px',
            boxShadow: 'none',
            '&:hover': { borderColor: '#172554' },
            overflow: 'hidden',
            width: '100%',
            maxWidth: '450px'
        }),
        valueContainer: (base) => ({
            ...base,
            height: '32px',
            padding: '0 8px',
            display: 'flex',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            overflowY: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
        }),
        indicatorsContainer: (base) => ({
            ...base,
            height: '32px',
        }),
        input: (base) => ({
            ...base,
            margin: '0px',
            padding: '0px',
            fontSize: '0.75rem',
        }),
        placeholder: (base) => ({
            ...base,
            fontSize: '0.75rem',
            color: '#94a3b8',
            whiteSpace: 'nowrap'
        }),
        multiValue: (base) => ({
            ...base,
            backgroundColor: '#eff6ff',
            borderRadius: '4px',
            margin: '2px 2px 2px 0',
            flexShrink: 0,
        }),
        multiValueLabel: (base) => ({
            ...base,
            color: '#1e40af',
            fontSize: '0.65rem',
            fontWeight: '700',
            padding: '1px 4px'
        }),
        multiValueRemove: (base) => ({
            ...base,
            padding: '0 2px',
            ':hover': { backgroundColor: '#ef4444', color: 'white' },
        }),
        option: (base, state) => ({
            ...base,
            backgroundColor: state.isFocused ? '#f1f5f9' : 'transparent',
            ':active': { backgroundColor: '#e2e8f0' },
            padding: '6px 10px',
        })
    };

    // Redirection helper to student timeline performance
    const handleViewStudentHistory = (student) => {
        setFilters({
            campus: [student.campus],
            stream: [],
            studentSearch: [student.STUD_ID],
            testType: [],
            test: [],
            topAll: []
        }, 'student_performance');
        setActivePage('student_performance');
    };

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

            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);

            doc.text("Sri Chaitanya Educational Institutions • Academic Performance System", margin, pageHeight - 6);
            doc.text("Page 1 of 1", pageWidth - margin, pageHeight - 6, { align: 'right' });

            const cleanFileName = `${selectedStudent.name.replace(/[^a-zA-Z0-9]/g, '_')}_Marks_Loss_Report.pdf`;
            doc.save(cleanFileName);
            logActivity(userData, 'Downloaded Marks Loss PDF', { student: selectedStudent.name, studentId: selectedStudent.STUD_ID });

        } catch (err) {
            console.error("PDF generation error:", err);
            alert("An error occurred while generating PDF report: " + err.message);
        } finally {
            setIsExportingPdf(false);
        }
    };

    // Download toppers list as Excel
    const downloadExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(`Top ${topLimit} Toppers`);

        worksheet.columns = [
            { header: 'Rank', key: 'rank', width: 8 },
            { header: 'Student Name', key: 'name', width: 30 },
            { header: 'Student ID', key: 'id', width: 15 },
            { header: 'Campus', key: 'campus', width: 25 },
            { header: 'Total Avg', key: 'tot', width: 12 },
            { header: 'AIR Avg', key: 'air', width: 12 },
            { header: 'Botany Avg', key: 'bot', width: 12 },
            { header: 'Zoology Avg', key: 'zoo', width: 12 },
            { header: 'Biology Avg', key: 'bio', width: 12 },
            { header: 'Physics Avg', key: 'phy', width: 12 },
            { header: 'Chemistry Avg', key: 'che', width: 12 },
            { header: 'Exams Written', key: 't_app', width: 15 }
        ];

        // Format Header Row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Dark Slate
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        toppersList.forEach((s, idx) => {
            const bio = (Number(s.bot) || 0) + (Number(s.zoo) || 0);
            worksheet.addRow({
                rank: idx + 1,
                name: s.name,
                id: s.STUD_ID,
                campus: s.campus,
                tot: Number(s.tot || 0).toFixed(1),
                air: s.air !== '-' ? Math.round(Number(s.air)) : '-',
                bot: Number(s.bot || 0).toFixed(1),
                zoo: Number(s.zoo || 0).toFixed(1),
                bio: bio.toFixed(1),
                phy: Number(s.phy || 0).toFixed(1),
                che: Number(s.che || 0).toFixed(1),
                t_app: s.t_app
            });
        });

        // Add Border & Alignment to each cell
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                row.alignment = { vertical: 'middle', horizontal: 'center' };
                row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' }; // Name left align
                row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' }; // Campus left align
                
                // Alternating row background colors
                if (rowNumber % 2 === 0) {
                    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
                }
            }
            row.eachCell(cell => {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const fileType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        const blob = new Blob([buffer], { type: fileType });
        saveAs(blob, `Toppers_Performance_Report_Top_${topLimit}.xlsx`);
        logActivity(userData, 'Downloaded Toppers Excel', { limit: topLimit });
    };

    return (
        <div className="toppers-report-container">
            <LoadingTimer isLoading={loading} />

            {/* Top Control Bar */}
            <div className="toppers-controls-bar">
                <div className="control-left">
                    <span className="results-indicator">
                        Found <strong>{students.length}</strong> Students matching filters. Showing <strong>Top {toppersList.length}</strong>.
                    </span>
                </div>
                <div className="control-right">
                    <div className="pill-group">
                        {[10, 50, 100].map(limit => (
                            <button
                                key={limit}
                                className={`pill-btn ${topLimit === limit ? 'active' : ''}`}
                                onClick={() => {
                                    setTopLimit(limit);
                                    logActivity(userData, `Switched Toppers View`, { limit });
                                }}
                            >
                                Top {limit}
                            </button>
                        ))}
                    </div>
                    
                    <button className="btn-excel-download" onClick={downloadExcel} title="Export to Excel">
                        <FileSpreadsheet size={16} style={{ marginRight: '6px' }} />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Summary cards grid */}
            <div className="stats-cards-grid">
                <div className="stat-glass-card max-mark">
                    <div className="card-decor"></div>
                    <div className="card-icon"><Award size={24} color="#f59e0b" /></div>
                    <div className="card-details">
                        <span className="card-lbl">Highest Average Mark</span>
                        <span className="card-val">{summaryStats.max} / 720</span>
                    </div>
                </div>

                <div className="stat-glass-card cutoff-mark">
                    <div className="card-decor"></div>
                    <div className="card-icon"><TrendingUp size={24} color="#ef4444" /></div>
                    <div className="card-details">
                        <span className="card-lbl">Group Cutoff Score</span>
                        <span className="card-val">{summaryStats.min} / 720</span>
                    </div>
                </div>

                <div className="stat-glass-card avg-mark">
                    <div className="card-decor"></div>
                    <div className="card-icon"><Activity size={24} color="#3b82f6" /></div>
                    <div className="card-details">
                        <span className="card-lbl">Group Average Score</span>
                        <span className="card-val">{summaryStats.avg} / 720</span>
                    </div>
                </div>

                <div className="stat-glass-card campus-count">
                    <div className="card-decor"></div>
                    <div className="card-icon"><MapPin size={24} color="#6366f1" /></div>
                    <div className="card-details">
                        <span className="card-lbl">Represented Campuses</span>
                        <span className="card-val">{summaryStats.campuses} Campuses</span>
                    </div>
                </div>
            </div>

            {/* Visual Charts Section */}
            <div className="charts-glass-section">
                <div className="chart-tabs-header">
                    <button 
                        className={`chart-tab-btn ${activeTab === 'scores' ? 'active' : ''}`}
                        onClick={() => setActiveTab('scores')}
                    >
                        Student Scores
                    </button>
                    <button 
                        className={`chart-tab-btn ${activeTab === 'subjects' ? 'active' : ''}`}
                        onClick={() => setActiveTab('subjects')}
                    >
                        Subject Strengths
                    </button>
                    <button 
                        className={`chart-tab-btn ${activeTab === 'campuses' ? 'active' : ''}`}
                        onClick={() => setActiveTab('campuses')}
                    >
                        Campus Contribution
                    </button>
                </div>

                <div className="chart-content-area">
                    {activeTab === 'scores' && (
                        <div className="chart-scroll-wrapper" style={{ 
                            maxHeight: '450px', 
                            overflowY: topLimit > 10 ? 'auto' : 'visible',
                            position: 'relative'
                        }}>
                            <div style={{ 
                                height: topLimit > 10 ? `${Math.max(350, toppersList.length * 30)}px` : '320px', 
                                position: 'relative',
                                width: '100%'
                            }}>
                                {toppersList.length > 0 ? (
                                    <Bar data={studentScoresChartData} options={studentScoresChartOptions} />
                                ) : (
                                    <div className="empty-chart-msg">No data available to display chart</div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'subjects' && (
                        <div style={{ height: '320px', position: 'relative', width: '100%' }}>
                            {toppersList.length > 0 ? (
                                <Bar data={subjectAveragesChartData} options={subjectAveragesChartOptions} />
                            ) : (
                                <div className="empty-chart-msg">No data available to display chart</div>
                            )}
                        </div>
                    )}

                    {activeTab === 'campuses' && (
                        <div style={{ height: '320px', position: 'relative', width: '100%' }}>
                            {toppersList.length > 0 ? (
                                <Doughnut data={campusDistributionChartData} options={campusDistributionChartOptions} />
                            ) : (
                                <div className="empty-chart-msg">No data available to display chart</div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Toppers Details Table */}
            <div className="table-glass-section">
                <div className="table-header-title">
                    Estimated Toppers Performance Directory
                </div>
                <div className="table-responsive">
                    <table className="analysis-table merit-style">
                        <thead>
                            <tr>
                                <th onClick={() => requestSort('tot')} style={{ cursor: 'pointer' }}>Rank <SortIcon columnKey="tot" /></th>
                                <th onClick={() => requestSort('name')} style={{ cursor: 'pointer' }}>Student Name <SortIcon columnKey="name" /></th>
                                <th onClick={() => requestSort('STUD_ID')} style={{ cursor: 'pointer' }}>Student ID <SortIcon columnKey="STUD_ID" /></th>
                                <th onClick={() => requestSort('campus')} style={{ cursor: 'pointer' }}>Campus <SortIcon columnKey="campus" /></th>
                                <th onClick={() => requestSort('tot')} style={{ cursor: 'pointer', background: '#002060', color: 'white' }}>TOTAL avg <SortIcon columnKey="tot" /></th>
                                <th onClick={() => requestSort('air')} style={{ cursor: 'pointer', background: '#ffff00', color: 'black' }}>AIR avg <SortIcon columnKey="air" /></th>
                                <th onClick={() => requestSort('bot')} style={{ cursor: 'pointer', background: '#ffffcc', color: 'black' }}>Botany <SortIcon columnKey="bot" /></th>
                                <th onClick={() => requestSort('zoo')} style={{ cursor: 'pointer', background: '#fde9d9', color: 'black' }}>Zoology <SortIcon columnKey="zoo" /></th>
                                <th onClick={() => requestSort('bio')} style={{ cursor: 'pointer', background: '#d8e2dc', color: 'black' }}>Biology <SortIcon columnKey="bio" /></th>
                                <th onClick={() => requestSort('phy')} style={{ cursor: 'pointer', background: '#e4dfec', color: 'black' }}>Physics <SortIcon columnKey="phy" /></th>
                                <th onClick={() => requestSort('che')} style={{ cursor: 'pointer', background: '#ddd9c4', color: 'black' }}>Chemistry <SortIcon columnKey="che" /></th>
                                <th onClick={() => requestSort('t_app')} style={{ cursor: 'pointer' }}>Exams <SortIcon columnKey="t_app" /></th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {toppersList.length === 0 ? (
                                <tr>
                                    <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                                        No topper records matching active filters.
                                    </td>
                                </tr>
                            ) : (
                                toppersList.map((student, idx) => {
                                    const bio = (Number(student.bot) || 0) + (Number(student.zoo) || 0);
                                    return (
                                        <tr key={student.STUD_ID} className="topper-row-tr">
                                            <td className="rank-col-val">#{idx + 1}</td>
                                            <td className="text-left font-bold student-clickable-name" onClick={() => setSelectedStudent(student)}>
                                                {student.name}
                                            </td>
                                            <td>{student.STUD_ID}</td>
                                            <td className="text-left">{student.campus}</td>
                                            <td className="col-yellow font-bold text-black">{Number(student.tot || 0).toFixed(1)}</td>
                                            <td className="col-white font-bold text-brown">{student.air !== '-' ? Math.round(Number(student.air)) : '-'}</td>
                                            <td className="col-green">{Number(student.bot || 0).toFixed(1)}</td>
                                            <td className="col-blue-light">{Number(student.zoo || 0).toFixed(1)}</td>
                                            <td className="col-purple" style={{ fontWeight: '800' }}>{bio.toFixed(1)}</td>
                                            <td className="col-green-pale">{Number(student.phy || 0).toFixed(1)}</td>
                                            <td className="col-pink-pale">{Number(student.che || 0).toFixed(1)}</td>
                                            <td className="font-bold">{student.t_app}</td>
                                            <td className="actions-cell">
                                                <button 
                                                    className="btn-action-loss" 
                                                    onClick={() => setSelectedStudent(student)}
                                                    title="View Marks Loss Analyzer"
                                                >
                                                    Marks Loss
                                                </button>
                                                <button 
                                                    className="btn-action-view" 
                                                    onClick={() => handleViewStudentHistory(student)}
                                                    title="View Full Timeline"
                                                >
                                                    History
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MARKS LOSS ANALYZER SLIDE DRAWER / MODAL */}
            {selectedStudent && (
                <div className="drawer-overlay" onClick={() => setSelectedStudent(null)}>
                    <div className="drawer-container topper-drawer-animate" onClick={(e) => e.stopPropagation()}>
                        {/* Drawer Header */}
                        <div className="drawer-header">
                            <div className="drawer-title-block">
                                <h3 className="drawer-title">Marks Loss Analyzer</h3>
                                <span className="drawer-subtitle">
                                    {selectedStudent.name} ({selectedStudent.STUD_ID}) • {selectedStudent.campus} {(selectedStudent.stream || selectedStudent.Stream || (erpData && erpData.length > 0 ? erpData.find(r => r.Stream)?.Stream : null)) ? `• ${selectedStudent.stream || selectedStudent.Stream || erpData.find(r => r.Stream)?.Stream}` : ''}
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button 
                                    className="btn-pdf-download"
                                    onClick={downloadStudentPdf}
                                    disabled={isExportingPdf}
                                    title="Download Professional PDF Report for Student, Parents & Faculty"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '7px 14px',
                                        borderRadius: '8px',
                                        background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                                        color: 'white',
                                        border: 'none',
                                        fontWeight: '700',
                                        fontSize: '0.82rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                                        transition: 'all 0.2s',
                                        opacity: isExportingPdf ? 0.7 : 1
                                    }}
                                >
                                    <FileText size={16} />
                                    {isExportingPdf ? 'Generating PDF...' : 'Download PDF Report'}
                                </button>
                                <button className="drawer-close-btn" onClick={() => setSelectedStudent(null)}>
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Drawer Content */}
                        <div className="drawer-body">
                            {erpLoading ? (
                                <div className="drawer-loading">
                                    <div className="loading-spinner"></div>
                                    <p>Fetching ERP Marks Loss details...</p>
                                </div>
                            ) : erpData.length === 0 ? (
                                <div className="drawer-empty-state">
                                    <AlertTriangle size={48} color="#eab308" />
                                    <h4>No Marks Loss Data Available</h4>
                                    <p>We couldn't find any Wrong (W) or Unattempted (U) records in the database for this student.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Test Selector */}
                                    <div className="drawer-filter-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px', zIndex: 50 }}>
                                        <label className="filter-label" style={{ marginBottom: 0 }}>Select Exams to Analyze:</label>
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
                                        <div className="drawer-empty-state" style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                                            <HelpCircle size={48} color="#6366f1" style={{ marginBottom: '15px' }} />
                                            <h4 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#0f172a', marginBottom: '8px' }}>No Exam Selected</h4>
                                            <p style={{ fontSize: '0.85rem', color: '#64748b', textAlign: 'center', maxWidth: '300px', margin: 0 }}>
                                                Please select one or more exams from the dropdown list to see the student's performance analysis.
                                            </p>
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

                                    {/* Potential Score Banner & Exam Averages Summary */}
                                    <div className="potential-score-banner" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px 18px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <CheckCircle size={20} color="#10b981" style={{ flexShrink: 0 }} />
                                                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#065f46' }}>
                                                    Selected Exams: <strong>{selectedErpTests.length}</strong> / {uniqueTests.length} Test{selectedErpTests.length > 1 ? 's' : ''}
                                                </span>
                                                <span style={{
                                                    background: '#d1fae5',
                                                    color: '#047857',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    fontSize: '0.75rem',
                                                    fontWeight: '800'
                                                }}>
                                                    {selectedErpTests.length === uniqueTests.length ? 'All Exams Selected' : `${selectedErpTests.length} Selected`}
                                                </span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px dashed #a7f3d0' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: '800', color: '#047857', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                                                {selectedErpTests.length > 1 ? `Averages (${selectedErpTests.length} Exams):` : 'Exam Score:'}
                                            </span>
                                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                                <span style={{ background: '#047857', color: '#ffffff', padding: '3px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '800' }}>
                                                    TOT: {erpAnalysis.totalScored} / 720
                                                </span>
                                                <span style={{ background: '#ffffff', border: '1px solid #a7f3d0', color: '#065f46', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700' }}>
                                                    BOT: <strong style={{ color: '#047857' }}>{erpAnalysis.scoredMarks.BOTANY}</strong>/180
                                                </span>
                                                <span style={{ background: '#ffffff', border: '1px solid #a7f3d0', color: '#065f46', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700' }}>
                                                    ZOO: <strong style={{ color: '#047857' }}>{erpAnalysis.scoredMarks.ZOOLOGY}</strong>/180
                                                </span>
                                                <span style={{ background: '#ffffff', border: '1px solid #a7f3d0', color: '#065f46', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700' }}>
                                                    PHY: <strong style={{ color: '#047857' }}>{erpAnalysis.scoredMarks.PHYSICS}</strong>/180
                                                </span>
                                                <span style={{ background: '#ffffff', border: '1px solid #a7f3d0', color: '#065f46', padding: '3px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: '700' }}>
                                                    CHE: <strong style={{ color: '#047857' }}>{erpAnalysis.scoredMarks.CHEMISTRY}</strong>/180
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Charts side-by-side breakdown */}
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
                                                        layout: {
                                                            padding: { top: 15 }
                                                        }
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

                                    {/* Question details list */}
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
                                                        <div className="q-topic-name">
                                                            <strong>Topic:</strong> {q.topic} {q.subTopic ? `(${q.subTopic})` : ''}
                                                        </div>
                                                        <div className="q-key-info">
                                                            <strong>Correct Key:</strong> <span className="key-badge">{q.keyValue || 'N/A'}</span>
                                                        </div>
                                                        <div className="q-lost-explain">
                                                            {q.status === 'W' ? (
                                                                <span>Got <strong>-1</strong> instead of <strong>+4</strong>. Lost 4 marks (correct value) + 1 mark (negative penalty) = <strong>5 marks lost</strong>.</span>
                                                            ) : (
                                                                <span>Got <strong>0</strong> instead of <strong>+4</strong>. Lost 4 marks (correct value) with 0 penalty = <strong>4 marks lost</strong>.</span>
                                                            )}
                                                        </div>
                                                        {(q.qUrl || q.sUrl) && (
                                                            <div className="q-actions-row">
                                                                {q.qUrl && (
                                                                    <button 
                                                                        className="q-image-btn" 
                                                                        onClick={() => setZoomImage({ url: q.qUrl, title: `${q.test} • Question Q${q.qNo} (${q.subject})` })}
                                                                    >
                                                                        <Maximize2 size={12} style={{ marginRight: '4px' }} />
                                                                        View Question
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
                    </div>
                </div>
            )}

            {/* ZOOMED IMAGE OVERLAY */}
            {zoomImage && (
                <div className="zoom-overlay" onClick={() => setZoomImage(null)}>
                    <div className="zoom-container topper-drawer-animate" onClick={(e) => e.stopPropagation()}>
                        <div className="zoom-header">
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span className="zoom-title">{zoomImage.title}</span>
                                <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', fontWeight: 'bold' }}>
                                    💡 Scroll mouse wheel to zoom | Drag to pan
                                </span>
                            </div>
                            <button className="zoom-close-btn" onClick={() => setZoomImage(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div 
                            ref={zoomContainerRef}
                            className="zoom-body"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            style={{
                                flex: 1,
                                width: '100%',
                                cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
                                overflow: 'hidden',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                background: '#f1f5f9',
                                padding: '20px',
                                userSelect: 'none'
                            }}
                        >
                            <img 
                                src={zoomImage.url} 
                                alt={zoomImage.title} 
                                className="zoomed-image-el" 
                                style={{
                                    transform: `translate(${zoomOffset.x}px, ${zoomOffset.y}px) scale(${zoomScale})`,
                                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                                    transformOrigin: 'center center',
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                    borderRadius: '6px',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                    pointerEvents: 'none'
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .toppers-report-container {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    width: 100%;
                }

                /* Control bar */
                .toppers-controls-bar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.5);
                    padding: 10px 20px;
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                }
                .results-indicator {
                    font-size: 0.95rem;
                    color: var(--text-secondary);
                }
                .control-right {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                .pill-group {
                    display: flex;
                    background: #f1f5f9;
                    border-radius: 20px;
                    padding: 3px;
                }
                .pill-btn {
                    border: none;
                    background: transparent;
                    color: #475569;
                    font-size: 0.85rem;
                    font-weight: 700;
                    padding: 6px 16px;
                    border-radius: 17px;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .pill-btn.active {
                    background: #172554;
                    color: white;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .btn-excel-download {
                    display: flex;
                    align-items: center;
                    background: #15803d;
                    color: white;
                    border: none;
                    font-weight: 700;
                    font-size: 0.85rem;
                    padding: 8px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: background 0.2s;
                }
                .btn-excel-download:hover {
                    background: #16a34a;
                }

                /* Stats Cards */
                .stats-cards-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 15px;
                }
                .stat-glass-card {
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    border-radius: 12px;
                    padding: 15px 20px;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    position: relative;
                    overflow: hidden;
                    transition: transform 0.2s, box-shadow 0.2s;
                }
                .stat-glass-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
                }
                .card-decor {
                    position: absolute;
                    top: 0;
                    left: 0;
                    bottom: 0;
                    width: 4px;
                }
                .max-mark .card-decor { background: #eab308; }
                .cutoff-mark .card-decor { background: #ef4444; }
                .avg-mark .card-decor { background: #3b82f6; }
                .campus-count .card-decor { background: #6366f1; }
                .card-icon {
                    background: #f8fafc;
                    width: 48px;
                    height: 48px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }
                .card-details {
                    display: flex;
                    flex-direction: column;
                }
                .card-lbl {
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.025em;
                }
                .card-val {
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-top: 2px;
                }

                /* Charts Glass Section */
                .charts-glass-section {
                    background: rgba(255, 255, 255, 0.85);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.5);
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    padding: 20px;
                }
                .chart-tabs-header {
                    display: flex;
                    border-bottom: 2px solid #e2e8f0;
                    margin-bottom: 20px;
                    gap: 15px;
                }
                .chart-tab-btn {
                    background: transparent;
                    border: none;
                    color: #64748b;
                    font-weight: 700;
                    font-size: 0.9rem;
                    padding: 10px 5px;
                    cursor: pointer;
                    position: relative;
                    transition: color 0.2s;
                }
                .chart-tab-btn:hover {
                    color: #1e293b;
                }
                .chart-tab-btn.active {
                    color: #6366f1;
                }
                .chart-tab-btn.active::after {
                    content: '';
                    position: absolute;
                    bottom: -2px;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: #6366f1;
                }
                .chart-content-area {
                    min-height: 320px;
                }
                .empty-chart-msg {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #64748b;
                    font-size: 0.95rem;
                }

                /* Details table Section */
                .table-glass-section {
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(10px);
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    border-radius: 12px;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
                    overflow: hidden;
                }
                .table-header-title {
                    background: #172554;
                    color: white;
                    padding: 12px 20px;
                    font-weight: 700;
                    font-size: 0.95rem;
                }
                .topper-row-tr:hover {
                    background: rgba(99, 102, 241, 0.04) !important;
                }
                .rank-col-val {
                    font-weight: 800;
                    color: #3b82f6;
                    font-size: 0.85rem;
                }
                .student-clickable-name {
                    cursor: pointer;
                    color: #4f46e5 !important;
                    text-decoration: underline;
                }
                .student-clickable-name:hover {
                    color: #312e81 !important;
                }
                .actions-cell {
                    display: flex;
                    gap: 6px;
                    justify-content: center;
                }
                .btn-action-loss {
                    background: #ef4444;
                    color: white;
                    border: none;
                    font-weight: 700;
                    font-size: 0.72rem;
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .btn-action-loss:hover {
                    background: #dc2626;
                }
                .btn-action-view {
                    background: #6366f1;
                    color: white;
                    border: none;
                    font-weight: 700;
                    font-size: 0.72rem;
                    padding: 4px 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background 0.15s;
                }
                .btn-action-view:hover {
                    background: #4f46e5;
                }

                .drawer-charts-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    background: rgba(248, 250, 252, 0.7);
                    padding: 12px;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 5px;
                }
                .drawer-chart-col {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }

                .q-badge-test {
                    background: #e0e7ff;
                    color: #4338ca;
                    font-weight: 800;
                    font-size: 0.7rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    text-transform: uppercase;
                    margin-right: 6px;
                }

                /* Drawer details panel */
                .drawer-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.55);
                    backdrop-filter: blur(6px);
                    z-index: 9999;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                }
                .drawer-container {
                    width: 95%;
                    max-width: 1300px;
                    background: white;
                    height: 90vh;
                    border-radius: 16px;
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.04);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .drawer-header {
                    padding: 15px 20px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: #f8fafc;
                }
                .drawer-title {
                    font-size: 1.15rem;
                    font-weight: 800;
                    color: #0f172a;
                }
                .drawer-subtitle {
                    font-size: 0.78rem;
                    color: #64748b;
                    font-weight: 600;
                    display: block;
                    margin-top: 2px;
                }
                .drawer-close-btn {
                    border: none;
                    background: transparent;
                    color: #64748b;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .drawer-close-btn:hover {
                    background: #e2e8f0;
                    color: #0f172a;
                }
                .drawer-body {
                    padding: 20px;
                    flex: 1;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                }
                .drawer-loading {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 250px;
                    gap: 12px;
                    color: #64748b;
                }
                .loading-spinner {
                    width: 36px;
                    height: 36px;
                    border: 4px solid #f1f5f9;
                    border-top-color: #6366f1;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                .drawer-empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 250px;
                    text-align: center;
                    padding: 20px;
                }
                .drawer-empty-state h4 {
                    font-size: 1.05rem;
                    font-weight: 700;
                    margin-top: 15px;
                    color: #1e293b;
                }
                .drawer-empty-state p {
                    font-size: 0.85rem;
                    color: #64748b;
                    max-width: 280px;
                    margin-top: 5px;
                }
                .drawer-filter-row {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    background: #f8fafc;
                    padding: 10px 15px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                }
                .filter-label {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #475569;
                }
                .drawer-select {
                    flex: 1;
                    padding: 6px 12px;
                    border-radius: 6px;
                    border: 1px solid #cbd5e1;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #0f172a;
                    outline: none;
                }
                .drawer-loss-cards {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                }
                .loss-summary-card {
                    padding: 12px;
                    border-radius: 10px;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
                }
                .loss-summary-card.total {
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                    color: #991b1b;
                }
                .loss-summary-card.wrong {
                    background: #fffbeb;
                    border: 1px solid #fef3c7;
                    color: #92400e;
                }
                .loss-summary-card.skipped {
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    color: #166534;
                }
                .loss-card-title {
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    opacity: 0.8;
                }
                .loss-card-val {
                    font-size: 1.15rem;
                    font-weight: 800;
                    margin-top: 3px;
                }
                .loss-card-sub {
                    font-size: 0.65rem;
                    margin-top: 3px;
                    opacity: 0.8;
                }
                .potential-score-banner {
                    display: flex;
                    align-items: center;
                    background: #ecfdf5;
                    border: 1px solid #a7f3d0;
                    color: #065f46;
                    padding: 10px 15px;
                    border-radius: 8px;
                    font-size: 0.85rem;
                }
                .potential-score-banner strong {
                    margin: 0 4px;
                }
                .drawer-section-title {
                    font-size: 0.9rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 10px;
                    text-transform: uppercase;
                    letter-spacing: 0.025em;
                }
                .drawer-mini-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.82rem;
                }
                .drawer-mini-table th {
                    text-align: left;
                    background: #f8fafc;
                    padding: 8px 10px;
                    font-weight: 700;
                    color: #475569;
                    border-bottom: 2px solid #e2e8f0;
                }
                .drawer-mini-table td {
                    padding: 8px 10px;
                    border-bottom: 1px solid #f1f5f9;
                    color: #1e293b;
                }
                .drawer-mini-table tr:last-child td {
                    border-bottom: none;
                }
                .sub-text {
                    font-size: 0.7rem;
                    color: #64748b;
                    margin-left: 3px;
                }
                .loss-red {
                    color: #dc2626;
                }
                .drawer-section-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                    border-bottom: 1px solid #f1f5f9;
                    padding-bottom: 5px;
                }
                .q-count-badge {
                    background: #f1f5f9;
                    color: #475569;
                    padding: 2px 8px;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 700;
                }
                .questions-grid-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .q-detail-card {
                    background: #f8fafc;
                    border-radius: 8px;
                    padding: 12px;
                    border-left: 4px solid #cbd5e1;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
                }
                .q-detail-card.w {
                    border-left-color: #f59e0b; /* Orange for Wrong */
                }
                .q-detail-card.u {
                    border-left-color: #10b981; /* Green for Unattempted */
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
                .q-badge-subject {
                    background: #e2e8f0;
                    color: #334155;
                    font-weight: 800;
                    font-size: 0.7rem;
                    padding: 2px 6px;
                    border-radius: 4px;
                    text-transform: uppercase;
                }
                .q-num {
                    font-weight: 800;
                    color: #0f172a;
                    font-size: 0.85rem;
                }
                .q-status-tag {
                    font-size: 0.7rem;
                    font-weight: 800;
                    padding: 2px 6px;
                    border-radius: 4px;
                }
                .q-status-tag.w {
                    background: #fffbeb;
                    color: #b45309;
                }
                .q-status-tag.u {
                    background: #f0fdf4;
                    color: #15803d;
                }
                .q-topic-name {
                    font-size: 0.8rem;
                    color: #334155;
                }
                .q-key-info {
                    font-size: 0.78rem;
                    color: #475569;
                }
                .key-badge {
                    background: #e2e8f0;
                    padding: 1px 6px;
                    border-radius: 4px;
                    font-weight: bold;
                    color: #1e293b;
                }
                .q-lost-explain {
                    font-size: 0.76rem;
                    color: #dc2626;
                    font-style: italic;
                    background: rgba(220, 38, 38, 0.03);
                    padding: 4px 8px;
                    border-radius: 4px;
                }
                .q-actions-row {
                    display: flex;
                    gap: 8px;
                    margin-top: 4px;
                }
                .q-image-btn {
                    display: flex;
                    align-items: center;
                    border: 1px solid #cbd5e1;
                    background: white;
                    color: #475569;
                    font-size: 0.72rem;
                    font-weight: 700;
                    padding: 4px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .q-image-btn:hover {
                    background: #f8fafc;
                    border-color: #6366f1;
                    color: #6366f1;
                }
                .q-image-btn.solution:hover {
                    border-color: #10b981;
                    color: #10b981;
                }

                /* Zoom Overlay */
                .zoom-overlay {
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
                .zoom-container {
                    background: white;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 1100px;
                    height: 85vh;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                }
                .zoom-header {
                    padding: 12px 20px;
                    background: #f8fafc;
                    border-bottom: 1px solid #cbd5e1;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .zoom-title {
                    font-weight: 800;
                    color: #0f172a;
                    font-size: 0.95rem;
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
                .zoom-body {
                    padding: 15px;
                    overflow: auto;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    background: #f1f5f9;
                }
                .zoomed-image-el {
                    max-width: 100%;
                    max-height: 70vh;
                    object-fit: contain;
                    border-radius: 6px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                }

                /* Animations */
                .animate-slide-in {
                    animation: slideIn 0.3s ease-out;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }
                .topper-drawer-animate {
                    animation: topperDrawerFadeIn 0.25s ease-out forwards;
                    opacity: 1 !important;
                }
                @keyframes topperDrawerFadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }

                /* Table custom style overrides */
                .col-purple { background-color: #faf5ff !important; }
                .text-black { color: #000000 !important; }
                .text-brown { color: #6c361e !important; }
            `}</style>
        </div>
    );
};

export default ToppersPerformanceReport;
