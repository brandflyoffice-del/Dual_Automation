#!/usr/bin/env bash
# One-time server hardening + Docker install for a fresh Ubuntu 24.04 VPS. Run via: npm run deploy -- --setup
# Safe to re-run. It never deploys the app.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl ufw fail2ban unattended-upgrades

# Docker engine + compose plugin
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker

# 2 GB swap (8 GB RAM box, protects the builds)
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# Firewall: SSH + web only. (Postgres, n8n and the dashboard are never published; only Caddy is.)
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# Key-only SSH. Only when this very session logged in with a key that is already installed.
if [ -s /root/.ssh/authorized_keys ]; then
  cat > /etc/ssh/sshd_config.d/00-fenebris.conf <<'EOF'
PasswordAuthentication no
PermitRootLogin prohibit-password
EOF
  systemctl reload ssh
fi

systemctl enable --now fail2ban
mkdir -p /opt/fenebris/app /opt/fenebris/backups
echo "SERVER SETUP OK  (docker $(docker --version | cut -d' ' -f3 | tr -d ,))"
