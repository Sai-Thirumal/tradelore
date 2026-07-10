'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getErrorMessage } from '@/lib/errors';

interface UpstoxStatus {
  server_configured: boolean;
  credentials_configured: boolean;
  connected: boolean;
  needs_reconnect?: boolean;
  api_key_masked: string;
  api_secret_saved: boolean;
  credentials_saved_at: string | null;
  redirect_url?: string;
  last_sync_at: string | null;
  last_sync_status: string;
  last_sync_error: string;
  broker_user_id?: string;
  broker_user_name?: string;
}

async function readApiError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || `Request failed with status ${response.status}`;
}

function UpstoxSettingsContent() {
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('upstox') === 'credentials_required'
    ? 'Add your Upstox API credentials before connecting.'
    : searchParams.get('upstox') === 'connected'
    ? 'Upstox connected.'
    : '';
  const [status, setStatus] = useState<UpstoxStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/broker/upstox/status', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiError(response));
      setStatus(await response.json() as UpstoxStatus);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to load Upstox settings.'));
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
      const response = await fetch('/api/broker/upstox/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
      });
      if (!response.ok) throw new Error(await readApiError(response));

      setApiKey('');
      setApiSecret('');
      setMessage('Upstox API credentials saved securely.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to save Upstox credentials.'));
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Upstox for this session? Your saved API credentials will remain.')) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/broker/upstox/disconnect', { method: 'POST' });
      if (!response.ok) throw new Error(await readApiError(response));
      setMessage('Upstox disconnected.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to disconnect Upstox.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteCredentials = async () => {
    if (!confirm('Delete saved Upstox credentials and disconnect Upstox?')) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/broker/upstox/credentials', { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiError(response));
      setMessage('Upstox credentials deleted.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to delete Upstox credentials.'));
    } finally {
      setSaving(false);
    }
  };

  const connect = () => {
    if (!status?.credentials_configured) {
      setError('Save your Upstox API key and secret before connecting.');
      return;
    }
    window.location.href = '/api/broker/upstox/login';
  };

  const syncUpstox = async () => {
    setSyncing(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/broker/upstox/sync', { method: 'POST' });
      if (!response.ok) throw new Error(await readApiError(response));
      const result = await response.json() as { imported_orders: number; total_trades: number };
      setMessage(`Upstox synced ${result.imported_orders} fills, matched ${result.total_trades} trades.`);
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Upstox sync failed.'));
      await loadStatus();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <main className="zerodha-settings-page">
      <section className="zerodha-settings-shell">
        <header className="zerodha-settings-header">
          <div>
            <Link className="settings-back-link" href="/dashboard">Back to dashboard</Link>
            <h1>Upstox Settings</h1>
            <p>Use your Upstox API app credentials for read-only TradeLore sync.</p>
          </div>
          <div className="zerodha-header-actions">
            <button
              className="settings-help-btn"
              type="button"
              aria-expanded={helpOpen}
              aria-controls="upstox-sync-help"
              onClick={() => setHelpOpen(open => !open)}
            >
              {helpOpen ? 'Hide help' : 'Help'}
            </button>
            <button className="auth-header-btn" onClick={connect} disabled={saving || loading || !status?.credentials_configured}>
              Connect Upstox
            </button>
          </div>
        </header>

        <div className="zerodha-notice">
          TradeLore imports Upstox historical trades for journaling and analytics. TradeLore does not place, modify, or cancel orders.
        </div>

        {helpOpen && (
          <section className="settings-panel zerodha-help-panel" id="upstox-sync-help">
            <div className="zerodha-help-header">
              <div>
                <h2>How to Sync Upstox</h2>
                <p className="settings-muted">Create an Upstox app, save its credentials, connect once, then sync historical trades.</p>
              </div>
              <button className="modal-close" type="button" aria-label="Close Upstox sync help" onClick={() => setHelpOpen(false)}>x</button>
            </div>

            <ol className="zerodha-help-steps">
              <li>
                <strong>Create an Upstox app.</strong>
                Open the Upstox developer console and create an app for TradeLore.
              </li>
              <li>
                <strong>Set the redirect URL.</strong>
                Paste this Redirect URL into the Upstox app redirect URL field:
                <input
                  className="settings-readonly-input"
                  value={status?.redirect_url || ''}
                  readOnly
                  aria-label="Upstox redirect URL"
                />
              </li>
              <li>
                <strong>Save credentials in TradeLore.</strong>
                Paste the Upstox API key and API secret into Save API Credentials, then click Save credentials.
              </li>
              <li>
                <strong>Connect Upstox.</strong>
                Click Connect Upstox, approve the Upstox login screen, and return to TradeLore.
              </li>
              <li>
                <strong>Sync historical trades.</strong>
                Click Sync Upstox. TradeLore imports the last six retained months across equity, F&O, commodities, and currency segments.
              </li>
            </ol>

            <div className="zerodha-help-note">
              If Upstox shows reconnect or sync fails with an auth error, connect again to refresh the stored access token.
            </div>
          </section>
        )}

        {message && <div className="auth-alert success">{message}</div>}
        {error && <div className="auth-alert error">{error}</div>}

        <section className="settings-grid">
          <div className="settings-panel">
            <h2>Connection</h2>
            {loading ? (
              <p className="settings-muted">Loading Upstox settings...</p>
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
                  <dd>{status?.connected ? 'Connected' : status?.credentials_configured ? 'Credentials saved' : 'Not connected'}</dd>
                </div>
                <div>
                  <dt>Last sync</dt>
                  <dd>{status?.last_sync_at ? status.last_sync_at.substring(0, 16).replace('T', ' ') : 'Never'}</dd>
                </div>
              </dl>
            )}

            <div className="settings-actions">
              <button className="auth-header-btn" onClick={syncUpstox} disabled={syncing || saving || loading || !status?.connected}>
                {syncing ? 'Syncing...' : 'Sync Upstox'}
              </button>
              <button className="auth-header-btn" onClick={disconnect} disabled={saving || loading || !status?.credentials_configured}>
                Disconnect Upstox
              </button>
              <button className="settings-danger-btn" onClick={deleteCredentials} disabled={saving || loading || !status?.credentials_configured}>
                Delete credentials
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
                placeholder="Enter your Upstox API key"
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
                placeholder="Enter your Upstox API secret"
                autoComplete="new-password"
                spellCheck={false}
                required
              />
            </div>
            <button className="auth-submit" type="submit" disabled={saving || loading || !status?.server_configured}>
              {saving ? 'Saving...' : 'Save credentials'}
            </button>
            {!status?.server_configured && !loading && (
              <p className="settings-muted">Broker credential encryption is not configured on the server.</p>
            )}
          </form>
        </section>

        <section className="settings-panel">
          <h2>App Setup</h2>
          <p className="settings-muted">Set this as the Redirect URL in your Upstox app:</p>
          <input
            className="settings-readonly-input"
            value={status?.redirect_url || ''}
            readOnly
            aria-label="Upstox redirect URL"
          />
        </section>
      </section>
    </main>
  );
}

export default function UpstoxSettingsPage() {
  return (
    <Suspense fallback={<main className="zerodha-settings-page"><section className="zerodha-settings-shell">Loading Upstox settings...</section></main>}>
      <UpstoxSettingsContent />
    </Suspense>
  );
}
