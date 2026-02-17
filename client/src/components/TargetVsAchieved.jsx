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
    const [selectedThreshold, setSelectedThreshold] = useState('>= 550');

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

    const aggregatedTarget = useMemo(() => {
        if (!allTargets.length) return {};
        let filtered = allTargets;

        // Filter by Campus - handle 'All', 'All Selected', '__ALL__' or empty
        const campusFilter = filters.campus || [];
        const isAllCampus = campusFilter.length === 0 ||
            campusFilter.some(c => ['All', 'All Selected', 'ALL SELECTED', '__ALL__'].includes(c));

        if (!isAllCampus) {
            filtered = filtered.filter(t =>
                campusFilter.some(c => t.NAME_OF_THE_CAMPUS.trim().toUpperCase() === c.trim().toUpperCase())
            );
        }

        // Filter by Stream - handle 'All', '__ALL__' or empty
        const streamFilter = filters.stream || [];
        const isAllStream = streamFilter.length === 0 ||
            streamFilter.some(s => ['All', '__ALL__'].includes(s));

        if (!isAllStream) {
            const mappedStreams = streamFilter.map(s => {
                const up = s.trim().toUpperCase();
                // Map all Elite variants to "SR ELITE" to match TARGETS table
                if (up.includes('SR_ELITE') || up.includes('SR ELITE')) return 'SR ELITE';
                return up;
            });
            filtered = filtered.filter(t => {
                const tStream = t.Stream ? t.Stream.trim().toUpperCase() : '';
                return mappedStreams.includes(tStream);
            });
        }

        const result = {};
        thresholds.forEach(th => {
            const sum = filtered.reduce((acc, row) => acc + (Number(row[th.key]) || 0), 0);
            result[th.key] = sum || 0;
        });
        return result;
    }, [allTargets, filters, thresholds]);

    const achievedCounts = useMemo(() => {
        if (!studentResults.length) return {};
        const counts = {};
        thresholds.forEach(th => {
            const count = studentResults.filter(s => Number(s.tot) >= th.value).length;
            counts[th.key] = count;
        });
        return counts;
    }, [studentResults, thresholds]);

    const detailStudents = useMemo(() => {
        const thresholdValue = thresholds.find(t => t.label === selectedThreshold)?.value || 0;
        return studentResults
            .filter(s => Number(s.tot) >= thresholdValue)
            .sort((a, b) => b.tot - a.tot);
    }, [studentResults, selectedThreshold]);

    const selectedThInfo = thresholds.find(t => t.label === selectedThreshold);
    const targetVal = aggregatedTarget[selectedThInfo?.key] || 0;
    const achievedVal = achievedCounts[selectedThInfo?.key] || 0;

    const chartData = {
        labels: ['Target', 'Achieved'],
        datasets: [
            {
                data: [targetVal, achievedVal],
                backgroundColor: [
                    '#003366', // Dark Target Blue
                    achievedVal >= targetVal ? '#006600' : '#FF0066' // Pure Green or Pulse Red
                ],
                borderRadius: 12,
                barThickness: 80,
                datalabels: {
                    color: 'white',
                    font: { weight: '900', size: 16 },
                    anchor: 'center',
                    align: 'center'
                }
            }
        ]
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: true },
            datalabels: { display: true }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { color: '#000', font: { weight: 'bold', size: 12 } }
            },
            x: {
                grid: { display: false },
                ticks: { color: '#000', font: { weight: '900', size: 14 } }
            }
        },
        elements: {
            bar: {
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.2)'
            }
        }
    };

    return (
        <div className="target-analysis-final">
            <LoadingTimer isLoading={loading} />

            <div className="full-width-glass target-section">
                <div className="glass-header">TARGET DEFINITIONS (ALL STREAMS)</div>
                <div className="glass-grid">
                    {thresholds.map(th => (
                        <div key={th.label} className="glass-cell">
                            <div className="label">{th.label}</div>
                            <div className="value">{(aggregatedTarget[th.key] !== undefined && aggregatedTarget[th.key] !== null && aggregatedTarget[th.key] !== '') ? aggregatedTarget[th.key] : '--'}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="full-width-glass achieved-section">
                <div className="glass-header">TOTAL ACHIEVED (UNIQUE STUDENTS)</div>
                <div className="glass-grid">
                    {thresholds.map(th => {
                        const target = aggregatedTarget[th.key] || 0;
                        const achieved = (achievedCounts[th.key] !== undefined && achievedCounts[th.key] !== null) ? achievedCounts[th.key] : 0;
                        const isMatch = achieved >= target;
                        const isSelected = selectedThreshold === th.label;
                        return (
                            <div
                                key={th.label}
                                className={`glass-cell interactive ${isMatch ? 'match-green' : 'match-red'} ${isSelected ? 'active-ring' : ''}`}
                                onClick={() => setSelectedThreshold(th.label)}
                            >
                                <div className="label">{th.label}</div>
                                <div className="value">{achieved !== undefined && achieved !== null ? achieved : '--'}</div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="split-view">
                <div className="glass-card chart-side">
                    <div className="card-header-dark">Comparison for {selectedThreshold}</div>
                    <div className="chart-area">
                        <Bar data={chartData} options={chartOptions} />
                    </div>
                </div>

                <div className="glass-card table-side">
                    <div className="card-header-dark">
                        Student List ({detailStudents.length})
                    </div>
                    <div className="table-scroll">
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>STUDENT</th>
                                    <th>CAMPUS</th>
                                    <th className="text-center">TOT</th>
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
                                        <td className="bold-black">{s.name}</td>
                                        <td className="campus-text">{s.campus}</td>
                                        <td className="text-center score-high">{Number(s.tot).toFixed(1)}</td>
                                        <td className="text-center">{Math.round(s.air) || '-'}</td>
                                        <td className="text-center">{Number(s.bot || 0).toFixed(0)}</td>
                                        <td className="text-center">{Number(s.zoo || 0).toFixed(0)}</td>
                                        <td className="text-center">{Number(s.phy || 0).toFixed(0)}</td>
                                        <td className="text-center">{Number(s.che || 0).toFixed(0)}</td>
                                        <td className="text-center font-bold text-blue-600">{s.t_app}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .target-analysis-final {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 30px;
                    background: #f0f2f5;
                }
                .full-width-glass {
                    background: rgba(255, 255, 255, 0.7);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.5);
                    border-radius: 16px;
                    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.1);
                    overflow: hidden;
                }
                .glass-header {
                    background: #1e1e1e;
                    color: #fff;
                    padding: 10px 20px;
                    font-size: 0.8rem;
                    font-weight: 900;
                    letter-spacing: 1px;
                }
                .glass-grid {
                    display: grid;
                    grid-template-columns: repeat(14, 1fr);
                }
                .glass-cell {
                    padding: 18px 10px;
                    text-align: center;
                    border-right: 1px solid rgba(0,0,0,0.05);
                }
                .glass-cell:last-child { border: none; }
                .label { font-size: 0.75rem; font-weight: 900; color: #000; margin-bottom: 6px; }
                .value { font-size: 1.2rem; font-weight: 950; color: #000; }
                
                .match-green { background: rgba(0, 102, 0, 0.1) !important; color: #006600 !important; }
                .match-green .value, .match-green .label { color: #006600 !important; }
                
                .match-red { background: rgba(255, 0, 102, 0.1) !important; }
                .match-red .value, .match-red .label { color: #000 !important; }
                
                .interactive { cursor: pointer; transition: 0.3s; }
                .interactive:hover { transform: scale(1.02); z-index: 10; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
                .active-ring { border: 3px solid #000 !important; }

                .split-view {
                    display: grid;
                    grid-template-columns: 30% 70%;
                    gap: 30px;
                }
                .glass-card {
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    box-shadow: 0 10px 40px rgba(0,0,0,0.08);
                    overflow: hidden;
                }
                .card-header-dark {
                    background: #000;
                    color: #fff;
                    padding: 15px 25px;
                    font-weight: 900;
                    font-size: 1rem;
                }
                .chart-side {
                    height: 550px;
                }
                .chart-area {
                    height: calc(100% - 60px);
                    padding: 40px 20px 20px;
                }
                .table-side {
                    height: 550px;
                    display: flex;
                    flex-direction: column;
                }
                .table-scroll { flex: 1; overflow-y: auto; }
                
                .modern-table { width: 100%; border-collapse: collapse; }
                .modern-table th {
                    background: #f8f9fa;
                    padding: 14px;
                    font-size: 0.7rem;
                    font-weight: 900;
                    color: #555;
                    text-align: left;
                    border-bottom: 2px solid #eee;
                    position: sticky; top: 0;
                }
                .modern-table td {
                    padding: 14px;
                    border-bottom: 1px solid #f0f0f0;
                    font-size: 0.9rem;
                    color: #000;
                }
                .bold-black { font-weight: 900; color: #000 !important; }
                .campus-text { opacity: 0.6; font-size: 0.8rem; white-space: nowrap; }
                .score-high { color: #003366 !important; font-weight: 950; }
                
                tr:hover { background: rgba(0,0,0,0.02); }
            `}</style>
        </div>
    );
};

export default TargetVsAchieved;
