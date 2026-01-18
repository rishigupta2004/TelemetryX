from duckdb import duckdb
import pandas as pd
import os
from dotenv import load_dotenv

load_dotenv()

class DuckDBConnection:
    _instance = None
    _cursor = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        db_path = os.getenv("DUCKDB_PATH", "f1_data.duckdb")
        self._conn = duckdb.connect(database=db_path, read_only=False)
        self._cursor = self._conn.cursor()
    
    @property
    def conn(self):
        return self._conn
    
    @property
    def cursor(self):
        return self._cursor
    
    def execute(self, query: str, params: tuple = None):
        if params:
            return self._cursor.execute(query, params)
        return self._cursor.execute(query)
    
    def query_parquet(self, parquet_path: str) -> pd.DataFrame:
        query = f"SELECT * FROM read_parquet('{parquet_path}')"
        return self._conn.execute(query).df()
    
    def close(self):
        if self._conn:
            self._conn.close()

db_connection = DuckDBConnection()
