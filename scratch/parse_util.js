function parseCSV(text) {
    const lines = [];
    let row = [];
    let curr = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            inQuotes = !inQuotes;
        } else if (c === ',' && !inQuotes) {
            row.push(curr.trim());
            curr = '';
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && text[i+1] === '\n') i++;
            row.push(curr.trim());
            curr = '';
            if (row.some(cell => cell !== '')) lines.push(row);
            row = [];
        } else {
            curr += c;
        }
    }
    if (curr || row.length > 0) {
        row.push(curr.trim());
        if (row.some(cell => cell !== '')) lines.push(row);
    }
    return lines;
}
module.exports = { parseCSV };
