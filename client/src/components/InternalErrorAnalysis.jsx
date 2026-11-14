import React, { useState, useEffect, useMemo, useRef } from 'react';
import Select from 'react-select';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { API_URL } from '../utils/apiHelper';
import {
    Upload,
    FileSpreadsheet,
    Download,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    Sliders,
    Search,
    Building2,
    BookOpen,
    HelpCircle,
    Check,
    FileText,
    Save,
    Calculator,
    GraduationCap
} from 'lucide-react';

// Robust CSV parser that handles quoted strings and newlines inside cells
function parseCSV(text) {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                currentCell += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === ',' && !insideQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !insideQuotes) {
            if (char === '\r' && nextChar === '\n') {
                i++;
            }
            currentRow.push(currentCell.trim());
            currentCell = '';
            if (currentRow.length > 0 && currentRow.some(c => c !== '')) {
                rows.push(currentRow);
            }
            currentRow = [];
        } else {
            currentCell += char;
        }
    }
    if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c !== '')) {
            rows.push(currentRow);
        }
    }
    return rows;
}

const STREAM_OPTIONS = [
    // Medical / NEET Streams
    { value: 'SR ELITE', label: 'SR ELITE (NEET)' },
    { value: 'SR ELITE(P - I)', label: 'SR ELITE(P - I)' },
    { value: 'SR ELITE(P - II)', label: 'SR ELITE(P - II)' },
    { value: 'SR ELITE(S - I)', label: 'SR ELITE(S - I)' },
    { value: 'SR ELITE(S - II)', label: 'SR ELITE(S - II)' },
    { value: 'JR ELITE', label: 'JR ELITE (NEET)' },
    { value: 'JR ELITE(P - I)', label: 'JR ELITE(P - I)' },
    { value: 'JR ELITE(P - II)', label: 'JR ELITE(P - II)' },
    { value: 'SR AIIMS', label: 'SR AIIMS' },
    { value: 'JR AIIMS', label: 'JR AIIMS' },
    { value: 'LTC', label: 'LTC' },
    // Engineering Streams
    { value: 'SR IPL', label: 'SR IPL (Engineering)' },
    { value: 'JR IPL', label: 'JR IPL (Engineering)' },
    { value: 'SR CHAINA', label: 'SR CHAINA (Engineering)' },
    { value: 'JR CHAINA', label: 'JR CHAINA (Engineering)' },
    { value: 'SR NEON', label: 'SR NEON (Engineering)' },
    { value: 'JR NEON', label: 'JR NEON (Engineering)' },
    { value: 'SR SPARK', label: 'SR SPARK (Engineering)' },
    { value: 'JR SPARK', label: 'JR SPARK (Engineering)' },
    { value: 'ENGINEERING', label: 'ENGINEERING' }
];

const InternalErrorAnalysis = ({ academicYear = '2026', restrictedCampus = [] }) => {
    // Top-level filters
    const [campusOptions, setCampusOptions] = useState([]);
    const [selectedCampus, setSelectedCampus] = useState(null);
    const [selectedStream, setSelectedStream] = useState(STREAM_OPTIONS[0]);
    const [testName, setTestName] = useState('');

    // Exam Mode: 'neet' or 'engineering'
    const [examMode, setExamMode] = useState('neet');

    // CSV File state
    const [csvFile, setCsvFile] = useState(null);
    const [csvFileName, setCsvFileName] = useState('');
    const [parsedRows, setParsedRows] = useState(null);
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [detectedInfo, setDetectedInfo] = useState(null);
    const [dragActive, setDragActive] = useState(false);

    // Subject question ranges (configurable by user)
    const [ranges, setRanges] = useState({
        math: { start: 0, end: 0 },
        botany: { start: 1, end: 45 },
        zoology: { start: 46, end: 90 },
        physics: { start: 91, end: 135 },
        chemistry: { start: 136, end: 180 }
    });

    // Processing & Results
    const [isProcessing, setIsProcessing] = useState(false);
    const [analysisResults, setAnalysisResults] = useState(null);
    const [studentLookupMap, setStudentLookupMap] = useState({});
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [pageNumber, setPageNumber] = useState(1);
    const pageSize = 50;

    // Status / Messages
    const [statusMessage, setStatusMessage] = useState(null);
    const [savedToServerPath, setSavedToServerPath] = useState(null);

    const fileInputRef = useRef(null);

    // Determine if Engineering mode is active (either explicit mode or Math entry has numbers)
    const isEngineering = examMode === 'engineering' || (ranges.math.start > 0 || ranges.math.end > 0);

    // Load Campuses on mount
    useEffect(() => {
        const fetchCampuses = async () => {
            try {
                const res = await fetch(`${API_URL}/api/campuses`);
                const data = await res.json();
                if (data && Array.isArray(data.campuses)) {
                    let list = data.campuses;
                    if (Array.isArray(restrictedCampus) && restrictedCampus.length > 0) {
                        const normAllowed = restrictedCampus.map(c => c.trim().toUpperCase());
                        list = list.filter(c => normAllowed.includes(c.trim().toUpperCase()));
                    }
                    const options = list.map(c => ({ value: c, label: c }));
                    setCampusOptions(options);

                    if (options.length > 0 && !selectedCampus) {
                        setSelectedCampus(options[0]);
                    }
                }
            } catch (err) {
                console.error('Failed to fetch campuses:', err);
            }
        };
        fetchCampuses();
    }, [restrictedCampus]);

    // Handle CSV file selection and parsing
    const handleFile = (file) => {
        if (!file) return;
        if (!file.name.endsWith('.csv')) {
            setStatusMessage({ type: 'error', text: 'Please upload a valid .csv file.' });
            return;
        }

        setCsvFile(file);
        setCsvFileName(file.name);
        setStatusMessage(null);
        setAnalysisResults(null);
        setSavedToServerPath(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const rows = parseCSV(text);

                if (rows.length < 2) {
                    setStatusMessage({ type: 'error', text: 'CSV file contains insufficient rows.' });
                    return;
                }

                // Check row 0 for test title or metadata
                const titleCandidate = rows[0][0] || '';
                const headerRow = rows[1];

                // Check how many questions are present
                let qCount = 0;
                for (let i = 2; i < headerRow.length; i++) {
                    if (headerRow[i] && headerRow[i].toUpperCase().startsWith('Q')) {
                        qCount++;
                    }
                }
                if (qCount === 0) qCount = Math.max(0, headerRow.length - 2);

                const studentCount = rows.length - 2;

                setParsedRows(rows);
                setCsvHeaders(headerRow);
                setDetectedInfo({
                    totalStudents: studentCount,
                    totalQuestions: qCount,
                    rawTitle: titleCandidate
                });

                // Auto-detect exam type from title or question count
                const upperTitle = titleCandidate.toUpperCase();
                const isEngTitle = upperTitle.includes('JEE') || upperTitle.includes('ENG') || upperTitle.includes('MATH') || upperTitle.includes('IPL') || upperTitle.includes('CHAINA') || qCount <= 90;

                if (isEngTitle) {
                    setExamMode('engineering');
                    // Pre-fill default engineering ranges if math is not set
                    if (qCount <= 75) {
                        setRanges({
                            math: { start: 1, end: 25 },
                            botany: { start: 0, end: 0 },
                            zoology: { start: 0, end: 0 },
                            physics: { start: 26, end: 50 },
                            chemistry: { start: 51, end: 75 }
                        });
                    } else {
                        setRanges({
                            math: { start: 1, end: 30 },
                            botany: { start: 0, end: 0 },
                            zoology: { start: 0, end: 0 },
                            physics: { start: 31, end: 60 },
                            chemistry: { start: 61, end: 90 }
                        });
                    }
                } else {
                    setExamMode('neet');
                    setRanges({
                        math: { start: 0, end: 0 },
                        botany: { start: 1, end: 45 },
                        zoology: { start: 46, end: 90 },
                        physics: { start: 91, end: 135 },
                        chemistry: { start: 136, end: 180 }
                    });
                }

                // Auto-fill Test Name if currently empty and available in row 0
                if (titleCandidate) {
                    const cleanTitle = titleCandidate.split('\n')[0].trim();
                    if (cleanTitle && !testName) {
                        setTestName(cleanTitle);
                    }

                    // Also try detecting stream
                    for (const opt of STREAM_OPTIONS) {
                        if (cleanTitle.toUpperCase().includes(opt.value.toUpperCase())) {
                            setSelectedStream(opt);
                            break;
                        }
                    }
                }

                setStatusMessage({
                    type: 'success',
                    text: `Loaded ${file.name} successfully! Detected ${studentCount} students and ${qCount} questions.`
                });
            } catch (err) {
                console.error('Error reading CSV:', err);
                setStatusMessage({ type: 'error', text: `Failed to parse CSV: ${err.message}` });
            }
        };
        reader.readAsText(file);
    };

    // Range change handler: If user types into Math, automatically switch to Engineering mode and disable Botany/Zoology!
    const handleRangeChange = (subject, field, value) => {
        const val = parseInt(value, 10) || 0;

        if (subject === 'math' && val > 0) {
            setExamMode('engineering');
            setRanges(prev => ({
                ...prev,
                botany: { start: 0, end: 0 },
                zoology: { start: 0, end: 0 },
                [subject]: {
                    ...prev[subject],
                    [field]: val
                }
            }));
            return;
        }

        setRanges(prev => ({
            ...prev,
            [subject]: {
                ...prev[subject],
                [field]: val
            }
        }));
    };

    // Switch exam mode explicitly
    const handleModeSwitch = (mode) => {
        setExamMode(mode);
        if (mode === 'engineering') {
            setRanges({
                math: { start: 1, end: 25 },
                botany: { start: 0, end: 0 },
                zoology: { start: 0, end: 0 },
                physics: { start: 26, end: 50 },
                chemistry: { start: 51, end: 75 }
            });
            // Suggest engineering stream if current is NEET
            if (selectedStream?.value?.includes('ELITE') && !selectedStream?.value?.includes('IPL')) {
                setSelectedStream(STREAM_OPTIONS.find(s => s.value === 'ENGINEERING') || selectedStream);
            }
        } else {
            setRanges({
                math: { start: 0, end: 0 },
                botany: { start: 1, end: 45 },
                zoology: { start: 46, end: 90 },
                physics: { start: 91, end: 135 },
                chemistry: { start: 136, end: 180 }
            });
            setSelectedStream(STREAM_OPTIONS[0]);
        }
    };

    // Quick range presets
    const applyPreset = (presetType) => {
        if (presetType === 'neet_45') {
            setExamMode('neet');
            setRanges({
                math: { start: 0, end: 0 },
                botany: { start: 1, end: 45 },
                zoology: { start: 46, end: 90 },
                physics: { start: 91, end: 135 },
                chemistry: { start: 136, end: 180 }
            });
        } else if (presetType === 'eng_25') {
            setExamMode('engineering');
            setRanges({
                math: { start: 1, end: 25 },
                botany: { start: 0, end: 0 },
                zoology: { start: 0, end: 0 },
                physics: { start: 26, end: 50 },
                chemistry: { start: 51, end: 75 }
            });
        } else if (presetType === 'eng_30') {
            setExamMode('engineering');
            setRanges({
                math: { start: 1, end: 30 },
                botany: { start: 0, end: 0 },
                zoology: { start: 0, end: 0 },
                physics: { start: 31, end: 60 },
                chemistry: { start: 61, end: 90 }
            });
        }
    };

    // Generate Analysis Logic
    const handleGenerate = async () => {
        if (!parsedRows || parsedRows.length < 3) {
            setStatusMessage({ type: 'error', text: 'Please upload a CSV file with student responses first.' });
            return;
        }

        setIsProcessing(true);
        setStatusMessage({ type: 'info', text: 'Analyzing student responses and querying student master details...' });

        try {
            const studentRows = parsedRows.slice(2);
            const rollNumbers = studentRows.map(r => r[0]?.trim()).filter(Boolean);

            // Step 1: Lookup student names & sections from DB
            let lookupMap = {};
            try {
                setIsLookingUp(true);
                const res = await fetch(`${API_URL}/api/internal-error/lookup-students`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        academicYear,
                        campus: selectedCampus?.value,
                        stream: selectedStream?.value,
                        test: testName,
                        studentIds: rollNumbers
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.students) {
                        lookupMap = data.students;
                        setStudentLookupMap(data.students);
                    }
                }
            } catch (err) {
                console.warn('Student lookup error (will proceed with #N/A):', err);
            } finally {
                setIsLookingUp(false);
            }

            // Step 2: Compute counts and question lists for each student
            const results = [];
            let totalWrongAcrossAll = 0;
            let totalUnAcrossAll = 0;

            const isEng = isEngineering;

            for (let i = 0; i < studentRows.length; i++) {
                const row = studentRows[i];
                const roll = row[0]?.trim();
                if (!roll) continue;

                const studentInfo = lookupMap[roll] || {};
                const name = studentInfo.name || '#N/A';
                const section = studentInfo.section || '#N/A';

                const allWrong = [];
                const allUn = [];

                // Engineering: Math, Physics, Chemistry
                const mathW = [], mathU = [];
                // Medical: Botany, Zoology, Physics, Chemistry
                const botW = [], botU = [];
                const zooW = [], zooU = [];
                // Common: Physics, Chemistry
                const phyW = [], phyU = [];
                const cheW = [], cheU = [];

                const maxQ = Math.max(180, row.length - 2);
                for (let q = 1; q <= maxQ; q++) {
                    const colIdx = q + 1;
                    const ans = row[colIdx] ? row[colIdx].trim().toUpperCase() : '';

                    if (ans === 'W') {
                        allWrong.push(q);
                        if (isEng) {
                            if (ranges.math.start > 0 && q >= ranges.math.start && q <= ranges.math.end) {
                                mathW.push(q);
                            } else if (ranges.physics.start > 0 && q >= ranges.physics.start && q <= ranges.physics.end) {
                                phyW.push(q);
                            } else if (ranges.chemistry.start > 0 && q >= ranges.chemistry.start && q <= ranges.chemistry.end) {
                                cheW.push(q);
                            }
                        } else {
                            if (ranges.botany.start > 0 && q >= ranges.botany.start && q <= ranges.botany.end) {
                                botW.push(q);
                            } else if (ranges.zoology.start > 0 && q >= ranges.zoology.start && q <= ranges.zoology.end) {
                                zooW.push(q);
                            } else if (ranges.physics.start > 0 && q >= ranges.physics.start && q <= ranges.physics.end) {
                                phyW.push(q);
                            } else if (ranges.chemistry.start > 0 && q >= ranges.chemistry.start && q <= ranges.chemistry.end) {
                                cheW.push(q);
                            }
                        }
                    } else if (ans === 'U') {
                        allUn.push(q);
                        if (isEng) {
                            if (ranges.math.start > 0 && q >= ranges.math.start && q <= ranges.math.end) {
                                mathU.push(q);
                            } else if (ranges.physics.start > 0 && q >= ranges.physics.start && q <= ranges.physics.end) {
                                phyU.push(q);
                            } else if (ranges.chemistry.start > 0 && q >= ranges.chemistry.start && q <= ranges.chemistry.end) {
                                cheU.push(q);
                            }
                        } else {
                            if (ranges.botany.start > 0 && q >= ranges.botany.start && q <= ranges.botany.end) {
                                botU.push(q);
                            } else if (ranges.zoology.start > 0 && q >= ranges.zoology.start && q <= ranges.zoology.end) {
                                zooU.push(q);
                            } else if (ranges.physics.start > 0 && q >= ranges.physics.start && q <= ranges.physics.end) {
                                phyU.push(q);
                            } else if (ranges.chemistry.start > 0 && q >= ranges.chemistry.start && q <= ranges.chemistry.end) {
                                cheU.push(q);
                            }
                        }
                    }
                }

                totalWrongAcrossAll += allWrong.length;
                totalUnAcrossAll += allUn.length;

                results.push({
                    roll,
                    name,
                    section,
                    totalWrongList: allWrong.join(','),
                    totalUnList: allUn.join(','),
                    isEngineering: isEng,
                    wrongCounts: isEng ? {
                        mathCount: mathW.length,
                        mathList: mathW.join(','),
                        phyCount: phyW.length,
                        phyList: phyW.join(','),
                        cheCount: cheW.length,
                        cheList: cheW.join(',')
                    } : {
                        botCount: botW.length,
                        botList: botW.join(','),
                        zooCount: zooW.length,
                        zooList: zooW.join(','),
                        phyCount: phyW.length,
                        phyList: phyW.join(','),
                        cheCount: cheW.length,
                        cheList: cheW.join(',')
                    },
                    unCounts: isEng ? {
                        mathCount: mathU.length,
                        mathList: mathU.join(','),
                        phyCount: phyU.length,
                        phyList: phyU.join(','),
                        cheCount: cheU.length,
                        cheList: cheU.join(',')
                    } : {
                        botCount: botU.length,
                        botList: botU.join(','),
                        zooCount: zooU.length,
                        zooList: zooU.join(','),
                        phyCount: phyU.length,
                        phyList: phyU.join(','),
                        cheCount: cheU.length,
                        cheList: cheU.join(',')
                    }
                });
            }

            setAnalysisResults({
                isEngineering: isEng,
                students: results,
                summary: {
                    totalStudents: results.length,
                    totalWrong: totalWrongAcrossAll,
                    totalUn: totalUnAcrossAll,
                    avgWrongPerStudent: results.length > 0 ? (totalWrongAcrossAll / results.length).toFixed(1) : 0,
                    avgUnPerStudent: results.length > 0 ? (totalUnAcrossAll / results.length).toFixed(1) : 0
                }
            });

            setStatusMessage({
                type: 'success',
                text: `Analysis generated successfully for ${results.length} students (${isEng ? 'Engineering: Mathematics, Physics, Chemistry' : 'NEET: Botany, Zoology, Physics, Chemistry'})! Ready to download Excel.`
            });
        } catch (err) {
            console.error('Error generating analysis:', err);
            setStatusMessage({ type: 'error', text: `Error generating analysis: ${err.message}` });
        } finally {
            setIsProcessing(false);
        }
    };

    // Download formatted Excel file
    const handleDownloadExcel = async () => {
        if (!analysisResults || !analysisResults.students || analysisResults.students.length === 0) {
            setStatusMessage({ type: 'error', text: 'No analysis results to export. Please generate first.' });
            return;
        }

        try {
            const workbook = new ExcelJS.Workbook();
            const isEng = analysisResults.isEngineering;
            const defaultTitle = isEng ? 'ENGINEERING' : 'SR ELITE';
            const sheetTitle = selectedStream?.value ? selectedStream.value.replace(/[:\\/?*[\]]/g, '') : defaultTitle;
            const worksheet = workbook.addWorksheet(sheetTitle);

            const thinBorder = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
            };

            const lightGreenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } };
            const softBlueFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8EA9DB' } };
            const yellowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
            const greenFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA9D08E' } };

            // Row Heights
            worksheet.getRow(1).height = 31.5;
            worksheet.getRow(2).height = 63.0;

            if (isEng) {
                // ==========================================
                // ENGINEERING EXCEL LAYOUT (MPC - 17 Columns)
                // ==========================================
                worksheet.mergeCells('A1:C1');
                worksheet.mergeCells('D1:D2');
                worksheet.mergeCells('E1:E2');
                worksheet.mergeCells('F1:K1'); // Wrong Questions: M, P, C (6 cols)
                worksheet.mergeCells('L1:Q1'); // UN Questions: M, P, C (6 cols)

                worksheet.getCell('D1').value = 'TOTAL WRONG Q COUNT';
                worksheet.getCell('E1').value = 'TOTAL UN COUNT Q';
                worksheet.getCell('F1').value = 'WRONG QUESTIONS';
                worksheet.getCell('L1').value = 'UN QUESTIONS';

                worksheet.getCell('A2').value = 'Roll Number';
                worksheet.getCell('B2').value = ' Name';
                worksheet.getCell('C2').value = '';

                // Wrong Headers: Math, Physics, Chemistry
                worksheet.getCell('F2').value = 'M.Q. C';
                worksheet.getCell('G2').value = 'M.Q';
                worksheet.getCell('H2').value = 'P.Q.C';
                worksheet.getCell('I2').value = 'P.Q';
                worksheet.getCell('J2').value = 'C.Q.C';
                worksheet.getCell('K2').value = 'C.Q';

                // UN Headers: Math, Physics, Chemistry
                worksheet.getCell('L2').value = 'M.Q. C';
                worksheet.getCell('M2').value = 'M.Q';
                worksheet.getCell('N2').value = 'P.Q.C';
                worksheet.getCell('O2').value = 'P.Q';
                worksheet.getCell('P2').value = 'C.Q.C';
                worksheet.getCell('Q2').value = 'C.Q';

                // Header styles
                worksheet.getCell('D1').fill = lightGreenFill;
                worksheet.getCell('D1').font = { name: 'Calibri', size: 18, bold: true };
                worksheet.getCell('D1').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                worksheet.getCell('D1').border = thinBorder;
                worksheet.getCell('D2').border = thinBorder;

                worksheet.getCell('E1').fill = softBlueFill;
                worksheet.getCell('E1').font = { name: 'Calibri', size: 18, bold: true };
                worksheet.getCell('E1').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                worksheet.getCell('E1').border = thinBorder;
                worksheet.getCell('E2').border = thinBorder;

                worksheet.getCell('F1').fill = yellowFill;
                worksheet.getCell('F1').font = { name: 'Calibri', size: 18, bold: true };
                worksheet.getCell('F1').alignment = { horizontal: 'center', vertical: 'middle' };

                for (let c = 6; c <= 11; c++) {
                    const colLetter = String.fromCharCode(64 + c);
                    worksheet.getCell(`${colLetter}1`).border = thinBorder;
                    worksheet.getCell(`${colLetter}1`).fill = yellowFill;

                    const c2 = worksheet.getCell(`${colLetter}2`);
                    c2.border = thinBorder;
                    c2.fill = yellowFill;
                    c2.font = { name: 'Calibri', size: 18, bold: true };
                    c2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                }

                worksheet.getCell('L1').fill = greenFill;
                worksheet.getCell('L1').font = { name: 'Calibri', size: 24, bold: true };
                worksheet.getCell('L1').alignment = { horizontal: 'center', vertical: 'middle' };

                for (let c = 12; c <= 17; c++) {
                    const colLetter = String.fromCharCode(64 + c);
                    worksheet.getCell(`${colLetter}1`).border = thinBorder;
                    worksheet.getCell(`${colLetter}1`).fill = greenFill;

                    const c2 = worksheet.getCell(`${colLetter}2`);
                    c2.border = thinBorder;
                    c2.fill = greenFill;
                    c2.font = { name: 'Calibri', size: 24, bold: true };
                    c2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                }

                worksheet.getCell('A2').font = { name: 'Calibri', size: 24, bold: true };
                worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
                worksheet.getCell('A2').border = thinBorder;

                worksheet.getCell('B2').font = { name: 'Calibri', size: 24, bold: true };
                worksheet.getCell('B2').alignment = { horizontal: 'left', vertical: 'middle' };
                worksheet.getCell('B2').border = thinBorder;
                worksheet.getCell('C2').border = thinBorder;

                const colWidths = [33, 50, 24, 30, 133, 8, 50, 10, 58, 8, 50, 13, 62, 11, 56, 12, 90];
                colWidths.forEach((w, idx) => {
                    worksheet.getColumn(idx + 1).width = w;
                });

                // Populate Student Data Rows for Engineering
                let rowIdx = 3;
                analysisResults.students.forEach(s => {
                    const row = worksheet.getRow(rowIdx);
                    row.height = 80;

                    // Col A: Roll Number
                    const cellA = row.getCell(1);
                    cellA.value = isNaN(s.roll) ? s.roll : Number(s.roll);
                    cellA.font = { name: 'Calibri', size: 18, bold: true };
                    cellA.alignment = { horizontal: 'center', vertical: 'middle' };
                    cellA.border = thinBorder;

                    // Col B: Name
                    const cellB = row.getCell(2);
                    cellB.value = s.name;
                    cellB.font = { name: 'Calibri', size: 18, bold: true };
                    cellB.alignment = { horizontal: 'left', vertical: 'middle' };
                    cellB.border = thinBorder;

                    // Col C: Section
                    const cellC = row.getCell(3);
                    cellC.value = s.section;
                    cellC.font = { name: 'Calibri', size: 18, bold: true };
                    cellC.alignment = { horizontal: 'center', vertical: 'middle' };
                    cellC.border = thinBorder;

                    // Col D: TOTAL WRONG
                    const cellD = row.getCell(4);
                    cellD.value = s.totalWrongList;
                    cellD.font = { name: 'Calibri', size: 18 };
                    cellD.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cellD.border = thinBorder;

                    // Col E: TOTAL UN
                    const cellE = row.getCell(5);
                    cellE.value = s.totalUnList;
                    cellE.font = { name: 'Calibri', size: 18 };
                    cellE.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cellE.border = thinBorder;

                    // WRONG QUESTIONS (Math, Physics, Chemistry)
                    const w = s.wrongCounts;

                    // Math Wrong
                    const cellF = row.getCell(6);
                    cellF.value = w.mathCount;
                    cellF.font = { name: 'Calibri', size: 18 };
                    cellF.alignment = { horizontal: 'center', vertical: 'middle' };
                    cellF.border = thinBorder;

                    const cellG = row.getCell(7);
                    cellG.value = w.mathList;
                    cellG.font = { name: 'Calibri', size: 18 };
                    cellG.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cellG.border = thinBorder;

                    // Physics Wrong
                    const cellH = row.getCell(8);
                    cellH.value = w.phyCount;
                    cellH.font = { name: 'Calibri', size: 18 };
                    cellH.alignment = { horizontal: 'center', vertical: 'middle' };
                    cellH.border = thinBorder;

                    const cellI = row.getCell(9);
                    cellI.value = w.phyList;
                    cellI.font = { name: 'Calibri', size: 18 };
                    cellI.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cellI.border = thinBorder;

                    // Chemistry Wrong
                    const cellJ = row.getCell(10);
                    cellJ.value = w.cheCount;
                    cellJ.font = { name: 'Calibri', size: 18 };
                    cellJ.alignment = { horizontal: 'center', vertical: 'middle' };
                    cellJ.border = thinBorder;

                    const cellK = row.getCell(11);
                    cellK.value = w.cheList;
                    cellK.font = { name: 'Calibri', size: 18 };
                    cellK.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cellK.border = thinBorder;

                    // UN QUESTIONS (Math, Physics, Chemistry)
                    const u = s.unCounts;

                    // Math UN
                    const cellL = row.getCell(12);
                    cellL.value = u.mathCount;
                    cellL.font = { name: 'Calibri', size: 18 };
                    cellL.alignment = { horizontal: 'center', vertical: 'middle' };
                    cellL.border = thinBorder;

                    const cellM = row.getCell(13);
                    cellM.value = u.mathList;
                    cellM.font = { name: 'Calibri', size: 18 };
                    cellM.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cellM.border = thinBorder;

                    // Physics UN
                    const cellN = row.getCell(14);
                    cellN.value = u.phyCount;
                    cellN.font = { name: 'Calibri', size: 18 };
                    cellN.alignment = { horizontal: 'center', vertical: 'middle' };
                    cellN.border = thinBorder;

                    const cellO = row.getCell(15);
                    cellO.value = u.phyList;
                    cellO.font = { name: 'Calibri', size: 18 };
                    cellO.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cellO.border = thinBorder;

                    // Chemistry UN
                    const cellP = row.getCell(16);
                    cellP.value = u.cheCount;
                    cellP.font = { name: 'Calibri', size: 18 };
                    cellP.alignment = { horizontal: 'center', vertical: 'middle' };
                    cellP.border = thinBorder;

                    const cellQ = row.getCell(17);
                    cellQ.value = u.cheList;
                    cellQ.font = { name: 'Calibri', size: 18 };
                    cellQ.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cellQ.border = thinBorder;

                    rowIdx++;
                });

            } else {
                // ==========================================
                // NEET / MEDICAL EXCEL LAYOUT (BZPC - 21 Columns)
                // ==========================================
                worksheet.mergeCells('A1:C1');
                worksheet.mergeCells('D1:D2');
                worksheet.mergeCells('E1:E2');
                worksheet.mergeCells('F1:M1'); // Wrong Questions: B, Z, P, C (8 cols)
                worksheet.mergeCells('N1:U1'); // UN Questions: B, Z, P, C (8 cols)

                worksheet.getCell('D1').value = 'TOTAL WRONG Q COUNT';
                worksheet.getCell('E1').value = 'TOTAL UN COUNT Q';
                worksheet.getCell('F1').value = 'WRONG QUESTIONS';
                worksheet.getCell('N1').value = 'UN QUESTIONS';

                worksheet.getCell('A2').value = 'Roll Number';
                worksheet.getCell('B2').value = ' Name';
                worksheet.getCell('C2').value = '';

                worksheet.getCell('F2').value = 'B.Q. C';
                worksheet.getCell('G2').value = 'B.Q';
                worksheet.getCell('H2').value = 'Z.Q.C';
                worksheet.getCell('I2').value = 'Z.Q';
                worksheet.getCell('J2').value = 'P.Q.C';
                worksheet.getCell('K2').value = 'P.Q';
                worksheet.getCell('L2').value = 'C.Q.C';
                worksheet.getCell('M2').value = 'C.Q';

                worksheet.getCell('N2').value = 'B.Q. C';
                worksheet.getCell('O2').value = 'B.Q';
                worksheet.getCell('P2').value = 'Z.Q.C';
                worksheet.getCell('Q2').value = 'Z.Q';
                worksheet.getCell('R2').value = 'P.Q.C';
                worksheet.getCell('S2').value = 'P.Q';
                worksheet.getCell('T2').value = 'C.Q.C';
                worksheet.getCell('U2').value = 'C.Q';

                worksheet.getCell('D1').fill = lightGreenFill;
                worksheet.getCell('D1').font = { name: 'Calibri', size: 18, bold: true };
                worksheet.getCell('D1').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                worksheet.getCell('D1').border = thinBorder;
                worksheet.getCell('D2').border = thinBorder;

                worksheet.getCell('E1').fill = softBlueFill;
                worksheet.getCell('E1').font = { name: 'Calibri', size: 18, bold: true };
                worksheet.getCell('E1').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                worksheet.getCell('E1').border = thinBorder;
                worksheet.getCell('E2').border = thinBorder;

                worksheet.getCell('F1').fill = yellowFill;
                worksheet.getCell('F1').font = { name: 'Calibri', size: 18, bold: true };
                worksheet.getCell('F1').alignment = { horizontal: 'center', vertical: 'middle' };

                for (let c = 6; c <= 13; c++) {
                    const colLetter = String.fromCharCode(64 + c);
                    worksheet.getCell(`${colLetter}1`).border = thinBorder;
                    worksheet.getCell(`${colLetter}1`).fill = yellowFill;

                    const c2 = worksheet.getCell(`${colLetter}2`);
                    c2.border = thinBorder;
                    c2.fill = yellowFill;
                    c2.font = { name: 'Calibri', size: 18, bold: true };
                    c2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                }

                worksheet.getCell('N1').fill = greenFill;
                worksheet.getCell('N1').font = { name: 'Calibri', size: 24, bold: true };
                worksheet.getCell('N1').alignment = { horizontal: 'center', vertical: 'middle' };

                for (let c = 14; c <= 21; c++) {
                    const colLetter = String.fromCharCode(64 + c);
                    worksheet.getCell(`${colLetter}1`).border = thinBorder;
                    worksheet.getCell(`${colLetter}1`).fill = greenFill;

                    const c2 = worksheet.getCell(`${colLetter}2`);
                    c2.border = thinBorder;
                    c2.fill = greenFill;
                    c2.font = { name: 'Calibri', size: 24, bold: true };
                    c2.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                }

                worksheet.getCell('A2').font = { name: 'Calibri', size: 24, bold: true };
                worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
                worksheet.getCell('A2').border = thinBorder;

                worksheet.getCell('B2').font = { name: 'Calibri', size: 24, bold: true };
                worksheet.getCell('B2').alignment = { horizontal: 'left', vertical: 'middle' };
                worksheet.getCell('B2').border = thinBorder;
                worksheet.getCell('C2').border = thinBorder;

                const colWidths = [33, 50, 24, 30, 133, 8, 50, 10, 58, 11, 57, 8, 50, 13, 62, 11, 56, 12, 91, 12, 90];
                colWidths.forEach((w, idx) => {
                    worksheet.getColumn(idx + 1).width = w;
                });

                let rowIdx = 3;
                analysisResults.students.forEach(s => {
                    const row = worksheet.getRow(rowIdx);
                    row.height = 80;

                    const cellA = row.getCell(1);
                    cellA.value = isNaN(s.roll) ? s.roll : Number(s.roll);
                    cellA.font = { name: 'Calibri', size: 18, bold: true };
                    cellA.alignment = { horizontal: 'center', vertical: 'middle' };
                    cellA.border = thinBorder;

                    const cellB = row.getCell(2);
                    cellB.value = s.name;
                    cellB.font = { name: 'Calibri', size: 18, bold: true };
                    cellB.alignment = { horizontal: 'left', vertical: 'middle' };
                    cellB.border = thinBorder;

                    const cellC = row.getCell(3);
                    cellC.value = s.section;
                    cellC.font = { name: 'Calibri', size: 18, bold: true };
                    cellC.alignment = { horizontal: 'center', vertical: 'middle' };
                    cellC.border = thinBorder;

                    const cellD = row.getCell(4);
                    cellD.value = s.totalWrongList;
                    cellD.font = { name: 'Calibri', size: 18 };
                    cellD.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cellD.border = thinBorder;

                    const cellE = row.getCell(5);
                    cellE.value = s.totalUnList;
                    cellE.font = { name: 'Calibri', size: 18 };
                    cellE.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    cellE.border = thinBorder;

                    // WRONG QUESTIONS
                    const w = s.wrongCounts;
                    row.getCell(6).value = w.botCount;
                    row.getCell(6).font = { name: 'Calibri', size: 18 };
                    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(6).border = thinBorder;

                    row.getCell(7).value = w.botList;
                    row.getCell(7).font = { name: 'Calibri', size: 18 };
                    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    row.getCell(7).border = thinBorder;

                    row.getCell(8).value = w.zooCount;
                    row.getCell(8).font = { name: 'Calibri', size: 18 };
                    row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(8).border = thinBorder;

                    row.getCell(9).value = w.zooList;
                    row.getCell(9).font = { name: 'Calibri', size: 18 };
                    row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    row.getCell(9).border = thinBorder;

                    row.getCell(10).value = w.phyCount;
                    row.getCell(10).font = { name: 'Calibri', size: 18 };
                    row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(10).border = thinBorder;

                    row.getCell(11).value = w.phyList;
                    row.getCell(11).font = { name: 'Calibri', size: 18 };
                    row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    row.getCell(11).border = thinBorder;

                    row.getCell(12).value = w.cheCount;
                    row.getCell(12).font = { name: 'Calibri', size: 18 };
                    row.getCell(12).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(12).border = thinBorder;

                    row.getCell(13).value = w.cheList;
                    row.getCell(13).font = { name: 'Calibri', size: 18 };
                    row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    row.getCell(13).border = thinBorder;

                    // UN QUESTIONS
                    const u = s.unCounts;
                    row.getCell(14).value = u.botCount;
                    row.getCell(14).font = { name: 'Calibri', size: 18 };
                    row.getCell(14).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(14).border = thinBorder;

                    row.getCell(15).value = u.botList;
                    row.getCell(15).font = { name: 'Calibri', size: 18 };
                    row.getCell(15).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    row.getCell(15).border = thinBorder;

                    row.getCell(16).value = u.zooCount;
                    row.getCell(16).font = { name: 'Calibri', size: 18 };
                    row.getCell(16).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(16).border = thinBorder;

                    row.getCell(17).value = u.zooList;
                    row.getCell(17).font = { name: 'Calibri', size: 18 };
                    row.getCell(17).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    row.getCell(17).border = thinBorder;

                    row.getCell(18).value = u.phyCount;
                    row.getCell(18).font = { name: 'Calibri', size: 18 };
                    row.getCell(18).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(18).border = thinBorder;

                    row.getCell(19).value = u.phyList;
                    row.getCell(19).font = { name: 'Calibri', size: 18 };
                    row.getCell(19).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    row.getCell(19).border = thinBorder;

                    row.getCell(20).value = u.cheCount;
                    row.getCell(20).font = { name: 'Calibri', size: 18 };
                    row.getCell(20).alignment = { horizontal: 'center', vertical: 'middle' };
                    row.getCell(20).border = thinBorder;

                    row.getCell(21).value = u.cheList;
                    row.getCell(21).font = { name: 'Calibri', size: 18 };
                    row.getCell(21).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    row.getCell(21).border = thinBorder;

                    rowIdx++;
                });
            }

            // File Name format
            const cleanBase = (testName || csvFileName.replace(/\.csv$/i, '') || 'INTERNAL_ERROR').replace(/[/\\?%*:|"<>]/g, '_');
            const downloadFileName = `${cleanBase}_ERROR ANALYSIS.xlsx`;

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, downloadFileName);

            // Also auto-save to server Internal Error Extraction folder in the background
            try {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = async () => {
                    const base64data = reader.result.split(',')[1];
                    const saveRes = await fetch(`${API_URL}/api/internal-error/save-excel`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            filename: downloadFileName,
                            fileBase64: base64data
                        })
                    });
                    if (saveRes.ok) {
                        const saveData = await saveRes.json();
                        if (saveData.success) {
                            setSavedToServerPath(saveData.path);
                        }
                    }
                };
            } catch (err) {
                console.warn('Background server save note:', err);
            }

            setStatusMessage({
                type: 'success',
                text: `Downloaded ${downloadFileName} successfully!`
            });
        } catch (err) {
            console.error('Error generating Excel:', err);
            setStatusMessage({ type: 'error', text: `Failed to create Excel file: ${err.message}` });
        }
    };

    // Filter students in preview
    const filteredStudents = useMemo(() => {
        if (!analysisResults || !analysisResults.students) return [];
        if (!searchQuery.trim()) return analysisResults.students;

        const q = searchQuery.toLowerCase().trim();
        return analysisResults.students.filter(s =>
            String(s.roll).toLowerCase().includes(q) ||
            String(s.name).toLowerCase().includes(q) ||
            String(s.section).toLowerCase().includes(q)
        );
    }, [analysisResults, searchQuery]);

    const paginatedStudents = useMemo(() => {
        const start = (pageNumber - 1) * pageSize;
        return filteredStudents.slice(start, start + pageSize);
    }, [filteredStudents, pageNumber]);

    const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;

    return (
        <div className="internal-error-analysis-container" style={{ padding: '16px', maxWidth: '100%' }}>
            {/* Page Header Banner */}
            <div style={{
                background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
                color: '#fff',
                padding: '20px 24px',
                borderRadius: '12px',
                marginBottom: '20px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{
                            background: '#0284c7',
                            padding: '12px',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <FileSpreadsheet size={28} color="#ffffff" />
                        </div>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '-0.3px' }}>
                                Internal Error Analysis Tool
                            </h2>
                            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' }}>
                                Supports both <strong>NEET / Medical</strong> (Botany, Zoology, Physics, Chemistry) and <strong>Engineering</strong> (Mathematics, Physics, Chemistry).
                            </p>
                        </div>
                    </div>
                    {analysisResults && (
                        <button
                            onClick={handleDownloadExcel}
                            style={{
                                background: '#16a34a',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px 20px',
                                fontSize: '14px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.4)',
                                transition: 'all 0.2s'
                            }}
                        >
                            <Download size={18} />
                            Download Excel (.xlsx)
                        </button>
                    )}
                </div>
            </div>

            {/* Notification alert */}
            {statusMessage && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '14px',
                    backgroundColor: statusMessage.type === 'error' ? '#fef2f2' : statusMessage.type === 'success' ? '#f0fdf4' : '#f0f9ff',
                    border: `1px solid ${statusMessage.type === 'error' ? '#fecaca' : statusMessage.type === 'success' ? '#bbf7d0' : '#bae6fd'}`,
                    color: statusMessage.type === 'error' ? '#991b1b' : statusMessage.type === 'success' ? '#166534' : '#0369a1'
                }}>
                    {statusMessage.type === 'error' ? <AlertCircle size={18} /> : statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <RefreshCw size={18} className="animate-spin" />}
                    <span>{statusMessage.text}</span>
                </div>
            )}

            {/* Top Control Grid: Filters, Upload, and Pattern Settings */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '16px',
                marginBottom: '20px'
            }}>
                {/* Panel 1: Filter Selection */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Building2 size={18} color="#0284c7" />
                        1. Select Campus, Stream & Test
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                                Campus
                            </label>
                            <Select
                                value={selectedCampus}
                                onChange={setSelectedCampus}
                                options={campusOptions}
                                placeholder="Select Campus..."
                                isClearable={false}
                                styles={{
                                    control: (base) => ({
                                        ...base,
                                        borderColor: '#cbd5e1',
                                        borderRadius: '6px',
                                        minHeight: '38px',
                                        fontSize: '13px'
                                    })
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                                Stream
                            </label>
                            <Select
                                value={selectedStream}
                                onChange={setSelectedStream}
                                options={STREAM_OPTIONS}
                                placeholder="Select Stream..."
                                isClearable={false}
                                styles={{
                                    control: (base) => ({
                                        ...base,
                                        borderColor: '#cbd5e1',
                                        borderRadius: '6px',
                                        minHeight: '38px',
                                        fontSize: '13px'
                                    })
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                                Test Name (Enter manually or auto-detected)
                            </label>
                            <input
                                type="text"
                                value={testName}
                                onChange={(e) => setTestName(e.target.value)}
                                placeholder="e.g. SR ELITE (P - 1) NEET MODULE TEST - 10"
                                style={{
                                    width: '100%',
                                    padding: '8px 12px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '13px',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>
                </div>

                {/* Panel 2: Upload CSV File */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Upload size={18} color="#0284c7" />
                        2. Upload Error CSV File
                    </h3>

                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".csv"
                        style={{ display: 'none' }}
                        onChange={(e) => handleFile(e.target.files[0])}
                    />

                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                        onDragLeave={() => setDragActive(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setDragActive(false);
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                handleFile(e.dataTransfer.files[0]);
                            }
                        }}
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            border: `2px dashed ${dragActive ? '#0284c7' : '#cbd5e1'}`,
                            borderRadius: '8px',
                            padding: '24px 16px',
                            textAlign: 'center',
                            cursor: 'pointer',
                            backgroundColor: dragActive ? '#f0f9ff' : '#f8fafc',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '140px'
                        }}
                    >
                        <Upload size={32} color={dragActive ? '#0284c7' : '#94a3b8'} style={{ marginBottom: '8px' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b' }}>
                            {csvFileName ? csvFileName : 'Click or Drag & Drop Error CSV File'}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                            Contains R, W, U for questions across subjects
                        </span>

                        {detectedInfo && (
                            <div style={{
                                marginTop: '12px',
                                display: 'flex',
                                gap: '8px',
                                flexWrap: 'wrap',
                                justifyContent: 'center'
                            }}>
                                <span style={{
                                    fontSize: '11px',
                                    background: '#e0f2fe',
                                    color: '#0369a1',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontWeight: 600
                                }}>
                                    {detectedInfo.totalStudents} Students
                                </span>
                                <span style={{
                                    fontSize: '11px',
                                    background: '#ecfdf5',
                                    color: '#047857',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontWeight: 600
                                }}>
                                    {detectedInfo.totalQuestions} Questions
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Panel 3: Question Pattern Entry with Engineering & NEET Support */}
                <div style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    padding: '16px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Sliders size={18} color="#0284c7" />
                            3. Question Pattern Entry
                        </h3>
                    </div>

                    {/* Mode Selector Tabs */}
                    <div style={{
                        display: 'flex',
                        gap: '6px',
                        marginBottom: '10px',
                        background: '#f1f5f9',
                        padding: '4px',
                        borderRadius: '8px'
                    }}>
                        <button
                            type="button"
                            onClick={() => handleModeSwitch('neet')}
                            style={{
                                flex: 1,
                                padding: '6px 10px',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: !isEngineering ? 700 : 500,
                                background: !isEngineering ? '#0284c7' : 'transparent',
                                color: !isEngineering ? '#ffffff' : '#64748b',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}
                        >
                            <GraduationCap size={14} />
                            NEET (BZPC)
                        </button>
                        <button
                            type="button"
                            onClick={() => handleModeSwitch('engineering')}
                            style={{
                                flex: 1,
                                padding: '6px 10px',
                                border: 'none',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: isEngineering ? 700 : 500,
                                background: isEngineering ? '#6366f1' : 'transparent',
                                color: isEngineering ? '#ffffff' : '#64748b',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                            }}
                        >
                            <Calculator size={14} />
                            Engineering (MPC)
                        </button>
                    </div>

                    {/* Quick Presets Bar */}
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                        {!isEngineering ? (
                            <button
                                type="button"
                                onClick={() => applyPreset('neet_45')}
                                style={{
                                    fontSize: '11px',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    border: '1px solid #cbd5e1',
                                    background: '#f8fafc',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: '#475569'
                                }}
                            >
                                <RefreshCw size={11} />
                                Reset NEET (45 Qs Each)
                            </button>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('eng_25')}
                                    style={{
                                        fontSize: '11px',
                                        padding: '3px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid #cbd5e1',
                                        background: '#f8fafc',
                                        cursor: 'pointer',
                                        color: '#475569'
                                    }}
                                >
                                    JEE 25 Qs Each (75 Qs)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => applyPreset('eng_30')}
                                    style={{
                                        fontSize: '11px',
                                        padding: '3px 8px',
                                        borderRadius: '4px',
                                        border: '1px solid #cbd5e1',
                                        background: '#f8fafc',
                                        cursor: 'pointer',
                                        color: '#475569'
                                    }}
                                >
                                    JEE 30 Qs Each (90 Qs)
                                </button>
                            </>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {/* 1. Mathematics (Engineering) */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            background: isEngineering ? '#eef2ff' : '#f8fafc',
                            border: isEngineering ? '1px solid #c7d2fe' : '1px solid transparent',
                            borderRadius: '6px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '100px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1' }}></span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: isEngineering ? '#3730a3' : '#1e293b' }}>
                                    Mathematics:
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>Q</span>
                                <input
                                    type="number"
                                    value={ranges.math.start || ''}
                                    placeholder="0"
                                    onChange={(e) => handleRangeChange('math', 'start', e.target.value)}
                                    style={{ width: '48px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                />
                                <span style={{ fontSize: '11px', color: '#64748b' }}>to</span>
                                <input
                                    type="number"
                                    value={ranges.math.end || ''}
                                    placeholder="0"
                                    onChange={(e) => handleRangeChange('math', 'end', e.target.value)}
                                    style={{ width: '48px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#6366f1', width: '42px', textAlign: 'right' }}>
                                    ({ranges.math.start > 0 && ranges.math.end >= ranges.math.start ? Math.max(0, ranges.math.end - ranges.math.start + 1) : 0} Q)
                                </span>
                            </div>
                        </div>

                        {/* 2. Botany (Disabled when Mathematics is entered / Engineering mode) */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            background: isEngineering ? '#f1f5f9' : '#f8fafc',
                            borderRadius: '6px',
                            opacity: isEngineering ? 0.6 : 1,
                            transition: 'all 0.2s'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '100px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isEngineering ? '#94a3b8' : '#16a34a' }}></span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: isEngineering ? '#94a3b8' : '#1e293b' }}>
                                    Botany:
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '11px', color: isEngineering ? '#94a3b8' : '#64748b' }}>Q</span>
                                <input
                                    type="number"
                                    disabled={isEngineering}
                                    value={isEngineering ? '' : (ranges.botany.start || '')}
                                    placeholder={isEngineering ? '-' : '0'}
                                    onChange={(e) => handleRangeChange('botany', 'start', e.target.value)}
                                    style={{
                                        width: '48px',
                                        padding: '4px',
                                        textAlign: 'center',
                                        borderRadius: '4px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '12px',
                                        backgroundColor: isEngineering ? '#e2e8f0' : '#ffffff',
                                        cursor: isEngineering ? 'not-allowed' : 'text',
                                        color: isEngineering ? '#94a3b8' : '#1e293b'
                                    }}
                                />
                                <span style={{ fontSize: '11px', color: isEngineering ? '#94a3b8' : '#64748b' }}>to</span>
                                <input
                                    type="number"
                                    disabled={isEngineering}
                                    value={isEngineering ? '' : (ranges.botany.end || '')}
                                    placeholder={isEngineering ? '-' : '0'}
                                    onChange={(e) => handleRangeChange('botany', 'end', e.target.value)}
                                    style={{
                                        width: '48px',
                                        padding: '4px',
                                        textAlign: 'center',
                                        borderRadius: '4px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '12px',
                                        backgroundColor: isEngineering ? '#e2e8f0' : '#ffffff',
                                        cursor: isEngineering ? 'not-allowed' : 'text',
                                        color: isEngineering ? '#94a3b8' : '#1e293b'
                                    }}
                                />
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: isEngineering ? '#94a3b8' : '#16a34a',
                                    minWidth: '55px',
                                    textAlign: 'right'
                                }}>
                                    {isEngineering ? '(Disabled)' : `(${Math.max(0, ranges.botany.end - ranges.botany.start + 1)} Q)`}
                                </span>
                            </div>
                        </div>

                        {/* 3. Zoology (Disabled when Mathematics is entered / Engineering mode) */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 8px',
                            background: isEngineering ? '#f1f5f9' : '#f8fafc',
                            borderRadius: '6px',
                            opacity: isEngineering ? 0.6 : 1,
                            transition: 'all 0.2s'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '100px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isEngineering ? '#94a3b8' : '#0284c7' }}></span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: isEngineering ? '#94a3b8' : '#1e293b' }}>
                                    Zoology:
                                </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '11px', color: isEngineering ? '#94a3b8' : '#64748b' }}>Q</span>
                                <input
                                    type="number"
                                    disabled={isEngineering}
                                    value={isEngineering ? '' : (ranges.zoology.start || '')}
                                    placeholder={isEngineering ? '-' : '0'}
                                    onChange={(e) => handleRangeChange('zoology', 'start', e.target.value)}
                                    style={{
                                        width: '48px',
                                        padding: '4px',
                                        textAlign: 'center',
                                        borderRadius: '4px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '12px',
                                        backgroundColor: isEngineering ? '#e2e8f0' : '#ffffff',
                                        cursor: isEngineering ? 'not-allowed' : 'text',
                                        color: isEngineering ? '#94a3b8' : '#1e293b'
                                    }}
                                />
                                <span style={{ fontSize: '11px', color: isEngineering ? '#94a3b8' : '#64748b' }}>to</span>
                                <input
                                    type="number"
                                    disabled={isEngineering}
                                    value={isEngineering ? '' : (ranges.zoology.end || '')}
                                    placeholder={isEngineering ? '-' : '0'}
                                    onChange={(e) => handleRangeChange('zoology', 'end', e.target.value)}
                                    style={{
                                        width: '48px',
                                        padding: '4px',
                                        textAlign: 'center',
                                        borderRadius: '4px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '12px',
                                        backgroundColor: isEngineering ? '#e2e8f0' : '#ffffff',
                                        cursor: isEngineering ? 'not-allowed' : 'text',
                                        color: isEngineering ? '#94a3b8' : '#1e293b'
                                    }}
                                />
                                <span style={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: isEngineering ? '#94a3b8' : '#0284c7',
                                    minWidth: '55px',
                                    textAlign: 'right'
                                }}>
                                    {isEngineering ? '(Disabled)' : `(${Math.max(0, ranges.zoology.end - ranges.zoology.start + 1)} Q)`}
                                </span>
                            </div>
                        </div>

                        {/* 4. Physics */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '100px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }}></span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Physics:</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>Q</span>
                                <input
                                    type="number"
                                    value={ranges.physics.start}
                                    onChange={(e) => handleRangeChange('physics', 'start', e.target.value)}
                                    style={{ width: '48px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                />
                                <span style={{ fontSize: '11px', color: '#64748b' }}>to</span>
                                <input
                                    type="number"
                                    value={ranges.physics.end}
                                    onChange={(e) => handleRangeChange('physics', 'end', e.target.value)}
                                    style={{ width: '48px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#ca8a04', width: '42px', textAlign: 'right' }}>
                                    ({Math.max(0, ranges.physics.end - ranges.physics.start + 1)} Q)
                                </span>
                            </div>
                        </div>

                        {/* 5. Chemistry */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#f8fafc', borderRadius: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '100px' }}>
                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#dc2626' }}></span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>Chemistry:</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>Q</span>
                                <input
                                    type="number"
                                    value={ranges.chemistry.start}
                                    onChange={(e) => handleRangeChange('chemistry', 'start', e.target.value)}
                                    style={{ width: '48px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                />
                                <span style={{ fontSize: '11px', color: '#64748b' }}>to</span>
                                <input
                                    type="number"
                                    value={ranges.chemistry.end}
                                    onChange={(e) => handleRangeChange('chemistry', 'end', e.target.value)}
                                    style={{ width: '48px', padding: '4px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                                />
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#dc2626', width: '42px', textAlign: 'right' }}>
                                    ({Math.max(0, ranges.chemistry.end - ranges.chemistry.start + 1)} Q)
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Generate & Action Toolbar */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '20px',
                background: '#ffffff',
                padding: '14px 20px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button
                        onClick={handleGenerate}
                        disabled={isProcessing || !parsedRows}
                        style={{
                            background: isProcessing || !parsedRows ? '#94a3b8' : (isEngineering ? '#6366f1' : '#0284c7'),
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            padding: '10px 24px',
                            fontSize: '14px',
                            fontWeight: 600,
                            cursor: isProcessing || !parsedRows ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.15)'
                        }}
                    >
                        {isProcessing ? (
                            <>
                                <RefreshCw size={16} className="animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <Check size={16} />
                                Generate Error Analysis {isEngineering ? '(Engineering)' : '(NEET)'}
                            </>
                        )}
                    </button>

                    {analysisResults && (
                        <button
                            onClick={handleDownloadExcel}
                            style={{
                                background: '#16a34a',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '8px',
                                padding: '10px 20px',
                                fontSize: '14px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.3)'
                            }}
                        >
                            <Download size={16} />
                            Download Excel (.xlsx)
                        </button>
                    )}
                </div>

                {savedToServerPath && (
                    <div style={{ fontSize: '12px', color: '#166534', background: '#dcfce7', padding: '6px 12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Save size={14} />
                        Saved to folder: <strong>Internal Error Extraction</strong>
                    </div>
                )}
            </div>

            {/* Summary Metrics Cards */}
            {analysisResults && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '14px',
                    marginBottom: '20px'
                }}>
                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', borderLeft: `4px solid ${analysisResults.isEngineering ? '#6366f1' : '#0284c7'}` }}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Students</div>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#1e293b', marginTop: '4px' }}>
                            {analysisResults.summary.totalStudents}
                        </div>
                        <div style={{ fontSize: '11px', color: analysisResults.isEngineering ? '#4f46e5' : '#0284c7', marginTop: '2px', fontWeight: 600 }}>
                            {analysisResults.isEngineering ? 'Engineering (MPC)' : 'NEET (BZPC)'}
                        </div>
                    </div>

                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', borderLeft: '4px solid #eab308' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Wrong Answers</div>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#ca8a04', marginTop: '4px' }}>
                            {analysisResults.summary.totalWrong.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '11px', color: '#854d0e', marginTop: '2px' }}>
                            Avg: {analysisResults.summary.avgWrongPerStudent} / student
                        </div>
                    </div>

                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', borderLeft: '4px solid #16a34a' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Total Unattempted Questions</div>
                        <div style={{ fontSize: '24px', fontWeight: 700, color: '#16a34a', marginTop: '4px' }}>
                            {analysisResults.summary.totalUn.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '11px', color: '#166534', marginTop: '2px' }}>
                            Avg: {analysisResults.summary.avgUnPerStudent} / student
                        </div>
                    </div>

                    <div style={{ background: '#ffffff', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', borderLeft: '4px solid #8b5cf6' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Target Stream / Campus</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginTop: '6px' }}>
                            {selectedStream?.value || 'DEFAULT'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                            {selectedCampus?.value || 'All Campuses'}
                        </div>
                    </div>
                </div>
            )}

            {/* Results Table Section */}
            {analysisResults && (
                <div style={{
                    background: '#ffffff',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                    {/* Table Search & Controls Header */}
                    <div style={{
                        padding: '14px 18px',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '12px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>
                                Error Analysis Preview ({analysisResults.isEngineering ? 'Engineering: Math, Physics, Chem' : 'NEET: Botany, Zoology, Physics, Chem'})
                            </span>
                            <span style={{ fontSize: '12px', background: '#e2e8f0', padding: '2px 8px', borderRadius: '10px', color: '#475569' }}>
                                Showing {paginatedStudents.length} of {filteredStudents.length} Students
                            </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ position: 'relative' }}>
                                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => { setSearchQuery(e.target.value); setPageNumber(1); }}
                                    placeholder="Search by Roll No or Name..."
                                    style={{
                                        padding: '6px 12px 6px 32px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '13px',
                                        width: '240px'
                                    }}
                                />
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button
                                        disabled={pageNumber === 1}
                                        onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: '4px',
                                            border: '1px solid #cbd5e1',
                                            background: pageNumber === 1 ? '#f1f5f9' : '#ffffff',
                                            fontSize: '12px',
                                            cursor: pageNumber === 1 ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        Prev
                                    </button>
                                    <span style={{ fontSize: '12px', color: '#475569', padding: '0 4px' }}>
                                        {pageNumber} / {totalPages}
                                    </span>
                                    <button
                                        disabled={pageNumber === totalPages}
                                        onClick={() => setPageNumber(p => Math.min(totalPages, p + 1))}
                                        style={{
                                            padding: '4px 10px',
                                            borderRadius: '4px',
                                            border: '1px solid #cbd5e1',
                                            background: pageNumber === totalPages ? '#f1f5f9' : '#ffffff',
                                            fontSize: '12px',
                                            cursor: pageNumber === totalPages ? 'not-allowed' : 'pointer'
                                        }}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Scrollable Table matching Excel Colors */}
                    <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
                        <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '12px',
                            fontFamily: 'Calibri, sans-serif'
                        }}>
                            <thead>
                                {/* Header Row 1 */}
                                <tr>
                                    <th rowSpan={2} style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'center', minWidth: '100px', fontWeight: 700 }}>
                                        Roll Number
                                    </th>
                                    <th rowSpan={2} style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'left', minWidth: '150px', fontWeight: 700 }}>
                                        Name
                                    </th>
                                    <th rowSpan={2} style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', textAlign: 'center', minWidth: '110px', fontWeight: 700 }}>
                                        Section
                                    </th>
                                    <th rowSpan={2} style={{ padding: '8px 12px', background: '#C6E0B4', border: '1px solid #94a3b8', textAlign: 'center', minWidth: '150px', fontWeight: 700, color: '#166534' }}>
                                        TOTAL WRONG Q COUNT
                                    </th>
                                    <th rowSpan={2} style={{ padding: '8px 12px', background: '#8EA9DB', border: '1px solid #64748b', textAlign: 'center', minWidth: '200px', fontWeight: 700, color: '#1e3a8a' }}>
                                        TOTAL UN COUNT Q
                                    </th>
                                    <th colSpan={analysisResults.isEngineering ? 6 : 8} style={{ padding: '8px 12px', background: '#FFE699', border: '1px solid #d97706', textAlign: 'center', fontWeight: 700, color: '#854d0e', fontSize: '13px' }}>
                                        WRONG QUESTIONS
                                    </th>
                                    <th colSpan={analysisResults.isEngineering ? 6 : 8} style={{ padding: '8px 12px', background: '#A9D08E', border: '1px solid #16a34a', textAlign: 'center', fontWeight: 700, color: '#14532d', fontSize: '13px' }}>
                                        UN QUESTIONS
                                    </th>
                                </tr>

                                {/* Header Row 2 (Subheaders) */}
                                <tr>
                                    {analysisResults.isEngineering ? (
                                        <>
                                            {/* Engineering Wrong Subheaders: Math, Physics, Chem */}
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>M.Q. C</th>
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>M.Q</th>
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>P.Q.C</th>
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>P.Q</th>
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>C.Q.C</th>
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>C.Q</th>

                                            {/* Engineering UN Subheaders: Math, Physics, Chem */}
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>M.Q. C</th>
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>M.Q</th>
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>P.Q.C</th>
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>P.Q</th>
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>C.Q.C</th>
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>C.Q</th>
                                        </>
                                    ) : (
                                        <>
                                            {/* NEET Wrong Subheaders: Botany, Zoology, Physics, Chem */}
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>B.Q. C</th>
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>B.Q</th>
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>Z.Q.C</th>
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>Z.Q</th>
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>P.Q.C</th>
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>P.Q</th>
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>C.Q.C</th>
                                            <th style={{ padding: '6px 8px', background: '#FFF2CC', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>C.Q</th>

                                            {/* NEET UN Subheaders: Botany, Zoology, Physics, Chem */}
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>B.Q. C</th>
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>B.Q</th>
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>Z.Q.C</th>
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>Z.Q</th>
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>P.Q.C</th>
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>P.Q</th>
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '55px' }}>C.Q.C</th>
                                            <th style={{ padding: '6px 8px', background: '#C6E0B4', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, minWidth: '120px' }}>C.Q</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedStudents.map((s, idx) => (
                                    <tr key={s.roll || idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                        <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 700, color: '#1e293b' }}>
                                            {s.roll}
                                        </td>
                                        <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 600, color: s.name === '#N/A' ? '#94a3b8' : '#0f172a' }}>
                                            {s.name}
                                        </td>
                                        <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center', color: s.section === '#N/A' ? '#94a3b8' : '#334155' }}>
                                            {s.section}
                                        </td>
                                        <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '200px', wordBreak: 'break-word', color: '#166534' }}>
                                            {s.totalWrongList || '-'}
                                        </td>
                                        <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '260px', wordBreak: 'break-word', color: '#1e3a8a' }}>
                                            {s.totalUnList || '-'}
                                        </td>

                                        {analysisResults.isEngineering ? (
                                            <>
                                                {/* Engineering Wrong: Math, Physics, Chem */}
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#fffbeb' }}>
                                                    {s.wrongCounts.mathCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.wrongCounts.mathList || ''}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#fffbeb' }}>
                                                    {s.wrongCounts.phyCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.wrongCounts.phyList || ''}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#fffbeb' }}>
                                                    {s.wrongCounts.cheCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.wrongCounts.cheList || ''}
                                                </td>

                                                {/* Engineering UN: Math, Physics, Chem */}
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#f0fdf4' }}>
                                                    {s.unCounts.mathCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.unCounts.mathList || ''}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#f0fdf4' }}>
                                                    {s.unCounts.phyCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.unCounts.phyList || ''}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#f0fdf4' }}>
                                                    {s.unCounts.cheCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.unCounts.cheList || ''}
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                {/* NEET Wrong: Botany, Zoology, Physics, Chem */}
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#fffbeb' }}>
                                                    {s.wrongCounts.botCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.wrongCounts.botList || ''}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#fffbeb' }}>
                                                    {s.wrongCounts.zooCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.wrongCounts.zooList || ''}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#fffbeb' }}>
                                                    {s.wrongCounts.phyCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.wrongCounts.phyList || ''}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#fffbeb' }}>
                                                    {s.wrongCounts.cheCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.wrongCounts.cheList || ''}
                                                </td>

                                                {/* NEET UN: Botany, Zoology, Physics, Chem */}
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#f0fdf4' }}>
                                                    {s.unCounts.botCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.unCounts.botList || ''}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#f0fdf4' }}>
                                                    {s.unCounts.zooCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.unCounts.zooList || ''}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#f0fdf4' }}>
                                                    {s.unCounts.phyCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.unCounts.phyList || ''}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 600, background: '#f0fdf4' }}>
                                                    {s.unCounts.cheCount}
                                                </td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #e2e8f0', textAlign: 'center', maxWidth: '140px', wordBreak: 'break-word' }}>
                                                    {s.unCounts.cheList || ''}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InternalErrorAnalysis;
