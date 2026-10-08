# HabitLoop AI

**Small habits. Kept promises. Compounding results.** Most habit apps shame you with broken chains and pushy notifications. HabitLoop AI is the gentle one: streaks with honest math, milestone celebrations that mean something, and reminder notes based on habit-stacking science — all 100% in your browser.

## Problem
People download habit trackers, use them for 4 days, and quit. The apps either nag (and get muted) or fake the streak math. Nobody sticks with a system that punishes them for being human.

## Solution
Add a habit (daily or weekly) → tap the day-grid to check in → watch honest streaks grow. Milestone messages celebrate 7 / 14 / 30 / 60 / 100 / 365. Reminder notes teach habit-stacking ("do it right after coffee") instead of demanding notification permissions.

## Features
1. **Daily + weekly habits** — streak math handles both correctly (consecutive days; consecutive weeks with ≥1 check-in).
2. **Honest streaks** — unchecking a day drops the streak; longest-streak record is kept separately so progress is never lost.
3. **Weekly grid view** — 7-day tap grid per habit, navigable to earlier weeks, today highlighted.
4. **Milestone messages** — motivational notes at 7, 14, 30, 60, 100, and 365; "next milestone" countdown on every card.
5. **Gentle reminder notes** — frequency-aware nudge copy with your preferred time; habit-stacking tip included.
6. **Habit notes** — why it matters / what "done" looks like, shown on the card.
7. **Edit any habit** — rename it, change the reminder time, frequency, or notes inline.
8. **30-day consistency score** — what share of the last 30 days (or 4 weeks) you showed up, right on the card.
9. **Sort your habits** — by streak, longest ever, name, or newest first.
10. **Archive instead of delete** — dormant habits rest in an archive with their history intact; restore anytime. Export any habit's full check-in history as CSV.
11. **100% local** — no accounts, no servers, no tracking. Data lives in `localStorage`.

## Pricing vision
Free forever for individuals · **$6/mo Coach** (share streaks with an accountability partner, weekly email digest) · $49/mo Teams (workplace wellness challenges).

## Run it
No build step. Open `index.html` in a browser, or:

```bash
python3 -m http.server 8080   # then http://localhost:8080
```

## Tests
```bash
bash test/smoke.sh   # 14 checks: files, syntax, validation, streaks, milestones, grid
bash test/e2e.sh     # 7 end-to-end flows in Node against js/logic.js
```

## Architecture
```
index.html        UI shell (form, stats, habit cards)
css/style.css     light theme, streak cards, 7-day grids
js/logic.js       pure logic (streak math, milestones, grids) — UMD, testable in Node
js/app.js         DOM wiring + localStorage persistence
test/smoke.sh     file/syntax/logic checks
test/e2e.sh       full user flows in Node
```
