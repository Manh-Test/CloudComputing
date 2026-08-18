document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Navigation & Views
    const navItems = document.querySelectorAll('.nav-item[data-view]');
    const viewSections = document.querySelectorAll('.view-section');

    // DOM Elements - Employees Table & Stats
    const employeeTableBody = document.getElementById('employee-table-body');
    const tableLoading = document.getElementById('table-loading');
    const tableEmpty = document.getElementById('table-empty');
    
    // Stats Elements
    const statTotal = document.getElementById('stat-total');
    const statActive = document.getElementById('stat-active');
    const statOnLeave = document.getElementById('stat-onleave');
    const statAvgSalary = document.getElementById('stat-avg-salary');

    // Controls
    const searchInput = document.getElementById('search-input');
    const filterDepartment = document.getElementById('filter-department');
    const filterStatus = document.getElementById('filter-status');
    const btnRefresh = document.getElementById('btn-refresh');
    const btnAddEmployee = document.getElementById('btn-add-employee');

    // Modal Elements
    const employeeModal = document.getElementById('employee-modal');
    const modalTitle = document.getElementById('modal-title');
    const employeeForm = document.getElementById('employee-form');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelModal = document.getElementById('btn-cancel-modal');
    const employeeIdInput = document.getElementById('employee-id');

    // Department View Elements
    const btnRefreshDepartments = document.getElementById('btn-refresh-departments');
    const departmentsContainer = document.getElementById('departments-container');
    const statDeptCount = document.getElementById('stat-dept-count');
    const statDeptTotalBudget = document.getElementById('stat-dept-total-budget');
    const statDeptAvgSalary = document.getElementById('stat-dept-avg-salary');

    // Docker View Elements
    const btnCheckDockerHealth = document.getElementById('btn-check-docker-health');
    const healthOutputLog = document.getElementById('health-output-log');

    // API Docs View Elements
    const apiTestEndpoint = document.getElementById('api-test-endpoint');
    const btnExecuteApi = document.getElementById('btn-execute-api');
    const apiStatusCode = document.getElementById('api-status-code');
    const apiResponseTime = document.getElementById('api-response-time');
    const apiResponseJson = document.getElementById('api-response-json');

    let debounceTimer = null;

    // Initial Load
    fetchEmployees();
    checkSystemStatusBadge();

    // Tab Navigation Switcher
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = item.dataset.view;
            switchView(targetView);
        });
    });

    function switchView(viewName) {
        navItems.forEach(nav => nav.classList.remove('active'));
        const activeNav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
        if (activeNav) activeNav.classList.add('active');

        viewSections.forEach(section => {
            if (section.id === `view-${viewName}`) {
                section.classList.remove('hidden');
                section.classList.add('active');
            } else {
                section.classList.add('hidden');
                section.classList.remove('active');
            }
        });

        // Lazy load data on tab switch
        if (viewName === 'departments') {
            fetchDepartmentStats();
        } else if (viewName === 'docker') {
            runHealthCheck();
        }
    }

    // Event Listeners - Employees View
    btnAddEmployee.addEventListener('click', () => openModal('add'));
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelModal.addEventListener('click', closeModal);
    employeeForm.addEventListener('submit', handleFormSubmit);

    btnRefresh.addEventListener('click', () => {
        searchInput.value = '';
        filterDepartment.value = 'All';
        filterStatus.value = 'All';
        fetchEmployees();
    });

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fetchEmployees, 300);
    });

    filterDepartment.addEventListener('change', fetchEmployees);
    filterStatus.addEventListener('change', fetchEmployees);

    // Event Listeners - Departments View
    if (btnRefreshDepartments) {
        btnRefreshDepartments.addEventListener('click', fetchDepartmentStats);
    }

    // Event Listeners - Docker & Health View
    if (btnCheckDockerHealth) {
        btnCheckDockerHealth.addEventListener('click', runHealthCheck);
    }

    // Event Listeners - API Console View
    if (btnExecuteApi) {
        btnExecuteApi.addEventListener('click', executeApiTest);
    }

    // Check system status badge on sidebar
    async function checkSystemStatusBadge() {
        const badge = document.getElementById('db-status-badge');
        try {
            const res = await fetch('/health');
            const data = await res.json();
            if (data.status === 'UP') {
                badge.textContent = 'SQL Server Connected';
                badge.style.color = 'var(--success-color)';
            } else {
                badge.textContent = 'DB Disconnected';
                badge.style.color = 'var(--danger-color)';
            }
        } catch {
            badge.textContent = 'Backend Offline';
            badge.style.color = 'var(--warning-color)';
        }
    }

    // Fetch Employees & Update Dashboard
    async function fetchEmployees() {
        showLoading(true);
        try {
            const queryParams = new URLSearchParams();
            if (searchInput.value.trim()) queryParams.append('search', searchInput.value.trim());
            if (filterDepartment.value !== 'All') queryParams.append('department', filterDepartment.value);
            if (filterStatus.value !== 'All') queryParams.append('status', filterStatus.value);

            const response = await fetch(`/api/employees?${queryParams.toString()}`);
            const result = await response.json();

            if (result.success) {
                renderTable(result.data);
                renderStats(result.stats);
            } else {
                showToast(result.message || 'Lỗi lấy dữ liệu', 'error');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showToast('Không thể kết nối đến server backend!', 'error');
        } finally {
            showLoading(false);
        }
    }

    // Render Table Rows
    function renderTable(employees) {
        employeeTableBody.innerHTML = '';

        if (!employees || employees.length === 0) {
            tableEmpty.classList.remove('hidden');
            return;
        }

        tableEmpty.classList.add('hidden');

        employees.forEach(emp => {
            const tr = document.createElement('tr');
            
            const salaryFormatted = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(emp.salary);
            const badgeClass = getBadgeClass(emp.status);
            const statusLabel = getStatusLabel(emp.status);

            tr.innerHTML = `
                <td>#${emp.id}</td>
                <td><strong>${escapeHtml(emp.fullName)}</strong></td>
                <td>${escapeHtml(emp.email)}</td>
                <td>${escapeHtml(emp.department)}</td>
                <td>${escapeHtml(emp.position)}</td>
                <td>${salaryFormatted}</td>
                <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
                <td class="text-right">
                    <button class="btn-action edit" data-id="${emp.id}" title="Chỉnh sửa"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="btn-action delete" data-id="${emp.id}" title="Xóa"><i class="fa-solid fa-trash-can"></i></button>
                </td>
            `;

            employeeTableBody.appendChild(tr);
        });

        // Add action button handlers
        document.querySelectorAll('.btn-action.edit').forEach(btn => {
            btn.addEventListener('click', () => editEmployee(btn.dataset.id));
        });

        document.querySelectorAll('.btn-action.delete').forEach(btn => {
            btn.addEventListener('click', () => deleteEmployee(btn.dataset.id));
        });
    }

    // Render Stats Cards
    function renderStats(stats) {
        if (!stats) return;
        statTotal.textContent = stats.total || 0;
        statActive.textContent = stats.active || 0;
        statOnLeave.textContent = stats.onLeave || 0;
        statAvgSalary.textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.avgSalary || 0);
    }

    // Fetch & Render Department Aggregations
    async function fetchDepartmentStats() {
        if (!departmentsContainer) return;
        departmentsContainer.innerHTML = '<div class="table-state"><div class="spinner"></div><p>Đang tải dữ liệu phòng ban...</p></div>';

        try {
            const res = await fetch('/api/employees/departments/stats');
            const result = await res.json();

            if (result.success && result.data) {
                renderDepartments(result.data);
            } else {
                departmentsContainer.innerHTML = '<p class="text-muted">Không thể tải thông tin phòng ban.</p>';
            }
        } catch (err) {
            console.error('Department fetch error:', err);
            departmentsContainer.innerHTML = '<p class="text-muted">Đã xảy ra lỗi khi tải thống kê phòng ban.</p>';
        }
    }

    function renderDepartments(deptList) {
        departmentsContainer.innerHTML = '';
        
        let grandTotalBudget = 0;
        let totalCountAll = 0;

        deptList.forEach(d => {
            grandTotalBudget += d.totalSalary;
            totalCountAll += d.totalEmployees;

            const card = document.createElement('div');
            card.className = 'dept-card';

            const formattedTotal = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(d.totalSalary);
            const formattedAvg = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(d.avgSalary);

            const iconMap = {
                'Công nghệ thông tin': 'fa-laptop-code',
                'Nhân sự': 'fa-id-card',
                'Kinh doanh': 'fa-chart-line',
                'Marketing': 'fa-bullhorn',
                'Tài chính': 'fa-coins'
            };

            const iconClass = iconMap[d.department] || 'fa-building';

            card.innerHTML = `
                <div class="dept-card-header">
                    <div class="dept-icon"><i class="fa-solid ${iconClass}"></i></div>
                    <div class="dept-title">
                        <h3>${escapeHtml(d.department)}</h3>
                        <span>${d.totalEmployees} nhân sự</span>
                    </div>
                </div>
                <div class="dept-stats-row">
                    <div class="dept-stat-item">
                        <span>Đang làm việc:</span>
                        <strong>${d.activeEmployees}</strong>
                    </div>
                    <div class="dept-stat-item">
                        <span>Nghỉ phép:</span>
                        <strong>${d.onLeaveEmployees}</strong>
                    </div>
                </div>
                <div class="dept-stats-row">
                    <div class="dept-stat-item">
                        <span>Tổng quỹ lương:</span>
                        <strong>${formattedTotal}</strong>
                    </div>
                    <div class="dept-stat-item">
                        <span>Lương trung bình:</span>
                        <strong>${formattedAvg}</strong>
                    </div>
                </div>
                <button class="btn btn-secondary btn-view-dept-employees" data-dept="${escapeHtml(d.department)}" style="width:100%; justify-content:center;">
                    <i class="fa-solid fa-list-check"></i> Xem Nhân Viên Phòng Này
                </button>
            `;

            departmentsContainer.appendChild(card);
        });

        // Update overall Summary Header Cards
        if (statDeptCount) statDeptCount.textContent = deptList.length;
        if (statDeptTotalBudget) statDeptTotalBudget.textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(grandTotalBudget);
        if (statDeptAvgSalary) statDeptAvgSalary.textContent = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalCountAll ? grandTotalBudget / totalCountAll : 0);

        // Bind click handler on "Xem Nhân Viên Phòng Này"
        document.querySelectorAll('.btn-view-dept-employees').forEach(btn => {
            btn.addEventListener('click', () => {
                const deptName = btn.dataset.dept;
                filterDepartment.value = deptName;
                switchView('employees');
                fetchEmployees();
            });
        });
    }

    // Health Diagnostic Tool
    async function runHealthCheck() {
        if (!healthOutputLog) return;
        healthOutputLog.textContent = 'Đang kết nối tới /health...';

        try {
            const start = performance.now();
            const res = await fetch('/health');
            const data = await res.json();
            const duration = Math.round(performance.now() - start);

            healthOutputLog.textContent = `HTTP ${res.status} OK (${duration}ms)\n` + JSON.stringify(data, null, 2);
        } catch (err) {
            healthOutputLog.textContent = `Error connecting to health endpoint: ${err.message}`;
        }
    }

    // Interactive API Tester
    async function executeApiTest() {
        if (!apiTestEndpoint || !apiResponseJson) return;

        const val = apiTestEndpoint.value;
        const [method, url] = val.split(' ');

        apiStatusCode.textContent = 'PENDING...';
        apiResponseTime.textContent = '-';
        apiResponseJson.textContent = 'Sending request...';

        const startTime = performance.now();
        try {
            const res = await fetch(url, { method: method });
            const duration = Math.round(performance.now() - startTime);
            const data = await res.json();

            apiStatusCode.textContent = `${res.status} ${res.statusText || 'OK'}`;
            apiStatusCode.style.color = res.ok ? 'var(--success-color)' : 'var(--danger-color)';
            apiResponseTime.textContent = `${duration} ms`;

            apiResponseJson.textContent = JSON.stringify(data, null, 2);
        } catch (err) {
            apiStatusCode.textContent = 'FAILED';
            apiStatusCode.style.color = 'var(--danger-color)';
            apiResponseJson.textContent = `Network / Execution Error: ${err.message}`;
        }
    }

    // Handle Form Submission (Create / Edit)
    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const id = employeeIdInput.value;
        const payload = {
            fullName: document.getElementById('fullName').value.trim(),
            email: document.getElementById('email').value.trim(),
            department: document.getElementById('department').value,
            position: document.getElementById('position').value.trim(),
            salary: parseFloat(document.getElementById('salary').value),
            status: document.getElementById('status').value
        };

        try {
            const url = id ? `/api/employees/${id}` : '/api/employees';
            const reqMethod = id ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: reqMethod,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                showToast(result.message, 'success');
                closeModal();
                fetchEmployees();
            } else {
                showToast(result.message || 'Thao tác không thành công!', 'error');
            }
        } catch (error) {
            console.error('Submit error:', error);
            showToast('Đã xảy ra lỗi kết nối!', 'error');
        }
    }

    // Fetch single employee for edit modal
    async function editEmployee(id) {
        try {
            const response = await fetch(`/api/employees/${id}`);
            const result = await response.json();

            if (result.success && result.data) {
                const emp = result.data;
                employeeIdInput.value = emp.id;
                document.getElementById('fullName').value = emp.fullName;
                document.getElementById('email').value = emp.email;
                document.getElementById('department').value = emp.department;
                document.getElementById('position').value = emp.position;
                document.getElementById('salary').value = emp.salary;
                document.getElementById('status').value = emp.status;

                openModal('edit');
            } else {
                showToast(result.message || 'Không tìm thấy dữ liệu nhân viên.', 'error');
            }
        } catch (error) {
            showToast('Lỗi khi lấy chi tiết nhân viên.', 'error');
        }
    }

    // Delete employee
    async function deleteEmployee(id) {
        if (!confirm(`Bạn có chắc chắn muốn xóa nhân viên #${id}?`)) return;

        try {
            const response = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
            const result = await response.json();

            if (result.success) {
                showToast(result.message, 'success');
                fetchEmployees();
            } else {
                showToast(result.message || 'Không thể xóa nhân viên này.', 'error');
            }
        } catch (error) {
            showToast('Lỗi server khi xóa nhân viên.', 'error');
        }
    }

    // Helper functions
    function openModal(type = 'add') {
        if (type === 'add') {
            modalTitle.innerHTML = '<i class="fa-solid fa-user-plus"></i> Thêm Nhân Viên Mới';
            employeeForm.reset();
            employeeIdInput.value = '';
        } else {
            modalTitle.innerHTML = '<i class="fa-solid fa-user-pen"></i> Chỉnh Sửa Thông Tin Nhân Viên';
        }
        employeeModal.classList.remove('hidden');
    }

    function closeModal() {
        employeeModal.classList.add('hidden');
    }

    function showLoading(isLoading) {
        if (isLoading) {
            tableLoading.classList.remove('hidden');
            tableEmpty.classList.add('hidden');
        } else {
            tableLoading.classList.add('hidden');
        }
    }

    function getBadgeClass(status) {
        switch (status) {
            case 'Active': return 'badge-active';
            case 'On Leave': return 'badge-onleave';
            case 'Terminated': return 'badge-terminated';
            default: return 'badge-active';
        }
    }

    function getStatusLabel(status) {
        switch (status) {
            case 'Active': return 'Đang làm việc';
            case 'On Leave': return 'Nghỉ phép';
            case 'Terminated': return 'Đã nghỉ việc';
            default: return status;
        }
    }

    function showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const iconClass = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
        toast.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${escapeHtml(message)}</span>`;
        
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3500);
    }

    function escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
