import sys
from pathlib import Path

# Ensure `import main` resolves to `backend/main.py` and `import api.*` resolves to `backend/api/*`.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

