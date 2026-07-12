"use client";

import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Filler, Legend
} from 'chart.js';
import type { Chart, Plugin, ScriptableLineSegmentContext } from 'chart.js';
import { getErrorMessage } from '@/lib/errors';
import { fmtMoney, fmtPrice, fmtDateLabel, fmtDateChart } from '@/lib/ui/format';
import { computeStats, filterTradesByDateRange } from '@/lib/compute/stats';
import { isDeltaAutoSyncDue } from '@/lib/brokers/crypto/delta/autosync';
import { listBrokerCatalogEntries } from '@/lib/brokers/core/catalog';
import type { KnownBrokerId } from '@/lib/brokers/core/types';
import {
  filterTradesForScope,
  getScopeCurrency,
  getTradeCurrency,
  getTradeInstrumentLabel,
  type BrokerFilter,
  type SegmentFilter,
} from '@/lib/engine/trade-filters';
import type { TradeOrder, TradeRecord } from '@/lib/types/trading';
import DateRangePicker from '../components/DateRangePicker';
import JournalPreMarket from '../components/journal/PreMarket';
import JournalPostTrade from '../components/journal/PostTrade';
import LiveTradeNotes from '../components/journal/LiveTradeNotes';
import Playbooks from '../components/Playbooks';
import ReportsPage from '../components/reports/ReportsPage';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Filler, Legend);

type Stats = ReturnType<typeof computeStats>;
type CalendarDay = number | null;
type TradeWithIndex = TradeRecord & { originalIdx: number };
type ActiveBrokerFilter = Exclude<BrokerFilter, 'all'>;
type DashboardView = 'dashboard' | 'journal' | 'tradelog' | 'playbooks' | 'reports';

const DASHBOARD_VIEWS: DashboardView[] = ['dashboard', 'journal', 'tradelog', 'playbooks', 'reports'];
const BROKERS = listBrokerCatalogEntries();
const BROKER_BY_ID = new Map(BROKERS.map((broker) => [broker.id, broker]));

const SEGMENT_OPTIONS: { value: SegmentFilter; label: string; market: 'india' | 'crypto' }[] = [
  { value: 'equity', label: 'Equity', market: 'india' },
  { value: 'fo', label: 'F&O', market: 'india' },
  { value: 'mcx', label: 'MCX', market: 'india' },
  { value: 'delta_perp', label: 'Delta Perp', market: 'crypto' },
  { value: 'delta_futures', label: 'Delta Futures', market: 'crypto' },
  { value: 'delta_options', label: 'Delta Options', market: 'crypto' },
];

function segmentsForBroker(selected: SegmentFilter[], broker: ActiveBrokerFilter): SegmentFilter[] {
  if (selected.includes('all')) return ['all'];
  const market = BROKER_BY_ID.get(broker)?.market || 'india';
  const allowed = new Set(SEGMENT_OPTIONS.filter((option) => option.market === market).map((option) => option.value));
  const filtered = selected.filter((segment) => allowed.has(segment));
  return filtered.length ? filtered : ['all'];
}

interface ChartPoint {
  x: number;
  y: number;
}

interface ImportResult {
  imported_orders: number;
  total_trades: number;
}

interface ZerodhaStatus {
  server_configured: boolean;
  credentials_configured: boolean;
  configured: boolean;
  connected: boolean;
  needs_reconnect: boolean;
  api_key_masked: string;
  api_secret_saved: boolean;
  credentials_saved_at: string | null;
  redirect_url: string;
  token_expires_at: string | null;
  last_sync_at: string | null;
  last_sync_status: string;
  last_sync_error: string;
  broker_user_id: string;
  broker_user_name: string;
  today: string;
}

interface DeltaStatus {
  server_configured: boolean;
  credentials_configured: boolean;
  connected: boolean;
  last_sync_at: string | null;
}

interface SyncResult extends ImportResult {
  synced_at: string;
}

interface BrokerAutoSyncStatus {
  server_configured?: boolean;
  credentials_configured: boolean;
  connected?: boolean;
  needs_reconnect?: boolean;
  last_sync_at?: string | null;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get('view');
  const initialView = DASHBOARD_VIEWS.includes(requestedView as DashboardView)
    ? requestedView as DashboardView
    : 'dashboard';
  const [allTrades, setAllTrades] = useState<TradeRecord[]>([]);
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  
  const [view, setView] = useState<DashboardView>(initialView);
  const [journalTab, setJournalTab] = useState('premarket');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [segmentFilter, setSegmentFilter] = useState<SegmentFilter[]>(['all']);
  const [csvBroker, setCsvBroker] = useState<BrokerFilter | ''>(() => {
    if (typeof window === 'undefined') return '';
    const savedBroker = window.localStorage.getItem('tradelore_csv_broker');
    return savedBroker === 'zerodha' || savedBroker === 'delta' ? savedBroker : '';
  });
  
  const [expandedTradeRow, setExpandedTradeRow] = useState<string | null>(null);
  const [modalTradeIdx, setModalTradeIdx] = useState<number | null>(null);
  const [showCalInfo, setShowCalInfo] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  const [importStatus, setImportStatus] = useState('');
  const [toast, setToast] = useState<{ msg: string, type: string } | null>(null);
  const [journaledTradeIds, setJournaledTradeIds] = useState<Set<string>>(new Set());
  const [currentUser, setCurrentUser] = useState<{ email?: string } | null>(null);
  const [zerodhaStatus, setZerodhaStatus] = useState<ZerodhaStatus | null>(null);
  const [zerodhaSyncing, setZerodhaSyncing] = useState(false);
  const [deltaStatus, setDeltaStatus] = useState<DeltaStatus | null>(null);
  const [deltaSyncing, setDeltaSyncing] = useState(false);
  const [brokerStatuses, setBrokerStatuses] = useState<Partial<Record<KnownBrokerId, BrokerAutoSyncStatus>>>({});
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [segmentMenuOpen, setSegmentMenuOpen] = useState(false);
  const [brokerMenuOpen, setBrokerMenuOpen] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<ActiveBrokerFilter>(() => {
    if (typeof window === 'undefined') return 'zerodha';
    const savedBroker = window.localStorage.getItem('tradelore_dashboard_broker');
    return BROKER_BY_ID.has(savedBroker as KnownBrokerId) ? savedBroker as ActiveBrokerFilter : 'zerodha';
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const segmentMenuRef = useRef<HTMLDivElement>(null);
  const brokerMenuRef = useRef<HTMLDivElement>(null);
  const cumChartRef = useRef<Chart<'line'> | null>(null);
  const dailyChartRef = useRef<Chart<'bar'> | null>(null);

  const autoSyncedBrokersRef = useRef<Set<string>>(new Set());

  const selectDashboardView = (nextView: DashboardView) => {
    setView(nextView);

    const params = new URLSearchParams(window.location.search);
    if (nextView === 'dashboard') {
      params.delete('view');
    } else {
      params.set('view', nextView);
    }

    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);
  };

  /* Chart.js split-area plugin: green fill above zero, red fill below zero */
  const splitAreaPlugin: Plugin<'line'> = {
    id: 'splitArea',
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

  const showToast = useCallback((msg: string, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const brokerHasTrades = useCallback((broker: KnownBrokerId) => (
    allTrades.some((trade) => ((trade.broker || 'zerodha').trim().toLowerCase() || 'zerodha') === broker)
  ), [allTrades]);
  const availableBrokers = BROKERS.filter((broker) => brokerStatuses[broker.id]?.credentials_configured || brokerHasTrades(broker.id));
  const brokerFilter: ActiveBrokerFilter = availableBrokers.some((broker) => broker.id === selectedBroker)
    ? selectedBroker
    : availableBrokers[0]?.id || selectedBroker;
  const scopedSegmentFilter = segmentsForBroker(segmentFilter, brokerFilter);

  useEffect(() => {
    queueMicrotask(() => {
      const nextSegmentFilter = segmentsForBroker(segmentFilter, brokerFilter);
      const filtered = filterTradesForScope(filterTradesByDateRange(allTrades, customStart, customEnd), brokerFilter, nextSegmentFilter);
      setTrades(filtered);
      setStats(computeStats(filtered));
      setExpandedTradeRow(null);

      // Auto-expand the latest month
      if (filtered.length > 0) {
        const dates = filtered.map((t) => t.trade_date || t.date || '');
        const latest = dates.reduce((a, b) => b > a ? b : a, '');
        if (latest) {
          const d = new Date(latest.replace(/-/g, '/'));
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          setExpandedMonths(new Set([key]));
        }
      }
    });
  }, [allTrades, customStart, customEnd, brokerFilter, segmentFilter]);

  /* Apply gradient fills after chart renders */
  useEffect(() => {
    requestAnimationFrame(() => {
      // Daily bar chart gradients
      if (dailyChartRef.current && stats?.dailyArr) {
        const chart = dailyChartRef.current;
        const area = chart.chartArea;
        if (area) {
          const ctx = chart.ctx;
          const colors = stats.dailyArr.map((v) => {
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
          chart.data.datasets = chart.data.datasets.map((dataset, index) => index === 0
            ? { ...dataset, backgroundColor: colors, borderRadius: 5, borderSkipped: false }
            : dataset);
          chart.update('none');
        }
      }
    });
  }, [stats]);

  const loadTrades = useCallback(async () => {
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
    } catch (err: unknown) {
      showToast('Could not reach API: ' + getErrorMessage(err), 'error');
    }
  }, [showToast]);

  const loadCurrentUser = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        setCurrentUser(null);
        return;
      }
      const data = await res.json();
      setCurrentUser(data.user || null);
    } catch {
      setCurrentUser(null);
    }
  }, []);

  const loadZerodhaStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/broker/zerodha/status');
      if (!res.ok) {
        setZerodhaStatus(null);
        return null;
      }
      const data = await res.json() as ZerodhaStatus;
      setZerodhaStatus(data);
      setBrokerStatuses((statuses) => ({ ...statuses, zerodha: data }));
      return data;
    } catch {
      setZerodhaStatus(null);
      return null;
    }
  }, []);

  const loadDeltaStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/broker/delta/status', { cache: 'no-store' });
      if (!res.ok) {
        setDeltaStatus(null);
        return null;
      }
      const data = await res.json() as DeltaStatus;
      setDeltaStatus(data);
      setBrokerStatuses((statuses) => ({ ...statuses, delta: data }));
      return data;
    } catch {
      setDeltaStatus(null);
      return null;
    }
  }, []);

  const loadBrokerStatuses = useCallback(async () => {
    const entries = await Promise.all(BROKERS.map(async (broker) => {
      try {
        const res = await fetch(broker.statusPath, { cache: 'no-store' });
        return [broker.id, res.ok ? await res.json() as BrokerAutoSyncStatus : null] as const;
      } catch {
        return [broker.id, null] as const;
      }
    }));

    const nextStatuses: Partial<Record<KnownBrokerId, BrokerAutoSyncStatus>> = {};
    for (const [broker, status] of entries) {
      if (status) nextStatuses[broker] = status;
    }
    setBrokerStatuses(nextStatuses);
    setZerodhaStatus(nextStatuses.zerodha as ZerodhaStatus | undefined || null);
    setDeltaStatus(nextStatuses.delta as DeltaStatus | undefined || null);
    return nextStatuses;
  }, []);

  const syncZerodha = useCallback(async (silent = false) => {
    if (zerodhaSyncing) return;
    setZerodhaSyncing(true);
    try {
      const res = await fetch('/api/broker/zerodha/sync', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string; needs_reconnect?: boolean };
        if (data.needs_reconnect) {
          await loadZerodhaStatus();
          if (!silent) showToast('Reconnect Zerodha to sync today.', 'info');
          return;
        }
        throw new Error(data.error || await res.text());
      }

      const result = await res.json() as SyncResult;
      await loadTrades();
      await loadZerodhaStatus();
      if (!silent) {
        showToast(`Zerodha synced ${result.imported_orders} orders, matched ${result.total_trades} trades`, 'success');
      }
    } catch (err: unknown) {
      await loadZerodhaStatus();
      if (!silent) showToast('Zerodha sync failed: ' + getErrorMessage(err), 'error');
    } finally {
      setZerodhaSyncing(false);
    }
  }, [loadTrades, loadZerodhaStatus, showToast, zerodhaSyncing]);

  const syncDelta = useCallback(async (silent = false) => {
    if (deltaSyncing) return;
    setDeltaSyncing(true);
    try {
      const res = await fetch('/api/broker/delta/sync', { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json() as { imported_fills: number; total_trades: number };
      await loadTrades();
      await loadDeltaStatus();
      if (!silent) showToast(`Delta synced ${result.imported_fills} fills, matched ${result.total_trades} trades`, 'success');
    } catch (err: unknown) {
      await loadDeltaStatus();
      if (!silent) showToast('Delta sync failed: ' + getErrorMessage(err), 'error');
    } finally {
      setDeltaSyncing(false);
    }
  }, [deltaSyncing, loadDeltaStatus, loadTrades, showToast]);

  const autoSyncBroker = useCallback(async (broker: KnownBrokerId, canSync: (status: BrokerAutoSyncStatus) => boolean) => {
    try {
      const statusResponse = await fetch(`/api/broker/${broker}/status`, { cache: 'no-store' });
      if (!statusResponse.ok) return;
      const status = await statusResponse.json() as BrokerAutoSyncStatus;
      if (!canSync(status)) return;

      const syncResponse = await fetch(`/api/broker/${broker}/sync`, { method: 'POST' });
      if (syncResponse.ok) {
        await loadTrades();
        void loadBrokerStatuses();
      }
    } catch {
      // silent autosync; settings pages show the stored sync error when needed.
    }
  }, [loadBrokerStatuses, loadTrades]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const handleClearData = async () => {
    if (!confirm("Are you sure you want to clear all data? This cannot be undone.")) return;
    try {
      const res = await fetch('/api/clear', { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed");
      setTrades([]);
      setAllTrades([]);
      setStats(null);
      setCsvBroker('');
      window.localStorage.removeItem('tradelore_csv_broker');
      showToast("All data cleared successfully.", "success");
    } catch {
      showToast("Failed to clear data.", "error");
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => loadTrades());
  }, [loadTrades]);

  useEffect(() => {
    void Promise.resolve().then(() => loadCurrentUser());
  }, [loadCurrentUser]);

  useEffect(() => {
    void Promise.resolve().then(() => loadBrokerStatuses());
  }, [loadBrokerStatuses]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setActionsMenuOpen(false);
      }
      if (segmentMenuRef.current && !segmentMenuRef.current.contains(event.target as Node)) {
        setSegmentMenuOpen(false);
      }
      if (brokerMenuRef.current && !brokerMenuRef.current.contains(event.target as Node)) {
        setBrokerMenuOpen(false);
      }
    };
    if (actionsMenuOpen || segmentMenuOpen || brokerMenuOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [actionsMenuOpen, segmentMenuOpen, brokerMenuOpen]);

  useEffect(() => {
    void Promise.resolve().then(async () => {
      const connected = BROKERS
        .filter((broker) => broker.syncPath)
        .filter((broker) => {
          const status = brokerStatuses[broker.id];
          return status?.credentials_configured && status.connected !== false && !status.needs_reconnect;
        })
        .slice(0, 2);

      for (const broker of connected) {
        if (autoSyncedBrokersRef.current.has(broker.id)) continue;
        autoSyncedBrokersRef.current.add(broker.id);
        if (broker.id === 'zerodha') {
          await syncZerodha(true);
        } else if (broker.id === 'delta') {
          const status = brokerStatuses.delta;
          if (status && isDeltaAutoSyncDue(status.last_sync_at || null)) {
            await syncDelta(true);
          }
        } else {
          await autoSyncBroker(broker.id, (status) => status.credentials_configured && status.connected !== false && !status.needs_reconnect);
        }
      }
    });
  }, [autoSyncBroker, brokerStatuses, syncDelta, syncZerodha]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const zerodha = params.get('zerodha');
    if (!zerodha) return;

    params.delete('zerodha');
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', nextUrl);

    queueMicrotask(() => {
      if (zerodha === 'connected') {
        showToast('Zerodha connected. Syncing today’s trades…', 'success');
        void syncZerodha(true);
      } else if (zerodha === 'not_configured') {
        showToast('Zerodha API credentials are not configured on the server.', 'error');
      } else if (zerodha === 'state_error') {
        showToast('Zerodha connection security check failed. Please try again.', 'error');
      } else if (zerodha === 'credentials_required') {
        showToast('Add your Zerodha Personal API key and secret before connecting.', 'info');
      } else if (zerodha === 'user_not_enabled') {
        showToast('This Zerodha account is not enabled for that Kite app. Use the API key and secret from your own Personal app.', 'error');
      } else if (zerodha === 'connect_failed') {
        showToast('Zerodha connection failed. Please try again.', 'error');
      }
    });
  }, [showToast, syncZerodha]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('Uploading…');
    try {
      let broker = csvBroker;
      if (!broker) {
        const answer = window.prompt('Import this CSV for which broker? Type "zerodha" or "delta".', 'zerodha')?.trim().toLowerCase();
        if (answer !== 'zerodha' && answer !== 'delta') {
          setImportStatus('');
          showToast('CSV import cancelled. Choose zerodha or delta.', 'info');
          return;
        }
        broker = answer;
        setCsvBroker(broker);
        window.localStorage.setItem('tradelore_csv_broker', broker);
      }
      const body = new FormData();
      body.append('broker', broker);
      body.append('file', file);
      const res = await fetch('/api/import', { method: 'POST', body });
      if (!res.ok) throw new Error(await res.text());
      const result = await res.json() as ImportResult;
      
      await loadTrades();
      setImportStatus(`${result.imported_orders} orders → ${result.total_trades} trades`);
      showToast(`Imported ${result.imported_orders} orders, matched ${result.total_trades} trades`, 'success');
    } catch (err: unknown) {
      setImportStatus('');
      showToast('Import failed: ' + getErrorMessage(err), 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderBrokerMenuAction = () => {
    if (!Object.values(brokerStatuses).some((status) => status?.server_configured)) {
      return (
        <button className="actions-menu-item" title="Set BROKER_TOKEN_ENCRYPTION_KEY and SUPABASE_SERVICE_ROLE_KEY on the server" disabled>
          Brokers off
        </button>
      );
    }

    return (
      <button
        className="actions-menu-item"
        onClick={() => {
          setActionsMenuOpen(false);
          router.push('/settings/broker');
        }}
      >
        Broker Settings
      </button>
    );
  };

  const selectBroker = (broker: ActiveBrokerFilter) => {
    setSelectedBroker(broker);
    setSegmentFilter(['all']);
    setBrokerMenuOpen(false);
    window.localStorage.setItem('tradelore_dashboard_broker', broker);
  };

  const renderBrokerStatus = () => {
    const broker = BROKER_BY_ID.get(brokerFilter);
    const status = brokerStatuses[brokerFilter];
    if (!broker || !status?.server_configured) return null;
    const label = !status.credentials_configured
      ? 'setup needed'
      : status.needs_reconnect
      ? 'reconnect'
      : status.last_sync_at ? 'synced' : 'connected';
    return <span className={`broker-status ${!status.credentials_configured || status.needs_reconnect || status.connected === false ? 'warn' : 'ok'}`}><span className="broker-status-name">{broker.displayName} </span>{label}</span>;
  };

  const reconnectZerodha = () => {
    window.location.href = '/api/broker/zerodha/login?next=/dashboard';
  };

  // --- RENDER HELPERS ---
  const pf  = stats ? (isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : '∞') : '—';
  const awl = stats ? (isFinite(stats.avgWinLoss) ? stats.avgWinLoss.toFixed(2) : '∞') : '—';
  const displayCurrency = getScopeCurrency(trades);
  const money = (n: number, showSign = true) => fmtMoney(n, displayCurrency, showSign);
  const tradeMoney = (trade: TradeRecord, n: number, showSign = true) => fmtMoney(n, getTradeCurrency(trade), showSign);
  const segmentOptions = SEGMENT_OPTIONS.filter((option) => option.market === (BROKER_BY_ID.get(brokerFilter)?.market || 'india'));
  const segmentLabel = scopedSegmentFilter.includes('all')
    ? 'All segments'
    : segmentOptions.find((option) => option.value === scopedSegmentFilter[0])?.label || 'All segments';
  const showDeltaSyncButton = Boolean(deltaStatus?.server_configured && deltaStatus.credentials_configured);
  const showZerodhaConnectAction = Boolean(
    zerodhaStatus?.server_configured
    && zerodhaStatus.credentials_configured
    && (!zerodhaStatus.connected || zerodhaStatus.needs_reconnect)
  );

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
    const weeks: CalendarDay[][] = [];
    let week: CalendarDay[] = Array(firstDay).fill(null);
    
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
              const tradeCount = stats.dayTrades && key in stats.dayTrades ? stats.dayTrades[key] : null;
              const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
              if (pnl !== null) { weekPnl += pnl; weekDays++; }
              const cls = 'day-cell' + (isToday ? ' today' : '') + (tradeCount ? ' clickable' : '');
              const miniCls = pnl !== null ? (pnl >= 0 ? 'up' : 'down') : '';
              const miniText = pnl !== null ? (pnl >= 0 ? '+' : '') + (Math.abs(pnl) >= 1000 ? (pnl/1000).toFixed(1)+'k' : pnl.toFixed(0)) : '';
              const tradesText = tradeCount !== null ? `${tradeCount} trade${tradeCount !== 1 ? 's' : ''}` : '';

              const dayTrades = trades
                .map((t): TradeWithIndex => ({ ...t, originalIdx: allTrades.findIndex((at) => `${at.symbol}_${at.entry_time || at.entryTime}` === `${t.symbol}_${t.entry_time || t.entryTime}`) }))
                .filter((t) => t.trade_date === key)
                .sort((a, b) => (a.entry_time || '').localeCompare(b.entry_time || ''));
              const firstIdx = dayTrades.length > 0 ? dayTrades[0].originalIdx : null;

              return (
                <td
                  key={j}
                  className={cls}
                  onClick={() => {
                    if (firstIdx !== null && firstIdx >= 0) {
                      router.push(`/trade?idx=${firstIdx}`);
                    }
                  }}
                >
                  <span className="day-num">{d}</span>
                  {miniText && <span className={`mini-pnl ${miniCls}`}>{miniText}</span>}
                  {tradesText && <span className="mini-trades">{tradesText}</span>}
                  {tradeCount && (
                    <span className="day-tooltip">
                      {tradeCount === 1 ? 'View trade' : `${tradeCount} trades`} →
                    </span>
                  )}
                </td>
              );
            });
            return (
              <tr key={i} className="week-row">
                {rowTds}
                <td><span className={`week-pnl ${weekPnl >= 0 ? 'up' : 'down'}`}>{weekDays > 0 ? money(weekPnl) : '—'}</span></td>
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
          const d = t.trade_date || t.date || '';
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
          <div className={`journal-subtab ${journalTab === 'live' ? 'active' : ''}`} onClick={() => setJournalTab('live')}>
            Live Trade Notes
          </div>
        </div>
        <div className="fade-in-up">
          {journalTab === 'premarket' && <JournalPreMarket latestTradeDate={todayStr} />}
          {journalTab === 'posttrade' && <JournalPostTrade trades={latestTrades} date={latestDate} />}
          {journalTab === 'live' && <LiveTradeNotes />}
        </div>
      </div>
    );
  };

  const modalTrade = modalTradeIdx !== null ? trades[modalTradeIdx] : null;

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
        <div className="header-date-range">
          <DateRangePicker
            start={customStart}
            end={customEnd}
            onChange={(s, e) => { setCustomStart(s); setCustomEnd(e); }}
            onClear={() => { setCustomStart(''); setCustomEnd(''); }}
          />
          {availableBrokers.length > 1 && (
            <div className="segment-menu broker-menu" ref={brokerMenuRef}>
              <button
                className="segment-menu-trigger broker-menu-trigger"
                type="button"
                aria-haspopup="menu"
                aria-expanded={brokerMenuOpen}
                onClick={() => setBrokerMenuOpen(open => !open)}
              >
                {BROKER_BY_ID.get(brokerFilter)?.displayName || 'Broker'}
              </button>
              <div className={`segment-menu-list ${brokerMenuOpen ? 'open' : ''}`} role="menu">
                {availableBrokers.map((broker) => (
                  <button
                    key={broker.id}
                    className={`segment-menu-item ${brokerFilter === broker.id ? 'active' : ''}`}
                    type="button"
                    role="menuitem"
                    onClick={() => selectBroker(broker.id)}
                  >
                    {broker.displayName}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="segment-menu" ref={segmentMenuRef}>
            <button
              className="segment-menu-trigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={segmentMenuOpen}
              onClick={() => setSegmentMenuOpen(open => !open)}
            >
              {segmentLabel}
            </button>
            <div className={`segment-menu-list ${segmentMenuOpen ? 'open' : ''}`} role="menu">
              <button
                className={`segment-menu-item ${scopedSegmentFilter.includes('all') ? 'active' : ''}`}
                type="button"
                role="menuitem"
                onClick={() => {
                  setSegmentFilter(['all']);
                  setSegmentMenuOpen(false);
                }}
              >
                All segments
              </button>
              {segmentOptions.map((option) => (
                <button
                  key={option.value}
                  className={`segment-menu-item ${scopedSegmentFilter[0] === option.value ? 'active' : ''}`}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setSegmentFilter([option.value]);
                    setSegmentMenuOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <input type="file" ref={fileInputRef} accept=".csv" style={{display:'none'}} onChange={handleImport} />
        <div className="dashboard-broker-controls">
          {renderBrokerStatus()}
        </div>
        <div className="header-actions-menu" ref={actionsMenuRef}>
          <button
            className="actions-menu-trigger"
            aria-label="Open actions menu"
            aria-expanded={actionsMenuOpen}
            onClick={() => setActionsMenuOpen(open => !open)}
          >
            ⋮
          </button>
          <div className={`actions-menu ${actionsMenuOpen ? 'open' : ''}`}>
            {showDeltaSyncButton && (
              <button
                className="actions-menu-item"
                onClick={() => {
                  setActionsMenuOpen(false);
                  void syncDelta();
                }}
                disabled={deltaSyncing}
              >
                {deltaSyncing ? 'Syncing Delta...' : 'Sync Delta'}
              </button>
            )}
            {showZerodhaConnectAction && (
              <button
                className="actions-menu-item"
                onClick={() => {
                  setActionsMenuOpen(false);
                  reconnectZerodha();
                }}
              >
                Zerodha Connect
              </button>
            )}
            <button
              className="actions-menu-item"
              title="Max upload: latest 6 months of trades."
              onClick={() => {
                setActionsMenuOpen(false);
                fileInputRef.current?.click();
              }}
            >
              Import CSV
              <span className="actions-menu-hint">Max upload: latest 6 months</span>
            </button>
            {renderBrokerMenuAction()}
            <button
              className="actions-menu-item"
              onClick={() => {
                setActionsMenuOpen(false);
                router.push('/settings/billing');
              }}
            >
              Billing
            </button>
            <button
              className="actions-menu-item"
              onClick={() => {
                setActionsMenuOpen(false);
                void handleClearData();
              }}
            >
              Clear
            </button>
            {currentUser ? (
              <button
                className="actions-menu-item"
                onClick={() => {
                  setActionsMenuOpen(false);
                  void handleLogout();
                }}
              >
                Logout
              </button>
            ) : (
              <button
                className="actions-menu-item"
                onClick={() => {
                  setActionsMenuOpen(false);
                  router.push('/login');
                }}
              >
                Login
              </button>
            )}
          </div>
        </div>
      </header>

      <nav className="nav">
        {DASHBOARD_VIEWS.map(v => (
          <div key={v} className={`nav-tab ${view === v ? 'active' : ''}`} onClick={() => selectDashboardView(v)}>
            {v === 'dashboard' ? 'Dashboard' : v === 'journal' ? 'Journal' : v === 'tradelog' ? 'Trade Log' : v === 'playbooks' ? 'Playbooks' : 'Reports'}
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
                <span className={`value ${(stats?.netPnl ?? 0) >= 0 ? 'green' : 'red'}`}>{stats ? money(stats.netPnl) : '—'}</span>
                {stats && stats.funding !== 0 && (
                  <span className="sub">Funding adj {money(stats.fundingAdjustedNetPnl)}</span>
                )}
              </div>
              {stats && (
                <div className="sp-viz">
                  <svg viewBox="0 0 48 32" width="48" height="32">
                    {/* mini sparkline area */}
                    {(() => {
                      const arr = stats.cumulativeArr.slice(-20);
                      if (arr.length < 2) return null;
                      const vals = arr.map((d) => d.pnl);
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
                    {(() => {
                      const total = trades.length;
                      const w = stats.winCount;
                      const l = stats.lossCount;
                      const be = total - w - l;
                      const C = 2 * Math.PI * 18; // ~113.1
                      const wLen = total > 0 ? (w / total) * C : 0;
                      const lLen = total > 0 ? (l / total) * C : 0;
                      const beLen = total > 0 ? (be / total) * C : 0;
                      return (
                        <>
                          <circle cx="24" cy="24" r="18" fill="none" stroke="var(--border)" strokeWidth="4" />
                          <circle cx="24" cy="24" r="18" fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="butt"
                            strokeDasharray={`${wLen} ${C}`} transform="rotate(-90 24 24)" />
                          {lLen > 0 && (
                            <circle cx="24" cy="24" r="18" fill="none" stroke="#dc2626" strokeWidth="4" strokeLinecap="butt"
                              strokeDasharray={`${lLen} ${C}`} strokeDashoffset={`-${wLen}`} transform="rotate(-90 24 24)" />
                          )}
                          {beLen > 0 && (
                            <circle cx="24" cy="24" r="18" fill="none" stroke="#d4d4d4" strokeWidth="4" strokeLinecap="butt"
                              strokeDasharray={`${beLen} ${C}`} strokeDashoffset={`-${wLen + lLen}`} transform="rotate(-90 24 24)" />
                          )}
                        </>
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
                    {(() => {
                      const days = Object.keys(stats.dayPnl);
                      const green = days.filter((d: string) => stats.dayPnl[d] > 0).length;
                      const red = days.filter((d: string) => stats.dayPnl[d] < 0).length;
                      const be = days.length - green - red;
                      const C = 2 * Math.PI * 18; // ~113.1
                      const gLen = days.length > 0 ? (green / days.length) * C : 0;
                      const rLen = days.length > 0 ? (red / days.length) * C : 0;
                      const beLen = days.length > 0 ? (be / days.length) * C : 0;
                      return (
                        <>
                          <circle cx="24" cy="24" r="18" fill="none" stroke="var(--border)" strokeWidth="4" />
                          <circle cx="24" cy="24" r="18" fill="none" stroke="#16a34a" strokeWidth="4" strokeLinecap="butt"
                            strokeDasharray={`${gLen} ${C}`} transform="rotate(-90 24 24)" />
                          {rLen > 0 && (
                            <circle cx="24" cy="24" r="18" fill="none" stroke="#dc2626" strokeWidth="4" strokeLinecap="butt"
                              strokeDasharray={`${rLen} ${C}`} strokeDashoffset={`-${gLen}`} transform="rotate(-90 24 24)" />
                          )}
                          {beLen > 0 && (
                            <circle cx="24" cy="24" r="18" fill="none" stroke="#d4d4d4" strokeWidth="4" strokeLinecap="butt"
                              strokeDasharray={`${beLen} ${C}`} strokeDashoffset={`-${gLen + rLen}`} transform="rotate(-90 24 24)" />
                          )}
                        </>
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
                <div><div className="section-title">Cumulative Net P&amp;L</div></div>
                <span style={{fontSize:'20px',fontWeight:700,color: stats && stats.cumulativeArr.length ? (stats.cumulativeArr[stats.cumulativeArr.length-1].pnl >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--text-secondary)'}}>
                  {stats && stats.cumulativeArr.length ? money(stats.cumulativeArr[stats.cumulativeArr.length-1].pnl) : '—'}
                </span>
              </div>
              <div className="chart-wrap">
                {!stats || !stats.dailyArr.length ? <div className="chart-empty"><div className="chart-empty-icon">📈</div><div className="chart-empty-text">Import trades to see P&amp;L curve</div></div> :
                  <Line ref={cumChartRef} plugins={[splitAreaPlugin]} data={{
                    labels: stats.dailyArr.map((d) => fmtDateChart(d.date)),
                    datasets: [{ data: stats.cumulativeArr.map((d) => d.pnl), borderColor: '#16a34a', backgroundColor: 'transparent', fill: false, borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#16a34a', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, tension: 0.35, segment: { borderColor: (ctx: ScriptableLineSegmentContext) => Number(ctx.p1.parsed.y) >= 0 ? '#16a34a' : '#dc2626' } }]
                  }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { display: false } }, y: { grid: { color: '#f0efec' }, border: { display: false } } } }} />
                }
              </div>
            </div>
            <div className="section fade-in-up">
              <div className="section-header">
                <div><div className="section-title">Daily Net P&amp;L</div></div>
              </div>
              <div className="chart-wrap">
                {!stats || !stats.dailyArr.length ? <div className="chart-empty"><div className="chart-empty-icon">📊</div><div className="chart-empty-text">Import trades to see daily P&amp;L</div></div> :
                  <Bar ref={dailyChartRef} data={{
                    labels: stats.dailyArr.map((d) => fmtDateChart(d.date)),
                    datasets: [{ data: stats.dailyArr.map((d) => d.pnl), backgroundColor: stats.dailyArr.map((v) => v.pnl >= 0 ? '#16a34a' : '#dc2626'), borderRadius: 4 }]
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
              </div>
              <div style={{position:'relative'}}>
                <button className="cal-info-btn" onClick={() => setShowCalInfo(v => !v)} title="Calendar info">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2"/><path d="M8 7v4M8 5.5V5.51" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                </button>
                {showCalInfo && (
                  <div className="cal-info-popup" onClick={() => setShowCalInfo(false)}>
                    <div className="cal-info-inner" onClick={e => e.stopPropagation()}>
                      <div className="cal-info-row"><span className="cal-info-dot" style={{background:'var(--brand)'}}></span> Today</div>
                      <div className="cal-info-row"><span className="cal-info-dot" style={{background:'var(--green)'}}></span> Win day</div>
                      <div className="cal-info-row"><span className="cal-info-dot" style={{background:'var(--red)'}}></span> Loss day</div>
                      <div className="cal-info-row"><span className="cal-info-dot" style={{background:'var(--brand-light)',border:'1px solid var(--border)'}}></span> Trading day</div>
                      <div className="cal-info-row" style={{marginTop:'6px',fontSize:'11px',color:'var(--text-secondary)'}}>P&amp;L = realized only. Weekly totals on the right.</div>
                    </div>
                  </div>
                )}
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
              <button
                className="import-btn"
                title="Max upload: latest 6 months of trades."
                onClick={() => fileInputRef.current?.click()}
              >
                ↑ Import CSV
              </button>
            </div>
          </div>

          {!trades.length ? (
            <div className="empty-state"><div className="empty-icon">📂</div><div className="empty-title">No trades yet</div><div className="empty-sub">Import a CSV file from your broker to get started</div></div>
          ) : (() => {
            // Group trades by month/year
            const grouped: Record<string, TradeRecord[]> = {};
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
              const monthPnl = monthTrades.reduce((s, t) => s + t.pnl - (t.commission || 0), 0);
              const wins = monthTrades.filter((t) => t.pnl - (t.commission || 0) > 0.005).length;
              const losses = monthTrades.filter((t) => t.pnl - (t.commission || 0) < -0.005).length;
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
                      {money(monthPnl)}
                    </span>
                  </div>

                  {isOpen && (
                    <div className="month-body">
                      {(() => {
                        // Group month trades by day
                        const byDay: Record<string, TradeRecord[]> = {};
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
                              const dayPnl = dayTrades.reduce((s, t) => s + t.pnl - (t.commission || 0), 0);
                              const dayWins = dayTrades.filter((t) => t.pnl - (t.commission || 0) > 0.005).length;
                              const dayLosses = dayTrades.filter((t) => t.pnl - (t.commission || 0) < -0.005).length;

                              return (
                                <tbody key={dayDate} className="day-group">
                                  <tr className="day-header-row">
                                    <td colSpan={8}>
                                      <div className="day-header">
                                        <span className="day-date">{fmtDateLabel(dayDate)}</span>
                                        <span className="day-meta">{dayTrades.length} trade{dayTrades.length !== 1 ? 's' : ''} · {dayWins}W / {dayLosses}L</span>
                                        <span className="day-pnl" style={{color: dayPnl >= 0 ? 'var(--green)' : 'var(--red)'}}>
                                          {money(dayPnl)}
                                        </span>
                                      </div>
                                    </td>
                                  </tr>
                                  {dayTrades.sort((a, b) => (b.exit_time || b.exitTime || '').localeCompare(a.exit_time || a.exitTime || '')).map((t, i) => {
                                    const rowKey = `${key}_${dayDate}_${i}`;
                                    const isRowOpen = expandedTradeRow === rowKey;
                                    const journalKey = `${t.symbol}_${t.entry_time || t.entryTime}`;
                                    const journaled = journaledTradeIds.has(journalKey) || Boolean(t.id && journaledTradeIds.has(t.id));
                                    const allIdx = allTrades.findIndex((at) => `${at.symbol}_${at.entry_time || at.entryTime}` === journalKey);
                                    const tradeIdx = allIdx >= 0 ? allIdx : trades.indexOf(t);
                                    const tradeUrl = `/trade?idx=${tradeIdx}`;
                                    return (
                                      <React.Fragment key={i}>
                                        <tr className="clickable" onClick={() => router.push(tradeUrl)}>
                                          <td style={{fontWeight:600}}>{getTradeInstrumentLabel(t)}{t.exchange && <span style={{fontSize:'10px',color:'var(--text-secondary)'}}> {t.exchange}</span>}</td>
                                          <td>{t.direction === 'LONG' ? 'L' : 'S'}</td>
                                          <td>{t.qty}</td>
                                          <td>{fmtPrice(t.avg_entry || t.avgEntry || 0)}</td>
                                          <td>{fmtPrice(t.avg_exit || t.avgExit || 0)}</td>
                                          <td style={{fontWeight:700,color:(t.pnl - (t.commission || 0)) >= 0 ? 'var(--green)' : 'var(--red)'}}>{tradeMoney(t, t.pnl - (t.commission || 0))}</td>
                                          <td>
                                            <span style={{display:'inline-flex', alignItems:'center', gap:'4px'}}>
                                              <span style={{width:'6px', height:'6px', borderRadius:'50%', background: journaled ? '#16a34a' : '#d1d5db', display:'inline-block'}}></span>
                                              <span style={{fontSize:'11px', color:'var(--text-secondary)'}}>{journaled ? 'Yes' : 'No'}</span>
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
                                                  {t.orders?.map((o: TradeOrder, oi) => (
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

        {/* REPORTS */}
        <div className={`view ${view === 'reports' ? 'active' : ''}`} id="view-reports">
          <ReportsPage brokerFilter={brokerFilter} segmentFilter={scopedSegmentFilter} />
        </div>
      </div>

      {/* MODAL */}
      {modalTrade && (() => {
        const t = modalTrade;
        const cleanSymbol = getTradeInstrumentLabel(t).split(' ')[0];
        const tvSymbol = `${t.exchange || 'NSE'}:${cleanSymbol}`;
        
        return (
          <div className="modal-overlay open" onClick={() => setModalTradeIdx(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{getTradeInstrumentLabel(t)} · {fmtDateLabel(t.trade_date || t.date || '')}</h2>
                <button className="modal-close" onClick={() => setModalTradeIdx(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="modal-left">
                  <div className="stat-row"><span className="stat-label">Symbol</span><span className="stat-value">{getTradeInstrumentLabel(t)}{t.exchange ? ' · ' + t.exchange : ''}</span></div>
                  <div className="stat-row"><span className="stat-label">Direction</span><span className="stat-value">{t.direction} · Qty {t.qty}</span></div>
                  <div className="stat-row"><span className="stat-label">Avg Entry</span><span className="stat-value">{fmtPrice(t.avg_entry || t.avgEntry || 0)}</span></div>
                  <div className="stat-row"><span className="stat-label">Avg Exit</span><span className="stat-value">{fmtPrice(t.avg_exit || t.avgExit || 0)}</span></div>
                  <div className="stat-row"><span className="stat-label">Gross P&amp;L</span><span className={`stat-value ${t.pnl >= 0 ? 'up' : 'down'}`}>{tradeMoney(t, t.pnl)}</span></div>
                  <div className="stat-row"><span className="stat-label">Fees/commission</span><span className="stat-value" style={{color:'var(--red)'}}>{tradeMoney(t, -(t.commission || 0))}</span></div>
                  {Number(t.funding || 0) !== 0 && <div className="stat-row"><span className="stat-label">Funding</span><span className={`stat-value ${Number(t.funding || 0) >= 0 ? 'up' : 'down'}`}>{tradeMoney(t, Number(t.funding || 0))}</span></div>}
                  <div className="stat-row"><span className="stat-label">Net P&amp;L</span><span className={`stat-value ${(t.pnl - (t.commission || 0)) >= 0 ? 'up' : 'down'}`}>{tradeMoney(t, t.pnl - (t.commission || 0))}</span></div>
                  {Number(t.funding || 0) !== 0 && <div className="stat-row"><span className="stat-label">Funding adj net</span><span className={`stat-value ${(t.pnl - (t.commission || 0) + Number(t.funding || 0)) >= 0 ? 'up' : 'down'}`}>{tradeMoney(t, t.pnl - (t.commission || 0) + Number(t.funding || 0))}</span></div>}
                  <div className="stat-row"><span className="stat-label">Result</span><span className={`badge ${t.result}`} style={{fontSize:'13px'}}>{t.result.toUpperCase()}</span></div>
                  <div className="stat-row"><span className="stat-label">Entry time</span><span className="stat-value" style={{fontSize:'12px'}}>{(t.entry_time || t.entryTime || '').substring(0, 16)}</span></div>
                  <div className="stat-row"><span className="stat-label">Exit time</span><span className="stat-value" style={{fontSize:'12px'}}>{(t.exit_time || t.exitTime || '').substring(0, 16)}</span></div>
                  <div className="stat-row"><span className="stat-label">Orders</span><span className="stat-value">{t.orders?.length} leg{t.orders?.length !== 1 ? 's' : ''}</span></div>
                </div>
                <div className="modal-right">
                  <div style={{fontSize:'12px',color:'var(--text-secondary)',marginBottom:'8px'}}>TradingView · {tvSymbol}</div>
                  <div className="tradingview-placeholder">
                    <div className="tv-icon">📈</div>
                    <div style={{fontSize:'14px',fontWeight:600}}>{cleanSymbol}</div>
                    <div style={{fontSize:'12px'}}>Avg Entry {fmtPrice(t.avg_entry || t.avgEntry || 0)} → Avg Exit {fmtPrice(t.avg_exit || t.avgExit || 0)}</div>
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

export default function Home() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
