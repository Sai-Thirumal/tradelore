'use client';

import Link from 'next/link';
import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { getErrorMessage } from '@/lib/errors';

interface ZerodhaStatus {
  server_configured: boolean;
  credentials_configured: boolean;
  configured: boolean;
  connected: boolean;
  needs_reconnect: boolean;
  api_key_masked: string;
  api_secret_saved: boolean;
  credentials_saved_at: string | null;
  redirect_url: string;
  token_expires_at: string | null;
  last_sync_at: string | null;
  last_sync_status: string;
  last_sync_error: string;
  blocked_by_broker: string;
  broker_user_id: string;
  broker_user_name: string;
  today: string;
}

async function readApiError(response: Response) {
  const body = await response.json().catch(() => null) as { error?: string } | null;
  return body?.error || `Request failed with status ${response.status}`;
}

function ZerodhaSettingsContent() {
  const searchParams = useSearchParams();
  const initialMessage = searchParams.get('zerodha') === 'credentials_required'
    ? 'Add your Zerodha Personal API credentials before connecting.'
    : '';
  const [status, setStatus] = useState<ZerodhaStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/broker/zerodha/status', { cache: 'no-store' });
      if (!response.ok) throw new Error(await readApiError(response));
      setStatus(await response.json() as ZerodhaStatus);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to load Zerodha settings.'));
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
      const response = await fetch('/api/broker/zerodha/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
      });
      if (!response.ok) throw new Error(await readApiError(response));

      setApiKey('');
      setApiSecret('');
      setMessage('Zerodha API credentials saved securely.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to save Zerodha credentials.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteCredentials = async () => {
    if (!confirm('Delete saved Zerodha credentials and disconnect Zerodha?')) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/broker/zerodha/credentials', { method: 'DELETE' });
      if (!response.ok) throw new Error(await readApiError(response));
      setMessage('Zerodha credentials deleted.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to delete Zerodha credentials.'));
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Zerodha for this session? Your saved API credentials will remain.')) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const response = await fetch('/api/broker/zerodha/disconnect', { method: 'POST' });
      if (!response.ok) throw new Error(await readApiError(response));
      setMessage('Zerodha disconnected. You can reconnect any time.');
      await loadStatus();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to disconnect Zerodha.'));
    } finally {
      setSaving(false);
    }
  };

  const connect = () => {
    if (!status?.credentials_configured) {
      setError('Save your Zerodha API key and secret before connecting.');
      return;
    }
    window.location.href = '/api/broker/zerodha/login';
  };

  const connectedLabel = status?.connected && !status.needs_reconnect ? 'Connected' : 'Not connected';
  const blockedByBroker = status?.blocked_by_broker || '';
  return (
    <main className="zerodha-settings-page">
      <section className="zerodha-settings-shell">
        <header className="zerodha-settings-header">
          <div>
            <Link className="settings-back-link" href="/">Back to dashboard</Link>
            <h1>Zerodha Settings</h1>
            <p>Use your own Zerodha Personal API app credentials for TradeLore sync.</p>
          </div>
          <div className="zerodha-header-actions">
            <button
              className="settings-help-btn"
              type="button"
              aria-expanded={helpOpen}
              aria-controls="zerodha-sync-help"
              onClick={() => setHelpOpen(open => !open)}
            >
              {helpOpen ? 'Hide help' : 'Help'}
            </button>
            <button className="auth-header-btn" onClick={connect} disabled={saving || loading || !status?.credentials_configured}>
              Connect Zerodha
            </button>
          </div>
        </header>

        <div className="zerodha-notice">
          TradeLore only imports executed trades for journaling and analytics. TradeLore does not place, modify, or cancel orders.
        </div>

        {helpOpen && (
          <section className="settings-panel zerodha-help-panel" id="zerodha-sync-help">
            <div className="zerodha-help-header">
              <div>
                <h2>How to Sync Zerodha</h2>
                <p className="settings-muted">Follow these steps once to connect your Kite account, then reconnect daily when Zerodha&apos;s session expires.</p>
              </div>
              <button className="modal-close" type="button" aria-label="Close Zerodha sync help" onClick={() => setHelpOpen(false)}>x</button>
            </div>

            <ol className="zerodha-help-steps">
              <li>
                <strong>Create a Zerodha Personal app.</strong>
                Open the Kite Connect developer console, create a Personal app, and copy its API key and API secret.
              </li>
              <li>
                <strong>Set the redirect URL in Zerodha.</strong>
                Copy the Redirect URL from the Personal App Setup section below and paste it into the app&apos;s Redirect URL field in Zerodha.
              </li>
              <li>
                <strong>Save credentials in TradeLore.</strong>
                Paste the API key and API secret into Save Personal API Credentials, then click Save credentials.
              </li>
              <li>
                <strong>Connect Zerodha.</strong>
                Click Connect Zerodha, approve the Kite login screen, and you will return to TradeLore once Zerodha authorizes the session.
              </li>
              <li>
                <strong>Sync your trades.</strong>
                After connecting, TradeLore imports your executed orders and matches them into trades for analytics and journaling.
              </li>
              <li>
                <strong>Reconnect when needed.</strong>
                Zerodha access tokens are short-lived. If TradeLore shows Reconnect, click Connect Zerodha again before syncing that day&apos;s trades.
              </li>
            </ol>

            <div className="zerodha-help-note">
              Use the API key and secret from your own Personal app. Shared app credentials or a mismatched redirect URL can cause connection failures.
            </div>
          </section>
        )}

        {message && <div className="auth-alert success">{message}</div>}
        {error && <div className="auth-alert error">{error}</div>}
        {blockedByBroker && (
          <div className="auth-alert error">
            You can only connect one broker at a time. Go to <Link href="/settings/broker">Broker Settings</Link> to switch from {blockedByBroker}.
          </div>
        )}
        <section className="settings-grid">
          <div className="settings-panel">
            <h2>Saved Credentials</h2>
            {loading ? (
              <p className="settings-muted">Loading Zerodha settings...</p>
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
                  <dt>Connection</dt>
                  <dd>{connectedLabel}</dd>
                </div>
                <div>
                  <dt>Zerodha user</dt>
                  <dd>{status?.broker_user_name || status?.broker_user_id || 'Not connected'}</dd>
                </div>
              </dl>
            )}

            <div className="settings-actions">
              <button className="auth-header-btn" onClick={disconnect} disabled={saving || loading || !status?.connected}>
                Disconnect Zerodha
              </button>
              <button className="settings-danger-btn" onClick={deleteCredentials} disabled={saving || loading || !status?.credentials_configured}>
                Delete credentials
              </button>
            </div>
          </div>

          <form className="settings-panel settings-form" onSubmit={saveCredentials}>
            <h2>Save Personal API Credentials</h2>
            <div>
              <label>API key</label>
              <input
                value={apiKey}
                onChange={event => setApiKey(event.target.value)}
                placeholder="Enter your Kite API key"
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
                placeholder="Enter your Kite API secret"
                autoComplete="new-password"
                spellCheck={false}
                required
              />
            </div>
            <button className="auth-submit" type="submit" disabled={saving || loading || Boolean(blockedByBroker)}>
              {saving ? 'Saving...' : 'Save credentials'}
            </button>
          </form>
        </section>

        <section className="settings-panel">
          <h2>Personal App Setup</h2>
          <p className="settings-muted">Create a Zerodha Personal app and set this as the Redirect URL:</p>
          <input
            className="settings-readonly-input"
            value={status?.redirect_url || ''}
            readOnly
            aria-label="Zerodha redirect URL"
          />
        </section>
      </section>
    </main>
  );
}

export default function ZerodhaSettingsPage() {
  return (
    <Suspense fallback={<main className="zerodha-settings-page"><section className="zerodha-settings-shell">Loading Zerodha settings...</section></main>}>
      <ZerodhaSettingsContent />
    </Suspense>
  );
}
