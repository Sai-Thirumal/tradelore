'use client';

import Link from 'next/link';
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage } from '@/lib/errors';

interface DeltaStatus {
  server_configured: boolean;
  credentials_configured: boolean;
  connected: boolean;
  api_key_masked: string;
  api_secret_saved: boolean;
  credentials_saved_at: string | null;
  blocked_by_broker: string;
  last_sync_at: string | null;
  last_sync_status: string;
  last_sync_error: string;
  last_sync_cursor: string;
}

async function readApiError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || `Request failed with status ${response.status}`;
}

export default function DeltaSettingsPage() {
  const [status, setStatus] = useState<DeltaStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/broker/delta/status', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiError(response));
      setStatus(await response.json() as DeltaStatus);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to load Delta settings.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadStatus());
  }, [loadStatus]);

  const saveCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/broker/delta/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
      });
      if (!response.ok) throw new Error(await readApiError(response));

      setApiKey('');
      setApiSecret('');
      setMessage('Delta API credentials saved securely.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to save Delta credentials.'));
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Delta and delete saved Delta credentials?')) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/broker/delta/disconnect', { method: 'POST' });
      if (!response.ok) throw new Error(await readApiError(response));
      setMessage('Delta disconnected.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to disconnect Delta.'));
    } finally {
      setSaving(false);
    }
  };

  const syncDelta = async () => {
    setSyncing(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/broker/delta/sync', { method: 'POST' });
      if (!response.ok) throw new Error(await readApiError(response));
      const result = await response.json() as { imported_fills: number; total_trades: number };
      setMessage(`Delta synced ${result.imported_fills} fills, matched ${result.total_trades} trades.`);
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Delta sync failed.'));
      await loadStatus();
    } finally {
      setSyncing(false);
    }
  };

  const importDeltaCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const body = new FormData();
      body.append('broker', 'delta');
      body.append('file', file);
      const response = await fetch('/api/import', { method: 'POST', body });
      if (!response.ok) throw new Error(await readApiError(response));
      const result = await response.json() as { imported_orders: number; total_trades: number };
      setMessage(`Imported ${result.imported_orders} Delta fills, matched ${result.total_trades} trades.`);
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Delta CSV import failed.'));
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const blockedByBroker = status?.blocked_by_broker || '';

  return (
    <main className="zerodha-settings-page">
      <section className="zerodha-settings-shell">
        <header className="zerodha-settings-header">
          <div>
            <Link className="settings-back-link" href="/">Back to dashboard</Link>
            <h1>Delta Settings</h1>
            <p>Create a Delta Exchange API key with read/data permissions only. TradeLore does not place trades or withdraw funds.</p>
          </div>
        </header>

        {message && <div className="auth-alert success">{message}</div>}
        {error && <div className="auth-alert error">{error}</div>}
        {blockedByBroker && (
          <div className="auth-alert error">
            You can only connect one broker at a time. Go to <Link href="/settings/broker">Broker Settings</Link> to switch from {blockedByBroker}.
          </div>
        )}
        <section className="settings-grid">
          <div className="settings-panel">
            <h2>Connection</h2>
            {loading ? (
              <p className="settings-muted">Loading Delta settings...</p>
            ) : (
              <dl className="settings-details">
                <div>
                  <dt>API key</dt>
                  <dd>{status?.api_key_masked || 'Not saved'}</dd>
                </div>
                <div>
                  <dt>API secret</dt>
                  <dd>{status?.api_secret_saved ? '********' : 'Not saved'}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{status?.connected ? 'Connected' : 'Not connected'}</dd>
                </div>
                <div>
                  <dt>Last sync</dt>
                  <dd>{status?.last_sync_at ? status.last_sync_at.substring(0, 16).replace('T', ' ') : 'Never'}</dd>
                </div>
              </dl>
            )}

            <div className="settings-actions">
              <input ref={fileInputRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={importDeltaCsv} />
              <button className="auth-header-btn" onClick={syncDelta} disabled={syncing || saving || loading || !status?.credentials_configured}>
                {syncing ? 'Syncing...' : 'Sync Delta'}
              </button>
              <button className="auth-header-btn" onClick={() => fileInputRef.current?.click()} disabled={syncing || saving || loading}>
                Import Delta CSV
              </button>
              <button className="auth-header-btn" onClick={disconnect} disabled={saving || loading || !status?.credentials_configured}>
                Disconnect Delta
              </button>
            </div>
            {status?.last_sync_status === 'error' && status.last_sync_error && (
              <p className="settings-muted">{status.last_sync_error}</p>
            )}
          </div>

          <form className="settings-panel settings-form" onSubmit={saveCredentials}>
            <h2>Save API Credentials</h2>
            <div>
              <label>API key</label>
              <input
                value={apiKey}
                onChange={event => setApiKey(event.target.value)}
                placeholder="Enter your Delta API key"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>
            <div>
              <label>API secret</label>
              <input
                type="password"
                value={apiSecret}
                onChange={event => setApiSecret(event.target.value)}
                placeholder="Enter your Delta API secret"
                autoComplete="new-password"
                spellCheck={false}
                required
              />
            </div>
            <button className="auth-submit" type="submit" disabled={saving || loading || !status?.server_configured || Boolean(blockedByBroker)}>
              {saving ? 'Saving...' : 'Save credentials'}
            </button>
            {!status?.server_configured && !loading && (
              <p className="settings-muted">Broker credential encryption is not configured on the server.</p>
            )}
          </form>
        </section>
      </section>
    </main>
  );
}
