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
  redirect_url?: string;
  token_expires_at: string | null;
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

export default function DhanSettingsPage() {
  const [status, setStatus] = useState<DhanStatus | null>(null);
  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
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
        body: JSON.stringify({ client_id: clientId, api_key: apiKey, api_secret: apiSecret }),
      });
      if (!response.ok) throw new Error(await readApiError(response));

      setClientId('');
      setApiKey('');
      setApiSecret('');
      setMessage('Dhan API credentials saved securely. Connect Dhan before syncing.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to save Dhan credentials.'));
    } finally {
      setSaving(false);
    }
  };

  const connect = () => {
    if (!status?.credentials_configured) {
      setError('Save your Dhan Client ID, API key, and API secret before connecting.');
      return;
    }
    window.location.href = '/api/broker/dhan/login';
  };

  const deleteCredentials = async () => {
    if (!confirm('Delete saved Dhan credentials and disconnect Dhan?')) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/broker/dhan/credentials', { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiError(response));
      setMessage('Dhan credentials deleted.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to delete Dhan credentials.'));
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
            <p>Use your DhanHQ API key and secret to reconnect through Dhan when the session expires.</p>
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
            <button className="auth-header-btn" onClick={connect} disabled={saving || loading || !status?.credentials_configured}>
              Connect Dhan
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
                <p className="settings-muted">Create DhanHQ app credentials, connect through Dhan, then sync the trade book.</p>
              </div>
              <button className="modal-close" type="button" aria-label="Close Dhan sync help" onClick={() => setHelpOpen(false)}>x</button>
            </div>

            <ol className="zerodha-help-steps">
              <li>
                <strong>Open DhanHQ API settings.</strong>
                Visit Dhan Web Platform, click My Profile in the top right, and select Access DhanHQ APIs.
              </li>
              <li>
                <strong>Generate credentials.</strong>
                Toggle to the API Key tab, enter your Application Name, and paste this URL into both Redirect URL and Postback URL:
                <input
                  className="settings-readonly-input"
                  value={status?.redirect_url || ''}
                  readOnly
                  aria-label="Dhan redirect and postback URL"
                />
              </li>
              <li>
                <strong>Save credentials in TradeLore.</strong>
                Paste your Client ID, API key, and API secret into Save Dhan API Credentials, then click Save credentials.
              </li>
              <li>
                <strong>Connect Dhan.</strong>
                Click Connect Dhan, complete login/TOTP on Dhan, and Dhan will redirect back to TradeLore.
              </li>
              <li>
                <strong>Sync your trades.</strong>
                Click Sync Dhan. TradeLore imports Dhan trade fills and matches closed positions for analytics and journaling.
              </li>
              <li>
                <strong>Reconnect when needed.</strong>
                Dhan access tokens are short-lived. Click Connect Dhan again when TradeLore shows reconnect.
              </li>
            </ol>

            <div className="zerodha-help-note">
              TradeLore stores your Dhan app credentials and daily access token. Your Dhan password, PIN, and TOTP stay on Dhan.
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
                  <dd>{status?.broker_user_id || 'Not saved'}</dd>
                </div>
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
              <button className="auth-header-btn" onClick={syncDhan} disabled={syncing || saving || loading || !status?.connected}>
                {syncing ? 'Syncing...' : 'Sync Dhan'}
              </button>
              <button className="auth-header-btn" onClick={disconnect} disabled={saving || loading || !status?.credentials_configured}>
                Disconnect Dhan
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
            <h2>Save Dhan API Credentials</h2>
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
              <label>API key</label>
              <input
                value={apiKey}
                onChange={event => setApiKey(event.target.value)}
                placeholder="Enter your Dhan API key"
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
                placeholder="Enter your Dhan API secret"
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
          <p className="settings-muted">Set this as the Redirect URL in your Dhan API key setup:</p>
          <input
            className="settings-readonly-input"
            value={status?.redirect_url || ''}
            readOnly
            aria-label="Dhan redirect URL"
          />
        </section>
      </section>
    </main>
  );
}
