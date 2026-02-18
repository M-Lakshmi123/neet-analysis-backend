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
                const queryParams = buildQueryParams(filters).toString();
                const res = await fetch(`${API_URL}/api/studentsByCampus?${queryParams}`);
                const data = await res.json();
                setStudents(data || []);

                // Automatically select first student if none selected
                if (data && data.length > 0 && !selectedStudent) {
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
                const res = await fetch(`${API_URL}/api/history?id=${selectedStudent.id}`);
                const data = await res.json();
                setPerformanceData(data || []);
            } catch (error) {
                console.error("Failed to fetch performance data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchPerformance();
    }, [selectedStudent]);

    const filteredStudents = useMemo(() => {
        if (!searchTerm) return students;
        const term = searchTerm.toLowerCase();
        return students.filter(s =>
            s.name.toLowerCase().includes(term) ||
            s.id.toString().toLowerCase().includes(term)
        );
    }, [students, searchTerm]);

    const createChartData = (label, dataKey, color) => {
        // We only want to show tests that have data for this key
        const validData = performanceData.filter(d => d[dataKey] !== null && d[dataKey] !== undefined);

        return {
            labels: validData.map(d => d.Test),
            datasets: [
                {
                    label: label,
                    data: validData.map(d => Number(d[dataKey])),
                    backgroundColor: color,
                    borderRadius: 8,
                    borderSkipped: false,
                    barThickness: 30,
                    datalabels: {
                        color: '#000',
                        anchor: 'center',
                        align: 'center',
                        font: { weight: 'bold', size: 14 },
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
                color: '#000',
                font: { size: 16, weight: 'bold' },
                padding: { bottom: 10 }
            },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#000',
                bodyColor: '#000',
                borderColor: '#ddd',
                borderWidth: 1,
                padding: 10,
                displayColors: false
            },
            datalabels: {
                display: true
            }
        },
        scales: {
            x: {
                display: false, // Hide X axis as labels are inside bars
                grid: { display: false }
            },
            y: {
                grid: { display: false },
                ticks: {
                    color: '#444',
                    font: { weight: 'bold', size: 12 }
                }
            }
        },
        layout: {
            padding: { left: 10, right: 40 } // Space for labels
        }
    });

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
                            placeholder="Search student..."
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
                            <div className="no-students">No students found</div>
                        )}
                    </div>
                </div>

                {/* Right Content: Graphs */}
                <div className="graphs-content">
                    {selectedStudent ? (
                        <>
                            <div className="student-info-header-glass">
                                <div className="user-icon-circle">
                                    <User size={24} />
                                </div>
                                <div className="student-details">
                                    <h2>{selectedStudent.name}</h2>
                                    <p>ID: {selectedStudent.id} | Campus: {selectedStudent.campus} | Stream: {selectedStudent.stream}</p>
                                </div>
                            </div>

                            <div className="graphs-grid">
                                <div className="graph-card-glass wide">
                                    <Bar
                                        data={createChartData('Total Marks', 'Tot_720', '#4ade80')}
                                        options={chartOptions('Total Marks')}
                                    />
                                </div>
                                <div className="graph-card-glass wide">
                                    <Bar
                                        data={createChartData('Botany', 'Botany', '#f472b6')}
                                        options={chartOptions('Botany')}
                                    />
                                </div>
                                <div className="graph-card-glass">
                                    <Bar
                                        data={createChartData('Zoology', 'Zoology', '#fb923c')}
                                        options={chartOptions('Zoology')}
                                    />
                                </div>
                                <div className="graph-card-glass">
                                    <Bar
                                        data={createChartData('Physics', 'Physics', '#60a5fa')}
                                        options={chartOptions('Physics')}
                                    />
                                </div>
                                <div className="graph-card-glass">
                                    <Bar
                                        data={createChartData('Chemistry', 'Chemistry', '#94a3b8')}
                                        options={chartOptions('Chemistry')}
                                    />
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="select-student-prompt">
                            <div className="prompt-icon">👈</div>
                            <h3>Please select a student from the list</h3>
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
                    font-size: 1.8rem;
                    color: #0f172a;
                    font-weight: 900;
                    letter-spacing: -0.5px;
                }

                .student-details p {
                    margin: 4px 0 0;
                    color: #64748b;
                    font-size: 1rem;
                    font-weight: 600;
                }

                .graphs-grid {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 25px;
                    padding-bottom: 20px;
                }

                .graph-card-glass {
                    background: rgba(255, 255, 255, 0.4);
                    backdrop-filter: blur(15px);
                    border-radius: 24px;
                    padding: 25px;
                    border: 2px solid rgba(255, 255, 255, 0.5);
                    box-shadow: 0 15px 45px rgba(0, 0, 0, 0.07);
                    height: 320px;
                    transition: all 0.4s ease;
                    grid-column: span 2;
                    position: relative;
                }

                .graph-card-glass:hover {
                    transform: translateY(-8px) scale(1.01);
                    box-shadow: 0 25px 55px rgba(0, 0, 0, 0.12);
                    background: rgba(255, 255, 255, 0.55);
                    border-color: rgba(255, 255, 255, 0.8);
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
