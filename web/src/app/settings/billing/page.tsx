'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRazorpaySubscriptionCheckout } from '@/lib/billing/client';

interface BillingStatus {
  hasAccess: boolean;
  entitlementSource: string;
  trialExpiresAt: string | null;
  subscriptionStatus: string;
  displayPrice: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  launchPriceActive: boolean;
}

export default function BillingSettingsPage() {
  const launchCheckout = useRazorpaySubscriptionCheckout('pro_launch_monthly');
  const standardCheckout = useRazorpaySubscriptionCheckout('pro_standard_monthly');
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    void fetch('/api/billing/status', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Unable to load billing status.');
        setStatus(data);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load billing status.'));
  }, []);

  const currentPlan = status?.launchPriceActive ? launchCheckout : standardCheckout;

  return (
    <main className="zerodha-settings-page">
      <section className="zerodha-settings-shell">
        <header className="zerodha-settings-header">
          <div>
            <Link className="settings-back-link" href="/dashboard">Back to dashboard</Link>
            <h1>Billing</h1>
            <p>Manage your TradeLore Pro monthly subscription.</p>
          </div>
        </header>

        <section className="settings-panel">
          <h2>TradeLore Pro</h2>
          {error && <p className="settings-muted">{error}</p>}
          {status && (
            <dl className="settings-details">
              <div>
                <dt>Access</dt>
                <dd>{status.hasAccess ? status.entitlementSource : 'No active entitlement'}</dd>
              </div>
              <div>
                <dt>Subscription</dt>
                <dd>{status.subscriptionStatus}</dd>
              </div>
              <div>
                <dt>Renews through</dt>
                <dd>{status.currentPeriodEnd || status.trialExpiresAt || 'Not set'}</dd>
              </div>
            </dl>
          )}
        </section>

        <section className="settings-panel settings-form">
          <h2>{status?.launchPriceActive ? 'Launch monthly plan' : 'Monthly plan'}</h2>
          <p className="settings-muted">{status?.launchPriceActive ? '₹199/month while launch pricing is available.' : '₹299/month.'}</p>
          <p className="settings-muted">Payments for TradeLore are processed under Sai Thirumal Reddy Nakkala.</p>
          <button
            className="auth-submit broker-settings-submit"
            type="button"
            disabled={currentPlan.busy}
            onClick={currentPlan.start}
          >
            {currentPlan.busy ? 'Opening Checkout...' : 'Upgrade to Pro'}
          </button>
          {(currentPlan.message || standardCheckout.message || launchCheckout.message) && (
            <p className="settings-muted">{currentPlan.message || standardCheckout.message || launchCheckout.message}</p>
          )}
        </section>
      </section>
    </main>
  );
}
