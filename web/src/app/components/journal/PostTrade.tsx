"use client";

import { useState, useEffect, useCallback } from 'react';
import { fmtINR, fmtPrice } from '@/lib/ui/format';

const EMOTIONS = [
  'Confident', 'Anxious', 'Frustrated', 'Calm',
  'Excited', 'Disciplined', 'Overtrading', 'Revenge Trading',
];

interface Playbook {
  id: string;
  name: string;
}

interface Trade {
  symbol: string;
  direction: string;
  qty: number;
  avg_entry?: number;
  avgExit?: number;
  avg_exit?: number;
  avgEntry?: number;
  pnl: number;
  result: string;
  entry_time?: string;
  exit_time?: string;
  entryTime?: string;
  exitTime?: string;
  trade_date?: string;
  date?: string;
  id?: string;
  orders?: any[];
}

// ── Helpers (module-level) ──
function getTradeId(t: Trade): string {
  return t.id || `${t.symbol}_${t.entry_time || t.entryTime}`;
}

function lsKey(tradeId: string): string {
  return `trade_journal_${tradeId}`;
}

export default function JournalPostTrade({ trades }: { trades: Trade[] }) {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // Per-trade state — keyed by tradeId
  const [riskAmounts, setRiskAmounts] = useState<Record<string, string>>({});
  const [profitTargetEntries, setProfitTargetEntries] = useState<Record<string, string>>({});
  const [profitTargetExits, setProfitTargetExits] = useState<Record<string, string>>({});
  const [positionSizings, setPositionSizings] = useState<Record<string, string>>({});
  const [playbookIds, setPlaybookIds] = useState<Record<string, string>>({});
  const [whatWorked, setWhatWorked] = useState<Record<string, string>>({});
  const [whatDidnt, setWhatDidnt] = useState<Record<string, string>>({});
  const [lessonsLearned, setLessonsLearned] = useState<Record<string, string>>({});
  const [emotions, setEmotions] = useState<Record<string, string[]>>({});
  const [importantNotes, setImportantNotes] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Load playbooks
  useEffect(() => {
    fetch('/api/playbooks')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setPlaybooks(data); })
      .catch(() => {});
  }, []);

  // Load journal data for all trades (localStorage + API)
  useEffect(() => {
    for (const t of trades) {
      const tid = getTradeId(t);
      // localStorage first
      const cached = localStorage.getItem(lsKey(tid));
      if (cached) {
        try {
          const j = JSON.parse(cached);
          applyJournal(tid, j);
        } catch {}
      }
      // API
      fetch(`/api/trade-journal?trade_id=${encodeURIComponent(tid)}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.trade_id) applyJournal(tid, {
            riskAmount: data.risk_amount?.toString() || '',
            profitTargetEntry: data.profit_target_entry?.toString() || '',
            profitTargetExit: data.profit_target_exit?.toString() || '',
            positionSizing: data.position_sizing || '',
            playbookId: data.playbook_id || '',
            whatWorked: data.what_worked || '',
            whatDidnt: data.what_didnt || '',
            lessonsLearned: data.lessons_learned || '',
            emotions: data.emotions ? data.emotions.split(',').filter(Boolean) : [],
            importantNotes: data.important_notes || '',
          });
        })
        .catch(() => {});
    }
  }, [trades]);

  const applyJournal = (tid: string, j: any) => {
    if (j.riskAmount !== undefined) setRiskAmounts(p => ({ ...p, [tid]: j.riskAmount }));
    if (j.profitTargetEntry !== undefined) setProfitTargetEntries(p => ({ ...p, [tid]: j.profitTargetEntry }));
    if (j.profitTargetExit !== undefined) setProfitTargetExits(p => ({ ...p, [tid]: j.profitTargetExit }));
    if (j.positionSizing !== undefined) setPositionSizings(p => ({ ...p, [tid]: j.positionSizing }));
    if (j.playbookId !== undefined) setPlaybookIds(p => ({ ...p, [tid]: j.playbookId }));
    if (j.whatWorked !== undefined) setWhatWorked(p => ({ ...p, [tid]: j.whatWorked }));
    if (j.whatDidnt !== undefined) setWhatDidnt(p => ({ ...p, [tid]: j.whatDidnt }));
    if (j.lessonsLearned !== undefined) setLessonsLearned(p => ({ ...p, [tid]: j.lessonsLearned }));
    if (j.emotions !== undefined) setEmotions(p => ({ ...p, [tid]: j.emotions }));
    if (j.importantNotes !== undefined) setImportantNotes(p => ({ ...p, [tid]: j.importantNotes }));
  };

  // Auto-save to localStorage on any field change
  const persistLocal = useCallback((tid: string) => {
    localStorage.setItem(lsKey(tid), JSON.stringify({
      riskAmount: riskAmounts[tid] || '',
      profitTargetEntry: profitTargetEntries[tid] || '',
      profitTargetExit: profitTargetExits[tid] || '',
      positionSizing: positionSizings[tid] || '',
      playbookId: playbookIds[tid] || '',
      whatWorked: whatWorked[tid] || '',
      whatDidnt: whatDidnt[tid] || '',
      lessonsLearned: lessonsLearned[tid] || '',
      emotions: emotions[tid] || [],
      importantNotes: importantNotes[tid] || '',
    }));
  }, [riskAmounts, profitTargetEntries, profitTargetExits, positionSizings,
      playbookIds, whatWorked, whatDidnt, lessonsLearned, emotions, importantNotes]);

  const persistAll = useCallback(() => {
    for (const t of trades) persistLocal(getTradeId(t));
  }, [trades, persistLocal]);

  useEffect(() => { persistAll(); }, [persistAll]);

  const toggleEmotion = (tid: string, emotion: string) => {
    setEmotions(p => {
      const current = p[tid] || [];
      const next = current.includes(emotion)
        ? current.filter(e => e !== emotion)
        : [...current, emotion];
      return { ...p, [tid]: next };
    });
  };

  const handleSave = async (tid: string) => {
    setSavingIds(p => new Set(p).add(tid));
    try {
      await fetch('/api/trade-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_id: tid,
          risk_amount: riskAmounts[tid] ? Number(riskAmounts[tid]) : null,
          profit_target_entry: profitTargetEntries[tid] ? Number(profitTargetEntries[tid]) : null,
          profit_target_exit: profitTargetExits[tid] ? Number(profitTargetExits[tid]) : null,
          position_sizing: positionSizings[tid] || '',
          playbook_id: playbookIds[tid] || '',
          what_worked: whatWorked[tid] || '',
          what_didnt: whatDidnt[tid] || '',
          lessons_learned: lessonsLearned[tid] || '',
          emotions: (emotions[tid] || []).join(','),
          important_notes: importantNotes[tid] || '',
        }),
      });
      setSavedIds(p => { const s = new Set(p); s.add(tid); return s; });
      setTimeout(() => setSavedIds(p => { const s = new Set(p); s.delete(tid); return s; }), 2000);
    } catch {} finally {
      setSavingIds(p => { const s = new Set(p); s.delete(tid); return s; });
    }
  };

  if (!trades.length) {
    return (
      <div className="posttrade-empty">
        <div className="posttrade-empty-icon">📝</div>
        <div className="posttrade-empty-title">No trades today</div>
        <div className="posttrade-empty-sub">Post-market analysis will appear here once you have trades.</div>
      </div>
    );
  }

  const entryPrice = (t: Trade) => t.avg_entry ?? t.avgEntry ?? 0;
  const exitPrice = (t: Trade) => t.avg_exit ?? t.avgExit ?? 0;

  return (
    <div className="posttrade-wrap">
      <div className="posttrade-header">
        <span>Post-Market Analysis</span>
        <span className="posttrade-count">{trades.length} trade{trades.length !== 1 ? 's' : ''}</span>
      </div>

      {trades.map((t, i) => {
        const tid = getTradeId(t);
        const isOpen = expandedIdx === i;
        const isSaving = savingIds.has(tid);
        const isSaved = savedIds.has(tid);

        return (
          <div key={tid} className={`posttrade-trade ${isOpen ? 'expanded' : ''}`}>
            {/* Trade row header — click to expand */}
            <div
              className="posttrade-trade-header"
              onClick={() => setExpandedIdx(isOpen ? null : i)}
            >
              <span className="posttrade-chevron">{isOpen ? '▾' : '▸'}</span>
              <span className="posttrade-symbol">{t.symbol}</span>
              <span className="posttrade-direction">{t.direction}</span>
              <span className="posttrade-qty">Qty {t.qty}</span>
              <span className="posttrade-prices">
                {fmtPrice(entryPrice(t))} → {fmtPrice(exitPrice(t))}
              </span>
              <span
                className="posttrade-pnl"
                style={{ color: t.pnl >= 0 ? 'var(--green)' : 'var(--red)' }}
              >
                {fmtINR(t.pnl)}
              </span>
              <span className={`badge ${t.result}`}>{t.result.toUpperCase()}</span>
            </div>

            {/* Expanded journal form */}
            {isOpen && (
              <div className="posttrade-form">
                <div className="posttrade-grid">
                  {/* Risk Amount */}
                  <div className="posttrade-field">
                    <label>Risk on this trade (₹)</label>
                    <input
                      type="number"
                      placeholder="Amount risked"
                      value={riskAmounts[tid] || ''}
                      onChange={e => {
                        setRiskAmounts(p => ({ ...p, [tid]: e.target.value }));
                      }}
                    />
                  </div>

                  {/* Entry Price Target */}
                  <div className="posttrade-field">
                    <label>Entry price target</label>
                    <input
                      type="number"
                      placeholder={fmtPrice(entryPrice(t))}
                      value={profitTargetEntries[tid] || ''}
                      onChange={e => {
                        setProfitTargetEntries(p => ({ ...p, [tid]: e.target.value }));
                      }}
                    />
                  </div>

                  {/* Exit Price Target */}
                  <div className="posttrade-field">
                    <label>Exit price target</label>
                    <input
                      type="number"
                      placeholder="Target exit"
                      value={profitTargetExits[tid] || ''}
                      onChange={e => {
                        setProfitTargetExits(p => ({ ...p, [tid]: e.target.value }));
                      }}
                    />
                  </div>

                  {/* Position Sizing */}
                  <div className="posttrade-field">
                    <label>Position sizing</label>
                    <input
                      type="text"
                      placeholder="e.g. 2% of capital, 1 lot"
                      value={positionSizings[tid] || ''}
                      onChange={e => {
                        setPositionSizings(p => ({ ...p, [tid]: e.target.value }));
                      }}
                    />
                  </div>
                </div>

                {/* Playbook */}
                <div className="posttrade-field">
                  <label>Playbook used</label>
                  <select
                    value={playbookIds[tid] || ''}
                    onChange={e => setPlaybookIds(p => ({ ...p, [tid]: e.target.value }))}
                  >
                    <option value="">— Select playbook —</option>
                    {playbooks.map(pb => (
                      <option key={pb.id} value={pb.id}>{pb.name}</option>
                    ))}
                  </select>
                </div>

                {/* What Worked */}
                <div className="posttrade-field">
                  <label>What worked</label>
                  <textarea
                    placeholder="What went well on this trade?"
                    value={whatWorked[tid] || ''}
                    onChange={e => setWhatWorked(p => ({ ...p, [tid]: e.target.value }))}
                    rows={2}
                  />
                </div>

                {/* What Didn't */}
                <div className="posttrade-field">
                  <label>What didn&rsquo;t work</label>
                  <textarea
                    placeholder="What could have been better?"
                    value={whatDidnt[tid] || ''}
                    onChange={e => setWhatDidnt(p => ({ ...p, [tid]: e.target.value }))}
                    rows={2}
                  />
                </div>

                {/* Lessons Learned */}
                <div className="posttrade-field">
                  <label>Lessons learned</label>
                  <textarea
                    placeholder="Key takeaways from this trade"
                    value={lessonsLearned[tid] || ''}
                    onChange={e => setLessonsLearned(p => ({ ...p, [tid]: e.target.value }))}
                    rows={2}
                  />
                </div>

                {/* Emotions */}
                <div className="posttrade-field">
                  <label>Emotions during this trade</label>
                  <div className="posttrade-emotions">
                    {EMOTIONS.map(em => {
                      const selected = (emotions[tid] || []).includes(em);
                      return (
                        <button
                          key={em}
                          className={`posttrade-emotion-chip ${selected ? 'active' : ''}`}
                          onClick={() => toggleEmotion(tid, em)}
                        >
                          {selected && <span className="emotion-dot">✓</span>}
                          {em}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Important Notes */}
                <div className="posttrade-field">
                  <label>Important notes</label>
                  <textarea
                    placeholder="Anything else worth remembering about this trade"
                    value={importantNotes[tid] || ''}
                    onChange={e => setImportantNotes(p => ({ ...p, [tid]: e.target.value }))}
                    rows={2}
                  />
                </div>

                {/* Save Button */}
                <div className="posttrade-actions">
                  <button
                    className={`posttrade-save-btn ${isSaved ? 'saved' : ''}`}
                    onClick={() => handleSave(tid)}
                    disabled={isSaving}
                  >
                    {isSaved ? '✓ Saved' : isSaving ? 'Saving…' : 'Save'}
                  </button>
                  <span className="posttrade-autosave-hint">Auto-saved locally</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
