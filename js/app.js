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
  var sortMode = 'streak'; // streak | longest | name | created
  var editingId = null;

  function downloadCSV(csv, filename) {
    var blob = new Blob([csv], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
  }

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
    var active = H.sortHabits(H.activeHabits(habits), today, sortMode);
    var archived = H.archivedHabits(habits);
    var list = el('habit-list');
    var summary = H.summarize(active, today);
    var sumById = {};
    summary.forEach(function (s) { sumById[s.id] = s; });

    el('stat-habits').textContent = active.length;
    var totalStreak = summary.reduce(function (a, s) { return a + s.streak; }, 0);
    el('stat-streaks').textContent = totalStreak;
    var best = summary.reduce(function (a, s) { return Math.max(a, s.longest); }, 0);
    el('stat-best').textContent = best;

    // Milestone banner: newest milestone hit today
    var banner = el('milestone-banner');
    var hits = summary.filter(function (s) { return s.milestone; });
    if (hits.length) {
      banner.style.display = 'block';
      banner.innerHTML = '<strong>Milestone!</strong> ' +
        hits.map(function (s) { return '<strong>' + esc(s.name) + '</strong> — ' + esc(s.milestone); }).join('<br>');
    } else {
      banner.style.display = 'none';
    }

    var sortHtml = '<label class="sort-lbl">Sort <select id="sortSel">' +
      [['streak', 'Best streak'], ['longest', 'Longest ever'], ['name', 'Name A–Z'], ['created', 'Newest first']].map(function (o) {
        return '<option value="' + o[0] + '"' + (sortMode === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>';
    el('sortWrap').innerHTML = active.length ? sortHtml : '';

    if (!active.length) {
      list.innerHTML = '<div class="empty">No habits yet. Add your first one above — start small, win daily.</div>';
    } else {
      list.innerHTML = active.map(function (h) {
        var s = sumById[h.id];
        var monday = H.addDays(H.weekStart(today), gridOffset * 7);
        var grid = H.weekGrid(h, monday);
        var gridHtml = grid.map(function (g) {
          var cls = 'day' + (g.done ? ' done' : '') + (g.isToday ? ' today' : '');
          return '<button class="' + cls + '" data-act="toggle" data-id="' + s.id + '" data-date="' + g.date + '" title="' + g.date + '">' +
            dayLabel(g.date) + '<span>' + g.date.slice(8) + '</span></button>';
        }).join('');
        var next = s.next ? '<div class="next">Next milestone: <strong>' + s.next.at + '</strong> (' + s.next.remaining + ' to go)</div>' : '<div class="next">All milestones conquered</div>';
        var cons = H.consistency(h, today);
        if (editingId === h.id) {
          return '<div class="card"><div class="card-head"><div><h3>Editing habit</h3></div></div>' +
            '<div class="edit-form"><label class="field"><span class="flbl">Habit name</span>' +
            '<input id="e-name" type="text" maxlength="80" value="' + esc(h.name) + '"></label>' +
            '<div class="row"><label class="field"><span class="flbl">Frequency</span><select id="e-freq">' +
            '<option value="daily"' + (h.frequency === 'daily' ? ' selected' : '') + '>Daily</option>' +
            '<option value="weekly"' + (h.frequency === 'weekly' ? ' selected' : '') + '>Weekly</option></select></label>' +
            '<label class="field"><span class="flbl">Preferred time</span>' +
            '<input id="e-reminder" type="text" maxlength="20" value="' + esc(h.reminder || '') + '"></label></div>' +
            '<label class="field"><span class="flbl">Notes</span>' +
            '<input id="e-notes" type="text" maxlength="200" value="' + esc(h.notes || '') + '"></label>' +
            '<div class="row"><button class="primary small" data-act="save-edit" data-id="' + h.id + '">Save</button>' +
            '<button class="ghost-btn" data-act="cancel-edit">Cancel</button></div>' +
            '<div class="error" id="e-error" style="display:none"></div></div></div>';
        }
        return '<div class="card">' +
          '<div class="card-head"><div><h3>' + esc(s.name) + '</h3>' +
          '<div class="meta">' + esc(s.frequency) + (h.reminder ? ' · ' + esc(h.reminder) : '') + '</div></div>' +
          '<div class="streak"><span class="num">' + s.streak + '</span><span class="lbl">' + (s.frequency === 'weekly' ? 'wk streak' : 'day streak') + '</span></div></div>' +
          '<div class="grid">' + gridHtml + '</div>' +
          '<div class="grid-nav"><button data-act="prev" data-id="' + s.id + '">← earlier</button>' +
          '<button data-act="now" data-id="' + s.id + '">this week</button></div>' +
          '<div class="stats">Longest: <strong>' + s.longest + '</strong> · Total check-ins: <strong>' + s.total + '</strong> · ' +
          '30-day consistency: <strong>' + cons.pct + '%</strong> (' + cons.done + '/' + cons.total + ')</div>' +
          next +
          (h.notes ? '<div class="notes">' + esc(h.notes) + '</div>' : '') +
          '<div class="reminder">' + esc(H.reminderNote(h)) + '</div>' +
          '<div class="card-actions"><button class="ghost-btn" data-act="edit" data-id="' + s.id + '">Edit</button>' +
          '<button class="ghost-btn" data-act="export" data-id="' + s.id + '">Export CSV</button>' +
          '<button class="ghost-btn" data-act="archive" data-id="' + s.id + '">Archive</button>' +
          '<button class="danger" data-act="del" data-id="' + s.id + '">Delete</button></div>' +
          '</div>';
      }).join('');
    }

    // archived section
    var archBox = el('archived-list');
    var archWrap = el('archived-wrap');
    if (!archived.length) { archWrap.style.display = 'none'; }
    else {
      archWrap.style.display = '';
      archBox.innerHTML = archived.map(function (h) {
        return '<div class="card archived"><div class="card-head"><div><h3>' + esc(h.name) + '</h3>' +
          '<div class="meta">' + esc(h.frequency) + ' · ' + h.checkins.length + ' check-ins kept</div></div></div>' +
          '<div class="card-actions"><button class="ghost-btn" data-act="restore" data-id="' + h.id + '">Restore</button>' +
          '<button class="danger" data-act="del" data-id="' + h.id + '">Delete forever</button></div></div>';
      }).join('');
    }

    var sortSel = el('sortSel');
    if (sortSel) sortSel.addEventListener('change', function () { sortMode = this.value; render(); });
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
    } else if (act === 'edit') { editingId = id; render();
    } else if (act === 'cancel-edit') { editingId = null; render();
    } else if (act === 'save-edit') {
      var res = H.updateHabit(habits, id, {
        name: el('e-name').value, frequency: el('e-freq').value,
        reminder: el('e-reminder').value, notes: el('e-notes').value
      });
      if (!res.ok) {
        var err = el('e-error');
        err.textContent = res.errors ? res.errors.join(' ') : res.error;
        err.style.display = 'block';
        return;
      }
      editingId = null; render();
    } else if (act === 'export') {
      var h = H.findHabit(habits, id);
      if (h) downloadCSV(H.habitToCSV(h), h.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '-habit.csv');
    } else if (act === 'archive') {
      H.archiveHabit(habits, id);
      render();
    } else if (act === 'restore') {
      H.restoreHabit(habits, id);
      render();
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
