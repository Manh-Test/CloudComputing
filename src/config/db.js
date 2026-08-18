const mssql = require('mssql');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'YourStrong@Pass123',
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 1433,
    database: process.env.DB_NAME || 'EmployeeDB',
    options: {
        encrypt: false, // Set to true if using Azure or strict SSL
        trustServerCertificate: true, // Self-signed certificates allowed
        enableArithAbort: true,
        connectTimeout: 30000,
        requestTimeout: 30000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

let pool = null;

// Helper to wait
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry connection function (essential for Docker containers startup sync)
async function getPool(retries = 10, delayMs = 3000) {
    if (pool) return pool;

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            console.log(`[Database] Connecting to SQL Server at ${dbConfig.server}:${dbConfig.port} (Attempt ${attempt}/${retries})...`);
            
            // First check master DB connection & create DB if missing
            const masterConfig = { ...dbConfig, database: 'master' };
            const masterPool = await mssql.connect(masterConfig);

            await masterPool.request().query(`
                IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${dbConfig.database}')
                BEGIN
                    CREATE DATABASE ${dbConfig.database};
                END
            `);
            await masterPool.close();

            // Connect to target DB
            pool = await mssql.connect(dbConfig);
            console.log(`[Database] Connected successfully to database '${dbConfig.database}'.`);
            
            // Ensure Tables exist
            await initializeTables(pool);

            return pool;
        } catch (err) {
            console.error(`[Database] Connection attempt ${attempt} failed: ${err.message}`);
            if (attempt === retries) {
                throw new Error(`Unable to connect to SQL Server after ${retries} attempts.`);
            }
            await delay(delayMs);
        }
    }
}

async function initializeTables(dbPool) {
    try {
        const tableCheck = await dbPool.request().query(`
            SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Employees'
        `);

        if (tableCheck.recordset.length === 0) {
            console.log(`[Database] Table 'Employees' not found. Creating table and inserting sample seed data...`);
            await dbPool.request().query(`
                CREATE TABLE Employees (
                    id INT IDENTITY(1,1) PRIMARY KEY,
                    fullName NVARCHAR(100) NOT NULL,
                    email VARCHAR(100) NOT NULL UNIQUE,
                    department NVARCHAR(50) NOT NULL,
                    position NVARCHAR(50) NOT NULL,
                    salary DECIMAL(18,2) NOT NULL,
                    status NVARCHAR(20) DEFAULT 'Active',
                    createdAt DATETIME DEFAULT GETDATE(),
                    updatedAt DATETIME DEFAULT GETDATE()
                );

                INSERT INTO Employees (fullName, email, department, position, salary, status)
                VALUES 
                    (N'Nguyễn Văn An', 'nguyen.an@techcorp.vn', N'Công nghệ thông tin', N'Lập trình viên Senior', 35000000.00, 'Active'),
                    (N'Trần Thị Bích', 'tran.bich@techcorp.vn', N'Nhân sự', N'Trưởng phòng HR', 28000000.00, 'Active'),
                    (N'Lê Hoàng Cường', 'le.cuong@techcorp.vn', N'Kinh doanh', N'Chuyên viên Kế toán', 22000000.00, 'On Leave'),
                    (N'Phạm Minh Đức', 'pham.duc@techcorp.vn', N'Công nghệ thông tin', N'Kỹ sư DevOps', 32000000.00, 'Active'),
                    (N'Vũ Hải Yến', 'vu.yen@techcorp.vn', N'Marketing', N'Chuyên viên Content', 18000000.00, 'Active');
            `);
            console.log(`[Database] Table 'Employees' initialized with sample data.`);
        }
    } catch (error) {
        console.error(`[Database] Table initialization error: ${error.message}`);
    }
}

module.exports = {
    getPool,
    mssql
};
