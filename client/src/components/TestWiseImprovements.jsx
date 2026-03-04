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
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [categoryAverages, setCategoryAverages] = useState(null);
    const [loadingAverages, setLoadingAverages] = useState(false);
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

    useEffect(() => {
        if (selectedTestIdx === null || selectedCategory === 'all') {
            setCategoryAverages(null);
            return;
        }

        const fetchCategoryAverages = async () => {
            setLoadingAverages(true);
            try {
                const isOverall = selectedTestIdx === 'overall';
                const testName = isOverall ? null : stats[selectedTestIdx].Test;

                const queryFilters = { ...filters };
                if (testName) queryFilters.test = [testName];
                queryFilters.category = selectedCategory;

                const queryParams = buildQueryParams(queryFilters).toString();
                const res = await fetch(`${API_URL}/api/test-improvements/averages?${queryParams}`);
                const data = await res.json();
                setCategoryAverages(data);
            } catch (err) {
                console.error("Failed to fetch category averages:", err);
            } finally {
                setLoadingAverages(false);
            }
        };

        fetchCategoryAverages();
    }, [selectedTestIdx, selectedCategory, filters, stats]);

    const handleDownloadStudents = async () => {
        if (selectedTestIdx === null || (selectedTestIdx !== 'overall' && !stats[selectedTestIdx])) return;
        setDownloading(true);
        const isOverall = selectedTestIdx === 'overall';
        const testName = isOverall ? 'OVERALL' : stats[selectedTestIdx].Test;

        try {
            const queryFilters = isOverall ? { ...filters, groupByStudent: true } : { ...filters, test: [testName] };
            if (selectedCategory !== 'all') {
                queryFilters.category = selectedCategory;
            }
            const queryParams = buildQueryParams(queryFilters).toString();
            const res = await fetch(`${API_URL}/api/test-improvements/students?${queryParams}`);
            const students = await res.json();

            if (!students || students.length === 0) {
                alert("No students found for this test.");
                setDownloading(false);
                return;
            }

            const workbook = new ExcelJS.Workbook();

            // Define sheets configuration
            const subjects = [
                { name: 'Botany', key: 'bot', colIdx: 8, impIdx: 9, max: 180 },
                { name: 'Zoology', key: 'zoo', colIdx: 11, impIdx: 12, max: 180 },
                { name: 'Physics', key: 'phy', colIdx: 14, impIdx: 15, max: 180 },
                { name: 'Chemistry', key: 'che', colIdx: 17, impIdx: 18, max: 180 }
            ];

            // 1. MASTER SHEET
            const masterSheet = workbook.addWorksheet('Master Report');
            masterSheet.columns = [
                { header: 'S.No', key: 'sno', width: 8 },
                { header: 'Student ID', key: 'id', width: 15 },
                { header: 'Student Name', key: 'name', width: 30 },
                { header: 'Campus Name', key: 'campus', width: 22 },
                { header: 'Stream', key: 'stream', width: 18 },
                { header: 'Botany', key: 'bot', width: 12 },
                { header: 'Bot %', key: 'bot_pct', width: 10 },
                { header: 'Bot Improve', key: 'bot_imp', width: 15 },
                { header: 'Zoology', key: 'zoo', width: 12 },
                { header: 'Zoo %', key: 'zoo_pct', width: 10 },
                { header: 'Zoo Improve', key: 'zoo_imp', width: 15 },
                { header: 'Physics', key: 'phy', width: 12 },
                { header: 'Phy %', key: 'phy_pct', width: 10 },
                { header: 'Phy Improve', key: 'phy_imp', width: 15 },
                { header: 'Chemistry', key: 'che', width: 12 },
                { header: 'Che %', key: 'che_pct', width: 10 },
                { header: 'Che Improve', key: 'che_imp', width: 15 },
                { header: 'Grand Total', key: 'tot', width: 15 },
                { header: 'Total %', key: 'tot_pct', width: 12 },
                { header: 'Exams', key: 'exam_count', width: 10 }
            ];

            // Helper to style subject sheets
            const setupSheetStyle = (sheet) => {
                sheet.getRow(1).eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                });
            };

            setupSheetStyle(masterSheet);

            // Create Subject Sheets
            const subjWorksheets = {};
            subjects.forEach(sub => {
                const sheet = workbook.addWorksheet(sub.name);
                sheet.columns = [
                    { header: 'S.No', key: 'sno', width: 8 },
                    { header: 'Student ID', key: 'id', width: 15 },
                    { header: 'Student Name', key: 'name', width: 30 },
                    { header: 'Campus', key: 'campus', width: 22 },
                    { header: 'Stream', key: 'stream', width: 18 },
                    { header: `${sub.name} Marks`, key: 'marks', width: 15 },
                    { header: `${sub.name} %`, key: 'pct', width: 12 },
                    { header: `Improvement Needed`, key: 'imp', width: 22 },
                    { header: `Exams`, key: 'exam_count', width: 10 }
                ];
                setupSheetStyle(sheet);
                subjWorksheets[sub.key] = sheet;
            });

            // Add Data to all sheets
            students.forEach((s, idx) => {
                const round2 = (num) => Math.round((Number(num) || 0) * 100) / 100;
                const b = round2(s.bot);
                const z = round2(s.zoo);
                const p = round2(s.phy);
                const c = round2(s.che);
                const totalMarks = round2(s.tot || (b + z + p + c));

                const studentData = {
                    sno: idx + 1,
                    id: s.STUD_ID || '-',
                    name: s.name || 'N/A',
                    campus: s.campus || 'N/A',
                    stream: s.stream || '-',
                    bot: b, bot_pct: `${round2((b / 180) * 100)}%`, bot_imp: round2(Math.max(0, 180 - b)),
                    zoo: z, zoo_pct: `${round2((z / 180) * 100)}%`, zoo_imp: round2(Math.max(0, 180 - z)),
                    phy: p, phy_pct: `${round2((p / 180) * 100)}%`, phy_imp: round2(Math.max(0, 180 - p)),
                    che: c, che_pct: `${round2((c / 180) * 100)}%`, che_imp: round2(Math.max(0, 180 - c)),
                    tot: totalMarks,
                    tot_pct: `${round2((totalMarks / 720) * 100)}%`,
                    exam_count: s.exam_count || 1
                };

                // Helper for improvement color
                const getImpColor = (imp) => {
                    const val = Number(imp) || 0;
                    if (val === 0) return null;
                    if (val <= 40) return 'FF10B981'; // Green (Good)
                    if (val <= 85) return 'FFF59E0B'; // Amber (Moderate)
                    return 'FFEF4444'; // Red (Critical)
                };

                // Add to Master
                const masterRow = masterSheet.addRow(studentData);
                // Apply Dynamic Font Color to Improve Columns in Master (Bot/Zoo/Phy/Che)
                const impCols = { 8: studentData.bot_imp, 11: studentData.zoo_imp, 14: studentData.phy_imp, 17: studentData.che_imp };
                Object.keys(impCols).forEach(col => {
                    const color = getImpColor(impCols[col]);
                    if (color) {
                        masterRow.getCell(Number(col)).font = { color: { argb: color }, bold: true };
                    }
                });

                // Add to Subject Sheets
                subjects.forEach(sub => {
                    const marks = round2(s[sub.key]);
                    const impValue = round2(Math.max(0, 180 - marks));
                    const row = subjWorksheets[sub.key].addRow({
                        sno: idx + 1,
                        id: s.STUD_ID || '-',
                        name: s.name || 'N/A',
                        campus: s.campus || 'N/A',
                        stream: s.stream || '-',
                        marks: marks,
                        pct: `${round2((marks / 180) * 100)}%`,
                        imp: impValue,
                        exam_count: s.exam_count || 1
                    });
                    // Style Improvement Column (Col 8) with dynamic color
                    const color = getImpColor(impValue);
                    if (color) {
                        row.getCell(8).font = { color: { argb: color }, bold: true };
                    }
                });
            });

            // Universal Alignment Formatting
            workbook.eachSheet(sheet => {
                sheet.eachRow((row, rowNumber) => {
                    row.eachCell(cell => {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    });
                });
            });

            // Add Footer info to the LAST sheet (Chemistry)
            const lastSheet = workbook.getWorksheet('Chemistry');
            const footerRowIdx = students.length + 3;

            const footer1 = lastSheet.getRow(footerRowIdx);
            footer1.getCell(2).value = isOverall ? `Overall Analysis From: ${stats.length} Tests` : `Single Test: ${testName}`;
            footer1.getCell(2).font = { bold: true, size: 12, color: { argb: 'FF4F46E5' } };

            const footer2 = lastSheet.getRow(footerRowIdx + 1);
            footer2.getCell(2).value = `Total Students Record Count: ${students.length}`;
            footer2.getCell(2).font = { bold: true, size: 12 };

            const buffer = await workbook.xlsx.writeBuffer();
            saveAs(new Blob([buffer]), isOverall ? `Overall_Improvement_Report.xlsx` : `Improvement_Report_${testName}.xlsx`);
            logActivity(userData, 'Exported Multi-Sheet Improvement Report', { test: isOverall ? 'Overall' : testName });

        } catch (err) {
            console.error("Error downloading student list:", err);
            alert("Failed to download Excel. Please try again.");
        } finally {
            setDownloading(false);
        }
    };

    const formatDiff = (current, prev) => {
        const c = Number(current) || 0;
        const p = Number(prev) || 0;
        const diff = Math.round((c - p) * 10) / 10;
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

    // Override with category averages if active
    if (selectedCategory !== 'all' && categoryAverages) {
        selectedTest = {
            ...selectedTest,
            avg_bot: categoryAverages.avg_bot,
            avg_zoo: categoryAverages.avg_zoo,
            avg_phy: categoryAverages.avg_phy,
            avg_che: categoryAverages.avg_che,
            avg_tot: categoryAverages.avg_tot
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
                    gap: 1rem;
                    padding: 0.5rem 0;
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
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(31, 38, 135, 0.05);
                    padding: 1rem;
                    overflow: hidden;
                    transition: all 0.3s ease;
                }
                .glass-header {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 0.75rem;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    border-bottom: 2px solid rgba(99, 102, 241, 0.2);
                    padding-bottom: 0.5rem;
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
                    padding: 0.6rem 0.75rem;
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
                    gap: 0.5rem;
                    margin-bottom: 1rem;
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
                    display: flex;
                    gap: 1rem;
                    overflow-x: auto;
                    padding-bottom: 1rem;
                    margin-bottom: 1rem;
                    scrollbar-width: thin;
                    scrollbar-color: #cbd5e1 transparent;
                }
                .subjects-grid::-webkit-scrollbar {
                    height: 6px;
                }
                .subjects-grid::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 10px;
                }
                .subject-card {
                    background: rgba(255, 255, 255, 0.9);
                    border-radius: 12px;
                    padding: 1rem;
                    border: 1px solid rgba(226, 232, 240, 0.8);
                    position: relative;
                    min-width: 240px;
                    flex: 1;
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                .subject-card:hover {
                    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
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
                    font-size: 1.4rem;
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
                                                {cat.isSpecial ? Math.round(test[cat.key] || 0) : (test[cat.key] || 0)}
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

                <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Filter by Category</div>
                    <div className="test-selector">
                        <div
                            className={`test-pill ${selectedCategory === 'all' ? 'active' : ''}`}
                            onClick={() => setSelectedCategory('all')}
                        >
                            OVERALL (ALL)
                        </div>
                        {categories.filter(c => !c.isSpecial).map((cat) => (
                            <div
                                key={cat.key}
                                className={`test-pill ${selectedCategory === cat.key ? 'active' : ''}`}
                                onClick={() => setSelectedCategory(cat.key)}
                                style={{ borderLeft: selectedCategory === cat.key ? 'none' : '4px solid #6366f1' }}
                            >
                                {cat.label}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>Select Test</div>
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
                    <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'rgba(99, 102, 241, 0.05)', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall average</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#1e293b' }}>
                                {totAvg} <span style={{ fontSize: '0.85rem', color: '#6366f1', opacity: 0.8 }}>/ 720</span>
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Success rate</span>
                            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10b981' }}>{totPct}%</div>
                        </div>
                    </div>
                )}

                {selectedTest && (
                    <div style={{ opacity: loadingAverages ? 0.6 : 1, transition: 'opacity 0.3s ease', position: 'relative' }}>
                        {loadingAverages && (
                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 10, fontWeight: '700', color: '#6366f1', background: 'rgba(255,255,255,0.8)', padding: '0.5rem 1rem', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                                Updating Averages...
                            </div>
                        )}
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
                    </div>
                )}
            </div>
        </div>
    );
};

export default TestWiseImprovements;
