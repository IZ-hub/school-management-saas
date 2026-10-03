import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';

const BASE = 'https://v3.api.termii.com/api';

/** Thin wrapper around Termii's SMS API. Swapped for a fake in tests. */
@Injectable()
export class TermiiClient {
  /** Confirms an API key works and returns the account balance. */
  async checkKey(apiKey: string): Promise<{ balance: number; currency: string }> {
    let res: Response;
    try {
      res = await fetch(`${BASE}/get-balance?api_key=${encodeURIComponent(apiKey)}`, { signal: AbortSignal.timeout(15_000) });
    } catch {
      throw new BadGatewayException("We couldn't reach Termii. Try again in a moment.");
    }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || body.balance === undefined) throw new BadRequestException('Termii did not accept this API key.');
    return { balance: Number(body.balance), currency: body.currency ?? 'NGN' };
  }

  /** Sends one SMS. Throws with Termii's message if it is refused. */
  async send(apiKey: string, senderId: string, to: string, sms: string): Promise<{ messageId: string | null }> {
    let res: Response;
    try {
      res = await fetch(`${BASE}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: apiKey, to, from: senderId, sms, type: 'plain', channel: 'generic' }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new Error('Could not reach Termii');
    }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok || !body.message_id) throw new Error(body.message || `Termii error ${res.status}`);
    return { messageId: String(body.message_id) };
  }
}
