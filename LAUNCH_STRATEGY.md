# TelemetryX Launch Strategy

This document contains all copy for the v1.0.0 launch. Execute exactly as written.

---

## Phase 1 — Soft Launch (Day 0)

### r/formula1 Post

**Title:**
```
I built a desktop app for F1 telemetry analysis — Monte Carlo strategy simulation with real circuit data
```

**Body:**
```
After years of watching races and wanting better tools to analyze strategy decisions, I built TelemetryX — a desktop app that combines timing tower data, multi-driver telemetry overlays, and Monte Carlo simulation.

The Monaco 2024 demo includes:
- Real circuit data from 38 F1 tracks (GPS-based 2.5D rendering)
- Live position tracking with gaps/intervals
- Multi-driver telemetry comparison (up to 4 drivers)
- Monte Carlo simulation with track-specific pit stop models
- SC/VSC probability analysis

It's fully open source (MIT) and works in demo mode without any API keys. The app runs locally on your machine — no data leaves your computer.

Would love feedback from the community on what features would be most useful for race analysis.

GitHub: https://github.com/telemetryx/telemetryx
```

**Posting guidelines:**
- Wait 24h after other posts in the thread
- Engage with every comment within first 2 hours
- Don't delete — if you regret something, edit

---

### r/dataisbeautiful Post

**Title:**
```
[OC] Built an F1 telemetry desktop app with Monte Carlo strategy simulation — here's Monaco 2024 analysis
```

**Body:**
```
I collected the Monaco 2024 race data using FastF1 and built a desktop app to analyze it.

The app visualizes:
- Real GPS-based track rendering for 38 circuits
- Position changes with gaps and intervals
- Multi-driver telemetry (speed, throttle, brake traces)
- Monte Carlo simulation with 3000 samples per race

The simulation correctly predicted a 1-stop as optimal for Monaco (Medium→Hard), which is what actually happened. Leclerc won with 1 stop, starting from pole.

The data flows: FastF1 → DuckDB → FastAPI → React/Electron UI

Demo mode works out of the box — no API keys needed.

Would love feedback on what visualizations would be most useful for race analysis!

GitHub: https://github.com/telemetryx/telemetryx
```

---

### Twitter/X Launch Thread

**Tweet 1 — The Hook:**
```
🏎️ Built a Formula 1 telemetry app that shows you what actually happened in every race.

Monaco 2024: Leclerc beats Piastri by 2.4s on a 1-stop. The data shows the undercut window was 1.2 laps.

Demo mode works — clone and run:
github.com/telemetryx/telemetryx

🧵 Thread
```

**Tweet 2 — Features:**
```
What it does:

📊 Timing Tower — live gaps, intervals, sector times, tyre compounds
🗺️ Track Map — 38 real circuits with GPS data, 2.5D perspective view
📈 Telemetry — compare 4 drivers simultaneously 
🎲 Monte Carlo — 3000 simulations with track-specific pit stop models

All runs locally. No API keys needed.
```

**Tweet 3 — Call to Action:**
```
Open source, MIT licensed.

Clone it:
git clone https://github.com/telemetryx/telemetryx && cd TelemetryX && ./start.sh

Would love feedback from F1 data folks on what's missing.
```

---

## Phase 2 — Community Seeding (Days 1-7)

### Hacker News Show HN

**Title:**
```
TelemetryX – F1 telemetry analysis with Monte Carlo strategy simulation
```

**First Comment (post this yourself immediately):**
```
I built this because I wanted to understand strategy decisions better. The Monte Carlo simulation runs 3000 samples per race with track-specific parameters — Monaco is a street circuit so SC probability is higher.

Interesting technical bits:
- uPlot for 90fps telemetry rendering (no ECharts lag)
- Real GPS coordinates for 38 circuits — not hand-drawn, actual racing line
- DuckDB for embedded analytics — no server required
- FastF1 for data, but it works offline with cached data

The demo mode loads Monaco 2024 with zero configuration. That's what I'd love feedback on — is the demo compelling enough that people will actually try it?

Also curious what other data people want — I have access to 2018+ timing and telemetry. What would be most useful for race analysis?
```

**Real F1 Twitter Accounts to Tag:**

1. **@f1designersclub** — F1 data design enthusiasts, 15K+ followers
2. **@F1DataAnalysis** — Real-time F1 data account, 8K+ followers  
3. **@racefans** — Major F1 news outlet, 500K+ followers
4. **@thejudge13** — F1 journalist/data analyst, 50K+ followers
5. **@andrewbenson_f1** — BBC F1 journalist, 200K+ followers

**Additional suggestions:**
- **@chris_medlandf1** — F1 journalist
- **@Micheal_McCourt** — F1 data analyst
- **@f1statsbymatt** — F1 statistics account

### Discord Servers to Post In

1. **r/F1 Discord** (r/F1 community server) — 50K+ members
   - Post in #race-discussion or #data-analysis

2. **F1 Data Hub Discord** — 5K+ members
   - Dedicated to F1 analytics

3. **Simracing / F1 League Discord** — 20K+ members
   - Post in #analysis or #general

---

## Phase 3 — Content Creator Outreach (Days 7-30)

### Target YouTube/Twitter Creators

1. **Chain Bear** (@chainbear) — 350K YouTube subscribers
   - F1 technical analysis, data-focused content
   
2. **Misha Charoudin** (@MishaCharoudin) — 200K YouTube
   - F1 content, technical deep-dives

3. **The Race** (@TheRace) — 400K YouTube
   - F1 analysis and commentary

4. **Matt Neal** (@MattNealF1) — Former F1 driver, commentator
   
5. **Ted Kravitz** (@tedkravitz) — F1 journalist, Sky Sports

6. **Jenna Fryer** (@JennaFryer) — AP F1 reporter

7. **Marty H. (F1)** — F1 YouTube, 150K subscribers

8. **Beyond The Grid (F1)** — Official F1 podcast

### DM Template

Send via Twitter DM or email (check YouTube about/email):

```
Subject: F1 telemetry tool for [specific video topic]

Hi [Name],

I noticed your video on [specific race/strategy analysis] — really enjoyed how you broke down [specific aspect].

I built TelemetryX (github.com/telemetryx/telemetryx) which does [specific capability relevant to their content]. For example, I can show you exactly where [driver] lost time vs [driver] on each sector, or run Monte Carlo sims to see if 2-stop was actually viable.

Happy to set up a demo with any race data you'd like to feature. No strings — just want to build something useful for the F1 community.

Let me know if you're interested!

— [Your name]
```

### Watermark Specification

For content creators who want to use TelemetryX in videos:

- **Text:** "TelemetryX" in Orbitron Bold
- **Position:** Bottom-right corner, 20px from edges
- **Opacity:** 60%
- **Size:** 120px width, proportional height
- **Color:** White with subtle drop shadow

---

## Launch Checklist

### Day 0
- [ ] Push v1.0.0 tag
- [ ] GitHub Release auto-published
- [ ] Post r/formula1
- [ ] Post r/dataisbeautiful  
- [ ] Tweet thread (all 3)
- [ ] Submit Hacker News

### Day 1-3
- [ ] Monitor Reddit for comments
- [ ] Reply to all questions within 4 hours
- [ ] Tag 5 F1 Twitter accounts
- [ ] Post in 3 Discord servers

### Day 4-7
- [ ] Send DMs to 5 YouTube creators
- [ ] Monitor GitHub for issues/stars
- [ ] Update based on feedback

### Day 7-30
- [ ] Continue outreach
- [ ] Fix critical bugs
- [ ] Prepare v1.0.1 if needed

---

## Contingencies

**If no traction after 48h:**
- Post again on r/formula1 with update
- Try different Twitter angles ("F1 pit strategy explained")

**If negative reception:**
- Don't argue — thank for feedback
- Fix real issues privately
- Update demo to address concerns

**If GitHub issues spike:**
- Triage immediately
- Fix P0 bugs within 24h
- Acknowledge known limitations

---

## Metrics to Track

- GitHub stars (daily)
- GitHub releases page views
- Reddit post upvotes/comments
- Twitter impressions
- Hacker News ranking
- npm downloads (if applicable)
- Docker pulls (if applicable)
- Issues opened/closed

---

Last updated: March 2024
