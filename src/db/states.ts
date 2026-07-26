import { supabase } from './supabase.js';

export type TicketType = 'suggestion' | 'complaint' | 'request' | 'other';

export type CreatedTicket = {
  ticketCode: string;
  type: TicketType;
};

export async function setTicketState(
  telegramId: number,
  ticketType: TicketType,
) {
  const { error } = await supabase.from('user_states').upsert(
    {
      telegram_id: telegramId,
      state: 'awaiting_ticket_text',
      ticket_type: ticketType,
      ticket_code: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'telegram_id' },
  );

  if (error) throw error;
}

export async function setUserReplyState(
  telegramId: number,
  ticketCode: string,
) {
  const { error } = await supabase.from('user_states').upsert(
    {
      telegram_id: telegramId,
      state: 'awaiting_ticket_reply',
      ticket_type: null,
      ticket_code: ticketCode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'telegram_id' },
  );

  if (error) throw error;
}

export async function consumeUserReplyState(
  telegramId: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_states')
    .select('state,ticket_code')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.state !== 'awaiting_ticket_reply' || !data.ticket_code) {
    return null;
  }

  const { error: deleteError } = await supabase
    .from('user_states')
    .delete()
    .eq('telegram_id', telegramId);

  if (deleteError) throw deleteError;
  return String(data.ticket_code);
}

export async function createTicketFromState(
  telegramId: number,
  text: string,
): Promise<CreatedTicket | null> {
  const { data, error } = await supabase.rpc('create_ticket_from_state_v2', {
    p_telegram_id: telegramId,
    p_text: text,
  });

  if (error) throw error;
  if (!data || typeof data !== 'object') return null;

  const row = data as { ticket_code?: unknown; type?: unknown };
  if (typeof row.ticket_code !== 'string' || typeof row.type !== 'string') {
    return null;
  }

  return {
    ticketCode: row.ticket_code,
    type: row.type as TicketType,
  };
}

export async function setAdminReplyState(
  adminTelegramId: number,
  ticketCode: string,
) {
  const { error } = await supabase.from('admin_states').upsert(
    {
      telegram_id: adminTelegramId,
      state: 'awaiting_admin_reply',
      ticket_code: ticketCode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'telegram_id' },
  );

  if (error) throw error;
}

export async function consumeAdminReplyState(
  adminTelegramId: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('admin_states')
    .select('state,ticket_code')
    .eq('telegram_id', adminTelegramId)
    .maybeSingle();

  if (error) throw error;
  if (!data || data.state !== 'awaiting_admin_reply' || !data.ticket_code) {
    return null;
  }

  const { error: deleteError } = await supabase
    .from('admin_states')
    .delete()
    .eq('telegram_id', adminTelegramId);

  if (deleteError) throw deleteError;
  return String(data.ticket_code);
}
