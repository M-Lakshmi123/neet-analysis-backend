const { connectToDb } = require('../db');

// Replicate buildWhereClause from index.js
const buildWhereClause = (req, options = {}) => {
    const params = req.body && Object.keys(req.body).length > 0 ? { ...req.query, ...req.body } : req.query;
    const { campus, stream, test, testType, topAll, studentSearch, quickSearch } = params;
    let clauses = [];

    const addClause = (field, value) => {
        if (!value || value === 'All' || value === '__ALL__') return;
        const valArray = Array.isArray(value) ? value : [value];

        let selection = [...valArray];
        if (field === 'Stream') {
            const groups = {
                'JR ELITE': ['JR ELITE', 'JR ELITE & AIIMS', 'JR_ELITE', 'JR_ELITE_SET_01'],
                'JR_ELITE': ['JR ELITE', 'JR ELITE & AIIMS', 'JR_ELITE', 'JR_ELITE_SET_01'],
                'JR AIIMS': ['JR AIIMS', 'JR ELITE & AIIMS', 'JR_AIIMS'],
                'JR_AIIMS': ['JR AIIMS', 'JR ELITE & AIIMS', 'JR_AIIMS'],
                'SR ELITE': ['SR ELITE', 'SR_ELITE_SET_01', 'SR_ELITE_SET_02', 'SR-ELITE', 'SR ELITE-SET-01', 'SR ELITE-SET-02', 'SR_ELITE'],
                'SR_ELITE': ['SR ELITE', 'SR_ELITE_SET_01', 'SR_ELITE_SET_02', 'SR-ELITE', 'SR ELITE-SET-01', 'SR ELITE-SET-02', 'SR_ELITE']
            };
            valArray.forEach(v => {
                if (!v) return;
                const rawV = v.toString().trim().toUpperCase();
                const spaceV = rawV.replace(/_/g, ' ').replace(/-/g, ' ');
                const underscoreV = rawV.replace(/ /g, '_').replace(/-/g, '_');

                [rawV, spaceV, underscoreV].forEach(key => {
                    if (groups[key]) {
                        selection = [...new Set([...selection, ...groups[key]])];
                    }
                });
            });
        }

        const cleanValues = selection
            .map(v => v ? v.toString().trim().toUpperCase() : '')
            .filter(v => v !== '' && v !== '__ALL__')
            .map(v => v.replace(/'/g, "''"));
        if (cleanValues.length === 0) return;
        const list = cleanValues.map(v => `'${v}'`).join(',');
        clauses.push(`UPPER(TRIM(${field})) IN (${list})`);
    };

    const effectiveCampus = (campus && (Array.isArray(campus) ? campus.length > 0 : String(campus).trim() !== ''))
        ? campus
        : (params._allowedCampuses || []);

    if (!options.ignoreCampus) addClause('CAMPUS_NAME', effectiveCampus);
    if (!options.ignoreStream) addClause('Stream', stream);
    if (!options.ignoreTest) addClause('Test', test);
    if (!options.ignoreTestType) addClause('Test_Type', testType);
    if (!options.ignoreTopAll) addClause('Top_ALL', topAll);

    if (!options.ignoreStudent) {
        const sSearch = Array.isArray(studentSearch) ? studentSearch : (studentSearch ? [studentSearch] : []);
        const cleanIds = sSearch
            .filter(id => id && id !== 'null' && id !== 'undefined')
            .map(id => id.toString().trim().toUpperCase().replace(/'/g, "''"))
            .filter(v => v !== '' && v !== '__ALL__' && v !== 'SELECT_ALL');

        if (cleanIds.length > 0) {
            const list = cleanIds.map(v => `'${v}'`).join(',');
            clauses.push(`STUD_ID IN (${list})`);
        } else if (quickSearch && typeof quickSearch === 'string' && quickSearch.trim() !== '') {
            const safeSearch = quickSearch.trim().replace(/'/g, "''").toUpperCase();
            clauses.push(`(UPPER(NAME_OF_THE_STUDENT) LIKE '%${safeSearch}%' OR STUD_ID LIKE '%${safeSearch}%')`);
        }
    }

    if (clauses.length === 0) return '';
    return 'WHERE ' + clauses.join(' AND ');
};

(async () => {
    const pool = await connectToDb('2026');
    const where = buildWhereClause({ body: { campus: ['ELECTRONIC CITY'], stream: ['JR ELITE'], studentSearch: ["__ALL__"] } });
    console.log('Generated WHERE clause:', where);
    const count = await pool.request().query(`SELECT COUNT(*) as count FROM MEDICAL_RESULT ${where}`);
    console.log('Result count:', count.recordset);
    process.exit(0);
})();
