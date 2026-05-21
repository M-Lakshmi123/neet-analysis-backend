const fs = require('fs');
const path = require('path');
const JSZip = require('../client/node_modules/jszip');

async function compare() {
    try {
        const v1Path = path.join(__dirname, 'v1_style_empty.xlsx');
        const v2Path = path.join(__dirname, 'v2_value_null.xlsx');
        
        const data1 = fs.readFileSync(v1Path);
        const data2 = fs.readFileSync(v2Path);
        
        const zip1 = await JSZip.loadAsync(data1);
        const zip2 = await JSZip.loadAsync(data2);
        
        console.log("v1 ZIP files:");
        zip1.forEach((relativePath, file) => {
            if (relativePath.includes('styles.xml') || relativePath.includes('sheet1.xml')) {
                console.log(`- ${relativePath}: size = ${file._data.uncompressedSize}`);
            }
        });
        
        console.log("\nv2 ZIP files:");
        zip2.forEach((relativePath, file) => {
            if (relativePath.includes('styles.xml') || relativePath.includes('sheet1.xml')) {
                console.log(`- ${relativePath}: size = ${file._data.uncompressedSize}`);
            }
        });

        // Let's print out the content of styles.xml if they are not too large
        const styles1 = await zip1.file("xl/styles.xml").async("string");
        const styles2 = await zip2.file("xl/styles.xml").async("string");

        console.log(`\nstyles1.xml length: ${styles1.length}`);
        console.log(`styles2.xml length: ${styles2.length}`);

        // Let's check sheet1.xml cell structure
        const sheet1_1 = await zip1.file("xl/worksheets/sheet1.xml").async("string");
        const sheet1_2 = await zip2.file("xl/worksheets/sheet1.xml").async("string");
        
        console.log(`\nsheet1_1.xml length: ${sheet1_1.length}`);
        console.log(`sheet1_2.xml length: ${sheet1_2.length}`);

        // Let's count how many <c> elements (cells) are in sheet1.xml
        const cellCount1 = (sheet1_1.match(/<c /g) || []).length;
        const cellCount2 = (sheet1_2.match(/<c /g) || []).length;
        console.log(`Cell count in v1: ${cellCount1}`);
        console.log(`Cell count in v2: ${cellCount2}`);
        
    } catch (err) {
        console.error(err);
    }
}

compare();
