#!/bin/bash
# ==============================================================================
# AWS EC2 USER DATA SCRIPT - AUTO DEPLOY (Ubuntu 24 LTS)
# Project: CloudSync Enterprise (Node.js + SQL Server 2022 CRUD App)
# Features: Docker, CloudWatch Monitoring, Auto-restart via Systemd
# ==============================================================================

exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

echo "======================================================="
echo "🚀 BẮT ĐẦU DEPLOY EC2 INSTANCE (Ubuntu 24 LTS)"
echo "======================================================="

# ─────────────────────────────────────────────────────────────────────────────
# BIẾN CẤU HÌNH — Thay đổi theo thực tế của bạn
# ─────────────────────────────────────────────────────────────────────────────
GIT_REPO_URL="https://github.com/Manh-Test/CloudComputing.git"
DEPLOY_DIR="/app/CloudComputing"
APP_PORT=3000
AWS_REGION="ap-southeast-1"                                           # <<< THAY ĐỔI nếu cần
LOG_GROUP_NAME="/cloudcomputing/app"

# ─────────────────────────────────────────────────────────────────────────────
# BƯỚC 1: Cập nhật hệ thống & Cài đặt Docker, Git, AWS CLI
# ─────────────────────────────────────────────────────────────────────────────
echo "[1/6] Cập nhật hệ thống và cài đặt dependencies..."
export DEBIAN_FRONTEND=noninteractive

# Tạo 4GB Swap space để đảm bảo MSSQL chạy mượt trên t2.micro / t3.micro (1GB RAM)
if [ ! -f /swapfile ]; then
    echo "Creating 4GB Swap file..."
    fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo "4GB Swap enabled successfully."
fi

apt-get update -y
apt-get upgrade -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold"
apt-get install -y \
    docker.io \
    docker-compose-v2 \
    git \
    curl \
    wget \
    unzip \
    jq \
    awscli

# ─────────────────────────────────────────────────────────────────────────────
# BƯỚC 2: Khởi chạy Docker
# ─────────────────────────────────────────────────────────────────────────────
echo "[2/6] Khởi chạy Docker daemon..."
systemctl start docker
systemctl enable docker
usermod -aG docker ubuntu

echo "Docker version: $(docker --version)"
echo "Docker Compose version: $(docker compose version)"

# ─────────────────────────────────────────────────────────────────────────────
# BƯỚC 3: Pull mã nguồn từ GitHub
# ─────────────────────────────────────────────────────────────────────────────
echo "[3/6] Pull mã nguồn từ GitHub..."
mkdir -p "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

if [ -d ".git" ]; then
    echo "Repo đã tồn tại → git pull..."
    git fetch origin
    git reset --hard origin/main || git reset --hard origin/master
else
    echo "Cloning repo: $GIT_REPO_URL"
    git clone "$GIT_REPO_URL" .
fi

# ─────────────────────────────────────────────────────────────────────────────
# BƯỚC 4: Tạo file .env
# ─────────────────────────────────────────────────────────────────────────────
echo "[4/6] Tạo file cấu hình .env..."
cat > .env << 'ENVEOF'
PORT=3000
DB_SERVER=db
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=manh123!
DB_NAME=EmployeeDB
NODE_ENV=production
ENVEOF

echo "File .env đã được tạo."

# ─────────────────────────────────────────────────────────────────────────────
# BƯỚC 5: Cài đặt CloudWatch Agent (Monitoring)
# ─────────────────────────────────────────────────────────────────────────────
echo "[5/6] Cài đặt Amazon CloudWatch Agent..."

wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb \
    -O /tmp/amazon-cloudwatch-agent.deb
dpkg -i /tmp/amazon-cloudwatch-agent.deb || apt-get install -f -y

mkdir -p /opt/aws/amazon-cloudwatch-agent/etc/
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << CWEOF
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/user-data.log",
            "log_group_name": "${LOG_GROUP_NAME}",
            "log_stream_name": "{instance_id}/user-data",
            "timezone": "UTC"
          },
          {
            "file_path": "/app/CloudComputing/app.log",
            "log_group_name": "${LOG_GROUP_NAME}",
            "log_stream_name": "{instance_id}/app",
            "timezone": "UTC"
          }
        ]
      }
    }
  },
  "metrics": {
    "aggregation_dimensions": [["InstanceId"]],
    "append_dimensions": {
      "AutoScalingGroupName": "\${aws:AutoScalingGroupName}",
      "ImageId": "\${aws:ImageId}",
      "InstanceId": "\${aws:InstanceId}",
      "InstanceType": "\${aws:InstanceType}"
    },
    "metrics_collected": {
      "cpu": {
        "measurement": ["cpu_usage_idle", "cpu_usage_user", "cpu_usage_system"],
        "metrics_collection_interval": 60,
        "resources": ["*"],
        "totalcpu": true
      },
      "disk": {
        "measurement": ["used_percent", "inodes_free"],
        "metrics_collection_interval": 60,
        "resources": ["*"]
      },
      "mem": {
        "measurement": ["mem_used_percent", "mem_available"],
        "metrics_collection_interval": 60
      },
      "netstat": {
        "measurement": ["tcp_established", "tcp_time_wait"],
        "metrics_collection_interval": 60
      }
    },
    "namespace": "CloudComputing/EC2"
  }
}
CWEOF

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -s \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

systemctl enable amazon-cloudwatch-agent
systemctl start amazon-cloudwatch-agent
echo "✅ CloudWatch Agent đã khởi chạy."

# ─────────────────────────────────────────────────────────────────────────────
# BƯỚC 6: Khởi chạy App bằng Docker Compose
# ─────────────────────────────────────────────────────────────────────────────
echo "[6/6] Khởi chạy containers với Docker Compose..."
cd "$DEPLOY_DIR"

# Dừng containers cũ nếu đang chạy
docker compose down --remove-orphans 2>/dev/null || true

# Build & start
docker compose up -d --build

# Chờ app khởi động (MSSQL cần thời gian init)
echo "Đang chờ containers khởi động (90 giây)..."
sleep 90
docker compose ps
docker compose logs --tail=20

# ─────────────────────────────────────────────────────────────────────────────
# THIẾT LẬP AUTO-RESTART KHI EC2 REBOOT (Systemd Service)
# ─────────────────────────────────────────────────────────────────────────────
cat > /etc/systemd/system/cloudcomputing-app.service << 'SVCEOF'
[Unit]
Description=CloudComputing Docker App
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/app/CloudComputing
ExecStart=/usr/bin/docker compose up -d --build
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable cloudcomputing-app.service

echo "======================================================="
echo "✅ TRIỂN KHAI HOÀN TẤT!"
echo "   App: http://$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4):$APP_PORT"
echo "   CloudWatch Agent: $(systemctl is-active amazon-cloudwatch-agent)"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
echo "======================================================="
