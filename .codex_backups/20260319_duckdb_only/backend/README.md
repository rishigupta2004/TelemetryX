# TelemetryX Backend (Docker)

## Run (local dev)

From repo root:

```bash
docker compose up --build telemetryx-backend
```

To start backend + local ClickHouse together:

```bash
docker compose up --build telemetryx-clickhouse telemetryx-backend
```

Defaults:
- API: `http://localhost:9010`
- Swagger: `http://localhost:9010/docs`
- Data mount: `./backend/etl/data` → `/data` (read-only)
- Session codes on disk: `Q`, `R`, `S`, `SS` (API also accepts `SR` as alias for `SS`)

## Production notes

- Mount your full dataset into the container and set `TELEMETRYX_DATA_ROOT=/data`.
- Set `TELEMETRYX_REQUIRE_AUTH=1` + a strong `AUTH_SECRET`.
- Configure Google OAuth via `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.

### Clerk-only auth (current)

Set these env vars when `TELEMETRYX_REQUIRE_AUTH=1`:
- `CLERK_ISSUER` (example: `https://your-instance.clerk.accounts.dev`)
- `CLERK_AUDIENCE` (optional, only if your Clerk JWT template sets aud)
- `CLERK_JWKS_URL` (optional override, default: `${CLERK_ISSUER}/.well-known/jwks.json`)

The backend now validates Clerk bearer tokens for protected routes.

## Billing & Workspace Entitlements

Workspace pricing is configured as:
- `starter` = `$10` per workspace / month
- `pro` = `$50` per workspace / month
- `terminal` = `$100` per workspace / month

API endpoints:
- `GET /api/v1/billing/plans` -> plan matrix + limits/features
- `GET /api/v1/billing/schema` -> billing event ingestion schema
- `GET /api/v1/billing/workspaces/{workspace_id}/entitlements` -> resolved entitlements
- `POST /api/v1/billing/workspaces/{workspace_id}/subscribe` -> upsert workspace plan
- `POST /api/v1/billing/events` -> ingest usage/billing events
- `GET /api/v1/billing/workspaces/{workspace_id}/usage` -> month-to-date usage

Clerk integration notes:
- Authenticated actor is derived from Clerk bearer token.
- If `workspace_id` is omitted for event ingestion, backend resolves workspace as:
  1) `X-Workspace-Id` header
  2) `X-Clerk-Org-Id` header -> `org:<id>`
  3) fallback personal workspace -> `user:<clerk_user_id>`

## Data Source Modes

Set `TELEMETRYX_DATA_SOURCE`:
- `duckdb` (default): serve directly from Parquet via DuckDB
- `clickhouse`: serve telemetry/positions from ClickHouse only
- `shadow`: serve from DuckDB and compare row counts with ClickHouse in logs

Runtime data-source health endpoint:
- `GET /api/v1/health/data-source` (mode, ClickHouse connectivity, watermark freshness)

### ClickHouse bootstrap

```bash
python scripts/clickhouse/init_clickhouse.py
python scripts/clickhouse/ingest_silver.py
python scripts/clickhouse/ingest_features.py
```

### Medallion safety/reconciliation

```bash
python scripts/medallion_manifest.py --out backend/etl/data/analysis/manifest_before.json
# run ingestion/backfill
python scripts/medallion_manifest.py --out backend/etl/data/analysis/manifest_after.json
python scripts/medallion_reconcile.py --before backend/etl/data/analysis/manifest_before.json --after backend/etl/data/analysis/manifest_after.json
```

`scripts/phase2_backfill.py` is now safe by default (no deletions). To explicitly allow destructive cleanup in a maintenance window:

```bash
export TELEMETRYX_ALLOW_DESTRUCTIVE_BACKFILL=1
```

### Getting a desktop API token (JWT)

When auth is enabled, the desktop app sends `Authorization: Bearer <token>`.

Flow:
1. Call `GET /api/v1/auth/oauth/google/start` to get an `auth_url`
2. Open `auth_url` in a browser and complete Google login
3. The callback page shows the TelemetryX JWT (copy it)
4. Run the desktop app with `TELEMETRYX_API_TOKEN=<copied token>`
