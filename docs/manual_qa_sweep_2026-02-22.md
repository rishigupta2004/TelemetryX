# Manual QA Sweep - 2026-02-22

## Scope
- Timing Tower
- Track Map
- Telemetry
- Weather
- Pit Strategy
- Race Control
- Standings
- Driver/Team Profiles

## Checklist
- [x] Session load, playback seek, and tab-switch flows remain functional.
- [x] Race/quali/sprint smoke flows pass with telemetry + positions seek windows.
- [x] Backend test suite passes after integration.
- [x] Frontend production build passes after integration.
- [x] Timing data ordering/gap behavior still valid under lap/interval updates.
- [x] Track map renders with live dots, pit-lane blending, and confidence/source badges.
- [x] Telemetry supports live and replay with enhanced multi-panel chart engine.
- [x] Weather and Race Control render from session data.
- [x] Pit strategy view remains available with no route regressions.
- [x] Dedicated standings and profiles pages load from backend APIs.

## Mismatches Found And Fixed
1. Race control feed dropped valid historical messages due to 90s TTL.
- Fix: removed TTL-based expiry and kept chronological latest window.
- Files: `frontend-electron/src/components/RaceControlFeed.tsx`

2. Track map draw loop was reinitialized on hover/selection updates, increasing redraw churn.
- Fix: moved hover/primary/compare state into refs with targeted redraw trigger.
- Files: `frontend-electron/src/components/TrackMap.tsx`

3. Telemetry charts could render blank when chart lifecycle was incomplete.
- Fix: restored full chart init/update/resize flow and marker redraw behavior.
- Files: `frontend-electron/src/components/UPlotChart.tsx`

4. Missing season standings, profiles, and circuit-fact endpoints.
- Fix: added real-data insights router with cached standings/profiles/circuit facts (Formula1.com extraction + fallback).
- Files: `backend/api/routers/insights.py`, `backend/main.py`

5. No dedicated standings and profiles pages in UI navigation.
- Fix: added `StandingsView`, `ProfilesView`, and sidebar/app routing integration.
- Files: `frontend-electron/src/views/StandingsView.tsx`, `frontend-electron/src/views/ProfilesView.tsx`, `frontend-electron/src/App.tsx`, `frontend-electron/src/components/Sidebar.tsx`

6. Telemetry style parity gap for immersive stacked compare charts.
- Fix: added ECharts-based synchronized multi-panel telemetry with shared crosshair/zoom and kept uPlot fallback.
- Files: `frontend-electron/src/components/TelemetryMultiChart.tsx`, `frontend-electron/src/views/TelemetryView.tsx`

7. Track immersion lacked explicit circuit facts panel.
- Fix: added circuit insights card in Track view using backend circuit insights API.
- Files: `frontend-electron/src/views/TrackView.tsx`, `frontend-electron/src/api/client.ts`, `frontend-electron/src/types/index.ts`

8. Driver profile depth gap (age/nationality/biographical metadata missing).
- Fix: added cached Jolpica enrichment in insights backend and surfaced fields in profiles UI.
- Files: `backend/api/routers/insights.py`, `frontend-electron/src/views/ProfilesView.tsx`, `frontend-electron/src/types/index.ts`

9. New insights APIs lacked dedicated regression coverage.
- Fix: added endpoint tests for standings/profiles/circuit insights (including Formula1 fact extraction path).
- Files: `backend/tests/test_insights_router.py`

10. Features workspace lacked Formula-Timer-style tyre strategy timeline immersion.
- Fix: added tyre strategy timeline visualization from real lap/compound transitions.
- Files: `frontend-electron/src/views/FeaturesView.tsx`

11. Features race-pace workspace lacked direct circuit facts context.
- Fix: added circuit facts integration using insights API (length, distance, laps, first GP).
- Files: `frontend-electron/src/views/FeaturesView.tsx`

12. Features race-pace and standings progression relied on static SVG rendering only.
- Fix: migrated these panels to immersive ECharts renderers for better interaction and style parity.
- Files: `frontend-electron/src/components/FeaturesECharts.tsx`, `frontend-electron/src/views/FeaturesView.tsx`

13. Features ECharts migration increased base `FeaturesView` chunk size too much.
- Fix: lazy-loaded chart components from `FeaturesECharts` with `React.Suspense` placeholders.
- Files: `frontend-electron/src/views/FeaturesView.tsx`

14. Live performance budget visibility required outside debug-env-only HUD.
- Fix: added a production-available toggleable render budget panel (fps floor, frame p95/p99, UI tick p95) persisted via local storage.
- Files: `frontend-electron/src/components/RenderBudgetPanel.tsx`, `frontend-electron/src/App.tsx`

15. ECharts telemetry could overwork render path on dense lap samples.
- Fix: added metric-level decimation (transition-preserving for stepped channels + extrema capture for analog channels) and progressive/large-mode tuning.
- Files: `frontend-electron/src/components/TelemetryMultiChart.tsx`

16. Feature ECharts series lacked progressive tuning for heavy scenarios.
- Fix: enabled progressive/large-mode tuning on race-pace, standings progression, and heatmap renderers.
- Files: `frontend-electron/src/components/FeaturesECharts.tsx`

17. Renderer-swap experiment (Canvas -> SVG) increased lazy runtime payload.
- Fix: reverted renderer swap to preserve better bundle/runtime baseline (`installCanvasRenderer` remained smaller than `installSVGRenderer` in this build profile).
- Files: `frontend-electron/src/components/TelemetryMultiChart.tsx`, `frontend-electron/src/components/FeaturesECharts.tsx`

18. Features route still loaded chart-heavy ECharts assets despite only needing core analytical visuals.
- Fix: replaced Features route ECharts panels with lightweight SVG/CSS-native charts (`RacePaceLiteChart`, `SeasonStandingsLiteChart`, `StandingsHeatmapLiteChart`) while keeping identical data contracts.
- Files: `frontend-electron/src/components/FeaturesLiteCharts.tsx`, `frontend-electron/src/views/FeaturesView.tsx`

19. Telemetry opened in heavy chart mode by default, increasing live-playback render risk at high speed.
- Fix: made chart engine preference persistent with lightweight default (`UPLOT`) and added explicit high-speed (8x+) live playback performance hint when `ECHARTS` is selected.
- Files: `frontend-electron/src/views/TelemetryView.tsx`

20. Driver/Team profiles lacked deep dossier detail and full-page focus mode.
- Fix: rebuilt Profiles workspace into dedicated dossier pages (driver mode + team mode) with searchable selector, expanded stat blocks, achievements, records, best moments, best race detail, and richer image fallback chain.
- Files: `frontend-electron/src/views/ProfilesView.tsx`, `frontend-electron/src/types/index.ts`

21. Profile backend lacked richer career-level metrics and high-quality image enrichment hooks.
- Fix: extended insights profile builder with career-rate metrics, structured achievements/records, multi-moment extraction, optional Jolpica career enrichment cache, and Wikipedia image enrichment cache for drivers/teams.
- Files: `backend/api/routers/insights.py`

## Residual Gaps
- Some long-form historical achievements still depend on local data completeness; external enrichment currently covers modern driver identity fields (age, nationality, DOB, profile link) where available.
- ECharts enhanced telemetry is code-split and loaded on demand to protect base bundle size; advanced chart loads when telemetry page uses the ECharts engine.
- Total visual payload is richer and includes a large lazy telemetry chart chunk; continue monitoring production bundle budgets when adding new chart-heavy panels.
- ECharts runtime chunk remains large (`installCanvasRenderer-*.js`); currently lazy loaded, but future chart additions should prefer shared dynamic imports to avoid duplicate heavyweight runtime chunks.
- SVG renderer trial did not reduce payload in this app build and was reverted; keep Canvas path until a measured win exists.
- Telemetry enhanced mode still carries a large lazy chart runtime payload; this is now isolated to telemetry chart chunk (`TelemetryMultiChart-*.js`) after Features decoupling.
- Full dossier profile UI raised main renderer chunk modestly due additional detail rendering logic; no runtime gate regressions were detected.
- `FeaturesView` split improved after lazy loading charts: chart logic moved to separate `FeaturesECharts-*.js` chunk instead of inflating base `FeaturesView` payload.

## Verification Results
- `npm run build` (frontend-electron): pass.
- `PYTHONPATH=$PWD/backend python -m pytest backend/tests -q`: pass (`48 passed`).
- `PYTHONPATH=$PWD/backend python -m pytest backend/tests -q`: pass (`51 passed`).
- `bash scripts/run_smokes_once.sh`: pass (all gate checks passed; one expected SR compare warning for insufficient comparable laps).
- `npm run build` (frontend-electron): pass (`FeaturesView-*.js` now ~122.76 kB with no separate `FeaturesECharts` lazy chunk; telemetry runtime now consolidated in `TelemetryMultiChart-*.js` ~1,363.24 kB).
- `bash scripts/run_smokes_once.sh`: pass (all gate checks passed; one expected SR compare warning for insufficient comparable laps).
- `npm run build` (frontend-electron): pass (telemetry engine preference update; chunk profile stable: `TelemetryMultiChart-*.js` ~1,363.24 kB lazy).
- `bash scripts/run_smokes_once.sh`: pass (all gate checks passed; one expected SR compare warning for insufficient comparable laps).
- `PYTHONPATH=$PWD/backend python -m pytest backend/tests -q`: pass (`51 passed`).
- `npm run build` (frontend-electron): pass (profile dossier expansion; `index-*.js` ~957.4 kB, `FeaturesView-*.js` ~122.76 kB, `TelemetryMultiChart-*.js` ~1,363.24 kB lazy).
- `bash scripts/run_smokes_once.sh`: pass (all gate checks passed; one expected SR compare warning for insufficient comparable laps).
- `bash scripts/run_smokes_once.sh`: pass (all gate checks passed; one expected SR compare warning for insufficient comparable laps).
- `npm run build` (frontend-electron): pass (`index-*.js` ~949 kB, `TelemetryMultiChart-*.js` ~8.34 kB, `FeaturesView-*.js` ~114.26 kB, `FeaturesECharts-*.js` ~107.48 kB, lazy `installCanvasRenderer-*.js` ~1,359.17 kB).
- `PYTHONPATH=$PWD/backend python -m pytest backend/tests -q`: pass (`51 passed`).
- `bash scripts/run_smokes_once.sh`: pass (all gate checks passed; one expected SR compare warning for insufficient comparable laps).
