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

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ChartDataLabels
);

const TargetVsAchieved = ({ filters }) => {
    const [allTargets, setAllTargets] = useState([]);
    const [studentResults, setStudentResults] = useState([]);
    const [examStats, setExamStats] = useState([]);
    const [loading, setLoading] = useState(true);
    // Default to first threshold to show something in the chart/table
    const [selectedThreshold, setSelectedThreshold] = useState('>= 710');

    const thresholds = [
        { label: '>= 710', key: '>= 710M', statsKey: 'T_710', value: 710 },
        { label: '>= 700', key: '>= 700M', statsKey: 'T_700', value: 700 },
        { label: '>= 685', key: '>= 685M', statsKey: 'T_685', value: 685 },
        { label: '>= 655', key: '>= 655M', statsKey: 'T_655', value: 655 },
        { label: '>= 640', key: '>= 640M', statsKey: 'T_640', value: 640 },
        { label: '>= 595', key: '>= 595M', statsKey: 'T_595', value: 595 },
        { label: '>= 570', key: '>= 570M', statsKey: 'T_570', value: 570 },
        { label: '>= 550', key: '>= 550M', statsKey: 'T_550', value: 550 },
        { label: '>= 530', key: '>= 530M', statsKey: 'T_530', value: 530 },
        { label: '>= 490', key: '>= 490M', statsKey: 'T_490', value: 490 },
        { label: '>= 450', key: '>= 450M', statsKey: 'T_450', value: 450 },
        { label: '>= 400', key: '>= 400M', statsKey: 'T_400', value: 400 },
        { label: '>= 300', key: '>= 300M', statsKey: 'T_300', value: 300 },
        { label: '>= 200', key: '>= 200M', statsKey: 'T_200', value: 200 },
    ];

    useEffect(() => {
        const fetchTargets = async () => {
            try {
                const res = await fetch(`${API_URL}/api/targets`);
                const data = await res.json();
                setAllTargets(data);
            } catch (error) {
                console.error("Failed to fetch targets:", error);
            }
        };
        fetchTargets();
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const queryParams = buildQueryParams(filters).toString();
                const marksPromise = fetch(`${API_URL}/api/analysis-report?${queryParams}`).then(r => r.json());
                const statsPromise = fetch(`${API_URL}/api/exam-stats?${queryParams}`).then(r => r.json());
                const [marksData, statsData] = await Promise.all([marksPromise, statsPromise]);
                setStudentResults(marksData.students || []);
                setExamStats(statsData || []);
            } catch (error) {
                console.error("Failed to fetch performance data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [filters]);

    // Mapping Logic for Stream
    const aggregatedTarget = useMemo(() => {
        if (!allTargets.length) return {};
        let filtered = allTargets;

        // Filter by Campus
        if (filters.campus && filters.campus.length > 0 && !filters.campus.includes('All')) {
            filtered = filtered.filter(t =>
                filters.campus.some(c => t.NAME_OF_THE_CAMPUS.trim().toUpperCase() === c.trim().toUpperCase())
            );
        }

        // Filter by Stream with SR ELITE mapping
        if (filters.stream && filters.stream.length > 0 && !filters.stream.includes('All')) {
            const mappedStreams = filters.stream.map(s => {
                const up = s.trim().toUpperCase();
                if (up === 'SR_ELITE_SET_01' || up === 'SR_ELITE_SET_02' || up === 'SR ELITE') return 'SR ELITE';
                return up;
            });

            filtered = filtered.filter(t =>
                mappedStreams.includes(t.Stream.trim().toUpperCase())
            );
        }

        const result = {};
        thresholds.forEach(th => {
            result[th.key] = filtered.reduce((sum, row) => sum + (Number(row[th.key]) || 0), 0);
        });
        return result;
    }, [allTargets, filters, thresholds]);

    // Achieved Counts (Average per Exam)
    const achievedCounts = useMemo(() => {
        if (!examStats.length) return {};
        const totalExams = examStats.length;
        const counts = {};
        thresholds.forEach(th => {
            const sumOfCounts = examStats.reduce((acc, curr) => acc + (Number(curr[th.statsKey]) || 0), 0);
            counts[th.key] = Math.round((sumOfCounts / totalExams) * 10) / 10;
        });
        return counts;
    }, [examStats, thresholds]);

    // Detail Students
    const detailStudents = useMemo(() => {
        const thresholdValue = thresholds.find(t => t.label === selectedThreshold)?.value || 0;
        return studentResults
            .filter(s => Number(s.tot) >= thresholdValue)
            .sort((a, b) => b.tot - a.tot);
    }, [studentResults, selectedThreshold]);

    // Bar Chart Data (Comparison for Selected Threshold)
    const selectedThInfo = thresholds.find(t => t.label === selectedThreshold);
    const chartData = {
        labels: [selectedThreshold + ' Threshold Comparison'],
        datasets: [
            {
                label: 'Target',
                data: [aggregatedTarget[selectedThInfo?.key] || 0],
                backgroundColor: '#1e40af', // Deep Blue
                borderRadius: 8,
                barThickness: 60,
                datalabels: { color: 'white', font: { weight: 'bold' } }
            },
            {
                label: 'Achieved',
                data: [achievedCounts[selectedThInfo?.key] || 0],
                backgroundColor: (aggregatedTarget[selectedThInfo?.key] || 0) <= (achievedCounts[selectedThInfo?.key] || 0) ? '#16a34a' : '#dc2626', // Solid Green or Red
                borderRadius: 8,
                barThickness: 60,
                datalabels: { color: 'white', font: { weight: 'bold' } }
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { font: { weight: 'bold' } } },
            datalabels: { anchor: 'center', align: 'center', formatter: (v) => v }
        },
        scales: {
            y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
            x: { grid: { display: false } }
        }
    };

    return (
        <div className="target-vs-achieved-page">
            <LoadingTimer isLoading={loading} />

            {/* FULL WIDTH TARGETS TABLE */}
            <div className="full-width-section">
                <div className="section-label">TARGET DEFINITIONS (ALL STREAMS)</div>
                <div className="stats-grid-container targets-grid">
                    {thresholds.map(th => (
                        <div key={th.label} className="grid-cell">
                            <div className="cell-header">{th.label}</div>
                            <div className="cell-value">{aggregatedTarget[th.key] || '--'}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* FULL WIDTH ACHIEVED TABLE */}
            <div className="full-width-section">
                <div className="section-label">AVERAGE ACHIEVEMENT (PER EXAM)</div>
                <div className="stats-grid-container achieved-grid">
                    {thresholds.map(th => {
                        const target = aggregatedTarget[th.key] || 0;
                        const achieved = achievedCounts[th.key] || 0;
                        const isMatch = achieved >= target;
                        const isSelected = selectedThreshold === th.label;
                        return (
                            <div
                                key={th.label}
                                className={`grid-cell interactive-cell ${isMatch ? 'match-green' : 'match-red'} ${isSelected ? 'selected' : ''}`}
                                onClick={() => setSelectedThreshold(th.label)}
                            >
                                <div className="cell-header">{th.label}</div>
                                <div className="cell-value">{achieved || '--'}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* BOTTOM SPLIT: CHART & STUDENT DATA */}
            <div className="bottom-split-container">
                {/* Left: Comparison Chart */}
                <div className="split-card left-chart">
                    <div className="card-header-simple">Threshold Comparison: {selectedThreshold}</div>
                    <div className="chart-wrapper">
                        <Bar data={chartData} options={chartOptions} />
                    </div>
                </div>

                {/* Right: Student Data */}
                <div className="split-card right-table">
                    <div className="card-header-simple">
                        Students Meeting {selectedThreshold} ({detailStudents.length})
                    </div>
                    <div className="table-inner-wrap">
                        <table className="neat-table">
                            <thead>
                                <tr>
                                    <th>NAME</th>
                                    <th>CAMPUS</th>
                                    <th className="text-center">TOT</th>
                                    <th className="text-center">AIR</th>
                                    <th className="text-center">BOT</th>
                                    <th className="text-center">ZOO</th>
                                    <th className="text-center">PHY</th>
                                    <th className="text-center">CHE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detailStudents.length === 0 ? (
                                    <tr><td colSpan="8" className="text-center py-8 text-slate-400">No students found matching this criteria</td></tr>
                                ) : (
                                    detailStudents.map((s, idx) => (
                                        <tr key={s.STUD_ID || idx}>
                                            <td className="font-bold">{s.name}</td>
                                            <td className="text-sm opacity-70">{s.campus}</td>
                                            <td className="text-center font-bold text-blue-700">{Number(s.tot).toFixed(1)}</td>
                                            <td className="text-center">{Math.round(s.air) || '-'}</td>
                                            <td className="text-center">{Number(s.bot || 0).toFixed(0)}</td>
                                            <td className="text-center">{Number(s.zoo || 0).toFixed(0)}</td>
                                            <td className="text-center">{Number(s.phy || 0).toFixed(0)}</td>
                                            <td className="text-center">{Number(s.che || 0).toFixed(0)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .target-vs-achieved-page {
                    padding: 24px;
                    background: #f8fafc;
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }
                .full-width-section {
                    background: white;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .section-label {
                    background: #1e293b;
                    color: white;
                    padding: 8px 16px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    letter-spacing: 0.05em;
                }
                .stats-grid-container {
                    display: grid;
                    grid-template-columns: repeat(14, 1fr);
                    border-top: 1px solid #e2e8f0;
                }
                .grid-cell {
                    padding: 16px 8px;
                    text-align: center;
                    border-right: 1px solid #f1f5f9;
                    background: white;
                }
                .grid-cell:last-child { border-right: none; }
                .cell-header {
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: black !important; /* Force black */
                    margin-bottom: 8px;
                }
                .cell-value {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: black !important; /* Force black */
                }
                
                /* Achieved Grid Highlights */
                .match-green { background: #dcfce7 !important; } /* Soft Green */
                .match-red { background: #fee2e2 !important; } /* Soft Red */
                .interactive-cell { cursor: pointer; transition: 0.2s; }
                .interactive-cell:hover { filter: brightness(0.95); }
                .interactive-cell.selected { 
                    box-shadow: inset 0 0 0 3px #1e40af; 
                    z-index: 5;
                }

                .bottom-split-container {
                    display: grid;
                    grid-template-columns: 1fr 1.5fr;
                    gap: 24px;
                    min-height: 500px;
                }
                .split-card {
                    background: white;
                    border-radius: 12px;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                }
                .card-header-simple {
                    padding: 12px 20px;
                    font-weight: 800;
                    font-size: 1rem;
                    color: #1e293b;
                    border-bottom: 1px solid #e2e8f0;
                }
                .chart-wrapper {
                    flex: 1;
                    padding: 24px;
                    position: relative;
                }
                .table-inner-wrap {
                    flex: 1;
                    overflow-y: auto;
                    max-height: 500px;
                }
                .neat-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .neat-table th {
                    background: #f8fafc;
                    padding: 12px;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #64748b;
                    text-align: left;
                    position: sticky;
                    top: 0;
                    border-bottom: 1px solid #e2e8f0;
                }
                .neat-table td {
                    padding: 12px;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 0.85rem;
                    color: black;
                }
                .neat-table tr:hover { background: #f8fafc; }
            `}</style>
        </div>
    );
};

export default TargetVsAchieved;
