# Usage:
# jq -R -s -f scripts/smoke_telemetry_binding.jq playback.log
# Optional thresholds:
# jq -R -s -f scripts/smoke_telemetry_binding.jq --arg min_primary_samples 2 --arg max_ok_regressions 0 playback.log

def json_events:
  split("\n")
  | map(select(startswith("{")) | (fromjson? // empty))
  | map(select(type == "object" and has("event")));

def argnum(name; default):
  if ($ARGS.named[name]? == null) then default
  else (($ARGS.named[name] | tonumber?) // default)
  end;

def sample_count(e; key):
  (
    e[(key + "_sample_count")] //
    e[(key + "_samples")] //
    e[(key + "SampleCount")] //
    e[(key + "Samples")] //
    ((e[key] // {})["sampleCount"]) //
    (((e.telemetry_window // {})[key] // {})["sampleCount"])
  );

def status_of(e):
  if (e.event == "tick_end") and (e.telemetry_status != null) then (e.telemetry_status | tostring | ascii_downcase)
  elif e.telemetry_status != null then (e.telemetry_status | tostring | ascii_downcase)
  elif e.telemetry_window_status != null then (e.telemetry_window_status | tostring | ascii_downcase)
  elif e.window_status != null then (e.window_status | tostring | ascii_downcase)
  else empty
  end;

. as $raw
| (json_events) as $events
| ($raw | scan("ReferenceError|TypeError|recursive rearrange|Binding loop detected|Unable to assign|Cannot assign|QML [^\\n]*Error")) as $qml_errs
| (argnum("min_primary_samples"; 2.0)) as $min_primary_samples
| (argnum("min_compare_samples"; 2.0)) as $min_compare_samples
| (argnum("max_ok_regressions"; 0.0)) as $max_ok_regressions
| ($events | map(status_of(.))) as $statuses
| ($statuses | map(select(. != null and . != ""))) as $status_list
| ($status_list | map(select(. != "stale" and . != "empty" and . != "ok" and . != "invalid")) | unique) as $unknown_statuses
| ([range(0; ($status_list | length) - 1) | (($status_list[.] + "->" + $status_list[.+1]))]) as $transitions
| ([range(0; ($status_list | length) - 1) | select($status_list[.] == "ok" and ($status_list[.+1] == "stale" or $status_list[.+1] == "invalid"))] | length) as $ok_regressions
| ($events | map(sample_count(.; "primary") | tonumber?) | map(select(. != null))) as $primary_samples
| ($events | map(select((.compare_enabled // .compareEnabled // false) == true))) as $compare_enabled
| ($compare_enabled | map(sample_count(.; "compare") | tonumber?) | map(select(. != null))) as $compare_samples
| ([
    {
      name: "window_status_events_present",
      status: (if ($status_list | length) > 0 then "pass" else "fail" end),
      passed: (($status_list | length) > 0),
      detail: ((($status_list | length | tostring) + " > 0"))
    },
    {
      name: "window_status_values_known",
      status: (if ($unknown_statuses | length) == 0 then "pass" else "fail" end),
      passed: (($unknown_statuses | length) == 0),
      detail: ("unknown=" + ($unknown_statuses | tostring))
    },
    {
      name: "window_status_ok_regressions",
      status: (if ($ok_regressions <= $max_ok_regressions) then "pass" else "fail" end),
      passed: ($ok_regressions <= $max_ok_regressions),
      detail: (($ok_regressions | tostring) + " <= " + ($max_ok_regressions | tostring))
    },
    (
      if ($primary_samples | length) > 0 then {
        name: "primary_sample_count_min",
        status: (if (($primary_samples | min) >= $min_primary_samples) then "pass" else "fail" end),
        passed: (($primary_samples | min) >= $min_primary_samples),
        detail: ("min=" + (($primary_samples | min) | tostring) + " >= " + ($min_primary_samples | tostring))
      } else {
        name: "primary_sample_count_min",
        status: "skip",
        passed: true,
        detail: "SKIP (no primary sampleCount fields found)"
      }
      end
    ),
    (
      if ($compare_enabled | length) == 0 then {
        name: "compare_sample_count_min_when_enabled",
        status: "skip",
        passed: true,
        detail: "SKIP (no compare-enabled observations found)"
      } elif ($compare_samples | length) > 0 then {
        name: "compare_sample_count_min_when_enabled",
        status: (if (($compare_samples | min) >= $min_compare_samples) then "pass" else "fail" end),
        passed: (($compare_samples | min) >= $min_compare_samples),
        detail: ("min=" + (($compare_samples | min) | tostring) + " >= " + ($min_compare_samples | tostring))
      } else {
        name: "compare_sample_count_min_when_enabled",
        status: "skip",
        passed: true,
        detail: "SKIP (compare enabled but no compare sampleCount fields found)"
      }
      end
    ),
    {
      name: "qml_errors",
      status: (if (($qml_errs | length) == 0) then "pass" else "fail" end),
      passed: (($qml_errs | length) == 0),
      detail: ((($qml_errs | length | tostring) + " == 0"))
    }
  ]) as $checks
| ($checks | map(select(.status == "fail")) | length) as $failed_checks
| {
    tool: "smoke_telemetry_binding",
    overall: (if $failed_checks == 0 then "pass" else "fail" end),
    failed_checks: $failed_checks,
    passed_checks: ($checks | map(select(.status == "pass")) | length),
    skipped_checks: ($checks | map(select(.status == "skip")) | length),
    checks: $checks,
    metrics: {
      event_count: ($events | length),
      tick_start_count: ($events | map(select(.event == "tick_start")) | length),
      tick_end_count: ($events | map(select(.event == "tick_end")) | length),
      window_status_count: ($status_list | length),
      window_status_seen: ($status_list | unique),
      unknown_window_statuses: $unknown_statuses,
      window_status_transitions_compressed: {
        first_5: ($transitions[:5]),
        last_3: (if (($transitions | length) > 0) then ($transitions[-3:]) else [] end),
        counts: ($transitions | reduce .[] as $t ({}; .[$t] = ((.[$t] // 0) + 1))),
        total: ($transitions | length)
      },
      window_status_ok_regressions: $ok_regressions,
      primary_sample_count_observed: ($primary_samples | length),
      primary_sample_count_min: (($primary_samples | min?) // null),
      compare_enabled_observations: ($compare_enabled | length),
      compare_sample_known_observations: ($compare_samples | length),
      qml_errors: ($qml_errs | length)
    },
    thresholds: {
      min_primary_samples: $min_primary_samples,
      min_compare_samples: $min_compare_samples,
      max_ok_regressions: $max_ok_regressions
    }
  }
