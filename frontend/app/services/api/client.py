"""API Client - HTTP client with retry logic and connection pooling

Implements the Data Layer from Frontend_ArchitectureOverview.md Part 2, Section 3
Uses httpx for async HTTP requests with automatic retries.
"""

from typing import Any, Dict, Optional, List
import httpx
import structlog
from dataclasses import dataclass
from urllib.parse import urljoin

log = structlog.get_logger()


@dataclass
class APIConfig:
    """API client configuration"""

    base_url: str = "http://localhost:8000"
    timeout: float = 30.0
    max_retries: int = 3
    retry_delay: float = 1.0
    pool_connections: int = 10
    pool_maxsize: int = 10


class APIClient:
    """HTTP API client with retry logic and connection pooling"""

    def __init__(self, config: Optional[APIConfig] = None):
        self.config = config or APIConfig()
        self._client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def connect(self) -> None:
        """Initialize HTTP client with connection pooling"""
        if self._client is None:
            limits = httpx.Limits(
                max_connections=self.config.pool_maxsize,
                max_keepalive_connections=self.config.pool_connections,
            )

            timeout = httpx.Timeout(self.config.timeout)

            self._client = httpx.AsyncClient(
                base_url=self.config.base_url, timeout=timeout, limits=limits, http2=True
            )

            log.info("API client connected", base_url=self.config.base_url)

    async def close(self) -> None:
        """Close HTTP client"""
        if self._client:
            await self._client.aclose()
            self._client = None
            log.info("API client disconnected")

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None,
        retries: int = 0,
    ) -> Any:
        """Make HTTP request with retry logic"""
        if not self._client:
            await self.connect()

        url = urljoin(self.config.base_url, endpoint)

        assert self._client is not None, "HTTP client not connected"

        try:
            response = await self._client.request(
                method=method, url=endpoint, params=params, json=json_data
            )

            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            log.error(
                "HTTP error",
                status_code=e.response.status_code,
                endpoint=endpoint,
                response=e.response.text[:200],
            )
            raise

        except httpx.RequestError as e:
            if retries < self.config.max_retries:
                log.warning(
                    "Request failed, retrying",
                    endpoint=endpoint,
                    error=str(e),
                    attempt=retries + 1,
                    max_retries=self.config.max_retries,
                )
                import asyncio

                await asyncio.sleep(self.config.retry_delay * (retries + 1))
                return await self._request(method, endpoint, params, json_data, retries + 1)
            else:
                log.error("Request failed after max retries", endpoint=endpoint, error=str(e))
                raise

    # High-level API methods
    async def get_seasons(self) -> List[Dict]:
        """Get all available seasons"""
        return await self._request("GET", "/api/seasons")

    async def get_races(self, season: int) -> List[Dict]:
        """Get races for a season"""
        return await self._request("GET", f"/api/seasons/{season}/races")

    async def get_sessions(self, season: int, race: int) -> List[Dict]:
        """Get sessions for a race"""
        return await self._request("GET", f"/api/seasons/{season}/races/{race}/sessions")

    async def get_session_data(self, season: int, race: int, session: str) -> Dict:
        """Get session metadata and results"""
        return await self._request("GET", f"/api/sessions/{season}/{race}/{session}")

    async def get_laps(self, season: int, race: int, session: str) -> List[Dict]:
        """Get lap data for a session"""
        return await self._request(
            "GET", f"/api/laps", {"season": season, "race": race, "session": session}
        )

    async def get_telemetry(
        self, season: int, race: int, session: str, driver: str, lap: Optional[int] = None
    ) -> Dict:
        """Get telemetry data for a driver/lap"""
        params = {"season": season, "race": race, "session": session, "driver": driver}
        if lap:
            params["lap"] = lap
        return await self._request("GET", "/api/telemetry", params)

    async def get_positions(self, season: int, race: int, session: str) -> List[Dict]:
        """Get track positions for all drivers"""
        return await self._request(
            "GET", "/api/positions", {"season": season, "race": race, "session": session}
        )

    async def get_features(self, season: int, race: int, session: str, feature_type: str) -> Any:
        """Get computed features for a session"""
        return await self._request(
            "GET",
            f"/api/features/{feature_type}",
            {"season": season, "race": race, "session": session},
        )

    async def get_strategy_prediction(
        self, season: int, race: int, driver: str, scenario: Optional[Dict] = None
    ) -> Dict:
        """Get strategy prediction for a driver"""
        return await self._request(
            "POST",
            "/api/models/strategy",
            json_data={"season": season, "race": race, "driver": driver, "scenario": scenario},
        )

    async def health_check(self) -> bool:
        """Check API health"""
        try:
            await self._request("GET", "/health")
            return True
        except Exception:
            return False


# Singleton instance
_api_client: Optional[APIClient] = None


def get_api_client(config: Optional[APIConfig] = None) -> APIClient:
    """Get or create API client singleton"""
    global _api_client
    if _api_client is None:
        _api_client = APIClient(config)
    return _api_client


def reset_api_client() -> None:
    """Reset API client (for testing)"""
    global _api_client
    _api_client = None
