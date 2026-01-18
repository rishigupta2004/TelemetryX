import os
import pandas as pd
from typing import Optional, List, Dict, Any
from db.connection import db_connection

DATA_DIR = os.getenv("DATA_DIR", "./data")

class DataLoader:
    @staticmethod
    def get_parquet_path(category: str, year: int, round_num: Optional[int] = None) -> str:
        if round_num:
            return f"{DATA_DIR}/{category}/{year}/{round_num}.parquet"
        return f"{DATA_DIR}/{category}/{year}.parquet"
    
    @staticmethod
    def load_seasons() -> List[Dict[str, Any]]:
        path = f"{DATA_DIR}/seasons.parquet"
        if os.path.exists(path):
            df = db_connection.query_parquet(path)
            return df.to_dict(orient="records")
        return []
    
    @staticmethod
    def load_races(year: int) -> List[Dict[str, Any]]:
        path = DataLoader.get_parquet_path("races", year)
        if os.path.exists(path):
            df = db_connection.query_parquet(path)
            return df.to_dict(orient="records")
        return []
    
    @staticmethod
    def load_drivers(year: int, round_num: int) -> List[Dict[str, Any]]:
        path = DataLoader.get_parquet_path("drivers", year, round_num)
        if os.path.exists(path):
            df = db_connection.query_parquet(path)
            return df.to_dict(orient="records")
        return []
    
    @staticmethod
    def load_laps(year: int, round_num: int) -> pd.DataFrame:
        path = DataLoader.get_parquet_path("laps", year, round_num)
        if os.path.exists(path):
            return db_connection.query_parquet(path)
        return pd.DataFrame()
    
    @staticmethod
    def load_telemetry(year: int, round_num: int, driver: Optional[str] = None) -> pd.DataFrame:
        path = DataLoader.get_parquet_path("telemetry", year, round_num)
        if os.path.exists(path):
            df = db_connection.query_parquet(path)
            if driver:
                df = df[df["driver"] == driver]
            return df
        return pd.DataFrame()

data_loader = DataLoader()
