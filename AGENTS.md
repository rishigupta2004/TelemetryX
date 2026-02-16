§1 — FALLBACK-FIRST PRINCIPLE (APPLIES TO ALL AGENTS, ALL TASKS)
text

RULE: The current state of the application (UI, backend, data, ML pipeline)
is the PROTECTED BASELINE. Before ANY modification:

1. Snapshot/preserve the current working state of the file(s) being touched.
2. All changes are ADDITIVE and REVERSIBLE.
3. If ANY change causes:
   - A runtime error
   - A visual regression (flicker, layout break, missing data)
   - A data pipeline disruption
   - A performance degradation beyond thresholds (see §7)
   → IMMEDIATELY revert to the baseline state. Do NOT attempt to fix forward
     without reverting first.
4. No agent may delete, overwrite, or restructure existing working code
   without first confirming the replacement works in isolation.
§2 — AGENT ASSIGNMENTS (FIXED ROLES — NO ROLE DRIFT)
Agent	Role	Scope
E1	UI Lead	Overall UI architecture, layout system, component hierarchy, responsiveness. Owns the UI shell.
E2	UI — Timing Tower	Timing Tower component: rendering, animations, live data binding, scroll behavior, row updates.
E3	UI — Track Map / Visualization	Track/map component: SVG/Canvas rendering, car position plotting, sector markers, real-time position updates.
E4	UI — Telemetry Displays	Telemetry panels: throttle, brake, speed, gear, DRS — all charts/graphs bound to live data streams.
E5	UI — Weather & Race Control	Weather widget and Race Control message feed: real-time updates, flag states, notifications.
E6	UI — Pit Strategy & Remaining Features	Pit strategy panel, tire compound tracking, stint history, plus any remaining feature board items not covered by E2–E5.
E7	Backend Engineer 1	Data pipeline, API layer, data ingestion, real-time data flow from source directories (backend/, data/, ml/ or equivalent). Data accuracy and integrity.
E8	Backend Engineer 2	ML models, prediction pipelines, data transformations, feature computation. Quality and efficiency improvements.
E9	Integration & Data-Binding Engineer	Sole focus: ensuring every UI component (E2–E6) is correctly wired to real backend data (E7–E8). No component may display mock, placeholder, hardcoded, or stale data.
E10	Performance & QA Engineer	Performance profiling, latency enforcement (<2ms), FPS enforcement (60–90fps), bundle analysis, render optimization, and real smoke test validation (see §8).
text

RULE: No agent may work outside their assigned scope without explicit
coordination (see §4). No agent may redefine their role. If an agent
finishes early, they MUST assist other agents within the coordination
protocol — they do NOT stop or go idle.
§3 — FEATURE BOARD COVERAGE (MANDATORY DEPTH REQUIREMENT)
The application has 8 feature board categories. Each must be assigned to at least one agent (E2–E6 + E9 cover these). The binding rule:

text

RULE: Every feature in the catalog must be implemented to FUNCTIONAL DEPTH,
defined as:

✅ FUNCTIONAL DEPTH means:
   - The component renders correctly in the UI
   - The component is bound to REAL data from the backend/data layer
   - User interactions (click, hover, scroll, filter) produce correct responses
   - Data updates in real-time reflect visually within 1 render cycle
   - The component handles empty states, error states, and loading states
   - The component does NOT flicker, ghost-render, or show stale data

❌ NOT ACCEPTABLE:
   - A component that "looks right" but displays static/mock data
   - A component that renders once but doesn't update
   - A component that passes a unit test but visually malfunctions
   - A component that works in isolation but breaks in the full app context
Specific deep-work requirements:

Feature	Minimum Requirements
Timing Tower	Live driver positions, intervals updating per sector/lap, proper sort order, gap calculations from real timing data, smooth row transitions (no flicker)
Track Map	Real car positions mapped to track coordinates, sector coloring, position updates at data frequency, correct track layout for selected circuit
Telemetry	Real telemetry channels bound to charts, correct units, proper time-series rendering, synchronized across channels
Weather	Real weather data (track temp, air temp, humidity, rain probability), updates reflected immediately, forecast display if available
Race Control	Real race control messages, flags, penalties, VSC/SC states, chronological feed
Pit Strategy	Real pit stop data, tire compound history, stint lengths, predicted strategies if ML model provides them
Driver/Team Info	Correct metadata, headshots/logos if applicable, linked to timing data
Session State	Correct session type (FP1/2/3, Q1/2/3, Race), session clock, status indicators
§4 — COORDINATION PROTOCOL (MANDATORY INTER-AGENT COMMUNICATION)
text

RULE: All agents operate as a SINGLE COORDINATED TEAM, not as isolated workers.
The following communication patterns are MANDATORY, not optional:

PROTOCOL:
1. Before any agent begins work, they must ANNOUNCE:
   - What files/modules they are touching
   - What data interfaces they depend on
   - What they expect from other agents

2. CROSS-DOMAIN DEPENDENCY RESOLUTION:
   - If a UI agent (E2–E6) needs data in a specific format → they MUST
     coordinate with E7 or E8 BEFORE building the component.
   - If a backend agent (E7–E8) changes a data schema or API contract →
     they MUST notify ALL UI agents and E9 IMMEDIATELY.
   - E9 (Integration Engineer) is the BRIDGE. Any data-binding question
     routes through E9.

3. BLOCKING ISSUES:
   - If an agent is blocked, they MUST explicitly request help from the
     relevant agent(s).
   - Other agents MUST respond to blocking requests before continuing
     their own non-critical work.
   - No agent may say "not my scope" to a blocking issue that affects
     the integrated app.

4. CONFLICT RESOLUTION:
   - If two agents need to modify the same file → they coordinate to
     avoid conflicts. One writes, the other reviews, then they swap.
   - E1 (UI Lead) has final say on UI conflicts.
   - E7 has final say on data/API conflicts.

EXAMPLE SCENARIO (MANDATORY MENTAL MODEL):
  E2 (Timing Tower) finds that driver gap data isn't flowing to the
  component. E2 does NOT:
    ❌ Create mock data to make it "look right"
    ❌ Skip the feature and move on
    ❌ Write a test that passes with fake data
  E2 DOES:
    ✅ Message E7/E8: "I need driver interval/gap data exposed at
       [endpoint/interface]. Current format is X, I need Y."
    ✅ E7/E8 responds with the data contract or implements the pipeline
    ✅ E9 validates the binding works end-to-end
    ✅ E10 confirms no performance regression
§5 — BACKEND / DATA / ML RULES (E7, E8)
text

RULE: The three core directories (backend/, data/, ml/ — or their equivalents
in this project) are PROTECTED ZONES.

1. All improvements must be QUALITY and EFFICIENCY improvements:
   - Faster data parsing
   - More accurate ML predictions
   - Cleaner data transformations
   - Better error handling
   - Reduced memory usage

2. NO structural changes to data schemas without:
   a. Documenting the before/after schema
   b. Updating ALL consumers (UI components)
   c. Verifying the full pipeline works end-to-end
   d. Having E9 validate all bindings still work

3. ZERO DATA DISCREPANCY TOLERANCE:
   - If raw data says Driver X is P3, the UI MUST show P3.
   - If the ML model predicts a 2-stop strategy, the pit panel MUST
     reflect a 2-stop strategy.
   - Any mismatch between data source and UI display is a P0 bug that
     must be fixed before any other work continues.

4. FALLBACK: If any backend/ML change causes data to stop flowing or
   become incorrect → REVERT IMMEDIATELY to baseline. No exceptions.
§6 — UI ENHANCEMENT RULES (E1–E6)
text

RULE: "Take the UI to the next level" means:

DO:
  ✅ Improve visual polish (spacing, typography, color consistency, contrast)
  ✅ Add smooth transitions/animations (CSS/framework-native, NOT JS hacks)
  ✅ Improve information density without clutter
  ✅ Ensure responsive behavior if applicable
  ✅ Use the EXISTING tech stack — no new framework additions without
     explicit approval
  ✅ Ensure every visual element has a DATA PURPOSE (no decorative-only
     additions that hurt performance)

DO NOT:
  ❌ Add gimmicky animations that serve no functional purpose
  ❌ Introduce new dependencies/libraries without justification
  ❌ Change the fundamental layout/navigation paradigm
  ❌ Sacrifice performance for aesthetics (E10 will enforce this)
  ❌ Break existing working functionality for visual improvement
  ❌ Create components that look good but aren't wired to real data
§7 — PERFORMANCE TARGETS (E10 ENFORCES, ALL AGENTS COMPLY)
text

HARD TARGETS (NON-NEGOTIABLE):
  - End-to-end data latency:  < 2ms (from data receipt to UI render)
  - Frame rate:               60–90 FPS sustained (no drops below 55)
  - Initial load time:        Maintain or improve current baseline
  - Memory:                   No memory leaks, stable heap over 30min run
  - Bundle size:              No more than 5% increase from baseline

E10 RESPONSIBILITIES:
  1. Profile every component after integration
  2. Identify and flag any agent's code that violates targets
  3. That agent MUST fix the violation before their work is considered done
  4. E10 may REJECT any merge/change that degrades performance

ALL AGENTS MUST:
  - Avoid unnecessary re-renders
  - Use virtualization for long lists (e.g., Timing Tower with 20+ rows)
  - Debounce/throttle high-frequency data updates appropriately
  - Avoid layout thrashing (read-then-write DOM patterns)
§8 — TESTING & SMOKE TEST INTEGRITY (CRITICAL — READ CAREFULLY)
text

RULE: The current smoke/test suite is UNRELIABLE. Tests report "PASS" but
the actual application exhibits bugs (flickering, non-functional components,
data not displaying). This is UNACCEPTABLE.

NEW TESTING PROTOCOL:

1. NO TEST MAY SIMPLY ASSERT "data received" OR "component rendered."
   Tests MUST assert:
   - The CORRECT data is displayed (value-level assertions)
   - The data UPDATES when the source changes
   - The component is VISIBLE and INTERACTIVE (not hidden, zero-size,
     or overlapped)
   - No console errors/warnings during the test

2. VISUAL VERIFICATION IS MANDATORY:
   - For every component, E10 must perform or simulate a VISUAL CHECK:
     Does the actual rendered output match expected behavior?
   - If using headless testing, add screenshot comparison or pixel-level
     assertions for critical components.

3. INTEGRATION TESTS OVER UNIT TESTS:
   - Priority: Full-pipeline tests (data source → backend → UI render)
   - A passing unit test on an isolated component is INSUFFICIENT if the
     integrated component doesn't work.

4. FLICKER TEST:
   - Specifically for Timing Tower and any real-time updating component:
     Run a stability test that updates data 100+ times and asserts:
     a. No DOM thrashing (measure reflow count)
     b. No visual flicker (consistent frame delivery)
     c. Correct values at each update cycle

5. TEST HONESTY RULE:
   - If a test passes but the feature doesn't actually work visually in
     the real app → THE TEST IS WRONG, not the app.
   - Rewrite the test to catch the real failure.
   - Do NOT ship "all tests pass" when the app is broken.

6. EVERY AGENT must run the full test suite after their changes and
   CONFIRM no regressions. E10 runs the final integrated suite.
§9 — WORK COMPLETION RULES
text

1. An agent's work is DONE only when:
   ✅ Their component/feature works with REAL data
   ✅ It passes HONEST tests (see §8)
   ✅ E10 has verified performance compliance
   ✅ E9 has verified data-binding correctness
   ✅ No other agent has a blocking dependency on them
   ✅ The full app runs without regression

2. If an agent finishes early:
   → They MUST assist the agent with the most remaining work
   → Priority: help with integration issues, then performance, then polish

3. ALL agents work CONTINUOUSLY until ALL work is complete.
   No agent stops while others are still working.
   The team ships TOGETHER or not at all.

4. Final checklist before declaring DONE:
   □ Every feature board item is functional (not just visual)
   □ All data bindings verified against real data sources
   □ Performance targets met
   □ Smoke tests rewritten and HONESTLY passing
   □ No flickering on any real-time component
   □ Fallback baseline preserved and accessible
   □ Zero console errors in production build
§10 — PROHIBITED BEHAVIORS (VIOLATION = IMMEDIATE REVERT)
text

❌ NO hardcoded/mock data in production components
❌ NO "it works on my end" without integrated verification
❌ NO skipping a feature because it's "too complex"
❌ NO adding dependencies without team consensus
❌ NO modifying another agent's files without coordination
❌ NO writing tests designed to pass rather than to catch real bugs
❌ NO assuming data format — verify against actual source
❌ NO leaving TODO/FIXME comments as a substitute for implementation
❌ NO visual-only components with no data binding
❌ NO breaking changes without fallback revert path
BEGIN EXECUTION. Deploy all 10 agents simultaneously. Follow every rule above as absolute law. Coordinate continuously. Ship only when everything works — genuinely, not just on paper.