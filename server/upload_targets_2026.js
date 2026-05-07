const mysql = require('mysql2/promise');
const xlsx = require('xlsx');
require('dotenv').config({ path: './.env' });

async function uploadTargets() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST_2026,
            user: process.env.DB_USER_2026,
            password: process.env.DB_PASSWORD_2026,
            database: process.env.DB_NAME_2026,
            port: process.env.DB_PORT_2026,
            ssl: { rejectUnauthorized: false }
        });

        const workbook = xlsx.readFile('../NEET_2026_Targets_Template.xlsx');
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

        if (data.length === 0) {
            console.log('No data found in the Excel file.');
            process.exit(0);
        }

        console.log(`Found ${data.length} rows to upload.`);

        // The query
        const query = `
            INSERT INTO TARGETS 
            (NAME_OF_THE_CAMPUS, Stream, Year, Prog_Str, \`>= 710M\`, \`>= 700M\`, \`>= 685M\`, \`>= 655M\`, \`>= 640M\`, \`>= 595M\`, \`>= 570M\`, \`>= 550M\`, \`>= 530M\`, \`>= 490M\`, \`>= 450M\`, \`>= 400M\`, \`>= 300M\`, \`>= 200M\`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        for (const row of data) {
            const values = [
                row['NAME_OF_THE_CAMPUS'] || null,
                row['Stream'] || null,
                row['Year'] || '2026', // Default to 2026 if not provided
                row['Prog_Str'] || null,
                row['>= 710M'] || 0,
                row['>= 700M'] || 0,
                row['>= 685M'] || 0,
                row['>= 655M'] || 0,
                row['>= 640M'] || 0,
                row['>= 595M'] || 0,
                row['>= 570M'] || 0,
                row['>= 550M'] || 0,
                row['>= 530M'] || 0,
                row['>= 490M'] || 0,
                row['>= 450M'] || 0,
                row['>= 400M'] || 0,
                row['>= 300M'] || 0,
                row['>= 200M'] || 0
            ];

            await connection.execute(query, values);
        }

        console.log('Successfully uploaded targets to TiDB!');
        await connection.end();
    } catch (error) {
        console.error('Error uploading targets:', error);
    }
}

uploadTargets();
