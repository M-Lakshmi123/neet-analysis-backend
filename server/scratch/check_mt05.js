require('dotenv').config({ path: '../.env' });
const { connectToDb } = require('../db');

(async () => {
    try {
        const pool = await connectToDb('2026');
        
        // 1. Fetch students
        const streamVal = ['SR ELITE(P - II)'];
        const cleanStreams = streamVal.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
        
        const [students] = await pool.rawPool.query(`
            SELECT CAST(STUD_ID AS CHAR) as id, MAX(TRIM(Student_Name)) as name, MAX(TRIM(Branch)) as campus
            FROM ERP_REPORT 
            WHERE Stream IN (${cleanStreams}) AND Test IN ('MT-05') AND Test_Type IN ('MT')
            GROUP BY STUD_ID
        `);
        
        const currentTopNames = students.map(s => s.name).filter(Boolean);
        const cleanNames = currentTopNames.map(n => `'${n.replace(/'/g, "''")}'`).join(',');
        
        // 2. Fetch report data
        const reportQuery = `
            SELECT 
                CAST(STUD_ID AS CHAR) as STUD_ID,
                Student_Name, Branch, Exam_Date, Test_Type, Test, Tot_720, AIR,
                Q_No, W_U, National_Wide_Error, Q_URL, S_URL, Key_Value, Subject,
                Topic, Sub_Topic, Question_Type, Statement, Year, Top_ALL, Stream, Custom_Heading
            FROM ERP_REPORT 
            WHERE Stream IN (${cleanStreams}) AND Test IN ('MT-05') AND Test_Type IN ('MT')
            AND (UPPER(TRIM(W_U)) = 'W' OR UPPER(TRIM(W_U)) = 'U')
            AND UPPER(TRIM(Student_Name)) IN (${cleanNames})
            LIMIT 50000
        `;
        const [errorData] = await pool.rawPool.query(reportQuery);

        // 3. Process exactly like ErrorTop100.jsx
        const testsGrouped = {};
        const studentScoresByTest = {};

        errorData.forEach(row => {
            const testKey = row.Test;
            if (!studentScoresByTest[testKey]) {
                studentScoresByTest[testKey] = {};
            }
            const sName = (row.Student_Name || '').trim();
            if (sName) {
                const key = sName.toUpperCase();
                if (!studentScoresByTest[testKey][key]) {
                    studentScoresByTest[testKey][key] = {
                        name: sName,
                        campus: row.Branch,
                        tot: parseFloat(row.Tot_720) || 0,
                        air: parseFloat(row.AIR) || 999999
                    };
                } else {
                    const tot = parseFloat(row.Tot_720) || 0;
                    const air = parseFloat(row.AIR) || 999999;
                    if (tot > studentScoresByTest[testKey][key].tot) {
                        studentScoresByTest[testKey][key].tot = tot;
                    }
                    if (air > 0 && air < studentScoresByTest[testKey][key].air) {
                        studentScoresByTest[testKey][key].air = air;
                    }
                }
            }

            if (!testsGrouped[testKey]) {
                testsGrouped[testKey] = {
                    testName: row.Test,
                    date: row.Exam_Date,
                    customHeading: row.Custom_Heading,
                    stream: row.Stream,
                    questions: {}
                };
            }

            const qKey = `${row.Subject}_${row.Q_No}`;
            if (!testsGrouped[testKey].questions[qKey]) {
                testsGrouped[testKey].questions[qKey] = {
                    qNo: row.Q_No,
                    subject: row.Subject,
                    topic: row.Topic,
                    subTopic: row.Sub_Topic,
                    qUrl: row.Q_URL,
                    sUrl: row.S_URL,
                    keyValue: row.Key_Value,
                    nationalError: row.National_Wide_Error,
                    wrongStudents: []
                };
            }

            if (sName) {
                const exists = testsGrouped[testKey].questions[qKey].wrongStudents.some(s => (s.name || '').toUpperCase() === sName.toUpperCase());
                if (!exists) {
                    testsGrouped[testKey].questions[qKey].wrongStudents.push({
                        name: sName,
                        campus: row.Branch
                    });
                }
            }
        });

        // Rank students
        const rankedStudentsMap = {};
        Object.entries(studentScoresByTest).forEach(([testKey, studentsObj]) => {
            const list = Object.values(studentsObj);
            list.sort((a, b) => {
                if (a.air !== 999999 && b.air !== 999999 && a.air !== b.air) {
                    return a.air - b.air;
                }
                if (b.tot !== a.tot) {
                    return b.tot - a.tot;
                }
                return a.name.localeCompare(b.name);
            });
            rankedStudentsMap[testKey] = list.map(s => s.name);
        });

        const test = Object.values(testsGrouped)[0];
        test.rankedStudents = rankedStudentsMap[test.testName] || [];
        test.questions = Object.values(test.questions);

        console.log('Ranked Students count:', test.rankedStudents.length);
        console.log('Top 18 Ranked Students:', test.rankedStudents.slice(0, 18));

        // Now run getTopFilteredQuestions with limit = 18
        const limit = 18;
        const topNList = test.rankedStudents.slice(0, Number(limit));
        const allowedSet = new Set(topNList.map(n => n.toUpperCase()));

        const filteredQs = test.questions
            .map(q => {
                const filteredWrong = q.wrongStudents.filter(s => allowedSet.has((s.name || '').toUpperCase()));
                return {
                    ...q,
                    wrongCount: filteredWrong.length
                };
            })
            .filter(q => q.wrongCount > 0);

        console.log('Filtered Questions count for Top 18:', filteredQs.length);

        process.exit(0);
    } catch (e) {
        console.error('Error running check:', e);
        process.exit(1);
    }
})();
