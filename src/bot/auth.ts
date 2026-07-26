import { env } from '../config.js';

export function isSuperadmin(telegramId: number): boolean {
  return env.SUPERADMIN_IDS.includes(telegramId);
}

export function isAdmin(telegramId: number): boolean {
  return isSuperadmin(telegramId) || env.ADMIN_IDS.includes(telegramId);
}
