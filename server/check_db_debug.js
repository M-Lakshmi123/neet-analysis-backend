const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const dbConfig2026 = {
    host: process.env.DB_HOST_2026,
    user: process.env.DB_USER_2026,
    password: process.env.DB_PASSWORD_2026,
    database: process.env.DB_NAME_2026,
    port: 4000,
    ssl: {
        rejectUnauthorized: true
    }
};

async function checkData() {
    let connection;
    try {
        console.log(`Connecting to TiDB 2026 at ${dbConfig2026.host}...`);
        connection = await mysql.createConnection(dbConfig2026);
        
        console.log("\nChecking ERP_REPORT for WT-02 Q133:");
        const [erpRows] = await connection.execute(`
            SELECT DISTINCT National_Wide_Error, W_U, Q_No, Test
            FROM ERP_REPORT 
            WHERE Test LIKE '%WT-02%' AND Q_No = 133
        `);
        console.table(erpRows);

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        if (connection) await connection.end();
    }
}

checkData();
