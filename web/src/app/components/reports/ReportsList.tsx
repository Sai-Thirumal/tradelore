'use client';

import React, { useState, useRef, useEffect } from 'react';
import DayTimeReport from './DayTimeReport';

type Group = 'days' | 'months' | 'trade-time' | 'trade-duration';

const CATEGORIES = [
  { key: 'day-time', label: 'Day & Time' },
  { key: 'instruments', label: 'Instruments' },
  { key: 'risk', label: 'Risk' },
  { key: 'playbooks', label: 'Playbooks' },
  { key: 'options', label: 'Options' },
];

const DAY_TIME_TABS: { key: Group; label: string }[] = [
  { key: 'days', label: 'Days' },
  { key: 'months', label: 'Months' },
  { key: 'trade-time', label: 'Trade time' },
  { key: 'trade-duration', label: 'Trade duration' },
];

export default function ReportsList() {
  const [category, setCategory] = useState('day-time');
  const [open, setOpen] = useState(false);
  const [dayTimeGroup, setDayTimeGroup] = useState<Group>('days');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const activeLabel = CATEGORIES.find(c => c.key === category)?.label || 'Day & Time';

  const renderCategoryTabs = () => {
    switch (category) {
      case 'day-time':
        return DAY_TIME_TABS.map(tab => (
          <div
            key={tab.key}
            className={`report-cat-tab ${dayTimeGroup === tab.key ? 'active' : ''}`}
            onClick={() => setDayTimeGroup(tab.key)}
          >
            {tab.label}
          </div>
        ));
      default:
        return null;
    }
  };

  const renderContent = () => {
    switch (category) {
      case 'day-time':
        return <DayTimeReport group={dayTimeGroup} />;
      case 'instruments':
        return <DayTimeReport group="instruments" />;
      case 'risk':
        return <DayTimeReport group="deployed-capital" />;
      case 'playbooks':
        return <DayTimeReport group="playbooks" />;
      case 'options':
        return <DayTimeReport group="options-expiry" />;
      default:
        return (
          <div className="section" style={{ textAlign: 'center', padding: '40px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {CATEGORIES.find(c => c.key === category)?.label} report coming soon
            </span>
          </div>
        );
    }
  };

  const categoryTabs = renderCategoryTabs();

  return (
    <div>
      {/* Dropdown + category tabs on same row */}
      <div className="report-cat-row">
        <div className="popup-wrap" ref={wrapRef}>
          <div className="popup-trigger report-cat-dropdown" onClick={() => setOpen(!open)}>
            <span>{activeLabel}</span>
            <span className="arrow">▼</span>
          </div>
          <div className={`popup-menu ${open ? 'open' : ''}`}>
            {CATEGORIES.map(cat => (
              <div
                key={cat.key}
                className={`item ${category === cat.key ? 'active' : ''}`}
                onClick={() => { setCategory(cat.key); setOpen(false); }}
              >
                {cat.label}
              </div>
            ))}
          </div>
        </div>
        {categoryTabs && <div className="report-cat-tabs">{categoryTabs}</div>}
      </div>

      {/* Content */}
      <div className="fade-in-up">
        {renderContent()}
      </div>
    </div>
  );
}
