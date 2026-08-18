const { getPool, mssql } = require('../config/db');

// Get all employees with optional search, filter & stats
exports.getAllEmployees = async (req, res) => {
    try {
        const pool = await getPool();
        const { search, department, status } = req.query;

        let query = `SELECT * FROM Employees WHERE 1=1`;
        const request = pool.request();

        if (search) {
            query += ` AND (fullName LIKE @search OR email LIKE @search OR position LIKE @search)`;
            request.input('search', mssql.NVarChar, `%${search}%`);
        }

        if (department && department !== 'All') {
            query += ` AND department = @department`;
            request.input('department', mssql.NVarChar, department);
        }

        if (status && status !== 'All') {
            query += ` AND status = @status`;
            request.input('status', mssql.NVarChar, status);
        }

        query += ` ORDER BY id DESC`;

        const result = await request.query(query);

        // Compute dashboard stats
        const statsQuery = await pool.request().query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END) as onLeave,
                ISNULL(AVG(salary), 0) as avgSalary
            FROM Employees
        `);

        res.json({
            success: true,
            count: result.recordset.length,
            stats: statsQuery.recordset[0],
            data: result.recordset
        });
    } catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách nhân viên.', error: error.message });
    }
};

// Get single employee by ID
exports.getEmployeeById = async (req, res) => {
    try {
        const pool = await getPool();
        const { id } = req.params;

        const result = await pool.request()
            .input('id', mssql.Int, id)
            .query('SELECT * FROM Employees WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên với ID đã cho.' });
        }

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        console.error('Error fetching employee by ID:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi tìm nhân viên.', error: error.message });
    }
};

// Create new employee
exports.createEmployee = async (req, res) => {
    try {
        const { fullName, email, department, position, salary, status } = req.body;

        // Simple validation
        if (!fullName || !email || !department || !position || salary === undefined) {
            return res.status(400).json({ success: false, message: 'Vui lòng điền đầy đủ các thông tin bắt buộc.' });
        }

        const pool = await getPool();

        // Check unique email
        const checkEmail = await pool.request()
            .input('email', mssql.VarChar, email)
            .query('SELECT id FROM Employees WHERE email = @email');

        if (checkEmail.recordset.length > 0) {
            return res.status(400).json({ success: false, message: 'Email này đã tồn tại trong hệ thống.' });
        }

        const result = await pool.request()
            .input('fullName', mssql.NVarChar, fullName)
            .input('email', mssql.VarChar, email)
            .input('department', mssql.NVarChar, department)
            .input('position', mssql.NVarChar, position)
            .input('salary', mssql.Decimal(18, 2), salary)
            .input('status', mssql.NVarChar, status || 'Active')
            .query(`
                INSERT INTO Employees (fullName, email, department, position, salary, status)
                OUTPUT INSERTED.*
                VALUES (@fullName, @email, @department, @position, @salary, @status)
            `);

        res.status(201).json({
            success: true,
            message: 'Thêm mới nhân viên thành công!',
            data: result.recordset[0]
        });
    } catch (error) {
        console.error('Error creating employee:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi thêm nhân viên.', error: error.message });
    }
};

// Update existing employee
exports.updateEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, email, department, position, salary, status } = req.body;

        const pool = await getPool();

        // Check if exists
        const checkExist = await pool.request()
            .input('id', mssql.Int, id)
            .query('SELECT id FROM Employees WHERE id = @id');

        if (checkExist.recordset.length === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên để cập nhật.' });
        }

        // Check duplicate email (if changing email)
        if (email) {
            const checkEmail = await pool.request()
                .input('email', mssql.VarChar, email)
                .input('id', mssql.Int, id)
                .query('SELECT id FROM Employees WHERE email = @email AND id != @id');

            if (checkEmail.recordset.length > 0) {
                return res.status(400).json({ success: false, message: 'Email đã được sử dụng bởi nhân viên khác.' });
            }
        }

        const result = await pool.request()
            .input('id', mssql.Int, id)
            .input('fullName', mssql.NVarChar, fullName)
            .input('email', mssql.VarChar, email)
            .input('department', mssql.NVarChar, department)
            .input('position', mssql.NVarChar, position)
            .input('salary', mssql.Decimal(18, 2), salary)
            .input('status', mssql.NVarChar, status)
            .query(`
                UPDATE Employees 
                SET fullName = ISNULL(@fullName, fullName),
                    email = ISNULL(@email, email),
                    department = ISNULL(@department, department),
                    position = ISNULL(@position, position),
                    salary = ISNULL(@salary, salary),
                    status = ISNULL(@status, status),
                    updatedAt = GETDATE()
                OUTPUT INSERTED.*
                WHERE id = @id
            `);

        res.json({
            success: true,
            message: 'Cập nhật thông tin nhân viên thành công!',
            data: result.recordset[0]
        });
    } catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật thông tin.', error: error.message });
    }
};

// Delete employee
exports.deleteEmployee = async (req, res) => {
    try {
        const { id } = req.params;
        const pool = await getPool();

        const result = await pool.request()
            .input('id', mssql.Int, id)
            .query('DELETE FROM Employees WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy nhân viên để xóa.' });
        }

        res.json({
            success: true,
            message: 'Đã xóa nhân viên thành công!'
        });
    } catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi xóa nhân viên.', error: error.message });
    }
};

// Get department statistics aggregation
exports.getDepartmentStats = async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT 
                department,
                COUNT(*) as totalEmployees,
                SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) as activeEmployees,
                SUM(CASE WHEN status = 'On Leave' THEN 1 ELSE 0 END) as onLeaveEmployees,
                ISNULL(SUM(salary), 0) as totalSalary,
                ISNULL(AVG(salary), 0) as avgSalary
            FROM Employees
            GROUP BY department
            ORDER BY totalEmployees DESC
        `);

        res.json({
            success: true,
            data: result.recordset
        });
    } catch (error) {
        console.error('Error fetching department stats:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi lấy thống kê phòng ban.', error: error.message });
    }
};

