// UI interaction handlers: popups, nav, modal, toast

// ── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3500) {
  const el = document.createElement('div');
  el.className = `toast-msg ${type}`;
  el.textContent = msg;
  document.getElementById('toast').appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.3s';
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ── Popups ───────────────────────────────────────────────────────────────────
function togglePopup(id) {
  const menu = document.querySelector(`#${id} .popup-menu`);
  const wasOpen = menu.classList.contains('open');
  document.querySelectorAll('.popup-menu.open').forEach(m => m.classList.remove('open'));
  if (!wasOpen) menu.classList.add('open');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.popup-wrap'))
    document.querySelectorAll('.popup-menu.open').forEach(m => m.classList.remove('open'));
});

function setMode(mode, el) {
  document.getElementById('mode-label').textContent = mode;
  el.parentElement.querySelectorAll('.item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  el.parentElement.classList.remove('open');
}

function setTime(time, el) {
  document.getElementById('time-label').textContent = time;
  el.parentElement.querySelectorAll('.item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
  el.parentElement.classList.remove('open');
  currentTimeFilter = time;
  expandedTradeRow  = null;
  expandedRecent    = null;
  renderAll();
}

// ── Nav ───────────────────────────────────────────────────────────────────────
function switchView(view, tabEl) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  tabEl.classList.add('active');
  document.getElementById(`view-${view}`).classList.add('active');
  if (view === 'dashboard') {
    setTimeout(() => {
      if (window._cumChart) window._cumChart.resize();
      if (window._dayChart) window._dayChart.resize();
    }, 50);
  }
}

// ── Trade Detail Modal ────────────────────────────────────────────────────────
function openTradeModal(idx) {
  const trades = getFilteredTrades();
  const t = trades[idx];
  if (!t) return;

  document.getElementById('modal-title').textContent = `${t.symbol} · ${fmtDateLabel(t.date)}`;

  document.getElementById('modal-left').innerHTML = `
    <div class="stat-row"><span class="stat-label">Symbol</span><span class="stat-value">${t.symbol}${t.exchange ? ' · ' + t.exchange : ''}</span></div>
    <div class="stat-row"><span class="stat-label">Direction</span><span class="stat-value">${t.direction} · Qty ${t.qty}</span></div>
    <div class="stat-row"><span class="stat-label">Avg Entry</span><span class="stat-value">₹${fmtPrice(t.avgEntry)}</span></div>
    <div class="stat-row"><span class="stat-label">Avg Exit</span><span class="stat-value">₹${fmtPrice(t.avgExit)}</span></div>
    <div class="stat-row"><span class="stat-label">Net P&amp;L</span><span class="stat-value ${t.pnl >= 0 ? 'up' : 'down'}">${fmtINR(t.pnl)}</span></div>
    <div class="stat-row"><span class="stat-label">Result</span><span class="badge ${t.result}" style="font-size:13px;">${t.result.toUpperCase()}</span></div>
    <div class="stat-row"><span class="stat-label">Entry time</span><span class="stat-value" style="font-size:12px;">${t.entryTime.substring(0, 16)}</span></div>
    <div class="stat-row"><span class="stat-label">Exit time</span><span class="stat-value" style="font-size:12px;">${t.exitTime.substring(0, 16)}</span></div>
    <div class="stat-row"><span class="stat-label">Orders</span><span class="stat-value">${t.orders.length} leg${t.orders.length !== 1 ? 's' : ''}</span></div>
  `;

  const cleanSymbol = t.symbol.split(' ')[0];
  const tvSymbol    = `${t.exchange || 'NSE'}:${cleanSymbol}`;

  document.getElementById('modal-right').innerHTML = `
    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">TradingView · ${tvSymbol}</div>
    <div class="tradingview-placeholder" style="flex:1;">
      <div class="tv-icon">📈</div>
      <div style="font-size:14px;font-weight:600;">${cleanSymbol}</div>
      <div style="font-size:12px;">Avg Entry ₹${fmtPrice(t.avgEntry)} → Avg Exit ₹${fmtPrice(t.avgExit)}</div>
      <a href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}" target="_blank"
         style="margin-top:8px;padding:8px 16px;background:var(--brand);color:white;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600;">
        Open in TradingView ↗
      </a>
    </div>
  `;

  document.getElementById('trade-modal-overlay').classList.add('open');
}

function closeTradeModal(e) {
  if (e && e.target !== document.getElementById('trade-modal-overlay')) return;
  document.getElementById('trade-modal-overlay').classList.remove('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('trade-modal-overlay').classList.remove('open');
});
