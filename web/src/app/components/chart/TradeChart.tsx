"use client";

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import { istToUnix } from '@/lib/engine/symbols';

interface Props {
  symbol: string;
  direction: string;
  avgEntry: number;
  avgExit: number;
  entryTime: string;
  exitTime: string;
}

export default function TradeChart({ symbol, direction, avgEntry, avgExit, entryTime, exitTime }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'ok'>('loading');
  const [errMsg, setErrMsg] = useState('');
  const [meta, setMeta] = useState<{ underlying: string; interval: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');
      setErrMsg('');

      try {
        const res = await fetch(`/api/chart?symbol=${encodeURIComponent(symbol)}&from=${encodeURIComponent(entryTime)}&to=${encodeURIComponent(exitTime)}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.error) { setErrMsg(data.error); setStatus('error'); return; }
        if (!data.candles?.length) { setErrMsg('No chart data'); setStatus('error'); return; }

        setMeta({ underlying: data.underlying, interval: data.interval });

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

        const chart = createChart(containerRef.current!, {
          width,
          height: 400,
          layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#737373' },
          grid: { vertLines: { color: '#f5f5f5' }, horzLines: { color: '#f5f5f5' } },
          crosshair: { mode: 0 },
          rightPriceScale: { borderColor: '#e5e5e5' },
          timeScale: { borderColor: '#e5e5e5', timeVisible: data.interval === '5m' },
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

        const markers: any[] = [];
        if (entryUnix > 0) markers.push({ time: entryUnix, position: isLong ? 'belowBar' : 'aboveBar', color: isLong ? '#16a34a' : '#dc2626', shape: isLong ? 'arrowUp' : 'arrowDown', text: `ENTRY ₹${avgEntry.toFixed(2)}`, size: 2 });
        if (exitUnix > 0) markers.push({ time: exitUnix, position: isLong ? 'aboveBar' : 'belowBar', color: isLong ? '#16a34a' : '#dc2626', shape: isLong ? 'arrowDown' : 'arrowUp', text: `EXIT ₹${avgExit.toFixed(2)}`, size: 2 });

        createSeriesMarkers(series, markers);

        series.createPriceLine({ price: avgEntry, color: isLong ? '#16a34a' : '#dc2626', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'ENTRY' });
        series.createPriceLine({ price: avgExit, color: isLong ? '#16a34a' : '#dc2626', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: 'EXIT' });

        chart.timeScale().fitContent();
        if (!cancelled) setStatus('ok');

      } catch (e: any) {
        if (!cancelled) { setErrMsg(e.message || String(e)); setStatus('error'); }
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
  }, [symbol, entryTime, exitTime]);

  return (
    <>
      <h3 style={{marginBottom:'10px'}}>
        Chart · {meta?.underlying || symbol}
        <span style={{fontSize:'11px',color:'var(--text-secondary)',fontWeight:400,marginLeft:'8px'}}>
          {meta?.interval === '5m' ? '5-min' : 'Daily'}
        </span>
      </h3>
      <div style={{position:'relative',width:'100%',height:'400px'}}>
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
            <a href={`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(meta?.underlying || symbol)}`} target="_blank" rel="noreferrer"
               style={{padding:'8px 16px',background:'var(--brand)',color:'white',borderRadius:'6px',textDecoration:'none',fontSize:'12px',fontWeight:600}}>
              Open in TradingView ↗
            </a>
          </div>
        )}
      </div>
    </>
  );
}
