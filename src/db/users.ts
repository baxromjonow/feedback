import { supabase } from './supabase.js';

export type UserType = 'student' | 'employee' | 'unknown';

export async function upsertTelegramUser(input: {
  telegramId: number;
  firstName?: string;
  lastName?: string;
  username?: string;
  userType?: UserType;
}) {
  const fullName = [input.firstName, input.lastName].filter(Boolean).join(' ') || null;

  const row = {
    telegram_id: input.telegramId,
    full_name: fullName,
    username: input.username ?? null,
    user_type: input.userType ?? 'unknown',
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('users')
    .upsert(row, { onConflict: 'telegram_id' });

  if (error) throw error;
}
