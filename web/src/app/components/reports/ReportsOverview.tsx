'use client';

import React, { useState, useEffect } from 'react';
import { fmtMoney } from '@/lib/ui/format';
import type { BrokerFilter, SegmentFilter } from '@/lib/engine/trade-filters';

interface OverviewStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  currency: string;
  grossPnl: number;
  netPnl: number;
  fundingAdjustedNetPnl: number;
  largestProfit: number;
  largestLoss: number;
  avgTradePnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  avgHoldTimeAll: number;
  avgHoldTimeWins: number;
  avgHoldTimeLosses: number;
  avgDailyVolume: number;
  totalTradingDays: number;
  winningDays: number;
  losingDays: number;
  breakevenDays: number;
  loggedDays: number;
  avgDailyPnl: number;
  avgWinningDayPnl: number;
  avgLosingDayPnl: number;
  largestProfitableDay: number;
  largestLosingDay: number;
  maxConsecutiveWinningDays: number;
  maxConsecutiveLosingDays: number;
  maxDrawdown: number;
  avgDrawdown: number;
  avgPlannedR: number | null;
  avgRealisedR: number | null;
  totalCommissions: number;
  funding: number;
  openTrades: number;
}

function fmtMinutes(minutes: number): string {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return Math.round(minutes) + 'm';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtR(value: number | null): string {
  if (value === null) return '—';
  return (value >= 0 ? '+' : '') + value.toFixed(2) + 'R';
}

interface Props {
  brokerFilter?: BrokerFilter;
  segmentFilter?: SegmentFilter[];
}

export default function ReportsOverview({ brokerFilter = 'all', segmentFilter = ['all'] }: Props) {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const segmentParam = segmentFilter.join(',');

  useEffect(() => {
    const params = new URLSearchParams({ broker: brokerFilter, segment: segmentParam });
    fetch(`/api/reports/overview?${params.toString()}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(d => setStats(d))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [brokerFilter, segmentParam]);

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

  if (!stats) {
    return (
      <div className="section" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="chart-empty-icon">📊</div>
        <div className="chart-empty-text">Import trades to see your report overview</div>
      </div>
    );
  }

  const winPct = stats.totalTrades > 0 ? ((stats.winningTrades / stats.totalTrades) * 100).toFixed(1) + '%' : '—';
  const dayWinPct = stats.totalTradingDays > 0 ? ((stats.winningDays / stats.totalTradingDays) * 100).toFixed(1) + '%' : '—';
  const money = (n: number) => fmtMoney(n, stats.currency);

  const sections: { title: string; rows: [string, string][] }[] = [
    {
      title: 'Trade Performance',
      rows: [
        ['Total trades', String(stats.totalTrades)],
        ['Winning trades', stats.winningTrades + ' (' + winPct + ')'],
        ['Losing trades', String(stats.losingTrades)],
        ['Breakeven trades', String(stats.breakevenTrades)],
        ['Gross P&L', money(stats.grossPnl)],
        ['Fees/commission', money(-stats.totalCommissions)],
        ['Net P&L', money(stats.netPnl)],
        ['Funding', money(stats.funding || 0)],
        ['Funding-adjusted net P&L', money(stats.fundingAdjustedNetPnl)],
        ['Average trade P&L', money(stats.avgTradePnl)],
        ['Average winning trade', money(stats.avgWin)],
        ['Average losing trade', money(-stats.avgLoss)],
        ['Largest profit', money(stats.largestProfit)],
        ['Largest loss', money(stats.largestLoss)],
        ['Profit factor', stats.profitFactor >= 999 ? '∞' : stats.profitFactor.toFixed(2)],
        ['Max consecutive wins', String(stats.maxConsecutiveWins)],
        ['Max consecutive losses', String(stats.maxConsecutiveLosses)],
      ],
    },
    {
      title: 'Holding & Volume',
      rows: [
        ['Average hold time (all)', fmtMinutes(stats.avgHoldTimeAll)],
        ['Average hold time (wins)', fmtMinutes(stats.avgHoldTimeWins)],
        ['Average hold time (losses)', fmtMinutes(stats.avgHoldTimeLosses)],
        ['Average daily volume', stats.avgDailyVolume.toFixed(2)],
      ],
    },
    {
      title: 'Trading Days',
      rows: [
        ['Total trading days', String(stats.totalTradingDays)],
        ['Winning days', stats.winningDays + ' (' + dayWinPct + ')'],
        ['Losing days', String(stats.losingDays)],
        ['Breakeven days', String(stats.breakevenDays)],
        ['Logged days (journal)', String(stats.loggedDays)],
        ['Max consecutive winning days', String(stats.maxConsecutiveWinningDays)],
        ['Max consecutive losing days', String(stats.maxConsecutiveLosingDays)],
      ],
    },
    {
      title: 'Daily P&L',
      rows: [
        ['Average daily P&L', money(stats.avgDailyPnl)],
        ['Average winning day P&L', money(stats.avgWinningDayPnl)],
        ['Average losing day P&L', money(stats.avgLosingDayPnl)],
        ['Largest profitable day', money(stats.largestProfitableDay)],
        ['Largest losing day', money(stats.largestLosingDay)],
      ],
    },
    {
      title: 'Risk & Drawdown',
      rows: [
        ['Average planned R-multiple', fmtR(stats.avgPlannedR)],
        ['Average realised R-multiple', fmtR(stats.avgRealisedR)],
        ['Maximum drawdown', money(-stats.maxDrawdown)],
        ['Average drawdown', money(-stats.avgDrawdown)],
        ['Open trades', String(stats.openTrades)],
        ['Total commissions', money(-stats.totalCommissions)],
      ],
    },
  ];

  const leftSections = [sections[0], sections[2]]; // Trade Performance, Trading Days
  const rightSections = [sections[1], sections[3], sections[4]]; // Holding & Volume, Daily P&L, Risk & Drawdown

  const renderColumn = (cols: typeof sections, offset: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {cols.map((section, si) => (
        <div key={si} className="section fade-in-up" style={{ animationDelay: `${(offset + si) * 0.04}s` }}>
          <div className="section-header">
            <span className="section-title">{section.title}</span>
          </div>
          <table className="overview-table">
            <tbody>
              {section.rows.map(([label, value], ri) => (
                <tr key={ri}>
                  <td className="overview-label">{label}</td>
                  <td className={`overview-value ${value.startsWith('+') ? 'green' : value.startsWith('−') ? 'red' : ''}`}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );

  return (
    <div className="overview-grid">
      {renderColumn(leftSections, 0)}
      {renderColumn(rightSections, 1)}
    </div>
  );
}
