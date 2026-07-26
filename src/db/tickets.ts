import { supabase } from './supabase.js';

export type TicketStatus = 'new' | 'reviewing' | 'progress' | 'resolved';

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

export async function getMyTicket(telegramId: number, ticketCode: string) {
  const { data, error } = await supabase
    .from('tickets')
    .select('id,ticket_code,type,status,text,created_at')
    .eq('telegram_id', telegramId)
    .eq('ticket_code', ticketCode)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { data: messages, error: msgError } = await supabase
    .from('ticket_messages')
    .select('sender_type,text,created_at')
    .eq('ticket_id', data.id)
    .order('created_at', { ascending: false })
    .limit(8);

  if (msgError) throw msgError;

  return {
    ...data,
    messages: (messages ?? []).reverse(),
  };
}

export async function listAdminTickets(status?: TicketStatus) {
  let query = supabase
    .from('admin_ticket_view')
    .select('ticket_code,type,status,source,text,created_at')
    .order('created_at', { ascending: false })
    .limit(15);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getAdminTicket(ticketCode: string) {
  const { data, error } = await supabase
    .from('admin_ticket_view')
    .select('id,ticket_code,type,status,source,text,created_at')
    .eq('ticket_code', ticketCode)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const { data: messages, error: msgError } = await supabase
    .from('ticket_messages')
    .select('sender_type,text,created_at')
    .eq('ticket_id', data.id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (msgError) throw msgError;

  return {
    ...data,
    messages: (messages ?? []).reverse(),
  };
}

export async function updateTicketStatus(
  ticketCode: string,
  status: TicketStatus,
) {
  const { data, error } = await supabase
    .from('tickets')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('ticket_code', ticketCode)
    .select('telegram_id')
    .single();

  if (error) throw error;
  return Number(data.telegram_id);
}

export async function getTicketOwnerId(
  ticketCode: string,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select('telegram_id')
    .eq('ticket_code', ticketCode)
    .maybeSingle();

  if (error) throw error;
  return data ? Number(data.telegram_id) : null;
}

export async function addTicketMessage(
  ticketCode: string,
  senderType: 'user' | 'admin' | 'superadmin',
  text: string,
) {
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('id')
    .eq('ticket_code', ticketCode)
    .single();

  if (ticketError) throw ticketError;

  const { error } = await supabase.from('ticket_messages').insert({
    ticket_id: ticket.id,
    sender_type: senderType,
    text,
  });

  if (error) throw error;
}

export async function revealTicketIdentity(
  ticketCode: string,
  superadminTelegramId: number,
  reason: string,
) {
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('id,telegram_id')
    .eq('ticket_code', ticketCode)
    .single();

  if (ticketError) throw ticketError;

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('telegram_id,full_name,username,user_type')
    .eq('telegram_id', ticket.telegram_id)
    .single();

  if (userError) throw userError;

  const { error: logError } = await supabase.from('identity_logs').insert({
    ticket_id: ticket.id,
    superadmin_telegram_id: superadminTelegramId,
    reason,
  });

  if (logError) throw logError;
  return user;
}
