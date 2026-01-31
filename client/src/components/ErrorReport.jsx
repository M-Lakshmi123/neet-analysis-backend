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
    const reportRef = useRef(null);

    // Fetch Report Data
    useEffect(() => {
        const fetchData = async () => {
            // Require at least one filter that limits scope significantly
            // However, allow fetch if Student Search is active even without Test
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

                const processed = Object.values(grouped).map(student => ({
                    ...student,
                    tests: Object.values(student.tests)
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

    // PDF Download Handler (using robust window.print for layout fidelity)
    const handleDownload = () => {
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

                <div className="controls flex justify-between items-center bg-white p-4 rounded-lg shadow-sm mb-4 border border-gray-200">
                    <div className="text-sm text-gray-600 font-bold">
                        PDF PREVIEW (Data Loaded: {reportData.length > 0 ? 'Yes' : 'No'})
                    </div>
                    <button
                        onClick={handleDownload}
                        disabled={reportData.length === 0}
                        className={`btn-primary ${reportData.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        ⬇ Download PDF
                    </button>
                </div>
            </div>

            {/* PDF Preview Area */}
            <div className="pdf-viewer-container" style={{ background: '#525659', padding: '40px', minHeight: '600px', overflowX: 'auto' }}>
                {loading && (
                    <div className="bg-white p-8 rounded shadow text-center mx-auto max-w-lg">
                        <div className="animate-spin text-4xl mb-4">↻</div>
                        <div>Generating Report Data...</div>
                    </div>
                )}

                {!loading && reportData.length === 0 && (
                    <div className="bg-white p-12 rounded shadow text-center mx-auto max-w-xl">
                        <h2 className="text-xl font-bold text-gray-700 mb-2">No Data To Display</h2>
                        <p className="text-gray-500 mb-6">
                            To generate the Error Report, please:
                        </p>
                        <div className="text-left bg-blue-50 p-4 rounded border border-blue-100 mx-auto inline-block">
                            <ul className="list-disc pl-5 space-y-2 text-sm text-blue-800">
                                <li>Select a specific <b>Test</b> from the filters, OR</li>
                                <li>Search for a specific <b>Student</b> by Name or ID</li>
                            </ul>
                        </div>
                    </div>
                )}

                {/* Actual Report Content */}
                <div ref={reportRef} className="report-content">
                    {reportData.map((student, sIdx) => (
                        <div key={sIdx} className="student-group">
                            {student.tests.map((test, tIdx) => (
                                <div key={tIdx} className="report-page print-break shadow-lg mx-auto">
                                    {/* HEADER */}
                                    <div className="brand-header text-center mb-2">
                                        <h1 style={{
                                            fontFamily: 'Impact, sans-serif',
                                            color: '#000080',
                                            fontSize: '23px',
                                            letterSpacing: '1px',
                                            margin: '0',
                                            textTransform: 'uppercase'
                                        }}>
                                            Sri Chaitanya Educational Institutions
                                        </h1>
                                        <div className="text-center text-xs font-bold uppercase tracking-wide mb-1">
                                            A.P, Telangana, Karnataka, Tamilnadu, Maharashtra, Delhi, Ranchi
                                        </div>
                                        <div className="font-serif italic text-lg mb-1">
                                            A Right Choice for the Real Aspirant
                                        </div>
                                        <div className="font-bold text-sm uppercase">
                                            Central Office, Bangalore
                                        </div>
                                    </div>

                                    {/* STUDENT & TEST INFO TABLE */}
                                    <table className="info-table w-full mb-4 border-collapse border border-black text-xs">
                                        <tbody>
                                            <tr className="bg-[#fff8dc]">
                                                <td colSpan="6" className="border border-black p-1 text-center font-bold text-base uppercase">
                                                    {student.info.name}
                                                </td>
                                                <td colSpan="6" className="border border-black p-1 text-center font-bold text-base uppercase">
                                                    {student.info.branch}
                                                </td>
                                            </tr>
                                            <tr className="text-center font-bold bg-gray-50">
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
                                            <tr className="text-center font-bold">
                                                <td className="border border-black p-1 text-red-700">{test.meta.testName}</td>
                                                <td className="border border-black p-1 text-red-700">{test.meta.date}</td>
                                                <td className="border border-black p-1 text-red-700">{test.meta.tot}</td>
                                                <td className="border border-black p-1 text-red-700">{test.meta.air}</td>
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
                                            <div key={qIdx} className="question-block mb-2 border border-black break-inside-avoid">
                                                {/* Red Header Bar */}
                                                <div className="q-header bg-[#800000] text-white flex text-xs font-bold items-center">
                                                    <div className="w-[40px] p-1 text-center border-r border-white">{q.W_U}</div>
                                                    <div className="w-[40px] p-1 text-center border-r border-white">{q.Q_No}</div>
                                                    <div className="flex-1 p-1 pl-2 border-r border-white truncate">
                                                        Topic: <span className="text-yellow-200">{q.Topic}</span>
                                                    </div>
                                                    <div className="flex-1 p-1 pl-2 border-r border-white truncate">
                                                        Sub Topic: <span className="text-yellow-200">{q.Sub_Topic}</span>
                                                    </div>
                                                    <div className="w-[80px] p-1 text-center">
                                                        Key: {q.Key_Value}
                                                    </div>
                                                </div>

                                                {/* Content Area */}
                                                <div className="q-content flex min-h-[120px]">
                                                    {/* Left Subject Strip */}
                                                    <div className="subject-strip w-[30px] bg-[#4682b4] text-white flex items-center justify-center p-1 border-r border-black">
                                                        <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontWeight: 'bold', fontSize: '10px', letterSpacing: '1px' }}>
                                                            {q.Subject}
                                                        </span>
                                                    </div>

                                                    {/* Right Image Area */}
                                                    <div className="images-area flex-1 p-1 bg-white flex flex-col">
                                                        <div className="q-row flex gap-2 h-full">
                                                            {/* Question Image */}
                                                            <div className="q-img-col flex-1 flex items-center justify-center p-1">
                                                                {q.Q_URL ? (
                                                                    <img
                                                                        src={q.Q_URL}
                                                                        alt={`Q${q.Q_No}`}
                                                                        className="max-w-full max-h-[250px] object-contain"
                                                                    />
                                                                ) : (
                                                                    <span className="text-gray-300 text-xs">No Question Image</span>
                                                                )}
                                                            </div>

                                                            {/* Solution Image - Only if exists */}
                                                            {q.S_URL && (
                                                                <div className="s-img-col flex-1 flex items-center justify-center p-1 border-l border-gray-300">
                                                                    <img
                                                                        src={q.S_URL}
                                                                        alt={`Sol${q.Q_No}`}
                                                                        className="max-w-full max-h-[250px] object-contain"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
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
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .pdf-viewer-container { padding: 0 !important; background: white !important; height: auto !important; overflow: visible !important; }
                    .dashboard-root { height: auto !important; overflow: visible !important; }
                    .dashboard-main-content { margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
                    .sidebar { display: none !important; }
                    .report-page {
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        padding: 0 !important;
                        page-break-after: always;
                    }
                    body { -webkit-print-color-adjust: exact; margin: 0; padding: 0; }
                    @page { margin: 10mm; size: A4; }
                }
                
                .report-page {
                    background: white;
                    width: 210mm; /* A4 Width */
                    min-height: 297mm; /* A4 Height */
                    padding: 15mm;
                    margin: 0 auto 30px auto;
                    position: relative;
                }
            `}</style>
        </div>
    );
};

export default ErrorReport;
