"""Tire degradation prediction model."""
import polars as pl
import pickle
from pathlib import Path
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBRegressor

MODEL_DIR = Path(__file__).parent.parent.parent / "models"
MODEL_DIR.mkdir(parents=True, exist_ok=True)


def prepare_training_data(laps: pl.DataFrame) -> tuple:
    """Prepare features and target from lap data."""
    # Filter valid laps
    df = laps.filter(
        (pl.col("LapTime").is_not_null()) &
        (pl.col("TyreLife").is_not_null()) &
        (pl.col("Compound").is_not_null())
    )
    
    # Features: TyreLife, Compound (encoded), Stint
    features = df.select(["TyreLife", "Compound", "Stint"]).to_pandas()
    
    # Encode compound
    le = LabelEncoder()
    features["Compound"] = le.fit_transform(features["Compound"].astype(str))
    
    # Target: LapTime - convert duration to float seconds
    lap_times = df.select("LapTime").to_pandas()["LapTime"]
    # Handle timedelta or int (nanoseconds)
    if hasattr(lap_times.iloc[0], 'total_seconds'):
        target = lap_times.apply(lambda x: x.total_seconds()).values
    else:
        target = (lap_times / 1e9).astype(float).values
    
    return features.values.astype(float), target, le


def train_model(X, y):
    """Train XGBoost model for tire degradation."""
    model = XGBRegressor(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        random_state=42,
    )
    model.fit(X, y)
    return model


def save_model(model, encoder, name: str = "tire_deg"):
    """Save model and encoder."""
    with open(MODEL_DIR / f"{name}_model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open(MODEL_DIR / f"{name}_encoder.pkl", "wb") as f:
        pickle.dump(encoder, f)


def load_model(name: str = "tire_deg"):
    """Load model and encoder."""
    with open(MODEL_DIR / f"{name}_model.pkl", "rb") as f:
        model = pickle.load(f)
    with open(MODEL_DIR / f"{name}_encoder.pkl", "rb") as f:
        encoder = pickle.load(f)
    return model, encoder


def predict_lap_time(model, encoder, tyre_life: int, compound: str, stint: int) -> float:
    """Predict lap time for given tire conditions."""
    compound_encoded = encoder.transform([compound])[0]
    X = [[tyre_life, compound_encoded, stint]]
    return model.predict(X)[0]


def predict_degradation_curve(model, encoder, compound: str, stint: int, max_laps: int = 30) -> list:
    """Predict lap times for entire stint."""
    predictions = []
    for lap in range(1, max_laps + 1):
        pred = predict_lap_time(model, encoder, lap, compound, stint)
        predictions.append({"lap": lap, "predicted_time": pred})
    return predictions
