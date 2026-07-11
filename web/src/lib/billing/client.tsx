'use client';

import { useState } from 'react';
import type { InternalPlanKey } from './config';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void; on(event: string, handler: () => void): void };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  scriptPromise ||= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Razorpay Checkout.'));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export function useRazorpaySubscriptionCheckout(plan: InternalPlanKey) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function start() {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      await loadRazorpay();
      const res = await fetch('/api/billing/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to create subscription.');

      const checkout = new window.Razorpay!({
        key: data.keyId,
        subscription_id: data.providerSubscriptionId,
        name: data.planDisplayName,
        description: 'TradeLore Pro — Monthly Subscription',
        prefill: data.prefill || {},
        handler: async (response: Record<string, string>) => {
          setMessage('Payment received. Verifying subscription...');
          const verify = await fetch('/api/billing/subscriptions/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });
          setMessage(verify.ok ? 'Subscription is pending webhook confirmation.' : 'Payment verification failed.');
          setBusy(false);
        },
      });
      checkout.on('payment.failed', () => {
        setMessage('Payment was not completed.');
        setBusy(false);
      });
      checkout.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start checkout.');
      setBusy(false);
    }
  }

  return { busy, message, start };
}
