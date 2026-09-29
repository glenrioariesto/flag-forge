#!/usr/bin/env bash
#
# First-time Oracle Cloud Always-Free VM bootstrap.
#
# Run ONCE as root on a fresh Ubuntu 24.04 instance, AFTER you have:
#   - created the VM (recommend: 4 OCPU / 24 GB ARM Ampere A1 shape)
#   - pointed an A record at the VM's public IP
#   - opened ingress for TCP 22, 80 and 443 in the OCI security list
#
# This installs Docker, puts the app behind a systemd unit that starts on boot,
# and clones the repo. Deploys after that are just `deploy/deploy.sh`.

set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:glenrioariesto/flag-forge.git}"
APP_DIR="${APP_DIR:-/opt/flag-forge}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-}"

log() { printf '\n\033[1;34m==>\033[0m %s\n' "$*"; }
die() { printf '\n\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "run as root: sudo bash deploy/bootstrap-vm.sh"

# --- Docker -----------------------------------------------------------------
log "Installing Docker Engine + Compose plugin"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg git openssl >/dev/null
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin >/dev/null
systemctl enable --now docker

# Docker's log driver defaults to json-files with no rotation, which will fill
# the 200 GB boot volume over a long-running stream. Cap it.
log "Configuring Docker log rotation"
cat >/etc/docker/daemon.json <<'JSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
JSON
systemctl restart docker

# --- Unattended security updates -------------------------------------------
log "Enabling unattended security upgrades"
dpkg-reconfigure -f noninteractive 'unattended-upgrades' 2>/dev/null || true
apt-get install -y -qq unattended-upgrades >/dev/null
systemctl enable --now unattended-upgrades

# --- Swap -------------------------------------------------------------------
#
# The 4 OCPU / 24 GB shape has plenty of RAM and OCI does not attach swap. Add
# a small one so a transient memory spike fails soft instead of OOM-killing the
# Colyseus process (which would drop every connected OBS client).
log "Adding 2 GB swap"
if ! swapon --show | grep -q swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
  sysctl -q vm.swappiness=10
fi

# --- SSH key for GitHub Actions --------------------------------------------
if [[ -n "$DEPLOY_SSH_KEY" ]]; then
  log "Installing deploy SSH key"
  install -d -m 700 /root/.ssh
  printf '%s\n' "$DEPLOY_SSH_KEY" >/root/.ssh/deploy_key
  chmod 600 /root/.ssh/deploy_key
  grep -q 'flag-forge-deploy' /root/.ssh/authorized_keys 2>/dev/null || {
    cat >>/root/.ssh/authorized_keys <<EOF

# flag-forge-deploy
$(ssh-keygen -i -m PEM -f /root/.ssh/deploy_key)
EOF
    chmod 600 /root/.ssh/authorized_keys
  }
  # A host key check is not a nice-to-have here: without it the first deploy
  # either hangs on a prompt (breaking CI) or is disabled wholesale.
  ssh-keyscan -H github.com >>/root/.ssh/known_hosts 2>/dev/null
  cat >/root/.ssh/config <<'EOF'
Host github.com
  IdentityFile /root/.ssh/deploy_key
  IdentitiesOnly yes
EOF
  chmod 600 /root/.ssh/config
fi

# --- App directory and code -------------------------------------------------
log "Cloning into $APP_DIR"
install -d -m 755 "$APP_DIR"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO_URL" "$APP_DIR"
fi

# --- systemd ----------------------------------------------------------------
#
# `docker compose up -d` already restarts the container on crash, but the VM
# also needs to come back after an OCI reboot or a maintenance window. Without
# this unit a rebooted instance stays dark until someone SSHes in.
log "Installing systemd unit"
cat >/etc/systemd/system/flag-forge.service <<EOF
[Unit]
Description=Flag Forge overlay + game engine
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/docker compose up -d --remove-orphans
ExecStop=/usr/bin/docker compose down
# Compose is not a long-running process, so the unit is "oneshot" with
# RemainAfterExit; docker's own restart policy handles the container itself.
TimeoutStartSec=900
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable flag-forge.service

cat <<'NEXT'

--------------------------------------------------------------------------
 Bootstrap complete. Two things are still yours to do:

 1. Edit the hostnames in  deploy/Caddyfile  and make both DNS A records
    point at this VM's public IP. Caddy will not get a certificate until
    DNS resolves and ports 80/443 are open in the OCI security list.

 2. Create $APP_DIR/.env from .env.example and fill it in, then:

      cd $APP_DIR
      bash deploy/deploy.sh

 The service is already enabled, so it will start on boot once deployed.
--------------------------------------------------------------------------
NEXT
