---
title: "Build Log: 49 PRs across 3 repos"
date: "2026-05-22"
tags: ["build-log","vellymon-game","vargasjr-dev","personal-os"]
summary: "49 PRs merged across 3 repos since 2026-05-18. 10,431 lines added, 930 removed."
---

## vellymon.game

33 PRs merged:

- **#226** feat: AI sparring service — lazy init + auto-turn submission (phase 11 item 1) (+211 lines)
- **#227** feat: AI difficulty tiers — visible in-match badge + team labels (phase 11 item 2) (+164 lines)
- **#228** feat: match stats persistence — matchStats table + writeMatchStats + getMatchHistory (phase 11 item 3) (+171 lines)
- **#229** feat: vellymon detail page — /roster/[uuid] with full stats, attacks, power + RosterGrid link (phase 11 item 3) (+306 lines)
- **#230** feat: sound & animation polish — Web Audio FX + submit spinner + turn flash (phase 11 item 4) (+210 lines)
- **#231** feat: progression hooks — XP + currency + rank awards on match completion (phase 11 item 5) (+225 lines)
- **#232** feat: post-match rewards summary in VictoryModal (phase 12 item 0) (+116 lines)
- **#233** feat: rank + currency widget in player hub (phase 12 item 1) (+100 lines)
- **#234** feat: rich post-game match detail page (phase 12 items 2+3) (+273 lines)
- **#235** feat: first-win daily bonus detection (phase 12 item 4) (+61 lines)
- **#236** feat: rematch button on match detail page (phase 12 item 5 — FINAL) (+77 lines)
- **#237** feat: match invite link in waiting room (phase 13 item 0) (+46 lines)
- **#238** feat: public player profile page /profile/[userId] (phase 13 item 1) (+295 lines)
- **#239** feat: username slug system — @handle, vanity URLs, profile link in hub (phase 13 item 2) (+179 lines)
- **#240** feat: season history page /season/history (phase 13 item 4) (+236 lines)
- **#241** feat: enrich match history with W/L badges, KO stats, and summary (phase 13 item 5 — FINAL) (+202 lines)
- **#242** feat: achievements schema + catalog + checking service (phase 14 item 1) (+431 lines)
- **#243** feat: achievements page /achievements with progress bar and category groups (phase 14 item 2) (+217 lines)
- **#244** feat: achievement badges and points on player profile page (phase 14 item 3) (+58 lines)
- **#245** feat: VictoryModal achievement unlock toast (phase 14 item 4) (+41 lines)
- **#246** feat: hook checkAndAwardAchievements into game-over paths (phase 14 item 5) (+39 lines)
- **#247** feat: new-achievement notification dot on Badges nav link (phase 14 item 6) (+44 lines)
- **#248** feat: daily quests schema + 10-quest catalog (phase 15 item 1) (+183 lines)
- **#249** feat: quest assignment service + reward claiming (phase 15 item 2) (+181 lines)
- **#250** feat: /quests page with daily quest cards and claim rewards (phase 15 item 3) (+198 lines)
- **#251** feat: quest progress tracking at match completion (phase 15 item 4) (+130 lines)
- **#252** feat: quest nav badge with active quest count (phase 15 item 5) (+47 lines)
- **#253** feat: quest complete cards in VictoryModal (phase 15 item 6) (+86 lines)
- **#254** feat: userLoginStreak schema + streak catalog (phase 16 item 1) (+178 lines)
- **#255** feat: login streak service — getLoginStreak + claimDailyCheckIn (phase 16 item 2) (+137 lines)
- **#256** feat: daily check-in card on hub page (phase 16 item 3) (+174 lines)
- **#257** feat: login streak badge in GameNav (phase 16 item 5) (+51 lines)
- **#258** feat: streak freeze subscriber perk (phase 16 item 6) (+86 lines)

## vargasjr.dev

8 PRs merged:

- **#747** feat: /api/github-stats — custom PR breakdown SVG (+120 lines)
- **#748** fix: next lint CLI — explicit --dir flags for Next.js 16 (+0 lines)
- **#749** fix: github-stats — contribution grid with per-day hover breakdown (+109 lines)
- **#750** fix: github-stats — GITHUB_PRIVATE_KEY JWT auth + fast ESLint CI (+63 lines)
- **#751** feat: add /api/rotating-banner self-hosted animated SVG (+63 lines)
- **#752** fix: rotating-banner keyframe percentages relative to full cycle (+0 lines)
- **#753** fix: github-stats auth (node:crypto) + two-tier day cache (+40 lines)
- **#754** fix: drop FlatCompat — native flat config imports for eslint-config-next (+80 lines)

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

*Generated automatically from 49 merged PRs between 2026-05-18 and 2026-05-22.*
