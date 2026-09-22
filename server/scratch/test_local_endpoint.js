require('dotenv').config({ path: '../.env' });
const { connectToDb } = require('../db');

app_get_erp_students = async (req) => {
    const year = req.query.academicYear || '2026';
    const pool = await connectToDb(year);
    const { quickSearch, campus, stream, test, testType, topAll, TOP_ALL, studentSearch } = req.query;

    let clauses = [];
    const addClause = (field, value) => {
        if (!value || value === 'All' || value === '__ALL__') return;
        const valArray = Array.isArray(value) ? value : [value];

        let selection = [...valArray];
        if (field === 'Stream') {
            const groups = {
                'JR ELITE': ['JR ELITE', 'JR ELITE & AIIMS'],
                'JR AIIMS': ['JR AIIMS', 'JR ELITE & AIIMS'],
                'SR ELITE': ['SR ELITE', 'SR_ELITE_SET_01', 'SR_ELITE_SET_02']
            };
            valArray.forEach(v => {
                if (groups[v]) {
                    selection = [...new Set([...selection, ...groups[v]])];
                }
            });
        }

        const cleanValues = selection.map(v => v ? v.toString().trim().toUpperCase().replace(/'/g, "''") : '').filter(Boolean);
        if (cleanValues.length === 0) return;
        clauses.push(`${field} IN (${cleanValues.map(v => `'${v}'`).join(',')})`);
    };

    addClause('Branch', campus);
    addClause('Stream', stream);
    addClause('Test', test);
    addClause('Test_Type', testType);

    const finalTopAll = topAll || TOP_ALL;
    addClause('Top_ALL', finalTopAll);

    const sSearch = Array.isArray(studentSearch) ? studentSearch : (studentSearch ? [studentSearch] : []);
    const cleanIds = sSearch.map(id => id ? id.toString().trim().toUpperCase().replace(/'/g, "''") : '').filter(v => Boolean(v) && v !== '__ALL__' && v !== 'SELECT_ALL' && !v.includes('TOP_18'));

    if (cleanIds.length > 0) {
        clauses.push(`TRIM(STUD_ID) IN (${cleanIds.map(v => `'${v}'`).join(',')})`);
    } else if (quickSearch && quickSearch.trim() !== '' && !quickSearch.toUpperCase().includes('TOP 18') && !quickSearch.toUpperCase().includes('TOP_18')) {
        const safeSearch = quickSearch.trim().replace(/'/g, "''").toUpperCase();
        clauses.push(`(UPPER(Student_Name) LIKE '%${safeSearch}%' OR STUD_ID LIKE '%${safeSearch}%')`);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : "WHERE 1=1";

    console.log(`[ERP Students] Filtering with: ${whereClause}`);

    const query = `
        SELECT 
            CAST(STUD_ID AS CHAR) as id, 
            MAX(TRIM(Student_Name)) as name,
            MAX(TRIM(Branch)) as campus,
            MAX(TRIM(Stream)) as stream
        FROM ERP_REPORT 
        ${whereClause} 
        GROUP BY STUD_ID
        ORDER BY name
        LIMIT 10000`;

    const result = await pool.request().query(query);
    return result.recordset;
};

(async () => {
    try {
        const test1 = await app_get_erp_students({ query: { academicYear: '2026', stream: 'SR ELITE(P - II)', testType: 'MT', test: 'MT-05' } });
        console.log('Test 1 (Normal MT-05):', test1.length, 'students');

        const fallbackIds = ['257403546', '257404738', '257403653', '257427698', '213309261', '246556423', '246555884', '246555726', '257407693', '246556345', '213307653', '257420307', '257400127', '257403537', '257409631', '257402548', '257405810', '257406595'];
        const test2 = await app_get_erp_students({ query: { academicYear: '2026', stream: 'SR ELITE(P - II)', testType: 'MT', test: 'MT-05', isTop18: 'true', studentSearch: fallbackIds, quickSearch: '⭐ TOP 18 Members (18 Selected)' } });
        console.log('Test 2 (TOP 18 filter active):', test2.length, 'students');

        process.exit(0);
    } catch (e) {
        console.error('Error:', e);
        process.exit(1);
    }
})();
