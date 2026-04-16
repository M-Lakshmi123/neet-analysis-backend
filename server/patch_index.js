const fs = require('fs');
const p = 'index.js';
let c = fs.readFileSync(p, 'utf8');

if (c.includes('/api/erp/students')) {
    console.log('Endpoint already exists');
} else {
    const newEndpoint = `

// Get ERP Students (Cascading)
app.get('/api/erp/students', async (req, res) => {
    try {
        const year = req.query.academicYear || '2026';
        const pool = await connectToDb(year);
        let clauses = [];
        const { campus, stream, test, testType, topAll, quickSearch } = req.query;
        const addClause = (field, value) => {
            if (!value || value === 'All' || value === '__ALL__') return;
            const valArray = Array.isArray(value) ? value : [value];
            const cleanValues = valArray.map(v => v ? v.toString().trim().toUpperCase().replace(/'/g, "''") : '').filter(Boolean);
            if (cleanValues.length === 0) return;
            clauses.push(\`\${field} IN(\${cleanValues.map(v => \`'\${v}'\`).join(',')})\`);
        };
        addClause('Branch', campus);
        addClause('Stream', stream);
        addClause('Test', test);
        addClause('Test_Type', testType);
        addClause('Top_ALL', topAll);
        if (quickSearch && quickSearch.trim() !== '') {
            const safeSearch = quickSearch.trim().replace(/'/g, "''").toUpperCase();
            clauses.push(\`(Student_Name LIKE '%\${safeSearch}%' OR STUD_ID LIKE '%\${safeSearch}%')\`);
        }
        const where = clauses.length > 0 ? \`WHERE \${clauses.join(' AND ')}\` : '';
        const query = \`SELECT DISTINCT CAST(STUD_ID AS CHAR) as id, TRIM(Student_Name) as name, TRIM(Branch) as campus FROM ERP_REPORT \${where} ORDER BY name LIMIT 200\`;
        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error("[ERP Students] ERROR:", err);
        res.status(500).send(err.message);
    }
});
`;

    c = c.replace("app.get('/api/erp/report',", newEndpoint + "app.get('/api/erp/report',");
    fs.writeFileSync(p, c);
    console.log('Successfully added erp students endpoint');
}
