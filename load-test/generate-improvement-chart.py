#!/usr/bin/env python3
"""Regenerate load-test/load-test-improvement.png from the summary JSONs.

Three panels, before vs after (Baseline a40561b vs HEAD + SSR page cache):
  1. Error rate (%)
  2. Useful throughput (status-200 responses/s)
  3. Latency p95 / p99 (same percentile compared, log scale)

Baseline latency is over all responses including fast 429/500 rejections; the
footnote keeps search/abuse tail comparisons honest.
"""
import json
import pathlib

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

RESULTS = pathlib.Path(__file__).parent / "results"
OUT = pathlib.Path(__file__).parent / "load-test-improvement.png"

SCENARIOS = ["browse", "search", "abuse"]
BEFORE = "baseline"
AFTER = "head-full-pagecache"

BEFORE_COLOR = "#b8b8b8"
AFTER_COLOR = "#2f6fd0"
BAR_W = 0.34


def load(scenario, run_id):
    path = RESULTS / f"{scenario}-{run_id}-{run_id}.summary.json"
    with path.open(encoding="utf8") as fh:
        return json.load(fh)


def useful_rps(summary):
    served = 0
    for ep in summary["endpoints"].values():
        served += ep["statuses"].get("200", 0)
    return served / (summary["durationMs"] / 1000)


data = {}
for name in SCENARIOS:
    before, after = load(name, BEFORE), load(name, AFTER)
    data[name] = {
        "error_before": before["errorRate"],
        "error_after": after["errorRate"],
        "rps_before": useful_rps(before),
        "rps_after": useful_rps(after),
        "p95_before": before["httpReqDuration"]["p95Ms"],
        "p95_after": after["httpReqDuration"]["p95Ms"],
        "p99_before": before["httpReqDuration"]["p99Ms"],
        "p99_after": after["httpReqDuration"]["p99Ms"],
    }

fig, (ax_err, ax_rps, ax_lat) = plt.subplots(
    1, 3, figsize=(16, 5.5), gridspec_kw={"width_ratios": [1, 1, 1.6]}
)

def before_after(ax, x, b, a, yfmt):
    ax.bar(x - BAR_W / 2, b, BAR_W, color=BEFORE_COLOR, label="_nolegend_")
    ax.bar(x + BAR_W / 2, a, BAR_W, color=AFTER_COLOR, label="_nolegend_")
    ax.text(x - BAR_W / 2, b, yfmt(b), ha="center", va="bottom", fontsize=9)
    ax.text(x + BAR_W / 2, a, yfmt(a), ha="center", va="bottom", fontsize=9)


# Panel 1 — error rate
for i, name in enumerate(SCENARIOS):
    before_after(ax_err, i, data[name]["error_before"], data[name]["error_after"],
                 lambda v: f"{v:g}%")
ax_err.set_xticks(range(3))
ax_err.set_xticklabels(SCENARIOS, fontsize=11)
ax_err.set_ylabel("Error rate (%) — lower is better")
ax_err.set_title("Errors", fontsize=12)
ax_err.set_ylim(0, 110)

# Panel 2 — useful throughput
for i, name in enumerate(SCENARIOS):
    before_after(ax_rps, i, data[name]["rps_before"], data[name]["rps_after"],
                 lambda v: f"{v:.0f}")
ax_rps.set_xticks(range(3))
ax_rps.set_xticklabels(SCENARIOS, fontsize=11)
ax_rps.set_ylabel("Useful throughput (200 resp/s) — higher is better")
ax_rps.set_title("Throughput (status-200 only)", fontsize=12)

# Panel 3 — latency p95 / p99
lat_pos = [0, 1, 3, 4, 6, 7]
for i, name in enumerate(SCENARIOS):
    base = i * 3
    d = data[name]
    before_after(ax_lat, base + 0, d["p95_before"], d["p95_after"],
                 lambda v: f"{v:g}")
    before_after(ax_lat, base + 1, d["p99_before"], d["p99_after"],
                 lambda v: f"{v:g}")
ax_lat.set_xticks(lat_pos)
ax_lat.set_xticklabels(
    [f"{s}\np95" if j % 2 == 0 else f"{s}\np99"
     for s in SCENARIOS for j in range(2)],
    fontsize=10,
)
ax_lat.set_yscale("log")
ax_lat.set_ylim(top=5000)
ax_lat.set_ylabel("Latency (ms, log scale) — lower is better")
ax_lat.set_title("Latency p95 / p99", fontsize=12)

ax_err.bar(0, 0, BAR_W, color=BEFORE_COLOR, label="Baseline")
ax_err.bar(0, 0, BAR_W, color=AFTER_COLOR, label="HEAD + page cache")
fig.legend(loc="upper center", ncol=2, fontsize=11, frameon=False)

fig.suptitle(
    "Load-test improvement — baseline (a40561b) vs HEAD + SSR page cache",
    fontsize=13,
    y=1.04,
)

fig.text(
    0.5,
    -0.02,
    "Baseline latency is over all responses, including fast 429/500 rejections; "
    "its search/abuse tail is therefore not comparable. Throughput counts only "
    "status-200 responses (baseline browse useful = 131 rps vs 583 rps after).",
    ha="center",
    va="top",
    fontsize=9,
    color="#555555",
)

fig.tight_layout()
OUT.parent.mkdir(parents=True, exist_ok=True)
fig.savefig(OUT, dpi=150, bbox_inches="tight")
print(f"wrote {OUT}")
