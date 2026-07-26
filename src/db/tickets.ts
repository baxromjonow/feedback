import { supabase } from './supabase.js';

export async function listMyTickets(telegramId: number) {
  const { data, error } = await supabase
    .from('tickets')
    .select('ticket_code,type,status,created_at')
    .eq('telegram_id', telegramId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return data ?? [];
}
