# E7 Backend Engineer 1 - Wave 1 Announcement

## Files/Modules Being Touched
- Backend API routers (particularly in `backend/api/routers/`): 
  - `telemetry.py` - for telemetry data endpoints
  - `positions.py` - for driver position data
  - `laps.py` - for lap timing data
  - `streams.py` - for real-time data streaming
  - `metrics.py` - for performance metrics
- Data pipeline components in `backend/etl/`
- Database interface in `backend/db/`
- Main application in `backend/main.py`

## Data Interfaces
### Dependencies:
- Raw data ingestion from source directories (specified in data pipeline)
- Database schemas in `backend/db/` and `backend/models.py`
- Existing API contracts defined in routers

### Provides:
- Real-time telemetry data streams (speed, throttle, brake, gear, DRS)
- Driver timing and position data with interval/gap calculations
- Session state information (FP1/2/3, Q1/2/3, Race, session clock)
- Weather data (track temp, air temp, humidity, rain probability)
- Race control messages and flag states
- Pit stop data and tire compound history
- Optimized data endpoints for UI consumption with appropriate caching

## Expectations from Other Agents
- From E2-E6 (UI Agents): Specific data format requirements for each UI component (Timing Tower, Track Map, Telemetry Displays, etc.)
- From E9 (Integration Engineer): Coordination on data-binding interfaces and validation of end-to-end data flow
- From E8 (ML Engineer): Any ML prediction data formats needed for strategy panels
- From E10 (Performance Engineer): Performance targets and feedback on API latency

## Wave 1 Goals
1. Audit current data pipelines for real-time telemetry, timing, and session data
2. Identify and optimize bottlenecks in data flow to meet <2ms latency target
3. Ensure all necessary data fields are available through API endpoints
4. Prepare backend for increased data fidelity demands from UI upgrades
5. Coordinate with E9 to verify data-binding correctness

Ready to assist other agents with data pipeline or API changes needed for UI upgrades.