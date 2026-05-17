// App entry point: API calls, CSV import handler, init.
// All heavy work (CSV parsing, FIFO matching) runs in the Python backend.
// This file only fetches pre-computed results and triggers renders.

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(API_URL + path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

// Normalise snake_case fields from the API into the camelCase the render
// functions expect (avg_entry → avgEntry, trade_date → date, etc.)
function normaliseTrade(t) {
  return {
    ...t,
    avgEntry:  t.avg_entry,
    avgExit:   t.avg_exit,
    date:      t.trade_date,
    entryTime: t.entry_time,
    exitTime:  t.exit_time,
  };
}

// ── Data loading ──────────────────────────────────────────────────────────────

async function loadTrades() {
  const raw = await apiFetch('/api/trades');
  allTrades = raw.map(normaliseTrade);
}

// ── CSV Import Handler ────────────────────────────────────────────────────────

document.getElementById('csv-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const btn      = document.getElementById('import-btn');
  const statusEl = document.getElementById('import-status');
  btn.disabled    = true;
  btn.textContent = 'Uploading…';
  statusEl.textContent = '';

  try {
    const body = new FormData();
    body.append('file', file);

    const result = await apiFetch('/api/import', { method: 'POST', body });

    // Reload the freshly computed trades from the API
    await loadTrades();
    renderAll();

    statusEl.textContent = `${result.imported_orders} orders → ${result.total_trades} trades`;
    showToast(
      `Imported ${result.imported_orders} orders, matched ${result.total_trades} trade${result.total_trades !== 1 ? 's' : ''}`,
      'success'
    );
  } catch (err) {
    showToast('Import failed: ' + err.message, 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = '↑ Import CSV';
    e.target.value  = '';
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  renderCalendar({}, []);
  renderWeekdayBars([]);

  try {
    await loadTrades();
  } catch (err) {
    showToast('Could not reach API: ' + err.message, 'error');
  }

  renderAll();
});
