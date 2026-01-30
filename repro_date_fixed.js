
const date1 = "05-10-2023"; // Intended 5th Oct
const date2 = "15-10-2023"; // Intended 15th Oct
const date3 = "2023-10-05"; // ISO format check
const date4 = "10/05/2023"; // US format appearing string check (if any) - though we target DD-MM-YYYY

function formatDate(dateStr) {
    if (!dateStr) return '';

    // Handle DD-MM-YYYY or DD/MM/YYYY manually
    // Regex matches starts with 1 or 2 digits, separator, 1 or 2 digits, separator, 4 digits
    const dmyPattern = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/;
    const match = String(dateStr).match(dmyPattern);

    let date;
    if (match) {
        // match[1] = day, match[2] = month, match[3] = year
        // Month is 0-indexed in JS Date
        date = new Date(match[3], match[2] - 1, match[1]);
    } else {
        date = new Date(dateStr);
    }

    if (isNaN(date.getTime())) return dateStr;

    const day = String(date.getDate()).padStart(2, '0');
    const monthIndex = date.getMonth();
    const year = date.getFullYear();

    const month = String(monthIndex + 1).padStart(2, '0');
    return `${day}/${month}/${year}`;
}

console.log(`Original "${date1}" -> Fixed: ${formatDate(date1)} (Expected: 05/10/2023)`);
console.log(`Original "${date2}" -> Fixed: ${formatDate(date2)} (Expected: 15/10/2023)`);
console.log(`Original "${date3}" -> Fixed: ${formatDate(date3)} (Expected: 05/10/2023)`);
