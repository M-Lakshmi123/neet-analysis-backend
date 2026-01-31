const fs = require('fs');
const path = require('path');

const root = 'f:\\neet-analysis-backend-master\\neet-analysis-backend-master';
const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000); // 6 hours ago

let modifiedFiles = [];

function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === '.gemini') continue;
        const fullPath = path.join(dir, file);
        const stats = fs.statSync(fullPath);
        if (stats.isDirectory()) {
            walk(fullPath);
        } else if (stats.mtime > cutoff) {
            modifiedFiles.push({
                path: path.relative(root, fullPath),
                mtime: stats.mtime
            });
        }
    }
}

walk(root);
fs.writeFileSync('modified_files.txt', JSON.stringify(modifiedFiles, null, 2));
console.log('Done');
