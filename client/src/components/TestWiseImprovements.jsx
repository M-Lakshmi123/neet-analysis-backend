import React, { useState, useEffect } from 'react';
import { buildQueryParams, API_URL } from '../utils/apiHelper';
import LoadingTimer from './LoadingTimer';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { Download, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';
import { useAuth } from './auth/AuthProvider';
import { logActivity } from '../utils/activityLogger';

const TestWiseImprovements = ({ filters }) => {
    const { userData } = useAuth();
    const [stats, setStats] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedTestIdx, setSelectedTestIdx] = useState(null);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const queryParams = buildQueryParams(filters).toString();
                const res = await fetch(`${API_URL}/api/test-improvements/stats?${queryParams}`);
                const data = await res.json();
                setStats(data || []);
                if (data && data.length > 0) {
                    setSelectedTestIdx('overall'); // select OVERALL by default
                } else {
                    setSelectedTestIdx(null);
                }
            } catch (err) {
                console.error("Failed to fetch test improvements:", err);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchStats();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [filters]);

    const handleDownloadStudents = async () => {
        if (selectedTestIdx === null || !stats[selectedTestIdx]) return;
        setDownloading(true);
        const isOverall = selectedTestIdx === 'overall';
        const testName = isOverall ? 'OVERALL' : stats[selectedTestIdx].Test;

        try {
            const queryFilters = isOverall ? { ...filters } : { ...filters, test: [testName] };
            const queryParams = buildQueryParams(queryFilters).toString();
            const res = await fetch(`${API_URL}/api/test-improvements/students?${queryParams}`);
            const students = await res.json();

            if (!students || students.length === 0) {
                alert("No students found for this test.");
                setDownloading(false);
                return;
            }

            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Improvement List');

            // Define Columns
            worksheet.columns = [
                { header: 'S.No', key: 'sno', width: 8 },
                { header: 'Student ID', key: 'id', width: 15 },
                { header: 'Student Name', key: 'name', width: 30 },
                { header: 'Campus Name', key: 'campus', width: 20 },
                { header: 'Stream', key: 'stream', width: 20 },
                { header: 'Botany Marks', key: 'bot', width: 15 },
                { header: 'Botany %', key: 'bot_pct', width: 12 },
                { header: 'Botany Improve', key: 'bot_imp', width: 17 },
                { header: 'Zoology Marks', key: 'zoo', width: 15 },
                { header: 'Zoology %', key: 'zoo_pct', width: 12 },
                { header: 'Zoology Improve', key: 'zoo_imp', width: 18 },
                { header: 'Physics Marks', key: 'phy', width: 15 },
                { header: 'Physics %', key: 'phy_pct', width: 12 },
                { header: 'Physics Improve', key: 'phy_imp', width: 18 },
                { header: 'Chemistry Marks', key: 'che', width: 18 },
                { header: 'Chemistry %', key: 'che_pct', width: 12 },
                { header: 'Chemistry Improve', key: 'che_imp', width: 20 },
                { header: 'Total Marks', key: 'tot', width: 15 },
                { header: 'Total %', key: 'tot_pct', width: 12 }
            ];

            // Add Header Row Styling
            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            // Add Data
            students.forEach((s, idx) => {
                const bot = Number(s.bot) || 0;
                const zoo = Number(s.zoo) || 0;
                const phy = Number(s.phy) || 0;
                const che = Number(s.che) || 0;

                worksheet.addRow({
                    sno: idx + 1,
                    id: s.STUD_ID || '-',
                    name: s.name || 'N/A',
                    campus: s.campus || 'N/A',
                    stream: s.stream || '-',
                    bot: bot,
                    bot_pct: `${Math.round((bot / 180) * 100)}%`,
                    bot_imp: Math.max(0, 180 - bot),
                    zoo: zoo,
                    zoo_pct: `${Math.round((zoo / 180) * 100)}%`,
                    zoo_imp: Math.max(0, 180 - zoo),
                    phy: phy,
                    phy_pct: `${Math.round((phy / 180) * 100)}%`,
                    phy_imp: Math.max(0, 180 - phy),
                    che: che,
                    che_pct: `${Math.round((che / 180) * 100)}%`,
                    che_imp: Math.max(0, 180 - che),
                    tot: Number(s.tot) || 0,
                    tot_pct: `${Math.round((Number(s.tot) / 720) * 100)}%`
                });
            });

            // Auto-format numeric columns to center
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1) {
                    [1, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].forEach(colIndex => {
                        const cell = row.getCell(colIndex);
                        if (cell) cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    });
                }
            });

            // Add total count footer to worksheet
            const totalCount = students.length;
            const footerRowIdx = totalCount + 3;
            const footerRow = worksheet.getRow(footerRowIdx);
            footerRow.getCell(2).value = isOverall ? `Overall Total Student Count: ${totalCount}` : `Total Students for ${testName}: ${totalCount}`;
            footerRow.getCell(2).font = { bold: true };
            footerRow.commit();

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), isOverall ? `Overall_Improvement_List.xlsx` : `Improvement_List_${testName}.xlsx`);
            logActivity(userData, 'Exported Student Improvements List', { test: isOverall ? 'Overall' : testName });

        } catch (err) {
            console.error("Error downloading student list:", err);
            alert("Failed to download Excel. Please try again.");
        } finally {
            setDownloading(false);
        }
    };

    const formatDiff = (current, prev) => {
        const diff = Math.round((current - prev) * 10) / 10;
        if (diff > 0) return <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.9em' }}> (+{diff})</span>;
        if (diff < 0) return <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.9em' }}> ({diff})</span>;
        return <span style={{ color: '#6b7280', fontSize: '0.9em' }}> (0)</span>;
    };

    const categories = [
        { label: '500+', key: 'cat1' },
        { label: '450 - 499', key: 'cat2' },
        { label: '400 - 449', key: 'cat3' },
        { label: '350 - 399', key: 'cat4' },
        { label: '<= 350', key: 'cat5' },
        { label: 'Overall Average', key: 'avg_tot', isSpecial: true },
    ];

    if (loading) {
        return <LoadingTimer isLoading={true} message="Fetching improvements data..." />;
    }

    if (!stats || stats.length === 0) {
        return (
            <div className="report-section" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: '#6b7280', background: 'rgba(255,255,255,0.7)', padding: '2rem', borderRadius: '1rem', backdropFilter: 'blur(10px)' }}>
                    <p style={{ fontSize: '1.2rem', fontWeight: '500' }}>No tests found for selected criteria.</p>
                    <p style={{ marginTop: '0.5rem' }}>Select tests from the filter bar to view improvements.</p>
                </div>
            </div>
        );
    }

    const isOverall = selectedTestIdx === 'overall';
    let selectedTest = isOverall ? null : stats[selectedTestIdx];

    if (isOverall && stats.length > 0) {
        selectedTest = {
            Test: 'OVERALL',
            avg_bot: stats.reduce((acc, s) => acc + (Number(s.avg_bot) || 0), 0) / stats.length,
            avg_zoo: stats.reduce((acc, s) => acc + (Number(s.avg_zoo) || 0), 0) / stats.length,
            avg_phy: stats.reduce((acc, s) => acc + (Number(s.avg_phy) || 0), 0) / stats.length,
            avg_che: stats.reduce((acc, s) => acc + (Number(s.avg_che) || 0), 0) / stats.length,
            avg_tot: stats.reduce((acc, s) => acc + (Number(s.avg_tot) || 0), 0) / stats.length
        };
    }

    const maxMarks = 180;

    const computeSubject = (avg) => {
        const val = Math.round(avg || 0);
        return { avg: val, improve: Math.max(0, maxMarks - val), percent: Math.round((val / maxMarks) * 100) };
    };

    const botData = computeSubject(selectedTest?.avg_bot);
    const zooData = computeSubject(selectedTest?.avg_zoo);
    const phyData = computeSubject(selectedTest?.avg_phy);
    const cheData = computeSubject(selectedTest?.avg_che);
    const totAvg = Math.round(selectedTest?.avg_tot || 0);
    const totPct = Math.round((totAvg / 720) * 100);

    return (
        <div className="test-improvements-wrapper">
            {/* STYLES */}
            <style dangerouslySetInnerHTML={{
                __html: `
                .test-improvements-wrapper {
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                    padding: 1rem 0;
                    animation: fadeIn 0.5s ease-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .glass-card {
                    background: rgba(255, 255, 255, 0.75);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    border-radius: 16px;
                    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.07);
                    padding: 1.5rem;
                    overflow: hidden;
                    transition: all 0.3s ease;
                }
                .glass-header {
                    font-size: 1.25rem;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 1.5rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    border-bottom: 2px solid rgba(99, 102, 241, 0.2);
                    padding-bottom: 0.75rem;
                }
                
                .modern-table-container {
                    overflow-x: auto;
                    border-radius: 12px;
                    border: 1px solid rgba(226, 232, 240, 0.8);
                }
                .modern-table {
                    width: 100%;
                    border-collapse: collapse;
                    background: rgba(255, 255, 255, 0.5);
                }
                .modern-table th, .modern-table td {
                    padding: 1rem;
                    text-align: center;
                    border-bottom: 1px solid rgba(226, 232, 240, 0.8);
                }
                .modern-table th {
                    background: rgba(248, 250, 252, 0.8);
                    color: #475569;
                    font-weight: 600;
                    text-transform: uppercase;
                    font-size: 0.85rem;
                    letter-spacing: 0.05em;
                }
                .modern-table tr:hover {
                    background: rgba(241, 245, 249, 0.5);
                }
                .category-label {
                    text-align: left !important;
                    font-weight: 600;
                    color: #334155;
                }
                
                .test-selector {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.75rem;
                    margin-bottom: 1.5rem;
                }
                .test-pill {
                    padding: 0.5rem 1.25rem;
                    border-radius: 9999px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    background: rgba(241, 245, 249, 0.8);
                    color: #64748b;
                    border: 1px solid #cbd5e1;
                }
                .test-pill:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
                }
                .test-pill.active {
                    background: linear-gradient(135deg, #6366f1, #4f46e5);
                    color: white;
                    border-color: transparent;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }

                .subjects-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 1.5rem;
                }
                .subject-card {
                    background: rgba(255, 255, 255, 0.9);
                    border-radius: 16px;
                    padding: 1.5rem;
                    border: 1px solid rgba(226, 232, 240, 0.8);
                    position: relative;
                    overflow: hidden;
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                .subject-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 25px rgba(0,0,0,0.08);
                }
                .subject-card::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; height: 4px;
                }
                .subject-card.botany::before { background: #10b981; }
                .subject-card.zoology::before { background: #3b82f6; }
                .subject-card.physics::before { background: #f59e0b; }
                .subject-card.chemistry::before { background: #ef4444; }
                
                .subj-header {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #334155;
                    margin-bottom: 1rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .subj-metrics {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-bottom: 1rem;
                }
                .metric-block {
                    display: flex;
                    flex-direction: column;
                }
                .metric-label {
                    font-size: 0.75rem;
                    color: #64748b;
                    font-weight: 600;
                    text-transform: uppercase;
                    margin-bottom: 0.25rem;
                }
                .metric-value {
                    font-size: 1.8rem;
                    font-weight: 800;
                    line-height: 1;
                }
                .metric-value.avg { color: #1e293b; }
                .metric-value.improve { color: #ef4444; }
                
                .progress-bg {
                    height: 8px;
                    background: #e2e8f0;
                    border-radius: 4px;
                    overflow: hidden;
                    margin-top: 0.5rem;
                }
                .progress-fill {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 1s ease-out;
                }

                .download-btn-wrapper {
                    display: flex;
                    justify-content: flex-end;
                }
                
                .magical-download-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: linear-gradient(135deg, #059669, #10b981);
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 12px;
                    font-weight: 600;
                    font-size: 1rem;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
                    transition: all 0.3s ease;
                }
                .magical-download-btn:hover {
                    box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
                    transform: translateY(-2px);
                }
                .magical-download-btn:disabled {
                    background: #94a3b8;
                    box-shadow: none;
                    transform: none;
                    cursor: not-allowed;
                }
            `}} />

            {/* TOP SECTION: Category wise counts & improvements */}
            <div className="glass-card">
                <div className="glass-header">
                    <TrendingUp size={24} color="#6366f1" />
                    Category Wise Trend Analysis
                </div>

                <div className="modern-table-container">
                    <table className="modern-table">
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', width: '200px' }}>Category (Marks)</th>
                                {stats.map((test, idx) => (
                                    <th key={idx}>{test.Test}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((cat, catIdx) => (
                                <tr key={catIdx} style={cat.isSpecial ? { background: 'rgba(99, 102, 241, 0.05)', borderTop: '2px solid rgba(99, 102, 241, 0.2)' } : {}}>
                                    <td className="category-label">{cat.label}</td>
                                    {stats.map((test, idx) => (
                                        <td key={idx}>
                                            <span style={{ fontWeight: cat.isSpecial ? '700' : '600', color: cat.isSpecial ? '#4f46e5' : '#334155' }}>
                                                {cat.isSpecial ? Math.round(test[cat.key]) : test[cat.key]}
                                            </span>
                                            {idx > 0 && formatDiff(test[cat.key], stats[idx - 1][cat.key])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* BOTTOM SECTION: Subject Wise Improvements */}
            <div className="glass-card">
                <div className="glass-header" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <TrendingDown size={24} color="#ef4444" />
                        Subject Wise Improvement Areas
                    </div>
                </div>

                <div className="test-selector" style={{ marginBottom: '1.5rem' }}>
                    <div
                        className={`test-pill ${selectedTestIdx === 'overall' ? 'active' : ''}`}
                        onClick={() => setSelectedTestIdx('overall')}
                    >
                        OVERALL
                    </div>
                    {stats.map((test, idx) => (
                        <div
                            key={idx}
                            className={`test-pill ${idx === selectedTestIdx ? 'active' : ''}`}
                            onClick={() => setSelectedTestIdx(idx)}
                        >
                            {test.Test}
                        </div>
                    ))}
                </div>

                {selectedTest && (
                    <div style={{ marginBottom: '2rem', padding: '1.25rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '16px', border: '1px solid rgba(99, 102, 241, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall average</span>
                            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#1e293b' }}>
                                {totAvg} <span style={{ fontSize: '1rem', color: '#6366f1', opacity: 0.8 }}>/ 720</span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Success rate</span>
                            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#10b981' }}>{totPct}%</div>
                        </div>
                    </div>
                )}

                {selectedTest && (
                    <>
                        <div className="subjects-grid">
                            {/* BOTANY */}
                            <div className="subject-card botany">
                                <div className="subj-header">Botany</div>
                                <div className="subj-metrics">
                                    <div className="metric-block">
                                        <span className="metric-label">Current Average</span>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                            <span className="metric-value avg">{botData.avg}</span>
                                            <span style={{ fontSize: '0.9rem', color: '#10b981', fontWeight: '700' }}>({botData.percent}%)</span>
                                        </div>
                                    </div>
                                    <ArrowRight size={20} color="#cbd5e1" />
                                    <div className="metric-block" style={{ alignItems: 'flex-end' }}>
                                        <span className="metric-label" style={{ color: '#ef4444' }}>Improvement Needed</span>
                                        <span className="metric-value improve">+{botData.improve}</span>
                                    </div>
                                </div>
                                <div className="progress-bg">
                                    <div className="progress-fill" style={{ width: `${botData.percent}%`, background: '#10b981' }}></div>
                                </div>
                            </div>

                            {/* ZOOLOGY */}
                            <div className="subject-card zoology">
                                <div className="subj-header">Zoology</div>
                                <div className="subj-metrics">
                                    <div className="metric-block">
                                        <span className="metric-label">Current Average</span>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                            <span className="metric-value avg">{zooData.avg}</span>
                                            <span style={{ fontSize: '0.9rem', color: '#3b82f6', fontWeight: '700' }}>({zooData.percent}%)</span>
                                        </div>
                                    </div>
                                    <ArrowRight size={20} color="#cbd5e1" />
                                    <div className="metric-block" style={{ alignItems: 'flex-end' }}>
                                        <span className="metric-label" style={{ color: '#ef4444' }}>Improvement Needed</span>
                                        <span className="metric-value improve">+{zooData.improve}</span>
                                    </div>
                                </div>
                                <div className="progress-bg">
                                    <div className="progress-fill" style={{ width: `${zooData.percent}%`, background: '#3b82f6' }}></div>
                                </div>
                            </div>

                            {/* PHYSICS */}
                            <div className="subject-card physics">
                                <div className="subj-header">Physics</div>
                                <div className="subj-metrics">
                                    <div className="metric-block">
                                        <span className="metric-label">Current Average</span>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                            <span className="metric-value avg">{phyData.avg}</span>
                                            <span style={{ fontSize: '0.9rem', color: '#f59e0b', fontWeight: '700' }}>({phyData.percent}%)</span>
                                        </div>
                                    </div>
                                    <ArrowRight size={20} color="#cbd5e1" />
                                    <div className="metric-block" style={{ alignItems: 'flex-end' }}>
                                        <span className="metric-label" style={{ color: '#ef4444' }}>Improvement Needed</span>
                                        <span className="metric-value improve">+{phyData.improve}</span>
                                    </div>
                                </div>
                                <div className="progress-bg">
                                    <div className="progress-fill" style={{ width: `${phyData.percent}%`, background: '#f59e0b' }}></div>
                                </div>
                            </div>

                            {/* CHEMISTRY */}
                            <div className="subject-card chemistry">
                                <div className="subj-header">Chemistry</div>
                                <div className="subj-metrics">
                                    <div className="metric-block">
                                        <span className="metric-label">Current Average</span>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                                            <span className="metric-value avg">{cheData.avg}</span>
                                            <span style={{ fontSize: '0.9rem', color: '#ef4444', fontWeight: '700' }}>({cheData.percent}%)</span>
                                        </div>
                                    </div>
                                    <ArrowRight size={20} color="#cbd5e1" />
                                    <div className="metric-block" style={{ alignItems: 'flex-end' }}>
                                        <span className="metric-label" style={{ color: '#ef4444' }}>Improvement Needed</span>
                                        <span className="metric-value improve">+{cheData.improve}</span>
                                    </div>
                                </div>
                                <div className="progress-bg">
                                    <div className="progress-fill" style={{ width: `${cheData.percent}%`, background: '#ef4444' }}></div>
                                </div>
                            </div>
                        </div>

                        <div className="download-btn-wrapper">
                            <button
                                className="magical-download-btn"
                                onClick={handleDownloadStudents}
                                disabled={downloading}
                            >
                                <Download size={20} />
                                {downloading ? 'Generating Excel...' : `Download ${isOverall ? 'Overall' : selectedTest.Test} Target Students`}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TestWiseImprovements;
