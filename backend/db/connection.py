import duckdb
import pandas as pd
import os
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


class DuckDBConnection:
    """Singleton connection pool for DuckDB - reused across all requests."""

    _instance = None
    _conn = None
    _cursor = None
    _initialized = False
    _parquet_conn = None  # Separate read-only connection for parquet queries

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _initialize(self):
        """Lazy initialization - connect once and reuse"""
        if not self._initialized:
            db_path = os.getenv("DUCKDB_PATH", "f1_data.duckdb")
            data_root = os.getenv(
                "TELEMETRYX_DATA_ROOT",
                "/Volumes/Space/PROJECTS/TelemetryX/backend/etl/data",
            )

            try:
                # Main connection for DuckDB tables
                self._conn = duckdb.connect(database=db_path, read_only=False)
                logger.info(f"DuckDB connection established: {db_path}")
            except Exception as e:
                logger.warning(
                    f"DuckDB write lock unavailable: {e}; falling back to read-only"
                )
                self._conn = duckdb.connect(database=db_path, read_only=True)

            self._cursor = self._conn.cursor()
            self._initialized = True

    def _initialize_parquet_conn(self):
        """Separate read-only connection for parquet queries (avoids lock contention)"""
        needs_reconnect = self._parquet_conn is None
        if not needs_reconnect:
            try:
                self._parquet_conn.execute("SELECT 1").fetchone()
            except Exception:
                needs_reconnect = True

        if needs_reconnect:
            try:
                self._parquet_conn = duckdb.connect(database=":memory:", read_only=False)
                logger.info("DuckDB parquet connection (in-memory) established")
            except Exception as e:
                logger.error(f"Failed to create parquet connection: {e}")
                self._parquet_conn = self._conn  # Fallback to main connection
        return self._parquet_conn

    @property
    def conn(self):
        """Get main connection (for DuckDB tables)"""
        self._initialize()
        return self._conn

    @property
    def cursor(self):
        """Get cursor from main connection"""
        self._initialize()
        return self._cursor

    @property
    def parquet_conn(self):
        """Get parquet-optimized connection (read-only, separate from main)"""
        return self._initialize_parquet_conn()

    def execute(self, query: str, params: tuple = None):
        """Execute query on main connection"""
        self._initialize()
        if params:
            return self._cursor.execute(query, params)
        return self._cursor.execute(query)

    def query_parquet(self, parquet_path: str) -> pd.DataFrame:
        """Query parquet file using optimized read-only connection"""
        conn = self.parquet_conn
        query = "SELECT * FROM read_parquet(?)"
        return conn.execute(query, [parquet_path]).df()

    def execute_parquet(self, query: str, params: tuple = None):
        """Execute query on parquet connection (read-only, no locks)"""
        conn = self.parquet_conn
        cursor = conn.cursor()
        if params:
            return cursor.execute(query, params)
        return cursor.execute(query)

    def close(self):
        """Close all connections"""
        if self._conn:
            try:
                self._conn.close()
            except Exception:
                pass
            self._initialized = False
            self._conn = None
            self._cursor = None
        if self._parquet_conn:
            try:
                self._parquet_conn.close()
            except Exception:
                pass
            self._parquet_conn = None


# Create singleton instance (lazy initialization)
db_connection = DuckDBConnection()


def get_db_connection():
    """Helper function to get the singleton connection"""
    return db_connection
