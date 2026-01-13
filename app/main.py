"""Telemetry X - Streamlit Dashboard."""
import streamlit as st
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.storage.parquet_store import load_laps, load_telemetry, BRONZE_DIR
from src.analysis.queries import get_driver_laps, compare_drivers, get_stint_summary, get_fastest_laps
from src.viz.charts import plot_lap_times, plot_driver_comparison, plot_telemetry, plot_stint_summary, plot_position_chart

st.set_page_config(page_title="Telemetry X", page_icon="🏎️", layout="wide")
st.title("🏎️ Telemetry X")
st.caption("Post-Race F1 Analysis")


def get_available_sessions():
    """Scan bronze dir for available sessions."""
    sessions = []
    if BRONZE_DIR.exists():
        for year_dir in sorted(BRONZE_DIR.iterdir(), reverse=True):
            if year_dir.is_dir() and year_dir.name.isdigit():
                for round_dir in sorted(year_dir.iterdir()):
                    if round_dir.is_dir() and round_dir.name.startswith("round_"):
                        round_num = int(round_dir.name.split("_")[1])
                        sessions.append((int(year_dir.name), round_num))
    return sessions


# Sidebar
st.sidebar.header("Session Selection")
sessions = get_available_sessions()

if not sessions:
    st.warning("No data found. Run data ingestion first.")
    st.code("python -c \"from src.ingestion.fastf1_client import fetch_session; fetch_session(2024, 24, 'R')\"")
    st.stop()

session_options = [f"{year} Round {r}" for year, r in sessions]
selected = st.sidebar.selectbox("Session", session_options)
year, round_num = sessions[session_options.index(selected)]

# Load data
laps = load_laps(year, round_num)
drivers = sorted(laps["Driver"].unique().to_list())

# Tabs
tab1, tab2, tab3, tab4 = st.tabs(["📊 Lap Times", "⚡ Telemetry", "🛞 Strategy", "🏁 Race"])

with tab1:
    st.subheader("Lap Times")
    col1, col2 = st.columns(2)
    d1 = col1.selectbox("Driver 1", drivers, index=0, key="d1_lap")
    d2 = col2.selectbox("Driver 2", drivers, index=min(1, len(drivers)-1), key="d2_lap")
    
    d1_laps = get_driver_laps(year, round_num, d1)
    d2_laps = get_driver_laps(year, round_num, d2)
    
    fig = plot_driver_comparison(d1_laps, d2_laps, d1, d2)
    st.plotly_chart(fig, use_container_width=True)
    
    # Delta stats
    comp = compare_drivers(year, round_num, d1, d2)
    if len(comp) > 0:
        avg_delta = comp["delta"].mean()
        if avg_delta:
            delta_sec = avg_delta / 1e9
            faster = d1 if delta_sec < 0 else d2
            st.metric("Average Delta", f"{abs(delta_sec):.3f}s", f"{faster} faster")

with tab2:
    st.subheader("Telemetry Comparison")
    col1, col2 = st.columns(2)
    t1 = col1.selectbox("Driver 1", drivers, index=0, key="d1_tel")
    t2 = col2.selectbox("Driver 2", drivers, index=min(1, len(drivers)-1), key="d2_tel")
    
    tel_dir = BRONZE_DIR / str(year) / f"round_{round_num:02d}" / "telemetry"
    available_tel = [f.stem for f in tel_dir.glob("*.parquet")] if tel_dir.exists() else []
    
    if t1 in available_tel and t2 in available_tel:
        tel1 = load_telemetry(year, round_num, t1)
        tel2 = load_telemetry(year, round_num, t2)
        fig = plot_telemetry(tel1, tel2, t1, t2)
        st.plotly_chart(fig, use_container_width=True)
    else:
        missing = [d for d in [t1, t2] if d not in available_tel]
        st.info(f"Telemetry not saved for: {', '.join(missing)}. Save with save_telemetry().")

with tab3:
    st.subheader("Tire Strategy")
    driver = st.selectbox("Driver", drivers, key="d_stint")
    stints = get_stint_summary(year, round_num, driver)
    
    col1, col2 = st.columns([2, 1])
    with col1:
        fig = plot_stint_summary(stints, driver)
        st.plotly_chart(fig, use_container_width=True)
    with col2:
        st.dataframe(stints.select(["Stint", "Compound", "laps", "tyre_age"]), hide_index=True)

with tab4:
    st.subheader("Race Position Chart")
    fig = plot_position_chart(laps)
    st.plotly_chart(fig, use_container_width=True)
    
    st.subheader("Fastest Laps")
    fastest = get_fastest_laps(year, round_num)
    st.dataframe(fastest.head(10), hide_index=True)
