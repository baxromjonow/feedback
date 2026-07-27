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


export type IdentityAuditLog = {
  id: number;
  ticket_id: string;
  superadmin_telegram_id: number;
  reason: string;
  created_at: string;
  ticket_code: string;
  superadmin_name: string | null;
  superadmin_username: string | null;
};

export async function listIdentityAuditLogs(
  limit = 15,
): Promise<IdentityAuditLog[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 30);

  const { data: logs, error } = await supabase
    .from('identity_logs')
    .select('id,ticket_id,superadmin_telegram_id,reason,created_at,tickets(ticket_code)')
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw error;
  if (!logs?.length) return [];

  type RawAuditLog = {
    id: number | string;
    ticket_id: string;
    superadmin_telegram_id: number | string;
    reason: string;
    created_at: string;
    tickets: { ticket_code?: string } | { ticket_code?: string }[] | null;
  };
  type RawAdmin = {
    telegram_id: number | string;
    full_name: string | null;
    username: string | null;
  };

  const rawLogs = logs as unknown as RawAuditLog[];
  const adminIds = [
    ...new Set(rawLogs.map((log) => Number(log.superadmin_telegram_id))),
  ];

  const { data: admins, error: adminError } = await supabase
    .from('users')
    .select('telegram_id,full_name,username')
    .in('telegram_id', adminIds);

  if (adminError) throw adminError;

  const rawAdmins = (admins ?? []) as unknown as RawAdmin[];
  const adminsById = new Map(
    rawAdmins.map((admin) => [Number(admin.telegram_id), admin]),
  );

  return rawLogs.map((log) => {
    const telegramId = Number(log.superadmin_telegram_id);
    const admin = adminsById.get(telegramId);
    const ticketRelation = log.tickets as unknown as
      | { ticket_code?: string }
      | { ticket_code?: string }[]
      | null;
    const ticketCode = Array.isArray(ticketRelation)
      ? ticketRelation[0]?.ticket_code
      : ticketRelation?.ticket_code;

    return {
      id: Number(log.id),
      ticket_id: String(log.ticket_id),
      superadmin_telegram_id: telegramId,
      reason: String(log.reason),
      created_at: String(log.created_at),
      ticket_code: ticketCode ?? 'Noma’lum',
      superadmin_name: admin?.full_name ?? null,
      superadmin_username: admin?.username ?? null,
    };
  });
}

export async function getIdentityAuditLog(
  auditId: number,
): Promise<IdentityAuditLog | null> {
  const { data: log, error } = await supabase
    .from('identity_logs')
    .select('id,ticket_id,superadmin_telegram_id,reason,created_at,tickets(ticket_code)')
    .eq('id', auditId)
    .maybeSingle();

  if (error) throw error;
  if (!log) return null;

  type RawAuditDetail = {
    id: number | string;
    ticket_id: string;
    superadmin_telegram_id: number | string;
    reason: string;
    created_at: string;
    tickets: { ticket_code?: string } | { ticket_code?: string }[] | null;
  };
  type RawAdminDetail = {
    full_name: string | null;
    username: string | null;
  };

  const rawLog = log as unknown as RawAuditDetail;
  const telegramId = Number(rawLog.superadmin_telegram_id);
  const { data: admin, error: adminError } = await supabase
    .from('users')
    .select('full_name,username')
    .eq('telegram_id', telegramId)
    .maybeSingle();

  if (adminError) throw adminError;

  const rawAdmin = admin as unknown as RawAdminDetail | null;
  const ticketRelation = rawLog.tickets;
  const ticketCode = Array.isArray(ticketRelation)
    ? ticketRelation[0]?.ticket_code
    : ticketRelation?.ticket_code;

  return {
    id: Number(rawLog.id),
    ticket_id: String(rawLog.ticket_id),
    superadmin_telegram_id: telegramId,
    reason: String(rawLog.reason),
    created_at: String(rawLog.created_at),
    ticket_code: ticketCode ?? 'Noma’lum',
    superadmin_name: rawAdmin?.full_name ?? null,
    superadmin_username: rawAdmin?.username ?? null,
  };
}
