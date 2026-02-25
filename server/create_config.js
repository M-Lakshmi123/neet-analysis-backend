const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'Uploader_Config.xlsx');

const topStudents = [
    { STUD_ID: 'ID1', Category: 'TOP' },
    { STUD_ID: 'ID2', Category: 'SUPER JR ELITE TOP' }
];

const allowedCampuses = [
    { CAMPUS_NAME: 'BEN/PU COLLEGE BELLANDUR' },
    { CAMPUS_NAME: 'BEN/PU COLLEGE ELECTRONIC CITY DS' }
];

const wb = XLSX.utils.book_new();
const wsTop = XLSX.utils.json_to_sheet(topStudents);
XLSX.utils.book_append_sheet(wb, wsTop, 'Top_Students');

const wsCampus = XLSX.utils.json_to_sheet(allowedCampuses);
XLSX.utils.book_append_sheet(wb, wsCampus, 'Allowed_Campuses');

XLSX.writeFile(wb, filePath);
console.log('Created Uploader_Config.xlsx at', filePath);
