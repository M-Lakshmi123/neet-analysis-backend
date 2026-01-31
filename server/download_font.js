const fs = require('fs');
const https = require('https');
const path = require('path');

const fileUrl = "https://github.com/google/fonts/raw/main/ofl/anton/Anton-Regular.ttf";
const outputDir = path.join(__dirname, '../client/public/fonts');
const outputPath = path.join(outputDir, 'Anton-Regular.ttf');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const file = fs.createWriteStream(outputPath);
https.get(fileUrl, function (response) {
    response.pipe(file);
    file.on('finish', function () {
        file.close(() => {
            console.log("Download complete: " + outputPath);
        });
    });
}).on('error', function (err) { // Handle errors
    fs.unlink(outputPath, () => { }); // Delete the file async. (But we don't check the result)
    console.error("Error downloading file: " + err.message);
});
