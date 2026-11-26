// HomeLedger app: hash-routed single page, no network, no build step.
// State lives in localStorage under KEY; the sample in data.js is
// only the starting point and can be restored from Data & Export.

(function () {
  'use strict';

  var KEY = 'homeledger-v1';
  var MONTHS = ['2026-09', '2026-10', '2026-11'];
  var MONTH_NAMES = { '2026-09': 'September', '2026-10': 'October', '2026-11': 'November' };
  var COLORS = ['#1d7a4f', '#0f766e', '#b45309', '#1d4ed8', '#7c3aed', '#be185d', '#0891b2', '#65a30d', '#dc2626', '#475569'];
  var viewEl = document.getElementById('view');
  var modalEl = document.getElementById('modal');
  var toastEl = document.getElementById('toast');

  // ---------- state ----------
  function freshState() {
    var s = window.HOMELEDGER_SAMPLE;
    return {
      transactions: s.transactions.map(function (t, i) {
        return { id: 't' + (i + 1), date: t[0], desc: t[1], cat: t[2], amt: t[3] };
      }),
      budgets: s.budgets.map(function (b) { return { category: b.category, limit: b.limit }; }),
      goals: s.goals.map(function (g) { return { id: g.id, name: g.name, target: g.target, saved: g.saved }; }),
      bills: s.bills.map(function (b) { return { id: b.id, name: b.name, amount: b.amount, dueDay: b.dueDay, paid: b.paid }; }),
    };
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return freshState();
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.transactions)) return freshState();
      return parsed;
    } catch (e) { return freshState(); }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
  var state = load();

  // ---------- helpers ----------
  function money(n) {
    var sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function monthOf(d) { return d.slice(0, 7); }
  function inMonth(t, m) { return monthOf(t.date) === m; }
  function income(m) {
    return state.transactions.reduce(function (sum, t) {
      return sum + (inMonth(t, m) && t.amt > 0 ? t.amt : 0);
    }, 0);
  }
  function spending(m) {
    return state.transactions.reduce(function (sum, t) {
      return sum + (inMonth(t, m) && t.amt < 0 ? -t.amt : 0);
    }, 0);
  }
  function spentByCat(m) {
    var out = {};
    state.transactions.forEach(function (t) {
      if (inMonth(t, m) && t.amt < 0) out[t.cat] = (out[t.cat] || 0) + -t.amt;
    });
    return out;
  }
  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }
  function openModal(title, bodyHtml) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = bodyHtml;
    modalEl.hidden = false;
  }
  function closeModal() { modalEl.hidden = true; }
  document.getElementById('modal-close').addEventListener('click', closeModal);
  modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });

  function catOptions(selected) {
    var cats = window.HOMELEDGER_SAMPLE.categories.concat(['Income']);
    return cats.map(function (c) {
      return '<option value="' + esc(c) + '"' + (c === selected ? ' selected' : '') + '>' + esc(c) + '</option>';
    }).join('');
  }

  // ---------- dashboard ----------
  function donutSvg(byCat, total) {
    var r = 70, circ = 2 * Math.PI * r, offset = 0, parts = '';
    var cats = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    cats.forEach(function (cat, i) {
      var len = total > 0 ? (byCat[cat] / total) * circ : 0;
      parts += '<circle cx="90" cy="90" r="' + r + '" fill="none" stroke="' + COLORS[i % COLORS.length] +
        '" stroke-width="26" stroke-dasharray="' + Math.max(len - 1.5, 0).toFixed(1) + ' ' + circ.toFixed(1) +
        '" stroke-dashoffset="' + (-offset).toFixed(1) + '" transform="rotate(-90 90 90)"/>';
      offset += len;
    });
    return '<svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="Spending by category">' + parts +
      '<text x="90" y="86" text-anchor="middle" class="donut-total">' + money(total) + '</text>' +
      '<text x="90" y="106" text-anchor="middle" class="donut-center">spent in Nov</text></svg>';
  }
  function legend(byCat) {
    var cats = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; });
    return '<div class="legend">' + cats.map(function (cat, i) {
      return '<span><span class="dot" style="background:' + COLORS[i % COLORS.length] + '"></span>' +
        esc(cat) + ' ' + money(byCat[cat]) + '</span>';
    }).join('') + '</div>';
  }
  function trendBars() {
    var vals = MONTHS.map(spending);
    var max = Math.max.apply(null, vals.concat([1]));
    return '<div class="trend">' + MONTHS.map(function (m, i) {
      var h = Math.round((vals[i] / max) * 110);
      return '<div class="col"><span class="v">' + money(vals[i]) + '</span>' +
        '<div class="b" style="height:' + h + 'px"></div><span class="m">' + MONTH_NAMES[m].slice(0, 3) + '</span></div>';
    }).join('') + '</div>';
  }

  function viewDashboard() {
    var m = '2026-11';
    var inc = income(m), sp = spending(m), bal = inc - sp;
    var rate = inc > 0 ? Math.round(((inc - sp) / inc) * 100) : 0;
    var byCat = spentByCat(m);
    var closest = state.budgets.map(function (b) {
      return { category: b.category, spent: byCat[b.category] || 0, limit: b.limit };
    }).sort(function (a, b) { return (b.spent / b.limit) - (a.spent / a.limit); }).slice(0, 4);
    var upcoming = state.bills.filter(function (b) { return !b.paid; }).sort(function (a, b) { return a.dueDay - b.dueDay; });
    var recent = state.transactions.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 8);
    viewEl.innerHTML =
      '<div class="grid cards-4">' +
      '<div class="card stat"><div class="label">Income — November</div><div class="value pos" id="stat-income">' + money(inc) + '</div><div class="sub">Salary + cashback</div></div>' +
      '<div class="card stat"><div class="label">Spending — November</div><div class="value neg" id="stat-spending">' + money(sp) + '</div><div class="sub">Across ' + Object.keys(byCat).length + ' categories</div></div>' +
      '<div class="card stat"><div class="label">Balance — November</div><div class="value" id="stat-balance">' + money(bal) + '</div><div class="sub">Income minus spending</div></div>' +
      '<div class="card stat"><div class="label">Savings rate</div><div class="value" id="stat-rate">' + rate + '%</div><div class="sub">Of November income saved</div></div>' +
      '</div>' +
      '<div class="grid cards-2" style="margin-top:14px">' +
      '<div class="card"><h2>Spending by category — November</h2><div class="donut-wrap">' + donutSvg(byCat, sp) + '</div>' + legend(byCat) + '</div>' +
      '<div class="card"><h2>Monthly trend — spending</h2>' + trendBars() +
      '<p class="muted" style="margin-top:10px">September ' + money(spending('2026-09')) + ' &middot; October ' + money(spending('2026-10')) + ' &middot; November ' + money(sp) + '</p></div>' +
      '</div>' +
      '<div class="grid cards-2" style="margin-top:14px">' +
      '<div class="card"><h2>Budgets closest to the limit</h2>' +
      closest.map(function (b) {
        var pct = b.limit > 0 ? Math.round((b.spent / b.limit) * 100) : 0;
        var cls = pct > 100 ? 'red' : pct > 85 ? 'amber' : '';
        return '<div class="bar-row"><span class="name">' + esc(b.category) + '</span>' +
          '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + Math.min(pct, 100) + '%"></div></div>' +
          '<span class="pct">' + pct + '%</span><span class="amt">' + money(b.spent) + ' / ' + money(b.limit) + '</span></div>';
      }).join('') + '<p><a href="#/budgets">See all budgets &rarr;</a></p></div>' +
      '<div class="card"><h2>Upcoming bills</h2>' +
      (upcoming.length ? upcoming.map(function (b) {
        return '<div class="rowline"><span>' + esc(b.name) + ' — due Nov ' + b.dueDay + '</span><strong>' + money(b.amount) + '</strong></div>';
      }).join('') : '<p>All bills are paid for November.</p>') +
      '<p><a href="#/bills">See all bills &rarr;</a></p></div>' +
      '</div>' +
      '<div class="card" style="margin-top:14px"><h2>Recent transactions</h2><div class="table-wrap"><table>' +
      '<thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th></tr></thead><tbody>' +
      recent.map(function (t) {
        return '<tr><td>' + esc(t.date) + '</td><td>' + esc(t.desc) + '</td><td>' + esc(t.cat) + '</td>' +
          '<td class="num ' + (t.amt < 0 ? 'neg' : 'pos') + '">' + money(t.amt) + '</td></tr>';
      }).join('') + '</tbody></table></div><p><a href="#/transactions">See all transactions &rarr;</a></p></div>';
  }

  // ---------- transactions ----------
  var txFilter = { month: 'all', cat: 'all', q: '' };
  function filteredTx() {
    return state.transactions.filter(function (t) {
      if (txFilter.month !== 'all' && monthOf(t.date) !== txFilter.month) return false;
      if (txFilter.cat !== 'all' && t.cat !== txFilter.cat) return false;
      if (txFilter.q && t.desc.toLowerCase().indexOf(txFilter.q.toLowerCase()) === -1 &&
        t.cat.toLowerCase().indexOf(txFilter.q.toLowerCase()) === -1) return false;
      return true;
    }).sort(function (a, b) { return b.date.localeCompare(a.date); });
  }
  function viewTransactions() {
    var list = filteredTx();
    var spent = list.reduce(function (s, t) { return s + (t.amt < 0 ? -t.amt : 0); }, 0);
    var earned = list.reduce(function (s, t) { return s + (t.amt > 0 ? t.amt : 0); }, 0);
    viewEl.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><h2>Transactions</h2>' +
      '<button class="btn" id="tx-add">+ Add transaction</button></div>' +
      '<div class="toolbar filters">' +
      '<label>Month <select id="filter-month"><option value="all">All months</option>' +
      MONTHS.map(function (m) { return '<option value="' + m + '"' + (txFilter.month === m ? ' selected' : '') + '>' + MONTH_NAMES[m] + ' 2026</option>'; }).join('') + '</select></label>' +
      '<label>Category <select id="filter-cat"><option value="all">All categories</option>' +
      window.HOMELEDGER_SAMPLE.categories.concat(['Income']).map(function (c) { return '<option' + (txFilter.cat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label>' +
      '<label>Search <input type="search" id="filter-search" placeholder="Description or category" value="' + esc(txFilter.q) + '"></label>' +
      '</div>' +
      '<p class="muted"><span id="tx-count">' + list.length + '</span> transactions &middot; in ' + money(earned) + ' &middot; out <span id="tx-spent">' + money(spent) + '</span></p>' +
      '<div class="card" style="padding:6px 16px"><div class="table-wrap"><table id="tx-table">' +
      '<thead><tr><th>Date</th><th>Description</th><th>Category</th><th class="num">Amount</th><th></th></tr></thead><tbody>' +
      list.map(function (t) {
        return '<tr data-id="' + t.id + '"><td>' + esc(t.date) + '</td><td>' + esc(t.desc) + '</td><td>' + esc(t.cat) + '</td>' +
          '<td class="num ' + (t.amt < 0 ? 'neg' : 'pos') + '">' + money(t.amt) + '</td>' +
          '<td><button class="btn ghost small tx-edit" data-id="' + t.id + '">Edit</button> ' +
          '<button class="btn danger small tx-del" data-id="' + t.id + '">Delete</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';

    document.getElementById('filter-month').addEventListener('change', function (e) { txFilter.month = e.target.value; render(); });
    document.getElementById('filter-cat').addEventListener('change', function (e) { txFilter.cat = e.target.value; render(); });
    document.getElementById('filter-search').addEventListener('input', function (e) { txFilter.q = e.target.value; render(); });
    document.getElementById('tx-add').addEventListener('click', function () { openTxForm(null); });
    viewEl.querySelectorAll('.tx-edit').forEach(function (btn) {
      btn.addEventListener('click', function () { openTxForm(btn.getAttribute('data-id')); });
    });
    viewEl.querySelectorAll('.tx-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        state.transactions = state.transactions.filter(function (t) { return t.id !== id; });
        save(); render(); showToast('Transaction deleted.');
      });
    });
  }
  function openTxForm(id) {
    var t = id ? state.transactions.find(function (x) { return x.id === id; }) : null;
    var isNew = !t;
    var date = t ? t.date : '2026-11-24';
    var desc = t ? t.desc : '';
    var cat = t ? t.cat : 'Groceries';
    var amt = t ? Math.abs(t.amt) : '';
    var kind = t ? (t.amt < 0 ? 'expense' : 'income') : 'expense';
    openModal(isNew ? 'Add transaction' : 'Edit transaction',
      '<form id="tx-form">' +
      '<div class="form-row"><label for="f-date">Date</label><input id="f-date" type="date" value="' + esc(date) + '" required></div>' +
      '<div class="form-row"><label for="f-desc">Description</label><input id="f-desc" type="text" value="' + esc(desc) + '" required maxlength="80"></div>' +
      '<div class="form-row"><label for="f-cat">Category</label><select id="f-cat">' + catOptions(cat) + '</select></div>' +
      '<div class="form-row"><label for="f-kind">Type</label><select id="f-kind">' +
      '<option value="expense"' + (kind === 'expense' ? ' selected' : '') + '>Expense</option>' +
      '<option value="income"' + (kind === 'income' ? ' selected' : '') + '>Income</option></select></div>' +
      '<div class="form-row"><label for="f-amt">Amount (USD)</label><input id="f-amt" type="number" min="0.01" step="0.01" value="' + amt + '" required></div>' +
      '<div class="form-actions"><button type="button" class="btn ghost" id="f-cancel">Cancel</button>' +
      '<button type="submit" class="btn">Save</button></div></form>');
    document.getElementById('f-cancel').addEventListener('click', closeModal);
    document.getElementById('tx-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var val = Math.round(parseFloat(document.getElementById('f-amt').value) * 100) / 100;
      if (!val || val <= 0) { showToast('Enter an amount above zero.'); return; }
      var signed = document.getElementById('f-kind').value === 'expense' ? -val : val;
      var row = {
        id: isNew ? 't' + Date.now() : t.id,
        date: document.getElementById('f-date').value,
        desc: document.getElementById('f-desc').value.trim(),
        cat: document.getElementById('f-cat').value,
        amt: signed,
      };
      if (isNew) state.transactions.push(row);
      else { var i = state.transactions.findIndex(function (x) { return x.id === id; }); state.transactions[i] = row; }
      save(); closeModal(); render();
      showToast(isNew ? 'Transaction added.' : 'Transaction updated.');
    });
  }

  // ---------- budgets ----------
  function viewBudgets() {
    var m = '2026-11';
    var byCat = spentByCat(m);
    var totalLimit = state.budgets.reduce(function (s, b) { return s + b.limit; }, 0);
    var totalSpent = state.budgets.reduce(function (s, b) { return s + (byCat[b.category] || 0); }, 0);
    viewEl.innerHTML =
      '<h2>Budgets — November 2026</h2>' +
      '<p class="muted">Spent <strong>' + money(totalSpent) + '</strong> of <strong>' + money(totalLimit) + '</strong> budgeted (' +
      Math.round((totalSpent / totalLimit) * 100) + '%). Amber is over 85%, red is over the limit.</p>' +
      '<div class="card">' + state.budgets.map(function (b) {
        var spent = byCat[b.category] || 0;
        var pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
        var cls = pct > 100 ? 'red' : pct > 85 ? 'amber' : '';
        return '<div class="bar-row" data-cat="' + esc(b.category) + '"><span class="name">' + esc(b.category) + '</span>' +
          '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + Math.min(pct, 100) + '%"></div></div>' +
          '<span class="pct">' + pct + '%</span><span class="amt">' + money(spent) + ' / ' + money(b.limit) + '</span>' +
          '<input type="number" class="budget-limit" min="0" step="10" value="' + b.limit + '" style="width:92px" aria-label="Monthly limit for ' + esc(b.category) + '">' +
          '<button class="btn ghost small budget-save" data-cat="' + esc(b.category) + '">Save</button></div>';
      }).join('') + '</div>';
    viewEl.querySelectorAll('.budget-save').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.bar-row');
        var val = parseFloat(row.querySelector('.budget-limit').value);
        if (!val || val < 0) { showToast('Enter a limit of 0 or more.'); return; }
        var b = state.budgets.find(function (x) { return x.category === btn.getAttribute('data-cat'); });
        b.limit = val; save(); render(); showToast(b.category + ' budget set to ' + money(val) + '.');
      });
    });
  }

  // ---------- goals ----------
  function viewGoals() {
    var totalSaved = state.goals.reduce(function (s, g) { return s + g.saved; }, 0);
    var totalTarget = state.goals.reduce(function (s, g) { return s + g.target; }, 0);
    viewEl.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px"><h2>Savings goals</h2>' +
      '<button class="btn" id="goal-new">+ New goal</button></div>' +
      '<p class="muted">Saved <strong>' + money(totalSaved) + '</strong> of <strong>' + money(totalTarget) + '</strong> across ' + state.goals.length + ' goals.</p>' +
      '<div class="grid cards-2">' + state.goals.map(function (g) {
        var pct = g.target > 0 ? Math.round((g.saved / g.target) * 100) : 0;
        return '<div class="card goal-card" data-id="' + g.id + '">' +
          '<div class="goal-head"><h3>' + esc(g.name) + '</h3><span class="pill ' + (pct >= 100 ? 'green' : 'grey') + '">' + pct + '%</span></div>' +
          '<p><span class="goal-saved">' + money(g.saved) + '</span> of ' + money(g.target) + '</p>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + Math.min(pct, 100) + '%"></div></div>' +
          '<div class="goal-actions"><button class="btn small add-funds" data-id="' + g.id + '">Add funds</button>' +
          '<button class="btn ghost small goal-del" data-id="' + g.id + '">Delete</button></div></div>';
      }).join('') + '</div>';
    document.getElementById('goal-new').addEventListener('click', function () { openGoalForm(); });
    viewEl.querySelectorAll('.add-funds').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var g = state.goals.find(function (x) { return x.id === btn.getAttribute('data-id'); });
        openModal('Add funds — ' + g.name,
          '<form id="fund-form"><div class="form-row"><label for="f-amt">Amount (USD)</label>' +
          '<input id="f-amt" type="number" min="0.01" step="0.01" required></div>' +
          '<div class="form-actions"><button type="button" class="btn ghost" id="f-cancel">Cancel</button>' +
          '<button type="submit" class="btn">Add</button></div></form>');
        document.getElementById('f-cancel').addEventListener('click', closeModal);
        document.getElementById('fund-form').addEventListener('submit', function (e) {
          e.preventDefault();
          var val = Math.round(parseFloat(document.getElementById('f-amt').value) * 100) / 100;
          if (!val || val <= 0) { showToast('Enter an amount above zero.'); return; }
          g.saved = Math.round((g.saved + val) * 100) / 100;
          save(); closeModal(); render(); showToast(money(val) + ' added to ' + g.name + '.');
        });
      });
    });
    viewEl.querySelectorAll('.goal-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-id');
        state.goals = state.goals.filter(function (g) { return g.id !== id; });
        save(); render(); showToast('Goal deleted.');
      });
    });
  }
  function openGoalForm() {
    openModal('New savings goal',
      '<form id="goal-form">' +
      '<div class="form-row"><label for="f-name">Goal name</label><input id="f-name" type="text" required maxlength="60"></div>' +
      '<div class="form-row"><label for="f-target">Target (USD)</label><input id="f-target" type="number" min="1" step="1" required></div>' +
      '<div class="form-row"><label for="f-saved">Already saved (USD)</label><input id="f-saved" type="number" min="0" step="1" value="0"></div>' +
      '<div class="form-actions"><button type="button" class="btn ghost" id="f-cancel">Cancel</button>' +
      '<button type="submit" class="btn">Create goal</button></div></form>');
    document.getElementById('f-cancel').addEventListener('click', closeModal);
    document.getElementById('goal-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var target = parseFloat(document.getElementById('f-target').value);
      var saved = parseFloat(document.getElementById('f-saved').value) || 0;
      if (!target || target <= 0) { showToast('Enter a target above zero.'); return; }
      state.goals.push({ id: 'g' + Date.now(), name: document.getElementById('f-name').value.trim(), target: target, saved: saved });
      save(); closeModal(); render(); showToast('Goal created.');
    });
  }

  // ---------- bills ----------
  function viewBills() {
    var unpaid = state.bills.filter(function (b) { return !b.paid; });
    var unpaidTotal = unpaid.reduce(function (s, b) { return s + b.amount; }, 0);
    var sorted = state.bills.slice().sort(function (a, b) { return a.dueDay - b.dueDay; });
    viewEl.innerHTML =
      '<h2>Bills &amp; reminders</h2>' +
      '<p class="muted"><span id="unpaid-count">' + unpaid.length + '</span> unpaid &middot; <span id="unpaid-total">' + money(unpaidTotal) + '</span> still to pay in November.</p>' +
      '<div class="card" style="padding:6px 16px"><div class="table-wrap"><table id="bill-table">' +
      '<thead><tr><th>Bill</th><th>Due day</th><th class="num">Amount</th><th>Status</th><th></th></tr></thead><tbody>' +
      sorted.map(function (b) {
        return '<tr data-id="' + b.id + '"><td>' + esc(b.name) + '</td><td>Nov ' + b.dueDay + '</td>' +
          '<td class="num">' + money(b.amount) + '</td>' +
          '<td><span class="pill ' + (b.paid ? 'green' : 'amber') + '">' + (b.paid ? 'Paid' : 'Unpaid') + '</span></td>' +
          '<td><button class="btn ghost small bill-toggle" data-id="' + b.id + '">' + (b.paid ? 'Mark unpaid' : 'Mark paid') + '</button></td></tr>';
      }).join('') + '</tbody></table></div></div>';
    viewEl.querySelectorAll('.bill-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var b = state.bills.find(function (x) { return x.id === btn.getAttribute('data-id'); });
        b.paid = !b.paid; save(); render();
        showToast(b.name + (b.paid ? ' marked paid.' : ' marked unpaid.'));
      });
    });
  }

  // ---------- reports ----------
  function viewReports() {
    var byCat3 = {};
    state.transactions.forEach(function (t) {
      if (t.amt < 0) byCat3[t.cat] = (byCat3[t.cat] || 0) + -t.amt;
    });
    var cats = Object.keys(byCat3).sort(function (a, b) { return byCat3[b] - byCat3[a]; });
    var top = cats[0];
    var hiMonth = MONTHS.slice().sort(function (a, b) { return spending(b) - spending(a); })[0];
    var totalInc = MONTHS.reduce(function (s, m) { return s + income(m); }, 0);
    var totalSp = MONTHS.reduce(function (s, m) { return s + spending(m); }, 0);
    var overallRate = totalInc > 0 ? Math.round(((totalInc - totalSp) / totalInc) * 100) : 0;
    var over = state.budgets.filter(function (b) { return (spentByCat('2026-11')[b.category] || 0) > b.limit; });
    viewEl.innerHTML =
      '<h2>Reports — September to November 2026</h2>' +
      '<div class="card"><h3>Three-month comparison</h3><div class="table-wrap"><table id="report-table">' +
      '<thead><tr><th>Month</th><th class="num">Income</th><th class="num">Spending</th><th class="num">Balance</th><th class="num">Savings rate</th></tr></thead><tbody>' +
      MONTHS.map(function (m) {
        var inc = income(m), sp = spending(m);
        var rate = inc > 0 ? Math.round(((inc - sp) / inc) * 100) : 0;
        return '<tr><td>' + MONTH_NAMES[m] + ' 2026</td><td class="num pos">' + money(inc) + '</td>' +
          '<td class="num neg">' + money(sp) + '</td><td class="num">' + money(inc - sp) + '</td><td class="num">' + rate + '%</td></tr>';
      }).join('') +
      '<tr><td><strong>Total</strong></td><td class="num pos"><strong>' + money(totalInc) + '</strong></td>' +
      '<td class="num neg"><strong>' + money(totalSp) + '</strong></td><td class="num"><strong>' + money(totalInc - totalSp) + '</strong></td>' +
      '<td class="num"><strong>' + overallRate + '%</strong></td></tr>' +
      '</tbody></table></div></div>' +
      '<div class="grid cards-2" style="margin-top:14px">' +
      '<div class="card"><h3>Spending trend</h3>' + trendBars() + '</div>' +
      '<div class="card"><h3>Insights</h3><ul>' +
      '<li>Biggest spending category: <strong>' + esc(top) + '</strong> (' + money(byCat3[top]) + ' over 3 months).</li>' +
      '<li>Highest-spending month: <strong>' + MONTH_NAMES[hiMonth] + '</strong> (' + money(spending(hiMonth)) + ').</li>' +
      '<li>Overall savings rate: <strong>' + overallRate + '%</strong> across the three months.</li>' +
      (over.length ? '<li>Over budget in November: <strong>' + over.map(function (b) { return esc(b.category); }).join(', ') + '</strong>.</li>'
        : '<li>No category went over budget in November.</li>') +
      '<li>Groceries is the largest everyday expense — weekly shops run about $100 each.</li>' +
      '</ul></div></div>' +
      '<div class="card" style="margin-top:14px"><h3>Category totals — 3 months</h3><div class="table-wrap"><table>' +
      '<thead><tr><th>Category</th><th class="num">Total spent</th></tr></thead><tbody>' +
      cats.map(function (c) { return '<tr><td>' + esc(c) + '</td><td class="num">' + money(byCat3[c]) + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>';
  }

  // ---------- data & export ----------
  function toCsv() {
    var lines = ['date,description,category,amount'];
    state.transactions.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (t) {
      var desc = t.desc.indexOf(',') !== -1 || t.desc.indexOf('"') !== -1
        ? '"' + t.desc.replace(/"/g, '""') + '"' : t.desc;
      lines.push([t.date, desc, t.cat, t.amt.toFixed(2)].join(','));
    });
    return lines.join('\n') + '\n';
  }
  function parseCsvLine(line) {
    var out = [], cur = '', quoted = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (quoted) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else { quoted = false; }
        } else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }
  function viewData() {
    viewEl.innerHTML =
      '<h2>Data &amp; export</h2>' +
      '<div class="grid cards-2">' +
      '<div class="card"><h3>Export</h3><p>Download every transaction as a CSV file (date, description, category, amount).</p>' +
      '<p><span id="tx-total">' + state.transactions.length + '</span> transactions stored.</p>' +
      '<button class="btn" id="export-csv">Download CSV</button></div>' +
      '<div class="card"><h3>Import</h3><p>Upload a CSV with the same four columns. Rows with a bad date, unknown category or bad amount are skipped and reported.</p>' +
      '<input type="file" id="import-file" accept=".csv,text/csv">' +
      '<p id="import-result" class="muted" style="margin-top:10px">No file imported yet.</p></div>' +
      '</div>' +
      '<div class="card" style="margin-top:14px"><h3>Reset</h3><p>Throw away all edits and restore the original 80 sample transactions, budgets, goals and bills.</p>' +
      '<button class="btn danger" id="reset-data">Reset to sample data</button></div>';
    document.getElementById('export-csv').addEventListener('click', function () {
      var blob = new Blob([toCsv()], { type: 'text/csv' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'homeledger-transactions.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      showToast('CSV downloaded.');
    });
    document.getElementById('import-file').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || '');
        var rows = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
        var validCats = window.HOMELEDGER_SAMPLE.categories.concat(['Income']);
        var added = 0, skipped = 0;
        rows.forEach(function (line, idx) {
          if (idx === 0 && line.toLowerCase().indexOf('date') === 0) return;
          var parts = parseCsvLine(line);
          if (parts.length !== 4) { skipped++; return; }
          var date = parts[0].trim(), desc = parts[1].trim(), cat = parts[2].trim();
          var amt = parseFloat(parts[3]);
          var okDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
          if (!okDate || !desc || validCats.indexOf(cat) === -1 || isNaN(amt) || amt === 0) { skipped++; return; }
          state.transactions.push({ id: 't' + Date.now() + '-' + idx, date: date, desc: desc, cat: cat, amt: Math.round(amt * 100) / 100 });
          added++;
        });
        save();
        document.getElementById('import-result').textContent =
          'Imported ' + added + ' transaction' + (added === 1 ? '' : 's') + ', skipped ' + skipped + ' row' + (skipped === 1 ? '' : 's') + '.';
        showToast('Import finished: ' + added + ' added, ' + skipped + ' skipped.');
      };
      reader.readAsText(file);
    });
    document.getElementById('reset-data').addEventListener('click', function () {
      state = freshState(); save(); render();
      showToast('Sample data restored.');
    });
  }

  // ---------- router ----------
  var VIEWS = {
    dashboard: viewDashboard, transactions: viewTransactions, budgets: viewBudgets,
    goals: viewGoals, bills: viewBills, reports: viewReports, data: viewData,
  };
  function render() {
    var name = (location.hash || '#/dashboard').replace('#/', '').split('/')[0];
    if (!VIEWS[name]) name = 'dashboard';
    document.querySelectorAll('.nav a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-view') === name);
    });
    VIEWS[name]();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', render);
  render();
})();
