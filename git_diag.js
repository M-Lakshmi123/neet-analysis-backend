const { execSync } = require('child_process');
const fs = require('fs');

let log = '';
function run(cmd) {
    log += `\n--- Running: ${cmd} ---\n`;
    try {
        const out = execSync(cmd, { encoding: 'utf8' });
        log += out;
    } catch (e) {
        log += `ERROR: ${e.message}\n`;
        if (e.stdout) log += `STDOUT: ${e.stdout}\n`;
        if (e.stderr) log += `STDERR: ${e.stderr}\n`;
    }
}

run('git --version');
run('dir /a');
run('git status');
run('whoami');

fs.writeFileSync('git_diag.txt', log);
console.log('Diag finished');
