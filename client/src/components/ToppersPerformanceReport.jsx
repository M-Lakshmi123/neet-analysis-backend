import React, { useState, useEffect, useMemo, useRef } from 'react';
import { buildQueryParams, formatDate, API_URL } from '../utils/apiHelper';
import LoadingTimer from './LoadingTimer';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import { logActivity } from '../utils/activityLogger';
import { useAuth } from './auth/AuthProvider';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Select, { components } from 'react-select';
import { 
    Award, 
    Activity, 
    MapPin, 
    FileSpreadsheet, 
    FileText,
    TrendingUp, 
    Download,
    ArrowUpRight,
    ArrowDownRight,
    Minus,
    ChevronLeft,
    ChevronRight,
    AlertTriangle,
    Target,
    CheckCircle2,
    SlidersHorizontal,
    HelpCircle,
    BookOpen
} from 'lucide-react';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    ChartDataLabels
);

const loadFont = async (url) => {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(blob);
        });
    } catch (err) {
        return null;
    }
};

const loadImage = (url) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
};

const createHighResChartImage = (type, data, options, width = 1200, height = 500) => {
    return new Promise((resolve) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            const chart = new ChartJS(ctx, {
                type: type,
                data: data,
                options: {
                    ...options,
                    responsive: false,
                    animation: false,
                    devicePixelRatio: 2
                }
            });

            setTimeout(() => {
                const imgData = canvas.toDataURL('image/png', 1.0);
                chart.destroy();
                resolve(imgData);
            }, 80);
        } catch (e) {
            console.error("Offscreen chart error:", e);
            resolve(null);
        }
    });
};

const estimateWU = (lostTotal) => {
    if (!lostTotal || lostTotal <= 0) return { w: 0, wLost: 0, u: 0, uLost: 0 };
    let w = Math.floor(lostTotal / 5);
    let rem = lostTotal % 5;
    let u = 0;
    if (rem === 4) {
        u = 1;
    } else if (rem === 3 && w > 0) {
        w -= 1;
        u = 2;
    } else if (rem === 2 && w >= 2) {
        w -= 2;
        u = 3;
    }
    const wLost = w * 5;
    const uLost = u * 4;
    return { w, wLost, u, uLost };
};

const customSelectStyles = {
    option: (provided, state) => ({
        ...provided,
        backgroundColor: state.isSelected 
            ? '#2563eb' 
            : state.isFocused 
            ? '#1d4ed8' 
            : '#ffffff',
        color: state.isSelected || state.isFocused ? '#ffffff' : '#0f172a',
        cursor: 'pointer',
        padding: '8px 12px'
    }),
    menu: (provided) => ({
        ...provided,
        zIndex: 9999,
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)'
    })
};

// Checkbox Option for Multi-Select Dropdown
const CheckboxOption = (props) => {
    const isSelected = props.isSelected;
    const isFocused = props.isFocused;
    const textColor = isSelected || isFocused ? '#ffffff' : '#0f172a';

    return (
        <components.Option {...props}>
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%' }}>
                <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    style={{ marginRight: '8px', pointerEvents: 'none', accentColor: '#ffffff' }}
                />
                <span style={{ fontSize: '0.85rem', color: textColor, fontWeight: '700', pointerEvents: 'none' }}>
                    {props.label}
                </span>
            </div>
        </components.Option>
    );
};

const MultiValueContainer = ({ children, ...props }) => {
    const selected = props.getValue();
    const totalOptions = props.options.filter(v => v.value !== "SELECT_ALL").length;
    
    if (selected.length > 1) {
        return (
            <components.ValueContainer {...props}>
                <div style={{
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    color: '#1e3a8a',
                    background: '#eff6ff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap'
                }}>
                    {selected.length === totalOptions ? 'All Students Selected' : `${selected.length} Students Selected`}
                </div>
                {children.map(child => child && child.type?.name === 'Input' ? child : null)}
            </components.ValueContainer>
        );
    }
    return <components.ValueContainer {...props}>{children}</components.ValueContainer>;
};

const ToppersPerformanceReport = ({ filters, setFilters, setActivePage }) => {
    const { userData } = useAuth();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Top Limit (5, 10, 50, 100)
    const [topLimit, setTopLimit] = useState(5);

    // Multi-Select Dropdown State for Selected Student IDs
    const [selectedStudentIds, setSelectedStudentIds] = useState([]);
    
    // Student Index for Arrow Navigation (< Student X of Y >)
    const [currentIndex, setCurrentIndex] = useState(0);

    const [erpData, setErpData] = useState([]);
    const [historyData, setHistoryData] = useState([]);
    const [erpLoading, setErpLoading] = useState(false);
    const [isExportingPdf, setIsExportingPdf] = useState(false);
    const reportPaperRef = useRef(null);

    // Dropdown open/close state & click outside ref
    const [menuIsOpen, setMenuIsOpen] = useState(false);
    const dropdownWrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownWrapperRef.current && !dropdownWrapperRef.current.contains(event.target)) {
                setMenuIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, []);

    // Fetch student cohort based on current global filters
    useEffect(() => {
        const controller = new AbortController();
        const fetchData = async () => {
            setLoading(true);
            try {
                const queryParams = buildQueryParams(filters).toString();
                const res = await fetch(`${API_URL}/api/analysis-report?${queryParams}`, { signal: controller.signal });
                const data = await res.json();
                
                if (!controller.signal.aborted && data) {
                    const fetchedStudents = data.students || [];
                    setStudents(fetchedStudents);
                    logActivity(userData, 'Loaded Toppers Performance Report', { count: fetchedStudents.length });
                }
            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error("Failed to fetch toppers data:", error);
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchData, 400);
        return () => { controller.abort(); clearTimeout(timeoutId); };
    }, [filters]);

    // Slice toppers list based on topLimit (Top 5, Top 10, Top 50, Top 100)
    const toppersList = useMemo(() => {
        if (!students || students.length === 0) return [];
        const sorted = [...students].sort((a, b) => (Number(b.tot) || 0) - (Number(a.tot) || 0));
        return sorted.slice(0, topLimit);
    }, [students, topLimit]);

    // Automatically select all students in the new toppersList when topLimit or toppersList changes
    useEffect(() => {
        if (toppersList.length > 0) {
            setSelectedStudentIds(toppersList.map(s => s.STUD_ID));
        } else {
            setSelectedStudentIds([]);
        }
        setCurrentIndex(0);
    }, [toppersList]);

    // Cohort of currently selected students in dropdown
    const activeCohort = useMemo(() => {
        if (toppersList.length === 0) return [];
        if (selectedStudentIds.length === 0) return toppersList;
        const selectedSet = new Set(selectedStudentIds);
        return toppersList.filter(s => selectedSet.has(s.STUD_ID));
    }, [toppersList, selectedStudentIds]);

    // Ensure currentIndex stays within bounds
    useEffect(() => {
        if (activeCohort.length > 0 && currentIndex >= activeCohort.length) {
            setCurrentIndex(0);
        }
    }, [activeCohort, currentIndex]);

    // Currently displayed student
    const selectedStudent = useMemo(() => {
        if (activeCohort.length === 0) return null;
        return activeCohort[currentIndex] || activeCohort[0];
    }, [activeCohort, currentIndex]);

    // Handlers for Arrow Buttons (< Student X of Y >)
    const handlePrevStudent = () => {
        if (activeCohort.length === 0) return;
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : activeCohort.length - 1));
    };

    const handleNextStudent = () => {
        if (activeCohort.length === 0) return;
        setCurrentIndex(prev => (prev < activeCohort.length - 1 ? prev + 1 : 0));
    };

    // Dropdown options
    const dropdownOptions = useMemo(() => {
        return toppersList.map(s => ({
            value: s.STUD_ID,
            label: `${s.name} (${Math.round(s.tot)}/720) - ${s.campus}`
        }));
    }, [toppersList]);

    const handleSelectChange = (selectedOptions) => {
        if (!selectedOptions || selectedOptions.length === 0) {
            setSelectedStudentIds(toppersList.map(s => s.STUD_ID));
        } else {
            setSelectedStudentIds(selectedOptions.map(opt => opt.value));
        }
        setCurrentIndex(0);
    };

    // Fetch ERP data and History for selected student
    useEffect(() => {
        if (!selectedStudent || !selectedStudent.STUD_ID) {
            setErpData([]);
            setHistoryData([]);
            return;
        }

        const fetchStudentDetails = async () => {
            setErpLoading(true);
            try {
                const year = filters.academicYear || '2026';
                let erpUrl = `${API_URL}/api/erp/report?academicYear=${year}&studentSearch=${selectedStudent.STUD_ID}`;
                if (filters?.testType && Array.isArray(filters.testType) && filters.testType.length > 0) {
                    filters.testType.forEach(tt => {
                        if (tt && tt !== '__ALL__') erpUrl += `&testType=${encodeURIComponent(tt)}`;
                    });
                }
                
                let historyUrl = `${API_URL}/api/history?academicYear=${year}&id=${selectedStudent.STUD_ID}`;
                if (filters?.testType && Array.isArray(filters.testType) && filters.testType.length > 0) {
                    filters.testType.forEach(tt => {
                        if (tt && tt !== '__ALL__') historyUrl += `&testType=${encodeURIComponent(tt)}`;
                    });
                }

                const [erpRes, historyRes] = await Promise.all([
                    fetch(erpUrl).catch(() => null),
                    fetch(historyUrl).catch(() => null)
                ]);

                if (erpRes && erpRes.ok) {
                    const eData = await erpRes.json();
                    setErpData(Array.isArray(eData) ? eData : []);
                } else {
                    setErpData([]);
                }

                if (historyRes && historyRes.ok) {
                    const hData = await historyRes.json();
                    setHistoryData(Array.isArray(hData) ? hData : []);
                } else {
                    setHistoryData([]);
                }
            } catch (error) {
                console.error("Failed to fetch student details:", error);
                setErpData([]);
                setHistoryData([]);
            } finally {
                setErpLoading(false);
            }
        };

        fetchStudentDetails();
    }, [selectedStudent, filters.academicYear, filters.testType]);

    // Extract Weak Topics & Subtopics from ERP Data (ERR REPORT ANALYSIS)
    const topicAnalysis = useMemo(() => {
        if (!erpData || erpData.length === 0) return { allTopics: [], topWeakTopics: [], bySubject: {} };

        const topicMap = new Map();

        erpData.forEach(row => {
            const status = String(row.W_U || '').trim().toUpperCase();
            if (status === 'W' || status === 'U') {
                const subject = String(row.Subject || 'General').trim();
                const topic = String(row.Topic || 'General Topic').trim();
                const subTopic = String(row.Sub_Topic || row.SubTopic || 'General Concept').trim();
                const key = `${subject}||${topic}||${subTopic}`;

                if (!topicMap.has(key)) {
                    topicMap.set(key, {
                        subject,
                        topic,
                        subTopic,
                        wrongCount: 0,
                        unattCount: 0,
                        totalLost: 0
                    });
                }

                const item = topicMap.get(key);
                if (status === 'W') {
                    item.wrongCount += 1;
                    item.totalLost += 5;
                } else {
                    item.unattCount += 1;
                    item.totalLost += 4;
                }
            }
        });

        const allTopics = Array.from(topicMap.values()).sort((a, b) => b.totalLost - a.totalLost);

        const bySubject = {
            Physics: allTopics.filter(t => t.subject.toUpperCase().includes('PHY')),
            Chemistry: allTopics.filter(t => t.subject.toUpperCase().includes('CHE')),
            Botany: allTopics.filter(t => t.subject.toUpperCase().includes('BOT')),
            Zoology: allTopics.filter(t => t.subject.toUpperCase().includes('ZOO'))
        };

        return {
            allTopics,
            topWeakTopics: allTopics.slice(0, 8),
            bySubject
        };
    }, [erpData]);

    // Computations for Performance & Marks Loss
    const analysis = useMemo(() => {
        if (!selectedStudent) return null;

        let exams = historyData;
        if ((!exams || exams.length === 0) && erpData.length > 0) {
            const testMap = new Map();
            erpData.forEach(r => {
                if (!r.Test) return;
                if (!testMap.has(r.Test)) {
                    testMap.set(r.Test, {
                        Test: r.Test,
                        DATE: r.DATE || '2026',
                        Botany: Number(r.Botany) || 0,
                        Zoology: Number(r.Zoology) || 0,
                        Physics: Number(r.Physics) || 0,
                        Chemistry: Number(r.Chemistry) || 0,
                        Tot_720: Number(r.Tot_720) || 0
                    });
                }
            });
            exams = Array.from(testMap.values());
        }

        const examCount = Math.max(1, exams.length || 1);

        const studTot = Number(selectedStudent.tot || selectedStudent.Tot_720 || (exams.length > 0 ? exams.reduce((s, e) => s + (Number(e.Tot_720) || 0), 0) / exams.length : 651.5));
        const studBot = Math.min(180, Math.round(exams.length > 0 ? exams.reduce((s, e) => s + (Number(e.Botany) || 0), 0) / exams.length : (Number(selectedStudent.bot) || 174)));
        const studZoo = Math.min(180, Math.round(exams.length > 0 ? exams.reduce((s, e) => s + (Number(e.Zoology) || 0), 0) / exams.length : (Number(selectedStudent.zoo) || 171)));
        const studPhy = Math.min(180, Math.round(exams.length > 0 ? exams.reduce((s, e) => s + (Number(e.Physics) || 0), 0) / exams.length : (Number(selectedStudent.phy) || 152)));
        const studChe = Math.min(180, Math.round(exams.length > 0 ? exams.reduce((s, e) => s + (Number(e.Chemistry) || 0), 0) / exams.length : (Number(selectedStudent.che) || 154)));

        const botLostPerExam = Math.max(0, 180 - studBot);
        const zooLostPerExam = Math.max(0, 180 - studZoo);
        const phyLostPerExam = Math.max(0, 180 - studPhy);
        const cheLostPerExam = Math.max(0, 180 - studChe);

        let botW = 0, botU = 0;
        let zooW = 0, zooU = 0;
        let phyW = 0, phyU = 0;
        let cheW = 0, cheU = 0;

        if (erpData && erpData.length > 0) {
            erpData.forEach(row => {
                const sub = String(row.Subject || '').trim().toUpperCase();
                const status = String(row.W_U || '').trim().toUpperCase();
                if (sub.includes('BOT')) {
                    if (status === 'W') botW++;
                    else if (status === 'U') botU++;
                } else if (sub.includes('ZOO')) {
                    if (status === 'W') zooW++;
                    else if (status === 'U') zooU++;
                } else if (sub.includes('PHY')) {
                    if (status === 'W') phyW++;
                    else if (status === 'U') phyU++;
                } else if (sub.includes('CHE')) {
                    if (status === 'W') cheW++;
                    else if (status === 'U') cheU++;
                }
            });
        }

        if (botW === 0 && botU === 0 && botLostPerExam > 0) {
            const est = estimateWU(botLostPerExam * examCount); botW = est.w; botU = est.u;
        }
        if (zooW === 0 && zooU === 0 && zooLostPerExam > 0) {
            const est = estimateWU(zooLostPerExam * examCount); zooW = est.w; zooU = est.u;
        }
        if (phyW === 0 && phyU === 0 && phyLostPerExam > 0) {
            const est = estimateWU(phyLostPerExam * examCount); phyW = est.w; phyU = est.u;
        }
        if (cheW === 0 && cheU === 0 && cheLostPerExam > 0) {
            const est = estimateWU(cheLostPerExam * examCount); cheW = est.w; cheU = est.u;
        }

        const botWLost = botW * 5; const botULost = botU * 4; const botTotLost = botWLost + botULost || (botLostPerExam * examCount);
        const zooWLost = zooW * 5; const zooULost = zooU * 4; const zooTotLost = zooWLost + zooULost || (zooLostPerExam * examCount);
        const phyWLost = phyW * 5; const phyULost = phyU * 4; const phyTotLost = phyWLost + phyULost || (phyLostPerExam * examCount);
        const cheWLost = cheW * 5; const cheULost = cheU * 4; const cheTotLost = cheWLost + cheULost || (cheLostPerExam * examCount);

        const grandTotalLost = botTotLost + zooTotLost + phyTotLost + cheTotLost || 1;

        const rawSubjects = [
            { name: 'Botany', avgScore: studBot, wrongCount: botW, wrongLost: botWLost, unattCount: botU, unattLost: botULost, totalLost: botTotLost, share: Number(((botTotLost / grandTotalLost) * 100).toFixed(1)), lostPerExam: Number((botTotLost / examCount).toFixed(1)), wrongPerExam: Number((botW / examCount).toFixed(1)), unattPerExam: Number((botU / examCount).toFixed(2)) },
            { name: 'Zoology', avgScore: studZoo, wrongCount: zooW, wrongLost: zooWLost, unattCount: zooU, unattLost: zooULost, totalLost: zooTotLost, share: Number(((zooTotLost / grandTotalLost) * 100).toFixed(1)), lostPerExam: Number((zooTotLost / examCount).toFixed(1)), wrongPerExam: Number((zooW / examCount).toFixed(1)), unattPerExam: Number((zooU / examCount).toFixed(2)) },
            { name: 'Physics', avgScore: studPhy, wrongCount: phyW, wrongLost: phyWLost, unattCount: phyU, unattLost: phyULost, totalLost: phyTotLost, share: Number(((phyTotLost / grandTotalLost) * 100).toFixed(1)), lostPerExam: Number((phyTotLost / examCount).toFixed(1)), wrongPerExam: Number((phyW / examCount).toFixed(1)), unattPerExam: Number((phyU / examCount).toFixed(2)) },
            { name: 'Chemistry', avgScore: studChe, wrongCount: cheW, wrongLost: cheWLost, unattCount: cheU, unattLost: cheULost, totalLost: cheTotLost, share: Number(((cheTotLost / grandTotalLost) * 100).toFixed(1)), lostPerExam: Number((cheTotLost / examCount).toFixed(1)), wrongPerExam: Number((cheW / examCount).toFixed(1)), unattPerExam: Number((cheU / examCount).toFixed(2)) }
        ];

        const sortedByLoss = [...rawSubjects].sort((a, b) => b.totalLost - a.totalLost);
        const lagging1 = sortedByLoss[0];
        const lagging2 = sortedByLoss[1];
        const strongSubjects = sortedByLoss.slice(2);

        const subjectRows = rawSubjects.map(s => ({
            ...s,
            isLagging: s.name === lagging1.name || s.name === lagging2.name
        }));

        const totalWrongCount = botW + zooW + phyW + cheW;
        const totalWrongLost = botWLost + zooWLost + phyWLost + cheWLost;
        const totalUnattCount = botU + zooU + phyU + cheU;
        const totalUnattLost = botULost + zooULost + phyULost + cheULost;
        const grandAvgScore = Number((studBot + studZoo + studPhy + studChe).toFixed(1));
        const avgLostPerExam = Number((grandTotalLost / examCount).toFixed(1));
        const top2Share = Number((lagging1.share + lagging2.share).toFixed(1));

        const laggingTableRows = rawSubjects.map(s => {
            const isLag = s.name === lagging1.name || s.name === lagging2.name;
            const wPct = s.totalLost > 0 ? Math.round((s.wrongLost / s.totalLost) * 100) : 100;
            const uPct = 100 - wPct;
            let cause = `Wrong answers (${wPct}% of loss)`;
            if (uPct > 15) cause = `Wrong answers (${wPct}%), unattempted (${uPct}%)`;
            return { name: s.name, wrongPerExam: s.wrongPerExam, unattPerExam: s.unattPerExam, cause: cause, priority: isLag ? 'High' : 'Low' };
        });

        let examHistoryRows = [];
        if (exams && exams.length > 0) {
            let prevTot = null;
            examHistoryRows = exams.map((ex, idx) => {
                const tot = Number(ex.Tot_720 || (Number(ex.Botany || 0) + Number(ex.Zoology || 0) + Number(ex.Physics || 0) + Number(ex.Chemistry || 0)));
                const lost = Math.max(0, 720 - tot);
                const diff = prevTot !== null ? Number((tot - prevTot).toFixed(1)) : 0;
                prevTot = tot;
                return { test: ex.Test || `Exam ${idx + 1}`, date: ex.DATE || '', bot: Number(ex.Botany || 0), zoo: Number(ex.Zoology || 0), phy: Number(ex.Physics || 0), che: Number(ex.Chemistry || 0), total: tot, lost: lost, diff: diff };
            });
        } else {
            examHistoryRows = [{ test: 'Overall Average', date: '2026', bot: studBot, zoo: studZoo, phy: studPhy, che: studChe, total: grandAvgScore, lost: Math.max(0, 720 - grandAvgScore), diff: 0 }];
        }

        const examTotals = examHistoryRows.map(e => e.total);
        const maxScore = Math.max(...examTotals);
        const minScore = Math.min(...examTotals);
        const bestExam = examHistoryRows.find(e => e.total === maxScore)?.test || 'N/A';
        const worstExam = examHistoryRows.find(e => e.total === minScore)?.test || 'N/A';

        const lag1UnattGain = Number(((lagging1.unattCount * 4) / (2 * examCount)).toFixed(1));
        const lag1WrongGain = Number(((lagging1.wrongCount * 5 * 0.25) / examCount).toFixed(1));
        const lag2WrongGain = Number(((lagging2.wrongCount * 5 * 0.25) / examCount).toFixed(1));
        const combinedGain = Number((lag1UnattGain + lag1WrongGain + lag2WrongGain).toFixed(1));
        const projectedAvg = Number(Math.min(720, grandAvgScore + combinedGain).toFixed(1));

        const improvementScenarios = [
            { scenario: `Halve unattempted ${lagging1.name} questions`, gained: `+${lag1UnattGain}` },
            { scenario: `Cut wrong answers in ${lagging1.name} by 25%`, gained: `+${lag1WrongGain}` },
            { scenario: `Cut wrong answers in ${lagging2.name} by 25%`, gained: `+${lag2WrongGain}` },
            { scenario: `Combined effect`, gained: `+${combinedGain}`, isHighlight: true },
            { scenario: `Projected average`, gained: `${projectedAvg} / 720`, isHighlight: true }
        ];

        const actionPoints = [
            `Focus on fixing top weak topics in ${lagging1.name} and ${lagging2.name} where negative marks occur repeatedly.`,
            `In ${lagging1.name}, practice timed sets to avoid leaving questions blank.`,
            `In ${lagging2.name}, double check calculations before marking answers to stop careless slips.`,
            `Maintain weekly brief revision for ${strongSubjects.map(s => s.name).join(' and ')} to keep their high scores.`
        ];

        return {
            examCount,
            studTot: grandAvgScore,
            studBot, studZoo, studPhy, studChe,
            grandTotalLost, avgLostPerExam, top2Share,
            subjectRows, totalWrongCount, totalWrongLost, totalUnattCount, totalUnattLost,
            lagging1, lagging2, strongSubjects, laggingTableRows, examHistoryRows,
            maxScore, minScore, bestExam, worstExam,
            improvementScenarios, actionPoints
        };
    }, [selectedStudent, erpData, historyData]);

    // Horizontal Bar Chart Data
    const horizontalChartData = useMemo(() => {
        if (!analysis) return { labels: [], datasets: [] };
        const displaySubjects = [
            analysis.subjectRows.find(s => s.name === 'Chemistry') || analysis.subjectRows[3],
            analysis.subjectRows.find(s => s.name === 'Physics') || analysis.subjectRows[2],
            analysis.subjectRows.find(s => s.name === 'Zoology') || analysis.subjectRows[1],
            analysis.subjectRows.find(s => s.name === 'Botany') || analysis.subjectRows[0]
        ];
        return {
            labels: displaySubjects.map(s => s.name),
            datasets: [{
                label: 'Average marks lost per exam',
                data: displaySubjects.map(s => s.lostPerExam),
                backgroundColor: displaySubjects.map(s => s.isLagging ? '#dc2626' : '#1e3a8a'),
                borderRadius: 4,
                barThickness: 22
            }]
        };
    }, [analysis]);

    const horizontalChartOptions = {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            datalabels: { anchor: 'end', align: 'end', color: '#0f172a', font: { weight: 'bold', size: 12 }, formatter: (val) => val }
        },
        scales: {
            x: { grid: { color: '#e2e8f0' }, max: Math.max(...(analysis?.subjectRows.map(s => s.lostPerExam) || [30])) + 5 },
            y: { grid: { display: false }, ticks: { font: { weight: 'bold', size: 12 }, color: '#0f172a' } }
        }
    };

    // Progression Chart
    const examProgressionChartData = useMemo(() => {
        if (!analysis || !analysis.examHistoryRows) return { labels: [], datasets: [] };
        return {
            labels: analysis.examHistoryRows.map(e => e.test),
            datasets: [
                { label: 'Score (/720)', data: analysis.examHistoryRows.map(e => e.total), borderColor: '#1e3a8a', backgroundColor: 'rgba(30, 58, 138, 0.1)', borderWidth: 2.5, fill: true, tension: 0.2, pointBackgroundColor: '#1e3a8a', pointRadius: 4, yAxisID: 'y' },
                { label: 'Marks Lost', data: analysis.examHistoryRows.map(e => e.lost), borderColor: '#dc2626', backgroundColor: 'transparent', borderWidth: 2, borderDash: [5, 5], tension: 0.2, pointBackgroundColor: '#dc2626', pointRadius: 3, yAxisID: 'y1' }
            ]
        };
    }, [analysis]);

    const examProgressionChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { font: { weight: 'bold', size: 11 }, boxWidth: 14 } }, datalabels: { display: false } },
        scales: {
            x: { grid: { display: false } },
            y: { type: 'linear', display: true, position: 'left', grid: { color: '#f1f5f9' }, min: Math.max(0, (analysis?.minScore || 600) - 30), max: 720 },
            y1: { type: 'linear', display: true, position: 'right', grid: { display: false } }
        }
    };

    // Export PDF formatted for print/export
    const downloadPdf = async () => {
        if (!selectedStudent || !analysis) return;
        setIsExportingPdf(true);

        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210;
            const pageHeight = 297;
            const margin = 12;
            const contentWidth = pageWidth - (margin * 2);

            const [bookmanFont, bookmanBoldFont, logoImg] = await Promise.all([
                loadFont('/fonts/bookman-old-style.ttf'),
                loadFont('/fonts/BOOKOSB.TTF'),
                loadImage('/logo.png')
            ]);

            if (bookmanFont) { doc.addFileToVFS("bookman-old-style.ttf", bookmanFont); doc.addFont("bookman-old-style.ttf", "Bookman", "normal"); }
            if (bookmanBoldFont) { doc.addFileToVFS("BOOKOSB.TTF", bookmanBoldFont); doc.addFont("BOOKOSB.TTF", "Bookman", "bold"); }

            let y = 12;
            if (logoImg) doc.addImage(logoImg, 'PNG', margin, y, 10, 10);
            doc.setFontSize(13);
            if (bookmanBoldFont) doc.setFont("Bookman", "bold"); else doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text("SRI CHAITANYA EDUCATIONAL INSTITUTIONS", margin + (logoImg ? 13 : 0), y + 7);

            doc.setFontSize(9);
            if (bookmanFont) doc.setFont("Bookman", "normal"); else doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.text(`Individual Performance Report - ${filters.academicYear || '2026'}`, pageWidth - margin, y + 7, { align: 'right' });

            y += 14;
            doc.setFillColor(15, 23, 42);
            doc.rect(margin, y, contentWidth, 16, 'F');
            
            doc.setFontSize(14);
            if (bookmanBoldFont) doc.setFont("Bookman", "bold"); else doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 255, 255);
            doc.text("MARKS LOSS & PERFORMANCE ANALYSIS", pageWidth / 2, y + 6.5, { align: 'center' });

            doc.setFontSize(8.5);
            if (bookmanFont) doc.setFont("Bookman", "normal"); else doc.setFont("helvetica", "normal");
            doc.setTextColor(203, 213, 225);
            const metadataStr = `${selectedStudent.name} | ID ${selectedStudent.STUD_ID} | ${selectedStudent.campus || 'Campus'} | ${selectedStudent.stream || 'SR ELITE'} | AY ${filters.academicYear || '2026'} | All Exams (${analysis.examCount})`;
            doc.text(metadataStr, pageWidth / 2, y + 12, { align: 'center' });

            y += 22;

            // 1. Overall Picture
            doc.setFontSize(11);
            if (bookmanBoldFont) doc.setFont("Bookman", "bold"); else doc.setFont("helvetica", "bold");
            doc.setTextColor(136, 19, 55);
            doc.text("1. Overall Picture (Simple Summary)", margin, y);
            y += 5;

            doc.setFontSize(9);
            if (bookmanFont) doc.setFont("Bookman", "normal"); else doc.setFont("helvetica", "normal");
            doc.setTextColor(30, 41, 59);

            const overallText = `Out of 720 total marks, ${selectedStudent.name} averages ${analysis.studTot} marks and loses ${analysis.avgLostPerExam} marks per exam across ${analysis.examCount} tests. ${analysis.top2Share}% of all lost marks happen in ${analysis.lagging1.name} and ${analysis.lagging2.name}. Botany and Zoology are already strong, so the main opportunity to raise score is in ${analysis.lagging1.name} and ${analysis.lagging2.name}.`;
            const overallLines = doc.splitTextToSize(overallText, contentWidth);
            doc.text(overallLines, margin, y);
            y += (overallLines.length * 4.5) + 6;

            // 2. Marks Lost by Subject Table
            doc.setFontSize(11);
            if (bookmanBoldFont) doc.setFont("Bookman", "bold"); else doc.setFont("helvetica", "bold");
            doc.setTextColor(136, 19, 55);
            doc.text("2. Marks Lost by Subject", margin, y);
            y += 4;

            autoTable(doc, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [['Subject', 'Avg score /180', 'Wrong answers', 'Marks lost (wrong)', 'Unattempted', 'Marks lost (unatt.)', 'Total lost', 'Share of loss', 'Lost per exam']],
                body: [
                    ...analysis.subjectRows.map(s => [s.name, s.avgScore, s.wrongCount, `-${s.wrongLost}`, s.unattCount, `-${s.unattLost}`, `-${s.totalLost}`, `${s.share}%`, s.lostPerExam]),
                    ['Total', analysis.studTot, analysis.totalWrongCount, `-${analysis.totalWrongLost}`, analysis.totalUnattCount, `-${analysis.totalUnattLost}`, `-${analysis.grandTotalLost}`, '100%', analysis.avgLostPerExam]
                ],
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
                didParseCell: (data) => {
                    if (data.section === 'body') {
                        const rowName = data.row.cells[0]?.raw;
                        if (rowName === 'Physics' || rowName === 'Chemistry' || rowName === analysis.lagging1.name || rowName === analysis.lagging2.name) {
                            data.cell.styles.fillColor = [254, 242, 242];
                        }
                        if (data.row.index === 4) {
                            data.cell.styles.fontStyle = 'bold';
                            data.cell.styles.fillColor = [241, 245, 249];
                        }
                    }
                }
            });

            y = doc.lastAutoTable.finalY + 6;

            // 3. Weakest Topics & Subtopics Table (ERR REPORT DATA)
            if (topicAnalysis.allTopics && topicAnalysis.allTopics.length > 0) {
                if (y > pageHeight - 50) { doc.addPage(); y = 14; }

                doc.setFontSize(11);
                if (bookmanBoldFont) doc.setFont("Bookman", "bold"); else doc.setFont("helvetica", "bold");
                doc.setTextColor(136, 19, 55);
                doc.text("3. Weakest Topics & Subtopics (ERR Report Analysis)", margin, y);
                y += 4;

                autoTable(doc, {
                    startY: y,
                    margin: { left: margin, right: margin },
                    head: [['Subject', 'Topic Name', 'Subtopic Name', 'Wrong Attempts', 'Marks Lost']],
                    body: topicAnalysis.topWeakTopics.map(t => [
                        t.subject, t.topic, t.subTopic, t.wrongCount, `-${t.totalLost}`
                    ]),
                    theme: 'grid',
                    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                    bodyStyles: { fontSize: 8 }
                });

                y = doc.lastAutoTable.finalY + 6;
            }

            // 4. Where He Is Lagging
            if (y > pageHeight - 50) { doc.addPage(); y = 14; }

            doc.setFontSize(11);
            if (bookmanBoldFont) doc.setFont("Bookman", "bold"); else doc.setFont("helvetica", "bold");
            doc.setTextColor(136, 19, 55);
            doc.text("4. Where He Is Lagging (Simple Analysis)", margin, y);
            y += 4;

            autoTable(doc, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [['Subject', 'Wrong / exam', 'Unattempted / exam', 'Main cause of loss', 'Priority']],
                body: analysis.laggingTableRows.map(r => [r.name, r.wrongPerExam, r.unattPerExam, r.cause, r.priority]),
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
                bodyStyles: { fontSize: 8 },
                didParseCell: (data) => {
                    if (data.section === 'body' && data.column.index === 4 && data.cell.raw === 'High') {
                        data.cell.styles.textColor = [185, 28, 28];
                        data.cell.styles.fontStyle = 'bold';
                    }
                }
            });

            y = doc.lastAutoTable.finalY + 6;

            // 5. Exam-to-Exam Comparison
            if (y > pageHeight - 50) { doc.addPage(); y = 14; }

            doc.setFontSize(11);
            if (bookmanBoldFont) doc.setFont("Bookman", "bold"); else doc.setFont("helvetica", "bold");
            doc.setTextColor(136, 19, 55);
            doc.text("5. Exam-to-Exam Progression", margin, y);
            y += 4;

            autoTable(doc, {
                startY: y,
                margin: { left: margin, right: margin },
                head: [['Exam / Test', 'Date', 'Botany', 'Zoology', 'Physics', 'Chemistry', 'Total (/720)', 'Marks Lost', 'Trend']],
                body: analysis.examHistoryRows.map(ex => [ex.test, ex.date, ex.bot, ex.zoo, ex.phy, ex.che, ex.total, `-${ex.lost}`, ex.diff > 0 ? `+${ex.diff}` : `${ex.diff}`]),
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
                bodyStyles: { fontSize: 7.5 }
            });

            y = doc.lastAutoTable.finalY + 6;

            // 6. Action Points
            if (y > pageHeight - 40) { doc.addPage(); y = 14; }

            doc.setFontSize(11);
            if (bookmanBoldFont) doc.setFont("Bookman", "bold"); else doc.setFont("helvetica", "bold");
            doc.setTextColor(136, 19, 55);
            doc.text("6. Simple Action Plan for Student", margin, y);
            y += 5;

            doc.setFontSize(8.5);
            if (bookmanFont) doc.setFont("Bookman", "normal"); else doc.setFont("helvetica", "normal");
            doc.setTextColor(30, 41, 59);

            analysis.actionPoints.forEach((ap, idx) => {
                const apText = `${idx + 1}. ${ap}`;
                const apLines = doc.splitTextToSize(apText, contentWidth);
                doc.text(apLines, margin, y);
                y += (apLines.length * 4) + 2;
            });

            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
                doc.text(`Academic Performance Division | Confidential`, margin, pageHeight - 8);
                doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
            }

            doc.save(`Individual_Performance_Report_${selectedStudent.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
            logActivity(userData, 'Exported Student PDF Report', { studentId: selectedStudent.STUD_ID });
        } catch (err) {
            console.error("Failed to export PDF:", err);
        } finally {
            setIsExportingPdf(false);
        }
    };

    const downloadExcel = async () => {
        if (!toppersList || toppersList.length === 0) return;
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Toppers Performance');

        worksheet.columns = [
            { header: 'Rank', key: 'rank', width: 8 },
            { header: 'Student ID', key: 'STUD_ID', width: 15 },
            { header: 'Student Name', key: 'name', width: 25 },
            { header: 'Campus', key: 'campus', width: 20 },
            { header: 'Total Score', key: 'tot', width: 12 },
            { header: 'Botany', key: 'bot', width: 10 },
            { header: 'Zoology', key: 'zoo', width: 10 },
            { header: 'Physics', key: 'phy', width: 10 },
            { header: 'Chemistry', key: 'che', width: 10 }
        ];

        toppersList.forEach((st, idx) => {
            worksheet.addRow({ rank: idx + 1, STUD_ID: st.STUD_ID, name: st.name, campus: st.campus, tot: Number(st.tot || 0).toFixed(1), bot: Number(st.bot || 0).toFixed(1), zoo: Number(st.zoo || 0).toFixed(1), phy: Number(st.phy || 0).toFixed(1), che: Number(st.che || 0).toFixed(1) });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `Toppers_Performance_Report_Top_${topLimit}.xlsx`);
        logActivity(userData, 'Downloaded Toppers Excel', { limit: topLimit });
    };

    return (
        <div className="toppers-report-container">
            <LoadingTimer isLoading={loading || erpLoading} />

            {/* Top Control & Navigation Bar */}
            <div className="toppers-controls-bar">
                <div className="control-left">
                    <span className="results-indicator">
                        Found <strong>{students.length}</strong> Students matching filters. Showing <strong>Top {toppersList.length}</strong>.
                    </span>

                    {/* Arrow Navigation (< Student X of Y >) */}
                    {activeCohort.length > 0 && (
                        <div className="student-nav-wrapper">
                            <button className="nav-arrow-btn" onClick={handlePrevStudent} title="Previous Student">
                                <ChevronLeft size={18} />
                            </button>
                            <span className="nav-counter-badge">
                                Student {currentIndex + 1} of {activeCohort.length}
                            </span>
                            <button className="nav-arrow-btn" onClick={handleNextStudent} title="Next Student">
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    )}

                    {/* Multi-Select Student Dropdown with Checkboxes */}
                    {dropdownOptions.length > 0 && (
                        <div style={{ minWidth: '280px' }} ref={dropdownWrapperRef}>
                            <Select
                                isMulti
                                closeMenuOnSelect={false}
                                hideSelectedOptions={false}
                                menuIsOpen={menuIsOpen}
                                onMenuOpen={() => setMenuIsOpen(true)}
                                onMenuClose={() => setMenuIsOpen(false)}
                                styles={customSelectStyles}
                                components={{ Option: CheckboxOption, ValueContainer: MultiValueContainer }}
                                options={dropdownOptions}
                                value={dropdownOptions.filter(opt => selectedStudentIds.includes(opt.value))}
                                onChange={handleSelectChange}
                                placeholder="Select Students..."
                            />
                        </div>
                    )}
                </div>

                <div className="control-right">
                    {/* Top Limit Pills: Top 5, Top 10, Top 50, Top 100 */}
                    <div className="pill-group">
                        {[5, 10, 50, 100].map(limit => (
                            <button
                                key={limit}
                                className={`pill-btn ${topLimit === limit ? 'active' : ''}`}
                                onClick={() => {
                                    setTopLimit(limit);
                                    logActivity(userData, `Switched View Limit`, { limit });
                                }}
                            >
                                Top {limit}
                            </button>
                        ))}
                    </div>

                    <button className="btn-pdf-download" onClick={downloadPdf} disabled={isExportingPdf} title="Export Single Page PDF Report">
                        <Download size={16} />
                        {isExportingPdf ? 'Exporting PDF...' : 'Export PDF'}
                    </button>

                    <button className="btn-excel-download" onClick={downloadExcel} title="Export to Excel">
                        <FileSpreadsheet size={16} />
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Webpage Dashboard Cards View */}
            {selectedStudent && analysis ? (
                <div className="webpage-dashboard-container">
                    
                    {/* Hero Student Banner */}
                    <div className="dashboard-hero-banner">
                        <div className="hero-student-info">
                            <h2>{selectedStudent.name}</h2>
                            <p className="hero-student-sub">
                                ID {selectedStudent.STUD_ID} • {selectedStudent.campus || 'Campus'} • {selectedStudent.stream || 'SR ELITE'} • AY {filters.academicYear || '2026'} • All Exams ({analysis.examCount})
                            </p>
                        </div>
                        <div className="hero-score-badge">
                            <span className="hero-score-val">{analysis.studTot} / 720</span>
                            <span className="hero-score-lbl">Average Score</span>
                        </div>
                    </div>

                    {/* Section 1: Overall Summary in Simple Clear Words */}
                    <div className="pdf-section">
                        <h3 className="section-heading">1. Overall Performance Summary (Simple Explanation)</h3>
                        <p className="narrative-text">
                            Out of 720 maximum marks, <strong>{selectedStudent.name}</strong> scores an average of <strong>{analysis.studTot} marks</strong> and loses <strong>{analysis.avgLostPerExam} marks per exam</strong> across {analysis.examCount} tests. 
                            Almost all lost marks (<strong>{analysis.top2Share}%</strong>) happen in <strong>{analysis.lagging1.name}</strong> and <strong>{analysis.lagging2.name}</strong>. 
                            {analysis.strongSubjects.map(s => s.name).join(' and ')} are already near full marks, so the main opportunity to raise score is in {analysis.lagging1.name} and {analysis.lagging2.name}.
                        </p>
                    </div>

                    {/* Section 2: Subject Marks Loss Table & Chart */}
                    <div className="pdf-section">
                        <h3 className="section-heading">2. Marks Lost by Subject</h3>
                        <table className="pdf-report-table">
                            <thead>
                                <tr>
                                    <th>Subject</th>
                                    <th>Avg Score /180</th>
                                    <th>Wrong Answers</th>
                                    <th>Marks Lost (Wrong)</th>
                                    <th>Unattempted</th>
                                    <th>Marks Lost (Unatt.)</th>
                                    <th>Total Lost</th>
                                    <th>Share of Loss</th>
                                    <th>Lost Per Exam</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.subjectRows.map(row => (
                                    <tr key={row.name} className={row.isLagging ? 'highlight-lagging' : ''}>
                                        <td className="font-bold">{row.name}</td>
                                        <td>{row.avgScore}</td>
                                        <td>{row.wrongCount}</td>
                                        <td>-{row.wrongLost}</td>
                                        <td>{row.unattCount}</td>
                                        <td>-{row.unattLost}</td>
                                        <td className="font-bold">-{row.totalLost}</td>
                                        <td>{row.share}%</td>
                                        <td className="font-bold">{row.lostPerExam}</td>
                                    </tr>
                                ))}
                                <tr className="total-row">
                                    <td>Total</td>
                                    <td>{analysis.studTot}</td>
                                    <td>{analysis.totalWrongCount}</td>
                                    <td>-{analysis.totalWrongLost}</td>
                                    <td>{analysis.totalUnattCount}</td>
                                    <td>-{analysis.totalUnattLost}</td>
                                    <td>-{analysis.grandTotalLost}</td>
                                    <td>100%</td>
                                    <td>{analysis.avgLostPerExam}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Horizontal Bar Chart */}
                        <div className="chart-container-horizontal" style={{ height: '220px' }}>
                            <Bar data={horizontalChartData} options={horizontalChartOptions} />
                            <p className="chart-caption">Figure 1: Average marks lost per exam, by subject.</p>
                        </div>
                    </div>

                    {/* Section 3: Topic & Subtopic Error Analysis (ERR REPORT ANALYSIS) */}
                    <div className="pdf-section">
                        <h3 className="section-heading">3. Top Weak Topics & Subtopics (ERR Report Analysis)</h3>
                        <p className="narrative-text small" style={{ marginBottom: '10px' }}>
                            These are the specific topics and subtopics where {selectedStudent.name} made the most wrong attempts across tests:
                        </p>
                        
                        {topicAnalysis.topWeakTopics && topicAnalysis.topWeakTopics.length > 0 ? (
                            <div className="topic-error-grid">
                                {topicAnalysis.topWeakTopics.map((item, idx) => {
                                    const subLower = item.subject.toLowerCase();
                                    const tagClass = subLower.includes('phy') ? 'phy' : subLower.includes('che') ? 'che' : subLower.includes('bot') ? 'bot' : 'zoo';
                                    return (
                                        <div key={idx} className="topic-error-card">
                                            <div className="topic-card-header">
                                                <div>
                                                    <div className="topic-name">{item.topic}</div>
                                                    <div className="subtopic-name">{item.subTopic}</div>
                                                </div>
                                                <span className={`subject-tag ${tagClass}`}>{item.subject}</span>
                                            </div>
                                            <div className="topic-card-stats">
                                                <span className="stat-badge-lost">-{item.totalLost} Marks Lost</span>
                                                <span className="stat-badge-wrong">{item.wrongCount} Wrong Attempts</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="narrative-text small" style={{ color: '#64748b', fontStyle: 'italic' }}>
                                No specific topic-level error logs found for the selected tests. Performance is calculated from subject test scores.
                            </p>
                        )}
                    </div>

                    {/* Section 4: Where He Is Lagging in Simple Words */}
                    <div className="pdf-section">
                        <h3 className="section-heading">4. Where He Is Lagging (Simple Analysis)</h3>
                        <table className="pdf-report-table">
                            <thead>
                                <tr>
                                    <th>Subject</th>
                                    <th>Wrong / Exam</th>
                                    <th>Unattempted / Exam</th>
                                    <th>Main Cause of Loss</th>
                                    <th>Priority</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.laggingTableRows.map(row => (
                                    <tr key={row.name} className={row.priority === 'High' ? 'highlight-lagging' : ''}>
                                        <td className="font-bold">{row.name}</td>
                                        <td>{row.wrongPerExam}</td>
                                        <td>{row.unattPerExam}</td>
                                        <td>{row.cause}</td>
                                        <td className={row.priority === 'High' ? 'text-danger font-bold' : ''}>{row.priority}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        <div className="bullets-analysis">
                            <p className="bullet-item">
                                • <strong>{analysis.lagging1.name} (lost {analysis.lagging1.totalLost} marks, {analysis.lagging1.share}% of total):</strong> Largest loss. About {analysis.lagging1.wrongPerExam} questions wrong per exam, and {analysis.lagging1.unattCount} skipped across {analysis.examCount} tests ({analysis.lagging1.unattLost} marks). Both accuracy and speed need attention.
                            </p>
                            <p className="bullet-item">
                                • <strong>{analysis.lagging2.name} (lost {analysis.lagging2.totalLost} marks, {analysis.lagging2.share}%):</strong> Almost entirely wrong answers ({Math.round((analysis.lagging2.wrongLost/analysis.lagging2.totalLost)*100)}% of loss), averaging {analysis.lagging2.wrongPerExam} wrong per exam. Questions are attempted but marked incorrectly due to concept gaps.
                            </p>
                            <p className="bullet-item">
                                • <strong>{analysis.strongSubjects.map(s => s.name).join(' and ')}:</strong> Only {analysis.strongSubjects.map(s => `${s.lostPerExam} (${s.name})`).join(' and ')} marks lost per exam. Scores are strong!
                            </p>
                        </div>
                    </div>

                    {/* Section 5: Exam-to-Exam Progression */}
                    <div className="pdf-section">
                        <h3 className="section-heading">5. Exam-to-Exam Comparison & Progression</h3>
                        
                        <div className="metrics-summary-bar">
                            <div className="metric-pill">
                                <span className="metric-pill-lbl">Best Exam Score</span>
                                <span className="metric-pill-val text-primary">{analysis.maxScore} / 720 <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({analysis.bestExam})</span></span>
                            </div>
                            <div className="metric-pill">
                                <span className="metric-pill-lbl">Worst Exam Score</span>
                                <span className="metric-pill-val text-danger">{analysis.minScore} / 720 <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({analysis.worstExam})</span></span>
                            </div>
                            <div className="metric-pill">
                                <span className="metric-pill-lbl">Average Score</span>
                                <span className="metric-pill-val">{analysis.studTot} / 720</span>
                            </div>
                        </div>

                        {/* Progression Line Chart */}
                        <div style={{ height: '220px', marginBottom: '16px' }}>
                            <Line data={examProgressionChartData} options={examProgressionChartOptions} />
                        </div>

                        {/* Exam History Table */}
                        <table className="pdf-report-table compact">
                            <thead>
                                <tr>
                                    <th>Exam / Test</th>
                                    <th>Date</th>
                                    <th>Botany</th>
                                    <th>Zoology</th>
                                    <th>Physics</th>
                                    <th>Chemistry</th>
                                    <th>Total (/720)</th>
                                    <th>Marks Lost</th>
                                    <th>Trend</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.examHistoryRows.map(ex => (
                                    <tr key={ex.test}>
                                        <td className="font-bold">{ex.test}</td>
                                        <td>{ex.date}</td>
                                        <td>{ex.bot}</td>
                                        <td>{ex.zoo}</td>
                                        <td>{ex.phy}</td>
                                        <td>{ex.che}</td>
                                        <td className="font-bold text-primary">{ex.total}</td>
                                        <td className="text-danger">-{ex.lost}</td>
                                        <td>
                                            {ex.diff > 0 ? (
                                                <span className="trend-up"><ArrowUpRight size={14} /> +{ex.diff}</span>
                                            ) : ex.diff < 0 ? (
                                                <span className="trend-down"><ArrowDownRight size={14} /> {ex.diff}</span>
                                            ) : (
                                                <span className="trend-flat"><Minus size={14} /> 0</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Section 6: Improvement Potential */}
                    <div className="pdf-section">
                        <h3 className="section-heading">6. Score Improvement Targets</h3>
                        <table className="pdf-report-table">
                            <thead>
                                <tr>
                                    <th>Scenario (illustrative)</th>
                                    <th>Marks gained per exam</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analysis.improvementScenarios.map((sc, i) => (
                                    <tr key={i} className={sc.isHighlight ? 'total-row' : ''}>
                                        <td>{sc.scenario}</td>
                                        <td className="font-bold">{sc.gained}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <p className="table-footnote">
                            Scenarios are estimates based on average score of {analysis.studTot}/720.
                        </p>
                    </div>

                    {/* Section 7: Action Plan */}
                    <div className="pdf-section">
                        <h3 className="section-heading">7. Simple Action Plan for Student</h3>
                        <ol className="action-points-list">
                            {analysis.actionPoints.map((ap, i) => (
                                <li key={i}>{ap}</li>
                            ))}
                        </ol>
                    </div>

                </div>
            ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                    <HelpCircle size={40} style={{ marginBottom: '12px', opacity: 0.5 }} />
                    <h3>No Student Selected or Matching Filters</h3>
                    <p>Please adjust your filters in the top FilterBar to view student performance report.</p>
                </div>
            )}
        </div>
    );
};

export default ToppersPerformanceReport;
