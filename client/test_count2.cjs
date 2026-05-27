const fs = require('fs');
const path = require('path');

const size1 = fs.statSync('..\\Error Report Template.xlsx').size;
const size2 = fs.statSync('test_clear.xlsx').size;

console.log('Original size:', size1);
console.log('Cleared size:', size2);
