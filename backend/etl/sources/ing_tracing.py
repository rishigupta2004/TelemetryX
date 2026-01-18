import requests
import pandas as pd
import os
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List
import zipfile
import io


class TracingInsightsClient:
    """Client for TracingInsights GitHub backup data."""
    
    GITHUB_REPO = "theOehrly/Fast-F1-Backup"
    RAW_BASE = "https://raw.githubusercontent.com"
    API_BASE = "https://api.github.com"
    
    def __init__(self, token: str = None):
        self.session = requests.Session()
        headers = {"Accept": "application/vnd.github.v3+json"}
        if token:
            headers["Authorization"] = f"token {token}"
        self.session.headers.update(headers)
        self.rate_limit_remaining = None
    
    def _get(self, url: str) -> Optional[requests.Response]:
        """Make GET request with rate limit handling."""
        try:
            response = self.session.get(url, timeout=30)
            self.rate_limit_remaining = response.headers.get("X-RateLimit-Remaining")
            
            if response.status_code == 403 and "rate limit" in response.text.lower():
                reset_time = response.headers.get("X-RateLimit-Reset")
                if reset_time:
                    wait_time = int(reset_time) - int(datetime.now().timestamp())
                    if wait_time > 0:
                        print(f"GitHub rate limited. Waiting {wait_time} seconds...")
                        time.sleep(wait_time)
                        return self._get(url)
            response.raise_for_status()
            return response
        except requests.RequestException as e:
            print(f"GitHub API error: {e}")
            return None
    
    def get_available_races(self, year: int) -> List[Dict]:
        """Get list of available races for a year."""
        url = f"{self.API_BASE}/repos/{self.GITHUB_REPO}/contents/fastf1_data/{year}"
        response = self._get(url)
        if response and response.status_code == 200:
            contents = response.json()
            return [item for item in contents if item["type"] == "dir"]
        return []
    
    def download_race_data(
        self,
        year: int,
        race: str,
        session_type: str = "R"
    ) -> Optional[bytes]:
        """
        Download race data zip from GitHub.
        
        Args:
            year: F1 season year
            race: Race name folder
            session_type: Session type (R, Q, FP1, FP2, FP3)
        
        Returns:
            Zip file bytes or None
        """
        url = (
            f"{self.RAW_BASE}/{self.GITHUB_REPO}/main/fastf1_data/"
            f"{year}/{race}/{session_type}.zip"
        )
        response = self._get(url)
        if response and response.status_code == 200:
            return response.content
        return None
    
    def extract_zip(self, zip_data: bytes) -> Dict[str, pd.DataFrame]:
        """Extract zip data and convert to DataFrames."""
        result = {}
        try:
            with zipfile.ZipFile(io.BytesIO(zip_data)) as zf:
                for filename in zf.namelist():
                    if filename.endswith(".parquet"):
                        try:
                            with zf.open(filename) as f:
                                df = pd.read_parquet(f)
                                key = filename.replace(".parquet", "").replace("/", "_")
                                result[key] = df
                        except Exception as e:
                            print(f"Failed to read {filename}: {e}")
        except Exception as e:
            print(f"Failed to extract zip: {e}")
        return result


def ingest_tracing(
    year: int,
    race: str,
    session_type: str = "R",
    github_token: str = None
) -> Dict[str, pd.DataFrame]:
    """
    Download data from TracingInsights GitHub backup.
    
    Args:
        year: F1 season year
        race: Race name (e.g., 'Bahrain_Grand_Prix')
        session_type: Session type (R, Q, FP1, FP2, FP3)
        github_token: Optional GitHub token for higher rate limits
    
    Returns:
        dict with DataFrames for each data type
    """
    client = TracingInsightsClient(github_token)
    
    zip_data = client.download_race_data(year, race, session_type)
    
    if zip_data is None:
        print(f"TracingInsights: No data found for {year} {race} {session_type}")
        return {}
    
    result = client.extract_zip(zip_data)
    print(f"TracingInsights: Extracted {len(result)} files")
    for key, df in result.items():
        print(f"  {key}: {len(df)} rows")
    
    return result


if __name__ == "__main__":
    client = TracingInsightsClient()
    races = client.get_available_races(2023)
    print(f"Available races in 2023: {[r['name'] for r in races[:5]]}")
    
    data = ingest_tracing(2023, "Bahrain_Grand_Prix", "R")
    if data:
        print(f"\nTracingInsights ingestion complete. Keys: {list(data.keys())}")
