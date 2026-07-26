import { supabase } from './supabase.js';

export type TicketType = 'suggestion' | 'complaint' | 'request' | 'other';

export async function setTicketState(
  telegramId: number,
  ticketType: TicketType,
) {
  const { error } = await supabase.from('user_states').upsert(
    {
      telegram_id: telegramId,
      state: 'awaiting_ticket_text',
      ticket_type: ticketType,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'telegram_id' },
  );

  if (error) throw error;
}

export async function createTicketFromState(
  telegramId: number,
  text: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('create_ticket_from_state', {
    p_telegram_id: telegramId,
    p_text: text,
  });

  if (error) throw error;

  return typeof data === 'string' ? data : null;
}
