#!/usr/bin/env bash
# =============================================================================
# Enterprise IT Asset Guard - Production Deployment Script (Ubuntu / Debian)
# Single-Command Setup: Automated Cryptographic Keys, SSL SAN Cert & Docker Compose
# =============================================================================

set -e

# ANSI Color Codes
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}====================================================================${NC}"
echo -e "${CYAN}  Enterprise IT Asset Guard - Automated Production Deployment Stack ${NC}"
echo -e "${CYAN}  (PostgreSQL + Node.js + Next.js 14 + Guacamole VNC + Nginx SSL)   ${NC}"
echo -e "${CYAN}====================================================================${NC}\n"

# 1. Verify Prerequisites (Docker, Docker Compose, OpenSSL)
echo -e "${YELLOW}[1/6] Checking system dependencies...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERROR] Docker is not installed on this system.${NC}"
    echo "Please install Docker via official script: curl -fsSL https://get.docker.com | sh"
    exit 1
fi

if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}[ERROR] Docker Compose is not installed.${NC}"
    echo "Please install docker compose plugin: sudo apt-get update && sudo apt-get install -y docker-compose-plugin"
    exit 1
fi

if ! command -v openssl &> /dev/null; then
    echo -e "${YELLOW}[WARN] OpenSSL not found. Installing openssl...${NC}"
    sudo apt-get update && sudo apt-get install -y openssl
fi

echo -e "${GREEN}✓ All dependencies validated (Docker, Docker Compose, OpenSSL).${NC}\n"

# 2. Automated Cryptographic Secret Generation (.env)
echo -e "${YELLOW}[2/6] Configuring production environment secrets...${NC}"

# Detect Host Primary LAN IP (ignoring docker0 / loopback)
DETECTED_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{print $7}' | head -n1 || hostname -I | awk '{print $1}')
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP="127.0.0.1"
fi

if [ ! -f .env ]; then
    echo -e "Generating cryptographically secure secrets into .env..."
    
    # 32 Hex characters (strictly 16 bytes) for Apache Guacamole auth-json
    RANDOM_GUAC_SECRET=$(openssl rand -hex 16)
    RANDOM_JWT_SECRET=$(openssl rand -hex 32)
    RANDOM_DB_PASSWORD=$(openssl rand -hex 16)
    RANDOM_AGENT_KEY="agt_live_$(openssl rand -hex 12)"

    cat <<EOF > .env
# Auto-generated Production Secrets - Generated on $(date -u +"%Y-%m-%dT%H:%M:%SZ")
POSTGRES_DB=it_asset_mgmt
POSTGRES_USER=postgres
POSTGRES_PASSWORD=${RANDOM_DB_PASSWORD}

PORT=4000
NODE_ENV=production
AGENT_API_KEY=${RANDOM_AGENT_KEY}
JWT_SECRET=${RANDOM_JWT_SECRET}

# Exact 32 Hexadecimal characters for guacamole-auth-json
GUACAMOLE_JSON_SECRET_KEY=${RANDOM_GUAC_SECRET}
GUACAMOLE_DEFAULT_VNC_PASSWORD=Hospital@2026
GUACAMOLE_RECORDING_PATH=/var/lib/guacamole/recordings

HOST_IP=${DETECTED_IP}
DOMAIN_NAME=it-asset.hospital.local
EOF
    echo -e "${GREEN}✓ Created .env with randomized 128-bit Guacamole key, JWT secret, and DB credentials.${NC}"
else
    echo -e "${GREEN}✓ Existing .env file found. Preserving current secrets.${NC}"
fi

# Load environment variables into current shell
set -a
# shellcheck disable=SC1091
source .env
set +a
echo ""

# 3. Create Host Volume Directories & Storage Permissions
echo -e "${YELLOW}[3/6] Setting up volume directories and permissions...${NC}"
mkdir -p data/guac_recordings
mkdir -p nginx/ssl
mkdir -p db/init

# Guacamole session recording directory permissions (Allow container UID to write .guac files)
chmod -R 777 data/guac_recordings

# Ensure SQL Initialization Scripts are copied to db/init
if [ -f BackendAPI/init_schema.sql ]; then
    cp -u BackendAPI/init_schema.sql db/init/01_init_schema.sql
fi
if [ -f BackendAPI/patch_and_software_views.sql ]; then
    cp -u BackendAPI/patch_and_software_views.sql db/init/02_patch_and_software_views.sql
fi
if [ -f BackendAPI/remote_access_schema.sql ]; then
    cp -u BackendAPI/remote_access_schema.sql db/init/03_remote_access_schema.sql
fi
echo -e "${GREEN}✓ Database schemas and recording volumes ready.${NC}\n"

# 4. Generate SAN SSL Certificate for LAN HTTPS & Mobile QR Camera
echo -e "${YELLOW}[4/6] Generating TLS/SSL Certificate with Subject Alternative Name (SAN)...${NC}"
TARGET_IP=${HOST_IP:-$DETECTED_IP}

if [ ! -f nginx/ssl/server.crt ] || [ ! -f nginx/ssl/server.key ]; then
    echo "Creating SAN SSL Certificate for IP: ${TARGET_IP} and localhost..."
    
    SAN_CONFIG=$(mktemp)
    cat <<EOF > "$SAN_CONFIG"
[req]
default_bits        = 2048
prompt              = no
default_md          = sha256
distinguished_name  = req_distinguished_name
req_extensions      = req_ext

[req_distinguished_name]
C                   = TH
ST                  = Bangkok
L                   = Bangkok
O                   = Enterprise IT
OU                  = Asset Guard Systems
CN                  = ${TARGET_IP}

[req_ext]
subjectAltName      = @alt_names

[alt_names]
IP.1                = ${TARGET_IP}
IP.2                = 127.0.0.1
DNS.1               = localhost
DNS.2               = ${DOMAIN_NAME:-it-asset.hospital.local}
EOF

    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/server.key \
        -out nginx/ssl/server.crt \
        -config "$SAN_CONFIG" 2>/dev/null
    
    rm -f "$SAN_CONFIG"
    chmod 600 nginx/ssl/server.key
    chmod 644 nginx/ssl/server.crt
    echo -e "${GREEN}✓ Generated SSL Certificate (nginx/ssl/server.crt) valid for 365 days.${NC}"
else
    echo -e "${GREEN}✓ Existing SSL Certificates found in nginx/ssl/. Skipping generation.${NC}"
fi
echo ""

# 5. Build and Deploy Docker Compose Stack
echo -e "${YELLOW}[5/6] Building container images and starting 6-service stack...${NC}"
echo "Building Frontend (Next.js standalone) and Backend (Node.js Alpine)..."

docker compose up -d --build --remove-orphans

echo -e "\n${YELLOW}[6/6] Verifying service health status...${NC}"
sleep 5
docker compose ps

echo -e "\n${CYAN}====================================================================${NC}"
echo -e "${GREEN}  🎉 IT Asset Guard System Successfully Deployed & Running!         ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo -e "Web Portal (HTTPS)        : ${CYAN}https://${TARGET_IP}${NC} (or https://localhost)"
echo -e "Executive Analytics       : ${CYAN}https://${TARGET_IP}/dashboard/executive${NC}"
echo -e "Remote VNC Audit Logs     : ${CYAN}https://${TARGET_IP}/audit-remote${NC}"
echo -e "Apache Guacamole Gateway  : ${CYAN}https://${TARGET_IP}/guacamole/${NC}"
echo -e "Backend Healthcheck       : ${CYAN}https://${TARGET_IP}/health${NC}"
echo -e "--------------------------------------------------------------------"
echo -e "Agent Telemetry Ingestion : ${YELLOW}https://${TARGET_IP}/api/v1/agent/ingest${NC}"
echo -e "Agent API Key             : ${YELLOW}${AGENT_API_KEY}${NC}"
echo -e "--------------------------------------------------------------------"
echo -e "Useful Commands:"
echo -e "  - View live container logs : ${CYAN}docker compose logs -f${NC}"
echo -e "  - View backend logs only   : ${CYAN}docker compose logs -f backend${NC}"
echo -e "  - Restart entire stack     : ${CYAN}docker compose restart${NC}"
echo -e "  - Stop all services        : ${CYAN}docker compose down${NC}"
echo -e "${CYAN}====================================================================${NC}\n"

