# 🚀 HƯỚNG DẪN TRIỂN KHAI AWS — TỪNG BƯỚC

> **Project**: Node.js + MSSQL CRUD App  
> **Stack**: Docker + ALB + Auto Scaling + CloudWatch + GitHub Actions CI/CD

---

## 📋 MỤC LỤC

1. [Chuẩn bị trước khi bắt đầu](#1-chuẩn-bị)
2. [Push code lên GitHub](#2-push-code-lên-github)
3. [Tạo ECR Repository](#3-tạo-ecr-repository)
4. [Tạo VPC & Security Groups](#4-tạo-vpc--security-groups)
5. [Tạo IAM Role cho EC2](#5-tạo-iam-role-cho-ec2)
6. [Tạo Launch Template](#6-tạo-launch-template)
7. [Tạo Application Load Balancer](#7-tạo-application-load-balancer)
8. [Tạo Auto Scaling Group](#8-tạo-auto-scaling-group)
9. [Cấu hình CloudWatch Monitoring](#9-cấu-hình-cloudwatch-monitoring)
10. [Cấu hình CI/CD (GitHub Actions)](#10-cấu-hình-cicd)
11. [Kiểm tra & Verify](#11-kiểm-tra--verify)

---

## 1. CHUẨN BỊ

### Yêu cầu
- ✅ AWS Account với quyền Admin
- ✅ AWS CLI đã cài đặt trên máy local
- ✅ GitHub Account
- ✅ Git đã cài đặt

### Cấu hình AWS CLI
```bash
aws configure
# Nhập: Access Key ID, Secret Access Key, Region: ap-southeast-1, Format: json
```

---

## 2. PUSH CODE LÊN GITHUB

```bash
# Trong thư mục d:\CloudComputing (PowerShell/CMD)
cd d:\CloudComputing

git init
git add .
git commit -m "Initial commit: Node.js CRUD + Docker"

# Tạo repo trên github.com trước, sau đó:
git remote add origin https://github.com/YOUR_USERNAME/CloudComputing.git
git push -u origin main
```

> ⚠️ **Nhớ thay `YOUR_USERNAME`** trong `user_data.sh` bằng username GitHub thực của bạn!

---

## 3. TẠO ECR REPOSITORY

> **Amazon ECR** = Docker Hub riêng của bạn trên AWS, lưu Docker images.

```bash
aws ecr create-repository \
    --repository-name cloudcomputing-app \
    --region ap-southeast-1

# Ghi lại URI: 123456789.dkr.ecr.ap-southeast-1.amazonaws.com/cloudcomputing-app
```

Hoặc qua Console:
1. Vào **Amazon ECR** → **Create repository**
2. Name: `cloudcomputing-app`
3. Click **Create**

---

## 4. TẠO VPC & SECURITY GROUPS

### 4.1 Tạo VPC (hoặc dùng Default VPC)
- AWS Console → **VPC** → **Create VPC**
- Name: `cloudcomputing-vpc`
- IPv4 CIDR: `10.0.0.0/16`
- Chọn **2 Availability Zones**, **2 public subnets**

### 4.2 Tạo Security Groups

#### SG cho ALB (Application Load Balancer)
| Rule | Type | Port | Source |
|------|------|------|--------|
| Inbound | HTTP | 80 | 0.0.0.0/0 |
| Inbound | HTTPS | 443 | 0.0.0.0/0 |
| Outbound | All | All | 0.0.0.0/0 |

Name: `sg-cloudcomputing-alb`

#### SG cho EC2 Instances
| Rule | Type | Port | Source |
|------|------|------|--------|
| Inbound | Custom TCP | 3000 | sg-cloudcomputing-alb |
| Inbound | SSH | 22 | Your IP |
| Outbound | All | All | 0.0.0.0/0 |

Name: `sg-cloudcomputing-ec2`

---

## 5. TẠO IAM ROLE CHO EC2

> EC2 cần quyền để pull từ ECR và gửi metrics lên CloudWatch.

1. **IAM** → **Roles** → **Create role**
2. **Trusted entity**: EC2
3. Đính kèm các policies:
   - `AmazonEC2ContainerRegistryReadOnly` — đọc ECR
   - `CloudWatchAgentServerPolicy` — gửi metrics/logs
   - `AmazonSSMManagedInstanceCore` — SSH không cần key pair (optional)
4. Name: `EC2-CloudComputing-Role`

---

## 6. TẠO LAUNCH TEMPLATE

> Launch Template = "bản thiết kế" EC2 instance, ASG sẽ dùng cái này để tạo instance mới.

1. **EC2** → **Launch Templates** → **Create launch template**
2. **Cấu hình**:
   - Name: `lt-cloudcomputing`
   - AMI: `Ubuntu Server 24.04 LTS` (tìm trong catalog)
   - Instance type: `t3.micro` (hoặc `t3.small` cho MSSQL)
   - Key pair: Tạo mới hoặc chọn có sẵn
   - Security group: `sg-cloudcomputing-ec2`
   - IAM Role: `EC2-CloudComputing-Role`
3. **Advanced Details** → **User data**: Copy toàn bộ nội dung file [`user_data.sh`](./user_data.sh)

> ⚠️ **Quan trọng**: Nhớ cập nhật `GIT_REPO_URL` trong `user_data.sh` trước!

---

## 7. TẠO APPLICATION LOAD BALANCER

1. **EC2** → **Load Balancers** → **Create load balancer**
2. Chọn **Application Load Balancer**
3. **Cấu hình**:
   - Name: `alb-cloudcomputing`
   - Scheme: `Internet-facing`
   - VPC: chọn VPC vừa tạo
   - Subnets: Chọn **ít nhất 2 public subnets** (khác AZ)
   - Security group: `sg-cloudcomputing-alb`
4. **Listeners & routing**:
   - Port 80 → Tạo Target Group mới
5. **Tạo Target Group**:
   - Name: `tg-cloudcomputing`
   - Target type: `Instances`
   - Protocol: HTTP, Port: `3000`
   - Health check path: `/` (hoặc `/api/employees`)
   - Healthy threshold: `2`
   - Interval: `30s`
6. Click **Create load balancer**

> 📌 Ghi lại **DNS name** của ALB (ví dụ: `alb-cloudcomputing-xxx.ap-southeast-1.elb.amazonaws.com`)

---

## 8. TẠO AUTO SCALING GROUP

1. **EC2** → **Auto Scaling Groups** → **Create Auto Scaling group**
2. **Cấu hình**:
   - Name: `asg-cloudcomputing`
   - Launch template: `lt-cloudcomputing`
3. **Network**:
   - VPC: chọn VPC
   - Subnets: chọn ≥ 2 subnets (khác AZ)
4. **Load balancing**:
   - Attach to existing ALB Target Group: `tg-cloudcomputing`
   - Health check type: `ELB`
5. **Group size**:
   - Desired: `2`
   - Minimum: `2`
   - Maximum: `4`
6. **Scaling policies** (Target Tracking):
   - Metric: `Average CPU Utilization`
   - Target value: `70%`
   - Scale-in cooldown: `300s`
7. Click **Create Auto Scaling group**

✅ AWS sẽ tự động tạo **2 EC2 instances**, cài Docker, clone code, và chạy app!

---

## 9. CẤU HÌNH CLOUDWATCH MONITORING

### 9.1 Tạo CloudWatch Log Group
```bash
aws logs create-log-group \
    --log-group-name /cloudcomputing/app \
    --region ap-southeast-1

# Đặt retention 30 ngày
aws logs put-retention-policy \
    --log-group-name /cloudcomputing/app \
    --retention-in-days 30
```

### 9.2 Tạo CloudWatch Alarms

```bash
# Alarm: CPU cao → Scale Out
aws cloudwatch put-metric-alarm \
    --alarm-name "cloudcomputing-cpu-high" \
    --alarm-description "CPU > 70% - Scale Out" \
    --metric-name CPUUtilization \
    --namespace AWS/EC2 \
    --statistic Average \
    --period 300 \
    --threshold 70 \
    --comparison-operator GreaterThanThreshold \
    --dimensions Name=AutoScalingGroupName,Value=asg-cloudcomputing \
    --evaluation-periods 2 \
    --alarm-actions arn:aws:autoscaling:ap-southeast-1:ACCOUNT_ID:scalingPolicy:POLICY_ID

# Alarm: CPU thấp → Scale In  
aws cloudwatch put-metric-alarm \
    --alarm-name "cloudcomputing-cpu-low" \
    --alarm-description "CPU < 30% - Scale In" \
    --metric-name CPUUtilization \
    --namespace AWS/EC2 \
    --statistic Average \
    --period 300 \
    --threshold 30 \
    --comparison-operator LessThanThreshold \
    --dimensions Name=AutoScalingGroupName,Value=asg-cloudcomputing \
    --evaluation-periods 5
```

### 9.3 Tạo Dashboard
1. **CloudWatch** → **Dashboards** → **Create dashboard**
2. Name: `CloudComputing-Dashboard`
3. Thêm các widgets:
   - CPU Utilization (per instance + ASG average)
   - Memory Used % (từ CloudWatch Agent)
   - ALB Request Count
   - ALB HTTP 5xx Errors
   - ASG Instance Count

---

## 10. CẤU HÌNH CI/CD

### 10.1 Thêm GitHub Secrets

Vào GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:

| Secret Name | Giá trị |
|-------------|---------|
| `AWS_ACCESS_KEY_ID` | Access Key của IAM user có quyền ECR + ASG |
| `AWS_SECRET_ACCESS_KEY` | Secret Key tương ứng |
| `ASG_NAME` | `asg-cloudcomputing` |

### 10.2 Tạo IAM User cho GitHub Actions
1. **IAM** → **Users** → **Create user**
2. Name: `github-actions-cloudcomputing`
3. Đính kèm policies:
   - `AmazonEC2ContainerRegistryFullAccess`
   - Inline policy: `autoscaling:StartInstanceRefresh` trên ASG của bạn
4. Tạo **Access Key** → Copy vào GitHub Secrets

### 10.3 Test CI/CD Pipeline
```bash
# Thay đổi gì đó trong code, commit và push
git add .
git commit -m "Test CI/CD pipeline"
git push origin main

# Vào GitHub → Actions → xem workflow chạy
```

---

## 11. KIỂM TRA & VERIFY

### 11.1 Kiểm tra App chạy đúng
```bash
# Dùng ALB DNS name
curl http://alb-cloudcomputing-xxx.ap-southeast-1.elb.amazonaws.com/

# Test API
curl http://alb-cloudcomputing-xxx.ap-southeast-1.elb.amazonaws.com/api/employees
```

### 11.2 Checklist xác nhận

| Hạng mục | Cách kiểm tra |
|----------|---------------|
| ✅ ALB hoạt động | Truy cập DNS name → thấy app |
| ✅ Target Group Healthy | EC2 → Load Balancers → Target Group → tất cả "Healthy" |
| ✅ Auto Scaling có 2 instances | EC2 → Auto Scaling Groups → Activity |
| ✅ Docker containers chạy | SSH vào EC2 → `docker ps` |
| ✅ CloudWatch logs | CloudWatch → Log groups → `/cloudcomputing/app` |
| ✅ CloudWatch metrics | CloudWatch → Metrics → `CloudComputing/EC2` |
| ✅ CI/CD hoạt động | GitHub Actions → xanh toàn bộ |

### 11.3 SSH vào EC2 kiểm tra
```bash
ssh -i your-key.pem ubuntu@EC2_PUBLIC_IP

# Kiểm tra containers
docker ps

# Xem logs app
docker logs nodejs_crud_app --tail=50

# Kiểm tra CloudWatch Agent
sudo systemctl status amazon-cloudwatch-agent
```

### 11.4 Test Auto Scaling (mô phỏng tải cao)
```bash
# Cài stress trên EC2
sudo apt-get install -y stress

# Tăng CPU lên 100% trong 5 phút
stress --cpu 4 --timeout 300

# Quan sát ASG tạo instance mới trong EC2 Console
```

---

## 🏗️ TỔNG KẾT KIẾN TRÚC

```
Internet → ALB (Port 80) → Target Group → EC2 x2-4 (Docker: Node.js:3000 + MSSQL:1433)
                                                ↓
                                         CloudWatch (Metrics + Logs)
                                                ↑
GitHub Push → Actions → ECR → ASG Instance Refresh
```

| Tính năng | Service | Trạng thái |
|-----------|---------|------------|
| Load Balancing | Application Load Balancer | ✅ |
| Auto Scaling | EC2 Auto Scaling Group (2-4 instances) | ✅ |
| Docker | Docker Compose + Amazon ECR | ✅ |
| Monitoring | CloudWatch Dashboard + Alarms + Logs | ✅ |
| CI/CD | GitHub Actions Pipeline | ✅ |

---

> 💡 **Tip**: Sau khi hoàn tất demo, nhớ **xóa tất cả resources** để tránh bị tính phí:  
> `EC2 → Auto Scaling Groups → Delete` → `Load Balancers → Delete` → `RDS/ECR → Delete`
