from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Set

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]

    async def send_message(self, client_id: str, message: dict):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(message)

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            await connection.send_json(message)

manager = ConnectionManager()

@router.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    client_id = None
    try:
        await manager.connect(websocket, "telemetry_client")
        while True:
            data = await websocket.receive_json()
            await manager.send_message("telemetry_client", {"status": "received", "data": data})
    except WebSocketDisconnect:
        if client_id:
            manager.disconnect(client_id)
