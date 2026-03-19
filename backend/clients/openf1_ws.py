from __future__ import annotations

import asyncio
import json
import logging
import ssl
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

import paho.mqtt.client as mqtt
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class ConnectionState(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"


class OpenF1Message(BaseModel):
    topic: str
    payload: Dict[str, Any]
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class LivePosition(BaseModel):
    driver_number: Optional[int] = None
    position: Optional[int] = None
    gap: Optional[float] = None
    interval: Optional[float] = None
    lap_time: Optional[float] = None
    pit: Optional[int] = None


class LiveLap(BaseModel):
    driver_number: Optional[int] = None
    lap_number: Optional[int] = None
    lap_time: Optional[float] = None
    sector1_time: Optional[float] = None
    sector2_time: Optional[float] = None
    sector3_time: Optional[float] = None


class LiveCarData(BaseModel):
    driver_number: Optional[int] = None
    speed: Optional[float] = None
    throttle: Optional[float] = None
    brake: Optional[float] = None
    gear: Optional[int] = None
    rpm: Optional[int] = None
    drs: Optional[int] = None


class LiveInterval(BaseModel):
    driver_number: Optional[int] = None
    leader_delta: Optional[float] = None
    gap_to_leader: Optional[float] = None


class SessionStatus(BaseModel):
    session_key: Optional[int] = None
    session_type: Optional[str] = None
    status: Optional[str] = None
    lap: Optional[int] = None
    time: Optional[str] = None


OPENF1_MQTT_HOST = "mqtt.openf1.org"
OPENF1_MQTT_PORT = 8084
OPENF1_MQTT_PATH = "/mqtt"

DEFAULT_TOPICS = [
    "v1/sessions",
    "v1/laps",
    "v1/position",
    "v1/car_data",
    "v1/intervals",
]

INITIAL_RECONNECT_DELAY = 1.0
MAX_RECONNECT_DELAY = 60.0
RECONNECT_BACKOFF_MULTIPLIER = 2.0


class OpenF1WebSocketClient:
    def __init__(
        self,
        access_token: str,
        on_message: Callable[[OpenF1Message], None],
        on_connect: Optional[Callable[[], None]] = None,
        on_disconnect: Optional[Callable[[], None]] = None,
    ):
        self.access_token = access_token
        self.on_message = on_message
        self.on_connect = on_connect
        self.on_disconnect = on_disconnect

        self._state = ConnectionState.DISCONNECTED
        self._client: Optional[mqtt.Client] = None
        self._reconnect_delay = INITIAL_RECONNECT_DELAY
        self._reconnect_task: Optional[asyncio.Task] = None
        self._should_reconnect = False
        self._subscribed_topics: List[str] = []
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._connection_ready = asyncio.Event()

    @property
    def state(self) -> ConnectionState:
        return self._state

    def is_connected(self) -> bool:
        return self._state == ConnectionState.CONNECTED

    def _create_ssl_context(self) -> ssl.SSLContext:
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        ssl_context.check_hostname = True
        ssl_context.verify_mode = ssl.CERT_REQUIRED
        ssl_context.load_default_certs()
        return ssl_context

    def _on_mqtt_connect(
        self, client: mqtt.Client, userdata: Any, flags: dict, rc: int
    ) -> None:
        if rc == 0:
            logger.info("OpenF1 MQTT connected successfully")
            self._state = ConnectionState.CONNECTED
            self._reconnect_delay = INITIAL_RECONNECT_DELAY
            self._connection_ready.set()

            for topic in self._subscribed_topics:
                result = client.subscribe(topic)
                if result[0] == mqtt.MQTT_ERR_SUCCESS:
                    logger.info(f"Subscribed to topic: {topic}")
                else:
                    logger.warning(f"Failed to subscribe to {topic}: {result}")

            if self.on_connect:
                try:
                    self.on_connect()
                except Exception as e:
                    logger.error(f"Error in on_connect callback: {e}")
        else:
            logger.error(f"OpenF1 MQTT connection failed with code: {rc}")
            self._state = ConnectionState.DISCONNECTED

    def _on_mqtt_disconnect(self, client: mqtt.Client, userdata: Any, rc: int) -> None:
        logger.warning(f"OpenF1 MQTT disconnected (rc: {rc})")
        self._state = ConnectionState.DISCONNECTED
        self._connection_ready.clear()

        if self.on_disconnect:
            try:
                self.on_disconnect()
            except Exception as e:
                logger.error(f"Error in on_disconnect callback: {e}")

        if self._should_reconnect:
            self._schedule_reconnect()

    def _on_mqtt_message(
        self, client: mqtt.Client, userdata: Any, msg: mqtt.MQTTMessage
    ) -> None:
        try:
            topic = msg.topic
            payload_str = msg.payload.decode("utf-8")

            try:
                payload = json.loads(payload_str)
            except json.JSONDecodeError:
                logger.warning(
                    f"Failed to parse JSON from topic {topic}: {payload_str}"
                )
                payload = {"raw": payload_str}

            message = OpenF1Message(topic=topic, payload=payload)

            if self.on_message:
                try:
                    self.on_message(message)
                except Exception as e:
                    logger.error(f"Error in on_message callback: {e}")

        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")

    def _schedule_reconnect(self) -> None:
        if self._reconnect_task and not self._reconnect_task.done():
            logger.debug("Reconnect task already scheduled")
            return

        async def reconnect_with_backoff():
            if not self._should_reconnect:
                return

            logger.info(f"Scheduling reconnect in {self._reconnect_delay:.1f} seconds")
            await asyncio.sleep(self._reconnect_delay)

            if self._should_reconnect:
                logger.info("Attempting to reconnect to OpenF1 MQTT...")
                try:
                    await self.connect()
                except Exception as e:
                    logger.error(f"Reconnect failed: {e}")
                    self._reconnect_delay = min(
                        self._reconnect_delay * RECONNECT_BACKOFF_MULTIPLIER,
                        MAX_RECONNECT_DELAY,
                    )

        if self._loop and self._loop.is_running():
            self._reconnect_task = asyncio.run_coroutine_threadsafe(
                reconnect_with_backoff(), self._loop
            )
        else:
            self._reconnect_task = asyncio.create_task(reconnect_with_backoff())

    async def connect(self) -> None:
        if self._state == ConnectionState.CONNECTED:
            logger.warning("Already connected to OpenF1 MQTT")
            return

        if self._state == ConnectionState.CONNECTING:
            logger.warning("Connection in progress, waiting...")
            await asyncio.sleep(2)
            if self._state == ConnectionState.CONNECTED:
                return
            raise RuntimeError("Connection failed")

        self._state = ConnectionState.CONNECTING
        self._should_reconnect = True

        self._loop = asyncio.get_event_loop()

        transport = "websockets"
        protocol = "mqttv311"

        self._client = mqtt.Client(
            transport=transport,
            protocol=mqtt.MQTTv311,
            client_id=f"telemetryx_{id(self)}",
        )

        self._client.tls_set_context(self._create_ssl_context())
        self._client.tls_insecure_set(False)

        self._client.username_pw_set(username="openf1", password=self.access_token)

        self._client.on_connect = self._on_mqtt_connect
        self._client.on_disconnect = self._on_mqtt_disconnect
        self._client.on_message = self._on_mqtt_message

        try:
            logger.info(
                f"Connecting to OpenF1 MQTT at wss://{OPENF1_MQTT_HOST}:{OPENF1_MQTT_PORT}{OPENF1_MQTT_PATH}"
            )

            self._client.ws_set_options(
                path=OPENF1_MQTT_PATH,
                headers=None,
            )

            self._client.connect(
                OPENF1_MQTT_HOST,
                OPENF1_MQTT_PORT,
                keepalive=60,
                bind_address="",
                bind_port=0,
                clean_start=mqtt.MQTT_CLEAN_START_FIRST_ONLY,
                properties=None,
            )

        except Exception as e:
            logger.error(f"Failed to connect to OpenF1 MQTT: {e}")
            self._state = ConnectionState.DISCONNECTED
            self._should_reconnect = False
            raise

        self._client.loop_start()

        try:
            await asyncio.wait_for(self._connection_ready.wait(), timeout=30.0)
        except asyncio.TimeoutError:
            logger.error("Connection timeout")
            self._state = ConnectionState.DISCONNECTED
            raise RuntimeError("Connection timeout")

    async def disconnect(self) -> None:
        logger.info("Disconnecting from OpenF1 MQTT...")
        self._should_reconnect = False

        if self._reconnect_task and not self._reconnect_task.done():
            self._reconnect_task.cancel()
            try:
                await self._reconnect_task
            except asyncio.CancelledError:
                pass

        if self._client:
            try:
                self._client.loop_stop()
                self._client.disconnect()
            except Exception as e:
                logger.error(f"Error during disconnect: {e}")
            finally:
                self._client = None

        self._state = ConnectionState.DISCONNECTED
        self._connection_ready.clear()
        logger.info("Disconnected from OpenF1 MQTT")

    def subscribe(self, topic: str) -> None:
        if topic not in self._subscribed_topics:
            self._subscribed_topics.append(topic)

        if self._client and self._state == ConnectionState.CONNECTED:
            result = self._client.subscribe(topic)
            if result[0] == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"Subscribed to topic: {topic}")
            else:
                logger.warning(f"Failed to subscribe to {topic}: {result}")

    def unsubscribe(self, topic: str) -> None:
        if topic in self._subscribed_topics:
            self._subscribed_topics.remove(topic)

        if self._client and self._state == ConnectionState.CONNECTED:
            result = self._client.unsubscribe(topic)
            if result[0] == mqtt.MQTT_ERR_SUCCESS:
                logger.info(f"Unsubscribed from topic: {topic}")
            else:
                logger.warning(f"Failed to unsubscribe from {topic}: {result}")


def get_openf1_live_client(
    access_token: str,
    on_message: Callable[[OpenF1Message], None],
    on_connect: Optional[Callable[[], None]] = None,
    on_disconnect: Optional[Callable[[], None]] = None,
    auto_subscribe: bool = True,
) -> OpenF1WebSocketClient:
    client = OpenF1WebSocketClient(
        access_token=access_token,
        on_message=on_message,
        on_connect=on_connect,
        on_disconnect=on_disconnect,
    )

    if auto_subscribe:
        for topic in DEFAULT_TOPICS:
            client.subscribe(topic)

    return client
