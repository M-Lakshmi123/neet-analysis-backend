import React, { useState, useEffect, useMemo, useRef } from 'react';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { formatDate } from '../utils/apiHelper';
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
    Edit3,
    Save,
    Check,
    FileText,
    Award,
    Layers,
    HelpCircle,
    ArrowRight,
    Printer,
    Archive,
    Sparkles,
    UserCheck,
    Calendar,
    Building2,
    BookOpen
} from 'lucide-react';

// Stream Definitions & Subject Presets
const STREAM_PRESETS = {
    MEDICAL: {
        id: 'MEDICAL',
        label: 'Medical (NEET)',
        icon: '🩺',
        description: 'NEET Medical streams (Botany, Zoology, Physics, Chemistry)',
        subjects: ['BOTANY', 'ZOOLOGY', 'PHYSICS', 'CHEMISTRY'],
        defaultSubjects: ['BOTANY', 'ZOOLOGY', 'PHYSICS', 'CHEMISTRY'],
        defaultMaxTotal: 720
    },
    ENGG: {
        id: 'ENGG',
        label: 'Engineering (JEE)',
        icon: '⚙️',
        description: 'JEE Engineering streams (Maths, Physics, Chemistry)',
        subjects: ['MATHS', 'PHYSICS', 'CHEMISTRY'],
        defaultSubjects: ['MATHS', 'PHYSICS', 'CHEMISTRY'],
        defaultMaxTotal: 300
    },
    CBSE: {
        id: 'CBSE',
        label: 'CBSE Board',
        icon: '🎓',
        description: 'CBSE Class XI & XII Board streams (PCMB / PCMC / Commerce / Arts)',
        subjects: ['PHYSICS', 'CHEMISTRY', 'MATHS', 'ENGLISH', 'BIOLOGY', 'IP', 'PE'],
        defaultSubjects: ['PHYSICS', 'CHEMISTRY', 'MATHS', 'ENGLISH', 'BIOLOGY'],
        defaultMaxTotal: 500
    },
    PU: {
        id: 'PU',
        label: 'PU Board',
        icon: '🏛️',
        description: 'Karnataka Pre-University Board streams (PCMB, PCMC, etc.)',
        subjects: ['MATHS', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'COMPUTER SCIENCE', 'ENGLISH', 'KANNADA', 'SANSKRIT', 'HINDI'],
        defaultSubjects: ['MATHS', 'PHYSICS', 'CHEMISTRY', 'BIOLOGY', 'ENGLISH', 'KANNADA'],
        defaultMaxTotal: 600
    }
};

const getStudentInitials = (name) => {
    if (!name) return 'SC';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'SC';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const generateDynamicRemarks = (studentName, tests, subjects) => {
    if (!tests || tests.length === 0) {
        return `${studentName} has active enrolment. Test records are being consolidated.`;
    }
    const attended = tests.filter(t => !t.isAB);
    if (attended.length === 0) {
        return `${studentName} was marked absent for the scheduled test(s). Regular attendance is strongly advised.`;
    }
    const avgTotal = Math.round(attended.reduce((a, b) => a + (Number(b.total) || 0), 0) / attended.length);

    // Calculate subject averages
    const subAvgs = subjects.map(sub => {
        const marksList = attended
            .map(t => t.marks && t.marks[sub])
            .filter(m => m !== undefined && m !== null && m !== '' && !isNaN(Number(m)))
            .map(Number);
        if (marksList.length === 0) return null;
        const avg = Math.round(marksList.reduce((a, b) => a + b, 0) / marksList.length);
        return { subject: sub, avg };
    }).filter(Boolean);

    subAvgs.sort((a, b) => b.avg - a.avg);
    const topSub = subAvgs[0];
    const lagSub = subAvgs[subAvgs.length - 1];

    let remark = `${studentName} has achieved an average score of ${avgTotal} marks across ${attended.length} test${attended.length > 1 ? 's' : ''}. `;
    if (topSub && topSub.avg > 0) {
        remark += `Demonstrated strong conceptual grasp in ${topSub.subject} (Avg: ${topSub.avg}). `;
    }
    if (lagSub && lagSub.subject !== topSub?.subject) {
        remark += `Focused revision and timed question practice in ${lagSub.subject} (Avg: ${lagSub.avg}) will elevate the aggregate rank.`;
    } else {
        remark += `Consistent effort and rigorous practice will maintain top performance.`;
    }
    return remark;
};

const CustomProgressReport = () => {
    const { userData } = useAuth();

    // Stream & Subject Config States
    const [selectedStream, setSelectedStream] = useState('MEDICAL');
    const [availableSubjects, setAvailableSubjects] = useState(STREAM_PRESETS.MEDICAL.subjects);
    const [selectedSubjects, setSelectedSubjects] = useState(STREAM_PRESETS.MEDICAL.defaultSubjects);
    const [newSubjectName, setNewSubjectName] = useState('');
    const [showInstructions, setShowInstructions] = useState(true);

    // Upload & Parsed Data States
    const [uploadedFileName, setUploadedFileName] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [statusMessage, setStatusMessage] = useState(null);

    // Students Data Array
    // Each student: { id, name, campus, stream, tests: [{ testName, date, total, marks: { SUB: val }, isAB }], avgTotal, subjectAverages: { SUB: val } }
    const [students, setStudents] = useState([]);
    const [currentStudentIndex, setCurrentStudentIndex] = useState(0);
    const [studentSearch, setStudentSearch] = useState('');

    // Editing Custom Remarks per student
    const [customRemarks, setCustomRemarks] = useState({});
    const [editingRemarks, setEditingRemarks] = useState(false);
    const [tempRemarkText, setTempRemarkText] = useState('');

    // Download States
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0, status: '' });

    const fileInputRef = useRef(null);

    // On Stream Change
    const handleStreamChange = (streamKey) => {
        setSelectedStream(streamKey);
        const preset = STREAM_PRESETS[streamKey];
        setAvailableSubjects(preset.subjects);
        setSelectedSubjects(preset.defaultSubjects);
        setStatusMessage({
            type: 'info',
            text: `Switched stream to ${preset.label}. Subjects updated to default stream template.`
        });
    };

    // Toggle Subject Checkbox
    const toggleSubject = (sub) => {
        if (selectedSubjects.includes(sub)) {
            if (selectedSubjects.length <= 1) {
                setStatusMessage({ type: 'error', text: 'At least one subject must be selected!' });
                return;
            }
            setSelectedSubjects(prev => prev.filter(s => s !== sub));
        } else {
            setSelectedSubjects(prev => [...prev, sub]);
        }
    };

    // Add Custom Subject
    const handleAddCustomSubject = (e) => {
        e.preventDefault();
        const trimmed = newSubjectName.trim().toUpperCase();
        if (!trimmed) return;
        if (!availableSubjects.includes(trimmed)) {
            setAvailableSubjects(prev => [...prev, trimmed]);
        }
        if (!selectedSubjects.includes(trimmed)) {
            setSelectedSubjects(prev => [...prev, trimmed]);
        }
        setNewSubjectName('');
        setStatusMessage({ type: 'success', text: `Added custom subject "${trimmed}".` });
    };

    // Select All / Clear All Subjects
    const handleSelectAllSubjects = () => {
        setSelectedSubjects([...availableSubjects]);
    };
    const handleResetSubjects = () => {
        setSelectedSubjects(STREAM_PRESETS[selectedStream].defaultSubjects);
    };

    // -------------------------------------------------------------
    // 1. DYNAMIC EXCEL TEMPLATE GENERATION
    // -------------------------------------------------------------
    const handleDownloadTemplate = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Sri Chaitanya Educational Institutions';
            workbook.created = new Date();

            const streamConfig = STREAM_PRESETS[selectedStream];
            const sheet = workbook.addWorksheet('Custom_Progress_Template', {
                views: [{ showGridLines: true }]
            });

            // Column Definitions
            const baseColumns = [
                { header: 'STUDENT ID', key: 'STUD_ID', width: 18 },
                { header: 'NAME OF THE STUDENT', key: 'NAME_OF_THE_STUDENT', width: 26 },
                { header: 'CAMPUS NAME', key: 'CAMPUS_NAME', width: 22 },
                { header: 'STREAM NAME', key: 'STREAM_NAME', width: 20 },
                { header: 'TEST NAME', key: 'TEST_NAME', width: 22 },
                { header: 'DATE', key: 'DATE', width: 14 }
            ];

            const subjectColumns = selectedSubjects.map(sub => ({
                header: sub,
                key: sub,
                width: 16
            }));

            const totalColumn = {
                header: 'TOTAL MARKS',
                key: 'TOTAL_MARKS',
                width: 18
            };

            sheet.columns = [...baseColumns, ...subjectColumns, totalColumn];

            // Style Header Row (Row 1)
            const headerRow = sheet.getRow(1);
            headerRow.height = 30;
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF0F2057' } // Deep Royal Navy
                };
                cell.font = {
                    name: 'Segoe UI',
                    size: 11,
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

            // Highlight TOTAL MARKS header cell with Gold accent
            const totalCell = headerRow.getCell(baseColumns.length + subjectColumns.length + 1);
            if (totalCell) {
                totalCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFC9962B' } // Gold
                };
                totalCell.font = {
                    name: 'Segoe UI',
                    size: 11,
                    bold: true,
                    color: { argb: 'FF0F2057' }
                };
            }

            // 3 Realistic Sample Rows to demonstrate format
            const sampleStudents = [
                {
                    id: 'SC1001',
                    name: 'Aarav Patel',
                    campus: 'Indiranagar Campus',
                    stream: streamConfig.label,
                    test: 'Unit Test - 1',
                    date: '2026-03-01'
                },
                {
                    id: 'SC1001',
                    name: 'Aarav Patel',
                    campus: 'Indiranagar Campus',
                    stream: streamConfig.label,
                    test: 'Grand Test - 1',
                    date: '2026-03-15'
                },
                {
                    id: 'SC1002',
                    name: 'Diya Sharma',
                    campus: 'Koramangala Campus',
                    stream: streamConfig.label,
                    test: 'Unit Test - 1',
                    date: '2026-03-01'
                }
            ];

            sampleStudents.forEach((stud, idx) => {
                const rowData = {
                    STUD_ID: stud.id,
                    NAME_OF_THE_STUDENT: stud.name,
                    CAMPUS_NAME: stud.campus,
                    STREAM_NAME: stud.stream,
                    TEST_NAME: stud.test,
                    DATE: stud.date
                };

                // Add sample marks for each subject
                let sum = 0;
                selectedSubjects.forEach((sub, sIdx) => {
                    const mark = idx === 1 ? 88 + (sIdx * 2) : 80 + (sIdx * 3);
                    rowData[sub] = mark;
                    sum += mark;
                });
                rowData.TOTAL_MARKS = sum;

                const addedRow = sheet.addRow(rowData);
                addedRow.height = 22;
                addedRow.eachCell((cell, colNumber) => {
                    cell.font = { name: 'Segoe UI', size: 10, color: { argb: 'FF1E293B' } };
                    cell.alignment = {
                        vertical: 'middle',
                        horizontal: colNumber <= 2 ? 'left' : 'center'
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                    };
                });
            });

            // Add Helpful Instructions Sheet
            const infoSheet = workbook.addWorksheet('Instructions');
            infoSheet.columns = [
                { header: 'Step / Column', width: 24 },
                { header: 'Guideline & Description', width: 75 }
            ];
            const infoHeaders = infoSheet.getRow(1);
            infoHeaders.height = 26;
            infoHeaders.eachCell(c => {
                c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
                c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                c.alignment = { vertical: 'middle', horizontal: 'left' };
            });

            const instructions = [
                ['Stream Configured', `${streamConfig.label} with ${selectedSubjects.length} subjects: ${selectedSubjects.join(', ')}`],
                ['STUDENT ID', 'Mandatory. Unique ID or Roll No. Multiple rows with the same ID will be grouped as test history for that student.'],
                ['NAME OF THE STUDENT', 'Mandatory. Full name of the student as it should appear on the Progress Report Card.'],
                ['CAMPUS NAME', 'Branch / Campus name (e.g., Indiranagar, Electronic City, Whitefield).'],
                ['STREAM NAME', `Academic Stream (e.g., ${streamConfig.label}, PCMB, PCMC).`],
                ['TEST NAME', 'Name of exam (e.g., Unit Test - 1, Term Exam, Mock Test 01).'],
                ['DATE', 'Date of exam in DD/MM/YYYY or YYYY-MM-DD format.'],
                ['Subject Columns', 'Enter numeric marks scored in each subject. Enter "AB" or "Absent" if the student was absent.'],
                ['TOTAL MARKS', 'Sum of all subject marks. If left blank, the system will automatically calculate the total sum of subject marks!']
            ];

            instructions.forEach(inst => {
                const r = infoSheet.addRow(inst);
                r.height = 22;
                r.alignment = { vertical: 'middle' };
            });

            // Generate buffer & trigger download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const fileName = `${selectedStream}_Progress_Report_Template.xlsx`;
            saveAs(blob, fileName);

            setStatusMessage({
                type: 'success',
                text: `Downloaded "${fileName}" successfully! Fill student marks in this template and upload below.`
            });
            logActivity(userData, 'Downloaded Custom Progress Template', { stream: selectedStream, subjects: selectedSubjects });
        } catch (err) {
            console.error('Error generating template:', err);
            setStatusMessage({ type: 'error', text: `Failed to create Excel template: ${err.message}` });
        }
    };

    // -------------------------------------------------------------
    // 2. FILE UPLOAD & PARSER
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

            // Use first sheet with data
            const worksheet = workbook.worksheets.find(ws => ws.name !== 'Instructions') || workbook.worksheets[0];
            if (!worksheet) throw new Error('No valid worksheet found in the Excel file.');

            let headerRowIndex = 1;
            let headerValues = [];

            // Scan first 5 rows to locate header row
            for (let r = 1; r <= 5; r++) {
                const row = worksheet.getRow(r);
                const values = [];
                row.eachCell((cell, colNumber) => {
                    values[colNumber] = String(getCellValue(cell) || '').trim();
                });
                const normStr = values.join(' ').toUpperCase();
                if (normStr.includes('STUD') || normStr.includes('NAME') || normStr.includes('MARKS')) {
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
            let streamCol = -1;
            let testCol = -1;
            let dateCol = -1;
            let totalCol = -1;
            const subjectCols = {};

            headerValues.forEach((rawHeader, colIdx) => {
                if (!rawHeader) return;
                const h = rawHeader.trim().toUpperCase();

                if (h.includes('STUDENT ID') || h === 'STUD_ID' || h === 'STUDENTID' || h === 'ID' || h === 'ROLL NO') {
                    if (idCol === -1) idCol = colIdx;
                } else if (h.includes('NAME') || h === 'STUDENT NAME') {
                    if (nameCol === -1) nameCol = colIdx;
                } else if (h.includes('CAMPUS') || h.includes('BRANCH')) {
                    if (campusCol === -1) campusCol = colIdx;
                } else if (h.includes('STREAM')) {
                    if (streamCol === -1) streamCol = colIdx;
                } else if (h.includes('TEST') || h.includes('EXAM')) {
                    if (testCol === -1) testCol = colIdx;
                } else if (h.includes('DATE')) {
                    if (dateCol === -1) dateCol = colIdx;
                } else if (h.includes('TOTAL') || h.includes('TOT_')) {
                    if (totalCol === -1) totalCol = colIdx;
                } else {
                    // Check if matches any selected or available subjects, or custom column
                    subjectCols[h] = colIdx;
                }
            });

            // Determine active subjects from upload header or fallback to current selected
            const detectedSubjects = Object.keys(subjectCols);
            const activeSubList = detectedSubjects.length > 0 ? detectedSubjects : selectedSubjects;
            if (detectedSubjects.length > 0) {
                setSelectedSubjects(detectedSubjects);
            }

            const rawStudentRows = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber <= headerRowIndex) return; // skip header

                const studId = idCol !== -1 ? String(getCellValue(row.getCell(idCol)) || '').trim() : '';
                const studName = nameCol !== -1 ? String(getCellValue(row.getCell(nameCol)) || '').trim() : '';
                const campus = campusCol !== -1 ? String(getCellValue(row.getCell(campusCol)) || '').trim() : 'Campus';
                const stream = streamCol !== -1 ? String(getCellValue(row.getCell(streamCol)) || '').trim() : STREAM_PRESETS[selectedStream].label;
                const test = testCol !== -1 ? String(getCellValue(row.getCell(testCol)) || '').trim() : `Test ${rowNumber - headerRowIndex}`;
                let dateVal = dateCol !== -1 ? getCellValue(row.getCell(dateCol)) : '';
                if (dateVal instanceof Date) {
                    dateVal = dateVal.toISOString().split('T')[0];
                }

                // If completely empty row, skip
                if (!studId && !studName) return;

                // Read subjects marks
                const marksObj = {};
                let numericSum = 0;
                let isAbsentRow = false;

                activeSubList.forEach(sub => {
                    const col = subjectCols[sub];
                    if (col !== undefined) {
                        const rawVal = getCellValue(row.getCell(col));
                        const strVal = String(rawVal || '').trim().toUpperCase();
                        if (strVal === 'AB' || strVal === 'ABSENT' || strVal === 'A') {
                            marksObj[sub] = 'AB';
                            isAbsentRow = true;
                        } else if (strVal !== '' && !isNaN(Number(strVal))) {
                            const num = Number(strVal);
                            marksObj[sub] = num;
                            numericSum += num;
                        } else {
                            marksObj[sub] = strVal || 0;
                        }
                    } else {
                        marksObj[sub] = 0;
                    }
                });

                // Total Marks
                let totalMarksVal = totalCol !== -1 ? getCellValue(row.getCell(totalCol)) : null;
                let finalTotal = numericSum;
                if (totalMarksVal !== null && totalMarksVal !== '' && !isNaN(Number(totalMarksVal))) {
                    finalTotal = Number(totalMarksVal);
                }

                rawStudentRows.push({
                    studId: studId || studName,
                    studName: studName || studId || 'Student',
                    campus,
                    stream,
                    testName: test || 'Exam',
                    date: dateVal,
                    total: isAbsentRow ? 0 : finalTotal,
                    marks: marksObj,
                    isAB: isAbsentRow
                });
            });

            if (rawStudentRows.length === 0) {
                throw new Error('No valid student mark records found. Please ensure the template has student rows.');
            }

            // Group by Student ID
            const grouped = {};
            rawStudentRows.forEach(row => {
                const key = row.studId;
                if (!grouped[key]) {
                    grouped[key] = {
                        id: row.studId,
                        name: row.studName,
                        campus: row.campus,
                        stream: row.stream,
                        tests: []
                    };
                }
                grouped[key].tests.push({
                    testName: row.testName,
                    date: row.date,
                    total: row.total,
                    marks: row.marks,
                    isAB: row.isAB
                });
            });

            // Compute Averages for each student
            const studentList = Object.values(grouped).map(st => {
                const attended = st.tests.filter(t => !t.isAB);
                const count = attended.length;
                const avgTotal = count > 0 ? Math.round(attended.reduce((a, b) => a + (Number(b.total) || 0), 0) / count) : 0;

                const subjectAverages = {};
                activeSubList.forEach(sub => {
                    const validMarks = attended
                        .map(t => t.marks[sub])
                        .filter(m => m !== undefined && m !== null && m !== 'AB' && !isNaN(Number(m)))
                        .map(Number);
                    subjectAverages[sub] = validMarks.length > 0 ? Math.round(validMarks.reduce((a, b) => a + b, 0) / validMarks.length) : '-';
                });

                return {
                    ...st,
                    avgTotal,
                    subjectAverages
                };
            });

            setStudents(studentList);
            setCurrentStudentIndex(0);
            setStatusMessage({
                type: 'success',
                text: `Successfully parsed ${studentList.length} student(s) with ${rawStudentRows.length} exam records across ${activeSubList.length} subjects!`
            });
            logActivity(userData, 'Uploaded Custom Progress Excel', { studentsCount: studentList.length, subjects: activeSubList });
        } catch (err) {
            console.error('File parsing error:', err);
            setStatusMessage({
                type: 'error',
                text: `Failed to parse Excel file: ${err.message}`
            });
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

    // Remarks management
    const currentRemark = useMemo(() => {
        if (!activeStudent) return '';
        if (customRemarks[activeStudent.id]) {
            return customRemarks[activeStudent.id];
        }
        return generateDynamicRemarks(activeStudent.name, activeStudent.tests, selectedSubjects);
    }, [activeStudent, customRemarks, selectedSubjects]);

    const handleSaveRemark = () => {
        if (!activeStudent) return;
        setCustomRemarks(prev => ({
            ...prev,
            [activeStudent.id]: tempRemarkText
        }));
        setEditingRemarks(false);
    };

    // -------------------------------------------------------------
    // 4. HIGH-FIDELITY PDF GENERATION (Matching Sri Chaitanya Format)
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

    const renderStudentPDFPage = (doc, student, logoImg, fonts, subjects) => {
        // Embed Fonts if available
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
            // Warm off-white background: #FFFDF8
            doc.setFillColor(255, 253, 248);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');

            // Outer gold border: #C9962B (0.7mm)
            doc.setDrawColor(201, 150, 43);
            doc.setLineWidth(0.7);
            doc.rect(7.5, 7.5, pageWidth - 15, pageHeight - 15, 'S');

            // Inner thin line: #C9962B (0.25mm)
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

        // 2. Title: "Sri Chaitanya Educational Institutions"
        const titleY = 34.5;
        setFontOswald();
        doc.setFontSize(22);
        doc.setTextColor(10, 79, 196); // #0A4FC4
        const w1 = doc.getTextWidth("Sri Chaitanya ");

        setFontLibreBaskerville();
        doc.setFontSize(17);
        doc.setTextColor(26, 99, 200); // #1A63C8
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

        doc.setFillColor(15, 32, 87); // #0F2057
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

        // 4. Student Info Table & Initials Monogram Box
        const infoY = 49.5;
        const infoX = 14;
        const infoW = 142;
        const infoH = 29.6;
        const rowH = infoH / 4;

        const infoData = [
            { label: "Type of Report Card", value: "Academic", isBold: false },
            { label: "Name of the Student", value: student.name, isBold: true },
            { label: "Student ID", value: String(student.id || ''), isBold: true },
            { label: "Campus and Stream", value: `${student.campus || 'Campus'} · ${student.stream || 'Stream'}`, isBold: false }
        ];

        infoData.forEach((row, i) => {
            const y = infoY + (i * rowH);
            // Label cell
            doc.setFillColor(241, 244, 251); // #F1F4FB
            doc.setDrawColor(207, 214, 232); // #CFD6E8
            doc.setLineWidth(0.25);
            doc.rect(infoX, y, 48, rowH, 'FD');

            setFontNunitoBold();
            doc.setFontSize(8.5);
            doc.setTextColor(15, 32, 87); // #0F2057
            doc.text(row.label, infoX + 3, y + 4.8);

            // Value cell
            doc.setFillColor(255, 253, 248); // #FFFDF8
            doc.rect(infoX + 48, y, 94, rowH, 'FD');

            if (row.isBold) setFontNunitoBold();
            else setFontNunitoRegular();
            doc.setFontSize(8.5);
            doc.setTextColor(20, 32, 74); // #14204A
            doc.text(row.value, infoX + 51, y + 4.8);
        });

        // Photo / Monogram Box on Right (No photo needed for manual report)
        const photoX = 160;
        const photoY = infoY;
        const photoW = 36;
        const photoH = infoH;

        doc.setFillColor(255, 253, 248);
        doc.setDrawColor(201, 150, 43); // #C9962B
        doc.setLineWidth(0.9);
        doc.rect(photoX, photoY, photoW, photoH, 'FD');

        // Initials Avatar Monogram
        setFontCormorantBold();
        doc.setFontSize(22);
        doc.setTextColor(15, 32, 87);
        doc.text(getStudentInitials(student.name), photoX + (photoW / 2), photoY + 16, { align: 'center' });

        setFontNunitoRegular();
        doc.setFontSize(7);
        doc.setTextColor(93, 103, 136); // #5D6788
        doc.text("Student", photoX + (photoW / 2), photoY + 23, { align: 'center' });

        // 5. Section Heading
        const secHeadingY = 85.5;
        setFontCormorantBold();
        doc.setFontSize(14);
        doc.setTextColor(15, 32, 87);
        doc.text("Test-wise record", infoX, secHeadingY);

        // 6. Test-wise Table
        const headCols = ["Test", "Date", "Total Marks", ...subjects];
        const tableRows = (student.tests || []).map(t => {
            if (t.isAB) {
                return [
                    { content: t.testName, styles: { textColor: [198, 45, 71], fontStyle: 'bold', halign: 'left' } },
                    { content: formatDate(t.date), styles: { textColor: [198, 45, 71], fontStyle: 'bold', halign: 'center' } },
                    { content: 'Absent', colSpan: subjects.length + 1, styles: { halign: 'center', textColor: [198, 45, 71], fontStyle: 'bold' } }
                ];
            }
            return [
                { content: t.testName, styles: { fontStyle: 'bold', halign: 'left' } },
                { content: formatDate(t.date), styles: { fontStyle: 'bold', halign: 'center' } },
                { content: String(Math.round(t.total || 0)), styles: { fontStyle: 'bold', halign: 'center' } },
                ...subjects.map(sub => ({
                    content: String(t.marks && t.marks[sub] !== undefined && t.marks[sub] !== null ? Math.round(t.marks[sub]) : '-'),
                    styles: { fontStyle: 'bold', halign: 'center' }
                }))
            ];
        });

        // Average Row
        tableRows.push([
            { content: "Average", colSpan: 2, styles: { fontStyle: 'bold', halign: 'left', fillColor: [241, 244, 251] } },
            { content: String(student.avgTotal || '-'), styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 244, 251] } },
            ...subjects.map(sub => ({
                content: String(student.subjectAverages && student.subjectAverages[sub] !== undefined ? student.subjectAverages[sub] : '-'),
                styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 244, 251] }
            }))
        ]);

        // Proportional column widths calculation
        const totalAvailWidth = 182; // 210 - 28 margin
        const fixedWidth = 32 + 24 + 22; // Test (32), Date (24), Total (22) = 78mm
        const remainingWidth = totalAvailWidth - fixedWidth;
        const subWidth = Math.max(12, Math.floor(remainingWidth / subjects.length));

        const columnStyles = {
            0: { halign: 'left', fontStyle: 'bold', cellWidth: 32 },
            1: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
            2: { halign: 'center', fontStyle: 'bold', cellWidth: 22 }
        };
        subjects.forEach((_, idx) => {
            columnStyles[3 + idx] = { halign: 'center', fontStyle: 'bold', cellWidth: subWidth };
        });

        const tableFontSize = subjects.length <= 5 ? 8.5 : subjects.length <= 8 ? 8 : 7.2;

        autoTable(doc, {
            head: [headCols],
            body: tableRows,
            startY: 88.5,
            margin: { left: 14, right: 14, top: 16, bottom: 22 },
            theme: 'plain',
            headStyles: {
                fillColor: [15, 32, 87], // #0F2057
                textColor: [255, 255, 255],
                font: 'NunitoSans',
                fontStyle: 'bold',
                fontSize: tableFontSize,
                halign: 'center',
                valign: 'middle',
                cellPadding: 2,
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
                cellPadding: 1.6
            },
            columnStyles,
            didDrawCell: (data) => {
                if (data.row.index === tableRows.length - 1) {
                    // Gold top line on Average row
                    doc.setDrawColor(201, 150, 43); // #C9962B
                    doc.setLineWidth(0.6);
                    doc.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
                }
            }
        });

        let finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : 140;
        if (finalY + 45 > 270) {
            doc.addPage();
            drawBorderAndBackground();
            finalY = 24;
        }

        // Remarks Box
        const remarksBoxY = finalY;
        const remarksBoxW = 182;
        const remarksContent = customRemarks[student.id] || generateDynamicRemarks(student.name, student.tests, subjects);

        setFontCormorantItalic();
        doc.setFontSize(10);
        const splitRemarks = doc.splitTextToSize("Remarks: " + remarksContent, remarksBoxW - 12);
        const remarksH = Math.max(16, (splitRemarks.length * 4.8) + 6);

        doc.setFillColor(241, 244, 251); // #F1F4FB
        doc.setDrawColor(45, 86, 201); // #2D56C9
        doc.setLineWidth(0.4);
        doc.roundedRect(14, remarksBoxY, remarksBoxW, remarksH, 2, 2, 'FD');

        doc.setTextColor(20, 32, 74);
        doc.text(splitRemarks, 20, remarksBoxY + 5.5);

        // Signatures (Fixed at bottom of page)
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
    // 5. DOWNLOAD PDF HANDLERS (Combined vs Individual ZIP vs Current)
    // -------------------------------------------------------------
    const handleDownloadPDF = async (mode = 'combined') => {
        if (!students || students.length === 0) {
            setStatusMessage({ type: 'error', text: 'No student data uploaded yet!' });
            return;
        }

        setIsDownloading(true);
        setDownloadProgress({ current: 0, total: students.length, status: 'Initializing PDF fonts and assets...' });

        try {
            // Load fonts and logo in parallel
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
                // Download Current Student PDF only
                setDownloadProgress({ current: 1, total: 1, status: `Generating PDF for ${activeStudent.name}...` });
                const doc = new jsPDF('p', 'mm', 'a4');
                renderStudentPDFPage(doc, activeStudent, logoImg, fonts, selectedSubjects);
                const safeName = (activeStudent.name || 'Student').replace(/[/\\?%*:|"<>]/g, '_').trim();
                const fileName = `${safeName}_${activeStudent.id}_Progress_Report.pdf`;
                doc.save(fileName);
                setStatusMessage({ type: 'success', text: `Downloaded "${fileName}"!` });
                logActivity(userData, 'Downloaded Single Custom Progress PDF', { student: activeStudent.name });
            } else if (mode === 'combined') {
                // Download Single Multi-Page PDF with ALL Students
                const total = students.length;
                const doc = new jsPDF('p', 'mm', 'a4');

                for (let i = 0; i < total; i++) {
                    const st = students[i];
                    setDownloadProgress({ current: i + 1, total, status: `Appending student ${i + 1} of ${total}: ${st.name}` });
                    if (i > 0) doc.addPage();
                    renderStudentPDFPage(doc, st, logoImg, fonts, selectedSubjects);
                    // Yield brief control so UI updates
                    if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
                }

                const fileName = `${selectedStream}_Progress_Reports_All_Students.pdf`;
                doc.save(fileName);
                setStatusMessage({ type: 'success', text: `Downloaded combined PDF "${fileName}" for all ${total} students!` });
                logActivity(userData, 'Downloaded Combined Custom Progress PDF', { totalStudents: total, stream: selectedStream });
            } else if (mode === 'zip') {
                // Download Individual PDFs inside a ZIP archive
                const zip = new JSZip();
                const total = students.length;

                for (let i = 0; i < total; i++) {
                    const st = students[i];
                    setDownloadProgress({ current: i + 1, total, status: `Generating file ${i + 1} of ${total}: ${st.name}` });
                    const doc = new jsPDF('p', 'mm', 'a4');
                    renderStudentPDFPage(doc, st, logoImg, fonts, selectedSubjects);

                    const pdfBuffer = doc.output('arraybuffer');
                    const safeName = (st.name || 'Student').replace(/[/\\?%*:|"<>]/g, '_').trim();
                    const pdfFileName = `${st.id}_${safeName}_Progress_Report.pdf`;
                    zip.file(pdfFileName, pdfBuffer);

                    if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
                }

                setDownloadProgress({ current: total, total, status: 'Compressing ZIP archive...' });
                const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 2 } });
                const zipFileName = `${selectedStream}_Individual_Progress_Reports.zip`;
                saveAs(zipBlob, zipFileName);
                setStatusMessage({ type: 'success', text: `Downloaded individual PDFs in "${zipFileName}" (${total} files)!` });
                logActivity(userData, 'Downloaded Custom Progress ZIP', { totalStudents: total, stream: selectedStream });
            }
        } catch (err) {
            console.error('PDF Generation Error:', err);
            setStatusMessage({ type: 'error', text: `Failed to generate PDF: ${err.message}` });
        } finally {
            setIsDownloading(false);
        }
    };

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
                            Manual Upload System
                        </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '14px', color: '#E2E8F0', maxWidth: '750px', lineHeight: '1.5' }}>
                        Generate official Sri Chaitanya progress report cards by selecting custom streams, configuring subjects, downloading dynamic Excel templates, and generating individual or single combined PDFs.
                    </p>
                </div>

                <button
                    onClick={() => setShowInstructions(prev => !prev)}
                    style={{
                        background: 'rgba(255, 255, 255, 0.12)',
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        color: '#ffffff',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease'
                    }}
                >
                    <HelpCircle size={16} />
                    {showInstructions ? 'Hide Instructions' : 'View Instructions'}
                </button>
            </div>

            {/* Step-by-Step Instructions Card */}
            {showInstructions && (
                <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    marginBottom: '24px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
                }}>
                    <h3 style={{
                        fontSize: '15px',
                        fontWeight: '700',
                        color: '#0F2057',
                        marginTop: 0,
                        marginBottom: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <Sparkles size={18} color="#C9962B" />
                        How to Generate Custom Progress Reports (Step-by-Step)
                    </h3>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                        gap: '14px'
                    }}>
                        {[
                            {
                                num: '1',
                                title: 'Select Academic Stream',
                                desc: 'Choose between Medical (NEET), Engineering (JEE), CBSE Board, or PU Board.'
                            },
                            {
                                num: '2',
                                title: 'Configure & Customize Subjects',
                                desc: 'Check or uncheck the subjects for your batch/campus, or type to add custom subjects.'
                            },
                            {
                                num: '3',
                                title: 'Download Excel Template',
                                desc: 'Click "Download Excel Template" to get the pre-formatted .xlsx file with your selected columns.'
                            },
                            {
                                num: '4',
                                title: 'Fill Student Marks & Details',
                                desc: 'Enter Student ID, Name, Campus, Stream, Test, Date, subject marks and Total Marks in Excel.'
                            },
                            {
                                num: '5',
                                title: 'Upload Filled Excel Sheet',
                                desc: 'Drag & drop or browse your filled file. The system parses multi-test records and computes averages.'
                            },
                            {
                                num: '6',
                                title: 'Review & Verify Webview',
                                desc: 'Preview the student progress report card in Sri Chaitanya royal format (no photo required, initials monogram shown).'
                            },
                            {
                                num: '7',
                                title: 'Download Combined or Individual PDFs',
                                desc: 'Choose to download a Single Combined PDF for all students, an Individual PDFs ZIP bundle, or single student PDF.'
                            }
                        ].map(step => (
                            <div key={step.num} style={{
                                display: 'flex',
                                gap: '12px',
                                background: '#F8FAFC',
                                padding: '12px 14px',
                                borderRadius: '8px',
                                border: '1px solid #E2E8F0'
                            }}>
                                <span style={{
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '50%',
                                    background: '#0F2057',
                                    color: '#FFFFFF',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '12px',
                                    fontWeight: '800',
                                    flexShrink: 0
                                }}>
                                    {step.num}
                                </span>
                                <div>
                                    <h4 style={{ margin: '0 0 3px 0', fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>
                                        {step.title}
                                    </h4>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#64748B', lineHeight: '1.4' }}>
                                        {step.desc}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Notification / Status Alert */}
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

            {/* Control Grid: 1. Stream Selection | 2. Subject Checkboxes | 3. Template & Upload */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '20px',
                marginBottom: '26px'
            }}>
                {/* Panel 1: Stream Filter Selection */}
                <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
                }}>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F2057', marginTop: 0, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Layers size={18} color="#0A4FC4" />
                        1. Select Stream
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                        {Object.values(STREAM_PRESETS).map(st => {
                            const isSelected = selectedStream === st.id;
                            return (
                                <button
                                    key={st.id}
                                    type="button"
                                    onClick={() => handleStreamChange(st.id)}
                                    style={{
                                        background: isSelected ? '#EFF6FF' : '#F8FAFC',
                                        border: `2px solid ${isSelected ? '#0A4FC4' : '#E2E8F0'}`,
                                        borderRadius: '8px',
                                        padding: '12px 14px',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '4px'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span style={{ fontSize: '18px' }}>{st.icon}</span>
                                        {isSelected && (
                                            <span style={{ background: '#0A4FC4', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
                                                ✓
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ fontSize: '14px', fontWeight: '700', color: isSelected ? '#0A4FC4' : '#1E293B' }}>
                                        {st.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div style={{ background: '#F1F4FB', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: '#475569' }}>
                        <strong style={{ color: '#0F2057' }}>Active Stream:</strong> {STREAM_PRESETS[selectedStream].description}
                    </div>
                </div>

                {/* Panel 2: Subject Checkboxes */}
                <div style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '12px',
                    padding: '18px 20px',
                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#0F2057', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BookOpen size={18} color="#0A4FC4" />
                            2. Configure Subjects ({selectedSubjects.length} selected)
                        </h3>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                                type="button"
                                onClick={handleSelectAllSubjects}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#0A4FC4',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                }}
                            >
                                Select All
                            </button>
                            <span style={{ color: '#cbd5e1' }}>|</span>
                            <button
                                type="button"
                                onClick={handleResetSubjects}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#64748b',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Reset Defaults
                            </button>
                        </div>
                    </div>

                    {/* Subject Checkbox Grid */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                        gap: '8px',
                        maxHeight: '140px',
                        overflowY: 'auto',
                        padding: '4px',
                        marginBottom: '12px'
                    }}>
                        {availableSubjects.map(sub => {
                            const isChecked = selectedSubjects.includes(sub);
                            return (
                                <label
                                    key={sub}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '7px 10px',
                                        borderRadius: '6px',
                                        background: isChecked ? '#EFF6FF' : '#F8FAFC',
                                        border: `1px solid ${isChecked ? '#93C5FD' : '#E2E8F0'}`,
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: isChecked ? '700' : '500',
                                        color: isChecked ? '#1D4ED8' : '#334155',
                                        userSelect: 'none',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => toggleSubject(sub)}
                                        style={{ accentColor: '#0A4FC4', cursor: 'pointer', width: '14px', height: '14px' }}
                                    />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {sub}
                                    </span>
                                </label>
                            );
                        })}
                    </div>

                    {/* Add Custom Subject Form */}
                    <form onSubmit={handleAddCustomSubject} style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="text"
                            placeholder="+ Add custom subject..."
                            value={newSubjectName}
                            onChange={(e) => setNewSubjectName(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid #CBD5E1',
                                fontSize: '12px',
                                outline: 'none'
                            }}
                        />
                        <button
                            type="submit"
                            style={{
                                background: '#F1F5F9',
                                border: '1px solid #CBD5E1',
                                color: '#1E293B',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}
                        >
                            <Plus size={14} /> Add
                        </button>
                    </form>
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
                            3. Download Template & Upload Data
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
                                boxShadow: '0 2px 6px rgba(15, 32, 87, 0.2)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <Download size={16} color="#C9962B" />
                            Download {STREAM_PRESETS[selectedStream].label} Template (.xlsx)
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
                            Supports .xlsx, .xls, or .csv template
                        </span>
                    </div>
                </div>
            </div>

            {/* If no students loaded yet, show helpful empty state */}
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
                        Download the {STREAM_PRESETS[selectedStream].label} Excel template above, enter student marks and records, then upload the file to generate Webview and PDF progress report cards.
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
                    {/* Action Toolbar: Navigation + PDF Export Options */}
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

                        {/* PDF Download Options Buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            {/* Option 1: Combined Single PDF */}
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

                            {/* Option 2: Individual PDFs in ZIP */}
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

                            {/* Option 3: Current Student PDF */}
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

                    {/* Progress Bar when generating bulk PDF */}
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

                    {/* Webview Progress Report Sheet (Matching Sri Chaitanya Official Format) */}
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

                                {/* Student Info & Monogram Avatar Section */}
                                <div className="rc-student-section" style={{ display: 'flex', gap: '20px', marginTop: '24px', alignItems: 'stretch' }}>
                                    <table className="rc-info-table" style={{ flex: 1, borderCollapse: 'collapse', width: '100%' }}>
                                        <tbody>
                                            <tr>
                                                <td className="rc-info-label" style={{ backgroundColor: '#F1F4FB', color: '#0F2057', fontWeight: 700, fontSize: '13px', padding: '8px 14px', width: '38%', border: '1px solid #CFD6E8' }}>
                                                    Type of Report Card
                                                </td>
                                                <td className="rc-info-value" style={{ backgroundColor: '#FFFDF8', color: '#14204A', fontWeight: 700, fontSize: '13.5px', padding: '8px 14px', border: '1px solid #CFD6E8' }}>
                                                    Academic
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="rc-info-label" style={{ backgroundColor: '#F1F4FB', color: '#0F2057', fontWeight: 700, fontSize: '13px', padding: '8px 14px', border: '1px solid #CFD6E8' }}>
                                                    Name of the Student
                                                </td>
                                                <td className="rc-info-value" style={{ backgroundColor: '#FFFDF8', color: '#14204A', fontWeight: 700, fontSize: '13.5px', padding: '8px 14px', border: '1px solid #CFD6E8' }}>
                                                    {activeStudent.name || '-'}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="rc-info-label" style={{ backgroundColor: '#F1F4FB', color: '#0F2057', fontWeight: 700, fontSize: '13px', padding: '8px 14px', border: '1px solid #CFD6E8' }}>
                                                    Student ID
                                                </td>
                                                <td className="rc-info-value" style={{ backgroundColor: '#FFFDF8', color: '#14204A', fontWeight: 700, fontSize: '13.5px', padding: '8px 14px', border: '1px solid #CFD6E8' }}>
                                                    {activeStudent.id || '-'}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td className="rc-info-label" style={{ backgroundColor: '#F1F4FB', color: '#0F2057', fontWeight: 700, fontSize: '13px', padding: '8px 14px', border: '1px solid #CFD6E8' }}>
                                                    Campus and Stream
                                                </td>
                                                <td className="rc-info-value" style={{ backgroundColor: '#FFFDF8', color: '#14204A', fontWeight: 700, fontSize: '13.5px', padding: '8px 14px', border: '1px solid #CFD6E8' }}>
                                                    {activeStudent.campus || '-'} · {activeStudent.stream || STREAM_PRESETS[selectedStream].label}
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* Monogram Box (No photo required as requested) */}
                                    <div className="rc-photo-box" style={{
                                        width: '125px',
                                        minWidth: '125px',
                                        border: '3px solid #C9962B',
                                        backgroundColor: '#FFFDF8',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative',
                                        borderRadius: '2px'
                                    }}>
                                        <div style={{
                                            fontFamily: "'Cormorant Garamond', Georgia, serif",
                                            fontWeight: '700',
                                            fontSize: '32px',
                                            color: '#0F2057',
                                            letterSpacing: '1px'
                                        }}>
                                            {getStudentInitials(activeStudent.name)}
                                        </div>
                                        <span style={{ fontSize: '11px', color: '#5D6788', fontWeight: '600', marginTop: '2px' }}>
                                            Student
                                        </span>
                                    </div>
                                </div>

                                {/* Section Heading */}
                                <h3 className="rc-section-heading" style={{
                                    fontFamily: "'Cormorant Garamond', serif",
                                    fontSize: '20px',
                                    fontWeight: '700',
                                    color: '#0F2057',
                                    margin: '28px 0 12px 0'
                                }}>
                                    Test-wise record
                                </h3>

                                {/* Dynamic Test-wise Table */}
                                <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                                    <table className="rc-test-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                                        <thead>
                                            <tr style={{ background: '#0F2057', color: '#ffffff' }}>
                                                <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #CFD6E8', fontSize: '13px' }}>Test</th>
                                                <th style={{ padding: '8px 10px', border: '1px solid #CFD6E8', fontSize: '13px' }}>Date</th>
                                                <th style={{ padding: '8px 10px', border: '1px solid #CFD6E8', fontSize: '13px' }}>Total Marks</th>
                                                {selectedSubjects.map(sub => (
                                                    <th key={sub} style={{ padding: '8px 10px', border: '1px solid #CFD6E8', fontSize: '13px' }}>
                                                        {sub}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(activeStudent.tests || []).map((t, idx) => {
                                                if (t.isAB) {
                                                    return (
                                                        <tr key={idx} style={{ background: '#FFF5F5', color: '#C62D47' }}>
                                                            <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', border: '1px solid #CFD6E8' }}>{t.testName}</td>
                                                            <td style={{ padding: '8px 10px', fontWeight: '700', border: '1px solid #CFD6E8' }}>{formatDate(t.date)}</td>
                                                            <td colSpan={selectedSubjects.length + 1} style={{ padding: '8px 10px', fontWeight: '700', textAlign: 'center', border: '1px solid #CFD6E8' }}>
                                                                Absent
                                                            </td>
                                                        </tr>
                                                    );
                                                }
                                                return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #CFD6E8' }}>
                                                        <td style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '700', color: '#14204A', border: '1px solid #CFD6E8' }}>{t.testName}</td>
                                                        <td style={{ padding: '8px 10px', fontWeight: '600', color: '#14204A', border: '1px solid #CFD6E8' }}>{formatDate(t.date)}</td>
                                                        <td style={{ padding: '8px 10px', fontWeight: '800', color: '#0F2057', border: '1px solid #CFD6E8' }}>{Math.round(t.total || 0)}</td>
                                                        {selectedSubjects.map(sub => (
                                                            <td key={sub} style={{ padding: '8px 10px', fontWeight: '700', color: '#14204A', border: '1px solid #CFD6E8' }}>
                                                                {t.marks && t.marks[sub] !== undefined && t.marks[sub] !== null ? Math.round(t.marks[sub]) : '-'}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}

                                            {/* Average Row */}
                                            <tr style={{ background: '#F1F4FB', borderTop: '2px solid #C9962B', fontWeight: '800', color: '#0F2057' }}>
                                                <td colSpan={2} style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #CFD6E8' }}>Average</td>
                                                <td style={{ padding: '8px 10px', border: '1px solid #CFD6E8' }}>{activeStudent.avgTotal || '-'}</td>
                                                {selectedSubjects.map(sub => (
                                                    <td key={sub} style={{ padding: '8px 10px', border: '1px solid #CFD6E8' }}>
                                                        {activeStudent.subjectAverages && activeStudent.subjectAverages[sub] !== undefined ? activeStudent.subjectAverages[sub] : '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                {/* Dynamic Remarks Box */}
                                <div style={{
                                    background: '#F1F4FB',
                                    border: '1px solid #2D56C9',
                                    borderRadius: '6px',
                                    padding: '12px 18px',
                                    marginBottom: '34px',
                                    position: 'relative'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#0F2057', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                                            Remarks
                                        </span>
                                        {!editingRemarks ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTempRemarkText(currentRemark);
                                                    setEditingRemarks(true);
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#2D56C9',
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <Edit3 size={12} /> Edit
                                            </button>
                                        ) : (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    type="button"
                                                    onClick={handleSaveRemark}
                                                    style={{
                                                        background: '#0F2057',
                                                        color: '#fff',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '2px 8px',
                                                        fontSize: '11px',
                                                        fontWeight: '600',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    <Save size={11} /> Save
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingRemarks(false)}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#64748B',
                                                        fontSize: '11px',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {editingRemarks ? (
                                        <textarea
                                            value={tempRemarkText}
                                            onChange={(e) => setTempRemarkText(e.target.value)}
                                            rows={3}
                                            style={{
                                                width: '100%',
                                                padding: '8px',
                                                borderRadius: '4px',
                                                border: '1px solid #CBD5E1',
                                                fontSize: '13px',
                                                fontFamily: "'Nunito Sans', sans-serif",
                                                outline: 'none',
                                                boxSizing: 'border-box'
                                            }}
                                        />
                                    ) : (
                                        <p style={{
                                            margin: 0,
                                            fontSize: '13.5px',
                                            fontStyle: 'italic',
                                            color: '#14204A',
                                            lineHeight: '1.5',
                                            fontFamily: "'Cormorant Garamond', Georgia, serif"
                                        }}>
                                            {currentRemark}
                                        </p>
                                    )}
                                </div>

                                {/* Signatures Footer */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    paddingTop: '36px',
                                    marginTop: '20px',
                                    borderTop: 'none'
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
