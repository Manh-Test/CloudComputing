# CloudSync Enterprise - Node.js + SQL Server CRUD Web Application (Docker Containerized)

Ứng dụng Web Quản lý Nhân sự & Phòng ban hoàn chỉnh viết bằng **Node.js (Express)** và **Microsoft SQL Server 2022**, đóng gói container bằng **Docker & Docker Compose**.

---

## 🛠️ Công Nghệ Sử Dụng

- **Backend**: Node.js, Express.js, `mssql` (SQL Server Client)
- **Database**: Microsoft SQL Server 2022 (`mcr.microsoft.com/mssql/server:2022-latest`)
- **Frontend**: HTML5, Glassmorphism Vanilla CSS, JavaScript Fetch API
- **Containerization**: Docker, Docker Compose

---

## 🚀 Hướng Dẫn Chạy Bằng Docker Compose (Khuyên Dùng)

### Bước 1: Khởi chạy Container
Mở Terminal tại thư mục `d:\CloudComputing` và chạy lệnh:

```bash
docker-compose up -d --build
```

### Bước 2: Truy cập Ứng dụng
- Giao diện Web Dashboard: `http://localhost:3000`
- API Endpoint: `http://localhost:3000/api/employees`
- Health Check: `http://localhost:3000/health`

### Bước 3: Dừng Container
```bash
docker-compose down
```

---

## 💻 Hướng Dẫn Chạy Môi Trường Local (Không qua Docker)

1. Cài đặt các thư viện:
   ```bash
   npm install
   ```
2. Đảm bảo SQL Server đang chạy tại `localhost:1433` với tài khoản `sa` / `YourStrong@Pass123`.
3. Chạy ứng dụng:
   ```bash
   npm start
   ```

---

## 📡 Danh Sách RESTful API Endpoints

| HTTP Method | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/employees` | Lấy danh sách nhân viên & thống kê (hỗ trợ search, filter) |
| `GET` | `/api/employees/:id` | Lấy thông tin chi tiết nhân viên theo ID |
| `POST` | `/api/employees` | Thêm nhân viên mới |
| `PUT` | `/api/employees/:id` | Cập nhật thông tin nhân viên |
| `DELETE` | `/api/employees/:id` | Xóa nhân viên theo ID |
| `GET` | `/health` | Kiểm tra trạng thái ứng dụng & kết nối database |
