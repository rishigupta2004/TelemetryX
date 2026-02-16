# Usage:
# jq -R -s -f scripts/smoke_timing_tower.jq playback.log
# Optional thresholds:
# jq -R -s -f scripts/smoke_timing_tower.jq \
#   --arg min_non_empty_pct 99 --arg max_fallback_gap_pct 10 playback.log

def json_events:
  split("\n")
  | map(select(startswith("{")) | (fromjson? // empty))
  | map(select(type == "object" and has("event")));

def p95(arr):
  if (arr | length) == 0 then 0
  else (arr | sort | .[((length - 1) * 0.95 | floor)])
  end;

def pct(num; den):
  if den > 0 then (num / den) * 100 else 0 end;

def argnum(name; default):
  if ($ARGS.named[name]? == null) then default
  else (($ARGS.named[name] | tonumber?) // default)
  end;

. as $raw
| (json_events) as $events
| ($events | map(select(.event=="tower_tick"))) as $ticks
| ($events | map(select(.event=="tower_row"))) as $rows
| ($events | map(select(.event=="pos_sample"))) as $pos_samples
| ($raw | scan("ReferenceError|TypeError|recursive rearrange|QML [^\\n]*Error")) as $qml_errs
| (
    argnum("min_non_empty_pct"; 99.0) as $min_non_empty_pct
    | argnum("max_fallback_gap_pct"; 10.0) as $max_fallback_gap_pct
    | argnum("max_fallback_interval_pct"; 10.0) as $max_fallback_interval_pct
    | argnum("max_missing_sector_pct"; 20.0) as $max_missing_sector_pct
    | argnum("max_pos_nearest_dt_p95"; 0.25) as $max_pos_nearest_dt_p95
    | argnum("warmup_seconds"; 30.0) as $warmup_seconds
    | argnum("min_seconds_for_sector_gate"; 120.0) as $min_seconds_for_sector_gate
    | argnum("min_lap_for_sector_gate"; 2.0) as $min_lap_for_sector_gate

    | ($ticks | map(.rows // 0) | add // 0) as $rows_total_from_ticks
    | ($ticks | map(.fallback_gap_rows // 0) | add // 0) as $fallback_gap_rows
    | ($ticks | map(.fallback_interval_rows // 0) | add // 0) as $fallback_interval_rows
    | ($ticks | map(.missing_sector_rows // 0) | add // 0) as $missing_sector_rows
    | ($ticks | map(.lap_regressions // 0) | add // 0) as $lap_regressions
    | ($ticks | length) as $tick_count
    | ($ticks | map(select((.rows // 0) > 0)) | length) as $tick_non_empty
    | ($rows | length) as $row_count
    | ($rows | map(select(.gap_source=="distance_fallback")) | length) as $row_fallback_gap
    | ($rows | map(select(.interval_source=="distance_fallback")) | length) as $row_fallback_interval
    | ($rows | map(select((.sectors_len // 0) < 3)) | length) as $row_missing_sector
    | (if $rows_total_from_ticks > 0 then $rows_total_from_ticks else $row_count end) as $rows_total

    | (if $rows_total_from_ticks > 0 then $fallback_gap_rows else $row_fallback_gap end) as $fallback_gap_count
    | (if $rows_total_from_ticks > 0 then $fallback_interval_rows else $row_fallback_interval end) as $fallback_interval_count
    | (if $rows_total_from_ticks > 0 then $missing_sector_rows else $row_missing_sector end) as $missing_sector_count

    | ($ticks | map((.t // 0) | tonumber?) | map(select(. != null)) | max? // 0) as $max_t_ticks
    | ($rows | map((.t // 0) | tonumber?) | map(select(. != null)) | max? // 0) as $max_t_rows
    | (if $max_t_ticks > $max_t_rows then $max_t_ticks else $max_t_rows end) as $max_t

    | ($ticks | map((.lap // 0) | tonumber?) | map(select(. != null)) | max? // 0) as $max_lap_ticks
    | ($rows | map((.lap // 0) | tonumber?) | map(select(. != null)) | max? // 0) as $max_lap_rows
    | (if $max_lap_ticks > $max_lap_rows then $max_lap_ticks else $max_lap_rows end) as $max_lap

    | ($pos_samples
        | map(select((.nearest_dt != null) and (((.t // 0) | tonumber? // 0) >= $warmup_seconds)))
        | map((.nearest_dt | tonumber?) // empty)
      ) as $nearest_after_warmup
    | (p95($nearest_after_warmup)) as $pos_nearest_dt_p95
    | ($nearest_after_warmup | length) as $pos_nearest_dt_count

    | (pct($tick_non_empty; $tick_count)) as $non_empty_ticks_pct
    | (pct($fallback_gap_count; $rows_total)) as $fallback_gap_pct
    | (pct($fallback_interval_count; $rows_total)) as $fallback_interval_pct
    | (pct($missing_sector_count; $rows_total)) as $missing_sector_pct

    | (($max_t >= $min_seconds_for_sector_gate) or ($max_lap >= $min_lap_for_sector_gate)) as $sector_gate_active
    | (($pos_nearest_dt_count > 0)) as $pos_gate_active

    | [
        {
          name: "non_empty_ticks_pct",
          status: (if $non_empty_ticks_pct >= $min_non_empty_pct then "pass" else "fail" end),
          passed: ($non_empty_ticks_pct >= $min_non_empty_pct),
          detail: ((($non_empty_ticks_pct | tostring) + "% >= " + ($min_non_empty_pct | tostring) + "%"))
        },
        {
          name: "fallback_gap_pct",
          status: (if $fallback_gap_pct <= $max_fallback_gap_pct then "pass" else "fail" end),
          passed: ($fallback_gap_pct <= $max_fallback_gap_pct),
          detail: ((($fallback_gap_pct | tostring) + "% <= " + ($max_fallback_gap_pct | tostring) + "%"))
        },
        {
          name: "fallback_interval_pct",
          status: (if $fallback_interval_pct <= $max_fallback_interval_pct then "pass" else "fail" end),
          passed: ($fallback_interval_pct <= $max_fallback_interval_pct),
          detail: ((($fallback_interval_pct | tostring) + "% <= " + ($max_fallback_interval_pct | tostring) + "%"))
        },
        (
          if $sector_gate_active then {
            name: "missing_sector_pct",
            status: (if $missing_sector_pct <= $max_missing_sector_pct then "pass" else "fail" end),
            passed: ($missing_sector_pct <= $max_missing_sector_pct),
            detail: ((($missing_sector_pct | tostring) + "% <= " + ($max_missing_sector_pct | tostring) + "%"))
          } else {
            name: "missing_sector_pct",
            status: "skip",
            passed: true,
            detail: ("SKIP (insufficient runtime/lap for sector gate)")
          }
          end
        ),
        {
          name: "lap_regressions",
          status: (if ($lap_regressions == 0) then "pass" else "fail" end),
          passed: ($lap_regressions == 0),
          detail: (($lap_regressions | tostring) + " == 0")
        },
        {
          name: "qml_errors",
          status: (if (($qml_errs | length) == 0) then "pass" else "fail" end),
          passed: (($qml_errs | length) == 0),
          detail: ((($qml_errs | length | tostring) + " == 0"))
        },
        (
          if $pos_gate_active then {
            name: "pos_nearest_dt_p95",
            status: (if $pos_nearest_dt_p95 <= $max_pos_nearest_dt_p95 then "pass" else "fail" end),
            passed: ($pos_nearest_dt_p95 <= $max_pos_nearest_dt_p95),
            detail: ((($pos_nearest_dt_p95 | tostring) + "s <= " + ($max_pos_nearest_dt_p95 | tostring) + "s"))
          } else {
            name: "pos_nearest_dt_p95",
            status: "skip",
            passed: true,
            detail: ("SKIP (no pos_sample at/after warmup)")
          }
          end
        )
      ] as $checks

    | ($checks | map(select(.status == "fail")) | length) as $failed_checks
    | ($checks | map(select(.status == "pass")) | length) as $passed_checks
    | ($checks | map(select(.status == "skip")) | length) as $skipped_checks

    | {
        tool: "smoke_timing_tower",
        overall: (if $failed_checks == 0 then "pass" else "fail" end),
        failed_checks: $failed_checks,
        passed_checks: $passed_checks,
        skipped_checks: $skipped_checks,
        checks: $checks,
        metrics: {
          tower_ticks: $tick_count,
          tower_rows: $row_count,
          pos_samples: ($pos_samples | length),
          rows_total: $rows_total,
          qml_errors: ($qml_errs | length),
          max_t: $max_t,
          max_lap: $max_lap,
          non_empty_ticks_pct: $non_empty_ticks_pct,
          fallback_gap_pct: $fallback_gap_pct,
          fallback_interval_pct: $fallback_interval_pct,
          missing_sector_pct: $missing_sector_pct,
          lap_regressions: $lap_regressions,
          pos_nearest_dt_p95: $pos_nearest_dt_p95,
          pos_nearest_dt_count: $pos_nearest_dt_count
        },
        thresholds: {
          min_non_empty_pct: $min_non_empty_pct,
          max_fallback_gap_pct: $max_fallback_gap_pct,
          max_fallback_interval_pct: $max_fallback_interval_pct,
          max_missing_sector_pct: $max_missing_sector_pct,
          max_pos_nearest_dt_p95: $max_pos_nearest_dt_p95,
          warmup_seconds: $warmup_seconds,
          min_seconds_for_sector_gate: $min_seconds_for_sector_gate,
          min_lap_for_sector_gate: $min_lap_for_sector_gate
        }
      }
  )
