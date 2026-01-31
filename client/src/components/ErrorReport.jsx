import React, { useState, useEffect, useRef } from 'react';
import FilterBar from './FilterBar';
import { API_URL, buildQueryParams } from '../utils/apiHelper';
import { useAuth } from './auth/AuthProvider';

const ErrorReport = () => {
    const { userData, isAdmin } = useAuth();
    const [filters, setFilters] = useState({
        campus: [],
        stream: [],
        testType: [],
        test: [],
        topAll: [],
        studentSearch: []
    });
    const [reportData, setReportData] = useState([]);
    const [loading, setLoading] = useState(false);

    // Fetch Report Data
    useEffect(() => {
        const fetchData = async () => {
            if (filters.test.length === 0 && filters.studentSearch.length === 0) {
                setReportData([]);
                return;
            }

            setLoading(true);
            try {
                const params = buildQueryParams(filters);
                const res = await fetch(`${API_URL}/api/erp/report?${params.toString()}`);
                const data = await res.json();

                // Group Data: Student -> Test -> Questions
                const grouped = {};

                data.forEach(row => {
                    const studKey = `${row.STUD_ID}_${row.Student_Name}`;
                    if (!grouped[studKey]) {
                        grouped[studKey] = {
                            info: {
                                name: row.Student_Name,
                                id: row.STUD_ID,
                                branch: row.Branch,
                                stream: row.Stream
                            },
                            tests: {}
                        };
                    }

                    const testKey = row.Test;
                    if (!grouped[studKey].tests[testKey]) {
                        grouped[studKey].tests[testKey] = {
                            meta: {
                                testName: row.Test,
                                date: row.Exam_Date,
                                tot: row.Tot_720,
                                air: row.AIR,
                                bot: row.Botany,
                                b_rank: row.B_Rank,
                                zoo: row.Zoology,
                                z_rank: row.Z_Rank,
                                phy: row.Physics,
                                p_rank: row.P_Rank,
                                chem: row.Chemistry,
                                c_rank: row.C_Rank
                            },
                            questions: []
                        };
                    }

                    grouped[studKey].tests[testKey].questions.push(row);
                });

                // Convert to array for rendering
                const processed = Object.values(grouped).map(student => ({
                    ...student,
                    tests: Object.values(student.tests) // Sort? API already sorted by date usually, but could sort here
                }));

                setReportData(processed);

            } catch (err) {
                console.error("Error fetching report:", err);
            } finally {
                setLoading(false);
            }
        };

        const timeout = setTimeout(fetchData, 500);
        return () => clearTimeout(timeout);
    }, [filters]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="error-report-page">
            <div className="no-print">
                <FilterBar
                    filters={filters}
                    setFilters={setFilters}
                    restrictedCampus={!isAdmin ? userData?.campus : null}
                    apiEndpoints={{
                        filters: '/api/erp/filters',
                        students: '/api/erp/students'
                    }}
                />

                <div className="controls" style={{ padding: '10px 20px', textAlign: 'right' }}>
                    <button onClick={handlePrint} className="btn-primary">
                        🖨️ Print / Save PDF
                    </button>
                </div>
            </div>

            <div className="report-content">
                {loading && <div className="loading p-4">Loading Report data...</div>}

                {!loading && reportData.length === 0 && (
                    <div className="empty-state p-4 text-center text-gray-500">
                        Please select a Test or Student to view the Error Report.
                    </div>
                )}

                {reportData.map((student, sIdx) => (
                    <div key={sIdx} className="student-block">
                        {student.tests.map((test, tIdx) => (
                            <div key={tIdx} className="report-page print-break">
                                {/* HEADER */}
                                <div className="brand-header text-center mb-2">
                                    <h1 style={{
                                        fontFamily: 'Impact, sans-serif',
                                        color: '#000080', // Navy
                                        fontSize: '23px',
                                        letterSpacing: '1px',
                                        margin: '0',
                                        textTransform: 'uppercase'
                                    }}>
                                        Sri Chaitanya Educational Institutions
                                    </h1>
                                    <div className="logo-placeholder" style={{ margin: '5px auto', width: '60px', height: '60px', background: 'transparent' }}>
                                        {/* Logo would go here - using text for now or empty div if image logic added later */}
                                        <img src="/logo.png" alt="Logo" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} onError={(e) => e.target.style.display = 'none'} />
                                    </div>
                                </div>

                                {/* STUDENT & TEST INFO TABLE */}
                                <table className="info-table w-full mb-4 border-collapse border border-black">
                                    <tbody>
                                        <tr className="bg-yellow-100 font-bold">
                                            <td colSpan="6" className="border border-black p-1 text-center bg-[#fff8dc] text-lg uppercase">
                                                {student.info.name}
                                            </td>
                                            <td colSpan="6" className="border border-black p-1 text-center bg-[#fff8dc] text-lg uppercase">
                                                {student.info.branch}
                                            </td>
                                        </tr>
                                        <tr className="text-center font-bold bg-gray-50 text-sm">
                                            <td className="border border-black p-1">Test</td>
                                            <td className="border border-black p-1">Date</td>
                                            <td className="border border-black p-1 text-red-600">TOT</td>
                                            <td className="border border-black p-1 text-red-600">AIR</td>
                                            <td className="border border-black p-1">BOT</td>
                                            <td className="border border-black p-1">Rank</td>
                                            <td className="border border-black p-1">ZOO</td>
                                            <td className="border border-black p-1">Rank</td>
                                            <td className="border border-black p-1">PHY</td>
                                            <td className="border border-black p-1">Rank</td>
                                            <td className="border border-black p-1">CHEM</td>
                                            <td className="border border-black p-1">Rank</td>
                                        </tr>
                                        <tr className="text-center font-bold text-sm">
                                            <td className="border border-black p-1">{test.meta.testName}</td>
                                            <td className="border border-black p-1 text-red-600">{test.meta.date}</td>
                                            <td className="border border-black p-1 text-red-600">{test.meta.tot}</td>
                                            <td className="border border-black p-1 text-red-600">{test.meta.air}</td>
                                            <td className="border border-black p-1 text-red-800">{test.meta.bot}</td>
                                            <td className="border border-black p-1 text-red-800">{test.meta.b_rank}</td>
                                            <td className="border border-black p-1 text-red-800">{test.meta.zoo}</td>
                                            <td className="border border-black p-1 text-red-800">{test.meta.z_rank}</td>
                                            <td className="border border-black p-1 text-red-800">{test.meta.phy}</td>
                                            <td className="border border-black p-1 text-red-800">{test.meta.p_rank}</td>
                                            <td className="border border-black p-1 text-red-800">{test.meta.chem}</td>
                                            <td className="border border-black p-1 text-red-800">{test.meta.c_rank}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* QUESTIONS LIST */}
                                <div className="questions-container">
                                    {test.questions.map((q, qIdx) => (
                                        <div key={qIdx} className="question-block mb-4 border border-black break-inside-avoid">
                                            {/* Red Header Bar */}
                                            <div className="q-header bg-[#800000] text-white flex text-sm font-bold">
                                                <div className="w-[8%] p-1 text-center border-r border-white">{q.W_U}</div>
                                                <div className="w-[8%] p-1 text-center border-r border-white">{q.Q_No}</div>
                                                <div className="flex-1 p-1 pl-2 border-r border-white">
                                                    Topic: <span className="text-yellow-200">{q.Topic}</span>
                                                </div>
                                                <div className="flex-1 p-1 pl-2 border-r border-white">
                                                    Sub Topic: <span className="text-yellow-200">{q.Sub_Topic}</span>
                                                </div>
                                                <div className="w-[12%] p-1 text-center">
                                                    Key: {q.Key_Value}
                                                </div>
                                            </div>

                                            {/* Content Area */}
                                            <div className="q-content flex min-h-[150px]">
                                                {/* Left Subject Strip */}
                                                <div className="subject-strip w-[10%] bg-[#4682b4] text-white flex items-center justify-center p-2">
                                                    <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 'bold', letterSpacing: '2px' }}>
                                                        {q.Subject}
                                                    </span>
                                                </div>

                                                {/* Right Image Area */}
                                                <div className="images-area flex-1 p-2 bg-white flex flex-col gap-2">
                                                    {q.Q_URL && (
                                                        <div className="q-img-wrapper">
                                                            <img
                                                                src={q.Q_URL}
                                                                alt={`Q${q.Q_No}`}
                                                                className="max-w-full object-contain"
                                                                style={{ maxHeight: '300px' }}
                                                            />
                                                        </div>
                                                    )}
                                                    {q.S_URL && (
                                                        <div className="s-img-wrapper border-t border-dashed border-gray-300 pt-2 mt-2">
                                                            <div className="text-xs text-gray-500 mb-1">Solution:</div>
                                                            <img
                                                                src={q.S_URL}
                                                                alt={`Sol${q.Q_No}`}
                                                                className="max-w-full object-contain"
                                                                style={{ maxHeight: '300px' }}
                                                            />
                                                        </div>
                                                    )}
                                                    {!q.Q_URL && !q.S_URL && (
                                                        <div className="text-center text-gray-400 py-10">
                                                            No Image Available for Question {q.Q_No}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .dashboard-root { height: auto !important; overflow: visible !important; }
                    .dashboard-main-content { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
                    .report-page { 
                        width: 100%; 
                        padding: 20px;
                        print-color-adjust: exact; 
                        -webkit-print-color-adjust: exact; 
                    }
                    .print-break { page-break-after: always; }
                    .student-block { page-break-after: always; }
                    body { background: white; -webkit-print-color-adjust: exact; }
                }
                /* Print Preview Visuals on Screen */
                .report-content {
                    max-width: 1100px;
                    margin: 0 auto;
                    background: #f0f0f0;
                    padding: 20px;
                }
                .report-page {
                    background: white;
                    border: 1px solid #ddd;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    margin-bottom: 30px;
                    padding: 30px; /* A4 padding roughly */
                    min-height: 297mm; /* A4 Height */
                }
            `}</style>
        </div>
    );
};

export default ErrorReport;
