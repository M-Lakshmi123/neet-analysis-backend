const fs = require('fs');
const path = require('path');

const src = String.raw`C:\Users\Administrator\.gemini\antigravity\brain\72c44e4b-82d0-4ede-ae85-67b56d01d42d\college_library_bg_1768981165377.png`;
const dest = String.raw`f:\Projects\NEET Analysis\client\public\college-bg.png`;

try {
    console.log(`Copying from ${src} to ${dest}`);
    fs.copyFileSync(src, dest);
    console.log("Success!");
} catch (err) {
    console.error("Error copying file:", err);
}
