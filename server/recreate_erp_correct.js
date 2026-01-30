const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function recreateErpTable() {
    try {
        const config = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT) || 4000,
            ssl: { rejectUnauthorized: true }
        };

        console.log("Connecting to Database...");
        const conn = await mysql.createConnection(config);

        console.log("Dropping old 'ERP_REPORT' table...");
        await conn.query("DROP TABLE IF EXISTS ERP_REPORT");

        // Note: Using VARCHAR(255) to be safe and broadly compatible with TiDB/MySQL
        // TiDB supports NVARCHAR/TEXT but simple VARCHAR is safest if we don't know length.
        // User provided [nvarchar](max) from SQL Server, usually maps to TEXT or LONGTEXT in MySQL.
        // But for things like Names/URLs, VARCHAR(500) or TEXT is good.
        // Let's use TEXT for 'max' ones to be safe.

        const createSql = `
            CREATE TABLE ERP_REPORT (
                STUD_ID VARCHAR(50) NULL,
                Student_Name TEXT NULL,
                Branch TEXT NULL,
                Exam_Date VARCHAR(50) NULL, -- Storing as string per user preference (DD-MM-YYYY)
                Test_Type TEXT NULL,
                Test TEXT NULL,
                Tot_720 VARCHAR(50) NULL,
                AIR VARCHAR(50) NULL,
                Botany VARCHAR(50) NULL,
                B_Rank VARCHAR(50) NULL,
                Zoology VARCHAR(50) NULL,
                Z_Rank VARCHAR(50) NULL,
                Physics VARCHAR(50) NULL,
                P_Rank VARCHAR(50) NULL,
                Chemistry VARCHAR(50) NULL,
                C_Rank VARCHAR(50) NULL,
                Q_No VARCHAR(50) NULL,
                W_U VARCHAR(50) NULL,
                National_Wide_Error TEXT NULL,
                Q_URL TEXT NULL,
                S_URL TEXT NULL,
                Key_Value TEXT NULL,
                Subject TEXT NULL,
                Topic TEXT NULL,
                Sub_Topic TEXT NULL,
                Question_Type TEXT NULL,
                Statement TEXT NULL,
                Year VARCHAR(50) NULL,
                Top_ALL TEXT NULL,
                Stream TEXT NULL
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `;

        console.log("Creating 'ERP_REPORT' with CORRECT columns...");
        await conn.query(createSql);

        console.log("✅ 'ERP_REPORT' created successfully!");

        await conn.end();

    } catch (err) {
        console.error("❌ Error:", err.message);
    }
}

recreateErpTable();
