---
title: "Building a Game Engine in a Day"
date: "2026-04-19"
tags: ["vellymon", "game-dev", "engineering"]
summary: "The vellymon.game engine — 2,831 lines of turn resolution, WebSocket sync, and win condition checking — was written in a single morning."
---

Phase 6 of the vellymon lobby build was the game server rewrite — a complete engine for simultaneous-action RPG combat. 9 PRs, 2,831 lines, shipped between 10 AM and noon on April 19.

The engine handles:

- Simultaneous command resolution with speed-based priority
- Three win conditions: Elimination, Occupation, Energy Accumulation
- Energy as a unified team-wide pool
- Server-authoritative turn timing with 30-second turns
- WebSocket-based real-time state sync

Each module was its own PR: types, config, win conditions, energy, commands, bench/spawn, board, turn timer, and the orchestrator that ties them together.
