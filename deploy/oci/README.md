# TelemetryX OCI Always Free Deployment (Backend + Object Storage + Vercel Frontend)

This guide deploys TelemetryX backend to an OCI Always Free VM and connects your Vercel frontend to it.

It is tailored to this repo:
- Backend service: `backend.main:app`
- API base path: `/api/v1`
- Health endpoint: `/health`
- Data root env: `TELEMETRYX_DATA_ROOT`

## 0) Architecture

- OCI VM (Always Free Ampere A1): runs FastAPI + Redis + Nginx
- OCI Object Storage: source of parquet/data
- Local VM disk: hot cache copy of parquet data (backend reads local filesystem)
- Vercel: frontend only, points to OCI backend URL

Why local data cache on VM:
- Current backend code resolves files/directories via local paths (`resolve_dir`, `os.path.exists`).
- Running queries directly against remote object URLs is possible but requires additional backend changes.
- Syncing object storage to local keeps behavior stable and fast.

## 1) Create OCI VM

Recommended:
- Shape: `VM.Standard.A1.Flex`
- OCPU/RAM: `2 OCPU / 12 GB` (or `4/24` if available)
- OS: Ubuntu 22.04
- Public IP: enabled
- Add SSH key

Open ingress ports in OCI security list / NSG:
- `22` (SSH)
- `80` (HTTP, cert bootstrap)
- `443` (HTTPS)

## 2) Bootstrap VM

SSH into VM, then run:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release jq unzip

# Docker + compose plugin
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
```

Log out/in once (or run `newgrp docker`).

## 3) Create server directories

```bash
sudo mkdir -p /opt/telemetryx
sudo chown -R "$USER":"$USER" /opt/telemetryx
mkdir -p /opt/telemetryx/{app,data,state,logs,deploy}
```

## 4) Copy repo + deploy files

Option A: git clone directly on VM.

```bash
cd /opt/telemetryx/app
git clone https://github.com/<your-org-or-user>/TelemetryX.git .
```

Option B: rsync from local machine.

Then copy these files from repo to `/opt/telemetryx/deploy`:
- `deploy/oci/docker-compose.backend.yml`
- `deploy/oci/.env.backend.example`
- `deploy/oci/nginx.telemetryx.conf`
- `deploy/oci/telemetryx-backend.service`
- `deploy/oci/sync_object_storage.sh`

## 5) Configure backend env

```bash
cd /opt/telemetryx/deploy
cp .env.backend.example .env.backend
```

Edit `.env.backend`:
- Set `TELEMETRYX_CORS_ORIGINS` to your Vercel domains
- Keep `TELEMETRYX_DATA_ROOT=/data`
- If you are not using Clerk yet, keep `TELEMETRYX_REQUIRE_AUTH=0`

Example CORS value:

```text
TELEMETRYX_CORS_ORIGINS=https://telemetryx.vercel.app,https://telemetryx-<project>.vercel.app
```

## 6) Sync data from OCI Object Storage to VM local data dir

`sync_object_storage.sh` uses AWS CLI S3 API compatibility.

Install aws cli:

```bash
sudo apt-get install -y awscli
```

Set env + run sync:

```bash
export OCI_REGION=ap-mumbai-1
export OCI_NAMESPACE=<your_object_storage_namespace>
export OCI_BUCKET=<your_bucket_name>
export OCI_ACCESS_KEY_ID=<customer_secret_key_access_key>
export OCI_SECRET_ACCESS_KEY=<customer_secret_key_secret>

chmod +x /opt/telemetryx/deploy/sync_object_storage.sh
/opt/telemetryx/deploy/sync_object_storage.sh
```

Expected data path after sync:
- `/opt/telemetryx/data/silver/...`
- `/opt/telemetryx/data/bronze/...`
- `/opt/telemetryx/data/gold/...`
- `/opt/telemetryx/data/features/...`
- `/opt/telemetryx/data/track_geometry/...`

## 7) Start backend stack

```bash
cd /opt/telemetryx
docker compose --env-file /opt/telemetryx/deploy/.env.backend -f /opt/telemetryx/deploy/docker-compose.backend.yml up -d --build
docker compose -f /opt/telemetryx/deploy/docker-compose.backend.yml ps
curl http://127.0.0.1:9000/health
```

## 8) Nginx reverse proxy + TLS

Install Nginx + certbot:

```bash
sudo apt-get install -y nginx certbot python3-certbot-nginx
```

Set your API domain in nginx config:

```bash
sudo cp /opt/telemetryx/deploy/nginx.telemetryx.conf /etc/nginx/sites-available/telemetryx
sudo ln -sf /etc/nginx/sites-available/telemetryx /etc/nginx/sites-enabled/telemetryx
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

Request certificate:

```bash
sudo certbot --nginx -d api.yourdomain.com --redirect -m you@domain.com --agree-tos -n
```

Verify:

```bash
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/api/v1/seasons
```

## 9) Point Vercel frontend to OCI backend

From your local project:

```bash
cd /Volumes/Space/PROJECTS/TelemetryX/frontend
npx vercel env add VITE_API_BASE_URL production
```

Set value:

```text
https://api.yourdomain.com/api/v1
```

Redeploy:

```bash
npx vercel --prod
```

## 10) Optional: boot-time auto start (systemd)

```bash
sudo cp /opt/telemetryx/deploy/telemetryx-backend.service /etc/systemd/system/telemetryx-backend.service
sudo systemctl daemon-reload
sudo systemctl enable telemetryx-backend
sudo systemctl start telemetryx-backend
sudo systemctl status telemetryx-backend --no-pager
```

## 11) Routine operations

Update app:

```bash
cd /opt/telemetryx/app
git pull
cd /opt/telemetryx
docker compose --env-file /opt/telemetryx/deploy/.env.backend -f /opt/telemetryx/deploy/docker-compose.backend.yml up -d --build
```

Resync object storage:

```bash
/opt/telemetryx/deploy/sync_object_storage.sh
```

Logs:

```bash
docker logs -f telemetryx-backend
docker logs -f telemetryx-redis
```

## 12) Troubleshooting

- Browser shows `TypeError: Load failed`
  - Usually wrong frontend env var or CORS mismatch.
  - Check Vercel env: `VITE_API_BASE_URL=https://api.yourdomain.com/api/v1`
  - Check backend CORS env includes your `vercel.app` origins.

- `/health` works but `/api/v1/seasons` fails
  - Data sync incomplete/missing directories under `/opt/telemetryx/data`.

- 502 from nginx
  - Backend container down or wrong proxy target.
  - `curl http://127.0.0.1:9000/health` on VM.
