function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function parseIds(value?: string): number[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((id) => Number.isSafeInteger(id) && id > 0);
}

export const env = {
  TELEGRAM_BOT_TOKEN: required('TELEGRAM_BOT_TOKEN'),
  TELEGRAM_WEBHOOK_SECRET: required('TELEGRAM_WEBHOOK_SECRET'),
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: required('SUPABASE_SERVICE_ROLE_KEY'),
  SUPERADMIN_IDS: parseIds(process.env.SUPERADMIN_IDS),
  ADMIN_IDS: parseIds(process.env.ADMIN_IDS),
};
