/* HabitLoop AI — pure logic (Node + browser). No DOM here. */
(function (root, factory) {
  var H = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = H;
  else root.HabitLoop = H;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var FREQUENCIES = ['daily', 'weekly'];

  var MILESTONES = [
    { at: 7,   msg: 'One week strong! You kept your promise to yourself 7 times. That is how identities change.' },
    { at: 14,  msg: 'Two weeks! The awkward beginner phase is behind you — this is becoming part of who you are.' },
    { at: 30,  msg: '30 days. A full month of showing up. Research says you are well past the hardest part.' },
    { at: 60,  msg: '60 days — you are officially the kind of person who does this. Protect the streak.' },
    { at: 100, msg: '100! Triple digits. Fewer than 1 in 20 starters make it here. Celebrate, then keep going.' },
    { at: 365, msg: 'A full year. This is no longer a habit — it is a pillar of your life. Incredible work.' }
  ];

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function toStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parse(str) {
    var p = str.split('-');
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
  }

  function addDays(str, n) {
    var d = parse(str);
    d.setDate(d.getDate() + n);
    return toStr(d);
  }

  function todayStr() { return toStr(new Date()); }

  // Monday of the week containing `str` (YYYY-MM-DD).
  function weekStart(str) {
    var d = parse(str);
    var dow = (d.getDay() + 6) % 7; // 0 = Monday
    d.setDate(d.getDate() - dow);
    return toStr(d);
  }

  var _seq = 0;
  function genId() {
    _seq += 1;
    return 'h' + Date.now().toString(36) + _seq.toString(36);
  }

  function validateHabit(name, frequency) {
    var errors = [];
    if (!name || !String(name).trim()) errors.push('Give your habit a name.');
    else if (String(name).trim().length > 80) errors.push('Keep the name under 80 characters.');
    if (FREQUENCIES.indexOf(frequency) === -1) errors.push('Frequency must be daily or weekly.');
    return { ok: errors.length === 0, errors: errors };
  }

  function addHabit(habits, input) {
    var v = validateHabit(input.name, input.frequency);
    if (!v.ok) return { ok: false, errors: v.errors };
    var habit = {
      id: genId(),
      name: String(input.name).trim(),
      frequency: input.frequency,
      notes: String(input.notes || '').trim(),
      reminder: String(input.reminder || '').trim(),
      createdAt: input.today || todayStr(),
      record: 0, // all-time longest streak (persistent record, only moves up)
      checkins: []
    };
    habits.push(habit);
    return { ok: true, habit: habit };
  }

  function findHabit(habits, id) {
    for (var i = 0; i < habits.length; i++) if (habits[i].id === id) return habits[i];
    return null;
  }

  function checkIn(habits, id, dateStr) {
    var h = findHabit(habits, id);
    if (!h) return { ok: false, error: 'Habit not found.' };
    var day = dateStr || todayStr();
    if (h.checkins.indexOf(day) !== -1) return { ok: true, already: true, habit: h };
    h.checkins.push(day);
    h.checkins.sort();
    // Persistent record: best run visible in history so far (handles backfill too).
    var best = bestRunInHistory(h);
    if (best > (h.record || 0)) h.record = best;
    return { ok: true, already: false, habit: h };
  }

  function uncheck(habits, id, dateStr) {
    var h = findHabit(habits, id);
    if (!h) return { ok: false, error: 'Habit not found.' };
    var day = dateStr || todayStr();
    var i = h.checkins.indexOf(day);
    if (i !== -1) h.checkins.splice(i, 1);
    return { ok: true, habit: h };
  }

  function uniqueSorted(dates) {
    var seen = {}, out = [];
    dates.forEach(function (d) { if (!seen[d]) { seen[d] = 1; out.push(d); } });
    return out.sort();
  }

  function dailyStreak(checkins, today) {
    var days = uniqueSorted(checkins);
    if (!days.length) return 0;
    var set = {};
    days.forEach(function (d) { set[d] = 1; });
    var cursor = set[today] ? today : addDays(today, -1);
    var n = 0;
    while (set[cursor]) { n++; cursor = addDays(cursor, -1); }
    return n;
  }

  function weeklyStreak(checkins, today) {
    var weeks = {};
    uniqueSorted(checkins).forEach(function (d) { weeks[weekStart(d)] = 1; });
    var keys = Object.keys(weeks);
    if (!keys.length) return 0;
    var thisWeek = weekStart(today);
    var cursor = weeks[thisWeek] ? thisWeek : addDays(thisWeek, -7);
    var n = 0;
    while (weeks[cursor]) { n++; cursor = addDays(cursor, -7); }
    return n;
  }

  function streakFor(habit, today) {
    today = today || todayStr();
    if (habit.frequency === 'weekly') return weeklyStreak(habit.checkins, today);
    return dailyStreak(habit.checkins, today);
  }

  // Longest run ever: the persistent record, or the best run still visible
  // in the check-in history (covers habits created before records existed).
  function longestStreak(habit) {
    return Math.max(habit.record || 0, bestRunInHistory(habit));
  }

  // Best consecutive run anywhere in the check-in history.
  function bestRunInHistory(habit) {
    var days = uniqueSorted(habit.checkins);
    if (!days.length) return 0;
    if (habit.frequency === 'weekly') {
      var weeks = uniqueSorted(days.map(weekStart));
      var best = 1, run = 1;
      for (var i = 1; i < weeks.length; i++) {
        if (addDays(weeks[i - 1], 7) === weeks[i]) run++;
        else { if (run > best) best = run; run = 1; }
      }
      return Math.max(best, run);
    }
    var b = 1, r = 1;
    for (var j = 1; j < days.length; j++) {
      if (addDays(days[j - 1], 1) === days[j]) r++;
      else { if (r > b) b = r; r = 1; }
    }
    return Math.max(b, r);
  }

  function totalCheckins(habit) { return uniqueSorted(habit.checkins).length; }

  // 7-day grid ending on (or containing) the given week start (Monday).
  function weekGrid(habit, mondayStr) {
    var set = {};
    habit.checkins.forEach(function (d) { set[d] = 1; });
    var out = [];
    for (var i = 0; i < 7; i++) {
      var day = addDays(mondayStr, i);
      out.push({ date: day, done: !!set[day], isToday: day === todayStr() });
    }
    return out;
  }

  function milestoneFor(streak) {
    for (var i = 0; i < MILESTONES.length; i++) {
      if (MILESTONES[i].at === streak) return MILESTONES[i].msg;
    }
    return null;
  }

  function nextMilestone(streak) {
    for (var i = 0; i < MILESTONES.length; i++) {
      if (MILESTONES[i].at > streak) {
        return { at: MILESTONES[i].at, remaining: MILESTONES[i].at - streak, msg: MILESTONES[i].msg };
      }
    }
    return null;
  }

  // Gentle, non-pushy reminder copy — the app stores the preferred time; the
  // note explains the anchoring technique.
  function reminderNote(habit) {
    var when = habit.reminder ? ' around ' + habit.reminder : '';
    if (habit.frequency === 'weekly') {
      return 'Gentle nudge: do "' + habit.name + '" on the same day each week' + when +
        '. One anchored slot beats seven vague intentions.';
    }
    return 'Gentle nudge: do "' + habit.name + '" at the same time each day' + when +
      ' — stack it onto something you already do (after coffee, after lunch) and it sticks faster.';
  }

  function summarize(habits, today) {
    today = today || todayStr();
    return habits.map(function (h) {
      var s = streakFor(h, today);
      return {
        id: h.id, name: h.name, frequency: h.frequency,
        streak: s, longest: longestStreak(h), total: totalCheckins(h),
        doneToday: h.checkins.indexOf(today) !== -1,
        milestone: milestoneFor(s), next: nextMilestone(s)
      };
    });
  }

  return {
    FREQUENCIES: FREQUENCIES,
    MILESTONES: MILESTONES,
    toStr: toStr, parse: parse, addDays: addDays, todayStr: todayStr, weekStart: weekStart,
    validateHabit: validateHabit, addHabit: addHabit, findHabit: findHabit,
    checkIn: checkIn, uncheck: uncheck,
    streakFor: streakFor, longestStreak: longestStreak, totalCheckins: totalCheckins,
    weekGrid: weekGrid, milestoneFor: milestoneFor, nextMilestone: nextMilestone,
    reminderNote: reminderNote, summarize: summarize
  };
}));
