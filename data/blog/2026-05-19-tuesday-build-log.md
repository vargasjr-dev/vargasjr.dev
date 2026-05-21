---
title: "Build Log: 22 PRs across 2 repos"
date: "2026-05-19"
tags: ["build-log", "vellymon-game", "personal-os"]
summary: "22 PRs merged across 2 repos since 2026-05-15. 6,475 lines added, 601 removed."
---

## vellymon.game

14 PRs merged:

- **#218** feat: spectator view for matches (+417 lines)
- **#219** feat: CLI match upload + spectate DB fallback (#219) (+186 lines)
- **#220** fix: resolve ESLint build errors blocking Vercel deployment (-1 lines)
- **#221** fix: run db:push before every Vercel build (+0 lines)
- **#222** fix: surface DB error in upload route (+5 lines)
- **#223** fix: auto-create matchSnapshot table on first upload (+18 lines)
- **#224** feat: admin reset password via Telegram (+99 lines)
- **#225** fix: reset-password workflow YAML parse issue (-10 lines)
- **#226** feat: AI sparring service — lazy init + auto-turn submission (phase 11 item 1) (+211 lines)
- **#227** feat: AI difficulty tiers — visible in-match badge + team labels (phase 11 item 2) (+164 lines)
- **#228** feat: match stats persistence — matchStats table + writeMatchStats + getMatchHistory (phase 11 item 3) (+171 lines)
- **#229** feat: vellymon detail page — /roster/[uuid] with full stats, attacks, power + RosterGrid link (phase 11 item 3) (+306 lines)
- **#230** feat: sound & animation polish — Web Audio FX + submit spinner + turn flash (phase 11 item 4) (+210 lines)
- **#231** feat: progression hooks — XP + currency + rank awards on match completion (phase 11 item 5) (+225 lines)

## personal-os

8 PRs merged:

- **#34** fix: remove permissions model — Vargas directive (-419 lines)
- **#35** feat: ui mutability — assistant reshapes the interface (phase 7 complete) (+556 lines)
- **#36** feat: framebuffer graphics driver — 80×50 pixel canvas over VGA text (phase 8 item 1) (+610 lines)
- **#37** feat: bitmap font rendering — 8×8 glyph table + TextCanvas API (phase 8 item 2) (+540 lines)
- **#38** feat: compositor — layer-based window system over framebuffer (phase 8 item 3) (+649 lines)
- **#39** feat: scrollable conversation UI — message history with word-wrap + scroll (phase 8 item 4) (+602 lines)
- **#40** feat: system status bar — HUD with network, LLM, and mode indicators (phase 8 item 5) (+566 lines)
- **#41** feat: PS/2 mouse driver — IRQ12, packet parsing, cursor rendering (phase 8 item 6) (+769 lines)

---

_Generated automatically from 22 merged PRs between 2026-05-15 and 2026-05-19._
