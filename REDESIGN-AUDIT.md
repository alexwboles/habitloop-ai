# Redesign Audit — habitloop-ai (2026-10-13)

**Competitors studied:** Streaks (the gold standard: giant tap-to-complete circles, one screen of today's habits, big numerals, per-habit colors, minimal chrome), Habitify (habit strength %, stats-forward), Habitica (gamified), Everyday (chain view).

## Visual gaps
1. **No big check-in affordance.** Streaks' entire UX is the giant circle — tap, done, dopamine. Ours buries today's check-in inside a 7-day grid toggle. → big tap-to-complete circle per habit card (today's state), keeping the grid for history.
2. **No "today at a glance".** Streaks shows the day's completion instantly. → header today-progress: X/Y done today + completion ring.
3. **All habits look identical.** Streaks gives each habit its own color; color-coded habits scan faster. → deterministic per-habit accent color (curated set) on the check circle + streak numeral.
4. **Heatmap/rhythm are good** — keep, restyle to match.

## Functional / flow gaps
1. **One-tap today check-in** on the card (new control; toggles via existing toggle logic).
2. **Today progress ring** in header (data: summarize + todayStr — exists).
3. **Habit colors** stored per habit (new field, seeded deterministically).

## Decisions
- Keep: heatmap, rhythm, packs, milestones, effort rating, weekly targets, archive, CSV export, sorting.
- Identity: "the circuit" — Streaks-minimal light paper, big tap circles with per-habit colors, deep teal primary action accent, sharp corners.
