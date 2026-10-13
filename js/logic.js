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

  // Curated per-habit accent palette (Streaks-style). Deterministic by habit id
  // so existing habits keep their color across reloads.
  var HABIT_COLORS = ['#0f766e', '#b4541f', '#3b6ea5', '#7c4da0', '#a5821f', '#c2485c'];
  function habitColor(habit) {
    var id = String((habit && habit.id) || '');
    var hash = 0;
    for (var i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    return HABIT_COLORS[hash % HABIT_COLORS.length];
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
    habit.color = habitColor(habit);
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

  // Edit a habit's details in place (name/frequency can't change type history, but
  // name, reminder, notes are freely editable).
  function updateHabit(habits, id, fields) {
    var h = findHabit(habits, id);
    if (!h) return { ok: false, error: 'Habit not found.' };
    if (fields.name != null) {
      var nm = String(fields.name).trim();
      if (!nm) return { ok: false, error: 'Give your habit a name.' };
      if (nm.length > 80) return { ok: false, error: 'Keep the name under 80 characters.' };
      h.name = nm;
    }
    if (fields.frequency != null && fields.frequency !== h.frequency) {
      if (FREQUENCIES.indexOf(fields.frequency) === -1)
        return { ok: false, error: 'Frequency must be daily or weekly.' };
      h.frequency = fields.frequency;
    }
    if (fields.reminder != null) h.reminder = String(fields.reminder).trim();
    if (fields.notes != null) h.notes = String(fields.notes).trim();
    return { ok: true, habit: h };
  }

  // Archive a habit (soft-delete) — keeps history for restore.
  function archiveHabit(habits, id) {
    var h = findHabit(habits, id);
    if (!h) return { ok: false, error: 'Habit not found.' };
    h.archived = true;
    return { ok: true, habit: h };
  }

  function restoreHabit(habits, id) {
    var h = findHabit(habits, id);
    if (!h) return { ok: false, error: 'Habit not found.' };
    delete h.archived;
    return { ok: true, habit: h };
  }

  function activeHabits(habits) { return habits.filter(function (h) { return !h.archived; }); }
  function archivedHabits(habits) { return habits.filter(function (h) { return !!h.archived; }); }

  // 30-day consistency: share of days (daily) or weeks (weekly) with check-ins.
  function consistency(habit, today) {
    today = today || todayStr();
    var n = 30, hit = 0;
    if (habit.frequency === 'weekly') {
      var weeks = {};
      habit.checkins.forEach(function (d) { weeks[weekStart(d)] = 1; });
      for (var w = 0; w < 4; w++) {
        if (weeks[weekStart(addDays(today, -7 * w))]) hit++;
      }
      return { done: hit, total: 4, pct: Math.round(hit / 4 * 100) };
    }
    var set = {};
    habit.checkins.forEach(function (d) { set[d] = 1; });
    for (var i = 0; i < n; i++) {
      if (set[addDays(today, -i)]) hit++;
    }
    return { done: hit, total: n, pct: Math.round(hit / n * 100) };
  }

  // Sort habits for display: 'streak' | 'longest' | 'name' | 'created'.
  function sortHabits(habits, today, mode) {
    today = today || todayStr();
    var info = {};
    habits.forEach(function (h) {
      info[h.id] = { streak: streakFor(h, today), longest: longestStreak(h) };
    });
    return habits.slice().sort(function (a, b) {
      if (mode === 'name') return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
      if (mode === 'longest') return info[b.id].longest - info[a.id].longest;
      if (mode === 'created') return (a.createdAt || '') < (b.createdAt || '') ? -1 : 1;
      return info[b.id].streak - info[a.id].streak; // 'streak' default
    });
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  // Export one habit's check-in history as CSV.
    // ---- starter packs: curated habit bundles, one click to begin ----
  var STARTER_PACKS = [
    { id: 'morning', name: 'Morning routine', desc: 'Win the first hour of the day.',
      habits: [
        { name: 'Make the bed', frequency: 'daily' },
        { name: 'Drink a glass of water', frequency: 'daily' },
        { name: 'Stretch for 5 minutes', frequency: 'daily' }
      ] },
    { id: 'fitness', name: 'Fitness basics', desc: 'Move a little, every day.',
      habits: [
        { name: 'Walk 20 minutes', frequency: 'daily' },
        { name: 'Strength session', frequency: 'weekly' },
        { name: 'Stretch before bed', frequency: 'daily' }
      ] },
    { id: 'focus', name: 'Deep focus', desc: 'Protect your attention.',
      habits: [
        { name: 'One 90-minute focus block', frequency: 'daily' },
        { name: 'No phone in the first hour', frequency: 'daily' },
        { name: 'Plan tomorrow tonight', frequency: 'daily' }
      ] },
    { id: 'evening', name: 'Evening wind-down', desc: 'End the day on purpose.',
      habits: [
        { name: 'Read 10 pages', frequency: 'daily' },
        { name: 'Tidy one room', frequency: 'daily' },
        { name: 'Lights out by 11', frequency: 'daily' }
      ] }
  ];

  // Add every habit in a pack that isn't already tracked (case-insensitive).
  function addPack(habits, packId, today) {
    var pack = null;
    STARTER_PACKS.forEach(function (p) { if (p.id === packId) pack = p; });
    if (!pack) return { ok: false, error: 'Unknown starter pack.' };
    var names = {};
    habits.forEach(function (h) { names[String(h.name).toLowerCase()] = 1; });
    var added = [], skipped = [];
    pack.habits.forEach(function (def) {
      if (names[String(def.name).toLowerCase()]) { skipped.push(def.name); return; }
      var res = addHabit(habits, { name: def.name, frequency: def.frequency, notes: def.notes || '', today: today });
      if (res.ok) { added.push(res.habit.name); names[String(def.name).toLowerCase()] = 1; }
      else skipped.push(def.name);
    });
    return { ok: true, pack: pack.name, added: added, skipped: skipped };
  }

  // ---- year heatmap: 52 weeks of check-in density across all active habits ----
  function yearHeatmap(habits, today) {
    today = today || todayStr();
    var counts = {};
    (habits || []).forEach(function (h) {
      if (h.archived) return;
      (h.checkins || []).forEach(function (d) { counts[d] = (counts[d] || 0) + 1; });
    });
    var weeks = [];
    for (var w = 51; w >= 0; w--) {
      var ws = addDays(weekStart(today), -7 * w);
      var days = [];
      for (var i = 0; i < 7; i++) {
        var d = addDays(ws, i);
        days.push({ date: d, count: counts[d] || 0, future: d > today });
      }
      weeks.push({ week: ws, days: days });
    }
    return weeks;
  }

  // ---- export every habit's check-ins as one CSV ----
  function allToCSV(habits) {
    var rows = [['habit', 'date', 'done']];
    (habits || []).forEach(function (h) {
      uniqueSorted(h.checkins || []).forEach(function (d) {
        rows.push([csvCell(h.name), csvCell(d), 'yes']);
      });
    });
    return rows.map(function (r) { return r.join(','); }).join('\n');
  }

  // ---- weekday rhythm: where in the week you actually show up ----
  // Last 90 days of daily-habit check-ins, bucketed by weekday.
  function weekdayStats(habits, today) {
    today = today || todayStr();
    var NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var done = [0, 0, 0, 0, 0, 0, 0], total = [0, 0, 0, 0, 0, 0, 0];
    var any = false;
    (habits || []).forEach(function (h) {
      if (h.archived || h.frequency !== 'daily') return;
      any = true;
      var set = {};
      (h.checkins || []).forEach(function (d) { set[d] = 1; });
      for (var i = 0; i < 90; i++) {
        var d = addDays(today, -i);
        // Days before the habit existed count as misses only if untracked;
        // a backfilled check-in always counts (the habit was tracked that day).
        if (!set[d] && h.createdAt && d < h.createdAt) continue;
        var dow = parse(d).getDay();
        total[dow]++;
        if (set[d]) done[dow]++;
      }
    });
    var days = NAMES.map(function (n, i) {
      return { day: n, done: done[i], total: total[i],
        pct: total[i] ? Math.round(done[i] / total[i] * 100) : null };
    });
    var ranked = days.filter(function (x) { return x.total >= 8; });
    ranked.sort(function (a, b) { return b.pct - a.pct; });
    return {
      days: days,
      strongest: ranked.length ? ranked[0].day : null,
      weakest: ranked.length ? ranked[ranked.length - 1].day : null,
      hasData: any
    };
  }

  // ---- effort ratings: how hard did today feel? (1 = easy … 5 = brutal) ----
  // Stored per-date on the habit, separate from check-ins so old data stays valid.
  function setEffort(habits, id, dateStr, rating) {
    var h = findHabit(habits, id);
    if (!h) return { ok: false, error: 'Habit not found.' };
    var r = parseInt(rating, 10);
    if (!(r >= 1 && r <= 5)) return { ok: false, error: 'Effort must be 1–5.' };
    if (h.checkins.indexOf(dateStr) === -1)
      return { ok: false, error: 'Check in first, then rate the effort.' };
    if (!h.effort) h.effort = {};
    h.effort[dateStr] = r;
    return { ok: true, habit: h };
  }

  function avgEffort(habit, days, today) {
    today = today || todayStr();
    days = days || 30;
    var eff = habit.effort || {};
    var sum = 0, n = 0;
    for (var i = 0; i < days; i++) {
      var v = eff[addDays(today, -i)];
      if (v) { sum += v; n++; }
    }
    return n ? { avg: Math.round(sum / n * 10) / 10, n: n } : null;
  }

  // ---- flexible weekly targets for daily habits ----
  // "Exercise 4x/week" instead of a strict daily chain: the week counts as
  // met when done >= target. Default 7 = classic strict daily.
  function setWeeklyTarget(habits, id, target) {
    var h = findHabit(habits, id);
    if (!h) return { ok: false, error: 'Habit not found.' };
    var t = parseInt(target, 10);
    if (!(t >= 1 && t <= 7)) return { ok: false, error: 'Weekly target must be 1–7 days.' };
    if (h.frequency !== 'daily') return { ok: false, error: 'Weekly targets apply to daily habits.' };
    h.weeklyTarget = t;
    return { ok: true, habit: h };
  }

  function weeklyProgress(habit, today) {
    today = today || todayStr();
    if (habit.frequency !== 'daily') return null;
    var target = habit.weeklyTarget || 7;
    var ws = weekStart(today);
    var set = {};
    (habit.checkins || []).forEach(function (d) { set[d] = 1; });
    var done = 0;
    for (var i = 0; i < 7; i++) if (set[addDays(ws, i)]) done++;
    return { done: done, target: target, met: done >= target,
      remaining: Math.max(0, target - done), flexible: target < 7 };
  }

  function habitToCSV(habit) {
    var rows = [['date', 'done']];
    uniqueSorted(habit.checkins).forEach(function (d) {
      rows.push([csvCell(d), 'yes']);
    });
    return rows.map(function (r) { return r.join(','); }).join('\n');
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
    reminderNote: reminderNote, summarize: summarize,
    HABIT_COLORS: HABIT_COLORS, habitColor: habitColor,
    updateHabit: updateHabit, archiveHabit: archiveHabit, restoreHabit: restoreHabit,
    activeHabits: activeHabits, archivedHabits: archivedHabits,
    consistency: consistency, sortHabits: sortHabits, habitToCSV: habitToCSV,
    STARTER_PACKS: STARTER_PACKS, addPack: addPack,
    yearHeatmap: yearHeatmap, allToCSV: allToCSV,
    weekdayStats: weekdayStats,
    setEffort: setEffort, avgEffort: avgEffort,
    setWeeklyTarget: setWeeklyTarget, weeklyProgress: weeklyProgress
  };
}));
