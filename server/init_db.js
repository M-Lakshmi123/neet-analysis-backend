const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const createTableSQL = `
CREATE TABLE IF NOT EXISTS MEDICAL_RESULT (
    id INT AUTO_INCREMENT PRIMARY KEY,
    STUD_ID VARCHAR(50),
    NAME_OF_THE_STUDENT VARCHAR(255),
    CAMPUS_NAME VARCHAR(255),
    Stream VARCHAR(100),
    Test VARCHAR(255),
    Test_Type VARCHAR(100),
    Top_ALL VARCHAR(50),
    DATE VARCHAR(50),
    Tot_720 VARCHAR(50),
    Physics VARCHAR(50),
    Chemistry VARCHAR(50),
    Botany VARCHAR(50),
    Zoology VARCHAR(50),
    AIR VARCHAR(50),
    B_Rank VARCHAR(50),
    Z_Rank VARCHAR(50),
    P_Rank VARCHAR(50),
    C_Rank VARCHAR(50)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`;

async function init() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: parseInt(process.env.DB_PORT) || 4000,
        ssl: { rejectUnauthorized: true }
    };

    console.log("Initializing Database...");
    let conn;

    try {
        // 1. Connect without DB selected to create it
        conn = await mysql.createConnection(config);
        console.log("Connected to TiDB Cluster.");

        // 2. Create Database
        await conn.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`);
        console.log(`✅ Database '${process.env.DB_NAME}' created (or already exists).`);

        // 3. Switch to Database
        await conn.changeUser({ database: process.env.DB_NAME });
        console.log(`Switched to database '${process.env.DB_NAME}'.`);

        // 4. Create Table
        await conn.query(createTableSQL);
        console.log("✅ Table 'MEDICAL_RESULT' created successfully.");

        await conn.end();
        console.log("\nSUCCESS: Database is ready for data upload.");
    } catch (err) {
        console.error("❌ Initialization Failed:", err.message);
        if (conn) await conn.end();
    }
}

init();
