"""MLflow experiment tracking for Telemetry X."""
import mlflow
from pathlib import Path

MLFLOW_DIR = Path(__file__).parent.parent.parent / "mlruns"
mlflow.set_tracking_uri(f"file://{MLFLOW_DIR}")


def init_experiment(name: str = "tire_degradation"):
    """Initialize or get MLflow experiment."""
    mlflow.set_experiment(name)
    return mlflow.get_experiment_by_name(name)


def log_training_run(model, X, y, params: dict, metrics: dict, model_name: str = "tire_deg"):
    """Log a training run with model, params, and metrics."""
    with mlflow.start_run():
        # Log parameters
        for key, val in params.items():
            mlflow.log_param(key, val)
        
        # Log metrics
        for key, val in metrics.items():
            mlflow.log_metric(key, val)
        
        # Log model
        mlflow.sklearn.log_model(model, model_name)
        
        # Log training data shape
        mlflow.log_param("n_samples", X.shape[0])
        mlflow.log_param("n_features", X.shape[1])
        
        return mlflow.active_run().info.run_id


def get_best_run(experiment_name: str, metric: str = "rmse", ascending: bool = True):
    """Get best run from experiment by metric."""
    exp = mlflow.get_experiment_by_name(experiment_name)
    if not exp:
        return None
    
    runs = mlflow.search_runs(
        experiment_ids=[exp.experiment_id],
        order_by=[f"metrics.{metric} {'ASC' if ascending else 'DESC'}"],
        max_results=1
    )
    
    if len(runs) == 0:
        return None
    return runs.iloc[0].to_dict()


def load_model_from_run(run_id: str, model_name: str = "tire_deg"):
    """Load model from a specific run."""
    model_uri = f"runs:/{run_id}/{model_name}"
    return mlflow.sklearn.load_model(model_uri)
