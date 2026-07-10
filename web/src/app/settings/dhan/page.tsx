'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '@/lib/errors';

interface DhanStatus {
  server_configured: boolean;
  credentials_configured: boolean;
  connected: boolean;
  needs_reconnect?: boolean;
  api_key_masked: string;
  api_secret_saved: boolean;
  credentials_saved_at: string | null;
  last_sync_at: string | null;
  last_sync_status: string;
  last_sync_error: string;
}

async function readApiError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || `Request failed with status ${response.status}`;
}

export default function DhanSettingsPage() {
  const [status, setStatus] = useState<DhanStatus | null>(null);
  const [clientId, setClientId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/broker/dhan/status', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiError(response));
      setStatus(await response.json() as DhanStatus);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to load Dhan settings.'));
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
      const response = await fetch('/api/broker/dhan/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: clientId, api_secret: accessToken }),
      });
      if (!response.ok) throw new Error(await readApiError(response));

      setClientId('');
      setAccessToken('');
      setMessage('Dhan client ID and access token saved securely.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to save Dhan credentials.'));
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Dhan for this session? Your saved credentials will remain.')) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/broker/dhan/disconnect', { method: 'POST' });
      if (!response.ok) throw new Error(await readApiError(response));
      setMessage('Dhan disconnected.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to disconnect Dhan.'));
    } finally {
      setSaving(false);
    }
  };

  const syncDhan = async () => {
    setSyncing(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/broker/dhan/sync', { method: 'POST' });
      if (!response.ok) throw new Error(await readApiError(response));
      const result = await response.json() as { imported_orders: number; total_trades: number };
      setMessage(`Dhan synced ${result.imported_orders} fills, matched ${result.total_trades} trades.`);
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Dhan sync failed.'));
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
            <h1>Dhan Settings</h1>
            <p>Save your Dhan Client ID and a 24-hour DhanHQ access token for read-only trade sync.</p>
          </div>
          <div className="zerodha-header-actions">
            <button
              className="settings-help-btn"
              type="button"
              aria-expanded={helpOpen}
              aria-controls="dhan-sync-help"
              onClick={() => setHelpOpen(open => !open)}
            >
              {helpOpen ? 'Hide help' : 'Help'}
            </button>
          </div>
        </header>

        <div className="zerodha-notice">
          TradeLore imports the Dhan trade book for journaling and analytics. TradeLore does not place, modify, or cancel orders.
        </div>

        {helpOpen && (
          <section className="settings-panel zerodha-help-panel" id="dhan-sync-help">
            <div className="zerodha-help-header">
              <div>
                <h2>How to Sync Dhan</h2>
                <p className="settings-muted">Generate a DhanHQ access token, save it with your Client ID, then sync the trade book.</p>
              </div>
              <button className="modal-close" type="button" aria-label="Close Dhan sync help" onClick={() => setHelpOpen(false)}>x</button>
            </div>

            <ol className="zerodha-help-steps">
              <li>
                <strong>Open DhanHQ.</strong>
                Sign in to DhanHQ and open the API access or token generation area.
              </li>
              <li>
                <strong>Copy your Client ID.</strong>
                Use the Dhan Client ID shown in your account or DhanHQ profile.
              </li>
              <li>
                <strong>Generate an access token.</strong>
                Create a fresh DhanHQ access token. Dhan tokens are short-lived, so expect to refresh this periodically.
              </li>
              <li>
                <strong>Save credentials in TradeLore.</strong>
                Paste the Client ID and access token into Save Dhan Access, then click Save credentials.
              </li>
              <li>
                <strong>Sync your trades.</strong>
                Click Sync Dhan. TradeLore imports Dhan trade fills and matches closed positions for analytics and journaling.
              </li>
            </ol>

            <div className="zerodha-help-note">
              Save only your own Dhan token. If sync fails with an auth error, generate and save a fresh access token.
            </div>
          </section>
        )}

        {message && <div className="auth-alert success">{message}</div>}
        {error && <div className="auth-alert error">{error}</div>}

        <section className="settings-grid">
          <div className="settings-panel">
            <h2>Connection</h2>
            {loading ? (
              <p className="settings-muted">Loading Dhan settings...</p>
            ) : (
              <dl className="settings-details">
                <div>
                  <dt>Client ID</dt>
                  <dd>{status?.api_key_masked || 'Not saved'}</dd>
                </div>
                <div>
                  <dt>Access token</dt>
                  <dd>{status?.api_secret_saved ? '********' : 'Not saved'}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{status?.credentials_configured ? (status.needs_reconnect ? 'Token saved' : 'Connected') : 'Not connected'}</dd>
                </div>
                <div>
                  <dt>Last sync</dt>
                  <dd>{status?.last_sync_at ? status.last_sync_at.substring(0, 16).replace('T', ' ') : 'Never'}</dd>
                </div>
              </dl>
            )}

            <div className="settings-actions">
              <button className="auth-header-btn" onClick={syncDhan} disabled={syncing || saving || loading || !status?.credentials_configured}>
                {syncing ? 'Syncing...' : 'Sync Dhan'}
              </button>
              <button className="auth-header-btn" onClick={disconnect} disabled={saving || loading || !status?.credentials_configured}>
                Disconnect Dhan
              </button>
            </div>
            {status?.last_sync_status === 'error' && status.last_sync_error && (
              <p className="settings-muted">{status.last_sync_error}</p>
            )}
          </div>

          <form className="settings-panel settings-form" onSubmit={saveCredentials}>
            <h2>Save Dhan Access</h2>
            <div>
              <label>Client ID</label>
              <input
                value={clientId}
                onChange={event => setClientId(event.target.value)}
                placeholder="Enter your Dhan Client ID"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>
            <div>
              <label>Access token</label>
              <input
                type="password"
                value={accessToken}
                onChange={event => setAccessToken(event.target.value)}
                placeholder="Enter your DhanHQ access token"
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
      </section>
    </main>
  );
}
