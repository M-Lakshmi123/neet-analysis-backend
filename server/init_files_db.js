const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const clusters = [
    { name: '2025 (Default)', suffix: '' },
    { name: '2026', suffix: '_2026' }
];

async function initialize() {
    console.log('🚀 Starting File Storage DB Initialization...');

    for (const cluster of clusters) {
        console.log(`\n📂 Processing Cluster: ${cluster.name}`);

        const suffix = cluster.suffix;
        const config = {
            host: process.env[`DB_HOST${suffix}`] || process.env.DB_HOST,
            user: process.env[`DB_USER${suffix}`] || process.env.DB_USER,
            password: process.env[`DB_PASSWORD${suffix}`] || process.env.DB_PASSWORD,
            database: process.env[`DB_NAME${suffix}`] || process.env.DB_NAME,
            port: parseInt(process.env[`DB_PORT${suffix}`] || process.env.DB_PORT) || 4000,
            ssl: {
                rejectUnauthorized: true,
                // Add minVersion or other SSL options if needed for TiDB Cloud
            }
        };

        if (!config.host || !config.database) {
            console.error(`❌ Skipping ${cluster.name}: Host or Database name missing in .env`);
            continue;
        }

        let connection;
        try {
            console.log(`📡 Connecting to ${config.host}:${config.port}/${config.database}...`);
            connection = await mysql.createConnection(config);

            console.log(`🛠  Ensuring 'uploaded_files' table exists...`);

            // Create table for metadata
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS uploaded_files (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    filename VARCHAR(255) NOT NULL,
                    original_name VARCHAR(255) NOT NULL,
                    category VARCHAR(100) NOT NULL,
                    file_type VARCHAR(10) NOT NULL,
                    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_category (category),
                    INDEX idx_upload_date (upload_date)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `;
            await connection.query(createTableQuery);

            // Create table for segments (essential for TiDB Serverless 6MB limit)
            const createChunksTableQuery = `
                CREATE TABLE IF NOT EXISTS file_chunks (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    file_id INT NOT NULL,
                    chunk_index INT NOT NULL,
                    chunk_data LONGBLOB NOT NULL,
                    INDEX idx_file (file_id),
                    FOREIGN KEY (file_id) REFERENCES uploaded_files(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `;
            await connection.query(createChunksTableQuery);

            // Double check and remove old BLOB column if it exists to avoid row size limit issues
            try {
                const [columns] = await connection.query(`SHOW COLUMNS FROM uploaded_files LIKE 'file_data'`);
                if (columns.length > 0) {
                    console.log(`🗑  Dropping legacy 'file_data' column from 'uploaded_files' to ensure compatibility...`);
                    await connection.query(`ALTER TABLE uploaded_files DROP COLUMN file_data`);
                }
            } catch (colErr) {
                console.warn(`⚠️  Column migration note: ${colErr.message}`);
            }

            console.log(`✅ Cluster ${cluster.name} initialized successfully.`);

            const [rows] = await connection.query('SELECT COUNT(*) as count FROM uploaded_files');
            console.log(`📊 Current file count in ${cluster.name}: ${rows[0].count}`);

        } catch (error) {
            console.error(`❌ Error initializing ${cluster.name}:`, error.message);
        } finally {
            if (connection) await connection.end();
        }
    }

    console.log('\n🏁 Database initialization sequence complete.');
}

initialize();
