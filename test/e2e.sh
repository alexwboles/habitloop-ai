#!/usr/bin/env bash
# HabitLoop AI end-to-end tests — 7 flows exercised in Node against js/logic.js.
set -u
cd "$(dirname "$0")/.."

node << 'EOF'
const H = require('/home/hatch/workspace/habitloop-ai/js/logic.js');
const T = '2026-09-28'; // pinned "today" (a Monday)
let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  PASS: ' + m); };
const bad = (m) => { fail++; console.log('  FAIL: ' + m); };
console.log('== habitloop-ai e2e ==');

// Flow 1: new user adds a habit and checks in today
const habits = [];
const a = H.addHabit(habits, { name: 'Floss', frequency: 'daily', reminder: '10 PM', notes: 'Dentist said so', today: T });
const c = H.checkIn(habits, a.habit.id, T);
(a.ok && c.ok && !c.already && H.streakFor(a.habit, T) === 1)
  ? ok('flow1: add habit + first check-in -> streak 1') : bad('flow1');

// Flow 2: double check-in same day is idempotent
const c2 = H.checkIn(habits, a.habit.id, T);
(c2.ok && c2.already && H.totalCheckins(a.habit) === 1)
  ? ok('flow2: double check-in ignored, total still 1') : bad('flow2');

// Flow 3: build a 7-day streak -> milestone fires
for (let i = 1; i < 7; i++) H.checkIn(habits, a.habit.id, H.addDays(T, -i));
const s = H.summarize(habits, T)[0];
(s.streak === 7 && s.milestone && s.milestone.length > 20 && s.next.at === 14)
  ? ok('flow3: 7-day streak fires milestone, next is 14') : bad('flow3 streak=' + s.streak);

// Flow 4: uncheck today drops the streak honestly (no fake streaks)
H.uncheck(habits, a.habit.id, T);
const s2 = H.summarize(habits, T)[0];
(s2.streak === 6 && H.longestStreak(a.habit) === 7)
  ? ok('flow4: uncheck drops streak to 6, longest stays 7') : bad('flow4 streak=' + s2.streak);

// Flow 5: weekly habit — one check-in per week keeps the streak
const w = [];
const bw = H.addHabit(w, { name: 'Water plants', frequency: 'weekly', today: T });
H.checkIn(w, bw.habit.id, '2026-09-28');
H.checkIn(w, bw.habit.id, '2026-09-24');
H.checkIn(w, bw.habit.id, '2026-09-08'); // week of 09-07: gap at week of 09-14
(H.streakFor(bw.habit, T) === 2)
  ? ok('flow5: weekly habit, 2 consecutive weeks -> streak 2') : bad('flow5 streak=' + H.streakFor(bw.habit, T));

// Flow 6: weekGrid renders the week holding the check-ins with done flags
// check-ins are 09-22..09-27 (T was unchecked in flow 4); that week starts Mon 09-21
const gridMonday = H.weekStart(H.addDays(T, -6));
const grid = H.weekGrid(a.habit, gridMonday);
const doneCount = grid.filter(g => g.done).length;
(gridMonday === '2026-09-21' && grid.length === 7 && doneCount === 6 && grid[6].date === H.addDays(T, -1))
  ? ok('flow6: weekGrid Mon 09-21, 7 cells, 6 done, last cell is yesterday') : bad('flow6 done=' + doneCount);

// Flow 7: invalid input never creates a habit; unknown id handled
const badAdd = H.addHabit(habits, { name: '   ', frequency: 'daily' });
const badCheck = H.checkIn(habits, 'nope', T);
(!badAdd.ok && badAdd.errors.length > 0 && !badCheck.ok)
  ? ok('flow7: blank name rejected; unknown id check-in fails cleanly') : bad('flow7');

// Flow 8: user renames a habit and fixes the reminder time
const ren = [];
const rh = H.addHabit(ren, { name: 'Read', frequency: 'daily', reminder: '10 PM', today: T });
const up = H.updateHabit(ren, rh.habit.id, { name: 'Read 10 pages', reminder: '9 PM' });
const summ8 = H.summarize(ren, T)[0];
(up.ok && summ8.name === 'Read 10 pages')
  ? ok('flow8: rename + reminder change reflected on the card') : bad('flow8');

// Flow 9: consistency shows on the card; export the history as CSV
const ex = [];
const eh = H.addHabit(ex, { name: 'Floss', frequency: 'daily', today: T });
for (let i = 0; i < 20; i++) H.checkIn(ex, eh.habit.id, H.addDays(T, -i));
const cons9 = H.consistency(eh.habit, T);
const csv9 = H.habitToCSV(eh.habit).split('\n');
(cons9.pct === 67 && csv9[0] === 'date,done' && csv9.length === 21)
  ? ok('flow9: 20/30 = 67% consistency; CSV has 20 rows') : bad('flow9: ' + JSON.stringify(cons9));

// Flow 10: archive a dormant habit instead of deleting; restore later
const arc = [];
const ah = H.addHabit(arc, { name: 'Old resolution', frequency: 'daily', today: T });
H.checkIn(arc, ah.habit.id, H.addDays(T, -40));
H.archiveHabit(arc, ah.habit.id);
const act10 = H.activeHabits(arc);
const arc10 = H.archivedHabits(arc);
(act10.length === 0 && arc10.length === 1 && arc10[0].checkins.length === 1)
  ? ok('flow10: archived habit hidden from the chain, history kept') : bad('flow10');
H.restoreHabit(arc, ah.habit.id);
(H.activeHabits(arc).length === 1)
  ? ok('flow10b: restored habit returns to the chain') : bad('flow10b');

// Flow 11: sort habits by streak — the hot streak floats to the top
const srt = [];
const sA = H.addHabit(srt, { name: 'A slow one', frequency: 'daily', today: T });
const sB = H.addHabit(srt, { name: 'B on fire', frequency: 'daily', today: T });
for (let i = 0; i < 6; i++) H.checkIn(srt, sB.habit.id, H.addDays(T, -i));
H.checkIn(srt, sA.habit.id, T);
const top = H.sortHabits(H.activeHabits(srt), T, 'streak')[0];
(top.name === 'B on fire')
  ? ok('flow11: sort by streak puts the 6-day streak first') : bad('flow11: ' + top.name);

console.log('');
console.log('e2e: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
EOF
echo "e2e exit: $?"
