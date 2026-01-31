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

                <div ref={reportRef} className="report-content">
                    {reportData.map((student, sIdx) => (
                        <div key={sIdx} className="student-group">
                            {student.tests.map((test, tIdx) => (
                                <div key={tIdx} className="report-page print-break shadow-lg mx-auto bg-white" style={{ border: '2px solid #000', padding: '10px' }}>

                                    {/* HEADER SECTION - Full Width */}
                                    <div className="brand-header text-center mb-1">
                                        <h1 style={{
                                            fontFamily: 'Impact, sans-serif',
                                            color: '#000080',
                                            fontSize: '26px',
                                            letterSpacing: '0.5px',
                                            margin: '0',
                                            textTransform: 'uppercase',
                                            textShadow: '1px 1px 0px rgba(0,0,0,0.1)'
                                        }}>
                                            Sri Chaitanya Educational Institutions
                                        </h1>
                                        <div className="text-center font-bold text-[10px] uppercase tracking-wider mb-0 text-black">
                                            A.P, Telangana, Karnataka, Tamilnadu, Maharashtra, Delhi, Ranchi
                                        </div>
                                        <div className="font-serif italic text-lg mb-0 text-black leading-tight">
                                            A Right Choice for the Real Aspirant
                                        </div>
                                        <div className="font-bold text-sm uppercase text-black leading-tight mb-2">
                                            Central Office, Bangalore
                                        </div>
                                    </div>

                                    {/* STUDENT INFO & MARKS - Table Structure */}
                                    <div className="info-section border border-black mb-1">
                                        {/* Row 1: Name and Campus */}
                                        <div className="flex border-b border-black bg-[#fff8dc]">
                                            <div className="flex-1 border-r border-black p-1 pl-2 font-bold uppercase text-sm text-left">
                                                {student.info.name}
                                            </div>
                                            <div className="flex-1 p-1 pr-2 font-bold uppercase text-sm text-right">
                                                {student.info.branch}
                                            </div>
                                        </div>

                                        {/* Row 2: Test Info Headers */}
                                        <div className="flex text-center text-[11px] font-bold bg-[#fce4d6]">
                                            <div className="w-[12%] border-r border-black border-b border-black p-0.5 pt-1">Test</div>
                                            <div className="w-[12%] border-r border-black border-b border-black p-0.5 pt-1">Date</div>
                                            <div className="w-[8%] border-r border-black border-b border-black p-0.5 pt-1">TOT</div>
                                            <div className="w-[8%] border-r border-black border-b border-black p-0.5 pt-1">AIR</div>
                                            <div className="w-[8%] border-r border-black border-b border-black p-0.5 pt-1">BOT</div>
                                            <div className="w-[7%] border-r border-black border-b border-black p-0.5 pt-1">Rank</div>
                                            <div className="w-[8%] border-r border-black border-b border-black p-0.5 pt-1">ZOO</div>
                                            <div className="w-[7%] border-r border-black border-b border-black p-0.5 pt-1">Rank</div>
                                            <div className="w-[8%] border-r border-black border-b border-black p-0.5 pt-1">PHY</div>
                                            <div className="w-[7%] border-r border-black border-b border-black p-0.5 pt-1">Rank</div>
                                            <div className="w-[8%] border-r border-black border-b border-black p-0.5 pt-1">CHEM</div>
                                            <div className="w-[7%] border-b border-black p-0.5 pt-1">Rank</div>
                                        </div>

                                        {/* Row 3: Test Info Values */}
                                        <div className="flex text-center text-[12px] font-bold bg-[#fff]">
                                            <div className="w-[12%] border-r border-black p-0.5 text-red-700">{test.meta.testName}</div>
                                            <div className="w-[12%] border-r border-black p-0.5 text-red-700">{test.meta.date}</div>
                                            <div className="w-[8%] border-r border-black p-0.5 text-red-700">{test.meta.tot}</div>
                                            <div className="w-[8%] border-r border-black p-0.5 text-red-700">{test.meta.air}</div>
                                            <div className="w-[8%] border-r border-black p-0.5 text-red-800">{test.meta.bot}</div>
                                            <div className="w-[7%] border-r border-black p-0.5 text-red-800">{test.meta.b_rank}</div>
                                            <div className="w-[8%] border-r border-black p-0.5 text-red-800">{test.meta.zoo}</div>
                                            <div className="w-[7%] border-r border-black p-0.5 text-red-800">{test.meta.z_rank}</div>
                                            <div className="w-[8%] border-r border-black p-0.5 text-red-800">{test.meta.phy}</div>
                                            <div className="w-[7%] border-r border-black p-0.5 text-red-800">{test.meta.p_rank}</div>
                                            <div className="w-[8%] border-r border-black p-0.5 text-red-800">{test.meta.chem}</div>
                                            <div className="w-[7%] p-0.5 text-red-800">{test.meta.c_rank}</div>
                                        </div>
                                    </div>

                                    {/* QUESTIONS LIST */}
                                    <div className="questions-container border border-black text-xs">
                                        {test.questions.map((q, qIdx) => (
                                            <div key={qIdx} className="question-block border-b border-black last:border-b-0 break-inside-avoid">
                                                {/* Header Row (Red Bar) */}
                                                <div className="q-header flex items-center bg-[#800000] text-white font-bold h-[24px] border-b border-black">
                                                    <div className="w-[40px] flex items-center justify-center border-r border-white h-full">{q.W_U}</div>
                                                    <div className="w-[40px] flex items-center justify-center border-r border-white h-full">{q.Q_No}</div>
                                                    <div className="flex-1 flex items-center pl-2 border-r border-white h-full overflow-hidden whitespace-nowrap">
                                                        <span className="mr-2">Topic: <span className="text-[#ffffcc]">{q.Topic}</span></span>
                                                    </div>
                                                    <div className="flex-1 flex items-center pl-2 border-r border-white h-full overflow-hidden whitespace-nowrap">
                                                        <span className="mr-2">Sub Topic: <span className="text-[#ffffcc]">{q.Sub_Topic}</span></span>
                                                    </div>
                                                    <div className="w-[60px] flex items-center justify-center h-full bg-[#800000]">
                                                        Key : {q.Key_Value}
                                                    </div>
                                                </div>

                                                {/* Main Content Row */}
                                                <div className="q-content flex h-[180px]">
                                                    {/* Subject Strip (Blue Vertical) */}
                                                    <div className="subject-strip w-[40px] bg-[#4682b4] text-white flex items-center justify-center border-r border-black">
                                                        <span style={{
                                                            writingMode: 'vertical-rl',
                                                            transform: 'rotate(180deg)',
                                                            fontWeight: 'bold',
                                                            fontSize: '11px',
                                                            letterSpacing: '1px'
                                                        }}>
                                                            {q.Subject}
                                                        </span>
                                                    </div>

                                                    {/* Q & A Split */}
                                                    <div className="flex flex-1">
                                                        {/* Question Column */}
                                                        <div className="w-1/2 p-2 relative flex items-start border-r border-black">
                                                            <span className="absolute top-1 left-2 font-bold text-gray-700">{q.Q_No}.</span>
                                                            <div className="w-full h-full flex items-center justify-center pl-6">
                                                                {q.Q_URL ? (
                                                                    <img
                                                                        src={q.Q_URL}
                                                                        alt={`Q`}
                                                                        className="max-w-full max-h-full object-contain"
                                                                    />
                                                                ) : (
                                                                    <span className="text-gray-300 italic">No Question Image</span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Solution Column */}
                                                        <div className="w-1/2 p-2 relative flex items-start">
                                                            <span className="absolute top-1 left-2 font-bold text-gray-700">{q.Q_No}.</span>
                                                            <div className="w-full h-full flex items-center justify-center pl-6">
                                                                {q.S_URL ? (
                                                                    <img
                                                                        src={q.S_URL}
                                                                        alt={`Sol`}
                                                                        className="max-w-full max-h-full object-contain"
                                                                    />
                                                                ) : (
                                                                    <span className="text-gray-400 italic">Conceptual / No Solution Image</span>
                                                                )}
                                                            </div>
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
