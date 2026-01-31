const { connectToDb } = require('./server/db');
const fs = require('fs');

(async () => {
    try {
        const pool = await connectToDb();
        const res = await pool.request().query("SHOW TABLES");
        const out = JSON.stringify(res.recordset, null, 2);
        fs.writeFileSync('tables_list.txt', out);
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('tables_list.txt', "ERROR: " + e.message);
        process.exit(1);
    }
})();
