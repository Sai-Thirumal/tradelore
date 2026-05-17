"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Filler, Legend
} from 'chart.js';
import { fmtINR, fmtPrice, fmtDateLabel, fmtDateShort, fmtDateChart } from '@/lib/format';
import { computeStats, filterTradesByTime } from '@/lib/trades-stats';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Filler, Legend);

export default function Home() {
  const [allTrades, setAllTrades] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const [view, setView] = useState('dashboard');
  const [timeFilter, setTimeFilter] = useState('All Time');
  const [mode, setMode] = useState('INR');
  
  const [expandedTradeRow, setExpandedTradeRow] = useState<number | null>(null);
  const [expandedRecent, setExpandedRecent] = useState<number | null>(null);
  const [modalTradeIdx, setModalTradeIdx] = useState<number | null>(null);

  const [importStatus, setImportStatus] = useState('');
  const [toast, setToast] = useState<{ msg: string, type: string } | null>(null);
  
  const [isTimeMenuOpen, setIsTimeMenuOpen] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTrades();
  }, []);

  useEffect(() => {
    const filtered = filterTradesByTime(allTrades, timeFilter);
    setTrades(filtered);
    setStats(computeStats(filtered));
    setExpandedTradeRow(null);
    setExpandedRecent(null);
  }, [allTrades, timeFilter]);

  const loadTrades = async () => {
    try {
      const res = await fetch('/api/trades');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAllTrades(data);
    } catch (err: any) {
      showToast('Could not reach API: ' + err.message, 'error');
    }
  };

  const showToast = (msg: string, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('Uploading…');
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/import', { method: 'POST', body });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json();
      
      await loadTrades();
      setImportStatus(`${result.imported_orders} orders → ${result.total_trades} trades`);
      showToast(`Imported ${result.imported_orders} orders, matched ${result.total_trades} trades`, 'success');
    } catch (err: any) {
      setImportStatus('');
      showToast('Import failed: ' + err.message, 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // --- RENDER HELPERS ---
  const pf  = stats ? (isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞') : '—';
  const awl = stats ? (isFinite(stats.avgWinLoss) ? stats.avgWinLoss.toFixed(2) : '∞') : '—';

  // Calendars / Weekdays
  const renderCalendar = () => {
    if (!stats) return null;
    const today = new Date();
    let year = today.getFullYear();
    let month = today.getMonth();
    
    if (stats.dailyArr && stats.dailyArr.length) {
      const d = new Date(stats.dailyArr[stats.dailyArr.length - 1].date + 'T00:00:00');
      year = d.getFullYear(); month = d.getMonth();
    }
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeks: any[][] = [];
    let week: any[] = Array(firstDay).fill(null);
    
    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) { weeks.push(week); week = []; }
    }
    while (week.length > 0 && week.length < 7) week.push(null);
    if (week.length) weeks.push(week);

    return (
      <table className="calendar-table">
        <thead>
          <tr>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <th key={d}>{d}</th>)}
            <th className="week-sum-header">P&amp;L</th><th className="week-sum-header">Days</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => {
            let weekPnl = 0, weekDays = 0;
            const rowTds = w.map((d, j) => {
              if (d === null) return <td key={j} className="day-cell other-month"></td>;
              const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const pnl = stats.dayPnl && key in stats.dayPnl ? stats.dayPnl[key] : null;
              const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              if (pnl !== null) { weekPnl += pnl; weekDays++; }
              const cls = 'day-cell' + (isToday ? ' today' : '');
              const miniCls = pnl !== null ? (pnl >= 0 ? 'up' : 'down') : '';
              const miniText = pnl !== null ? (pnl >= 0 ? '+' : '') + (Math.abs(pnl) >= 1000 ? (pnl/1000).toFixed(1)+'k' : pnl.toFixed(0)) : '';
              
              return (
                <td key={j} className={cls}>
                  <span className="day-num">{d}</span>
                  {miniText && <span className={`mini-pnl ${miniCls}`}>{miniText}</span>}
                </td>
              );
            });
            return (
              <tr key={i} className="week-row">
                {rowTds}
                <td><span className={`week-pnl ${weekPnl >= 0 ? 'up' : 'down'}`}>{weekDays > 0 ? fmtINR(weekPnl) : '—'}</span></td>
                <td><span className="week-trades">{weekDays > 0 ? `${weekDays} day${weekDays !== 1 ? 's' : ''}` : '—'}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  };

  const renderWeekdayBars = () => {
    if (!stats) return null;
    const DAY_NAMES = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const wStats = Array.from({ length: 7 }, () => ({ pnl: 0, trades: 0, wins: 0 }));
    
    for (const t of trades) {
      const dow = new Date((t.entry_time || t.entryTime).replace(' ', 'T')).getDay();
      wStats[dow].pnl += t.pnl;
      wStats[dow].trades++;
      if (t.result === 'win') wStats[dow].wins++;
    }
    
    const tradingDays = [1,2,3,4,5].map(i => ({
      day: DAY_NAMES[i],
      pnl: wStats[i].pnl,
      trades: wStats[i].trades,
      winPct: wStats[i].trades > 0 ? Math.round(wStats[i].wins / wStats[i].trades * 100) : 0,
    }));

    if (!trades.length) {
      return <div className="weekday-bars">{tradingDays.map((w,i) => <div key={i} className="weekday-bar" style={{height:'40px'}}><div className="day-label">{w.day}</div><div className="day-pnl" style={{color:'var(--text-secondary)'}}>—</div><div className="day-meta">no data</div></div>)}</div>;
    }

    const maxAbs = Math.max(1, ...tradingDays.map(w => Math.abs(w.pnl)));
    const best   = tradingDays.reduce((a, b) => b.pnl > a.pnl ? b : a);

    return (
      <div>
        <div style={{ position: 'absolute', top: '20px', right: '20px', fontSize: '12px', color: 'var(--brand)', fontWeight: 600 }}>
          {best.trades > 0 ? `Best day: ${best.day}` : ''}
        </div>
        <div className="weekday-bars">
          {tradingDays.map((w, i) => {
            const height = w.trades > 0 ? Math.max(30, (Math.abs(w.pnl) / maxAbs) * 120) : 30;
            return (
              <div key={i} className={`weekday-bar${w.day === best.day && best.trades > 0 ? ' best' : ''}${w.pnl < 0 ? ' negative' : ''}`} style={{height: `${height}px`}}>
                <div className="day-label">{w.day}</div>
                <div className="day-pnl" style={{color: w.pnl >= 0 ? 'var(--green)' : 'var(--red)'}}>{w.trades > 0 ? fmtINR(w.pnl) : '—'}</div>
                <div className="day-meta">{w.trades > 0 ? `${w.trades} trades · ${w.winPct}% win` : 'no trades'}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // -- JOURNAL RENDERING ---
  const renderJournal = () => {
    if (!stats) return null;
    const byDate: Record<string, any[]> = {};
    for (const t of trades) {
      const date = t.trade_date || t.date;
      if (!byDate[date]) byDate[date] = [];
      byDate[date].push(t);
    }
    const entries = Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a)).map(([date, dayTrades]) => ({
      date,
      pnl: dayTrades.reduce((s, t) => s + t.pnl, 0),
      trades: dayTrades.length,
      wins: dayTrades.filter(t => t.result === 'win').length,
      losses: dayTrades.filter(t => t.result === 'loss').length,
      dayTrades,
    }));
    
    const todayStr = new Date().toISOString().split('T')[0];
    const todayEntry = entries.find(e => e.date === todayStr) || entries[0];
    const recent = entries.filter(e => e.date !== todayStr);
    
    const todayDateFmt = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

    return (
      <div className={`view ${view === 'journal' ? 'active' : ''}`} id="view-journal">
        <div className="journal-today">
          <div className="journal-today-header">
            <span className="today-badge">Today</span>
            <span className="today-date">{todayDateFmt}</span>
            <span className={`today-pnl ${todayEntry ? (todayEntry.pnl >= 0 ? 'up' : 'down') : ''}`} style={{marginLeft:'auto'}}>
              {todayEntry ? fmtINR(todayEntry.pnl) : '—'}
            </span>
          </div>
          <div className="journal-today-body">
            {todayEntry ? (
              <>
                <div className="journal-today-stats">
                  <div className="journal-today-stat"><div className="stat-val">{todayEntry.trades}</div><div className="stat-label">Trades</div></div>
                  <div className="journal-today-stat"><div className="stat-val" style={{color:'var(--green)'}}>{todayEntry.wins}</div><div className="stat-label">Wins</div></div>
                  <div className="journal-today-stat"><div className="stat-val" style={{color:'var(--red)'}}>{todayEntry.losses}</div><div className="stat-label">Losses</div></div>
                  <div className="journal-today-stat"><div className="stat-val">{todayEntry.trades > 0 ? Math.round(todayEntry.wins / todayEntry.trades * 100) : 0}%</div><div className="stat-label">Win Rate</div></div>
                </div>
                <div className="journal-notes-area">
                  <textarea 
                    placeholder="Write your trade notes, market observations, and reflections…" 
                    defaultValue={typeof window !== 'undefined' ? localStorage.getItem(`journal_${todayEntry.date}`) || '' : ''}
                    onChange={(e) => localStorage.setItem(`journal_${todayEntry.date}`, e.target.value)}
                  />
                  <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
                    <button onClick={() => showToast('Notes saved', 'success')} style={{padding:'6px 16px',background:'var(--brand)',color:'white',border:'none',borderRadius:'6px',fontSize:'12px',cursor:'pointer'}}>Save Notes</button>
                  </div>
                </div>
                <div className="journal-today-trades">
                  <div style={{fontSize:'12px',fontWeight:600,color:'var(--text-secondary)',marginBottom:'8px'}}>Trades</div>
                  {todayEntry.dayTrades.map((t, i) => (
                    <div key={i} className="trade-mini-row">
                      <span style={{fontWeight:600,minWidth:'100px'}}>{t.symbol}</span>
                      <span>{t.direction}</span>
                      <span style={{color:'var(--text-secondary)'}}>Qty {t.qty}</span>
                      <span style={{color:'var(--text-secondary)'}}>{fmtPrice(t.avg_entry || t.avgEntry)} → {fmtPrice(t.avg_exit || t.avgExit)}</span>
                      <span style={{fontWeight:700,color:t.pnl >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmtINR(t.pnl)}</span>
                      <span className={`badge ${t.result}`}>{t.result.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{color:'var(--text-secondary)',fontSize:'13px'}}>No trades today</div>
            )}
          </div>
        </div>
        
        <div className="recent-days-title">Recent Days</div>
        <div>
          {recent.length === 0 ? <div style={{color:'var(--text-secondary)',fontSize:'13px',padding:'12px 0'}}>No previous days recorded.</div> : 
            recent.map((e, i) => {
              const isOpen = expandedRecent === i;
              return (
                <div key={i}>
                  <div className="recent-day-row" onClick={() => setExpandedRecent(isOpen ? null : i)}>
                    <span className="recent-day-date">{fmtDateLabel(e.date)}</span>
                    <span className={`recent-day-pnl ${e.pnl >= 0 ? 'up' : 'down'}`}>{fmtINR(e.pnl)}</span>
                    <span className="recent-day-meta">{e.trades} trades · {e.wins}W / {e.losses}L</span>
                    <span className="recent-day-expand">{isOpen ? 'Close ▲' : 'Details ▸'}</span>
                  </div>
                  <div className={`recent-day-detail ${isOpen ? 'open' : ''}`}>
                    <div className="notebook-tabs"><div className="notebook-tab active">Trades</div></div>
                    <div>
                      {e.dayTrades.map((t, j) => (
                        <div key={j} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',fontSize:'12px',borderBottom:'1px solid var(--border)',gap:'8px',flexWrap:'wrap'}}>
                          <span style={{fontWeight:600,minWidth:'90px'}}>{t.symbol}</span>
                          <span>{t.direction} · Qty {t.qty}</span>
                          <span style={{color:'var(--text-secondary)'}}>{fmtPrice(t.avg_entry || t.avgEntry)} → {fmtPrice(t.avg_exit || t.avgExit)}</span>
                          <span style={{fontWeight:700,color:t.pnl >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmtINR(t.pnl)}</span>
                          <span className={`badge ${t.result}`}>{t.result.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                    <textarea style={{marginTop:'10px',width:'100%',minHeight:'60px',border:'1px solid var(--border)',borderRadius:'4px',padding:'8px',fontSize:'12px',fontFamily:'var(--font)'}}
                      placeholder={`Add notes for ${fmtDateLabel(e.date)}…`}
                      defaultValue={typeof window !== 'undefined' ? localStorage.getItem('journal_' + e.date) || '' : ''}
                      onChange={(ev) => localStorage.setItem('journal_' + e.date, ev.target.value)} />
                  </div>
                </div>
              );
            })
          }
        </div>
      </div>
    );
  };

  return (
    <>
      <header className="header">
        <span className="logo">TradeLore</span>
        
        <div className="popup-wrap">
          <button className="popup-trigger" onClick={() => { setIsModeMenuOpen(!isModeMenuOpen); setIsTimeMenuOpen(false); }}>
            <span>{mode}</span><span className="arrow">▾</span>
          </button>
          <div className={`popup-menu ${isModeMenuOpen ? 'open' : ''}`}>
            {['INR', '%', 'Privacy'].map(m => (
              <div key={m} className={`item ${mode === m ? 'active' : ''}`} onClick={() => { setMode(m); setIsModeMenuOpen(false); }}>
                {mode === m && <span className="dot"></span>} {m === 'Privacy' ? '🔒 Privacy' : m}
              </div>
            ))}
          </div>
        </div>

        <div className="popup-wrap">
          <button className="popup-trigger" onClick={() => { setIsTimeMenuOpen(!isTimeMenuOpen); setIsModeMenuOpen(false); }}>
            <span>{timeFilter}</span><span className="arrow">▾</span>
          </button>
          <div className={`popup-menu ${isTimeMenuOpen ? 'open' : ''}`}>
            {['Today','This Week','This Month','Last 30 Days','Last Month','Quarter','YTD','All Time'].map(t => (
              <div key={t} className={`item ${timeFilter === t ? 'active' : ''}`} onClick={() => { setTimeFilter(t); setIsTimeMenuOpen(false); }}>
                {timeFilter === t && <span className="dot"></span>} {t}
              </div>
            ))}
          </div>
        </div>
        
        <div className="header-spacer"></div>
        <input type="file" ref={fileInputRef} accept=".csv" style={{display:'none'}} onChange={handleImport} />
        <button className="import-btn" style={{padding:'6px 12px', fontSize:'12px', background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text)', gap:'4px'}} onClick={async () => {
          if (!confirm("Are you sure you want to clear all data? This cannot be undone.")) return;
          try {
            const res = await fetch('/api/clear', { method: 'DELETE' });
            if (!res.ok) throw new Error("Failed");
            setTrades([]);
            setAllTrades([]);
            setStats(null);
            showToast("All data cleared successfully.", "success");
          } catch(err) {
            showToast("Failed to clear data.", "error");
          }
        }}>🗑 Clear</button>
        <button className="import-btn" style={{padding:'6px 12px', fontSize:'12px'}} onClick={() => fileInputRef.current?.click()}>↑ Import CSV</button>
        <span id="broker-label" style={{fontSize:'12px',color:'var(--text-secondary)',padding:'7px 12px',border:'1px solid var(--border)',borderRadius:'var(--radius-sm)'}}>
          {allTrades.length > 0 ? `${allTrades.length} trades` : 'No data'}
        </span>
      </header>

      <nav className="nav">
        {['dashboard', 'journal', 'tradelog'].map(v => (
          <div key={v} className={`nav-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
            {v === 'dashboard' ? 'Dashboard' : v === 'journal' ? 'Daily Journals' : 'Trade Log'}
          </div>
        ))}
      </nav>

      <div className="main">
        {/* DASHBOARD */}
        <div className={`view ${view === 'dashboard' ? 'active' : ''}`} id="view-dashboard">
          <div className="stat-pills">
            <div className="stat-pill"><span className="label">Net P&amp;L</span><span className={`value ${stats?.netPnl >= 0 ? 'green' : 'red'}`}>{stats ? fmtINR(stats.netPnl) : '—'}</span><span className="sub">{stats ? `${stats.winCount + stats.lossCount} completed trades` : 'Import CSV to start'}</span></div>
            <div className="stat-pill"><span className="label">Trade Win %</span><span className="value">{stats ? stats.tradeWinPct.toFixed(1) + '%' : '—'}</span><span className="sub">{stats ? `${stats.winCount} Wins · ${stats.lossCount} Losses` : '—'}</span></div>
            <div className="stat-pill"><span className="label">Profit Factor</span><span className="value">{pf}</span><span className="sub">{stats ? `W ${fmtINR(stats.totalWins, false)} · L ${fmtINR(stats.totalLosses, false)}` : '—'}</span></div>
            <div className="stat-pill"><span className="label">Day Win %</span><span className="value">{stats ? stats.dayWinPct.toFixed(1) + '%' : '—'}</span><span className="sub">{stats ? `${stats.greenDays} Green · ${stats.redDays} Red` : '—'}</span></div>
            <div className="stat-pill"><span className="label">Avg Win / Loss</span><span className="value">{awl}</span><span className="sub">{stats ? `+${fmtINR(stats.avgWin, false)} · −${fmtINR(stats.avgLoss, false)}` : '—'}</span></div>
          </div>

          <div className="charts-row">
            <div className="section">
              <div className="section-header">
                <div><div className="section-title">Cumulative Net P&amp;L</div><div className="section-subtitle">Running total · realized only</div></div>
                <span style={{fontSize:'20px',fontWeight:700,color: stats && stats.cumulativeArr.length ? (stats.cumulativeArr[stats.cumulativeArr.length-1].pnl >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-secondary)'}}>
                  {stats && stats.cumulativeArr.length ? fmtINR(stats.cumulativeArr[stats.cumulativeArr.length-1].pnl) : '—'}
                </span>
              </div>
              <div className="chart-wrap">
                {!stats || !stats.dailyArr.length ? <div className="chart-empty"><div className="chart-empty-icon">📈</div><div className="chart-empty-text">Import trades to see P&amp;L curve</div></div> :
                  <Line data={{
                    labels: stats.dailyArr.map((d: any) => fmtDateChart(d.date)),
                    datasets: [{ data: stats.cumulativeArr.map((d: any) => d.pnl), borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.06)', fill: true, borderWidth: 2, pointRadius: 2, pointHoverRadius: 5, tension: 0.3 }]
                  }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#f5f5f5' } } } }} />
                }
              </div>
            </div>
            <div className="section">
              <div className="section-header">
                <div><div className="section-title">Daily Net P&amp;L</div><div className="section-subtitle">Green = win day · Red = loss day</div></div>
              </div>
              <div className="chart-wrap">
                {!stats || !stats.dailyArr.length ? <div className="chart-empty"><div className="chart-empty-icon">📊</div><div className="chart-empty-text">Import trades to see daily P&amp;L</div></div> :
                  <Bar data={{
                    labels: stats.dailyArr.map((d: any) => fmtDateChart(d.date)),
                    datasets: [{ data: stats.dailyArr.map((d: any) => d.pnl), backgroundColor: stats.dailyArr.map((v: any) => v.pnl >= 0 ? '#16a34a' : '#dc2626'), borderRadius: 4 }]
                  }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#f5f5f5' } } } }} />
                }
              </div>
            </div>
          </div>

          <div className="section cal-section">
            <div className="section-header">
              <div>
                <div className="section-title">{stats && stats.dailyArr.length ? (() => {
                  const d = new Date(stats.dailyArr[stats.dailyArr.length - 1].date + 'T00:00:00');
                  return `${['January','February','March','April','May','June','July','August','September','October','November','December'][d.getMonth()]} ${d.getFullYear()}`;
                })() : 'Calendar'}</div>
                <div className="section-subtitle">Daily P&amp;L · weekly totals</div>
              </div>
            </div>
            {renderCalendar()}
          </div>

          <div className="section" style={{ position: 'relative' }}>
            <div className="section-header">
              <div><div className="section-title">Weekday Performance</div><div className="section-subtitle">Mon–Fri P&amp;L intensity</div></div>
            </div>
            {renderWeekdayBars()}
          </div>
        </div>

        {/* JOURNAL */}
        {renderJournal()}

        {/* TRADE LOG */}
        <div className={`view ${view === 'tradelog' ? 'active' : ''}`} id="view-tradelog">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}}>
            <div>
              <h2 style={{fontSize:'18px',fontWeight:600}}>Trade Log</h2>
              <span style={{fontSize:'12px',color:'var(--text-secondary)'}}>{trades.length ? `${trades.length} trades · click row for detail · ▸ Orders to see legs` : 'Import a CSV to populate'}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
              <span style={{fontSize:'12px',color:'var(--text-secondary)'}}>{importStatus}</span>
              <button className="import-btn" onClick={() => fileInputRef.current?.click()}>↑ Import CSV</button>
            </div>
          </div>

          <div className="section" style={{padding:0,overflow:'hidden'}}>
            <table className="trade-table">
              <thead>
                <tr>
                  <th>Date</th><th>Symbol</th><th>Direction</th><th>Qty</th>
                  <th>Avg Entry</th><th>Avg Exit</th><th>Net P&amp;L</th><th>Result</th><th></th>
                </tr>
              </thead>
              <tbody>
                {!trades.length ? (
                  <tr><td colSpan={9}><div className="empty-state"><div className="empty-icon">📂</div><div className="empty-title">No trades yet</div><div className="empty-sub">Import a CSV file from your broker to get started</div></div></td></tr>
                ) : trades.map((t, i) => {
                  const isOpen = expandedTradeRow === i;
                  return (
                    <React.Fragment key={i}>
                      <tr className="clickable" onClick={() => setModalTradeIdx(i)}>
                        <td>{fmtDateShort(t.trade_date || t.date)}</td>
                        <td style={{fontWeight:600}}>{t.symbol}{t.exchange && <span style={{fontSize:'10px',color:'var(--text-secondary)'}}> {t.exchange}</span>}</td>
                        <td>{t.direction}</td>
                        <td>{t.qty}</td>
                        <td>{fmtPrice(t.avg_entry || t.avgEntry)}</td>
                        <td>{fmtPrice(t.avg_exit || t.avgExit)}</td>
                        <td style={{fontWeight:700,color:t.pnl >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmtINR(t.pnl)}</td>
                        <td><span className={`badge ${t.result}`}>{t.result.toUpperCase()}</span></td>
                        <td onClick={(e) => { e.stopPropagation(); setExpandedTradeRow(isOpen ? null : i); }}>
                          <button className={`more-info-btn ${isOpen ? 'open' : ''}`}>{isOpen ? '▾ Hide' : '▸ Orders'}</button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="detail-row"><td colSpan={9}>
                          <div className="detail-panel">
                            <div style={{fontSize:'11px',fontWeight:600,color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:'6px'}}>
                              {t.orders?.length} orders · {t.direction} {t.symbol}
                            </div>
                            <table className="orders-table">
                              <thead><tr><th>Time</th><th>Type</th><th>Qty</th><th>Price</th><th>Order ID</th></tr></thead>
                              <tbody>
                                {t.orders?.map((o: any, oi: number) => (
                                  <tr key={oi}>
                                    <td style={{color:'var(--text-secondary)'}}>{o.trade_time.substring(0, 16)}</td>
                                    <td><span className={`badge-${o.type.toLowerCase()}`}>{o.type}</span></td>
                                    <td>{o.qty}</td>
                                    <td>{fmtPrice(o.price)}</td>
                                    <td style={{color:'var(--text-secondary)',fontSize:'11px'}}>{o.order_id || o.trade_id || '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL */}
      {modalTradeIdx !== null && trades[modalTradeIdx] && (() => {
        const t = trades[modalTradeIdx];
        const cleanSymbol = t.symbol.split(' ')[0];
        const tvSymbol = `${t.exchange || 'NSE'}:${cleanSymbol}`;
        
        return (
          <div className="modal-overlay open" onClick={() => setModalTradeIdx(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{t.symbol} · {fmtDateLabel(t.trade_date || t.date)}</h2>
                <button className="modal-close" onClick={() => setModalTradeIdx(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="modal-left">
                  <div className="stat-row"><span className="stat-label">Symbol</span><span className="stat-value">{t.symbol}{t.exchange ? ' · ' + t.exchange : ''}</span></div>
                  <div className="stat-row"><span className="stat-label">Direction</span><span className="stat-value">{t.direction} · Qty {t.qty}</span></div>
                  <div className="stat-row"><span className="stat-label">Avg Entry</span><span className="stat-value">₹{fmtPrice(t.avg_entry || t.avgEntry)}</span></div>
                  <div className="stat-row"><span className="stat-label">Avg Exit</span><span className="stat-value">₹{fmtPrice(t.avg_exit || t.avgExit)}</span></div>
                  <div className="stat-row"><span className="stat-label">Net P&amp;L</span><span className={`stat-value ${t.pnl >= 0 ? 'up' : 'down'}`}>{fmtINR(t.pnl)}</span></div>
                  <div className="stat-row"><span className="stat-label">Result</span><span className={`badge ${t.result}`} style={{fontSize:'13px'}}>{t.result.toUpperCase()}</span></div>
                  <div className="stat-row"><span className="stat-label">Entry time</span><span className="stat-value" style={{fontSize:'12px'}}>{(t.entry_time || t.entryTime).substring(0, 16)}</span></div>
                  <div className="stat-row"><span className="stat-label">Exit time</span><span className="stat-value" style={{fontSize:'12px'}}>{(t.exit_time || t.exitTime).substring(0, 16)}</span></div>
                  <div className="stat-row"><span className="stat-label">Orders</span><span className="stat-value">{t.orders?.length} leg{t.orders?.length !== 1 ? 's' : ''}</span></div>
                </div>
                <div className="modal-right">
                  <div style={{fontSize:'12px',color:'var(--text-secondary)',marginBottom:'8px'}}>TradingView · {tvSymbol}</div>
                  <div className="tradingview-placeholder">
                    <div className="tv-icon">📈</div>
                    <div style={{fontSize:'14px',fontWeight:600}}>{cleanSymbol}</div>
                    <div style={{fontSize:'12px'}}>Avg Entry ₹{fmtPrice(t.avg_entry || t.avgEntry)} → Avg Exit ₹{fmtPrice(t.avg_exit || t.avgExit)}</div>
                    <a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}`} target="_blank" rel="noreferrer"
                       style={{marginTop:'8px',padding:'8px 16px',background:'var(--brand)',color:'white',borderRadius:'6px',textDecoration:'none',fontSize:'12px',fontWeight:600}}>
                      Open in TradingView ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TOAST */}
      <div id="toast">
        {toast && <div className={`toast-msg ${toast.type}`}>{toast.msg}</div>}
      </div>
    </>
  );
}
