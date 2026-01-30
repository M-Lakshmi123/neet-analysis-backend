const { connectToDb } = require('./db');

async function testConnection() {
    console.log("Testing connection...");
    try {
        await connectToDb();
        console.log("SUCCESS: Connected to database 'NEET' as user 'sa'.");
        process.exit(0);
    } catch (err) {
        console.error("FAILURE: Could not connect.", err);
        process.exit(1);
    }
}

testConnection();
