const mysql = require('mysql2/promise');

/**
 * Logs a notification update into the latest_updates table in TiDB.
 * @param {object} pool - The TiDB connection pool wrapper.
 * @param {object} updateData - Object containing update metadata.
 * @param {string} updateData.title - The headline/title of the update.
 * @param {string} updateData.description - Detailed description of the update.
 * @param {string} updateData.category - Category (e.g. 'marks', 'errors', 'file_schedules', 'file_averages').
 * @param {string} updateData.targetPage - Frontend page key (e.g. 'analysis', 'errors', 'file_management').
 * @param {object|string|null} [updateData.targetQuery] - Query filter parameters (e.g., { testType: 'WT', test: 'WT-07' }).
 * @param {number|null} [updateData.fileId] - File ID from uploaded_files table if applicable.
 */
async function logUpdateNotification(pool, { title, description, category, targetPage, targetQuery = null, fileId = null }) {
    try {
        const qStr = targetQuery && typeof targetQuery === 'object' ? JSON.stringify(targetQuery) : targetQuery;

        // Deduplicate: remove any existing identical/overlapping notifications
        if (fileId) {
            await pool.rawPool.query(`
                DELETE FROM latest_updates WHERE file_id = ?
            `, [fileId]);
        } else if (qStr) {
            await pool.rawPool.query(`
                DELETE FROM latest_updates WHERE title = ? AND target_page = ? AND target_query = ?
            `, [title, targetPage, qStr]);
        } else {
            await pool.rawPool.query(`
                DELETE FROM latest_updates WHERE title = ? AND description = ?
            `, [title, description]);
        }

        const sql = `
            INSERT INTO latest_updates (title, description, category, target_page, target_query, file_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        
        await pool.rawPool.query(sql, [title, description, category, targetPage, qStr, fileId]);
        console.log(`[UPDATE LOGGER] Success: Recorded update "${title}"`);
    } catch (err) {
        console.error(`[UPDATE LOGGER] Error: Failed to record update "${title}":`, err.message);
    }
}

module.exports = {
    logUpdateNotification
};
