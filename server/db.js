const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const createConfig = (year) => {
    const suffix = year === '2025' ? '' : '_2026';
    return {
        host: process.env[`DB_HOST${suffix}`] || process.env.DB_SERVER || process.env.DB_HOST,
        user: process.env[`DB_USER${suffix}`] || process.env.DB_USER,
        password: process.env[`DB_PASSWORD${suffix}`] || process.env.DB_PASSWORD,
        database: process.env[`DB_NAME${suffix}`] || process.env.DB_NAME,
        port: process.env[`DB_PORT${suffix}`] ? parseInt(process.env[`DB_PORT${suffix}`]) : 4000,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: {
            rejectUnauthorized: true
        }
    };
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
                request: () => ({
                    query: async (sqlQuery) => {
                        try {
                            const [rows] = await poolRaw.query(sqlQuery);
                            return { recordset: rows };
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

