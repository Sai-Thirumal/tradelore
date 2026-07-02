'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip, Filler, Legend, BarElement
} from 'chart.js';
import type { ChartOptions, Plugin, TooltipItem } from 'chart.js';
import { getErrorMessage } from '@/lib/errors';
import { fmtMoney } from '@/lib/ui/format';
import type { BrokerFilter, SegmentFilter } from '@/lib/engine/trade-filters';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Filler, Legend);

type Group = 'days' | 'months' | 'trade-time' | 'trade-duration' | 'instruments' | 'deployed-capital' | 'playbooks' | 'options-expiry';

interface GroupRow {
  label: string;
  winPct: number;
  netPnl: number;
  funding: number;
  fundingAdjustedNetPnl: number;
  tradeCount: number;
  avgWin: number;
  avgLoss: number;
  avgVolume: number;
}

interface ReportData {
  currency: string;
  groups: GroupRow[];
  bestPerforming: GroupRow | null;
  leastPerforming: GroupRow | null;
  mostActive: GroupRow | null;
  bestWinRate: GroupRow | null;
}

const GROUP_LABELS: Record<Group, string> = {
  days: 'day',
  months: 'month',
  'trade-time': 'hour',
  'trade-duration': 'duration',
  instruments: 'instrument',
  'deployed-capital': 'capital range',
  playbooks: 'playbook',
  'options-expiry': 'expiry bucket',
};

const ROWS_PER_PAGE = 15;

// Split-area plugin for green/red P&L fill
interface ChartPoint {
  x: number;
  y: number;
}

const splitAreaPlugin: Plugin<'line'> = {
  id: 'splitAreaReport',
  beforeDatasetDraw(chart, args) {
    const datasetIndex = args.index;
    if (datasetIndex !== 0) return;
    const meta = chart.getDatasetMeta(datasetIndex);
    if (!meta || meta.hidden) return;
    const { ctx, chartArea, scales } = chart;
    const yScale = scales.y;
    const zeroY = yScale.getPixelForValue(0);
    const points = meta.data as ChartPoint[];
    if (!points || points.length < 2) return;

    const drawArea = (polyline: { x: number; y: number }[], above: boolean) => {
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

    ctx.save();
    ctx.beginPath();
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
    ctx.lineWidth = 1;
    ctx.moveTo(chartArea.left, zeroY);
    ctx.lineTo(chartArea.right, zeroY);
    ctx.stroke();
    ctx.restore();

    let posSeg: { x: number; y: number }[] = [];
    let negSeg: { x: number; y: number }[] = [];

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
            posSeg.push(cp); drawArea(posSeg, true); posSeg = [];
            negSeg = currOn ? [] : [cp];
          } else {
            negSeg.push(cp); drawArea(negSeg, false); negSeg = [];
            posSeg = currOn ? [] : [cp];
          }
          continue;
        }
      }
      const isAbove = p.y < zeroY;
      const isOn = Math.abs(p.y - zeroY) < 0.5;
      if (isAbove) {
        if (negSeg.length >= 2) drawArea(negSeg, false);
        negSeg = []; posSeg.push({ x: p.x, y: p.y });
      } else if (isOn) {
        if (posSeg.length) posSeg.push({ x: p.x, y: zeroY });
        if (negSeg.length) negSeg.push({ x: p.x, y: zeroY });
      } else {
        if (posSeg.length >= 2) drawArea(posSeg, true);
        posSeg = []; negSeg.push({ x: p.x, y: p.y });
      }
    }
    if (posSeg.length >= 2) drawArea(posSeg, true);
    if (negSeg.length >= 2) drawArea(negSeg, false);
  },
};

interface Props {
  group: Group;
  brokerFilter?: BrokerFilter;
  segmentFilter?: SegmentFilter[];
}

export default function DayTimeReport({ group, brokerFilter = 'all', segmentFilter = ['all'] }: Props) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topN, setTopN] = useState(10);
  const [chartMode, setChartMode] = useState<'pnl' | 'win'>('pnl');

  // ── Table pagination ──
  const [page, setPage] = useState(1);

  // ── Table filters ──
  const [sortBy, setSortBy] = useState<'default' | 'pnlAsc' | 'pnlDesc'>('default');
  const [minTrades, setMinTrades] = useState<string>('');
  const [wlRatioMode, setWlRatioMode] = useState<'any' | 'gt1' | 'lt1' | 'custom'>('any');
  const [wlRatioMin, setWlRatioMin] = useState<string>('');
  const [wlRatioMax, setWlRatioMax] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const segmentParam = segmentFilter.join(',');

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError('');
      }
    });
    const params = new URLSearchParams({ group, broker: brokerFilter, segment: segmentParam });
    fetch(`/api/reports/day-time?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(d => { if (!cancelled) setData(d); })
      .catch((err: unknown) => { if (!cancelled) setError(getErrorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [group, brokerFilter, segmentParam]);

  // Reset page when group changes
  useEffect(() => {
    queueMicrotask(() => {
      setPage(1);
      setSortBy('default');
      setMinTrades('');
      setWlRatioMode('any');
      setWlRatioMin('');
      setWlRatioMax('');
      setShowFilters(false);
    });
  }, [group]);

  const filteredGroups = useMemo(() => {
    if (!data) return [];
    let rows = [...data.groups];

    // Min trades filter
    const minT = parseInt(minTrades, 10);
    if (!isNaN(minT) && minT > 0) {
      rows = rows.filter(g => g.tradeCount >= minT);
    }

    // Win/Loss ratio filter
    if (wlRatioMode !== 'any') {
      rows = rows.filter(g => {
        if (g.avgLoss <= 0) return false; // avoid divide-by-zero; no valid ratio
        const ratio = g.avgWin / g.avgLoss;
        if (wlRatioMode === 'gt1') return ratio > 1;
        if (wlRatioMode === 'lt1') return ratio < 1;
        if (wlRatioMode === 'custom') {
          const minVal = parseFloat(wlRatioMin);
          const maxVal = parseFloat(wlRatioMax);
          const hasMin = !isNaN(minVal) && minVal >= 0;
          const hasMax = !isNaN(maxVal) && maxVal >= 0;
          if (hasMin && hasMax) return ratio >= minVal && ratio <= maxVal;
          if (hasMin) return ratio >= minVal;
          if (hasMax) return ratio <= maxVal;
        }
        return true;
      });
    }

    // Sort
    if (sortBy === 'pnlAsc') rows.sort((a, b) => a.netPnl - b.netPnl);
    else if (sortBy === 'pnlDesc') rows.sort((a, b) => b.netPnl - a.netPnl);

    return rows;
  }, [data, sortBy, minTrades, wlRatioMode, wlRatioMin, wlRatioMax]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = filteredGroups.slice((safePage - 1) * ROWS_PER_PAGE, safePage * ROWS_PER_PAGE);
  const money = (n: number) => fmtMoney(n, data?.currency || 'INR');

  const renderStatCards = () => {
    if (!data) return null;
    const gLabel = GROUP_LABELS[group];
    const cards = [
      { label: 'Best performing ' + gLabel, item: data.bestPerforming, color: 'green', icon: '↑' },
      { label: 'Least performing ' + gLabel, item: data.leastPerforming, color: 'red', icon: '↓' },
      { label: 'Most active ' + gLabel, item: data.mostActive, color: '', icon: '⚡' },
      { label: 'Best win rate', item: data.bestWinRate, color: '', icon: '🏆' },
    ];

    return (
      <div className="stat-pills stagger">
        {cards.map((card, i) => (
          <div key={i} className="stat-pill fade-in-up">
            <div className="sp-text">
              <span className="label">{card.label}</span>
              {card.item ? (
                <>
                  <span className="value">{card.item.label}</span>
                  <span className="sub">
                    {card.item.tradeCount} trade{card.item.tradeCount !== 1 ? 's' : ''}
                    {(card.color === 'green' || card.color === 'red') && (
                      <> · <span className={card.color}>{money(card.item.netPnl)}</span></>
                    )}
                    {!card.color && card.item.winPct !== undefined && (
                      <> · <span>{card.item.winPct.toFixed(1)}%</span></>
                    )}
                  </span>
                </>
              ) : (
                <span className="value">—</span>
              )}
            </div>
            <div className="sp-viz">
              <span style={{ fontSize: '20px', opacity: 0.5 }}>{card.icon}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderCharts = () => {
    if (!data || !data.groups.length) return null;

    // ── Category reports: horizontal bar chart with Top N ──
    if (group === 'instruments' || group === 'playbooks') {
      const sorted = [...data.groups].sort((a, b) =>
        chartMode === 'pnl' ? a.netPnl - b.netPnl : a.winPct - b.winPct
      );
      const sliced = topN === 0 ? sorted : sorted.slice(-topN);

      const isWin = chartMode === 'win';
      const barData = {
        labels: sliced.map(g => g.label),
        datasets: [
          {
            label: isWin ? 'Win %' : 'Net P&L',
            data: sliced.map(g => isWin ? g.winPct : g.netPnl),
            backgroundColor: isWin
              ? sliced.map(g => g.winPct >= 50 ? 'rgba(22,163,74,0.75)' : 'rgba(220,38,38,0.75)')
              : sliced.map(g => g.netPnl >= 0 ? 'rgba(22,163,74,0.75)' : 'rgba(220,38,38,0.75)'),
            borderColor: isWin
              ? sliced.map(g => g.winPct >= 50 ? '#16a34a' : '#dc2626')
              : sliced.map(g => g.netPnl >= 0 ? '#16a34a' : '#dc2626'),
            borderWidth: 1,
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      };

      const barOptions: ChartOptions<'bar'> = {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx: TooltipItem<'bar'>) => isWin ? Number(ctx.raw).toFixed(1) + '%' : money(Number(ctx.raw)),
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              font: { size: 10 },
              callback: (v) => isWin ? v + '%' : money(Number(v)),
            },
          },
          y: {
            grid: { display: false },
            ticks: {
              display: sliced.length <= 30,
              font: { size: 11 },
            },
          },
        },
      };

      const chartHeight = sliced.length <= 30
        ? sliced.length * 22
        : Math.max(200, sliced.length * 10);

      return (
        <div className="section">
          <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="section-title">
              {isWin
                ? `Win % by ${group === 'playbooks' ? 'Playbook' : 'Instrument'}`
                : `Net P&L by ${group === 'playbooks' ? 'Playbook' : 'Instrument'}`}
            </span>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '3px' }}>
              <button
                onClick={() => setChartMode('pnl')}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: chartMode === 'pnl' ? 600 : 400,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: chartMode === 'pnl' ? 'var(--brand)' : 'transparent',
                  color: chartMode === 'pnl' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                P&L
              </button>
              <button
                onClick={() => setChartMode('win')}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: chartMode === 'win' ? 600 : 400,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: chartMode === 'win' ? 'var(--brand)' : 'transparent',
                  color: chartMode === 'win' ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Win %
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {[10, 20, 30, 0].map(n => (
              <button
                key={n}
                onClick={() => setTopN(n)}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: topN === n ? 600 : 400,
                  border: `1px solid ${topN === n ? 'var(--brand)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  background: topN === n ? 'var(--brand-light)' : 'var(--bg)',
                  color: topN === n ? 'var(--brand)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                {n === 0 ? 'All' : `Top ${n}`}
              </button>
            ))}
          </div>
          <div className="chart-wrap" style={{ height: `${chartHeight}px` }}>
            <Bar data={barData} options={barOptions} />
          </div>
        </div>
      );
    }

    // ── Day & Time reports: combo + win rate ──
    const labels = data.groups.map(g => g.label);
    const pnlValues = data.groups.map(g => g.netPnl);
    const countValues = data.groups.map(g => g.tradeCount);
    const avgWinValues = data.groups.map(g => g.avgWin);
    const winPctValues = data.groups.map(g => g.winPct);

    const comboData = {
      labels,
      datasets: [
        {
          label: 'Net P&L',
          data: pnlValues,
          borderColor: '#16a34a',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: 0.3,
          yAxisID: 'y',
        },
        {
          label: 'Trade count',
          data: countValues,
          borderColor: '#3b82f6',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: 0.3,
          yAxisID: 'y1',
        },
        {
          label: 'Avg win',
          data: avgWinValues,
          borderColor: '#f59e0b',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 4,
          tension: 0.3,
          yAxisID: 'y',
        },
      ],
    };

    const comboOptions: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx: TooltipItem<'line'>) => ctx.dataset.label === 'Net P&L' || ctx.dataset.label === 'Avg win' ? money(Number(ctx.raw)) : String(ctx.raw) } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          type: 'linear', position: 'left',
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { font: { size: 10 }, callback: (v) => money(Number(v)) },
        },
        y1: {
          type: 'linear', position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 10 } },
        },
      },
    };

    const winData = {
      labels,
      datasets: [
        {
          label: 'Win %',
          data: winPctValues,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.3,
          fill: true,
        },
      ],
    };

    const winOptions: ChartOptions<'line'> = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 16, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx: TooltipItem<'line'>) => Number(ctx.raw).toFixed(1) + '%' } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          min: 0, max: 100,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { font: { size: 10 }, callback: (v) => v + '%' },
        },
      },
    };

    return (
      <div className="charts-row">
        <div className="section">
          <div className="chart-wrap" style={{ height: '260px' }}>
            <Line data={comboData} options={comboOptions} plugins={[splitAreaPlugin]} />
          </div>
        </div>
        <div className="section">
          <div className="chart-wrap" style={{ height: '260px' }}>
            <Line data={winData} options={winOptions} />
          </div>
        </div>
      </div>
    );
  };

  const renderTable = () => {
    if (!data || !data.groups.length) return null;

    const labelCol = group === 'trade-time'
      ? 'Hour'
      : group === 'trade-duration'
        ? 'Duration'
        : group === 'months'
          ? 'Month'
          : group === 'instruments'
            ? 'Instrument'
            : group === 'playbooks'
              ? 'Playbook'
              : group === 'options-expiry'
                ? 'Time to expiry'
                : group === 'deployed-capital'
                  ? 'Contract notional'
                  : 'Day';

    const inputStyle: React.CSSProperties = {
      width: '90px',
      padding: '5px 8px',
      fontSize: '12px',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: 'var(--font)',
    };

    const filterRowStyle: React.CSSProperties = {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      flexWrap: 'wrap',
      padding: '10px 12px',
      background: 'var(--surface)',
      borderRadius: 'var(--radius-sm)',
      marginBottom: '10px',
    };

    const filterLabelStyle: React.CSSProperties = {
      fontSize: '11px',
      fontWeight: 600,
      color: 'var(--text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: '0.4px',
    };

    const sortBtn = (key: 'default' | 'pnlAsc' | 'pnlDesc', label: string) => (
      <button
        key={key}
        onClick={() => { setSortBy(key); setPage(1); }}
        style={{
          padding: '4px 10px',
          fontSize: '12px',
          fontWeight: sortBy === key ? 600 : 400,
          border: `1px solid ${sortBy === key ? 'var(--brand)' : 'var(--border)'}`,
          borderRadius: 'var(--radius-sm)',
          background: sortBy === key ? 'var(--brand-light)' : 'var(--bg)',
          color: sortBy === key ? 'var(--brand)' : 'var(--text-secondary)',
          cursor: 'pointer',
        }}
      >
        {label}
      </button>
    );

    return (
      <div className="section">
        <div className="section-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="section-title">Summary</span>
          <button
            onClick={() => setShowFilters(v => !v)}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: 500,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              background: showFilters ? 'var(--brand-light)' : 'var(--bg)',
              color: showFilters ? 'var(--brand)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>{showFilters ? '✕' : '⚙'}</span>
            <span>Filter</span>
          </button>
        </div>

        {showFilters && (
          <div style={filterRowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={filterLabelStyle}>Sort P&L</span>
              {sortBtn('default', 'Default')}
              {sortBtn('pnlAsc', 'Low → High')}
              {sortBtn('pnlDesc', 'High → Low')}
            </div>
            <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={filterLabelStyle}>Min trades</span>
              <input
                type="number"
                min={0}
                placeholder="e.g. 10"
                value={minTrades}
                onChange={e => { setMinTrades(e.target.value); setPage(1); }}
                style={inputStyle}
              />
            </div>
            <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={filterLabelStyle}>W/L ratio</span>
              {(['any', 'gt1', 'lt1', 'custom'] as const).map(mode => {
                const labels: Record<string, string> = {
                  any: 'Any',
                  gt1: '> 1',
                  lt1: '< 1',
                  custom: 'Custom',
                };
                const isActive = wlRatioMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => { setWlRatioMode(mode); setPage(1); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      fontWeight: isActive ? 600 : 400,
                      border: `1px solid ${isActive ? 'var(--brand)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius-sm)',
                      background: isActive ? 'var(--brand-light)' : 'var(--bg)',
                      color: isActive ? 'var(--brand)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    {labels[mode]}
                  </button>
                );
              })}
              {wlRatioMode === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Min"
                    value={wlRatioMin}
                    onChange={e => { setWlRatioMin(e.target.value); setPage(1); }}
                    style={{
                      width: '65px',
                      padding: '5px 8px',
                      fontSize: '12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontFamily: 'var(--font)',
                    }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>–</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="Max"
                    value={wlRatioMax}
                    onChange={e => { setWlRatioMax(e.target.value); setPage(1); }}
                    style={{
                      width: '65px',
                      padding: '5px 8px',
                      fontSize: '12px',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg)',
                      color: 'var(--text)',
                      fontFamily: 'var(--font)',
                    }}
                  />
                </div>
              )}
            </div>
            <button
              onClick={() => { setSortBy('default'); setMinTrades(''); setWlRatioMode('any'); setWlRatioMin(''); setWlRatioMax(''); setPage(1); }}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 500,
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              Reset
            </button>
          </div>
        )}

        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>{labelCol}</th>
                <th>Win %</th>
                <th>Net P&L</th>
                <th>Funding</th>
                <th>Funding adj net</th>
                <th>Trades</th>
                <th>Avg win</th>
                <th>Avg loss</th>
                <th>Avg volume</th>
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((g, i) => (
                <tr key={i}>
                  <td className="report-table-label">{g.label}</td>
                  <td>{g.tradeCount > 0 ? g.winPct.toFixed(2) + '%' : '—'}</td>
                  <td className={g.netPnl >= 0 ? 'green' : 'red'}>{money(g.netPnl)}</td>
                  <td className={g.funding >= 0 ? 'green' : 'red'}>{g.funding ? money(g.funding) : '—'}</td>
                  <td className={g.fundingAdjustedNetPnl >= 0 ? 'green' : 'red'}>{money(g.fundingAdjustedNetPnl)}</td>
                  <td>{g.tradeCount}</td>
                  <td className="green">{g.avgWin > 0 ? money(g.avgWin) : '—'}</td>
                  <td className="red">{g.avgLoss > 0 ? money(-g.avgLoss) : '—'}</td>
                  <td>{g.avgVolume > 0 ? g.avgVolume.toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredGroups.length > ROWS_PER_PAGE && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            borderTop: '1px solid var(--border)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
          }}>
            <span>
              Showing {(safePage - 1) * ROWS_PER_PAGE + 1}–{Math.min(safePage * ROWS_PER_PAGE, filteredGroups.length)} of {filteredGroups.length}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg)',
                  color: safePage <= 1 ? 'var(--text-secondary)' : 'var(--text)',
                  cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                  opacity: safePage <= 1 ? 0.5 : 1,
                }}
              >
                ← Prev
              </button>
              <span style={{ padding: '4px 10px', fontWeight: 600, color: 'var(--text)' }}>
                {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg)',
                  color: safePage >= totalPages ? 'var(--text-secondary)' : 'var(--text)',
                  cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: safePage >= totalPages ? 0.5 : 1,
                }}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Loading / Error / Empty ──

  if (loading) {
    return (
      <div className="section" style={{ textAlign: 'center', padding: '40px' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="section" style={{ textAlign: 'center', padding: '40px' }}>
        <span style={{ color: 'var(--red)', fontSize: '14px' }}>Failed to load: {error}</span>
      </div>
    );
  }

  if (!data?.groups.length) {
    return (
      <div className="section" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="chart-empty-icon">📊</div>
        <div className="chart-empty-text">
          {group === 'deployed-capital'
            ? 'Import trades with entry price and quantity to see this report'
            : group === 'playbooks'
              ? 'Tag trades with playbooks to see this report'
              : group === 'options-expiry'
                ? 'Import option trades with expiry data to see this report'
                : 'Import trades to see your reports'}
        </div>
      </div>
    );
  }

  return (
    <>
      {renderStatCards()}
      {renderCharts()}
      {renderTable()}
    </>
  );
}
