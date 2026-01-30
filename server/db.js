const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
    host: process.env.DB_SERVER || process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 4000,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: true // TiDB / Cloud MySQL usually requires SSL
    }
};

let poolRaw;
let poolWrapper;

async function connectToDb() {
    if (!poolRaw) {
        try {
            console.log(`Connecting to TiDB at ${config.host}:${config.port}...`);
            poolRaw = mysql.createPool(config);

            // Test connection
            const connection = await poolRaw.getConnection();
            console.log("Connected to TiDB (MySQL) Successfully!");
            connection.release();

            // Create a wrapper to mimic strict MSSQL interface used in index.js
            poolWrapper = {
                request: () => ({
                    query: async (sqlQuery) => {
                        try {
                            // Ensure query ends with semicolon? Not strictly needed but good practice
                            const [rows] = await poolRaw.query(sqlQuery);
                            return { recordset: rows };
                        } catch (err) {
                            console.error("SQL Error:", err.message);
                            throw err;
                        }
                    },
                    input: () => {/* No-op for now as we don't use input parameters in current index.js */ },
                    execute: async (proc) => { /* No-op */ }
                })
            };

        } catch (err) {
            console.error("Database Connection Failed! Config:", { ...config, password: '***' });
            console.error(err);
            poolRaw = null;
            throw err;
        }
    }
    return poolWrapper;
}

module.exports = {
    connectToDb,
    sql: null // Deprecated mssql object
};
