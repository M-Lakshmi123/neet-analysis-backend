import React, { useState, useEffect, useMemo, useRef } from 'react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { formatDate, API_URL } from '../utils/apiHelper';
import { useAuth } from './auth/AuthProvider';
import { logActivity } from '../utils/activityLogger';
import {
    Download,
    Upload,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    ChevronLeft,
    ChevronRight,
    Search,
    Plus,
    Trash2,
    Check,
    FileText,
    Award,
    Layers,
    HelpCircle,
    Printer,
    Archive,
    Sparkles,
    Calendar,
    BookOpen,
    Hash,
    Eye,
    Database,
    X,
    UserCheck
} from 'lucide-react';

// Stream Definitions & Subject Presets
const STREAM_PRESETS = {
    MEDICAL: {
        id: 'MEDICAL',
        label: 'Medical (NEET)',
        icon: '🩺',
        description: 'NEET Medical stream (Botany, Zoology, Physics, Chemistry)',
        defaultSubjects: ['BOTANY', 'ZOOLOGY', 'PHYSICS', 'CHEMISTRY'],
        availableSubjects: ['BOTANY', 'ZOOLOGY', 'PHYSICS', 'CHEMISTRY'],
        defaultSubjectMax: { BOTANY: 180, ZOOLOGY: 180, PHYSICS: 180, CHEMISTRY: 180 },
        defaultMaxTotal: 720
    },
    ENGG_MAIN: {
        id: 'ENGG_MAIN',
        label: 'Engineering JEE Mains',
        icon: '⚙️',
        description: 'JEE Mains stream (Physics: 100, Chemistry: 100, Maths: 100 = 300)',
        defaultSubjects: ['MATHS', 'PHYSICS', 'CHEMISTRY'],
        availableSubjects: ['MATHS', 'PHYSICS', 'CHEMISTRY'],
        defaultSubjectMax: { MATHS: 100, PHYSICS: 100, CHEMISTRY: 100 },
        defaultMaxTotal: 300
    },
    ENGG_ADV: {
        id: 'ENGG_ADV',
        label: 'Engineering JEE Adv',
        icon: '🚀',
        description: 'JEE Advanced stream (Maths, Physics, Chemistry - variable out of marks per exam)',
        defaultSubjects: ['MATHS', 'PHYSICS', 'CHEMISTRY'],
        availableSubjects: ['MATHS', 'PHYSICS', 'CHEMISTRY'],
        defaultSubjectMax: { MATHS: 60, PHYSICS: 60, CHEMISTRY: 60 },
        defaultMaxTotal: 180
    },
    ENGG: {
        id: 'ENGG',
        label: 'Engineering (JEE)',
        icon: '⚙️',
        description: 'JEE Engineering stream (Maths, Physics, Chemistry)',
        defaultSubjects: ['MATHS', 'PHYSICS', 'CHEMISTRY'],
        availableSubjects: ['MATHS', 'PHYSICS', 'CHEMISTRY'],
        defaultSubjectMax: { MATHS: 100, PHYSICS: 100, CHEMISTRY: 100 },
        defaultMaxTotal: 300
    },
    KCET_MED: {
        id: 'KCET_MED',
        label: 'KCET Medical (PCB)',
        icon: '🧬',
        description: 'Karnataka CET Medical / Agri stream (Physics, Chemistry, Biology)',
        defaultSubjects: ['PHYSICS', 'CHEMISTRY', 'BIOLOGY'],
        availableSubjects: ['PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'MATHS'],
        defaultSubjectMax: { PHYSICS: 60, CHEMISTRY: 60, BIOLOGY: 60, MATHS: 60 },
        defaultMaxTotal: 180
    },
    KCET_ENGG: {
        id: 'KCET_ENGG',
        label: 'KCET Engg (PCM)',
        icon: '📐',
        description: 'Karnataka CET Engineering stream (Physics, Chemistry, Maths)',
        defaultSubjects: ['PHYSICS', 'CHEMISTRY', 'MATHS'],
        availableSubjects: ['PHYSICS', 'CHEMISTRY', 'MATHS', 'BIOLOGY'],
        defaultSubjectMax: { PHYSICS: 60, CHEMISTRY: 60, MATHS: 60, BIOLOGY: 60 },
        defaultMaxTotal: 180
    },
    CBSE: {
        id: 'CBSE',
        label: 'CBSE Board',
        icon: '🎓',
        description: 'CBSE Class XI & XII Board stream (PCMB / PCMC)',
        defaultSubjects: ['PHYSICS', 'CHEMISTRY', 'MATHS', 'ENGLISH', 'BIOLOGY', 'IP', 'PE'],
        availableSubjects: ['PHYSICS', 'CHEMISTRY', 'MATHS', 'ENGLISH', 'BIOLOGY', 'IP', 'PE'],
        defaultSubjectMax: { PHYSICS: 100, CHEMISTRY: 100, MATHS: 100, ENGLISH: 100, BIOLOGY: 100, IP: 100, PE: 100 },
        defaultMaxTotal: 700
    },
    PU: {
        id: 'PU',
        label: 'PU Board',
        icon: '🏛️',
        description: 'Karnataka Pre-University Board stream (PCMB, PCMC, etc.)',
        defaultSubjects: ['MATHS', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ENGLISH', 'KANNADA'],
        availableSubjects: ['MATHS', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'COMPUTER SCIENCE', 'ENGLISH', 'KANNADA', 'SANSKRIT', 'HINDI'],
        defaultSubjectMax: { MATHS: 100, PHYSICS: 100, CHEMISTRY: 100, BIOLOGY: 100, 'COMPUTER SCIENCE': 100, ENGLISH: 100, KANNADA: 100, SANSKRIT: 100, HINDI: 100 },
        defaultMaxTotal: 600
    }
};

// =============================================================
// HELPER FUNCTIONS FOR MARKS & ATTENDANCE RENDERING
// =============================================================

// Helper to detect if a mark represents absence / remark
const isAbsentMark = (val) => {
    if (val === undefined || val === null || val === '') return false;
    if (typeof val === 'number') return isNaN(val);
    const str = String(val).trim();
    if (str === '' || str === '-') return false;
    const num = Number(str);
    return isNaN(num) || isNaN(parseFloat(str));
};

// Formatter to render subject mark safely: keeps exact given string if absent/text ('AB', 'A', 'Abset', 'Absent', etc.), rounds numbers, returns '-' if empty. Never returns 'NaN'.
const formatMarkDisplay = (mark) => {
    if (mark === undefined || mark === null || mark === '') return '-';
    if (typeof mark === 'number') {
        return isNaN(mark) ? '-' : String(Math.round(mark));
    }
    const str = String(mark).trim();
    if (str === '' || str === '-') return '-';
    const num = Number(str);
    if (!isNaN(num) && !isNaN(parseFloat(str))) {
        return String(Math.round(num));
    }
    return str;
};

// Formatter to render test total marks safely
const formatTotalDisplay = (total) => {
    if (total === undefined || total === null || total === '') return '-';
    if (typeof total === 'number') {
        return isNaN(total) ? '-' : String(Math.round(total));
    }
    const str = String(total).trim();
    if (str === '' || str === '-') return '-';
    const num = Number(str);
    if (!isNaN(num) && !isNaN(parseFloat(str))) {
        return String(Math.round(num));
    }
    return str;
};

// Helper to determine if a student has meaningful attendance data entered
const hasAttendanceData = (student) => {
    if (!student || !student.attendance) return false;
    const att = student.attendance;
    const w = att.workingDays;
    const p = att.present;
    const a = att.absent;
    const t = att.total;

    const nw = Number(w);
    const np = Number(p);
    const nt = Number(t);
    const na = Number(a);
    if (!isNaN(nw) && nw > 0) return true;
    if (!isNaN(np) && np > 0) return true;
    if (!isNaN(nt) && nt > 0) return true;
    if (!isNaN(na) && na > 0) return true;

    const isMeaningful = (v) => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '-' && String(v).trim() !== '0';
    if (isMeaningful(w) || isMeaningful(p) || isMeaningful(t)) return true;

    return false;
};

const CustomProgressReport = () => {
    const { userData } = useAuth();

    // Multi-Stream & Attendance Selection
    const [selectedStreams, setSelectedStreams] = useState(['MEDICAL', 'CBSE']);
    const [includeAttendance, setIncludeAttendance] = useState(true);
    const [activeConfigTab, setActiveConfigTab] = useState('MEDICAL');

    // Per-stream subjects map
    const [streamSubjects, setStreamSubjects] = useState({
        MEDICAL: [...STREAM_PRESETS.MEDICAL.defaultSubjects],
        ENGG_MAIN: [...STREAM_PRESETS.ENGG_MAIN.defaultSubjects],
        ENGG_ADV: [...STREAM_PRESETS.ENGG_ADV.defaultSubjects],
        ENGG: [...STREAM_PRESETS.ENGG.defaultSubjects],
        KCET_MED: [...STREAM_PRESETS.KCET_MED.defaultSubjects],
        KCET_ENGG: [...STREAM_PRESETS.KCET_ENGG.defaultSubjects],
        CBSE: [...STREAM_PRESETS.CBSE.defaultSubjects],
        PU: [...STREAM_PRESETS.PU.defaultSubjects]
    });

    // Per-stream Out of Marks (Max Marks) map
    const [streamMaxMarks, setStreamMaxMarks] = useState({
        MEDICAL: { ...STREAM_PRESETS.MEDICAL.defaultSubjectMax },
        ENGG_MAIN: { ...STREAM_PRESETS.ENGG_MAIN.defaultSubjectMax },
        ENGG_ADV: { ...STREAM_PRESETS.ENGG_ADV.defaultSubjectMax },
        ENGG: { ...STREAM_PRESETS.ENGG.defaultSubjectMax },
        KCET_MED: { ...STREAM_PRESETS.KCET_MED.defaultSubjectMax },
        KCET_ENGG: { ...STREAM_PRESETS.KCET_ENGG.defaultSubjectMax },
        CBSE: { ...STREAM_PRESETS.CBSE.defaultSubjectMax },
        PU: { ...STREAM_PRESETS.PU.defaultSubjectMax }
    });

    // Custom added subjects map
    const [customAddedSubjects, setCustomAddedSubjects] = useState({
        MEDICAL: [],
        ENGG_MAIN: [],
        ENGG_ADV: [],
        ENGG: [],
        KCET_MED: [],
        KCET_ENGG: [],
        CBSE: [],
        PU: []
    });

    const [newSubjectInput, setNewSubjectInput] = useState('');

    // Upload & Parsed Data States
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [statusMessage, setStatusMessage] = useState(null);

    // Top Student ID Search & Download State
    const [searchStudentId, setSearchStudentId] = useState('');
    const [isSearchingStudent, setIsSearchingStudent] = useState(false);
    const [searchSuggestions, setSearchSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    // Students Data Array
    const [students, setStudents] = useState([]);
    const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
    const [studentSearch, setStudentSearch] = useState('');

    // Download States
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, status: '' });

    const fileInputRef = useRef(null);
    const searchContainerRef = useRef(null);

    // Compute Total Max Marks for a Stream
    const getStreamTotalMax = (streamKey, subsList, customMaxMap) => {
        const subs = subsList || streamSubjects[streamKey] || STREAM_PRESETS[streamKey]?.defaultSubjects || [];
        const maxMap = customMaxMap || streamMaxMarks[streamKey] || {};
        return subs.reduce((sum, s) => {
            const defaultM = streamKey === 'ENGG_MAIN' ? 100 : streamKey?.startsWith('KCET') ? 60 : 100;
            const val = maxMap[s] !== undefined && maxMap[s] !== null ? Number(maxMap[s]) : defaultM;
            return sum + (isNaN(val) ? defaultM : val);
        }, 0);
    };

    // Toggle Stream Selection (Multi-Select)
    const handleToggleStream = (streamKey) => {
        setSelectedStreams(prev => {
            if (prev.includes(streamKey)) {
                if (prev.length <= 1) {
                    setStatusMessage({ type: 'error', text: 'At least one stream must be selected!' });
                    return prev;
                }
                const updated = prev.filter(k => k !== streamKey);
                if (activeConfigTab === streamKey) {
                    setActiveConfigTab(updated[0]);
                }
                return updated;
            } else {
                const updated = [...prev, streamKey];
                setActiveConfigTab(streamKey);
                return updated;
            }
        });
    };

    // Toggle Subject Checkbox for currently active stream tab
    const handleToggleSubject = (streamKey, sub) => {
        setStreamSubjects(prev => {
            const currentList = prev[streamKey] || [];
            if (currentList.includes(sub)) {
                if (currentList.length <= 1) {
                    setStatusMessage({ type: 'error', text: 'At least one subject must remain selected for this stream!' });
                    return prev;
                }
                return { ...prev, [streamKey]: currentList.filter(s => s !== sub) };
            } else {
                return { ...prev, [streamKey]: [...currentList, sub] };
            }
        });
    };

    // Change Max Marks for a subject
    const handleMaxMarkChange = (streamKey, subject, value) => {
        const num = value === '' ? '' : Math.max(0, Number(value));
        setStreamMaxMarks(prev => ({
            ...prev,
            [streamKey]: {
                ...(prev[streamKey] || {}),
                [subject]: num
            }
        }));
    };

    // Quick presets for Max Marks
    const handleSetAllMaxMarks = (streamKey, val) => {
        const subs = streamSubjects[streamKey] || [];
        const updated = {};
        subs.forEach(s => { updated[s] = val; });
        setStreamMaxMarks(prev => ({
            ...prev,
            [streamKey]: { ...(prev[streamKey] || {}), ...updated }
        }));
        setStatusMessage({ type: 'info', text: `Set out of marks for all ${subs.length} subjects to ${val} in ${STREAM_PRESETS[streamKey].label}.` });
    };

    // Add Custom Subject to active stream
    const handleAddCustomSubject = (e) => {
        e.preventDefault();
        const trimmed = newSubjectInput.trim().toUpperCase();
        if (!trimmed) return;
        setCustomAddedSubjects(prev => ({
            ...prev,
            [activeConfigTab]: [...new Set([...(prev[activeConfigTab] || []), trimmed])]
        }));
        setStreamSubjects(prev => ({
            ...prev,
            [activeConfigTab]: [...new Set([...(prev[activeConfigTab] || []), trimmed])]
        }));
        setStreamMaxMarks(prev => ({
            ...prev,
            [activeConfigTab]: {
                ...(prev[activeConfigTab] || {}),
                [trimmed]: activeConfigTab.startsWith('KCET') ? 60 : 100
            }
        }));
        setNewSubjectInput('');
        setStatusMessage({ type: 'success', text: `Added custom subject "${trimmed}".` });
    };

    // Select All / Reset Defaults for active stream tab
    const handleSelectAllForTab = () => {
        const fullAvailable = [
            ...STREAM_PRESETS[activeConfigTab].availableSubjects,
            ...(customAddedSubjects[activeConfigTab] || [])
        ];
        setStreamSubjects(prev => ({ ...prev, [activeConfigTab]: fullAvailable }));
    };

    const handleResetDefaultsForTab = () => {
        setStreamSubjects(prev => ({
            ...prev,
            [activeConfigTab]: [...STREAM_PRESETS[activeConfigTab].defaultSubjects]
        }));
        setStreamMaxMarks(prev => ({
            ...prev,
            [activeConfigTab]: { ...STREAM_PRESETS[activeConfigTab].defaultSubjectMax }
        }));
    };

    // -------------------------------------------------------------
    // 1. DYNAMIC EXCEL TEMPLATE GENERATION (With Out Of / Max Marks)
    // -------------------------------------------------------------
    const handleDownloadTemplate = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Sri Chaitanya Educational Institutions';
            workbook.created = new Date();

            const streamLabels = selectedStreams.map(k => STREAM_PRESETS[k].label).join(' & ');

            // Main Unified Sheet
            const mainSheet = workbook.addWorksheet('Custom_Progress_Template', {
                views: [{ showGridLines: true }]
            });

            // Base Columns
            const baseCols = [
                { header: 'STUDENT ID', key: 'STUD_ID', width: 16 },
                { header: 'NAME OF THE STUDENT', key: 'NAME_OF_THE_STUDENT', width: 26 },
                { header: 'CAMPUS NAME', key: 'CAMPUS_NAME', width: 22 },
                { header: 'SECTION', key: 'SECTION', width: 14 },
                { header: 'STREAM NAME', key: 'STREAM_NAME', width: 22 },
                { header: 'EXAM TYPE', key: 'EXAM_TYPE', width: 18 },
                { header: 'TEST NAME', key: 'TEST_NAME', width: 22 },
                { header: 'DATE', key: 'DATE', width: 14 }
            ];

            // Build dynamic subject columns for selected streams
            const subjectCols = [];
            selectedStreams.forEach(streamKey => {
                const subs = streamSubjects[streamKey] || [];
                subs.forEach(sub => {
                    const colKey = selectedStreams.length > 1 ? `[${streamKey}] ${sub}` : sub;
                    if (!subjectCols.some(c => c.key === colKey)) {
                        subjectCols.push({
                            header: colKey,
                            key: colKey,
                            width: 16,
                            streamKey,
                            subName: sub
                        });
                    }
                });
            });

            // Attendance Columns (exact match to Image 2)
            const attendanceCols = includeAttendance ? [
                { header: 'TOTAL NO.OF WORKING DAYS', key: 'WORKING_DAYS', width: 25 },
                { header: 'ABSENT', key: 'ATT_ABSENT', width: 14 },
                { header: 'PRESENT', key: 'ATT_PRESENT', width: 14 },
                { header: 'SICK', key: 'ATT_SICK', width: 14 },
                { header: 'TOTAL', key: 'ATT_TOTAL', width: 14 }
            ] : [];

            mainSheet.columns = [...baseCols, ...subjectCols, ...attendanceCols];

            // Style Header Row (Row 1)
            const headerRow = mainSheet.getRow(1);
            headerRow.height = 30;
            headerRow.eachCell((cell, colNum) => {
                const isAttendance = includeAttendance && colNum > (baseCols.length + subjectCols.length);

                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: {
                        argb: isAttendance ? 'FF1E3A8A' : 'FF0F2057'
                    }
                };
                cell.font = {
                    name: 'Segoe UI',
                    size: 10.5,
                    bold: true,
                    color: { argb: 'FFFFFFFF' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFC9962B' } },
                    bottom: { style: 'medium', color: { argb: 'FFC9962B' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
            });

            // Row 2: OUT OF / MAX MARKS ROW (Exactly as shown in Image 2!)
            const maxRowObj = {
                STUD_ID: 'MAX MARKS',
                NAME_OF_THE_STUDENT: 'Out of Marks Reference',
                CAMPUS_NAME: '-',
                SECTION: '-',
                STREAM_NAME: '-',
                EXAM_TYPE: '-',
                TEST_NAME: 'Max Marks',
                DATE: '-'
            };

            subjectCols.forEach(sc => {
                const maxVal = streamMaxMarks[sc.streamKey]?.[sc.subName] ?? (sc.streamKey.startsWith('KCET') ? 60 : 100);
                maxRowObj[sc.key] = maxVal;
            });

            if (includeAttendance) {
                maxRowObj.WORKING_DAYS = 'Max Working Days';
                maxRowObj.ATT_ABSENT = '-';
                maxRowObj.ATT_PRESENT = '-';
                maxRowObj.ATT_SICK = '-';
                maxRowObj.ATT_TOTAL = '-';
            }

            const maxRow = mainSheet.addRow(maxRowObj);
            maxRow.height = 24;
            maxRow.eachCell((cell, colNum) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF1F4FB' }
                };
                cell.font = {
                    name: 'Segoe UI',
                    size: 10,
                    bold: true,
                    color: { argb: 'FF0F2057' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    bottom: { style: 'medium', color: { argb: 'FFC9962B' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
            });

            // Sample Rows for demonstration
            const sampleRows = [];
            selectedStreams.forEach((streamKey, sIdx) => {
                const isFirst = sIdx === 0;
                let sampleTestName = 'Unit Test - 1';
                if (streamKey === 'MEDICAL') sampleTestName = 'Grand Test - 1 (NEET)';
                else if (streamKey === 'ENGG_MAIN') sampleTestName = 'JEE Mains Mock Test - 1';
                else if (streamKey === 'ENGG_ADV') sampleTestName = 'JEE Adv Practice Paper - 1';
                else if (streamKey === 'ENGG') sampleTestName = 'Mains Mock Test (JEE)';
                else if (streamKey === 'KCET_MED') sampleTestName = 'KCET Mock (PCB)';
                else if (streamKey === 'KCET_ENGG') sampleTestName = 'KCET Mock (PCM)';
                else if (streamKey === 'CBSE') sampleTestName = 'Mid-Term Board Exam';
                else if (streamKey === 'PU') sampleTestName = 'Preparatory Exam';

                const rowObj = {
                    STUD_ID: 'SC1001',
                    NAME_OF_THE_STUDENT: 'Aarav Patel',
                    CAMPUS_NAME: 'Indiranagar Campus',
                    SECTION: 'Section A',
                    STREAM_NAME: streamLabels,
                    EXAM_TYPE: streamKey,
                    TEST_NAME: sampleTestName,
                    DATE: isFirst ? '2026-03-01' : '2026-03-12'
                };

                const subs = streamSubjects[streamKey] || [];
                subs.forEach((sub, subIdx) => {
                    const colKey = selectedStreams.length > 1 ? `[${streamKey}] ${sub}` : sub;
                    const maxVal = Number(streamMaxMarks[streamKey]?.[sub]) || (streamKey.startsWith('KCET') ? 60 : 100);
                    const mark = Math.round(maxVal * 0.85) - (subIdx * 2);
                    rowObj[colKey] = mark;
                });

                if (includeAttendance) {
                    rowObj.WORKING_DAYS = 180;
                    rowObj.ATT_ABSENT = 6;
                    rowObj.ATT_PRESENT = 170;
                    rowObj.ATT_SICK = 4;
                    rowObj.ATT_TOTAL = 180;
                }
                sampleRows.push(rowObj);
            });

            // Student 2 Sample
            selectedStreams.forEach((streamKey, sIdx) => {
                const isFirst = sIdx === 0;
                let sampleTestName = 'Unit Test - 1';
                if (streamKey === 'MEDICAL') sampleTestName = 'Grand Test - 1 (NEET)';
                else if (streamKey === 'ENGG_MAIN') sampleTestName = 'JEE Mains Mock Test - 1';
                else if (streamKey === 'ENGG_ADV') sampleTestName = 'JEE Adv Practice Paper - 1';
                else if (streamKey === 'ENGG') sampleTestName = 'Mains Mock Test (JEE)';
                else if (streamKey === 'KCET_MED') sampleTestName = 'KCET Mock (PCB)';
                else if (streamKey === 'KCET_ENGG') sampleTestName = 'KCET Mock (PCM)';
                else if (streamKey === 'CBSE') sampleTestName = 'Mid-Term Board Exam';
                else if (streamKey === 'PU') sampleTestName = 'Preparatory Exam';

                const rowObj = {
                    STUD_ID: 'SC1002',
                    NAME_OF_THE_STUDENT: 'Diya Sharma',
                    CAMPUS_NAME: 'Koramangala Campus',
                    SECTION: 'Section B',
                    STREAM_NAME: streamLabels,
                    EXAM_TYPE: streamKey,
                    TEST_NAME: sampleTestName,
                    DATE: isFirst ? '2026-03-01' : '2026-03-12'
                };

                const subs = streamSubjects[streamKey] || [];
                subs.forEach((sub, subIdx) => {
                    const colKey = selectedStreams.length > 1 ? `[${streamKey}] ${sub}` : sub;
                    const maxVal = Number(streamMaxMarks[streamKey]?.[sub]) || (streamKey.startsWith('KCET') ? 60 : 100);
                    const mark = Math.round(maxVal * 0.90) - (subIdx * 2);
                    rowObj[colKey] = mark;
                });

                if (includeAttendance) {
                    rowObj.WORKING_DAYS = 180;
                    rowObj.ATT_ABSENT = 4;
                    rowObj.ATT_PRESENT = 172;
                    rowObj.ATT_SICK = 4;
                    rowObj.ATT_TOTAL = 180;
                }
                sampleRows.push(rowObj);
            });

            sampleRows.forEach(sRow => {
                const added = mainSheet.addRow(sRow);
                added.height = 22;
                added.eachCell((cell, colNum) => {
                    cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF1E293B' } };
                    cell.alignment = {
                        vertical: 'middle',
                        horizontal: colNum <= 2 ? 'left' : 'center'
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                    };
                });
            });

            // Instructions Sheet
            const infoSheet = workbook.addWorksheet('Instructions');
            infoSheet.columns = [
                { header: 'Section / Column', width: 26 },
                { header: 'Description & Input Guidelines', width: 75 }
            ];
            const infoHeaders = infoSheet.getRow(1);
            infoHeaders.height = 26;
            infoHeaders.eachCell(c => {
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F2057' } };
                c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            });

            const instructions = [
                ['Selected Streams', streamLabels],
                ['Engineering Streams', 'Engineering JEE Mains has Physics (100), Chemistry (100), Maths (100) = Total 300. Engineering JEE Adv supports variable out of marks that change per test/exam.'],
                ['KCET Support', 'KCET Medical (PCB) has Physics (60), Chemistry (60), Biology (60) = Total 180. KCET Engg (PCM) has Physics (60), Chemistry (60), Maths (60) = Total 180.'],
                ['Out of / Max Marks', 'Row 2 indicates the Out of Marks (Max Marks) for each subject. For JEE Adv or custom exams, you can adjust them directly.'],
                ['Auto Total Calculation', 'NO NEED TO ENTER TOTAL MARKS! The system automatically calculates total marks for each exam and stream (NEET, CBSE, KCET, PU, JEE) from the subject marks and adds it into the progress report.'],
                ['Attendance Enabled', includeAttendance ? 'Yes (Working Days, Absent, Present, Sick, Total)' : 'No'],
                ['STUDENT ID', 'Mandatory unique ID. Multiple rows with the same ID will be grouped together.'],
                ['SECTION', 'Enter the student section or division (e.g. "Section A", "NEET-1", "PU-B").'],
                ['EXAM TYPE', `Specify which stream this test belongs to (${selectedStreams.join(', ')}).`],
                ['Subject Marks', 'Enter student marks for each test. If absent, enter "AB" or "Absent".'],
                ['Attendance Section', 'Enter TOTAL NO.OF WORKING DAYS, ABSENT, PRESENT, SICK, and TOTAL.']
            ];

            instructions.forEach(inst => {
                const r = infoSheet.addRow(inst);
                r.height = 22;
                r.alignment = { vertical: 'middle' };
            });

            // Write and Save
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const fileName = `${selectedStreams.join('_')}_Progress_Report_Template.xlsx`;
            saveAs(blob, fileName);

            setStatusMessage({
                type: 'success',
                text: `Downloaded template "${fileName}" with out-of-marks configured!`
            });
            logActivity(userData, 'Downloaded Multi-Stream Progress Template', { streams: selectedStreams, attendance: includeAttendance });
        } catch (err) {
            console.error('Error generating template:', err);
            setStatusMessage({ type: 'error', text: `Failed to create Excel template: ${err.message}` });
        }
    };

    // -------------------------------------------------------------
    // 2. PARSE EXCEL FILE (Multi-Stream & Attendance Handler)
    // -------------------------------------------------------------
    const getCellValue = (cell) => {
        if (!cell || cell.value === null || cell.value === undefined) return '';
        if (typeof cell.value === 'object') {
            if (cell.value.result !== undefined && cell.value.result !== null) return cell.value.result;
            if (cell.value.text !== undefined) return cell.value.text;
            if (cell.value instanceof Date) return cell.value;
            return String(cell.value);
        }
        return cell.value;
    };

    const handleFile = async (file) => {
        if (!file) return;
        setIsParsing(true);
        setUploadedFileName(file.name);
        setStatusMessage({ type: 'info', text: `Parsing "${file.name}"... Please wait.` });

        try {
            const arrayBuffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(arrayBuffer);

            const worksheet = workbook.worksheets.find(ws => ws.name !== 'Instructions') || workbook.worksheets[0];
            if (!worksheet) throw new Error('No valid worksheet found in the Excel file.');

            let headerRowIndex = 1;
            let headerValues = [];

            for (let r = 1; r <= 5; r++) {
                const row = worksheet.getRow(r);
                const values = [];
                row.eachCell((cell, colNumber) => {
                    values[colNumber] = String(getCellValue(cell) || '').trim();
                });
                const normStr = values.join(' ').toUpperCase();
                if (normStr.includes('STUD') || normStr.includes('NAME') || normStr.includes('MARKS') || normStr.includes('ATTENDANCE')) {
                    headerRowIndex = r;
                    headerValues = values;
                    break;
                }
            }

            if (headerValues.length === 0) {
                const r1 = worksheet.getRow(1);
                r1.eachCell((cell, colNumber) => {
                    headerValues[colNumber] = String(getCellValue(cell) || '').trim();
                });
            }

            // Map Column Headers
            let idCol = -1;
            let nameCol = -1;
            let campusCol = -1;
            let sectionCol = -1;
            let streamCol = -1;
            let examTypeCol = -1;
            let testCol = -1;
            let dateCol = -1;
            let totalCol = -1;

            let workingDaysCol = -1;
            let absentCol = -1;
            let presentCol = -1;
            let sickCol = -1;
            let attTotalCol = -1;

            const subjectCols = [];

            headerValues.forEach((rawHeader, colIdx) => {
                if (!rawHeader) return;
                const h = rawHeader.trim().toUpperCase();

                if (h.includes('STUDENT ID') || h === 'STUD_ID' || h === 'STUDENTID' || h === 'ID' || h === 'ROLL NO') {
                    if (idCol === -1) idCol = colIdx;
                } else if (h.includes('NAME OF THE STUDENT') || h === 'STUDENT NAME' || h === 'NAME') {
                    if (nameCol === -1) nameCol = colIdx;
                } else if (h.includes('CAMPUS') || h.includes('BRANCH')) {
                    if (campusCol === -1) campusCol = colIdx;
                } else if (h.includes('SECTION') || h === 'SEC' || h.includes('CLASS & SEC') || h.includes('BATCH')) {
                    if (sectionCol === -1) sectionCol = colIdx;
                } else if (h.includes('EXAM TYPE') || h.includes('STREAM TYPE') || h.includes('CATEGORY')) {
                    if (examTypeCol === -1) examTypeCol = colIdx;
                } else if (h.includes('STREAM')) {
                    if (streamCol === -1) streamCol = colIdx;
                } else if (h.includes('TEST') || h.includes('EXAM')) {
                    if (testCol === -1) testCol = colIdx;
                } else if (h.includes('DATE')) {
                    if (dateCol === -1) dateCol = colIdx;
                } else if (h.includes('TOTAL NO.OF WORKING DAYS') || h.includes('WORKING DAYS')) {
                    workingDaysCol = colIdx;
                } else if (h === 'ABSENT' || h.includes('DAYS ABSENT')) {
                    absentCol = colIdx;
                } else if (h === 'PRESENT' || h.includes('DAYS PRESENT')) {
                    presentCol = colIdx;
                } else if (h === 'SICK' || h.includes('SICK LEAVE')) {
                    sickCol = colIdx;
                } else if (h === 'TOTAL' && colIdx > (workingDaysCol !== -1 ? workingDaysCol : 10)) {
                    attTotalCol = colIdx;
                } else if (h.includes('TOTAL MARKS') || h === 'TOTAL' || h === 'TOT') {
                    if (totalCol === -1) totalCol = colIdx;
                } else {
                    let streamTag = null;
                    let cleanSub = h;
                    const match = h.match(/^\[(.*?)\]\s*(.*)$/);
                    if (match) {
                        streamTag = match[1].trim();
                        cleanSub = match[2].trim();
                    }
                    subjectCols.push({ col: colIdx, originalName: h, cleanName: cleanSub, streamTag });
                }
            });

            // Dynamically detect subjects and streams directly from the uploaded Excel file headers!
            const detectedStreamSubjects = {};
            const detectedStreams = new Set();

            subjectCols.forEach(sc => {
                let st = sc.streamTag;
                if (!st) {
                    if (['BOTANY', 'ZOOLOGY'].includes(sc.cleanName)) st = 'MEDICAL';
                    else if (['COMPUTER SCIENCE', 'KANNADA', 'SANSKRIT', 'HINDI'].includes(sc.cleanName)) st = 'PU';
                    else if (['IP', 'PE'].includes(sc.cleanName)) st = 'CBSE';
                    else st = selectedStreams[0] || 'MEDICAL';
                }
                detectedStreams.add(st);
                if (!detectedStreamSubjects[st]) detectedStreamSubjects[st] = [];
                if (!detectedStreamSubjects[st].includes(sc.cleanName)) {
                    detectedStreamSubjects[st].push(sc.cleanName);
                }
            });

            if (Object.keys(detectedStreamSubjects).length > 0) {
                setStreamSubjects(prev => {
                    const merged = { ...prev };
                    Object.keys(detectedStreamSubjects).forEach(st => {
                        const fileSubs = detectedStreamSubjects[st];
                        if (fileSubs && fileSubs.length > 0) {
                            merged[st] = fileSubs;
                        }
                    });
                    return merged;
                });
            }

            if (detectedStreams.size > 0) {
                setSelectedStreams(prev => {
                    const merged = [...prev];
                    detectedStreams.forEach(st => {
                        if (STREAM_PRESETS[st] && !merged.includes(st)) {
                            merged.push(st);
                        }
                    });
                    return merged;
                });
            }

            // Check if row directly below header is a Max Marks row
            const secondRow = worksheet.getRow(headerRowIndex + 1);
            const r2Label = String(getCellValue(secondRow.getCell(idCol !== -1 ? idCol : 1)) || '').toUpperCase();
            const isRow2MaxMarks = r2Label.includes('MAX') || r2Label.includes('OUT OF') || r2Label.includes('TOTAL');

            if (isRow2MaxMarks) {
                const extractedMax = {};
                subjectCols.forEach(sc => {
                    const rawVal = getCellValue(secondRow.getCell(sc.col));
                    if (rawVal && !isNaN(Number(rawVal))) {
                        let targetStream = sc.streamTag;
                        if (!targetStream) {
                            if (['BOTANY', 'ZOOLOGY'].includes(sc.cleanName)) targetStream = 'MEDICAL';
                            else if (['COMPUTER SCIENCE', 'KANNADA', 'SANSKRIT', 'HINDI'].includes(sc.cleanName)) targetStream = 'PU';
                            else if (['IP', 'PE'].includes(sc.cleanName)) targetStream = 'CBSE';
                            else targetStream = selectedStreams[0] || 'MEDICAL';
                        }
                        if (!extractedMax[targetStream]) extractedMax[targetStream] = {};
                        extractedMax[targetStream][sc.cleanName] = Number(rawVal);
                    }
                });

                setStreamMaxMarks(prev => {
                    const merged = { ...prev };
                    Object.keys(extractedMax).forEach(st => {
                        merged[st] = { ...(merged[st] || {}), ...extractedMax[st] };
                    });
                    return merged;
                });
            }

            const rawStudentRows = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber <= headerRowIndex) return;
                if (rowNumber === headerRowIndex + 1 && isRow2MaxMarks) return;

                const studId = idCol !== -1 ? String(getCellValue(row.getCell(idCol)) || '').trim() : '';
                const studName = nameCol !== -1 ? String(getCellValue(row.getCell(nameCol)) || '').trim() : '';
                const campus = campusCol !== -1 ? String(getCellValue(row.getCell(campusCol)) || '').trim() : 'Campus';
                const section = sectionCol !== -1 ? String(getCellValue(row.getCell(sectionCol)) || '').trim() : '';
                const stream = streamCol !== -1 ? String(getCellValue(row.getCell(streamCol)) || '').trim() : selectedStreams.map(k => STREAM_PRESETS[k].label).join(' & ');
                const test = testCol !== -1 ? String(getCellValue(row.getCell(testCol)) || '').trim() : `Test ${rowNumber - headerRowIndex}`;
                let dateVal = dateCol !== -1 ? getCellValue(row.getCell(dateCol)) : '';
                if (dateVal instanceof Date) {
                    dateVal = dateVal.toISOString().split('T')[0];
                }

                if (!studId && !studName) return;

                // 1. Determine Exam Type for this row
                let examType = examTypeCol !== -1 ? String(getCellValue(row.getCell(examTypeCol)) || '').trim().toUpperCase() : '';

                if (!examType) {
                    for (const sc of subjectCols) {
                        const rawVal = getCellValue(row.getCell(sc.col));
                        const strVal = String(rawVal || '').trim().toUpperCase();
                        if (strVal !== '') {
                            if (sc.streamTag) {
                                examType = sc.streamTag;
                                break;
                            } else if (['BOTANY', 'ZOOLOGY'].includes(sc.cleanName)) {
                                examType = 'MEDICAL';
                                break;
                            } else if (['COMPUTER SCIENCE', 'KANNADA', 'SANSKRIT', 'HINDI'].includes(sc.cleanName)) {
                                examType = 'PU';
                                break;
                            } else if (['IP', 'PE'].includes(sc.cleanName)) {
                                examType = 'CBSE';
                                break;
                            }
                        }
                    }
                }

                // Canonical examType mapping
                if (examType.includes('KCET')) {
                    if (examType.includes('MED') || examType.includes('PCB') || examType.includes('BIO')) examType = 'KCET_MED';
                    else if (examType.includes('ENG') || examType.includes('PCM') || examType.includes('MAT')) examType = 'KCET_ENGG';
                    else examType = selectedStreams.includes('KCET_MED') ? 'KCET_MED' : 'KCET_ENGG';
                } else if (examType.includes('ADV') || examType.includes('ADVANCED')) {
                    examType = 'ENGG_ADV';
                } else if (examType.includes('MAIN') || examType.includes('MAINS')) {
                    examType = 'ENGG_MAIN';
                } else if (examType.includes('MED') || examType.includes('NEET')) {
                    examType = 'MEDICAL';
                } else if (examType.includes('ENG') || examType.includes('JEE')) {
                    examType = selectedStreams.includes('ENGG_ADV') && !selectedStreams.includes('ENGG_MAIN') ? 'ENGG_ADV' : 'ENGG_MAIN';
                } else if (examType.includes('CBSE')) {
                    examType = 'CBSE';
                } else if (examType.includes('PU')) {
                    examType = 'PU';
                } else {
                    examType = selectedStreams[0] || 'MEDICAL';
                }

                // 2. Extract Marks and Automatically Calculate Total for this Stream's Test
                const marksObj = {};
                let numericSum = 0;
                let hasMarks = false;
                let isAllAbsent = true;

                subjectCols.forEach(sc => {
                    // When multi-stream columns are present (tagged [STREAM]), only process columns matching this row's examType
                    if (sc.streamTag) {
                        const tagMatches = sc.streamTag === examType ||
                            (sc.streamTag === 'ENGG' && (examType === 'ENGG_MAIN' || examType === 'ENGG_ADV')) ||
                            ((sc.streamTag === 'ENGG_MAIN' || sc.streamTag === 'ENGG_ADV') && examType === 'ENGG');
                        if (!tagMatches) return;
                    }

                    const rawVal = getCellValue(row.getCell(sc.col));
                    const strVal = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : '';

                    if (strVal !== '') {
                        const slashMatch = strVal.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
                        if (slashMatch) {
                            const scoredNum = Number(slashMatch[1]);
                            marksObj[sc.cleanName] = scoredNum;
                            numericSum += scoredNum;
                            hasMarks = true;
                            isAllAbsent = false;
                        } else {
                            const num = Number(strVal);
                            if (!isNaN(num) && !isNaN(parseFloat(strVal))) {
                                marksObj[sc.cleanName] = num;
                                numericSum += num;
                                hasMarks = true;
                                isAllAbsent = false;
                            } else {
                                // Non-numeric mark ('AB', 'A', 'Absent', 'Abset', etc.)
                                // Store exactly as entered by user
                                marksObj[sc.cleanName] = strVal;
                                hasMarks = true;
                            }
                        }
                    }
                });

                const isAbsentRow = hasMarks && isAllAbsent;

                // Total is automatically computed from individual subject marks!
                let totalMarksVal = totalCol !== -1 ? getCellValue(row.getCell(totalCol)) : null;
                let finalTotal = numericSum;
                if (numericSum === 0 && !isAbsentRow && totalMarksVal !== null && totalMarksVal !== '' && !isNaN(Number(totalMarksVal))) {
                    finalTotal = Number(totalMarksVal);
                }

                // Attendance Extraction: Only set if user entered actual attendance data
                const rawWDays = workingDaysCol !== -1 ? String(getCellValue(row.getCell(workingDaysCol)) ?? '').trim() : '';
                const rawAbDays = absentCol !== -1 ? String(getCellValue(row.getCell(absentCol)) ?? '').trim() : '';
                const rawPrDays = presentCol !== -1 ? String(getCellValue(row.getCell(presentCol)) ?? '').trim() : '';
                const rawSkDays = sickCol !== -1 ? String(getCellValue(row.getCell(sickCol)) ?? '').trim() : '';
                const rawTotAtt = attTotalCol !== -1 ? String(getCellValue(row.getCell(attTotalCol)) ?? '').trim() : '';

                const hasAttendanceEntry = [rawWDays, rawAbDays, rawPrDays, rawSkDays, rawTotAtt].some(val => val !== '' && val !== '-');
                let rowAttendance = null;

                if (hasAttendanceEntry) {
                    const numW = Number(rawWDays);
                    const numP = Number(rawPrDays);
                    const numA = Number(rawAbDays);
                    const numS = Number(rawSkDays);
                    const numT = Number(rawTotAtt);

                    if ((!isNaN(numW) && numW > 0) || (!isNaN(numP) && numP > 0) || (!isNaN(numT) && numT > 0) || (!isNaN(numA) && numA > 0)) {
                        const wDays = !isNaN(numW) && numW > 0 ? numW : (rawWDays || '-');
                        const abDays = rawAbDays !== '' ? rawAbDays : '0';
                        const prDays = !isNaN(numP) ? numP : (rawPrDays || '-');
                        const skDays = rawSkDays !== '' ? rawSkDays : '0';
                        const totAtt = !isNaN(numT) && numT > 0 ? numT : (rawTotAtt || wDays || '-');

                        rowAttendance = {
                            workingDays: wDays,
                            absent: abDays,
                            present: prDays,
                            sick: skDays,
                            total: totAtt
                        };
                    }
                }

                rawStudentRows.push({
                    studId: studId || studName,
                    studName: studName || studId,
                    campus,
                    section,
                    stream,
                    examType,
                    testName: test || 'Exam',
                    date: dateVal,
                    total: isAbsentRow ? '-' : finalTotal,
                    marks: marksObj,
                    isAB: isAbsentRow,
                    attendance: rowAttendance
                });
            });

            if (rawStudentRows.length === 0) {
                throw new Error('No valid student rows found in the uploaded file.');
            }

            const grouped = {};
            rawStudentRows.forEach(row => {
                const sid = row.studId;
                if (!grouped[sid]) {
                    grouped[sid] = {
                        id: row.studId,
                        name: row.studName,
                        campus: row.campus,
                        section: row.section || '',
                        stream: row.stream,
                        streamTests: {},
                        attendance: null
                    };
                }
                if (!grouped[sid].section && row.section) {
                    grouped[sid].section = row.section;
                }
                const st = row.examType || selectedStreams[0];
                if (!grouped[sid].streamTests[st]) {
                    grouped[sid].streamTests[st] = [];
                }
                grouped[sid].streamTests[st].push({
                    testName: row.testName,
                    date: row.date,
                    total: row.total,
                    marks: row.marks,
                    isAB: row.isAB
                });

                if (row.attendance) {
                    grouped[sid].attendance = row.attendance;
                }
            });

            const studentList = Object.values(grouped).map(stud => {
                const streamAverages = {};
                Object.keys(stud.streamTests).forEach(stKey => {
                    const tests = stud.streamTests[stKey] || [];
                    const attended = tests.filter(t => !t.isAB && (Number(t.total) > 0 || Object.values(t.marks || {}).some(m => !isAbsentMark(m))));
                    const count = attended.length;
                    const avgTot = count > 0 ? Math.round(attended.reduce((a, b) => a + (Number(b.total) || 0), 0) / count) : '-';

                    // Collect ALL active subjects from detected subjects, streamSubjects, defaultSubjects, AND test marks!
                    const activeSubs = [...new Set([
                        ...(detectedStreamSubjects[stKey] || []),
                        ...(streamSubjects[stKey] || []),
                        ...(STREAM_PRESETS[stKey]?.defaultSubjects || []),
                        ...tests.flatMap(t => Object.keys(t.marks || {}))
                    ])].filter(Boolean);

                    const subjectAverages = {};
                    activeSubs.forEach(sub => {
                        const validMarks = attended
                            .map(t => t.marks?.[sub])
                            .filter(m => m !== undefined && m !== null && m !== '' && !isAbsentMark(m))
                            .map(Number);
                        subjectAverages[sub] = validMarks.length > 0 ? Math.round(validMarks.reduce((a, b) => a + b, 0) / validMarks.length) : '-';
                    });

                    streamAverages[stKey] = {
                        avgTotal: avgTot,
                        subjectAverages,
                        subjects: activeSubs
                    };
                });

                let attObj = stud.attendance;
                if (attObj && Number(attObj.workingDays) > 0 && Number(attObj.present) >= 0) {
                    const pct = ((Number(attObj.present) / Number(attObj.workingDays)) * 100).toFixed(1);
                    attObj.percentage = `${pct}%`;
                }

                return {
                    ...stud,
                    streamAverages,
                    attendance: attObj
                };
            });

            setStudents(studentList);
            setCurrentStudentIndex(0);

            // Auto-save to TiDB
            try {
                setStatusMessage({ type: 'info', text: `Parsed ${studentList.length} students. Saving records...` });
                const saveRes = await fetch(`${API_URL}/api/custom-progress/bulk-save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        students: studentList,
                        streamMaxMarks,
                        academicYear: '2026'
                    })
                });
                if (saveRes.ok) {
                    setStatusMessage({
                        type: 'success',
                        text: `Parsed ${studentList.length} student(s) with ${rawStudentRows.length} test records and saved to database!`
                    });
                } else {
                    setStatusMessage({
                        type: 'success',
                        text: `Parsed ${studentList.length} student(s) with ${rawStudentRows.length} total test records across selected streams!`
                    });
                }
            } catch (saveErr) {
                console.warn('Auto-save to TiDB error/warning:', saveErr);
                setStatusMessage({
                    type: 'success',
                    text: `Parsed ${studentList.length} student(s) with ${rawStudentRows.length} total test records across selected streams!`
                });
            }
            logActivity(userData, 'Uploaded Multi-Stream Progress Excel', { studentsCount: studentList.length });
        } catch (err) {
            console.error('File parsing error:', err);
            setStatusMessage({ type: 'error', text: `Failed to parse Excel file: ${err.message}` });
        } finally {
            setIsParsing(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    // -------------------------------------------------------------
    // 3. STUDENT NAVIGATION & FILTERING
    // -------------------------------------------------------------
    const filteredStudents = useMemo(() => {
        if (!studentSearch.trim()) return students;
        const q = studentSearch.toLowerCase().trim();
        return students.filter(s =>
            (s.name && s.name.toLowerCase().includes(q)) ||
            (s.id && s.id.toLowerCase().includes(q)) ||
            (s.campus && s.campus.toLowerCase().includes(q))
        );
    }, [students, studentSearch]);

    const activeStudent = filteredStudents[currentStudentIndex] || students[0] || null;

    const handlePrev = () => {
        setCurrentStudentIndex(prev => (prev > 0 ? prev - 1 : filteredStudents.length - 1));
    };
    const handleNext = () => {
        setCurrentStudentIndex(prev => (prev < filteredStudents.length - 1 ? prev + 1 : 0));
    };

    // -------------------------------------------------------------
    // 4. HIGH-FIDELITY PDF GENERATION (2-Tier Header with Out Of Marks)
    // -------------------------------------------------------------
    const loadFont = async (url) => {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Failed to load font: ${url}`);
            const blob = await res.blob();
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(blob);
            });
        } catch (err) {
            console.warn("[PDF] Font loading error:", url, err);
            return null;
        }
    };

    const loadImage = (src) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
        });
    };

    const renderStudentPDFPage = (doc, student, logoImg, fonts, customMaxMarks) => {
        if (fonts?.oswaldBold) {
            try {
                doc.addFileToVFS("Oswald-Bold.ttf", fonts.oswaldBold);
                doc.addFont("Oswald-Bold.ttf", "Oswald", "bold");
            } catch (e) { }
        }
        if (fonts?.libreBaskerville) {
            try {
                doc.addFileToVFS("LibreBaskerville-Regular.ttf", fonts.libreBaskerville);
                doc.addFont("LibreBaskerville-Regular.ttf", "LibreBaskerville", "normal");
            } catch (e) { }
        }
        if (fonts?.cormorantBold) {
            try {
                doc.addFileToVFS("CormorantGaramond-Bold.ttf", fonts.cormorantBold);
                doc.addFont("CormorantGaramond-Bold.ttf", "CormorantGaramond", "bold");
            } catch (e) { }
        }
        if (fonts?.cormorantItalic) {
            try {
                doc.addFileToVFS("CormorantGaramond-Italic.ttf", fonts.cormorantItalic);
                doc.addFont("CormorantGaramond-Italic.ttf", "CormorantGaramond", "italic");
            } catch (e) { }
        }
        if (fonts?.nunitoRegular) {
            try {
                doc.addFileToVFS("NunitoSans-Regular.ttf", fonts.nunitoRegular);
                doc.addFont("NunitoSans-Regular.ttf", "NunitoSans", "normal");
            } catch (e) { }
        }
        if (fonts?.nunitoBold) {
            try {
                doc.addFileToVFS("NunitoSans-Bold.ttf", fonts.nunitoBold);
                doc.addFont("NunitoSans-Bold.ttf", "NunitoSans", "bold");
            } catch (e) { }
        }

        const setFontOswald = () => {
            if (fonts?.oswaldBold) doc.setFont("Oswald", "bold");
            else doc.setFont("helvetica", "bold");
        };
        const setFontLibreBaskerville = () => {
            if (fonts?.libreBaskerville) doc.setFont("LibreBaskerville", "normal");
            else doc.setFont("times", "normal");
        };
        const setFontCormorantBold = () => {
            if (fonts?.cormorantBold) doc.setFont("CormorantGaramond", "bold");
            else doc.setFont("times", "bold");
        };
        const setFontCormorantItalic = () => {
            if (fonts?.cormorantItalic) doc.setFont("CormorantGaramond", "italic");
            else doc.setFont("times", "italic");
        };
        const setFontNunitoRegular = () => {
            if (fonts?.nunitoRegular) doc.setFont("NunitoSans", "normal");
            else doc.setFont("helvetica", "normal");
        };
        const setFontNunitoBold = () => {
            if (fonts?.nunitoBold) doc.setFont("NunitoSans", "bold");
            else doc.setFont("helvetica", "bold");
        };

        const drawBorderAndBackground = () => {
            const pageWidth = 210;
            const pageHeight = 297;
            doc.setFillColor(255, 253, 248);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');

            doc.setDrawColor(201, 150, 43);
            doc.setLineWidth(0.7);
            doc.rect(7.5, 7.5, pageWidth - 15, pageHeight - 15, 'S');

            doc.setLineWidth(0.25);
            doc.rect(9.2, 9.2, pageWidth - 18.4, pageHeight - 18.4, 'S');
        };

        drawBorderAndBackground();

        // 1. Logo
        if (logoImg) {
            const logoW = 18;
            const logoH = 18;
            const logoX = (210 - logoW) / 2;
            doc.addImage(logoImg, 'PNG', logoX, 12, logoW, logoH, undefined, 'FAST');
        }

        // 2. Title
        const titleY = 34.5;
        setFontOswald();
        doc.setFontSize(22);
        doc.setTextColor(10, 79, 196);
        const w1 = doc.getTextWidth("Sri Chaitanya ");

        setFontLibreBaskerville();
        doc.setFontSize(17);
        doc.setTextColor(26, 99, 200);
        const w2 = doc.getTextWidth("Educational Institutions");

        const startX = (210 - (w1 + w2)) / 2;

        setFontOswald();
        doc.setFontSize(22);
        doc.setTextColor(10, 79, 196);
        doc.text("Sri Chaitanya ", startX, titleY);

        setFontLibreBaskerville();
        doc.setFontSize(17);
        doc.setTextColor(26, 99, 200);
        doc.text("Educational Institutions", startX + w1, titleY);

        // 3. Ribbon: PROGRESS REPORT CARD
        const ribbonY = 40;
        const ribbonW = 86;
        const ribbonH = 7.2;
        const ribbonX = (210 - ribbonW) / 2;

        doc.setFillColor(15, 32, 87);
        doc.lines(
            [
                [ribbonW - 6, 0],
                [3, ribbonH],
                [-ribbonW, 0],
                [3, -ribbonH]
            ],
            ribbonX + 3, ribbonY, [1, 1], 'F', true
        );

        setFontNunitoBold();
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text("PROGRESS REPORT CARD", 105, ribbonY + 5.1, { align: 'center' });

        // 4. Student Info Table (Full Width - Photo/Initials Box Completely Removed)
        const infoY = 49.5;
        const infoX = 14;
        const infoW = 182;
        const infoH = 30;
        const labelW = 50;
        const valueW = infoW - labelW;

        const infoData = [
            { label: "Type of Report Card", value: "Academic", isBold: false },
            { label: "Name of the Student", value: student.name, isBold: true },
            { label: "Student ID", value: String(student.id || ''), isBold: true },
            { label: "Section", value: String(student.section || '-'), isBold: false },
            { label: "Campus and Stream", value: `${student.campus || 'Campus'} · ${student.stream || 'Stream'}`, isBold: false }
        ];

        const rowH = infoH / infoData.length;

        infoData.forEach((row, i) => {
            const y = infoY + (i * rowH);
            doc.setFillColor(241, 244, 251);
            doc.setDrawColor(207, 214, 232);
            doc.setLineWidth(0.25);
            doc.rect(infoX, y, labelW, rowH, 'FD');

            setFontNunitoBold();
            doc.setFontSize(8.5);
            doc.setTextColor(15, 32, 87);
            doc.text(row.label, infoX + 4, y + (rowH * 0.68));

            doc.setFillColor(255, 253, 248);
            doc.rect(infoX + labelW, y, valueW, rowH, 'FD');

            if (row.isBold) setFontNunitoBold();
            else setFontNunitoRegular();
            doc.setFontSize(8.5);
            doc.setTextColor(20, 32, 74);
            doc.text(String(row.value), infoX + labelW + 4, y + (rowH * 0.68));
        });

        let currentY = infoY + infoH + 6;

        // 5. Render Tables for Each Active Stream (2-Tier Header matching Image 2!)
        const streamOrder = ['MEDICAL', 'ENGG_MAIN', 'ENGG_ADV', 'ENGG', 'KCET_MED', 'KCET_ENGG', 'CBSE', 'PU'];
        const activeStreamKeys = streamOrder.filter(k => student.streamTests[k] && student.streamTests[k].length > 0);
        const streamsToRender = activeStreamKeys.length > 0 ? activeStreamKeys : selectedStreams;

        streamsToRender.forEach(stKey => {
            const tests = student.streamTests[stKey] || [];
            // Dynamically determine all active subjects: configured, defaults, or from test marks!
            const subs = [...new Set([
                ...(student.streamAverages?.[stKey]?.subjects || []),
                ...(streamSubjects[stKey] || []),
                ...(STREAM_PRESETS[stKey]?.defaultSubjects || []),
                ...tests.flatMap(t => Object.keys(t.marks || {}))
            ])].filter(Boolean);
            const stLabel = STREAM_PRESETS[stKey]?.label || stKey;
            const maxMap = customMaxMarks?.[stKey] || student.streamMaxMarks?.[stKey] || streamMaxMarks[stKey] || {};
            const totalMaxVal = getStreamTotalMax(stKey, subs, maxMap);

            if (currentY + 45 > 265) {
                doc.addPage();
                drawBorderAndBackground();
                currentY = 22;
            }

            setFontCormorantBold();
            doc.setFontSize(13);
            doc.setTextColor(15, 32, 87);
            doc.text(`${stLabel} - Test-wise record`, infoX, currentY);
            currentY += 4;

            // Sizing columns dynamically to prevent subject header wrapping
            const numSubs = subs.length;
            const testW = numSubs <= 4 ? 28 : numSubs <= 6 ? 24 : numSubs <= 8 ? 22 : 20;
            const dateW = numSubs <= 4 ? 20 : numSubs <= 6 ? 17 : numSubs <= 8 ? 15 : 14;
            const totalW = numSubs <= 4 ? 18 : numSubs <= 6 ? 15 : numSubs <= 8 ? 14 : 13;
            const fixedW = testW + dateW + totalW;
            const remainingW = infoW - fixedW;

            // Subject length-based weights for intelligent proportional width allocation
            const getSubWeight = (sub) => {
                const len = (sub || '').length;
                if (len <= 2) return 2.2; // e.g. IP, PE
                if (len <= 4) return 3.2; // e.g. PHY, MAT
                if (len <= 5) return 4.2; // e.g. MATHS
                if (len <= 7) return 5.8; // e.g. PHYSICS, ENGLISH, BIOLOGY
                if (len <= 9) return 7.2; // e.g. CHEMISTRY
                if (len <= 12) return 8.5;
                return 10.5; // e.g. COMPUTER SCIENCE
            };

            const weights = subs.map(getSubWeight);
            const minColW = numSubs <= 6 ? 12 : numSubs <= 8 ? 9.5 : 8.5;
            const shortIndices = [];
            let shortWidthSum = 0;
            subs.forEach((s, i) => {
                if ((s || '').length <= 2) {
                    shortIndices.push(i);
                    shortWidthSum += minColW;
                }
            });

            const nonShortWeight = weights.reduce((sum, w, i) => shortIndices.includes(i) ? sum : sum + w, 0);
            const remainingForNonShort = remainingW - shortWidthSum;

            const proportionalWidths = subs.map((s, i) => {
                if (shortIndices.includes(i)) return minColW;
                return (weights[i] / (nonShortWeight || 1)) * remainingForNonShort;
            });

            let allocatedSum = 0;
            const finalSubWidths = proportionalWidths.map((w, i) => {
                if (i === proportionalWidths.length - 1) {
                    return Math.max(minColW, Math.round((remainingW - allocatedSum) * 10) / 10);
                }
                const rounded = Math.max(minColW, Math.round(w * 10) / 10);
                allocatedSum += rounded;
                return rounded;
            });

            const tableFontSize = numSubs <= 4 ? 8.5 : numSubs <= 6 ? 7.6 : numSubs <= 8 ? 6.8 : 6.2;

            // 2-TIER TABLE HEADER (Subject Names on Row 1, Out Of Marks on Row 2)
            const headRow1 = [
                { content: "Test", rowSpan: 2, styles: { valign: 'middle', halign: 'left', cellWidth: testW } },
                { content: "Date", rowSpan: 2, styles: { valign: 'middle', halign: 'center', cellWidth: dateW } },
                { content: "Total", styles: { halign: 'center', cellWidth: totalW } },
                ...subs.map((sub, idx) => {
                    const colW = finalSubWidths[idx];
                    const usableW = colW - 1.2;
                    let fSize = tableFontSize;
                    doc.setFont('NunitoSans', 'bold');
                    doc.setFontSize(fSize);
                    while (doc.getTextWidth(sub) > usableW && fSize > 4.8) {
                        fSize -= 0.2;
                        doc.setFontSize(fSize);
                    }
                    return {
                        content: sub,
                        styles: {
                            halign: 'center',
                            valign: 'middle',
                            fontSize: fSize,
                            cellWidth: colW,
                            cellPadding: { top: 1.8, bottom: 1.8, left: 0.5, right: 0.5 }
                        }
                    };
                })
            ];

            const headRow2 = [
                { content: String(totalMaxVal), styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.2, textColor: [252, 211, 77], cellWidth: totalW } },
                ...subs.map((sub, idx) => ({
                    content: String(maxMap[sub] ?? (stKey === 'ENGG_MAIN' ? 100 : stKey.startsWith('KCET') ? 60 : 100)),
                    styles: { halign: 'center', fontStyle: 'bold', fontSize: 7.2, textColor: [252, 211, 77], cellWidth: finalSubWidths[idx] }
                }))
            ];

            const tableRows = tests.map(t => {
                const hasSubjectMarks = t.marks && subs.some(s => t.marks[s] !== undefined && t.marks[s] !== null && String(t.marks[s]).trim() !== '');
                if (t.isAB && !hasSubjectMarks) {
                    return [
                        { content: t.testName, styles: { textColor: [198, 45, 71], fontStyle: 'bold', halign: 'left' } },
                        { content: formatDate(t.date), styles: { textColor: [198, 45, 71], fontStyle: 'bold', halign: 'center' } },
                        { content: 'Absent', colSpan: subs.length + 1, styles: { halign: 'center', textColor: [198, 45, 71], fontStyle: 'bold' } }
                    ];
                }
                return [
                    { content: t.testName, styles: { fontStyle: 'bold', halign: 'left' } },
                    { content: formatDate(t.date), styles: { fontStyle: 'bold', halign: 'center' } },
                    { content: formatTotalDisplay(t.total), styles: { fontStyle: 'bold', halign: 'center' } },
                    ...subs.map(sub => {
                        const mVal = t.marks?.[sub];
                        const isAb = isAbsentMark(mVal);
                        return {
                            content: formatMarkDisplay(mVal),
                            styles: {
                                fontStyle: 'bold',
                                halign: 'center',
                                textColor: isAb ? [198, 45, 71] : [20, 32, 74]
                            }
                        };
                    })
                ];
            });

            // Average Row
            const avgData = student.streamAverages?.[stKey];
            tableRows.push([
                { content: "Average", colSpan: 2, styles: { fontStyle: 'bold', halign: 'left', fillColor: [241, 244, 251] } },
                { content: formatTotalDisplay(avgData?.avgTotal), styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 244, 251] } },
                ...subs.map(sub => {
                    const avgVal = avgData?.subjectAverages?.[sub];
                    return {
                        content: formatMarkDisplay(avgVal),
                        styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 244, 251] }
                    };
                })
            ]);

            const columnStyles = {
                0: { halign: 'left', fontStyle: 'bold', cellWidth: testW },
                1: { halign: 'center', fontStyle: 'bold', cellWidth: dateW },
                2: { halign: 'center', fontStyle: 'bold', cellWidth: totalW }
            };
            subs.forEach((_, idx) => {
                columnStyles[3 + idx] = { halign: 'center', fontStyle: 'bold', cellWidth: finalSubWidths[idx] };
            });

            autoTable(doc, {
                head: [headRow1, headRow2],
                body: tableRows,
                startY: currentY,
                margin: { left: 14, right: 14 },
                theme: 'plain',
                headStyles: {
                    fillColor: [15, 32, 87],
                    textColor: [255, 255, 255],
                    font: 'NunitoSans',
                    fontStyle: 'bold',
                    fontSize: tableFontSize,
                    halign: 'center',
                    valign: 'middle',
                    cellPadding: { top: 1.8, bottom: 1.8, left: 0.5, right: 0.5 },
                    lineColor: [207, 214, 232],
                    lineWidth: 0.2
                },
                styles: {
                    font: 'NunitoSans',
                    fontSize: tableFontSize,
                    textColor: [20, 32, 74],
                    lineColor: [207, 214, 232],
                    lineWidth: 0.2,
                    valign: 'middle',
                    cellPadding: { top: 1.6, bottom: 1.6, left: 0.5, right: 0.5 }
                },
                columnStyles,
                didDrawCell: (data) => {
                    if (data.row.index === tableRows.length - 1) {
                        doc.setDrawColor(201, 150, 43);
                        doc.setLineWidth(0.6);
                        doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
                    }
                }
            });

            currentY = doc.lastAutoTable.finalY + 6;
        });

        // 6. Attendance Table (Render ONLY if attendance data is entered AND enabled)
        if (includeAttendance && hasAttendanceData(student)) {
            const att = student.attendance;

            if (currentY + 30 > 265) {
                doc.addPage();
                drawBorderAndBackground();
                currentY = 22;
            }

            setFontCormorantBold();
            doc.setFontSize(13);
            doc.setTextColor(15, 32, 87);
            doc.text("Attendance Record", infoX, currentY);
            currentY += 4;

            autoTable(doc, {
                head: [["TOTAL NO.OF WORKING DAYS", "ABSENT", "PRESENT", "SICK", "TOTAL"]],
                body: [[
                    String(att.workingDays || '-'),
                    String(att.absent || '0'),
                    String(att.present || '-'),
                    String(att.sick || '0'),
                    String(att.total || '-')
                ]],
                startY: currentY,
                margin: { left: 14, right: 14 },
                theme: 'plain',
                headStyles: {
                    fillColor: [15, 32, 87],
                    textColor: [255, 255, 255],
                    font: 'NunitoSans',
                    fontStyle: 'bold',
                    fontSize: 8,
                    halign: 'center',
                    valign: 'middle',
                    cellPadding: 2,
                    lineColor: [207, 214, 232],
                    lineWidth: 0.2
                },
                styles: {
                    font: 'NunitoSans',
                    fontSize: 8.5,
                    fontStyle: 'bold',
                    textColor: [20, 32, 74],
                    lineColor: [207, 214, 232],
                    lineWidth: 0.2,
                    valign: 'middle',
                    halign: 'center',
                    cellPadding: 1.8
                }
            });

            currentY = doc.lastAutoTable.finalY + 6;
        }

        // 7. Signatures Footer
        const sigY = 271;
        doc.setDrawColor(207, 214, 232);
        doc.setLineWidth(0.3);
        doc.line(22, sigY, 70, sigY);
        doc.line(82, sigY, 128, sigY);
        doc.line(140, sigY, 188, sigY);

        setFontNunitoRegular();
        doc.setFontSize(8.5);
        doc.setTextColor(93, 103, 136);
        doc.text("Class Teacher", 46, sigY + 4.5, { align: 'center' });
        doc.text("Parent / Guardian", 105, sigY + 4.5, { align: 'center' });
        doc.text("Principal", 164, sigY + 4.5, { align: 'center' });
    };

    // -------------------------------------------------------------
    // 5. DOWNLOAD PDF HANDLERS
    // -------------------------------------------------------------
    const handleDownloadPDF = async (mode = 'combined') => {
        if (!students || students.length === 0) {
            setStatusMessage({ type: 'error', text: 'No student data uploaded yet!' });
            return;
        }

        setIsDownloading(true);
        setDownloadProgress({ current: 0, total: students.length, status: 'Initializing PDF assets...' });

        try {
            const [
                logoImg,
                oswaldBold,
                libreBaskerville,
                cormorantBold,
                cormorantItalic,
                nunitoRegular,
                nunitoBold
            ] = await Promise.all([
                loadImage('/logo.png'),
                loadFont('/fonts/Oswald-Bold.ttf'),
                loadFont('/fonts/LibreBaskerville-Regular.ttf'),
                loadFont('/fonts/CormorantGaramond-Bold.ttf'),
                loadFont('/fonts/CormorantGaramond-Italic.ttf'),
                loadFont('/fonts/NunitoSans-Regular.ttf'),
                loadFont('/fonts/NunitoSans-Bold.ttf')
            ]);

            const fonts = {
                oswaldBold,
                libreBaskerville,
                cormorantBold,
                cormorantItalic,
                nunitoRegular,
                nunitoBold
            };

            if (mode === 'current') {
                setDownloadProgress({ current: 1, total: 1, status: `Generating PDF for ${activeStudent.name}...` });
                const doc = new jsPDF('p', 'mm', 'a4');
                renderStudentPDFPage(doc, activeStudent, logoImg, fonts, streamMaxMarks);
                const safeName = (activeStudent.name || 'Student').replace(/[/\\?%*:|"<>]/g, '_').trim();
                const fileName = `${safeName}_${activeStudent.id}_Progress_Report.pdf`;
                doc.save(fileName);
                setStatusMessage({ type: 'success', text: `Downloaded "${fileName}"!` });
                logActivity(userData, 'Downloaded Single Custom Progress PDF', { student: activeStudent.name });
            } else if (mode === 'combined') {
                const total = students.length;
                const doc = new jsPDF('p', 'mm', 'a4');

                for (let i = 0; i < total; i++) {
                    const st = students[i];
                    setDownloadProgress({ current: i + 1, total, status: `Appending student ${i + 1} of ${total}: ${st.name}` });
                    if (i > 0) doc.addPage();
                    renderStudentPDFPage(doc, st, logoImg, fonts, streamMaxMarks);
                    if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
                }

                const fileName = `${selectedStreams.join('_')}_Progress_Reports_All_Students.pdf`;
                doc.save(fileName);
                setStatusMessage({ type: 'success', text: `Downloaded combined PDF "${fileName}" for all ${total} students!` });
                logActivity(userData, 'Downloaded Combined Custom Progress PDF', { totalStudents: total, streams: selectedStreams });
            } else if (mode === 'zip') {
                const zip = new JSZip();
                const total = students.length;

                for (let i = 0; i < total; i++) {
                    const st = students[i];
                    setDownloadProgress({ current: i + 1, total, status: `Generating file ${i + 1} of ${total}: ${st.name}` });
                    const doc = new jsPDF('p', 'mm', 'a4');
                    renderStudentPDFPage(doc, st, logoImg, fonts, streamMaxMarks);

                    const pdfBuffer = doc.output('arraybuffer');
                    const safeName = (st.name || 'Student').replace(/[/\\?%*:|"<>]/g, '_').trim();
                    const pdfFileName = `${st.id}_${safeName}_Progress_Report.pdf`;
                    zip.file(pdfFileName, pdfBuffer);

                    if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
                }

                setDownloadProgress({ current: total, total, status: 'Compressing ZIP archive...' });
                const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 2 } });
                const zipFileName = `${selectedStreams.join('_')}_Individual_Progress_Reports.zip`;
                saveAs(zipBlob, zipFileName);
                setStatusMessage({ type: 'success', text: `Downloaded individual PDFs in "${zipFileName}" (${total} files)!` });
                logActivity(userData, 'Downloaded Custom Progress ZIP', { totalStudents: total, streams: selectedStreams });
            }
        } catch (err) {
            console.error('PDF Generation Error:', err);
            setStatusMessage({ type: 'error', text: `Failed to generate PDF: ${err.message}` });
        } finally {
            setIsDownloading(false);
        }
    };

    // Helper to generate a single student PDF directly
    const generateSinglePDF = async (student, customMaxMarks) => {
        const [
            logoImg,
            oswaldBold,
            libreBaskerville,
            cormorantBold,
            cormorantItalic,
            nunitoRegular,
            nunitoBold
        ] = await Promise.all([
            loadImage('/logo.png'),
            loadFont('/fonts/Oswald-Bold.ttf'),
            loadFont('/fonts/LibreBaskerville-Regular.ttf'),
            loadFont('/fonts/CormorantGaramond-Bold.ttf'),
            loadFont('/fonts/CormorantGaramond-Italic.ttf'),
            loadFont('/fonts/NunitoSans-Regular.ttf'),
            loadFont('/fonts/NunitoSans-Bold.ttf')
        ]);

        const fonts = {
            oswaldBold,
            libreBaskerville,
            cormorantBold,
            cormorantItalic,
            nunitoRegular,
            nunitoBold
        };

        const doc = new jsPDF('p', 'mm', 'a4');
        renderStudentPDFPage(doc, student, logoImg, fonts, customMaxMarks);
        const safeName = (student.name || 'Student').replace(/[/\\?%*:|"<>]/g, '_').trim();
        const fileName = `${safeName}_${student.id}_Progress_Report.pdf`;
        doc.save(fileName);
        return fileName;
    };

    // -------------------------------------------------------------
    // TOP SEARCH BAR: SEARCH & QUICK DOWNLOAD BY STUDENT ID (From Memory or TiDB)
    // -------------------------------------------------------------
    const handleQuickDownloadStudent = async (targetIdInput) => {
        const queryId = String(targetIdInput || searchStudentId || '').trim();
        if (!queryId) {
            setStatusMessage({ type: 'error', text: 'Please enter a Student ID to search and download the progress report.' });
            return;
        }

        setShowSuggestions(false);
        setIsSearchingStudent(true);
        setStatusMessage({ type: 'info', text: `Searching for student ID "${queryId}"...` });

        try {
            // 1. Check in local uploaded state first
            const normalized = queryId.toUpperCase();
            let foundStudent = students.find(s =>
                String(s.id).trim().toUpperCase() === normalized ||
                String(s.name).trim().toUpperCase() === normalized
            );

            if (foundStudent) {
                const sIdx = students.findIndex(s => s === foundStudent);
                if (sIdx !== -1) setCurrentStudentIndex(sIdx);

                setStatusMessage({ type: 'info', text: `Generating progress report PDF for "${foundStudent.name}"...` });
                const fileName = await generateSinglePDF(foundStudent, streamMaxMarks);
                setStatusMessage({
                    type: 'success',
                    text: `Downloaded progress report "${fileName}" for ${foundStudent.name} (${foundStudent.id})!`
                });
                logActivity(userData, 'Downloaded Progress Report by ID Search', { studentId: foundStudent.id, source: 'local' });
                return;
            }

            // 2. Fetch from Database
            setStatusMessage({ type: 'info', text: `Looking up student ID "${queryId}"...` });
            const res = await fetch(`${API_URL}/api/custom-progress/student/${encodeURIComponent(queryId)}?academicYear=2026`);
            if (res.ok) {
                const data = await res.json();
                const remoteStudent = data.student;
                const remoteMaxMarks = data.streamMaxMarks || streamMaxMarks;

                if (data.streamMaxMarks) {
                    setStreamMaxMarks(prev => ({ ...prev, ...data.streamMaxMarks }));
                }

                // Add to students list and set as current
                setStudents(prev => {
                    const idx = prev.findIndex(s => String(s.id).toUpperCase() === String(remoteStudent.id).toUpperCase());
                    if (idx !== -1) {
                        const copy = [...prev];
                        copy[idx] = remoteStudent;
                        return copy;
                    }
                    return [remoteStudent, ...prev];
                });
                setCurrentStudentIndex(0);

                // Auto-select stream if needed
                const remoteStreams = Object.keys(remoteStudent.streamTests || {});
                if (remoteStreams.length > 0) {
                    setSelectedStreams(prev => [...new Set([...prev, ...remoteStreams])]);
                }

                setStatusMessage({ type: 'info', text: `Generating PDF for "${remoteStudent.name}"...` });
                const fileName = await generateSinglePDF(remoteStudent, remoteMaxMarks);
                setStatusMessage({
                    type: 'success',
                    text: `Found student "${remoteStudent.name}" (${remoteStudent.id}) and downloaded "${fileName}"!`
                });
                logActivity(userData, 'Downloaded Progress Report by ID Search', { studentId: remoteStudent.id, source: data.source });
            } else {
                const errData = await res.json().catch(() => ({}));
                setStatusMessage({
                    type: 'error',
                    text: errData.error || `Student ID "${queryId}" was not found in uploaded list or database.`
                });
            }
        } catch (err) {
            console.error('Error downloading student by ID:', err);
            setStatusMessage({ type: 'error', text: `Failed to download student progress: ${err.message}` });
        } finally {
            setIsSearchingStudent(false);
        }
    };

    const handlePreviewStudent = async (targetIdInput) => {
        const queryId = String(targetIdInput || searchStudentId || '').trim();
        if (!queryId) {
            setStatusMessage({ type: 'error', text: 'Please enter a Student ID to preview.' });
            return;
        }

        setShowSuggestions(false);
        setIsSearchingStudent(true);

        try {
            const normalized = queryId.toUpperCase();
            let foundStudent = students.find(s =>
                String(s.id).trim().toUpperCase() === normalized ||
                String(s.name).trim().toUpperCase() === normalized
            );

            if (foundStudent) {
                const sIdx = students.findIndex(s => s === foundStudent);
                if (sIdx !== -1) setCurrentStudentIndex(sIdx);
                setStatusMessage({
                    type: 'success',
                    text: `Loaded preview for ${foundStudent.name} (${foundStudent.id}).`
                });
                return;
            }

            // Lookup from Database
            const res = await fetch(`${API_URL}/api/custom-progress/student/${encodeURIComponent(queryId)}?academicYear=2026`);
            if (res.ok) {
                const data = await res.json();
                const remoteStudent = data.student;

                if (data.streamMaxMarks) {
                    setStreamMaxMarks(prev => ({ ...prev, ...data.streamMaxMarks }));
                }

                setStudents(prev => {
                    const idx = prev.findIndex(s => String(s.id).toUpperCase() === String(remoteStudent.id).toUpperCase());
                    if (idx !== -1) {
                        const copy = [...prev];
                        copy[idx] = remoteStudent;
                        return copy;
                    }
                    return [remoteStudent, ...prev];
                });
                setCurrentStudentIndex(0);

                const remoteStreams = Object.keys(remoteStudent.streamTests || {});
                if (remoteStreams.length > 0) {
                    setSelectedStreams(prev => [...new Set([...prev, ...remoteStreams])]);
                }

                setStatusMessage({
                    type: 'success',
                    text: `Loaded preview for "${remoteStudent.name}" (${remoteStudent.id})!`
                });
            } else {
                const errData = await res.json().catch(() => ({}));
                setStatusMessage({
                    type: 'error',
                    text: errData.error || `Student ID "${queryId}" not found in uploaded list or database.`
                });
            }
        } catch (err) {
            console.error('Preview student error:', err);
            setStatusMessage({ type: 'error', text: `Failed to load preview: ${err.message}` });
        } finally {
            setIsSearchingStudent(false);
        }
    };

    // Auto-search suggestions debounce
    useEffect(() => {
        if (!searchStudentId || searchStudentId.trim().length < 2) {
            setSearchSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        const query = searchStudentId.trim();
        const normQ = query.toLowerCase();

        // 1. Local suggestions
        const localMatches = students.filter(s =>
            (s.id && String(s.id).toLowerCase().includes(normQ)) ||
            (s.name && String(s.name).toLowerCase().includes(normQ))
        ).slice(0, 5).map(s => ({
            id: s.id,
            name: s.name,
            campus: s.campus,
            source: 'Uploaded'
        }));

        setSearchSuggestions(localMatches);
        setShowSuggestions(localMatches.length > 0);

        // 2. Fetch from Database suggestions
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`${API_URL}/api/custom-progress/search?q=${encodeURIComponent(query)}&academicYear=2026`);
                if (res.ok) {
                    const data = await res.json();
                    const remoteMatches = (data.results || []).map(r => ({
                        ...r,
                        source: r.source === 'CUSTOM_PROGRESS' ? 'Saved' : 'NEET'
                    }));

                    // Deduplicate with localMatches
                    const combined = [...localMatches];
                    remoteMatches.forEach(rm => {
                        if (!combined.some(c => String(c.id).toUpperCase() === String(rm.id).toUpperCase())) {
                            combined.push(rm);
                        }
                    });
                    setSearchSuggestions(combined.slice(0, 8));
                    setShowSuggestions(combined.length > 0);
                }
            } catch (e) { }
        }, 300);

        return () => clearTimeout(timer);
    }, [searchStudentId, students]);

    return (
        <div className="custom-progress-report-container" style={{ padding: '24px 28px', maxWidth: '1440px', margin: '0 auto' }}>
            {/* Top Header Card */}
            <div style={{
                background: 'linear-gradient(135deg, #0F2057 0%, #1E3A8A 100%)',
                color: '#ffffff',
                padding: '24px 30px',
                borderRadius: '12px',
                marginBottom: '24px',
                boxShadow: '0 8px 24px rgba(15, 32, 87, 0.15)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '24px' }}>📋</span>
                        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', letterSpacing: '0.4px' }}>
                            Custom Progress Report
                        </h1>
                        <span style={{
                            background: '#C9962B',
                            color: '#0F2057',
                            fontSize: '11px',
                            fontWeight: '800',
                            padding: '3px 9px',
                            borderRadius: '12px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.8px'
                        }}>
                            NEET · JEE · KCET · CBSE · PU
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#E2E8F0', maxWidth: '780px', lineHeight: '1.5' }}>
                        Generate combined progress reports with KCET support (Medical PCB: Physics, Chemistry, Biology; Engg PCM: Physics, Chemistry, Maths), custom out-of-marks, and attendance records.
                    </p>
                </div>
            </div>

            {/* Notification Alert */}
            {statusMessage && (
                <div style={{
                    padding: '12px 18px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontSize: '14px',
                    backgroundColor: statusMessage.type === 'error' ? '#FEF2F2' : statusMessage.type === 'success' ? '#F0FDF4' : '#F0F9FF',
                    border: `1px solid ${statusMessage.type === 'error' ? '#FECACA' : statusMessage.type === 'success' ? '#BBF7D0' : '#BAE6FD'}`,
                    color: statusMessage.type === 'error' ? '#991B1B' : statusMessage.type === 'success' ? '#166534' : '#0369A1'
                }}>
                    {statusMessage.type === 'error' ? <AlertCircle size={18} /> : statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <RefreshCw size={18} className="animate-spin" />}
                    <span style={{ fontWeight: '500' }}>{statusMessage.text}</span>
                </div>
            )}

            {/* Top Search Bar: Direct Student ID Download & Preview */}
            <div style={{
                background: '#FFFFFF',
                border: '1.5px solid #C9962B',
                borderRadius: '12px',
                padding: '20px 24px',
                marginBottom: '24px',
                boxShadow: '0 4px 16px rgba(15, 32, 87, 0.08)',
                position: 'relative'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: '#0F2057',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#C9962B'
                        }}>
                            <Search size={18} />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F2057' }}>
                                Download Student Progress Report by ID
                            </h2>
                            <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748B' }}>
                                Enter any Student ID below to instantly download or preview their progress report PDF.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Form Input + Action Buttons */}
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleQuickDownloadStudent();
                    }}
                    style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', position: 'relative' }}
                    ref={searchContainerRef}
                >
                    <div style={{ flex: '1 1 300px', position: 'relative' }}>
                        <Search size={17} color="#94A3B8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder="Enter Student ID (e.g. SC1001, 2026012...)"
                            value={searchStudentId}
                            onChange={(e) => setSearchStudentId(e.target.value)}
                            onFocus={() => { if (searchSuggestions.length > 0) setShowSuggestions(true); }}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '12px 38px 12px 40px',
                                borderRadius: '8px',
                                border: '1.5px solid #CBD5E1',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: '#0F2057',
                                outline: 'none',
                                transition: 'border-color 0.15s ease'
                            }}
                        />
                        {searchStudentId && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchStudentId('');
                                    setShowSuggestions(false);
                                }}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#94A3B8',
                                    cursor: 'pointer',
                                    padding: '2px'
                                }}
                            >
                                <X size={16} />
                            </button>
                        )}

                        {/* Suggestions Dropdown */}
                        {showSuggestions && searchSuggestions.length > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '100%',
                                left: 0,
                                right: 0,
                                zIndex: 50,
                                background: '#FFFFFF',
                                border: '1px solid #CBD5E1',
                                borderRadius: '8px',
                                marginTop: '4px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                maxHeight: '240px',
                                overflowY: 'auto'
                            }}>
                                {searchSuggestions.map((s, idx) => (
                                    <div
                                        key={idx}
                                        onClick={() => {
                                            setSearchStudentId(s.id);
                                            setShowSuggestions(false);
                                            handleQuickDownloadStudent(s.id);
                                        }}
                                        style={{
                                            padding: '10px 14px',
                                            cursor: 'pointer',
                                            borderBottom: idx < searchSuggestions.length - 1 ? '1px solid #F1F5F9' : 'none',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            transition: 'background 0.1s ease'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#FFFFFF'}
                                    >
                                        <div>
                                            <strong style={{ fontSize: '13.5px', color: '#0F2057' }}>{s.id}</strong>
                                            <span style={{ margin: '0 8px', color: '#CBD5E1' }}>·</span>
                                            <span style={{ fontSize: '13px', color: '#334155' }}>{s.name}</span>
                                            {s.campus && <span style={{ fontSize: '11.5px', color: '#64748B', marginLeft: '6px' }}>({s.campus})</span>}
                                        </div>
                                        <span style={{
                                            fontSize: '11px',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            background: s.source === 'Uploaded' ? '#F0FDF4' : '#EFF6FF',
                                            color: s.source === 'Uploaded' ? '#15803D' : '#1D4ED8',
                                            fontWeight: '700'
                                        }}>
                                            {s.source}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Download Button (Primary) */}
                    <button
                        type="submit"
                        disabled={isSearchingStudent}
                        style={{
                            background: '#0F2057',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '12px 22px',
                            fontSize: '13.5px',
                            fontWeight: '700',
                            cursor: isSearchingStudent ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 8px rgba(15, 32, 87, 0.25)',
                            whiteSpace: 'nowrap',
                            opacity: isSearchingStudent ? 0.75 : 1
                        }}
                    >
                        {isSearchingStudent ? (
                            <RefreshCw size={17} className="animate-spin" />
                        ) : (
                            <Download size={17} color="#C9962B" />
                        )}
                        <span>{isSearchingStudent ? 'Searching & Downloading...' : 'Download Progress Report (PDF)'}</span>
                    </button>

                    {/* Preview Button (Secondary) */}
                    <button
                        type="button"
                        onClick={() => handlePreviewStudent()}
                        disabled={isSearchingStudent}
                        style={{
                            background: '#F8FAFC',
                            color: '#0F2057',
                            border: '1.5px solid #CBD5E1',
                            borderRadius: '8px',
                            padding: '12px 18px',
                            fontSize: '13.5px',
                            fontWeight: '700',
                            cursor: isSearchingStudent ? 'wait' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '7px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <Eye size={16} />
                        <span>Preview Report</span>
                    </button>
                </form>
            </div>

            {/* Top Control Grid: 1. Stream Selection | 2. Subjects & Out-of-Marks | 3. Template & Upload */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '20px',
                marginBottom: '26px'
            }}>
                {/* Panel 1: Multi-Stream & Attendance Selector */}
                <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F2057', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Layers size={18} color="#0A4FC4" />
                            1. Select Stream(s) (Multi-Select)
                        </h3>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#0A4FC4', background: '#EFF6FF', padding: '2px 8px', borderRadius: '6px' }}>
                            {selectedStreams.length} Selected
                        </span>
                    </div>

                    {/* 7 Stream Cards (including Engineering JEE Mains and Engineering JEE Adv) */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                        {Object.values(STREAM_PRESETS).filter(st => st.id !== 'ENGG').map(st => {
                            const isSelected = selectedStreams.includes(st.id);
                            return (
                                <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => handleToggleStream(st.id)}
                                    style={{
                                        background: isSelected ? '#EFF6FF' : '#F8FAFC',
                                        border: `2px solid ${isSelected ? '#0A4FC4' : '#E2E8F0'}`,
                                        borderRadius: '8px',
                                        padding: '9px 11px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '3px',
                                        position: 'relative'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '16px' }}>{st.icon}</span>
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '4px',
                                            border: `1.5px solid ${isSelected ? '#0A4FC4' : '#CBD5E1'}`,
                                            background: isSelected ? '#0A4FC4' : '#FFFFFF',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            {isSelected && <Check size={13} color="#FFFFFF" strokeWidth={3} />}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '12.5px', fontWeight: '700', color: isSelected ? '#0A4FC4' : '#1E293B', lineHeight: '1.3' }}>
                                        {st.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Attendance Toggle Card */}
                    <label
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            background: includeAttendance ? '#F0FDF4' : '#F8FAFC',
                            border: `2px solid ${includeAttendance ? '#16A34A' : '#E2E8F0'}`,
                            cursor: 'pointer',
                            userSelect: 'none'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '18px' }}>📅</span>
                            <div>
                                <strong style={{ fontSize: '13px', color: includeAttendance ? '#15803D' : '#1E293B', display: 'block' }}>
                                    Include Attendance Table
                                </strong>
                                <span style={{ fontSize: '11px', color: '#64748B' }}>
                                    Working Days, Absent, Present, Sick & Total
                                </span>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={includeAttendance}
                            onChange={(e) => setIncludeAttendance(e.target.checked)}
                            style={{ width: '16px', height: '16px', accentColor: '#16A34A', cursor: 'pointer' }}
                        />
                    </label>
                </div>

                {/* Panel 2: Subject Checkboxes + Out of Marks Input */}
                <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F2057', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <BookOpen size={18} color="#0A4FC4" />
                                2. Subjects & Out-of-Marks
                            </h3>
                        </div>

                        {/* Quick Preset Buttons */}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => handleSetAllMaxMarks(activeConfigTab, 60)}
                                title="Set all checked subjects to 60 (KCET standard)"
                                style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '4px', padding: '2px 6px', fontSize: '10.5px', fontWeight: '700', color: '#1D4ED8', cursor: 'pointer' }}
                            >
                                /60 (KCET)
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSetAllMaxMarks(activeConfigTab, 100)}
                                title="Set all checked subjects to 100 (JEE Mains standard)"
                                style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '4px', padding: '2px 6px', fontSize: '10.5px', fontWeight: '700', color: '#0F2057', cursor: 'pointer' }}
                            >
                                /100 (Mains)
                            </button>
                            {(activeConfigTab === 'ENGG_ADV' || activeConfigTab === 'MEDICAL' || activeConfigTab === 'CBSE') && (
                                <button
                                    type="button"
                                    onClick={() => handleSetAllMaxMarks(activeConfigTab, 120)}
                                    title="Set all checked subjects to 120 (JEE Adv standard)"
                                    style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '4px', padding: '2px 6px', fontSize: '10.5px', fontWeight: '700', color: '#1D4ED8', cursor: 'pointer' }}
                                >
                                    /120 (Adv)
                                </button>
                            )}
                            {(activeConfigTab === 'MEDICAL' || activeConfigTab === 'ENGG_ADV') && (
                                <button
                                    type="button"
                                    onClick={() => handleSetAllMaxMarks(activeConfigTab, 180)}
                                    title="Set all subjects to 180 (NEET / Adv total)"
                                    style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '4px', padding: '2px 6px', fontSize: '10.5px', fontWeight: '700', color: '#1D4ED8', cursor: 'pointer' }}
                                >
                                    /180
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Stream Tabs if multiple streams selected */}
                    {selectedStreams.length > 1 && (
                        <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', borderBottom: '1px solid #E2E8F0', paddingBottom: '6px', overflowX: 'auto' }}>
                            {selectedStreams.map(k => {
                                const isCurrent = activeConfigTab === k;
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        onClick={() => setActiveConfigTab(k)}
                                        style={{
                                            background: isCurrent ? '#0F2057' : '#F1F5F9',
                                            color: isCurrent ? '#FFFFFF' : '#334155',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '4px 9px',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        <span>{STREAM_PRESETS[k].icon}</span>
                                        <span>{STREAM_PRESETS[k].label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Subject Checkbox Grid with Out Of Marks Input */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                        gap: '8px',
                        maxHeight: '135px',
                        overflowY: 'auto',
                        padding: '4px',
                        marginBottom: '10px'
                    }}>
                        {[
                            ...STREAM_PRESETS[activeConfigTab].availableSubjects,
                            ...(customAddedSubjects[activeConfigTab] || [])
                        ].map(sub => {
                            const isChecked = (streamSubjects[activeConfigTab] || []).includes(sub);
                            const maxVal = streamMaxMarks[activeConfigTab]?.[sub] ?? (activeConfigTab.startsWith('KCET') ? 60 : 100);

                            return (
                                <div
                                    key={sub}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '6px',
                                        padding: '5px 8px',
                                        borderRadius: '6px',
                                        background: isChecked ? '#EFF6FF' : '#F8FAFC',
                                        border: `1px solid ${isChecked ? '#93C5FD' : '#E2E8F0'}`,
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1, minWidth: 0 }}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleToggleSubject(activeConfigTab, sub)}
                                            style={{ accentColor: '#0A4FC4', cursor: 'pointer', width: '13px', height: '13px', flexShrink: 0 }}
                                        />
                                        <span style={{ fontSize: '11.5px', fontWeight: isChecked ? '700' : '500', color: isChecked ? '#1D4ED8' : '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {sub}
                                        </span>
                                    </label>

                                    {/* Out of Marks Input */}
                                    {isChecked && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                            <span style={{ fontSize: '10.5px', color: '#64748B', fontWeight: '600' }}>/</span>
                                            <input
                                                type="number"
                                                title={`Out of marks for ${sub}`}
                                                value={maxVal}
                                                onChange={(e) => handleMaxMarkChange(activeConfigTab, sub, e.target.value)}
                                                style={{
                                                    width: '44px',
                                                    padding: '2px 3px',
                                                    fontSize: '11px',
                                                    fontWeight: '700',
                                                    textAlign: 'center',
                                                    borderRadius: '4px',
                                                    border: '1px solid #93C5FD',
                                                    background: '#FFFFFF',
                                                    color: '#0F2057',
                                                    outline: 'none'
                                                }}
                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Controls Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <form onSubmit={handleAddCustomSubject} style={{ display: 'flex', gap: '6px', flex: 1 }}>
                            <input
                                type="text"
                                placeholder={`+ Add subject to ${STREAM_PRESETS[activeConfigTab].label}...`}
                                value={newSubjectInput}
                                onChange={(e) => setNewSubjectInput(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    border: '1px solid #CBD5E1',
                                    fontSize: '11.5px',
                                    outline: 'none'
                                }}
                            />
                            <button
                                type="submit"
                                style={{
                                    background: '#F1F5F9',
                                    border: '1px solid #CBD5E1',
                                    color: '#1E293B',
                                    padding: '5px 10px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                <Plus size={13} />
                            </button>
                        </form>

                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                                type="button"
                                onClick={handleSelectAllForTab}
                                style={{ background: 'transparent', border: 'none', color: '#0A4FC4', fontSize: '11px', fontWeight: '700', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                                All
                            </button>
                            <span style={{ color: '#cbd5e1' }}>|</span>
                            <button
                                type="button"
                                onClick={handleResetDefaultsForTab}
                                style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                            >
                                Reset
                            </button>
                        </div>
                    </div>
                </div>

                {/* Panel 3: Template Download & Excel Upload */}
                <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                }}>
                    <div>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F2057', marginTop: 0, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <FileSpreadsheet size={18} color="#0A4FC4" />
                            3. Download Template & Upload
                        </h3>

                        {/* Download Template Button */}
                        <button
                            type="button"
                            onClick={handleDownloadTemplate}
                            style={{
                                width: '100%',
                                background: '#0F2057',
                                color: '#FFFFFF',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px 16px',
                                fontSize: '13px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                marginBottom: '14px',
                                boxShadow: '0 2px 6px rgba(15, 32, 87, 0.2)'
                            }}
                        >
                            <Download size={16} color="#C9962B" />
                            Download {selectedStreams.map(k => STREAM_PRESETS[k].label).join(' & ')} Template (.xlsx)
                        </button>
                    </div>

                    {/* Drag and Drop Zone */}
                    <div
                        onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${dragActive ? '#0A4FC4' : '#CBD5E1'}`,
                            background: dragActive ? '#EFF6FF' : '#F8FAFC',
                            borderRadius: '8px',
                            padding: '14px 16px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                            accept=".xlsx, .xls, .csv"
                            style={{ display: 'none' }}
                        />
                        <Upload size={22} color={dragActive ? '#0A4FC4' : '#64748B'} style={{ margin: '0 auto 6px auto', display: 'block' }} />
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B', display: 'block' }}>
                            {uploadedFileName ? `Loaded: ${uploadedFileName}` : 'Click to Upload or Drag & Drop File'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                            Reads marks, attendance, and out-of-marks references
                        </span>
                    </div>
                </div>
            </div>

            {/* Empty State */}
            {students.length === 0 ? (
                <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '60px 24px',
                    textAlign: 'center',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)'
                }}>
                    <FileSpreadsheet size={48} color="#94A3B8" style={{ margin: '0 auto 16px auto', display: 'block' }} />
                    <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1E293B', margin: '0 0 8px 0' }}>
                        No Custom Progress Data Uploaded Yet
                    </h3>
                    <p style={{ fontSize: '14px', color: '#64748B', maxWidth: '520px', margin: '0 auto 20px auto', lineHeight: '1.5' }}>
                        Configure streams (including KCET Medical & Engineering), out-of-marks, download the Excel template, and upload your file.
                    </p>
                    <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        style={{
                            background: '#0F2057',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 20px',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px'
                        }}
                    >
                        <Download size={16} color="#C9962B" />
                        Download Template Now
                    </button>
                </div>
            ) : (
                <>
                    {/* Action Toolbar */}
                    <div style={{
                        background: '#FFFFFF',
                        border: '1px solid #E2E8F0',
                        borderRadius: '12px',
                        padding: '16px 20px',
                        marginBottom: '24px',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '16px'
                    }}>
                        {/* Student Switcher & Search */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                    type="button"
                                    onClick={handlePrev}
                                    title="Previous Student"
                                    style={{
                                        background: '#F1F5F9',
                                        border: '1px solid #CBD5E1',
                                        borderRadius: '6px',
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1E293B', minWidth: '120px', textAlign: 'center' }}>
                                    Student {currentStudentIndex + 1} of {filteredStudents.length}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    title="Next Student"
                                    style={{
                                        background: '#F1F5F9',
                                        border: '1px solid #CBD5E1',
                                        borderRadius: '6px',
                                        width: '32px',
                                        height: '32px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>

                            {/* Search Filter */}
                            <div style={{ position: 'relative' }}>
                                <Search size={14} color="#94A3B8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                                <input
                                    type="text"
                                    placeholder="Search by student name or ID..."
                                    value={studentSearch}
                                    onChange={(e) => {
                                        setStudentSearch(e.target.value);
                                        setCurrentStudentIndex(0);
                                    }}
                                    style={{
                                        padding: '7px 12px 7px 30px',
                                        borderRadius: '6px',
                                        border: '1px solid #CBD5E1',
                                        fontSize: '13px',
                                        width: '240px',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        {/* PDF Download Options */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <button
                                type="button"
                                onClick={() => handleDownloadPDF('combined')}
                                disabled={isDownloading}
                                style={{
                                    background: '#0F2057',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '9px 16px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: isDownloading ? 'wait' : 'pointer',
                                    opacity: isDownloading ? 0.7 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 2px 6px rgba(15, 32, 87, 0.2)'
                                }}
                            >
                                <Printer size={16} color="#C9962B" />
                                Download All (Single Combined PDF)
                            </button>

                            <button
                                type="button"
                                onClick={() => handleDownloadPDF('zip')}
                                disabled={isDownloading}
                                style={{
                                    background: '#059669',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '9px 16px',
                                    fontSize: '13px',
                                    fontWeight: '700',
                                    cursor: isDownloading ? 'wait' : 'pointer',
                                    opacity: isDownloading ? 0.7 : 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 2px 6px rgba(5, 150, 105, 0.2)'
                                }}
                            >
                                <Archive size={16} />
                                Download All (Individual PDFs - ZIP)
                            </button>

                            <button
                                type="button"
                                onClick={() => handleDownloadPDF('current')}
                                disabled={isDownloading}
                                style={{
                                    background: '#F1F5F9',
                                    color: '#1E293B',
                                    border: '1px solid #CBD5E1',
                                    borderRadius: '8px',
                                    padding: '9px 14px',
                                    fontSize: '13px',
                                    fontWeight: '600',
                                    cursor: isDownloading ? 'wait' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <Download size={15} />
                                Download Current PDF
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    {isDownloading && (
                        <div style={{
                            background: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                            borderRadius: '8px',
                            padding: '12px 18px',
                            marginBottom: '20px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px', fontWeight: '600', color: '#1E40AF' }}>
                                <span>{downloadProgress.status || 'Generating PDF files...'}</span>
                                <span>{downloadProgress.current} / {downloadProgress.total}</span>
                            </div>
                            <div style={{ background: '#DBEAFE', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                                <div style={{
                                    background: '#0A4FC4',
                                    height: '100%',
                                    width: `${downloadProgress.total > 0 ? (downloadProgress.current / downloadProgress.total) * 100 : 0}%`,
                                    transition: 'width 0.2s ease'
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Webview Progress Report Sheet */}
                    {activeStudent && (
                        <div className="report-card-wrapper" style={{ display: 'flex', justifyContent: 'center', margin: '20px 0 40px 0' }}>
                            <div className="report-card-sheet" style={{
                                backgroundColor: '#FFFDF8',
                                color: '#14204A',
                                width: '100%',
                                maxWidth: '880px',
                                padding: '32px 36px 40px 36px',
                                boxShadow: '0 8px 30px rgba(15, 32, 87, 0.12)',
                                position: 'relative',
                                boxSizing: 'border-box',
                                fontFamily: "'Nunito Sans', sans-serif",
                                border: '2px solid #C9962B',
                                borderRadius: '2px'
                            }}>
                                {/* Header */}
                                <div className="rc-header">
                                    <img src="/logo.png" alt="Sri Chaitanya Logo" className="rc-logo" />
                                    <div className="rc-title">
                                        <span className="rc-title-primary">Sri Chaitanya</span>
                                        <span className="rc-title-secondary">Educational Institutions</span>
                                    </div>
                                    <div className="rc-ribbon-container">
                                        <div className="rc-ribbon">PROGRESS REPORT CARD</div>
                                    </div>
                                </div>

                                {/* Student Info Section (Full Width, No Photo) */}
                                <div style={{ marginTop: '24px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ backgroundColor: '#F1F4FB', color: '#0F2057', fontWeight: 700, fontSize: '13px', padding: '9px 16px', width: '25%', border: '1px solid #CFD6E8' }}>
                                                    Type of Report Card
                                                </td>
                                                <td style={{ backgroundColor: '#FFFDF8', color: '#14204A', fontWeight: 700, fontSize: '13.5px', padding: '9px 16px', border: '1px solid #CFD6E8' }}>
                                                    Academic
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style={{ backgroundColor: '#F1F4FB', color: '#0F2057', fontWeight: 700, fontSize: '13px', padding: '9px 16px', border: '1px solid #CFD6E8' }}>
                                                    Name of the Student
                                                </td>
                                                <td style={{ backgroundColor: '#FFFDF8', color: '#14204A', fontWeight: 700, fontSize: '13.5px', padding: '9px 16px', border: '1px solid #CFD6E8' }}>
                                                    {activeStudent.name || '-'}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style={{ backgroundColor: '#F1F4FB', color: '#0F2057', fontWeight: 700, fontSize: '13px', padding: '9px 16px', border: '1px solid #CFD6E8' }}>
                                                    Student ID
                                                </td>
                                                <td style={{ backgroundColor: '#FFFDF8', color: '#14204A', fontWeight: 700, fontSize: '13.5px', padding: '9px 16px', border: '1px solid #CFD6E8' }}>
                                                    {activeStudent.id || '-'}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style={{ backgroundColor: '#F1F4FB', color: '#0F2057', fontWeight: 700, fontSize: '13px', padding: '9px 16px', border: '1px solid #CFD6E8' }}>
                                                    Section
                                                </td>
                                                <td style={{ backgroundColor: '#FFFDF8', color: '#14204A', fontWeight: 600, fontSize: '13.5px', padding: '9px 16px', border: '1px solid #CFD6E8' }}>
                                                    {activeStudent.section || '-'}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style={{ backgroundColor: '#F1F4FB', color: '#0F2057', fontWeight: 700, fontSize: '13px', padding: '9px 16px', border: '1px solid #CFD6E8' }}>
                                                    Campus and Stream
                                                </td>
                                                <td style={{ backgroundColor: '#FFFDF8', color: '#14204A', fontWeight: 700, fontSize: '13.5px', padding: '9px 16px', border: '1px solid #CFD6E8' }}>
                                                    {activeStudent.campus || '-'} · {activeStudent.stream || '-'}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Dynamic Tables for Each Selected Stream (2-Tier Header with Out-of-Marks) */}
                                {['MEDICAL', 'ENGG_MAIN', 'ENGG_ADV', 'ENGG', 'KCET_MED', 'KCET_ENGG', 'CBSE', 'PU']
                                    .filter(stKey => (activeStudent.streamTests[stKey] && activeStudent.streamTests[stKey].length > 0) || selectedStreams.includes(stKey))
                                    .map(stKey => {
                                        const tests = activeStudent.streamTests[stKey] || [];
                                        const subs = [...new Set([
                                            ...(activeStudent.streamAverages?.[stKey]?.subjects || []),
                                            ...(streamSubjects[stKey] || []),
                                            ...(STREAM_PRESETS[stKey]?.defaultSubjects || []),
                                            ...tests.flatMap(t => Object.keys(t.marks || {}))
                                        ])].filter(Boolean);
                                        const avgData = activeStudent.streamAverages?.[stKey];
                                        const stLabel = STREAM_PRESETS[stKey]?.label || stKey;
                                        const totalMaxVal = getStreamTotalMax(stKey, subs);

                                        return (
                                            <div key={stKey} style={{ marginTop: '26px' }}>
                                                <h3 style={{
                                                    fontFamily: "'Cormorant Garamond', serif",
                                                    fontSize: '20px',
                                                    fontWeight: '700',
                                                    color: '#0F2057',
                                                    margin: '0 0 10px 0',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px'
                                                }}>
                                                    <span>{STREAM_PRESETS[stKey]?.icon}</span>
                                                    <span>{stLabel} - Test-wise record</span>
                                                </h3>

                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', minWidth: subs.length > 6 ? '780px' : '650px', borderCollapse: 'collapse', textAlign: 'center' }}>
                                                        {/* 2-TIER TABLE HEADER */}
                                                        <thead>
                                                            <tr style={{ background: '#0F2057', color: '#ffffff' }}>
                                                                <th rowSpan={2} style={{ padding: '8px 10px', textAlign: 'left', border: '1px solid #CFD6E8', fontSize: '13px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Test</th>
                                                                <th rowSpan={2} style={{ padding: '8px 8px', border: '1px solid #CFD6E8', fontSize: '13px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>Date</th>
                                                                <th style={{ padding: '6px 8px', border: '1px solid #CFD6E8', fontSize: '13px', whiteSpace: 'nowrap' }}>Total Marks</th>
                                                                {subs.map(sub => (
                                                                    <th key={sub} style={{
                                                                        padding: '6px 8px',
                                                                        border: '1px solid #CFD6E8',
                                                                        fontSize: subs.length > 7 ? '11px' : subs.length > 5 ? '12px' : '13px',
                                                                        whiteSpace: 'nowrap',
                                                                        letterSpacing: '0.2px'
                                                                    }}>
                                                                        {sub}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                            {/* Second Tier Header: OUT OF / MAX MARKS */}
                                                            <tr style={{ background: '#172B6B', color: '#FCD34D' }}>
                                                                <th style={{ padding: '4px 10px', border: '1px solid #CFD6E8', fontSize: '12px', fontWeight: '800', whiteSpace: 'nowrap' }}>
                                                                    {totalMaxVal}
                                                                </th>
                                                                {subs.map(sub => (
                                                                    <th key={sub} style={{ padding: '4px 8px', border: '1px solid #CFD6E8', fontSize: '12px', fontWeight: '800', whiteSpace: 'nowrap' }}>
                                                                        {streamMaxMarks[stKey]?.[sub] ?? (stKey === 'ENGG_MAIN' ? 100 : stKey.startsWith('KCET') ? 60 : 100)}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {tests.length === 0 ? (
                                                                <tr>
                                                                    <td colSpan={subs.length + 3} style={{ padding: '12px', color: '#64748B', fontStyle: 'italic', border: '1px solid #CFD6E8' }}>
                                                                        No exam records uploaded for this stream.
                                                                    </td>
                                                                </tr>
                                                            ) : (
                                                                tests.map((t, idx) => {
                                                                    const hasSubjectMarks = t.marks && subs.some(s => t.marks[s] !== undefined && t.marks[s] !== null && String(t.marks[s]).trim() !== '');
                                                                    if (t.isAB && !hasSubjectMarks) {
                                                                        return (
                                                                            <tr key={idx} style={{ background: '#FFF5F5', color: '#C62D47' }}>
                                                                                <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', border: '1px solid #CFD6E8', whiteSpace: 'nowrap' }}>{t.testName}</td>
                                                                                <td style={{ padding: '8px 10px', fontWeight: '700', border: '1px solid #CFD6E8', whiteSpace: 'nowrap' }}>{formatDate(t.date)}</td>
                                                                                <td colSpan={subs.length + 1} style={{ padding: '8px 10px', fontWeight: '700', textAlign: 'center', border: '1px solid #CFD6E8' }}>
                                                                                    Absent
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    }
                                                                    return (
                                                                        <tr key={idx} style={{ borderBottom: '1px solid #CFD6E8' }}>
                                                                            <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', color: '#14204A', border: '1px solid #CFD6E8', whiteSpace: 'nowrap' }}>{t.testName}</td>
                                                                            <td style={{ padding: '8px 10px', fontWeight: '600', color: '#14204A', border: '1px solid #CFD6E8', whiteSpace: 'nowrap' }}>{formatDate(t.date)}</td>
                                                                            <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0F2057', border: '1px solid #CFD6E8', whiteSpace: 'nowrap' }}>{formatTotalDisplay(t.total)}</td>
                                                                            {subs.map(sub => {
                                                                                const mVal = t.marks?.[sub];
                                                                                const isAb = isAbsentMark(mVal);
                                                                                return (
                                                                                    <td key={sub} style={{
                                                                                        padding: '8px 10px',
                                                                                        fontWeight: '700',
                                                                                        color: isAb ? '#C62D47' : '#14204A',
                                                                                        border: '1px solid #CFD6E8',
                                                                                        whiteSpace: 'nowrap'
                                                                                    }}>
                                                                                        {formatMarkDisplay(mVal)}
                                                                                    </td>
                                                                                );
                                                                            })}
                                                                        </tr>
                                                                    );
                                                                })
                                                            )}

                                                            {/* Average Row */}
                                                            {tests.length > 0 && (
                                                                <tr style={{ background: '#F1F4FB', borderTop: '2px solid #C9962B', fontWeight: '800', color: '#0F2057' }}>
                                                                    <td colSpan={2} style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #CFD6E8', whiteSpace: 'nowrap' }}>Average</td>
                                                                    <td style={{ padding: '8px 10px', border: '1px solid #CFD6E8', whiteSpace: 'nowrap' }}>{formatTotalDisplay(avgData?.avgTotal)}</td>
                                                                    {subs.map(sub => (
                                                                        <td key={sub} style={{ padding: '8px 10px', border: '1px solid #CFD6E8', whiteSpace: 'nowrap' }}>
                                                                            {formatMarkDisplay(avgData?.subjectAverages?.[sub])}
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        );
                                    })}

                                {/* Attendance Table (Render ONLY if attendance data is entered AND enabled) */}
                                {includeAttendance && hasAttendanceData(activeStudent) && (
                                    <div style={{ marginTop: '26px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '20px', fontWeight: '700', color: '#0F2057', margin: 0 }}>
                                                Attendance Record
                                            </h3>
                                            {activeStudent.attendance?.percentage && (
                                                <span style={{ background: '#DCFCE7', color: '#15803D', fontWeight: '800', fontSize: '12px', padding: '3px 10px', borderRadius: '12px', border: '1px solid #86EFAC' }}>
                                                    {activeStudent.attendance.percentage} Attendance
                                                </span>
                                            )}
                                        </div>

                                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                            <thead>
                                                <tr style={{ background: '#0F2057', color: '#ffffff' }}>
                                                    <th style={{ padding: '8px 12px', border: '1px solid #CFD6E8', fontSize: '12.5px', fontWeight: '700', whiteSpace: 'nowrap' }}>TOTAL NO.OF WORKING DAYS</th>
                                                    <th style={{ padding: '8px 12px', border: '1px solid #CFD6E8', fontSize: '12.5px', fontWeight: '700', whiteSpace: 'nowrap' }}>ABSENT</th>
                                                    <th style={{ padding: '8px 12px', border: '1px solid #CFD6E8', fontSize: '12.5px', fontWeight: '700', whiteSpace: 'nowrap' }}>PRESENT</th>
                                                    <th style={{ padding: '8px 12px', border: '1px solid #CFD6E8', fontSize: '12.5px', fontWeight: '700', whiteSpace: 'nowrap' }}>SICK</th>
                                                    <th style={{ padding: '8px 12px', border: '1px solid #CFD6E8', fontSize: '12.5px', fontWeight: '700', whiteSpace: 'nowrap' }}>TOTAL</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr style={{ background: '#FFFDF8', fontWeight: '700', color: '#14204A' }}>
                                                    <td style={{ padding: '9px 12px', border: '1px solid #CFD6E8', fontSize: '13px', whiteSpace: 'nowrap' }}>{activeStudent.attendance?.workingDays || '-'}</td>
                                                    <td style={{ padding: '9px 12px', border: '1px solid #CFD6E8', fontSize: '13px', whiteSpace: 'nowrap', color: (Number(activeStudent.attendance?.absent) > 0) ? '#C62D47' : '#14204A' }}>
                                                        {activeStudent.attendance?.absent || '0'}
                                                    </td>
                                                    <td style={{ padding: '9px 12px', border: '1px solid #CFD6E8', fontSize: '13px', whiteSpace: 'nowrap', color: '#0F2057' }}>{activeStudent.attendance?.present || '-'}</td>
                                                    <td style={{ padding: '9px 12px', border: '1px solid #CFD6E8', fontSize: '13px', whiteSpace: 'nowrap' }}>{activeStudent.attendance?.sick || '0'}</td>
                                                    <td style={{ padding: '9px 12px', border: '1px solid #CFD6E8', fontSize: '13px', whiteSpace: 'nowrap', fontWeight: '800' }}>{activeStudent.attendance?.total || '-'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {/* Signatures Footer */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    paddingTop: '36px',
                                    marginTop: '28px'
                                }}>
                                    {[
                                        'Class Teacher',
                                        'Parent / Guardian',
                                        'Principal'
                                    ].map(title => (
                                        <div key={title} style={{ textAlign: 'center', width: '160px' }}>
                                            <div style={{ borderBottom: '1px solid #CFD6E8', marginBottom: '8px', width: '100%' }} />
                                            <span style={{ fontSize: '12px', color: '#5D6788', fontWeight: '600' }}>
                                                {title}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default CustomProgressReport;
