import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { FirebaseService } from '../../firebase/firebase.service';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { mailEnabled, sendMail } from '../../common/mailer';

/** Where website and chat messages are emailed. Replies go straight to the visitor. */
const supportInbox = () => process.env.SUPPORT_INBOX || 'hello@schoolprecise.com';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 8;

@Injectable()
export class SupportService {
  // Per-instance limiter: enough to stop a single visitor or bot flooding the inbox.
  private readonly recent = new Map<string, number[]>();

  constructor(private readonly firebase: FirebaseService) {}

  private get col() {
    return this.firebase.firestore.collection('supportMessages');
  }

  private checkRateLimit(visitorKey: string) {
    const now = Date.now();
    const hits = (this.recent.get(visitorKey) ?? []).filter((t) => now - t < WINDOW_MS);
    if (hits.length >= MAX_PER_WINDOW) {
      throw new HttpException('Too many messages. Please wait a few minutes and try again.', HttpStatus.TOO_MANY_REQUESTS);
    }
    hits.push(now);
    this.recent.set(visitorKey, hits);
    if (this.recent.size > 5000) this.recent.clear();
  }

  async create(dto: CreateSupportMessageDto, visitorKey: string, userAgent?: string) {
    // Bots fill the hidden field: pretend it worked so they don't adapt, but store nothing.
    if (dto.website) return { received: true };

    this.checkRateLimit(visitorKey);

    const now = new Date();
    await this.col.add({
      name: dto.name.trim(),
      email: dto.email.trim().toLowerCase(),
      message: dto.message.trim(),
      conversationId: dto.conversationId || null,
      page: dto.page || null,
      userAgent: userAgent?.slice(0, 300) || null,
      status: 'NEW',
      createdAt: now,
    });

    // Email it to the team; the message is already saved, so a failed email never fails the visitor.
    if (mailEnabled()) {
      const name = dto.name.trim();
      const email = dto.email.trim().toLowerCase();
      const body = dto.message.trim();
      const where = dto.page ? `Sent from ${dto.page}` : 'Sent from the website';
      await sendMail(
        supportInbox(),
        // One subject per visitor, so Gmail keeps a conversation in one thread.
        `School Precise message from ${name}`,
        `${body}\n\n— ${name} <${email}>\n${where}. Reply to this email to answer them.`,
        `<p style="white-space:pre-wrap">${esc(body)}</p><p style="color:#5f6a63">— ${esc(name)} &lt;${esc(email)}&gt;<br>${esc(where)}. Reply to this email to answer them.</p>`,
        { replyTo: email },
      );
    }
    return { received: true };
  }
}
