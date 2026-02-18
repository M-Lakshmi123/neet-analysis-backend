import React, { useState, useEffect, useMemo } from 'react';
import { API_URL, buildQueryParams } from '../utils/apiHelper';
import LoadingTimer from './LoadingTimer';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Search, User } from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ChartDataLabels
);

const StudentPerformance = ({ filters }) => {
    const [students, setStudents] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [performanceData, setPerformanceData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [listLoading, setListLoading] = useState(false);

    // Fetch student list based on filters
    useEffect(() => {
        const fetchStudentList = async () => {
            setListLoading(true);
            try {
                // If global filters have a studentSearch value, we should fetch that specific student 
                // but keep the list logic working too.
                const queryParams = buildQueryParams(filters).toString();
                const res = await fetch(`${API_URL}/api/studentsByCampus?${queryParams}`);
                const data = await res.json();
                setStudents(data || []);

                // SYNC selected student with global filters SELECT
                if (filters.studentSearch && filters.studentSearch.length > 0) {
                    const searchedId = filters.studentSearch[0].toString();
                    const foundInLocal = data.find(s => s.id.toString() === searchedId);
                    if (foundInLocal) {
                        setSelectedStudent(foundInLocal);
                    } else {
                        // If not in current list (limit reached or filters), fetch specifically
                        const fetchSpec = async () => {
                            try {
                                const sRes = await fetch(`${API_URL}/api/history?id=${searchedId}`);
                                const sData = await sRes.json();
                                if (sData && sData.length > 0) {
                                    const first = sData[0];
                                    setSelectedStudent({
                                        id: first.STUD_ID,
                                        name: first.NAME_OF_THE_STUDENT,
                                        campus: first.CAMPUS_NAME,
                                        stream: first.Stream || ''
                                    });
                                }
                            } catch (e) { console.error("Spec fetch error:", e); }
                        };
                        fetchSpec();
                    }
                } else if (data && data.length > 0 && !selectedStudent) {
                    setSelectedStudent(data[0]);
                }
            } catch (error) {
                console.error("Failed to fetch student list:", error);
            } finally {
                setListLoading(false);
            }
        };
        fetchStudentList();
    }, [filters]);

    // Fetch performance data when selected student changes OR filters change
    useEffect(() => {
        if (!selectedStudent) return;

        const fetchPerformance = async () => {
            setLoading(true);
            try {
                // Combine student ID with global filters (Test Type, Test selection, etc.)
                // This ensures if user selects GT, we only show GT.
                const perfFilters = { ...filters };
                perfFilters.studentSearch = [selectedStudent.id];
                // Remove campus/stream/etc if we want pure student history, 
                // but the user specifically asked why WT shows when GT is selected.
                // So we MUST respect the test and testType filters.

                const queryParams = buildQueryParams(perfFilters).toString();
                const res = await fetch(`${API_URL}/api/history?${queryParams}`);
                const data = await res.json();
                setPerformanceData(data || []);
            } catch (error) {
                console.error("Failed to fetch performance data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPerformance();
    }, [selectedStudent, filters.test, filters.testType, filters.stream]);

    const createChartData = (label, dataKey, color) => {
        // Filter out zero or empty recordings to keep graph clean
        const validData = performanceData.filter(d => d[dataKey] !== null && d[dataKey] !== undefined && d[dataKey] !== '');

        return {
            labels: validData.map(d => d.Test),
            datasets: [
                {
                    label: label,
                    data: validData.map(d => Number(d[dataKey])),
                    backgroundColor: color,
                    borderRadius: 12,
                    borderSkipped: false,
                    barThickness: 'flex',
                    maxBarThickness: 45,
                    datalabels: {
                        color: '#000',
                        anchor: 'center',
                        align: 'center',
                        font: { weight: '900', size: 13 },
                        formatter: (value) => Math.round(value)
                    }
                }
            ]
        };
    };

    const chartOptions = (title) => ({
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: title,
                color: '#1e293b',
                font: { size: 18, weight: '900', family: 'Inter' },
                padding: { bottom: 20 }
            },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#000',
                bodyColor: '#000',
                borderColor: '#1e293b',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                titleFont: { weight: 'bold' }
            },
            datalabels: {
                display: true
            }
        },
        scales: {
            x: {
                display: false,
                grid: { display: false }
            },
            y: {
                grid: { display: false },
                ticks: {
                    color: '#1e293b',
                    font: { weight: '800', size: 11 },
                    autoSkip: false
                }
            }
        },
        layout: {
            padding: { left: 5, right: 35 }
        }
    });

    // Helper to calculate required height for the graph based on number of tests
    const getChartHeight = () => {
        const count = performanceData.length || 0;
        return Math.max(250, count * 35); // Reduced from 55px to 35px for compact view
    };

    return (
        <div className="performance-report-container compact">
            <LoadingTimer isLoading={loading || listLoading} />

            <div className="performance-layout">
                {/* Left Sidebar: Student List */}
                <div className="student-sidebar-glass compact">
                    <div className="sidebar-header-glass">
                        Student List
                    </div>

                    <div className="student-list-scroll">
                        {students.map(student => (
                            <button
                                key={student.id}
                                className={`student-btn-glass compact ${selectedStudent?.id === student.id ? 'active' : ''}`}
                                onClick={() => setSelectedStudent(student)}
                            >
                                <div className="btn-indicator" />
                                <span className="student-name">{student.name}</span>
                            </button>
                        ))}
                        {students.length === 0 && !listLoading && (
                            <div className="no-students">
                                <p>No matching students.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Content: Graphs */}
                <div className="graphs-content compact">
                    {selectedStudent ? (
                        <>
                            <div className="student-info-header-glass compact">
                                <div className="user-icon-circle compact">
                                    <User size={20} />
                                </div>
                                <div className="student-details">
                                    <h2>{selectedStudent.name}</h2>
                                    <div className="details-badges">
                                        <span className="badge-glass">ID: {selectedStudent.id}</span>
                                        <span className="badge-glass">{selectedStudent.campus}</span>
                                        {selectedStudent.stream && <span className="badge-glass">{selectedStudent.stream}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="graphs-grid compact">
                                <div className="graph-card-glass wide compact">
                                    <div style={{ height: getChartHeight(), minHeight: '100%' }}>
                                        <Bar
                                            data={createChartData('Total Marks(720)', 'Tot_720', '#4ade80')}
                                            options={chartOptions('Total Marks (720)')}
                                        />
                                    </div>
                                </div>
                                <div className="graph-card-glass wide compact">
                                    <div style={{ height: getChartHeight(), minHeight: '100%' }}>
                                        <Bar
                                            data={createChartData('Botany (180)', 'Botany', '#f472b6')}
                                            options={chartOptions('Botany (180)')}
                                        />
                                    </div>
                                </div>
                                <div className="graph-card-glass compact">
                                    <div style={{ height: getChartHeight(), minHeight: '100%' }}>
                                        <Bar
                                            data={createChartData('Zoology (180)', 'Zoology', '#fb923c')}
                                            options={chartOptions('Zoology (180)')}
                                        />
                                    </div>
                                </div>
                                <div className="graph-card-glass compact">
                                    <div style={{ height: getChartHeight(), minHeight: '100%' }}>
                                        <Bar
                                            data={createChartData('Physics (180)', 'Physics', '#60a5fa')}
                                            options={chartOptions('Physics (180)')}
                                        />
                                    </div>
                                </div>
                                <div className="graph-card-glass compact">
                                    <div style={{ height: getChartHeight(), minHeight: '100%' }}>
                                        <Bar
                                            data={createChartData('Chemistry (180)', 'Chemistry', '#94a3b8')}
                                            options={chartOptions('Chemistry (180)')}
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="select-student-prompt">
                            <div className="prompt-icon">👈</div>
                            <h3>Please select a student</h3>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .performance-report-container {
                    padding: 10px 15px;
                    height: calc(100vh - 180px); /* Adjusted for FilterBar Height */
                    background: transparent;
                    transition: all 0.3s ease;
                }

                .performance-layout {
                    display: flex;
                    gap: 15px;
                    height: 100%;
                }

                /* Student List Sidebar */
                .student-sidebar-glass {
                    width: 240px;
                    background: rgba(255, 255, 255, 0.4);
                    backdrop-filter: blur(15px);
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    border-radius: 16px;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05);
                    overflow: hidden;
                    height: 100%;
                }

                .sidebar-header-glass {
                    padding: 12px 15px;
                    background: rgba(128, 0, 64, 0.1);
                    color: #800040;
                    font-weight: 900;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    border-bottom: 1px solid rgba(128, 0, 64, 0.1);
                }

                .student-list-scroll {
                    flex: 1;
                    overflow-y: auto;
                    padding: 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .student-list-scroll::-webkit-scrollbar {
                    width: 5px;
                }
                .student-list-scroll::-webkit-scrollbar-thumb {
                    background: rgba(128, 0, 64, 0.2);
                    border-radius: 10px;
                }

                .student-btn-glass {
                    background: rgba(255, 255, 255, 0.5);
                    border: 1px solid rgba(255, 255, 255, 0.8);
                    padding: 8px 12px;
                    border-radius: 10px;
                    text-align: left;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    position: relative;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
                }

                .student-btn-glass:hover {
                    background: rgba(255, 255, 255, 0.9);
                    transform: translateX(3px);
                    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.03);
                }

                .student-btn-glass.active {
                    background: #800040;
                    color: white;
                    border-color: #800040;
                    box-shadow: 0 4px 12px rgba(128, 0, 64, 0.3);
                    transform: translateX(5px);
                }

                .btn-indicator {
                    width: 3px;
                    height: 0;
                    background: #fbbf24;
                    border-radius: 2px;
                    transition: height 0.3s ease;
                    box-shadow: 0 0 8px rgba(251, 191, 36, 0.4);
                }

                .student-btn-glass.active .btn-indicator {
                    height: 15px;
                }

                .student-name {
                    font-weight: 700;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    letter-spacing: 0.2px;
                }

                /* Graphs Content */
                .graphs-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                    overflow-y: auto;
                    padding-right: 5px;
                }

                .graphs-content::-webkit-scrollbar {
                    width: 5px;
                }
                .graphs-content::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                }

                .student-info-header-glass {
                    background: rgba(255, 255, 255, 0.5);
                    backdrop-filter: blur(15px);
                    padding: 12px 20px;
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.8);
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
                }

                .user-icon-circle {
                    width: 40px;
                    height: 40px;
                    background: linear-gradient(135deg, #800040, #b91c1c);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 8px rgba(128, 0, 64, 0.1);
                    border: 2px solid white;
                }

                .student-details h2 {
                    margin: 0;
                    font-size: 1.3rem;
                    color: #1e293b;
                    font-weight: 800;
                    letter-spacing: -0.5px;
                }

                .details-badges {
                    display: flex;
                    gap: 8px;
                    margin-top: 4px;
                    flex-wrap: wrap;
                }

                .badge-glass {
                    background: rgba(128, 0, 64, 0.08);
                    color: #800040;
                    padding: 2px 8px;
                    border-radius: 6px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    border: 1px solid rgba(128, 0, 64, 0.15);
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }

                .graphs-grid {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 15px;
                    padding-bottom: 10px;
                }

                .graph-card-glass {
                    background: rgba(255, 255, 255, 0.6);
                    backdrop-filter: blur(10px);
                    border-radius: 16px;
                    padding: 15px;
                    border: 1px solid rgba(255, 255, 255, 0.9);
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.03);
                    height: 280px; /* Base height */
                    overflow-y: auto; /* Allow scrolling for many tests */
                    transition: all 0.3s ease;
                    grid-column: span 2;
                    position: relative;
                }

                .graph-card-glass::-webkit-scrollbar {
                    width: 4px;
                }
                .graph-card-glass::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 5px;
                }

                .graph-card-glass:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.06);
                    background: rgba(255, 255, 255, 0.75);
                }

                .graph-card-glass.wide {
                    grid-column: span 3;
                }

                .no-students, .select-student-prompt {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: #64748b;
                    text-align: center;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    border: 1px dashed rgba(255, 255, 255, 0.4);
                }

                .prompt-icon {
                    font-size: 3rem;
                    margin-bottom: 10px;
                    filter: drop-shadow(0 5px 5px rgba(0,0,0,0.05));
                }

                .select-student-prompt h3 {
                    margin: 0;
                    font-weight: 700;
                    font-size: 1.2rem;
                    color: #1e293b;
                }

                @media (max-width: 1200px) {
                    .graphs-grid {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    .graph-card-glass.wide, .graph-card-glass {
                        grid-column: span 2;
                    }
                }
            `}</style>
        </div>
    );
};

export default StudentPerformance;
