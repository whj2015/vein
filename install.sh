#!/bin/bash
# ============================================
# Vein — Xray 管理面板 一键安装脚本
# 自动检测 IP 归属地，国内/海外走不同镜像源
# 适用于: Ubuntu 20.04+ / Debian 11+
# ============================================
set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
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

# ---- 0. 检测系统 ----
if [ "$(id -u)" != "0" ]; then
    echo -e "${RED}请用 root 运行此脚本${NC}"
    exit 1
fi

# ---- 0.1 自动检测 IP 归属地，选择镜像 ----
echo -e "${YELLOW}[0/5] 检测网络环境...${NC}"

IS_CN=false
COUNTRY=""
IP_INFO=$(curl -s --connect-timeout 5 http://ip-api.com/json/ 2>/dev/null || true)
if [ -n "$IP_INFO" ]; then
    COUNTRY=$(echo "$IP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('countryCode',''))" 2>/dev/null || true)
    CITY=$(echo "$IP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('city',''))" 2>/dev/null || true)
    ISP=$(echo "$IP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('isp',''))" 2>/dev/null || true)
    if [ "$COUNTRY" = "CN" ]; then
        IS_CN=true
    fi
fi

if $IS_CN; then
    echo -e "  ${CYAN}检测到国内服务器 ($CITY $ISP)，使用国内镜像加速${NC}"
    NODE_MIRROR="https://mirrors.tuna.tsinghua.edu.cn/nodesource/deb_20.x"
    NPM_REGISTRY="https://registry.npmmirror.com"
    GHPROXY="https://ghproxy.net/"
    # 国内 PyPI 也换
    PYPI_INDEX="https://pypi.tuna.tsinghua.edu.cn/simple"
    # 系统 apt 源不自动改（风险高），但可以提示
else
    COUNTRY_NAME=$(echo "$IP_INFO" | python3 -c "import sys,json; print(json.load(sys.stdin).get('country',''))" 2>/dev/null || echo "Overseas")
    echo -e "  ${CYAN}检测到海外服务器 ($COUNTRY_NAME)，使用默认源${NC}"
    NODE_MIRROR="https://deb.nodesource.com"
    NPM_REGISTRY="https://registry.npmjs.org"
    GHPROXY=""
    PYPI_INDEX=""
fi

# ---- 1. 安装基础依赖 ----
echo -e "${YELLOW}[1/5] 安装基础依赖...${NC}"
apt-get update -qq
apt-get install -y -qq curl wget unzip openssl python3 2>/dev/null || true

# ---- 2. 安装 Node.js 20.x ----
echo -e "${YELLOW}[2/5] 安装 Node.js...${NC}"
if command -v node &>/dev/null; then
    echo -e "  ${GREEN}Node.js $(node -v) (已安装)${NC}"
else
    echo "  从镜像下载..."
    if $IS_CN; then
        # 国内: 清华镜像
        curl -fsSL "${NODE_MIRROR}/setup_20.x" | bash - 2>/dev/null
    else
        curl -fsSL "https://deb.nodesource.com/setup_20.x" | bash -
    fi
    apt-get install -y nodejs
    echo -e "  ${GREEN}Node.js $(node -v)${NC}"
fi

# 配置 npm 镜像
if $IS_CN; then
    npm config set registry "$NPM_REGISTRY" 2>/dev/null || true
    echo "  npm 镜像: $NPM_REGISTRY"
fi

# ---- 3. 安装 Xray ----
echo -e "${YELLOW}[3/5] 安装 Xray...${NC}"
if command -v xray &>/dev/null; then
    echo -e "  ${GREEN}Xray 已安装${NC}"
    xray version 2>/dev/null | head -1 || true
else
    echo "  下载 Xray..."
    XRAY_VER=$(curl -sL --connect-timeout 10 "https://api.github.com/repos/XTLS/Xray-core/releases/latest" 2>/dev/null | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | head -1)
    [ -z "$XRAY_VER" ] && XRAY_VER="v25.2.1"
    
    XRAY_URL="https://github.com/XTLS/Xray-core/releases/download/${XRAY_VER}/Xray-linux-64.zip"
    if $IS_CN; then
        DOWNLOAD_URL="${GHPROXY}${XRAY_URL}"
    else
        DOWNLOAD_URL="$XRAY_URL"
    fi
    
    echo "  版本: $XRAY_VER"
    echo "  下载: $DOWNLOAD_URL"
    wget -q --show-progress --timeout=30 -O /tmp/xray.zip "$DOWNLOAD_URL" 2>/dev/null || {
        echo -e "  ${YELLOW}代理下载失败，尝试直连...${NC}"
        wget -q --timeout=30 -O /tmp/xray.zip "$XRAY_URL"
    }
    
    mkdir -p /usr/local/bin /usr/local/etc/xray /usr/local/share/xray
    unzip -o /tmp/xray.zip -d /tmp/xray-tmp > /dev/null
    cp /tmp/xray-tmp/xray /usr/local/bin/xray
    chmod +x /usr/local/bin/xray
    [ -f /tmp/xray-tmp/geoip.dat ] && cp /tmp/xray-tmp/geoip.dat /usr/local/share/xray/
    [ -f /tmp/xray-tmp/geosite.dat ] && cp /tmp/xray-tmp/geosite.dat /usr/local/share/xray/
    rm -rf /tmp/xray.zip /tmp/xray-tmp
    
    # 初始空配置
    cat > /usr/local/etc/xray/config.json << 'XEOF'
{
  "log": {"loglevel": "warning"},
  "inbounds": [],
  "outbounds": [{"protocol": "freedom", "tag": "direct"}],
  "routing": {"domainStrategy": "AsIs", "rules": []}
}
XEOF
    echo -e "  ${GREEN}Xray $XRAY_VER 安装完成${NC}"
fi

# ---- 4. 部署 Vein 面板 ----
echo -e "${YELLOW}[4/5] 部署 Vein 面板...${NC}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/server/index.js" ]; then
    echo "  从 $SCRIPT_DIR 复制..."
    mkdir -p "$INSTALL_DIR"
    cp -r "$SCRIPT_DIR"/* "$INSTALL_DIR/"
else
    echo "  git clone..."
    if $IS_CN; then
        git clone "https://ghproxy.net/https://github.com/whj2015/vein.git" "$INSTALL_DIR" 2>/dev/null || \
        git clone "https://github.com/whj2015/vein.git" "$INSTALL_DIR"
    else
        git clone "https://github.com/whj2015/vein.git" "$INSTALL_DIR"
    fi
fi

cd "$INSTALL_DIR"

# 生成配置
cat > .env << EOF
PORT=$PANEL_PORT
JWT_SECRET=$(openssl rand -hex 32)
XRAY_PATH=/usr/local/bin/xray
XRAY_CONFIG_PATH=/usr/local/etc/xray/config.json
EOF

# 找到 npm 的完整路径（兼容 sudo 环境 PATH 丢失）
NPM_BIN=$(which npm 2>/dev/null || echo "/usr/bin/npm")
NODE_BIN=$(which node 2>/dev/null || echo "/usr/bin/node")

# 安装 + 构建
echo "  安装依赖 + 构建前端..."
cd "$INSTALL_DIR"
$NPM_BIN install 2>&1 | tail -3
$NPM_BIN run build -w client 2>&1 | tail -3

# ---- 5. 创建 systemd 服务 ----
echo -e "${YELLOW}[5/5] 配置 systemd 服务...${NC}"

NODE_PATH=$(which node)

cat > /etc/systemd/system/vein.service << EOF
[Unit]
Description=Vein Xray Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=$NODE_PATH $INSTALL_DIR/server/index.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable vein
systemctl start vein
sleep 2

# ---- 完成 ----
SERVER_IP=$(curl -s --connect-timeout 3 ifconfig.me 2>/dev/null || curl -s --connect-timeout 3 ip.sb 2>/dev/null || echo "YOUR_IP")

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Vein 安装完成！${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  面板地址: http://${SERVER_IP}:${PANEL_PORT}"
echo "  配置目录: $INSTALL_DIR"
echo "  Xray 配置: /usr/local/etc/xray/config.json"
echo ""
echo "  管理命令:"
echo "    systemctl status vein   查看状态"
echo "    systemctl restart vein  重启面板"
echo "    journalctl -u vein -f   查看日志"
echo ""
echo "  首次访问请初始化管理员账号。"
echo "  如果页面打不开，检查云服务器防火墙是否放行了 ${PANEL_PORT} 端口。"
echo ""
