'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '@/lib/errors';

interface AngelOneStatus {
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

export default function AngelOneSettingsPage() {
  const [status, setStatus] = useState<AngelOneStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [jwtToken, setJwtToken] = useState('');
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
      const response = await fetch('/api/broker/angelone/status', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiError(response));
      setStatus(await response.json() as AngelOneStatus);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to load Angel One settings.'));
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
      const response = await fetch('/api/broker/angelone/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, api_secret: jwtToken }),
      });
      if (!response.ok) throw new Error(await readApiError(response));

      setApiKey('');
      setJwtToken('');
      setMessage('Angel One API key and JWT token saved securely.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to save Angel One credentials.'));
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Angel One for this session? Your saved credentials will remain.')) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/broker/angelone/disconnect', { method: 'POST' });
      if (!response.ok) throw new Error(await readApiError(response));
      setMessage('Angel One disconnected.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to disconnect Angel One.'));
    } finally {
      setSaving(false);
    }
  };

  const syncAngelOne = async () => {
    setSyncing(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/broker/angelone/sync', { method: 'POST' });
      if (!response.ok) throw new Error(await readApiError(response));
      const result = await response.json() as { imported_orders: number; total_trades: number };
      setMessage(`Angel One synced ${result.imported_orders} fills, matched ${result.total_trades} trades.`);
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Angel One sync failed.'));
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
            <h1>Angel One Settings</h1>
            <p>Save your Angel One SmartAPI key and JWT token for read-only trade sync.</p>
          </div>
          <div className="zerodha-header-actions">
            <button
              className="settings-help-btn"
              type="button"
              aria-expanded={helpOpen}
              aria-controls="angelone-sync-help"
              onClick={() => setHelpOpen(open => !open)}
            >
              {helpOpen ? 'Hide help' : 'Help'}
            </button>
          </div>
        </header>

        <div className="zerodha-notice">
          TradeLore imports the Angel One trade book for journaling and analytics. TradeLore does not place, modify, or cancel orders.
        </div>

        {helpOpen && (
          <section className="settings-panel zerodha-help-panel" id="angelone-sync-help">
            <div className="zerodha-help-header">
              <div>
                <h2>How to Sync Angel One</h2>
                <p className="settings-muted">Use Angel One SmartAPI to generate a JWT token, then save it with your SmartAPI key.</p>
              </div>
              <button className="modal-close" type="button" aria-label="Close Angel One sync help" onClick={() => setHelpOpen(false)}>x</button>
            </div>

            <ol className="zerodha-help-steps">
              <li>
                <strong>Create or open your SmartAPI app.</strong>
                Sign in to Angel One SmartAPI and copy the API key for your app.
              </li>
              <li>
                <strong>Redirect URL.</strong>
                Not required for the current Angel One JWT token sync flow.
              </li>
              <li>
                <strong>Generate a JWT token.</strong>
                Use Angel One SmartAPI login with your client code, PIN/password, and TOTP to obtain a JWT token.
              </li>
              <li>
                <strong>Save access in TradeLore.</strong>
                Paste the SmartAPI key and JWT token into Save Angel One Access, then click Save credentials.
              </li>
              <li>
                <strong>Sync your trade book.</strong>
                Click Sync Angel One. TradeLore imports SmartAPI trade book fills and matches closed positions.
              </li>
              <li>
                <strong>Refresh when needed.</strong>
                If the JWT expires or Angel One rejects the token, generate a fresh JWT token and save it again.
              </li>
            </ol>

            <div className="zerodha-help-note">
              TradeLore stores the SmartAPI key and JWT token only. It does not store your Angel One PIN/password or TOTP secret.
            </div>
          </section>
        )}

        {message && <div className="auth-alert success">{message}</div>}
        {error && <div className="auth-alert error">{error}</div>}

        <section className="settings-grid">
          <div className="settings-panel">
            <h2>Connection</h2>
            {loading ? (
              <p className="settings-muted">Loading Angel One settings...</p>
            ) : (
              <dl className="settings-details">
                <div>
                  <dt>API key</dt>
                  <dd>{status?.api_key_masked || 'Not saved'}</dd>
                </div>
                <div>
                  <dt>JWT token</dt>
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
              <button className="auth-header-btn" onClick={syncAngelOne} disabled={syncing || saving || loading || !status?.credentials_configured}>
                {syncing ? 'Syncing...' : 'Sync Angel One'}
              </button>
              <button className="auth-header-btn" onClick={disconnect} disabled={saving || loading || !status?.credentials_configured}>
                Disconnect Angel One
              </button>
            </div>
            {status?.last_sync_status === 'error' && status.last_sync_error && (
              <p className="settings-muted">{status.last_sync_error}</p>
            )}
          </div>

          <form className="settings-panel settings-form" onSubmit={saveCredentials}>
            <h2>Save Angel One Access</h2>
            <div>
              <label>SmartAPI key</label>
              <input
                value={apiKey}
                onChange={event => setApiKey(event.target.value)}
                placeholder="Enter your Angel One SmartAPI key"
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>
            <div>
              <label>JWT token</label>
              <input
                type="password"
                value={jwtToken}
                onChange={event => setJwtToken(event.target.value)}
                placeholder="Enter your Angel One JWT token"
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
