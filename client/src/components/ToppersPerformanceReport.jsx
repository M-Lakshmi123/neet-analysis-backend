import React, { useState, useEffect, useMemo } from 'react';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import LoadingTimer from './LoadingTimer';
import ExcelJS from 'exceljs';
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
import { 
    Award, 
    Activity, 
    MapPin, 
    FileSpreadsheet, 
    X, 
    Maximize2, 
    AlertTriangle, 
    BookOpen, 
    TrendingUp, 
    HelpCircle,
    CheckCircle,
    ChevronRight
} from 'lucide-react';

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
    const [selectedErpTest, setSelectedErpTest] = useState('');
    const [zoomImage, setZoomImage] = useState(null); // { url, title }

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
            setSelectedErpTest('');
            return;
        }

        const fetchErpData = async () => {
            setErpLoading(true);
            try {
                const year = filters.academicYear || '2026';
                const res = await fetch(`${API_URL}/api/erp/report?academicYear=${year}&studentSearch=${selectedStudent.STUD_ID}`);
                const data = await res.json();
                setErpData(data || []);
                
                // Set default selected test if available
                if (data && data.length > 0) {
                    const uniqueTests = [...new Set(data.map(r => r.Test))];
                    setSelectedErpTest(uniqueTests[0] || '');
                }
            } catch (error) {
                console.error("Failed to fetch ERP data for topper:", error);
            } finally {
                setErpLoading(false);
            }
        };

        fetchErpData();
    }, [selectedStudent, filters.academicYear]);

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
        
        // Reverse for horizontal chart so highest score is at the top
        const displayData = topLimit > 10 ? [...toppersList].reverse() : toppersList;

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

    // Calculate Marks Loss Details for current selected test
    const erpAnalysis = useMemo(() => {
        if (!selectedStudent || erpData.length === 0 || !selectedErpTest) {
            return { 
                totalLost: 0, 
                wrongCount: 0, 
                wrongLost: 0, 
                unattemptedCount: 0, 
                unattemptedLost: 0, 
                questions: [], 
                subjects: {},
                scoredMarks: { BOTANY: 180, ZOOLOGY: 180, PHYSICS: 180, CHEMISTRY: 180 },
                totalScored: 720
            };
        }

        const testRows = erpData.filter(r => r.Test === selectedErpTest);
        
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

        const firstRow = testRows[0];
        const scoredMarks = {
            BOTANY: firstRow ? (Number(firstRow.Botany) || 0) : 180,
            ZOOLOGY: firstRow ? (Number(firstRow.Zoology) || 0) : 180,
            PHYSICS: firstRow ? (Number(firstRow.Physics) || 0) : 180,
            CHEMISTRY: firstRow ? (Number(firstRow.Chemistry) || 0) : 180
        };
        const totalScored = firstRow ? (Number(firstRow.Tot_720) || 0) : 720;

        const wrongLost = wrongCount * 5;
        const unattemptedLost = unattemptedCount * 4;
        const totalLost = wrongLost + unattemptedLost;

        return {
            totalLost,
            wrongCount,
            wrongLost,
            unattemptedCount,
            unattemptedLost,
            questions: questionsList.sort((a, b) => a.qNo - b.qNo),
            subjects: subMap,
            scoredMarks,
            totalScored
        };
    }, [selectedStudent, erpData, selectedErpTest]);

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
                    <div className="drawer-container animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        {/* Drawer Header */}
                        <div className="drawer-header">
                            <div className="drawer-title-block">
                                <h3 className="drawer-title">Marks Loss Analyzer</h3>
                                <span className="drawer-subtitle">
                                    {selectedStudent.name} ({selectedStudent.STUD_ID}) • {selectedStudent.campus}
                                </span>
                            </div>
                            <button className="drawer-close-btn" onClick={() => setSelectedStudent(null)}>
                                <X size={20} />
                            </button>
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
                                    <div className="drawer-filter-row">
                                        <label className="filter-label">Select Exam to Analyze:</label>
                                        <select 
                                            className="drawer-select" 
                                            value={selectedErpTest} 
                                            onChange={(e) => setSelectedErpTest(e.target.value)}
                                        >
                                            {[...new Set(erpData.map(r => r.Test))].map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>

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

                                    {/* Potential Score note */}
                                    <div className="potential-score-banner">
                                        <CheckCircle size={18} color="#10b981" style={{ marginRight: '8px', flexShrink: 0 }} />
                                        <span>
                                            With 0 mistakes, this student's score on this test would have been 
                                            <strong> {720 - erpAnalysis.totalLost} / 720</strong>.
                                        </span>
                                    </div>

                                    {/* Charts side-by-side breakdown */}
                                    <div className="drawer-charts-row">
                                        <div className="drawer-chart-col">
                                            <h4 className="drawer-section-title">Subject Wise Performance</h4>
                                            <div style={{ height: '200px', position: 'relative' }}>
                                                <Bar 
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
                                                                align: 'top',
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
                                                            y: { grid: { display: true, color: '#f1f5f9' }, max: 180, ticks: { font: { size: 9 } } }
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        <div className="drawer-chart-col">
                                            <h4 className="drawer-section-title">Marks Loss Distribution</h4>
                                            <div style={{ height: '200px', position: 'relative' }}>
                                                <Doughnut 
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
                                                            {erpAnalysis.scoredMarks[subject]} / 180
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
                                                        {erpAnalysis.totalScored} / 720
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
                                                                        onClick={() => setZoomImage({ url: q.qUrl, title: `Question Q${q.qNo} (${q.subject})` })}
                                                                    >
                                                                        <Maximize2 size={12} style={{ marginRight: '4px' }} />
                                                                        View Question
                                                                    </button>
                                                                )}
                                                                {q.sUrl && (
                                                                    <button 
                                                                        className="q-image-btn solution" 
                                                                        onClick={() => setZoomImage({ url: q.sUrl, title: `Solution Q${q.qNo} (${q.subject})` })}
                                                                    >
                                                                        <Maximize2 size={12} style={{ marginRight: '4px' }} />
                                                                        View Solution
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
                        </div>
                    </div>
                </div>
            )}

            {/* ZOOMED IMAGE OVERLAY */}
            {zoomImage && (
                <div className="zoom-overlay" onClick={() => setZoomImage(null)}>
                    <div className="zoom-container animate-fade-in" onClick={(e) => e.stopPropagation()}>
                        <div className="zoom-header">
                            <span className="zoom-title">{zoomImage.title}</span>
                            <button className="zoom-close-btn" onClick={() => setZoomImage(null)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="zoom-body">
                            <img src={zoomImage.url} alt={zoomImage.title} className="zoomed-image-el" />
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

                /* Drawer details panel */
                .drawer-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.55);
                    backdrop-filter: blur(6px);
                    z-index: 1000;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 20px;
                }
                .drawer-container {
                    width: 90%;
                    max-width: 850px;
                    background: white;
                    height: 85vh;
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
                    z-index: 1100;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .zoom-container {
                    background: white;
                    border-radius: 12px;
                    max-width: 90%;
                    max-height: 90%;
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
                .animate-fade-in {
                    animation: fadeIn 0.2s ease-out;
                }
                @keyframes fadeIn {
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
