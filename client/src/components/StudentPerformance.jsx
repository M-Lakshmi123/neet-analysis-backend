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
    const [searchTerm, setSearchTerm] = useState('');

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
                        // If not in current list, we fetch specifically if we have a search
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

    // Fetch performance data when selected student changes
    useEffect(() => {
        if (!selectedStudent) return;

        const fetchPerformance = async () => {
            setLoading(true);
            try {
                // Fetch ALL history for this student, ignore other filters for individual progress 
                // UNLESS the user wants to see their performance in specific tests.
                // Let's use test filters if they exists.
                const testParams = new URLSearchParams();
                testParams.append('id', selectedStudent.id);

                if (filters.test && filters.test.length > 0 && !filters.test.includes('__ALL__')) {
                    filters.test.forEach(t => testParams.append('test', t));
                }

                const res = await fetch(`${API_URL}/api/history?${testParams.toString()}`);
                const data = await res.json();
                setPerformanceData(data || []);
            } catch (error) {
                console.error("Failed to fetch performance data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPerformance();
    }, [selectedStudent, filters.test]);

    const filteredStudents = useMemo(() => {
        if (!searchTerm) return students;
        const term = searchTerm.toLowerCase();
        return students.filter(s =>
            (s.name && s.name.toLowerCase().includes(term)) ||
            (s.id && s.id.toString().toLowerCase().includes(term))
        );
    }, [students, searchTerm]);

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
        return Math.max(320, count * 45); // At least 45px per bar
    };

    return (
        <div className="performance-report-container">
            <LoadingTimer isLoading={loading || listLoading} />

            <div className="performance-layout">
                {/* Left Sidebar: Student List */}
                <div className="student-sidebar-glass">
                    <div className="search-container-glass">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Local search in this list..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="student-list-scroll">
                        {filteredStudents.map(student => (
                            <button
                                key={student.id}
                                className={`student-btn-glass ${selectedStudent?.id === student.id ? 'active' : ''}`}
                                onClick={() => setSelectedStudent(student)}
                            >
                                <div className="btn-indicator" />
                                <span className="student-name">{student.name}</span>
                            </button>
                        ))}
                        {filteredStudents.length === 0 && !listLoading && (
                            <div className="no-students">
                                <p>No matching students in current view.</p>
                                <p style={{ fontSize: '0.75rem', marginTop: '5px', opacity: 0.7 }}>Tip: Use the global search bar at the top for a site-wide search.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Content: Graphs */}
                <div className="graphs-content">
                    {selectedStudent ? (
                        <>
                            <div className="student-info-header-glass">
                                <div className="user-icon-circle">
                                    <User size={28} />
                                </div>
                                <div className="student-details">
                                    <h2>{selectedStudent.name}</h2>
                                    <div className="details-badges">
                                        <span className="badge-glass">ID: {selectedStudent.id}</span>
                                        <span className="badge-glass">CAMPUS: {selectedStudent.campus}</span>
                                        {selectedStudent.stream && <span className="badge-glass">STREAM: {selectedStudent.stream}</span>}
                                    </div>
                                </div>
                            </div>

                            <div className="graphs-grid">
                                <div className="graph-card-glass wide">
                                    <div style={{ height: getChartHeight(), minHeight: '100%' }}>
                                        <Bar
                                            data={createChartData('Total Marks(720)', 'Tot_720', '#4ade80')}
                                            options={chartOptions('Total Marks (720)')}
                                        />
                                    </div>
                                </div>
                                <div className="graph-card-glass wide">
                                    <div style={{ height: getChartHeight(), minHeight: '100%' }}>
                                        <Bar
                                            data={createChartData('Botany (180)', 'Botany', '#f472b6')}
                                            options={chartOptions('Botany (180)')}
                                        />
                                    </div>
                                </div>
                                <div className="graph-card-glass">
                                    <div style={{ height: getChartHeight(), minHeight: '100%' }}>
                                        <Bar
                                            data={createChartData('Zoology (180)', 'Zoology', '#fb923c')}
                                            options={chartOptions('Zoology (180)')}
                                        />
                                    </div>
                                </div>
                                <div className="graph-card-glass">
                                    <div style={{ height: getChartHeight(), minHeight: '100%' }}>
                                        <Bar
                                            data={createChartData('Physics (180)', 'Physics', '#60a5fa')}
                                            options={chartOptions('Physics (180)')}
                                        />
                                    </div>
                                </div>
                                <div className="graph-card-glass">
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
                            <h3>Please select a student to view analysis</h3>
                            <p>You can search for any student using the top search bar.</p>
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .performance-report-container {
                    padding: 20px;
                    height: calc(100vh - 160px);
                    background: transparent;
                }

                .performance-layout {
                    display: flex;
                    gap: 25px;
                    height: 100%;
                }

                /* Student Sidebar Glass Effect */
                .student-sidebar-glass {
                    width: 300px;
                    background: rgba(255, 255, 255, 0.25);
                    backdrop-filter: blur(15px);
                    border: 2px solid rgba(255, 255, 255, 0.4);
                    border-radius: 24px;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 15px 35px 0 rgba(0, 0, 0, 0.1);
                    overflow: hidden;
                    height: 100%;
                    transition: all 0.3s ease;
                }

                .search-container-glass {
                    padding: 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: rgba(255, 255, 255, 0.4);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                }

                .search-container-glass input {
                    flex: 1;
                    background: transparent;
                    border: none;
                    outline: none;
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #1e293b;
                }

                .search-container-glass input::placeholder {
                    color: #94a3b8;
                }

                .search-icon { color: #800040; }

                .student-list-scroll {
                    flex: 1;
                    overflow-y: auto;
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
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
                    border: 1px solid rgba(255, 255, 255, 0.7);
                    padding: 14px 18px;
                    border-radius: 16px;
                    text-align: left;
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    position: relative;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
                }

                .student-btn-glass:hover {
                    background: rgba(255, 255, 255, 0.8);
                    transform: translateX(8px) scale(1.02);
                    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.05);
                }

                .student-btn-glass.active {
                    background: linear-gradient(135deg, #800040, #600030);
                    color: white;
                    border-color: #800040;
                    box-shadow: 0 10px 25px rgba(128, 0, 64, 0.4);
                    transform: translateX(10px) scale(1.03);
                }

                .btn-indicator {
                    width: 5px;
                    height: 0;
                    background: #fbbf24;
                    border-radius: 3px;
                    transition: height 0.4s ease;
                    box-shadow: 0 0 10px rgba(251, 191, 36, 0.5);
                }

                .student-btn-glass.active .btn-indicator {
                    height: 25px;
                }

                .student-name {
                    font-weight: 700;
                    font-size: 0.95rem;
                    text-transform: uppercase;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    letter-spacing: 0.3px;
                }

                /* Graphs Content */
                .graphs-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 25px;
                    overflow-y: auto;
                    padding-right: 10px;
                }

                .student-info-header-glass {
                    background: rgba(255, 255, 255, 0.3);
                    backdrop-filter: blur(15px);
                    padding: 20px 30px;
                    border-radius: 24px;
                    border: 2px solid rgba(255, 255, 255, 0.4);
                    display: flex;
                    align-items: center;
                    gap: 25px;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.05);
                }

                .user-icon-circle {
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #800040, #b91c1c);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 8px 16px rgba(128, 0, 64, 0.2);
                    border: 3px solid white;
                }

                .student-details h2 {
                    margin: 0;
                    font-size: 2.2rem;
                    color: #0f172a;
                    font-weight: 900;
                    letter-spacing: -1px;
                }

                .details-badges {
                    display: flex;
                    gap: 10px;
                    margin-top: 8px;
                    flex-wrap: wrap;
                }

                .badge-glass {
                    background: rgba(128, 0, 64, 0.1);
                    color: #800040;
                    padding: 5px 12px;
                    border-radius: 10px;
                    font-size: 0.8rem;
                    font-weight: 800;
                    border: 1px solid rgba(128, 0, 64, 0.2);
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .graphs-grid {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 25px;
                    padding-bottom: 30px;
                }

                .graph-card-glass {
                    background: rgba(255, 255, 255, 0.5);
                    backdrop-filter: blur(20px);
                    border-radius: 28px;
                    padding: 25px;
                    border: 2px solid rgba(255, 255, 255, 0.6);
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.08);
                    height: 450px; /* Base height */
                    overflow-y: auto; /* Allow scrolling for many tests */
                    transition: all 0.4s ease;
                    grid-column: span 2;
                    position: relative;
                }

                .graph-card-glass::-webkit-scrollbar {
                    width: 6px;
                }
                .graph-card-glass::-webkit-scrollbar-thumb {
                    background: rgba(0, 0, 0, 0.1);
                    border-radius: 10px;
                }

                .graph-card-glass:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.12);
                    background: rgba(255, 255, 255, 0.65);
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
                    border-radius: 24px;
                    border: 2px dashed rgba(255, 255, 255, 0.4);
                }

                .prompt-icon {
                    font-size: 4rem;
                    margin-bottom: 15px;
                    filter: drop-shadow(0 10px 10px rgba(0,0,0,0.1));
                }

                .select-student-prompt h3 {
                    margin: 0;
                    font-weight: 800;
                    font-size: 1.5rem;
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
