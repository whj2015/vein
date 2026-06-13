#!/bin/bash
# ============================================
# Vein — Xray 管理面板 一键安装脚本
# 适用于: Ubuntu 20.04+ / Debian 11+ / CentOS 8+
# ============================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}"
echo "  ██╗   ██╗███████╗██╗███╗   ██╗"
echo "  ██║   ██║██╔════╝██║████╗  ██║"
echo "  ██║   ██║█████╗  ██║██╔██╗ ██║"
echo "  ╚██╗ ██╔╝██╔══╝  ██║██║╚██╗██║"
echo "   ╚████╔╝ ███████╗██║██║ ╚████║"
echo "    ╚═══╝  ╚══════╝╚═╝╚═╝  ╚═══╝"
echo -e "${NC}"
echo "  Xray Management Panel — 从零重建，零后门"
echo ""

INSTALL_DIR="/opt/vein"
PANEL_PORT="${1:-54321}"

# ---- 1. 检测系统 ----
if [ "$(id -u)" != "0" ]; then
    echo -e "${RED}请用 root 运行此脚本${NC}"
    exit 1
fi

# ---- 2. 安装 Node.js 20.x ----
echo -e "${YELLOW}[1/4] 检查 Node.js...${NC}"
if ! command -v node &>/dev/null; then
    echo "  安装 Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi
echo -e "${GREEN}  Node.js $(node -v)${NC}"

# ---- 3. 安装 Xray ----
echo -e "${YELLOW}[2/4] 检查 Xray...${NC}"
if ! command -v xray &>/dev/null; then
    echo "  安装 Xray..."
    bash -c "$(curl -L https://github.com/XTLS/Xray-install/raw/main/install-release.sh)" @ install
fi
echo -e "${GREEN}  Xray $(xray version | head -1)${NC}"

# ---- 4. 部署 Vein ----
echo -e "${YELLOW}[3/4] 部署 Vein...${NC}"

# 用当前目录的代码（假设已 git clone 或 scp 到服务器）
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/server/index.js" ]; then
    echo "  从 $SCRIPT_DIR 复制..."
    mkdir -p "$INSTALL_DIR"
    cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"
else
    echo -e "${RED}  未找到源码！请先 git clone 到本目录${NC}"
    exit 1
fi

cd "$INSTALL_DIR"

# 创建 .env
cat > .env << EOF
PORT=$PANEL_PORT
JWT_SECRET=$(openssl rand -hex 32)
XRAY_PATH=/usr/local/bin/xray
XRAY_CONFIG_PATH=/usr/local/etc/xray/config.json
EOF

# 安装依赖 + 构建前端
npm install --production
npm run build -w client 2>/dev/null || true

# ---- 5. 创建 systemd 服务 ----
echo -e "${YELLOW}[4/4] 配置 systemd 服务...${NC}"

cat > /etc/systemd/system/vein.service << EOF
[Unit]
Description=Vein Xray Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$(which node) $INSTALL_DIR/server/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable vein
systemctl start vein

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Vein 安装完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  面板地址: http://$(curl -s ifconfig.me || echo 'YOUR_IP'):$PANEL_PORT"
echo "  配置目录: $INSTALL_DIR"
echo "  Xray 配置: /usr/local/etc/xray/config.json"
echo ""
echo "  管理命令:"
echo "    systemctl status vein   查看状态"
echo "    systemctl restart vein  重启面板"
echo "    journalctl -u vein -f   查看日志"
echo ""
echo "  首次访问请初始化管理员账号。"
echo ""
