/* HabitLoop AI — DOM wiring. */
(function () {
  'use strict';
  var H = window.HabitLoop;
  var LS_KEY = 'habitloop.habits.v1';
  var gridOffset = 0; // weeks back from current week

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function save(habits) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(habits)); } catch (e) {}
  }

  var habits = load();

  function el(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function dayLabel(dateStr) {
    var d = H.parse(dateStr);
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  }

  function render() {
    save(habits);
    var today = H.todayStr();
    var list = el('habit-list');
    var summary = H.summarize(habits, today);

    el('stat-habits').textContent = habits.length;
    var totalStreak = summary.reduce(function (a, s) { return a + s.streak; }, 0);
    el('stat-streaks').textContent = totalStreak;
    var best = summary.reduce(function (a, s) { return Math.max(a, s.longest); }, 0);
    el('stat-best').textContent = best;

    // Milestone banner: newest milestone hit today
    var banner = el('milestone-banner');
    var hits = summary.filter(function (s) { return s.milestone; });
    if (hits.length) {
      banner.style.display = 'block';
      banner.innerHTML = '<strong>🎉 Milestone!</strong> ' +
        hits.map(function (s) { return '<strong>' + esc(s.name) + '</strong> — ' + esc(s.milestone); }).join('<br>');
    } else {
      banner.style.display = 'none';
    }

    if (!habits.length) {
      list.innerHTML = '<div class="empty">No habits yet. Add your first one above — start small, win daily.</div>';
      return;
    }

    list.innerHTML = summary.map(function (s) {
      var h = H.findHabit(habits, s.id);
      var monday = H.addDays(H.weekStart(today), gridOffset * 7);
      var grid = H.weekGrid(h, monday);
      var gridHtml = grid.map(function (g) {
        var cls = 'day' + (g.done ? ' done' : '') + (g.isToday ? ' today' : '');
        return '<button class="' + cls + '" data-act="toggle" data-id="' + s.id + '" data-date="' + g.date + '" title="' + g.date + '">' +
          dayLabel(g.date) + '<span>' + g.date.slice(8) + '</span></button>';
      }).join('');
      var next = s.next ? '<div class="next">Next milestone: <strong>' + s.next.at + '</strong> (' + s.next.remaining + ' to go)</div>' : '<div class="next">All milestones conquered 🏆</div>';
      return '<div class="card">' +
        '<div class="card-head"><div><h3>' + esc(s.name) + '</h3>' +
        '<div class="meta">' + esc(s.frequency) + (h.reminder ? ' · ⏰ ' + esc(h.reminder) : '') + '</div></div>' +
        '<div class="streak"><span class="num">' + s.streak + '</span><span class="lbl">' + (s.frequency === 'weekly' ? 'wk streak' : 'day streak') + '</span></div></div>' +
        '<div class="grid">' + gridHtml + '</div>' +
        '<div class="grid-nav"><button data-act="prev" data-id="' + s.id + '">← earlier</button>' +
        '<button data-act="now" data-id="' + s.id + '">this week</button></div>' +
        '<div class="stats">Longest: <strong>' + s.longest + '</strong> · Total check-ins: <strong>' + s.total + '</strong></div>' +
        next +
        (h.notes ? '<div class="notes">📝 ' + esc(h.notes) + '</div>' : '') +
        '<div class="reminder">' + esc(H.reminderNote(h)) + '</div>' +
        '<div class="card-actions"><button class="danger" data-act="del" data-id="' + s.id + '">Delete habit</button></div>' +
        '</div>';
    }).join('');
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var act = t.getAttribute('data-act');
    var id = t.getAttribute('data-id');
    if (act === 'toggle') {
      var date = t.getAttribute('data-date');
      var h = H.findHabit(habits, id);
      if (h && h.checkins.indexOf(date) !== -1) H.uncheck(habits, id, date);
      else H.checkIn(habits, id, date);
      render();
    } else if (act === 'del') {
      if (confirm('Delete this habit and its history?')) {
        habits = habits.filter(function (x) { return x.id !== id; });
        render();
      }
    } else if (act === 'prev') { gridOffset -= 1; render(); }
    else if (act === 'now') { gridOffset = 0; render(); }
  });

  el('habit-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = el('f-name').value;
    var freq = el('f-freq').value;
    var reminder = el('f-reminder').value;
    var notes = el('f-notes').value;
    var res = H.addHabit(habits, { name: name, frequency: freq, reminder: reminder, notes: notes });
    var err = el('form-error');
    if (!res.ok) { err.textContent = res.errors.join(' '); err.style.display = 'block'; return; }
    err.style.display = 'none';
    el('f-name').value = ''; el('f-reminder').value = ''; el('f-notes').value = '';
    render();
  });

  // Seed one example on first run so the UI isn't empty
  if (!habits.length && !localStorage.getItem('habitloop.seeded')) {
    var r = H.addHabit(habits, { name: 'Read 10 pages', frequency: 'daily', reminder: '9:00 PM', notes: 'Finish "Atomic Habits" first!' });
    if (r.ok) {
      var t = H.todayStr();
      H.checkIn(habits, r.habit.id, t);
      H.checkIn(habits, r.habit.id, H.addDays(t, -1));
      H.checkIn(habits, r.habit.id, H.addDays(t, -2));
    }
    try { localStorage.setItem('habitloop.seeded', '1'); } catch (e) {}
  }

  render();
})();
