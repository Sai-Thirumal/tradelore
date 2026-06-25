"use client";

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import type { IChartApi, SeriesMarker, UTCTimestamp } from 'lightweight-charts';
import { getErrorMessage } from '@/lib/errors';
import { istToUnix } from '@/lib/engine/symbols';

interface Props {
  symbol: string;
  exchange?: string;
  direction: string;
  avgEntry: number;
  avgExit: number;
  entryTime: string;
  exitTime: string;
  orders?: { type: string; trade_time: string; price: number | string; qty: number | string }[];
}

interface ChartCandle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartResponse {
  error?: string;
  underlying: string;
  interval: string;
  candles?: ChartCandle[];
  referenceOnly?: boolean;
}

export default function TradeChart({ symbol, exchange = '', direction, avgEntry, avgExit, entryTime, exitTime, orders }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ok'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [meta, setMeta] = useState<{ underlying: string; interval: string; referenceOnly: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');
      setErrMsg('');

      try {
        const res = await fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&exchange=${encodeURIComponent(exchange)}&from=${encodeURIComponent(entryTime)}&to=${encodeURIComponent(exitTime)}`);
        const data = await res.json() as ChartResponse;
        if (cancelled) return;

        if (data.error) { setErrMsg(data.error); setStatus('error'); return; }
        if (!data.candles?.length) { setErrMsg('No chart data'); setStatus('error'); return; }

        setMeta({ underlying: data.underlying, interval: data.interval, referenceOnly: Boolean(data.referenceOnly) });

        // Wait for container width
        let width = 0;
        let tries = 0;
        while (width === 0 && tries < 30 && !cancelled) {
          if (containerRef.current) width = containerRef.current.clientWidth;
          if (width === 0) await new Promise(r => setTimeout(r, 100));
          tries++;
        }
        if (cancelled || width === 0) { setErrMsg('Container not ready'); setStatus('error'); return; }

        // Clean up previous
        if (chartRef.current) {
          try { chartRef.current.remove(); } catch {}
          chartRef.current = null;
        }

        const tz = 'Asia/Kolkata';
        let dateShown = false;

        const istTimeFormatter = (time: number) => {
          const d = new Date(time * 1000);

          if (data.interval === '5m') {
            const parts = new Intl.DateTimeFormat('en-IN', {
              timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', hour12: false,
            }).formatToParts(d);
            const get = (t: string) => parts.find(p => p.type === t)?.value || '';

            const h24 = parseInt(get('hour'));
            const h12 = h24 % 12 || 12;
            const mins = get('minute');
            const ampm = h24 >= 12 ? 'p.m.' : 'a.m.';

            if (!dateShown) {
              dateShown = true;
              const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
              return `${parseInt(get('day'))} ${months[parseInt(get('month')) - 1]}`;
            }
            return `${h12}:${mins} ${ampm}`;
          }

          // Daily: each tick is a different day — show date, year only if not current year
          const istYear = parseInt(d.toLocaleString('en-IN', { timeZone: tz, year: 'numeric' }));
          const nowIstYear = parseInt(new Date().toLocaleString('en-IN', { timeZone: tz, year: 'numeric' }));
          const opts: Intl.DateTimeFormatOptions = { timeZone: tz, day: 'numeric', month: 'short' };
          if (istYear !== nowIstYear) opts.year = 'numeric';
          return d.toLocaleString('en-IN', opts);
        };

        const chart = createChart(containerRef.current!, {
          width,
          height: 520,
          layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#737373' },
          grid: { vertLines: { color: '#f5f5f5' }, horzLines: { color: '#f5f5f5' } },
          crosshair: { mode: 0 },
          rightPriceScale: { borderColor: '#e5e5e5' },
          timeScale: { borderColor: '#e5e5e5', timeVisible: false, tickMarkFormatter: istTimeFormatter },
        });
        chartRef.current = chart;

        const series = chart.addSeries(CandlestickSeries, {
          upColor: '#16a34a', downColor: '#dc2626',
          borderUpColor: '#16a34a', borderDownColor: '#dc2626',
          wickUpColor: '#16a34a', wickDownColor: '#dc2626',
        });
        series.setData(data.candles);

        const entryUnix = istToUnix(entryTime);
        const exitUnix = istToUnix(exitTime);
        const isLong = direction === 'LONG';

        const markers: SeriesMarker<UTCTimestamp>[] = [];

        if (orders && orders.length > 0) {
          // Dedupe: collapse legs that fall into the same candle bucket
          // Bucket key = candle boundary + price + type — avoids multiple
          // markers inside the same candle where they can't be distinguished.
          // Marker time stays at the exact fill time; only the dedup key buckets.
          const bucket = (timeStr: string) => {
            const d = new Date(timeStr.replace(' ', 'T') + '+05:30');
            if (data.interval === '1d') return timeStr.substring(0, 10); // "2026-05-25"
            // 5m: round down to nearest 5-min boundary
            const m = d.getUTCMinutes();
            d.setUTCMinutes(Math.floor(m / 5) * 5, 0, 0);
            const pad = (n: number) => String(n).padStart(2, '0');
            return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
          };

          const seen = new Map<string, NonNullable<Props['orders']>[number]>();
          for (const o of orders) {
            const key = `${bucket(o.trade_time)}|${Number(o.price).toFixed(2)}|${o.type}`;
            if (!seen.has(key)) seen.set(key, o);
          }

          for (const o of seen.values()) {
            const orderUnix = istToUnix(o.trade_time);
            if (orderUnix <= 0) continue;

            const isEntry = (isLong && o.type === 'BUY') || (!isLong && o.type === 'SELL');

            if (isEntry) {
              markers.push({
                time: orderUnix as UTCTimestamp,
                position: isLong ? 'belowBar' : 'aboveBar',
                color: '#1a1a1a',
                shape: isLong ? 'arrowUp' : 'arrowDown',
                text: `ENTRY ₹${Number(o.price).toFixed(2)}`,
                size: 2,
              });
            } else {
              markers.push({
                time: orderUnix as UTCTimestamp,
                position: isLong ? 'aboveBar' : 'belowBar',
                color: '#1a1a1a',
                shape: isLong ? 'arrowDown' : 'arrowUp',
                text: `EXIT ₹${Number(o.price).toFixed(2)}`,
                size: 2,
              });
            }
          }
        } else {
          // Fallback: single markers from aggregated times/prices
          if (entryUnix > 0) markers.push({ time: entryUnix as UTCTimestamp, position: isLong ? 'belowBar' : 'aboveBar', color: '#1a1a1a', shape: isLong ? 'arrowUp' : 'arrowDown', text: `ENTRY ₹${avgEntry.toFixed(2)}`, size: 2 });
          if (exitUnix > 0) markers.push({ time: exitUnix as UTCTimestamp, position: isLong ? 'aboveBar' : 'belowBar', color: '#1a1a1a', shape: isLong ? 'arrowDown' : 'arrowUp', text: `EXIT ₹${avgExit.toFixed(2)}`, size: 2 });
        }

        createSeriesMarkers(series, markers);

        chart.timeScale().fitContent();
        if (!cancelled) setStatus('ok');

      } catch (e: unknown) {
        if (!cancelled) { setErrMsg(getErrorMessage(e, String(e))); setStatus('error'); }
      }
    }

    load();

    const onResize = () => {
      if (chartRef.current && containerRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      if (chartRef.current) { try { chartRef.current.remove(); } catch {} }
    };
  }, [symbol, exchange, direction, avgEntry, avgExit, entryTime, exitTime, orders]);

  return (
    <>
      <h3 style={{marginBottom:'10px'}}>
        Chart · {meta?.underlying || symbol}
        <span style={{fontSize:'11px',color:'var(--text-secondary)',fontWeight:400,marginLeft:'8px'}}>
          {meta?.interval === '5m' ? '5-min' : 'Daily'}
          {meta?.referenceOnly ? ' · global reference' : ''}
        </span>
      </h3>
      <div style={{position:'relative',width:'100%',height:'520px'}}>
        <div ref={containerRef} style={{width:'100%',height:'100%'}} />
        {status === 'loading' && (
          <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg)'}}>
            <span style={{color:'var(--text-secondary)',fontSize:'14px'}}>Loading chart…</span>
          </div>
        )}
        {status === 'error' && (
          <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'8px',background:'var(--bg)'}}>
            <span style={{fontSize:'40px',opacity:0.3}}>📈</span>
            <p style={{color:'var(--text-secondary)',fontSize:'13px'}}>{errMsg}</p>
            <a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(exchange ? `${exchange}:${symbol}` : (meta?.underlying || symbol))}`} target="_blank" rel="noreferrer"
               style={{padding:'8px 16px',background:'var(--brand)',color:'white',borderRadius:'6px',textDecoration:'none',fontSize:'12px',fontWeight:600}}>
              Open in TradingView ↗
            </a>
          </div>
        )}
      </div>
    </>
  );
}
