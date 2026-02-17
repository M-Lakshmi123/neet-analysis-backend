import React, { useState, useEffect, useMemo } from 'react';
import { API_URL, buildQueryParams } from '../utils/apiHelper';
import LoadingTimer from './LoadingTimer';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
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
    Filler,
    ChartDataLabels
);

const TargetVsAchieved = ({ filters }) => {
    const [allTargets, setAllTargets] = useState([]);
    const [studentResults, setStudentResults] = useState([]);
    const [examStats, setExamStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedThreshold, setSelectedThreshold] = useState(null);

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

    // Fetch Target Definitions once
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

    // Fetch Data based on filters
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const queryParams = buildQueryParams(filters).toString();

                // 1. Fetch Student Merit List (Averages) for detail table
                const marksPromise = fetch(`${API_URL}/api/analysis-report?${queryParams}`).then(r => r.json());

                // 2. Fetch Exam Stats (for average count per exam)
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

    // Compute Filtered Targets
    const aggregatedTarget = useMemo(() => {
        if (!allTargets.length) return {};

        let filtered = allTargets;

        // Filter by Campus
        if (filters.campus && filters.campus.length > 0 && !filters.campus.includes('All')) {
            filtered = filtered.filter(t =>
                filters.campus.some(c => t.NAME_OF_THE_CAMPUS.trim().toUpperCase() === c.trim().toUpperCase())
            );
        }

        // Filter by Stream
        if (filters.stream && filters.stream.length > 0 && !filters.stream.includes('All')) {
            filtered = filtered.filter(t =>
                filters.stream.some(s => t.Stream.trim().toUpperCase() === s.trim().toUpperCase())
            );
        }

        const result = {};
        thresholds.forEach(th => {
            result[th.key] = filtered.reduce((sum, row) => sum + (Number(row[th.key]) || 0), 0);
        });
        return result;
    }, [allTargets, filters, thresholds]);

    // Compute Achieved Counts (Average per Exam)
    const achievedCounts = useMemo(() => {
        if (!examStats.length) return {};
        const totalExams = examStats.length;
        const counts = {};
        thresholds.forEach(th => {
            const sumOfCounts = examStats.reduce((acc, curr) => acc + (Number(curr[th.statsKey]) || 0), 0);
            counts[th.key] = Math.round((sumOfCounts / totalExams) * 10) / 10; // 1 decimal place
        });
        return counts;
    }, [examStats, thresholds]);

    // Students for the selected threshold table (based on their average performance)
    const detailStudents = useMemo(() => {
        if (!selectedThreshold) return [];
        const thresholdValue = thresholds.find(t => t.label === selectedThreshold)?.value || 0;
        return studentResults
            .filter(s => Number(s.tot) >= thresholdValue)
            .sort((a, b) => b.tot - a.tot);
    }, [studentResults, selectedThreshold]);

    // Chart Data
    const chartData = {
        labels: thresholds.map(t => t.label),
        datasets: [
            {
                label: 'Target',
                data: thresholds.map(t => aggregatedTarget[t.key] || 0),
                borderColor: '#1e40af', // Darker Blue
                backgroundColor: 'rgba(30, 64, 175, 0.1)',
                borderWidth: 4,
                pointRadius: 5,
                pointHoverRadius: 8,
                tension: 0.3,
                fill: true,
                datalabels: { align: 'top', color: '#1e40af', font: { weight: 'bold', size: 11 } }
            },
            {
                label: 'Achieved',
                data: thresholds.map(t => achievedCounts[t.key] || 0),
                borderColor: '#059669', // Emerald Green
                backgroundColor: 'rgba(5, 150, 105, 0.1)',
                borderWidth: 4,
                pointRadius: 5,
                pointHoverRadius: 8,
                tension: 0.3,
                fill: true,
                datalabels: { align: 'bottom', color: '#047857', font: { weight: 'bold', size: 11 } }
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top',
                labels: { font: { size: 14, weight: 'bold' }, usePointStyle: true, boxWidth: 10 }
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                padding: 12,
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                titleColor: '#1e293b',
                bodyColor: '#475569',
                borderColor: '#cbd5e1',
                borderWidth: 1,
                titleFont: { size: 14, weight: 'bold' }
            },
            datalabels: {
                display: (context) => context.dataset.data[context.dataIndex] > 0
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0, 0, 0, 0.04)', drawBorder: false },
                title: { display: true, text: 'Number of Students', font: { weight: 'bold', size: 14 } }
            },
            x: {
                grid: { display: false },
                title: { display: true, text: 'Marks Threshold', font: { weight: 'bold', size: 14 } }
            }
        }
    };

    const getCompareColorClass = (target, achieved) => {
        if (!target && !achieved) return 'bg-slate-50';
        if (target === 0) return 'bg-emerald-600 text-white';
        return achieved >= target ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white';
    };

    return (
        <div className="premium-report-page">
            <LoadingTimer isLoading={loading} />

            <div className="report-main-grid">
                {/* Left Section: Visual Insights */}
                <div className="visualization-section">
                    <div className="glass-card chart-card-large">
                        <div className="card-header-premium">
                            <div className="header-icon-wrap bg-blue-100 text-blue-600">
                                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path></svg>
                            </div>
                            <div className="header-text">
                                <h3>Performance Gap Analysis</h3>
                                <p>Target vs Average Achievement across Exams</p>
                            </div>
                        </div>
                        <div className="chart-body">
                            <Line data={chartData} options={chartOptions} />
                        </div>
                    </div>
                </div>

                {/* Right Section: Data & Details */}
                <div className="data-section-column">
                    {/* Metrics Tables */}
                    <div className="metrics-group">
                        <div className="metrics-row targets-metric">
                            <div className="metric-label-sidebar bg-blue-900">TARGET</div>
                            <div className="metric-stats-grid">
                                {thresholds.map(th => (
                                    <div key={th.label} className="metric-cell">
                                        <span className="cell-label">{th.label}</span>
                                        <span className="cell-value">{aggregatedTarget[th.key] || '--'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="metrics-row achieved-metric">
                            <div className="metric-label-sidebar bg-slate-800">ACHIEVED</div>
                            <div className="metric-stats-grid">
                                {thresholds.map(th => {
                                    const targetVal = aggregatedTarget[th.key] || 0;
                                    const achievedVal = achievedCounts[th.key] || 0;
                                    const isSelected = selectedThreshold === th.label;
                                    return (
                                        <div
                                            key={th.label}
                                            className={`metric-cell interactive-cell ${getCompareColorClass(targetVal, achievedVal)} ${isSelected ? 'selected-cell' : ''}`}
                                            onClick={() => setSelectedThreshold(isSelected ? null : th.label)}
                                        >
                                            <span className="cell-label opacity-80">{th.label}</span>
                                            <span className="cell-value font-bold">{achievedVal || '--'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Student List (Filtered) */}
                    <div className={`detail-section-wrap ${selectedThreshold ? 'visible' : 'hidden'}`}>
                        <div className="glass-card detail-card">
                            <div className="detail-header bg-purple-900">
                                <div className="detail-title">
                                    <span className="highlight-tag bg-white/20">Threshold: {selectedThreshold}</span>
                                    <h3>Student Group Analysis</h3>
                                    <span className="count-badge">{detailStudents.length} Students</span>
                                </div>
                                <button className="close-btn" onClick={() => setSelectedThreshold(null)}>&times;</button>
                            </div>
                            <div className="detail-table-container">
                                <table className="premium-table">
                                    <thead>
                                        <tr>
                                            <th>STUDENT NAME</th>
                                            <th>CAMPUS</th>
                                            <th className="text-center">AVG TOT</th>
                                            <th className="text-center">AIR</th>
                                            <th className="text-center">BOT</th>
                                            <th className="text-center">ZOO</th>
                                            <th className="text-center">PHY</th>
                                            <th className="text-center">CHE</th>
                                            <th className="text-center">EXAMS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detailStudents.map((s, idx) => (
                                            <tr key={s.STUD_ID || idx}>
                                                <td className="font-bold text-slate-800">{s.name}</td>
                                                <td className="text-slate-500 text-sm">{s.campus}</td>
                                                <td className="text-center"><span className="score-pill bg-yellow-100 text-yellow-800">{Number(s.tot).toFixed(1)}</span></td>
                                                <td className="text-center font-semibold text-amber-900">{Math.round(s.air) || '-'}</td>
                                                <td className="text-center text-slate-600">{Number(s.bot).toFixed(0)}</td>
                                                <td className="text-center text-slate-600">{Number(s.zoo).toFixed(0)}</td>
                                                <td className="text-center text-slate-600">{Number(s.phy).toFixed(0)}</td>
                                                <td className="text-center text-slate-600">{Number(s.che).toFixed(0)}</td>
                                                <td className="text-center font-bold text-blue-600">{s.t_app}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .premium-report-page {
                    padding: 2rem;
                    background: #f1f5f9;
                    min-height: calc(100vh - 80px);
                    font-family: 'Inter', system-ui, sans-serif;
                }
                .report-main-grid {
                    display: grid;
                    grid-template-columns: 1fr 1.35fr;
                    gap: 2rem;
                    max-width: 1800px;
                    margin: 0 auto;
                }
                .glass-card {
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
                    border: 1px solid rgba(255,255,255,0.8);
                    overflow: hidden;
                    transition: all 0.3s ease;
                }
                .chart-card-large {
                    padding: 2rem;
                    height: 100%;
                    min-height: 600px;
                }
                .card-header-premium {
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    margin-bottom: 2rem;
                }
                .header-icon-wrap {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .header-text h3 {
                    margin: 0;
                    font-size: 1.25rem;
                    font-weight: 800;
                    color: #0f172a;
                }
                .header-text p {
                    margin: 2px 0 0 0;
                    font-size: 0.875rem;
                    color: #64748b;
                }
                .chart-body {
                    height: calc(100% - 100px);
                }
                
                .data-section-column {
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                }
                
                .metrics-group {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }
                .metrics-row {
                    display: flex;
                    border-radius: 16px;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
                    border: 1px solid #e2e8f0;
                }
                .metric-label-sidebar {
                    writing-mode: vertical-lr;
                    transform: rotate(180deg);
                    padding: 1rem 0.75rem;
                    color: white;
                    font-weight: 900;
                    font-size: 0.75rem;
                    letter-spacing: 0.1em;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .metric-stats-grid {
                    flex: 1;
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    background: white;
                }
                .metric-cell {
                    padding: 1rem 0.5rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    border-right: 1px solid #f1f5f9;
                    border-bottom: 1px solid #f1f5f9;
                    min-height: 90px;
                    transition: all 0.2s ease;
                }
                .cell-label {
                    font-size: 0.65rem;
                    font-weight: 800;
                    margin-bottom: 6px;
                    color: inherit;
                    opacity: 0.7;
                }
                .targets-metric .cell-value {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #1e293b;
                }
                .achieved-metric .cell-value {
                    font-size: 1.25rem;
                }
                
                .interactive-cell {
                    cursor: pointer;
                }
                .interactive-cell:hover {
                    filter: brightness(1.1);
                    transform: translateY(-2px);
                    box-shadow: inset 0 0 10px rgba(0,0,0,0.1);
                }
                .selected-cell {
                    border: 4px solid #facc15 !important;
                    z-index: 10;
                    position: relative;
                }
                
                .detail-section-wrap {
                    animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .detail-section-wrap.hidden { display: none; }
                
                .detail-header {
                    padding: 1.5rem 2rem;
                    color: white;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .detail-title h3 {
                    margin: 8px 0;
                    font-size: 1.5rem;
                    font-weight: 800;
                }
                .highlight-tag {
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 4px 10px;
                    border-radius: 100px;
                    text-transform: uppercase;
                }
                .count-badge {
                    font-size: 0.875rem;
                    font-weight: 600;
                    opacity: 0.9;
                }
                .close-btn {
                    font-size: 2rem;
                    line-height: 1;
                    background: none;
                    border: none;
                    color: white;
                    cursor: pointer;
                    opacity: 0.7;
                    transition: 0.2s;
                }
                .close-btn:hover { opacity: 1; }
                
                .detail-table-container {
                    max-height: 600px;
                    overflow-y: auto;
                }
                .premium-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .premium-table th {
                    position: sticky;
                    top: 0;
                    background: #f8fafc;
                    padding: 1rem;
                    font-size: 0.75rem;
                    font-weight: 800;
                    color: #475569;
                    text-align: left;
                    border-bottom: 2px solid #e2e8f0;
                    z-index: 10;
                }
                .premium-table td {
                    padding: 1.25rem 1rem;
                    border-bottom: 1px solid #f1f5f9;
                    font-size: 0.9375rem;
                }
                .premium-table tr:hover {
                    background: #f8fafc;
                }
                .score-pill {
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-weight: 800;
                    font-size: 0.875rem;
                }

                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default TargetVsAchieved;
