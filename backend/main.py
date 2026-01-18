from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import seasons, races, drivers, laps, telemetry, models, features
from api.websocket import router as websocket_router

app = FastAPI(
    title="F1 Telemetry Dashboard API",
    description="Real-time F1 telemetry data API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(seasons.router, prefix="/api/v1", tags=["Seasons"])
app.include_router(races.router, prefix="/api/v1", tags=["Races"])
app.include_router(drivers.router, prefix="/api/v1", tags=["Drivers"])
app.include_router(laps.router, prefix="/api/v1", tags=["Laps"])
app.include_router(telemetry.router, prefix="/api/v1", tags=["Telemetry"])
app.include_router(models.router, prefix="/api/v1", tags=["Models"])
app.include_router(features.router, prefix="/api/v1", tags=["Features"])
app.include_router(websocket_router, prefix="/api/v1", tags=["WebSocket"])

@app.get("/")
async def root():
    return {"message": "F1 Telemetry Dashboard API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
