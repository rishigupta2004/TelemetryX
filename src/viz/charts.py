"""Plotly visualizations for F1 data."""
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import polars as pl


def plot_lap_times(laps: pl.DataFrame, driver: str) -> go.Figure:
    """Line chart of lap times for a driver."""
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=laps["LapNumber"].to_list(),
        y=[t / 1e9 for t in laps["LapTime"].to_list()],  # ns to seconds
        mode="lines+markers",
        name=driver,
        line=dict(width=2),
        marker=dict(size=4),
    ))
    fig.update_layout(
        title=f"Lap Times - {driver}",
        xaxis_title="Lap",
        yaxis_title="Time (seconds)",
        hovermode="x unified",
    )
    return fig


def plot_driver_comparison(d1_laps: pl.DataFrame, d2_laps: pl.DataFrame, d1: str, d2: str) -> go.Figure:
    """Compare lap times of two drivers."""
    fig = go.Figure()
    
    for laps, driver, color in [(d1_laps, d1, "red"), (d2_laps, d2, "blue")]:
        fig.add_trace(go.Scatter(
            x=laps["LapNumber"].to_list(),
            y=[t / 1e9 if t else None for t in laps["LapTime"].to_list()],
            mode="lines",
            name=driver,
            line=dict(color=color, width=2),
        ))
    
    fig.update_layout(
        title=f"Lap Comparison: {d1} vs {d2}",
        xaxis_title="Lap",
        yaxis_title="Lap Time (seconds)",
        hovermode="x unified",
    )
    return fig


def plot_telemetry(tel1: pl.DataFrame, tel2: pl.DataFrame, d1: str, d2: str) -> go.Figure:
    """4-panel telemetry comparison: Speed, Throttle, Brake, Gear."""
    fig = make_subplots(rows=4, cols=1, shared_xaxes=True, vertical_spacing=0.05,
                        subplot_titles=("Speed", "Throttle", "Brake", "Gear"))
    
    traces = [("Speed", 1), ("Throttle", 2), ("Brake", 3), ("nGear", 4)]
    
    for col, row in traces:
        if col in tel1.columns:
            fig.add_trace(go.Scatter(x=tel1["Distance"].to_list(), y=tel1[col].to_list(),
                                     name=f"{d1}", line=dict(color="red"), showlegend=(row==1)), row=row, col=1)
        if col in tel2.columns:
            fig.add_trace(go.Scatter(x=tel2["Distance"].to_list(), y=tel2[col].to_list(),
                                     name=f"{d2}", line=dict(color="blue"), showlegend=(row==1)), row=row, col=1)
    
    fig.update_layout(height=800, title=f"Telemetry: {d1} vs {d2}", hovermode="x unified")
    fig.update_xaxes(title_text="Distance (m)", row=4, col=1)
    return fig


def plot_stint_summary(stints: pl.DataFrame, driver: str) -> go.Figure:
    """Horizontal bar chart of stint durations by compound."""
    colors = {"SOFT": "#FF0000", "MEDIUM": "#FFFF00", "HARD": "#FFFFFF", 
              "INTERMEDIATE": "#00FF00", "WET": "#0000FF"}
    
    fig = go.Figure()
    for row in stints.iter_rows(named=True):
        fig.add_trace(go.Bar(
            x=[row["laps"]],
            y=[f"Stint {int(row['Stint'])}"],
            orientation="h",
            name=row["Compound"],
            marker_color=colors.get(row["Compound"], "#888888"),
            text=f"{row['Compound']} ({row['laps']} laps)",
            textposition="inside",
        ))
    
    fig.update_layout(
        title=f"Tire Strategy - {driver}",
        xaxis_title="Laps",
        barmode="stack",
        showlegend=False,
    )
    return fig


def plot_position_chart(laps: pl.DataFrame) -> go.Figure:
    """Position chart showing all drivers throughout race."""
    fig = go.Figure()
    
    drivers = laps["Driver"].unique().to_list()
    for driver in drivers:
        d_laps = laps.filter(pl.col("Driver") == driver)
        fig.add_trace(go.Scatter(
            x=d_laps["LapNumber"].to_list(),
            y=d_laps["Position"].to_list(),
            mode="lines",
            name=driver,
        ))
    
    fig.update_layout(
        title="Race Position Chart",
        xaxis_title="Lap",
        yaxis_title="Position",
        yaxis=dict(autorange="reversed"),  # P1 at top
        hovermode="x unified",
    )
    return fig
