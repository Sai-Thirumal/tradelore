"use client";

import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { fmtINR, fmtPrice, fmtDateLabel, fmtDateShort } from '@/lib/ui/format';

const TradeChart = dynamic(() => import('../components/chart/TradeChart'), { ssr: false, loading: () => (
  <div className="trade-detail-section chart-placeholder">
    <h3>Chart</h3>
    <div className="chart-coming"><span style={{fontSize:'20px'}}>Loading chart…</span></div>
  </div>
)});

interface Trade {
  symbol: string;
  direction: string;
  qty: number;
  avg_entry: number;
  avg_exit: number;
  pnl: number;
  commission?: number;
  result: string;
  entry_time: string;
  exit_time: string;
  trade_date: string;
  exchange?: string;
  segment?: string;
  expiry_date?: string;
  orders?: any[];
  id?: string;
}

const EMOTIONS = [
  'Confident', 'Anxious', 'Frustrated', 'Calm',
  'Excited', 'Disciplined', 'Overtrading', 'Revenge Trading',
];

function getTradeId(t: Trade): string {
  return t.id || `${t.symbol}_${t.entry_time}`;
}

export default function TradeDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const idxStr = searchParams.get('idx');
  const idx = idxStr ? parseInt(idxStr) : null;

  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  // Journal state
  const [riskAmount, setRiskAmount] = useState('');
  const [profitTargetEntry, setProfitTargetEntry] = useState('');
  const [profitTargetExit, setProfitTargetExit] = useState('');
  const [positionSizing, setPositionSizing] = useState('');
  const [playbookId, setPlaybookId] = useState('');
  const [whatWorked, setWhatWorked] = useState('');
  const [whatDidnt, setWhatDidnt] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [emotions, setEmotions] = useState<string[]>([]);
  const [importantNotes, setImportantNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [playbooks, setPlaybooks] = useState<any[]>([]);

  // Tab state: 'trade' | 'premarket' | 'postmarket'
  const [activeTab, setActiveTab] = useState<'trade' | 'premarket' | 'postmarket'>('trade');

  // Pre-market plan state (view-only, fetched from daily_journal)
  const [preMarket, setPreMarket] = useState<any>(null);
  const [preMarketLoading, setPreMarketLoading] = useState(false);

  // Fetch trade data
  useEffect(() => {
    if (idx === null || isNaN(idx)) {
      setError('No trade specified');
      setLoading(false);
      return;
    }

    fetch('/api/trades')
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data) || idx >= data.length || idx < 0) {
          setError('Trade not found');
        } else {
          setAllTrades(data);
          setTrade(data[idx]);
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [idx]);

  // Close switcher on click outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false);
      }
    }
    if (switcherOpen) {
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }
  }, [switcherOpen]);

  const sameDayTrades = trade && allTrades.length > 0
    ? allTrades.map((t, i) => ({ ...t, originalIdx: i })).filter(t => t.trade_date === trade.trade_date)
    : [];

  // Fetch playbooks
  useEffect(() => {
    fetch('/api/playbooks')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPlaybooks(data); })
      .catch(() => {});
  }, []);

  // Fetch pre-market plan for this trade's date
  useEffect(() => {
    if (!trade?.trade_date) return;
    setPreMarketLoading(true);
    fetch(`/api/daily-journal?date=${trade.trade_date}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.date) setPreMarket(data);
      })
      .catch(() => {})
      .finally(() => setPreMarketLoading(false));
  }, [trade?.trade_date]);

  // Load journal from localStorage + API
  useEffect(() => {
    if (!trade) return;
    const tid = getTradeId(trade);

    // localStorage first
    const cached = localStorage.getItem(`trade_journal_${tid}`);
    if (cached) {
      try {
        const j = JSON.parse(cached);
        setRiskAmount(j.riskAmount || '');
        setProfitTargetEntry(j.profitTargetEntry || '');
        setProfitTargetExit(j.profitTargetExit || '');
        setPositionSizing(j.positionSizing || '');
        setPlaybookId(j.playbookId || '');
        setWhatWorked(j.whatWorked || '');
        setWhatDidnt(j.whatDidnt || '');
        setLessonsLearned(j.lessonsLearned || '');
        setEmotions(j.emotions || []);
        setImportantNotes(j.importantNotes || '');
      } catch {}
    }

    // Then API
    fetch(`/api/trade-journal?trade_id=${encodeURIComponent(tid)}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.trade_id) {
          setRiskAmount(data.risk_amount?.toString() || '');
          setProfitTargetEntry(data.profit_target_entry?.toString() || '');
          setProfitTargetExit(data.profit_target_exit?.toString() || '');
          setPositionSizing(data.position_sizing || '');
          setPlaybookId(data.playbook_id || '');
          setWhatWorked(data.what_worked || '');
          setWhatDidnt(data.what_didnt || '');
          setLessonsLearned(data.lessons_learned || '');
          setEmotions(data.emotions ? data.emotions.split(',').filter(Boolean) : []);
          setImportantNotes(data.important_notes || '');
        }
      })
      .catch(() => {});
  }, [trade]);

  // Auto-save to localStorage
  useEffect(() => {
    if (!trade) return;
    const tid = getTradeId(trade);
    localStorage.setItem(`trade_journal_${tid}`, JSON.stringify({
      riskAmount, profitTargetEntry, profitTargetExit,
      positionSizing, playbookId, whatWorked, whatDidnt,
      lessonsLearned, emotions, importantNotes,
    }));
  }, [trade, riskAmount, profitTargetEntry, profitTargetExit, positionSizing, playbookId, whatWorked, whatDidnt, lessonsLearned, emotions, importantNotes]);

  const toggleEmotion = (em: string) => {
    setEmotions(p => p.includes(em) ? p.filter(e => e !== em) : [...p, em]);
  };

  const handleSave = async () => {
    if (!trade) return;
    setSaving(true);
    try {
      await fetch('/api/trade-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_id: getTradeId(trade),
          risk_amount: riskAmount ? Number(riskAmount) : null,
          profit_target_entry: profitTargetEntry ? Number(profitTargetEntry) : null,
          profit_target_exit: profitTargetExit ? Number(profitTargetExit) : null,
          position_sizing: positionSizing,
          playbook_id: playbookId,
          what_worked: whatWorked,
          what_didnt: whatDidnt,
          lessons_learned: lessonsLearned,
          emotions: emotions.join(','),
          important_notes: importantNotes,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="trade-detail-loading">Loading…</div>;
  if (error || !trade) return <div className="trade-detail-error">{error || 'Trade not found'}</div>;

  return (
    <div className="trade-detail-page">
      {/* Header — compact single row */}
      <div className="td-topbar">
        <a href="/" className="td-back">← TradeLore</a>

        {/* Same-day trade switcher */}
        <div className="popup-wrap td-trade-switcher" ref={switcherRef}>
          <button
            className="popup-trigger td-symbol-trigger"
            onClick={() => setSwitcherOpen(o => !o)}
            disabled={sameDayTrades.length <= 1}
          >
            <span className="td-header-symbol">{trade.symbol}</span>
            {sameDayTrades.length > 1 && (
              <span className="arrow">▼</span>
            )}
          </button>
          {sameDayTrades.length > 1 && (
            <div className={`popup-menu td-switcher-menu ${switcherOpen ? 'open' : ''}`}>
              {sameDayTrades.map((t) => (
                <div
                  key={t.originalIdx}
                  className={`item td-switcher-item ${t.originalIdx === idx ? 'active' : ''}`}
                  onClick={() => {
                    setSwitcherOpen(false);
                    router.push(`/trade?idx=${t.originalIdx}`);
                  }}
                >
                  <span className="td-swi-symbol">{t.symbol}</span>
                  <span className="td-swi-time">{t.entry_time?.substring(11, 16)}</span>
                  <span
                    className="td-swi-pnl"
                    style={{ color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}
                  >
                    {fmtINR(t.pnl)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="td-badge-wrap">
          <span className="td-pnl" style={{color: trade.pnl >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmtINR(trade.pnl)}</span>
          <span className={`badge ${trade.result}`}>{trade.result.toUpperCase()}</span>
        </div>
      </div>

      {/* Tab switcher — same design as journal-subtabs */}
      <div className="journal-subtabs">
        <div className={`journal-subtab ${activeTab === 'trade' ? 'active' : ''}`} onClick={() => setActiveTab('trade')}>
          View Trade
        </div>
        <div className={`journal-subtab ${activeTab === 'premarket' ? 'active' : ''}`} onClick={() => setActiveTab('premarket')}>
          Pre Market
        </div>
        <div className={`journal-subtab ${activeTab === 'postmarket' ? 'active' : ''}`} onClick={() => setActiveTab('postmarket')}>
          Post Market
        </div>
      </div>

      {/* Tab: View Trade — Stats + Chart */}
      {activeTab === 'trade' && (
      <div className="td-section-1">
        {/* Stats panel */}
        <div className="td-stats">
          <div className="td-metrics">
            <div className="td-metric">
              <span className="td-metric-val">{trade.direction}</span>
              <span className="td-metric-lbl">Direction</span>
            </div>
            <div className="td-metric">
              <span className="td-metric-val">{trade.qty}</span>
              <span className="td-metric-lbl">Quantity</span>
            </div>
            <div className="td-metric">
              <span className="td-metric-val">₹{fmtPrice(trade.avg_entry)}</span>
              <span className="td-metric-lbl">Entry</span>
            </div>
            <div className="td-metric">
              <span className="td-metric-val">₹{fmtPrice(trade.avg_exit)}</span>
              <span className="td-metric-lbl">Exit</span>
            </div>
          </div>

          <div className="td-details">
            <div className="td-detail"><span>Entry Time</span><span>{trade.entry_time?.substring(0, 16)}</span></div>
            <div className="td-detail"><span>Exit Time</span><span>{trade.exit_time?.substring(0, 16)}</span></div>
            <div className="td-detail"><span>Segment</span><span>{trade.segment || '—'}</span></div>
            <div className="td-detail"><span>Exchange</span><span>{trade.exchange || '—'}</span></div>
            <div className="td-detail"><span>P&L</span><span style={{color: trade.pnl >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmtINR(trade.pnl)}</span></div>
            <div className="td-detail"><span>Commission</span><span style={{color: 'var(--red)'}}>{fmtINR(trade.commission || 0)}</span></div>
            <div className="td-detail"><span>Net P&L</span><span style={{color: (trade.pnl - (trade.commission || 0)) >= 0 ? 'var(--green)' : 'var(--red)'}}>{fmtINR(trade.pnl - (trade.commission || 0))}</span></div>
          </div>

          {trade.orders && trade.orders.length > 0 && (
            <div className="td-orders">
              <div className="td-orders-title">Order Legs</div>
              <table className="td-orders-table">
                <thead><tr><th>Time</th><th>Type</th><th>Qty</th><th>Price</th></tr></thead>
                <tbody>
                  {trade.orders.map((o: any, oi: number) => (
                    <tr key={oi}>
                      <td>{o.trade_time?.substring(11, 16)}</td>
                      <td><span className={`badge-${o.type?.toLowerCase()}`}>{o.type}</span></td>
                      <td>{o.qty}</td>
                      <td>{fmtPrice(o.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Chart panel */}
        <div className="td-chart">
          <TradeChart
            symbol={trade.symbol}
            direction={trade.direction}
            avgEntry={trade.avg_entry}
            avgExit={trade.avg_exit}
            entryTime={trade.entry_time}
            exitTime={trade.exit_time}
            orders={trade.orders}
          />
        </div>
      </div>
      )}

      {/* Tab: Pre Market — day-level plan, read-only */}
      {activeTab === 'premarket' && (
      <div className="td-section-2">
        <div className="td-journal-head">
          <h2>Pre-Market Plan</h2>
          <span className="td-date">{fmtDateLabel(trade.trade_date)}</span>
        </div>

        {preMarketLoading ? (
          <p style={{color:'var(--text-secondary)',fontSize:'13px',padding:'16px 0'}}>Loading…</p>
        ) : (
          <>
            <div className="td-field">
              <label>What are you looking for in today&rsquo;s market?</label>
              <p className="td-readonly">{preMarket?.market_outlook || 'Not filled'}</p>
            </div>

            <div className="td-field">
              <label>Market bias</label>
              <p className="td-readonly">{preMarket?.outlook_bias || 'Not filled'}</p>
            </div>

            <div className="td-journal-grid">
              <div className="td-field">
                <label>Capital to deploy</label>
                <p className="td-readonly">{preMarket?.capital_to_deploy ? `₹${Number(preMarket.capital_to_deploy).toLocaleString('en-IN')}` : 'Not filled'}</p>
              </div>
              <div className="td-field">
                <label>Key levels</label>
                <p className="td-readonly" style={{whiteSpace:'pre-wrap'}}>{preMarket?.key_levels || 'Not filled'}</p>
              </div>
            </div>

            <div className="td-field">
              <label>News / events to be aware of</label>
              <p className="td-readonly" style={{whiteSpace:'pre-wrap'}}>{preMarket?.news_events || 'Not filled'}</p>
            </div>
          </>
        )}
      </div>
      )}

      {/* Tab: Post Market — trade journal form */}
      {activeTab === 'postmarket' && (
      <div className="td-section-2">
        <div className="td-journal-head">
          <h2>Trade Journal</h2>
          <button className={`td-save-btn ${saved ? 'saved' : ''}`} onClick={handleSave} disabled={saving}>
            {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Journal'}
          </button>
        </div>

        <div className="td-journal-grid">
          <div className="td-field">
            <label>Risk (₹)</label>
            <input type="number" placeholder="Amount risked" value={riskAmount} onChange={e => setRiskAmount(e.target.value)} />
          </div>
          <div className="td-field">
            <label>Entry target</label>
            <input type="number" placeholder={fmtPrice(trade.avg_entry)} value={profitTargetEntry} onChange={e => setProfitTargetEntry(e.target.value)} />
          </div>
          <div className="td-field">
            <label>Exit target</label>
            <input type="number" placeholder="Target exit" value={profitTargetExit} onChange={e => setProfitTargetExit(e.target.value)} />
          </div>
          <div className="td-field">
            <label>Position sizing</label>
            <input type="text" placeholder="e.g. 2% of capital" value={positionSizing} onChange={e => setPositionSizing(e.target.value)} />
          </div>
        </div>

        <div className="td-field">
          <label>Playbook</label>
          <select value={playbookId} onChange={e => setPlaybookId(e.target.value)}>
            <option value="">— Select —</option>
            {playbooks.map((pb: any) => (<option key={pb.id} value={pb.id}>{pb.name}</option>))}
          </select>
        </div>

        <div className="td-journal-grid td-journal-grid-3">
          <div className="td-field">
            <label>What worked</label>
            <textarea placeholder="What went well?" value={whatWorked} onChange={e => setWhatWorked(e.target.value)} rows={2} />
          </div>
          <div className="td-field">
            <label>What didn&rsquo;t work</label>
            <textarea placeholder="What could be better?" value={whatDidnt} onChange={e => setWhatDidnt(e.target.value)} rows={2} />
          </div>
          <div className="td-field">
            <label>Lessons learned</label>
            <textarea placeholder="Key takeaways" value={lessonsLearned} onChange={e => setLessonsLearned(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="td-field">
          <label>Emotions</label>
          <div className="td-emotions">
            {EMOTIONS.map(em => {
              const selected = emotions.includes(em);
              return (
                <button key={em} className={`td-emotion ${selected ? 'active' : ''}`} onClick={() => toggleEmotion(em)}>
                  {selected && '✓ '}{em}
                </button>
              );
            })}
          </div>
        </div>

        <div className="td-field">
          <label>Important notes</label>
          <textarea placeholder="Anything else worth remembering" value={importantNotes} onChange={e => setImportantNotes(e.target.value)} rows={2} />
        </div>

        <p className="td-autosave">Auto-saved locally · Syncs with Journal tab</p>
      </div>
      )}
    </div>
  );
}
