import { getRazorpayKeyId, getRazorpayKeySecret } from './config.ts';

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  customer_id?: string | null;
  current_start?: number | null;
  current_end?: number | null;
  ended_at?: number | null;
  created_at?: number | null;
}

export interface RazorpayClient {
  createSubscription(input: {
    planId: string;
    totalCount: number;
    notes: Record<string, string>;
  }): Promise<RazorpaySubscription>;
  cancelSubscription(id: string, cancelAtCycleEnd: boolean): Promise<RazorpaySubscription>;
}

class RazorpayHttpClient implements RazorpayClient {
  private authHeader() {
    return `Basic ${Buffer.from(`${getRazorpayKeyId()}:${getRazorpayKeySecret()}`).toString('base64')}`;
  }

  private async request<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => null) as T | { error?: { code?: string } } | null;
    if (!res.ok) {
      throw new Error(typeof data === 'object' && data && 'error' in data && data.error?.code
        ? data.error.code
        : 'razorpay_request_failed');
    }
    return data as T;
  }

  createSubscription(input: { planId: string; totalCount: number; notes: Record<string, string> }) {
    return this.request<RazorpaySubscription>('/subscriptions', {
      plan_id: input.planId,
      total_count: input.totalCount,
      quantity: 1,
      customer_notify: true,
      notes: input.notes,
    });
  }

  cancelSubscription(id: string, cancelAtCycleEnd: boolean) {
    return this.request<RazorpaySubscription>(`/subscriptions/${encodeURIComponent(id)}/cancel`, {
      cancel_at_cycle_end: cancelAtCycleEnd,
    });
  }
}

export function createRazorpayClient(): RazorpayClient {
  return new RazorpayHttpClient();
}
