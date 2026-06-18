"use client";

import { useState, useEffect, useCallback } from 'react';

const OUTLOOK_OPTIONS = ['Bullish', 'Bearish', 'Neutral', 'Choppy', 'Wait & Watch'];

// ── Helpers (module-level) ──
function fmtDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function lsKey(date: string): string {
  return `pre_market_plan_${date}`;
}

export default function JournalPreMarket({ latestTradeDate }: { latestTradeDate: string }) {
  const date = latestTradeDate;
  const [marketOutlook, setMarketOutlook] = useState('');
  const [outlookBias, setOutlookBias] = useState('');
  const [capitalToDeploy, setCapitalToDeploy] = useState('');
  const [keyLevels, setKeyLevels] = useState('');
  const [newsEvents, setNewsEvents] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load saved plan from localStorage + API
  useEffect(() => {
    // localStorage first (instant)
    const cached = localStorage.getItem(lsKey(date));
    if (cached) {
      try {
        const plan = JSON.parse(cached);
        queueMicrotask(() => {
          setMarketOutlook(plan.marketOutlook || '');
          setOutlookBias(plan.outlookBias || '');
          setCapitalToDeploy(plan.capitalToDeploy || '');
          setKeyLevels(plan.keyLevels || '');
          setNewsEvents(plan.newsEvents || '');
        });
      } catch {}
    }

    // Then API (overwrites localStorage if newer)
    fetch(`/api/daily-journal?date=${date}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.date) {
          setMarketOutlook(data.market_outlook || '');
          setOutlookBias(data.outlook_bias || '');
          setCapitalToDeploy(data.capital_to_deploy?.toString() || '');
          setKeyLevels(data.key_levels || '');
          setNewsEvents(data.news_events || '');
        }
      })
      .catch(() => {});
  }, [date]);

  // Auto-save to localStorage on any change
  const saveLocal = useCallback(() => {
    localStorage.setItem(
      lsKey(date),
      JSON.stringify({
        marketOutlook,
        outlookBias,
        capitalToDeploy,
        keyLevels,
        newsEvents,
      }),
    );
  }, [date, marketOutlook, outlookBias, capitalToDeploy, keyLevels, newsEvents]);

  useEffect(() => { saveLocal(); }, [saveLocal]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/daily-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          market_outlook: marketOutlook,
          outlook_bias: outlookBias,
          capital_to_deploy: capitalToDeploy ? Number(capitalToDeploy) : null,
          key_levels: keyLevels,
          news_events: newsEvents,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally {
      setSaving(false);
    }
  };

  return (
    <div className="premarket-card">
      {/* Header */}
      <div className="premarket-header">
        <div>
          <div className="premarket-label">Pre-Market Plan</div>
          <div className="premarket-date">{fmtDateLabel(date)}</div>
        </div>
        <button
          className={`premarket-save-btn ${saved ? 'saved' : ''}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Plan'}
        </button>
      </div>

      <div className="premarket-body">
        {/* Market Outlook */}
        <div className="premarket-field">
          <label className="premarket-field-label">
            What are you looking for in today&rsquo;s market?
          </label>
          <textarea
            className="premarket-textarea"
            placeholder="Market conditions, sectors in play, global cues, your overall read…"
            value={marketOutlook}
            onChange={e => setMarketOutlook(e.target.value)}
            rows={3}
          />
        </div>

        {/* Outlook Bias */}
        <div className="premarket-field">
          <label className="premarket-field-label">Market bias</label>
          <div className="premarket-chips">
            {OUTLOOK_OPTIONS.map(opt => (
              <button
                key={opt}
                className={`premarket-chip ${outlookBias === opt ? 'active' : ''}`}
                onClick={() => setOutlookBias(outlookBias === opt ? '' : opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Capital to Deploy */}
        <div className="premarket-field">
          <label className="premarket-field-label">Capital to deploy today (₹)</label>
          <input
            type="number"
            className="premarket-input"
            placeholder="e.g. 50000"
            value={capitalToDeploy}
            onChange={e => setCapitalToDeploy(e.target.value)}
          />
        </div>

        {/* Key Levels */}
        <div className="premarket-field">
          <label className="premarket-field-label">Key levels you&rsquo;re watching</label>
          <textarea
            className="premarket-textarea"
            placeholder="Support, resistance, supply/demand zones, open interest levels…"
            value={keyLevels}
            onChange={e => setKeyLevels(e.target.value)}
            rows={2}
          />
        </div>

        {/* News / Events */}
        <div className="premarket-field">
          <label className="premarket-field-label">News / events to be aware of</label>
          <textarea
            className="premarket-textarea"
            placeholder="Earnings, economic data, RBI policy, FOMC, geopolitical…"
            value={newsEvents}
            onChange={e => setNewsEvents(e.target.value)}
            rows={2}
          />
        </div>
      </div>
    </div>
  );
}
