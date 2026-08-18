-- Create Database if not exists
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'EmployeeDB')
BEGIN
    CREATE DATABASE EmployeeDB;
END
GO

USE EmployeeDB;
GO

-- Create Employees table
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Employees')
BEGIN
    CREATE TABLE Employees (
        id INT IDENTITY(1,1) PRIMARY KEY,
        fullName NVARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        department NVARCHAR(50) NOT NULL,
        position NVARCHAR(50) NOT NULL,
        salary DECIMAL(18,2) NOT NULL,
        status NVARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'On Leave', 'Terminated')),
        createdAt DATETIME DEFAULT GETDATE(),
        updatedAt DATETIME DEFAULT GETDATE()
    );

    -- Insert Sample Data
    INSERT INTO Employees (fullName, email, department, position, salary, status)
    VALUES 
        (N'Nguyễn Văn An', 'nguyen.an@techcorp.vn', N'Công nghệ thông tin', N'Lập trình viên Senior', 35000000.00, 'Active'),
        (N'Trần Thị Bích', 'tran.bich@techcorp.vn', N'Nhân sự', N'Trưởng phòng HR', 28000000.00, 'Active'),
        (N'Lê Hoàng Cường', 'le.cuong@techcorp.vn', N'Kinh doanh', N'Chuyên viên Kế toán', 22000000.00, 'On Leave'),
        (N'Phạm Minh Đức', 'pham.duc@techcorp.vn', N'Công nghệ thông tin', N'Kỹ sư DevOps', 32000000.00, 'Active'),
        (N'Vũ Hải Yến', 'vu.yen@techcorp.vn', N'Marketing', N'Chuyên viên Content', 18000000.00, 'Active');
END
GO
