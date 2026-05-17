// All DOM render functions. Depends on: format.js, state.js, trades.js

// ── Stat Pills ──────────────────────────────────────────────────────────────
function renderStatPills(stats) {
  const pf  = isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞';
  const awl = isFinite(stats.avgWinLoss)   ? stats.avgWinLoss.toFixed(2)   : '∞';
  const total = stats.winCount + stats.lossCount;

  const pill = (label, value, cls, sub) =>
    `<div class="stat-pill">
       <span class="label">${label}</span>
       <span class="value ${cls}">${value}</span>
       <span class="sub">${sub}</span>
     </div>`;

  document.getElementById('stat-pills').innerHTML =
    pill('Net P&amp;L', fmtINR(stats.netPnl), stats.netPnl >= 0 ? 'green' : 'red',
         `${total} completed trade${total !== 1 ? 's' : ''}`) +
    pill('Trade Win %', stats.tradeWinPct.toFixed(1) + '%', '',
         `${stats.winCount} Wins · ${stats.lossCount} Losses`) +
    pill('Profit Factor', pf, '',
         `W ${fmtINR(stats.totalWins, false)} · L ${fmtINR(stats.totalLosses, false)}`) +
    pill('Day Win %', stats.dayWinPct.toFixed(1) + '%', '',
         `${stats.greenDays} Green · ${stats.redDays} Red`) +
    pill('Avg Win / Loss', awl, '',
         `+${fmtINR(stats.avgWin, false)} · −${fmtINR(stats.avgLoss, false)}`);
}

// ── Charts ───────────────────────────────────────────────────────────────────
function renderCharts(stats) {
  const { dailyArr, cumulativeArr } = stats;

  if (window._cumChart) { window._cumChart.destroy(); window._cumChart = null; }
  if (window._dayChart) { window._dayChart.destroy(); window._dayChart = null; }

  const cumWrap   = document.getElementById('cumulative-wrap');
  const dailyWrap = document.getElementById('daily-wrap');
  const cumLabel  = document.getElementById('cum-pnl-label');

  if (!dailyArr.length) {
    cumWrap.innerHTML   = `<div class="chart-empty"><div class="chart-empty-icon">📈</div><div class="chart-empty-text">Import trades to see P&L curve</div></div>`;
    dailyWrap.innerHTML = `<div class="chart-empty"><div class="chart-empty-icon">📊</div><div class="chart-empty-text">Import trades to see daily P&L</div></div>`;
    cumLabel.textContent = '—';
    cumLabel.style.color = 'var(--text-secondary)';
    return;
  }

  if (!cumWrap.querySelector('canvas'))   cumWrap.innerHTML   = '<canvas id="cumulativeChart"></canvas>';
  if (!dailyWrap.querySelector('canvas')) dailyWrap.innerHTML = '<canvas id="dailyChart"></canvas>';

  const lastCum = cumulativeArr[cumulativeArr.length - 1].pnl;
  cumLabel.textContent = fmtINR(lastCum);
  cumLabel.style.color = lastCum >= 0 ? 'var(--green)' : 'var(--red)';

  const labels  = dailyArr.map(d => fmtDateChart(d.date));
  const cumData = cumulativeArr.map(d => d.pnl);
  const dayData = dailyArr.map(d => d.pnl);

  window._cumChart = new Chart(
    document.getElementById('cumulativeChart').getContext('2d'),
    {
      type: 'line',
      data: { labels, datasets: [{ data: cumData, borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.06)', fill: true, borderWidth: 2, pointRadius: 2, pointHoverRadius: 5, tension: 0.3 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#737373', maxTicksLimit: 10 } },
          y: { grid: { color: '#f5f5f5' }, ticks: { font: { size: 10 }, color: '#737373', callback: v => '₹' + (Math.abs(v) >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0)) } },
        },
      },
    }
  );

  window._dayChart = new Chart(
    document.getElementById('dailyChart').getContext('2d'),
    {
      type: 'bar',
      data: { labels, datasets: [{ data: dayData, backgroundColor: dayData.map(v => v >= 0 ? '#16a34a' : '#dc2626'), borderRadius: 4, borderSkipped: false }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#737373', maxTicksLimit: 10 } },
          y: { grid: { color: '#f5f5f5' }, ticks: { font: { size: 10 }, color: '#737373', callback: v => '₹' + (Math.abs(v) >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0)) } },
        },
      },
    }
  );
}

// ── Calendar ─────────────────────────────────────────────────────────────────
function renderCalendar(dayPnl, dailyArr) {
  const tbl = document.getElementById('calendar-table');
  const today = new Date();

  let year, month;
  if (dailyArr && dailyArr.length) {
    const d = new Date(dailyArr[dailyArr.length - 1].date + 'T00:00:00');
    year = d.getFullYear(); month = d.getMonth();
  } else {
    year = today.getFullYear(); month = today.getMonth();
  }

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('cal-title').textContent = `${MONTHS[month]} ${year}`;

  const firstDay     = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();
  const DAY_HEADERS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const weeks = [];
  let week = [];
  for (let i = 0; i < firstDay; i++) week.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  while (week.length > 0 && week.length < 7) week.push(null);
  if (week.length) weeks.push(week);

  let html = '<thead><tr>';
  DAY_HEADERS.forEach(d => { html += `<th>${d}</th>`; });
  html += '<th class="week-sum-header">P&amp;L</th><th class="week-sum-header">Days</th></tr></thead><tbody>';

  weeks.forEach(w => {
    html += '<tr class="week-row">';
    let weekPnl = 0, weekDays = 0;

    w.forEach(d => {
      if (d === null) { html += '<td class="day-cell other-month"></td>'; return; }

      const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const pnl      = dayPnl && key in dayPnl ? dayPnl[key] : null;
      const isToday  = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

      if (pnl !== null) { weekPnl += pnl; weekDays++; }

      let cls = 'day-cell' + (isToday ? ' today' : '');
      const miniCls  = pnl !== null ? (pnl >= 0 ? 'up' : 'down') : '';
      const miniText = pnl !== null
        ? (pnl >= 0 ? '+' : '') + (Math.abs(pnl) >= 1000 ? (pnl/1000).toFixed(1)+'k' : pnl.toFixed(0))
        : '';

      html += `<td class="${cls}">
        <span class="day-num">${d}</span>
        ${miniText ? `<span class="mini-pnl ${miniCls}">${miniText}</span>` : ''}
      </td>`;
    });

    const wCls = weekPnl >= 0 ? 'up' : 'down';
    html += `<td><span class="week-pnl ${wCls}">${weekDays > 0 ? fmtINR(weekPnl) : '—'}</span></td>`;
    html += `<td><span class="week-trades">${weekDays > 0 ? weekDays + ' day' + (weekDays !== 1 ? 's' : '') : '—'}</span></td>`;
    html += '</tr>';
  });

  tbl.innerHTML = html + '</tbody>';
}

// ── Weekday Bars ─────────────────────────────────────────────────────────────
function renderWeekdayBars(trades) {
  const container = document.getElementById('weekday-bars');
  const DAY_NAMES = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const stats = Array.from({ length: 7 }, () => ({ pnl: 0, trades: 0, wins: 0 }));

  for (const t of trades) {
    const dow = new Date(t.entryTime.replace(' ', 'T')).getDay();
    stats[dow].pnl += t.pnl;
    stats[dow].trades++;
    if (t.result === 'win') stats[dow].wins++;
  }

  const tradingDays = [1,2,3,4,5].map(i => ({
    day: DAY_NAMES[i],
    pnl: stats[i].pnl,
    trades: stats[i].trades,
    winPct: stats[i].trades > 0 ? Math.round(stats[i].wins / stats[i].trades * 100) : 0,
  }));

  if (!trades.length) {
    container.innerHTML = tradingDays.map(w =>
      `<div class="weekday-bar" style="height:40px;"><div class="day-label">${w.day}</div><div class="day-pnl" style="color:var(--text-secondary);">—</div><div class="day-meta">no data</div></div>`
    ).join('');
    document.getElementById('best-day-label').textContent = '';
    return;
  }

  const maxAbs = Math.max(1, ...tradingDays.map(w => Math.abs(w.pnl)));
  const best   = tradingDays.reduce((a, b) => b.pnl > a.pnl ? b : a);
  document.getElementById('best-day-label').textContent = best.trades > 0 ? `Best day: ${best.day}` : '';

  container.innerHTML = tradingDays.map(w => {
    const height = w.trades > 0 ? Math.max(30, (Math.abs(w.pnl) / maxAbs) * 120) : 30;
    return `<div class="weekday-bar${w.day === best.day && best.trades > 0 ? ' best' : ''}${w.pnl < 0 ? ' negative' : ''}" style="height:${height}px">
      <div class="day-label">${w.day}</div>
      <div class="day-pnl" style="color:${w.pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${w.trades > 0 ? fmtINR(w.pnl) : '—'}</div>
      <div class="day-meta">${w.trades > 0 ? w.trades + ' trades · ' + w.winPct + '% win' : 'no trades'}</div>
    </div>`;
  }).join('');
}

// ── Journal ───────────────────────────────────────────────────────────────────
function renderJournal(trades) {
  const byDate = {};
  for (const t of trades) {
    if (!byDate[t.date]) byDate[t.date] = [];
    byDate[t.date].push(t);
  }

  const entries = Object.entries(byDate)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayTrades]) => ({
      date,
      pnl:    dayTrades.reduce((s, t) => s + t.pnl, 0),
      trades: dayTrades.length,
      wins:   dayTrades.filter(t => t.result === 'win').length,
      losses: dayTrades.filter(t => t.result === 'loss').length,
      dayTrades,
    }));

  const todayStr = new Date().toISOString().split('T')[0];
  const todayEntry = entries.find(e => e.date === todayStr) || entries[0];

  _renderTodayPanel(todayEntry, todayStr);
  _renderRecentDays(entries.filter(e => e.date !== todayStr));
}

function _renderTodayPanel(entry, todayStr) {
  document.getElementById('journal-today-date').textContent =
    new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const pnlEl    = document.getElementById('journal-today-pnl');
  const statsEl  = document.getElementById('journal-today-stats');
  const tradesEl = document.getElementById('journal-today-trades');
  const notesEl  = document.getElementById('journal-notes-ta');

  if (!entry) {
    pnlEl.textContent = '—'; pnlEl.className = 'today-pnl';
    statsEl.innerHTML  = '<div style="color:var(--text-secondary);font-size:13px;">No trades today</div>';
    tradesEl.innerHTML = '';
    notesEl.value      = localStorage.getItem(`journal_${todayStr}`) || '';
    return;
  }

  pnlEl.textContent = fmtINR(entry.pnl);
  pnlEl.className   = 'today-pnl ' + (entry.pnl >= 0 ? 'up' : 'down');

  const total  = entry.wins + entry.losses;
  const winPct = total > 0 ? Math.round(entry.wins / total * 100) : 0;

  statsEl.innerHTML = `
    <div class="journal-today-stat"><div class="stat-val">${entry.trades}</div><div class="stat-label">Trades</div></div>
    <div class="journal-today-stat"><div class="stat-val" style="color:var(--green);">${entry.wins}</div><div class="stat-label">Wins</div></div>
    <div class="journal-today-stat"><div class="stat-val" style="color:var(--red);">${entry.losses}</div><div class="stat-label">Losses</div></div>
    <div class="journal-today-stat"><div class="stat-val">${winPct}%</div><div class="stat-label">Win Rate</div></div>`;

  tradesEl.innerHTML = `
    <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px;">Trades</div>
    ${entry.dayTrades.map(t => `
      <div class="trade-mini-row">
        <span style="font-weight:600;min-width:100px;">${t.symbol}</span>
        <span>${t.direction}</span>
        <span style="color:var(--text-secondary);">Qty ${t.qty}</span>
        <span style="color:var(--text-secondary);">${fmtPrice(t.avgEntry)} → ${fmtPrice(t.avgExit)}</span>
        <span style="font-weight:700;color:${t.pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtINR(t.pnl)}</span>
        <span class="badge ${t.result}">${t.result.toUpperCase()}</span>
      </div>`).join('')}`;

  notesEl.value = localStorage.getItem(`journal_${entry.date}`) || '';
}

function _renderRecentDays(recent) {
  const recentDiv = document.getElementById('recent-days-list');

  if (!recent.length) {
    recentDiv.innerHTML = '<div style="color:var(--text-secondary);font-size:13px;padding:12px 0;">No previous days recorded.</div>';
    return;
  }

  recentDiv.innerHTML = recent.map((e, i) => {
    const isOpen = expandedRecent === i;
    return `
      <div>
        <div class="recent-day-row" onclick="toggleRecentDay(${i})">
          <span class="recent-day-date">${fmtDateLabel(e.date)}</span>
          <span class="recent-day-pnl ${e.pnl >= 0 ? 'up' : 'down'}">${fmtINR(e.pnl)}</span>
          <span class="recent-day-meta">${e.trades} trades · ${e.wins}W / ${e.losses}L</span>
          <span class="recent-day-expand">${isOpen ? 'Close ▲' : 'Details ▸'}</span>
        </div>
        <div class="recent-day-detail${isOpen ? ' open' : ''}">
          <div class="notebook-tabs"><div class="notebook-tab active">Trades</div></div>
          <div>
            ${e.dayTrades.map(t => `
              <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:12px;border-bottom:1px solid var(--border);gap:8px;flex-wrap:wrap;">
                <span style="font-weight:600;min-width:90px;">${t.symbol}</span>
                <span>${t.direction} · Qty ${t.qty}</span>
                <span style="color:var(--text-secondary);">${fmtPrice(t.avgEntry)} → ${fmtPrice(t.avgExit)}</span>
                <span style="font-weight:700;color:${t.pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${fmtINR(t.pnl)}</span>
                <span class="badge ${t.result}">${t.result.toUpperCase()}</span>
              </div>`).join('')}
          </div>
          <textarea style="margin-top:10px;width:100%;min-height:60px;border:1px solid var(--border);border-radius:4px;padding:8px;font-size:12px;font-family:var(--font);"
            placeholder="Add notes for ${fmtDateLabel(e.date)}…"
            onchange="localStorage.setItem('journal_${e.date}',this.value)">${localStorage.getItem('journal_' + e.date) || ''}</textarea>
        </div>
      </div>`;
  }).join('');
}

function toggleRecentDay(idx) {
  expandedRecent = expandedRecent === idx ? null : idx;
  renderJournal(getFilteredTrades());
}

function saveJournalNotes() {
  const todayStr = new Date().toISOString().split('T')[0];
  localStorage.setItem(`journal_${todayStr}`, document.getElementById('journal-notes-ta').value);
  showToast('Notes saved', 'success', 2000);
}

// ── Trade Log ─────────────────────────────────────────────────────────────────
function renderTradeLog(trades) {
  const tbody    = document.getElementById('trade-tbody');
  const subtitle = document.getElementById('trade-log-subtitle');

  if (!trades.length) {
    subtitle.textContent = 'No trades in selected period';
    tbody.innerHTML = `<tr><td colspan="9"><div class="empty-state">
      <div class="empty-icon">📂</div>
      <div class="empty-title">No trades yet</div>
      <div class="empty-sub">Import a CSV file from your broker above</div>
    </div></td></tr>`;
    return;
  }

  subtitle.textContent = `${trades.length} trade${trades.length !== 1 ? 's' : ''} · click row for detail · ▸ Orders to see legs`;

  tbody.innerHTML = trades.map((t, i) => {
    const isOpen = expandedTradeRow === i;
    const mainRow = `<tr class="clickable" onclick="openTradeModal(${i})">
      <td>${fmtDateShort(t.date)}</td>
      <td style="font-weight:600;">${t.symbol}${t.exchange ? ` <span style="font-size:10px;color:var(--text-secondary);">${t.exchange}</span>` : ''}</td>
      <td>${t.direction}</td>
      <td>${t.qty}</td>
      <td>${fmtPrice(t.avgEntry)}</td>
      <td>${fmtPrice(t.avgExit)}</td>
      <td style="font-weight:700;color:${t.pnl >= 0 ? 'var(--green)' : 'var(--red)'};">${fmtINR(t.pnl)}</td>
      <td><span class="badge ${t.result}">${t.result.toUpperCase()}</span></td>
      <td onclick="event.stopPropagation();toggleTradeDetail(${i})">
        <button class="more-info-btn${isOpen ? ' open' : ''}">${isOpen ? '▾ Hide' : '▸ Orders'}</button>
      </td>
    </tr>`;

    const detailRow = isOpen ? `<tr class="detail-row"><td colspan="9">
      <div class="detail-panel">
        <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">
          ${t.orders.length} order${t.orders.length !== 1 ? 's' : ''} · ${t.direction} ${t.symbol}
        </div>
        <table class="orders-table">
          <thead><tr><th>Time</th><th>Type</th><th>Qty</th><th>Price</th><th>Order ID</th></tr></thead>
          <tbody>
            ${t.orders.map(o => `<tr>
              <td style="color:var(--text-secondary);">${o.trade_time.substring(0, 16)}</td>
              <td><span class="badge-${o.type.toLowerCase()}">${o.type}</span></td>
              <td>${o.qty}</td>
              <td>${fmtPrice(o.price)}</td>
              <td style="color:var(--text-secondary);font-size:11px;">${o.order_id || o.trade_id || '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </td></tr>` : '';

    return mainRow + detailRow;
  }).join('');
}

function toggleTradeDetail(idx) {
  expandedTradeRow = expandedTradeRow === idx ? null : idx;
  renderTradeLog(getFilteredTrades());
}

// ── Master render ─────────────────────────────────────────────────────────────
function renderAll() {
  const filtered = getFilteredTrades();
  const stats    = computeStats(filtered);

  renderStatPills(stats);
  renderCharts(stats);
  renderCalendar(stats.dayPnl, stats.dailyArr);
  renderWeekdayBars(filtered);
  renderJournal(filtered);
  renderTradeLog(filtered);

  if (allOrders.length) {
    const exchanges = [...new Set(allOrders.map(o => o.exchange).filter(Boolean))];
    document.getElementById('broker-label').textContent =
      (exchanges.length ? exchanges.join('/') + ' · ' : '') + allOrders.length + ' orders';
  }
}
