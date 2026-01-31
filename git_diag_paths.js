const fs = require('fs');
const { execSync } = require('child_process');

const paths = [
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files\\Git\\bin\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
    'C:\\Windows\\System32\\git.exe',
    'C:\\Users\\mlaks\\AppData\\Local\\Programs\\Git\\cmd\\git.exe'
];

let log = '--- Path Check ---\n';
paths.forEach(p => {
    log += `${p}: ${fs.existsSync(p) ? 'EXISTS' : 'MISSING'}\n`;
});

log += '\n--- Environment PATH ---\n';
log += process.env.PATH.split(';').join('\n');

fs.writeFileSync('git_path_check.txt', log);
console.log('Done');
