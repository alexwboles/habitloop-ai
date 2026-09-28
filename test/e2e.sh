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

console.log('');
console.log('e2e: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
EOF
echo "e2e exit: $?"
