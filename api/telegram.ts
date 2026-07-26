import { waitUntil } from '@vercel/functions';
import { handleUpdate } from '../src/bot/handler.js';
import { env } from '../src/config.js';
import type { TelegramUpdate } from '../src/telegram/types.js';

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return Response.json({ ok: true, service: 'alaziz-feedback-bot' });
    }

    const secret = request.headers.get('x-telegram-bot-api-secret-token');

    if (!secret || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      const update = (await request.json()) as TelegramUpdate;
      const result = await handleUpdate(update, waitUntil);

      // Telegram webhook response can directly call one Bot API method.
      // This removes one extra outbound HTTP request from the hot path.
      return result
        ? Response.json(result)
        : Response.json({ ok: true });
    } catch (error) {
      console.error('Webhook error:', error);

      // Returning 200 prevents useless Telegram retries for malformed updates.
      // Real DB/API failures are logged; user-facing handlers provide feedback.
      return Response.json({ ok: true });
    }
  },
};
