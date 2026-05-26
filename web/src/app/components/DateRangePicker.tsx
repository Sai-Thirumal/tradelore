"use client";

import React, { useState, useRef, useEffect } from 'react';

interface Props {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  onClear: () => void;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(y: number, m: number, d: number) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function monthGrid(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const weeks: (number | null)[][] = [];
  let w: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) {
    w.push(d);
    if (w.length === 7) { weeks.push(w); w = []; }
  }
  if (w.length) { while (w.length < 7) w.push(null); weeks.push(w); }
  return weeks;
}

function fmtDisplay(y: number, m: number, d: number) {
  return new Date(y, m, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function yearOptions(center: number) {
  const ys: number[] = [];
  for (let y = center - 10; y <= center + 10; y++) ys.push(y);
  return ys;
}

interface CalState {
  year: number; month: number;
  monthOpen: boolean; yearOpen: boolean;
}

export default function DateRangePicker({ start, end, onChange, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const today = fmt(now.getFullYear(), now.getMonth(), now.getDate());

  const initLM = start ? new Date(start + 'T00:00:00').getMonth() : now.getMonth();
  const initLY = start ? new Date(start + 'T00:00:00').getFullYear() : now.getFullYear();
  const initRM = end ? new Date(end + 'T00:00:00').getMonth() : (initLM === 11 ? 0 : initLM + 1);
  const initRY = end ? new Date(end + 'T00:00:00').getFullYear() : (initLM === 11 ? initLY + 1 : initLY);

  const [left, setLeft] = useState<CalState>({ year: initLY, month: initLM, monthOpen: false, yearOpen: false });
  const [right, setRight] = useState<CalState>({ year: initRY, month: initRM, monthOpen: false, yearOpen: false });

  const [s, setS] = useState<string | null>(start || null);
  const [e, setE] = useState<string | null>(end || null);
  const [phase, setPhase] = useState<'start' | 'end'>('start');

  const ref = useRef<HTMLDivElement>(null);
  const leftYrRef = useRef<HTMLDivElement>(null);
  const rightYrRef = useRef<HTMLDivElement>(null);

  // Sync from props
  useEffect(() => {
    setS(start || null);
    setE(end || null);
    if (start) {
      const d = new Date(start + 'T00:00:00');
      setLeft(prev => ({ ...prev, year: d.getFullYear(), month: d.getMonth() }));
    }
    if (end) {
      const d = new Date(end + 'T00:00:00');
      setRight(prev => ({ ...prev, year: d.getFullYear(), month: d.getMonth() }));
    }
  }, [start, end]);

  // Click outside
  useEffect(() => {
    function click(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    if (open) document.addEventListener('mousedown', click);
    return () => document.removeEventListener('mousedown', click);
  }, [open]);

  // Auto-scroll year dropdowns
  useEffect(() => {
    if (left.yearOpen && leftYrRef.current) {
      const el = leftYrRef.current.querySelector('.drp-my-sel');
      if (el) el.scrollIntoView({ block: 'center' });
    }
  }, [left.yearOpen]);

  useEffect(() => {
    if (right.yearOpen && rightYrRef.current) {
      const el = rightYrRef.current.querySelector('.drp-my-sel');
      if (el) el.scrollIntoView({ block: 'center' });
    }
  }, [right.yearOpen]);

  function updateLeft(part: Partial<CalState>) { setLeft(prev => ({ ...prev, ...part })); }
  function updateRight(part: Partial<CalState>) { setRight(prev => ({ ...prev, ...part })); }

  function navCal(isLeft: boolean, dir: number) {
    const upd = isLeft ? updateLeft : updateRight;
    const cal = isLeft ? left : right;
    let m = cal.month + dir;
    let y = cal.year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    upd({ month: m, year: y, monthOpen: false, yearOpen: false });
  }

  function pickMonth(isLeft: boolean, m: number) {
    const upd = isLeft ? updateLeft : updateRight;
    upd({ month: m, monthOpen: false, yearOpen: false });
  }

  function pickYear(isLeft: boolean, y: number) {
    const upd = isLeft ? updateLeft : updateRight;
    upd({ year: y, yearOpen: false, monthOpen: false });
  }

  function pick(dateStr: string) {
    if (phase === 'start' || (s && e)) {
      setS(dateStr); setE(null); setPhase('end');
    } else {
      let a = s!, b = dateStr;
      if (b < a) [a, b] = [b, a];
      setS(a); setE(b); setPhase('start');
    }
  }

  function inRange(d: string) { return !!(s && e && d >= s && d <= e); }
  function isEp(d: string) { return d === s || d === e; }

  function apply() {
    if (s && e) onChange(s, e);
    setOpen(false);
  }

  function clearAll() {
    setS(null); setE(null); setPhase('start');
    onClear(); setOpen(false);
  }

  function renderCalendar(year: number, month: number) {
    return monthGrid(year, month).flat().map((d, i) => {
      if (d === null) return <span key={i} className="drp-cell empty" />;
      const ds = fmt(year, month, d);
      const isToday = ds === today;
      const inR = inRange(ds);
      const ep = isEp(ds);
      const isStart = ds === s;
      return (
        <span
          key={i}
          className={`drp-cell${isToday ? ' today' : ''}${inR ? ' in' : ''}${ep ? ' ep' : ''}${isStart ? ' st' : ''}`}
          onClick={() => pick(ds)}
        >
          {d}
        </span>
      );
    });
  }

  function renderMonthDropdown(isLeft: boolean) {
    const cal = isLeft ? left : right;
    if (!cal.monthOpen) return null;
    const upd = isLeft ? updateLeft : updateRight;
    return (
      <div className="drp-my-drop" onClick={e => e.stopPropagation()}>
        <div className="drp-my-grid">
          {MONTHS.map((name, i) => (
            <button
              key={i}
              className={`drp-my-item${i === cal.month ? ' sel' : ''}`}
              onClick={() => pickMonth(isLeft, i)}
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderYearDropdown(isLeft: boolean) {
    const cal = isLeft ? left : right;
    if (!cal.yearOpen) return null;
    const refEl = isLeft ? leftYrRef : rightYrRef;
    const years = yearOptions(cal.year);
    return (
      <div className="drp-my-drop" ref={refEl} onClick={e => e.stopPropagation()}>
        <div className="drp-my-list">
          {years.map(y => (
            <button
              key={y}
              className={`drp-my-item yr${y === cal.year ? ' drp-my-sel sel' : ''}`}
              onClick={() => pickYear(isLeft, y)}
            >
              {y}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function toggleMonth(isLeft: boolean) {
    const cal = isLeft ? left : right;
    const upd = isLeft ? updateLeft : updateRight;
    const otherUpd = isLeft ? updateRight : updateLeft;
    otherUpd({ monthOpen: false, yearOpen: false });
    if (cal.monthOpen) { upd({ monthOpen: false }); }
    else { upd({ monthOpen: true, yearOpen: false }); }
  }

  function toggleYear(isLeft: boolean) {
    const cal = isLeft ? left : right;
    const upd = isLeft ? updateLeft : updateRight;
    const otherUpd = isLeft ? updateRight : updateLeft;
    otherUpd({ monthOpen: false, yearOpen: false });
    if (cal.yearOpen) { upd({ yearOpen: false }); }
    else { upd({ yearOpen: true, monthOpen: false }); }
  }

  const has = s && e;
  const label = has
    ? `${fmtDisplay(new Date(s+'T00:00:00').getFullYear(), new Date(s+'T00:00:00').getMonth(), new Date(s+'T00:00:00').getDate())} → ${fmtDisplay(new Date(e+'T00:00:00').getFullYear(), new Date(e+'T00:00:00').getMonth(), new Date(e+'T00:00:00').getDate())}`
    : 'Date Range';

  function renderPanel(isLeft: boolean) {
    const cal = isLeft ? left : right;
    return (
      <div className="drp-panel">
        <div className="drp-head">
          <button className="drp-nav" onClick={() => navCal(isLeft, -1)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 3L5 7L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="drp-mylabel">
            <button className="drp-month-btn" onClick={() => toggleMonth(isLeft)}>{MONTHS[cal.month]}</button>
            <button className="drp-year-btn" onClick={() => toggleYear(isLeft)}>{cal.year}</button>
          </div>
          <button className="drp-nav" onClick={() => navCal(isLeft, 1)}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
        {renderMonthDropdown(isLeft)}
        {renderYearDropdown(isLeft)}
        <div className="drp-dow">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d}>{d}</span>)}
        </div>
        <div className="drp-grid">
          {renderCalendar(cal.year, cal.month)}
        </div>
      </div>
    );
  }

  return (
    <div className="drp-root" ref={ref}>
      <button className="drp-trigger" onClick={() => setOpen(!open)}>
        {label}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ marginLeft: 6, flexShrink: 0 }}>
          <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="drp-popover">
          <div className="drp-panels">
            {renderPanel(true)}
            {renderPanel(false)}
          </div>

          <div className="drp-ft">
            <span className="drp-ft-hint">
              {phase === 'start' ? 'Select start date' : has ? `${s} → ${e}` : 'Select end date'}
            </span>
            <div className="drp-ft-btns">
              <button className="drp-btn-c" onClick={clearAll}>Clear</button>
              <button className="drp-btn-a" onClick={apply} disabled={!has}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
