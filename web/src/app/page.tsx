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
  const [journalTab, setJournalTab] = useState('premarket');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [expandedTradeRow, setExpandedTradeRow] = useState<string | null>(null);
  const [modalTradeIdx, setModalTradeIdx] = useState<number | null>(null);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const [importStatus, setImportStatus] = useState('');
  const [toast, setToast] = useState<{ msg: string, type: string } | null>(null);
  const [journaledTradeIds, setJournaledTradeIds] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cumChartRef = useRef<any>(null);
  const dailyChartRef = useRef<any>(null);

  /* Chart.js split-area plugin: green fill above zero, red fill below zero */
  const splitAreaPlugin = {
    id: 'splitArea',
    beforeDatasetDraw(chart: any, args: any) {
      const datasetIndex = args.index;
      if (datasetIndex !== 0) return;
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;
      const { ctx, chartArea, scales } = chart;
      const yScale = scales.y;
      const zeroY = yScale.getPixelForValue(0);
      const points = meta.data;
      if (!points || points.length < 2) return;

      const drawArea = (polyline: {x:number,y:number}[], above: boolean) => {
        if (polyline.length < 2) return;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(polyline[0].x, polyline[0].y);
        for (let i = 1; i < polyline.length; i++) {
          ctx.lineTo(polyline[i].x, polyline[i].y);
        }
        ctx.lineTo(polyline[polyline.length - 1].x, zeroY);
        ctx.lineTo(polyline[0].x, zeroY);
        ctx.closePath();
        let grad: CanvasGradient;
        if (above) {
          grad = ctx.createLinearGradient(0, chartArea.top, 0, zeroY);
          grad.addColorStop(0, 'rgba(22, 163, 74, 0.30)');
          grad.addColorStop(1, 'rgba(22, 163, 74, 0.03)');
        } else {
          grad = ctx.createLinearGradient(0, zeroY, 0, chartArea.bottom);
          grad.addColorStop(0, 'rgba(220, 38, 38, 0.03)');
          grad.addColorStop(1, 'rgba(220, 38, 38, 0.28)');
        }
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      };

      // Dashed zero line
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
      ctx.lineWidth = 1;
      ctx.moveTo(chartArea.left, zeroY);
      ctx.lineTo(chartArea.right, zeroY);
      ctx.stroke();
      ctx.restore();

      // Split path at zero crossings
      let posSeg: {x:number,y:number}[] = [];
      let negSeg: {x:number,y:number}[] = [];

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const prev = i > 0 ? points[i - 1] : null;

        if (prev) {
          const prevAbove = prev.y < zeroY;
          const currAbove = p.y < zeroY;
          const prevOn = Math.abs(prev.y - zeroY) < 0.5;
          const currOn = Math.abs(p.y - zeroY) < 0.5;

          if ((prevAbove && !currAbove && !currOn) || (!prevAbove && !prevOn && currAbove)) {
            const t = (zeroY - prev.y) / (p.y - prev.y);
            const ix = prev.x + t * (p.x - prev.x);
            const cp = { x: ix, y: zeroY };

            if (prevAbove || prevOn) {
              posSeg.push(cp);
              drawArea(posSeg, true);
              posSeg = [];
              negSeg = currOn ? [] : [cp];
            } else {
              negSeg.push(cp);
              drawArea(negSeg, false);
              negSeg = [];
              posSeg = currOn ? [] : [cp];
            }
            continue;
          }
        }

        const isAbove = p.y < zeroY;
        const isOn = Math.abs(p.y - zeroY) < 0.5;

        if (isAbove) {
          if (negSeg.length >= 2) drawArea(negSeg, false);
          negSeg = [];
          posSeg.push({ x: p.x, y: p.y });
        } else if (isOn) {
          if (posSeg.length) posSeg.push({ x: p.x, y: zeroY });
          if (negSeg.length) negSeg.push({ x: p.x, y: zeroY });
        } else {
          if (posSeg.length >= 2) drawArea(posSeg, true);
          posSeg = [];
          negSeg.push({ x: p.x, y: p.y });
        }
      }

      if (posSeg.length >= 2) drawArea(posSeg, true);
      if (negSeg.length >= 2) drawArea(negSeg, false);
    }
  };

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

  /* Apply gradient fills after chart renders */
  useEffect(() => {
    requestAnimationFrame(() => {
      // Daily bar chart gradients
      if (dailyChartRef.current && stats?.dailyArr) {
        const chart = dailyChartRef.current;
        const area = chart.chartArea;
        if (area) {
          const ctx = chart.ctx;
          const colors = stats.dailyArr.map((v: any) => {
            const grad = ctx.createLinearGradient(0, area.bottom, 0, area.top);
            if (v.pnl >= 0) {
              grad.addColorStop(0, 'rgba(22,163,74,0.55)');
              grad.addColorStop(1, 'rgba(22,163,74,0.85)');
            } else {
              grad.addColorStop(0, 'rgba(220,38,38,0.55)');
              grad.addColorStop(1, 'rgba(220,38,38,0.85)');
            }
            return grad;
          });
          chart.data.datasets[0].backgroundColor = colors;
          chart.data.datasets[0].borderRadius = 5;
          chart.data.datasets[0].borderSkipped = false;
          chart.update('none');
        }
      }
    });
  }, [stats]);

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
        <div className="journal-subtabs fade-in-up">
          <div className={`journal-subtab ${journalTab === 'premarket' ? 'active' : ''}`} onClick={() => setJournalTab('premarket')}>
            Pre-Market
          </div>
          <div className={`journal-subtab ${journalTab === 'posttrade' ? 'active' : ''}`} onClick={() => setJournalTab('posttrade')}>
            Post-Market
          </div>
        </div>
        <div className="fade-in-up">
          {journalTab === 'premarket' && <JournalPreMarket latestTradeDate={todayStr} />}
          {journalTab === 'posttrade' && <JournalPostTrade trades={latestTrades} date={latestDate} />}
        </div>
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
          <div className="stat-pills stagger">
            {/* Net P&L */}
            <div className="stat-pill fade-in-up">
              <div className="sp-text">
                <span className="label">Net P&amp;L</span>
                <span className={`value ${stats?.netPnl >= 0 ? 'green' : 'red'}`}>{stats ? fmtINR(stats.netPnl) : '—'}</span>
              </div>
              {stats && (
                <div className="sp-viz">
                  <svg viewBox="0 0 48 32" width="48" height="32">
                    {/* mini sparkline area */}
                    {(() => {
                      const arr = stats.cumulativeArr.slice(-20);
                      if (arr.length < 2) return null;
                      const vals = arr.map((d: any) => d.pnl);
                      const min = Math.min(...vals), max = Math.max(...vals);
                      const range = max - min || 1;
                      const pts = vals.map((v: number, i: number) => `${(i / (vals.length - 1)) * 48},${28 - ((v - min) / range) * 26}`).join(' ');
                      const areaPts = `0,28 ${pts} 48,28`;
                      const isUp = vals[vals.length - 1] >= vals[0];
                      return (
                        <>
                          <polygon points={areaPts} fill={isUp ? 'rgba(22,163,74,0.12)' : 'rgba(220,38,38,0.12)'} />
                          <polyline points={pts} fill="none" stroke={isUp ? 'var(--green)' : 'var(--red)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </>
                      );
                    })()}
                  </svg>
                </div>
              )}
            </div>

            {/* Trade Win % */}
            <div className="stat-pill fade-in-up">
              <div className="sp-text">
                <span className="label">Trade Win %</span>
                <span className="value">{stats ? stats.tradeWinPct.toFixed(1) + '%' : '—'}</span>
              </div>
              {stats && (
                <div className="sp-viz">
                  <svg viewBox="0 0 48 48" width="48" height="48">
                    {/* Track: 3 color segments — red, blue breakeven, green */}
                    <circle cx="24" cy="24" r="18" fill="none" stroke="#fecaca" strokeWidth="4" strokeDasharray="54.3 113.1" transform="rotate(-90 24 24)" />
                    <circle cx="24" cy="24" r="18" fill="none" stroke="#c7d2fe" strokeWidth="4" strokeDasharray="4.5 113.1" strokeDashoffset="-54.3" transform="rotate(-90 24 24)" />
                    <circle cx="24" cy="24" r="18" fill="none" stroke="#bbf7d0" strokeWidth="4" strokeDasharray="54.3 113.1" strokeDashoffset="-58.8" transform="rotate(-90 24 24)" />
                    {/* Filled arc — solid color based on zone */}
                    {(() => {
                      const v = stats.tradeWinPct;
                      const pct = (v / 100) * 113.1;
                      const color = v < 48 ? '#ef4444' : v <= 52 ? '#6366f1' : '#16a34a';
                      return (
                        <circle cx="24" cy="24" r="18" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
                          strokeDasharray={`${pct} 113.1`} transform="rotate(-90 24 24)" />
                      );
                    })()}
                    <text x="24" y="27" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)" fontFamily="var(--font-display)">{Math.round(stats.tradeWinPct)}</text>
                  </svg>
                </div>
              )}
            </div>

            {/* Profit Factor */}
            <div className="stat-pill fade-in-up">
              <div className="sp-text">
                <span className="label">Profit Factor</span>
                <span className="value">{pf}</span>
              </div>
              {stats && (
                <div className="sp-viz">
                  <svg viewBox="0 0 48 32" width="48" height="32">
                    {/* gauge track */}
                    <rect x="2" y="18" width="44" height="6" rx="3" fill="var(--surface)" stroke="var(--border)" strokeWidth="0.5" />
                    {/* filled portion */}
                    {(() => {
                      const val = Math.min(Math.max(stats.profitFactor, 0), 3);
                      const pct = val / 3;
                      const color = val >= 1 ? 'var(--green)' : val >= 0.5 ? '#f59e0b' : 'var(--red)';
                      return <rect x="2" y="18" width={pct * 44} height="6" rx="3" fill={color} opacity="0.85" />;
                    })()}
                    {/* break-even marker at 1.0 */}
                    <line x1="16.7" y1="14" x2="16.7" y2="28" stroke="var(--text-secondary)" strokeWidth="1" strokeDasharray="2 2" />
                    <text x="16.7" y="12" textAnchor="middle" fontSize="7" fill="var(--text-secondary)" fontFamily="var(--font)">1.0</text>
                  </svg>
                </div>
              )}
            </div>

            {/* Day Win % */}
            <div className="stat-pill fade-in-up">
              <div className="sp-text">
                <span className="label">Day Win %</span>
                <span className="value">{stats ? stats.dayWinPct.toFixed(1) + '%' : '—'}</span>
              </div>
              {stats && (
                <div className="sp-viz">
                  <svg viewBox="0 0 48 48" width="48" height="48">
                    {/* Track: 3 color segments — red, blue breakeven, green */}
                    <circle cx="24" cy="24" r="18" fill="none" stroke="#fecaca" strokeWidth="4" strokeDasharray="54.3 113.1" transform="rotate(-90 24 24)" />
                    <circle cx="24" cy="24" r="18" fill="none" stroke="#c7d2fe" strokeWidth="4" strokeDasharray="4.5 113.1" strokeDashoffset="-54.3" transform="rotate(-90 24 24)" />
                    <circle cx="24" cy="24" r="18" fill="none" stroke="#bbf7d0" strokeWidth="4" strokeDasharray="54.3 113.1" strokeDashoffset="-58.8" transform="rotate(-90 24 24)" />
                    {/* Filled arc — solid color based on zone */}
                    {(() => {
                      const v = stats.dayWinPct;
                      const pct = (v / 100) * 113.1;
                      const color = v < 48 ? '#ef4444' : v <= 52 ? '#6366f1' : '#16a34a';
                      return (
                        <circle cx="24" cy="24" r="18" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
                          strokeDasharray={`${pct} 113.1`} transform="rotate(-90 24 24)" />
                      );
                    })()}
                    <text x="24" y="27" textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)" fontFamily="var(--font-display)">{Math.round(stats.dayWinPct)}</text>
                  </svg>
                </div>
              )}
            </div>

            {/* Avg Win / Loss */}
            <div className="stat-pill fade-in-up">
              <div className="sp-text">
                <span className="label">Avg Win / Loss</span>
                <span className="value">{awl}</span>
              </div>
              {stats && (
                <div className="sp-viz">
                  <svg viewBox="0 0 48 36" width="48" height="36">
                    {(() => {
                      const win = Math.abs(stats.avgWin || 0);
                      const loss = Math.abs(stats.avgLoss || 0);
                      const max = Math.max(win, loss, 1);
                      const winW = (win / max) * 42;
                      const lossW = (loss / max) * 42;
                      return (
                        <>
                          <text x="2" y="10" fontSize="7" fill="var(--text-secondary)" fontFamily="var(--font)">Win</text>
                          <rect x="2" y="13" width={winW} height="5" rx="2.5" fill="var(--green)" opacity="0.85" />
                          <text x="2" y="26" fontSize="7" fill="var(--text-secondary)" fontFamily="var(--font)">Loss</text>
                          <rect x="2" y="29" width={lossW} height="5" rx="2.5" fill="var(--red)" opacity="0.85" />
                        </>
                      );
                    })()}
                  </svg>
                </div>
              )}
            </div>
          </div>

          <div className="charts-row">
            <div className="section fade-in-up">
              <div className="section-header">
                <div><div className="section-title">Cumulative Net P&amp;L</div><div className="section-subtitle">Running total · realized only</div></div>
                <span style={{fontSize:'20px',fontWeight:700,color: stats && stats.cumulativeArr.length ? (stats.cumulativeArr[stats.cumulativeArr.length-1].pnl >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-secondary)'}}>
                  {stats && stats.cumulativeArr.length ? fmtINR(stats.cumulativeArr[stats.cumulativeArr.length-1].pnl) : '—'}
                </span>
              </div>
              <div className="chart-wrap">
                {!stats || !stats.dailyArr.length ? <div className="chart-empty"><div className="chart-empty-icon">📈</div><div className="chart-empty-text">Import trades to see P&amp;L curve</div></div> :
                  <Line ref={cumChartRef} plugins={[splitAreaPlugin]} data={{
                    labels: stats.dailyArr.map((d: any) => fmtDateChart(d.date)),
                    datasets: [{ data: stats.cumulativeArr.map((d: any) => d.pnl), borderColor: '#16a34a', backgroundColor: 'transparent', fill: false, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#16a34a', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, tension: 0.35, segment: { borderColor: (ctx: any) => ctx.p1.parsed.y >= 0 ? '#16a34a' : '#dc2626' } }]
                  }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { display: false } }, y: { grid: { color: '#f0efec' }, border: { display: false } } } }} />
                }
              </div>
            </div>
            <div className="section fade-in-up">
              <div className="section-header">
                <div><div className="section-title">Daily Net P&amp;L</div><div className="section-subtitle">Green = win day · Red = loss day</div></div>
              </div>
              <div className="chart-wrap">
                {!stats || !stats.dailyArr.length ? <div className="chart-empty"><div className="chart-empty-icon">📊</div><div className="chart-empty-text">Import trades to see daily P&amp;L</div></div> :
                  <Bar ref={dailyChartRef} data={{
                    labels: stats.dailyArr.map((d: any) => fmtDateChart(d.date)),
                    datasets: [{ data: stats.dailyArr.map((d: any) => d.pnl), backgroundColor: stats.dailyArr.map((v: any) => v.pnl >= 0 ? '#16a34a' : '#dc2626'), borderRadius: 4 }]
                  }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { display: false } }, y: { grid: { color: '#f5f5f5' } } } }} />
                }
              </div>
            </div>
          </div>

          <div className="section cal-section fade-in-up">
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
          <div className="fade-in-up" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}}>
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
                <div key={key} className="month-section fade-in-up">
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
          <div className="fade-in-up"><Playbooks /></div>
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
