const { connectToDb } = require('./db');

async function createTables() {
    let pool;
    try {
        pool = await connectToDb();
        console.log("Connected to TiDB. Re-creating tables with DETAILED schema...");

        // --- DROP EXISTING TABLES ---
        try {
            await pool.request().query('DROP TABLE IF EXISTS ERP_REPORT');
            console.log("Dropped existing ERP_REPORT.");
        } catch (e) { }
        try {
            await pool.request().query('DROP TABLE IF EXISTS MEDICAL_RESULT');
            console.log("Dropped existing MEDICAL_RESULT.");
        } catch (e) { }

        // --- 1. Create ERP_REPORT Table ---
        // Based on CSV Header: 
        // STUD_ID,Student_Name,Branch,Exam_Date,Test_Type,Test,Tot_720,AIR,Botany,B_Rank,Zoology,Z_Rank,Physics,P_Rank,Chemistry,C_Rank,Q_No,W_U,National_Wide_Error,Q_URL,S_URL,Key_Value,Subject,Topic,Sub_Topic,Question_Type,Statement,Year,Top_ALL,Stream
        const createErpSql = `
            CREATE TABLE ERP_REPORT (
                STUD_ID VARCHAR(255),
                Student_Name VARCHAR(255),
                Branch VARCHAR(255),
                Exam_Date VARCHAR(50),
                Test_Type VARCHAR(50),
                Test VARCHAR(100),
                Tot_720 VARCHAR(50),
                AIR VARCHAR(50),
                Botany VARCHAR(50),
                B_Rank VARCHAR(50),
                Zoology VARCHAR(50),
                Z_Rank VARCHAR(50),
                Physics VARCHAR(50),
                P_Rank VARCHAR(50),
                Chemistry VARCHAR(50),
                C_Rank VARCHAR(50),
                Q_No VARCHAR(50),
                W_U VARCHAR(50),
                National_Wide_Error VARCHAR(50),
                Q_URL TEXT,
                S_URL TEXT,
                Key_Value VARCHAR(50),
                Subject VARCHAR(100),
                Topic VARCHAR(255),
                Sub_Topic VARCHAR(255),
                Question_Type VARCHAR(50),
                Statement TEXT,
                Year VARCHAR(50),
                Top_ALL VARCHAR(50),
                Stream VARCHAR(100)
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `;
        await pool.request().query(createErpSql);
        console.log("✅ Table 'ERP_REPORT' created successfully (Matches CSV Columns).");

        // --- 2. Create MEDICAL_RESULT Table ---
        // Based on CSV Header:
        // Test_Type,Test,DATE,STUD_ID,NAME_OF_THE_STUDENT,CAMPUS_NAME,Tot_720,AIR,Botany,B_Rank,Zoology,Z_Rank,Biology,Physics,P_Rank,Chemistry,C_Rank,Stream,Year,Top_ALL,Errors In Botany,Errors In Zoology,Errors In Physics,Errors In Chemistry
        const createMedicalSql = `
            CREATE TABLE MEDICAL_RESULT (
                Test_Type VARCHAR(50),
                Test VARCHAR(255),
                DATE VARCHAR(50),
                STUD_ID VARCHAR(255),
                NAME_OF_THE_STUDENT VARCHAR(255),
                CAMPUS_NAME VARCHAR(255),
                Tot_720 VARCHAR(50),
                AIR VARCHAR(50),
                Botany VARCHAR(50),
                B_Rank VARCHAR(50),
                Zoology VARCHAR(50),
                Z_Rank VARCHAR(50),
                Biology VARCHAR(50),
                Physics VARCHAR(50),
                P_Rank VARCHAR(50),
                Chemistry VARCHAR(50),
                C_Rank VARCHAR(50),
                Stream VARCHAR(100),
                Year VARCHAR(50),
                Top_ALL VARCHAR(50),
                \`Errors In Botany\` TEXT,
                \`Errors In Zoology\` TEXT,
                \`Errors In Physics\` TEXT,
                \`Errors In Chemistry\` TEXT
            ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
        `;
        await pool.request().query(createMedicalSql);
        console.log("✅ Table 'MEDICAL_RESULT' created successfully (Matches CSV Columns incl. Errors).");

        process.exit(0);
    } catch (err) {
        console.error("❌ Error creating tables:", err);
        process.exit(1);
    }
}

createTables();
