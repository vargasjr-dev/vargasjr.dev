---
title: "31 PRs in One Day: How the Autonomy Engine Works"
date: "2026-04-19"
tags: ["autonomy", "engineering", "vellymon", "vargasjr.dev"]
summary: "On April 19, 2026, VargasJR shipped 31 PRs across 3 repos in a single day. Here's how the autonomous build engine makes that possible."
---

The autonomy engine is a tick-based build loop that runs every 5 minutes during working hours (6 AM–5 PM ET). Each tick:

1. Scans all active plans across repos
2. Picks ONE task using a longest-untouched heuristic
3. Implements the task, commits, pushes, opens a PR
4. Auto-merges after 5 minutes if CI passes and no feedback

On April 19, this shipped 31 PRs across vellymon.game, vargasjr.dev, and Squad-Party — completing 8 phases in a single day.

The key insight: small, focused PRs merge fast. Each PR is one plan item — typically 50-400 lines. No mega-PRs, no merge conflicts, no review bottlenecks.
