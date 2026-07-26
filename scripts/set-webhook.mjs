const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const url = process.env.WEBHOOK_URL;

if (!token || !secret || !url) {
  console.error(
    'Missing TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET or WEBHOOK_URL',
  );
  process.exit(1);
}

const response = await fetch(
  `https://api.telegram.org/bot${token}/setWebhook`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    }),
  },
);

const body = await response.json();
console.log(JSON.stringify(body, null, 2));

if (!body.ok) process.exit(1);
