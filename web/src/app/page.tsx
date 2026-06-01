"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Filler, Legend
} from 'chart.js';
import { fmtINR, fmtPrice, fmtDateLabel, fmtDateShort, fmtDateChart } from '@/lib/ui/format';
import { computeStats, filterTradesByDateRange } from '@/lib/compute/stats';
import DateRangePicker from './components/DateRangePicker';
import JournalPreMarket from './components/journal/PreMarket';
import JournalPostTrade from './components/journal/PostTrade';
import Playbooks from './components/Playbooks';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Filler, Legend);

export default function Home() {
  const router = useRouter();
  const [allTrades, setAllTrades] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  
  const [view, setView] = useState('dashboard');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [expandedTradeRow, setExpandedTradeRow] = useState<string | null>(null);
  const [modalTradeIdx, setModalTradeIdx] = useState<number | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const [importStatus, setImportStatus] = useState('');
  const [toast, setToast] = useState<{ msg: string, type: string } | null>(null);
  const [journaledTradeIds, setJournaledTradeIds] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadTrades();
  }, []);

  useEffect(() => {
    const filtered = filterTradesByDateRange(allTrades, customStart, customEnd);
    setTrades(filtered);
    setStats(computeStats(filtered));
    setExpandedTradeRow(null);

    // Auto-expand the latest month
    if (filtered.length > 0) {
      const dates = filtered.map((t: any) => t.trade_date || t.date || '');
      const latest = dates.reduce((a: string, b: string) => b > a ? b : a, '');
      if (latest) {
        const d = new Date(latest.replace(/-/g, '/'));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        setExpandedMonths(new Set([key]));
      }
    }
  }, [allTrades, customStart, customEnd]);

  const loadTrades = async () => {
    try {
      const res = await fetch('/api/trades');
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAllTrades(data);
      // Also load journal status for all trades
      try {
        const jRes = await fetch('/api/trade-journal');
        if (jRes.ok) {
          const jData = await jRes.json();
          if (jData.trade_ids) {
            setJournaledTradeIds(new Set(jData.trade_ids));
          }
        }
      } catch {}
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



  // -- JOURNAL (new: PreMarket Plan + Post-Trade Analysis) ---
  const renderJournal = () => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Find the latest trading day from the data
    const latestDate = trades.length > 0
      ? trades.reduce((latest, t) => {
          const d = t.trade_date || t.date;
          return d > latest ? d : latest;
        }, '')
      : todayStr;

    const latestTrades = trades.filter(t => (t.trade_date || t.date) === latestDate);

    return (
      <div className={`view ${view === 'journal' ? 'active' : ''}`} id="view-journal">
        <JournalPreMarket latestTradeDate={todayStr} />
        <div style={{ height: '16px' }} />
        <JournalPostTrade trades={latestTrades} date={latestDate} />
      </div>
    );
  };

  return (
    <>
      <header className="header">
        <span className="logo">
          <svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-mark">
            <line x1="10" y1="2" x2="10" y2="7" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M3 7H12.5L17 11.5V17H3V7Z" fill="#f97316"/>
            <line x1="10" y1="17" x2="10" y2="22" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          TradeLore
        </span>
        
        <div className="header-spacer"></div>
        <DateRangePicker
          start={customStart}
          end={customEnd}
          onChange={(s, e) => { setCustomStart(s); setCustomEnd(e); }}
          onClear={() => { setCustomStart(''); setCustomEnd(''); }}
        />
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
      </header>

      <nav className="nav">
        {['dashboard', 'journal', 'tradelog', 'playbooks'].map(v => (
          <div key={v} className={`nav-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
            {v === 'dashboard' ? 'Dashboard' : v === 'journal' ? 'Journal' : v === 'tradelog' ? 'Trade Log' : 'Playbooks'}
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
                    datasets: [{ data: stats.cumulativeArr.map((d: any) => d.pnl), borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.06)', fill: true, borderWidth: 2, pointRadius: 0, tension: 0.3 }]
                  }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { display: false } }, y: { grid: { color: '#f5f5f5' } } } }} />
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
                  }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { display: false } }, y: { grid: { color: '#f5f5f5' } } } }} />
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


        </div>

        {/* JOURNAL */}
        {renderJournal()}

        {/* TRADE LOG */}
        <div className={`view ${view === 'tradelog' ? 'active' : ''}`} id="view-tradelog">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}}>
            <div>
              <h2 style={{fontSize:'18px',fontWeight:600}}>Trade Log</h2>
              <span style={{fontSize:'12px',color:'var(--text-secondary)'}}>{trades.length ? `${trades.length} trades` : 'Import a CSV to populate'}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
              <span style={{fontSize:'12px',color:'var(--text-secondary)'}}>{importStatus}</span>
              <button className="import-btn" onClick={() => fileInputRef.current?.click()}>↑ Import CSV</button>
            </div>
          </div>

          {!trades.length ? (
            <div className="empty-state"><div className="empty-icon">📂</div><div className="empty-title">No trades yet</div><div className="empty-sub">Import a CSV file from your broker to get started</div></div>
          ) : (() => {
            // Group trades by month/year
            const grouped: Record<string, any[]> = {};
            for (const t of trades) {
              const d = new Date((t.trade_date || t.date || '').replace(/-/g, '/'));
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              if (!grouped[key]) grouped[key] = [];
              grouped[key].push(t);
            }

            // Sort groups newest first
            const sorted = Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));

            const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

            return sorted.map(([key, monthTrades]) => {
              const [y, m] = key.split('-');
              const label = `${MONTH_NAMES[parseInt(m) - 1]} ${y}`;
              const isOpen = expandedMonths.has(key);
              const monthPnl = monthTrades.reduce((s: number, t: any) => s + t.pnl, 0);
              const wins = monthTrades.filter((t: any) => t.result === 'win').length;
              const losses = monthTrades.filter((t: any) => t.result === 'loss').length;
              const wr = monthTrades.length > 0 ? Math.round(wins / monthTrades.length * 100) : 0;

              const toggleMonth = () => {
                setExpandedMonths(prev => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                });
                setExpandedTradeRow(null);
              };

              return (
                <div key={key} className="month-section">
                  <div className="month-header" onClick={toggleMonth}>
                    <span className="month-chevron">{isOpen ? '▾' : '▸'}</span>
                    <span className="month-label">{label}</span>
                    <span className="month-stat">{monthTrades.length} trade{monthTrades.length !== 1 ? 's' : ''}</span>
                    <span className="month-stat" style={{minWidth:'50px'}}>{wins}W / {losses}L</span>
                    <span className="month-stat" style={{minWidth:'42px',fontWeight:600}}>{wr}%</span>
                    <span className="month-pnl" style={{color: monthPnl >= 0 ? 'var(--green)' : 'var(--red)'}}>
                      {fmtINR(monthPnl)}
                    </span>
                  </div>

                  {isOpen && (
                    <div className="month-body">
                      {(() => {
                        // Group month trades by day
                        const byDay: Record<string, any[]> = {};
                        for (const t of monthTrades) {
                          const dt = t.trade_date || t.date || '';
                          if (!byDay[dt]) byDay[dt] = [];
                          byDay[dt].push(t);
                        }
                        const days = Object.entries(byDay).sort(([a], [b]) => b.localeCompare(a));

                        return (
                          <table className="trade-table">
                            <thead>
                              <tr>
                                <th>Symbol</th><th>Dir</th><th>Qty</th>
                                <th>Avg Entry</th><th>Avg Exit</th><th>Net P&amp;L</th><th>Journal</th><th></th>
                              </tr>
                            </thead>
                            {days.map(([dayDate, dayTrades]) => {
                              const dayPnl = dayTrades.reduce((s: number, t: any) => s + t.pnl, 0);
                              const dayWins = dayTrades.filter((t: any) => t.result === 'win').length;
                              const dayLosses = dayTrades.filter((t: any) => t.result === 'loss').length;

                              return (
                                <tbody key={dayDate} className="day-group">
                                  <tr className="day-header-row">
                                    <td colSpan={8}>
                                      <div className="day-header">
                                        <span className="day-date">{fmtDateLabel(dayDate)}</span>
                                        <span className="day-meta">{dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''} · {dayWins}W / {dayLosses}L</span>
                                        <span className="day-pnl" style={{color: dayPnl >= 0 ? 'var(--green)' : 'var(--red)'}}>
                                          {fmtINR(dayPnl)}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                  {dayTrades.sort((a: any, b: any) => (b.exit_time || b.exitTime || '').localeCompare(a.exit_time || a.exitTime || '')).map((t: any, i: number) => {
                                    const rowKey = `${key}_${dayDate}_${i}`;
                                    const isRowOpen = expandedTradeRow === rowKey;
                                    const allIdx = allTrades.findIndex((at: any) => (at.id || `${at.symbol}_${at.entry_time || at.entryTime}`) === (t.id || `${t.symbol}_${t.entry_time || t.entryTime}`));
                                    const tradeIdx = allIdx >= 0 ? allIdx : trades.indexOf(t);
                                    const tradeUrl = `/trade?idx=${tradeIdx}`;
                                    return (
                                      <React.Fragment key={i}>
                                        <tr className="clickable" onClick={() => router.push(tradeUrl)}>
                                          <td style={{fontWeight:600}}>{t.symbol}{t.exchange && <span style={{fontSize:'10px',color:'var(--text-secondary)'}}> {t.exchange}</span>}</td>
                                          <td>{t.direction === 'LONG' ? 'L' : 'S'}</td>
                                          <td>{t.qty}</td>
                                          <td>{fmtPrice(t.avg_entry || t.avgEntry)}</td>
                                          <td>{fmtPrice(t.avg_exit || t.avgExit)}</td>
                                          <td style={{fontWeight:700,color:t.pnl >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmtINR(t.pnl)}</td>
                                          <td>
                                            <span style={{display:'inline-flex', alignItems:'center', gap:'4px'}}>
                                              <span style={{width:'6px', height:'6px', borderRadius:'50%', background: journaledTradeIds.has(t.id || `${t.symbol}_${t.entry_time || t.entryTime}`) ? '#16a34a' : '#d1d5db', display:'inline-block'}}></span>
                                              <span style={{fontSize:'11px', color:'var(--text-secondary)'}}>{journaledTradeIds.has(t.id || `${t.symbol}_${t.entry_time || t.entryTime}`) ? 'Yes' : 'No'}</span>
                                            </span>
                                          </td>
                                          <td>
                                            <span style={{display:'inline-flex', gap:'10px', alignItems:'center'}}>
                                              <button
                                                className="more-info-btn"
                                                style={{background:'#1a1a1a', color:'#fff', border:'1px solid #1a1a1a', padding:'5px 12px'}}
                                                onClick={(e) => { e.stopPropagation(); router.push(tradeUrl); }}
                                              >View Trade | Journal</button>
                                              <button
                                                className={`more-info-btn ${isRowOpen ? 'open' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); setExpandedTradeRow(isRowOpen ? null : rowKey); }}
                                              >{isRowOpen ? '▾ Hide' : '▸ Orders'}</button>
                                            </span>
                                          </td>
                                        </tr>
                                        {isRowOpen && (
                                          <tr className="detail-row"><td colSpan={8}>
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
                              );
                            })}
                          </table>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>

        {/* PLAYBOOKS */}
        <div className={`view ${view === 'playbooks' ? 'active' : ''}`} id="view-playbooks">
          <Playbooks />
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
