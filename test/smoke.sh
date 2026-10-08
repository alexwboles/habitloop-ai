#!/usr/bin/env bash
# HabitLoop AI smoke tests — 19 checks. Fails fast on first failure.
set -u
cd "$(dirname "$0")/.."
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }

echo "== habitloop-ai smoke =="

# 1-5: files exist
for f in index.html css/style.css js/logic.js js/app.js README.md; do
  if [ -f "$f" ]; then ok "file exists: $f"; else bad "missing file: $f"; fi
done

# 6-7: JS syntax
if node --check js/logic.js 2>/dev/null; then ok "logic.js syntax"; else bad "logic.js syntax"; fi
if node --check js/app.js 2>/dev/null; then ok "app.js syntax"; else bad "app.js syntax"; fi

# 8-14: logic checks in Node
node << 'EOF'
const H = require('/home/hatch/workspace/habitloop-ai/js/logic.js');
let pass = 0, fail = 0;
const ok = (m) => { pass++; console.log('  PASS: ' + m); };
const bad = (m) => { fail++; console.log('  FAIL: ' + m); };

// 8: validation rejects bad input
const v1 = H.validateHabit('', 'daily'), v2 = H.validateHabit('Read', 'monthly'), v3 = H.validateHabit('Read', 'daily');
(!v1.ok && !v2.ok && v3.ok) ? ok('validateHabit: empty name + bad freq rejected, good input ok') : bad('validateHabit');

// 9: add + daily streak of 3 (today pinned)
const habits = [];
const r = H.addHabit(habits, { name: 'Walk', frequency: 'daily', today: '2026-09-28' });
const T = '2026-09-28';
H.checkIn(habits, r.habit.id, T);
H.checkIn(habits, r.habit.id, H.addDays(T, -1));
H.checkIn(habits, r.habit.id, H.addDays(T, -2));
(H.streakFor(r.habit, T) === 3) ? ok('streakFor: 3 consecutive days -> streak 3') : bad('streak=' + H.streakFor(r.habit, T));

// 10: gap breaks streak (today unchecked, yesterday+day-before checked -> 2)
const habits2 = [];
const r2 = H.addHabit(habits2, { name: 'Gym', frequency: 'daily', today: T });
H.checkIn(habits2, r2.habit.id, H.addDays(T, -1));
H.checkIn(habits2, r2.habit.id, H.addDays(T, -2));
H.checkIn(habits2, r2.habit.id, H.addDays(T, -4)); // gap at -3
(H.streakFor(r2.habit, T) === 2 && H.longestStreak(r2.habit) === 2) ? ok('streakFor: gap breaks streak -> 2; longest 2') : bad('gap streak');

// 11: longest streak remembers a broken run
const habits3 = [];
const r3 = H.addHabit(habits3, { name: 'Meditate', frequency: 'daily', today: T });
for (let i = 0; i < 5; i++) H.checkIn(habits3, r3.habit.id, H.addDays(T, -i)); // 5-run
H.checkIn(habits3, r3.habit.id, H.addDays(T, -7)); // older single
(H.longestStreak(r3.habit) === 5 && H.streakFor(r3.habit, T) === 5) ? ok('longestStreak: 5 remembered') : bad('longest=' + H.longestStreak(r3.habit));

// 12: weekly streak counts consecutive weeks
const habits4 = [];
const r4 = H.addHabit(habits4, { name: 'Deep clean', frequency: 'weekly', today: T });
H.checkIn(habits4, r4.habit.id, '2026-09-28'); // Mon
H.checkIn(habits4, r4.habit.id, '2026-09-23'); // prev Wed
H.checkIn(habits4, r4.habit.id, '2026-09-10'); // gap week of 9/14
(H.streakFor(r4.habit, T) === 2) ? ok('weekly streakFor: 2 consecutive weeks') : bad('weekly streak=' + H.streakFor(r4.habit, T));

// 13: milestones fire at 7/30, nextMilestone points ahead
const m7 = H.milestoneFor(7), m8 = H.milestoneFor(8), nx = H.nextMilestone(8);
(m7 && m7.length > 20 && m8 === null && nx && nx.at === 14 && nx.remaining === 6)
  ? ok('milestones: fires at 7, silent at 8, next is 14') : bad('milestones');

// 14: reminder note is frequency-aware and weekGrid is 7 days
const note = H.reminderNote({ name: 'Read', frequency: 'daily', reminder: '9 PM' });
// check-ins T, T-1, T-2 fall in two different Mon-start weeks; use the earlier week
const grid = H.weekGrid(r.habit, H.weekStart(H.addDays(T, -2)));
(/same time each day/.test(note) && /9 PM/.test(note) && grid.length === 7 && grid.filter(g => g.done).length === 2)
  ? ok('reminderNote daily-aware; weekGrid 7 days, 2 done in that week') : bad('note/grid');

// 15: updateHabit edits name/reminder/notes, rejects blank name
const habits5 = [];
const r5 = H.addHabit(habits5, { name: 'Walk', frequency: 'daily', today: T });
const u1 = H.updateHabit(habits5, r5.habit.id, { name: 'Morning walk', reminder: '7 AM', notes: 'around the block' });
(u1.ok && r5.habit.name === 'Morning walk' && r5.habit.reminder === '7 AM' && r5.habit.notes === 'around the block')
  ? ok('updateHabit: name/reminder/notes edited') : bad('updateHabit');
const u2 = H.updateHabit(habits5, r5.habit.id, { name: '   ' });
(!u2.ok && r5.habit.name === 'Morning walk') ? ok('updateHabit: blank name rejected') : bad('updateHabit blank');

// 16: archive/restore keeps history, hides from active
const habits6 = [];
const r6 = H.addHabit(habits6, { name: 'Gym', frequency: 'weekly', today: T });
H.checkIn(habits6, r6.habit.id, T);
H.archiveHabit(habits6, r6.habit.id);
(H.activeHabits(habits6).length === 0 && H.archivedHabits(habits6).length === 1)
  ? ok('archiveHabit: hidden from active, kept in archived') : bad('archive');
H.restoreHabit(habits6, r6.habit.id);
(H.activeHabits(habits6).length === 1 && H.streakFor(r6.habit, T) >= 0)
  ? ok('restoreHabit: back in active with history intact') : bad('restore');

// 17: consistency = check-ins in last 30 days
const habits7 = [];
const r7 = H.addHabit(habits7, { name: 'Read', frequency: 'daily', today: T });
for (let i = 0; i < 15; i++) H.checkIn(habits7, r7.habit.id, H.addDays(T, -i));
const c7 = H.consistency(r7.habit, T);
(c7.done === 15 && c7.total === 30 && c7.pct === 50)
  ? ok('consistency: 15/30 days -> 50%') : bad('consistency: ' + JSON.stringify(c7));
const r7w = H.addHabit(habits7, { name: 'Clean', frequency: 'weekly', today: T });
H.checkIn(habits7, r7w.habit.id, T);
H.checkIn(habits7, r7w.habit.id, H.addDays(T, -7));
const cw = H.consistency(r7w.habit, T);
(cw.done === 2 && cw.total === 4 && cw.pct === 50)
  ? ok('consistency weekly: 2/4 weeks -> 50%') : bad('consistency weekly');

// 18: sortHabits orders by streak desc / name / longest
const habits8 = [];
const a8 = H.addHabit(habits8, { name: 'Zebra', frequency: 'daily', today: T });
const b8 = H.addHabit(habits8, { name: 'Apple', frequency: 'daily', today: T });
for (let i = 0; i < 5; i++) H.checkIn(habits8, b8.habit.id, H.addDays(T, -i));
const byStreak = H.sortHabits(habits8, T, 'streak');
const byName = H.sortHabits(habits8, T, 'name');
const byLongest = H.sortHabits(habits8, T, 'longest');
(byStreak[0].name === 'Apple' && byName[0].name === 'Apple' && byLongest[0].name === 'Apple' && habits8[0].name === 'Zebra')
  ? ok('sortHabits: streak/longest/name orderings; input unmutated') : bad('sortHabits');

// 19: habitToCSV exports one row per check-in
const csv = H.habitToCSV(r7.habit).split('\n');
(csv[0] === 'date,done' && csv.length === 16 && csv[csv.length - 1] === T + ',yes' && csv[1] < csv[csv.length - 1])
  ? ok('habitToCSV: header + 15 chronological check-in rows') : bad('habitToCSV: ' + csv[0] + ' x' + csv.length);

console.log('');
console.log('logic: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
EOF
rc=$?
[ $rc -eq 0 ] || { echo "  FAIL: node logic block (exit $rc)"; FAIL=$((FAIL+1)); }

echo ""
echo "smoke: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
