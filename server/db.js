const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const createConfig = (year) => {
    // Current cluster is 2025, New cluster is 2026
    const is2026 = year === '2026';
    const suffix = is2026 ? '_2026' : '';

    // Explicitly select based on year. NEVER fall back to 2025 cluster if 2026 is requested.
    const config = {
        host: process.env[`DB_HOST${suffix}`],
        user: process.env[`DB_USER${suffix}`],
        password: process.env[`DB_PASSWORD${suffix}`],
        database: process.env[`DB_NAME${suffix}`],
        port: process.env[`DB_PORT${suffix}`] ? parseInt(process.env[`DB_PORT${suffix}`]) : 4000,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        maxAllowedPacket: 104857600, // 100MB to prevent MALFORM PACKET error with large BLOBs
        ssl: {
            rejectUnauthorized: true
        }
    };

    // If variables for the specific year are missing, we should know about it.
    if (!config.host || !config.user || !config.password) {
        console.warn(`[DB][WARNING] Missing environment variables for academic year ${year}! Falling back to raw defaults if possible...`);
        // We only fall back to one generic set if the specific ones are absent, 
        // but prefer being explicit.
        config.host = config.host || process.env.DB_HOST;
        config.user = config.user || process.env.DB_USER;
        config.password = config.password || process.env.DB_PASSWORD;
        config.database = config.database || process.env.DB_NAME;
    }

    // Log for debugging (especially useful in Render logs)
    const logInfo = `[${new Date().toISOString()}] DB Config Selection - Year: ${year}, Host: ${config.host}, User: ${config.user}, DB: ${config.database}`;
    console.log(logInfo);

    // Also append to a local file for history
    try {
        fs.appendFileSync(path.join(__dirname, 'db_debug.log'), logInfo + '\n');
    } catch (e) { }

    return config;
};

const pools = {};

async function connectToDb(year = '2026') {
    // Force default to 2026 as per requirement
    const targetYear = (year === '2025' || year === '2026') ? year : '2026';

    if (!pools[targetYear]) {
        try {
            const config = createConfig(targetYear);
            console.log(`Connecting to TiDB (${targetYear}) at ${config.host}:${config.port}...`);
            const poolRaw = mysql.createPool(config);

            // Test connection
            const connection = await poolRaw.getConnection();
            console.log(`Connected to TiDB (${targetYear}) Successfully!`);
            connection.release();

            // Create a wrapper to mimic strict MSSQL interface
            pools[targetYear] = {
                rawPool: poolRaw,
                request: () => ({
                    query: async (sqlQuery) => {
                        try {
                            const [res, fields] = await poolRaw.query(sqlQuery);
                            // If it's a SELECT, res is an array of rows. 
                            // If it's DML (INSERT/UPDATE), res is a ResultSetHeader.
                            const recordset = Array.isArray(res) ? res : [];
                            const rowsAffected = !Array.isArray(res) ? [res.affectedRows] : [res.length];
                            return { recordset, rowsAffected };
                        } catch (err) {
                            console.error(`SQL Error (${targetYear}):`, err.message);
                            throw err;
                        }
                    },
                    input: () => { },
                    execute: async (proc) => { }
                })
            };

        } catch (err) {
            console.error(`Database Connection Failed for ${targetYear}!`);
            console.error(err);
            throw err;
        }
    }
    return pools[targetYear];
}

module.exports = {
    connectToDb,
    sql: null
};

