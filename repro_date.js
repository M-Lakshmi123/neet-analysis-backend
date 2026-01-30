
const date1 = "05-10-2023"; // Intended 5th Oct
const d1 = new Date(date1);
console.log(`"${date1}" -> ${d1.toString()}`);

const date2 = "15-10-2023"; // Intended 15th Oct
const d2 = new Date(date2);
console.log(`"${date2}" -> ${d2.toString()}`);

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const day = String(date.getDate()).padStart(2, '0');
    const monthIndex = date.getMonth();
    const year = date.getFullYear();
    
    const month = String(monthIndex + 1).padStart(2, '0');
    return `${day}/${month}/${year}`;
}

console.log(`Formatted "${date1}" -> ${formatDate(date1)}`);
console.log(`Formatted "${date2}" -> ${formatDate(date2)}`);
