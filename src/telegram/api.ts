import { env } from '../config.js';

const API = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;

export async function telegram(
  method: string,
  payload: Record<string, unknown>,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const body = await response.json().catch(() => null);

    if (!response.ok || !(body as { ok?: boolean } | null)?.ok) {
      console.error(`Telegram ${method} failed:`, body);
      throw new Error(`Telegram API error: ${method}`);
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
}

export function sendMessage(
  chatId: number,
  text: string,
  extra: Record<string, unknown> = {},
) {
  return telegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...extra,
  });
}

export function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  extra: Record<string, unknown> = {},
) {
  return telegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    ...extra,
  });
}
