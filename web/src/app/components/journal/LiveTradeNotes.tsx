"use client";

import { useEffect, useState } from 'react';
import { fmtPrice } from '@/lib/ui/format';
import type { TradeRecord } from '@/lib/types/trading';

function getTradeId(t: TradeRecord): string {
  return `${t.symbol}_${t.entry_time || t.entryTime}`;
}

export default function LiveTradeNotes() {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState('');
  const [savedId, setSavedId] = useState('');

  useEffect(() => {
    fetch('/api/live-trades')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        setTrades(data);
        for (const trade of data) {
          const tid = getTradeId(trade);
          fetch(`/api/trade-journal?trade_id=${encodeURIComponent(tid)}`)
            .then(r => r.json())
            .then(j => {
              if (j?.important_notes !== undefined) {
                setNotes(p => ({ ...p, [tid]: j.important_notes || '' }));
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const save = async (trade: TradeRecord) => {
    const tid = getTradeId(trade);
    setSavingId(tid);
    try {
      const res = await fetch('/api/trade-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade_id: tid, important_notes: notes[tid] || '' }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSavedId(tid);
      setTimeout(() => setSavedId(''), 2000);
    } catch {
    } finally {
      setSavingId('');
    }
  };

  return (
    <div className="premarket-card">
      <div className="premarket-header">
        <div>
          <div className="premarket-label">Live Trade Notes</div>
          <div className="premarket-date">{trades.length ? `${trades.length} open trade${trades.length !== 1 ? 's' : ''}` : 'No open trades'}</div>
        </div>
      </div>

      <div className="premarket-body">
        {trades.map((trade) => {
          const tid = getTradeId(trade);
          return (
            <div className="posttrade-form" key={tid}>
              <div className="posttrade-header">
                <div>
                  <div className="posttrade-symbol">{trade.symbol}</div>
                  <div className="posttrade-meta">
                    {trade.exchange} · {trade.direction} · Qty {trade.qty} · Entry {fmtPrice(trade.avg_entry)}
                  </div>
                </div>
                <button
                  className={`posttrade-save-btn ${savedId === tid ? 'saved' : ''}`}
                  onClick={() => save(trade)}
                  disabled={savingId === tid}
                >
                  {savedId === tid ? 'Saved' : savingId === tid ? 'Saving...' : 'Save'}
                </button>
              </div>

              <div className="posttrade-field">
                <label>Live Notes</label>
                <textarea
                  placeholder="Notes while this trade is open"
                  rows={4}
                  value={notes[tid] || ''}
                  onChange={e => setNotes(p => ({ ...p, [tid]: e.target.value }))}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
