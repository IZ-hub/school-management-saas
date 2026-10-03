import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';

export interface PaystackTransaction {
  status: string;
  reference: string;
  amount: number; // kobo
  currency: string;
  paidAt: string | null;
  channel: string | null;
  metadata: Record<string, any> | null;
}

const BASE = 'https://api.paystack.co';

/** Thin wrapper around the Paystack API. Swapped for a fake in tests. */
@Injectable()
export class PaystackClient {
  private async call(secretKey: string, path: string, init: RequestInit = {}) {
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new BadGatewayException("We couldn't reach Paystack. Try again in a moment.");
    }
    const body: any = await res.json().catch(() => ({}));
    if (res.status === 401) throw new BadRequestException('Paystack did not accept this secret key.');
    if (!res.ok || body.status === false) throw new BadGatewayException(body.message ? `Paystack: ${body.message}` : 'Paystack returned an error.');
    return body.data;
  }

  /** Confirms a secret key works. */
  async checkKey(secretKey: string): Promise<void> {
    await this.call(secretKey, '/balance');
  }

  async initialize(secretKey: string, body: { email: string; amount: number; reference: string; callback_url: string; metadata: Record<string, any> }): Promise<{ authorizationUrl: string }> {
    const data = await this.call(secretKey, '/transaction/initialize', { method: 'POST', body: JSON.stringify({ ...body, currency: 'NGN' }) });
    return { authorizationUrl: data.authorization_url };
  }

  async verify(secretKey: string, reference: string): Promise<PaystackTransaction> {
    const d = await this.call(secretKey, `/transaction/verify/${encodeURIComponent(reference)}`);
    return { status: d.status, reference: d.reference, amount: d.amount, currency: d.currency, paidAt: d.paid_at ?? null, channel: d.channel ?? null, metadata: d.metadata ?? null };
  }
}
