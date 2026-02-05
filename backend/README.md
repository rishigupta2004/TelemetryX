# TelemetryX Backend (Docker)

## Run (local dev)

From repo root:

```bash
docker compose up --build telemetryx-backend
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

### Getting a desktop API token (JWT)

When auth is enabled, the desktop app sends `Authorization: Bearer <token>`.

Flow:
1. Call `GET /api/v1/auth/oauth/google/start` to get an `auth_url`
2. Open `auth_url` in a browser and complete Google login
3. The callback page shows the TelemetryX JWT (copy it)
4. Run the desktop app with `TELEMETRYX_API_TOKEN=<copied token>`
