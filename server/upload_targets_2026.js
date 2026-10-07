const mysql = require('mysql2/promise');
const xlsx = require('xlsx');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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

        console.log('Connected to TiDB (2026). Checking table schema...');

        // Check columns in TARGETS table
        const [columns] = await connection.execute('DESCRIBE TARGETS');
        const colNames = columns.map(c => c.Field);

        if (!colNames.includes('>= 480M')) {
            console.log('Adding column `>= 480M`...');
            await connection.execute('ALTER TABLE TARGETS ADD COLUMN `>= 480M` INT NULL AFTER `>= 490M`');
        }
        if (!colNames.includes('>= 370M')) {
            console.log('Adding column `>= 370M`...');
            await connection.execute('ALTER TABLE TARGETS ADD COLUMN `>= 370M` INT NULL AFTER `>= 400M`');
        }
        if (!colNames.includes('>= 350M')) {
            console.log('Adding column `>= 350M`...');
            await connection.execute('ALTER TABLE TARGETS ADD COLUMN `>= 350M` INT NULL AFTER `>= 370M`');
        }

        const templatePath = path.resolve(__dirname, '../NEET_2026_Targets_Template.xlsx');
        const workbook = xlsx.readFile(templatePath);
        const sheetName = workbook.SheetNames[0];
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });

        if (data.length === 0) {
            console.log('No data found in the Excel file.');
            await connection.end();
            process.exit(0);
        }

        console.log(`Found ${data.length} rows to upload from sheet "${sheetName}".`);

        // Clear existing 2026 targets first
        await connection.execute("DELETE FROM TARGETS WHERE Year = '2026' OR Year IS NULL");

        // The query with 17 threshold columns in exact order
        const query = `
            INSERT INTO TARGETS 
            (NAME_OF_THE_CAMPUS, Stream, Year, Prog_Str, 
             \`>= 710M\`, \`>= 700M\`, \`>= 685M\`, \`>= 655M\`, \`>= 640M\`, 
             \`>= 595M\`, \`>= 570M\`, \`>= 550M\`, \`>= 530M\`, \`>= 490M\`, 
             \`>= 480M\`, \`>= 450M\`, \`>= 400M\`, \`>= 370M\`, \`>= 350M\`, 
             \`>= 300M\`, \`>= 200M\`)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const parseVal = (v) => {
            if (v === undefined || v === null || v === '') return null;
            const num = Number(v);
            return isNaN(num) ? null : num;
        };

        for (const row of data) {
            const values = [
                row['NAME_OF_THE_CAMPUS'] ? String(row['NAME_OF_THE_CAMPUS']).trim() : null,
                row['Stream'] ? String(row['Stream']).trim() : null,
                row['Year'] ? String(row['Year']).trim() : '2026',
                row['Prog_Str'] !== null && row['Prog_Str'] !== undefined ? String(row['Prog_Str']).trim() : null,
                parseVal(row['>= 710M']),
                parseVal(row['>= 700M']),
                parseVal(row['>= 685M']),
                parseVal(row['>= 655M']),
                parseVal(row['>= 640M']),
                parseVal(row['>= 595M']),
                parseVal(row['>= 570M']),
                parseVal(row['>= 550M']),
                parseVal(row['>= 530M']),
                parseVal(row['>= 490M']),
                parseVal(row['>= 480M']),
                parseVal(row['>= 450M']),
                parseVal(row['>= 400M']),
                parseVal(row['>= 370M']),
                parseVal(row['>= 350M']),
                parseVal(row['>= 300M']),
                parseVal(row['>= 200M'])
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
