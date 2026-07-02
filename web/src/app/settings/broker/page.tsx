'use client';

import Link from 'next/link';
import { useState } from 'react';

const BROKER_LINKS = {
  zerodha: '/settings/zerodha',
  delta: '/settings/delta',
} as const;

export default function BrokerSettingsPage() {
  const [broker, setBroker] = useState<keyof typeof BROKER_LINKS>('zerodha');

  return (
    <main className="zerodha-settings-page">
      <section className="zerodha-settings-shell">
        <header className="zerodha-settings-header">
          <div>
            <Link className="settings-back-link" href="/dashboard">Back to dashboard</Link>
            <h1>Broker Settings</h1>
            <p>Select one broker to connect, sync, disconnect, or manage API credentials.</p>
          </div>
        </header>

        <section
          className="settings-panel settings-form broker-settings-panel"
          style={{ width: 'min(420px, 100%)', margin: '0 auto' }}
        >
          <h2>Select a Broker</h2>
          <div>
            <label style={{ display: 'block', marginBottom: '6px' }}>Broker</label>
            <select
              className="broker-settings-select"
              value={broker}
              onChange={(event) => setBroker(event.target.value as keyof typeof BROKER_LINKS)}
              style={{
                width: '100%',
                height: '44px',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0 12px',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontFamily: 'var(--font)',
                fontSize: '14px',
              }}
            >
              <option value="zerodha">Zerodha</option>
              <option value="delta">Delta Exchange</option>
            </select>
          </div>
          <Link
            className="auth-submit broker-settings-submit"
            href={BROKER_LINKS[broker]}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', textDecoration: 'none' }}
          >
            Continue
          </Link>
        </section>
      </section>
    </main>
  );
}
