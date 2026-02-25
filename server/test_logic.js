
const column = 'Stream';
const values = ['JR ELITE'];

const buildOptionClause = (column, values) => {
    if (!values || values === 'All' || values === '__ALL__') return null;
    const valArray = Array.isArray(values) ? values : [values];

    // --- STREAM GROUPING LOGIC ---
    let selection = [...valArray];
    if (column === 'Stream') {
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

    const cleanValues = selection
        .map(v => v ? v.toString().trim() : '')
        .filter(v => v !== '' && v !== '__ALL__')
        .map(v => v.replace(/'/g, "''"));

    if (cleanValues.length === 0) return null;
    const list = cleanValues.map(v => `'${v}'`).join(',');
    return `${column} IN (${list})`;
};

try {
    const res = buildOptionClause(column, values);
    console.log("RESULT:", res);
} catch (err) {
    console.error("ERROR:", err);
}
