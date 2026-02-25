import duckdb
import pandas as pd
import os
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

class DuckDBConnection:
    _instance = None
    _conn = None
    _cursor = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def _initialize(self):
        """Lazy initialization - only connect when first accessed"""
        if not self._initialized:
            db_path = os.getenv("DUCKDB_PATH", "f1_data.duckdb")
            try:
                self._conn = duckdb.connect(database=db_path, read_only=False)
            except Exception:
                # In tests and multi-process usage, the writable lock may be held by
                # another process; fall back to read-only to preserve API availability.
                logger.warning("DuckDB write lock unavailable for %s; falling back to read-only", db_path)
                self._conn = duckdb.connect(database=db_path, read_only=True)
            self._cursor = self._conn.cursor()
            self._initialized = True
    
    @property
    def conn(self):
        self._initialize()  # Ensure initialized before access
        return self._conn
    
    @property
    def cursor(self):
        self._initialize()  # Ensure initialized before access
        return self._cursor
    
    def execute(self, query: str, params: tuple = None):
        self._initialize()  # Ensure initialized before use
        if params:
            return self._cursor.execute(query, params)
        return self._cursor.execute(query)
    
    def query_parquet(self, parquet_path: str) -> pd.DataFrame:
        self._initialize()  # Ensure initialized before use
        query = "SELECT * FROM read_parquet(?)"
        return self._conn.execute(query, [parquet_path]).df()
    
    def close(self):
        if self._conn:
            self._conn.close()
            self._initialized = False

# Create singleton instance (but don't initialize connection yet)
db_connection = DuckDBConnection()
