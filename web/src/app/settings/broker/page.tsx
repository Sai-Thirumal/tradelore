'use client';

import Link from 'next/link';
import { useState } from 'react';
import { listBrokerCatalogEntries } from '@/lib/brokers/core/catalog';
import type { KnownBrokerId } from '@/lib/brokers/core/types';

const BROKERS = listBrokerCatalogEntries();

export default function BrokerSettingsPage() {
  const [broker, setBroker] = useState<KnownBrokerId>('zerodha');
  const selectedBroker = BROKERS.find((entry) => entry.id === broker) || BROKERS[0];

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
        >
          <h2>Select a Broker</h2>
          <div>
            <label>Broker</label>
            <select
              className="broker-settings-select"
              value={broker}
              onChange={(event) => setBroker(event.target.value as KnownBrokerId)}
            >
              {BROKERS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.displayName} - {entry.market === 'india' ? 'Indian Markets' : 'Crypto'}
                </option>
              ))}
            </select>
          </div>
          <Link
            className="auth-submit broker-settings-submit"
            href={selectedBroker.settingsPath}
          >
            Continue
          </Link>
        </section>
      </section>
    </main>
  );
}
