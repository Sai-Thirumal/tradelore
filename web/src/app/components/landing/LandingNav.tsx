'use client';

import { useState } from 'react';
import Link from 'next/link';

function TradeLoreMark() {
  return (
    <svg
      width="20"
      height="24"
      viewBox="0 0 20 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="landing-logo-mark"
      aria-hidden="true"
      focusable="false"
    >
      <line x1="10" y1="2" x2="10" y2="7" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3 7H12.5L17 11.5V17H3V7Z" fill="#f97316" />
      <line x1="10" y1="17" x2="10" y2="22" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg className="nav-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type MenuItem = { label: string; href: string; desc?: string };
type NavGroup = { label: string; items: MenuItem[] };

// Dropdown targets are on-page section anchors and existing routes — no dead links.
const groups: NavGroup[] = [
  {
    label: 'Products',
    items: [
      { label: 'Automated broker sync', href: '/#p-sync', desc: 'Auto-log fills from Zerodha and Delta' },
      { label: 'Journaling', href: '/#p-journal', desc: 'Plans and reviews beside the trade' },
      { label: 'Trade replays', href: '/#p-replay', desc: 'Chart, orders, and notes in one view' },
      { label: 'Analytics', href: '/#p-analytics', desc: 'Net P&L, win rate, profit factor, patterns' },
    ],
  },
];

const resources: NavGroup = {
  label: 'Resources',
  items: [
    { label: 'Supported brokers', href: '/#brokers', desc: 'Zerodha, Delta, and more coming' },
    { label: 'Product tour', href: '/#product', desc: 'See the full workflow' },
    { label: 'Get started', href: '/login?next=/dashboard', desc: 'Create your account' },
  ],
};

export default function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const dropdown = (group: NavGroup) => (
    <div className="nav-item has-menu" key={group.label}>
      <button type="button" className="nav-link nav-trigger">
        {group.label}
        <Chevron />
      </button>
      <div className="nav-menu" role="menu">
        {group.items.map((item) => (
          <Link key={item.label} className="nav-menu-item" href={item.href} role="menuitem">
            <span className="nav-menu-item-label">{item.label}</span>
            {item.desc && <span className="nav-menu-item-desc">{item.desc}</span>}
          </Link>
        ))}
      </div>
    </div>
  );

  return (
    <header className="landing-header">
      <Link className="landing-brand" href="/" aria-label="TradeLore home">
        <TradeLoreMark />
        <span>TradeLore</span>
      </Link>

      <nav className="landing-nav" aria-label="Primary">
        {dropdown(groups[0])}
        <Link className="nav-link" href="/#brokers">Supported Brokers</Link>
        <Link className="nav-link" href="/#get-started">Pricing</Link>
        {dropdown(resources)}
      </nav>

      <div className="landing-header-actions">
        <Link className="landing-link-btn" href="/login">Log in</Link>
        <Link className="landing-primary-btn small" href="/login?next=/dashboard">
          Get Started
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ marginLeft: 6 }}>
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      <button
        type="button"
        className="nav-hamburger"
        aria-label="Toggle menu"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          {mobileOpen ? (
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {mobileOpen && (
        <div className="nav-mobile-panel">
          {[...groups, resources].map((group) => (
            <div className="nav-mobile-group" key={group.label}>
              <span className="nav-mobile-group-label">{group.label}</span>
              {group.items.map((item) => (
                <Link
                  key={item.label}
                  className="nav-mobile-link"
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
          <div className="nav-mobile-group">
            <Link className="nav-mobile-link" href="/#brokers" onClick={() => setMobileOpen(false)}>Supported Brokers</Link>
            <Link className="nav-mobile-link" href="/#get-started" onClick={() => setMobileOpen(false)}>Pricing</Link>
            <Link className="nav-mobile-link" href="/login" onClick={() => setMobileOpen(false)}>Log in</Link>
          </div>
        </div>
      )}
    </header>
  );
}
